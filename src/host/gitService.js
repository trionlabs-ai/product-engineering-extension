const TICKET_ID = /^[A-Za-z][A-Za-z0-9]{0,15}-\d{1,6}$/;

function isTicketId(id) {
  return typeof id === 'string' && TICKET_ID.test(id);
}

function isCommitTitle(title) {
  return (
    typeof title === 'string' && title.length > 0 && title.length <= 2000 && !title.includes('\0')
  );
}

function isIdentityValue(value) {
  return (
    typeof value === 'string' &&
    value.length > 0 &&
    value.length <= 200 &&
    !value.includes('\0') &&
    !value.includes('\n') &&
    !value.includes('\r') &&
    !value.startsWith('-')
  );
}

function isEmail(value) {
  return isIdentityValue(value) && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function slugify(title) {
  const base = String(title || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
  return base || 'task';
}

function ticketBranchName(ticketId, title) {
  return `feat/${ticketId}-${slugify(title)}`;
}

function formatCommitMessage(ticketId, title) {
  const taskTitle = title || 'complete task';
  return `feat(${ticketId}): ${taskTitle}`;
}

function commitArgs(message) {
  return ['commit', '-m', message];
}

function addAllArgs() {
  return ['add', '-A'];
}

function pushArgs(remote, branch) {
  return ['push', '--set-upstream', remote, branch];
}

function parseStatusPaths(stdout) {
  return String(stdout || '')
    .split('\n')
    .filter(Boolean)
    .map((line) => {
      const body = line.slice(3);
      const parts = body.split(' -> ');
      return parts[parts.length - 1];
    });
}

function formatFileList(files) {
  const shown = files.slice(0, 12);
  const extra = files.length - shown.length;
  return shown.join('\n') + (extra > 0 ? `\n+${extra}` : '');
}

function clip(text) {
  const value = String(text || '')
    .replace(/\0/g, '')
    .trim();
  if (!value) return 'unknown git error';
  if (value.length <= 500) return value;
  return value.slice(0, 500) + '...';
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

  const branchStdout = probe.branchStdout || '';
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

async function getLocalGitStatus(runFile, cwd) {
  if (!cwd) return interpretGitProbe(null, {});
  const run = (args) => runFile('git', args, { cwd });
  const inside = await run(['rev-parse', '--is-inside-work-tree']);
  if (!inside.ok || !inside.stdout.trim().includes('true')) {
    return interpretGitProbe(cwd, { inside: false });
  }
  const branch = await run(['branch', '--show-current']);
  const status = await run(['status', '--porcelain']);
  const count = await run(['rev-list', '--count', 'HEAD']);
  return interpretGitProbe(cwd, {
    inside: true,
    branchErr: branch.ok ? null : branch.error || new Error('branch'),
    branchStdout: branch.stdout,
    statusErr: status.ok ? null : status.error || new Error('status'),
    statusStdout: status.stdout,
    countErr: count.ok ? null : count.error || new Error('count'),
    countStdout: count.stdout,
  });
}

async function readIdentity(runFile, cwd) {
  const name = await runFile('git', ['config', '--get', 'user.name'], { cwd });
  const email = await runFile('git', ['config', '--get', 'user.email'], { cwd });
  return {
    name: name.ok ? name.stdout.trim() : '',
    email: email.ok ? email.stdout.trim() : '',
  };
}

async function detectDefaultBranch(run) {
  const originHead = await run(['symbolic-ref', '--short', 'refs/remotes/origin/HEAD']);
  if (originHead.ok) {
    const name = originHead.stdout.trim().replace(/^origin\//, '');
    if (name) return name;
  }
  for (const candidate of ['main', 'master']) {
    const exists = await run(['show-ref', '--verify', '--quiet', `refs/heads/${candidate}`]);
    if (exists.ok) return candidate;
  }
  const current = await run(['branch', '--show-current']);
  const name = current.ok ? current.stdout.trim() : '';
  return name || 'main';
}

module.exports = {
  isTicketId,
  isCommitTitle,
  isIdentityValue,
  isEmail,
  slugify,
  ticketBranchName,
  formatCommitMessage,
  commitArgs,
  addAllArgs,
  pushArgs,
  parseStatusPaths,
  formatFileList,
  clip,
  emptyGitStatus,
  interpretGitProbe,
  getLocalGitStatus,
  readIdentity,
  detectDefaultBranch,
};
