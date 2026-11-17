import { describe, expect, it } from 'vitest';
import { CLASSIC_PRESET, RulesPresets, normalizeRules } from '../../src/app/presets';
import { RULE_FIELDS } from '../../src/app/rulesSchema';
import { CLASSIC_RULES } from '../../src/engine';
import { memoryKV } from '../../src/storage/db';
import { GameController } from '../../src/app/controller';

describe('rules presets', () => {
  it('Classic is first, built in and read-only', async () => {
    const p = new RulesPresets(memoryKV());
    const list = await p.list();
    expect(list[0]).toMatchObject({ id: 'classic', builtIn: true });
    await expect(p.save(CLASSIC_PRESET)).rejects.toThrow(/read-only/);
    await expect(p.remove(CLASSIC_PRESET)).rejects.toThrow();
  });

  it('duplicate, edit, rename, delete', async () => {
    const p = new RulesPresets(memoryKV());
    const copy = await p.duplicate(CLASSIC_PRESET, 'House rules');
    expect(copy.builtIn).toBeUndefined();
    const edited = await p.save({ ...copy, rules: { ...copy.rules, freeParking: 'pot', startingCash: 2500 } });
    expect((await p.get(edited.id)).rules).toMatchObject({ freeParking: 'pot', startingCash: 2500 });
    await p.rename(edited, 'Family night');
    expect((await p.list()).map((x) => x.name)).toEqual(['Classic', 'Family night']);
    await p.remove(edited);
    expect(await p.list()).toHaveLength(1);
    // The game keeps its own copy: editing a preset never changes CLASSIC_RULES.
    expect(CLASSIC_RULES.startingCash).toBe(1500);
  });

  it('export / import round trip; bad files are rejected with a clear message', async () => {
    const p = new RulesPresets(memoryKV());
    const copy = await p.save({ ...(await p.duplicate(CLASSIC_PRESET, 'Speedy')), rules: { ...CLASSIC_RULES, speedDie: true } });
    const imported = await p.importJSON(p.exportJSON(copy));
    expect(imported.rules.speedDie).toBe(true);
    expect(imported.id).not.toBe(copy.id);
    await expect(p.importJSON('{nope')).rejects.toThrow(/valid JSON/);
    await expect(p.importJSON('{"format":"other"}')).rejects.toThrow(/not a Property Night/);
  });

  it('normalizing fills missing settings from Classic and clamps values', () => {
    const r = normalizeRules({ startingCash: -5, maxJailTurns: 9, houseSupply: 'unlimited', freeParking: 'bogus' as never });
    expect(r.startingCash).toBe(0);
    expect(r.maxJailTurns).toBe(5);
    expect(r.houseSupply).toBe('unlimited');
    expect(r.freeParking).toBe('nothing');
    expect(r.jailFine).toBe(50);
  });

  it('the editor covers every rules setting', () => {
    const keys = new Set(RULE_FIELDS.map((f) => f.key));
    for (const k of Object.keys(CLASSIC_RULES)) expect(keys.has(k as never)).toBe(true);
  });
});

describe('auction timer off', () => {
  it('no countdown: the auction waits for passes', () => {
    const clock = { now: () => 0, setTimeout: () => 0, clearTimeout: () => {} };
    const c = new GameController(null, clock);
    c.start({
      seats: [
        { kind: 'human', name: 'A' },
        { kind: 'human', name: 'B' },
      ],
      seed: 5,
      turnOrder: 'fixed',
      rules: { ...CLASSIC_RULES, auctionTimer: 0 },
    });
    while (c.state.phase !== 'buy') {
      if (c.state.phase === 'preRoll') c.dispatch({ type: 'roll', seat: c.state.turn.seat });
      else c.dispatch({ type: 'endTurn', seat: c.state.turn.seat });
    }
    c.dispatch({ type: 'decline', seat: c.state.turn.seat });
    expect(c.state.phase).toBe('auction');
    expect(c.view.auctionDeadline).toBeNull();
  });
});
