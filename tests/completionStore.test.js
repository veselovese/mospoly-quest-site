import test from 'node:test';
import assert from 'node:assert/strict';
import { readCompletion, rememberCompletion } from '../src/session/completionStore.js';

test('итог хранится отдельно от сессии, не содержит токен и изолирован по квесту', () => {
  const data = new Map();
  globalThis.localStorage = {
    getItem: key => data.get(key) ?? null,
    setItem: (key, value) => data.set(key, value),
  };
  const summary = {
    firstName: 'Никита', lastName: 'Елисеев', questKey: 'zoo',
    score: 10, solvedCount: 1, totalTasks: 7, attemptsCount: 1,
    durationSeconds: 60, finishReason: 'gave_up', token: 'do-not-store',
  };
  rememberCompletion(summary);
  const stored = JSON.parse(data.get('quest-completion:v1:zoo'));
  assert.equal(stored.token, undefined);
  assert.equal(readCompletion('zoo').score, 10);
  assert.equal(readCompletion('orlov'), null);
  data.set('quest-completion:v1:orlov', '{invalid');
  assert.equal(readCompletion('orlov'), null);
  rememberCompletion({ ...summary, questKey: 'orlov', score: -1 });
  assert.equal(readCompletion('orlov'), null);
  globalThis.localStorage = { getItem() { throw Error('denied'); }, setItem() { throw Error('denied'); } };
  rememberCompletion({ ...summary, questKey: 'orlov' });
  assert.equal(readCompletion('orlov').score, 10);
});

test('барьер ставится на пару «квест + мероприятие»', () => {
  const data = new Map();
  globalThis.localStorage = {
    getItem: key => data.get(key) ?? null,
    setItem: (key, value) => data.set(key, value),
  };
  const summary = {
    firstName: 'Неопознанный', lastName: 'Верблюд', questKey: 'zoo', eventCode: '6479',
    score: 25, solvedCount: 2, totalTasks: 7, attemptsCount: 3,
    durationSeconds: 300, finishReason: 'completed',
  };
  rememberCompletion(summary);
  assert.equal(JSON.parse(data.get('quest-completion:v1:zoo@6479')).eventCode, '6479');
  assert.equal(readCompletion('zoo', '6479').score, 25);
  assert.equal(readCompletion('zoo', '1111'), null, 'на другом мероприятии участвовать можно');
  assert.equal(data.has('quest-completion:v1:zoo'), false, 'итог без мероприятия не создаётся');
  data.set('quest-completion:v1:zoo@2222', JSON.stringify({ ...summary, eventCode: '6479' }));
  assert.equal(readCompletion('zoo', '2222'), null, 'итог чужого мероприятия под ключом не принимается');
});
