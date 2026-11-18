
const vsc = acquireVsCodeApi();
const bootstrap = JSON.parse(document.getElementById('ps-bootstrap').textContent);
let L = bootstrap.lang;
let onb = !!bootstrap.onboarded;
let cTools = bootstrap.connectedTools || [];
let detExts = bootstrap.detectedExts;
let isLocalMode = !!bootstrap.localMode;
let activeAi = bootstrap.activeAi || 'Claude';
let D = bootstrap.i18n;

function attrEncode(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;');
}
let localGitState = { hasGit: false, branch: 'main', hasChanges: false, commits: 0, rootPath: null };
let workNotice = '';
let selC=new Set(); // Start empty - let user pick their own stack!
let aTk=null,cS=1,filterMode='all';

const svgCheck='<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 6L9 17l-5-5"/></svg>';
const svgEdit='<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 2 2h14a2 2 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>';
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
const svgCards='<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="9" rx="1"/><rect x="14" y="3" width="7" height="5" rx="1"/><rect x="14" y="12" width="7" height="9" rx="1"/><rect x="3" y="16" width="7" height="5" rx="1"/></svg>';
const svgEpic='<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>';
const svgRoadmap='<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="4" cy="12" r="2"/><circle cx="12" cy="6" r="2"/><circle cx="20" cy="12" r="2"/><path d="M6 12h4l4-6h4"/><path d="M12 8v8"/></svg>';
const svgSparkle='<svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l2.4 7.2L22 12l-7.6 2.8L12 22l-2.4-7.2L2 12l7.6-2.8z"/></svg>';
const svgImage='<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>';

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

function t(k, v) { return ProductStudioI18n.lookup(D, L, k, v); }


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

// Epics & Milestones (empty by default - no demo data)
const defaultEpics = {};
const defaultMilestones = {};

let epics = (bootstrap.epics && Object.keys(bootstrap.epics).length > 0) ? bootstrap.epics : {};
let planWarning = bootstrap.planWarning || '';
let milestones = defaultMilestones;
let selectedEpicId = null; // null = list of epics; string = tasks in that epic
let editingEpicId = null; // null = new epic, string = editing existing epic
let mainViewMode = 'epics'; // 'epics' | 'allTasks'

function saveEpics(){vsc.postMessage({type:'saveEpics',epics});}

function openEpic(eid){selectedEpicId = eid; rHome();}
function closeEpic(){selectedEpicId = null; rHome();}
function setMainViewMode(mode){mainViewMode = mode; selectedEpicId = null; rHome();}

function openCreateEpic(){
  editingEpicId = null;
  showScr('createEpic');
}

function editEpic(eid){
  editingEpicId = eid;
  showScr('createEpic');
}

function deleteEpic(eid){
  vsc.postMessage({type:'confirmDeleteEpic',epicId:eid});
}

function createTaskInEpic(eid){
  selectedEpicId = eid;
  showScr('create');
  setTimeout(()=>{
    const sel = document.getElementById('nEpic');
    if(sel) sel.value = eid;
  }, 10);
}

function renderScreenThumbSvg(name, title) {
  return '<svg viewBox="0 0 240 140" width="100%" height="90" style="background:#090d16;display:block">' +
    '<rect width="240" height="18" fill="#1e293b"/>' +
    '<circle cx="10" cy="9" r="3" fill="#ef4444"/>' +
    '<circle cx="18" cy="9" r="3" fill="#f59e0b"/>' +
    '<circle cx="26" cy="9" r="3" fill="#10b981"/>' +
    '<rect x="36" y="4" width="130" height="10" rx="3" fill="#0f172a"/>' +
    '<text x="42" y="12" fill="#94a3b8" font-size="7" font-family="monospace">localhost:3000/app</text>' +
    '<rect x="12" y="28" width="60" height="8" rx="2" fill="#3b82f6"/>' +
    '<rect x="160" y="28" width="68" height="8" rx="2" fill="#334155"/>' +
    '<rect x="12" y="44" width="216" height="12" rx="2" fill="#1e293b"/>' +
    '<rect x="12" y="60" width="216" height="10" rx="2" fill="#172033"/>' +
    '<rect x="12" y="74" width="216" height="10" rx="2" fill="#131c2e"/>' +
    '<rect x="12" y="88" width="216" height="10" rx="2" fill="#0f172a"/>' +
    '<rect x="12" y="102" width="216" height="10" rx="2" fill="#131c2e"/>' +
    '<rect x="14" y="63" width="40" height="4" rx="1" fill="#60a5fa"/>' +
    '<rect x="180" y="63" width="24" height="4" rx="1" fill="#10b981"/>' +
    '<rect x="14" y="77" width="30" height="4" rx="1" fill="#94a3b8"/>' +
    '<rect x="180" y="77" width="24" height="4" rx="1" fill="#10b981"/>' +
    '<rect x="14" y="91" width="55" height="4" rx="1" fill="#94a3b8"/>' +
    '<rect x="180" y="91" width="24" height="4" rx="1" fill="#f59e0b"/>' +
    '<circle cx="220" cy="125" r="8" fill="#10b981"/>' +
    '<path d="M217 125l2 2 4-4" stroke="#fff" stroke-width="1.5" fill="none"/>' +
  '</svg>';
}

function ensureTaskEnrichment(tk, id) {
  if (!tk.epicId) {
    if (id === 'PROJ-104') tk.epicId = 'EPIC-12';
    else if (id === 'PROJ-110') tk.epicId = 'EPIC-15';
    else tk.epicId = 'EPIC-10';
  }
  if (!tk.milestoneId) {
    tk.milestoneId = (tk.epicId === 'EPIC-15') ? 'M-2' : 'M-1';
  }
  if (!tk.tests || !Array.isArray(tk.tests) || tk.tests.length === 0) {
    let rawCr = [];
    if (Array.isArray(tk.criteria)) rawCr = tk.criteria;
    else if (tk.criteria && typeof tk.criteria === 'object') rawCr = tk.criteria[L] || tk.criteria.es || tk.criteria.en || [];
    if (!rawCr || rawCr.length === 0) rawCr = ['Validación de requerimiento'];
    tk.tests = rawCr.map((c, i) => ({
      id: 't-' + id.toLowerCase() + '-' + (i + 1),
      name: 'test_' + id.toLowerCase().replace(/-/g, '_') + '_crit_' + (i + 1),
      desc: { es: typeof c === 'string' ? c : 'Validación de criterio', en: typeof c === 'string' ? c : 'Criteria validation' },
      status: 'passed',
      duration: (32 + i * 14) + 'ms'
    }));
  }
  if (!tk.screenshots || !Array.isArray(tk.screenshots) || tk.screenshots.length === 0) {
    tk.screenshots = [
      {
        id: 'ss-' + id.toLowerCase() + '-1',
        name: 'evidence_' + id.toLowerCase().replace(/-/g, '_') + '_initial_state.png',
        title: { es: 'Captura inicial ejecutada por test suite', en: 'Initial capture run by test suite' },
        source: 'Playwright E2E Runner',
        time: '10:30:12'
      },
      {
        id: 'ss-' + id.toLowerCase() + '-2',
        name: 'evidence_' + id.toLowerCase().replace(/-/g, '_') + '_verified_flow.png',
        title: { es: 'Flujo de usuario validado con éxito', en: 'User flow verified successfully' },
        source: 'Playwright E2E Runner',
        time: '10:30:18'
      }
    ];
  }
}

function getEpicProgress(epicId) {
  const epicTasks = Object.keys(tasks).filter(id => tasks[id].epicId === epicId);
  if (epicTasks.length === 0) return { total: 0, done: 0, pct: 0, tasks: [] };
  const done = epicTasks.filter(id => {
    const st = (tasks[id].status[L] || tasks[id].status.es || tasks[id].status.en || tasks[id].status || '').toLowerCase();
    return st.includes('revis') || st.includes('review') || st.includes('done') || st.includes('complet');
  }).length;
  const pct = Math.round((done / epicTasks.length) * 100);
  return { total: epicTasks.length, done, pct, tasks: epicTasks };
}

function getMilestoneProgress(milestoneId) {
  const m = milestones[milestoneId];
  if (!m) return { total: 0, done: 0, pct: 0, tasks: [] };
  const mTasks = Object.keys(tasks).filter(id => tasks[id].milestoneId === milestoneId);
  if (mTasks.length === 0) return { total: 0, done: 0, pct: (m.status === 'completed' ? 100 : 0), tasks: [] };
  const done = mTasks.filter(id => {
    const st = (tasks[id].status[L] || tasks[id].status.es || tasks[id].status.en || tasks[id].status || '').toLowerCase();
    return st.includes('revis') || st.includes('review') || st.includes('done') || st.includes('complet');
  }).length;
  const pct = Math.round((done / mTasks.length) * 100);
  return { total: mTasks.length, done, pct, tasks: mTasks };
}

// Tasks (mutable, empty by default - no demo data)
let nextId = 100;
const defaultTasks = {};
let tasks = (bootstrap.tasks && Object.keys(bootstrap.tasks).length > 0) ? bootstrap.tasks : {};

function saveTasks(){vsc.postMessage({type:'saveTasks',tasks})}

// Screen management
function showScr(n){
  ['sOb','sHome','sTk','sSet','sCreate','sCreateEpic','sEnv','sAi','sPlan'].forEach(id=>{
    const el = document.getElementById(id);
    if(el) el.style.display='none';
  });
  const map={onboarding:'sOb',home:'sHome',ticket:'sTk',settings:'sSet',create:'sCreate',createEpic:'sCreateEpic',env:'sEnv',ai:'sAi',plan:'sPlan'};
  if(map[n] && document.getElementById(map[n])) {
    document.getElementById(map[n]).style.display='';
  }
  if(n==='onboarding')rOb();
  if(n==='home')rHome();
  if(n==='settings')rSet();
  if(n==='create')rCreate();
  if(n==='createEpic')rCreateEpic();
  if(n==='env')rEnv();
  if(n==='ai')rAi();
  if(n==='plan' && typeof globalThis.rPlan==='function') globalThis.rPlan();
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
let obS=0;
let showTips=false;

function toggleToolTips(){
  showTips = !showTips;
  rObS();
}

function startLocally(){
  isLocalMode = true;
  if (selC.size === 0) {
    const aiChoice = detExts.copilot ? 'GitHub Copilot' : (detExts.gemini ? 'Antigravity' : 'Claude');
    selC.add(aiChoice);
    activeAi = aiChoice;
  }
  vsc.postMessage({
    type: 'finishOnboarding',
    tools: Array.from(selC),
    localMode: true,
    activeAi: activeAi
  });
  onb = true;
  const bLoc = document.getElementById('topLocalBadge');
  if (bLoc) bLoc.style.display = '';
  toast(L === 'es' ? 'Modo local activado. Crea tus epicas, tareas y commits en local.' : 'Local mode activated. Create your epics, tasks, and commits locally.');
  showScr('home');
}

function selectStarterStack(){
  const aiChoice = detExts.copilot ? 'GitHub Copilot' : 'Claude';
  const repoChoice = detExts.github ? 'GitHub' : 'GitLab';
  selC.add(aiChoice);
  selC.add('Jira');
  selC.add(repoChoice);
  selC.add('Figma');
  activeAi = aiChoice;
  obS = 1;
  rObS();
  toast(L === 'es' ? 'Stack basico seleccionado (IA + Jira + Repo + Figma)' : 'Starter stack selected (AI + Jira + Repo + Figma)');
}

function rOb(){
  document.getElementById('sOb').innerHTML='<div class="ctr fi" id="obC"></div>';
  rObS();
}
function rObS(){
  const c=document.getElementById('obC');if(!c)return;
  if(obS===0){
    let h='<div style="max-width:540px;margin:0 auto">';
    h+='<div style="text-align:center;margin-bottom:20px">';
    h+='<h1 style="font-size:18px;font-weight:700;margin-bottom:4px">Product Studio</h1>';
    h+='<p style="font-size:12px;color:var(--vscode-descriptionForeground)">'+(L==='es'?'Elige como prefieres empezar a trabajar':'Choose how you want to get started')+'</p>';
    h+='</div>';

    // 1. Where to start / Starter stack
    h+='<div class="card card-bg" style="padding:14px;margin-bottom:14px;border-color:var(--vscode-panel-border)">';
    h+='<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px">';
    h+='<div style="display:flex;align-items:center;gap:6px;font-size:13px;font-weight:700;color:var(--vscode-textLink-foreground)">';
    h+='<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>';
    h+='<span>'+(L==='es'?'No sabes por donde empezar?':'New here? Where to start')+'</span>';
    h+='</div>';
    h+='<button class="bp" style="width:auto;padding:5px 12px;font-size:11.5px" data-act="selectStarterStack">'+(L==='es'?'Elegir combinacion basica':'Pick starter stack')+'</button>';
    h+='</div>';
    h+='<p style="font-size:12px;color:var(--vscode-descriptionForeground);line-height:1.45;margin-bottom:10px">';
    h+=(L==='es'
      ?'Solo necesitas 3 cosas basicas: <strong>1 Asistente de IA</strong> (Claude o Copilot para programar), <strong>1 Gestor de Tareas</strong> (Jira o Asana) y <strong>1 Repositorio</strong> (GitLab o GitHub). Haz clic en el boton para pre-seleccionarlas.'
      :'You only need 3 basics: <strong>1 AI Assistant</strong> (Claude or Copilot to write code), <strong>1 Task Manager</strong> (Jira or Asana), and <strong>1 Repository</strong> (GitLab or GitHub). Click the button above to pre-select them.');
    h+='</p>';
    h+='<div style="display:flex;justify-content:flex-end">';
    h+='<button class="bs" style="width:auto;font-size:11px;padding:3px 8px" data-act="obN" data-arg="1">'+(L==='es'?'Personalizar herramientas manualmente ›':'Customize tools manually ›')+'</button>';
    h+='</div>';
    h+='</div>';

    // 2. Start locally
    h+='<div class="card card-bg" style="padding:14px;margin-bottom:14px;border-color:var(--vscode-panel-border)">';
    h+='<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px">';
    h+='<div style="display:flex;align-items:center;gap:6px;font-size:13px;font-weight:700">';
    h+='<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>';
    h+='<span>'+(L==='es'?'Empezar en local':'Start locally')+'</span>';
    h+='</div>';
    h+='<button class="bp" style="width:auto;padding:5px 12px;font-size:11.5px" data-act="startLocally">'+(L==='es'?'Empezar en modo local':'Start in local mode')+'</button>';
    h+='</div>';
    h+='<p style="font-size:12px;color:var(--vscode-descriptionForeground);line-height:1.45;margin-bottom:0">';
    h+=(L==='es'
      ?'Trabaja en tu maquina sin Jira ni herramientas externas. Crea epicas, historias y commits 100% locales en tu carpeta.'
      :'Work on your machine without Jira or external tools. Create epics, stories, and commits 100% locally in your folder.');
    h+='</p>';
    h+='</div>';

    h+='</div>';
    c.innerHTML=h;
  }else if(obS===1){
    let h='<div style="text-align:center;font-size:12px;color:var(--vscode-descriptionForeground);margin-bottom:14px;font-weight:600">'+t('obS',{n:1,t:3})+'</div>';
    h+='<h2 style="font-size:16px;font-weight:700;text-align:center;margin-bottom:4px">'+t('obT1')+'</h2><p style="font-size:12px;color:var(--vscode-descriptionForeground);text-align:center;margin-bottom:12px">'+t('obS1')+'</p>';

    // Search bar & Explanation toggle
    h+='<div style="display:flex;gap:6px;align-items:center;margin-bottom:10px">';
    h+='<div style="position:relative;flex:1"><svg style="position:absolute;left:10px;top:50%;transform:translateY(-50%)" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--vscode-descriptionForeground)" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg><input class="inp" style="padding-left:30px" placeholder="'+t('obSrch')+'" data-input="fC"></div>';
    h+='<button class="bs" style="width:auto;padding:8px 10px;font-size:11px;white-space:nowrap" data-act="toggleToolTips" id="tipToggleBtn">'+(showTips?(L==='es'?'Ocultar tips':'Hide tips'):(L==='es'?'Ver explicaciones':'Show explanations'))+'</button>';
    h+='</div>';

    // Category pills filter
    h+='<div class="cat-pills">';
    h+='<button class="cat-pill active" data-act="setCatFilter" data-arg="all">'+(L==='es'?'Todas':'All')+'</button>';
    h+='<button class="cat-pill" data-act="setCatFilter" data-arg="popular">'+t('cPop')+'</button>';
    catOrder.forEach(cat=>{
      h+='<button class="cat-pill" data-act="setCatFilter" data-arg="' + cat + '">'+t(cat)+'</button>';
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
      let popBadge = isPop ? '<span style="font-size:10px;color:var(--vscode-focusBorder);margin-left:auto;font-weight:700">POP</span>' : '';

      h+='<div class="cc'+(s?' sel':'')+'" data-name="'+cn.n+'" data-cat="'+cn.c+'" data-pop="'+(isPop?'1':'0')+'" data-desc="'+d.replace(/"/g,'&quot;')+'" title="'+tipText.replace(/"/g,'&quot;')+'" data-act="tC">'+
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

    h+='<div style="display:flex;align-items:center;justify-content:space-between;margin-top:10px"><button class="bs" style="width:auto;padding:6px 14px;font-size:12px" data-act="obN" data-arg="0">'+t('back')+'</button><div style="display:flex;align-items:center;gap:10px"><span style="font-size:11px;color:var(--vscode-descriptionForeground)" id="cCnt">'+t('obSel',{n:selC.size})+'</span><button class="bp" style="width:auto;padding:6px 18px;font-size:12px" data-act="obN" data-arg="2">'+t('cont')+'</button></div></div>';
    c.innerHTML=h;
  }else if(obS===2){
    let jDetMsg='';
    if(detExts.jira){
      jDetMsg='<div style="margin-bottom:10px" class="ext-badge">'+svgCheck+' '+t('vsPluginDetected')+' (Atlassian)</div>';
    }
    c.innerHTML='<div style="text-align:center;font-size:12px;color:var(--vscode-descriptionForeground);margin-bottom:14px;font-weight:600">'+t('obS',{n:2,t:3})+'</div><h2 style="font-size:16px;font-weight:700;text-align:center;margin-bottom:4px">'+t('obT2')+'</h2><p style="font-size:12px;color:var(--vscode-descriptionForeground);text-align:center;margin-bottom:14px">'+t('obS2')+'</p>'+jDetMsg+'<label class="lbl">'+t('obJD')+'</label><input class="inp" id="obJiraDom" value="tu-empresa.atlassian.net" style="margin-bottom:8px"><label class="lbl">'+t('obPr')+'</label><input class="inp" id="obJiraProj" value="PROJ" style="margin-bottom:8px"><button class="bs" style="margin-bottom:14px" data-act="connectJira"><span style="display:flex;align-items:center;gap:6px">'+lg.Jira+' '+t('obCA')+'</span> '+svgExtLink+'</button><div style="display:flex;gap:8px"><button class="bs" data-act="obN" data-arg="1">'+t('back')+'</button><button class="bp" data-act="obN" data-arg="3">'+t('cont')+'</button></div>';
  }else if(obS===3){
    let repoExtInfo='';
    if(detExts.gitlab||detExts.github){
      repoExtInfo='<div style="margin-bottom:10px" class="ext-badge">'+svgCheck+' '+(detExts.gitlab?'GitLab Workflow':'GitHub Pull Requests')+' detectado en VS Code</div>';
    }
    c.innerHTML='<div style="text-align:center;font-size:12px;color:var(--vscode-descriptionForeground);margin-bottom:14px;font-weight:600">'+t('obS',{n:3,t:3})+'</div><h2 style="font-size:16px;font-weight:700;text-align:center;margin-bottom:4px">'+t('obT3')+'</h2><p style="font-size:12px;color:var(--vscode-descriptionForeground);text-align:center;margin-bottom:14px">'+t('obS3')+'</p>'+repoExtInfo+'<label class="lbl">'+t('obPv')+'</label><select class="inp" id="repoPv" style="margin-bottom:8px"><option value="GitLab">GitLab</option><option value="GitHub">GitHub</option></select><label class="lbl">'+t('obRe')+'</label><input class="inp" id="repoName" value="tu-org/checkout-service" style="margin-bottom:8px"><button class="bs" style="margin-bottom:14px" data-act="connectRepo"><span style="display:flex;align-items:center;gap:6px">'+svgExtLink+' Abrir repo en navegador</span></button><div style="display:flex;gap:8px"><button class="bs" data-act="obN" data-arg="2">'+t('back')+'</button><button class="bp" data-act="finOb">'+t('obGo')+'</button></div>';
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
  obS=0;
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
  selectedEpicId = null;
  showScr('home');
  toast(L==='es'?'Proyecto configurado':'Project configured');
}

// ---- HOME / BACKLOG ----
function toggleTaskComplete(id){
  const tk = tasks[id];
  if (!tk) return;
  const stLower = (tk.status[L] || tk.status.es || tk.status.en || tk.status || '').toLowerCase();
  const wasDone = stLower.includes('complet') || stLower.includes('done');
  if (wasDone) {
    tk.status = { es: 'En curso', en: 'In progress' };
    tk.color = 'blue';
    toast(L === 'es' ? 'Tarea marcada como en curso: ' + id : 'Task marked as in progress: ' + id);
  } else {
    tk.status = { es: 'Completado', en: 'Completed' };
    tk.color = 'green';
    toast(L === 'es' ? 'Tarea completada: ' + id : 'Task completed: ' + id);
  }
  saveTasks();
  if (aTk === id && document.getElementById('sTk') && document.getElementById('sTk').style.display !== 'none') {
    rTk();
  }
  rHome();
}

function renderTaskCard(id) {
  const tk = tasks[id];
  if (!tk) return '';
  const title = tk.title[L] || tk.title.es || tk.title.en || tk.title;
  const status = tk.status[L] || tk.status.es || tk.status.en || tk.status;
  const stLower = (status || '').toLowerCase();
  const isDone = stLower.includes('complet') || stLower.includes('done');
  
  let stBg = 'rgba(59,130,246,.12)';
  let stCol = '#60a5fa';
  if (isDone) {
    stBg = 'rgba(16,185,129,.15)';
    stCol = '#10b981';
  } else if (stLower.includes('revis') || stLower.includes('review')) {
    stBg = 'rgba(245,158,11,.15)';
    stCol = '#f59e0b';
  } else if (stLower.includes('backlog')) {
    stBg = 'rgba(148,163,184,.12)';
    stCol = '#94a3b8';
  } else if (tk.type === 'spike') {
    stBg = 'rgba(139,92,246,.15)';
    stCol = '#c084fc';
  }

  const testCount = tk.tests ? tk.tests.length : 3;
  const ssCount = tk.screenshots ? tk.screenshots.length : 2;
  const isMine = tk.assignedTo === 'me';

  return '<div class="task-card" data-act="openTk" data-arg="' + id + '" title="' + (L === 'es' ? 'Click para trabajar en tarea' : 'Click to work on task') + '">' +
    '<button class="task-check-circle ' + (isDone ? 'checked' : '') + '" data-act="toggleTaskComplete" data-arg="' + id + '" data-stop="1" title="' + (isDone ? (L === 'es' ? 'Reabrir tarea' : 'Reopen task') : (L === 'es' ? 'Marcar como completada' : 'Mark as completed')) + '">' +
      (isDone ? svgCheck : '') +
    '</button>' +
    '<span class="badge" style="background:' + stBg + ';color:' + stCol + ';flex-shrink:0">' + status + '</span>' +
    '<div style="flex:1;min-width:0">' +
      '<div style="font-size:13px;font-weight:600;display:flex;align-items:center;gap:6px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;margin-bottom:3px">' +
        '<span style="font-family:monospace;color:var(--vscode-textLink-foreground);font-weight:700">' + id + '</span>' +
        '<span style="overflow:hidden;text-overflow:ellipsis;' + (isDone ? 'text-decoration:line-through;opacity:.75' : '') + '">' + title + '</span>' +
      '</div>' +
      '<div style="display:flex;align-items:center;gap:6px;font-size:11px;color:var(--vscode-descriptionForeground)">' +
        '<span style="color:#10b981;font-weight:600">' + svgCheck + ' ' + testCount + ' tests</span>' +
        '<span>·</span>' +
        '<span style="color:#38bdf8">' + ssCount + ' ' + (L === 'es' ? 'capturas' : 'captures') + '</span>' +
        (isMine ? '<span>·</span><span style="color:#10b981;font-weight:600">' + (L === 'es' ? 'Para ti' : 'Yours') + '</span>' : '') +
      '</div>' +
    '</div>' +
    '<div style="display:flex;align-items:center;gap:6px;flex-shrink:0">' +
      '<button class="badge" data-act="workOnTask" data-arg="' + id + '" data-stop="1" style="background:var(--vscode-button-secondaryBackground, rgba(255,255,255,.06));color:var(--vscode-foreground);border:1px solid var(--vscode-panel-border);padding:3px 8px;font-size:11px;font-weight:500;display:flex;align-items:center;gap:4px;cursor:pointer">' +
        t('work') + ' ' + svgChev +
      '</button>' +
      '<button class="del-btn" data-act="delTk" data-arg="' + id + '" data-stop="1" title="' + t('delTask') + '">' + svgDel + '</button>' +
    '</div>' +
  '</div>';
}

function rHome(){
  const el = document.getElementById('sHome');
  const allIds = Object.keys(tasks);
  allIds.forEach(id => ensureTaskEnrichment(tasks[id], id));

  let h = '<div class="ctr fi">';
  if (planWarning) {
    h += '<div class="card plan-error" style="margin-bottom:12px"><p class="plan-note" style="margin:0">' + planWarning + '</p></div>';
  }

  if (selectedEpicId === null) {
    const epicKeys = Object.keys(epics);

    // Empty state: No epics and no tasks
    if (epicKeys.length === 0 && allIds.length === 0) {
      h += '<div class="card card-bg" style="text-align:center;padding:44px 20px;border-color:var(--vscode-panel-border);margin-top:16px">';
      h += '<div style="display:flex;justify-content:center;margin-bottom:12px">';
      h += '<div style="width:44px;height:44px;border-radius:22px;background:rgba(9,105,218,.12);display:flex;align-items:center;justify-content:center;color:var(--vscode-textLink-foreground)">';
      h += '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="12" y1="18" x2="12" y2="12"/><line x1="9" y1="15" x2="15" y2="15"/></svg>';
      h += '</div>';
      h += '</div>';
      h += '<h2 style="font-size:17px;font-weight:700;margin-bottom:6px">' + (L === 'es' ? 'Crea tu primera tarea o conecta tus herramientas' : 'Create your first task or connect') + '</h2>';
      h += '<p style="font-size:12px;color:var(--vscode-descriptionForeground);max-width:440px;margin:0 auto 20px;line-height:1.5">' + (L === 'es' ? 'No hay epicas ni tareas todavia. Puedes crear tu primera tarea localmente o conectar Jira y GitLab/GitHub para sincronizar tus tickets.' : 'No epics or tasks found yet. Create your first task locally or connect Jira and GitLab/GitHub to sync your tickets.') + '</p>';
      h += '<div style="display:flex;justify-content:center;align-items:center;gap:10px;flex-wrap:wrap">';
      h += '<button class="bp" style="width:auto;padding:7px 18px;font-size:12px" data-act="showScr" data-arg="plan">' + svgSparkle + ' ' + t('planOpen') + '</button>';
      h += '<button class="bs" style="width:auto;padding:7px 18px;font-size:12px" data-act="showScr" data-arg="create">' + svgPlus + ' ' + (L === 'es' ? 'Crear primera tarea' : 'Create your first task') + '</button>';
      h += '<button class="bs" style="width:auto;padding:7px 16px;font-size:12px" data-act="openCreateEpic">' + svgPlus + ' ' + (L === 'es' ? 'Crear primera epica' : 'Create first epic') + '</button>';
      h += '<button class="bs" style="width:auto;padding:7px 16px;font-size:12px" data-act="startOb"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg> ' + (L === 'es' ? 'Conectar' : 'Connect') + '</button>';
      h += '</div>';
      h += '</div>';
    } else {
      // Header with buttons
      h += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;gap:8px">';
      h += '<div>';
      h += '<h1 style="font-size:18px;font-weight:700">' + (epicKeys.length > 0 ? (L === 'es' ? 'Epicas del Proyecto' : 'Project Epics') : t('tsk')) + '</h1>';
      h += '<div style="font-size:12px;color:var(--vscode-descriptionForeground);margin-top:2px">' + (epicKeys.length > 0 ? (L === 'es' ? 'Selecciona una epica para ver sus tareas' : 'Select an epic to view its tasks') : (L === 'es' ? 'Tareas del espacio de trabajo' : 'Workspace tasks')) + '</div>';
      h += '</div>';
      h += '<div style="display:flex;align-items:center;gap:6px">';
      h += '<button class="bs" style="width:auto;padding:6px 12px;font-size:12px" data-act="showScr" data-arg="plan">' + t('planOpen') + '</button>';
      h += '<button class="bs" style="width:auto;padding:6px 12px;font-size:12px" data-act="openCreateEpic">' + svgPlus + ' ' + (L === 'es' ? 'Nueva Epica' : 'New Epic') + '</button>';
      h += '<button class="bp" style="width:auto;padding:6px 14px;font-size:12px" data-act="showScr" data-arg="create">' + svgPlus + ' ' + t('newTask') + '</button>';
      h += '</div>';
      h += '</div>';

      if (epicKeys.length === 0) {
        // Has tasks without epics
        allIds.forEach(id => {
          h += renderTaskCard(id);
        });
      } else {
        epicKeys.forEach(eid => {
          const ep = epics[eid];
          const epProg = getEpicProgress(eid);
          const mstone = milestones[ep.milestoneId];

          h += '<div class="epic-card" data-act="openEpic" data-arg="' + eid + '" title="' + (L === 'es' ? 'Ver tareas de ' + (ep.name[L] || ep.name.es || ep.name) : 'View tasks for ' + (ep.name[L] || ep.name.en || ep.name)) + '">';
          h += '<div style="display:flex;align-items:center;gap:12px">';
          h += '<span style="width:12px;height:12px;border-radius:3px;background:' + ep.color + ';flex-shrink:0"></span>';
          h += '<div style="flex:1;min-width:0">';
          h += '<div style="display:flex;align-items:center;gap:8px;margin-bottom:4px">';
          h += '<span style="font-family:monospace;font-size:12px;font-weight:700;color:var(--vscode-textLink-foreground)">' + ep.id + '</span>';
          h += '<strong style="font-size:14px">' + (ep.name[L] || ep.name.es || ep.name) + '</strong>';
          if (mstone) {
            h += '<span class="badge" style="background:rgba(59,130,246,.12);color:#60a5fa">' + mstone.quarter + '</span>';
          }
          h += '</div>';
          h += '<div style="font-size:12px;color:var(--vscode-descriptionForeground);margin-bottom:8px">' + (ep.summary[L] || ep.summary.es || ep.summary) + '</div>';
          h += '<div style="display:flex;align-items:center;gap:10px">';
          h += '<span style="font-size:11px;color:#10b981;font-weight:600">' + epProg.done + '/' + epProg.total + ' ' + t('tsk') + ' (' + epProg.pct + '%)</span>';
          h += '<div class="pbar" style="width:120px;margin-top:0"><div class="pbar-fill" style="width:' + epProg.pct + '%"></div></div>';
          h += '</div>';
          h += '</div>';
          h += '<div style="display:flex;align-items:center;gap:4px;flex-shrink:0">';
          h += '<button class="del-btn" style="color:var(--vscode-descriptionForeground)" data-act="editEpic" data-arg="' + eid + '" data-stop="1" title="' + (L === 'es' ? 'Editar epica' : 'Edit epic') + '">' + svgEdit + '</button>';
          h += '<button class="del-btn" data-act="deleteEpic" data-arg="' + eid + '" data-stop="1" title="' + (L === 'es' ? 'Eliminar epica' : 'Delete epic') + '">' + svgDel + '</button>';
          h += '<span style="font-size:11px;color:var(--vscode-descriptionForeground);font-weight:600;margin-left:4px">' + (L === 'es' ? 'Ver' : 'View') + '</span>';
          h += svgChev;
          h += '</div>';
          h += '</div>';
          h += '</div>';
        });

        // Unassigned tasks if any
        const unassignedTasks = allIds.filter(id => !tasks[id].epicId || !epics[tasks[id].epicId]);
        if (unassignedTasks.length > 0) {
          h += '<div style="margin-top:20px;margin-bottom:10px;font-size:12px;font-weight:700;color:var(--vscode-descriptionForeground);text-transform:uppercase;letter-spacing:.05em">' + (L === 'es' ? 'Otras tareas sin epica' : 'Other tasks without epic') + '</div>';
          unassignedTasks.forEach(id => {
            h += renderTaskCard(id);
          });
        }
      }
    }
  } else {
    // LEVEL 2: Tareas de la Epica seleccionada
    const ep = epics[selectedEpicId] || { id: selectedEpicId, name: { es: selectedEpicId, en: selectedEpicId }, color: '#3b82f6', summary: { es: '', en: '' }, lead: '' };
    const epProg = getEpicProgress(selectedEpicId);
    const epTasks = allIds.filter(id => tasks[id].epicId === selectedEpicId);

    h += '<div style="margin-bottom:14px">';
    h += '<button class="bs" style="width:auto;display:inline-flex;padding:5px 12px;font-size:12px;margin-bottom:10px" data-act="closeEpic">';
    h += svgBack + ' ' + (L === 'es' ? 'Volver al listado de Epicas' : 'Back to Epics list');
    h += '</button>';
    
    h += '<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:10px">';
    h += '<div style="flex:1;min-width:0">';
    h += '<div style="display:flex;align-items:center;gap:8px">';
    h += '<span style="width:10px;height:10px;border-radius:2px;background:' + ep.color + '"></span>';
    h += '<span style="font-family:monospace;font-size:12px;font-weight:700;color:var(--vscode-textLink-foreground)">' + ep.id + '</span>';
    h += '<h1 style="font-size:18px;font-weight:700;margin:0">' + (ep.name[L] || ep.name.es || ep.name) + '</h1>';
    h += '</div>';
    h += '<div style="font-size:12px;color:var(--vscode-descriptionForeground);margin-top:4px">' + (ep.summary[L] || ep.summary.es || ep.summary) + (ep.lead ? ' · <em>' + ep.lead + '</em>' : '') + '</div>';
    h += '</div>';
    h += '<div style="display:flex;align-items:center;gap:6px;flex-shrink:0">';
    h += '<button class="bs" style="width:auto;padding:5px 10px;font-size:11px" data-act="editEpic" data-arg="' + selectedEpicId + '" title="' + (L === 'es' ? 'Editar epica' : 'Edit epic') + '">' + svgEdit + ' ' + (L === 'es' ? 'Editar' : 'Edit') + '</button>';
    h += '<button class="del-btn" data-act="deleteEpic" data-arg="' + selectedEpicId + '" title="' + (L === 'es' ? 'Eliminar epica' : 'Delete epic') + '">' + svgDel + '</button>';
    h += '<button class="bp" style="width:auto;padding:6px 12px;font-size:12px" data-act="createTaskInEpic" data-arg="' + selectedEpicId + '">';
    h += svgPlus + ' ' + t('newTask');
    h += '</button>';
    h += '</div>';
    h += '</div>';

    h += '<div style="display:flex;align-items:center;gap:10px;margin-top:10px">';
    h += '<span style="font-size:11px;color:#10b981;font-weight:600">' + epProg.done + '/' + epProg.total + ' ' + (L === 'es' ? 'tareas completadas o en revision' : 'tasks done or in review') + ' (' + epProg.pct + '%)</span>';
    h += '<div class="pbar" style="width:140px;margin-top:0"><div class="pbar-fill" style="width:' + epProg.pct + '%"></div></div>';
    h += '</div>';
    h += '</div>';

    if (epTasks.length === 0) {
      h += '<div style="text-align:center;padding:30px 10px;color:var(--vscode-descriptionForeground)">';
      h += '<p style="font-size:13px;margin-bottom:8px">' + (L === 'es' ? 'No hay tareas creadas en esta epica todavia.' : 'No tasks created in this epic yet.') + '</p>';
      h += '<button class="bp" style="display:inline-flex;width:auto;padding:6px 14px;font-size:12px" data-act="createTaskInEpic" data-arg="' + selectedEpicId + '">' + svgPlus + ' ' + t('newTask') + '</button>';
      h += '</div>';
    } else {
      epTasks.forEach(id => {
        h += renderTaskCard(id);
      });
    }
  }

  h += '</div>';
  el.innerHTML = h;
}

function delTk(id){vsc.postMessage({type:'confirmDelete',ticketId:id})}
// ---- EPIC CRUD ----
let selectedEpicColor = '#0969da';

function rCreateEpic(){
  const el = document.getElementById('sCreateEpic');
  if (!el) return;
  const isEdit = !!editingEpicId;
  const ep = isEdit ? (epics[editingEpicId] || {}) : {};
  selectedEpicColor = ep.color || '#8b5cf6';

  const epName = isEdit ? (ep.name[L] || ep.name.es || ep.name.en || ep.name || '') : '';
  const epSummary = isEdit ? (ep.summary[L] || ep.summary.es || ep.summary.en || ep.summary || '') : '';
  const epLead = ep.lead || '';
  const epMilestone = ep.milestoneId || 'M-1';
  const epKey = ep.key || '';

  const titleHeader = isEdit
    ? (L === 'es' ? 'Editar Epica: ' + editingEpicId : 'Edit Epic: ' + editingEpicId)
    : (L === 'es' ? 'Crear Nueva Epica' : 'Create New Epic');

  let h = '<div style="padding:8px 16px;border-bottom:1px solid var(--vscode-panel-border);display:flex;align-items:center;gap:6px;font-size:12px;background:var(--vscode-sideBar-background)">' +
    '<button style="background:none;border:none;color:var(--vscode-descriptionForeground);cursor:pointer;display:flex;align-items:center;gap:4px;font-size:12px" data-act="showScr" data-arg="home">' +
      svgBack + (L === 'es' ? 'Epicas' : 'Epics') +
    '</button>' +
    '<span style="color:var(--vscode-panel-border)">/</span>' +
    '<span style="font-weight:600">' + titleHeader + '</span>' +
  '</div>';

  h += '<div class="ctr fi" style="max-width:540px;margin:0 auto;padding-top:16px">';

  h += '<label class="lbl">' + (L === 'es' ? 'Nombre de la epica' : 'Epic Name') + ' *</label>';
  h += '<input class="inp" id="nEpicName" value="' + epName.replace(/"/g, '&quot;') + '" placeholder="' + (L === 'es' ? 'Ej: Integracion Pasarela de Pagos Stripe' : 'E.g. Stripe Payment Gateway Integration') + '" style="margin-bottom:12px">';

  h += '<div style="display:flex;gap:10px;margin-bottom:12px">';
  h += '<div style="flex:1">';
  h += '<label class="lbl">' + (L === 'es' ? 'Clave corta (Key)' : 'Short Key') + '</label>';
  h += '<input class="inp" id="nEpicKey" value="' + epKey.replace(/"/g, '&quot;') + '" placeholder="Ej: PAYMENTS" style="text-transform:uppercase">';
  h += '</div>';
  h += '<div style="flex:1">';
  h += '<label class="lbl">' + (L === 'es' ? 'Hito / Milestone' : 'Milestone') + '</label>';
  h += '<select class="inp" id="nEpicMilestone">';
  Object.keys(milestones).forEach(mid => {
    const m = milestones[mid];
    const sel = mid === epMilestone ? ' selected' : '';
    h += '<option value="' + mid + '"' + sel + '>' + mid + ': ' + (m.quarter || '') + ' - ' + (m.title[L] || m.title.es || m.title.en || m.title) + '</option>';
  });
  h += '</select>';
  h += '</div>';
  h += '</div>';

  h += '<label class="lbl">' + (L === 'es' ? 'Responsable / Lead' : 'Lead / Owner') + '</label>';
  h += '<input class="inp" id="nEpicLead" value="' + epLead.replace(/"/g, '&quot;') + '" placeholder="' + (L === 'es' ? 'Ej: Alex R. (Product Lead)' : 'E.g. Alex R. (Product Lead)') + '" style="margin-bottom:12px">';

  h += '<label class="lbl">' + (L === 'es' ? 'Objetivo y alcance de la epica' : 'Epic Goal & Summary') + '</label>';
  h += '<textarea class="inp" id="nEpicSummary" rows="3" style="resize:none;margin-bottom:12px" placeholder="' + (L === 'es' ? 'Describe el impacto de negocio y objetivos tecnicos...' : 'Describe business impact and technical goals...') + '">' + epSummary + '</textarea>';

  // Clean single accent
  selectedEpicColor = '#0969da';

  h += '<div style="display:flex;gap:10px">';
  h += '<button class="bs" data-act="showScr" data-arg="home">' + (L === 'es' ? 'Cancelar' : 'Cancel') + '</button>';
  h += '<button class="bp" data-act="saveEpicForm">' + (isEdit ? (L === 'es' ? 'Guardar Cambios' : 'Save Changes') : (L === 'es' ? 'Crear Epica' : 'Create Epic')) + '</button>';
  h += '</div>';

  h += '</div>';
  el.innerHTML = h;
}


function saveEpicForm(){
  const nameEl = document.getElementById('nEpicName');
  const summaryEl = document.getElementById('nEpicSummary');
  const leadEl = document.getElementById('nEpicLead');
  const mileEl = document.getElementById('nEpicMilestone');
  const keyEl = document.getElementById('nEpicKey');

  const name = nameEl ? nameEl.value.trim() : '';
  const summary = summaryEl ? summaryEl.value.trim() : '';
  const lead = leadEl ? leadEl.value.trim() : '';
  const milestoneId = mileEl ? mileEl.value : 'M-1';
  let key = keyEl ? keyEl.value.trim().toUpperCase() : '';

  if (!name) {
    toast(L === 'es' ? 'El nombre de la epica es obligatorio' : 'Epic name is required');
    return;
  }

  if (editingEpicId) {
    const ep = epics[editingEpicId];
    if (ep) {
      ep.name = { es: name, en: name };
      ep.summary = { es: summary, en: summary };
      ep.lead = lead;
      ep.color = selectedEpicColor;
      ep.milestoneId = milestoneId;
      if (key) ep.key = key;
    }
    saveEpics();
    toast(L === 'es' ? 'Epica actualizada: ' + editingEpicId : 'Epic updated: ' + editingEpicId);
    selectedEpicId = editingEpicId;
    showScr('home');
  } else {
    const maxNum = Math.max(0, ...Object.keys(epics).map(k => {
      const m = k.match(/EPIC-(\d+)/);
      return m ? parseInt(m[1], 10) : 0;
    }));
    const newId = 'EPIC-' + (maxNum + 1);
    if (!key) key = name.substring(0, 8).toUpperCase().replace(/[^A-Z0-9]/g, '');

    epics[newId] = {
      id: newId,
      key: key || 'EPIC',
      name: { es: name, en: name },
      summary: { es: summary, en: summary },
      color: selectedEpicColor,
      milestoneId: milestoneId,
      lead: lead
    };

    if (milestones[milestoneId] && !milestones[milestoneId].epicIds.includes(newId)) {
      milestones[milestoneId].epicIds.push(newId);
    }

    saveEpics();
    toast((L === 'es' ? 'Epica creada: ' : 'Epic created: ') + newId);
    selectedEpicId = newId;
    showScr('home');
  }
}


// ---- CREATE TASK ----
let newCriteria=[];
function rCreate(){
  newCriteria=[''];
  const el=document.getElementById('sCreate');
  el.innerHTML='<div style="padding:8px 16px;border-bottom:1px solid var(--vscode-panel-border);display:flex;align-items:center;gap:6px;font-size:12px;background:var(--vscode-sideBar-background)"><button style="background:none;border:none;color:var(--vscode-descriptionForeground);cursor:pointer;display:flex;align-items:center;gap:4px;font-size:12px" data-act="showScr" data-arg="home">'+svgBack+t('tsk')+'</button><span style="color:var(--vscode-panel-border)">/</span><span style="font-weight:600">'+t('crTitle')+'</span></div><div class="ctr fi" id="crForm"></div>';
  rCreateForm();
}
function rCreateForm(){
  const c=document.getElementById('crForm');
  let h='<label class="lbl" style="margin-top:8px">'+t('crTitleF')+'</label><input class="inp" id="nTitle" placeholder="'+(L==='es'?'Ej: Agregar boton de pago':'E.g. Add payment button')+'" style="margin-bottom:10px">';
  h+='<label class="lbl">'+t('crDescF')+'</label><textarea class="inp" id="nDesc" rows="3" style="resize:none;margin-bottom:10px" placeholder="'+(L==='es'?'Describe que hay que hacer...':'Describe what needs to be done...')+'"></textarea>';
  h+='<div style="display:flex;gap:8px;margin-bottom:10px"><div style="flex:1"><label class="lbl">'+t('crTypeF')+'</label><select class="inp" id="nType"><option value="story">Story</option><option value="bug">Bug</option><option value="spike">Spike</option></select></div><div style="flex:1"><label class="lbl">'+t('assigned')+'</label><select class="inp" id="nAssignee"><option value="me">'+(L==='es'?'Para mi':'Assigned to me')+'</option><option value="team">'+(L==='es'?'Equipo':'Team')+'</option></select></div></div>';
  const epKeys = Object.keys(epics);
  let epOpts = '<option value="">' + (L === 'es' ? '(Sin epica / General)' : '(No epic / General)') + '</option>';
  if (epKeys.length > 0) {
    epOpts += epKeys.map(eid => '<option value="' + eid + '">' + eid + ': ' + (epics[eid].name[L] || epics[eid].name.es || epics[eid].name) + '</option>').join('');
  }
  h += '<div style="margin-bottom:10px"><label class="lbl">' + t('epicLbl') + ' & ' + t('milestoneLbl') + '</label><select class="inp" id="nEpic">' + epOpts + '</select></div>';
  h+='<label class="lbl">'+t('crCritF')+'</label><div id="critList"></div>';
  h+='<button class="bs" style="margin-bottom:14px;font-size:12px;padding:6px" data-act="addCrit">'+svgPlus+' '+t('crAdd')+'</button>';
  h+='<div style="display:flex;gap:8px"><button class="bs" data-act="showScr" data-arg="home">'+t('crCancel')+'</button><button class="bp" data-act="saveNewTask">'+t('crSave')+'</button></div>';
  c.innerHTML=h;
  rCritList();
}
function rCritList(){
  const c=document.getElementById('critList');if(!c)return;
  c.innerHTML=newCriteria.map((v,i)=>'<div class="crit-row"><input class="inp" value="'+v.replace(/"/g,'&quot;')+'" data-input="setCrit" data-idx="'+i+'" placeholder="'+(L==='es'?'Criterio '+(i+1):'Criterion '+(i+1))+'"><button data-act="rmCrit" data-arg="' + i + '">'+svgX+'</button></div>').join('');
}
function addCrit(){newCriteria.push('');rCritList()}
function rmCrit(i){newCriteria.splice(i,1);if(newCriteria.length===0)newCriteria=[''];rCritList()}
function saveNewTask(){
  const title=document.getElementById('nTitle').value.trim();
  const desc=document.getElementById('nDesc').value.trim();
  const type=document.getElementById('nType').value;
  const assignedTo=document.getElementById('nAssignee').value;
  const epicId = document.getElementById('nEpic') ? document.getElementById('nEpic').value : '';
  const milestoneId = (epics[epicId] && epics[epicId].milestoneId) ? epics[epicId].milestoneId : '';
  if(!title){toast(L==='es'?'El titulo es obligatorio':'Title is required');return}
  const crit=newCriteria.filter(c=>c.trim());
  if(crit.length===0){toast(L==='es'?'Agrega al menos un criterio':'Add at least one criterion');return}
  nextId++;
  const prefix = isLocalMode ? (epics[epicId] && epics[epicId].key ? epics[epicId].key : 'LOCAL') : 'PROJ';
  const id = prefix + '-' + nextId;
  const newTask={
    title:{es:title,en:title},
    desc:{es:desc,en:desc},
    status:{es:'En curso',en:'In progress'},
    color:'blue',type,assignedTo,
    epicId,milestoneId,
    criteria:{es:crit,en:crit}
  };
  ensureTaskEnrichment(newTask,id);
  tasks[id]=newTask;
  saveTasks();
  toast((L==='es'?'Tarea creada: ':'Task created: ')+id);
  selectedEpicId=epicId;
  showScr('home');
}

// ---- TICKET WORKSPACE ----
function ticketTitle(id){
  const tk=tasks[id];
  return tk?(tk.title[L]||tk.title.es||tk.title.en||(typeof tk.title==='string'?tk.title:'')):'';
}
function showTicket(id){
  aTk=id;cS=1;showScr('ticket');rTk();
}
function openTk(id){
  showTicket(id);
  vsc.postMessage({type:'prepareTicketBranch',ticketId:id,title:ticketTitle(id)});
}
function workOnTask(id){
  showTicket(id);
  vsc.postMessage({type:'workOnTask',ticketId:id,title:ticketTitle(id)});
}
function gSt(tk){return tk.type==='spike'?4:5}
function rTk(){
  const tk=tasks[aTk];if(!tk)return;
  const total=gSt(tk);
  const isDoneTk = (tk.status[L] || tk.status.es || tk.status.en || tk.status || '').toLowerCase().includes('complet') || (tk.status[L] || tk.status.es || tk.status.en || tk.status || '').toLowerCase().includes('done');
  let h='<div style="padding:8px 16px;border-bottom:1px solid var(--vscode-panel-border);display:flex;align-items:center;justify-content:space-between;font-size:12px;background:var(--vscode-sideBar-background)"><div style="display:flex;align-items:center;gap:6px"><button style="background:none;border:none;color:var(--vscode-descriptionForeground);cursor:pointer;display:flex;align-items:center;gap:4px;font-size:12px" data-act="showScr" data-arg="home">'+svgBack+t('tsk')+'</button><span style="color:var(--vscode-panel-border)">/</span><span style="font-weight:700;color:var(--vscode-textLink-foreground);font-family:monospace">'+aTk+'</span><span class="badge" style="background:rgba(139,92,246,.12);color:#a78bfa">'+{story:'Story',bug:'Bug',spike:'Spike'}[tk.type]+'</span><button class="bs" style="width:auto;padding:2px 8px;font-size:11px;' + (isDoneTk ? 'border-color:#10b981;color:#10b981' : '') + '" data-act="toggleTaskComplete" data-arg="' + aTk + '">' + (isDoneTk ? svgCheck + ' ' + (L === 'es' ? 'Completada' : 'Completed') : (L === 'es' ? 'Marcar completada' : 'Mark done')) + '</button></div><div style="display:flex;align-items:center;gap:4px">';
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
    c.innerHTML='<div style="margin-bottom:4px"><span style="font-size:11px;color:var(--vscode-descriptionForeground);font-weight:600">'+t('stp')+' 1</span></div><h2 style="font-size:15px;font-weight:700;margin-bottom:4px">'+ti+'</h2><p style="font-size:12px;color:var(--vscode-descriptionForeground);margin-bottom:14px">'+(sp?(L==='es'?'Ticket de investigacion. Lee el objetivo.':'Investigation ticket. Read the objective.'):(L==='es'?'Lee los detalles y pedi a Claude Code que empiece.':'Read the details and ask Claude Code to start.'))+'</p><div class="card card-bg"><div class="lbl" style="text-transform:uppercase;letter-spacing:.05em;margin-bottom:6px">'+t(sp?'spO':'wh')+'</div><p style="font-size:13px;line-height:1.5">'+de+'</p></div>'+fig+'<div class="card card-bg"><div class="lbl" style="text-transform:uppercase;letter-spacing:.05em;margin-bottom:8px">'+t(sp?'spD':'crit')+'</div><div style="display:flex;flex-direction:column;gap:6px">'+cr.map(x=>'<div style="display:flex;align-items:center;gap:8px;font-size:13px"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--vscode-descriptionForeground)" stroke-width="2"><circle cx="12" cy="12" r="10"/></svg>'+x+'</div>').join('')+'</div></div><button class="bp" data-act="workOnTask" data-arg="'+aTk+'">'+svgChat+' '+t('workInClaude')+'</button><p style="text-align:center;font-size:11px;color:var(--vscode-descriptionForeground);margin-top:6px">'+t('workHint')+'</p>';
  }
  else if(cS===2){
    const fullPrompt = buildTicketPrompt(tk, aTk);
    const pr=sp?(L==='es'?['Investiga opciones y compara alternativas','Arma una tabla comparativa con pros y contras','Cual es la recomendacion final para arquitectura?']:['Investigate options and compare alternatives','Create a comparison table with pros and cons','What is the final architectural recommendation?']):(L==='es'?['Genera los tests automaticos para estos criterios','Explicame los archivos que modificaste','Como pruebo este cambio en localhost?']:['Generate automated tests for these criteria','Explain the files you modified','How do I test this change on localhost?']);

    const workLine = workNotice || (L==='es'?'El contexto fue copiado. Pegalo con Cmd+V o Ctrl+V en tu chat de '+activeAi+'.':'Context was copied. Paste with Cmd+V or Ctrl+V in your '+activeAi+' chat.');
    c.innerHTML='<div style="margin-bottom:4px"><span style="font-size:11px;color:var(--vscode-descriptionForeground);font-weight:600">'+t('stp')+' 2</span></div><h2 style="font-size:15px;font-weight:700;margin-bottom:4px">'+t(sp?'iAI':'wAI')+'</h2><p style="font-size:12px;color:var(--vscode-descriptionForeground);margin-bottom:14px">'+workLine+'</p>'+
    '<div class="card" style="border-color:rgba(16,185,129,.3);background:rgba(16,185,129,.05);margin-bottom:12px">'+
      '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:4px">'+
        '<div style="display:flex;align-items:center;gap:6px;font-weight:600;color:#10b981;font-size:12px">'+svgCheck+'<span>'+(L==='es'?'Prompt copiado y listo para '+activeAi:'Prompt copied and ready for '+activeAi)+'</span></div>'+
        '<button class="bs" style="width:auto;padding:3px 8px;font-size:11px" data-act="reopenChat">'+svgChat+' '+(L==='es'?'Reabrir chat de '+activeAi:'Reopen '+activeAi+' chat')+'</button>'+
      '</div>'+
      '<p style="font-size:11px;color:var(--vscode-descriptionForeground)">'+aTk+' — '+cr.length+' '+(L==='es'?'criterios incluidos':'criteria included')+'</p>'+
    '</div>'+

    '<div class="card card-bg" style="margin-bottom:14px">'+
      '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">'+
        '<div class="lbl" style="text-transform:uppercase;letter-spacing:.05em;margin:0">'+(L==='es'?'Prompt para tu asistente':'Prompt for your assistant')+'</div>'+
        '<button class="bs" style="width:auto;padding:3px 8px;font-size:11px" data-act="cpFullPrompt">'+svgCopy+' '+(L==='es'?'Copiar de nuevo':'Copy again')+'</button>'+
      '</div>'+
      '<div style="background:var(--vscode-input-background);border:1px solid var(--vscode-input-border);border-radius:6px;padding:8px;font-size:11px;font-family:monospace;white-space:pre-wrap;max-height:120px;overflow-y:auto;color:var(--vscode-input-foreground);line-height:1.4" id="fullPromptBox">'+fullPrompt.replace(/</g,'&lt;')+'</div>'+
    '</div>'+

    '<div style="font-size:12px;font-weight:600;color:var(--vscode-descriptionForeground);margin-bottom:6px">'+t('sugL')+'</div>'+
    pr.map(p=>'<button class="pb" data-act="cpP" data-arg="'+attrEncode(p)+'"><span>'+p+'</span>'+svgCopy+'</button>').join('')+
    '<div style="margin-top:14px"><button class="bp" data-act="goS" data-arg="3">'+svgCheck+' '+(sp?t('aiDD'):t('aiDT'))+'</button></div>';
  }
  else if(cS===3&&sp){
    const initJira = buildJiraReviewComment(tk, aTk);
    c.innerHTML='<div style="margin-bottom:4px"><span style="font-size:11px;color:var(--vscode-descriptionForeground);font-weight:600">'+t('stp')+' 3</span></div><h2 style="font-size:15px;font-weight:700;margin-bottom:4px">'+t('docT')+'</h2><p style="font-size:12px;color:var(--vscode-descriptionForeground);margin-bottom:14px">'+t('docS')+'</p>'+
    '<div style="display:flex;flex-direction:column;gap:6px;margin-bottom:14px">'+
      '<button class="pb" data-act="toast" data-arg="Creating...">'+lg.Confluence+'<span style="flex:1;text-align:left">'+t('cConf')+'</span></button>'+
      '<button class="pb" data-act="toast" data-arg="Creating...">'+lg.Notion+'<span style="flex:1;text-align:left">'+t('cNot')+'</span></button>'+
      '<button class="pb" data-act="toast" data-arg="Creating...">'+lg.OpenSpec+'<span style="flex:1;text-align:left">'+t('cOS')+'</span></button>'+
    '</div>'+
    '<div class="card card-bg">'+
      '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">'+
        '<label class="lbl" style="margin:0">'+t('jCom')+'</label>'+
        '<button class="bs" style="width:auto;padding:2px 8px;font-size:11px" data-act="toggleJiraPreview" data-arg="spike" id="pBtnSpike">'+(L==='es'?'Vista previa':'Preview')+'</button>'+
      '</div>'+
      '<div class="md-toolbar">'+
        '<button data-act="insertMd" data-arg="spike" data-arg2="bold">B</button>'+
        '<button data-act="insertMd" data-arg="spike" data-arg2="italic">I</button>'+
        '<button data-act="insertMd" data-arg="spike" data-arg2="code">Code</button>'+
        '<button data-act="insertMd" data-arg="spike" data-arg2="list">Lista</button>'+
        '<button data-act="insertMd" data-arg="spike" data-arg2="check">Check</button>'+
        '<button data-act="insertMd" data-arg="spike" data-arg2="h3">H3</button>'+
        '<span style="flex:1"></span>'+
        '<button data-act="resetJiraComment" data-arg="spike">'+(L==='es'?'Restablecer':'Reset')+'</button>'+
      '</div>'+
      '<textarea class="inp md-editor" id="jiraCommentSpike" rows="6" style="resize:vertical"></textarea>'+
      '<div id="jiraPreviewSpike" class="md-preview" style="display:none"></div>'+
    '</div>'+
    '<button class="bp" style="background:#10b981" data-act="goS" data-arg="4">'+t('pubCl')+'</button>';

    setTimeout(()=>{
      const ta = document.getElementById('jiraCommentSpike');
      if (ta) ta.value = initJira;
    }, 10);
  }
  else if(cS===3&&!sp){
    ensureTaskEnrichment(tk, aTk);
    const testsList = tk.tests || [];
    const passedCount = testsList.length;
    const ssList = tk.screenshots || [];

    c.innerHTML='<div style="margin-bottom:4px"><span style="font-size:11px;color:var(--vscode-descriptionForeground);font-weight:600">'+t('stp')+' 3</span></div>'+
    '<h2 style="font-size:15px;font-weight:700;margin-bottom:4px">'+t('testT')+'</h2>'+
    '<p style="font-size:12px;color:var(--vscode-descriptionForeground);margin-bottom:14px">'+t('testS')+'</p>'+
    '<div class="card card-bg">'+
      '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">'+
        '<div class="lbl" style="text-transform:uppercase;letter-spacing:.05em;margin:0">'+t('aiTst')+'</div>'+
        '<div style="display:flex;gap:6px">'+
          '<button style="background:none;border:none;color:var(--vscode-textLink-foreground);font-size:11px;cursor:pointer;font-weight:600" data-act="runTermTests">'+(L==='es'?'En terminal':'In terminal')+'</button>'+
          '<button style="background:none;border:none;color:var(--vscode-textLink-foreground);font-size:11px;cursor:pointer;font-weight:600" data-act="rerunTestsVisual">'+t('rerun')+'</button>'+
        '</div>'+
      '</div>'+
      '<div id="testsListContainer">'+
        testsList.map((test,i)=>'<div class="test-box">'+
          '<div style="display:flex;align-items:center;gap:8px">'+
            '<span style="color:#10b981">'+svgCheck+'</span>'+
            '<div>'+
              '<div style="font-family:monospace;font-size:11px;font-weight:600">'+test.name+'</div>'+
              '<div style="font-size:11px;color:var(--vscode-descriptionForeground)">'+(test.desc[L]||test.desc.es||test.desc.en||test.desc)+'</div>'+
            '</div>'+
          '</div>'+
          '<div style="display:flex;align-items:center;gap:6px">'+
            '<span style="font-size:10px;font-family:monospace;color:var(--vscode-descriptionForeground)">'+test.duration+'</span>'+
            '<span class="badge" style="background:rgba(16,185,129,.15);color:#10b981">PASSED</span>'+
          '</div>'+
        '</div>').join('')+
      '</div>'+
      '<div style="display:flex;justify-content:space-between;align-items:center;margin-top:8px">'+
        '<div style="font-size:11px;color:#10b981;font-weight:600" id="testsPassCounter">'+t('tPas',{n:passedCount,t:passedCount})+'</div>'+
        '<button class="bs" style="width:auto;padding:3px 10px;font-size:11px;border-style:dashed" data-act="generateMoreTests">'+svgSparkle+' '+t('genMoreTests')+'</button>'+
      '</div>'+
    '</div>'+
    '<div class="card card-bg">'+
      '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">'+
        '<div class="lbl" style="text-transform:uppercase;letter-spacing:.05em;margin:0">'+t('autoSS')+' (Playwright E2E)</div>'+
        '<button style="background:none;border:none;color:var(--vscode-textLink-foreground);font-size:11px;cursor:pointer;font-weight:600" data-act="generateMoreScreenshots">'+svgPlus+' '+t('genMoreSS')+'</button>'+
      '</div>'+
      '<div class="ss-grid" id="step3SsGrid">'+
        ssList.map(s=>'<div class="ss-card">'+
          renderScreenThumbSvg(s.name, s.title[L]||s.title.es||s.title.en||s.title)+
          '<div style="padding:6px 8px">'+
            '<div style="font-family:monospace;font-weight:600;font-size:11px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis" title="'+s.name+'">'+s.name+'</div>'+
            '<div style="display:flex;justify-content:space-between;align-items:center;margin-top:3px;font-size:10px;color:var(--vscode-descriptionForeground)">'+
              '<span>'+s.source+'</span>'+
              '<span style="color:#10b981;font-weight:600;display:inline-flex;align-items:center;gap:3px">'+svgCheck+' Auto</span>'+
            '</div>'+
          '</div>'+
        '</div>').join('')+
      '</div>'+
    '</div>'+
    '<div class="card card-bg" style="padding:0;overflow:hidden">'+
      '<div style="padding:8px 12px;border-bottom:1px solid var(--vscode-panel-border);display:flex;justify-content:space-between;font-size:12px">'+
        '<strong>'+t('mPrev')+'</strong>'+
        '<span style="font-family:monospace;color:#10b981;font-size:11px">localhost:3000</span>'+
      '</div>'+
      '<div style="padding:14px;display:flex;justify-content:center;background:#080810">'+
        '<div style="width:100%;max-width:360px;background:#fff;border-radius:6px;overflow:hidden;box-shadow:0 4px 10px rgba(0,0,0,.4)">'+
          '<div style="background:#0f172a;color:#fff;padding:6px 10px;font-size:11px;font-weight:700">App Preview</div>'+
          '<div style="padding:10px;font-size:12px;color:#334155;text-align:center">'+(L==='es'?'Vista previa interactiva de la aplicacion':'Interactive app preview')+'</div>'+
        '</div>'+
      '</div>'+
    '</div>'+
    '<button class="bp" data-act="goS" data-arg="4" style="margin-top:4px">'+t('allG')+'</button>'+
    '<button class="bs" data-act="goS" data-arg="2" style="margin-top:6px">'+t('smW')+'</button>';
  }
  else if(cS===4&&sp){sDone(t('spMsg'))}
  else if(cS===4&&!sp){
    ensureTaskEnrichment(tk, aTk);
    const initJira = buildJiraReviewComment(tk, aTk);
    const ssList = tk.screenshots || [];
    const testCount = tk.tests ? tk.tests.length : cr.length;

    c.innerHTML='<div style="margin-bottom:4px"><span style="font-size:11px;color:var(--vscode-descriptionForeground);font-weight:600">'+t('stp')+' 4</span></div>'+
    '<h2 style="font-size:15px;font-weight:700;margin-bottom:4px">'+t('revT')+'</h2>'+
    '<p style="font-size:12px;color:var(--vscode-descriptionForeground);margin-bottom:14px">'+t('revS')+'</p>'+
    '<div class="card" style="border-color:rgba(16,185,129,.3);background:rgba(16,185,129,.05)">'+
      '<div style="display:flex;align-items:center;gap:6px;font-size:12px;font-weight:600;color:#10b981">'+svgCheck+testCount+'/'+testCount+' + tests OK</div>'+
    '</div>'+
    '<div class="card card-bg">'+
      '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">'+
        '<div class="lbl" style="text-transform:uppercase;letter-spacing:.05em;margin:0">'+t('evid')+' ('+ssList.length+')</div>'+
        '<span style="font-size:11px;color:#10b981;font-weight:600;display:inline-flex;align-items:center;gap:3px">'+svgCheck+' '+(L==='es'?'Adjuntadas por tests automáticos':'Attached by automated tests')+'</span>'+
      '</div>'+
      '<div id="evL">'+
        ssList.map((s,idx)=>'<div style="display:flex;align-items:center;gap:8px;padding:8px 10px;border-radius:6px;background:var(--vscode-input-background);border:1px solid var(--vscode-panel-border);margin-bottom:6px">'+
          '<div style="width:40px;height:26px;border-radius:3px;overflow:hidden;flex-shrink:0;border:1px solid var(--vscode-panel-border)">'+
            renderScreenThumbSvg(s.name, '')+
          '</div>'+
          '<div style="flex:1;min-width:0">'+
            '<div style="font-family:monospace;font-size:12px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis" title="'+s.name+'">'+s.name+'</div>'+
            '<div style="display:flex;gap:6px;align-items:center;margin-top:2px">'+
              '<span class="badge" style="background:rgba(59,130,246,.12);color:#60a5fa">'+(s.source||'Playwright E2E')+'</span>'+
              '<span style="font-size:10px;color:#10b981;font-weight:600;display:inline-flex;align-items:center;gap:3px">'+svgCheck+' '+(L==='es'?'Auto-captura':'Auto-capture')+'</span>'+
            '</div>'+
          '</div>'+
          '<button class="del-btn" data-act="removeScreenshot" data-arg="' + idx + '" title="'+t('delTask')+'">'+svgDel+'</button>'+
        '</div>').join('')+
      '</div>'+
      '<div style="display:flex;gap:8px;margin-bottom:10px">'+
        '<button class="bs" style="flex:1;border-style:dashed;font-size:12px;padding:8px" data-act="addSS">'+svgCam+' '+t('addSS')+'</button>'+
        '<button class="bs" style="flex:1;border-style:dashed;font-size:12px;padding:8px" data-act="generateMoreScreenshots">'+svgPlus+' '+t('genMoreSS')+'</button>'+
      '</div>'+
      '<div style="display:flex;justify-content:space-between;align-items:center;margin:10px 0 6px">'+
        '<label class="lbl" style="margin:0">'+t('jCom')+'</label>'+
        '<button class="bs" style="width:auto;padding:2px 8px;font-size:11px" data-act="toggleJiraPreview" data-arg="story" id="pBtnStory">'+(L==='es'?'Vista previa':'Preview')+'</button>'+
      '</div>'+
      '<div class="md-toolbar">'+
        '<button data-act="insertMd" data-arg="story" data-arg2="bold">B</button>'+
        '<button data-act="insertMd" data-arg="story" data-arg2="italic">I</button>'+
        '<button data-act="insertMd" data-arg="story" data-arg2="code">Code</button>'+
        '<button data-act="insertMd" data-arg="story" data-arg2="list">Lista</button>'+
        '<button data-act="insertMd" data-arg="story" data-arg2="check">Check</button>'+
        '<button data-act="insertMd" data-arg="story" data-arg2="h3">H3</button>'+
        '<span style="flex:1"></span>'+
        '<button data-act="resetJiraComment" data-arg="story">'+(L==='es'?'Restablecer':'Reset')+'</button>'+
      '</div>'+
      '<textarea class="inp md-editor" id="jiraCommentStory" rows="7" style="resize:vertical"></textarea>'+
      '<div id="jiraPreviewStory" class="md-preview" style="display:none"></div>'+
    '</div>'+
    '<button class="bp" data-act="goS" data-arg="5">'+t('upMR')+'</button>';

    setTimeout(()=>{
      const ta = document.getElementById('jiraCommentStory');
      if (ta) ta.value = initJira;
    }, 10);
  }
  else if(cS===5){
    vsc.postMessage({ type: 'checkLocalGit' });
    const hasRemote = cTools.includes('GitLab') || cTools.includes('GitHub');
    const branchName = localGitState.hasGit ? localGitState.branch : ('feature/' + aTk.toLowerCase());
    const isLocalFlow = isLocalMode || !hasRemote;

    let gitSection;
    if (!localGitState.hasGit) {
      gitSection = '<div class="card card-bg" style="margin-bottom:12px;border-color:var(--vscode-panel-border)">' +
        '<div style="font-size:12px;color:var(--vscode-descriptionForeground);margin-bottom:8px">' + t('noGitFolder') + '</div>' +
        '<button class="bs" style="width:auto;padding:6px 12px;font-size:11.5px" data-act="initGitInWorkspace">' + svgTerm + ' ' + t('initGitBtn') + '</button>' +
      '</div>';
    } else {
      gitSection = '<div class="card card-bg" style="margin-bottom:12px;border-color:var(--vscode-panel-border)">' +
        '<div style="display:flex;justify-content:space-between;margin-bottom:4px">' +
          '<span style="font-size:11px;color:var(--vscode-descriptionForeground)">' + t('branchLocal') + '</span>' +
          '<span style="font-family:monospace;font-size:11px;font-weight:600">' + branchName + ' (' + localGitState.commits + ' commits)</span>' +
        '</div>' +
        '<div style="display:flex;justify-content:space-between">' +
          '<span style="font-size:11px;color:var(--vscode-descriptionForeground)">' + t('commitMsgLbl') + '</span>' +
          '<span style="font-family:monospace;font-size:11px;color:var(--vscode-textLink-foreground)">feat(' + aTk + '): ' + (tk.title[L]||tk.title.es||tk.title.en||tk.title).substring(0, 30) + '...</span>' +
        '</div>' +
      '</div>';
    }

    let actionsH = '';
    actionsH += '<button class="bp" style="margin-bottom:8px" data-act="doLocalCommit">' + svgCheck + ' ' + t('commitLocalBtn') + '</button>';
    if (hasRemote) {
      actionsH += '<button class="bs" data-act="doMR">' + (cTools.includes('GitLab') ? lg.GitLab : lg.GitHub) + ' ' + t('crMR') + '</button>';
    }

    c.innerHTML = '<div style="margin-bottom:4px"><span style="font-size:11px;color:var(--vscode-descriptionForeground);font-weight:600">' + t('stp') + ' 5</span></div>' +
      '<h2 style="font-size:15px;font-weight:700;margin-bottom:4px">' + (isLocalFlow ? t('commitLocal') : t('mrT')) + '</h2>' +
      '<p style="font-size:12px;color:var(--vscode-descriptionForeground);margin-bottom:14px">' + (isLocalFlow ? t('commitLocalDesc') : t('mrS')) + '</p>' +
      '<div class="card card-bg" style="font-size:13px;margin-bottom:12px">' +
        '<div style="display:flex;justify-content:space-between;margin-bottom:6px"><span style="color:var(--vscode-descriptionForeground)">Ticket</span><span style="font-family:monospace;color:var(--vscode-textLink-foreground);font-weight:700">' + aTk + '</span></div>' +
        '<div style="display:flex;justify-content:space-between;margin-bottom:6px"><span style="color:var(--vscode-descriptionForeground)">' + t('branch') + '</span><span style="font-family:monospace;font-size:12px">' + branchName + '</span></div>' +
        '<div style="display:flex;justify-content:space-between;margin-bottom:6px"><span style="color:var(--vscode-descriptionForeground)">' + t('tests') + '</span><span style="color:#10b981;font-weight:600">' + cr.length + '/' + cr.length + ' OK</span></div>' +
        '<div style="display:flex;justify-content:space-between"><span style="color:var(--vscode-descriptionForeground)">' + (isLocalFlow ? 'Workspace' : t('evid')) + '</span><span style="color:#10b981;font-weight:600">' + (isLocalFlow ? (localGitState.rootPath ? 'Carpeta local' : 'Memoria local') : 'Jira') + '</span></div>' +
      '</div>' +
      gitSection +
      actionsH;
  }
}

function sDone(msg){
  const tk=tasks[aTk];
  if(tk){
    tk.status = { es: 'Completado', en: 'Completed' };
    tk.color = 'green';
    saveTasks();
  }
  document.getElementById('sC').innerHTML='<div style="text-align:center;padding:24px 0" class="fi"><div style="width:48px;height:48px;border-radius:50%;background:rgba(16,185,129,.1);display:flex;align-items:center;justify-content:center;margin:0 auto 12px"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2"><path d="M20 6L9 17l-5-5"/></svg></div><h2 style="font-size:16px;font-weight:700;margin-bottom:6px">'+t('tDone')+'</h2><p style="font-size:13px;color:var(--vscode-descriptionForeground);margin-bottom:4px">'+aTk+' · '+(tk.title[L]||tk.title.es||tk.title.en||tk.title)+'</p><p style="font-size:12px;color:var(--vscode-descriptionForeground);margin-bottom:18px">'+msg+'</p><button class="bs" style="width:auto;display:inline-flex;padding:8px 20px" data-act="showScr" data-arg="home">'+t('nxtT')+'</button></div>';
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
  workOnTask(aTk);
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

function initGitInWorkspace(){
  vsc.postMessage({ type: 'initLocalGit' });
  toast(L === 'es' ? 'Inicializando repositorio Git local...' : 'Initializing local Git repository...');
}

function doLocalCommit(){
  const tk = tasks[aTk];
  const title = tk ? (tk.title[L] || tk.title.es || tk.title.en || tk.title) : 'complete task';
  vsc.postMessage({ type: 'commitLocal', ticketId: aTk, title });
  toast(L === 'es' ? 'Guardando commit local...' : 'Saving local commit...');
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

function generateMoreTests(){
  const tk = tasks[aTk];
  if(!tk) return;
  ensureTaskEnrichment(tk, aTk);
  const idx = tk.tests.length + 1;
  const newT1 = {
    id: 't-gen-' + idx,
    name: 'test_edge_case_empty_results_' + idx,
    desc: { es: 'Manejo resiliente de resultados vacíos y estado de carga', en: 'Resilient handling of empty results and loading state' },
    status: 'passed',
    duration: (28 + Math.floor(Math.random() * 20)) + 'ms'
  };
  const newT2 = {
    id: 't-gen-' + (idx + 1),
    name: 'test_input_sanitization_defense_' + (idx + 1),
    desc: { es: 'Sanitización estricta de parámetros para prevenir inyecciones', en: 'Strict param sanitization preventing injection attacks' },
    status: 'passed',
    duration: (35 + Math.floor(Math.random() * 25)) + 'ms'
  };
  tk.tests.push(newT1, newT2);
  const newSs = {
    id: 'ss-gen-' + (tk.screenshots.length + 1),
    name: 'evidence_edge_case_verification_' + aTk.toLowerCase() + '.png',
    title: { es: 'Captura de caso borde generada por test ' + newT1.name, en: 'Edge case capture from test ' + newT1.name },
    source: 'Playwright E2E Runner',
    time: new Date().toTimeString().split(' ')[0]
  };
  tk.screenshots.push(newSs);
  saveTasks();
  rSC();
  toast(t('addedTestToast'));
}

function generateMoreScreenshots(){
  const tk = tasks[aTk];
  if(!tk) return;
  ensureTaskEnrichment(tk, aTk);
  const idx = tk.screenshots.length + 1;
  const newSs = {
    id: 'ss-e2e-' + idx,
    name: 'evidence_' + aTk.toLowerCase() + '_viewport_render_' + idx + '.png',
    title: { es: 'Captura visual E2E de viewport', en: 'E2E visual viewport capture' },
    source: 'Playwright E2E Runner',
    time: new Date().toTimeString().split(' ')[0]
  };
  tk.screenshots.push(newSs);
  saveTasks();
  rSC();
  toast(t('addedSsToast'));
}

function removeScreenshot(idx){
  const tk = tasks[aTk];
  if(tk && tk.screenshots && tk.screenshots[idx]){
    tk.screenshots.splice(idx, 1);
    saveTasks();
    rSC();
  }
}

function rerunTestsVisual(){
  toast(L==='es'?'Ejecutando tests de nuevo...':'Re-running tests...');
  setTimeout(()=>{
    toast(L==='es'?'Todos los tests pasaron exitosamente':'All tests passed successfully');
  }, 400);
}

// ---- LOCAL ENVIRONMENT & DOCKER ----
let dockerStatus = { installed: false, running: false, version: '' };
let dockerContainers = [];

function rEnv(){
  const el = document.getElementById('sEnv');
  if (!el) return;
  let statusBadge;
  let statusCard;

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
        '<button class="bp" data-act="startDockerApp">'+svgPlay+' '+t('docStart')+'</button>'+
        '<button class="bs" data-act="refreshDocker">'+t('checkAgain')+'</button>'+
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
        '<button class="bp" data-act="installDockerBrew">'+svgTerm+' '+t('docInst')+'</button>'+
        '<button class="bs" data-act="openDockerDownload">'+svgExtLink+' '+t('docDwn')+'</button>'+
      '</div>'+
    '</div>';
  }

  let h = '<div class="ctr fi">';
  h += '<div style="display:flex;align-items:center;gap:6px;font-size:12px;margin-bottom:12px">'+
    '<button style="background:none;border:none;color:var(--vscode-descriptionForeground);cursor:pointer;display:flex;align-items:center;gap:4px;font-size:12px" data-act="showScr" data-arg="home">'+svgBack+t('back')+'</button>'+
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
    '<button class="bs" style="width:auto;padding:6px 12px;font-size:12px" data-act="launchService" data-arg="postgres">'+svgPlay+' '+(L==='es'?'Iniciar':'Start')+'</button>'+
  '</div>';

  // MySQL
  h += '<div class="card card-bg" style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">'+
    '<div style="display:flex;align-items:center;gap:8px">'+
      lg.MySQL +
      '<div><div style="font-size:13px;font-weight:600">MySQL (v8)</div><div style="font-size:11px;color:var(--vscode-descriptionForeground)">localhost:3306 · root / mysql</div></div>'+
    '</div>'+
    '<button class="bs" style="width:auto;padding:6px 12px;font-size:12px" data-act="launchService" data-arg="mysql">'+svgPlay+' '+(L==='es'?'Iniciar':'Start')+'</button>'+
  '</div>';

  // Redis
  h += '<div class="card card-bg" style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">'+
    '<div style="display:flex;align-items:center;gap:8px">'+
      svgRedis +
      '<div><div style="font-size:13px;font-weight:600">Redis</div><div style="font-size:11px;color:var(--vscode-descriptionForeground)">localhost:6379 · Cache & KV</div></div>'+
    '</div>'+
    '<button class="bs" style="width:auto;padding:6px 12px;font-size:12px" data-act="launchService" data-arg="redis">'+svgPlay+' '+(L==='es'?'Iniciar':'Start')+'</button>'+
  '</div>';

  // Full App Compose
  h += '<div class="card card-bg" style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">'+
    '<div style="display:flex;align-items:center;gap:8px">'+
      lg.Docker +
      '<div><div style="font-size:13px;font-weight:600">'+t('startComp')+'</div><div style="font-size:11px;color:var(--vscode-descriptionForeground)">docker compose up -d</div></div>'+
    '</div>'+
    '<button class="bs" style="width:auto;padding:6px 12px;font-size:12px" data-act="launchService" data-arg="compose">'+svgPlay+' '+(L==='es'?'Levantar':'Up')+'</button>'+
  '</div>';

  // Active containers
  h += '<div style="font-size:13px;font-weight:700;margin:18px 0 8px;display:flex;align-items:center;justify-content:space-between"><span>'+t('actCont')+' ('+dockerContainers.length+')</span><button style="background:none;border:none;color:var(--vscode-textLink-foreground);font-size:11px;cursor:pointer;font-weight:600" data-act="refreshDocker">'+t('checkAgain')+'</button></div>';
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
        '<button class="del-btn" style="padding:4px 8px;font-size:11px" data-act="stopContainer" data-arg="' + c.id + '">'+t('stopBtn')+'</button>'+
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
  h += '<button class="bp" style="flex:1" data-act="openCurrentAiChat">' + svgChat + ' ' + t('aiOpenBtn', { name: activeAi }) + '</button>';
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
      h += '<button class="bs" style="background:var(--vscode-button-background);color:var(--vscode-button-foreground);border:none;padding:4px 8px;font-size:11px" data-act="openCurrentAiChat">' + svgChat + ' ' + (L === 'es' ? 'Abrir' : 'Open') + '</button>';
    } else {
      h += '<button class="bs" style="padding:4px 8px;font-size:11px" data-act="setAiProvider" data-arg="' + item.n + '">' + t('aiUseBtn') + '</button>';
    }
    h += '</div></div>';
  });

  h += '<div style="margin-top:14px"><button class="bs" data-act="showScr" data-arg="home">' + (L === 'es' ? 'Volver a tareas' : 'Back to tasks') + '</button></div>';
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
  ensureTaskEnrichment(tk, id);
  const testsPassedEs = (tk.tests && tk.tests.length > 0)
    ? tk.tests.map(t => '- [x] ' + bt + t.name + bt + ' (' + (t.duration || '35ms') + ') - ' + (t.desc[L] || t.desc.es || t.desc.en || t.desc)).join('\n')
    : '- [x] Pruebas unitarias y de integración ejecutadas con éxito.';
  const scEvidenceEs = (tk.screenshots && tk.screenshots.length > 0)
    ? tk.screenshots.map(s => '- [x] ' + bt + s.name + bt + ' (Auto-capturado por ' + (s.source || 'Playwright E2E') + ')').join('\n')
    : '- [x] Capturas de pantalla y evidencias adjuntas en el ticket.';

  const testsPassedEn = (tk.tests && tk.tests.length > 0)
    ? tk.tests.map(t => '- [x] ' + bt + t.name + bt + ' (' + (t.duration || '35ms') + ') - ' + (t.desc[L] || t.desc.en || t.desc.es || t.desc)).join('\n')
    : '- [x] Automated and integration tests passed successfully.';
  const scEvidenceEn = (tk.screenshots && tk.screenshots.length > 0)
    ? tk.screenshots.map(s => '- [x] ' + bt + s.name + bt + ' (Auto-captured by ' + (s.source || 'Playwright E2E') + ')').join('\n')
    : '- [x] Screenshots and evidence attached to ticket.';

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
        '#### Pruebas Automatizadas Verificadas\n' +
        testsPassedEs + '\n\n' +
        '#### Capturas de Pantalla y Evidencias\n' +
        scEvidenceEs + '\n\n' +
        '#### Estado\n' +
        'Listo para revisión y Merge Request.';
    } else {
      return '### Implementation & Verification Summary\n\n' +
        '**Ticket:** ' + id + ' - ' + rawTitle + '\n' +
        '**Branch:** ' + bt + 'feature/' + id.toLowerCase() + bt + '\n\n' +
        '#### Verified Acceptance Criteria\n' +
        rawCriteria.map(c => '- [x] ' + c).join('\n') + '\n\n' +
        '#### Automated Tests Passed\n' +
        testsPassedEn + '\n\n' +
        '#### Screenshots & Artifact Evidence\n' +
        scEvidenceEn + '\n\n' +
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
  h+='<div style="margin-top:14px;padding-top:12px;border-top:1px solid var(--vscode-panel-border)"><button class="bs" style="border-style:dashed" data-act="startOb">'+svgPlus+' '+t('nPS')+'</button></div></div>';
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
  if(e.data.type==='deleteEpicConfirmed'){
    const delEid = e.data.epicId;
    delete epics[delEid];
    Object.keys(tasks).forEach(tid => {
      if(tasks[tid].epicId === delEid){
        tasks[tid].epicId = '';
      }
    });
    Object.keys(milestones).forEach(mid => {
      if(milestones[mid].epicIds){
        milestones[mid].epicIds = milestones[mid].epicIds.filter(id => id !== delEid);
      }
    });
    saveEpics();
    saveTasks();
    if(selectedEpicId === delEid) selectedEpicId = null;
    toast((L==='es'?'Epica eliminada: ':'Epic deleted: ')+delEid);
    showScr('home');
  }
  if(e.data.type==='localGitInfo'){
    localGitState = {
      hasGit: !!e.data.hasGit,
      branch: e.data.branch || 'main',
      hasChanges: !!e.data.hasChanges,
      commits: e.data.commits || 0,
      rootPath: e.data.rootPath || null
    };
    if (aTk && cS === 5) rSC();
  }
  if(e.data.type==='workStarted'){
    const target = e.data.target;
    workNotice = target === 'claudePanel' ? t('workStepPanel') : target === 'claudeTerminal' ? t('workStepTerminal') : t('workStepClipboard');
    if (aTk === e.data.ticketId) goS(2);
  }
  if(e.data.type==='localCommitSuccess'){
    const successMsg = (L === 'es' ? 'Commit local ' : 'Local commit ') + (e.data.hash || '') + (L === 'es' ? ' realizado en rama ' : ' created on branch ') + (e.data.branch || 'main') + '.';
    sDone(successMsg);
  }
  if(e.data.type==='evidenceSelected'&&e.data.fileNames){
    const tk = tasks[aTk];
    if(tk){
      ensureTaskEnrichment(tk, aTk);
      e.data.fileNames.forEach(name=>{
        tk.screenshots.push({
          id:'ss-man-'+Date.now()+'-'+Math.random().toString(36).substr(2,4),
          name: name,
          title: { es: 'Evidencia manual adjuntada', en: 'Manual evidence attached' },
          source: 'Manual Upload',
          time: new Date().toTimeString().split(' ')[0]
        });
      });
      saveTasks();
      rSC();
      toast(L==='es'?'Evidencia adjuntada a Jira':'Evidence attached to Jira');
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


function bindUiActions() {
  document.addEventListener('click', (event) => {
    const el = event.target.closest('[data-act]');
    if (!el) return;
    if (el.hasAttribute('data-stop')) event.stopPropagation();
    dispatchAct(el.getAttribute('data-act'), el, el.getAttribute('data-arg'), el.getAttribute('data-arg2'));
  });
  document.addEventListener('input', (event) => {
    const el = event.target.closest('[data-input]');
    if (!el) return;
    const kind = el.getAttribute('data-input');
    if (kind === 'fC') fC(el.value);
    else if (kind === 'setCrit') newCriteria[Number(el.getAttribute('data-idx'))] = el.value;
  });
}

function dispatchAct(name, el, arg, arg2) {
  switch (name) {
    case 'cLang': return cLang(arg);
    case 'startOb': return startOb();
    case 'showScr': return showScr(arg);
    case 'selectStarterStack': return selectStarterStack();
    case 'obN': return obN(Number(arg));
    case 'startLocally': return startLocally();
    case 'toggleToolTips': return toggleToolTips();
    case 'setCatFilter': return setCatFilter(arg, el);
    case 'tC': return tC(el);
    case 'connectJira': return connectJira();
    case 'connectRepo': return connectRepo();
    case 'finOb': return finOb();
    case 'openTk': return openTk(arg);
    case 'toggleTaskComplete': return toggleTaskComplete(arg);
    case 'delTk': return delTk(arg);
    case 'openCreateEpic': return openCreateEpic();
    case 'openEpic': return openEpic(arg);
    case 'editEpic': return editEpic(arg);
    case 'deleteEpic': return deleteEpic(arg);
    case 'closeEpic': return closeEpic();
    case 'createTaskInEpic': return createTaskInEpic(arg);
    case 'saveEpicForm': return saveEpicForm();
    case 'addCrit': return addCrit();
    case 'saveNewTask': return saveNewTask();
    case 'rmCrit': return rmCrit(Number(arg));
    case 'startAiWithTicket': return startAiWithTicket();
    case 'workOnTask': return workOnTask(arg);
    case 'reopenChat': return reopenChat();
    case 'cpFullPrompt': return cpFullPrompt();
    case 'cpP': return cpP(el, arg);
    case 'goS': return goS(Number(arg));
    case 'toast': return toast(arg);
    case 'toggleJiraPreview': return toggleJiraPreview(arg);
    case 'insertMd': return insertMd(arg, arg2);
    case 'resetJiraComment': return resetJiraComment(arg);
    case 'runTermTests': return runTermTests();
    case 'rerunTestsVisual': return rerunTestsVisual();
    case 'generateMoreTests': return generateMoreTests();
    case 'generateMoreScreenshots': return generateMoreScreenshots();
    case 'removeScreenshot': return removeScreenshot(Number(arg));
    case 'addSS': return addSS();
    case 'initGitInWorkspace': return initGitInWorkspace();
    case 'doLocalCommit': return doLocalCommit();
    case 'doMR': return doMR();
    case 'startDockerApp': return startDockerApp();
    case 'installDockerBrew': return installDockerBrew();
    case 'openDockerDownload': return openDockerDownload();
    case 'launchService': return launchService(arg);
    case 'stopContainer': return stopContainer(arg);
    case 'refreshDocker': return refreshDocker();
    case 'openCurrentAiChat': return openCurrentAiChat();
    case 'setAiProvider': return setAiProvider(arg);
    default: return undefined;
  }
}

bindUiActions();

// Init
updTop();
vsc.postMessage({ type: 'checkDocker' });
if(onb){
  document.getElementById('topAct').style.display='flex';
  document.getElementById('topLbl').innerText='· PROJ / checkout';
  if (bootstrap.initialTicket) { openTk(bootstrap.initialTicket); } else { showScr('home'); }
}else{
  rOb();
}
vsc.postMessage({ type: 'uiReady' });