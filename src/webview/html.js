const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const templatePath = path.join(__dirname, '../../media/webview/index.html');
const esPath = path.join(__dirname, '../../media/webview/i18n/es.json');
const enPath = path.join(__dirname, '../../media/webview/i18n/en.json');

function createNonce() {
  return crypto.randomBytes(16).toString('hex');
}

function buildContentSecurityPolicy(cspSource, nonce) {
  // style-src keeps 'unsafe-inline' because the existing UI sets style attributes.
  // script-src is nonce-only: no inline scripts and no remote scripts.
  return [
    "default-src 'none'",
    `img-src ${cspSource} data:`,
    `style-src ${cspSource} 'unsafe-inline'`,
    `font-src ${cspSource}`,
    `script-src 'nonce-${nonce}'`,
  ].join('; ');
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function safeJson(value) {
  return JSON.stringify(value)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}

function loadDictionaries() {
  return {
    es: JSON.parse(fs.readFileSync(esPath, 'utf8')),
    en: JSON.parse(fs.readFileSync(enPath, 'utf8')),
  };
}

function renderWebviewHtml(options) {
  const lang = options.lang;
  const onboarded = !!options.onboarded;
  const localMode = !!options.localMode;
  const activeAi = options.activeAi || 'Claude';
  const nonce = options.nonce;
  const bootstrap = {
    lang,
    onboarded,
    connectedTools: options.connectedTools || [],
    detectedExts: options.detectedExts || { gitlab: false, github: false, jira: false },
    localMode,
    activeAi,
    epics: options.epics || null,
    tasks: options.tasks || null,
    initialTicket: options.initialTicket || null,
    i18n: loadDictionaries(),
    planWarning: options.planWarning || '',
  };

  const replacements = [
    ['___CSP___', buildContentSecurityPolicy(options.cspSource, nonce)],
    ['___CSS_URI___', escapeHtml(options.cssUri)],
    ['___JS_URI___', escapeHtml(options.jsUri)],
    ['___I18N_URI___', escapeHtml(options.i18nUri)],
    ['___PLAN_URI___', escapeHtml(options.planUri || '')],
    ['___NONCE___', nonce],
    ['___LANG_ES_CLASS___', lang === 'es' ? 'active' : ''],
    ['___LANG_EN_CLASS___', lang === 'en' ? 'active' : ''],
    ['___TOP_ACT_ATTR___', onboarded ? '' : 'style="display:none"'],
    ['___LOCAL_DISPLAY___', localMode ? '' : 'display:none'],
    ['___AI_NAME___', escapeHtml(activeAi)],
    ['___SOB_ATTR___', onboarded ? 'style="display:none"' : ''],
    ['___BOOTSTRAP_JSON___', safeJson(bootstrap)],
  ];

  let html = fs.readFileSync(templatePath, 'utf8');
  replacements.forEach(([token, value]) => {
    html = html.split(token).join(value);
  });
  return html;
}

module.exports = {
  createNonce,
  buildContentSecurityPolicy,
  escapeHtml,
  safeJson,
  loadDictionaries,
  renderWebviewHtml,
};
