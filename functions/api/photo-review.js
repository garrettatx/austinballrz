/**
 * Photo review handler — Cloudflare Pages Function
 *
 * One-click approve/reject from email notifications.
 * Uses a simple token to prevent unauthorized access.
 *
 * Usage:
 *   /api/photo-review/?pr=123&action=approve&token=xxx
 *   /api/photo-review/?pr=123&action=reject&token=xxx
 *
 * Required env vars:
 *   GITHUB_TOKEN        — Personal access token with repo scope
 *   GITHUB_REPO_OWNER   — e.g. "garrettatx"
 *   GITHUB_REPO_NAME    — e.g. "austinballrz"
 *   PHOTO_REVIEW_TOKEN  — Secret token for email links
 */

export async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);

  const pr = url.searchParams.get('pr');
  const action = url.searchParams.get('action');
  const token = url.searchParams.get('token');
  const confirmed = url.searchParams.get('confirmed');

  const expectedToken = env.PHOTO_REVIEW_TOKEN;
  const ghToken = env.GITHUB_TOKEN;
  const owner = env.GITHUB_REPO_OWNER || 'garrettatx';
  const repo = env.GITHUB_REPO_NAME || 'austinballrz';

  // Validate
  if (!expectedToken || !ghToken) {
    return htmlResponse('Server configuration error.', 500);
  }
  if (!token || token !== expectedToken) {
    return htmlResponse('Invalid or expired link.', 403);
  }
  if (!pr || !action || !['approve', 'reject'].includes(action)) {
    return htmlResponse('Invalid request. Expected pr number and action (approve or reject).', 400);
  }

  // Confirmation step — prevents email client link prefetching from triggering actions
  if (confirmed !== 'yes') {
    const confirmUrl = `${url.pathname}?pr=${pr}&action=${action}&token=${token}&confirmed=yes`;
    const verb = action === 'approve' ? 'approve and publish' : 'reject';
    const color = action === 'approve' ? '#065f46' : '#991b1b';
    return htmlResponse(`
      <h2>Confirm: ${action === 'approve' ? 'Approve' : 'Reject'} photo?</h2>
      <p>PR #${pr} will be ${action === 'approve' ? 'merged and the photo published' : 'closed and the photo discarded'}.</p>
      <p style="margin-top: 1rem;">
        <a href="${confirmUrl}" style="display: inline-block; padding: 0.75rem 1.5rem; background: ${color}; color: white; text-decoration: none; border-radius: 6px; font-weight: 600;">${action === 'approve' ? 'Yes, publish it' : 'Yes, reject it'}</a>
      </p>
    `, 200);
  }

  const gh = (path, options = {}) => fetch(`https://api.github.com/repos/${owner}/${repo}${path}`, {
    ...options,
    headers: {
      'Authorization': `Bearer ${ghToken}`,
      'Accept': 'application/vnd.github.v3+json',
      'Content-Type': 'application/json',
      'User-Agent': 'AustinBallrz-PhotoReview',
      ...options.headers,
    },
  });

  try {
    if (action === 'approve') {
      // Merge the PR
      const mergeRes = await gh(`/pulls/${pr}/merge`, {
        method: 'PUT',
        body: JSON.stringify({
          merge_method: 'squash',
          commit_title: `Publish photo from PR #${pr}`,
        }),
      });

      if (!mergeRes.ok) {
        const err = await mergeRes.json();
        return htmlResponse(`Could not approve: ${err.message || 'unknown error'}. <a href="https://github.com/${owner}/${repo}/pull/${pr}">Open on GitHub</a>`, 500);
      }

      return htmlResponse(`
        <h2 style="color: #065f46;">Photo approved!</h2>
        <p>PR #${pr} has been merged. The photo will appear on the site after the next deploy (usually 1-2 minutes).</p>
        <p><a href="https://www.austinballrz.com/photos/">View photos page</a></p>
      `, 200);

    } else {
      // Close the PR
      const closeRes = await gh(`/pulls/${pr}`, {
        method: 'PATCH',
        body: JSON.stringify({ state: 'closed' }),
      });

      if (!closeRes.ok) {
        const err = await closeRes.json();
        return htmlResponse(`Could not reject: ${err.message || 'unknown error'}. <a href="https://github.com/${owner}/${repo}/pull/${pr}">Open on GitHub</a>`, 500);
      }

      return htmlResponse(`
        <h2 style="color: #991b1b;">Photo rejected</h2>
        <p>PR #${pr} has been closed. The photo will not be published.</p>
      `, 200);
    }
  } catch (err) {
    return htmlResponse(`Server error: ${err.message}`, 500);
  }
}

function htmlResponse(body, status) {
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Photo Review | Austin Ball'rz</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 480px; margin: 2rem auto; padding: 0 1.5rem; color: #1a1a2e; line-height: 1.6; }
    h2 { font-size: 1.25rem; }
    a { color: #42168A; }
  </style>
</head>
<body>${body}</body>
</html>`;
  return new Response(html, {
    status,
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
}
