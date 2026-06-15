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

    // ── Verify email configuration before building anything ──
    if (!env.SENDGRID_API_KEY || !env.CONTACT_EMAIL_FROM || !env.CONTACT_EMAIL_TO) {
      console.error('Email not configured: missing SENDGRID_API_KEY, CONTACT_EMAIL_FROM, or CONTACT_EMAIL_TO.');
      return new Response(
        JSON.stringify({ error: 'Could not send message. Please try again later.' }),
        { status: 500, headers }
      );
    }

    // ── Build email ──
    const reasonLabel = reason || 'General';
    // Strip angle brackets to avoid injecting markup. sanitizeLine also collapses
    // newlines for values that land in headers (subject, names) to prevent header injection.
    const sanitize = (str) => String(str).trim().replace(/[<>]/g, '');
    const sanitizeLine = (str) => sanitize(str).replace(/[\r\n]+/g, ' ');

    // Distinguish the dedicated join form from general contact messages
    // so the two are easy to tell apart in the inbox.
    const isJoinForm = source === 'join' || reasonLabel === 'New player interest';
    const subject = isJoinForm
      ? `New Player: ${sanitizeLine(name)}`
      : `Contact Form (${sanitizeLine(reasonLabel)}): ${sanitizeLine(name)}`;

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

    // ── Send team notification via SendGrid ──
    const toAddresses = env.CONTACT_EMAIL_TO
      .split(',')
      .map((e) => e.trim())
      .filter(Boolean)
      .map((e) => ({ email: e }));

    if (toAddresses.length === 0) {
      console.error('CONTACT_EMAIL_TO contained no valid addresses.');
      return new Response(
        JSON.stringify({ error: 'Could not send message. Please try again later.' }),
        { status: 500, headers }
      );
    }

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
        // Reply-To = the submitter, so a coach replying to this notification
        // writes straight back to the person who filled out the form.
        reply_to: {
          email: sanitize(email),
          name: sanitizeLine(name),
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

      // Include the exact submission the team received, so the submitter and
      // the coaches both hold the full original.
      const confirmText = [
        `Hi ${sanitizeLine(name)},`,
        '',
        confirmIntro,
        '',
        'Here is a copy of what you submitted:',
        '',
        emailBody,
        '',
        "— Austin Ball'rz",
      ].join('\n');

      const confirmHtml = [
        `<p>Hi ${sanitizeLine(name)},</p>`,
        `<p>${confirmIntro}</p>`,
        `<p style="color: #6b7280;">Here is a copy of what you submitted:</p>`,
        emailHtml,
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
            { to: [{ email: sanitize(email), name: sanitizeLine(name) }], subject: confirmSubject },
          ],
          from: { email: env.CONTACT_EMAIL_FROM, name: "Austin Ball'rz" },
          // Reply-To = the team, so if the submitter replies to their
          // confirmation it reaches the coaches, not an unmonitored address.
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
