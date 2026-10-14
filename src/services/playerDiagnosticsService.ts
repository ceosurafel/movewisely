/**
 * MoveWisely — Engine-Driven Player Diagnostics Service
 *
 * Implements Phase 4:
 * Replaces heuristic-based multi-game analysis with a robust player-diagnostics service
 * aggregating verified game reviews from Phase 2 (Stockfish 19 engine) and Phase 3 (MoveWisely Accuracy V1.1 (Experimental; Uncalibrated)).
 *
 * Requirements fulfilled:
 * - Traceable metrics: Every report metric is backed by analyzed games and moves.
 * - Wins, losses, draws, and analyzed-game counts.
 * - Per-player move classifications and unblended accuracy.
 * - Blunders and evaluation-loss statistics per game.
 * - Verified tactical patterns and missed opportunities.
 * - Phase-based errors tied to actual move positions.
 * - Opening statistics with sample sizes and opening-exit evaluations.
 * - Recurring weaknesses with supporting game and move references.
 * - Personalized training tasks based on verified recurring errors.
 * - Insufficient data handling: Explicit state when fewer than required valid games exist.
 * - Excludes corrupt / unanalyzable games from completed statistics.
 * - Maintains 100% backward compatibility with CheckupAnalysis for existing UI views.
 */

import { Chess } from 'chess.js';
import { GameRecord, CheckupAnalysis, LeakItem, SpotlightMove, ActionPlanTask, Platform, TimeControl, AnalysisStatus } from '../types/chess';
import {
  PlayerDiagnosticsResult,
  DiagnosticEvidence,
  VerifiedTacticalPattern,
  VerifiedOpeningStat,
  VerifiedRecurringWeakness,
  VerifiedPhaseBreakdown,
} from '../types/diagnostics';
import { getNextMilestone, getBenchmarkForRating } from './ratingBenchmarks';
import { gameAnalysisService, AnalyzedGameRecord, AnalyzedMoveRecord } from './gameAnalysisService';
import { isMoveInOpeningBook } from './openingBook';
import { coachingService } from './coachingService';
import { ACCURACY_ENGINE_VERSION } from './accuracyEngine';

export class PlayerDiagnosticsService {
  /**
   * Main multi-game analysis aggregator.
   * Runs or integrates engine game reviews and computes pure, traceable diagnostic metrics.
   */
  public async diagnosePlayer(
    username: string,
    platform: Platform,
    timeControl: TimeControl,
    userRating: number,
    importedGames: GameRecord[],
    options?: {
      maxGamesToAnalyze?: number;
      targetMilestone?: number;
      signal?: AbortSignal;
      onProgress?: (step: string, percent: number) => void;
    }
  ): Promise<PlayerDiagnosticsResult> {
    if (!Number.isFinite(userRating) || userRating <= 0) {
      throw new Error('A verified platform rating is required for rating-based diagnostics.');
    }
    const maxGames = options?.maxGamesToAnalyze || 20;
    const candidates = importedGames.slice(0, maxGames);

    // 1. Validate & Parse Games (Exclude invalid or corrupt PGNs)
    const validGames: GameRecord[] = [];
    const excludedGames: Array<{ gameId: string; reason: string }> = [];

    for (const g of candidates) {
      if (!g.pgn || g.pgn.trim().length === 0) {
        excludedGames.push({ gameId: g.id, reason: 'Empty PGN game record' });
        continue;
      }
      try {
        const testChess = new Chess();
        const cleanPgn = g.pgn.replace(/\[.*?\]\s*/g, '').trim();
        let loaded = false;
        try {
          testChess.loadPgn(cleanPgn, { strict: false });
          loaded = testChess.history().length > 0;
        } catch {
          try {
            testChess.loadPgn(g.pgn, { strict: false });
            loaded = testChess.history().length > 0;
          } catch {}
        }

        if (!loaded && testChess.history().length === 0) {
          excludedGames.push({ gameId: g.id, reason: 'Unparseable or corrupt PGN notation' });
        } else {
          validGames.push(g);
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Invalid game notation';
        excludedGames.push({ gameId: g.id, reason: msg });
      }
    }

    // Check for insufficient data (e.g. 0 valid games)
    if (validGames.length === 0) {
      return this.createInsufficientDataResult(
        username,
        platform,
        timeControl,
        userRating,
        candidates.length,
        excludedGames,
        'No valid or analyzable games could be parsed from the provided match history.',
        'failed',
        0,
        candidates.length
      );
    }

    // 2. Perform or Collect Game-by-Game Engine Analyses
    options?.onProgress?.('Preparing verified game diagnostics', 4);
    const analyzedGameRecords: AnalyzedGameRecord[] = [];

    for (let i = 0; i < validGames.length; i++) {
      if (options?.signal?.aborted) {
        break;
      }

      const g = validGames[i];
      const progressAtStart = 5 + Math.floor((i / validGames.length) * 80);
      options?.onProgress?.(`Analyzing game ${i + 1} of ${validGames.length}`, progressAtStart);
      try {
        const reviewed = await gameAnalysisService.analyzeGame(g, {
          depth: 10,
          signal: options?.signal,
        });
        analyzedGameRecords.push(reviewed);
      } catch (err: unknown) {
        console.warn(`Engine review failed for game ${g.id}:`, err);
        const timeline = gameAnalysisService.reconstructTimeline(g.pgn);
        analyzedGameRecords.push({
          game: g,
          timeline,
          analyzedMoves: [],
          status: 'failed',
          error: err instanceof Error ? err.message : String(err),
          userAccuracy: 0,
          harmonicAccuracy: 0,
          accuracyStats: {
            totalAnalyzedMoves: 0,
            bookMovesCount: 0,
            nonBookMovesCount: 0,
            accuracyPct: 0,
            harmonicAccuracyPct: 0,
            gradeCounts: {
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
            },
            averageCentipawnLoss: 0,
            averageExpectedPointsLoss: 0,
            accuracyVersion: 'Stockfish-19-Failed',
          },
          userBlundersCount: 0,
          userMistakesCount: 0,
          userInaccuraciesCount: 0,
          lossPhase: 'Middlegame',
        });
      }
      options?.onProgress?.(
        `Completed game ${i + 1} of ${validGames.length}`,
        5 + Math.round(((i + 1) / validGames.length) * 80)
      );
    }

    // Partition games into completed, partial, and failed
    const completedGames = analyzedGameRecords.filter(g => g.status === 'completed');
    const partialGames = analyzedGameRecords.filter(g => g.status === 'partial');
    const failedGames = [
      ...analyzedGameRecords.filter(g => g.status === 'failed' || g.status === 'cancelled'),
      ...excludedGames.map(eg => ({ gameId: eg.gameId, reason: eg.reason })),
    ];

    // Zero successfully analyzed games handler
    if (completedGames.length === 0) {
      const isAborted = options?.signal?.aborted;
      const status: AnalysisStatus = isAborted ? 'cancelled' : 'failed';
      const reason = isAborted
        ? 'Analysis was cancelled before any games could be completed.'
        : `0 of ${candidates.length} games could be successfully analyzed by the engine. Failures: ${
            analyzedGameRecords
              .map(r => r.error)
              .filter(Boolean)
              .join('; ') ||
            excludedGames.map(e => e.reason).join('; ') ||
            'No analyzable game records'
          }`;

      return this.createInsufficientDataResult(
        username,
        platform,
        timeControl,
        userRating,
        candidates.length,
        excludedGames,
        reason,
        status,
        partialGames.length,
        failedGames.length
      );
    }

    let overallStatus: AnalysisStatus = 'completed';
    if (options?.signal?.aborted) {
      overallStatus = 'cancelled';
    } else if (partialGames.length > 0 || failedGames.length > 0) {
      overallStatus = 'partial';
    }

    const statusMessage =
      overallStatus === 'completed'
        ? `All ${completedGames.length} games analyzed successfully with Stockfish 19.`
        : overallStatus === 'partial'
        ? `${completedGames.length} of ${candidates.length} attempted games analyzed successfully (${failedGames.length} failed, ${partialGames.length} partial).`
        : overallStatus === 'cancelled'
        ? `Analysis cancelled (${completedGames.length} of ${candidates.length} games completed).`
        : `Analysis failed: 0 games analyzed successfully.`;

    options?.onProgress?.('Synthesizing player diagnostics and weakness traces', 88);

    // 3. Compute Aggregate Game Record strictly from completed games
    let wins = 0;
    let losses = 0;
    let draws = 0;
    let whiteWins = 0;
    let whiteCount = 0;
    let blackWins = 0;
    let blackCount = 0;

    for (const ag of completedGames) {
      const g = ag.game;
      if (g.result === 'win') wins++;
      else if (g.result === 'loss') losses++;
      else draws++;

      if (g.userColor === 'white') {
        whiteCount++;
        if (g.result === 'win') whiteWins++;
      } else {
        blackCount++;
        if (g.result === 'win') blackWins++;
      }
    }

    const totalGames = completedGames.length;
    const winRate = Math.round((wins / Math.max(1, totalGames)) * 100);
    const whiteWinRate = whiteCount > 0 ? Math.round((whiteWins / whiteCount) * 100) : 50;
    const blackWinRate = blackCount > 0 ? Math.round((blackWins / blackCount) * 100) : 50;

    // 4. Rating & Milestone Calibration
    const currentRating = userRating;
    const requestedTarget = options?.targetMilestone;
    const targetMilestone =
      Number.isFinite(requestedTarget) && (requestedTarget as number) > currentRating
        ? Math.round(requestedTarget as number)
        : getNextMilestone(currentRating);
    const targetDistance = Math.max(15, targetMilestone - currentRating);
    const targetBenchmark = getBenchmarkForRating(targetMilestone);

    // 5. Aggregate Pure Move Classifications & Accuracy across completed games only
    let totalAnalyzedMoves = 0;
    let totalMoveAccuracySum = 0;
    let nonBookMovesCount = 0;
    let nonBookAccuracySum = 0;
    let totalCentipawnLoss = 0;
    let totalExpectedPointsLoss = 0;

    const gradeDistribution: Record<string, number> = {
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

    let totalBlunders = 0;
    let totalMistakes = 0;
    let totalInaccuracies = 0;

    const allEvidences: DiagnosticEvidence[] = [];

    for (const ag of completedGames) {
      totalBlunders += ag.userBlundersCount;
      totalMistakes += ag.userMistakesCount;
      totalInaccuracies += ag.userInaccuraciesCount;

      for (const move of ag.analyzedMoves) {
        totalAnalyzedMoves++;
        totalMoveAccuracySum += move.moveAccuracyPct;
        totalCentipawnLoss += move.evalLossCp;
        totalExpectedPointsLoss += move.expectedPointsLoss;

        gradeDistribution[move.judgment] = (gradeDistribution[move.judgment] || 0) + 1;

        if (move.judgment !== 'book') {
          nonBookMovesCount++;
          nonBookAccuracySum += move.moveAccuracyPct;
        }

        // Determine phase of this move
        const movePhase: 'Opening' | 'Middlegame' | 'Endgame' =
          move.moveNumber <= 12 ? 'Opening' : move.moveNumber >= 30 ? 'Endgame' : 'Middlegame';

        // Catalog significant inaccuracies, mistakes, and blunders as evidence
        if (move.evalLossCp >= 70 || move.expectedPointsLoss >= 0.08 || move.judgment === 'blunder') {
          allEvidences.push({
            gameId: ag.game.id,
            gameUrl: ag.game.url,
            opponentUsername: ag.game.opponentUsername,
            opponentRating: ag.game.opponentRating,
            userColor: ag.game.userColor,
            moveNumber: move.moveNumber,
            fenBefore: move.fenBefore,
            fenAfter: move.fenAfter,
            playedSan: move.san,
            bestMoveSan: move.bestMoveSan,
            evalLossCp: move.evalLossCp,
            expectedPointsLoss: move.expectedPointsLoss,
            grade: move.judgment,
            theme:
              move.evalLossCp >= 300
                ? 'Decisive Blunder'
                : move.evalLossCp >= 150
                ? 'Tactical Mistake'
                : 'Positional Inaccuracy',
            phase: movePhase,
          });
        }
      }
    }

    // Mathematical aggregation across verified moves (0 when 0 moves analyzed, never 75%)
    const overallAccuracy =
      totalAnalyzedMoves > 0
        ? Math.round((totalMoveAccuracySum / totalAnalyzedMoves) * 10) / 10
        : 0;

    const harmonicAccuracy =
      nonBookMovesCount > 0
        ? Math.round((nonBookAccuracySum / nonBookMovesCount) * 10) / 10
        : overallAccuracy;

    const averageCentipawnLoss =
      totalAnalyzedMoves > 0
        ? Math.round((totalCentipawnLoss / totalAnalyzedMoves) * 10) / 10
        : 0;

    const averageExpectedPointsLoss =
      totalAnalyzedMoves > 0
        ? Math.round((totalExpectedPointsLoss / totalAnalyzedMoves) * 1000) / 1000
        : 0;

    const blundersPerGame = parseFloat((totalBlunders / Math.max(1, completedGames.length)).toFixed(1));
    const mistakesPerGame = parseFloat((totalMistakes / Math.max(1, completedGames.length)).toFixed(1));

    // 6. Phase-Based Errors Tied to Actual Positions
    const phaseLossGameIds = {
      opening: new Set(completedGames.filter(ag => ag.game.result === 'loss' && ag.lossPhase === 'Opening').map(ag => ag.game.id)),
      middlegame: new Set(completedGames.filter(ag => ag.game.result === 'loss' && ag.lossPhase !== 'Opening' && ag.lossPhase !== 'Endgame').map(ag => ag.game.id)),
      endgame: new Set(completedGames.filter(ag => ag.game.result === 'loss' && ag.lossPhase === 'Endgame').map(ag => ag.game.id)),
    };
    const openingLosses = phaseLossGameIds.opening.size;
    const middlegameLosses = phaseLossGameIds.middlegame.size;
    const endgameLosses = phaseLossGameIds.endgame.size;
    const actualLosses = openingLosses + middlegameLosses + endgameLosses;
    const lossGamesByPhase = { opening: openingLosses, middlegame: middlegameLosses, endgame: endgameLosses };
    const isLossDataAvailable = actualLosses > 0;
    const phaseAllEvidence = {
      opening: allEvidences.filter(e => e.phase === 'Opening'),
      middlegame: allEvidences.filter(e => e.phase === 'Middlegame'),
      endgame: allEvidences.filter(e => e.phase === 'Endgame'),
    };
    const phaseEvidences = isLossDataAvailable
      ? {
          opening: phaseAllEvidence.opening.filter(e => phaseLossGameIds.opening.has(e.gameId)),
          middlegame: phaseAllEvidence.middlegame.filter(e => phaseLossGameIds.middlegame.has(e.gameId)),
          endgame: phaseAllEvidence.endgame.filter(e => phaseLossGameIds.endgame.has(e.gameId)),
        }
      : phaseAllEvidence;

    let openingLossesPct = 0;
    let middlegameLossesPct = 0;
    let endgameLossesPct = 0;
    let weakestPhase: 'Opening' | 'Middlegame' | 'Endgame' = 'Middlegame';
    let weakestPhaseLossPct = 0;
    let phaseExplanation = '';

    if (isLossDataAvailable) {
      openingLossesPct = Math.round((openingLosses / actualLosses) * 100);
      middlegameLossesPct = Math.round((middlegameLosses / actualLosses) * 100);
      endgameLossesPct = Math.max(0, 100 - openingLossesPct - middlegameLossesPct);

      if (openingLossesPct >= middlegameLossesPct && openingLossesPct >= endgameLossesPct) {
        weakestPhase = 'Opening';
        weakestPhaseLossPct = openingLossesPct;
      } else if (endgameLossesPct >= middlegameLossesPct && endgameLossesPct >= openingLossesPct) {
        weakestPhase = 'Endgame';
        weakestPhaseLossPct = endgameLossesPct;
      } else {
        weakestPhase = 'Middlegame';
        weakestPhaseLossPct = middlegameLossesPct;
      }

      const phaseLossCount = lossGamesByPhase[weakestPhase === 'Opening' ? 'opening' : weakestPhase === 'Middlegame' ? 'middlegame' : 'endgame'];
      const phaseEvidenceCount = phaseEvidences[weakestPhase === 'Opening' ? 'opening' : weakestPhase === 'Middlegame' ? 'middlegame' : 'endgame'].length;
      phaseExplanation = weakestPhase + ' accounted for ' + weakestPhaseLossPct + '% (' + phaseLossCount + '/' + actualLosses + ') of recorded defeats across ' + totalGames + ' completed games. ' + phaseEvidenceCount + ' qualifying position(s) from those losses are attached as evidence.';
    } else {
      // Zero losses recorded! Phase-of-loss statistics are unavailable / not applicable.
      // Never manufacture an endgame loss percentage of 100%.
      openingLossesPct = 0;
      middlegameLossesPct = 0;
      endgameLossesPct = 0;
      weakestPhaseLossPct = 0;

      // Identify weakest phase by error count instead of false loss percentage
      const opErr = phaseEvidences.opening.length;
      const midErr = phaseEvidences.middlegame.length;
      const endErr = phaseEvidences.endgame.length;
      if (opErr > midErr && opErr >= endErr) {
        weakestPhase = 'Opening';
      } else if (endErr > midErr && endErr >= opErr) {
        weakestPhase = 'Endgame';
      } else {
        weakestPhase = 'Middlegame';
      }

      phaseExplanation = 'Phase-of-loss statistics are not applicable: zero defeats were recorded across the analyzed games. Phase error distribution is evaluated by move inaccuracy frequency.';
    }

    const phases: VerifiedPhaseBreakdown = {
      openingLossesPct,
      middlegameLossesPct,
      endgameLossesPct,
      openingErrorsCount: phaseEvidences.opening.length,
      middlegameErrorsCount: phaseEvidences.middlegame.length,
      endgameErrorsCount: phaseEvidences.endgame.length,
      weakestPhase,
      weakestPhaseLossPct,
      lossGamesSampleSize: actualLosses,
      lossGamesByPhase,
      explanation: phaseExplanation,
      isLossDataAvailable,
      phaseEvidences,
    };

    // 7. Tactical Pattern Detection & Verified Opportunities (No synthetic inflation)
    const tacticalPatterns = this.extractVerifiedTacticalPatterns(completedGames, allEvidences);

    let hangingPiecesCount = 0;
    let missedFreePiecesCount = 0;
    let forkPinCount = 0;

    for (const p of tacticalPatterns) {
      if (p.theme === 'hanging_piece') hangingPiecesCount += p.occurrences;
      else if (p.theme === 'missed_free_piece') missedFreePiecesCount += p.occurrences;
      else if (p.theme === 'fork' || p.theme === 'pin') forkPinCount += p.occurrences;
    }

    const tacticalSummary = {
      hangingPiecesLostTotal: hangingPiecesCount,
      missedFreePiecesTotal: missedFreePiecesCount,
      forkPinVulnerabilities: forkPinCount,
      tacticalLeakScore:
        completedGames.length > 0
          ? Math.min(10, Math.round((hangingPiecesCount / completedGames.length) * 10))
          : 0,
    };

    // 8. Opening Statistics with Sample Sizes and Opening-Exit Evaluations
    const openings = this.extractVerifiedOpeningStats(completedGames);

    let mostFrequentOpening = openings[0]?.openingName || 'None';
    const topLeakCandidate = openings.find(o => o.isLeak && o.evidences.length > 0) || openings[0];
    const topLeakOpening = topLeakCandidate
      ? {
          name: topLeakCandidate.openingName,
          eco: topLeakCandidate.eco,
          gamesCount: topLeakCandidate.sampleSize,
          scorePct: topLeakCandidate.scorePct,
          averageExitEvalCp: topLeakCandidate.averageExitEvalCp,
          exitEvaluationSampleSize: topLeakCandidate.exitEvaluationSampleSize,
          blundersConceded: topLeakCandidate.blundersConceded,
          lossRatePct: topLeakCandidate.lossRatePct,
          isLeak: topLeakCandidate.isLeak,
          evidences: topLeakCandidate.evidences,
          advice:
            topLeakCandidate.scorePct <= 35
              ? `Sub-optimal ${topLeakCandidate.scorePct}% score in ${topLeakCandidate.openingName}. Study book moves 3–7.`
              : `Focus on rapid piece development and central coordination in early turns of ${topLeakCandidate.openingName}.`,
        }
      : {
          name: 'None',
          eco: '',
          gamesCount: 0,
          scorePct: 0,
          averageExitEvalCp: null,
          exitEvaluationSampleSize: 0,
          blundersConceded: 0,
          lossRatePct: 0,
          isLeak: false,
          evidences: [],
          advice: 'No opening data available from analyzed games.',
        };

    // 9. Check for endgame advantage conversion slips and late-game time trouble errors
    let endgameConversionSlipCount = 0;
    const endgameConversionEvidences: DiagnosticEvidence[] = [];
    for (const ag of completedGames) {
      const endgameMoves = ag.analyzedMoves.filter(m => m.moveNumber >= 28);
      if (endgameMoves.length > 0) {
        const firstEndgameMove = endgameMoves[0];
        if (firstEndgameMove.evalCpBefore >= 150) {
          const blunderMove = endgameMoves.find(m => m.evalLossCp >= 150 || m.judgment === 'blunder');
          if (blunderMove && ag.game.result !== 'win') {
            endgameConversionSlipCount++;
            if (blunderMove) {
              endgameConversionEvidences.push({
                gameId: ag.game.id,
                gameUrl: ag.game.url,
                opponentUsername: ag.game.opponentUsername,
                opponentRating: ag.game.opponentRating,
                userColor: ag.game.userColor,
                moveNumber: blunderMove.moveNumber,
                fenBefore: blunderMove.fenBefore,
                fenAfter: blunderMove.fenAfter,
                playedSan: blunderMove.san,
                bestMoveSan: blunderMove.bestMoveSan,
                evalLossCp: blunderMove.evalLossCp,
                expectedPointsLoss: blunderMove.expectedPointsLoss,
                grade: blunderMove.judgment,
                theme: 'Endgame Conversion Slip',
                phase: 'Endgame',
              });
            }
          }
        }
      }
    }

    // Move number is not clock telemetry; only count engine-graded mistakes/blunders.
    const timeTroubleEvidences = allEvidences.filter(e => e.moveNumber >= 35 && (e.grade === 'mistake' || e.grade === 'blunder'));

    // 10. Recurring Weaknesses with Supporting Game and Move References
    const recurringWeaknesses = this.extractRecurringWeaknesses({
      totalGames,
      blundersPerGame,
      targetBlunders: targetBenchmark.expectedBlundersPerGame,
      tacticalPatterns,
      phases,
      allEvidences,
      topLeakOpening,
      overallAccuracy,
      targetAccuracy: targetBenchmark.expectedAccuracy,
      endgameConversionSlipCount,
      endgameConversionEvidences,
      timeTroubleEvidences,
    });

    // 11. Extract Genuine Engine Spotlight Move (Only from verified games)
    let spotlightMove = gameAnalysisService.extractSpotlightMove(completedGames);
    if (spotlightMove) {
      spotlightMove = coachingService.enrichSpotlightMove(spotlightMove);
    }

    // 12. Ranked Leaks for ResultsView Slide 7
    const leaks = this.buildRankedLeaks({
      blundersPerGame,
      targetBenchmark,
      targetMilestone,
      phases,
      tacticalSummary,
      topLeakOpening,
      overallAccuracy,
      totalGames,
      endgameConversionSlipCount,
      timeTroubleCount: new Set(timeTroubleEvidences.map(e => e.gameId)).size,
    });

    const criticalOrModerateCount = leaks.filter(
      l => l.severity === 'critical' || l.severity === 'moderate'
    ).length;
    const isReadyForMilestone =
      overallAccuracy >= targetBenchmark.expectedAccuracy &&
      blundersPerGame <= targetBenchmark.expectedBlundersPerGame;

    // 12. Emotional Verdict
    const emotionalHeadline = isReadyForMilestone
      ? `Internal reference benchmark met for ${targetMilestone}`
      : blundersPerGame > targetBenchmark.expectedBlundersPerGame * 1.3
      ? `${blundersPerGame} blunders/game identified for review`
      : `${criticalOrModerateCount} training patterns identified in ${weakestPhase}`;

    const phaseLossRemark = isLossDataAvailable
      ? `${weakestPhaseLossPct}% of your recorded defeats occurred in the ${weakestPhase.toLowerCase()}.`
      : 'With zero recorded defeats across the analyzed games, no phase concentration of losses was observed.';

    const emotionalStatement = isReadyForMilestone
      ? `Your ${overallAccuracy}% MoveWisely accuracy score meets the internal reference benchmark for ${targetMilestone}. This is a comparison within MoveWisely's experimental, uncalibrated scoring system—not a guarantee of rating performance.`
      : `Across ${totalGames} completed games, the analysis identified ${totalBlunders} moves classified as blunders by MoveWisely's current scoring rules. ${phaseLossRemark} These observations identify training priorities; they do not predict a specific rating gain.`;

    // 13. Personalized Action Tasks Based on Verified Errors
    const tasks = this.generateVerifiedActionPlan({
      userRating,
      targetMilestone,
      timeControl,
      blundersPerGame,
      targetBlunders: targetBenchmark.expectedBlundersPerGame,
      hangingPieces: tacticalSummary.hangingPiecesLostTotal,
      missedFreePieces: tacticalSummary.missedFreePiecesTotal,
      weakestPhase,
      weakestPhaseLossPct,
      topLeakOpening,
      recurringWeaknesses,
    });

    const coreFocus =
      weakestPhaseLossPct >= 50
        ? `Eliminating ${weakestPhase.toLowerCase()} tactical collapses (${weakestPhaseLossPct}% of losses)`
        : blundersPerGame > targetBenchmark.expectedBlundersPerGame * 1.2
        ? `Cutting your ${blundersPerGame} blunders/game to ${targetBenchmark.expectedBlundersPerGame}`
        : `Improving overall precision from ${overallAccuracy}% to ${targetBenchmark.expectedAccuracy}%`;

    // Rating improvement and the time required to reach a milestone cannot be
    // inferred reliably from these game diagnostics. Do not publish a forecast.
    const projectedRatingGain: number | null = null;
    const estimatedWeeks: number | null = null;

    options?.onProgress?.('Analysis ready', 100);

    return {
      username,
      platform,
      timeControl,
      analyzedAt: new Date().toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      }),
      status: overallStatus,
      statusMessage,
      attemptedGamesCount: candidates.length,
      completedGamesCount: completedGames.length,
      partialGamesCount: partialGames.length,
      failedGamesCount: failedGames.length,
      engineVersion: 'Stockfish 19 Lite WASM',
      scoringVersion: ACCURACY_ENGINE_VERSION,
      importedGamesCount: importedGames.length,
      analyzedGamesCount: totalGames,
      excludedGamesCount: excludedGames.length,
      exclusionReasons: excludedGames,
      isInsufficientData: false,
      wins,
      losses,
      draws,
      winRate,
      currentRating,
      targetMilestone,
      targetDistance,
      overallAccuracy,
      harmonicAccuracy,
      targetRatingAccuracy: targetBenchmark.expectedAccuracy,
      averageCentipawnLoss,
      averageExpectedPointsLoss,
      totalAnalyzedMoves,
      gradeDistribution,
      totalBlunders,
      blundersPerGame,
      targetBlundersPerGame: targetBenchmark.expectedBlundersPerGame,
      totalMistakes,
      mistakesPerGame,
      totalInaccuracies,
      tacticalPatterns,
      tacticalSummary,
      phases,
      openings,
      whiteWinRate,
      blackWinRate,
      mostFrequentOpening,
      topLeakOpening: {
        name: topLeakOpening.name,
        gamesCount: topLeakOpening.gamesCount,
        scorePct: topLeakOpening.scorePct,
        advice: topLeakOpening.advice,
        averageExitEvalCp: topLeakOpening.averageExitEvalCp,
      },
      recurringWeaknesses,
      spotlightMove: spotlightMove || null,
      emotionalVerdict: {
        headline: emotionalHeadline,
        statement: emotionalStatement,
        subtitle: `Diagnosed across your last ${totalGames} ${timeControl} battles with Stockfish 19.`,
        leaksCount: criticalOrModerateCount,
        isReadyForMilestone,
      },
      leaks,
      actionPlan: {
        milestone: targetMilestone,
        projectedRatingGain,
        estimatedWeeks,
        coreFocus,
        tasks,
      },
      analyzedGameRecords,
      rawGames: validGames,
    };
  }

  /**
   * Adapts PlayerDiagnosticsResult into backward-compatible CheckupAnalysis
   * so existing UI components (ResultsView, Slides 0–8) render without modifications.
   */
  public toCheckupAnalysis(diag: PlayerDiagnosticsResult): CheckupAnalysis {
    return {
      username: diag.username,
      platform: diag.platform,
      timeControl: diag.timeControl,
      analyzedAt: diag.analyzedAt,
      totalGames: diag.analyzedGamesCount,
      attemptedGamesCount: diag.attemptedGamesCount,
      completedGamesCount: diag.completedGamesCount,
      partialGamesCount: diag.partialGamesCount,
      failedGamesCount: diag.failedGamesCount,
      status: diag.status,
      statusMessage: diag.statusMessage,
      engineVersion: diag.engineVersion,
      scoringVersion: diag.scoringVersion,
      wins: diag.wins,
      losses: diag.losses,
      draws: diag.draws,
      winRate: diag.winRate,
      currentRating: diag.currentRating,
      targetMilestone: diag.targetMilestone,
      targetDistance: diag.targetDistance,
      accuracy: diag.overallAccuracy,
      targetRatingAccuracy: diag.targetRatingAccuracy,
      blundersPerGame: diag.blundersPerGame,
      targetBlundersPerGame: diag.targetBlundersPerGame,
      emotionalVerdict: diag.emotionalVerdict,
      accuracyBreakdown: {
        accuracyPct: diag.overallAccuracy,
        harmonicAccuracyPct: diag.harmonicAccuracy,
        averageCentipawnLoss: diag.averageCentipawnLoss,
        averageExpectedPointsLoss: diag.averageExpectedPointsLoss,
        gradeCounts: diag.gradeDistribution,
        version: diag.scoringVersion,
      },
      spotlightMove: diag.spotlightMove || null,
      leaks: diag.leaks,
      phasesBreakdown: {
        openingLossesPct: diag.phases.openingLossesPct,
        middlegameLossesPct: diag.phases.middlegameLossesPct,
        endgameLossesPct: diag.phases.endgameLossesPct,
        weakestPhase: diag.phases.weakestPhase,
        explanation: diag.phases.explanation,
        isLossDataAvailable: diag.phases.isLossDataAvailable,
      },
      openingStats: {
        whiteWinRate: diag.whiteWinRate,
        blackWinRate: diag.blackWinRate,
        mostFrequentOpening: diag.mostFrequentOpening,
        topLeakOpening: {
          name: diag.topLeakOpening.name,
          gamesCount: diag.topLeakOpening.gamesCount,
          scorePct: diag.topLeakOpening.scorePct,
          advice: diag.topLeakOpening.advice,
        },
      },
      tacticalStats: diag.tacticalSummary,
      actionPlan: diag.actionPlan,
      games: diag.rawGames,
      diagnostics: diag,
    };
  }

  /**
   * Identifies tactical patterns verified by genuine engine evaluation swings and piece attacks.
   * Eliminates naive classification that labels all middlegame blunders as forks or all misses as free pieces.
   */
  private extractVerifiedTacticalPatterns(
    analyzedGames: AnalyzedGameRecord[],
    allEvidences: DiagnosticEvidence[]
  ): VerifiedTacticalPattern[] {
    const patterns: VerifiedTacticalPattern[] = [];

    const hangingEvidences: DiagnosticEvidence[] = [];
    const forkEvidences: DiagnosticEvidence[] = [];
    const pinEvidences: DiagnosticEvidence[] = [];
    const missedFreePieceEvidences: DiagnosticEvidence[] = [];
    const generalLossEvidences: DiagnosticEvidence[] = [];

    // Analyze each critical move with authentic motif detection
    for (const ag of analyzedGames) {
      for (const move of ag.analyzedMoves) {
        // Only inspect significant errors
        if (move.evalLossCp < 100 && move.expectedPointsLoss < 0.08 && move.judgment !== 'blunder' && move.judgment !== 'miss') {
          continue;
        }

        const movePhase: 'Opening' | 'Middlegame' | 'Endgame' =
          move.moveNumber <= 12 ? 'Opening' : move.moveNumber >= 30 ? 'Endgame' : 'Middlegame';

        const baseEvidence: DiagnosticEvidence = {
          gameId: ag.game.id,
          gameUrl: ag.game.url,
          opponentUsername: ag.game.opponentUsername,
          opponentRating: ag.game.opponentRating,
          userColor: ag.game.userColor,
          moveNumber: move.moveNumber,
          fenBefore: move.fenBefore,
          fenAfter: move.fenAfter,
          playedSan: move.san,
          bestMoveSan: move.bestMoveSan,
          evalLossCp: move.evalLossCp,
          expectedPointsLoss: move.expectedPointsLoss,
          grade: move.judgment,
          phase: movePhase,
        };

        const themes = coachingService.detectMoveTacticalMotifs(move);
        const isMissedFree = coachingService.checkMissedFreePiece(move);

        let motifAssigned = false;

        if (themes.some(t => t.theme === 'hanging_piece')) {
          hangingEvidences.push({ ...baseEvidence, theme: 'Undefended Piece' });
          motifAssigned = true;
        }
        if (themes.some(t => t.theme === 'fork')) {
          forkEvidences.push({ ...baseEvidence, theme: 'Fork / Double Attack' });
          motifAssigned = true;
        }
        if (themes.some(t => t.theme === 'pin')) {
          pinEvidences.push({ ...baseEvidence, theme: 'Pin / Ray Vulnerability' });
          motifAssigned = true;
        }
        if (isMissedFree) {
          missedFreePieceEvidences.push({ ...baseEvidence, theme: 'Overlooked Free Piece' });
          motifAssigned = true;
        }

        // If no specific tactical motif was reliably verified, report as general evaluation loss
        if (!motifAssigned && (move.evalLossCp >= 150 || move.judgment === 'blunder')) {
          generalLossEvidences.push({
            ...baseEvidence,
            theme: move.evalLossCp >= 300 ? 'Decisive Evaluation Drop' : 'Tactical Slip',
          });
        }
      }
    }

    // 1. Verified Hanging Pieces (Undefended minor/major pieces)
    if (hangingEvidences.length > 0) {
      patterns.push({
        id: 'pat-hanging',
        theme: 'hanging_piece',
        title: 'Undefended Minor/Major Pieces',
        occurrences: hangingEvidences.length,
        averageEvalLossCp: Math.round(
          hangingEvidences.reduce((acc, e) => acc + e.evalLossCp, 0) / hangingEvidences.length
        ),
        severity: hangingEvidences.length >= 4 ? 'critical' : 'moderate',
        sampleEvidences: hangingEvidences.slice(0, 3),
        evidences: hangingEvidences,
        remediationAdvice:
          'Before releasing your move, verify that your landing square has friendly defense and leaves no other piece exposed.',
      });
    }

    // 2. Verified Forks & Double Attacks
    if (forkEvidences.length > 0) {
      patterns.push({
        id: 'pat-fork',
        theme: 'fork',
        title: 'Double Attacks & Forks Conceded',
        occurrences: forkEvidences.length,
        averageEvalLossCp: Math.round(
          forkEvidences.reduce((acc, e) => acc + e.evalLossCp, 0) / forkEvidences.length
        ),
        severity: forkEvidences.length >= 3 ? 'critical' : 'moderate',
        sampleEvidences: forkEvidences.slice(0, 3),
        evidences: forkEvidences,
        remediationAdvice:
          'Scan knight jumps and queen diagonals before committing to pawn breaks or moving pieces into unprotected alignment.',
      });
    }

    // 3. Verified Pins
    if (pinEvidences.length > 0) {
      patterns.push({
        id: 'pat-pin',
        theme: 'pin',
        title: 'Pins Against High-Value Targets',
        occurrences: pinEvidences.length,
        averageEvalLossCp: Math.round(
          pinEvidences.reduce((acc, e) => acc + e.evalLossCp, 0) / pinEvidences.length
        ),
        severity: pinEvidences.length >= 3 ? 'critical' : 'moderate',
        sampleEvidences: pinEvidences.slice(0, 3),
        evidences: pinEvidences,
        remediationAdvice:
          'Step kings and queens off open lines and reinforce pinned defenders immediately.',
      });
    }

    // 4. Verified Missed Free Pieces
    if (missedFreePieceEvidences.length > 0) {
      patterns.push({
        id: 'pat-missed-opp',
        theme: 'missed_free_piece',
        title: 'Overlooked Free Pieces',
        occurrences: missedFreePieceEvidences.length,
        averageEvalLossCp: Math.round(
          missedFreePieceEvidences.reduce((acc, e) => acc + e.evalLossCp, 0) / missedFreePieceEvidences.length
        ),
        severity: missedFreePieceEvidences.length >= 3 ? 'critical' : 'moderate',
        sampleEvidences: missedFreePieceEvidences.slice(0, 3),
        evidences: missedFreePieceEvidences,
        remediationAdvice:
          'Scan your opponent’s loose pieces on every single turn before looking for your own attacking moves.',
      });
    }

    // 5. General Evaluation Losses (When reliable motif detection is not available)
    if (generalLossEvidences.length > 0) {
      patterns.push({
        id: 'pat-general-loss',
        theme: 'general_eval_loss',
        title: 'Decisive Evaluation Losses',
        occurrences: generalLossEvidences.length,
        averageEvalLossCp: Math.round(
          generalLossEvidences.reduce((acc, e) => acc + e.evalLossCp, 0) / generalLossEvidences.length
        ),
        severity: generalLossEvidences.length >= 4 ? 'critical' : 'moderate',
        sampleEvidences: generalLossEvidences.slice(0, 3),
        evidences: generalLossEvidences,
        remediationAdvice:
          'Slow down at critical turning points and calculate the opponent’s most forcing response before committing.',
      });
    }

    return patterns;
  }

  /**
   * Aggregates opening statistics with verified sample sizes and opening exit evaluations (moves 10-12).
   */
  private extractVerifiedOpeningStats(analyzedGames: AnalyzedGameRecord[]): VerifiedOpeningStat[] {
    const statsMap = new Map<
      string,
      {
        eco: string;
        games: AnalyzedGameRecord[];
        wins: number;
        losses: number;
        draws: number;
        exitEvals: number[];
        blunders: number;
      }
    >();

    for (const ag of analyzedGames) {
      const g = ag.game;
      const rawName = g.openingName?.trim();
      const rawEco = g.eco?.trim();
      const hasVerifiedName = Boolean(rawName && rawName.length > 0 && rawName !== 'Open Game' && rawName !== 'Unknown Opening');
      const opName = hasVerifiedName
        ? rawName!
        : (rawEco && rawEco !== 'A00' ? `Opening (${rawEco})` : 'Unknown Opening');
      const eco = (rawEco && rawEco !== 'A00')
        ? rawEco
        : (rawEco === 'A00' && hasVerifiedName ? 'A00' : '');

      const entry = statsMap.get(opName) || {
        eco,
        games: [],
        wins: 0,
        losses: 0,
        draws: 0,
        exitEvals: [],
        blunders: 0,
      };

      entry.games.push(ag);
      if (g.result === 'win') entry.wins++;
      else if (g.result === 'loss') entry.losses++;
      else entry.draws++;

      // Compute opening-exit evaluation from moves 10-12
      const exitMove = ag.analyzedMoves.find(m => m.moveNumber >= 10 && m.moveNumber <= 12);
      if (exitMove) {
        entry.exitEvals.push(exitMove.evalCpBefore);
      }

      // Count opening blunders (moves 1-12)
      const opBlunders = ag.analyzedMoves.filter(m => m.moveNumber <= 12 && m.judgment === 'blunder').length;
      entry.blunders += opBlunders;

      statsMap.set(opName, entry);
    }

    const result: VerifiedOpeningStat[] = [];

    statsMap.forEach((val, name) => {
      const sampleSize = val.games.length;
      const scorePct = Math.round(((val.wins + val.draws * 0.5) / sampleSize) * 100);
      const lossRatePct = Math.round((val.losses / sampleSize) * 100);
      const avgExitEval =
        val.exitEvals.length > 0
          ? Math.round(val.exitEvals.reduce((a, b) => a + b, 0) / val.exitEvals.length)
          : null;

      // Extract evidences from these games
      const evidences: DiagnosticEvidence[] = [];
      for (const ag of val.games) {
        for (const m of ag.analyzedMoves) {
          if (m.moveNumber <= 12 && m.evalLossCp >= 100) {
            evidences.push({
              gameId: ag.game.id,
              gameUrl: ag.game.url,
              opponentUsername: ag.game.opponentUsername,
              opponentRating: ag.game.opponentRating,
              userColor: ag.game.userColor,
              moveNumber: m.moveNumber,
              fenBefore: m.fenBefore,
              fenAfter: m.fenAfter,
              playedSan: m.san,
              bestMoveSan: m.bestMoveSan,
              evalLossCp: m.evalLossCp,
              expectedPointsLoss: m.expectedPointsLoss,
              grade: m.judgment,
              theme: 'Opening Repertoire Slip',
              phase: 'Opening',
            });
          }
        }
      }

      const isLeak = sampleSize >= 3 && scorePct <= 40 && evidences.length > 0 && name !== 'Unknown Opening' && name !== 'None';

      result.push({
        openingName: name,
        eco: val.eco,
        sampleSize,
        exitEvaluationSampleSize: val.exitEvals.length,
        wins: val.wins,
        losses: val.losses,
        draws: val.draws,
        scorePct,
        averageExitEvalCp: avgExitEval,
        blundersConceded: val.blunders,
        lossRatePct,
        isLeak,
        evidences,
      });
    });

    // Sort by sample size descending
    result.sort((a, b) => b.sampleSize - a.sampleSize);
    return result;
  }

  /**
   * Identifies recurring player weaknesses supported by concrete game references.
   */
  private extractRecurringWeaknesses(ctx: {
    totalGames: number;
    blundersPerGame: number;
    targetBlunders: number;
    tacticalPatterns: VerifiedTacticalPattern[];
    phases: VerifiedPhaseBreakdown;
    allEvidences: DiagnosticEvidence[];
    topLeakOpening: any;
    overallAccuracy: number;
    targetAccuracy: number;
    endgameConversionSlipCount?: number;
    endgameConversionEvidences?: DiagnosticEvidence[];
    timeTroubleEvidences?: DiagnosticEvidence[];
  }): VerifiedRecurringWeakness[] {
    const {
      totalGames,
      blundersPerGame,
      targetBlunders,
      tacticalPatterns,
      phases,
      allEvidences,
      topLeakOpening,
      endgameConversionSlipCount,
      endgameConversionEvidences,
      timeTroubleEvidences,
    } = ctx;

    const list: VerifiedRecurringWeakness[] = [];

    // Weakness 1: Only call blunders recurring when actual engine-graded blunders span multiple games.
    const blunderEvidences = allEvidences.filter(e => e.grade === 'blunder');
    const blunderGameCount = new Set(blunderEvidences.map(e => e.gameId)).size;
    if (blundersPerGame > targetBlunders && blunderGameCount >= 2) {
      const evidences = blunderEvidences;
      list.push({
        id: 'weak-blunders',
        category: 'blunders',
        title: 'Unforced Material Drops',
        description: `Conceding ${blundersPerGame} blunders per game (${totalGames} games analyzed). Opponents convert these opportunities with high precision.`,
        frequencyText: `${blundersPerGame} blunders / game`,
        measuredSeverity: blundersPerGame >= targetBlunders * 1.4 ? 'critical' : 'moderate',
        supportingGamesCount: new Set(evidences.map(e => e.gameId)).size,
        evidences,
        recommendedDrillType: 'hanging_pieces',
      });
    }

    // A recurring phase-loss concentration needs at least three losses and at least two in the phase.
    const phaseKey = phases.weakestPhase === 'Opening' ? 'opening' : phases.weakestPhase === 'Endgame' ? 'endgame' : 'middlegame';
    if (phases.isLossDataAvailable && phases.lossGamesSampleSize >= 3 && phases.lossGamesByPhase[phaseKey] >= 2 && phases.weakestPhaseLossPct >= 40) {
      const phaseEvs =
        phases.weakestPhase === 'Opening'
          ? phases.phaseEvidences.opening
          : phases.weakestPhase === 'Middlegame'
          ? phases.phaseEvidences.middlegame
          : phases.phaseEvidences.endgame;

      list.push({
        id: 'weak-phase',
        category: 'phases',
        title: `${phases.weakestPhase} Phase Disconnect`,
        description: `${phases.weakestPhaseLossPct}% of your defeats occurred in the ${phases.weakestPhase.toLowerCase()} phase.`,
        frequencyText: `${phases.weakestPhaseLossPct}% of total losses`,
        measuredSeverity: phases.weakestPhaseLossPct >= 50 ? 'critical' : 'moderate',
        supportingGamesCount: new Set(phaseEvs.map(e => e.gameId)).size,
        evidences: phaseEvs,
        recommendedDrillType: phases.weakestPhase === 'Endgame' ? 'endgame_basics' : 'tactics',
      });
    }

    // Weakness 3: Repertoire deficit
    if (topLeakOpening?.isLeak === true && topLeakOpening.gamesCount >= 3 && topLeakOpening.name !== 'None' && topLeakOpening.name !== 'Unknown Opening' && topLeakOpening.evidences?.length > 0) {
      list.push({
        id: 'weak-opening',
        category: 'openings',
        title: `Repertoire Leak in ${topLeakOpening.name}`,
        description: `Scored only ${topLeakOpening.scorePct}% in ${topLeakOpening.gamesCount} games with an average opening exit deficit of ${topLeakOpening.averageExitEvalCp} cp.`,
        frequencyText: `${topLeakOpening.scorePct}% score over ${topLeakOpening.gamesCount} games`,
        measuredSeverity: topLeakOpening.scorePct <= 30 ? 'critical' : 'moderate',
        supportingGamesCount: topLeakOpening.gamesCount,
        evidences: topLeakOpening.evidences || [],
        recommendedDrillType: 'opening_prep',
      });
    }

    // Weakness 4: Endgame Conversion Slip
    if (endgameConversionSlipCount && endgameConversionSlipCount >= 2 && endgameConversionEvidences && endgameConversionEvidences.length > 0) {
      list.push({
        id: 'weak-endgame-conversion',
        category: 'phases',
        title: 'Endgame Conversion Slip',
        description: `Established a +1.5+ pawn advantage entering the endgame (move 28+) in ${endgameConversionSlipCount} game(s) but conceded decisive evaluation drops resulting in missed wins.`,
        frequencyText: `${endgameConversionSlipCount} slipped conversion(s)`,
        measuredSeverity: 'critical',
        supportingGamesCount: endgameConversionSlipCount,
        evidences: endgameConversionEvidences || [],
        recommendedDrillType: 'endgame_basics',
      });
    }

    // Weakness 5: Tactical Blindspots (verified forks, pins, hanging pieces)
    const tacticalByMove = new Map<string, DiagnosticEvidence>();
    for (const ev of tacticalPatterns.filter(p => p.theme === 'hanging_piece' || p.theme === 'fork' || p.theme === 'pin').flatMap(p => p.evidences ?? p.sampleEvidences)) {
      const key = ev.gameId + ':' + ev.moveNumber;
      if (!tacticalByMove.has(key)) tacticalByMove.set(key, ev);
    }
    const tacticalEvs = Array.from(tacticalByMove.values());
    const tacticalGameCount = new Set(tacticalEvs.map(e => e.gameId)).size;
    if (tacticalEvs.length > 0 && tacticalGameCount >= 2) {
      list.push({
        id: 'weak-tactics',
        category: 'tactics',
        title: 'Tactical Blindspots & Piece Vulnerabilities',
        description: `Verified tactical slips occurred across ${new Set(tacticalEvs.map(e => e.gameId)).size} game(s), conceding forks, pins, or undefended pieces.`,
        frequencyText: `${tacticalEvs.length} verified tactical slips`,
        measuredSeverity: tacticalEvs.length >= 3 ? 'critical' : 'moderate',
        supportingGamesCount: new Set(tacticalEvs.map(e => e.gameId)).size,
        evidences: tacticalEvs,
        recommendedDrillType: 'tactics',
      });
    }

    // Weakness 6: Late-Game Time Trouble & Fatigue
    if (timeTroubleEvidences && timeTroubleEvidences.length >= 2 && new Set(timeTroubleEvidences.map(e => e.gameId)).size >= 2) {
      list.push({
        id: 'weak-time-trouble',
        category: 'blunders',
        title: 'Late-Game Mistakes (Move 35+)',
        description: `Engine-graded mistakes/blunders occurred after move 35 in ${new Set(timeTroubleEvidences.map(e => e.gameId)).size} separate games. Move number alone cannot establish clock trouble or calculation fatigue.`,
        frequencyText: `${timeTroubleEvidences.length} late-game errors`,
        measuredSeverity: 'moderate',
        supportingGamesCount: new Set(timeTroubleEvidences.map(e => e.gameId)).size,
        evidences: timeTroubleEvidences,
        recommendedDrillType: 'tactics',
      });
    }

    return list;
  }

  /**
   * Constructs ranked leaks for UI Slide 7.
   */
  private buildRankedLeaks(ctx: {
    blundersPerGame: number;
    targetBenchmark: any;
    targetMilestone: number;
    phases: VerifiedPhaseBreakdown;
    tacticalSummary: any;
    topLeakOpening: any;
    overallAccuracy: number;
    totalGames: number;
    endgameConversionSlipCount?: number;
    timeTroubleCount?: number;
  }): LeakItem[] {
    const {
      blundersPerGame,
      targetBenchmark,
      targetMilestone,
      phases,
      tacticalSummary,
      topLeakOpening,
      overallAccuracy,
      totalGames,
      endgameConversionSlipCount,
      timeTroubleCount,
    } = ctx;

    const candidates: Array<{
      id: string;
      category: 'blunders' | 'phases' | 'tactics' | 'openings' | 'accuracy';
      title: string;
      description: string;
      userMetric: string;
      userNumeric: number;
      targetMetric: string;
      targetNumeric: number;
      impactScore: number;
      severity: 'critical' | 'moderate' | 'minor';
      impact: string;
      coachTip: string;
    }> = [
      {
        id: 'leak-blunders',
        category: 'blunders',
        title: 'Unforced Blunders & Tactical Drops',
        description: `Across ${totalGames} games, ${blundersPerGame} blunders were detected per game. Target ${targetMilestone} players restrict this to ${targetBenchmark.expectedBlundersPerGame}.`,
        userMetric: `${blundersPerGame} / game`,
        userNumeric: blundersPerGame,
        targetMetric: `${targetBenchmark.expectedBlundersPerGame} / game`,
        targetNumeric: targetBenchmark.expectedBlundersPerGame,
        impactScore: (blundersPerGame / Math.max(0.1, targetBenchmark.expectedBlundersPerGame)) * 32,
        severity: (blundersPerGame > targetBenchmark.expectedBlundersPerGame * 1.3 ? 'critical' : 'moderate') as 'critical' | 'moderate' | 'minor',
        impact: 'This is a recurring pattern worth reviewing. Its effect on future rating depends on practice, opponents, time control, and other factors; no rating gain is predicted.',
        coachTip: `Before releasing any move, verify: "Is my destination square safe, and did I uncover an attack on my own pieces?"`,
      },
      {
        id: 'leak-phases',
        category: 'phases',
        title: phases.isLossDataAvailable
          ? `${phases.weakestPhase} Phase Breakdown`
          : `${phases.weakestPhase} Inaccuracies`,
        description: phases.isLossDataAvailable
          ? `${phases.weakestPhaseLossPct}% of your defeats occurred in the ${phases.weakestPhase.toLowerCase()}. Games slip away when transitioning into this phase.`
          : `Zero defeats were recorded in any phase across the analyzed games. Most move inaccuracies occurred in the ${phases.weakestPhase.toLowerCase()}.`,
        userMetric: phases.isLossDataAvailable
          ? `${phases.weakestPhaseLossPct}% of defeats`
          : `0 losses (N/A)`,
        userNumeric: phases.weakestPhaseLossPct,
        targetMetric: '< 35% concentration',
        targetNumeric: 35,
        impactScore: phases.isLossDataAvailable ? phases.weakestPhaseLossPct * 0.95 : 0,
        severity: (phases.weakestPhaseLossPct > 50 ? 'critical' : phases.isLossDataAvailable ? 'moderate' : 'minor') as 'critical' | 'moderate' | 'minor',
        impact: phases.isLossDataAvailable
          ? `You lose high-concentration games in the ${phases.weakestPhase.toLowerCase()} after reaching playable positions.`
          : 'No loss concentration observed across analyzed games.',
        coachTip:
          phases.weakestPhase === 'Opening'
            ? 'Stick strictly to opening principles: control center, develop knights/bishops, and castle before move 10.'
            : phases.weakestPhase === 'Middlegame'
            ? 'Avoid launching premature attacks when your king is uncastled or rooks are disconnected.'
            : 'Activate your king immediately in the endgame. A centralized king is worth 3 pawns.',
      },
      {
        id: 'leak-tactics',
        category: 'tactics',
        title: 'Tactical Blindspots & Piece Vulnerabilities',
        description:
          (tacticalSummary.hangingPiecesLostTotal > 0 || tacticalSummary.forkPinVulnerabilities > 0 || tacticalSummary.missedFreePiecesTotal > 0)
            ? `Move-by-move engine scanning detected ${tacticalSummary.hangingPiecesLostTotal} undefended piece(s) left vulnerable, ${tacticalSummary.forkPinVulnerabilities} fork/pin vulnerability(ies), and ${tacticalSummary.missedFreePiecesTotal} missed free piece opportunity(ies).`
            : `Tactical stability was maintained; evaluation swings were driven by positional decisions rather than dropped pieces.`,
        userMetric: `${tacticalSummary.hangingPiecesLostTotal + tacticalSummary.forkPinVulnerabilities} tactical vulnerabilities`,
        userNumeric: tacticalSummary.hangingPiecesLostTotal + tacticalSummary.forkPinVulnerabilities,
        targetMetric: `< ${Math.round(targetBenchmark.expectedHangingPiecesPerGame * totalGames)} pieces`,
        targetNumeric: Math.round(targetBenchmark.expectedHangingPiecesPerGame * totalGames),
        impactScore: tacticalSummary.hangingPiecesLostTotal * 3.5 + tacticalSummary.forkPinVulnerabilities * 2.5 + tacticalSummary.missedFreePiecesTotal * 1.5,
        severity: (tacticalSummary.hangingPiecesLostTotal > 4 || tacticalSummary.forkPinVulnerabilities > 3 ? 'critical' : (tacticalSummary.hangingPiecesLostTotal > 0 || tacticalSummary.forkPinVulnerabilities > 0) ? 'moderate' : 'minor') as 'critical' | 'moderate' | 'minor',
        impact: 'Improving tactical awareness is a practical training focus. This analysis does not estimate how many rating points it may produce.',
        coachTip: 'Always calculate Checks, Captures, and Attacks for BOTH players before executing a move.',
      },
      {
        id: 'leak-openings',
        category: 'openings',
        title: topLeakOpening.isLeak === true
          ? `Evidence-Backed Opening Errors: ${topLeakOpening.name}`
          : 'Opening Score Snapshot (No Recurring Leak Confirmed)',
        description: topLeakOpening.isLeak === true
          ? `Scored ${topLeakOpening.scorePct}% across ${topLeakOpening.gamesCount} games with ${topLeakOpening.evidences?.length ?? 0} engine-reviewed opening error position(s).`
          : `Highest-volume opening: ${topLeakOpening.name} (${topLeakOpening.gamesCount} game(s), ${topLeakOpening.scorePct}% score). A recurring leak requires at least 3 games and linked engine-reviewed opening errors.`,
        userMetric: `${topLeakOpening.scorePct}% score`,
        userNumeric: topLeakOpening.scorePct,
        targetMetric: '52% balanced',
        targetNumeric: 52,
        impactScore: topLeakOpening.isLeak === true ? (100 - topLeakOpening.scorePct) * 0.55 : 0,
        severity: (topLeakOpening.scorePct < 35 ? 'critical' : 'moderate') as 'critical' | 'moderate' | 'minor',
        impact: topLeakOpening.isLeak === true ? 'The outcome pattern has linked reviewed positions but does not establish a cause of future losses.' : 'Not enough repeated, position-linked evidence to diagnose an opening weakness.',
        coachTip: topLeakOpening.advice || 'Study standard book lines 3–8 to reach balanced positions.',
      },
      {
        id: 'leak-accuracy',
        category: 'accuracy',
        title: 'Overall Move Accuracy Gap',
        description: `Your average accuracy across ${totalGames} games was ${overallAccuracy}%. Players at ${targetMilestone} achieve ${targetBenchmark.expectedAccuracy}%.`,
        userMetric: `${overallAccuracy}%`,
        userNumeric: overallAccuracy,
        targetMetric: `${targetBenchmark.expectedAccuracy}%`,
        targetNumeric: targetBenchmark.expectedAccuracy,
        impactScore: Math.max(0, targetBenchmark.expectedAccuracy - overallAccuracy) * 3.5,
        severity: (overallAccuracy < targetBenchmark.expectedAccuracy - 5 ? 'critical' : overallAccuracy < targetBenchmark.expectedAccuracy ? 'moderate' : 'minor') as 'critical' | 'moderate' | 'minor',
        impact: `The MoveWisely score is ${(targetBenchmark.expectedAccuracy - overallAccuracy).toFixed(1)} points below its internal reference benchmark. This is not a measured cause of rating loss.`,
        coachTip: 'Accuracy increases dramatically when you eliminate speculative 1-move attacks and prioritize piece harmony.',
      },
    ];

    if (endgameConversionSlipCount && endgameConversionSlipCount > 0) {
      candidates.push({
        id: 'leak-endgame-conversion',
        category: 'phases',
        title: 'Endgame Advantage Conversion Slip',
        description: `In ${endgameConversionSlipCount} game(s), you established an advantage of +1.5+ pawns entering the endgame (move 28+) but subsequently conceded evaluation drops resulting in missed wins.`,
        userMetric: `${endgameConversionSlipCount} slipped conversion(s)`,
        userNumeric: endgameConversionSlipCount,
        targetMetric: '0 slipped conversions',
        targetNumeric: 0,
        impactScore: endgameConversionSlipCount * 28,
        severity: 'critical',
        impact: 'Converting decisive advantages in the endgame requires patient king centralization and pawn structure care.',
        coachTip: 'When up material in the endgame, activate your king immediately and eliminate opponent counterplay before rushing pawn pushes.',
      });
    }

    if (timeTroubleCount && timeTroubleCount >= 2) {
      candidates.push({
        id: 'leak-time-trouble',
        category: 'blunders',
        title: 'Late-Game Clock & Calculation Stress',
        description: `Across analyzed games, ${timeTroubleCount} blunders or mistakes occurred past move 35, indicating calculation fatigue or severe time trouble.`,
        userMetric: `${timeTroubleCount} late-game errors`,
        userNumeric: timeTroubleCount,
        targetMetric: '< 2 late errors',
        targetNumeric: 1,
        impactScore: timeTroubleCount * 20,
        severity: 'moderate',
        impact: 'Late-game calculation breakdowns can turn winning or drawn games into losses.',
        coachTip: 'Manage clock time proactively in the middlegame so you have sufficient time for critical late-game moves.',
      });
    }

    candidates.sort((a, b) => b.impactScore - a.impactScore);

    return candidates.map((l, index) => ({
      id: l.id,
      category: l.category,
      rank: index + 1,
      title: l.title,
      description: l.description,
      userMetric: l.userMetric,
      userNumeric: l.userNumeric,
      targetMetric: l.targetMetric,
      targetNumeric: l.targetNumeric,
      severity: l.severity,
      impact: l.impact,
      coachTip: l.coachTip,
    }));
  }

  /**
   * Generates personalized training tasks based on verified recurring errors.
   */
  private generateVerifiedActionPlan(ctx: {
    userRating: number;
    targetMilestone: number;
    timeControl: string;
    blundersPerGame: number;
    targetBlunders: number;
    hangingPieces: number;
    missedFreePieces: number;
    weakestPhase: 'Opening' | 'Middlegame' | 'Endgame';
    weakestPhaseLossPct: number;
    topLeakOpening: any;
    recurringWeaknesses: VerifiedRecurringWeakness[];
  }): ActionPlanTask[] {
    const {
      userRating,
      targetMilestone,
      timeControl,
      blundersPerGame,
      targetBlunders,
      hangingPieces,
      missedFreePieces,
      weakestPhase,
      weakestPhaseLossPct,
      topLeakOpening,
    } = ctx;

    const tasks: ActionPlanTask[] = [];

    // TASK 1: Blunder / Hanging Piece reduction
    if (userRating < 1100 || hangingPieces >= 5) {
      tasks.push({
        id: 'task-board-vision',
        title: `The 3-Second Board Scan (${hangingPieces} pieces hung in analyzed games)`,
        duration: '5 min',
        frequency: 'Every game session',
        description: `Verified ${hangingPieces} undefended pieces left attacked. Before making any move: stop for 3 seconds, scan all 4 corners of the board, and ask "Is my destination square defended?"`,
        drillType: 'hanging_pieces',
        completed: false,
      });
    } else {
      tasks.push({
        id: 'task-tactical-curb',
        title: `Curb Fatal Blunders: Currently ${blundersPerGame}/game (Target: ${targetBlunders})`,
        duration: '10 min',
        frequency: 'Before playing rated games',
        description: `Surrendering ${blundersPerGame} blunders per game is the primary barrier to ${targetMilestone}. Solve 10 rated tactical puzzles daily focusing on double attacks, pins, and undefended minor pieces.`,
        drillType: 'tactics',
        completed: false,
      });
    }

    // TASK 2: Attack on Weakest Phase
    if (weakestPhase === 'Opening') {
      tasks.push({
        id: 'task-opening-phase',
        title: `Castle Before Move 10 Rule (${weakestPhaseLossPct}% defeats in Opening)`,
        duration: '10 min',
        frequency: 'Daily review',
        description: `${weakestPhaseLossPct}% of your defeats occurred in the opening. Prioritize central pawn occupation, rapid minor piece development, and kingside castling.`,
        drillType: 'opening_prep',
        completed: false,
      });
    } else if (weakestPhase === 'Endgame') {
      tasks.push({
        id: 'task-endgame-clinic',
        title: `Endgame Conversion Clinic (${weakestPhaseLossPct}% of losses in Endgame)`,
        duration: '15 min',
        frequency: '3x a week',
        description: `${weakestPhaseLossPct}% of your lost battles slipped away in the endgame. Drill basic Rook and King-and-Pawn endgames: active King, passed pawns, and opposition.`,
        drillType: 'endgame_basics',
        completed: false,
      });
    } else {
      tasks.push({
        id: 'task-middlegame-anchor',
        title: `Middlegame Anchor: ${weakestPhaseLossPct}% of your losses happen moves 13–29`,
        duration: '15 min',
        frequency: 'Daily',
        description: `You reach equal positions, then lose coordination in the middlegame. Practice maintaining piece harmony and defending loose pieces before launching pawn breaks.`,
        drillType: 'tactics',
        completed: false,
      });
    }

    // TASK 3: Worst Opening Repertoire Patch
    tasks.push({
      id: 'task-opening-repertoire',
      title: topLeakOpening?.isLeak === true ? `Review Engine-Verified Errors in ${topLeakOpening.name}` : 'Build an Opening Review Sample',
      duration: '20 min',
      frequency: 'Once this week',
      description: topLeakOpening?.isLeak === true
        ? `Across ${topLeakOpening.gamesCount} games, the score was ${topLeakOpening.scorePct}% and ${topLeakOpening.evidences?.length ?? 0} reviewed opening-error position(s) were attached. Study these positions first.`
        : 'No recurring opening leak met the minimum evidence rule. Save and review positions before changing your repertoire.',
      drillType: 'opening_prep',
      completed: false,
    });

    // TASK 4: Missed Tactics or Clock Discipline
    if (missedFreePieces >= 3) {
      tasks.push({
        id: 'task-free-pieces',
        title: `Punish Opponent Mistakes (${missedFreePieces} free pieces overlooked)`,
        duration: '15 min',
        frequency: 'Daily',
        description: `Your opponents left free undefended material on the board ${missedFreePieces} times that went unpunished. Train yourself to look for undefended enemy pieces every single turn.`,
        drillType: 'tactics',
        completed: false,
      });
    } else {
      tasks.push({
        id: 'task-speed-control',
        title: `Clock & Calculation Discipline in ${timeControl.toUpperCase()}`,
        duration: '25 min',
        frequency: 'Twice a week',
        description: `Fast time controls encourage impulsive moves. Play 2 slower 10+0 or 15+10 games weekly to verify multi-move tactical candidates with real clock time.`,
        drillType: 'tactics',
        completed: false,
      });
    }

    return tasks;
  }

  /**
   * Helper to return clean insufficient data state.
   */
  private createInsufficientDataResult(
    username: string,
    platform: Platform,
    timeControl: TimeControl,
    userRating: number,
    importedGamesCount: number,
    exclusionReasons: Array<{ gameId: string; reason: string }>,
    insufficientDataReason: string,
    status: AnalysisStatus = 'failed',
    partialGamesCount: number = 0,
    failedGamesCount: number = importedGamesCount
  ): PlayerDiagnosticsResult {
    const currentRating = userRating;
    const targetMilestone = getNextMilestone(currentRating);
    const targetBenchmark = getBenchmarkForRating(targetMilestone);

    return {
      username,
      platform,
      timeControl,
      analyzedAt: new Date().toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      }),
      status,
      statusMessage: insufficientDataReason,
      attemptedGamesCount: importedGamesCount,
      completedGamesCount: 0,
      partialGamesCount,
      failedGamesCount,
      engineVersion: 'Stockfish 19 Lite WASM',
      scoringVersion: ACCURACY_ENGINE_VERSION,
      importedGamesCount,
      analyzedGamesCount: 0,
      excludedGamesCount: exclusionReasons.length,
      exclusionReasons,
      isInsufficientData: true,
      insufficientDataReason,
      wins: 0,
      losses: 0,
      draws: 0,
      winRate: 0,
      currentRating,
      targetMilestone,
      targetDistance: targetMilestone - currentRating,
      overallAccuracy: 0,
      harmonicAccuracy: 0,
      targetRatingAccuracy: targetBenchmark.expectedAccuracy,
      averageCentipawnLoss: 0,
      averageExpectedPointsLoss: 0,
      totalAnalyzedMoves: 0,
      gradeDistribution: {},
      totalBlunders: 0,
      blundersPerGame: 0,
      targetBlundersPerGame: targetBenchmark.expectedBlundersPerGame,
      totalMistakes: 0,
      mistakesPerGame: 0,
      totalInaccuracies: 0,
      tacticalPatterns: [],
      tacticalSummary: {
        hangingPiecesLostTotal: 0,
        missedFreePiecesTotal: 0,
        forkPinVulnerabilities: 0,
        tacticalLeakScore: 0,
      },
      phases: {
        openingLossesPct: 0,
        middlegameLossesPct: 0,
        endgameLossesPct: 0,
        openingErrorsCount: 0,
        middlegameErrorsCount: 0,
        endgameErrorsCount: 0,
        weakestPhase: 'Middlegame',
        weakestPhaseLossPct: 0,
        lossGamesSampleSize: 0,
        lossGamesByPhase: { opening: 0, middlegame: 0, endgame: 0 },
        explanation: 'Insufficient games to compute phase errors.',
        isLossDataAvailable: false,
        phaseEvidences: { opening: [], middlegame: [], endgame: [] },
      },
      openings: [],
      whiteWinRate: 0,
      blackWinRate: 0,
      mostFrequentOpening: 'None',
      topLeakOpening: {
        name: 'None',
        gamesCount: 0,
        scorePct: 0,
        advice: 'Play more games to unlock opening diagnostics.',
        averageExitEvalCp: null,
          exitEvaluationSampleSize: 0,
      },
      recurringWeaknesses: [],
      spotlightMove: null,
      emotionalVerdict: {
        headline: 'Insufficient Game Data',
        statement: insufficientDataReason,
        subtitle: 'Play at least 3-5 rated games to generate your diagnostic report.',
        leaksCount: 0,
        isReadyForMilestone: false,
      },
      leaks: [],
      actionPlan: {
        milestone: targetMilestone,
        projectedRatingGain: null,
        estimatedWeeks: null,
        coreFocus: 'Play more games to generate diagnostic report.',
        tasks: [],
      },
      analyzedGameRecords: [],
      rawGames: [],
    };
  }
}

export const playerDiagnosticsService = new PlayerDiagnosticsService();
