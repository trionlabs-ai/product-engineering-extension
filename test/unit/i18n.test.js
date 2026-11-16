const assert = require('assert');
const test = require('node:test');
const fs = require('fs');
const path = require('path');
const { lookup } = require('../../media/webview/shared/i18n');

const es = JSON.parse(
  fs.readFileSync(path.join(__dirname, '../../media/webview/i18n/es.json'), 'utf8')
);
const en = JSON.parse(
  fs.readFileSync(path.join(__dirname, '../../media/webview/i18n/en.json'), 'utf8')
);
const dict = { es, en };

test('es and en expose the same keys', () => {
  assert.deepStrictEqual(Object.keys(es).sort(), Object.keys(en).sort());
});

test('lookup returns the string for the active language', () => {
  assert.strictEqual(lookup(dict, 'es', 'newP'), 'Nuevo proyecto');
  assert.strictEqual(lookup(dict, 'en', 'newP'), 'New project');
});

test('lookup replaces each placeholder once', () => {
  assert.strictEqual(lookup(dict, 'en', 'obS', { n: 1, t: 3 }), 'Step 1 of 3');
  assert.strictEqual(lookup(dict, 'en', 'asgn', { n: '2' }), '2 tasks');
});

test('lookup returns the key when the translation is missing', () => {
  assert.strictEqual(lookup(dict, 'en', 'branchLocal'), 'branchLocal');
  assert.strictEqual(lookup(dict, 'fr', 'newP'), 'newP');
});

test('lookup keeps an empty translation as the key', () => {
  assert.strictEqual(lookup({ en: { blank: '' } }, 'en', 'blank'), 'blank');
});
