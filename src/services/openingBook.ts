/**
 * MoveWisely — Opening Book Database (ECO & Common Standard Lines)
 *
 * Provides genuine book move validation for Phase 3 move classifications:
 * - Maps standard opening positions (by standard FEN piece placement) to opening name and ECO
 * - Validates whether a move played in early game belongs to recognized opening theory
 * - Supports major openings: Ruy Lopez, Italian, Sicilian, French, Caro-Kann, Queen's Gambit,
 *   King's Indian, English, Scandinavian, Pirc, Nimzo-Indian, London System, etc.
 */

export interface BookEntry {
  eco: string;
  name: string;
  fenPrefix: string; // FEN piece placement without move counters
  moves: string[]; // Legal standard moves in UCI or SAN
}

/**
 * Normalizes a FEN to board placement + side-to-move + castling rights
 * for resilient opening book matching regardless of en passant or halfmove counters.
 */
export function normalizeFenForBook(fen: string): string {
  const parts = fen.trim().split(/\s+/);
  if (parts.length < 3) return fen;
  return `${parts[0]} ${parts[1]} ${parts[2]}`;
}

export const OPENING_BOOK: Record<string, { eco: string; name: string; bookMoves: string[] }> = {
  // Initial position: White move 1
  'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq': {
    eco: 'A00',
    name: 'Starting Position',
    bookMoves: ['e2e4', 'd2d4', 'c2c4', 'g1f3', 'b2b3', 'g2g3', 'f2f4', 'e4', 'd4', 'c4', 'Nf3', 'b3', 'g3', 'f4'],
  },

  // 1. e4
  'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq': {
    eco: 'B00',
    name: 'King\'s Pawn Game',
    bookMoves: ['e7e5', 'c7c5', 'e7e6', 'c7c6', 'd7d5', 'g8f6', 'd7d6', 'g7g6', 'e5', 'c5', 'e6', 'c6', 'd5', 'Nf6', 'd6', 'g6'],
  },

  // 1. d4
  'rnbqkbnr/pppppppp/8/8/3P4/8/PPP1PPPP/RNBQKBNR b KQkq': {
    eco: 'A40',
    name: 'Queen\'s Pawn Game',
    bookMoves: ['d7d5', 'g8f6', 'e7e6', 'c7c5', 'f7f5', 'g7g6', 'd5', 'Nf6', 'e6', 'c5', 'f5', 'g6'],
  },

  // 1. c4 (English)
  'rnbqkbnr/pppppppp/8/8/2P5/8/PP1PPPPP/RNBQKBNR b KQkq': {
    eco: 'A10',
    name: 'English Opening',
    bookMoves: ['e7e5', 'c7c5', 'g8f6', 'e7e6', 'c7c6', 'e5', 'c5', 'Nf6', 'e6', 'c6'],
  },

  // 1. Nf3 (Reti)
  'rnbqkbnr/pppppppp/8/8/8/5N2/PPPPPPPP/RNBQKB1R b KQkq': {
    eco: 'A04',
    name: 'Réti Opening',
    bookMoves: ['d7d5', 'g8f6', 'c7c5', 'd5', 'Nf6', 'c5'],
  },

  // 1. e4 e5
  'rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq': {
    eco: 'C20',
    name: 'Open Game',
    bookMoves: ['g1f3', 'f2f4', 'b1c3', 'd2d4', 'f1c4', 'Nf3', 'f4', 'Nc3', 'd4', 'Bc4'],
  },

  // 1. e4 e5 2. Nf3
  'rnbqkbnr/pppp1ppp/8/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R b KQkq': {
    eco: 'C40',
    name: 'King\'s Knight Opening',
    bookMoves: ['b8c6', 'g8f6', 'd7d6', 'Nc6', 'Nf6', 'd6'],
  },

  // 1. e4 e5 2. Nf3 Nc6
  'r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq': {
    eco: 'C44',
    name: 'Open Game: King\'s Knight (Ruy Lopez / Italian setup)',
    bookMoves: ['f1c4', 'f1b5', 'd2d4', 'b1c3', 'c2c3', 'Bc4', 'Bb5', 'd4', 'Nc3', 'c3'],
  },

  // 1. e4 e5 2. Nf3 Nc6 3. Bc4 (Italian Game)
  'r1bqkbnr/pppp1ppp/2n5/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R b KQkq': {
    eco: 'C50',
    name: 'Italian Game',
    bookMoves: ['f8c5', 'g8f6', 'd7d6', 'Bc5', 'Nf6', 'd6'],
  },

  // 1. e4 e5 2. Nf3 Nc6 3. Bc4 Bc5
  'r1bqk1nr/pppp1ppp/2n5/2b1p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq': {
    eco: 'C50',
    name: 'Italian Game: Giuoco Piano',
    bookMoves: ['c2c3', 'd2d3', 'e1g1', 'b1c3', 'd2d4', 'b2b4', 'c3', 'd3', 'O-O', 'Nc3', 'd4', 'b4'],
  },

  // 1. e4 e5 2. Nf3 Nc6 3. Bc4 Bc5 4. c3
  'r1bqk1nr/pppp1ppp/2n5/2b1p3/2B1P3/2P2N2/PP1P1PPP/RNBQK2R b KQkq': {
    eco: 'C53',
    name: 'Italian Game: Classical Variation',
    bookMoves: ['g8f6', 'd7d6', 'Nf6', 'd6'],
  },

  // 1. e4 e5 2. Nf3 Nc6 3. Bc4 Bc5 4. c3 Nf6
  'r1bqk2r/pppp1ppp/2n2n2/2b1p3/2B1P3/2P2N2/PP1P1PPP/RNBQK2R w KQkq': {
    eco: 'C54',
    name: 'Italian Game: Main Line',
    bookMoves: ['d2d4', 'd2d3', 'e1g1', 'd4', 'd3', 'O-O'],
  },

  // 1. e4 e5 2. Nf3 Nc6 3. Bb5 (Ruy Lopez)
  'r1bqkbnr/pppp1ppp/2n5/1B2p3/4P3/5N2/PPPP1PPP/RNBQK2R b KQkq': {
    eco: 'C60',
    name: 'Ruy Lopez',
    bookMoves: ['a7a6', 'g8f6', 'd7d6', 'f8c5', 'a6', 'Nf6', 'd6', 'Bc5'],
  },

  // 1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 (Ruy Lopez: Morphy Defense)
  'r1bqkbnr/1ppp1ppp/p1n5/1B2p3/4P3/5N2/PPPP1PPP/RNBQK2R w KQkq': {
    eco: 'C68',
    name: 'Ruy Lopez: Morphy Defense',
    bookMoves: ['b5a4', 'b5c6', 'Ba4', 'Bxc6'],
  },

  // 1. e4 c5 (Sicilian Defense)
  'rnbqkbnr/pp1ppppp/8/2p5/4P3/8/PPPP1PPP/RNBQKBNR w KQkq': {
    eco: 'B20',
    name: 'Sicilian Defense',
    bookMoves: ['g1f3', 'b1c3', 'c2c3', 'd2d4', 'g2g3', 'f2f4', 'Nf3', 'Nc3', 'c3', 'd4', 'g3', 'f4'],
  },

  // 1. e4 c5 2. Nf3
  'rnbqkbnr/pp1ppppp/8/2p5/4P3/5N2/PPPP1PPP/RNBQKB1R b KQkq': {
    eco: 'B27',
    name: 'Sicilian Defense: Open Lines',
    bookMoves: ['d7d6', 'b8c6', 'e7e6', 'g7g6', 'd6', 'Nc6', 'e6', 'g6'],
  },

  // 1. e4 c5 2. Nf3 d6 3. d4
  'rnbqkbnr/pp2pppp/3p4/2p5/3PP3/5N2/PPP2PPP/RNBQKB1R b KQkq': {
    eco: 'B50',
    name: 'Sicilian Defense: Open',
    bookMoves: ['c5d4', 'cxd4'],
  },

  // 1. e4 e6 (French Defense)
  'rnbqkbnr/pppp1ppp/4p3/8/4P3/8/PPPP1PPP/RNBQKBNR w KQkq': {
    eco: 'C00',
    name: 'French Defense',
    bookMoves: ['d2d4', 'd2d3', 'b1c3', 'd4', 'd3', 'Nc3'],
  },

  // 1. e4 e6 2. d4 d5
  'rnbqkbnr/ppp2ppp/4p3/3p4/3PP3/8/PPP2PPP/RNBQKBNR w KQkq': {
    eco: 'C01',
    name: 'French Defense: Main Line',
    bookMoves: ['b1c3', 'b1d2', 'e4e5', 'e4d5', 'Nc3', 'Nd2', 'e5', 'exd5'],
  },

  // 1. e4 c6 (Caro-Kann Defense)
  'rnbqkbnr/pp1ppppp/2p5/8/4P3/8/PPPP1PPP/RNBQKBNR w KQkq': {
    eco: 'B10',
    name: 'Caro-Kann Defense',
    bookMoves: ['d2d4', 'b1c3', 'c2c4', 'd4', 'Nc3', 'c4'],
  },

  // 1. e4 c6 2. d4 d5
  'rnbqkbnr/pp2pppp/2p5/3p4/3PP3/8/PPP2PPP/RNBQKBNR w KQkq': {
    eco: 'B12',
    name: 'Caro-Kann Defense: Main Line',
    bookMoves: ['b1c3', 'e4e5', 'e4d5', 'f2f3', 'Nc3', 'e5', 'exd5', 'f3'],
  },

  // 1. d4 d5
  'rnbqkbnr/ppp1pppp/8/3p4/3P4/8/PPP1PPPP/RNBQKBNR w KQkq': {
    eco: 'D00',
    name: 'Closed Game',
    bookMoves: ['c2c4', 'g1f3', 'c1f4', 'e2e3', 'c4', 'Nf3', 'Bf4', 'e3'],
  },

  // 1. d4 d5 2. c4 (Queen's Gambit)
  'rnbqkbnr/ppp1pppp/8/3p4/2PP4/8/PP2PPPP/RNBQKBNR b KQkq': {
    eco: 'D06',
    name: 'Queen\'s Gambit',
    bookMoves: ['e7e6', 'c7c6', 'd5c4', 'b8c6', 'g8f6', 'e6', 'c6', 'dxc4', 'Nc6', 'Nf6'],
  },

  // 1. d4 d5 2. c4 e6 (Queen's Gambit Declined)
  'rnbqkbnr/ppp2ppp/4p3/3p4/2PP4/8/PP2PPPP/RNBQKBNR w KQkq': {
    eco: 'D30',
    name: 'Queen\'s Gambit Declined',
    bookMoves: ['b1c3', 'g1f3', 'c4d5', 'Nc3', 'Nf3', 'cxd5'],
  },

  // 1. d4 Nf6
  'rnbqkb1r/pppppppp/5n2/8/3P4/8/PPP1PPPP/RNBQKBNR w KQkq': {
    eco: 'A45',
    name: 'Indian Defense',
    bookMoves: ['c2c4', 'g1f3', 'c1f4', 'c1g5', 'c4', 'Nf3', 'Bf4', 'Bg5'],
  },

  // 1. d4 Nf6 2. c4 g6 (King's Indian / Grünfeld)
  'rnbqkb1r/pppppp1p/5np1/8/2PP4/8/PP2PPPP/RNBQKBNR w KQkq': {
    eco: 'E60',
    name: 'King\'s Indian Defense setup',
    bookMoves: ['b1c3', 'g1f3', 'g2g3', 'Nc3', 'Nf3', 'g3'],
  },

  // 1. d4 Nf6 2. c4 e6
  'rnbqkb1r/pppp1ppp/4pn2/8/2PP4/8/PP2PPPP/RNBQKBNR w KQkq': {
    eco: 'E00',
    name: 'Queen\'s Indian / Nimzo setup',
    bookMoves: ['g1f3', 'b1c3', 'g2g3', 'Nf3', 'Nc3', 'g3'],
  },
};

/**
 * Checks if a played move is recognized opening theory for a position.
 */
export function isMoveInOpeningBook(
  fenBefore: string,
  moveUci: string,
  moveSan: string
): { isBook: boolean; openingName?: string; eco?: string } {
  const normKey = normalizeFenForBook(fenBefore);
  const entry = OPENING_BOOK[normKey];

  if (!entry) {
    return { isBook: false };
  }

  const matchesUci = entry.bookMoves.some(m => m.toLowerCase() === moveUci.toLowerCase());
  const matchesSan = entry.bookMoves.some(m => m.toLowerCase() === moveSan.toLowerCase());

  if (matchesUci || matchesSan) {
    return {
      isBook: true,
      openingName: entry.name,
      eco: entry.eco,
    };
  }

  return { isBook: false };
}
