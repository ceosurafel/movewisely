export type Platform = 'chesscom' | 'lichess';
export type TimeControl = 'bullet' | 'blitz' | 'rapid';

export interface GameRecord {
  id: string;
  url: string;
  /** True for bundled demonstration PGNs, never for live platform records. */
  isSynthetic?: boolean;
  white: {
    username: string;
    rating: number | null;
    result: 'win' | 'loss' | 'draw' | string;
  };
  black: {
    username: string;
    rating: number | null;
    result: 'win' | 'loss' | 'draw' | string;
  };
  userColor: 'white' | 'black';
  userRating: number;
  opponentUsername: string;
  opponentRating: number | null;
  result: 'win' | 'loss' | 'draw';
  termination: string;
  timeControl: TimeControl;
  timeClass: string;
  date: string | null;
  pgn: string;
  movesCount: number;
  eco?: string;
  openingName?: string;
  lossPhase?: 'Opening' | 'Middlegame' | 'Endgame';
}

export type LeakCategory = 'blunders' | 'phases' | 'accuracy' | 'openings' | 'tactics';

export interface LeakItem {
  id: string;
  category: LeakCategory;
  rank: number;
  title: string;
  description: string;
  userMetric: string;
  userNumeric: number;
  targetMetric: string;
  targetNumeric: number;
  severity: 'critical' | 'moderate' | 'minor';
  impact: string;
  coachTip: string;
}

export interface SpotlightMove {
  gameUrl: string;
  opponent: string;
  userColor: 'white' | 'black';
  moveNumber: number;
  fenBefore: string;
  fenAfterUserMove: string;
  fenAfterBestMove: string;
  userMoveSan: string;
  bestMoveSan: string;
  userMoveFrom: string;
  userMoveTo: string;
  bestMoveFrom: string;
  bestMoveTo: string;
  evalDiff: string;
  explanation: string;
  tacticalTheme: string;
  coaching?: any;
}

export type AnalysisStatus = 'completed' | 'partial' | 'failed' | 'cancelled';

export interface ActionPlanTask {
  id: string;
  title: string;
  duration: string;
  frequency: string;
  description: string;
  drillType: 'hanging_pieces' | 'tactics' | 'endgame_basics' | 'opening_prep';
  completed: boolean;
}

export interface CheckupAnalysis {
  username: string;
  platform: Platform;
  timeControl: TimeControl;
  analyzedAt: string;
  totalGames: number;
  attemptedGamesCount: number;
  completedGamesCount: number;
  partialGamesCount: number;
  failedGamesCount: number;
  status: AnalysisStatus;
  statusMessage?: string;
  engineVersion: string;
  scoringVersion: string;
  wins: number;
  losses: number;
  draws: number;
  winRate: number;
  currentRating: number;
  targetMilestone: number;
  targetDistance: number;
  accuracy: number;
  targetRatingAccuracy: number;
  blundersPerGame: number;
  targetBlundersPerGame: number;
  emotionalVerdict: {
    headline: string;
    statement: string;
    subtitle: string;
    leaksCount: number;
    isReadyForMilestone: boolean;
  };
  accuracyBreakdown?: {
    accuracyPct: number;
    harmonicAccuracyPct: number;
    averageCentipawnLoss: number;
    averageExpectedPointsLoss: number;
    gradeCounts: Record<string, number>;
    version: string;
  };
  spotlightMove?: SpotlightMove | null;
  leaks: LeakItem[];
  phasesBreakdown: {
    openingLossesPct: number;
    middlegameLossesPct: number;
    endgameLossesPct: number;
    weakestPhase: 'Opening' | 'Middlegame' | 'Endgame';
    explanation: string;
  };
  openingStats: {
    whiteWinRate: number;
    blackWinRate: number;
    mostFrequentOpening: string;
    topLeakOpening: {
      name: string;
      gamesCount: number;
      scorePct: number;
      advice: string;
    };
  };
  tacticalStats: {
    hangingPiecesLostTotal: number;
    missedFreePiecesTotal: number;
    forkPinVulnerabilities: number;
    tacticalLeakScore: number;
  };
  actionPlan: {
    milestone: number;
    projectedRatingGain: number | null;
    estimatedWeeks: number | null;
    coreFocus: string;
    tasks: ActionPlanTask[];
  };
  diagnostics?: any;
  games: GameRecord[];
}
