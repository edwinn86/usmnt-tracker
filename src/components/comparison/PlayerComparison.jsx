import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import usePlayersData, { fetchCompetitionStats } from '../../hooks/usePlayersData';
import { leagueDisplayName, leagueWordmarkClass } from '../../leagueBranding';

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

const POSITION_ABBREVIATIONS = {
  Keeper: 'GK',
  Goalkeeper: 'GK',
  'Center Back': 'CB',
  'Left Back': 'LB',
  'Right Back': 'RB',
  'Left Wing-Back': 'LWB',
  'Right Wing-Back': 'RWB',
  'Defensive Midfielder': 'CDM',
  'Central Midfielder': 'CM',
  'Attacking Midfielder': 'CAM',
  'Left Midfielder': 'LM',
  'Right Midfielder': 'RM',
  'Left Winger': 'LW',
  'Right Winger': 'RW',
  Striker: 'ST',
  Forward: 'ST',
  'Second Striker': 'CF',
};

function shortPosition(position) {
  return POSITION_ABBREVIATIONS[position] || position;
}

function comparisonKey(playerId, season, competitionId) {
  return `${playerId}::${season}::${competitionId}`;
}

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

function defaultConfigForPlayer(player, unavailable = new Set()) {
  const preferredSeason = player.season || player.availableSeasons[0] || '';
  const playerKeyPrefix = `${player.id}::`;
  const usedSeasons = new Set([...unavailable]
    .filter((key) => key.startsWith(playerKeyPrefix))
    .map((key) => key.slice(playerKeyPrefix.length).split('::')[0]));
  const seasonEntries = [...player.seasonEntries].sort((a, b) => (
    Number(usedSeasons.has(a.seasonName)) - Number(usedSeasons.has(b.seasonName))
    || Number(b.seasonName === preferredSeason) - Number(a.seasonName === preferredSeason)
  ));
  let seasonEntry = seasonEntries[0] || {};
  let competition;

  for (const entry of seasonEntries) {
    const competitions = [...(entry.competitions || [])].sort((a, b) => (
      Number(String(b.entryId) === String(entry.defaultCompetitionId))
      - Number(String(a.entryId) === String(entry.defaultCompetitionId))
      || Number(b.hasDeepStats) - Number(a.hasDeepStats)
    ));
    const available = competitions.find((item) => (
      !unavailable.has(comparisonKey(player.id, entry.seasonName, item.entryId))
    ));
    if (available) {
      seasonEntry = entry;
      competition = available;
      break;
    }
  }

  competition ||= seasonEntry.competitions?.[0];
  return {
    season: seasonEntry.seasonName || preferredSeason,
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
  slotId,
  slotIndex,
  player,
  players,
  selectedEntries,
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
    if (!normalized) return players.slice(0, 5);
    return players
      .filter((candidate) => candidate.name.toLocaleLowerCase().includes(normalized))
      .sort((a, b) => {
        const aStarts = a.name.toLocaleLowerCase().startsWith(normalized);
        const bStarts = b.name.toLocaleLowerCase().startsWith(normalized);
        return Number(bStarts) - Number(aStarts) || a.name.localeCompare(b.name);
      })
      .slice(0, 5);
  }, [players, query]);

  const choosePlayer = (nextPlayer) => {
    onSelect(slotId, nextPlayer);
    setQuery('');
    setFocused(false);
  };

  const seasonEntry = player
    ? player.seasonEntries.find((entry) => entry.seasonName === config?.season) || player.seasonEntries[0] || {}
    : {};
  const competitions = seasonEntry.competitions || [];
  const combinationUsedElsewhere = (competitionId) => selectedEntries.some((entry) => (
    entry.slotId !== slotId
    && entry.player?.id === player?.id
    && entry.config?.season === config?.season
    && String(entry.config?.competitionId) === String(competitionId)
  ));

  return (
    <section className={`comparison-player-slot ${player ? 'filled' : ''}`}>
      <header>
        <span>Player {slotIndex + 1}</span>
        <div className="comparison-slot-actions">
          {player && (
            <button type="button" className="comparison-change-player" onClick={() => onClear(slotId)} aria-label={`Change ${player.name}`}>
              Change
            </button>
          )}
          {slotIndex > 1 && (
            <button
              type="button"
              className="comparison-remove-slot"
              onClick={() => onRemoveSlot(slotId)}
              aria-label={`Remove player ${slotIndex + 1} slot`}
              title={`Remove player ${slotIndex + 1} slot`}
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
              <small>
                <span>{shortPosition(player.position)}</span>
                <span>{seasonEntry.teamName || player.teamName}</span>
              </small>
            </span>
          </div>
          <div className="comparison-slot-config">
            <label>
              <span>Season</span>
              <select value={config?.season || ''} onChange={(event) => onSeasonChange(slotId, player, event.target.value)} aria-label={`${player.name} season`}>
                {player.availableSeasons.map((season) => <option key={season}>{season}</option>)}
              </select>
            </label>
            <label>
              <span>Competition</span>
              <select value={config?.competitionId || ''} onChange={(event) => onCompetitionChange(slotId, event.target.value)} aria-label={`${player.name} competition`}>
                {competitions.map((competition) => (
                  <option
                    key={competition.entryId}
                    value={competition.entryId}
                    disabled={combinationUsedElsewhere(competition.entryId)}
                  >
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
            aria-label={`Search for player ${slotIndex + 1}`}
            disabled={loading}
            autoFocus={slotIndex === 0}
          />
          {focused && !loading && (
            <div className="comparison-slot-suggestions" role="listbox" aria-label={`Suggestions for player ${slotIndex + 1}`}>
              {suggestions.map((candidate) => (
                <button type="button" key={candidate.id} onMouseDown={(event) => event.preventDefault()} onClick={() => choosePlayer(candidate)} role="option">
                  <img src={candidate.photoUrl} alt="" />
                  <span><strong>{candidate.name}</strong><small>{shortPosition(candidate.position)} · {candidate.teamName}</small></span>
                  <b>Select</b>
                </button>
              ))}
              {query && suggestions.length === 0 && <p>No matching players.</p>}
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
  const selectedEntries = selected.map((entry) => ({
    ...entry,
    config: configs[entry.slotId],
  }));
  const selectedPlayers = selectedEntries.filter((entry) => entry.player);
  const combinationKeys = selectedPlayers.map((entry) => comparisonKey(
    entry.player.id,
    entry.config?.season,
    entry.config?.competitionId
  ));
  const hasDuplicateCombination = new Set(combinationKeys).size !== combinationKeys.length;

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
          {selectedEntries.map((entry, slotIndex) => (
            <PlayerSlot
              key={entry.slotId}
              slotId={entry.slotId}
              slotIndex={slotIndex}
              player={entry.player}
              players={players}
              selectedEntries={selectedEntries}
              loading={loading}
              config={entry.player ? entry.config : null}
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
        <span>
          {selectedPlayers.length < 2
            ? `Select ${2 - selectedPlayers.length} more`
            : hasDuplicateCombination
              ? 'Choose a different season or competition'
              : `${selectedPlayers.length} players ready`}
        </span>
        <button type="button" disabled={selectedPlayers.length < 2 || hasDuplicateCombination} onClick={onCompare}>Compare players</button>
      </footer>
    </section>
  );
}

function PlayerHeader({ player, config }) {
  const seasonEntry = player.seasonEntries.find((entry) => entry.seasonName === config.season)
    || player.seasonEntries[0]
    || {};
  const competition = seasonEntry.competitions?.find((item) => (
    String(item.entryId) === String(config.competitionId)
  ));
  const competitionName = competition?.name || 'Competition unavailable';
  return (
    <article className="comparison-player-header">
      <img src={player.photoUrl} alt="" />
      <div className="comparison-player-identity">
        <h3>{player.name}</h3>
        <p>
          <span className="comparison-player-position">{shortPosition(player.position)}</span>
          <span className="comparison-player-team">{seasonEntry.teamName || player.teamName}</span>
        </p>
      </div>
      <div className="comparison-player-context">
        <span>{config.season}</span>
        <span className={leagueWordmarkClass(competitionName)}>
          {leagueDisplayName(competitionName, { detailed: true })}
        </span>
      </div>
      <div className="comparison-player-sample">
        <span><b>{config.stats?.matches ?? seasonEntry.matches ?? 0}</b> matches</span>
        <span><b>{config.stats?.minutes ?? seasonEntry.minutes ?? 0}</b> min</span>
      </div>
    </article>
  );
}

function ComparisonResults({ entries, configs, setConfigs, onBack, onClose }) {
  const [mode, setMode] = useState('per90');

  useEffect(() => {
    entries.forEach(({ slotId, player }) => {
      const config = configs[slotId];
      if (!config?.competitionId || config.loading || config.stats || config.error) return;
      const seasonEntry = player.seasonEntries.find((entry) => entry.seasonName === config.season) || {};
      const competition = seasonEntry.competitions?.find((item) => String(item.entryId) === String(config.competitionId));
      if (!competition?.hasDeepStats) {
        setConfigs((current) => ({
          ...current,
          [slotId]: { ...current[slotId], error: 'Advanced stats unavailable for this competition.' },
        }));
        return;
      }
      setConfigs((current) => ({
        ...current,
        [slotId]: { ...current[slotId], loading: true },
      }));
      fetchCompetitionStats(player.id, config.competitionId)
        .then((stats) => setConfigs((current) => ({
          ...current,
          [slotId]: { ...current[slotId], stats, loading: false, error: null },
        })))
        .catch((error) => setConfigs((current) => ({
          ...current,
          [slotId]: { ...current[slotId], loading: false, error: error.message },
        })));
    });
  }, [entries, configs, setConfigs]);

  const groups = useMemo(() => {
    const groupMap = new Map();
    entries.forEach(({ slotId }) => {
      (configs[slotId]?.stats?.fullStatGroups || []).forEach((group) => {
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
  }, [entries, configs]);

  const metricFor = (slotId, groupTitle, metricKey) => {
    const group = configs[slotId]?.stats?.fullStatGroups?.find((item) => item.title === groupTitle);
    return group?.metrics.find((metric) => String(metric.key || metric.label).toLocaleLowerCase() === metricKey);
  };

  const winnerIds = (groupTitle, metric) => {
    const values = entries.map(({ slotId }) => ({
      id: slotId,
      value: displayedValue(metricFor(slotId, groupTitle, metric.key), mode),
    })).filter((entry) => entry.value !== null);
    if (values.length < 2) return new Set();
    const target = LOWER_IS_BETTER.some((pattern) => pattern.test(metric.label))
      ? Math.min(...values.map((entry) => entry.value))
      : Math.max(...values.map((entry) => entry.value));
    const winners = values.filter((entry) => Math.abs(entry.value - target) < 0.000001);
    if (winners.length === values.length) return new Set();
    return new Set(winners.map((entry) => entry.id));
  };

  const anyLoading = entries.some(({ slotId }) => configs[slotId]?.loading);
  const readyCount = entries.filter(({ slotId }) => configs[slotId]?.stats).length;

  return (
    <section className="comparison-results" aria-label="Player comparison results">
      <header className="comparison-results-toolbar">
        <button type="button" className="comparison-back" onClick={onBack}>← Edit comparison</button>
        <div className="comparison-results-actions">
          <div className="comparison-mode" role="group" aria-label="Comparison display mode">
            <button type="button" className={mode === 'totals' ? 'active' : ''} onClick={() => setMode('totals')}>Totals</button>
            <button type="button" className={mode === 'per90' ? 'active' : ''} onClick={() => setMode('per90')}>Per 90</button>
          </div>
          <button type="button" className="comparison-close" onClick={onClose} aria-label="Exit comparison">
            <CloseIcon />
          </button>
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
          style.setProperty('--comparison-context-height', `${16 * (1 - progress)}px`);
          style.setProperty('--comparison-sample-height', `${18 * (1 - progress)}px`);
          style.setProperty('--comparison-detail-opacity', String(1 - progress));
          style.setProperty('--comparison-name-size', `${0.68 - (0.05 * progress)}rem`);
        }}
      >
        <div className="comparison-table" style={{ '--comparison-players': entries.length }}>
          <div className="comparison-corner">
            <strong>Stats</strong>
          </div>
          {entries.map(({ slotId, player }) => (
            <PlayerHeader
              key={slotId}
              player={player}
              config={configs[slotId]}
            />
          ))}

          {anyLoading && groups.length === 0 && (
            <div className="comparison-loading-row" style={{ gridColumn: `1 / span ${entries.length + 1}` }}>
              Loading advanced statistics for {entries.length} players…
            </div>
          )}

          {!anyLoading && readyCount < 2 && groups.length === 0 && (
            <div className="comparison-loading-row error" style={{ gridColumn: `1 / span ${entries.length + 1}` }}>
              At least two selected competitions need advanced statistics.
            </div>
          )}

          {groups.map((group) => (
            <div className="comparison-group-contents" key={group.title}>
              <div className="comparison-group-title" style={{ gridColumn: `1 / span ${entries.length + 1}` }}>{group.title}</div>
              {group.metrics.map((metric) => {
                const winners = winnerIds(group.title, metric);
                return (
                  <div className="comparison-metric-contents" key={`${group.title}-${metric.key}`}>
                    <div className="comparison-metric-name">{metric.label}</div>
                    {entries.map(({ slotId }) => {
                      const playerMetric = metricFor(slotId, group.title, metric.key);
                      const percentile = displayedPercentile(playerMetric, mode);
                      return (
                        <div className={`comparison-value ${winners.has(slotId) ? 'winner' : ''}`} key={slotId}>
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
  const nextSlotId = useRef(3);
  const [selected, setSelected] = useState([
    { slotId: 'slot-1', player: null },
    { slotId: 'slot-2', player: null },
  ]);
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

  const unavailableKeys = (excludedSlotId) => new Set(selected
    .filter((entry) => entry.slotId !== excludedSlotId && entry.player && configs[entry.slotId])
    .map((entry) => comparisonKey(
      entry.player.id,
      configs[entry.slotId].season,
      configs[entry.slotId].competitionId
    )));

  const selectPlayer = (slotId, player) => {
    setSelected((current) => current.map((entry) => (
      entry.slotId === slotId ? { ...entry, player } : entry
    )));
    setConfigs((current) => ({
      ...current,
      [slotId]: defaultConfigForPlayer(player, unavailableKeys(slotId)),
    }));
  };

  const changeSeason = (slotId, player, season) => {
    const seasonEntry = player.seasonEntries.find((entry) => entry.seasonName === season) || {};
    const unavailable = unavailableKeys(slotId);
    const competition = seasonEntry.competitions?.find((item) => (
      item.hasDeepStats
      && !unavailable.has(comparisonKey(player.id, season, item.entryId))
    ))
      || seasonEntry.competitions?.find((item) => (
        !unavailable.has(comparisonKey(player.id, season, item.entryId))
      ))
      || seasonEntry.competitions?.[0];
    setConfigs((current) => ({
      ...current,
      [slotId]: {
        season,
        competitionId: competition?.entryId || '',
        stats: null,
        loading: false,
        error: null,
      },
    }));
  };

  const changeCompetition = (slotId, competitionId) => {
    setConfigs((current) => ({
      ...current,
      [slotId]: {
        ...current[slotId],
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
          entries={selected.filter((entry) => entry.player)}
          configs={configs}
          setConfigs={setConfigs}
          onBack={() => setComparing(false)}
          onClose={onClose}
        />
      ) : (
        <PlayerPicker
          players={players}
          loading={loading}
          error={error}
          selected={selected}
          configs={configs}
          onSelect={selectPlayer}
          onClear={(slotId) => setSelected((current) => current.map((entry) => (
            entry.slotId === slotId ? { ...entry, player: null } : entry
          )))}
          onAddSlot={() => setSelected((current) => (
            current.length < 4
              ? [...current, { slotId: `slot-${nextSlotId.current++}`, player: null }]
              : current
          ))}
          onRemoveSlot={(slotId) => setSelected((current) => (
            current.filter((entry) => entry.slotId !== slotId)
          ))}
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
