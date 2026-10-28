## When to Use This App's Tools

Use `get_review_summary` when the merchant asks about:

- How many product reviews the store has
- The store's average star rating or rating distribution
- Recent reviews, for the whole store or for a specific product

## Important Guidelines

- Pass `product_id` only when the merchant asks about a specific product. Both numeric IDs and `gid://shopify/Product/...` IDs are accepted.
- `store` stats are always store-wide. When `product_id` is given, `product.totalReviews` is the count for that product and `recentReviews` is filtered to it.
