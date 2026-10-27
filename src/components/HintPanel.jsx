import { useState } from 'react';
import { AlertTriangle } from 'lucide-react';

// Текст открывается только после подтверждённой сервером фиксации штрафа.
export default function HintPanel({ hints, policy, receipt, onReveal, disabled = false }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const visibleCount = Math.min(receipt?.used ?? 0, hints.length);
  const limit = Math.min(policy?.maxHints ?? 0, hints.length);
  const canReveal = policy && visibleCount < limit && !disabled;

  async function reveal() {
    if (!canReveal || pending) return;
    setPending(true);
    setError('');
    try { await onReveal(); }
    catch (err) { setError(`Не удалось открыть подсказку: ${err.message}. Повторите запрос.`); }
    finally { setPending(false); }
  }

  return (
    <aside className="hint-dock" aria-label="Подсказки">
      <button className="hint-trigger" disabled={!canReveal || pending} onClick={reveal}>
        <AlertTriangle size={16} />
        {pending ? 'Открываем подсказку...' : !policy ? 'Подсказки недоступны' : visibleCount >= limit
          ? 'Все подсказки открыты' : `Подсказка ${visibleCount}/${limit}`}
      </button>
      <p className="hint-policy">
        {policy ? `За каждую новую подсказку: −${policy.pointsPerHint} балл(а), минимум 0 за задание.`
          : 'Организатор ещё не включил подсказки со списанием баллов.'}
      </p>
      {error && <p className="submit-feedback is-error" role="alert">{error}</p>}
      {visibleCount > 0 && (
        <div className="hint-stack">
          {hints.slice(0, visibleCount).map((hint, index) => (
            <p key={hint}><strong>{index + 1}</strong>{hint}</p>
          ))}
        </div>
      )}
    </aside>
  );
}
