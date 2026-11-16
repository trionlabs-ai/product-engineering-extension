const assert = require('assert');
const test = require('node:test');
const git = require('../../src/host/gitService');

test('formatCommitMessage builds feat(ticket): title and defaults the title', () => {
  assert.strictEqual(
    git.formatCommitMessage('PROJ-12', 'Add pay button'),
    'feat(PROJ-12): Add pay button'
  );
  assert.strictEqual(git.formatCommitMessage('LOCAL-3', ''), 'feat(LOCAL-3): complete task');
  assert.strictEqual(git.formatCommitMessage('LOCAL-3'), 'feat(LOCAL-3): complete task');
});

test('init command still overwrites the repository git identity', () => {
  const command = git.buildInitRepositoryCommand();
  assert.match(command, /^git init && /);
  assert.match(command, /git config user\.name "Product Engineer"/);
  assert.match(command, /git config user\.email "engineer@local"/);
  assert.match(command, /git commit -m "chore: initial commit"$/);
});

test('local commit command still interpolates the message without escaping quotes', () => {
  const message = git.formatCommitMessage('T-9', 'say "hello" && touch /tmp/pwned');
  const command = git.buildLocalCommitCommand(message);
  assert.match(command, /git config user\.name "Product Engineer"/);
  assert.match(command, /git config user\.email "engineer@local"/);
  assert.ok(
    command.endsWith('git commit -m "feat(T-9): say "hello" && touch /tmp/pwned"'),
    command
  );
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
  assert.strictEqual(
    git.interpretGitProbe('/work', {
      inside: true,
      branchErr: new Error('no'),
      branchStdout: '',
      statusErr: null,
      statusStdout: '   \n',
      countErr: new Error('no head'),
      countStdout: '',
    }).branch,
    'main'
  );
});

test('getLocalGitStatus runs the isolated git commands', async () => {
  const calls = [];
  const exec = (cmd, options, cb) => {
    calls.push(cmd);
    if (cmd === git.commands.isInsideWorkTree) cb(null, 'true\n');
    else if (cmd === git.commands.currentBranch) cb(null, 'main\n');
    else if (cmd === git.commands.statusPorcelain) cb(null, '');
    else if (cmd === git.commands.revListCountHead) cb(null, '2\n');
    else cb(new Error('unexpected ' + cmd));
    assert.strictEqual(options.cwd, '/work');
  };
  const status = await git.getLocalGitStatus(exec, '/work');
  assert.deepStrictEqual(calls, [
    git.commands.isInsideWorkTree,
    git.commands.currentBranch,
    git.commands.statusPorcelain,
    git.commands.revListCountHead,
  ]);
  assert.deepStrictEqual(status, {
    hasGit: true,
    branch: 'main',
    hasChanges: false,
    commits: 2,
    rootPath: '/work',
  });
  const missing = await git.getLocalGitStatus(exec, null);
  assert.strictEqual(missing.hasGit, false);
  assert.strictEqual(missing.rootPath, null);
});
