// Локальный барьер повторного участия. Серверная идентификация нужна отдельно.
const PREFIX = 'quest-completion:v1:';
const memory = new Map();

export function isCompletionStorageKey(key) {
  return key === null || key?.startsWith(PREFIX);
}

function validSummary(value, questKey) {
  return typeof questKey === 'string' && questKey.length > 0 && value?.questKey === questKey
    && typeof value.firstName === 'string' && typeof value.lastName === 'string'
    && ['completed', 'gave_up'].includes(value.finishReason)
    && ['score', 'solvedCount', 'totalTasks', 'attemptsCount', 'durationSeconds']
      .every((key) => Number.isFinite(value[key]) && value[key] >= 0);
}

export function readCompletion(questKey) {
  try {
    const saved = JSON.parse(localStorage.getItem(`${PREFIX}${questKey}`));
    if (validSummary(saved, questKey)) {
      memory.set(questKey, saved);
      return saved;
    }
  } catch {
    // При недоступном хранилище барьер действует до закрытия вкладки.
  }
  return memory.get(questKey) ?? null;
}

export function rememberCompletion(summary) {
  if (!validSummary(summary, summary?.questKey)) return;
  // Сохраняем только итоги, без токена и без полей сессии.
  const saved = Object.fromEntries([
    'firstName', 'lastName', 'questKey', 'score', 'solvedCount', 'totalTasks',
    'attemptsCount', 'durationSeconds', 'finishReason', 'finishedAt',
  ].map((key) => [key, summary[key]]));
  memory.set(saved.questKey, saved);
  try {
    localStorage.setItem(`${PREFIX}${saved.questKey}`, JSON.stringify(saved));
  } catch {
    // Итог остаётся в памяти и не мешает показать успешное завершение.
  }
}
