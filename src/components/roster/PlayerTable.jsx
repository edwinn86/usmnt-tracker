import { useEffect, useRef, useState } from 'react';
import PlayerCard from '../cards/PlayerCard';
import { leagueWordmarkClass } from '../../leagueBranding';

function ratingClass(rating) {
  const value = Number(rating);
  if (!Number.isFinite(value)) return 'rating-none';
  if (value >= 7.4) return 'rating-t1';
  if (value >= 7.1) return 'rating-t2';
  if (value >= 6.8) return 'rating-t3';
  if (value >= 6.65) return 'rating-t4';
  return 'rating-t5';
}

function positionPresentation(position = '') {
  return position
    .replace(/Attacking Midfielder/gi, 'Attacking Mid')
    .replace(/Defensive Midfielder/gi, 'Defensive Mid')
    .replace(/Central Midfielder/gi, 'Central Mid')
    .replace(/Left Midfielder/gi, 'Left Mid')
    .replace(/Right Midfielder/gi, 'Right Mid')
    .replace(/Wing-Back/gi, 'Wingback');
}

function SortableHeader({ column, label, sortBy, sortDirection, onSort, numeric = false }) {
  const active = sortBy === column;
  return (
    <th
      scope="col"
      className={numeric ? 'numeric-column' : ''}
      aria-sort={active ? (sortDirection === 'asc' ? 'ascending' : 'descending') : 'none'}
    >
      <button type="button" className="table-sort-button" onClick={() => onSort(column)}>
        <span>{label}</span>
        <span className={`table-sort-arrow ${active ? 'active' : ''}`} aria-hidden="true">
          {active && sortDirection === 'asc' ? '↑' : '↓'}
        </span>
      </button>
    </th>
  );
}

function PlayerTable({ players, error, sortBy, sortDirection, onSort }) {
  const [selectedPlayer, setSelectedPlayer] = useState(null);
  const closeButtonRef = useRef(null);

  useEffect(() => {
    if (!selectedPlayer) return undefined;

    const previousOverflow = document.body.style.overflow;
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') setSelectedPlayer(null);
    };

    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', handleKeyDown);
    closeButtonRef.current?.focus();

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [selectedPlayer]);

  return (
    <>
      <div className="player-table-shell">
        <table className="player-table">
        <thead>
          <tr>
            <SortableHeader column="name" label="Player" {...{ sortBy, sortDirection, onSort }} />
            <SortableHeader column="position" label="Position" {...{ sortBy, sortDirection, onSort }} />
            <SortableHeader column="league" label="League" {...{ sortBy, sortDirection, onSort }} />
            <SortableHeader column="age" label="Age" numeric {...{ sortBy, sortDirection, onSort }} />
            <SortableHeader column="value" label="Value" numeric {...{ sortBy, sortDirection, onSort }} />
            <SortableHeader column="matches" label="Matches" numeric {...{ sortBy, sortDirection, onSort }} />
            <SortableHeader column="rating" label="Rating" numeric {...{ sortBy, sortDirection, onSort }} />
            <SortableHeader column="goals" label="Goals" numeric {...{ sortBy, sortDirection, onSort }} />
            <SortableHeader column="assists" label="Assists" numeric {...{ sortBy, sortDirection, onSort }} />
            <th scope="col" className="table-details-heading">
              <span className="visually-hidden">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {players.map((player) => (
            <tr key={player.id}>
              <th scope="row">
                <button
                  type="button"
                  className="table-player table-player-button"
                  onClick={() => setSelectedPlayer(player)}
                  aria-label={`View advanced stats for ${player.name}`}
                >
                  <img src={player.photoUrl} alt="" loading="lazy" />
                  <span>
                    <strong>{player.name}</strong>
                    <small>{player.teamName}</small>
                  </span>
                </button>
              </th>
              <td>
                <span
                  className="table-position"
                  title={player.position}
                >
                  {positionPresentation(player.position)}
                </span>
              </td>
              <td><span className={leagueWordmarkClass(player.leagueName)}>{player.leagueName}</span></td>
              <td className="numeric-column">{player.age}</td>
              <td className="numeric-column table-value">{player.marketValue}</td>
              <td className="numeric-column">{player.matchesPlayed}</td>
              <td className="numeric-column">
                <span className={`table-rating ${ratingClass(player.rating)}`}>
                  {Number.isFinite(Number(player.rating)) ? Number(player.rating).toFixed(2) : 'N/A'}
                </span>
              </td>
              <td className="numeric-column">{player.goals}</td>
              <td className="numeric-column">{player.assists}</td>
              <td>
                <button
                  type="button"
                  className="table-stats-button"
                  onClick={() => setSelectedPlayer(player)}
                  aria-label={`View advanced stats for ${player.name}`}
                >
                  <span className="table-stats-arrow" aria-hidden="true">›</span>
                </button>
              </td>
            </tr>
          ))}
        </tbody>
        </table>
        {players.length === 0 && <p className="status-message">No players match those filters.</p>}
        {error && <p className="status-message error">{error}</p>}
      </div>

      {selectedPlayer && (
        <div
          className="player-stats-dialog"
          role="dialog"
          aria-modal="true"
          aria-label={`Advanced stats for ${selectedPlayer.name}`}
        >
          <button
            type="button"
            className="player-stats-backdrop"
            onClick={() => setSelectedPlayer(null)}
            aria-label="Close advanced stats"
          />
          <div className="player-stats-panel">
            <button
              ref={closeButtonRef}
              type="button"
              className="player-stats-close"
              onClick={() => setSelectedPlayer(null)}
              aria-label="Close advanced stats"
            >
              ×
            </button>
            <PlayerCard
              key={selectedPlayer.id}
              {...selectedPlayer}
              initialFlipped
              lockFlippedSide
            />
          </div>
        </div>
      )}
    </>
  );
}

export default PlayerTable;
