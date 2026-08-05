import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';
import { identifySpecies, IdentifyError, type IdentifyResult } from '../api/species';
import type { CapturedPhoto } from './photo';

const STORAGE_KEY = 'woodid_offline_queue';
const MAX_QUEUE_LENGTH = 10;

export interface QueueItem {
  id: string;
  photos: CapturedPhoto[];
  queuedAt: string;
  status: 'pending' | 'submitting' | 'done' | 'failed';
  result?: IdentifyResult;
  errorMessage?: string;
}

let isProcessing = false;

async function readQueue(): Promise<QueueItem[]> {
  const stored = await AsyncStorage.getItem(STORAGE_KEY);
  return stored ? (JSON.parse(stored) as QueueItem[]) : [];
}

async function writeQueue(queue: QueueItem[]): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(queue));
}

export async function getQueue(): Promise<QueueItem[]> {
  return readQueue();
}

/**
 * Drops the oldest resolved (done/failed) items first so a long offline stretch doesn't grow
 * storage unboundedly — still-pending items are never dropped here.
 */
function capQueue(queue: QueueItem[]): QueueItem[] {
  if (queue.length <= MAX_QUEUE_LENGTH) {
    return queue;
  }
  const pending = queue.filter((item) => item.status === 'pending' || item.status === 'submitting');
  const resolved = queue.filter((item) => item.status === 'done' || item.status === 'failed');
  const keep = MAX_QUEUE_LENGTH - pending.length;
  return [...pending, ...resolved.slice(-Math.max(keep, 0))];
}

export async function enqueue(photos: CapturedPhoto[]): Promise<QueueItem> {
  const queue = await readQueue();
  const item: QueueItem = {
    id: Crypto.randomUUID(),
    photos,
    queuedAt: new Date().toISOString(),
    status: 'pending',
  };
  await writeQueue(capQueue([...queue, item]));
  return item;
}

export async function markViewed(id: string): Promise<void> {
  const queue = await readQueue();
  await writeQueue(queue.filter((item) => item.id !== id));
}

/**
 * Attempts every pending item once. A retry that fails again with NETWORK_ERROR is left
 * 'pending' (still offline, try again next trigger); any other failure means retrying won't
 * help, so it's marked 'failed' rather than retried forever.
 */
export async function processQueue(): Promise<void> {
  if (isProcessing) {
    return;
  }
  isProcessing = true;
  try {
    let queue = await readQueue();
    const pendingIds = queue.filter((item) => item.status === 'pending').map((item) => item.id);

    for (const id of pendingIds) {
      queue = await readQueue();
      const item = queue.find((i) => i.id === id);
      if (!item || item.status !== 'pending') {
        continue;
      }

      queue = queue.map((i) => (i.id === id ? { ...i, status: 'submitting' as const } : i));
      await writeQueue(queue);

      try {
        const result = await identifySpecies(item.photos.map((photo) => photo.base64));
        queue = await readQueue();
        queue = queue.map((i) => (i.id === id ? { ...i, status: 'done' as const, result } : i));
      } catch (error) {
        queue = await readQueue();
        const stillOffline = error instanceof IdentifyError && error.code === 'NETWORK_ERROR';
        queue = queue.map((i) =>
          i.id === id
            ? {
                ...i,
                status: stillOffline ? ('pending' as const) : ('failed' as const),
                errorMessage: error instanceof Error ? error.message : 'Submission failed.',
              }
            : i,
        );
      }
      await writeQueue(queue);
    }
  } finally {
    isProcessing = false;
  }
}
