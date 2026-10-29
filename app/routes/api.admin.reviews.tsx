import type { LoaderFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import { getShop } from "../models/shop.server";
import { listReviews, parseId, parseSort } from "../models/review.server";

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;

// Paginated review list for admin extensions (sidekick-tools).
export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session, cors } = await authenticate.admin(request);
  const url = new URL(request.url);

  const page = Math.max(1, parseInt(url.searchParams.get("page") ?? "", 10) || 1);
  const requestedLimit = parseInt(url.searchParams.get("limit") ?? "", 10);
  const limit =
    Number.isInteger(requestedLimit) && requestedLimit > 0
      ? Math.min(requestedLimit, MAX_LIMIT)
      : DEFAULT_LIMIT;
  const rating = parseInt(url.searchParams.get("rating") ?? "", 10);

  const shop = await getShop(session.shop);
  const { reviews, total } = await listReviews(session.shop, shop?.plan ?? "free", {
    productId: parseId(url.searchParams.get("productId")),
    rating: rating >= 1 && rating <= 5 ? rating : undefined,
    search: url.searchParams.get("search")?.trim() || undefined,
    sort: parseSort(url.searchParams.get("sort")),
    limit,
    offset: (page - 1) * limit,
  });

  return cors(
    Response.json({
      reviews,
      total,
      page,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    }),
  );
};
