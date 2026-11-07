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
import { sendEmail } from '../_lib/email.js';

const PLAN_LABELS = { essential: 'Essential', growth: 'Growth', advanced: 'Advanced' };

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
	// a customer's intake answers later. Also needed to dedupe on event.id,
	// Stripe can redeliver the same event, so without it a retry could send
	// a second confirmation email for the same payment.
	switch (event.type) {
		case 'checkout.session.completed':
			await handleCheckoutCompleted(event, env);
			break;
		default:
			console.log('Stripe webhook received (unhandled type):', event.type);
	}

	return new Response('ok', { status: 200 });
}

async function handleCheckoutCompleted(event, env) {
	const session = event.data && event.data.object;
	if (!session) return;

	const metadata = session.metadata || {};
	const customerEmail = (session.customer_details && session.customer_details.email) || session.customer_email;
	const businessName = metadata.businessName || 'your business';
	const contactName = metadata.contactName || 'there';
	const orderRef = metadata.orderRef || session.id;
	const amount = typeof session.amount_total === 'number'
		? `$${(session.amount_total / 100).toFixed(2)}`
		: null;
	const orderLabel = metadata.type === 'operations'
		? `${PLAN_LABELS[metadata.plan] || ''} Operations`.trim()
		: 'Custom Website Design';

	console.log('Checkout completed:', session.id, businessName, orderLabel);

	// Email delivery failures never fail the webhook response, the payment
	// itself already succeeded. Stripe would otherwise retry the whole
	// event over an email problem that has nothing to do with the charge.
	try {
		if (customerEmail) {
			await sendEmail(env, {
				to: customerEmail,
				subject: 'Your SiloX order is confirmed',
				text: customerEmailText({ contactName, businessName, orderLabel, amount, orderRef })
			});
		}
	} catch (err) {
		console.log('Customer confirmation email failed:', err.message);
	}

	try {
		if (env.AGENCY_NOTIFY_EMAIL) {
			await sendEmail(env, {
				to: env.AGENCY_NOTIFY_EMAIL,
				subject: `Paid: ${businessName} (${orderLabel})`,
				text: agencyEmailText({ contactName, businessName, orderLabel, amount, orderRef, customerEmail, sessionId: session.id })
			});
		}
	} catch (err) {
		console.log('Agency notification email failed:', err.message);
	}
}

function customerEmailText({ contactName, businessName, orderLabel, amount, orderRef }) {
	return `Hi ${contactName},

Thanks for choosing SiloX. This confirms your payment for ${businessName}.

Order: ${orderLabel}${amount ? `\nAmount: ${amount}` : ''}
Order reference: ${orderRef}

We'll be in touch within 1 to 2 business days to get things started. If anything comes up before then, just reply to this email or reach us at contact@silo-x.co.

Giselle
Founder, SiloX`;
}

function agencyEmailText({ contactName, businessName, orderLabel, amount, orderRef, customerEmail, sessionId }) {
	return `New paid order.

Business: ${businessName}
Contact: ${contactName}${customerEmail ? ` <${customerEmail}>` : ''}
Order: ${orderLabel}${amount ? `\nAmount: ${amount}` : ''}
Order reference: ${orderRef}
Stripe session: ${sessionId}`;
}
