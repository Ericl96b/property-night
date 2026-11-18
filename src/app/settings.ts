// Settings outside rules presets (SPEC §13). Persisted per browser (localStorage for now;
// moves into IndexedDB with saves in M9). Every access is guarded: storage may be unavailable.
import type { Speed } from '../director/queue';
import type { QualitySetting } from '../render/quality';

export interface Settings {
  speed: Speed;
  reduceMotion: boolean;
  boardRotation: boolean;
  cameraFollow: boolean;
  quality: QualitySetting;
  bigPaymentAmount: number;
  bigPaymentPercent: number;
  undo: boolean;
  swapNintendo: boolean;
  volumeMaster: number;
  volumeMusic: number;
  volumeEffects: number;
}

export const DEFAULT_SETTINGS: Settings = {
  speed: 'normal',
  reduceMotion: false,
  boardRotation: true,
  cameraFollow: true,
  quality: 'auto',
  bigPaymentAmount: 200,
  bigPaymentPercent: 25,
  undo: true,
  swapNintendo: false,
  volumeMaster: 0.8,
  volumeMusic: 0.4,
  volumeEffects: 0.8,
};

const KEY = 'property-night.settings.v1';

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch {
    /* storage unavailable */
  }
  // First run: Reduce motion starts from the system's "reduce motion" preference.
  let reduceMotion = DEFAULT_SETTINGS.reduceMotion;
  try {
    reduceMotion = globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? reduceMotion;
  } catch {
    /* no matchMedia */
  }
  return { ...DEFAULT_SETTINGS, reduceMotion };
}

export function saveSettings(s: Settings): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* storage unavailable */
  }
}

/** Is a payment big enough for the payment moment (SPEC §10.9)? */
export function isBigPayment(s: Settings, amount: number, payerCashBefore: number | null): boolean {
  if (amount >= s.bigPaymentAmount) return true;
  return payerCashBefore !== null && payerCashBefore > 0 && amount >= (payerCashBefore * s.bigPaymentPercent) / 100;
}
