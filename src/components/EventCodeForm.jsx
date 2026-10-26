import { useState } from 'react';
import { ArrowRight, Loader2 } from 'lucide-react';
import {
  EVENT_CODE_MAX_LENGTH,
  EVENT_CODE_MIN_LENGTH,
  eventErrorMessage,
  isValidEventCode,
  normalizeEventCode,
} from '../session/eventCode';

// Поле кода мероприятия: только цифры. onSubmit(code) может вернуть промис; его ошибка показывается под полем
export default function EventCodeForm({ initialCode = '', initialError = '', submitLabel = 'Продолжить', onSubmit }) {
  const [code, setCode] = useState(() => normalizeEventCode(initialCode));
  const [error, setError] = useState(initialError);
  const [pending, setPending] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    if (pending) return;

    if (!isValidEventCode(code)) {
      setError(`Код мероприятия — от ${EVENT_CODE_MIN_LENGTH} до ${EVENT_CODE_MAX_LENGTH} цифр`);
      return;
    }

    setError('');
    setPending(true);
    try {
      await onSubmit(code);
    } catch (err) {
      setError(eventErrorMessage(err));
      setPending(false);
    }
  }

  return (
    <form className="welcome-form event-code-form" onSubmit={handleSubmit} noValidate>
      <label className="query-part">
        <span>Код мероприятия</span>
        <input
          className="answer-input event-code-input"
          value={code}
          onChange={(event) => {
            setCode(normalizeEventCode(event.target.value));
            setError('');
          }}
          inputMode="numeric"
          pattern="[0-9]*"
          autoComplete="off"
          enterKeyHint="go"
          maxLength={EVENT_CODE_MAX_LENGTH}
          placeholder="Например, 6479"
          disabled={pending}
          aria-invalid={Boolean(error)}
        />
      </label>

      {error && (
        <p className="submit-feedback is-error" role="alert">
          {error}
        </p>
      )}

      <button className="primary-action" type="submit" disabled={pending}>
        {pending ? <Loader2 size={18} className="is-spinning" /> : <ArrowRight size={18} />}
        {pending ? 'Проверяем код...' : submitLabel}
      </button>
    </form>
  );
}
