/**
 * Stockfish 19 UCI Chess Engine Types
 * Defines normalized engine inputs, outputs, evaluation scores,
 * principal variations, and progress streams.
 */

export type EngineStatus =
  | 'uninitialized'
  | 'initializing'
  | 'ready'
  | 'analyzing'
  | 'error'
  | 'terminated';

export type ScoreType = 'cp' | 'mate';

export interface EngineScore {
  type: ScoreType;
  /**
   * Numeric score:
   * - Centipawns if type === 'cp' (relative to side to move)
   * - Moves to mate if type === 'mate' (positive = side to move mates, negative = getting mated)
   */
  value: number;
  /**
   * White-relative centipawn equivalent or mate value for cross-ply consistency
   */
  whiteRelativeValue: number;
  /**
   * Human-readable formatted string, e.g. "+1.42", "-0.75", "Mate in 3"
   */
  formatted: string;
  /**
   * Win / Draw / Loss probabilities if reported by engine (per thousand, 0-1000)
   */
  wdl?: {
    win: number;
    draw: number;
    loss: number;
  };
}

export interface PrincipalVariation {
  /**
   * PV rank index (1 = best move line)
   */
  multipv: number;
  depth: number;
  seldepth?: number;
  score: EngineScore;
  /**
   * Sequence of moves in UCI notation, e.g. ["e2e4", "e7e5", "g1f3"]
   */
  pvMoves: string[];
  /**
   * Sequence of moves converted to SAN if board context is available
   */
  pvSan?: string[];
  nodes: number;
  nps: number;
  timeMs: number;
  hashfull?: number;
}

export interface EngineProgressInfo {
  depth: number;
  seldepth?: number;
  nodes: number;
  nps: number;
  timeMs: number;
  hashfull?: number;
  currentMove?: string;
  currentMoveNumber?: number;
  pvs: PrincipalVariation[];
}

export interface EngineAnalysisResult {
  fen: string;
  bestMove: string;
  ponder?: string;
  depthReached: number;
  nodes: number;
  timeMs: number;
  nps: number;
  primaryScore: EngineScore;
  pvs: PrincipalVariation[];
  /** Present when the position is resolved by exact chess rules, not a Stockfish search. */
  terminalKind?: 'checkmate' | 'draw';
  rawUciOutput?: string[];
}

export interface AnalysisOptions {
  fen: string;
  moves?: string[];
  depth?: number;
  movetimeMs?: number;
  multiPv?: number;
  onProgress?: (progress: EngineProgressInfo) => void;
  timeoutMs?: number;
  abortPrevious?: boolean;
  signal?: AbortSignal;
}

export interface EngineConfig {
  workerUrl?: string;
  hashMb?: number;
  skillLevel?: number;
}
