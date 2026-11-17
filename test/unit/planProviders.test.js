const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const test = require('node:test');
const { runFileInput } = require('../../src/host/process');
const providers = require('../../src/host/planProviders');

const GOOD_PLAN = {
  title: 'Tool library',
  summary: 'Neighbors share tools.',
  epics: [
    {
      title: 'Catalog',
      summary: 'List tools.',
      tasks: [
        {
          title: 'Add a tool',
          description: 'A form with a name.',
          acceptanceCriteria: ['Name is required'],
          estimate: '1d',
        },
      ],
    },
  ],
};

test('provider detection uses Copilot, then Claude Code, then the API key', async () => {
  let claudeLooks = 0;
  let keyReads = 0;
  const copilot = await providers.detectPlanProvider({
    loadLanguageModel: async () => ({ id: 'copilot' }),
    findClaude: () => {
      claudeLooks += 1;
      return '/usr/local/bin/claude';
    },
    readApiKey: async () => {
      keyReads += 1;
      return 'sk-ant-secret';
    },
  });
  assert.strictEqual(copilot.id, 'vscode.lm');
  assert.strictEqual(copilot.label, 'Copilot');
  assert.strictEqual(claudeLooks, 0);
  assert.strictEqual(keyReads, 0);

  const claude = await providers.detectPlanProvider({
    loadLanguageModel: async () => null,
    findClaude: () => '/opt/homebrew/bin/claude',
    readApiKey: async () => {
      keyReads += 1;
      return 'sk-ant-secret';
    },
  });
  assert.strictEqual(claude.id, 'claude-cli');
  assert.strictEqual(claude.label, 'Claude Code');
  assert.strictEqual(keyReads, 0);

  const api = await providers.detectPlanProvider({
    loadLanguageModel: async () => null,
    findClaude: () => null,
    readApiKey: async () => 'sk-ant-secret',
  });
  assert.strictEqual(api.id, 'anthropic');
  assert.strictEqual(api.label, 'Anthropic');

  const none = await providers.detectPlanProvider({
    loadLanguageModel: async () => null,
    findClaude: () => null,
    readApiKey: async () => '',
  });
  assert.strictEqual(none, null);
});

test('claude detection checks the configured path, then PATH, then common locations', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'ps-claude-'));
  const pathDir = path.join(home, 'bin');
  const localDir = path.join(home, '.claude', 'local');
  fs.mkdirSync(pathDir, { recursive: true });
  fs.mkdirSync(localDir, { recursive: true });
  fs.writeFileSync(path.join(pathDir, 'claude'), '');
  fs.writeFileSync(path.join(localDir, 'claude'), '');
  const configured = path.join(home, 'custom-claude');
  fs.writeFileSync(configured, '');

  const names = providers.listClaudeCandidates({
    home,
    envPath: pathDir,
    configured: '',
    platform: 'linux',
  });
  assert.ok(names.includes(path.join(pathDir, 'claude')));
  assert.ok(names.includes(path.join(home, '.claude', 'local', 'claude')));
  assert.ok(names.includes('/opt/homebrew/bin/claude'));
  assert.ok(names.includes('/usr/local/bin/claude'));
  assert.ok(names.includes(path.join(home, '.local', 'bin', 'claude')));

  assert.strictEqual(
    providers.findClaudeBinary({ home, envPath: pathDir, configured: '', platform: 'linux' }),
    path.join(pathDir, 'claude')
  );
  fs.unlinkSync(path.join(pathDir, 'claude'));
  assert.strictEqual(
    providers.findClaudeBinary({ home, envPath: '/missing', configured: '', platform: 'linux' }),
    path.join(localDir, 'claude')
  );
  assert.strictEqual(
    providers.findClaudeBinary({ home, envPath: pathDir, configured, platform: 'linux' }),
    configured
  );
});

test('claude plan arguments are an array, use plan mode, and do not skip permissions', async () => {
  const args = providers.buildClaudePlanArgs();
  assert.ok(Array.isArray(args));
  assert.deepStrictEqual(args, [
    '-p',
    '--output-format',
    'json',
    '--permission-mode',
    'plan',
    '--allowedTools',
    '',
  ]);
  assert.ok(!args.includes(providers.SKIP_PERMISSIONS_FLAG));

  const calls = [];
  const hostile = 'share tools $(touch /tmp/ps-plan-pwn) `id`';
  const result = await providers.runClaudePlan({
    binary: '/fake/claude',
    prompt: hostile,
    cwd: '/work/app',
    run: async (file, commandArgs, options) => {
      calls.push({ file, commandArgs, options });
      return {
        ok: true,
        cancelled: false,
        timedOut: false,
        stdout: JSON.stringify({ result: JSON.stringify(GOOD_PLAN) }),
      };
    },
  });
  assert.strictEqual(result.ok, true);
  assert.strictEqual(result.plan.epics[0].tasks[0].id, 'PROJ-1');
  assert.strictEqual(calls[0].file, '/fake/claude');
  assert.ok(Array.isArray(calls[0].commandArgs));
  assert.ok(!calls[0].commandArgs.includes(providers.SKIP_PERMISSIONS_FLAG));
  assert.strictEqual(calls[0].options.shell, undefined);
  assert.strictEqual(calls[0].options.cwd, '/work/app');
  assert.strictEqual(calls[0].options.input, hostile);
});

test('runFileInput kills a process on timeout and on cancel', { timeout: 5000 }, async () => {
  const timed = await runFileInput(process.execPath, ['-e', 'setTimeout(() => {}, 30000)'], {
    timeoutMs: 200,
  });
  assert.strictEqual(timed.timedOut, true);
  assert.strictEqual(timed.cancelled, false);
  assert.strictEqual(timed.ok, false);

  const controller = new AbortController();
  const pending = runFileInput(process.execPath, ['-e', 'setTimeout(() => {}, 30000)'], {
    timeoutMs: 10000,
    signal: controller.signal,
  });
  controller.abort();
  const cancelled = await pending;
  assert.strictEqual(cancelled.cancelled, true);
  assert.strictEqual(cancelled.timedOut, false);
  assert.strictEqual(cancelled.ok, false);
});

test('claude receives the prompt on stdin and does not run a shell snippet', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ps-claude-run-'));
  const binary = path.join(root, 'claude');
  const record = path.join(root, 'record.json');
  const trap = path.join(root, 'pwned');
  const payload = 'borrow tools $(touch ' + trap + ')';
  const reply = JSON.stringify({ result: JSON.stringify(GOOD_PLAN) });
  fs.writeFileSync(
    binary,
    '#!/usr/bin/env node\n' +
      'const fs = require("fs");\n' +
      'let data = "";\n' +
      'process.stdin.on("data", (chunk) => { data += chunk; });\n' +
      'process.stdin.on("end", () => {\n' +
      '  fs.writeFileSync(' +
      JSON.stringify(record) +
      ', JSON.stringify({ argv: process.argv.slice(2), stdin: data }));\n' +
      '  process.stdout.write(' +
      JSON.stringify(reply) +
      ');\n' +
      '});\n'
  );
  fs.chmodSync(binary, 0o755);
  const result = await providers.runClaudePlan({
    binary,
    prompt: payload,
    cwd: root,
    timeoutMs: 5000,
  });
  assert.strictEqual(result.ok, true);
  assert.strictEqual(result.plan.title, 'Tool library');
  const seen = JSON.parse(fs.readFileSync(record, 'utf8'));
  assert.deepStrictEqual(seen.argv, providers.buildClaudePlanArgs());
  assert.ok(seen.stdin.includes(payload));
  assert.strictEqual(fs.existsSync(trap), false);
});

test('an unparseable or invalid model reply does not produce a plan', async () => {
  const unparsed = await providers.runClaudePlan({
    binary: '/fake/claude',
    prompt: 'idea',
    cwd: '/work',
    run: async () => ({ ok: true, stdout: 'not json', cancelled: false, timedOut: false }),
  });
  assert.strictEqual(unparsed.ok, false);
  assert.strictEqual(unparsed.reason, 'unparseable');
  assert.strictEqual(unparsed.plan, undefined);

  const invalid = await providers.runClaudePlan({
    binary: '/fake/claude',
    prompt: 'idea',
    cwd: '/work',
    run: async () => ({
      ok: true,
      stdout: JSON.stringify({ title: 'Only a title', epics: [] }),
      cancelled: false,
      timedOut: false,
    }),
  });
  assert.strictEqual(invalid.ok, false);
  assert.strictEqual(invalid.reason, 'invalid');
  assert.strictEqual(invalid.plan, undefined);
});

test('the API key is read and stored only through SecretStorage', async () => {
  const settingsReads = [];
  const config = {
    get(key) {
      settingsReads.push(key);
      if (
        String(key).toLowerCase().includes('key') ||
        String(key).toLowerCase().includes('secret')
      ) {
        throw new Error('API key must not be read from settings');
      }
      return key === 'anthropic.model' ? '' : '';
    },
  };
  assert.strictEqual(providers.readAnthropicModel(config), providers.DEFAULT_ANTHROPIC_MODEL);
  assert.deepStrictEqual(settingsReads, ['anthropic.model']);

  const stored = [];
  const notes = [];
  const secrets = {
    async get(name) {
      assert.strictEqual(name, providers.SECRET_KEY);
      return 'sk-ant-secret';
    },
    async store(name, value) {
      stored.push([name, value]);
    },
    async delete(name) {
      stored.push(['delete', name]);
    },
  };
  const provider = await providers.detectPlanProvider({
    loadLanguageModel: async () => null,
    findClaude: () => null,
    readApiKey: () => providers.readAnthropicApiKey(secrets),
  });
  assert.strictEqual(provider.id, 'anthropic');
  assert.strictEqual(provider.apiKey, 'sk-ant-secret');

  await providers.promptAndStoreAnthropicKey({
    lang: 'en',
    showInputBox: async (options) => {
      assert.strictEqual(options.password, true);
      return 'sk-ant-secret';
    },
    secrets,
    notify(message) {
      notes.push(message);
    },
  });
  assert.deepStrictEqual(stored[0], [providers.SECRET_KEY, 'sk-ant-secret']);
  assert.ok(notes.every((message) => !message.includes('sk-ant-secret')));

  let seen;
  const logs = [];
  const original = console.log;
  console.log = (...args) => logs.push(args.join(' '));
  try {
    const failed = await providers.requestAnthropicMessages({
      apiKey: 'sk-ant-secret',
      model: 'claude-sonnet-4-5',
      prompt: 'plan this project',
      fetchImpl: async (url, options) => {
        seen = { url, body: options.body, header: options.headers['x-api-key'] };
        throw new Error('network failed for sk-ant-secret');
      },
    });
    assert.strictEqual(failed.reason, 'api-error');
    assert.ok(!JSON.stringify(failed).includes('sk-ant-secret'));
  } finally {
    console.log = original;
  }
  assert.strictEqual(seen.url, providers.ANTHROPIC_URL);
  assert.ok(seen.url.startsWith('https://'));
  assert.strictEqual(seen.header, 'sk-ant-secret');
  assert.ok(seen.body.includes('plan this project'));
  assert.ok(!seen.body.includes('sk-ant-secret'));
  assert.ok(logs.every((line) => !line.includes('sk-ant-secret')));

  await providers.clearStoredAnthropicKey({
    lang: 'en',
    secrets,
    notify(message) {
      notes.push(message);
    },
  });
  assert.deepStrictEqual(stored[1], ['delete', providers.SECRET_KEY]);
});
