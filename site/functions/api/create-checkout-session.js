/**
 * POST /api/create-checkout-session
 *
 * Creates a Stripe Checkout Session, then the client redirects to it.
 *
 * - type "website": mode=payment, one line item, the $2,499 package.
 * - type "operations": mode=subscription, two line items (the plan's
 *   recurring monthly price plus its one-time onboarding fee). Stripe
 *   bills the one-time price as an extra item on the first invoice, so
 *   onboarding and the monthly subscription are confirmed in one checkout,
 *   one card entry, unlike Square which needed two separate steps.
 *
 * Body: { type: 'website' | 'operations', plan?, customer: {...intake fields...} }
 * Returns: { checkoutUrl, orderRef }
 */

import { stripeFetch, newIdempotencyKey, ConfigError } from '../_lib/stripe.js';

const ALLOWED_TYPES = new Set(['website', 'operations']);
const ALLOWED_PLANS = new Set(['essential', 'growth', 'advanced']);

const PLAN_LABELS = { essential: 'Essential', growth: 'Growth', advanced: 'Advanced' };

// Server-side source of truth for prices. Never trust an amount the
// client sends, recompute it here so a tampered request can't change the
// charge.
const PRICES_CENTS = {
	website: 249900,
	operations: {
		essential: { onboarding: 89500, monthly: 59500 },
		growth: { onboarding: 229500, monthly: 119500 },
		advanced: { onboarding: 449500, monthly: 229500 }
	}
};

export async function onRequestPost({ request, env }) {
	let payload;
	try {
		payload = await request.json();
	} catch {
		return json({ error: 'Invalid request body.' }, 400);
	}

	const { type, plan, customer } = payload || {};
	if (!ALLOWED_TYPES.has(type)) {
		return json({ error: 'Unknown purchase type.' }, 400);
	}
	if (type === 'operations' && !ALLOWED_PLANS.has(plan)) {
		return json({ error: 'Unknown plan.' }, 400);
	}
	if (!customer || !customer.email || !customer.businessName) {
		return json({ error: 'Missing required business/contact details.' }, 400);
	}

	const orderRef = crypto.randomUUID();
	const base = env.SITE_BASE_URL || new URL(request.url).origin;

	const metadata = {
		orderRef,
		type,
		plan: plan || '',
		businessName: String(customer.businessName).slice(0, 480),
		contactName: String(customer.contactName || '').slice(0, 480)
	};

	try {
		let session;

		if (type === 'website') {
			session = await stripeFetch(
				env,
				'/checkout/sessions',
				{
					mode: 'payment',
					success_url: `${base}/success-website.html?order=${orderRef}&session_id={CHECKOUT_SESSION_ID}`,
					cancel_url: `${base}/websites.html`,
					customer_email: customer.email,
					metadata,
					payment_intent_data: { metadata },
					line_items: [
						{
							quantity: 1,
							price_data: {
								currency: 'usd',
								unit_amount: PRICES_CENTS.website,
								product_data: { name: 'SiloX Custom Website Design' }
							}
						}
					]
				},
				{ idempotencyKey: newIdempotencyKey() }
			);
		} else {
			const prices = PRICES_CENTS.operations[plan];
			const label = PLAN_LABELS[plan];
			session = await stripeFetch(
				env,
				'/checkout/sessions',
				{
					mode: 'subscription',
					success_url: `${base}/success-operations.html?plan=${plan}&order=${orderRef}&session_id={CHECKOUT_SESSION_ID}`,
					cancel_url: `${base}/operations.html`,
					customer_email: customer.email,
					metadata,
					subscription_data: { metadata },
					line_items: [
						{
							quantity: 1,
							price_data: {
								currency: 'usd',
								unit_amount: prices.monthly,
								recurring: { interval: 'month' },
								product_data: { name: `SiloX ${label} Operations — Monthly` }
							}
						},
						{
							quantity: 1,
							price_data: {
								currency: 'usd',
								unit_amount: prices.onboarding,
								product_data: { name: `SiloX ${label} Operations — Onboarding` }
							}
						}
					]
				},
				{ idempotencyKey: newIdempotencyKey() }
			);
		}

		// TODO (needs a KV/D1 binding): persist { orderRef, type, plan, customer }
		// TODO (needs an email provider key): notify the agency inbox with the intake details

		return json({ checkoutUrl: session.url, orderRef });
	} catch (err) {
		if (err instanceof ConfigError) {
			return json({ error: err.message }, 503);
		}
		return json({ error: 'Could not create a checkout session. Please try again or contact us directly.' }, 502);
	}
}

function json(data, status = 200) {
	return new Response(JSON.stringify(data), {
		status,
		headers: { 'Content-Type': 'application/json' }
	});
}
