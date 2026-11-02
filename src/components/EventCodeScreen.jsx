import { Ticket, Trophy } from 'lucide-react';
import EventCodeForm from './EventCodeForm';

// Первый экран сайта: код мероприятия определяет квест и рейтинг
export default function EventCodeScreen({ initialCode, initialError, notice, onSubmit }) {
  return (
    <div className="welcome-screen">
      <div className="welcome-card">
        <div className="welcome-brand">
          <div className="brand-mark">
            <Ticket size={26} />
          </div>
          <span className="eyebrow">Квест Мосполитеха</span>
        </div>

        <h1>Код мероприятия</h1>
        <p className="welcome-lead">Введите код, который назвал организатор.</p>
        <p>По коду откроется квест вашего мероприятия, а результат попадёт в его рейтинг.</p>

        {notice && <p className="welcome-notice">{notice}</p>}

        <EventCodeForm initialCode={initialCode} initialError={initialError} onSubmit={onSubmit} />

        <div className="welcome-footer">
          <span>Код состоит из цифр и есть у организатора</span>
          <a href="/leaderboard">
            <Trophy size={15} />
            Лидерборд мероприятия
          </a>
        </div>
      </div>
    </div>
  );
}
