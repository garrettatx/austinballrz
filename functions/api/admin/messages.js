/**
 * Admin messages API — Cloudflare Pages Function
 *
 * CRUD for contact form submissions stored in KV.
 * Protected by Cloudflare Access at /api/admin/*
 *
 * GET /api/admin/messages/           — List all (metadata only)
 * GET /api/admin/messages/?id=xxx    — Get full message
 * DELETE /api/admin/messages/?id=xxx — Delete message
 * PUT /api/admin/messages/?id=xxx    — Toggle read/unread
 */

const headers = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
};

export async function onRequestGet(context) {
  const { env, request } = context;
  const url = new URL(request.url);
  const id = url.searchParams.get('id');

  if (!env.CONTACT_MESSAGES) {
    return new Response(JSON.stringify({ error: 'Message storage not configured.' }), { status: 500, headers });
  }

  // Single message
  if (id) {
    const value = await env.CONTACT_MESSAGES.get(id);
    if (!value) {
      return new Response(JSON.stringify({ error: 'Message not found.' }), { status: 404, headers });
    }
    return new Response(value, { status: 200, headers });
  }

  // List all
  const list = await env.CONTACT_MESSAGES.list({ prefix: 'msg:' });
  const messages = list.keys.map(k => ({
    id: k.name,
    ...k.metadata,
  })).reverse(); // Newest first

  return new Response(JSON.stringify({ messages, cursor: list.cursor || null }), { status: 200, headers });
}

export async function onRequestDelete(context) {
  const { env, request } = context;
  const url = new URL(request.url);
  const id = url.searchParams.get('id');

  if (!env.CONTACT_MESSAGES) {
    return new Response(JSON.stringify({ error: 'Message storage not configured.' }), { status: 500, headers });
  }
  if (!id) {
    return new Response(JSON.stringify({ error: 'Message ID required.' }), { status: 400, headers });
  }

  await env.CONTACT_MESSAGES.delete(id);
  return new Response(JSON.stringify({ success: true }), { status: 200, headers });
}

export async function onRequestPut(context) {
  const { env, request } = context;
  const url = new URL(request.url);
  const id = url.searchParams.get('id');

  if (!env.CONTACT_MESSAGES) {
    return new Response(JSON.stringify({ error: 'Message storage not configured.' }), { status: 500, headers });
  }
  if (!id) {
    return new Response(JSON.stringify({ error: 'Message ID required.' }), { status: 400, headers });
  }

  const current = await env.CONTACT_MESSAGES.get(id);
  if (!current) {
    return new Response(JSON.stringify({ error: 'Message not found.' }), { status: 404, headers });
  }

  const msg = JSON.parse(current);
  msg.read = !msg.read;

  await env.CONTACT_MESSAGES.put(id, JSON.stringify(msg), {
    expirationTtl: 7776000,
    metadata: {
      submitted_at: msg.submitted_at,
      name: msg.name,
      reason: msg.reason,
      read: msg.read,
    },
  });

  return new Response(JSON.stringify({ success: true, read: msg.read }), { status: 200, headers });
}

export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}
