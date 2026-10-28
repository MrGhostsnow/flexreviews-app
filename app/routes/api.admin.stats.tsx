import type { LoaderFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import { getShop } from "../models/shop.server";
import { getReviewStats } from "../models/review.server";
import { isSyncing } from "../lib/sync.server";

// Review stats for admin extensions (sidekick-tools).
export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session, cors } = await authenticate.admin(request);
  const [stats, shop] = await Promise.all([
    getReviewStats(session.shop),
    getShop(session.shop),
  ]);

  return cors(
    Response.json({
      ...stats,
      lastSyncedAt: shop?.lastSyncedAt?.toISOString() ?? null,
      syncStatus: isSyncing(session.shop) ? "syncing" : "idle",
    }),
  );
};
