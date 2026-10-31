import React, { useMemo, useState } from 'react';
import { CheckupAnalysis } from '../types/chess';

type Evidence = {
  gameId?: string; gameUrl?: string; opponentUsername?: string; moveNumber?: number;
  fenBefore?: string; fenAfter?: string; playedSan?: string; bestMoveSan?: string;
  evalLossCp?: number; expectedPointsLoss?: number; grade?: string; theme?: string; phase?: string;
};
type Dimension = { id: string; label: string; evidence: Evidence[]; available: boolean; note?: string };
type Category = { id: string; label: string; dimensions: Dimension[] };

const asEvidence = (value: any): Evidence[] => Array.isArray(value) ? value.filter(Boolean) : [];
const unique = (items: Evidence[]) => {
  const seen = new Set<string>();
  return items.filter(item => {
    const key = [item.gameId, item.moveNumber, item.playedSan].join(':');
    if (seen.has(key)) return false;
    seen.add(key); return true;
  });
};
const severity = (e: Evidence) => Math.max(0, Number(e.evalLossCp) || 0);

export const WeaknessPentagon: React.FC<{ analysis: CheckupAnalysis }> = ({ analysis }) => {
  const [selected, setSelected] = useState('tactical');
  const [selectedDimension, setSelectedDimension] = useState<string | null>(null);
  const diagnostics: any = analysis.diagnostics ?? {};
  const records: any[] = Array.isArray(diagnostics.analyzedGameRecords) ? diagnostics.analyzedGameRecords : [];
  const openings: any[] = Array.isArray(diagnostics.openings) ? diagnostics.openings : [];
  const patterns: any[] = Array.isArray(diagnostics.tacticalPatterns) ? diagnostics.tacticalPatterns : [];
  const recurring: any[] = Array.isArray(diagnostics.recurringWeaknesses) ? diagnostics.recurringWeaknesses : [];
  const phases = diagnostics.phases ?? {};

  const categories = useMemo<Category[]>(() => {
    const openingEvidence = unique(openings.flatMap(o => asEvidence(o.evidences)));
    const tacticalEvidence = unique(patterns.flatMap(p => asEvidence(p.evidences ?? p.sampleEvidences)));
    const middleEvidence = unique([
      ...asEvidence(phases.phaseEvidences?.middlegame),
      ...recurring.filter(w => ['phases', 'blunders', 'accuracy'].includes(w.category)).flatMap(w => asEvidence(w.evidences).filter(e => e.phase === 'Middlegame')),
    ]);
    const endgameEvidence = unique(asEvidence(phases.phaseEvidences?.endgame));
    const clockEvidence = records.flatMap(record => (record.analyzedMoves ?? [])
      .filter((move: any) => Number.isFinite(move.clockTimeRemaining) || Number.isFinite(move.clockSeconds))
      .map((move: any) => ({ ...move, gameId: record.game?.id, gameUrl: record.game?.url, opponentUsername: record.game?.opponentUsername })));

    const dims = (prefix: string, names: string[], evidence: Evidence[], available = true): Dimension[] =>
      names.map((label, index) => ({
        id: prefix + '-' + index, label,
        evidence: evidence.filter(e => {
          const text = String(e.theme ?? e.grade ?? '').toLowerCase();
          if (prefix === 'tactical') {
            if (index === 0) return /hanging|free piece|queen vulnerability/.test(text);
            if (index === 1) return /fork/.test(text);
            if (index === 2) return /pin/.test(text);
            if (index === 3) return /missed threat|threat|mate/.test(text);
            return /calculation|evaluation drop|general/.test(text) || !text;
          }
          if (prefix === 'opening') return e.phase === 'Opening' || Number(e.moveNumber) <= 12;
          if (prefix === 'strategic') return e.phase === 'Middlegame';
          if (prefix === 'endgame') return e.phase === 'Endgame' || Number(e.moveNumber) >= 30;
          return Number.isFinite((e as any).clockTimeRemaining) || Number.isFinite((e as any).clockSeconds);
        })
      }));

    return [
      { id: 'opening', label: 'Opening', dimensions: dims('opening', ['Opening inaccuracies', 'Development & move-order evidence', 'King-safety evidence', 'Center-control evidence', 'Opening evaluation drops'], openingEvidence) },
      { id: 'tactical', label: 'Tactical', dimensions: dims('tactical', ['Hanging pieces & missed free pieces', 'Missed forks', 'Missed pins', 'Missed opponent threats / mates', 'Calculation & major evaluation drops'], tacticalEvidence) },
      { id: 'strategic', label: 'Strategic', dimensions: dims('strategic', ['Middlegame evaluation drops', 'Piece-activity evidence', 'Pawn-structure evidence', 'Weak-square evidence', 'Exchange-decision evidence'], middleEvidence) },
      { id: 'endgame', label: 'Endgame', dimensions: dims('endgame', ['Endgame inaccuracies', 'King-activity evidence', 'Pawn-ending evidence', 'Conversion evidence', 'Defensive-technique evidence'], endgameEvidence) },
      { id: 'time', label: 'Time Management', dimensions: dims('time', ['Time-pressure blunders', 'Clock allocation', 'Rushed decisions', 'Time-trouble frequency', 'Decision-time efficiency'], clockEvidence, clockEvidence.length > 0) },
    ];
  }, [analysis.diagnostics]);

  const category = categories.find(c => c.id === selected) ?? categories[1];
  const aggregate = categories.map(c => {
    const evidence = unique(c.dimensions.flatMap(d => d.evidence));
    const score = evidence.length
      ? Math.min(100, Math.round((Math.min(500, evidence.reduce((sum, e) => sum + severity(e), 0) / evidence.length) / 500) * 70 + Math.min(30, evidence.length * 3)))
      : null;
    return { ...c, evidence, score };
  });
  const points = aggregate.map((item, i) => {
    if (item.score === null) return null;
    const angle = (-Math.PI / 2) + i * (Math.PI * 2 / 5);
    const radius = 88 * item.score / 100;
    return [110 + Math.cos(angle) * radius, 110 + Math.sin(angle) * radius] as [number, number];
  });
  const polygon = points.every(Boolean) ? points.map(p => p!.join(',')).join(' ') : '';
  const selectedCategory = aggregate.find(c => c.id === category.id)!;
  const evidenceCount = unique(category.dimensions.flatMap(d => d.evidence)).length;
  const activeDimension = category.dimensions.find(d => d.id === selectedDimension) ?? null;
  const detailEvidence = unique(activeDimension ? activeDimension.evidence : category.dimensions.flatMap(d => d.evidence));

  return (
    <div className="w-full h-full overflow-y-auto px-5 pt-12 pb-24 bg-gradient-to-b from-[#062126] via-[#071317] to-black text-left select-text">
      <div className="mb-4">
        <span className="text-[11px] font-mono font-bold tracking-widest text-teal-400 uppercase">PLAYER DIAGNOSTIC · EVIDENCE-LED</span>
        <h2 className="text-2xl sm:text-3xl font-black text-white mt-1">Your Weakness Pentagon</h2>
        <p className="text-xs text-slate-400 mt-1">Select an axis to inspect its evidence. A missing axis means the available game data cannot measure it—not that you have no weakness.</p>
      </div>
      <div className="rounded-2xl border border-teal-900/60 bg-[#081519] p-3 mb-4">
        <div className="flex justify-center">
          <svg viewBox="0 0 220 220" role="img" aria-label="Interactive five-category chess weakness radar chart" className="w-full max-w-[330px]">
            {[20, 40, 60, 80, 100].map(r => <polygon key={r} points={Array.from({length:5},(_,i)=>{const a=-Math.PI/2+i*Math.PI*2/5;return `${110+Math.cos(a)*88*r/100},${110+Math.sin(a)*88*r/100}`}).join(' ')} fill="none" stroke="#24434a" strokeWidth="1" />)}
            {aggregate.map((item,i)=>{const a=-Math.PI/2+i*Math.PI*2/5;const x=110+Math.cos(a)*88;const y=110+Math.sin(a)*88;return <g key={item.id}><line x1="110" y1="110" x2={x} y2={y} stroke="#31545a"/><text x={110+Math.cos(a)*105} y={110+Math.sin(a)*105} fill={selected===item.id?'#5eead4':'#a8c0c4'} fontSize="9" textAnchor="middle" dominantBaseline="middle">{item.label}</text><circle cx={x} cy={y} r="10" fill={selected===item.id?'#14b8a6':'#31545a'} opacity=".9"/><circle cx={x} cy={y} r="4" fill="#d1fae5"/></g>})}
            {polygon && <polygon points={polygon} fill="#14b8a6" fillOpacity=".22" stroke="#2dd4bf" strokeWidth="2"/>}
            {aggregate.map((item,i)=>{const a=-Math.PI/2+i*Math.PI*2/5;const x=110+Math.cos(a)*88;const y=110+Math.sin(a)*88;return <g key={'hit-'+item.id} role="button" tabIndex={0} aria-label={item.label+' category'} onClick={()=>setSelected(item.id)} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();setSelected(item.id)}}}><circle cx={x} cy={y} r="17" fill="transparent" stroke="transparent"/></g>})}
          </svg>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 mt-2">
          {aggregate.map(item=><button key={item.id} type="button" onClick={()=>{setSelected(item.id);setSelectedDimension(null)}} aria-pressed={selected===item.id} className={`rounded-lg border px-2 py-2 text-left ${selected===item.id?'border-teal-400 bg-teal-950/60':'border-slate-800 bg-black/20'}`}><span className="block text-[10px] text-slate-300">{item.label}</span><strong className="text-sm text-teal-200">{item.score===null?'Not measured':`${item.score}/100`}</strong><span className="block text-[9px] text-slate-500">{item.evidence.length} evidence positions</span></button>)}
        </div>
        <p className="text-[10px] text-slate-500 mt-3">Weakness index: experimental, uncalibrated, 0–100; higher indicates more observed engine-loss evidence. It is not a chess skill rating.</p>
      </div>

      <section className="rounded-2xl border border-teal-900/60 bg-[#081519] p-4 mb-4">
        <div className="flex items-center justify-between gap-2 mb-3"><div><span className="text-[10px] uppercase tracking-widest text-teal-400">Level 2 · Category drill-down</span><h3 className="text-lg font-black text-white">{category.label} weaknesses</h3></div><span className="text-[10px] text-slate-400">{evidenceCount} linked positions</span></div>
        <div className="space-y-2">
          {category.dimensions.map(d=><button type="button" key={d.id} onClick={()=>setSelectedDimension(d.id)} aria-pressed={selectedDimension===d.id} className={`w-full text-left rounded-xl border p-3 ${selectedDimension===d.id?'border-teal-500 bg-teal-950/40':'border-slate-800 bg-black/25'}`}><div className="flex justify-between gap-2"><span className="text-xs font-semibold text-white">{d.label}</span><span className="text-[10px] text-teal-300">{d.evidence.length ? `${d.evidence.length} positions` : 'Not measured'}</span></div><p className="text-[10px] text-slate-500 mt-1">{d.evidence.length ? `Evidence across ${new Set(d.evidence.map(e=>e.gameId).filter(Boolean)).size} game(s)` : 'No verified position-level evidence for this dimension in the current analysis.'}</p></button>)}
        </div>
      </section>

      <section className="rounded-2xl border border-slate-800 bg-[#080e12] p-4">
        <h3 className="text-sm font-bold text-white mb-2">{activeDimension ? activeDimension.label : 'Exact game and move evidence'}</h3>
        {detailEvidence.length ? <div className="space-y-2">{detailEvidence.slice(0,30).map((e,i)=><article key={`${e.gameId}-${e.moveNumber}-${i}`} className="rounded-lg bg-black/30 border border-slate-800 p-3"><div className="flex justify-between gap-2"><span className="text-xs font-semibold text-white">{e.opponentUsername ? `vs ${e.opponentUsername}` : 'Analyzed game'} · move {e.moveNumber ?? '—'}</span><span className="text-[10px] text-rose-300">{e.grade ?? 'Engine evidence'}</span></div><p className="text-[11px] text-slate-300 mt-1">Played: <b>{e.playedSan ?? '—'}</b> · Engine choice: <b className="text-teal-300">{e.bestMoveSan ?? '—'}</b> · Loss: {Number.isFinite(e.evalLossCp)?`${e.evalLossCp} cp`:'not reported'}</p>{e.fenBefore&&<details className="mt-2"><summary className="cursor-pointer text-[10px] text-teal-300">Inspect position (FEN)</summary><code className="block break-all text-[9px] text-slate-400 mt-1">{e.fenBefore}</code></details>}{e.gameUrl&&<a className="inline-block mt-2 text-[10px] text-teal-300 underline" href={e.gameUrl} target="_blank" rel="noreferrer">Open source game ↗</a>}</article>)}</div> : <p className="text-xs text-slate-400">No verified positions are available for this dimension in this sample. MoveWisely leaves it unscored rather than treating missing evidence as zero weakness.</p>}
      </section>
    </div>
  );
};
