import React, { useMemo, useState } from 'react';
import { Platform, TimeControl } from '../types/chess';
import { getNextMilestone } from '../services/ratingBenchmarks';

type PracticeBudget = '5–15 min' | '15–30 min' | '30+ min';
type GoalStyle = 'milestone' | 'beyond';

interface CheckupSetupFlowProps {
  username: string;
  platform: Platform;
  timeControl: TimeControl;
  currentRating: number;
  gamesAvailable: number;
  onBack: () => void;
  onStart: (targetMilestone: number, practiceBudget: PracticeBudget, goalStyle: GoalStyle) => void;
}

const PRACTICE_OPTIONS: Array<{ value: PracticeBudget; title: string; detail: string; icon: string; recommended?: boolean }> = [
  { value: '5–15 min', title: '5–15 min', detail: 'Build a steady habit.', icon: '◷' },
  { value: '15–30 min', title: '15–30 min', detail: 'Make real, visible progress.', icon: 'ϟ', recommended: true },
  { value: '30+ min', title: '30+ min', detail: 'Make room for deeper study.', icon: '↗' },
];

export const CheckupSetupFlow: React.FC<CheckupSetupFlowProps> = ({
  username,
  platform,
  timeControl,
  currentRating,
  gamesAvailable,
  onBack,
  onStart,
}) => {
  const [step, setStep] = useState<0 | 1>(0);
  const [practiceBudget, setPracticeBudget] = useState<PracticeBudget>('15–30 min');
  const [goalStyle, setGoalStyle] = useState<GoalStyle>('milestone');

  const targetMilestone = useMemo(() => getNextMilestone(currentRating), [currentRating]);
  const progress = step === 0 ? 0 : 3;

  const handleContinue = () => {
    // Keep the primary path to one decision: practice budget. The next milestone
    // is derived from the verified rating; optional goal tuning can come later.
    onStart(targetMilestone, practiceBudget, 'milestone');
  };

  return (
    <section className="relative min-h-[100dvh] bg-[#050607] text-[#f2f5f5] overflow-hidden">
      <div className="absolute top-0 left-0 right-0 h-[3px] bg-white/5">
        <div className="h-full bg-[#20d8c5] transition-all duration-500" style={{ width: `${progress}%` }} />
      </div>
      <div className="absolute top-4 right-4 sm:right-7 flex items-center gap-2 text-[10px] sm:text-xs text-slate-500">
        <span className={step === 0 ? 'h-1.5 w-1.5 rounded-full bg-[#20d8c5] animate-pulse' : 'h-1.5 w-1.5 rounded-full bg-slate-600'} />
        <span>{step === 0 ? 'CHECKUP SETUP' : 'PROFILE READY'}</span>
        <span className="font-mono text-[#20d8c5]">{progress}%</span>
      </div>

      <div className="relative z-10 min-h-[100dvh] flex flex-col items-center justify-center px-4 py-16">
        <div className="w-full max-w-[420px]">
          <div className="flex items-start gap-3 mb-5">
            <div className="w-8 h-8 shrink-0 rounded-xl bg-[#092e2d] border border-[#145854] flex items-center justify-center text-[#31e0ce] text-lg shadow-[0_0_20px_rgba(32,216,197,.09)]" aria-hidden="true">♟</div>
            <div className="max-w-[calc(100%-44px)] rounded-xl rounded-tl-sm bg-[#1b1b20] border border-white/[0.04] px-4 py-3.5">
              {step === 0 ? (
                <>
                  <h1 className="text-sm sm:text-base font-medium leading-relaxed">How much time per day are you willing to train?</h1>
                  <p className="mt-1 text-[11px] leading-relaxed text-slate-500">We’ll shape your training plan around the time you can consistently give.</p>
                </>
              ) : (
                <>
                  <h1 className="text-sm sm:text-base font-medium leading-relaxed">You’re around <span className="text-[#25dccc] font-bold">{Math.round(currentRating)}</span>. Where do you want to be?</h1>
                  <p className="mt-1 text-[11px] leading-relaxed text-slate-500">{username} · {platform === 'chesscom' ? 'Chess.com' : 'Lichess'} · {timeControl.toUpperCase()}</p>
                </>
              )}
            </div>
          </div>

          {step === 0 ? (
            <fieldset className="space-y-2.5">
              <legend className="sr-only">Daily training time</legend>
              {PRACTICE_OPTIONS.map(option => {
                const selected = option.value === practiceBudget;
                return (
                  <button
                    key={option.value}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => setPracticeBudget(option.value)}
                    className={`relative w-full text-left rounded-xl border px-4 py-4 pr-12 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#26dccc] ${selected ? 'bg-[#1e1e23] border-[#2bdac9]/70 shadow-[0_0_0_1px_rgba(43,218,201,.08)]' : 'bg-[#17171c] border-white/[0.055] hover:border-white/20'}`}
                  >
                    {option.recommended && <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 rounded-full px-3 py-1 text-[9px] leading-none font-extrabold tracking-wider bg-[#22d9c8] text-[#03201e]">RECOMMENDED</span>}
                    <span className={`absolute left-4 top-4 text-lg ${option.icon === '◷' ? 'text-[#57d9c9]' : option.icon === 'ϟ' ? 'text-amber-400' : 'text-fuchsia-400'}`} aria-hidden="true">{option.icon}</span>
                    <span className="block pl-7">
                      <span className="block text-[13px] font-bold text-white">{option.title}</span>
                      <span className="block mt-1 text-[11px] text-slate-400">{option.detail}</span>
                    </span>
                    <span className={`absolute right-4 top-1/2 -translate-y-1/2 w-3.5 h-3.5 rounded-full border flex items-center justify-center ${selected ? 'border-[#2bdac9]' : 'border-slate-600'}`}>
                      {selected && <span className="w-1.5 h-1.5 rounded-full bg-[#2bdac9]" />}
                    </span>
                  </button>
                );
              })}
            </fieldset>
          ) : (
            <fieldset className="space-y-2.5">
              <legend className="sr-only">Rating milestone goal</legend>
              <button
                type="button"
                aria-pressed={goalStyle === 'milestone'}
                onClick={() => setGoalStyle('milestone')}
                className={`relative w-full text-left rounded-xl border px-4 py-4 pr-12 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#26dccc] ${goalStyle === 'milestone' ? 'bg-[#1e1e23] border-[#2bdac9]/70' : 'bg-[#17171c] border-white/[0.055] hover:border-white/20'}`}
              >
                <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 rounded-full px-3 py-1 text-[9px] leading-none font-extrabold tracking-wider bg-[#22d9c8] text-[#03201e]">RECOMMENDED</span>
                <span className="block text-[13px] font-bold text-white">{targetMilestone}+</span>
                <span className="block mt-1 text-[11px] text-slate-400">A realistic next jump.</span>
                <span className={`absolute right-4 top-1/2 -translate-y-1/2 w-3.5 h-3.5 rounded-full border flex items-center justify-center ${goalStyle === 'milestone' ? 'border-[#2bdac9]' : 'border-slate-600'}`}>
                  {goalStyle === 'milestone' && <span className="w-1.5 h-1.5 rounded-full bg-[#2bdac9]" />}
                </span>
              </button>
              <button
                type="button"
                aria-pressed={goalStyle === 'beyond'}
                onClick={() => setGoalStyle('beyond')}
                className={`relative w-full text-left rounded-xl border px-4 py-4 pr-12 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#26dccc] ${goalStyle === 'beyond' ? 'bg-[#1e1e23] border-[#2bdac9]/70' : 'bg-[#17171c] border-white/[0.055] hover:border-white/20'}`}
              >
                <span className="text-base text-amber-300" aria-hidden="true">♜</span>
                <span className="block text-[13px] font-bold text-white mt-1">{targetMilestone}+ and beyond</span>
                <span className="block mt-1 text-[11px] text-slate-400">Ambitious. We like it.</span>
                <span className={`absolute right-4 top-1/2 -translate-y-1/2 w-3.5 h-3.5 rounded-full border flex items-center justify-center ${goalStyle === 'beyond' ? 'border-[#2bdac9]' : 'border-slate-600'}`}>
                  {goalStyle === 'beyond' && <span className="w-1.5 h-1.5 rounded-full bg-[#2bdac9]" />}
                </span>
              </button>
            </fieldset>
          )}

          <button
            type="button"
            onClick={handleContinue}
            disabled={gamesAvailable < 1}
            className="mt-4 w-full py-3.5 px-5 rounded-xl bg-[#19caba] hover:bg-[#29decf] text-[#032220] font-bold text-[13px] transition-all active:scale-[.99] disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
          >
            Start my checkup
          </button>
          <button
            type="button"
            onClick={() => step === 0 ? onBack() : setStep(0)}
            className="mt-3 block mx-auto px-3 py-1 text-[11px] text-slate-500 hover:text-slate-300 transition-colors"
          >
            Back
          </button>

          <div className="mt-9 flex items-center justify-center gap-1.5" aria-label={`Step ${step + 1} of 2`}>
            <span className={`h-1 rounded-full transition-all ${step === 0 ? 'w-8 bg-[#2bdac9]' : 'w-3 bg-[#2bdac9]/40'}`} />
            <span className={`h-1 rounded-full transition-all ${step === 1 ? 'w-8 bg-[#2bdac9]' : 'w-3 bg-[#2bdac9]/40'}`} />
          </div>
          <p className="mt-4 text-center text-[10px] text-slate-600">
            {gamesAvailable} recent game{gamesAvailable === 1 ? '' : 's'} available · We never need your account password.
          </p>
        </div>
      </div>
    </section>
  );
};
