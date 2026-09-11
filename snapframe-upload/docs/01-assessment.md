# 01 — Assessment (Phase 1) · Gate 0

**Prepared:** Friday 11 September 2026 (Sydney) · **Operator:** Hayden · **Status:** STOPPED at Gate 0, awaiting your choice.

> **If you read nothing else:** Under your constraints ($0, no audience, no outreach, nothing that depends on you), every legitimate option I found sits in the **$0–$50 per month** band at month 12, and most are effectively $0. One option has a *plausible* path above pocket change — roughly a one-in-four chance — and costs you about an hour of one-off admin. The honest expected value is a few dollars a month. You told me you accept a 60% chance of nothing; the real number for the best option is closer to **75%**. Section 6 gives you three ways to reply.

---

## 1. Inventory (what we are actually starting with)

In plain terms: you have verified accounts with GitHub and Cloudflare (both useful) plus Vercel and Supabase (both turn out to be unusable for this — see below). You have no way to receive money yet, no audience anywhere, no existing content or code, no skills you want to contribute, and no money to put in. Your home PC cannot be relied on, so everything must live in the cloud on free tiers. You will give this fifteen minutes a week, mostly reading a report, and will only answer yes/no questions.

This is a pure build-from-zero. The two things that normally make a small online product work — someone with taste choosing what to build, and someone telling people it exists — are both absent by design. That is the single biggest reason the numbers below are small. Production is cheap now; distribution is not, and the rules forbid buying or spamming it.

Two of your verified accounts are disqualified by their own terms: **Vercel's free (Hobby) plan is "restricted to non-commercial personal use only"** — any payment request on the site breaches it — and **GitHub Pages "is not intended for or allowed to be used as a free web-hosting service to run your online business"**. **Supabase's free tier pauses projects after 7 days of low activity** and needs a human click to resume, which breaks the "30 days with zero runs" rule. **Cloudflare** is the opposite: Workers, Pages, D1 and KV have no commercial-use restriction, no inactivity pausing, and generous daily limits, so it becomes the whole hosting stack.

### Assumptions I made (you did not have to answer anything)

- Gate 0 is the only question until the design; I did not ask about product ideas or names.
- Anything with a listing fee, developer fee or domain purchase — even $1 — is treated as a capital gate, exactly as your config says.
- "Unattended" means no human review SLA. Platforms that require a response within N days are scored down even if the product itself is automated.
- A merchant-of-record (a company that legally sells on your behalf and handles tax, receipts, disputes) is preferred over raw payment processing, because it removes most of the admin you don't want.
- The product runs on Cloudflare's free tier; the scheduled agent runs in Claude's cloud; the repo is the memory. If any of those fail, nothing you do fixes it — the design must assume that.
- Your legal name appears only where a platform or the law requires it (payment provider, tax). Everything customer-facing uses a brand name.

---

## 2. What changed since the prompt was written (verified this week)

These matter because they overturn common advice:

- **Stripe now runs its own merchant-of-record service ("Managed Payments") and it went live for Australia in April 2026.** Payouts to an Australian bank are free, there is effectively no minimum, and Stripe's own AI-service tax codes are eligible. All-in cost ≈ 5.9% + A$0.30 per domestic sale. Whether an *individual* (not a company) passes its eligibility review is undocumented — it's a toggle on a free account, so we simply try it first.
- **Lemon Squeezy** (the usual recommendation) still works but its owner, Stripe, is steering everyone to Managed Payments and support has slowed. Treat as legacy.
- **Gumroad now explicitly prohibits "AI services"** (tools, chatbots, generation) — it still allows AI-made files, but its 10% + $0.50 fee, AI-moderation bans and 1.4/5 seller rating make it a poor home.
- **Paddle** now onboards sole traders without business documents and pays AUD free, but it needs a live website with terms/refund/privacy pages to approve you, pays monthly with a **$100 minimum**, and its AI reviews run 1–3 weeks.
- **Polar.sh** (built for developer tools, native licence keys, Australia supported) costs 5% + 50¢ for new accounts plus small payout fees. A solid fallback rail.
- **Google's August 2026 spam update** names "using generative AI tools to generate many pages" as scaled-content abuse; the documented 2026 case studies of AI/programmatic sites all show losses. Niche sites are dead for this profile.
- **Shutterstock bans AI images outright; Adobe Stock accepts them if labelled** (max 3 similar variations, 33% royalty, $25 PayPal minimum).
- **Discord paid apps are US/UK/EU only. Upwork bans automation. beehiiv's free plan cannot take payments at all. Chrome Web Store costs $5 once, and the median extension has 18 users.**

---

## 3. Candidates and scoring

Scores are 1 (bad) to 5 (good). "Downside" is scored so that 5 = very little can go wrong. Justifications are one line each; full sourcing is in `01-research-notes.md`.

| # | Candidate | Capital | Human gates | Automation ceiling | Buildable alone | Time to first $ | Durability | Defensibility | Downside | Total |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | **Developer-tool extension with a paid tier** (VS Code Marketplace + Open VSX, licence key sold via Stripe Managed Payments, tiny licence check on Cloudflare) | 5 — $0 to publish, $0 hosting, Stripe-hosted checkout needs no domain | 3 — ~6 one-off gates, ~1 hour total | 4 — CI publishing is officially supported; MoR handles receipts/disputes; only manual step is reading reviews | 4 — small, testable code; marketplace gives built-in search | 2 — 3–6 months realistic | 4 — marketplace is stable; Stripe is Stripe; nothing pauses | 2 — free alternatives exist for almost any utility | 4 — worst case is a dead listing and a closed Stripe account | **28** |
| 2 | Micro-SaaS web utility with paid tier (Cloudflare Pages/Workers + D1, Stripe MP) | 4 — free, but a domain (~A$2–15/yr) is a gate for credibility and email | 3 — same gates plus domain | 4 — same rail; support via contact form → GitHub issue | 3 — more surface area (auth, data, Privacy Act) | 2 — SEO for a new site is 6–12 months | 4 — no pausing on Cloudflare | 2 — "ten identical things a search away" | 4 | **26** |
| 3 | AI stock images on Adobe Stock (generated free with Cloudflare Workers AI, labelled as AI) | 5 — Workers AI gives 10,000 free "neurons"/day ≈ 170 images | 4 — Adobe contributor account + tax form + PayPal, then nothing | 4 — generate/keyword/upload is scriptable; Adobe does all selling | 3 — needs 4-megapixel output (upscaling) and Adobe's reviewers reject freely; "max 3 similar" rule | 3 — first licence could come in weeks; $25 payout floor may take a year | 2 — Adobe can change AI policy overnight (Shutterstock already banned it) | 1 — millions of AI images already there | 4 — account closure is the worst case | **26** |
| 4 | Open-source project + GitHub Sponsors | 5 | 2 — Sponsors eligibility review + Stripe | 5 | 4 | 1 | 4 | 1 | 5 | 27 — but only 33% of enrolled developers *ever* receive a sponsor; EV ≈ $0 |
| 5 | Digital products (templates/spreadsheets) on Gumroad or Notion Marketplace | 5 | 3 — Gumroad ID verification or Notion's months-long waitlist | 4 | 3 — AI-made templates with no human taste are exactly what buyers skip | 2 | 3 | 1 | 4 | 25 |
| 6 | Chrome extension + ExtensionPay | 3 — $5 developer fee is a capital gate | 3 | 3 — every update goes through human review; new devs get extra scrutiny | 4 | 2 | 3 | 2 | 4 | 24 |
| 7 | JetBrains Marketplace paid plugin (native billing, 15%) | 5 | 3 | 2 — developer must respond to critical issues within 2 business days; $200 payout floor | 3 | 2 | 3 | 2 | 4 | 24 |
| 8 | Paid API on RapidAPI (25% fee, PayPal only) or sold direct | 4 | 3 | 4 | 4 | 2 | 2 — Nokia is steering RapidAPI toward telecom | 1 | 4 | 24 |
| 9 | Print-on-demand (Redbubble/TeePublic/Printful+Etsy) | 4 — Etsy charges per listing | 3 — Etsy needs photo ID + selfie | 3 | 3 | 2 | 2 | 1 | 4 | 22 |
| 10 | Newsletter (Substack; beehiiv free tier cannot take payments) | 5 | 2 | 2 — writing is the product; no growth engine without outreach | 2 | 1 | 2 | 1 | 4 | 19 |
| 11 | Niche informational/affiliate site | 2 — domain + 6–18 months | 3 | 3 | 2 | 1 | 1 — Google is targeting this by name | 1 | 3 — Amazon Associates AU cancels you permanently if no sales in 180 days | 16 |

**Excluded before scoring** (your hard-nos or platform rules): anything crypto (Telegram Stars pays out via crypto), Discord apps (Australia not supported), Upwork/Fiverr automation (deceptive or banned), scraped or repackaged content, mass outreach of any kind, Vercel Hobby and GitHub Pages for commerce.

### Expected value — show your working

"P(any)" is my honest probability of the stream earning *anything* within 12 months. Income figures are what it would earn *if* it earns, in Australian dollars per month.

| Candidate | P(any) | Month 6 if it works | Month 12 if it works | EV at month 12 |
|---|---|---|---|---|
| 1. Dev-tool extension, paid tier | 25% | $0–15 | $10–60 (mid $25) | **≈ $6/month** |
| 2. Micro-SaaS web utility | 15% | $0–10 | $10–80 (mid $30) | ≈ $5/month |
| 3. Adobe Stock AI images | 50% earn *something*; 30% reach the $25 payout | $1–10 | $3–30 (mid $12) | ≈ $6/month (much of it stuck below the payout floor) |
| 6. Chrome extension | 20% | $0–10 | $10–50 | ≈ $5/month, minus $5 fee |
| 5. Digital products | 15% | $0–10 | $5–30 | ≈ $3/month |
| 7. JetBrains plugin | 15% | $0 (below $200 floor) | $20–80 | cash-out ≈ $0 in year one |
| 8. Paid API | 10% | $0–10 | $10–40 | ≈ $2/month |
| 4. OSS sponsorship | 5% | $0 | $5–20 | ≈ $1/month |
| 9. POD / 10. Newsletter / 11. Niche site | 5–10% | $0 | $0–20 | ≈ $0–1/month |

None of these is a living. None clears "more than pocket change" with confidence. What they share is that the *downside* is also close to zero — an hour of your time and some cloud free-tier usage.

---

## 4. Shortlist

**1st — Developer-tool extension with a paid tier (recommended primary).** A small, genuinely useful VS Code extension (also published to Open VSX so Cursor and VSCodium users find it), free to use with a "Pro" feature unlocked by a licence key. The key is sold through Stripe Managed Payments (Stripe is the legal seller, sends receipts, handles refunds and disputes, and pays your bank for free); if Stripe's review declines an individual account, Polar.sh does the same job for 5% + 50¢. A tiny Cloudflare Worker checks licence keys and costs nothing. This wins because it is the only model where every piece is $0 *and* unrestricted *and* has a built-in search engine full of the right buyers (developers open the marketplace looking for tools), and because automated publishing from CI is explicitly supported by Microsoft, so the agent can ship updates unattended. The marketplace terms even contemplate "bring-your-own-licence" offerings. The weakness is the same as everyone's: there are tens of thousands of extensions, most utilities have a free rival, and I have no evidence that a solo, unmarketed extension earns anything. Product choice happens in Phase 2 from actual marketplace search demand, not from a whim.

**2nd — AI stock images on Adobe Stock (recommended fallback).** Adobe officially accepts generative-AI images if labelled, and Cloudflare's free Workers AI can generate roughly 170 images a day for nothing (they'd need upscaling to Adobe's 4-megapixel minimum). After two one-off gates (Adobe contributor account with tax form; PayPal) the whole pipeline — generate, keyword, upload via CSV, submit — is scriptable and Adobe does all selling. It's the fallback rather than primary because the royalty is cents per licence, the $25 payout floor could take a year to reach, Adobe's reviewers reject AI work liberally and cap similar variations at three, and the policy could flip the way Shutterstock's did. It's a different kind of bet from #1 (volume of tiny sales vs. a few real ones), which is what a fallback should be.

**3rd — Micro-SaaS web utility.** Same rail and hosting as #1, but on the open web instead of a marketplace. Slower (search rankings for a new site take 6–12 months) and needs a domain to look legitimate and to receive email, which is a capital gate. It's the natural *second* product if #1 works, sharing the same Stripe account and Worker — not something to run in parallel.

**Do-not-start is a legitimate answer here.** If you want a real chance at more than pocket change, one of three things has to change: (a) a budget of roughly **A$20–30 a year** (a domain plus the Chrome developer fee) — this roughly doubles the options; (b) permission for me to submit the product, with your approval each time, to a handful of legitimate launch directories and forums where self-promotion is explicitly allowed (Product Hunt, relevant subreddits' "show your work" threads) — this is the cheapest lever on the distribution problem and isn't mass outreach, but it does mean the product is publicly attached to a person; or (c) one thing only you can provide — a hobby or job domain where you know what's annoying, so the product solves a real problem instead of a guessed one.

---

## 5. Human gates the primary option will need (in order)

Each is a single yes/no or a five-to-twenty-minute click-through with instructions written for a non-technical person. You never paste a secret into chat; anything secret goes into the platform's own dashboard.

| # | Gate | What you do | Time |
|---|---|---|---|
| 0 | **Choose** (this document) | Reply with A, B, or C from Section 6 | 2 min |
| 1 | **Approve the design and the product** (`02-design.md`) — the offer, the name, the price | Read one page, reply yes/no | 5 min |
| 2 | **Let the scheduled agent reach GitHub** — the runs need to clone and push the repo. Preferred path: connect GitHub to Claude via its connector (an "Authorize" button, no token pasted). If that's unavailable, you create a fine-grained token in GitHub and store it where the run can read it — instructions will be in the gate file | Click authorise | 5 min |
| 3 | **Marketplace publisher account** — a Microsoft/Azure DevOps account and a publisher named after the brand; you create one publishing token and paste it into GitHub Actions secrets (not to me). Note: Microsoft retires these tokens on 1 Dec 2026 for a newer sign-in method; the gate file will use whichever applies | Follow ~8 steps | 10–15 min |
| 4 | **Stripe account (individual/sole trader) + turn on Managed Payments** — name, date of birth, address, BSB/account, accept Stripe's terms; then flip one toggle. Reply with your account ID (not secret). If Stripe declines Managed Payments for an individual, the same gate re-issues for Polar.sh (ID + selfie via Stripe, review up to 14 days) | Follow ~10 steps | 15–20 min |
| 5 | **Cloudflare deploy token** — you create an API token in your existing Cloudflare account and paste it into GitHub Actions secrets | Follow ~5 steps | 5 min |
| 6 | **Open VSX publisher** (optional, extends reach to Cursor/VSCodium) — Eclipse account, sign the publisher agreement, token into GitHub secrets | Follow ~6 steps | 10 min |
| 7 | **Go live** (`03-launch-readiness.md`) — after a sandbox test, you approve switching payments from test to live and publishing the listing | Read one page, reply yes | 5 min |
| — | **When the first dollar arrives** — I'll flag it plainly: income is assessable, an ABN is free but not required by any of these platforms, GST only applies at $75k turnover; please confirm the hobby-vs-business question with an accountant. Not a gate for me, a reminder for you | — | — |
| ↻ | **Weekly** — read the Sunday report (under 200 words) and answer at most one question | ≤ 5 min/week |

One-off total: about **60–75 minutes** spread over the first few weeks. A "no" at gates 3–5 means the stream cannot launch, and I'll say so rather than route around it.

### `public_identity` — recommendation

**Default it to a brand name.** The marketplace publisher, the extension, the checkout page and the support contact all carry the brand. Your legal name appears only on the Stripe account (required by law and by Stripe). With Stripe Managed Payments, receipts and invoices are issued "Sold through Link" (Stripe's own entity) and show the brand's public business name — so the customer sees the brand and Stripe, not you. Under Australian Consumer Law, the entity selling must be identifiable to the buyer; with a merchant of record that entity is Stripe/Link, which satisfies it. I'll propose the actual name at Gate 1. If you'd rather your own name were on it, say so in your reply.

---

## 6. Your reply (Gate 0)

Reply with one letter, optionally with a note:

- **A — "Go with your recommendation."** I proceed to Phase 2 with candidate #1 (dev-tool extension, Stripe Managed Payments, Cloudflare) as primary and #3 Adobe Stock as fallback, and come back with `02-design.md` for Gate 1. Expect the honest odds above: about one-in-four of earning anything, low tens of dollars a month if it does.
- **B — "Do not start."** I stop here. The assessment stands as the deliverable, and you can re-run it later if a constraint changes.
- **C — "Change a constraint first."** Tell me which: a small yearly budget (roughly A$20–30), permission for approved launch-directory submissions, or a domain you know something about. I'll re-score and come back with a revised shortlist before building anything.

If you want a different candidate from the table as primary, just name its number.

---

*Sources for every claim above are in the companion file `01-research-notes.md` (the three verification reports from this run). Anything marked UNVERIFIED there is treated as unknown, not as true.*
