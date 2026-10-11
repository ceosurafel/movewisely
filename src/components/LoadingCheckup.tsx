import React from 'react';
import { Platform, TimeControl } from '../types/chess';

interface LoadingCheckupProps {
  username: string;
  platform: Platform;
  timeControl: TimeControl;
  currentRating: number;
  targetMilestone: number;
  progress: number;
  step: string;
  currentGame: number;
  totalGames: number;
}

const DIAGNOSTICS = [
  { label: 'Blunders', icon: '◉', color: '#fb7185', start: 0, end: 27 },
  { label: 'Missed tactics', icon: '⌕', color: '#f59e0b', start: 27, end: 46 },
  { label: 'Openings', icon: '▥', color: '#38bdf8', start: 46, end: 63 },
  { label: 'Winning positions', icon: '♛', color: '#fbbf24', start: 63, end: 80 },
  { label: 'Accuracy', icon: '◎', color: '#2dd4bf', start: 80, end: 100 },
];

function clampPercent(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, value));
}

export const LoadingCheckup: React.FC<LoadingCheckupProps> = ({
  username,
  platform,
  timeControl,
  currentRating,
  targetMilestone,
  progress,
  step,
  currentGame,
  totalGames,
}) => {
  const percent = clampPercent(progress);
  const safeTotal = Math.max(0, totalGames);
  const gameLabel = currentGame > 0 && safeTotal > 0
    ? `Game ${Math.min(currentGame, safeTotal)} of ${safeTotal}`
    : 'Preparing your scan';
  const statusCopy = percent >= 88
    ? 'Building your personal training plan…'
    : percent >= 80
      ? 'Checking move accuracy…'
      : percent >= 63
        ? 'Reviewing winning positions…'
        : percent >= 46
          ? 'Reviewing your openings…'
          : percent >= 27
            ? 'Scanning missed tactical chances…'
            : 'Checking your games against';

  const chartPath = 'M 14 104 C 48 104, 70 94, 98 79 S 158 40, 220 18';

  return (
    <section className="relative min-h-[100dvh] bg-[#050607] text-[#f2f5f5] overflow-hidden">
      <div className="absolute top-0 left-0 right-0 h-[3px] bg-white/[0.06]">
        <div className="h-full bg-[#24d9c7] transition-all duration-500 ease-out" style={{ width: `${percent}%` }} />
      </div>
      <div className="absolute top-4 right-4 sm:right-7 flex items-center gap-2 text-[10px] sm:text-xs text-slate-500">
        <span className="h-1.5 w-1.5 rounded-full bg-[#28dccc] animate-pulse" />
        <span>SCANNING YOUR GAMES</span>
        <span className="font-mono text-[#28dccc]">{Math.round(percent)}%</span>
      </div>

      <div className="relative z-10 min-h-[100dvh] flex items-center justify-center px-4 py-16">
        <div className="w-full max-w-[420px]">
          <div className="flex items-center gap-3 mb-4">
            <div className="shrink-0 w-8 h-8 rounded-xl bg-[#092f2d] border border-[#155651] flex items-center justify-center text-[#31ddce] text-lg" aria-hidden="true">♟</div>
            <div className="min-w-0 flex-1 rounded-xl rounded-tl-sm bg-[#1a1a1f] border border-white/[0.035] px-3.5 py-3">
              <div className="text-[12px] sm:text-[13px] leading-relaxed text-slate-200">
                {statusCopy}{' '}
                {percent < 27 && <span className="text-[#28dccc] font-bold">{targetMilestone}-rated players…</span>}
                {percent >= 27 && <span className="text-[#28dccc] font-semibold">{username}</span>}
              </div>
              <div className="flex items-center justify-between mt-1.5 text-[10px] text-slate-500">
                <span>{gameLabel}</span>
                <span>{platform === 'chesscom' ? 'Chess.com' : 'Lichess'} · {timeControl.toUpperCase()}</span>
              </div>
            </div>
            <div
              className="relative shrink-0 w-12 h-12 rounded-full flex items-center justify-center"
              style={{ background: `conic-gradient(#25d9c8 ${percent * 3.6}deg, #20272a 0deg)` }}
              role="progressbar"
              aria-label="Game analysis progress"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(percent)}
            >
              <div className="absolute inset-[4px] rounded-full bg-[#080b0d] flex flex-col items-center justify-center">
                <span className="text-[12px] font-bold text-white leading-none">{Math.round(percent)}%</span>
                <span className="text-[7px] tracking-wide text-slate-600 mt-0.5">SCANNED</span>
              </div>
            </div>
          </div>

          <div className="rounded-2xl bg-[#1a1a1f] border border-white/[0.045] px-4 py-4 shadow-[0_16px_40px_rgba(0,0,0,.18)]">
            <div className="flex items-start justify-between">
              <div>
                <span className="block text-[9px] uppercase tracking-[.16em] text-slate-600 mb-1">Now</span>
                <span className="text-[13px] font-bold tabular-nums text-white">{Math.round(currentRating)}</span>
              </div>
              <div className="text-right">
                <span className="block text-[9px] uppercase tracking-[.16em] text-[#27d9c9]/60 mb-1">Goal</span>
                <span className="text-[13px] font-bold tabular-nums text-[#28dccc]">{targetMilestone}</span>
              </div>
            </div>
            <svg viewBox="0 0 234 116" role="img" aria-label={`Progress from ${Math.round(currentRating)} current rating toward ${targetMilestone} target rating`} className="w-full h-[118px] mt-1 overflow-visible">
              <defs>
                <linearGradient id="analysis-curve-fill" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="#20d9c8" stopOpacity=".26" />
                  <stop offset="100%" stopColor="#20d9c8" stopOpacity="0" />
                </linearGradient>
                <clipPath id="analysis-progress-clip">
                  <rect x="0" y="0" width={234 * (percent / 100)} height="116" />
                </clipPath>
              </defs>
              <path d="M 14 104 C 48 104, 70 94, 98 79 S 158 40, 220 18 L 220 110 L 14 110 Z" fill="url(#analysis-curve-fill)" opacity=".35" />
              <path d="M 14 104 C 48 104, 70 94, 98 79 S 158 40, 220 18" fill="none" stroke="#62666d" strokeWidth="1.4" strokeDasharray="3 4" />
              <path d={chartPath} fill="none" stroke="#2bdac9" strokeWidth="2.8" strokeLinecap="round" clipPath="url(#analysis-progress-clip)" />
              <circle cx={14 + (206 * percent / 100)} cy={104 - (86 * Math.min(percent / 100, 1) ** 1.1)} r="3.2" fill="#2bdac9" />
              <circle cx={14 + (206 * percent / 100)} cy={104 - (86 * Math.min(percent / 100, 1) ** 1.1)} r="7" fill="#2bdac9" opacity=".12" />
            </svg>
            <div className="mt-1 flex items-center justify-between text-[9px] text-slate-600">
              <span>Current rating</span>
              <span>Next milestone</span>
            </div>
          </div>

          <div className="mt-4 space-y-2">
            {DIAGNOSTICS.map(item => {
              const complete = percent >= item.end;
              const active = percent >= item.start && !complete;
              return (
                <div key={item.label} className={`flex items-center gap-3 min-h-6 transition-opacity duration-300 ${active || complete ? 'opacity-100' : 'opacity-35'}`}>
                  <span
                    className="w-5 h-5 shrink-0 rounded-full border flex items-center justify-center text-[10px]"
                    style={{
                      color: complete ? '#30decb' : item.color,
                      borderColor: complete ? 'rgba(48,222,203,.45)' : active ? item.color : 'rgba(100,116,139,.25)',
                      background: complete ? 'rgba(48,222,203,.09)' : active ? `${item.color}14` : 'transparent',
                    }}
                    aria-hidden="true"
                  >
                    {complete ? '✓' : item.icon}
                  </span>
                  <span className={`flex-1 text-[11px] font-medium ${active ? 'text-slate-100' : complete ? 'text-slate-300' : 'text-slate-500'}`}>{item.label}</span>
                  <span className="text-[9px] font-mono tracking-wider" style={{ color: complete ? '#2bdac9' : active ? item.color : '#52525b' }}>
                    {complete ? 'DONE' : active ? 'SCANNING' : 'WAITING'}
                  </span>
                </div>
              );
            })}
          </div>

          <div className="mt-5 text-center">
            <p className="text-[10px] text-slate-600">{safeTotal > 0 ? `Analyzing ${safeTotal} available games for ${username}.` : `Preparing ${username}’s checkup.`}</p>
            <p className="mt-1 text-[10px] text-slate-700 truncate" aria-live="polite">{step}</p>
          </div>
        </div>
      </div>
    </section>
  );
};
