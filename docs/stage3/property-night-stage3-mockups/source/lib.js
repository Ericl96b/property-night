// Shared building blocks for the Property Night mock-up artboards.
const TOK = {
  rocket: '/_blob/488c8a6e4bdd7938b81fe0c8fd3a716c',
  cat: '/_blob/d0490989785920508fe74687d9031415',
  teacup: '/_blob/47e31e1a5d8ca6ece28194e7f0a230a1',
};

const G = {
  brown: { n: 'Brown', c: '#955436', light: true, size: 2 },
  lightBlue: { n: 'Light Blue', c: '#AAE0FA', size: 3 },
  yellow: { n: 'Mustard', c: '#E3BC2A', size: 3 },
  orange: { n: 'Orange', c: '#FF8200', size: 3 },
  red: { n: 'Red', c: '#ED1B24', size: 3 },
  pink: { n: 'Pink', c: '#F569D7', size: 3 },
  green: { n: 'Green', c: '#1FB25A', size: 3 },
  darkBlue: { n: 'Dark Blue', c: '#0072BB', light: true, size: 2 },
  rail: { n: 'Railroads', c: '#2B2119', light: true, size: 4 },
  util: { n: 'Utilities', c: '#2B2119', light: true, size: 2 },
};
const SETS = ['brown', 'lightBlue', 'yellow', 'orange', 'red', 'pink', 'green', 'darkBlue'];

const T = {};
const st = (name, g, price, rents, hc) => (T[name] = { name, g, type: 'street', price, rents, hc, mort: price / 2 });
st('Hazel Lane', 'brown', 60, [2, 10, 30, 90, 160, 250], 50);
st('Briar Street', 'brown', 60, [4, 20, 60, 180, 320, 450], 50);
st('Lilac Row', 'lightBlue', 100, [6, 30, 90, 270, 400, 550], 50);
st('Bluebell Way', 'lightBlue', 100, [6, 30, 90, 270, 400, 550], 50);
st('Harbor View', 'lightBlue', 120, [8, 40, 100, 300, 450, 600], 50);
st('Goldfinch Lane', 'yellow', 140, [10, 50, 150, 450, 625, 750], 100);
st('Honey Street', 'yellow', 140, [10, 50, 150, 450, 625, 750], 100);
st('Buttercup Row', 'yellow', 160, [12, 60, 180, 500, 700, 900], 100);
st('Amber Avenue', 'orange', 180, [14, 70, 200, 550, 750, 950], 100);
st('Marigold Street', 'orange', 180, [14, 70, 200, 550, 750, 950], 100);
st('Sunset Drive', 'orange', 200, [16, 80, 220, 600, 800, 1000], 100);
st('Cardinal Road', 'red', 220, [18, 90, 250, 700, 875, 1050], 150);
st('Ruby Street', 'red', 220, [18, 90, 250, 700, 875, 1050], 150);
st('Scarlet Square', 'red', 240, [20, 100, 300, 750, 925, 1100], 150);
st('Rose Court', 'pink', 260, [22, 110, 330, 800, 975, 1150], 150);
st('Peony Place', 'pink', 260, [22, 110, 330, 800, 975, 1150], 150);
st('Rosewood Lane', 'pink', 280, [24, 120, 360, 850, 1025, 1200], 150);
st('Fernwood Avenue', 'green', 300, [26, 130, 390, 900, 1100, 1275], 200);
st('Ivy Terrace', 'green', 300, [26, 130, 390, 900, 1100, 1275], 200);
st('Evergreen Place', 'green', 320, [28, 150, 450, 1000, 1200, 1400], 200);
st('Sapphire Heights', 'darkBlue', 350, [35, 175, 500, 1100, 1300, 1500], 200);
st('Midnight Park', 'darkBlue', 400, [50, 200, 600, 1400, 1700, 2000], 200);
for (const n of ['North Line', 'East Line', 'South Line', 'West Line']) T[n] = { name: n, g: 'rail', type: 'rail', price: 200, mort: 100 };
T['Power Works'] = { name: 'Power Works', g: 'util', type: 'util', price: 150, mort: 75, icon: 'pw' };
T['Water Works'] = { name: 'Water Works', g: 'util', type: 'util', price: 150, mort: 75, icon: 'wt' };
const GROUP_TILES = {};
for (const t of Object.values(T)) (GROUP_TILES[t.g] = GROUP_TILES[t.g] || []).push(t.name);

const P = {
  L: { id: 'L', name: 'Lawrence', tok: 'rocket', col: '#7B3FE4', pad: 'switch', padName: 'Switch Pro' },
  R: { id: 'R', name: 'Riley', tok: 'cat', col: '#0F9C84', pad: 'ps', padName: 'PS4' },
  S: { id: 'S', name: 'Sam', tok: 'teacup', col: '#C0582B', pad: 'ps', padName: 'PS4' },
};
const OWN = {
  'Lilac Row': 'L', 'Bluebell Way': 'L', 'Harbor View': 'L', 'Amber Avenue': 'L', 'Marigold Street': 'L',
  'Sapphire Heights': 'L', 'North Line': 'L', 'East Line': 'L',
  'Goldfinch Lane': 'R', 'Sunset Drive': 'R', 'Rose Court': 'R', 'Peony Place': 'R', 'Fernwood Avenue': 'R',
  'South Line': 'R', 'West Line': 'R', 'Water Works': 'R',
  'Hazel Lane': 'S', 'Briar Street': 'S', 'Cardinal Road': 'S', 'Ruby Street': 'S', 'Honey Street': 'S',
  'Midnight Park': 'S', 'Power Works': 'S', 'Ivy Terrace': 'S',
};
const BLD = { 'Lilac Row': 3, 'Bluebell Way': 3, 'Harbor View': 3, 'Cardinal Road': 1, 'Ruby Street': 1 };
const MORT = { 'Sapphire Heights': true };
const money = (n) => '$' + n.toLocaleString('en-US');
const unmort = (t) => t.mort + Math.ceil(t.mort * 0.1);

// ---------- icons ----------
const house = (s = 16) =>
  `<svg width="${s}" height="${s}" viewBox="0 0 16 16" aria-hidden="true"><path d="M1.5 8.2 8 2.4l6.5 5.8v6.3h-13z" fill="#2E8B4E" stroke="#1B4D2E" stroke-width="1.2" stroke-linejoin="round"></path><path d="M4.2 8.6 8 5.2" stroke="#7FC79A" stroke-width="1" stroke-linecap="round"></path></svg>`;
const hotel = (s = 16) =>
  `<svg width="${s * 1.6}" height="${s}" viewBox="0 0 26 16" aria-hidden="true"><path d="M1.5 7 13 2l11.5 5v7.5h-23z" fill="#B4322A" stroke="#6E1B15" stroke-width="1.2" stroke-linejoin="round"></path></svg>`;
const buildings = (n, s = 16) => (n === 5 ? hotel(s) : Array.from({ length: n }, () => house(s)).join(''));
const lockIcon = (s = 22, c = '#5E4C3B') =>
  `<svg width="${s}" height="${s}" viewBox="0 0 24 24" aria-hidden="true"><rect x="4.5" y="10.5" width="15" height="11" rx="2" fill="${c}"></rect><path d="M8 10.5V7.5a4 4 0 0 1 8 0v3" fill="none" stroke="${c}" stroke-width="2.4"></path><circle cx="12" cy="15.6" r="1.6" fill="#FBF6EA"></circle></svg>`;
const swapIcon = (s = 34, c = '#2B2119') =>
  `<svg width="${s}" height="${s}" viewBox="0 0 32 32" aria-hidden="true"><path d="M5 11h20m-5-5 5 5-5 5M27 21H7m5-5-5 5 5 5" fill="none" stroke="${c}" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"></path></svg>`;
const padIcon = (s = 30, c = '#2B2119') =>
  `<svg width="${s}" height="${s * 0.7}" viewBox="0 0 40 28" aria-hidden="true"><path d="M11 3h18c5 0 8 4 9 10l1.5 8c.6 3.5-3.4 6-6 3.6L28 19H12l-5.5 5.6C3.9 27-.1 24.5.5 21L2 13C3 7 6 3 11 3z" fill="none" stroke="${c}" stroke-width="2.2" stroke-linejoin="round"></path><path d="M10 9v6M7 12h6" stroke="${c}" stroke-width="2.2" stroke-linecap="round"></path><circle cx="28" cy="10" r="1.8" fill="${c}"></circle><circle cx="31.5" cy="13.5" r="1.8" fill="${c}"></circle></svg>`;
const check = (s = 18, c = '#2F5D46') =>
  `<svg width="${s}" height="${s}" viewBox="0 0 18 18" aria-hidden="true"><path d="M3.5 9.5 7.5 13l7-8" fill="none" stroke="${c}" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"></path></svg>`;

// ---------- controller glyphs (brass coins, same build as assets/symbols/button-*.svg) ----------
function coin(sym, s = 44) {
  let inner;
  switch (sym) {
    case 'cross': inner = '<path d="M14 14l12 12M26 14L14 26" stroke="#4E7FCF" stroke-width="3.2" stroke-linecap="round"></path>'; break;
    case 'circle': inner = '<circle cx="20" cy="20" r="6.5" fill="none" stroke="#C8424F" stroke-width="3"></circle>'; break;
    case 'square': inner = '<rect x="14" y="14" width="12" height="12" fill="none" stroke="#B3549A" stroke-width="2.8"></rect>'; break;
    case 'triangle': inner = '<path d="M20 13l7.5 12.5h-15z" fill="none" stroke="#2E9472" stroke-width="2.8" stroke-linejoin="round"></path>'; break;
    case 'dpad': inner = '<path d="M17.2 10.5h5.6v6.7h6.7v5.6h-6.7v6.7h-5.6v-6.7h-6.7v-5.6h6.7z" fill="#2B2119"></path>'; break;
    case 'dlr': inner = '<path d="M17.2 10.5h5.6v19h-5.6z" fill="rgba(43,33,25,.22)"></path><path d="M10.5 17.2h19v5.6h-19z" fill="#2B2119"></path><path d="M10.5 20l3-3v6zM29.5 20l-3-3v6z" fill="#FBF3DF"></path>'; break;
    case 'dud': inner = '<path d="M10.5 17.2h19v5.6h-19z" fill="rgba(43,33,25,.22)"></path><path d="M17.2 10.5h5.6v19h-5.6z" fill="#2B2119"></path>'; break;
    default: {
      const fs = sym.length > 1 ? 13.5 : 15.5;
      inner = `<text x="20" y="${sym.length > 1 ? 24.8 : 25.6}" text-anchor="middle" font-family="Source Sans 3, sans-serif" font-weight="700" font-size="${fs}" fill="#2B2119">${sym}</text>`;
    }
  }
  return `<svg class="coin" width="${s}" height="${s}" viewBox="0 0 40 40" aria-hidden="true"><circle cx="20" cy="21.6" r="18" fill="rgba(20,10,4,.32)"></circle><circle cx="20" cy="20" r="18" fill="url(#brassR)" stroke="#4A3210" stroke-width="1"></circle><circle cx="20" cy="20" r="14.5" fill="#FBF3DF" stroke="rgba(74,50,16,.55)" stroke-width="1"></circle><path d="M9 14a13 13 0 0 1 8-6" fill="none" stroke="#FFF" stroke-width="1.2" opacity=".7"></path>${inner}</svg>`;
}
const GLY = {
  switch: { confirm: 'B', back: 'A', manage: 'Y', trade: 'X', l: 'L', r: 'R', dpad: 'dpad', dlr: 'dlr', dud: 'dud' },
  ps: { confirm: 'cross', back: 'circle', manage: 'square', trade: 'triangle', l: 'L1', r: 'R1', dpad: 'dpad', dlr: 'dlr', dud: 'dud' },
};
const glyph = (role, pad, s = 44) => coin(GLY[pad][role], s);

function prompts(list, pad, extra = '') {
  return `<div class="prompts">${list
    .map(([r, l]) => `<span class="pr">${Array.isArray(r) ? r.map((x) => glyph(x, pad)).join('') : glyph(r, pad)}<span>${l}</span></span>`)
    .join('')}${extra}</div>`;
}

const tok = (p, s = 52) =>
  `<span class="tok" style="width:${s}px;height:${s}px;border-color:${p.col}"><img src="${TOK[p.tok]}" alt=""></span>`;
const badge = (p, s = 44, extra = '') =>
  `<span class="pbadge">${tok(p, s)}<span class="pname">${p.name}</span>${extra}</span>`;
const padBadge = (p, active = true) =>
  `<span class="padbadge${active ? ' on' : ''}" style="--pc:${p.col}">${padIcon(30, active ? '#FBF6EA' : '#5E4C3B')}<span>${p.name} · ${p.padName}</span></span>`;

// ---------- button ----------
function btn(label, opts = {}) {
  const { glyph: g, pad = 'switch', primary, focus, hint, dis, why, w, cls = '' } = opts;
  const c = ['btn', primary && 'primary', focus && 'f', dis && 'dis', !g && !opts.space && 'ng', cls].filter(Boolean).join(' ');
  return `<button class="${c}"${w ? ` style="width:${w}px"` : ''}${dis ? ' aria-disabled="true"' : ''}>${g ? glyph(g, pad) : opts.space ? '<span class="cspace"></span>' : ''}<span class="lbl">${label}${why ? `<span class="why">${why}</span>` : ''}</span>${hint ? `<span class="hint">${hint}</span>` : ''}</button>`;
}
// ◀ value ▶ stepper (whole control takes focus; arrows light up when focused)
function stepper(value, opts = {}) {
  const { focus, w = 200, label, small } = opts;
  return `<button class="stepper${focus ? ' f' : ''}${small ? ' sm' : ''}" style="width:${w}px">${label ? `<span class="slabel">${label}</span>` : ''}<span class="arr">◀</span><span class="sval">${value}</span><span class="arr">▶</span></button>`;
}

// ---------- banknote ----------
const NOTE = { 1: '#F7F1E3', 5: '#F3D3D6', 10: '#F4E7A8', 20: '#CFE3C6', 50: '#C9DDEE', 100: '#E9D9BC', 500: '#F2C79E' };
function note(v, w, text = true) {
  const f = NOTE[v];
  return `<svg viewBox="0 0 300 150" width="${w}" height="${w / 2}" aria-hidden="true" class="note"><rect width="300" height="150" rx="5" fill="${f}"></rect><rect x="7" y="7" width="286" height="136" rx="3" fill="url(#guil)" stroke="rgba(43,33,25,.55)" stroke-width="1"></rect><rect x="20" y="20" width="260" height="110" rx="2" fill="${f}" stroke="rgba(43,33,25,.55)" stroke-width="1"></rect><circle cx="150" cy="75" r="40" fill="none" stroke="rgba(43,33,25,.35)" stroke-width="1"></circle><circle cx="150" cy="75" r="34" fill="url(#guil)" stroke="rgba(43,33,25,.5)" stroke-width="1"></circle><circle cx="150" cy="75" r="25" fill="${f}" stroke="rgba(43,33,25,.5)" stroke-width="1"></circle>${
    text
      ? `<text x="150" y="86" text-anchor="middle" font-family="Fraunces, serif" font-weight="800" font-size="30" fill="#2B2119">${v}</text><text x="34" y="50" font-family="Fraunces, serif" font-weight="800" font-size="26" fill="#2B2119">${v}</text><text x="266" y="120" text-anchor="end" font-family="Fraunces, serif" font-weight="800" font-size="26" fill="#2B2119">${v}</text>`
      : ''
  }</svg>`;
}
function notesFor(amount) {
  const out = [];
  for (const d of [500, 100, 50, 20, 10, 5, 1]) while (amount >= d && out.length < 6) (out.push(d), (amount -= d));
  return out;
}

// ---------- group stripe (for vouchers) ----------
function stripe(g, h, label) {
  const G0 = G[g];
  const fg = G0.light ? '#FBF6EA' : '#2B2119';
  const icon = g === 'rail' ? `<svg width="${h - 6}" height="${h - 6}" aria-hidden="true"><use href="#rrL"></use></svg>` : g === 'util' ? `<svg width="${h - 6}" height="${h - 6}" aria-hidden="true"><use href="#pwL"></use></svg>` : '';
  return `<div class="vstripe" style="height:${h}px;background:${G0.c};color:${fg}">${icon}${label ? `<span>${label}</span>` : ''}</div>`;
}

// ---------- cards ----------
// item: {t:'deed', name} | {t:'gojf', deck} | {t:'cash', amount} | {t:'v', kind:'rf'|'nb', g, n, left?, by, to}
const SIZES = { thumb: [92, 122], std: [200, 266], detail: [360, 480] };

function deedThumb(name) {
  const t = T[name];
  const b = BLD[name] || 0;
  if (MORT[name])
    return `<div class="card thumb back"><div class="frame"></div><div class="mstrip" style="background:${G[t.g].c}"></div><div class="tname">${name}</div><div class="mstamp s">MORTGAGED</div></div>`;
  if (t.type === 'rail' || t.type === 'util')
    return `<div class="card thumb"><div class="frame"></div><svg class="ticon" width="40" height="40" aria-hidden="true"><use href="#${t.type === 'rail' ? 'rr' : t.icon}"></use></svg><div class="tname">${name}</div></div>`;
  const G0 = G[t.g];
  return `<div class="card thumb"><div class="frame"></div><div class="tband" style="background:${G0.c}"></div><div class="tname">${name}</div><div class="tbld">${buildings(b, 15)}</div></div>`;
}
function deedStd(name) {
  const t = T[name];
  const b = BLD[name] || 0;
  if (MORT[name])
    return `<div class="card std back"><div class="frame"></div><div class="mstrip" style="background:${G[t.g].c};height:14px"></div><div class="sname">${name}</div><div class="mstamp m">MORTGAGED</div><div class="sline b">Mortgaged for ${money(t.mort)}</div><div class="sline">Unmortgage ${money(unmort(t))}</div></div>`;
  if (t.type === 'rail' || t.type === 'util')
    return `<div class="card std"><div class="frame"></div><svg class="sicon" width="58" height="58" aria-hidden="true"><use href="#${t.type === 'rail' ? 'rr' : t.icon}"></use></svg><div class="kick muted">${t.type === 'rail' ? 'RAILROAD' : 'UTILITY'}</div><div class="sname">${name}</div><div class="sline b">${t.type === 'rail' ? 'Rent $25 – $200' : '4× or 10× the dice'}</div><div class="sline">Mortgage ${money(t.mort)}</div></div>`;
  const G0 = G[t.g];
  return `<div class="card std"><div class="frame"></div><div class="sband" style="background:${G0.c};color:${G0.light ? '#FFF8EC' : '#2B2119'}"><div class="kick">TITLE DEED</div><div class="sbname">${name}</div></div><div class="srent">Rent ${money(t.rents[0])}</div><div class="sline">1–4 houses ${t.rents.slice(1, 5).map((r) => '$' + r).join(' · ')}</div><div class="sline">Hotel ${money(t.rents[5])}</div><div class="sline" style="margin-top:6px;color:#5E4C3B">Houses ${money(t.hc)} · Mortgage ${money(t.mort)}</div><div class="sbld">${buildings(b, 18)}</div></div>`;
}
function deedDetail(name, opts = {}) {
  const t = T[name];
  const b = BLD[name] || 0;
  if (MORT[name])
    return `<div class="card detail back"><div class="frame"></div><div class="mstrip" style="background:${G[t.g].c};height:20px"></div><div class="dmname">${name}</div><div class="mstamp l">MORTGAGED</div><div class="dline b">Mortgaged for ${money(t.mort)}</div><div class="dline">Unmortgage for ${money(unmort(t))}</div><div class="dnote">Lifting the mortgage costs the value plus 10%.</div></div>`;
  if (t.type === 'rail') {
    const owned = opts.owned || 1;
    const rows = [['Rent', 25], ['If 2 lines are owned', 50], ['If 3 lines are owned', 100], ['If 4 lines are owned', 200]];
    return `<div class="card detail"><div class="frame"></div><div class="dc"><svg width="84" height="84" aria-hidden="true"><use href="#rr"></use></svg><div class="kick muted">RAILROAD</div><div class="dtitle2">${name}</div><div class="rows">${rows.map((r, i) => `<div class="row${i + 1 === owned ? ' now' : ''}"><span>${r[0]}</span><span class="dots"></span><b>${money(r[1])}</b></div>`).join('')}</div><div class="rule"></div><div class="dnotes">Mortgage value $100</div></div></div>`;
  }
  if (t.type === 'util')
    return `<div class="card detail"><div class="frame"></div><div class="dc"><svg width="84" height="84" aria-hidden="true"><use href="#${t.icon}"></use></svg><div class="kick muted">UTILITY</div><div class="dtitle2">${name}</div><div class="util">With one utility owned, rent is <b>4×</b> the dice roll.</div><div class="util">With both utilities owned, rent is <b>10×</b> the dice roll.</div><div class="rule"></div><div class="dnotes">Mortgage value $75</div></div></div>`;
  const G0 = G[t.g];
  const labels = ['With 1 house', 'With 2 houses', 'With 3 houses', 'With 4 houses', 'With hotel'];
  return `<div class="card detail"><div class="frame"></div><div class="dband" style="background:${G0.c};color:${G0.light ? '#FFF8EC' : '#2B2119'}"><div class="kick">TITLE DEED</div><div class="dtitle">${name}</div></div><div class="drent${b === 0 ? ' now' : ''}">Rent ${money(t.rents[0])}</div><div class="rows">${labels.map((l, i) => `<div class="row${b === i + 1 ? ' now' : ''}"><span>${l}</span><span class="dots"></span><b>${money(t.rents[i + 1])}</b></div>`).join('')}</div><div class="rule"></div><div class="dnotes"><div>Mortgage value ${money(t.mort)}</div><div>Houses cost ${money(t.hc)} each</div><div>Hotels, ${money(t.hc)} each plus 4 houses</div></div><div class="dfoot">Own every lot in the color set and rent doubles on lots without houses.</div></div>`;
}

function gojf(size) {
  const corners = ['tl', 'tr', 'bl', 'br'].map((c) => `<span class="dia ${c}"></span>`).join('');
  if (size === 'thumb')
    return `<div class="card thumb gojf"><div class="ob1"></div><div class="ob2"></div>${corners}<div class="q s">?</div><div class="gname">Get Out of Jail Free</div></div>`;
  if (size === 'std')
    return `<div class="card std gojf"><div class="ob1"></div><div class="ob2"></div>${corners}<div class="q m">?</div><div class="kick ox">CHANCE</div><div class="gname m">Get Out of Jail Free</div><div class="sline">Keep it, use it, or trade it.</div></div>`;
  return `<div class="card detail gojf"><div class="ob1"></div><div class="ob2"></div>${corners}<div class="q l">?</div><div class="kick ox big">CHANCE</div><div class="gname l">Get Out of Jail Free</div><div class="dline">This card may be kept until needed or traded.</div><div class="dnote">Goes back to the Chance deck once used.</div></div>`;
}

function cash(amount, size, opts = {}) {
  const ns = notesFor(amount);
  if (size === 'thumb') {
    const stack = ns.slice(0, 3).reverse().map((v, i) => `<div class="nt" style="top:${8 + i * 9}px;left:${4 + i * 2}px;transform:rotate(${[-4, 2, -1][i]}deg)">${note(v, 80, false)}</div>`).join('');
    return `<div class="cashc thumb">${stack}<div class="camt">${money(amount)}</div></div>`;
  }
  const w = size === 'std' ? 170 : 300;
  const stack = ns.slice(0, 4).reverse().map((v, i) => `<div class="nt" style="top:${(size === 'std' ? 10 : 20) + i * (size === 'std' ? 14 : 22)}px;left:${(size === 'std' ? 12 : 24) + i * 3}px;transform:rotate(${[-4, 2, -2, 1][i]}deg)">${note(v, w, true)}</div>`).join('');
  return `<div class="cashc ${size}">${stack}<div class="camt">${money(amount)}</div>${opts.sub ? `<div class="csub">${opts.sub}</div>` : ''}</div>`;
}

// Promise voucher. kind: 'rf' (Rent-Free, landings) | 'nb' (No building / Restricted Development, rounds)
function voucher(v, size) {
  const rf = v.kind === 'rf';
  const kc = rf ? '#2F5D46' : '#8E2F23';
  const unit = rf ? (v.n === 1 ? 'landing' : 'landings') : v.n === 1 ? 'round' : 'rounds';
  const gname = G[v.g].n;
  const left = v.left ?? v.n;
  if (size === 'thumb')
    return `<div class="card thumb vch" style="--kc:${kc}"><div class="vcut"></div>${stripe(v.g, 18)}<div class="vt s">${rf ? 'RENT-FREE' : 'NO BUILD'}</div><div class="vst s">${rf ? '×' : ''}${left}</div><div class="vunit">${left === 1 ? unit.replace(/s$/, '') : unit}</div></div>`;
  const by = P[v.by].name;
  const to = P[v.to].name;
  const terms = rf
    ? `${to} pays ${by} no rent on any ${gname === 'Railroads' || gname === 'Utilities' ? gname.slice(0, -1).toLowerCase() : gname + ' lot'} ${by} owns, including ones ${by} gets later.`
    : `${by} can't build houses or hotels on ${gname}. Selling them is still allowed.`;
  const holes = (n, l) => (n <= 10 ? `<div class="punch">${Array.from({ length: n }, (_, i) => `<span class="${i < n - l ? 'used' : ''}"></span>`).join('')}</div>` : '');
  if (size === 'std')
    return `<div class="card std vch" style="--kc:${kc}"><div class="vcut"></div>${stripe(v.g, 30, gname.toUpperCase())}<div class="kick vk">PROMISE</div><div class="vt m">${rf ? 'RENT-FREE' : 'NO BUILDING'}</div><div class="vst m">${rf ? '×' : ''}${v.n} ${unit.toUpperCase()}</div><div class="vparty">${by} → ${to}</div>${holes(v.n, left)}</div>`;
  return `<div class="card detail vch" style="--kc:${kc}"><div class="vcut"></div>${stripe(v.g, 46, gname.toUpperCase())}<div class="kick vk big">PROMISE VOUCHER</div><div class="vt l">${rf ? 'RENT-FREE' : 'NO BUILDING'}</div><div class="vsub">${rf ? `on every ${gname === 'Railroads' ? 'railroad' : gname === 'Utilities' ? 'utility' : gname + ' lot'}` : 'Restricted Development'}</div><div class="vst l">${rf ? '×' : ''}${v.n} ${unit.toUpperCase()}</div><div class="vterms">${terms}</div>${holes(v.n, left)}<div class="vfoot"><div><span class="vfl">PROMISED BY</span><span class="vfn"><i style="background:${P[v.by].col}"></i>${by}</span></div><div><span class="vfl">HELD BY</span><span class="vfn"><i style="background:${P[v.to].col}"></i>${to}</span></div></div></div>`;
}

function card(item, size, opts = {}) {
  if (item.t === 'deed') return size === 'thumb' ? deedThumb(item.name) : size === 'std' ? deedStd(item.name) : deedDetail(item.name, opts);
  if (item.t === 'gojf') return gojf(size);
  if (item.t === 'cash') return cash(item.amount, size, opts);
  if (item.t === 'v') return voucher(item, size);
  return '';
}

// slot = the focusable wrapper around a card
function slot(inner, o = {}) {
  const c = ['slot', o.focus && 'f', o.sel && 'sel', o.inoffer && 'inoffer', o.blocked && 'blocked', o.newly && 'newly', o.cls].filter(Boolean).join(' ');
  return `<button class="${c}"${o.blocked ? ' aria-disabled="true"' : ''}>${inner}${o.inoffer ? `<span class="otag">${check(16, '#FBF6EA')}In offer</span>` : ''}${o.blocked ? `<span class="btag">${o.blocked}</span>` : ''}${o.tag ? `<span class="ctag" style="background:${o.tagc || '#2B2119'}">${o.tag}</span>` : ''}</button>`;
}
function emptySlot(name, owner) {
  const t = T[name];
  const band = t.type === 'street' ? `<div class="eband" style="background:${G[t.g].c}"></div>` : `<svg class="eicon" width="34" height="34" aria-hidden="true"><use href="#${t.type === 'rail' ? 'rr' : t.icon}"></use></svg>`;
  return `<div class="eslot">${band}<div class="ename">${name}</div>${owner ? `<div class="eown"><i style="background:${P[owner].col}"></i>${P[owner].name}</div>` : '<div class="eown un">Unowned</div>'}</div>`;
}

// ---------- page shell ----------
const DEFS = `<svg width="0" height="0" style="position:absolute" aria-hidden="true"><defs>
<radialGradient id="brassR" cx="0.35" cy="0.3" r="0.85"><stop offset="0" stop-color="#FFF3C9"></stop><stop offset="0.35" stop-color="#E2BC66"></stop><stop offset="0.8" stop-color="#9A7030"></stop><stop offset="1" stop-color="#5E4115"></stop></radialGradient>
<linearGradient id="brassL" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#FFF3C9"></stop><stop offset="0.2" stop-color="#EBCB79"></stop><stop offset="0.48" stop-color="#C39445"></stop><stop offset="0.75" stop-color="#8F672A"></stop><stop offset="1" stop-color="#5E4115"></stop></linearGradient>
<pattern id="guil" width="9" height="9" patternUnits="userSpaceOnUse"><circle cx="4.5" cy="4.5" r="3.6" fill="none" stroke="rgba(43,33,25,.35)" stroke-width="0.6"></circle><circle cx="0" cy="0" r="3.6" fill="none" stroke="rgba(43,33,25,.22)" stroke-width="0.6"></circle><circle cx="9" cy="9" r="3.6" fill="none" stroke="rgba(43,33,25,.22)" stroke-width="0.6"></circle></pattern>
<symbol id="rr" viewBox="0 0 64 64"><path d="M3 55h58" stroke="#2B2119" stroke-width="2" stroke-linecap="round"></path><path d="M14 18h7l1.5 8h-10z" fill="#2B2119"></path><path d="M12 16h11v3H12z" fill="#2B2119"></path><circle cx="15" cy="10" r="3.2" fill="none" stroke="#2B2119" stroke-width="1.6"></circle><circle cx="9" cy="6" r="2.2" fill="none" stroke="#2B2119" stroke-width="1.4"></circle><path d="M8 27h30a6 6 0 0 1 6 6v12H8z" fill="#2B2119"></path><path d="M40 17h16v28H40z" fill="#2B2119"></path><path d="M38 14h20v4H38z" fill="#2B2119"></path><rect x="44" y="21" width="9" height="8" rx="1" fill="#F3EAD6"></rect><path d="M11 31h25" stroke="#F3EAD6" stroke-width="1.4" stroke-linecap="round" opacity=".8"></path><path d="M8 41L2 51h8z" fill="#2B2119"></path><circle cx="16" cy="48" r="6" fill="#2B2119"></circle><circle cx="16" cy="48" r="2.2" fill="#F3EAD6"></circle><circle cx="31" cy="48" r="6" fill="#2B2119"></circle><circle cx="31" cy="48" r="2.2" fill="#F3EAD6"></circle><circle cx="50" cy="49" r="5" fill="#2B2119"></circle><circle cx="50" cy="49" r="1.8" fill="#F3EAD6"></circle><path d="M16 48h34" stroke="#F3EAD6" stroke-width="1.6"></path></symbol>
<symbol id="rrL" viewBox="0 0 64 64"><path d="M8 27h30a6 6 0 0 1 6 6v12H8zM40 17h16v28H40zM38 14h20v4H38zM14 18h7l1.5 8h-10zM8 41L2 51h8z" fill="#FBF6EA"></path><circle cx="16" cy="48" r="6" fill="#FBF6EA"></circle><circle cx="31" cy="48" r="6" fill="#FBF6EA"></circle><circle cx="50" cy="49" r="5" fill="#FBF6EA"></circle></symbol>
<symbol id="pw" viewBox="0 0 64 64"><path d="M32 5a17 17 0 0 1 10.5 30.4c-2.4 2-3.5 4.6-3.5 7.6H25c0-3-1.1-5.6-3.5-7.6A17 17 0 0 1 32 5z" fill="#2B2119"></path><path d="M35 12l-8 12h7l-5 11" fill="none" stroke="#F3EAD6" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round"></path><rect x="24" y="45" width="16" height="4" rx="1.5" fill="#2B2119"></rect><rect x="24" y="51" width="16" height="4" rx="1.5" fill="#2B2119"></rect><path d="M27 57h10l-2 3h-6z" fill="#2B2119"></path></symbol>
<symbol id="pwL" viewBox="0 0 64 64"><path d="M32 5a17 17 0 0 1 10.5 30.4c-2.4 2-3.5 4.6-3.5 7.6H25c0-3-1.1-5.6-3.5-7.6A17 17 0 0 1 32 5z" fill="#FBF6EA"></path><rect x="24" y="45" width="16" height="4" rx="1.5" fill="#FBF6EA"></rect><rect x="24" y="51" width="16" height="4" rx="1.5" fill="#FBF6EA"></rect></symbol>
<symbol id="wt" viewBox="0 0 64 64"><path d="M27 15V10M19 9h16" stroke="#2B2119" stroke-width="4" stroke-linecap="round"></path><path d="M6 18h30a12 12 0 0 1 12 12v6h-9v-4a4 4 0 0 0-4-4H6z" fill="#2B2119"></path><rect x="3" y="15" width="5" height="16" rx="1.5" fill="#2B2119"></rect><rect x="37" y="36" width="13" height="3.5" rx="1" fill="#2B2119"></rect><path d="M43.5 44c3.5 5.5 6 9 6 11.5a6 6 0 0 1-12 0c0-2.5 2.5-6 6-11.5z" fill="#2B2119"></path></symbol>
</defs></svg>`;

const CSS = `
body{margin:0}
.stage{position:relative;width:1920px;height:1080px;overflow:hidden;font-family:'Source Sans 3',sans-serif;color:#2B2119;background:radial-gradient(ellipse 85% 80% at 50% 42%,#6A4330 0%,#4A2E1F 48%,#241510 100%)}
.stage.tall{height:auto}
.stage *{box-sizing:border-box}
.dimscene{position:absolute;inset:0;background:rgba(10,5,2,.45)}
.ghostboard{position:absolute;left:330px;top:70px;width:1260px;height:940px;border-radius:6px;background:#EDE3CC;opacity:.22;transform:perspective(1600px) rotateX(28deg);box-shadow:0 30px 60px rgba(0,0,0,.4)}
.panel{position:absolute;background:#FBF6EA;border-radius:16px;box-shadow:0 2px 0 rgba(43,33,25,.08),0 14px 34px rgba(10,5,2,.42),0 3px 8px rgba(10,5,2,.28)}
.eyebrow{font:700 14px/1 'Source Sans 3',sans-serif;letter-spacing:3px;text-transform:uppercase;color:#8E2F23}
.h1{font-family:Fraunces,serif;font-weight:800;font-size:38px;line-height:1.05;font-variation-settings:'opsz' 72;margin-top:6px}
.h2{font-family:Fraunces,serif;font-weight:800;font-size:26px;line-height:1.1;font-variation-settings:'opsz' 48}
.lab{font:700 14px/1.1 'Source Sans 3',sans-serif;letter-spacing:2px;text-transform:uppercase;color:#5E4C3B}
.big$ {}
.amt{font-family:Fraunces,serif;font-weight:800;font-size:40px;line-height:1;font-variation-settings:'opsz' 72}
.tok{display:inline-grid;place-items:center;border-radius:50%;border:4px solid;background:radial-gradient(circle at 40% 35%,#FFFDF6,#EADFC6);overflow:hidden;flex:none;box-shadow:0 2px 5px rgba(10,5,2,.3)}
.tok img{width:86%;height:86%;object-fit:contain;margin-top:6%}
.pbadge{display:inline-flex;align-items:center;gap:12px}
.pname{font:800 24px/1 Fraunces,serif}
.padbadge{display:inline-flex;align-items:center;gap:10px;height:48px;padding:0 18px 0 14px;border-radius:24px;font:700 17px/1 'Source Sans 3',sans-serif;background:#EADFC6;color:#5E4C3B}
.padbadge.on{background:var(--pc);color:#FBF6EA;box-shadow:0 0 0 2px rgba(43,33,25,.25)}
.coin{flex:none;display:block}
.cspace{width:44px;height:44px;flex:none}
button{font:inherit;color:inherit;border:0;background:none;padding:0;margin:0;text-align:inherit;cursor:pointer}
.btn{height:64px;display:flex;align-items:center;gap:14px;padding:0 18px 0 10px;border-radius:10px;background:#F3EAD6;color:#2B2119;font:600 20px/1.1 'Source Sans 3',sans-serif;box-shadow:inset 0 0 0 1.5px rgba(43,33,25,.18);text-align:left;flex:none}
.btn.ng{padding-left:20px}
.btn .lbl{flex:1;display:flex;flex-direction:column;gap:3px}
.btn .hint{font:600 15px/1.2 'Source Sans 3',sans-serif;color:#5E4C3B;text-align:right}
.btn .why{font:600 15px/1.15 'Source Sans 3',sans-serif;color:#8E2F23}
.primary{color:#2F5D46;font-weight:800;box-shadow:inset 0 0 0 3px #2F5D46}
.dis{background:transparent;box-shadow:inset 0 0 0 1.5px rgba(43,33,25,.2);color:rgba(43,33,25,.5)}
.dis .coin{opacity:.45}
.f{background:#2F5D46 !important;color:#FFFDF6 !important;box-shadow:0 0 0 2px #16301F,0 6px 14px rgba(10,5,2,.45) !important;transform:scale(1.05);position:relative;z-index:3}
.slot.f{transform:scale(1.05) translateY(-3px);box-shadow:0 0 0 2px #16301F,0 10px 20px rgba(10,5,2,.5) !important}
.f .hint,.f .why,.f .slabel{color:#FFFDF6 !important}
.stepper{height:64px;display:flex;align-items:center;justify-content:space-between;gap:8px;padding:0 14px;border-radius:10px;background:#fff;box-shadow:inset 0 0 0 1.5px rgba(43,33,25,.28);font:800 22px/1 Fraunces,serif;flex:none}
.stepper .arr{font:400 18px/1 'Source Sans 3',sans-serif;color:rgba(43,33,25,.3)}
.stepper .sval{flex:1;text-align:center;white-space:nowrap}
.stepper .slabel{font:700 14px/1 'Source Sans 3',sans-serif;letter-spacing:1.5px;text-transform:uppercase;color:#5E4C3B}
.stepper.f .arr{color:#FFFDF6}
.stepper.sm{font-size:19px;padding:0 10px}
.prompts{display:flex;align-items:center;gap:30px;font:600 19px/1 'Source Sans 3',sans-serif;color:#2B2119}
.pr{display:inline-flex;align-items:center;gap:10px}
.pr .coin+.coin{margin-left:-6px}
.chip{display:inline-block;width:24px;height:16px;border-radius:3px;box-shadow:inset 0 0 0 1.2px #2B2119;flex:none}
.tag{display:inline-flex;align-items:center;gap:6px;font:700 14px/1.15 'Source Sans 3',sans-serif;padding:4px 8px;border-radius:5px;color:#FBF6EA}
.full{background:#2F5D46}
.note{display:block}

/* ---- card stock ---- */
.card{position:relative;background:#FBF6EA;border-radius:9px;box-shadow:0 1px 0 #E2D2B0,0 2px 0 #D2BD95,0 3px 0 #C2AA7E,0 4px 0 #A98F63,0 14px 26px rgba(10,5,2,.35);color:#2B2119;flex:none;overflow:hidden}
.card .frame{position:absolute;inset:6px;box-shadow:inset 0 0 0 1.2px #2B2119;pointer-events:none}
.card.thumb{width:92px;height:122px;border-radius:7px;box-shadow:0 1px 0 #D2BD95,0 2px 0 #A98F63,0 7px 12px rgba(10,5,2,.3);display:flex;flex-direction:column;align-items:center;padding:10px 9px 8px}
.card.std{width:200px;height:266px;display:flex;flex-direction:column;align-items:center;padding:14px 13px 12px;text-align:center}
.card.detail{width:360px;height:480px;display:flex;flex-direction:column;padding:21px 21px 18px;border-radius:11px}
.card.std .frame{inset:8px}
.card.detail .frame{inset:11px;box-shadow:inset 0 0 0 1.5px #2B2119}
.tband{width:100%;height:26px;box-shadow:inset 0 0 0 1.2px #2B2119;flex:none}
.tname{font:700 15px/1.12 Fraunces,serif;font-variation-settings:'opsz' 12;text-align:center;margin-top:7px;flex:1;display:flex;align-items:flex-start;justify-content:center}
.tbld{display:flex;gap:1px;height:16px;align-items:flex-end}
.ticon{margin-top:2px;flex:none}
.back .mstrip{width:100%;height:10px;box-shadow:inset 0 0 0 1.2px #2B2119;flex:none}
.back .tname{flex:none}
.mstamp{color:#8E2F23;border:2px solid #8E2F23;outline:1px solid #8E2F23;outline-offset:2px;font-family:Fraunces,serif;font-weight:900;transform:rotate(-12deg);opacity:.92;white-space:nowrap;flex:none}
.mstamp.s{font:800 14px/1 'Source Sans 3',sans-serif;letter-spacing:.5px;padding:4px 4px;margin-top:12px;transform:rotate(-9deg)}
.mstamp.m{font-size:20px;letter-spacing:2px;padding:6px 10px;margin:22px 0 22px}
.mstamp.l{font-size:32px;letter-spacing:3px;padding:10px 18px;margin:56px auto 48px}
.kick{font:700 14px/1 'Source Sans 3',sans-serif;letter-spacing:2.5px}
.kick.muted{color:#5E4C3B;margin-top:8px}
.kick.ox{color:#8E2F23;margin-top:6px}
.kick.big{font-size:16px;letter-spacing:3.5px}
.sband{width:100%;box-shadow:inset 0 0 0 1.2px #2B2119;padding:9px 6px 11px;flex:none}
.sbname{font:800 18px/1.05 Fraunces,serif;font-variation-settings:'opsz' 36;text-transform:uppercase;margin-top:6px}
.srent{font:700 18px/1 Fraunces,serif;margin:13px 0 9px}
.sline{font:500 15px/1.35 'Source Sans 3',sans-serif}
.sline.b{font-weight:700;font-size:16px}
.sbld{margin-top:auto;display:flex;gap:2px;height:20px;align-items:flex-end}
.sname{font:800 20px/1.08 Fraunces,serif;text-transform:uppercase;margin:8px 0 10px}
.sicon{flex:none;margin-top:6px}
.dband{box-shadow:inset 0 0 0 1.5px #2B2119;padding:13px 10px 15px;text-align:center;flex:none}
.dtitle{font:800 28px/1.05 Fraunces,serif;font-variation-settings:'opsz' 36;text-transform:uppercase;margin-top:8px;letter-spacing:.5px}
.drent{text-align:center;font:700 21px/1 Fraunces,serif;margin:15px 0 9px;padding:4px 0;border-radius:4px}
.rows{padding:0 10px;display:flex;flex-direction:column}
.row{display:flex;align-items:baseline;gap:6px;font:500 17px/1.5 Fraunces,serif;font-variation-settings:'opsz' 12;padding:0 6px;border-radius:4px}
.row b{font-weight:700}
.dots{flex:1;border-bottom:1.3px dotted rgba(43,33,25,.45);transform:translateY(-5px)}
.now{background:rgba(195,148,69,.28);box-shadow:inset 3px 0 0 #C39445}
.rule{height:1px;background:#2B2119;margin:10px 10px 8px;flex:none;align-self:stretch}
.dnotes{display:flex;flex-direction:column;gap:2px;font:500 15px/1.3 'Source Sans 3',sans-serif;text-align:center}
.dfoot{margin-top:auto;font:italic 400 14px/1.3 Fraunces,serif;color:#5E4C3B;text-align:center;padding:0 10px}
.dc{display:flex;flex-direction:column;align-items:center;text-align:center;height:100%;padding-top:8px}
.dc .rows{align-self:stretch;margin-top:14px}
.dtitle2{font:800 29px/1.05 Fraunces,serif;text-transform:uppercase;margin:8px 0 6px}
.util{font:500 17px/1.45 Fraunces,serif;margin-top:12px;padding:0 10px}
.dc .rule{margin-top:auto}
.dmname{font:800 28px/1.05 Fraunces,serif;text-transform:uppercase;text-align:center;margin-top:22px}
.dline{font:600 18px/1.4 'Source Sans 3',sans-serif;text-align:center}
.dline.b{font-weight:700}
.dnote{font:500 15px/1.35 'Source Sans 3',sans-serif;color:#5E4C3B;text-align:center;margin-top:10px;padding:0 20px}
.back{align-items:center}
.card.detail.back{align-items:stretch}
/* get out of jail free (Chance frame) */
.gojf .ob1{position:absolute;inset:5px;border:2px solid #8E2F23;border-radius:4px}
.gojf .ob2{position:absolute;inset:10px;border:.8px solid #8E2F23;border-radius:2px}
.gojf .dia{position:absolute;width:7px;height:7px;background:#8E2F23;transform:rotate(45deg)}
.gojf .tl{top:9px;left:9px}.gojf .tr{top:9px;right:9px}.gojf .bl{bottom:9px;left:9px}.gojf .br{bottom:9px;right:9px}
.card.std.gojf .ob1,.card.detail.gojf .ob1{inset:8px}.card.std.gojf .ob2,.card.detail.gojf .ob2{inset:14px}
.card.std.gojf .tl,.card.detail.gojf .tl{top:13px;left:13px}.card.std.gojf .tr,.card.detail.gojf .tr{top:13px;right:13px}.card.std.gojf .bl,.card.detail.gojf .bl{bottom:13px;left:13px}.card.std.gojf .br,.card.detail.gojf .br{bottom:13px;right:13px}
.q{font-family:Fraunces,serif;font-weight:900;color:#8E2F23;line-height:1;border:1.6px dashed #8E2F23;border-radius:50%;display:grid;place-items:center;flex:none}
.q.s{width:46px;height:46px;font-size:32px;margin-top:4px}
.q.m{width:76px;height:76px;font-size:52px;margin-top:10px}
.q.l{width:130px;height:130px;font-size:92px;margin:34px auto 6px}
.gname{font:800 14px/1.1 Fraunces,serif;text-transform:uppercase;text-align:center;color:#2B2119;margin-top:7px}
.gname.m{font-size:20px;margin:8px 0 8px}
.gname.l{font-size:32px;margin:12px 0 18px;line-height:1.05}
.card.detail.gojf{align-items:center;text-align:center}
.card.detail.gojf .dline{padding:0 24px}
/* cash */
.cashc{position:relative;flex:none}
.cashc .nt{position:absolute;filter:drop-shadow(0 3px 4px rgba(15,7,2,.35))}
.cashc.thumb{width:92px;height:122px}
.cashc .camt{color:#2B2119 !important}
.cashc.thumb .camt{position:absolute;left:0;right:0;bottom:2px;text-align:center;font:800 21px/1 Fraunces,serif;background:#FBF6EA;border-radius:6px;padding:5px 0;box-shadow:0 2px 6px rgba(10,5,2,.3)}
.cashc.std{width:200px;height:266px}
.cashc.std .camt{position:absolute;left:10px;right:10px;bottom:30px;text-align:center;font:800 34px/1 Fraunces,serif;background:#FBF6EA;border-radius:8px;padding:10px 0;box-shadow:0 3px 8px rgba(10,5,2,.3)}
.cashc.std .csub{position:absolute;left:0;right:0;bottom:0;text-align:center;font:700 15px/1 'Source Sans 3',sans-serif;color:#FBF6EA}
.cashc.detail{width:360px;height:480px}
.cashc.detail .camt{position:absolute;left:30px;right:30px;bottom:70px;text-align:center;font:800 54px/1 Fraunces,serif;background:#FBF6EA;border-radius:10px;padding:16px 0;box-shadow:0 4px 10px rgba(10,5,2,.3)}
/* vouchers */
.vch{border-radius:9px}
.vch .vcut{position:absolute;inset:4px;border:2px dashed var(--kc);border-radius:6px;pointer-events:none;z-index:2}
.card.std.vch .vcut,.card.detail.vch .vcut{inset:7px}
.card.thumb.vch{padding:8px 8px 7px}
.vstripe{width:100%;display:flex;align-items:center;justify-content:center;gap:8px;flex:none;box-shadow:inset 0 0 0 1.2px #2B2119;font:800 16px/1 'Source Sans 3',sans-serif;letter-spacing:2.5px}
.card.detail .vstripe{font-size:19px;letter-spacing:3.5px}
.vt{font-family:Fraunces,serif;font-weight:900;color:var(--kc);line-height:1;text-align:center}
.vt.s{font:800 14px/1 'Source Sans 3',sans-serif;margin-top:7px;letter-spacing:.3px;white-space:nowrap}
.vt.m{font-size:21px;margin-top:4px;white-space:nowrap}
.vt.l{font-size:42px;margin-top:6px;letter-spacing:1px}
.vk{color:var(--kc);margin-top:12px;text-align:center}
.vsub{font:italic 500 18px/1.2 Fraunces,serif;color:#5E4C3B;text-align:center;margin-top:6px}
.vst{color:var(--kc);border:2.5px solid var(--kc);outline:1px solid var(--kc);outline-offset:3px;font-family:Fraunces,serif;font-weight:900;transform:rotate(-8deg);white-space:nowrap;align-self:center;flex:none}
.vst.s{font-size:24px;line-height:1;padding:3px 8px;margin-top:7px;outline-offset:2px;border-width:2px}
.vst.m{font-size:18px;letter-spacing:1px;padding:6px 10px;margin:18px 0 14px}
.vst.l{font-size:30px;letter-spacing:2px;padding:9px 18px;margin:22px 0 18px}
.vunit{font:700 14px/1 'Source Sans 3',sans-serif;color:#5E4C3B;margin-top:auto;padding-bottom:3px}
.vparty{font:700 16px/1.2 'Source Sans 3',sans-serif;color:#2B2119}
.vterms{font:500 17px/1.35 Fraunces,serif;text-align:center;padding:0 18px}
.punch{display:flex;gap:7px;justify-content:center;margin-top:10px}
.punch span{width:15px;height:15px;border-radius:50%;box-shadow:inset 0 0 0 2px var(--kc)}
.punch span.used{background:#3B2619;box-shadow:inset 0 2px 3px rgba(0,0,0,.6)}
.card.std .punch span{width:13px;height:13px}
.vfoot{margin-top:auto;display:flex;justify-content:space-around;border-top:1.5px dashed var(--kc);padding-top:12px;margin-left:6px;margin-right:6px}
.vfoot>div{display:flex;flex-direction:column;align-items:center;gap:5px}
.vfl{font:700 14px/1 'Source Sans 3',sans-serif;letter-spacing:2px;color:#5E4C3B}
.vfn{font:800 20px/1 Fraunces,serif;display:flex;align-items:center;gap:7px}
.vfn i{width:13px;height:13px;border-radius:50%;display:inline-block;box-shadow:0 0 0 1.5px #2B2119}
/* slots */
.slot{position:relative;padding:5px;border-radius:12px;display:block;flex:none}
.slot.sel{box-shadow:inset 0 0 0 3px #2F5D46;background:rgba(47,93,70,.08)}
.slot.inoffer>.card,.slot.inoffer>.cashc{opacity:.38}
.slot.blocked>.card{opacity:.4}
.otag,.btag{position:absolute;left:50%;bottom:12px;transform:translateX(-50%);display:inline-flex;align-items:center;gap:4px;white-space:nowrap;font:700 14px/1 'Source Sans 3',sans-serif;padding:5px 8px;border-radius:6px;z-index:2}
.otag{background:#2F5D46;color:#FBF6EA}
.btag{background:#FBF6EA;color:#8E2F23;box-shadow:0 0 0 1.5px #8E2F23}
.ctag{position:absolute;top:-6px;right:-6px;font:800 14px/1 'Source Sans 3',sans-serif;letter-spacing:1px;color:#FBF6EA;padding:4px 7px;border-radius:5px;z-index:4;box-shadow:0 2px 5px rgba(10,5,2,.35)}
.eslot{width:92px;height:122px;margin:5px;border-radius:7px;border:2px dashed rgba(43,33,25,.28);display:flex;flex-direction:column;align-items:center;padding:7px 6px 6px;flex:none}
.eband{width:100%;height:20px;border-radius:2px;opacity:.38;flex:none}
.eicon{opacity:.3;flex:none}
.ename{font:600 14px/1.12 Fraunces,serif;color:#5E4C3B;text-align:center;margin-top:6px;flex:1}
.eown{display:flex;align-items:center;gap:5px;font:700 14px/1 'Source Sans 3',sans-serif;color:#5E4C3B}
.eown i{width:11px;height:11px;border-radius:50%;display:inline-block}
.eown.un{font-weight:600;opacity:.8}
.newly::before{content:'';position:absolute;left:-46px;top:50%;width:40px;height:26px;margin-top:-13px;background:repeating-linear-gradient(180deg,rgba(195,148,69,.95) 0 3px,transparent 3px 9px);border-radius:3px;-webkit-mask:linear-gradient(90deg,transparent,#000);mask:linear-gradient(90deg,transparent,#000)}
`;

function page(title, body, h = 1080, w = 1920, extra = '') {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>${title}</title>
<script src="./support.js"></script>
</head>
<body>
<x-dc>
<helmet>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,400..900;1,9..144,400..900&amp;family=Source+Sans+3:wght@400;500;600;700;800&amp;display=swap">
<style>${CSS.replace('.big$ {}', '')}${extra}</style>
</helmet>
<div class="stage" style="width:${w}px;height:${h}px">${DEFS}${body}</div>
</x-dc>
<script type="text/x-dc" data-dc-script data-props='{"$preview":{"width":${w},"height":${h}}}'>
class Component extends DCLogic {
  renderVals() {
    return {};
  }
}
</script>
</body>
</html>
`;
}

module.exports = { TOK, G, SETS, T, GROUP_TILES, P, OWN, BLD, MORT, money, unmort, house, hotel, buildings, lockIcon, swapIcon, padIcon, check, coin, glyph, prompts, tok, badge, padBadge, btn, stepper, note, cash, voucher, card, slot, emptySlot, deedDetail, page, stripe };
