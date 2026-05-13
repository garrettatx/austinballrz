/**
 * Structured data helpers (JSON-LD).
 * Outputs schema.org markup for SEO and AI search.
 */

import { site } from '../data/site';

/** Homepage — SportsTeam + WebSite schemas */
export function organizationSchema() {
  return [
    {
      '@context': 'https://schema.org',
      '@type': 'SportsTeam',
      '@id': `${site.url}/#team`,
      name: site.name,
      alternateName: 'Austin Ballrz',
      description: site.description,
      url: site.url,
      foundingDate: String(site.founded),
      sport: 'Softball',
      gender: 'Mixed',
      keywords: 'LGBTQ+ softball, inclusive sports, Austin Texas',
      location: {
        '@type': 'Place',
        name: 'Krieg Field',
        address: {
          '@type': 'PostalAddress',
          addressLocality: 'Austin',
          addressRegion: 'TX',
          addressCountry: 'US',
        },
      },
      memberOf: [
        {
          '@type': 'SportsOrganization',
          name: site.league,
          url: 'https://www.softballaustin.org/',
        },
        {
          '@type': 'SportsOrganization',
          name: 'iPride Softball League',
          url: 'https://www.ipridesoftball.org/',
        },
      ],
      image: `${site.url}/images/team/2023/team-gsws-minneapolis-2023.jpg`,
      logo: `${site.url}/images/logo.svg`,
      ...(site.social.facebook ? { sameAs: [site.social.facebook] } : {}),
    },
    {
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      '@id': `${site.url}/#website`,
      name: site.name,
      url: site.url,
      publisher: { '@id': `${site.url}/#team` },
    },
  ];
}

/** Inner pages — BreadcrumbList */
export function breadcrumbSchema(items: { label: string; href?: string }[]) {
  const allItems = [{ label: 'Home', href: '/' }, ...items];
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: allItems.map((item, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: item.label,
      ...(i < allItems.length - 1
        ? { item: `${site.url}${item.href}` }
        : {}),
    })),
  };
}
