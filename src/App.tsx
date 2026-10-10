/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Platform, TimeControl, CheckupAnalysis } from './types/chess';
import { fetchUserGames } from './services/chessApi';
import { analyzeUserGames } from './services/analysisEngine';
import { SAMPLE_PROFILES, SampleProfile } from './services/sampleData';
import { Navbar } from './components/Navbar';
import { HeroSection } from './components/HeroSection';
import { LoadingCheckup } from './components/LoadingCheckup';
import { ResultsView } from './components/ResultsView';
import {
  HowItWorksSection,
  MilestoneBenchmarksSection,
  MethodologySection,
  SampleCheckupsSection,
  Footer,
} from './components/InfoSections';

export default function App() {
  const [view, setView] = useState<'landing' | 'loading' | 'results'>('landing');
  const [activeUsername, setActiveUsername] = useState('Alex');
  const [activePlatform, setActivePlatform] = useState<Platform>('chesscom');
  const [activeTimeControl, setActiveTimeControl] = useState<TimeControl>('rapid');

  const [analysis, setAnalysis] = useState<CheckupAnalysis | null>(null);
  const [analysisNotice, setAnalysisNotice] = useState<string | undefined>(undefined);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const startCheckupFlow = async (
    username: string,
    platform: Platform,
    timeControl: TimeControl
  ) => {
    setActiveUsername(username);
    setActivePlatform(platform);
    setActiveTimeControl(timeControl);
    setErrorMessage(null);
    setView('loading');

    try {
      const fetchResult = await fetchUserGames(username, platform, timeControl);
      const computedAnalysis = await analyzeUserGames(
        fetchResult.username,
        fetchResult.platform,
        fetchResult.timeControl,
        fetchResult.rating,
        fetchResult.games
      );

      setAnalysis(computedAnalysis);
      setAnalysisNotice(fetchResult.notice);
    } catch (err: unknown) {
      console.error('Checkup failure:', err);
      const msg = err instanceof Error ? err.message : 'Could not fetch games from platform';
      // Phase 4 Requirement: Never replace a real user's failed lookup with sample games.
      // Show explicit error notification and keep user on landing view to correct username or retry.
      setErrorMessage(`${msg}. Please verify your username, check if your profile is public, or choose a verified demo profile below.`);
      setView('landing');
    }
  };

  const handleLoadingComplete = () => {
    setView('results');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleNewCheckup = () => {
    setView('landing');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

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
    } else {
      if (sectionId === 'hero') {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      } else {
        const el = document.getElementById(sectionId);
        if (el) el.scrollIntoView({ behavior: 'smooth' });
      }
    }
  };

  return (
    <div className="min-h-screen bg-[#060c0f] text-[#e6f1f2] flex flex-col font-[var(--font-body)]">
      {/* Persistent Navigation */}
      <Navbar
        onStartCheckupClick={() => {
          if (view !== 'landing') setView('landing');
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }}
        onNavigateSection={handleNavigateSection}
      />

      <main className="flex-1">
        {errorMessage && (
          <div className="max-w-4xl mx-auto px-4 mt-6">
            <div className="p-4 rounded-xl bg-rose-950/50 border border-rose-900 text-xs text-rose-300">
              {errorMessage}
            </div>
          </div>
        )}

        {view === 'landing' && (
          <>
            <HeroSection
              onStartCheckup={startCheckupFlow}
              isLoading={false}
            />
            <HowItWorksSection />
            <MilestoneBenchmarksSection />
            <MethodologySection />
            <SampleCheckupsSection
              onSelectSample={handleSelectSample}
              onStartCheckupClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            />
          </>
        )}

        {view === 'loading' && (
          <LoadingCheckup
            username={activeUsername}
            platform={activePlatform}
            timeControl={activeTimeControl}
            onComplete={handleLoadingComplete}
          />
        )}

        {view === 'results' && analysis && (
          <ResultsView
            analysis={analysis}
            onNewCheckup={handleNewCheckup}
            notice={analysisNotice}
          />
        )}
      </main>

      <Footer />
    </div>
  );
}
