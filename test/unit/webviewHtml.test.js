const assert = require('assert');
const test = require('node:test');
const fs = require('fs');
const path = require('path');
const { renderWebviewHtml, buildContentSecurityPolicy } = require('../../src/webview/html');

const root = path.join(__dirname, '../..');

function render(overrides = {}) {
  return renderWebviewHtml({
    cspSource: 'https://example.vscode-cdn.net',
    nonce: 'abc123nonce',
    cssUri: 'https://example.vscode-cdn.net/main.css',
    jsUri: 'https://example.vscode-cdn.net/main.js',
    i18nUri: 'https://example.vscode-cdn.net/i18n.js',
    lang: 'en',
    onboarded: false,
    connectedTools: [],
    tasks: null,
    epics: null,
    detectedExts: { gitlab: false, github: false, jira: false, claude: true },
    activeAi: 'Claude',
    localMode: false,
    initialTicket: null,
    ...overrides,
  });
}

test('content security policy allows the nonce and blocks inline scripts', () => {
  const policy = buildContentSecurityPolicy('https://example.vscode-cdn.net', 'n1');
  assert.match(policy, /default-src 'none'/);
  assert.match(policy, /script-src 'nonce-n1'/);
  assert.doesNotMatch(policy, /script-src[^;]*unsafe-inline/);
  assert.doesNotMatch(policy, /unsafe-eval/);
  assert.match(policy, /style-src https:\/\/example\.vscode-cdn\.net 'unsafe-inline'/);
});

test('rendered webview has no inline handlers and loads local assets', () => {
  const html = render();
  assert.doesNotMatch(html, /onclick=/);
  assert.doesNotMatch(html, /oninput=/);
  assert.doesNotMatch(html, /onchange=/);
  assert.doesNotMatch(html, /javascript:/);
  assert.match(html, /nonce="abc123nonce"/);
  assert.match(html, /src="https:\/\/example\.vscode-cdn\.net\/main\.js"/);
  assert.match(html, /src="https:\/\/example\.vscode-cdn\.net\/i18n\.js"/);
  assert.match(html, /href="https:\/\/example\.vscode-cdn\.net\/main\.css"/);
  assert.match(html, /id="topAct" style="display:none"/);
  assert.match(html, /id="lEn" class="active"/);
  assert.match(html, /id="lEs" class=""/);
  assert.match(html, />Claude</);
  const bootstrap = JSON.parse(
    html.match(/<script type="application\/json" id="ps-bootstrap"[^>]*>([\s\S]*?)<\/script>/)[1]
  );
  assert.strictEqual(bootstrap.lang, 'en');
  assert.strictEqual(bootstrap.onboarded, false);
  assert.strictEqual(bootstrap.i18n.en.newP, 'New project');
  assert.strictEqual(bootstrap.i18n.es.newP, 'Nuevo proyecto');
  assert.strictEqual(bootstrap.detectedExts.claude, true);
});

test('onboarded local mode shows the top bar and hides onboarding', () => {
  const html = render({
    lang: 'es',
    onboarded: true,
    localMode: true,
    activeAi: 'Ollama',
    initialTicket: 'LOCAL-1',
    tasks: { 'LOCAL-1': { title: { es: 'Uno', en: 'One' } } },
    connectedTools: ['Claude'],
  });
  assert.doesNotMatch(html, /id="topAct" style="display:none"/);
  assert.match(html, /id="sOb" style="display:none"/);
  assert.match(html, /id="lEs" class="active"/);
  assert.match(html, />Ollama</);
  assert.doesNotMatch(html, /display:none">Local/);
  const bootstrap = JSON.parse(
    html.match(/<script type="application\/json" id="ps-bootstrap"[^>]*>([\s\S]*?)<\/script>/)[1]
  );
  assert.strictEqual(bootstrap.initialTicket, 'LOCAL-1');
  assert.strictEqual(bootstrap.tasks['LOCAL-1'].title.es, 'Uno');
  assert.deepStrictEqual(bootstrap.connectedTools, ['Claude']);
});

test('bootstrap json cannot break out of the script tag', () => {
  const html = render({
    tasks: { '<script>': { title: { es: '</script><script>alert(1)</script>', en: 'x' } } },
  });
  assert.doesNotMatch(html, /<script>alert/);
  const raw = html.match(
    /<script type="application\/json" id="ps-bootstrap"[^>]*>([\s\S]*?)<\/script>/
  )[1];
  const bootstrap = JSON.parse(raw);
  assert.strictEqual(bootstrap.tasks['<script>'].title.es, '</script><script>alert(1)</script>');
});

test('webview sources do not keep inline handlers', () => {
  const js = fs.readFileSync(path.join(root, 'media/webview/main.js'), 'utf8');
  const html = fs.readFileSync(path.join(root, 'media/webview/index.html'), 'utf8');
  const css = fs.readFileSync(path.join(root, 'media/webview/main.css'), 'utf8');
  assert.doesNotMatch(js, /onclick=/);
  assert.doesNotMatch(js, /oninput=/);
  assert.doesNotMatch(html, /onclick=/);
  assert.match(js, /ProductStudioI18n\.lookup/);
  assert.match(js, /data-act/);
  assert.match(css, /\.bp\{/);
  assert.strictEqual(fs.existsSync(path.join(root, 'extension.js')), false);
});
