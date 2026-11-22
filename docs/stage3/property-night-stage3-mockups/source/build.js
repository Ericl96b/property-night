const fs = require('fs');
const path = require('path');
const { inventory } = require('./inventory');
const { trade } = require('./trade');
const { cardsSheet } = require('./cards');

const ROOT = process.argv[2] || '/mnt/user-data/outputs/artifacts/pn/project';
fs.mkdirSync(ROOT, { recursive: true });
const files = {};
for (let s = 1; s <= 4; s++) files[s === 1 ? 'Main.dc.html' : `Inventory-${s}.dc.html`] = inventory(s);
files['Cards.dc.html'] = cardsSheet();
for (const o of ['A', 'B', 'C']) for (let s = 1; s <= 4; s++) files[`Trade-${o}${s}.dc.html`] = trade(o, s);
for (const [f, html] of Object.entries(files)) fs.writeFileSync(path.join(ROOT, f), html);
console.log(Object.keys(files).map((f) => `${f} ${(files[f].length / 1024).toFixed(0)}KB`).join('\n'));
