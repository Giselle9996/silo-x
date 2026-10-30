/**
 * POST /api/submit-inquiry
 *
 * Handles the Contact / Get Started form. Not wired to an email provider
 * yet, see README-SETUP.md. Once RESEND_API_KEY (or another provider) is
 * configured, this should send a notification to the agency inbox and an
 * autoreply to the submitter. Until then it responds 503 so the contact
 * page's own fallback message (email contact@silo-x.co directly) is shown
 * instead of a false "sent" confirmation.
 */

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
		const res = await fetch('https://api.resend.com/emails', {
			method: 'POST',
			headers: {
				'Authorization': `Bearer ${env.RESEND_API_KEY}`,
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({
				from: env.EMAIL_FROM || 'SiloX <notifications@silo-x.co>',
				to: env.AGENCY_NOTIFY_EMAIL,
				subject: `New inquiry: ${payload.name} (${payload.business || 'no business name given'})`,
				text: formatInquiry(payload)
			})
		});
		if (!res.ok) throw new Error('Email provider rejected the request.');
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
