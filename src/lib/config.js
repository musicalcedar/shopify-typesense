export const config = {
  shopify: {
    store: process.env.SHOPIFY_STORE,
    accessToken: process.env.SHOPIFY_ACCESS_TOKEN,
    apiVersion: process.env.SHOPIFY_API_VERSION || '2024-01',
  },
  typesense: {
    host: process.env.TYPESENSE_HOST || 'localhost',
    port: process.env.TYPESENSE_PORT || '8108',
    protocol: process.env.TYPESENSE_PROTOCOL || 'http',
    apiKey: process.env.TYPESENSE_API_KEY || 'dev-api-key',
  },
  docker: {
    containerName: 'typesense-local',
    volume: process.env.TYPESENSE_DOCKER_VOLUME || 'typesense-data',
    image: process.env.TYPESENSE_DOCKER_IMAGE || 'typesense/typesense:27.0',
  },
};

export function validateConfig() {
  const missing = [];
  if (!config.shopify.store) missing.push('SHOPIFY_STORE');
  if (!config.shopify.accessToken) missing.push('SHOPIFY_ACCESS_TOKEN');
  if (missing.length > 0) {
    throw new Error(`Variables de entorno faltantes: ${missing.join(', ')}\nCopia .env.example a .env y completa los valores.`);
  }
}
