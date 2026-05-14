/**
 * Admin photos API — Cloudflare Pages Function
 *
 * Lists photo submission PRs from GitHub.
 * Protected by Cloudflare Access at /api/admin/*
 *
 * GET /api/admin/photos/ — List open + recently closed photo PRs
 */

const headers = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
};

export async function onRequestGet(context) {
  const { env } = context;
  const token = env.GITHUB_TOKEN;
  const owner = env.GITHUB_REPO_OWNER || 'garrettatx';
  const repo = env.GITHUB_REPO_NAME || 'austinballrz';

  if (!token) {
    return new Response(JSON.stringify({ error: 'GitHub not configured.' }), { status: 500, headers });
  }

  const gh = (path) => fetch(`https://api.github.com/repos/${owner}/${repo}${path}`, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/vnd.github.v3+json',
      'User-Agent': 'AustinBallrz-AdminPhotos',
    },
  });

  try {
    // Fetch open photo PRs
    const openRes = await gh('/pulls?state=open&per_page=20');
    const openPRs = await openRes.json();

    // Fetch recently closed/merged photo PRs
    const closedRes = await gh('/pulls?state=closed&per_page=20&sort=updated&direction=desc');
    const closedPRs = await closedRes.json();

    // Filter to photo branches only
    const isPhotoPR = (pr) => pr.head && pr.head.ref && pr.head.ref.startsWith('photo/');

    function parsePR(pr) {
      const body = pr.body || '';
      const fileMatch = body.match(/\*\*File:\*\*\s*`([^`]+)`/);
      const yearMatch = body.match(/\*\*Year:\*\*\s*(\d{4})/);
      const teamMatch = body.match(/\*\*Team:\*\*\s*(\w+)/);
      const descMatch = body.match(/\*\*Description:\*\*\s*(.+)/);

      const fileName = fileMatch ? fileMatch[1] : '';
      const imageUrl = fileName
        ? `https://raw.githubusercontent.com/${owner}/${repo}/${pr.head.ref}/public/images/team/${fileName}`
        : '';

      return {
        number: pr.number,
        title: pr.title,
        state: pr.merged_at ? 'merged' : pr.state,
        created_at: pr.created_at,
        updated_at: pr.updated_at,
        file: fileName,
        year: yearMatch ? yearMatch[1] : '',
        team: teamMatch ? teamMatch[1] : '',
        description: descMatch ? descMatch[1].trim() : '',
        image_url: imageUrl,
        review_url: env.PHOTO_REVIEW_TOKEN
          ? `/api/photo-review/?pr=${pr.number}&token=${env.PHOTO_REVIEW_TOKEN}`
          : pr.html_url,
        github_url: pr.html_url,
      };
    }

    const pending = (Array.isArray(openPRs) ? openPRs : []).filter(isPhotoPR).map(parsePR);
    const recent = (Array.isArray(closedPRs) ? closedPRs : []).filter(isPhotoPR).slice(0, 5).map(parsePR);

    return new Response(JSON.stringify({ pending, recent }), { status: 200, headers });
  } catch (err) {
    return new Response(JSON.stringify({ error: 'Could not fetch photos: ' + err.message }), { status: 500, headers });
  }
}

export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}
