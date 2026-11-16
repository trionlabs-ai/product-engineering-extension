const assert = require('assert');
const test = require('node:test');
const docker = require('../../src/host/dockerService');

const hostileId = 'abc"; $(whoami) `id` ; rm -rf / && echo';

test('launch specs are argument arrays with the previous image names and ports', () => {
  assert.deepStrictEqual(docker.LAUNCH_ARGS.postgres.run.slice(-3), [
    '-p',
    '5432:5432',
    'postgres:alpine',
  ]);
  assert.ok(docker.LAUNCH_ARGS.postgres.run.includes('--name'));
  assert.ok(docker.LAUNCH_ARGS.postgres.run.includes('ps-postgres'));
  assert.deepStrictEqual(docker.LAUNCH_ARGS.mysql.run.slice(-3), [
    '-p',
    '3306:3306',
    'mysql:latest',
  ]);
  assert.ok(docker.LAUNCH_ARGS.mysql.run.includes('mysql:latest'));
  assert.deepStrictEqual(docker.LAUNCH_ARGS.redis.run.slice(-3), [
    '-p',
    '6379:6379',
    'redis:alpine',
  ]);
  assert.ok(docker.LAUNCH_ARGS.redis.run.includes('redis:alpine'));
  assert.deepStrictEqual(docker.LAUNCH_ARGS.compose.run, ['compose', 'up', '-d']);
  assert.strictEqual(docker.launchSpec('other'), null);
});

test('stop args keep a valid id literal and reject shell fragments', () => {
  const id = '0123456789abcdef';
  assert.deepStrictEqual(docker.stopArgs(id), ['stop', id]);
  assert.strictEqual(docker.isContainerId(id), true);
  assert.strictEqual(docker.isContainerId(hostileId), false);
  assert.strictEqual(docker.isContainerId('abc'), false);
  assert.strictEqual(docker.isContainerId('0123456789abcdef\n'), false);
});

test('launch falls back to docker start without a shell', async () => {
  const calls = [];
  const runFile = (file, args) => {
    calls.push({ file, args });
    if (args[0] === 'run') return Promise.resolve({ ok: false, stdout: '', stderr: 'name in use' });
    return Promise.resolve({ ok: true, stdout: idSafe(args), stderr: '' });
  };
  const result = await docker.launchService(runFile, 'postgres');
  assert.strictEqual(result.ok, true);
  assert.deepStrictEqual(calls[0].args, docker.LAUNCH_ARGS.postgres.run);
  assert.deepStrictEqual(calls[1].args, ['start', 'ps-postgres']);
  assert.strictEqual(calls[0].file, 'docker');
});

function idSafe(args) {
  return args.join('\0');
}

test('parseDockerPs splits the format columns and ignores empty output', () => {
  assert.deepStrictEqual(docker.parseDockerPs(''), []);
  assert.deepStrictEqual(docker.parseDockerPs(null), []);
  assert.deepStrictEqual(
    docker.parseDockerPs('abc|ps-redis|redis:alpine|Up 3 seconds|0.0.0.0:6379->6379/tcp\n'),
    [
      {
        id: 'abc',
        name: 'ps-redis',
        image: 'redis:alpine',
        status: 'Up 3 seconds',
        ports: '0.0.0.0:6379->6379/tcp',
      },
    ]
  );
});

test('install lines stay platform specific', () => {
  assert.strictEqual(docker.dockerInstallLines('darwin').length, 3);
  assert.match(docker.dockerInstallLines('darwin')[1], /Homebrew/);
  assert.deepStrictEqual(docker.dockerInstallLines('linux'), docker.OTHER_INSTALL_LINES);
});

test('getDockerStatus stops after a missing docker binary', async () => {
  const calls = [];
  const runFile = (file, args) => {
    calls.push(args);
    assert.strictEqual(file, 'docker');
    return Promise.resolve({ ok: false, stdout: '', stderr: 'not found' });
  };
  const status = await docker.getDockerStatus(runFile);
  assert.deepStrictEqual(status, { installed: false, running: false, version: '' });
  assert.deepStrictEqual(calls, [['--version']]);
});

test('getDockerStatus reports a stopped daemon', async () => {
  const runFile = (file, args) => {
    if (args[0] === '--version') {
      return Promise.resolve({ ok: true, stdout: 'Docker version 27.0.0\n', stderr: '' });
    }
    return Promise.resolve({ ok: false, stdout: '', stderr: 'cannot connect' });
  };
  const status = await docker.getDockerStatus(runFile);
  assert.deepStrictEqual(status, {
    installed: true,
    running: false,
    version: 'Docker version 27.0.0',
  });
});

test('getDockerContainers parses ps output from an argument array', async () => {
  const runFile = (file, args) => {
    assert.deepStrictEqual(args.slice(0, 3), ['ps', '-a', '--format']);
    return Promise.resolve({
      ok: true,
      stdout: '0123456789ab|name|image|Up|80/tcp\n',
      stderr: '',
    });
  };
  const list = await docker.getDockerContainers(runFile);
  assert.strictEqual(list[0].id, '0123456789ab');
  assert.strictEqual(list[0].status, 'Up');
});

test('stopContainer refuses a hostile id and passes a hex id literally', async () => {
  const calls = [];
  const runFile = (file, args) => {
    calls.push({ file, args });
    return Promise.resolve({ ok: true, stdout: '', stderr: '' });
  };
  const rejected = await docker.stopContainer(runFile, hostileId);
  assert.strictEqual(rejected.reason, 'invalid');
  assert.strictEqual(calls.length, 0);
  const id = '0123456789abcdef';
  const stopped = await docker.stopContainer(runFile, id);
  assert.strictEqual(stopped.ok, true);
  assert.deepStrictEqual(calls[0], { file: 'docker', args: ['stop', id] });
});
