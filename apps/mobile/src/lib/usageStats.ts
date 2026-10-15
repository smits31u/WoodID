import AsyncStorage from '@react-native-async-storage/async-storage';
import { FREE_DAILY_IDENTIFICATION_LIMIT } from '../constants/billing';
import { isPro } from './proStatus';

const STORAGE_KEY = 'woodid_usage_stats';

interface UsageStats {
  dailyDate: string; // YYYY-MM-DD, local date
  dailyCount: number;
  lifetimeCount: number;
}

function todayKey(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

async function readStats(): Promise<UsageStats> {
  const stored = await AsyncStorage.getItem(STORAGE_KEY);
  const parsed: UsageStats = stored
    ? JSON.parse(stored)
    : { dailyDate: todayKey(), dailyCount: 0, lifetimeCount: 0 };

  // Roll over to a fresh daily count on first read of a new day — lifetimeCount is untouched.
  if (parsed.dailyDate !== todayKey()) {
    return { dailyDate: todayKey(), dailyCount: 0, lifetimeCount: parsed.lifetimeCount };
  }
  return parsed;
}

async function writeStats(stats: UsageStats): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(stats));
}

/**
 * Local, best-effort mirror of the server's daily count — used only for the "X free
 * identifications left today" hint. The real limit is enforced server-side, keyed by deviceId
 * (apps/backend/src/lib/usageLimits.ts); this can drift (e.g. reinstall resets it) without
 * affecting actual enforcement. Returns null for Pro users — there's no daily cap to display.
 */
export async function getRemainingToday(): Promise<number | null> {
  if (await isPro()) {
    return null;
  }
  const stats = await readStats();
  return Math.max(FREE_DAILY_IDENTIFICATION_LIMIT - stats.dailyCount, 0);
}

/** Call once per successful identification. Returns the new lifetime count. */
export async function recordIdentification(): Promise<{ lifetimeCount: number }> {
  const stats = await readStats();
  const updated: UsageStats = {
    dailyDate: stats.dailyDate,
    dailyCount: stats.dailyCount + 1,
    lifetimeCount: stats.lifetimeCount + 1,
  };
  await writeStats(updated);
  return { lifetimeCount: updated.lifetimeCount };
}
