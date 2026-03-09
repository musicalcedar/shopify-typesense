import chalk from 'chalk';
import { isContainerRunning, getContainerStats } from '../lib/docker.js';
import { healthCheck, getCollectionStats } from '../lib/typesense.js';
import { config } from '../lib/config.js';

export async function statusCommand() {
  console.log(chalk.bold('\n🔍 shopify-typesense — status\n'));

  // Docker
  const running = await isContainerRunning();
  const dockerStats = await getContainerStats();

  console.log(chalk.bold('Docker:'));
  if (running) {
    console.log(chalk.green('  ✅ Container corriendo'));
    if (dockerStats) console.log(chalk.dim(`     ${dockerStats}`));
  } else {
    console.log(chalk.red('  ❌ Container detenido'));
    console.log(chalk.dim('     Ejecuta: shopify-typesense start'));
  }

  if (!running) {
    console.log();
    return;
  }

  // Typesense health
  console.log(chalk.bold('\nTypesense:'));
  try {
    const health = await healthCheck();
    console.log(chalk.green(`  ✅ ${health.ok ? 'OK' : 'Degradado'}`));
    console.log(chalk.dim(`     ${config.typesense.protocol}://${config.typesense.host}:${config.typesense.port}`));
  } catch {
    console.log(chalk.red('  ❌ No responde'));
  }

  // Índice
  console.log(chalk.bold('\nÍndice "products":'));
  try {
    const stats = await getCollectionStats();
    console.log(chalk.green(`  ✅ ${stats.num_documents.toLocaleString()} documentos indexados`));
    console.log(chalk.dim(`     Creada: ${new Date(stats.created_at * 1000).toLocaleString()}`));
  } catch {
    console.log(chalk.yellow('  ⚠️  Colección no existe aún'));
    console.log(chalk.dim('     Ejecuta: shopify-typesense sync'));
  }

  console.log();
}
