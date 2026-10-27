import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'vite';

test('мок: штраф сохраняется в результате, повтор запроса не списывает дважды', async () => {
  const values = new Map();
  globalThis.localStorage = {getItem: (k) => values.get(k) ?? null, setItem: (k,v) => values.set(k,v)};
  globalThis.window = {setTimeout};
  const server = await createServer({mode:'mock', server:{middlewareMode:true}, appType:'custom'});
  try {
    const {mockRequest: request} = await server.ssrLoadModule('/src/api/mock.js');
    const participant = await request('/participants/', {method:'POST', body:{first_name:'Тест',last_name:'Подсказок'}});
    const token = participant.token;
    const post = (path, body) => request(path, {method:'POST', token, body});
    const tasks = await request('/tasks/', {token});
    assert.equal(tasks[0].available_points,10);
    assert.equal(tasks[0].hint_penalty.points_per_hint,1);
    await assert.rejects(() => post('/tasks/1/hints/', {hint_index:2}));
    await assert.rejects(() => post('/tasks/101/hints/', {hint_index:1}));
    const receipt = await post('/tasks/1/hints/', {hint_index:1});
    assert.deepEqual(receipt,{hints_used:1,available_points:9});
    assert.deepEqual(await post('/tasks/1/hints/',{hint_index:1}),receipt);
    assert.equal((await request('/tasks/',{token}))[0].hints_used,1);
    const wrong = await post('/tasks/1/attempts/',{answer:'wrong'});
    assert.equal(wrong.points_earned,0);
    const right = await post('/tasks/1/attempts/',{answer:'101101'});
    assert.equal(right.points_earned,9);
    assert.deepEqual(await post('/tasks/1/attempts/',{answer:'101101'}),right);
    await assert.rejects(() => post('/tasks/1/hints/',{hint_index:2}));
    const finish = await post('/participants/finish/',{reason:'gave_up'});
    assert.equal(finish.score,9);
    assert.equal(finish.solved_tasks,1);
    const ranking=await request('/ranking/');
    assert.equal(ranking.find(x=>x.first_name==='Тест').score,9);
  } finally {await server.close(); delete globalThis.localStorage; delete globalThis.window;}
});
