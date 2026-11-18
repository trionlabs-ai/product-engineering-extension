const git = require('./gitService');
const gitWorkflow = require('./gitWorkflow');
const { findWorkspaceClaude } = require('./planProviders');
const { markPlanTask } = require('./planWorkflow');
const { text } = require('./text');

const CLAUDE_EXTENSION_ID = 'anthropic.claude-code';
const CLAUDE_PANEL_URI = 'vscode://anthropic.claude-code/open';
const WORK_TARGETS = ['auto', 'claudePanel', 'claudeTerminal', 'clipboard'];
const BYPASS_FLAGS = [
  '--dangerously-skip-permissions',
  '--permission-mode',
  'bypassPermissions',
  'dontAsk',
  '-p',
  '--print',
];

function localized(value, lang) {
  if (value == null) return '';
  if (typeof value === 'string') return value;
  if (typeof value !== 'object') return '';
  return value[lang] || value.en || value.es || '';
}

function criteriaList(value, lang) {
  const picked = Array.isArray(value)
    ? value
    : value && typeof value === 'object'
      ? value[lang] || value.en || value.es
      : value;
  if (Array.isArray(picked)) return picked.map((item) => String(item)).filter(Boolean);
  return String(picked || '')
    .split('\n')
    .map((item) => item.trim())
    .filter(Boolean);
}

function buildWorkPrompt(task) {
  const criteria = Array.isArray(task.acceptanceCriteria) ? task.acceptanceCriteria : [];
  const lines = [
    'Ticket: ' + (task.ticketId || ''),
    'Title: ' + (task.title || ''),
    'Branch: ' + (task.branch || ''),
  ];
  if (task.epicTitle) {
    lines.push('', 'Epic: ' + task.epicTitle);
    if (task.epicSummary) lines.push(task.epicSummary);
  }
  lines.push('', 'Description:', task.description || '', '', 'Acceptance criteria:');
  if (criteria.length === 0) lines.push('- None listed');
  criteria.forEach((item) => lines.push('- ' + item));
  lines.push(
    '',
    'Implement this task on the branch above. Ask before editing files or running commands.'
  );
  return lines.join('\n');
}

function taskDetails(ctx, ticketId, title, branch) {
  const lang = ctx.getLang();
  const tasks = ctx.state.get('tasks', {}) || {};
  const epics = ctx.state.get('epics', {}) || {};
  const task = tasks[ticketId] || {};
  const epic = epics[task.epicId] || {};
  return {
    ticketId,
    title: localized(task.title, lang) || title || ticketId,
    description: localized(task.desc, lang),
    acceptanceCriteria: criteriaList(task.criteria, lang),
    epicTitle: localized(epic.name, lang),
    epicSummary: localized(epic.summary, lang),
    branch,
  };
}

function normalizeWorkTarget(setting) {
  return WORK_TARGETS.includes(setting) ? setting : 'auto';
}

function selectWorkTarget({ setting, extensionInstalled, claudeBinary }) {
  const choice = normalizeWorkTarget(setting);
  const panel = !!extensionInstalled;
  const terminal = !!claudeBinary;
  if (choice === 'clipboard') return 'clipboard';
  if (choice === 'claudeTerminal') return terminal ? 'claudeTerminal' : 'clipboard';
  if (choice === 'claudePanel') {
    if (panel) return 'claudePanel';
    return terminal ? 'claudeTerminal' : 'clipboard';
  }
  if (panel) return 'claudePanel';
  if (terminal) return 'claudeTerminal';
  return 'clipboard';
}

function assertNoPermissionBypass(args) {
  args.forEach((arg) => {
    if (BYPASS_FLAGS.includes(arg)) {
      throw new Error('Refusing permission-bypass flag.');
    }
  });
}

function buildClaudePanelUri(prompt) {
  return CLAUDE_PANEL_URI + '?prompt=' + encodeURIComponent(String(prompt || ''));
}

function buildClaudeTerminalArgs(prompt) {
  const args = [String(prompt || '')];
  assertNoPermissionBypass(args);
  return args;
}

function quoteShellArg(value, platform) {
  const textValue = String(value == null ? '' : value);
  if (platform === 'win32') return "'" + textValue.replace(/'/g, "''") + "'";
  return "'" + textValue.replace(/'/g, "'\\''") + "'";
}

function buildClaudeTerminalCommand(binary, prompt, platform) {
  const args = buildClaudeTerminalArgs(prompt);
  return [quoteShellArg(binary, platform)]
    .concat(args.map((arg) => quoteShellArg(arg, platform)))
    .join(' ');
}

function markInProgress(ctx, ticketId) {
  const tasks = Object.assign({}, ctx.state.get('tasks', {}) || {});
  if (tasks[ticketId]) {
    tasks[ticketId] = Object.assign({}, tasks[ticketId], {
      status: { es: 'En curso', en: 'In progress' },
      color: 'blue',
    });
    ctx.state.set('tasks', tasks);
  }
  ctx.postMessage({ type: 'planTaskStatus', ticketId, status: 'in_progress' });
}

async function launchWork(ctx, prompt) {
  const lang = ctx.getLang();
  const configured = ctx.getClaudePath ? ctx.getClaudePath() : '';
  const binary = ctx.findClaude ? ctx.findClaude() : findWorkspaceClaude(configured);
  let target = selectWorkTarget({
    setting: ctx.getWorkTarget ? ctx.getWorkTarget() : 'auto',
    extensionInstalled: ctx.hasClaudeExtension ? ctx.hasClaudeExtension() : false,
    claudeBinary: binary,
  });
  if (target === 'claudePanel') {
    const uri = buildClaudePanelUri(prompt);
    const opened = await ctx.openExternal(uri);
    if (opened !== false) {
      ctx.showInformationMessage(text(lang, 'workPanelReady'));
      return { ok: true, target: 'claudePanel', submitted: false };
    }
    target = binary ? 'claudeTerminal' : 'clipboard';
  }
  if (target === 'claudeTerminal' && binary) {
    const command = buildClaudeTerminalCommand(binary, prompt, ctx.platform || 'linux');
    const terminal = ctx.createTerminal({
      name: 'Claude Code',
      cwd: ctx.getWorkspaceRoot(),
    });
    terminal.show();
    terminal.sendText(command, true);
    ctx.showInformationMessage(text(lang, 'workTerminalReady'));
    return { ok: true, target: 'claudeTerminal', submitted: false };
  }
  await ctx.writeClipboard(prompt);
  ctx.showInformationMessage(text(lang, 'workClipboardReady'));
  return { ok: true, target: 'clipboard', submitted: false };
}

async function startTaskWork(ctx, { ticketId, title }, deps) {
  const lang = ctx.getLang();
  if (!git.isTicketId(ticketId)) {
    ctx.showErrorMessage(text(lang, 'invalidTicketId'));
    return { ok: false, reason: 'bad-ticket' };
  }
  const prepare =
    deps && deps.prepareTicketBranch ? deps.prepareTicketBranch : gitWorkflow.prepareTicketBranch;
  const prepared = await prepare(ctx, { ticketId, title, lang });
  if (!prepared || !prepared.ok) return { ok: false, reason: prepared && prepared.reason };
  markInProgress(ctx, ticketId);
  await markPlanTask(ctx, ticketId, 'in_progress');
  const prompt = buildWorkPrompt(taskDetails(ctx, ticketId, title, prepared.branch));
  const launched = await launchWork(ctx, prompt);
  ctx.postMessage({
    type: 'workStarted',
    ticketId,
    target: launched.target,
    branch: prepared.branch,
    submitted: false,
  });
  return Object.assign({ ok: true, branch: prepared.branch, prompt }, launched);
}

module.exports = {
  CLAUDE_EXTENSION_ID,
  CLAUDE_PANEL_URI,
  BYPASS_FLAGS,
  buildWorkPrompt,
  selectWorkTarget,
  buildClaudePanelUri,
  buildClaudeTerminalArgs,
  buildClaudeTerminalCommand,
  quoteShellArg,
  launchWork,
  startTaskWork,
};
