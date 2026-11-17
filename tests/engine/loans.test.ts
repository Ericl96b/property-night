// SPEC §7 bank loans and the §15 loan scenarios: early payoff, interest-free, missed secured
// payment with refund, missed secured payment with shortfall, missed unsecured payment,
// no-build rule — plus a behavior test for every loan setting.
import { describe, expect, it } from 'vitest';
import { apply, checkInvariants, installment, legalActions, loanLimit, schedule, type Rules, type State } from '../../src/engine';
import { act, edit, game, own, run, withDice } from './helpers';

const loansOn = (rules: Partial<Rules> = {}, n = 2) => game(n, { rules: { loans: true, ...rules } });
/** Seat 0 at 36 rolling 2+3 passes GO and lands on 1 (Hazel, owned by nobody). */
const toGo = (s: State) => edit(withDice(s, 2, 2), (d) => (d.players[0].position = 36));

describe('taking a loan', () => {
  it('is off unless the rule is on', () => {
    expect(() => apply(game(), { type: 'takeLoan', seat: 0, amount: 100, passes: 3, collateral: [] })).toThrow(/off/);
  });

  it('unsecured loan up to the fixed cap; pays cash in', () => {
    const r = act(loansOn(), { type: 'takeLoan', seat: 0, amount: 1000, passes: 5, collateral: [] });
    expect(r.s.players[0].cash).toBe(2500);
    expect(r.s.players[0].loans[0]).toMatchObject({ principal: 1000, rate: 10, passesLeft: 5, secured: false });
    expect(() => apply(loansOn(), { type: 'takeLoan', seat: 0, amount: 1001, passes: 5, collateral: [] })).toThrow(/limit is \$1,000/);
  });

  it('collateral-based limit: 75% of pledged purchase price (setting)', () => {
    const s = edit(loansOn(), (d) => own(d, 0, 37, 39));
    expect(loanLimit(s, 0, [37, 39])).toBe(Math.floor(350 * 0.75) + Math.floor(400 * 0.75));
    expect(loanLimit(edit(loansOn({ collateralLoanPercent: 50 }), (d) => own(d, 0, 39)), 0, [39])).toBe(200);
  });

  it('fixed cap and % of net worth modes', () => {
    const s = edit(loansOn({ loanLimitMode: 'fixed', loanFixedCap: 700 }), (d) => own(d, 0, 39));
    expect(loanLimit(s, 0, [39])).toBe(700);
    const w = loansOn({ loanLimitMode: 'netWorth', loanNetWorthPercent: 20 });
    expect(loanLimit(w, 0, [])).toBe(300);
  });

  it('unsecured loans can be turned off', () => {
    expect(() => apply(loansOn({ unsecuredLoans: false }), { type: 'takeLoan', seat: 0, amount: 100, passes: 3, collateral: [] })).toThrow(/collateral/);
  });

  it('max active loans and the term range', () => {
    const one = act(loansOn(), { type: 'takeLoan', seat: 0, amount: 100, passes: 3, collateral: [] }).s;
    expect(() => apply(one, { type: 'takeLoan', seat: 0, amount: 100, passes: 3, collateral: [] })).toThrow(/at most 1/);
    const two = act(loansOn({ maxActiveLoans: 2 }), { type: 'takeLoan', seat: 0, amount: 100, passes: 3, collateral: [] }).s;
    expect(act(two, { type: 'takeLoan', seat: 0, amount: 100, passes: 3, collateral: [] }).s.players[0].loans).toHaveLength(2);
    expect(() => apply(loansOn(), { type: 'takeLoan', seat: 0, amount: 100, passes: 11, collateral: [] })).toThrow(/3–10/);
    expect(() => apply(loansOn({ loanTermMin: 1, loanTermMax: 2 }), { type: 'takeLoan', seat: 0, amount: 100, passes: 3, collateral: [] })).toThrow(/1–2/);
  });

  it('pledged property: locked against trade and mortgage, still collects rent; mortgaged cannot be pledged', () => {
    const s = act(edit(loansOn(), (d) => own(d, 0, 39)), { type: 'takeLoan', seat: 0, amount: 300, passes: 3, collateral: [39] }).s;
    expect(() => apply(s, { type: 'mortgage', seat: 0, tile: 39 })).toThrow(/pledged/);
    const offer = { from: 0, to: 1, give: { tiles: [39], cash: 0, gojf: 0 }, get: { tiles: [], cash: 10, gojf: 0 }, promises: [] };
    expect(() => apply(s, { type: 'proposeTrade', seat: 0, offer })).toThrow(/pledged/);
    const m = edit(loansOn(), (d) => {
      own(d, 0, 39);
      d.tiles[39].mortgaged = true;
    });
    expect(() => apply(m, { type: 'takeLoan', seat: 0, amount: 100, passes: 3, collateral: [39] })).toThrow(/mortgaged/);
    // Rent still collected on the pledged lot.
    const rent = act(edit(withDice(s, 0 + 2, 3), (d) => {
      d.turn.seat = 1;
      d.players[1].position = 34;
    }), { type: 'roll', seat: 1 }).s;
    expect(rent.players[0].cash).toBe(1500 + 300 + 50);
  });
});

describe('repayment', () => {
  it('schedule: principal ÷ remaining passes + interest on the remaining principal', () => {
    expect(installment({ id: 1, principal: 1000, rate: 10, passesLeft: 4, collateral: [], secured: false })).toEqual({ principal: 250, interest: 100, total: 350 });
    const plan = schedule(1000, 4, 10);
    expect(plan.rows.map((r) => r.total)).toEqual([350, 325, 300, 275]);
    expect(plan.totalInterest).toBe(250);
  });

  it('pays at GO after the salary', () => {
    const s = act(toGo(act(loansOn(), { type: 'takeLoan', seat: 0, amount: 1000, passes: 4, collateral: [] }).s), { type: 'roll', seat: 0 }).s;
    expect(s.players[0].cash).toBe(2500 + 200 - 350);
    expect(s.players[0].loans[0]).toMatchObject({ principal: 750, passesLeft: 3 });
  });

  it('interest-free (0%) loans repay only principal', () => {
    const s = act(toGo(act(loansOn({ loanInterestPercent: 0 }), { type: 'takeLoan', seat: 0, amount: 900, passes: 3, collateral: [] }).s), { type: 'roll', seat: 0 }).s;
    expect(s.players[0].cash).toBe(2400 + 200 - 300);
  });

  it('early payoff of any amount on your own turn; zero balance closes the loan and unlocks collateral', () => {
    const s = act(edit(loansOn(), (d) => own(d, 0, 39)), { type: 'takeLoan', seat: 0, amount: 300, passes: 3, collateral: [39] }).s;
    const part = act(s, { type: 'repayLoan', seat: 0, loanId: 1, amount: 100 }).s;
    expect(part.players[0].loans[0].principal).toBe(200);
    const done = act(part, { type: 'repayLoan', seat: 0, loanId: 1, amount: 200 }).s;
    expect(done.players[0].loans).toHaveLength(0);
    expect(act(done, { type: 'mortgage', seat: 0, tile: 39 }).s.tiles[39].mortgaged).toBe(true);
    expect(() => apply(s, { type: 'repayLoan', seat: 0, loanId: 1, amount: 301 })).toThrow();
  });

  it('missed secured payment: collateral seized; surplus refunded by the bank', () => {
    let s = act(edit(loansOn(), (d) => own(d, 0, 39)), { type: 'takeLoan', seat: 0, amount: 100, passes: 3, collateral: [39] }).s;
    s = edit(s, (d) => (d.players[0].cash = 0));
    const r = act(toGo(s), { type: 'roll', seat: 0 });
    // Installment 34 + 10 interest > 200 salary? No: salary covers it. Force a miss with a tiny salary.
    expect(r.s.players[0].loans[0].principal).toBeLessThan(100);
    const miss = act(toGo(edit(s, (d) => (d.rules = { ...d.rules, goSalary: 0 }))), { type: 'roll', seat: 0 });
    expect(miss.s.tiles[39].owner).toBeNull();
    expect(miss.ev.some((e) => e.type === 'loanSeized')).toBe(true);
    // Seizure value $400 (purchase price) − balance ($100 + $10 interest) = $290 refund.
    expect(miss.s.players[0].cash).toBe(290);
    expect(miss.s.phase).toBe('auction'); // seized property goes to auction (setting)
    expect(checkInvariants(miss.s)).toEqual([]);
  });

  it('missed secured payment: a shortfall is owed to the bank like unpaid rent', () => {
    let s = act(edit(loansOn({ collateralLoanPercent: 100, seizureValue: 'mortgagePlusBuildings', goSalary: 0 }), (d) => own(d, 0, 1)), { type: 'takeLoan', seat: 0, amount: 60, passes: 3, collateral: [1] }).s;
    s = edit(s, (d) => {
      d.players[0].cash = 10;
      own(d, 0, 5);
    });
    const r = act(toGo(s), { type: 'roll', seat: 0 });
    // Balance $60 + $6 interest − seizure $30 (mortgage value) = $36 shortfall > $10 cash → raise money.
    expect(r.s.phase).toBe('debt');
    expect(r.s.debts[0]).toMatchObject({ from: 0, to: 'bank', amount: 36 });
  });

  it('missed unsecured payment: the installment is owed to the bank', () => {
    let s = act(loansOn({ goSalary: 0 }), { type: 'takeLoan', seat: 0, amount: 600, passes: 3, collateral: [] }).s;
    s = edit(s, (d) => {
      d.players[0].cash = 50;
      own(d, 0, 39);
    });
    const r = act(toGo(s), { type: 'roll', seat: 0 });
    expect(r.s.phase).toBe('debt');
    expect(r.s.debts[0]).toMatchObject({ amount: 260 });
    expect(r.s.players[0].loans[0]).toMatchObject({ principal: 400, passesLeft: 2 });
  });

  it('seized property can return unowned instead of auction (setting)', () => {
    let s = act(edit(loansOn({ seizedPropertyTo: 'unowned', goSalary: 0 }), (d) => own(d, 0, 39)), { type: 'takeLoan', seat: 0, amount: 100, passes: 3, collateral: [39] }).s;
    s = edit(s, (d) => (d.players[0].cash = 0));
    const r = act(toGo(s), { type: 'roll', seat: 0 });
    expect(r.s.tiles[39].owner).toBeNull();
    expect(r.s.phase).not.toBe('auction');
  });

  it('seizure value settings', () => {
    const seized = (seizureValue: Rules['seizureValue']) => {
      let s = act(edit(loansOn({ seizureValue, goSalary: 0, seizedPropertyTo: 'unowned' }), (d) => own(d, 0, 39)), { type: 'takeLoan', seat: 0, amount: 100, passes: 3, collateral: [39] }).s;
      s = edit(s, (d) => (d.players[0].cash = 0));
      return act(toGo(s), { type: 'roll', seat: 0 }).s.players[0].cash;
    };
    expect(seized('purchase')).toBe(400 - 110);
    expect(seized('mortgagePlusBuildings')).toBe(200 - 110);
  });
});

describe('loans and other rules', () => {
  it('no building while a loan is unpaid (setting)', () => {
    const base = (rules = {}) => act(edit(loansOn(rules), (d) => own(d, 0, 1, 3)), { type: 'takeLoan', seat: 0, amount: 100, passes: 3, collateral: [] }).s;
    expect(act(base(), { type: 'build', seat: 0, tile: 1 }).s.tiles[1].buildings).toBe(1);
    expect(() => apply(base({ noBuildWithLoan: true }), { type: 'build', seat: 0, tile: 1 })).toThrow(/loan/);
  });

  it('a loan can be taken to raise money; bankruptcy only when even borrowing falls short', () => {
    const s0 = edit(withDice(loansOn(), 2, 3), (d) => {
      d.players[0].position = 34;
      own(d, 1, 37, 39);
      d.tiles[37].buildings = 1;
      d.tiles[39].buildings = 1;
      d.bank.houses = 30;
      d.players[0].cash = 50;
    });
    const r = act(s0, { type: 'roll', seat: 0 });
    expect(r.s.phase).toBe('debt');
    expect(legalActions(r.s, 0).some((a) => a.type === 'declareBankruptcy')).toBe(false);
    const paid = act(r.s, { type: 'takeLoan', seat: 0, amount: 200, passes: 3, collateral: [] }).s;
    expect(paid.phase).toBe('postRoll');
  });

  it('bankruptcy cancels loans; bank-backed bots never borrow', () => {
    const s = act(loansOn({}, 3), { type: 'takeLoan', seat: 0, amount: 100, passes: 3, collateral: [] }).s;
    expect(act(s, { type: 'forfeit', seat: 0 }).s.players[0].loans).toEqual([]);
    const bb = edit(game(2, { rules: { loans: true }, kinds: ['bankBot', 'human'] }), () => {});
    expect(() => apply(bb, { type: 'takeLoan', seat: 0, amount: 100, passes: 3, collateral: [] })).toThrow(/never borrow/);
  });

  it('interest rate is fixed when the loan is taken', () => {
    const s = run(loansOn({ loanInterestPercent: 20 }), { type: 'takeLoan', seat: 0, amount: 500, passes: 5, collateral: [] }).s;
    expect(s.players[0].loans[0].rate).toBe(20);
  });
});
