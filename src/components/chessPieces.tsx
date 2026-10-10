import React from 'react';

// The canonical cburnett / Chess.com vector chess pieces
// Precision SVG paths with authentic outlines, fills, and shading
export const ChessPieceSvg: React.FC<{ piece: string; className?: string }> = ({ piece, className = 'w-full h-full' }) => {
  switch (piece) {
    // --- WHITE PIECES ---
    case 'P':
      return (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 45 45" className={className}>
          <path
            d="m 22.5,9 c -2.21,0 -4,1.79 -4,4 0,0.89 0.29,1.71 0.78,2.38 C 17.33,16.5 16,18.59 16,21 c 0,2.03 0.94,3.84 2.41,5.03 C 15.41,27.09 11,31.58 11,39.5 l 23,0 c 0,-7.92 -4.41,-12.41 -7.41,-13.47 1.47,-1.19 2.41,-3 2.41,-5.03 0,-2.41 -1.33,-4.5 -3.28,-5.62 0.49,-0.67 0.78,-1.49 0.78,-2.38 0,-2.21 -1.79,-4 -4,-4 z"
            fill="#ffffff"
            stroke="#000000"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </svg>
      );

    case 'N':
      return (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 45 45" className={className}>
          <g fill="none" fillRule="evenodd" stroke="#000000" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path
              d="m 22,10 c -2.83,0 -5.5,1.5 -6.5,4 -1,2.5 -0.5,5.5 -1.5,8 -0.5,1.25 -1.5,2.5 -2.5,3.5 -1,1 -2.5,1.5 -2.5,3 0,1.5 1.5,2.5 3,2.5 1.5,0 3,-0.5 4.5,-0.5 1.5,0 3,0.5 4,1.5 1,1 1.5,2.5 1.5,4 0,1 -0.5,2 -1,3 l 11.5,0 c 0,-2 -0.5,-4.5 -1,-6.5 -0.5,-2 -1,-4.5 -1,-7 0,-2.5 1,-4.5 1,-7 0,-2.5 -1.5,-5 -3.5,-6.5 -2,-1.5 -4.5,-2 -7.5,-2 z"
              fill="#ffffff"
            />
            <path
              d="M 9.5 25.5 A 0.5 0.5 0 1 1 8.5,25.5 A 0.5 0.5 0 1 1 9.5 25.5 z"
              fill="#000000"
            />
            <path
              d="M 15 15.5 A 0.5 1.5 0 1 1 14,15.5 A 0.5 1.5 0 1 1 15 15.5 z"
              transform="matrix(0.866,0.5,-0.5,0.866,9.693,-5.173)"
              fill="#000000"
            />
            <path d="M 24.55,10.4 C 24.19,10 23.3,9.75 22.5,9.75 C 21.7,9.75 20.81,10 20.45,10.4" />
          </g>
        </svg>
      );

    case 'B':
      return (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 45 45" className={className}>
          <g fill="none" fillRule="evenodd" stroke="#000000" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <g fill="#ffffff" strokeLinecap="butt">
              <path d="m 9,36 c 3.39,-0.97 10.11,0.43 13.5,-2 3.39,2.43 10.11,1.03 13.5,2 0,0 1.65,0.54 3,2 -0.68,0.97 -1.65,0.99 -3,0.5 -3.39,-0.97 -10.11,0.46 -13.5,-1 -3.39,1.46 -10.11,0.03 -13.5,1 -1.35,0.49 -2.32,0.47 -3,-0.5 1.35,-1.46 3,-2 3,-2 z" />
              <path d="m 15,32 c 2.5,2.5 12.5,2.5 15,0 0.5,-1.5 0,-2 0,-2 0,-0.7 2.5,-4 1,-8.5 -1.5,-4.5 -5.5,-8.5 -8.5,-11 -3,2.5 -7,6.5 -8.5,11 -1.5,4.5 1,7.8 1,8.5 0,0 -0.5,0.5 0,2 z" />
              <path d="m 25,8 a 2.5,2.5 0 1 1 -5,0 2.5,2.5 0 1 1 5,0 z" />
            </g>
            <path d="m 17.5,26 10,0 M 15,30 30,30 M 22.5,15.5 l 0,9 M 20,18 l 5,0" />
          </g>
        </svg>
      );

    case 'R':
      return (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 45 45" className={className}>
          <g fill="#ffffff" fillRule="evenodd" stroke="#000000" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="m 9,39 27,0 0,-3 -27,0 0,3 z" strokeLinecap="butt" />
            <path d="m 12,36 0,-4 21,0 0,4 -21,0 z" strokeLinecap="butt" />
            <path d="m 11,14 23,0 0,5 -23,0 0,-5 z" strokeLinecap="butt" />
            <path d="m 12,19 21,0 -1.5,13 -18,0 -1.5,-13 z" />
            <path d="m 9,9 3.5,0 0,2 3,0 0,-2 3.5,0 0,2 3,0 0,-2 3.5,0 0,2 3,0 0,-2 3.5,0 0,5 -23,0 0,-5 z" strokeLinecap="butt" />
            <path d="m 14,14 17,0" fill="none" strokeLinejoin="miter" />
            <path d="m 14,29 17,0" fill="none" strokeLinejoin="miter" />
          </g>
        </svg>
      );

    case 'Q':
      return (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 45 45" className={className}>
          <g fill="#ffffff" fillRule="evenodd" stroke="#000000" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="m 8.5,14 a 2,2 0 1 1 -4,0 2,2 0 1 1 4,0 z" />
            <path d="m 15.5,10.5 a 2,2 0 1 1 -4,0 2,2 0 1 1 4,0 z" />
            <path d="m 24.5,9 a 2,2 0 1 1 -4,0 2,2 0 1 1 4,0 z" />
            <path d="m 33.5,10.5 a 2,2 0 1 1 -4,0 2,2 0 1 1 4,0 z" />
            <path d="m 40.5,14 a 2,2 0 1 1 -4,0 2,2 0 1 1 4,0 z" />
            <path d="m 9,26 c 8.5,-1.5 21,-1.5 27,0 l 2,-12 -7,11 -4,-13 -4.5,13 -4.5,-13 -4,13 -7,-11 2,12 z" strokeLinecap="butt" />
            <path d="m 9,26 c 0,2 1.5,2 2.5,4 1,1.5 1,1 0.5,3.5 -1.5,1 -1.5,2.5 -1.5,2.5 -1.5,1.5 0.5,2.5 0.5,2.5 6.5,1 16.5,1 23,0 0,0 2,-1 0.5,-2.5 0,0 0,-1.5 -1.5,-2.5 -0.5,-2.5 -0.5,-2 0.5,-3.5 1,-2 2.5,-2 2.5,-4 -8.5,-1.5 -18.5,-1.5 -27,0 z" strokeLinecap="butt" />
            <path d="m 11,38.5 a 3.5,1.5 0 1 1 -7,0 3.5,1.5 0 1 1 7,0 z" transform="matrix(1,0,0,1,18.5,0)" />
            <path d="m 11,29 c 6.5,0.5 16.5,0.5 23,0" fill="none" />
            <path d="m 11.5,32.5 c 6,0.5 16,0.5 22,0" fill="none" />
            <path d="m 10.5,36 c 7.5,0.5 16.5,0.5 24,0" fill="none" />
          </g>
        </svg>
      );

    case 'K':
      return (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 45 45" className={className}>
          <g fill="none" fillRule="evenodd" stroke="#000000" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="m 22.5,11.63 0,-6 M 20,8 l 5,0" strokeLinejoin="miter" />
            <path
              d="m 22.5,25 c 0,0 4.5,-7.5 3,-10.5 0,0 -1,-2.5 -3,-2.5 -2,0 -3,2.5 -3,2.5 -1.5,3 3,10.5 3,10.5"
              fill="#ffffff"
              strokeLinecap="butt"
              strokeLinejoin="miter"
            />
            <path
              d="m 11.5,37 c 5.5,3.5 16.5,3.5 22,0 0,-3 -1,-3.5 -2.5,-4 -2.5,-0.5 -3.5,-0.5 -4.5,-1.5 -1.5,-1.5 -1.5,-2.5 -2,-4.5 -0.5,-2 -0.5,-3 -2,-3 -1.5,0 -1.5,1 -2,3 -0.5,2 -0.5,3 -2,4.5 -1,1 -2,1 -4.5,1.5 -1.5,0.5 -2.5,1 -2.5,4 z"
              fill="#ffffff"
            />
            <path d="m 11.5,30 c 3.5,-1 4.5,-1 6,-2 1.5,-1 2,-2 2.5,-4 0.5,-2 0.5,-3 2.5,-3 2,0 2,1 2.5,3 0.5,2 1,3 2.5,4 1.5,1 2.5,1 6,2" />
            <path d="m 11.5,33.5 c 3.5,-1 4.5,-1 6,-2 1.5,-1 2,-2 2.5,-4 0.5,-2 0.5,-3 2.5,-3 2,0 2,1 2.5,3 0.5,2 1,3 2.5,4 1.5,1 2.5,1 6,2" />
          </g>
        </svg>
      );

    // --- BLACK PIECES ---
    case 'p':
      return (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 45 45" className={className}>
          <path
            d="m 22.5,9 c -2.21,0 -4,1.79 -4,4 0,0.89 0.29,1.71 0.78,2.38 C 17.33,16.5 16,18.59 16,21 c 0,2.03 0.94,3.84 2.41,5.03 C 15.41,27.09 11,31.58 11,39.5 l 23,0 c 0,-7.92 -4.41,-12.41 -7.41,-13.47 1.47,-1.19 2.41,-3 2.41,-5.03 0,-2.41 -1.33,-4.5 -3.28,-5.62 0.49,-0.67 0.78,-1.49 0.78,-2.38 0,-2.21 -1.79,-4 -4,-4 z"
            fill="#18181b"
            stroke="#18181b"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
          <path
            d="m 14,39 c 0,-6.5 3.5,-11 7,-12 M 24,27 c 3.5,1 7,5.5 7,12"
            fill="none"
            stroke="#ffffff"
            strokeWidth="1.2"
          />
        </svg>
      );

    case 'n':
      return (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 45 45" className={className}>
          <g fill="none" fillRule="evenodd" stroke="#000000" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path
              d="m 22,10 c -2.83,0 -5.5,1.5 -6.5,4 -1,2.5 -0.5,5.5 -1.5,8 -0.5,1.25 -1.5,2.5 -2.5,3.5 -1,1 -2.5,1.5 -2.5,3 0,1.5 1.5,2.5 3,2.5 1.5,0 3,-0.5 4.5,-0.5 1.5,0 3,0.5 4,1.5 1,1 1.5,2.5 1.5,4 0,1 -0.5,2 -1,3 l 11.5,0 c 0,-2 -0.5,-4.5 -1,-6.5 -0.5,-2 -1,-4.5 -1,-7 0,-2.5 1,-4.5 1,-7 0,-2.5 -1.5,-5 -3.5,-6.5 -2,-1.5 -4.5,-2 -7.5,-2 z"
              fill="#18181b"
            />
            <path
              d="M 9.5 25.5 A 0.5 0.5 0 1 1 8.5,25.5 A 0.5 0.5 0 1 1 9.5 25.5 z"
              fill="#ffffff"
              stroke="#ffffff"
            />
            <path
              d="M 15 15.5 A 0.5 1.5 0 1 1 14,15.5 A 0.5 1.5 0 1 1 15 15.5 z"
              transform="matrix(0.866,0.5,-0.5,0.866,9.693,-5.173)"
              fill="#ffffff"
              stroke="#ffffff"
            />
            <path
              d="m 24.55,10.4 c -0.36,-0.4 -1.25,-0.65 -2.05,-0.65 -0.8,0 -1.69,0.25 -2.05,0.65"
              stroke="#ffffff"
            />
          </g>
        </svg>
      );

    case 'b':
      return (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 45 45" className={className}>
          <g fill="none" fillRule="evenodd" stroke="#000000" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <g fill="#18181b" strokeLinecap="butt">
              <path d="m 9,36 c 3.39,-0.97 10.11,0.43 13.5,-2 3.39,2.43 10.11,1.03 13.5,2 0,0 1.65,0.54 3,2 -0.68,0.97 -1.65,0.99 -3,0.5 -3.39,-0.97 -10.11,0.46 -13.5,-1 -3.39,1.46 -10.11,0.03 -13.5,1 -1.35,0.49 -2.32,0.47 -3,-0.5 1.35,-1.46 3,-2 3,-2 z" />
              <path d="m 15,32 c 2.5,2.5 12.5,2.5 15,0 0.5,-1.5 0,-2 0,-2 0,-0.7 2.5,-4 1,-8.5 -1.5,-4.5 -5.5,-8.5 -8.5,-11 -3,2.5 -7,6.5 -8.5,11 -1.5,4.5 1,7.8 1,8.5 0,0 -0.5,0.5 0,2 z" />
              <path d="m 25,8 a 2.5,2.5 0 1 1 -5,0 2.5,2.5 0 1 1 5,0 z" />
            </g>
            <path d="m 17.5,26 10,0 M 15,30 30,30 M 22.5,15.5 l 0,9 M 20,18 l 5,0" stroke="#ffffff" />
          </g>
        </svg>
      );

    case 'r':
      return (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 45 45" className={className}>
          <g fill="#18181b" fillRule="evenodd" stroke="#000000" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="m 9,39 27,0 0,-3 -27,0 0,3 z" strokeLinecap="butt" />
            <path d="m 12,36 0,-4 21,0 0,4 -21,0 z" strokeLinecap="butt" />
            <path d="m 11,14 23,0 0,5 -23,0 0,-5 z" strokeLinecap="butt" />
            <path d="m 12,19 21,0 -1.5,13 -18,0 -1.5,-13 z" />
            <path d="m 9,9 3.5,0 0,2 3,0 0,-2 3.5,0 0,2 3,0 0,-2 3.5,0 0,2 3,0 0,-2 3.5,0 0,5 -23,0 0,-5 z" strokeLinecap="butt" />
            <path d="m 14,14 17,0" fill="none" stroke="#ffffff" strokeLinejoin="miter" />
            <path d="m 14,29 17,0" fill="none" stroke="#ffffff" strokeLinejoin="miter" />
          </g>
        </svg>
      );

    case 'q':
      return (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 45 45" className={className}>
          <g fill="#18181b" fillRule="evenodd" stroke="#000000" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="m 8.5,14 a 2,2 0 1 1 -4,0 2,2 0 1 1 4,0 z" />
            <path d="m 15.5,10.5 a 2,2 0 1 1 -4,0 2,2 0 1 1 4,0 z" />
            <path d="m 24.5,9 a 2,2 0 1 1 -4,0 2,2 0 1 1 4,0 z" />
            <path d="m 33.5,10.5 a 2,2 0 1 1 -4,0 2,2 0 1 1 4,0 z" />
            <path d="m 40.5,14 a 2,2 0 1 1 -4,0 2,2 0 1 1 4,0 z" />
            <path d="m 9,26 c 8.5,-1.5 21,-1.5 27,0 l 2,-12 -7,11 -4,-13 -4.5,13 -4.5,-13 -4,13 -7,-11 2,12 z" strokeLinecap="butt" />
            <path d="m 9,26 c 0,2 1.5,2 2.5,4 1,1.5 1,1 0.5,3.5 -1.5,1 -1.5,2.5 -1.5,2.5 -1.5,1.5 0.5,2.5 0.5,2.5 6.5,1 16.5,1 23,0 0,0 2,-1 0.5,-2.5 0,0 0,-1.5 -1.5,-2.5 -0.5,-2.5 -0.5,-2 0.5,-3.5 1,-2 2.5,-2 2.5,-4 -8.5,-1.5 -18.5,-1.5 -27,0 z" strokeLinecap="butt" />
            <path d="m 11,38.5 a 3.5,1.5 0 1 1 -7,0 3.5,1.5 0 1 1 7,0 z" transform="matrix(1,0,0,1,18.5,0)" />
            <path d="m 11,29 c 6.5,0.5 16.5,0.5 23,0" fill="none" stroke="#ffffff" />
            <path d="m 11.5,32.5 c 6,0.5 16,0.5 22,0" fill="none" stroke="#ffffff" />
            <path d="m 10.5,36 c 7.5,0.5 16.5,0.5 24,0" fill="none" stroke="#ffffff" />
          </g>
        </svg>
      );

    case 'k':
      return (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 45 45" className={className}>
          <g fill="none" fillRule="evenodd" stroke="#000000" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="m 22.5,11.63 0,-6 M 20,8 l 5,0" strokeLinejoin="miter" />
            <path
              d="m 22.5,25 c 0,0 4.5,-7.5 3,-10.5 0,0 -1,-2.5 -3,-2.5 -2,0 -3,2.5 -3,2.5 -1.5,3 3,10.5 3,10.5"
              fill="#18181b"
              strokeLinecap="butt"
              strokeLinejoin="miter"
            />
            <path
              d="m 11.5,37 c 5.5,3.5 16.5,3.5 22,0 0,-3 -1,-3.5 -2.5,-4 -2.5,-0.5 -3.5,-0.5 -4.5,-1.5 -1.5,-1.5 -1.5,-2.5 -2,-4.5 -0.5,-2 -0.5,-3 -2,-3 -1.5,0 -1.5,1 -2,3 -0.5,2 -0.5,3 -2,4.5 -1,1 -2,1 -4.5,1.5 -1.5,0.5 -2.5,1 -2.5,4 z"
              fill="#18181b"
            />
            <path d="m 11.5,30 c 3.5,-1 4.5,-1 6,-2 1.5,-1 2,-2 2.5,-4 0.5,-2 0.5,-3 2.5,-3 2,0 2,1 2.5,3 0.5,2 1,3 2.5,4 1.5,1 2.5,1 6,2" stroke="#ffffff" />
            <path d="m 11.5,33.5 c 3.5,-1 4.5,-1 6,-2 1.5,-1 2,-2 2.5,-4 0.5,-2 0.5,-3 2.5,-3 2,0 2,1 2.5,3 0.5,2 1,3 2.5,4 1.5,1 2.5,1 6,2" stroke="#ffffff" />
          </g>
        </svg>
      );

    default:
      return null;
  }
};
