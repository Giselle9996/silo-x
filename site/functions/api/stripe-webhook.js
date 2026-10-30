/**
 * POST /api/stripe-webhook
 *
 * Receives Stripe webhook events (checkout.session.completed and others).
 * Verifies the signature before trusting anything in the body, Stripe
 * recommends this over trusting the browser's redirect back to the
 * success page, since that redirect can be skipped, replayed, or forged.
 *
 * Register this URL in Stripe Dashboard > Developers > Webhooks once the
 * site is live, listening for at least `checkout.session.completed`. An
 * order is only ever marked paid/enrolled from this webhook, never from
 * the browser redirect, which is the correct way to confirm a Stripe
 * payment actually went through.
 */

import { verifyStripeSignature } from '../_lib/stripe.js';

export async function onRequestPost({ request, env }) {
	const rawBody = await request.text();
	const signatureHeader = request.headers.get('stripe-signature');

	if (!env.STRIPE_WEBHOOK_SIGNING_SECRET) {
		return new Response('Webhook signing secret not configured.', { status: 503 });
	}

	const isValid = await verifyStripeSignature(env.STRIPE_WEBHOOK_SIGNING_SECRET, rawBody, signatureHeader);
	if (!isValid) {
		return new Response('Invalid signature.', { status: 401 });
	}

	let event;
	try {
		event = JSON.parse(rawBody);
	} catch {
		return new Response('Invalid payload.', { status: 400 });
	}

	// TODO (needs a KV/D1 binding): look up the order by
	// event.data.object.metadata.orderRef and mark it paid/enrolled, store
	// the Stripe session/subscription id against it so support can look up
	// a customer's intake answers later.
	// TODO (needs an email provider key): send the purchase-confirmation
	// email and notify the agency inbox. Do this idempotently, Stripe may
	// redeliver the same event, key off event.id.
	switch (event.type) {
		case 'checkout.session.completed':
			console.log('Stripe webhook received:', event.type, event.data && event.data.object && event.data.object.id);
			break;
		default:
			console.log('Stripe webhook received (unhandled type):', event.type);
	}

	return new Response('ok', { status: 200 });
}
