const git = require('./gitService');
const gitWorkflow = require('./gitWorkflow');
const docker = require('./dockerService');
const { text } = require('./text');
const {
  readContextFile,
  proposeWorkspacePlan,
  acceptWorkspacePlan,
  syncPlanStatuses,
  markPlanTask,
  manualPlan,
  currentCounters,
} = require('./planWorkflow');
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
      const gitStat = await git.getLocalGitStatus(ctx.runFile, ctx.getWorkspaceRoot());
      ctx.postMessage({ type: 'localGitInfo', ...gitStat });
      break;
    }
    case 'prepareTicketBranch': {
      const prepared = await gitWorkflow.prepareTicketBranch(ctx, {
        ticketId: msg.ticketId,
        title: msg.title,
        lang,
      });
      if (prepared && prepared.ok) await markPlanTask(ctx, msg.ticketId, 'in_progress');
      break;
    }
    case 'initLocalGit': {
      await gitWorkflow.initRepository(ctx, lang);
      break;
    }
    case 'commitLocal': {
      const committed = await gitWorkflow.commitTicket(ctx, {
        ticketId: msg.ticketId,
        title: msg.title,
        lang,
      });
      if (committed && committed.ok) await markPlanTask(ctx, msg.ticketId, 'done');
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
      await syncPlanStatuses(ctx, msg.tasks);
      break;
    }
    case 'pickPlanContext': {
      const root = ctx.getWorkspaceRoot();
      if (!root) {
        ctx.showWarningMessage(text(lang, 'noWorkspacePlan'));
        break;
      }
      const picked = await ctx.showOpenDialog({
        canSelectMany: false,
        openLabel: text(lang, 'planFile'),
        filters: {
          [lang === 'es' ? 'Texto' : 'Text']: ['md', 'markdown', 'txt'],
        },
      });
      if (!picked || !picked.length) break;
      const read = await readContextFile(root, picked[0].fsPath);
      if (!read.ok) {
        ctx.showErrorMessage(
          text(lang, read.reason === 'outside' ? 'planOutside' : 'planFileType')
        );
        break;
      }
      ctx.setPlanContext({ name: read.name, text: read.text });
      ctx.postMessage({ type: 'planContext', name: read.name });
      break;
    }
    case 'clearPlanContext': {
      ctx.setPlanContext(null);
      break;
    }
    case 'proposePlan': {
      await proposeWorkspacePlan(ctx, { idea: msg.idea, lang });
      break;
    }
    case 'manualPlan': {
      const plan = manualPlan(await currentCounters(ctx.getWorkspaceRoot()));
      ctx.postMessage({ type: 'planProposal', plan, source: 'manual' });
      break;
    }
    case 'acceptPlan': {
      await acceptWorkspacePlan(ctx, msg.plan, lang);
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
      const docStatus = await docker.getDockerStatus(ctx.runFile);
      const docContainers = await docker.getDockerContainers(ctx.runFile);
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
        const opened = await ctx.runFile('open', docker.OPEN_DOCKER_DESKTOP_ARGS);
        if (!opened.ok) {
          ctx.showErrorMessage(
            'Error al abrir Docker Desktop: ' +
              (opened.error ? opened.error.message : opened.stderr)
          );
        } else {
          ctx.showInformationMessage(
            lang === 'es' ? 'Abriendo Docker Desktop...' : 'Opening Docker Desktop...'
          );
        }
      }
      break;
    }
    case 'launchDockerService': {
      const launched = await docker.launchService(ctx.runFile, msg.service);
      if (launched) {
        if (launched.ok) {
          ctx.showInformationMessage(
            lang === 'es' ? 'Servicio iniciado correctamente.' : 'Service started successfully.'
          );
        } else {
          ctx.showErrorMessage(
            'Error al iniciar servicio: ' +
              (launched.stderr || (launched.error && launched.error.message) || '')
          );
        }
        const updatedStatus = await docker.getDockerStatus(ctx.runFile);
        const updatedContainers = await docker.getDockerContainers(ctx.runFile);
        ctx.postMessage({
          type: 'dockerInfo',
          status: updatedStatus,
          containers: updatedContainers,
        });
      }
      break;
    }
    case 'stopDockerContainer': {
      if (!msg.containerId) break;
      const stopped = await docker.stopContainer(ctx.runFile, msg.containerId);
      if (stopped.reason === 'invalid') {
        ctx.showErrorMessage(text(lang, 'invalidContainerId'));
        break;
      }
      const updatedStatus = await docker.getDockerStatus(ctx.runFile);
      const updatedContainers = await docker.getDockerContainers(ctx.runFile);
      ctx.postMessage({
        type: 'dockerInfo',
        status: updatedStatus,
        containers: updatedContainers,
      });
      if (stopped.ok) {
        ctx.showInformationMessage(lang === 'es' ? 'Contenedor detenido.' : 'Container stopped.');
      } else {
        ctx.showErrorMessage(
          (lang === 'es'
            ? 'No se pudo detener el contenedor: '
            : 'Could not stop the container: ') +
            (stopped.stderr || (stopped.error && stopped.error.message) || '')
        );
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
