// The app-wide sound engine (audio Phase 0 §5): one instance, importable from anywhere (the
// director gets it from main.ts; focus, menus and Svelte components import it directly).
// Outside a browser (tests) it stays inert: nothing plays until `unlock()` creates a context.
import manifest from 'virtual:audio-manifest';
import { Sound } from './sound';

export const audio = new Sound(manifest);
export { REGISTRY, SOUND_IDS, categoryOf, fileStem, type SoundId } from './registry';
export type { PlayCtx, SoundApi, SoundStatus } from './sound';
