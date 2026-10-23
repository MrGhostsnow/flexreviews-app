import { useEffect } from "react";
import type {
  ActionFunctionArgs,
  HeadersFunction,
  LoaderFunctionArgs,
} from "react-router";
import { useFetcher, useLoaderData } from "react-router";
import { useAppBridge } from "@shopify/app-bridge-react";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import { syncPlan } from "../lib/billing.server";
import { isSyncing, syncShop } from "../lib/sync.server";
import { ensureShop } from "../models/shop.server";
import { getReviewStats, listReviews } from "../models/review.server";
import { formatRelativeTime, formatStars } from "../utils/format";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  const shop = await ensureShop(session.shop);

  let plan = shop.plan;
  try {
    plan = await syncPlan(admin.graphql, session.shop);
  } catch (error) {
    console.error(`[billing] plan sync failed for ${session.shop}:`, error);
  }

  const connected = Boolean(shop.judgeMeToken);
  const [stats, recent] = connected
    ? await Promise.all([
        getReviewStats(session.shop),
        listReviews(session.shop, { sort: "recent", limit: 5 }),
      ])
    : [null, null];

  return {
    connected,
    plan,
    stats,
    recentReviews: recent?.reviews ?? [],
    lastSyncedAt: shop.lastSyncedAt?.toISOString() ?? null,
    syncing: isSyncing(session.shop),
  };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  try {
    const synced = await syncShop(session.shop);
    return { synced, error: null };
  } catch (error) {
    console.error(`[sync] ${session.shop} failed:`, error);
    return { synced: null, error: "Sync failed. Please try again." };
  }
};

export default function Dashboard() {
  const { connected, plan, stats, recentReviews, lastSyncedAt, syncing } =
    useLoaderData<typeof loader>();
  const fetcher = useFetcher<typeof action>();
  const shopify = useAppBridge();
  const isSubmitting = fetcher.state !== "idle";

  useEffect(() => {
    if (fetcher.data?.synced != null) {
      shopify.toast.show(`${fetcher.data.synced} reviews synced`);
    } else if (fetcher.data?.error) {
      shopify.toast.show(fetcher.data.error, { isError: true });
    }
  }, [fetcher.data, shopify]);

  if (!connected) {
    return (
      <s-page heading="Dashboard">
        <s-section>
          <s-banner
            tone="info"
            heading="Connect your Judge.me account to get started"
          >
            Sync your existing reviews and display them with full layout
            freedom.
          </s-banner>
          <s-button variant="primary" href="/app/settings">
            Connect Judge.me
          </s-button>
        </s-section>
      </s-page>
    );
  }

  const total = stats?.total ?? 0;
  const average = stats?.averageRating ?? 0;
  const distribution = stats?.distribution;

  return (
    <s-page heading="Dashboard">
      <s-button
        slot="primary-action"
        onClick={() => fetcher.submit({}, { method: "POST" })}
        loading={isSubmitting || syncing}
      >
        {isSubmitting || syncing ? "Syncing..." : "Force sync now"}
      </s-button>

      <s-section>
        <s-grid gridTemplateColumns="1fr 1fr" gap="base">
          <s-stack direction="block" gap="small-200">
            <s-heading>Total reviews</s-heading>
            <s-heading>{total}</s-heading>
            <s-paragraph>Last sync: {formatRelativeTime(lastSyncedAt)}</s-paragraph>
          </s-stack>
          <s-stack direction="block" gap="small-200">
            <s-heading>Average rating</s-heading>
            <s-heading>{average.toFixed(1)} / 5 ★</s-heading>
            <s-paragraph>across all reviews</s-paragraph>
          </s-stack>
        </s-grid>
      </s-section>

      <s-section heading="Rating breakdown">
        <s-stack direction="block" gap="small-300">
          {([5, 4, 3, 2, 1] as const).map((rating) => {
            const count = distribution?.[rating] ?? 0;
            const percent = total > 0 ? Math.round((count / total) * 100) : 0;
            return (
              <s-stack key={rating} direction="inline" gap="base" alignItems="center">
                <s-paragraph>{rating} ★</s-paragraph>
                <s-paragraph>
                  {count} ({percent}%)
                </s-paragraph>
              </s-stack>
            );
          })}
        </s-stack>
      </s-section>

      <s-section heading="Recent reviews">
        <s-stack direction="block" gap="base">
          {recentReviews.length === 0 && (
            <s-paragraph>No reviews synced yet.</s-paragraph>
          )}
          {recentReviews.map((review) => {
            const body = review.body ?? "";
            return (
              <s-box
                key={review.id}
                padding="base"
                borderWidth="base"
                borderColor="base"
                borderRadius="base"
              >
                <s-stack direction="block" gap="small-200">
                  <s-paragraph>
                    {formatStars(review.rating)} —{" "}
                    {review.reviewerName ?? "Anonymous"}
                  </s-paragraph>
                  <s-paragraph>
                    {body.slice(0, 150)}
                    {body.length > 150 ? "..." : ""}
                  </s-paragraph>
                </s-stack>
              </s-box>
            );
          })}
        </s-stack>
        <s-link href="/app/reviews">View all reviews →</s-link>
      </s-section>

      <s-section>
        <s-stack direction="inline" gap="small" alignItems="center">
          <s-badge tone="success">Connected</s-badge>
          <s-badge tone={plan === "pro" ? "success" : "neutral"}>
            {plan === "pro" ? "Pro plan" : "Free plan"}
          </s-badge>
        </s-stack>
      </s-section>
    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
