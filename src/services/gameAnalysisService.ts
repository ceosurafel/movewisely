/**
 * MoveWisely — Engine-Based Move-By-Move Game Analysis Service
 *
 * Implements Phase 2 & Phase 3:
 * - Legal PGN parsing & full timeline reconstruction via chess.js
 * - Move-by-move position analysis powered by Stockfish 19 WebAssembly
 * - Evaluation normalization across colors, side-to-move parity, and mate scores
 * - Experimental score-proxy model and centipawn loss calculation
 * - Phase 3 Trustworthy Move Grading V1 (Best, Excellent, Good, Inaccuracy, Mistake, Blunder)
 * - Dedicated Contextual Grades (Brilliant, Great, Miss, Book)
 * - MoveWisely Accuracy V1.1 (Experimental; Uncalibrated) unblended game-level aggregation
 * - Position analysis caching for identical FENs
 * - Engine-derived alternative moves and verified resulting board states
 * - Cancellation, timeout management, and progress reporting
 */

import { Chess } from 'chess.js';
import { chessEngineService, ChessEngineService } from './chessEngineService';
import { EngineScore, PrincipalVariation, EngineAnalysisResult } from '../types/engine';
import { GameRecord, SpotlightMove, AnalysisStatus } from '../types/chess';
import { coachingService } from './coachingService';
import {
  calculateExpectedPoints,
  calculateMoveAccuracy,
  classifyStandardGrade,
  evaluateContextualGrade,
  gradeMove,
  aggregateGameAccuracy,
  MoveClassificationGrade,
  StandardMoveGrade,
  ContextualMoveGrade,
  MoveGradeResult,
  AccuracyAggregationResult,
  ACCURACY_ENGINE_VERSION,
} from './accuracyEngine';

export type MoveJudgment = MoveClassificationGrade;

export interface ReconstructedMove {
  ply: number;
  moveNumber: number;
  color: 'white' | 'black';
  san: string;
  uci: string;
  from: string;
  to: string;
  promotion?: string;
  piece: string;
  captured?: string;
  isCheck: boolean;
  isCheckmate: boolean;
  fenBefore: string;
  fenAfter: string;
}

export interface ReconstructedTimeline {
  moves: ReconstructedMove[];
  startingFen: string;
  finalFen: string;
  valid: boolean;
  error?: string;
}

export interface AnalyzedMoveRecord {
  ply: number;
  moveNumber: number;
  color: 'white' | 'black';
  san: string;
  uci: string;
  from: string;
  to: string;
  promotion?: string;
  piece: string;
  captured?: string;
  isCheck: boolean;
  isCheckmate: boolean;
  fenBefore: string;
  fenAfter: string;

  // Genuine engine evaluation before move and perspective-normalized after-move evaluation.
  // After-move evaluations of terminal positions are derived from exact chess rules.
  positionEvaluation: EngineScore;
  evalCpBefore: number; // player perspective
  evalCpAfter: number; // player perspective; Stockfish or exact terminal-state result
  evalBeforeFormatted: string; // player-perspective, including mate/terminal wording
  evalAfterFormatted: string; // player-perspective, including mate/terminal wording
  afterEvaluationSource: 'stockfish' | 'terminal-rules';

  // Best move found by Stockfish 19
  bestMoveUci: string;
  bestMoveSan: string;
  bestMoveFrom: string;
  bestMoveTo: string;
  bestMovePromotion?: string;
  fenAfterBestMove: string;

  // Principal variations
  pvs: PrincipalVariation[];

  // Evaluation loss
  evalLossCp: number;
  expectedPointsBefore: number;
  expectedPointsAfter: number;
  expectedPointsLoss: number;

  // Phase 3 Classification & Accuracy
  judgment: MoveClassificationGrade;
  standardGrade: StandardMoveGrade;
  isContextual: boolean;
  contextualReason?: string;
  moveAccuracyPct: number;

  // Search metadata
  searchDepth: number;
  searchNodes: number;
  engineVersion: string;
}

export interface AnalyzedGameRecord {
  game: GameRecord;
  timeline: ReconstructedTimeline;
  analyzedMoves: AnalyzedMoveRecord[];
  status: AnalysisStatus;
  error?: string;
  userAccuracy: number;
  harmonicAccuracy: number;
  accuracyStats: AccuracyAggregationResult;
  userBlundersCount: number;
  userMistakesCount: number;
  userInaccuraciesCount: number;
  worstMove?: AnalyzedMoveRecord;
  lossPhase: 'Opening' | 'Middlegame' | 'Endgame';
}

export interface AnalysisProgressEvent {
  gameIndex: number;
  totalGames: number;
  phase: 'parsing' | 'engine' | 'synthesis';
  percent: number;
  statusText: string;
}

export interface GameAnalysisOptions {
  depth?: number;
  movetimeMs?: number;
  multiPv?: number;
  signal?: AbortSignal;
  onProgress?: (progress: AnalysisProgressEvent) => void;
}

export class GameAnalysisService {
  private engine: ChessEngineService;
  private positionCache: Map<string, EngineAnalysisResult> = new Map();
  private maxCacheEntries = 2000;

  constructor(engineInstance: ChessEngineService = chessEngineService) {
    this.engine = engineInstance;
  }

  /**
   * Reconstructs the complete move-by-move timeline of a game from its PGN.
   * Validates legal moves and captures exact FENs before and after each halfmove.
   */
  public reconstructTimeline(pgn: string): ReconstructedTimeline {
    const moves: ReconstructedMove[] = [];
    const standardStart = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

    if (!pgn || typeof pgn !== 'string' || !pgn.trim()) {
      return {
        moves: [],
        startingFen: standardStart,
        finalFen: standardStart,
        valid: false,
        error: 'Empty or missing PGN',
      };
    }

    let startingPosition = standardStart;
    let attemptedStartingFen = standardStart;
    try {
      const fenMatch = pgn.match(/^\s*(?:\[[^\]]+\]\s*)*\[FEN\s+"([^"]+)"\]/im);
      const customStartingFen = fenMatch?.[1]?.trim();
      if (customStartingFen) {
        attemptedStartingFen = customStartingFen;
        // Validate custom starting positions rather than silently reverting to the
        // orthodox initial position if the supplied FEN is invalid.
        const customPosition = new Chess(customStartingFen);
        startingPosition = customPosition.fen();
        attemptedStartingFen = startingPosition;
      }

      let parsedChess: Chess | null = null;
      let firstParseError: unknown;
      try {
        const candidate = new Chess();
        candidate.loadPgn(pgn, { strict: false });
        parsedChess = candidate;
      } catch (error) {
        firstParseError = error;
      }

      // Some platform PGNs include malformed headers/comments. Retry only after
      // removing non-move annotations, using a separate Chess object so a failed
      // first parse can never leak a partially parsed game into the result.
      if (!parsedChess) {
        const cleanPgn = pgn
          .replace(/\{[^}]*\}/g, '')
          .replace(/\([^)]*\)/g, '')
          .replace(/\$\d+/g, '')
          .replace(/^\s*\[[^\]]*\]\s*$/gm, '')
          .replace(/\d+\.\.\./g, '')
          .trim();
        try {
          const candidate = customStartingFen ? new Chess(customStartingFen) : new Chess();
          candidate.loadPgn(cleanPgn, { strict: false });
          parsedChess = candidate;
        } catch (fallbackError) {
          const first = firstParseError instanceof Error ? firstParseError.message : String(firstParseError ?? 'PGN parse failed');
          const second = fallbackError instanceof Error ? fallbackError.message : String(fallbackError);
          throw new Error(`PGN could not be parsed (${first}; fallback: ${second})`);
        }
      }

      const validParsedChess = parsedChess;
      if (!validParsedChess) throw new Error('PGN parser did not return a complete parsed position');
      const history = validParsedChess.history({ verbose: true });
      if (!history || history.length === 0) {
        throw new Error('PGN contains no legal moves');
      }

      const replay = customStartingFen ? new Chess(customStartingFen) : new Chess();
      startingPosition = replay.fen();
      for (let i = 0; i < history.length; i++) {
        const histMove = history[i];
        const fenBefore = replay.fen();
        const moveResult = replay.move({
          from: histMove.from,
          to: histMove.to,
          ...(histMove.promotion ? { promotion: histMove.promotion } : {}),
        });
        if (!moveResult || moveResult.san !== histMove.san) {
          throw new Error(`Illegal or inconsistent move encountered during replay at ply ${i + 1}: ${histMove.san}`);
        }

        moves.push({
          ply: i + 1,
          moveNumber: Math.floor(i / 2) + 1,
          color: histMove.color === 'w' ? 'white' : 'black',
          san: histMove.san,
          uci: `${histMove.from}${histMove.to}${histMove.promotion || ''}`,
          from: histMove.from,
          to: histMove.to,
          promotion: histMove.promotion,
          piece: histMove.piece,
          captured: histMove.captured,
          isCheck: replay.inCheck(),
          isCheckmate: replay.isCheckmate(),
          fenBefore,
          fenAfter: replay.fen(),
        });
      }

      // Make sure the replay agrees with the parser's final board. This catches
      // accidental truncation or mismatched custom-FEN handling.
      if (replay.fen() !== validParsedChess.fen()) {
        throw new Error('PGN replay does not match the parsed final position');
      }

      return {
        moves,
        startingFen: startingPosition,
        finalFen: replay.fen(),
        valid: true,
      };
    } catch (err: unknown) {
      return {
        moves: [],
        startingFen: attemptedStartingFen,
        finalFen: attemptedStartingFen,
        valid: false,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  /**
   * Converts Stockfish centipawn/mate score to a consistent player perspective.
   * Handles White vs Black, mates, and draws.
   */
  public normalizeScoreToPerspective(
    score: EngineScore,
    turnAtPosition: 'w' | 'b',
    targetPerspective: 'white' | 'black'
  ): { cpEquivalent: number; formatted: string } {
    if (!score || (score.type !== 'cp' && score.type !== 'mate') || typeof score.value !== 'number' || !Number.isFinite(score.value)) {
      throw new Error('Missing or invalid engine evaluation score: Cannot normalize non-numeric score');
    }

    let whiteRelativeCp = 0;

    if (score.type === 'mate') {
      const mateMoves = score.value; // +N if side to move mates, -N if side to move gets mated
      if (mateMoves > 0) {
        // Side to move delivers mate
        const sign = turnAtPosition === 'w' ? 1 : -1;
        whiteRelativeCp = sign * (10000 - Math.min(50, mateMoves) * 50);
      } else {
        // Side to move gets mated
        const sign = turnAtPosition === 'w' ? -1 : 1;
        whiteRelativeCp = sign * (10000 - Math.min(50, Math.abs(mateMoves)) * 50);
      }
    } else {
      // Centipawn score is relative to side to move
      whiteRelativeCp = turnAtPosition === 'w' ? score.value : -score.value;
    }

    const playerRelativeCp =
      targetPerspective === 'white' ? whiteRelativeCp : -whiteRelativeCp;

    const playerIsSideToMove = (targetPerspective === 'white' && turnAtPosition === 'w') ||
      (targetPerspective === 'black' && turnAtPosition === 'b');
    const formatted = score.type === 'mate'
      ? score.value === 0
        ? (playerIsSideToMove ? 'Checkmated (terminal position)' : 'Checkmate delivered (terminal position)')
        : (score.value > 0) === playerIsSideToMove
          ? `Mate in ${Math.abs(score.value)}`
          : `Mated in ${Math.abs(score.value)}`
      : `${playerRelativeCp >= 0 ? '+' : ''}${(playerRelativeCp / 100).toFixed(2)}`;

    return {
      cpEquivalent: playerRelativeCp,
      formatted,
    };
  }

  /**
   * Calculates the experimental score proxy (0.0 to 1.0; not calibrated win probability)
   * using standard Elo-logistic sigmoid model.
   */
  public calculateExpectedPoints(cp: number): number {
    return calculateExpectedPoints(cp);
  }

  /**
   * Calculates individual move accuracy percentage (0 to 100) from expected points loss.
   */
  public calculateMoveAccuracy(evalLossCpOrExpLoss: number): number {
    // If passed expected points loss directly (0.0 to 1.0)
    if (evalLossCpOrExpLoss <= 1.0) {
      return calculateMoveAccuracy(evalLossCpOrExpLoss);
    }
    // Backward compatibility if passed centipawn loss
    const expLoss = calculateExpectedPoints(0) - calculateExpectedPoints(-evalLossCpOrExpLoss);
    return calculateMoveAccuracy(expLoss);
  }

  /**
   * Classifies move quality based on evaluation loss and expected-points drop.
   */
  public classifyMove(evalLossCp: number, expLoss: number): MoveClassificationGrade {
    return classifyStandardGrade(evalLossCp, expLoss);
  }

  /**
   * Evaluates a single FEN position using Stockfish 19 with in-memory caching.
   */
  public async evaluatePosition(
    fen: string,
    options?: { depth?: number; movetimeMs?: number; multiPv?: number; signal?: AbortSignal }
  ): Promise<EngineAnalysisResult> {
    if (options?.signal?.aborted) {
      throw new Error('Analysis was aborted');
    }

    const fenCheck = this.engine.validateFen(fen);
    if (!fenCheck.valid) throw new Error(`Cannot evaluate invalid FEN: ${fenCheck.error || 'Invalid FEN'}`);
    const initialPosition = new Chess(fen);
    // A best-move search is impossible after a terminal move. Resolve these
    // positions from exact chess rules and label the provenance explicitly
    // instead of making Stockfish search a position with no legal move.
    if (initialPosition.isCheckmate()) {
      const turn = initialPosition.turn();
      const whiteRelativeValue = turn === 'w' ? -10_000 : 10_000;
      return {
        fen: initialPosition.fen(),
        bestMove: '',
        depthReached: 0,
        nodes: 0,
        timeMs: 0,
        nps: 0,
        primaryScore: {
          type: 'mate',
          value: 0,
          whiteRelativeValue,
          formatted: 'Checkmate (terminal position)',
        },
        pvs: [],
        terminalKind: 'checkmate',
        rawUciOutput: ['terminal position resolved by chess.js: checkmate'],
      };
    }
    if (initialPosition.isStalemate() || initialPosition.isInsufficientMaterial() || initialPosition.isDraw()) {
      return {
        fen: initialPosition.fen(),
        bestMove: '',
        depthReached: 0,
        nodes: 0,
        timeMs: 0,
        nps: 0,
        primaryScore: {
          type: 'cp',
          value: 0,
          whiteRelativeValue: 0,
          formatted: 'Drawn terminal position',
        },
        pvs: [],
        terminalKind: 'draw',
        rawUciOutput: ['terminal position resolved by chess.js: draw'],
      };
    }

    const depth = options?.depth ?? 10;
    const movetimeMs = options?.movetimeMs;
    const multiPv = options?.multiPv ?? 1;
    // Cache identity includes all parameters that materially affect a search.
    // Increment ENGINE_CACHE_VERSION when changing engine build/options.
    const ENGINE_CACHE_VERSION = 'stockfish-19-lite-hash16-skill20-v2';
    const cacheKey = [
      ENGINE_CACHE_VERSION,
      fen,
      `depth=${movetimeMs && movetimeMs > 0 ? 'ignored-by-movetime' : depth}`,
      `time=${movetimeMs && movetimeMs > 0 ? Math.floor(movetimeMs) : 'default'}`,
      `multipv=${multiPv}`,
    ].join('|');

    const cached = this.positionCache.get(cacheKey);
    if (cached) {
      if (options?.signal?.aborted) throw new Error('Analysis was aborted');
      return cached;
    }

    const result = await this.engine.analyze({
      fen,
      depth: movetimeMs && movetimeMs > 0 ? undefined : depth,
      movetimeMs,
      multiPv,
      signal: options?.signal,
    });

    if (options?.signal?.aborted) {
      throw new Error('Analysis was aborted');
    }

    // Only successful, fully validated engine results reach this cache.
    if (this.positionCache.size >= this.maxCacheEntries) {
      const firstKey = this.positionCache.keys().next().value;
      if (firstKey) this.positionCache.delete(firstKey);
    }
    this.positionCache.set(cacheKey, result);
    return result;
  }

  /**
   * Clears in-memory position evaluation cache.
   */
  public clearPositionCache(): void {
    this.positionCache.clear();
  }

  /**
   * Returns current count of cached evaluation entries.
   */
  public getCacheSize(): number {
    return this.positionCache.size;
  }

  /**
   * Determines the resulting FEN after applying a best move in UCI format to a position.
   */
  public getFenAfterUciMove(fen: string, uciMove: string): { fen: string; san: string } {
    let c: Chess;
    try {
      c = new Chess(fen);
    } catch (error) {
      throw new Error(`Cannot apply engine recommendation to invalid FEN: ${error instanceof Error ? error.message : String(error)}`);
    }
    if (!/^[a-h][1-8][a-h][1-8][qrbn]?$/.test(uciMove)) {
      throw new Error(`Stockfish returned a malformed UCI best move: ${uciMove}`);
    }
    const from = uciMove.slice(0, 2);
    const to = uciMove.slice(2, 4);
    const promotion = uciMove.length > 4 ? uciMove.slice(4, 5) : undefined;
    const res = c.move({ from, to, ...(promotion ? { promotion } : {}) });
    if (!res) throw new Error(`Stockfish returned an illegal best move for the recorded position: ${uciMove}`);
    return { fen: c.fen(), san: res.san };
  }

  /**
   * Analyzes an individual move played in a game:
   * 1. Evaluates position before the move
   * 2. Evaluates position resulting from the move
   * 3. Calculates evaluation loss, experimental score-proxy swing, best move, and classification
   */
  public async analyzeMove(
    move: ReconstructedMove,
    options?: { depth?: number; movetimeMs?: number; multiPv?: number; signal?: AbortSignal }
  ): Promise<AnalyzedMoveRecord> {
    const turnAtBefore: 'w' | 'b' = move.color === 'white' ? 'w' : 'b';
    const turnAtAfter: 'w' | 'b' = move.color === 'white' ? 'b' : 'w';

    // 1. Evaluate position before move
    const engineBefore = await this.evaluatePosition(move.fenBefore, options);

    // Normalize before score to player's perspective
    const normBefore = this.normalizeScoreToPerspective(
      engineBefore.primaryScore,
      turnAtBefore,
      move.color
    );
    const evalCpBefore = normBefore.cpEquivalent;
    const expBefore = this.calculateExpectedPoints(evalCpBefore);

    // Extract engine best move
    const bestMoveUci = engineBefore.bestMove;
    const bestFrom = bestMoveUci.slice(0, 2);
    const bestTo = bestMoveUci.slice(2, 4);
    const bestPromotion = bestMoveUci.length > 4 ? bestMoveUci.slice(4, 5) : undefined;

    const { fen: fenAfterBestMove, san: bestMoveSan } = this.getFenAfterUciMove(
      move.fenBefore,
      bestMoveUci
    );

    // Evaluate the actual resulting position even when the played move matches
    // Stockfish's top candidate. Do not synthesize an after-score by copying the
    // before-score; the verified post-move evaluation is useful for explanations.
    const engineAfter = await this.evaluatePosition(move.fenAfter, options);
    const normAfter = this.normalizeScoreToPerspective(
      engineAfter.primaryScore,
      turnAtAfter,
      move.color
    );
    const evalCpAfter = normAfter.cpEquivalent;
    const expAfter = this.calculateExpectedPoints(evalCpAfter);

    // If the played UCI move is the engine's top move at the chosen search
    // configuration, it is the reference move for this analysis and receives
    // zero move loss. We still retain the independently measured post-move score.
    const isBestMove = move.uci === bestMoveUci;
    const evalLossCp = isBestMove ? 0 : Math.max(0, evalCpBefore - evalCpAfter);
    const expLoss = isBestMove ? 0 : Math.max(0, expBefore - expAfter);

    // Conservative material-offer evidence: the moved minor/major piece must
    // actually be legally capturable on its destination in the resulting position.
    // A non-capturing move alone is not evidence of a sacrifice.
    const pieceValues: Record<string, number> = { p: 100, n: 300, b: 330, r: 500, q: 900, k: 20_000 };
    let isMaterialSacrifice = false;
    if (['n', 'b', 'r', 'q'].includes(move.piece)) {
      try {
        const afterBoard = new Chess(move.fenAfter);
        const opponentCanCaptureMovedPiece = afterBoard.moves({ verbose: true }).some(candidate =>
          candidate.to === move.to && candidate.captured !== undefined
        );
        const capturedValue = move.captured ? (pieceValues[move.captured] ?? 0) : 0;
        isMaterialSacrifice = opponentCanCaptureMovedPiece && pieceValues[move.piece] > capturedValue;
      } catch {
        isMaterialSacrifice = false;
      }
    }

    // Phase 3 Master Grading
    const gradeResult = gradeMove({
      moveNumber: move.moveNumber,
      color: move.color,
      san: move.san,
      uci: move.uci,
      piece: move.piece,
      captured: move.captured,
      fenBefore: move.fenBefore,
      fenAfter: move.fenAfter,
      evalCpBefore,
      evalCpAfter,
      evalLossCp,
      expectedPointsBefore: expBefore,
      expectedPointsAfter: expAfter,
      expectedPointsLoss: expLoss,
      bestMoveUci,
      bestMoveSan,
      pvs: engineBefore.pvs,
      isMaterialSacrifice,
    });

    return {
      ply: move.ply,
      moveNumber: move.moveNumber,
      color: move.color,
      san: move.san,
      uci: move.uci,
      from: move.from,
      to: move.to,
      promotion: move.promotion,
      piece: move.piece,
      captured: move.captured,
      isCheck: move.isCheck,
      isCheckmate: move.isCheckmate,
      fenBefore: move.fenBefore,
      fenAfter: move.fenAfter,
      positionEvaluation: engineBefore.primaryScore,
      evalCpBefore,
      evalCpAfter,
      evalBeforeFormatted: normBefore.formatted,
      evalAfterFormatted: normAfter.formatted,
      afterEvaluationSource: engineAfter.terminalKind ? 'terminal-rules' : 'stockfish',
      bestMoveUci,
      bestMoveSan,
      bestMoveFrom: bestFrom,
      bestMoveTo: bestTo,
      bestMovePromotion: bestPromotion,
      fenAfterBestMove,
      // Variations must start at the position where the played move was chosen.
      // engineAfter.pvs start one ply later and do not explain bestMoveUci.
      pvs: engineBefore.pvs,
      evalLossCp,
      expectedPointsBefore: expBefore,
      expectedPointsAfter: expAfter,
      expectedPointsLoss: expLoss,
      judgment: gradeResult.grade,
      standardGrade: gradeResult.standardGrade,
      isContextual: gradeResult.isContextual,
      contextualReason: gradeResult.contextualReason,
      moveAccuracyPct: gradeResult.moveAccuracyPct,
      searchDepth: engineBefore.depthReached,
      searchNodes: engineBefore.nodes,
      engineVersion: 'Stockfish 19 Lite WASM',
    };
  }

  /**
   * Analyzes an entire single game move-by-move.
   * Focuses deep engine searches on player moves and critical turning points.
   */
  public async analyzeGame(
    game: GameRecord,
    options?: GameAnalysisOptions
  ): Promise<AnalyzedGameRecord> {
    options?.onProgress?.({
      gameIndex: 0,
      totalGames: 1,
      phase: 'parsing',
      percent: 1,
      statusText: 'Validating PGN and reconstructing the legal move timeline',
    });

    const timeline = this.reconstructTimeline(game.pgn);
    if (!timeline.valid) {
      return {
        game,
        timeline,
        analyzedMoves: [],
        status: 'failed',
        error: timeline.error || 'Invalid or unparseable PGN',
        userAccuracy: 0,
        harmonicAccuracy: 0,
        accuracyStats: aggregateGameAccuracy([]),
        userBlundersCount: 0,
        userMistakesCount: 0,
        userInaccuraciesCount: 0,
        lossPhase: 'Middlegame',
      };
    }

    const isUserWhite = game.userColor === 'white';
    const userColorStr: 'white' | 'black' = isUserWhite ? 'white' : 'black';

    const userMoves = timeline.moves.filter(m => m.color === userColorStr);
    if (userMoves.length === 0) {
      return {
        game,
        timeline,
        analyzedMoves: [],
        status: 'failed',
        error: 'No user moves found in game',
        userAccuracy: 0,
        harmonicAccuracy: 0,
        accuracyStats: aggregateGameAccuracy([]),
        userBlundersCount: 0,
        userMistakesCount: 0,
        userInaccuraciesCount: 0,
        lossPhase: 'Middlegame',
      };
    }

    const analyzedMoves: AnalyzedMoveRecord[] = [];
    const gradeResults: MoveGradeResult[] = [];
    options?.onProgress?.({
      gameIndex: 0,
      totalGames: 1,
      phase: 'engine',
      percent: 4,
      statusText: `Analyzing ${userMoves.length} moves for ${userColorStr === 'white' ? 'White' : 'Black'}`,
    });
    let userBlundersCount = 0;
    let userMistakesCount = 0;
    let userInaccuraciesCount = 0;
    let worstMove: AnalyzedMoveRecord | undefined = undefined;
    let wasCancelled = false;
    let analysisError: string | undefined = undefined;

    // Filter to user moves for deep engine verification
    for (const move of timeline.moves) {
      if (options?.signal?.aborted) {
        wasCancelled = true;
        break;
      }

      if (move.color === userColorStr) {
        try {
          const analyzed = await this.analyzeMove(move, options);
          analyzedMoves.push(analyzed);

          gradeResults.push({
            grade: analyzed.judgment,
            standardGrade: analyzed.standardGrade,
            isContextual: analyzed.isContextual,
            contextualReason: analyzed.contextualReason,
            evalLossCp: analyzed.evalLossCp,
            expectedPointsLoss: analyzed.expectedPointsLoss,
            moveAccuracyPct: analyzed.moveAccuracyPct,
          });

          if (analyzed.standardGrade === 'blunder') {
            userBlundersCount++;
          } else if (analyzed.standardGrade === 'mistake') {
            userMistakesCount++;
          } else if (analyzed.standardGrade === 'inaccuracy') {
            userInaccuraciesCount++;
          }

          if (!worstMove || analyzed.evalLossCp > worstMove.evalLossCp) {
            worstMove = analyzed;
          }

          options?.onProgress?.({
            gameIndex: 0,
            totalGames: 1,
            phase: 'engine',
            percent: 4 + Math.round((analyzedMoves.length / userMoves.length) * 90),
            statusText: `Analyzed ${analyzedMoves.length} of ${userMoves.length} moves`,
          });
        } catch (err: unknown) {
          if (options?.signal?.aborted) {
            wasCancelled = true;
          } else {
            analysisError = err instanceof Error ? err.message : String(err);
          }
          break;
        }
      }
    }

    let status: AnalysisStatus = 'completed';
    if (wasCancelled || options?.signal?.aborted) {
      status = analyzedMoves.length > 0 ? 'partial' : 'cancelled';
    } else if (analysisError) {
      // When a later move fails, retain the verified moves but never label this
      // game complete. Aggregate services must continue to use completed games only.
      status = analyzedMoves.length > 0 ? 'partial' : 'failed';
    } else if (analyzedMoves.length < userMoves.length) {
      status = analyzedMoves.length > 0 ? 'partial' : 'failed';
    }

    options?.onProgress?.({
      gameIndex: 0,
      totalGames: 1,
      phase: 'synthesis',
      percent: 96,
      statusText: 'Summarizing grades and evaluation changes',
    });

    const accuracyStats = aggregateGameAccuracy(gradeResults);
    const userAccuracy =
      status === 'completed' || status === 'partial' ? accuracyStats.accuracyPct : 0;
    const harmonicAccuracy =
      status === 'completed' || status === 'partial' ? accuracyStats.harmonicAccuracyPct : 0;

    // Determine loss phase based on timeline and worst drop
    let lossPhase: 'Opening' | 'Middlegame' | 'Endgame' = 'Middlegame';
    if (worstMove) {
      if (worstMove.moveNumber <= 12) {
        lossPhase = 'Opening';
      } else if (worstMove.moveNumber >= 30) {
        lossPhase = 'Endgame';
      } else {
        lossPhase = 'Middlegame';
      }
    } else {
      const totalMoves = timeline.moves.length / 2;
      lossPhase = totalMoves <= 14 ? 'Opening' : totalMoves >= 32 ? 'Endgame' : 'Middlegame';
    }

    return {
      game,
      timeline,
      analyzedMoves,
      status,
      error: analysisError || (wasCancelled || options?.signal?.aborted ? 'Analysis cancelled before all user moves were verified' : undefined),
      userAccuracy,
      harmonicAccuracy,
      accuracyStats,
      userBlundersCount,
      userMistakesCount,
      userInaccuraciesCount,
      worstMove,
      lossPhase,
    };
  }

  /**
   * Synthesizes a spotlight move from analyzed games, selecting the most decisive
   * genuine engine blunder or turning point from a lost game.
   */
  public extractSpotlightMove(
    analyzedGames: AnalyzedGameRecord[],
    fallbackGame?: GameRecord
  ): SpotlightMove | null {
    // Only consider successfully completed games with verified moves
    const eligibleGames = analyzedGames.filter(
      g => g.status === 'completed' && g.analyzedMoves && g.analyzedMoves.length > 0
    );

    // 1. Find the worst blunder among losses
    let candidateGame: AnalyzedGameRecord | undefined;
    let candidateMove: AnalyzedMoveRecord | undefined;
    let maxEvalDrop = -1;

    for (const g of eligibleGames) {
      if (g.game.result === 'loss' && g.worstMove && g.worstMove.evalLossCp > maxEvalDrop) {
        maxEvalDrop = g.worstMove.evalLossCp;
        candidateGame = g;
        candidateMove = g.worstMove;
      }
    }

    // If no loss with blunder found, pick worst blunder across all games
    if (!candidateMove) {
      for (const g of eligibleGames) {
        if (g.worstMove && g.worstMove.evalLossCp > maxEvalDrop) {
          maxEvalDrop = g.worstMove.evalLossCp;
          candidateGame = g;
          candidateMove = g.worstMove;
        }
      }
    }

    if (!candidateGame || !candidateMove) {
      return null;
    }

    const move = candidateMove;
    const game = candidateGame.game;

    // Format real engine eval swing
    const beforeCp = move.evalCpBefore;
    const afterCp = move.evalCpAfter;
    const beforeStr = `${beforeCp >= 0 ? '+' : ''}${(beforeCp / 100).toFixed(1)}`;
    const afterStr = `${afterCp >= 0 ? '+' : ''}${(afterCp / 100).toFixed(1)}`;
    const evalDiff = `${beforeStr} → ${afterStr}`;

    // Generate engine-grounded coaching explanation
    const coaching = coachingService.generateMoveExplanation(move, game.opponentUsername);

    return {
      gameUrl: game.url,
      opponent: game.opponentUsername,
      userColor: game.userColor,
      moveNumber: move.moveNumber,
      fenBefore: move.fenBefore,
      fenAfterUserMove: move.fenAfter,
      fenAfterBestMove: move.fenAfterBestMove,
      userMoveSan: move.san,
      bestMoveSan: move.bestMoveSan,
      userMoveFrom: move.from,
      userMoveTo: move.to,
      bestMoveFrom: move.bestMoveFrom,
      bestMoveTo: move.bestMoveTo,
      evalDiff,
      explanation: coaching.coachSpeech,
      tacticalTheme: coaching.primaryThemeLabel,
      coaching,
    };
  }
}

export const gameAnalysisService = new GameAnalysisService();
