const path = require('path');
const fs = require('fs');
const { text } = require('./text');
const { loadPlan, savePlan, isInsideWorkspace } = require('./planStore');
const {
  validatePlan,
  planToWorkspace,
  mergeWorkspace,
  setTaskStatus,
  workspaceStatusToPlan,
  blankPlan,
} = require('./planSchema');
const {
  detectPlanProvider,
  proposeWithProvider,
  failureKey,
  findWorkspaceClaude,
  selectLanguageModel,
  readAnthropicApiKey,
  readAnthropicModel,
  promptAndStoreAnthropicKey,
  clearStoredAnthropicKey,
} = require('./planProviders');
const { listPlanSyncTargets } = require('./planSync');

const CONTEXT_EXT = new Set(['.md', '.txt', '.markdown']);
const CONTEXT_MAX = 200000;

function countersFrom(plan) {
  if (!plan) return { nextTaskNumber: 1, nextEpicNumber: 1 };
  return { nextTaskNumber: plan.nextTaskNumber, nextEpicNumber: plan.nextEpicNumber };
}

async function readContextFile(root, filePath) {
  if (!root || !filePath) return { ok: false, reason: 'missing' };
  const absolute = path.resolve(filePath);
  if (!isInsideWorkspace(root, absolute)) return { ok: false, reason: 'outside' };
  const ext = path.extname(absolute).toLowerCase();
  if (!CONTEXT_EXT.has(ext)) return { ok: false, reason: 'type' };
  const stat = await fs.promises.stat(absolute);
  if (!stat.isFile() || stat.size > CONTEXT_MAX) return { ok: false, reason: 'size' };
  const body = await fs.promises.readFile(absolute, 'utf8');
  return { ok: true, name: path.basename(absolute), text: body.slice(0, 80000) };
}

async function hydratePlanIntoState(state, root) {
  if (!root) return { plan: null };
  const loaded = await loadPlan(root);
  if (!loaded) return { plan: null };
  if (loaded.corrupt) return loaded;
  const merged = mergeWorkspace(
    state.get('tasks', {}) || {},
    state.get('epics', {}) || {},
    loaded.plan
  );
  state.set('tasks', merged.tasks);
  state.set('epics', merged.epics);
  return { plan: loaded.plan };
}

async function currentCounters(root) {
  if (!root) return { nextTaskNumber: 1, nextEpicNumber: 1 };
  const loaded = await loadPlan(root);
  if (!loaded || loaded.corrupt) return { nextTaskNumber: 1, nextEpicNumber: 1 };
  return countersFrom(loaded.plan);
}

async function proposeWorkspacePlan(ctx, { idea, lang }) {
  if (!idea || !String(idea).trim()) {
    ctx.postMessage({ type: 'planFailed', message: text(lang, 'planNeedIdea') });
    return { ok: false, reason: 'empty-idea' };
  }
  if (ctx.isPlanRunning && ctx.isPlanRunning()) return { ok: false, reason: 'busy' };
  const controller = new AbortController();
  if (ctx.beginPlanRequest) ctx.beginPlanRequest(controller);
  try {
    const context = ctx.getPlanContext ? ctx.getPlanContext() : null;
    const config = ctx.getProductConfig ? ctx.getProductConfig() : null;
    const provider = await detectPlanProvider({
      loadLanguageModel: () => selectLanguageModel(ctx.vscode),
      findClaude: () => findWorkspaceClaude(config && config.get ? config.get('claudePath') : ''),
      readApiKey: () => readAnthropicApiKey(ctx.secrets),
    });
    if (!provider) {
      ctx.postMessage({ type: 'planUnavailable', message: text(lang, 'planNoModel') });
      return { ok: false, reason: 'no-model' };
    }
    ctx.postMessage({ type: 'planProvider', provider: provider.label });
    const result = await proposeWithProvider(provider, {
      idea,
      contextText: context && context.text,
      counters: await currentCounters(ctx.getWorkspaceRoot()),
      cwd: ctx.getWorkspaceRoot(),
      signal: controller.signal,
      modelName: readAnthropicModel(config),
    });
    if (controller.signal.aborted || result.reason === 'cancelled') {
      ctx.postMessage({ type: 'planCancelled', message: text(lang, 'planCancelled') });
      return { ok: false, reason: 'cancelled' };
    }
    if (!result.ok) {
      ctx.postMessage({ type: 'planFailed', message: text(lang, failureKey(result.reason)) });
      return result;
    }
    ctx.postMessage({ type: 'planProposal', plan: result.plan, source: provider.label });
    return result;
  } finally {
    if (ctx.endPlanRequest) ctx.endPlanRequest();
  }
}

async function acceptWorkspacePlan(ctx, plan, lang) {
  const root = ctx.getWorkspaceRoot();
  if (!root) {
    ctx.showWarningMessage(text(lang, 'noWorkspacePlan'));
    return { ok: false };
  }
  const checked = validatePlan(plan);
  if (!checked.ok) {
    const needsTitle = checked.errors.some(
      (code) => code === 'title' || code === 'epic-title' || code === 'task-title'
    );
    ctx.postMessage({
      type: 'planInvalid',
      message: text(lang, needsTitle ? 'planNeedTitles' : 'planInvalid'),
    });
    return { ok: false, errors: checked.errors };
  }
  const saved = await savePlan(root, checked.plan);
  if (!saved.ok) {
    ctx.showErrorMessage(text(lang, 'planSaveError'));
    return saved;
  }
  const mapped = planToWorkspace(saved.plan);
  ctx.state.set('tasks', mapped.tasks);
  ctx.state.set('epics', mapped.epics);
  const target = listPlanSyncTargets()[0];
  await target.exportPlan(saved.plan);
  ctx.postMessage({
    type: 'planAccepted',
    plan: saved.plan,
    tasks: mapped.tasks,
    epics: mapped.epics,
  });
  ctx.showInformationMessage(text(lang, 'planSaved'));
  return { ok: true, plan: saved.plan };
}

async function syncPlanStatuses(ctx, tasks) {
  const root = ctx.getWorkspaceRoot();
  if (!root || !tasks) return;
  const loaded = await loadPlan(root);
  if (!loaded || loaded.corrupt) {
    if (loaded && loaded.corrupt) ctx.showErrorMessage(text(ctx.getLang(), 'planCorrupt'));
    return;
  }
  let plan = loaded.plan;
  let changed = false;
  Object.keys(tasks).forEach((ticketId) => {
    const status = workspaceStatusToPlan(tasks[ticketId] && tasks[ticketId].status);
    const updated = setTaskStatus(plan, ticketId, status);
    if (updated.changed) {
      plan = updated.plan;
      changed = true;
    }
  });
  if (changed) await savePlan(root, plan);
}

async function markPlanTask(ctx, ticketId, status) {
  const root = ctx.getWorkspaceRoot();
  if (!root || !ticketId) return;
  const loaded = await loadPlan(root);
  if (!loaded || loaded.corrupt) return;
  const updated = setTaskStatus(loaded.plan, ticketId, status);
  if (!updated.changed) return;
  const saved = await savePlan(root, updated.plan);
  if (!saved.ok) return;
  ctx.postMessage({ type: 'planTaskStatus', ticketId, status });
}

function manualPlan(counters) {
  return blankPlan(counters || { nextTaskNumber: 1, nextEpicNumber: 1 });
}

function setAnthropicKey(ctx, lang) {
  return promptAndStoreAnthropicKey({
    lang,
    secrets: ctx.secrets,
    showInputBox: (options) => ctx.showInputBox(options),
    notify: (message) => ctx.showInformationMessage(message),
  });
}

function clearAnthropicKey(ctx, lang) {
  return clearStoredAnthropicKey({
    lang,
    secrets: ctx.secrets,
    notify: (message) => ctx.showInformationMessage(message),
  });
}

module.exports = {
  readContextFile,
  hydratePlanIntoState,
  proposeWorkspacePlan,
  acceptWorkspacePlan,
  syncPlanStatuses,
  markPlanTask,
  manualPlan,
  currentCounters,
  setAnthropicKey,
  clearAnthropicKey,
};
