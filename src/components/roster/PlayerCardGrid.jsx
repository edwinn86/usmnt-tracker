import { useEffect, useMemo, useRef, useState } from 'react';
import PlayerCard from '../cards/PlayerCard';
import PlayerTable from './PlayerTable';
import MobileCompactList from './MobileCompactList';
import usePlayersData from '../../hooks/usePlayersData';

const SORT_OPTIONS = [
  { value: 'value', label: 'Value (high–low)' },
  { value: 'rating', label: 'Rating (high–low)' },
  { value: 'goals', label: 'Goals (high–low)' },
  { value: 'assists', label: 'Assists (high–low)' },
  { value: 'matches', label: 'Matches (high-low)' },
  { value: 'age', label: 'Age (youngest)' },
  { value: 'position', label: 'Position (A-Z)' },
  { value: 'league', label: 'League (A-Z)' },
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

function defaultSortDirection(sortKey) {
  return ['name', 'position', 'league', 'age'].includes(sortKey) ? 'asc' : 'desc';
}

function ViewToggle({ view, onChange }) {
  const options = [
    {
      key: 'cards',
      label: 'Cards',
      icon: (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <rect x="4" y="4" width="6" height="7" rx="1" />
          <rect x="14" y="4" width="6" height="7" rx="1" />
          <rect x="4" y="14" width="6" height="6" rx="1" />
          <rect x="14" y="14" width="6" height="6" rx="1" />
        </svg>
      ),
    },
    {
      key: 'table',
      label: 'Table',
      icon: (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M7 6h13M7 12h13M7 18h13" />
          <circle cx="4" cy="6" r="1" />
          <circle cx="4" cy="12" r="1" />
          <circle cx="4" cy="18" r="1" />
        </svg>
      ),
    },
  ];

  return (
    <div className="view-toggle" role="group" aria-label="Roster view">
      {options.map((option) => (
        <button
          key={option.key}
          type="button"
          className={view === option.key ? 'active' : ''}
          onClick={() => onChange(option.key)}
          aria-pressed={view === option.key}
        >
          {option.icon}
          <span>{option.label}</span>
        </button>
      ))}
    </div>
  );
}

function PlayerCardGrid({ playerIds, onOpenAbout }) {
  const { players, loading, error } = usePlayersData(playerIds);
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState('value');
  const [sortDirection, setSortDirection] = useState('desc');
  const [leagueFilter, setLeagueFilter] = useState('all');
  const [minimumRating, setMinimumRating] = useState(null);
  const [view, setView] = useState(() => (
    window.matchMedia('(max-width: 640px)').matches
      && window.localStorage.getItem('usmnt-mobile-view') === 'compact'
      ? 'compact'
      : 'cards'
  ));
  const portraitViewRef = useRef(view === 'compact' ? 'compact' : 'cards');
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const [showSwipeHint, setShowSwipeHint] = useState(() => !hasShownSwipeHint);

  useEffect(() => {
    const mobileQuery = window.matchMedia('(max-width: 640px), (orientation: landscape) and (max-height: 500px) and (max-width: 950px)');
    const landscapePhoneQuery = window.matchMedia('(orientation: landscape) and (max-height: 500px) and (max-width: 950px)');
    const adaptViewToViewport = () => {
      setView((current) => {
        // CSS forces the landscape presentation. Preserve the user's actual
        // view selection so rotating never creates an intermediate state.
        if (landscapePhoneQuery.matches) return current;
        if (mobileQuery.matches) {
          const preferredMobileView = window.localStorage.getItem('usmnt-mobile-view');
          if (current === 'table') return preferredMobileView === 'compact' ? 'compact' : 'cards';
          if (current === 'compact' && preferredMobileView === 'cards') return 'cards';
        }
        if (!mobileQuery.matches && current === 'compact') return 'cards';
        return current;
      });
    };

    adaptViewToViewport();
    mobileQuery.addEventListener('change', adaptViewToViewport);
    landscapePhoneQuery.addEventListener('change', adaptViewToViewport);
    return () => {
      mobileQuery.removeEventListener('change', adaptViewToViewport);
      landscapePhoneQuery.removeEventListener('change', adaptViewToViewport);
    };
  }, []);

  useEffect(() => {
    if (view === 'cards' || view === 'compact') {
      portraitViewRef.current = view;
      window.localStorage.setItem('usmnt-mobile-view', view);
    }
  }, [view]);

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

  const highestRating = useMemo(() => {
    const ratings = players.map((player) => numericValue(player.rating)).filter((rating) => rating > 0);
    return ratings.length ? Math.max(...ratings) : 10;
  }, [players]);

  const activeMinimumRating = minimumRating ?? lowestRating;
  const changeMinimumRating = (value) => {
    // The slider's lowest stop represents "no minimum." This keeps players
    // without a rating visible when the control is returned to its start.
    setMinimumRating(value <= lowestRating ? null : value);
  };
  const activeFilterCount = Number(Boolean(search.trim()))
    + Number(sortBy !== 'value' || sortDirection !== 'desc')
    + Number(leagueFilter !== 'all')
    + Number(minimumRating !== null);

  const clearFilters = () => {
    setSearch('');
    setSortBy('value');
    setSortDirection('desc');
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

    const direction = sortDirection === 'asc' ? 1 : -1;
    return [...filtered].sort((a, b) => {
      if (sortBy === 'name') return a.name.localeCompare(b.name) * direction;
      if (sortBy === 'position') return a.position.localeCompare(b.position) * direction || a.name.localeCompare(b.name);
      if (sortBy === 'league') return a.leagueName.localeCompare(b.leagueName) * direction || a.name.localeCompare(b.name);
      const sortValues = {
        rating: [numericValue(a.rating), numericValue(b.rating)],
        value: [a.marketValueAmount || 0, b.marketValueAmount || 0],
        matches: [numericValue(a.matchesPlayed), numericValue(b.matchesPlayed)],
        goals: [numericValue(a.goals), numericValue(b.goals)],
        assists: [numericValue(a.assists), numericValue(b.assists)],
        age: [numericValue(a.age), numericValue(b.age)],
      };
      const [aValue, bValue] = sortValues[sortBy] || [0, 0];
      return (aValue - bValue) * direction || a.name.localeCompare(b.name);
    });
  }, [players, search, leagueFilter, minimumRating, activeMinimumRating, sortBy, sortDirection]);

  const changeSort = (nextSort) => {
    setSortBy(nextSort);
    setSortDirection(defaultSortDirection(nextSort));
  };

  const toggleTableSort = (nextSort) => {
    if (sortBy === nextSort) {
      setSortDirection((current) => current === 'asc' ? 'desc' : 'asc');
    } else {
      changeSort(nextSort);
    }
  };

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
          <select value={sortBy} onChange={(event) => changeSort(event.target.value)}>
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
            max={highestRating}
            step="0.01"
            value={activeMinimumRating}
            onChange={(event) => changeMinimumRating(Number(event.target.value))}
            style={{ '--rating-color': ratingColor(activeMinimumRating) }}
          />
        </label>

        <span className="roster-count">{visiblePlayers.length} of {players.length}</span>

        <div className="roster-view-control">
          <span>View</span>
          <ViewToggle view={view} onChange={setView} />
        </div>

        <div className="roster-summary">
          {view === 'cards' && (
            <span className="desktop-card-hint">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <rect x="5" y="3.5" width="14" height="17" rx="3" />
                <path d="M9 8h6M9 12h6" />
              </svg>
              Flip a card for advanced stats
            </span>
          )}
        </div>
      </section>

      <div className="mobile-filter-bar">
        <button
          type="button"
          className={`mobile-view-trigger ${view === 'compact' ? 'active' : ''}`}
          onClick={() => setView((current) => current === 'compact' ? 'cards' : 'compact')}
          aria-label={view === 'compact' ? 'Switch to card view' : 'Switch to compact view'}
          title={view === 'compact' ? 'Card view' : 'Compact view'}
        >
          {view === 'compact' ? (
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <rect x="4" y="4" width="6" height="7" rx="1" />
              <rect x="14" y="4" width="6" height="7" rx="1" />
              <rect x="4" y="14" width="6" height="6" rx="1" />
              <rect x="14" y="14" width="6" height="6" rx="1" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M7 6h13M7 12h13M7 18h13" />
              <circle cx="4" cy="6" r="1" />
              <circle cx="4" cy="12" r="1" />
              <circle cx="4" cy="18" r="1" />
            </svg>
          )}
        </button>
        <button
          type="button"
          className="mobile-filter-trigger"
          onClick={() => setMobileFiltersOpen(true)}
          aria-haspopup="dialog"
        >
          <svg className="mobile-filter-icon" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M4 7h16M7 12h10M10 17h4" />
          </svg>
          <span className="mobile-filter-label">Filter</span>
          {activeFilterCount > 0 && <span className="mobile-filter-count">{activeFilterCount}</span>}
        </button>
        <span className="mobile-result-count">{visiblePlayers.length} players</span>
      </div>

      <div className="roster-view-stage" data-mobile-view={view === 'compact' ? 'compact' : 'cards'}>
      {view !== 'table' ? <>
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
        <MobileCompactList
          players={visiblePlayers}
          error={error}
          sortBy={sortBy}
          sortDirection={sortDirection}
          onSort={toggleTableSort}
        />
      </> : (
        <PlayerTable
          players={visiblePlayers}
          error={error}
          sortBy={sortBy}
          sortDirection={sortDirection}
          onSort={toggleTableSort}
        />
      )}
      </div>

      {mobileFiltersOpen && (
        <div className="mobile-filter-dialog" role="dialog" aria-modal="true" aria-label="Filter players">
          <button type="button" className="mobile-filter-backdrop" aria-label="Close filters" onClick={() => setMobileFiltersOpen(false)} />
          <section className="mobile-filter-sheet">
            <div className="mobile-filter-sheet-header">
              <h2>Filter</h2>
              <button type="button" className="mobile-filter-close" onClick={() => setMobileFiltersOpen(false)} aria-label="Close filters">×</button>
            </div>

            <label className="mobile-filter-field mobile-filter-search">
              <span>Search player</span>
              <input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Player name" />
            </label>

            <div className="mobile-filter-pair">
              <label className="mobile-filter-field">
                <span>Sort by</span>
                <select value={sortBy} onChange={(event) => changeSort(event.target.value)}>
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
              <input type="range" min={lowestRating} max={highestRating} step="0.01" value={activeMinimumRating} onChange={(event) => changeMinimumRating(Number(event.target.value))} style={{ '--rating-color': ratingColor(activeMinimumRating) }} />
            </label>

            <div className="mobile-filter-actions">
              <button type="button" className="mobile-filter-reset" onClick={clearFilters}>Reset</button>
              <button type="button" className="mobile-filter-apply" onClick={() => setMobileFiltersOpen(false)}>Show {visiblePlayers.length} players</button>
            </div>
            <button
              type="button"
              className="mobile-about-trigger"
              onClick={() => {
                setMobileFiltersOpen(false);
                onOpenAbout?.();
              }}
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <circle cx="12" cy="12" r="8.5" />
                <path d="M12 10.5v6M12 7.5h.01" />
              </svg>
              About this tracker
            </button>
          </section>
        </div>
      )}
    </>
  );
}

export default PlayerCardGrid;
