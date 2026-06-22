import Typesense from 'typesense';
import { config } from './config.js';

const COLLECTION_NAME = 'products';

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
