/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Platform, TimeControl, CheckupAnalysis } from './types/chess';
import { fetchUserGames, FetchResult } from './services/chessApi';
import { analyzeUserGames } from './services/analysisEngine';
import { SAMPLE_PROFILES, SampleProfile } from './services/sampleData';
import { Navbar } from './components/Navbar';
import { HeroSection } from './components/HeroSection';
import { CheckupSetupFlow } from './components/CheckupSetupFlow';
import { LoadingCheckup } from './components/LoadingCheckup';
import { ResultsView } from './components/ResultsView';
import { loadCheckups, saveCheckup, SavedCheckup } from './services/checkupHistory';
import {
  HowItWorksSection,
  MilestoneBenchmarksSection,
  MethodologySection,
  SampleCheckupsSection,
  PrivacyNoticeSection,
  Footer,
} from './components/InfoSections';

type CheckupView = 'landing' | 'fetching' | 'setup' | 'loading' | 'results' | 'history';
type PracticeBudget = '5–15 min' | '15–30 min' | '30+ min';
type GoalStyle = 'milestone' | 'beyond';

interface AnalysisProgress {
  step: string;
  percent: number;
  currentGame: number;
  totalGames: number;
}

export default function App() {
  const [view, setView] = useState<CheckupView>('landing');
  const [activeUsername, setActiveUsername] = useState('');
  const [activePlatform, setActivePlatform] = useState<Platform>('chesscom');
  const [activeTimeControl, setActiveTimeControl] = useState<TimeControl>('rapid');

  const [fetchedProfile, setFetchedProfile] = useState<FetchResult | null>(null);
  const [analysis, setAnalysis] = useState<CheckupAnalysis | null>(null);
  const [history, setHistory] = useState<SavedCheckup[]>([]);
  const [historyError, setHistoryError] = useState('');
  const [analysisNotice, setAnalysisNotice] = useState<string | undefined>(undefined);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [selectedPracticeBudget, setSelectedPracticeBudget] = useState<PracticeBudget>('15–30 min');
  const [selectedGoalStyle, setSelectedGoalStyle] = useState<GoalStyle>('milestone');
  const [selectedTargetMilestone, setSelectedTargetMilestone] = useState<number | undefined>(undefined);
  const [analysisProgress, setAnalysisProgress] = useState<AnalysisProgress>({
    step: 'Waiting for checkup preferences',
    percent: 0,
    currentGame: 0,
    totalGames: 0,
  });

  // Step 1: verify the public profile and retrieve available games. The user chooses
  // their daily practice budget and target after we know their actual current rating.
  const startCheckupFlow = async (
    username: string,
    platform: Platform,
    timeControl: TimeControl
  ) => {
    setActiveUsername(username.trim());
    setActivePlatform(platform);
    setActiveTimeControl(timeControl);
    setFetchedProfile(null);
    setAnalysis(null);
    setAnalysisNotice(undefined);
    setErrorMessage(null);
    setView('fetching');

    try {
      const profile = await fetchUserGames(username, platform, timeControl);
      if (!Number.isFinite(profile.rating) || profile.rating <= 0) {
        throw new Error('The selected platform did not provide a verified rating for this username.');
      }
      if (!Array.isArray(profile.games) || profile.games.length === 0) {
        throw new Error('No public games were available for this time control.');
      }
      setFetchedProfile(profile);
      setAnalysisNotice(profile.notice);
      setAnalysisProgress({
        step: 'Profile verified; waiting for your training goal',
        percent: 0,
        currentGame: 0,
        totalGames: Math.min(20, profile.games.length),
      });
      setView('setup');
    } catch (err: unknown) {
      console.error('Profile lookup failed:', err);
      const msg = err instanceof Error ? err.message : 'Could not retrieve your public profile';
      setErrorMessage(`${msg} Please verify the username, confirm the profile is public, or try a demo profile.`);
      setView('landing');
    }
  };

  // Step 2: start the genuine Stockfish-backed analysis only after the user confirms
  // the training budget and milestone in the reference-matched wizard.
  const beginAnalysis = async (
    targetMilestone: number,
    practiceBudget: PracticeBudget,
    goalStyle: GoalStyle
  ) => {
    if (!fetchedProfile) {
      setErrorMessage('Your public profile is not ready. Please retry the checkup.');
      setView('landing');
      return;
    }

    setSelectedPracticeBudget(practiceBudget);
    setSelectedGoalStyle(goalStyle);
    setSelectedTargetMilestone(targetMilestone);
    setErrorMessage(null);
    const totalGames = Math.min(20, fetchedProfile.games.length);
    setAnalysisProgress({
      step: 'Preparing the Stockfish engine',
      percent: 3,
      currentGame: 0,
      totalGames,
    });
    setView('loading');

    try {
      const computedAnalysis = await analyzeUserGames(
        fetchedProfile.username,
        fetchedProfile.platform,
        fetchedProfile.timeControl,
        fetchedProfile.rating,
        fetchedProfile.games,
        {
          targetMilestone,
          onProgress: (step, percent) => {
            const match = step.match(/(?:Analyzing|Completed) game (\d+) of (\d+)/i);
            const currentGame = match ? Number(match[1]) : 0;
            const totalFromStep = match ? Number(match[2]) : totalGames;
            setAnalysisProgress({
              step,
              percent: Math.max(0, Math.min(100, percent)),
              currentGame,
              totalGames: totalFromStep || totalGames,
            });
          },
        }
      );

      setAnalysis(computedAnalysis);
      setView('results');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      if (computedAnalysis.completedGamesCount > 0) {
        void saveCheckup(computedAnalysis)
          .then(() => loadCheckups())
          .then(setHistory)
          .then(() => setHistoryError(''))
          .catch(historyErr => {
            console.warn('Could not save checkup history:', historyErr);
            setHistoryError('This checkup is available for this visit, but browser storage could not save it.');
          });
      }
    } catch (err: unknown) {
      console.error('Checkup analysis failed:', err);
      const msg = err instanceof Error ? err.message : 'The chess engine could not complete the checkup';
      setErrorMessage(`${msg}. Your analysis was not replaced with demo results. Please retry.`);
      setView('landing');
    }
  };

  const handleNewCheckup = () => {
    setView('landing');
    setFetchedProfile(null);
    setAnalysis(null);
    setSelectedTargetMilestone(undefined);
    setErrorMessage(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const openHistory = async () => {
    try { setHistory(await loadCheckups()); setHistoryError(''); setView('history'); }
    catch { setHistoryError('Could not read saved checkups from this browser.'); setView('history'); }
  };

  const openSavedCheckup = (item: SavedCheckup) => { setAnalysis(item.analysis); setView('results'); };

  const handleSelectSample = (sample: SampleProfile) => {
    startCheckupFlow(sample.username, sample.platform, sample.timeControl);
  };

  const handleNavigateSection = (sectionId: string) => {
    if (view !== 'landing') {
      setView('landing');
      setTimeout(() => {
        const el = document.getElementById(sectionId);
        if (el) el.scrollIntoView({ behavior: 'smooth' });
        else window.scrollTo({ top: 0, behavior: 'smooth' });
      }, 100);
    } else if (sectionId === 'hero') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      document.getElementById(sectionId)?.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const isLanding = view === 'landing';

  return (
    <div className="min-h-screen bg-[#060c0f] text-[#e6f1f2] flex flex-col font-[var(--font-body)]">
      {isLanding && (
        <Navbar
          onStartCheckupClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          onNavigateSection={handleNavigateSection}
          onHistoryClick={openHistory}
        />
      )}

      <main className="flex-1">
        {isLanding && (
          <>
            {errorMessage && (
              <div className="max-w-4xl mx-auto px-4 mt-6" role="alert">
                <div className="p-4 rounded-xl bg-rose-950/50 border border-rose-900 text-xs text-rose-300">
                  {errorMessage}
                </div>
              </div>
            )}
            <HeroSection
              onStartCheckup={startCheckupFlow}
              isLoading={false}
              initialUsername={activeUsername}
              initialPlatform={activePlatform}
              initialTimeControl={activeTimeControl}
            />
            <HowItWorksSection />
            <MilestoneBenchmarksSection />
            <MethodologySection />
            <SampleCheckupsSection
              onSelectSample={handleSelectSample}
              onStartCheckupClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            />
            <PrivacyNoticeSection />
          </>
        )}

        {view === 'fetching' && (
          <section className="relative min-h-[100dvh] bg-[#050607] flex items-center justify-center px-4 py-14">
            <div className="absolute top-0 left-0 right-0 h-[3px] bg-white/[0.06] overflow-hidden">
              <div className="h-full w-1/3 bg-[#24d9c7] animate-pulse" />
            </div>
            <div className="w-full max-w-[340px]">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-xl bg-[#092f2d] border border-[#155651] text-[#31ddce] flex items-center justify-center" aria-hidden="true">♟</div>
                <div className="flex-1 rounded-xl rounded-tl-sm bg-[#1a1a1f] border border-white/[0.04] px-4 py-3">
                  <h1 className="text-sm font-medium text-white">Let’s find your rating first.</h1>
                  <p className="mt-1.5 text-[11px] leading-relaxed text-slate-400">Checking the public {activePlatform === 'chesscom' ? 'Chess.com' : 'Lichess'} profile for <span className="text-[#28dccc]">{activeUsername}</span> and retrieving recent {activeTimeControl} games…</p>
                  <div className="mt-3 h-1 rounded-full bg-white/[0.06] overflow-hidden"><div className="h-full w-1/3 bg-[#28dccc] animate-pulse" /></div>
                </div>
              </div>
              <p className="mt-4 text-center text-[10px] text-slate-700">No password is requested · Public profile only</p>
            </div>
          </section>
        )}

        {view === 'setup' && fetchedProfile && (
          <CheckupSetupFlow
            username={fetchedProfile.username}
            platform={fetchedProfile.platform}
            timeControl={fetchedProfile.timeControl}
            currentRating={fetchedProfile.rating}
            gamesAvailable={Math.min(20, fetchedProfile.games.length)}
            onBack={() => setView('landing')}
            onStart={beginAnalysis}
          />
        )}

        {view === 'loading' && fetchedProfile && (
          <LoadingCheckup
            username={fetchedProfile.username}
            platform={fetchedProfile.platform}
            timeControl={fetchedProfile.timeControl}
            currentRating={fetchedProfile.rating}
            targetMilestone={selectedTargetMilestone ?? fetchedProfile.rating}
            progress={analysisProgress.percent}
            step={analysisProgress.step}
            currentGame={analysisProgress.currentGame}
            totalGames={analysisProgress.totalGames}
          />
        )}

        {view === 'history' && (
          <section className="min-h-[100dvh] bg-[#060c0f] px-4 py-10 text-white">
            <div className="max-w-4xl mx-auto">
              <button type="button" onClick={() => setView('landing')} className="text-sm text-teal-300 mb-6">← Back to MoveWisely</button>
              <p className="text-xs uppercase tracking-widest text-teal-400 font-mono">Your account reviews</p>
              <h1 className="text-3xl font-black mt-1">Checkup History</h1>
              <p className="text-sm text-slate-400 mt-2">Completed checkups are saved privately in this browser on this device.</p>
              {historyError && <p role="alert" className="mt-4 text-sm text-amber-300">{historyError}</p>}
              {!history.length && <div className="mt-8 rounded-2xl border border-slate-800 bg-slate-900/40 p-6 text-sm text-slate-400">No saved checkups yet. Complete a checkup and it will appear here.</div>}
              <div className="grid gap-3 mt-6">{history.map(item => <article key={item.id} className="rounded-2xl border border-teal-900/50 bg-[#0a171b] p-4 flex flex-wrap items-center justify-between gap-4"><div><h2 className="font-bold text-white">{item.analysis.username}</h2><p className="text-xs text-slate-400 mt-1">{item.analysis.platform === 'chesscom' ? 'Chess.com' : 'Lichess'} · {item.analysis.timeControl} · {item.analysis.completedGamesCount} games</p><p className="text-xs text-slate-500 mt-1">{new Date(item.analysis.analyzedAt).toLocaleString()} · Rating {item.analysis.currentRating}</p></div><button type="button" onClick={() => openSavedCheckup(item)} className="rounded-lg bg-teal-400 px-4 py-2 text-sm font-bold text-slate-950">Open report</button></article>)}</div>
            </div>
          </section>
        )}

        {view === 'results' && analysis && (
          <ResultsView
            analysis={analysis}
            onNewCheckup={handleNewCheckup}
            notice={analysisNotice}
            dailyPracticeBudget={selectedPracticeBudget}
            goalStyle={selectedGoalStyle}
          />
        )}
      </main>

      {isLanding && <Footer />}
    </div>
  );
}
