const vscode = require('vscode');

// =====================================================================
// PRODUCT STUDIO v1.4.0 — VS Code Extension
// Guided workspace for Product Engineers: onboarding, task CRUD,
// AI chat sync, testing, evidence, merge requests. i18n: ES / EN.
// =====================================================================

function activate(context) {
  console.log('Product Studio v1.4.0 activated');

  let mainPanel = null;

  function getLang() {
    const pref = vscode.workspace.getConfiguration('productStudio').get('language', 'auto');
    if (pref !== 'auto') return pref;
    return (vscode.env.language || 'en').startsWith('es') ? 'es' : 'en';
  }

  function getState(key, fallback) { return context.globalState.get('ps.' + key, fallback); }
  function setState(key, val) { context.globalState.update('ps.' + key, val); }

  function getDetectedExts() {
    return {
      gitlab: !!vscode.extensions.getExtension('GitLab.gitlab-workflow'),
      github: !!vscode.extensions.getExtension('GitHub.vscode-pull-request-github'),
      jira: !!vscode.extensions.getExtension('Atlassian.atlascode')
    };
  }

  // Load stored tasks or use defaults
  function getTasks() {
    return getState('tasks', null);
  }

  async function triggerAiChat(prompt, lang) {
    if (prompt) {
      try {
        await vscode.env.clipboard.writeText(prompt);
      } catch (_) {}
    }

    const chatCommands = [
      { cmd: 'workbench.action.chat.open', args: prompt ? { query: prompt } : undefined },
      { cmd: 'workbench.action.quickchat.open', args: prompt ? { query: prompt } : undefined },
      { cmd: 'antigravity.chat.focus' },
      { cmd: 'google.gemini.chat.focus' },
      { cmd: 'claude.focus' },
      { cmd: 'claude.openChat' },
      { cmd: 'claude-dev.SidebarProvider.focus' },
      { cmd: 'continue.focusContinueInputView' },
      { cmd: 'workbench.panel.chat.view.copilot.focus' }
    ];

    let opened = false;
    for (const item of chatCommands) {
      try {
        if (item.args) {
          await vscode.commands.executeCommand(item.cmd, item.args);
        } else {
          await vscode.commands.executeCommand(item.cmd);
        }
        opened = true;
        break;
      } catch (_) {}
    }

    const msg = lang === 'es'
      ? (opened
          ? 'Chat abierto y prompt copiado. Si no ves el texto, pegalo con Cmd+V / Ctrl+V.'
          : 'Prompt copiado al portapapeles. Pegalo (Cmd+V / Ctrl+V) en tu asistente de IA (Claude, Copilot o Antigravity).')
      : (opened
          ? 'Chat opened & prompt copied. If input is empty, paste with Cmd+V / Ctrl+V.'
          : 'Prompt copied to clipboard. Paste (Cmd+V / Ctrl+V) in your AI assistant (Claude, Copilot or Antigravity).');

    vscode.window.showInformationMessage(msg);
  }

  function openMain(ticketId) {
    vscode.commands.executeCommand('workbench.action.closeSidebar');
    if (mainPanel) {
      mainPanel.reveal(vscode.ViewColumn.One);
      if (ticketId) mainPanel.webview.postMessage({ type: 'openTicket', ticketId });
      return;
    }
    mainPanel = vscode.window.createWebviewPanel(
      'productStudio.main', 'Product Studio', vscode.ViewColumn.One,
      { enableScripts: true, retainContextWhenHidden: true }
    );
    mainPanel.webview.html = getMainHtml(
      getLang(),
      getState('onboarded', false),
      getState('connectedTools', []),
      getTasks(),
      ticketId,
      getDetectedExts()
    );

    mainPanel.webview.onDidReceiveMessage(async msg => {
      const lang = getLang();
      switch (msg.type) {
        case 'finishOnboarding':
          setState('onboarded', true);
          setState('connectedTools', msg.tools);
          vscode.window.showInformationMessage('Product Studio: ' + (lang === 'es' ? 'Proyecto configurado.' : 'Project configured.'));
          break;
        case 'saveTasks':
          setState('tasks', msg.tasks);
          break;
        case 'openExternal':
          if (msg.url) {
            try {
              await vscode.env.openExternal(vscode.Uri.parse(msg.url));
            } catch (err) {
              vscode.window.showErrorMessage('Error opening URL: ' + err.message);
            }
          }
          break;
        case 'startAiChat':
        case 'syncWithAI':
          await triggerAiChat(msg.prompt, lang);
          break;
        case 'copyPrompt':
          await vscode.env.clipboard.writeText(msg.text);
          await triggerAiChat(msg.text, lang);
          break;
        case 'pickEvidenceFiles':
          const files = await vscode.window.showOpenDialog({
            canSelectMany: true,
            openLabel: lang === 'es' ? 'Adjuntar evidencia' : 'Attach evidence',
            filters: {
              [lang === 'es' ? 'Imágenes' : 'Images']: ['png', 'jpg', 'jpeg', 'webp', 'gif', 'svg']
            }
          });
          if (files && files.length > 0) {
            const names = files.map(f => {
              const parts = f.fsPath.split('/');
              return parts[parts.length - 1];
            });
            mainPanel.webview.postMessage({ type: 'evidenceSelected', fileNames: names });
            vscode.window.showInformationMessage(
              lang === 'es'
                ? `${names.length} archivo(s) adjuntado(s) como evidencia a Jira (${msg.ticketId}).`
                : `${names.length} file(s) attached as evidence to Jira (${msg.ticketId}).`
            );
          }
          break;
        case 'runTerminalTests':
          const terminal = vscode.window.activeTerminal || vscode.window.createTerminal('Product Studio: Tests');
          terminal.show();
          terminal.sendText('npm test || echo "Running tests..."');
          break;
        case 'attachEvidence':
          vscode.window.showInformationMessage(`Product Studio: Evidence attached to Jira (${msg.ticketId}).`);
          break;
        case 'createMR':
          vscode.window.showInformationMessage(`Product Studio: MR created on GitLab for ${msg.ticketId}.`);
          break;
        case 'changeLang':
          await vscode.workspace.getConfiguration('productStudio').update('language', msg.lang, true);
          mainPanel.webview.html = getMainHtml(
            msg.lang,
            getState('onboarded', false),
            getState('connectedTools', []),
            getTasks(),
            null,
            getDetectedExts()
          );
          break;
        case 'resetOnboarding':
          setState('onboarded', false);
          setState('connectedTools', []);
          mainPanel.webview.html = getMainHtml(lang, false, [], getTasks(), null, getDetectedExts());
          break;
        case 'confirmDelete':
          const yes = lang === 'es' ? 'Eliminar' : 'Delete';
          const resp = await vscode.window.showWarningMessage(
            (lang === 'es' ? 'Eliminar tarea ' : 'Delete task ') + msg.ticketId + '?',
            { modal: true }, yes
          );
          if (resp === yes) {
            mainPanel.webview.postMessage({ type: 'deleteConfirmed', ticketId: msg.ticketId });
          }
          break;
      }
    });

    mainPanel.onDidDispose(() => { mainPanel = null; });
  }

  context.subscriptions.push(
    vscode.commands.registerCommand('productStudio.open', () => openMain()),
    vscode.commands.registerCommand('productStudio.createTask', () => {
      openMain();
      setTimeout(() => {
        if (mainPanel) mainPanel.webview.postMessage({ type: 'showCreateTask' });
      }, 500);
    }),
    vscode.commands.registerCommand('productStudio.resetOnboarding', () => {
      setState('onboarded', false);
      setState('connectedTools', []);
      if (mainPanel) mainPanel.webview.html = getMainHtml(getLang(), false, [], getTasks(), null, getDetectedExts());
      vscode.window.showInformationMessage('Product Studio: Onboarding reset.');
    })
  );

  openMain();
}

// =====================================================================
// MAIN WEBVIEW — Full app
// =====================================================================
function getMainHtml(lang, onboarded, connectedTools, storedTasks, initialTicket, detectedExts) {
  const tasksJson = JSON.stringify(storedTasks || null);
  const connJson = JSON.stringify(connectedTools || []);
  const detectedJson = JSON.stringify(detectedExts || { gitlab: false, github: false, jira: false });

  return String.raw`<!DOCTYPE html><html><head><meta charset="UTF-8">
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:var(--vscode-editor-background);color:var(--vscode-foreground);height:100vh;overflow:hidden;display:flex;flex-direction:column}
::-webkit-scrollbar{width:5px}::-webkit-scrollbar-track{background:transparent}::-webkit-scrollbar-thumb{background:rgba(120,120,120,.25);border-radius:3px}
*{transition:all .12s ease}
.topbar{background:var(--vscode-titleBar-activeBackground);border-bottom:1px solid var(--vscode-panel-border);padding:6px 14px;display:flex;align-items:center;justify-content:space-between;font-size:12px;flex-shrink:0}
.topbar button{background:none;border:none;color:var(--vscode-descriptionForeground);cursor:pointer;font-size:12px;display:inline-flex;align-items:center;gap:4px;padding:2px 4px;border-radius:4px}
.topbar button:hover{color:var(--vscode-foreground);background:var(--vscode-toolbar-hoverBackground)}
.main{flex:1;overflow-y:auto;overflow-x:hidden}
.ctr{max-width:580px;margin:0 auto;padding:24px;width:100%}
#sOb{height:100%;min-height:100%;display:flex}
#sOb .ctr{height:100%;min-height:100%;display:flex;flex-direction:column;justify-content:center}
#sOb .ctr>*{flex-shrink:0}
#sOb #cList{flex:1 1 auto;min-height:160px;max-height:none}
.card{border:1px solid var(--vscode-panel-border);border-radius:8px;padding:14px;margin-bottom:12px}
.card-bg{background:var(--vscode-sideBar-background)}
.bp{background:var(--vscode-button-background);color:var(--vscode-button-foreground);border:none;border-radius:8px;padding:10px;font-size:13px;font-weight:600;cursor:pointer;width:100%;display:flex;align-items:center;justify-content:center;gap:6px}
.bp:hover{opacity:.9}
.bs{background:transparent;border:1px solid var(--vscode-panel-border);border-radius:8px;padding:10px;font-size:13px;font-weight:500;cursor:pointer;width:100%;color:var(--vscode-descriptionForeground);display:flex;align-items:center;justify-content:center;gap:6px}
.bs:hover{border-color:var(--vscode-focusBorder);color:var(--vscode-foreground)}
.bg{background:#e24329;color:#fff;border:none;border-radius:8px;padding:10px;font-size:13px;font-weight:600;cursor:pointer;width:100%;display:flex;align-items:center;justify-content:center;gap:6px}
.bg:hover{background:#c0341d}
.inp{width:100%;background:var(--vscode-input-background);border:1px solid var(--vscode-input-border);border-radius:8px;padding:8px 10px;font-size:13px;color:var(--vscode-input-foreground);outline:none}
.inp:focus{border-color:var(--vscode-focusBorder)}
select.inp{cursor:pointer}
.lbl{font-size:11px;font-weight:600;color:var(--vscode-descriptionForeground);margin-bottom:4px;display:block}
.cat-lbl{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--vscode-descriptionForeground);margin:10px 0 4px}
.cc{border:1px solid var(--vscode-panel-border);border-radius:8px;padding:10px 12px;cursor:pointer;display:flex;align-items:center;gap:10px;margin-bottom:6px}
.cc:hover{border-color:var(--vscode-descriptionForeground)}
.cc.sel{border-color:var(--vscode-focusBorder);background:rgba(59,130,246,.08)}
.cc.hid{display:none}
.tr{border:1px solid var(--vscode-panel-border);border-radius:8px;padding:14px;cursor:pointer;margin-bottom:8px;display:flex;align-items:start;justify-content:space-between}
.tr:hover{background:rgba(59,130,246,.04)}
.sd{width:8px;height:8px;border-radius:50%;flex-shrink:0;display:inline-block}
.sd-a{background:var(--vscode-focusBorder);box-shadow:0 0 6px var(--vscode-focusBorder)}
.sd-d{background:#10b981}
.sd-p{background:var(--vscode-panel-border)}
.pb{width:100%;text-align:left;padding:10px 14px;border-radius:8px;border:1px solid var(--vscode-panel-border);background:var(--vscode-sideBar-background);cursor:pointer;font-size:13px;color:var(--vscode-foreground);display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:6px}
.pb:hover{border-color:var(--vscode-focusBorder)}
.pb.fl{background:rgba(59,130,246,.1)}
.tok{display:flex;align-items:center;gap:6px;padding:6px 8px;border-radius:6px;background:rgba(16,185,129,.08);color:#10b981;font-size:12px;margin-bottom:4px}
.toast{position:fixed;bottom:12px;right:12px;background:var(--vscode-editorWidget-background);border:1px solid var(--vscode-panel-border);color:var(--vscode-foreground);padding:8px 14px;border-radius:8px;font-size:12px;display:flex;align-items:center;gap:6px;transform:translateY(60px);opacity:0;transition:all .2s;z-index:99;pointer-events:none}
.toast.show{transform:translateY(0);opacity:1}
.clip{position:fixed;top:50px;left:50%;transform:translateX(-50%) translateY(-10px);background:var(--vscode-button-background);color:var(--vscode-button-foreground);padding:6px 14px;border-radius:8px;font-size:12px;font-weight:600;display:flex;align-items:center;gap:6px;opacity:0;transition:all .2s;z-index:99;pointer-events:none}
.clip.show{opacity:1;transform:translateX(-50%) translateY(0)}
.fi{animation:fi .2s ease}
@keyframes fi{from{opacity:0;transform:translateY(4px)}to{opacity:1;transform:translateY(0)}}
.badge{font-size:10px;padding:2px 6px;border-radius:4px;font-weight:600}
.lt{display:flex;border:1px solid var(--vscode-panel-border);border-radius:6px;overflow:hidden;font-size:11px}
.lt button{padding:3px 8px;border:none;cursor:pointer;font-weight:600;background:transparent;color:var(--vscode-descriptionForeground)}
.lt button.active{background:var(--vscode-button-background);color:var(--vscode-button-foreground)}
.del-btn{background:none;border:none;cursor:pointer;color:var(--vscode-descriptionForeground);padding:4px;border-radius:4px;display:flex;align-items:center}
.del-btn:hover{background:rgba(239,68,68,.15);color:#ef4444}
.crit-row{display:flex;align-items:center;gap:6px;margin-bottom:6px}
.crit-row .inp{flex:1}
.crit-row button{background:none;border:none;cursor:pointer;color:var(--vscode-descriptionForeground);padding:2px}
.crit-row button:hover{color:#ef4444}
.ext-badge{font-size:9px;background:rgba(16,185,129,.15);color:#10b981;border:1px solid rgba(16,185,129,.3);padding:2px 5px;border-radius:4px;font-weight:600;display:inline-flex;align-items:center;gap:3px}
.filter-tabs{display:flex;gap:4px;background:var(--vscode-sideBar-background);border:1px solid var(--vscode-panel-border);border-radius:6px;padding:2px;font-size:11px}
.filter-tab{padding:4px 10px;border-radius:4px;cursor:pointer;border:none;background:transparent;color:var(--vscode-descriptionForeground);font-weight:600}
.filter-tab.active{background:var(--vscode-button-background);color:var(--vscode-button-foreground)}
</style></head><body>

<div class="topbar">
  <div style="display:flex;align-items:center;gap:6px">
    <strong>Product Studio</strong>
    <span style="color:var(--vscode-descriptionForeground);font-size:11px" id="topLbl"></span>
  </div>
  <div style="display:flex;align-items:center;gap:8px" id="topAct" ${onboarded ? '' : 'style="display:none"'}>
    <div class="lt">
      <button id="lEs" class="${lang === 'es' ? 'active' : ''}" onclick="cLang('es')">ES</button>
      <button id="lEn" class="${lang === 'en' ? 'active' : ''}" onclick="cLang('en')">EN</button>
    </div>
    <button onclick="startOb()"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg><span id="bNP"></span></button>
    <span style="width:1px;height:12px;background:var(--vscode-panel-border)"></span>
    <button onclick="showScr('settings')"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.6 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg><span id="bRC"></span></button>
  </div>
</div>

<div class="main">
  <div id="sOb" ${onboarded ? 'style="display:none"' : ''}></div>
  <div id="sHome" style="display:none"></div>
  <div id="sTk" style="display:none"></div>
  <div id="sSet" style="display:none"></div>
  <div id="sCreate" style="display:none"></div>
</div>

<div class="toast" id="toastEl"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2"><path d="M20 6L9 17l-5-5"/></svg><span id="toastTx"></span></div>
<div class="clip" id="clipEl"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg><span id="clipTx"></span></div>

<script>
const vsc=acquireVsCodeApi();
let L='${lang}',onb=${onboarded},cTools=${connJson},detExts=${detectedJson};
let selC=new Set(); // Start empty - let user pick their own stack!
let aTk=null,cS=1,filterMode='all';

const svgCheck='<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 6L9 17l-5-5"/></svg>';
const svgChat='<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>';
const svgPlus='<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>';
const svgBack='<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 18l-6-6 6-6"/></svg>';
const svgChev='<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="color:var(--vscode-descriptionForeground);flex-shrink:0"><path d="M9 18l6-6-6-6"/></svg>';
const svgCopy='<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--vscode-descriptionForeground)" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>';
const svgCam='<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>';
const svgDel='<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>';
const svgX='<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';
const svgExtLink='<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>';

const lg={
  Jira:'<svg viewBox="0 0 24 24" width="18" height="18" fill="#0052cc"><path d="M11.53 2c0 2.4 1.97 4.35 4.35 4.35h1.78v1.74c0 2.4 1.97 4.35 4.35 4.35V2h-10.48zm-4.35 4.35c0 2.4 1.97 4.35 4.35 4.35h1.74v1.74c0 2.4 1.97 4.35 4.35 4.35V6.35H7.18zm-4.35 4.35c0 2.4 1.97 4.35 4.35 4.35h1.74v1.74c0 2.4 1.97 4.35 4.35 4.35v-10.44H2.83z"/></svg>',
  GitLab:'<svg viewBox="0 0 24 24" width="18" height="18"><path fill="#e24329" d="m12 20.8 4.7-14.5H7.3z"/><path fill="#fc6d26" d="M12 20.8 7.3 6.3H1.8z"/><path fill="#fca326" d="m1.8 6.3-1.6 5c-.2.5 0 1.1.4 1.4L12 20.8z"/><path fill="#e24329" d="M1.8 6.3h5.5L4.5 2.1c-.2-.5-.8-.5-1 0z"/><path fill="#fc6d26" d="m12 20.8 4.7-14.5h5.5z"/><path fill="#fca326" d="m22.2 6.3 1.6 5c.2.5 0 1.1-.4 1.4L12 20.8z"/><path fill="#e24329" d="M22.2 6.3h-5.5l2.8-4.2c.2-.5.8-.5 1 0z"/></svg>',
  GitHub:'<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M12 2C6.477 2 2 6.477 2 12c0 4.42 2.865 8.17 6.839 9.49.5.092.682-.217.682-.482 0-.237-.008-.866-.013-1.7-2.782.604-3.369-1.34-3.369-1.34-.454-1.156-1.11-1.464-1.11-1.464-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.087 2.91.831.092-.646.35-1.086.636-1.336-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.269 2.75 1.025A9.578 9.578 0 0112 6.836c.85.004 1.705.115 2.504.337 1.909-1.294 2.747-1.025 2.747-1.025.546 1.377.203 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.743 0 .267.18.578.688.48C19.138 20.167 22 16.418 22 12c0-5.523-4.477-10-10-10z"/></svg>',
  Figma:'<svg viewBox="0 0 38 57" width="12" height="18"><path fill="#F24E1E" d="M19 28.5a9.5 9.5 0 1 1 0-19h9.5v19H19z"/><path fill="#FF7262" d="M0 9.5a9.5 9.5 0 0 0 9.5 9.5H19V0H9.5A9.5 9.5 0 0 0 0 9.5z"/><path fill="#A259FF" d="M0 28.5a9.5 9.5 0 0 0 9.5 9.5H19V19H9.5A9.5 9.5 0 0 0 0 28.5z"/><path fill="#1ABCFE" d="M19 47.5a9.5 9.5 0 0 0 9.5-9.5 9.5 9.5 0 0 0-9.5-9.5H9.5A9.5 9.5 0 0 0 0 38a9.5 9.5 0 0 0 9.5 9.5H19z"/><path fill="#0ACF83" d="M0 47.5A9.5 9.5 0 0 0 9.5 57H19V38H9.5A9.5 9.5 0 0 0 0 47.5z"/></svg>',
  Confluence:'<svg viewBox="0 0 24 24" width="18" height="18" fill="#1868DB"><path d="M2.04 16.5c-.2.33-.43.72-.62 1.02a.66.66 0 0 0 .22.9l3.42 2.12a.66.66 0 0 0 .91-.2c.17-.27.4-.64.66-1.06 1.83-2.97 3.6-2.57 6.88-1.1l3.56 1.6a.66.66 0 0 0 .87-.35l1.56-3.68a.66.66 0 0 0-.34-.86c-.94-.43-2.8-1.27-3.63-1.64-5.3-2.38-9.2-2.56-13.49 3.25zm19.92-9c.2-.33.43-.72.62-1.02a.66.66 0 0 0-.22-.9L18.94 3.46a.66.66 0 0 0-.91.2c-.17.27-.4.64-.66 1.06-1.83 2.97-3.6 2.57-6.88 1.1L7 4.22a.66.66 0 0 0-.87.35L4.57 8.25a.66.66 0 0 0 .34.86c.94.43 2.8 1.27 3.63 1.64 5.3 2.38 9.2 2.56 13.42-3.25z"/></svg>',
  Notion:'<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M4.459 4.208c.746.606 1.026.56 2.428.466l13.215-.793c.28 0 .047-.28-.046-.326L18.29 2.168c-.42-.327-.98-.56-2.054-.467l-12.78.793c-.467.047-.56.28-.374.466zm.793 3.08v13.904c0 .747.373 1.027 1.214.98l14.523-.84c.84-.046.933-.56.933-1.167V6.354c0-.606-.233-.933-.746-.886l-15.177.84c-.56.047-.747.327-.747.98z"/></svg>',
  OpenSpec:'<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>',
  Asana:'<svg viewBox="0 0 24 24" width="18" height="18" fill="#F06A6A"><circle cx="12" cy="7.5" r="4.2"/><circle cx="6.5" cy="16.5" r="4.2"/><circle cx="17.5" cy="16.5" r="4.2"/></svg>',
  ClickUp:'<svg viewBox="0 0 24 24" width="18" height="18"><path fill="#7B68EE" d="M3 17.5L5.5 15.5C6.9 17.3 9.3 18.5 12 18.5C14.7 18.5 17.1 17.3 18.5 15.5L21 17.5C18.9 20.3 15.7 22 12 22C8.3 22 5.1 20.3 3 17.5Z"/><path fill="#FF005A" d="M12 5.5L6.5 10.5L8.5 12.5L12 9.2L15.5 12.5L17.5 10.5L12 5.5Z"/></svg>',
  Supabase:'<svg viewBox="0 0 109 113" width="18" height="18"><path d="M63.7 110.3c-2.6 3.3-8.1 1.5-8.2-2.7l-1.4-56.6h38.4c6.9 0 10.7 8 6.2 13.3z" fill="#3ECF8E"/><path d="M45.3 2.7c2.6-3.3 8.1-1.5 8.2 2.7l.7 56.6H16.4c-6.9 0-10.7-8-6.2-13.3z" fill="#3ECF8E"/></svg>',
  Firebase:'<svg viewBox="0 0 24 24" width="18" height="18"><path fill="#FFA000" d="M3.89 15.67L6.22 2.59c.04-.25.34-.37.53-.2l2.47 2.32z"/><path fill="#F57C00" d="M9.17 8.07l-1.75-3.36a.28.28 0 0 0-.5 0L3.89 15.67z"/><path fill="#FFCA28" d="M17.73 6.73c.18-.17.49-.07.52.18l1.86 12.09-8.47 4.73a.82.82 0 0 1-.78 0L3.89 15.67z"/></svg>',
  PostgreSQL:'<svg viewBox="0 0 24 24" width="18" height="18" fill="#336791"><path d="M19.7 7.2c-.4-.5-1-1-1.8-1.3-.8-.3-1.7-.4-2.5-.2-.7-1.3-1.9-2.3-3.4-2.8-1.6-.5-3.4-.3-4.8.6C6 4.3 5 5.7 4.6 7.4c-.4 1.7-.1 3.5.7 5 .4.8 1 1.5 1.7 2.1v4.5c0 .6.5 1 1 1h2c.6 0 1-.4 1-1v-2h1.5c1.4 0 2.7-.6 3.6-1.6.9-1 1.4-2.4 1.4-3.8 1-.3 1.8-1 2.3-1.9.4-.9.5-2 .1-3-.1-.5-.4-.9-.7-1.3zM12 11c-.6 0-1-.4-1-1s.4-1 1-1 1 .4 1 1-.4 1-1 1z"/></svg>',
  MySQL:'<svg viewBox="0 0 24 24" width="18" height="18"><path fill="#00758F" d="M12 3C7 3 3 6.5 3 11c0 2.5 1.3 4.8 3.5 6.3L6 21l4-2.2c.7.1 1.3.2 2 .2 5 0 9-3.5 9-8s-4-8-9-8zm0 13c-.6 0-1.2 0-1.8-.1l-2.2 1.2.3-2.3C6.9 13.7 6 12.4 6 11c0-3.3 2.7-6 6-6s6 2.7 6 6-2.7 6-6 6z"/><circle cx="9.5" cy="9.5" r="1.5" fill="#F29111"/></svg>',
  Grafana:'<svg viewBox="0 0 24 24" width="18" height="18"><circle cx="12" cy="12" r="10" fill="#F46800"/><circle cx="12" cy="10" r="3" fill="#fff"/><path d="M6 18.2c1.29-1.94 3.5-3.22 6-3.22s4.71 1.28 6 3.22" fill="#fff"/></svg>',
  AWS:'<svg viewBox="0 0 24 24" width="18" height="18"><path fill="#FF9900" d="M21.21 16.79c-2.6 1.93-6.38 2.95-9.62 2.95-4.55 0-8.66-1.68-11.76-4.49-.24-.22-.03-.52.27-.35 3.35 1.95 7.5 3.13 11.78 3.13 2.89 0 6.07-.6 8.99-1.84.44-.19.81.29.34.6z"/></svg>',
  GCP:'<svg viewBox="0 0 24 24" width="18" height="18"><path fill="#4285F4" d="M12 7.2l3.9 6.8h-2.4l-1.5-2.6-1.5 2.6H8.1z"/><path fill="#EA4335" d="M15.9 14H20l-4-7H12z"/><path fill="#34A853" d="M12 20l-3.9-6h7.8z"/></svg>'
};

// i18n
const D={
  es:{
    newP:'Nuevo proyecto',reconf:'Reconfigurar',obS:'Paso {n} de {t}',obT1:'Que herramientas usa tu equipo?',obS1:'Selecciona las que quieras conectar.',obSrch:'Buscar herramientas...',obSel:'{n} seleccionada/s',cont:'Continuar',back:'Atras',obT2:'Conecta tu Jira',obS2:'Ingresa dominio y proyecto.',obJD:'Dominio de Jira',obPr:'Proyecto',obCA:'Conectar con Atlassian en navegador',obT3:'Conecta tu repositorio',obS3:'Vincula el repositorio del proyecto.',obPv:'Proveedor',obRe:'Repositorio',obGo:'Empezar a trabajar',
    backlog:'Backlog',myT:'Mis tareas',asgn:'{n} tareas',allT:'Todas',myOnly:'Asignadas a mi',pOk:'Pipeline OK',nErr:'0 errores',tsk:'Tareas',stp:'PASO',wh:'Que hay que hacer',spO:'Objetivo de la investigacion',crit:'Criterios para dar por terminado',spD:'Entregables esperados',fig:'Diseno en Figma',askAI:'Pedile a la IA que empiece',askSp:'Empezar a investigar con la IA',aiH:'Se abre tu chat (Claude, Copilot o Antigravity) con el contexto cargado.',wAI:'Trabaja con la IA',iAI:'Investiga con la IA',clCp:'Click en una sugerencia para copiarla y pegarla en tu chat.',ctxS:'Contexto enviado al asistente',sugL:'Sugerencias — click para copiar:',aiDT:'La IA termino, quiero testear',aiDD:'Ya tengo la info, documentar',testT:'Testear los cambios',testS:'La IA genero tests automaticos. Proba manualmente tambien.',aiTst:'Tests automaticos (IA)',rerun:'Ejecutar de nuevo',tPas:'{n}/{t} tests OK',mPrev:'Vista previa manual',allG:'Todo funciona, revisar',smW:'Algo fallo, volver al chat',docT:'Documentar hallazgos',docS:'Publica el resultado de tu investigacion.',cConf:'Crear pagina en Confluence',cNot:'Crear pagina en Notion',cOS:'Crear spec en OpenSpec',jCom:'Comentario para Jira',pubCl:'Publicar y cerrar ticket',revT:'Revisar y documentar',revS:'Agrega capturas y comentarios a Jira.',evid:'Evidencia',addSS:'Agregar captura',upMR:'Subir evidencia y continuar',mrT:'Crear Merge Request',mrS:'Todo listo para enviar.',branch:'Rama',tests:'Tests',crMR:'Crear Merge Request en GitLab',tDone:'Tarea completada',mrMsg:'Merge Request creado. Ticket movido a "En revision". El pipeline despliega.',spMsg:'Investigacion documentada. Ticket cerrado.',nxtT:'Siguiente tarea',cTls:'Herramientas conectadas',stS:'Administra tus integraciones.',conn:'Conectado',nPS:'Configurar nuevo proyecto',cpd:'Copiado',
    cPop:'Herramientas populares',cPr:'Gestion de proyecto',cCo:'Codigo',cDs:'Diseno',cDc:'Documentacion',cDa:'Base de datos',cMo:'Monitoreo',cCl:'Cloud',
    newTask:'Nueva tarea',delTask:'Eliminar',crTitle:'Crear nueva tarea',crTitleF:'Titulo',crDescF:'Descripcion',crTypeF:'Tipo',crCritF:'Criterios de aceptacion',crAdd:'Agregar criterio',crSave:'Crear tarea',crCancel:'Cancelar',noTasks:'No hay tareas. Crea una nueva.',
    vsPluginDetected:'Plugin VS Code detectado',openBrw:'Abriendo navegador...',assigned:'Asignado a'
  },
  en:{
    newP:'New project',reconf:'Reconfigure',obS:'Step {n} of {t}',obT1:'What tools does your team use?',obS1:'Select the ones you want to connect.',obSrch:'Search tools...',obSel:'{n} selected',cont:'Continue',back:'Back',obT2:'Connect your Jira',obS2:'Enter domain and project.',obJD:'Jira domain',obPr:'Project',obCA:'Connect with Atlassian in browser',obT3:'Connect your repository',obS3:'Link the project repository.',obPv:'Provider',obRe:'Repository',obGo:'Start working',
    backlog:'Backlog',myT:'My tasks',asgn:'{n} tasks',allT:'All',myOnly:'Assigned to me',pOk:'Pipeline OK',nErr:'0 errors',tsk:'Tasks',stp:'STEP',wh:'What needs to be done',spO:'Investigation objective',crit:'Acceptance criteria',spD:'Expected deliverables',fig:'Figma design',askAI:'Ask the AI to start',askSp:'Start investigating with AI',aiH:'Opens your AI chat (Claude, Copilot or Antigravity) with context loaded.',wAI:'Work with AI',iAI:'Investigate with AI',clCp:'Click a suggestion to copy and paste in your AI chat.',ctxS:'Context sent to assistant',sugL:'Suggestions — click to copy:',aiDT:"AI is done, let's test",aiDD:"Got the info, document",testT:'Test the changes',testS:'AI generated automated tests. You can also test manually.',aiTst:'Automated tests (AI)',rerun:'Re-run',tPas:'{n}/{t} tests OK',mPrev:'Manual preview',allG:"All good, let's review",smW:'Something failed, back to chat',docT:'Document findings',docS:'Publish your research results.',cConf:'Create Confluence page',cNot:'Create Notion page',cOS:'Create OpenSpec spec',jCom:'Jira comment',pubCl:'Publish and close ticket',revT:'Review and document',revS:'Add screenshots and comments to Jira.',evid:'Evidence',addSS:'Add screenshot',upMR:'Upload evidence and continue',mrT:'Create Merge Request',mrS:'All set to submit.',branch:'Branch',tests:'Tests',crMR:'Create Merge Request on GitLab',tDone:'Task completed',mrMsg:'MR created. Ticket moved to "In Review". Pipeline handles deploy.',spMsg:'Research documented. Ticket closed.',nxtT:'Next task',cTls:'Connected tools',stS:'Manage your integrations.',conn:'Connected',nPS:'Set up new project',cpd:'Copied',
    cPop:'Popular tools',cPr:'Project management',cCo:'Code',cDs:'Design',cDc:'Documentation',cDa:'Database',cMo:'Monitoring',cCl:'Cloud',
    newTask:'New task',delTask:'Delete',crTitle:'Create new task',crTitleF:'Title',crDescF:'Description',crTypeF:'Type',crCritF:'Acceptance criteria',crAdd:'Add criterion',crSave:'Create task',crCancel:'Cancel',noTasks:'No tasks yet. Create one.',
    vsPluginDetected:'VS Code plugin detected',openBrw:'Opening browser...',assigned:'Assigned to'
  }
};
function t(k,v){let s=(D[L]&&D[L][k])||k;if(v)Object.entries(v).forEach(([a,b])=>{s=s.replace('{'+a+'}',b)});return s}

// Connectors catalog
const popularNames=['Jira','GitHub','GitLab','Figma','Asana','ClickUp'];
const cnList=[
  {n:'Jira',c:'cPr',d:'Tickets & sprints'},
  {n:'Asana',c:'cPr',d:{es:'Tareas y proyectos',en:'Tasks & projects'}},
  {n:'ClickUp',c:'cPr',d:{es:'Tareas y documentos',en:'Tasks & docs'}},
  {n:'Confluence',c:'cPr',d:{es:'Documentacion',en:'Documentation'}},
  {n:'Notion',c:'cPr',d:{es:'Notas y wikis',en:'Notes & wikis'}},
  {n:'GitLab',c:'cCo',d:'Merge requests & CI/CD'},
  {n:'GitHub',c:'cCo',d:'Pull requests & Actions'},
  {n:'Figma',c:'cDs',d:{es:'Disenos y prototipos',en:'Designs & prototypes'}},
  {n:'OpenSpec',c:'cDc',d:'Specs & API docs'},
  {n:'PostgreSQL',c:'cDa',d:'SQL database'},
  {n:'MySQL',c:'cDa',d:'SQL database'},
  {n:'Supabase',c:'cDa',d:'Database & Auth'},
  {n:'Firebase',c:'cDa',d:'Database & Realtime'},
  {n:'Grafana',c:'cMo',d:{es:'Monitoreo y dashboards',en:'Monitoring & dashboards'}},
  {n:'AWS',c:'cCl',d:'Cloud services'},
  {n:'GCP',c:'cCl',d:'Google Cloud Platform'}
];
const catOrder=['cPr','cCo','cDs','cDc','cDa','cMo','cCl'];
const tDet={
  Jira:'atlassian.net',Asana:'asana.com',ClickUp:'clickup.com',GitLab:'gitlab.com',GitHub:'github.com',
  Supabase:'supabase.co',Firebase:'firebase.com',PostgreSQL:'postgres:5432',MySQL:'mysql:3306',
  Grafana:'grafana.com',AWS:'us-east-1',Confluence:'atlassian.net/wiki',Notion:'notion.so',
  Figma:'figma.com',OpenSpec:'openspec.io',GCP:'cloud.google.com'
};

// Tasks (mutable)
let nextId=200;
const defaultTasks={
  'PROJ-104':{
    title:{es:'Filtro por fecha en facturas',en:'Invoice date filter'},
    desc:{es:'Como admin, quiero filtrar facturas por fecha para conciliar pagos sin revisar 500 registros.',en:'As an admin, I want to filter invoices by date to reconcile payments without reviewing 500 records.'},
    status:{es:'En curso',en:'In progress'},color:'blue',type:'story',figma:true,assignedTo:'me',
    criteria:{es:['Selector desplegable visible','Opciones: 7 dias / Todas','Filtrado instantaneo'],en:['Visible dropdown selector','Options: 7 days / All','Instant filtering']}
  },
  'PROJ-105':{
    title:{es:'Investigar pasarela de pago Latam',en:'Investigate Latam payment gateway'},
    desc:{es:'Comparar pasarelas que soporten tarjetas locales en Argentina, Colombia y Mexico.',en:'Compare gateways supporting local cards in Argentina, Colombia and Mexico.'},
    status:{es:'En curso',en:'In progress'},color:'purple',type:'spike',assignedTo:'me',
    criteria:{es:['Comparar 3+ pasarelas','Costos por transaccion','Documentar en Confluence'],en:['Compare 3+ gateways','Per-transaction costs','Document in Confluence']}
  },
  'PROJ-102':{
    title:{es:'Validar longitud CVC',en:'Validate CVC length'},
    desc:{es:'Prevenir cobros rechazados cuando AmEx necesita 4 digitos.',en:'Prevent rejected charges when AmEx needs 4-digit CVC.'},
    status:{es:'Para revisar',en:'For review'},color:'amber',type:'bug',assignedTo:'me',
    criteria:{es:['CVC valida 3 digitos','AmEx acepta 4','Error claro'],en:['CVC validates 3 digits','AmEx accepts 4','Clear error']}
  },
  'PROJ-108':{
    title:{es:'Notificacion por email al fallar pago recurrente',en:'Email notification on recurring payment failure'},
    desc:{es:'Enviar recordatorio automatico al usuario con link directo a actualizar tarjeta.',en:'Send automatic reminder to user with direct link to update card.'},
    status:{es:'Backlog',en:'Backlog'},color:'blue',type:'story',assignedTo:'team',
    criteria:{es:['Plantilla de email en SendGrid','Webhook de reintento fallido','Test de envio'],en:['Email template in SendGrid','Failed retry webhook','Delivery test']}
  },
  'PROJ-110':{
    title:{es:'Optimizacion de queries en reporte mensual',en:'Monthly report query optimization'},
    desc:{es:'El reporte tarda 14s en cargar para cuentas con mas de 10k transacciones.',en:'Report takes 14s to load for accounts with over 10k transactions.'},
    status:{es:'Backlog',en:'Backlog'},color:'amber',type:'bug',assignedTo:'team',
    criteria:{es:['Agregar indices en created_at y account_id','Bajar tiempo a <1s'],en:['Add indexes on created_at and account_id','Reduce time to <1s']}
  }
};
let tasks = ${tasksJson} || JSON.parse(JSON.stringify(defaultTasks));

function saveTasks(){vsc.postMessage({type:'saveTasks',tasks})}

// Screen management
function showScr(n){
  ['sOb','sHome','sTk','sSet','sCreate'].forEach(id=>document.getElementById(id).style.display='none');
  const map={onboarding:'sOb',home:'sHome',ticket:'sTk',settings:'sSet',create:'sCreate'};
  document.getElementById(map[n]).style.display='';
  if(n==='onboarding')rOb();if(n==='home')rHome();if(n==='settings')rSet();if(n==='create')rCreate();
  updTop();
}
function updTop(){
  document.getElementById('bNP').innerText=t('newP');
  document.getElementById('bRC').innerText=t('reconf');
}
function cLang(l){
  L=l;
  document.getElementById('lEs').className=l==='es'?'active':'';
  document.getElementById('lEn').className=l==='en'?'active':'';
  vsc.postMessage({type:'changeLang',lang:l});
}

// ---- ONBOARDING ----
let obS=1;
function rOb(){
  document.getElementById('sOb').innerHTML='<div class="ctr fi" id="obC"></div>';
  rObS();
}
function rObS(){
  const c=document.getElementById('obC');if(!c)return;
  if(obS===1){
    let cats={};cnList.forEach(cn=>{if(!cats[cn.c])cats[cn.c]=[];cats[cn.c].push(cn)});
    let h='<div style="text-align:center;font-size:12px;color:var(--vscode-descriptionForeground);margin-bottom:14px;font-weight:600">'+t('obS',{n:1,t:3})+'</div>';
    h+='<h2 style="font-size:16px;font-weight:700;text-align:center;margin-bottom:4px">'+t('obT1')+'</h2><p style="font-size:12px;color:var(--vscode-descriptionForeground);text-align:center;margin-bottom:12px">'+t('obS1')+'</p>';
    h+='<div style="position:relative;margin-bottom:10px"><svg style="position:absolute;left:10px;top:50%;transform:translateY(-50%)" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--vscode-descriptionForeground)" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg><input class="inp" style="padding-left:30px" placeholder="'+t('obSrch')+'" oninput="fC(this.value)"></div>';
    
    h+='<div style="overflow-y:auto;padding-right:4px" id="cList">';
    
    // Frequently used / Popular section
    h+='<div class="cat-lbl" data-cat="popular" style="color:var(--vscode-focusBorder)">'+t('cPop')+'</div>';
    popularNames.forEach(pName=>{
      const cn=cnList.find(x=>x.n===pName);
      if(!cn)return;
      const s=selC.has(cn.n);
      const d=typeof cn.d==='string'?cn.d:(cn.d[L]||cn.d.es||cn.d.en);
      let detectedTag='';
      if((cn.n==='GitLab'&&detExts.gitlab)||(cn.n==='GitHub'&&detExts.github)||(cn.n==='Jira'&&detExts.jira)){
        detectedTag='<span class="ext-badge">'+svgCheck+' '+t('vsPluginDetected')+'</span>';
      }
      h+='<div class="cc'+(s?' sel':'')+'" data-name="'+cn.n+'" data-cat="popular" onclick="tC(this)">'+(lg[cn.n]||'')+'<div style="flex:1"><div style="display:flex;align-items:center;gap:6px"><span style="font-size:13px;font-weight:600">'+cn.n+'</span>'+detectedTag+'</div><div style="font-size:11px;color:var(--vscode-descriptionForeground)">'+d+'</div></div></div>';
    });

    // Categories
    catOrder.forEach(cat=>{
      if(!cats[cat])return;
      h+='<div class="cat-lbl" data-cat="'+cat+'">'+t(cat)+'</div>';
      cats[cat].forEach(cn=>{
        const s=selC.has(cn.n);
        const d=typeof cn.d==='string'?cn.d:(cn.d[L]||cn.d.es||cn.d.en);
        let detectedTag='';
        if((cn.n==='GitLab'&&detExts.gitlab)||(cn.n==='GitHub'&&detExts.github)||(cn.n==='Jira'&&detExts.jira)){
          detectedTag='<span class="ext-badge">'+svgCheck+' '+t('vsPluginDetected')+'</span>';
        }
        h+='<div class="cc'+(s?' sel':'')+'" data-name="'+cn.n+'" data-cat="'+cat+'" onclick="tC(this)">'+(lg[cn.n]||'')+'<div style="flex:1"><div style="display:flex;align-items:center;gap:6px"><span style="font-size:13px;font-weight:600">'+cn.n+'</span>'+detectedTag+'</div><div style="font-size:11px;color:var(--vscode-descriptionForeground)">'+d+'</div></div></div>';
      });
    });
    
    h+='</div><div style="display:flex;align-items:center;justify-content:space-between;margin-top:10px"><span style="font-size:11px;color:var(--vscode-descriptionForeground)" id="cCnt">'+t('obSel',{n:selC.size})+'</span><button class="bp" style="width:auto;padding:8px 20px" onclick="obN(2)">'+t('cont')+'</button></div>';
    c.innerHTML=h;
  }else if(obS===2){
    let jDetMsg='';
    if(detExts.jira){
      jDetMsg='<div style="margin-bottom:10px" class="ext-badge">'+svgCheck+' '+t('vsPluginDetected')+' (Atlassian)</div>';
    }
    c.innerHTML='<div style="text-align:center;font-size:12px;color:var(--vscode-descriptionForeground);margin-bottom:14px;font-weight:600">'+t('obS',{n:2,t:3})+'</div><h2 style="font-size:16px;font-weight:700;text-align:center;margin-bottom:4px">'+t('obT2')+'</h2><p style="font-size:12px;color:var(--vscode-descriptionForeground);text-align:center;margin-bottom:14px">'+t('obS2')+'</p>'+jDetMsg+'<label class="lbl">'+t('obJD')+'</label><input class="inp" id="obJiraDom" value="tu-empresa.atlassian.net" style="margin-bottom:8px"><label class="lbl">'+t('obPr')+'</label><input class="inp" id="obJiraProj" value="PROJ" style="margin-bottom:8px"><button class="bs" style="margin-bottom:14px" onclick="connectJira()"><span style="display:flex;align-items:center;gap:6px">'+lg.Jira+' '+t('obCA')+'</span> '+svgExtLink+'</button><div style="display:flex;gap:8px"><button class="bs" onclick="obN(1)">'+t('back')+'</button><button class="bp" onclick="obN(3)">'+t('cont')+'</button></div>';
  }else if(obS===3){
    let repoExtInfo='';
    if(detExts.gitlab||detExts.github){
      repoExtInfo='<div style="margin-bottom:10px" class="ext-badge">'+svgCheck+' '+(detExts.gitlab?'GitLab Workflow':'GitHub Pull Requests')+' detectado en VS Code</div>';
    }
    c.innerHTML='<div style="text-align:center;font-size:12px;color:var(--vscode-descriptionForeground);margin-bottom:14px;font-weight:600">'+t('obS',{n:3,t:3})+'</div><h2 style="font-size:16px;font-weight:700;text-align:center;margin-bottom:4px">'+t('obT3')+'</h2><p style="font-size:12px;color:var(--vscode-descriptionForeground);text-align:center;margin-bottom:14px">'+t('obS3')+'</p>'+repoExtInfo+'<label class="lbl">'+t('obPv')+'</label><select class="inp" id="repoPv" style="margin-bottom:8px"><option value="GitLab">GitLab</option><option value="GitHub">GitHub</option></select><label class="lbl">'+t('obRe')+'</label><input class="inp" id="repoName" value="tu-org/checkout-service" style="margin-bottom:8px"><button class="bs" style="margin-bottom:14px" onclick="connectRepo()"><span style="display:flex;align-items:center;gap:6px">'+svgExtLink+' Abrir repo en navegador</span></button><div style="display:flex;gap:8px"><button class="bs" onclick="obN(2)">'+t('back')+'</button><button class="bp" onclick="finOb()">'+t('obGo')+'</button></div>';
  }
}
function connectJira(){
  const dom=document.getElementById('obJiraDom')?document.getElementById('obJiraDom').value.trim():'atlassian.net';
  const url='https://'+dom.replace(/^https?:\/\//,'');
  toast(t('openBrw'));
  vsc.postMessage({type:'openExternal',url});
}
function connectRepo(){
  const pv=document.getElementById('repoPv')?document.getElementById('repoPv').value:'GitLab';
  const repo=document.getElementById('repoName')?document.getElementById('repoName').value.trim():'';
  const base=pv==='GitLab'?'https://gitlab.com/':'https://github.com/';
  toast(t('openBrw'));
  vsc.postMessage({type:'openExternal',url:base+repo});
}
function obN(s){obS=s;rObS()}
function tC(el){
  const n=el.dataset.name;
  if(selC.has(n)){
    selC.delete(n);
    document.querySelectorAll('.cc[data-name="'+n+'"]').forEach(e=>e.classList.remove('sel'));
  }else{
    selC.add(n);
    document.querySelectorAll('.cc[data-name="'+n+'"]').forEach(e=>e.classList.add('sel'));
  }
  const cnt=document.getElementById('cCnt');
  if(cnt)cnt.innerText=t('obSel',{n:selC.size});
}
function fC(q){
  q=q.toLowerCase();
  document.querySelectorAll('.cc').forEach(c=>{
    c.classList.toggle('hid',q&&!c.dataset.name.toLowerCase().includes(q));
  });
  document.querySelectorAll('.cat-lbl').forEach(l=>{
    const cat=l.dataset.cat;
    l.style.display=Array.from(document.querySelectorAll('.cc[data-cat="'+cat+'"]')).some(c=>!c.classList.contains('hid'))?'':'none';
  });
}
function startOb(){
  obS=1;
  selC=new Set(cTools||[]);
  showScr('onboarding');
}
function finOb(){
  cTools=Array.from(selC);
  if(cTools.length===0){cTools=['Jira','GitLab'];}
  onb=true;
  document.getElementById('topAct').style.display='flex';
  document.getElementById('topLbl').innerText='· PROJ / checkout';
  vsc.postMessage({type:'finishOnboarding',tools:cTools});
  showScr('home');
  toast(L==='es'?'Proyecto configurado':'Project configured');
}

// ---- HOME / BACKLOG ----
function setFilter(f){
  filterMode=f;
  rHome();
}
function rHome(){
  const el=document.getElementById('sHome');
  const allIds=Object.keys(tasks);
  const ids = filterMode === 'me' ? allIds.filter(id => tasks[id].assignedTo === 'me') : allIds;

  let h='<div class="ctr fi">';
  
  // Header with Backlog & Filter
  h+='<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px">';
  h+='<div><h1 style="font-size:18px;font-weight:700">'+t('backlog')+'</h1><p style="font-size:12px;color:var(--vscode-descriptionForeground);margin-top:2px">Sprint 24 · '+t('asgn',{n:allIds.length})+'</p></div>';
  
  // Filter tabs
  h+='<div class="filter-tabs">';
  h+='<button class="filter-tab '+(filterMode==='all'?'active':'')+'" onclick="setFilter(\'all\')">'+t('allT')+'</button>';
  h+='<button class="filter-tab '+(filterMode==='me'?'active':'')+'" onclick="setFilter(\'me\')">'+t('myOnly')+'</button>';
  h+='</div>';
  h+='</div>';

  // Create task button
  h+='<div class="tr" style="border-style:dashed;cursor:pointer;justify-content:center;padding:10px" onclick="showScr(\'create\')"><div style="display:flex;align-items:center;gap:6px;color:var(--vscode-descriptionForeground)">'+svgPlus+'<span style="font-size:13px;font-weight:600">'+t('newTask')+'</span></div></div>';

  if(ids.length===0){
    h+='<p style="text-align:center;color:var(--vscode-descriptionForeground);font-size:13px;padding:20px">'+t('noTasks')+'</p>';
  }else{
    const tL={story:'Story',bug:'Bug',spike:'Spike'};
    ids.forEach(id=>{
      const tk=tasks[id];
      const title=tk.title[L]||tk.title.es||tk.title.en||tk.title;
      const desc=tk.desc[L]||tk.desc.es||tk.desc.en||tk.desc;
      const status=tk.status[L]||tk.status.es||tk.status.en||tk.status;
      const isMine=tk.assignedTo==='me';

      h+='<div class="tr" onclick="openTk(\''+id+'\')"><div style="flex:1">';
      h+='<div style="display:flex;align-items:center;gap:6px;margin-bottom:4px;flex-wrap:wrap">';
      h+='<span style="font-size:12px;font-family:monospace;font-weight:700;color:var(--vscode-textLink-foreground)">'+id+'</span>';
      h+='<span class="badge" style="background:rgba(59,130,246,.12);color:#60a5fa">'+status+'</span>';
      h+='<span class="badge" style="background:rgba(139,92,246,.08);color:#a78bfa;border:1px solid rgba(139,92,246,.15)">'+(tL[tk.type]||tk.type)+'</span>';
      if(isMine){
        h+='<span class="badge" style="background:rgba(16,185,129,.1);color:#10b981">'+(L==='es'?'Para mi':'Assigned to me')+'</span>';
      }
      if(tk.figma)h+='<span style="font-size:10px;color:var(--vscode-descriptionForeground);display:flex;align-items:center;gap:2px">'+lg.Figma+'</span>';
      h+='</div>';
      h+='<div style="font-size:13px;font-weight:600">'+title+'</div>';
      h+='<div style="font-size:12px;color:var(--vscode-descriptionForeground);margin-top:2px">'+((desc||'').substring(0,90))+'</div></div>';
      h+='<div style="display:flex;align-items:center;gap:4px"><button class="del-btn" onclick="event.stopPropagation();delTk(\''+id+'\')" title="'+t('delTask')+'">'+svgDel+'</button>'+svgChev+'</div></div>';
    });
  }
  h+='</div>';
  el.innerHTML=h;
}

function delTk(id){vsc.postMessage({type:'confirmDelete',ticketId:id})}

// ---- CREATE TASK ----
let newCriteria=[];
function rCreate(){
  newCriteria=[''];
  const el=document.getElementById('sCreate');
  el.innerHTML='<div style="padding:8px 16px;border-bottom:1px solid var(--vscode-panel-border);display:flex;align-items:center;gap:6px;font-size:12px;background:var(--vscode-titleBar-activeBackground)"><button style="background:none;border:none;color:var(--vscode-descriptionForeground);cursor:pointer;display:flex;align-items:center;gap:4px;font-size:12px" onclick="showScr(\'home\')">'+svgBack+t('tsk')+'</button><span style="color:var(--vscode-panel-border)">/</span><span style="font-weight:600">'+t('crTitle')+'</span></div><div class="ctr fi" id="crForm"></div>';
  rCreateForm();
}
function rCreateForm(){
  const c=document.getElementById('crForm');
  let h='<label class="lbl" style="margin-top:8px">'+t('crTitleF')+'</label><input class="inp" id="nTitle" placeholder="'+(L==='es'?'Ej: Agregar boton de pago':'E.g. Add payment button')+'" style="margin-bottom:10px">';
  h+='<label class="lbl">'+t('crDescF')+'</label><textarea class="inp" id="nDesc" rows="3" style="resize:none;margin-bottom:10px" placeholder="'+(L==='es'?'Describe que hay que hacer...':'Describe what needs to be done...')+'"></textarea>';
  h+='<div style="display:flex;gap:8px;margin-bottom:10px"><div style="flex:1"><label class="lbl">'+t('crTypeF')+'</label><select class="inp" id="nType"><option value="story">Story</option><option value="bug">Bug</option><option value="spike">Spike</option></select></div><div style="flex:1"><label class="lbl">'+t('assigned')+'</label><select class="inp" id="nAssignee"><option value="me">'+(L==='es'?'Para mi':'Assigned to me')+'</option><option value="team">'+(L==='es'?'Equipo':'Team')+'</option></select></div></div>';
  h+='<label class="lbl">'+t('crCritF')+'</label><div id="critList"></div>';
  h+='<button class="bs" style="margin-bottom:14px;font-size:12px;padding:6px" onclick="addCrit()">'+svgPlus+' '+t('crAdd')+'</button>';
  h+='<div style="display:flex;gap:8px"><button class="bs" onclick="showScr(\'home\')">'+t('crCancel')+'</button><button class="bp" onclick="saveNewTask()">'+t('crSave')+'</button></div>';
  c.innerHTML=h;
  rCritList();
}
function rCritList(){
  const c=document.getElementById('critList');if(!c)return;
  c.innerHTML=newCriteria.map((v,i)=>'<div class="crit-row"><input class="inp" value="'+v.replace(/"/g,'&quot;')+'" oninput="newCriteria['+i+']=this.value" placeholder="'+(L==='es'?'Criterio '+(i+1):'Criterion '+(i+1))+'"><button onclick="rmCrit('+i+')">'+svgX+'</button></div>').join('');
}
function addCrit(){newCriteria.push('');rCritList()}
function rmCrit(i){newCriteria.splice(i,1);if(newCriteria.length===0)newCriteria=[''];rCritList()}
function saveNewTask(){
  const title=document.getElementById('nTitle').value.trim();
  const desc=document.getElementById('nDesc').value.trim();
  const type=document.getElementById('nType').value;
  const assignedTo=document.getElementById('nAssignee').value;
  if(!title){toast(L==='es'?'El titulo es obligatorio':'Title is required');return}
  const crit=newCriteria.filter(c=>c.trim());
  if(crit.length===0){toast(L==='es'?'Agrega al menos un criterio':'Add at least one criterion');return}
  nextId++;
  const id='PROJ-'+nextId;
  tasks[id]={
    title:{es:title,en:title},
    desc:{es:desc,en:desc},
    status:{es:'En curso',en:'In progress'},
    color:'blue',type,assignedTo,
    criteria:{es:crit,en:crit}
  };
  saveTasks();
  toast((L==='es'?'Tarea creada: ':'Task created: ')+id);
  showScr('home');
}

// ---- TICKET WORKSPACE ----
function openTk(id){aTk=id;cS=1;showScr('ticket');rTk()}
function gSt(tk){return tk.type==='spike'?4:5}
function rTk(){
  const tk=tasks[aTk];if(!tk)return;
  const total=gSt(tk);
  let h='<div style="padding:8px 16px;border-bottom:1px solid var(--vscode-panel-border);display:flex;align-items:center;justify-content:space-between;font-size:12px;background:var(--vscode-titleBar-activeBackground)"><div style="display:flex;align-items:center;gap:6px"><button style="background:none;border:none;color:var(--vscode-descriptionForeground);cursor:pointer;display:flex;align-items:center;gap:4px;font-size:12px" onclick="showScr(\'home\')">'+svgBack+t('tsk')+'</button><span style="color:var(--vscode-panel-border)">/</span><span style="font-weight:700;color:var(--vscode-textLink-foreground);font-family:monospace">'+aTk+'</span><span class="badge" style="background:rgba(139,92,246,.12);color:#a78bfa">'+{story:'Story',bug:'Bug',spike:'Spike'}[tk.type]+'</span></div><div style="display:flex;align-items:center;gap:4px">';
  for(let i=1;i<=total;i++){if(i>1)h+='<div style="width:10px;height:1px;background:var(--vscode-panel-border)"></div>';h+='<div class="sd '+(i<cS?'sd-d':i===cS?'sd-a':'sd-p')+'"></div>'}
  h+='</div></div><div class="ctr fi" id="sC"></div>';
  document.getElementById('sTk').innerHTML=h;
  rSC();
}
function goS(n){cS=n;rTk()}

function rSC(){
  const c=document.getElementById('sC');const tk=tasks[aTk];if(!c||!tk)return;
  const sp=tk.type==='spike',ti=tk.title[L]||tk.title.es||tk.title.en||tk.title,de=tk.desc[L]||tk.desc.es||tk.desc.en||tk.desc,cr=(tk.criteria[L]||tk.criteria.es||tk.criteria.en||tk.criteria||[]);

  if(cS===1){
    let fig='';if(tk.figma)fig='<div class="card card-bg" style="padding:0;overflow:hidden"><div style="padding:8px 12px;border-bottom:1px solid var(--vscode-panel-border);display:flex;align-items:center;gap:6px;font-size:12px">'+lg.Figma+'<strong>'+t('fig')+'</strong></div><div style="padding:12px;display:flex;justify-content:center;background:#1a1a20"><div style="width:100%;max-width:320px;background:#fff;border-radius:6px;overflow:hidden;box-shadow:0 4px 10px rgba(0,0,0,.3)"><div style="background:#f1f5f9;padding:6px 8px;font-size:11px;color:#64748b;font-weight:700">Mockup</div><div style="padding:8px;display:flex;align-items:center;justify-content:space-between"><span style="font-size:12px;font-weight:700;color:#0f172a">'+(L==='es'?'Historial':'History')+'</span><div style="border:1px solid #93c5fd;border-radius:4px;padding:3px 6px;background:#eff6ff;font-size:10px;color:#2563eb;font-weight:600">'+(L==='es'?'7 dias':'7 days')+'</div></div></div></div></div>';
    c.innerHTML='<div style="margin-bottom:4px"><span style="font-size:11px;color:var(--vscode-descriptionForeground);font-weight:600">'+t('stp')+' 1</span></div><h2 style="font-size:15px;font-weight:700;margin-bottom:4px">'+ti+'</h2><p style="font-size:12px;color:var(--vscode-descriptionForeground);margin-bottom:14px">'+(sp?(L==='es'?'Ticket de investigacion. Lee el objetivo.':'Investigation ticket. Read the objective.'):(L==='es'?'Lee los detalles y pedi a la IA que empiece.':'Read the details and ask the AI to start.'))+'</p><div class="card card-bg"><div class="lbl" style="text-transform:uppercase;letter-spacing:.05em;margin-bottom:6px">'+t(sp?'spO':'wh')+'</div><p style="font-size:13px;line-height:1.5">'+de+'</p></div>'+fig+'<div class="card card-bg"><div class="lbl" style="text-transform:uppercase;letter-spacing:.05em;margin-bottom:8px">'+t(sp?'spD':'crit')+'</div><div style="display:flex;flex-direction:column;gap:6px">'+cr.map(x=>'<div style="display:flex;align-items:center;gap:8px;font-size:13px"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--vscode-descriptionForeground)" stroke-width="2"><circle cx="12" cy="12" r="10"/></svg>'+x+'</div>').join('')+'</div></div><button class="bp" onclick="startAiWithTicket()">'+svgChat+' '+t(sp?'askSp':'askAI')+'</button><p style="text-align:center;font-size:11px;color:var(--vscode-descriptionForeground);margin-top:6px">'+t('aiH')+'</p>';
  }
  else if(cS===2){
    const fullPrompt = buildTicketPrompt(tk, aTk);
    const pr=sp?(L==='es'?['Investiga opciones y compara alternativas','Arma una tabla comparativa con pros y contras','Cual es la recomendacion final para arquitectura?']:['Investigate options and compare alternatives','Create a comparison table with pros and cons','What is the final architectural recommendation?']):(L==='es'?['Genera los tests automaticos para estos criterios','Explicame los archivos que modificaste','Como pruebo este cambio en localhost?']:['Generate automated tests for these criteria','Explain the files you modified','How do I test this change on localhost?']);

    c.innerHTML='<div style="margin-bottom:4px"><span style="font-size:11px;color:var(--vscode-descriptionForeground);font-weight:600">'+t('stp')+' 2</span></div><h2 style="font-size:15px;font-weight:700;margin-bottom:4px">'+t(sp?'iAI':'wAI')+'</h2><p style="font-size:12px;color:var(--vscode-descriptionForeground);margin-bottom:14px">'+(L==='es'?'El contexto fue copiado. Pegalo con Cmd+V o Ctrl+V en tu chat.':'Context was copied. Paste with Cmd+V or Ctrl+V in your chat.')+'</p>'+
    '<div class="card" style="border-color:rgba(16,185,129,.3);background:rgba(16,185,129,.05);margin-bottom:12px">'+
      '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:4px">'+
        '<div style="display:flex;align-items:center;gap:6px;font-weight:600;color:#10b981;font-size:12px">'+svgCheck+'<span>'+(L==='es'?'Prompt copiado y listo':'Prompt copied and ready')+'</span></div>'+
        '<button class="bs" style="width:auto;padding:3px 8px;font-size:11px" onclick="reopenChat()">'+svgChat+' '+(L==='es'?'Reabrir chat':'Reopen chat')+'</button>'+
      '</div>'+
      '<p style="font-size:11px;color:var(--vscode-descriptionForeground)">'+aTk+' — '+cr.length+' '+(L==='es'?'criterios incluidos':'criteria included')+'</p>'+
    '</div>'+

    '<div class="card card-bg" style="margin-bottom:14px">'+
      '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">'+
        '<div class="lbl" style="text-transform:uppercase;letter-spacing:.05em;margin:0">'+(L==='es'?'Prompt para tu asistente':'Prompt for your assistant')+'</div>'+
        '<button class="bs" style="width:auto;padding:3px 8px;font-size:11px" onclick="cpFullPrompt()">'+svgCopy+' '+(L==='es'?'Copiar de nuevo':'Copy again')+'</button>'+
      '</div>'+
      '<div style="background:var(--vscode-input-background);border:1px solid var(--vscode-input-border);border-radius:6px;padding:8px;font-size:11px;font-family:monospace;white-space:pre-wrap;max-height:120px;overflow-y:auto;color:var(--vscode-input-foreground);line-height:1.4" id="fullPromptBox">'+fullPrompt.replace(/</g,'&lt;')+'</div>'+
    '</div>'+

    '<div style="font-size:12px;font-weight:600;color:var(--vscode-descriptionForeground);margin-bottom:6px">'+t('sugL')+'</div>'+
    pr.map(p=>'<button class="pb" onclick="cpP(this,\''+p.replace(/'/g,"\\'")+'\')"><span>'+p+'</span>'+svgCopy+'</button>').join('')+
    '<div style="margin-top:14px"><button class="bp" onclick="goS(3)">'+svgCheck+' '+(sp?t('aiDD'):t('aiDT'))+'</button></div>';
  }
  else if(cS===3&&sp){
    c.innerHTML='<div style="margin-bottom:4px"><span style="font-size:11px;color:var(--vscode-descriptionForeground);font-weight:600">'+t('stp')+' 3</span></div><h2 style="font-size:15px;font-weight:700;margin-bottom:4px">'+t('docT')+'</h2><p style="font-size:12px;color:var(--vscode-descriptionForeground);margin-bottom:14px">'+t('docS')+'</p><div style="display:flex;flex-direction:column;gap:6px;margin-bottom:14px"><button class="pb" onclick="toast(\'Creating...\')">'+lg.Confluence+'<span style="flex:1;text-align:left">'+t('cConf')+'</span></button><button class="pb" onclick="toast(\'Creating...\')">'+lg.Notion+'<span style="flex:1;text-align:left">'+t('cNot')+'</span></button><button class="pb" onclick="toast(\'Creating...\')">'+lg.OpenSpec+'<span style="flex:1;text-align:left">'+t('cOS')+'</span></button></div><div class="card card-bg"><label class="lbl">'+t('jCom')+'</label><textarea class="inp" rows="3" style="resize:none" placeholder="..."></textarea></div><button class="bp" style="background:#10b981" onclick="goS(4)">'+t('pubCl')+'</button>';
  }
  else if(cS===3&&!sp){
    c.innerHTML='<div style="margin-bottom:4px"><span style="font-size:11px;color:var(--vscode-descriptionForeground);font-weight:600">'+t('stp')+' 3</span></div><h2 style="font-size:15px;font-weight:700;margin-bottom:4px">'+t('testT')+'</h2><p style="font-size:12px;color:var(--vscode-descriptionForeground);margin-bottom:14px">'+t('testS')+'</p><div class="card card-bg"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px"><div class="lbl" style="text-transform:uppercase;letter-spacing:.05em;margin:0">'+t('aiTst')+'</div><div style="display:flex;gap:6px"><button style="background:none;border:none;color:var(--vscode-textLink-foreground);font-size:11px;cursor:pointer;font-weight:600" onclick="runTermTests()">'+(L==='es'?'En terminal':'In terminal')+'</button><button style="background:none;border:none;color:var(--vscode-textLink-foreground);font-size:11px;cursor:pointer;font-weight:600" onclick="toast(\'Running...\')">'+t('rerun')+'</button></div></div>'+cr.map((_,i)=>'<div class="tok">'+svgCheck+'<span style="font-family:monospace;font-size:11px">test_'+(i+1)+'</span><span style="margin-left:auto;font-weight:600">OK</span></div>').join('')+'<div style="margin-top:4px;font-size:11px;color:#10b981;font-weight:600">'+t('tPas',{n:cr.length,t:cr.length})+'</div></div><div class="card card-bg" style="padding:0;overflow:hidden"><div style="padding:8px 12px;border-bottom:1px solid var(--vscode-panel-border);display:flex;justify-content:space-between;font-size:12px"><strong>'+t('mPrev')+'</strong><span style="font-family:monospace;color:#10b981;font-size:11px">localhost:3000</span></div><div style="padding:14px;display:flex;justify-content:center;background:#080810"><div style="width:100%;max-width:360px;background:#fff;border-radius:6px;overflow:hidden;box-shadow:0 4px 10px rgba(0,0,0,.4)"><div style="background:#0f172a;color:#fff;padding:6px 10px;font-size:11px;font-weight:700">App Preview</div><div style="padding:10px;font-size:12px;color:#334155;text-align:center">'+(L==='es'?'Vista previa interactiva de la aplicacion':'Interactive app preview')+'</div></div></div></div><button class="bp" onclick="goS(4)" style="margin-top:4px">'+t('allG')+'</button><button class="bs" onclick="goS(2)" style="margin-top:6px">'+t('smW')+'</button>';
  }
  else if(cS===4&&sp){sDone(t('spMsg'))}
  else if(cS===4&&!sp){
    c.innerHTML='<div style="margin-bottom:4px"><span style="font-size:11px;color:var(--vscode-descriptionForeground);font-weight:600">'+t('stp')+' 4</span></div><h2 style="font-size:15px;font-weight:700;margin-bottom:4px">'+t('revT')+'</h2><p style="font-size:12px;color:var(--vscode-descriptionForeground);margin-bottom:14px">'+t('revS')+'</p><div class="card" style="border-color:rgba(16,185,129,.3);background:rgba(16,185,129,.05)"><div style="display:flex;align-items:center;gap:6px;font-size:12px;font-weight:600;color:#10b981">'+svgCheck+cr.length+'/'+cr.length+' + tests OK</div></div><div class="card card-bg"><div class="lbl" style="text-transform:uppercase;letter-spacing:.05em;margin-bottom:8px">'+t('evid')+'</div><button class="bs" style="border-style:dashed;margin-bottom:8px;font-size:12px;padding:8px" onclick="addSS()">'+svgCam+' '+t('addSS')+'</button><div id="evL"></div><label class="lbl" style="margin-top:8px">'+t('jCom')+'</label><textarea class="inp" rows="2" style="resize:none" placeholder="..."></textarea></div><button class="bp" onclick="goS(5)">'+t('upMR')+'</button>';
  }
  else if(cS===5){
    c.innerHTML='<div style="margin-bottom:4px"><span style="font-size:11px;color:var(--vscode-descriptionForeground);font-weight:600">'+t('stp')+' 5</span></div><h2 style="font-size:15px;font-weight:700;margin-bottom:4px">'+t('mrT')+'</h2><p style="font-size:12px;color:var(--vscode-descriptionForeground);margin-bottom:14px">'+t('mrS')+'</p><div class="card card-bg" style="font-size:13px"><div style="display:flex;justify-content:space-between;margin-bottom:6px"><span style="color:var(--vscode-descriptionForeground)">Ticket</span><span style="font-family:monospace;color:var(--vscode-textLink-foreground);font-weight:700">'+aTk+'</span></div><div style="display:flex;justify-content:space-between;margin-bottom:6px"><span style="color:var(--vscode-descriptionForeground)">'+t('branch')+'</span><span style="font-family:monospace;font-size:12px">feature/'+aTk.toLowerCase()+'</span></div><div style="display:flex;justify-content:space-between;margin-bottom:6px"><span style="color:var(--vscode-descriptionForeground)">'+t('tests')+'</span><span style="color:#10b981;font-weight:600">'+cr.length+'/'+cr.length+' OK</span></div><div style="display:flex;justify-content:space-between"><span style="color:var(--vscode-descriptionForeground)">'+t('evid')+'</span><span style="color:#10b981;font-weight:600">Jira</span></div></div><button class="bg" onclick="doMR()">'+lg.GitLab+' '+t('crMR')+'</button>';
  }
}

function sDone(msg){
  const tk=tasks[aTk];
  document.getElementById('sC').innerHTML='<div style="text-align:center;padding:24px 0" class="fi"><div style="width:48px;height:48px;border-radius:50%;background:rgba(16,185,129,.1);display:flex;align-items:center;justify-content:center;margin:0 auto 12px"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2"><path d="M20 6L9 17l-5-5"/></svg></div><h2 style="font-size:16px;font-weight:700;margin-bottom:6px">'+t('tDone')+'</h2><p style="font-size:13px;color:var(--vscode-descriptionForeground);margin-bottom:4px">'+aTk+' · '+(tk.title[L]||tk.title.es||tk.title.en||tk.title)+'</p><p style="font-size:12px;color:var(--vscode-descriptionForeground);margin-bottom:18px">'+msg+'</p><button class="bs" style="width:auto;display:inline-flex;padding:8px 20px" onclick="showScr(\'home\')">'+t('nxtT')+'</button></div>';
}
function buildTicketPrompt(tk, id){
  const isSpike = tk.type === 'spike';
  const ti = tk.title[L] || tk.title.es || tk.title.en || tk.title;
  const de = tk.desc[L] || tk.desc.es || tk.desc.en || tk.desc;
  const cr = (tk.criteria[L] || tk.criteria.es || tk.criteria.en || tk.criteria || []);

  if (isSpike) {
    return (L === 'es'
      ? 'Investigación técnica para ticket [' + id + ']: "' + ti + '"\n\n' +
        'Objetivo:\n' + de + '\n\n' +
        'Entregables esperados:\n' + cr.map((c, i) => (i + 1) + '. ' + c).join('\n') + '\n\n' +
        'Por favor analiza las opciones disponibles, compara alternativas con pros y contras y prepara un resumen comparativo claro.'
      : 'Technical spike for ticket [' + id + ']: "' + ti + '"\n\n' +
        'Objective:\n' + de + '\n\n' +
        'Expected deliverables:\n' + cr.map((c, i) => (i + 1) + '. ' + c).join('\n') + '\n\n' +
        'Please research available options, compare alternatives with pros and cons, and produce a clear summary.'
    );
  }

  return (L === 'es'
    ? 'Implementar ticket [' + id + ']: "' + ti + '"\n' +
      'Tipo: ' + tk.type.toUpperCase() + '\n\n' +
      'Descripción:\n' + de + '\n\n' +
      'Criterios de Aceptación:\n' + cr.map(c => '- ' + c).join('\n') + '\n\n' +
      'Por favor analiza el código, diseña los cambios e implementa la solución paso a paso cumpliendo todos los criterios de aceptación.'
    : 'Implement ticket [' + id + ']: "' + ti + '"\n' +
      'Type: ' + tk.type.toUpperCase() + '\n\n' +
      'Description:\n' + de + '\n\n' +
      'Acceptance Criteria:\n' + cr.map(c => '- ' + c).join('\n') + '\n\n' +
      'Please inspect the project files, plan the changes, and implement the solution step by step meeting all criteria.'
  );
}

function startAiWithTicket(){
  const tk = tasks[aTk];
  const p = buildTicketPrompt(tk, aTk);
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(p).catch(() => {});
  }
  vsc.postMessage({ type: 'startAiChat', prompt: p, ticketId: aTk });
  toast(L === 'es' ? 'Prompt copiado y chat iniciado' : 'Prompt copied & chat started');
  goS(2);
}

function reopenChat(){
  const tk = tasks[aTk];
  const p = buildTicketPrompt(tk, aTk);
  vsc.postMessage({ type: 'startAiChat', prompt: p, ticketId: aTk });
  toast(L === 'es' ? 'Abriendo chat...' : 'Opening chat...');
}

function cpFullPrompt(){
  const tk = tasks[aTk];
  const p = buildTicketPrompt(tk, aTk);
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(p).catch(() => {});
  }
  vsc.postMessage({ type: 'copyPrompt', text: p });
  toast(L === 'es' ? 'Prompt completo copiado' : 'Full prompt copied');
}

function runTermTests(){
  vsc.postMessage({ type: 'runTerminalTests' });
  toast(L === 'es' ? 'Ejecutando tests en terminal...' : 'Running tests in terminal...');
}

function doMR(){
  vsc.postMessage({type:'createMR',ticketId:aTk,title:tasks[aTk].title[L]});
  toast(t('crMR'));
  setTimeout(()=>sDone(t('mrMsg')),300);
}
function cpP(btn,txt){
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(txt).catch(() => {});
  }
  vsc.postMessage({type:'copyPrompt',text:txt});
  const fb=document.getElementById('clipEl');
  document.getElementById('clipTx').innerText=t('cpd')+': "'+txt.substring(0,40)+'..."';
  fb.classList.add('show');
  btn.classList.add('fl');
  clearTimeout(window._cf);
  window._cf=setTimeout(()=>{fb.classList.remove('show');btn.classList.remove('fl')},2000);
}
let ssN=0;
function addSS(){
  vsc.postMessage({ type: 'pickEvidenceFiles', ticketId: aTk });
}

// ---- SETTINGS ----
function rSet(){
  let h='<div class="ctr fi"><h2 style="font-size:15px;font-weight:700;margin-bottom:4px">'+t('cTls')+'</h2><p style="font-size:12px;color:var(--vscode-descriptionForeground);margin-bottom:14px">'+t('stS')+'</p>';
  cTools.forEach(n=>{
    let detectedTag='';
    if((n==='GitLab'&&detExts.gitlab)||(n==='GitHub'&&detExts.github)||(n==='Jira'&&detExts.jira)){
      detectedTag='<span class="ext-badge" style="margin-left:6px">'+svgCheck+' '+t('vsPluginDetected')+'</span>';
    }
    h+='<div class="card card-bg" style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px"><div style="display:flex;align-items:center;gap:8px">'+(lg[n]||'')+'<div><div style="font-size:13px;font-weight:600;display:flex;align-items:center">'+n+detectedTag+'</div><div style="font-size:11px;color:var(--vscode-descriptionForeground)">'+(tDet[n]||'')+'</div></div></div><span style="font-size:12px;color:#10b981;font-weight:600;display:flex;align-items:center;gap:4px"><span style="width:6px;height:6px;border-radius:50%;background:#10b981;display:inline-block"></span>'+t('conn')+'</span></div>';
  });
  h+='<div style="margin-top:14px;padding-top:12px;border-top:1px solid var(--vscode-panel-border)"><button class="bs" style="border-style:dashed" onclick="startOb()">'+svgPlus+' '+t('nPS')+'</button></div></div>';
  document.getElementById('sSet').innerHTML=h;
}

function toast(tx){
  const el=document.getElementById('toastEl');
  document.getElementById('toastTx').innerText=tx;
  el.classList.add('show');
  clearTimeout(window._tt);
  window._tt=setTimeout(()=>el.classList.remove('show'),2500);
}

// Message from extension
window.addEventListener('message',e=>{
  if(e.data.type==='openTicket'&&tasks[e.data.ticketId])openTk(e.data.ticketId);
  if(e.data.type==='showCreateTask')showScr('create');
  if(e.data.type==='deleteConfirmed'){
    delete tasks[e.data.ticketId];
    saveTasks();
    toast((L==='es'?'Tarea eliminada: ':'Task deleted: ')+e.data.ticketId);
    showScr('home');
  }
  if(e.data.type==='evidenceSelected'&&e.data.fileNames){
    const l=document.getElementById('evL');
    if(l){
      e.data.fileNames.forEach(name=>{
        const d=document.createElement('div');
        d.style.cssText='display:flex;align-items:center;gap:6px;padding:6px 8px;border-radius:6px;background:var(--vscode-sideBar-background);border:1px solid var(--vscode-panel-border);font-size:12px;margin-bottom:4px';
        d.innerHTML='<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/></svg><span style="flex:1">'+name+'</span><span style="color:#10b981;font-size:11px">OK</span>';
        l.appendChild(d);
      });
      toast(L==='es'?'Evidencia adjuntada':'Evidence attached');
    }
  }
});

// Init
updTop();
if(onb){
  document.getElementById('topAct').style.display='flex';
  document.getElementById('topLbl').innerText='· PROJ / checkout';
  ${initialTicket ? "openTk('" + initialTicket + "');" : "showScr('home');"}
}else{
  rOb();
}
</script></body></html>`;
}

function deactivate() {}
module.exports = { activate, deactivate };
