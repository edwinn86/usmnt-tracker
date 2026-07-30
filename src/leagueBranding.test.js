import { describe, expect, it } from 'vitest';
import { leagueDisplayName, leagueStyleClass } from './leagueBranding';

describe('league branding', () => {
  it('uses compact labels outside detailed stat contexts', () => {
    expect(leagueDisplayName('Major League Soccer')).toBe('MLS');
    expect(leagueDisplayName('Premier League 2')).toBe('PL2');
    expect(leagueDisplayName('Liga MX Clausura')).toBe('Liga MX');
  });

  it('preserves meaningful tournament stages in detailed contexts', () => {
    expect(leagueDisplayName('Liga MX Clausura', { detailed: true })).toBe('Liga MX · Clausura');
    expect(leagueDisplayName('Liga MX Apertura Playoff', { detailed: true })).toBe('Liga MX · Apertura Playoff');
    expect(leagueDisplayName('Liga de Expansion MX Apertura', { detailed: true })).toBe('Liga Expansión MX · Apertura');
  });

  it('classifies abbreviated leagues from their source names', () => {
    expect(leagueStyleClass('Major League Soccer')).toBe('league-mls');
    expect(leagueStyleClass('Liga MX Clausura')).toBe('league-liga-mx');
  });
});
