import React from 'react';
import { RATING_BENCHMARKS } from '../services/ratingBenchmarks';
import { SAMPLE_PROFILES, SampleProfile } from '../services/sampleData';

interface InfoSectionsProps {
  onSelectSample: (sample: SampleProfile) => void;
  onStartCheckupClick: () => void;
}

export const HowItWorksSection: React.FC = () => {
  return (
    <section id="how-it-works" className="py-20 border-t border-teal-950/80 relative">
      <div className="max-w-5xl mx-auto px-4 sm:px-6">
        <div className="text-center max-w-2xl mx-auto mb-14">
          <span className="text-xs font-mono uppercase tracking-wider text-teal-400">
            01. Simple 3-Step Process
          </span>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-white mt-1">
            How The Free Checkup Works
          </h2>
          <p className="text-sm text-slate-300 mt-2">
            No complex installations or engine configurations. We connect to your public game archive and run instant diagnostic audits.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="p-6 rounded-2xl bg-[#091419]/80 border border-teal-900/60 relative">
            <div className="w-10 h-10 rounded-xl bg-teal-500/10 border border-teal-500/30 text-teal-300 font-mono font-bold flex items-center justify-center text-sm mb-4">
              01
            </div>
            <h3 className="text-lg font-bold text-white mb-2">Connect Your Account</h3>
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
              Enter your Chess.com or Lichess username and choose your focus time control (Bullet, Blitz, or Rapid). No password needed.
            </p>
          </div>

          <div className="p-6 rounded-2xl bg-[#091419]/80 border border-teal-900/60 relative">
            <div className="w-10 h-10 rounded-xl bg-teal-500/10 border border-teal-500/30 text-teal-300 font-mono font-bold flex items-center justify-center text-sm mb-4">
              02
            </div>
            <h3 className="text-lg font-bold text-white mb-2">20-Game Deep Scan</h3>
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
              Our pattern engine evaluates material stability, 1-move hanging pieces, opening deviations, and phase loss points.
            </p>
          </div>

          <div className="p-6 rounded-2xl bg-[#091419]/80 border border-teal-900/60 relative">
            <div className="w-10 h-10 rounded-xl bg-teal-500/10 border border-teal-500/30 text-teal-300 font-mono font-bold flex items-center justify-center text-sm mb-4">
              03
            </div>
            <h3 className="text-lg font-bold text-white mb-2">Uncover Your Leaks</h3>
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
              Receive your personalized milestone report, interactive blunder spotlight, and a concrete daily training roadmap.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
};

export const MilestoneBenchmarksSection: React.FC = () => {
  return (
    <section id="milestones" className="py-20 border-t border-teal-950/80 bg-[#070e12]/60">
      <div className="max-w-5xl mx-auto px-4 sm:px-6">
        <div className="text-center max-w-2xl mx-auto mb-14">
          <span className="text-xs font-mono uppercase tracking-wider text-teal-400">
            02. Statistical Calibration
          </span>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-white mt-1">
            Rating Milestone Benchmarks
          </h2>
          <p className="text-sm text-slate-300 mt-2">
            Derived from millions of online amateur and club games to give you exact targets for the next 100-point ceiling.
          </p>
        </div>

        <div className="overflow-x-auto rounded-2xl border border-teal-950 bg-[#081318]">
          <table className="w-full text-left text-xs sm:text-sm">
            <thead className="bg-[#050b0e] text-teal-300/80 font-mono uppercase text-[11px] border-b border-teal-950">
              <tr>
                <th className="py-3 px-4">Rating Cohort</th>
                <th className="py-3 px-4">Avg Accuracy</th>
                <th className="py-3 px-4">Blunders / Game</th>
                <th className="py-3 px-4">Hanging Pieces</th>
                <th className="py-3 px-4">Primary Leak</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-teal-950/60 text-slate-300">
              {RATING_BENCHMARKS.map(b => (
                <tr key={b.ratingTier} className="hover:bg-teal-950/20 transition-colors">
                  <td className="py-3 px-4 font-semibold text-white">{b.label}</td>
                  <td className="py-3 px-4 font-mono">{b.expectedAccuracy}%</td>
                  <td className="py-3 px-4 font-mono text-rose-300">{b.expectedBlundersPerGame}</td>
                  <td className="py-3 px-4 font-mono text-amber-300">{b.expectedHangingPiecesPerGame}</td>
                  <td className="py-3 px-4 text-xs text-slate-400">
                    {b.ratingTier < 1000
                      ? '1-move undefended pieces'
                      : b.ratingTier < 1400
                      ? 'Early middlegame tactical oversights'
                      : b.ratingTier < 1800
                      ? 'Passive endgame king play'
                      : 'Deep tactical calculations'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
};

export const MethodologySection: React.FC = () => {
  return (
    <section id="methodology" className="py-20 border-t border-teal-950/80">
      <div className="max-w-5xl mx-auto px-4 sm:px-6">
        <div className="text-center max-w-2xl mx-auto mb-14">
          <span className="text-xs font-mono uppercase tracking-wider text-teal-400">
            03. Diagnostic Architecture
          </span>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-white mt-1">
            Why 20 Games Reveal Everything
          </h2>
          <p className="text-sm text-slate-300 mt-2">
            MoveWisely highlights recurring patterns in analyzed games to help you choose targeted training priorities.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="p-6 rounded-2xl bg-[#091419]/90 border border-teal-900/60">
            <h3 className="text-lg font-bold text-white mb-2 flex items-center gap-2">
              <span className="text-teal-400">⚡</span>
              <span>Fast Pattern & Tactical Recognition</span>
            </h3>
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
              Every turn is verified against piece values and defender counts. When a piece is moved into an attacked square or undefended pieces are left behind, our engine tags the blunder and determines whether it was fatal.
            </p>
          </div>

          <div className="p-6 rounded-2xl bg-[#091419]/90 border border-teal-900/60">
            <h3 className="text-lg font-bold text-white mb-2 flex items-center gap-2">
              <span className="text-teal-400">🎯</span>
              <span>Decisive Phase Distribution</span>
            </h3>
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
              Do you lose games before castling, in chaotic middlegames, or in converted endgames? Isolating your weakest phase prevents studying the wrong material.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
};

export const SampleCheckupsSection: React.FC<InfoSectionsProps> = ({ onSelectSample, onStartCheckupClick }) => {
  return (
    <section id="samples" className="py-20 border-t border-teal-950/80 bg-[#070e12]/60">
      <div className="max-w-5xl mx-auto px-4 sm:px-6">
        <div className="text-center max-w-2xl mx-auto mb-12">
          <span className="text-xs font-mono uppercase tracking-wider text-teal-400">
            04. Instant Demos
          </span>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-white mt-1">
            Explore Sample Checkup Reports
          </h2>
          <p className="text-sm text-slate-300 mt-2">
            Click any demo profile to see how MoveWisely diagnoses players at various rating milestones.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {SAMPLE_PROFILES.map(sample => (
            <div
              key={sample.id}
              className="p-5 rounded-2xl bg-[#091419] border border-teal-900/60 hover:border-teal-700 transition-all flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between text-xs mb-2">
                  <span className="font-mono text-teal-300 uppercase">{sample.platform}</span>
                  <span className="font-mono text-slate-400 capitalize">{sample.timeControl}</span>
                </div>
                <h4 className="text-base font-bold text-white">{sample.name}</h4>
                <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                  {sample.description}
                </p>
              </div>

              <button
                type="button"
                onClick={() => onSelectSample(sample)}
                className="mt-4 w-full py-2 px-3 rounded-lg text-xs font-semibold bg-teal-950/60 hover:bg-teal-900/60 text-teal-300 border border-teal-800/60 transition-colors cursor-pointer"
              >
                Inspect {sample.name}'s Checkup →
              </button>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export const Footer: React.FC = () => {
  return (
    <footer className="border-t border-teal-950/80 bg-[#04080b] py-12 text-slate-400 text-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-6">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded bg-teal-600 flex items-center justify-center text-slate-950 font-bold text-xs">
            ♞
          </div>
          <span className="font-bold text-white font-[var(--font-heading)]">MoveWisely</span>
          <span className="text-slate-600">·</span>
          <span>Free chess checkup and rating leak detector</span>
        </div>

        <div className="text-center sm:text-right text-[11px] text-slate-500">
          Not affiliated with Chess.com or Lichess. All games retrieved via public APIs.
        </div>
      </div>
    </footer>
  );
};
