const assert = require('assert');
const test = require('node:test');
const docker = require('../../src/host/dockerService');

test('launch commands keep the previous container names and ports', () => {
  assert.match(docker.buildLaunchCommand('postgres'), /--name ps-postgres/);
  assert.match(docker.buildLaunchCommand('postgres'), /-p 5432:5432/);
  assert.match(docker.buildLaunchCommand('mysql'), /--name ps-mysql/);
  assert.match(docker.buildLaunchCommand('mysql'), /-p 3306:3306/);
  assert.match(docker.buildLaunchCommand('redis'), /--name ps-redis/);
  assert.match(docker.buildLaunchCommand('redis'), /-p 6379:6379/);
  assert.strictEqual(docker.buildLaunchCommand('compose'), 'docker compose up -d');
  assert.strictEqual(docker.buildLaunchCommand('other'), '');
});

test('stop command interpolates the container id', () => {
  assert.strictEqual(docker.buildStopCommand('abc123'), 'docker stop abc123');
});

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
  const exec = (cmd, cb) => {
    calls.push(cmd);
    cb(new Error('not found'), '');
  };
  const status = await docker.getDockerStatus(exec);
  assert.deepStrictEqual(status, { installed: false, running: false, version: '' });
  assert.deepStrictEqual(calls, [docker.commands.version]);
});

test('getDockerStatus reports a stopped daemon', async () => {
  const exec = (cmd, cb) => {
    if (cmd === docker.commands.version) cb(null, 'Docker version 27.0.0\n');
    else cb(new Error('cannot connect'));
  };
  const status = await docker.getDockerStatus(exec);
  assert.deepStrictEqual(status, {
    installed: true,
    running: false,
    version: 'Docker version 27.0.0',
  });
});

test('getDockerContainers parses ps output', async () => {
  const exec = (cmd, cb) => {
    assert.strictEqual(cmd, docker.commands.ps);
    cb(null, 'id1|name|image|Up|80/tcp\n');
  };
  const list = await docker.getDockerContainers(exec);
  assert.strictEqual(list[0].name, 'name');
  assert.strictEqual(list[0].status, 'Up');
});
