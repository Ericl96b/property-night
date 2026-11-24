// Audio Phase 0 §10: registry integrity, and every ID used in code exists (and vice versa).
import { describe, expect, it } from 'vitest';
import { findCallSites } from '../../scripts/audio-callsites';
import { REGISTRY, SOUND_IDS, fileStem, idFromFileName, isSoundId } from '../../src/audio/registry';

const idsInCode = () => findCallSites('.');

describe('sound registry (audio Phase 0 §1)', () => {
  it('every entry is valid', () => {
    for (const id of SOUND_IDS) {
      const d = REGISTRY[id];
      expect(['ui', 'sfx', 'music'], id).toContain(d.bus);
      expect(d.gain, id).toBeGreaterThan(0);
      expect(d.cooldownMs, id).toBeGreaterThanOrEqual(0);
      expect(d.maxVoices, id).toBeGreaterThanOrEqual(1);
      expect(d.botGain, id).toBeGreaterThanOrEqual(0);
      expect(d.desc.length, id).toBeGreaterThan(0);
      expect(id, 'IDs use dots, never underscores').not.toContain('_');
    }
    expect(REGISTRY['ui.confirm'].bus).toBe('ui');
    expect(REGISTRY['music.main'].bus).toBe('music');
    expect(REGISTRY['dice.bounce.wood'].bus).toBe('sfx');
  });

  it('file names map to IDs and back', () => {
    expect(fileStem('dice.bounce.wood')).toBe('audio/dice/dice_bounce_wood');
    expect(idFromFileName('dice_bounce_wood_01.ogg')).toBe('dice.bounce.wood');
    expect(idFromFileName('money_freeParking_12.wav')).toBe('money.freeParking');
    expect(idFromFileName('readme.txt')).toBeNull();
    for (const id of SOUND_IDS) expect(idFromFileName(`${fileStem(id).split('/').pop()}_01.ogg`)).toBe(id);
  });

  it('every ID used in code exists in the registry', () => {
    const used = idsInCode();
    const unknown = [...used.keys()].filter((id) => !isSoundId(id));
    expect(unknown).toEqual([]);
  });

  it('every registry ID has a live call site (except the reserved ones)', () => {
    const used = idsInCode();
    // camera.move is reserved by the spec; music.main is started by the engine itself.
    const missing = SOUND_IDS.filter((id) => !used.has(id) && id !== 'camera.move' && id !== 'music.main');
    expect(missing).toEqual([]);
  });
});
