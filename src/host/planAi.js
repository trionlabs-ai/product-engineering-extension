const { assignIds, validatePlan } = require('./planSchema');

function buildPlanPrompt(idea, contextText) {
  return [
    'You are a planning assistant. Return only JSON, no markdown.',
    'The JSON shape is {"title":"","summary":"","epics":[{"title":"","summary":"","tasks":[{"title":"","description":"","acceptanceCriteria":[""],"estimate":""}]}]}',
    'Use 2 to 5 epics. Each epic has 2 to 6 concrete tasks. Estimates are short, like "0.5d" or "2d", or "".',
    'Do not include ids. Write in the same language as the idea.',
    '',
    'Idea:',
    String(idea || '').slice(0, 8000),
    '',
    contextText ? 'Context file:\n' + String(contextText).slice(0, 80000) : '',
  ]
    .filter(Boolean)
    .join('\n');
}

function extractJson(text) {
  const source = String(text || '');
  const fenced = source.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const raw = fenced ? fenced[1] : source;
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start < 0 || end <= start) return null;
  try {
    return JSON.parse(raw.slice(start, end + 1));
  } catch (_) {
    return null;
  }
}

async function proposePlan({ idea, contextText, model, counters }) {
  if (!idea || !String(idea).trim()) return { ok: false, reason: 'empty-idea' };
  if (!model || typeof model.complete !== 'function') return { ok: false, reason: 'no-model' };
  let raw;
  try {
    raw = await model.complete(buildPlanPrompt(idea, contextText));
  } catch (err) {
    return {
      ok: false,
      reason: 'model-error',
      message: err && err.message ? err.message : 'model error',
    };
  }
  const parsed = extractJson(raw);
  if (!parsed || !Array.isArray(parsed.epics)) return { ok: false, reason: 'unparseable' };
  const plan = assignIds(parsed, counters || { nextTaskNumber: 1, nextEpicNumber: 1 });
  const checked = validatePlan(plan);
  if (!checked.ok) return { ok: false, reason: 'invalid', errors: checked.errors };
  return { ok: true, plan: checked.plan, source: model.id || 'model' };
}

async function selectLanguageModel(vscode) {
  try {
    if (!vscode || !vscode.lm || typeof vscode.lm.selectChatModels !== 'function') return null;
    const models = await vscode.lm.selectChatModels({});
    if (!models || !models.length) return null;
    const model = models[0];
    return {
      id: model.id || model.name || 'vscode.lm',
      async complete(prompt) {
        const message = vscode.LanguageModelChatMessage.User(prompt);
        const response = await model.sendRequest([message], {});
        let text = '';
        for await (const part of response.text) text += part;
        return text;
      },
    };
  } catch (_) {
    return null;
  }
}

module.exports = {
  buildPlanPrompt,
  extractJson,
  proposePlan,
  selectLanguageModel,
};
