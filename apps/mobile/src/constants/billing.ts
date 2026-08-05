import { Platform } from 'react-native';

// RevenueCat public SDK keys (safe to embed client-side) — created per-app in the RevenueCat
// dashboard under Project settings > API keys. Fill these in before shipping; until then,
// configurePurchases() no-ops and the Upgrade screen falls back to the static price labels below.
export const REVENUECAT_API_KEY = Platform.select({
  ios: '',
  android: '',
  default: '',
});

// Must match the entitlement identifier configured in the RevenueCat dashboard.
export const PRO_ENTITLEMENT_ID = 'pro';

export const FREE_DAILY_IDENTIFICATION_LIMIT = 5;
export const FEEDBACK_PROMPT_LIFETIME_LIMIT = 5;

export interface ProPlan {
  packageIdentifier: string;
  label: string;
  priceLabel: string;
}

// Fallback display copy used when RevenueCat offerings haven't loaded (e.g. no API key
// configured yet, or offline) — package identifiers must match the RevenueCat dashboard.
export const PRO_PLANS: ProPlan[] = [
  { packageIdentifier: '$rc_monthly', label: 'Monthly', priceLabel: '$2.99/month' },
  { packageIdentifier: '$rc_annual', label: 'Yearly', priceLabel: '$19.99/year' },
];
