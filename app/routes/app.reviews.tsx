import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { useLoaderData, useNavigation, useSearchParams } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import { listReviews, parseSort } from "../models/review.server";
import { formatRelativeTime, formatStars } from "../utils/format";

const PAGE_SIZE = 20;
const RATINGS = [null, 5, 4, 3, 2, 1] as const; // null = All
const SORT_OPTIONS = [
  { value: "recent", label: "Most recent" },
  { value: "highest", label: "Highest rated" },
  { value: "lowest", label: "Lowest rated" },
];

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const url = new URL(request.url);

  const page = Math.max(1, parseInt(url.searchParams.get("page") ?? "", 10) || 1);
  const ratingParam = parseInt(url.searchParams.get("rating") ?? "", 10);
  const rating = ratingParam >= 1 && ratingParam <= 5 ? ratingParam : null;
  const sort = parseSort(url.searchParams.get("sort"));

  const { reviews, total } = await listReviews(session.shop, {
    rating: rating ?? undefined,
    sort,
    limit: PAGE_SIZE,
    offset: (page - 1) * PAGE_SIZE,
  });

  return {
    reviews,
    page,
    rating,
    sort,
    totalPages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
  };
};

export default function Reviews() {
  const { reviews, page, rating, sort, totalPages } =
    useLoaderData<typeof loader>();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigation = useNavigation();
  const loading = navigation.state === "loading";

  // Changing a filter resets to the first page.
  const updateParams = (changes: Record<string, string | null>) => {
    const next = new URLSearchParams(searchParams);
    for (const [key, value] of Object.entries(changes)) {
      if (value === null) next.delete(key);
      else next.set(key, value);
    }
    setSearchParams(next);
  };

  return (
    <s-page heading="Reviews">
      <s-section heading="Filters">
        <s-stack direction="inline" gap="small" alignItems="center">
          {RATINGS.map((value) => (
            <s-button
              key={value ?? "all"}
              variant={rating === value ? "primary" : "secondary"}
              onClick={() =>
                updateParams({ rating: value ? String(value) : null, page: null })
              }
            >
              {value === null ? "All" : `${value}★`}
            </s-button>
          ))}
        </s-stack>
        <s-select
          label="Sort"
          value={sort}
          onChange={(event) =>
            updateParams({
              sort: event.currentTarget.value,
              page: null,
            })
          }
        >
          {SORT_OPTIONS.map((option) => (
            <s-option key={option.value} value={option.value}>
              {option.label}
            </s-option>
          ))}
        </s-select>
      </s-section>

      {reviews.length === 0 ? (
        <s-section>
          <s-banner tone="info" heading="No reviews found">
            Try adjusting your filters.
          </s-banner>
        </s-section>
      ) : (
        <s-section heading="Reviews">
          <s-stack direction="block" gap="base">
            {reviews.map((review) => (
              <s-stack key={review.id} direction="block" gap="small-200">
                <s-stack direction="inline" gap="small" alignItems="center">
                  <s-paragraph>{formatStars(review.rating)}</s-paragraph>
                  <s-paragraph>{review.reviewerName ?? "Anonymous"}</s-paragraph>
                  <s-paragraph>{formatRelativeTime(review.createdAt)}</s-paragraph>
                </s-stack>
                <s-paragraph>{review.body ?? ""}</s-paragraph>
              </s-stack>
            ))}
          </s-stack>
        </s-section>
      )}

      <s-section>
        <s-stack direction="inline" gap="base" alignItems="center">
          <s-button
            onClick={() => updateParams({ page: String(page - 1) })}
            disabled={page <= 1 || loading}
          >
            ← Previous
          </s-button>
          <s-paragraph>
            Page {page} of {totalPages}
          </s-paragraph>
          <s-button
            onClick={() => updateParams({ page: String(page + 1) })}
            disabled={page >= totalPages || loading}
          >
            Next →
          </s-button>
        </s-stack>
      </s-section>
    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
