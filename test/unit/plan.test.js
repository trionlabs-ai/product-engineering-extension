const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const test = require('node:test');
const plan = require('../../src/host/planSchema');
const store = require('../../src/host/planStore');
const ai = require('../../src/host/planAi');
const sync = require('../../src/host/planSync');

function sampleInput() {
  return {
    title: 'Tool library',
    summary: 'Neighbors share tools.',
    epics: [
      {
        title: 'Catalog',
        summary: 'List what people own.',
        tasks: [
          {
            title: 'Add a tool',
            description: 'A form with a name.',
            acceptanceCriteria: ['Name is required'],
            estimate: '1d',
          },
          {
            title: 'Search tools',
            description: 'Filter the list.',
            acceptanceCriteria: ['Empty search shows everything'],
            estimate: '0.5d',
          },
        ],
      },
    ],
  };
}

test('assignIds keeps existing ids and does not reuse numbers after edit', () => {
  const first = plan.assignIds(sampleInput(), { nextTaskNumber: 4, nextEpicNumber: 2 });
  assert.strictEqual(first.epics[0].id, 'EPIC-2');
  assert.strictEqual(first.epics[0].tasks[0].id, 'PROJ-4');
  assert.strictEqual(first.epics[0].tasks[1].id, 'PROJ-5');
  assert.strictEqual(first.nextTaskNumber, 6);
  assert.strictEqual(first.nextEpicNumber, 3);
  const renamed = plan.clonePlan(first);
  renamed.epics[0].tasks[0].title = 'Rename the tool form';
  const moved = plan.moveTask(renamed, 0, 0, 1);
  assert.strictEqual(moved.epics[0].tasks[1].id, 'PROJ-4');
  assert.strictEqual(moved.epics[0].tasks[1].title, 'Rename the tool form');
  const added = plan.addTask(moved, 0);
  assert.strictEqual(added.epics[0].tasks[0].id, 'PROJ-5');
  assert.strictEqual(added.epics[0].tasks[2].id, 'PROJ-6');
  assert.strictEqual(added.nextTaskNumber, 7);
  assert.strictEqual(plan.validatePlan(added).ok, false);
  added.epics[0].tasks[2].title = 'Reserve a tool';
  assert.strictEqual(plan.validatePlan(added).ok, true);
});

test('validatePlan rejects a bad schema and accepts a normalized plan', () => {
  assert.strictEqual(plan.validatePlan({ schemaVersion: 2 }).ok, false);
  assert.ok(plan.validatePlan(null).errors.includes('plan'));
  const normalized = plan.assignIds(sampleInput(), { nextTaskNumber: 1, nextEpicNumber: 1 });
  assert.strictEqual(plan.validatePlan(normalized).ok, true);
  const broken = plan.clonePlan(normalized);
  broken.epics[0].tasks[0].status = 'shipped';
  assert.ok(plan.validatePlan(broken).errors.includes('status'));
});

test('renderPlanMarkdown shows progress, criteria, and estimates', () => {
  const normalized = plan.assignIds(sampleInput(), { nextTaskNumber: 1, nextEpicNumber: 1 });
  normalized.epics[0].tasks[1].status = 'done';
  const markdown = plan.renderPlanMarkdown(normalized);
  assert.match(markdown, /^# Tool library/);
  assert.match(markdown, /Progress: 1\/2 done/);
  assert.match(markdown, /## EPIC-1: Catalog/);
  assert.match(markdown, /- \[ \] \*\*PROJ-1: Add a tool\*\* \(1d\)/);
  assert.match(markdown, /- \[x\] \*\*PROJ-2: Search tools\*\*/);
  assert.match(markdown, /Name is required/);
});

test('mergeWorkspace keeps unrelated tasks and updates plan status', () => {
  const normalized = plan.assignIds(sampleInput(), { nextTaskNumber: 1, nextEpicNumber: 1 });
  normalized.epics[0].tasks[0].status = 'in_progress';
  const merged = plan.mergeWorkspace(
    { 'LOCAL-1': { title: { en: 'Other' }, status: { en: 'To do' } } },
    {},
    normalized
  );
  assert.strictEqual(merged.tasks['LOCAL-1'].title.en, 'Other');
  assert.strictEqual(merged.tasks['PROJ-1'].status.en, 'In progress');
  assert.strictEqual(merged.epics['EPIC-1'].name.en, 'Catalog');
});

test('setTaskStatus does not renumber and does not reopen a finished task', () => {
  const normalized = plan.assignIds(sampleInput(), { nextTaskNumber: 1, nextEpicNumber: 1 });
  const started = plan.setTaskStatus(normalized, 'PROJ-1', 'in_progress');
  assert.strictEqual(started.changed, true);
  assert.strictEqual(started.plan.epics[0].tasks[0].id, 'PROJ-1');
  assert.strictEqual(started.plan.nextTaskNumber, normalized.nextTaskNumber);
  const finished = plan.setTaskStatus(started.plan, 'PROJ-1', 'done');
  const reopened = plan.setTaskStatus(finished.plan, 'PROJ-1', 'in_progress');
  assert.strictEqual(reopened.changed, false);
  assert.strictEqual(reopened.plan.epics[0].tasks[0].status, 'done');
  assert.strictEqual(plan.workspaceStatusToPlan({ en: 'Completed' }), 'done');
  assert.strictEqual(plan.workspaceStatusToPlan({ es: 'En curso' }), 'in_progress');
});

test('atomic save writes json and markdown and refuses a corrupt file', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ps-plan-'));
  const normalized = plan.assignIds(sampleInput(), { nextTaskNumber: 1, nextEpicNumber: 1 });
  const saved = await store.savePlan(root, normalized);
  assert.strictEqual(saved.ok, true);
  const paths = store.planPaths(root);
  assert.strictEqual(fs.existsSync(paths.json + '.tmp'), false);
  assert.match(fs.readFileSync(paths.markdown, 'utf8'), /PROJ-1/);
  const loaded = await store.loadPlan(root);
  assert.strictEqual(loaded.plan.epics[0].tasks[0].id, 'PROJ-1');

  fs.writeFileSync(paths.json, '{', 'utf8');
  const corrupt = await store.loadPlan(root);
  assert.strictEqual(corrupt.corrupt, true);
  assert.strictEqual(fs.readFileSync(paths.json, 'utf8'), '{');
  const refused = await store.savePlan(root, normalized);
  assert.strictEqual(refused.ok, false);
  assert.strictEqual(fs.readFileSync(paths.json, 'utf8'), '{');
  assert.strictEqual(store.isInsideWorkspace(root, path.join(root, '..', 'evil.json')), false);
  assert.strictEqual(store.isInsideWorkspace(root, paths.json), true);
});

test('proposePlan parses a fenced reply and reports a missing model', async () => {
  const missing = await ai.proposePlan({ idea: 'a tool library', model: null });
  assert.strictEqual(missing.reason, 'no-model');
  const hostile = 'say "hello" $(whoami)';
  const result = await ai.proposePlan({
    idea: 'Share tools with neighbors',
    model: {
      id: 'fake',
      async complete() {
        return (
          '```json\n' +
          JSON.stringify({
            title: 'Tool library',
            summary: hostile,
            epics: [
              {
                title: 'Catalog',
                summary: 'List tools',
                tasks: [
                  {
                    title: hostile,
                    description: 'Details',
                    acceptanceCriteria: ['Name is required'],
                    estimate: '1d',
                  },
                ],
              },
            ],
          }) +
          '\n```'
        );
      },
    },
  });
  assert.strictEqual(result.ok, true);
  assert.strictEqual(result.plan.epics[0].tasks[0].id, 'PROJ-1');
  assert.strictEqual(result.plan.epics[0].tasks[0].title, hostile);
  assert.strictEqual(result.source, 'fake');
});

test('local sync target does not imply a network export', async () => {
  const target = sync.listPlanSyncTargets()[0];
  assert.strictEqual(target.id, 'local');
  const exported = await target.exportPlan({ schemaVersion: 1 });
  assert.strictEqual(exported.target, 'local');
  assert.strictEqual(sync.listPlanSyncTargets().length, 1);
});
