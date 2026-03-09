import chalk from 'chalk';
import ora from 'ora';
import { isContainerRunning, stopContainer } from '../lib/docker.js';

export async function stopCommand() {
  console.log(chalk.bold('\n🔍 shopify-typesense — stop\n'));

  const running = await isContainerRunning();
  if (!running) {
    console.log(chalk.yellow('⚠️  Typesense no está corriendo.'));
    return;
  }

  const spinner = ora('Deteniendo Typesense...').start();
  try {
    await stopContainer();
    spinner.succeed('Typesense detenido. Los datos persisten en el volumen Docker.');
    console.log(chalk.dim('\n   Para reiniciar: shopify-typesense start\n'));
  } catch (err) {
    spinner.fail('Error al detener Typesense.');
    console.error(chalk.red(err.message));
    process.exit(1);
  }
}
