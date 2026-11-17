const assert = require('assert');
const test = require('node:test');
const { routeMessage, TERMINAL_TEST_COMMAND } = require('../../src/host/messageRouter');
const git = require('../../src/host/gitService');
const docker = require('../../src/host/dockerService');
const { text } = require('../../src/host/text');
const { createContext, flush } = require('./helpers');

const hostile = 'say "hello" $(whoami) `id` ; rm -rf / && echo\nnext';

function gitRunner({
  branch,
  status = ' M file.js\n',
  remote = '',
  pushOk = true,
  identity = true,
} = {}) {
  return (file, args) => {
    if (file === 'docker') {
      if (args[0] === '--version') return { ok: true, stdout: 'Docker version 27\n', stderr: '' };
      if (args[0] === 'info') return { ok: true, stdout: '', stderr: '' };
      if (args[0] === 'ps') return { ok: true, stdout: '', stderr: '' };
      return { ok: true, stdout: '', stderr: '' };
    }
    if (args[0] === 'rev-parse' && args[1] === '--is-inside-work-tree') {
      return { ok: true, stdout: 'true\n', stderr: '' };
    }
    if (args[0] === 'rev-parse' && args.includes('--short')) {
      return { ok: true, stdout: 'abc123\n', stderr: '' };
    }
    if (args[0] === 'rev-parse') return { ok: true, stdout: 'abc123\n', stderr: '' };
    if (args[0] === 'branch') return { ok: true, stdout: `${branch}\n`, stderr: '' };
    if (args[0] === 'status') return { ok: true, stdout: status, stderr: '' };
    if (args[0] === 'rev-list') return { ok: true, stdout: '2\n', stderr: '' };
    if (args[0] === 'config' && args[1] === '--get') {
      if (!identity) return { ok: false, stdout: '', stderr: '' };
      return {
        ok: true,
        stdout: args[2] === 'user.name' ? 'Ada Lovelace\n' : 'ada@example.com\n',
        stderr: '',
      };
    }
    if (args[0] === 'remote') return { ok: true, stdout: remote, stderr: '' };
    if (args[0] === 'push') {
      return pushOk
        ? { ok: true, stdout: '', stderr: '' }
        : { ok: false, stdout: '', stderr: 'Authentication failed for https://example.com' };
    }
    if (args[0] === 'show-ref' && String(args[3] || '').endsWith('/main')) {
      return { ok: true, stdout: '', stderr: '' };
    }
    if (args[0] === 'show-ref' || args[0] === 'symbolic-ref') {
      return { ok: false, stdout: '', stderr: '' };
    }
    return { ok: true, stdout: '', stderr: '' };
  };
}

test('finishOnboarding stores tools, local mode, and the explicit assistant', async () => {
  const ctx = createContext({ lang: 'es' });
  await routeMessage(
    { type: 'finishOnboarding', tools: ['Jira'], localMode: true, activeAi: 'Ollama' },
    ctx
  );
  assert.strictEqual(ctx.stored.onboarded, true);
  assert.deepStrictEqual(ctx.stored.connectedTools, ['Jira']);
  assert.strictEqual(ctx.stored.localMode, true);
  assert.strictEqual(ctx.stored.activeAi, 'Ollama');
  assert.match(ctx.info[0], /Modo local configurado/);
});

test('finishOnboarding picks the first known assistant from the tool list', async () => {
  const ctx = createContext();
  await routeMessage({ type: 'finishOnboarding', tools: ['Jira', 'GitHub Copilot', 'Figma'] }, ctx);
  assert.strictEqual(ctx.stored.activeAi, 'GitHub Copilot');
  assert.strictEqual(ctx.stored.localMode, false);
  assert.match(ctx.info[0], /Project configured/);
});

test('commitLocal without a workspace does not invent a hash', async () => {
  const ctx = createContext({ root: null });
  await routeMessage({ type: 'commitLocal', ticketId: 'LOCAL-4', title: 'Ship it' }, ctx);
  assert.strictEqual(ctx.invocations.length, 0);
  assert.strictEqual(ctx.messages.length, 0);
  assert.match(ctx.warnings[0], /nothing was committed/i);
});

test('commitLocal passes a hostile title as one commit argument and does not set identity', async () => {
  const branch = git.ticketBranchName('T-1', hostile);
  const ctx = createContext({
    warningResponse: text('en', 'commitConfirm'),
    runResult: gitRunner({ branch, remote: '' }),
  });
  await routeMessage({ type: 'commitLocal', ticketId: 'T-1', title: hostile }, ctx);
  await flush();
  const message = git.formatCommitMessage('T-1', hostile);
  const commit = ctx.invocations.find((call) => call.args[0] === 'commit');
  assert.deepStrictEqual(commit.args, ['commit', '-m', message]);
  assert.strictEqual(commit.args[2], message);
  assert.ok(commit.args[2].includes('$(whoami)'));
  assert.ok(commit.args[2].includes('`id`'));
  assert.ok(commit.args[2].includes('&&'));
  assert.ok(commit.args[2].includes('\n'));
  assert.ok(!ctx.invocations.some((call) => call.args.includes('--global')));
  assert.ok(!ctx.invocations.some((call) => call.args.includes('--force')));
  assert.ok(!ctx.invocations.some((call) => call.args.includes('Product Engineer')));
  assert.strictEqual(
    ctx.messages.find((item) => item.type === 'localCommitSuccess').hash,
    'abc123'
  );
  assert.match(ctx.info.map((line) => line).join('\n'), /No Git remote/);
});

test('commitLocal reports nothing to commit and does not run git commit', async () => {
  const ctx = createContext({
    runResult: gitRunner({ branch: git.ticketBranchName('T-1', 'Ship it'), status: '' }),
  });
  await routeMessage({ type: 'commitLocal', ticketId: 'T-1', title: 'Ship it' }, ctx);
  assert.ok(!ctx.invocations.some((call) => call.args[0] === 'commit'));
  assert.match(ctx.info.join('\n'), /Nothing to commit/);
  assert.ok(!ctx.messages.some((item) => item.type === 'localCommitSuccess'));
});

test('initLocalGit only runs git init and never writes user.name', async () => {
  const blocked = createContext({ root: null, lang: 'es' });
  await routeMessage({ type: 'initLocalGit' }, blocked);
  assert.strictEqual(blocked.invocations.length, 0);
  assert.match(blocked.warnings[0], /carpeta de trabajo/);

  const ctx = createContext({
    runResult(file, args) {
      if (args[0] === 'config') return { ok: false, stdout: '', stderr: '' };
      if (args[0] === 'rev-parse') return { ok: true, stdout: 'true\n', stderr: '' };
      if (args[0] === 'branch') return { ok: true, stdout: 'main\n', stderr: '' };
      if (args[0] === 'status') return { ok: true, stdout: '', stderr: '' };
      if (args[0] === 'rev-list') return { ok: false, stdout: '', stderr: 'no commits' };
      return { ok: true, stdout: '', stderr: '' };
    },
  });
  await routeMessage({ type: 'initLocalGit' }, ctx);
  assert.deepStrictEqual(ctx.invocations[0], {
    file: 'git',
    args: ['init'],
    options: { cwd: '/repo' },
  });
  assert.ok(
    !ctx.invocations.some(
      (call) =>
        call.args.includes('user.name') &&
        call.args.includes('--local') === false &&
        call.args[1] !== '--get'
    )
  );
  assert.ok(!ctx.invocations.some((call) => call.args.includes('Product Engineer')));
  assert.match(ctx.info.join('\n'), /initialized/i);
});

test('a missing git identity is set only after an explicit opt-in', async () => {
  const branch = git.ticketBranchName('T-1', 'Ship it');
  const ctx = createContext({
    warningResponses: [text('en', 'commitConfirm'), text('en', 'setRepoIdentity')],
    inputResponses: ['Ada Lovelace', 'ada@example.com'],
    runResult: gitRunner({ branch, identity: false, remote: '' }),
  });
  await routeMessage({ type: 'commitLocal', ticketId: 'T-1', title: 'Ship it' }, ctx);
  assert.deepStrictEqual(
    ctx.invocations.find((call) => call.args[1] === '--local' && call.args[2] === 'user.name').args,
    ['config', '--local', 'user.name', 'Ada Lovelace']
  );
  assert.deepStrictEqual(
    ctx.invocations.find((call) => call.args[1] === '--local' && call.args[2] === 'user.email')
      .args,
    ['config', '--local', 'user.email', 'ada@example.com']
  );
  assert.ok(!ctx.invocations.some((call) => call.args.includes('--global')));
});

test('prepareTicketBranch creates feat/<id>-<slug> from the default branch', async () => {
  const ctx = createContext({
    runResult: gitRunner({ branch: 'main', status: '' }),
  });
  await routeMessage(
    { type: 'prepareTicketBranch', ticketId: 'PAY-101', title: 'Pay button' },
    ctx
  );
  const created = ctx.invocations.find((call) => call.args[0] === 'switch');
  assert.deepStrictEqual(created.args, ['switch', '-c', 'feat/PAY-101-pay-button', 'main']);
  assert.match(ctx.info.join('\n'), /feat\/PAY-101-pay-button/);
});

test('prepareTicketBranch does not switch or discard work when the user cancels', async () => {
  const ctx = createContext({
    warningResponse: undefined,
    runResult: gitRunner({ branch: 'main', status: ' M dirty.js\n' }),
  });
  await routeMessage({ type: 'prepareTicketBranch', ticketId: 'T-1', title: 'Ship it' }, ctx);
  assert.ok(!ctx.invocations.some((call) => call.args[0] === 'switch'));
  assert.ok(!ctx.invocations.some((call) => call.args[0] === 'stash'));
  assert.ok(!ctx.invocations.some((call) => call.args[0] === 'reset'));
  assert.match(ctx.info.join('\n'), /No files were discarded/);
});

test('push uses upstream and surfaces a rejection without force', async () => {
  const branch = git.ticketBranchName('T-1', 'Ship it');
  const ctx = createContext({
    warningResponse: text('en', 'commitConfirm'),
    runResult: gitRunner({ branch, remote: 'origin\n', pushOk: false }),
  });
  await routeMessage({ type: 'commitLocal', ticketId: 'T-1', title: 'Ship it' }, ctx);
  const pushed = ctx.invocations.find((call) => call.args[0] === 'push');
  assert.deepStrictEqual(pushed.args, ['push', '--set-upstream', 'origin', branch]);
  assert.match(ctx.errors.join('\n'), /Authentication failed/);
  assert.strictEqual(
    ctx.messages.some((item) => item.type === 'localCommitSuccess'),
    true
  );
});

test('docker launch and stop use argument arrays and reject hostile ids', async () => {
  const ctx = createContext({ runResult: gitRunner() });
  await routeMessage({ type: 'launchDockerService', service: 'redis' }, ctx);
  await flush();
  assert.deepStrictEqual(ctx.invocations[0].args, docker.LAUNCH_ARGS.redis.run);
  assert.strictEqual(ctx.invocations[0].file, 'docker');
  assert.match(ctx.info[0], /Service started successfully/);
  assert.strictEqual(ctx.messages[0].type, 'dockerInfo');

  const unknown = createContext();
  await routeMessage({ type: 'launchDockerService', service: 'mongo; rm -rf /' }, unknown);
  assert.strictEqual(unknown.invocations.length, 0);

  const hostileStop = createContext();
  await routeMessage({ type: 'stopDockerContainer', containerId: hostile }, hostileStop);
  assert.strictEqual(hostileStop.invocations.length, 0);
  assert.match(hostileStop.errors[0], /rejected/);

  const stop = createContext({ runResult: gitRunner() });
  await routeMessage({ type: 'stopDockerContainer', containerId: '0123456789abcdef' }, stop);
  assert.deepStrictEqual(stop.invocations[0], {
    file: 'docker',
    args: ['stop', '0123456789abcdef'],
    options: undefined,
  });
  assert.match(stop.info[0], /Container stopped/);
});

test('installDocker sends the platform lines and non-mac skips the daemon', async () => {
  const mac = createContext({ platform: 'darwin' });
  await routeMessage({ type: 'installDocker' }, mac);
  assert.deepStrictEqual(mac.terminals[0].lines, docker.dockerInstallLines('darwin'));
  assert.strictEqual(mac.terminals[0].name, 'Product Studio: Setup');

  const linux = createContext({ platform: 'linux' });
  await routeMessage({ type: 'startDockerDaemon' }, linux);
  assert.strictEqual(linux.invocations.length, 0);
  await routeMessage({ type: 'startDockerDaemon' }, mac);
  assert.deepStrictEqual(mac.invocations[0].args, docker.OPEN_DOCKER_DESKTOP_ARGS);
  assert.strictEqual(mac.invocations[0].file, 'open');
});

test('confirmDelete posts only after the modal is accepted', async () => {
  const accepted = createContext({ warningResponse: 'Delete' });
  await routeMessage({ type: 'confirmDelete', ticketId: 'PROJ-9' }, accepted);
  assert.match(accepted.warnings[0], /Delete task PROJ-9/);
  assert.deepStrictEqual(accepted.messages[0], { type: 'deleteConfirmed', ticketId: 'PROJ-9' });

  const declined = createContext({ lang: 'es', warningResponse: undefined });
  await routeMessage({ type: 'confirmDeleteEpic', epicId: 'EPIC-2' }, declined);
  assert.match(declined.warnings[0], /Eliminar epica EPIC-2/);
  assert.strictEqual(declined.messages.length, 0);
});

test('changeLang reloads with the requested language and drops the open ticket', async () => {
  const ctx = createContext();
  await routeMessage({ type: 'changeLang', lang: 'es' }, ctx);
  assert.deepStrictEqual(ctx.calls[0], ['lang', 'es']);
  assert.deepStrictEqual(ctx.reloads[0], { lang: 'es', initialTicket: null });
});

test('copyPrompt writes the clipboard and opens chat; terminal tests use the old command', async () => {
  const ctx = createContext({ activeAi: 'Continue' });
  await routeMessage({ type: 'copyPrompt', text: 'full prompt' }, ctx);
  assert.deepStrictEqual(ctx.calls[0], ['clip', 'full prompt']);
  assert.deepStrictEqual(ctx.calls[1], ['ai', 'full prompt', 'en', 'Continue']);

  await routeMessage({ type: 'runTerminalTests' }, ctx);
  assert.strictEqual(ctx.terminals[0].lines[0], TERMINAL_TEST_COMMAND);
  assert.strictEqual(ctx.terminals[0].shown, true);
});

test('save, check docker, external errors, and uiReady stay wired', async () => {
  const ctx = createContext({
    runResult(file, args) {
      if (file === 'docker' && args[0] === '--version') {
        return { ok: false, stdout: '', stderr: 'missing' };
      }
      return { ok: true, stdout: '', stderr: '' };
    },
    openError: new Error('bad url'),
  });
  await routeMessage({ type: 'saveTasks', tasks: { a: 1 } }, ctx);
  await routeMessage({ type: 'saveEpics', epics: { b: 2 } }, ctx);
  assert.deepStrictEqual(ctx.stored.tasks, { a: 1 });
  assert.deepStrictEqual(ctx.stored.epics, { b: 2 });

  await routeMessage({ type: 'checkDocker' }, ctx);
  assert.deepStrictEqual(ctx.messages[0], {
    type: 'dockerInfo',
    status: { installed: false, running: false, version: '' },
    containers: [],
  });

  await routeMessage({ type: 'openExternal', url: 'https://example.com' }, ctx);
  assert.strictEqual(ctx.errors[0], 'Error opening URL: bad url');

  await routeMessage({ type: 'uiReady' }, ctx);
  assert.strictEqual(ctx.uiReady, true);

  await routeMessage({ type: 'not-a-message' }, ctx);
  assert.strictEqual(ctx.uiReady, true);
});
