import { createAdminApiClient } from '@shopify/admin-api-client';
import { config } from './config.js';

let client;

function getClient() {
  if (!client) {
    client = createAdminApiClient({
      storeDomain: config.shopify.store,
      apiVersion: config.shopify.apiVersion,
      accessToken: config.shopify.accessToken,
    });
  }
  return client;
}

const PRODUCTS_QUERY = `
  query GetProducts($cursor: String, $query: String) {
    products(first: 250, after: $cursor, query: $query) {
      pageInfo {
        hasNextPage
        endCursor
      }
      edges {
        node {
          id
          title
          handle
          vendor
          productType
          tags
          descriptionHtml
          createdAt
          updatedAt
          images(first: 1) {
            edges {
              node { url }
            }
          }
          metafields(first: 1, keys: ["judgeme.review_widget_data"]) {
            edges {
              node {
                key
                value
              }
            }
          }
          variants(first: 100) {
            edges {
              node {
                sku
                price
                compareAtPrice
                inventoryQuantity
                availableForSale
              }
            }
          }
        }
      }
    }
  }
`;

export async function getAllProducts({ onProgress, updatedAfter } = {}) {
  const shopify = getClient();
  const allProducts = [];
  let hasNextPage = true;
  let cursor = null;
  let page = 0;

  // Modo incremental: solo productos actualizados recientemente
  const query = updatedAfter
    ? `status:active AND updated_at:>='${updatedAfter.toISOString()}'`
    : `status:active`;

  while (hasNextPage) {
    page++;

    const response = await shopify.request(PRODUCTS_QUERY, {
      variables: { cursor, query },
    });

    if (response.errors) {
      throw new Error(`Shopify API error: ${JSON.stringify(response.errors)}`);
    }

    const { products } = response.data;
    const items = products.edges.map(e => e.node);
    allProducts.push(...items);

    hasNextPage = products.pageInfo.hasNextPage;
    cursor = products.pageInfo.endCursor;

    if (onProgress) onProgress(allProducts.length, page);

    // Rate limiting respetuoso
    await new Promise(r => setTimeout(r, 250));
  }

  return allProducts;
}
