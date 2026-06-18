import 'dotenv/config';
import { validateConfig } from './lib/config.js';
import { getAllProducts } from './lib/shopify.js';
import { transformProduct } from './lib/transform.js';
import { ensureCollection, importDocuments, getCollectionStats } from './lib/typesense.js';

async function cronSync() {
  const start = Date.now();
  console.log(`[cron] Sync started at ${new Date().toISOString()}`);

  validateConfig();

  const updatedAfter = new Date(Date.now() - 2 * 60 * 60 * 1000);
  await ensureCollection();

  const products = await getAllProducts({ updatedAfter });
  const transformed = products.map(transformProduct).filter(Boolean);
  const { imported, failed } = await importDocuments(transformed);
  const stats = await getCollectionStats();

  const elapsed = ((Date.now() - start) / 1000).toFixed(1);
  console.log(`[cron] Done in ${elapsed}s — fetched: ${products.length}, imported: ${imported}, failed: ${failed}, total: ${stats.num_documents}`);
}

cronSync()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('[cron] Sync failed:', err.message);
    process.exit(1);
  });
