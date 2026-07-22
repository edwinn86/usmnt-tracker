import { useState, useEffect, useRef } from 'react';

function PlayerCard({
  name, photoUrl, teamName, position, age, height,
  marketValue, leagueName, rating, matchesPlayed, goals, assists
}) {
  const cardRef = useRef(null);
  const [isActive, setIsActive] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        // When the card hits the exact center of the screen, make it active
        setIsActive(entry.isIntersecting);
      },
      {
        root: null,
        // Shrinks the detection area to a narrow vertical line in the center of the screen
        rootMargin: '0px -50% 0px -50%',
        threshold: 0,
      }
    );

    if (cardRef.current) {
      observer.observe(cardRef.current);
    }

    return () => {
      if (cardRef.current) observer.unobserve(cardRef.current);
    };
  }, []);

  return (
    <div 
      ref={cardRef} 
      className={`player-card ${isActive ? 'is-active' : ''}`}
    >
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