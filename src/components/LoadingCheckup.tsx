import React, { useState, useEffect } from 'react';
import { Platform, TimeControl } from '../types/chess';

interface LoadingCheckupProps {
  username: string;
  platform: Platform;
  timeControl: TimeControl;
  onComplete: () => void;
}

const STEPS = [
  { label: 'Connecting to public platform API', detail: 'Locating user profile & rating index' },
  { label: 'Downloading recent finished games', detail: 'Fetching the last 20 games' },
  { label: 'Parsing move notation & material history', detail: 'Reconstructing board positions' },
  { label: 'Scanning for tactical leaks & hanging pieces', detail: 'Heuristic evaluation' },
  { label: 'Analyzing phase breakdown & opening winrates', detail: 'Evaluating early mistakes' },
  { label: 'Benchmarking against next rating milestone', detail: 'Calculating cohort distance' },
  { label: 'Generating personalized roadmap & action plan', detail: 'Isolating high-impact fixes' },
];

export const LoadingCheckup: React.FC<LoadingCheckupProps> = ({
  username,
  platform,
  timeControl,
  onComplete,
}) => {
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [progress, setProgress] = useState(12);

  useEffect(() => {
    const stepDuration = 550; // fast and engaging ~3.8 seconds total
    const interval = setInterval(() => {
      setCurrentStepIndex(prev => {
        const next = prev + 1;
        if (next >= STEPS.length) {
          clearInterval(interval);
          setTimeout(() => {
            onComplete();
          }, 400);
          return prev;
        }
        return next;
      });
    }, stepDuration);

    const progressInterval = setInterval(() => {
      setProgress(prev => {
        if (prev >= 98) {
          clearInterval(progressInterval);
          return 100;
        }
        return Math.min(98, prev + 3);
      });
    }, 110);

    return () => {
      clearInterval(interval);
      clearInterval(progressInterval);
    };
  }, [onComplete]);

  return (
    <div className="min-h-[80vh] flex flex-col items-center justify-center px-4 py-12 relative overflow-hidden">
      {/* Background glow */}
      <div className="absolute w-[500px] h-[500px] bg-teal-500/10 rounded-full blur-[140px] pointer-events-none" />

      <div className="max-w-md w-full bg-[#0a1519]/90 border border-teal-900/60 rounded-2xl p-6 sm:p-8 shadow-2xl backdrop-blur-xl relative z-10 text-center">
        {/* Animated chess radar emblem */}
        <div className="relative w-20 h-20 mx-auto mb-6 flex items-center justify-center">
          <div className="absolute inset-0 rounded-full border border-teal-500/30 animate-ping opacity-30" />
          <div className="absolute inset-1 rounded-full border border-teal-400/40 animate-pulse" />
          <div className="w-14 h-14 rounded-full bg-gradient-to-tr from-teal-600 to-emerald-400 flex items-center justify-center text-slate-950 font-black text-2xl shadow-[0_0_25px_rgba(20,184,166,0.5)]">
            ♞
          </div>
        </div>

        {/* Header */}
        <h2 className="text-xl sm:text-2xl font-bold text-white mb-1">
          Analyzing {username}
        </h2>
        <p className="text-xs text-teal-300/80 mb-6 font-mono">
          {platform === 'chesscom' ? 'Chess.com' : 'Lichess'} · {timeControl.toUpperCase()} · Last 20 Games
        </p>

        {/* Progress Bar */}
        <div className="w-full bg-[#050b0e] h-2 rounded-full overflow-hidden mb-6 border border-teal-950">
          <div
            className="h-full bg-gradient-to-r from-teal-500 via-teal-300 to-emerald-400 transition-all duration-300 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* Step-by-step diagnostic breakdown */}
        <div className="space-y-3 text-left">
          {STEPS.map((step, idx) => {
            const isFinished = idx < currentStepIndex;
            const isCurrent = idx === currentStepIndex;
            const isPending = idx > currentStepIndex;

            return (
              <div
                key={step.label}
                className={`flex items-start gap-3 transition-opacity duration-300 ${
                  isPending ? 'opacity-35' : isCurrent ? 'opacity-100' : 'opacity-80'
                }`}
              >
                <div className="mt-0.5 shrink-0">
                  {isFinished ? (
                    <div className="w-4 h-4 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/60 flex items-center justify-center text-[10px] font-bold">
                      ✓
                    </div>
                  ) : isCurrent ? (
                    <div className="w-4 h-4 rounded-full border-2 border-teal-400 border-t-transparent animate-spin" />
                  ) : (
                    <div className="w-4 h-4 rounded-full border border-slate-700 bg-slate-900" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className={`text-xs font-medium leading-tight ${isCurrent ? 'text-teal-200' : 'text-slate-300'}`}>
                    {step.label}
                  </div>
                  {isCurrent && (
                    <div className="text-[11px] text-teal-400/80 mt-0.5 font-mono">
                      {step.detail}...
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-6 pt-4 border-t border-teal-950/80 text-[11px] text-slate-400">
          Private local checkup · Evaluates material stability & blunders
        </div>
      </div>
    </div>
  );
};
