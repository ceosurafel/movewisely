/**
 * MoveWisely — Core Analysis Engine Bridge (Phase 4)
 *
 * Bridges incoming user game review requests directly to PlayerDiagnosticsService,
 * ensuring game reports are built from verified analysis records, including explicit exact-rule handling for terminal positions
 * and MoveWisely Accuracy V1.1 (Experimental; Uncalibrated).
 */

import { GameRecord, CheckupAnalysis, Platform, TimeControl } from '../types/chess';
import { playerDiagnosticsService } from './playerDiagnosticsService';
import { PlayerDiagnosticsResult } from '../types/diagnostics';

/**
 * Main Checkup Analysis Entry Point.
 * Delegates directly to the engine-driven PlayerDiagnosticsService.
 */
export async function analyzeUserGames(
  username: string,
  platform: Platform,
  timeControl: TimeControl,
  userRating: number,
  games: GameRecord[],
  options?: {
    targetMilestone?: number;
    onProgress?: (step: string, percent: number) => void;
  }
): Promise<CheckupAnalysis> {
  const diagnostics = await playerDiagnosticsService.diagnosePlayer(
    username,
    platform,
    timeControl,
    userRating,
    games,
    options
  );

  return playerDiagnosticsService.toCheckupAnalysis(diagnostics);
}

export { playerDiagnosticsService };
export type { PlayerDiagnosticsResult };
