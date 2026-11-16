const cp = require('child_process');
const { routeMessage } = require('./messageRouter');
const { renderWebviewHtml, createNonce } = require('../webview/html');
const { getDetectedExts, pickDefaultAi } = require('./language');
const { triggerAiChat } = require('./aiChat');

function createPanelController({ vscode, context, state, getLang }) {
  let mainPanel = null;
  let uiReady = false;

  function detected() {
    return getDetectedExts((id) => vscode.extensions.getExtension(id));
  }

  function activeAi() {
    return state.get('activeAi', pickDefaultAi(detected()));
  }

  function renderHtml(overrides) {
    if (!mainPanel) return;
    const has = (key) => overrides && Object.prototype.hasOwnProperty.call(overrides, key);
    const webview = mainPanel.webview;
    const media = vscode.Uri.joinPath(context.extensionUri, 'media', 'webview');
    webview.html = renderWebviewHtml({
      cspSource: webview.cspSource,
      nonce: createNonce(),
      cssUri: webview.asWebviewUri(vscode.Uri.joinPath(media, 'main.css')).toString(),
      jsUri: webview.asWebviewUri(vscode.Uri.joinPath(media, 'main.js')).toString(),
      i18nUri: webview.asWebviewUri(vscode.Uri.joinPath(media, 'shared', 'i18n.js')).toString(),
      lang: has('lang') ? overrides.lang : getLang(),
      onboarded: has('onboarded') ? overrides.onboarded : state.get('onboarded', false),
      connectedTools: has('connectedTools')
        ? overrides.connectedTools
        : state.get('connectedTools', []),
      tasks: has('tasks') ? overrides.tasks : state.get('tasks', null),
      initialTicket: has('initialTicket') ? overrides.initialTicket : null,
      detectedExts: has('detectedExts') ? overrides.detectedExts : detected(),
      activeAi: has('activeAi') ? overrides.activeAi : activeAi(),
      epics: has('epics') ? overrides.epics : state.get('epics', null),
      localMode: has('localMode') ? overrides.localMode : state.get('localMode', false),
    });
  }

  function createContext() {
    return {
      getLang,
      getActiveAi: activeAi,
      state,
      postMessage(message) {
        mainPanel.webview.postMessage(message);
      },
      showInformationMessage(message) {
        return vscode.window.showInformationMessage(message);
      },
      showWarningMessage(message, options, ...items) {
        return vscode.window.showWarningMessage(message, options, ...items);
      },
      showErrorMessage(message) {
        return vscode.window.showErrorMessage(message);
      },
      openExternal(url) {
        return vscode.env.openExternal(vscode.Uri.parse(url));
      },
      getWorkspaceRoot() {
        const folders = vscode.workspace.workspaceFolders;
        return folders && folders.length > 0 ? folders[0].uri.fsPath : null;
      },
      exec: cp.exec,
      triggerAiChat(prompt, lang, provider) {
        return triggerAiChat(vscode, prompt, lang, provider);
      },
      writeClipboard(text) {
        return vscode.env.clipboard.writeText(text);
      },
      updateLanguage(lang) {
        return vscode.workspace.getConfiguration('productStudio').update('language', lang, true);
      },
      reloadHtml(overrides) {
        renderHtml(overrides);
      },
      showOpenDialog(options) {
        return vscode.window.showOpenDialog(options);
      },
      getTerminal(name) {
        return vscode.window.activeTerminal || vscode.window.createTerminal(name);
      },
      platform: process.platform,
      markUiReady() {
        uiReady = true;
      },
    };
  }

  function openMain(ticketId) {
    vscode.commands.executeCommand('workbench.action.closeSidebar');
    if (mainPanel) {
      mainPanel.reveal(vscode.ViewColumn.One);
      if (ticketId) mainPanel.webview.postMessage({ type: 'openTicket', ticketId });
      return;
    }
    uiReady = false;
    mainPanel = vscode.window.createWebviewPanel(
      'productStudio.main',
      'Product Studio',
      vscode.ViewColumn.One,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [vscode.Uri.joinPath(context.extensionUri, 'media')],
      }
    );
    const messageContext = createContext();
    mainPanel.webview.onDidReceiveMessage((message) => routeMessage(message, messageContext));
    mainPanel.onDidDispose(() => {
      mainPanel = null;
    });
    renderHtml({ initialTicket: ticketId || null });
  }

  return {
    open() {
      openMain();
    },
    openCreateTask() {
      openMain();
      setTimeout(() => {
        if (mainPanel) mainPanel.webview.postMessage({ type: 'showCreateTask' });
      }, 500);
    },
    resetOnboarding() {
      state.set('onboarded', false);
      state.set('connectedTools', []);
      if (mainPanel) {
        renderHtml({
          onboarded: false,
          connectedTools: [],
          localMode: false,
          initialTicket: null,
        });
      }
      vscode.window.showInformationMessage('Product Studio: Onboarding reset.');
    },
    isUiReady() {
      return uiReady;
    },
  };
}

module.exports = {
  createPanelController,
};
