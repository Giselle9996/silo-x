# SiloX marketing site — setup & deployment

Static HTML/CSS/JS site with Cloudflare Pages Functions for the Stripe
payment backend. No build step, no Node dependency: every file here is
served as-is, and the `/functions` files run as Cloudflare's edge functions
without any bundling.

This replaces the earlier WordPress + Stripe build in `clients/silo-x/theme/`,
which modeled a different five-service business (Brand Identity, Website,
Brand+Website, Social Media, Operations as a quote-only service). That build
is left in place for reference but is superseded by this one. See
`clients/silo-x/CLAUDE.md` for that history.

## What's here

```
site/
  index.html, websites.html, operations.html, studio.html,
  contact.html, faq.html          — the six public pages
  enroll.html                     — Operations plan intake + checkout (onboarding fee + monthly plan, one step)
  success-website.html            — post-purchase page, website package
  success-operations.html         — post-enrollment page, Operations plans
  legal/                          — privacy, terms, refund policy, billing terms (DRAFTS)
  css/styles.css                  — the whole design system
  js/main.js                      — nav, scroll reveal, FAQ accordion, form helpers
  js/checkout.js                  — calls the Checkout Session function, redirects to Stripe
  functions/api/create-checkout-session.js   — all charges: website, and Operations onboarding + monthly together
  functions/api/stripe-webhook.js            — signature-verified webhook receiver
  functions/api/submit-inquiry.js            — contact form backend (needs an email provider)
  functions/_lib/stripe.js                   — shared Stripe API helpers
  robots.txt, sitemap.xml
```

## Deploying

Cloudflare Pages builds and runs `/functions` automatically on push, no
local Node/npm install is required to deploy this (useful, since this
environment doesn't have Node installed to test a local build). Two ways
to ship it:

1. **Git-connected** (recommended): push this repo to GitHub/GitLab, then
   in the Cloudflare dashboard, Pages > Create a project > connect the
   repo, set the project root to `clients/silo-x/site`, framework preset
   "None", build command empty, output directory `/`.
2. **Direct upload**: `wrangler pages deploy clients/silo-x/site` from a
   machine that has Node + wrangler installed (this one doesn't).

Either way, same-domain `/api/...` calls from the front-end just work,
Pages Functions and the static files are served from the same origin.

## Stripe configuration (nothing is live yet)

Stripe Checkout can combine a one-time price and a recurring price in a
single `mode: 'subscription'` session (the one-time price bills as an
extra item on the first invoice), so unlike the earlier Square build,
Operations enrollment is one checkout, one card entry, not two separate
steps. Prices are also defined inline per-request (`price_data`) rather
than pre-created in the Stripe Dashboard, so there's no product/price
catalog to set up ahead of time.

In the Cloudflare Pages project settings, add these environment variables
(as **secrets**), for both Preview and Production:

| Variable | Purpose |
|---|---|
| `STRIPE_SECRET_KEY` | Server-side secret key from Stripe Dashboard > Developers > API keys (`sk_test_...` while testing, `sk_live_...` once live) |
| `STRIPE_WEBHOOK_SIGNING_SECRET` | From Stripe Dashboard > Developers > Webhooks, after you register the webhook URL below (`whsec_...`) |
| `SITE_BASE_URL` | e.g. `https://silo-x.co`, used to build Stripe redirect (success/cancel) URLs |

### Steps in the Stripe Dashboard

1. Deploy the site, then register the webhook URL
   (`https://<your-domain>/api/stripe-webhook`) under Developers > Webhooks,
   subscribed to at least `checkout.session.completed`. Copy the signing
   secret into `STRIPE_WEBHOOK_SIGNING_SECRET`.
2. Test the whole flow in test mode (test secret key, Stripe's test card
   numbers) before switching `STRIPE_SECRET_KEY` to the live secret key.
   Specifically verify that a subscription-mode session with a mixed
   one-time + recurring line item actually produces one invoice with both
   charges, Stripe's own behavior here is documented but worth confirming
   against the current API version before trusting it with real money.

## What's NOT done yet, by design

- **No database.** `create-checkout-session.js` and `stripe-webhook.js`
  both have TODOs where order/intake data should be persisted. Add a
  Cloudflare KV namespace or D1 database binding, then wire those TODOs
  up, this is what lets the webhook actually mark an order "paid" and
  lets you look up a customer's intake answers.
- **No email notifications configured.** `submit-inquiry.js` sends through
  Resend if `RESEND_API_KEY` and `AGENCY_NOTIFY_EMAIL` are set; neither is
  set yet, so it currently returns a clear "not configured" error and the
  contact page falls back to telling the visitor to email
  contact@silo-x.co directly. The same applies to purchase-confirmation
  emails, there isn't one yet.
- **Portfolio has 3 real pieces** (Flussos, Leafless Ashes, Folklore
  Coffee) on `websites.html`, more can be added the same way as they
  become available.
- **Founder portrait** is still a placeholder on `studio.html`.
- **Legal pages are drafts**, explicitly marked as such on the page, not
  reviewed or approved. The refund/cancellation windows and billing-date
  handling are flagged `[Needs confirmation]` inline, those are business
  decisions, not something to invent.
- **Website maintenance** add-on is mentioned as "ask us" with no price,
  per the brief, since no price has been set.
- **Trello request board** isn't built. The copy on `operations.html`
  describes the intended experience but no board or integration exists
  yet, this was explicitly out of scope for the marketing site per the
  brief (Part 9.3).
- **No automated tests, no CI.** This environment has no Node.js
  installed, so nothing here has been run through `npm install` / a build
  step / a linter. Everything was written directly and reviewed by eye,
  then checked in the Browser pane preview server. Verify the Pages
  Functions in Stripe's test mode before trusting them with real money.

## Design system

Colors, type, and spacing live entirely in `css/styles.css` as CSS custom
properties, closely following the palette, typography, and component
language already established for SiloX in the prior WordPress build. Fonts
are loaded from Google Fonts (Fraunces for display, Inter for body), swap
the `@import` at the top of the stylesheet if you'd rather self-host them.

## Logo

`img/logo-horizontal-white.svg` (nav + footer) and `img/logomark-white.svg`
(footer watermark) are cropped from Giselle's real brand files at
`~/Downloads/SiloX Logo/` (the full kit, including black/inverse variants
and the vertical lockup, is there if a different version is ever needed).
Each SVG's `viewBox` was tightened by hand to the artwork's actual bounding
box, found with Pillow's `Image.getbbox()`, since the exported Illustrator
files ship with a lot of empty canvas around the mark. If Giselle sends a
revised logo later, recrop the same way rather than eyeballing a `viewBox`.
