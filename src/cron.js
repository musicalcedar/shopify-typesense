import 'dotenv/config';
import { validateConfig } from './lib/config.js';
import { getAllProducts } from './lib/shopify.js';
import { transformProduct } from './lib/transform.js';
import { ensureCollection, importDocuments, getCollectionStats, purgeStaleDocuments } from './lib/typesense.js';
import { getAllReviews } from './lib/judgeme.js';

// El sync incremental solo ve productos activos modificados hace poco, así que
// no puede enterarse de los que pasaron a draft o se borraron: dejan de venir
// en la respuesta, sin más. Purgar exige la lista completa de activos, y eso
// solo lo da el sync full.
const FULL = process.argv.includes('--full') || process.env.SYNC_MODE === 'full';

async function cronSync() {
  const start = Date.now();
  console.log(`[cron] ${FULL ? 'Full' : 'Incremental'} sync started at ${new Date().toISOString()}`);

  validateConfig();

  const updatedAfter = FULL ? null : new Date(Date.now() - 2 * 60 * 60 * 1000);
  await ensureCollection();

  const [products, ratingsMap] = await Promise.all([
    getAllProducts({ updatedAfter }),
    getAllReviews(),
  ]);
  const transformed = products.map(p => transformProduct(p, ratingsMap)).filter(Boolean);
  const { imported, failed } = await importDocuments(transformed);

  if (FULL) {
    const purge = await purgeStaleDocuments(transformed.map(d => d.id));
    if (purge.aborted) {
      console.warn('[cron] Purge skipped:', purge.reason);
    } else if (purge.deleted > 0) {
      console.log(`[cron] Purged ${purge.deleted} stale docs:`, purge.ids.join(', '));
    }
  }

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
