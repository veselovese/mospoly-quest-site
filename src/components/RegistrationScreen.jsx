import { useState } from 'react';
import { Loader2, PawPrint, RefreshCw, TerminalSquare, Trophy } from 'lucide-react';
import { generateNickname } from '../utils/nickname';

const MAX_NAME_LENGTH = 50;

// По умолчанию участник получает ник; ручной ввод сохраняет прежний сценарий входа.
export default function RegistrationScreen({ notice, onRegister, quest }) {
  const config = quest ?? {};
  const isOrlov = config.key === 'orlov';
  const BrandIcon = isOrlov ? TerminalSquare : PawPrint;
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [nickname, setNickname] = useState(() => generateNickname());
  const [useOwnName, setUseOwnName] = useState(false);
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    if (pending) return;
    const first = (useOwnName ? firstName : nickname.firstName).trim();
    const last = (useOwnName ? lastName : nickname.lastName).trim();

    if (!first || !last) {
      setError('Введите имя и фамилию');
      return;
    }

    if (first.length > MAX_NAME_LENGTH || last.length > MAX_NAME_LENGTH) {
      setError(`Не длиннее ${MAX_NAME_LENGTH} символов`);
      return;
    }

    setError('');
    setPending(true);

    try {
      await onRegister(first, last);
    } catch (err) {
      setError(
        err.status === 0
          ? 'Не удалось начать смену: сервер не отвечает. Попробуйте ещё раз'
          : `Не удалось начать смену: ${err.message}`,
      );
      setPending(false);
    }
  }

  return (
    <div className="welcome-screen">
      <div className="welcome-card">
        <div className="welcome-brand">
          <div className="brand-mark">
            <BrandIcon size={26} />
          </div>
          <span className="eyebrow">{config.brand_label || 'Квест'}</span>
        </div>

        <h1>{config.title || 'Квест'}</h1>
        <p className="welcome-lead">{config.welcome_lead || 'Введите имя и фамилию, чтобы начать.'}</p>
        <p>{config.welcome_text || 'После регистрации задания и результаты будут связаны с этой сменой.'}</p>

        {notice && <p className="welcome-notice">{notice}</p>}

        <form className="welcome-form" onSubmit={handleSubmit} noValidate>
          {!useOwnName && (
            <div className="nickname-picker">
              <span>Ваш ник</span>
              <strong aria-live="polite" aria-atomic="true">{nickname.firstName} {nickname.lastName}</strong>
              <button
                className="ghost-action"
                type="button"
                disabled={pending}
                onClick={() => setNickname((current) => generateNickname(current))}
              >
                <RefreshCw size={18} />Другой ник
              </button>
            </div>
          )}
          {useOwnName && <>
          <label className="query-part">
            <span>Имя</span>
            <input
              className="answer-input"
              value={firstName}
              onChange={(event) => setFirstName(event.target.value)}
              autoComplete="given-name"
              maxLength={MAX_NAME_LENGTH + 10}
              disabled={pending}
            />
          </label>
          <label className="query-part">
            <span>Фамилия</span>
            <input
              className="answer-input"
              value={lastName}
              onChange={(event) => setLastName(event.target.value)}
              autoComplete="family-name"
              maxLength={MAX_NAME_LENGTH + 10}
              disabled={pending}
            />
          </label>
          </>}
          <small>Так вас увидят в рейтинге</small>
          <button
            className="ghost-action"
            type="button"
            disabled={pending}
            onClick={() => { setUseOwnName((current) => !current); setError(''); }}
          >
            {useOwnName ? 'Использовать случайный ник' : 'Ввести имя и фамилию'}
          </button>

          {error && (
            <p className="submit-feedback is-error" role="alert">
              {error}
            </p>
          )}

          <button className="primary-action" type="submit" disabled={pending}>
            {pending && <Loader2 size={18} className="is-spinning" />}
            {pending ? 'Начинаем смену...' : 'Заступить на смену'}
          </button>
        </form>

        <div className="welcome-footer">
          <span>{config.duration_text || '20–30 минут'} · {config.task_count ?? 0} заданий · завершить можно в любой момент</span>
          <a href="/leaderboard">
            <Trophy size={15} />
            Посмотреть лидерборд
          </a>
        </div>
      </div>
    </div>
  );
}
