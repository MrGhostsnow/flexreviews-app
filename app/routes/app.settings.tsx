import { useEffect, useState } from "react";
import type {
  ActionFunctionArgs,
  HeadersFunction,
  LoaderFunctionArgs,
} from "react-router";
import { useFetcher, useLoaderData } from "react-router";
import { useAppBridge } from "@shopify/app-bridge-react";
import { boundary } from "@shopify/shopify-app-react-router/server";
import db from "../db.server";
import { authenticate } from "../shopify.server";
import { getPricingPlansUrl, syncPlan } from "../lib/billing.server";
import { verifyJudgeMeToken } from "../lib/judgeme.server";
import { isSyncing, syncShop } from "../lib/sync.server";
import {
  disconnectJudgeMe,
  ensureShop,
  isSyncInterval,
  saveJudgeMeToken,
  setSyncInterval,
} from "../models/shop.server";
import { formatRelativeTime } from "../utils/format";

const SYNC_INTERVAL_OPTIONS = [
  { value: "60", label: "Every hour" },
  { value: "360", label: "Every 6 hours" },
  { value: "1440", label: "Every 24 hours" },
];

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  const shop = await ensureShop(session.shop);

  let plan = shop.plan;
  try {
    plan = await syncPlan(admin.graphql, session.shop);
  } catch (error) {
    console.error(`[billing] plan sync failed for ${session.shop}:`, error);
  }

  return {
    shopDomain: session.shop,
    connected: Boolean(shop.judgeMeToken),
    plan,
    reviewCount: await db.review.count({ where: { shop: session.shop } }),
    lastSyncedAt: shop.lastSyncedAt?.toISOString() ?? null,
    syncInterval: String(shop.syncInterval),
    syncing: isSyncing(session.shop),
  };
};

type ActionResult = { intent: string; ok: boolean; message: string };

export const action = async ({
  request,
}: ActionFunctionArgs): Promise<ActionResult | Response> => {
  const { admin, session, redirect } = await authenticate.admin(request);
  const shop = session.shop;
  const formData = await request.formData();
  const intent = String(formData.get("intent"));

  switch (intent) {
    case "connect": {
      const apiToken = String(formData.get("apiToken") ?? "").trim();
      if (!apiToken || !(await verifyJudgeMeToken(shop, apiToken))) {
        return { intent, ok: false, message: "Invalid token or shop domain" };
      }
      await saveJudgeMeToken(shop, apiToken);
      // First sync runs in the background; the page shows it as syncing.
      syncShop(shop).catch((error) =>
        console.error(`[sync] ${shop} initial sync failed:`, error),
      );
      return { intent, ok: true, message: "Judge.me connected" };
    }

    case "disconnect":
      await disconnectJudgeMe(shop);
      return { intent, ok: true, message: "Judge.me disconnected" };

    case "sync":
      try {
        const synced = await syncShop(shop);
        return { intent, ok: true, message: `${synced} reviews synced` };
      } catch (error) {
        console.error(`[sync] ${shop} failed:`, error);
        return { intent, ok: false, message: "Sync failed. Please try again." };
      }

    case "interval": {
      const interval = Number(formData.get("interval"));
      if (!isSyncInterval(interval)) {
        return { intent, ok: false, message: "Choose a valid interval" };
      }
      await setSyncInterval(shop, interval);
      return { intent, ok: true, message: "Sync interval saved" };
    }

    case "upgrade":
      try {
        // Shopify App Pricing: send the merchant to Shopify's hosted plan page.
        return redirect(await getPricingPlansUrl(admin.graphql, shop), {
          target: "_top",
        });
      } catch (error) {
        console.error(`[billing] upgrade failed for ${shop}:`, error);
        return { intent, ok: false, message: "Could not start the upgrade" };
      }

    default:
      return { intent, ok: false, message: "Unknown action" };
  }
};

export default function Settings() {
  const {
    shopDomain,
    connected,
    plan,
    reviewCount,
    lastSyncedAt,
    syncInterval,
    syncing,
  } = useLoaderData<typeof loader>();
  const fetcher = useFetcher<typeof action>();
  const shopify = useAppBridge();
  const [selectedInterval, setSelectedInterval] = useState(syncInterval);

  const pendingIntent =
    fetcher.state !== "idle" ? String(fetcher.formData?.get("intent")) : null;
  const result = fetcher.state === "idle" ? fetcher.data : undefined;

  useEffect(() => {
    if (!result) return;
    if (result.ok) {
      shopify.toast.show(result.message);
    } else if (result.intent !== "connect" && result.intent !== "upgrade") {
      shopify.toast.show(result.message, { isError: true });
    }
  }, [result, shopify]);

  const submit = (intent: string, fields: Record<string, string> = {}) =>
    fetcher.submit({ intent, ...fields }, { method: "POST" });

  const connectError =
    result && !result.ok && result.intent === "connect" ? result.message : null;
  const upgradeError =
    result && !result.ok && result.intent === "upgrade" ? result.message : null;

  return (
    <s-page heading="Settings">
      {connected ? (
        <s-section heading="Judge.me integration">
          <s-stack direction="inline" gap="small" alignItems="center">
            <s-badge tone="success">Connected</s-badge>
            <s-badge tone={plan === "pro" ? "success" : "neutral"}>
              {plan === "pro" ? "Pro plan" : "Free plan"}
            </s-badge>
          </s-stack>
          <s-paragraph>
            {reviewCount} review{reviewCount === 1 ? "" : "s"} synced · Last
            sync: {syncing ? "in progress" : formatRelativeTime(lastSyncedAt)}
          </s-paragraph>
          <s-stack direction="inline" gap="small">
            <s-button
              onClick={() => submit("sync")}
              loading={pendingIntent === "sync" || syncing}
              disabled={pendingIntent === "disconnect"}
            >
              {pendingIntent === "sync" || syncing ? "Syncing..." : "Force sync now"}
            </s-button>
            <s-button
              tone="critical"
              onClick={() => submit("disconnect")}
              loading={pendingIntent === "disconnect"}
              disabled={pendingIntent === "sync"}
            >
              Disconnect
            </s-button>
          </s-stack>
        </s-section>
      ) : (
        <ConnectSection
          shopDomain={shopDomain}
          connecting={pendingIntent === "connect"}
          error={connectError}
          onConnect={(apiToken) => submit("connect", { apiToken })}
        />
      )}

      {connected && (
        <s-section heading="Auto-sync interval">
          <s-select
            label="Auto-sync interval"
            value={selectedInterval}
            onChange={(event) =>
              setSelectedInterval(event.currentTarget.value)
            }
          >
            {SYNC_INTERVAL_OPTIONS.map((option) => (
              <s-option key={option.value} value={option.value}>
                {option.label}
              </s-option>
            ))}
          </s-select>
          <s-button
            onClick={() => submit("interval", { interval: selectedInterval })}
            loading={pendingIntent === "interval"}
          >
            Save
          </s-button>
          <s-paragraph>
            Current interval:{" "}
            {SYNC_INTERVAL_OPTIONS.find((option) => option.value === syncInterval)
              ?.label ?? "Every hour"}
          </s-paragraph>
        </s-section>
      )}

      {plan === "free" ? (
        <s-section heading="Your plan">
          <s-badge tone="neutral">Free plan</s-badge>
          <s-paragraph>
            Included in Free: Grid layout, basic customization, sync up to 100
            reviews.
          </s-paragraph>
          <s-paragraph>
            Upgrade to Pro for $11.99/month to unlock Carousel and List layouts,
            unlimited reviews, and priority support. Includes a 7-day free
            trial.
          </s-paragraph>
          <s-button
            variant="primary"
            onClick={() => submit("upgrade")}
            loading={pendingIntent === "upgrade"}
          >
            Upgrade to Pro — $11.99/month
          </s-button>
          {upgradeError && (
            <s-banner tone="critical" heading="Couldn't start upgrade">
              {upgradeError}
            </s-banner>
          )}
        </s-section>
      ) : (
        <s-section heading="Your plan">
          <s-badge tone="success">Pro plan</s-badge>
          <s-paragraph>You have access to all FlexReviews features.</s-paragraph>
        </s-section>
      )}
    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};

// Unmounts once the shop is connected, which also clears the typed token.
function ConnectSection({
  shopDomain,
  connecting,
  error,
  onConnect,
}: {
  shopDomain: string;
  connecting: boolean;
  error: string | null;
  onConnect: (apiToken: string) => void;
}) {
  const [apiToken, setApiToken] = useState("");

  return (
    <s-section heading="Connect Judge.me">
      <s-text-field
        label="Private API Token"
        placeholder="Paste your Judge.me Private API Token"
        value={apiToken}
        onInput={(event) => setApiToken(event.currentTarget.value)}
        required
      />
      <s-text-field label="Shop domain" value={shopDomain} disabled />
      <s-paragraph>
        Find your token in Judge.me → Settings → Integrations → View API tokens
      </s-paragraph>
      <s-button
        variant="primary"
        onClick={() => onConnect(apiToken)}
        loading={connecting}
        disabled={!apiToken}
      >
        Connect Judge.me
      </s-button>
      {error && (
        <s-banner tone="critical" heading="Couldn't connect to Judge.me">
          {error}
        </s-banner>
      )}
    </s-section>
  );
}
