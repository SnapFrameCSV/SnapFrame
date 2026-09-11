# Gate 05 — Cloudflare deploy access, the KV store, and the licence signing key

- [ ] **Cleared** (ticked by the run once the Worker's `/health` returns 200 and the public key is committed)

**Time:** 10–15 minutes in two short parts · **What you'll reply with (part 1):** `gate 05 part 1 — account id <id> — KV id <id>` · **(part 2):** `gate 05 part 2 — public key <64 hex characters>` · **Never paste the private key or the API token into chat**

> **Order note:** this gate comes **before** gate 04 (Stripe), even though the design listed Stripe first. Stripe's Payment Link and webhook both need the Worker's web address, and the address only exists once the Worker is deployed here. (Decision D18.)

## What this is

The licence Worker is written and tested (`worker/`). It is the small free service that hands out Pro keys after a purchase and answers "I lost my key". To run it, Cloudflare needs: permission for GitHub Actions to deploy it, a tiny key-value store for issued keys, and the private signing key that makes the licence keys unforgeable. The private key is generated **in your browser** by a page from the repository and pasted **only** into Cloudflare. I never see it.

## Part 1 — Deploy access and the store (about 6 minutes)

1. Sign in at **https://dash.cloudflare.com** (your existing account).
2. **Account ID:** on the dashboard home, or under **Workers & Pages**, the right-hand column shows **Account ID**. Copy it — it is not secret, you'll reply with it.
3. **API token:** click your profile icon (top right) → **My Profile** → **API Tokens** → **Create Token** → find the template **"Edit Cloudflare Workers"** → **Use template** → leave the defaults (it may ask you to pick the account; pick yours) → **Continue to summary** → **Create Token**. Copy it — shown only once.
4. Open **https://github.com/SnapFrameCSV/snapframe/settings/secrets/actions** → **New repository secret** → Name `CLOUDFLARE_API_TOKEN` → paste → **Add secret**. Then **New repository secret** again → Name `CLOUDFLARE_ACCOUNT_ID` → paste the Account ID → **Add secret**.
5. **KV store:** back in Cloudflare → **Storage & Databases** → **KV** → **Create a namespace** → Name `snapframe-keys` → **Add**. The list now shows the namespace with an **ID** (a long hex string, not secret). Copy it.
6. Reply:

> gate 05 part 1 — account id `<paste>` — KV id `<paste>`

The next run writes the KV ID into `worker/wrangler.toml`, pushes, and the deploy workflow creates the Worker. Its address will look like `https://snapframe-licence.<something>.workers.dev`; the run records it in `OPERATIONS.md` and the reply to you includes it.

## Part 2 — The signing key (about 5 minutes, after the run confirms the Worker exists)

1. Open **https://github.com/SnapFrameCSV/snapframe/blob/main/worker/scripts/generate-keypair.html** → click **Raw** → press **Ctrl+S** (Cmd+S) to save the file → open the saved file in your browser (double-click it). It is a single page that makes no network requests.
2. Click **Generate key pair**. Two boxes appear.
3. **Box 1 (private key):** in Cloudflare → **Workers & Pages** → **snapframe-licence** → **Settings** → **Variables and Secrets** → **Add** → Type **Secret**, Variable name `LICENCE_SIGNING_KEY`, Value: paste box 1 → **Deploy**. Then close the generator page. Do not save box 1 anywhere else.
4. **Box 2 (public key, 64 characters):** copy it and reply:

> gate 05 part 2 — public key `<paste the 64 characters>`

5. **Optional, 3 minutes — the dead-man's switch:** so you hear about an outage even if the scheduled runs stop, create a free uptime check: **https://betterstack.com/uptime** → sign up (email) → **Monitors** → **Create monitor** → URL `https://<worker>/health`, check every **3 minutes**, alert by **email** to you. Nothing else to configure. If it ever emails you, forward the first line to the next weekly report; the run redeploys the last green build.

The public key is public by design — it is what the extension uses to check keys offline, and it will be committed to the repository in plain sight.

## What happens next

The run commits the public key into `extension/src/licence/publicKey.ts`, checks `https://<worker>/health` returns `{"ok":true}` (that proves the signing key works end to end), ticks this gate, and hands you gate 04 (Stripe), which needs the Worker address you now have.

## If you say no

Keys cannot be issued, so Pro cannot be sold. The free tier is unaffected: the extension could still launch as a free-only tool, which would mean the stream has no income and gets killed at the sunset review.
