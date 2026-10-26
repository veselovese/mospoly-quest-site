// Лимит времени смены (docs/quest-timer.md): хранится на бэке у квеста, дедлайн считается от начала смены.
// Фронтенд показывает обратный отсчёт и завершает смену, когда время вышло.

// За сколько секунд до конца таймер начинает предупреждать
export const WARNING_SECONDS = 5 * 60;
export const CRITICAL_SECONDS = 60;

// Лимит квеста в секундах: с сервера (quest.time_limit_seconds), иначе запасной из questRegistry
export function resolveTimeLimit(quest, fallbackSeconds = null) {
  const seconds = Number(quest?.time_limit_seconds);
  if (Number.isFinite(seconds) && seconds > 0) return seconds;
  return Number.isFinite(fallbackSeconds) && fallbackSeconds > 0 ? fallbackSeconds : null;
}

// Дедлайн смены в мс: deadline_at с сервера, иначе started_at + лимит; null — без ограничения
export function resolveDeadline(participant, limitSeconds) {
  const fromServer = Date.parse(participant?.deadlineAt ?? '');
  if (Number.isFinite(fromServer)) return fromServer;

  const startedAt = Date.parse(participant?.startedAt ?? '');
  if (Number.isFinite(startedAt) && limitSeconds > 0) return startedAt + limitSeconds * 1000;
  return null;
}

// Поправка часов устройства по server_time из ответа сервера: насколько часы сервера впереди
export function clockOffset(serverTime, receivedAt = Date.now()) {
  const server = Date.parse(serverTime ?? '');
  return Number.isFinite(server) ? server - receivedAt : 0;
}

// Сколько секунд осталось по часам сервера; null — без ограничения
export function remainingSeconds(deadline, offsetMs = 0, now = Date.now()) {
  if (deadline === null || deadline === undefined) return null;
  return Math.max(0, Math.ceil((deadline - (now + offsetMs)) / 1000));
}

export function timerLevel(seconds) {
  if (seconds === null) return 'none';
  if (seconds <= CRITICAL_SECONDS) return 'critical';
  if (seconds <= WARNING_SECONDS) return 'warning';
  return 'normal';
}

// Сервер отклонил действие, потому что время смены вышло
export function isTimeExpired(error) {
  return error?.status === 409 && error?.data?.code === 'time_expired';
}
