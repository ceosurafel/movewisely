# Public release validation record

Date of this source review: 2026-10-10.

## Completed during this review

- Inspected the Stockfish service, game analysis, accuracy grading, player diagnostics, coaching, demo data, relevant UI, package scripts, and Cloudflare Pages configuration.
- Ran a TypeScript transpilation/syntax check across all files: **0 syntax/type errors**.
- Reviewed the Stockfish worker and WASM assets under `public/stockfish/`.
- Added Cloudflare Pages `_headers` rules for WASM/JavaScript assets and baseline browser security headers.
- Removed unused client-side Gemini SDK initialization.
- Reframed MoveWisely accuracy as experimental and uncalibrated; removed unsupported claims predicting rating gains or timing.
- **Phase 7 Diagnostic Integrity Repair**:
  - Removed logic labeling middlegame errors as forks or double attacks merely due to phase occurrence.
  - Removed blanket classification of large eval losses as hanging pieces and misses as missed free pieces.
  - Enforced verified tactical motif detection supported by board geometry and engine continuation lines.
  - Falls back to general evaluation losses when no specific tactical motif is reliably verified.
  - Zero-loss invariant enforced: phase-of-loss statistics are represented as unavailable/N/A (never manufacturing a 100% endgame loss).
  - Unrecognized openings default to 'Unknown Opening' and empty ECO (never defaulting to 'Open Game' or 'A00').
  - Accurately distinguished opening repertoire leaks, tactical blindspots, time trouble, and endgame conversion leaks based on real move evaluations.
- **Reproducible CI Workflow**:
  - Added `.github/workflows/ci.yml` running lint, test suites, and production build on every push and pull request.

## Release readiness & scoring limitation

MoveWisely Accuracy V1.1 is an experimental score proxy and has not been empirically calibrated against a representative independent dataset. Passing code tests and CI assertions verifies structural and logical correctness, but does not establish empirical calibration parity with commercial platforms or warrant an arbitrary 100% release-readiness score.

No interactive real-browser session against the deployed site was completed. Cloudflare worker loading, actual WASM compilation, deployed MIME types, runtime behavior, performance, and mobile behavior remain unverified.

## Run these checks from the repository root

Use Bun 1.2.15 with the committed lockfile, or consistently use npm with a committed `package-lock.json`. Do not mix package managers during one build workflow.

```bash
bun install --frozen-lockfile
bun run lint
bun run test
bun run build
```

If the frozen install reports a lockfile mismatch, use `bun install` to regenerate `bun.lock`, inspect and commit the resulting lockfile change, then repeat the checks. Do not ignore a lockfile error.

## Required browser/Cloudflare preview checks

1. Open the deployed preview in current desktop Chrome and a mobile-sized viewport.
2. Confirm the Stockfish worker and WASM requests return HTTP 200 with the expected content types.
3. Check the browser console for Web Worker, WASM, CSP, or runtime errors.
4. Analyze a known legal PGN containing ordinary play and tactical positions. Confirm displayed moves and scores correspond to the actual PGN.
5. Test an invalid PGN, cancellation during an active search, a timed-out search, and a subsequent new analysis.
6. Test checkmate and draw positions, including ensuring a terminal position does not require an engine best move.
7. Confirm demo fixtures are clearly labelled as demo data and never silently replace a failed live lookup.
8. Confirm no private API key or secret is present in the built JavaScript or browser network requests.
9. Check that failed or partial analyses are not included in completed-game accuracy aggregates.

## Scoring claim limitation

MoveWisely Accuracy V1.1 is an experimental score proxy and has not been empirically calibrated against a representative independent dataset. Passing code tests would not, by itself, validate the calibration or establish parity with Chess.com, Lichess, or any other product.
