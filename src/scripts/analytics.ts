/**
 * Austin Ball'rz — GA4 Analytics (direct, no GTM)
 *
 * GA4 ID is centralized in src/data/site.ts and injected via define:vars.
 * The deferred loader (in Layout.astro and admin/photo/index.astro) delays
 * gtag.js until first user interaction or 3 seconds, whichever comes first.
 *
 * Events:
 *   page_view      — every Astro navigation (including View Transitions)
 *   nav_click      — header, mobile, footer nav link clicks
 *   cta_click      — hero buttons and other conversion-oriented links
 *   generate_lead  — contact/join form submission (inline in contact.astro, join.astro)
 *   phone_click    — tel: link clicks (future-proofed)
 *   photo_view     — photo modal opened
 *   photo_submit   — photo uploaded via /admin/photo/ (inline in admin/photo/index.astro)
 */

export {};

declare global {
  interface Window {
    gtag: (...args: unknown[]) => void;
    dataLayer: unknown[];
  }
}

function track(event: string, params?: Record<string, unknown>) {
  if (typeof window.gtag === 'function') {
    window.gtag('event', event, params);
  }
}

// ── Virtual pageview on Astro View Transition navigation ──────────
let isFirstLoad = true;

document.addEventListener('astro:page-load', () => {
  if (isFirstLoad) {
    isFirstLoad = false;
    return; // gtag config already sends initial pageview
  }

  track('page_view', {
    page_path: window.location.pathname,
    page_title: document.title,
    page_location: window.location.href,
  });
});

// ── Click tracking (event delegation) ─────────────────────────────
if (!(window as { __ballrzAnalyticsInit?: boolean }).__ballrzAnalyticsInit) {
  (window as { __ballrzAnalyticsInit?: boolean }).__ballrzAnalyticsInit = true;

  document.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;
    const link = target.closest('a') as HTMLAnchorElement | null;
    const button = target.closest('button') as HTMLButtonElement | null;

    // ── Nav clicks ──
    if (link) {
      const headerNav = link.closest('nav[aria-label="Main navigation"]');
      if (headerNav) {
        track('nav_click', {
          link_text: link.textContent?.trim(),
          link_url: link.getAttribute('href'),
          nav_type: 'header',
        });
        return;
      }

      const mobileNav = link.closest('nav[aria-label="Mobile navigation"]');
      if (mobileNav) {
        track('nav_click', {
          link_text: link.textContent?.trim(),
          link_url: link.getAttribute('href'),
          nav_type: 'mobile',
        });
        return;
      }

      const footer = link.closest('footer');
      if (footer) {
        track('nav_click', {
          link_text: link.textContent?.trim(),
          link_url: link.getAttribute('href'),
          nav_type: 'footer',
        });
        return;
      }

      // ── CTA button clicks ──
      if (link.classList.contains('btn')) {
        track('cta_click', {
          cta_text: link.textContent?.trim(),
          cta_url: link.getAttribute('href'),
          page_path: window.location.pathname,
        });
        return;
      }

      // ── Phone clicks (future-proofed) ──
      const href = link.getAttribute('href') || '';
      if (href.startsWith('tel:')) {
        track('phone_click', {
          phone_number: href.replace('tel:', ''),
          page_path: window.location.pathname,
        });
        return;
      }
    }

    // ── Photo modal opens ──
    const photoBtn = target.closest('.photo-open');
    if (photoBtn) {
      track('photo_view', {
        photo_alt: (photoBtn as HTMLElement).dataset.alt || '',
      });
    }
  }, { passive: true });
}
