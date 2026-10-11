# Cloudflare Pages Deployment

MoveWisely is a client-side React + Vite single-page application. It can be hosted as a static Cloudflare Pages site; no Worker API or server runtime is required for the current implementation. Chess.com/Lichess public endpoints are called directly from the visitor's browser.

## One-time Cloudflare setup

1. In Cloudflare, open **Workers & Pages → Create → Pages → Import an existing Git repository** and authorize the GitHub repository `ceosurafel/movewisely`.
2. Use the following build settings:

   | Setting | Value |
   | --- | --- |
   | Production branch | `main` |
   | Root directory | `/` (repository root) |
   | Build command | `bun install --frozen-lockfile && bun run build` |
   | Build output directory | `dist` |

3. In **Settings → Environment variables**, set these for both Production and Preview builds:

   | Variable | Value | Purpose |
   | --- | --- | --- |
   | `BUN_VERSION` | `1.4.3` | Align the build environment with the Bun version pinned in CI. |
   | `SKIP_DEPENDENCY_INSTALL` | `1` | Use the explicit frozen-lockfile install in the build command instead of a second automatic install. |

4. Keep automatic production deployments enabled for `main`. Pull requests/preview branches should be used to review future changes before merging them.
5. Deploy the first build to the generated `*.pages.dev` hostname and run the production smoke-test checklist below before connecting the final custom domain.

Cloudflare documents React/Vite Pages builds with output directory `dist`; its current Pages build image supports pinning Bun via `BUN_VERSION`. See the official [React on Pages guide](https://developers.cloudflare.com/pages/framework-guides/deploy-a-react-site/) and [Pages build-image reference](https://developers.cloudflare.com/pages/configuration/build-image/).

## Compatibility with Cloudflare's preinstalled Bun

The committed `bun.lock` deliberately uses lockfile format version 1 so the dependency installer in Cloudflare Pages' current default Bun 1.2.15 can parse it even when the project's `BUN_VERSION` variable has not been applied. CI checks both the pinned Bun 1.4.3 toolchain and Bun 1.2.15. The lockfile version is intentional; do not regenerate it with Bun 1.4+ unless Cloudflare's build environment is also guaranteed to use Bun 1.4+.

The recommended `BUN_VERSION=1.4.3` setting remains useful for matching CI, but the lockfile no longer relies on that setting merely to get through dependency installation.

## Repository deployment support

- `public/_headers` is copied by Vite to `dist/_headers` and sets basic browser security headers. Hashed Vite assets receive long-lived immutable caching. Stockfish resources receive a shorter cache lifetime so engine file updates do not remain stale for a year.
- There is intentionally no `_redirects` catch-all. Cloudflare Pages' default single-page-app fallback serves `index.html` when a project has no top-level `404.html`, while allowing real static files such as `/third-party-notices.html` to be served normally.
- `public/third-party-notices.html` and `public/stockfish/Copying.txt` must remain in the build output. They provide the notice/license information for the bundled Stockfish 19 Lite WASM engine.
- No Cloudflare token, account ID, or API secret is needed for Git-integrated Pages deployments. Do not put account tokens or secrets in repository files or Vite `VITE_*` variables.

## Release checks after deployment

Open the `*.pages.dev` URL in a fresh desktop browser and a mobile-sized viewport, then verify:

- The root page loads with no missing JS/CSS/WASM requests in DevTools.
- A demo profile completes the two-step setup, actual browser engine analysis, all result cards, and the scrollable training roadmap.
- A real public Chess.com profile can be loaded and analyzed; repeat with Lichess. Direct browser API calls can be affected by the external platform's network/CORS behavior, so verify this from the deployed origin instead of relying only on local tests.
- `/third-party-notices.html` and `/stockfish/Copying.txt` load directly.
- Response headers include `X-Content-Type-Options`, `Referrer-Policy`, `X-Frame-Options`, and the declared cache policy.
- Reloading the landing page and policy page works. If client-side routes are added later, re-check fallback behavior.
- Only after those checks pass, add the custom domain under Pages **Custom domains** and verify HTTPS and DNS.

## Local validation

Run the same core checks as CI, then inspect the deployable output:

```bash
bun install --frozen-lockfile
bun run lint
bun run test
bun run build
test -s dist/index.html
test -s dist/_headers
test -s dist/third-party-notices.html
test -s dist/stockfish/Copying.txt
```

The current CI runs these checks against the release candidate. This repository change prepares the project for Cloudflare Pages; it does not itself create the Cloudflare Pages project, set account-level settings, connect a custom domain, or deploy production without access to the owner's Cloudflare account.
