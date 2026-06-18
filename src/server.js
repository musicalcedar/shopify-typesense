import 'dotenv/config';
import { createServer } from 'node:http';
import { config, validateConfig, isRailway } from './lib/config.js';
import { getAllProducts } from './lib/shopify.js';
import { transformProduct } from './lib/transform.js';
import { ensureCollection, importDocuments, getCollectionStats, healthCheck } from './lib/typesense.js';

let syncing = false;

async function runSync({ incremental = false } = {}) {
  if (syncing) return { error: 'Sync already running', status: 409 };
  syncing = true;

  try {
    validateConfig();

    const updatedAfter = incremental ? new Date(Date.now() - 2 * 60 * 60 * 1000) : null;

    await ensureCollection();

    const products = await getAllProducts({ updatedAfter });
    const transformed = products.map(transformProduct).filter(Boolean);
    const { imported, failed } = await importDocuments(transformed);
    const stats = await getCollectionStats();

    return {
      status: 200,
      result: {
        mode: incremental ? 'incremental' : 'full',
        fetched: products.length,
        imported,
        failed,
        totalIndexed: stats.num_documents,
      },
    };
  } finally {
    syncing = false;
  }
}

function json(res, statusCode, data) {
  res.writeHead(statusCode, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

function authenticate(req) {
  const secret = config.server.syncSecret;
  if (!secret) return false;
  const auth = req.headers['authorization'];
  return auth === `Bearer ${secret}`;
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const path = url.pathname;

  try {
    if (path === '/health' && req.method === 'GET') {
      try {
        await healthCheck();
        json(res, 200, { status: 'ok', typesense: 'connected' });
      } catch {
        json(res, 200, { status: 'ok', typesense: 'disconnected' });
      }
      return;
    }

    if (path === '/status' && req.method === 'GET') {
      try {
        const stats = await getCollectionStats();
        json(res, 200, {
          typesense: 'connected',
          collection: 'products',
          documents: stats.num_documents,
          created: new Date(stats.created_at * 1000).toISOString(),
        });
      } catch (err) {
        json(res, 503, { typesense: 'error', message: err.message });
      }
      return;
    }

    if (path === '/sync' && req.method === 'POST') {
      if (!authenticate(req)) {
        json(res, 401, { error: 'Unauthorized' });
        return;
      }

      const incremental = url.searchParams.get('mode') === 'watch';
      const syncResult = await runSync({ incremental });
      json(res, syncResult.status || 200, syncResult.result || syncResult);
      return;
    }

    json(res, 404, { error: 'Not found' });
  } catch (err) {
    console.error('Request error:', err.message);
    json(res, 500, { error: 'Internal server error' });
  }
});

const PORT = config.server.port;

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  if (isRailway) console.log('Railway environment detected');
});
