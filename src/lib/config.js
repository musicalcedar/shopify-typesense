export const isRailway = !!process.env.RAILWAY_ENVIRONMENT;

function parseTypesenseConnection() {
  const url = process.env.TYPESENSE_URL;
  if (url) {
    const parsed = new URL(url);
    return {
      host: parsed.hostname,
      port: parsed.port || '8108',
      protocol: parsed.protocol.replace(':', ''),
    };
  }
  return {
    host: process.env.TYPESENSE_HOST || 'localhost',
    port: process.env.TYPESENSE_PORT || '8108',
    protocol: process.env.TYPESENSE_PROTOCOL || 'http',
  };
}

export const config = {
  shopify: {
    store: process.env.SHOPIFY_STORE,
    accessToken: process.env.SHOPIFY_ACCESS_TOKEN,
    apiVersion: process.env.SHOPIFY_API_VERSION || '2024-01',
  },
  typesense: {
    ...parseTypesenseConnection(),
    apiKey: process.env.TYPESENSE_API_KEY,
  },
  docker: {
    containerName: 'typesense-local',
    volume: process.env.TYPESENSE_DOCKER_VOLUME || 'typesense-data',
    image: process.env.TYPESENSE_DOCKER_IMAGE || 'typesense/typesense:27.0',
  },
  server: {
    port: parseInt(process.env.PORT || '3000', 10),
    syncSecret: process.env.SYNC_SECRET,
  },
};

export function validateConfig() {
  const missing = [];
  if (!config.shopify.store) missing.push('SHOPIFY_STORE');
  if (!config.shopify.accessToken) missing.push('SHOPIFY_ACCESS_TOKEN');
  if (!config.typesense.apiKey) missing.push('TYPESENSE_API_KEY');
  if (missing.length > 0) {
    throw new Error(`Variables de entorno faltantes: ${missing.join(', ')}\nCopia .env.example a .env y completa los valores.`);
  }
}
