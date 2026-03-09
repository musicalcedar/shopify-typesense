import chalk from 'chalk';
import ora from 'ora';
import { isContainerRunning, startContainer } from '../lib/docker.js';
import { healthCheck } from '../lib/typesense.js';
import { config } from '../lib/config.js';

export async function startCommand() {
  console.log(chalk.bold('\n🔍 shopify-typesense — start\n'));

  // Verificar si ya está corriendo
  const running = await isContainerRunning();
  if (running) {
    console.log(chalk.yellow('⚠️  Typesense ya está corriendo.'));
    printConnectionInfo();
    return;
  }

  const spinner = ora('Iniciando Typesense en Docker...').start();

  try {
    const result = await startContainer();
    spinner.succeed(result === 'restarted' ? 'Container reiniciado.' : 'Container creado e iniciado.');

    // Esperar a que Typesense esté listo
    const waitSpinner = ora('Esperando que Typesense esté listo...').start();
    await waitForTypesense(waitSpinner);

    printConnectionInfo();
  } catch (err) {
    spinner.fail('Error al iniciar Typesense.');
    console.error(chalk.red(err.message));
    process.exit(1);
  }
}

async function waitForTypesense(spinner, retries = 15) {
  for (let i = 0; i < retries; i++) {
    try {
      await healthCheck();
      spinner.succeed('Typesense listo.');
      return;
    } catch {
      await new Promise(r => setTimeout(r, 1000));
    }
  }
  spinner.fail('Typesense no respondió a tiempo.');
  throw new Error('Timeout esperando Typesense.');
}

function printConnectionInfo() {
  const { host, port, protocol, apiKey } = config.typesense;
  console.log('\n' + chalk.green('✅ Typesense corriendo'));
  console.log(chalk.dim(`   URL:     ${protocol}://${host}:${port}`));
  console.log(chalk.dim(`   API Key: ${apiKey}`));
  console.log(chalk.dim(`   Health:  ${protocol}://${host}:${port}/health`));
  console.log('\n' + chalk.cyan('Próximo paso:') + ' shopify-typesense sync\n');
}
