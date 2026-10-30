/**
 * SiloX checkout helpers.
 *
 * Both the website package and an Operations plan (onboarding fee plus
 * monthly subscription, billed together) go through a single Stripe
 * Checkout Session created server-side in
 * /functions/api/create-checkout-session.js, then redirect there. Stripe
 * can mix a one-time price and a recurring price in one subscription-mode
 * session, so unlike Square this never needs a second card-entry step.
 */

function siloxFormToIntake(form) {
	var data = {};
	new FormData(form).forEach(function (value, key) {
		if (key === 'company_website') return; // honeypot, never sent on
		data[key] = value;
	});
	return data;
}

function siloxSetStatus(statusId, message, isError) {
	var el = document.getElementById(statusId);
	if (!el) return;
	el.textContent = message;
	el.classList.add('is-visible');
	el.classList.toggle('form-status--error', !!isError);
	el.classList.toggle('form-status--success', !isError);
}

/**
 * Create a Stripe Checkout Session for the website package, or for an
 * Operations plan (onboarding fee + monthly subscription together), then
 * redirect to it.
 */
async function siloxStartCheckout(opts) {
	var btn = document.getElementById(opts.buttonId);
	if (btn) { btn.disabled = true; btn.textContent = 'Preparing checkout…'; }
	siloxSetStatus(opts.statusId, 'Setting up your secure checkout…', false);

	var payload = {
		type: opts.type, // 'website' | 'operations'
		plan: opts.plan || null,
		customer: siloxFormToIntake(opts.form)
	};

	try {
		var res = await fetch('/api/create-checkout-session', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(payload)
		});
		var data = null;
		try { data = await res.json(); } catch { /* non-JSON response, e.g. a 404 from a static preview with no Functions runtime */ }
		if (!res.ok || !data || !data.checkoutUrl) {
			throw new Error((data && data.error) || 'Checkout isn\'t connected yet.');
		}
		window.location.href = data.checkoutUrl;
	} catch (err) {
		siloxSetStatus(opts.statusId, 'Payments aren\'t connected yet on this preview (' + (err.message || 'checkout unavailable') + '). Please contact us directly and we\'ll get you set up by hand.', true);
		if (btn) { btn.disabled = false; btn.textContent = opts.originalLabel || 'Continue to Secure Checkout'; }
	}
}

window.siloxStartCheckout = siloxStartCheckout;
window.siloxFormToIntake = siloxFormToIntake;
window.siloxSetStatus = siloxSetStatus;
