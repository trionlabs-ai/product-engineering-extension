// Shared by the webview (classic script) and the Node unit tests (CommonJS).
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) {
    module.exports = api;
  } else {
    root.ProductStudioI18n = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  function lookup(dict, lang, key, vars) {
    let text = (dict[lang] && dict[lang][key]) || key;
    if (vars) {
      Object.entries(vars).forEach((entry) => {
        text = text.replace('{' + entry[0] + '}', entry[1]);
      });
    }
    return text;
  }

  return { lookup: lookup };
});
