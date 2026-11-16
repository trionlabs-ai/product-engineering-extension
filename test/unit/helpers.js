function createContext(overrides = {}) {
  const stored = {};
  const ctx = {
    lang: overrides.lang || 'en',
    activeAi: overrides.activeAi || 'Claude',
    platform: overrides.platform || 'linux',
    uiReady: false,
    messages: [],
    info: [],
    warnings: [],
    errors: [],
    execs: [],
    terminals: [],
    calls: [],
    reloads: [],
    stored,
    getLang() {
      return ctx.lang;
    },
    getActiveAi() {
      return ctx.activeAi;
    },
    state: {
      get(key, fallback) {
        return Object.prototype.hasOwnProperty.call(stored, key) ? stored[key] : fallback;
      },
      set(key, value) {
        stored[key] = value;
      },
    },
    postMessage(message) {
      ctx.messages.push(message);
    },
    showInformationMessage(message) {
      ctx.info.push(message);
    },
    showWarningMessage(message) {
      ctx.warnings.push(message);
      return Promise.resolve(overrides.warningResponse);
    },
    showErrorMessage(message) {
      ctx.errors.push(message);
    },
    exec(cmd, options, callback) {
      if (typeof options === 'function') {
        callback = options;
        options = undefined;
      }
      ctx.execs.push({ cmd, options });
      const result = overrides.execResult ? overrides.execResult(cmd) : {};
      if (callback) callback(result.err || null, result.stdout || '', result.stderr || '');
    },
    getWorkspaceRoot() {
      return Object.prototype.hasOwnProperty.call(overrides, 'root') ? overrides.root : '/repo';
    },
    triggerAiChat(...args) {
      ctx.calls.push(['ai', ...args]);
      return Promise.resolve();
    },
    writeClipboard(text) {
      ctx.calls.push(['clip', text]);
      return Promise.resolve();
    },
    updateLanguage(lang) {
      ctx.calls.push(['lang', lang]);
      ctx.lang = lang;
      return Promise.resolve();
    },
    reloadHtml(next) {
      ctx.reloads.push(next || null);
    },
    showOpenDialog() {
      return Promise.resolve(overrides.files || undefined);
    },
    getTerminal(name) {
      const terminal = {
        name,
        shown: false,
        lines: [],
        show() {
          terminal.shown = true;
        },
        sendText(line) {
          terminal.lines.push(line);
        },
      };
      ctx.terminals.push(terminal);
      return terminal;
    },
    openExternal(url) {
      ctx.calls.push(['open', url]);
      if (overrides.openError) return Promise.reject(overrides.openError);
      return Promise.resolve();
    },
    markUiReady() {
      ctx.uiReady = true;
    },
  };
  return ctx;
}

function flush() {
  return new Promise((resolve) => setImmediate(resolve));
}

module.exports = { createContext, flush };
