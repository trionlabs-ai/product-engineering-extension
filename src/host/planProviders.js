const os = require('os');
const path = require('path');
const fs = require('fs');
const {
  buildPlanPrompt,
  interpretPlanModelText,
  proposePlan,
  selectLanguageModel,
} = require('./planAi');
const { runFileInput } = require('./process');
const { text } = require('./text');

const SECRET_KEY = 'productStudio.anthropicApiKey';
const DEFAULT_ANTHROPIC_MODEL = 'claude-sonnet-4-5';
const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';
const PLAN_TIMEOUT_MS = 120000;
const SKIP_PERMISSIONS_FLAG = '--dangerously-skip-permissions';

function listClaudeCandidates({ home, envPath, configured, platform }) {
  const candidates = [];
  if (configured && String(configured).trim()) candidates.push(String(configured).trim());
  const delimiter = platform === 'win32' ? ';' : path.delimiter;
  const names = platform === 'win32' ? ['claude.exe', 'claude.cmd', 'claude'] : ['claude'];
  String(envPath || '')
    .split(delimiter)
    .filter(Boolean)
    .forEach((dir) => {
      names.forEach((name) => candidates.push(path.join(dir, name)));
    });
  const root = home || '';
  [
    path.join(root, '.claude', 'local', 'claude'),
    path.join('/opt/homebrew/bin', 'claude'),
    path.join('/usr/local/bin', 'claude'),
    path.join(root, '.local', 'bin', 'claude'),
  ].forEach((file) => candidates.push(file));
  const seen = new Set();
  return candidates.filter((file) => {
    if (!file || seen.has(file)) return false;
    seen.add(file);
    return true;
  });
}

function findClaudeBinary(spec, fsLike) {
  const files = fsLike || fs;
  const candidates = listClaudeCandidates(spec);
  for (const candidate of candidates) {
    try {
      const stat = files.statSync(candidate);
      if (stat && stat.isFile()) return candidate;
    } catch (_) {
      // Try the next location.
    }
  }
  return null;
}

function buildClaudePlanArgs() {
  const args = ['-p', '--output-format', 'json', '--permission-mode', 'plan', '--allowedTools', ''];
  if (args.includes(SKIP_PERMISSIONS_FLAG)) {
    throw new Error('Claude plan arguments must not skip permissions.');
  }
  return args;
}

async function readAnthropicApiKey(secrets) {
  if (!secrets || typeof secrets.get !== 'function') return '';
  const value = await secrets.get(SECRET_KEY);
  return typeof value === 'string' ? value.trim() : '';
}

async function storeAnthropicApiKey(secrets, key) {
  if (!secrets || typeof secrets.store !== 'function') return { ok: false, reason: 'no-secrets' };
  await secrets.store(SECRET_KEY, key);
  return { ok: true };
}

async function clearAnthropicApiKey(secrets) {
  if (!secrets || typeof secrets.delete !== 'function') return { ok: false, reason: 'no-secrets' };
  await secrets.delete(SECRET_KEY);
  return { ok: true };
}

function readAnthropicModel(config) {
  const value = config && typeof config.get === 'function' ? config.get('anthropic.model') : '';
  const model = typeof value === 'string' ? value.trim() : '';
  return model || DEFAULT_ANTHROPIC_MODEL;
}

async function detectPlanProvider({ loadLanguageModel, findClaude, readApiKey }) {
  const languageModel = await loadLanguageModel();
  if (languageModel) {
    return { id: 'vscode.lm', label: 'Copilot', model: languageModel };
  }
  const claudeBinary = findClaude();
  if (claudeBinary) {
    return { id: 'claude-cli', label: 'Claude Code', binary: claudeBinary };
  }
  const apiKey = await readApiKey();
  if (apiKey) return { id: 'anthropic', label: 'Anthropic', apiKey };
  return null;
}

function safeReason(reason) {
  if (
    reason === 'cancelled' ||
    reason === 'timeout' ||
    reason === 'api-error' ||
    reason === 'claude-error' ||
    reason === 'unparseable' ||
    reason === 'invalid'
  ) {
    return reason;
  }
  return 'api-error';
}

async function requestAnthropicMessages({ apiKey, model, prompt, fetchImpl, timeoutMs, signal }) {
  if (!apiKey) return { ok: false, reason: 'api-error' };
  if (signal && signal.aborted) return { ok: false, reason: 'cancelled' };
  const fetchFn = fetchImpl || global.fetch;
  if (typeof fetchFn !== 'function') return { ok: false, reason: 'api-error' };
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs || PLAN_TIMEOUT_MS);
  const onAbort = () => controller.abort();
  if (signal) signal.addEventListener('abort', onAbort, { once: true });
  try {
    const response = await fetchFn(ANTHROPIC_URL, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: model || DEFAULT_ANTHROPIC_MODEL,
        max_tokens: 4096,
        messages: [{ role: 'user', content: prompt }],
      }),
      signal: controller.signal,
    });
    if (!response || !response.ok) return { ok: false, reason: 'api-error' };
    const body = await response.json();
    const parts = body && Array.isArray(body.content) ? body.content : [];
    const reply = parts.map((part) => (part && part.text ? part.text : '')).join('');
    if (!reply) return { ok: false, reason: 'unparseable' };
    return { ok: true, text: reply };
  } catch (_) {
    if (signal && signal.aborted) return { ok: false, reason: 'cancelled' };
    if (controller.signal.aborted) return { ok: false, reason: 'timeout' };
    return { ok: false, reason: 'api-error' };
  } finally {
    clearTimeout(timer);
    if (signal) signal.removeEventListener('abort', onAbort);
  }
}

async function runClaudePlan({ binary, prompt, cwd, timeoutMs, signal, run, counters }) {
  if (!binary || !cwd) return { ok: false, reason: 'claude-error' };
  const args = buildClaudePlanArgs();
  const execute = run || runFileInput;
  const result = await execute(binary, args, {
    cwd,
    input: prompt,
    timeoutMs: timeoutMs || PLAN_TIMEOUT_MS,
    signal,
  });
  if (result.cancelled) return { ok: false, reason: 'cancelled' };
  if (result.timedOut) return { ok: false, reason: 'timeout' };
  if (!result.stdout) return { ok: false, reason: 'claude-error' };
  return interpretPlanModelText(result.stdout, counters);
}

async function proposeWithProvider(provider, options) {
  const prompt = buildPlanPrompt(options.idea, options.contextText);
  if (!provider) return { ok: false, reason: 'no-model' };
  if (provider.id === 'vscode.lm') {
    return proposePlan({
      idea: options.idea,
      contextText: options.contextText,
      model: provider.model,
      counters: options.counters,
    });
  }
  if (provider.id === 'claude-cli') {
    return runClaudePlan({
      binary: provider.binary,
      prompt,
      cwd: options.cwd,
      timeoutMs: options.timeoutMs,
      signal: options.signal,
      run: options.run,
      counters: options.counters,
    });
  }
  if (provider.id === 'anthropic') {
    const called = await requestAnthropicMessages({
      apiKey: provider.apiKey,
      model: options.modelName,
      prompt,
      fetchImpl: options.fetchImpl,
      timeoutMs: options.timeoutMs,
      signal: options.signal,
    });
    if (!called.ok) return { ok: false, reason: safeReason(called.reason) };
    const interpreted = interpretPlanModelText(called.text, options.counters);
    if (!interpreted.ok) return interpreted;
    return interpreted;
  }
  return { ok: false, reason: 'no-model' };
}

function failureKey(reason) {
  if (reason === 'unparseable' || reason === 'invalid') return 'planParseError';
  if (reason === 'timeout') return 'planTimeout';
  if (reason === 'cancelled') return 'planCancelled';
  if (reason === 'claude-error') return 'planClaudeError';
  if (reason === 'api-error') return 'planApiError';
  if (reason === 'empty-idea') return 'planNeedIdea';
  return 'planModelError';
}

async function promptAndStoreAnthropicKey({ showInputBox, secrets, notify, lang }) {
  const value = await showInputBox({
    password: true,
    ignoreFocusOut: true,
    prompt: text(lang, 'planKeyPrompt'),
  });
  if (value == null) return { ok: false, reason: 'cancelled' };
  const key = String(value).trim();
  if (!key) {
    notify(text(lang, 'planKeyMissing'));
    return { ok: false, reason: 'empty' };
  }
  const stored = await storeAnthropicApiKey(secrets, key);
  if (!stored.ok) {
    notify(text(lang, 'planKeyNoStorage'));
    return stored;
  }
  notify(text(lang, 'planKeySaved'));
  return { ok: true };
}

async function clearStoredAnthropicKey({ secrets, notify, lang }) {
  const cleared = await clearAnthropicApiKey(secrets);
  notify(text(lang, cleared.ok ? 'planKeyCleared' : 'planKeyNoStorage'));
  return cleared;
}

function findWorkspaceClaude(configured) {
  return findClaudeBinary({
    home: os.homedir(),
    envPath: process.env.PATH,
    configured: configured || '',
    platform: process.platform,
  });
}

module.exports = {
  SECRET_KEY,
  DEFAULT_ANTHROPIC_MODEL,
  ANTHROPIC_URL,
  PLAN_TIMEOUT_MS,
  SKIP_PERMISSIONS_FLAG,
  listClaudeCandidates,
  findClaudeBinary,
  buildClaudePlanArgs,
  readAnthropicApiKey,
  storeAnthropicApiKey,
  clearAnthropicApiKey,
  readAnthropicModel,
  detectPlanProvider,
  requestAnthropicMessages,
  runClaudePlan,
  proposeWithProvider,
  failureKey,
  promptAndStoreAnthropicKey,
  clearStoredAnthropicKey,
  findWorkspaceClaude,
  selectLanguageModel,
};
