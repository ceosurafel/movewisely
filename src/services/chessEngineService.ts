/**
 * MoveWisely Stockfish 19 WebAssembly engine service.
 *
 * Trust guarantees:
 * - Initialization and search always have finite watchdogs.
 * - Missing/malformed engine scores are rejected, never converted to zero.
 * - Cancellation rejects the caller immediately but does not permit a second
 *   search to start until Stockfish has stopped (or the worker is terminated).
 * - Returned best moves and principal variations are checked against chess.js.
 * - A timed-out or crashed worker is discarded so stale UCI output cannot leak
 *   into the next request.
 */

import { Chess } from 'chess.js';
import {
  EngineStatus,
  EngineScore,
  PrincipalVariation,
  EngineProgressInfo,
  EngineAnalysisResult,
  AnalysisOptions,
  EngineConfig,
} from '../types/engine';

export interface EngineWorkerLike {
  postMessage(message: string): void;
  onmessage: ((event: { data: string }) => void) | null;
  onerror: ((event: any) => void) | null;
  terminate(): void;
}

interface ReadyWaiter {
  resolve: () => void;
  reject: (error: Error) => void;
  timer: ReturnType<typeof setTimeout>;
}

const UCI_MOVE = /^[a-h][1-8][a-h][1-8][qrbn]?$/;
const INIT_TIMEOUT_MS = 12_000;
const READY_TIMEOUT_MS = 5_000;
const STOP_GRACE_MS = 2_000;

function parseInteger(token: string | undefined): number | undefined {
  if (token === undefined || !/^-?\d+$/.test(token)) return undefined;
  const value = Number(token);
  return Number.isSafeInteger(value) ? value : undefined;
}

export class ChessEngineService {
  private worker: EngineWorkerLike | null = null;
  private status: EngineStatus = 'uninitialized';
  private config: Required<EngineConfig>;
  private initPromise: Promise<void> | null = null;
  private initCancel: (() => void) | null = null;

  private isSearching = false;
  private currentTurn: 'w' | 'b' = 'w';
  private currentFen = '';
  private currentMultiPv = 1;

  private activeResolve: ((res: EngineAnalysisResult) => void) | null = null;
  private activeReject: ((err: Error) => void) | null = null;
  private activePvs: Map<number, PrincipalVariation> = new Map();
  private activeRawOutput: string[] = [];
  private activeProgressCallback?: (progress: EngineProgressInfo) => void;
  private activeSignal?: AbortSignal;
  private activeAbortHandler?: () => void;
  private activeSearchSettled = false;

  private searchTimeoutTimer: ReturnType<typeof setTimeout> | null = null;
  private stopGraceTimer: ReturnType<typeof setTimeout> | null = null;
  private readyWaiters: ReadyWaiter[] = [];
  private searchEndWaiters: Array<() => void> = [];

  constructor(config?: EngineConfig) {
    this.config = {
      workerUrl: config?.workerUrl || '/stockfish/stockfish-19-lite-single.js',
      hashMb: config?.hashMb ?? 16,
      skillLevel: config?.skillLevel ?? 20,
    };
  }

  public getStatus(): EngineStatus {
    return this.status;
  }

  public isBusy(): boolean {
    return this.isSearching;
  }

  /** Create the real browser worker. Node tests may inject a Worker polyfill. */
  private createWorker(): EngineWorkerLike {
    if (typeof Worker === 'undefined') {
      throw new Error('Web Workers are not supported in this runtime environment.');
    }

    const w = new Worker(this.config.workerUrl);
    return {
      postMessage: (cmd: string) => w.postMessage(cmd),
      set onmessage(fn: ((event: { data: string }) => void) | null) {
        w.onmessage = fn ? (ev: MessageEvent) => fn({ data: String(ev.data ?? '') }) : null;
      },
      get onmessage() {
        return (w.onmessage as any) ?? null;
      },
      set onerror(fn: ((event: any) => void) | null) {
        w.onerror = fn;
      },
      get onerror() {
        return w.onerror;
      },
      terminate: () => w.terminate(),
    };
  }

  /** Initialize the worker and complete the full UCI handshake with a timeout. */
  public async initEngine(): Promise<void> {
    if (this.status === 'ready' && this.worker) return;
    if (this.initPromise) return this.initPromise;

    this.status = 'initializing';
    const initPromise = new Promise<void>((resolve, reject) => {
      let settled = false;
      let sentOptions = false;
      let timer: ReturnType<typeof setTimeout> | null = null;
      let initWorker: EngineWorkerLike | null = null;

      const fail = (reason: unknown) => {
        if (settled) return;
        settled = true;
        if (timer) clearTimeout(timer);
        const message = reason instanceof Error ? reason.message : String(reason);
        const isCurrentWorker = this.worker === initWorker;
        if (isCurrentWorker) this.worker = null;
        if (initWorker) {
          initWorker.onmessage = null;
          initWorker.onerror = null;
          try { initWorker.terminate(); } catch { /* ignore cleanup failure */ }
        }
        if (isCurrentWorker) this.status = 'error';
        this.initCancel = null;
        this.rejectReadyWaiters(new Error(message));
        reject(new Error(`Stockfish initialization failed: ${message}`));
      };

      try {
        const workerInstance = this.createWorker();
        initWorker = workerInstance;
        this.worker = workerInstance;
        this.initCancel = () => fail(new Error('Stockfish initialization was cancelled'));
        workerInstance.onerror = (event: any) => {
          fail(event?.message || 'Worker failed during UCI initialization');
        };
        workerInstance.onmessage = (event: { data: string }) => {
          const lines = String(event.data ?? '').split(/\r?\n/);
          for (const raw of lines) {
            const line = raw.trim();
            if (!line) continue;
            if (line === 'uciok' && !sentOptions) {
              sentOptions = true;
              try {
                workerInstance.postMessage(`setoption name Hash value ${this.config.hashMb}`);
                workerInstance.postMessage('setoption name UCI_ShowWDL value true');
                workerInstance.postMessage(`setoption name Skill Level value ${this.config.skillLevel}`);
                workerInstance.postMessage('isready');
              } catch (error) {
                fail(error);
                return;
              }
            } else if (line === 'readyok' && sentOptions) {
              if (settled) return;
              settled = true;
              if (timer) clearTimeout(timer);
              this.status = 'ready';
              this.initCancel = null;
              workerInstance.onmessage = this.handleWorkerMessage.bind(this);
              workerInstance.onerror = this.handleWorkerError.bind(this);
              resolve();
              return;
            }
          }
        };
        timer = setTimeout(() => fail(new Error(`UCI handshake exceeded ${INIT_TIMEOUT_MS} ms`)), INIT_TIMEOUT_MS);
        workerInstance.postMessage('uci');
      } catch (error) {
        fail(error);
      }
    });

    this.initPromise = initPromise;
    try {
      await initPromise;
    } finally {
      if (this.initPromise === initPromise) this.initPromise = null;
    }
  }

  private send(cmd: string): void {
    if (!this.worker) throw new Error('Stockfish worker is not initialized.');
    this.worker.postMessage(cmd);
  }

  /** Wait until the engine acknowledges stop or terminate it if it hangs. */
  public async stop(): Promise<void> {
    if (!this.isSearching || !this.worker) return;

    const ended = new Promise<void>((resolve) => {
      this.searchEndWaiters.push(resolve);
    });

    try {
      this.send('stop');
    } catch (error) {
      this.failWorker(error instanceof Error ? error : new Error(String(error)));
    }

    let guardTimer: ReturnType<typeof setTimeout> | null = null;
    const guard = new Promise<void>((resolve) => {
      guardTimer = setTimeout(() => {
        if (this.isSearching) {
          this.failWorker(new Error('Stockfish did not stop within the recovery window'));
        }
        resolve();
      }, STOP_GRACE_MS + 100);
    });
    try {
      await Promise.race([ended, guard]);
    } finally {
      if (guardTimer) clearTimeout(guardTimer);
    }
  }

  /** Send isready and reject if the worker does not respond promptly. */
  public async waitForReady(): Promise<void> {
    if (this.status !== 'ready') await this.initEngine();
    return new Promise<void>((resolve, reject) => {
      const waiter: ReadyWaiter = {
        resolve: () => { clearTimeout(waiter.timer); resolve(); },
        reject: (error) => { clearTimeout(waiter.timer); reject(error); },
        timer: setTimeout(() => {
          this.readyWaiters = this.readyWaiters.filter((candidate) => candidate !== waiter);
          reject(new Error(`Stockfish ready check timed out after ${READY_TIMEOUT_MS} ms`));
        }, READY_TIMEOUT_MS),
      };
      this.readyWaiters.push(waiter);
      try {
        this.send('isready');
      } catch (error) {
        this.readyWaiters = this.readyWaiters.filter((candidate) => candidate !== waiter);
        clearTimeout(waiter.timer);
        reject(error instanceof Error ? error : new Error(String(error)));
      }
    });
  }

  /** Run a real Stockfish search; only validated, completed searches resolve. */
  public async analyze(options: AnalysisOptions): Promise<EngineAnalysisResult> {
    if (options.signal?.aborted) throw new Error('Engine search cancelled: operation aborted');

    const baseValidation = this.validateFen(options.fen);
    if (!baseValidation.valid) {
      throw new Error(`Invalid FEN position: ${baseValidation.error || 'Malformed FEN'}`);
    }

    // If callers supply a UCI move suffix, validate/replay it before validating the PV.
    const position = new Chess(options.fen);
    if (options.moves?.length) {
      for (const uci of options.moves) {
        if (!this.isLegalUciMove(position, uci)) {
          throw new Error(`Invalid UCI move in position suffix: ${uci}`);
        }
        this.applyUciMove(position, uci);
      }
    }
    const effectiveFen = position.fen();
    if (position.isGameOver()) {
      throw new Error('Cannot request a best move from a terminal position with no legal moves.');
    }

    if (this.isSearching) {
      if (options.abortPrevious === false) {
        throw new Error('Engine is busy with another search. Stop it before starting a new search.');
      }
      await this.stop();
    }
    if (this.status !== 'ready' || !this.worker) await this.initEngine();
    if (options.signal?.aborted) throw new Error('Engine search cancelled: operation aborted');

    this.currentTurn = position.turn();
    this.currentFen = effectiveFen;
    this.activePvs.clear();
    this.activeRawOutput = [];
    this.activeProgressCallback = options.onProgress;
    this.activeSignal = options.signal;
    this.activeAbortHandler = undefined;
    this.activeSearchSettled = false;

    const targetMultiPv = Math.max(1, Math.min(10, Math.floor(options.multiPv ?? 1)));
    if (targetMultiPv !== this.currentMultiPv) {
      this.send(`setoption name MultiPV value ${targetMultiPv}`);
      this.currentMultiPv = targetMultiPv;
    }

    const movesSuffix = options.moves?.length ? ` moves ${options.moves.join(' ')}` : '';
    this.send(`position fen ${options.fen}${movesSuffix}`);

    let goCommand = 'go';
    if (options.movetimeMs !== undefined && options.movetimeMs > 0) {
      goCommand += ` movetime ${Math.floor(options.movetimeMs)}`;
    } else if (options.depth !== undefined && options.depth > 0) {
      goCommand += ` depth ${Math.floor(options.depth)}`;
    } else {
      goCommand += ' depth 12';
    }

    const requestedDepth = options.depth && options.depth > 0 ? options.depth : 12;
    const defaultTimeout = options.movetimeMs && options.movetimeMs > 0
      ? Math.max(10_000, options.movetimeMs + 6_000)
      : Math.min(180_000, Math.max(12_000, requestedDepth * 2_000 + 6_000));
    const timeoutLimit = options.timeoutMs ?? defaultTimeout;

    return new Promise<EngineAnalysisResult>((resolve, reject) => {
      this.activeResolve = resolve;
      this.activeReject = reject;
      this.isSearching = true;

      if (options.signal) {
        const onAbort = () => {
          if (!this.isSearching || this.activeSignal !== options.signal) return;
          this.rejectActiveOnce(new Error('Engine search cancelled: operation aborted'));
          this.requestStopWithWatchdog();
        };
        this.activeAbortHandler = onAbort;
        options.signal.addEventListener('abort', onAbort, { once: true });
      }

      this.searchTimeoutTimer = setTimeout(() => {
        if (!this.isSearching) return;
        this.rejectActiveOnce(new Error(`Stockfish search timed out after ${timeoutLimit} ms`));
        this.requestStopWithWatchdog();
      }, timeoutLimit);

      try {
        this.send(goCommand);
      } catch (error) {
        this.failWorker(error instanceof Error ? error : new Error(String(error)));
      }
    });
  }

  private requestStopWithWatchdog(): void {
    try {
      if (this.worker && this.isSearching) this.send('stop');
    } catch (error) {
      this.failWorker(error instanceof Error ? error : new Error(String(error)));
      return;
    }

    if (this.stopGraceTimer) clearTimeout(this.stopGraceTimer);
    this.stopGraceTimer = setTimeout(() => {
      if (this.isSearching) {
        this.failWorker(new Error('Stockfish failed to finish after stop; worker discarded to prevent stale output'));
      }
    }, STOP_GRACE_MS);
  }

  private handleWorkerMessage(event: { data: string }): void {
    const lines = String(event.data ?? '').split(/\r?\n/);
    for (const raw of lines) {
      const line = raw.trim();
      if (!line) continue;
      if (line === 'readyok') {
        const waiters = this.readyWaiters.splice(0);
        waiters.forEach((waiter) => waiter.resolve());
        continue;
      }
      if (!this.isSearching) continue;

      this.activeRawOutput.push(line);
      if (line.startsWith('info ')) {
        this.parseInfoLine(line);
      } else if (line.startsWith('bestmove ')) {
        this.handleBestMove(line);
      }
    }
  }

  private parseInfoLine(line: string): void {
    const tokens = line.trim().split(/\s+/);
    let depth = 0;
    let seldepth: number | undefined;
    let multipv = 1;
    let scoreType: 'cp' | 'mate' | undefined;
    let scoreValue: number | undefined;
    let wdl: { win: number; draw: number; loss: number } | undefined;
    let nodes = 0;
    let nps = 0;
    let timeMs = 0;
    let hashfull: number | undefined;
    let currmove: string | undefined;
    let currmovenumber: number | undefined;
    let pvMoves: string[] = [];

    for (let i = 1; i < tokens.length;) {
      const key = tokens[i];
      if (key === 'pv') {
        pvMoves = tokens.slice(i + 1);
        break;
      }
      if (key === 'depth' && i + 1 < tokens.length) {
        depth = parseInteger(tokens[i + 1]) ?? 0; i += 2;
      } else if (key === 'seldepth' && i + 1 < tokens.length) {
        seldepth = parseInteger(tokens[i + 1]); i += 2;
      } else if (key === 'multipv' && i + 1 < tokens.length) {
        multipv = parseInteger(tokens[i + 1]) ?? 1; i += 2;
      } else if (key === 'score' && i + 2 < tokens.length) {
        const type = tokens[i + 1];
        const value = parseInteger(tokens[i + 2]);
        if ((type === 'cp' || type === 'mate') && value !== undefined) {
          scoreType = type;
          scoreValue = value;
        } else {
          scoreType = undefined;
          scoreValue = undefined;
        }
        i += 3;
      } else if (key === 'wdl' && i + 3 < tokens.length) {
        const win = parseInteger(tokens[i + 1]);
        const draw = parseInteger(tokens[i + 2]);
        const loss = parseInteger(tokens[i + 3]);
        if (win !== undefined && draw !== undefined && loss !== undefined && [win, draw, loss].every(v => v >= 0 && v <= 1000)) {
          wdl = { win, draw, loss };
        }
        i += 4;
      } else if (key === 'nodes' && i + 1 < tokens.length) {
        nodes = Math.max(0, parseInteger(tokens[i + 1]) ?? 0); i += 2;
      } else if (key === 'nps' && i + 1 < tokens.length) {
        nps = Math.max(0, parseInteger(tokens[i + 1]) ?? 0); i += 2;
      } else if (key === 'time' && i + 1 < tokens.length) {
        timeMs = Math.max(0, parseInteger(tokens[i + 1]) ?? 0); i += 2;
      } else if (key === 'hashfull' && i + 1 < tokens.length) {
        hashfull = parseInteger(tokens[i + 1]); i += 2;
      } else if (key === 'currmove' && i + 1 < tokens.length) {
        currmove = tokens[i + 1]; i += 2;
      } else if (key === 'currmovenumber' && i + 1 < tokens.length) {
        currmovenumber = parseInteger(tokens[i + 1]); i += 2;
      } else {
        i++;
      }
    }

    // Missing scores and malformed PVs are not observations and must not enter results.
    if (depth <= 0 || scoreType === undefined || scoreValue === undefined || pvMoves.length === 0) return;
    if (!pvMoves.every(move => UCI_MOVE.test(move)) || !this.isLegalUciPv(this.currentFen, pvMoves)) return;

    const whiteRelative = this.currentTurn === 'w' ? scoreValue : -scoreValue;
    const formatted = scoreType === 'mate'
      ? `Mate in ${Math.abs(scoreValue)}${scoreValue < 0 ? ' (loss)' : ''}`
      : `${whiteRelative >= 0 ? '+' : ''}${(whiteRelative / 100).toFixed(2)}`;
    const score: EngineScore = {
      type: scoreType,
      value: scoreValue,
      whiteRelativeValue: whiteRelative,
      formatted,
      wdl,
    };

    const pv: PrincipalVariation = {
      multipv,
      depth,
      seldepth,
      score,
      pvMoves,
      pvSan: this.convertUciPvToSan(this.currentFen, pvMoves),
      nodes,
      nps,
      timeMs,
      hashfull,
    };
    this.activePvs.set(multipv, pv);

    if (this.activeProgressCallback) {
      this.activeProgressCallback({
        depth, seldepth, nodes, nps, timeMs, hashfull,
        currentMove: currmove,
        currentMoveNumber: currmovenumber,
        pvs: Array.from(this.activePvs.values()).sort((a, b) => a.multipv - b.multipv),
      });
    }
  }

  private handleBestMove(line: string): void {
    const tokens = line.trim().split(/\s+/);
    const bestMove = tokens[1] || '';
    const ponderIndex = tokens.indexOf('ponder');
    const ponder = ponderIndex > -1 ? tokens[ponderIndex + 1] : undefined;
    const pvs = Array.from(this.activePvs.values()).sort((a, b) => a.multipv - b.multipv);
    const primary = pvs[0];

    if (!bestMove || bestMove === '(none)' || !this.isLegalUciMove(new Chess(this.currentFen), bestMove)) {
      this.rejectActiveOnce(new Error(`Stockfish returned no legal best move: ${bestMove || '(missing)'}`));
      this.finishSearch();
      return;
    }
    if (!primary || !primary.score || !Number.isFinite(primary.score.value) || primary.depth <= 0) {
      this.rejectActiveOnce(new Error('Missing or malformed engine evaluation: no valid scored principal variation was returned'));
      this.finishSearch();
      return;
    }
    if (!primary.pvMoves.length || !this.isLegalUciPv(this.currentFen, primary.pvMoves)) {
      this.rejectActiveOnce(new Error('Stockfish returned an illegal or empty principal variation'));
      this.finishSearch();
      return;
    }
    if (primary.pvMoves[0] !== bestMove) {
      this.rejectActiveOnce(new Error('Stockfish bestmove does not match the primary principal variation'));
      this.finishSearch();
      return;
    }

    const result: EngineAnalysisResult = {
      fen: this.currentFen,
      bestMove,
      ponder: ponder && UCI_MOVE.test(ponder) ? ponder : undefined,
      depthReached: primary.depth,
      nodes: primary.nodes,
      timeMs: primary.timeMs,
      nps: primary.nps,
      primaryScore: primary.score,
      pvs,
      rawUciOutput: [...this.activeRawOutput],
    };

    if (!this.activeSearchSettled && this.activeResolve) {
      this.activeSearchSettled = true;
      this.activeResolve(result);
    }
    this.finishSearch();
  }

  private finishSearch(): void {
    if (this.searchTimeoutTimer) clearTimeout(this.searchTimeoutTimer);
    if (this.stopGraceTimer) clearTimeout(this.stopGraceTimer);
    this.searchTimeoutTimer = null;
    this.stopGraceTimer = null;
    if (this.activeSignal && this.activeAbortHandler) {
      this.activeSignal.removeEventListener('abort', this.activeAbortHandler);
    }
    this.activeSignal = undefined;
    this.activeAbortHandler = undefined;
    this.isSearching = false;
    this.activeResolve = null;
    this.activeReject = null;
    this.activeProgressCallback = undefined;
    const waiters = this.searchEndWaiters.splice(0);
    waiters.forEach(resolve => resolve());
  }

  private rejectActiveOnce(error: Error): void {
    if (this.activeSearchSettled) return;
    this.activeSearchSettled = true;
    this.activeReject?.(error);
  }

  private failWorker(error: Error): void {
    this.rejectActiveOnce(error);
    if (this.searchTimeoutTimer) clearTimeout(this.searchTimeoutTimer);
    if (this.stopGraceTimer) clearTimeout(this.stopGraceTimer);
    this.searchTimeoutTimer = null;
    this.stopGraceTimer = null;
    if (this.activeSignal && this.activeAbortHandler) {
      this.activeSignal.removeEventListener('abort', this.activeAbortHandler);
    }
    const failedWorker = this.worker;
    this.worker = null;
    if (failedWorker) {
      failedWorker.onmessage = null;
      failedWorker.onerror = null;
      try { failedWorker.terminate(); } catch { /* ignore cleanup failure */ }
    }
    this.status = 'error';
    this.isSearching = false;
    this.activeResolve = null;
    this.activeReject = null;
    this.activeSignal = undefined;
    this.activeAbortHandler = undefined;
    this.activeProgressCallback = undefined;
    const waiters = this.searchEndWaiters.splice(0);
    waiters.forEach(resolve => resolve());
    this.rejectReadyWaiters(error);
  }

  private rejectReadyWaiters(error: Error): void {
    const waiters = this.readyWaiters.splice(0);
    waiters.forEach(waiter => waiter.reject(error));
  }

  private isLegalUciPv(fen: string, moves: string[]): boolean {
    try {
      const chess = new Chess(fen);
      for (const move of moves) {
        if (!this.isLegalUciMove(chess, move)) return false;
        this.applyUciMove(chess, move);
      }
      return true;
    } catch {
      return false;
    }
  }

  private isLegalUciMove(chess: Chess, uci: string): boolean {
    if (!UCI_MOVE.test(uci)) return false;
    const moves = chess.moves({ verbose: true });
    return moves.some(move =>
      move.from === uci.slice(0, 2) &&
      move.to === uci.slice(2, 4) &&
      (move.promotion || '') === (uci.slice(4, 5) || '')
    );
  }

  private applyUciMove(chess: Chess, uci: string): void {
    const move = chess.move({
      from: uci.slice(0, 2),
      to: uci.slice(2, 4),
      promotion: uci.length > 4 ? uci.slice(4, 5) : undefined,
    });
    if (!move) throw new Error(`Illegal UCI move: ${uci}`);
  }

  private convertUciPvToSan(fen: string, moves: string[]): string[] {
    const san: string[] = [];
    const chess = new Chess(fen);
    for (const uci of moves) {
      try {
        const move = chess.move({
          from: uci.slice(0, 2),
          to: uci.slice(2, 4),
          promotion: uci.length > 4 ? uci.slice(4, 5) : undefined,
        });
        if (!move) return [];
        san.push(move.san);
      } catch {
        return [];
      }
    }
    return san;
  }

  public validateFen(fen: string): { valid: boolean; turn: 'w' | 'b'; error?: string } {
    try {
      const chess = new Chess();
      chess.load(fen);
      return { valid: true, turn: chess.turn() };
    } catch (error) {
      return {
        valid: false,
        turn: 'w',
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  private handleWorkerError(event: any): void {
    const message = event?.message || 'Stockfish worker crashed during analysis';
    this.failWorker(new Error(message));
  }

  /** Terminate the current worker and reject any unresolved operation. */
  public terminate(): void {
    if (this.initCancel) {
      const cancelInitialization = this.initCancel;
      this.initCancel = null;
      cancelInitialization();
    }
    if (this.isSearching) this.rejectActiveOnce(new Error('Stockfish engine terminated'));
    if (this.searchTimeoutTimer) clearTimeout(this.searchTimeoutTimer);
    if (this.stopGraceTimer) clearTimeout(this.stopGraceTimer);
    this.searchTimeoutTimer = null;
    this.stopGraceTimer = null;
    if (this.activeSignal && this.activeAbortHandler) {
      this.activeSignal.removeEventListener('abort', this.activeAbortHandler);
    }
    const oldWorker = this.worker;
    this.worker = null;
    if (oldWorker) {
      oldWorker.onmessage = null;
      oldWorker.onerror = null;
      try { oldWorker.terminate(); } catch { /* ignore cleanup failure */ }
    }
    this.status = 'terminated';
    this.initPromise = null;
    this.isSearching = false;
    this.activeResolve = null;
    this.activeReject = null;
    this.activeSignal = undefined;
    this.activeAbortHandler = undefined;
    this.activeProgressCallback = undefined;
    const waiters = this.searchEndWaiters.splice(0);
    waiters.forEach(resolve => resolve());
    this.rejectReadyWaiters(new Error('Stockfish engine terminated'));
  }

  public async reinitialize(): Promise<void> {
    this.terminate();
    this.status = 'uninitialized';
    this.initPromise = null;
    await this.initEngine();
  }
}

export const chessEngineService = new ChessEngineService();
