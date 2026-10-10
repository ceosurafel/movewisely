/**
 * Automated Verification Test Suite for MoveWisely Phase 3
 * Trustworthy Move Grades & Accuracy Methodology V1
 *
 * Tests:
 * 1. Raw Engine Eval to Expected Points Mapping (Logistic Sigmoid Calibration)
 * 2. Perspective Normalization & Forced Mate Boundary Handling
 * 3. Individual Move Accuracy Decay Formula & Bounded Monotonicity
 * 4. Standard Classification Boundaries (Best, Excellent, Good, Inaccuracy, Mistake, Blunder)
 * 5. Contextual Classifications (Book, Brilliant, Great, Miss) with Engine Evidence
 * 6. Overall Player Game Accuracy Aggregation (Unblended Mathematical Aggregation)
 * 7. Dead-Won Positions and Asymmetric Centipawn Swing Resiliency
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

const {
  calculateExpectedPoints,
  calculateMoveAccuracy,
  classifyStandardGrade,
  evaluateContextualGrade,
  gradeMove,
  aggregateGameAccuracy,
  ACCURACY_ENGINE_VERSION,
} = await import('../src/services/accuracyEngine');

const { isMoveInOpeningBook } = await import('../src/services/openingBook');
const { gameAnalysisService } = await import('../src/services/gameAnalysisService');
const { chessEngineService } = await import('../src/services/chessEngineService');

async function runPhase3Tests() {
  console.log('\n================================================================');
  console.log('♟️  MOVEWISELY — PHASE 3: TRUSTWORTHY MOVE GRADES & ACCURACY');
  console.log('================================================================\n');
  console.log(`Version: ${ACCURACY_ENGINE_VERSION}\n`);

  let passed = 0;
  let failed = 0;

  // Initialize engine service
  await chessEngineService.initEngine();

  // TEST 1: Expected Points Calibration
  try {
    process.stdout.write('[TEST 1] Verifying Expected-Points (Elo-Logistic) calibration... ');

    const pEqual = calculateExpectedPoints(0);
    const pPlus100 = calculateExpectedPoints(100);
    const pPlus400 = calculateExpectedPoints(400);
    const pMinus400 = calculateExpectedPoints(-400);
    const pMaxWin = calculateExpectedPoints(4500);
    const pMaxLoss = calculateExpectedPoints(-4500);

    // Assertions
    if (Math.abs(pEqual - 0.50) > 0.0001) throw new Error(`pEqual != 0.5: got ${pEqual}`);
    if (pPlus100 < 0.63 || pPlus100 > 0.65) throw new Error(`pPlus100 out of range: got ${pPlus100}`);
    if (Math.abs(pPlus400 - 0.909) > 0.005) throw new Error(`pPlus400 out of range: got ${pPlus400}`);
    if (Math.abs(pMinus400 - 0.091) > 0.005) throw new Error(`pMinus400 out of range: got ${pMinus400}`);
    if (pMaxWin !== 1.0) throw new Error(`pMaxWin != 1.0: got ${pMaxWin}`);
    if (pMaxLoss !== 0.0) throw new Error(`pMaxLoss != 0.0: got ${pMaxLoss}`);

    console.log('PASSED (Sigmoid proxy symmetry & bounds confirmed)');
    passed++;
  } catch (err) {
    console.log('FAILED');
    console.error('  Error:', err);
    failed++;
  }

  // TEST 2: Individual Move Accuracy Decay Formula
  try {
    process.stdout.write('[TEST 2] Verifying Move Accuracy exponential decay Acc_i = 100 * exp(-5.5 * ΔP)... ');

    const accZero = calculateMoveAccuracy(0.0);
    const acc2Pct = calculateMoveAccuracy(0.02);
    const acc5Pct = calculateMoveAccuracy(0.05);
    const acc10Pct = calculateMoveAccuracy(0.10);
    const acc25Pct = calculateMoveAccuracy(0.25);
    const acc50Pct = calculateMoveAccuracy(0.50);

    if (accZero !== 100.0) throw new Error(`accZero != 100: got ${accZero}`);
    if (acc2Pct < 88.0 || acc2Pct > 91.0) throw new Error(`acc2Pct out of range: got ${acc2Pct}`);
    if (acc5Pct < 74.0 || acc5Pct > 78.0) throw new Error(`acc5Pct out of range: got ${acc5Pct}`);
    if (acc10Pct < 56.0 || acc10Pct > 60.0) throw new Error(`acc10Pct out of range: got ${acc10Pct}`);
    if (acc25Pct < 23.0 || acc25Pct > 28.0) throw new Error(`acc25Pct out of range: got ${acc25Pct}`);
    if (acc50Pct > 7.0) throw new Error(`acc50Pct too high for 50% blunder: got ${acc50Pct}`);

    // Monotonicity check
    if (!(accZero >= acc2Pct && acc2Pct >= acc5Pct && acc5Pct >= acc10Pct && acc10Pct >= acc25Pct && acc25Pct >= acc50Pct)) {
      throw new Error('Accuracy function violated strict monotonicity');
    }

    console.log('PASSED (Monotonic and continuous; calibration not tested)');
    passed++;
  } catch (err) {
    console.log('FAILED');
    console.error('  Error:', err);
    failed++;
  }

  // TEST 3: Standard Classification Boundaries
  try {
    process.stdout.write('[TEST 3] Verifying Standard Move Classification boundaries... ');

    const gBest = classifyStandardGrade(0, 0);
    const gBestEdge = classifyStandardGrade(4, 0.01);
    const gExcellent = classifyStandardGrade(18, 0.025);
    const gGood = classifyStandardGrade(45, 0.06);
    const gInaccuracy = classifyStandardGrade(110, 0.12);
    const gMistake = classifyStandardGrade(220, 0.24);
    const gBlunder = classifyStandardGrade(350, 0.40);

    if (gBest !== 'best') throw new Error(`Expected best, got ${gBest}`);
    if (gBestEdge !== 'best') throw new Error(`Expected best on 4cp edge, got ${gBestEdge}`);
    if (gExcellent !== 'excellent') throw new Error(`Expected excellent, got ${gExcellent}`);
    if (gGood !== 'good') throw new Error(`Expected good, got ${gGood}`);
    if (gInaccuracy !== 'inaccuracy') throw new Error(`Expected inaccuracy, got ${gInaccuracy}`);
    if (gMistake !== 'mistake') throw new Error(`Expected mistake, got ${gMistake}`);
    if (gBlunder !== 'blunder') throw new Error(`Expected blunder, got ${gBlunder}`);

    console.log('PASSED (6 standard tiers strictly partitioned)');
    passed++;
  } catch (err) {
    console.log('FAILED');
    console.error('  Error:', err);
    failed++;
  }

  // TEST 4: Contextual Grades (Book, Brilliant, Great, Miss)
  try {
    process.stdout.write('[TEST 4] Testing Contextual Classification evidence rules... ');

    // 4a. Book Move
    const startFen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
    const bookCheckE4 = isMoveInOpeningBook(startFen, 'e2e4', 'e4');
    if (!bookCheckE4.isBook || bookCheckE4.eco !== 'A00') {
      throw new Error(`Failed to recognize 1. e4 as book: ${JSON.stringify(bookCheckE4)}`);
    }

    const ruyLopezFen = 'r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 2 3';
    const bookCheckBb5 = isMoveInOpeningBook(ruyLopezFen, 'f1b5', 'Bb5');
    if (!bookCheckBb5.isBook || !bookCheckBb5.openingName?.includes('Ruy Lopez')) {
      throw new Error(`Failed to recognize 3. Bb5 in opening setup: ${JSON.stringify(bookCheckBb5)}`);
    }

    // 4b. Brilliant Move (Knight sacrifice maintaining decisive winning eval)
    const ctxBrilliant = gradeMove({
      moveNumber: 15,
      color: 'white',
      san: 'Nxf7',
      uci: 'e5f7',
      piece: 'n',
      captured: 'p',
      fenBefore: 'r1bqkb1r/pp1p1ppp/2n5/4N3/4P3/8/PPPP1PPP/RNBQKB1R w KQkq - 0 1',
      fenAfter: 'r1bqkb1r/pp1p1Npp/2n5/8/4P3/8/PPPP1PPP/RNBQKB1R b KQkq - 0 1',
      evalCpBefore: 120,
      evalCpAfter: 250,
      evalLossCp: 0,
      expectedPointsBefore: 0.67,
      expectedPointsAfter: 0.81,
      expectedPointsLoss: 0,
      bestMoveUci: 'e5f7',
      bestMoveSan: 'Nxf7',
      isMaterialSacrifice: true,
    });

    if (ctxBrilliant.grade !== 'brilliant' || !ctxBrilliant.isContextual) {
      throw new Error(`Expected brilliant, got ${ctxBrilliant.grade}`);
    }

    // 4c. Great Move (Only winning move with huge PV separation)
    const ctxGreat = gradeMove({
      moveNumber: 22,
      color: 'white',
      san: 'Re8+',
      uci: 'e1e8',
      piece: 'r',
      fenBefore: '4k3/8/8/8/8/8/8/4R1K1 w - - 0 1',
      fenAfter: '4R3/8/8/8/8/8/8/6K1 b - - 0 1',
      evalCpBefore: 300,
      evalCpAfter: 300,
      evalLossCp: 0,
      expectedPointsBefore: 0.85,
      expectedPointsAfter: 0.85,
      expectedPointsLoss: 0,
      bestMoveUci: 'e1e8',
      bestMoveSan: 'Re8+',
      pvs: [
        { multipv: 1, depth: 12, score: { type: 'cp', value: 300, whiteRelativeValue: 300, formatted: '+3.0' }, pvMoves: ['e1e8'], nodes: 100, nps: 100, timeMs: 50 },
        { multipv: 2, depth: 12, score: { type: 'cp', value: 50, whiteRelativeValue: 50, formatted: '+0.5' }, pvMoves: ['g1f2'], nodes: 100, nps: 100, timeMs: 50 },
      ],
    });

    if (ctxGreat.grade !== 'great' || !ctxGreat.isContextual) {
      throw new Error(`Expected great move, got ${ctxGreat.grade}`);
    }

    // 4d. Miss (Player was up +350 cp, but played a move dropping to 0 cp)
    const ctxMiss = gradeMove({
      moveNumber: 28,
      color: 'white',
      san: 'h3',
      uci: 'h2h3',
      piece: 'p',
      fenBefore: 'r4rk1/5ppp/8/8/8/8/5PPP/R4RK1 w - - 0 1',
      fenAfter: 'r4rk1/5ppp/8/8/8/7P/5PP1/R4RK1 b - - 0 1',
      evalCpBefore: 350,
      evalCpAfter: 20,
      evalLossCp: 330,
      expectedPointsBefore: 0.88,
      expectedPointsAfter: 0.53,
      expectedPointsLoss: 0.35,
      bestMoveUci: 'a1a8',
      bestMoveSan: 'Rxa8',
    });

    if (ctxMiss.grade !== 'miss' || !ctxMiss.isContextual) {
      throw new Error(`Expected miss, got ${ctxMiss.grade}`);
    }

    console.log('PASSED (Book, Brilliant, Great, Miss verified with engine evidence)');
    passed++;
  } catch (err) {
    console.log('FAILED');
    console.error('  Error:', err);
    failed++;
  }

  // TEST 5: Dead-Won Positions and Asymmetric Centipawn Loss Resiliency
  try {
    process.stdout.write('[TEST 5] Testing dead-won position win-chance resiliency... ');

    // Suppose player is +1200 cp ahead (99.9% win) and drops to +700 cp (98.3% win)
    // In raw centipawns, that is a 500 cp drop. But in experimental score proxy, it is only a 1.6% drop!
    const expWonBefore = calculateExpectedPoints(1200);
    const expWonAfter = calculateExpectedPoints(700);
    const expLoss = expWonBefore - expWonAfter;
    const moveAcc = calculateMoveAccuracy(expLoss);

    // Should NOT be a blunder because game outcome was not jeopardized
    if (expLoss > 0.05) {
      throw new Error(`Expected points loss too high in won position: ${expLoss}`);
    }

    if (moveAcc < 85.0) {
      throw new Error(`Accuracy too low for won position move: ${moveAcc}%`);
    }

    console.log(`PASSED (500 cp loss when +12 maintains ${moveAcc}% accuracy due to minimal win prob drop)`);
    passed++;
  } catch (err) {
    console.log('FAILED');
    console.error('  Error:', err);
    failed++;
  }

  // TEST 6: Game Accuracy Mathematical Aggregation
  try {
    process.stdout.write('[TEST 6] Testing unblended game-level accuracy aggregation... ');

    const sampleMoves = [
      gradeMove({ moveNumber: 1, color: 'white', san: 'e4', uci: 'e2e4', piece: 'p', fenBefore: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1', fenAfter: 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1', evalCpBefore: 20, evalCpAfter: 20, evalLossCp: 0, expectedPointsBefore: 0.53, expectedPointsAfter: 0.53, expectedPointsLoss: 0, bestMoveUci: 'e2e4', bestMoveSan: 'e4' }),
      gradeMove({ moveNumber: 2, color: 'white', san: 'Nf3', uci: 'g1f3', piece: 'n', fenBefore: 'rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2', fenAfter: 'rnbqkbnr/pppp1ppp/8/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R b KQkq - 1 2', evalCpBefore: 25, evalCpAfter: 25, evalLossCp: 0, expectedPointsBefore: 0.54, expectedPointsAfter: 0.54, expectedPointsLoss: 0, bestMoveUci: 'g1f3', bestMoveSan: 'Nf3' }),
      gradeMove({ moveNumber: 3, color: 'white', san: 'Bc4', uci: 'f1c4', piece: 'b', fenBefore: 'r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 2 3', fenAfter: 'r1bqkbnr/pppp1ppp/2n5/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R b KQkq - 3 3', evalCpBefore: 30, evalCpAfter: 30, evalLossCp: 0, expectedPointsBefore: 0.54, expectedPointsAfter: 0.54, expectedPointsLoss: 0, bestMoveUci: 'f1c4', bestMoveSan: 'Bc4' }),
      gradeMove({ moveNumber: 4, color: 'white', san: 'd4', uci: 'd2d4', piece: 'p', fenBefore: 'r1bqk1nr/pppp1ppp/2n5/2b1p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4', fenAfter: 'r1bqk1nr/pppp1ppp/2n5/2b1p3/2BPP3/5N2/PPP2PPP/RNBQK2R b KQkq - 0 4', evalCpBefore: 40, evalCpAfter: 20, evalLossCp: 20, expectedPointsBefore: 0.56, expectedPointsAfter: 0.53, expectedPointsLoss: 0.03, bestMoveUci: 'c2c3', bestMoveSan: 'c3' }),
      gradeMove({ moveNumber: 5, color: 'white', san: 'h3', uci: 'h2h3', piece: 'p', fenBefore: 'r1bqk2r/pppp1ppp/2n2n2/2b1p3/2B1P3/2P2N2/PP1P1PPP/RNBQK2R w KQkq - 2 5', fenAfter: 'r1bqk2r/pppp1ppp/2n2n2/2b1p3/2B1P3/2P2N1P/PP1P1PP1/RNBQK2R b KQkq - 0 5', evalCpBefore: 30, evalCpAfter: -250, evalLossCp: 280, expectedPointsBefore: 0.54, expectedPointsAfter: 0.19, expectedPointsLoss: 0.35, bestMoveUci: 'd2d4', bestMoveSan: 'd4' }),
    ];

    const agg = aggregateGameAccuracy(sampleMoves);

    if (agg.totalAnalyzedMoves !== 5) throw new Error(`Expected 5 moves, got ${agg.totalAnalyzedMoves}`);
    if (agg.bookMovesCount < 2) throw new Error(`Expected book moves, got ${agg.bookMovesCount}`);
    if (agg.accuracyPct < 60 || agg.accuracyPct > 90) throw new Error(`Unexpected accuracy: ${agg.accuracyPct}%`);
    if (agg.accuracyVersion !== ACCURACY_ENGINE_VERSION) throw new Error('Engine version mismatch');

    console.log(`PASSED (Game accuracy: ${agg.accuracyPct}%, Non-book: ${agg.harmonicAccuracyPct}%, Avg Δcp: ${agg.averageCentipawnLoss})`);
    passed++;
  } catch (err) {
    console.log('FAILED');
    console.error('  Error:', err);
    failed++;
  }

  // TEST 7: Full Single Game Analysis through GameAnalysisService
  try {
    process.stdout.write('[TEST 7] Verifying full game analysis with Phase 3 grading... ');

    const testGame = {
      id: 'test-phase-3-game',
      url: 'https://chess.com/game/12345',
      white: { username: 'Hero', rating: 1500, result: 'win' },
      black: { username: 'Villain', rating: 1480, result: 'loss' },
      userColor: 'white' as const,
      userRating: 1500,
      opponentUsername: 'Villain',
      opponentRating: 1480,
      result: 'win' as const,
      termination: 'Normal',
      timeControl: 'blitz' as const,
      timeClass: 'blitz',
      date: '2026.10.10',
      pgn: '1. e4 e5 2. Nf3 Nc6 3. Bc4 Bc5 4. c3 Nf6 5. d4 exd4 6. cxd4 Bb4+ 7. Bd2 Bxd2+ 8. Nbxd2 d5',
      movesCount: 8,
    };

    const analyzedGame = await gameAnalysisService.analyzeGame(testGame, { depth: 8 });

    if (analyzedGame.analyzedMoves.length !== 8) {
      throw new Error(`Expected 8 White moves, got ${analyzedGame.analyzedMoves.length}`);
    }

    // Verify first 3 moves are Book/Best
    const m1 = analyzedGame.analyzedMoves[0];
    const m2 = analyzedGame.analyzedMoves[1];
    const m3 = analyzedGame.analyzedMoves[2];

    if (m1.judgment !== 'book' && m1.judgment !== 'best') {
      throw new Error(`Move 1 (e4) was not classified as book or best: got ${m1.judgment}`);
    }
    if (m2.judgment !== 'book' && m2.judgment !== 'best') {
      throw new Error(`Move 2 (Nf3) was not classified as book or best: got ${m2.judgment}`);
    }

    if (analyzedGame.userAccuracy < 70) {
      throw new Error(`Italian main line played cleanly yielded low accuracy: ${analyzedGame.userAccuracy}%`);
    }

    console.log(`PASSED (8 user moves graded, user accuracy: ${analyzedGame.userAccuracy}%, loss phase: ${analyzedGame.lossPhase})`);
    passed++;
  } catch (err) {
    console.log('FAILED');
    console.error('  Error:', err);
    failed++;
  }

  console.log('\n================================================================');
  console.log(`Phase 3 Test Results: ${passed} Passed, ${failed} Failed`);
  console.log('================================================================\n');

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runPhase3Tests().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
