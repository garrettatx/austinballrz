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
- `src/scripts/analytics.ts` — GA4 event tracking (nav clicks, CTA clicks, photo views)
- `astro.config.mjs` — Sitemap filter excludes `/admin/`

## GA4 Analytics

GA4 ID is centralized in `site.ts` as `site.ga4Id`. The deferred loader delays gtag.js until
first user interaction or 3 seconds. Events are documented in `src/scripts/analytics.ts`.

Key events: `page_view`, `nav_click`, `cta_click`, `form_start`, `generate_lead`, `form_error`, `photo_submit`, `photo_view`.

Form tracking (both forms carry `form_id` and `form_name`):
- `form_start` → first field focus, once per page load
- Contact form → `generate_lead` with `lead_type` from the reason dropdown (inline in contact.astro)
- Join form → `generate_lead` with `lead_type: 'new_player'` plus `experience_level`, `division_interest`, `season_interest` (inline in join.astro)
- `form_error` on submit failure → `error_type`: `turnstile` | `server` | `network`
- Photo upload → `photo_submit` (inline in admin/photo/index.astro)

Register `form_id`, `form_name`, `lead_type`, `error_type`, `experience_level`, `division_interest`,
`season_interest` as custom dimensions in GA4, and mark `generate_lead` as a Key Event.

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
