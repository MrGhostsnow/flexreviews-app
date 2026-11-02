import db from "../db.server";

// Sample reviews let merchants (and App Store reviewers) try the app without a
// Judge.me account. They are shown in the admin and in the theme editor
// preview only, never to shoppers on the live storefront.
export const SAMPLE_PROVIDER = "sample";

const SAMPLES = [
  { rating: 5, daysAgo: 2, name: "Emily Carter", title: "Exceeded my expectations", body: "The quality is outstanding and it arrived two days earlier than promised. I've already recommended it to friends.", verified: true },
  { rating: 5, daysAgo: 6, name: "Michael Brooks", title: "Worth every penny", body: "Solid build, looks even better in person, and the fit is exactly as described.", verified: true },
  { rating: 4, daysAgo: 9, name: "Sofia Martinez", title: "Really good, small nitpick", body: "Love it overall. The color is slightly darker than the photos, but I'd still buy it again.", verified: true },
  { rating: 5, daysAgo: 14, name: "James Wilson", title: "Great customer service", body: "Had a question about sizing and got a helpful answer within an hour. The product itself is excellent.", verified: false },
  { rating: 3, daysAgo: 18, name: "Olivia Nguyen", title: "Decent, not perfect", body: "It does the job, but the packaging could be better. Mine had a small scuff on arrival.", verified: true },
  { rating: 5, daysAgo: 23, name: "Daniel Kim", title: "My new favorite", body: "I use it every day. Comfortable, durable and easy to care for.", verified: true },
  { rating: 4, daysAgo: 31, name: "Hannah Lee", title: "Good value", body: "Great for the price. Shipping took a little longer than expected, but it was worth the wait.", verified: false },
  { rating: 2, daysAgo: 38, name: "Ryan Patel", title: "Not for me", body: "The material felt thinner than I expected. Returning it was easy, though.", verified: true },
  { rating: 5, daysAgo: 45, name: "Grace Thompson", title: "Bought a second one", body: "Liked the first so much that I ordered another as a gift. Both arrived in perfect condition.", verified: true },
  { rating: 4, daysAgo: 52, name: "Lucas Rivera", title: "Solid choice", body: "Does exactly what it says. Instructions could be clearer, but setup was quick.", verified: false },
  { rating: 1, daysAgo: 60, name: "Chloe Adams", title: "Arrived damaged", body: "The item was damaged in transit. Support sent a replacement, but it was frustrating.", verified: true },
  { rating: 5, daysAgo: 71, name: "Nathan Scott", title: "Highly recommend", body: "Beautiful design and great attention to detail. Five stars.", verified: true },
];

// Replaces any sample reviews of the shop with a fresh set.
export async function loadSampleReviews(shop: string) {
  const now = Date.now();
  await db.$transaction([
    db.review.deleteMany({ where: { shop, sourceProvider: SAMPLE_PROVIDER } }),
    db.review.createMany({
      data: SAMPLES.map((sample, index) => ({
        shop,
        sourceProvider: SAMPLE_PROVIDER,
        sourceReviewId: BigInt(index + 1),
        id: `${SAMPLE_PROVIDER}_${index + 1}`,
        rating: sample.rating,
        title: sample.title,
        body: sample.body,
        reviewerName: sample.name,
        verifiedBuyerStatus: sample.verified ? "verified" : null,
        createdAt: new Date(now - sample.daysAgo * 24 * 60 * 60 * 1000),
      })),
    }),
    db.shop.update({ where: { shop }, data: { demoMode: true } }),
  ]);
  return SAMPLES.length;
}

export function removeSampleReviews(shop: string) {
  return db.$transaction([
    db.review.deleteMany({ where: { shop, sourceProvider: SAMPLE_PROVIDER } }),
    db.shop.update({ where: { shop }, data: { demoMode: false } }),
  ]);
}
