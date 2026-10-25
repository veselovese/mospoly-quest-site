import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Check,
  Globe2,
  Loader2,
  LogOut,
  Menu,
  PawPrint,
  RotateCcw,
  TerminalSquare,
  Trophy,
  X,
} from 'lucide-react';
import { getQuestConfig } from './api/client';
import { useQuestSession } from './hooks/useQuestSession';
import { getFallbackQuestConfig, normalizeQuestKey, QUEST_REGISTRY } from './quest/questRegistry';
import ChallengeFrame from './components/ChallengeFrame';
import ConfirmModal from './components/ConfirmModal';
import FinishScreen from './components/FinishScreen';
import RegistrationScreen from './components/RegistrationScreen';
import StoryInterlude from './components/StoryInterlude';
import { plural } from './utils/format';

const DEFAULT_ACCENT = { accent: '#29f0c8', accentRgb: '41, 240, 200' };
const MOCK_QUEST_KEY = import.meta.env.VITE_MOCK_QUEST === 'orlov' ? 'orlov' : 'zoo';

export default function App() {
  // Сессия участника хранится в localStorage (src/session/QuestSession.js).
  const { session, ...state } = useQuestSession();
  const [summary, setSummary] = useState(null);
  const [notice, setNotice] = useState('');
  const [finishError, setFinishError] = useState('');
  const [finishPending, setFinishPending] = useState(false);
  const [serverQuestConfig, setServerQuestConfig] = useState(null);
  const [configLoaded, setConfigLoaded] = useState(false);

  // Активный квест задаёт сервер. Запасная конфигурация нужна для локального режима и ошибок сети.
  useEffect(() => {
    let timerId = null;
    let controller = null;
    let disposed = false;
    const canRefresh = state.status !== 'active' && !summary;

    async function refreshConfig() {
      controller?.abort();
      controller = new AbortController();
      try {
        const config = await getQuestConfig({ signal: controller.signal });
        if (!disposed) setServerQuestConfig(config);
      } catch (error) {
        if (!disposed && error.name !== 'AbortError') {
          setServerQuestConfig((current) => current ?? getFallbackQuestConfig(MOCK_QUEST_KEY));
        }
      } finally {
        if (!disposed) setConfigLoaded(true);
        // Если экран регистрации открыт, активный квест обновляется без пересборки фронтенда.
        if (!disposed && canRefresh) timerId = window.setTimeout(refreshConfig, 10000);
      }
    }

    refreshConfig();
    return () => {
      disposed = true;
      window.clearTimeout(timerId);
      controller?.abort();
    };
  }, [state.status, Boolean(summary)]);

  const activeQuestKey = normalizeQuestKey(
    state.status === 'active' ? state.participant?.quest?.key : serverQuestConfig?.key || MOCK_QUEST_KEY,
  );
  const questDefinition = QUEST_REGISTRY[activeQuestKey];
  const questConfig = state.status === 'active' && state.participant?.quest
    ? state.participant.quest
    : serverQuestConfig ?? getFallbackQuestConfig(MOCK_QUEST_KEY);

  useEffect(() => {
    document.title = `${questConfig.title || questDefinition.title} — квест`;
  }, [questConfig.title, questDefinition.title]);

  // Если завершение прошло, но страницу закрыли до показа итогов, восстанавливаем их из локального снимка.
  useEffect(() => {
    if (state.status === 'finished' && !summary) {
      setSummary(session.getSummary());
      session.clear();
    }
  }, [state.status, summary, session]);

  async function register(firstName, lastName) {
    await session.register(firstName, lastName);
    setNotice('');
    // Ответ регистрации содержит закреплённый за участником квест.
    await session.loadTasks().catch(() => {});
  }

  // Результаты фиксируются на сервере до локального сброса сессии.
  async function finish(reason) {
    setFinishError('');
    setFinishPending(true);
    try {
      const result = await session.finish(reason);
      setSummary({ ...result, questKey: normalizeQuestKey(result.questKey || activeQuestKey) });
      session.clear();
      return true;
    } catch (error) {
      setFinishError(
        error.status === 0
          ? 'Не удалось сохранить результат на сервере. Проверьте соединение и повторите завершение смены.'
          : `Не удалось завершить смену: ${error.message}`,
      );
      return false;
    } finally {
      setFinishPending(false);
    }
  }

  const handleSessionLost = useCallback(() => {
    session.clear();
    setNotice('Сессия не найдена на сервере. Начните смену заново.');
  }, [session]);

  if (summary) {
    return (
      <ScreenShell>
        <FinishScreen summary={summary} onRestart={() => setSummary(null)} />
      </ScreenShell>
    );
  }

  if (state.status !== 'active') {
    if (!configLoaded) {
      return (
        <ScreenShell>
          <div className="stage-status welcome-loading">
            <Loader2 size={22} className="is-spinning" />
            Загружаем настройки активного квеста...
          </div>
        </ScreenShell>
      );
    }
    return (
      <ScreenShell>
        <RegistrationScreen notice={notice} onRegister={register} quest={questConfig} />
      </ScreenShell>
    );
  }

  return (
    <QuestScreen
      state={state}
      session={session}
      onFinish={finish}
      onSessionLost={handleSessionLost}
      questDefinition={questDefinition}
      questConfig={questConfig}
      finishError={finishError}
      finishPending={finishPending}
    />
  );
}

function ScreenShell({ children }) {
  return (
    <main
      className="screen-shell"
      style={{ '--accent': DEFAULT_ACCENT.accent, '--accent-rgb': DEFAULT_ACCENT.accentRgb }}
    >
      <div className="scanlines" aria-hidden="true" />
      {children}
    </main>
  );
}

function QuestScreen({
  state,
  session,
  onFinish,
  onSessionLost,
  questDefinition,
  questConfig,
  finishError,
  finishPending,
}) {
  const { participant, tasks, active, solved, attempts, points, showBriefing, readStories } = state;
  const [tasksStatus, setTasksStatus] = useState(() => ({ loading: tasks.length === 0, error: null }));
  const [pending, setPending] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const [showFinishModal, setShowFinishModal] = useState(false);
  const [railOpen, setRailOpen] = useState(false);
  const BrandIcon = questDefinition.key === 'orlov' ? TerminalSquare : PawPrint;

  // Фронтенд показывает интерфейсы, соответствующие task_type из API.
  const questTasks = useMemo(
    () => tasks.filter((task) => questDefinition.tasks[task.taskType])
      .map((task) => ({ ...task, ...questDefinition.tasks[task.taskType] })),
    [tasks, questDefinition],
  );

  const loadTasks = useCallback(async () => {
    setTasksStatus({ loading: true, error: null });
    try {
      await session.loadTasks();
      setTasksStatus({ loading: false, error: null });
    } catch (error) {
      if (error.status === 401) {
        onSessionLost();
        return;
      }
      setTasksStatus({ loading: false, error });
    }
  }, [session, onSessionLost]);

  useEffect(() => {
    if (tasks.length === 0) loadTasks();
  }, [tasks.length, loadTasks]);

  const index = Math.min(active, Math.max(questTasks.length - 1, 0));
  const task = questTasks[index];

  useEffect(() => {
    setFeedback(null);
  }, [task?.taskType, showBriefing]);

  const markStoryRead = useCallback((storyKey) => session.markStoryRead(storyKey), [session]);
  const solvedTasks = questTasks.filter((item) => solved.includes(item.taskType));
  const score = solvedTasks.reduce((sum, item) => sum + (points[item.taskType] ?? 0), 0);
  const progress = questTasks.length ? Math.round((solvedTasks.length / questTasks.length) * 100) : 0;
  const unlocked = questTasks.map((item, itemIndex) => itemIndex === 0 || solved.includes(questTasks[itemIndex - 1].taskType));
  const accent = task ?? DEFAULT_ACCENT;

  async function submitAnswer(answer) {
    setPending(true);
    setFeedback(null);
    try {
      const result = await session.submitAnswer(task.taskType, answer);
      if (result.correct) {
        session.setShowBriefing(true);
      } else {
        setFeedback({
          type: 'wrong',
          message: `Не сходится. Попытка ${result.attemptsCount} засчитана — проверьте решение и попробуйте ещё раз.`,
        });
      }
    } catch (error) {
      if (error.status === 401) {
        onSessionLost();
        return;
      }
      setFeedback({
        type: 'error',
        message: error.status === 0
          ? 'Не удалось связаться с сервером. Проверьте интернет и нажмите ещё раз — ответ не потеряется.'
          : `Не удалось проверить ответ: ${error.message}`,
      });
    } finally {
      setPending(false);
    }
  }

  async function revealHint() {
    setPending(true);
    try { await session.revealHint(task.taskType); }
    finally { setPending(false); }
  }

  function goNext() {
    if (index < questTasks.length - 1) {
      session.setActive(index + 1);
      session.setShowBriefing(true);
    }
  }

  function openTask(taskIndex) {
    session.setActive(taskIndex);
    session.setShowBriefing(true);
    setRailOpen(false);
  }

  return (
    <main className="app-shell" style={{ '--accent': accent.accent, '--accent-rgb': accent.accentRgb }}>
      <div className="scanlines" aria-hidden="true" />
      <aside className={`side-rail ${railOpen ? 'is-open' : ''}`}>
        <div className="rail-top">
          <div className="brand">
            <div className="brand-mark"><BrandIcon size={23} /></div>
            <div>
              <p>{questConfig.title || questDefinition.title}</p>
              <span>Смена: {participant.firstName} {participant.lastName}</span>
            </div>
          </div>

          <button
            className="ghost-action rail-toggle"
            aria-expanded={railOpen}
            aria-controls="rail-details"
            aria-label={railOpen ? 'Скрыть меню' : 'Показать меню'}
            onClick={() => setRailOpen((open) => !open)}
          >
            <strong>{progress}%</strong>
            {railOpen ? <X size={18} /> : <Menu size={18} />}
          </button>

          <div className="rail-progress" aria-hidden="true"><span style={{ width: `${progress}%` }} /></div>
        </div>

        <div className="rail-details" id="rail-details">
          <div className="progress-block">
            <div className="progress-head"><span>Прогресс</span><strong>{progress}%</strong></div>
            <div className="progress-track"><span style={{ width: `${progress}%` }} /></div>
          </div>

          <nav className="mission-nav" aria-label="Задания квеста">
            {questTasks.map((item, itemIndex) => {
              const Icon = item.icon;
              const done = solved.includes(item.taskType);
              return (
                <button
                  key={item.taskType}
                  className={`nav-node ${index === itemIndex ? 'active' : ''} ${done ? 'done' : ''}`}
                  disabled={!unlocked[itemIndex] || pending || finishPending}
                  onClick={() => openTask(itemIndex)}
                >
                  <Icon size={18} />
                  <span>{item.label}</span>
                  {done && <Check size={16} />}
                </button>
              );
            })}
          </nav>

          <div className="signal-panel">
            <div className="panel-title"><Globe2 size={16} />Журнал смены</div>
            <code>{questDefinition.personalize(questDefinition.shiftStartLog, participant.firstName)}</code>
            {solvedTasks.map((item) => <code key={item.taskType}>{item.log}</code>)}
          </div>

          <div className="rail-actions">
            <a className="ghost-action leaderboard-link" href="/leaderboard"><Trophy size={16} />Лидерборд</a>
            <button
              className="ghost-action"
              onClick={() => { setRailOpen(false); setShowFinishModal(true); }}
            >
              <LogOut size={16} />Завершить смену
            </button>
          </div>
        </div>
      </aside>

      {showFinishModal && (
        <ConfirmModal
          title="Завершить смену?"
          confirmLabel={finishPending ? 'Сохраняем...' : 'Завершить'}
          cancelLabel="Продолжить смену"
          confirmDisabled={finishPending}
          onCancel={() => setShowFinishModal(false)}
          onConfirm={async () => {
            const finished = await onFinish('gave_up');
            if (finished) setShowFinishModal(false);
          }}
        >
          <p>
            Квест закончится, а ваш результат — {score} {plural(score, ['балл', 'балла', 'баллов'])}, решено{' '}
            {solvedTasks.length} из {questTasks.length} — попадёт в рейтинг. Продолжить с этого места потом не получится.
          </p>
          {finishError && <p className="submit-feedback is-error" role="alert">{finishError}</p>}
        </ConfirmModal>
      )}

      <section className="stage">
        {finishError && !showFinishModal && <p className="submit-feedback is-error finish-error" role="alert">{finishError}</p>}
        {!task ? (
          <TasksStatus status={tasksStatus} hasTasks={tasks.length > 0} onRetry={loadTasks} />
        ) : (
          <>
            <header className="stage-header">
              <div>
                <span className="eyebrow">
                  Блок {task.block + 1} / {questDefinition.blocks.length} · {questDefinition.blocks[task.block]} · Задание {index + 1} / {questTasks.length}
                </span>
                <h1>{task.title}</h1>
              </div>
              <div className="module-token"><task.icon size={24} /><span>{task.label}</span></div>
            </header>

            {showBriefing ? (
              <QuestStory
                task={task}
                participant={participant}
                personalizeText={questDefinition.personalize}
                isSolved={solved.includes(task.taskType)}
                isFinal={index === questTasks.length - 1}
                earned={points[task.taskType]}
                readStories={readStories}
                onRead={markStoryRead}
                onStart={() => session.setShowBriefing(false)}
                onNext={goNext}
                onFinish={() => onFinish('completed')}
                finishPending={finishPending}
                storyLabel={questDefinition.key === 'orlov' ? 'Терминал расследования' : 'Терминал лаборатории'}
              />
            ) : (
              <ChallengeFrame
                task={task}
                solved={solved.includes(task.taskType)}
                attempts={attempts[task.taskType] ?? 0}
                onBrief={() => session.setShowBriefing(true)}
                hintReceipt={state.hints[task.taskType]}
                onRevealHint={revealHint}
                pending={pending || finishPending}
              >
                <task.component
                  key={task.taskType}
                  solved={solved.includes(task.taskType)}
                  submit={{ pending, feedback, onSubmit: submitAnswer }}
                />
              </ChallengeFrame>
            )}
          </>
        )}
      </section>
    </main>
  );
}

function QuestStory({
  task,
  participant,
  personalizeText,
  isSolved,
  isFinal,
  earned,
  readStories,
  onRead,
  onStart,
  onNext,
  onFinish,
  finishPending,
  storyLabel,
}) {
  const storyKey = `${task.taskType}-${isSolved ? 'outcome' : 'intro'}`;
  return (
    <>
      {isSolved && (
        <p className="reward-banner" role="status">
          <Check size={16} />
          Верно! +{earned ?? task.points} {plural(earned ?? task.points, ['балл', 'балла', 'баллов'])}
        </p>
      )}
      <StoryInterlude
        key={storyKey}
        storyKey={storyKey}
        text={personalizeText(isSolved ? task.outcome : task.intro, participant.firstName)}
        isSolved={isSolved}
        isFinal={isFinal}
        hasPlayed={readStories.includes(storyKey)}
        onRead={onRead}
        onStart={onStart}
        onNext={onNext}
        onFinish={onFinish}
        finishPending={finishPending}
        transmissionLabel={storyLabel}
      />
    </>
  );
}

function TasksStatus({ status, hasTasks, onRetry }) {
  if (status.loading) {
    return <div className="stage-status"><Loader2 size={22} className="is-spinning" />Загружаем задания...</div>;
  }
  return (
    <div className="stage-status">
      <AlertTriangle size={22} />
      {status.error
        ? status.error.status === 0
          ? 'Не удалось загрузить задания: сервер не отвечает.'
          : `Не удалось загрузить задания: ${status.error.message}`
        : hasTasks
          ? 'Для заданий активного квеста нет подходящего интерфейса. Проверьте версию фронтенда.'
          : 'Сейчас нет активных заданий. Обратитесь к организаторам.'}
      <button className="primary-action" onClick={onRetry}><RotateCcw size={16} />Повторить</button>
    </div>
  );
}
