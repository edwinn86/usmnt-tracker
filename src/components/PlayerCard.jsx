function PlayerCard({
  name, photoUrl, teamName, position, age, height,
  marketValue, leagueName, rating, matchesPlayed, goals, assists
}) {
  return (
    <div className="player-card">
      <img src={photoUrl} alt={name} className="player-photo" />
      <h2>{name}</h2>
      <p className="position">{position}</p>
      <p className="league">{leagueName}</p>
      <p className="team">{teamName}</p>

      <div className="vitals">
        <span>{age} yrs</span>
        <span className="divider">•</span>
        <span>{height}</span>
      </div>

      <div className="stats">
        <div className="stat">
          <span className="stat-label">Value</span>
          <span className="stat-value">{marketValue}</span>
        </div>
        <div className="stat">
          <span className="stat-label">Rating</span>
          <span className="stat-value">
            {Number.isFinite(Number(rating)) 
              ? Number(rating).toFixed(2) 
              : "N/A"}
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
  );
}

export default PlayerCard;