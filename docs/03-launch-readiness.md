# 03 — Launch readiness (Phase 3 → Gate 7)

**Prepared:** 11 September 2026 (Sydney) · **Status:** build complete; **three sections wait on the operator's gates** (marked ⏳). Gate 7 is not asked for until they are filled.

> **If you read nothing else:** everything in the design is built and tested — the free extension, every Pro feature, the licence system, the key-issuing service, the publishing pipeline and the metrics feed. What remains needs you: create the marketplace publisher (gate 03), the Cloudflare pieces (gate 05) and the Stripe account (gate 04), then make one US$0 test purchase. Each takes 10–25 minutes and comes with click-by-click instructions. After that, this page gets its last three sections and gate 07 asks a single yes.

---

## 1. What is built

| Piece | Where | State |
|---|---|---|
| Extension, free tier | `extension/` | Capture selection or whole file with the editor's real theme/font (clipboard-HTML capture), de-indent, tab expansion, soft-wrap, live preview with frame chrome (background/gradient, padding, shadow, corner radius, window dots, title bar, line numbers), PNG export at 1×/2× to a folder or a save dialog, copy-image-to-clipboard, Quick Snap, keyboard shortcuts, context-menu entry |
| Extension, Pro tier (behind `isPro()`) | `extension/` | SVG, WebP and lossless PDF export; transparent background; 3×/4× scale; named presets with JSON import/export; gradient angle and up to 8 stops; background image; caption/brand colour; line highlight, focus-dim and callouts; QR code (in-house encoder); before/after and side-by-side layouts; terminal-selection capture; batch export of all selections / all open editors; Markdown image link after export |
| Licence verification | `extension/src/licence/` | Offline Ed25519 check of `SNAP-…` keys, SecretStorage, status-bar item; public key is the gate-05 placeholder, so **no key can activate yet** |
| Licence Worker | `worker/` | `/health`, `/buy`, `/success`, `/webhook`, `/lost-key`, `/stats`; zero dependencies; deploy workflow ready, skips until gate 05 |
| Gates | `gates/gate-03…07` | Written; hand-over order 03 → 05 → 04 → 06 → 07 (D18) |
| Publishing | `.github/workflows/publish.yml` | Tag-driven publish to the VS Code Marketplace (+ Open VSX when configured); dry-run mode |
| Metrics | `.github/workflows/metrics.yml`, `scripts/marketplace-metrics.mjs` | Daily public-statistics snapshot to `metrics/marketplace.json` |
| Operating loop | `agent/RUN.md`, `agent/ROUTINE-PROMPT.md`, routine "Snapframe operate loop" | Proven on run 1; `STOP` file honoured before any action |

## 2. Test evidence

- **Extension:** 108 `node:test` cases — pure text transforms, frame SVG geometry for every setting, PNG/PDF writers, licence verification with a per-run key pair, Pro gating contracts (the free tier's formats, scales, backgrounds and its five commands are pinned so they can only widen), presets, QR encoder round-tripped through an independent decoder, and a **real-browser suite** (Playwright, headless Chromium) that drives the actual webview: paste-fallback, DOM-walk into styled runs, a full measure → SVG → export pipeline producing PNGs whose size and sampled pixels are asserted at 1× and 2×, WebP, PDF pixel hand-off, transparent background, background image, two-card comparison, quick-snap auto-export.
- **Worker:** 16 `node:test` cases — key minting verified by the extension's exact algorithm (interop), webhook signature check (including an RFC 4231 vector), every route with an in-memory KV and a fake Stripe (idempotent issue, refund revokes, lost-key match/no-match/rate limit, stats, error paths).
- **CI:** every push to `main` runs repo hygiene, the extension suite on **Ubuntu, Windows and macOS**, and the Worker suite. Latest green run at the time of writing: see §3.
- **Activation:** `activate()` registers commands and nothing else; measured under 10 ms in the test that loads the built bundle with a stubbed `vscode` (limit 200 ms).

## 3. CI and golden-image results

Golden-image acceptance (design §2, §7 item 1) is met by the browser suite running on all three operating systems in CI: the frame chrome is compared pixel-exactly (frame colour, card colour, window dot) and the text rows by presence, so a font-rendering difference between OSes cannot silently pass and cannot spuriously fail. Stored reference PNGs were deliberately not used — the frame is native SVG text, so a stored raster would only add a font-dependent comparison.

- Latest CI run on `main` (three-OS matrix + worker): https://github.com/SnapFrameCSV/SnapFrame/actions/runs/34594344655 (commit `27e2938`, all jobs green)
- Latest Deploy Worker run (tests green, deploy skipped until gate 05): https://github.com/SnapFrameCSV/SnapFrame/actions/runs/34594344497 (green; deploy step skipped as designed)
- Publish pipeline **dry run** (packages, checks credentials, publishes nothing): https://github.com/SnapFrameCSV/SnapFrame/actions/runs/34594895188 (green: tests, package, credential check — no Marketplace credential yet, as expected before gate 03)

## 4. Listing preview

What the marketplace page will show (all from `extension/package.json` and `extension/README.md`):

- **Name:** Snapframe — Code Screenshot · **Publisher:** `snapframe` (or the fallback from gate 03) · **Version:** 0.1.0 at launch · **Pricing:** Trial (free tier + paid key) · **Licence:** PolyForm Noncommercial 1.0.0 (in the package)
- **Description:** "Turn a code selection into a clean, shareable PNG that keeps your editor's real theme and font. No accounts, no telemetry, no network."
- **Categories:** Other, Visualization · **Keywords:** 20 (screenshot, code screenshot, polacode, codesnap, carbon, …)
- **Icon:** original 256×256 PNG (`extension/images/icon.png`, generated by `scripts/generate-icon.js`)
- **README sections:** how it works, Free vs Pro table, privacy (no network requests; the one exception is Buy Pro opening the browser), support via GitHub Issues within a week, the AI-built-and-maintained disclosure
- **Telemetry:** `telemetry.json` declares none

## 5. ⏳ Sandbox transcript (fills in after gates 05 and 04)

The operator's one test purchase, recorded here by the run that receives the gate-04 reply:

1. Open the **test** Payment Link → card `4242 4242 4242 4242`, any future expiry/CVC, a readable email → Stripe redirects to `https://<worker>/success?session_id=…` → the page shows a `SNAP-…` key.
2. In VS Code: **Snapframe: Enter Licence Key** → paste → status bar shows **Snapframe Pro**; Export SVG / WebP / PDF buttons appear in the preview.
3. Stripe dashboard → refund the test payment → the Worker's `charge.refunded` webhook marks the key revoked → `/success` for that session now shows the "refunded" page; `/lost-key` with the right email + last4 shows "no match".
4. `https://<worker>/health` → `{"ok":true}`; `/stats` → `{ issued: 1, revoked: 1, … }`.

Result: _pending_.

## 6. ⏳ Post-gate wiring (done by runs as each gate reply arrives)

| Gate reply | What the run changes | Verified by |
|---|---|---|
| 03 (publisher id, credential type) | `extension/package.json` `publisher` if not `snapframe`; repo variable `VSCE_TRUSTED_PUBLISHING` noted | `publish.yml` dry run green, credential check shows the chosen path |
| 05 part 1 (account id, KV id) | `worker/wrangler.toml` KV id | `deploy-worker.yml` deploys; Worker address recorded in `OPERATIONS.md` |
| 05 part 2 (public key) | `extension/src/licence/publicKey.ts` | `/health` → 200; extension test suite still green |
| 04 (account id, test link) | `wrangler.toml` `PAYMENT_LINK_URL` (test) | §5 transcript |
| 06 (optional) | nothing in code | dry run shows `OVSX_PAT present=true` |
| 07 (live link) | `PAYMENT_LINK_URL` (live); `buyPro` command opens `https://<worker>/buy`; version `0.1.0`; tag `v0.1.0` | Marketplace listing live; `/health` live |

## 7. Master-prompt §9 deliverables checklist

- [x] `01-assessment.md` (Gate 0 cleared with "A")
- [x] `02-design.md` (Gate 1 approved unchanged)
- [x] Proven scheduled loop (run 1: cloned, wrote `STATE.md`, pushed, notified)
- [x] Working repo with `README.md`, `OPERATIONS.md`, `STATE.md`, `LOG.md`, `DECISIONS.md`, `LICENSES.md`, `gates/`, tests, CI
- [ ] `03-launch-readiness.md` — this file; **sandbox results pending gates 03–05**
- [x] Scheduled operate loop configured and documented, `STOP` honoured (checked first on every run)
- [ ] First weekly report — due the first Sunday after go-live (or earlier if a gate is the only blocker)

## 8. Exact go-live steps (what gate 07 approves)

1. Operator replies `Gate 7 approved — live link …` after repeating the three Stripe steps in Live mode (gate-07 file).
2. Run: set `PAYMENT_LINK_URL` to the live link → push → `deploy-worker.yml` → `curl https://<worker>/health` must be 200 and `/buy` must 302 to the live link.
3. Run: switch `snapframe.buyPro` from its stub to `env.openExternal('https://<worker>/buy')`; set `extension/package.json` version `0.1.0`; CHANGELOG `0.1.0` entry; push; wait for CI green on all jobs.
4. Run: `git tag v0.1.0 && git push origin v0.1.0` → `publish.yml` → Marketplace (and Open VSX if gate 06). One deploy, that run's only deploy.
5. Run: record the listing URL in `OPERATIONS.md`, set `STATE.md` phase to "Phase 4 — Operate", switch the routine to the 10-minute operate budget, notify the operator with the listing link.
6. Roll-back path if anything is wrong within the first day: deactivate the Payment Link (operator, one click — a gate), publish `0.1.1` with `buyPro` back on its stub.

## 9. Known limitations, stated in the README's terms

- The exported frame draws text as native SVG text runs: per-token colour, bold and italic are kept; underline and background highlights from a theme are not.
- A tab character inside highlighted text would render as one space (VS Code's copy already expands tabs; the plain-text path expands them too).
- Pro keys are verified offline and not revoked on installed machines after a refund (design decision D06).
- Windows/macOS rendering is covered by CI's Chromium; the first real VS Code run on each OS happens at the operator's test purchase (§5).
