const vscode = require('vscode');
const cp = require('child_process');

// =====================================================================
// PRODUCT STUDIO v1.7.0 — VS Code Extension
// Guided workspace for Product Engineers: onboarding, task CRUD,
// AI chat sync (Claude, Copilot, Gemini, Ollama), testing, evidence,
// Docker & Local Env, rich Jira docs. i18n: ES / EN.
// =====================================================================

function activate(context) {
  console.log('Product Studio v1.7.0 activated');

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
      jira: !!vscode.extensions.getExtension('Atlassian.atlascode'),
      claude: !!vscode.extensions.getExtension('anthropic.claude-code') || !!vscode.extensions.getExtension('saoudrizwan.claude-dev'),
      copilot: !!vscode.extensions.getExtension('github.copilot') || !!vscode.extensions.getExtension('github.copilot-chat'),
      gemini: !!vscode.extensions.getExtension('googlecloudtools.cloudcode') || !!vscode.extensions.getExtension('google.gemini'),
      continue: !!vscode.extensions.getExtension('Continue.continue'),
      ollama: !!vscode.extensions.getExtension('ashishalex.ollama-chat')
    };
  }

  function getActiveAi() {
    const det = getDetectedExts();
    let defaultAi = 'Claude';
    if (det.claude) defaultAi = 'Claude';
    else if (det.copilot) defaultAi = 'GitHub Copilot';
    else if (det.gemini) defaultAi = 'Antigravity';
    else if (det.continue) defaultAi = 'Continue';
    else if (det.ollama) defaultAi = 'Ollama';
    return getState('activeAi', defaultAi);
  }

  // Load stored tasks or use defaults
  function getTasks() {
    return getState('tasks', null);
  }

  function getDockerStatus() {
    return new Promise(resolve => {
      cp.exec('docker --version', (err, stdout) => {
        if (err || !stdout) {
          return resolve({ installed: false, running: false, version: '' });
        }
        const version = stdout.trim();
        cp.exec('docker info', infoErr => {
          resolve({
            installed: true,
            running: !infoErr,
            version
          });
        });
      });
    });
  }

  function getDockerContainers() {
    return new Promise(resolve => {
      cp.exec('docker ps -a --format "{{.ID}}|{{.Names}}|{{.Image}}|{{.Status}}|{{.Ports}}"', (err, stdout) => {
        if (err || !stdout) return resolve([]);
        const lines = stdout.trim().split('\n').filter(Boolean);
        const list = lines.map(l => {
          const [id, name, image, status, ports] = l.split('|');
          return { id, name, image, status, ports };
        });
        resolve(list);
      });
    });
  }

  async function triggerAiChat(prompt, lang, provider) {
    if (prompt) {
      try {
        await vscode.env.clipboard.writeText(prompt);
      } catch (_) {}
    }

    const ai = provider || getActiveAi();
    const pLower = ai.toLowerCase();
    let chatCommands = [];

    if (pLower.includes('claude')) {
      chatCommands = [
        { cmd: 'claude-vscode.sidebar.open' },
        { cmd: 'claude-vscode.focus' },
        { cmd: 'claude-vscode.newConversation' },
        { cmd: 'claude-vscode.editor.open' },
        { cmd: 'claude.focus' },
        { cmd: 'claude.openChat' },
        { cmd: 'claude-dev.SidebarProvider.focus' }
      ];
    } else if (pLower.includes('copilot')) {
      chatCommands = [
        { cmd: 'workbench.panel.chat.view.copilot.focus' },
        { cmd: 'github.copilot.chat.focus' },
        { cmd: 'workbench.action.chat.open', args: prompt ? { query: prompt } : undefined },
        { cmd: 'workbench.action.quickchat.open', args: prompt ? { query: prompt } : undefined }
      ];
    } else if (pLower.includes('antigravity') || pLower.includes('gemini')) {
      chatCommands = [
        { cmd: 'antigravity.chat.focus' },
        { cmd: 'antigravity.openChat' },
        { cmd: 'google.gemini.chat.focus' },
        { cmd: 'cloudcode.gemini.focus' }
      ];
    } else if (pLower.includes('continue')) {
      chatCommands = [
        { cmd: 'continue.focusContinueInputView' },
        { cmd: 'continue.continueGUIView.focus' }
      ];
    } else if (pLower.includes('ollama')) {
      chatCommands = [
        { cmd: 'ollama-chat.ollamaChat' },
        { cmd: 'workbench.view.extension.ollama' }
      ];
    }

    // Generic VS Code chat fallbacks
    chatCommands.push(
      { cmd: 'workbench.action.chat.open', args: prompt ? { query: prompt } : undefined },
      { cmd: 'workbench.action.quickchat.open', args: prompt ? { query: prompt } : undefined },
      { cmd: 'claude-vscode.sidebar.open' },
      { cmd: 'workbench.panel.chat.view.copilot.focus' }
    );

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
          ? `Chat de ${ai} abierto y prompt copiado. Pega con Cmd+V / Ctrl+V.`
          : `Prompt copiado. Abre el chat de ${ai} y pega con Cmd+V / Ctrl+V.`)
      : (opened
          ? `${ai} chat opened & prompt copied. Paste with Cmd+V / Ctrl+V.`
          : `Prompt copied. Open ${ai} chat and paste with Cmd+V / Ctrl+V.`);

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
      getDetectedExts(),
      getActiveAi()
    );

    mainPanel.webview.onDidReceiveMessage(async msg => {
      const lang = getLang();
      switch (msg.type) {
        case 'finishOnboarding':
          setState('onboarded', true);
          setState('connectedTools', msg.tools);
          if (msg.activeAi) {
            setState('activeAi', msg.activeAi);
          } else {
            const aiChoice = (msg.tools || []).find(t => ['Claude', 'GitHub Copilot', 'Antigravity', 'Continue', 'Ollama', 'ChatGPT'].includes(t));
            if (aiChoice) setState('activeAi', aiChoice);
          }
          vscode.window.showInformationMessage('Product Studio: ' + (lang === 'es' ? 'Proyecto configurado.' : 'Project configured.'));
          break;
        case 'setActiveAi':
          setState('activeAi', msg.provider);
          break;
        case 'openAiChat':
          await triggerAiChat(msg.prompt || '', lang, msg.provider || getActiveAi());
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
          await triggerAiChat(msg.prompt, lang, msg.provider || getActiveAi());
          break;
        case 'copyPrompt':
          await vscode.env.clipboard.writeText(msg.text);
          await triggerAiChat(msg.text, lang, msg.provider || getActiveAi());
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
            getDetectedExts(),
            getActiveAi()
          );
          break;
        case 'resetOnboarding':
          setState('onboarded', false);
          setState('connectedTools', []);
          mainPanel.webview.html = getMainHtml(lang, false, [], getTasks(), null, getDetectedExts(), getActiveAi());
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
        case 'checkDocker':
          const docStatus = await getDockerStatus();
          const docContainers = await getDockerContainers();
          mainPanel.webview.postMessage({
            type: 'dockerInfo',
            status: docStatus,
            containers: docContainers
          });
          break;
        case 'installDocker':
          const term = vscode.window.activeTerminal || vscode.window.createTerminal('Product Studio: Setup');
          term.show();
          if (process.platform === 'darwin') {
            term.sendText('echo "=== Instalando Docker en macOS ==="');
            term.sendText('if ! command -v brew &> /dev/null; then echo "Instalando Homebrew..."; /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"; fi');
            term.sendText('echo "Instalando Docker Desktop con Homebrew..." && brew install --cask docker && open -a Docker');
          } else {
            term.sendText('echo "Por favor visita https://docs.docker.com/get-docker/ para instalar Docker."');
          }
          break;
        case 'startDockerDaemon':
          if (process.platform === 'darwin') {
            cp.exec('open -a Docker', (err) => {
              if (err) {
                vscode.window.showErrorMessage('Error al abrir Docker Desktop: ' + err.message);
              } else {
                vscode.window.showInformationMessage(lang === 'es' ? 'Abriendo Docker Desktop...' : 'Opening Docker Desktop...');
              }
            });
          }
          break;
        case 'launchDockerService':
          let cmd = '';
          if (msg.service === 'postgres') {
            cmd = 'docker run -d --name ps-postgres -e POSTGRES_PASSWORD=postgres -p 5432:5432 postgres:alpine || docker start ps-postgres';
          } else if (msg.service === 'mysql') {
            cmd = 'docker run -d --name ps-mysql -e MYSQL_ROOT_PASSWORD=mysql -p 3306:3306 mysql:latest || docker start ps-mysql';
          } else if (msg.service === 'redis') {
            cmd = 'docker run -d --name ps-redis -p 6379:6379 redis:alpine || docker start ps-redis';
          } else if (msg.service === 'compose') {
            cmd = 'docker compose up -d';
          }
          if (cmd) {
            cp.exec(cmd, async (err) => {
              if (err) {
                vscode.window.showErrorMessage('Error al iniciar servicio: ' + err.message);
              } else {
                vscode.window.showInformationMessage(lang === 'es' ? 'Servicio iniciado correctamente.' : 'Service started successfully.');
              }
              const updatedStatus = await getDockerStatus();
              const updatedContainers = await getDockerContainers();
              mainPanel.webview.postMessage({
                type: 'dockerInfo',
                status: updatedStatus,
                containers: updatedContainers
              });
            });
          }
          break;
        case 'stopDockerContainer':
          if (msg.containerId) {
            cp.exec(`docker stop ${msg.containerId}`, async () => {
              const updatedStatus = await getDockerStatus();
              const updatedContainers = await getDockerContainers();
              mainPanel.webview.postMessage({
                type: 'dockerInfo',
                status: updatedStatus,
                containers: updatedContainers
              });
              vscode.window.showInformationMessage(lang === 'es' ? 'Contenedor detenido.' : 'Container stopped.');
            });
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
      if (mainPanel) mainPanel.webview.html = getMainHtml(getLang(), false, [], getTasks(), null, getDetectedExts(), getActiveAi());
      vscode.window.showInformationMessage('Product Studio: Onboarding reset.');
    })
  );

  openMain();
}

// =====================================================================
// MAIN WEBVIEW — Full app
// =====================================================================
function getMainHtml(lang, onboarded, connectedTools, storedTasks, initialTicket, detectedExts, activeAi) {
  const tasksJson = JSON.stringify(storedTasks || null);
  const connJson = JSON.stringify(connectedTools || []);
  const detectedJson = JSON.stringify(detectedExts || { gitlab: false, github: false, jira: false });
  const aiProvider = activeAi || 'Claude';

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
.ctr{max-width:640px;margin:0 auto;padding:24px;width:100%}
#sOb .ctr{max-width:720px}
.tool-grid{display:grid;grid-template-columns:repeat(auto-fill, minmax(195px, 1fr));gap:8px;margin-bottom:8px}
.cat-pills{display:flex;gap:4px;overflow-x:auto;padding-bottom:4px;margin-bottom:8px}
.cat-pill{padding:3px 8px;border-radius:12px;font-size:11px;cursor:pointer;border:1px solid var(--vscode-panel-border);background:transparent;color:var(--vscode-descriptionForeground);white-space:nowrap}
.cat-pill.active{background:var(--vscode-button-background);color:var(--vscode-button-foreground);border-color:var(--vscode-button-background)}
.md-toolbar{display:flex;gap:4px;padding:4px 8px;background:var(--vscode-sideBar-background);border:1px solid var(--vscode-panel-border);border-bottom:none;border-radius:6px 6px 0 0;font-size:11px;align-items:center}
.md-toolbar button{background:none;border:none;cursor:pointer;padding:3px 6px;border-radius:4px;color:var(--vscode-descriptionForeground);font-weight:600;font-size:11px}
.md-toolbar button:hover{background:var(--vscode-toolbar-hoverBackground);color:var(--vscode-foreground)}
.md-editor{border-radius:0 0 6px 6px !important}
.md-preview{background:var(--vscode-input-background);border:1px solid var(--vscode-input-border);border-radius:0 0 6px 6px;padding:10px;font-size:12px;line-height:1.5;max-height:160px;overflow-y:auto}
.md-preview h3{font-size:13px;font-weight:700;margin:6px 0 3px}
.md-preview h4{font-size:12px;font-weight:700;margin:5px 0 2px}
.md-preview ul{padding-left:16px;margin:3px 0}
#sOb{height:100%;min-height:100%;display:flex}
#sOb .ctr{height:100%;min-height:100%;display:flex;flex-direction:column;justify-content:center}
#sOb .ctr>*{flex-shrink:0}
#sOb #cList{flex:1 1 auto;min-height:160px;max-height:360px;overflow-y:auto}
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
    <button onclick="showScr('env')" title="Docker & Entorno local"><svg viewBox="0 0 24 24" width="13" height="13" fill="#2496ED"><path d="M13.98 11.08h1.83V9.25H13.98v1.83zm-2.4 0h1.83V9.25h-1.83v1.83zm-2.41 0H11V9.25H9.17v1.83zm-2.4 0h1.83V9.25H6.77v1.83zm-2.41 0h1.83V9.25H4.36v1.83zm4.81-2.34h1.83V6.91H9.17v1.83zm2.4 0h1.83V6.91h-1.83v1.83zm2.41 0h1.83V6.91h-1.83v1.83zm-4.81-2.33h1.83V4.58H9.17v1.83zm13.78 6.42c-.44-.31-1.42-.45-2.2-.18-.17-.74-.6-1.39-1.25-1.88l-.51-.38-.34.54c-.38.59-.51 1.34-.41 2.05-.62.33-1.63.38-2.18.38H1.67c-.37 0-.67.3-.67.67 0 2.22.86 4.3 2.42 5.86C5.07 23.8 7.39 24.5 12 24.5c6.53 0 10.9-3.9 11.95-10.42.06-.41.05-.98-.5-1.76l-.5-.33z"/></svg><span>Docker</span><span class="sd sd-p" id="envDot" style="width:6px;height:6px"></span></button>
    <span style="width:1px;height:12px;background:var(--vscode-panel-border)"></span>
    <button onclick="showScr('ai')" id="topAiBtn" title="Asistente de IA"><span id="topAiIcon"></span><span id="topAiName">${aiProvider}</span><span class="sd sd-d" id="topAiDot" style="width:6px;height:6px;background:#10b981"></span></button>
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
  <div id="sEnv" style="display:none"></div>
  <div id="sAi" style="display:none"></div>
</div>

<div class="toast" id="toastEl"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2"><path d="M20 6L9 17l-5-5"/></svg><span id="toastTx"></span></div>
<div class="clip" id="clipEl"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg><span id="clipTx"></span></div>

<script>
const vsc=acquireVsCodeApi();
let L='${lang}',onb=${onboarded},cTools=${connJson},detExts=${detectedJson};
let activeAi='${aiProvider}';
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
const svgPlay='<svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>';
const svgTerm='<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="4 17 10 11 4 5"/><line x1="12" y1="19" x2="20" y2="19"/></svg>';
const svgDb='<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/></svg>';
const svgRedis='<svg viewBox="0 0 24 24" width="18" height="18" fill="#D82C20"><rect x="3" y="3" width="18" height="18" rx="3"/><path fill="#fff" d="M7 8h10v2H7zm0 3h7v2H7zm0 3h10v2H7z"/></svg>';

const lg={
  Claude:'<svg viewBox="0 0 24 24" width="18" height="18" fill="#D97706"><path d="M13.5 2.5L12 6.5L10.5 2.5H8L10.5 8.5L5.5 5.5L4 7.5L9.5 10L3.5 11.5V13.5L9.5 15L4 17.5L5.5 19.5L10.5 16.5L8 22.5H10.5L12 18.5L13.5 22.5H16L13.5 16.5L18.5 19.5L20 17.5L14.5 15L20.5 13.5V11.5L14.5 10L20 7.5L18.5 5.5L13.5 8.5L16 2.5H13.5Z"/></svg>',
  'GitHub Copilot':'<svg viewBox="0 0 24 24" width="18" height="18" fill="#6E40C9"><path d="M12 2a4 4 0 0 1 4 4v1h1a3 3 0 0 1 3 3v4a3 3 0 0 1-3 3h-1v1a4 4 0 0 1-8 0v-1H7a3 3 0 0 1-3-3v-4a3 3 0 0 1 3-3h1V6a4 4 0 0 1 4-4zm-2 9a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3zm4 0a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3z"/></svg>',
  Antigravity:'<svg viewBox="0 0 24 24" width="18" height="18" fill="#4285F4"><path d="M12 2C12 7.52 7.52 12 2 12C7.52 12 12 16.48 12 22C12 16.48 16.48 12 22 12C16.48 12 12 7.52 12 2Z"/></svg>',
  Continue:'<svg viewBox="0 0 24 24" width="18" height="18" fill="#10B981"><circle cx="12" cy="12" r="9" fill="none" stroke="#10B981" stroke-width="2"/><polygon points="10,8 16,12 10,16" fill="#10B981"/></svg>',
  Ollama:'<svg viewBox="0 0 24 24" width="18" height="18"><circle cx="12" cy="12" r="10" fill="#1E293B"/><circle cx="8.5" cy="11.5" r="2" fill="#FFFFFF"/><circle cx="15.5" cy="11.5" r="2" fill="#FFFFFF"/><circle cx="8.5" cy="11.5" r="1" fill="#000000"/><circle cx="15.5" cy="11.5" r="1" fill="#000000"/><path d="M9 16c1 .8 2 1 3 1s2-.2 3-1" stroke="#FFFFFF" stroke-width="1.5" stroke-linecap="round" fill="none"/></svg>',
  ChatGPT:'<svg viewBox="0 0 24 24" width="18" height="18" fill="#10A37F"><path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2zm-1 5h2v6h-2zm0 8h2v2h-2z"/></svg>',
  Docker:'<svg viewBox="0 0 24 24" width="18" height="18" fill="#2496ED"><path d="M13.98 11.08h1.83V9.25H13.98v1.83zm-2.4 0h1.83V9.25h-1.83v1.83zm-2.41 0H11V9.25H9.17v1.83zm-2.4 0h1.83V9.25H6.77v1.83zm-2.41 0h1.83V9.25H4.36v1.83zm4.81-2.34h1.83V6.91H9.17v1.83zm2.4 0h1.83V6.91h-1.83v1.83zm2.41 0h1.83V6.91h-1.83v1.83zm-4.81-2.33h1.83V4.58H9.17v1.83zm13.78 6.42c-.44-.31-1.42-.45-2.2-.18-.17-.74-.6-1.39-1.25-1.88l-.51-.38-.34.54c-.38.59-.51 1.34-.41 2.05-.62.33-1.63.38-2.18.38H1.67c-.37 0-.67.3-.67.67 0 2.22.86 4.3 2.42 5.86C5.07 23.8 7.39 24.5 12 24.5c6.53 0 10.9-3.9 11.95-10.42.06-.41.05-.98-.5-1.76l-.5-.33z"/></svg>',
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
    cPop:'Herramientas populares',cAI:'Modelos de IA',cPr:'Gestion de proyecto',cCo:'Codigo',cDs:'Diseno',cDc:'Documentacion',cDa:'Base de datos',cMo:'Monitoreo',cCl:'Cloud',
    newTask:'Nueva tarea',delTask:'Eliminar',crTitle:'Crear nueva tarea',crTitleF:'Titulo',crDescF:'Descripcion',crTypeF:'Tipo',crCritF:'Criterios de aceptacion',crAdd:'Agregar criterio',crSave:'Crear tarea',crCancel:'Cancelar',noTasks:'No hay tareas. Crea una nueva.',
    vsPluginDetected:'Plugin VS Code detectado',openBrw:'Abriendo navegador...',assigned:'Asignado a',
    envT:'Entorno local & Docker',envS:'Levanta bases de datos y servicios en tu maquina en 1 clic.',docStatus:'Estado de Docker',docInst:'Instalar Docker con Homebrew (Terminal)',docInstDesc:'Docker te permite correr bases de datos (Postgres, MySQL) y tu app localmente sin configurar nada.',docStart:'Iniciar Docker Desktop',docDwn:'Descargar instalador oficial (.dmg)',docRun:'Docker Desktop activo',docNotRun:'Docker instalado pero apagado',docNotRunDesc:'Docker esta instalado en tu Mac pero la aplicacion no esta abierta.',docNotInst:'Docker no detectado',quickDb:'Bases de datos locales (1 clic)',startComp:'Levantar aplicacion (docker-compose)',actCont:'Contenedores locales activos',noCont:'No hay contenedores corriendo actualmente.',stopBtn:'Detener',checkAgain:'Verificar de nuevo',
    aiHubT:'Asistentes de IA & Modelos',aiHubS:'Conecta tu chat preferido. Al trabajar en tickets, el contexto y los prompts se abren directamente en tu asistente.',aiActLbl:'Asistente activo para tickets y prompts',aiOpenBtn:'Abrir chat de {name}',aiAvail:'Modelos y Asistentes disponibles',aiUseBtn:'Usar este',aiConnBadge:'Conectado a VS Code'
  },
  en:{
    newP:'New project',reconf:'Reconfigure',obS:'Step {n} of {t}',obT1:'What tools does your team use?',obS1:'Select the ones you want to connect.',obSrch:'Search tools...',obSel:'{n} selected',cont:'Continue',back:'Back',obT2:'Connect your Jira',obS2:'Enter domain and project.',obJD:'Jira domain',obPr:'Project',obCA:'Connect with Atlassian in browser',obT3:'Connect your repository',obS3:'Link the project repository.',obPv:'Provider',obRe:'Repository',obGo:'Start working',
    backlog:'Backlog',myT:'My tasks',asgn:'{n} tasks',allT:'All',myOnly:'Assigned to me',pOk:'Pipeline OK',nErr:'0 errors',tsk:'Tasks',stp:'STEP',wh:'What needs to be done',spO:'Investigation objective',crit:'Acceptance criteria',spD:'Expected deliverables',fig:'Figma design',askAI:'Ask the AI to start',askSp:'Start investigating with AI',aiH:'Opens your AI chat (Claude, Copilot or Antigravity) with context loaded.',wAI:'Work with AI',iAI:'Investigate with AI',clCp:'Click a suggestion to copy and paste in your AI chat.',ctxS:'Context sent to assistant',sugL:'Suggestions — click to copy:',aiDT:"AI is done, let's test",aiDD:"Got the info, document",testT:'Test the changes',testS:'AI generated automated tests. You can also test manually.',aiTst:'Automated tests (AI)',rerun:'Re-run',tPas:'{n}/{t} tests OK',mPrev:'Manual preview',allG:"All good, let's review",smW:'Something failed, back to chat',docT:'Document findings',docS:'Publish your research results.',cConf:'Create Confluence page',cNot:'Create Notion page',cOS:'Create OpenSpec spec',jCom:'Jira comment',pubCl:'Publish and close ticket',revT:'Review and document',revS:'Add screenshots and comments to Jira.',evid:'Evidence',addSS:'Add screenshot',upMR:'Upload evidence and continue',mrT:'Create Merge Request',mrS:'All set to submit.',branch:'Branch',tests:'Tests',crMR:'Create Merge Request on GitLab',tDone:'Task completed',mrMsg:'MR created. Ticket moved to "In Review". Pipeline handles deploy.',spMsg:'Research documented. Ticket closed.',nxtT:'Next task',cTls:'Connected tools',stS:'Manage your integrations.',conn:'Connected',nPS:'Set up new project',cpd:'Copied',
    cPop:'Popular tools',cAI:'AI Assistants',cPr:'Project management',cCo:'Code',cDs:'Design',cDc:'Documentation',cDa:'Database',cMo:'Monitoring',cCl:'Cloud',
    newTask:'New task',delTask:'Delete',crTitle:'Create new task',crTitleF:'Title',crDescF:'Description',crTypeF:'Type',crCritF:'Acceptance criteria',crAdd:'Add criterion',crSave:'Create task',crCancel:'Cancel',noTasks:'No tasks yet. Create one.',
    vsPluginDetected:'VS Code plugin detected',openBrw:'Opening browser...',assigned:'Assigned to',
    envT:'Local Environment & Docker',envS:'Launch local databases and services on your machine in 1 click.',docStatus:'Docker Status',docInst:'Install Docker with Homebrew (Terminal)',docInstDesc:'Docker allows you to run databases (Postgres, MySQL) and your app locally without manual config.',docStart:'Start Docker Desktop',docDwn:'Download official installer (.dmg)',docRun:'Docker Desktop running',docNotRun:'Docker installed but stopped',docNotRunDesc:'Docker is installed on your Mac but the app is not open.',docNotInst:'Docker not detected',quickDb:'Local databases (1 click)',startComp:'Start application (docker-compose)',actCont:'Active local containers',noCont:'No containers currently running.',stopBtn:'Stop',checkAgain:'Check again',
    aiHubT:'AI Assistants & Models',aiHubS:'Connect your preferred chat. When working on tickets, context and prompts open directly in your assistant.',aiActLbl:'Active assistant for tickets and prompts',aiOpenBtn:'Open {name} chat',aiAvail:'Available Models & Assistants',aiUseBtn:'Use this',aiConnBadge:'Connected to VS Code'
  }
};
function t(k,v){let s=(D[L]&&D[L][k])||k;if(v)Object.entries(v).forEach(([a,b])=>{s=s.replace('{'+a+'}',b)});return s}

// Connectors catalog
const popularNames=['Claude','GitHub Copilot','Jira','GitHub','GitLab','Figma','Asana','ClickUp'];
const cnList=[
  {n:'Claude',c:'cAI',d:{es:'Escribe codigo y resuelve tickets',en:'Writes code and solves tickets'},tip:{es:'Tu programador con IA. Entiende requerimientos, escribe el codigo y crea tests paso a paso.',en:'Your AI pair programmer. Understands requirements, writes complete code, and creates tests step by step.'}},
  {n:'GitHub Copilot',c:'cAI',d:{es:'Copilot Chat en VS Code',en:'Copilot Chat in VS Code'},tip:{es:'Asistente inteligente de GitHub que vive en la barra lateral para programar contigo.',en:'GitHub AI assistant in your editor sidebar to code alongside you.'}},
  {n:'Antigravity',c:'cAI',d:{es:'Google Antigravity & Gemini',en:'Google Antigravity & Gemini'},tip:{es:'IA de Google para explorar el proyecto, investigar spikes y construir soluciones de producto.',en:'Google AI to explore codebases, investigate spikes, and build product solutions.'}},
  {n:'Continue',c:'cAI',d:{es:'Modelos locales y nube',en:'Local & cloud models'},tip:{es:'Extension abierta para conectar cualquier modelo de IA local o privado a tu editor.',en:'Open source extension to connect any local or private AI model to your editor.'}},
  {n:'Ollama',c:'cAI',d:{es:'Modelos locales sin internet',en:'Local models offline'},tip:{es:'Corre IA directo en el chip de tu Mac. 100% privado, gratis y funciona sin conexion.',en:'Runs AI directly on your Mac chip. 100% private, free, and works offline.'}},
  {n:'ChatGPT',c:'cAI',d:{es:'OpenAI ChatGPT',en:'OpenAI ChatGPT'},tip:{es:'Modelo generalista de OpenAI para consultar dudas y redactar documentacion.',en:'OpenAI general model to ask questions and generate documentation.'}},
  {n:'Jira',c:'cPr',d:'Tickets & sprints',tip:{es:'El tablero digital donde tu equipo anota los tickets, historias de usuario y metas del sprint.',en:'The digital board where product teams track tickets, user stories, and sprint goals.'}},
  {n:'Asana',c:'cPr',d:{es:'Tareas y proyectos',en:'Tasks & projects'},tip:{es:'Gestor de proyectos muy visual y amigable para coordinar tareas entre diseno y producto.',en:'Visual and user-friendly project manager to coordinate tasks across design and product.'}},
  {n:'ClickUp',c:'cPr',d:{es:'Tareas y documentos',en:'Tasks & docs'},tip:{es:'Plataforma todo en uno que combina listas de tareas, documentos, hojas de calculo y metas.',en:'All-in-one platform combining task lists, documents, spreadsheets, and goals.'}},
  {n:'Confluence',c:'cPr',d:{es:'Documentacion',en:'Documentation'},tip:{es:'La wiki de la empresa donde se guardan especificaciones funcionales y decisiones tecnicas.',en:'Company wiki where functional specs and technical architecture decisions are documented.'}},
  {n:'Notion',c:'cPr',d:{es:'Notas y wikis',en:'Notes & wikis'},tip:{es:'Tu cuaderno de notas conectado: ideal para hojas de ruta (roadmaps), minutas y especificaciones.',en:'Connected notebook: ideal for product roadmaps, meeting notes, and feature specs.'}},
  {n:'GitLab',c:'cCo',d:'Merge requests & CI/CD',tip:{es:'Donde vive el codigo de tu equipo y donde se envian los Merge Requests para que otros revisen.',en:'Where team source code is stored and Merge Requests are submitted for peer review.'}},
  {n:'GitHub',c:'cCo',d:'Pull requests & Actions',tip:{es:'La plataforma mas usada del mundo para guardar codigo y colaborar en Pull Requests.',en:'The world most popular platform to host code and collaborate via Pull Requests.'}},
  {n:'Figma',c:'cDs',d:{es:'Disenos y prototipos',en:'Designs & prototypes'},tip:{es:'Donde los disenadores crean la interfaz visual, botones y pantallas interactivas de tu producto.',en:'Where designers create the visual UI, buttons, and interactive screens for your product.'}},
  {n:'OpenSpec',c:'cDc',d:'Specs & API docs',tip:{es:'Formato estandar para describir que datos envia y recibe cada pantalla o servicio de tu app.',en:'Standard format to describe what data each screen or service in your app sends and receives.'}},
  {n:'PostgreSQL',c:'cDa',d:'SQL database',tip:{es:'Base de datos potente y segura para guardar usuarios, productos, cobros y transacciones.',en:'Powerful, secure database to store users, products, payments, and transactions.'}},
  {n:'MySQL',c:'cDa',d:'SQL database',tip:{es:'Base de datos clasica y muy rapida para almacenar informacion estructurada de tu app.',en:'Classic, high-speed database to store structured data for your application.'}},
  {n:'Supabase',c:'cDa',d:'Database & Auth',tip:{es:'Base de datos moderna en la nube con login de Google/email y base de datos ya lista.',en:'Modern cloud database with built-in Google/email user authentication.'}},
  {n:'Firebase',c:'cDa',d:'Database & Realtime',tip:{es:'Base de datos de Google que actualiza la pantalla al instante cuando los datos cambian.',en:'Google database that updates the screen instantly in real-time when data changes.'}},
  {n:'Grafana',c:'cMo',d:{es:'Monitoreo y dashboards',en:'Monitoring & dashboards'},tip:{es:'Tableros visuales con graficos para ver si tu servidor esta rapido o si hay errores.',en:'Visual dashboards with charts to monitor server speed and track error rates.'}},
  {n:'AWS',c:'cCl',d:'Cloud services',tip:{es:'La nube de Amazon que aloja los servidores y bases de datos que hacen funcionar tu app.',en:'Amazon cloud hosting the servers and databases that run your application.'}},
  {n:'GCP',c:'cCl',d:'Google Cloud Platform',tip:{es:'La infraestructura en la nube de Google para correr aplicaciones escalables y modelos de IA.',en:'Google cloud infrastructure to run scalable applications and AI models.'}}
];
const catOrder=['cAI','cPr','cCo','cDs','cDc','cDa','cMo','cCl'];
const tDet={
  Claude:'anthropic.com','GitHub Copilot':'github.com/copilot',Antigravity:'deepmind.google',Continue:'continue.dev',Ollama:'localhost:11434',ChatGPT:'openai.com',
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
  ['sOb','sHome','sTk','sSet','sCreate','sEnv','sAi'].forEach(id=>{
    const el = document.getElementById(id);
    if(el) el.style.display='none';
  });
  const map={onboarding:'sOb',home:'sHome',ticket:'sTk',settings:'sSet',create:'sCreate',env:'sEnv',ai:'sAi'};
  if(map[n] && document.getElementById(map[n])) {
    document.getElementById(map[n]).style.display='';
  }
  if(n==='onboarding')rOb();
  if(n==='home')rHome();
  if(n==='settings')rSet();
  if(n==='create')rCreate();
  if(n==='env')rEnv();
  if(n==='ai')rAi();
  updTop();
}
function updTop(){
  const bNP = document.getElementById('bNP');
  const bRC = document.getElementById('bRC');
  if(bNP) bNP.innerText=t('newP');
  if(bRC) bRC.innerText=t('reconf');
  const topAiIcon = document.getElementById('topAiIcon');
  const topAiName = document.getElementById('topAiName');
  const topAiDot = document.getElementById('topAiDot');
  if (topAiIcon && topAiName) {
    topAiName.innerText = activeAi;
    topAiIcon.innerHTML = lg[activeAi] || svgChat;
    const isDet = (activeAi === 'Claude' && detExts.claude) ||
                  (activeAi === 'GitHub Copilot' && detExts.copilot) ||
                  (activeAi === 'Antigravity' && detExts.gemini) ||
                  (activeAi === 'Continue' && detExts.continue) ||
                  (activeAi === 'Ollama' && detExts.ollama);
    if (topAiDot) {
      topAiDot.style.background = isDet ? '#10b981' : '#38bdf8';
    }
  }
}
function cLang(l){
  L=l;
  document.getElementById('lEs').className=l==='es'?'active':'';
  document.getElementById('lEn').className=l==='en'?'active':'';
  vsc.postMessage({type:'changeLang',lang:l});
}

// ---- ONBOARDING ----
let obS=1;
let showTips=false;

function toggleToolTips(){
  showTips = !showTips;
  rObS();
}

function selectStarterStack(){
  const aiChoice = detExts.copilot ? 'GitHub Copilot' : 'Claude';
  const repoChoice = detExts.github ? 'GitHub' : 'GitLab';
  selC.add(aiChoice);
  selC.add('Jira');
  selC.add(repoChoice);
  selC.add('Figma');
  activeAi = aiChoice;
  rObS();
  toast(L === 'es' ? 'Stack basico seleccionado (IA + Jira + Repo + Figma)' : 'Starter stack selected (AI + Jira + Repo + Figma)');
}

function rOb(){
  document.getElementById('sOb').innerHTML='<div class="ctr fi" id="obC"></div>';
  rObS();
}
function rObS(){
  const c=document.getElementById('obC');if(!c)return;
  if(obS===1){
    let h='<div style="text-align:center;font-size:12px;color:var(--vscode-descriptionForeground);margin-bottom:14px;font-weight:600">'+t('obS',{n:1,t:3})+'</div>';
    h+='<h2 style="font-size:16px;font-weight:700;text-align:center;margin-bottom:4px">'+t('obT1')+'</h2><p style="font-size:12px;color:var(--vscode-descriptionForeground);text-align:center;margin-bottom:12px">'+t('obS1')+'</p>';

    // Beginner Tip Box
    h+='<div class="card card-bg" style="border-color:rgba(59,130,246,.35);background:rgba(59,130,246,.06);padding:10px 12px;margin-bottom:12px">';
    h+='<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:4px">';
    h+='<div style="display:flex;align-items:center;gap:6px;font-size:12px;font-weight:700;color:var(--vscode-focusBorder)">';
    h+='<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>';
    h+='<span>'+(L==='es'?'No sabes por donde empezar?':'New here? Where to start')+'</span>';
    h+='</div>';
    h+='<button class="bs" style="width:auto;padding:2px 8px;font-size:10px" onclick="selectStarterStack()">'+(L==='es'?'Elegir combinacion basica':'Pick starter stack')+'</button>';
    h+='</div>';
    h+='<p style="font-size:11px;color:var(--vscode-descriptionForeground);line-height:1.4">';
    h+=(L==='es'
      ?'Solo necesitas 3 cosas basicas: <strong>1 Asistente de IA</strong> (ej. Claude o Copilot para programar), <strong>1 Gestor de Tareas</strong> (Jira o Asana) y <strong>1 Repositorio</strong> (GitLab o GitHub). Haz clic en el boton de arriba para pre-seleccionarlas.'
      :'You only need 3 basics: <strong>1 AI Assistant</strong> (Claude or Copilot to write code), <strong>1 Task Manager</strong> (Jira or Asana), and <strong>1 Repository</strong> (GitLab or GitHub). Click the button above to pre-select them.');
    h+='</p></div>';

    // Search bar & Explanation toggle
    h+='<div style="display:flex;gap:6px;align-items:center;margin-bottom:10px">';
    h+='<div style="position:relative;flex:1"><svg style="position:absolute;left:10px;top:50%;transform:translateY(-50%)" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--vscode-descriptionForeground)" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg><input class="inp" style="padding-left:30px" placeholder="'+t('obSrch')+'" oninput="fC(this.value)"></div>';
    h+='<button class="bs" style="width:auto;padding:8px 10px;font-size:11px;white-space:nowrap" onclick="toggleToolTips()" id="tipToggleBtn">'+(showTips?(L==='es'?'Ocultar tips':'Hide tips'):(L==='es'?'Ver explicaciones':'Show explanations'))+'</button>';
    h+='</div>';

    // Category pills filter
    h+='<div class="cat-pills">';
    h+='<button class="cat-pill active" onclick="setCatFilter(\'all\', this)">'+(L==='es'?'Todas':'All')+'</button>';
    h+='<button class="cat-pill" onclick="setCatFilter(\'popular\', this)">'+t('cPop')+'</button>';
    catOrder.forEach(cat=>{
      h+='<button class="cat-pill" onclick="setCatFilter(\''+cat+'\', this)">'+t(cat)+'</button>';
    });
    h+='</div>';

    // Responsive Grid (2-3 columns) with NO DUPLICATES
    h+='<div class="tool-grid" id="cList">';
    cnList.forEach(cn=>{
      const s = selC.has(cn.n);
      const isPop = popularNames.includes(cn.n);
      const d = typeof cn.d==='string'?cn.d:(cn.d[L]||cn.d.es||cn.d.en);
      const tipText = cn.tip ? (cn.tip[L]||cn.tip.es||cn.tip.en) : d;
      let detectedTag = '';
      const isExtDet = (cn.n==='GitLab'&&detExts.gitlab)||(cn.n==='GitHub'&&detExts.github)||(cn.n==='Jira'&&detExts.jira)||
                       (cn.n==='Claude'&&detExts.claude)||(cn.n==='GitHub Copilot'&&detExts.copilot)||(cn.n==='Antigravity'&&detExts.gemini)||
                       (cn.n==='Continue'&&detExts.continue)||(cn.n==='Ollama'&&detExts.ollama);
      if(isExtDet){
        detectedTag='<span class="ext-badge" style="font-size:8px;padding:1px 4px">'+svgCheck+' VS</span>';
      }
      let popBadge = isPop ? '<span style="font-size:10px;color:var(--vscode-focusBorder);margin-left:auto;font-weight:700">★</span>' : '';

      h+='<div class="cc'+(s?' sel':'')+'" data-name="'+cn.n+'" data-cat="'+cn.c+'" data-pop="'+(isPop?'1':'0')+'" data-desc="'+d.replace(/"/g,'&quot;')+'" title="'+tipText.replace(/"/g,'&quot;')+'" onclick="tC(this)">'+
        (lg[cn.n]||'') +
        '<div style="flex:1;min-width:0">'+
          '<div style="display:flex;align-items:center;gap:4px">'+
            '<span style="font-size:12px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'+cn.n+'</span>'+
            detectedTag +
            popBadge +
          '</div>'+
          '<div style="font-size:10px;color:var(--vscode-descriptionForeground);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'+d+'</div>'+
          (showTips ? '<div style="font-size:9.5px;color:var(--vscode-descriptionForeground);opacity:.85;margin-top:3px;line-height:1.2">'+tipText+'</div>' : '')+
        '</div>'+
      '</div>';
    });
    h+='</div>';

    h+='<div style="display:flex;align-items:center;justify-content:space-between;margin-top:10px"><span style="font-size:11px;color:var(--vscode-descriptionForeground)" id="cCnt">'+t('obSel',{n:selC.size})+'</span><button class="bp" style="width:auto;padding:8px 20px" onclick="obN(2)">'+t('cont')+'</button></div>';
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
let currentCat = 'all';
let currentQuery = '';

function setCatFilter(cat, btn) {
  currentCat = cat;
  document.querySelectorAll('.cat-pill').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  applyToolFilters();
}

function fC(q) {
  currentQuery = (q || '').toLowerCase();
  applyToolFilters();
}

function applyToolFilters() {
  document.querySelectorAll('.tool-grid .cc').forEach(c => {
    const cat = c.dataset.cat;
    const isPop = c.dataset.pop === '1';
    const name = (c.dataset.name || '').toLowerCase();
    const desc = (c.dataset.desc || '').toLowerCase();

    const matchesCat = (currentCat === 'all') ||
                       (currentCat === 'popular' && isPop) ||
                       (cat === currentCat);

    const matchesQuery = !currentQuery || name.includes(currentQuery) || desc.includes(currentQuery);

    c.style.display = (matchesCat && matchesQuery) ? 'flex' : 'none';
  });
}

function tC(el){
  const n=el.dataset.name;
  if(selC.has(n)){
    selC.delete(n);
    el.classList.remove('sel');
  }else{
    selC.add(n);
    el.classList.add('sel');
  }
  const cnt=document.getElementById('cCnt');
  if(cnt)cnt.innerText=t('obSel',{n:selC.size});
}
function startOb(){
  obS=1;
  selC=new Set(cTools||[]);
  showScr('onboarding');
}
function finOb(){
  cTools=Array.from(selC);
  if(cTools.length===0){
    const aiDef = detExts.copilot ? 'GitHub Copilot' : 'Claude';
    cTools=[aiDef,'Jira','GitLab'];
    activeAi = aiDef;
  }
  const pickedAi = cTools.find(x => ['Claude','GitHub Copilot','Antigravity','Continue','Ollama','ChatGPT'].includes(x));
  if (pickedAi) {
    activeAi = pickedAi;
  }
  onb=true;
  document.getElementById('topAct').style.display='flex';
  document.getElementById('topLbl').innerText='· PROJ / checkout';
  vsc.postMessage({type:'finishOnboarding',tools:cTools,activeAi:activeAi});
  updTop();
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
    c.innerHTML='<div style="margin-bottom:4px"><span style="font-size:11px;color:var(--vscode-descriptionForeground);font-weight:600">'+t('stp')+' 1</span></div><h2 style="font-size:15px;font-weight:700;margin-bottom:4px">'+ti+'</h2><p style="font-size:12px;color:var(--vscode-descriptionForeground);margin-bottom:14px">'+(sp?(L==='es'?'Ticket de investigacion. Lee el objetivo.':'Investigation ticket. Read the objective.'):(L==='es'?'Lee los detalles y pedi a '+activeAi+' que empiece.':'Read the details and ask '+activeAi+' to start.'))+'</p><div class="card card-bg"><div class="lbl" style="text-transform:uppercase;letter-spacing:.05em;margin-bottom:6px">'+t(sp?'spO':'wh')+'</div><p style="font-size:13px;line-height:1.5">'+de+'</p></div>'+fig+'<div class="card card-bg"><div class="lbl" style="text-transform:uppercase;letter-spacing:.05em;margin-bottom:8px">'+t(sp?'spD':'crit')+'</div><div style="display:flex;flex-direction:column;gap:6px">'+cr.map(x=>'<div style="display:flex;align-items:center;gap:8px;font-size:13px"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--vscode-descriptionForeground)" stroke-width="2"><circle cx="12" cy="12" r="10"/></svg>'+x+'</div>').join('')+'</div></div><button class="bp" onclick="startAiWithTicket()">'+svgChat+' '+(sp?(L==='es'?'Investigar con '+activeAi:'Investigate with '+activeAi):(L==='es'?'Pedile a '+activeAi+' que empiece':'Ask '+activeAi+' to start'))+'</button><p style="text-align:center;font-size:11px;color:var(--vscode-descriptionForeground);margin-top:6px">'+(L==='es'?'Se abre el chat de '+activeAi+' con el contexto cargado.':'Opens '+activeAi+' chat with context loaded.')+'</p>';
  }
  else if(cS===2){
    const fullPrompt = buildTicketPrompt(tk, aTk);
    const pr=sp?(L==='es'?['Investiga opciones y compara alternativas','Arma una tabla comparativa con pros y contras','Cual es la recomendacion final para arquitectura?']:['Investigate options and compare alternatives','Create a comparison table with pros and cons','What is the final architectural recommendation?']):(L==='es'?['Genera los tests automaticos para estos criterios','Explicame los archivos que modificaste','Como pruebo este cambio en localhost?']:['Generate automated tests for these criteria','Explain the files you modified','How do I test this change on localhost?']);

    c.innerHTML='<div style="margin-bottom:4px"><span style="font-size:11px;color:var(--vscode-descriptionForeground);font-weight:600">'+t('stp')+' 2</span></div><h2 style="font-size:15px;font-weight:700;margin-bottom:4px">'+t(sp?'iAI':'wAI')+'</h2><p style="font-size:12px;color:var(--vscode-descriptionForeground);margin-bottom:14px">'+(L==='es'?'El contexto fue copiado. Pegalo con Cmd+V o Ctrl+V en tu chat de '+activeAi+'.':'Context was copied. Paste with Cmd+V or Ctrl+V in your '+activeAi+' chat.')+'</p>'+
    '<div class="card" style="border-color:rgba(16,185,129,.3);background:rgba(16,185,129,.05);margin-bottom:12px">'+
      '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:4px">'+
        '<div style="display:flex;align-items:center;gap:6px;font-weight:600;color:#10b981;font-size:12px">'+svgCheck+'<span>'+(L==='es'?'Prompt copiado y listo para '+activeAi:'Prompt copied and ready for '+activeAi)+'</span></div>'+
        '<button class="bs" style="width:auto;padding:3px 8px;font-size:11px" onclick="reopenChat()">'+svgChat+' '+(L==='es'?'Reabrir chat de '+activeAi:'Reopen '+activeAi+' chat')+'</button>'+
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
    const initJira = buildJiraReviewComment(tk, aTk);
    c.innerHTML='<div style="margin-bottom:4px"><span style="font-size:11px;color:var(--vscode-descriptionForeground);font-weight:600">'+t('stp')+' 3</span></div><h2 style="font-size:15px;font-weight:700;margin-bottom:4px">'+t('docT')+'</h2><p style="font-size:12px;color:var(--vscode-descriptionForeground);margin-bottom:14px">'+t('docS')+'</p>'+
    '<div style="display:flex;flex-direction:column;gap:6px;margin-bottom:14px">'+
      '<button class="pb" onclick="toast(\'Creating...\')">'+lg.Confluence+'<span style="flex:1;text-align:left">'+t('cConf')+'</span></button>'+
      '<button class="pb" onclick="toast(\'Creating...\')">'+lg.Notion+'<span style="flex:1;text-align:left">'+t('cNot')+'</span></button>'+
      '<button class="pb" onclick="toast(\'Creating...\')">'+lg.OpenSpec+'<span style="flex:1;text-align:left">'+t('cOS')+'</span></button>'+
    '</div>'+
    '<div class="card card-bg">'+
      '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">'+
        '<label class="lbl" style="margin:0">'+t('jCom')+'</label>'+
        '<button class="bs" style="width:auto;padding:2px 8px;font-size:11px" onclick="toggleJiraPreview(\'spike\')" id="pBtnSpike">'+(L==='es'?'Vista previa':'Preview')+'</button>'+
      '</div>'+
      '<div class="md-toolbar">'+
        '<button onclick="insertMd(\'spike\',\'bold\')">B</button>'+
        '<button onclick="insertMd(\'spike\',\'italic\')">I</button>'+
        '<button onclick="insertMd(\'spike\',\'code\')">Code</button>'+
        '<button onclick="insertMd(\'spike\',\'list\')">Lista</button>'+
        '<button onclick="insertMd(\'spike\',\'check\')">Check</button>'+
        '<button onclick="insertMd(\'spike\',\'h3\')">H3</button>'+
        '<span style="flex:1"></span>'+
        '<button onclick="resetJiraComment(\'spike\')">'+(L==='es'?'Restablecer':'Reset')+'</button>'+
      '</div>'+
      '<textarea class="inp md-editor" id="jiraCommentSpike" rows="6" style="resize:vertical"></textarea>'+
      '<div id="jiraPreviewSpike" class="md-preview" style="display:none"></div>'+
    '</div>'+
    '<button class="bp" style="background:#10b981" onclick="goS(4)">'+t('pubCl')+'</button>';

    setTimeout(()=>{
      const ta = document.getElementById('jiraCommentSpike');
      if (ta) ta.value = initJira;
    }, 10);
  }
  else if(cS===3&&!sp){
    c.innerHTML='<div style="margin-bottom:4px"><span style="font-size:11px;color:var(--vscode-descriptionForeground);font-weight:600">'+t('stp')+' 3</span></div><h2 style="font-size:15px;font-weight:700;margin-bottom:4px">'+t('testT')+'</h2><p style="font-size:12px;color:var(--vscode-descriptionForeground);margin-bottom:14px">'+t('testS')+'</p><div class="card card-bg"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px"><div class="lbl" style="text-transform:uppercase;letter-spacing:.05em;margin:0">'+t('aiTst')+'</div><div style="display:flex;gap:6px"><button style="background:none;border:none;color:var(--vscode-textLink-foreground);font-size:11px;cursor:pointer;font-weight:600" onclick="runTermTests()">'+(L==='es'?'En terminal':'In terminal')+'</button><button style="background:none;border:none;color:var(--vscode-textLink-foreground);font-size:11px;cursor:pointer;font-weight:600" onclick="toast(\'Running...\')">'+t('rerun')+'</button></div></div>'+cr.map((_,i)=>'<div class="tok">'+svgCheck+'<span style="font-family:monospace;font-size:11px">test_'+(i+1)+'</span><span style="margin-left:auto;font-weight:600">OK</span></div>').join('')+'<div style="margin-top:4px;font-size:11px;color:#10b981;font-weight:600">'+t('tPas',{n:cr.length,t:cr.length})+'</div></div><div class="card card-bg" style="padding:0;overflow:hidden"><div style="padding:8px 12px;border-bottom:1px solid var(--vscode-panel-border);display:flex;justify-content:space-between;font-size:12px"><strong>'+t('mPrev')+'</strong><span style="font-family:monospace;color:#10b981;font-size:11px">localhost:3000</span></div><div style="padding:14px;display:flex;justify-content:center;background:#080810"><div style="width:100%;max-width:360px;background:#fff;border-radius:6px;overflow:hidden;box-shadow:0 4px 10px rgba(0,0,0,.4)"><div style="background:#0f172a;color:#fff;padding:6px 10px;font-size:11px;font-weight:700">App Preview</div><div style="padding:10px;font-size:12px;color:#334155;text-align:center">'+(L==='es'?'Vista previa interactiva de la aplicacion':'Interactive app preview')+'</div></div></div></div><button class="bp" onclick="goS(4)" style="margin-top:4px">'+t('allG')+'</button><button class="bs" onclick="goS(2)" style="margin-top:6px">'+t('smW')+'</button>';
  }
  else if(cS===4&&sp){sDone(t('spMsg'))}
  else if(cS===4&&!sp){
    const initJira = buildJiraReviewComment(tk, aTk);
    c.innerHTML='<div style="margin-bottom:4px"><span style="font-size:11px;color:var(--vscode-descriptionForeground);font-weight:600">'+t('stp')+' 4</span></div><h2 style="font-size:15px;font-weight:700;margin-bottom:4px">'+t('revT')+'</h2><p style="font-size:12px;color:var(--vscode-descriptionForeground);margin-bottom:14px">'+t('revS')+'</p>'+
    '<div class="card" style="border-color:rgba(16,185,129,.3);background:rgba(16,185,129,.05)">'+
      '<div style="display:flex;align-items:center;gap:6px;font-size:12px;font-weight:600;color:#10b981">'+svgCheck+cr.length+'/'+cr.length+' + tests OK</div>'+
    '</div>'+
    '<div class="card card-bg">'+
      '<div class="lbl" style="text-transform:uppercase;letter-spacing:.05em;margin-bottom:8px">'+t('evid')+'</div>'+
      '<button class="bs" style="border-style:dashed;margin-bottom:8px;font-size:12px;padding:8px" onclick="addSS()">'+svgCam+' '+t('addSS')+'</button>'+
      '<div id="evL"></div>'+
      '<div style="display:flex;justify-content:space-between;align-items:center;margin:10px 0 6px">'+
        '<label class="lbl" style="margin:0">'+t('jCom')+'</label>'+
        '<button class="bs" style="width:auto;padding:2px 8px;font-size:11px" onclick="toggleJiraPreview(\'story\')" id="pBtnStory">'+(L==='es'?'Vista previa':'Preview')+'</button>'+
      '</div>'+
      '<div class="md-toolbar">'+
        '<button onclick="insertMd(\'story\',\'bold\')">B</button>'+
        '<button onclick="insertMd(\'story\',\'italic\')">I</button>'+
        '<button onclick="insertMd(\'story\',\'code\')">Code</button>'+
        '<button onclick="insertMd(\'story\',\'list\')">Lista</button>'+
        '<button onclick="insertMd(\'story\',\'check\')">Check</button>'+
        '<button onclick="insertMd(\'story\',\'h3\')">H3</button>'+
        '<span style="flex:1"></span>'+
        '<button onclick="resetJiraComment(\'story\')">'+(L==='es'?'Restablecer':'Reset')+'</button>'+
      '</div>'+
      '<textarea class="inp md-editor" id="jiraCommentStory" rows="6" style="resize:vertical"></textarea>'+
      '<div id="jiraPreviewStory" class="md-preview" style="display:none"></div>'+
    '</div>'+
    '<button class="bp" onclick="goS(5)">'+t('upMR')+'</button>';

    setTimeout(()=>{
      const ta = document.getElementById('jiraCommentStory');
      if (ta) ta.value = initJira;
    }, 10);
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
  vsc.postMessage({ type: 'startAiChat', prompt: p, ticketId: aTk, provider: activeAi });
  toast((L === 'es' ? 'Prompt copiado y chat de ' : 'Prompt copied & ') + activeAi + (L === 'es' ? ' iniciado' : ' chat started'));
  goS(2);
}

function reopenChat(){
  const tk = tasks[aTk];
  const p = buildTicketPrompt(tk, aTk);
  vsc.postMessage({ type: 'startAiChat', prompt: p, ticketId: aTk, provider: activeAi });
  toast((L === 'es' ? 'Abriendo chat de ' : 'Opening chat of ') + activeAi + '...');
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

// ---- LOCAL ENVIRONMENT & DOCKER ----
let dockerStatus = { installed: false, running: false, version: '' };
let dockerContainers = [];

function rEnv(){
  const el = document.getElementById('sEnv');
  if (!el) return;
  let statusBadge = '';
  let statusCard = '';

  if (dockerStatus.running) {
    statusBadge = '<span class="badge" style="background:rgba(16,185,129,.15);color:#10b981">'+t('docRun')+'</span>';
    statusCard = '<div class="card card-bg" style="border-color:rgba(16,185,129,.3)">'+
      '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px">'+
        '<div style="display:flex;align-items:center;gap:8px">'+lg.Docker+'<strong style="font-size:13px">'+t('docStatus')+'</strong></div>'+
        statusBadge +
      '</div>'+
      '<div style="font-size:11px;color:var(--vscode-descriptionForeground);font-family:monospace">'+(dockerStatus.version || 'Docker Desktop')+'</div>'+
    '</div>';
  } else if (dockerStatus.installed) {
    statusBadge = '<span class="badge" style="background:rgba(245,158,11,.15);color:#f59e0b">'+t('docNotRun')+'</span>';
    statusCard = '<div class="card card-bg" style="border-color:rgba(245,158,11,.3)">'+
      '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">'+
        '<div style="display:flex;align-items:center;gap:8px">'+lg.Docker+'<strong style="font-size:13px">'+t('docStatus')+'</strong></div>'+
        statusBadge +
      '</div>'+
      '<p style="font-size:12px;color:var(--vscode-descriptionForeground);margin-bottom:12px">'+t('docNotRunDesc')+'</p>'+
      '<div style="display:flex;gap:8px">'+
        '<button class="bp" onclick="startDockerApp()">'+svgPlay+' '+t('docStart')+'</button>'+
        '<button class="bs" onclick="refreshDocker()">'+t('checkAgain')+'</button>'+
      '</div>'+
    '</div>';
  } else {
    statusBadge = '<span class="badge" style="background:rgba(239,68,68,.15);color:#ef4444">'+t('docNotInst')+'</span>';
    statusCard = '<div class="card card-bg" style="border-color:rgba(239,68,68,.3)">'+
      '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">'+
        '<div style="display:flex;align-items:center;gap:8px">'+lg.Docker+'<strong style="font-size:13px">'+t('docStatus')+'</strong></div>'+
        statusBadge +
      '</div>'+
      '<p style="font-size:12px;color:var(--vscode-descriptionForeground);margin-bottom:12px">'+t('docInstDesc')+'</p>'+
      '<div style="display:flex;flex-direction:column;gap:8px">'+
        '<button class="bp" onclick="installDockerBrew()">'+svgTerm+' '+t('docInst')+'</button>'+
        '<button class="bs" onclick="openDockerDownload()">'+svgExtLink+' '+t('docDwn')+'</button>'+
      '</div>'+
    '</div>';
  }

  let h = '<div class="ctr fi">';
  h += '<div style="display:flex;align-items:center;gap:6px;font-size:12px;margin-bottom:12px">'+
    '<button style="background:none;border:none;color:var(--vscode-descriptionForeground);cursor:pointer;display:flex;align-items:center;gap:4px;font-size:12px" onclick="showScr(\'home\')">'+svgBack+t('back')+'</button>'+
    '<span style="color:var(--vscode-panel-border)">/</span>'+
    '<span style="font-weight:600">'+t('envT')+'</span>'+
  '</div>';

  h += '<h1 style="font-size:18px;font-weight:700;margin-bottom:4px">'+t('envT')+'</h1>';
  h += '<p style="font-size:12px;color:var(--vscode-descriptionForeground);margin-bottom:14px">'+t('envS')+'</p>';

  h += statusCard;

  // Databases section
  h += '<div style="font-size:13px;font-weight:700;margin:18px 0 8px;display:flex;align-items:center;gap:6px">'+svgDb+' '+t('quickDb')+'</div>';
  
  // PostgreSQL
  h += '<div class="card card-bg" style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">'+
    '<div style="display:flex;align-items:center;gap:8px">'+
      lg.PostgreSQL +
      '<div><div style="font-size:13px;font-weight:600">PostgreSQL (v16)</div><div style="font-size:11px;color:var(--vscode-descriptionForeground)">localhost:5432 · postgres / postgres</div></div>'+
    '</div>'+
    '<button class="bs" style="width:auto;padding:6px 12px;font-size:12px" onclick="launchService(\'postgres\')">'+svgPlay+' '+(L==='es'?'Iniciar':'Start')+'</button>'+
  '</div>';

  // MySQL
  h += '<div class="card card-bg" style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">'+
    '<div style="display:flex;align-items:center;gap:8px">'+
      lg.MySQL +
      '<div><div style="font-size:13px;font-weight:600">MySQL (v8)</div><div style="font-size:11px;color:var(--vscode-descriptionForeground)">localhost:3306 · root / mysql</div></div>'+
    '</div>'+
    '<button class="bs" style="width:auto;padding:6px 12px;font-size:12px" onclick="launchService(\'mysql\')">'+svgPlay+' '+(L==='es'?'Iniciar':'Start')+'</button>'+
  '</div>';

  // Redis
  h += '<div class="card card-bg" style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">'+
    '<div style="display:flex;align-items:center;gap:8px">'+
      svgRedis +
      '<div><div style="font-size:13px;font-weight:600">Redis</div><div style="font-size:11px;color:var(--vscode-descriptionForeground)">localhost:6379 · Cache & KV</div></div>'+
    '</div>'+
    '<button class="bs" style="width:auto;padding:6px 12px;font-size:12px" onclick="launchService(\'redis\')">'+svgPlay+' '+(L==='es'?'Iniciar':'Start')+'</button>'+
  '</div>';

  // Full App Compose
  h += '<div class="card card-bg" style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">'+
    '<div style="display:flex;align-items:center;gap:8px">'+
      lg.Docker +
      '<div><div style="font-size:13px;font-weight:600">'+t('startComp')+'</div><div style="font-size:11px;color:var(--vscode-descriptionForeground)">docker compose up -d</div></div>'+
    '</div>'+
    '<button class="bs" style="width:auto;padding:6px 12px;font-size:12px" onclick="launchService(\'compose\')">'+svgPlay+' '+(L==='es'?'Levantar':'Up')+'</button>'+
  '</div>';

  // Active containers
  h += '<div style="font-size:13px;font-weight:700;margin:18px 0 8px;display:flex;align-items:center;justify-content:space-between"><span>'+t('actCont')+' ('+dockerContainers.length+')</span><button style="background:none;border:none;color:var(--vscode-textLink-foreground);font-size:11px;cursor:pointer;font-weight:600" onclick="refreshDocker()">'+t('checkAgain')+'</button></div>';
  if (dockerContainers.length === 0) {
    h += '<p style="font-size:12px;color:var(--vscode-descriptionForeground);padding:10px 0">'+t('noCont')+'</p>';
  } else {
    dockerContainers.forEach(c => {
      const isUp = c.status && c.status.toLowerCase().includes('up');
      h += '<div class="card card-bg" style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px">'+
        '<div>'+
          '<div style="font-size:12px;font-weight:700;font-family:monospace;display:flex;align-items:center;gap:6px">'+
            '<span class="sd '+(isUp?'sd-d':'sd-p')+'"></span>'+
            c.name.replace(/^\//,'') +
            '<span style="font-size:11px;color:var(--vscode-descriptionForeground);font-weight:normal">('+c.image+')</span>'+
          '</div>'+
          '<div style="font-size:11px;color:var(--vscode-descriptionForeground);margin-top:2px">'+(c.ports || c.status)+'</div>'+
        '</div>'+
        '<button class="del-btn" style="padding:4px 8px;font-size:11px" onclick="stopContainer(\''+c.id+'\')">'+t('stopBtn')+'</button>'+
      '</div>';
    });
  }

  h += '</div>';
  el.innerHTML = h;
}

function startDockerApp(){
  vsc.postMessage({ type: 'startDockerDaemon' });
  toast(L==='es'?'Iniciando Docker Desktop...':'Starting Docker Desktop...');
}
function installDockerBrew(){
  vsc.postMessage({ type: 'installDocker' });
  toast(L==='es'?'Abriendo terminal de instalacion...':'Opening install terminal...');
}
function openDockerDownload(){
  vsc.postMessage({ type: 'openExternal', url: 'https://www.docker.com/products/docker-desktop/' });
}
function launchService(s){
  vsc.postMessage({ type: 'launchDockerService', service: s });
  toast(L==='es'?'Iniciando servicio...':'Starting service...');
}
function stopContainer(id){
  vsc.postMessage({ type: 'stopDockerContainer', containerId: id });
  toast(L==='es'?'Deteniendo contenedor...':'Stopping container...');
}
function refreshDocker(){
  vsc.postMessage({ type: 'checkDocker' });
  toast(L==='es'?'Verificando...':'Checking...');
}

// ---- AI ASSISTANTS & CHAT HUB ----
function rAi(){
  const el = document.getElementById('sAi');
  if (!el) return;
  const isDet = (activeAi === 'Claude' && detExts.claude) ||
                (activeAi === 'GitHub Copilot' && detExts.copilot) ||
                (activeAi === 'Antigravity' && detExts.gemini) ||
                (activeAi === 'Continue' && detExts.continue) ||
                (activeAi === 'Ollama' && detExts.ollama);

  let h = '<div class="ctr fi">';
  h += '<h2 style="font-size:16px;font-weight:700;margin-bottom:4px">' + t('aiHubT') + '</h2>';
  h += '<p style="font-size:12px;color:var(--vscode-descriptionForeground);margin-bottom:14px">' + t('aiHubS') + '</p>';

  // Active assistant hero card
  h += '<div class="card card-bg" style="border-color:rgba(16,185,129,.4);margin-bottom:16px">';
  h += '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">';
  h += '<div style="display:flex;align-items:center;gap:10px">' + (lg[activeAi] || svgChat) + '<div><div style="font-size:14px;font-weight:700">' + activeAi + '</div><div style="font-size:11px;color:var(--vscode-descriptionForeground)">' + t('aiActLbl') + '</div></div></div>';
  h += '<span class="badge" style="background:rgba(16,185,129,.15);color:#10b981">' + svgCheck + ' ' + (isDet ? t('aiConnBadge') : (L === 'es' ? 'Seleccionado' : 'Selected')) + '</span>';
  h += '</div>';

  h += '<div style="display:flex;gap:8px">';
  h += '<button class="bp" style="flex:1" onclick="openCurrentAiChat()">' + svgChat + ' ' + t('aiOpenBtn', { name: activeAi }) + '</button>';
  h += '</div>';
  h += '</div>';

  // Available Assistants catalog
  h += '<div style="font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;margin-bottom:8px;color:var(--vscode-descriptionForeground)">' + t('aiAvail') + '</div>';

  const aiList = [
    { n: 'Claude', d: { es: 'Anthropic Claude Code / Cline. Ideal para desarrollo guiado y razonamiento profundo.', en: 'Anthropic Claude Code / Cline. Great for guided development and deep reasoning.' }, det: detExts.claude },
    { n: 'GitHub Copilot', d: { es: 'Copilot Chat integrado en VS Code.', en: 'Copilot Chat integrated into VS Code.' }, det: detExts.copilot },
    { n: 'Antigravity', d: { es: 'Google Antigravity & Gemini Code Assist.', en: 'Google Antigravity & Gemini Code Assist.' }, det: detExts.gemini },
    { n: 'Continue', d: { es: 'Extension open-source para conectar modelos locales o en la nube.', en: 'Open-source extension to connect local or cloud models.' }, det: detExts.continue },
    { n: 'Ollama', d: { es: 'Modelos locales ejecutandose en tu maquina (sin costo de API ni internet).', en: 'Local models running on your machine (zero API cost, works offline).' }, det: detExts.ollama },
    { n: 'ChatGPT', d: { es: 'OpenAI ChatGPT y extensiones compatibles.', en: 'OpenAI ChatGPT and compatible extensions.' }, det: false }
  ];

  aiList.forEach(item => {
    const isAct = item.n === activeAi;
    const desc = item.d[L] || item.d.es || item.d.en;
    let badge = '';
    if (item.det) {
      badge = '<span class="ext-badge" style="margin-left:6px">' + svgCheck + ' VS</span>';
    }

    h += '<div class="card card-bg" style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;' + (isAct ? 'border-color:var(--vscode-focusBorder);background:rgba(59,130,246,.04)' : '') + '">';
    h += '<div style="display:flex;align-items:center;gap:10px;flex:1;min-width:0">';
    h += (lg[item.n] || svgChat);
    h += '<div style="min-width:0;flex:1">';
    h += '<div style="font-size:13px;font-weight:600;display:flex;align-items:center">' + item.n + badge + '</div>';
    h += '<div style="font-size:11px;color:var(--vscode-descriptionForeground);line-height:1.3">' + desc + '</div>';
    h += '</div></div>';

    h += '<div style="display:flex;align-items:center;gap:6px;margin-left:10px">';
    if (isAct) {
      h += '<button class="bs" style="background:var(--vscode-button-background);color:var(--vscode-button-foreground);border:none;padding:4px 8px;font-size:11px" onclick="openCurrentAiChat()">' + svgChat + ' ' + (L === 'es' ? 'Abrir' : 'Open') + '</button>';
    } else {
      h += '<button class="bs" style="padding:4px 8px;font-size:11px" onclick="setAiProvider(\'' + item.n + '\')">' + t('aiUseBtn') + '</button>';
    }
    h += '</div></div>';
  });

  h += '<div style="margin-top:14px"><button class="bs" onclick="showScr(\'home\')">' + (L === 'es' ? 'Volver a tareas' : 'Back to tasks') + '</button></div>';
  h += '</div>';

  el.innerHTML = h;
}

function setAiProvider(name){
  activeAi = name;
  vsc.postMessage({ type: 'setActiveAi', provider: name });
  updTop();
  rAi();
  toast((L === 'es' ? 'Asistente activo: ' : 'Active assistant: ') + name);
}

function openCurrentAiChat(){
  vsc.postMessage({ type: 'openAiChat', provider: activeAi });
  toast((L === 'es' ? 'Abriendo chat de ' : 'Opening chat of ') + activeAi + '...');
}

// ---- JIRA RICH REVIEWS & COMMENTS ----
function buildJiraReviewComment(tk, id) {
  if (!tk) return '';
  const isSpike = tk.type === 'spike';
  const rawTitle = typeof tk.title === 'string' ? tk.title : (tk.title[L] || tk.title.es || tk.title.en || '');
  let rawCriteria = [];
  if (Array.isArray(tk.criteria)) {
    rawCriteria = tk.criteria;
  } else if (tk.criteria && typeof tk.criteria === 'object') {
    rawCriteria = tk.criteria[L] || tk.criteria.es || tk.criteria.en || [];
  }
  const bt = String.fromCharCode(96);

  if (isSpike) {
    if (L === 'es') {
      return '### Investigación Técnica y Definición\n\n' +
        '**Ticket:** ' + id + ' - ' + rawTitle + '\n\n' +
        '#### 1. Resumen de la Investigación\n' +
        '- Se analizó la viabilidad técnica y arquitectura de la solución propuesta.\n' +
        '- Documentación de referencia generada y sincronizada.\n\n' +
        '#### 2. Criterios y Definiciones Evaluadas\n' +
        rawCriteria.map(c => '- [x] ' + c).join('\n') + '\n\n' +
        '#### 3. Conclusión y Recomendación\n' +
        '- Se recomienda proceder con la implementación en el próximo sprint.\n' +
        '- Dependencias y riesgos mitigados.';
    } else {
      return '### Technical Investigation & Spike Definition\n\n' +
        '**Ticket:** ' + id + ' - ' + rawTitle + '\n\n' +
        '#### 1. Investigation Summary\n' +
        '- Technical feasibility and architecture analysis completed.\n' +
        '- Reference documentation generated and synchronized.\n\n' +
        '#### 2. Evaluated Criteria & Decisions\n' +
        rawCriteria.map(c => '- [x] ' + c).join('\n') + '\n\n' +
        '#### 3. Recommendation & Next Steps\n' +
        '- Ready to proceed with implementation in the upcoming sprint.\n' +
        '- Dependencies and technical risks mitigated.';
    }
  } else {
    if (L === 'es') {
      return '### Resumen de Entrega y Validación\n\n' +
        '**Ticket:** ' + id + ' - ' + rawTitle + '\n' +
        '**Rama:** ' + bt + 'feature/' + id.toLowerCase() + bt + '\n\n' +
        '#### Criterios de Aceptación Verificados\n' +
        rawCriteria.map(c => '- [x] ' + c).join('\n') + '\n\n' +
        '#### Pruebas y Evidencias\n' +
        '- [x] Pruebas unitarias y de integración ejecutadas con éxito.\n' +
        '- [x] Pruebas visuales y manuales completadas.\n' +
        '- [x] Capturas de pantalla y evidencias adjuntas en el ticket.\n\n' +
        '#### Estado\n' +
        'Listo para revisión y Merge Request.';
    } else {
      return '### Implementation & Verification Summary\n\n' +
        '**Ticket:** ' + id + ' - ' + rawTitle + '\n' +
        '**Branch:** ' + bt + 'feature/' + id.toLowerCase() + bt + '\n\n' +
        '#### Verified Acceptance Criteria\n' +
        rawCriteria.map(c => '- [x] ' + c).join('\n') + '\n\n' +
        '#### Testing & Evidence\n' +
        '- [x] Automated and integration tests passed successfully.\n' +
        '- [x] Manual and UI validation completed.\n' +
        '- [x] Screenshots and evidence attached to ticket.\n\n' +
        '#### Status\n' +
        'Ready for review and Merge Request.';
    }
  }
}

function insertMd(prefix, type) {
  const cap = prefix.charAt(0).toUpperCase() + prefix.slice(1);
  const ta = document.getElementById('jiraComment' + cap);
  if (!ta) return;
  const s = ta.selectionStart;
  const e = ta.selectionEnd;
  const text = ta.value;
  const sel = text.substring(s, e);
  let start = '', end = '', def = (L === 'es' ? 'texto' : 'text');
  const bt = String.fromCharCode(96);
  if (type === 'bold') { start = '**'; end = '**'; }
  else if (type === 'italic') { start = '*'; end = '*'; }
  else if (type === 'code') { start = bt; end = bt; }
  else if (type === 'list') { start = '\n- '; end = ''; }
  else if (type === 'check') { start = '\n- [x] '; end = ''; }
  else if (type === 'h3') { start = '\n### '; end = ''; def = (L === 'es' ? 'Título' : 'Heading'); }

  const replacement = start + (sel || def) + end;
  ta.value = text.substring(0, s) + replacement + text.substring(e);
  ta.focus();
  ta.selectionStart = s + start.length;
  ta.selectionEnd = s + replacement.length - end.length;
}

function renderSimpleMarkdown(md) {
  if (!md) return '';
  let esc = md
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  // Headers
  esc = esc.replace(/^### (.*$)/gim, '<h3>$1</h3>');
  esc = esc.replace(/^#### (.*$)/gim, '<h4>$1</h4>');

  // Bold & Italics
  esc = esc.replace(/\*\*(.*?)\*\*/gim, '<strong>$1</strong>');
  esc = esc.replace(/\*(.*?)\*/gim, '<em>$1</em>');

  // Code
  const bt = String.fromCharCode(96);
  const codeRegex = new RegExp(bt + '([^' + bt + ']+)' + bt, 'gim');
  esc = esc.replace(codeRegex, '<code style="background:var(--vscode-textCodeBlock-background);padding:1px 4px;border-radius:3px;font-family:monospace">$1</code>');

  // Checkboxes
  esc = esc.replace(/^- \[x\] (.*$)/gim, '<div style="display:flex;align-items:center;gap:6px;margin:3px 0"><input type="checkbox" checked disabled style="margin:0"><span style="text-decoration:line-through;color:var(--vscode-descriptionForeground)">$1</span></div>');
  esc = esc.replace(/^- \[ \] (.*$)/gim, '<div style="display:flex;align-items:center;gap:6px;margin:3px 0"><input type="checkbox" disabled style="margin:0"><span>$1</span></div>');

  // Bullet lists
  esc = esc.replace(/^- (?!\[)(.*$)/gim, '<li style="margin-left:16px">$1</li>');

  // Line breaks
  esc = esc.replace(/\n/g, '<br>');

  return esc;
}

function toggleJiraPreview(prefix) {
  const cap = prefix.charAt(0).toUpperCase() + prefix.slice(1);
  const ta = document.getElementById('jiraComment' + cap);
  const pv = document.getElementById('jiraPreview' + cap);
  const btn = document.getElementById('pBtn' + cap);
  if (!ta || !pv || !btn) return;
  
  if (pv.style.display === 'none') {
    pv.innerHTML = renderSimpleMarkdown(ta.value);
    pv.style.display = 'block';
    ta.style.display = 'none';
    btn.innerText = (L === 'es' ? 'Editar' : 'Edit');
  } else {
    pv.style.display = 'none';
    ta.style.display = 'block';
    btn.innerText = (L === 'es' ? 'Vista previa' : 'Preview');
  }
}

function resetJiraComment(prefix) {
  const cap = prefix.charAt(0).toUpperCase() + prefix.slice(1);
  const ta = document.getElementById('jiraComment' + cap);
  const pv = document.getElementById('jiraPreview' + cap);
  if (!ta) return;
  const tk = tasks[aTk];
  ta.value = buildJiraReviewComment(tk, aTk);
  if (pv && pv.style.display !== 'none') {
    pv.innerHTML = renderSimpleMarkdown(ta.value);
  }
  toast(L === 'es' ? 'Comentario restablecido' : 'Comment reset');
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
  if(e.data.type==='dockerInfo'){
    dockerStatus = e.data.status || { installed: false, running: false, version: '' };
    dockerContainers = e.data.containers || [];
    const dot = document.getElementById('envDot');
    if(dot){
      dot.className = 'sd ' + (dockerStatus.running ? 'sd-d' : dockerStatus.installed ? 'sd-a' : 'sd-p');
      dot.style.background = dockerStatus.running ? '#10b981' : dockerStatus.installed ? '#f59e0b' : 'var(--vscode-descriptionForeground)';
    }
    const envScr = document.getElementById('sEnv');
    if(envScr && envScr.style.display !== 'none'){
      rEnv();
    }
  }
});

// Init
updTop();
vsc.postMessage({ type: 'checkDocker' });
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
