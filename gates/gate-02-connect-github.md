# Gate 02 — Connect GitHub to Claude, and create the empty repository

- [ ] **Cleared** (I tick this when you reply)

**Time:** about 5–7 minutes · **What you'll reply with:** "gate 02 done" plus your GitHub username (not a secret)

## What this is

Right now, when I try to reach GitHub from the cloud, GitHub answers: *"No linked GitHub account. Connect your GitHub account and retry."* Claude's cloud sessions get GitHub access through a one-time authorisation you do in your browser — an "Authorize" button, not a password or token. Once it's done, every scheduled run can clone and push the Snapframe repository on its own, and you never paste anything into chat.

I also need an empty repository to push into. Creating it takes a minute.

## Why it matters

This is the first and only thing the whole operating loop depends on. Until it works, nothing else is worth building — a product with no way to maintain it is exactly what the design forbids.

## Step A — Authorise GitHub (one time)

1. In your browser, go to **https://claude.ai/code** and sign in with your usual Claude account (the same one you use for this chat).
2. If the first screen offers to install a desktop app, click **Continue on web** at the bottom.
3. The page will prompt you to connect GitHub. Click the **Sign in with GitHub** (or "Connect GitHub") button.
4. GitHub opens an authorisation page for the "Claude" app. Click **Authorize**. If GitHub asks you to log in first, log in with your normal GitHub account (the one you told me is verified).
5. You'll be returned to claude.ai. If it then asks whether to *install the Claude GitHub App on your repositories*, you can click **Skip** — it isn't needed for this project. (Installing it is harmless too.)
6. If it mentions creating a **Default** environment, accept the defaults. You don't need to change anything.

That's it for Step A. You should now see a page where you could pick a repository — you don't need to pick one.

## Step B — Create the empty repository

1. Go to **https://github.com/new**
2. **Repository name:** `snapframe`
3. **Public** (leave it selected — the design uses public Issues as the support channel).
4. Leave **Add a README**, **.gitignore** and **licence** all *unchecked*. It must be completely empty.
5. Click **Create repository**.

## Step C — Reply

Reply in this chat with:

> gate 02 done — my GitHub username is `yourname`

Your username is public information (it's in the address of every repository you own), so it's fine to share.

## What happens next

I'll push the repository (documents, runbook, licence), create the daily scheduled run, and fire it once. If the run can clone, write a line, push and notify you, the loop is proven and I move on to the real build. **A card may appear in this chat asking you to approve the scheduled task — please approve it.** That's part of this gate, not a new one.

## If you say no

Then there is no way for scheduled runs to reach the code, which means no unattended maintenance, which means the project cannot be operated the way you asked. I'd stop here and say so in the final report rather than work around it.
