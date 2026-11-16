const LAUNCH_ARGS = {
  postgres: {
    run: [
      'run',
      '-d',
      '--name',
      'ps-postgres',
      '-e',
      'POSTGRES_PASSWORD=postgres',
      '-p',
      '5432:5432',
      'postgres:alpine',
    ],
    start: ['start', 'ps-postgres'],
  },
  mysql: {
    run: [
      'run',
      '-d',
      '--name',
      'ps-mysql',
      '-e',
      'MYSQL_ROOT_PASSWORD=mysql',
      '-p',
      '3306:3306',
      'mysql:latest',
    ],
    start: ['start', 'ps-mysql'],
  },
  redis: {
    run: ['run', '-d', '--name', 'ps-redis', '-p', '6379:6379', 'redis:alpine'],
    start: ['start', 'ps-redis'],
  },
  compose: {
    run: ['compose', 'up', '-d'],
    start: null,
  },
};

const OPEN_DOCKER_DESKTOP_ARGS = ['-a', 'Docker'];

const DARWIN_INSTALL_LINES = [
  'echo "=== Instalando Docker en macOS ==="',
  'if ! command -v brew &> /dev/null; then echo "Instalando Homebrew..."; /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"; fi',
  'echo "Instalando Docker Desktop con Homebrew..." && brew install --cask docker && open -a Docker',
];

const OTHER_INSTALL_LINES = [
  'echo "Por favor visita https://docs.docker.com/get-docker/ para instalar Docker."',
];

function dockerInstallLines(platform) {
  return platform === 'darwin' ? DARWIN_INSTALL_LINES.slice() : OTHER_INSTALL_LINES.slice();
}

function isContainerId(id) {
  return typeof id === 'string' && /^[a-f0-9]{12,64}$/.test(id);
}

function stopArgs(containerId) {
  return ['stop', containerId];
}

function launchSpec(service) {
  return Object.prototype.hasOwnProperty.call(LAUNCH_ARGS, service) ? LAUNCH_ARGS[service] : null;
}

function parseDockerPs(stdout) {
  if (!stdout) return [];
  const lines = stdout.trim().split('\n').filter(Boolean);
  return lines.map((line) => {
    const [id, name, image, status, ports] = line.split('|');
    return { id, name, image, status, ports };
  });
}

async function getDockerStatus(runFile) {
  const version = await runFile('docker', ['--version']);
  if (!version.ok || !version.stdout) {
    return { installed: false, running: false, version: '' };
  }
  const info = await runFile('docker', ['info']);
  return {
    installed: true,
    running: info.ok,
    version: version.stdout.trim(),
  };
}

async function getDockerContainers(runFile) {
  const result = await runFile('docker', [
    'ps',
    '-a',
    '--format',
    '{{.ID}}|{{.Names}}|{{.Image}}|{{.Status}}|{{.Ports}}',
  ]);
  if (!result.ok || !result.stdout) return [];
  return parseDockerPs(result.stdout);
}

async function launchService(runFile, service) {
  const spec = launchSpec(service);
  if (!spec) return null;
  const started = await runFile('docker', spec.run);
  if (started.ok || !spec.start) return started;
  return runFile('docker', spec.start);
}

async function stopContainer(runFile, containerId) {
  if (!isContainerId(containerId)) return { ok: false, reason: 'invalid' };
  return runFile('docker', stopArgs(containerId));
}

module.exports = {
  LAUNCH_ARGS,
  OPEN_DOCKER_DESKTOP_ARGS,
  DARWIN_INSTALL_LINES,
  OTHER_INSTALL_LINES,
  dockerInstallLines,
  isContainerId,
  stopArgs,
  launchSpec,
  parseDockerPs,
  getDockerStatus,
  getDockerContainers,
  launchService,
  stopContainer,
};
