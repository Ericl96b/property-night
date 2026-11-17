import { describe, expect, it } from 'vitest';
import {
  BoardPresets,
  CLASSIC_BOARD_PRESET,
  boardWarnings,
  deckWarnings,
  normalizeBoard,
  normalizeDeck,
  printView,
  scaleGroup,
} from '../../src/app/boardPresets';
import { CLASSIC_BOARD } from '../../src/data/classicBoard';
import { CLASSIC_CHANCE, CLASSIC_RULES, apply, cardText, newGame } from '../../src/engine';
import { memoryKV } from '../../src/storage/db';
import { edit, own, withDice } from '../engine/helpers';

const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v));

describe('board presets', () => {
  it('Classic board is built in, read-only and matches the classic data', async () => {
    const p = new BoardPresets(memoryKV());
    const list = await p.list();
    expect(list[0]).toMatchObject({ id: 'classic-board', builtIn: true });
    expect(list[0].board.tiles).toHaveLength(40);
    expect(list[0].decks.chance).toHaveLength(16);
    await expect(p.save(CLASSIC_BOARD_PRESET)).rejects.toThrow(/read-only/);
  });

  it('duplicate, edit names and values, export/import round trip', async () => {
    const p = new BoardPresets(memoryKV());
    const copy = await p.duplicate(CLASSIC_BOARD_PRESET, 'Our street');
    copy.board.tiles[1].name = 'Maple Way';
    copy.board.tiles[39].price = 500;
    copy.board.groups.brown.color = '#123456';
    const saved = await p.save(copy);
    expect((await p.get(saved.id)).board.tiles[1].name).toBe('Maple Way');
    const back = await p.importJSON(p.exportJSON(saved));
    expect(back.board.tiles[39].price).toBe(500);
    expect(back.board.groups.brown.color).toBe('#123456');
    await expect(p.importJSON('{"format":"x"}')).rejects.toThrow(/not a Property Night board/);
  });

  it('normalizing keeps the classic layout and clamps values', () => {
    const raw = clone(CLASSIC_BOARD);
    raw.tiles[1].type = 'tax'; // layout cannot change
    raw.tiles[1].price = -10;
    raw.tiles[1].name = '';
    raw.groups.red.color = 'not-a-color';
    const b = normalizeBoard(raw);
    expect(b.tiles[1].type).toBe('street');
    expect(b.tiles[1].price).toBe(0);
    expect(b.tiles[1].name).toBe('Hazel Lane');
    expect(b.groups.red.color).toBe('#ED1B24');
  });

  it('decks: invalid cards dropped, one jail card per deck, empty falls back to Classic', () => {
    const deck = normalizeDeck(
      [
        { text: 'A', effect: { kind: 'getOutOfJail' } },
        { text: 'B', effect: { kind: 'getOutOfJail' } },
        { text: 'C', effect: { kind: 'bogus' } as never },
        { text: 'D', effect: { kind: 'collect', amount: 5 } },
      ],
      CLASSIC_CHANCE,
    );
    expect(deck.map((c) => c.text)).toEqual(['A', 'D']);
    expect(normalizeDeck([], CLASSIC_CHANCE)).toHaveLength(16);
  });

  it('warnings: non-increasing rents, mortgage above price, duplicate names, untemplated move cards', () => {
    const b = clone(CLASSIC_BOARD);
    b.tiles[1].rents = [2, 10, 5, 90, 160, 250];
    b.tiles[3].mortgage = 999;
    b.tiles[6].name = 'Hazel Lane';
    const w = boardWarnings(b);
    expect(w.some((x) => /Hazel Lane: rents do not increase/.test(x))).toBe(true);
    expect(w.some((x) => /mortgage value is above/.test(x))).toBe(true);
    expect(w.some((x) => /share a name/.test(x))).toBe(true);
    expect(deckWarnings([{ text: 'Go to the park', effect: { kind: 'moveTo', tile: 39 } }])[0]).toMatch(/\{tile\}/);
  });

  it('group scaling multiplies prices, rents, house costs and mortgages', () => {
    const b = clone(CLASSIC_BOARD);
    scaleGroup(b, 'darkBlue', 2);
    expect(b.tiles[39]).toMatchObject({ price: 800, mortgage: 400, houseCost: 400 });
    expect(b.tiles[39].rents![0]).toBe(100);
    expect(b.tiles[1].price).toBe(60);
  });

  it('the printed board follows the game rules (GO salary, tax lines)', () => {
    const v = printView(CLASSIC_BOARD, { ...CLASSIC_RULES, goSalary: 300, incomeTaxMode: 'percent', luxuryTax: 75 });
    expect(v.goSalary).toBe(300);
    expect(v.tiles[4].taxLabel).toBe('Pay 10%');
    expect(v.tiles[38].taxLabel).toBe('Pay $75');
  });
});

describe('custom boards in play', () => {
  it('renamed tiles flow into card text, and custom values into rent', () => {
    const b = clone(CLASSIC_BOARD);
    b.tiles[39].name = 'Lighthouse';
    b.tiles[39].rents = [99, 200, 600, 1400, 1700, 2000];
    b.utilityMultipliers = [5, 12];
    const s = newGame({ seats: [{ kind: 'human', name: 'A' }, { kind: 'human', name: 'B' }], seed: 1, turnOrder: 'fixed', board: b });
    expect(cardText(s.decks.chance.find((c) => c.effect.kind === 'moveTo' && c.effect.tile === 39)!, (i) => s.board.tiles[i].name)).toBe('Take a walk to Lighthouse.');
    const r = apply(edit(withDice(s, 2, 3), (d) => {
      d.players[0].position = 34;
      own(d, 1, 39);
    }), { type: 'roll', seat: 0 }).state;
    expect(r.players[1].cash).toBe(1599);
    const u = apply(edit(withDice(s, 3, 4), (d) => {
      d.players[0].position = 5;
      own(d, 1, 12);
    }), { type: 'roll', seat: 0 }).state;
    expect(u.players[1].cash).toBe(1500 + 5 * 7);
  });
});
