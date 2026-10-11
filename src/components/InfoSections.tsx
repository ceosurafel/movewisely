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
            No engine installation is needed. We retrieve public game records from your chosen platform and analyze them in your browser. A full batch can take a few minutes.
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
            These internal reference ranges are heuristic guideposts for reflection, not official platform statistics or independently validated rating predictions.
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
            What a Multi-Game Review Can Reveal
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
              Move reviews combine Stockfish evaluations with rule-based diagnostic hints. Tactical labels are estimates and may be imperfect; check the referenced position and engine line before treating a label as definitive.
            </p>
          </div>

          <div className="p-6 rounded-2xl bg-[#091419]/90 border border-teal-900/60">
            <h3 className="text-lg font-bold text-white mb-2 flex items-center gap-2">
              <span className="text-teal-400">🎯</span>
              <span>Decisive Phase Distribution</span>
            </h3>
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
              Phase breakdowns can help you form training hypotheses from the games analyzed. They are descriptive indicators, not proof of a single cause for a loss.
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


export const PrivacyNoticeSection: React.FC = () => {
  return (
    <section id="privacy" className="py-16 border-t border-teal-950/80 bg-[#070e12]/60">
      <div className="max-w-5xl mx-auto px-4 sm:px-6">
        <div className="max-w-3xl mx-auto">
          <span className="text-xs font-mono uppercase tracking-wider text-teal-400">
            Privacy &amp; data
          </span>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-white mt-2">
            What happens to your game data?
          </h2>
          <div className="mt-4 space-y-3 text-sm text-slate-300 leading-relaxed">
            <p>
              MoveWisely asks for a public Chess.com or Lichess username, not your password. Your browser sends requests to the selected platform's public API to retrieve available profile, rating, and game data.
            </p>
            <p>
              In the current implementation, move analysis and report calculations run in your browser using JavaScript and the Stockfish WebAssembly engine. MoveWisely does not include user accounts or an application database that stores your imported game history.
            </p>
            <p>
              Your requests still reach the chess platform you select and the website hosting provider may process standard access and security logs. The page also loads fonts from Google Fonts. Review those providers' respective privacy terms for their handling of requests.
            </p>
            <p>
              If you use a browser or operating-system sharing feature, you choose whether and where to share the report content. Do not submit usernames or game records you are not authorized to use.
            </p>
            <p className="text-xs text-slate-400">
              This is a plain-language summary of the current implementation, not legal advice or a guarantee about third-party providers. Revisit it whenever data flows or hosting services change.
            </p>
          </div>
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

        <nav aria-label="Policies and software notices" className="flex flex-wrap justify-center gap-x-4 gap-y-2 text-[11px]">
          <a href="#privacy" className="text-teal-300 hover:text-white underline underline-offset-4">Privacy overview</a>
          <a href="/third-party-notices.html" className="text-teal-300 hover:text-white underline underline-offset-4">Third-party licenses</a>
        </nav>

        <div className="text-center sm:text-right text-[11px] text-slate-500">
          Not affiliated with Chess.com or Lichess. Public game data is requested from their APIs.
        </div>
      </div>
    </footer>
  );
};
