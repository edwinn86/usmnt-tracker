import { useState, useEffect, useRef } from 'react';
import { fetchCompetitionStats } from '../../hooks/usePlayersData';

// Percentile colors run from red (low) to green (high).
function getPercentileColor(percentile) {
  const val = Math.max(0, Math.min(100, Number(percentile) || 0));
  const hue = (val / 100) * 120;
  return `hsl(${hue}, 75%, 42%)`;
}

function getRatingColorClass(rating) {
  const val = Number(rating);
  if (!Number.isFinite(val)) return 'rating-none';
  if (val >= 7.4) return 'rating-t1'; 
  if (val >= 7.1) return 'rating-t2'; 
  if (val >= 6.8) return 'rating-t3'; 
  if (val >= 6.65) return 'rating-t4'; 
  return 'rating-t5';                 
}

function getPositionGroup(pos = '') {
  const normalizedPos = pos.toUpperCase().replace(/[-_]/g, ' ').replace(/\s+/g, ' ').trim();

  if (/\b(GK|GOALKEEPER|KEEPER)\b/.test(normalizedPos)) {
    return 'GK';
  }

  // Check defenders first so wing-backs are not treated as wingers.
  if (
    /\b(CB|LB|RB|WB|LWB|RWB|DF)\b/.test(normalizedPos) ||
    /\b(LEFT|RIGHT|CENTRE|CENTER) BACK\b/.test(normalizedPos) ||
    /\bWING ?BACK\b/.test(normalizedPos) ||
    /\bFULL ?BACK\b/.test(normalizedPos) ||
    /\bDEFENDER\b/.test(normalizedPos)
  ) {
    return 'DEF';
  }

  if (
    /\b(CAM|CM|CDM|LM|RM|MF)\b/.test(normalizedPos) ||
    /\bMIDFIELDER\b/.test(normalizedPos) ||
    /\b(HOLDING|CENTRAL|CENTER|ATTACKING|DEFENSIVE|WIDE) MID\b/.test(normalizedPos)
  ) {
    return 'MID';
  }

  return 'ATT';
}

function isCenterBack(pos = '') {
  const normalized = pos.toUpperCase().replace(/[-_]/g, ' ').replace(/\s+/g, ' ').trim();
  return /\bCB\b/.test(normalized) || /\b(CENTRE|CENTER) BACK\b/.test(normalized);
}

function formatMetric(metric) {
  if (!metric) return 'N/A';
  const precision = metric.suffix === '%' ? 1 : 2;
  const unit = metric.suffix === '/90' ? '' : metric.suffix || '';
  return `${metric.value.toFixed(precision)}${unit}`;
}

function formatPercentile(percentile) {
  const value = Number(percentile);
  const mod100 = value % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${value}th`;
  const suffix = { 1: 'st', 2: 'nd', 3: 'rd' }[value % 10] || 'th';
  return `${value}${suffix}`;
}

function PlayerCard({
  name, photoUrl, teamName, position, age, height,
  marketValue, leagueName, rating, matchesPlayed, goals, assists,
  id, season,
  seasonEntries = [],
  availableSeasons = []
}) {
  const cardRef = useRef(null);
  const [isActive, setIsActive] = useState(false);
  const [isFlipped, setIsFlipped] = useState(false);

  const initialSeason = season || availableSeasons[0] || '';
  const initialSeasonEntry = seasonEntries.find((entry) => entry.seasonName === initialSeason) || seasonEntries[0] || {};
  const [selectedSeason, setSelectedSeason] = useState(initialSeason);
  const [selectedCompetitionId, setSelectedCompetitionId] = useState(initialSeasonEntry.defaultCompetitionId || '');
  const [competitionStats, setCompetitionStats] = useState(null);
  const [competitionLoading, setCompetitionLoading] = useState(
    Boolean(initialSeasonEntry.competitions?.find((competition) => competition.entryId === initialSeasonEntry.defaultCompetitionId)?.hasDeepStats)
  );
  const [competitionError, setCompetitionError] = useState(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => setIsActive(entry.isIntersecting),
      { root: null, rootMargin: '0px -50% 0px -50%', threshold: 0 }
    );

    const cardElement = cardRef.current;
    if (cardElement) observer.observe(cardElement);
    return () => { if (cardElement) observer.unobserve(cardElement); };
  }, []);

  const displayRating = Number.isFinite(Number(rating)) ? Number(rating).toFixed(2) : "N/A";
  const ratingClass = getRatingColorClass(rating);

  const activeSeason = seasonEntries.find((entry) => entry.seasonName === selectedSeason) || seasonEntries[0] || {};
  const seasonsList = availableSeasons.length > 0 ? availableSeasons : [selectedSeason];
  const competitions = activeSeason.competitions || [];
  const activeCompetition = competitions.find((competition) => competition.entryId === selectedCompetitionId) || competitions[0];
  const activeStats = competitionStats
    ? { ...activeSeason, ...competitionStats, leagueName: activeCompetition?.name || activeSeason.leagueName }
    : activeSeason;
  const posGroup = getPositionGroup(position);
  const centerBack = isCenterBack(position);

  const hasAdvancedStats = Boolean(activeStats.hasAdvancedStats);

  useEffect(() => {
    if (!activeCompetition?.hasDeepStats || !selectedCompetitionId) return undefined;

    let cancelled = false;
    fetchCompetitionStats(id, selectedCompetitionId)
      .then((stats) => {
        if (!cancelled) {
          setCompetitionStats(stats);
          setCompetitionError(null);
          setCompetitionLoading(false);
        }
      })
      .catch((error) => {
        if (!cancelled) {
          setCompetitionError(error.message);
          setCompetitionLoading(false);
        }
      });

    return () => { cancelled = true; };
  }, [id, selectedCompetitionId, activeCompetition?.hasDeepStats]);

  const selectSeason = (nextSeason) => {
    const nextSeasonEntry = seasonEntries.find((entry) => entry.seasonName === nextSeason) || {};
    const nextCompetition = nextSeasonEntry.competitions?.find(
      (competition) => competition.entryId === nextSeasonEntry.defaultCompetitionId
    ) || nextSeasonEntry.competitions?.[0];
    setSelectedSeason(nextSeason);
    setSelectedCompetitionId(nextCompetition?.entryId || '');
    setCompetitionStats(null);
    setCompetitionError(null);
    setCompetitionLoading(Boolean(nextCompetition?.hasDeepStats));
  };

  const selectCompetition = (entryId) => {
    const nextCompetition = competitions.find((competition) => competition.entryId === entryId);
    setSelectedCompetitionId(entryId);
    setCompetitionStats(null);
    setCompetitionError(null);
    setCompetitionLoading(Boolean(nextCompetition?.hasDeepStats));
  };

  const getAdvancedMetricsConfig = () => {
    switch (posGroup) {
      case 'ATT':
        return [
          { label: 'npxG', key: 'npxG' },
          { label: 'xGOT', key: 'xGOT' },
          { label: 'xA', key: 'xA' },
          { label: 'Shots on Target', key: 'shotsOnTarget' },
          { label: 'Dribbles', key: 'dribbles' },
        ];
      case 'MID':
        return [
          { label: 'Pass Accuracy', key: 'passAccuracy' },
          { label: 'xA', key: 'xA' },
          { label: 'Chances', key: 'chancesCreated' },
          { label: 'Tackles', key: 'tackles' },
          { label: 'Recoveries', key: 'recoveries' },
        ];
      case 'DEF':
        return centerBack
          ? [
              { label: 'Pass Accuracy', key: 'passAccuracy' },
              { label: 'Long Ball Acc.', key: 'longBallAccuracy' },
              { label: 'Aerial Won %', key: 'aerialsWonPct' },
              { label: 'Clearances', key: 'clearances' },
              { label: 'Recoveries', key: 'recoveries' },
            ]
          : [
              { label: 'xA', key: 'xA' },
              { label: 'Succ. Crosses', key: 'successfulCrosses' },
              { label: 'Cross Accuracy', key: 'crossAccuracy' },
              { label: 'Chances', key: 'chancesCreated' },
              { label: 'Tackles', key: 'tackles' },
            ];
      case 'GK':
        return [
          { label: 'Goals Prevented', key: 'goalsPrevented' },
          { label: 'Post-Shot xG / Shot', key: 'psxgPerShot' },
          { label: 'Crosses Stopped %', key: 'crossesStoppedPct' },
          { label: 'Sweeper Actions', key: 'sweeperActions' },
        ];
      default:
        return [];
    }
  };

  return (
    <div 
      ref={cardRef} 
      className={`flip-container ${isActive ? 'is-active' : ''}`}
    >
      <div className={`flip-inner ${isFlipped ? 'is-flipped' : ''}`}>
        <div 
          className="card-face card-front player-card" 
          onClick={() => setIsFlipped(true)}
        >
          <img src={photoUrl} alt={name} className="player-photo" />
          <h2>{name}</h2>
          <p className="league">{leagueName}</p>
          <p className="team">{teamName}</p>
          <p className="position">{position}</p>

          <div className="vitals">
            <span className="vital">
              <span className="vital-label">Age</span>
              <span className="vital-value">{age}</span>
            </span>
            <span className="divider">•</span>
            <span className="vital">
              <span className="vital-label">Ht</span>
              <span className="vital-value">{height}</span>
            </span>
          </div>

          <div className="stats">
            <div className="stat">
              <span className="stat-label">Value</span>
              <span className="stat-value">{marketValue}</span>
            </div>
            <div className="stat">
              <span className="stat-label">Rating</span>
              <span className={`stat-value stat-rating ${ratingClass}`}>
                {displayRating}
              </span>
            </div>
            <div className="stat">
              <span className="stat-label">Matches</span>
              <span className="stat-value">{matchesPlayed}</span>
            </div>
            <div className="stat">
              <span className="stat-label">G | A</span>
              <span className="stat-value">{goals} | {assists}</span>
            </div>
          </div>
        </div>

        <div 
          className="card-face card-back" 
          onClick={() => setIsFlipped(false)}
        >
          <div className="card-back-header">
            <h3 className="back-player-name">{name}</h3>
            <p className="back-league">{activeStats.leagueName || leagueName}</p>
            <p className="back-team">{activeStats.teamName || teamName}</p>
          </div>

          <div className="stats-control-bar" onClick={(e) => e.stopPropagation()}>
            <div className="card-filter-selects">
              <select
                className="season-dropdown"
                value={selectedSeason}
                onChange={(e) => selectSeason(e.target.value)}
                aria-label="Season"
              >
                {seasonsList.map((seasonName) => (
                  <option key={seasonName} value={seasonName}>{seasonName}</option>
                ))}
              </select>
              {competitions.length > 0 && (
                <select
                  className="competition-dropdown"
                  value={selectedCompetitionId}
                  onChange={(e) => selectCompetition(e.target.value)}
                  aria-label="Competition"
                >
                  {competitions.map((competition) => (
                    <option key={competition.entryId} value={competition.entryId}>
                      {competition.name}{competition.hasDeepStats ? '' : ' (summary)'}
                    </option>
                  ))}
                </select>
              )}
            </div>
          </div>

          {competitionLoading ? (
            <div className="competition-loading">Loading competition stats...</div>
          ) : competitionError ? (
            <div className="competition-loading">Competition stats unavailable.</div>
          ) : hasAdvancedStats ? (
            <div className="advanced-stats-container">
              <div className="base-stats-banner">
                {posGroup === 'GK' ? (
                  <>
                    <div className="banner-item"><span>GP</span><strong>{activeStats.matches ?? 0}</strong></div>
                    <div className="banner-item"><span>MIN</span><strong>{activeStats.minutes ?? 0}</strong></div>
                    <div className="banner-item"><span>CS</span><strong>{activeStats.cleanSheets ?? 0}</strong></div>
                    <div className="banner-item"><span>SV%</span><strong>{activeStats.savePct ?? 'N/A'}</strong></div>
                  </>
                ) : (
                  <>
                    <div className="banner-item"><span>GP</span><strong>{activeStats.matches ?? 0}</strong></div>
                    <div className="banner-item"><span>MIN</span><strong>{activeStats.minutes ?? 0}</strong></div>
                    <div className="banner-item"><span>G</span><strong>{activeStats.goals ?? 0}</strong></div>
                    <div className="banner-item"><span>A</span><strong>{activeStats.assists ?? 0}</strong></div>
                  </>
                )}
              </div>

              <div className="advanced-metrics-list">
                <div className="metrics-header-row">
                  <span>METRIC</span>
                  <span className="align-right">VAL /90</span>
                  <span className="align-right">PCTL</span>
                </div>

                {getAdvancedMetricsConfig()
                  .filter((metric) => activeStats.advancedMetrics?.[metric.key])
                  .map(metric => {
                  const advancedMetric = activeStats.advancedMetrics[metric.key];
                  // FotMob can return 100 for the top-ranked player; present
                  // percentile ranks on the conventional 1–99 scale instead.
                  const pct = advancedMetric.percentile == null
                    ? advancedMetric.percentile
                    : Math.min(99, advancedMetric.percentile);
                  const barWidth = pct == null ? 0 : (pct / 99) * 100;
                  const formattedVal = formatMetric(advancedMetric);

                  return (
                    <div key={metric.key} className="metric-row">
                      <span className="metric-label">{metric.label}</span>
                      <span className="metric-value">
                        {formattedVal}
                        {advancedMetric.suffix === '/90' && <span className="mobile-per-90"> /90</span>}
                      </span>
                      <div className="percentile-cell">
                        {pct !== undefined && pct !== null ? (
                          <div className="percentile-bar" aria-label={`${pct}th percentile`}>
                            <span
                              className="percentile-fill"
                              style={{
                                width: `${barWidth}%`,
                                backgroundColor: getPercentileColor(pct),
                              }}
                            />
                            <span className="percentile-score">
                              <span className="desktop-percentile-score">{formatPercentile(pct)} percentile</span>
                              <span className="mobile-percentile-score">{formatPercentile(pct)} percentile</span>
                            </span>
                          </div>
                        ) : (
                          <span className="percentile-unavailable">—</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="historical-stats-container">
              <div className="historical-summary-grid">
                <div className="hist-stat-box">
                  <span className="hist-label">Matches Played</span>
                  <span className="hist-value">{activeStats.matches ?? 0}</span>
                </div>
                <div className="hist-stat-box">
                  <span className="hist-label">Avg Rating</span>
                  <span className={`hist-value ${getRatingColorClass(activeStats.rating)}`}>
                    {Number.isFinite(Number(activeStats.rating)) ? Number(activeStats.rating).toFixed(2) : 'N/A'}
                  </span>
                </div>
                <div className="hist-stat-box">
                  <span className="hist-label">Goals</span>
                  <span className="hist-value">{activeStats.goals ?? 0}</span>
                </div>
                <div className="hist-stat-box">
                  <span className="hist-label">Assists</span>
                  <span className="hist-value">{activeStats.assists ?? 0}</span>
                </div>
                <div className="hist-stat-box">
                  <span className="hist-label">Yellow Cards</span>
                  <span className="hist-value">{activeStats.yellowCards ?? 0}</span>
                </div>
                <div className="hist-stat-box">
                  <span className="hist-label">Red Cards</span>
                  <span className="hist-value">{activeStats.redCards ?? 0}</span>
                </div>
              </div>
            </div>
          )}
          
        </div>
      </div>
    </div>
  );
}

export default PlayerCard;
