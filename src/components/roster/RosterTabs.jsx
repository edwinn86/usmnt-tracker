import { useEffect, useState } from 'react';
import PlayerCardGrid from './PlayerCardGrid';
import {
  usmntPlayerIds,
  usmntProspectIds,
  usmntCuspIds,
  usmntDualIds,
} from '../../data/usmntPlayerIds';

const fullPoolIds = [
  ...new Set([
    ...usmntPlayerIds,
    ...usmntCuspIds,
    ...usmntProspectIds,
    ...usmntDualIds,
  ]),
];

const TABS = [
  { key: 'firstTeam', label: 'First Team', ids: usmntPlayerIds },
  { key: 'cusp', label: 'On the Cusp', ids: usmntCuspIds },
  { key: 'prospects', label: 'Prospects', ids: usmntProspectIds },
  { key: 'dual', label: 'Dual Nats', ids: usmntDualIds },
  { key: 'fullPool', label: 'Full Pool', ids: fullPoolIds },
];

function formatSnapshotDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(date);
}

function RosterTabs() {
  const [activeTab, setActiveTab] = useState(TABS[0].key);
  const [snapshotDate, setSnapshotDate] = useState(null);
  const [aboutOpen, setAboutOpen] = useState(false);
  const activeIds = TABS.find((tab) => tab.key === activeTab)?.ids ?? [];

  useEffect(() => {
    let cancelled = false;
    fetch(`${import.meta.env.BASE_URL}data/manifest.json`)
      .then((response) => {
        if (!response.ok) throw new Error(`Manifest unavailable: ${response.status}`);
        return response.json();
      })
      .then((manifest) => {
        if (!cancelled) setSnapshotDate(formatSnapshotDate(manifest.generatedAt));
      })
      .catch(() => {
        if (!cancelled) setSnapshotDate(null);
      });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!aboutOpen) return undefined;
    const closeOnEscape = (event) => {
      if (event.key === 'Escape') setAboutOpen(false);
    };
    document.addEventListener('keydown', closeOnEscape);
    return () => document.removeEventListener('keydown', closeOnEscape);
  }, [aboutOpen]);

  return (
    <div>
      <header className="app-header">
        <div className="brand">
          <h1>USMNT TRACKER</h1>
          <span className="subtitle">
            {snapshotDate ? `Updated ${snapshotDate}` : 'FotMob data'}
          </span>
        </div>

        <nav className="tab-bar">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              className={`tab-button ${activeTab === tab.key ? 'active' : ''}`}
              onClick={() => setActiveTab(tab.key)}
            >
              {tab.label}
              <span className="badge">{tab.ids.length}</span>
            </button>
          ))}
        </nav>

        <button
          type="button"
          className="about-trigger"
          onClick={() => setAboutOpen(true)}
          aria-label="About this tracker"
          title="About this tracker"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="12" cy="12" r="8.5" />
            <path d="M12 10.5v6M12 7.5h.01" />
          </svg>
        </button>
      </header>

      {/* Remounting clears controls when the roster changes. */}
      <PlayerCardGrid
        key={activeTab}
        playerIds={activeIds}
        onOpenAbout={() => setAboutOpen(true)}
      />

      {aboutOpen && (
        <div className="about-dialog" role="dialog" aria-modal="true" aria-labelledby="about-title">
          <button
            type="button"
            className="about-backdrop"
            aria-label="Close About"
            onClick={() => setAboutOpen(false)}
          />
          <section className="about-panel">
            <button
              type="button"
              className="about-close"
              aria-label="Close About"
              onClick={() => setAboutOpen(false)}
            >
              ×
            </button>
            <p className="about-eyebrow">About the tracker</p>
            <h2 id="about-title">USMNT player pool, in one place.</h2>
            <p>
              A noncommercial fan project for browsing US-eligible players, current club
              performance, and role-specific advanced metrics.
            </p>
            <dl className="about-facts">
              <div>
                <dt>Data source</dt>
                <dd>FotMob</dd>
              </div>
              <div>
                <dt>Last snapshot</dt>
                <dd>{snapshotDate ?? 'Date unavailable'}</dd>
              </div>
              <div>
                <dt>Refresh cadence</dt>
                <dd>Updated manually</dd>
              </div>
            </dl>
            <p className="about-disclaimer">
              This site is not affiliated with or endorsed by FotMob, U.S. Soccer, or the
              U.S. Men&apos;s National Team.
            </p>
          </section>
        </div>
      )}
    </div>
  );
}

export default RosterTabs;
