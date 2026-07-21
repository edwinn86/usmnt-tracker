import PlayerCard from './PlayerCard';
import usePlayersData from '../hooks/usePlayersData';

function PlayerCardGrid({ playerIds }) {
  const { players, loading, error } = usePlayersData(playerIds);

  if (loading) return <p className="status-message">Loading roster...</p>;
  if (players.length === 0) return <p className="status-message">No players found.</p>;

  return (
    <div className="player-grid">
      {players.map((player) => (
        <PlayerCard key={player.id} {...player} />
      ))}
      {error && <p className="status-message error">{error}</p>}
    </div>
  );
}

export default PlayerCardGrid;