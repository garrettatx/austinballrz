/**
 * Structured data helpers (JSON-LD).
 * Outputs schema.org markup for SEO.
 */

import { site } from '../data/site';

export function organizationSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'SportsTeam',
    name: site.name,
    description: site.description,
    url: site.url,
    foundingDate: String(site.founded),
    sport: 'Softball',
    location: {
      '@type': 'Place',
      name: site.location,
    },
    memberOf: {
      '@type': 'SportsOrganization',
      name: site.league,
    },
    ...(site.social.facebook ? { sameAs: [site.social.facebook] } : {}),
  };
}

export function breadcrumbSchema(items: { label: string; href?: string }[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: item.label,
      ...(item.href && i < items.length - 1
        ? { item: `${site.url}${item.href}` }
        : {}),
    })),
  };
}

export function webPageSchema(title: string, description: string, path: string) {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: title,
    description,
    url: `${site.url}${path}`,
    isPartOf: {
      '@type': 'WebSite',
      name: site.name,
      url: site.url,
    },
  };
}
