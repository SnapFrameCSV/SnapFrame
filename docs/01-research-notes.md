# 01 — Research notes (companion to 01-assessment.md)

Three verification reports produced on 11 September 2026. Every fact was checked against a live page during the run; items marked UNVERIFIED could not be confirmed on a primary source and are treated as unknown in the assessment. These notes exist so future runs do not re-litigate the same questions.

Additional spot-checks made after the reports:

- Cloudflare Workers AI: "10,000 Neurons per day at no charge" on Free and Paid plans; `@cf/black-forest-labs/flux-1-schnell` costs 4.80 neurons per 512×512 tile and 9.60 neurons per step (≈ 58 neurons for a 1024×1024, 4-step image → roughly 170 images/day free). No non-commercial restriction found. Source: https://developers.cloudflare.com/workers-ai/platform/pricing/
- Adobe Stock photo requirements: "Image resolution: 4MP–100MP", "Format: JPEG with sRGB color profile". Source: https://helpx.adobe.com/stock/contributor/submit-your-content/submit-photos/technical-legal-requirements-photo-submission.html — Flux output (≤1 MP) would need 2× upscaling. Contributor portal supports CSV metadata upload: https://helpx.adobe.com/stock/contributor/manage-your-portfolio/csv-requirements-content.html
- Visual Studio Marketplace Terms of Use (June 2021): section 1.c contemplates "Bring-Your-Own-License (BYOL) Offerings"; no clause on automated publishing or AI-generated content. Publisher Agreement not read — verify in Phase 2. Source: https://cdn.vsassets.io/v/M190_20210811.1/_content/Microsoft-Visual-Studio-Marketplace-Terms-of-Use.pdf
- The Claude cloud workspace has `git` but not the `gh` CLI and no GitHub credential; how a scheduled run authenticates to GitHub is the first thing Phase 3 step 5.0 must prove (Gate 2 in the assessment).

---

# Report A — Merchant-of-record & payment options for an Australian individual

## Headline changes since 2024 that matter

- **Stripe Managed Payments (Stripe's own MoR) went GA on 22 Apr 2026 in 39 countries "including new support for Australia"** ([Stripe changelog](https://docs.stripe.com/payments/managed-payments/changelog)). AI-as-a-service tax codes were added 2 Jun 2026.
- **Lemon Squeezy** is still running under Stripe but in a transition to Managed Payments ("slower support responses and less frequent product updates", Jan 2026 post) ([LS 2026 update](https://www.lemonsqueezy.com/blog/2026-update)).
- **Gumroad** became a full MoR on 1 Jan 2025 ([Gumroad pricing](https://gumroad.com/pricing)) but now **explicitly prohibits "AI services"** ([Gumroad prohibited list](https://gumroad.com/prohibited)).
- **Polar** raised new-org pricing to 5% + 50¢ on 27 May 2026 and added paid tiers ([Polar Plans](https://polar.sh/blog/introducing-polar-plans)).
- **Paddle** now supports individuals/sole traders without business verification, and AUD payouts to Australian banks are fee-free ([Paddle payout fees](https://www.paddle.com/help/manage/get-paid/is-there-a-fee-taken-for-payouts)).

## 1. Lemon Squeezy (owned by Stripe)

1. **Status:** Operating. Jan 28 2026 CEO post acknowledges slower support/updates, goal is "an easy way to migrate to Stripe Managed Payments"; no shutdown date ([2026 update](https://www.lemonsqueezy.com/blog/2026-update)). Store applications still being reviewed/rejected as of Aug 2026 per Trustpilot ([Trustpilot LS](https://www.trustpilot.com/review/lemonsqueezy.com)). Direction of travel is toward SMP; treat LS as legacy.
2. **MoR:** Yes ([LS pricing](https://www.lemonsqueezy.com/pricing)).
3. **Fees:** 5% + $0.50; +1.5% international; +1.5% PayPal; +0.5% subscriptions. Payouts: bank free (US) / 1% international; PayPal 3% capped $30 international ([LS fees](https://docs.lemonsqueezy.com/help/getting-started/fees)). Payouts 1st and 15th, 13-day hold, **$50 minimum**, USD then converted ([Getting paid](https://docs.lemonsqueezy.com/help/getting-started/getting-paid)).
4. **Australia / individual:** Australia supported for bank and PayPal payouts ([Supported countries](https://docs.lemonsqueezy.com/help/getting-started/supported-countries)). Activation = questionnaire + KYC/KYB, 2–3 business days ([Activate your store](https://docs.lemonsqueezy.com/help/getting-started/activate-your-store)). Terms require "a lawful business" (s.9.1) but not incorporation ([LS Terms](https://www.lemonsqueezy.com/terms)). ABN requirement: UNVERIFIED.
5. **AI / automation:** Prohibited list bans "NSFW chatbots" only ([Prohibited products](https://docs.lemonsqueezy.com/help/getting-started/prohibited-products)). Freemius (Aug 2026) reports "AI-powered" apps routed to manual review ([Freemius](https://freemius.com/blog/payment-platform-restrictions-ai-apps/)). Public API is the sanctioned automation path.
6. **Automatable:** `POST /v1/orders/:id/refund` ([Issue a refund API](https://docs.lemonsqueezy.com/api/orders/issue-refund)); webhooks; usage-based billing ([Usage-based billing](https://docs.lemonsqueezy.com/help/products/usage-based-billing)).
7. **Reliability:** Trustpilot 1.2/5: store rejections after KYC with no explanation, payout holds, support silence.

## 2. Stripe Managed Payments (Stripe's MoR) — Australia

1. **Status:** GA since 22 Apr 2026; AU supported ([eligibility](https://docs.stripe.com/payments/managed-payments/eligibility)). Dashboard toggle + separate ToS; "eligibility review that considers factors such as business type and geography" ([set-up](https://docs.stripe.com/payments/managed-payments/set-up)).
2. **MoR:** Yes. Stripe (via Link) is merchant of record; handles sales tax/VAT/GST in 80+ countries, fraud, disputes, transaction-level support, receipts ("Sold through Link") ([how it works](https://docs.stripe.com/payments/managed-payments/how-it-works)).
3. **Fees (AU):** 3.5% per MP transaction **on top of** card fees: domestic 1.7% + A$0.30, international 3.5% + A$0.30; Billing 0.7% for subscriptions; dispute A$25 ([AU pricing](https://stripe.com/au/pricing), [MP pricing FAQ](https://support.stripe.com/questions/managed-payments-pricing?locale=en-GB)). All-in domestic ≈ 5.9% + A$0.30; international ≈ 7.7% + A$0.30. No monthly fee; payouts free; AU settlement 2 business days; minimum A$0.01 ([Payouts](https://docs.stripe.com/payouts)).
4. **Australia / individual:** Stripe AU accounts can be "Individual/Sole Trader": name, DOB, address, phone, BSB + account; ABN not in required fields ([AU setup guide](https://trust.clinictocloud.com.au/hc/en-us/articles/360001940516-Stripe-Account-Setup-Individual-Sole-Trader)); unregistered sellers pick "individual" ([Stripe support](https://support.stripe.com/questions/how-to-determine-your-business-type-and-structure)). SSA s.2.1: "User must be a business (including sole proprietor)". **Whether MP's eligibility review accepts "individual": UNVERIFIED.**
5. **AI / automation:** Only AI-generated adult content prohibited; AIaaS tax codes MP-eligible since 2 Jun 2026 ([changelog](https://docs.stripe.com/payments/managed-payments/changelog), [AU restricted businesses](https://stripe.com/au/legal/restricted-businesses)). Products must be "fully automated digital product[s]" ([eligibility](https://docs.stripe.com/payments/managed-payments/eligibility)). Official MCP server/agent tooling ([Stripe agents](https://docs.stripe.com/agents)).
6. **Automatable:** Refunds/subscription updates via API; Link may refund without approval if you don't respond within 48h ([how it works](https://docs.stripe.com/payments/managed-payments/how-it-works)). Constraints: Checkout/Payment Links only; metered pricing inside MP UNVERIFIED ([MP overview](https://docs.stripe.com/payments/managed-payments)).
7. **Reliability:** Too new for AU-specific reports; low dispute rate required.

## 3. Stripe direct (processor only), Australia

- Not a MoR: you own GST/VAT, invoices, support, disputes. Stripe Tax 0.5% where registered ([AU pricing](https://stripe.com/au/pricing)). Fastest approval; accepts AI content generators ([Freemius](https://freemius.com/blog/payment-platform-restrictions-ai-apps/)). Only sensible if registering for GST yourself.

## 4. Paddle

1. **Status:** Active, self-serve ([Paddle pricing](https://www.paddle.com/pricing)).
2. **MoR:** Yes — tax, chargeback defence, buyer support included.
3. **Fees:** 5% + $0.50; no monthly fee. Payouts **monthly**, **$100 minimum**, wire or Payoneer ([When do I get paid](https://www.paddle.com/help/manage/get-paid/when-and-how-do-i-get-paid)). **AUD → Australian bank: no fee**; $15 cross-currency ([payout fees](https://www.paddle.com/help/manage/get-paid/is-there-a-fee-taken-for-payouts)).
4. **Australia / individual:** business verification "not required for individuals or sole traders"; ABN docs not acceptable/not needed ([account verification](https://www.paddle.com/help/start/account-verification/what-is-account-verification), [business ID](https://www.paddle.com/help/start/account-verification/what-is-business-verification)). Domain review needs a live HTTPS site with product description, pricing, T&Cs/refund/privacy; 5–7 business days ([domain review](https://www.paddle.com/help/start/account-verification/what-is-domain-verification)).
5. **AI / automation:** AUP category 16 restricts realistic faces, bans deepfakes/voice impersonation ([AUP](https://www.paddle.com/help/start/intro-to-paddle/what-am-i-not-allowed-to-sell-on-paddle)). Freemius reports 1–3 week reviews for AI products.
6. **Automatable:** Refunds via `POST /adjustments`; auto-approved when verified, < $400, not wire ([adjustments API](https://developer.paddle.com/build/transactions/create-transaction-adjustments)). Usage-based billing not native ([Paddle for AI companies](https://developer.paddle.com/get-started/how-paddle-works/ai-companies/)).
7. **Reliability:** Trustpilot 3.9/5 (mostly buyers); main seller pain is domain-review rejection.

## 5. Gumroad

1. **Status:** Active; open-sourced; MoR since 1 Jan 2025 ([pricing](https://gumroad.com/pricing)).
3. **Fees:** 10% + $0.50 direct; 30% via Discover. Payouts weekly. Minimum payout reportedly $100 unverified / $10 verified since Mar 2026 — UNVERIFIED ([roo.beehiiv](https://roo.beehiiv.com/p/gumroad-fees-2026)).
4. **Australia / individual:** Individuals accepted (13+) ([Terms](https://gumroad.com/terms)). AU bank payouts implied by source code (`AustralianBankAccount`) ([GitHub source](https://raw.githubusercontent.com/antiwork/gumroad/main/app/models/australian_bank_account.rb)); PayPal payouts dropped late 2024.
5. **AI / automation:** **Prohibited: "AI services which includes selling access to AI tools, chatbots, image or content generation services, or subscriptions to AI services..."** ([prohibited](https://gumroad.com/prohibited)). Static AI-made files not named.
7. **Reliability:** Trustpilot 1.4/5; documented AI-moderation permanent ban with no appeal ([Indie Hackers](https://www.indiehackers.com/post/gumroad-as-an-iffy-problem-my-permanent-ban-efb5e39d95)).

## 6. Polar.sh

1. **Status:** Active; new plans since 20 May 2026 ([Polar Plans](https://polar.sh/blog/introducing-polar-plans)).
3. **Fees:** Starter (free) **5% + 50¢** for orgs created ≥ 27 May 2026; +1.5% international; $15 per dispute. Payout: $2/month with active payout + 0.25% + $0.25 + FX ≤1% ([Polar pricing](https://polar.sh/resources/pricing), [payouts](https://polar.sh/docs/features/finance/payouts)). Manual payout requests; USD $10 minimum; 7-day settlement delay for new orgs.
4. **Australia / individual:** Australia listed; Stripe Connect Express; individuals OK ([supported countries](https://polar.sh/docs/merchant-of-record/supported-countries)). First payout requires KYC (ID + selfie), product description, review "up to 14 days" ([account reviews](https://polar.sh/docs/merchant-of-record/account-reviews)).
5. **AI / automation:** AI content-generation tools "may not be accepted"; general SaaS/dev tools fine; usage-based billing available ([acceptable use](https://polar.sh/docs/merchant-of-record/acceptable-use)). MST s.6.2 requires responses to support/chargeback requests within 72h ([MST](https://polar.sh/legal/master-services-terms)).
6. **Automatable:** `POST /v1/refunds/` ([create refund](https://polar.sh/docs/api-reference/2026-04/refunds/create-refund.md)); webhooks; Polar may refund within 60 days itself ([refunds](https://polar.sh/docs/features/refunds)). Native licence keys.
7. **Reliability:** Trustpilot 2.0/5 (16 reviews): closures after approval, payout delays, checkout outages.

## 7. Creem.io

- MoR; 3.9% + $0.40; payouts 1st/15th, $50 minimum, bank fee max($7, 1%) ([payouts](https://docs.creem.io/merchant-of-record/finance/payouts)). Australia supported ([supported countries](https://docs.creem.io/merchant-of-record/supported-countries)). Self-employed accepted; 24–72h review ([account reviews](https://docs.creem.io/merchant-of-record/account-reviews/account-reviews)). Generative AI products restricted (extra diligence). Agent-first tooling (49 MCP tools) but one key grants all destructive tools. No metered billing. Trustpilot 2.9/5 with terminated-account/held-balance reports; terms allow 90-day holds.

## 8. Dodo Payments

- MoR; 4% + 40¢ (+1.5% international, +0.5% subscriptions/usage); $1 per refund; $30 per dispute ([Dodo pricing](https://dodopayments.com/pricing)). Payout wallets USD/GBP/EUR only — an AUD bank receives a cross-border USD wire ($25) ([FAQ](https://docs.dodopayments.com/miscellaneous/faq)). Individual accounts for sole proprietors without business registration ([verification](https://docs.dodopayments.com/miscellaneous/verification-process)). Native usage-based billing. Trustpilot 3.0/5 (43% one-star): blocked accounts with 120-day holds.

## 9. FastSpring / Freemius

- FastSpring: no published rate card, sales-led ([FastSpring pricing](https://fastspring.com/pricing/)). Freemius: MoR, reviews AI products per use case, <24h standard review ([Freemius](https://freemius.com/blog/payment-platform-restrictions-ai-apps/)); fees/AU payouts UNVERIFIED.

## Australian tax facts (factual, not advice)

- Business income is assessable; sole traders declare in individual return ([ATO business income](https://www.ato.gov.au/individuals-and-families/income-deductions-offsets-and-records/income-you-must-declare/business-partnership-and-trust-income)).
- Hobby vs business: profit intention, repetition, businesslike manner; hobbies not eligible for an ABN; ABN not compulsory but free ([business.gov.au](https://business.gov.au/planning/new-businesses/difference-between-a-business-and-a-hobby), [ABN](https://business.gov.au/registrations/register-for-an-australian-business-number-abn)).
- GST registration required at **$75,000** GST turnover ([ATO GST](https://www.ato.gov.au/businesses-and-organisations/gst-excise-and-indirect-taxes/gst/registering-for-gst)).
- None of the MoRs above require an ABN to onboard.

## Comparison table

| Provider | MoR? | AU individuals? | Base fee | Payout to AU | Min payout | AI stance | Refund API | Usage billing | Risk signal |
|---|---|---|---|---|---|---|---|---|---|
| Stripe Managed Payments | Yes | Yes (AU GA Apr 2026); individual eligibility UNVERIFIED | 3.5% + card fee | AUD bank, free, 2 days | A$0.01 | AIaaS eligible | Yes | UNVERIFIED | New; dispute-rate eligibility |
| Paddle | Yes | Yes, no business docs | 5% + $0.50 | AUD wire free; monthly | $100 | Deepfakes banned; 1–3 wk review | Yes (<$400 auto) | Workaround | Domain-review rejections |
| Lemon Squeezy | Yes | Yes, legacy | 5% + $0.50 | USD → AU bank, 1% | $50 | NSFW bots only | Yes | Yes | Trustpilot 1.2 |
| Polar | Yes | Yes | 5% + $0.50 | Stripe Express, $2/mo + 0.25% | ~$10 | Gen-AI tools may be refused; SaaS fine | Yes | Yes | Trustpilot 2.0; 14-day review |
| Creem | Yes | Yes | 3.9% + $0.40 | Bank, max($7,1%) | $50 | Gen-AI restricted | Full only | No | Held-funds reports |
| Dodo | Yes | Yes | 4% + 40¢ | USD only → SWIFT $25 | $50 | AI-first | Yes | Yes | 120-day holds |
| Gumroad | Yes | Yes | 10% + $0.50 | AUD bank (per code) | $10/$100 UNVERIFIED | **AI services prohibited** | Dashboard | No | Trustpilot 1.4 |
| Stripe direct | No | Yes | 1.7% + A$0.30 | AUD free | A$0.01 | Permissive | Yes | Yes | You own GST/VAT |

**Report A recommendation:** Stripe Managed Payments first (try the toggle), Paddle fallback, Dodo if metered API billing is the core product. Avoid Gumroad for anything AI-service-like; treat Lemon Squeezy as legacy.

---

# Report B — Zero-cost hosting for a small paid product

## 1. Cloudflare

- **Workers Free:** 100,000 requests/day; 10 ms CPU per invocation; 128 MB; 100 Workers; 5 Cron Triggers per account, 1-minute granularity ([limits](https://developers.cloudflare.com/workers/platform/limits/), [pricing](https://developers.cloudflare.com/workers/platform/pricing/), [cron](https://developers.cloudflare.com/workers/configuration/cron-triggers/)). Static-asset requests free and unlimited. On exceeding limits: operations fail until 00:00 UTC reset — no surprise bills.
- **KV:** 100k reads/day, 1k writes/day, 1 GB. **D1:** 5M rows read/day, 100k written/day, 5 GB total, 10 databases ([D1 limits](https://developers.cloudflare.com/d1/platform/limits/)). **R2:** 10 GB, egress free. **Durable Objects:** Free only with SQLite backend, 100k requests/day ([DO pricing](https://developers.cloudflare.com/durable-objects/platform/pricing/)). Queues 10k ops/day; Workflows 3,000 steps/day.
- **Pages Free:** 500 builds/month, 100 projects, 20,000 files, 25 MiB/file ([limits](https://developers.cloudflare.com/pages/platform/limits/)).
- **Commercial use:** [Self-Serve Subscription Agreement](https://www.cloudflare.com/terms/) has no non-commercial clause for Free; §2.2.1(h) forbids processing/collecting card data on a Free property — a MoR-hosted checkout keeps card data off your site (interpretation, UNVERIFIED with Cloudflare).
- **Inactivity pausing:** none documented for Workers, D1, KV, R2, Pages.
- **Custom domain:** not mandatory; but "Your workers.dev subdomain is treated as a Free website and is intended for personal or hobby projects that aren't business-critical" ([workers.dev doc](https://developers.cloudflare.com/workers/configuration/routing/workers-dev/)). No equivalent warning for pages.dev ([Pages custom domains](https://developers.cloudflare.com/pages/configuration/custom-domains/)).

## 2. Vercel

- [Fair Use Guidelines](https://vercel.com/docs/limits/fair-use-guidelines) (2026-07-29): "**Hobby teams are restricted to non-commercial personal use only.**" Commercial usage includes "Any method of requesting or processing payment from visitors of the site." [Hobby plan page](https://vercel.com/docs/plans/hobby) repeats it. Cron on Hobby: once per day minimum ([cron pricing](https://vercel.com/docs/cron-jobs/usage-and-pricing)). **Disqualified for any paid product.** Pro is $20/user/month.

## 3. Supabase

- Free: 2 active projects, 500 MB DB, 50k MAU ([pricing](https://supabase.com/pricing)); no commercial prohibition in [Terms](https://supabase.com/terms).
- **"Free projects are paused after 1 week of inactivity"**; "a few user requests to the database each day over the previous week is enough to keep the project from being paused" ([Project Pausing](https://supabase.com/docs/guides/platform/free-project-pausing)). Restore is a manual dashboard click. Community keep-alive tools exist ([supabase-pause-prevention](https://github.com/travisvn/supabase-pause-prevention)). Conditional at best.

## 4. GitHub

- **Actions:** Free personal = 2,000 min/month private; public repos free ([billing](https://docs.github.com/en/billing/managing-billing-for-your-products/managing-billing-for-github-actions/about-billing-for-github-actions)).
- **Scheduled workflows in public repos auto-disable after 60 days without repository activity** ([doc](https://docs.github.com/en/actions/how-tos/manage-workflow-runs/disable-and-enable-workflows)).
- **GitHub Pages:** "not intended for or allowed to be used as a free web-hosting service to run your online business, e-commerce site, or... SaaS" ([limits](https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits)). Disqualified as storefront.
- **GitHub Sponsors:** Australia supported; 0% fee from personal accounts, up to 6% from orgs; Stripe Connect payouts ([About Sponsors](https://docs.github.com/en/sponsors/getting-started-with-github-sponsors/about-github-sponsors), [setup](https://docs.github.com/en/sponsors/receiving-sponsorships-through-github-sponsors/setting-up-github-sponsors-for-your-personal-account)).
- **Marketplace paid Actions:** not possible; paid apps need an organisation + verified publisher; 5% cut; $500 monthly threshold before payout ([about Marketplace](https://docs.github.com/en/apps/github-marketplace/github-marketplace-overview/about-github-marketplace-for-apps), [receiving payment](https://docs.github.com/en/apps/github-marketplace/selling-your-app-on-github-marketplace/receiving-payment-for-app-purchases)).

## 5. Other free tiers

| Provider | Free allowance | Sleeps/pauses? | Commercial OK? | Source |
|---|---|---|---|---|
| Neon | 100 projects, 0.5 GB, 100 CU-hours/project/month | Scale-to-zero, auto-wake | No restriction stated | [plans](https://neon.com/docs/introduction/plans) |
| Turso | 100 DBs, 5 GB | **Archived after 10 idle days** | No restriction | [pricing](https://turso.tech/pricing) |
| Upstash Redis / QStash | 500k commands/month; QStash 1,000 msgs/day, 10 schedules | None | No restriction | [pricing](https://upstash.com/pricing) |
| Fly.io | **No free tier; card required** | — | — | [pricing](https://fly.io/docs/about/pricing/) |
| Render | Web services sleep after 15 min; free Postgres expires at 30 days | Yes | No restriction | [free docs](https://render.com/docs/free) |
| Railway | $1 credit/month — cannot run always-on | Stopped when credit used | No restriction | [plans](https://docs.railway.com/reference/pricing/plans) |
| Deno Deploy | 1M req/month, 10 CPU-hours, cron up to 10 jobs | Scale-to-zero, auto-wake | Not prohibited | [pricing](https://deno.com/deploy/pricing) |
| Netlify | 300 credits/month | Paused when credits exhausted | Not prohibited | [pricing](https://www.netlify.com/pricing/) |
| Val.town | 100k runs/day, no private vals | None | UNVERIFIED | [limits](https://www.val.town/limits) |

## 6. Free email

- **Resend:** 3,000/month, 100/day, 3 domains ([pricing](https://resend.com/pricing)); inbound via verified domain or managed subdomain ([receiving](https://resend.com/docs/dashboard/receiving/introduction)); free-plan inbound quota UNVERIFIED.
- **Brevo:** 300/day with branding ([pricing](https://www.brevo.com/pricing/)).
- **Cloudflare Email Routing + Email Workers:** available on Free; programmatic inbound; requires the domain to be a Cloudflare zone → **you need a domain** ([Email Service](https://developers.cloudflare.com/email-service/), [limits](https://developers.cloudflare.com/email-service/platform/limits/)).

## 7. Free uptime monitoring

- **UptimeRobot Free:** 50 monitors, 5-min, no webhooks ([pricing](https://uptimerobot.com/pricing/)). **Better Stack Free:** 10 monitors, 3-min, 10 heartbeats, email + Slack; webhook availability UNVERIFIED ([pricing](https://betterstack.com/uptime/pricing)). **Cloudflare Health Checks:** not on Free ([docs](https://developers.cloudflare.com/health-checks/)).
- $0 path: Cloudflare Worker cron self-check → `POST /repos/{o}/{r}/issues` with a fine-grained PAT stored as a Worker secret; Better Stack heartbeat as dead-man's switch.

## 8. Domain and MoR acceptance

- Free subdomains: workers.dev/pages.dev permitted but "not business-critical"; vercel.app moot; github.io prohibited; is-a.dev bans commercial use ([ToS](https://raw.githubusercontent.com/is-a-dev/register/main/TERMS_OF_SERVICE.md)).
- Lemon Squeezy: no website/domain requirement documented ([store activation](https://docs.lemonsqueezy.com/help/getting-started/activate-your-store)). Polar: live website "recommended", not mandated. Paddle: requires live HTTPS site with policies; *.pages.dev acceptance UNVERIFIED. Stripe Managed Payments: Stripe-hosted Checkout/Payment Links — no site needed for checkout itself.
- Cheapest domains: numeric .xyz "99¢ per year" ([gen.xyz](https://gen.xyz/1111b)); Porkbun .xyz $2.04 first year then $14.21 ([Porkbun](https://porkbun.com/tld/xyz)); Cloudflare Registrar .com ≈ $10.44/yr. **At $0 budget the domain is a gate.**

## Recommended $0 stacks

- **(a) Digital product / licence-key site:** Cloudflare Pages or Workers static assets; MoR-hosted checkout (Stripe MP Payment Link / Polar); MoR-native licence keys; Resend Free for extra email; Better Stack Free + Worker cron → GitHub Issue; GitHub Actions CI.
- **(b) Tiny API/SaaS:** Cloudflare Worker (100k req/day, 10 ms CPU) + D1 (no pausing) or Neon; KV/DO for counters; MoR webhooks → Worker → D1; Resend; monitoring as above. Without a domain you cannot use Email Routing and you run on workers.dev ("not business-critical").

---

# Report C — Income-model platforms, evidence review

Cross-cutting findings: (1) every payout rail requires a human to pass KYC; (2) distribution is the binding constraint — Chrome Web Store median extension has 17–18 users and 70% have ≤100 users ([Konabayev](https://konabayev.com/blog/extension-monetization-statistics-2026/), [aboutchromebooks](https://www.aboutchromebooks.com/chrome-extension-ecosystem/)); only 32.7% of sponsorable GitHub developers ever received a sponsorship ([HBS working paper](https://www.hbs.edu/ris/download.aspx?name=24-014.pdf)); Google's August 2026 spam update de-ranked AI/programmatic sites ([Google spam policies](https://developers.google.com/search/docs/essentials/spam-policies); [GSQI case studies](https://www.gsqi.com/marketing-blog/august-2026-google-spam-update-case-studies/)); (3) several channels exclude this profile: Shutterstock bans AI ([Shutterstock](https://submit.shutterstock.com/help/en/articles/10594676-ai-generated-content-on-shutterstock-contributor-faq)); Discord premium apps US/UK/EU only ([Discord](https://support-dev.discord.com/hc/en-us/articles/17299902720919-Premium-Apps-Payout)); Substack bars SEO/traffic-driving publications and added an AI-text detector July 2026 ([Substack guidelines](https://substack.com/content), [secondary](https://www.onlinewritingclub.com/p/substack-just-added-an-ai-detector)); Upwork ToS §3.5 bans automation ([secondary](https://gigradar.io/blog/upwork-automation)).

## A. Developer tools

- **VS Code Marketplace:** anyone with an Azure DevOps publisher can publish; no in-marketplace payments (only Free/Trial labels); automated CI publishing explicitly supported; PATs retired 1 Dec 2026 for Entra ID/workload identity; verified-publisher badge needs 6 months history + 6-month-old domain ([publishing docs](https://code.visualstudio.com/api/working-with-extensions/publishing-extension)). External checkout + licence key model: no prohibition found ([Dodo guide](https://dodopayments.com/blogs/sell-vscode-extensions)); Publisher Agreement text UNVERIFIED. No public revenue dataset.
- **Open VSX:** free; proprietary licences allowed; publisher agreement required ([Eclipse FAQ](https://www.eclipse.org/legal/open-vsx-registry-faq/)).
- **JetBrains Marketplace:** individuals 13+; mandatory review; critical issues within 2 business days ([Developer Agreement](https://www.jetbrains.com/legal/docs/plugins_site/developer-agreement/)); 15% commission (up to 25%); **$200 minimum payout** ([revenue sharing](https://plugins.jetbrains.com/docs/marketplace/revenue-sharing-and-fees.html)).
- **Chrome Web Store:** $5 one-time fee ([Extension Radar](https://www.extensionradar.com/blog/chrome-web-store-developer-fee-2026)); review days to weeks, new developers scrutinised ([review process](https://developer.chrome.com/docs/webstore/review-process)); spam policy bans duplicate/template extensions ([spam FAQ](https://developer.chrome.com/docs/webstore/program-policies/spam-faq/)); monetise via ExtensionPay 5% + Stripe ([ExtensionPay](https://extensionpay.com/)). Exstats Q1 2026: 178,299 extensions, median 18 users, 70.4% ≤100 users.
- **npm/PyPI pro tier:** needs hosted backend; not $0. **GitHub Actions:** free distribution only; paid apps need org + verified publisher + 100 installs ([requirements](https://docs.github.com/en/apps/github-marketplace/creating-apps-for-github-marketplace/requirements-for-listing-an-app)).

## B. Digital products

- **Gumroad:** 10% + $0.50; 30% Discover ([pricing](https://gumroad.com/pricing)); AI services prohibited (see Report A).
- **Lemon Squeezy:** in transition to Stripe MP ([2026 update](https://www.lemonsqueezy.com/blog/2026-update)).
- **Etsy:** $0.20 listing; 6.5% transaction; set-up fee; AU processing ~3% + A$0.25 domestic ([Fees policy](https://www.etsy.com/legal/fees/), [SellerTemplates](https://sellertemplates.com/etsy-fees-australia-2026.html)); new shops need photo ID + selfie ([announcement](https://community.etsy.com/t5/Announcements/Strengthening-New-Shop-Onboarding-to-Keep-Our-Community-Safe/m-p/144857341)); AI allowed with disclosure, prompt bundles prohibited ([Creativity Standards](https://www.etsy.com/legal/creativity/)).
- **Creative Market:** 50% cut; human artist reviews each shop application ([Shop Terms](https://creativemarket.com/terms/shops), [Open a Shop](https://support.creativemarket.com/hc/en-us/articles/201251700-Open-a-Shop-on-Creative-Market)).
- **Notion Marketplace:** 8% + $0.40 + 1% FX; $20 minimum; waitlist "may take several months"; Australia included ([Notion help](https://www.notion.com/help/selling-on-marketplace)).

## C. Niche/affiliate sites

- Google scaled content abuse names generative AI ([spam policies](https://developers.google.com/search/docs/essentials/spam-policies)); Aug 2026 case studies show losses ([GSQI](https://www.gsqi.com/marketing-blog/august-2026-google-spam-update-case-studies/)); zero-click 72–85% on sampled queries ([Similarweb](https://www.similarweb.com/blog/marketing/seo/zero-click-searches/)); competitive terms take 3–5 years ([Ahrefs](https://ahrefs.com/blog/google-sandbox-2-0-know/)); a surviving pSEO case study cost $41,000 ([theStacc](https://thestacc.com/blog/programmatic-seo-case-study/)).
- Amazon Associates AU: 2–12% rates ([schedule](https://affiliate-program.amazon.com.au/help/operating/schedule)); qualifying sales within 180 days or permanent withdrawal ([help](https://affiliate-program.amazon.com/help/node/topic/G7MJTPEP9NC3YKMG)); A$100 minimum payout. AdSense: A$100 threshold ([thresholds](https://support.google.com/adsense/answer/1709871?hl=en)).

## D. Open-source sponsorship

- GitHub Sponsors: AU supported; 0% personal; Stripe ~2.9% + $0.30 + 2% FX ([discussion](https://github.com/orgs/community/discussions/153625)); 32.7% ever sponsored ([HBS](https://www.hbs.edu/ris/download.aspx?name=24-014.pdf)). Open Collective/OSC: 10% host fee, org required ([OSC docs](https://docs.oscollective.org/campaigns-and-partnerships/github-sponsors)). thanks.dev: $5–29 example allocations ([The Register](https://www.theregister.com/2023/04/07/thanksdev_open_source_funding/)).

## E. API marketplaces

- RapidAPI (Nokia): 25% fee, PayPal only, monthly ([payouts](https://docs.rapidapi.com/docs/payouts-and-finance)); telecom pivot ([BuildMVPFast](https://www.buildmvpfast.com/alternatives/rapidapi)). Zuplo: Stripe-based metering ([docs](https://zuplo.com/docs/articles/monetization)). Direct MoR sale beats RapidAPI on fees but has zero organic discovery.

## F. Newsletters

- beehiiv free (Launch): no paid subscriptions, no Ad Network; Scale $43/mo ([pricing](https://www.beehiiv.com/pricing)). Substack: 10% + Stripe; AU OK ([support](https://support.substack.com/hc/en-us/articles/360041314672-Are-there-any-countries-or-geographies-you-don-t-support)); no SEO/traffic-driving publications ([guidelines](https://substack.com/content)).

## G. POD and stock

- Redbubble: Standard tier 50% platform fee ([help](https://help.redbubble.com/hc/en-us/articles/50959863016724-How-does-my-Account-Tier-determine-my-platform-fee)); $10 threshold from 1 Jul 2026. TeePublic: $2–4 per tee ([review](https://www.ecommerceceo.com/reviews/teepublic/)). Printful allows AI art with disclosure ([Printful](https://www.printful.com/blog/how-to-sell-ai-art)).
- **Adobe Stock:** accepts generative AI if labelled; no artist/real-person prompts; max 3 similar iterations ([GenAI FAQ](https://helpx.adobe.com/stock/contributor/submit-your-content/submit-generative-ai-content/adobe-stock-generative-ai-faq.html)); 33% images/35% video royalty ([royalty rates](https://helpx.adobe.com/stock/contributor/payments-earnings/royalties-pricing/royalty-rates-assets.html)); $25 minimum, PayPal/Payoneer/Skrill, 30% withholding without tax form ([getting paid AU](https://helpx.adobe.com/au/stock/contributor/help/getting-paid.html)).
- Shutterstock: AI banned. Wirestock: 15% commission, aggregator ([review](https://traksource.com/wirestock-review/)).

## H. Other

| Model | Key facts | Verdict |
|---|---|---|
| Discord premium apps | US/UK/EU only ([Discord](https://support-dev.discord.com/hc/en-us/articles/17299902720919-Premium-Apps-Payout)) | AU excluded |
| Telegram Stars | Crypto (TON) off-ramp ([GramBase](https://grambase.ai/blog/telegram-stars-guide-2026)) | Hard-no (crypto) |
| Slack apps | ≥5 active workspaces before listing ([Martech Notes](https://www.martechnotes.com/slack-cuts-marketplace-app-listing-requirement-to-5-workspaces-on-august-11-2026/)) | Needs customers first |
| Shopify apps | $19 partner fee; 0% to $1M ([revenue share](https://shopify.dev/docs/apps/launch/distribution/revenue-share)) | Not $0; needs merchants |
| WordPress + Freemius | 27%→7% + gateway; $100 min ([pricing](https://freemius.com/pricing/)) | Slow human review |
| Obsidian plugins | Paid OK if disclosed in README | Tiny market |
| Zapier / Hugging Face | No developer payments ([Zapier](https://docs.zapier.com/integrations/publish/public-integration), [HF billing](https://huggingface.co/docs/hub/billing)) | Not revenue channels |
| Fiverr / Upwork | Not passive; automation banned/deceptive ([Fiverr](https://help.fiverr.com/hc/en-us/articles/49174165608593-Prohibited-services-on-Fiverr)) | Excluded |

**Report C bottom line:** the only channel officially AI-friendly, free, AU-payable and agent-operable after a one-time KYC is Adobe Stock (cents per licence). Chrome/VS Code/JetBrains are buildable but the median outcome is single-digit users. Everything else needs money, a human in the loop, an existing audience, or is excluded.
