const assert = require('assert');
const test = require('node:test');
const { PREFIX, stateKey, createStateStore } = require('../../src/host/stateStore');

test('state keys keep the ps. prefix', () => {
  assert.strictEqual(PREFIX, 'ps.');
  assert.strictEqual(stateKey('tasks'), 'ps.tasks');
});

test('store reads and writes through the prefixed key', () => {
  const data = {};
  const globalState = {
    get(key, fallback) {
      return Object.prototype.hasOwnProperty.call(data, key) ? data[key] : fallback;
    },
    update(key, value) {
      data[key] = value;
      return Promise.resolve();
    },
  };
  const store = createStateStore(globalState);
  assert.strictEqual(store.get('onboarded', false), false);
  store.set('onboarded', true);
  store.set('tasks', { 'PROJ-1': { title: 'Pay' } });
  assert.strictEqual(store.get('onboarded', false), true);
  assert.deepStrictEqual(data['ps.tasks']['PROJ-1'].title, 'Pay');
  assert.strictEqual(Object.prototype.hasOwnProperty.call(data, 'tasks'), false);
});
