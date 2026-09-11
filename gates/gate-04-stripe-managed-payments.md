# Gate 04 — Stripe account, Managed Payments, the Payment Link, and the Worker's Stripe secrets

- [ ] **Cleared** (ticked by the run once a sandbox purchase produces a key end to end)

**Time:** 20–25 minutes · **What you'll reply with:** `gate 04 done — account acct_… — test link https://buy.stripe.com/test_…` · **Never paste an API key or webhook secret into chat**

> Do gate 05 first — its reply tells you the Worker address (`https://snapframe-licence.<something>.workers.dev`), which steps C and D below need. Where this file says `<worker>` use that address.

## What this is

Stripe sells the Pro key: it takes the card, works out the buyer's tax, sends the receipt, handles refunds and disputes, and — with **Managed Payments** switched on — is legally the seller, so none of that lands on you. You create the account, switch Managed Payments on, make the one-off US$9 Payment Link, and give the Worker read-only access so it can confirm a payment before issuing a key.

Everything in this gate is done in Stripe's **Test mode** first (the toggle top-right of the dashboard). Real cards are not involved. Switching to live mode is gate 07.

## Step A — Create the account (5–8 minutes)

1. Go to **https://dashboard.stripe.com/register** → email, name, password → verify the email.
2. **Activate** the account (the dashboard prompts "Activate payments"): country **Australia**; business type **Individual / sole trader**; your legal name, date of birth, home address; **bank account** for payouts (BSB + account number); accept the terms. Stripe may ask for ID; that is normal and stays with Stripe.
3. **Public details** (Settings → Business → Public details): business name **Snapframe**; support email — your address (or an alias you prefer; it must be one you can read, Stripe uses it for escalations); website — `https://github.com/SnapFrameCSV/snapframe` (Stripe accepts an app or profile page in place of a website).
4. **Copy the account ID**: Settings → Business → Account details shows `acct_…`. It is not secret; you'll reply with it.

## Step B — Switch on Managed Payments (3 minutes)

1. **Settings** → **Payments** → **Managed Payments** (if you can't find it, search "Managed Payments" in the dashboard search box) → **Enable** → read and accept its terms.
2. Stripe runs an eligibility review (business type and location; Australia is supported since April 2026). Usually immediate; if it says "under review", carry on with the steps below — they do not depend on the review finishing, and the run will notice when it does.

## Step C — The product and the Payment Link, in Test mode (5 minutes)

1. Turn on **Test mode** (toggle at the top right of the dashboard).
2. **Product catalogue** → **Add product**: Name `Snapframe Pro`; Description `One-off licence key for Snapframe Pro (VS Code extension). Verified offline; works on up to three machines.`; **Tax code**: search and pick **"Downloadable Software – personal use"** (`txcd_10202000`); Price **US$ 9.00**, **One-off**. Save.
3. **Payment Links** → **Create** (or **+ New**) → select the `Snapframe Pro` product.
   - **Managed Payments**: on (this must be set now — it can't be changed on a link later).
   - **Adaptive Pricing**: on (buyers see their own currency).
   - **After payment** → **Don't show confirmation page** → **Redirect customers to your website** → URL:
     `https://<worker>/success?session_id={CHECKOUT_SESSION_ID}`
     (type it exactly, including the curly braces — Stripe fills that part in).
   - Leave everything else default. **Create link**.
4. Copy the link URL — it starts `https://buy.stripe.com/test_…`. Not secret; you'll reply with it.

## Step D — Give the Worker read-only access and the webhook (5 minutes, still in Test mode)

1. **Restricted key:** **Developers** (bottom-left, or the `</>` icon) → **API keys** → **Create restricted key** → Name `snapframe-worker`. Set **exactly three** permissions to **Read** and leave every other row on **None**: **Checkout Sessions**, **Charges**, **PaymentIntents**. **Create key** → **Reveal** → copy.
2. In Cloudflare → **Workers & Pages** → **snapframe-licence** → **Settings** → **Variables and Secrets** → **Add** → Type **Secret**, name `STRIPE_RESTRICTED_KEY`, value: paste → **Deploy**.
3. **Webhook:** back in Stripe **Developers** → **Webhooks** → **Add endpoint** (or **Add destination**) → Endpoint URL `https://<worker>/webhook` → **Select events**: tick **`checkout.session.completed`** and **`charge.refunded`** → **Add endpoint**. On the endpoint's page click **Reveal** under *Signing secret* → copy.
4. In Cloudflare, same page as step 2 → **Add** → Secret `STRIPE_WEBHOOK_SECRET`, value: paste → **Deploy**.

## Step E — Reply

> gate 04 done — account `acct_…` — test link `https://buy.stripe.com/test_…`

## What happens next

The run puts the test link into the Worker's settings, opens the test link itself is not possible from the sandbox, so it asks you for **one test purchase** on the next report: open the test link, card `4242 4242 4242 4242`, any future expiry, any CVC, any email you can read. You land on the Worker's success page showing a key. Paste that key into VS Code (**Snapframe: Enter Licence Key**) — the status bar shows **Snapframe Pro**. That transcript goes into `docs/03-launch-readiness.md` and this gate is ticked. Refunding the test payment in the dashboard exercises the revoke path too.

## If you say no

No payments, so no Pro sales. Fallback per the design: **Polar.sh** (gate 04b), which handles the same flow with its own hosted checkout and keys; the Worker's `/success` and `/webhook` would be re-pointed at Polar's API. If Polar is also a no, the extension ships free-only and the stream is killed at the sunset review.
