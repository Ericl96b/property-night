import { describe, expect, it } from 'vitest';
import { stage3Demo } from '../../src/bench/stage3Demo';
import { binderRows, binderStats, slotDetail } from '../../src/ui/inventory';
import { edit } from '../engine/helpers';

describe('Inventory binder (Stage 3 §3)', () => {
  const s = edit(stage3Demo(), (d) => {
    d.promises = [
      { id: 1, kind: 'rentFree', from: 1, to: 0, group: 'pink', total: 2, left: 1 },
      { id: 2, kind: 'rentFree', from: 0, to: 1, group: 'orange', total: 3, left: 3 },
      { id: 3, kind: 'noBuild', from: 0, to: 1, group: 'lightBlue', total: 3, left: 2, anchor: 0 },
    ];
  });

  it('rows run in board order, then railroads, utilities, jail cards, promises', () => {
    expect(binderRows(s, 0).map((r) => r.label)).toEqual([
      'Brown', 'Light Blue', 'Mustard', 'Orange', 'Red', 'Pink', 'Green', 'Dark Blue', 'Railroads', 'Utilities', 'Jail cards', 'Promises',
    ]);
  });

  it('row labels show k of n, FULL SET and promise tags', () => {
    const rows = binderRows(s, 0);
    const lb = rows.find((r) => r.key === 'lightBlue')!;
    expect([lb.owned, lb.total, lb.full]).toEqual([3, 3, true]);
    expect(lb.tags.map((t) => t.text)).toEqual(['No building · 2 rounds']);
    expect(rows.find((r) => r.key === 'orange')!.tags.map((t) => t.text)).toEqual(['Riley rent-free · 3']);
    expect(rows.find((r) => r.key === 'pink')!.tags.map((t) => t.text)).toEqual(['You ride free · 1']);
    // Someone else's binder reads with names.
    expect(binderRows(s, 0, 1).find((r) => r.key === 'pink')!.tags[0].text).toBe('Lawrence rides free · 1');
  });

  it('empty slots name the owner, or say Unowned', () => {
    const brown = binderRows(s, 0).find((r) => r.key === 'brown')!;
    expect(brown.slots.map((x) => x.empty?.owner?.name ?? null)).toEqual(['Sam', 'Sam']);
    const red = binderRows(s, 0).find((r) => r.key === 'red')!;
    expect(red.slots[2].empty!.owner).toBeNull();
  });

  it('stats: deeds, full sets, houses, cash', () => {
    expect(binderStats(s, 0)).toEqual({ deeds: 8, fullSets: 1, houses: 9, hotels: 0, cash: 820 });
  });

  it('a No Building promise blocks the build action with a sentence', () => {
    const lilac = binderRows(s, 0).find((r) => r.key === 'lightBlue')!.slots[0];
    const d = slotDetail(s, 0, 0, lilac)!;
    expect(d.actions[0]).toMatchObject({ label: 'Build on Light Blue', ok: false, why: 'Blocked by your promise to Riley for 2 more rounds.' });
    expect(d.actions[1]).toMatchObject({ label: 'Sell a house', ok: true });
  });

  it('view-only binders have no actions', () => {
    const r = binderRows(s, 1, 0).find((x) => x.key === 'railroad')!.slots.find((x) => x.item)!;
    expect(slotDetail(s, 1, 0, r)!.actions).toEqual([]);
  });

  it('railroads cannot build; mortgage carries over with its engine call', () => {
    const north = binderRows(s, 0).find((r) => r.key === 'railroad')!.slots[0];
    const d = slotDetail(s, 0, 0, north)!;
    expect(d.actions.map((a) => [a.label, a.ok])).toEqual([
      ['Mortgage North Line', true],
      ['Build', false],
    ]);
    expect(d.actions[0].action).toEqual({ type: 'mortgage', seat: 0, tile: 5 });
  });
});
