import React from 'react';

interface NavbarProps {
  onStartCheckupClick: () => void;
  onNavigateSection: (sectionId: string) => void;
  onHistoryClick: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ onStartCheckupClick, onNavigateSection, onHistoryClick }) => {
  return (
    <header className="sticky top-0 z-40 w-full border-b border-teal-950/60 bg-[#060c0f]/90 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
        {/* Zone 1: Single text element wordmark */}
        <button
          onClick={() => onNavigateSection('hero')}
          className="flex items-center gap-2.5 text-left group cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-400 rounded-md"
        >
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-teal-500 to-emerald-700 flex items-center justify-center text-slate-950 font-black text-lg shadow-[0_0_15px_rgba(20,184,166,0.25)]">
            ♞
          </div>
          <span className="text-xl font-bold tracking-tight text-white group-hover:text-teal-300 transition-colors font-[var(--font-heading)]">
            MoveWisely
          </span>
        </button>

        {/* Zone 2: 4-5 clean text navigation links */}
        <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-slate-300">
          <button
            onClick={() => onNavigateSection('how-it-works')}
            className="hover:text-teal-300 transition-colors cursor-pointer"
          >
            How it works
          </button>
          <button
            onClick={() => onNavigateSection('milestones')}
            className="hover:text-teal-300 transition-colors cursor-pointer"
          >
            Rating Milestones
          </button>
          <button
            onClick={() => onNavigateSection('methodology')}
            className="hover:text-teal-300 transition-colors cursor-pointer"
          >
            Leak Methodology
          </button>
          <button
            onClick={() => onNavigateSection('samples')}
            className="hover:text-teal-300 transition-colors cursor-pointer"
          >
            Sample Checkups
          </button>
        </nav>

        {/* Zone 3: 1-2 primary actions */}
        <div className="flex items-center gap-3">
          <button type="button" onClick={onHistoryClick} className="hidden sm:inline-flex px-3 py-2 text-xs sm:text-sm font-semibold text-teal-200 border border-teal-900 rounded-lg hover:bg-teal-950/60">History</button>
          <button
            onClick={onStartCheckupClick}
            className="px-4 py-2 text-xs sm:text-sm font-semibold text-slate-950 bg-teal-400 hover:bg-teal-300 rounded-lg shadow-[0_0_20px_rgba(45,212,191,0.25)] transition-all hover:scale-[1.02] active:scale-[0.98] whitespace-nowrap cursor-pointer"
          >
            Start Free Checkup
          </button>
        </div>
      </div>
    </header>
  );
};
