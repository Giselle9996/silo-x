/**
 * Shared email helper for SiloX's Cloudflare Pages Functions, sent via Resend.
 *
 * Configure these in Cloudflare Pages > Settings > Environment variables:
 *   RESEND_API_KEY        from resend.com > API Keys
 *   AGENCY_NOTIFY_EMAIL   where internal order/inquiry notifications go
 *   AGENCY_NOTIFY_CC      optional, a second address CC'd on those same notifications
 *   EMAIL_FROM            optional, defaults to "SiloX <notifications@silo-x.co>"
 *     (the sending domain must be verified in Resend, see resend.com/domains,
 *     otherwise Resend will reject the send)
 *
 * Neither RESEND_API_KEY nor AGENCY_NOTIFY_EMAIL has a real value configured
 * yet, see README-SETUP.md.
 */

export async function sendEmail(env, { to, subject, text, html, cc }) {
	if (!env.RESEND_API_KEY) {
		return { skipped: true, reason: 'RESEND_API_KEY not configured' };
	}
	const res = await fetch('https://api.resend.com/emails', {
		method: 'POST',
		headers: {
			'Authorization': `Bearer ${env.RESEND_API_KEY}`,
			'Content-Type': 'application/json'
		},
		body: JSON.stringify({
			from: env.EMAIL_FROM || 'SiloX <notifications@silo-x.co>',
			to,
			subject,
			text,
			...(html ? { html } : {}),
			...(cc ? { cc } : {})
		})
	});
	if (!res.ok) {
		const body = await res.text().catch(() => '');
		throw new Error(`Email provider rejected the request (${res.status}): ${body}`);
	}
	return res.json();
}
