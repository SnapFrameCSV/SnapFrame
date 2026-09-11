# Gate 02b — Put the files on GitHub, and create the scheduled run with the repository attached

- [x] **Cleared** (ticked by the first scheduled run that reads this file from the repository) — cleared 2026-09-11 by the first scheduled routine run: repo was reachable (`GET /repos/SnapFrameCSV/snapframe` → 200), files present, push to `main` succeeded (re-verified by run 2 with `git ls-remote`).

**Time:** about 8–10 minutes · **What you'll reply with:** "gate 02b done" plus the first line of the notification you receive

## What this is

Gate 02 worked: GitHub is linked and the `snapframe` repository exists. But two things turned out to be true that I could only learn by trying:

1. This chat, and any scheduled run I create *from* this chat, are not attached to your repository. GitHub answers: *"GitHub access to this repository is not enabled for this session."* Only a scheduled run that you create in the Claude app **with the repository selected** gets that access. That selection is a dropdown in a form — no tokens, nothing pasted.
2. Because of (1), I cannot push the project files into the repository myself. You can, from GitHub's web page, by dragging a folder. No terminal, no git commands.

I've put the complete project folder on your computer at **Downloads → autonomous-income-agent → snapframe-upload**.

## Step A — Upload the files to GitHub (about 4 minutes)

1. Open **https://github.com/SnapFrameCSV/snapframe** in your browser (log in if asked).
2. On the empty-repository page, find the line *"…or upload an existing file"* — or go straight to **https://github.com/SnapFrameCSV/snapframe/upload/main**.
3. Open File Explorer at **Downloads\autonomous-income-agent\snapframe-upload**. Select **everything inside** that folder (click in the folder, press **Ctrl+A**) and **drag it all** onto the GitHub page's "Drag files here" box. Folders (`docs`, `agent`, `gates`, `scripts`, `reports`, `.github`) come along with their contents. Wait until the list of files stops growing — there should be about **20 files**.
4. In the box under "Commit changes", type: `Initial project files` and click **Commit changes**.
5. Refresh the repository page: you should see `README.md`, `STATE.md`, a `docs` folder and the others.

If `.github` doesn't appear in the upload list (some browsers skip folders that start with a dot), that's fine for now — I'll add it from a scheduled run.

## Step B — Create the scheduled run (about 4 minutes)

1. In the **Claude desktop app**, open the **Code** tab (left sidebar). Click **Routines** (it may be under **More**). Click **New routine**, and choose **Cloud** (not Local).
2. **Name:** `Snapframe operate loop`
3. **Instructions / prompt** — type exactly this one sentence:

   > Open the repository SnapFrameCSV/snapframe, read agent/ROUTINE-PROMPT.md, and follow it exactly.

4. **Repositories:** click the selector and choose **SnapFrameCSV/snapframe**. This is the step that matters.
5. **Environment:** leave **Default**.
6. **Trigger / schedule:** choose **Daily**, and set the time to **3:00 AM** (your local time — the app converts it).
7. **Connectors:** remove any that are listed; the routine needs none.
8. Click **Create**.
9. On the routine's page, click **Run now**. Within a few minutes you'll get a notification (and the run appears as a session you can open). Its first words will be **LOOP PROVEN** or **LOOP NOT PROVEN**.

## Step C — Reply

> gate 02b done — the notification said: *(paste its first line)*

## What happens next

If it says LOOP PROVEN, the operating loop is real: a scheduled run cloned the repository, wrote to it, pushed, and told you. From then on the daily run does the building, one small step at a time, and I only come back to you for the payment, marketplace and Cloudflare gates.

If it says LOOP NOT PROVEN, paste the sentence after it — it will say exactly what blocked it and I'll fix that before asking you for anything else.

## If you say no

Then there is no way for scheduled runs to reach the code, and the project cannot be operated unattended. I'd stop and say so in the final report.
