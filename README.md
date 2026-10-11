# MoveWisely

MoveWisely is a chess-game analysis and coaching web application built with React, TypeScript, Vite, chess.js, and Stockfish 19 WASM.

It is intended to help players review PGN games, inspect move-by-move engine recommendations, and identify recurring areas for improvement.

> **Analysis-quality notice:** MoveWisely's accuracy and expected-points metrics are experimental and uncalibrated. They should not be presented as equivalent to Chess.com or Lichess accuracy scores, an official rating estimate, or a guarantee of future performance. Engine results depend on search settings and the position.

## Features

- PGN-based game reconstruction with move-by-move FEN tracking.
- Stockfish-powered position evaluation and best-move analysis.
- Move classification and multi-game diagnostics.
- Coaching explanations and training recommendations.
- Regression tests for engine behavior, game reconstruction, scoring, diagnostics, coaching, and release-critical cases.

The available features and their maturity may change. Check the UI and tests in the current branch rather than assuming every listed capability has been validated for every input.

## Requirements

- Bun (recommended; the repository includes `bun.lock`).
- A current desktop browser with WebAssembly and Web Worker support.

## Run locally

```bash
bun install --frozen-lockfile
bun run dev
```

Vite prints the local development URL in the terminal.

## Validate before release

Run the same core checks used by CI:

```bash
bun install --frozen-lockfile
bun run lint
bun run test
bun run build
```

The configured test suite runs the engine, game-analysis, accuracy, diagnostics, coaching, and regression-audit scripts. A passing test suite is necessary but does not replace a browser smoke test of the built app, a real Stockfish WASM startup test, or validation of representative user PGNs.

## Production build

```bash
bun run build
bun run preview
```

Deploy the generated `dist/` output to a static hosting provider configured for a Vite single-page application. Configure SPA fallback routing if the app uses client-side routes.

## Release checklist

Before announcing a public release:

- [ ] CI passes on the exact commit being released.
- [ ] Production build loads in a clean browser session.
- [ ] Stockfish WASM initializes and completes a real position search.
- [ ] Standard-start and custom-FEN PGNs are tested, including malformed FENs and illegal/incomplete PGNs.
- [ ] A mixed batch of valid and invalid games reports completed, partial, failed, and excluded counts accurately.
- [ ] The original 20-game regression batch is re-run and its actual results are recorded.
- [ ] No failed or partial analysis is silently represented as a completed result.
- [ ] Move classifications and tactical labels have position-based evidence.
- [ ] The UI clearly labels experimental/un-calibrated metrics.
- [ ] Hosting configuration, privacy disclosure, support contact, and an appropriate license are decided before inviting the public.

## Accuracy and limitations

MoveWisely's custom accuracy and expected-points calculations are experimental and not independently calibrated against a representative labeled game corpus. Centipawn evaluation is engine-dependent and search-depth-dependent. Treat the metrics as internal estimates, not as an authoritative comparison with other chess platforms.

Tactical labels such as forks, pins, hanging pieces, and sacrifices should only be shown when the corresponding position and legal moves substantiate the label. If the app cannot verify a claim, it should report the result as unavailable rather than inventing a number or explanation.

## Security and privacy

Do not commit API keys, credentials, private PGNs, user exports, or local environment files. If environment variables are introduced, document their names in a safe example file and keep real values out of version control. Review the hosting configuration and any third-party API usage before collecting user information.

See [SECURITY.md](SECURITY.md) for reporting guidance.

## License

No license is declared here. Unless the repository owner adds a license, do not assume that the source code is licensed for reuse, redistribution, or commercial use.
