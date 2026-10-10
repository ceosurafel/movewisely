import React, { useState } from 'react';
import { CheckupAnalysis } from '../types/chess';

interface ShareReportModalProps {
  analysis: CheckupAnalysis;
  isOpen: boolean;
  onClose: () => void;
}

export const ShareReportModal: React.FC<ShareReportModalProps> = ({
  analysis,
  isOpen,
  onClose,
}) => {
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedText, setCopiedText] = useState(false);

  if (!isOpen) return null;

  const shareText = `♟️ MoveWisely Checkup: ${analysis.username} (${analysis.currentRating} ${analysis.timeControl.toUpperCase()})
MoveWisely experimental accuracy score: ${analysis.accuracy}% (internal reference: ${analysis.targetRatingAccuracy}%)
Blunders/game: ${analysis.blundersPerGame} (Target: ${analysis.targetBlundersPerGame})
Top Leak: ${analysis.leaks[0]?.title}
Selected rating goal: ${analysis.targetMilestone} (+${analysis.targetDistance} points; not a rating forecast).
Check your leaks at MoveWisely`;

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
  };

  const handleCopySummary = () => {
    navigator.clipboard.writeText(shareText);
    setCopiedText(true);
    setTimeout(() => setCopiedText(false), 2500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg bg-[#0a1519] border border-teal-800/60 rounded-2xl p-6 sm:p-8 shadow-2xl text-left">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 rounded-lg hover:bg-teal-950 cursor-pointer"
          aria-label="Close modal"
        >
          ✕
        </button>

        <h3 className="text-xl font-bold text-white mb-1">
          Share Your Chess Checkup
        </h3>
        <p className="text-xs text-slate-400 mb-6">
          Compare with friends or share on Discord, Reddit, and Twitter.
        </p>

        {/* Share Preview Card */}
        <div className="p-4 rounded-xl bg-[#060c0f] border border-teal-950 font-mono text-xs text-slate-300 whitespace-pre-line mb-6 leading-relaxed select-all">
          {shareText}
        </div>

        {/* Action Buttons */}
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={handleCopySummary}
            className="py-2.5 px-4 rounded-xl text-xs font-semibold bg-teal-900/40 text-teal-200 border border-teal-700/60 hover:bg-teal-800/50 transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            {copiedText ? '✓ Copied Summary!' : 'Copy Summary Text'}
          </button>
          <button
            type="button"
            onClick={handleCopyLink}
            className="py-2.5 px-4 rounded-xl text-xs font-semibold bg-teal-400 text-slate-950 hover:bg-teal-300 transition-all flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-teal-500/20"
          >
            {copiedLink ? '✓ Copied Link!' : 'Copy Report URL'}
          </button>
        </div>
      </div>
    </div>
  );
};
