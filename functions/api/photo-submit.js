/**
 * Photo submission handler — Cloudflare Pages Function
 *
 * Receives a photo + metadata from the /admin/photo/ form.
 * Creates a GitHub PR with the image and updated photos.json.
 * You review and merge — merge triggers a site rebuild.
 *
 * Required env vars (set in Cloudflare Pages dashboard):
 *   GITHUB_TOKEN       — Personal access token with repo scope
 *   GITHUB_REPO_OWNER  — e.g. "garrettatx"
 *   GITHUB_REPO_NAME   — e.g. "austinballrz"
 */

export async function onRequestPost(context) {
  const { request, env } = context;

  // CORS
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
  };

  try {
    const formData = await request.formData();
    const photo = formData.get('photo');
    const alt = formData.get('alt');
    const year = formData.get('year');
    const caption = formData.get('caption') || '';
    const team = formData.get('team') || '';
    const hero = formData.get('hero') === 'true';
    const featured = formData.get('featured') === 'false' ? false : undefined;
    const submittedBy = formData.get('submitted_by') || 'Unknown';
    const submittedAt = formData.get('submitted_at') || new Date().toISOString();

    // Turnstile verification
    const turnstileToken = formData.get('turnstileToken');
    const turnstileSecret = env.TURNSTILE_SECRET_KEY;
    if (turnstileSecret && turnstileToken) {
      const ip = request.headers.get('CF-Connecting-IP') || '';
      const tsRes = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `secret=${turnstileSecret}&response=${turnstileToken}&remoteip=${ip}`,
      });
      const tsData = await tsRes.json();
      if (!tsData.success) {
        return new Response(JSON.stringify({ success: false, error: 'Security check failed. Please try again.' }), { status: 400, headers });
      }
    }

    // Validation
    if (!photo || !photo.size) {
      return new Response(JSON.stringify({ success: false, error: 'Photo is required.' }), { status: 400, headers });
    }
    if (!alt || alt.trim().length < 5) {
      return new Response(JSON.stringify({ success: false, error: 'Description is required (at least 5 characters).' }), { status: 400, headers });
    }
    if (!year || !/^\d{4}$/.test(year)) {
      return new Response(JSON.stringify({ success: false, error: 'Valid year is required.' }), { status: 400, headers });
    }

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(photo.type)) {
      return new Response(JSON.stringify({ success: false, error: 'Only JPG, PNG, and WebP images are allowed.' }), { status: 400, headers });
    }

    // Max 10MB
    if (photo.size > 10 * 1024 * 1024) {
      return new Response(JSON.stringify({ success: false, error: 'Photo must be under 10MB.' }), { status: 400, headers });
    }

    // Sanitize filename
    const originalName = photo.name.replace(/[^a-zA-Z0-9._-]/g, '-').toLowerCase();
    const ext = originalName.split('.').pop();
    const baseName = originalName.replace(/\.[^.]+$/, '');
    const filename = `${baseName}-${year}.${ext}`;

    // GitHub config
    const token = env.GITHUB_TOKEN;
    const owner = env.GITHUB_REPO_OWNER || 'garrettatx';
    const repo = env.GITHUB_REPO_NAME || 'austinballrz';

    if (!token) {
      return new Response(JSON.stringify({ success: false, error: 'Server configuration error.' }), { status: 500, headers });
    }

    const gh = (path, options = {}) => fetch(`https://api.github.com/repos/${owner}/${repo}${path}`, {
      ...options,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/vnd.github.v3+json',
        'Content-Type': 'application/json',
        'User-Agent': 'AustinBallrz-PhotoSubmit',
        ...options.headers,
      },
    });

    // 1. Get the default branch SHA
    const repoRes = await gh('');
    const repoData = await repoRes.json();
    const defaultBranch = repoData.default_branch || 'main';

    const refRes = await gh(`/git/ref/heads/${defaultBranch}`);
    const refData = await refRes.json();
    const baseSha = refData.object.sha;

    // 2. Create a new branch
    const branchName = `photo/${filename.replace(/\.[^.]+$/, '')}-${Date.now()}`;
    const createRefRes = await gh('/git/refs', {
      method: 'POST',
      body: JSON.stringify({
        ref: `refs/heads/${branchName}`,
        sha: baseSha,
      }),
    });

    if (!createRefRes.ok) {
      const err = await createRefRes.json();
      return new Response(JSON.stringify({ success: false, error: 'Could not create branch: ' + (err.message || 'unknown') }), { status: 500, headers });
    }

    // 3. Upload the image file
    const imageBuffer = await photo.arrayBuffer();
    const bytes = new Uint8Array(imageBuffer);
    let binary = '';
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    const imageBase64 = btoa(binary);

    const uploadRes = await gh(`/contents/public/images/team/${filename}`, {
      method: 'PUT',
      body: JSON.stringify({
        message: `Add photo: ${filename}`,
        content: imageBase64,
        branch: branchName,
      }),
    });

    if (!uploadRes.ok) {
      const err = await uploadRes.json();
      return new Response(JSON.stringify({ success: false, error: 'Could not upload image: ' + (err.message || 'unknown') }), { status: 500, headers });
    }

    // 4. Get current photos.json
    const jsonRes = await gh(`/contents/public/images/team/photos.json?ref=${branchName}`);
    const jsonData = await jsonRes.json();
    const currentJson = JSON.parse(atob(jsonData.content.replace(/\n/g, '')));

    // 5. Add the new photo entry
    const newPhoto = { src: filename, alt: alt.trim() };
    if (caption) newPhoto.caption = caption;
    if (team) newPhoto.team = team;
    if (hero) newPhoto.hero = true;
    if (featured === false) newPhoto.featured = false;

    // Find or create year group
    let yearGroup = currentJson.find(g => g.year === year);
    if (!yearGroup) {
      yearGroup = { year, photos: [] };
      // Insert in descending order
      const insertIdx = currentJson.findIndex(g => parseInt(g.year) < parseInt(year));
      if (insertIdx === -1) {
        currentJson.push(yearGroup);
      } else {
        currentJson.splice(insertIdx, 0, yearGroup);
      }
    }
    yearGroup.photos.push(newPhoto);

    // 6. Update photos.json
    const updatedContent = btoa(unescape(encodeURIComponent(JSON.stringify(currentJson, null, 2) + '\n')));
    const updateJsonRes = await gh(`/contents/public/images/team/photos.json`, {
      method: 'PUT',
      body: JSON.stringify({
        message: `Add ${filename} to photos.json (${year})`,
        content: updatedContent,
        sha: jsonData.sha,
        branch: branchName,
      }),
    });

    if (!updateJsonRes.ok) {
      const err = await updateJsonRes.json();
      return new Response(JSON.stringify({ success: false, error: 'Could not update photos.json: ' + (err.message || 'unknown') }), { status: 500, headers });
    }

    // 7. Create the Pull Request
    const prBody = [
      `## New Photo Submission`,
      ``,
      `**File:** \`${filename}\``,
      `**Year:** ${year}`,
      team ? `**Team:** ${team.toUpperCase()}` : '',
      `**Description:** ${alt}`,
      caption ? `**Caption:** ${caption}` : '',
      hero ? `**Hero:** Yes (homepage rotation)` : '',
      featured === false ? `**Visibility:** Photos page only` : '',
      ``,
      `---`,
      `Submitted by **${submittedBy}** on ${new Date(submittedAt).toLocaleDateString()}`,
      ``,
      `> Merge this PR to publish the photo. Close to reject.`,
    ].filter(Boolean).join('\n');

    const prRes = await gh('/pulls', {
      method: 'POST',
      body: JSON.stringify({
        title: `📷 New photo: ${caption || filename} (${year})`,
        head: branchName,
        base: defaultBranch,
        body: prBody,
      }),
    });

    if (!prRes.ok) {
      const err = await prRes.json();
      return new Response(JSON.stringify({ success: false, error: 'Could not create PR: ' + (err.message || 'unknown') }), { status: 500, headers });
    }

    const prData = await prRes.json();

    // 8. Send email notification via SendGrid
    const sgKey = env.SENDGRID_API_KEY;
    const emailTo = env.CONTACT_EMAIL_TO;
    const emailFrom = env.CONTACT_EMAIL_FROM;
    if (sgKey && emailTo && emailFrom) {
      const toAddresses = emailTo.split(',').map(e => ({ email: e.trim() }));
      const subject = `📷 Photo submitted by ${submittedBy}: ${alt.trim()} (${year})`;
      const textBody = [
        `New photo submission for austinballrz.com`,
        ``,
        `File: ${filename}`,
        `Year: ${year}`,
        team ? `Team: ${team.toUpperCase()}` : null,
        `Description: ${alt.trim()}`,
        `Submitted by: ${submittedBy}`,
        ``,
        `Review and merge the PR to publish:`,
        prData.html_url,
      ].filter(Boolean).join('\n');
      const htmlBody = [
        `<h2>New Photo Submission</h2>`,
        `<p><strong>File:</strong> ${filename}</p>`,
        `<p><strong>Year:</strong> ${year}</p>`,
        team ? `<p><strong>Team:</strong> ${team.toUpperCase()}</p>` : null,
        `<p><strong>Description:</strong> ${alt.trim()}</p>`,
        `<p><strong>Submitted by:</strong> ${submittedBy}</p>`,
        `<hr>`,
        `<p><a href="${prData.html_url}">Review the pull request</a> — merge to publish, close to reject.</p>`,
      ].filter(Boolean).join('\n');

      await fetch('https://api.sendgrid.com/v3/mail/send', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${sgKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          personalizations: [{ to: toAddresses }],
          from: { email: emailFrom, name: "Austin Ball'rz Photos" },
          subject,
          content: [
            { type: 'text/plain', value: textBody },
            { type: 'text/html', value: htmlBody },
          ],
        }),
      });
      // Email is best-effort — don't fail the submission if it doesn't send
    }

    return new Response(JSON.stringify({
      success: true,
      pr_url: prData.html_url,
      pr_number: prData.number,
    }), { status: 200, headers });

  } catch (err) {
    return new Response(JSON.stringify({ success: false, error: 'Server error: ' + err.message }), { status: 500, headers });
  }
}

// Handle CORS preflight
export async function onRequestOptions() {
  return new Response(null, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}
