const { isTicketId } = require('./gitService');

const SCHEMA_VERSION = 1;
const STATUSES = new Set(['todo', 'in_progress', 'done']);
const LIMITS = {
  epics: 20,
  tasks: 30,
  title: 200,
  summary: 2000,
  description: 4000,
  criterion: 300,
  criteria: 20,
  estimate: 40,
};

function isEpicId(id) {
  return typeof id === 'string' && /^EPIC-\d{1,6}$/.test(id);
}

function idNumber(id, prefix) {
  const match = new RegExp('^' + prefix + '-(\\d+)$').exec(id || '');
  return match ? parseInt(match[1], 10) : 0;
}

function cleanText(value, max) {
  return String(value == null ? '' : value)
    .replace(/\0/g, '')
    .trim()
    .slice(0, max);
}

function asCriteria(value) {
  const source = Array.isArray(value) ? value : typeof value === 'string' ? value.split('\n') : [];
  return source
    .map((item) =>
      cleanText(item, LIMITS.criterion)
        .replace(/^[-*]\s*/, '')
        .replace(/^\[[ xX]\]\s*/, '')
    )
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, LIMITS.criteria);
}

function normalizeStatus(status) {
  return STATUSES.has(status) ? status : 'todo';
}

function clonePlan(plan) {
  return JSON.parse(JSON.stringify(plan));
}

function assignIds(partial, counters) {
  let nextTask = Math.max(1, Number(counters && counters.nextTaskNumber) || 1);
  let nextEpic = Math.max(1, Number(counters && counters.nextEpicNumber) || 1);
  const epics = (partial.epics || []).slice(0, LIMITS.epics).map((epic) => {
    const keepEpic = isEpicId(epic && epic.id);
    const epicId = keepEpic ? epic.id : 'EPIC-' + nextEpic;
    nextEpic = Math.max(nextEpic, idNumber(epicId, 'EPIC') + 1);
    const tasks = (epic.tasks || []).slice(0, LIMITS.tasks).map((task) => {
      const keepTask = task && isTicketId(task.id) && /^PROJ-\d{1,6}$/.test(task.id);
      const taskId = keepTask ? task.id : 'PROJ-' + nextTask;
      nextTask = Math.max(nextTask, idNumber(taskId, 'PROJ') + 1);
      return {
        id: taskId,
        title: cleanText(task && task.title, LIMITS.title),
        description: cleanText(task && task.description, LIMITS.description),
        acceptanceCriteria: asCriteria(task && task.acceptanceCriteria),
        estimate: cleanText(task && task.estimate, LIMITS.estimate),
        status: normalizeStatus(task && task.status),
      };
    });
    return {
      id: epicId,
      title: cleanText(epic && epic.title, LIMITS.title),
      summary: cleanText(epic && epic.summary, LIMITS.summary),
      tasks,
    };
  });
  return {
    schemaVersion: SCHEMA_VERSION,
    title: cleanText(partial && partial.title, LIMITS.title),
    summary: cleanText(partial && partial.summary, LIMITS.summary),
    updatedAt: new Date().toISOString(),
    nextTaskNumber: nextTask,
    nextEpicNumber: nextEpic,
    epics,
  };
}

function validatePlan(input) {
  const errors = [];
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return { ok: false, errors: ['plan'] };
  }
  if (input.schemaVersion !== SCHEMA_VERSION) errors.push('schema');
  if (typeof input.title !== 'string' || !input.title.trim()) errors.push('title');
  if (!Array.isArray(input.epics) || input.epics.length === 0) {
    errors.push('epics');
  }
  if (Array.isArray(input.epics) && input.epics.length > LIMITS.epics) {
    errors.push('too-many-epics');
  }
  const seenEpics = new Set();
  const seenTasks = new Set();
  let maxTask = 0;
  let maxEpic = 0;
  (input.epics || []).forEach((epic, epicIndex) => {
    if (!epic || typeof epic !== 'object') {
      errors.push('epic');
      return;
    }
    if (!isEpicId(epic.id)) errors.push('epic-id');
    else if (seenEpics.has(epic.id)) errors.push('duplicate-epic');
    else seenEpics.add(epic.id);
    maxEpic = Math.max(maxEpic, idNumber(epic.id, 'EPIC'));
    if (typeof epic.title !== 'string' || !epic.title.trim()) errors.push('epic-title');
    if (!Array.isArray(epic.tasks) || epic.tasks.length === 0) errors.push('epic-tasks');
    (epic.tasks || []).forEach((task) => {
      if (!task || typeof task !== 'object') {
        errors.push('task');
        return;
      }
      if (!task.id || !/^PROJ-\d{1,6}$/.test(task.id)) errors.push('task-id');
      else if (seenTasks.has(task.id)) errors.push('duplicate-task');
      else seenTasks.add(task.id);
      maxTask = Math.max(maxTask, idNumber(task.id, 'PROJ'));
      if (typeof task.title !== 'string' || !task.title.trim()) errors.push('task-title');
      if (task.status && !STATUSES.has(task.status)) errors.push('status');
      if (task.acceptanceCriteria && !Array.isArray(task.acceptanceCriteria)) {
        errors.push('criteria');
      }
    });
  });
  if (typeof input.nextTaskNumber !== 'number' || input.nextTaskNumber <= maxTask) {
    errors.push('next-task');
  }
  if (typeof input.nextEpicNumber !== 'number' || input.nextEpicNumber <= maxEpic) {
    errors.push('next-epic');
  }
  return errors.length ? { ok: false, errors } : { ok: true, plan: input };
}

function blankPlan(counters) {
  return assignIds(
    {
      title: '',
      summary: '',
      epics: [
        {
          title: '',
          summary: '',
          tasks: [
            { title: '', description: '', acceptanceCriteria: [], estimate: '', status: 'todo' },
          ],
        },
      ],
    },
    counters
  );
}

function addEpic(plan) {
  const copy = clonePlan(plan);
  copy.epics.push({
    id: 'EPIC-' + copy.nextEpicNumber,
    title: '',
    summary: '',
    tasks: [],
  });
  copy.nextEpicNumber += 1;
  copy.epics[copy.epics.length - 1].tasks.push({
    id: 'PROJ-' + copy.nextTaskNumber,
    title: '',
    description: '',
    acceptanceCriteria: [],
    estimate: '',
    status: 'todo',
  });
  copy.nextTaskNumber += 1;
  return copy;
}

function addTask(plan, epicIndex) {
  const copy = clonePlan(plan);
  const epic = copy.epics[epicIndex];
  if (!epic) return copy;
  epic.tasks.push({
    id: 'PROJ-' + copy.nextTaskNumber,
    title: '',
    description: '',
    acceptanceCriteria: [],
    estimate: '',
    status: 'todo',
  });
  copy.nextTaskNumber += 1;
  return copy;
}

function moveItem(list, index, direction) {
  const next = index + direction;
  if (index < 0 || next < 0 || index >= list.length || next >= list.length) return;
  const item = list[index];
  list[index] = list[next];
  list[next] = item;
}

function moveEpic(plan, index, direction) {
  const copy = clonePlan(plan);
  moveItem(copy.epics, index, direction);
  return copy;
}

function moveTask(plan, epicIndex, taskIndex, direction) {
  const copy = clonePlan(plan);
  const epic = copy.epics[epicIndex];
  if (!epic) return copy;
  moveItem(epic.tasks, taskIndex, direction);
  return copy;
}

function removeEpic(plan, index) {
  const copy = clonePlan(plan);
  copy.epics.splice(index, 1);
  return copy;
}

function removeTask(plan, epicIndex, taskIndex) {
  const copy = clonePlan(plan);
  const epic = copy.epics[epicIndex];
  if (!epic) return copy;
  epic.tasks.splice(taskIndex, 1);
  return copy;
}

function setTaskStatus(plan, ticketId, status) {
  if (!STATUSES.has(status)) return { plan, changed: false };
  const copy = clonePlan(plan);
  let changed = false;
  copy.epics.forEach((epic) => {
    epic.tasks.forEach((task) => {
      if (task.id !== ticketId || task.status === status) return;
      if (status === 'in_progress' && task.status === 'done') return;
      task.status = status;
      changed = true;
    });
  });
  if (changed) copy.updatedAt = new Date().toISOString();
  return { plan: copy, changed };
}

function workspaceStatusToPlan(status) {
  const value =
    typeof status === 'string' ? status : (status && (status.en || status.es || '')) || '';
  const lower = String(value).toLowerCase();
  if (lower.includes('complet') || lower.includes('done')) return 'done';
  if (lower.includes('curso') || lower.includes('progress')) return 'in_progress';
  return 'todo';
}

function statusLabels(status) {
  if (status === 'done') return { es: 'Completado', en: 'Completed' };
  if (status === 'in_progress') return { es: 'En curso', en: 'In progress' };
  return { es: 'Por hacer', en: 'To do' };
}

function planToWorkspace(plan) {
  const colors = ['#0969da', '#8250df', '#1a7f37', '#bf8700', '#cf222e'];
  const epics = {};
  const tasks = {};
  plan.epics.forEach((epic, index) => {
    const key =
      (epic.title || 'EPIC')
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, '')
        .slice(0, 8) || 'EPIC';
    epics[epic.id] = {
      id: epic.id,
      key,
      name: { es: epic.title, en: epic.title },
      summary: { es: epic.summary || '', en: epic.summary || '' },
      color: colors[index % colors.length],
      milestoneId: '',
      lead: '',
    };
    epic.tasks.forEach((task) => {
      tasks[task.id] = {
        title: { es: task.title, en: task.title },
        desc: { es: task.description || '', en: task.description || '' },
        status: statusLabels(task.status),
        color: task.status === 'done' ? 'green' : 'blue',
        type: 'story',
        assignedTo: 'me',
        epicId: epic.id,
        milestoneId: '',
        criteria: {
          es: task.acceptanceCriteria.slice(),
          en: task.acceptanceCriteria.slice(),
        },
        estimate: task.estimate || '',
      };
    });
  });
  return { epics, tasks };
}

function mergeWorkspace(existingTasks, existingEpics, plan) {
  const mapped = planToWorkspace(plan);
  const tasks = Object.assign({}, existingTasks || {});
  const epics = Object.assign({}, existingEpics || {});
  Object.keys(mapped.epics).forEach((id) => {
    epics[id] = mapped.epics[id];
  });
  Object.keys(mapped.tasks).forEach((id) => {
    if (tasks[id]) {
      tasks[id] = Object.assign({}, tasks[id], {
        status: mapped.tasks[id].status,
        color: mapped.tasks[id].color,
        epicId: mapped.tasks[id].epicId,
        estimate: mapped.tasks[id].estimate,
      });
    } else {
      tasks[id] = mapped.tasks[id];
    }
  });
  return { tasks, epics };
}

function renderPlanMarkdown(plan) {
  const done = plan.epics.reduce(
    (count, epic) => count + epic.tasks.filter((task) => task.status === 'done').length,
    0
  );
  const total = plan.epics.reduce((count, epic) => count + epic.tasks.length, 0);
  const lines = ['# ' + (plan.title || 'Project plan'), ''];
  if (plan.summary) lines.push(plan.summary, '');
  lines.push('Progress: ' + done + '/' + total + ' done', '');
  plan.epics.forEach((epic) => {
    const epicDone = epic.tasks.filter((task) => task.status === 'done').length;
    lines.push('## ' + epic.id + ': ' + epic.title);
    lines.push('');
    if (epic.summary) lines.push(epic.summary, '');
    lines.push(epicDone + '/' + epic.tasks.length + ' done', '');
    epic.tasks.forEach((task) => {
      const box = task.status === 'done' ? 'x' : ' ';
      const estimate = task.estimate ? ' (' + task.estimate + ')' : '';
      lines.push('- [' + box + '] **' + task.id + ': ' + task.title + '**' + estimate);
      if (task.description) lines.push('  ' + task.description.replace(/\n/g, '\n  '));
      (task.acceptanceCriteria || []).forEach((criterion) => {
        lines.push('  - ' + criterion);
      });
    });
    lines.push('');
  });
  return lines.join('\n').trim() + '\n';
}

module.exports = {
  SCHEMA_VERSION,
  STATUSES,
  isEpicId,
  assignIds,
  validatePlan,
  blankPlan,
  addEpic,
  addTask,
  moveEpic,
  moveTask,
  removeEpic,
  removeTask,
  setTaskStatus,
  workspaceStatusToPlan,
  planToWorkspace,
  mergeWorkspace,
  renderPlanMarkdown,
  clonePlan,
};
