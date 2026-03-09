import chalk from 'chalk';
import ora from 'ora';
import { getClient } from '../lib/typesense.js';

export async function testSearchCommand(query) {
  console.log(chalk.bold(`\n🔍 shopify-typesense — test-search "${query}"\n`));

  const client = getClient();
  const spinner = ora('Buscando...').start();

  try {
    const result = await client.collections('products').documents().search({
      q: query,
      query_by: 'title,vendor,product_type,description',
      per_page: 5,
      facet_by: 'vendor,product_type,available,price_range',
    });

    spinner.succeed(`${result.found.toLocaleString()} resultados encontrados (${result.search_time_ms}ms)\n`);

    if (result.hits.length === 0) {
      console.log(chalk.yellow('Sin resultados para esa búsqueda.'));
      return;
    }

    // Resultados
    console.log(chalk.bold('Top resultados:'));
    result.hits.forEach((hit, i) => {
      const doc = hit.document;
      const price = (doc.price / 100).toLocaleString('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 });
      const available = doc.available ? chalk.green('✓ disponible') : chalk.red('✗ agotado');
      console.log(`  ${i + 1}. ${chalk.white(doc.title)}`);
      console.log(chalk.dim(`     ${doc.vendor} · ${price} · ${available}`));
      console.log(chalk.dim(`     ${doc.url}`));
    });

    // Facetas
    if (result.facet_counts?.length > 0) {
      console.log(chalk.bold('\nFacetas:'));
      result.facet_counts.forEach(facet => {
        const top = facet.counts.slice(0, 3).map(c => `${c.value} (${c.count})`).join(', ');
        console.log(chalk.dim(`  ${facet.field_name}: ${top}`));
      });
    }

    console.log();
  } catch (err) {
    spinner.fail('Error al buscar.');
    console.error(chalk.red(err.message));
    process.exit(1);
  }
}
