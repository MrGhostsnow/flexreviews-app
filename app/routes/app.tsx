import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import {
  isRouteErrorResponse,
  Outlet,
  useLoaderData,
  useRouteError,
} from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { AppProvider } from "@shopify/shopify-app-react-router/react";

import { authenticate } from "../shopify.server";
import { ensureShop } from "../models/shop.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  await ensureShop(session.shop);

  // eslint-disable-next-line no-undef
  return { apiKey: process.env.SHOPIFY_API_KEY || "" };
};

export default function App() {
  const { apiKey } = useLoaderData<typeof loader>();

  return (
    <AppProvider apiKey={apiKey}>
      <s-app-nav>
        <s-link href="/app">Dashboard</s-link>
        <s-link href="/app/reviews">Reviews</s-link>
        <s-link href="/app/settings">Settings</s-link>
      </s-app-nav>
      <Outlet />
    </AppProvider>
  );
}

// Shopify needs React Router to catch some thrown responses, so that their headers are included in the response.
// Anything else (a failed fetch while the server restarts, a dropped
// connection) gets a recoverable message instead of the bare error screen.
export function ErrorBoundary() {
  const error = useRouteError();
  if (isRouteErrorResponse(error)) {
    return boundary.error(error);
  }

  console.error(error);
  return (
    <div style={{ fontFamily: "Inter, sans-serif", padding: "48px 16px", textAlign: "center" }}>
      <h1 style={{ fontSize: "20px", margin: "0 0 8px" }}>
        Something went wrong while loading FlexReviews
      </h1>
      <p style={{ color: "#616161", margin: "0 0 24px" }}>
        This is usually a temporary connection problem. Reloading the page
        fixes it.
      </p>
      <button
        type="button"
        onClick={() => window.location.reload()}
        style={{
          background: "#303030",
          border: "none",
          borderRadius: "8px",
          color: "#fff",
          cursor: "pointer",
          fontSize: "14px",
          padding: "8px 16px",
        }}
      >
        Reload
      </button>
    </div>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
