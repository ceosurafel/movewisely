import type { AnalyzedGameRecord } from './gameAnalysisService';

/**
 * Creates a standards-shaped annotated PGN from a reconstructed, legal main line.
 * Engine annotations are attached only to moves that were actually reviewed by
 * MoveWisely. The export never invents grades for opponent moves.
 */
export function buildAnnotatedPgn(record: Pick<AnalyzedGameRecord, 'game' | 'timeline' | 'analyzedMoves'>): string {
  if (!record.timeline.valid || record.timeline.moves.length === 0) {
    throw new Error('Cannot export an invalid or empty game timeline.');
  }

  const sourcePgn = record.game.pgn ?? '';
  const sourceHeaders = Array.from(
    sourcePgn.matchAll(/^\s*\[([A-Za-z0-9_]+)\s+"((?:\\\\.|[^"])*)"\]\s*$/gm)
  );
  const headers = sourceHeaders.map(match => match[0].trim());
  const headerNames = new Set(sourceHeaders.map(match => match[1].toLowerCase()));
  const getHeader = (name: string) =>
    sourceHeaders.find(match => match[1].toLowerCase() === name.toLowerCase())?.[2];

  const resultFromSource =
    getHeader('Result') ??
    sourcePgn.match(/(?:^|\s)(1-0|0-1|1\/2-1\/2|\*)\s*$/)?.[1];

  const inferredResult =
    record.game.result === 'draw'
      ? '1/2-1/2'
      : record.game.result === 'win'
        ? record.game.userColor === 'white' ? '1-0' : '0-1'
        : record.game.userColor === 'white' ? '0-1' : '1-0';
  const result = resultFromSource && /^(1-0|0-1|1\/2-1\/2|\*)$/.test(resultFromSource)
    ? resultFromSource
    : inferredResult;

  const escapeTag = (value: string) => value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  const addHeader = (name: string, value: string) => {
    if (!headerNames.has(name.toLowerCase())) {
      headers.push(`[${name} "${escapeTag(value)}"]`);
      headerNames.add(name.toLowerCase());
    }
  };

  addHeader('Event', 'MoveWisely Annotated Game Analysis');
  addHeader('White', record.game.white.username || 'White');
  addHeader('Black', record.game.black.username || 'Black');
  addHeader('Result', result);
  addHeader('Annotator', 'MoveWisely');
  addHeader('MoveWiselyScoring', 'MoveWisely Accuracy V1.1 (Experimental; Uncalibrated)');

  const moveByPly = new Map(record.analyzedMoves.map(move => [move.ply, move]));
  const bodyTokens: string[] = [];
  for (let index = 0; index < record.timeline.moves.length; index += 1) {
    const move = record.timeline.moves[index];
    const previousMove = record.timeline.moves[index - 1];
    const movePrefix = move.color === 'white'
      ? `${move.moveNumber}.`
      : (!previousMove || previousMove.color === 'black' ? `${move.moveNumber}...` : '');

    const analyzed = moveByPly.get(move.ply);
    let token = [movePrefix, move.san].filter(Boolean).join(' ');
    if (analyzed) {
      const comments = [
        `MoveWisely grade: ${analyzed.judgment.toUpperCase()}`,
        `evaluation before: ${analyzed.evalBeforeFormatted}`,
        `evaluation after: ${analyzed.evalAfterFormatted}`,
        `best move: ${analyzed.bestMoveSan}`,
        `experimental move accuracy: ${analyzed.moveAccuracyPct.toFixed(1)}%`,
        `search depth: ${analyzed.searchDepth}`,
      ];
      // PGN comments cannot nest braces; keep generated text on one line.
      token += ` { ${comments.join('; ').replace(/[{}\r\n]/g, ' ')} }`;
    }
    bodyTokens.push(token);
  }

  return `${headers.join('\n')}\n\n${bodyTokens.join(' ')} ${result}\n`;
}
