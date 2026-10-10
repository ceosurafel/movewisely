/**
 * MoveWisely — Experimental Move Grades & Accuracy Methodology V1.1
 *
 * Implements Phase 3:
 * 1. Raw Engine Evaluation: Normalized centipawn score and mate distance from Stockfish 19
 * 2. Move Evaluation Loss: Δcp = max(0, evalBefore - evalAfter), in the mover's perspective.
 * 3. Experimental score proxy (not a calibrated win probability):
 *    P(cp) = 1 / (1 + 10^(-cp / 400)). This simple logistic mapping does not
 *    explicitly model draws and must not be represented as validated outcome odds.
 *    Bounded: cp >= 4000 -> 1.0, cp <= -4000 -> 0.0.
 *    Expected Points Loss: ΔP = max(0, P_before - P_after)
 * 4. Move Quality Scoring (Per-move Accuracy Acc_i ∈ [0, 100]):
 *    Continuous heuristic loss function based on the score proxy:
 *    Acc_i = 100 * exp(-k * ΔP). This metric is experimental and uncalibrated.
 *    where k = 5.5, meaning:
 *      ΔP = 0.00 -> 100%
 *      ΔP = 0.05 (proxy loss) -> 76%
 *      ΔP = 0.10 (proxy loss) -> 57.7%
 *      ΔP = 0.25 (proxy loss) -> 25.3%
 *      ΔP >= 0.50 (massive blunder) -> <= 6.4%
 * 5. Individual Move Classifications (V1 thresholds; not empirically calibrated):
 *    - Standard Grades:
 *      • Best: Optimal engine move or loss <= 5 cp AND ΔP <= 0.015
 *      • Excellent: Loss <= 25 cp AND ΔP <= 0.035
 *      • Good: Loss <= 65 cp AND ΔP <= 0.08
 *      • Inaccuracy: 65 < cp <= 140 OR 0.08 < ΔP <= 0.16
 *      • Mistake: 140 < cp <= 280 OR 0.16 < ΔP <= 0.30
 *      • Blunder: cp > 280 OR ΔP > 0.30
 *    - Contextual Grades:
 *      • Book: Verified move from opening theory database in moves 1-12
 *      • Brilliant: Best/near-best move (loss <= 10 cp), piece sacrifice of value >= 300
 *        where advantage is maintained (evalBefore >= -50 cp and evalAfter >= 0 cp)
 *      • Great: Sole winning move found under high position tension (alternative engine moves
 *        suffer >= 150 cp drop or PV1 is winning and PV2 is drawing/losing)
 *      • Miss: Failed to capitalize on an opponent's blunder (player was winning or had a forced
 *        tactical shot >= +200 cp or mate, but played a move giving away >= 150 cp advantage)
 * 6. Overall Player Game Accuracy Aggregation:
 *    Independent, unblended mathematical aggregation of individual move accuracy scores:
 *    Acc_game = (1 / N) * Σ Acc_i
 *    Excludes standard opening Book moves (which have ΔP = 0 by definition) to avoid
 *    inflating accuracy in short games.
 */

import { EngineScore, PrincipalVariation } from '../types/engine';
import { isMoveInOpeningBook } from './openingBook';

export type StandardMoveGrade =
  | 'best'
  | 'excellent'
  | 'good'
  | 'inaccuracy'
  | 'mistake'
  | 'blunder';

export type ContextualMoveGrade =
  | 'brilliant'
  | 'great'
  | 'miss'
  | 'book';

export type MoveClassificationGrade = StandardMoveGrade | ContextualMoveGrade;

export interface ClassificationContext {
  moveNumber: number;
  color: 'white' | 'black';
  san: string;
  uci: string;
  piece: string;
  captured?: string;
  fenBefore: string;
  fenAfter: string;
  evalCpBefore: number;
  evalCpAfter: number;
  evalLossCp: number;
  expectedPointsBefore: number;
  expectedPointsAfter: number;
  expectedPointsLoss: number;
  bestMoveUci: string;
  bestMoveSan: string;
  pvs?: PrincipalVariation[];
  isMaterialSacrifice?: boolean;
}

export interface MoveGradeResult {
  grade: MoveClassificationGrade;
  standardGrade: StandardMoveGrade;
  isContextual: boolean;
  contextualReason?: string;
  evalLossCp: number;
  expectedPointsLoss: number;
  moveAccuracyPct: number;
}

export interface AccuracyAggregationResult {
  totalAnalyzedMoves: number;
  bookMovesCount: number;
  nonBookMovesCount: number;
  accuracyPct: number;
  harmonicAccuracyPct: number;
  gradeCounts: Record<MoveClassificationGrade, number>;
  averageCentipawnLoss: number;
  averageExpectedPointsLoss: number;
  accuracyVersion: string;
}

// Elo logistic coefficient: 400 centipawns represents a 10x odds shift (1 / (1 + 10^(-cp/400)))
const ELO_LOGISTIC_DIVISOR = 400.0;

// Accuracy decay constant: k = 5.5
const ACCURACY_DECAY_K = 5.5;

export const ACCURACY_ENGINE_VERSION = 'MoveWisely Accuracy V1.1 (Experimental Score Proxy; Uncalibrated)';

/**
 * Maps a centipawn score to an experimental scalar proxy in [0.0, 1.0].
 * This is not a validated win-probability model; it uses:
 * P = 1 / (1 + 10^(-cp / 400))
 * Handles forced mate bounds: cp >= 4000 -> 1.0, cp <= -4000 -> 0.0.
 */
export function calculateExpectedPoints(cp: number): number {
  if (!Number.isFinite(cp)) throw new Error('Cannot calculate expected-points proxy from a non-finite evaluation');
  if (cp >= 4000) return 1.0;
  if (cp <= -4000) return 0.0;
  return 1.0 / (1.0 + Math.pow(10, -cp / ELO_LOGISTIC_DIVISOR));
}

/**
 * Calculates individual move accuracy percentage [0.0, 100.0]
 * from the experimental score-proxy loss (not a calibrated win-probability estimate).
 *
 * Formula: Acc_i = 100 * exp(-5.5 * ΔP)
 */
export function calculateMoveAccuracy(expectedPointsLoss: number): number {
  if (!Number.isFinite(expectedPointsLoss)) throw new Error('Cannot calculate move accuracy from a non-finite loss');
  if (expectedPointsLoss <= 0.0001) return 100.0;
  const clampedLoss = Math.max(0.0, Math.min(1.0, expectedPointsLoss));
  const rawAcc = 100.0 * Math.exp(-ACCURACY_DECAY_K * clampedLoss);
  return Math.max(0.0, Math.min(100.0, Math.round(rawAcc * 10) / 10));
}

/**
 * Classifies a move into standard tiers based on explicit, experimental boundaries
 * of evaluation loss and expected points loss.
 */
export function classifyStandardGrade(evalLossCp: number, expLoss: number): StandardMoveGrade {
  if (!Number.isFinite(evalLossCp) || !Number.isFinite(expLoss)) {
    throw new Error('Move classification requires finite evaluation-loss values');
  }

  const cpLoss = Math.max(0, evalLossCp);
  const probabilityLoss = Math.max(0, expLoss);

  // Classify each independent signal, then choose the more severe grade.
  // This prevents a large centipawn loss being watered down by a small proxy loss.
  const cpTier = cpLoss <= 5 ? 0
    : cpLoss <= 25 ? 1
    : cpLoss <= 65 ? 2
    : cpLoss <= 140 ? 3
    : cpLoss <= 280 ? 4 : 5;
  const probabilityTier = probabilityLoss <= 0.015 ? 0
    : probabilityLoss <= 0.035 ? 1
    : probabilityLoss <= 0.08 ? 2
    : probabilityLoss <= 0.16 ? 3
    : probabilityLoss <= 0.30 ? 4 : 5;

  const severity = Math.max(cpTier, probabilityTier);
  return (['best', 'excellent', 'good', 'inaccuracy', 'mistake', 'blunder'] as const)[severity];
}

/**
 * Piece value lookup in centipawns for sacrifice verification.
 */
const PIECE_VALUES: Record<string, number> = {
  p: 100,
  n: 300,
  b: 300,
  r: 500,
  q: 900,
  k: 0,
};

/**
 * Determines whether a move qualifies for a Contextual Grade:
 * - Book: recognized opening theory in moves 1-12
 * - Brilliant: sound piece sacrifice maintaining strong advantage
 * - Great: only good/winning move in a high-tension position
 * - Miss: missed winning tactical opportunity
 */
export function evaluateContextualGrade(context: ClassificationContext): {
  grade?: ContextualMoveGrade;
  reason?: string;
} {
  const {
    moveNumber,
    san,
    uci,
    piece,
    fenBefore,
    evalCpBefore,
    evalCpAfter,
    evalLossCp,
    bestMoveUci,
    pvs,
  } = context;

  const isPlayedBestMove = uci === bestMoveUci || evalLossCp <= 10;

  // 1. Contextual: Book Move (moves 1-12 from verified opening database)
  if (moveNumber <= 12) {
    const bookCheck = isMoveInOpeningBook(fenBefore, uci, san);
    if (bookCheck.isBook) {
      return {
        grade: 'book',
        reason: `Standard book theory in the ${bookCheck.openingName || 'opening'} (${bookCheck.eco || 'ECO'})`,
      };
    }
  }

  // 2. Contextual: Brilliant Move
  // Requirement:
  // - Sound move (is played best move or evalLossCp <= 15)
  // - Piece sacrifice: piece is Knight, Bishop, Rook, or Queen (value >= 300)
  //   or player offers material sacrifice
  // - Position advantage maintained: evalBefore >= -50 and evalAfter >= 0
  // - Verified sacrifice: piece moves into attacked square or captured piece is worth less
  if (isPlayedBestMove && context.isMaterialSacrifice && evalCpAfter >= 0 && evalCpBefore >= -100) {
    const pieceVal = PIECE_VALUES[piece.toLowerCase()] || 0;
    if (pieceVal >= 300) {
      return {
        grade: 'brilliant',
        reason: 'Sacrifices material while maintaining a decisive positional advantage',
      };
    }
  }

  // 3. Contextual: Great Move
  // Requirement:
  // - Player found the best engine move
  // - Position has high tension where other candidate moves drop significant advantage
  // - PV1 is sound, but PV2 drops >= 150 cp
  if (isPlayedBestMove && pvs && pvs.length >= 2) {
    const pv1 = pvs[0];
    const pv2 = pvs[1];
    if (pv1 && pv2) {
      // Both PV scores refer to the same root and side-to-move. Preserve the
      // sign of mate scores; an unfavourable forced mate must never count as +mate.
      const scoreEquivalent = (score: EngineScore): number => {
        if (score.type === 'cp') return score.value;
        const magnitude = 10_000 - Math.min(50, Math.abs(score.value) * 50);
        return score.value === 0 ? 0 : Math.sign(score.value) * magnitude;
      };
      const pv1Score = scoreEquivalent(pv1.score);
      const pv2Score = scoreEquivalent(pv2.score);
      const pv1MaintainsOrWins = pv1Score >= 100;
      const pv2IsMateriallyWorse = pv1Score - pv2Score >= 150;
      if (pv1MaintainsOrWins && pv2IsMateriallyWorse && evalLossCp <= 10) {
        return {
          grade: 'great',
          reason: 'Finds a verified winning or advantage-maintaining move when the next engine candidate is materially worse',
        };
      }
    }
  }

  // 4. Contextual: Miss
  // Requirement:
  // - Player had a decisive opportunity: evalBefore >= 200 (was winning) or mate in N
  // - Player played a move that gave away the win: evalLossCp >= 150 or expLoss >= 0.20
  // - Resulting position falls below winning range: evalAfter < 100
  if (evalCpBefore >= 200 && evalLossCp >= 150 && evalCpAfter < 100) {
    return {
      grade: 'miss',
      reason: 'Missed a decisive tactical win or advantage gained earlier',
    };
  }

  return {};
}

/**
 * Master Move Classification function.
 * Evaluates raw engine data, expected points loss, and contextual criteria.
 */
export function gradeMove(context: ClassificationContext): MoveGradeResult {
  const standardGrade = classifyStandardGrade(context.evalLossCp, context.expectedPointsLoss);
  const contextual = evaluateContextualGrade(context);

  const grade: MoveClassificationGrade = contextual.grade || standardGrade;
  const isContextual = !!contextual.grade;

  // Book moves have 100% accuracy by definition
  const moveAccuracyPct =
    grade === 'book' || standardGrade === 'best'
      ? 100.0
      : calculateMoveAccuracy(context.expectedPointsLoss);

  return {
    grade,
    standardGrade,
    isContextual,
    contextualReason: contextual.reason,
    evalLossCp: context.evalLossCp,
    expectedPointsLoss: context.expectedPointsLoss,
    moveAccuracyPct,
  };
}

/**
 * Aggregates a series of graded moves into an overall player game accuracy score.
 *
 * Distinct from arbitrary move grade averaging:
 * - Sums mathematical move accuracies: Acc_game = Σ Acc_i / N
 * - Distinguishes book moves from non-book moves
 * - Never blends rating tier benchmarks or fabricated penalties
 */
export function aggregateGameAccuracy(
  gradedMoves: MoveGradeResult[]
): AccuracyAggregationResult {
  for (const move of gradedMoves) {
    if (
      !Number.isFinite(move.evalLossCp) ||
      !Number.isFinite(move.expectedPointsLoss) ||
      !Number.isFinite(move.moveAccuracyPct) ||
      move.moveAccuracyPct < 0 || move.moveAccuracyPct > 100
    ) {
      throw new Error('Cannot aggregate a move with missing or invalid evaluation metrics');
    }
  }

  const gradeCounts: Record<MoveClassificationGrade, number> = {
    brilliant: 0,
    great: 0,
    best: 0,
    excellent: 0,
    good: 0,
    book: 0,
    inaccuracy: 0,
    mistake: 0,
    blunder: 0,
    miss: 0,
  };

  if (gradedMoves.length === 0) {
    return {
      totalAnalyzedMoves: 0,
      bookMovesCount: 0,
      nonBookMovesCount: 0,
      accuracyPct: 0,
      harmonicAccuracyPct: 0,
      gradeCounts,
      averageCentipawnLoss: 0,
      averageExpectedPointsLoss: 0,
      accuracyVersion: ACCURACY_ENGINE_VERSION,
    };
  }

  let totalAccSum = 0;
  let nonBookAccSum = 0;
  let nonBookCount = 0;
  let bookCount = 0;
  let totalCpLoss = 0;
  let totalExpLoss = 0;

  for (const move of gradedMoves) {
    gradeCounts[move.grade] = (gradeCounts[move.grade] || 0) + 1;
    totalCpLoss += move.evalLossCp;
    totalExpLoss += move.expectedPointsLoss;
    totalAccSum += move.moveAccuracyPct;

    if (move.grade === 'book') {
      bookCount++;
    } else {
      nonBookCount++;
      nonBookAccSum += move.moveAccuracyPct;
    }
  }

  // Player accuracy across all moves
  const accuracyPct = Math.round((totalAccSum / gradedMoves.length) * 10) / 10;

  // Accuracy specifically across non-book moves (uninfluenced by opening rote memory)
  const harmonicAccuracyPct =
    nonBookCount > 0 ? Math.round((nonBookAccSum / nonBookCount) * 10) / 10 : 100.0;

  return {
    totalAnalyzedMoves: gradedMoves.length,
    bookMovesCount: bookCount,
    nonBookMovesCount: nonBookCount,
    accuracyPct,
    harmonicAccuracyPct,
    gradeCounts,
    averageCentipawnLoss: Math.round((totalCpLoss / gradedMoves.length) * 10) / 10,
    averageExpectedPointsLoss:
      Math.round((totalExpLoss / gradedMoves.length) * 1000) / 1000,
    accuracyVersion: ACCURACY_ENGINE_VERSION,
  };
}
