const git = require('./gitService');
const { text } = require('./text');

function gitRun(ctx, cwd) {
  return (args) => ctx.runFile('git', args, { cwd });
}

async function ensureIdentity(ctx, cwd, lang) {
  const identity = await git.readIdentity(ctx.runFile, cwd);
  if (identity.name && identity.email) return true;

  const setLabel = text(lang, 'setRepoIdentity');
  const choice = await ctx.showWarningMessage(
    text(lang, 'missingGitIdentity'),
    { modal: true },
    setLabel
  );
  if (choice !== setLabel) {
    ctx.showInformationMessage(text(lang, 'gitIdentityHowTo'));
    return false;
  }

  const name = await ctx.showInputBox({
    prompt: text(lang, 'gitNamePrompt'),
    ignoreFocusOut: true,
  });
  if (!git.isIdentityValue(name)) {
    ctx.showWarningMessage(text(lang, 'gitIdentityCancelled'));
    return false;
  }
  const email = await ctx.showInputBox({
    prompt: text(lang, 'gitEmailPrompt'),
    ignoreFocusOut: true,
  });
  if (!git.isEmail(email)) {
    ctx.showWarningMessage(text(lang, 'gitIdentityCancelled'));
    return false;
  }

  const run = gitRun(ctx, cwd);
  const nameResult = await run(['config', '--local', 'user.name', name]);
  const emailResult = await run(['config', '--local', 'user.email', email]);
  if (!nameResult.ok || !emailResult.ok) {
    ctx.showErrorMessage(
      text(lang, 'gitError', { error: git.clip(nameResult.stderr || emailResult.stderr) })
    );
    return false;
  }
  ctx.showInformationMessage(text(lang, 'gitIdentitySaved'));
  return true;
}

async function publishStatus(ctx, cwd) {
  const status = await git.getLocalGitStatus(ctx.runFile, cwd);
  ctx.postMessage({ type: 'localGitInfo', ...status });
  return status;
}

async function commitWithMessage(ctx, cwd, lang, message) {
  const run = gitRun(ctx, cwd);
  const added = await run(git.addAllArgs());
  if (!added.ok) {
    ctx.showErrorMessage(text(lang, 'gitError', { error: git.clip(added.stderr) }));
    return false;
  }
  const committed = await run(git.commitArgs(message));
  if (!committed.ok) {
    ctx.showErrorMessage(
      text(lang, 'gitError', { error: git.clip(committed.stderr || committed.stdout) })
    );
    return false;
  }
  return true;
}

async function confirmAndCommit(ctx, cwd, lang, message) {
  const run = gitRun(ctx, cwd);
  const status = await run(['status', '--porcelain']);
  if (!status.ok) {
    ctx.showErrorMessage(text(lang, 'gitError', { error: git.clip(status.stderr) }));
    return false;
  }
  const files = git.parseStatusPaths(status.stdout);
  if (files.length === 0) {
    ctx.showInformationMessage(text(lang, 'nothingToCommit'));
    return false;
  }
  const confirm = text(lang, 'commitConfirm');
  const cancel = text(lang, 'cancel');
  const choice = await ctx.showWarningMessage(
    text(lang, 'commitFileList', { n: String(files.length), files: git.formatFileList(files) }),
    { modal: true },
    confirm,
    cancel
  );
  if (choice !== confirm) {
    ctx.showInformationMessage(text(lang, 'commitCancelled'));
    return false;
  }
  const identityOk = await ensureIdentity(ctx, cwd, lang);
  if (!identityOk) return false;
  return commitWithMessage(ctx, cwd, lang, message);
}

async function prepareTicketBranch(ctx, { ticketId, title, lang }) {
  const cwd = ctx.getWorkspaceRoot();
  if (!cwd) {
    ctx.showWarningMessage(text(lang, 'noWorkspaceBranch'));
    return { ok: false, reason: 'no-workspace' };
  }
  if (!git.isTicketId(ticketId)) {
    ctx.showErrorMessage(text(lang, 'invalidTicketId'));
    return { ok: false, reason: 'bad-ticket' };
  }

  const safeTitle = git.isCommitTitle(title) ? title : 'task';
  const branch = git.ticketBranchName(ticketId, safeTitle);
  const run = gitRun(ctx, cwd);
  const inside = await run(['rev-parse', '--is-inside-work-tree']);
  if (!inside.ok || !inside.stdout.includes('true')) {
    ctx.showInformationMessage(text(lang, 'noGitRepo'));
    return { ok: false, reason: 'no-git' };
  }

  const current = await run(['branch', '--show-current']);
  const currentName = current.ok ? current.stdout.trim() : '';
  if (currentName === branch) {
    await publishStatus(ctx, cwd);
    return { ok: true, branch, switched: false };
  }

  const status = await run(['status', '--porcelain']);
  if (!status.ok) {
    ctx.showErrorMessage(text(lang, 'gitError', { error: git.clip(status.stderr) }));
    return { ok: false, reason: 'status' };
  }
  let popStash = false;
  if (status.stdout.trim()) {
    const commitLabel = text(lang, 'commitChanges');
    const stashLabel = text(lang, 'stashChanges');
    const cancel = text(lang, 'cancel');
    const choice = await ctx.showWarningMessage(
      text(lang, 'dirtyWorktree', { branch }),
      { modal: true },
      commitLabel,
      stashLabel,
      cancel
    );
    if (choice === commitLabel) {
      const typed = await askCommitMessage(ctx, lang, text(lang, 'dirtyCommitDefault'));
      if (!typed) {
        ctx.showInformationMessage(text(lang, 'commitCancelled'));
        return { ok: false, reason: 'dirty-commit' };
      }
      const saved = await confirmAndCommit(ctx, cwd, lang, typed);
      if (!saved) return { ok: false, reason: 'dirty-commit' };
    } else if (choice === stashLabel) {
      const stashed = await run(['stash', 'push', '-u', '-m', `Product Studio: before ${branch}`]);
      if (!stashed.ok) {
        ctx.showErrorMessage(text(lang, 'gitError', { error: git.clip(stashed.stderr) }));
        return { ok: false, reason: 'stash' };
      }
      popStash = true;
    } else {
      ctx.showInformationMessage(text(lang, 'branchCancelled', { branch: currentName || branch }));
      return { ok: false, reason: 'cancelled' };
    }
  }

  const head = await run(['rev-parse', '--verify', 'HEAD']);
  if (!head.ok) {
    const named = await run(['symbolic-ref', 'HEAD', `refs/heads/${branch}`]);
    if (!named.ok) {
      ctx.showErrorMessage(text(lang, 'gitError', { error: git.clip(named.stderr) }));
      return { ok: false, reason: 'branch' };
    }
  } else {
    const exists = await run(['show-ref', '--verify', '--quiet', `refs/heads/${branch}`]);
    const switched = exists.ok
      ? await run(['switch', branch])
      : await run(['switch', '-c', branch, await git.detectDefaultBranch(run)]);
    if (!switched.ok) {
      ctx.showErrorMessage(text(lang, 'gitError', { error: git.clip(switched.stderr) }));
      return { ok: false, reason: 'switch' };
    }
  }

  if (popStash) {
    const popped = await run(['stash', 'pop']);
    if (!popped.ok) {
      ctx.showErrorMessage(text(lang, 'stashPopFailed', { error: git.clip(popped.stderr) }));
    }
  }

  ctx.showInformationMessage(text(lang, 'branchReady', { branch }));
  await publishStatus(ctx, cwd);
  return { ok: true, branch, switched: true };
}

async function askCommitMessage(ctx, lang, fallback) {
  const typed = await ctx.showInputBox({
    prompt: text(lang, 'dirtyCommitPrompt'),
    value: fallback,
    ignoreFocusOut: true,
  });
  if (!git.isCommitTitle(typed)) return '';
  return typed;
}

async function pushBranch(ctx, cwd, branch, hash, lang) {
  const remotes = await ctx.runFile('git', ['remote'], { cwd });
  if (!remotes.ok) {
    ctx.showErrorMessage(text(lang, 'gitError', { error: git.clip(remotes.stderr) }));
    return;
  }
  const names = remotes.stdout
    .split('\n')
    .map((name) => name.trim())
    .filter(Boolean);
  if (names.length === 0) {
    ctx.showInformationMessage(text(lang, 'commitNoRemote', { hash, branch }));
    return;
  }
  const remote = names.includes('origin') ? 'origin' : names[0];
  const pushed = await ctx.runFile('git', git.pushArgs(remote, branch), { cwd });
  if (!pushed.ok) {
    ctx.showErrorMessage(
      text(lang, 'pushFailed', { hash, error: git.clip(pushed.stderr || pushed.stdout) })
    );
    return;
  }
  ctx.showInformationMessage(text(lang, 'commitPushed', { hash, branch, remote }));
}

async function initRepository(ctx, lang) {
  const cwd = ctx.getWorkspaceRoot();
  if (!cwd) {
    ctx.showWarningMessage(
      lang === 'es'
        ? 'Abre una carpeta de trabajo en VS Code primero.'
        : 'Open a workspace folder in VS Code first.'
    );
    return;
  }
  const created = await ctx.runFile('git', ['init'], { cwd });
  if (!created.ok) {
    ctx.showErrorMessage(text(lang, 'gitError', { error: git.clip(created.stderr) }));
    return;
  }
  const identity = await git.readIdentity(ctx.runFile, cwd);
  ctx.showInformationMessage(
    text(lang, identity.name && identity.email ? 'gitInitOk' : 'gitInitOkNoIdentity')
  );
  await publishStatus(ctx, cwd);
}

async function commitTicket(ctx, { ticketId, title, lang }) {
  const cwd = ctx.getWorkspaceRoot();
  if (!cwd) {
    ctx.showWarningMessage(text(lang, 'noWorkspaceCommit'));
    return { ok: false, reason: 'no-workspace' };
  }
  if (!git.isTicketId(ticketId)) {
    ctx.showErrorMessage(text(lang, 'invalidTicketId'));
    return { ok: false, reason: 'bad-ticket' };
  }
  if (!git.isCommitTitle(title)) {
    ctx.showErrorMessage(text(lang, 'invalidTitle'));
    return { ok: false, reason: 'bad-title' };
  }

  const inside = await ctx.runFile('git', ['rev-parse', '--is-inside-work-tree'], { cwd });
  if (!inside.ok || !inside.stdout.includes('true')) {
    ctx.showWarningMessage(text(lang, 'noGitRepo'));
    return { ok: false, reason: 'no-git' };
  }

  const prepared = await prepareTicketBranch(ctx, { ticketId, title, lang });
  if (!prepared.ok) return prepared;

  const message = git.formatCommitMessage(ticketId, title);
  const saved = await confirmAndCommit(ctx, cwd, lang, message);
  if (!saved) return { ok: false, reason: 'commit' };

  const hash = await ctx.runFile('git', ['rev-parse', '--short', 'HEAD'], { cwd });
  const branch = await ctx.runFile('git', ['branch', '--show-current'], { cwd });
  if (!hash.ok || !hash.stdout.trim()) {
    ctx.showErrorMessage(text(lang, 'gitError', { error: git.clip(hash.stderr) }));
    return { ok: false, reason: 'hash' };
  }
  const commitHash = hash.stdout.trim();
  const branchName = branch.ok && branch.stdout.trim() ? branch.stdout.trim() : prepared.branch;
  ctx.postMessage({
    type: 'localCommitSuccess',
    ticketId,
    hash: commitHash,
    branch: branchName,
  });
  await pushBranch(ctx, cwd, branchName, commitHash, lang);
  return { ok: true, hash: commitHash, branch: branchName };
}

module.exports = {
  ensureIdentity,
  prepareTicketBranch,
  initRepository,
  commitTicket,
};
