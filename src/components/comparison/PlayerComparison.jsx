import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import usePlayersData, { fetchCompetitionStats } from '../../hooks/usePlayersData';

const GROUP_ORDER = ['Shooting', 'Passing', 'Possession', 'Defending', 'Discipline'];
const LOWER_IS_BETTER = [
  /yellow cards?/i,
  /red cards?/i,
  /fouls committed/i,
  /dispossessed/i,
  /dribbled past/i,
  /goals conceded/i,
  /xg against/i,
];

function displayedValue(metric, mode) {
  if (!metric) return null;
  const value = metric.isRate || mode === 'totals' ? metric.total : metric.per90;
  return Number.isFinite(value) ? value : null;
}

function displayedPercentile(metric, mode) {
  if (!metric) return null;
  const value = metric.isRate || mode === 'totals'
    ? metric.totalPercentile
    : metric.per90Percentile;
  return Number.isFinite(value) ? Math.min(99, Math.round(value)) : null;
}

function formatValue(metric, mode) {
  const value = displayedValue(metric, mode);
  if (value === null) return '—';
  const precision = metric.suffix === '%'
    ? 1
    : mode === 'totals' && metric.statFormat === 'number'
      ? 0
      : 2;
  return `${value.toFixed(precision)}${metric.suffix === '%' ? '%' : ''}`;
}

function ordinal(value) {
  const mod100 = value % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${value}th`;
  return `${value}${({ 1: 'st', 2: 'nd', 3: 'rd' }[value % 10] || 'th')}`;
}

function percentileColor(percentile) {
  return `hsl(${(Math.max(0, Math.min(99, percentile)) / 99) * 120}, 75%, 42%)`;
}

function defaultConfigForPlayer(player) {
  const season = player.season || player.availableSeasons[0] || '';
  const seasonEntry = player.seasonEntries.find((entry) => entry.seasonName === season)
    || player.seasonEntries[0]
    || {};
  const competition = seasonEntry.competitions?.find((item) => String(item.entryId) === String(seasonEntry.defaultCompetitionId))
    || seasonEntry.competitions?.find((item) => item.hasDeepStats)
    || seasonEntry.competitions?.[0];
  return {
    season: seasonEntry.seasonName || season,
    competitionId: competition?.entryId || '',
    stats: null,
    loading: false,
    error: null,
  };
}

function CloseIcon() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true">
      <path d="M4 4l8 8M12 4l-8 8" />
    </svg>
  );
}

function PlayerSlot({
  slot,
  player,
  players,
  selectedIds,
  loading,
  config,
  onSelect,
  onClear,
  onRemoveSlot,
  onSeasonChange,
  onCompetitionChange,
}) {
  const [query, setQuery] = useState('');
  const [focused, setFocused] = useState(false);
  const inputRef = useRef(null);
  const searchRegionRef = useRef(null);
  const previousPlayerRef = useRef(player);

  useEffect(() => {
    const shouldFocusSearch = Boolean(previousPlayerRef.current) && !player;
    previousPlayerRef.current = player;
    if (!shouldFocusSearch) return undefined;

    const frame = requestAnimationFrame(() => {
      inputRef.current?.focus();
      setFocused(true);
    });
    return () => cancelAnimationFrame(frame);
  }, [player]);

  const suggestions = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase();
    if (!normalized) return players.filter((candidate) => !selectedIds.has(candidate.id)).slice(0, 5);
    return players
      .filter((candidate) => !selectedIds.has(candidate.id) && candidate.name.toLocaleLowerCase().includes(normalized))
      .sort((a, b) => {
        const aStarts = a.name.toLocaleLowerCase().startsWith(normalized);
        const bStarts = b.name.toLocaleLowerCase().startsWith(normalized);
        return Number(bStarts) - Number(aStarts) || a.name.localeCompare(b.name);
      })
      .slice(0, 5);
  }, [players, query, selectedIds]);

  const choosePlayer = (nextPlayer) => {
    onSelect(slot, nextPlayer);
    setQuery('');
    setFocused(false);
  };

  const seasonEntry = player
    ? player.seasonEntries.find((entry) => entry.seasonName === config?.season) || player.seasonEntries[0] || {}
    : {};
  const competitions = seasonEntry.competitions || [];

  return (
    <section className={`comparison-player-slot ${player ? 'filled' : ''}`}>
      <header>
        <span>Player {slot + 1}</span>
        <div className="comparison-slot-actions">
          {player && (
            <button type="button" className="comparison-change-player" onClick={() => onClear(slot)} aria-label={`Change ${player.name}`}>
              Change
            </button>
          )}
          {slot > 1 && (
            <button
              type="button"
              className="comparison-remove-slot"
              onClick={() => onRemoveSlot(slot)}
              aria-label={`Remove player ${slot + 1} slot`}
              title={`Remove player ${slot + 1} slot`}
            >
              <CloseIcon />
            </button>
          )}
        </div>
      </header>

      {player ? (
        <>
          <div className="comparison-slot-player">
            <img src={player.photoUrl} alt="" />
            <span>
              <strong>{player.name}</strong>
              <small>{player.position} · {seasonEntry.teamName || player.teamName}</small>
            </span>
          </div>
          <div className="comparison-slot-config">
            <label>
              <span>Season</span>
              <select value={config?.season || ''} onChange={(event) => onSeasonChange(player, event.target.value)} aria-label={`${player.name} season`}>
                {player.availableSeasons.map((season) => <option key={season}>{season}</option>)}
              </select>
            </label>
            <label>
              <span>Competition</span>
              <select value={config?.competitionId || ''} onChange={(event) => onCompetitionChange(player.id, event.target.value)} aria-label={`${player.name} competition`}>
                {competitions.map((competition) => (
                  <option key={competition.entryId} value={competition.entryId}>
                    {competition.name}{competition.hasDeepStats ? '' : ' (summary)'}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </>
      ) : (
        <div
          ref={searchRegionRef}
          className="comparison-slot-search"
          onBlur={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget)) setFocused(false);
          }}
        >
          <input
            ref={inputRef}
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onFocus={() => setFocused(true)}
            placeholder={loading ? 'Loading players…' : 'Start typing a player name'}
            aria-label={`Search for player ${slot + 1}`}
            disabled={loading}
            autoFocus={slot === 0}
          />
          {focused && !loading && (
            <div className="comparison-slot-suggestions" role="listbox" aria-label={`Suggestions for player ${slot + 1}`}>
              {suggestions.map((candidate) => (
                <button type="button" key={candidate.id} onMouseDown={(event) => event.preventDefault()} onClick={() => choosePlayer(candidate)} role="option">
                  <img src={candidate.photoUrl} alt="" />
                  <span><strong>{candidate.name}</strong><small>{candidate.position} · {candidate.teamName}</small></span>
                  <b>Select</b>
                </button>
              ))}
              {query && suggestions.length === 0 && <p>No matching unselected players.</p>}
            </div>
          )}
        </div>
      )}
    </section>
  );
}

function PlayerPicker({
  players,
  loading,
  error,
  selected,
  configs,
  onSelect,
  onClear,
  onAddSlot,
  onRemoveSlot,
  onCompare,
  onClose,
  onSeasonChange,
  onCompetitionChange,
}) {
  const selectedPlayers = selected.filter(Boolean);
  const selectedIds = useMemo(
    () => new Set(selected.filter(Boolean).map((player) => player.id)),
    [selected]
  );

  return (
    <section className="comparison-picker" aria-labelledby="comparison-picker-title">
      <header className="comparison-picker-header">
        <div>
          <span>Player comparison</span>
          <h2 id="comparison-picker-title">Choose 2–4 players</h2>
          <p>Search the full player pool, then compare every available advanced statistic.</p>
        </div>
        <button type="button" className="comparison-close" onClick={onClose} aria-label="Close comparison">
          <CloseIcon />
        </button>
      </header>

      <div className="comparison-picker-body">
        {error && <p className="comparison-picker-error">{error}</p>}
        <div className="comparison-player-slots" aria-label="Comparison player order">
          {selected.map((player, slot) => (
            <PlayerSlot
              key={slot}
              slot={slot}
              player={player}
              players={players}
              selectedIds={selectedIds}
              loading={loading}
              config={player ? configs[player.id] : null}
              onSelect={onSelect}
              onClear={onClear}
              onRemoveSlot={onRemoveSlot}
              onSeasonChange={onSeasonChange}
              onCompetitionChange={onCompetitionChange}
            />
          ))}
          {selected.length < 4 && (
            <button type="button" className="comparison-add-slot" onClick={onAddSlot}>
              <span>+</span>
              <strong>Add player {selected.length + 1}</strong>
              <small>Optional comparison slot</small>
            </button>
          )}
        </div>
      </div>

      <footer className="comparison-picker-footer">
        <span>{selectedPlayers.length < 2 ? `Select ${2 - selectedPlayers.length} more` : `${selectedPlayers.length} players ready`}</span>
        <button type="button" disabled={selectedPlayers.length < 2} onClick={onCompare}>Compare players</button>
      </footer>
    </section>
  );
}

function PlayerHeader({ player, config }) {
  const seasonEntry = player.seasonEntries.find((entry) => entry.seasonName === config.season)
    || player.seasonEntries[0]
    || {};
  return (
    <article className="comparison-player-header">
      <img src={player.photoUrl} alt="" />
      <div className="comparison-player-identity">
        <h3>{player.name}</h3>
        <p>{player.position} · {seasonEntry.teamName || player.teamName}</p>
      </div>
      <div className="comparison-player-sample">
        <span><b>{config.stats?.matches ?? seasonEntry.matches ?? 0}</b> matches</span>
        <span><b>{config.stats?.minutes ?? seasonEntry.minutes ?? 0}</b> min</span>
      </div>
    </article>
  );
}

function ComparisonResults({ players, configs, setConfigs, onBack }) {
  const [mode, setMode] = useState('per90');

  useEffect(() => {
    players.forEach((player) => {
      const config = configs[player.id];
      if (!config?.competitionId || config.loading || config.stats || config.error) return;
      const seasonEntry = player.seasonEntries.find((entry) => entry.seasonName === config.season) || {};
      const competition = seasonEntry.competitions?.find((item) => String(item.entryId) === String(config.competitionId));
      if (!competition?.hasDeepStats) {
        setConfigs((current) => ({
          ...current,
          [player.id]: { ...current[player.id], error: 'Advanced stats unavailable for this competition.' },
        }));
        return;
      }
      setConfigs((current) => ({
        ...current,
        [player.id]: { ...current[player.id], loading: true },
      }));
      fetchCompetitionStats(player.id, config.competitionId)
        .then((stats) => setConfigs((current) => ({
          ...current,
          [player.id]: { ...current[player.id], stats, loading: false, error: null },
        })))
        .catch((error) => setConfigs((current) => ({
          ...current,
          [player.id]: { ...current[player.id], loading: false, error: error.message },
        })));
    });
  }, [players, configs, setConfigs]);

  const groups = useMemo(() => {
    const groupMap = new Map();
    players.forEach((player) => {
      (configs[player.id]?.stats?.fullStatGroups || []).forEach((group) => {
        if (!groupMap.has(group.title)) groupMap.set(group.title, new Map());
        const metrics = groupMap.get(group.title);
        group.metrics.forEach((metric) => {
          const metricKey = String(metric.key || metric.label).toLocaleLowerCase();
          if (!metrics.has(metricKey)) metrics.set(metricKey, { key: metricKey, label: metric.label });
        });
      });
    });
    return [...groupMap.entries()]
      .map(([title, metrics]) => ({ title, metrics: [...metrics.values()] }))
      .sort((a, b) => {
        const aIndex = GROUP_ORDER.indexOf(a.title);
        const bIndex = GROUP_ORDER.indexOf(b.title);
        return (aIndex < 0 ? 99 : aIndex) - (bIndex < 0 ? 99 : bIndex);
      });
  }, [players, configs]);

  const metricFor = (playerId, groupTitle, metricKey) => {
    const group = configs[playerId]?.stats?.fullStatGroups?.find((item) => item.title === groupTitle);
    return group?.metrics.find((metric) => String(metric.key || metric.label).toLocaleLowerCase() === metricKey);
  };

  const winnerIds = (groupTitle, metric) => {
    const values = players.map((player) => ({
      id: player.id,
      value: displayedValue(metricFor(player.id, groupTitle, metric.key), mode),
    })).filter((entry) => entry.value !== null);
    if (values.length < 2) return new Set();
    const target = LOWER_IS_BETTER.some((pattern) => pattern.test(metric.label))
      ? Math.min(...values.map((entry) => entry.value))
      : Math.max(...values.map((entry) => entry.value));
    const winners = values.filter((entry) => Math.abs(entry.value - target) < 0.000001);
    if (winners.length === values.length) return new Set();
    return new Set(winners.map((entry) => entry.id));
  };

  const anyLoading = players.some((player) => configs[player.id]?.loading);
  const readyCount = players.filter((player) => configs[player.id]?.stats).length;

  return (
    <section className="comparison-results" aria-label="Player comparison results">
      <header className="comparison-results-toolbar">
        <button type="button" className="comparison-back" onClick={onBack}>← Edit comparison</button>
        <div className="comparison-results-actions">
          <div className="comparison-mode" role="group" aria-label="Comparison display mode">
            <button type="button" className={mode === 'totals' ? 'active' : ''} onClick={() => setMode('totals')}>Totals</button>
            <button type="button" className={mode === 'per90' ? 'active' : ''} onClick={() => setMode('per90')}>Per 90</button>
          </div>
        </div>
      </header>

      <div
        className="comparison-scroll"
        onScroll={(event) => {
          const progress = Math.min(1, Math.max(0, event.currentTarget.scrollTop / 52));
          const style = event.currentTarget.style;
          event.currentTarget.classList.toggle('headers-fully-collapsed', progress >= 0.98);
          style.setProperty('--comparison-header-clip', `${52 * progress}px`);
          style.setProperty('--comparison-header-padding', `${7 - (2 * progress)}px`);
          style.setProperty('--comparison-header-gap', `${6 * (1 - progress)}px`);
          style.setProperty('--comparison-photo-size', `${30 * (1 - progress)}px`);
          style.setProperty('--comparison-detail-height', `${20 * (1 - progress)}px`);
          style.setProperty('--comparison-sample-height', `${18 * (1 - progress)}px`);
          style.setProperty('--comparison-detail-opacity', String(1 - progress));
          style.setProperty('--comparison-name-size', `${0.68 - (0.05 * progress)}rem`);
        }}
      >
        <div className="comparison-table" style={{ '--comparison-players': players.length }}>
          <div className="comparison-corner">
            <strong>Stats</strong>
          </div>
          {players.map((player) => (
            <PlayerHeader
              key={player.id}
              player={player}
              config={configs[player.id]}
            />
          ))}

          {anyLoading && groups.length === 0 && (
            <div className="comparison-loading-row" style={{ gridColumn: `1 / span ${players.length + 1}` }}>
              Loading advanced statistics for {players.length} players…
            </div>
          )}

          {!anyLoading && readyCount < 2 && groups.length === 0 && (
            <div className="comparison-loading-row error" style={{ gridColumn: `1 / span ${players.length + 1}` }}>
              At least two selected competitions need advanced statistics.
            </div>
          )}

          {groups.map((group) => (
            <div className="comparison-group-contents" key={group.title}>
              <div className="comparison-group-title" style={{ gridColumn: `1 / span ${players.length + 1}` }}>{group.title}</div>
              {group.metrics.map((metric) => {
                const winners = winnerIds(group.title, metric);
                return (
                  <div className="comparison-metric-contents" key={`${group.title}-${metric.key}`}>
                    <div className="comparison-metric-name">{metric.label}</div>
                    {players.map((player) => {
                      const playerMetric = metricFor(player.id, group.title, metric.key);
                      const percentile = displayedPercentile(playerMetric, mode);
                      return (
                        <div className={`comparison-value ${winners.has(player.id) ? 'winner' : ''}`} key={player.id}>
                          <strong>{formatValue(playerMetric, mode)}</strong>
                          {percentile === null ? (
                            <span className="comparison-no-percentile">No percentile</span>
                          ) : (
                            <div className="comparison-percentile">
                              <i><b style={{ width: `${(percentile / 99) * 100}%`, backgroundColor: percentileColor(percentile) }} /></i>
                              <span>{ordinal(percentile)}</span>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function PlayerComparison({ playerIds, onClose }) {
  const { players, loading, error } = usePlayersData(playerIds);
  const [selected, setSelected] = useState([null, null]);
  const [configs, setConfigs] = useState({});
  const [comparing, setComparing] = useState(false);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const closeOnEscape = (event) => {
      if (event.key === 'Escape') onCloseRef.current();
    };
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, []);

  const selectPlayer = (slot, player) => {
    setSelected((current) => current.map((item, index) => index === slot ? player : item));
    setConfigs((current) => ({
      ...current,
      [player.id]: current[player.id] || defaultConfigForPlayer(player),
    }));
  };

  const changeSeason = (player, season) => {
    const seasonEntry = player.seasonEntries.find((entry) => entry.seasonName === season) || {};
    const competition = seasonEntry.competitions?.find((item) => item.hasDeepStats)
      || seasonEntry.competitions?.[0];
    setConfigs((current) => ({
      ...current,
      [player.id]: {
        season,
        competitionId: competition?.entryId || '',
        stats: null,
        loading: false,
        error: null,
      },
    }));
  };

  const changeCompetition = (playerId, competitionId) => {
    setConfigs((current) => ({
      ...current,
      [playerId]: {
        ...current[playerId],
        competitionId,
        stats: null,
        loading: false,
        error: null,
      },
    }));
  };

  return createPortal(
    <div className="comparison-overlay" role="dialog" aria-modal="true" aria-label="Compare players">
      {comparing ? (
        <ComparisonResults
          players={selected.filter(Boolean)}
          configs={configs}
          setConfigs={setConfigs}
          onBack={() => setComparing(false)}
        />
      ) : (
        <PlayerPicker
          players={players}
          loading={loading}
          error={error}
          selected={selected}
          configs={configs}
          onSelect={selectPlayer}
          onClear={(slot) => setSelected((current) => current.map((item, index) => index === slot ? null : item))}
          onAddSlot={() => setSelected((current) => current.length < 4 ? [...current, null] : current)}
          onRemoveSlot={(slot) => setSelected((current) => current.filter((_, index) => index !== slot))}
          onCompare={() => setComparing(true)}
          onClose={onClose}
          onSeasonChange={changeSeason}
          onCompetitionChange={changeCompetition}
        />
      )}
    </div>,
    document.body
  );
}

export default PlayerComparison;
