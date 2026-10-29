import type { LoaderFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import { getShop } from "../models/shop.server";
import { listReviews, parseId, parseSort } from "../models/review.server";

// Storefront endpoint, reached through the app proxy:
// {shop}/apps/reviews/api/reviews -> {app_proxy.url}/api/reviews
const TEMPLATES = new Set(["grid", "carousel", "list"]);
const FREE_TEMPLATES = new Set(["grid"]);
const DEFAULT_COUNT = 20;
const MAX_COUNT = 20;

export const loader = async ({ request }: LoaderFunctionArgs) => {
  // Rejects requests without a valid app proxy signature.
  await authenticate.public.appProxy(request);

  const url = new URL(request.url);
  const shop = url.searchParams.get("shop");
  const record = shop ? await getShop(shop) : null;

  if (!shop || !record?.judgeMeToken) {
    return Response.json(
      { error: "Shop not configured. Please complete onboarding." },
      { status: 503 },
    );
  }

  const plan = record.plan === "pro" ? "pro" : "free";
  const requestedTemplate = url.searchParams.get("template") ?? "";
  const template = TEMPLATES.has(requestedTemplate) ? requestedTemplate : "grid";
  const upgradeRequired = plan === "free" && !FREE_TEMPLATES.has(template);
  const sort = parseSort(url.searchParams.get("sort"));

  const requestedCount = parseInt(url.searchParams.get("count") ?? "", 10);
  const count =
    Number.isInteger(requestedCount) && requestedCount > 0
      ? Math.min(requestedCount, MAX_COUNT)
      : DEFAULT_COUNT;

  const { reviews } = await listReviews(shop, plan, {
    productId: parseId(url.searchParams.get("productId")),
    sort,
    limit: count,
  });

  return Response.json({
    reviews,
    source: "cache",
    template: upgradeRequired ? "grid" : template,
    upgradeRequired,
    sort,
    plan,
  });
};
