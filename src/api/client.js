// Клиент API бэкенда квеста. Контракт описан в документе «Backend (1)» (ссылка в CLAUDE.md)

// Базовый адрес API: по умолчанию тот же домен (/api), для разработки можно задать VITE_API_URL
const API_URL = (import.meta.env.VITE_API_URL || '/api').replace(/\/+$/, '');

// Режим без бэкенда: запросы обрабатывает мок в localStorage (npm run dev:mock)
const USE_MOCK = import.meta.env.VITE_API_MOCK === 'true';

export class ApiError extends Error {
  constructor(message, { status = 0, data = null } = {}) {
    super(message);
    this.name = 'ApiError';
    // 0 — сервер недоступен, иначе HTTP-статус ответа
    this.status = status;
    this.data = data;
  }
}

// Выполняет запрос к API и возвращает разобранный JSON
export async function request(path, { method = 'GET', token, body, signal } = {}) {
  if (USE_MOCK) {
    const { mockRequest } = await import('./mock.js');
    return mockRequest(path, { method, token, body, signal });
  }

  const headers = { Accept: 'application/json' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = `Token ${token}`;

  let response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal,
    });
  } catch (error) {
    if (error.name === 'AbortError') throw error;
    throw new ApiError('Нет связи с сервером');
  }

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    throw new ApiError(data?.detail || `Ошибка сервера (${response.status})`, {
      status: response.status,
      data,
    });
  }

  if (data === null) {
    throw new ApiError('Сервер вернул ответ не в формате JSON', { status: response.status });
  }

  return data;
}

// Мероприятие по коду: название и квест, который организатор закрепил за кодом в админке.
// Возвращает { code, title, quest, isActive }; 404 — кода нет. Закрытое мероприятие (is_active: false)
// отдаётся, чтобы был доступен его рейтинг, но регистрация на нём отклоняется (см. docs/event-code.md)
export async function getEvent(code, { signal } = {}) {
  const data = await request(`/events/${encodeURIComponent(code)}/`, { signal });
  if (typeof data?.quest?.key !== 'string') {
    throw new ApiError('Сервер не вернул квест мероприятия', { status: 500, data });
  }
  return {
    code: String(data.code ?? code),
    title: data.title ?? '',
    quest: data.quest,
    isActive: data.is_active !== false,
  };
}

// Регистрация участника на мероприятии: квест берётся из мероприятия.
export function registerParticipant({ firstName, lastName, eventCode }) {
  return request('/participants/', {
    method: 'POST',
    body: { first_name: firstName, last_name: lastName, event_code: eventCode },
  });
}

// Активные задания участника (без правильных ответов)
export function getTasks(token) {
  return request('/tasks/', { token });
}

// Отправка ответа: бэкенд проверяет его, сохраняет попытку и начисляет баллы
export function submitAttempt(token, taskId, answer) {
  return request(`/tasks/${taskId}/attempts/`, {
    method: 'POST',
    token,
    body: { answer },
  });
}

// Фиксация полного или досрочного завершения на сервере.
export function finishParticipant(token, reason) {
  return request('/participants/finish/', {
    method: 'POST',
    token,
    body: { reason },
  });
}

// Рейтинг мероприятия, доступен без авторизации
export function getEventRanking(code, { signal } = {}) {
  return request(`/events/${encodeURIComponent(code)}/ranking/`, { signal });
}
