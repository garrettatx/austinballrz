# Admin Dashboard — Austin Ball'rz

## Overview

The admin system has two tiers:
- **Public** (`/admin/`, `/admin/photo/`): Anyone can submit photos. Protected by Turnstile CAPTCHA only.
- **Protected** (`/admin/dashboard/*`): Messages and photo management. Protected by Cloudflare Access.

## Pages

| URL | Access | Purpose |
|-----|--------|---------|
| `/admin/` | Public | Tool directory |
| `/admin/photo/` | Public | Photo submission form |
| `/admin/dashboard/` | Login | Dashboard hub |
| `/admin/dashboard/messages/` | Login | View contact form submissions |
| `/admin/dashboard/photos/` | Login | Review/manage photo submissions |

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

## Environment Variables

| Variable | Where set | Purpose |
|----------|-----------|---------|
| `CONTACT_MESSAGES` | KV binding | Message storage |
| `PHOTO_REVIEW_TOKEN` | Pages env | Photo review page auth |
| `GITHUB_TOKEN` | Pages env | GitHub API for photo PRs |
| `SENDGRID_API_KEY` | Pages env | Email delivery |
| `TURNSTILE_SITE_KEY` | .env | Client-side CAPTCHA |
| `TURNSTILE_SECRET_KEY` | Pages env | Server-side CAPTCHA validation |
