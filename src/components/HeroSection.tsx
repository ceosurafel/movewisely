import React, { useState } from 'react';
import { Platform, TimeControl } from '../types/chess';
import { SAMPLE_PROFILES, SampleProfile } from '../services/sampleData';

interface HeroSectionProps {
  onStartCheckup: (username: string, platform: Platform, timeControl: TimeControl) => void;
  isLoading: boolean;
  initialUsername?: string;
  initialPlatform?: Platform;
  initialTimeControl?: TimeControl;
}

export const HeroSection: React.FC<HeroSectionProps> = ({
  onStartCheckup,
  isLoading,
  initialUsername = '',
  initialPlatform = 'chesscom',
  initialTimeControl = 'rapid',
}) => {
  const [platform, setPlatform] = useState<Platform>(initialPlatform);
  const [username, setUsername] = useState(initialUsername);
  const [timeControl, setTimeControl] = useState<TimeControl>(initialTimeControl);
  const [validationError, setValidationError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim()) {
      setValidationError('Please enter your Chess.com or Lichess username.');
      return;
    }
    if (!timeControl) {
      setValidationError('Please select a time control (Bullet, Blitz, or Rapid).');
      return;
    }
    setValidationError(null);
    onStartCheckup(username.trim(), platform, timeControl);
  };

  const handleSelectSample = (sample: SampleProfile) => {
    setUsername(sample.username);
    setPlatform(sample.platform);
    setTimeControl(sample.timeControl);
    setValidationError(null);
    onStartCheckup(sample.username, sample.platform, sample.timeControl);
  };

  return (
    <div className="relative overflow-hidden pt-10 pb-20 sm:pt-16 sm:pb-28">
      {/* Background ambient lighting */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[350px] bg-teal-500/10 blur-[130px] rounded-full pointer-events-none" />
      <div className="absolute top-20 right-10 w-[300px] h-[300px] bg-emerald-500/5 blur-[100px] rounded-full pointer-events-none" />

      <div className="max-w-5xl mx-auto px-4 sm:px-6 relative z-10 text-center">
        {/* Editorial Sub-kicker */}
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-teal-800/40 bg-teal-950/30 text-teal-300 text-xs font-medium mb-6">
          <span className="w-1.5 h-1.5 rounded-full bg-teal-400 animate-pulse" />
          <span>MoveWisely · Diagnostic Chess Engine</span>
        </div>

        {/* Strong, compelling headline */}
        <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight text-white max-w-4xl mx-auto leading-[1.12] mb-6">
          Discover the <span className="text-transparent bg-clip-text bg-gradient-to-r from-teal-300 via-teal-200 to-emerald-400">hidden rating leaks</span> keeping you from your next milestone.
        </h1>

        <p className="text-lg sm:text-xl text-slate-300 max-w-2xl mx-auto mb-10 leading-relaxed font-normal">
          We diagnose your last 20 games from Chess.com or Lichess to pinpoint the exact blunders, phase breakdowns, and repertoire gaps between your current rating and the next 100-point bracket.
        </p>

        {/* Main Checkup Card */}
        <div className="max-w-xl mx-auto bg-[#0b161b]/90 border border-teal-900/50 rounded-2xl p-6 sm:p-8 shadow-2xl backdrop-blur-xl text-left">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Step 1: Platform Selection */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-teal-300/80 mb-2">
                1. Select Platform
              </label>
              <div className="grid grid-cols-2 gap-3 p-1 bg-[#060c0f] rounded-xl border border-teal-950">
                <button
                  type="button"
                  onClick={() => setPlatform('chesscom')}
                  className={`flex items-center justify-center gap-2.5 py-2.5 px-4 rounded-lg text-sm font-medium transition-all cursor-pointer ${
                    platform === 'chesscom'
                      ? 'bg-teal-900/40 text-teal-200 border border-teal-700/50 shadow-sm'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <span className="text-base">♟</span>
                  <span>Chess.com</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPlatform('lichess')}
                  className={`flex items-center justify-center gap-2.5 py-2.5 px-4 rounded-lg text-sm font-medium transition-all cursor-pointer ${
                    platform === 'lichess'
                      ? 'bg-teal-900/40 text-teal-200 border border-teal-700/50 shadow-sm'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <span className="text-base">♞</span>
                  <span>Lichess</span>
                </button>
              </div>
            </div>

            {/* Step 2: Username Input */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label
                  htmlFor="chess-username"
                  className="text-xs font-semibold uppercase tracking-wider text-teal-300/80"
                >
                  2. Enter Username
                </label>
                <span className="text-[11px] text-slate-400">Public profile only</span>
              </div>
              <div className="relative">
                <input
                  id="chess-username"
                  type="text"
                  value={username}
                  onChange={e => {
                    setUsername(e.target.value);
                    if (validationError) setValidationError(null);
                  }}
                  placeholder={platform === 'chesscom' ? 'e.g. MagnusCarlsen or Hikaru' : 'e.g. DrNykterstein'}
                  className="w-full bg-[#060c0f] border border-teal-900/60 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-400 focus:border-transparent text-sm transition-all"
                  autoComplete="off"
                />
                {username && (
                  <button
                    type="button"
                    onClick={() => setUsername('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 text-xs cursor-pointer"
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>

            {/* Step 3: Time Control Selection (MANDATORY) */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-semibold uppercase tracking-wider text-teal-300/80">
                  3. Time Control <span className="text-rose-400">*</span>
                </label>
                <span className="text-[11px] text-teal-400/80 font-mono">Mandatory for leak cohort</span>
              </div>
              <div className="grid grid-cols-3 gap-2.5">
                {[
                  { id: 'rapid', label: 'Rapid', time: '10–15 min', icon: '⏱' },
                  { id: 'blitz', label: 'Blitz', time: '3–5 min', icon: '⚡' },
                  { id: 'bullet', label: 'Bullet', time: '1–2 min', icon: '🔥' },
                ].map(tc => {
                  const isSelected = timeControl === tc.id;
                  return (
                    <button
                      key={tc.id}
                      type="button"
                      onClick={() => setTimeControl(tc.id as TimeControl)}
                      className={`flex flex-col items-center justify-center p-3 rounded-xl border text-center transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-teal-500/15 border-teal-400 text-white ring-1 ring-teal-400/40 shadow-[0_0_15px_rgba(20,184,166,0.15)]'
                          : 'bg-[#060c0f] border-teal-950 text-slate-400 hover:border-teal-900/60 hover:text-slate-200'
                      }`}
                    >
                      <span className="text-lg mb-1">{tc.icon}</span>
                      <span className="text-xs font-semibold text-white">{tc.label}</span>
                      <span className="text-[10px] text-slate-400">{tc.time}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {validationError && (
              <p className="text-xs text-rose-400 bg-rose-950/40 border border-rose-900/50 p-2.5 rounded-lg">
                {validationError}
              </p>
            )}

            {/* Submit Action Button */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3.5 px-6 rounded-xl font-bold text-slate-950 bg-gradient-to-r from-teal-400 via-teal-300 to-emerald-400 hover:from-teal-300 hover:to-emerald-300 transition-all shadow-[0_4px_24px_rgba(20,184,166,0.3)] hover:scale-[1.01] active:scale-[0.99] flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed text-base"
            >
              {isLoading ? (
                <>
                  <div className="w-5 h-5 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                  <span>Preparing checkup...</span>
                </>
              ) : (
                <>
                  <span>Start my free checkup</span>
                  <span className="text-lg">→</span>
                </>
              )}
            </button>
          </form>

          {/* 1-Click Sample Demo Profiles */}
          <div className="mt-6 pt-5 border-t border-teal-950/80">
            <div className="flex items-center justify-between mb-2.5 text-xs text-slate-400">
              <span>Or test with a sample player:</span>
              <span className="text-[11px] text-teal-400/80">Instant 1-click preview</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {SAMPLE_PROFILES.map(s => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => handleSelectSample(s)}
                  className="px-2.5 py-1.5 rounded-lg bg-[#060c0f] hover:bg-teal-950/40 border border-teal-950 hover:border-teal-800 text-[11px] text-slate-300 hover:text-white transition-all text-center cursor-pointer truncate"
                  title={`${s.name} - ${s.description}`}
                >
                  <span className="font-semibold block">{s.name}</span>
                  <span className="text-[10px] text-teal-400/70">{s.timeControl}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Proof & feature highlights */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 max-w-4xl mx-auto mt-16 text-left">
          <div className="p-4 rounded-xl border border-teal-950/80 bg-[#081216]/50">
            <div className="text-teal-400 text-xl font-bold font-mono">20 Games</div>
            <div className="text-xs text-slate-300 font-medium mt-1">Sufficient sample size</div>
            <div className="text-[11px] text-slate-400 mt-0.5">Captures your recurring habits without noise</div>
          </div>
          <div className="p-4 rounded-xl border border-teal-950/80 bg-[#081216]/50">
            <div className="text-teal-400 text-xl font-bold font-mono">+100 Milestone</div>
            <div className="text-xs text-slate-300 font-medium mt-1">Realistic target bracket</div>
            <div className="text-[11px] text-slate-400 mt-0.5">Benchmarks you against the next tier</div>
          </div>
          <div className="p-4 rounded-xl border border-teal-950/80 bg-[#081216]/50">
            <div className="text-teal-400 text-xl font-bold font-mono">Spotlight Blunder</div>
            <div className="text-xs text-slate-300 font-medium mt-1">The move that cost you</div>
            <div className="text-[11px] text-slate-400 mt-0.5">Interactive board with coach's refutation</div>
          </div>
          <div className="p-4 rounded-xl border border-teal-950/80 bg-[#081216]/50">
            <div className="text-teal-400 text-xl font-bold font-mono">100% Free</div>
            <div className="text-xs text-slate-300 font-medium mt-1">No login required</div>
            <div className="text-[11px] text-slate-400 mt-0.5">Runs in your browser via public API</div>
          </div>
        </div>
      </div>
    </div>
  );
};
