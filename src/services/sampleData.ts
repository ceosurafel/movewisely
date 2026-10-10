import { Platform, TimeControl, GameRecord } from '../types/chess';

export interface SampleProfile {
  id: string;
  name: string;
  username: string;
  platform: Platform;
  timeControl: TimeControl;
  rating: number;
  description: string;
  games: GameRecord[];
}

const OPPONENTS = [
  'CheckmateVoyager', 'KnightRider99', 'PawnStormer', 'BishopBreeze', 'TacticsGuru',
  'ColdKing77', 'TempoMaster', 'EndgameWizard', 'SilentCastle', 'DeepFork',
  'OpenBoard21', 'IronDefense', 'FianchettoKid', 'GambitLover', 'SwiftRook',
  'CenterCtrl', 'GrandPawn', 'SilverQueen', 'MidnightMate', 'KasparovFan'
];

// Helper to assemble GameRecord with 100% legal PGN
function makeGame(
  user: string,
  platform: Platform,
  timeControl: TimeControl,
  baseRating: number,
  index: number,
  res: 'win' | 'loss' | 'draw',
  eco: string,
  openingName: string,
  pgnMoves: string,
  lossPhase?: 'Opening' | 'Middlegame' | 'Endgame'
): GameRecord {
  const isUserWhite = index % 2 === 0;
  const opp = OPPONENTS[index % OPPONENTS.length];
  const oppRating = baseRating + Math.floor(Math.sin(index * 1.5) * 35);
  const whitePlayer = isUserWhite ? user : opp;
  const blackPlayer = isUserWhite ? opp : user;
  const whiteRating = isUserWhite ? baseRating : oppRating;
  const blackRating = isUserWhite ? oppRating : baseRating;

  const resultTag = res === 'win' ? (isUserWhite ? '1-0' : '0-1') : res === 'loss' ? (isUserWhite ? '0-1' : '1-0') : '1/2-1/2';

  const pgn = `[Event "Rated ${timeControl.toUpperCase()} game"]
[Site "${platform === 'chesscom' ? 'Chess.com' : 'Lichess.org'}"]
[Date "2026.10.${String(20 - index).padStart(2, '0')}"]
[White "${whitePlayer}"]
[Black "${blackPlayer}"]
[Result "${resultTag}"]
[ECO "${eco}"]
[Opening "${openingName}"]
[WhiteElo "${whiteRating}"]
[BlackElo "${blackRating}"]

${pgnMoves} ${resultTag}`;

  const movesCount = Math.max(12, Math.ceil(pgnMoves.split(/\d+\./).filter(Boolean).length));

  return {
    id: `game-${index + 1}-${platform}-${user}`,
    // These are synthetic demonstration records. Do not link them to fabricated
    // live game URLs or generate random identifiers that look like real matches.
    url: '',
    isSynthetic: true,
    white: { username: whitePlayer, rating: whiteRating, result: res === 'win' ? (isUserWhite ? 'win' : 'loss') : res === 'loss' ? (isUserWhite ? 'loss' : 'win') : 'draw' },
    black: { username: blackPlayer, rating: blackRating, result: res === 'win' ? (!isUserWhite ? 'win' : 'loss') : res === 'loss' ? (!isUserWhite ? 'loss' : 'win') : 'draw' },
    userColor: isUserWhite ? 'white' : 'black',
    userRating: baseRating,
    opponentUsername: opp,
    opponentRating: oppRating,
    result: res,
    termination: res === 'win' ? 'won by resignation' : res === 'loss' ? 'lost by checkmate' : 'drawn by agreement',
    timeControl,
    timeClass: timeControl,
    date: `2026-10-${String(Math.max(1, 28 - index)).padStart(2, '0')}`,
    pgn,
    movesCount,
    eco,
    openingName,
    lossPhase,
  };
}

// Alex (1142 Rapid): Middlegame collapses, 1-move tactical mistakes
function generateAlexGames(): GameRecord[] {
  const results: ('win' | 'loss' | 'draw')[] = [
    'win', 'loss', 'win', 'loss', 'loss', 'win', 'draw', 'win',
    'loss', 'win', 'loss', 'loss', 'win', 'win', 'loss', 'win',
    'draw', 'loss', 'win', 'loss' // 9W - 9L - 2D
  ];

  const pgns = [
    // Scandinavian with middlegame blunder
    { eco: 'B01', name: 'Scandinavian Defense', pgn: '1. e4 d5 2. exd5 Qxd5 3. Nc3 Qa5 4. d4 Nf6 5. Nf3 c6 6. Bc4 Bf5 7. Bd2 e6 8. Qe2 Bb4 9. O-O-O Nbd7 10. a3 Bxc3 11. Bxc3 Qc7 12. Ne5 Nxe5 13. dxe5 Nd5 14. Bd2 O-O-O 15. g4 Bg6 16. f4 h5 17. h3 hxg4 18. hxg4 Rxh1 19. Rxh1 Nb6 20. Bb3 c5 21. Ba5 Qc6 22. Rd1 Rxd1+ 23. Qxd1 c4 24. Bxb6 axb6 25. Ba2 c3 26. bxc3 Qxc3 27. Bb3 Qe3+ 28. Qd2 Qg1+ 29. Qd1 Qe3+' },
    // Sicilian with middlegame tactic
    { eco: 'B20', name: 'Sicilian Defense: Open', pgn: '1. e4 c5 2. Nf3 d6 3. d4 cxd4 4. Nxd4 Nf6 5. Nc3 a6 6. Be3 e5 7. Nb3 Be6 8. f3 Be7 9. Qd2 O-O 10. O-O-O Nbd7 11. g4 b5 12. g5 b4 13. Ne2 Ne8 14. f4 a5 15. f5 a4 16. Nbd4 exd4 17. Nxd4 b3 18. Kb1 bxc2+ 19. Nxc2 Bb3 20. axb3 axb3 21. Na3 Ne5 22. h4 d5 23. Qxd5 Qxd5 24. exd5 Bxa3 25. bxa3 Nd6' },
    // Italian with piece drop
    { eco: 'C50', name: 'Italian Game', pgn: '1. e4 e5 2. Nf3 Nc6 3. Bc4 Bc5 4. c3 Nf6 5. d3 d6 6. O-O a6 7. Bb3 Ba7 8. Nbd2 O-O 9. h3 h6 10. Re1 Re8 11. Nf1 Be6 12. Ng3 d5 13. Qe2 Qd7 14. Nh4 Rad8 15. Nhf5 dxe4 16. dxe4 Qd3 17. Qxd3 Rxd3 18. Bc2 Rd7 19. Be3 Bxe3 20. Nxe3 Red8' },
    // London System
    { eco: 'D02', name: 'London System', pgn: '1. d4 d5 2. Bf4 Nf6 3. e3 c5 4. c3 Nc6 5. Nd2 e6 6. Ngf3 Bd6 7. Bg3 O-O 8. Bd3 b6 9. Ne5 Bb7 10. f4 Ne7 11. Qf3 Nf5 12. Bf2 Be7 13. g4 Nd6 14. g5 Nfe4 15. Qh3 Nf5 16. Ndf3 f6 17. gxf6 Bxf6 18. Rg1 Qe7 19. Ke2 Rac8 20. Rg2 cxd4 21. exd4 b5' },
  ];

  return results.map((res, i) => {
    const p = pgns[i % pgns.length];
    const lossPhase = res === 'loss' ? (i % 3 === 0 ? 'Endgame' : 'Middlegame') : undefined;
    return makeGame('RookStorm1140', 'chesscom', 'rapid', 1142, i, res, p.eco, p.name, p.pgn, lossPhase);
  });
}

// Jordan (865 Rapid): Opening blunders, hung pieces, early queen attacks
function generateJordanGames(): GameRecord[] {
  const results: ('win' | 'loss' | 'draw')[] = [
    'loss', 'loss', 'win', 'loss', 'loss', 'win', 'loss', 'loss',
    'win', 'loss', 'loss', 'win', 'loss', 'loss', 'win', 'loss',
    'loss', 'win', 'loss', 'win' // 6W - 14L
  ];

  const pgns = [
    // Early queen move & blunder
    { eco: 'C20', name: "King's Pawn: Wayward Queen", pgn: '1. e4 e5 2. Qh5 Nc6 3. Bc4 g6 4. Qf3 Nf6 5. Ne2 Bg7 6. d3 O-O 7. Bg5 h6 8. Bh4 g5 9. Bg3 d6 10. h3 Be6 11. Nd2 Bxc4 12. Nxc4 Nd7 13. O-O-O f5 14. exf5 Nf6 15. h4 g4 16. Qe3 Nd5 17. Qe4 Nf6 18. Qe3 b5 19. Nd2 a5' },
    // Opening pin disaster
    { eco: 'C42', name: 'Petrov Defense', pgn: '1. e4 e5 2. Nf3 Nf6 3. Nxe5 d6 4. Nf3 Nxe4 5. d4 d5 6. Bd3 Bd6 7. O-O O-O 8. c4 c6 9. Nc3 Nxc3 10. bxc3 Bg4 11. h3 Bh5 12. cxd5 cxd5 13. Rb1 b6 14. Rb5 a6 15. Rxd5 Bh2+ 16. Kxh2 Qxd5 17. c4 Qd6+ 18. Kg1 Nc6 19. d5 Ne5 20. Be2 Bxf3 21. Bxf3 Nxc4' },
    // Italian with hung piece
    { eco: 'C50', name: 'Italian Game', pgn: '1. e4 e5 2. Nf3 Nc6 3. Bc4 Bc5 4. d3 Nf6 5. Nc3 d6 6. Bg5 h6 7. Bh4 g5 8. Bg3 Bg4 9. h3 Bh5 10. Qd2 Bxf3 11. gxf3 Nd4 12. O-O-O Nxf3 13. Qe2 Nd4 14. Qd2 Qd7 15. h4 O-O-O 16. hxg5 hxg5 17. Qxg5 Ng4 18. Nd5 c6 19. Ne7+ Kb8 20. Bxf7 Ne2+ 21. Kb1 Nxg3 22. fxg3' },
    // Scandinavian early queen
    { eco: 'B01', name: 'Scandinavian Defense', pgn: '1. e4 d5 2. exd5 Qxd5 3. Nc3 Qa5 4. d4 Nf6 5. Nf3 Bg4 6. h3 Bh5 7. g4 Bg6 8. Ne5 c6 9. h4 Nbd7 10. Nc4 Qc7 11. h5 Be4 12. Nxe4 Nxe4 13. Qf3 Nd6 14. Bf4 e6 15. O-O-O Nb6 16. Ne5 Nd5 17. Bg3 Qa5 18. Kb1 Be7 19. c4 Nf6 20. Bd3 O-O 21. g5' },
  ];

  return results.map((res, i) => {
    const p = pgns[i % pgns.length];
    const lossPhase = res === 'loss' ? (i % 2 === 0 ? 'Opening' : 'Middlegame') : undefined;
    return makeGame('PawnPusher860', 'chesscom', 'rapid', 865, i, res, p.eco, p.name, p.pgn, lossPhase);
  });
}

// Maya (1485 Blitz): Deep games, endgame conversions, rook endgame slips
function generateMayaGames(): GameRecord[] {
  const results: ('win' | 'loss' | 'draw')[] = [
    'win', 'win', 'loss', 'draw', 'win', 'loss', 'win', 'loss',
    'draw', 'win', 'loss', 'win', 'draw', 'loss', 'win', 'loss',
    'win', 'draw', 'loss', 'win' // 10W - 6L - 4D
  ];

  const pgns = [
    // Long Caro-Kann endgame
    { eco: 'B10', name: 'Caro-Kann Defense', pgn: '1. e4 c6 2. d4 d5 3. exd5 cxd5 4. Bd3 Nc6 5. c3 Nf6 6. Bf4 Bg4 7. Qb3 Qc8 8. Nd2 e6 9. Ngf3 Be7 10. O-O O-O 11. Rae1 Bh5 12. Ne5 Nxe5 13. Bxe5 Bg6 14. Bxg6 hxg6 15. Re3 Qc6 16. Rh3 b5 17. a3 a5 18. Qd1 b4 19. axb4 axb4 20. Qf3 bxc3 21. bxc3 Ra2 22. Qf4 Nh5 23. Qe3 f6 24. Bg3 Nxg3 25. Rxg3 g5 26. Re1 Kf7 27. Nf3 Rb8 28. h4 gxh4 29. Nxh4 Rbb2 30. Qd3 f5 31. Nxf5 exf5 32. Qxf5+ Bf6 33. Qg6+ Kf8 34. Rge3 Rb8 35. Re6 Qd7 36. g4 Qf7 37. Qh7 g6 38. Qh6+ Bg7 39. Qe3 Kg8 40. Re7 Qf6 41. Re6 Qf7 42. Kg2 Rf8 43. Re2 Rxe2 44. Qxe2 Qf4 45. f3 Kh7 46. Re7 Rf7 47. Re8 Ra7 48. Re7 Rxe7 49. Qxe7 Qd2+ 50. Kg3 Qxc3 51. Qh4+ Kg8 52. Qd8+ Kh7 53. Qxd5 Qxd4 54. Qxd4 Bxd4 55. f4' },
    // French Defense endgame
    { eco: 'C00', name: 'French Defense', pgn: '1. e4 e6 2. d4 d5 3. exd5 exd5 4. Nf3 Nf6 5. Bd3 Bd6 6. O-O O-O 7. Bg5 Bg4 8. Nbd2 Nbd7 9. c3 c6 10. Qc2 Qc7 11. Rae1 Rfe8 12. Bh4 Bh5 13. Bg3 Bxg3 14. hxg3 Bg6 15. Bxg6 hxg6 16. Rxe8+ Rxe8 17. Re1 Rxe1+ 18. Nxe1 Qd6 19. Nd3 Qe6 20. Qd1 Ne4 21. Nf1 Ndf6 22. Qe2 Qf5 23. f3 Nd6 24. g4 Qd7 25. Nc5 Qc7 26. Qe5 b6 27. Na6 Qd8 28. b3 Nb5 29. Qe3 Qc8 30. Nb4 c5 31. dxc5 bxc5 32. Nc2 Qd8 33. Qxc5 a6 34. a4 Nc7 35. Nd4 Qd7 36. Ne3 Ne6 37. Nxe6 Qxe6 38. Kf2 Qe5 39. Qd4 Qd6 40. b4 Qc6 41. a5 Qa4 42. g5 Qa2+ 43. Kg3 Nh5+ 44. Kh2 Qf2 45. Nxd5 Qg3+ 46. Kh1 Qe1+ 47. Kh2 Qg3+ 48. Kh1' },
    // Queen's Gambit Declined endgame
    { eco: 'D30', name: "Queen's Gambit Declined", pgn: '1. d4 d5 2. c4 e6 3. Nc3 Nf6 4. Bg5 Be7 5. e3 O-O 6. Nf3 Nbd7 7. Rc1 c6 8. Bd3 dxc4 9. Bxc4 Nd5 10. Bxe7 Qxe7 11. O-O Nxc3 12. Rxc3 e5 13. Bb3 exd4 14. exd4 Nf6 15. Re1 Qd6 16. Ne5 Bf5 17. Qf3 Bg6 18. Qf4 Rad8 19. Nxg6 hxg6 20. Qxd6 Rxd6 21. Re7 Rd7 22. Rce3 Rfd8 23. Bxf7+ Kf8 24. Rxd7 Rxd7 25. Bxg6 Rxd4 26. Kf1 Rd2 27. Re2 Rd1+ 28. Re1 Rd2 29. Rb1 Ke7 30. Ke1 Rd4 31. Rd1 Ra4 32. a3 Nd5 33. g3 Kf6 34. Bc2 Ra5 35. Rd4 Rc5 36. Kd2 a5 37. Bb3 Ke5 38. Rg4 Kf6 39. Bxd5 Rxd5+ 40. Kc2 Re5 41. Rf4+ Ke7 42. h4 b5 43. Kd3 Rd5+ 44. Rd4 Rf5 45. Ke3' },
  ];

  return results.map((res, i) => {
    const p = pgns[i % pgns.length];
    const lossPhase = res === 'loss' ? (i % 4 === 0 ? 'Middlegame' : 'Endgame') : undefined;
    return makeGame('TacticalMaya', 'lichess', 'blitz', 1485, i, res, p.eco, p.name, p.pgn, lossPhase);
  });
}

// Leo (1724 Bullet): Fast attacks, tactical sacrifices, opening sharpness
function generateLeoGames(): GameRecord[] {
  const results: ('win' | 'loss' | 'draw')[] = [
    'win', 'loss', 'win', 'win', 'loss', 'win', 'loss', 'win',
    'win', 'loss', 'win', 'loss', 'win', 'win', 'loss', 'loss',
    'win', 'win', 'loss', 'win' // 13W - 7L
  ];

  const pgns = [
    // Najdorf sharp battle
    { eco: 'B90', name: 'Sicilian: Najdorf', pgn: '1. e4 c5 2. Nf3 d6 3. d4 cxd4 4. Nxd4 Nf6 5. Nc3 a6 6. Be3 e5 7. Nb3 Be6 8. f3 Be7 9. Qd2 O-O 10. O-O-O Nbd7 11. g4 b5 12. g5 b4 13. Ne2 Ne8 14. f4 a5 15. f5 a4 16. Nbd4 exd4 17. Nxd4 b3 18. Kb1 bxc2+ 19. Nxc2 Bb3 20. axb3 axb3 21. Na3 Ne5 22. h4 d5 23. Qxd5 Qb8 24. Bd4 Nf3 25. Bc3 Bxa3 26. bxa3 Nc7 27. Qd6 Rd8 28. Qxd8+ Qxd8 29. Rxd8+ Rxd8 30. Be2 Nd2+ 31. Bxd2 Rxd2 32. Rd1 Rxd1+ 33. Bxd1' },
    // King's Indian Mar del Plata
    { eco: 'E97', name: "King's Indian Defense", pgn: '1. d4 Nf6 2. c4 g6 3. Nc3 Bg7 4. e4 d6 5. Nf3 O-O 6. Be2 e5 7. O-O Nc6 8. d5 Ne7 9. b4 Nh5 10. Re1 f5 11. Ng5 Nf6 12. Bf3 c6 13. Bb2 h6 14. Ne6 Bxe6 15. dxe6 fxe4 16. Nxe4 Nxe4 17. Bxe4 d5 18. cxd5 cxd5 19. Bc2 Qd6 20. Bb3 Qxe6 21. Qe2 Rf5 22. Rad1 Raf8 23. f3 Kh7 24. Kh1 Rd8 25. Qb5 Qc6 26. Qd3 Qd6 27. a3 a6 28. Re2 d4 29. Qe4 Nd5 30. Rde1 Ne3' },
    // Fried Liver Attack
    { eco: 'C57', name: 'Two Knights: Fried Liver', pgn: '1. e4 e5 2. Nf3 Nc6 3. Bc4 Nf6 4. Ng5 d5 5. exd5 Nxd5 6. Nxf7 Kxf7 7. Qf3+ Ke6 8. Nc3 Ncb4 9. O-O c6 10. d4 Qf6 11. Qe4 Qf5 12. Qe2 Kf7 13. a3 Nxc2 14. Bd3 Nxd4 15. Qd1 Qg4 16. f3 Qh4 17. Nxd5 cxd5 18. Be3 Bd6 19. g3 Qh3 20. f4 Nf5 21. fxe5 Bxe5 22. Bxf5 Bxf5 23. Qxd5+ Kf6 24. Rae1 Rae8 25. Bd4 Bxd4+ 26. Qxd4+ Kg6 27. Qd6+ Re6 28. Rxe6+ Bxe6' },
  ];

  return results.map((res, i) => {
    const p = pgns[i % pgns.length];
    const lossPhase = res === 'loss' ? (i % 3 === 0 ? 'Opening' : 'Middlegame') : undefined;
    return makeGame('SpeedDemon1720', 'lichess', 'bullet', 1724, i, res, p.eco, p.name, p.pgn, lossPhase);
  });
}

export const SAMPLE_PROFILES: SampleProfile[] = [
  {
    id: 'rapid-1140',
    name: 'Alex (1140 Rapid)',
    username: 'RookStorm1140',
    platform: 'chesscom',
    timeControl: 'rapid',
    rating: 1142,
    description: 'Stuck around 1100. Struggles with middlegame tactical collapses and piece coordination.',
    games: generateAlexGames(),
  },
  {
    id: 'blitz-1480',
    name: 'Maya (1480 Blitz)',
    username: 'TacticalMaya',
    platform: 'lichess',
    timeControl: 'blitz',
    rating: 1485,
    description: 'Chasing the 1500–1600 milestone. Leaks rating in converted endgames and time scrambles.',
    games: generateMayaGames(),
  },
  {
    id: 'rapid-860',
    name: 'Jordan (860 Rapid)',
    username: 'PawnPusher860',
    platform: 'chesscom',
    timeControl: 'rapid',
    rating: 865,
    description: 'Aiming for 900–1000. Frequent early opening blunders, hung queens, and undefended pieces.',
    games: generateJordanGames(),
  },
  {
    id: 'bullet-1720',
    name: 'Leo (1720 Bullet)',
    username: 'SpeedDemon1720',
    platform: 'lichess',
    timeControl: 'bullet',
    rating: 1724,
    description: 'Aiming for 1800. Fast instincts but premature speculative sacrifices and repertoire holes.',
    games: generateLeoGames(),
  },
];
