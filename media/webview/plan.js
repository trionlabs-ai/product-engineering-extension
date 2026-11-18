/* eslint-disable no-undef */
let planDraft = null;
let planDirty = false;
let planConfirm = false;
let planIdea = '';
let planFileName = '';
let planError = '';
let planBusy = false;
let planSource = '';
let planProviderLabel = '';

function planEscape(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function planBusyBar() {
  if (!planBusy) return '';
  const label = planProviderLabel
    ? t('planUsing', { provider: planProviderLabel })
    : t('planWorking');
  return (
    '<div class="plan-actions" style="margin-bottom:10px"><span class="plan-note" style="margin:0">' +
    planEscape(label) +
    '</span><button class="bs" data-plan="cancel">' +
    t('planCancel') +
    '</button></div>'
  );
}

function rPlan() {
  const el = document.getElementById('sPlan');
  if (!el) return;
  if (planDraft) renderPlanDraft(el);
  else renderPlanIdea(el);
}

function renderPlanIdea(el) {
  el.innerHTML =
    '<div class="ctr fi">' +
    '<button class="bs" style="width:auto;padding:5px 12px;font-size:12px;margin-bottom:12px" data-plan="back">' +
    svgBack +
    ' ' +
    t('planBack') +
    '</button>' +
    '<h1 style="font-size:18px;font-weight:700;margin-bottom:6px">' +
    t('planTitle') +
    '</h1>' +
    '<p class="plan-note">' +
    t('planIntro') +
    '</p>' +
    planBusyBar() +
    (planProviderLabel && !planBusy
      ? '<p class="plan-note">' +
        planEscape(t('planUsing', { provider: planProviderLabel })) +
        '</p>'
      : '') +
    (planError
      ? '<div class="card plan-error" style="margin-bottom:12px"><p class="plan-note" style="margin:0">' +
        planEscape(planError) +
        '</p></div>'
      : '') +
    '<label class="lbl">' +
    t('planSummary') +
    '</label>' +
    '<textarea class="inp" id="planIdea" rows="6" style="resize:vertical;margin-bottom:10px" placeholder="' +
    planEscape(t('planIdeaPh')) +
    '">' +
    planEscape(planIdea) +
    '</textarea>' +
    '<div class="plan-actions" style="margin-bottom:14px">' +
    '<button class="bs" data-plan="file">' +
    t('planFile') +
    '</button>' +
    '<span class="plan-note" style="margin:0">' +
    planEscape(planFileName || t('planFileNone')) +
    '</span>' +
    (planFileName
      ? '<button class="bs" data-plan="clear-file">' + t('planClearFile') + '</button>'
      : '') +
    '</div>' +
    '<div class="plan-actions">' +
    '<button class="bp" data-plan="ask"' +
    (planBusy ? ' disabled' : '') +
    '>' +
    (planBusy ? t('planWorking') : t('planAsk')) +
    '</button>' +
    '<button class="bs" data-plan="manual">' +
    t('planManual') +
    '</button>' +
    '</div>' +
    '<div class="plan-actions" style="margin-top:14px">' +
    '<button class="bs" data-plan="set-key">' +
    t('planSetKey') +
    '</button>' +
    '<button class="bs" data-plan="clear-key">' +
    t('planClearKey') +
    '</button>' +
    '</div></div>';
}

function renderPlanDraft(el) {
  const plan = planDraft;
  let body =
    '<div class="ctr fi" style="max-width:720px">' +
    planBusyBar() +
    (planProviderLabel && !planBusy
      ? '<p class="plan-note">' +
        planEscape(t('planUsing', { provider: planProviderLabel })) +
        '</p>'
      : '') +
    '<div class="plan-actions" style="margin-bottom:12px">' +
    '<button class="bs" data-plan="back-draft">' +
    svgBack +
    ' ' +
    t('planBack') +
    '</button>' +
    '<button class="bp" data-plan="accept">' +
    t('planAccept') +
    '</button>' +
    '<button class="bs" data-plan="regen">' +
    t('planRegen') +
    '</button>' +
    '</div>' +
    '<h1 style="font-size:18px;font-weight:700;margin-bottom:6px">' +
    t('planTitle') +
    '</h1>' +
    (planSource === 'manual' ? '' : '<p class="plan-note">' + t('planIntro') + '</p>') +
    (planError
      ? '<div class="card plan-error" style="margin-bottom:12px"><p class="plan-note" style="margin:0">' +
        planEscape(planError) +
        '</p></div>'
      : '') +
    (planConfirm
      ? '<div class="card" style="margin-bottom:12px"><p class="plan-note">' +
        t('planRegenAsk') +
        '</p><div class="plan-actions"><button class="bp" data-plan="regen-yes">' +
        t('planRegenYes') +
        '</button><button class="bs" data-plan="regen-no">' +
        t('planBack') +
        '</button></div></div>'
      : '') +
    '<label class="lbl">' +
    t('planTitle') +
    '</label>' +
    '<input class="inp" data-plan-field="title" value="' +
    planEscape(plan.title) +
    '" style="margin-bottom:8px">' +
    '<label class="lbl">' +
    t('planSummary') +
    '</label>' +
    '<textarea class="inp" data-plan-field="summary" rows="2" style="resize:vertical;margin-bottom:14px">' +
    planEscape(plan.summary) +
    '</textarea>';

  plan.epics.forEach((epic, epicIndex) => {
    body +=
      '<div class="card card-bg" style="margin-bottom:12px">' +
      '<div class="plan-actions" style="margin-bottom:8px">' +
      '<strong style="font-family:monospace">' +
      planEscape(epic.id) +
      '</strong>' +
      '<button class="bs" data-plan="epic-up" data-epic="' +
      epicIndex +
      '">' +
      t('planUp') +
      '</button>' +
      '<button class="bs" data-plan="epic-down" data-epic="' +
      epicIndex +
      '">' +
      t('planDown') +
      '</button>' +
      '<button class="bs" data-plan="epic-delete" data-epic="' +
      epicIndex +
      '">' +
      t('planDelete') +
      '</button>' +
      '</div>' +
      '<label class="lbl">' +
      t('planEpicTitle') +
      '</label>' +
      '<input class="inp" data-plan-field="epic-title" data-epic="' +
      epicIndex +
      '" value="' +
      planEscape(epic.title) +
      '" style="margin-bottom:8px">' +
      '<textarea class="inp" data-plan-field="epic-summary" data-epic="' +
      epicIndex +
      '" rows="2" style="resize:vertical;margin-bottom:10px">' +
      planEscape(epic.summary) +
      '</textarea>';
    epic.tasks.forEach((task, taskIndex) => {
      body +=
        '<div class="card" style="margin-bottom:8px">' +
        '<div class="plan-actions" style="margin-bottom:8px">' +
        '<span style="font-family:monospace;font-size:12px">' +
        planEscape(task.id) +
        '</span>' +
        '<button class="bs" data-plan="task-up" data-epic="' +
        epicIndex +
        '" data-task="' +
        taskIndex +
        '">' +
        t('planUp') +
        '</button>' +
        '<button class="bs" data-plan="task-down" data-epic="' +
        epicIndex +
        '" data-task="' +
        taskIndex +
        '">' +
        t('planDown') +
        '</button>' +
        '<button class="bs" data-plan="task-delete" data-epic="' +
        epicIndex +
        '" data-task="' +
        taskIndex +
        '">' +
        t('planDelete') +
        '</button>' +
        '</div>' +
        '<input class="inp" data-plan-field="task-title" data-epic="' +
        epicIndex +
        '" data-task="' +
        taskIndex +
        '" value="' +
        planEscape(task.title) +
        '" placeholder="' +
        planEscape(t('planTaskTitle')) +
        '" style="margin-bottom:6px">' +
        '<textarea class="inp" data-plan-field="task-desc" data-epic="' +
        epicIndex +
        '" data-task="' +
        taskIndex +
        '" rows="2" placeholder="' +
        planEscape(t('planTaskDesc')) +
        '" style="resize:vertical;margin-bottom:6px">' +
        planEscape(task.description) +
        '</textarea>' +
        '<textarea class="inp" data-plan-field="task-criteria" data-epic="' +
        epicIndex +
        '" data-task="' +
        taskIndex +
        '" rows="3" placeholder="' +
        planEscape(t('planCriteria')) +
        '" style="resize:vertical;margin-bottom:6px">' +
        planEscape((task.acceptanceCriteria || []).join('\n')) +
        '</textarea>' +
        '<input class="inp" data-plan-field="task-estimate" data-epic="' +
        epicIndex +
        '" data-task="' +
        taskIndex +
        '" value="' +
        planEscape(task.estimate || '') +
        '" placeholder="' +
        planEscape(t('planEstimate')) +
        '">' +
        '</div>';
    });
    body +=
      '<button class="bs" data-plan="add-task" data-epic="' +
      epicIndex +
      '">' +
      svgPlus +
      ' ' +
      t('planAddTask') +
      '</button></div>';
  });
  body +=
    '<button class="bs" data-plan="add-epic" style="margin-bottom:12px">' +
    svgPlus +
    ' ' +
    t('planAddEpic') +
    '</button></div>';
  el.innerHTML = body;
}

function readPlanDraft() {
  if (!planDraft) return;
  const title = document.querySelector('[data-plan-field="title"]');
  const summary = document.querySelector('[data-plan-field="summary"]');
  if (title) planDraft.title = title.value;
  if (summary) planDraft.summary = summary.value;
  document.querySelectorAll('[data-plan-field="epic-title"]').forEach((input) => {
    const epic = planDraft.epics[Number(input.getAttribute('data-epic'))];
    if (epic) epic.title = input.value;
  });
  document.querySelectorAll('[data-plan-field="epic-summary"]').forEach((input) => {
    const epic = planDraft.epics[Number(input.getAttribute('data-epic'))];
    if (epic) epic.summary = input.value;
  });
  document.querySelectorAll('[data-plan-field="task-title"]').forEach((input) => {
    const task = planTaskAt(input);
    if (task) task.title = input.value;
  });
  document.querySelectorAll('[data-plan-field="task-desc"]').forEach((input) => {
    const task = planTaskAt(input);
    if (task) task.description = input.value;
  });
  document.querySelectorAll('[data-plan-field="task-criteria"]').forEach((input) => {
    const task = planTaskAt(input);
    if (task) {
      task.acceptanceCriteria = input.value
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean);
    }
  });
  document.querySelectorAll('[data-plan-field="task-estimate"]').forEach((input) => {
    const task = planTaskAt(input);
    if (task) task.estimate = input.value.trim();
  });
}

function planTaskAt(input) {
  const epic = planDraft.epics[Number(input.getAttribute('data-epic'))];
  if (!epic) return null;
  return epic.tasks[Number(input.getAttribute('data-task'))] || null;
}

function markPlanDirty() {
  planDirty = true;
}

function showPlanProposal(plan, source) {
  planDraft = plan;
  planSource = source || '';
  if (source && source !== 'manual') planProviderLabel = source;
  planDirty = false;
  planConfirm = false;
  planError = '';
  planBusy = false;
  showScr('plan');
}

function applyAcceptedPlan(data) {
  if (data.epics) epics = data.epics;
  if (data.tasks) tasks = data.tasks;
  saveEpics();
  saveTasks();
  planDraft = null;
  planDirty = false;
  selectedEpicId = null;
  showScr('home');
  toast(t('planAccepted'));
}

function applyPlanStatus(ticketId, status) {
  const task = tasks[ticketId];
  if (!task) return;
  if (status === 'done') task.status = { es: 'Completado', en: 'Completed' };
  else if (status === 'in_progress') task.status = { es: 'En curso', en: 'In progress' };
  else task.status = { es: 'Por hacer', en: 'To do' };
  task.color = status === 'done' ? 'green' : 'blue';
  if (
    document.getElementById('sHome') &&
    document.getElementById('sHome').style.display !== 'none'
  ) {
    rHome();
  }
}

document.addEventListener('click', (event) => {
  const el = event.target.closest('[data-plan]');
  if (!el) return;
  const action = el.getAttribute('data-plan');
  const epicIndex = Number(el.getAttribute('data-epic'));
  const taskIndex = Number(el.getAttribute('data-task'));
  if (action === 'cancel') {
    vsc.postMessage({ type: 'cancelPlan' });
    return;
  }
  if (planBusy) return;
  if (action === 'set-key') {
    vsc.postMessage({ type: 'setAnthropicKey' });
    return;
  }
  if (action === 'clear-key') {
    vsc.postMessage({ type: 'clearAnthropicKey' });
    return;
  }
  if (action === 'back') {
    showScr('home');
    return;
  }
  if (action === 'file') {
    vsc.postMessage({ type: 'pickPlanContext' });
    return;
  }
  if (action === 'clear-file') {
    planFileName = '';
    vsc.postMessage({ type: 'clearPlanContext' });
    rPlan();
    return;
  }
  if (action === 'ask') {
    const field = document.getElementById('planIdea');
    planIdea = field ? field.value : planIdea;
    planBusy = true;
    planError = '';
    rPlan();
    vsc.postMessage({ type: 'proposePlan', idea: planIdea });
    return;
  }
  if (action === 'manual') {
    vsc.postMessage({ type: 'manualPlan' });
    return;
  }
  if (!planDraft) return;
  if (action !== 'regen-yes') readPlanDraft();
  if (action === 'back-draft') {
    planDraft = null;
    planConfirm = false;
    rPlan();
    return;
  }
  if (action === 'accept') {
    vsc.postMessage({ type: 'acceptPlan', plan: planDraft });
    return;
  }
  if (action === 'regen') {
    if (planDirty) {
      planConfirm = true;
      rPlan();
      return;
    }
    planBusy = true;
    planError = '';
    rPlan();
    vsc.postMessage({ type: 'proposePlan', idea: planIdea });
    return;
  }
  if (action === 'regen-no') {
    planConfirm = false;
    rPlan();
    return;
  }
  if (action === 'regen-yes') {
    planConfirm = false;
    planBusy = true;
    planError = '';
    rPlan();
    vsc.postMessage({ type: 'proposePlan', idea: planIdea });
    return;
  }
  if (action === 'add-epic') planDraft = addPlanEpic(planDraft);
  if (action === 'add-task') planDraft = addPlanTask(planDraft, epicIndex);
  if (action === 'epic-delete') planDraft.epics.splice(epicIndex, 1);
  if (action === 'task-delete' && planDraft.epics[epicIndex]) {
    planDraft.epics[epicIndex].tasks.splice(taskIndex, 1);
  }
  if (action === 'epic-up' || action === 'epic-down') {
    swapPlan(planDraft.epics, epicIndex, action === 'epic-up' ? -1 : 1);
  }
  if ((action === 'task-up' || action === 'task-down') && planDraft.epics[epicIndex]) {
    swapPlan(planDraft.epics[epicIndex].tasks, taskIndex, action === 'task-up' ? -1 : 1);
  }
  if (action !== 'accept') {
    markPlanDirty();
    planConfirm = false;
    rPlan();
  }
});

document.addEventListener('input', (event) => {
  const field = event.target.closest('[data-plan-field]');
  if (!field || !planDraft) return;
  readPlanDraft();
  markPlanDirty();
});

function swapPlan(list, index, direction) {
  const next = index + direction;
  if (next < 0 || next >= list.length) return;
  const item = list[index];
  list[index] = list[next];
  list[next] = item;
}

function addPlanEpic(plan) {
  const epicNumber = plan.nextEpicNumber;
  const taskNumber = plan.nextTaskNumber;
  plan.nextEpicNumber += 1;
  plan.nextTaskNumber += 1;
  plan.epics.push({
    id: 'EPIC-' + epicNumber,
    title: '',
    summary: '',
    tasks: [
      {
        id: 'PROJ-' + taskNumber,
        title: '',
        description: '',
        acceptanceCriteria: [],
        estimate: '',
        status: 'todo',
      },
    ],
  });
  return plan;
}

function addPlanTask(plan, epicIndex) {
  const epic = plan.epics[epicIndex];
  if (!epic) return plan;
  epic.tasks.push({
    id: 'PROJ-' + plan.nextTaskNumber,
    title: '',
    description: '',
    acceptanceCriteria: [],
    estimate: '',
    status: 'todo',
  });
  plan.nextTaskNumber += 1;
  return plan;
}

window.addEventListener('message', (event) => {
  const data = event.data || {};
  if (data.type === 'planContext') {
    planFileName = data.name || '';
    if (!planDraft) rPlan();
  }
  if (data.type === 'planProvider') {
    planProviderLabel = data.provider || '';
    if (planDraft) readPlanDraft();
    if (planBusy) rPlan();
  }
  if (data.type === 'planProposal') showPlanProposal(data.plan, data.source);
  if (
    data.type === 'planUnavailable' ||
    data.type === 'planFailed' ||
    data.type === 'planCancelled'
  ) {
    planBusy = false;
    planError =
      data.message || (data.type === 'planCancelled' ? t('planCancelled') : t('planNoModel'));
    if (planDraft) readPlanDraft();
    rPlan();
  }
  if (data.type === 'planInvalid') {
    planError = data.message || t('planInvalid');
    rPlan();
  }
  if (data.type === 'planAccepted') applyAcceptedPlan(data);
  if (data.type === 'planTaskStatus') applyPlanStatus(data.ticketId, data.status);
});
