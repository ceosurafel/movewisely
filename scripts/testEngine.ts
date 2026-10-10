/**
 * Automated Verification Test Suite for MoveWisely Stockfish 19 WASM Engine Integration
 *
 * Tests:
 * 1. Engine Initialization & UCI Readiness
 * 2. Tactical Position Evaluation & Legal Best Move / Continuation
 * 3. MultiPV Candidate Line Generation
 * 4. Search Cancellation (stop)
 * 5. Position Validation & Invalid FEN Rejection
 * 6. Worker Termination & Crash Recovery (reinitialize)
 */

import { createRequire } from 'module';

// Polyfill Web Worker for Node test environment with authentic async dispatch
if (typeof Worker === 'undefined') {
  const require = createRequire(import.meta.url);
  const initStockfish = require('stockfish');

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

// Import engine service AFTER polyfill so it detects the Worker environment
const { chessEngineService } = await import('../src/services/chessEngineService');

async function runTests() {
  console.log('\n======================================================');
  console.log('♟️  MOVEWISELY — STOCKFISH 19 WASM VERIFICATION SUITE');
  console.log('======================================================\n');

  let passed = 0;
  let failed = 0;

  // TEST 1: Engine Initialization & UCI Readiness
  try {
    process.stdout.write('[TEST 1] Initializing Stockfish 19 Lite WASM via UCI... ');
    const startInit = Date.now();
    await chessEngineService.initEngine();
    const initDuration = Date.now() - startInit;

    if (chessEngineService.getStatus() === 'ready') {
      console.log(`PASSED (${initDuration}ms) — Engine status: READY`);
      passed++;
    } else {
      throw new Error(`Engine status is ${chessEngineService.getStatus()}, expected 'ready'`);
    }
  } catch (err) {
    console.log('FAILED');
    console.error('  Error:', err);
    failed++;
  }

  // TEST 2: Tactical Analysis of Mate-in-1 Position
  try {
    process.stdout.write('[TEST 2] Analyzing tactical Mate-in-1 (Scholar threat: Qxf7#)... ');
    const fen = 'r1bqkb1r/pppp1ppp/2n5/4p3/2B5/5Q2/PPPP1PPP/RNB1K1NR w KQkq - 0 4';
    const result = await chessEngineService.analyze({
      fen,
      depth: 8,
    });

    const isMateInOne = result.bestMove === 'f3f7';
    const isMateScore = result.primaryScore.type === 'mate' && result.primaryScore.value === 1;

    if (isMateInOne && isMateScore) {
      console.log(`PASSED`);
      console.log(`  Best Move: ${result.bestMove} (ponder: ${result.ponder || 'none'})`);
      console.log(`  Score: ${result.primaryScore.formatted} | Nodes: ${result.nodes} | NPS: ${result.nps}`);
      console.log(`  PV: ${result.pvs[0]?.pvSan?.join(' ') || result.pvs[0]?.pvMoves.join(' ')}`);
      passed++;
    } else {
      throw new Error(`Expected bestMove f3f7 and mate in 1, got ${result.bestMove} (${result.primaryScore.formatted})`);
    }
  } catch (err) {
    console.log('FAILED');
    console.error('  Error:', err);
    failed++;
  }

  // TEST 3: MultiPV Candidate Lines
  try {
    process.stdout.write('[TEST 3] Evaluating standard opening with MultiPV = 3... ');
    const startFen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
    const result = await chessEngineService.analyze({
      fen: startFen,
      depth: 6,
      multiPv: 3,
    });

    if (result.pvs.length === 3) {
      console.log(`PASSED`);
      result.pvs.forEach((pv) => {
        console.log(`  Line ${pv.multipv}: ${pv.score.formatted} | ${pv.pvSan?.slice(0, 3).join(' ') || pv.pvMoves.slice(0, 3).join(' ')} (depth ${pv.depth})`);
      });
      passed++;
    } else {
      throw new Error(`Expected 3 PV lines, got ${result.pvs.length}`);
    }
  } catch (err) {
    console.log('FAILED');
    console.error('  Error:', err);
    failed++;
  }

  // TEST 4: Search Cancellation (stop)
  try {
    process.stdout.write('[TEST 4] Cancelling active search mid-execution (stop)... ');
    const fen = 'r1b1k2r/ppppqppp/2n2n2/4p3/1bB1P3/2N2N2/PPPP1PPP/R1BQK2R w KQkq - 6 6';

    const searchPromise = chessEngineService.analyze({
      fen,
      depth: 30, // intentionally deep
      timeoutMs: 10000,
    });

    // Send stop after 80ms
    setTimeout(async () => {
      await chessEngineService.stop();
    }, 80);

    const result = await searchPromise;
    const isStopped = !chessEngineService.isBusy();

    if (isStopped && result.bestMove) {
      console.log(`PASSED — Search halted gracefully at depth ${result.depthReached}, best move: ${result.bestMove}`);
      passed++;
    } else {
      throw new Error(`Search did not halt properly (busy: ${chessEngineService.isBusy()})`);
    }
  } catch (err) {
    console.log('FAILED');
    console.error('  Error:', err);
    failed++;
  }

  // TEST 5: Position Validation & Invalid FEN Rejection
  try {
    process.stdout.write('[TEST 5] Validating position & rejecting invalid FEN... ');
    let caught = false;
    try {
      await chessEngineService.analyze({
        fen: 'invalid-fen-string-that-fails-validation',
        depth: 6,
      });
    } catch (e: any) {
      caught = true;
      if (e.message.includes('Invalid FEN position')) {
        console.log(`PASSED — Correctly rejected: "${e.message}"`);
        passed++;
      } else {
        throw new Error(`Unexpected error message: ${e.message}`);
      }
    }

    if (!caught) {
      throw new Error('Invalid FEN was not rejected');
    }
  } catch (err) {
    console.log('FAILED');
    console.error('  Error:', err);
    failed++;
  }

  // TEST 6: Worker Termination & Crash Recovery (reinitialize)
  try {
    process.stdout.write('[TEST 6] Terminating worker & recovering via reinitialize()... ');
    chessEngineService.terminate();

    if (chessEngineService.getStatus() !== 'terminated') {
      throw new Error(`Status should be 'terminated', got ${chessEngineService.getStatus()}`);
    }

    await chessEngineService.reinitialize();

    if (chessEngineService.getStatus() !== 'ready') {
      throw new Error(`After reinitialize, status should be 'ready', got ${chessEngineService.getStatus()}`);
    }

    // Verify engine can analyze again after recovery
    const postRecoveryResult = await chessEngineService.analyze({
      fen: 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1',
      depth: 5,
    });

    if (postRecoveryResult.bestMove) {
      console.log(`PASSED — Engine recovered cleanly, analyzed post-recovery best move: ${postRecoveryResult.bestMove}`);
      passed++;
    } else {
      throw new Error('Engine failed to analyze after reinitialize');
    }
  } catch (err) {
    console.log('FAILED');
    console.error('  Error:', err);
    failed++;
  }

  // Clean termination at end of test run
  chessEngineService.terminate();

  console.log('\n======================================================');
  console.log(`TEST RESULTS: ${passed} PASSED | ${failed} FAILED`);
  console.log('======================================================\n');

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runTests().catch((err) => {
  console.error('Fatal test runner error:', err);
  process.exit(1);
});
