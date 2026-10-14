/**
 * MoveWisely — Phase 4 Diagnostics Data Models
 *
 * Fully typed, engine-traceable metrics aggregating multi-game reviews
 * from Phase 2 (Stockfish 19 engine analysis) and Phase 3 (MoveWisely Accuracy V1.1 (Experimental; Uncalibrated)).
 */

import { GameRecord, LeakItem, SpotlightMove, ActionPlanTask, Platform, TimeControl, AnalysisStatus } from './chess';
import { AnalyzedGameRecord, AnalyzedMoveRecord } from '../services/gameAnalysisService';

/**
 * Diagnostic trace connecting an aggregate report metric to its supporting game and move.
 */
export interface DiagnosticEvidence {
  gameId: string;
  gameUrl: string;
  opponentUsername: string;
  opponentRating: number | null;
  userColor: 'white' | 'black';
  moveNumber: number;
  fenBefore: string;
  fenAfter: string;
  playedSan: string;
  bestMoveSan: string;
  evalLossCp: number;
  expectedPointsLoss: number;
  grade: string;
  theme?: string;
  phase: 'Opening' | 'Middlegame' | 'Endgame';
}

/**
 * Verified tactical opportunity or slip detected with genuine engine verification.
 */
export interface VerifiedTacticalPattern {
  id: string;
  theme: 'hanging_piece' | 'fork' | 'pin' | 'missed_mate' | 'missed_free_piece' | 'queen_vulnerability' | 'general_eval_loss';
  title: string;
  occurrences: number;
  averageEvalLossCp: number;
  severity: 'critical' | 'moderate' | 'minor';
  sampleEvidences: DiagnosticEvidence[];
  /** Full position evidence for aggregation; sampleEvidences is only a compact preview. */
  evidences?: DiagnosticEvidence[];
  remediationAdvice: string;
}

/**
 * Opening performance aggregated strictly from analyzed user games.
 */
export interface VerifiedOpeningStat {
  openingName: string;
  eco: string;
  sampleSize: number;
  /** Games with an engine-reviewed move in the opening-exit window. */
  exitEvaluationSampleSize: number;
  wins: number;
  losses: number;
  draws: number;
  scorePct: number;
  averageExitEvalCp: number | null; // null means no reviewed exit-window position, not a 0 cp evaluation
  blundersConceded: number;
  lossRatePct: number;
  isLeak: boolean;
  evidences: DiagnosticEvidence[];
}

/**
 * Recurring weakness identified across the analyzed game set.
 */
export interface VerifiedRecurringWeakness {
  id: string;
  category: 'tactics' | 'phases' | 'openings' | 'blunders' | 'accuracy';
  title: string;
  description: string;
  frequencyText: string;
  measuredSeverity: 'critical' | 'moderate' | 'minor';
  /** Number of eligible games in the denominator for this specific finding. */
  sampleGamesCount: number;
  /** Distinct denominator games with at least one linked evidence position. */
  supportingGamesCount: number;
  /** Number of engine-reviewed positions linked to this finding. */
  supportingMovesCount: number;
  /** Supporting-game coverage relative to sampleGamesCount (0–100). */
  supportingGameRatePct: number;
  /** Minimum distinct evidence-bearing games required by this finding's rule. */
  minimumSupportingGamesRequired: number;
  /** Human-readable rule explaining why this finding qualified as recurring. */
  evidenceRule: string;
  evidences: DiagnosticEvidence[];
  recommendedDrillType: 'hanging_pieces' | 'tactics' | 'endgame_basics' | 'opening_prep';
}

/**
 * Phase error distribution tied to actual moves.
 */
export interface VerifiedPhaseBreakdown {
  openingLossesPct: number;
  middlegameLossesPct: number;
  endgameLossesPct: number;
  openingErrorsCount: number;
  middlegameErrorsCount: number;
  endgameErrorsCount: number;
  weakestPhase: 'Opening' | 'Middlegame' | 'Endgame';
  weakestPhaseLossPct: number;
  /** Completed losses used as the phase-percentage denominator. */
  lossGamesSampleSize: number;
  /** Exact completed-loss counts attributed to each phase. */
  lossGamesByPhase: { opening: number; middlegame: number; endgame: number };
  explanation: string;
  isLossDataAvailable?: boolean;
  phaseEvidences: {
    opening: DiagnosticEvidence[];
    middlegame: DiagnosticEvidence[];
    endgame: DiagnosticEvidence[];
  };
}

/**
 * Comprehensive Player Diagnostics Result
 */
export interface PlayerDiagnosticsResult {
  username: string;
  platform: Platform;
  timeControl: TimeControl;
  analyzedAt: string;

  // Analysis status and engine audit
  status: AnalysisStatus;
  statusMessage?: string;
  attemptedGamesCount: number;
  completedGamesCount: number;
  partialGamesCount: number;
  failedGamesCount: number;
  engineVersion: string;
  scoringVersion: string;

  // Game counts & sample audit
  importedGamesCount: number;
  analyzedGamesCount: number;
  excludedGamesCount: number;
  exclusionReasons: Array<{ gameId: string; reason: string }>;
  isInsufficientData: boolean;
  insufficientDataReason?: string;

  // Record
  wins: number;
  losses: number;
  draws: number;
  winRate: number;

  // Ratings & Benchmarks
  currentRating: number;
  targetMilestone: number;
  targetDistance: number;

  // Traceable Engine Accuracy (MoveWisely V1)
  overallAccuracy: number;
  harmonicAccuracy: number;
  targetRatingAccuracy: number;
  averageCentipawnLoss: number;
  averageExpectedPointsLoss: number;
  totalAnalyzedMoves: number;
  gradeDistribution: Record<string, number>;

  // Blunders & Loss statistics
  totalBlunders: number;
  blundersPerGame: number;
  targetBlundersPerGame: number;
  totalMistakes: number;
  mistakesPerGame: number;
  totalInaccuracies: number;

  // Verified Tactical Statistics
  tacticalPatterns: VerifiedTacticalPattern[];
  tacticalSummary: {
    hangingPiecesLostTotal: number;
    missedFreePiecesTotal: number;
    forkPinVulnerabilities: number;
    tacticalLeakScore: number;
  };

  // Phase breakdown
  phases: VerifiedPhaseBreakdown;

  // Openings
  openings: VerifiedOpeningStat[];
  whiteWinRate: number;
  blackWinRate: number;
  mostFrequentOpening: string;
  topLeakOpening: {
    name: string;
    gamesCount: number;
    scorePct: number;
    advice: string;
    averageExitEvalCp: number | null;
    exitEvaluationSampleSize?: number;
    isLeak?: boolean;
    evidences?: DiagnosticEvidence[];
  };

  // Recurring Weaknesses
  recurringWeaknesses: VerifiedRecurringWeakness[];

  // Spotlight move
  spotlightMove?: SpotlightMove | null;

  // Emotional verdict
  emotionalVerdict: {
    headline: string;
    statement: string;
    subtitle: string;
    leaksCount: number;
    isReadyForMilestone: boolean;
  };

  // Ranked Leaks (for UI Slide 7 compatibility)
  leaks: LeakItem[];

  // Action plan (for UI Slide 8 compatibility)
  actionPlan: {
    milestone: number;
    projectedRatingGain: number | null;
    estimatedWeeks: number | null;
    coreFocus: string;
    tasks: ActionPlanTask[];
  };

  // Analyzed game records
  analyzedGameRecords: AnalyzedGameRecord[];
  rawGames: GameRecord[];
}
