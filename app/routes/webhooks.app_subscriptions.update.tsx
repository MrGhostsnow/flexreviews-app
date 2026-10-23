import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import { syncPlan } from "../lib/billing.server";
import { setPlan } from "../models/shop.server";

// One event describes one subscription, not the shop's current plan: switching
// plans sends CANCELLED for the old subscription while a new one is active.
// Ask Shopify for the full picture instead of trusting the payload.
export const action = async ({ request }: ActionFunctionArgs) => {
  const { shop, topic, admin, payload } = await authenticate.webhook(request);
  const status = payload?.app_subscription?.status;

  console.log(`Received ${topic} webhook for ${shop}: ${status}`);

  if (admin) {
    try {
      await syncPlan(admin.graphql, shop);
      return new Response();
    } catch (error) {
      console.error(`[billing] plan sync failed for ${shop}:`, error);
    }
  }

  // Without a usable token only an ACTIVE event is safe to trust; anything
  // else is resynced the next time the merchant opens the app.
  if (status === "ACTIVE") {
    await setPlan(shop, "pro");
  }

  return new Response();
};
