import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';
import type { IdentifyResult } from '../api/species';
import type { CapturedPhoto } from './photo';

const STORAGE_KEY = 'woodid_history';
const MAX_HISTORY_LENGTH = 30;

export interface HistoryEntry {
  id: string;
  result: IdentifyResult;
  photos: CapturedPhoto[];
  createdAt: string;
}

async function readHistory(): Promise<HistoryEntry[]> {
  const stored = await AsyncStorage.getItem(STORAGE_KEY);
  return stored ? (JSON.parse(stored) as HistoryEntry[]) : [];
}

async function writeHistory(entries: HistoryEntry[]): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
}

/** Newest first — the order the History screen displays them in. */
export async function getHistory(): Promise<HistoryEntry[]> {
  const entries = await readHistory();
  return entries.slice().reverse();
}

/**
 * Each entry keeps its full-resolution photos (not just a thumbnail) so tapping back into it
 * reopens the exact same Results screen, "add another angle" included — the same trade-off the
 * offline queue already makes. Capped at MAX_HISTORY_LENGTH, oldest dropped first, to keep
 * AsyncStorage from growing without bound over the life of the app.
 */
export async function addHistoryEntry(
  result: IdentifyResult,
  photos: CapturedPhoto[],
): Promise<void> {
  const entries = await readHistory();
  const entry: HistoryEntry = {
    id: Crypto.randomUUID(),
    result,
    photos,
    createdAt: new Date().toISOString(),
  };
  const updated = [...entries, entry].slice(-MAX_HISTORY_LENGTH);
  await writeHistory(updated);
}

export async function clearHistory(): Promise<void> {
  await AsyncStorage.removeItem(STORAGE_KEY);
}
