import { GameProvider, useGame } from './context/GameContext';
import { Landing } from './pages/Landing';
import { Camera } from './pages/Camera';
import { Summary } from './pages/Summary';

function AppContent() {
  const { state } = useGame();

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
