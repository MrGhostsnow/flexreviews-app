import db from "../db.server";
import { encrypt } from "../lib/crypto.server";

export type Plan = "free" | "pro";

export const SYNC_INTERVALS = [60, 360, 1440] as const;
export type SyncInterval = (typeof SYNC_INTERVALS)[number];

export function isSyncInterval(value: number): value is SyncInterval {
  return (SYNC_INTERVALS as readonly number[]).includes(value);
}

export function minutesFrom(date: Date, minutes: number) {
  return new Date(date.getTime() + minutes * 60 * 1000);
}

// Creates the shop record on first visit. A reinstalled shop that is still
// connected to Judge.me gets its auto-sync turned back on.
export async function ensureShop(shop: string) {
  // ON CONFLICT DO NOTHING: parallel loaders call this on the first visit,
  // and Prisma's upsert fails with a unique violation under that race.
  await db.shop.createMany({ data: [{ shop }], skipDuplicates: true });
  const record = await db.shop.findUniqueOrThrow({ where: { shop } });

  if (record.judgeMeToken && !record.nextSyncAt) {
    return db.shop.update({
      where: { shop },
      data: { nextSyncAt: new Date() },
    });
  }

  return record;
}

export function getShop(shop: string) {
  return db.shop.findUnique({ where: { shop } });
}

export function saveJudgeMeToken(shop: string, apiToken: string) {
  return db.shop.update({
    where: { shop },
    data: { judgeMeToken: encrypt(apiToken), nextSyncAt: new Date() },
  });
}

// Reviews already synced are kept, matching the old API.
export function disconnectJudgeMe(shop: string) {
  return db.shop.update({
    where: { shop },
    data: { judgeMeToken: null, nextSyncAt: null },
  });
}

export async function setSyncInterval(shop: string, interval: SyncInterval) {
  const record = await db.shop.findUniqueOrThrow({ where: { shop } });
  return db.shop.update({
    where: { shop },
    data: {
      syncInterval: interval,
      nextSyncAt: record.judgeMeToken
        ? minutesFrom(record.lastSyncedAt ?? new Date(), interval)
        : null,
    },
  });
}

export function setPlan(shop: string, plan: Plan) {
  return db.shop.updateMany({ where: { shop }, data: { plan } });
}

// Stops auto-sync after uninstall. Data is kept until shop/redact.
export function pauseShop(shop: string) {
  return db.shop.updateMany({ where: { shop }, data: { nextSyncAt: null } });
}

// shop/redact: delete everything stored for the shop (reviews cascade).
export async function deleteShopData(shop: string) {
  await db.shop.deleteMany({ where: { shop } });
  await db.session.deleteMany({ where: { shop } });
}
