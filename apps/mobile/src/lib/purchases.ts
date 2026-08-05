import Purchases, { type PurchasesOffering, type PurchasesPackage } from 'react-native-purchases';
import { PRO_ENTITLEMENT_ID, REVENUECAT_API_KEY } from '../constants/billing';

let configured = false;

/** Safe to call with no API key configured yet — every other function below then just no-ops. */
export async function configurePurchases(): Promise<void> {
  if (configured || !REVENUECAT_API_KEY) {
    return;
  }
  try {
    Purchases.configure({ apiKey: REVENUECAT_API_KEY });
    configured = true;
  } catch {
    // Leave `configured` false — subsequent calls will simply keep no-oping.
  }
}

export async function hasActiveEntitlement(): Promise<boolean> {
  if (!configured) {
    return false;
  }
  try {
    const customerInfo = await Purchases.getCustomerInfo();
    return customerInfo.entitlements.active[PRO_ENTITLEMENT_ID] != null;
  } catch {
    return false;
  }
}

export async function getCurrentOffering(): Promise<PurchasesOffering | null> {
  if (!configured) {
    return null;
  }
  try {
    const offerings = await Purchases.getOfferings();
    return offerings.current;
  } catch {
    return null;
  }
}

export async function purchasePackage(
  pkg: PurchasesPackage,
): Promise<{ success: boolean; message?: string }> {
  if (!configured) {
    return { success: false, message: 'Purchases are not available right now.' };
  }
  try {
    const { customerInfo } = await Purchases.purchasePackage(pkg);
    return { success: customerInfo.entitlements.active[PRO_ENTITLEMENT_ID] != null };
  } catch (error) {
    const userCancelled = (error as { userCancelled?: boolean })?.userCancelled === true;
    if (userCancelled) {
      return { success: false };
    }
    return { success: false, message: 'Purchase failed. Please try again.' };
  }
}

export async function restorePurchases(): Promise<boolean> {
  if (!configured) {
    return false;
  }
  try {
    const customerInfo = await Purchases.restorePurchases();
    return customerInfo.entitlements.active[PRO_ENTITLEMENT_ID] != null;
  } catch {
    return false;
  }
}
