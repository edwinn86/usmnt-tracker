export function leagueStyleClass(leagueName = '') {
  const name = leagueName.toLowerCase();
  if (name.includes('belgian pro league') || name === 'pro league') return 'league-belgian-pro-league';
  if (name.includes('premier league')) return 'league-premier-league';
  if (name.includes('usl championship')) return 'league-usl';
  if (name.includes('championship')) return 'league-championship';
  if (name.includes('serie a')) return 'league-serie-a';
  if (name.includes('serie b')) return 'league-serie-b';
  if (name.includes('bundesliga')) return 'league-bundesliga';
  if (name.includes('ligue 1')) return 'league-ligue-1';
  if (name.includes('eredivisie')) return 'league-eredivisie';
  if (name.includes('mls next pro')) return 'league-mls-next-pro';
  if (name.includes('major league soccer') || name === 'mls') return 'league-mls';
  if (name.includes('liga de expansion mx') || name.includes('liga de expansión mx')) return 'league-expansion-mx';
  if (name.includes('liga mx')) return 'league-liga-mx';
  if (name.includes('liga portugal')) return 'league-liga-portugal';
  if (name.includes('la liga') || name.includes('laliga') || name.includes('primera división') || name.includes('primera division')) return 'league-la-liga';
  if (name === 'hnl') return 'league-hnl';
  if (name === 'premiership') return 'league-premiership';
  if (name.includes('superligaen')) return 'league-superligaen';
  return '';
}

export function leagueWordmarkClass(leagueName = '', additionalClass = '') {
  return ['league-wordmark', leagueStyleClass(leagueName), additionalClass].filter(Boolean).join(' ');
}

export function leagueDisplayName(leagueName = '', { detailed = false } = {}) {
  const name = leagueName.trim();
  const normalized = name.toLowerCase();

  if (normalized.includes('major league soccer playoff')) return 'MLS Playoffs';
  if (normalized === 'major league soccer') return 'MLS';

  if (normalized.startsWith('premier league 2 div 2')) return 'PL2 Div 2';
  if (normalized.startsWith('premier league 2')) return 'PL2';

  if (normalized.startsWith('liga de expansion mx') || normalized.startsWith('liga de expansión mx')) {
    if (!detailed) return 'Liga Expansión MX';
    const stage = name.match(/\b(Apertura|Clausura|Playoff)\b/i)?.[0];
    return stage ? `Liga Expansión MX · ${stage}` : 'Liga Expansión MX';
  }

  if (normalized.startsWith('liga mx')) {
    if (!detailed) return 'Liga MX';
    const stage = name.match(/\b(Guard1anes\s+)?(Apertura|Clausura)(?:\s+Playoff)?\b/i)?.[0];
    return stage ? `Liga MX · ${stage}` : 'Liga MX';
  }

  return name;
}
