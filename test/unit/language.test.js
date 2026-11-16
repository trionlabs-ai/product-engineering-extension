const assert = require('assert');
const test = require('node:test');
const { resolveLanguage, getDetectedExts, pickDefaultAi } = require('../../src/host/language');

test('resolveLanguage honors an explicit preference', () => {
  assert.strictEqual(resolveLanguage('es', 'en'), 'es');
  assert.strictEqual(resolveLanguage('en', 'es-ES'), 'en');
});

test('resolveLanguage detects Spanish from the environment', () => {
  assert.strictEqual(resolveLanguage('auto', 'es'), 'es');
  assert.strictEqual(resolveLanguage('auto', 'es-MX'), 'es');
  assert.strictEqual(resolveLanguage('auto', 'en'), 'en');
  assert.strictEqual(resolveLanguage('auto', undefined), 'en');
});

test('getDetectedExts checks the known extension ids', () => {
  const installed = new Set(['GitHub.vscode-pull-request-github', 'github.copilot-chat']);
  const detected = getDetectedExts((id) => installed.has(id));
  assert.strictEqual(detected.github, true);
  assert.strictEqual(detected.copilot, true);
  assert.strictEqual(detected.claude, false);
  assert.strictEqual(detected.jira, false);
});

test('pickDefaultAi follows the extension priority', () => {
  assert.strictEqual(pickDefaultAi({}), 'Claude');
  assert.strictEqual(pickDefaultAi({ ollama: true, copilot: true }), 'GitHub Copilot');
  assert.strictEqual(pickDefaultAi({ gemini: true, continue: true }), 'Antigravity');
  assert.strictEqual(pickDefaultAi({ claude: true, copilot: true }), 'Claude');
  assert.strictEqual(pickDefaultAi({ ollama: true }), 'Ollama');
});
