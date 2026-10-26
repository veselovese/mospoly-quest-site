import { useEffect, useRef, useState } from 'react';
import { Timer } from 'lucide-react';
import { remainingSeconds, timerLevel } from '../session/questTimer';
import { formatDuration } from '../utils/format';

// Обратный отсчёт до конца смены. Время пересчитывается от часов на каждом тике, поэтому в фоновой вкладке
// (где браузер замедляет таймеры) не отстаёт. onExpire вызывается один раз, когда время вышло
export default function QuestTimer({ deadline, offsetMs, onExpire }) {
  const [now, setNow] = useState(() => Date.now());
  const expired = useRef(false);

  useEffect(() => {
    const tick = () => setNow(Date.now());
    const id = window.setInterval(tick, 1000);
    document.addEventListener('visibilitychange', tick);
    return () => {
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', tick);
    };
  }, []);

  const seconds = remainingSeconds(deadline, offsetMs, now);
  const level = timerLevel(seconds);

  useEffect(() => {
    if (seconds === 0 && !expired.current) {
      expired.current = true;
      onExpire();
    }
  }, [seconds, onExpire]);

  if (seconds === null) return null;

  // Объявление для экранных читалок — только при смене уровня, а не каждую секунду
  const announcement = { warning: 'Осталось меньше 5 минут', critical: 'Осталось меньше минуты' }[level] ?? '';

  return (
    <div className={`quest-timer is-${level}`} role="timer" aria-label={`Осталось времени: ${formatDuration(seconds)}`}>
      <Timer size={16} aria-hidden="true" />
      <span className="quest-timer-label">Осталось</span>
      <strong>{formatDuration(seconds)}</strong>
      <span className="sr-only" aria-live="polite">
        {announcement}
      </span>
    </div>
  );
}
