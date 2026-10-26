import { skipTaskState } from './taskNavigation.js';
import { ApiError, finishParticipant, getTasks, registerParticipant, submitAttempt } from '../api/client';
import { clockOffset } from './questTimer';
import { readCompletion, rememberCompletion } from './completionStore';

// Ключ, под которым сессия хранится в localStorage
const STORAGE_KEY = 'zoo-quest-session';

// Ключ прогресса прежнего квеста Орлова — к квесту зоопарка не относится и удаляется
const LEGACY_PROGRESS_KEY = 'polytech-cyber-quest-progress';

// Версия формата: при несовместимых изменениях полей старые сессии сбрасываются
const SESSION_VERSION = 2;

// Поля сессии и их начальные значения
function createInitialState() {
  return {
    // Участник от POST /api/participants/: { id, firstName, lastName, token, startedAt, quest, event,
    // deadlineAt, clockOffsetMs }, где event — мероприятие { code, title }, deadlineAt — конец смены
    // по часам сервера, clockOffsetMs — насколько часы сервера впереди часов устройства
    participant: null,
    // Задания от GET /api/tasks/, отсортированные по order: [{ id, title, taskType, points, order }]
    tasks: [],
    // new — участник не зарегистрирован, active — квест идёт, finished — квест завершён
    status: 'new',
    // Индекс текущего задания
    active: 0,
    // Ключи решённых заданий
    solved: [],
    // Необратимо пропущенные задания: доступны только сюжетные итоги.
    skipped: [],
    // Число попыток по заданиям: { [ключ]: число }
    attempts: {},
    // Начисленные баллы по заданиям: { [ключ]: баллы }
    points: {},
    // Показывается ли брифинг текущего задания
    showBriefing: true,
    // Брифинги, текст которых уже напечатан
    readStories: [],
    // Когда и почему квест завершён: completed — пройден до конца, gave_up — участник сдался,
    // timeout — вышло время смены
    finishedAt: null,
    finishReason: null,
    finishSummary: null,
  };
}

// Сессия участника: хранит прогресс в localStorage, восстанавливает его и общается с бэкендом.
// Изменения публикуются подписчикам (см. useQuestSession), снимок состояния неизменяемый.
export class QuestSession {
  #state = createInitialState();
  #listeners = new Set();

  // Загружает сохранённую сессию или создаёт новую
  static load() {
    const session = new QuestSession();
    session.#state = readStoredState() ?? createInitialState();
    if (session.#state.status === 'finished') rememberCompletion(session.getSummary());
    removeLegacyProgress();
    return session;
  }

  // Текущее состояние для React (useSyncExternalStore): новый объект после каждого изменения
  getSnapshot = () => this.#state;

  subscribe = (listener) => {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  };

  get state() {
    return this.#state;
  }

  get isRegistered() {
    return this.#state.participant !== null;
  }

  // Задание по ключу (task_type); если задания ещё не загружены — undefined
  getTask(taskKey) {
    return this.#state.tasks.find((task) => task.taskType === taskKey);
  }

  // Сохраняет состояние в localStorage; без localStorage сессия продолжает работать в памяти
  save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: SESSION_VERSION, ...this.#state }));
    } catch {
      // приватный режим или переполненное хранилище
    }
  }

  // Удаляет сохранённую сессию и возвращает начальное состояние
  clear() {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // нечего удалять
    }

    this.#replace(createInitialState(), { persist: false });
  }

  // Регистрирует участника на мероприятии и начинает новую сессию. event — { code, title, quest }
  async register(firstName, lastName, event) {
    if (this.#state.status !== 'new' || readCompletion(event.quest.key, event.code)) {
      throw new ApiError('На этом устройстве смена уже начата или завершена.', { status: 409 });
    }
    const response = await registerParticipant({
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      eventCode: event.code,
    });
    const receivedAt = Date.now();

    this.#replace({
      ...createInitialState(),
      status: 'active',
      participant: {
        id: response.participant_id,
        firstName: response.first_name,
        lastName: response.last_name,
        token: response.token,
        startedAt: response.started_at,
        quest: response.quest ?? event.quest,
        event: { code: String(response.event_code ?? event.code), title: event.title ?? '' },
        deadlineAt: response.deadline_at ?? null,
        clockOffsetMs: clockOffset(response.server_time, receivedAt),
      },
    });
  }

  // Загружает активные задания участника
  async loadTasks() {
    this.#requireParticipant();
    const response = await getTasks(this.#state.participant.token);

    const tasks = (Array.isArray(response) ? response : [])
      .map((task) => ({
        id: task.id,
        title: task.title,
        taskType: task.task_type,
        points: task.points,
        order: task.order,
      }))
      .sort((a, b) => a.order - b.order);

    this.#update({ tasks });
    return tasks;
  }

  // Отправляет ответ на проверку. Возвращает { correct, pointsEarned, attemptsCount }
  async submitAnswer(taskKey, answer) {
    this.#requireParticipant();
    if (this.#state.skipped.includes(taskKey)) {
      throw new ApiError('Пропущенное задание недоступно для решения.', { status: 409 });
    }
    const task = this.getTask(taskKey);

    if (!task) {
      throw new ApiError(`Задание «${taskKey}» не найдено среди активных`, { status: 404 });
    }

    const response = await submitAttempt(this.#state.participant.token, task.id, answer);
    const result = {
      correct: Boolean(response.correct),
      pointsEarned: Number(response.points_earned) || 0,
      attemptsCount: Number(response.attempts_count) || 0,
    };

    const { attempts, points, solved } = this.#state;
    this.#update({
      attempts: { ...attempts, [taskKey]: result.attemptsCount },
      ...(result.correct && {
        solved: solved.includes(taskKey) ? solved : [...solved, taskKey],
        points: { ...points, [taskKey]: result.pointsEarned },
      }),
    });

    return result;
  }

  // Завершает квест на сервере; при ошибке сессия остаётся сохранённой для повтора.
  async finish(reason) {
    if (this.#state.status === 'finished') return this.getSummary();
    this.#requireParticipant();
    let response;
    try {
      response = await finishParticipant(this.#state.participant.token, reason);
    } catch (error) {
      // Пока бэкенд не знает причину timeout, время вышедшей смены фиксируется как досрочное завершение
      if (reason !== 'timeout' || error.status !== 400) throw error;
      response = await finishParticipant(this.#state.participant.token, 'gave_up');
    }
    const finishSummary = {
      score: Number(response.score) || 0,
      solvedCount: Number(response.solved_tasks) || 0,
      totalTasks: Number(response.total_tasks) || this.#state.tasks.length,
      attemptsCount: Number(response.attempts_count) || 0,
      durationSeconds: Number(response.time_seconds) || 0,
      finishReason: reason === 'timeout' ? 'timeout' : response.finish_reason ?? reason,
      finishedAt: response.finished_at,
      questKey: response.quest_key ?? this.#state.participant?.quest?.key ?? 'zoo',
      eventCode: this.#state.participant?.event?.code ?? null,
    };
    rememberCompletion({ ...this.getSummary(), ...finishSummary });
    this.#update({
      status: 'finished',
      finishReason: finishSummary.finishReason,
      finishedAt: finishSummary.finishedAt,
      finishSummary,
    });
    return this.getSummary();
  }

  // Итоги берутся с сервера после завершения; до этого показывается локальный расчёт.
  getSummary() {
    const { participant, tasks, solved, attempts, points, finishedAt, finishReason, finishSummary } = this.#state;
    const end = finishedAt ? Date.parse(finishedAt) : Date.now();
    const start = participant?.startedAt ? Date.parse(participant.startedAt) : end;
    const localSummary = {
      score: solved.reduce((sum, key) => sum + (points[key] ?? 0), 0),
      solvedCount: solved.length,
      totalTasks: tasks.length,
      attemptsCount: solved.reduce((sum, key) => sum + (attempts[key] ?? 0), 0),
      durationSeconds: Math.max(0, Math.round((end - start) / 1000)),
      finishReason,
    };

    return {
      firstName: participant?.firstName ?? '',
      lastName: participant?.lastName ?? '',
      ...localSummary,
      ...(finishSummary ?? {}),
      questKey: finishSummary?.questKey ?? participant?.quest?.key ?? 'zoo',
      eventCode: participant?.event?.code ?? null,
      finishReason: finishSummary?.finishReason ?? finishReason,
    };
  }

  // Пропуск не создаёт успешную попытку и не начисляет баллы.
  skipTask(taskKey) {
    this.#requireParticipant();
    this.#update(skipTaskState(this.#state, taskKey));
  }

  // Состояние интерфейса квеста

  setActive(active) {
    this.#update({ active });
  }

  setShowBriefing(showBriefing) {
    this.#update({ showBriefing });
  }

  markStoryRead(storyKey) {
    const { readStories } = this.#state;
    if (!readStories.includes(storyKey)) {
      this.#update({ readStories: [...readStories, storyKey] });
    }
  }

  #requireParticipant() {
    if (!this.#state.participant) {
      throw new ApiError('Участник не зарегистрирован', { status: 401 });
    }
    const { quest, event } = this.#state.participant;
    if (readCompletion(quest?.key ?? 'zoo', event?.code ?? null)) {
      throw new ApiError('Смена уже завершена.', { status: 409 });
    }
  }

  #update(patch) {
    this.#replace({ ...this.#state, ...patch });
  }

  #replace(state, { persist = true } = {}) {
    this.#state = state;
    if (persist) this.save();
    this.#listeners.forEach((listener) => listener());
  }
}

// Читает сессию из localStorage и восстанавливает только корректные значения
function readStoredState() {
  let saved;
  try {
    saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
  } catch {
    return null;
  }

  if (!saved || saved.version !== SESSION_VERSION) return null;

  const initial = createInitialState();
  const participant = isValidParticipant(saved.participant) ? saved.participant : null;

  return {
    participant,
    tasks: Array.isArray(saved.tasks) ? saved.tasks.filter((task) => task && Number.isFinite(task.id)) : [],
    status: participant && ['active', 'finished'].includes(saved.status) ? saved.status : initial.status,
    active: Number.isInteger(saved.active) && saved.active >= 0 ? saved.active : initial.active,
    solved: isStringArray(saved.solved) ? saved.solved : initial.solved,
    skipped: isStringArray(saved.skipped) ? saved.skipped : initial.skipped,
    attempts: isNumberMap(saved.attempts) ? saved.attempts : initial.attempts,
    points: isNumberMap(saved.points) ? saved.points : initial.points,
    showBriefing: typeof saved.showBriefing === 'boolean' ? saved.showBriefing : initial.showBriefing,
    readStories: isStringArray(saved.readStories) ? saved.readStories : initial.readStories,
    finishedAt: typeof saved.finishedAt === 'string' ? saved.finishedAt : null,
    finishReason: ['completed', 'gave_up', 'timeout'].includes(saved.finishReason) ? saved.finishReason : null,
    finishSummary: isValidFinishSummary(saved.finishSummary) ? saved.finishSummary : null,
  };
}

function removeLegacyProgress() {
  try {
    localStorage.removeItem(LEGACY_PROGRESS_KEY);
  } catch {
    // нечего удалять
  }
}

function isValidParticipant(value) {
  return Boolean(value && typeof value.token === 'string' && value.token && typeof value.firstName === 'string');
}

function isValidFinishSummary(value) {
  return Boolean(
    value &&
    Number.isFinite(value.score) &&
    Number.isFinite(value.solvedCount) &&
    Number.isFinite(value.totalTasks) &&
    Number.isFinite(value.attemptsCount) &&
    Number.isFinite(value.durationSeconds),
  );
}

function isStringArray(value) {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

function isNumberMap(value) {
  return Boolean(value) && typeof value === 'object' && Object.values(value).every(Number.isFinite);
}
