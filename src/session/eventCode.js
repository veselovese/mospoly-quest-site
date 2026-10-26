// Код мероприятия: определяет квест и общий рейтинг. Выбранное мероприятие помнится на устройстве,
// чтобы после перезагрузки не вводить код заново. Токены здесь не хранятся.

const EVENT_STORAGE_KEY = 'quest-event:v1';

export const EVENT_CODE_MIN_LENGTH = 4;
export const EVENT_CODE_MAX_LENGTH = 8;

// Оставляет только цифры: « 64-79 » → «6479»
export function normalizeEventCode(value) {
  return String(value ?? '').replace(/\D/g, '').slice(0, EVENT_CODE_MAX_LENGTH);
}

export function isValidEventCode(code) {
  return typeof code === 'string'
    && new RegExp(`^\\d{${EVENT_CODE_MIN_LENGTH},${EVENT_CODE_MAX_LENGTH}}$`).test(code);
}

// Мероприятие на фронте: { code, title, quest }, где quest — публичная конфигурация квеста с сервера
export function isValidEvent(value) {
  return Boolean(value && isValidEventCode(value.code) && typeof value.quest?.key === 'string');
}

export function readEvent() {
  try {
    const saved = JSON.parse(localStorage.getItem(EVENT_STORAGE_KEY));
    return isValidEvent(saved) ? saved : null;
  } catch {
    return null;
  }
}

export function rememberEvent(event) {
  if (!isValidEvent(event)) return;
  try {
    localStorage.setItem(
      EVENT_STORAGE_KEY,
      JSON.stringify({ code: event.code, title: event.title ?? '', quest: event.quest }),
    );
  } catch {
    // Без localStorage мероприятие придётся выбрать заново после перезагрузки.
  }
}

export function forgetEvent() {
  try {
    localStorage.removeItem(EVENT_STORAGE_KEY);
  } catch {
    // нечего удалять
  }
}

export const EVENT_CLOSED_MESSAGE = 'Мероприятие завершено, регистрация закрыта. Рейтинг доступен на лидерборде.';

// Текст ошибки проверки кода для участника
export function eventErrorMessage(error) {
  if (error?.status === 404) return 'Мероприятие с таким кодом не найдено. Проверьте код у организатора.';
  if (error?.status === 403 || error?.status === 410) return error.message || EVENT_CLOSED_MESSAGE;
  if (error?.status === 0) return 'Нет связи с сервером. Проверьте интернет и попробуйте ещё раз.';
  return `Не удалось проверить код: ${error?.message ?? 'неизвестная ошибка'}`;
}

// Ссылка на рейтинг мероприятия: /leaderboard?id=6479&me=Имя+Фамилия
export function leaderboardHref(code, name = '') {
  const params = new URLSearchParams();
  if (code) params.set('id', code);
  if (name) params.set('me', name);
  const query = params.toString();
  return `/leaderboard${query ? `?${query}` : ''}`;
}
