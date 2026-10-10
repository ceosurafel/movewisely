import React from 'react';
import { GameRecord } from '../types/chess';

interface GameHistoryListProps {
  games: GameRecord[];
  username: string;
}

export const GameHistoryList: React.FC<GameHistoryListProps> = ({ games, username }) => {
  return (
    <div className="w-full bg-[#081216] border border-teal-950 rounded-2xl p-6 sm:p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-bold text-white">Analyzed Game Ledger</h3>
          <p className="text-xs text-slate-400 mt-0.5">
            The {games.length} games parsed to construct your diagnostic report
          </p>
        </div>
        <div className="text-xs text-teal-400 font-mono">
          {games.filter(g => g.result === 'win').length}W · {games.filter(g => g.result === 'loss').length}L · {games.filter(g => g.result === 'draw').length}D
        </div>
      </div>

      <div className="divide-y divide-teal-950/60 overflow-hidden">
        {games.map((g, idx) => {
          const isWin = g.result === 'win';
          const isLoss = g.result === 'loss';

          return (
            <div
              key={g.id || idx}
              className="py-3 px-2 flex flex-col sm:flex-row sm:items-center justify-between gap-2 hover:bg-teal-950/20 transition-colors rounded-lg"
            >
              <div className="flex items-center gap-3">
                <span
                  className={`text-xs font-mono font-bold w-6 text-center ${
                    isWin ? 'text-emerald-400' : isLoss ? 'text-rose-400' : 'text-slate-400'
                  }`}
                >
                  {isWin ? 'W' : isLoss ? 'L' : 'D'}
                </span>

                <div>
                  <div className="text-xs font-medium text-white flex items-center gap-2">
                    <span>vs {g.opponentUsername}</span>
                    <span className="text-[11px] text-slate-400 font-mono">
                      ({g.opponentRating ?? 'unrated'})
                    </span>
                    <span className="text-[10px] text-slate-500 font-mono">
                      {g.userColor === 'white' ? 'White ♙' : 'Black ♟'}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-400 flex items-center gap-2 mt-0.5">
                    <span>{g.openingName || g.eco || 'Standard Opening'}</span>
                    <span>·</span>
                    <span>{g.movesCount} moves</span>
                    {g.lossPhase && (
                      <>
                        <span>·</span>
                        <span className="text-rose-400/80">Lost in {g.lossPhase}</span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between sm:justify-end gap-3 text-xs text-slate-400">
                <span className="text-[11px] font-mono">{g.date || 'Date unavailable'}</span>
                {g.isSynthetic || !g.url ? (
                  <span className="text-xs text-slate-500">Demo PGN</span>
                ) : (
                  <a
                    href={g.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-teal-400 hover:text-teal-200 transition-colors underline cursor-pointer"
                  >
                    View Game ↗
                  </a>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
