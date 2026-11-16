const vscode = require('vscode');
const { createStateStore } = require('./host/stateStore');
const { resolveLanguage } = require('./host/language');
const { createPanelController } = require('./host/panel');

function activate(context) {
  console.log('Product Studio v1.7.0 activated');

  const state = createStateStore(context.globalState);

  function getLang() {
    const pref = vscode.workspace.getConfiguration('productStudio').get('language', 'auto');
    return resolveLanguage(pref, vscode.env.language);
  }

  const panels = createPanelController({ vscode, context, state, getLang });

  context.subscriptions.push(
    vscode.commands.registerCommand('productStudio.open', () => panels.open()),
    vscode.commands.registerCommand('productStudio.createTask', () => panels.openCreateTask()),
    vscode.commands.registerCommand('productStudio.resetOnboarding', () => panels.resetOnboarding())
  );

  panels.open();

  return {
    isUiReady() {
      return panels.isUiReady();
    },
  };
}

function deactivate() {}

module.exports = { activate, deactivate };
