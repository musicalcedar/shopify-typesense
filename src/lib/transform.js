function stripHtml(html) {
  return (html || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

function getPriceRange(priceInCents) {
  if (priceInCents >= 100000000) return 'Más de $1.000.000';
  if (priceInCents >= 50000000)  return '$500.000 - $1.000.000';
  if (priceInCents >= 20000000)  return '$200.000 - $500.000';
  if (priceInCents >= 10000000)  return '$100.000 - $200.000';
  return 'Menos de $100.000';
}

export function transformProduct(product, ratingsMap) {
  const variants = product.variants.edges.map(e => e.node);

  if (variants.length === 0) return null;

  // Precio mínimo y máximo de todas las variantes
  const prices = variants.map(v => Math.round(parseFloat(v.price) * 100));
  const compareAtPrices = variants
    .map(v => v.compareAtPrice ? Math.round(parseFloat(v.compareAtPrice) * 100) : null)
    .filter(Boolean);

  const priceMin = Math.min(...prices);
  const priceMax = Math.max(...prices);
  const compareAtPrice = compareAtPrices.length > 0 ? Math.max(...compareAtPrices) : 0;

  // SKUs de todas las variantes (para búsqueda por código)
  const skus = [...new Set(variants.map(v => v.sku).filter(Boolean))];

  // Disponibilidad: disponible si al menos una variante está disponible
  const available = variants.some(v => v.availableForSale);
  const inventory = variants.reduce((sum, v) => sum + (v.inventoryQuantity || 0), 0);

  const numericId = product.id.split('/').pop();
  const image = product.images.edges[0]?.node.url || '';
  const description = stripHtml(product.descriptionHtml);

  const doc = {
    id: numericId,
    title: product.title,
    handle: product.handle,
    vendor: product.vendor || '',
    product_type: product.productType || '',
    price: priceMin,
    price_max: priceMax,
    compare_at_price: compareAtPrice,
    price_range: getPriceRange(priceMin),
    tags: product.tags || [],
    sku: skus,
    url: `/products/${product.handle}`,
    image,
    description,
    available,
    inventory,
    created_at: new Date(product.createdAt).getTime(),
    updated_at: new Date(product.updatedAt).getTime(),
  };

  const reviewData = ratingsMap?.get(numericId);
  if (reviewData) {
    doc.rating = reviewData.rating;
    doc.reviews_count = reviewData.reviews_count;
  }

  return doc;
}
