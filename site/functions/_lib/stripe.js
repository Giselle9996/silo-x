/**
 * Shared Stripe API helpers for SiloX's Cloudflare Pages Functions.
 *
 * All secrets come from Cloudflare Pages environment variables, never
 * hardcoded. Configure these in the Cloudflare dashboard (Pages project >
 * Settings > Environment variables) or via `wrangler pages secret put`,
 * for both the Preview and Production environments:
 *
 *   STRIPE_SECRET_KEY                server-side secret, never exposed to the client
 *   STRIPE_WEBHOOK_SIGNING_SECRET    from Stripe Dashboard > Developers > Webhooks, for signature checks
 *   SITE_BASE_URL                    e.g. https://silo-x.co, used to build redirect URLs
 *
 * Unlike Square, Stripe Checkout can combine a one-time price and a
 * recurring price in a single Checkout Session (the one-time price is
 * billed as an extra item on the subscription's first invoice), and
 * prices can be defined inline per-request instead of pre-created in the
 * Dashboard. So there's no catalog setup needed here, just the two
 * secrets above.
 *
 * None of these have real values configured yet. See /site/README-SETUP.md.
 */

export class ConfigError extends Error {}

/**
 * Flattens a nested object into Stripe's bracket-notation form fields,
 * e.g. { line_items: [{ price_data: { unit_amount: 100 } }] } becomes
 * `line_items[0][price_data][unit_amount]=100`. Stripe's API takes
 * application/x-www-form-urlencoded bodies, not JSON.
 */
export function toStripeForm(obj) {
	const params = new URLSearchParams();
	function walk(value, path) {
		if (value === undefined || value === null) return;
		if (Array.isArray(value)) {
			value.forEach((v, i) => walk(v, `${path}[${i}]`));
		} else if (typeof value === 'object') {
			Object.entries(value).forEach(([k, v]) => walk(v, `${path}[${k}]`));
		} else {
			params.append(path, String(value));
		}
	}
	Object.entries(obj).forEach(([k, v]) => walk(v, k));
	return params;
}

export async function stripeFetch(env, path, formObj, opts) {
	if (!env.STRIPE_SECRET_KEY) {
		throw new ConfigError('Stripe is not configured yet (missing STRIPE_SECRET_KEY).');
	}
	const headers = {
		'Authorization': 'Bearer ' + env.STRIPE_SECRET_KEY,
		'Content-Type': 'application/x-www-form-urlencoded'
	};
	if (opts && opts.idempotencyKey) {
		headers['Idempotency-Key'] = opts.idempotencyKey;
	}
	const res = await fetch('https://api.stripe.com/v1' + path, {
		method: 'POST',
		headers,
		body: toStripeForm(formObj)
	});
	const body = await res.json().catch(() => ({}));
	if (!res.ok) {
		const message = (body.error && body.error.message) || 'Stripe API error';
		const err = new Error(message);
		err.stripe = body;
		err.status = res.status;
		throw err;
	}
	return body;
}

export function newIdempotencyKey() {
	return crypto.randomUUID();
}

/**
 * Verifies a Stripe webhook signature.
 * Stripe signs each webhook with HMAC-SHA256 over `${timestamp}.${rawBody}`,
 * hex-encoded, sent in the `Stripe-Signature` header as
 * `t=<timestamp>,v1=<signature>`. See
 * https://docs.stripe.com/webhooks#verify-manually
 */
export async function verifyStripeSignature(signingSecret, rawBody, signatureHeader, toleranceSeconds = 300) {
	if (!signingSecret || !signatureHeader) return false;
	const parts = Object.fromEntries(
		signatureHeader.split(',').map((pair) => {
			const idx = pair.indexOf('=');
			return [pair.slice(0, idx), pair.slice(idx + 1)];
		})
	);
	const timestamp = parts.t;
	const expectedSig = parts.v1;
	if (!timestamp || !expectedSig) return false;
	if (Math.abs(Date.now() / 1000 - Number(timestamp)) > toleranceSeconds) return false;

	const key = await crypto.subtle.importKey(
		'raw',
		new TextEncoder().encode(signingSecret),
		{ name: 'HMAC', hash: 'SHA-256' },
		false,
		['sign']
	);
	const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${timestamp}.${rawBody}`));
	const computedHex = Array.from(new Uint8Array(signature))
		.map((b) => b.toString(16).padStart(2, '0'))
		.join('');
	return computedHex === expectedSig;
}
