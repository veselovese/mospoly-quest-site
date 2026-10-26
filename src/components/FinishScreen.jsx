import { Ticket, Trophy } from 'lucide-react';
import { getEnding } from '../quest/zooQuest';
import { getOrlovEnding } from '../quest/orlovQuest';
import { formatDuration } from '../utils/format';
import { leaderboardHref } from '../session/eventCode';
import { splitStory } from './StoryInterlude';

// Экран итогов: концовка по числу решённых заданий, итоги и призыв найти себя в рейтинге мероприятия
export default function FinishScreen({ summary, onChangeEvent }) {
  const ending = summary.questKey === 'orlov'
    ? getOrlovEnding(summary.solvedCount, summary.totalTasks)
    : getEnding(summary.solvedCount, summary.totalTasks);
  const fullName = `${summary.firstName} ${summary.lastName}`.trim();

  const stats = [
    ['Баллы', summary.score],
    ['Решено заданий', `${summary.solvedCount} из ${summary.totalTasks}`],
    ['Попыток', summary.attemptsCount],
    ['Время', formatDuration(summary.durationSeconds)],
  ];

  return (
    <div className="finish-screen">
      <div className="finish-card">
        <span className="eyebrow">
          {summary.finishReason === 'timeout' ? 'Время смены вышло' : ending.isFinal ? 'Финал' : 'Смена завершена'}
        </span>
        <h1>{ending.title}</h1>
        {fullName && <p>Участник: <strong>{fullName}</strong></p>}
        {summary.eventCode && <p>Мероприятие: <strong>{summary.eventCode}</strong></p>}

        <div className="finish-text">
          {splitStory(ending.text).map((paragraph) => (
            <p key={paragraph}>{paragraph}</p>
          ))}
        </div>

        <dl className="finish-stats">
          {stats.map(([label, value]) => (
            <div key={label}>
              <dt>{label}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>

        <div className="finish-actions">
          <a className="primary-action" href={leaderboardHref(summary.eventCode, fullName)}>
            <Trophy size={18} />
            Найди себя на лидерборде
          </a>
          {onChangeEvent && (
            <button className="ghost-action" onClick={onChangeEvent}>
              <Ticket size={16} />
              Ввести другой код мероприятия
            </button>
          )}
        </div>

        <p className="finish-note">
          Результат сохранён. Повторно пройти квест этого мероприятия на этом устройстве нельзя.
        </p>
      </div>
    </div>
  );
}
