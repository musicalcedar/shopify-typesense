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
//
// Este script corre cada hora. En vez de montar un segundo cronjob para el
// full, decide aquí: cada FULL_SYNC_EVERY_HOURS horas hace full y purga, el
// resto de las horas sigue incremental. Con el default de 6 son 4 fulls al
// día (00, 06, 12 y 18 UTC) y frescura horaria para las altas el resto del
// tiempo. Ponerlo en 0 desactiva el full automático.
const FULL_EVERY_HOURS = parseInt(process.env.FULL_SYNC_EVERY_HOURS || '6', 10);

const forcedFull = process.argv.includes('--full') || process.env.SYNC_MODE === 'full';
const scheduledFull = FULL_EVERY_HOURS > 0 && new Date().getUTCHours() % FULL_EVERY_HOURS === 0;
const FULL = forcedFull || scheduledFull;

async function cronSync() {
  const start = Date.now();
  const reason = FULL ? (forcedFull ? 'forced' : `every ${FULL_EVERY_HOURS}h`) : 'hourly';
  console.log(`[cron] ${FULL ? 'Full' : 'Incremental'} sync (${reason}) started at ${new Date().toISOString()}`);

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
