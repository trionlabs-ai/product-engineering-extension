const assert = require('assert');
const test = require('node:test');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { JSDOM } = require('jsdom');
const { lookup } = require('../../media/webview/shared/i18n');

const es = JSON.parse(
  fs.readFileSync(path.join(__dirname, '../../media/webview/i18n/es.json'), 'utf8')
);
const en = JSON.parse(
  fs.readFileSync(path.join(__dirname, '../../media/webview/i18n/en.json'), 'utf8')
);
const scriptSource = fs.readFileSync(path.join(__dirname, '../../media/webview/main.js'), 'utf8');

function boot(bootstrap) {
  const dom = new JSDOM(
    `<!DOCTYPE html><body>
      <div id="topAct"></div><span id="topLbl"></span><span id="bNP"></span><span id="bRC"></span>
      <span id="topAiIcon"></span><span id="topAiName"></span><span id="topAiDot"></span>
      <span id="topLocalBadge"></span><span id="envDot"></span>
      <button id="lEs"></button><button id="lEn"></button>
      <div id="sOb"></div><div id="sHome"></div><div id="sTk"></div><div id="sSet"></div>
      <div id="sCreate"></div><div id="sCreateEpic"></div><div id="sEnv"></div><div id="sAi"></div>
      <div id="toastEl"></div><span id="toastTx"></span><div id="clipEl"></div><span id="clipTx"></span>
      <script type="application/json" id="ps-bootstrap"></script>
    </body>`
  );
  dom.window.document.getElementById('ps-bootstrap').textContent = JSON.stringify(bootstrap);
  const messages = [];
  const sandbox = {
    document: dom.window.document,
    window: dom.window,
    navigator: dom.window.navigator,
    console,
    setTimeout: dom.window.setTimeout.bind(dom.window),
    clearTimeout: dom.window.clearTimeout.bind(dom.window),
    acquireVsCodeApi() {
      return {
        postMessage(message) {
          messages.push(message);
        },
      };
    },
    ProductStudioI18n: { lookup },
  };
  vm.createContext(sandbox);
  vm.runInContext(
    scriptSource +
      '\nthis.__psFns = { rEnv: rEnv, rAi: rAi, rSet: rSet, rCreate: rCreate, rCreateEpic: rCreateEpic };',
    sandbox
  );
  return { dom, sandbox, messages };
}

const detected = {
  gitlab: false,
  github: false,
  jira: false,
  claude: false,
  copilot: false,
  gemini: false,
  continue: false,
  ollama: false,
};

test('fresh webview renders onboarding without inline handlers and can start locally', () => {
  const { dom, messages } = boot({
    lang: 'en',
    onboarded: false,
    connectedTools: [],
    detectedExts: detected,
    localMode: false,
    activeAi: 'Claude',
    epics: null,
    tasks: null,
    initialTicket: null,
    i18n: { es, en },
  });
  const html = dom.window.document.getElementById('sOb').innerHTML;
  assert.match(html, /Start in local mode/);
  assert.match(html, /data-act="startLocally"/);
  assert.doesNotMatch(html, /onclick=/);
  assert.doesNotMatch(html, /oninput=/);
  assert.ok(messages.some((message) => message.type === 'checkDocker'));
  assert.ok(messages.some((message) => message.type === 'uiReady'));

  dom.window.document.querySelector('[data-act="startLocally"]').click();
  const finished = messages.find((message) => message.type === 'finishOnboarding');
  assert.ok(finished);
  assert.strictEqual(finished.localMode, true);
  assert.strictEqual(finished.activeAi, 'Claude');
});

test('onboarded webview renders epics and tasks through delegated actions', () => {
  const { dom, sandbox, messages } = boot({
    lang: 'es',
    onboarded: true,
    connectedTools: ['Claude', 'Jira'],
    detectedExts: detected,
    localMode: true,
    activeAi: 'Claude',
    epics: {
      'EPIC-1': {
        id: 'EPIC-1',
        key: 'PAY',
        name: { es: 'Pagos', en: 'Payments' },
        summary: { es: 'Cobros', en: 'Payments' },
        color: '#0969da',
        milestoneId: 'M-1',
        lead: 'Alex',
      },
    },
    tasks: {
      'PAY-101': {
        title: { es: 'Boton de pago', en: 'Pay button' },
        desc: { es: 'Agregar boton', en: 'Add button' },
        status: { es: 'En curso', en: 'In progress' },
        color: 'blue',
        type: 'story',
        assignedTo: 'me',
        epicId: 'EPIC-1',
        criteria: { es: ['Se ve el boton'], en: ['Button is visible'] },
      },
    },
    initialTicket: null,
    i18n: { es, en },
  });
  const home = dom.window.document.getElementById('sHome').innerHTML;
  assert.match(home, /EPIC-1/);
  assert.match(home, /data-act="openEpic"/);
  assert.doesNotMatch(home, /onclick=/);
  assert.ok(messages.some((message) => message.type === 'uiReady'));

  dom.window.document.querySelector('[data-act="openEpic"]').click();
  assert.match(dom.window.document.getElementById('sHome').innerHTML, /PAY-101/);
  assert.doesNotMatch(dom.window.document.getElementById('sHome').innerHTML, /onclick=/);

  sandbox.__psFns.rEnv();
  sandbox.__psFns.rAi();
  sandbox.__psFns.rSet();
  sandbox.__psFns.rCreate();
  sandbox.__psFns.rCreateEpic();
  ['sEnv', 'sAi', 'sSet', 'sCreate', 'sCreateEpic'].forEach((id) => {
    const html = dom.window.document.getElementById(id).innerHTML;
    assert.ok(html.length > 0, id);
    assert.doesNotMatch(html, /onclick=/);
    assert.doesNotMatch(html, /oninput=/);
  });
});
