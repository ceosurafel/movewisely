/**
 * Automated Verification Test Suite for MoveWisely Phase 4
 * Engine-Driven Player Diagnostics
 *
 * Verifies:
 * 1. Multi-game analysis aggregation across verified games from Phases 2 and 3
 * 2. Unblended move classifications and accuracy without rating benchmarks
 * 3. Wins, losses, draws, win rate, and analyzed-game counts
 * 4. Blunders and evaluation-loss statistics per game
 * 5. Verified tactical patterns & missed opportunities
 * 6. Phase-based errors tied to actual move positions
 * 7. Opening statistics with sample sizes and opening-exit evaluations
 * 8. Recurring weaknesses with supporting game and move references
 * 9. Personalized training tasks based on verified recurring errors
 * 10. Insufficient data handling and exclusion of unparseable/corrupt games
 * 11. Preservation of existing data structures and backward compatibility
 */

import { createRequire } from 'module';

// Polyfill Web Worker for Node test environment with authentic async dispatch
if (typeof Worker === 'undefined') {
  const require = createRequire(import.meta.url);

  class NodeStockfishWorker {
    private engine: any;
    public onmessage: ((e: { data: string }) => void) | null = null;
    public onerror: ((e: any) => void) | null = null;

    constructor() {
      for (const k in require.cache) {
        if (k.includes('stockfish')) delete require.cache[k];
      }
      const initStockfish = require('stockfish');
      this.engine = initStockfish('lite-single', (line: string) => {
        setTimeout(() => {
          if (this.onmessage) {
            this.onmessage({ data: line });
          }
        }, 0);
      });
    }

    postMessage(cmd: string) {
      setTimeout(() => {
        try {
          this.engine.processCommand(cmd);
        } catch (err) {
          if (this.onerror) this.onerror(err);
        }
      }, 0);
    }

    terminate() {
      this.engine = null;
      this.onmessage = null;
    }
  }

  (globalThis as any).Worker = NodeStockfishWorker;
}

import { playerDiagnosticsService } from '../src/services/playerDiagnosticsService';
import { estimateRatingTimeline } from '../src/services/ratingTimelineService';
import { SAMPLE_PROFILES } from '../src/services/sampleData';
import { GameRecord } from '../src/types/chess';

async function runPhase4Tests() {
  console.log('================================================================');
  console.log('🧪 RUNNING MOVEWISELY PHASE 4: PLAYER DIAGNOSTICS TEST SUITE');
  console.log('================================================================\n');

  let passed = 0;
  let total = 0;

  function assert(condition: boolean, message: string) {
    total++;
    if (!condition) {
      console.error(`❌ FAIL: ${message}`);
      throw new Error(`Assertion failed: ${message}`);
    }
    passed++;
    console.log(`✅ PASS: ${message}`);
  }

  // -------------------------------------------------------------
  // TEST 1: Full Diagnostics Run on Valid Player Match History
  // -------------------------------------------------------------
  console.log('\n--- TEST 1: Multi-Game Review & Record Aggregation ---');
  const sampleProfile = SAMPLE_PROFILES[0]; // Alex 1140 Rapid
  const testGames = sampleProfile.games.slice(0, 5); // 5 games for deterministic quick test

  const diagnostics = await playerDiagnosticsService.diagnosePlayer(
    sampleProfile.username,
    sampleProfile.platform,
    sampleProfile.timeControl,
    sampleProfile.rating,
    testGames
  );

  assert(diagnostics.analyzedGamesCount === 5, 'Analyzed games count matches 5');
  assert(diagnostics.wins + diagnostics.losses + diagnostics.draws === 5, 'Record sum equals total games');
  assert(diagnostics.winRate >= 0 && diagnostics.winRate <= 100, `Win rate is valid percentage: ${diagnostics.winRate}%`);
  assert(!diagnostics.isInsufficientData, 'Sufficient data flag is false for 5 valid games');

  // -------------------------------------------------------------
  // TEST 2: Pure Move Classifications & Traceable Accuracy
  // -------------------------------------------------------------
  console.log('\n--- TEST 2: Move Classifications & Unblended Accuracy ---');
  assert(diagnostics.totalAnalyzedMoves > 0, `Total analyzed moves > 0: ${diagnostics.totalAnalyzedMoves}`);
  assert(diagnostics.overallAccuracy >= 20 && diagnostics.overallAccuracy <= 100, `Overall accuracy within bounds: ${diagnostics.overallAccuracy}%`);
  assert(typeof diagnostics.averageCentipawnLoss === 'number', `Centipawn loss calculated: ${diagnostics.averageCentipawnLoss} cp`);
  assert(typeof diagnostics.averageExpectedPointsLoss === 'number', `Expected points loss calculated: ${diagnostics.averageExpectedPointsLoss}`);

  const totalGrades = Object.values(diagnostics.gradeDistribution).reduce((a, b) => a + b, 0);
  assert(totalGrades === diagnostics.totalAnalyzedMoves, `Grade distribution sum (${totalGrades}) matches total analyzed moves (${diagnostics.totalAnalyzedMoves})`);

  // -------------------------------------------------------------
  // TEST 3: Blunders & Evaluation Loss Statistics
  // -------------------------------------------------------------
  console.log('\n--- TEST 3: Blunders & Loss Statistics Per Game ---');
  assert(typeof diagnostics.totalBlunders === 'number', `Total blunders is numeric: ${diagnostics.totalBlunders}`);
  assert(diagnostics.blundersPerGame >= 0, `Blunders per game is non-negative: ${diagnostics.blundersPerGame}`);
  assert(diagnostics.blundersPerGame === parseFloat((diagnostics.totalBlunders / 5).toFixed(1)), 'Blunders per game is strictly totalBlunders / totalGames');

  // -------------------------------------------------------------
  // TEST 4: Verified Tactical Patterns & Missed Opportunities
  // -------------------------------------------------------------
  console.log('\n--- TEST 4: Verified Tactical Patterns ---');
  assert(Array.isArray(diagnostics.tacticalPatterns), 'Tactical patterns is an array');
  assert(typeof diagnostics.tacticalSummary.hangingPiecesLostTotal === 'number', 'Hanging pieces total is numeric');
  assert(typeof diagnostics.tacticalSummary.missedFreePiecesTotal === 'number', 'Missed free pieces total is numeric');

  // Verify that any detected pattern has concrete supporting evidence
  for (const pattern of diagnostics.tacticalPatterns) {
    assert(pattern.occurrences > 0, `Pattern ${pattern.id} occurrences > 0`);
    assert(pattern.sampleEvidences.length > 0, `Pattern ${pattern.id} has supporting game evidences`);
    const firstEv = pattern.sampleEvidences[0];
    assert(Boolean(firstEv.gameId && firstEv.fenBefore && firstEv.playedSan), `Evidence has gameId, FEN, and played SAN: ${firstEv.playedSan}`);
  }

  // -------------------------------------------------------------
  // TEST 5: Phase-Based Errors Tied to Actual Positions
  // -------------------------------------------------------------
  console.log('\n--- TEST 5: Phase Breakdown Tied to Actual Moves ---');
  const phases = diagnostics.phases;
  assert(['Opening', 'Middlegame', 'Endgame'].includes(phases.weakestPhase), `Weakest phase is recognized: ${phases.weakestPhase}`);
  assert(phases.openingLossesPct + phases.middlegameLossesPct + phases.endgameLossesPct <= 101, 'Phase losses sum to ~100%');
  assert(Array.isArray(phases.phaseEvidences.opening), 'Opening phase evidences array exists');
  assert(Array.isArray(phases.phaseEvidences.middlegame), 'Middlegame phase evidences array exists');
  assert(Array.isArray(phases.phaseEvidences.endgame), 'Endgame phase evidences array exists');
  assert(phases.lossGamesSampleSize === diagnostics.losses, 'Phase loss denominator matches completed recorded losses');
  assert(phases.lossGamesByPhase.opening + phases.lossGamesByPhase.middlegame + phases.lossGamesByPhase.endgame === diagnostics.losses, 'Per-phase loss counts sum exactly to recorded losses');

  // -------------------------------------------------------------
  // TEST 6: Opening Statistics with Sample Sizes & Exit Evals
  // -------------------------------------------------------------
  console.log('\n--- TEST 6: Opening Statistics & Exit Evaluations ---');
  assert(Array.isArray(diagnostics.openings), 'Openings list is an array');
  assert(diagnostics.openings.length > 0, 'At least 1 opening identified from games');

  const topOpening = diagnostics.openings[0];
  assert(topOpening.sampleSize > 0, `Top opening ${topOpening.openingName} has sample size > 0: ${topOpening.sampleSize}`);
  assert(topOpening.exitEvaluationSampleSize >= 0 && topOpening.exitEvaluationSampleSize <= topOpening.sampleSize, 'Exit-evaluation sample is bounded by opening game sample');
  assert(topOpening.exitEvaluationSampleSize === 0 ? topOpening.averageExitEvalCp === null : typeof topOpening.averageExitEvalCp === 'number', 'Missing exit positions are null, not fabricated equal evaluations');
  assert(topOpening.scorePct >= 0 && topOpening.scorePct <= 100, `Opening score is valid percentage: ${topOpening.scorePct}%`);
  assert(diagnostics.openings.every(opening => !opening.isLeak || (
    opening.sampleSize >= 3 &&
    opening.scorePct <= 40 &&
    opening.evidences.length > 0 &&
    new Set(opening.evidences.map(e => e.gameId)).size >= 2
  )), 'Opening leak requires 3+ games, low score, and opening-error evidence in at least 2 distinct games');

  // -------------------------------------------------------------
  // TEST 7: Recurring Weaknesses with Supporting References
  // -------------------------------------------------------------
  console.log('\n--- TEST 7: Recurring Weaknesses with References ---');
  assert(Array.isArray(diagnostics.recurringWeaknesses), 'Recurring weaknesses is an array');
  for (const weakness of diagnostics.recurringWeaknesses) {
    assert(Boolean(weakness.title && weakness.category && weakness.frequencyText), `Weakness has title, category, frequencyText: ${weakness.title}`);
    assert(weakness.supportingGamesCount >= 2, `Recurring weakness has evidence from at least 2 distinct games: ${weakness.supportingGamesCount}`);
    assert(Number.isInteger(weakness.sampleGamesCount) && weakness.sampleGamesCount >= weakness.supportingGamesCount, `Evidence denominator covers supporting games: ${weakness.supportingGamesCount}/${weakness.sampleGamesCount}`);
    assert(weakness.supportingMovesCount === weakness.evidences.length, `Move evidence count matches linked positions: ${weakness.supportingMovesCount}`);
    assert(weakness.supportingGameRatePct === Math.round((weakness.supportingGamesCount / Math.max(1, weakness.sampleGamesCount)) * 100), 'Supporting-game coverage matches the explicit denominator');
    assert(weakness.minimumSupportingGamesRequired >= 2 && Boolean(weakness.evidenceRule), 'Recurrence threshold and rule are exposed');
    assert(new Set(weakness.evidences.map(e => e.gameId)).size === weakness.supportingGamesCount, 'Supporting-game count matches distinct evidence game IDs');
    for (const evidence of weakness.evidences) assert(Boolean(evidence.gameId && evidence.fenBefore && evidence.playedSan && evidence.bestMoveSan), `Evidence points to a reviewed position: ${evidence.gameId}`);
    if (weakness.id === 'weak-phase') {
      assert(diagnostics.losses >= 3 && weakness.sampleGamesCount === diagnostics.losses, 'Phase recurrence denominator is completed losses and requires at least 3');
      assert(weakness.supportingGamesCount >= 2, 'Phase recurrence needs engine evidence from at least 2 distinct loss games');
    }
    if (weakness.id === 'weak-opening') {
      assert(diagnostics.topLeakOpening.isLeak === true && weakness.supportingGamesCount >= 2, 'Opening recurrence requires evidence-backed opening leak in at least 2 games');
    }
    if (weakness.id === 'weak-late-game-errors') assert(/Move number alone cannot establish clock trouble or calculation fatigue/i.test(weakness.description), 'Late-game finding explicitly disclaims unsupported clock/fatigue inference');
    if (weakness.id === 'weak-endgame-conversion') assert(/Move number alone does not confirm a formal endgame/i.test(weakness.description), 'Move 28+ is not falsely treated as proof of a formal endgame');
  }

  // -------------------------------------------------------------
  // TEST 8: Personalized Action Plan Based on Verified Errors
  // -------------------------------------------------------------
  console.log('\n--- TEST 8: Personalized Action Plan Tasks ---');
  assert(diagnostics.actionPlan.tasks.length >= 3, `Action plan has at least 3 tasks: ${diagnostics.actionPlan.tasks.length}`);
  for (const task of diagnostics.actionPlan.tasks) {
    assert(Boolean(task.id && task.title && task.description && task.duration), `Task has required fields: ${task.title}`);
    assert(Boolean(task.priority && task.frequency && task.evidenceSummary), `Task has priority, cadence, and evidence/baseline explanation: ${task.title}`);
    if (task.sourceWeaknessId) {
      assert((task.evidencePositionCount ?? 0) > 0 && (task.evidenceGameCount ?? 0) >= 2, `Evidence-backed task traces to positions in 2+ games: ${task.title}`);
    }
  }
  assert(diagnostics.actionPlan.ratingTimeline.status === 'insufficient-history', 'Five-game demo sample does not invent a rating ETA');

  const trendGames: GameRecord[] = Array.from({ length: 16 }, (_, i) => {
    const rating = 1500 + i * 5;
    const date = new Date(Date.UTC(2026, 0, 1 + i * 4)).toISOString().slice(0, 10);
    return {
      id: `trend-${i}`,
      url: 'https://www.chess.com/game/live/123456',
      white: { username: 'TrendPlayer', rating, result: 'win' },
      black: { username: 'Opponent', rating: 1500, result: 'loss' },
      userColor: 'white',
      userRating: rating,
      opponentUsername: 'Opponent',
      opponentRating: 1500,
      result: 'win',
      termination: 'normal',
      timeControl: 'rapid',
      timeClass: 'rapid',
      date,
      pgn: '1. e4 e5 2. Nf3 Nc6',
      movesCount: 4,
    } satisfies GameRecord;
  });
  const timelineWithHistory = estimateRatingTimeline(trendGames, 1575, 1700);
  assert(timelineWithHistory.status === 'estimate-available', 'A dated positive trend meeting minimum sample requirements produces a caveated ETA range');
  assert(
    timelineWithHistory.estimateRangeWeeks !== null
      && timelineWithHistory.estimateRangeWeeks.min <= timelineWithHistory.estimatedWeeks!
      && timelineWithHistory.estimatedWeeks! <= timelineWithHistory.estimateRangeWeeks.max,
    'Estimated weeks stays within the broad historical-pace scenario range'
  );
  const timelineWithoutTrend = estimateRatingTimeline(trendGames.slice(0, 5), 1520, 1700);
  assert(timelineWithoutTrend.status === 'insufficient-history', 'Sparse dated ratings refuse timeline extrapolation');
  const demoOnlyTimeline = estimateRatingTimeline(trendGames.map(game => ({ ...game, isSynthetic: true })), 1575, 1700);
  assert(demoOnlyTimeline.status === 'insufficient-history' && demoOnlyTimeline.sampleGamesCount === 0, 'Synthetic/demo games are never used to estimate rating progress');

  // -------------------------------------------------------------
  // TEST 9: Insufficient Data & Corrupt Game Exclusion
  // -------------------------------------------------------------
  console.log('\n--- TEST 9: Insufficient Data & Corrupt PGN Handling ---');
  // Pass empty list
  const emptyDiag = await playerDiagnosticsService.diagnosePlayer('EmptyPlayer', 'chesscom', 'rapid', 1200, []);
  assert(emptyDiag.isInsufficientData === true, 'Empty games array returns isInsufficientData = true');
  assert(emptyDiag.analyzedGamesCount === 0, 'Analyzed games count is 0');
  assert(emptyDiag.emotionalVerdict.headline.includes('Insufficient'), 'Headline notes insufficient data');

  // Pass corrupt PGN
  const corruptGames: GameRecord[] = [
    {
      id: 'corrupt-1',
      url: 'https://chess.com',
      white: { username: 'A', rating: 1200, result: 'win' },
      black: { username: 'B', rating: 1200, result: 'loss' },
      userColor: 'white',
      userRating: 1200,
      opponentUsername: 'B',
      opponentRating: 1200,
      result: 'win',
      termination: 'normal',
      timeControl: 'rapid',
      timeClass: 'rapid',
      date: '2026-10-01',
      pgn: 'NOT A VALID PGN 99999999 INVALID',
      movesCount: 1,
    },
  ];

  const corruptDiag = await playerDiagnosticsService.diagnosePlayer('CorruptPlayer', 'chesscom', 'rapid', 1200, corruptGames);
  assert(corruptDiag.excludedGamesCount === 1, 'Corrupt game was excluded');
  assert(corruptDiag.exclusionReasons.length === 1, 'Exclusion reason was recorded');
  assert(corruptDiag.isInsufficientData === true, 'Insufficient data triggered after excluding corrupt game');

  // -------------------------------------------------------------
  // TEST 10: Backward Compatibility with CheckupAnalysis
  // -------------------------------------------------------------
  console.log('\n--- TEST 10: Backward Compatibility Adapter ---');
  const checkup = playerDiagnosticsService.toCheckupAnalysis(diagnostics);
  assert(checkup.username === sampleProfile.username, 'Adapter maintains username');
  assert(checkup.accuracy === diagnostics.overallAccuracy, 'Adapter accuracy matches diagnostics overall accuracy');
  assert(checkup.blundersPerGame === diagnostics.blundersPerGame, 'Adapter blundersPerGame matches diagnostics');
  assert(checkup.leaks.length > 0, 'Adapter contains ranked leaks');
  assert(checkup.actionPlan.tasks.length > 0, 'Adapter contains action plan tasks');
  assert(Boolean(checkup.spotlightMove && checkup.spotlightMove.bestMoveSan), 'Adapter contains spotlight move');

  // -------------------------------------------------------------
  // TEST 11: Phase 7 Diagnostic Integrity & Zero-Loss Invariant
  // -------------------------------------------------------------
  console.log('\n--- TEST 11: Phase 7 Diagnostic Integrity Verification ---');
  // 11.1: Player with 0 losses
  const winGames = testGames.filter(g => g.result === 'win');
  if (winGames.length >= 2) {
    const zeroLossDiag = await playerDiagnosticsService.diagnosePlayer(
      'UndefeatedPlayer',
      'chesscom',
      'rapid',
      1500,
      winGames
    );
    assert(zeroLossDiag.losses === 0, 'Player has 0 losses');
    assert(zeroLossDiag.phases.isLossDataAvailable === false, 'isLossDataAvailable is false for 0 losses');
    assert(zeroLossDiag.phases.endgameLossesPct === 0, `Endgame losses % is 0% (never manufactured 100%): ${zeroLossDiag.phases.endgameLossesPct}%`);
    assert(zeroLossDiag.phases.openingLossesPct === 0, 'Opening losses % is 0%');
    assert(zeroLossDiag.phases.middlegameLossesPct === 0, 'Middlegame losses % is 0%');
    assert(zeroLossDiag.phases.weakestPhaseLossPct === 0, 'Weakest phase loss % is 0%');
    assert(zeroLossDiag.phases.explanation.includes('not applicable'), 'Explanation states phase losses are not applicable');
  }

  // 11.2: Unrecognized opening metadata
  const unverifiedOpeningGame: GameRecord = {
    ...testGames[0],
    id: 'unverified-op-1',
    openingName: undefined,
    eco: undefined,
  };
  const unverifiedDiag = await playerDiagnosticsService.diagnosePlayer(
    'UnknownOpeningPlayer',
    'chesscom',
    'rapid',
    1200,
    [unverifiedOpeningGame]
  );
  assert(unverifiedDiag.openings.length > 0, 'Opening list exists');
  const reportedOpening = unverifiedDiag.openings[0];
  assert(reportedOpening.openingName === 'Unknown Opening', `Unverified opening is 'Unknown Opening' (not 'Open Game'): ${reportedOpening.openingName}`);
  assert(reportedOpening.eco === '', `Unverified eco is empty string (not 'A00'): '${reportedOpening.eco}'`);

  console.log('\n================================================================');
  console.log(`🎉 ALL PHASE 4 TESTS PASSED! (${passed}/${total})`);
  console.log('================================================================\n');
}

runPhase4Tests().catch(err => {
  console.error('Test Suite Failed:', err);
  process.exit(1);
});
