import { prisma } from '../db/client.js';

// Must match FREE_DAILY_IDENTIFICATION_LIMIT in apps/mobile/src/constants/billing.ts — kept in
// sync manually since the two apps don't share a package. This is the value that's actually
// enforced; the mobile constant is only used for display copy.
export const FREE_DAILY_IDENTIFICATION_LIMIT = 10;

function todayKey(): string {
  return new Date().toISOString().slice(0, 10); // YYYY-MM-DD, UTC
}

export async function hasReachedDailyLimit(deviceId: string): Promise<boolean> {
  const usage = await prisma.identificationUsage.findUnique({
    where: { deviceId_date: { deviceId, date: todayKey() } },
  });
  return (usage?.count ?? 0) >= FREE_DAILY_IDENTIFICATION_LIMIT;
}

/** Call once per successful identification — atomically creates or increments today's count. */
export async function recordIdentificationUsage(deviceId: string): Promise<void> {
  const date = todayKey();
  await prisma.identificationUsage.upsert({
    where: { deviceId_date: { deviceId, date } },
    create: { deviceId, date, count: 1 },
    update: { count: { increment: 1 } },
  });
}
