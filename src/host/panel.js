const { routeMessage } = require('./messageRouter');
const { runFile } = require('./process');
const { renderWebviewHtml, createNonce } = require('../webview/html');
const { getDetectedExts, pickDefaultAi } = require('./language');
const { triggerAiChat } = require('./aiChat');
const { hydratePlanIntoState } = require('./planWorkflow');
const { text } = require('./text');

function createPanelController({ vscode, context, state, getLang }) {
  let mainPanel = null;
  let uiReady = false;
  let planContext = null;
  let planWarning = '';

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
      planUri: webview.asWebviewUri(vscode.Uri.joinPath(media, 'plan.js')).toString(),
      lang: has('lang') ? overrides.lang : getLang(),
      planWarning: has('planWarning') ? overrides.planWarning : planWarning,
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
      runFile,
      showInputBox(options) {
        return vscode.window.showInputBox(options);
      },
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
      vscode,
      getPlanContext() {
        return planContext;
      },
      setPlanContext(value) {
        planContext = value;
      },
      markUiReady() {
        uiReady = true;
      },
    };
  }

  async function openMain(ticketId) {
    vscode.commands.executeCommand('workbench.action.closeSidebar');
    if (mainPanel) {
      mainPanel.reveal(vscode.ViewColumn.One);
      if (ticketId) mainPanel.webview.postMessage({ type: 'openTicket', ticketId });
      return;
    }
    uiReady = false;
    try {
      const root =
        vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders[0]
          ? vscode.workspace.workspaceFolders[0].uri.fsPath
          : null;
      const hydrated = await hydratePlanIntoState(state, root);
      planWarning = hydrated && hydrated.corrupt ? text(getLang(), 'planCorrupt') : '';
    } catch (_) {
      planWarning = '';
    }
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
