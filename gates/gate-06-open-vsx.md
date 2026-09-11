# Gate 06 — Open VSX publisher (optional: reaches Cursor, Windsurf and VSCodium users)

- [ ] **Cleared** (ticked by the run after a green dry-run of the Open VSX half of `publish.yml`, or marked skipped)

**Time:** about 10 minutes · **What you'll reply with:** `gate 06 done` or `gate 06 skip` · **Never paste the token into chat**

## What this is

The VS Code Marketplace (gate 03) reaches VS Code itself. Cursor, Windsurf, VSCodium and other VS Code-based editors install from **Open VSX** instead, a free registry run by the Eclipse Foundation. Publishing there too roughly doubles the audience for the same extension. It is optional; the extension works without it.

## Steps

1. Open **https://open-vsx.org** → **Log in** (top right) → **GitHub** → authorise. Use the same GitHub account as the repository (`SnapFrameCSV`).
2. You'll be asked to **sign the Eclipse Foundation Publisher Agreement**: it sends you to accounts.eclipse.org → create a free Eclipse account (name, email, password) → in that account's profile, under **Edit Profile** → **Social Media Links**, add your **GitHub username** (`SnapFrameCSV`) → back on open-vsx.org, click **Sign Publisher Agreement** → read and agree. (The GitHub link is what ties the agreement to your Open VSX login.)
3. On open-vsx.org → profile icon → **Settings** → **Access Tokens** → **Generate New Token** → description `snapframe-publish` → **Generate** → copy it (shown once).
4. Open **https://github.com/SnapFrameCSV/snapframe/settings/secrets/actions** → **New repository secret** → Name `OVSX_PAT` → paste → **Add secret**.
5. Reply:

> gate 06 done

The publish workflow creates the `snapframe` namespace on Open VSX itself on the first publish (`ovsx create-namespace`), so there is nothing else to click.

## If you say skip

Nothing breaks. `publish.yml` publishes to the VS Code Marketplace only and skips Open VSX when the `OVSX_PAT` secret is absent. The README's "works in Cursor, VSCodium" line is softened to "install the `.vsix` from the GitHub release". You can do this gate any time later.
