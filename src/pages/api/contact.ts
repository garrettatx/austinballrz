/**
 * Contact form API endpoint.
 * Validates Turnstile token, then sends email via SendGrid.
 *
 * POST /api/contact/
 * Body: { name, email, phone, reason, message, turnstileToken }
 */

import type { APIRoute } from 'astro';

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  const headers = { 'Content-Type': 'application/json' };

  try {
    const body = await request.json();
    const { name, email, phone, reason, message, turnstileToken, honeypot } = body;

    // Honeypot — silent success if filled (bot trap)
    if (honeypot) {
      return new Response(JSON.stringify({ success: true }), { status: 200, headers });
    }

    // Validate required fields
    if (!name?.trim() || !email?.trim() || !message?.trim()) {
      return new Response(
        JSON.stringify({ error: 'Name, email, and message are required.' }),
        { status: 400, headers }
      );
    }

    // Basic email format check
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      return new Response(
        JSON.stringify({ error: 'Please enter a valid email address.' }),
        { status: 400, headers }
      );
    }

    // Validate Turnstile token
    const turnstileSecret = import.meta.env.TURNSTILE_SECRET_KEY;
    if (turnstileSecret) {
      const turnstileResponse = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          secret: turnstileSecret,
          response: turnstileToken,
        }),
      });

      const turnstileResult = await turnstileResponse.json();
      if (!turnstileResult.success) {
        return new Response(
          JSON.stringify({ error: 'Security check failed. Please try again.' }),
          { status: 400, headers }
        );
      }
    }

    // Build email
    const reasonLabel = reason || 'General';
    const emailBody = [
      `Name: ${name.trim()}`,
      `Email: ${email.trim()}`,
      phone?.trim() ? `Phone: ${phone.trim()}` : null,
      `Reason: ${reasonLabel}`,
      '',
      'Message:',
      message.trim(),
    ].filter(Boolean).join('\n');

    // Send via SendGrid
    const sgResponse = await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${import.meta.env.SENDGRID_API_KEY}`,
      },
      body: JSON.stringify({
        personalizations: [{
          to: import.meta.env.CONTACT_EMAIL_TO.split(',').map((e: string) => ({ email: e.trim() })),
          subject: `Austin Ball'rz Contact Form: ${reasonLabel} — ${name.trim()}`,
        }],
        from: {
          email: import.meta.env.CONTACT_EMAIL_FROM,
          name: "Austin Ball'rz Website",
        },
        reply_to: {
          email: email.trim(),
          name: name.trim(),
        },
        content: [{
          type: 'text/plain',
          value: emailBody,
        }],
      }),
    });

    if (!sgResponse.ok) {
      console.error('SendGrid error:', sgResponse.status, await sgResponse.text());
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
};
