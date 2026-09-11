# BUILD.md — Phase 3 build plan (slices, in order)

Read after `agent/RUN.md`. This file governs **build runs** (Phase 3). Each slice must land as one or more green, pushed commits before the next slice starts. Never skip ahead. Keep `STATE.md` "Next run should" pointing at the exact next slice and sub-step. Consult `docs/02-design.md` for the *what* and *why*; this file is the *order*.

Facts already established (do not re-verify): the routine environment can reach npm (`esbuild 0.28.2` resolved) and can push to `main`. The interactive chat cannot push; it sends file bundles through the routine's fire payload.

## Budget for build runs

While `STATE.md` says Phase 3: a run may use **up to 45 minutes** of work, and the operator or the interactive session may fire the routine several times a day. Still one logical change per run, still push only on green, still stop and record on any budget overrun. Once `03-launch-readiness.md` exists, revert to the 10-minute operate budget in `agent/RUN.md`.

## Slice 1 — Extension skeleton and CI

- `extension/package.json`: `name: snapframe`, `displayName: "Snapframe — Code Screenshot"`, `publisher: snapframe`, `version: 0.0.1`, `pricing: "Trial"`, `license: "SEE LICENSE IN ../LICENSE"` (copy `LICENSE` into `extension/` at package time), `engines.vscode: "^1.90.0"`, categories `["Other", "Visualization"]`, keywords (≤30): screenshot, code screenshot, polacode, codesnap, carbon, snapcode, snippet, image, share code, social, png, svg, presentation, documentation, twitter, linkedin, slides, pull request, code image, ray.so. `repository`, `bugs` and `homepage` pointing at this GitHub repo. `icon: images/icon.png` (generate an original 256×256 PNG with a script — simple geometric mark, no text — commit the script too).
- Commands (contributes.commands + keybinding suggestions): `snapframe.capture` ("Snapframe: Capture Selection"), `snapframe.quickSnap` ("Snapframe: Quick Snap (last settings)"), `snapframe.enterLicence` ("Snapframe: Enter Licence Key"), `snapframe.buyPro` ("Snapframe: Buy Pro…"), `snapframe.openSettings`.
- Settings (contributes.configuration) for: background (colour/gradient), padding, shadow, corner radius, window controls, line numbers, title bar/file name, scale (1×/2×), default export folder, "copy to clipboard after export" (bool).
- TypeScript, bundled with esbuild to `dist/extension.js`; zero runtime dependencies. Dev deps only: `typescript`, `esbuild`, `@types/vscode`, `@types/node`, `@vscode/vsce`. Record each in `LICENSES.md` (dev-only, not bundled).
- Tests with `node:test` (no framework dependency): start with the licence module (Slice 3) stub and a smoke test that the bundle builds.
- CI: extend `.github/workflows/ci.yml` with an `extension` job (Node 22, `npm ci`, `npm run typecheck`, `npm test`, `npm run package` → upload the `.vsix` as an artifact). CI must be green before this slice is "done".
- `extension/README.md` is the marketplace listing text: what it does, the free/Pro table from the design, the honest AI-maintained sentence, privacy statement (zero network calls except the optional Buy Pro link and nothing collected), support = GitHub Issues with the "within a week" promise. `extension/CHANGELOG.md` starts at 0.0.1. Add `extension/telemetry.json` declaring no telemetry.

## Slice 2 — The capture pipeline (free tier)

- Implement the capture: run `editor.action.clipboardCopyWithSyntaxHighlightingAction`, then in the webview obtain the HTML via a paste event (`document.execCommand('paste')` in a contenteditable, reading `clipboardData.getData('text/html')`) — this is the technique the abandoned incumbents used and it yields the user's real theme colours and font. Restore the user's clipboard afterwards. Handle: no selection → whole file; de-indent common leading whitespace; soft-wrap at a configurable column; tabs → spaces per editor setting.
- Render in a webview panel beside the editor: frame (padding, background, shadow, radius), optional macOS-style window dots, optional title/file name, optional line numbers starting at the selection's first line. Live preview with the settings above; changes persist to settings.
- Export PNG at 1× and 2×: build an SVG with `<foreignObject>` around the highlighted HTML (SVG is the source of truth), rasterise via `Image` → `canvas` → `toBlob`. Save via `showSaveDialog` (default name `snapframe-<file>-<line>.png`). Copy-to-clipboard as an *image* via `navigator.clipboard.write([new ClipboardItem({'image/png': blob})])` inside the webview; if the platform refuses, fall back to saving the file and say so plainly in the status bar — never silently copy text.
- `snapframe.quickSnap`: capture + export with last settings, no panel.
- Acceptance: on Windows, macOS and Linux CI runners (Playwright headless Chromium standing in for the webview) the rendered SVG for a fixed fixture matches the stored golden PNG within a small pixel tolerance; the extension activates in < 200 ms (lazy-load the webview).

## Slice 3 — Licence verification (offline)

- Key format: `SNAP-<base64url(payload JSON)>.<base64url(64-byte Ed25519 signature)>`; payload `{ "p": "pro", "v": 1, "iat": <unix seconds>, "e": "<first 12 hex chars of sha256(lowercased email)>" }`.
- `extension/src/licence/verify.ts`: pure function `verifyKey(key, publicKeyRaw32): { ok, payload?, reason? }` using Node `crypto.verify(null, ...)` with an Ed25519 SPKI built from the raw 32-byte key. `publicKey.ts` holds the placeholder `REPLACE_AT_GATE_05` until the operator pastes the real public key; until then `isPro()` is false and tests use a test keypair generated in the test itself.
- `snapframe.enterLicence`: input box → verify → store in `context.secrets` → status bar "Snapframe Pro". Wrong key → clear message, no network.
- Tests: valid key, tampered payload, wrong key, malformed string, future `iat` tolerance.

## Slice 4 — Pro features (strictly additive, each behind `isPro()`)

In this order, each its own commit: SVG export → WebP/PDF export and transparent background → 3×/4× scale → named presets (JSON in globalState, import/export) → custom gradients/images and user caption → line highlight/focus-dim and callouts → **QR code in the image** (operator-approved addition, 2026-09-11: a small QR code placed in a corner of the frame, generated locally from a URL or text the user types — typically the repo, gist or docs link — drawn as vector squares so it stays sharp in SVG/PDF; QR encoding implemented in-house or via a tiny permissive dependency recorded in `LICENSES.md`; no network; record as D16 in `DECISIONS.md` when landed) → before/after and side-by-side layouts → terminal-selection capture → batch export and "copy as Markdown image link". The free tier must remain exactly as in Slice 2; add a test that asserts every free command works with `isPro() === false`. Also add the QR option to the Pro list in `extension/README.md` and `docs/02-design.md` §1 when it lands.

## Slice 5 — Licence Worker

- `worker/` with `wrangler.toml` (name `snapframe-licence`, KV binding `KEYS`, compatibility date current), TypeScript, no runtime deps beyond the Workers runtime.
- Routes: `GET /health` (mints and verifies a throwaway key with the configured signing key; 200/500), `GET /success?session_id=…` (verify with Stripe: `GET /v1/checkout/sessions/{id}` using `STRIPE_RESTRICTED_KEY`; require `payment_status === "paid"`; mint key bound to `customer_details.email`; store `KEYS[emailHash] = {key, sessionId, issuedAt, revoked:false}`; render a plain HTML page showing the key, the two-line activation instruction, and "bookmark this page"), `POST /webhook` (verify `Stripe-Signature` with `STRIPE_WEBHOOK_SECRET`; on `checkout.session.completed` mint if missing; on `charge.refunded` set `revoked:true`), `GET|POST /lost-key` (form: email + last 4 card digits → look up latest Stripe session by email via `GET /v1/checkout/sessions?customer_details[email]=…` and `GET /v1/payment_intents/{id}?expand[]=latest_charge` for `last4`; rate-limit 5/hour per IP via KV; show the key or a neutral "no match"), `GET /stats` (aggregate counts only: keys issued, revoked, last 7/30 days), `GET /buy` (302 to the Payment Link, so the extension never hard-codes it).
- Signing: `LICENCE_SIGNING_KEY` secret is the Ed25519 private key (PKCS8 base64); public half committed in the extension. A `scripts/generate-keypair.html` (single file, WebCrypto, no network) lets the operator generate the pair in the browser at gate-05 and copy each half to the right place.
- Tests: key minting/verification round-trip, webhook signature check with a fixed fixture, `/lost-key` rate limit. Use `vitest` + `@cloudflare/vitest-pool-workers` (dev-only; record in `LICENSES.md`).
- `.github/workflows/deploy-worker.yml`: on push to `main` touching `worker/`, run tests then `cloudflare/wrangler-action` with `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` — it will fail until gate-05 is cleared; that is expected and must not block the extension CI (separate workflow).

## Slice 6 — Gate files (write all, hand over one at a time)

`gates/gate-03-marketplace-publisher.md`, `gate-04-stripe-managed-payments.md`, `gate-05-cloudflare-and-signing-key.md`, `gate-06-open-vsx.md`, `gate-07-go-live.md`. Each: what, why, click-by-click, time, what to reply with (never a secret), what happens on "no". Follow the technical facts in `docs/02-research-notes.md` Part B (trusted publishing vs classic token; Stripe individual onboarding; Managed Payments toggle; restricted key permissions; Worker secrets page; wrangler-action token template). The interactive session hands them to the operator in order; the routine only writes them.

## Slice 7 — Publishing pipeline and metrics

- `.github/workflows/publish.yml`: on tag `v*`: build, test, package, publish to the VS Code Marketplace (`vsce publish --oidc` if trusted publishing is configured, else `VSCE_PAT`) and to Open VSX (`ovsx publish` with `OVSX_PAT`, skipped if the secret is absent). Dry-run mode (`workflow_dispatch` with `dry_run=true`) that only packages.
- `.github/workflows/metrics.yml`: daily, queries the marketplace `extensionquery` API for `snapframe.snapframe` and commits `metrics/marketplace.json` (installs, averagerating, ratingcount, updated). Skips gracefully before first publish.
- Better Stack monitor and the Worker `/health` are wired at gate-05 time (documented in gate-05).

## Slice 8 — Launch readiness

`docs/03-launch-readiness.md`: sandbox test transcript (Stripe test card → success page → key → extension activates Pro), CI green links, golden-image results, listing preview, checklist from `docs/00-master-prompt.md` §9, and the exact go-live steps for gate-07. Then set `STATE.md` phase to "Phase 3 complete — awaiting gate-07" and revert to the 10-minute operate budget.

## Always

- On the first build run, append to `DECISIONS.md`: `D14 | <date> | Build runs (Phase 3) may use up to 45 minutes and be fired several times a day; operate runs stay at 10 minutes | The master prompt's 10-minute cap is for the operate loop; applying it to the build would stretch a two-week build into months of fragments. Reverts automatically when 03-launch-readiness.md exists. | When Phase 3 ends`.
- Update `LICENSES.md` before adding any dependency, dev or runtime.
- Never commit a `.vsix`, `node_modules`, or anything from `.wrangler/`.
- If a slice cannot be finished within budget, land the smallest green sub-step and write the precise next sub-step in `STATE.md`.
- If the same failure repeats across three runs, stop, document it in `STATE.md` under "Stuck on", and pick the next independent slice.
