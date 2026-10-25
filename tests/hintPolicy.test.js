import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeHintPolicy, parseHintReceipt } from '../src/session/hintPolicy.js';
test('политика должна явно прийти с сервера', () => {
  for (const value of [undefined, null, {}, {points_per_hint: 0, max_hints: 3}, {points_per_hint: -1, max_hints: 2}]) {
    assert.equal(normalizeHintPolicy(value), null);
  }
  assert.deepEqual(normalizeHintPolicy({points_per_hint: 1,max_hints: 3}), {pointsPerHint: 1,maxHints: 3});
});
test('неподтверждённая подсказка не должна открыться', () => {
  for (const value of [null, {}, {hints_used: -1, available_points: 10}, {hints_used: 4, available_points: 6}, {hints_used: 1, available_points: 11}]) {
    assert.throws(() => parseHintReceipt(value, 10, 3));
  }
  assert.deepEqual(parseHintReceipt({hints_used: 2, available_points: 8},10,3), {used:2,availablePoints:8});
});
