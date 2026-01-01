import { useGame } from '../context/GameContext';
import { NumericInputPage } from '../components/NumericInputPage';

export function Coins() {
  const { state, setCoins, setStep } = useGame();

  return (
    <NumericInputPage
      title="Pièces"
      question="Combien de pièces avez-vous ?"
      value={state.coins}
      onChange={setCoins}
      onNext={() => setStep('camera')}
    />
  );
}
