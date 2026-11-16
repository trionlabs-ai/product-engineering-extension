const AI_TOOL_NAMES = ['Claude', 'GitHub Copilot', 'Antigravity', 'Continue', 'Ollama', 'ChatGPT'];

function resolveLanguage(preference, envLanguage) {
  if (preference !== 'auto') return preference;
  return (envLanguage || 'en').startsWith('es') ? 'es' : 'en';
}

function getDetectedExts(getExtension) {
  const has = (id) => !!getExtension(id);
  return {
    gitlab: has('GitLab.gitlab-workflow'),
    github: has('GitHub.vscode-pull-request-github'),
    jira: has('Atlassian.atlascode'),
    claude: has('anthropic.claude-code') || has('saoudrizwan.claude-dev'),
    copilot: has('github.copilot') || has('github.copilot-chat'),
    gemini: has('googlecloudtools.cloudcode') || has('google.gemini'),
    continue: has('Continue.continue'),
    ollama: has('ashishalex.ollama-chat'),
  };
}

function pickDefaultAi(detected) {
  let defaultAi = 'Claude';
  if (detected.claude) defaultAi = 'Claude';
  else if (detected.copilot) defaultAi = 'GitHub Copilot';
  else if (detected.gemini) defaultAi = 'Antigravity';
  else if (detected.continue) defaultAi = 'Continue';
  else if (detected.ollama) defaultAi = 'Ollama';
  return defaultAi;
}

module.exports = {
  AI_TOOL_NAMES,
  resolveLanguage,
  getDetectedExts,
  pickDefaultAi,
};
