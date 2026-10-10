/**
 * Automated Verification Test Suite for MoveWisely Phase 2
 * Engine-Based Move-By-Move Game Analysis Service
 *
 * Tests:
 * 1. Legal Replay & Complete Timeline Reconstruction (chess.js)
 * 2. Evaluation Normalization (Perspective, Side-to-move parity, Forced mates, Draws)
 * 3. Expected Points & Centipawn Loss Mathematics
 * 4. Position Analysis LRU Caching
 * 5. Move-by-Move Engine Evaluation & Best Move Derivation
 * 6. Authentic Spotlight Move Extraction from Real Game
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

// Import services AFTER worker polyfill
const { gameAnalysisService } = await import('../src/services/gameAnalysisService');
const { chessEngineService } = await import('../src/services/chessEngineService');

async function runPhase2Tests() {
  console.log('\n================================================================');
  console.log('♟️  MOVEWISELY — PHASE 2: ENGINE GAME ANALYSIS TEST SUITE');
  console.log('================================================================\n');

  let passed = 0;
  let failed = 0;

  // Initialize engine service first
  await chessEngineService.initEngine();

  // TEST 1: Legal Replay & Full Timeline Reconstruction
  try {
    process.stdout.write('[TEST 1] Reconstructing game timeline from PGN via chess.js... ');
    const testPgn = '1. e4 e5 2. Nf3 Nc6 3. Bc4 Bc5 4. c3 Nf6 5. d4 exd4 6. cxd4 Bb4+ 7. Bd2 Bxd2+ 8. Nbxd2 d5';
    const timeline = gameAnalysisService.reconstructTimeline(testPgn);

    if (!timeline.valid) {
      throw new Error(`Timeline reported invalid: ${timeline.error}`);
    }

    if (timeline.moves.length !== 16) {
      throw new Error(`Expected 16 plies, got ${timeline.moves.length}`);
    }

    // Verify ply ordering and full move numbering
    const firstMove = timeline.moves[0];
    const eighthMove = timeline.moves[7]; // Black move 4 (...Nf6)
    const finalMove = timeline.moves[15]; // Black move 8 (...d5)

    const isPliesConsistent =
      firstMove.ply === 1 &&
      firstMove.moveNumber === 1 &&
      firstMove.color === 'white' &&
      firstMove.san === 'e4' &&
      eighthMove.ply === 8 &&
      eighthMove.moveNumber === 4 &&
      eighthMove.color === 'black' &&
      finalMove.ply === 16 &&
      finalMove.moveNumber === 8;

    // Verify FEN continuity: fenBefore of move 2 must equal fenAfter of move 1
    const isFenContinuous =
      timeline.moves[1].fenBefore === timeline.moves[0].fenAfter &&
      timeline.moves[2].fenBefore === timeline.moves[1].fenAfter;

    if (isPliesConsistent && isFenContinuous) {
      console.log('PASSED (16/16 plies continuous & valid)');
      passed++;
    } else {
      throw new Error('Timeline ply or FEN sequence inconsistency');
    }
  } catch (err) {
    console.log('FAILED');
    console.error('  Error:', err);
    failed++;
  }

  // TEST 2: Evaluation Normalization (Perspectives & Side-to-Move Parity)
  try {
    process.stdout.write('[TEST 2] Testing evaluation normalization across colors & mates... ');

    // 2a. White to move, +150 cp
    const scoreWhiteAhead = { type: 'cp' as const, value: 150, whiteRelativeValue: 150, formatted: '+1.50' };
    const normWhiteForWhite = gameAnalysisService.normalizeScoreToPerspective(scoreWhiteAhead, 'w', 'white');
    const normWhiteForBlack = gameAnalysisService.normalizeScoreToPerspective(scoreWhiteAhead, 'w', 'black');

    if (normWhiteForWhite.cpEquivalent !== 150 || normWhiteForBlack.cpEquivalent !== -150) {
      throw new Error(`White to move normalization failed: White=${normWhiteForWhite.cpEquivalent}, Black=${normWhiteForBlack.cpEquivalent}`);
    }

    // 2b. Black to move, +200 cp (means Black is +200 in UCI convention!)
    const scoreBlackAhead = { type: 'cp' as const, value: 200, whiteRelativeValue: -200, formatted: '+2.00' };
    const normBlackForWhite = gameAnalysisService.normalizeScoreToPerspective(scoreBlackAhead, 'b', 'white');
    const normBlackForBlack = gameAnalysisService.normalizeScoreToPerspective(scoreBlackAhead, 'b', 'black');

    if (normBlackForWhite.cpEquivalent !== -200 || normBlackForBlack.cpEquivalent !== 200) {
      throw new Error(`Black to move normalization failed: White=${normBlackForWhite.cpEquivalent}, Black=${normBlackForBlack.cpEquivalent}`);
    }

    // 2c. Forced Mate in 2 (White delivers mate)
    const mateIn2 = { type: 'mate' as const, value: 2, whiteRelativeValue: 9900, formatted: 'Mate in 2' };
    const normMateWhite = gameAnalysisService.normalizeScoreToPerspective(mateIn2, 'w', 'white');
    const normMateBlack = gameAnalysisService.normalizeScoreToPerspective(mateIn2, 'w', 'black');

    if (normMateWhite.cpEquivalent <= 9000 || normMateBlack.cpEquivalent >= -9000) {
      throw new Error(`Mate score normalization failed: White=${normMateWhite.cpEquivalent}, Black=${normMateBlack.cpEquivalent}`);
    }

    console.log('PASSED (Side-to-move parity & mate signs verified)');
    passed++;
  } catch (err) {
    console.log('FAILED');
    console.error('  Error:', err);
    failed++;
  }

  // TEST 3: Experimental Score Proxy & Loss Calculation
  try {
    process.stdout.write('[TEST 3] Testing experimental score proxy & move classification... ');

    const winProbEqual = gameAnalysisService.calculateExpectedPoints(0);
    const winProbAhead = gameAnalysisService.calculateExpectedPoints(250);
    const winProbBehind = gameAnalysisService.calculateExpectedPoints(-250);

    const isProbValid =
      Math.abs(winProbEqual - 0.50) < 0.01 &&
      winProbAhead > 0.70 &&
      winProbBehind < 0.30;

    if (!isProbValid) {
      throw new Error(`Expected points formula calculation mismatch: equal=${winProbEqual}, ahead=${winProbAhead}, behind=${winProbBehind}`);
    }

    const classBest = gameAnalysisService.classifyMove(0, 0);
    const classInacc = gameAnalysisService.classifyMove(70, 0.10);
    const classBlunder = gameAnalysisService.classifyMove(350, 0.35);

    if (classBest !== 'best' || classInacc !== 'inaccuracy' || classBlunder !== 'blunder') {
      throw new Error(`Classification error: best=${classBest}, inacc=${classInacc}, blunder=${classBlunder}`);
    }

    console.log('PASSED (Experimental score proxy and move classification checks passed)');
    passed++;
  } catch (err) {
    console.log('FAILED');
    console.error('  Error:', err);
    failed++;
  }

  // TEST 4: Position Analysis Caching
  try {
    process.stdout.write('[TEST 4] Testing position evaluation caching... ');
    const testFen = 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1';

    const t0 = Date.now();
    const eval1 = await gameAnalysisService.evaluatePosition(testFen, { depth: 8 });
    const duration1 = Date.now() - t0;

    const t1 = Date.now();
    const eval2 = await gameAnalysisService.evaluatePosition(testFen, { depth: 8 });
    const duration2 = Date.now() - t1;

    // Cache hit should be near instant (< 5ms) and return identical object
    if (eval1 === eval2 && duration2 < 10) {
      console.log(`PASSED (Engine search: ${duration1}ms -> Cache hit: ${duration2}ms)`);
      passed++;
    } else {
      throw new Error(`Cache failed: eval1 !== eval2 or took ${duration2}ms`);
    }
  } catch (err) {
    console.log('FAILED');
    console.error('  Error:', err);
    failed++;
  }

  // TEST 5: Move-by-Move Engine Evaluation & Alternative Board State
  try {
    process.stdout.write('[TEST 5] Evaluating tactical blunder move with Stockfish 19... ');
    // Position where White plays disastrous f2f3 hanging mate or giving up queen
    const fenBefore = 'r1bqkb1r/pppp1ppp/2n5/4p3/2B5/5Q2/PPPP1PPP/RNB1K1NR w KQkq - 0 4';
    const move: import('../src/services/gameAnalysisService').ReconstructedMove = {
      ply: 7,
      moveNumber: 4,
      color: 'white',
      san: 'a3',
      uci: 'a2a3',
      from: 'a2',
      to: 'a3',
      piece: 'p',
      fenBefore,
      fenAfter: 'r1bqkb1r/pppp1ppp/2n5/4p3/2B5/P4Q2/1PPP1PPP/RNB1K1NR b KQkq - 0 4',
      isCheck: false,
      isCheckmate: false,
    };

    const analyzed = await gameAnalysisService.analyzeMove(move, { depth: 8 });

    // Stockfish 19 finds Qxf7# as the best move in fenBefore
    const foundMate = analyzed.bestMoveUci === 'f3f7';
    const isBlunder = analyzed.evalLossCp >= 200 || analyzed.judgment === 'blunder';

    // Verify resulting board state from engine alternative move (Q on f7 delivering checkmate: pppp1Qpp)
    const isFenAfterBestValid = analyzed.fenAfterBestMove.includes('pppp1Qpp');

    if (foundMate && isBlunder && isFenAfterBestValid) {
      console.log(`PASSED (Best move: ${analyzed.bestMoveSan} [${analyzed.bestMoveUci}], Eval loss: ${analyzed.evalLossCp} cp)`);
      passed++;
    } else {
      throw new Error(`Expected best move f3f7 and blunder judgment, got best=${analyzed.bestMoveUci}, loss=${analyzed.evalLossCp}`);
    }
  } catch (err) {
    console.log('FAILED');
    console.error('  Error:', err);
    failed++;
  }

  // TEST 6: Terminal positions and invalid recommendation failures
  try {
    process.stdout.write('[TEST 6] Verifying terminal-position handling and no fabricated move fallback... ');
    const checkmateFen = 'R5k1/5ppp/8/8/8/8/8/6K1 b - - 1 1';
    const terminalMate = await gameAnalysisService.evaluatePosition(checkmateFen, { depth: 8 });
    if (terminalMate.terminalKind !== 'checkmate' || terminalMate.bestMove !== '' || terminalMate.pvs.length !== 0) {
      throw new Error('Checkmate position should be resolved explicitly without inventing a best move or PV');
    }
    const mateForWhite = gameAnalysisService.normalizeScoreToPerspective(terminalMate.primaryScore, 'b', 'white');
    if (mateForWhite.cpEquivalent < 9000) throw new Error(`Terminal checkmate perspective is incorrect: ${mateForWhite.cpEquivalent}`);

    let illegalRecommendationRejected = false;
    try {
      gameAnalysisService.getFenAfterUciMove('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1', 'e2e5');
    } catch {
      illegalRecommendationRejected = true;
    }
    if (!illegalRecommendationRejected) throw new Error('Illegal engine recommendation was silently converted to a fallback FEN/SAN');

    const malformedPgn = gameAnalysisService.reconstructTimeline('this is not a legal PGN');
    if (malformedPgn.valid || malformedPgn.moves.length !== 0) throw new Error('Malformed PGN produced a partially trusted timeline');

    console.log('PASSED (terminal state is explicit; illegal move and malformed PGN are rejected)');
    passed++;
  } catch (err) {
    console.log('FAILED');
    console.error('  Error:', err);
    failed++;
  }

  // TEST 7: Authentic Spotlight Move Extraction from Real Game
  try {
    process.stdout.write('[TEST 7] Extracting authentic engine spotlight move from game... ');
    const mockGame: import('../src/types/chess').GameRecord = {
      id: 'test-game-1',
      url: 'https://chess.com/game/12345',
      white: { username: 'Alex', rating: 1200, result: 'loss' },
      black: { username: 'Opponent', rating: 1210, result: 'win' },
      userColor: 'white',
      userRating: 1200,
      opponentUsername: 'Opponent',
      opponentRating: 1210,
      result: 'loss',
      termination: 'Normal',
      timeControl: 'rapid',
      timeClass: 'rapid',
      date: '2026-10-09',
      pgn: '1. e4 e5 2. Nf3 Nc6 3. Bc4 Bc5 4. a3 d6 5. h3 Nf6 6. d3 O-O',
      movesCount: 6,
    };

    const analyzedGame = await gameAnalysisService.analyzeGame(mockGame, { depth: 6 });
    const spotlight = gameAnalysisService.extractSpotlightMove([analyzedGame]);

    if (!spotlight) {
      throw new Error('Failed to extract spotlight move');
    }

    const hasRealFen = Boolean(spotlight.fenBefore && spotlight.fenAfterUserMove && spotlight.fenAfterBestMove);
    const hasRealBestMove = Boolean(spotlight.bestMoveSan && spotlight.bestMoveFrom && spotlight.bestMoveTo);
    const hasEvalDiff = spotlight.evalDiff.includes('→');

    if (hasRealFen && hasRealBestMove && hasEvalDiff) {
      console.log(`PASSED (Spotlight: ${spotlight.userMoveSan} vs engine ${spotlight.bestMoveSan}, Eval: ${spotlight.evalDiff})`);
      passed++;
    } else {
      throw new Error('Spotlight move missing required engine fields');
    }
  } catch (err) {
    console.log('FAILED');
    console.error('  Error:', err);
    failed++;
  }

  console.log('\n================================================================');
  console.log(`PHASE 2 TEST RESULTS: ${passed} PASSED | ${failed} FAILED`);
  console.log('================================================================\n');

  chessEngineService.terminate();

  if (failed > 0) {
    process.exit(1);
  }
}

runPhase2Tests().catch((err) => {
  console.error('Test suite uncaught error:', err);
  process.exit(1);
});
