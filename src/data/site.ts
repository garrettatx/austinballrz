/**
 * Site-wide configuration.
 * Single source of truth for names, URLs, and settings.
 */

export const site = {
  name: "Austin Ball'rz",
  titleSuffix: "Austin Ball'rz Softball Team",
  tagline: 'LGBTQ+ Inclusive Softball in Austin, TX',
  url: 'https://www.austinballrz.com',
  description: 'Austin Ball\'rz is an LGBTQ+ inclusive softball team in Austin, TX. All skill levels, gender identities, and backgrounds welcome. Playing in Softball Austin since 2013.',
  founded: 2013,
  location: 'Austin, TX',
  league: 'Softball Austin',
  ga4Id: 'G-LEV5K76WRK',
  social: {
    facebook: 'https://www.facebook.com/AustinBallrz',
  },
} as const;

/**
 * Navigation items.
 * Used by Header and mobile nav components.
 */
export const navigation = [
  { label: 'Join', href: '/join/' },
  { label: 'History', href: '/history/' },
  { label: 'Achievements', href: '/achievements/' },
  { label: 'Photos', href: '/photos/' },
  { label: 'Sponsors', href: '/sponsors/' },
  { label: 'Contact', href: '/contact/' },
] as const;

/** All pages in site order — used for footer links and prev/next navigation */
export const allPages = [
  { label: 'Join', href: '/join/' },
  { label: 'History', href: '/history/' },
  { label: 'Achievements', href: '/achievements/' },
  { label: 'Photos', href: '/photos/' },
  { label: 'Sponsors', href: '/sponsors/' },
  { label: 'Contact', href: '/contact/' },
  { label: 'Gear & Equipment', href: '/gear/' },
  { label: 'GoPro Guide', href: '/gopro/' },
] as const;
