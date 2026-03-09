import { execSync, exec } from 'child_process';
import { promisify } from 'util';
import { config } from './config.js';

export const execAsync = promisify(exec);
const { containerName, volume, image } = config.docker;
const { apiKey, port } = config.typesense;

export async function isContainerRunning() {
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
  const stopped = await isContainerStopped();

  if (stopped) {
    // Container existe pero está parado — solo arrancarlo
    await execAsync(`docker start ${containerName}`);
    return 'restarted';
  }

  // Container no existe — crearlo
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
  await execAsync(`docker stop ${containerName}`);
}

export async function getContainerStats() {
  try {
    const { stdout } = await execAsync(
      `docker inspect ${containerName} --format "{{.State.Status}} | Started: {{.State.StartedAt}}"`
    );
    return stdout.trim();
  } catch {
    return null;
  }
}
