import chalk from 'chalk';
import ora from 'ora';
import { execAsync } from '../lib/docker.js';
import { config } from '../lib/config.js';

const DASHBOARD_CONTAINER = 'typesense-dashboard';
const DASHBOARD_IMAGE = 'ghcr.io/bfritscher/typesense-dashboard:latest';
const DASHBOARD_PORT = '8109';

async function isDashboardRunning() {
  try {
    const { stdout } = await execAsync(
      `docker inspect -f "{{.State.Running}}" ${DASHBOARD_CONTAINER} 2>/dev/null`
    );
    return stdout.trim() === 'true';
  } catch {
    return false;
  }
}

async function isDashboardStopped() {
  try {
    const { stdout } = await execAsync(
      `docker inspect -f "{{.State.Status}}" ${DASHBOARD_CONTAINER} 2>/dev/null`
    );
    return stdout.trim() === 'exited';
  } catch {
    return false;
  }
}

export async function dashboardCommand() {
  console.log(chalk.bold('\n🔍 shopify-typesense — dashboard\n'));

  const running = await isDashboardRunning();
  if (running) {
    console.log(chalk.yellow('⚠️  El dashboard ya está corriendo.'));
    printDashboardInfo();
    return;
  }

  const spinner = ora('Iniciando Typesense Dashboard...').start();

  try {
    const stopped = await isDashboardStopped();

    if (stopped) {
      await execAsync(`docker start ${DASHBOARD_CONTAINER}`);
    } else {
      await execAsync(
        `docker run -d --name ${DASHBOARD_CONTAINER} -p ${DASHBOARD_PORT}:80 ${DASHBOARD_IMAGE}`
      );
    }

    spinner.succeed('Dashboard iniciado.');
    printDashboardInfo();
  } catch (err) {
    spinner.fail('Error al iniciar el dashboard.');
    console.error(chalk.red(err.message));
    process.exit(1);
  }
}

function printDashboardInfo() {
  const { host, port, protocol } = config.typesense;
  console.log('\n' + chalk.green('✅ Typesense Dashboard corriendo'));
  console.log(chalk.dim(`   Abre: http://localhost:${DASHBOARD_PORT}`));
  console.log(chalk.bold('\nDatos de conexión en el dashboard:'));
  console.log(chalk.dim(`   Host:    ${protocol}://${host}:${port}`));
  console.log();
}
