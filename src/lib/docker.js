import { execSync, exec } from 'child_process';
import { promisify } from 'util';
import { config } from './config.js';

export const execAsync = promisify(exec);

const SAFE_PATTERN = /^[a-zA-Z0-9._:/-]+$/;

function sanitize(value, name) {
  if (!SAFE_PATTERN.test(value)) {
    throw new Error(`Valor inseguro para ${name}: "${value}"`);
  }
  return value;
}

function getDockerVars() {
  return {
    containerName: sanitize(config.docker.containerName, 'containerName'),
    volume: sanitize(config.docker.volume, 'volume'),
    image: sanitize(config.docker.image, 'image'),
    apiKey: sanitize(config.typesense.apiKey, 'apiKey'),
    port: sanitize(config.typesense.port, 'port'),
  };
}

export async function isContainerRunning() {
  const { containerName } = getDockerVars();
  try {
    const { stdout } = await execAsync(
      `docker inspect -f "{{.State.Running}}" ${containerName} 2>/dev/null`
    );
    return stdout.trim() === 'true';
  } catch {
    return false;
  }
}

export async function isContainerStopped() {
  const { containerName } = getDockerVars();
  try {
    const { stdout } = await execAsync(
      `docker inspect -f "{{.State.Status}}" ${containerName} 2>/dev/null`
    );
    return stdout.trim() === 'exited';
  } catch {
    return false;
  }
}

export async function startContainer() {
  const { containerName, volume, image, apiKey, port } = getDockerVars();
  const stopped = await isContainerStopped();

  if (stopped) {
    await execAsync(`docker start ${containerName}`);
    return 'restarted';
  }

  const cmd = [
    'docker run -d',
    `--name ${containerName}`,
    `-p ${port}:8108`,
    `-v ${volume}:/data`,
    image,
    '--data-dir /data',
    `--api-key=${apiKey}`,
    '--enable-cors',
  ].join(' ');

  await execAsync(cmd);
  return 'created';
}

export async function stopContainer() {
  const { containerName } = getDockerVars();
  await execAsync(`docker stop ${containerName}`);
}

export async function getContainerStats() {
  const { containerName } = getDockerVars();
  try {
    const { stdout } = await execAsync(
      `docker inspect ${containerName} --format "{{.State.Status}} | Started: {{.State.StartedAt}}"`
    );
    return stdout.trim();
  } catch {
    return null;
  }
}
