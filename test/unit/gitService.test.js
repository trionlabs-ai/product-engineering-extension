const assert = require('assert');
const test = require('node:test');
const git = require('../../src/host/gitService');

const hostile = 'say "hello" $(whoami) `id` ; rm -rf / && echo\nnext';

test('formatCommitMessage keeps the title literal, including shell metacharacters', () => {
  assert.strictEqual(
    git.formatCommitMessage('PROJ-12', 'Add pay button'),
    'feat(PROJ-12): Add pay button'
  );
  assert.strictEqual(git.formatCommitMessage('T-9', hostile), `feat(T-9): ${hostile}`);
});

test('commit, add, and push argv never build a shell string', () => {
  const message = git.formatCommitMessage('T-9', hostile);
  assert.deepStrictEqual(git.commitArgs(message), ['commit', '-m', message]);
  assert.deepStrictEqual(git.addAllArgs(), ['add', '-A']);
  assert.deepStrictEqual(git.pushArgs('origin', 'feat/T-9-task'), [
    'push',
    '--set-upstream',
    'origin',
    'feat/T-9-task',
  ]);
  assert.ok(!git.pushArgs('origin', 'feat/T-9-task').includes('--force'));
  assert.ok(!git.pushArgs('origin', 'feat/T-9-task').includes('-f'));
});

test('ticket ids are validated and branch names drop shell characters from the title', () => {
  assert.strictEqual(git.isTicketId('LOCAL-4'), true);
  assert.strictEqual(git.isTicketId('PAY-101'), true);
  assert.strictEqual(git.isTicketId('T-1;touch'), false);
  assert.strictEqual(git.isTicketId('$(whoami)'), false);
  assert.strictEqual(git.isTicketId('T-1 && rm'), false);
  assert.strictEqual(git.isCommitTitle(hostile), true);
  assert.strictEqual(git.isCommitTitle(''), false);
  assert.strictEqual(git.isCommitTitle('ok\0'), false);
  assert.strictEqual(
    git.ticketBranchName('T-9', hostile),
    'feat/T-9-say-hello-whoami-id-rm-rf-echo-next'
  );
});

test('identity values cannot smuggle flags or newlines', () => {
  assert.strictEqual(git.isIdentityValue('Ada Lovelace'), true);
  assert.strictEqual(git.isIdentityValue('--global'), false);
  assert.strictEqual(git.isIdentityValue('Ada\nLovelace'), false);
  assert.strictEqual(git.isEmail('ada@example.com'), true);
  assert.strictEqual(git.isEmail('ada@example.com\n'), false);
  assert.strictEqual(git.isEmail('--global'), false);
});

test('interpretGitProbe matches the previous status rules', () => {
  assert.deepStrictEqual(git.interpretGitProbe(null, {}), {
    hasGit: false,
    branch: '',
    hasChanges: false,
    commits: 0,
    rootPath: null,
  });
  assert.strictEqual(git.interpretGitProbe('/work', { inside: false }).rootPath, '/work');
  assert.deepStrictEqual(
    git.interpretGitProbe('/work', {
      inside: true,
      branchErr: null,
      branchStdout: 'develop\n',
      statusErr: null,
      statusStdout: ' M file.js\n',
      countErr: null,
      countStdout: '4\n',
    }),
    { hasGit: true, branch: 'develop', hasChanges: true, commits: 4, rootPath: '/work' }
  );
});

test('getLocalGitStatus calls git with argument arrays', async () => {
  const calls = [];
  const runFile = (file, args, options) => {
    calls.push({ file, args });
    assert.strictEqual(options.cwd, '/work');
    if (args[0] === 'rev-parse') return Promise.resolve({ ok: true, stdout: 'true\n', stderr: '' });
    if (args[0] === 'branch') return Promise.resolve({ ok: true, stdout: 'main\n', stderr: '' });
    if (args[0] === 'status') return Promise.resolve({ ok: true, stdout: '', stderr: '' });
    if (args[0] === 'rev-list') return Promise.resolve({ ok: true, stdout: '2\n', stderr: '' });
    return Promise.resolve({ ok: false, stdout: '', stderr: 'unexpected' });
  };
  const status = await git.getLocalGitStatus(runFile, '/work');
  assert.deepStrictEqual(
    calls.map((call) => call.args),
    [
      ['rev-parse', '--is-inside-work-tree'],
      ['branch', '--show-current'],
      ['status', '--porcelain'],
      ['rev-list', '--count', 'HEAD'],
    ]
  );
  assert.strictEqual(status.hasGit, true);
  assert.strictEqual(status.commits, 2);
  const missing = await git.getLocalGitStatus(runFile, null);
  assert.strictEqual(missing.rootPath, null);
});
