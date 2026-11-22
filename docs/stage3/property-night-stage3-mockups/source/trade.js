const L = require('./lib');
const { G, T, P, money, unmort, glyph, coin, prompts, tok, padBadge, btn, stepper, card, slot, page, lockIcon, swapIcon, check, voucher } = L;

const CSS3 = `
.tp{left:24px;top:24px;width:1872px;height:1032px;padding:16px 24px 12px;display:flex;flex-direction:column;gap:12px}
.thead{height:78px;display:flex;align-items:center;gap:18px;flex:none}
.pick{display:flex;align-items:center;gap:10px;margin-left:24px}
.pbtn{height:64px;display:flex;align-items:center;gap:10px;padding:0 18px 0 8px;border-radius:10px;background:#F3EAD6;box-shadow:inset 0 0 0 1.5px rgba(43,33,25,.18);font:800 21px/1 Fraunces,serif}
.pbtn.sel{background:#fff;box-shadow:inset 0 0 0 3px #2B2119}
.pbtn small{font:700 14px/1 'Source Sans 3',sans-serif;background:#5E4C3B;color:#FBF6EA;padding:4px 6px;border-radius:4px;letter-spacing:1px}
.tbody{display:flex;gap:24px;flex:1;min-height:0}
.mb{width:590px;background:#F3EAD6;border-radius:12px;box-shadow:inset 0 0 0 1.5px rgba(43,33,25,.12),inset 0 2px 8px rgba(43,33,25,.08);padding:14px 16px;display:flex;flex-direction:column;gap:10px;position:relative}
.mbh{display:flex;align-items:center;gap:12px;height:52px}
.mbh .pname{font-size:24px}
.mbh .mcash{margin-left:auto;text-align:right}
.mbh .mcash b{display:block;font:800 26px/1 Fraunces,serif}
.pockets{display:flex;flex-wrap:wrap;gap:10px 14px;align-content:flex-start}
.pocket{display:flex;flex-direction:column;gap:2px}
.plab{display:flex;align-items:center;gap:6px;font:700 14px/1 'Source Sans 3',sans-serif;letter-spacing:1.2px;text-transform:uppercase;color:#2B2119;height:20px;padding-left:5px}
.plab b{font:800 15px/1 Fraunces,serif;letter-spacing:0;color:#5E4C3B}
.pslots{display:flex}
.addv{width:92px;height:122px;border-radius:9px;border:2.5px dashed #2F5D46;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;color:#2F5D46;font:800 16px/1.1 Fraunces,serif;text-align:center;background:rgba(251,246,234,.7)}
.addv .plus{font:400 38px/1 'Source Sans 3',sans-serif}
.addv.locked{border-color:rgba(43,33,25,.3);color:#5E4C3B;background:rgba(43,33,25,.05);font:700 14px/1.15 'Source Sans 3',sans-serif;padding:0 6px}
.slot.f .addv{border-color:#FBF6EA;color:#FBF6EA;background:transparent}
.mid{width:596px;display:flex;flex-direction:column;gap:12px}
.tray{flex:1;border-radius:14px;background:linear-gradient(180deg,#4A2E1F,#3B2619);box-shadow:inset 0 4px 14px rgba(0,0,0,.55),inset 0 0 0 3px #8F672A,0 1px 0 rgba(255,243,201,.25);padding:16px 14px;display:flex;flex-direction:column;gap:10px;position:relative}
.trh{display:flex;align-items:center;justify-content:space-between;color:#FBF6EA}
.trh .lab{color:#F3EAD6}
.trh .who{display:flex;align-items:center;gap:8px;font:800 18px/1 Fraunces,serif}
.trh .who i{width:12px;height:12px;border-radius:50%;display:inline-block;box-shadow:0 0 0 1.5px #FBF6EA}
.trcols{display:flex;gap:0;flex:1}
.trcol{flex:1;display:flex;flex-direction:column;gap:8px;padding:4px 8px}
.trcol+.trcol{border-left:1.5px dashed rgba(251,246,234,.25)}
.trgrid{display:flex;flex-wrap:wrap;gap:4px;justify-content:center}
.trempty{border:2px dashed rgba(251,246,234,.35);border-radius:10px;height:122px;margin:5px;display:grid;place-items:center;color:#F3EAD6;font:600 16px/1.3 'Source Sans 3',sans-serif;text-align:center;padding:0 14px;width:100%}
.trdrop{width:92px;height:122px;margin:5px;border:2px dashed rgba(251,246,234,.3);border-radius:8px;display:grid;place-items:center;text-align:center;color:#EADFC6;font:600 14px/1.25 'Source Sans 3',sans-serif;padding:0 6px}
.trsum{color:#F3EAD6;font:600 15px/1.3 'Source Sans 3',sans-serif;text-align:center;margin-top:auto}
.lockline{display:flex;align-items:center;gap:10px;background:#FBF6EA;border-radius:8px;padding:10px 14px;font:700 17px/1.2 'Source Sans 3',sans-serif;color:#2B2119;box-shadow:inset 0 0 0 1.5px #8E2F23}
.lockline b{color:#8E2F23}
.mbtns{display:flex;gap:12px}
.cashpop{position:absolute;z-index:6;background:#FBF6EA;border-radius:12px;padding:12px 14px 14px;box-shadow:0 2px 0 rgba(43,33,25,.08),0 14px 30px rgba(10,5,2,.45);display:flex;flex-direction:column;gap:10px;width:330px}
.cashpop:after{content:'';position:absolute;left:44px;top:-10px;width:20px;height:20px;background:#FBF6EA;transform:rotate(45deg)}
.cphint{display:flex;gap:16px;font:600 15px/1 'Source Sans 3',sans-serif;color:#5E4C3B;align-items:center}
.cphint span{display:inline-flex;align-items:center;gap:6px}
.tfoot{height:58px;border-top:1.5px solid rgba(43,33,25,.12);display:flex;align-items:center;justify-content:space-between;padding-top:4px;flex:none}
.deal{flex:none;background:#F3EAD6;border-radius:12px;box-shadow:inset 0 0 0 1.5px rgba(43,33,25,.12);padding:14px 22px;display:flex;gap:22px;align-items:flex-start}
.deal .dl{display:flex;flex-direction:column;gap:6px;width:120px;flex:none;padding-top:4px}
.deal .dtx{font:500 21px/1.42 Fraunces,serif;color:#2B2119;font-variation-settings:'opsz' 24}
.deal .dtx b{font-weight:800}
.deal .dtx em{font-style:normal;background:rgba(195,148,69,.3);box-shadow:0 0 0 3px rgba(195,148,69,.3);border-radius:2px}
.deal .dtx .pn{font-weight:800;padding:0 2px;border-bottom:3px solid}
.deal.big .dtx{font-size:24px}
/* promise sheet */
.veil{position:absolute;inset:0;background:rgba(20,10,4,.6);z-index:20}
.vsheet{position:absolute;z-index:21;left:300px;top:110px;width:1320px;height:860px;padding:26px 32px;display:flex;flex-direction:column;gap:16px}
.vsh{display:flex;align-items:flex-end;justify-content:space-between}
.vgrid{display:flex;gap:36px;flex:1}
.vleft{flex:1;display:flex;flex-direction:column;gap:18px}
.vrow{display:flex;flex-direction:column;gap:10px}
.kinds{display:flex;gap:16px}
.kind{flex:1;display:flex;gap:14px;align-items:center;padding:10px 16px 10px 10px;border-radius:12px;background:#F3EAD6;box-shadow:inset 0 0 0 1.5px rgba(43,33,25,.18);min-height:150px;text-align:left}
.kind.sel{background:#fff;box-shadow:inset 0 0 0 3px #2B2119}
.kind .kt{font:800 22px/1.1 Fraunces,serif}
.kind .kd{font:500 16px/1.35 'Source Sans 3',sans-serif;color:#5E4C3B;margin-top:6px}
.kind.f .kd{color:#FFFDF6}
.grow{display:flex;gap:14px;align-items:center}
.swatches{display:flex;gap:6px;flex-wrap:wrap}
.sw{height:40px;min-width:40px;border-radius:7px;box-shadow:inset 0 0 0 1.5px #2B2119;display:grid;place-items:center;font:700 14px/1 'Source Sans 3',sans-serif;padding:0 8px}
.sw.on{box-shadow:inset 0 0 0 1.5px #2B2119,0 0 0 3px #FBF6EA,0 0 0 6px #2B2119}
.sw.no{opacity:.28}
.vhelp{font:600 16px/1.4 'Source Sans 3',sans-serif;color:#5E4C3B}
.vright{width:400px;display:flex;flex-direction:column;align-items:center;gap:12px;background:#F3EAD6;border-radius:14px;padding:18px 0;box-shadow:inset 0 0 0 1.5px rgba(43,33,25,.1)}
/* review */
.banner{flex:none;margin:-16px -24px 0;border-radius:16px 16px 0 0;padding:16px 28px;display:flex;align-items:center;gap:20px;color:#FBF6EA;height:112px}
.banner .h1{color:#FBF6EA;margin:0}
.banner .bs{font:600 19px/1.3 'Source Sans 3',sans-serif;opacity:.95;margin-top:6px}
.paused{display:flex;align-items:center;gap:8px;font:700 16px/1.2 'Source Sans 3',sans-serif;background:rgba(251,246,234,.18);padding:10px 14px;border-radius:10px}
.rail{width:300px;background:#F3EAD6;border-radius:12px;box-shadow:inset 0 0 0 1.5px rgba(43,33,25,.12);padding:16px;display:flex;flex-direction:column;gap:12px}
.rail.wait{opacity:.92}
.rch{display:flex;align-items:center;gap:10px}
.chg{display:flex;flex-direction:column;gap:2px;padding:8px 0;border-top:1.5px dashed rgba(43,33,25,.14)}
.chg .cv{font:800 21px/1.15 Fraunces,serif}
.chg .cv .ar{color:#5E4C3B;font-weight:500}
.chg .cs{font:600 15px/1.3 'Source Sans 3',sans-serif;color:#5E4C3B}
.heads{background:#FBF6EA;border-radius:10px;box-shadow:inset 0 0 0 1.5px #8E2F23;padding:12px 14px;font:600 16px/1.35 'Source Sans 3',sans-serif}
.heads b{color:#8E2F23;display:block;font:700 14px/1 'Source Sans 3',sans-serif;letter-spacing:2px;margin-bottom:6px}
.waitpill{align-self:flex-start;font:700 15px/1 'Source Sans 3',sans-serif;background:#EADFC6;color:#5E4C3B;padding:8px 12px;border-radius:16px}
.rcenter{flex:1;display:flex;flex-direction:column;gap:12px}
.rtray{flex:1;display:flex;flex-direction:row !important;gap:0;padding:12px 10px;align-items:stretch}
.rhalf{flex:1;display:flex;flex-direction:column;gap:10px;padding:0 10px}
.rhalf+.rhalf{border-left:1.5px dashed rgba(251,246,234,.25)}
.rcards{display:grid;grid-template-columns:repeat(2,200px);gap:12px 16px;justify-content:center}
.holdring{width:44px;height:44px;border-radius:50%;flex:none;background:conic-gradient(#FFFDF6 0 35%,rgba(255,253,246,.25) 35% 100%);display:grid;place-items:center}
.holdring>span{width:34px;height:34px;border-radius:50%;background:#2F5D46;display:grid;place-items:center}
`;

// ---------- data ----------
const LP = [
  { g: 'lightBlue', items: ['Lilac Row', 'Bluebell Way', 'Harbor View'], blocked: 'Has houses' },
  { g: 'orange', items: ['Amber Avenue', 'Marigold Street'] },
  { g: 'darkBlue', items: ['Sapphire Heights'] },
  { g: 'rail', items: ['North Line', 'East Line'] },
  { g: 'jail', items: ['gojf'] },
  { g: 'cash' },
  { g: 'prom' },
];
const RP = [
  { g: 'yellow', items: ['Goldfinch Lane'] },
  { g: 'orange', items: ['Sunset Drive'] },
  { g: 'pink', items: ['Rose Court', 'Peony Place'] },
  { g: 'green', items: ['Fernwood Avenue'] },
  { g: 'rail', items: ['South Line', 'West Line'] },
  { g: 'util', items: ['Water Works'] },
  { g: 'cash' },
  { g: 'prom' },
];
const CASH = { L: 640, R: 910 };
const VNB = { t: 'v', kind: 'nb', g: 'orange', n: 2, by: 'L', to: 'R' };
const VRF = { t: 'v', kind: 'rf', g: 'rail', n: 3, by: 'R', to: 'L' };
const OFFER_IN = new Set(['East Line', 'gojf', 'Sunset Drive']);

function itemCard(id, size) {
  if (id === 'gojf') return card({ t: 'gojf' }, size);
  return card({ t: 'deed', name: id }, size);
}
function countLabel(g, n) {
  if (g === 'jail') return `Jail card <b>${n}</b>`;
  const tot = { brown: 2, darkBlue: 2, rail: 4, util: 2 }[g] || 3;
  const chip = g === 'rail' || g === 'util' ? '' : `<span class="chip" style="background:${G[g].c}"></span>`;
  return `${chip}${G[g].n} <b>${n}/${tot}</b>`;
}

// mini binder for one player
function miniBinder(pid, o) {
  const p = P[pid];
  const pockets = (pid === 'L' ? LP : RP)
    .map((pk) => {
      if (pk.g === 'cash') {
        const offer = pid === 'L' ? o.cashL : 0;
        const s = slot(card({ t: 'cash', amount: CASH[pid] }, 'thumb'), { sel: o.focus === 'cash' + pid, tag: offer ? `−${money(offer)}` : '', tagc: '#2F5D46' });
        return `<div class="pocket"><div class="plab">Cash</div><div class="pslots">${s}</div></div>`;
      }
      if (pk.g === 'prom') {
        if (o.locked) return `<div class="pocket"><div class="plab">Promise</div><div class="pslots"><div class="slot" aria-disabled="true"><div class="addv locked">${lockIcon(26)}<span>Promises off</span></div></div></div></div>`;
        return `<div class="pocket"><div class="plab">Promise</div><div class="pslots">${slot('<div class="addv"><span class="plus">+</span><span>Promise</span></div>', { focus: o.focus === 'prom' + pid })}</div></div>`;
      }
      const slots = pk.items
        .map((id) => {
          const so = {};
          if (pk.blocked) so.blocked = pk.blocked;
          if (OFFER_IN.has(id) && o.offer) so.inoffer = true;
          if (o.focus === id) so.focus = true;
          return slot(itemCard(id, 'thumb'), so);
        })
        .join('');
      return `<div class="pocket"><div class="plab">${countLabel(pk.g, pk.items.length)}</div><div class="pslots">${slots}</div></div>`;
    })
    .join('');
  return `<div class="mb">${o.dim ? '' : ''}<div class="mbh">${tok(p, 48)}<span class="pname">${p.name}</span><div class="mcash"><span class="lab">Cash</span><b>${money(CASH[pid])}</b></div></div><div class="pockets">${pockets}</div>${o.extra || ''}</div>`;
}

function trayCol(pid, items, o = {}) {
  const p = P[pid];
  const cards = items.length
    ? items.map((it) => slot(it.html, { focus: it.focus, newly: it.newly, tag: it.tag, tagc: it.tagc })).join('') + (o.noDrop ? '' : `<div class="trdrop">${o.drop || 'Confirm on a card to add it'}</div>`)
    : `<div class="trempty">${o.empty || 'Nothing yet'}</div>`;
  return `<div class="trcol"><div class="trh"><span class="who"><i style="background:${p.col}"></i>${p.name} gives</span></div><div class="trgrid">${cards}</div>${o.sum ? `<div class="trsum">${o.sum}</div>` : ''}</div>`;
}

function header(o) {
  const partners = `<div class="pick"><span class="lab">With</span><button class="pbtn sel">${tok(P.R, 44)}Riley</button><button class="pbtn">${tok(P.S, 44)}Sam${o.locked ? ' <small>BOT</small>' : ''}</button></div>`;
  return `<div class="thead">${tok(P.L, 64)}<div><div class="eyebrow">Trade · ${o.counter ? 'counter offer' : 'new offer'}</div><div class="h1">Lawrence ⇄ Riley</div></div>${partners}<div style="flex:1"></div>${padBadge(P.L)}</div>`;
}

const PROMPTS_BUILD = prompts([['dpad', 'Move'], ['confirm', 'Add / remove'], [['l', 'r'], 'Jump column'], ['trade', 'Propose'], ['back', 'Cancel']], 'switch');

function dealText(stage, view = 'L') {
  const nm = (id) => `<span class="pn" style="border-color:${P[id].col}">${P[id].name}</span>`;
  if (view === 'R')
    return `<b>You get</b> East Line, $150 and a Get Out of Jail Free card, and ${nm('L')} promises <b>not to build on Orange for 2 rounds</b>. <b>You give</b> Sunset Drive, and you promise ${nm('L')} <b>no rent on your Railroads for 3 of his landings</b>.`;
  const base = `${nm('L')} gives <b>East Line</b>, <b>$150</b> and a <b>Get Out of Jail Free</b> card`;
  if (stage === 1) return `${base}. ${nm('R')} gives <b>Sunset Drive</b>. <span style="color:#5E4C3B">No promises yet.</span>`;
  if (stage === 4) return `${base}. ${nm('R')} gives <b>Sunset Drive</b>. <span style="color:#5E4C3B">Promises are off in this game.</span>`;
  return `${base}, and promises <em>not to build on Orange for 2 rounds</em>. In return, ${nm('R')} gives <b>Sunset Drive</b> and <b>Rent-Free on Railroads for 3 landings</b>.`;
}
function deal(stage, view, big) {
  return `<div class="deal${big ? ' big' : ''}"><div class="dl"><span class="eyebrow">The deal</span><span class="lab" style="letter-spacing:1px">${view === 'R' ? 'For Riley' : 'In plain words'}</span></div><div class="dtx">${dealText(stage, view)}</div></div>`;
}

// ---------- A / C: across the table ----------
function across(stage, withFooter) {
  const locked = stage === 4;
  if (stage === 3) return reviewAcross(withFooter);
  const o = { offer: true, locked, cashL: 150 };
  const focusL = stage === 1 ? 'cashL' : null;
  const lItems = [
    { html: itemCard('East Line', 'thumb') },
    { html: card({ t: 'cash', amount: 150 }, 'thumb') },
    { html: itemCard('gojf', 'thumb'), newly: stage === 1 },
  ];
  const rItems = [{ html: itemCard('Sunset Drive', 'thumb') }];
  if (stage === 2) {
    rItems.push({ html: card(VRF, 'thumb') });
  }
  let cashpop = '';
  if (stage === 1) {
    cashpop = `<div class="cashpop up" style="left:64px;top:${withFooter ? 708 : 712}px"><span class="lab">Cash to give Riley</span>${stepper('$150', { focus: 1, w: 302 })}<div class="cphint"><span>${glyph('dlr', 'switch', 44)}$10</span><span>${glyph('l', 'switch', 44)}${glyph('r', 'switch', 44)}$100</span><span>max $640</span></div></div>`;
  }
  const lockLine = locked ? `<div class="lockline">${lockIcon(24, '#8E2F23')}<span><b>Promises are off:</b> Sam is a normal bot.</span></div>` : '';
  const sumL = 'List value $200 · cash $150 · 1 card';
  const sumR = stage === 2 ? 'List value $200 · 1 promise' : 'List value $200';
  const tray = `<div class="tray">${lockLine}<div class="trcols">${trayCol('L', lItems, { sum: sumL })}<div style="align-self:center;margin:0 -6px">${swapIcon(34, '#C39445')}</div>${trayCol('R', rItems, { sum: sumR })}</div></div>`;
  const mbtns = `<div class="mbtns">${btn('Propose to Riley', { glyph: 'trade', primary: 1, focus: locked, w: 360 })}${btn('Cancel', { glyph: 'back', w: 224 })}</div>`;
  const body = `<div class="tbody">${miniBinder('L', { ...o, focus: focusL })}<div class="mid">${tray}${mbtns}</div>${miniBinder('R', { ...o })}</div>${cashpop}`;
  let sheet = '';
  if (stage === 2) sheet = promiseSheet(withFooter);
  const foot =
    stage === 1
      ? prompts([['dlr', '±$10'], [['l', 'r'], '±$100'], ['confirm', 'Done'], ['back', 'Undo']], 'switch')
      : PROMPTS_BUILD;
  const inner = `<div class="panel tp" style="position:absolute">${header({ locked })}${body}${withFooter ? deal(stage, 'L') : ''}<div class="tfoot">${foot}<span class="pnote" style="font:600 16px/1.3 'Source Sans 3',sans-serif;color:#5E4C3B">${stage === 1 ? 'Get Out of Jail Free just slid into the tray' : locked ? 'Properties, cash and jail cards still trade normally' : 'Confirm on a promise in the tray edits it'}</span></div></div>${sheet}`;
  return `<div class="ghostboard"></div><div class="dimscene"></div>${inner}`;
}

function promiseSheet(withFooter) {
  const sw = L.SETS.map((g) => `<span class="sw${g === 'orange' ? ' on' : ''}" style="background:${G[g].c}" title="${G[g].n}"></span>`).join('') +
    `<span class="sw no" style="background:#2B2119;color:#FBF6EA">RR</span><span class="sw no" style="background:#2B2119;color:#FBF6EA">UT</span>`;
  return `<div class="veil"></div><div class="panel vsheet">
<div class="vsh"><div><div class="eyebrow">Promise voucher · Lawrence’s side</div><div class="h1">Lawrence promises Riley…</div></div>${padBadge(P.L)}</div>
<div class="vgrid"><div class="vleft">
<div class="vrow"><span class="lab">1 · Kind</span><div class="kinds">
<button class="kind">${voucher({ kind: 'rf', g: 'orange', n: 3, by: 'L', to: 'R' }, 'thumb')}<span><span class="kt" style="color:#2F5D46">Rent-Free</span><span class="kd" style="display:block">Riley pays you no rent on a whole group (a color set, all Railroads, or both Utilities) for N of her landings.</span></span></button>
<button class="kind sel">${voucher({ kind: 'nb', g: 'orange', n: 2, by: 'L', to: 'R' }, 'thumb')}<span><span class="kt" style="color:#8E2F23">No Building</span><span class="kd" style="display:block">You can’t build houses or hotels on one color set for N full rounds. Selling is still allowed.</span></span></button>
</div></div>
<div class="vrow"><span class="lab">2 · Group</span><div class="grow">${stepper('Orange', { focus: 1, w: 260 })}<div class="swatches">${sw}</div></div><span class="vhelp">No Building works on color sets only, so Railroads and Utilities are skipped.</span></div>
<div class="vrow"><span class="lab">3 · Length</span><div class="grow">${stepper('2 rounds', { w: 260 })}<span class="vhelp">One round = every player takes one turn. 1–20.</span></div></div>
<div style="display:flex;gap:12px;margin-top:auto">${btn('Add to offer', { glyph: 'trade', primary: 1, w: 330 })}${btn('Cancel', { glyph: 'back', w: 200 })}</div>
</div>
<div class="vright"><span class="lab">Preview</span>${voucher(VNB, 'detail')}</div></div>
<div class="tfoot" style="border-top:1.5px solid rgba(43,33,25,.12)">${prompts([['dud', 'Step'], ['dlr', 'Change'], ['trade', 'Add to offer'], ['back', 'Cancel']], 'switch')}<span class="pnote" style="font:600 16px/1.3 'Source Sans 3',sans-serif;color:#5E4C3B">Riley’s Rent-Free voucher (in the tray) opens this same sheet with its terms filled in.</span></div>
</div>`;
}

// review: Riley answers with her own controller
function banner() {
  return `<div class="banner" style="background:linear-gradient(90deg,#0F9C84,#0B7A67)">${tok(P.R, 76)}<div style="flex:1"><div class="h1">Riley, it’s your call</div><div class="bs">Lawrence sent you a trade. Answer with <b>your PS4 controller</b>.</div></div><div class="paused">${lockIcon(20, '#FBF6EA')}Lawrence’s controller is paused</div>${padBadge(P.R)}</div>`;
}
function rails() {
  const chg = (v, s) => `<div class="chg"><div class="cv">${v}</div>${s ? `<div class="cs">${s}</div>` : ''}</div>`;
  const left = `<div class="rail wait"><div class="rch">${tok(P.L, 48)}<span class="pname">Lawrence</span></div><span class="waitpill">Waiting for Riley</span>${chg('$640 <span class="ar">→</span> $490', 'Cash after the trade')}</div>`;
  const right = `<div class="rail"><div class="rch">${tok(P.R, 48)}<span class="pname">Riley · you</span></div>${chg('$910 <span class="ar">→</span> $1,060', 'Cash after the trade')}</div>`;
  return [left, right];
}
function reviewButtons(pad = 'ps') {
  return `<div class="mbtns" style="justify-content:center">${`<button class="btn primary f" style="width:400px"><span class="holdring"><span>${coin('cross', 30)}</span></span><span class="lbl">Accept<span class="why" style="font-weight:600">Hold to accept</span></span></button>`}${btn('Counter', { glyph: 'trade', pad, w: 260, hint: 'Edit and send back' })}${btn('Decline', { glyph: 'back', pad, w: 230 })}</div>`;
}
function reviewAcross(withFooter) {
  const [left, right] = rails();
  const std = (h) => h;
  const tray = `<div class="tray rtray"><div class="rhalf"><div class="trh"><span class="who"><i style="background:${P.L.col}"></i>You get · from Lawrence</span></div><div class="rcards">${std(card({ t: 'deed', name: 'East Line' }, 'std'))}${std(card({ t: 'cash', amount: 150 }, 'std'))}${std(card({ t: 'gojf' }, 'std'))}${std(voucher(VNB, 'std'))}</div></div><div style="align-self:center;margin:0 -10px">${swapIcon(40, '#C39445')}</div><div class="rhalf"><div class="trh"><span class="who"><i style="background:${P.R.col}"></i>You give · to Lawrence</span></div><div class="rcards">${std(card({ t: 'deed', name: 'Sunset Drive' }, 'std'))}${std(voucher(VRF, 'std'))}</div></div></div>`;
  const body = `<div class="tbody">${left}<div class="rcenter">${tray}${reviewButtons()}</div>${right}</div>`;
  const inner = `<div class="panel tp" style="position:absolute">${banner()}${body}${withFooter ? deal(3, 'R', true) : ''}<div class="tfoot">${prompts([['dlr', 'Move'], ['confirm', 'Hold to accept'], ['trade', 'Counter'], ['back', 'Decline']], 'ps')}<span class="pnote" style="font:600 16px/1.3 'Source Sans 3',sans-serif;color:#5E4C3B">Counter opens the same screen with sides swapped</span></div></div>`;
  return `<div class="ghostboard"></div><div class="dimscene"></div>${inner}`;
}

// ---------- B: contract sheet ----------
const CCSS = `
.contract{position:absolute;background:#FBF6EA;border-radius:8px;box-shadow:0 1px 0 #E2D2B0,0 2px 0 #D2BD95,0 3px 0 #C2AA7E,0 4px 0 #A98F63,0 24px 44px rgba(10,5,2,.5);padding:30px 44px 26px;display:flex;flex-direction:column;gap:12px}
.cfr1{position:absolute;inset:12px;box-shadow:inset 0 0 0 1.5px #2B2119;pointer-events:none}
.cfr2{position:absolute;inset:17px;box-shadow:inset 0 0 0 .8px #2B2119;pointer-events:none}
.ctitle{text-align:center}
.ctitle .t{font:900 46px/1 Fraunces,serif;font-variation-settings:'opsz' 144;letter-spacing:.5px}
.parties{display:flex;align-items:center;justify-content:center;gap:16px;font:500 21px/1 Fraunces,serif;color:#5E4C3B}
.parties .pn2{display:inline-flex;align-items:center;gap:10px;font:800 24px/1 Fraunces,serif;color:#2B2119}
.sech{display:flex;align-items:center;gap:12px;border-bottom:1.5px solid #2B2119;padding-bottom:6px}
.sech .sn{font:900 22px/1 Fraunces,serif}
.sech .st{font:700 15px/1 'Source Sans 3',sans-serif;letter-spacing:2.5px;text-transform:uppercase}
.sech .sp{flex:1}
.addc{height:64px;display:flex;align-items:center;gap:10px;padding:0 16px 0 6px;border-radius:10px;border:2px dashed #2F5D46;color:#2F5D46;font:700 18px/1 'Source Sans 3',sans-serif;background:transparent}
.addc.dis{border-color:rgba(43,33,25,.3);color:#5E4C3B}
.clauses{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px 18px}
.clause{display:flex;gap:12px;align-items:center;padding:4px 10px 4px 6px;border-radius:10px;background:rgba(243,234,214,.65);min-height:142px;position:relative}
.clause.new{box-shadow:inset 0 0 0 3px #C39445}
.clause .cn{font:900 22px/1 Fraunces,serif;color:#5E4C3B;width:28px;text-align:right;flex:none}
.clause .ct{flex:1;display:flex;flex-direction:column;gap:6px}
.clause .ctt{font:700 21px/1.2 Fraunces,serif}
.clause .cts{font:600 15px/1.3 'Source Sans 3',sans-serif;color:#5E4C3B}
.clause .cterm{display:flex;gap:8px;flex-wrap:wrap}
.newtag{position:absolute;top:-8px;right:10px;font:800 14px/1 'Source Sans 3',sans-serif;background:#C39445;color:#2B2119;padding:4px 8px;border-radius:5px;letter-spacing:1px}
.sigs{display:flex;gap:40px;margin-top:auto;padding:0 10px}
.sig{flex:1;display:flex;flex-direction:column;gap:6px}
.sigl{height:44px;border-bottom:1.5px solid #2B2119;font:italic 600 32px/44px Fraunces,serif;color:#1E3F7A;padding-left:10px}
.sigl.empty{color:#5E4C3B;font:600 16px/44px 'Source Sans 3',sans-serif;font-style:normal}
.drawer{position:absolute;right:24px;top:24px;width:616px;height:1032px;padding:22px 24px 14px;display:flex;flex-direction:column;gap:14px}
.tabs{display:flex;align-items:center;gap:8px}
.tab{height:64px;padding:0 14px;border-radius:9px;font:700 18px/1 'Source Sans 3',sans-serif;display:grid;place-items:center;color:#5E4C3B;background:#F3EAD6}
.tab.on{background:#fff;color:#2B2119;box-shadow:inset 0 0 0 3px #2B2119}
.drows{display:flex;flex-direction:column;gap:8px}
.drow{height:72px;display:flex;align-items:center;gap:14px;padding:0 16px 0 12px;border-radius:10px;background:#F3EAD6;box-shadow:inset 0 0 0 1.5px rgba(43,33,25,.15);text-align:left}
.drow .dn{font:700 21px/1.1 Fraunces,serif;flex:1}
.drow .dsub{display:block;font:600 15px/1.25 'Source Sans 3',sans-serif;color:#5E4C3B;margin-top:3px}
.drow .dr{font:700 15px/1.2 'Source Sans 3',sans-serif;color:#5E4C3B;text-align:right;display:flex;align-items:center;gap:6px}
.drow.dis{background:transparent}
.drow.dis .dn{color:rgba(43,33,25,.5)}
.drow.dis .dr{color:#8E2F23}
.drow.f .dn,.drow.f .dr,.drow.f .dsub{color:#FFFDF6}
.dchip{width:26px;height:36px;border-radius:3px;box-shadow:inset 0 0 0 1.2px #2B2119;flex:none}
.krow{display:flex;gap:16px;align-items:center;padding:12px 16px 12px 10px;border-radius:12px;background:#F3EAD6;box-shadow:inset 0 0 0 1.5px rgba(43,33,25,.15);text-align:left}
.krow.sel{background:#fff;box-shadow:inset 0 0 0 3px #2B2119}
.lockbox{flex:1;border:2px dashed rgba(43,33,25,.25);border-radius:14px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:16px;text-align:center;padding:0 40px}
.lockbox .lt{font:800 28px/1.15 Fraunces,serif}
.lockbox .ld{font:600 18px/1.4 'Source Sans 3',sans-serif;color:#5E4C3B}
.crail{position:absolute;right:24px;top:150px;width:560px;height:906px;padding:20px 22px;display:flex;flex-direction:column;gap:12px}
.crbanner{position:absolute;left:24px;right:24px;top:24px;height:112px;border-radius:16px;padding:16px 28px;display:flex;align-items:center;gap:20px;color:#FBF6EA;box-shadow:0 14px 34px rgba(10,5,2,.42)}
.crbanner .h1{color:#FBF6EA;margin:0}
.crbanner .bs{font:600 19px/1.3 'Source Sans 3',sans-serif;margin-top:6px}
`;

function clause(n, thumb, title, sub, extra = '', o = {}) {
  return `<div class="clause${o.new ? ' new' : ''}">${o.new ? '<span class="newtag">JUST ADDED</span>' : ''}<span class="cn">${n}.</span>${o.focusCard ? slot(thumb, { focus: 1 }) : `<div class="slot">${thumb}</div>`}<div class="ct"><div class="ctt">${title}</div>${sub ? `<div class="cts">${sub}</div>` : ''}${extra}</div></div>`;
}

function contractB(stage) {
  const review = stage === 3;
  const locked = stage === 4;
  const withPromises = stage === 2 || stage === 3;
  const left = 24;
  const width = review ? 1260 : 1232;
  const top = review ? 150 : 24;
  const height = review ? 906 : 1032;
  const partner = review
    ? `<span class="pn2">${tok(P.R, 40)}Riley</span>`
    : stepper(`Riley`, { w: 210, focus: false });
  const cashExtra = review ? '' : `<div class="cterm">${stepper('$150', { w: 200, small: 1 })}</div>`;
  const lClauses = [
    clause(1, itemCard('East Line', 'thumb'), 'East Line', 'Railroad · listed $200', '', { new: stage === 1 }),
    clause(2, card({ t: 'cash', amount: 150 }, 'thumb'), '$150 in cash', review ? 'Paid from Lawrence’s $640' : 'Lawrence has $640', cashExtra),
    clause(3, itemCard('gojf', 'thumb'), 'Get Out of Jail Free', 'Chance card'),
  ];
  if (withPromises) {
    const terms = review
      ? `<div class="cts" style="color:#2B2119;font-size:16px">Won’t build houses or hotels on <b>Orange</b> for <b>2 full rounds</b>. Selling is allowed.</div>`
      : `<div class="cts" style="color:#2B2119">won’t build on</div><div class="cterm">${stepper('Orange', { w: 150, small: 1 })}${stepper('2 rounds', { w: 160, small: 1, focus: 1 })}</div>`;
    lClauses.push(clause(4, voucher(VNB, 'thumb'), 'No Building promise', review ? '' : '', terms, { new: stage === 2 }));
  }
  const rClauses = [clause(withPromises ? 5 : 4, itemCard('Sunset Drive', 'thumb'), 'Sunset Drive', 'Orange · listed $200')];
  if (withPromises) {
    const terms = review
      ? `<div class="cts" style="color:#2B2119;font-size:16px">Charges Lawrence <b>no rent on any Railroad</b> for <b>3 of his landings</b>, including railroads she gets later.</div>`
      : `<div class="cts" style="color:#2B2119">no rent for Lawrence on</div><div class="cterm">${stepper('Railroads', { w: 170, small: 1 })}${stepper('×3', { w: 120, small: 1 })}</div>`;
    rClauses.push(clause(6, voucher(VRF, 'thumb'), 'Rent-Free promise', '', terms));
  }
  const addBtn = (who) =>
    review ? '' : `<button class="addc">${glyph('confirm', 'switch', 44)}Add clause</button>`;
  const sigs = `<div class="sigs"><div class="sig"><div class="sigl${review ? '' : ' empty'}">${review ? 'Lawrence' : 'Signs when the offer is sent'}</div><span class="lab">Lawrence · proposer</span></div><div class="sig"><div class="sigl empty">${review ? 'Hold ✕ to sign and accept' : 'Riley signs to accept'}</div><span class="lab">Riley · receiver</span></div></div>`;
  const footBtns = review
    ? ''
    : `<div style="display:flex;gap:12px;justify-content:flex-end">${btn('Sign and send to Riley', { glyph: 'trade', primary: 1, w: 360 })}${btn('Cancel', { glyph: 'back', w: 200 })}</div>`;
  const lockNote = locked ? `<div class="lockline" style="align-self:center">${lockIcon(22, '#8E2F23')}<span><b>No promise clauses:</b> Sam is a normal bot, so promises are off this game.</span></div>` : '';
  const contract = `<div class="contract" style="left:${left}px;top:${top}px;width:${width}px;height:${height}px"><div class="cfr1"></div><div class="cfr2"></div>
<div class="ctitle"><div class="eyebrow" style="color:#5E4C3B">Property Night · Turn 23</div><div class="t">Trade Agreement</div></div>
<div class="parties">between <span class="pn2">${tok(P.L, 40)}Lawrence</span> and ${partner}</div>
<div class="sech"><span class="sn">§1</span><span class="st">Lawrence gives Riley</span><span class="sp"></span>${addBtn('L')}</div>
<div class="clauses">${lClauses.join('')}</div>
<div class="sech"><span class="sn">§2</span><span class="st">Riley gives Lawrence</span><span class="sp"></span>${addBtn('R')}</div>
<div class="clauses">${rClauses.join('')}</div>
${lockNote}
${sigs}${footBtns}</div>`;

  if (review) {
    const chg = (v, s) => `<div class="chg"><div class="cv">${v}</div>${s ? `<div class="cs">${s}</div>` : ''}</div>`;
    const crb = `<div class="crbanner" style="background:linear-gradient(90deg,#0F9C84,#0B7A67)">${tok(P.R, 76)}<div style="flex:1"><div class="h1">Riley, it’s your call</div><div class="bs">Lawrence signed this agreement. Answer with <b>your PS4 controller</b>.</div></div><div class="paused">${lockIcon(20, '#FBF6EA')}Lawrence’s controller is paused</div>${padBadge(P.R)}</div>`;
    const rail = `<div class="panel crail"><span class="eyebrow">Cash after the trade</span>${chg('$910 <span class="ar">→</span> $1,060', 'Riley')}${chg('$640 <span class="ar">→</span> $490', 'Lawrence')}<div style="flex:1"></div><div style="display:flex;flex-direction:column;gap:12px"><button class="btn primary f" style="width:100%"><span class="holdring"><span>${coin('cross', 30)}</span></span><span class="lbl">Sign and accept<span class="why" style="font-weight:600">Hold to accept</span></span></button>${btn('Counter', { glyph: 'trade', pad: 'ps', hint: 'Edit clauses, send back' })}${btn('Decline', { glyph: 'back', pad: 'ps' })}</div><div class="tfoot" style="height:52px">${prompts([['dud', 'Move'], ['confirm', 'Hold']], 'ps')}</div></div>`;
    return `<div class="ghostboard"></div><div class="dimscene"></div>${crb}${contract}${rail}`;
  }

  // drawer
  let drawer;
  const dhead = (sub) => `<div><div class="eyebrow">Add a clause</div><div class="h2" style="margin-top:6px">${sub}</div></div>`;
  const tabs = (on) => `<div class="tabs">${glyph('l', 'switch', 44)}${['Properties', 'Cash', 'Jail cards', 'Promises'].map((t) => `<span class="tab${t === on ? ' on' : ''}">${t === 'Promises' && locked ? lockIcon(16) + ' ' : ''}${t}</span>`).join('')}${glyph('r', 'switch', 44)}</div>`;
  const dprompts = (list) => `<div class="tfoot" style="margin-top:auto">${prompts(list, 'switch')}</div>`;
  if (stage === 1) {
    const row = (name, sub, right, o = {}) => {
      const t = T[name];
      const chip = t.type === 'street' ? `<span class="dchip" style="background:${G[t.g].c}"></span>` : `<svg width="34" height="34" aria-hidden="true"><use href="#rr"></use></svg>`;
      return `<button class="drow${o.dis ? ' dis' : ''}${o.f ? ' f' : ''}"${o.dis ? ' aria-disabled="true"' : ''}>${chip}<span class="dn">${name}<span class="dsub">${sub}</span></span><span class="dr">${right}</span></button>`;
    };
    drawer = `<div class="panel drawer">${dhead('From Lawrence’s side')}${tabs('Properties')}<div class="drows">
${row('Lilac Row', 'Light Blue · 3 houses', 'Sell the houses first', { dis: 1 })}
${row('Bluebell Way', 'Light Blue · 3 houses', 'Sell the houses first', { dis: 1 })}
${row('Harbor View', 'Light Blue · 3 houses', 'Sell the houses first', { dis: 1 })}
${row('Amber Avenue', 'Orange · listed $180', '')}
${row('Marigold Street', 'Orange · listed $180', '')}
${row('Sapphire Heights', 'Dark Blue · mortgaged', 'Riley pays $18 interest')}
${row('North Line', 'Railroad · listed $200', '')}
${row('East Line', 'Railroad · listed $200', `${check(18, '#FFFDF6')} In clause 1`, { f: 1 })}
</div>${dprompts([['dud', 'Move'], ['confirm', 'Add'], [['l', 'r'], 'Tab'], ['back', 'Close']])}</div>`;
  } else if (stage === 2) {
    drawer = `<div class="panel drawer">${dhead('From Lawrence’s side')}${tabs('Promises')}<div class="drows" style="gap:14px">
<button class="krow">${voucher({ kind: 'rf', g: 'orange', n: 3, by: 'L', to: 'R' }, 'thumb')}<span><span class="kt" style="font:800 23px/1.1 Fraunces,serif;color:#2F5D46;display:block">Rent-Free</span><span style="display:block;font:500 16px/1.35 'Source Sans 3',sans-serif;color:#5E4C3B;margin-top:6px">Riley pays you no rent on a whole group (color set, all Railroads or both Utilities) for N of her landings.</span></span></button>
<button class="krow sel">${voucher({ kind: 'nb', g: 'orange', n: 2, by: 'L', to: 'R' }, 'thumb')}<span><span class="kt" style="font:800 23px/1.1 Fraunces,serif;color:#8E2F23;display:block">No Building</span><span style="display:block;font:500 16px/1.35 'Source Sans 3',sans-serif;color:#5E4C3B;margin-top:6px">You can’t build on one color set for N full rounds. Selling stays allowed. <b style="color:#2B2119">Added as clause 4.</b></span></span></button>
<div class="vhelp" style="padding:6px 4px">The blanks are set right in the clause: focus a blank and press ◀ ▶. Group first, then the number. Riley’s Rent-Free clause (6) is edited the same way.</div>
</div>${dprompts([['dud', 'Move'], ['dlr', 'Change'], [['l', 'r'], 'Tab'], ['back', 'Close']])}</div>`;
  } else {
    drawer = `<div class="panel drawer">${dhead('From Lawrence’s side')}${tabs('Promises')}<div class="lockbox">${lockIcon(72, '#8E2F23')}<div class="lt">Promises are off this game</div><div class="ld">Sam is a normal bot, so trades stay standard: properties, cash and jail cards only. Bank-backed bots don’t turn promises off.</div>${btn('Back to Properties', { glyph: 'l', w: 330, focus: 1 })}</div>${dprompts([[['l', 'r'], 'Tab'], ['back', 'Close']])}</div>`;
  }
  return `<div class="ghostboard"></div><div class="dimscene"></div>${contract}${drawer}`;
}

function trade(option, stage) {
  const titles = { 1: 'Building an offer', 2: 'Adding a promise', 3: 'Review (receiver)', 4: 'Promises locked' };
  if (option === 'B') return page(`Trade B — ${titles[stage]}`, contractB(stage), 1080, 1920, CSS3 + CCSS);
  return page(`Trade ${option} — ${titles[stage]}`, across(stage, option === 'C'), 1080, 1920, CSS3 + CCSS);
}

module.exports = { trade, CSS3, CCSS, VNB, VRF };
