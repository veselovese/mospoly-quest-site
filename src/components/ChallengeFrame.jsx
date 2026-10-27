import { useState } from 'react';
import { BookOpen, ChevronDown, ClipboardList, Repeat, Star } from 'lucide-react';
import { plural } from '../utils/format';
import HintPanel from './HintPanel';

// Окно выполнения задания: краткое условие, баллы и попытки, рабочая область, памятка и подсказки
export default function ChallengeFrame({ task, solved, attempts, onBrief, hintReceipt, onRevealHint, pending = false, children }) {
  const [briefOpen, setBriefOpen] = useState(true);
  const briefId = `task-brief-${task.taskType}`;

  return (
    <div className="challenge-frame">
      <div className="challenge-topline">
        <span>{solved ? 'Улика подтверждена' : 'Активная задача'}</span>
        <button className="ghost-action" onClick={onBrief}>
          Вернуться к брифингу
        </button>
      </div>

      <section className="task-brief">
        <button
          className="task-brief-toggle"
          aria-expanded={briefOpen}
          aria-controls={briefId}
          onClick={() => setBriefOpen((open) => !open)}
        >
          <ClipboardList size={18} />
          Задание
          <ChevronDown size={18} className="task-brief-chevron" />
        </button>

        {briefOpen && (
          <p id={briefId} className="task-brief-text">
            {task.brief}
          </p>
        )}

        <div className="task-meta">
          <span>
            <Star size={15} />
            {hintReceipt?.availablePoints ?? task.points} {plural(hintReceipt?.availablePoints ?? task.points, ['балл', 'балла', 'баллов'])}
          </span>
          <span>
            <Repeat size={15} />
            Попыток: {attempts}
          </span>
        </div>
      </section>

      <div className="challenge-body">
        <div className="challenge-main">{children}</div>

        <aside className="challenge-aside">
          <div className="memo-card">
            <div className="panel-title">
              <BookOpen size={16} />
              Памятка
            </div>
            <ul>
              {task.memo.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
          <HintPanel key={task.taskType} hints={task.hints} policy={task.hintPenalty} receipt={hintReceipt} onReveal={onRevealHint} disabled={solved || pending} />
        </aside>
      </div>
    </div>
  );
}
