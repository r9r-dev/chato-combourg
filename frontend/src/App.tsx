import { useEffect } from 'react';
import { AuthProvider } from './context/AuthContext';
import { GameProvider, useGame } from './context/GameContext';
import { Landing } from './pages/Landing';
import { Players } from './pages/Players';
import { Keys } from './pages/Keys';
import { Coins } from './pages/Coins';
import { Camera } from './pages/Camera';
import { Summary } from './pages/Summary';
import { Games } from './pages/Games';
import { Settings } from './pages/Settings';
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
    case 'keys':
      return <Keys />;
    case 'coins':
      return <Coins />;
    case 'camera':
      return <Camera />;
    case 'summary':
      return <Summary />;
    case 'games':
      return <Games />;
    case 'settings':
      return <Settings />;
    default:
      return <Landing />;
  }
}

function App() {
  return (
    <AuthProvider>
      <GameProvider>
        <AppContent />
      </GameProvider>
    </AuthProvider>
  );
}

export default App;
