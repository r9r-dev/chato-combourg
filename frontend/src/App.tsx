import { useEffect } from 'react';
import { GameProvider, useGame } from './context/GameContext';
import { Landing } from './pages/Landing';
import { Camera } from './pages/Camera';
import { Summary } from './pages/Summary';
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
    case 'camera':
      return <Camera />;
    case 'summary':
      return <Summary />;
    default:
      return <Landing />;
  }
}

function App() {
  return (
    <GameProvider>
      <AppContent />
    </GameProvider>
  );
}

export default App;
