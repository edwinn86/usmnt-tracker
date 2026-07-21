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
  { key: 'prospects', label: 'Prospects', ids: usmntProspectIds },
  { key: 'cusp', label: 'On the Cusp', ids: usmntCuspIds },
  { key: 'dual', label: 'Dual Nats', ids: usmntDualIds },
];

function RosterTabs() {
  const [activeTab, setActiveTab] = useState(TABS[0].key);
  const activeIds = TABS.find((tab) => tab.key === activeTab)?.ids ?? [];

  return (
    <div>
      <div className="tab-bar">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            className={`tab-button ${activeTab === tab.key ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.key)}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <PlayerCardGrid playerIds={activeIds} />
    </div>
  );
}

export default RosterTabs;