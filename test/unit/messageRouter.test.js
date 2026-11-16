const assert = require('assert');
const test = require('node:test');
const { routeMessage, TERMINAL_TEST_COMMAND } = require('../../src/host/messageRouter');
const git = require('../../src/host/gitService');
const docker = require('../../src/host/dockerService');
const { createContext, flush } = require('./helpers');

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

test('commitLocal without a workspace records a virtual hash and does not run git', async () => {
  const ctx = createContext({ root: null });
  await routeMessage({ type: 'commitLocal', ticketId: 'LOCAL-4', title: 'Ship it' }, ctx);
  assert.strictEqual(ctx.execs.length, 0);
  assert.strictEqual(ctx.messages[0].type, 'localCommitSuccess');
  assert.strictEqual(ctx.messages[0].branch, 'local');
  assert.match(ctx.messages[0].hash, /^loc-/);
  assert.match(ctx.info[0], /Local commit recorded for LOCAL-4/);
});

test('commitLocal runs the isolated commit command and reports the real hash', async () => {
  const ctx = createContext({
    execResult(cmd) {
      if (cmd === git.commands.shortHead) return { stdout: 'abc123\n' };
      if (cmd === git.commands.currentBranch) return { stdout: 'feature\n' };
      return {};
    },
  });
  await routeMessage({ type: 'commitLocal', ticketId: 'T-1', title: 'say "hello"' }, ctx);
  await flush();
  const expected = git.buildLocalCommitCommand(git.formatCommitMessage('T-1', 'say "hello"'));
  assert.strictEqual(ctx.execs[0].cmd, expected);
  assert.strictEqual(ctx.execs[0].options.cwd, '/repo');
  assert.strictEqual(ctx.messages[0].hash, 'abc123');
  assert.strictEqual(ctx.messages[0].branch, 'feature');
  assert.match(ctx.info[0], /feat\(T-1\): say "hello"/);
});

test('initLocalGit refuses to run without a folder and otherwise uses the init command', async () => {
  const blocked = createContext({ root: null, lang: 'es' });
  await routeMessage({ type: 'initLocalGit' }, blocked);
  assert.strictEqual(blocked.execs.length, 0);
  assert.match(blocked.warnings[0], /carpeta de trabajo/);

  const ctx = createContext({
    execResult(cmd) {
      if (cmd === git.commands.isInsideWorkTree) return { stdout: 'true\n' };
      if (cmd === git.commands.currentBranch) return { stdout: 'main\n' };
      if (cmd === git.commands.revListCountHead) return { stdout: '1\n' };
      return { stdout: '' };
    },
  });
  await routeMessage({ type: 'initLocalGit' }, ctx);
  await flush();
  assert.strictEqual(ctx.execs[0].cmd, git.buildInitRepositoryCommand());
  assert.strictEqual(ctx.messages[0].type, 'localGitInfo');
  assert.strictEqual(ctx.messages[0].hasGit, true);
  assert.match(ctx.info[0], /initialized successfully/);
});

test('docker launch and stop use the command builders', async () => {
  const ctx = createContext({
    execResult(cmd) {
      if (cmd === docker.commands.version) return { stdout: 'Docker version 27\n' };
      if (cmd === docker.commands.ps) return { stdout: '' };
      return {};
    },
  });
  await routeMessage({ type: 'launchDockerService', service: 'redis' }, ctx);
  await flush();
  assert.strictEqual(ctx.execs[0].cmd, docker.buildLaunchCommand('redis'));
  assert.match(ctx.info[0], /Service started successfully/);
  assert.strictEqual(ctx.messages[0].type, 'dockerInfo');

  const unknown = createContext();
  await routeMessage({ type: 'launchDockerService', service: 'mongo' }, unknown);
  assert.strictEqual(unknown.execs.length, 0);

  const stop = createContext({
    execResult(cmd) {
      if (cmd === docker.commands.version) return { stdout: 'Docker version 27\n' };
      return { stdout: '' };
    },
  });
  await routeMessage({ type: 'stopDockerContainer', containerId: 'abc' }, stop);
  await flush();
  assert.strictEqual(stop.execs[0].cmd, 'docker stop abc');
  assert.match(stop.info[0], /Container stopped/);

  const skipped = createContext();
  await routeMessage({ type: 'stopDockerContainer' }, skipped);
  assert.strictEqual(skipped.execs.length, 0);
});

test('installDocker sends the platform lines and non-mac skips the daemon', async () => {
  const mac = createContext({ platform: 'darwin' });
  await routeMessage({ type: 'installDocker' }, mac);
  assert.deepStrictEqual(mac.terminals[0].lines, docker.dockerInstallLines('darwin'));
  assert.strictEqual(mac.terminals[0].name, 'Product Studio: Setup');

  const linux = createContext({ platform: 'linux' });
  await routeMessage({ type: 'startDockerDaemon' }, linux);
  assert.strictEqual(linux.execs.length, 0);
  await routeMessage({ type: 'startDockerDaemon' }, mac);
  assert.strictEqual(mac.execs[0].cmd, docker.OPEN_DOCKER_DESKTOP_COMMAND);
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
    execResult(cmd) {
      if (cmd === docker.commands.version) return { err: new Error('missing') };
      return {};
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
