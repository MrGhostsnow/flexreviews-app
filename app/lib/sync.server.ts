import db from "../db.server";
import { decrypt } from "./crypto.server";
import { fetchAllJudgeMeReviews, normalizeReview } from "./judgeme.server";
import { minutesFrom } from "../models/shop.server";

// How often the scheduler looks for shops whose next sync is due.
const SCHEDULER_TICK_MS = 5 * 60 * 1000;

const runningSyncs = new Map<string, Promise<number>>();

export function isSyncing(shop: string) {
  return runningSyncs.has(shop);
}

async function runSync(shop: string) {
  const record = await db.shop.findUnique({ where: { shop } });
  if (!record?.judgeMeToken) {
    throw new Error("Shop is not connected to Judge.me");
  }

  const apiToken = decrypt(record.judgeMeToken);
  const synced = await fetchAllJudgeMeReviews(shop, apiToken, async (page) => {
    await db.$transaction(
      page.map((raw) => {
        const review = normalizeReview(raw, shop);
        return db.review.upsert({
          where: {
            shop_sourceProvider_sourceReviewId: {
              shop,
              sourceProvider: review.sourceProvider,
              sourceReviewId: review.sourceReviewId,
            },
          },
          create: review,
          update: review,
        });
      }),
    );
  });

  const now = new Date();
  await db.shop.update({
    where: { shop },
    data: {
      lastSyncedAt: now,
      nextSyncAt: minutesFrom(now, record.syncInterval),
    },
  });

  console.log(`[sync] ${shop}: ${synced} reviews upserted`);
  return synced;
}

// Pulls every review from Judge.me into the database. Concurrent calls for
// the same shop share one run.
export function syncShop(shop: string) {
  const running = runningSyncs.get(shop);
  if (running) return running;

  const sync = runSync(shop).finally(() => runningSyncs.delete(shop));
  runningSyncs.set(shop, sync);
  return sync;
}

async function syncDueShops() {
  const due = await db.shop.findMany({
    where: { judgeMeToken: { not: null }, nextSyncAt: { lte: new Date() } },
    select: { shop: true, syncInterval: true },
  });

  for (const { shop, syncInterval } of due) {
    try {
      await syncShop(shop);
    } catch (error) {
      console.error(`[sync] ${shop} failed:`, error);
      // Retry on the next interval instead of every tick.
      await db.shop.update({
        where: { shop },
        data: { nextSyncAt: minutesFrom(new Date(), syncInterval) },
      });
    }
  }
}

declare global {
  // eslint-disable-next-line no-var
  var autoSyncTimer: NodeJS.Timeout | undefined;
}

// Starts the in-process auto-sync loop once per server process.
export function startAutoSync() {
  if (global.autoSyncTimer) return;

  const tick = () =>
    syncDueShops().catch((error) =>
      console.error("[sync] scheduler tick failed:", error),
    );
  global.autoSyncTimer = setInterval(tick, SCHEDULER_TICK_MS);
  global.autoSyncTimer.unref();
  void tick();
}
