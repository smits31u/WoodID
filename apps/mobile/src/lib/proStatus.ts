import AsyncStorage from '@react-native-async-storage/async-storage';
import { hasActiveEntitlement } from './purchases';

const PROMO_UNLOCK_KEY = 'woodid_promo_unlocked';

async function isPromoUnlocked(): Promise<boolean> {
  return (await AsyncStorage.getItem(PROMO_UNLOCK_KEY)) === 'true';
}

/** Set once a promo code has been validated against the backend — persists across app restarts. */
export async function unlockProWithPromo(): Promise<void> {
  await AsyncStorage.setItem(PROMO_UNLOCK_KEY, 'true');
}

export async function isPro(): Promise<boolean> {
  if (await isPromoUnlocked()) {
    return true;
  }
  return hasActiveEntitlement();
}
