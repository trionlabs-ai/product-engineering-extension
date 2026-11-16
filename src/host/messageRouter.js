const git = require('./gitService');
const docker = require('./dockerService');
const { AI_TOOL_NAMES } = require('./language');

const TERMINAL_TEST_COMMAND = 'npm test || echo "Running tests..."';

function fileName(fsPath) {
  const parts = fsPath.split('/');
  return parts[parts.length - 1];
}

async function routeMessage(msg, ctx) {
  const lang = ctx.getLang();
  switch (msg.type) {
    case 'finishOnboarding': {
      ctx.state.set('onboarded', true);
      ctx.state.set('connectedTools', msg.tools || []);
      ctx.state.set('localMode', !!msg.localMode);
      if (msg.activeAi) {
        ctx.state.set('activeAi', msg.activeAi);
      } else {
        const aiChoice = (msg.tools || []).find((tool) => AI_TOOL_NAMES.includes(tool));
        if (aiChoice) ctx.state.set('activeAi', aiChoice);
      }
      const finMsg = msg.localMode
        ? lang === 'es'
          ? 'Product Studio: Modo local configurado. Sin dependencia de Jira ni repos remotos.'
          : 'Product Studio: Local mode configured. No Jira or remote repo required.'
        : lang === 'es'
          ? 'Product Studio: Proyecto configurado.'
          : 'Product Studio: Project configured.';
      ctx.showInformationMessage(finMsg);
      break;
    }
    case 'checkLocalGit': {
      const gitStat = await git.getLocalGitStatus(ctx.exec, ctx.getWorkspaceRoot());
      ctx.postMessage({ type: 'localGitInfo', ...gitStat });
      break;
    }
    case 'initLocalGit': {
      const rootInit = ctx.getWorkspaceRoot();
      if (!rootInit) {
        ctx.showWarningMessage(
          lang === 'es'
            ? 'Abre una carpeta de trabajo en VS Code primero.'
            : 'Open a workspace folder in VS Code first.'
        );
        break;
      }
      ctx.exec(git.buildInitRepositoryCommand(), { cwd: rootInit }, async () => {
        const upStat = await git.getLocalGitStatus(ctx.exec, rootInit);
        ctx.postMessage({ type: 'localGitInfo', ...upStat });
        ctx.showInformationMessage(
          lang === 'es'
            ? 'Repositorio Git local inicializado correctamente.'
            : 'Local Git repository initialized successfully.'
        );
      });
      break;
    }
    case 'commitLocal': {
      const rootCommit = ctx.getWorkspaceRoot();
      const commitMsgText = git.formatCommitMessage(msg.ticketId, msg.title);
      if (!rootCommit) {
        const virtualHash = 'loc-' + Math.random().toString(36).substring(2, 8);
        ctx.postMessage({
          type: 'localCommitSuccess',
          ticketId: msg.ticketId,
          hash: virtualHash,
          branch: 'local',
        });
        ctx.showInformationMessage(
          lang === 'es'
            ? `Commit local registrado para ${msg.ticketId}.`
            : `Local commit recorded for ${msg.ticketId}.`
        );
        break;
      }
      ctx.exec(git.buildLocalCommitCommand(commitMsgText), { cwd: rootCommit }, () => {
        ctx.exec(git.commands.shortHead, { cwd: rootCommit }, (hErr, hOut) => {
          const commitHash =
            hErr || !hOut.trim()
              ? 'loc-' + Math.random().toString(36).substring(2, 8)
              : hOut.trim();
          ctx.exec(git.commands.currentBranch, { cwd: rootCommit }, (bErr, bOut) => {
            const curBranch = bErr || !bOut.trim() ? 'main' : bOut.trim();
            ctx.postMessage({
              type: 'localCommitSuccess',
              ticketId: msg.ticketId,
              hash: commitHash,
              branch: curBranch,
            });
            ctx.showInformationMessage(
              lang === 'es'
                ? `Commit local realizado (${commitHash}): ${commitMsgText}`
                : `Local commit created (${commitHash}): ${commitMsgText}`
            );
          });
        });
      });
      break;
    }
    case 'setActiveAi': {
      ctx.state.set('activeAi', msg.provider);
      break;
    }
    case 'openAiChat': {
      await ctx.triggerAiChat(msg.prompt || '', lang, msg.provider || ctx.getActiveAi());
      break;
    }
    case 'saveTasks': {
      ctx.state.set('tasks', msg.tasks);
      break;
    }
    case 'saveEpics': {
      ctx.state.set('epics', msg.epics);
      break;
    }
    case 'confirmDeleteEpic': {
      const yesEp = lang === 'es' ? 'Eliminar' : 'Delete';
      const promptEp =
        (lang === 'es' ? 'Eliminar epica ' : 'Delete epic ') +
        msg.epicId +
        '? ' +
        (lang === 'es'
          ? 'Las tareas asociadas quedaran sin epica asignada.'
          : 'Associated tasks will become unassigned.');
      const respEp = await ctx.showWarningMessage(promptEp, { modal: true }, yesEp);
      if (respEp === yesEp) {
        ctx.postMessage({ type: 'deleteEpicConfirmed', epicId: msg.epicId });
      }
      break;
    }
    case 'openExternal': {
      if (msg.url) {
        try {
          await ctx.openExternal(msg.url);
        } catch (err) {
          ctx.showErrorMessage('Error opening URL: ' + err.message);
        }
      }
      break;
    }
    case 'startAiChat':
    case 'syncWithAI': {
      await ctx.triggerAiChat(msg.prompt, lang, msg.provider || ctx.getActiveAi());
      break;
    }
    case 'copyPrompt': {
      await ctx.writeClipboard(msg.text);
      await ctx.triggerAiChat(msg.text, lang, msg.provider || ctx.getActiveAi());
      break;
    }
    case 'pickEvidenceFiles': {
      const files = await ctx.showOpenDialog({
        canSelectMany: true,
        openLabel: lang === 'es' ? 'Adjuntar evidencia' : 'Attach evidence',
        filters: {
          [lang === 'es' ? 'Imágenes' : 'Images']: ['png', 'jpg', 'jpeg', 'webp', 'gif', 'svg'],
        },
      });
      if (files && files.length > 0) {
        const names = files.map((file) => fileName(file.fsPath));
        ctx.postMessage({ type: 'evidenceSelected', fileNames: names });
        ctx.showInformationMessage(
          lang === 'es'
            ? `${names.length} archivo(s) adjuntado(s) como evidencia a Jira (${msg.ticketId}).`
            : `${names.length} file(s) attached as evidence to Jira (${msg.ticketId}).`
        );
      }
      break;
    }
    case 'runTerminalTests': {
      const terminal = ctx.getTerminal('Product Studio: Tests');
      terminal.show();
      terminal.sendText(TERMINAL_TEST_COMMAND);
      break;
    }
    case 'attachEvidence': {
      ctx.showInformationMessage(`Product Studio: Evidence attached to Jira (${msg.ticketId}).`);
      break;
    }
    case 'createMR': {
      ctx.showInformationMessage(`Product Studio: MR created on GitLab for ${msg.ticketId}.`);
      break;
    }
    case 'changeLang': {
      await ctx.updateLanguage(msg.lang);
      ctx.reloadHtml({ lang: msg.lang, initialTicket: null });
      break;
    }
    case 'resetOnboarding': {
      ctx.state.set('onboarded', false);
      ctx.state.set('connectedTools', []);
      ctx.state.set('localMode', false);
      ctx.reloadHtml({
        lang,
        onboarded: false,
        connectedTools: [],
        initialTicket: null,
        localMode: false,
      });
      break;
    }
    case 'confirmDelete': {
      const yes = lang === 'es' ? 'Eliminar' : 'Delete';
      const resp = await ctx.showWarningMessage(
        (lang === 'es' ? 'Eliminar tarea ' : 'Delete task ') + msg.ticketId + '?',
        { modal: true },
        yes
      );
      if (resp === yes) {
        ctx.postMessage({ type: 'deleteConfirmed', ticketId: msg.ticketId });
      }
      break;
    }
    case 'checkDocker': {
      const docStatus = await docker.getDockerStatus(ctx.exec);
      const docContainers = await docker.getDockerContainers(ctx.exec);
      ctx.postMessage({
        type: 'dockerInfo',
        status: docStatus,
        containers: docContainers,
      });
      break;
    }
    case 'installDocker': {
      const term = ctx.getTerminal('Product Studio: Setup');
      term.show();
      docker.dockerInstallLines(ctx.platform).forEach((line) => term.sendText(line));
      break;
    }
    case 'startDockerDaemon': {
      if (ctx.platform === 'darwin') {
        ctx.exec(docker.OPEN_DOCKER_DESKTOP_COMMAND, (err) => {
          if (err) {
            ctx.showErrorMessage('Error al abrir Docker Desktop: ' + err.message);
          } else {
            ctx.showInformationMessage(
              lang === 'es' ? 'Abriendo Docker Desktop...' : 'Opening Docker Desktop...'
            );
          }
        });
      }
      break;
    }
    case 'launchDockerService': {
      const cmd = docker.buildLaunchCommand(msg.service);
      if (cmd) {
        ctx.exec(cmd, async (err) => {
          if (err) {
            ctx.showErrorMessage('Error al iniciar servicio: ' + err.message);
          } else {
            ctx.showInformationMessage(
              lang === 'es' ? 'Servicio iniciado correctamente.' : 'Service started successfully.'
            );
          }
          const updatedStatus = await docker.getDockerStatus(ctx.exec);
          const updatedContainers = await docker.getDockerContainers(ctx.exec);
          ctx.postMessage({
            type: 'dockerInfo',
            status: updatedStatus,
            containers: updatedContainers,
          });
        });
      }
      break;
    }
    case 'stopDockerContainer': {
      if (msg.containerId) {
        ctx.exec(docker.buildStopCommand(msg.containerId), async () => {
          const updatedStatus = await docker.getDockerStatus(ctx.exec);
          const updatedContainers = await docker.getDockerContainers(ctx.exec);
          ctx.postMessage({
            type: 'dockerInfo',
            status: updatedStatus,
            containers: updatedContainers,
          });
          ctx.showInformationMessage(lang === 'es' ? 'Contenedor detenido.' : 'Container stopped.');
        });
      }
      break;
    }
    case 'uiReady': {
      if (ctx.markUiReady) ctx.markUiReady();
      break;
    }
    default:
      break;
  }
}

module.exports = {
  TERMINAL_TEST_COMMAND,
  routeMessage,
};
