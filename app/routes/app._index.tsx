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
import {
  loadSampleReviews,
  removeSampleReviews,
} from "../models/sample-reviews.server";
import { ensureShop } from "../models/shop.server";
import {
  countSyncedReviews,
  getReviewStats,
  listReviews,
} from "../models/review.server";
import { FREE_PLAN_REVIEW_LIMIT } from "../utils/plans";
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
  const demoMode = !connected && shop.demoMode;
  const [stats, recent, syncedCount] = connected || demoMode
    ? await Promise.all([
        getReviewStats(session.shop, plan),
        listReviews(session.shop, plan, { sort: "recent", limit: 5 }),
        countSyncedReviews(session.shop),
      ])
    : [null, null, 0];

  return {
    connected,
    demoMode,
    plan,
    stats,
    recentReviews: recent?.reviews ?? [],
    syncedCount,
    lastSyncedAt: shop.lastSyncedAt?.toISOString() ?? null,
    syncing: isSyncing(session.shop),
  };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const intent = String((await request.formData()).get("intent") ?? "sync");

  if (intent === "load-samples") {
    const count = await loadSampleReviews(session.shop);
    return { message: `${count} sample reviews added`, error: null };
  }
  if (intent === "remove-samples") {
    await removeSampleReviews(session.shop);
    return { message: "Sample reviews removed", error: null };
  }

  try {
    const synced = await syncShop(session.shop);
    return { message: `${synced} reviews synced`, error: null };
  } catch (error) {
    console.error(`[sync] ${session.shop} failed:`, error);
    return { message: null, error: "Sync failed. Please try again." };
  }
};

export default function Dashboard() {
  const {
    connected,
    demoMode,
    plan,
    stats,
    recentReviews,
    syncedCount,
    lastSyncedAt,
    syncing,
  } = useLoaderData<typeof loader>();
  const fetcher = useFetcher<typeof action>();
  const shopify = useAppBridge();
  const pendingIntent =
    fetcher.state !== "idle" ? String(fetcher.formData?.get("intent")) : null;
  const submit = (intent: string) =>
    fetcher.submit({ intent }, { method: "POST" });

  useEffect(() => {
    if (fetcher.data?.message) {
      shopify.toast.show(fetcher.data.message);
    } else if (fetcher.data?.error) {
      shopify.toast.show(fetcher.data.error, { isError: true });
    }
  }, [fetcher.data, shopify]);

  if (!connected && !demoMode) {
    return (
      <s-page heading="Dashboard">
        <s-section>
          <s-banner
            tone="info"
            heading="Connect your Judge.me account to get started"
          >
            Sync your existing reviews and display them with full layout
            freedom. No Judge.me account yet? Try the app with sample reviews.
          </s-banner>
          <s-stack direction="inline" gap="small">
            <s-button variant="primary" href="/app/settings">
              Connect Judge.me
            </s-button>
            <s-button
              onClick={() => submit("load-samples")}
              loading={pendingIntent === "load-samples"}
            >
              Try with sample reviews
            </s-button>
          </s-stack>
        </s-section>
      </s-page>
    );
  }

  const total = stats?.total ?? 0;
  const average = stats?.averageRating ?? 0;
  const distribution = stats?.distribution;

  return (
    <s-page heading="Dashboard">
      {demoMode ? (
        <s-banner tone="info" heading="You're viewing sample reviews">
          Sample reviews show in the admin and in the theme editor preview
          only; shoppers never see them. Connect Judge.me to show your real
          reviews.
          <s-stack direction="inline" gap="small">
            <s-button variant="primary" href="/app/settings">
              Connect Judge.me
            </s-button>
            <s-button
              onClick={() => submit("remove-samples")}
              loading={pendingIntent === "remove-samples"}
            >
              Remove sample reviews
            </s-button>
          </s-stack>
        </s-banner>
      ) : (
        <s-button
          slot="primary-action"
          onClick={() => submit("sync")}
          loading={pendingIntent === "sync" || syncing}
        >
          {pendingIntent === "sync" || syncing ? "Syncing..." : "Force sync now"}
        </s-button>
      )}

      {plan !== "pro" && syncedCount > FREE_PLAN_REVIEW_LIMIT && (
        <s-banner tone="warning" heading="Free plan review limit reached">
          Your store has {syncedCount} reviews, and the Free plan shows the{" "}
          {FREE_PLAN_REVIEW_LIMIT} most recent. Upgrade to Pro in Settings to
          show all of them.
        </s-banner>
      )}

      <s-section>
        <s-grid gridTemplateColumns="1fr 1fr" gap="base">
          <s-stack direction="block" gap="small-200">
            <s-heading>Total reviews</s-heading>
            <s-heading>{total}</s-heading>
            <s-paragraph>
              {demoMode
                ? "Sample data"
                : `Last sync: ${formatRelativeTime(lastSyncedAt)}`}
            </s-paragraph>
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
          {demoMode ? (
            <s-badge tone="info">Sample reviews</s-badge>
          ) : (
            <s-badge tone="success">Connected</s-badge>
          )}
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
