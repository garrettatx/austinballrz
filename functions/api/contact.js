/**
 * Contact form handler — Cloudflare Pages Function
 *
 * POST /api/contact/
 * Validates Turnstile, sends email via SendGrid.
 *
 * Environment variables (set in Cloudflare Pages dashboard):
 *   SENDGRID_API_KEY
 *   CONTACT_EMAIL_TO (comma-separated)
 *   CONTACT_EMAIL_FROM
 *   TURNSTILE_SECRET_KEY
 */

export async function onRequestPost(context) {
  const { request, env } = context;
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
  };

  try {
    const body = await request.json();
    const { name, email, phone, reason, message, turnstileToken, honeypot } = body;

    // ── Honeypot (silent success for bots) ──
    if (honeypot) {
      return new Response(JSON.stringify({ success: true }), { status: 200, headers });
    }

    // ── Validate required fields ──
    const errors = [];
    if (!name?.trim()) errors.push('Name is required.');
    if (!email?.trim()) errors.push('Email is required.');
    if (!message?.trim()) errors.push('Message is required.');

    if (email?.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      errors.push('Please enter a valid email address.');
    }

    if (phone?.trim() && !/^[\d\s\-\+\(\)\.ext]+$/i.test(phone.trim())) {
      errors.push('Please enter a valid phone number.');
    }

    if (errors.length > 0) {
      return new Response(
        JSON.stringify({ error: errors[0] }),
        { status: 400, headers }
      );
    }

    // ── Rate limiting (basic — check Turnstile first) ──

    // ── Validate Turnstile token ──
    if (env.TURNSTILE_SECRET_KEY) {
      if (!turnstileToken) {
        return new Response(
          JSON.stringify({ error: 'Please complete the security check.' }),
          { status: 400, headers }
        );
      }

      const turnstileResponse = await fetch(
        'https://challenges.cloudflare.com/turnstile/v0/siteverify',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            secret: env.TURNSTILE_SECRET_KEY,
            response: turnstileToken,
            remoteip: request.headers.get('CF-Connecting-IP'),
          }),
        }
      );

      const turnstileResult = await turnstileResponse.json();
      if (!turnstileResult.success) {
        return new Response(
          JSON.stringify({ error: 'Security check failed. Please try again.' }),
          { status: 400, headers }
        );
      }
    }

    // ── Build email ──
    const reasonLabel = reason || 'General';
    const sanitize = (str) => str.trim().replace(/[<>]/g, '');

    const emailBody = [
      `Name: ${sanitize(name)}`,
      `Email: ${sanitize(email)}`,
      phone?.trim() ? `Phone: ${sanitize(phone)}` : null,
      `Reason: ${reasonLabel}`,
      '',
      'Message:',
      sanitize(message),
    ].filter(Boolean).join('\n');

    const emailHtml = [
      `<p><strong>Name:</strong> ${sanitize(name)}</p>`,
      `<p><strong>Email:</strong> ${sanitize(email)}</p>`,
      phone?.trim() ? `<p><strong>Phone:</strong> ${sanitize(phone)}</p>` : null,
      `<p><strong>Reason:</strong> ${reasonLabel}</p>`,
      '<hr>',
      `<p>${sanitize(message).replace(/\n/g, '<br>')}</p>`,
    ].filter(Boolean).join('\n');

    // ── Send via SendGrid ──
    const toAddresses = env.CONTACT_EMAIL_TO
      .split(',')
      .map((e) => ({ email: e.trim() }));

    const sgResponse = await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${env.SENDGRID_API_KEY}`,
      },
      body: JSON.stringify({
        personalizations: [
          {
            to: toAddresses,
            subject: `Austin Ball'rz Contact: ${reasonLabel} — ${sanitize(name)}`,
          },
        ],
        from: {
          email: env.CONTACT_EMAIL_FROM,
          name: "Austin Ball'rz Website",
        },
        reply_to: {
          email: sanitize(email),
          name: sanitize(name),
        },
        content: [
          { type: 'text/plain', value: emailBody },
          { type: 'text/html', value: emailHtml },
        ],
      }),
    });

    if (!sgResponse.ok) {
      const errorText = await sgResponse.text();
      console.error('SendGrid error:', sgResponse.status, errorText);
      return new Response(
        JSON.stringify({ error: 'Could not send message. Please try again later.' }),
        { status: 500, headers }
      );
    }

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers }
    );
  } catch (err) {
    console.error('Contact form error:', err);
    return new Response(
      JSON.stringify({ error: 'Something went wrong. Please try again.' }),
      { status: 500, headers }
    );
  }
}

// Handle preflight CORS
export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}
