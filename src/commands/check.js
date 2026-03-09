import chalk from 'chalk';
import ora from 'ora';
import { createAdminApiClient } from '@shopify/admin-api-client';
import { healthCheck, getCollectionStats } from '../lib/typesense.js';
import { config, validateConfig } from '../lib/config.js';
import { isContainerRunning } from '../lib/docker.js';

export async function checkCommand() {
  console.log(chalk.bold('\n🔍 shopify-typesense — check\n'));

  // 1. Variables de entorno
  console.log(chalk.bold('Variables de entorno:'));
  try {
    validateConfig();
    console.log(chalk.green('  ✅ Todas las variables requeridas están presentes'));
    console.log(chalk.dim(`     SHOPIFY_STORE:  ${config.shopify.store}`));
    console.log(chalk.dim(`     TYPESENSE_HOST: ${config.typesense.host}:${config.typesense.port}`));
  } catch (err) {
    console.log(chalk.red('  ❌ ' + err.message));
    process.exit(1);
  }

  // 2. Shopify
  console.log(chalk.bold('\nShopify API:'));
  const shopifySpinner = ora('  Conectando a Shopify...').start();
  try {
    const client = createAdminApiClient({
      storeDomain: config.shopify.store,
      apiVersion: config.shopify.apiVersion,
      accessToken: config.shopify.accessToken,
    });

    const response = await client.request(`
      query {
        shop {
          name
          primaryDomain { url }
        }
        productsCount { count }
      }
    `);

    if (response.errors) throw new Error(JSON.stringify(response.errors));

    const { shop, productsCount } = response.data;
    shopifySpinner.succeed('Shopify OK');
    console.log(chalk.dim(`     Tienda:    ${shop.name}`));
    console.log(chalk.dim(`     URL:       ${shop.primaryDomain.url}`));
    console.log(chalk.dim(`     Productos: ${productsCount.count.toLocaleString()}`));
  } catch (err) {
    shopifySpinner.fail('No se pudo conectar a Shopify');
    console.error(chalk.red('     ' + err.message));
  }

  // 3. Docker
  console.log(chalk.bold('\nDocker (Typesense local):'));
  const running = await isContainerRunning();
  if (running) {
    console.log(chalk.green('  ✅ Container corriendo'));
  } else {
    console.log(chalk.yellow('  ⚠️  Container detenido — ejecuta: node src/index.js start'));
  }

  // 4. Typesense
  console.log(chalk.bold('\nTypesense:'));
  const tsSpinner = ora('  Conectando a Typesense...').start();
  try {
    await healthCheck();
    tsSpinner.succeed('Typesense OK');

    try {
      const stats = await getCollectionStats();
      console.log(chalk.dim(`     Documentos indexados: ${stats.num_documents.toLocaleString()}`));
    } catch {
      console.log(chalk.yellow('     ⚠️  Colección "products" no existe aún — ejecuta: sync'));
    }
  } catch {
    tsSpinner.fail('Typesense no responde');
    console.log(chalk.dim('     ¿Está corriendo? Ejecuta: node src/index.js start'));
  }

  console.log();
}
