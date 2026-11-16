const { lookup } = require('../../media/webview/shared/i18n');
const es = require('../../media/webview/i18n/es.json');
const en = require('../../media/webview/i18n/en.json');

const dict = { es, en };

function text(lang, key, vars) {
  return lookup(dict, lang === 'es' ? 'es' : 'en', key, vars);
}

module.exports = { text };
