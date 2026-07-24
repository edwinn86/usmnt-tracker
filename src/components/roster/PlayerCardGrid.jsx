import { useEffect, useMemo, useState } from 'react';
import PlayerCard from '../cards/PlayerCard';
import usePlayersData from '../../hooks/usePlayersData';

const SORT_OPTIONS = [
  { value: 'value', label: 'Value (high–low)' },
  { value: 'rating', label: 'Rating (high–low)' },
  { value: 'goals', label: 'Goals (high–low)' },
  { value: 'assists', label: 'Assists (high–low)' },
  { value: 'age', label: 'Age (youngest)' },
  { value: 'name', label: 'Name (A–Z)' },
];
let hasShownSwipeHint = false;

function numericValue(value) {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function ratingColor(rating) {
  if (rating >= 7.4) return '#6ee7b7';
  if (rating >= 7.1) return '#4ade80';
  if (rating >= 6.8) return '#facc15';
  if (rating >= 6.65) return '#fb923c';
  return '#f87171';
}

function PlayerCardGrid({ playerIds }) {
  const { players, loading, error } = usePlayersData(playerIds);
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState('value');
  const [leagueFilter, setLeagueFilter] = useState('all');
  const [minimumRating, setMinimumRating] = useState(null);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const [showSwipeHint, setShowSwipeHint] = useState(() => !hasShownSwipeHint);

  useEffect(() => {
    if (!showSwipeHint) return undefined;

    hasShownSwipeHint = true;
    const timeoutId = window.setTimeout(() => setShowSwipeHint(false), 5200);
    return () => window.clearTimeout(timeoutId);
  }, [showSwipeHint]);

  const leagues = useMemo(
    () => [...new Set(players.map((player) => player.leagueName).filter((league) => league && league !== 'N/A'))]
      .sort((a, b) => a.localeCompare(b)),
    [players]
  );

  const lowestRating = useMemo(() => {
    const ratings = players.map((player) => numericValue(player.rating)).filter((rating) => rating > 0);
    return ratings.length ? Math.min(...ratings) : 0;
  }, [players]);

  const activeMinimumRating = minimumRating ?? lowestRating;
  const activeFilterCount = Number(Boolean(search.trim()))
    + Number(sortBy !== 'value')
    + Number(leagueFilter !== 'all')
    + Number(minimumRating !== null);

  const clearFilters = () => {
    setSearch('');
    setSortBy('value');
    setLeagueFilter('all');
    setMinimumRating(null);
  };

  const visiblePlayers = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    const filtered = players.filter((player) => {
      const matchesName = !query || player.name.toLocaleLowerCase().includes(query);
      const matchesLeague = leagueFilter === 'all' || player.leagueName === leagueFilter;
      const matchesRating = minimumRating === null || numericValue(player.rating) >= activeMinimumRating;
      return matchesName && matchesLeague && matchesRating;
    });

    const direction = sortBy === 'age' || sortBy === 'name' ? 1 : -1;
    return [...filtered].sort((a, b) => {
      if (sortBy === 'name') return a.name.localeCompare(b.name);
      const sortValues = {
        rating: [numericValue(a.rating), numericValue(b.rating)],
        value: [a.marketValueAmount || 0, b.marketValueAmount || 0],
        goals: [numericValue(a.goals), numericValue(b.goals)],
        assists: [numericValue(a.assists), numericValue(b.assists)],
        age: [numericValue(a.age), numericValue(b.age)],
      };
      const [aValue, bValue] = sortValues[sortBy] || [0, 0];
      return (aValue - bValue) * direction || a.name.localeCompare(b.name);
    });
  }, [players, search, leagueFilter, minimumRating, activeMinimumRating, sortBy]);

  if (loading) {
    return (
      <div className="loading-container">
        <div className="spinner"></div>
        <p className="loading-text">
          Loading Roster
          <span className="dot dot-1">.</span>
          <span className="dot dot-2">.</span>
          <span className="dot dot-3">.</span>
        </p>
      </div>
    );
  }

  if (players.length === 0) return <p className="status-message">No players found.</p>;

  return (
    <>
      <section className="roster-tools" aria-label="Roster controls">
        <label className="roster-search">
          <span>Search</span>
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Player name"
          />
        </label>

        <label className="roster-select">
          <span>Sort by</span>
          <select value={sortBy} onChange={(event) => setSortBy(event.target.value)}>
            {SORT_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        </label>

        <label className="roster-select">
          <span>League</span>
          <select value={leagueFilter} onChange={(event) => setLeagueFilter(event.target.value)}>
            <option value="all">All leagues</option>
            {leagues.map((league) => <option key={league} value={league}>{league}</option>)}
          </select>
        </label>

        <label className="rating-filter">
          <span>
            Min. rating
            <strong style={{ color: ratingColor(activeMinimumRating) }}>{activeMinimumRating ? activeMinimumRating.toFixed(2) : 'Any'}</strong>
          </span>
          <input
            type="range"
            min={lowestRating}
            max="10"
            step="0.01"
            value={activeMinimumRating}
            onChange={(event) => setMinimumRating(Number(event.target.value))}
            style={{ '--rating-color': ratingColor(activeMinimumRating) }}
          />
        </label>

        <span className="roster-count">{visiblePlayers.length} of {players.length}</span>
        <span className="desktop-card-hint">Click a card for advanced stats</span>
      </section>

      <div className="mobile-filter-bar">
        <button
          type="button"
          className="mobile-filter-trigger"
          onClick={() => setMobileFiltersOpen(true)}
          aria-haspopup="dialog"
        >
          <svg className="mobile-filter-icon" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M4 7h16M7 12h10M10 17h4" />
          </svg>
          <span>Filters</span>
          {activeFilterCount > 0 && <span className="mobile-filter-count">{activeFilterCount}</span>}
        </button>
        <span className="mobile-result-count">{visiblePlayers.length} players</span>
      </div>

      <div className="player-carousel-shell">
        {showSwipeHint && <div className="mobile-swipe-hint" aria-hidden="true">
          <span>Swipe to browse · tap a card for stats</span>
          <span className="swipe-hint-arrow">→</span>
        </div>}
        <div className="player-grid">
          {visiblePlayers.map((player) => (
            <PlayerCard key={player.id} {...player} />
          ))}
          {visiblePlayers.length === 0 && <p className="status-message">No players match those filters.</p>}
          {error && <p className="status-message error">{error}</p>}
        </div>
      </div>

      {mobileFiltersOpen && (
        <div className="mobile-filter-dialog" role="dialog" aria-modal="true" aria-label="Filter and sort players">
          <button type="button" className="mobile-filter-backdrop" aria-label="Close filters" onClick={() => setMobileFiltersOpen(false)} />
          <section className="mobile-filter-sheet">
            <div className="mobile-filter-sheet-header">
              <h2>Filter &amp; sort</h2>
              <button type="button" className="mobile-filter-close" onClick={() => setMobileFiltersOpen(false)} aria-label="Close filters">×</button>
            </div>

            <label className="mobile-filter-field mobile-filter-search">
              <span>Search player</span>
              <input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Player name" />
            </label>

            <div className="mobile-filter-pair">
              <label className="mobile-filter-field">
                <span>Sort by</span>
                <select value={sortBy} onChange={(event) => setSortBy(event.target.value)}>
                  {SORT_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                </select>
              </label>
              <label className="mobile-filter-field">
                <span>League</span>
                <select value={leagueFilter} onChange={(event) => setLeagueFilter(event.target.value)}>
                  <option value="all">All leagues</option>
                  {leagues.map((league) => <option key={league} value={league}>{league}</option>)}
                </select>
              </label>
            </div>

            <label className="mobile-rating-filter">
              <span>Min. rating <strong style={{ color: ratingColor(activeMinimumRating) }}>{activeMinimumRating ? activeMinimumRating.toFixed(2) : 'Any'}</strong></span>
              <input type="range" min={lowestRating} max="10" step="0.01" value={activeMinimumRating} onChange={(event) => setMinimumRating(Number(event.target.value))} style={{ '--rating-color': ratingColor(activeMinimumRating) }} />
            </label>

            <div className="mobile-filter-actions">
              <button type="button" className="mobile-filter-reset" onClick={clearFilters}>Reset</button>
              <button type="button" className="mobile-filter-apply" onClick={() => setMobileFiltersOpen(false)}>Show {visiblePlayers.length} players</button>
            </div>
          </section>
        </div>
      )}
    </>
  );
}

export default PlayerCardGrid;
