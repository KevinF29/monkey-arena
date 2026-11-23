#!/usr/bin/env node
// Simulateur d'équilibrage de Monkey Arena (Node, sans dépendance).
// Extrait le bloc //LOGIC-START … //LOGIC-END d'index.html et joue des runs complètes
// (42 combats, récompenses choisies automatiquement) pour chaque gladiateur.
//
// Usage : node tools/simulate.js [--runs 500] [--seed 1] [--perso darkkus] [--tune '{"eHp":55}']

const fs = require('fs');
const path = require('path');

// --- options ---
const args = process.argv.slice(2);
const opt = (name, def) => { const i = args.indexOf('--' + name); return i >= 0 && args[i + 1] !== undefined ? args[i + 1] : def; };
const RUNS = Math.max(1, parseInt(opt('runs', '500'), 10) || 500);
const SEED = parseInt(opt('seed', '1'), 10) || 1;
const ONLY = opt('perso', null);

// --- aléatoire reproductible ---
function mulberry32(seed){
  return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
let rnd = mulberry32(SEED);
// le bloc logique appelle parfois Math.random directement : on lui passe un Math dont random() est seedé
const SimMath = Object.create(Math);
SimMath.random = () => rnd();

// --- extraction du bloc logique ---
const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const m = html.match(/\/\/LOGIC-START([\s\S]*?)\/\/LOGIC-END/);
if(!m){ console.error('Bloc //LOGIC-START … //LOGIC-END introuvable dans index.html'); process.exit(1); }
const EXPORTS = ['TUNE','CHARS','AUGS','ITEM','SETS','activeSets','NB_ACTS','PER_ACT','TOTAL','ACT_NAMES','actOf','isBoss','makePlayer','makeEnemy','newFight','step','rollChoices','applyAug','postWin','shuffle'];
const G = new Function('Math', m[1] + `\nreturn {${EXPORTS.join(',')}};`)(SimMath);
// --tune '{"eHp":55}' : essaie d'autres réglages sans toucher index.html
const TUNE_OVR = opt('tune', null);
if(TUNE_OVR) Object.assign(G.TUNE, JSON.parse(TUNE_OVR));

// --- stratégies de choix de récompense ---
const RANK = {C:0, R:1, L:2};
const randOf = a => a[Math.floor(rnd() * a.length)];
const bestBy = (choices, score) => { const m = Math.max(...choices.map(score)); return randOf(choices.filter(g => score(g) === m)); };
// nature d'un choix pour le joueur p : nouvel emplacement / montée de niveau / remplacement
function kindOf(p, g){
  if(g.slot){ const cur = p.gear[g.slot]; return !cur ? 'new' : cur.id === g.id ? 'up' : 'rep'; }
  return p.apts.some(a => a.id === g.id) ? 'up' : 'new';
}
const STRATEGIES = {
  hasard: {label: 'récompenses au hasard', pick: (p, c) => randOf(c)},
  rare: {label: 'récompenses les plus rares', pick: (p, c) => bestBy(c, g => RANK[g.r])},
  // joueur raisonnable : remplir un emplacement vide ou monter de niveau, ne remplacer que par plus rare
  sense: {label: 'choix sensés (nouveau / niveau +1, remplacement seulement par plus rare)', pick: (p, c) => bestBy(c, g => {
    const k = kindOf(p, g), r = RANK[g.r];
    if(k === 'new') return 10 + r;
    if(k === 'up') return 9 + r;
    const cur = G.ITEM[p.gear[g.slot].id];
    return RANK[g.r] > RANK[cur.r] && p.gear[g.slot].lvl === 1 ? 8 + r : r - 5;
  })}
};

// --- une run complète ---
const DT = 0.02, MAX_T = 600;   // les lions (après 45 s) terminent tout combat bien avant MAX_T
function playRun(ch, pick){
  const P = G.makePlayer(ch);
  const bosses = G.shuffle(G.CHARS.filter(c => c.id !== ch.id).map(c => c.id), rnd);
  for(let n = 1; n <= G.TOTAL; n++){
    const e = G.makeEnemy(n, bosses, rnd);
    const st = G.newFight(P, e);
    while(!st.over && st.t < MAX_T){ G.step(st, DT, rnd); st.events.length = 0; }
    if(st.winner !== 'a') return {win: false, n};
    if(n === G.TOTAL) return {win: true, n};
    G.postWin(P, n);
    const choices = G.rollChoices(n, P, rnd).filter(Boolean);
    if(choices.length) G.applyAug(P, pick(P, choices));
  }
}

// --- boucle principale ---
const chars = ONLY ? G.CHARS.filter(c => c.id === ONLY) : G.CHARS;
if(!chars.length){ console.error(`Perso inconnu : ${ONLY}. Choix : ${G.CHARS.map(c => c.id).join(', ')}`); process.exit(1); }

const pct = (a, b) => b ? (100 * a / b).toFixed(1).padStart(5) + ' %' : '    – ';
const ROMAN = ['I','II','III','IV','V','VI','VII','VIII','IX','X'];
const t0 = Date.now();

console.log(`Monkey Arena — ${RUNS} runs par perso et par stratégie, graine ${SEED}\n`);
for(const [sname, {label, pick}] of Object.entries(STRATEGIES)){
  console.log(`=== Stratégie : ${label} ===`);
  const head = ['Perso'.padEnd(14), 'Victoire'.padStart(8)]
    .concat(Array.from({length: G.NB_ACTS}, (_, i) => ('†' + ROMAN[i]).padStart(7)), ['dont boss'.padStart(10)]);
  console.log(head.join(' '));
  let totW = 0, totR = 0;
  for(const ch of chars){
    rnd = mulberry32(SEED * 1000 + G.CHARS.indexOf(ch) * 7 + Object.keys(STRATEGIES).indexOf(sname));
    let wins = 0, bossDeaths = 0;
    const deaths = new Array(G.NB_ACTS).fill(0);
    for(let r = 0; r < RUNS; r++){
      const res = playRun(ch, pick);
      if(res.win) wins++;
      else { deaths[G.actOf(res.n)]++; if(G.isBoss(res.n)) bossDeaths++; }
    }
    totW += wins; totR += RUNS;
    const dead = RUNS - wins;
    console.log([ch.name.padEnd(14), pct(wins, RUNS).padStart(8)]
      .concat(deaths.map(d => pct(d, dead).padStart(7)), [pct(bossDeaths, dead).padStart(10)]).join(' '));
  }
  if(chars.length > 1) console.log(`${'Moyenne'.padEnd(14)} ${pct(totW, totR).padStart(8)}`);
  console.log('');
}
console.log(`Colonnes †I…†${ROMAN[G.NB_ACTS - 1]} : part des morts survenues dans chaque acte ; « dont boss » : part des morts face à un boss.`);
console.log(`Durée : ${((Date.now() - t0) / 1000).toFixed(1)} s`);
