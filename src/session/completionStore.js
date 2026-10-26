// Локальный барьер повторного участия. Серверная идентификация нужна отдельно.
// Барьер ставится на пару «квест + мероприятие»: на новом мероприятии с того же устройства участвовать можно.
const PREFIX = 'quest-completion:v1:';
const memory = new Map();

export function isCompletionStorageKey(key) {
  return key === null || key?.startsWith(PREFIX);
}

// quest-completion:v1:zoo@6479; без кода мероприятия — прежний ключ quest-completion:v1:zoo
function storageKey(questKey, eventCode) {
  return `${PREFIX}${eventCode ? `${questKey}@${eventCode}` : questKey}`;
}

function validSummary(value, questKey, eventCode) {
  return typeof questKey === 'string' && questKey.length > 0 && value?.questKey === questKey
    && (value.eventCode ?? null) === (eventCode ?? null)
    && typeof value.firstName === 'string' && typeof value.lastName === 'string'
    && ['completed', 'gave_up', 'timeout'].includes(value.finishReason)
    && ['score', 'solvedCount', 'totalTasks', 'attemptsCount', 'durationSeconds']
      .every((key) => Number.isFinite(value[key]) && value[key] >= 0);
}

export function readCompletion(questKey, eventCode = null) {
  const key = storageKey(questKey, eventCode);
  try {
    const saved = JSON.parse(localStorage.getItem(key));
    if (validSummary(saved, questKey, eventCode)) {
      memory.set(key, saved);
      return saved;
    }
  } catch {
    // При недоступном хранилище барьер действует до закрытия вкладки.
  }
  return memory.get(key) ?? null;
}

export function rememberCompletion(summary) {
  const eventCode = summary?.eventCode ?? null;
  if (!validSummary(summary, summary?.questKey, eventCode)) return;
  // Сохраняем только итоги, без токена и без полей сессии.
  const saved = Object.fromEntries([
    'firstName', 'lastName', 'questKey', 'eventCode', 'score', 'solvedCount', 'totalTasks',
    'attemptsCount', 'durationSeconds', 'finishReason', 'finishedAt',
  ].map((key) => [key, summary[key] ?? null]));
  const key = storageKey(saved.questKey, eventCode);
  memory.set(key, saved);
  try {
    localStorage.setItem(key, JSON.stringify(saved));
  } catch {
    // Итог остаётся в памяти и не мешает показать успешное завершение.
  }
}
