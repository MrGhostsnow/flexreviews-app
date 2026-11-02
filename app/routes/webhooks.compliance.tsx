import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import { deleteShopData } from "../models/shop.server";
import {
  countCustomerReviews,
  redactCustomer,
  type ComplianceCustomer,
} from "../models/customer.server";

// Mandatory compliance topics: customers/data_request, customers/redact and
// shop/redact. The only customer data the app holds are reviews synced from
// Judge.me, matched by Shopify customer id or a hash of the email.
export const action = async ({ request }: ActionFunctionArgs) => {
  const { shop, topic, payload } = await authenticate.webhook(request);
  const normalizedTopic = String(topic).toUpperCase().replace("/", "_");
  const customer = (payload?.customer ?? {}) as ComplianceCustomer;

  console.log(`Received ${topic} webhook for ${shop}`);

  switch (normalizedTopic) {
    case "CUSTOMERS_DATA_REQUEST": {
      // The reviews themselves live in Judge.me, which answers the merchant's
      // data request; this records what the app's cache holds.
      const count = await countCustomerReviews(shop, customer);
      console.log(
        `[compliance] ${shop}: data request for customer ${customer.id ?? "?"}, ${count} cached reviews`,
      );
      break;
    }

    case "CUSTOMERS_REDACT": {
      const deleted = await redactCustomer(shop, customer);
      console.log(
        `[compliance] ${shop}: redacted customer ${customer.id ?? "?"}, ${deleted} reviews deleted`,
      );
      break;
    }

    case "SHOP_REDACT":
      await deleteShopData(shop);
      break;
  }

  return new Response();
};
