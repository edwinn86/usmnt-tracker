import { useState, useEffect, useRef } from 'react';

// Helper function to assign the correct CSS class based on the 5 custom tiers
function getRatingColorClass(rating) {
  const val = Number(rating);
  
  if (!Number.isFinite(val)) return 'rating-none';
  if (val >= 7.4) return 'rating-t1'; // Tier 1: 7.40+ (Dark Green)
  if (val >= 7.1) return 'rating-t2'; // Tier 2: 7.10 - 7.39 (Green)
  if (val >= 6.8) return 'rating-t3'; // Tier 3: 6.90 - 7.09 (Yellow)
  if (val >= 6.65) return 'rating-t4'; // Tier 4: 6.60 - 6.89 (Orange)
  
  return 'rating-t5';                 // Tier 5: < 6.60 (Red)
}

function PlayerCard({
  name, photoUrl, teamName, position, age, height,
  marketValue, leagueName, rating, matchesPlayed, goals, assists
}) {
  const cardRef = useRef(null);
  const [isActive, setIsActive] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsActive(entry.isIntersecting);
      },
      {
        root: null,
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

  // Determine the formatted rating and the dynamic color class
  const displayRating = Number.isFinite(Number(rating)) 
    ? Number(rating).toFixed(2) 
    : "N/A";
  const ratingClass = getRatingColorClass(rating);

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
          {/* Apply the dynamic classes here */}
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
  );
}

export default PlayerCard;