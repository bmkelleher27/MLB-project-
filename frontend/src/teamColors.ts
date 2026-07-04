const TEAM_COLORS: Record<number, { bg: string; text: string }> = {
  108: { bg: '#BA0021', text: '#fff' }, // Angels
  109: { bg: '#A71930', text: '#fff' }, // Diamondbacks
  110: { bg: '#DF4601', text: '#fff' }, // Orioles
  111: { bg: '#BD3039', text: '#fff' }, // Red Sox
  112: { bg: '#0E3386', text: '#fff' }, // Cubs
  113: { bg: '#C6011F', text: '#fff' }, // Reds
  114: { bg: '#00385D', text: '#fff' }, // Guardians
  115: { bg: '#33006F', text: '#fff' }, // Rockies
  116: { bg: '#0C2340', text: '#fff' }, // Tigers
  117: { bg: '#002D62', text: '#fff' }, // Astros
  118: { bg: '#004687', text: '#fff' }, // Royals
  119: { bg: '#005A9C', text: '#fff' }, // Dodgers
  120: { bg: '#AB0003', text: '#fff' }, // Nationals
  121: { bg: '#002D72', text: '#fff' }, // Mets
  133: { bg: '#003831', text: '#EFB21E' }, // Athletics
  134: { bg: '#FFC425', text: '#27251F' }, // Pirates
  135: { bg: '#2F241D', text: '#fff' }, // Padres
  136: { bg: '#0C2C56', text: '#fff' }, // Mariners
  137: { bg: '#FD5A1E', text: '#fff' }, // Giants
  138: { bg: '#C41E3A', text: '#fff' }, // Cardinals
  139: { bg: '#092C5C', text: '#8FBCE6' }, // Rays
  140: { bg: '#003278', text: '#fff' }, // Rangers
  141: { bg: '#134A8E', text: '#fff' }, // Blue Jays
  142: { bg: '#002B5C', text: '#fff' }, // Twins
  143: { bg: '#E81828', text: '#fff' }, // Phillies
  144: { bg: '#CE1141', text: '#fff' }, // Braves
  145: { bg: '#27251F', text: '#fff' }, // White Sox
  146: { bg: '#00A3E0', text: '#fff' }, // Marlins
  147: { bg: '#132448', text: '#fff' }, // Yankees
  158: { bg: '#12284B', text: '#FFC52F' }, // Brewers
};

export function getTeamColor(teamId: number): { bg: string; text: string } {
  return TEAM_COLORS[teamId] ?? { bg: 'var(--accent-bg)', text: 'var(--text)' };
}

/** The team's raw hex background, or null when it falls back to a CSS token. */
export function getTeamHex(teamId: number): string | null {
  const bg = TEAM_COLORS[teamId]?.bg;
  return bg && bg.startsWith('#') ? bg : null;
}
