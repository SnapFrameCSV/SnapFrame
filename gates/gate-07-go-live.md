# Gate 07 — Go live

- [ ] **Cleared** (ticked by the run after the first live publish and a successful live `/health`)

**Time:** 15 minutes (5 to read, 10 to switch Stripe to live) · **What you'll reply with:** `Gate 7 approved — live link https://buy.stripe.com/…` · **Never paste an API key or webhook secret into chat**

## What this is

Everything has been built, tested and rehearsed in Stripe's test mode. This gate is the one irreversible step: publish the extension for real and start taking real payments. You read the readiness report, repeat three Stripe steps in **Live mode**, and say the word.

## Step A — Read the readiness report (5 minutes)

Open **`docs/03-launch-readiness.md`** in the repository. It contains: the sandbox transcript (test purchase → success page → key → extension shows "Snapframe Pro" → refund → key revoked), the green CI links on three operating systems, the golden-image results, a preview of the marketplace listing, and the checklist from the master prompt. If anything in it looks wrong, say so instead of approving — nothing happens until you approve.

## Step B — Switch Stripe to Live mode (10 minutes)

Test-mode objects (the link, the restricted key, the webhook) do not exist in live mode; you make the live versions once. Turn **Test mode off** (toggle, top right), then repeat from gate 04:

1. **Product and Payment Link** (gate 04, step C): the `Snapframe Pro` product may already exist in live mode (Stripe copies the catalogue); create the **Payment Link** with Managed Payments **on**, Adaptive Pricing **on**, and the redirect `https://<worker>/success?session_id={CHECKOUT_SESSION_ID}`. Copy the **live** link (`https://buy.stripe.com/…` without `test_`).
2. **Restricted key** (gate 04, step D1–D2): create a live restricted key with the same three Read permissions and **replace** the value of the Worker secret `STRIPE_RESTRICTED_KEY` in Cloudflare (Settings → Variables and Secrets → edit → Deploy).
3. **Webhook** (gate 04, step D3–D4): add the live endpoint `https://<worker>/webhook` with `checkout.session.completed` and `charge.refunded`, reveal its signing secret and **replace** the Worker secret `STRIPE_WEBHOOK_SECRET`.
4. Check Managed Payments shows **Enabled** (Settings → Payments → Managed Payments) — if it still says "under review", stop here and reply with that instead; the run waits.

## Step C — Reply

> Gate 7 approved — live link `https://buy.stripe.com/…`

## What happens next, on the very next run

1. The live Payment Link goes into the Worker's settings (`/buy` starts redirecting there) and the Worker redeploys.
2. `https://<worker>/health` is checked live.
3. The extension's **Buy Pro…** command is switched from its "not available" message to opening `https://<worker>/buy`, the version becomes `0.1.0`, the tag `v0.1.0` is pushed, and `publish.yml` publishes to the VS Code Marketplace (and Open VSX if gate 06 was done). The listing appears within minutes to an hour.
4. Daily runs begin the operate loop: metrics, issues, one small improvement, and the Sunday report ending keep / watch / pivot / kill.

## If you say no

Nothing is published and nothing is charged; the repository stays as it is. Say what needs changing and it becomes the next run's work, or say "stop" and the project is parked at zero cost — there is nothing to cancel.
