import Typesense from 'typesense';
import { config } from './config.js';

const COLLECTION_NAME = 'products';

// Tope de ids por filter_by en un delete, para no armar una URL desmedida.
const DELETE_BATCH_SIZE = 100;

// Borrados permitidos sin importar el tamaño del índice, para que la
// salvaguarda por porcentaje no estorbe en índices chicos de desarrollo.
const MIN_SAFE_DELETES = 50;

const SCHEMA = {
  name: COLLECTION_NAME,
  fields: [
    { name: 'id',              type: 'string'   },
    { name: 'title',           type: 'string'   },
    { name: 'handle',          type: 'string'   },
    { name: 'vendor',          type: 'string',  facet: true  },
    { name: 'product_type',    type: 'string',  facet: true  },
    { name: 'price',           type: 'int64'    },
    { name: 'price_max',       type: 'int64'    },
    { name: 'compare_at_price',type: 'int64',   optional: true },
    { name: 'price_range',     type: 'string',  facet: true  },
    { name: 'tags',            type: 'string[]', facet: true  },
    { name: 'sku',             type: 'string[]', optional: true },
    { name: 'url',             type: 'string',  index: false },
    { name: 'image',           type: 'string',  index: false },
    { name: 'description',     type: 'string',  optional: true },
    { name: 'available',       type: 'bool',    facet: true  },
    { name: 'inventory',       type: 'int32'    },
    { name: 'rating',          type: 'float',   optional: true },
    { name: 'reviews_count',   type: 'int32',   optional: true },
    { name: 'created_at',      type: 'int64'    },
    { name: 'updated_at',      type: 'int64'    },
  ],
  default_sorting_field: 'created_at',
};

let _client;

export function getClient() {
  if (!_client) {
    _client = new Typesense.Client({
      nodes: [{
        host:     config.typesense.host,
        port:     config.typesense.port,
        protocol: config.typesense.protocol,
      }],
      apiKey: config.typesense.apiKey,
      connectionTimeoutSeconds: 10,
    });
  }
  return _client;
}

export async function ensureCollection({ drop = false } = {}) {
  const client = getClient();

  if (drop) {
    try {
      await client.collections(COLLECTION_NAME).delete();
    } catch {
      // No existía, ok
    }
  }

  try {
    await client.collections(COLLECTION_NAME).retrieve();
  } catch {
    // No existe, crearla
    await client.collections().create(SCHEMA);
  }
}

export async function importDocuments(documents, { onProgress } = {}) {
  const client = getClient();
  const batchSize = 200;
  let imported = 0;
  let failed = 0;

  for (let i = 0; i < documents.length; i += batchSize) {
    const batch = documents.slice(i, i + batchSize);

    const results = await client
      .collections(COLLECTION_NAME)
      .documents()
      .import(batch, { action: 'upsert' });

    results.forEach(r => {
      if (r.success) imported++;
      else failed++;
    });

    if (onProgress) onProgress(imported, failed, documents.length);

    await new Promise(r => setTimeout(r, 100));
  }

  return { imported, failed };
}

export async function getCollectionStats() {
  const client = getClient();
  return client.collections(COLLECTION_NAME).retrieve();
}

export async function healthCheck() {
  const client = getClient();
  return client.health.retrieve();
}

/**
 * Devuelve los ids de todos los documentos del índice.
 * Usa export en vez de search para no toparse con el límite de paginación.
 */
export async function getAllDocumentIds() {
  const client = getClient();

  let jsonl;
  try {
    jsonl = await client.collections(COLLECTION_NAME).documents().export({ include_fields: 'id' });
  } catch (err) {
    if (err.name === 'ObjectNotFound') return [];
    throw err;
  }

  if (!jsonl) return [];

  return jsonl
    .split('\n')
    .filter(Boolean)
    .map(line => JSON.parse(line).id);
}

/**
 * Borra del índice los documentos que ya no están en `activeIds`, es decir los
 * productos despublicados, archivados o eliminados en Shopify.
 *
 * SOLO debe llamarse tras un sync completo: `activeIds` tiene que ser el
 * catálogo activo entero. Si se le pasa el delta de un sync incremental borra
 * todo lo demás.
 *
 * Aborta si la purga supera `maxDeleteRatio` del índice (con un mínimo absoluto
 * de MIN_SAFE_DELETES para no estorbar en índices pequeños). Un fetch de
 * Shopify que falle a la mitad devuelve pocos productos y se vería igual que un
 * catálogo que se vació de verdad; ante la duda no se borra.
 */
export async function purgeStaleDocuments(activeIds, { maxDeleteRatio = 0.03, force = false } = {}) {
  const client = getClient();

  if (!Array.isArray(activeIds) || activeIds.length === 0) {
    return { deleted: 0, aborted: true, reason: 'activeIds vacío — no se purga nada' };
  }

  const indexedIds = await getAllDocumentIds();
  const active = new Set(activeIds.map(String));
  const stale = indexedIds.filter(id => !active.has(String(id)));

  if (stale.length === 0) {
    return { deleted: 0, stale: 0, indexed: indexedIds.length };
  }

  const limit = Math.max(MIN_SAFE_DELETES, Math.floor(indexedIds.length * maxDeleteRatio));
  if (!force && stale.length > limit) {
    return {
      deleted: 0,
      stale: stale.length,
      indexed: indexedIds.length,
      aborted: true,
      reason: `${stale.length} borrados supera el límite de ${limit} (${maxDeleteRatio * 100}% del índice). Revisa que el fetch de Shopify haya sido completo; usa force para saltarte esto.`,
    };
  }

  let deleted = 0;
  for (let i = 0; i < stale.length; i += DELETE_BATCH_SIZE) {
    const batch = stale.slice(i, i + DELETE_BATCH_SIZE);
    const result = await client
      .collections(COLLECTION_NAME)
      .documents()
      .delete({ filter_by: `id:[${batch.join(',')}]` });
    deleted += result.num_deleted;
    await new Promise(r => setTimeout(r, 100));
  }

  return { deleted, stale: stale.length, indexed: indexedIds.length, ids: stale };
}
