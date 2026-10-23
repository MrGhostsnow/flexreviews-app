import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import { deleteShopData } from "../models/shop.server";

// Mandatory compliance topics: customers/data_request, customers/redact and
// shop/redact. The app stores no customer records of its own, so only
// shop/redact deletes data.
export const action = async ({ request }: ActionFunctionArgs) => {
  const { shop, topic } = await authenticate.webhook(request);
  const normalizedTopic = String(topic).toUpperCase().replace("/", "_");

  console.log(`Received ${topic} webhook for ${shop}`);

  if (normalizedTopic === "SHOP_REDACT") {
    await deleteShopData(shop);
  }

  return new Response();
};
