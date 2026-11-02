import test from 'node:test';
import assert from 'node:assert/strict';
import {
  clockOffset,
  isTimeExpired,
  remainingSeconds,
  resolveDeadline,
  resolveTimeLimit,
  timerLevel,
} from '../src/session/questTimer.js';

test('лимит берётся с сервера, иначе запасной из реестра квестов', () => {
  assert.equal(resolveTimeLimit({ time_limit_seconds: 2400 }, 1800), 2400);
  assert.equal(resolveTimeLimit({ time_limit_seconds: null }, 1800), 1800);
  assert.equal(resolveTimeLimit({ time_limit_seconds: 0 }, 1800), 1800);
  assert.equal(resolveTimeLimit({}, null), null, 'без лимита таймер не показывается');
});

test('дедлайн: deadline_at с сервера, иначе начало смены + лимит', () => {
  const startedAt = '2026-11-07T10:00:00.000Z';
  assert.equal(
    resolveDeadline({ startedAt, deadlineAt: '2026-11-07T10:30:00.000Z' }, 2400),
    Date.parse('2026-11-07T10:30:00.000Z'),
  );
  assert.equal(resolveDeadline({ startedAt, deadlineAt: null }, 2400), Date.parse('2026-11-07T10:40:00.000Z'));
  assert.equal(resolveDeadline({ startedAt: 'не дата' }, 2400), null);
  assert.equal(resolveDeadline({ startedAt }, null), null);
});

test('остаток считается по часам сервера и не уходит в минус', () => {
  const deadline = Date.parse('2026-11-07T10:40:00.000Z');
  const now = Date.parse('2026-11-07T10:39:00.000Z');
  assert.equal(remainingSeconds(deadline, 0, now), 60);
  // часы устройства отстают от сервера на 10 секунд — осталось меньше
  assert.equal(remainingSeconds(deadline, 10000, now), 50);
  assert.equal(remainingSeconds(deadline, 0, now + 120000), 0);
  assert.equal(remainingSeconds(deadline, 0, now + 500), 60, 'неполная секунда округляется вверх');
  assert.equal(remainingSeconds(null, 0, now), null);
  assert.equal(clockOffset('2026-11-07T10:00:10.000Z', Date.parse('2026-11-07T10:00:00.000Z')), 10000);
  assert.equal(clockOffset(undefined), 0);
});

test('уровни таймера и признак истечения времени на сервере', () => {
  assert.equal(timerLevel(301), 'normal');
  assert.equal(timerLevel(300), 'warning');
  assert.equal(timerLevel(60), 'critical');
  assert.equal(timerLevel(0), 'critical');
  assert.equal(timerLevel(null), 'none');
  assert.equal(isTimeExpired({ status: 409, data: { code: 'time_expired' } }), true);
  assert.equal(isTimeExpired({ status: 409, data: { detail: 'Смена уже завершена.' } }), false);
  assert.equal(isTimeExpired(null), false);
});
