import chalk from 'chalk';
import ora from 'ora';
import { validateConfig } from '../lib/config.js';
import { getAllProducts } from '../lib/shopify.js';
import { transformProduct } from '../lib/transform.js';
import { ensureCollection, importDocuments, getCollectionStats } from '../lib/typesense.js';

export async function syncCommand({ watch, drop }) {
  console.log(chalk.bold('\n🔍 shopify-typesense — sync\n'));

  try {
    validateConfig();
  } catch (err) {
    console.error(chalk.red('❌ ' + err.message));
    process.exit(1);
  }

  const isIncremental = watch && !drop;
  const updatedAfter = isIncremental ? new Date(Date.now() - 2 * 60 * 60 * 1000) : null;

  if (isIncremental) {
    console.log(chalk.cyan(`Modo incremental: productos actualizados desde ${updatedAfter.toLocaleString()}\n`));
  } else if (drop) {
    console.log(chalk.yellow('⚠️  Se eliminará y recreará la colección completa.\n'));
  }

  // PASO 1: Colección
  const collectionSpinner = ora('Verificando colección en Typesense...').start();
  try {
    await ensureCollection({ drop });
    collectionSpinner.succeed(drop ? 'Colección recreada.' : 'Colección lista.');
  } catch (err) {
    collectionSpinner.fail('Error con la colección.');
    console.error(chalk.red(err.message));
    process.exit(1);
  }

  // PASO 2: Obtener productos de Shopify
  const fetchSpinner = ora('Obteniendo productos de Shopify...').start();
  let shopifyProducts;

  try {
    shopifyProducts = await getAllProducts({
      updatedAfter,
      onProgress: (total, page) => {
        fetchSpinner.text = `Obteniendo productos de Shopify... (página ${page}, ${total} hasta ahora)`;
      },
    });
    fetchSpinner.succeed(`${shopifyProducts.length.toLocaleString()} productos obtenidos de Shopify.`);
  } catch (err) {
    fetchSpinner.fail('Error al obtener productos de Shopify.');
    console.error(chalk.red(err.message));
    process.exit(1);
  }

  // PASO 3: Transformar
  const transformed = shopifyProducts.map(transformProduct).filter(Boolean);
  const skipped = shopifyProducts.length - transformed.length;

  if (skipped > 0) {
    console.log(chalk.yellow(`⚠️  ${skipped} productos omitidos (sin variantes).`));
  }

  // PASO 4: Importar a Typesense
  const importSpinner = ora(`Importando ${transformed.length.toLocaleString()} productos a Typesense...`).start();

  try {
    const { imported, failed } = await importDocuments(transformed, {
      onProgress: (done, errors, total) => {
        importSpinner.text = `Importando... ${done.toLocaleString()}/${total.toLocaleString()}${errors > 0 ? ` (${errors} errores)` : ''}`;
      },
    });

    if (failed === 0) {
      importSpinner.succeed(`${imported.toLocaleString()} productos importados correctamente.`);
    } else {
      importSpinner.warn(`${imported.toLocaleString()} importados, ${failed} errores.`);
    }
  } catch (err) {
    importSpinner.fail('Error al importar a Typesense.');
    console.error(chalk.red(err.message));
    process.exit(1);
  }

  // RESUMEN FINAL
  try {
    const stats = await getCollectionStats();
    console.log('\n' + chalk.bold('─'.repeat(50)));
    console.log(chalk.green.bold('✅ Sincronización completada'));
    console.log(chalk.dim(`   Documentos en índice: ${stats.num_documents.toLocaleString()}`));
    console.log(chalk.bold('─'.repeat(50)) + '\n');
  } catch {
    // Stats opcionales, no bloquear
  }
}
