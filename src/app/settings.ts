// Settings outside rules presets (SPEC §13). Persisted per browser (localStorage for now;
// moves into IndexedDB with saves in M9). Every access is guarded: storage may be unavailable.
import type { Speed } from '../director/queue';
import type { QualitySetting } from '../render/quality';
import { defaultResolution, displayPhysical, isRenderHeight, type RenderHeight } from '../render/resolution';

export interface Settings {
  speed: Speed;
  reduceMotion: boolean;
  /** Stage 2: Close-up (default) or Table. Board rotation and Camera follow apply to Table only. */
  cameraStyle: CameraStyleSetting;
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
  /** Graphics, independent of the Quality preset. */
  ambientOcclusion: boolean;
  /** Exposure multiplier, 0.7–1.3. */
  brightness: number;
  toneMapping: ToneMappingSetting;
  /** Banknotes fly between the player tabs for every payment, not only big ones. */
  everyPayment: boolean;
  /** Performance overlay (Batch 4): off by default so normal play is unchanged. */
  perfOverlay: PerfOverlaySetting;
  /**
   * Internal render height of the 3D canvas (SPEC_render_resolution). Per machine: lives only in
   * this localStorage blob, never in saves or presets. A value above the current display is kept;
   * the renderer clamps it.
   */
  renderHeight: RenderHeight;
}

export type PerfOverlaySetting = 'off' | 'fps' | 'detailed';

export type CameraStyleSetting = 'closeup' | 'table';

export type ToneMappingSetting = 'aces' | 'agx' | 'neutral';

export const DEFAULT_SETTINGS: Settings = {
  speed: 'normal',
  reduceMotion: false,
  cameraStyle: 'closeup',
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
  ambientOcclusion: false,
  brightness: 1,
  toneMapping: 'aces',
  everyPayment: true,
  perfOverlay: 'off',
  renderHeight: 2160,
};

const KEY = 'property-night.settings.v1';

/** The display's physical height, or null where there is no screen (tests, workers). */
function displayHeight(): number | null {
  try {
    const s = globalThis.screen;
    const dpr = globalThis.devicePixelRatio || 1;
    return s ? displayPhysical(s, dpr).h : null;
  } catch {
    return null;
  }
}

/** A stored choice is kept as is (even above this display); otherwise the first-launch default. */
export function resolveRenderHeight(stored: unknown, displayH: number | null): RenderHeight {
  if (isRenderHeight(stored)) return stored;
  return displayH === null ? DEFAULT_SETTINGS.renderHeight : defaultResolution(displayH);
}

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return { ...DEFAULT_SETTINGS, ...parsed, renderHeight: resolveRenderHeight(parsed?.renderHeight, displayHeight()) };
    }
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
  return { ...DEFAULT_SETTINGS, reduceMotion, renderHeight: resolveRenderHeight(undefined, displayHeight()) };
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
