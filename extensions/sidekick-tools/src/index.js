const RECENT_REVIEWS_LIMIT = 5;

// Relative paths resolve against the app's application_url, so this follows
// the app between dev tunnels and production. The backend identifies the shop
// from the session token, so no shopDomain query param is needed here.
async function apiRequest(path) {
  let headers = {'Content-Type': 'application/json'};
  try {
    const token = await shopify.auth.idToken();
    if (token) headers = {...headers, Authorization: `Bearer ${token}`};
  } catch (_) {
    // Fall through without auth; the server will reject if it requires it.
  }

  const response = await fetch(path, {headers});
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.error || `Request failed with status ${response.status}`);
  }

  return data;
}

// Sidekick may pass either a numeric ID or a GID like "gid://shopify/Product/123".
function toNumericProductId(productId) {
  if (!productId) return null;
  const match = String(productId).match(/(\d+)\s*$/);
  return match ? match[1] : null;
}

export default async function extension() {
  shopify.tools.register('get_review_summary', async (input) => {
    const productId = toNumericProductId(input?.product_id);

    const reviewParams = new URLSearchParams({
      sort: 'recent',
      limit: String(RECENT_REVIEWS_LIMIT),
    });
    if (productId) reviewParams.set('productId', productId);

    const [stats, recent] = await Promise.all([
      apiRequest('/api/admin/stats'),
      apiRequest(`/api/admin/reviews?${reviewParams.toString()}`),
    ]);

    return {
      store: {
        totalReviews: stats.total,
        averageRating: stats.averageRating,
        ratingDistribution: stats.distribution,
        lastSyncedAt: stats.lastSyncedAt,
      },
      product: productId ? {productId, totalReviews: recent.total} : null,
      recentReviews: (recent.reviews ?? []).map((review) => ({
        id: String(review.id),
        productId: review.productExternalId,
        rating: review.rating,
        title: review.title,
        body: review.body,
        reviewerName: review.reviewerName,
        createdAt: review.createdAt,
      })),
    };
  });
}
