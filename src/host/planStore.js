const fs = require('fs');
const path = require('path');
const { validatePlan } = require('./planSchema');
const { renderPlanMarkdown } = require('./planSchema');

const PLAN_DIR = '.product-studio';
const PLAN_JSON = 'plan.json';
const PLAN_MD = 'PLAN.md';

function isInsideWorkspace(root, target) {
  if (!root || !target) return false;
  const base = path.resolve(root);
  const resolved = path.resolve(target);
  const relative = path.relative(base, resolved);
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

function planPaths(root) {
  const dir = path.resolve(root, PLAN_DIR);
  return {
    dir,
    json: path.join(dir, PLAN_JSON),
    markdown: path.join(dir, PLAN_MD),
  };
}

async function atomicWrite(filePath, contents) {
  const dir = path.dirname(filePath);
  await fs.promises.mkdir(dir, { recursive: true });
  const tmp = filePath + '.tmp';
  await fs.promises.writeFile(tmp, contents, 'utf8');
  await fs.promises.rename(tmp, filePath);
}

async function loadPlan(root) {
  const paths = planPaths(root);
  if (!isInsideWorkspace(root, paths.json)) {
    return { corrupt: true, error: 'Plan path is outside the workspace.' };
  }
  let raw;
  try {
    raw = await fs.promises.readFile(paths.json, 'utf8');
  } catch (err) {
    if (err && err.code === 'ENOENT') return null;
    return { corrupt: true, error: 'Could not read the plan file.' };
  }
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (_) {
    return { corrupt: true, error: 'plan.json is not valid JSON. It was left unchanged.' };
  }
  const checked = validatePlan(parsed);
  if (!checked.ok) {
    return {
      corrupt: true,
      error: 'plan.json does not match the plan schema. It was left unchanged.',
    };
  }
  return { plan: checked.plan };
}

async function savePlan(root, plan) {
  const checked = validatePlan(plan);
  if (!checked.ok) return { ok: false, errors: checked.errors };
  const existing = await loadPlan(root);
  if (existing && existing.corrupt) {
    return { ok: false, corrupt: true, errors: ['corrupt'] };
  }
  const paths = planPaths(root);
  if (!isInsideWorkspace(root, paths.json) || !isInsideWorkspace(root, paths.markdown)) {
    return { ok: false, errors: ['Refusing to write outside the workspace.'] };
  }
  const body = JSON.stringify(checked.plan, null, 2) + '\n';
  await atomicWrite(paths.json, body);
  await atomicWrite(paths.markdown, renderPlanMarkdown(checked.plan));
  return { ok: true, plan: checked.plan };
}

module.exports = {
  PLAN_DIR,
  PLAN_JSON,
  PLAN_MD,
  isInsideWorkspace,
  planPaths,
  atomicWrite,
  loadPlan,
  savePlan,
};
