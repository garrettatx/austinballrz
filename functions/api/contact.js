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
    const { name, pronouns, email, phone, reason, message, source, turnstileToken, honeypot } = body;

    // ── Honeypot (silent success for bots) ──
    if (honeypot) {
      return new Response(JSON.stringify({ success: true }), { status: 200, headers });
    }

    // ── Validate required fields ──
    const errors = [];
    if (!name?.trim()) errors.push('Name is required.');
    if (!email?.trim()) errors.push('Email is required.');
    if (!phone?.trim()) errors.push('Phone number is required.');
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

    // ── Store in KV (backup, in case email fails) ──
    if (env.CONTACT_MESSAGES) {
      try {
        const msgId = `msg:${Date.now()}:${Math.random().toString(36).slice(2, 6)}`;
        const msgValue = {
          id: msgId,
          name: name.trim(),
          pronouns: pronouns?.trim() || '',
          email: email.trim(),
          phone: phone?.trim() || '',
          reason: reason || 'General',
          message: message.trim(),
          submitted_at: new Date().toISOString(),
          ip: request.headers.get('CF-Connecting-IP') || '',
          read: false,
        };
        await env.CONTACT_MESSAGES.put(msgId, JSON.stringify(msgValue), {
          expirationTtl: 7776000, // 90 days
          metadata: {
            submitted_at: msgValue.submitted_at,
            name: msgValue.name,
            reason: msgValue.reason,
            read: false,
          },
        });
      } catch (kvErr) {
        // KV write is best-effort. Never fail the request.
        console.error('KV write failed:', kvErr.message);
      }
    }

    // ── Build email ──
    const reasonLabel = reason || 'General';
    const sanitize = (str) => str.trim().replace(/[<>]/g, '');

    // Distinguish the dedicated join form from general contact messages
    // so the two are easy to tell apart in the inbox.
    const isJoinForm = source === 'join' || reasonLabel === 'New player interest';
    const subject = isJoinForm
      ? `New Player: ${sanitize(name)}`
      : `Contact Form (${reasonLabel}): ${sanitize(name)}`;

    const pronounsLabel = pronouns?.trim() || 'Prefer not to say';

    const emailBody = [
      `Name: ${sanitize(name)}`,
      `Pronouns: ${pronounsLabel}`,
      `Email: ${sanitize(email)}`,
      phone?.trim() ? `Phone: ${sanitize(phone)}` : null,
      `Reason: ${reasonLabel}`,
      '',
      'Message:',
      sanitize(message),
    ].filter(Boolean).join('\n');

    const emailHtml = [
      `<p><strong>Name:</strong> ${sanitize(name)} <span style="color: #6b7280;">(${pronounsLabel})</span></p>`,
      `<p><strong>Email:</strong> ${sanitize(email)}</p>`,
      phone?.trim() ? `<p><strong>Phone:</strong> ${sanitize(phone)}</p>` : null,
      `<p><strong>Reason:</strong> ${reasonLabel}</p>`,
      `<p style="margin-top: 1rem;">${sanitize(message).replace(/\n/g, '<br>')}</p>`,
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
            subject,
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

    // ── Confirmation email to the submitter (best-effort) ──
    // Separate send so we control Reply-To (routes back to the team) and never
    // expose internal recipient addresses. Failure here must not fail the request.
    try {
      const confirmSubject = isJoinForm
        ? "Thanks for your interest — Austin Ball'rz"
        : "We got your message — Austin Ball'rz";

      const confirmIntro = isJoinForm
        ? "Thanks for your interest in playing with the Austin Ball'rz. A coach will reach out within a few days about next steps."
        : "Thanks for reaching out to the Austin Ball'rz. We'll get back to you within a day or two.";

      const confirmText = [
        `Hi ${sanitize(name)},`,
        '',
        confirmIntro,
        '',
        'For your records, here is what you sent:',
        '',
        sanitize(message),
        '',
        "— Austin Ball'rz",
      ].join('\n');

      const confirmHtml = [
        `<p>Hi ${sanitize(name)},</p>`,
        `<p>${confirmIntro}</p>`,
        `<p style="color: #6b7280;">For your records, here is what you sent:</p>`,
        `<blockquote style="margin: 0; padding-left: 1rem; border-left: 3px solid #e5e7eb; color: #374151;">${sanitize(message).replace(/\n/g, '<br>')}</blockquote>`,
        `<p>— Austin Ball'rz</p>`,
      ].join('\n');

      const replyToTeam = toAddresses[0]?.email || env.CONTACT_EMAIL_FROM;

      const confirmResponse = await fetch('https://api.sendgrid.com/v3/mail/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${env.SENDGRID_API_KEY}`,
        },
        body: JSON.stringify({
          personalizations: [
            { to: [{ email: sanitize(email), name: sanitize(name) }], subject: confirmSubject },
          ],
          from: { email: env.CONTACT_EMAIL_FROM, name: "Austin Ball'rz" },
          reply_to: { email: replyToTeam },
          content: [
            { type: 'text/plain', value: confirmText },
            { type: 'text/html', value: confirmHtml },
          ],
        }),
      });

      if (!confirmResponse.ok) {
        console.error('Confirmation email failed:', confirmResponse.status, await confirmResponse.text());
      }
    } catch (confirmErr) {
      console.error('Confirmation email error:', confirmErr.message);
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
