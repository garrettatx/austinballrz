/**
 * Photo review page — Cloudflare Pages Function
 *
 * Shows a photo preview with Publish/Reject actions.
 * Linked from email notifications. No GitHub account needed.
 *
 * Required env vars:
 *   GITHUB_TOKEN        — Personal access token with repo scope
 *   GITHUB_REPO_OWNER   — e.g. "garrettatx"
 *   GITHUB_REPO_NAME    — e.g. "austinballrz"
 *   PHOTO_REVIEW_TOKEN  — Secret token for email links
 */

const NAV_LINKS = [
  { label: 'Home', href: '/' },
  { label: 'History', href: '/history/' },
  { label: 'Achievements', href: '/achievements/' },
  { label: 'Photos', href: '/photos/' },
  { label: 'Sponsors', href: '/sponsors/' },
  { label: 'Contact', href: '/contact/' },
];

export async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);

  const pr = url.searchParams.get('pr');
  const action = url.searchParams.get('action');
  const token = url.searchParams.get('token');
  const reason = url.searchParams.get('reason') || '';

  const expectedToken = env.PHOTO_REVIEW_TOKEN;
  const ghToken = env.GITHUB_TOKEN;
  const owner = env.GITHUB_REPO_OWNER || 'garrettatx';
  const repo = env.GITHUB_REPO_NAME || 'austinballrz';

  // --- Validation ---
  if (!expectedToken || !ghToken) {
    return resultPage('Configuration Error', 'This feature is not set up yet. Please review the photo on GitHub instead.', 'error');
  }
  if (!token || token !== expectedToken) {
    return resultPage('Link Expired or Invalid', 'This review link is no longer valid. If you received this email recently, contact the team admin.', 'error');
  }
  if (!pr || !/^\d+$/.test(pr)) {
    return resultPage('Invalid Link', 'The review link is missing information. Try clicking the link from the email again.', 'error');
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
    return resultPage('Photo Not Found', 'Could not find this submission. It may have already been handled or removed.', 'error');
  }
  const prData = await prRes.json();

  // Check current state
  if (prData.merged) {
    return resultPage('Already Published', 'This photo has already been approved and is live on the site.', 'success', '/photos/');
  }
  if (prData.state === 'closed') {
    return resultPage('Already Rejected', 'This photo was previously rejected. No action needed.', 'info');
  }

  // --- Execute approve ---
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
        return resultPage('Already Published', 'This photo has already been approved and is live on the site.', 'success', '/photos/');
      }
      return resultPage('Could Not Publish', `Something went wrong. Try again in a moment or <a href="${prData.html_url}">review on GitHub</a>.`, 'error');
    }

    return resultPage('Photo Published', 'The photo has been approved and will appear on the site within a couple of minutes.', 'success', '/photos/');
  }

  // --- Execute reject ---
  if (action === 'reject') {
    // Add rejection note as PR comment if provided
    if (reason) {
      await gh(`/issues/${pr}/comments`, {
        method: 'POST',
        body: JSON.stringify({ body: `Rejected: ${reason}` }),
      });
    }

    const closeRes = await gh(`/pulls/${pr}`, {
      method: 'PATCH',
      body: JSON.stringify({ state: 'closed' }),
    });

    if (!closeRes.ok) {
      const err = await closeRes.json();
      return resultPage('Could Not Reject', `Something went wrong. Try again or <a href="${prData.html_url}">review on GitHub</a>.`, 'error');
    }

    return resultPage('Photo Rejected', 'The photo has been rejected and will not appear on the site.', 'info');
  }

  // --- Show review page (no action yet) ---
  const branch = prData.head.ref;
  const body = prData.body || '';
  const title = prData.title || '';

  const fileMatch = body.match(/\*\*File:\*\*\s*`([^`]+)`/);
  const yearMatch = body.match(/\*\*Year:\*\*\s*(\d{4})/);
  const teamMatch = body.match(/\*\*Team:\*\*\s*(\w+)/);
  const descMatch = body.match(/\*\*Description:\*\*\s*(.+)/);

  const fileName = fileMatch ? fileMatch[1] : '';
  const photoYear = yearMatch ? yearMatch[1] : '';
  const photoTeam = teamMatch ? teamMatch[1] : '';
  const photoDesc = descMatch ? descMatch[1].trim() : title.replace(/📷\s*New photo:\s*/, '').replace(/\s*\(\d{4}\)\s*$/, '');

  const imageUrl = fileName
    ? `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/public/images/team/${fileName}`
    : '';

  const baseUrl = `${url.pathname}?pr=${pr}&token=${token}`;

  return new Response(reviewPageHtml(imageUrl, photoDesc, photoYear, photoTeam, baseUrl), {
    status: 200,
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
}

// Handle reject form POST (for the notes field)
export async function onRequestPost(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const formData = await request.formData();
  const reason = formData.get('reason') || '';
  const pr = url.searchParams.get('pr');
  const token = url.searchParams.get('token');

  // Redirect to GET with action=reject and reason
  const redirectUrl = `${url.pathname}?pr=${pr}&token=${token}&action=reject&reason=${encodeURIComponent(reason)}`;
  return Response.redirect(new URL(redirectUrl, url.origin).toString(), 303);
}

function shell(title, bodyContent) {
  const navHtml = NAV_LINKS.map(l => `<a href="https://www.austinballrz.com${l.href}">${l.label}</a>`).join('\n        ');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0">
  <title>${title} | Austin Ball'rz</title>
  <meta name="robots" content="noindex, nofollow">
  <style>
    @font-face { font-family: 'Barlow Condensed'; font-style: normal; font-weight: 700; font-display: swap; src: url('https://www.austinballrz.com/fonts/barlow-condensed-700.woff2') format('woff2'); }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #ffffff; color: #1a1a2e; line-height: 1.6; min-height: 100dvh; display: flex; flex-direction: column; -webkit-text-size-adjust: 100%; }

    /* Header */
    .site-header { background: #263a5a; padding: 0.5rem 1.25rem; }
    .site-header a { color: white; text-decoration: none; font-family: 'Barlow Condensed', sans-serif; font-weight: 700; font-size: 1.125rem; letter-spacing: 0.04em; text-transform: uppercase; }
    .rainbow-bar { height: 4px; background: linear-gradient(90deg, #D92638, #E08A00, #D4AD00, #3DA812, #1094D4, #6A2BE0); }

    /* Page container */
    .page { padding: 1.25rem 1.25rem 2rem; max-width: 520px; margin: 0 auto; flex: 1; width: 100%; }
    .page-title { font-size: 1.25rem; font-weight: 700; margin-bottom: 0.125rem; }
    .page-subtitle { color: #6b7280; font-size: 0.85rem; margin-bottom: 1.25rem; }

    /* Photo frame */
    .photo-frame { background: #f5f5f5; border-radius: 8px; overflow: hidden; border: 1px solid #e2e2e6; margin-bottom: 1.25rem; }
    .photo-frame img { display: block; width: 100%; height: auto; max-height: 450px; object-fit: contain; }
    .photo-frame .no-preview { padding: 3rem 1.5rem; text-align: center; color: #9ca3af; font-size: 0.875rem; }

    /* Metadata */
    .meta { margin-bottom: 1.5rem; }
    .meta-row { display: flex; gap: 0.5rem; padding: 0.5rem 0; font-size: 0.875rem; border-bottom: 1px solid #f0f0f0; }
    .meta-row:last-child { border-bottom: none; }
    .meta-label { color: #6b7280; font-weight: 600; min-width: 90px; flex-shrink: 0; }
    .meta-value { color: #1a1a2e; word-break: break-word; }

    /* Publish button */
    .btn-publish { display: block; width: 100%; text-align: center; background: #065f46; color: white; padding: 0.875rem; border-radius: 8px; font-size: 1rem; font-weight: 600; text-decoration: none; margin-bottom: 1.25rem; -webkit-tap-highlight-color: transparent; }
    .btn-publish:hover { opacity: 0.9; }
    .btn-publish:active { opacity: 0.8; }

    /* Reject disclosure */
    .reject-toggle { font-size: 0.8125rem; color: #991b1b; cursor: pointer; font-weight: 500; padding: 0.5rem 0; -webkit-tap-highlight-color: transparent; }
    .reject-toggle::-webkit-details-marker { color: #991b1b; }
    .reject-form { margin-top: 0.75rem; }
    .reject-label { display: block; font-size: 0.8125rem; font-weight: 600; color: #374151; margin-bottom: 0.25rem; }
    .reject-input { width: 100%; padding: 0.625rem 0.875rem; border: 1px solid #d1d5db; border-radius: 6px; font-size: 0.875rem; font-family: inherit; -webkit-appearance: none; appearance: none; }
    .reject-input:focus { outline: none; border-color: #991b1b; box-shadow: 0 0 0 3px rgba(153, 27, 27, 0.1); }
    .reject-btn { display: block; width: 100%; padding: 0.625rem; margin-top: 0.75rem; background: #991b1b; color: white; border: none; border-radius: 6px; font-size: 0.875rem; font-weight: 600; cursor: pointer; -webkit-tap-highlight-color: transparent; }
    .reject-btn:active { opacity: 0.8; }
    .reject-note { font-size: 0.75rem; color: #9ca3af; margin-top: 0.5rem; }

    /* Helper text */
    .help-text { font-size: 0.75rem; color: #9ca3af; text-align: center; }
    .help-text a { color: #6b7280; }

    /* Result cards */
    .result-card { border-radius: 8px; padding: 1.5rem; margin-top: 1rem; }
    .result-card h2 { font-size: 1.125rem; margin-bottom: 0.5rem; }
    .result-card p { font-size: 0.9375rem; color: #374151; line-height: 1.6; }
    .result-card a { color: inherit; }
    .result-link { display: inline-block; margin-top: 1.25rem; font-size: 0.875rem; color: #42168A; text-decoration: none; font-weight: 600; }
    .result-link:hover { text-decoration: underline; }

    /* Footer */
    .site-footer { background: #263a5a; color: rgba(255,255,255,0.6); padding: 1.25rem; margin-top: auto; }
    .site-footer-inner { max-width: 520px; margin: 0 auto; }
    .site-footer nav { display: flex; flex-wrap: wrap; gap: 0.375rem 1rem; margin-bottom: 0.75rem; }
    .site-footer a { font-size: 0.8rem; color: rgba(255,255,255,0.6); text-decoration: none; }
    .site-footer a:hover { color: white; }
    .site-footer .credit { font-size: 0.7rem; color: rgba(255,255,255,0.35); }

    /* Responsive */
    @media (max-width: 380px) {
      .page { padding: 1rem 1rem 1.5rem; }
      .meta-label { min-width: 75px; }
    }
  </style>
</head>
<body>
  <div class="site-header">
    <a href="https://www.austinballrz.com/">Austin Ball'rz</a>
  </div>
  <div class="rainbow-bar"></div>

  <div class="page">
    ${bodyContent}
  </div>

  <footer class="site-footer">
    <div class="site-footer-inner">
      <nav>
        ${navHtml}
      </nav>
      <p class="credit">&copy; ${new Date().getFullYear()} Austin Ball'rz</p>
    </div>
  </footer>
</body>
</html>`;
}

function reviewPageHtml(imageUrl, photoDesc, photoYear, photoTeam, baseUrl) {
  return shell('Review Photo', `
    <h1 class="page-title">Review Photo</h1>
    <p class="page-subtitle">Publish to add it to the site, or reject to discard.</p>

    <div class="photo-frame">
      ${imageUrl ? `<img src="${imageUrl}" alt="${photoDesc}" />` : `<div class="no-preview">Photo preview unavailable</div>`}
    </div>

    ${(photoDesc || photoYear || photoTeam) ? `<div class="meta">
      ${photoDesc ? `<div class="meta-row"><span class="meta-label">Description</span><span class="meta-value">${photoDesc}</span></div>` : ''}
      ${photoYear ? `<div class="meta-row"><span class="meta-label">Year</span><span class="meta-value">${photoYear}</span></div>` : ''}
      ${photoTeam ? `<div class="meta-row"><span class="meta-label">Team</span><span class="meta-value">${photoTeam}</span></div>` : ''}
    </div>` : ''}

    <a href="${baseUrl}&action=approve" class="btn-publish">Publish Photo</a>

    <details>
      <summary class="reject-toggle">Reject this photo</summary>
      <form method="POST" action="${baseUrl}" class="reject-form">
        <label class="reject-label">Reason (optional)</label>
        <input type="text" name="reason" placeholder="Wrong photo, blurry, duplicate, etc." class="reject-input" />
        <button type="submit" class="reject-btn">Yes, reject this photo</button>
        <p class="reject-note">Rejecting removes it from the publishing queue. The photo stays on GitHub and can be reconsidered later.</p>
      </form>
    </details>

    <p class="help-text">Publishing adds this photo to <a href="https://www.austinballrz.com/photos/">austinballrz.com/photos</a>.</p>
  `);
}

function resultPage(title, message, type, linkPath) {
  const colors = {
    success: { bg: '#ecfdf5', border: '#a7f3d0', text: '#065f46' },
    error: { bg: '#fef2f2', border: '#fecaca', text: '#991b1b' },
    info: { bg: '#f0f4ff', border: '#c7d2fe', text: '#3730a3' },
  };
  const c = colors[type] || colors.info;

  return new Response(shell(title, `
    <div class="result-card" style="background: ${c.bg}; border: 1px solid ${c.border};">
      <h2 style="color: ${c.text};">${title}</h2>
      <p>${message}</p>
    </div>
    ${linkPath ? `<a href="https://www.austinballrz.com${linkPath}" class="result-link">View photos page &rarr;</a>` : ''}
  `), {
    status: type === 'error' ? 400 : 200,
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
}
