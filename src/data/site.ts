/**
 * Site-wide configuration.
 * Single source of truth for names, URLs, and settings.
 */

export const site = {
  name: "Austin Ball'rz",
  tagline: 'LGBTQ+ Inclusive Softball in Austin, TX',
  url: 'https://www.austinballrz.com',
  description: 'Austin Ball\'rz is an LGBTQ+ inclusive softball team playing in Softball Austin, part of the iPride Softball League. Founded in 2013.',
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
  { label: 'Gear', href: '/gear/' },
  { label: 'Contact', href: '/contact/' },
] as const;
