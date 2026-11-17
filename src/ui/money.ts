// Banknote breakdown for payment animations (SPEC §10.9): largest first, at most `max` notes,
// the remainder shown as a "+$X" chip.
export const DENOMS = [500, 100, 50, 20, 10, 5, 1] as const;

export function breakdown(amount: number, max = 12): { notes: number[]; rest: number } {
  const notes: number[] = [];
  let left = Math.round(amount);
  for (const d of DENOMS) {
    while (left >= d && notes.length < max) {
      notes.push(d);
      left -= d;
    }
  }
  return { notes, rest: left };
}
