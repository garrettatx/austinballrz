/**
 * Site-wide configuration.
 * Single source of truth for names, URLs, and settings.
 */

export const site = {
  name: 'Austin Ballrz',
  tagline: 'LGBTQ+ Inclusive Softball in Austin, TX',
  url: 'https://www.austinballrz.com',
  description: 'Austin Ballrz is an LGBTQ+ inclusive softball team competing in Softball Austin. Founded in 2013, we welcome players of all backgrounds.',
  founded: 2013,
  location: 'Austin, TX',
  league: 'Softball Austin',
  social: {
    facebook: 'https://www.facebook.com/AustinBallrz',
  },
} as const;

/**
 * GTM container ID. Set to empty string to disable.
 * Only loads on production domain (see Layout.astro).
 */
export const gtmId = '';

/**
 * Navigation items.
 * Used by Header and mobile nav components.
 */
export const navigation = [
  { label: 'History', href: '/history/' },
  { label: 'Achievements', href: '/achievements/' },
  { label: 'Photos', href: '/photos/' },
  { label: 'Sponsors', href: '/sponsors/' },
  { label: 'Contact', href: '/contact/' },
] as const;
