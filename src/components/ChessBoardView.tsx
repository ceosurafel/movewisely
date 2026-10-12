import React, { useState } from 'react';
import { Chess, Square } from 'chess.js';
import { ChessPieceSvg } from './chessPieces';

interface ChessBoardViewProps {
  initialFen: string;
  fenAfterUserMove?: string;
  bestMoveFrom?: string;
  bestMoveTo?: string;
  userMoveFrom?: string;
  userMoveTo?: string;
  orientation?: 'white' | 'black';
  interactive?: boolean;
  onSolveSuccess?: () => void;
  refutationSteps?: Array<{ from: string; to: string; san: string }>;
  /** Called whenever a legal move changes the displayed board position. */
  onPositionChange?: (fen: string) => void;
}

// Chess.com piece image helper
const getChessComPieceUrl = (piece: string): string => {
  const isWhite = piece === piece.toUpperCase();
  const color = isWhite ? 'w' : 'b';
  const type = piece.toLowerCase();
  return `https://images.chesscomfiles.com/chess-themes/pieces/neo/150/${color}${type}.png`;
};

// Component for piece with resilient fallback
const ChessPiece: React.FC<{ piece: string }> = ({ piece }) => {
  const [imageError, setImageError] = useState(false);
  const src = getChessComPieceUrl(piece);

  if (imageError) {
    return (
      <div className="w-[94%] h-[94%] flex items-center justify-center pointer-events-none">
        <ChessPieceSvg piece={piece} />
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={piece}
      loading="eager"
      onError={() => setImageError(true)}
      className="w-[96%] h-[96%] object-contain select-none pointer-events-none"
      draggable={false}
    />
  );
};

export const ChessBoardView: React.FC<ChessBoardViewProps> = ({
  initialFen,
  fenAfterUserMove,
  bestMoveFrom,
  bestMoveTo,
  userMoveFrom,
  userMoveTo,
  orientation: initialOrientation = 'white',
  interactive = true,
  onSolveSuccess,
  refutationSteps,
  onPositionChange,
}) => {
  const [orientation, setOrientation] = useState<'white' | 'black'>(initialOrientation);
  const [chessInstance] = useState(() => {
    const c = new Chess();
    try {
      c.load(initialFen);
    } catch {
      // fallback
    }
    return c;
  });

  const [currentFen, setCurrentFen] = useState(initialFen);
  const [selectedSquare, setSelectedSquare] = useState<string | null>(null);
  const [solved, setSolved] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [showBestArrow, setShowBestArrow] = useState(true);
  const [showingRefutation, setShowingRefutation] = useState(false);

  // Files & Ranks
  const files = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
  const ranks = ['8', '7', '6', '5', '4', '3', '2', '1'];

  const displayFiles = orientation === 'black' ? [...files].reverse() : files;
  const displayRanks = orientation === 'black' ? [...ranks].reverse() : ranks;

  // Legal moves for selected square (for destination dots and capture rings)
  const legalDestinations = React.useMemo(() => {
    if (!selectedSquare || solved || !interactive) return new Map<string, boolean>();
    const map = new Map<string, boolean>(); // target square -> isCapture
    try {
      const moves = chessInstance.moves({ square: selectedSquare as Square, verbose: true });
      for (const m of moves) {
        map.set(m.to, m.captured !== undefined || m.flags.includes('c') || m.flags.includes('e'));
      }
    } catch {
      // ignore
    }
    return map;
  }, [selectedSquare, solved, interactive, chessInstance, currentFen]);

  // Parse board position from FEN
  const fenRows = currentFen.split(' ')[0].split('/');
  const boardMatrix: (string | null)[][] = Array(8)
    .fill(null)
    .map(() => Array(8).fill(null));

  fenRows.forEach((row, rIdx) => {
    let col = 0;
    for (const char of row) {
      if (char >= '1' && char <= '8') {
        col += parseInt(char, 10);
      } else {
        boardMatrix[rIdx][col] = char;
        col++;
      }
    }
  });

  const getSquarePiece = (file: string, rank: string) => {
    const colIdx = files.indexOf(file);
    const rowIdx = 8 - parseInt(rank, 10);
    return boardMatrix[rowIdx]?.[colIdx] || null;
  };

  const handleSquareClick = (file: string, rank: string) => {
    if (!interactive || solved) return;
    const targetSq = `${file}${rank}`;

    if (!selectedSquare) {
      const piece = getSquarePiece(file, rank);
      if (piece) {
        setSelectedSquare(targetSq);
        setStatusMessage(null);
      }
    } else {
      if (selectedSquare === targetSq) {
        setSelectedSquare(null);
        setStatusMessage(null);
        return;
      }

      try {
        const move = chessInstance.move({
          from: selectedSquare as Square,
          to: targetSq as Square,
          promotion: 'q',
        });

        if (move) {
          const nextFen = chessInstance.fen();
          setCurrentFen(nextFen);
          onPositionChange?.(nextFen);
          if (
            bestMoveFrom &&
            bestMoveTo &&
            selectedSquare === bestMoveFrom &&
            targetSq === bestMoveTo
          ) {
            setSolved(true);
            setStatusMessage('Master refutation! You found the winning solution.');
            setShowBestArrow(false);
            if (onSolveSuccess) onSolveSuccess();
          } else {
            setStatusMessage('Move played. Compare with the engine best move.');
          }
        }
      } catch {
        // If clicking another of own pieces, switch selection
        const clickedPiece = getSquarePiece(file, rank);
        if (clickedPiece) {
          setSelectedSquare(targetSq);
          setStatusMessage(null);
          return;
        }
        setStatusMessage('Illegal move. Try another square!');
      }

      setSelectedSquare(null);
    }
  };

  const toggleShowRefutation = () => {
    if (!showingRefutation) {
      const targetFen = fenAfterUserMove || initialFen;
      chessInstance.load(targetFen);
      setCurrentFen(targetFen);
      onPositionChange?.(targetFen);
      setShowingRefutation(true);
      setShowBestArrow(false);
      setSelectedSquare(null);
      if (refutationSteps && refutationSteps.length > 0) {
        setStatusMessage(`Refutation: ${refutationSteps[0].san}`);
      }
    } else {
      resetBoard();
    }
  };

  const resetBoard = () => {
    chessInstance.load(initialFen);
    setCurrentFen(initialFen);
    onPositionChange?.(initialFen);
    setSolved(false);
    setSelectedSquare(null);
    setStatusMessage(null);
    setShowBestArrow(true);
    setShowingRefutation(false);
  };

  const toggleOrientation = () => {
    setOrientation(prev => (prev === 'white' ? 'black' : 'white'));
  };

  // Center coordinate percentage of a square (0-100)
  const getSquareCenter = (sq: string) => {
    const f = sq[0];
    const r = sq[1];
    const fIdx = displayFiles.indexOf(f);
    const rIdx = displayRanks.indexOf(r);
    return {
      x: (fIdx + 0.5) * 12.5,
      y: (rIdx + 0.5) * 12.5,
    };
  };

  // Standard Chess.com Green Theme:
  // Light: #EEEED2, Dark: #769656. a1 is dark.
  const LIGHT_COLOR = '#EEEED2';
  const DARK_COLOR = '#769656';

  return (
    <div className="w-full flex flex-col items-center select-none" onClick={e => e.stopPropagation()}>
      {/* PERFECT CHESS.COM BOARD:
          - NO outer frame, border, padding, rounded corners, or shadow
          - Edge to edge 8x8 flat squares with zero gaps
          - Max 440px wide, perfect 1:1 aspect ratio */}
      <div className="relative w-full aspect-square bg-[#769656] overflow-hidden">
        <div className="grid grid-cols-8 grid-rows-8 w-full h-full">
          {displayRanks.map((rank, rIndex) =>
            displayFiles.map((file, fIndex) => {
              const squareName = `${file}${rank}`;
              // (fileIndex + rankNumber) % 2 !== 0 is dark (a1: 0+1=1 is dark)
              const isDarkSquare = (files.indexOf(file) + parseInt(rank, 10)) % 2 !== 0;

              const isSelected = selectedSquare === squareName;
              const isBadMove = userMoveFrom === squareName || userMoveTo === squareName;
              const isBestMove = bestMoveFrom === squareName || bestMoveTo === squareName;
              const isLegalDest = legalDestinations.has(squareName);
              const isCaptureDest = legalDestinations.get(squareName) === true;

              const piece = getSquarePiece(file, rank);
              const squareBg = isDarkSquare ? DARK_COLOR : LIGHT_COLOR;
              const coordinateColor = isDarkSquare ? LIGHT_COLOR : DARK_COLOR;

              return (
                <button
                  key={squareName}
                  type="button"
                  onClick={() => handleSquareClick(file, rank)}
                  style={{ backgroundColor: squareBg }}
                  className="relative p-0 m-0 border-0 outline-none cursor-pointer flex items-center justify-center"
                  aria-label={`Square ${squareName}`}
                >
                  {/* Blunder / Bad move tint: red tint (rgba(235,97,80,0.6)) */}
                  {isBadMove && (
                    <div className="absolute inset-0 bg-[#eb6150]/60 z-1 pointer-events-none" />
                  )}

                  {/* Best move tint: green tint (rgba(129,182,76,0.6)) */}
                  {isBestMove && (
                    <div className="absolute inset-0 bg-[#81b64c]/60 z-1 pointer-events-none" />
                  )}

                  {/* Selected square: Chess.com yellow overlay (rgba(255,255,0,0.5)) */}
                  {isSelected && (
                    <div className="absolute inset-0 bg-[#ffff00]/50 z-1 pointer-events-none" />
                  )}

                  {/* In-square Coordinates:
                      Rank numbers in top-left corner of leftmost column (fIndex === 0)
                      File letters in bottom-right corner of bottom row (rIndex === 7) */}
                  {fIndex === 0 && (
                    <span
                      style={{ color: coordinateColor }}
                      className="absolute top-0.5 left-1 text-[11px] font-bold font-sans pointer-events-none leading-none z-10"
                    >
                      {rank}
                    </span>
                  )}
                  {rIndex === 7 && (
                    <span
                      style={{ color: coordinateColor }}
                      className="absolute bottom-0.5 right-1 text-[11px] font-bold font-sans pointer-events-none leading-none z-10"
                    >
                      {file}
                    </span>
                  )}

                  {/* Legal move indicators: dot on empty square, ring on capture square */}
                  {isLegalDest && !piece && (
                    <div className="w-3.5 h-3.5 rounded-full bg-black/25 z-5 pointer-events-none" />
                  )}
                  {isLegalDest && piece && (
                    <div className="absolute inset-1 rounded-full border-4 border-black/25 z-5 pointer-events-none" />
                  )}

                  {/* Crisp Chess.com Neo Piece */}
                  {piece && (
                    <div className="relative z-10 w-full h-full flex items-center justify-center">
                      <ChessPiece piece={piece} />
                    </div>
                  )}
                </button>
              );
            })
          )}
        </div>

        {/* Thick semi-transparent vector arrows:
            Best move green (#81b64c, 80% opacity)
            Blunder red (#eb6150, 80% opacity) */}
        <svg
          className="absolute inset-0 w-full h-full pointer-events-none z-15"
          viewBox="0 0 100 100"
        >
          <defs>
            {/* Green Arrow Head */}
            <marker
              id="chesscom-green-head"
              viewBox="0 0 10 10"
              refX="6"
              refY="5"
              markerWidth="4"
              markerHeight="4"
              orient="auto-start-reverse"
            >
              <path d="M 0 1 L 9 5 L 0 9 z" fill="#81b64c" fillOpacity="0.85" />
            </marker>

            {/* Red Arrow Head */}
            <marker
              id="chesscom-red-head"
              viewBox="0 0 10 10"
              refX="6"
              refY="5"
              markerWidth="4"
              markerHeight="4"
              orient="auto-start-reverse"
            >
              <path d="M 0 1 L 9 5 L 0 9 z" fill="#eb6150" fillOpacity="0.85" />
            </marker>

            {/* Amber Refutation Arrow Head */}
            <marker
              id="chesscom-amber-head"
              viewBox="0 0 10 10"
              refX="6"
              refY="5"
              markerWidth="4"
              markerHeight="4"
              orient="auto-start-reverse"
            >
              <path d="M 0 1 L 9 5 L 0 9 z" fill="#f59e0b" fillOpacity="0.9" />
            </marker>
          </defs>

          {/* User's Blunder Red Arrow */}
          {!showingRefutation && userMoveFrom && userMoveTo && (
            <line
              x1={`${getSquareCenter(userMoveFrom).x}%`}
              y1={`${getSquareCenter(userMoveFrom).y}%`}
              x2={`${getSquareCenter(userMoveTo).x}%`}
              y2={`${getSquareCenter(userMoveTo).y}%`}
              stroke="#eb6150"
              strokeWidth="4"
              strokeLinecap="round"
              strokeOpacity="0.8"
              markerEnd="url(#chesscom-red-head)"
            />
          )}

          {/* Engine Best Move Green Arrow */}
          {!showingRefutation && showBestArrow && bestMoveFrom && bestMoveTo && (
            <line
              x1={`${getSquareCenter(bestMoveFrom).x}%`}
              y1={`${getSquareCenter(bestMoveFrom).y}%`}
              x2={`${getSquareCenter(bestMoveTo).x}%`}
              y2={`${getSquareCenter(bestMoveTo).y}%`}
              stroke="#81b64c"
              strokeWidth="4.5"
              strokeLinecap="round"
              strokeOpacity="0.85"
              markerEnd="url(#chesscom-green-head)"
            />
          )}

          {/* Opponent's Refutation Amber Arrow */}
          {showingRefutation && refutationSteps && refutationSteps.length > 0 && (
            <line
              x1={`${getSquareCenter(refutationSteps[0].from).x}%`}
              y1={`${getSquareCenter(refutationSteps[0].from).y}%`}
              x2={`${getSquareCenter(refutationSteps[0].to).x}%`}
              y2={`${getSquareCenter(refutationSteps[0].to).y}%`}
              stroke="#f59e0b"
              strokeWidth="4.5"
              strokeLinecap="round"
              strokeOpacity="0.9"
              markerEnd="url(#chesscom-amber-head)"
            />
          )}
        </svg>
      </div>

      {/* Two small muted icon buttons (flip, reset) below the board in muted gray */}
      <div className="w-full flex items-center justify-between px-3 py-2 text-zinc-400 text-xs">
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={toggleOrientation}
            className="flex items-center gap-1.5 hover:text-zinc-200 transition-colors cursor-pointer text-xs"
            title="Flip board orientation"
          >
            <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 stroke-current fill-none stroke-2">
              <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" />
            </svg>
            <span>Flip</span>
          </button>

          {interactive && (
            <button
              type="button"
              onClick={resetBoard}
              className="flex items-center gap-1.5 hover:text-zinc-200 transition-colors cursor-pointer text-xs"
              title="Reset position"
            >
              <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 stroke-current fill-none stroke-2">
                <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                <path d="M3 3v5h5" />
              </svg>
              <span>Reset</span>
            </button>
          )}

          {refutationSteps && refutationSteps.length > 0 && (
            <button
              type="button"
              onClick={toggleShowRefutation}
              className={`flex items-center gap-1 text-xs cursor-pointer transition-colors ${
                showingRefutation ? 'text-amber-400 font-bold' : 'hover:text-zinc-200'
              }`}
              title="Show engine refutation"
            >
              <span>{showingRefutation ? 'Show Solution' : 'Show Refutation'}</span>
            </button>
          )}
        </div>

        {statusMessage && (
          <span className={`text-[11px] font-medium truncate max-w-[200px] ${solved ? 'text-emerald-400' : 'text-zinc-300'}`}>
            {statusMessage}
          </span>
        )}
      </div>
    </div>
  );
};
