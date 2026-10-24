/**
 * Live integration audit against Hikaru's public Chess.com blitz games.
 *
 * This is intentionally separate from the deterministic unit suite because it
 * relies on Chess.com's external public API and should be run as a release
 * smoke-test, not treated as a stable offline unit test.
 */
import { createRequire } from 'module';
import { Chess } from 'chess.js';

if (typeof Worker === 'undefined') {
  const require = createRequire(import.meta.url);

  class NodeStockfishWorker {
    private engine: any;
    public onmessage: ((event: { data: string }) => void) | null = null;
    public onerror: ((event: any) => void) | null = null;

    constructor() {
      for (const key in require.cache) {
        if (key.includes('stockfish')) delete require.cache[key];
      }
      const initializeStockfish = require('stockfish');
      this.engine = initializeStockfish('lite-single', (line: string) => {
        setTimeout(() => {
          this.onmessage?.({ data: line });
        }, 0);
      });
    }

    postMessage(command: string): void {
      setTimeout(() => {
        try {
          this.engine?.processCommand(command);
        } catch (error) {
          this.onerror?.(error);
        }
      }, 0);
    }

    terminate(): void {
      this.engine = null;
      this.onmessage = null;
      this.onerror = null;
    }
  }

  (globalThis as any).Worker = NodeStockfishWorker;
}

async function main(): Promise<void> {
  // Import only after the test Worker polyfill is installed.
  const [{ fetchUserGames }, { playerDiagnosticsService }, { chessEngineService }] = await Promise.all([
    import('../src/services/chessApi'),
    import('../src/services/playerDiagnosticsService'),
    import('../src/services/chessEngineService'),
  ]);

  const username = 'hikaru';
  const timeControl = 'blitz' as const;
  const requestedGames = 20;

  console.log('MOVEWISELY LIVE CHESS.COM INTEGRATION AUDIT');
  console.log(`Source: public Chess.com profile ${username}`);
  console.log(`Time control: ${timeControl}; intended real games: ${requestedGames}`);

  const fetched = await fetchUserGames(username, 'chesscom', timeControl);
  if (fetched.isSampleFallback) {
    throw new Error('Safety check failed: real-player audit returned synthetic demo data.');
  }
  if (fetched.username.toLowerCase() !== username || fetched.platform !== 'chesscom') {
    throw new Error('Profile source mismatch; expected the real Chess.com hikaru profile.');
  }
  if (!Number.isFinite(fetched.rating) || fetched.rating <= 0) {
    throw new Error('Chess.com lookup did not return a verified positive rating.');
  }

  const games = fetched.games.filter(game => typeof game.pgn === 'string' && game.pgn.trim().length > 0).slice(0, requestedGames);
  if (games.length < requestedGames) {
    throw new Error(`Expected ${requestedGames} real PGN games, received ${games.length}.`);
  }
  if (games.some(game => game.isSynthetic === true || !game.url.includes('chess.com'))) {
    throw new Error('At least one input game is synthetic or lacks a Chess.com game URL.');
  }

  console.log(`Profile rating used: ${fetched.rating}`);
  console.log(`Fetched ${fetched.games.length} recent ${timeControl} games; analyzing ${games.length} real PGNs.`);
  for (const [index, game] of games.entries()) {
    console.log(`INPUT ${index + 1}: date=${game.date ?? 'unknown'} | ${game.white.username} vs ${game.black.username} | result=${game.result} | PGN chars=${game.pgn.length} | URL=${game.url}`);
  }

  await chessEngineService.initEngine();
  const startedAt = Date.now();
  try {
    const report = await playerDiagnosticsService.diagnosePlayer(
      username,
      'chesscom',
      timeControl,
      fetched.rating,
      games,
      {
        maxGamesToAnalyze: requestedGames,
        onProgress: (step, percent) => console.log(`PROGRESS ${percent}%: ${step}`),
      }
    );

    const durationSeconds = Math.round((Date.now() - startedAt) / 1000);
    console.log('\nLIVE DIAGNOSTICS REPORT');
    console.log(`status=${report.status}`);
    console.log(`statusMessage=${report.statusMessage ?? ''}`);
    console.log(`attempted=${report.attemptedGamesCount}; completed=${report.completedGamesCount}; partial=${report.partialGamesCount}; failed=${report.failedGamesCount}; excluded=${report.excludedGamesCount}`);
    console.log(`analyzedMoves=${report.totalAnalyzedMoves}; accuracyExperimental=${report.overallAccuracy}; harmonicAccuracyExperimental=${report.harmonicAccuracy}`);
    console.log(`blunders=${report.totalBlunders}; mistakes=${report.totalMistakes}; inaccuracies=${report.totalInaccuracies}`);
    console.log(`forkPinVulnerabilities=${report.tacticalSummary.forkPinVulnerabilities}; hangingPieces=${report.tacticalSummary.hangingPiecesLostTotal}; missedFreePieces=${report.tacticalSummary.missedFreePiecesTotal}`);
    console.log(`engineVersion=${report.engineVersion}; scoringVersion=${report.scoringVersion}; durationSeconds=${durationSeconds}`);

    for (const record of report.analyzedGameRecords) {
      console.log(
        `GAME ${record.game.id}: status=${record.status}; date=${record.game.date ?? 'unknown'}; opponent=${record.game.opponentUsername}; userMoves=${record.timeline.moves.filter(move => move.color === record.game.userColor).length}; analyzedMoves=${record.analyzedMoves.length}; accuracyExperimental=${record.userAccuracy}; error=${record.error ?? 'none'}`
      );
      for (const move of record.analyzedMoves) {
        if (!move.bestMoveUci || !move.bestMoveSan || !move.fenBefore || !move.fenAfter || !Number.isFinite(move.evalLossCp)) {
          throw new Error(`Move-level integrity failure in game ${record.game.id}, move ${move.moveNumber}: missing engine move, FEN, or finite loss value.`);
        }
        if (!/^([a-h][1-8]){2}[qrbn]?$/.test(move.bestMoveUci)) {
          throw new Error(`Malformed UCI best move ${move.bestMoveUci} in game ${record.game.id}, move ${move.moveNumber}.`);
        }
      }
    }

    // Validate every diagnostic claim against a legal position from the real analyzed sample.
    const completedGameById = new Map(
      report.analyzedGameRecords
        .filter(record => record.status === 'completed')
        .map(record => [record.game.id, record])
    );
    const validateEvidence = (evidence: {
      gameId: string; gameUrl: string; fenBefore: string; fenAfter: string;
      playedSan: string; bestMoveSan: string; moveNumber: number;
    }, label: string): void => {
      const record = completedGameById.get(evidence.gameId);
      if (!record || record.game.url !== evidence.gameUrl) {
        throw new Error(`Diagnostic evidence ${label} points outside the completed real-game sample.`);
      }
      const position = new Chess(evidence.fenBefore);
      if (!position.moves().includes(evidence.playedSan)) {
        throw new Error(`Diagnostic evidence ${label} has illegal played move ${evidence.playedSan} at move ${evidence.moveNumber}.`);
      }
      if (!position.moves().includes(evidence.bestMoveSan)) {
        throw new Error(`Diagnostic evidence ${label} has illegal engine recommendation ${evidence.bestMoveSan} at move ${evidence.moveNumber}.`);
      }
      position.move(evidence.playedSan);
      if (position.fen() !== evidence.fenAfter) {
        throw new Error(`Diagnostic evidence ${label} FEN-after does not match replay of ${evidence.playedSan}.`);
      }
    };

    console.log(`recurringWeaknesses=${report.recurringWeaknesses.length}`);
    for (const weakness of report.recurringWeaknesses) {
      const distinctEvidenceGames = new Set(weakness.evidences.map(evidence => evidence.gameId));
      if (weakness.supportingGamesCount < weakness.minimumSupportingGamesRequired
        || distinctEvidenceGames.size !== weakness.supportingGamesCount
        || weakness.supportingMovesCount !== weakness.evidences.length
        || weakness.sampleGamesCount < weakness.supportingGamesCount
        || !weakness.evidenceRule.trim()) {
        throw new Error(`Recurring weakness failed its evidence threshold/integrity checks: ${weakness.id}.`);
      }
      for (const evidence of weakness.evidences) validateEvidence(evidence, `weakness ${weakness.id}`);
      console.log(`WEAKNESS ${weakness.id}: supportingGames=${weakness.supportingGamesCount}/${weakness.sampleGamesCount}; supportingPositions=${weakness.supportingMovesCount}; rule=${weakness.evidenceRule}`);
    }

    console.log(`tacticalPatterns=${report.tacticalPatterns.length}`);
    for (const pattern of report.tacticalPatterns) {
      const evidences = pattern.sampleEvidences;
      if (pattern.occurrences <= 0 || evidences.length === 0) {
        throw new Error(`Tactical pattern lacks occurrence/evidence support: ${pattern.id}.`);
      }
      for (const evidence of evidences) validateEvidence(evidence, `tactical pattern ${pattern.id}`);
      console.log(`TACTICAL ${pattern.id}: theme=${pattern.theme}; occurrences=${pattern.occurrences}; validatedSamplePositions=${evidences.length}`);
    }

    if (report.completedGamesCount !== requestedGames || report.partialGamesCount !== 0 || report.failedGamesCount !== 0) {
      throw new Error(
        `Live analysis did not complete all games cleanly: completed=${report.completedGamesCount}, partial=${report.partialGamesCount}, failed=${report.failedGamesCount}.`
      );
    }
    if (report.totalAnalyzedMoves <= 0 || report.analyzedGameRecords.some(record => record.analyzedMoves.length === 0)) {
      throw new Error('Live engine returned no verified move analyses for at least one game.');
    }

    console.log(`\nPASS: all ${requestedGames} real Chess.com games received completed analysis and valid move-level engine evidence.`);
  } finally {
    chessEngineService.terminate();
  }
}

main().catch(error => {
  console.error('LIVE HIKARU AUDIT FAILED:', error instanceof Error ? error.stack ?? error.message : String(error));
  process.exitCode = 1;
});
