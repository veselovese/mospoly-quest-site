import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  Check,
  Globe2,
  Hourglass,
  Loader2,
  LogOut,
  Menu,
  PawPrint,
  RotateCcw,
  TerminalSquare,
  Trophy,
  X,
} from 'lucide-react';
import { ApiError, getEvent } from './api/client';
import { useQuestSession } from './hooks/useQuestSession';
import { getFallbackQuestConfig, normalizeQuestKey, QUEST_REGISTRY } from './quest/questRegistry';
import ChallengeFrame from './components/ChallengeFrame';
import ConfirmModal from './components/ConfirmModal';
import FinishScreen from './components/FinishScreen';
import RegistrationScreen from './components/RegistrationScreen';
import EventCodeScreen from './components/EventCodeScreen';
import QuestContentProtection from './components/QuestContentProtection';
import QuestTimer from './components/QuestTimer';
import StoryInterlude from './components/StoryInterlude';
import { getUnlockedTasks } from './session/taskNavigation.js';
import { isTimeExpired, resolveDeadline, resolveTimeLimit } from './session/questTimer';
import { plural } from './utils/format';
import { isCompletionStorageKey, readCompletion } from './session/completionStore';
import {
  EVENT_CLOSED_MESSAGE,
  eventErrorMessage,
  forgetEvent,
  isValidEventCode,
  leaderboardHref,
  normalizeEventCode,
  readEvent,
  rememberEvent,
} from './session/eventCode';

const DEFAULT_ACCENT = { accent: '#29f0c8', accentRgb: '41, 240, 200' };

// Код из ссылки или QR-кода на мероприятии: /?id=6479
const LINK_EVENT_CODE = normalizeEventCode(new URLSearchParams(window.location.search).get('id') ?? '');

export default function App() {
  // Сессия участника хранится в localStorage (src/session/QuestSession.js).
  const { session, ...state } = useQuestSession();
  const [summary, setSummary] = useState(null);
  const [notice, setNotice] = useState('');
  const [finishError, setFinishError] = useState('');
  const [finishPending, setFinishPending] = useState(false);
  // Мероприятие { code, title, quest }: из ссылки, из памяти устройства или с экрана ввода кода.
  const [event, setEvent] = useState(() => readEvent());
  const [eventError, setEventError] = useState('');
  const [checkingLink, setCheckingLink] = useState(
    () => isValidEventCode(LINK_EVENT_CODE) && state.status !== 'active' && readEvent()?.code !== LINK_EVENT_CODE,
  );

  // Квест задаёт мероприятие; у начатой смены — то, на котором участник зарегистрирован.
  const isActive = state.status === 'active';
  const eventQuest = (isActive ? state.participant?.quest : null) ?? event?.quest ?? null;
  const eventCode = (isActive ? state.participant?.event?.code : event?.code) ?? null;
  const activeQuestKey = normalizeQuestKey(eventQuest?.key);
  const questDefinition = QUEST_REGISTRY[activeQuestKey];
  const questConfig = { ...getFallbackQuestConfig(activeQuestKey), ...(eventQuest ?? {}) };
  const [, refreshCompletion] = useState(0);
  const completedSummary = eventQuest ? readCompletion(activeQuestKey, eventCode) : null;

  // Код из ссылки проверяется сразу, сохранённое мероприятие обновляется в фоне.
  useEffect(() => {
    if (session.state.status === 'active') {
      clearLinkCode();
      return undefined;
    }
    let disposed = false;
    const saved = readEvent();

    if (isValidEventCode(LINK_EVENT_CODE) && saved?.code !== LINK_EVENT_CODE) {
      getEvent(LINK_EVENT_CODE)
        .then((next) => {
          if (disposed) return;
          if (!next.isActive) throw closedEventError();
          rememberEvent(next);
          setEvent(next);
          clearLinkCode();
        })
        .catch((error) => {
          if (!disposed) setEventError(eventErrorMessage(error));
        })
        .finally(() => {
          if (!disposed) setCheckingLink(false);
        });
    } else if (saved) {
      if (saved.code === LINK_EVENT_CODE) clearLinkCode();
      getEvent(saved.code)
        .then((next) => {
          if (disposed) return;
          if (!next.isActive) throw closedEventError();
          rememberEvent(next);
          setEvent(next);
        })
        .catch((error) => {
          // Без сети остаёмся с сохранённым мероприятием; итоги завершённой смены показываем и после закрытия.
          if (disposed || error.status === 0 || readCompletion(normalizeQuestKey(saved.quest.key), saved.code)) return;
          forgetEvent();
          setEvent(null);
          setNotice(eventErrorMessage(error));
        });
    }

    return () => {
      disposed = true;
    };
  }, [session]);

  // Завершение в другой вкладке закрывает сохранённую активную сессию здесь.
  useEffect(() => {
    const syncCompletion = (storageEvent) => {
      if (!isCompletionStorageKey(storageEvent.key)) return;
      const participant = session.state.participant;
      const questKey = normalizeQuestKey(participant?.quest?.key ?? activeQuestKey);
      if (readCompletion(questKey, participant?.event?.code ?? eventCode)) session.clear();
      refreshCompletion((value) => value + 1);
    };
    window.addEventListener('storage', syncCompletion);
    return () => window.removeEventListener('storage', syncCompletion);
  }, [session, activeQuestKey, eventCode]);

  useEffect(() => {
    document.title = eventQuest ? `${questConfig.title || questDefinition.title} — квест` : 'Код мероприятия — квест';
  }, [eventQuest, questConfig.title, questDefinition.title]);

  // Если завершение прошло, но страницу закрыли до показа итогов, восстанавливаем их из локального снимка.
  useEffect(() => {
    if (state.status === 'finished' && !summary) {
      setSummary(session.getSummary());
      session.clear();
    }
  }, [state.status, summary, session]);

  const selectEvent = useCallback(async (code) => {
    const next = await getEvent(code);
    if (!next.isActive) throw closedEventError();
    rememberEvent(next);
    setEvent(next);
    setNotice('');
    setEventError('');
  }, []);

  function changeEvent() {
    forgetEvent();
    setEvent(null);
    setSummary(null);
    setNotice('');
    setEventError('');
  }

  async function register(firstName, lastName) {
    await session.register(firstName, lastName, { ...event, quest: questConfig });
    setNotice('');
    // Ответ регистрации содержит квест мероприятия.
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
      // Сервер не знает токен — повтор не поможет, начинаем смену заново
      if (error.status === 401) {
        handleSessionLost();
        return false;
      }
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

  if (summary || completedSummary) {
    return (
      <ScreenShell>
        <FinishScreen summary={summary ?? completedSummary} onChangeEvent={changeEvent} />
      </ScreenShell>
    );
  }

  if (!isActive) {
    if (checkingLink) {
      return (
        <ScreenShell>
          <div className="stage-status welcome-loading">
            <Loader2 size={22} className="is-spinning" />
            Проверяем код мероприятия...
          </div>
        </ScreenShell>
      );
    }

    if (!event) {
      return (
        <ScreenShell>
          <EventCodeScreen
            initialCode={LINK_EVENT_CODE}
            initialError={eventError}
            notice={notice}
            onSubmit={selectEvent}
          />
        </ScreenShell>
      );
    }

    return (
      <ScreenShell>
        <RegistrationScreen
          notice={notice}
          onRegister={register}
          quest={questConfig}
          event={event}
          onChangeEvent={changeEvent}
        />
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
      eventCode={eventCode}
      finishError={finishError}
      finishPending={finishPending}
    />
  );
}

// Код из ссылки применён — убираем его из адреса, чтобы после смены кода перезагрузка не вернула прежнее мероприятие.
// При ошибке проверки параметр остаётся: перезагрузка повторит попытку
function clearLinkCode() {
  const url = new URL(window.location.href);
  if (!url.searchParams.has('id')) return;
  url.searchParams.delete('id');
  window.history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`);
}

// Закрытое мероприятие: рейтинг доступен, регистрация — нет
function closedEventError() {
  return new ApiError(EVENT_CLOSED_MESSAGE, { status: 403 });
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
  eventCode,
  finishError,
  finishPending,
}) {
  const { participant, tasks, active, solved, attempts, points, showBriefing, readStories } = state;
  const [tasksStatus, setTasksStatus] = useState(() => ({ loading: tasks.length === 0, error: null }));
  const [pending, setPending] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const [showFinishModal, setShowFinishModal] = useState(false);
  const [railOpen, setRailOpen] = useState(false);
  const [showSkipModal, setShowSkipModal] = useState(false);
  // Лимит времени смены: дедлайн с сервера или от начала смены (docs/quest-timer.md)
  const limitSeconds = resolveTimeLimit(questConfig, getFallbackQuestConfig(questDefinition.key).time_limit_seconds);
  const deadline = resolveDeadline(participant, limitSeconds);
  const [timeUp, setTimeUp] = useState(false);
  const timeUpStarted = useRef(false);

  // Время вышло: смена завершается один раз, пока сохраняется результат — задания закрыты оверлеем
  const handleTimeUp = useCallback(() => {
    if (timeUpStarted.current) return;
    timeUpStarted.current = true;
    setTimeUp(true);
    setShowFinishModal(false);
    setShowSkipModal(false);
    setRailOpen(false);
    onFinish('timeout');
  }, [onFinish]);
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
  const unlocked = getUnlockedTasks(questTasks, solved, state.skipped);
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
      if (isTimeExpired(error)) {
        handleTimeUp();
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
              {eventCode && <span>Мероприятие {eventCode}</span>}
            </div>
          </div>

          {deadline !== null && (
            <QuestTimer deadline={deadline} offsetMs={participant.clockOffsetMs ?? 0} onExpire={handleTimeUp} />
          )}

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
                  <span>{item.label}{state.skipped.includes(item.taskType) && !done ? ' · пропущено' : ''}</span>
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
            <a className="ghost-action leaderboard-link" href={leaderboardHref(eventCode)}><Trophy size={16} />Лидерборд</a>
            <button
              className="ghost-action"
              onClick={() => { setRailOpen(false); setShowFinishModal(true); }}
            >
              <LogOut size={16} />Завершить смену
            </button>
          </div>
        </div>
      </aside>

      {showSkipModal && task && (
        <ConfirmModal
          title="Пропустить задание?"
          confirmLabel="Пропустить"
          cancelLabel="Продолжить решение"
          onCancel={() => setShowSkipModal(false)}
          onConfirm={() => {
            session.skipTask(task.taskType);
            setShowSkipModal(false);
          }}
        >
          <p>За пропущенное задание баллы не начисляются. Вернуться к его решению нельзя. Вы получите информацию для продолжения сюжета.</p>
        </ConfirmModal>
      )}

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

      {timeUp && (
        <div className="reset-modal-backdrop time-up-backdrop">
          <div className="challenge-frame reset-modal" role="alertdialog" aria-modal="true" aria-labelledby="time-up-title">
            <div className="panel-title">
              <Hourglass size={16} />
              Лимит времени
            </div>
            <h2 id="time-up-title">Время смены вышло</h2>
            {finishError ? (
              <>
                <p className="submit-feedback is-error" role="alert">{finishError}</p>
                <button className="primary-action" disabled={finishPending} onClick={() => onFinish('timeout')}>
                  <RotateCcw size={16} />
                  Повторить
                </button>
              </>
            ) : (
              <p className="time-up-status">
                <Loader2 size={18} className="is-spinning" />
                Сохраняем результат...
              </p>
            )}
          </div>
        </div>
      )}

      <section className="stage">
        <QuestContentProtection participant={participant}>
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

            <div className="task-content">
            {state.skipped.includes(task.taskType) && !solved.includes(task.taskType) && (
              <p className="submit-feedback" role="status">Задание пропущено, баллы не начислены. Доступен только сюжетный итог.</p>
            )}
            {!solved.includes(task.taskType) && !state.skipped.includes(task.taskType) && (
              <div className="action-row task-skip-actions">
                <button className="ghost-action" disabled={pending || finishPending} onClick={() => setShowSkipModal(true)}>
                  Пропустить задание
                </button>
              </div>
            )}

            {showBriefing || state.skipped.includes(task.taskType) ? (
              <QuestStory
                task={task}
                participant={participant}
                personalizeText={questDefinition.personalize}
                isSolved={solved.includes(task.taskType)}
                isSkipped={state.skipped.includes(task.taskType)}
                isFinal={index === questTasks.length - 1}
                earned={points[task.taskType]}
                readStories={readStories}
                onRead={markStoryRead}
                onStart={() => session.setShowBriefing(false)}
                onNext={goNext}
                onFinish={() => solvedTasks.length === questTasks.length ? onFinish('completed') : setShowFinishModal(true)}
                finishPending={finishPending}
                storyLabel={questDefinition.key === 'orlov' ? 'Терминал расследования' : 'Терминал лаборатории'}
              />
            ) : (
              <ChallengeFrame
                task={task}
                solved={solved.includes(task.taskType)}
                attempts={attempts[task.taskType] ?? 0}
                onBrief={() => session.setShowBriefing(true)}
              >
                <task.component
                  key={task.taskType}
                  solved={solved.includes(task.taskType)}
                  submit={{ pending, feedback, onSubmit: submitAnswer }}
                />
              </ChallengeFrame>
            )}
            </div>
          </>
        )}
        </QuestContentProtection>
      </section>
    </main>
  );
}

function QuestStory({
  task,
  participant,
  personalizeText,
  isSolved,
  isSkipped,
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
  const resolved = isSolved || isSkipped;
  const storyKey = `${task.taskType}-${resolved ? 'outcome' : 'intro'}`;
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
        text={personalizeText(resolved ? task.outcome : task.intro, participant.firstName)}
        isSolved={resolved}
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
