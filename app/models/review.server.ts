import type { Prisma, Review } from "@prisma/client";
import db from "../db.server";

export const SORT_KEYS = ["recent", "highest", "lowest"] as const;
export type SortKey = (typeof SORT_KEYS)[number];

export function parseSort(value: string | null | undefined): SortKey {
  return (SORT_KEYS as readonly string[]).includes(value ?? "")
    ? (value as SortKey)
    : "recent";
}

// The review id breaks ties so the order is stable across pages and screens
// (Judge.me imports often share the same createdAt).
const NEWEST_FIRST: Prisma.ReviewOrderByWithRelationInput[] = [
  { createdAt: { sort: "desc", nulls: "last" } },
  { sourceReviewId: "desc" },
];

const ORDER_BY: Record<SortKey, Prisma.ReviewOrderByWithRelationInput[]> = {
  recent: NEWEST_FIRST,
  highest: [{ rating: "desc" }, ...NEWEST_FIRST],
  lowest: [{ rating: "asc" }, ...NEWEST_FIRST],
};

// Parses a positive integer id; Shopify product ids don't fit in 32 bits.
export function parseId(value: string | null | undefined) {
  if (!value || !/^\d+$/.test(value)) return undefined;
  const id = BigInt(value);
  return id > 0n ? id : undefined;
}

export interface ReviewFilters {
  productId?: bigint;
  rating?: number;
  search?: string;
  sort?: SortKey;
  limit: number;
  offset?: number;
}

function buildWhere(shop: string, filters: ReviewFilters): Prisma.ReviewWhereInput {
  const where: Prisma.ReviewWhereInput = { shop };
  if (filters.productId) where.productExternalId = filters.productId;
  if (filters.rating) where.rating = filters.rating;
  if (filters.search) {
    where.OR = [
      { body: { contains: filters.search, mode: "insensitive" } },
      { reviewerName: { contains: filters.search, mode: "insensitive" } },
    ];
  }
  return where;
}

export async function listReviews(shop: string, filters: ReviewFilters) {
  const where = buildWhere(shop, filters);
  const [reviews, total] = await Promise.all([
    db.review.findMany({
      where,
      orderBy: ORDER_BY[filters.sort ?? "recent"],
      take: filters.limit,
      skip: filters.offset ?? 0,
    }),
    db.review.count({ where }),
  ]);
  return { reviews: reviews.map(serializeReview), total };
}

export async function getReviewStats(shop: string) {
  const groups = await db.review.groupBy({
    by: ["rating"],
    where: { shop },
    _count: { _all: true },
  });

  const distribution: Record<1 | 2 | 3 | 4 | 5, number> = {
    1: 0,
    2: 0,
    3: 0,
    4: 0,
    5: 0,
  };
  let total = 0;
  let sum = 0;
  for (const group of groups) {
    const count = group._count._all;
    total += count;
    sum += group.rating * count;
    if (group.rating >= 1 && group.rating <= 5) {
      distribution[group.rating as 1 | 2 | 3 | 4 | 5] += count;
    }
  }

  return {
    total,
    averageRating: total > 0 ? Math.round((sum / total) * 10) / 10 : 0,
    distribution,
  };
}

// JSON-safe shape, same fields as the old reviews-api.
export function serializeReview(review: Review) {
  return {
    id: review.id,
    shopDomain: review.shop,
    sourceProvider: review.sourceProvider,
    sourceReviewId: Number(review.sourceReviewId),
    productExternalId:
      review.productExternalId != null ? Number(review.productExternalId) : null,
    rating: review.rating,
    title: review.title,
    body: review.body,
    reviewerName: review.reviewerName,
    photos: review.photos,
    hasPublishedPictures: review.hasPublishedPictures,
    hasPublishedVideos: review.hasPublishedVideos,
    verifiedBuyerStatus: review.verifiedBuyerStatus,
    createdAt: review.createdAt?.toISOString() ?? null,
    syncedAt: review.syncedAt.toISOString(),
  };
}

export type SerializedReview = ReturnType<typeof serializeReview>;
