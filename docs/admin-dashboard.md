# Admin Dashboard — Austin Ball'rz

## Overview

The admin system has two tiers:
- **Public** (`/admin/`, `/admin/photo/`): Anyone can submit photos. Protected by Turnstile CAPTCHA only.
- **Protected** (`/admin/dashboard/*`): Messages and photo review. Protected by Cloudflare Access.

## Pages

| URL | Access | Purpose |
|-----|--------|---------|
| `/admin/` | Public | Tool directory |
| `/admin/photo/` | Public | Photo submission form |
| `/admin/dashboard/` | Login | Dashboard hub |
| `/admin/dashboard/messages/` | Login | View contact form submissions |
| `/admin/dashboard/photos/` | Login | Photo Review (review/approve photo submissions) |

## API Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/contact/` | POST | Contact form handler (writes to KV + sends email) |
| `/api/photo-submit/` | POST | Photo upload (creates GitHub PR) |
| `/api/photo-review/` | GET/POST | Photo review page (approve/reject) |
| `/api/admin/messages/` | GET/PUT/DELETE | Messages CRUD (reads from KV) |
| `/api/admin/photos/` | GET | Photo PR listing (reads from GitHub API) |

## KV Storage

**Namespace:** `CONTACT_MESSAGES`

Contact form submissions are stored in Cloudflare KV as backup. Email is still the primary notification. Messages auto-expire after 90 days.

**Key format:** `msg:{timestamp}:{random4}`

**To add the KV namespace:**
1. Cloudflare dashboard → Pages → austinballrz → Settings → Bindings
2. Add KV namespace binding: variable name `CONTACT_MESSAGES`
3. Create the namespace if it doesn't exist yet

## Cloudflare Access Setup

Protects `/admin/dashboard/*` and `/api/admin/*`.

1. Cloudflare dashboard → Zero Trust → Access → Applications
2. Add self-hosted application
3. Domain: `www.austinballrz.com`
4. Paths: `/admin/dashboard/*` and `/api/admin/*`
5. Policy: Allow → Emails → (admin email addresses)
6. Auth: One-time PIN

No code changes needed. Access works at the edge before requests reach the site.

## UI Details

### Navigation and Layout
- Photo submission page (`/admin/photo/`) includes a breadcrumb linking back to `/admin/`.
- Dashboard pages use `max-width: 720px` for readable content width.
- The dashboard nav label is "Photo Review" (not "Photo Management" or "Photos").

### Photo Thumbnails
- Thumbnails render at 160x120px on the dashboard photos page.
- Caption is shown with a "shows on site" label to distinguish it from internal metadata.
- Submitter name is displayed separately in italic, not appended to the meta line.

### Quick Approve
- A green "Approve" button appears on each photo card in the dashboard, calling the `/api/photo-review/` endpoint directly (no need to open the full review page).

### Button Consistency
- Both approve and reject buttons use `line-height: 1` to ensure equal height regardless of label length.

### Loading States
- Both dashboard pages (messages and photos) show loading skeletons with a shimmer animation while data is fetched.
- Loaded content fades in with a CSS fade-in animation.

### Messages
- Pronouns are stored in KV alongside the message and displayed when expanding a message. Only messages submitted after the pronouns field was added will have this data.

### Security
- All dynamic content rendered in the dashboard is XSS-escaped before insertion into the DOM.

## Environment Variables

| Variable | Where set | Purpose |
|----------|-----------|---------|
| `CONTACT_MESSAGES` | KV binding | Message storage |
| `PHOTO_REVIEW_TOKEN` | Pages env | Photo review page auth |
| `GITHUB_TOKEN` | Pages env | GitHub API for photo PRs |
| `SENDGRID_API_KEY` | Pages env | Email delivery |
| `TURNSTILE_SITE_KEY` | .env | Client-side CAPTCHA |
| `TURNSTILE_SECRET_KEY` | Pages env | Server-side CAPTCHA validation |
