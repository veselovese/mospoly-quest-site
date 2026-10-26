import { useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, ArrowLeft, RefreshCw, Ticket, Trophy } from 'lucide-react';
import { ApiError, getEvent, getEventRanking } from '../api/client';
import EventCodeForm from '../components/EventCodeForm';
import { isValidEventCode, leaderboardHref, normalizeEventCode } from '../session/eventCode';
import { formatDuration } from '../utils/format';

// Как часто обновлять рейтинг (по требованию — раз в 2–3 секунды)
const POLL_INTERVAL_MS = 3000;

// Рейтинг строится по мероприятию: /leaderboard?id=6479. Без кода — форма ввода кода
export default function LeaderboardPage() {
  const params = useMemo(() => new URLSearchParams(window.location.search), []);
  const eventCode = normalizeEventCode(params.get('id') ?? '');
  // Имя участника из ссылки «Найди себя на лидерборде»: &me=Имя+Фамилия
  const meParam = params.get('me') ?? '';

  if (!isValidEventCode(eventCode)) {
    return <EventPicker meParam={meParam} />;
  }

  return <EventLeaderboard eventCode={eventCode} me={normalizeName(meParam)} meParam={meParam} />;
}

function LeaderboardShell({ children }) {
  return (
    <main className="leaderboard-shell" style={{ '--accent': '#29f0c8', '--accent-rgb': '41, 240, 200' }}>
      <div className="scanlines" aria-hidden="true" />
      <div className="leaderboard-page">{children}</div>
    </main>
  );
}

function EventPicker({ meParam, notFoundCode = '' }) {
  useEffect(() => {
    document.title = 'Лидерборд — код мероприятия';
  }, []);

  return (
    <LeaderboardShell>
      <header className="leaderboard-header">
        <a className="ghost-action leaderboard-back" href="/">
          <ArrowLeft size={16} />
          К квесту
        </a>
        <div className="leaderboard-title">
          <div className="brand-mark">
            <Trophy size={23} />
          </div>
          <div>
            <h1>Лидерборд</h1>
            <span className="eyebrow">Рейтинг формируется по коду мероприятия</span>
          </div>
        </div>
      </header>

      <div className="welcome-card leaderboard-picker">
        <p>Введите код мероприятия, чтобы открыть его рейтинг.</p>
        <EventCodeForm
          initialCode={notFoundCode}
          initialError={notFoundCode ? 'Мероприятие с таким кодом не найдено. Проверьте код у организатора.' : ''}
          submitLabel="Открыть рейтинг"
          onSubmit={(code) => window.location.assign(leaderboardHref(code, meParam))}
        />
      </div>
    </LeaderboardShell>
  );
}

function EventLeaderboard({ eventCode, me, meParam }) {
  const [event, setEvent] = useState(null);
  const [notFound, setNotFound] = useState(false);
  const [rows, setRows] = useState(null);
  const [error, setError] = useState(null);
  const [updatedAt, setUpdatedAt] = useState(null);
  const [nextUpdateAt, setNextUpdateAt] = useState(null);
  const now = useNow(500);
  const myRowRef = useRef(null);
  const scrolledToMe = useRef(false);

  // Название мероприятия и квеста; при ошибке сети пробуем ещё раз
  useEffect(() => {
    let disposed = false;
    let timerId = null;
    let controller = null;

    async function loadEvent() {
      controller?.abort();
      controller = new AbortController();
      try {
        const data = await getEvent(eventCode, { signal: controller.signal });
        if (!disposed) setEvent(data);
      } catch (err) {
        if (disposed || err.name === 'AbortError') return;
        if (err.status === 404) {
          setNotFound(true);
          return;
        }
        timerId = window.setTimeout(loadEvent, 15000);
      }
    }

    loadEvent();
    return () => {
      disposed = true;
      window.clearTimeout(timerId);
      controller?.abort();
    };
  }, [eventCode]);

  useEffect(() => {
    document.title = `Лидерборд ${eventCode}${event?.quest?.title ? ` — ${event.quest.title}` : ''}`;
  }, [eventCode, event]);

  // Опрашиваем рейтинг без перезагрузки страницы; в скрытой вкладке опрос останавливается
  useEffect(() => {
    let timerId = null;
    let controller = null;
    let disposed = false;

    async function refresh() {
      window.clearTimeout(timerId);
      controller?.abort();
      controller = new AbortController();
      setNextUpdateAt(null);

      try {
        const data = await getEventRanking(eventCode, { signal: controller.signal });
        if (disposed) return;
        setRows(Array.isArray(data) ? data : []);
        setError(null);
        setUpdatedAt(Date.now());
      } catch (err) {
        if (disposed || err.name === 'AbortError') return;
        // Неизвестный код: опрос останавливается, показывается форма
        if (err instanceof ApiError && err.status === 404) {
          setNotFound(true);
          return;
        }
        setError(err);
      }

      scheduleNext();
    }

    function scheduleNext() {
      if (document.hidden) return;
      setNextUpdateAt(Date.now() + POLL_INTERVAL_MS);
      timerId = window.setTimeout(refresh, POLL_INTERVAL_MS);
    }

    function handleVisibilityChange() {
      if (document.hidden) {
        window.clearTimeout(timerId);
        setNextUpdateAt(null);
      } else {
        refresh();
      }
    }

    refresh();
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      disposed = true;
      window.clearTimeout(timerId);
      controller?.abort();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [eventCode]);

  // Один раз прокручиваем к строке участника, когда она появилась
  useEffect(() => {
    if (!scrolledToMe.current && myRowRef.current) {
      scrolledToMe.current = true;
      myRowRef.current.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }
  }, [rows]);

  // Таймер отсчёта может отставать (в фоновой вкладке браузер замедляет таймеры), поэтому ограничиваем сверху
  const secondsLeft = nextUpdateAt
    ? Math.min(POLL_INTERVAL_MS / 1000, Math.max(0, Math.ceil((nextUpdateAt - now) / 1000)))
    : null;
  const hasRows = Array.isArray(rows) && rows.length > 0;

  if (notFound) {
    return <EventPicker meParam={meParam} notFoundCode={eventCode} />;
  }

  return (
    <LeaderboardShell>
      <header className="leaderboard-header">
        <div className="leaderboard-links">
          <a className="ghost-action leaderboard-back" href={`/?id=${eventCode}`}>
            <ArrowLeft size={16} />
            К квесту
          </a>
          <a className="ghost-action leaderboard-back" href="/leaderboard">
            <Ticket size={16} />
            Другой код
          </a>
        </div>

        <div className="leaderboard-title">
          <div className="brand-mark">
            <Trophy size={23} />
          </div>
          <div>
            <h1>Лидерборд</h1>
            <span className="eyebrow" data-quest={event?.quest?.key}>
              Мероприятие {eventCode}
              {event?.title ? ` · ${event.title}` : ''}
              {event?.quest?.title ? ` · ${event.quest.title}` : ''}
            </span>
          </div>
        </div>

        <div className="leaderboard-status" aria-live="polite">
          <span>
            <RefreshCw size={14} className={secondsLeft === null ? 'is-spinning' : ''} />
            {secondsLeft === null ? 'Обновление...' : `Обновление через ${secondsLeft} с`}
          </span>
          {updatedAt && <span>обновлено {formatClock(updatedAt)}</span>}
          <div className="leaderboard-countdown" aria-hidden="true">
            {nextUpdateAt && <span key={nextUpdateAt} style={{ animationDuration: `${POLL_INTERVAL_MS}ms` }} />}
          </div>
        </div>
      </header>

      {error && (
        <div className="leaderboard-error" role="status">
          <AlertTriangle size={16} />
          {updatedAt
            ? `Не удалось обновить рейтинг. Показаны данные на ${formatClock(updatedAt)}, повторим автоматически.`
            : 'Не удалось загрузить рейтинг. Повторим автоматически.'}
        </div>
      )}

      {rows === null && !error && <p className="leaderboard-empty">Загружаем рейтинг...</p>}

      {Array.isArray(rows) && rows.length === 0 && (
        <p className="leaderboard-empty">Пока никто не завершил смену. Ваш результат может стать первым!</p>
      )}

      {hasRows && (
        <div className="leaderboard-table">
          <table>
            <thead>
              <tr>
                <th>Место</th>
                <th>Участник</th>
                <th>Баллы</th>
                <th>Решено</th>
                <th>Попыток</th>
                <th>Время</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const fullName = `${row.first_name} ${row.last_name}`;
                const isMe = me !== '' && normalizeName(fullName) === me;

                return (
                  <tr
                    key={`${row.place}-${fullName}`}
                    ref={isMe ? myRowRef : undefined}
                    className={`${row.place <= 3 ? `is-top is-top-${row.place}` : ''} ${isMe ? 'is-me' : ''}`}
                  >
                    <td data-label="Место">
                      <b className="place-badge">{row.place}</b>
                    </td>
                    <td data-label="Участник" className="leaderboard-name">
                      {fullName}
                      {isMe && <em>Это вы</em>}
                    </td>
                    <td data-label="Баллы" className="leaderboard-score">{row.score}</td>
                    <td data-label="Решено">{row.solved_tasks}</td>
                    <td data-label="Попыток">{row.attempts_count}</td>
                    <td data-label="Время">{formatDuration(row.time_seconds)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </LeaderboardShell>
  );
}

// Текущее время, обновляемое с заданным шагом, — для обратного отсчёта
function useNow(stepMs) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), stepMs);
    return () => window.clearInterval(id);
  }, [stepMs]);

  return now;
}

function normalizeName(name) {
  return name.trim().replace(/\s+/g, ' ').toLowerCase();
}

function formatClock(timestamp) {
  return new Date(timestamp).toLocaleTimeString('ru-RU');
}
