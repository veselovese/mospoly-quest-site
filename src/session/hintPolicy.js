// Принимаем только явно объявленную сервером политику, без локальной догадки о штрафе.
export function normalizeHintPolicy(value) {
  if (!value || !Number.isInteger(value.points_per_hint) || value.points_per_hint <= 0
    || !Number.isInteger(value.max_hints) || value.max_hints < 1) return null;
  return { pointsPerHint: value.points_per_hint, maxHints: value.max_hints };
}

export function parseHintReceipt(value, taskPoints, maxHints) {
  if (!value || !Number.isInteger(value.hints_used) || value.hints_used < 0 || value.hints_used > maxHints
    || !Number.isInteger(value.available_points) || value.available_points < 0 || value.available_points > taskPoints) {
    throw new Error('Сервер не подтвердил использование подсказки.');
  }
  return { used: value.hints_used, availablePoints: value.available_points };
}
