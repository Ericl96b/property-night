const L = require('./lib');
const { G, P, card, slot, emptySlot, voucher, glyph, prompts, stepper, page, lockIcon } = L;

const CSS4 = `
.sheet{position:absolute;inset:0;padding:56px 64px;color:#FBF6EA;display:flex;flex-direction:column;gap:38px}
.sheet .h1{color:#FBF6EA;font-size:52px}
.sheet .lab{color:#EADFC6}
.sheet .sub{font:600 19px/1.4 'Source Sans 3',sans-serif;color:#EADFC6;max-width:1200px;margin-top:10px}
.sect{display:flex;flex-direction:column;gap:18px}
.sect>.lab{font-size:16px;letter-spacing:3px;color:#F3D9A0}
.line{display:flex;gap:28px;align-items:flex-end;flex-wrap:wrap}
.cap{display:flex;flex-direction:column;align-items:center;gap:12px}
.cap>span{font:700 16px/1.25 'Source Sans 3',sans-serif;color:#F3EAD6;text-align:center;max-width:220px}
.cap>span small{display:block;font:600 15px/1.3 'Source Sans 3',sans-serif;color:#D9C8A4}
.sizes{display:flex;gap:30px;align-items:flex-end}
.paperbox{background:#F3EAD6;border-radius:12px;padding:14px;display:flex;gap:10px;align-items:flex-end;box-shadow:inset 0 0 0 1.5px rgba(43,33,25,.12)}
.paperbox .cap>span{color:#2B2119}
.paperbox .cap>span small{color:#5E4C3B}
.steps{display:flex;gap:22px}
.step{background:#FBF6EA;color:#2B2119;border-radius:14px;padding:18px 20px;width:500px;display:flex;flex-direction:column;gap:14px;box-shadow:0 14px 30px rgba(10,5,2,.4)}
.step .sn{font:900 22px/1 Fraunces,serif;color:#8E2F23}
.step .sd{font:600 17px/1.4 'Source Sans 3',sans-serif;color:#5E4C3B}
.sw{height:40px;min-width:40px;border-radius:7px;box-shadow:inset 0 0 0 1.5px #2B2119;display:grid;place-items:center;font:700 14px/1 'Source Sans 3',sans-serif;padding:0 8px}
.sw.on{box-shadow:inset 0 0 0 1.5px #2B2119,0 0 0 3px #FBF6EA,0 0 0 6px #2B2119}
.sw.no{opacity:.28}
`;

function sheet() {
  const deed = (n) => ({ t: 'deed', name: n });
  const VNB = { t: 'v', kind: 'nb', g: 'orange', n: 2, by: 'L', to: 'R' };
  const VRF = { t: 'v', kind: 'rf', g: 'rail', n: 3, left: 2, by: 'R', to: 'L' };
  const cap = (html, t, s) => `<div class="cap">${html}<span>${t}${s ? `<small>${s}</small>` : ''}</span></div>`;
  const sizes = `<div class="sizes">${cap(card(deed('Harbor View'), 'detail'), 'Detail · 360 × 480', 'Inventory detail pane, voucher preview')}${cap(card(deed('Harbor View'), 'std'), 'Standard · 200 × 266', 'Review screens')}${cap(card(deed('Harbor View'), 'thumb'), 'Thumbnail · 92 × 122', 'Binder slots, tray, clauses')}</div>`;
  const vsizes = `<div class="sizes">${cap(voucher(VRF, 'detail'), 'Rent-Free voucher', 'Forest ink, dashed cut line, punch holes count landings used')}${cap(voucher(VNB, 'std'), 'No Building voucher', 'Oxblood ink, “N rounds” stamp')}${cap(voucher(VNB, 'thumb'), 'Thumbnail', '')}</div>`;
  const kinds = [
    cap(card(deed('Marigold Street'), 'thumb'), 'Street', 'no buildings'),
    cap(card(deed('Lilac Row'), 'thumb'), 'Street', '3 houses'),
    cap(card(deed('North Line'), 'thumb'), 'Railroad'),
    cap(card(deed('Water Works'), 'thumb'), 'Utility'),
    cap(card(deed('Sapphire Heights'), 'thumb'), 'Mortgaged', 'flipped to its back'),
    cap(card({ t: 'gojf' }, 'thumb'), 'Jail Free card', 'Chance frame'),
    cap(card({ t: 'cash', amount: 150 }, 'thumb'), 'Cash', 'banknote stack'),
    cap(voucher({ t: 'v', kind: 'rf', g: 'pink', n: 2, by: 'R', to: 'L' }, 'thumb'), 'Rent-Free', 'color set'),
    cap(voucher({ t: 'v', kind: 'rf', g: 'util', n: 1, by: 'R', to: 'L' }, 'thumb'), 'Rent-Free', 'utilities'),
  ].join('');
  const states = `<div class="paperbox">${cap(slot(card(deed('Amber Avenue'), 'thumb'), { focus: 1 }), 'Focused', 'solid forest fill, 1.05×')}${cap(slot(card(deed('Amber Avenue'), 'thumb'), { sel: 1 }), 'Current', 'outline only')}${cap(slot(card(deed('East Line'), 'thumb'), { inoffer: 1 }), 'In the offer', '')}${cap(slot(card(deed('Lilac Row'), 'thumb'), { blocked: 'Has houses' }), 'Can’t trade', 'reason stays readable')}${cap(emptySlot('Sunset Drive', 'R'), 'Not yours', 'owner shown')}${cap(emptySlot('Scarlet Square'), 'Unowned', '')}</div>`;
  const sw = L.SETS.map((g) => `<span class="sw${g === 'lightBlue' ? ' on' : ''}" style="background:${G[g].c}"></span>`).join('') + `<span class="sw" style="background:#2B2119;color:#FBF6EA">RR</span><span class="sw" style="background:#2B2119;color:#FBF6EA">UT</span>`;
  const steps = `<div class="steps">
<div class="step"><span class="sn">1 · Kind</span>${stepper('Rent-Free', { w: 460, focus: 1 })}<span class="sd">${glyph('dlr', 'switch', 44).replace('<svg', '<svg style="display:inline-block;vertical-align:middle"')} flips between Rent-Free and No Building. The preview card updates live.</span></div>
<div class="step"><span class="sn">2 · Group</span>${stepper('Light Blue', { w: 460 })}<div style="display:flex;gap:6px;flex-wrap:wrap">${sw}</div><span class="sd">◀ ▶ cycles groups in board order. Rent-Free: 8 sets, Railroads, Utilities. No Building: color sets only.</span></div>
<div class="step"><span class="sn">3 · Number</span>${stepper('×3 landings', { w: 460 })}<span class="sd">◀ ▶ ±1, L / R ±5. Landings for Rent-Free (1–99), full rounds for No Building (1–20).</span></div>
</div>`;
  return `<div class="sheet">
<div><div class="eyebrow" style="color:#F3D9A0">Shared component · used by Inventory and Trade</div><div class="h1">One card, three sizes</div><div class="sub">Everything you can own or trade is drawn as a card on the approved card stock (reference/cards.html). Thumbnail and standard sizes drop detail but never go below 14 px text. The detail size is the full deed, slightly enlarged from the reference so its small print clears 14 px.</div></div>
<div style="display:flex;gap:90px;align-items:flex-end">${sizes}${vsizes}</div>
<div class="sect"><span class="lab">Every kind, as a thumbnail</span><div class="line">${kinds}</div></div>
<div class="sect"><span class="lab">Slot states (the slot takes focus, never the card)</span>${states}</div>
<div class="sect"><span class="lab">Making or editing a voucher with a controller (same three steps in every Trade option)</span>${steps}</div>
</div>`;
}

module.exports = { cardsSheet: () => page('Shared card component', sheet(), 1700, 1920, CSS4) };
