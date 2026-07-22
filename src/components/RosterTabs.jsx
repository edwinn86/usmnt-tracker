import { useState } from 'react';
import PlayerCardGrid from './PlayerCardGrid';
import {
  usmntPlayerIds,
  usmntProspectIds,
  usmntCuspIds,
  usmntDualIds,
} from '../data/usmntPlayerIds';

const TABS = [
  { key: 'firstTeam', label: 'First Team', ids: usmntPlayerIds },
  { key: 'cusp', label: 'On the Cusp', ids: usmntCuspIds },
  { key: 'prospects', label: 'Prospects', ids: usmntProspectIds },
  { key: 'dual', label: 'Dual Nats', ids: usmntDualIds },
];

function RosterTabs() {
  const [activeTab, setActiveTab] = useState(TABS[0].key);
  const activeIds = TABS.find((tab) => tab.key === activeTab)?.ids ?? [];

  return (
    <div>
      {/* Integrated App Header */}
      <header className="app-header">
        <div className="brand">
          <h1>USMNT TRACKER</h1>
          <span className="subtitle">July 2026</span>
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
      </header>

      {/* Grid Display */}
      <PlayerCardGrid playerIds={activeIds} />
    </div>
  );
}

export default RosterTabs;