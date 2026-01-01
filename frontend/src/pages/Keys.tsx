import { useGame } from '../context/GameContext';
import { NumericInputPage } from '../components/NumericInputPage';

export function Keys() {
  const { state, setKeys, setStep } = useGame();

  return (
    <NumericInputPage
      title="Clés"
      question="Combien de clés avez-vous ?"
      value={state.keys}
      onChange={setKeys}
      onNext={() => setStep('coins')}
    />
  );
}
