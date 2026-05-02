/**
 * Playing info — shared between homepage "Come Play" and contact page.
 * Update here and both pages stay in sync.
 */

export const playing = {
  seasons: 'Two seasons a year — spring and fall.',
  gameDay: 'Games are on Sunday mornings and afternoons.',
  field: 'Krieg Field',
  fieldUrl: 'https://maps.google.com/?q=Krieg+Field+Austin+TX',
  fieldCity: 'Austin',
  practiceField: 'Southeast Metro Field',
  practiceFieldUrl: 'https://maps.google.com/?q=Southeast+Metropolitan+Park+Del+Valle+TX',
  practiceCity: 'Del Valle (off Hwy 71, just past the airport)',
  practiceNote: 'We practice on weeknights during the spring season. Fall is more casual — just Sunday games, no weeknight practices.',
  league: 'Softball Austin',
  leagueUrl: 'https://www.softballaustin.org/',
  joiningNote: 'Reach out and one of our coaches will walk you through it. You\'ll register through Softball Austin. There\'s a league registration fee and a team fee that covers practice fields, jerseys, and equipment.',
  socialNote: 'We do social events outside of Sunday games too. It\'s a great way to meet people and be part of a community. Players and allies welcome.',
  divisions: [
    {
      name: 'D Division',
      description: 'For players with more experience and competitive play.',
    },
    {
      name: 'E Division',
      description: 'For newer players or those still building their game. No experience needed. We\'re all learning and growing together.',
    },
  ],
} as const;
