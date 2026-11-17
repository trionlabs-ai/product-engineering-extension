/**
 * Future Jira and GitHub sync implement this shape.
 * This stage only registers the local target and performs no network calls.
 *
 * @typedef {object} PlanSyncTarget
 * @property {string} id
 * @property {string} label
 * @property {(plan: object) => Promise<{ ok: boolean, target: string }>} exportPlan
 */

function createLocalPlanSyncTarget() {
  return {
    id: 'local',
    label: 'Workspace files',
    async exportPlan(plan) {
      return { ok: true, target: 'local', plan };
    },
  };
}

function listPlanSyncTargets() {
  return [createLocalPlanSyncTarget()];
}

module.exports = {
  createLocalPlanSyncTarget,
  listPlanSyncTargets,
};
