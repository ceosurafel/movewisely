# Public release validation record

Date of this source review: 2026-10-10.

## Completed during this review

- Inspected the Stockfish service, game analysis, accuracy grading, player diagnostics, coaching, demo data, relevant UI, package scripts, and Cloudflare Pages configuration.
- Ran a TypeScript transpilation/syntax check across 30 `.ts` and `.tsx` files: **0 syntax/transpilation errors**.
- Reviewed the ZIP contents and confirmed the Stockfish worker and WASM assets are present under `public/stockfish/`.
- Added Cloudflare Pages `_headers` rules for WASM/JavaScript assets and baseline browser security headers.
- Removed the unused client-side Gemini SDK initialization and documented that private keys must never be embedded in `VITE_*` variables.
- Reframed MoveWisely accuracy as experimental and uncalibrated; removed unsupported claims predicting rating gains or timing.

## Not completed / release blockers

The container did not have the project's dependencies installed. The following commands were attempted and did **not** pass:

- `npm run lint` — failed because `vite/client` type definitions were unavailable.
- `npm test` — failed because the `tsx` executable was unavailable.
- `npm run build` — failed because the `vite` executable was unavailable.

Dependency installation could not be completed in this environment. Therefore, the full TypeScript typecheck, automated regression suites, production build, and any browser test are **unverified**. The syntax/transpilation pass is not a substitute for those checks.

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
