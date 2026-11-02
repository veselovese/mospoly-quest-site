import test from 'node:test';
import assert from 'node:assert/strict';
import {
  eventErrorMessage,
  forgetEvent,
  isValidEventCode,
  leaderboardHref,
  normalizeEventCode,
  readEvent,
  rememberEvent,
} from '../src/session/eventCode.js';

function useMemoryStorage() {
  const data = new Map();
  globalThis.localStorage = {
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => data.set(key, value),
    removeItem: (key) => data.delete(key),
  };
  return data;
}

test('код мероприятия — только цифры, от 4 до 8 знаков', () => {
  assert.equal(normalizeEventCode(' 64-79 '), '6479');
  assert.equal(normalizeEventCode('12345678901'), '12345678');
  assert.equal(normalizeEventCode(null), '');
  assert.equal(isValidEventCode('6479'), true);
  assert.equal(isValidEventCode('12345678'), true);
  assert.equal(isValidEventCode('123'), false);
  assert.equal(isValidEventCode('64a9'), false);
  assert.equal(isValidEventCode(6479), false);
});

test('выбранное мероприятие помнится без лишних полей и сбрасывается', () => {
  const data = useMemoryStorage();
  rememberEvent({ code: '6479', title: 'Демо', quest: { key: 'zoo', title: 'Код манула' }, token: 'secret' });
  assert.deepEqual(readEvent(), { code: '6479', title: 'Демо', quest: { key: 'zoo', title: 'Код манула' } });
  assert.equal(JSON.parse(data.get('quest-event:v1')).token, undefined);

  rememberEvent({ code: '12', quest: { key: 'zoo' } });
  assert.equal(readEvent().code, '6479', 'некорректное мероприятие не перезаписывает сохранённое');

  forgetEvent();
  assert.equal(readEvent(), null);
});

test('повреждённое сохранение не ломает чтение', () => {
  const data = useMemoryStorage();
  data.set('quest-event:v1', '{не json');
  assert.equal(readEvent(), null);
  data.set('quest-event:v1', JSON.stringify({ code: '6479' }));
  assert.equal(readEvent(), null, 'без квеста мероприятие не принимается');
});

test('ссылка на рейтинг мероприятия и тексты ошибок', () => {
  assert.equal(leaderboardHref('6479'), '/leaderboard?id=6479');
  assert.equal(leaderboardHref('6479', 'Иван Иванов'), '/leaderboard?id=6479&me=%D0%98%D0%B2%D0%B0%D0%BD+%D0%98%D0%B2%D0%B0%D0%BD%D0%BE%D0%B2');
  assert.equal(leaderboardHref(null), '/leaderboard');
  assert.match(eventErrorMessage({ status: 404 }), /не найдено/);
  assert.match(eventErrorMessage({ status: 403, message: '' }), /завершено/);
  assert.match(eventErrorMessage({ status: 0 }), /Нет связи/);
});
