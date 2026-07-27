import { useEffect, useRef, useState } from 'react';
import PlayerCard from '../cards/PlayerCard';

function ratingClass(rating) {
  const value = Number(rating);
  if (!Number.isFinite(value)) return 'rating-none';
  if (value >= 7.4) return 'rating-t1';
  if (value >= 7.1) return 'rating-t2';
  if (value >= 6.8) return 'rating-t3';
  if (value >= 6.65) return 'rating-t4';
  return 'rating-t5';
}

function shortPosition(position = '') {
  return position
    .replace(/Attacking Midfielder/gi, 'Attacking Mid')
    .replace(/Defensive Midfielder/gi, 'Defensive Mid')
    .replace(/Central Midfielder/gi, 'Central Mid')
    .replace(/Left Midfielder/gi, 'Left Mid')
    .replace(/Right Midfielder/gi, 'Right Mid')
    .replace(/Wing-Back/gi, 'Wingback');
}

function CompactHeader({ column, label, sortBy, sortDirection, onSort, align = 'left' }) {
  const active = sortBy === column;
  return (
    <button
      type="button"
      className={`mobile-compact-header-button align-${align}`}
      onClick={() => onSort(column)}
      aria-label={`Sort by ${label}`}
    >
      <span>{label}</span>
      <span className={active ? 'active' : ''} aria-hidden="true">
        {active && sortDirection === 'asc' ? '↑' : '↓'}
      </span>
    </button>
  );
}

function MobileCompactList({ players, error, sortBy, sortDirection, onSort }) {
  const [selectedPlayer, setSelectedPlayer] = useState(null);
  const closeRef = useRef(null);

  useEffect(() => {
    if (!selectedPlayer) return undefined;
    const oldOverflow = document.body.style.overflow;
    const closeOnEscape = (event) => { if (event.key === 'Escape') setSelectedPlayer(null); };
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', closeOnEscape);
    closeRef.current?.focus();
    return () => {
      document.body.style.overflow = oldOverflow;
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [selectedPlayer]);

  return (
    <>
      <div className="mobile-compact-list" aria-label="Compact player list">
        <div className="mobile-compact-header">
          <CompactHeader column="name" label="Player" {...{ sortBy, sortDirection, onSort }} />
          <CompactHeader column="position" label="Position" {...{ sortBy, sortDirection, onSort }} />
          <CompactHeader column="matches" label="MP" align="center" {...{ sortBy, sortDirection, onSort }} />
          <CompactHeader column="rating" label="Rating" align="right" {...{ sortBy, sortDirection, onSort }} />
        </div>
        {players.map((player) => (
          <button
            type="button"
            className="mobile-compact-row"
            key={player.id}
            onClick={() => setSelectedPlayer(player)}
          >
            <strong>{player.name}</strong>
            <span className="mobile-compact-position">{shortPosition(player.position)}</span>
            <span className="mobile-compact-matches">{player.matchesPlayed}</span>
            <span className={`mobile-compact-rating ${ratingClass(player.rating)}`}>
              {Number.isFinite(Number(player.rating)) ? Number(player.rating).toFixed(2) : 'N/A'}
            </span>
          </button>
        ))}
        {players.length === 0 && <p className="status-message">No players match those filters.</p>}
        {error && <p className="status-message error">{error}</p>}
      </div>

      {selectedPlayer && (
        <div className="player-stats-dialog" role="dialog" aria-modal="true" aria-label={`Advanced stats for ${selectedPlayer.name}`}>
          <button type="button" className="player-stats-backdrop" aria-label="Close advanced stats" onClick={() => setSelectedPlayer(null)} />
          <div className="player-stats-panel">
            <button ref={closeRef} type="button" className="player-stats-close" onClick={() => setSelectedPlayer(null)} aria-label="Close advanced stats">×</button>
            <PlayerCard key={selectedPlayer.id} {...selectedPlayer} initialFlipped lockFlippedSide />
          </div>
        </div>
      )}
    </>
  );
}

export default MobileCompactList;
