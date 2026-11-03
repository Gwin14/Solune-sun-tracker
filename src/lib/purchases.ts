import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import type { CustomerInfo, PurchasesOffering, PurchasesPackage } from 'react-native-purchases';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

/** RevenueCat entitlement unlocked by any Solune Pro product. */
export const ENTITLEMENT = 'solune_pro';

// Public SDK keys (safe to ship). Android has no store app yet, so purchases stay off there.
const API_KEYS: Partial<Record<string, string>> = {
  ios: 'appl_OrtTlBepkmlfpxxjpNIKGaCEmhg',
};

type Purchases = typeof import('react-native-purchases').default;
let sdk: Purchases | null | undefined;

/** The SDK, or null where it can't run (web, Android without a key). */
function purchases(): Purchases | null {
  if (sdk === undefined) {
    sdk = null;
    const key = API_KEYS[process.env.EXPO_OS ?? ''];
    if (key) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        sdk = (require('react-native-purchases') as typeof import('react-native-purchases')).default;
      } catch {
        sdk = null;
      }
    }
  }
  return sdk;
}

type ProState = { isPro: boolean; setPro: (v: boolean) => void };

/** Last known entitlement, persisted so Pro features work offline and at launch. */
export const usePro = create<ProState>()(
  persist((set) => ({ isPro: false, setPro: (isPro) => set({ isPro }) }), {
    name: 'solune-pro',
    storage: createJSONStorage(() => AsyncStorage),
  }),
);

export const isPro = () => usePro.getState().isPro;
export const purchasesAvailable = () => purchases() != null;

const applyInfo = (info: CustomerInfo) => {
  const active = info.entitlements.active[ENTITLEMENT] != null;
  if (active !== usePro.getState().isPro) usePro.getState().setPro(active);
  return active;
};

let configured = false;
/** Starts RevenueCat once and keeps `usePro` in step with the App Store. */
export function configurePurchases(onChange?: () => void) {
  const p = purchases();
  if (!p || configured) return;
  configured = true;
  try {
    p.configure({ apiKey: API_KEYS[process.env.EXPO_OS ?? '']! });
    p.addCustomerInfoUpdateListener((info) => {
      const before = isPro();
      if (applyInfo(info) !== before) onChange?.();
    });
    p.getCustomerInfo().then(applyInfo).catch(() => {});
  } catch (e) {
    if (__DEV__) console.warn('[purchases] configure failed', e);
  }
}

export async function loadOffering(): Promise<PurchasesOffering | null> {
  const p = purchases();
  if (!p) return null;
  try {
    return (await p.getOfferings()).current;
  } catch {
    return null;
  }
}

/** Whether this Apple ID can still take the free trial of `productId`. */
export async function trialEligible(productId: string): Promise<boolean> {
  const p = purchases();
  if (!p) return false;
  try {
    const res = await p.checkTrialOrIntroductoryPriceEligibility([productId]);
    // 2 = INTRO_ELIGIBILITY_STATUS_ELIGIBLE; unknown (0) is treated as eligible, as StoreKit decides at checkout.
    return res[productId]?.status !== 1 && res[productId]?.status !== 3;
  } catch {
    return true;
  }
}

export type PurchaseOutcome = 'purchased' | 'cancelled' | 'failed';

export async function buy(pkg: PurchasesPackage): Promise<PurchaseOutcome> {
  const p = purchases();
  if (!p) return 'failed';
  try {
    const { customerInfo } = await p.purchasePackage(pkg);
    return applyInfo(customerInfo) ? 'purchased' : 'failed';
  } catch (e) {
    return (e as { userCancelled?: boolean }).userCancelled ? 'cancelled' : 'failed';
  }
}

/** Restores earlier purchases; true when Pro is active afterwards. */
export async function restore(): Promise<boolean> {
  const p = purchases();
  if (!p) return false;
  try {
    return applyInfo(await p.restorePurchases());
  } catch {
    return false;
  }
}

export async function manageSubscription() {
  try {
    await purchases()?.showManageSubscriptions();
  } catch {
    // Nothing to manage (lifetime, or no purchase yet).
  }
}

/** Runs `action` for Pro users; everyone else sees the paywall. */
export function requirePro(action?: () => void): boolean {
  if (isPro()) {
    action?.();
    return true;
  }
  router.push('/paywall');
  return false;
}
