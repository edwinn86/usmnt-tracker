import { useState, useEffect } from 'react'
import reactLogo from './assets/react.svg'
import viteLogo from './assets/vite.svg'
import heroImg from './assets/hero.png'
import './App.css'
import PlayerCardGrid from './components/PlayerCardGrid';
import RosterTabs from './components/RosterTabs';

function App() {
  return (
    <div>
      <h1>USMNT Tracker</h1>
      <RosterTabs />
    </div>
  );
}

export default App