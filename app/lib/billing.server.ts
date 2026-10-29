import type { AdminGraphqlClient } from "@shopify/shopify-app-react-router/server";
import { setPlan, type Plan } from "../models/shop.server";

// The app uses Shopify App Pricing: merchants pick a plan on Shopify's hosted
// page, and the plan is read back from the app installation's subscriptions.
export async function syncPlan(graphql: AdminGraphqlClient, shop: string) {
  const response = await graphql(
    `#graphql
      query FlexReviewsActiveSubscriptions {
        currentAppInstallation {
          activeSubscriptions {
            name
            status
          }
        }
      }`,
  );
  const { data } = await response.json();
  const subscriptions: { name: string; status: string }[] =
    data?.currentAppInstallation?.activeSubscriptions ?? [];

  // Any active paid subscription means Pro; a "Free" managed plan doesn't count.
  const plan: Plan = subscriptions.some(
    (subscription) =>
      subscription.status === "ACTIVE" && !/^free$/i.test(subscription.name),
  )
    ? "pro"
    : "free";

  await setPlan(shop, plan);
  return plan;
}

// Admin path of Shopify's hosted plan selection page. The library's redirect
// turns shopify://admin/ paths into the store's admin URL.
export async function getPricingPlansUrl(graphql: AdminGraphqlClient) {
  const response = await graphql(
    `#graphql
      query FlexReviewsAppHandle {
        currentAppInstallation {
          app {
            handle
          }
        }
      }`,
  );
  const { data } = await response.json();
  const appHandle = data?.currentAppInstallation?.app?.handle;
  if (!appHandle) {
    throw new Error("Could not read the app handle");
  }

  return `shopify://admin/charges/${appHandle}/pricing_plans`;
}
