# Gate 03 — Create the VS Code Marketplace publisher and let CI publish for it

- [ ] **Cleared** (ticked by the run once the reply below is in and the secret/policy is confirmed by a dry-run of `publish.yml`)

**Time:** 10–15 minutes · **What you'll reply with:** `gate 03 done — publisher <id> — trusted publishing` or `gate 03 done — publisher <id> — classic token` · **Never paste a token into chat**

## What this is

The extension is built and tested; nothing is published. To publish, the VS Code Marketplace needs a **publisher** (a named account that owns the listing) and a way for GitHub Actions to publish on its behalf. You create the publisher once. The publish itself is done by a workflow in the repository — never by me, never from a chat.

## Why now

Everything after this (the listing, the "Buy Pro" link, the go-live gate) needs the publisher ID to exist. It is the only marketplace step that requires a human.

## Step A — Sign in to the publisher portal (2 minutes)

1. Open **https://marketplace.visualstudio.com/manage** and sign in with a **Microsoft account**. Any personal Microsoft account works (Outlook/Hotmail/Xbox); if you don't have one, the sign-in page offers "Create one" — a free email-based account, no card.
2. If it asks you to create an **Azure DevOps organization** first, accept the defaults (any name). This is free and only exists to hold the publisher.

## Step B — Create the publisher (3 minutes)

1. Click **Create publisher**.
2. **ID:** `snapframe` (lower-case, permanent — it becomes part of the extension's identity). If the portal says the ID is taken, use `framecode`; if that is taken too, `snipframe`. Note which one you got.
3. **Name:** `Snapframe`.
4. Leave the rest blank (the listing's description, links and logo come from the extension package itself). Click **Create**.

## Step C — Let GitHub Actions publish (5–10 minutes)

The Marketplace is retiring the old personal access tokens on **1 December 2026** and replacing them with "trusted publishing", where the Marketplace trusts the GitHub repository directly. The portal may or may not show that option yet — do whichever applies:

**If the publisher page shows "Trusted publishing" (or "Trusted publishers" / "OIDC"):**
1. Open it, click **Add**, choose **GitHub**.
2. Repository owner `SnapFrameCSV`, repository `snapframe`, workflow file `publish.yml`, environment blank. Save.
3. Reply with **trusted publishing**. No secret is involved at all.

**Otherwise (classic token):**
1. Open **https://dev.azure.com** → click the profile icon (top right) → **Personal access tokens** → **New Token**.
2. Name `snapframe-publish`; **Organization: All accessible organizations**; **Expiration: custom, 30 November 2026** (the retirement date); **Scopes: Custom defined → show all scopes → Marketplace → tick "Manage"** and nothing else. Create.
3. Copy the token **once** — it is shown only now. Do not paste it anywhere except the next step.
4. Open **https://github.com/SnapFrameCSV/snapframe/settings/secrets/actions** → **New repository secret** → Name `VSCE_PAT` → Value: paste the token → **Add secret**. GitHub hides it from everyone, including me, from this point on.
5. Reply with **classic token**. Before 30 November 2026 the weekly report will remind you to switch to trusted publishing (by then the portal will have it).

## Step D — Reply

> gate 03 done — publisher `snapframe` — trusted publishing

(or `classic token`, and the publisher ID you actually got.)

## What happens next

The next run puts the publisher ID into the extension manifest, runs `publish.yml` in **dry-run mode** (it packages and checks credentials but publishes nothing), and ticks this gate if that is green. Nothing goes live until gate 07.

## If you say no

The extension can still be built, but it can never be installed by anyone. There is no other distribution channel worth having (Open VSX alone reaches Cursor/VSCodium users but not the VS Code majority). I'd report that the stream cannot launch.
