# Snapframe licence Worker

A Cloudflare Worker (free plan, Workers + KV only — D07) that turns a paid Stripe checkout into an offline-verifiable Pro key. It holds the only copy of the signing private key; the extension holds the public half and never calls this Worker after purchase (D06).

| Route | What it does |
|---|---|
| `GET /health` | Mints and verifies a throwaway key with the configured signing key; 200 or 500. Polled by Better Stack and every scheduled run. |
| `GET /buy` | 302 to the Stripe Payment Link, so the extension never hard-codes it. |
| `GET /success?session_id=cs_…` | Stripe's post-checkout redirect. Verifies `payment_status = paid` with the read-only key, mints the key if the email has none yet, stores it, shows it. Safe to reload. |
| `POST /webhook` | Stripe events, signature-checked. `checkout.session.completed` mints if missing (the source of truth if the buyer closed the tab); `charge.refunded` marks the key revoked so `/lost-key` and `/success` stop showing it. |
| `GET`/`POST /lost-key` | Email + last 4 card digits → the key, or a neutral "no match". 5 attempts per hour per IP (KV counter). |
| `GET /stats` | `{ issued, revoked, last7, last30 }` — counts only, no personal data. Read by the weekly run. |

KV layout: `key:<emailHash>` → `{ key, sessionId, issuedAt, revoked }`; `session:<cs_id>` → emailHash; `rl:<ip>:<hour>` → attempt count (1 h TTL). `emailHash` is the first 12 hex chars of SHA-256 of the lower-cased email — the same value the key's payload carries.

Secrets, by name (values live only in the Cloudflare dashboard): `STRIPE_RESTRICTED_KEY`, `STRIPE_WEBHOOK_SECRET`, `LICENCE_SIGNING_KEY`. Generate the signing pair with `scripts/generate-keypair.html` (opens from disk, no network).

Deploy: `.github/workflows/deploy-worker.yml` runs the tests and `wrangler deploy` on every push to `main` that touches `worker/`, once `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` exist in GitHub Actions secrets (gate-05); until then the deploy step is skipped, not failed.

Tests: `npm test` (`node:test`, no Workers runtime needed — routes take an injected KV store, `fetch` and clock; WebCrypto is the same API in Node 22 and Workers).
