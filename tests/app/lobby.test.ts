import { describe, expect, it } from 'vitest';
import type { SeatConfig } from '../../src/engine';
import { defaultName, lobbyProblem, moveSeat, ordinal, renameForKind } from '../../src/ui/lobby';

const seat = (kind: SeatConfig['kind'], i: number): SeatConfig => ({ kind, name: defaultName(kind, i + 1), token: `t${i}`, color: `c${i}` });

describe('lobby helpers (SPEC §3, §9)', () => {
  it('moves seats up and down, leaving the ends alone', () => {
    expect(moveSeat(['a', 'b', 'c'], 1, -1)).toEqual(['b', 'a', 'c']);
    expect(moveSeat(['a', 'b', 'c'], 1, 1)).toEqual(['a', 'c', 'b']);
    expect(moveSeat(['a', 'b', 'c'], 0, -1)).toEqual(['a', 'b', 'c']);
    expect(moveSeat(['a', 'b', 'c'], 2, 1)).toEqual(['a', 'b', 'c']);
  });

  it('renames default names to follow the seat kind; custom names stay', () => {
    expect(renameForKind('Player 2', 'bot', 2)).toBe('Bot 2');
    expect(renameForKind('Bot 3', 'bankBot', 3)).toBe('Bank 3');
    expect(renameForKind('Bank 4', 'human', 4)).toBe('Player 4');
    expect(renameForKind('Grandma', 'bot', 2)).toBe('Grandma');
  });

  it('ordinals', () => {
    expect([1, 2, 3, 4, 11, 12, 13, 21, 22].map(ordinal)).toEqual(['1st', '2nd', '3rd', '4th', '11th', '12th', '13th', '21st', '22nd']);
  });

  it('validates seats', () => {
    expect(lobbyProblem([seat('human', 0), seat('bot', 1), seat('bankBot', 2)])).toBeNull();
    expect(lobbyProblem([seat('bot', 0), seat('bot', 1)])).toMatch(/human/);
    expect(lobbyProblem([seat('human', 0), seat('bankBot', 1)])).toMatch(/bank-backed/);
    const dupTok = [seat('human', 0), { ...seat('bot', 1), token: 't0' }];
    expect(lobbyProblem(dupTok)).toMatch(/token/);
    const dupCol = [seat('human', 0), { ...seat('bot', 1), color: 'c0' }];
    expect(lobbyProblem(dupCol)).toMatch(/color/);
    expect(lobbyProblem([seat('human', 0), { ...seat('bot', 1), name: '  ' }])).toMatch(/name/);
  });
});
