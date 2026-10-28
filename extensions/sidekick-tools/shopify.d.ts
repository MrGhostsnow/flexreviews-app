import '@shopify/ui-extensions';

//@ts-ignore
declare module './src/index.js' {
  interface GetReviewSummaryInput {
    /**
     * Optional product ID to filter reviews for a specific product
     */
    product_id?: string;
    [k: string]: unknown;
  }

  type GetReviewSummaryOutput = unknown;
  interface ShopifyTools {
    /**
     * Get a summary of product reviews for this store, including total count, average rating, and recent reviews.
     */
    register(
      name: 'get_review_summary',
      handler: (
        input: GetReviewSummaryInput,
      ) => GetReviewSummaryOutput | Promise<GetReviewSummaryOutput>,
    ): () => void;
  }

  const shopify: import('@shopify/ui-extensions/admin').WithGeneratedTools<
    import('@shopify/ui-extensions/admin.app.tools.data').Api,
    ShopifyTools
  >;
  const globalThis: { shopify: typeof shopify };
}
