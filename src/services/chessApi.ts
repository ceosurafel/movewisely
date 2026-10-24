import { Platform, TimeControl, GameRecord } from '../types/chess';
import { SAMPLE_PROFILES } from './sampleData';

export interface FetchResult {
  username: string;
  platform: Platform;
  timeControl: TimeControl;
  rating: number;
  games: GameRecord[];
  isSampleFallback?: boolean;
  notice?: string;
}

function validRating(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : null;
}

/**
 * Return the newest Chess.com games first, regardless of archive ordering.
 * The public archive API groups games by month and returns each month oldest-first;
 * reversing each archive independently can accidentally select older games when
 * a month contains more games than the requested sample.
 */
export function selectMostRecentChessComGames<T extends { end_time?: number }>(games: T[], limit = 20): T[] {
  const safeLimit = Number.isFinite(limit) ? Math.max(0, Math.floor(limit)) : 20;
  return [...games]
    .sort((a, b) => {
      const aTime = Number.isFinite(a.end_time) ? a.end_time as number : Number.NEGATIVE_INFINITY;
      const bTime = Number.isFinite(b.end_time) ? b.end_time as number : Number.NEGATIVE_INFINITY;
      return bTime - aTime;
    })
    .slice(0, safeLimit);
}

function missingUserRating(username: string, platform: string): never {
  throw new Error(`${platform} did not provide a verified rating for "${username}". No rating-based report was generated.`);
}

/**
 * Prefer the platform's current rating for the selected time control.
 * A game-record rating is only a fallback because it can reflect an older rating.
 */
export function resolveCurrentRating(profileRating: unknown, games: GameRecord[]): number | null {
  const currentProfileRating = validRating(profileRating);
  if (currentProfileRating !== null) return currentProfileRating;

  const mostRecentGameRating = games.find(game => validRating(game.userRating) !== null)?.userRating;
  return validRating(mostRecentGameRating);
}

export async function fetchUserGames(
  username: string,
  platform: Platform,
  timeControl: TimeControl
): Promise<FetchResult> {
  const cleanUsername = username.trim().toLowerCase();

  // The demo buttons intentionally route through this service. Make this data
  // unmistakably synthetic instead of allowing it to masquerade as live API data.
  const matchingSample = SAMPLE_PROFILES.find(
    s => s.username.toLowerCase() === cleanUsername && s.platform === platform && s.timeControl === timeControl
  );
  if (matchingSample) {
    return {
      username: matchingSample.username,
      platform: matchingSample.platform,
      timeControl,
      rating: matchingSample.rating,
      games: matchingSample.games,
      isSampleFallback: true,
      notice: 'DEMO DATA: this report uses synthetic sample games, not a real player profile or live game history.',
    };
  }

  try {
    if (platform === 'chesscom') {
      return await fetchChessComGames(cleanUsername, timeControl);
    } else {
      return await fetchLichessGames(cleanUsername, timeControl);
    }
  } catch (err: unknown) {
    console.warn('Direct chess API fetch error:', err);
    const errorMessage = err instanceof Error ? err.message : 'Could not reach server';
    // Phase 4 Requirement: Never replace a real user's failed lookup with sample games.
    // Real lookups must surface actual network/account status or insufficient data.
    throw new Error(errorMessage);
  }
}

async function fetchChessComGames(username: string, timeControl: TimeControl): Promise<FetchResult> {
  // 1. Fetch user stats for rating
  let profileRating: number | undefined;
  try {
    const statsRes = await fetch(`https://api.chess.com/pub/player/${username}/stats`, {
      headers: { 'User-Agent': 'MoveWisely-ChessCheckup/1.0 (free improvement app)' },
    });
    if (statsRes.ok) {
      const stats = await statsRes.json();
      const ratingKey = `chess_${timeControl}`;
      const rating = stats[ratingKey]?.last?.rating;
      if (Number.isFinite(rating) && rating > 0) profileRating = rating;
    }
  } catch {
    // continue to games
  }

  // 2. Fetch monthly archives
  const archivesRes = await fetch(`https://api.chess.com/pub/player/${username}/games/archives`, {
    headers: { 'User-Agent': 'MoveWisely-ChessCheckup/1.0 (free improvement app)' },
  });

  if (!archivesRes.ok) {
    throw new Error(`Chess.com user "${username}" not found or profile is private`);
  }

  const { archives } = await archivesRes.json();
  if (!archives || !Array.isArray(archives) || archives.length === 0) {
    throw new Error(`No games found for ${username}`);
  }

  // Look through the most recent 3 monthly archives
  const recentArchives = archives.slice(-3).reverse();
  const rawGames: any[] = [];

  for (const archiveUrl of recentArchives) {
    if (rawGames.length >= 25) break;
    try {
      const gRes = await fetch(archiveUrl, {
        headers: { 'User-Agent': 'MoveWisely-ChessCheckup/1.0 (free improvement app)' },
      });
      if (gRes.ok) {
        const { games } = await gRes.json();
        if (Array.isArray(games)) {
          // Filter by time class
          const matching = games.filter(g => g.time_class === timeControl && g.rules === 'chess');
          rawGames.push(...matching);
        }
      }
    } catch {
      // continue
    }
  }

  if (rawGames.length === 0) {
    throw new Error(`No recent ${timeControl} games found on Chess.com for ${username}`);
  }

  // Sort across all fetched archives, not just within each month, so the report
  // consistently analyzes the most recent matching games.
  const selectedGames = selectMostRecentChessComGames(rawGames, 20);
  const formattedGames: GameRecord[] = selectedGames.map((g, idx) => {
    const isUserWhite = g.white.username.toLowerCase() === username.toLowerCase();
    const userObj = isUserWhite ? g.white : g.black;
    const oppObj = isUserWhite ? g.black : g.white;

    let result: 'win' | 'loss' | 'draw' = 'draw';
    if (userObj.result === 'win') result = 'win';
    else if (['checkmated', 'resigned', 'timeout', 'abandoned'].includes(userObj.result)) result = 'loss';
    else if (oppObj.result === 'win') result = 'loss';

    const movesMatch = (g.pgn || '').match(/\d+\.\s/g);
    const movesCount = movesMatch ? movesMatch.length : 30;

    let lossPhase: 'Opening' | 'Middlegame' | 'Endgame' | undefined = undefined;
    if (result === 'loss') {
      if (movesCount <= 16) lossPhase = 'Opening';
      else if (movesCount <= 34) lossPhase = 'Middlegame';
      else lossPhase = 'Endgame';
    }

    const ecoMatch = (g.pgn || '').match(/\[ECO "(.*?)"\]/);
    const openingMatch = (g.pgn || '').match(/\[ECOUrl ".*?openings\/(.*?)"\]/);
    const openingName = openingMatch ? openingMatch[1].replace(/-/g, ' ') : undefined;

    return {
      id: `cc-${idx}-${g.url ? g.url.split('/').pop() : idx}`,
      url: g.url || 'https://chess.com',
      white: {
        username: g.white.username,
        rating: validRating(g.white.rating),
        result: g.white.result,
      },
      black: {
        username: g.black.username,
        rating: validRating(g.black.rating),
        result: g.black.result,
      },
      userColor: isUserWhite ? 'white' : 'black',
      userRating: validRating(userObj.rating) ?? profileRating ?? missingUserRating(username, 'Chess.com'),
      opponentUsername: oppObj.username,
      opponentRating: validRating(oppObj.rating),
      result,
      termination: userObj.result,
      timeControl,
      timeClass: g.time_class,
      date: Number.isFinite(g.end_time) && g.end_time > 0 ? new Date(g.end_time * 1000).toISOString().split('T')[0] : null,
      pgn: g.pgn || '',
      movesCount,
      eco: ecoMatch ? ecoMatch[1] : undefined,
      openingName,
      lossPhase,
    };
  });

  const userRating = resolveCurrentRating(profileRating, formattedGames);
  if (userRating === null) {
    throw new Error(`Chess.com did not provide a verified ${timeControl} rating for "${username}". No rating-based report was generated.`);
  }

  return {
    username,
    platform: 'chesscom',
    timeControl,
    rating: userRating,
    games: formattedGames,
  };
}

async function fetchLichessGames(username: string, timeControl: TimeControl): Promise<FetchResult> {
  // 1. Fetch user profile for rating
  let profileRating: number | undefined;
  try {
    const userRes = await fetch(`https://lichess.org/api/user/${username}`);
    if (userRes.ok) {
      const data = await userRes.json();
      const rating = data.perfs?.[timeControl]?.rating;
      if (Number.isFinite(rating) && rating > 0) profileRating = rating;
    }
  } catch {
    // continue
  }

  // 2. Fetch games stream
  const response = await fetch(
    `https://lichess.org/api/games/user/${username}?max=20&perfType=${timeControl}&pgnInJson=true&clocks=false&evals=false`,
    {
      headers: { Accept: 'application/x-ndjson' },
    }
  );

  if (!response.ok) {
    throw new Error(`Lichess user "${username}" not found or network restricted`);
  }

  const text = await response.text();
  const lines = text.trim().split('\n').filter(Boolean);

  if (lines.length === 0) {
    throw new Error(`No ${timeControl} games found on Lichess for ${username}`);
  }

  const rawGames = lines.map(line => JSON.parse(line));
  const formattedGames: GameRecord[] = rawGames.map((g, idx) => {
    const isUserWhite = g.players.white.user?.name.toLowerCase() === username.toLowerCase();
    const userObj = isUserWhite ? g.players.white : g.players.black;
    const oppObj = isUserWhite ? g.players.black : g.players.white;

    let result: 'win' | 'loss' | 'draw' = 'draw';
    if (g.winner === (isUserWhite ? 'white' : 'black')) result = 'win';
    else if (g.winner) result = 'loss';

    const movesCount = g.moves ? Math.ceil(g.moves.split(' ').length / 2) : 28;

    let lossPhase: 'Opening' | 'Middlegame' | 'Endgame' | undefined = undefined;
    if (result === 'loss') {
      if (movesCount <= 16) lossPhase = 'Opening';
      else if (movesCount <= 34) lossPhase = 'Middlegame';
      else lossPhase = 'Endgame';
    }

    return {
      id: `li-${g.id || idx}`,
      url: `https://lichess.org/${g.id}`,
      white: {
        username: g.players.white.user?.name || 'Anonymous',
        rating: validRating(g.players.white.rating),
        result: g.winner === 'white' ? 'win' : g.winner === 'black' ? 'loss' : 'draw',
      },
      black: {
        username: g.players.black.user?.name || 'Anonymous',
        rating: validRating(g.players.black.rating),
        result: g.winner === 'black' ? 'win' : g.winner === 'white' ? 'loss' : 'draw',
      },
      userColor: isUserWhite ? 'white' : 'black',
      userRating: validRating(userObj.rating) ?? profileRating ?? missingUserRating(username, 'Lichess'),
      opponentUsername: oppObj.user?.name || 'Opponent',
      opponentRating: validRating(oppObj.rating),
      result,
      termination: g.status || 'normal',
      timeControl,
      timeClass: timeControl,
      date: g.createdAt && Number.isFinite(new Date(g.createdAt).getTime()) ? new Date(g.createdAt).toISOString().split('T')[0] : null,
      pgn: g.pgn || g.moves || '',
      movesCount,
      openingName: g.opening?.name || undefined,
      eco: g.opening?.eco || undefined,
      lossPhase,
    };
  });

  const userRating = resolveCurrentRating(profileRating, formattedGames);
  if (userRating === null) {
    throw new Error(`Lichess did not provide a verified ${timeControl} rating for "${username}". No rating-based report was generated.`);
  }

  return {
    username,
    platform: 'lichess',
    timeControl,
    rating: userRating,
    games: formattedGames,
  };
}
