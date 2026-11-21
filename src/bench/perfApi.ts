// What the overlay UI needs from the benchmark / test board wiring in main.ts (Batch 4).
import type { Renderer } from '../render/renderer';
import type { BenchMode, BenchSummary } from '../perf/summary';
import type { BenchProgress } from './benchmark';
import type { BenchHistory } from './history';
import type { TestBoard } from './testBoard';

export interface PerfApi {
  renderer: Renderer;
  history: BenchHistory;
  /** Run the benchmark (null when cancelled). The scene is left showing the benchmark board. */
  run(mode: BenchMode, onProgress: (p: BenchProgress) => void, signal: AbortSignal): Promise<BenchSummary | null>;
  /** Enter the test board (creates it on first use, then re-enters with its layout). */
  enterTestBoard(): TestBoard;
  /** Leave the test board and clean the scene. */
  leaveTestBoard(): void;
  /** Clean the scene as after a game (no tokens, owners, buildings). */
  clearScene(): void;
  /** Quality level actually in use ("High" / "Low"). */
  qualityLabel(): string;
  /** Any controller's right stick nudges the camera (test board). */
  setNudgeAnyPad(on: boolean): void;
}

/** Copy text to the clipboard (falls back to a hidden textarea where the API is unavailable). */
export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.cssText = 'position:fixed;opacity:0;left:-9999px';
      document.body.append(ta);
      ta.select();
      const ok = document.execCommand('copy');
      ta.remove();
      return ok;
    } catch {
      return false;
    }
  }
}
