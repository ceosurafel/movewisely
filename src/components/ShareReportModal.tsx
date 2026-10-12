import React, { useEffect, useRef, useState } from 'react';
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
  const [clipboardError, setClipboardError] = useState<string | null>(null);
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    returnFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    dialogRef.current?.querySelector<HTMLButtonElement>('button')?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== 'Tab') return;

      const dialog = dialogRef.current;
      if (!dialog) return;
      const focusable = Array.from(
        dialog.querySelectorAll<HTMLElement>('button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])')
      ).filter(element => element.getAttribute('aria-hidden') !== 'true');
      if (focusable.length === 0) {
        event.preventDefault();
        dialog.focus();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      returnFocusRef.current?.focus();
      returnFocusRef.current = null;
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const appUrl = window.location.origin;
  const shareText = `♟️ MoveWisely Checkup: ${analysis.username} (${analysis.currentRating} ${analysis.timeControl.toUpperCase()})
MoveWisely experimental accuracy score: ${analysis.accuracy}% (internal reference: ${analysis.targetRatingAccuracy}%)
Blunders/game: ${analysis.blundersPerGame} (Target: ${analysis.targetBlundersPerGame})
Top Leak: ${analysis.leaks[0]?.title ?? 'No recurring leak identified in this report'}
Selected rating goal: ${analysis.targetMilestone} (+${analysis.targetDistance} points; not a rating forecast).
Open MoveWisely: ${appUrl}
Note: this app link opens a new checkup; it does not recreate this exact report.`;

  const handleCopyLink = async () => {
    setClipboardError(null);
    try {
      await navigator.clipboard.writeText(appUrl);
      setCopiedLink(true);
      window.setTimeout(() => setCopiedLink(false), 2500);
    } catch {
      setCopiedLink(false);
      setClipboardError('Clipboard access was blocked. Copy the site address from your browser address bar instead.');
    }
  };

  const handleCopySummary = async () => {
    setClipboardError(null);
    try {
      await navigator.clipboard.writeText(shareText);
      setCopiedText(true);
      window.setTimeout(() => setCopiedText(false), 2500);
    } catch {
      setCopiedText(false);
      setClipboardError('Clipboard access was blocked. Select and copy the summary text manually.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="share-report-title"
        tabIndex={-1}
        className="relative w-full max-w-lg bg-[#0a1519] border border-teal-800/60 rounded-2xl p-6 sm:p-8 shadow-2xl text-left"
      >
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 rounded-lg hover:bg-teal-950 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-300"
          aria-label="Close share dialog"
        >
          ✕
        </button>

        <h3 id="share-report-title" className="text-xl font-bold text-white mb-1">
          Share Your Chess Checkup
        </h3>
        <p className="text-xs text-slate-400 mb-3">
          Copy a text summary of this analysis or copy the MoveWisely app link.
        </p>
        <p className="text-xs text-amber-200/90 mb-6">
          The app link does not reconstruct this exact report. Share the summary text to communicate these results.
        </p>

        {/* Share Preview Card */}
        <div className="p-4 rounded-xl bg-[#060c0f] border border-teal-950 font-mono text-xs text-slate-300 whitespace-pre-line mb-6 leading-relaxed select-all">
          {shareText}
        </div>

        {clipboardError && (
          <p role="alert" className="mb-3 rounded-lg border border-rose-900/70 bg-rose-950/30 p-3 text-xs text-rose-200">
            {clipboardError}
          </p>
        )}

        {/* Action Buttons */}
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={handleCopySummary}
            className="py-2.5 px-4 rounded-xl text-xs font-semibold bg-teal-900/40 text-teal-200 border border-teal-700/60 hover:bg-teal-800/50 transition-all flex items-center justify-center gap-2 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-300"
          >
            {copiedText ? '✓ Copied Summary!' : 'Copy Summary Text'}
          </button>
          <button
            type="button"
            onClick={handleCopyLink}
            className="py-2.5 px-4 rounded-xl text-xs font-semibold bg-teal-400 text-slate-950 hover:bg-teal-300 transition-all flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-teal-500/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
          >
            {copiedLink ? '✓ Copied App Link!' : 'Copy App Link'}
          </button>
        </div>
      </div>
    </div>
  );
};
