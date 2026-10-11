import React, { useState, useEffect, useRef, useMemo } from 'react';
import confetti from 'canvas-confetti';
import { motion, AnimatePresence } from 'motion/react';
import { CheckupAnalysis, ActionPlanTask } from '../types/chess';
import { ChessBoardView } from './ChessBoardView';
import { ShareReportModal } from './ShareReportModal';
import { GameHistoryList } from './GameHistoryList';

interface ResultsViewProps {
  analysis: CheckupAnalysis;
  onNewCheckup: () => void;
  notice?: string;
  dailyPracticeBudget?: '5–15 min' | '15–30 min' | '30+ min';
}

const TOTAL_SLIDES = 8;
const SLIDE_DURATION = 6000; // 6 seconds per slide

// Friendly Chess Coach Avatar SVG (inspired by Chess.com coach Zach)
const CoachAvatar: React.FC = () => (
  <div className="w-11 h-11 rounded-full overflow-hidden bg-[#e08350] shrink-0 border-2 border-white/20 shadow-md">
    <svg viewBox="0 0 100 100" className="w-full h-full">
      {/* Background soft peach */}
      <circle cx="50" cy="50" r="50" fill="#f6ad7b" />
      {/* Hair back */}
      <path d="M 22 45 Q 18 20 50 15 Q 82 20 78 45 Z" fill="#92400e" />
      {/* Face */}
      <circle cx="50" cy="52" r="28" fill="#ffedd5" />
      {/* Hair top / front */}
      <path d="M 25 35 Q 35 18 58 20 Q 75 22 75 32 Q 62 25 45 28 Q 30 30 25 35 Z" fill="#b45309" />
      {/* Eyes */}
      <circle cx="41" cy="48" r="3.5" fill="#1e293b" />
      <circle cx="59" cy="48" r="3.5" fill="#1e293b" />
      {/* Smile */}
      <path d="M 43 58 Q 50 66 57 58" fill="none" stroke="#9a3412" strokeWidth="2.5" strokeLinecap="round" />
      {/* Cheeks */}
      <circle cx="36" cy="54" r="3" fill="#fca5a5" opacity="0.6" />
      <circle cx="64" cy="54" r="3" fill="#fca5a5" opacity="0.6" />
      {/* Shirt */}
      <path d="M 20 95 Q 50 78 80 95 Z" fill="#ea580c" />
      <path d="M 40 85 Q 50 92 60 85" fill="none" stroke="#ffedd5" strokeWidth="2" />
    </svg>
  </div>
);

// Typewriter text hook for Slide 5 coach speech bubble
const useTypewriter = (text: string, speed = 25, active = true) => {
  const [displayedText, setDisplayedText] = useState('');

  useEffect(() => {
    if (!active) {
      setDisplayedText('');
      return;
    }
    setDisplayedText('');
    let i = 0;
    const interval = setInterval(() => {
      i++;
      if (i <= text.length) {
        setDisplayedText(text.slice(0, i));
      } else {
        clearInterval(interval);
      }
    }, speed);

    return () => clearInterval(interval);
  }, [text, speed, active]);

  return displayedText;
};

export const ResultsView: React.FC<ResultsViewProps> = ({
  analysis,
  onNewCheckup,
  notice,
  dailyPracticeBudget = '15–30 min',
}) => {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [slideProgress, setSlideProgress] = useState(0); // 0 to 100
  const [isPaused, setIsPaused] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [showGamesList, setShowGamesList] = useState(false);
  const [tasks, setTasks] = useState<ActionPlanTask[]>(analysis.actionPlan.tasks);
  const [planStarted, setPlanStarted] = useState(false);

  // Compute an opening-error rate from completed engine-reviewed user moves only.
  // Missing move-level evidence stays unavailable instead of becoming a fabricated score.
  const openingErrorsPerGame = useMemo((): number | null => {
    const records = (analysis.diagnostics as any)?.analyzedGameRecords;
    if (!Array.isArray(records)) return null;
    const errorGrades = new Set(['inaccuracy', 'mistake', 'blunder', 'miss']);
    let completedGames = 0;
    let openingErrors = 0;
    for (const record of records) {
      if (record?.status !== 'completed' || !Array.isArray(record?.analyzedMoves)) continue;
      completedGames += 1;
      const userColor = record?.game?.userColor;
      for (const move of record.analyzedMoves) {
        if (
          move?.color === userColor &&
          Number.isFinite(move?.moveNumber) &&
          move.moveNumber <= 12 &&
          errorGrades.has(String(move?.judgment ?? '').toLowerCase())
        ) {
          openingErrors += 1;
        }
      }
    }
    return completedGames > 0 ? Number((openingErrors / completedGames).toFixed(2)) : null;
  }, [analysis.diagnostics]);

  // Counter animations
  const [accuracyVal, setAccuracyVal] = useState(0);
  const [blundersVal, setBlundersVal] = useState(0);

  // Touch tracking for swipe gestures
  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);

  // Auto-advance Story Timer
  useEffect(() => {
    // On Slide 4 (interactive board) or Slide 7 (the plan road page), freeze auto-advance
    if (currentSlide === 4 || currentSlide === 7 || isPaused) return;

    const intervalTime = 50; // update progress every 50ms
    const step = (100 / (SLIDE_DURATION / intervalTime));

    const timer = setInterval(() => {
      setSlideProgress(prev => {
        if (prev >= 100) {
          if (currentSlide < TOTAL_SLIDES - 1) {
            setCurrentSlide(s => s + 1);
            return 0;
          }
          return 100;
        }
        return prev + step;
      });
    }, intervalTime);

    return () => clearInterval(timer);
  }, [currentSlide, isPaused]);

  // Reset progress on slide change
  useEffect(() => {
    setSlideProgress(0);
  }, [currentSlide]);

  // Accuracy counter on Slide 1
  useEffect(() => {
    if (currentSlide === 1) {
      setAccuracyVal(0);
      let val = 0;
      const target = analysis.accuracy;
      const step = target / 25;
      const timer = setInterval(() => {
        val += step;
        if (val >= target) {
          setAccuracyVal(target);
          clearInterval(timer);
        } else {
          setAccuracyVal(parseFloat(val.toFixed(1)));
        }
      }, 35);
      return () => clearInterval(timer);
    }
  }, [currentSlide, analysis.accuracy]);

  // Blunders counter on Slide 2
  useEffect(() => {
    if (currentSlide === 2) {
      setBlundersVal(0);
      let val = 0;
      const target = analysis.blundersPerGame;
      const step = target / 20;
      const timer = setInterval(() => {
        val += step;
        if (val >= target) {
          setBlundersVal(target);
          clearInterval(timer);
        } else {
          setBlundersVal(parseFloat(val.toFixed(1)));
        }
      }, 40);
      return () => clearInterval(timer);
    }
  }, [currentSlide, analysis.blundersPerGame]);

  // Navigation handlers
  const goToNextSlide = () => {
    if (currentSlide < TOTAL_SLIDES - 1) {
      setCurrentSlide(prev => prev + 1);
    }
  };

  const goToPrevSlide = () => {
    if (currentSlide > 0) {
      setCurrentSlide(prev => prev - 1);
    }
  };

  // Keyboard navigation (Left / Right Arrow)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') goToNextSlide();
      if (e.key === 'ArrowLeft') goToPrevSlide();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentSlide]);

  // Screen Tap Navigation:
  // Tap right 70% = next, left 30% = prev
  const handleScreenClick = (e: React.MouseEvent<HTMLDivElement>) => {
    // If clicking on slide 7 (road to milestone), disable screen tap navigation so user can scroll & read
    if (currentSlide === 7) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const width = rect.width;

    if (x > width * 0.3) {
      goToNextSlide();
    } else {
      goToPrevSlide();
    }
  };

  // Touch handlers for swipe
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
    setIsPaused(true);
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    setIsPaused(false);
    if (touchStartX.current === null || touchStartY.current === null) return;
    const diffX = e.changedTouches[0].clientX - touchStartX.current;
    const diffY = e.changedTouches[0].clientY - touchStartY.current;

    // Horizontal swipe threshold > 45px with minimal vertical movement
    if (Math.abs(diffX) > 45 && Math.abs(diffX) > Math.abs(diffY)) {
      if (diffX < 0) goToNextSlide();
      else goToPrevSlide();
    }
    touchStartX.current = null;
    touchStartY.current = null;
  };

  // Toggle tasks in Slide 8
  const toggleTask = (taskId: string) => {
    setTasks(prev =>
      prev.map(t => (t.id === taskId ? { ...t, completed: !t.completed } : t))
    );
  };

  const handleStartPlan = () => {
    setPlanStarted(true);
    confetti({
      particleCount: 100,
      spread: 70,
      origin: { y: 0.7 },
      colors: ['#2dd4bf', '#81b64c', '#facc15', '#38bdf8', '#f43f5e'],
    });
  };

  // Eval swing text computation for Slide 5
  const evalSwingText = useMemo(() => {
    if (!analysis.spotlightMove?.evalDiff) {
      return { before: '0.0', after: '0.0' };
    }
    const rawDiff = analysis.spotlightMove.evalDiff;
    const parts = rawDiff.split('→').map(s => s.trim());
    const before = parts[0] || '0.0';
    const after = parts[1] || '0.0';
    return { before, after };
  }, [analysis.spotlightMove?.evalDiff]);

  // Full coach speech message grounded in Stockfish 19 & Phase 5 coaching
  const fullCoachSpeech = useMemo(() => {
    if (!analysis.spotlightMove) {
      return 'No critical blunders detected in your verified games.';
    }
    if (analysis.spotlightMove.coaching?.coachSpeech) {
      return analysis.spotlightMove.coaching.coachSpeech;
    }
    if (analysis.spotlightMove.explanation) {
      return analysis.spotlightMove.explanation;
    }
    return `Move ${analysis.spotlightMove.moveNumber} against ${analysis.spotlightMove.opponent}: you played ${analysis.spotlightMove.userMoveSan}, and ${analysis.spotlightMove.bestMoveSan} was the move.`;
  }, [analysis.spotlightMove, evalSwingText]);

  const typewriterCoachText = useTypewriter(fullCoachSpeech, 22, currentSlide === 4);

  // Helper to color the best move green in typewriter text
  const renderFormattedCoachSpeech = (raw: string, bestMove: string) => {
    if (!raw.includes(bestMove)) return <span>{raw}</span>;
    const index = raw.indexOf(bestMove);
    const before = raw.slice(0, index);
    const after = raw.slice(index + bestMove.length);
    return (
      <span>
        {before}
        <span className="text-[#81b64c] font-bold underline decoration-[#81b64c]/40">{bestMove}</span>
        {after}
      </span>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black overflow-hidden select-none font-[var(--font-body)]">
      {/* 440px Centered Stories Container */}
      <div
        className="relative w-full max-w-[440px] h-[100dvh] overflow-hidden flex flex-col justify-between shadow-2xl bg-black"
        onClick={handleScreenClick}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        onMouseDown={() => setIsPaused(true)}
        onMouseUp={() => setIsPaused(false)}
      >
        {/* Top Story Progress Bar (Row of 8 segments) */}
        <div className="absolute top-0 left-0 right-0 z-40 px-3 pt-3 pb-1 flex items-center gap-1.5 pointer-events-none">
          {Array.from({ length: TOTAL_SLIDES }).map((_, idx) => {
            const isPast = idx < currentSlide;
            const isCurrent = idx === currentSlide;

            return (
              <div
                key={idx}
                className="h-1 flex-1 rounded-full bg-white/20 overflow-hidden"
              >
                {isPast && <div className="h-full w-full bg-white rounded-full" />}
                {isCurrent && (
                  <div
                    className="h-full bg-white rounded-full transition-all duration-75 ease-linear"
                    style={{ width: `${slideProgress}%` }}
                  />
                )}
              </div>
            );
          })}
        </div>

        {/* Notice badge if fallback benchmark data was used */}
        {notice && (
          <div className="absolute top-7 left-3 right-3 z-30 px-3 py-1.5 rounded-lg bg-teal-950/80 border border-teal-700/60 text-[10px] text-teal-200 pointer-events-none">
            {notice}
          </div>
        )}

        {/* Insufficient data notification banner */}
        {analysis.diagnostics?.isInsufficientData && (
          <div className="absolute top-12 left-3 right-3 z-40 p-4 rounded-xl bg-amber-950/90 border border-amber-600/80 text-xs text-amber-200 shadow-xl backdrop-blur-md">
            <div className="font-bold uppercase tracking-wider mb-1 flex items-center gap-1.5">
              <span>⚠</span>
              <span>Insufficient Game Data</span>
            </div>
            <p className="text-[11px] leading-relaxed text-amber-100">
              {analysis.diagnostics.insufficientDataReason || 'At least 3 valid rated games are required for a complete diagnostic report.'}
            </p>
          </div>
        )}

        {/* Dynamic Animated Slides Area */}
        <div className="flex-1 w-full h-full relative overflow-hidden flex flex-col">
          <AnimatePresence mode="wait">
            {/* ========================================================
                SLIDE 1: INTRO (Flickering 5x4 Grid + Username)
               ======================================================== */}
            {currentSlide === 0 && (
              <motion.div
                key="slide-0"
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 1.02 }}
                transition={{ duration: 0.35 }}
                className="w-full h-full flex flex-col justify-between p-6 pt-12 pb-20 bg-gradient-to-b from-[#04282e] via-[#071317] to-black"
              >
                <div className="space-y-2">
                  <span className="text-[11px] font-mono font-bold tracking-widest text-teal-400 block uppercase">
                    MOVEWISELY CHECKUP
                  </span>
                  <h1 className="text-4xl sm:text-5xl font-black text-white tracking-tight leading-none break-words">
                    {analysis.username}
                  </h1>
                </div>

                {/* Grid of Squares for Analyzed Games that flicker softly */}
                <div className="py-6 flex flex-col items-center justify-center">
                  <div className={`grid gap-2.5 p-4 rounded-2xl bg-black/40 border border-teal-900/50 backdrop-blur-md ${analysis.totalGames <= 10 ? 'grid-cols-5' : 'grid-cols-5'}`}>
                    {Array.from({ length: Math.max(1, analysis.totalGames) }).map((_, i) => (
                      <motion.div
                        key={i}
                        initial={{ opacity: 0.3 }}
                        animate={{
                          opacity: [0.35, 1, 0.55],
                          scale: [0.95, 1.05, 1],
                        }}
                        transition={{
                          duration: 2.2,
                          repeat: Infinity,
                          delay: (i % 5) * 0.12 + Math.floor(i / 5) * 0.15,
                        }}
                        role="img"
                        aria-label={`Analyzed game ${i + 1}: ${i < analysis.wins ? 'win' : i < analysis.wins + analysis.draws ? 'draw' : 'loss'}`}
                        title={`Game ${i + 1}: ${i < analysis.wins ? 'Win' : i < analysis.wins + analysis.draws ? 'Draw' : 'Loss'}`}
                        className={`w-9 h-9 rounded-lg border transition-colors ${
                          i < analysis.wins
                            ? 'bg-[#20b7a8]/60 border-[#2bdac9]/35'
                            : i < analysis.wins + analysis.draws
                            ? 'bg-[#326b67]/40 border-[#326b67]/30'
                            : 'bg-[#2b3738]/75 border-[#3d4a4a]/50'
                        }`}
                      />
                    ))}
                  </div>
                  <span className="text-[11px] text-teal-300/80 font-mono mt-3">
                    {analysis.wins}W · {analysis.losses}L · {analysis.draws}D
                  </span>
                </div>

                <div className="space-y-1">
                  <p className="text-xl sm:text-2xl font-bold text-white">
                    Your {analysis.totalGames} {analysis.timeControl} games analyzed
                  </p>
                  <p className="text-xs text-slate-400">
                    Compared with MoveWisely's internal reference for the <strong className="text-teal-300">{analysis.targetMilestone}</strong> milestone
                  </p>
                  <div className="pt-4 flex items-center gap-1.5 text-xs text-teal-400 font-medium">
                    <span>Tap right to reveal your accuracy</span>
                    <span className="animate-pulse">→</span>
                  </div>
                </div>
              </motion.div>
            )}

            {/* ========================================================
                SLIDE 2: YOUR ACCURACY (Huge cyan %, comparison bars)
               ======================================================== */}
            {currentSlide === 1 && (
              <motion.div
                key="slide-1"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.35 }}
                className="w-full h-full flex flex-col justify-between p-6 pt-12 pb-20 bg-gradient-to-b from-[#053238] via-[#06191f] to-black"
              >
                <div>
                  <span className="text-[11px] font-mono font-bold tracking-widest text-cyan-400 uppercase">
                    YOUR ACCURACY
                  </span>
                  <div className="text-7xl sm:text-8xl font-black text-cyan-300 font-mono tracking-tight leading-none mt-4 tabular-nums">
                    {accuracyVal}%
                  </div>
                  <span className="text-xs text-slate-400 mt-1 block">
                    Average across the {analysis.totalGames} games analyzed
                  </span>
                </div>

                {/* Two Segmented Bars (You vs Target) */}
                <div className="space-y-5 p-5 rounded-2xl bg-[#061217]/90 border border-teal-900/60 backdrop-blur-md">
                  <div>
                    <div className="flex justify-between text-xs text-slate-200 mb-1.5 font-medium">
                      <span>You</span>
                      <span className="font-mono text-cyan-300 font-bold">{analysis.accuracy}%</span>
                    </div>
                    <div className="w-full h-4 bg-slate-900 rounded-full overflow-hidden p-0.5 border border-teal-950">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${Math.min(100, analysis.accuracy)}%` }}
                        transition={{ duration: 1, ease: 'easeOut' }}
                        className="h-full bg-gradient-to-r from-teal-400 to-cyan-300 rounded-full"
                      />
                    </div>
                  </div>

                  <div className="relative">
                    <div className="flex justify-between text-xs text-slate-300 mb-1.5 font-medium">
                      <span>Internal reference ({analysis.targetMilestone} milestone)</span>
                      <span className="font-mono text-slate-200 font-bold">{analysis.targetRatingAccuracy}%</span>
                    </div>
                    <div className="w-full h-4 bg-slate-900 rounded-full overflow-hidden p-0.5 border border-teal-950 relative">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${Math.min(100, analysis.targetRatingAccuracy)}%` }}
                        transition={{ duration: 1, ease: 'easeOut' }}
                        className="h-full bg-slate-500 rounded-full"
                      />
                      {/* White Tick at Target */}
                      <div
                        className="absolute top-0 bottom-0 w-1 bg-white shadow-sm rounded-full z-10"
                        style={{ left: `${Math.min(99, analysis.targetRatingAccuracy)}%` }}
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <div className="p-3.5 rounded-xl bg-cyan-950/30 border border-cyan-800/40 text-sm font-semibold text-white">
                    {analysis.accuracy >= analysis.targetRatingAccuracy
                      ? 'At or above the internal reference score.'
                      : `${(analysis.targetRatingAccuracy - analysis.accuracy).toFixed(1)} points below the internal reference score.`}
                  </div>
                  <p className="text-xs text-slate-400 mt-2">
                    This experimental score is not calibrated to a universal chess-accuracy standard and does not prove a player's rating level.
                  </p>
                </div>
              </motion.div>
            )}

            {/* ========================================================
                SLIDE 3: BLUNDERS PER GAME (Coral/Red theme)
               ======================================================== */}
            {currentSlide === 2 && (
              <motion.div
                key="slide-2"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.35 }}
                className="w-full h-full flex flex-col justify-between p-6 pt-12 pb-20 bg-gradient-to-b from-[#3b0d14] via-[#1c080d] to-black"
              >
                <div>
                  <span className="text-[11px] font-mono font-bold tracking-widest text-rose-400 uppercase">
                    BLUNDERS PER GAME
                  </span>
                  <div className="text-7xl sm:text-8xl font-black text-rose-400 font-mono tracking-tight leading-none mt-4 tabular-nums">
                    {blundersVal}
                    <span className="text-2xl text-slate-400 font-normal ml-2">/ game</span>
                  </div>
                  <span className="text-xs text-slate-400 mt-1 block">
                    Unforced material losses & severe evaluation drops
                  </span>
                </div>

                {/* Comparison Bar (Coral vs Gray) */}
                <div className="space-y-5 p-5 rounded-2xl bg-[#140608]/90 border border-rose-900/50 backdrop-blur-md">
                  <div>
                    <div className="flex justify-between text-xs text-slate-200 mb-1.5 font-medium">
                      <span>You</span>
                      <span className="font-mono text-rose-400 font-bold">{analysis.blundersPerGame} blunders</span>
                    </div>
                    <div className="w-full h-4 bg-slate-900 rounded-full overflow-hidden p-0.5 border border-rose-950">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${Math.min(100, (analysis.blundersPerGame / 4) * 100)}%` }}
                        transition={{ duration: 1, ease: 'easeOut' }}
                        className="h-full bg-rose-500 rounded-full"
                      />
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between text-xs text-slate-300 mb-1.5 font-medium">
                      <span>{analysis.targetMilestone} Target Players</span>
                      <span className="font-mono text-slate-300 font-bold">{analysis.targetBlundersPerGame} blunders</span>
                    </div>
                    <div className="w-full h-4 bg-slate-900 rounded-full overflow-hidden p-0.5 border border-slate-800">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${Math.min(100, (analysis.targetBlundersPerGame / 4) * 100)}%` }}
                        transition={{ duration: 1, ease: 'easeOut' }}
                        className="h-full bg-slate-500 rounded-full"
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <div className="p-3.5 rounded-xl bg-rose-950/40 border border-rose-800/50 text-sm font-semibold text-rose-200">
                    Use the detected blunder patterns as a training focus. MoveWisely does not predict a rating gain from reducing them.
                  </div>
                  <p className="text-xs text-slate-400 mt-2">
                    Treat the milestone as a reference goal, not a performance guarantee. Prioritize safe piece placement and calculate checks, captures, and threats before moving.
                  </p>
                </div>
              </motion.div>
            )}

            {/* ========================================================
                SLIDE 4: OPENING ERRORS (rating-leak story card)
               ======================================================== */}
            {currentSlide === 3 && (
              <motion.div
                key="slide-3"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.35 }}
                className="relative w-full h-full flex flex-col justify-between p-6 pt-12 pb-20 bg-gradient-to-b from-[#4a1017] via-[#250b11] to-[#090609] overflow-hidden"
              >
                <div className="absolute inset-0 pointer-events-none opacity-[0.12]" aria-hidden="true">
                  <div className="absolute -right-14 top-16 grid grid-cols-5 gap-1.5 rotate-12">
                    {Array.from({ length: 35 }).map((_, i) => (
                      <span key={i} className={`w-8 h-8 rounded ${i % 3 === 0 ? 'bg-rose-300' : 'bg-slate-500'}`} />
                    ))}
                  </div>
                </div>
                <div className="relative z-10">
                  <span className="text-[11px] font-mono font-bold tracking-widest text-rose-300 uppercase">
                    OPENING DISCIPLINE
                  </span>
                  <h2 className="mt-5 text-3xl font-black text-white">Opening errors</h2>
                  <div className="mt-3 flex items-baseline gap-2">
                    <span className="text-6xl sm:text-7xl font-black text-rose-200 font-mono tracking-tight leading-none tabular-nums">
                      {openingErrorsPerGame === null ? '—' : openingErrorsPerGame.toFixed(2).replace(/0$/, '').replace(/\.$/, '')}
                    </span>
                    <span className="text-sm text-slate-400">/ game</span>
                  </div>
                  <p className="mt-2 text-xs text-slate-300">
                    {openingErrorsPerGame === null
                      ? 'Opening move-level evidence was not available for this report.'
                      : 'Inaccuracies, mistakes and blunders in your first 12 moves, averaged over completed games.'}
                  </p>
                </div>

                <div className="relative z-10 rounded-2xl bg-[#17090d]/80 border border-rose-900/60 p-4">
                  <span className="text-[10px] font-mono uppercase tracking-wider text-rose-300/80">Opening to review</span>
                  <h3 className="mt-1 text-lg font-bold text-white break-words">{analysis.openingStats.mostFrequentOpening || 'Opening data unavailable'}</h3>
                  <p className="mt-2 text-xs text-slate-400 leading-relaxed">
                    Compare your first moves with the engine line and review the positions where your advantage dropped. This is a training signal, not proof that your opening repertoire is the only cause of a loss.
                  </p>
                  {analysis.openingStats.topLeakOpening?.name && analysis.openingStats.topLeakOpening.name !== 'None' && (
                    <div className="mt-3 pt-3 border-t border-rose-900/50">
                      <span className="block text-[10px] text-slate-500 uppercase tracking-wide">Opening with the weakest observed results</span>
                      <span className="block mt-1 text-sm font-semibold text-rose-100">{analysis.openingStats.topLeakOpening.name}</span>
                    </div>
                  )}
                </div>

                <div className="relative z-10 text-xs text-slate-400">
                  Continue to the move-level example →
                </div>
              </motion.div>
            )}

            {/* ========================================================
                SLIDE 5: “THE MOVE THAT COST YOU” (Chess.com Board + Coach)
               ======================================================== */}
            {currentSlide === 4 && (() => {
              const sm = analysis.spotlightMove;
              if (!sm) {
                return (
                  <motion.div
                    key="slide-4-empty"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.35 }}
                    className="w-full h-full flex flex-col items-center justify-center p-6 text-center bg-[#161512] text-zinc-300"
                  >
                    <div className="text-lg font-bold text-white mb-2">No Critical Blunder Spotlight</div>
                    <p className="text-xs text-zinc-400">All analyzed games were exceptionally clean or lacked decisive evaluation swings.</p>
                  </motion.div>
                );
              }
              return (
              <motion.div
                key="slide-4"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.35 }}
                className="w-full h-full flex flex-col justify-between p-3 pt-8 pb-16 bg-[#161512] overflow-y-auto"
              >
                {/* 20 Tiny Squares showing which game this is */}
                <div>
                  <div className="flex items-center justify-between mb-1.5 px-1">
                    <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-400">
                      Verified from {analysis.totalGames} analyzed games
                    </span>
                    <span className="text-[10px] font-mono text-rose-400 font-bold">
                      Critical Engine Blunder
                    </span>
                  </div>
                  <div className="flex items-center gap-1 px-1 mb-2">
                    {Array.from({ length: Math.max(1, analysis.totalGames) }).map((_, gIdx) => {
                      const isCurrent = gIdx === 0; // spotlight game index
                      return (
                        <div
                          key={gIdx}
                          className={`h-1.5 flex-1 rounded-sm ${
                            isCurrent
                              ? 'bg-rose-500 ring-1 ring-rose-400'
                              : gIdx < analysis.wins
                              ? 'bg-emerald-600/70'
                              : 'bg-zinc-700'
                          }`}
                        />
                      );
                    })}
                  </div>

                  {/* Header above the board: opponent on left, badges on right */}
                  <div className="flex items-center justify-between px-1 mb-2">
                    <div className="text-xs font-bold text-white flex items-center gap-1.5">
                      <span>vs {sm.opponent}</span>
                      <span className="text-[10px] text-zinc-400 font-mono">({sm.userColor === 'white' ? 'White' : 'Black'})</span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      {sm.tacticalTheme && (
                        <div className="px-2 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/40 text-[9px] font-bold font-mono text-amber-300">
                          {sm.tacticalTheme}
                        </div>
                      )}
                      <div className="px-2.5 py-0.5 rounded-full bg-[#81b64c]/20 border border-[#81b64c] text-[10px] font-black font-mono text-[#81b64c]">
                        {sm.bestMoveSan} WAS THE MOVE
                      </div>
                    </div>
                  </div>
                </div>

                {/* EXACT CHESS.COM MOBILE BOARD */}
                <div className="w-full my-auto">
                  <ChessBoardView
                    initialFen={sm.fenBefore}
                    fenAfterUserMove={sm.fenAfterUserMove}
                    bestMoveFrom={sm.bestMoveFrom}
                    bestMoveTo={sm.bestMoveTo}
                    userMoveFrom={sm.userMoveFrom}
                    userMoveTo={sm.userMoveTo}
                    orientation={sm.userColor}
                    refutationSteps={sm.coaching?.refutation?.continuationSteps}
                    interactive={true}
                  />

                  {/* User name below board */}
                  <div className="px-2 text-[11px] font-semibold text-zinc-300">
                    {analysis.username} ({analysis.currentRating})
                  </div>
                </div>

                {/* Coach Speech Bubble under the board */}
                <div
                  className="flex items-start gap-2.5 px-2 mt-2"
                  onClick={e => e.stopPropagation()}
                >
                  <CoachAvatar />
                  <div className="flex-1 bg-[#262421] text-zinc-100 rounded-2xl rounded-tl-sm p-3 text-xs leading-relaxed border border-zinc-700/60 shadow-lg min-h-[58px]">
                    <div className="font-semibold text-zinc-400 text-[10px] uppercase mb-0.5 font-mono">
                      Coach Zach
                    </div>
                    {renderFormattedCoachSpeech(typewriterCoachText, sm.bestMoveSan)}
                    {sm.coaching?.practicalLesson && (
                      <div className="mt-2 pt-2 border-t border-zinc-700/60 text-[11px] text-amber-200/90 flex items-start gap-1.5 leading-snug">
                        <span className="text-amber-400 font-bold shrink-0">💡 Lesson:</span>
                        <span>{sm.coaching.practicalLesson}</span>
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            );
            })()}

            {/* ========================================================
                SLIDE 6: “FROM {currentRating} TO {milestone}” (Rising bars)
               ======================================================== */}
            {currentSlide === 5 && (
              <motion.div
                key="slide-5"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.35 }}
                className="w-full h-full flex flex-col justify-between p-6 pt-12 pb-20 bg-gradient-to-b from-[#04282e] via-[#071317] to-black"
              >
                <div>
                  <span className="text-[11px] font-mono font-bold tracking-widest text-teal-400 uppercase">
                    RATING JOURNEY
                  </span>
                  <h2 className="text-3xl sm:text-4xl font-black text-white mt-1">
                    FROM {analysis.currentRating} TO {analysis.targetMilestone}
                  </h2>
                  <p className="text-xs text-slate-400 mt-1">
                    +{analysis.targetDistance} rating points to the selected milestone. Timeline estimates are not available.
                  </p>
                </div>

                {/* Transparent milestone card: no invented trajectory or timeline */}
                <div className="p-5 rounded-2xl bg-[#061217]/90 border border-teal-900/60 my-auto">
                  <div className="text-[11px] font-mono uppercase tracking-widest text-slate-400">
                    SELECTED GOAL · NOT A FORECAST
                  </div>
                  <div className="grid grid-cols-2 gap-3 mt-4">
                    <div className="rounded-xl bg-black/30 border border-slate-800 p-4">
                      <div className="text-xs text-slate-400">Current rating</div>
                      <div className="text-2xl font-black text-white mt-1">{analysis.currentRating}</div>
                    </div>
                    <div className="rounded-xl bg-black/30 border border-teal-800/60 p-4">
                      <div className="text-xs text-slate-400">Selected milestone</div>
                      <div className="text-2xl font-black text-cyan-300 mt-1">{analysis.targetMilestone}</div>
                    </div>
                  </div>
                  <div className="mt-4 text-sm text-slate-300 leading-relaxed">
                    {analysis.targetDistance > 0
                      ? `${analysis.targetDistance} rating points separate your current rating from this selected goal.`
                      : 'Your current rating has reached or exceeded this selected milestone.'}
                    {' '}MoveWisely cannot predict whether or when this goal will be reached.
                  </div>
                </div>

                <div className="space-y-1">
                  <div className="p-3.5 rounded-xl bg-teal-950/40 border border-teal-800/50 text-sm font-semibold text-teal-200">
                    {analysis.leaks.length} recurring patterns were identified in the analyzed games.
                  </div>
                  <p className="text-xs text-slate-400 mt-1">
                    Use these findings to guide practice. Improvement and rating changes vary and are not predicted by this report.
                  </p>
                </div>
              </motion.div>
            )}

            {/* ========================================================
                SLIDE 7: “YOUR LEAKS” (Scrollable cards + Cyan CTA)
               ======================================================== */}
            {currentSlide === 6 && (
              <motion.div
                key="slide-6"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.35 }}
                className="w-full h-full flex flex-col justify-between p-5 pt-12 pb-16 bg-gradient-to-b from-[#1a1106] via-[#0d0905] to-black"
              >
                <div>
                  <span className="text-[11px] font-mono font-bold tracking-widest text-amber-400 uppercase">
                    DIAGNOSTIC AUDIT
                  </span>
                  <h2 className="text-2xl sm:text-3xl font-black text-white mt-0.5">
                    YOUR LEAKS
                  </h2>
                  <p className="text-xs text-slate-400">
                    Ranked by observed severity and frequency in the analyzed games
                  </p>
                </div>

                {/* Vertical list of dark rounded cards (Scrollable) */}
                <div
                  className="space-y-2.5 max-h-[54vh] overflow-y-auto pr-1 my-3 select-text"
                  onClick={e => e.stopPropagation()}
                >
                  {analysis.leaks.map(leak => {
                    const isCritical = leak.severity === 'critical';
                    const isModerate = leak.severity === 'moderate';

                    return (
                      <div
                        key={leak.id}
                        className={`p-3.5 rounded-xl bg-[#120e0a] border text-left ${
                          isCritical
                            ? 'border-rose-900/60'
                            : isModerate
                            ? 'border-amber-900/60'
                            : 'border-teal-900/60'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-xs font-bold text-white">
                            #{leak.rank} {leak.title}
                          </span>
                          <span
                            className={`text-[9px] font-mono uppercase px-2 py-0.5 rounded-full font-bold ${
                              isCritical
                                ? 'bg-rose-950 text-rose-300'
                                : isModerate
                                ? 'bg-amber-950 text-amber-300'
                                : 'bg-teal-950 text-teal-300'
                            }`}
                          >
                            {leak.severity}
                          </span>
                        </div>

                        {/* Thin Colored Progress Bar */}
                        <div className="w-full h-1.5 bg-black/60 rounded-full overflow-hidden mb-2">
                          <div
                            className={`h-full rounded-full ${
                              isCritical ? 'bg-rose-500' : isModerate ? 'bg-amber-500' : 'bg-teal-400'
                            }`}
                            style={{ width: `${Math.min(100, Math.max(30, leak.userNumeric * 25))}%` }}
                          />
                        </div>

                        {/* Your value vs Target avg */}
                        <div className="flex items-center justify-between text-[11px] font-mono">
                          <span className={isCritical ? 'text-rose-400 font-bold' : 'text-amber-400 font-bold'}>
                            You: {leak.userMetric}
                          </span>
                          <span className="text-cyan-400">
                            Target avg: {leak.targetMetric}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Big Cyan Full-Width Button */}
                <div onClick={e => e.stopPropagation()}>
                  <button
                    type="button"
                    onClick={() => setCurrentSlide(7)}
                    className="w-full py-3.5 px-4 rounded-xl font-black text-slate-950 bg-gradient-to-r from-teal-400 via-cyan-300 to-emerald-400 hover:from-teal-300 hover:to-cyan-200 text-sm shadow-xl shadow-cyan-500/25 transition-all hover:scale-102 active:scale-98 cursor-pointer flex items-center justify-center gap-2"
                  >
                    <span>What can I do about it?</span>
                    <span>→</span>
                  </button>
                </div>
              </motion.div>
            )}

            {/* ========================================================
                SLIDE 8: “The road to {milestone}” (Plain dark page)
               ======================================================== */}
            {currentSlide === 7 && (
              <motion.div
                key="slide-7"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.35 }}
                className="w-full h-full bg-[#070d10] text-white overflow-y-auto px-5 py-6 pb-24 text-left select-text"
                onClick={e => e.stopPropagation()}
              >
                {/* Back link */}
                <button
                  type="button"
                  onClick={() => setCurrentSlide(6)}
                  className="text-xs text-teal-400 hover:text-teal-200 transition-colors cursor-pointer flex items-center gap-1.5 mb-4"
                >
                  <span>←</span>
                  <span>Back to my report</span>
                </button>

                <div className="mb-6">
                  <span className="text-[11px] font-mono font-bold tracking-widest text-teal-400 uppercase">
                    PERSONALIZED ROADMAP
                  </span>
                  <h2 className="text-2xl sm:text-3xl font-black text-white mt-0.5">
                    The road to {analysis.targetMilestone}
                  </h2>
                  <p className="text-xs text-slate-400 mt-1">
                    {analysis.actionPlan.coreFocus}
                  </p>
                  <p className="mt-3 inline-flex items-center rounded-full border border-teal-900/70 bg-teal-950/30 px-3 py-1.5 text-[10px] text-teal-200">
                    Your available training time: {dailyPracticeBudget} per day
                  </p>
                </div>

                {/* Rating milestone gap: a goal, not a forecast */}
                <div className="p-4 rounded-2xl bg-[#0b1419] border border-teal-900/60 mb-6 space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-bold text-white text-sm">Selected rating goal</span>
                    <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wide">Not a prediction</span>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-xl bg-black/30 p-3">
                      <p className="text-[10px] uppercase tracking-wide text-slate-400">Current rating</p>
                      <p className="text-2xl font-black text-white">{analysis.currentRating}</p>
                    </div>
                    <div className="rounded-xl bg-black/30 p-3">
                      <p className="text-[10px] uppercase tracking-wide text-slate-400">Selected milestone</p>
                      <p className="text-2xl font-black text-teal-300">{analysis.targetMilestone}</p>
                    </div>
                  </div>
                  <p className="text-xs leading-relaxed text-slate-400">
                    The difference is a planning target only. This report cannot predict how many rating points you will gain or how long improvement will take.
                  </p>
                </div>

                {/* "Session one" Action Tasks Checklist */}
                <div className="space-y-3 mb-6">
                  <div className="text-xs font-mono uppercase tracking-wider text-teal-300 font-semibold">
                    Session One Checklist
                  </div>

                  {tasks.map(task => (
                    <div
                      key={task.id}
                      onClick={() => toggleTask(task.id)}
                      className={`p-3.5 rounded-xl border transition-all cursor-pointer flex items-start gap-3 ${
                        task.completed
                          ? 'bg-emerald-950/20 border-emerald-800/40 text-slate-400'
                          : 'bg-[#0a1419] border-teal-900/60 text-white'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={task.completed}
                        onChange={() => {}}
                        className="mt-1 h-4 w-4 rounded border-slate-700 text-teal-500 focus:ring-teal-400 cursor-pointer"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-1">
                          <h5 className={`text-xs font-bold ${task.completed ? 'line-through text-slate-400' : 'text-white'}`}>
                            {task.title}
                          </h5>
                          <span className="text-[10px] text-teal-400 font-mono shrink-0">
                            {task.duration}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
                          {task.description}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Big Cyan "Start my plan" Button */}
                <div className="text-center pt-2 pb-6">
                  <button
                    type="button"
                    onClick={handleStartPlan}
                    className="w-full py-4 px-6 rounded-xl font-black text-slate-950 bg-gradient-to-r from-teal-400 via-cyan-300 to-emerald-400 hover:from-teal-300 hover:to-cyan-200 text-base shadow-xl shadow-teal-500/30 transition-all hover:scale-102 active:scale-98 cursor-pointer flex items-center justify-center gap-2"
                  >
                    <span>{planStarted ? '✓ Plan Activated!' : `Start my plan to ${analysis.targetMilestone}`}</span>
                    <span>🚀</span>
                  </button>

                  {planStarted && (
                    <p className="text-xs text-emerald-300 mt-2 font-medium">
                      Training plan ready. Review your next batch of completed games to measure progress; rating improvement and timing are not guaranteed.
                    </p>
                  )}
                </div>

                {/* Expandable Game History Ledger */}
                <div className="pt-4 border-t border-teal-950/80 space-y-4">
                  <button
                    type="button"
                    onClick={() => setShowGamesList(!showGamesList)}
                    className="w-full text-center text-xs text-teal-400 hover:text-teal-200 transition-colors underline cursor-pointer"
                  >
                    {showGamesList ? 'Hide analyzed games ledger' : `Inspect all ${analysis.games.length} analyzed games ledger ↓`}
                  </button>

                  {showGamesList && (
                    <div className="text-left animate-in fade-in duration-300">
                      <GameHistoryList games={analysis.games} username={analysis.username} />
                    </div>
                  )}

                  <div className="flex items-center justify-between text-xs text-slate-400 pt-2">
                    <button
                      type="button"
                      onClick={() => setShowShareModal(true)}
                      className="text-teal-300 hover:text-white cursor-pointer"
                    >
                      Share Report
                    </button>
                    <button
                      type="button"
                      onClick={onNewCheckup}
                      className="text-teal-300 hover:text-white cursor-pointer"
                    >
                      Check another account
                    </button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Story Bottom Bar (on Slides 0 to 6) */}
        {currentSlide < 7 && (
          <div
            className="absolute bottom-0 left-0 right-0 z-30 h-14 px-4 bg-gradient-to-t from-black via-black/80 to-transparent flex items-center justify-between pointer-events-auto"
            onClick={e => e.stopPropagation()}
          >
            {/* Small logo + movewisely */}
            <div className="flex items-center gap-1.5 text-zinc-400">
              <span className="w-5 h-5 rounded-md bg-teal-500/20 text-teal-400 font-black text-xs flex items-center justify-center">
                ♞
              </span>
              <span className="text-xs font-bold tracking-tight text-zinc-300 font-[var(--font-heading)]">
                movewisely
              </span>
            </div>

            {/* Pill Share Button */}
            <button
              type="button"
              onClick={() => setShowShareModal(true)}
              className="py-1.5 px-3.5 rounded-full bg-white/10 hover:bg-white/20 text-white text-xs font-semibold backdrop-blur-md border border-white/20 transition-all cursor-pointer flex items-center gap-1.5 shadow-sm active:scale-95"
            >
              <span>🔗</span>
              <span>Share</span>
            </button>
          </div>
        )}
      </div>

      {/* Share Report Modal */}
      <ShareReportModal
        analysis={analysis}
        isOpen={showShareModal}
        onClose={() => setShowShareModal(false)}
      />
    </div>
  );
};
