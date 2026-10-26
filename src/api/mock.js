// Мок API для локальной разработки. В рабочей сборке модуль не подключается.
import { ApiError } from './client.js';

const DB_KEY = 'quest-mock-db-v3';
const LATENCY_MS = 180;

// Для быстрой проверки таймера лимит можно сократить: VITE_MOCK_TIME_LIMIT_SECONDS=90 в .env.mock.local
const MOCK_TIME_LIMIT_SECONDS = Number(import.meta.env.VITE_MOCK_TIME_LIMIT_SECONDS) || null;

// Мероприятия: код задаёт квест и рейтинг (docs/event-code.md)
const EVENTS = {
  6479: { code: '6479', title: 'Демо: Московский зоопарк', quest_key: 'zoo', is_active: true },
  1234: { code: '1234', title: 'Демо: расследование Орлова', quest_key: 'orlov', is_active: true },
  '0000': { code: '0000', title: 'Прошедшее мероприятие', quest_key: 'zoo', is_active: false },
};

const QUESTS = {
  zoo: {
    key: 'zoo', title: 'Код манула', brand_label: 'Московский зоопарк · лаборатория генетики',
    welcome_lead: 'Ночная смена в лаборатории генетики Московского зоопарка.',
    welcome_text: 'У манула родился детёныш, а база ДНК-паспортов дала сбой. Помогите восстановить данные до утра.',
    duration_text: '20–30 минут',
  },
  orlov: {
    key: 'orlov', title: 'Polytech Cyber Quest', brand_label: 'Polytech Cyber Quest · расследование 07',
    welcome_lead: 'Цифровое расследование: восстановите цепочку следов Орлова.',
    welcome_text: 'После запуска NOVA-17 инженер Орлов исчез из журнала. Проверьте SQL-записи, восстановите парсер логов, разберите подозрительное письмо, маршрут сигнала и историю Git.',
    duration_text: '20–30 минут',
  },
};

const TASKS = [
  { id: 1, quest_key: 'zoo', title: 'Замок вольера', task_type: 'binary', points: 10, order: 1, correct_answer: '101101' },
  { id: 2, quest_key: 'zoo', title: 'Вторая цепь', task_type: 'complement', points: 10, order: 2, correct_answer: 'TACGGC' },
  { id: 3, quest_key: 'zoo', title: 'Генетический код', task_type: 'codon', points: 15, order: 3, correct_answer: 'TIGER' },
  { id: 4, quest_key: 'zoo', title: 'Решётка Пеннета', task_type: 'probability', points: 15, order: 4, correct_answer: 'AA,Aa,Aa,aa|25' },
  { id: 5, quest_key: 'zoo', title: 'Кто отец?', task_type: 'paternity', points: 15, order: 5, correct_answer: '15,9,22,17|timofey' },
  { id: 6, quest_key: 'zoo', title: 'Поиск мутаций', task_type: 'mutation', points: 20, order: 6, correct_answer: 'range_len|neq|i_plus_1|diff|7,18,24' },
  { id: 7, quest_key: 'zoo', title: 'Сборка генома', task_type: 'assembly', points: 20, order: 7, correct_answer: 'C,F,A,E,B' },
  { id: 101, quest_key: 'orlov', title: 'След в журнале доступа', task_type: 'orlov_sql', points: 10, order: 1, correct_answer: "room, terminal|user_id = 'orlov'|ts DESC|1" },
  { id: 102, quest_key: 'orlov', title: 'Парсер логов', task_type: 'orlov_python', points: 15, order: 2, correct_answer: 'if "TRACE" in line:|line.split(\'code=\')[1]|\'-\'.join(parts)|NOVA-17' },
  { id: 103, quest_key: 'orlov', title: 'Подозрительное письмо', task_type: 'orlov_security', points: 15, order: 3, correct_answer: 'attachment,password_archive,sender_domain,unknown_ip,urgency|quarantine' },
  { id: 104, quest_key: 'orlov', title: 'Маршрут сигнала', task_type: 'orlov_network', points: 15, order: 4, correct_answer: 'ЛАБ-07>Коммутатор 2 этажа>Главный маршрутизатор>Защитный экран>AURORA' },
  { id: 105, quest_key: 'orlov', title: 'След в командной разработке', task_type: 'orlov_workflow', points: 20, order: 5, correct_answer: 'ticket,branch,commit,test,review,fix,merge|remove-secret' },
].map((task) => ({ ...task, is_active: true }));

const DEMO_PARTICIPANTS = [
  { first_name: 'Иван', last_name: 'Иванов', score: 80, solved: 6, attempts: 8, seconds: 1240, event_code: '6479' },
  { first_name: 'Анна', last_name: 'Петрова', score: 75, solved: 6, attempts: 9, seconds: 1310, event_code: '6479' },
  { first_name: 'Мария', last_name: 'Соколова', score: 55, solved: 4, attempts: 7, seconds: 980, event_code: '6479' },
  { first_name: 'Артём', last_name: 'Кузнецов', score: 35, solved: 3, attempts: 6, seconds: 760, event_code: '6479' },
  { first_name: 'Полина', last_name: 'Морозова', score: 10, solved: 1, attempts: 3, seconds: 420, event_code: '6479' },
  { first_name: 'Илья', last_name: 'Орлов', score: 60, solved: 4, attempts: 6, seconds: 1000, event_code: '1234' },
  { first_name: 'Елена', last_name: 'Соколова', score: 55, solved: 4, attempts: 5, seconds: 940, event_code: '1234' },
  { first_name: 'Ольга', last_name: 'Белова', score: 70, solved: 5, attempts: 6, seconds: 1500, event_code: '0000' },
];

function createDb() {
  const now = Date.now();
  return {
    participants: DEMO_PARTICIPANTS.map((demo, index) => ({
      id: `demo-${index + 1}`,
      first_name: demo.first_name,
      last_name: demo.last_name,
      token: `demo-token-${index + 1}`,
      event_code: demo.event_code,
      quest_key: EVENTS[demo.event_code].quest_key,
      started_at: new Date(now - demo.seconds * 1000).toISOString(),
      finished_at: new Date(now).toISOString(),
      finish_reason: 'completed',
      demo,
    })),
    attempts: [],
    task_results: [],
  };
}

function loadDb() {
  try {
    const saved = JSON.parse(localStorage.getItem(DB_KEY));
    if (saved && Array.isArray(saved.participants) && Array.isArray(saved.attempts)) return saved;
  } catch {
    // При повреждённом локальном состоянии создаётся новая база мока.
  }
  return createDb();
}

function saveDb(db) {
  localStorage.setItem(DB_KEY, JSON.stringify(db));
}

function randomId(length = 32) {
  const bytes = new Uint8Array(length / 2);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function publicQuestConfig(key) {
  const quest = QUESTS[key];
  const taskCount = TASKS.filter((task) => task.quest_key === key && task.is_active).length;
  return { ...quest, task_count: taskCount, time_limit_seconds: timeLimit(key) };
}

// Лимит времени смены хранится у квеста: зоопарк — 40 минут, Орлов — 30
function timeLimit(questKey) {
  return MOCK_TIME_LIMIT_SECONDS ?? (questKey === 'orlov' ? 30 * 60 : 40 * 60);
}

// После дедлайна сервер не принимает ответы (docs/quest-timer.md)
function requireTimeLeft(participant) {
  if (participant.deadline_at && Date.now() > Date.parse(participant.deadline_at)) {
    const detail = 'Время смены истекло.';
    throw new ApiError(detail, { status: 409, data: { detail, code: 'time_expired' } });
  }
}

// Мероприятие по коду; для регистрации оно должно быть открыто
function findEvent(code, { requireActive = false } = {}) {
  const event = EVENTS[String(code ?? '')];
  if (!event) {
    throw new ApiError('Мероприятие не найдено.', { status: 404, data: { detail: 'Мероприятие не найдено.' } });
  }
  if (requireActive && !event.is_active) {
    const detail = 'Мероприятие завершено. Регистрация закрыта.';
    throw new ApiError(detail, { status: 403, data: { detail } });
  }
  return event;
}

function publicEvent(event) {
  return { code: event.code, title: event.title, is_active: event.is_active, quest: publicQuestConfig(event.quest_key) };
}

function requireParticipant(db, token) {
  const participant = db.participants.find((item) => item.token === token);
  if (!token || !participant) {
    throw new ApiError('Недопустимый токен.', { status: 401, data: { detail: 'Недопустимый токен.' } });
  }
  return participant;
}

function registerParticipant(db, body) {
  const firstName = String(body?.first_name ?? '').trim();
  const lastName = String(body?.last_name ?? '').trim();
  const errors = {};
  if (!firstName) errors.first_name = ['Обязательное поле.'];
  if (!lastName) errors.last_name = ['Обязательное поле.'];
  if (firstName.length > 50) errors.first_name = ['Не более 50 символов.'];
  if (lastName.length > 50) errors.last_name = ['Не более 50 символов.'];
  if (Object.keys(errors).length > 0) throw new ApiError('Проверьте имя и фамилию', { status: 400, data: errors });
  const event = findEvent(body?.event_code, { requireActive: true });

  const now = new Date().toISOString();
  const participant = {
    id: `${randomId(8)}-${randomId(4)}-${randomId(4)}-${randomId(4)}-${randomId(12)}`,
    first_name: firstName,
    last_name: lastName,
    token: randomId(40),
    event_code: event.code,
    quest_key: event.quest_key,
    started_at: now,
    deadline_at: new Date(Date.parse(now) + timeLimit(event.quest_key) * 1000).toISOString(),
    finished_at: null,
    finish_reason: null,
  };
  db.participants.push(participant);
  return {
    participant_id: participant.id,
    first_name: participant.first_name,
    last_name: participant.last_name,
    token: participant.token,
    started_at: participant.started_at,
    deadline_at: participant.deadline_at,
    server_time: new Date().toISOString(),
    event_code: participant.event_code,
    quest: publicQuestConfig(participant.quest_key),
  };
}

function listTasks(participant) {
  if (participant.finished_at) throw new ApiError('Смена уже завершена.', { status: 409, data: { detail: 'Смена уже завершена.' } });
  return TASKS.filter((task) => task.quest_key === participant.quest_key && task.is_active).map(({ id, title, task_type, points, order }) => ({ id, title, task_type, points, order }));
}

function submitAttempt(db, participant, taskId, body) {
  const task = TASKS.find((item) => item.id === taskId && item.quest_key === participant.quest_key && item.is_active);
  if (!task) throw new ApiError('Задание не найдено в текущем квесте.', { status: 404, data: { detail: 'Задание не найдено в текущем квесте.' } });
  if (participant.finished_at) throw new ApiError('Смена уже завершена.', { status: 409, data: { detail: 'Смена уже завершена.' } });
  requireTimeLeft(participant);

  const answer = String(body?.answer ?? '');
  const result = db.task_results.find((item) => item.participant_id === participant.id && item.task_id === task.id);
  if (result) return { correct: true, points_earned: result.points_earned, attempts_count: result.attempts_count };

  const attemptNumber = db.attempts.filter((item) => item.participant_id === participant.id && item.task_id === task.id).length + 1;
  const isCorrect = answer === task.correct_answer;
  const now = new Date().toISOString();
  db.attempts.push({ participant_id: participant.id, task_id: task.id, answer, is_correct: isCorrect, attempt_number: attemptNumber, created_at: now });

  if (isCorrect) {
    db.task_results.push({ participant_id: participant.id, task_id: task.id, points_earned: task.points, attempts_count: attemptNumber, completed_at: now });
    const activeCount = TASKS.filter((item) => item.quest_key === participant.quest_key && item.is_active).length;
    const solvedCount = db.task_results.filter((item) => item.participant_id === participant.id).length;
    if (activeCount > 0 && solvedCount === activeCount) {
      participant.finished_at = now;
      participant.finish_reason = 'completed';
    }
  }
  return { correct: isCorrect, points_earned: isCorrect ? task.points : 0, attempts_count: attemptNumber };
}

function finishParticipant(db, participant, body) {
  if (!participant.finished_at && body?.reason === 'completed') {
    const activeCount = TASKS.filter((item) => item.quest_key === participant.quest_key && item.is_active).length;
    const solvedCount = db.task_results.filter((item) => item.participant_id === participant.id).length;
    if (activeCount === 0 || solvedCount !== activeCount) {
      throw new ApiError('Нельзя отметить квест полностью пройденным, пока не решены все активные задания.', {
        status: 400,
        data: { reason: ['Не решены все активные задания.'] },
      });
    }
  }
  if (!participant.finished_at) {
    participant.finished_at = new Date().toISOString();
    participant.finish_reason = ['completed', 'timeout'].includes(body?.reason) ? body.reason : 'gave_up';
  }
  const results = db.task_results.filter((item) => item.participant_id === participant.id);
  const score = results.reduce((sum, item) => sum + item.points_earned, 0);
  const attempts = results.reduce((sum, item) => sum + item.attempts_count, 0);
  return {
    participant_id: participant.id,
    quest_key: participant.quest_key,
    total_tasks: TASKS.filter((item) => item.quest_key === participant.quest_key && item.is_active).length,
    finished_at: participant.finished_at,
    finish_reason: participant.finish_reason,
    score,
    solved_tasks: results.length,
    attempts_count: attempts,
    time_seconds: elapsedSeconds(participant),
  };
}

// Время смены для итогов и рейтинга: не больше лимита квеста
function elapsedSeconds(participant) {
  const seconds = Math.floor((Date.parse(participant.finished_at) - Date.parse(participant.started_at)) / 1000);
  return Math.min(Math.max(0, seconds), timeLimit(participant.quest_key));
}

function buildRanking(db, eventCode) {
  const event = findEvent(eventCode);
  return db.participants.filter((participant) => participant.event_code === event.code && participant.finished_at).map((participant) => {
    const results = db.task_results.filter((item) => item.participant_id === participant.id);
    const demo = participant.demo;
    return {
      first_name: participant.first_name,
      last_name: participant.last_name,
      score: demo?.score ?? results.reduce((sum, item) => sum + item.points_earned, 0),
      solved_tasks: demo?.solved ?? results.length,
      attempts_count: demo?.attempts ?? results.reduce((sum, item) => sum + item.attempts_count, 0),
      time_seconds: demo?.seconds ?? elapsedSeconds(participant),
    };
  }).sort((a, b) => b.score - a.score || b.solved_tasks - a.solved_tasks || a.attempts_count - b.attempts_count || a.time_seconds - b.time_seconds)
    .map((row, index) => ({ place: index + 1, ...row }));
}

const routes = [
  { method: 'GET', pattern: /^\/events\/(\d+)\/$/, handle: ({ match }) => publicEvent(findEvent(match[1])) },
  { method: 'GET', pattern: /^\/events\/(\d+)\/ranking\/$/, handle: ({ db, match }) => buildRanking(db, match[1]) },
  { method: 'POST', pattern: /^\/participants\/$/, handle: ({ db, body }) => registerParticipant(db, body) },
  { method: 'POST', pattern: /^\/participants\/finish\/$/, handle: ({ db, token, body }) => finishParticipant(db, requireParticipant(db, token), body) },
  { method: 'GET', pattern: /^\/tasks\/$/, handle: ({ db, token }) => listTasks(requireParticipant(db, token)) },
  { method: 'POST', pattern: /^\/tasks\/(\d+)\/attempts\/$/, handle: ({ db, token, body, match }) => submitAttempt(db, requireParticipant(db, token), Number(match[1]), body) },
  { method: 'GET', pattern: /^\/health\/$/, handle: () => ({ status: 'ok', database: 'ok' }) },
];

export async function mockRequest(path, { method = 'GET', token, body, signal } = {}) {
  await new Promise((resolve) => window.setTimeout(resolve, LATENCY_MS));
  if (signal?.aborted) throw new DOMException('Запрос отменён', 'AbortError');
  const route = routes.find((item) => item.method === method && item.pattern.test(path));
  if (!route) throw new ApiError(`Мок: нет обработчика для ${method} ${path}`, { status: 404 });
  const db = loadDb();
  const result = route.handle({ db, token, body, match: path.match(route.pattern) });
  saveDb(db);
  return JSON.parse(JSON.stringify(result));
}
