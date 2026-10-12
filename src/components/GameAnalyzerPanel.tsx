import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Chess } from 'chess.js';
import { CheckupAnalysis, GameRecord, TimeControl } from '../types/chess';
import { ChessBoardView } from './ChessBoardView';
import { gameAnalysisService, AnalyzedGameRecord } from '../services/gameAnalysisService';
import { buildAnnotatedPgn } from '../services/annotatedPgn';

interface GameAnalyzerPanelProps {
  analysis: CheckupAnalysis;
  isOpen: boolean;
  onClose: () => void;
}

type Side = 'white' | 'black';

const DEFAULT_START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

const GRADE_STYLES: Record<string, string> = {
  brilliant: 'border-fuchsia-500/40 bg-fuchsia-500/10 text-fuchsia-200',
  great: 'border-sky-500/40 bg-sky-500/10 text-sky-200',
  best: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-200',
  excellent: 'border-teal-500/40 bg-teal-500/10 text-teal-200',
  good: 'border-lime-500/40 bg-lime-500/10 text-lime-200',
  book: 'border-indigo-500/40 bg-indigo-500/10 text-indigo-200',
  miss: 'border-orange-500/40 bg-orange-500/10 text-orange-200',
  inaccuracy: 'border-yellow-500/40 bg-yellow-500/10 text-yellow-100',
  mistake: 'border-orange-500/40 bg-orange-500/10 text-orange-100',
  blunder: 'border-rose-500/40 bg-rose-500/10 text-rose-200',
};

const GRADE_DESCRIPTIONS: Record<string, string> = {
  best: 'The top engine candidate at this search setting, or a move with negligible measured loss.',
  excellent: 'A very small measured evaluation loss.',
  good: 'A modest measured evaluation loss.',
  inaccuracy: 'A noticeable evaluation loss under MoveWisely’s documented thresholds.',
  mistake: 'A large evaluation loss under MoveWisely’s documented thresholds.',
  blunder: 'A severe loss according to at least one of the grading signals.',
  brilliant: 'A heuristic contextual label for a near-best move with a detected material offer and advantage conditions. It is not a universal chess standard.',
  great: 'A heuristic contextual label for a strong move in a position where alternatives appear substantially weaker at the chosen search depth.',
  miss: 'A heuristic contextual label for failing to use an opportunity supported by the engine search.',
  book: 'The played move was recognized by MoveWisely’s included opening-book data.',
};

function headerValue(pgn: string, tag: string): string | undefined {
  const escaped = tag.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = pgn.match(new RegExp(`^\\s*\\[${escaped}\\s+"((?:\\\\.|[^"])*)"\\]\\s*$`, 'im'));
  return match?.[1]?.replace(/\\\\(["\\\\])/g, '$1');
}

function parseResult(result: string | undefined): { white: string; black: string; token: string } {
  const token = result && /^(1-0|0-1|1\/2-1\/2|\*)$/.test(result) ? result : '*';
  if (token === '1-0') return { white: 'win', black: 'loss', token };
  if (token === '0-1') return { white: 'loss', black: 'win', token };
  if (token === '1/2-1/2') return { white: 'draw', black: 'draw', token };
  return { white: 'unknown', black: 'unknown', token };
}

function sanVariation(fen: string, uciMoves: string[]): string[] {
  try {
    const chess = new Chess(fen);
    const san: string[] = [];
    for (const uci of uciMoves) {
      if (!/^[a-h][1-8][a-h][1-8][qrbn]?$/.test(uci)) break;
      const move = chess.move({
        from: uci.slice(0, 2),
        to: uci.slice(2, 4),
        ...(uci.length > 4 ? { promotion: uci.slice(4, 5) } : {}),
      });
      if (!move) break;
      san.push(move.san);
    }
    return san;
  } catch {
    return [];
  }
}

function fenAfterVariation(fen: string, uciMoves: string[], count: number): string | null {
  try {
    const chess = new Chess(fen);
    for (const uci of uciMoves.slice(0, count)) {
      const move = chess.move({
        from: uci.slice(0, 2),
        to: uci.slice(2, 4),
        ...(uci.length > 4 ? { promotion: uci.slice(4, 5) } : {}),
      });
      if (!move) return null;
    }
    return chess.fen();
  } catch {
    return null;
  }
}

function downloadText(filename: string, content: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.rel = 'noopener';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function safeFilename(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9-_]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 48) || 'game';
}

export const GameAnalyzerPanel: React.FC<GameAnalyzerPanelProps> = ({ analysis, isOpen, onClose }) => {
  const originalRecords = useMemo(() => {
    const raw = (analysis.diagnostics as { analyzedGameRecords?: AnalyzedGameRecord[] } | undefined)?.analyzedGameRecords;
    if (!Array.isArray(raw)) return [] as AnalyzedGameRecord[];
    return raw.filter(record =>
      (record.status === 'completed' || record.status === 'partial') &&
      record.timeline?.valid &&
      record.timeline.moves.length > 0 &&
      record.analyzedMoves.length > 0
    );
  }, [analysis.diagnostics]);

  const [importedRecord, setImportedRecord] = useState<AnalyzedGameRecord | null>(null);
  const [selectedId, setSelectedId] = useState('');
  const [selectedPly, setSelectedPly] = useState(1);
  const [boardOverrideFen, setBoardOverrideFen] = useState<string | null>(null);
  const [showImport, setShowImport] = useState(false);
  const [pgnInput, setPgnInput] = useState('');
  const [importSide, setImportSide] = useState<Side>('white');
  const [searchDepth, setSearchDepth] = useState<6 | 8 | 10>(8);
  const [isAnalyzingImport, setIsAnalyzingImport] = useState(false);
  const [analysisProgress, setAnalysisProgress] = useState({ percent: 0, text: '' });
  const [panelError, setPanelError] = useState<string | null>(null);
  const [showGradingMethod, setShowGradingMethod] = useState(false);
  const [activeVariation, setActiveVariation] = useState<number | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const importTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);

  const records = useMemo(
    () => importedRecord ? [...originalRecords, importedRecord] : originalRecords,
    [originalRecords, importedRecord]
  );
  const selectedRecord = records.find(record => record.game.id === selectedId) ?? records[0] ?? null;

  useEffect(() => {
    if (!isOpen) return;
    returnFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    dialogRef.current?.focus();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !isAnalyzingImport) {
        event.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      returnFocusRef.current?.focus();
      returnFocusRef.current = null;
    };
  }, [isOpen, isAnalyzingImport, onClose]);

  useEffect(() => {
    if (!isOpen || records.length === 0) return;
    if (!records.some(record => record.game.id === selectedId)) {
      const first = records[0];
      setSelectedId(first.game.id);
      const firstUserMove = first.timeline.moves.find(move => move.color === first.game.userColor);
      setSelectedPly(firstUserMove?.ply ?? first.timeline.moves[0].ply);
      setBoardOverrideFen(null);
      setActiveVariation(null);
    }
  }, [isOpen, records, selectedId]);

  const selectedTimelineMove = selectedRecord?.timeline.moves.find(move => move.ply === selectedPly)
    ?? selectedRecord?.timeline.moves[0]
    ?? null;
  const selectedAnalysisMove = selectedRecord?.analyzedMoves.find(move => move.ply === selectedTimelineMove?.ply) ?? null;
  const timelineMoves = selectedRecord?.timeline.moves ?? [];
  const selectedMoveIndex = Math.max(0, timelineMoves.findIndex(move => move.ply === selectedTimelineMove?.ply));

  const graph = useMemo(() => {
    if (!selectedRecord || selectedRecord.analyzedMoves.length === 0) {
      return { points: [] as Array<{ x: number; y: number; ply: number; score: number }>, line: '', scale: 2 };
    }
    const scores = selectedRecord.analyzedMoves.map(move => move.evalCpBefore);
    const maxAbs = Math.max(200, ...scores.map(score => Math.abs(score)));
    const scale = Math.min(1200, maxAbs);
    const points = selectedRecord.analyzedMoves.map((move, index) => {
      const x = selectedRecord.analyzedMoves.length === 1
        ? 300
        : 36 + index * (528 / (selectedRecord.analyzedMoves.length - 1));
      const bounded = Math.max(-scale, Math.min(scale, move.evalCpBefore));
      const y = 82 - (bounded / scale) * 58;
      return { x, y, ply: move.ply, score: move.evalCpBefore };
    });
    return { points, line: points.map(point => `${point.x},${point.y}`).join(' '), scale };
  }, [selectedRecord]);

  const changeGame = (gameId: string) => {
    const next = records.find(record => record.game.id === gameId);
    setSelectedId(gameId);
    const firstUserMove = next?.timeline.moves.find(move => move.color === next.game.userColor);
    setSelectedPly(firstUserMove?.ply ?? next?.timeline.moves[0]?.ply ?? 1);
    setBoardOverrideFen(null);
    setActiveVariation(null);
    setPanelError(null);
  };

  const selectPly = (ply: number) => {
    setSelectedPly(ply);
    setBoardOverrideFen(null);
    setActiveVariation(null);
  };

  const handlePgnFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setPanelError(null);
    if (file.size > 1_000_000) {
      setPanelError('This PGN file is larger than 1 MB. Paste a smaller PGN or split it into separate games.');
      event.target.value = '';
      return;
    }
    try {
      setPgnInput(await file.text());
      setShowImport(true);
    } catch {
      setPanelError('The PGN file could not be read. Try opening it and pasting its text instead.');
    }
    event.target.value = '';
  };

  const analyzeImportedPgn = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setPanelError(null);
    const pgn = pgnInput.trim();
    if (!pgn) {
      setPanelError('Paste a PGN game or choose a .pgn file first.');
      return;
    }

    const timeline = gameAnalysisService.reconstructTimeline(pgn);
    if (!timeline.valid || timeline.moves.length === 0) {
      setPanelError(timeline.error || 'This PGN does not contain a complete, legal move sequence.');
      return;
    }

    const whiteName = headerValue(pgn, 'White') || 'White';
    const blackName = headerValue(pgn, 'Black') || 'Black';
    const rawResult = headerValue(pgn, 'Result') || pgn.match(/(?:^|\s)(1-0|0-1|1\/2-1\/2|\*)\s*$/)?.[1];
    const result = parseResult(rawResult);
    const userName = importSide === 'white' ? whiteName : blackName;
    const opponentName = importSide === 'white' ? blackName : whiteName;
    const importedGame: GameRecord = {
      id: `imported-pgn-${Date.now()}`,
      url: '',
      white: { username: whiteName, rating: Number(headerValue(pgn, 'WhiteElo')) || null, result: result.white },
      black: { username: blackName, rating: Number(headerValue(pgn, 'BlackElo')) || null, result: result.black },
      userColor: importSide,
      userRating: Number(headerValue(pgn, importSide === 'white' ? 'WhiteElo' : 'BlackElo')) || 0,
      opponentUsername: opponentName,
      opponentRating: Number(headerValue(pgn, importSide === 'white' ? 'BlackElo' : 'WhiteElo')) || null,
      result: result[importSide] === 'win' || result[importSide] === 'loss' ? result[importSide] : 'draw',
      termination: 'Imported PGN',
      timeControl: analysis.timeControl as TimeControl,
      timeClass: analysis.timeControl,
      date: headerValue(pgn, 'Date') || null,
      pgn,
      movesCount: Math.ceil(timeline.moves.length / 2),
      eco: headerValue(pgn, 'ECO'),
      openingName: headerValue(pgn, 'Opening'),
    };

    const controller = new AbortController();
    abortRef.current?.abort();
    abortRef.current = controller;
    setIsAnalyzingImport(true);
    setAnalysisProgress({ percent: 1, text: 'Preparing local Stockfish analysis' });

    try {
      const resultRecord = await gameAnalysisService.analyzeGame(importedGame, {
        depth: searchDepth,
        multiPv: 3,
        signal: controller.signal,
        onProgress: progress => setAnalysisProgress({ percent: progress.percent, text: progress.statusText }),
      });
      if (controller.signal.aborted) return;
      if (resultRecord.analyzedMoves.length === 0) {
        throw new Error(resultRecord.error || 'The selected side has no moves that could be analyzed.');
      }
      setImportedRecord(resultRecord);
      setSelectedId(importedGame.id);
      const firstUserMove = resultRecord.timeline.moves.find(move => move.color === importSide);
      setSelectedPly(firstUserMove?.ply ?? resultRecord.timeline.moves[0].ply);
      setBoardOverrideFen(null);
      setActiveVariation(null);
      setShowImport(false);
      setAnalysisProgress({ percent: 100, text: 'PGN analysis complete' });
    } catch (error) {
      if (!controller.signal.aborted) {
        setPanelError(error instanceof Error ? error.message : 'The PGN could not be analyzed.');
      }
    } finally {
      if (abortRef.current === controller) abortRef.current = null;
      setIsAnalyzingImport(false);
    }
  };

  const cancelImportedAnalysis = () => {
    abortRef.current?.abort();
    setIsAnalyzingImport(false);
    setAnalysisProgress({ percent: 0, text: 'Analysis cancelled' });
  };

  const downloadAnnotatedPgn = () => {
    if (!selectedRecord) return;
    try {
      const pgn = buildAnnotatedPgn(selectedRecord);
      downloadText(`${safeFilename(selectedRecord.game.opponentUsername)}-movewisely-annotated.pgn`, pgn, 'application/x-chess-pgn;charset=utf-8');
      setPanelError(null);
    } catch (error) {
      setPanelError(error instanceof Error ? error.message : 'Could not export annotated PGN.');
    }
  };

  const movesInVariation = selectedAnalysisMove
    ? selectedAnalysisMove.pvs.map(pv => ({ ...pv, sanMoves: sanVariation(selectedTimelineMove?.fenBefore ?? DEFAULT_START_FEN, pv.pvMoves) }))
    : [];

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-[#030709]/95 backdrop-blur-sm px-0 py-0 sm:p-4">
      <section
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="game-analyzer-title"
        tabIndex={-1}
        className="relative flex h-[100dvh] w-full max-w-7xl flex-col overflow-hidden bg-[#071014] text-[#e6f1f2] sm:h-[min(940px,96dvh)] sm:rounded-2xl sm:border sm:border-teal-900/70 sm:shadow-2xl"
      >
        <header className="flex shrink-0 items-center justify-between gap-3 border-b border-white/10 bg-[#081519] px-4 py-3 sm:px-6">
          <div className="min-w-0">
            <p className="text-[10px] font-mono font-bold uppercase tracking-[0.2em] text-teal-300">MoveWisely · Stockfish 19</p>
            <h2 id="game-analyzer-title" className="truncate text-lg font-black text-white sm:text-2xl">Move-by-Move Analyzer</h2>
            <p className="text-[11px] text-slate-400">Engine review is local to this browser. Scores and grades are search-setting dependent.</p>
          </div>
          <button type="button" onClick={onClose} disabled={isAnalyzingImport} aria-label="Close move analyzer" className="rounded-lg border border-white/15 px-3 py-2 text-sm text-slate-200 hover:bg-white/10 disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-300">Close</button>
        </header>

        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto lg:flex-row lg:overflow-hidden">
          <aside className="shrink-0 border-b border-white/10 bg-[#081216] p-3 lg:w-72 lg:overflow-y-auto lg:border-b-0 lg:border-r lg:p-4">
            <label htmlFor="analyzer-game" className="mb-1.5 block text-xs font-semibold text-slate-300">Game to review</label>
            <select id="analyzer-game" value={selectedRecord?.game.id ?? ''} onChange={event => changeGame(event.target.value)} disabled={records.length === 0 || isAnalyzingImport} className="w-full rounded-lg border border-teal-900/70 bg-[#060c0f] px-3 py-2.5 text-xs text-white focus:outline-none focus:ring-2 focus:ring-teal-300">
              {records.length === 0 && <option value="">No reviewed games</option>}
              {originalRecords.map((record, index) => (
                <option key={record.game.id} value={record.game.id}>
                  {index + 1}. vs {record.game.opponentUsername} · {record.status === 'partial' ? 'Partial' : 'Reviewed'}
                </option>
              ))}
              {importedRecord && <option value={importedRecord.game.id}>Imported PGN · {importedRecord.game.opponentUsername}</option>}
            </select>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <div className="rounded-lg border border-white/10 bg-black/20 p-2.5">
                <p className="text-[10px] text-slate-500">Reviewed moves</p>
                <p className="text-lg font-bold text-white">{selectedRecord?.analyzedMoves.length ?? 0}</p>
              </div>
              <div className="rounded-lg border border-white/10 bg-black/20 p-2.5">
                <p className="text-[10px] text-slate-500">Move accuracy*</p>
                <p className="text-lg font-bold text-teal-200">{selectedRecord ? `${selectedRecord.userAccuracy.toFixed(1)}%` : '—'}</p>
              </div>
            </div>
            <p className="mt-2 text-[10px] leading-relaxed text-slate-500">*MoveWisely’s internal accuracy estimate; experimental and not calibrated to Chess.com or Lichess.</p>

            <div className="mt-4 flex gap-2">
              <button type="button" onClick={() => { setShowImport(value => !value); setPanelError(null); }} className="flex-1 rounded-lg border border-teal-700/60 bg-teal-900/20 px-2.5 py-2 text-xs font-semibold text-teal-200 hover:bg-teal-900/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-300">
                {showImport ? 'Hide PGN import' : 'Import PGN'}
              </button>
              <button type="button" onClick={downloadAnnotatedPgn} disabled={!selectedRecord?.timeline.valid || isAnalyzingImport} className="flex-1 rounded-lg border border-white/15 px-2.5 py-2 text-xs font-semibold text-slate-200 hover:bg-white/10 disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-300">
                Export PGN
              </button>
            </div>

            {showImport && (
              <form onSubmit={analyzeImportedPgn} className="mt-3 space-y-3 rounded-xl border border-teal-900/60 bg-black/20 p-3">
                <div>
                  <label htmlFor="pgn-file" className="mb-1 block text-xs font-semibold text-slate-300">Choose a PGN file (max 1 MB)</label>
                  <input id="pgn-file" type="file" accept=".pgn,.txt,text/plain,application/x-chess-pgn" onChange={handlePgnFile} disabled={isAnalyzingImport} className="block w-full text-[11px] text-slate-400 file:mr-2 file:rounded-md file:border-0 file:bg-teal-500/15 file:px-2 file:py-1.5 file:text-[11px] file:font-semibold file:text-teal-100" />
                </div>
                <label htmlFor="pgn-text" className="block text-xs font-semibold text-slate-300">Or paste one PGN game</label>
                <textarea ref={importTextareaRef} id="pgn-text" value={pgnInput} onChange={event => setPgnInput(event.target.value)} rows={5} disabled={isAnalyzingImport} placeholder={'[Event "Casual Game"]\n[White "Player"]\n[Black "Opponent"]\n\n1. e4 e5 2. Nf3 Nc6 ...'} className="w-full resize-y rounded-lg border border-white/15 bg-[#05090c] p-2 text-[11px] leading-relaxed text-slate-200 placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-teal-300" />
                <div className="grid grid-cols-2 gap-2">
                  <label className="flex items-center gap-2 rounded-lg border border-white/10 p-2 text-xs text-slate-300">
                    <input type="radio" name="import-side" value="white" checked={importSide === 'white'} onChange={() => setImportSide('white')} disabled={isAnalyzingImport} />
                    Analyze White
                  </label>
                  <label className="flex items-center gap-2 rounded-lg border border-white/10 p-2 text-xs text-slate-300">
                    <input type="radio" name="import-side" value="black" checked={importSide === 'black'} onChange={() => setImportSide('black')} disabled={isAnalyzingImport} />
                    Analyze Black
                  </label>
                </div>
                <label htmlFor="search-depth" className="block text-xs font-semibold text-slate-300">Engine search depth</label>
                <select id="search-depth" value={searchDepth} onChange={event => setSearchDepth(Number(event.target.value) as 6 | 8 | 10)} disabled={isAnalyzingImport} className="w-full rounded-lg border border-white/15 bg-[#05090c] px-2 py-2 text-xs text-white focus:outline-none focus:ring-2 focus:ring-teal-300">
                  <option value={6}>6 · Faster</option>
                  <option value={8}>8 · Recommended</option>
                  <option value={10}>10 · Deeper, slower</option>
                </select>
                <p className="text-[10px] leading-relaxed text-slate-500">Analyzes the selected side’s legal moves in your browser. Longer games and higher depth can take several minutes. PGN content is not uploaded by this feature.</p>
                {!isAnalyzingImport ? (
                  <button type="submit" className="w-full rounded-lg bg-teal-400 px-3 py-2.5 text-xs font-bold text-slate-950 hover:bg-teal-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white">Analyze imported PGN</button>
                ) : (
                  <div className="space-y-2">
                    <div className="flex justify-between gap-2 text-[10px] text-teal-200"><span>{analysisProgress.text || 'Analyzing with Stockfish…'}</span><span>{analysisProgress.percent}%</span></div>
                    <div className="h-1.5 overflow-hidden rounded bg-white/10"><div className="h-full bg-teal-400 transition-all" style={{ width: `${analysisProgress.percent}%` }} /></div>
                    <button type="button" onClick={cancelImportedAnalysis} className="w-full rounded-lg border border-rose-800/60 px-3 py-2 text-xs text-rose-200 hover:bg-rose-950/40">Cancel analysis</button>
                  </div>
                )}
              </form>
            )}
            {panelError && <p role="alert" className="mt-3 rounded-lg border border-rose-900/70 bg-rose-950/30 p-3 text-[11px] leading-relaxed text-rose-200">{panelError}</p>}

            <div className="mt-4 border-t border-white/10 pt-3">
              <h3 className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-300">Game moves</h3>
              {selectedRecord ? (
                <div className="grid grid-cols-2 gap-1.5">
                  {timelineMoves.map((move, index) => {
                    const gradedMove = selectedRecord.analyzedMoves.find(item => item.ply === move.ply);
                    const isSelected = move.ply === selectedTimelineMove?.ply;
                    return (
                      <button
                        key={`${selectedRecord.game.id}-ply-${move.ply}`}
                        type="button"
                        onClick={() => selectPly(move.ply)}
                        aria-current={isSelected ? 'true' : undefined}
                        className={`flex min-w-0 items-center justify-between gap-1 rounded-lg border px-2 py-2 text-left text-[11px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-300 ${isSelected ? 'border-teal-300 bg-teal-500/15 text-white' : 'border-white/5 bg-black/10 text-slate-300 hover:bg-white/5'}`}
                      >
                        <span className="truncate"><span className="mr-1 text-slate-500">{move.moveNumber}{move.color === 'white' ? '.' : '...'}</span>{move.san}</span>
                        {gradedMove ? <span title={gradedMove.judgment} className={`shrink-0 rounded border px-1 py-0.5 text-[8px] uppercase ${GRADE_STYLES[gradedMove.judgment] ?? 'border-white/10 text-slate-300'}`}>{gradedMove.judgment}</span> : <span className="shrink-0 text-[9px] text-slate-600">—</span>}
                      </button>
                    );
                  })}
                </div>
              ) : (
                <p className="text-xs text-slate-500">Run a checkup or import a PGN to populate the move list.</p>
              )}
            </div>
          </aside>

          <main className="min-w-0 flex-1 overflow-y-auto p-3 sm:p-5 lg:p-6">
            {!selectedRecord || !selectedTimelineMove ? (
              <div className="flex min-h-64 flex-col items-center justify-center rounded-xl border border-dashed border-white/15 p-8 text-center">
                <span className="text-3xl text-teal-300">♞</span>
                <h3 className="mt-3 text-lg font-bold text-white">No move-reviewed games available</h3>
                <p className="mt-2 max-w-md text-sm leading-relaxed text-slate-400">Choose a game with engine-reviewed moves or import a PGN. The game analyzer uses the existing checkup’s move evidence whenever available.</p>
                <button type="button" onClick={() => { setShowImport(true); window.setTimeout(() => importTextareaRef.current?.focus(), 0); }} className="mt-4 rounded-lg bg-teal-400 px-4 py-2 text-xs font-bold text-slate-950">Import a PGN</button>
              </div>
            ) : (
              <div className="mx-auto max-w-5xl space-y-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-[10px] font-mono uppercase tracking-widest text-teal-300">{selectedRecord.game.userColor === 'white' ? 'White to analyze' : 'Black to analyze'} · {selectedRecord.status === 'partial' ? 'Partial engine review' : 'Engine-reviewed game'}</p>
                    <h3 className="mt-1 text-xl font-black text-white sm:text-2xl">vs {selectedRecord.game.opponentUsername}</h3>
                    <p className="mt-1 text-xs text-slate-400">{selectedRecord.game.date || 'Date unavailable'} · {selectedRecord.timeline.moves.length} plies · {selectedRecord.game.timeClass || selectedRecord.game.timeControl}</p>
                  </div>
                  <div className="flex gap-2">
                    <button type="button" disabled={selectedMoveIndex <= 0} onClick={() => selectPly(timelineMoves[selectedMoveIndex - 1].ply)} className="rounded-lg border border-white/15 px-3 py-2 text-xs text-white disabled:opacity-35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-300">← Previous</button>
                    <button type="button" disabled={selectedMoveIndex >= timelineMoves.length - 1} onClick={() => selectPly(timelineMoves[selectedMoveIndex + 1].ply)} className="rounded-lg border border-white/15 px-3 py-2 text-xs text-white disabled:opacity-35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-300">Next →</button>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(260px,0.92fr)_minmax(0,1.08fr)]">
                  <div className="space-y-3">
                    <div className="overflow-hidden rounded-xl border border-white/10 bg-[#0b151a] p-3 sm:p-4">
                      <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <p className="text-[10px] uppercase tracking-wider text-slate-500">Position before selected move</p>
                          <p className="mt-0.5 text-sm font-bold text-white">{selectedTimelineMove.moveNumber}{selectedTimelineMove.color === 'white' ? '.' : '...'} {selectedTimelineMove.san}</p>
                        </div>
                        {selectedAnalysisMove ? (
                          <span className={`rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase ${GRADE_STYLES[selectedAnalysisMove.judgment] ?? 'border-white/10 text-slate-200'}`}>{selectedAnalysisMove.judgment}</span>
                        ) : (
                          <span className="rounded-full border border-white/10 px-2.5 py-1 text-[10px] text-slate-400">{selectedTimelineMove.color === selectedRecord.game.userColor ? 'Not analyzed' : 'Opponent move'}</span>
                        )}
                      </div>
                      <ChessBoardView
                        key={`${selectedRecord.game.id}-${selectedPly}-${boardOverrideFen ?? ''}`}
                        initialFen={boardOverrideFen ?? selectedTimelineMove.fenBefore}
                        fenAfterUserMove={selectedTimelineMove.fenAfter}
                        bestMoveFrom={selectedAnalysisMove?.bestMoveFrom}
                        bestMoveTo={selectedAnalysisMove?.bestMoveTo}
                        userMoveFrom={selectedTimelineMove.from}
                        userMoveTo={selectedTimelineMove.to}
                        orientation={selectedRecord.game.userColor}
                        interactive={true}
                      />
                      <div className="mt-3 flex flex-wrap gap-2">
                        <button type="button" onClick={() => setBoardOverrideFen(null)} disabled={!boardOverrideFen} className="rounded-lg border border-white/15 px-3 py-2 text-[11px] text-slate-300 disabled:opacity-35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-300">Return to selected position</button>
                        {selectedAnalysisMove && <span className="self-center text-[10px] text-slate-500">Red: played move · Green: engine recommendation</span>}
                      </div>
                    </div>

                    {selectedAnalysisMove && (
                      <div className="grid grid-cols-2 gap-2">
                        <div className="rounded-xl border border-white/10 bg-[#0a1419] p-3">
                          <p className="text-[10px] text-slate-500">Before the move</p>
                          <p className="mt-1 font-mono text-lg font-bold text-white">{selectedAnalysisMove.evalBeforeFormatted}</p>
                        </div>
                        <div className="rounded-xl border border-white/10 bg-[#0a1419] p-3">
                          <p className="text-[10px] text-slate-500">After the move</p>
                          <p className="mt-1 font-mono text-lg font-bold text-white">{selectedAnalysisMove.evalAfterFormatted}</p>
                        </div>
                        <div className="rounded-xl border border-white/10 bg-[#0a1419] p-3">
                          <p className="text-[10px] text-slate-500">Evaluation loss</p>
                          <p className="mt-1 font-mono text-lg font-bold text-amber-200">{selectedAnalysisMove.evalLossCp} cp</p>
                        </div>
                        <div className="rounded-xl border border-white/10 bg-[#0a1419] p-3">
                          <p className="text-[10px] text-slate-500">Experimental move accuracy</p>
                          <p className="mt-1 font-mono text-lg font-bold text-teal-200">{selectedAnalysisMove.moveAccuracyPct.toFixed(1)}%</p>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="space-y-4">
                    <section className="rounded-xl border border-white/10 bg-[#0b151a] p-4">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <h4 className="text-sm font-bold text-white">Position evaluation</h4>
                        <span className="text-[10px] text-slate-500">Your perspective · sampled at your turns</span>
                      </div>
                      {graph.points.length > 0 ? (
                        <>
                          <svg viewBox="0 0 600 112" role="img" aria-label="Line chart of engine evaluations immediately before each reviewed player move, from the player's perspective" className="mt-3 block w-full overflow-visible">
                            <line x1="28" y1="82" x2="572" y2="82" stroke="#64748b" strokeOpacity="0.65" strokeDasharray="5 4" />
                            <line x1="28" y1="16" x2="28" y2="96" stroke="#334155" />
                            <polyline points={graph.line} fill="none" stroke="#2dd4bf" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
                            {graph.points.map(point => (
                              <circle
                                key={point.ply}
                                cx={point.x}
                                cy={point.y}
                                r={point.ply === selectedTimelineMove.ply ? 5 : 3}
                                fill={point.ply === selectedTimelineMove.ply ? '#fbbf24' : '#2dd4bf'}
                                stroke="#071014"
                                strokeWidth="1.5"
                                role="button"
                                tabIndex={0}
                                aria-label={`Select move at ply ${point.ply}, player-perspective evaluation ${(point.score / 100).toFixed(2)} pawns`}
                                onClick={() => selectPly(point.ply)}
                                onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); selectPly(point.ply); } }}
                                className="cursor-pointer focus:outline-none"
                              />
                            ))}
                            <text x="32" y="12" fill="#94a3b8" fontSize="10">Advantage for you ↑</text>
                            <text x="32" y="108" fill="#94a3b8" fontSize="10">Disadvantage for you ↓</text>
                          </svg>
                          <div className="mt-2 flex flex-wrap gap-2">
                            {selectedRecord.analyzedMoves.filter(move => move.standardGrade === 'blunder' || move.standardGrade === 'mistake' || move.standardGrade === 'inaccuracy').slice(0, 8).map(move => (
                              <button key={move.ply} type="button" onClick={() => selectPly(move.ply)} className={`rounded-lg border px-2.5 py-1.5 text-[10px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-300 ${GRADE_STYLES[move.judgment] ?? 'border-white/10 text-slate-200'}`}>
                                {move.moveNumber}. {move.san} · {move.judgment}
                              </button>
                            ))}
                          </div>
                        </>
                      ) : (
                        <p className="mt-3 text-xs leading-relaxed text-slate-400">No graded move evaluations are available for this game.</p>
                      )}
                      <p className="mt-3 text-[10px] leading-relaxed text-slate-500">This plot shows positions before the analyzed player’s moves, not every ply in the game. Centipawn equivalents and the separate MoveWisely score proxy are engine- and search-dependent.</p>
                    </section>

                    <section className="rounded-xl border border-white/10 bg-[#0b151a] p-4">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <h4 className="text-sm font-bold text-white">Best move and principal variation</h4>
                        {selectedAnalysisMove && <span className="text-[10px] text-slate-500">Depth {selectedAnalysisMove.searchDepth} · {selectedAnalysisMove.searchNodes.toLocaleString()} nodes</span>}
                      </div>
                      {selectedAnalysisMove ? (
                        <>
                          <div className="mt-3 rounded-lg border border-emerald-700/40 bg-emerald-950/20 p-3">
                            <p className="text-[10px] uppercase tracking-wider text-emerald-300">Engine's top candidate</p>
                            <p className="mt-1 text-xl font-black text-white">{selectedAnalysisMove.bestMoveSan}</p>
                            <p className="mt-1 text-[11px] text-slate-400">Played move: {selectedAnalysisMove.san}. {selectedAnalysisMove.isContextual && selectedAnalysisMove.contextualReason ? selectedAnalysisMove.contextualReason : GRADE_DESCRIPTIONS[selectedAnalysisMove.judgment] ?? 'Move grade based on the documented MoveWisely engine convention.'}</p>
                          </div>
                          <div className="mt-3 space-y-3">
                            {movesInVariation.slice(0, 3).map((pv, index) => (
                              <div key={`${pv.multipv}-${index}`} className="rounded-lg border border-white/10 bg-black/15 p-3">
                                <div className="flex items-center justify-between gap-2">
                                  <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">{index === 0 ? 'Principal line' : `Alternative ${pv.multipv}`}</span>
                                  <span className="font-mono text-[10px] text-teal-200">{pv.score.formatted}</span>
                                </div>
                                <div className="mt-2 flex flex-wrap gap-1.5">
                                  {pv.sanMoves.slice(0, 12).map((san, sanIndex) => (
                                    <button key={`${pv.multipv}-${sanIndex}-${san}`} type="button" title={`Show position after ${sanIndex + 1} move(s) of this engine line`} onClick={() => {
                                      const fen = fenAfterVariation(selectedTimelineMove.fenBefore, pv.pvMoves, sanIndex + 1);
                                      if (fen) {
                                        setBoardOverrideFen(fen);
                                        setActiveVariation(pv.multipv);
                                      }
                                    }} className="rounded border border-white/10 px-1.5 py-1 text-[11px] text-slate-200 hover:border-teal-500/50 hover:bg-teal-500/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-300">
                                      {san}
                                    </button>
                                  ))}
                                </div>
                              </div>
                            ))}
                            {movesInVariation.length === 0 && <p className="text-xs text-slate-400">No legal principal variation was returned for this position (terminal positions may have none).</p>}
                            {activeVariation !== null && boardOverrideFen && <p role="status" className="text-[10px] text-teal-200">Board shows a position from engine line {activeVariation}. Select “Return to selected position” to reset it.</p>}
                          </div>
                        </>
                      ) : (
                        <p className="mt-3 text-xs leading-relaxed text-slate-400">This move has no engine grade in the selected record. The checkup currently deep-reviews the selected player’s moves; import a PGN and choose White or Black to analyze the other side.</p>
                      )}
                    </section>

                    <section className="rounded-xl border border-white/10 bg-[#0b151a] p-4">
                      <button type="button" onClick={() => setShowGradingMethod(value => !value)} aria-expanded={showGradingMethod} className="flex w-full items-center justify-between gap-2 text-left text-sm font-bold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-300">
                        <span>How MoveWisely grades moves</span><span>{showGradingMethod ? '−' : '+'}</span>
                      </button>
                      {showGradingMethod && (
                        <div className="mt-3 space-y-3 text-[11px] leading-relaxed text-slate-300">
                          <p>MoveWisely evaluates the position before and after the played move. Centipawn-equivalent loss and the separate logistic score-proxy loss are each classified; the more severe tier is used.</p>
                          <div className="overflow-x-auto">
                            <table className="w-full min-w-[410px] border-collapse text-left">
                              <thead><tr className="border-b border-white/10 text-slate-400"><th className="py-2 pr-3">Grade tier</th><th className="py-2 pr-3">Centipawn loss</th><th className="py-2">Score-proxy loss</th></tr></thead>
                              <tbody>
                                {[
                                  ['Best', '≤ 5 cp', '≤ 0.015'],
                                  ['Excellent', '≤ 25 cp', '≤ 0.035'],
                                  ['Good', '≤ 65 cp', '≤ 0.080'],
                                  ['Inaccuracy', '≤ 140 cp', '≤ 0.160'],
                                  ['Mistake', '≤ 280 cp', '≤ 0.300'],
                                  ['Blunder', '> 280 cp', '> 0.300'],
                                ].map(row => <tr key={row[0]} className="border-b border-white/5"><td className="py-1.5 pr-3">{row[0]}</td><td className="py-1.5 pr-3">{row[1]}</td><td className="py-1.5">{row[2]}</td></tr>)}
                              </tbody>
                            </table>
                          </div>
                          <p>Each loss signal receives its own tier; the more severe tier becomes the standard grade. Contextual grades (Book, Brilliant, Great and Miss) are heuristics with separate evidence rules, not universal standards. Search depth and engine choices can change the result.</p>
                          <p>Method: <a href="https://github.com/ceosurafel/movewisely/blob/main/docs/accuracy_methodology.md" target="_blank" rel="noopener noreferrer" className="text-teal-300 underline">MoveWisely Accuracy Methodology V1.1</a>. This score is experimental and uncalibrated, not the accuracy score reported by Chess.com or Lichess.</p>
                        </div>
                      )}
                    </section>
                  </div>
                </div>
              </div>
            )}
          </main>
        </div>
      </section>
    </div>
  );
};
