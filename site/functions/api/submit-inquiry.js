/**
 * POST /api/submit-inquiry
 *
 * Handles the Contact / Get Started form, sends a notification to the
 * agency inbox via Resend (functions/_lib/email.js). If RESEND_API_KEY
 * isn't configured, responds 503 so the contact page's own fallback
 * message (email contact@silo-x.co directly) is shown instead of a false
 * "sent" confirmation.
 */

import { sendEmail } from '../_lib/email.js';

export async function onRequestPost({ request, env }) {
	let payload;
	try {
		payload = await request.json();
	} catch {
		return json({ error: 'Invalid request body.' }, 400);
	}

	if (!payload || !payload.email || !payload.name) {
		return json({ error: 'Missing required fields.' }, 400);
	}

	if (!env.RESEND_API_KEY && !env.AGENCY_NOTIFY_EMAIL) {
		return json({ error: 'Inquiry notifications are not configured yet.' }, 503);
	}

	try {
		await sendEmail(env, {
			to: env.AGENCY_NOTIFY_EMAIL,
			cc: env.AGENCY_NOTIFY_CC,
			subject: `New inquiry: ${payload.name} (${payload.business || 'no business name given'})`,
			text: formatInquiry(payload)
		});
		return json({ ok: true });
	} catch (err) {
		return json({ error: 'Could not send the inquiry notification.' }, 502);
	}
}

function formatInquiry(payload) {
	return Object.entries(payload)
		.filter(([key]) => key !== 'company_website')
		.map(([key, value]) => `${key}: ${value}`)
		.join('\n');
}

function json(data, status = 200) {
	return new Response(JSON.stringify(data), {
		status,
		headers: { 'Content-Type': 'application/json' }
	});
}
