# Austin Ball'rz — CLAUDE.md

## Project Overview

Static Astro site for Austin Ball'rz, an LGBTQ+ inclusive softball team in Austin, TX.
Deployed to Cloudflare Pages. Source at github.com/garrettatx/austinballrz.

## Architecture

- **Framework:** Astro (static site generation, no View Transitions)
- **Styling:** Tailwind CSS v4 (via Vite plugin) + scoped CSS + CSS custom properties in `src/styles/global.css`
- **Hosting:** Cloudflare Pages (auto-deploys from `main`)
- **Analytics:** GA4 (direct, no GTM) — deferred loader pattern
- **Bot protection:** Cloudflare Turnstile on forms

## Key Files

- `src/data/site.ts` — Site config (name, URL, GA4 ID, navigation, all pages)
- `src/data/photos.ts` — Photo data loader from `public/images/team/photos.json`
- `src/layouts/Layout.astro` — Main layout (GA4, OG tags, global.css, noindex prop)
- `src/components/admin/AdminLayout.astro` — Standalone admin layout (no global.css, own GA4)
- `src/scripts/analytics.ts` — GA4 click/nav tracking; form events are inline in each form page
- `functions/api/contact.js` — Cloudflare Pages Function behind BOTH forms (Turnstile, SendGrid, confirmation email)
- `astro.config.mjs` — Sitemap filter excludes `/admin/`

## GA4 Analytics

GA4 ID is centralized in `site.ts` as `site.ga4Id`. The deferred loader (in `Layout.astro`)
delays gtag.js until the first user interaction, `visibilitychange`, or a 2s fallback timer.
Events are documented in `src/scripts/analytics.ts`.

**Pageview caveat (important):** the site does NOT use Astro View Transitions / ClientRouter,
so every navigation is a full page load and pageviews come from `gtag('config', …,
{send_page_view:true})` firing on load. The `astro:page-load` block in `analytics.ts` is inert
today (kept for future-proofing if ClientRouter is ever added). Because the gtag config is
deferred, a visitor who lands and leaves within ~2s with zero interaction records no pageview —
an accepted tradeoff for the performance of the deferred loader. Don't "fix" this by loading
gtag eagerly without discussing the perf cost.

Key events: `page_view`, `nav_click`, `cta_click`, `form_start`, `generate_lead`, `form_error`, `photo_submit`, `photo_view`.

Form tracking (both forms carry `form_id` and `form_name`):
- `form_start` → first field focus, once per page load
- Contact form → `generate_lead` with `lead_type` from the reason dropdown (inline in contact.astro)
- Join form → `generate_lead` with `lead_type: 'new_player'` plus `experience_level`, `division_interest`, `season_interest` (inline in join.astro)
- `form_error` on submit failure → `error_type`: `turnstile` | `server` | `network`
- Photo upload → `photo_submit` (inline in admin/photo/index.astro)

Register `form_id`, `form_name`, `lead_type`, `error_type`, `experience_level`, `division_interest`,
`season_interest` as custom dimensions in GA4, and mark `generate_lead` as a Key Event.

## Forms & Email

Both the contact form (`contact.astro`) and the join form (`join.astro`) POST JSON to the
single handler `functions/api/contact.js`. They are plain inline scripts (no framework), each
`preventDefault()` + `fetch`, so native HTML5 `required` validation runs before submit.

- **Which form:** the payload carries `source` (`'contact'` | `'join'`). The handler uses it
  (and `reason === 'New player interest'`) to branch subject lines and confirmation copy.
- **Required fields:** Name, Email, Phone (both forms) and Message (contact). The join form's
  experience/division/season selects always carry a no-pressure default, so they're effectively
  required without friction. Emergency contact on the join form is OPTIONAL by design.
- **Bot protection:** Turnstile (client widget + server `siteverify`) is the primary layer;
  a hidden off-screen honeypot field (`website_url`) is the secondary layer. Avoid timing-based
  honeypots — on a CDN-cached static page they cause false-positives.
- **Email (SendGrid):** sends a team notification, then a best-effort confirmation to the
  submitter. The confirmation includes the FULL submission and is a SEPARATE send so coach
  addresses are never exposed.
  - **Reply-To split:** team notification `Reply-To` = submitter (coach replies reach the
    player); confirmation `Reply-To` = team (submitter replies reach coaches). Preserve this.
  - Subjects: join → `New Player: {name}`; contact → `Contact Form ({reason}): {name}`.
  - Env vars: `SENDGRID_API_KEY`, `CONTACT_EMAIL_TO` (comma-separated), `CONTACT_EMAIL_FROM`,
    `TURNSTILE_SECRET_KEY`. Handler returns a graceful 500 if these are missing.
  - Header fields (subject, names) are run through `sanitizeLine` to strip newlines
    (header-injection guard). Handler logic is covered by an ad-hoc Node test harness.
  - **Deliverability is a DNS task, not code:** SPF/DKIM/DMARC must be set for the sending
    domain in SendGrid — the deciding factor for whether confirmations land in the inbox.

## Recruiting funnel

`/join/` is the primary recruiting destination. All "come play / want to play" CTAs (home hero,
mission, Come Play section, footer) point to `/join/`. The contact page no longer duplicates the
player guide — its "Want to Play?" block is a short pointer to `/join/`. Sponsor links and the
join page's own "ask a question" link still go to `/contact/` (those are genuine contact actions).

## Page Types

### Public pages (indexed, in sitemap)
All pages in `src/data/site.ts` navigation + allPages arrays.

### Orphan/unlisted pages (noindex, excluded from sitemap)
- `/admin/` — Admin tools hub (uses main Layout with Header/Footer)
- `/admin/photo/` — Photo submission (standalone HTML, has own GA4)
- `/admin/dashboard/*` — Login-gated admin tools (AdminLayout, no GA4)
- `/admin/transitions/` — Design reference page

## Photo Submission Workflow

Photos submitted via `/admin/photo/` create GitHub PRs that add images and entries to
`public/images/team/photos.json`. Concurrent submissions can cause merge conflicts because
they branch from the same commit and modify the same JSON array position. Resolution:
manually merge by fetching branches, pulling images, adding entries on main, closing PRs.

## Build & Deploy

```sh
npm run build    # Build to ./dist/
npm run dev      # Local dev server at localhost:4321
npm run preview  # Preview production build
```

Pushes to `main` auto-deploy via Cloudflare Pages.

## Conventions

- Font sizes use CSS custom properties: `--text-xs` through `--text-stat`
- Typography: Barlow Condensed (headings), system fonts (body)
- Colors: `--color-accent` (purple), `--color-surface` (dark navy), `--color-accent-light`
- Admin pages use `noindex` prop on Layout or manual `<meta name="robots">` tag
- Footer uses scoped CSS classes (`.footer-*`), not inline styles
- Headings are Title Case site-wide (e.g. "What It Costs"); short words (of/to/the/vs) stay lowercase
- Forms: mark required fields with an accessible asterisk (`<span aria-hidden>*</span>` + native
  `required`) plus a "Required field" key; label optional fields "(optional)"; success/error
  containers use `role`/`aria-live` and receive focus on submit (WCAG status messages)
- Copy style: no AI clichés, throat-clearing, filler, or weak adjectives; one idea per sentence
