const L = require('./lib');
const { G, T, GROUP_TILES, P, OWN, BLD, MORT, money, unmort, buildings, glyph, prompts, tok, padBadge, btn, card, slot, emptySlot, deedDetail, voucher, page, lockIcon } = L;

const CSS2 = `
.inv{left:24px;top:24px;width:1872px;height:1032px;padding:18px 24px 14px;display:flex;flex-direction:column;gap:12px}
.ihead{height:78px;display:flex;align-items:center;gap:20px}
.stat{display:flex;flex-direction:column;gap:6px;padding:0 18px;border-left:1.5px solid rgba(43,33,25,.14)}
.statv{font:800 26px/1 Fraunces,serif}
.ibody{display:flex;gap:24px;height:834px}
.binder{width:1236px;display:flex;gap:0}
.bpage{width:598px;height:100%;background:#F3EAD6;border-radius:10px;box-shadow:inset 0 0 0 1.5px rgba(43,33,25,.12),inset 0 2px 8px rgba(43,33,25,.08);padding:6px 12px}
.spine{width:40px;display:flex;flex-direction:column;justify-content:space-around;align-items:center}
.ring{width:34px;height:16px;border-radius:9px;border:4px solid #B48A3E;box-shadow:inset 0 1px 0 #FFF3C9,0 2px 3px rgba(10,5,2,.4);background:transparent}
.brow{height:137px;display:flex;align-items:center;gap:6px;border-bottom:1.5px dashed rgba(43,33,25,.14)}
.brow:last-child{border-bottom:0}
.blab{width:122px;flex:none;display:flex;flex-direction:column;gap:6px;align-self:center}
.bgname{display:flex;align-items:center;gap:7px;font:700 14px/1.1 'Source Sans 3',sans-serif;letter-spacing:1.5px;text-transform:uppercase;color:#2B2119}
.bcount{font:800 24px/1 Fraunces,serif}
.bcount small{font:600 15px/1 'Source Sans 3',sans-serif;color:#5E4C3B;margin-left:4px}
.btags{display:flex;flex-direction:column;align-items:flex-start;gap:4px}
.slots{display:flex;align-items:center;gap:2px}
.nopr{height:122px;flex:1;margin:5px;border:2px dashed rgba(43,33,25,.2);border-radius:8px;display:grid;place-items:center;font:600 16px/1.3 'Source Sans 3',sans-serif;color:#5E4C3B;text-align:center;padding:0 20px}
.dpane{width:564px;background:#F6EEDB;border-radius:12px;box-shadow:inset 0 0 0 1.5px rgba(43,33,25,.1);padding:16px 18px;display:flex;flex-direction:column;gap:14px}
.dphead{display:flex;align-items:center;gap:12px}
.dpt{font:800 26px/1.05 Fraunces,serif}
.dps{font:600 16px/1.2 'Source Sans 3',sans-serif;color:#5E4C3B;margin-top:3px}
.dprow{display:flex;gap:16px}
.side{display:flex;flex-direction:column;gap:18px;width:156px;padding-top:4px}
.si .sv{font:800 27px/1.05 Fraunces,serif;margin-top:5px}
.si .sv.ox{color:#8E2F23}
.si .sv.fo{color:#2F5D46}
.si .ss{font:600 15px/1.3 'Source Sans 3',sans-serif;color:#5E4C3B;margin-top:4px}
.sib{display:flex;gap:2px;margin-top:8px;flex-wrap:wrap}
.acts{display:flex;flex-direction:column;gap:9px;margin-top:2px}
.acts .btn{width:100%;padding-left:18px}
.foot{height:60px;border-top:1.5px solid rgba(43,33,25,.12);display:flex;align-items:center;justify-content:space-between;padding-top:6px}
.pnote{font:600 16px/1.35 'Source Sans 3',sans-serif;color:#5E4C3B}
`;

const ROWS1 = ['brown', 'lightBlue', 'yellow', 'orange', 'red', 'pink'];
const ROWS2 = ['green', 'darkBlue', 'rail', 'util', 'jail', 'prom'];

const V_ALL = [
  { t: 'v', kind: 'rf', g: 'pink', n: 2, left: 1, by: 'R', to: 'L', tag: 'HELD', tagc: '#2F5D46' },
  { t: 'v', kind: 'rf', g: 'orange', n: 3, left: 3, by: 'L', to: 'R', tag: 'GIVEN', tagc: '#5E4C3B' },
  { t: 'v', kind: 'nb', g: 'lightBlue', n: 3, left: 2, by: 'L', to: 'R', tag: 'GIVEN', tagc: '#5E4C3B' },
];

function rowTags(g, st) {
  if (st !== 4) return '';
  if (g === 'lightBlue') return `<span class="tag" style="background:#8E2F23">No building · 2 rounds</span>`;
  if (g === 'orange') return `<span class="tag" style="background:#5E4C3B">Riley rent-free · 3</span>`;
  if (g === 'pink') return `<span class="tag" style="background:#2F5D46">You ride free · 1</span>`;
  return '';
}

function brow(g, st, focusName) {
  if (g === 'jail') {
    return `<div class="brow"><div class="blab"><div class="bgname">Jail cards</div><div class="bcount">1<small>of 2</small></div></div><div class="slots">${slot(card({ t: 'gojf' }, 'thumb'), { focus: focusName === 'gojf' })}<div class="eslot"><div class="eband" style="background:#2F5D46"></div><div class="ename">Jail Free · Chest</div><div class="eown un">In deck</div></div></div></div>`;
  }
  if (g === 'prom') {
    const vs = st === 4 ? V_ALL : [];
    const inner = vs.length
      ? vs.map((v, i) => slot(card(v, 'thumb'), { focus: i === 2, tag: v.tag, tagc: v.tagc })).join('')
      : `<div class="nopr">No active promises. Vouchers you give or hold in trades land here.</div>`;
    return `<div class="brow"><div class="blab"><div class="bgname">Promises</div><div class="bcount">${vs.length}<small>active</small></div></div><div class="slots" style="flex:1">${inner}</div></div>`;
  }
  const tiles = GROUP_TILES[g];
  const owned = tiles.filter((n) => OWN[n] === 'L').length;
  const full = owned === tiles.length;
  const slots = tiles
    .map((n) => {
      if (OWN[n] !== 'L') return emptySlot(n, OWN[n]);
      const o = {};
      if (focusName === n) o.focus = true;
      if (focusName === '@sel:' + n) o.sel = true;
      return slot(card({ t: 'deed', name: n }, 'thumb'), o);
    })
    .join('');
  const chip = g === 'rail' || g === 'util' ? '' : `<span class="chip" style="background:${G[g].c}"></span>`;
  return `<div class="brow"><div class="blab"><div class="bgname">${chip}${G[g].n}</div><div class="bcount">${owned}<small>of ${tiles.length}</small></div><div class="btags">${full ? '<span class="tag full">FULL SET</span>' : ''}${rowTags(g, st)}</div></div><div class="slots">${slots}</div></div>`;
}

function si(label, value, sub, cls = '') {
  return `<div class="si"><div class="lab">${label}</div><div class="sv ${cls}">${value}</div>${sub ? `<div class="ss">${sub}</div>` : ''}</div>`;
}

function detail(st) {
  const L0 = (title, sub, chip) => `<div class="dphead">${chip}<div><div class="dpt">${title}</div><div class="dps">${sub}</div></div></div>`;
  const chipOf = (g) => (g === 'rail' ? '<svg width="34" height="34" aria-hidden="true"><use href="#rr"></use></svg>' : `<span class="chip" style="width:30px;height:20px;background:${G[g].c}"></span>`);
  if (st === 1) {
    return `${L0('North Line', 'Railroads · you own 2 of 4', chipOf('rail'))}
<div class="dprow">${deedDetail('North Line', { owned: 2 })}<div class="side">${si('Rent now', '$50', '2 lines owned')}${si('Next line', '$100', 'South and West Line belong to Riley')}${si('Mortgage', '$100', 'Not mortgaged')}</div></div>
<div class="acts">${btn('Mortgage North Line', { hint: '+$100' })}${btn('Build', { dis: 1, why: 'Railroads can’t have buildings.' })}</div>`;
  }
  if (st === 2) {
    return `${L0('Harbor View', 'Light Blue · full set · 3 houses on each lot', chipOf('lightBlue'))}
<div class="dprow">${deedDetail('Harbor View')}<div class="side">${si('Rent now', '$300', 'with 3 houses')}<div class="si"><div class="lab">Buildings</div><div class="sib">${buildings(3, 26)}</div><div class="ss">Bank: 4th house $50</div></div>${si('Set', '3 of 3', 'Lilac Row, Bluebell Way: 3 houses each')}</div></div>
<div class="acts">${btn('Build a house', { focus: 1, hint: '−$50 · rent $300 → $450' })}${btn('Sell a house', { hint: '+$25 · rent → $100' })}${btn('Mortgage', { dis: 1, why: 'Sell all 9 Light Blue houses first.' })}</div>`;
  }
  if (st === 3) {
    const t = T['Sapphire Heights'];
    return `${L0('Sapphire Heights', 'Dark Blue · you own 1 of 2 · mortgaged', chipOf('darkBlue'))}
<div class="dprow">${deedDetail('Sapphire Heights')}<div class="side">${si('Status', 'Mortgaged', 'Earns no rent until lifted', 'ox')}${si('Lift for', money(unmort(t)), `${money(t.mort)} + 10% interest`)}${si('Set', '1 of 2', 'Midnight Park belongs to Sam')}</div></div>
<div class="acts">${btn('Unmortgage', { primary: 1, hint: `−${money(unmort(t))} · you have $640` })}${btn('Build a house', { dis: 1, why: 'Mortgaged, and you don’t own Midnight Park.' })}${btn('Sell', { dis: 1, why: 'No buildings to sell.' })}</div>`;
  }
  // state 4: focused voucher
  const v = V_ALL[2];
  return `${L0('No Building · Light Blue', 'You promised Riley · 2 of 3 rounds left', chipOf('lightBlue'))}
<div class="dprow">${voucher(v, 'detail')}<div class="side">${si('Blocks', 'Building', 'Houses and hotels on Lilac Row, Bluebell Way, Harbor View', 'ox')}${si('Still allowed', 'Selling', 'You can sell houses any time')}${si('Ends', '2 rounds', 'After everyone has taken 2 more turns')}</div></div>
<div class="acts">${btn('Build on Light Blue', { dis: 1, why: 'Blocked by your promise to Riley for 2 more rounds.' })}<div class="pnote">Other active promises: you ride rent-free on Riley’s Pink lots for 1 more landing; Riley rides free on your Orange lots for 3 landings.</div></div>`;
}

function inventory(st) {
  const focus = { 1: 'North Line', 2: '@sel:Harbor View', 3: 'Sapphire Heights', 4: null }[st];
  const foot =
    st === 2
      ? prompts([['dud', 'Choose action'], ['confirm', 'Build'], ['back', 'Back to binder']], 'switch')
      : prompts([['dpad', 'Move'], ['confirm', 'Actions'], [['l', 'r'], 'Other players (view only)'], ['back', 'Close']], 'switch');
  const body = `<div class="ghostboard"></div><div class="dimscene"></div>
<div class="panel inv">
<div class="ihead">${tok(P.L, 64)}<div><div class="eyebrow">Inventory</div><div class="h1">Lawrence’s binder</div></div>
<div style="flex:1"></div>
<div class="stat"><span class="lab">Deeds</span><span class="statv">8</span></div>
<div class="stat"><span class="lab">Full sets</span><span class="statv">1</span></div>
<div class="stat"><span class="lab">Houses</span><span class="statv">9</span></div>
<div class="stat" style="padding-right:0"><span class="lab">Cash</span><span class="amt" style="font-size:38px">$640</span></div>
</div>
<div class="ibody">
<div class="binder"><div class="bpage">${ROWS1.map((g) => brow(g, st, focus)).join('')}</div><div class="spine"><span class="ring"></span><span class="ring"></span><span class="ring"></span></div><div class="bpage">${ROWS2.map((g) => brow(g, st, focus)).join('')}</div></div>
<div class="dpane">${detail(st)}</div>
</div>
<div class="foot">${foot}${padBadge(P.L)}</div>
</div>`;
  return page(`Inventory — state ${st}`, body, 1080, 1920, CSS2);
}

module.exports = { inventory, CSS2 };
