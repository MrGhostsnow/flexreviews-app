import type { Prisma } from "@prisma/client";
import db from "../db.server";
import { hashEmail } from "../lib/crypto.server";

// Customer as sent in the customers/data_request and customers/redact payloads.
export interface ComplianceCustomer {
  id?: number | string | null;
  email?: string | null;
}

function identifiers(customer: ComplianceCustomer) {
  const customerId =
    customer.id != null && /^\d+$/.test(String(customer.id))
      ? BigInt(customer.id)
      : null;
  const emailHash = customer.email ? hashEmail(customer.email) : null;
  return { customerId, emailHash };
}

function reviewsOf(
  shop: string,
  { customerId, emailHash }: ReturnType<typeof identifiers>,
): Prisma.ReviewWhereInput | null {
  const match: Prisma.ReviewWhereInput[] = [];
  if (customerId != null) match.push({ reviewerCustomerId: customerId });
  if (emailHash) match.push({ reviewerEmailHash: emailHash });
  return match.length > 0 ? { shop, OR: match } : null;
}

export async function countCustomerReviews(
  shop: string,
  customer: ComplianceCustomer,
) {
  const where = reviewsOf(shop, identifiers(customer));
  return where ? db.review.count({ where }) : 0;
}

// Deletes the customer's reviews and remembers the customer so later syncs
// skip them. Returns how many reviews were deleted.
export async function redactCustomer(shop: string, customer: ComplianceCustomer) {
  const ids = identifiers(customer);
  const where = reviewsOf(shop, ids);
  if (!where) return 0;

  const [, deleted] = await db.$transaction([
    db.redactedCustomer.createMany({
      data: [{ shop, customerId: ids.customerId, emailHash: ids.emailHash }],
    }),
    db.review.deleteMany({ where }),
  ]);
  return deleted.count;
}

// Tells whether a review belongs to a redacted customer of the shop.
export async function loadRedactedMatcher(shop: string) {
  const redacted = await db.redactedCustomer.findMany({ where: { shop } });
  const customerIds = new Set(
    redacted.flatMap((r) => (r.customerId != null ? [r.customerId] : [])),
  );
  const emailHashes = new Set(
    redacted.flatMap((r) => (r.emailHash ? [r.emailHash] : [])),
  );

  return (review: {
    reviewerCustomerId?: bigint | number | null;
    reviewerEmailHash?: string | null;
  }) =>
    (review.reviewerCustomerId != null &&
      customerIds.has(BigInt(review.reviewerCustomerId))) ||
    (review.reviewerEmailHash != null && emailHashes.has(review.reviewerEmailHash));
}
