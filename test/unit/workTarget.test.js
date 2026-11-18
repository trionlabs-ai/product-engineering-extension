const assert = require('assert');
const test = require('node:test');
const { runFile } = require('../../src/host/process');
const work = require('../../src/host/workTarget');

function memoryState(initial) {
  const data = Object.assign({}, initial);
  return {
    get(key) {
      return data[key];
    },
    set(key, value) {
      data[key] = value;
    },
  };
}

function host(overrides) {
  const calls = [];
  const ctx = Object.assign(
    {
      calls,
      getLang: () => 'en',
      getWorkspaceRoot: () => '/work',
      platform: 'linux',
      state: memoryState({
        tasks: {
          'PROJ-12': {
            title: { en: 'Add a tool' },
            desc: { en: 'A form with a name.' },
            criteria: { en: ['Name is required'] },
            epicId: 'EPIC-1',
            status: { en: 'To do' },
          },
        },
        epics: {
          'EPIC-1': { name: { en: 'Catalog' }, summary: { en: 'List what people own.' } },
        },
      }),
      getWorkTarget: () => 'auto',
      hasClaudeExtension: () => true,
      getClaudePath: () => '',
      findClaude: () => '/usr/local/bin/claude',
      postMessage(message) {
        calls.push(message);
      },
      showInformationMessage(message) {
        calls.push({ info: message });
      },
      showWarningMessage() {},
      showErrorMessage(message) {
        calls.push({ error: message });
      },
      async openExternal(url) {
        calls.push({ open: url });
        return true;
      },
      async writeClipboard(value) {
        calls.push({ clipboard: value });
      },
      createTerminal(options) {
        const terminal = {
          options,
          shown: false,
          sent: null,
          show() {
            this.shown = true;
          },
          sendText(command, execute) {
            this.sent = { command, execute };
          },
        };
        calls.push({ terminal });
        return terminal;
      },
    },
    overrides
  );
  return ctx;
}

test('the work prompt includes the task, epic, and branch', () => {
  const prompt = work.buildWorkPrompt({
    ticketId: 'PROJ-12',
    title: 'Add a tool',
    description: 'A form with a name.',
    acceptanceCriteria: ['Name is required', 'Price is optional'],
    epicTitle: 'Catalog',
    epicSummary: 'List what people own.',
    branch: 'feat/PROJ-12-add-a-tool',
  });
  assert.match(prompt, /Ticket: PROJ-12/);
  assert.match(prompt, /Title: Add a tool/);
  assert.match(prompt, /Branch: feat\/PROJ-12-add-a-tool/);
  assert.match(prompt, /Epic: Catalog/);
  assert.match(prompt, /List what people own/);
  assert.match(prompt, /A form with a name/);
  assert.match(prompt, /- Name is required/);
  assert.match(prompt, /- Price is optional/);
  assert.ok(!prompt.includes('--dangerously-skip-permissions'));
});

test('auto prefers the Claude panel, then the terminal, then the clipboard', () => {
  assert.strictEqual(
    work.selectWorkTarget({
      setting: 'auto',
      extensionInstalled: true,
      claudeBinary: '/bin/claude',
    }),
    'claudePanel'
  );
  assert.strictEqual(
    work.selectWorkTarget({
      setting: 'auto',
      extensionInstalled: false,
      claudeBinary: '/bin/claude',
    }),
    'claudeTerminal'
  );
  assert.strictEqual(
    work.selectWorkTarget({ setting: 'auto', extensionInstalled: false, claudeBinary: '' }),
    'clipboard'
  );
  assert.strictEqual(
    work.selectWorkTarget({
      setting: 'claudePanel',
      extensionInstalled: false,
      claudeBinary: '/bin/claude',
    }),
    'claudeTerminal'
  );
  assert.strictEqual(
    work.selectWorkTarget({
      setting: 'claudeTerminal',
      extensionInstalled: true,
      claudeBinary: '',
    }),
    'clipboard'
  );
  assert.strictEqual(
    work.selectWorkTarget({
      setting: 'clipboard',
      extensionInstalled: true,
      claudeBinary: '/bin/claude',
    }),
    'clipboard'
  );
});

test('the Claude panel link only prefills the documented prompt parameter', () => {
  const uri = work.buildClaudePanelUri('review my changes');
  assert.strictEqual(uri, 'vscode://anthropic.claude-code/open?prompt=review%20my%20changes');
  const parsed = new URL(uri);
  assert.strictEqual(parsed.protocol, 'vscode:');
  assert.strictEqual(parsed.hostname, 'anthropic.claude-code');
  assert.strictEqual(parsed.pathname, '/open');
  assert.deepStrictEqual([...parsed.searchParams.keys()], ['prompt']);
  work.BYPASS_FLAGS.forEach((flag) => assert.ok(!parsed.searchParams.has(flag)));
});

test('the terminal command quotes the prompt and does not add bypass flags', async () => {
  const prompt = "say 'hello' $(whoami) `id` ; rm -rf /";
  const args = work.buildClaudeTerminalArgs(prompt);
  assert.deepStrictEqual(args, [prompt]);
  work.BYPASS_FLAGS.forEach((flag) => assert.ok(!args.includes(flag)));
  const command = work.buildClaudeTerminalCommand('/opt/homebrew/bin/claude', prompt, 'linux');
  assert.ok(command.startsWith("'/opt/homebrew/bin/claude' "));
  assert.ok(!command.includes(' -p ') && !command.endsWith(' -p'));
  assert.ok(!command.includes('--dangerously-skip-permissions'));
  const printed = await runFile('bash', ['-c', 'printf %s ' + work.quoteShellArg(prompt, 'linux')]);
  assert.strictEqual(printed.ok, true);
  assert.strictEqual(printed.stdout, prompt);
  assert.strictEqual(work.quoteShellArg("a'b", 'win32'), "'a''b'");
});

test('Work opens the panel only after the branch is ready and marks the task in progress', async () => {
  const cancelled = host();
  const stopped = await work.startTaskWork(
    cancelled,
    { ticketId: 'PROJ-12', title: 'Add a tool' },
    { prepareTicketBranch: async () => ({ ok: false, reason: 'cancelled' }) }
  );
  assert.strictEqual(stopped.ok, false);
  assert.ok(!cancelled.calls.some((call) => call.open));

  const ctx = host();
  const started = await work.startTaskWork(
    ctx,
    { ticketId: 'PROJ-12', title: 'Add a tool' },
    {
      prepareTicketBranch: async () => ({ ok: true, branch: 'feat/PROJ-12-add-a-tool' }),
    }
  );
  assert.strictEqual(started.target, 'claudePanel');
  assert.strictEqual(started.submitted, false);
  assert.strictEqual(ctx.state.get('tasks')['PROJ-12'].status.en, 'In progress');
  const opened = ctx.calls.find((call) => call.open);
  assert.match(opened.open, /^vscode:\/\/anthropic\.claude-code\/open\?prompt=/);
  assert.match(decodeURIComponent(opened.open.split('prompt=')[1]), /feat\/PROJ-12-add-a-tool/);
  assert.ok(ctx.calls.some((call) => call.type === 'workStarted' && call.target === 'claudePanel'));
});

test('a missing panel falls back to the terminal, then the clipboard', async () => {
  const terminalHost = host({ hasClaudeExtension: () => false });
  const terminal = await work.startTaskWork(
    terminalHost,
    { ticketId: 'PROJ-12', title: 'Add a tool' },
    { prepareTicketBranch: async () => ({ ok: true, branch: 'feat/PROJ-12-add-a-tool' }) }
  );
  assert.strictEqual(terminal.target, 'claudeTerminal');
  const created = terminalHost.calls.find((call) => call.terminal);
  assert.strictEqual(created.terminal.shown, true);
  assert.strictEqual(created.terminal.sent.execute, true);
  assert.ok(!created.terminal.sent.command.includes(' -p '));
  assert.ok(!created.terminal.sent.command.includes('--dangerously-skip-permissions'));

  const copyHost = host({
    hasClaudeExtension: () => false,
    findClaude: () => '',
  });
  const copied = await work.startTaskWork(
    copyHost,
    { ticketId: 'PROJ-12', title: 'Add a tool' },
    { prepareTicketBranch: async () => ({ ok: true, branch: 'feat/PROJ-12-add-a-tool' }) }
  );
  assert.strictEqual(copied.target, 'clipboard');
  assert.ok(copyHost.calls.some((call) => call.clipboard && call.clipboard.includes('PROJ-12')));
});
