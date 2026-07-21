// components/PlayerCardContainer.jsx
import usePlayerData from '../hooks/usePlayerData';
import PlayerCard from './PlayerCard';

function PlayerCardContainer({ playerId }) {
  const { player, loading, error } = usePlayerData(playerId);

  if (loading) return <p>Loading...</p>;
  if (error) return <p>Error: {error}</p>;
  if (!player) return null;

  return <PlayerCard {...player} />;
}

export default PlayerCardContainer;