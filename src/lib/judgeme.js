import { config } from './config.js';

export async function getAllReviews() {
  const { apiToken, shopDomain } = config.judgeme;
  if (!apiToken || !shopDomain) return new Map();

  const ratings = new Map();
  let page = 1;

  while (true) {
    const url = `https://judge.me/api/v1/reviews?api_token=${encodeURIComponent(apiToken)}&shop_domain=${encodeURIComponent(shopDomain)}&per_page=100&page=${page}`;
    const res = await fetch(url);

    if (!res.ok) {
      console.warn('[judgeme] API error:', res.status, await res.text());
      break;
    }

    const data = await res.json();
    const reviews = data.reviews || [];
    if (reviews.length === 0) break;

    for (const review of reviews) {
      const productId = String(review.product_external_id);
      if (!productId) continue;

      const entry = ratings.get(productId) || { total: 0, count: 0 };
      entry.total += review.rating;
      entry.count += 1;
      ratings.set(productId, entry);
    }

    page++;
    await new Promise(r => setTimeout(r, 250));
  }

  const result = new Map();
  for (const [id, { total, count }] of ratings) {
    result.set(id, {
      rating: Math.round((total / count) * 100) / 100,
      reviews_count: count,
    });
  }

  console.log('[judgeme] Fetched ratings for', result.size, 'products');
  return result;
}
