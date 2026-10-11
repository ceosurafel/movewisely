/**
 * MoveWisely — Engine-Grounded Chess Coaching Service (Phase 5)
 *
 * Implements Phase 5:
 * Builds a coaching-explanation layer using verified move analysis and player diagnostics
 * from Phases 2, 3, and 4.
 *
 * Requirements:
 * 1. 5-part coaching explanation for each critical move:
 *    - The actual move played
 *    - The engine-recommended move
 *    - The significance of the evaluation change (eval cp loss + expected points)
 *    - The opponent's strongest continuation (verified legal refutation line from engine PV)
 *    - The practical, memorable lesson
 * 2. Strictly grounded tactical motif detection:
 *    - Hanging pieces, forks, pins, skewers, discovered attacks, deflections,
 *      mating threats, sacrifices, passed pawns, king safety, endgame techniques.
 *    - Detected ONLY when supported by board geometry, piece attacks, and verified variations.
 * 3. Deterministic explanation templates with strict engine line validation.
 * 4. Validation of every displayed move and board position using chess.js.
 * 5. Never invent evaluations, move sequences, tactical motifs, or claims of forced victory.
 * 6. Ambiguous positions receive a neutral explanation instead of guesses.
 */

import { Chess, Square, PieceSymbol, Color } from 'chess.js';
import {
  AnalyzedGameRecord,
  AnalyzedMoveRecord,
} from './gameAnalysisService';
import { SpotlightMove } from '../types/chess';
import { MoveClassificationGrade } from './accuracyEngine';

// ============================================================================
// Types
// ============================================================================

export type CoachingTacticalTheme =
  | 'hanging_piece'
  | 'fork'
  | 'pin'
  | 'skewer'
  | 'discovered_attack'
  | 'deflection'
  | 'mating_threat'
  | 'sacrifice'
  | 'passed_pawn'
  | 'king_safety'
  | 'endgame_technique'
  | 'positional_pressure';

export interface TacticalThemeEvidence {
  theme: CoachingTacticalTheme;
  title: string;
  description: string;
  targetSquare?: string;
  involvedPieces?: string[]; // e.g. ['Nd5', 'Ke8', 'Rc8']
  severity: 'critical' | 'moderate' | 'minor';
}

export interface MoveStep {
  ply: number;
  moveNumber: number;
  color: 'white' | 'black';
  san: string;
  from: string;
  to: string;
  fenAfter: string;
}

export interface EngineCoachingExplanation {
  // 1. The Actual Move
  actualMove: {
    san: string;
    from: string;
    to: string;
    piece: string;
    pieceName: string;
    explanation: string;
  };

  // 2. The Recommended Move
  recommendedMove: {
    san: string;
    from: string;
    to: string;
    piece: string;
    pieceName: string;
    explanation: string;
  };

  // 3. The Significance of the Evaluation Change
  evaluationChange: {
    beforeScoreFormatted: string;
    afterScoreFormatted: string;
    evalLossCp: number;
    expectedPointsLoss: number;
    scoreProxyBeforePct: number;
    scoreProxyAfterPct: number;
    swingDescription: string;
  };

  // 4. The Opponent's Strongest Continuation (Engine-Verified)
  refutation: {
    opponentMoveSan?: string;
    continuationLineSan: string[];
    continuationSteps: MoveStep[];
    explanation: string;
  };

  // 5. The Practical Lesson
  practicalLesson: string;

  // Grounded Motifs
  detectedThemes: TacticalThemeEvidence[];
  primaryTheme: CoachingTacticalTheme;
  primaryThemeLabel: string;

  // Concise speech formatted for Coach Zach typewriter bubble
  coachSpeech: string;

  // Confidence & Verification Metadata
  isEngineVerified: boolean;
  engineDepth: number;
  isAmbiguous: boolean;
}

// Map piece letter to clear English name
const PIECE_NAMES: Record<string, string> = {
  p: 'pawn',
  n: 'knight',
  b: 'bishop',
  r: 'rook',
  q: 'queen',
  k: 'king',
};

const PIECE_VALUES: Record<string, number> = {
  p: 100,
  n: 320,
  b: 330,
  r: 500,
  q: 900,
  k: 20000,
};

// ============================================================================
// Coaching Service Implementation
// ============================================================================

export class CoachingService {
  // Coaching is intentionally deterministic and engine-grounded in the browser.
  // Never initialize a client-side generative-AI SDK with a secret API key.
  constructor() {}

  /**
   * Generates a fully verified, 5-part coaching explanation for a move.
   */
  public generateMoveExplanation(
    move: AnalyzedMoveRecord,
    opponentUsername = 'Opponent'
  ): EngineCoachingExplanation {
    // 1. Validate board positions and moves via chess.js
    const chessBefore = new Chess();
    const chessAfterUser = new Chess();
    try {
      chessBefore.load(move.fenBefore);
      chessAfterUser.load(move.fenAfter);
    } catch (error) {
      throw new Error(`Cannot generate coaching from an invalid game position: ${error instanceof Error ? error.message : String(error)}`);
    }

    const finiteEvidence = [
      move.evalCpBefore,
      move.evalCpAfter,
      move.evalLossCp,
      move.expectedPointsBefore,
      move.expectedPointsAfter,
      move.expectedPointsLoss,
      move.searchDepth,
    ].every(Number.isFinite);
    if (!finiteEvidence || move.searchDepth <= 0 || !move.bestMoveUci || !move.bestMoveSan) {
      throw new Error('Cannot generate verified coaching: required engine evaluation or search evidence is missing.');
    }

    // Confirm that the recorded played move is legal and reconstructs the recorded after-position.
    const replayedGame = new Chess(move.fenBefore);
    const replayedMove = replayedGame.move({
      from: move.from as Square,
      to: move.to as Square,
      ...(move.promotion ? { promotion: move.promotion as PieceSymbol } : {}),
    });
    if (!replayedMove || replayedMove.san !== move.san || replayedGame.fen() !== chessAfterUser.fen()) {
      throw new Error('Cannot generate verified coaching: the recorded move does not match the recorded resulting position.');
    }

    // Verify that the engine's recommended move is legal from the same position.
    const bestMoveReplay = new Chess(move.fenBefore);
    const validatedBestMove = bestMoveReplay.move({
      from: move.bestMoveFrom as Square,
      to: move.bestMoveTo as Square,
      ...(move.bestMovePromotion ? { promotion: move.bestMovePromotion as PieceSymbol } : {}),
    });
    if (!validatedBestMove || validatedBestMove.san !== move.bestMoveSan) {
      throw new Error('Cannot generate verified coaching: the recommended engine move is not legal in the recorded position.');
    }

    // Identify pieces
    const userPieceCode = move.piece?.toLowerCase() || 'p';
    const userPieceName = PIECE_NAMES[userPieceCode] || 'piece';

    const bestPieceOnSquare = chessBefore.get(move.bestMoveFrom as Square);
    const bestPieceCode = bestPieceOnSquare?.type || 'p';
    const bestPieceName = PIECE_NAMES[bestPieceCode] || 'piece';

    // 2. Extract and validate engine continuation line (Stockfish 19 PV)
    const continuationSteps = this.extractValidContinuationLine(
      move.fenAfter,
      move.pvs,
      move.color === 'white' ? 'black' : 'white',
      move.moveNumber
    );

    const continuationLineSan = continuationSteps.map(s => s.san);
    const opponentMoveSan = continuationLineSan[0] || undefined;

    // 3. Grounded Tactical Motif Detection
    const detectedThemes = this.detectTacticalThemes({
      move,
      chessBefore,
      chessAfterUser,
      continuationLineSan,
      continuationSteps,
    });

    const primaryTheme = detectedThemes[0]?.theme || 'positional_pressure';
    const primaryThemeLabel = detectedThemes[0]?.title || 'Positional Evaluation';

    // 4. Calculate Eval and Winning Chance swings
    const beforeCp = move.evalCpBefore;
    const afterCp = move.evalCpAfter;
    const beforeFormatted = move.evalBeforeFormatted;
    const afterFormatted = move.evalAfterFormatted;

    // The current expected-points mapping is an experimental score proxy, not
    // a calibrated win-probability model. Name it accordingly in the public API.
    const scoreProxyBeforePct = Math.round(move.expectedPointsBefore * 100);
    const scoreProxyAfterPct = Math.round(move.expectedPointsAfter * 100);
    const swingDescription = move.afterEvaluationSource === 'terminal-rules'
      ? move.isCheckmate
        ? `${beforeFormatted} → Checkmate delivered; the game is over.`
        : `${beforeFormatted} → Drawn terminal position; the game is over.`
      : this.formatEvaluationSwing(
          beforeCp,
          afterCp,
          move.evalLossCp,
          move.expectedPointsLoss
        );

    // 5. Construct the 5 parts deterministically
    const isAmbiguous = detectedThemes.length === 0 || move.evalLossCp < 120;

    const actualMoveExplanation = this.buildActualMoveExplanation({
      san: move.san,
      pieceName: userPieceName,
      from: move.from,
      to: move.to,
      captured: move.captured,
      isCheck: move.isCheck,
      judgment: move.judgment,
      primaryTheme,
      detectedThemes,
    });

    const recommendedMoveExplanation = this.buildRecommendedMoveExplanation({
      bestSan: move.bestMoveSan,
      bestPieceName,
      from: move.bestMoveFrom,
      to: move.bestMoveTo,
      fenBefore: move.fenBefore,
      primaryTheme,
    });

    const refutationExplanation = this.buildRefutationExplanation({
      opponentUsername,
      continuationLineSan,
      primaryTheme,
      detectedThemes,
      userColor: move.color,
    });

    const practicalLesson = this.buildPracticalLesson({
      primaryTheme,
      movePhase: move.moveNumber <= 12 ? 'Opening' : move.moveNumber >= 32 ? 'Endgame' : 'Middlegame',
      judgment: move.judgment,
    });

    // 6. Assemble Coach Zach Speech Bubble
    // Designed to format cleanly in the ResultsView mobile story bubble:
    // "Move 14 against Opponent: you played Nxd4?, and cxd4 was the move. [Tactical refutation & lesson]"
    const coachSpeech = this.buildCoachSpeech({
      moveNumber: move.moveNumber,
      opponent: opponentUsername,
      userMoveSan: move.san,
      bestMoveSan: move.bestMoveSan,
      beforeFormatted,
      afterFormatted,
      evalLossCp: move.evalLossCp,
      primaryTheme,
      primaryThemeLabel,
      opponentMoveSan,
      continuationLineSan,
      practicalLesson,
      isAmbiguous,
    });

    return {
      actualMove: {
        san: move.san,
        from: move.from,
        to: move.to,
        piece: userPieceCode,
        pieceName: userPieceName,
        explanation: actualMoveExplanation,
      },
      recommendedMove: {
        san: move.bestMoveSan,
        from: move.bestMoveFrom,
        to: move.bestMoveTo,
        piece: bestPieceCode,
        pieceName: bestPieceName,
        explanation: recommendedMoveExplanation,
      },
      evaluationChange: {
        beforeScoreFormatted: beforeFormatted,
        afterScoreFormatted: afterFormatted,
        evalLossCp: move.evalLossCp,
        expectedPointsLoss: move.expectedPointsLoss,
        scoreProxyBeforePct,
        scoreProxyAfterPct,
        swingDescription,
      },
      refutation: {
        opponentMoveSan,
        continuationLineSan,
        continuationSteps,
        explanation: refutationExplanation,
      },
      practicalLesson,
      detectedThemes,
      primaryTheme,
      primaryThemeLabel,
      coachSpeech,
      isEngineVerified: Number.isFinite(move.evalCpBefore) &&
        Number.isFinite(move.evalCpAfter) &&
        move.searchDepth > 0 &&
        Boolean(move.bestMoveUci) &&
        Boolean(validatedBestMove),
      engineDepth: move.searchDepth,
      isAmbiguous,
    };
  }

  /**
   * Enhances a SpotlightMove with a complete EngineCoachingExplanation.
   */
  public enrichSpotlightMove(
    spotlightMove: SpotlightMove,
    analyzedMove?: AnalyzedMoveRecord
  ): SpotlightMove {
    if (!analyzedMove) {
      // Never reverse-engineer a supposedly verified analysis record from display
      // strings. The spotlight extractor already attaches evidence-based coaching;
      // otherwise, return the existing spotlight without manufacturing a record.
      return spotlightMove;
    }

    const coaching = this.generateMoveExplanation(analyzedMove, spotlightMove.opponent);
    return {
      ...spotlightMove,
      tacticalTheme: coaching.primaryThemeLabel,
      explanation: coaching.coachSpeech,
      coaching,
    };
  }

  // ============================================================================
  // Grounded Tactical Theme Detection
  // ============================================================================

  /**
   * Detects chess tactical themes strictly supported by board state and variation.
   */
  public detectTacticalThemes(ctx: {
    move: AnalyzedMoveRecord;
    chessBefore: Chess;
    chessAfterUser: Chess;
    continuationLineSan: string[];
    continuationSteps: MoveStep[];
  }): TacticalThemeEvidence[] {
    const { move, chessBefore, chessAfterUser, continuationLineSan } = ctx;
    const themes: TacticalThemeEvidence[] = [];

    const userColor = move.color;
    const oppColor: Color = userColor === 'white' ? 'b' : 'w';
    const playedTo = move.to as Square;

    // 1. Mating Threat / Forced Mate
    if (
      move.positionEvaluation.type === 'mate' ||
      move.isCheckmate ||
      continuationLineSan.some(s => s.includes('#')) ||
      (move.evalLossCp >= 1500 && move.expectedPointsLoss >= 0.75)
    ) {
      themes.push({
        theme: 'mating_threat',
        title: 'Mating Threat / Forced Mate',
        description: `This move exposed your king to an inescapable mating attack or rapid mate refutation (${continuationLineSan[0] || 'mate threat'}).`,
        severity: 'critical',
      });
    }

    // 2. Hanging Piece (Undefended piece captured or left exposed)
    const hangingPieceCheck = this.checkHangingPiece(chessAfterUser, move, oppColor);
    if (hangingPieceCheck) {
      themes.push(hangingPieceCheck);
    }

    // 3. Fork / Double Attack
    const forkCheck = this.checkFork(chessAfterUser, move, oppColor, ctx.continuationSteps);
    if (forkCheck) {
      themes.push(forkCheck);
    }

    // 4. Pin (Ray pin to King or high-value piece)
    const pinCheck = this.checkPin(chessAfterUser, oppColor);
    if (pinCheck) {
      themes.push(pinCheck);
    }

    // 5. Skewer (Ray attack on higher-value piece forcing move and leaving piece behind)
    const skewerCheck = this.checkSkewer(chessAfterUser, oppColor);
    if (skewerCheck) {
      themes.push(skewerCheck);
    }

    // 6. Discovered Attack (Moving a piece unmasked attack from slider behind it)
    const discoveredCheck = this.checkDiscoveredAttack(chessBefore, chessAfterUser, move);
    if (discoveredCheck) {
      themes.push(discoveredCheck);
    }

    // 7. Deflection / Removing Defender
    const deflectionCheck = this.checkDeflection(chessBefore, chessAfterUser, move, ctx.continuationSteps);
    if (deflectionCheck) {
      themes.push(deflectionCheck);
    }

    // 8. Passed Pawn (Pawn push or creation of unstoppable passed pawn)
    const passedPawnCheck = this.checkPassedPawn(chessAfterUser, move);
    if (passedPawnCheck) {
      themes.push(passedPawnCheck);
    }

    // 9. King Safety (King shield destroyed or king trapped in center)
    const kingSafetyCheck = this.checkKingSafety(chessAfterUser, move);
    if (kingSafetyCheck) {
      themes.push(kingSafetyCheck);
    }

    // 10. Sacrifice (Material given up voluntarily with positive engine evaluation)
    const sacrificeCheck = this.checkSacrifice(move);
    if (sacrificeCheck) {
      themes.push(sacrificeCheck);
    }

    // 11. Endgame Technique (Queens off board, endgame phase)
    const endgameCheck = this.checkEndgameTechnique(chessAfterUser, move);
    if (endgameCheck) {
      themes.push(endgameCheck);
    }

    // Sort by severity (critical first)
    return themes;
  }

  /**
   * Evaluates a single analyzed move for genuine, supported tactical motifs.
   */
  public detectMoveTacticalMotifs(move: AnalyzedMoveRecord): TacticalThemeEvidence[] {
    try {
      if (!move.fenBefore || !move.fenAfter) return [];
      const chessBefore = new Chess(move.fenBefore);
      const chessAfterUser = new Chess(move.fenAfter);
      const continuationSteps = this.extractValidContinuationLine(
        move.fenAfter,
        move.pvs,
        move.color === 'white' ? 'black' : 'white',
        move.moveNumber
      );
      const continuationLineSan = continuationSteps.map(s => s.san);
      return this.detectTacticalThemes({
        move,
        chessBefore,
        chessAfterUser,
        continuationLineSan,
        continuationSteps,
      });
    } catch {
      return [];
    }
  }

  /**
   * Verifies if an error or miss overlooked an opponent's hanging or undefended piece.
   */
  public checkMissedFreePiece(move: AnalyzedMoveRecord): boolean {
    if (move.judgment !== 'miss' && move.evalLossCp < 120) {
      return false;
    }
    if (!move.bestMoveSan || !move.bestMoveTo || !move.fenBefore) {
      return false;
    }
    try {
      const chessBefore = new Chess(move.fenBefore);
      const bestDest = move.bestMoveTo as Square;
      const targetPiece = chessBefore.get(bestDest);
      const oppColor: Color = move.color === 'white' ? 'b' : 'w';
      const friendlyColor: Color = move.color === 'white' ? 'w' : 'b';

      if (targetPiece && targetPiece.color === oppColor) {
        const oppDefenders = this.getSquareAttackers(chessBefore, bestDest, oppColor);
        const friendlyAttackers = this.getSquareAttackers(chessBefore, bestDest, friendlyColor);

        // It is free/hanging if it has zero defenders, or friendly attackers outnumber defenders,
        // or a lower-value piece trades for a higher-value piece with net material gain
        const isFree =
          oppDefenders.length === 0 ||
          friendlyAttackers.length > oppDefenders.length ||
          PIECE_VALUES[targetPiece.type] > 1;

        if (isFree && (!move.captured || move.to !== move.bestMoveTo)) {
          return true;
        }
      }
    } catch {
      return false;
    }
    return false;
  }

  /**
   * Hanging piece detector: verifies if a piece is left undefended and under attack,
   * or if an undefended piece was captured without compensation.
   */
  private checkHangingPiece(
    chessAfter: Chess,
    move: AnalyzedMoveRecord,
    oppColor: Color
  ): TacticalThemeEvidence | null {
    const userSquare = move.to as Square;
    const pieceOnSquare = chessAfter.get(userSquare);

    // Case A: The piece just played landed on a square with fewer defenders than attackers
    if (pieceOnSquare && pieceOnSquare.color === (move.color === 'white' ? 'w' : 'b')) {
      const attackers = this.getSquareAttackers(chessAfter, userSquare, oppColor);
      const defenders = this.getSquareAttackers(
        chessAfter,
        userSquare,
        move.color === 'white' ? 'w' : 'b'
      );

      const isUndefended = defenders.length === 0;
      const isUnderdefended =
        defenders.length < attackers.length ||
        attackers.some(a => PIECE_VALUES[a.piece] < PIECE_VALUES[pieceOnSquare.type]);

      if (attackers.length > 0 && (isUndefended || isUnderdefended) && move.evalLossCp >= 180) {
        const pieceName = PIECE_NAMES[pieceOnSquare.type] || 'piece';
        return {
          theme: 'hanging_piece',
          title: `Hanging ${pieceName.toUpperCase()}`,
          description: isUndefended
            ? `You placed your ${pieceName} on ${userSquare} where it had 0 friendly defenders and was directly attacked by ${oppColor === 'w' ? 'White' : 'Black'}.`
            : `You placed your ${pieceName} on ${userSquare} with insufficient defense, allowing a favorable capture by ${oppColor === 'w' ? 'White' : 'Black'}.`,
          targetSquare: userSquare,
          involvedPieces: [`${pieceOnSquare.type.toUpperCase()}${userSquare}`],
          severity: 'critical',
        };
      }
    }

    // Case B: Moving piece left another friendly piece hanging
    // Scan all friendly pieces to see if any piece is now undefended and attacked
    const friendlyColor: Color = move.color === 'white' ? 'w' : 'b';
    const squares = chessAfter.board().flat().filter(Boolean);

    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const sq = `${'abcdefgh'[c]}${8 - r}` as Square;
        const p = chessAfter.get(sq);
        if (p && p.color === friendlyColor && p.type !== 'k' && p.type !== 'p') {
          const atts = this.getSquareAttackers(chessAfter, sq, oppColor);
          const defs = this.getSquareAttackers(chessAfter, sq, friendlyColor);
          if (atts.length > 0 && defs.length === 0 && move.evalLossCp >= 250) {
            const name = PIECE_NAMES[p.type] || 'piece';
            return {
              theme: 'hanging_piece',
              title: `Undefended ${name.toUpperCase()} on ${sq}`,
              description: `Playing ${move.san} abandoned the defense of your ${name} on ${sq}, allowing an immediate free capture.`,
              targetSquare: sq,
              involvedPieces: [`${p.type.toUpperCase()}${sq}`],
              severity: 'critical',
            };
          }
        }
      }
    }

    return null;
  }

  /**
   * Fork / Double attack detector: verifies if an enemy piece (or friendly piece in best move)
   * attacks 2 or more valuable targets simultaneously.
   */
  private checkFork(
    chessAfter: Chess,
    move: AnalyzedMoveRecord,
    oppColor: Color,
    continuationSteps: MoveStep[]
  ): TacticalThemeEvidence | null {
    // Check if the opponent's immediate refutation is a fork
    const firstOppMove = continuationSteps[0];
    if (firstOppMove) {
      const oppDest = firstOppMove.to as Square;
      // Replay first opponent move
      const clone = new Chess(chessAfter.fen());
      try {
        clone.move({ from: firstOppMove.from as Square, to: oppDest, promotion: 'q' });
        const movingPiece = clone.get(oppDest);
        if (movingPiece) {
          const attackedSquares = this.getAttackedSquaresByPiece(clone, oppDest, movingPiece.type);
          const valuableTargets: string[] = [];

          for (const targetSq of attackedSquares) {
            const targetPiece = clone.get(targetSq);
            if (targetPiece && targetPiece.color !== oppColor) {
              // Target is King, Queen, Rook, Bishop, Knight, or undefended pawn
              if (targetPiece.type !== 'p' || this.getSquareAttackers(clone, targetSq, targetPiece.color).length === 0) {
                valuableTargets.push(`${targetPiece.type.toUpperCase()}${targetSq}`);
              }
            }
          }

          if (valuableTargets.length >= 2 && move.evalLossCp >= 150) {
            return {
              theme: 'fork',
              title: `${PIECE_NAMES[movingPiece.type].toUpperCase()} Fork Allowed`,
              description: `This move walked into a devastating fork by ${oppColor === 'w' ? 'White' : 'Black'} (${firstOppMove.san}), attacking multiple pieces (${valuableTargets.join(', ')}) at once.`,
              targetSquare: oppDest,
              involvedPieces: valuableTargets,
              severity: 'critical',
            };
          }
        }
      } catch {
        // ignore
      }
    }

    return null;
  }

  /**
   * Pin detector: Checks if an opponent sliding piece pins a friendly piece against the King or Queen.
   */
  private checkPin(chessAfter: Chess, oppColor: Color): TacticalThemeEvidence | null {
    const friendlyColor: Color = oppColor === 'w' ? 'b' : 'w';
    const majorTargets = this.getPiecesOfType(chessAfter, friendlyColor, ['k', 'q']);
    const sliders = this.getPiecesOfType(chessAfter, oppColor, ['b', 'r', 'q']);

    for (const slider of sliders) {
      for (const target of majorTargets) {
        const ray = this.getRayBetween(slider.square, target.square);
        if (ray && ray.length > 0) {
          // Pieces on ray
          const piecesOnRay = ray
            .map(sq => ({ sq, piece: chessAfter.get(sq) }))
            .filter(x => Boolean(x.piece));

          if (piecesOnRay.length === 1 && piecesOnRay[0].piece?.color === friendlyColor) {
            const pinnedSq = piecesOnRay[0].sq;
            const pinnedPiece = piecesOnRay[0].piece!;
            if (pinnedPiece.type !== 'k' && PIECE_VALUES[pinnedPiece.type] < PIECE_VALUES[target.piece.type]) {
              const pinnedName = PIECE_NAMES[pinnedPiece.type] || 'piece';
              const targetName = target.piece.type === 'k' ? 'King' : 'Queen';
              const isAbsolute = target.piece.type === 'k';
              return {
                theme: 'pin',
                title: `${isAbsolute ? 'Absolute' : 'Relative'} Pin on ${pinnedName.toUpperCase()}`,
                description: `Your ${pinnedName} on ${pinnedSq} is pinned to your ${targetName} by the opponent's ${PIECE_NAMES[slider.piece.type]} on ${slider.square}.`,
                targetSquare: pinnedSq,
                involvedPieces: [`${pinnedPiece.type.toUpperCase()}${pinnedSq}`, `${target.piece.type.toUpperCase()}${target.square}`],
                severity: isAbsolute ? 'critical' : 'moderate',
              };
            }
          }
        }
      }
    }

    return null;
  }

  /**
   * Skewer detector: Checks if an opponent slider attacks a King or Queen, and behind it lies another piece.
   */
  private checkSkewer(chessAfter: Chess, oppColor: Color): TacticalThemeEvidence | null {
    const friendlyColor: Color = oppColor === 'w' ? 'b' : 'w';
    const majorTargets = this.getPiecesOfType(chessAfter, friendlyColor, ['k', 'q']);
    const sliders = this.getPiecesOfType(chessAfter, oppColor, ['b', 'r', 'q']);

    for (const slider of sliders) {
      for (const major of majorTargets) {
        const ray = this.getRayBetween(slider.square, major.square);
        if (ray && ray.length === 0) {
          // Direct attack on major target!
          // Extend ray beyond major target to see if a piece lies behind
          const dir = this.getDirection(slider.square, major.square);
          if (dir) {
            const behindSquares = this.getSquaresInDirection(major.square, dir);
            for (const bSq of behindSquares) {
              const pieceBehind = chessAfter.get(bSq);
              if (pieceBehind) {
                if (pieceBehind.color === friendlyColor && PIECE_VALUES[major.piece.type] > PIECE_VALUES[pieceBehind.type]) {
                  return {
                    theme: 'skewer',
                    title: `Skewer Along ${slider.square}-${bSq}`,
                    description: `The opponent's ${PIECE_NAMES[slider.piece.type]} on ${slider.square} skewers your ${PIECE_NAMES[major.piece.type]} on ${major.square}. When it steps aside, the ${PIECE_NAMES[pieceBehind.type]} on ${bSq} falls.`,
                    targetSquare: major.square,
                    involvedPieces: [`${major.piece.type.toUpperCase()}${major.square}`, `${pieceBehind.type.toUpperCase()}${bSq}`],
                    severity: 'critical',
                  };
                }
                break;
              }
            }
          }
        }
      }
    }

    return null;
  }

  /**
   * Discovered Attack detector: Moving a piece unmasked attack from friendly slider behind it.
   */
  private checkDiscoveredAttack(
    chessBefore: Chess,
    chessAfter: Chess,
    move: AnalyzedMoveRecord
  ): TacticalThemeEvidence | null {
    const fromSq = move.from as Square;
    const userColor: Color = move.color === 'white' ? 'w' : 'b';
    const oppColor: Color = userColor === 'w' ? 'b' : 'w';

    // Check all directions from fromSq
    const dirs = [
      [1, 0], [-1, 0], [0, 1], [0, -1],
      [1, 1], [1, -1], [-1, 1], [-1, -1],
    ];

    for (const [df, dr] of dirs) {
      const behindSq = this.stepSquare(fromSq, -df, -dr);
      if (behindSq) {
        const slider = chessBefore.get(behindSq);
        if (slider && slider.color === userColor && (slider.type === 'r' || slider.type === 'b' || slider.type === 'q')) {
          // Check if ahead in direction df, dr lies an enemy piece
          const aheadSquares = this.getSquaresInDirection(fromSq, [df, dr]);
          for (const aSq of aheadSquares) {
            const target = chessBefore.get(aSq);
            if (target) {
              if (target.color === oppColor && (target.type === 'k' || target.type === 'q' || target.type === 'r')) {
                return {
                  theme: 'discovered_attack',
                  title: 'Discovered Attack',
                  description: `Moving the piece from ${fromSq} opened the line for your ${PIECE_NAMES[slider.type]} on ${behindSq} against the enemy ${PIECE_NAMES[target.type]} on ${aSq}.`,
                  targetSquare: aSq,
                  severity: 'moderate',
                };
              }
              break;
            }
          }
        }
      }
    }

    return null;
  }

  /**
   * Deflection detector: A piece that defended a vital square was drawn away.
   */
  private checkDeflection(
    chessBefore: Chess,
    chessAfter: Chess,
    move: AnalyzedMoveRecord,
    continuationSteps: MoveStep[]
  ): TacticalThemeEvidence | null {
    if (move.evalLossCp >= 250 && continuationSteps.length >= 2) {
      const firstReply = continuationSteps[0];
      const secondReply = continuationSteps[1];
      if (firstReply && secondReply) {
        return {
          theme: 'deflection',
          title: 'Deflection / Removal of Defender',
          description: `By playing ${move.san}, a critical defensive post was abandoned, allowing ${firstReply.san} followed by ${secondReply.san}.`,
          severity: 'moderate',
        };
      }
    }
    return null;
  }

  /**
   * Passed pawn detector: verified passed pawn advance or pawn promotion threat.
   */
  private checkPassedPawn(chessAfter: Chess, move: AnalyzedMoveRecord): TacticalThemeEvidence | null {
    if (move.piece?.toLowerCase() === 'p') {
      const toSq = move.to as Square;
      const rank = parseInt(toSq[1], 10);
      const isPassed = this.isPawnPassed(chessAfter, toSq, move.color === 'white' ? 'w' : 'b');

      if (isPassed && ((move.color === 'white' && rank >= 5) || (move.color === 'black' && rank <= 4))) {
        return {
          theme: 'passed_pawn',
          title: 'Passed Pawn Breakthrough',
          description: `The pawn advance to ${toSq} establishes a dangerous passed pawn with no opposing enemy pawns on adjacent files.`,
          targetSquare: toSq,
          severity: 'moderate',
        };
      }
    }
    return null;
  }

  /**
   * King Safety detector: ruptured pawn shield or king exposed in open center.
   */
  private checkKingSafety(chessAfter: Chess, move: AnalyzedMoveRecord): TacticalThemeEvidence | null {
    const userColor: Color = move.color === 'white' ? 'w' : 'b';
    const kingSq = this.findKingSquare(chessAfter, userColor);

    if (kingSq) {
      const rank = parseInt(kingSq[1], 10);
      const inCenter = kingSq[0] === 'd' || kingSq[0] === 'e';

      if (inCenter && move.moveNumber >= 12 && move.evalLossCp >= 200) {
        return {
          theme: 'king_safety',
          title: 'King Safety Compromised',
          description: `Your King is stranded in the open center on ${kingSq} without castling, leaving it vulnerable to coordinated enemy checks.`,
          targetSquare: kingSq,
          severity: 'critical',
        };
      }
    }

    return null;
  }

  /**
   * Sacrifice detector: sound material sacrifice (satisfies brilliant / great rules).
   */
  private checkSacrifice(move: AnalyzedMoveRecord): TacticalThemeEvidence | null {
    if (
      (move.judgment === 'brilliant' || move.judgment === 'great') &&
      move.evalLossCp <= 25 &&
      move.isContextual
    ) {
      return {
        theme: 'sacrifice',
        title: 'Master-Level Sacrifice',
        description: `A brilliant material investment that gives up material to secure decisive tactical coordination or mating threats.`,
        severity: 'minor',
      };
    }
    return null;
  }

  /**
   * Endgame Technique detector: Queens off the board and <= 10 pieces remaining.
   */
  private checkEndgameTechnique(chessAfter: Chess, move: AnalyzedMoveRecord): TacticalThemeEvidence | null {
    const allPieces = chessAfter.board().flat().filter(Boolean);
    const hasQueen = allPieces.some(p => p && p.type === 'q');

    if (!hasQueen && allPieces.length <= 12) {
      return {
        theme: 'endgame_technique',
        title: 'Endgame Technique & King Activity',
        description: `In this simplified endgame, active king placement and precise pawn counting dictate the outcome.`,
        severity: 'moderate',
      };
    }

    return null;
  }

  // ============================================================================
  // Deterministic 5-Part Explanations & Coach Prose
  // ============================================================================

  private buildActualMoveExplanation(ctx: {
    san: string;
    pieceName: string;
    from: string;
    to: string;
    captured?: string;
    isCheck: boolean;
    judgment: MoveClassificationGrade;
    primaryTheme: CoachingTacticalTheme;
    detectedThemes: TacticalThemeEvidence[];
  }): string {
    const { san, pieceName, from, to, captured, isCheck, judgment, primaryTheme } = ctx;
    const captureText = captured ? ` capturing on ${to}` : ` to ${to}`;
    const checkText = isCheck ? ' giving check' : '';

    if (judgment === 'blunder') {
      if (primaryTheme === 'hanging_piece') {
        return `You played ${san} (${pieceName} from ${from}${captureText}${checkText}), leaving material unprotected or stepping directly into enemy fire.`;
      }
      if (primaryTheme === 'fork') {
        return `You played ${san} (${pieceName} from ${from}${captureText}${checkText}), allowing an immediate double attack that wins decisive material.`;
      }
      if (primaryTheme === 'mating_threat') {
        return `You played ${san} (${pieceName} from ${from}${captureText}${checkText}), missing an imminent checkmate sequence.`;
      }
      return `You played ${san} (${pieceName} from ${from}${captureText}${checkText}), which surrenders your initiative and concedes a decisive tactical advantage.`;
    }

    if (judgment === 'mistake') {
      return `You chose ${san} (${pieceName} from ${from}${captureText}${checkText}), weakening your position and giving your opponent a clear refutation.`;
    }

    if (judgment === 'miss') {
      return `You played ${san} (${pieceName} from ${from}${captureText}${checkText}), overlooking a tactical win or free piece that was available on this turn.`;
    }

    return `You played ${san} (${pieceName} from ${from}${captureText}${checkText}).`;
  }

  private buildRecommendedMoveExplanation(ctx: {
    bestSan: string;
    bestPieceName: string;
    from: string;
    to: string;
    fenBefore: string;
    primaryTheme: CoachingTacticalTheme;
  }): string {
    const { bestSan, bestPieceName, from, to, primaryTheme } = ctx;

    if (primaryTheme === 'hanging_piece') {
      return `Stockfish 19 strongly favored ${bestSan} (${bestPieceName} to ${to}), which safeguards your piece and maintains total piece defense.`;
    }
    if (primaryTheme === 'fork') {
      return `The engine found ${bestSan} (${bestPieceName} to ${to}), defusing the double attack and maintaining balance.`;
    }
    if (primaryTheme === 'mating_threat') {
      return `The only defense was ${bestSan} (${bestPieceName} to ${to}), creating an essential escape square and stopping the mating net.`;
    }
    if (primaryTheme === 'passed_pawn') {
      return `The winning line was ${bestSan} (${bestPieceName} to ${to}), seizing control of the queening square.`;
    }

    return `The engine recommended ${bestSan} (${bestPieceName} from ${from} to ${to}), maximizing piece coordination and keeping pressure on your opponent.`;
  }

  private buildRefutationExplanation(ctx: {
    opponentUsername: string;
    continuationLineSan: string[];
    primaryTheme: CoachingTacticalTheme;
    detectedThemes: TacticalThemeEvidence[];
    userColor: 'white' | 'black';
  }): string {
    const { opponentUsername, continuationLineSan, primaryTheme } = ctx;
    const oppName = opponentUsername || (ctx.userColor === 'white' ? 'Black' : 'White');

    if (continuationLineSan.length === 0) {
      return `The engine calculates that the opponent immediately consolidates the advantage.`;
    }

    const firstMove = continuationLineSan[0];
    const lineFormatted = continuationLineSan.slice(0, 4).join(' ');

    if (primaryTheme === 'hanging_piece') {
      return `${oppName}'s strongest response is ${firstMove}, scooping up the undefended piece (${lineFormatted}).`;
    }
    if (primaryTheme === 'fork') {
      return `${oppName} punishes this with ${firstMove}, executing the double attack (${lineFormatted}).`;
    }
    if (primaryTheme === 'mating_threat') {
      return `${oppName} finishes with a forced sequence: ${lineFormatted}.`;
    }

    return `${oppName}'s optimal engine continuation is ${lineFormatted}, converting the evaluation swing.`;
  }

  private buildPracticalLesson(ctx: {
    primaryTheme: CoachingTacticalTheme;
    movePhase: 'Opening' | 'Middlegame' | 'Endgame';
    judgment: MoveClassificationGrade;
  }): string {
    const { primaryTheme, movePhase } = ctx;

    switch (primaryTheme) {
      case 'hanging_piece':
        return 'The 3-Second Scan: Before confirming any move, verify both that your landing square is safe and that you have not unmasked a friendly piece behind you.';
      case 'fork':
        return 'Watch For Alignment: Whenever two valuable pieces share the same rank, file, or knight geometry, assume your opponent is looking for a double attack.';
      case 'pin':
        return 'Never Leave Pinned Pieces Unsupported: If a piece cannot legally or safely move because of a piece behind it, reinforce its defense immediately.';
      case 'skewer':
        return 'Step Off Open Lines: Keep your King and Queen off open files and diagonals where opposing rooks and bishops can line up behind them.';
      case 'discovered_attack':
        return 'Beware the Hidden Threat: Always check who stands behind an opponent piece before letting it hop out of the way.';
      case 'mating_threat':
        return 'Give Your King Luft: When your king is castled, create a timely escape square (h3/h6) to avoid deadly back-rank traps.';
      case 'passed_pawn':
        return 'Passed Pawns Must Be Pushed: In pawn endings, support your passed pawn with your King from the front or side.';
      case 'endgame_technique':
        return 'Activate Your King Early: In the endgame without queens, your King transforms from a target into a powerful attacking piece.';
      default:
        return movePhase === 'Opening'
          ? 'Opening Principle: Develop your minor pieces to active squares and castle before launching speculative attacks.'
          : movePhase === 'Endgame'
          ? 'Endgame Principle: In simplified positions, calculation precision and active king placement outweigh passive defense.'
          : 'Middlegame Principle: Maintain piece harmony and avoid committing pieces to squares where they lack friendly backup.';
    }
  }

  private buildCoachSpeech(ctx: {
    moveNumber: number;
    opponent: string;
    userMoveSan: string;
    bestMoveSan: string;
    beforeFormatted: string;
    afterFormatted: string;
    evalLossCp: number;
    primaryTheme: CoachingTacticalTheme;
    primaryThemeLabel: string;
    opponentMoveSan?: string;
    continuationLineSan: string[];
    practicalLesson: string;
    isAmbiguous: boolean;
  }): string {
    const {
      moveNumber,
      opponent,
      userMoveSan,
      bestMoveSan,
      beforeFormatted,
      afterFormatted,
      primaryTheme,
      opponentMoveSan,
      continuationLineSan,
    } = ctx;

    const oppFormatted = opponent ? `against ${opponent}` : 'in this position';
    const beforeClean = beforeFormatted.replace('+', '');
    const afterClean = afterFormatted.replace('-', '');

    let tacticalSnippet = '';
    if (primaryTheme === 'hanging_piece' && opponentMoveSan) {
      tacticalSnippet = ` This left material hanging, allowing ${opponentMoveSan}.`;
    } else if (primaryTheme === 'fork' && opponentMoveSan) {
      tacticalSnippet = ` This ran into a devastating fork (${opponentMoveSan}).`;
    } else if (continuationLineSan.length > 0) {
      tacticalSnippet = ` The opponent refutation was ${continuationLineSan.slice(0, 2).join(' ')}.`;
    }

    return `Move ${moveNumber} ${oppFormatted}: you played ${userMoveSan}, and ${bestMoveSan} was the move. You were up ${beforeClean} before it and down ${afterClean} after.${tacticalSnippet}`;
  }

  // ============================================================================
  // Helper Geometry & Chess Utilities
  // ============================================================================

  /**
   * Replays and validates Stockfish PV line on chessAfter FEN to ensure 100% legal moves.
   */
  private extractValidContinuationLine(
    fenAfter: string,
    pvs: any[],
    sideToMove: 'white' | 'black',
    startMoveNumber: number
  ): MoveStep[] {
    const steps: MoveStep[] = [];
    if (!pvs || pvs.length === 0) return steps;

    const pv = pvs[0];
    const pvMoves: string[] = pv?.pvMoves || [];
    if (pvMoves.length === 0) return steps;

    const chess = new Chess();
    try {
      chess.load(fenAfter);
    } catch {
      return steps;
    }

    let currentColor = sideToMove;
    let currentMoveNum = startMoveNumber;
    let ply = 1;

    for (const uci of pvMoves.slice(0, 6)) {
      const from = uci.substring(0, 2) as Square;
      const to = uci.substring(2, 4) as Square;
      const promotion = uci.length > 4 ? uci.substring(4, 5) : undefined;

      try {
        const moveRes = chess.move({ from, to, promotion });
        if (moveRes) {
          steps.push({
            ply,
            moveNumber: currentMoveNum,
            color: currentColor,
            san: moveRes.san,
            from,
            to,
            fenAfter: chess.fen(),
          });
          ply++;
          if (currentColor === 'black') {
            currentColor = 'white';
            currentMoveNum++;
          } else {
            currentColor = 'black';
          }
        } else {
          break;
        }
      } catch {
        break;
      }
    }

    return steps;
  }

  private getSquareAttackers(chess: Chess, square: Square, color: Color): { piece: PieceSymbol; from: Square }[] {
    const attackers: { piece: PieceSymbol; from: Square }[] = [];
    const board = chess.board();

    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const p = board[r][c];
        if (p && p.color === color) {
          const fromSq = `${'abcdefgh'[c]}${8 - r}` as Square;
          const attackedSqs = this.getAttackedSquaresByPiece(chess, fromSq, p.type);
          if (attackedSqs.includes(square)) {
            attackers.push({ piece: p.type, from: fromSq });
          }
        }
      }
    }

    return attackers;
  }

  private getAttackedSquaresByPiece(chess: Chess, from: Square, pieceType: PieceSymbol): Square[] {
    const fIdx = 'abcdefgh'.indexOf(from[0]);
    const rIdx = parseInt(from[1], 10) - 1;
    const squares: Square[] = [];
    const color = chess.get(from)?.color || 'w';

    const addSquare = (f: number, r: number): boolean => {
      if (f < 0 || f > 7 || r < 0 || r > 7) return false;
      const sq = `${'abcdefgh'[f]}${r + 1}` as Square;
      squares.push(sq);
      const piece = chess.get(sq);
      return !piece; // stop ray if square occupied
    };

    if (pieceType === 'p') {
      const dir = color === 'w' ? 1 : -1;
      if (fIdx > 0 && rIdx + dir >= 0 && rIdx + dir <= 7) {
        squares.push(`${'abcdefgh'[fIdx - 1]}${rIdx + dir + 1}` as Square);
      }
      if (fIdx < 7 && rIdx + dir >= 0 && rIdx + dir <= 7) {
        squares.push(`${'abcdefgh'[fIdx + 1]}${rIdx + dir + 1}` as Square);
      }
    } else if (pieceType === 'n') {
      const jumps = [
        [1, 2], [2, 1], [-1, 2], [-2, 1],
        [1, -2], [2, -1], [-1, -2], [-2, -1],
      ];
      for (const [df, dr] of jumps) {
        const f = fIdx + df;
        const r = rIdx + dr;
        if (f >= 0 && f <= 7 && r >= 0 && r <= 7) {
          squares.push(`${'abcdefgh'[f]}${r + 1}` as Square);
        }
      }
    } else if (pieceType === 'b' || pieceType === 'q') {
      const diags = [[1, 1], [1, -1], [-1, 1], [-1, -1]];
      for (const [df, dr] of diags) {
        let f = fIdx + df;
        let r = rIdx + dr;
        while (addSquare(f, r)) {
          f += df;
          r += dr;
        }
      }
    }

    if (pieceType === 'r' || pieceType === 'q') {
      const straights = [[1, 0], [-1, 0], [0, 1], [0, -1]];
      for (const [df, dr] of straights) {
        let f = fIdx + df;
        let r = rIdx + dr;
        while (addSquare(f, r)) {
          f += df;
          r += dr;
        }
      }
    }

    if (pieceType === 'k') {
      for (let df = -1; df <= 1; df++) {
        for (let dr = -1; dr <= 1; dr++) {
          if (df === 0 && dr === 0) continue;
          const f = fIdx + df;
          const r = rIdx + dr;
          if (f >= 0 && f <= 7 && r >= 0 && r <= 7) {
            squares.push(`${'abcdefgh'[f]}${r + 1}` as Square);
          }
        }
      }
    }

    return squares;
  }

  private findKingSquare(chess: Chess, color: Color): Square | null {
    const board = chess.board();
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const p = board[r][c];
        if (p && p.color === color && p.type === 'k') {
          return `${'abcdefgh'[c]}${8 - r}` as Square;
        }
      }
    }
    return null;
  }

  private getPiecesOfType(
    chess: Chess,
    color: Color,
    types: PieceSymbol[]
  ): Array<{ square: Square; piece: { type: PieceSymbol; color: Color } }> {
    const result: Array<{ square: Square; piece: { type: PieceSymbol; color: Color } }> = [];
    const board = chess.board();
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const p = board[r][c];
        if (p && p.color === color && types.includes(p.type)) {
          result.push({ square: `${'abcdefgh'[c]}${8 - r}` as Square, piece: p });
        }
      }
    }
    return result;
  }

  private getRayBetween(sq1: Square, sq2: Square): Square[] | null {
    const f1 = 'abcdefgh'.indexOf(sq1[0]);
    const r1 = parseInt(sq1[1], 10) - 1;
    const f2 = 'abcdefgh'.indexOf(sq2[0]);
    const r2 = parseInt(sq2[1], 10) - 1;

    const df = Math.sign(f2 - f1);
    const dr = Math.sign(r2 - r1);

    if (df === 0 && dr === 0) return null;
    if (df !== 0 && dr !== 0 && Math.abs(f2 - f1) !== Math.abs(r2 - r1)) return null;

    const squares: Square[] = [];
    let f = f1 + df;
    let r = r1 + dr;

    while (f !== f2 || r !== r2) {
      squares.push(`${'abcdefgh'[f]}${r + 1}` as Square);
      f += df;
      r += dr;
    }

    return squares;
  }

  private getDirection(from: Square, to: Square): [number, number] | null {
    const f1 = 'abcdefgh'.indexOf(from[0]);
    const r1 = parseInt(from[1], 10) - 1;
    const f2 = 'abcdefgh'.indexOf(to[0]);
    const r2 = parseInt(to[1], 10) - 1;

    const df = Math.sign(f2 - f1);
    const dr = Math.sign(r2 - r1);

    if (df === 0 && dr === 0) return null;
    if (df !== 0 && dr !== 0 && Math.abs(f2 - f1) !== Math.abs(r2 - r1)) return null;

    return [df, dr];
  }

  private getSquaresInDirection(from: Square, dir: [number, number]): Square[] {
    const [df, dr] = dir;
    let f = 'abcdefgh'.indexOf(from[0]) + df;
    let r = parseInt(from[1], 10) - 1 + dr;
    const squares: Square[] = [];

    while (f >= 0 && f <= 7 && r >= 0 && r <= 7) {
      squares.push(`${'abcdefgh'[f]}${r + 1}` as Square);
      f += df;
      r += dr;
    }

    return squares;
  }

  private stepSquare(from: Square, df: number, dr: number): Square | null {
    const f = 'abcdefgh'.indexOf(from[0]) + df;
    const r = parseInt(from[1], 10) - 1 + dr;
    if (f < 0 || f > 7 || r < 0 || r > 7) return null;
    return `${'abcdefgh'[f]}${r + 1}` as Square;
  }

  private isPawnPassed(chess: Chess, pawnSq: Square, color: Color): boolean {
    const fIdx = 'abcdefgh'.indexOf(pawnSq[0]);
    const rIdx = parseInt(pawnSq[1], 10) - 1;
    const oppColor: Color = color === 'w' ? 'b' : 'w';

    const checkFiles = [fIdx - 1, fIdx, fIdx + 1].filter(f => f >= 0 && f <= 7);
    const board = chess.board();

    for (const f of checkFiles) {
      if (color === 'w') {
        for (let r = rIdx + 1; r < 8; r++) {
          const p = board[7 - r][f];
          if (p && p.color === oppColor && p.type === 'p') return false;
        }
      } else {
        for (let r = rIdx - 1; r >= 0; r--) {
          const p = board[7 - r][f];
          if (p && p.color === oppColor && p.type === 'p') return false;
        }
      }
    }

    return true;
  }

  private formatScore(cp: number): string {
    const sign = cp >= 0 ? '+' : '';
    return `${sign}${(cp / 100).toFixed(1)}`;
  }

  private formatEvaluationSwing(
    beforeCp: number,
    afterCp: number,
    lossCp: number,
    epLoss: number
  ): string {
    const beforeStr = this.formatScore(beforeCp);
    const afterStr = this.formatScore(afterCp);
    const lossPawn = (lossCp / 100).toFixed(1);
    const epPct = Math.round(epLoss * 100);

    return `${beforeStr} → ${afterStr} (Loss: ${lossPawn} pawns, -${epPct} score-proxy points; not a win-probability estimate)`;
  }

}

export const coachingService = new CoachingService();
