/**
 * Photo review page — Cloudflare Pages Function
 *
 * Shows a photo preview with Publish/Reject actions.
 * Linked from email notifications. No GitHub account needed.
 *
 * Flow:
 *   1. Email links to /api/photo-review/?pr=123&token=xxx
 *   2. Page shows the photo, metadata, and two action buttons
 *   3. User clicks Publish or Reject
 *   4. Action hits this same endpoint with &action=approve or &action=reject
 *   5. Confirmation page shows result
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

  const expectedToken = env.PHOTO_REVIEW_TOKEN;
  const ghToken = env.GITHUB_TOKEN;
  const owner = env.GITHUB_REPO_OWNER || 'garrettatx';
  const repo = env.GITHUB_REPO_NAME || 'austinballrz';

  // --- Validation ---
  if (!expectedToken || !ghToken) {
    return page('Configuration Error', 'This feature is not set up yet. Please review the photo on GitHub instead.', 'error');
  }
  if (!token || token !== expectedToken) {
    return page('Link Expired or Invalid', 'This review link is no longer valid. If you received this email recently, contact the team admin.', 'error');
  }
  if (!pr || !/^\d+$/.test(pr)) {
    return page('Invalid Link', 'The review link is missing information. Try clicking the link from the email again.', 'error');
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

  // --- Fetch PR data ---
  const prRes = await gh(`/pulls/${pr}`);
  if (!prRes.ok) {
    return page('Photo Not Found', `Could not find this submission (PR #${pr}). It may have already been handled or deleted.`, 'error');
  }
  const prData = await prRes.json();

  // Check PR state
  if (prData.merged) {
    return page('Already Published', 'This photo has already been approved and published to the site.', 'success', 'https://www.austinballrz.com/photos/');
  }
  if (prData.state === 'closed') {
    return page('Already Rejected', 'This photo was previously rejected. No action needed.', 'info');
  }

  // --- Execute action if provided ---
  if (action === 'approve') {
    const mergeRes = await gh(`/pulls/${pr}/merge`, {
      method: 'PUT',
      body: JSON.stringify({
        merge_method: 'squash',
        commit_title: `Publish photo from PR #${pr}`,
      }),
    });

    if (!mergeRes.ok) {
      const err = await mergeRes.json();
      if (err.message && err.message.includes('already been merged')) {
        return page('Already Published', 'This photo has already been approved and published.', 'success', 'https://www.austinballrz.com/photos/');
      }
      return page('Could Not Publish', `Something went wrong: ${err.message || 'unknown error'}. Try again or <a href="${prData.html_url}">review on GitHub</a>.`, 'error');
    }

    return page('Photo Published', 'The photo has been approved. It will appear on the site within a couple of minutes.', 'success', 'https://www.austinballrz.com/photos/');
  }

  if (action === 'reject') {
    const closeRes = await gh(`/pulls/${pr}`, {
      method: 'PATCH',
      body: JSON.stringify({ state: 'closed' }),
    });

    if (!closeRes.ok) {
      const err = await closeRes.json();
      return page('Could Not Reject', `Something went wrong: ${err.message || 'unknown error'}. Try again or <a href="${prData.html_url}">review on GitHub</a>.`, 'error');
    }

    return page('Photo Rejected', 'The photo has been rejected and will not appear on the site.', 'info');
  }

  // --- Show review page (no action yet) ---
  // Extract photo info from the PR
  const branch = prData.head.ref;
  const title = prData.title || '';
  const body = prData.body || '';

  // Parse metadata from PR body
  const fileMatch = body.match(/\*\*File:\*\*\s*`([^`]+)`/);
  const yearMatch = body.match(/\*\*Year:\*\*\s*(\d{4})/);
  const teamMatch = body.match(/\*\*Team:\*\*\s*(\w+)/);
  const descMatch = body.match(/\*\*Description:\*\*\s*(.+)/);

  const fileName = fileMatch ? fileMatch[1] : '';
  const photoYear = yearMatch ? yearMatch[1] : '';
  const photoTeam = teamMatch ? teamMatch[1] : '';
  const photoDesc = descMatch ? descMatch[1].trim() : title.replace(/📷\s*New photo:\s*/, '').replace(/\s*\(\d{4}\)\s*$/, '');

  // Build image URL from branch
  const imageUrl = fileName
    ? `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/public/images/team/${fileName}`
    : '';

  const baseUrl = `${url.pathname}?pr=${pr}&token=${token}`;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Review Photo | Austin Ball'rz</title>
  <meta name="robots" content="noindex, nofollow">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f8f9fa; color: #1a1a2e; min-height: 100vh; display: flex; flex-direction: column; }
    .header { background: #263a5a; padding: 0.75rem 1.5rem; }
    .header a { color: white; text-decoration: none; font-weight: 700; font-size: 1rem; }
    .rainbow { height: 4px; background: linear-gradient(90deg, #D92638, #E08A00, #D4AD00, #3DA812, #1094D4, #6A2BE0); }
    .container { max-width: 520px; margin: 0 auto; padding: 1.5rem; flex: 1; }
    .photo-frame { background: white; border-radius: 8px; overflow: hidden; border: 1px solid #e2e2e6; margin-bottom: 1.25rem; }
    .photo-frame img { display: block; width: 100%; height: auto; max-height: 400px; object-fit: contain; background: #f1f1f1; }
    .photo-frame .no-preview { padding: 3rem 1.5rem; text-align: center; color: #9ca3af; font-size: 0.875rem; }
    .meta { margin-bottom: 1.5rem; }
    .meta-row { display: flex; gap: 0.5rem; padding: 0.375rem 0; font-size: 0.875rem; border-bottom: 1px solid #f0f0f0; }
    .meta-row:last-child { border-bottom: none; }
    .meta-label { color: #6b7280; font-weight: 600; min-width: 90px; }
    .meta-value { color: #1a1a2e; }
    .actions { display: flex; gap: 0.75rem; margin-bottom: 1rem; }
    .btn { display: flex; align-items: center; justify-content: center; flex: 1; padding: 0.875rem 1rem; border: none; border-radius: 8px; font-size: 1rem; font-weight: 600; cursor: pointer; text-decoration: none; color: white; transition: opacity 0.15s; }
    .btn:hover { opacity: 0.9; }
    .btn-publish { background: #065f46; }
    .btn-reject { background: #991b1b; }
    .note { font-size: 0.75rem; color: #9ca3af; text-align: center; }
    .note a { color: #6b7280; }
    .footer { background: #263a5a; color: rgba(255,255,255,0.4); padding: 1rem 1.5rem; font-size: 0.75rem; text-align: center; margin-top: auto; }
  </style>
</head>
<body>
  <div class="header"><a href="https://www.austinballrz.com/">Austin Ball'rz</a></div>
  <div class="rainbow"></div>
  <div class="container">
    <h1 style="font-size: 1.25rem; font-weight: 700; margin-bottom: 1rem;">Review Photo Submission</h1>

    <div class="photo-frame">
      ${imageUrl ? `<img src="${imageUrl}" alt="${photoDesc}" />` : `<div class="no-preview">Photo preview unavailable</div>`}
    </div>

    <div class="meta">
      ${photoDesc ? `<div class="meta-row"><span class="meta-label">Description</span><span class="meta-value">${photoDesc}</span></div>` : ''}
      ${photoYear ? `<div class="meta-row"><span class="meta-label">Year</span><span class="meta-value">${photoYear}</span></div>` : ''}
      ${photoTeam ? `<div class="meta-row"><span class="meta-label">Team</span><span class="meta-value">${photoTeam}</span></div>` : ''}
    </div>

    <div class="actions">
      <a href="${baseUrl}&action=approve" class="btn btn-publish">Publish</a>
      <a href="${baseUrl}&action=reject" class="btn btn-reject">Reject</a>
    </div>

    <p class="note">Publishing adds this photo to <a href="https://www.austinballrz.com/photos/">austinballrz.com/photos</a>. Rejecting discards it.</p>
  </div>
  <div class="footer">&copy; ${new Date().getFullYear()} Austin Ball'rz</div>
</body>
</html>`;

  return new Response(html, {
    status: 200,
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
}

/** Branded result page for success, error, and info states */
function page(title, message, type, linkUrl) {
  const colors = {
    success: { bg: '#ecfdf5', border: '#a7f3d0', text: '#065f46' },
    error: { bg: '#fef2f2', border: '#fecaca', text: '#991b1b' },
    info: { bg: '#f0f4ff', border: '#c7d2fe', text: '#3730a3' },
  };
  const c = colors[type] || colors.info;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title} | Austin Ball'rz</title>
  <meta name="robots" content="noindex, nofollow">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f8f9fa; color: #1a1a2e; min-height: 100vh; display: flex; flex-direction: column; }
    .header { background: #263a5a; padding: 0.75rem 1.5rem; }
    .header a { color: white; text-decoration: none; font-weight: 700; font-size: 1rem; }
    .rainbow { height: 4px; background: linear-gradient(90deg, #D92638, #E08A00, #D4AD00, #3DA812, #1094D4, #6A2BE0); }
    .container { max-width: 520px; margin: 0 auto; padding: 2rem 1.5rem; flex: 1; }
    .card { background: ${c.bg}; border: 1px solid ${c.border}; border-radius: 8px; padding: 1.5rem; }
    .card h2 { color: ${c.text}; font-size: 1.125rem; margin-bottom: 0.5rem; }
    .card p { font-size: 0.9375rem; color: #374151; line-height: 1.6; }
    .card a { color: ${c.text}; }
    .link { display: inline-block; margin-top: 1.25rem; font-size: 0.875rem; color: #42168A; text-decoration: none; font-weight: 600; }
    .link:hover { text-decoration: underline; }
    .footer { background: #263a5a; color: rgba(255,255,255,0.4); padding: 1rem 1.5rem; font-size: 0.75rem; text-align: center; margin-top: auto; }
  </style>
</head>
<body>
  <div class="header"><a href="https://www.austinballrz.com/">Austin Ball'rz</a></div>
  <div class="rainbow"></div>
  <div class="container">
    <div class="card">
      <h2>${title}</h2>
      <p>${message}</p>
    </div>
    ${linkUrl ? `<a href="${linkUrl}" class="link">View photos page &rarr;</a>` : ''}
  </div>
  <div class="footer">&copy; ${new Date().getFullYear()} Austin Ball'rz</div>
</body>
</html>`;

  return new Response(html, {
    status: type === 'error' ? 400 : 200,
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
}
