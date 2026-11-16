const commands = {
  version: 'docker --version',
  info: 'docker info',
  ps: 'docker ps -a --format "{{.ID}}|{{.Names}}|{{.Image}}|{{.Status}}|{{.Ports}}"',
};

const OPEN_DOCKER_DESKTOP_COMMAND = 'open -a Docker';

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

function buildLaunchCommand(service) {
  if (service === 'postgres') {
    return 'docker run -d --name ps-postgres -e POSTGRES_PASSWORD=postgres -p 5432:5432 postgres:alpine || docker start ps-postgres';
  }
  if (service === 'mysql') {
    return 'docker run -d --name ps-mysql -e MYSQL_ROOT_PASSWORD=mysql -p 3306:3306 mysql:latest || docker start ps-mysql';
  }
  if (service === 'redis') {
    return 'docker run -d --name ps-redis -p 6379:6379 redis:alpine || docker start ps-redis';
  }
  if (service === 'compose') {
    return 'docker compose up -d';
  }
  return '';
}

function buildStopCommand(containerId) {
  return `docker stop ${containerId}`;
}

function parseDockerPs(stdout) {
  if (!stdout) return [];
  const lines = stdout.trim().split('\n').filter(Boolean);
  return lines.map((line) => {
    const [id, name, image, status, ports] = line.split('|');
    return { id, name, image, status, ports };
  });
}

function getDockerStatus(exec) {
  return new Promise((resolve) => {
    exec(commands.version, (err, stdout) => {
      if (err || !stdout) {
        resolve({ installed: false, running: false, version: '' });
        return;
      }
      const version = stdout.trim();
      exec(commands.info, (infoErr) => {
        resolve({
          installed: true,
          running: !infoErr,
          version,
        });
      });
    });
  });
}

function getDockerContainers(exec) {
  return new Promise((resolve) => {
    exec(commands.ps, (err, stdout) => {
      if (err || !stdout) {
        resolve([]);
        return;
      }
      resolve(parseDockerPs(stdout));
    });
  });
}

module.exports = {
  commands,
  OPEN_DOCKER_DESKTOP_COMMAND,
  DARWIN_INSTALL_LINES,
  OTHER_INSTALL_LINES,
  dockerInstallLines,
  buildLaunchCommand,
  buildStopCommand,
  parseDockerPs,
  getDockerStatus,
  getDockerContainers,
};
