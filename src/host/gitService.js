/**
 * Git command construction for Product Studio.
 *
 * Two behaviors are intentionally unchanged so a later change can fix them
 * in this module only:
 *
 * 1. Command injection. buildLocalCommitCommand() interpolates the commit
 *    message into a double-quoted shell string. The quote replace is a no-op
 *    (`\"` inside a template literal is just `"`), so a title containing
 *    quotes or shell metacharacters can change the command that runs.
 * 2. Identity overwrite. Init and commit commands run `git config user.name`
 *    and `git config user.email`, which rewrites the repository-local Git
 *    identity on every init and every local commit.
 */

const commands = {
  isInsideWorkTree: 'git rev-parse --is-inside-work-tree',
  currentBranch: 'git branch --show-current',
  statusPorcelain: 'git status --porcelain',
  revListCountHead: 'git rev-list --count HEAD',
  shortHead: 'git rev-parse --short HEAD',
};

function formatCommitMessage(ticketId, title) {
  const taskTitle = title || 'complete task';
  return `feat(${ticketId}): ${taskTitle}`;
}

function buildInitRepositoryCommand() {
  return 'git init && git config user.name "Product Engineer" && git config user.email "engineer@local" && git add -A && git commit -m "chore: initial commit"';
}

function buildLocalCommitCommand(commitMsgText) {
  // Preserves the previous no-op quote "escape": `\"` in a single-quoted
  // string is just `"`, so quotes in the title stay inside the shell string.
  const escaped = commitMsgText.replace(/"/g, '"');
  return `git config user.name "Product Engineer" && git config user.email "engineer@local" && git add -A && git commit -m "${escaped}"`;
}

function emptyGitStatus(rootPath) {
  return {
    hasGit: false,
    branch: '',
    hasChanges: false,
    commits: 0,
    rootPath: rootPath || null,
  };
}

function interpretGitProbe(rootPath, probe) {
  if (!rootPath) return emptyGitStatus(null);
  if (!probe || !probe.inside) return emptyGitStatus(rootPath);

  const branchStdout = probe.branchStdout;
  const branch = probe.branchErr || !branchStdout.trim() ? 'main' : branchStdout.trim();
  const statusStdout = probe.statusStdout;
  const hasChanges = !probe.statusErr && !!statusStdout && statusStdout.trim().length > 0;
  const commits = probe.countErr ? 0 : parseInt((probe.countStdout || '').trim(), 10) || 0;

  return {
    hasGit: true,
    branch,
    hasChanges,
    commits,
    rootPath,
  };
}

function getLocalGitStatus(exec, cwd) {
  return new Promise((resolve) => {
    if (!cwd) {
      resolve(interpretGitProbe(null, {}));
      return;
    }
    exec(commands.isInsideWorkTree, { cwd }, (err, stdout) => {
      if (err || !stdout || !stdout.trim().includes('true')) {
        resolve(interpretGitProbe(cwd, { inside: false }));
        return;
      }
      exec(commands.currentBranch, { cwd }, (branchErr, branchStdout) => {
        exec(commands.statusPorcelain, { cwd }, (statusErr, statusStdout) => {
          exec(commands.revListCountHead, { cwd }, (countErr, countStdout) => {
            resolve(
              interpretGitProbe(cwd, {
                inside: true,
                branchErr,
                branchStdout,
                statusErr,
                statusStdout,
                countErr,
                countStdout,
              })
            );
          });
        });
      });
    });
  });
}

module.exports = {
  commands,
  formatCommitMessage,
  buildInitRepositoryCommand,
  buildLocalCommitCommand,
  emptyGitStatus,
  interpretGitProbe,
  getLocalGitStatus,
};
