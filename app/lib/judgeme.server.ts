import type { Prisma } from "@prisma/client";

const JUDGEME_API_BASE = "https://api.judge.me/api/v1";
const PAGE_SIZE = 100;

export const JUDGEME_PROVIDER = "judge_me";

export interface JudgeMeReview {
  id: number;
  product_external_id?: number | null;
  rating: number;
  title?: string | null;
  body?: string | null;
  reviewer?: { name?: string | null } | null;
  pictures?: { url?: string; urls?: { original?: string } }[] | null;
  has_published_pictures?: boolean | null;
  has_published_videos?: boolean | null;
  verified_buyer?: string | boolean | null;
  created_at?: string | null;
}

function reviewsUrl(shop: string, apiToken: string, page: number, perPage: number) {
  const params = new URLSearchParams({
    api_token: apiToken,
    shop_domain: shop,
    per_page: String(perPage),
    page: String(page),
  });
  return `${JUDGEME_API_BASE}/reviews?${params.toString()}`;
}

// Returns true when Judge.me accepts the token for this shop.
export async function verifyJudgeMeToken(shop: string, apiToken: string) {
  try {
    const response = await fetch(reviewsUrl(shop, apiToken, 1, 1));
    return response.ok;
  } catch (error) {
    console.error("[judge.me] token verification failed:", error);
    return false;
  }
}

// Fetches every review page by page, calling onPage for each batch.
export async function fetchAllJudgeMeReviews(
  shop: string,
  apiToken: string,
  onPage: (reviews: JudgeMeReview[]) => Promise<void>,
) {
  let page = 1;
  let total = 0;
  let hasMore = true;

  while (hasMore) {
    const response = await fetch(reviewsUrl(shop, apiToken, page, PAGE_SIZE));
    if (!response.ok) {
      throw new Error(`Judge.me API returned ${response.status}`);
    }

    const data = (await response.json()) as { reviews?: JudgeMeReview[] };
    const reviews = data.reviews ?? [];
    if (reviews.length > 0) {
      await onPage(reviews);
      total += reviews.length;
    }

    // Judge.me returns fewer than per_page on the last page.
    hasMore = reviews.length === PAGE_SIZE;
    page++;
  }

  return total;
}

function parseDate(value: string | null | undefined) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function normalizeReview(
  raw: JudgeMeReview,
  shop: string,
): Prisma.ReviewUncheckedCreateInput {
  return {
    shop,
    sourceProvider: JUDGEME_PROVIDER,
    sourceReviewId: BigInt(raw.id),
    id: `${JUDGEME_PROVIDER}_${raw.id}`,
    productExternalId:
      raw.product_external_id != null ? BigInt(raw.product_external_id) : null,
    rating: raw.rating,
    title: raw.title ?? null,
    body: raw.body ?? null,
    reviewerName: raw.reviewer?.name ?? null,
    photos: (raw.pictures ?? [])
      .map((picture) => picture.url ?? picture.urls?.original)
      .filter((url): url is string => Boolean(url)),
    hasPublishedPictures: raw.has_published_pictures ?? false,
    hasPublishedVideos: raw.has_published_videos ?? false,
    verifiedBuyerStatus:
      raw.verified_buyer != null ? String(raw.verified_buyer) : null,
    createdAt: parseDate(raw.created_at),
    // Deliberately not copying reviewer tags or other reviewer fields: not
    // needed for display, and may carry unrelated third-party CRM data.
  };
}
