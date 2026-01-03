import { useEffect } from 'react';
import { AuthProvider } from './context/AuthContext';
import { GameProvider, useGame } from './context/GameContext';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Landing } from './pages/Landing';
import { Players } from './pages/Players';
import { GameDate } from './pages/GameDate';
import { Keys } from './pages/Keys';
import { Coins } from './pages/Coins';
import { Camera } from './pages/Camera';
import { Review } from './pages/Review';
import { Summary } from './pages/Summary';
import { Games } from './pages/Games';
import { Settings } from './pages/Settings';
import { License } from './pages/License';
import { Changelog } from './pages/Changelog';
import { Developer } from './pages/Developer';
import { LegacyScores } from './pages/LegacyScores';
import { PlayMode } from './pages/PlayMode';
import { InstallPrompt } from './components/InstallPrompt';
import { WhatsNew } from './components/WhatsNew';
import { preloadCardImages } from './services/api';

function AppContent() {
  const { state } = useGame();

  // Preload all card images on app start
  useEffect(() => {
    preloadCardImages();
  }, []);

  switch (state.step) {
    case 'landing':
      return <Landing />;
    case 'players':
      return <Players />;
    case 'game-date':
      return <GameDate />;
    case 'keys':
      return <Keys />;
    case 'coins':
      return <Coins />;
    case 'camera':
      return <Camera />;
    case 'review':
      return <Review />;
    case 'summary':
      return <Summary />;
    case 'games':
      return <Games />;
    case 'settings':
      return <Settings />;
    case 'license':
      return <License />;
    case 'changelog':
      return <Changelog />;
    case 'developer':
      return <Developer />;
    case 'legacy-scores':
      return <LegacyScores />;
    case 'play':
      return <PlayMode />;
    default:
      return <Landing />;
  }
}

function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <GameProvider>
          <AppContent />
          <InstallPrompt />
          <WhatsNew />
        </GameProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
}

export default App;
