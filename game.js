(() => {
'use strict';
const D = window.ISLAND, A = window.ART;
const W = D.W, H = D.H, C = D.C, GW = D.w, GH = D.h;
const $ = (s) => document.querySelector(s);
const cv = $('#cv'), mainCtx = cv.getContext('2d');
let ctx = mainCtx;   // peut pointer vers le calque des personnages (teinte jour / nuit)
const lcv = document.createElement('canvas'), lctx = lcv.getContext('2d');
const TAU = Math.PI * 2;
const rnd = (a, b) => a + Math.random() * (b - a);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const dist = (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by);
const ease = (t) => 1 - Math.pow(1 - clamp(t, 0, 1), 3);

/* ================= images ================= */
const img = {};
const MY = window.MYAH;
const SPR = window.SPR, TR = window.TREES;
const TALT = { coconut: { file: 'assets/coco.png', k: .2, s: {"sapling": [35, 154, 52, 96], "bare": [150, 67, 187, 186], "bud": [358, 15, 214, 246], "full": [586, 0, 223, 264], "bunch": [828, 33, 190, 208]} },
  mango: { file: 'assets/mango.png', k: .2, s: {"sapling": [25, 191, 47, 53], "bare": [151, 83, 138, 164], "bud": [334, 22, 223, 230], "full": [583, 3, 232, 261], "bunch": [851, 66, 170, 123]} } };
const names = ['map', 'mapx_lever', 'mapx_apm', 'mapx_coucher', 'mapx_nuit'].concat(Object.keys(MY).map(k => 'm_' + k), Object.keys(SPR).map(k => 's_' + k), ['t_trees', 't_coconut', 't_mango']);
const LATE = n => n.startsWith('mapx_') || (n[0] === 'm' && n[1] === '_' && n !== 'm_walk');   // cartes d'autres moments de la journée, tenues d'outils : chargées après le démarrage
const crit = names.filter(n => !LATE(n)); let loaded = 0, critLeft = crit.length, lateStarted = false;
const srcOf = n => n === 'map' ? 'assets/map.jpg' : n.startsWith('mapx_') ? 'assets/map_' + n.slice(5) + '.jpg' : n === 't_trees' ? TR.file : n === 't_coconut' ? TALT.coconut.file : n === 't_mango' ? TALT.mango.file : n[0] === 'm' && n[1] === '_' ? MY[n.slice(2)].file : SPR[n.slice(2)].src;
const startLate = () => { if (lateStarted) return; lateStarted = true; names.filter(LATE).forEach(n => { img[n].src = srcOf(n); }); };
names.forEach(n => { const i = new Image(); const done = ok => { loaded++; if (!LATE(n) && --critLeft === 0) startLate(); if (!ok) console.warn('image manquante', n); }; i.onload = () => done(true); i.onerror = () => done(false); img[n] = i; if (!LATE(n)) i.src = srcOf(n); });
const ready = () => critLeft <= 0;

// durées des animations (en « images » virtuelles, voir myahPose pour le dessin réel)
const ANIM = {
  idle: { n: 18, fps: 10 }, walk: { n: 25, fps: 24 }, run: { n: 25, fps: 34 }, jump: { n: 25, fps: 25 },
  basket: { n: 25, fps: 17 }, net: { n: 25, fps: 18 }, fish: { n: 25, fps: 14 },
};
const myIdx = {}; Object.keys(MY).forEach(k => { myIdx[k] = {}; MY[k].names.forEach((n, i) => myIdx[k][n] = i); });
const BASE = 0.22;           // pixels de carte par pixel de planche
const K = BASE / 0.38;       // rapport avec l'échelle d'origine (distances)

/* ================= masques ================= */
function decode(b64) { const s = atob(b64), a = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) a[i] = s.charCodeAt(i); return a; }
function unpack(b64) { const a = decode(b64), out = new Uint8Array(GW * GH); for (let i = 0; i < GW * GH; i++) out[i] = (a[i >> 3] >> (7 - (i & 7))) & 1; return out; }
function erode(m, n) {
  let a = m;
  for (let k = 0; k < n; k++) {
    const b = new Uint8Array(a.length);
    for (let y = 1; y < GH - 1; y++) for (let x = 1; x < GW - 1; x++) { const i = y * GW + x; b[i] = (a[i] && a[i - 1] && a[i + 1] && a[i - GW] && a[i + GW]) ? 1 : 0; }
    a = b;
  }
  return a;
}
const WIDE = D.wide ? unpack(D.wide) : null, WALK = unpack(D.walk), POND = unpack(D.pond), SEA = unpack(D.sea), SEAF = unpack(D.seaFish), ISL = unpack(D.isl);
for (let cy = 0; cy < Math.ceil(85 / C); cy++) for (let cx = 0; cx < GW; cx++) SEAF[cy * GW + cx] = 0;   // pas de poissons dans la zone « ciel » tout en haut
const POND_IN = POND, POND_SW = erode(POND, 2), POND_FISH = POND_IN;
const cell = (m, x, y) => { const cx = Math.floor(x / C), cy = Math.floor(y / C); return (cx < 0 || cy < 0 || cx >= GW || cy >= GH) ? 0 : m[cy * GW + cx]; };
const walkable = (x, y) => cell(WALK, x, y) === 1;
const isWater = (x, y) => cell(SEA, x, y) === 1 || cell(POND, x, y) === 1;
function snapMask(m, x, y, R = 60) {
  if (cell(m, x, y)) return [x, y];
  let best = null, bd = 1e9;
  for (let dy = -R; dy <= R; dy += 2) for (let dx = -R; dx <= R; dx += 2) if (cell(m, x + dx, y + dy)) { const d = dx * dx + dy * dy; if (d < bd) { bd = d; best = [x + dx, y + dy]; } }
  return best || [x, y];
}
function nearestWalk(x, y, R = 120) {
  if (walkable(x, y)) return [x, y];
  let best = null, bd = 1e9;
  for (let dy = -R; dy <= R; dy += 2) for (let dx = -R; dx <= R; dx += 2) if (walkable(x + dx, y + dy)) { const d = dx * dx + dy * dy; if (d < bd) { bd = d; best = [x + dx, y + dy]; } }
  return best;
}

/* ================= son (synthé minuscule) ================= */
let dayT = .05, dayAuto = true;   // moment de la journée (0 à 1) et cycle jour / nuit activé
let actx = null, muted = false, master = null, vol = .05, musVol = .2, musMaster = null, bright = 1;
let autoSv = true, skipTitle = false;
const PREF_KEY = 'ile-du-cygne-myah-prefs';
try { const p = JSON.parse(localStorage.getItem(PREF_KEY) || '{}'); if (isFinite(p.vol)) vol = Math.min(1, Math.max(0, p.vol)); if (isFinite(p.mus)) musVol = Math.min(1, Math.max(0, p.mus)); if (p.day === false) dayAuto = false; if (p.auto === false) autoSv = false; if (p.skip === true) skipTitle = true; if (isFinite(p.bright)) bright = Math.min(1.5, Math.max(.5, p.bright)); } catch (e) {}
function savePrefs() { try { localStorage.setItem(PREF_KEY, JSON.stringify({ vol, mus: musVol, bright, day: dayAuto, auto: autoSv, skip: skipTitle })); } catch (e) {} }
function masterOut() { if (!master) { master = actx.createGain(); master.gain.value = vol; master.connect(actx.destination); } return master; }
function musicOut() { audio(); if (actx && !musMaster) { musMaster = actx.createGain(); musMaster.gain.value = musVol; musMaster.connect(actx.destination); } return musMaster; }   // futur : la musique se branchera ici (source.connect(musicOut()))
/* ================= cycle jour / nuit ================= */
const DAY_LEN = 1440;   // 24 min réelles = 24 h de jeu (1 min = 1 h)
const DAY_KEYS = [   // chaque moment a sa carte et une teinte (r, g, b, force) pour les personnages et objets
  { n: 'map', a: 0, b: .24, c: [0, 0, 0, 0] },
  { n: 'mapx_apm', a: .32, b: .40, c: [255, 170, 60, .12] },
  { n: 'mapx_coucher', a: .50, b: .54, c: [255, 110, 60, .20] },
  { n: 'mapx_nuit', a: .64, b: .86, c: [10, 25, 80, .40] },
  { n: 'mapx_lever', a: .94, b: .95, c: [255, 150, 170, .14] },
  { n: 'map', a: 1, b: 1, c: [0, 0, 0, 0] },
];
function dayState() {
  const t = dayAuto ? dayT : .1;
  for (let i = 0; i < DAY_KEYS.length; i++) {
    const A = DAY_KEYS[i], B = DAY_KEYS[i + 1];
    if (t >= A.a && t <= A.b) return { A, B: A, u: 0, tint: A.c };
    if (B && t > A.b && t < B.a) { let u = (t - A.b) / (B.a - A.b); u = u * u * (3 - 2 * u); return { A, B, u, tint: A.c.map((v, k) => v + (B.c[k] - v) * u) }; }
  }
  return { A: DAY_KEYS[0], B: DAY_KEYS[0], u: 0, tint: DAY_KEYS[0].c };
}
function applyBright() { cv.style.filter = Math.abs(bright - 1) < .01 ? '' : 'brightness(' + bright + ')'; }
applyBright();
function audio() { if (!actx) { try { actx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) {} } if (actx && actx.state === 'suspended') actx.resume(); startMusic(); }
/* musique de fond : le fichier tourne en boucle (repeat), volume réglable dans les options, coupée avec le bouton son */
let musStarted = false, musGain = null;
function musApply() { if (musMaster) musMaster.gain.value = muted ? 0 : musVol; }
function startMusic() {
  if (musStarted || !actx) return; musStarted = true;
  fetch('assets/audio/musique.wav').then(r => r.arrayBuffer()).then(b => new Promise((ok, ko) => actx.decodeAudioData(b, ok, ko))).then(buf => {
    const out = musicOut(); if (!out) return;
    musGain = actx.createGain(); musGain.gain.setValueAtTime(0, actx.currentTime); musGain.gain.linearRampToValueAtTime(.45, actx.currentTime + 1.5);   // fondu d'entrée
    const src = actx.createBufferSource(); src.buffer = buf; src.loop = true; src.connect(musGain); musGain.connect(out); src.start(); musApply();
  }).catch(() => { musStarted = false; });
}
/* la musique du générique démarre dès la page d'accueil, dès que le navigateur l'autorise (premier toucher) */
;(() => { const go = () => { try { audio(); } catch (e) {} if (actx && actx.state === 'running') ['pointerdown', 'keydown', 'touchstart', 'click'].forEach(ev => document.removeEventListener(ev, go, true)); }; ['pointerdown', 'keydown', 'touchstart', 'click'].forEach(ev => document.addEventListener(ev, go, true)); try { audio(); } catch (e) {} })();
function blip(freq, dur = 0.12, type = 'sine', vol = 0.12, delay = 0, slide = 0) {
  if (muted || !actx) return;
  const t = actx.currentTime + delay, o = actx.createOscillator(), g = actx.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, t);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(40, freq + slide), t + dur);
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(masterOut()); o.start(t); o.stop(t + dur + 0.02);
}
const sfx = {
  pick() { blip(660, .1, 'triangle'); blip(990, .14, 'triangle', .12, .08); },
  net() { blip(500, .18, 'sine', .08, 0, 300); },
  catchb() { [784, 988, 1175].forEach((f, i) => blip(f, .14, 'triangle', .12, i * .07)); },
  splash() { blip(300, .2, 'sawtooth', .05, 0, -150); },
  cast() { blip(700, .25, 'sine', .07, 0, -450); },
  bite() { blip(880, .1, 'square', .08); blip(880, .1, 'square', .08, .14); },
  fish() { [523, 659, 784, 1046].forEach((f, i) => blip(f, .16, 'triangle', .13, i * .08)); },
  hop() { blip(400, .18, 'sine', .08, 0, 350); },
  talk() { blip(520, .06, 'square', .05); },
  star() { [523, 659, 784, 1046, 1318].forEach((f, i) => blip(f, .22, 'triangle', .14, i * .1)); },
  no() { blip(220, .18, 'sawtooth', .06); },
  unlock() { blip(300, .08, 'square', .06); blip(450, .08, 'square', .06, .09); blip(900, .25, 'triangle', .1, .2); },
  chest() { [392, 523, 659, 784, 1046, 1318].forEach((f, i) => blip(f, .3, 'triangle', .12, i * .09)); },
  reveal(k) { const b = [523, 659, 784, 988, 1319][k % 5]; blip(b, .9, 'sine', .1); blip(b * 1.5, .9, 'triangle', .06, .06); blip(b * 2, .6, 'sine', .04, .12); },
  mount() { blip(300, .3, 'triangle', .08, 0, 500); blip(620, .3, 'sine', .07, .1, 400); blip(1100, .2, 'triangle', .06, .2); },
};

/* ================= histoire et quêtes ================= */
const SAVE_KEY = 'ile-du-cygne-myah-v3';
const inv = { banana: 0, flower: 0, butterfly: 0, fish: 0, coconut: 0, mango: 0 };
const ICO_TXT = { panier: 'panier', filet: 'filet', canne: 'canne', coffre: 'coffre', 'a-tresor': 'Ouvrir', 'a-parler': 'Parler', 'a-prendre': 'Prendre', 'a-cueillir': 'Cueillir', 'a-donner': 'Donner', 'a-attraper': 'Attraper', 'a-pecher': 'Pêcher' };
const ico = (t) => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/\[(panier|filet|canne|coffre|a-tresor|a-parler|a-prendre|a-cueillir|a-donner|a-attraper|a-pecher)\]/g, (m, k) => ICO_TXT[k]);   // textes simples, plus d'icônes
const ICON = { banana: '🍌', flower: '🌸', butterfly: '🦋', fish: '🐟', coconut: '🥥', mango: '🥭' };
const FCOLOR = [['#ff7eb6', '#ffd6e8'], ['#4aa3ff', '#cfe6ff'], ['#ffd23d', '#fff1b0'], ['#3ed6b0', '#c9f5ea'], ['#b980ff', '#e9d8ff']];
const FNAME = ['rose', 'bleue', 'dorée', 'turquoise', 'violette'];

const QUESTS = [
  { id: 'rose', npc: 'maman', spot: 'rose', who: 'Miraaï, ta maman', need: { coconut: 4 }, title: '4 noix de coco pour Miraaï', tool: 'basket', fe: 0,
    start: ['Myah, ma chérie ! Bientôt, c\'est la fête du Cygne, et je prépare la boisson traditionnelle au lait de coco. 🥥', 'Peux-tu me rapporter 4 noix de coco ? Prends ton panier [panier] et cherche les cocotiers, vers l\'est de l\'île !', 'Quand j\'aurai mes noix de coco, mon coffre s\'ouvrira : il garde une plume du Cygne légendaire.'],
    remind: ['Il me faut encore des noix de coco 🥥 pour la boisson de la fête ! Regarde sous les cocotiers.'],
    done: ['Oh merci ma puce ! Ces noix de coco sont parfaites : la boisson de la fête sera délicieuse ! 🥥', 'Mon coffre est caché dans le buisson qui scintille ✨ devant la maison, à gauche de la porte. Fouille-le : la plume est pour toi !'] },
  { id: 'bleu', where: 'du petit jardin sur la falaise', npc: 'frere', spot: 'gauche', who: 'Nijan, ton petit frère', need: { butterfly: 3 }, title: '3 papillons pour Nijan', tool: 'net', fe: 1,
    start: ['Myah ! Myah ! Je voudrais voir des papillons de près ! 🦋', 'Attrape-en 3 avec ton filet [filet]. Avance doucement : ils se posent parfois sur les fleurs.', 'Mon coffre garde une plume du Cygne légendaire. Il s\'ouvrira pour toi !'],
    remind: ['Il m\'en faut encore, des papillons 🦋 ! Approche-toi doucement avec ton filet !'],
    done: ['Waaaah ! Ils sont trop beaux !', 'Mon coffre est caché dans le buisson qui scintille ✨ du petit jardin sur la falaise, à gauche de la maison de Maman. Va le fouiller !'] },
  { id: 'soleil', where: 'devant le poste de soin', npc: 'soigneuse', spot: 'haut2', who: 'Professeur Lulia', need: { flower: 5 }, title: '5 fleurs pour Lulia', tool: 'basket', fe: 2,
    start: ['Bonjour Myah ! Mes petits protégés adorent les fleurs. 🌼', 'Peux-tu cueillir 5 jolies fleurs 🌸 avec ton panier [panier] ?', 'Je te donnerai le contenu de mon coffre : une plume du Cygne légendaire !'],
    remind: ['Encore quelques fleurs 🌸, s\'il te plaît ! Elles poussent dans les petits jardins.'],
    done: ['Quel beau bouquet ! Les animaux vont se régaler.', 'Mon coffre est caché dans le buisson qui scintille ✨ devant le poste de soin. Fouille-le !'] },
  { id: 'toto', npc: 'pecheur', spot: 'sud', who: 'Zyno, le vieux pêcheur', need: { fish: 2 }, title: '2 poissons pour Zyno', tool: 'fish', fe: 3,
    start: ['Ce soir, c\'est poisson grillé ! 🐟', 'Pêche 2 poissons avec ta canne [canne], dans l\'étang ou depuis la plage. Ils sont timides : attends qu\'ils mordent !', 'Mon coffre cache une plume du Cygne légendaire. Il est à toi après ça !'],
    remind: ['Il me faut encore du poisson 🐟. Va près de l\'eau et sois patiente !'],
    done: ['Quelle belle pêche ! Bravo Myah !', 'Mon coffre est caché dans le buisson qui scintille ✨ près de moi. La plume t\'attend !'] },
  { id: 'plume', npc: 'juliana', spot: 'obs', who: 'Yulia, la directrice du musée', need: { mango: 5, banana: 6 }, title: 'La fête : 5🥭 6🍌', tool: null, final: true, fe: 4,
    start: ['Myah ! Ce soir, sous les étoiles, nous fêtons le retour du Cygne légendaire ! 🎉', 'Pour le festin, il me faut : 5 mangues 🥭 et 6 bananes 🍌. Les arbres du jardin à l\'est en regorgent !', 'Le coffre est caché au pied de l\'observatoire : Yurii t\'y attend, il connaît tous les oiseaux de l\'île !'],
    remind: ['Pour le festin, il me faut : 5 mangues 🥭 et 6 bananes 🍌 !'],
    locked: ['Reviens me voir quand tu auras aidé Miraaï, Nijan, Lulia et Zyno !'],
    done: ['Hourra ! Le festin sera délicieux !', 'Le coffre est caché dans le buisson qui scintille ✨ au pied de l\'observatoire. C\'est la dernière plume !'] },
];

/* ----- bavardages : les habitants parlent de leur vie sur l'île tant que ce n'est pas le tour de leur quête ----- */
const CHAT = {
  maman: [
    ['La boisson de la fête du Cygne, c\'est la recette de ta grand-mère : lait de coco, un peu de miel et une pointe de citron. 🥥'],
    ['J\'ai arrosé mon petit jardin ce matin. Les herbes sentent si bon quand le soleil se lève ! 🌿'],
    ['Ton petit frère ne tient pas en place aujourd\'hui. Il court partout après les papillons ! 🦋'],
    ['Quand le vent vient de la mer, le linge sèche en une heure. J\'adore cette île ! 🌬️'],
    ['Tu as bien mangé ce matin, Myah ? Un bon petit-déjeuner, ça donne des ailes !', 'Enfin... à toi, il t\'en faut peut-être un peu moins ! 😄'],
    ['J\'entends la mer depuis la cuisine. C\'est ma musique préférée pendant que je cuisine. 🎶'],
  ],
  frere: [
    ['Myah ! J\'ai fait la course avec un crabe sur la plage. Il a gagné... 🦀'],
    ['Tu sais, j\'ai compté 12 marches dans l\'escalier de la falaise. Ou 13 ? Je recommence ! 🪜'],
    ['Chut ! Je joue à cache-cache avec les poissons du petit étang. Ils sont super forts ! 🐟'],
    ['Un jour, je volerai plus haut que toi ! Enfin... quand mes ailes auront poussé. 🪽'],
    ['Maman dit que je dois me laver les mains avant de manger. Mais les papillons, eux, ne se lavent jamais ! 😆'],
    ['J\'ai trouvé un coquillage qui chante quand on l\'écoute ! Tiens, écoute... non, il s\'est arrêté. 🐚'],
  ],
  soigneuse: [
    ['Les animaux de l\'île savent toujours quand on est triste. Ils viennent se blottir contre moi. 🐾'],
    ['Je prépare une tisane avec les herbes du jardin. Un peu de menthe, un peu de miel... 🍯'],
    ['Si un jour tu te fais une petite bosse, viens me voir au poste de soin. J\'ai un baume magique ! 🩹'],
    ['Hier, un oisillon est tombé du nid. Il va très bien maintenant, il pépie du matin au soir ! 🐦'],
    ['Tu savais que les fleurs de l\'île changent de couleur selon la saison ? Je les note dans mon carnet. 📖'],
    ['Je range mes flacons par couleur. C\'est joli et ça m\'évite de me tromper ! 🧴'],
  ],
  pecheur: [
    ['Quarante ans que je pêche ici, et la mer m\'étonne encore chaque matin. 🌊'],
    ['Les poissons mordent mieux quand l\'eau est calme. Un bon pêcheur sait attendre, Myah. 🎣'],
    ['Ma barque a pris un coup de rabot hier. Elle sera plus belle que neuve ! ⛵'],
    ['Je raconte toujours la même histoire du gros poisson... et il grandit à chaque fois ! 😄'],
    ['Quand les mouettes crient, c\'est que le poisson n\'est pas loin. Écoute-les bien ! 🕊️'],
    ['Pas besoin de montre : je lis l\'heure dans la marée. 🌅'],
  ],
  juliana: [
    ['Chaque objet du musée a sa place, et chacun raconte un petit bout de l\'histoire de l\'île. 🏛️'],
    ['Savais-tu que certaines fleurs ne s\'ouvrent qu\'à la tombée de la nuit ? C\'est très rare. 🌙'],
    ['Un jour, j\'aimerais exposer un poisson aux sept couleurs. On dit qu\'il existe... 🌈'],
    ['Mon mari Yurii passe ses journées à l\'observatoire, à compter les oiseaux. Moi, je préfère les vitrines ! 😄'],
    ['Si tu trouves un objet rare, apporte-le-moi : je lui trouverai une belle vitrine. ✨'],
    ['Je dessine aussi une carte de l\'île. Il me manque encore quelques recoins à explorer. 🗺️'],
  ],
  maima: [
    ['Être la cheffe, c\'est surtout écouter tout le monde. Et boire beaucoup de thé ! 🍵'],
    ['Chaque soir, je fais le tour de l\'île pour m\'assurer que chacun va bien. 🌺'],
    ['Cette île est petite, mais elle a le plus grand des cœurs. Et vous, les enfants, en êtes le trésor ! 💛'],
    ['Si tu as un souci, Myah, ma porte est toujours ouverte. Même si je n\'ai pas de porte... juste un grand sourire ! 😊'],
    ['Autrefois, on dansait sur la plage quand le Cygne revenait. J\'aimerais revoir ça. 💃'],
  ],
  poggi: [
    ['Les bananes de l\'île sont les plus sucrées que je connaisse. Il paraît que c\'est grâce au vent salé ! 🍌'],
    ['Je répare le pont du lac cette semaine. Il grince un peu, mais il tient bon ! 🔨'],
    ['Les noix de coco, c\'est lourd ! Mais le lait de coco du festin vaut tous les efforts. 🥥'],
    ['La coque de la barque de Zyno était fissurée. Un peu de goudron, quelques planches... et elle flotte comme neuve ! ⛵'],
    ['Ici, on cueille les fleurs du matin pour les marchés du soir. Leur parfum tient toute la journée ! 🌺'],
    ['J\'ai refait le toit de chaume de la cabane du port. Trois jours de travail, mais plus une goutte ne passe ! 🏠'],
    ['Une bonne échelle, ça se choisit avec soin. Celle de l\'observatoire, c\'est moi qui l\'ai faite ! 🪜'],
    ['Tout ce qui pousse ici se partage : fruits, fleurs, herbes... L\'île est généreuse avec ceux qui la respectent. 🌿'],
    ['Pas de panique : un clou par-ci, un coup de marteau par-là, et tout repart ! Bateau, escalier ou cabane. 🛠️'],
    ['Mon secret pour ne jamais être fatigué ? Une sieste sous un palmier à midi. 😴'],
  ],
  kykah: [
    ['Ce collier de coquillages, je l\'ai enfilé perle par perle. Ça m\'a pris trois soirées ! 📿'],
    ['Les plus beaux coquillages arrivent après la tempête. La mer nous fait des cadeaux ! 🐚'],
    ['Chaque perle a son histoire. Celle-ci vient du fond de la baie, là où l\'eau est la plus bleue. 💎'],
    ['Tu veux un conseil ? Marche pieds nus dans le sable à marée basse. On y trouve des trésors ! 🏖️'],
    ['Mon étal sent la mer et le sel. J\'adore ça ! 🌊'],
  ],
  gardien: [
    ['Regarde ce colibri ! Ses ailes battent plus de cinquante fois par seconde. 🐦'],
    ['Les perroquets de l\'île se reconnaissent à leur cri. Écoute bien : celui-là dit « Myah » ! 🦜'],
    ['Depuis l\'observatoire, je note chaque oiseau qui passe dans mon carnet. Ma femme Yulia dit que j\'en ai trop ! 😄'],
    ['Quand le Cygne légendaire vole, tous les oiseaux se taisent un instant. C\'est magique. 🪶'],
    ['Avec la longue-vue, tu peux les voir passer : essaie le soir ! 🔭'],
  ],
};
const chatLast = {};
function chatter(key) {
  const a = CHAT[key]; if (!a) return ['Belle journée sur l\'île, n\'est-ce pas ? ☀️'];
  let i; do { i = Math.floor(Math.random() * a.length); } while (a.length > 1 && i === chatLast[key]);
  chatLast[key] = i; return a[i];
}
const qState = {}; QUESTS.forEach(q => qState[q.id] = 'new');   // new | active | done
const opened = {};                                              // coffres ouverts
const bonusStar = {};                                           // étoile bonus : mission réussie en Aventure ou Défi
let phase = 'quests';          // quests | reveal | appeared | returned
let mountUnlocked = false;
let introSeen = false;

const nOpened = () => QUESTS.filter(q => opened[q.id]).length;
const unlocked = q => !q.final || QUESTS.filter(o => !o.final).every(o => qState[o.id] === 'done');
const hasAll = q => Object.entries(q.need).every(([k, n]) => inv[k] >= n);
const needStr = q => Object.entries(q.need).map(([k, n]) => `${ICON[k]}${Math.min(inv[k], n)}/${n}`).join(' ');

/* ================= collection du musée ================= */
const COLL = [
  { id: 'f0', cat: 'fleurs', img: 'flower0', name: 'Héliconie flamboyante', desc: 'Ses bractées rouges et orange ressemblent à des becs de homard.' },
  { id: 'f1', cat: 'fleurs', img: 'flower1', name: 'Frangipanier rose', desc: 'Ses fleurs parfumées servent de colliers de bienvenue.' },
  { id: 'f2', cat: 'fleurs', img: 'flower2', name: 'Orchidée de minuit', desc: 'Une orchidée bleue qui s\'ouvre quand le soleil se couche.' },
  { id: 'f3', cat: 'fleurs', img: 'flower3', name: 'Passiflore dorée', desc: 'Ses filaments étoilés tournent comme un petit soleil.' },
  { id: 'f4', cat: 'fleurs', img: 'flower4', name: 'Hibiscus de feu', desc: 'Une grande fleur rouge, la préférée des colibris de l\'île.' },
  { id: 'f5', cat: 'fleurs', img: 'flower5', name: 'Frangipanier corail', desc: 'Un bouquet de fleurs d\'un rose vif et sucré.' },
  { id: 'f6', cat: 'fleurs', img: 'flower6', name: 'Fleur du lagon', desc: 'Une fleur jaune et douce, qu\'on trouve près de la plage.' },
  { id: 'f9', cat: 'fleurs', img: 'flower9', name: 'Lotus d\'azur', desc: 'Un lotus bleu dont les pétales gardent la fraîcheur de l\'étang.' },
  { id: 'f7', cat: 'fleurs', img: 'flower7', rare: true, name: 'Oiseau de paradis', desc: 'Elle ressemble à un oiseau multicolore prêt à s\'envoler.' },
  { id: 'f8', cat: 'fleurs', img: 'flower8', rare: true, name: 'Fleur de la passion sauvage', desc: 'Une fleur à vrilles que le Cygne légendaire aimait, dit-on.' },
  { id: 'p0', cat: 'poissons', img: 'fishA0', name: 'Poisson-perroquet vert', desc: 'Vert, rayé d\'orange, il grignote les algues du récif.' },
  { id: 'p1', cat: 'poissons', img: 'fishA1', name: 'Poisson-lune pailleté', desc: 'Turquoise et tacheté de violet, il brille entre deux eaux.' },
  { id: 'p2', cat: 'poissons', img: 'fishA2', name: 'Poisson-damier', desc: 'Doré, il porte un quadrillage rose comme un patchwork.' },
  { id: 'p4', cat: 'poissons', img: 'fish4', name: 'Poisson-clown', desc: 'Orange et blanc, il se cache dans les anémones.' },
  { id: 'p5', cat: 'poissons', img: 'fish5', rare: true, name: 'Ange des brumes', desc: 'Blanc, orange et bleu, il glisse comme un voile.' },
  { id: 'p6', cat: 'poissons', img: 'fish6', rare: true, name: 'Globe-soleil', desc: 'Un poisson rond et jaune qui gonfle quand il a peur.' },
  { id: 'prb', cat: 'poissons', img: 'fishrb', rare: true, name: 'Petit arc-en-ciel', desc: 'Un poisson aux sept couleurs, une légende chez les pêcheurs.' },
  { id: 'sh0', cat: 'coquillages', img: 'shell0', name: 'Conque rose', desc: 'Si on l\'approche de l\'oreille, on entend la mer.' },
  { id: 'sh1', cat: 'coquillages', img: 'shell1', name: 'Coquille Saint-Jacques', desc: 'Striée comme un petit éventail doré.' },
  { id: 'sh2', cat: 'coquillages', img: 'shell2', name: 'Étoile de mer orange', desc: 'Elle a cinq bras et peut en refaire un nouveau.' },
  { id: 'sh3', cat: 'coquillages', img: 'shell3', name: 'Nautile nacré', desc: 'Sa spirale brille comme une perle.' },
  { id: 'sh4', cat: 'coquillages', img: 'shell4', name: 'Oursin violet', desc: 'Il est tout piquant : on le regarde sans le toucher.' },
  { id: 'sh5', cat: 'coquillages', img: 'shell5', rare: true, name: 'Perle rare', desc: 'Une perle toute ronde, cachée dans le sable.' },
  { id: 'sh7', cat: 'coquillages', img: 'shell7', rare: true, name: 'Oursin doré', desc: 'Un oursin couleur de soleil, très très rare.' },
  { id: 'g0', cat: 'cadeaux', img: 'gift0', rare: true, name: 'Corbeille de fruits exotiques', desc: 'Pitaya, mangoustan et carambole : un cadeau d\'un habitant de l\'île.' },
  { id: 'g1', cat: 'cadeaux', img: 'gift1', rare: true, name: 'Nautile enveloppé', desc: 'Un coquillage nacré, noué dans une feuille avec de la raphia.' },
  { id: 'g2', cat: 'cadeaux', img: 'gift2', rare: true, name: 'Cœur doré', desc: 'Un cœur d\'or dans son écrin de noix de coco : le signe d\'une vraie amitié.' },
  { id: 'crabe', cat: 'coquillages', img: 'an_crabe', name: 'Crabe rouge', desc: 'Il pince fort, mais il est très gentil quand on est doux.' },
  { id: 'sh8', cat: 'coquillages', img: 'shell8', rare: true, name: 'Nautile des lagons', desc: 'Sa spirale turquoise vient des eaux les plus claires.' },
  { id: 'sh6', cat: 'coquillages', img: 'shell6', rare: true, name: 'Verre de mer turquoise', desc: 'Un vieux morceau de verre poli par les vagues.' },
  { id: 'n0', cat: 'nuit', img: 'nuit_luciole', name: 'Luciole', desc: 'Elle s\'allume pour dire bonsoir.' },
  { id: 'n1', cat: 'nuit', img: 'nuit_fleur', rare: true, name: 'Fleur de minuit', desc: 'Elle ne s\'ouvre que la nuit, et elle brille.' },
  { id: 'n2', cat: 'nuit', img: 'nuit_poisson', rare: true, name: 'Poisson-lanterne', desc: 'Il porte une petite lumière pour éclairer la mer.' },
  { id: 'n3', cat: 'nuit', img: 'nuit_meduse', rare: true, name: 'Méduse-lune', desc: 'Elle flotte doucement sous la lune.' },
];
const coll = {};   // objets donnés au musée : { id: true }
function renderColl() {
  const cats = [['fleurs', '🌸 Fleurs'], ['poissons', '🐟 Poissons'], ['coquillages', '🐚 Coquillages'], ['nuit', '🌙 Trouvailles de nuit'], ['cadeaux', '🎁 Cadeaux d\'amitié']];
  const got = COLL.filter(c => coll[c.id]).length;
  let h = '<div class="ch"><b>🏛️ Collection du Musée Kaïkiti</b><span>' + got + ' / ' + COLL.length + '</span><button id="collX" aria-label="Fermer">✕</button></div><div class="cb">';
  cats.forEach(([k, t]) => {
    const L = COLL.filter(c => c.cat === k);
    h += '<h3>' + t + (L.length ? ' <small>' + L.filter(c => coll[c.id]).length + '/' + L.length + '</small>' : '') + '</h3>';
    if (!L.length) { h += '<p class="soon">Bientôt… Yulia prépare la place pour les coquillages ✨</p>'; return; }
    h += '<div class="grid">' + L.map(c => {
      const ok = !!coll[c.id], nm = ok ? c.name : (c.rare ? '???' : c.name);
      return '<div class="slot' + (ok ? ' ok' : '') + (c.rare ? ' rare' : '') + '"><img src="assets/spr/' + c.img + '.png" alt="">' + (c.rare ? '<i>✨</i>' : '') + '<span>' + nm + '</span>' + (ok ? '<em>' + c.desc + '</em>' : '') + '</div>';
    }).join('') + '</div>';
  });
  $('#collBody').innerHTML = h + '</div>';
  $('#collX').onclick = closeColl;
}
const tipsOpen = () => $('#tips').style.display === 'grid';
function openColl() { renderColl(); $('#coll').style.display = 'grid'; }
function closeColl() { $('#coll').style.display = 'none'; player.state = 'free'; }
function savePos() {   // où est Myah : dehors, ou dans une maison (étage compris)
  if (!started || cine || player.state === 'dead') return null;
  const p = player, o = { x: Math.round(p.x), y: Math.round(p.y), face: p.face, tool };
  if (IN.on && HOUSE) o.inside = { id: HOUSE.id, floor: IN.floor, x: Math.round(IN.x), y: Math.round(IN.y) };
  return o;
}
let lastPos = null, saveTs = 0, slot = 1;
const NSLOTS = 5, slotKey = n => SAVE_KEY + '-s' + n;
let _idb = null;
function idbOpen(cb) { if (_idb) return cb(_idb); try { const r = indexedDB.open('ile-du-cygne-backup', 1); r.onupgradeneeded = () => r.result.createObjectStore('s'); r.onsuccess = () => { _idb = r.result; cb(_idb); }; r.onerror = () => cb(null); } catch (e) { cb(null); } }
function idbPut(k, v) { idbOpen(db => { if (!db) return; try { db.transaction('s', 'readwrite').objectStore('s').put(v, k); } catch (e) {} }); }
function idbAll(cb) { idbOpen(db => { if (!db) return cb({}); try { const o = {}, rq = db.transaction('s').objectStore('s').openCursor(); rq.onsuccess = () => { const c = rq.result; if (c) { o[c.key] = c.value; c.continue(); } else cb(o); }; rq.onerror = () => cb({}); } catch (e) { cb({}); } }); }
function save(force) {   // force : sauvegarde demandée à la main ; sinon seulement si la sauvegarde automatique est active
  if (!force && !autoSv) return;
  try {
    const pos = savePos() || lastPos; lastPos = pos; saveTs = Date.now();
    const js = JSON.stringify({ dayT, inv, qState, opened, bonusStar, level, phase, mountUnlocked, introSeen, coll, pos, outfit, mini, name: playerName, ts: saveTs });
    localStorage.setItem(slotKey(slot), js); idbPut(slotKey(slot), js);   // copie de secours dans IndexedDB
    localStorage.setItem(SAVE_KEY + '-active', String(slot));
  } catch (e) {}
}
function readSlot(n) { try { return JSON.parse(localStorage.getItem(slotKey(n)) || 'null'); } catch (e) { return null; } }
function resetState() {
  dayT = .05; playerName = '';
  Object.keys(inv).forEach(k => inv[k] = 0); Object.keys(coll).forEach(k => delete coll[k]);
  QUESTS.forEach(q => { qState[q.id] = 'new'; opened[q.id] = false; delete bonusStar[q.id]; q.chestOpen = 0; q.opening = false; });
  phase = 'quests'; mountUnlocked = false; introSeen = false; lastPos = null; saveTs = 0; IN.lie = null; IN.bunk = null; IN.shower = null; IN.sit = null; IN.wash = null; IN.steam = 0; IN.puff = null; waterStop(); setOutfit(null); Object.assign(mini, { fire: 0, wish: 0, rico: 0 });
}
function load(n) {
  resetState(); const s = readSlot(n); if (!s) return false;
  if (isFinite(s.dayT)) dayT = s.dayT; Object.assign(inv, s.inv); Object.assign(qState, s.qState); Object.assign(opened, s.opened || {}); Object.assign(bonusStar, s.bonusStar || {}); setLevel(s.level || 'aventure'); Object.assign(coll, s.coll || {});
  phase = s.phase === 'reveal' ? 'appeared' : (s.phase || 'quests'); mountUnlocked = !!s.mountUnlocked; introSeen = !!s.introSeen;
  lastPos = s.pos || null; saveTs = s.ts || 0; playerName = typeof s.name === 'string' ? s.name.slice(0, 16) : ''; setOutfit(s.outfit); Object.assign(mini, { fire: 0, wish: 0, rico: 0 }, s.mini || {});
  return true;
}
function wipe() { try { localStorage.removeItem(slotKey(slot)); } catch (e) {} }


/* ================= petites interactions : ricochets, lucioles, vœux ================= */
const mini = { fire: 0, wish: 0, rico: 0 };   // lucioles attrapées, vœux faits, record de ricochets
const MI = { flies: [], pebble: null, ripples: [], star: null, nextStar: 14, wishT: 0 };
const nightAmt = () => Math.max(0, Math.min(1, (dayState().tint[3] - .12) / .22));

const MIM = {}; ['shell0','shell1','shell2','shell3','shell4','shell5','shell6','shell7','shell8','nuit_luciole','nuit_fleur','nuit_poisson','nuit_meduse','an_chat','an_tortue','an_crabe','crab0','crab1','crab2','crab3','crab4','an_singe','colib0','colib1','perroquet'].forEach(n => { const i = new Image(); i.src = 'assets/spr/' + n + '.png'; MIM[n] = i; });
const mimOk = n => MIM[n] && MIM[n].complete && MIM[n].naturalWidth;
MI.items = []; MI.animals = []; MI.itemT = 0;
const SHELL_IDS = ['sh0', 'sh1', 'sh2', 'sh3', 'sh4', 'sh5', 'sh6', 'sh7', 'sh8'];
function beachSpot() {
  for (let k = 0; k < 120; k++) {
    const x = 40 + Math.random() * (W - 80), y = 40 + Math.random() * (H - 80); if (!walkable(x, y)) continue;
    if ([[26, 0], [-26, 0], [0, 20], [0, -20]].some(d => cell(SEA, x + d[0], y + d[1]) === 1)) return [x, y];
  } return null;
}
function pondSpot() {   // fleurs de minuit : uniquement sur l'herbe
  const c = scatter.cells.filter(p => flowerOK(p[0], p[1]) && !MI.items.some(i => i.kind === 'flower' && dist(i.x, i.y, p[0], p[1]) < 20));
  return c.length ? c[(Math.random() * c.length) | 0] : null;
}
function shallowSpot() {
  for (let k = 0; k < 150; k++) { const x = 40 + Math.random() * (W - 80), y = 40 + Math.random() * (H - 80); if (cell(SEA, x, y) !== 1) continue; if ([[30, 0], [-30, 0], [0, 24], [0, -24]].some(d => walkable(x + d[0], y + d[1]))) return [x, y]; }
  return null;
}
const ITEM_DEF = { sh0: ['shell0', 8], sh1: ['shell1', 8], sh2: ['shell2', 8], sh3: ['shell3', 7.5], sh4: ['shell4', 7], sh5: ['shell5', 5], sh6: ['shell6', 6.5], sh7: ['shell7', 7], sh8: ['shell8', 7.5], n1: ['nuit_fleur', 8], n2: ['nuit_poisson', 26], n3: ['nuit_meduse', 11] };
function miniSpawn(ns) {
  const day = MI.items.filter(i => i.kind === 'shell').length;
  const SAND = [[300, 398], [352, 428], [392, 424], [432, 430], [480, 424], [525, 430], [565, 412]];   // places de sable dégagées, sans objet devant   // 7 coins de sable, bien répartis sur la plage
  if (day < 7) { const free = SAND.filter(q => !MI.items.some(i => i.kind === 'shell' && dist(i.x, i.y, q[0], q[1]) < 8)), s = free.length ? free[Math.floor(Math.random() * free.length)] : null; if (s) { const pool = (mini.dayNo || 0) % 2 ? ['sh2', 'sh4', 'sh7', 'sh8'] : ['sh0', 'sh1', 'sh3'], id = pool[Math.floor(Math.random() * pool.length)];   // 1 jour sur 2 : d'autres coquillages (étoile, oursins, nautile turquoise)   // 3 styles : conque rose, Saint-Jacques, nautile
 MI.items.push({ kind: 'shell', id, x: s[0], y: s[1], ph: Math.random() * 9, t: 0 }); } }
  if (ns > .3) {
    const fl = MI.items.filter(i => i.kind === 'flower').length; if (fl < 3) { const s = pondSpot(); if (s) MI.items.push({ kind: 'flower', id: 'n1', x: s[0], y: s[1], ph: Math.random() * 9, t: 0 }); }
    const sea = MI.items.filter(i => i.kind === 'sea').length; if (sea < 3) { const s = shallowSpot(); if (s) MI.items.push({ kind: 'sea', id: Math.random() < .5 ? 'n2' : 'n3', x: s[0], y: s[1], ph: Math.random() * 9, t: 0, a: Math.random() * TAU }); }
  }
}
function miniAnimalsInit() {
  const nb = (x, y) => { const p = nearestWalk(x, y); return p; };
  const at = (x, y) => walkable(x, y) ? [x, y] : nb(x, y);   // emplacements choisis à la main
  const b1 = at(535, 421), b2 = beachSpot() || nb(D.start[0] + 30, D.start[1]), tr = at(300, 266);
  const c = at(612, 307);
  MI.animals = [
    { id: 'chat', img: 'an_chat', x: c[0], y: c[1], hx: c[0], hy: c[1], h: 15, tx: c[0], ty: c[1], wait: 2, face: 1, heart: 0, snd: [900, 700] },
    { id: 'tortue', img: 'an_tortue', x: b1[0], y: b1[1], hx: b1[0], hy: b1[1], h: 15, tx: b1[0], ty: b1[1], wait: 3, face: -1, heart: 0, snd: [200, 260] },
    { id: 'crabe', img: 'an_crabe', x: b2[0], y: b2[1], hx: b2[0], hy: b2[1], h: 11, tx: b2[0], ty: b2[1], wait: 1, face: 1, heart: 0, snd: [1200, 1000] },
    { id: 'singe', img: 'an_singe', x: tr[0], y: tr[1], hx: tr[0], hy: tr[1], h: 17, tx: tr[0], ty: tr[1], wait: 2, face: 1, heart: 0, snd: [600, 800] },
  ];
}
const ANIMAL_TXT = { chat: ['Miaou ! 💕', 'Le chat ronronne…'], tortue: ['La tortue sourit doucement 🐢', 'Elle rentre un peu la tête, toute contente'], crabe: ['Le crabe agite ses pinces 🦀', 'Cliquetis de joie ! Avec le panier, tu pourrais l\'attraper…'], singe: ['Le singe fait « Hou hou ! » 🐒', 'Il te tend une petite main'] };
const crZone = () => IS_TOUCH ? [.28, .9] : [.38, .85];   // zone verte du crabe (plus large sur téléphone)
const CRAB_ZONE = [412, 436, 16, 4];   // x, y, demi-largeur, demi-hauteur : petit coin de sable sans objet
function miniWorldUpdate(dt, ns) {
  MI.itemT -= dt; if (MI.itemT <= 0) { MI.itemT = 1.2; miniSpawn(ns); }
  if (ns < .1) MI.items = MI.items.filter(i => i.kind === 'shell');
  if (MI.items.length > 16) MI.items.length = 16;
  for (const it of MI.items) { it.t += dt; if (it.kind === 'sea') { if (it.id === 'n3' && cell(SEAF, it.x, it.y)) jellySwim(it, dt); else { it.a += (Math.random() - .5) * dt * 3; it.x += Math.cos(it.a) * 5 * dt; it.y += Math.sin(it.a) * 3 * dt; if (cell(SEA, it.x, it.y) !== 1) { it.a += Math.PI; } } } }
  if (!MI.animals.length && started) miniAnimalsInit();
  for (const a of MI.animals) {
    a.heart = Math.max(0, a.heart - dt); a.wait -= dt;
    if (a.id === 'chat' || a.id === 'singe' || a.id === 'tortue') { a.tx = a.x; a.ty = a.y; }   // le chat, le singe et la tortue restent à leur place
    if (a.id === 'crabe') {   // le crabe reste sur une zone de sable dégagée, et il n'est pas toujours là : il sort, se promène, puis se cache dans le sable
      const Z = CRAB_ZONE, inZ = (x, y) => Math.hypot((x - Z[0]) / Z[2], (y - Z[1]) / Z[3]) < 1 && walkable(x, y) && !propBlocked(x, y);
      if (a.cyc === undefined) { a.cyc = 6 + Math.random() * 10; a.hidden = true; }
      a.cyc -= dt; if (a.cyc <= 0) { a.hidden = !a.hidden; a.cyc = a.hidden ? 25 + Math.random() * 35 : 30 + Math.random() * 40;
        if (!a.hidden) { for (let k = 0; k < 12; k++) { const x = Z[0] + (Math.random() * 2 - 1) * Z[2], y = Z[1] + (Math.random() * 2 - 1) * Z[3]; if (inZ(x, y)) { a.x = x; a.y = y; a.tx = x; a.ty = y; break; } } }
        burst(a.x, a.y - 2, 6, ['#e8d6a0', '#f6ecc8'], false); }
      if (!inZ(a.tx, a.ty)) { a.tx = a.x; a.ty = a.y; }
      if (!inZ(a.x, a.y)) { a.x = Z[0]; a.y = Z[1]; a.tx = a.x; a.ty = a.y; }
      a.hx = Z[0]; a.hy = Z[1];
      if (a.flash) { a.flash.t -= dt; if (a.flash.t <= 0) a.flash = null; }
      if (a.catch) { a.tx = a.x; a.ty = a.y; a.catch.t += dt; if (a.hidden || dist(a.x, a.y, player.x, player.y) > 60) a.catch = null; else if (a.catch.t > a.catch.T) { a.catch = null; a.hidden = true; a.cyc = 12 + Math.random() * 8; burst(a.x, a.y - 4, 6, ['#e8d6a0', '#f6ecc8'], false); say('🦀 Le crabe s\'est échappé !', 2.4); } }
    }
    if (a.id === 'tortue') a.rot = -.2;   // la tortue est fixe, dans cette position
    if (a.id === 'singe') {   // le singe s'anime quand Myah passe devant lui
      a.react = Math.max(0, (a.react || 0) - dt); const near = player.state !== 'cine' && dist(player.x, player.y, a.x, a.y) < 46;
      if (near && !a.was && a.react <= 0) { a.react = 1.5; a.face = player.x > a.x ? 1 : -1; blip(a.snd[0], .1, 'triangle', .07); blip(a.snd[1], .14, 'triangle', .06, .12); burst(a.x, a.y - a.h, 5, ['#ffd27a', '#fff'], false); }
      a.was = near;
    }
    if (dist(a.x, a.y, a.tx, a.ty) > 1.5) { const d = dist(a.x, a.y, a.tx, a.ty), sp = (a.id === 'tortue' ? 6 : a.id === 'crabe' ? 14 : 12) * dt, nx = a.x + (a.tx - a.x) / d * sp, ny = a.y + (a.ty - a.y) / d * sp; if (walkable(nx, ny)) { a.x = nx; a.y = ny; if (Math.abs(a.tx - a.x) > .5) a.face = a.tx > a.x ? 1 : -1; } else { a.tx = a.x; a.ty = a.y; } }
    else if (a.wait <= 0) { a.wait = 3 + Math.random() * 6; if (Math.random() < .6) { const x = a.hx + (Math.random() - .5) * 60, y = a.hy + (Math.random() - .5) * 36; if (walkable(x, y)) { a.tx = x; a.ty = y; } } }
  }
}
function drawCrab(a) {   // le crabe a plusieurs poses : marche, pinces levées (capture), pince qui se referme (raté), content dans le panier (réussi)
  const mv = dist(a.x, a.y, a.tx, a.ty) > 1.5; let k = mv ? 0 : 2, u = a.catch ? a.catch.t / a.catch.T : 0;
  if (a.flash) k = a.flash.p; else if (a.catch) k = u > crZone()[1] - .04 ? 3 : 1;
  const im = MIM['crab' + k]; if (!mimOk('crab' + k)) return; const sc = .05 * (k === 4 ? .8 : 1), w = im.naturalWidth * sc, h = im.naturalHeight * sc, bob = a.flash ? 0 : mv ? Math.abs(Math.sin(time * 9)) * 1.2 : a.catch ? Math.sin(time * 22) * .5 : 0;
  ctx.save(); ctx.globalAlpha = a.flash ? .95 : .78; ctx.fillStyle = 'rgba(0,0,0,.2)'; ctx.beginPath(); ctx.ellipse(a.x, a.y, w * .4, 3, 0, 0, TAU); ctx.fill();
  ctx.translate(a.x, a.y - bob - (a.flash && a.flash.p === 4 ? Math.sin(Math.min(1, (1.1 - a.flash.t) * 2) * Math.PI) * 6 : 0)); if ((k === 0 || k === 3) && a.face < 0) ctx.scale(-1, 1); ctx.drawImage(im, -w / 2, -h, w, h); ctx.restore();
  if (a.catch) { const bw = 40, bx = a.x - bw / 2, by = a.y - h - 10; ctx.save(); ctx.fillStyle = 'rgba(40,30,20,.75)'; ctx.fillRect(bx - 1, by - 1, bw + 2, 6); ctx.fillStyle = '#7ddc6a'; ctx.fillRect(bx + bw * crZone()[0], by, bw * (crZone()[1] - crZone()[0]), 4); ctx.fillStyle = '#fff'; ctx.fillRect(bx + bw * u - 1.5, by - 2, 3.4, 8); ctx.restore(); }
}
function drawAnimal(a) {
    if (a.id === 'crabe' && (!a.hidden || a.flash)) { drawCrab(a); return; }
    if (a.hidden || !mimOk(a.img)) return; const im = MIM[a.img], h = a.h, w = h * im.naturalWidth / im.naturalHeight, mv = dist(a.x, a.y, a.tx, a.ty) > 1.5, bob = a.react > 0 ? Math.abs(Math.sin(time * 11)) * 4.5 : mv ? Math.abs(Math.sin(time * 9)) * 1.6 : (a.id === 'chat' || a.id === 'singe') ? 0 : Math.sin(time * 2 + a.x) * .5;
    ctx.save(); ctx.globalAlpha = a.id === 'crabe' ? .7 : NPC_A; ctx.fillStyle = 'rgba(0,0,0,.2)'; ctx.beginPath(); ctx.ellipse(a.x, a.y, w * .38, 3, 0, 0, TAU); ctx.fill(); ctx.translate(a.x, a.y + (a.id === 'singe' ? 2.5 : 0) - bob);  ctx.scale(a.face > 0 ? (a.id === 'chat' || a.id === 'singe' ? 1 : -1) : (a.id === 'chat' || a.id === 'singe' ? -1 : 1), 1); if (a.id === 'tortue') { ctx.translate(0, -h / 2); ctx.rotate(a.rot || 0); ctx.translate(0, h / 2); } ctx.drawImage(im, -w / 2, -h, w, h); ctx.restore();
    if (a.catch) { const bw = 40, bx = a.x - bw / 2, by = a.y - h - 12, u = a.catch.t / a.catch.T; ctx.save(); ctx.fillStyle = 'rgba(40,30,20,.75)'; ctx.fillRect(bx - 1, by - 1, bw + 2, 6); ctx.fillStyle = '#7ddc6a'; ctx.fillRect(bx + bw * crZone()[0], by, bw * (crZone()[1] - crZone()[0]), 4); ctx.fillStyle = '#fff'; ctx.fillRect(bx + bw * u - 1.5, by - 2, 3.4, 8); ctx.restore(); }
    if (a.heart > 0) { const u = 1 - a.heart / 1.6; ctx.save(); ctx.globalAlpha = 1 - u; ctx.font = '12px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('💕', a.x + Math.sin(u * 9) * 4, a.y - h - 4 - u * 18); ctx.restore(); }
}
function jellySwim(it, dt) {   // les méduses circulent comme les poissons (allers-retours à l'horizontale) mais s'écartent d'eux : jamais de collision
  if (!it.dir) it.dir = Math.random() < .5 ? 1 : -1; if (it.pause > 0) { it.pause -= dt; }
  else if (it.tx === undefined || dist(it.x, it.y, it.tx, it.ty) < 2) {
    let ok = false; for (let t = 0; t < 2 && !ok; t++) { for (let k = 0; k < 12; k++) { const d = rnd(30, 90) - k * 5, nx = it.x + it.dir * d, ny = it.y + rnd(-3, 3); if (d > 6 && cell(SEAF, nx, ny) && cell(SEAF, (nx + it.x) / 2, (ny + it.y) / 2)) { it.tx = nx; it.ty = ny; ok = true; break; } } if (!ok) it.dir = -it.dir; }
    if (!ok) { it.tx = it.x; it.ty = it.y; it.pause = 1; } else if (Math.random() < .25) it.dir = -it.dir;
  }
  if (!(it.pause > 0) && it.tx !== undefined) { const dx = it.tx - it.x, dy = it.ty - it.y, d = Math.hypot(dx, dy) || 1, st = Math.min(d, 6 * dt), nx = it.x + dx / d * st, ny = it.y + dy / d * st; if (cell(SEAF, nx, ny)) { it.x = nx; it.y = ny; } else it.tx = it.x; }
  for (const f of fishes) if (f.region === 'sea') { const dx = it.x - f.x, dy = it.y - f.y, d = Math.hypot(dx, dy); if (d < 22) { const k = (22 - d) / (d || 1), nx = it.x + dx * k, ny = it.y + dy * k; if (cell(SEAF, nx, ny)) { it.x = nx; it.y = ny; } else { it.dir = -it.dir; it.tx = it.x; const fx = f.x - dx * k, fy = f.y - dy * k; if (cell(SEAF, fx, fy)) { f.x = fx; f.y = fy; f.tx = f.x + (f.x - it.x) * 2; } } } }   // une méduse ne se laisse pas traverser
}
function drawMiniItem(it, ns) {
    const d = ITEM_DEF[it.id]; if (!d || !mimOk(d[0])) return; const im = MIM[d[0]], w = d[1], h = w * im.naturalHeight / im.naturalWidth;
    const fade = it.kind === 'shell' ? .68 : ns; /* coquillages : légère transparence */ if (fade < .05) return; const a = Math.min(1, it.t / .8) * fade * (it.id === 'n3' ? .62 : 1), bob = it.kind === 'sea' ? Math.sin(time * 1.6 + it.ph) * 2.5 : 0;
    ctx.save(); ctx.globalAlpha = a;
    if (it.kind !== 'shell') { ctx.globalCompositeOperation = 'lighter'; const gl = ctx.createRadialGradient(it.x, it.y - h / 2 + bob, 1, it.x, it.y - h / 2 + bob, w); gl.addColorStop(0, 'rgba(160,220,255,.5)'); gl.addColorStop(1, 'rgba(160,220,255,0)'); ctx.fillStyle = gl; ctx.fillRect(it.x - w, it.y - h / 2 - w + bob, w * 2, w * 2); ctx.globalCompositeOperation = 'source-over'; }
    if (it.id !== 'n3') { ctx.fillStyle = 'rgba(0,0,0,.18)'; ctx.beginPath(); ctx.ellipse(it.x, it.y, w * .38, w * .12, 0, 0, TAU); ctx.fill(); }
    ctx.drawImage(im, it.x - w / 2, it.y - h + 2 + bob, w, h);
    const tw = Math.max(0, Math.sin(time * 3 + it.ph)), sh = it.kind === 'shell', near = !sh || dist(it.x, it.y - h / 2, player.x, player.y - 10) * cam.z < 95; if (near && tw > (sh ? .3 : .55)) {   /* coquillages : ça scintille seulement quand Myah est à ~2,5 cm */ ctx.globalAlpha = sh ? Math.min(.75, (tw - .3) * 1.6) : a * (tw - .55) * 2;       A.star4 && A.star4(ctx, it.x + w * .3, it.y - h * .8, sh ? 1.7 : 2.6, sh ? 'rgba(255,238,160,' : 'rgba(255,255,255,'); }   // coquillages : même taille, mais étoile dorée avec un petit halo
    if (it.kind === 'shell' && dist(it.x, it.y - h / 2, player.x, player.y - 10) * cam.z < 40) { const hx = it.x, hy = it.y - h / 2, hg = ctx.createRadialGradient(hx, hy, 1, hx, hy, w * 1.1); hg.addColorStop(0, 'rgba(255,240,180,' + (.2 + .05 * Math.sin(time * 4)) + ')'); hg.addColorStop(1, 'rgba(255,230,150,0)'); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = hg; ctx.fillRect(hx - w * 1.1, hy - w * 1.1, w * 2.2, w * 2.2); }   // petit halo très léger quand Myah est à ~1 cm
    ctx.restore();
}
function miniWorldDraw(ns) {
  for (const it of MI.items) if (it.kind !== 'shell') drawMiniItem(it, ns);
}

['misc19','misc20','misc21','misc23','misc25','misc26','misc27'].forEach(n => { const i = new Image(); i.src = 'assets/spr/' + n + '.png'; MIM[n] = i; });
MI.props = []; MI.deliv = null; MI.mailT = 25; MI.mailUp = false;
const nm1 = s => String(s || '').split(',')[0].trim();
function miniPropsInit() {
  const W2 = (x, y) => nearestWalk(x, y, 80);
  const hd = id => { const h = HOUSES.find(o => o.id === id); return h ? h.door : [300, 250]; };
  const mb = W2(hd('home')[0] + 22, hd('home')[1] + 10), bl = W2(250, 398);
  const lamps = [['home', -20, 8], ['care', 22, 8], ['hall', -22, 8], ['museum', 20, 10], ['obs', -18, 6]].map(([id, dx, dy]) => W2(hd(id)[0] + dx, hd(id)[1] + dy));
  MI.props = [
    { id: 'mail', img: 'misc20', x: mb[0], y: mb[1], w: 15, ring: 0 }, { id: 'bell', img: 'misc19', x: bl[0], y: bl[1], w: 13, ring: 0 },
    ...lamps.map(p => ({ id: 'lamp', img: 'misc23', x: p[0], y: p[1], w: 9, lit: false })),
  ];
}
const DELIV_TO = () => [...QUESTS.filter(q => ['bleu', 'soleil', 'toto', 'rose'].includes(q.id)).map(q => ({ name: nm1(q.who), ref: q })), ...EXTRAS.map(e => ({ name: nm1(e.who), ref: e }))].filter(o => o.name !== 'Maïmaï');
function miniDeliver(target) {   // appelé quand Myah parle à quelqu'un : livre le colis / la lettre si c'est la bonne personne
  if (!MI.deliv) return false; const ref = target.q || target.e; if (!ref || ref !== MI.deliv.to.ref) return false;
  const d = MI.deliv; MI.deliv = null; mini.deliv = (mini.deliv || 0) + 1; MI.mailT = 60 + Math.random() * 40;
  const got = ['sh0', 'sh1', 'sh2', 'sh3', 'sh4', 'sh5', 'sh6', 'sh7', 'sh8'].filter(id => !coll[id]), gift = got.length ? got[Math.floor(Math.random() * got.length)] : null; if (gift) coll[gift] = true;
  const c = gift && COLL.find(o => o.id === gift); faceTo(ref.x); blip(660, .1, 'sine', .08); blip(990, .12, 'sine', .07, .09); blip(1320, .16, 'sine', .06, .2); burst(ref.x, ref.y - 40, 16, ['#ffd84d', '#ff8fc4', '#fff'], true);
  const T = nm1(d.to.name); player.state = 'talk'; setAnim('idle');
  openDialog(d.to.name, ['Oh, ' + (d.kind === 'lettre' ? 'une lettre' : 'un colis') + ' pour moi ! Merci beaucoup, Myah ! 💌', gift ? 'Tiens, un petit cadeau pour te remercier : ' + c.name + ' ✨ (ajouté à ta collection)' : 'Tu es la meilleure factrice de l\'île ! 💕'], () => { player.state = 'free'; }, ref.portrait); save(); return true;
}
function miniPropsUpdate(dt, ns) {
  if (!MI.props.length && started) miniPropsInit();
  for (const p of MI.props) { if (p.ring > 0) p.ring -= dt; if (p.id === 'lamp' && ns < .1) p.lit = false; }
  if (!MI.deliv && !MI.mailUp) { MI.mailT -= dt; if (MI.mailT <= 0) { MI.mailUp = true; } }
}
function miniPropsDraw(ns) {
  for (const p of MI.props) {
    let n = p.img; if (p.id === 'mail' && MI.mailUp) n = 'misc21'; if (p.id === 'lamp') n = p.lit ? 'misc25' : 'misc23'; if (!mimOk(n)) continue;
    const im = MIM[n], w = p.id === 'lamp' && p.lit ? p.w * 2.6 : p.w, h = w * im.naturalHeight / im.naturalWidth, rot = p.id === 'bell' && p.ring > 0 ? Math.sin(p.ring * 22) * .35 * Math.min(1, p.ring) : 0;
    ctx.save(); ctx.fillStyle = 'rgba(0,0,0,.2)'; ctx.beginPath(); ctx.ellipse(p.x, p.y, p.w * .4, 2.6, 0, 0, TAU); ctx.fill(); ctx.translate(p.x, p.y);
    if (p.id === 'lamp' && p.lit) { ctx.globalCompositeOperation = 'lighter'; const gl = ctx.createRadialGradient(0, -h * .45, 1, 0, -h * .45, 34); gl.addColorStop(0, 'rgba(255,220,130,' + (.4 + .08 * Math.sin(time * 5 + p.x)) + ')'); gl.addColorStop(1, 'rgba(255,200,100,0)'); ctx.fillStyle = gl; ctx.fillRect(-34, -h * .45 - 34, 68, 68); ctx.globalCompositeOperation = 'source-over'; }
    ctx.translate(0, p.id === 'bell' ? -h : 0); ctx.rotate(rot); ctx.drawImage(im, -w / 2, p.id === 'bell' ? 0 : -h, w, h); ctx.restore();
    if (p.id === 'mail' && (MI.mailUp || mini.giftWk !== Math.floor((mini.dayNo || 0) / 7))) { const gf = mini.giftWk !== Math.floor((mini.dayNo || 0) / 7), tx = gf ? '🎁!' : '✉️!'; ctx.save(); ctx.font = '800 13px sans-serif'; ctx.textAlign = 'center'; ctx.fillStyle = '#fff'; ctx.strokeStyle = '#e8503a'; ctx.lineWidth = 3; const y = p.y - 26 - Math.abs(Math.sin(time * 4)) * 4; ctx.strokeText(tx, p.x, y); ctx.fillText(tx, p.x, y); ctx.restore(); }
  }
  if (MI.deliv && mimOk(MI.deliv.kind === 'lettre' ? 'misc26' : 'misc27')) { const im = MIM[MI.deliv.kind === 'lettre' ? 'misc26' : 'misc27'], w = 14, h = w * im.naturalHeight / im.naturalWidth, p = player; ctx.save(); ctx.drawImage(im, p.x - w / 2, p.y - 62 - Math.sin(time * 3) * 1.5, w, h); ctx.restore(); }
}
function miniPropAction() {
  const p = player; let best = null, bd = 30; for (const o of MI.props) { const d = dist(o.x, o.y - 6, p.x, p.y - 10); if (d < bd) { bd = d; best = o; } } if (!best) return false; faceTo(best.x);
  if (best.id === 'bell') { best.ring = 1.4; [660, 990, 1320].forEach((f, i) => blip(f, .9, 'sine', .07 / (i + 1), i * .01)); say('🔔 Dong ! La cloche de l\'île résonne', 2.8); return true; }
  if (best.id === 'lamp') { if (nightAmt() < .3) { say('La lanterne s\'allumera quand la nuit viendra 🌙', 2.6); return true; } best.lit = !best.lit; blip(best.lit ? 700 : 400, .12, 'triangle', .07); burst(best.x, best.y - 8, 8, ['#ffe9a0', '#fff'], true); say(best.lit ? '🏮 Tu allumes la lanterne' : 'Tu éteins la lanterne', 2.2); return true; }
  if (best.id === 'mail') {
    const wk = Math.floor((mini.dayNo || 0) / 7);
    if (mini.giftWk !== wk) {   // 1 cadeau rare par semaine de jeu (7 jours)
      const L = DELIV_TO(), from = nm1(L[Math.floor(Math.random() * L.length)].name), left = ['g0', 'g1', 'g2'].filter(id => !coll[id]);
      mini.giftWk = wk; blip(660, .1, 'sine', .08); blip(990, .12, 'sine', .07, .09); blip(1320, .16, 'sine', .06, .2); burst(best.x, best.y - 20, 14, ['#ffd84d', '#ff8fc4', '#fff'], true);
      if (left.length) { const id = left[Math.floor(Math.random() * left.length)], c = COLL.find(o => o.id === id); coll[id] = true; say('🎁 ' + from + ' t\'a laissé un cadeau rare : ' + c.name + ' ! (voir la collection)', 5); }
      else say('💌 ' + from + ' t\'a laissé un petit mot gentil. Tu as déjà tous les cadeaux rares !', 4.5);
      save(); return true; }
    if (MI.deliv) { say('Tu as déjà ' + (MI.deliv.kind === 'lettre' ? 'une lettre' : 'un colis') + ' pour ' + nm1(MI.deliv.to.name) + ' !', 3); return true; }
    if (!MI.mailUp) { say('La boîte aux lettres est vide pour le moment 📭', 2.6); return true; }
    const L = DELIV_TO(), to = L[Math.floor(Math.random() * L.length)], kind = Math.random() < .5 ? 'lettre' : 'colis'; MI.deliv = { to, kind }; MI.mailUp = false; blip(520, .1, 'sine', .07); blip(780, .12, 'sine', .06, .08);
    say('📬 ' + (kind === 'lettre' ? 'Une lettre' : 'Un colis') + ' pour ' + to.name + ' ! Va le lui porter.', 4.5); return true; }
  return false;
}
function miniUpdate(dt) {
  { const INN = { home: 'La maison de Myah', care: 'Le Poste de Soin', hall: 'Le Comptoir de Maïmaï', museum: 'Le Musée Kaïkiti', boat: 'Le Bateau', obs: "L'Observatoire" };
    const pl = !started || player.state === 'dead' ? null : IN.on ? (HOUSE ? ['in_' + HOUSE.id, INN[HOUSE.id] || HOUSE.name || 'Dans une maison'] : null) : placeAt(player.x, player.y), id = pl ? pl[0] : null;   // bulle « lieu » quand on change d'endroit
    if (id !== PLC.id) { PLC.id = id; if (id && PLC.ready) { const el = $('#placeB'); el.textContent = '📍 ' + pl[1]; el.classList.add('show'); clearTimeout(PLC.tm); PLC.tm = setTimeout(() => el.classList.remove('show'), 4500); } PLC.ready = true; } }
  const p = player, ns = nightAmt(); miniWorldUpdate(dt, ns); miniPropsUpdate(dt, ns);
  // lucioles : elles flottent autour de Myah, sur la terre ferme, la nuit
  if (ns > .5 && !p.mount) {
    while (MI.flies.length < 8) { for (let k = 0; k < 8; k++) { const a = Math.random() * TAU, r = 40 + Math.random() * 240, x = p.x + Math.cos(a) * r, y = p.y + Math.sin(a) * r * .7; if (x > 0 && y > 0 && x < W && y < H && walkable(x, y)) { MI.flies.push({ x, y, ph: Math.random() * 9, a: Math.random() * TAU, z: 10 + Math.random() * 34, life: 0 }); break; } } if (Math.random() < .5) break; }
  }
  for (const f of MI.flies) { f.life += dt; f.a += (Math.random() - .5) * 3 * dt; f.x += Math.cos(f.a) * 9 * dt; f.y += Math.sin(f.a) * 6 * dt; if (!walkable(f.x, f.y)) f.a += Math.PI; }
  MI.flies = MI.flies.filter(f => dist(f.x, f.y, p.x, p.y) < 320 && (ns > .4 || f.fade === undefined || f.fade > 0) && !f.gone);
  if (ns <= .4) MI.flies.length = 0;
  // lever du jour : de petits papillons prennent la place des lucioles (décoratifs, on ne les attrape pas)
  { const t = dayAuto ? dayT : .1, dw = t >= .88 ? Math.min(1, (t - .88) / .05) : t < .1 ? Math.min(1, (.1 - t) / .05) : 0; MI.dawn = dw; MI.bfl = MI.bfl || [];
    if (dw > .5 && !p.mount) while (MI.bfl.length < 3) { let ok = false; for (let k = 0; k < 8; k++) { const a = Math.random() * TAU, r = 40 + Math.random() * 220, x = p.x + Math.cos(a) * r, y = p.y + Math.sin(a) * r * .7; if (x > 0 && y > 0 && x < W && y < H && walkable(x, y)) { MI.bfl.push({ x, y, z: 8 + Math.random() * 22, a: Math.random() * TAU, ph: Math.random() * 9, flap: Math.random() * 6, life: 0, sp: A.SPECIES[MI.bfl.length % 5] }); ok = true; break; } } if (!ok) break; }
    for (const b of MI.bfl) { b.life += dt; b.flap += dt * 16; b.a += (Math.random() - .5) * 4 * dt; b.x += Math.cos(b.a) * 14 * dt; b.y += Math.sin(b.a) * 9 * dt; b.z = 8 + 14 * (.5 + .5 * Math.sin(time * 1.3 + b.ph)); if (!walkable(b.x, b.y)) b.a += Math.PI; }
    MI.bfl = MI.bfl.filter(b => dist(b.x, b.y, p.x, p.y) < 320 && dw > .25); }
  if (STR.pre > 0) { STR.pre -= dt; if (STR.pre <= 0) { STR.pre = 0; openScope(0, true); } }
  // étoile filante : on peut la contempler avec Action
  MI.nextStar -= dt;
  if (ns > .6 && dayT < .9 && !MI.star && MI.nextStar <= 0 && player.state === 'free') { const vw = cv.width / dpr / cam.z; MI.star = { x: cam.x + vw * (.25 + Math.random() * .5), y: cam.y + 10, u: 0 }; MI.wishT = 3.2; MI.nextStar = 40 + Math.random() * 50; say('⭐ Une étoile filante ! Appuie sur Action pour contempler les étoiles', 3.2); }
  if (MI.star) { MI.star.u += dt / 1.1; if (MI.star.u >= 1) MI.star = null; }
  if (MI.wishT > 0) MI.wishT -= dt;
  // galet
  const pb = MI.pebble;
  if (pb) { pb.t += dt; const seg = pb.pts.length - 1, ts = [.55, .38, .3, .26, .22, .2, .18];
    let k = 0, tt = pb.t; while (k < seg && tt > ts[Math.min(k, ts.length - 1)]) { tt -= ts[Math.min(k, ts.length - 1)]; if (!pb.hit[k + 1]) { pb.hit[k + 1] = true; MI.ripples.push({ x: pb.pts[k + 1][0], y: pb.pts[k + 1][1], t: 0 }); blip(520 + k * 70, .06, 'sine', .06); } k++; }
    if (k >= seg) { if (!pb.done) { pb.done = true; const n = pb.n; if (n > mini.rico) mini.rico = n; say(n >= 2 ? '💧 ' + n + ' ricochets ! (record : ' + mini.rico + ')' : '💧 Plouf !', 3); save(); } if (pb.t > pb.T + .3) MI.pebble = null; } }
  for (const r of MI.ripples) r.t += dt; MI.ripples = MI.ripples.filter(r => r.t < 1.1);
}
function miniDraw() {
  const ns = nightAmt(); miniPropsDraw(ns); miniWorldDraw(ns);
  if (MI.bfl) for (const b of MI.bfl) { ctx.save(); ctx.globalAlpha = Math.min(1, b.life / 1.2) * (MI.dawn || 0) * .55; drawBfly({ sp: b.sp, x: b.x, y: b.y, z: b.z, flap: b.flap, tilt: Math.sin(b.flap * .5) * .15, size: 1 }); ctx.restore(); }
  for (const f of MI.flies) {
    const tw = .45 + .55 * Math.max(0, Math.sin(time * 2.6 + f.ph)), a = Math.min(1, f.life / 1.2) * ns * tw * .8, y = f.y - f.z + Math.sin(time * 1.7 + f.ph) * 3;
    if (a < .03) continue; ctx.save(); ctx.globalCompositeOperation = 'lighter'; const g = ctx.createRadialGradient(f.x, y, 0, f.x, y, 11); g.addColorStop(0, 'rgba(230,255,140,' + a + ')'); g.addColorStop(.35, 'rgba(190,255,90,' + a * .4 + ')'); g.addColorStop(1, 'rgba(190,255,90,0)'); ctx.fillStyle = g; ctx.fillRect(f.x - 11, y - 11, 22, 22); ctx.fillStyle = 'rgba(255,255,220,' + a + ')'; ctx.beginPath(); ctx.arc(f.x, y, 1.1, 0, TAU); ctx.fill(); ctx.restore();
  }
  for (const r of MI.ripples) { const u = r.t / 1.1; ctx.save(); ctx.globalAlpha = (1 - u) * .8; ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.ellipse(r.x, r.y, 3 + u * 16, 1.4 + u * 6, 0, 0, TAU); ctx.stroke(); ctx.restore(); }
  const pb = MI.pebble;
  if (pb && !pb.done) { const seg = pb.pts.length - 1, ts = [.55, .38, .3, .26, .22, .2, .18]; let k = 0, tt = pb.t; while (k < seg && tt > ts[Math.min(k, ts.length - 1)]) { tt -= ts[Math.min(k, ts.length - 1)]; k++; }
    if (k < seg) { const d = ts[Math.min(k, ts.length - 1)], u = tt / d, a = pb.pts[k], b = pb.pts[k + 1], h = (k === 0 ? 38 : 16 / (1 + k * .5)), x = a[0] + (b[0] - a[0]) * u, y = a[1] + (b[1] - a[1]) * u - Math.sin(u * Math.PI) * h - (k === 0 ? (1 - u) * 22 : 0);
      ctx.save(); ctx.fillStyle = 'rgba(0,0,0,.2)'; ctx.beginPath(); ctx.ellipse(x, a[1] + (b[1] - a[1]) * u, 3, 1.2, 0, 0, TAU); ctx.fill(); ctx.fillStyle = '#9aa0a6'; ctx.strokeStyle = '#555'; ctx.lineWidth = .8; ctx.beginPath(); ctx.ellipse(x, y, 3.2, 2, time * 20, 0, TAU); ctx.fill(); ctx.stroke(); ctx.restore(); } }
  if (MI.star) { const s = MI.star, x = s.x + s.u * 220, y = s.y + s.u * 110; ctx.save(); const gr = ctx.createLinearGradient(x, y, x - 90, y - 45); gr.addColorStop(0, 'rgba(255,255,255,' + (1 - s.u * .6) + ')'); gr.addColorStop(1, 'rgba(255,255,255,0)'); ctx.strokeStyle = gr; ctx.lineWidth = 3; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - 90, y - 45); ctx.stroke(); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(x, y, 3, 0, TAU); ctx.fill(); ctx.restore(); }
}
function catchFirefly(best) { best.gone = true; mini.fire++; coll.n0 = true; burst(best.x, best.y - best.z, 10, ['#e6ff8c', '#fff', '#b8ff5a'], true); blip(880, .1, 'sine', .07); blip(1180, .12, 'sine', .06, .08); say('✨ Une luciole ! (' + mini.fire + ' attrapées)', 2.6); save(); }
function miniAction() {   // renvoie true si l'action a été utilisée
  const p = player;
  if (MI.star && MI.wishT > 0) { MI.wishT = 0; startStars(true); return true; }
  { let nf = null, nd = 52; for (const f of MI.flies) { const d = dist(f.x, f.y - f.z, p.x, p.y - 20); if (d < nd && f.life > 1) { nd = d; nf = f; } }
    if (nf && tool !== 'net') { hint('Pour les lucioles ✨, prends le filet [filet] (touche 2)', 'net'); return true; } }
  { let bi = null, bd2 = 40; for (const it of MI.items) { const d = dist(it.x, it.y - 6, p.x, p.y - 12); if (d < bd2 && it.t > .6) { bd2 = d; bi = it; } }
    if (bi) { const c = COLL.find(o => o.id === bi.id), isNew = !coll[bi.id]; coll[bi.id] = true; MI.items = MI.items.filter(o => o !== bi); faceTo(bi.x); burst(bi.x, bi.y - 8, 12, ['#fff', '#ffe9a0', '#cfeaff'], true); blip(760, .1, 'sine', .08); blip(1140, .14, 'sine', .07, .08); say((isNew ? '✨ Nouveau ! ' : 'Déjà dans ta collection : ') + (c ? c.name : 'trouvaille'), 3.2); save(); return true; }
    { const cr = MI.animals.find(a => a.id === 'crabe' && !a.hidden && dist(a.x, a.y - a.h / 2, p.x, p.y - 12) < 36);   // attraper le crabe avec le panier : mini-action de timing
      if (cr && tool === 'basket') {
        if (!cr.catch) { cr.catch = { t: 0, T: IS_TOUCH ? 2.4 : 2 }; faceTo(cr.x); blip(520, .08, 'triangle', .06); say('🦀 Doucement… appuie quand le marqueur est dans le vert !', 2.4); return true; }
        const u = cr.catch.t / cr.catch.T; cr.catch = null;
        if (u > crZone()[0] && u < crZone()[1]) { cr.hidden = true; cr.flash = { p: 4, t: 1.1 }; cr.cyc = 60 + Math.random() * 30; const isNew = !coll.crabe; coll.crabe = true; mini.crabs = (mini.crabs || 0) + 1; burst(cr.x, cr.y - 6, 14, ['#ff8a5a', '#fff', '#ffe9a0'], true); blip(760, .1, 'sine', .08); blip(1140, .14, 'sine', .07, .08); blip(1520, .16, 'sine', .06, .18); say((isNew ? '✨ Nouveau ! ' : '') + 'Tu as attrapé le crabe ! Tu le remets à l\'eau 🦀', 3.4); save(); }
        else { player.surprise = time + 1.1; cr.hidden = true; cr.flash = { p: 3, t: .8 }; cr.cyc = 10 + Math.random() * 6; blip(240, .18, 'sawtooth', .07); blip(180, .2, 'sawtooth', .06, .1); burst(cr.x, cr.y - 6, 6, ['#ff8a5a', '#fff'], false); say('🦀 Aïe ! Il t\'a pincé le doigt ! Il se cache…', 3); }
        return true; } }
    let an = null, bd3 = 34; for (const a of MI.animals) { if (a.hidden) continue; const d = dist(a.x, a.y - a.h / 2, p.x, p.y - 12); if (d < bd3) { bd3 = d; an = a; } }
    if (an && an.heart <= 0) { an.heart = 1.6; an.wait = Math.max(an.wait, 2); faceTo(an.x); mini.pet = (mini.pet || 0) + 1; blip(an.snd[0], .12, 'triangle', .08); blip(an.snd[1], .16, 'triangle', .07, .1); burst(an.x, an.y - an.h, 6, ['#ff8fc4', '#ffd0e6', '#fff'], false); const T = ANIMAL_TXT[an.id]; say(T[Math.floor(Math.random() * T.length)], 2.6); save(); return true; } }
  if (miniPropAction()) return true;
  if (tool === 'none' && !butterflies.some(b => b.alive && dist(b.x, b.y, p.x, p.y) < 70) && !nearestItem(bananas, p.x, p.y, R_PICK) && !nearestItem(flowers, p.x, p.y, R_PICK) && !MI.pebble) {
    const w = waterNear(); if (w && dist(w.x, w.y, p.x, p.y) < 70) {
      faceTo(w.x); const dx = w.x - p.x, dy = w.y - p.y, L = Math.hypot(dx, dy) || 1, ux = dx / L, uy = dy / L, want = 1 + Math.floor(Math.random() * 6), pts = [[p.x, p.y - 6]];
      let cx = w.x, cy = w.y; if (!isWater(cx, cy)) return false; pts.push([cx, cy]);
      for (let i = 0; i < want; i++) { cx += ux * (18 + i * 2); cy += uy * (11 + i); if (!isWater(cx, cy)) break; pts.push([cx, cy]); }
      MI.pebble = { pts, t: 0, hit: {}, n: pts.length - 1, T: 2, done: false }; sfx.cast && sfx.cast(); return true; } }
  return false;
}

/* ================= PNJ, coffres, objets ================= */
const player = { x: D.start[0], y: D.start[1], face: 1, anim: 'idle', fr: 0, state: 'free', mount: null, alt: 0, altT: 0, hopT: 0 };

const NP = window.NPCS, npcImg = {};
Object.keys(NP).forEach(k => { const i = new Image(); i.src = NP[k].src; npcImg[k] = i; });
const NPC_K = .76;
function npcSprite(key) {
  const m = NP[key], sc = NPC_K * (m.sc || m.H / (m.feet - m.head)) * (m.H >= 50 ? .87 : 1);        // taille selon l'âge, pas selon l'image d'origine
  return { key, m, sc, h: m.H * NPC_K, portrait: null };
}
function npcPortrait(sp) {
  if (sp.portrait) return sp.portrait;
  const im = npcImg[sp.key]; if (!im.complete || !im.naturalWidth) return '';
  const m = sp.m, body = m.feet - m.head, side = body * .42, c = document.createElement('canvas'); c.width = c.height = 120;
  const g = c.getContext('2d'); g.fillStyle = '#fff3d6'; g.fillRect(0, 0, 120, 120);
  g.drawImage(im, m.cx - side / 2, m.head - body * .04, side, side, 0, 0, 120, 120);
  return (sp.portrait = c.toDataURL());
}
function matchSkin(c) {   // même teinte de peau que Myah (137,100,66) pour tous les habitants
  try {
    const g = c.getContext('2d'), d = g.getImageData(0, 0, c.width, c.height), a = d.data, T = [137, 100, 66], isSk = i => { const r = a[i], gg = a[i + 1], b = a[i + 2], mx = Math.max(r, gg, b), s = (mx - Math.min(r, gg, b)) / (mx + 1e-9); return a[i + 3] > 200 && r > gg && gg > b && s > .3 && s < .8 && mx > 80 && mx < 210 && gg - b > 10 && r - gg < 70; };
    for (let i = 3; i < a.length; i += 4) if (a[i] > 24 && a[i] < 255) a[i] = Math.min(255, a[i] * 1.55 + 14);   // moins de transparence (ailes, bords)
    g.putImageData(d, 0, 0);
    let n = 0, sr = 0, sg = 0, sb = 0; for (let i = 0; i < a.length; i += 4) if (isSk(i)) { n++; sr += a[i]; sg += a[i + 1]; sb += a[i + 2]; }
    if (n < 60) return; const k = [T[0] / (sr / n), T[1] / (sg / n), T[2] / (sb / n)].map(v => clamp(v, .88, 1.22));
    for (let i = 0; i < a.length; i += 4) if (isSk(i)) { a[i] = Math.min(255, a[i] * k[0]); a[i + 1] = Math.min(255, a[i + 1] * k[1]); a[i + 2] = Math.min(255, a[i + 2] * k[2]); }
    g.putImageData(d, 0, 0);
  } catch (e) { }
}
const NK = 3;   // pré-rendu 3x la taille sur la carte (net sur écran HD, léger à dessiner)
function npcBake(sp, nk = NK, slot = 'baked') {
  const im = npcImg[sp.key]; if (!im.complete || !im.naturalWidth) return null;
  const m = sp.m; let w = m.w, h = m.h, src = im;
  const tw = Math.min(m.w, Math.ceil(m.w * sp.sc * nk)), th = Math.min(m.h, Math.ceil(m.h * sp.sc * nk));
  while (w / 2 > tw) { w = Math.round(w / 2); h = Math.round(h / 2); const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d'); g.imageSmoothingQuality = 'high'; g.drawImage(src, 0, 0, w, h); src = c; }
  const c = document.createElement('canvas'); c.width = tw; c.height = th; const g = c.getContext('2d'); g.imageSmoothingQuality = 'high'; g.filter = 'contrast(1.06)'; g.drawImage(src, 0, 0, tw, th); g.filter = 'none'; matchSkin(c);
  return (sp[slot] = c);
}
function drawNpcSprite(sp, x, y, t, flip, hi) {
  const c = hi ? (sp.bakedHi || npcBake(sp, 9, 'bakedHi')) : (sp.baked || npcBake(sp)); if (!c) return;
  const m = sp.m, s = sp.sc, br = 1;   // pas d'effet grand/petit
  const fr = sp.key === 'frere';   // le petit frère : plus fin (il paraissait trop large à côté de Myah) et un peu transparent comme elle
  ctx.save(); ctx.translate(x, y - (sp.bob || 0)); ctx.scale(flip ? -1 : 1, 1); ctx.globalAlpha = 1;
  ctx.drawImage(c, -m.cx * s, -m.feet * s, m.w * s, m.h * s); ctx.restore();
}
QUESTS.forEach(q => {
  const st = D.stands[q.spot];
  q.x = st[0]; q.y = st[1];
  q.sprite = npcSprite(q.npc); q.h = q.sprite.h;
  Object.defineProperty(q, 'portrait', { get() { return npcPortrait(q.sprite); } });
});
// PNJ d'ambiance (pas de quête)
const EXTRAS = [
  { key: 'maima', who: 'Maïmaï, la cheffe de l\'île', spot: 'haut4', dx: 0, dy: 0, flip: false, lines: ['Bonjour ma petite Myah ! Je suis Maïmaï, la cheffe de l\'île. 🌺', 'Autrefois, le Cygne légendaire venait boire à l\'étang chaque soir. Va voir les habitants : ils t\'aideront à retrouver ses plumes.'] },
  { key: 'poggi', who: 'Poggi, l\'ouvrier agricole', spot: 'haut3', dx: -99, dy: -144, flip: true, lines: ['Hé, Myah ! Je suis Poggi, l\'ouvrier agricole : je répare les bateaux et les bâtiments de l\'île, et je ramasse des noix de coco 🥥 pour le festin.', 'Si tu cherches des noix de coco 🥥, des mangues 🥭 ou des bananes 🍌, regarde dans le jardin à l\'est : les arbres refont des fruits au bout de 30 secondes !'] },
  { key: 'gardien', who: 'Yurii, l\'ornithologue', spot: 'obs', dx: 0, dy: 0, flip: false, lines: ['Bonjour Myah ! Je suis Yurii, l\'ornithologue : je suis les oiseaux de l\'île depuis l\'observatoire. 🦜', 'Les colibris, les perroquets, et même les cygnes... Prends la longue-vue, tu les verras passer ! 🔭'] },
  { key: 'kykah', who: 'Kykah, la marchande', spot: 'bas', dx: 0, dy: 0, flip: false, lines: ['Bienvenue ! Perles, coquillages et colliers : tout vient de nos plages. 🐚', 'Pour la pêche, pense à ta canne [canne] : les poissons de la mer sont plus gros que ceux de l\'étang !'] },
].map(e => { const st = D.stands[e.spot]; e.sprite = npcSprite(e.key); e.x = st[0] + e.dx; e.y = st[1] + e.dy; Object.defineProperty(e, 'portrait', { get() { return npcPortrait(e.sprite); } }); return e; });
const YUR = { key: 'gardien', who: 'Yurii, l\'ornithologue', lines: ['Bonjour Myah ! Je suis Yurii, l\'ornithologue : je suis les oiseaux de l\'île depuis l\'observatoire. 🦜', 'Les colibris, les perroquets, et même les cygnes... Prends la longue-vue, tu les verras passer ! 🔭'] };
YUR.sprite = npcSprite('gardien'); Object.defineProperty(YUR, 'portrait', { get() { return npcPortrait(YUR.sprite); } });
YUR.met = false;
// coffres : près de chaque PNJ, sur un point marchable
(function placeChests() {
  const offs = [[36, 4], [-36, 4], [0, 30], [38, -10], [-38, -10], [0, -24], [52, 16], [-52, 16]];
  QUESTS.forEach(q => {
    q.chestOpen = 0; q.reveal = 0; q.found = false; q.rustle = 0;
    for (const [dx, dy] of offs) {
      const x = q.x + dx, y = q.y + dy;
      if (!walkable(x, y)) continue;
      if (QUESTS.some(o => o !== q && o.cx !== undefined && dist(o.cx, o.cy, x, y) < 40)) continue;
      if (QUESTS.some(o => dist(o.x, o.y, x, y) < 26)) continue;
      q.cx = x; q.cy = y; break;
    }
    if (q.cx === undefined) { const p = nearestWalk(q.x + 30, q.y + 12, 60) || [q.x, q.y]; q.cx = p[0]; q.cy = p[1]; }
  });
})();
if (window.BUSHES) QUESTS.forEach(q => { const b = window.BUSHES[q.id]; if (b) { q.cx = b[0]; q.cy = b[1]; } });
QUESTS.forEach(q => {   // buisson plus petit quand le passage est étroit
  let free = 40;
  for (let a = 0; a < 16; a++) { const dx = Math.cos(a * TAU / 16), dy = Math.sin(a * TAU / 16); for (let r = 3; r < free; r += 2) if (!walkable(q.cx + dx * r, q.cy + dy * r)) { free = r; break; } }
  q.bsc = clamp(.34 + free / 40, .5, .65);
});
const MAN = QUESTS.find(q => q.id === 'rose'); MAN.x = MAN.y = -999;   // Miraaï reste dans la cuisine de la maison
const JUL = QUESTS.find(q => q.id === 'plume'); JUL.x = JUL.y = -999; JUL.where = 'au pied de l\'observatoire';   // Yulia dirige le musée (à l\'intérieur)
const LUL = QUESTS.find(q => q.id === 'soleil'); LUL.x = LUL.y = -999;   // Lulia travaille à l'intérieur du poste de soin
const animBlocked = (x, y) => (typeof MI !== 'undefined' && MI.animals || []).some(a => !a.hidden && dist(a.x, a.y, x, y) < 8 && dist(a.x, a.y, x, y) < dist(a.x, a.y, player.x, player.y) + .01);
const NPC_A = .94;   // même transparence pour tous les PNJ et animaux, partout
const PROP_BLOCK = [[338, 414, 6, 4]];   // glacière sur la plage : Myah ne passe pas au travers (la serviette, elle, se traverse)
const propBlocked = (x, y) => PROP_BLOCK.concat((typeof MI !== 'undefined' && MI.items || []).filter(i => i.kind === 'shell').map(i => [i.x, i.y, 4.5, 3.2])).some(([cx, cy, rx, ry]) => { const n = Math.hypot((x - cx) / rx, (y - cy) / ry); return n < 1 && n < Math.hypot((player.x - cx) / rx, (player.y - cy) / ry) + .001; });
const npcBlocked = (x, y) => propBlocked(x, y) || animBlocked(x, y) || QUESTS.some(q => dist(q.x, q.y, x, y) < 11) || EXTRAS.some(e => dist(e.x, e.y, x, y) < 9);

function makeSpr(w, h, ox, oy, draw, k = 3) {
  const c = document.createElement('canvas'); c.width = w * k; c.height = h * k;
  const g = c.getContext('2d'); g.scale(k, k); g.translate(ox, oy); draw(g); return { c, w, h, ox, oy };
}
function halo(g, y, r) { const gr = g.createRadialGradient(0, y, 1, 0, y, r); gr.addColorStop(0, 'rgba(255,252,190,.6)'); gr.addColorStop(1, 'rgba(255,252,190,0)'); g.fillStyle = gr; g.fillRect(-r, y - r, r * 2, r * 2); }
const FCOLS = ['pink', 'yellow', 'purple', 'red'];
const sprBanana = makeSpr(60, 54, 30, 40, g => { halo(g, -8, 24); A.drawBananaBunch(g, 0, 0); });
const drawSpr = (s, x, y, k = 1) => ctx.drawImage(s.c, x - s.ox * k, y - s.oy * k, s.w * k, s.h * k);

function sprDraw(name, x, y, k = 1, flip = false, alpha = 1) {
  const sp = SPR[name], im = img['s_' + name]; if (!im.complete) return;
  ctx.save(); if (alpha !== 1) ctx.globalAlpha = alpha; ctx.translate(x, y); if (flip) ctx.scale(-1, 1);
  ctx.drawImage(im, -sp.ax * k, -sp.ay * k, sp.w * k, sp.h * k); ctx.restore();
}
function drawFishSpr(f, time) {
  const c = f.col | 0, nm = c < 4 ? 'fish' + (((time * 6 + f.ph) | 0) % 2 ? 'B' : 'A') + c : 'fish' + c;
  const sp = SPR[nm], im = img['s_' + nm]; if (!sp || !im.complete) return;
  const ang = f.ang || 0, dir = Math.cos(ang) >= 0 ? 1 : -1, k = f.size || 1;
  ctx.save(); ctx.translate(f.x, f.y); ctx.scale(dir, 1); ctx.rotate(dir > 0 ? ang : Math.PI - ang);
  ctx.globalAlpha = f.alpha === undefined ? .95 : f.alpha;
  ctx.drawImage(im, -sp.ax * k, -sp.ay * k, sp.w * k, sp.h * k); ctx.restore();
}
function drawBouquet(x, y, w, rot = 0, alpha = 1) {
  const im = img.s_bouquet; if (!im || !im.complete) return; const h = w * im.naturalHeight / im.naturalWidth;
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.globalAlpha *= alpha; ctx.drawImage(im, -w / 2, -h * .7, w, h); ctx.restore();
}
function drawLegendSpr(g, o) {
  const s = o.s || .6, t = o.t || 0, dir = o.dir >= 0 ? 1 : -1, flying = o.mode === 'fly', alt = o.alt || 0, K = 1.25;
  const ph = o.phase === undefined ? t * 6 : o.phase;
  const fi = flying ? ((Math.floor(ph / TAU * 5) % 5) + 5) % 5 : Math.floor(t * 2.2) % 5;
  const nm = (flying ? 'swfly' : 'swflo') + fi, sp = SPR[nm], im = img['s_' + nm]; if (!sp || !im.complete) return;
  g.save(); g.translate(o.x, o.y);
  if (flying || alt > 2) { g.fillStyle = 'rgba(0,0,0,' + (.26 * Math.max(.25, 1 - alt / 220)) + ')'; g.beginPath(); g.ellipse(0, 4, 52 * s * (1 - Math.min(.5, alt / 400)), 11 * s, 0, 0, TAU); g.fill(); }
  const pulse = .5 + .5 * Math.sin(t * 2.4), ha = .14 + .12 * pulse + (o.sparkle || 0) * .3;
  const hg = g.createRadialGradient(0, -alt - 70 * s, 4, 0, -alt - 70 * s, 150 * s); hg.addColorStop(0, 'rgba(225,200,255,' + ha + ')'); hg.addColorStop(.5, 'rgba(170,120,255,' + ha * .4 + ')'); hg.addColorStop(1, 'rgba(170,120,255,0)');
  g.fillStyle = hg; g.fillRect(-190 * s, -alt - 260 * s, 380 * s, 360 * s);
  const bob = flying ? Math.sin(ph) * 3 : Math.sin(t * 1.6) * 1.2, w = sp.w * K, h = sp.h * K;
  g.save(); g.translate(0, -alt + bob * s); g.scale(-dir * s, s);   // les sprites regardent à gauche
  g.drawImage(im, -w / 2, flying ? -h * .55 : -h * .86, w, h); g.restore();
  if (o.rider) { g.save(); g.translate(0, -alt + bob * s); g.scale(dir * s, s); g.translate(flying ? -4 : -8, flying ? 4 : -(h * .2)); o.rider(g); g.restore(); }
  const nf = o.feathers || 0, bq = img.s_bouquet;
  if (bq && bq.complete) for (let j = 0; j < nf; j++) { const a = t * .9 + j * TAU / 5, bw = 30 * s + 6; g.save(); g.translate(Math.cos(a) * 92 * s, -alt - 70 * s + Math.sin(a) * 28 * s); g.drawImage(bq, -bw / 2, -bw * .55, bw, bw * bq.naturalHeight / bq.naturalWidth); g.restore(); }
  const spk = o.sparkle || 0, n = Math.round(9 + 30 * spk);
  for (let i = 0; i < n; i++) {
    const a = i * 2.399 + t * .35, rr = (40 + (i * 37 % 120)) * s * (1 + .12 * Math.sin(t + i)), x = Math.cos(a) * rr * 1.25, y = -alt - 66 * s + Math.sin(a) * rr * .8;
    const tw = Math.max(0, Math.sin(t * 3.2 + i * 1.7)); if (tw < .15) continue;
    A.star4(g, x, y, (1.4 + 3 * tw) * (s + .4), ['rgba(255,255,255,', 'rgba(210,170,255,', 'rgba(255,240,180,', 'rgba(200,215,255,'][i % 4] + (.35 + .65 * tw) + ')');
  }
  g.restore();
}
function bushShadow(x, y, k) { const g = ctx.createRadialGradient(x, y - 1, 2, x, y - 1, 17 * k); g.addColorStop(0, 'rgba(20,50,20,.35)'); g.addColorStop(1, 'rgba(20,50,20,0)'); ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(x, y - 1, 17 * k, 6 * k, 0, 0, TAU); ctx.fill(); }
function drawBfly(b) {
  const idx = Math.max(0, A.SPECIES.indexOf(b.sp)) % 5, sp = SPR['bfly' + idx], im = img['s_bfly' + idx]; if (!im.complete) return;
  const sx = .3 + .7 * Math.abs(Math.cos(b.flap)), sz = (b.size || 1.2) * .45;
  ctx.save(); ctx.translate(b.x, b.y - b.z); ctx.rotate(b.tilt || 0); ctx.scale(sx * sz, sz); ctx.drawImage(im, -sp.w / 2, -sp.h / 2, sp.w, sp.h); ctx.restore();
}
function drawPondSwan(s) {
  const near = dist(s.x, s.y, player.x, player.y) < 85 && !player.mount;
  if (!near && time > (s.poseT || 0)) { s.poseT = time + rnd(1.6, 3.6); s.pose = Math.random() < .65 ? 0 : (Math.random() < .5 ? 1 : 2); }
  const pose = near ? 3 : (s.pose || 0), bob = Math.sin(time * 1.6 + s.ph) * .8, k = (s.size || .8) * 1.12;
  ctx.save(); ctx.globalAlpha = .7; sprDraw('swan' + pose, s.x, s.y + bob, k, s.dir > 0); ctx.restore();   // légère transparence, comme les poissons
  if (near && dist(s.x, s.y, player.x, player.y) < 42) {   // petit cœur qui monte, seulement quand Myah est tout près
    const t = (time * .9 + s.ph) % 1, hx = s.x + (s.dir > 0 ? 1 : -1) * 13 * k, hy = s.y - 30 * k - t * 10;
    ctx.save(); ctx.globalAlpha = 1 - t * t; ctx.fillStyle = '#ff6fa5'; ctx.translate(hx, hy); ctx.scale(1.1, 1.1);
    ctx.beginPath(); ctx.moveTo(0, 2.2); ctx.bezierCurveTo(-4.2, -.8, -2, -4, 0, -1.8); ctx.bezierCurveTo(2, -4, 4.2, -.8, 0, 2.2); ctx.fill(); ctx.restore();
  }
}
// bananiers : 5 régimes par arbre ; arbre vidé = 30 s avant de repousser
const TREE_MAX = 5; let TREE_WAIT = 30;
/* ----- bananiers et fleurs : semés au hasard sur l'herbe (et seulement là), à chaque partie ----- */
const GRASS = window.GRASS ? unpack(window.GRASS) : null;
const scatter = (() => {
  const cells = []; if (GRASS) for (let y = 0; y < GH; y++) for (let x = 0; x < GW; x++) if (GRASS[y * GW + x] && WALK[y * GW + x]) cells.push([x * C + C / 2, y * C + C / 2]);
  for (let i = cells.length - 1; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0; [cells[i], cells[j]] = [cells[j], cells[i]]; }
  const avoid = Object.values(D.stands).concat([D.perch, D.start]).concat(QUESTS.map(q => [q.cx, q.cy]));
  const taken = [];
  const f = (n, gap, margin) => {
    const out = [];
    for (const c of cells) {
      if (out.length >= n) break;
      if (avoid.some(a => dist(a[0], a[1], c[0], c[1]) < margin) || taken.some(t => dist(t[0], t[1], c[0], c[1]) < gap)) continue;
      out.push(c); taken.push(c);
    }
    return out;
  };
  f.cells = cells; f.avoid = avoid; f.taken = taken;
  return f;
})();
const spreadTrees = (n, margin) => {   // bananiers : en terrain dégagé (ne bouchent pas un passage), le plus éparpillés possible sur l'île
  const open = (x, y) => { for (let a = 0; a < 8; a++) for (const r of [8]) if (!cell(WALK, x + Math.cos(a * .785) * r, y + Math.sin(a * .785) * r)) return false; return true; };
  const inGreen = (x, y) => { let n = 0; for (let a = 0; a < 8; a++) if (cell(GRASS, x + Math.cos(a * .785) * 7, y + Math.sin(a * .785) * 7)) n++; return n >= 6; };   // vrai espace vert, pas le bord de la plage
  const cs = scatter.cells.filter(c => inGreen(c[0], c[1]) && open(c[0], c[1]) && (!WIDE || cell(WIDE, c[0], c[1])) && c[0] > 330 && !scatter.avoid.some(v => dist(v[0], v[1], c[0], c[1]) < margin) && !QUESTS.some(q => dist(q.x, q.y, c[0], c[1]) < 52 || dist(q.cx, q.cy, c[0], c[1]) < 46) && !EXTRAS.some(e => dist(e.x, e.y, c[0], c[1]) < 36));
  const out = [];
  for (let k = 0; k < n && cs.length; k++) {
    let best = null, bd = -1;
    for (const c of cs) { let d = 1e9; for (const o of out.concat(scatter.taken)) d = Math.min(d, dist(o[0], o[1], c[0], c[1])); if (!out.length && !scatter.taken.length) d = Math.random() * 100; if (d > bd + Math.random() * 6) { bd = d; best = c; } }
    out.push(best); scatter.taken.push(best); cs.splice(cs.indexOf(best), 1);
  }
  return out;
};
const TREE_KINDS = ['banana', 'coconut', 'banana', 'coconut'];
const bananas = spreadTrees(4, 36).map((p, i) => ({ x: p[0], y: p[1], alive: true, fruits: TREE_MAX, t: 0, tree: true, kind: TREE_KINDS[i % TREE_KINDS.length] }));   // arbres fruitiers : bananiers, cocotiers, manguiers
function drawTree(tr) {
  ctx.save(); ctx.globalAlpha = .84; drawTree0(tr); ctx.restore();
}
function drawTree0(tr) {
  const stage = tr.fruits > 0 ? 'full' : (tr.t < 9 ? 'sapling' : tr.t < 18 ? 'bare' : 'bud'), alt = TALT[tr.kind], s = (alt || TR).s[stage], k = alt ? alt.k : .27;
  const im = alt ? img['t_' + tr.kind] : img.t_trees; if (!im.complete) return;
  // ombre douce au sol
  const g = ctx.createRadialGradient(tr.x, tr.y, 1, tr.x, tr.y, 22); g.addColorStop(0, 'rgba(15,45,15,.32)'); g.addColorStop(1, 'rgba(15,45,15,0)'); ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(tr.x, tr.y, 22, 7, 0, 0, TAU); ctx.fill();
  const sway = Math.sin(time * 1.3 + tr.x) * .6;
  ctx.save(); ctx.translate(tr.x, tr.y + 1); ctx.transform(1, 0, sway * .012, 1, 0, 0);
  ctx.drawImage(im, s[0], s[1], s[2], s[3], -s[2] * k / 2, -s[3] * k, s[2] * k, s[3] * k); ctx.restore();
  if (dist(tr.x, tr.y, player.x, player.y) < 70) {   // régimes restants
    const px = tr.x - (TREE_MAX - 1) * 3.4, py = tr.y - (alt || TR).s.full[3] * k - 5;
    for (let i = 0; i < TREE_MAX; i++) { ctx.fillStyle = i < tr.fruits ? (tr.kind === 'coconut' ? '#a8652e' : tr.kind === 'mango' ? '#ff9a2e' : '#ffd23d') : 'rgba(40,40,40,.35)'; ctx.strokeStyle = '#7a4b24'; ctx.lineWidth = .8; ctx.beginPath(); ctx.arc(px + i * 6.8, py, 2.6, 0, TAU); ctx.fill(); ctx.stroke(); }
    if (tr.fruits <= 0) { const u = clamp(tr.t / TREE_WAIT, 0, 1); ctx.strokeStyle = '#7a4b24'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(tr.x, py - 9, 5, -Math.PI / 2, TAU - Math.PI / 2); ctx.stroke(); ctx.strokeStyle = '#7fd14a'; ctx.lineWidth = 1.8; ctx.beginPath(); ctx.arc(tr.x, py - 9, 5, -Math.PI / 2, -Math.PI / 2 + u * TAU); ctx.stroke(); }
  }
}
const flowerOK = (x, y) => { for (let a = 0; a < 8; a++) if (!cell(GRASS, x + Math.cos(a * .785) * 4, y + Math.sin(a * .785) * 4)) return false; return cell(GRASS, x, y) && cell(WALK, x, y); };   // fleurs : uniquement en plein vert, rien qui déborde sur chemin / sable / pierre
const flowers = (() => { const out = []; for (const c of scatter.cells) { if (out.length >= 12) break; if (!flowerOK(c[0], c[1]) || scatter.avoid.some(a => dist(a[0], a[1], c[0], c[1]) < 14) || out.some(t => dist(t[0], t[1], c[0], c[1]) < 16)) continue; out.push(c); } return out; })().map(p => ({ x: p[0], y: p[1], col: (Math.random() * 10) | 0, alive: true, t: 0 }));
flowers.splice(12);
bananas.push({ x: 450, y: 172, alive: true, fruits: TREE_MAX, t: 0, tree: true, kind: 'coconut', fixed: true });   // cocotier côté maison rose, avec Poggi tout près
bananas.push({ x: 508, y: 173, alive: true, fruits: TREE_MAX, t: 0, tree: true, kind: 'coconut', fixed: true });   // second cocotier, sur la berge nord-est du bassin
bananas.push({ x: 588, y: 188, alive: true, fruits: TREE_MAX, t: 0, tree: true, kind: 'mango', fixed: true });   // manguier : sur l'arbre au pied de l'échelle du musée
bananas.push({ x: 646, y: 172, alive: true, fruits: TREE_MAX, t: 0, tree: true, kind: 'mango', fixed: true });   // manguier : à gauche de l'escalier de l'observatoire
// pas d'objet sous un PNJ ou un coffre
[bananas, flowers].forEach(list => { for (let i = list.length - 1; i >= 0; i--) { const o = list[i]; if (QUESTS.some(q => dist(q.x, q.y, o.x, o.y) < 50 || dist(q.cx, q.cy, o.x, o.y) < 44) || (!o.fixed && EXTRAS.some(e => dist(e.x, e.y, o.x, o.y) < 34))) list.splice(i, 1); } });
{   // Poggi ramasse les fruits : il se tient près d'un cocotier du jardin (jamais près de la maison rose)
  const P = EXTRAS.find(e => e.key === 'poggi'), T = bananas.find(b => !b.fixed && b.kind === 'coconut') || bananas.find(b => !b.fixed);
  if (P && T) { const q = nearestWalk(T.x + 24, T.y + 6, 40); P.x = q[0]; P.y = q[1]; P.flip = P.x > T.x; }
}

/* ----- icônes de plumes (HUD) ----- */
const FICON_OLD = FCOLOR.map(c => { const k = document.createElement('canvas'); k.width = 40; k.height = 56; const g = k.getContext('2d'); A.drawFeather(g, 8, 50, 50, -1.15, c[0], c[1], null); return k.toDataURL(); });
const FICON = FCOLOR.map(() => 'assets/spr/bouquet.png');
const LP_OLD = A.legendPortrait().toDataURL(); let _lp = null;
const LP = () => { if (_lp) return _lp; const im = img.s_swflo0; if (!im || !im.complete || !im.naturalWidth) return LP_OLD; const c = document.createElement('canvas'); c.width = c.height = 120; const g = c.getContext('2d'); const bg = g.createRadialGradient(60, 60, 5, 60, 60, 90); bg.addColorStop(0, '#f3e6ff'); bg.addColorStop(1, '#8d62d8'); g.fillStyle = bg; g.fillRect(0, 0, 120, 120); const w = 112, h = w * im.naturalHeight / im.naturalWidth; g.drawImage(im, 4, 62 - h / 2 + 6, w, h); return (_lp = c.toDataURL()); };

/* ================= poissons, cygnes, papillons ================= */
const fishes = [];
function mkFish(region, x, y) {
  const cols = region === 'pond' ? [1, 2, 4] : [1, 2, 4, 5, 6];
  return { region, x, y, ang: rnd(0, TAU), col: cols[(Math.random() * cols.length) | 0], size: rnd(.38, .5), ph: rnd(0, 6), sp: rnd(5.5, 9.5), tx: x, ty: y, state: 'swim', cool: 0, pause: 0, t: 0, alpha: .62 };
}
const fishMask = f => f.region === 'pond' ? POND_IN : SEAF;
const fishSpots = { pond: D.pondFish, sea: D.seaFishStart };
function spread(list, n) {   // points bien répartis (le plus éloigné des déjà choisis)
  const out = [list[0]];
  while (out.length < Math.min(n, list.length)) { let best = null, bd = -1; for (const c of list) { if (out.includes(c)) continue; const d = Math.min(...out.map(o => dist(o[0], o[1], c[0], c[1]))); if (d > bd) { bd = d; best = c; } } out.push(best); }
  return out;
}
spread(D.pondFish, 3).forEach((p, i) => { const q = snapMask(POND_IN, p[0], p[1]); const f = mkFish('pond', q[0], q[1]); f.col = [1, 2, 4][i % 3]; fishes.push(f); });
spread(D.seaFishStart.filter(p => p[1] > 95), 14).forEach(p => { const q = snapMask(SEAF, p[0], p[1]); fishes.push(mkFish('sea', q[0], q[1])); });

// ponton : les poissons du lac passent dessous (on repeint la carte sur les cases du ponton)
const PIER = []; for (let y = 1; y < GH - 1; y++) for (let x = 1; x < GW - 1; x++) { if (POND[y * GW + x] !== 1) continue; let w = false; for (let dy = -1; dy <= 1 && !w; dy++) for (let dx = -1; dx <= 1; dx++) if (WALK[(y + dy) * GW + x + dx]) { w = true; break; } if (w) PIER.push([x * C, y * C]); }
const PW = 110, PS = 3, ptmp = document.createElement('canvas'), ptx = ptmp.getContext('2d'); ptmp.width = ptmp.height = PW * PS;
function drawFishUnderPier(f) {   // les poissons passent sous le ponton : on efface les cases du ponton sur le poisson
  if (f.region !== 'pond' || f.state !== 'swim') return drawFishSpr(f, time);
  const x0 = f.x - PW / 2, y0 = f.y - PW / 2, cells = PIER.filter(q => q[0] + C > x0 && q[0] < x0 + PW && q[1] + C > y0 && q[1] < y0 + PW);
  if (!cells.length) return drawFishSpr(f, time);
  const sv = ctx; ctx = ptx; ptx.setTransform(1, 0, 0, 1, 0, 0); ptx.clearRect(0, 0, ptmp.width, ptmp.height); ptx.setTransform(PS, 0, 0, PS, -x0 * PS, -y0 * PS); ptx.imageSmoothingEnabled = true;
  drawFishSpr(f, time); ptx.setTransform(1, 0, 0, 1, 0, 0); for (const q of cells) ptx.clearRect((q[0] - x0) * PS, (q[1] - y0) * PS, C * PS, C * PS);
  ctx = sv; ctx.drawImage(ptmp, x0, y0, PW, PW);
}
function redrawPier() {
  const k = img.map.naturalWidth / W; if (!k) return;
  const near = fishes.filter(f => f.region === 'pond' && f.state === 'swim'); if (!near.length) return;
  for (const [px, py] of PIER) {
    let hit = false; for (const f of near) if (Math.abs(f.x - px - C / 2) < 20 && Math.abs(f.y - py - C / 2) < 16) { hit = true; break; }
    if (hit) ctx.drawImage(img.map, px * k, py * k, C * k, C * k, px, py, C, C);
  }
}
function pickTarget(f) {   // les poissons font des allers-retours à l'horizontale (jamais de ronds)
  const m = fishMask(f), sea = f.region === 'sea';
  if (!f.dir) f.dir = Math.cos(f.ang) >= 0 ? 1 : -1;
  if (Math.random() < .22) f.dir = -f.dir;
  for (let t = 0; t < 2; t++) {
    for (let k = 0; k < 12; k++) {
      const d = (sea ? rnd(30, 90) : rnd(22, 64)) - k * (sea ? 5 : 3.5), nx = f.x + f.dir * d, ny = f.y + rnd(-3, 3);
      if (d > 6 && cell(m, nx, ny) && cell(m, (nx + f.x) / 2, (ny + f.y) / 2)) { f.tx = nx; f.ty = ny; return; }
    }
    f.dir = -f.dir;
  }
  const ny = f.y + (Math.random() < .5 ? -7 : 7);   // coincé : petit décalage vertical, puis on repart
  f.tx = f.x; f.ty = cell(m, f.x, ny) ? ny : f.y;
}
function respawnFish(f) {
  const list = fishSpots[f.region], m = fishMask(f);
  for (let k = 0; k < 20; k++) {
    const p = list[(Math.random() * list.length) | 0], q = snapMask(m, p[0], p[1]);
    if (dist(q[0], q[1], player.x, player.y) > 90) { f.x = q[0]; f.y = q[1]; break; }
  }
  f.state = 'swim'; f.cool = 0; f.tx = f.x; f.ty = f.y;
}

const swans = spread(D.swanStart, 2).map((p, i) => { const q = snapMask(POND_SW, p[0], p[1]); return { x: q[0], y: q[1], tx: q[0], ty: q[1], dir: i % 2 ? 1 : -1, ph: i * 2.1, size: .4, sp: rnd(2, 3) }; });
const SW_SEP = 22;
function updateSwan(s, dt) {
  if (dist(s.x, s.y, s.tx, s.ty) < 4) {
    if (s.rest === undefined) s.rest = rnd(4, 20);   // les cygnes flottent sur place longtemps, puis glissent doucement
    if ((s.rest -= dt) > 0) return;
    s.rest = rnd(14, 32);
    for (let k = 0; k < 40; k++) {
      const a = Math.random() * TAU, d = rnd(14, 70), nx = s.x + Math.cos(a) * d, ny = s.y + Math.sin(a) * d;
      if (!cell(POND_SW, nx, ny) || !cell(POND_SW, (nx + s.x) / 2, (ny + s.y) / 2)) continue;
      if (perchVisible() && dist(nx, ny, D.perch[0], D.perch[1]) < 62) continue;
      if (swans.some(o => o !== s && (dist(nx, ny, o.x, o.y) < SW_SEP + 14 || dist(nx, ny, o.tx, o.ty) < SW_SEP + 14))) continue;
      s.tx = nx; s.ty = ny; break;
    }
  }
  const dx = s.tx - s.x, dy = s.ty - s.y, d = Math.hypot(dx, dy);
  if (d > 1) { const nx = s.x + dx / d * s.sp * dt, ny = s.y + dy / d * s.sp * dt; const blocked = swans.some(o => o !== s && dist(nx, ny, o.x, o.y) < SW_SEP && dist(nx, ny, o.x, o.y) < dist(s.x, s.y, o.x, o.y) + .01) || fishes.some(f => f.region === 'pond' && f.state === 'swim' && dist(nx, ny, f.x, f.y) < 38 && dist(nx, ny, f.x, f.y) < dist(s.x, s.y, f.x, f.y) + .01);
    if (blocked) { s.tx = s.x; s.ty = s.y; } else if (cell(POND_SW, nx, ny)) { s.x = nx; s.y = ny; } else { s.tx = s.x; s.ty = s.y; } if (Math.abs(dx) > 3) s.dir = dx > 0 ? 1 : -1; }
}

const SPECIES = A.SPECIES;
const FLOWER_PTS = D.flowers;
const ISL_C = (() => { let sx = 0, sy = 0, n = 0; for (let y = 0; y < GH; y++) for (let x = 0; x < GW; x++) if (ISL[y * GW + x]) { sx += x; sy += y; n++; } return [sx / n * C, sy / n * C]; })();
function randIslandPoint() { for (let k = 0; k < 300; k++) { const x = rnd(40, W - 40), y = rnd(80, H - 220); if (cell(ISL, x, y)) return [x, y]; } return [ISL_C[0], ISL_C[1]]; }
function newButterfly(i) {
  let [x, y] = randIslandPoint();
  if (FLOWER_PTS && FLOWER_PTS.length) { const f = FLOWER_PTS[Math.floor(Math.random() * FLOWER_PTS.length)]; const px = f[0] + rnd(-25, 25), py = f[1] + rnd(-25, 25); if (cell(ISL, px, py)) { x = px; y = py; } }   // ils naissent près des fleurs
  return { sp: SPECIES[i % SPECIES.length], x, y, z: rnd(14, 26), zBase: rnd(14, 26), hd: rnd(0, TAU), speed: rnd(5.5, 9), flap: rnd(0, 6), ph: rnd(0, 6), seed: rnd(0, 9), mode: 'fly', rest: 0, landCool: rnd(1, 4), size: rnd(.95, 1.1), tilt: 0, alive: true, respawn: 0 };
}
const butterflies = []; for (let i = 0; i < 3; i++) butterflies.push(newButterfly(i));
function updateButterfly(b, dt, i) {
  if (!b.alive) { b.respawn -= dt; if (b.respawn <= 0) Object.assign(b, newButterfly(i)); return; }
  b.ph += dt;
  if (b.mode === 'fly') {
    b.flap += dt * (10 + Math.sin(b.ph * 3) * 2);
    b.hd += (Math.sin(b.ph * 1.7 + b.seed) * 1.7 + (Math.random() - .5) * 2) * dt;
    { let nf = null, nd = 150; for (const o of flowers) if (o.alive) { const q = dist(o.x, o.y, b.x, b.y); if (q < nd) { nd = q; nf = o; } }   // attirés par les fleurs proches
      if (nf && nd > 14) { const want = Math.atan2(nf.y - b.y, nf.x - b.x); let dd = want - b.hd; dd = Math.atan2(Math.sin(dd), Math.cos(dd)); b.hd += dd * Math.min(1, dt * .9); } }
    const bs = (DIFF[level] || DIFF.aventure).bflySpeed, nx = b.x + Math.cos(b.hd) * b.speed * bs * dt, ny = b.y + Math.sin(b.hd) * b.speed * bs * .85 * dt;
    if (!cell(ISL, nx, ny) || ny > H - 230) b.hd = Math.atan2(ISL_C[1] - b.y, ISL_C[0] - b.x) + rnd(-.7, .7); else { b.x = nx; b.y = ny; }
    b.z = b.zBase + Math.sin(b.ph * 2.4) * 5;
    b.landCool -= dt;
    if (b.landCool <= 0) {
      const f = flowers.find(o => o.alive && dist(o.x, o.y, b.x, b.y) < 42);
      if (f && Math.random() < dt * 1.6) { b.mode = 'rest'; b.rest = rnd(3, 7); b.x += (f.x - b.x) * .6; b.y += (f.y - 8 - b.y) * .6; }
    }
  } else {
    b.flap += dt * 2.0; b.z += (2 - b.z) * Math.min(1, dt * 7); b.rest -= dt;
    if (b.rest <= 0) { b.mode = 'fly'; b.zBase = rnd(14, 26); b.landCool = rnd(2, 5); }
  }
  const want = b.hd + Math.PI / 2; let d = want - b.tilt; d = Math.atan2(Math.sin(d), Math.cos(d)); b.tilt += d * Math.min(1, dt * 6);
}

/* ================= effets ================= */
const floaters = [], sparks = [], flyers = [], leavers = [];
function floatText(x, y, txt, color = '#fff') { floaters.push({ x, y, txt, t: 0, color }); }
function burst(x, y, n = 14, cols = ['#ffd84d', '#ff8fc4', '#7fd1ff', '#fff'], star = false) {
  for (let i = 0; i < n; i++) { const a = Math.random() * TAU, s = rnd(30, 120); sparks.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 50, t: 0, life: rnd(.6, 1.2), c: cols[(Math.random() * cols.length) | 0], r: rnd(2, 4), star }); }
}
function confetti() { for (let i = 0; i < 90; i++) sparks.push({ x: player.x + rnd(-40, 40), y: player.y - 70, vx: rnd(-140, 140), vy: rnd(-230, -50), t: 0, life: rnd(1.2, 2.2), c: ['#ff6fa5', '#ffd84d', '#6fd16f', '#6fc4ff', '#b78cff'][(Math.random() * 5) | 0], r: rnd(2.5, 4), g: 240 }); }
let time = 0;

/* ================= entrées ================= */
const keys = {};
let tool = 'none';
const stick = { active: false, id: null, ox: 0, oy: 0, x: 0, y: 0, mag: 0 };
let actQueued = false, jumpQueued = false, swanQueued = false, lastSpotPtr = -1;

addEventListener('keydown', e => {
  audio();
  if (e.target && /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) return;   // en tapant un nom, les touches ne commandent pas le jeu (le E, l'espace…)
  if (e.repeat && ['Space', 'Enter', 'KeyE', 'KeyX', 'KeyC'].includes(e.code)) { e.preventDefault(); return; }
  keys[e.code] = true;
  if (['Space', 'Enter', 'KeyE'].includes(e.code)) { actQueued = true; e.preventDefault(); }
  if (e.code === 'KeyX' || e.code === 'KeyJ') jumpQueued = true;
  if (e.code === 'KeyC') swanQueued = true;
  if (e.code === 'Digit0' || e.code === 'Numpad0' || e.code === 'Digit4' || e.code === 'Numpad4') setTool('none');
  if (e.code === 'Digit1' || e.code === 'Numpad1') setTool(tool === 'basket' ? 'none' : 'basket');
  if (e.code === 'Digit2' || e.code === 'Numpad2') setTool(tool === 'net' ? 'none' : 'net');
  if (e.code === 'Digit3' || e.code === 'Numpad3') setTool(tool === 'fish' ? 'none' : 'fish');
  if (e.code.startsWith('Arrow')) e.preventDefault();
});
addEventListener('keyup', e => { keys[e.code] = false; });
addEventListener('blur', () => { for (const k in keys) keys[k] = false; });

const ACT_LBL = { none: ['', 'Action'], basket: ['', 'Cueillir'], net: ['', 'Attraper'], fish: ['', 'Pêcher'] };
function setTool(t) {
  tool = t; document.querySelectorAll('.tool').forEach(b => b.classList.toggle('sel', b.dataset.tool === t));
  const a = ACT_LBL[t] || ACT_LBL.none, b = $('#bAct'); if (b) b.innerHTML = (a[0] ? '<img class="acti" alt="" src="' + a[0] + '">' : '') + '<b class="actl">' + a[1] + '</b>';
}
document.querySelectorAll('.tool').forEach(b => {
  const n = b.dataset.tool;
  b.addEventListener('pointerdown', e => { e.stopPropagation(); audio(); setTool(tool === n ? 'none' : n); });
});
const ICON_FRAME = { none: ['walk', 'down1'], basket: ['basket', 'idle'], net: ['net', 'idle'], fish: ['fish', 'fright1'] };
function fitToolIcons() {
  document.querySelectorAll('.tool').forEach(b => {
    const [sh, nm] = ICON_FRAME[b.dataset.tool], i = myIdx[sh][nm], cols = MY[sh].cols, w = b.clientWidth, k = w * .98 / 256, ico = b.querySelector('.ico');
    ico.style.backgroundImage = 'url(' + MY[sh].file + ')'; ico.style.backgroundSize = (cols * 256 * k) + 'px auto';
    ico.style.backgroundPosition = (w / 2 - 128 * k - (i % cols) * 256 * k) + 'px ' + (4 - 22 * k - Math.floor(i / cols) * 256 * k) + 'px';
  });
}
const press = (el, fn) => el.addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); audio(); fn(); });
press($('#bAct'), () => { actQueued = true; touchAct = true; });
['pointerup', 'pointercancel', 'pointerleave'].forEach(ev => $('#bAct').addEventListener(ev, () => { touchAct = false; }));
addEventListener('blur', () => { touchAct = false; });
press($('#bJump'), () => { jumpQueued = true; });
press($('#bSwan'), () => { swanQueued = true; });
function fitTipIcons() {   // dans 💡 Astuces : les mêmes images de Myah que les boutons d'outils du bas
  document.querySelectorAll('#tipsBody .tico').forEach(b => {
    try { let ico = b.querySelector('.ico'); if (!ico) { ico = document.createElement('span'); ico.className = 'ico'; b.appendChild(ico); }
      const [sh, nm] = ICON_FRAME[b.dataset.t], i = myIdx[sh][nm], cols = MY[sh].cols, w = 38, k = w * .98 / 256;
      ico.style.backgroundImage = 'url(' + MY[sh].file + ')'; ico.style.backgroundSize = (cols * 256 * k) + 'px auto';
      ico.style.backgroundPosition = (w / 2 - 128 * k - (i % cols) * 256 * k) + 'px ' + (4 - 22 * k - Math.floor(i / cols) * 256 * k) + 'px'; } catch (e) {}
  });
}
press($('#tipsB'), () => { $('#tips').style.display = 'grid'; fitTipIcons(); });
press($('#tipsX'), () => { $('#tips').style.display = 'none'; });
$('#tips').addEventListener('click', e => { if (e.target.id === 'tips') $('#tips').style.display = 'none'; });
press($('#mute'), () => { muted = !muted; $('#mute').textContent = muted ? '🔇' : '🔊'; musApply(); });
const syncSliders = () => { $('#setVol').value = Math.round(vol * 100); $('#setVolV').textContent = Math.round(vol * 100) + '%'; $('#setBri').value = Math.round(bright * 100); $('#setBriV').textContent = Math.round(bright * 100) + '%'; $('#setMus').value = Math.round(musVol * 100); $('#setMusV').textContent = Math.round(musVol * 100) + '%'; };
$('#setMus').addEventListener('input', e => { musVol = (+e.target.value) / 100; $('#setMusV').textContent = e.target.value + '%'; musApply(); savePrefs(); });
$('#setVol').addEventListener('input', e => { vol = (+e.target.value) / 100; $('#setVolV').textContent = e.target.value + '%'; audio(); if (master) master.gain.value = vol; savePrefs(); });
$('#setVol').addEventListener('change', () => { audio(); sfx.pick(); });
$('#setBri').addEventListener('input', e => { bright = (+e.target.value) / 100; $('#setBriV').textContent = e.target.value + '%'; applyBright(); savePrefs(); });
const setDayTxt = () => { $('#setDay').textContent = dayAuto ? '🌗 Jour et nuit : activé' : '☀️ Jour et nuit : coupé (toujours jour)'; };
press($('#setDay'), () => { dayAuto = !dayAuto; setDayTxt(); savePrefs(); });
press($('#setNight'), () => { dayAuto = true; dayT = .7; setDayTxt(); savePrefs(); $('#setMsg').textContent = '🌙 Il fait nuit !'; });   // pour tester les nouveautés de nuit
const setSoundTxt = () => { $('#setSound').textContent = muted ? '🔇 Son : coupé' : '🔊 Son : activé'; };
const openSet = () => { setSoundTxt(); setLevelTxt(); setDayTxt(); setAutoTxt(); setSkipTxt(); syncSliders(); $('#setMsg').textContent = ''; $('#settings').style.display = 'grid'; };
press($('#setB'), () => { if (!started) return; openSet(); });
press($('#tSet'), openSet);
press($('#tMute'), () => { muted = !muted; $('#tMute').classList.toggle('off', muted); $('#mute').textContent = muted ? '🔇' : '🔊'; musApply(); });
press($('#setSound'), () => { muted = !muted; $('#tMute').classList.toggle('off', muted); $('#mute').textContent = muted ? '🔇' : '🔊'; setSoundTxt(); musApply(); });
$('#quests').addEventListener('pointerdown', e => { const b = e.target.closest('.qtab'); if (!b) return; e.preventDefault(); e.stopPropagation(); audio(); questTab = b.dataset.qt; renderHud(); });
const setLevelTxt = () => { $('#setLevel').textContent = '🎚️ Niveau : ' + LEVEL_NAME[level]; };
document.querySelectorAll('#lvBtns button').forEach(b => b.addEventListener('click', () => { audio(); $('#lvSel').value = b.dataset.v; document.querySelectorAll('#lvBtns button').forEach(x => x.classList.toggle('sel', x === b)); }));
press($('#setLevel'), () => { setLevel(LEVELS[(LEVELS.indexOf(level) + 1) % LEVELS.length]); setLevelTxt(); save(); renderHud(); $('#setMsg').textContent = level === 'balade' ? 'Balade : la pêche est toute douce 🌿' : level === 'aventure' ? 'Aventure : un petit défi 🐟' : 'Défi : pour les pros de la canne 🔥'; });
const setAutoTxt = () => { $('#setAuto').textContent = autoSv ? '💾 Sauvegarde : automatique' : '✋ Sauvegarde : manuelle'; };
const setSkipTxt = () => { $('#setSkip').textContent = skipTitle ? '⏩ Écran d\'accueil : passé' : '🏠 Écran d\'accueil : affiché'; };
press($('#setSkip'), () => { skipTitle = !skipTitle; setSkipTxt(); savePrefs(); $('#setMsg').textContent = skipTitle ? 'Au prochain lancement, tu reprends directement ta dernière partie.' : 'L\'écran d\'accueil s\'affichera à chaque lancement.'; });
press($('#setAuto'), () => { autoSv = !autoSv; setAutoTxt(); savePrefs(); if (autoSv) save(); $('#setMsg').textContent = autoSv ? 'La partie se sauvegarde toute seule.' : 'Sauvegarde manuelle : pense à appuyer sur « Sauvegarder maintenant ».'; });
press($('#setSave'), () => { save(true); const d = new Date(); $('#setMsg').textContent = '✔ Partie sauvegardée à ' + d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) + ' !'; });
function backupCode() { const o = { v: 1, slots: {}, looks: null }; try { for (let n = 1; n <= NSLOTS; n++) { const s = localStorage.getItem(slotKey(n)); if (s) o.slots[n] = s; } o.looks = localStorage.getItem(WD_SAVE_KEY); } catch (e) {} return btoa(unescape(encodeURIComponent(JSON.stringify(o)))); }
press($('#setCopy'), () => { const c = backupCode(), ok = () => { $('#setMsg').textContent = '📋 Code copié ! Garde-le dans une note : il te permet de retrouver tes parties.'; }; try { navigator.clipboard.writeText(c).then(ok, () => { prompt('Copie ce code de secours :', c); }); } catch (e) { prompt('Copie ce code de secours :', c); } });
press($('#setPaste'), () => { const c = prompt('Colle ici ton code de secours :'); if (!c) return; try { const o = JSON.parse(decodeURIComponent(escape(atob(c.trim())))); let n = 0; for (const k in o.slots) { const f = +k; if (f >= 1 && f <= NSLOTS && !localStorage.getItem(slotKey(f))) { localStorage.setItem(slotKey(f), o.slots[k]); idbPut(slotKey(f), o.slots[k]); n++; } } if (o.looks && !localStorage.getItem(WD_SAVE_KEY)) localStorage.setItem(WD_SAVE_KEY, o.looks); refreshTitle(); $('#setMsg').textContent = n ? '✔ ' + n + ' partie(s) retrouvée(s) : elles sont sur l\'écran titre.' : 'Rien de nouveau à récupérer (les emplacements sont déjà pris).'; } catch (e) { $('#setMsg').textContent = '❌ Ce code n\'est pas valide.'; } });
press($('#setClose'), () => { $('#settings').style.display = 'none'; });
press($('#setQuit'), () => { $('#settings').style.display = 'none'; openQuit(); });

cv.addEventListener('pointerdown', e => { audio(); if (dlg.open) advanceDialog(); });
// joystick tactile : fixe, en bas à gauche, transparent (mode mobile seulement)
const IS_TOUCH = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
const TUT_KEY = SAVE_KEY + '-tut'; let tutSeen = {}, tutAcc = {}; try { tutSeen = JSON.parse(localStorage.getItem(TUT_KEY) || '{}') || {}; } catch (e) {}
const tutLast = {};
function tutHint(k, t) { if (tutSeen[k]) return ''; const dt = Math.min(.1, Math.max(0, time - (tutLast[k] || time))); tutLast[k] = time; tutAcc[k] = (tutAcc[k] || 0) + dt; if (tutAcc[k] > 5) tutDone(k); return t; }   // texte d'aide montré ~5 s en tout, puis plus jamais
function tutDone(k) { if (tutSeen[k]) return; tutSeen[k] = 1; try { localStorage.setItem(TUT_KEY, JSON.stringify(tutSeen)); } catch (e) {} }   // les petits messages d'aide ne s'affichent qu'une fois
if (IS_TOUCH) document.body.classList.add('touch');
{
  // contrôle tactile : on glisse le doigt n'importe où sur l'écran pour marcher (tout le long d'un glissé, la direction suit le doigt) ; un simple tap valide / interagit
  const R = 55, DEAD = 10; let sw = null;
  const stopStick = () => { stick.active = false; stick.x = stick.y = stick.mag = 0; };
  const mv = e => {
    if (player.state === 'fishing' && (fs.phase === 'bite' || fs.phase === 'fight')) { stopStick(); return; }   // pendant la touche / le combat, le doigt ne fait pas bouger Myah
    let dx = e.clientX - sw.ax, dy = e.clientY - sw.ay; const d = Math.hypot(dx, dy);
    if (d > R * 1.5) { sw.ax += dx / d * (d - R * 1.5); sw.ay += dy / d * (d - R * 1.5); dx = e.clientX - sw.ax; dy = e.clientY - sw.ay; }   // l'ancre suit le doigt : on peut changer de direction sans repartir de loin
    const dd = Math.hypot(dx, dy);
    if (dd > DEAD) { stick.active = true; stick.x = dx / dd; stick.y = dy / dd; stick.mag = Math.min(1, dd / R); if (dd > R * 1.3) stick.mag = 1; else stick.mag = Math.min(.9, stick.mag); } else stopStick();
  };
  cv.addEventListener('pointerdown', e => {
    if (e.pointerType === 'mouse' || sw) return;
    sw = { id: e.pointerId, ax: e.clientX, ay: e.clientY, x0: e.clientX, y0: e.clientY, t: performance.now(), moved: false, dlg: dlg.open, fish: fishHoldNeeded() };
    try { cv.setPointerCapture(e.pointerId); } catch (x) {}
  }, true);
  cv.addEventListener('pointermove', e => {
    if (!sw || e.pointerId !== sw.id) return;
    if (!sw.moved && Math.hypot(e.clientX - sw.x0, e.clientY - sw.y0) > 12) sw.moved = true;
    if (sw.moved) mv(e);
  });
  const end = e => {
    if (!sw || e.pointerId !== sw.id) return;
    const s = sw; sw = null; stopStick();
    if (e.type === 'pointerup' && !s.moved && !s.dlg && !s.fish && !dlg.open && performance.now() - s.t < 500 && lastSpotPtr !== e.pointerId) { if (player.mount) jumpQueued = true; else actQueued = true; }   // un tap = valider / interagir (sur le Cygne : voler ou flotter) (si le tap n'a pas déjà touché un objet du décor)
  };
  cv.addEventListener('pointerup', end); cv.addEventListener('pointercancel', end);
  addEventListener('blur', () => { sw = null; stopStick(); });
}

/* pêche sur mobile : gros bouton 🎣 à tenir (touche + combat), ou doigt posé n'importe où sur l'écran */
const fishHoldNeeded = () => player.state === 'fishing' && (fs.phase === 'bite' || fs.phase === 'fight');
{
  const st = document.createElement('style');
  st.textContent = '#fishBtn{position:fixed;right:max(22px,env(safe-area-inset-right));bottom:max(108px,calc(env(safe-area-inset-bottom) + 96px));width:112px;height:112px;border-radius:50%;display:none;align-items:center;justify-content:center;font-size:54px;z-index:7;background:radial-gradient(circle at 35% 30%,#ffe28a,#f2b64a 70%);border:5px solid #fff;box-shadow:0 6px 0 #a8691a,0 0 22px rgba(255,230,140,.9);touch-action:none;user-select:none;-webkit-user-select:none;animation:fbPulse 1s ease-in-out infinite}#fishBtn.held{background:radial-gradient(circle at 35% 30%,#b9f5b0,#4fcf6e 70%);box-shadow:0 2px 0 #1f7a38,0 0 26px rgba(120,255,150,.95);transform:translateY(4px);animation:none}@keyframes fbPulse{50%{transform:scale(1.07)}}';
  document.head.appendChild(st);
  const b = document.createElement('div'); b.id = 'fishBtn'; b.textContent = '🎣'; document.body.appendChild(b);
  let id = null;
  const down = e => { e.preventDefault(); e.stopPropagation(); audio(); id = e.pointerId; try { b.setPointerCapture(id); } catch (x) {} actQueued = true; touchAct = true; };
  const up = e => { if (id !== null && e.pointerId !== id) return; id = null; touchAct = false; };
  b.addEventListener('pointerdown', down); b.addEventListener('pointerup', up); b.addEventListener('pointercancel', up); b.addEventListener('lostpointercapture', up);
  // appui n'importe où (hors boutons) pendant la touche / le combat
  let cid = null;
  cv.addEventListener('pointerdown', e => { if (!IS_TOUCH || !fishHoldNeeded()) return; cid = e.pointerId; actQueued = true; touchAct = true; });
  const cup = e => { if (cid !== null && e.pointerId === cid) { cid = null; touchAct = false; } };
  addEventListener('pointerup', cup); addEventListener('pointercancel', cup);
}

/* ================= bouée de secours 🛟 : téléporte Myah au plus proche endroit libre ================= */
{
  const st = document.createElement('style');
  st.textContent = '#sosB{position:fixed;right:max(10px,env(safe-area-inset-right));top:calc(max(10px,env(safe-area-inset-top)) + 54px);width:42px;height:42px;font-size:22px;display:grid;place-items:center;cursor:pointer;padding:0;z-index:5}';
  document.head.appendChild(st);
  const b = document.createElement('button'); b.id = 'sosB'; b.className = 'panel'; b.setAttribute('aria-label', 'Aide : je suis coincée'); b.title = 'Aide : je suis coincée'; b.textContent = '🛟'; document.body.appendChild(b);
  const inOkAt = (x, y) => { const poly = IN_FLOORS[IN.floor], bl = IN.floor === 0 ? (SC === SC_HOME && (IN.sdb || 0) < .5 ? SC.blocks.concat(SC.walls) : SC.blocks) : SC.blocks1; return inPoly(poly, x, y) && !(bl && bl.some(q => inPoly(q, x, y))); };
  const search = (x0, y0, ok, step, maxR) => {   // le point libre le plus proche (avec un peu de marge autour)
    const roomy = (x, y, m) => ok(x, y) && ok(x + m, y) && ok(x - m, y) && ok(x, y + m) && ok(x, y - m);
    for (const m of [step * .9, step * .45, 0]) for (let r = step; r <= maxR; r += step) for (let k = 0, n = Math.max(12, Math.round(r / 2)); k < n; k++) { const a = k / n * TAU, x = x0 + Math.cos(a) * r, y = y0 + Math.sin(a) * r; if (roomy(x, y, m)) return [x, y]; }
    return null;
  };
  // zone « sûre » : tout ce qu'on peut atteindre en marchant depuis un point de départ connu (la porte, le haut de l'échelle, le départ de la partie), avec de la marge
  const reachNearest = (x0, y0, sx, sy, ok, step, minD) => {
    const m = step * .6, roomy = (x, y) => ok(x, y) && ok(x + m, y) && ok(x - m, y) && ok(x, y + m) && ok(x, y - m);
    const s = search(sx, sy, roomy, step, 400); if (!s) return null;
    const seen = new Set(), key = (i, j) => i * 100003 + j, q = [[0, 0]], ci = Math.round(s[0] / step), cj = Math.round(s[1] / step); seen.add(key(ci, cj)); q[0] = [ci, cj];
    let best = null, bd = 1e18, bestAny = null, bda = 1e18;
    for (let h = 0; h < q.length && q.length < 90000; h++) {
      const [i, j] = q[h], x = i * step, y = j * step, d = (x - x0) * (x - x0) + (y - y0) * (y - y0);
      if (d < bda) { bda = d; bestAny = [x, y]; }
      if (d < bd && d >= minD * minD) { bd = d; best = [x, y]; }
      for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const ni = i + di, nj = j + dj, k = key(ni, nj); if (seen.has(k)) continue; seen.add(k); if (roomy(ni * step, nj * step)) q.push([ni, nj]); }
    }
    return best || bestAny;
  };
  const rescue = () => {
    audio();
    if (!started || dlg.open || cine) return;
    const p = player;
    if (IN.on) {
      if (IN.busy || IN.lie || IN.sit || IN.shower || IN.wash || IN.climb || IN.bunk || IN.puff) { say('Termine ce que tu fais d\'abord 🛟', 2.5); return; }
      const okC = (x, y) => { const poly = IN_FLOORS[IN.floor], bl = IN.floor === 0 ? (SC === SC_HOME ? SC.blocks.concat(SC.walls) : SC.blocks) : SC.blocks1; return inPoly(poly, x, y) && !(bl && bl.some(q => inPoly(q, x, y))); };   // salle de bain comptée comme fermée : on ne te remet jamais derrière un mur
      const st = IN.floor === 1 ? IN_LADDER[1] : [IN_EXIT[0], IN_EXIT[1] - 40];
      const t = reachNearest(IN.x, IN.y, st[0], st[1], okC, 8, 30) || [st[0], st[1]];
      IN.x = t[0]; IN.y = t[1]; sfx.hop && sfx.hop(); say('🛟 Myah est remise sur un chemin libre', 2.8); return;
    }
    if (p.mount) { say('Pose-toi d\'abord : tu peux voler partout ! 🦢', 2.8); return; }
    if (p.state !== 'free') { say('Termine ce que tu fais d\'abord 🛟', 2.5); return; }
    const ok = (x, y) => walkable(x, y) && !npcBlocked(x, y) && (!WIDE || cell(WIDE, x, y));
    const sp = nearestWalk(D.start[0], D.start[1], 120) || D.start;
    const t = reachNearest(p.x, p.y, sp[0], sp[1], ok, 6, 24) || nearestWalk(p.x, p.y, 260);
    if (t) { p.x = t[0]; p.y = t[1]; burst(p.x, p.y - 20, 12); sfx.hop && sfx.hop(); say('🛟 Myah est remise sur un chemin libre', 2.8); }
  };
  b.addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); rescue(); });
}
/* ================= dialogue ================= */
const dlg = { open: false, lines: [], i: 0, after: null };
function openDialog(who, lines, after, portrait) {
  dlg.open = true; dlg.lines = lines; dlg.i = 0; dlg.after = after || null;
  const d = $('#dialog'); d.style.display = 'block';
  d.querySelector('.who').textContent = who;
  const pt = d.querySelector('.pt'); if (portrait) { pt.src = portrait; pt.style.display = 'block'; } else pt.style.display = 'none';
  setDialogLine();
  sfx.talk();
}
function setDialogLine() {
  const d = $('#dialog');
  d.querySelector('.txt').innerHTML = ico(dlg.lines[dlg.i]);
  d.querySelector('.next').textContent = dlg.i < dlg.lines.length - 1 ? 'Suite ▶' : 'OK ✔';
}
function advanceDialog() {
  dlg.i++;
  if (dlg.i >= dlg.lines.length) { dlg.open = false; $('#dialog').style.display = 'none'; const f = dlg.after; dlg.after = null; if (f) f(); return; }
  setDialogLine(); sfx.talk();
}
$('#dialog').addEventListener('pointerdown', e => { e.stopPropagation(); audio(); advanceDialog(); });

/* ================= HUD ================= */
let questTab = 'todo';
function renderHud() {
  const no = nOpened();
  let h = `<div class="row"><span>🍌 ${inv.banana}</span><span>🌸 ${inv.flower}</span><span>🦋 ${inv.butterfly}</span><span>🐟 ${inv.fish}</span>${inv.coconut ? `<span>🥥 ${inv.coconut}</span>` : ''}${inv.mango ? `<span>🥭 ${inv.mango}</span>` : ''}</div><div class="row pl">`;
  QUESTS.forEach(q => { h += `<img src="${FICON[q.fe]}" class="${opened[q.id] ? '' : 'off'}" alt="">`; });
  h += `<span>${no}/5</span></div>`;
  h += '<button class="mapOpen" id="mapOpen">🗺️ Carte de l\'île</button>';
  $('#inv').innerHTML = h;
  { const bn = $('#bagN'); bn.textContent = no + '/5'; bn.classList.toggle('show', no > 0); }
  let t = '<h3>📜 Mes quêtes</h3>';
  const seen = QUESTS.filter(q => qState[q.id] !== 'new');
  const line = q => {
    const st = qState[q.id], lock = !unlocked(q);
    const txt = lock ? '🔒 ???' : q.title;
    let cnt = '';
    if (st === 'done') cnt = opened[q.id] ? '✔' : '🎁 coffre !';
    else if (st === 'active') cnt = needStr(q);
    else if (!lock) cnt = '❗';
    const nst = (st === 'done' ? 1 : 0) + (opened[q.id] ? 1 : 0) + (st === 'done' && bonusStar[q.id] ? 1 : 0);   // étoiles de mission (jusqu'à 3)
    const ic = [0, 1, 2].map(i => i < nst ? '<b>★</b>' : '<i>★</i>').join('');
    const stars = lock ? '' : `<span class="stars" title="${nst} étoile${nst > 1 ? 's' : ''} sur 3">${ic}</span>`;
    return `<div class="q ${st === 'done' && opened[q.id] ? 'done' : ''} ${lock ? 'locked' : ''}"><span>${txt}${stars}</span><span class="cnt">${cnt}</span></div>`;
  };
  const doneQ = seen.filter(q => qState[q.id] === 'done' && opened[q.id]), todoQ = seen.filter(q => !(qState[q.id] === 'done' && opened[q.id]));
  const tabB = (id, lbl) => `<button class="qtab ${questTab === id ? 'sel' : ''}" data-qt="${id}">${lbl}</button>`;
  t += `<div class="qtabs">${tabB('todo', '📜 En cours <small>' + todoQ.length + '</small>')}${tabB('done', '✔ Accomplies <small>' + doneQ.length + '/5</small>')}</div>`;
  if (questTab === 'done') { if (!doneQ.length) t += '<div class="q"><span>Aucune quête accomplie pour le moment : ouvre le coffre d\'une mission pour la ranger ici ✨</span></div>'; doneQ.forEach(q => { t += line(q); }); }
  else { if (!seen.length) t += '<div class="q"><span>💬 Va parler aux habitants de l\'île : chacun a besoin d\'un coup de main !</span></div>'; todoQ.forEach(q => { t += line(q); }); }
  const sw = phase === 'quests' || phase === 'reveal';
  if (!sw) t += `<div class="q ${phase === 'returned' ? 'done' : ''} ${sw ? 'locked' : ''}"><span>${sw ? '🔒 ???' : '🦢 Rendre les plumes au Cygne'}</span><span class="cnt">${phase === 'returned' ? '✔' : (sw ? '' : '❗ lac')}</span></div>`;
  $('#quests').innerHTML = t;
  $('#bSwan').classList.toggle('on', mountUnlocked);
  const act = QUESTS.filter(q => qState[q.id] === 'active').length + QUESTS.filter(q => qState[q.id] === 'done' && !opened[q.id]).length;
  { const sn = $('#scrN'); sn.textContent = act || '❗'; sn.classList.toggle('show', act > 0); }
}
function hudToggle(which) {   // un seul panneau ouvert à la fois
  const map = { bag: ['#inv', '#bagB'], scr: ['#quests', '#scrB'] };
  for (const k in map) { const on = k === which && !$(map[k][0]).classList.contains('open'); $(map[k][0]).classList.toggle('open', on); $(map[k][1]).classList.toggle('on', on); }
}
press($('#bagB'), () => hudToggle('bag'));
press($('#scrB'), () => hudToggle('scr'));

/* ================= actions ================= */
let bubble = { txt: '', t: 0 };
const say = (txt, t = 2.6) => { bubble = { txt, t }; };
function setAnim(name) { if (player.anim !== name) { player.anim = name; player.fr = 0; } }
function faceTo(x) { if (Math.abs(x - player.x) > 5) player.face = x > player.x ? 1 : -1; }
function nearestItem(list, x, y, maxD) { let best = null, bd = maxD; for (const o of list) { if (!o.alive) continue; const d = dist(o.x, o.y, x, y); if (d < bd) { bd = d; best = o; } } return best; }
const R_PICK = 30, R_NPC = 42, R_CHEST = 36, R_SWAN = 86;

function perchVisible() { return phase === 'appeared' || phase === 'returned' || (phase === 'reveal' && cine && cine.t > .8); }
function perchAway() { return player.mount || leavers.some(l => l.t < 1.3 && l.fromPerch); }

function waterNear() {
  const cx = Math.floor(player.x / C), cy = Math.floor(player.y / C), R = 22;
  let best = null, bd = 1e9;
  for (let dy = -R; dy <= R; dy++) for (let dx = -R; dx <= R; dx++) {
    const x = cx + dx, y = cy + dy; if (x < 0 || y < 0 || x >= GW || y >= GH) continue;
    const i = y * GW + x, pond = POND[i] === 1, sea = SEA[i] === 1;
    if (!pond && !sea) continue;
    const d = Math.hypot(dx, dy) * C; if (d < bd) { bd = d; best = { x: x * C + C / 2, y: y * C + C / 2, region: pond ? 'pond' : 'sea' }; }
  }
  return best && bd <= 78 ? best : null;
}

const act = { kind: null, target: null, done: false };
const fs = { phase: '', tx: 0, ty: 0, t: 0, biteAt: 0, caught: false, region: 'pond', fish: null, fight: null };
// ===== TABLEAU DES NIVEAUX : tout ce qui change selon « Balade / Aventure / Défi » est ici =====
const LEVELS = ['balade', 'aventure', 'defi'];
const LEVEL_NAME = { balade: '🌿 Balade', aventure: '⛵ Aventure', defi: '🔥 Défi' };
const DIFF = {
  balade: {
    need: { coconut: 3, butterfly: 2, flower: 3, fish: 2, mango: 3, banana: 4 },   // quantités demandées par les missions
    treeWait: 12,            // secondes avant que les arbres refassent des fruits
    bflySpeed: .7,           // vitesse des papillons (1 = normal)
    netR: 62,                // rayon d'attrape du filet
    lureSpeed: 70,           // vitesse à laquelle le poisson vient vers l'appât
    halo: true,              // halo doré autour de ce qu'on peut cueillir / attraper
    zone: .52, zoneSpeed: .20, fill: .34, drain: .03, start: .45, canLose: false, rise: 1.5, fall: 1.1,   // barre de pêche
  },
  aventure: {   // = les valeurs d'origine du jeu
    need: { coconut: 4, butterfly: 3, flower: 5, fish: 2, mango: 5, banana: 6 },
    treeWait: 30, bflySpeed: 1, netR: 46, lureSpeed: 42, halo: true,
    zone: .42, zoneSpeed: .34, fill: .28, drain: .09, start: .30, canLose: true, rise: 1.6, fall: 1.2,
  },
  defi: {
    need: { coconut: 6, butterfly: 5, flower: 8, fish: 3, mango: 8, banana: 10 },
    treeWait: 45, bflySpeed: 1.4, netR: 36, lureSpeed: 30, halo: false,
    zone: .32, zoneSpeed: .55, fill: .24, drain: .15, start: .25, canLose: true, rise: 1.8, fall: 1.4,
  },
};
let level = 'aventure';
const WORDS = { coconut: 'noix de coco|🥥', mango: 'mangues?|🥭', banana: 'bananes?|🍌', butterfly: 'papillons?|🦋', flower: 'fleurs?|🌸', fish: 'poissons?|🐟' };
function applyLevel() {   // recalcule les missions (quantités + textes) et les réglages du jeu pour le niveau courant
  const D = DIFF[level]; TREE_WAIT = D.treeWait;
  QUESTS.forEach(q => {
    if (!q._base) { q._base = Object.assign({}, q.need); q._txt = { title: q.title, start: q.start.slice(), remind: q.remind.slice(), done: q.done.slice() }; }
    const ks = Object.keys(q._base), fix = ks.length === 1 ? (str => str.replace(new RegExp('(?<!\\d)' + q._base[ks[0]] + '(?!\\d)', 'g'), D.need[ks[0]])) : (str => ks.reduce((t, k) => t.replace(new RegExp('(?<!\\d)' + q._base[k] + '(\\s*(?:' + WORDS[k] + '))', 'g'), (m, w) => D.need[k] + w), str));
    const need = {}; Object.keys(q._base).forEach(k => need[k] = D.need[k]);
    if (qState[q.id] !== 'done') q.need = need;
    q.title = fix(q._txt.title); q.start = q._txt.start.map(fix); q.remind = q._txt.remind.map(fix); q.done = q._txt.done.map(fix);
  });
}
const setLevel = l => { level = DIFF[l] ? l : 'aventure'; applyLevel(); };
let touchAct = false;   // bouton Action tenu avec le doigt
const actHeld = () => !!(keys.Space || keys.Enter || keys.KeyE || touchAct);

function doAction() {
  if (cine) return;
  if (player.state === 'talk') return;
  if (player.state === 'fishing') { fishPress(); return; }
  if (player.mount) { say('Appuie sur 🦢 pour descendre du cygne', 2.4); return; }
  if (player.state !== 'free') return;

  // cibles proches : coffre, PNJ, cygne
  let target = null, bd = 1e9;
  for (const q of QUESTS) {
    const dn = dist(q.x, q.y, player.x, player.y), dc = dist(q.cx, q.cy, player.x, player.y) + (qState[q.id] === 'done' && !opened[q.id] ? 0 : 40);
    if (dc < R_CHEST && dc < bd) { bd = dc; target = { kind: 'chest', q }; }
    if (dn < R_NPC && dn < bd) { bd = dn; target = { kind: 'npc', q }; }
  }
  for (const e of EXTRAS) { const d = dist(e.x, e.y, player.x, player.y); if (d < R_NPC && d < bd) { bd = d; target = { kind: 'extra', e }; } }
  if (perchVisible() && !perchAway()) { const ds = dist(D.perch[0], D.perch[1], player.x, player.y); if (ds < R_SWAN && ds < bd) { bd = ds; target = { kind: 'swan' }; } }
  if (target && (target.kind === 'npc' || target.kind === 'extra') && miniDeliver(target)) return;
  if (target) {
    if (target.kind === 'extra') { faceTo(target.e.x); player.state = 'talk'; setAnim('idle'); return openDialog(target.e.who, target.e.met ? chatter(target.e.key) : (target.e.met = true, target.e.lines), () => { if (target.e.museum) openColl(); else player.state = 'free'; }, target.e.portrait); }
    if (target.kind === 'npc') { faceTo(target.q.x); return talkTo(target.q); }
    if (target.kind === 'chest') { faceTo(target.q.cx); return touchChest(target.q); }
    if (target.kind === 'swan') { faceTo(D.perch[0]); return talkSwan(); }
  }

  if (miniAction()) return;
  if (tool === 'none') {
    if (nearestItem(bananas, player.x, player.y, R_PICK) || nearestItem(flowers, player.x, player.y, R_PICK)) return hint('Pour cueillir, prends le panier [panier] (touche 1)', 'basket');
    if (nightAmt() > .5 && dayT < .9 && !IN.on) return startStars(false);   // le soir seulement
    if (butterflies.some(b => b.alive && dist(b.x, b.y, player.x, player.y) < 70)) return hint('Pour les papillons 🦋, prends le filet [filet] (touche 2)', 'net');
    if (waterNear()) return hint('Pour pêcher 🐟, prends la canne [canne] (touche 3)', 'fish');
    sfx.no(); return say('Mains libres ! Choisis un outil pour agir [panier] [filet] [canne]', 2.6);
  }
  if (tool === 'basket') {
    const b = nearestItem(bananas, player.x, player.y, R_PICK), f = nearestItem(flowers, player.x, player.y, R_PICK);
    const t = (b && f) ? (dist(b.x, b.y, player.x, player.y) < dist(f.x, f.y, player.x, player.y) ? b : f) : (b || f);
    if (t) { faceTo(t.x); act.kind = 'pick'; act.target = t; act.done = false; player.state = 'act'; setAnim('basket'); return; }
    if (butterflies.some(b => b.alive && dist(b.x, b.y, player.x, player.y) < 70)) return hint('Pour les papillons 🦋, il faut le filet [filet] (touche 2)', 'net');
    if (waterNear()) return hint('Pour pêcher 🐟, il faut la canne [canne] (touche 3)', 'fish');
    const et = bananas.find(o => o.fruits <= 0 && dist(o.x, o.y, player.x, player.y) < R_PICK + 6);
    if (et) { sfx.no(); return say('Cet arbre est vide 🌱 : reviens dans ' + Math.ceil(TREE_WAIT - et.t) + ' s'); }
    sfx.no(); return say('Rien à ramasser ici. Cherche les arbres fruitiers 🥥🥭🍌 ou des fleurs 🌸 !');
  }
  if (tool === 'net') {
    if (!butterflies.some(b => b.alive && dist(b.x, b.y, player.x, player.y) < 60) && (nearestItem(bananas, player.x, player.y, R_PICK) || nearestItem(flowers, player.x, player.y, R_PICK))) return hint('Pour cueillir, il faut le panier [panier] (touche 1)', 'basket');
    act.kind = 'net'; act.done = false; act.got = false; player.state = 'act'; setAnim('net'); sfx.net(); return;
  }
  if (tool === 'fish') {
    if (nearestItem(bananas, player.x, player.y, R_PICK) || nearestItem(flowers, player.x, player.y, R_PICK)) return hint('Pour cueillir, il faut le panier [panier] (touche 1)', 'basket');
    const w = waterNear();
    if (!w) { sfx.no(); return say('Approche-toi de l\'eau 🌊 (étang ou plage) pour pêcher !'); }
    faceTo(w.x);
    const dx = w.x - player.x, dy = w.y - player.y, L = Math.hypot(dx, dy) || 1;
    fs.tx = w.x + dx / L * 14; fs.ty = w.y + dy / L * 14;
    if (!isWater(fs.tx, fs.ty)) { fs.tx = w.x; fs.ty = w.y; }
    fs.region = w.region; fs.phase = 'cast'; fs.t = 0; fs.caught = false; fs.fish = null;
    player.state = 'fishing'; setAnim('fish'); player.fr = 0; sfx.cast();
  }
}
function hint(msg, needTool) { sfx.no(); say(msg, 3); flashTool(needTool); }
function flashTool(t) { const b = document.querySelector(`.tool[data-tool="${t}"]`); if (!b) return; b.classList.add('need'); setTimeout(() => b.classList.remove('need'), 2600); }

function fishPress() {
  if (fs.phase === 'bite') {   // ça mord : on engage le combat (barre de pêche)
    const D = DIFF[level]; fs.phase = 'fight';
    fs.fight = { T: .1, mode: 'rest', mt: 1.1, prog: D.start, t: 0, lost: 0, inZ: false }; sfx.bite(); return;   // tension de la ligne : on tient quand le poisson est fatigué, on relâche quand il tire
  }
  if (fs.phase === 'wait') say('Patience… attends que le poisson morde 🐟', 2);
}
function releaseFish(cool = 4) { if (fs.fish && fs.fish.state !== 'gone') { fs.fish.state = 'swim'; fs.fish.cool = cool; pickTarget(fs.fish); } fs.fish = null; }
function endFishing() { releaseFish(); player.state = 'free'; fs.phase = ''; fs.fight = null; setAnim('idle'); }

function collect(kind, x, y) { inv[kind]++; save(); renderHud(); flyers.push({ kind, x, y: y - 14, t: 0 }); }

/* ----- PNJ ----- */
function talkTo(q) {
  player.state = 'talk'; setAnim('idle');
  const st = qState[q.id], free0 = () => { player.state = 'free'; }, free = q.id === 'toto' ? () => { free0(); setTimeout(askBoat, 60); } : free0;
  const nextQ = QUESTS.find(o => qState[o.id] !== 'done');
  if (!unlocked(q) || (st === 'new' && q !== nextQ)) return openDialog(q.who, chatter(q.npc), free, q.portrait);
  if (st === 'done') return openDialog(q.who, opened[q.id] ? chatter(q.npc) : ['Cherche le buisson qui scintille ✨ ' + (q.where || 'près de moi') + ', Myah !'], free, q.portrait);
  if (st === 'new') {
    return openDialog(q.who, q.start, () => {
      qState[q.id] = 'active'; if (q.tool) flashTool(q.tool); save(); renderHud();
      if (hasAll(q)) setTimeout(() => talkTo(q), 100); else free0();
    }, q.portrait);
  }
  if (hasAll(q)) {
    Object.entries(q.need).forEach(([k, n]) => { inv[k] -= n; });
    qState[q.id] = 'done'; if (level !== 'balade') bonusStar[q.id] = true; save(); renderHud();
    openDialog(q.who, q.done, () => {
      free0(); sfx.unlock(); burst(q.cx, q.cy - 14, 22, ['#ffe27a', '#fff', '#ffc83d'], true);
      floatText(q.cx, q.cy - 34, 'Un buisson scintille !', '#ffe27a'); renderHud();
    }, q.portrait);
  } else openDialog(q.who, q.remind.concat([needStr(q)]), free, q.portrait);
}

/* ----- coffres ----- */
function touchChest(q) {
  if (opened[q.id] || qState[q.id] !== 'done') return;
  if (!q.found) {      // 1er toucher : le buisson frémit et le coffre apparaît
    q.found = true; q.rustle = .7; q.revealAt = time; sfx.unlock(); sfx.chest();
    burst(q.cx, q.cy - 14, 24, FCOLOR[q.fe].concat(['#fff', '#ffe27a']), true); floatText(q.cx, q.cy - 40, 'Un coffre !', '#ffe27a');
    return;
  }
  if (q.reveal < .9) return;
  player.state = 'talk'; setAnim('idle'); q.opening = true; q.chestOpen = 0; sfx.chest(); burst(q.cx, q.cy - 18, 26, FCOLOR[q.fe].concat(['#fff']), true);
}
function finishChest(q) {
  opened[q.id] = true; q.opening = false; q.chestOpen = 1; q.vanishAt = time + 2.4; save(); renderHud();
  const n = nOpened(), lines = [`Tu as trouvé un bouquet de plumes du Cygne légendaire ! (${n}/5) Garde-le précieusement : tu le rendras au Cygne à la fin de l\'aventure.`];
  if (n === 5) lines.push('Les 5 bouquets de plumes sont réunis ! Quelque chose brille du côté de l\'étang…');
  openDialog('Bouquet de plumes', lines, () => { player.state = 'free'; if (n === 5 && phase === 'quests') startReveal(); }, LP());
}

/* ================= cinématiques et Cygne légendaire ================= */
let cine = null;
let swanAlt = 0, swanSparkle = 0, swanFeathers = 0;
const SW_PERCH = .46, SW_MOUNT = .45;

function startReveal() {
  phase = 'reveal'; cine = { kind: 'reveal', t: 0, k: -1 }; swanAlt = 320; swanSparkle = 1; player.state = 'cine'; setAnim('idle');
  $('#veil').classList.add('on'); save();
}
function startReturn() {
  cine = { kind: 'return', t: 0, flights: QUESTS.map((q, i) => ({ i, fe: q.fe, sx: player.x, sy: player.y - 40, done: false })), k: 0 };
  player.state = 'cine'; setAnim('idle'); $('#veil').classList.add('on'); swanSparkle = 1;
}
function updateCine(dt) {
  const c = cine; c.t += dt;
  const px = D.perch[0], py = D.perch[1];
  if (c.kind === 'reveal') {
    c.focus = [px, py - 40];
    const k = Math.floor(c.t);
    if (k !== c.k && c.t >= 1 && c.t < 6) { c.k = k; sfx.reveal(k); }
    if (c.t > .6 && c.t < 5) { for (let i = 0; i < 2; i++) { const a = Math.random() * TAU, r = rnd(20, 90); sparks.push({ x: px + Math.cos(a) * r, y: py - 50 + Math.sin(a) * r * .7, vx: rnd(-10, 10), vy: rnd(-26, -6), t: 0, life: rnd(.8, 1.6), c: ['#fff', '#d9c2ff', '#fff3b0'][(Math.random() * 3) | 0], r: rnd(2, 3.4), star: true, g: -10 }); } }
    swanAlt = c.t < 1 ? 320 : 320 * (1 - ease((c.t - 1) / 3.4));
    swanSparkle = c.t < 5.5 ? 1 : 1 - (c.t - 5.5) * .5;
    if (c.t >= 6.2) {
      cine = null; swanAlt = 0; swanSparkle = .55; phase = 'appeared'; $('#veil').classList.remove('on'); save(); renderHud();
      openDialog('Cygne légendaire', ['Je suis le Cygne légendaire, gardien du lac de l\'île.', 'Mes plumes s\'étaient dispersées… Tu les as toutes retrouvées, petite Myah.', 'Approche-toi du bord de l\'eau, près de moi, et rends-les-moi.'], () => { player.state = 'free'; }, LP());
    }
  } else if (c.kind === 'return') {
    c.focus = [(px + player.x) / 2, py - 30];
    c.flights.forEach(f => {
      const t0 = .3 + f.i * .5, u = (c.t - t0) / 1.1;
      if (u >= 1 && !f.done) { f.done = true; swanFeathers = Math.max(swanFeathers, f.i + 1); sfx.reveal(f.i); burst(px, py - 70, 10, [FCOLOR[f.fe][0], '#fff'], true); }
    });
    swanSparkle = 1;
    if (c.t >= 4.2) {
      cine = null; phase = 'returned'; mountUnlocked = true; swanFeathers = 5; $('#veil').classList.remove('on'); save(); renderHud(); sfx.star(); confetti();
      openDialog('Cygne légendaire', ['Mes plumes brillent de nouveau ! Merci, Myah !', 'Je serai ta monture : sur mon dos, tu pourras voler au-dessus de l\'île, ou flotter sur le lac et sur l\'océan.', 'Appuie sur le bouton 🦢 (ou la touche C) pour m\'appeler. Saute (⤴ ou X) pour voler ou te poser sur l\'eau !'], () => { player.state = 'free'; swanSparkle = .3; $('#win').style.display = 'grid'; }, LP());
    }
  }
}
function talkSwan() {
  player.state = 'talk'; setAnim('idle');
  const free = () => { player.state = 'free'; };
  if (phase === 'appeared') return openDialog('Cygne légendaire', ['Tu as mes 5 bouquets de plumes… Rends-les-moi !'], () => { startReturn(); }, LP());
  openDialog('Cygne légendaire', ['Appelle-moi quand tu veux, Myah : bouton 🦢 ou touche C !'], free, LP());
}

/* ----- monture ----- */
function summon() {
  if (!mountUnlocked || cine || dlg.open) return;
  if (player.mount) return dismount();
  if (player.state !== 'free') return;
  player.mount = isWater(player.x, player.y) && !walkable(player.x, player.y) ? 'float' : 'fly';
  player.alt = player.mount === 'fly' ? 170 : 90; player.altT = player.mount === 'fly' ? 52 : 0;
  sfx.mount(); burst(player.x, player.y - 40, 24, ['#fff', '#d9c2ff', '#fff3b0'], true); setAnim('idle');
  say('Cygne : ⤴ / X pour voler ou flotter, 🦢 / C pour descendre', 4);
}
function dismount() {
  const p = player;
  if (p.mount === 'fly') {
    if (!walkable(p.x, p.y)) { sfx.no(); return say('Pose-toi sur la terre ferme (ou sur l\'eau) pour descendre', 3); }
    p.altT = 0; p.dismounting = true;
  } else {
    const w = nearestWalk(p.x, p.y, 70);
    if (!w) { sfx.no(); return say('Rapproche-toi du rivage pour descendre', 3); }
    leavers.push({ x: p.x, y: p.y, t: 0, dir: p.face, fromPerch: true });
    p.x = w[0]; p.y = w[1]; p.mount = null; p.alt = 0; p.altT = 0; sfx.hop(); setAnim('idle');
  }
}
function toggleFlight() {
  const p = player;
  if (p.mount === 'fly') {
    if (isWater(p.x, p.y)) { p.mount = 'float'; p.altT = 0; sfx.splash(); say('Le cygne flotte sur l\'eau', 2); }
    else { sfx.no(); say('Le cygne ne se pose que sur l\'eau 🌊', 2.5); }
  } else if (p.mount === 'float') { p.mount = 'fly'; p.altT = 52; sfx.mount(); }
}

/* ================= mise à jour ================= */
let lastT = performance.now();
const cam = { x: 0, y: 0, z: 1 };
function camZ(vw, vh) { return 1.3 * Math.max(1.35, Math.min(vh / 335, vw / 225), vw / 580, vw / W); }   // vue un peu plus rapprochée de Myah (+30 %)
let dpr = 1;


/* ----- les PNJ se promènent tranquillement près de chez eux ----- */
const ALLNPC = () => QUESTS.concat(EXTRAS);
ALLNPC().forEach(n => { const kk = n.npc || n.key; n.sprD = NP[kk + '_l'] ? { l: npcSprite(kk + '_l'), r: npcSprite(kk + '_r'), u: npcSprite(kk + '_u') } : null; n.walkPh = 0; n.hx = n.x; n.hy = n.y; n.moving = false; n.vx = 1; n.wait = rnd(1, 6); n.tx = n.x; n.ty = n.y; n.rad = n.final ? 16 : 46; });
function npcPathOk(x0, y0, x1, y1) { const d = dist(x0, y0, x1, y1), n = Math.ceil(d / 4); for (let i = 1; i <= n; i++) { const u = i / n, x = x0 + (x1 - x0) * u, y = y0 + (y1 - y0) * u; if (!walkable(x, y)) return false; } return true; }
function npcPick(n) {   // sprite de face à l'arrêt, de profil / de dos quand il marche
  if (!n.moving || !n.sprD) return n.sprite;
  const dx = n.tx - n.x, dy = n.ty - n.y;
  const sp = Math.abs(dx) >= Math.abs(dy) * .7 ? (dx < 0 ? n.sprD.l : n.sprD.r) : (dy < 0 ? n.sprD.u : n.sprite);
  sp.bob = Math.abs(Math.sin(n.walkPh)) * 1.5; return sp;
}
const NPC_WANDER = true;   // petits trajets autour de chez eux
function updateNpcs(dt) {
  const all = ALLNPC(), p = player;
  for (const n of all) {
    n.sprite.bob = (Math.sin(time * 2.4 + (n.hx || 0) * .37) * .5 + .5) * 1.1;   // petit rebond tranquille à l'arrêt
    if (n.sprD) for (const k in n.sprD) n.sprD[k].bob = 0;
    if (!NPC_WANDER) { n.moving = false; continue; }
    const dp = dist(n.x, n.y, p.x, p.y);
    if (dlg.open || cine || p.state === 'talk' || dp < 52) { n.moving = false; continue; }   // on s'arrête quand Myah approche ou parle
    if (n.moving) {
      const dx = n.tx - n.x, dy = n.ty - n.y, d = Math.hypot(dx, dy);
      if (d < 1.5) { n.moving = false; n.wait = rnd(7, 16); continue; }
      const st = Math.min(d, 6.3 * dt), nx = n.x + dx / d * st, ny = n.y + dy / d * st;
      if (!walkable(nx, ny) || all.some(o => o !== n && dist(nx, ny, o.x, o.y) < 16) || dist(nx, ny, p.x, p.y) < 22) { n.moving = false; n.wait = rnd(1, 3); continue; }
      n.walkPh += st / 9 * Math.PI; n.x = nx; n.y = ny; if (Math.abs(dx) > .5) n.vx = dx;
    } else {
      n.wait -= dt; if (n.wait > 0) continue;
      n.wait = rnd(7, 15);
      if (Math.random() < .5) continue;   // parfois il reste simplement sur place
      for (let k = 0; k < 10; k++) {
        const a = Math.random() * TAU, r = rnd(10, Math.min(n.rad, 26)), tx = n.hx + Math.cos(a) * r, ty = n.hy + Math.sin(a) * r * .7;
        if (!walkable(tx, ty) || (WIDE && !cell(WIDE, tx, ty)) || !npcPathOk(n.x, n.y, tx, ty)) continue;   // jamais dans un passage étroit
        if (QUESTS.some(q => dist(tx, ty, q.cx, q.cy) < 26) || all.some(o => o !== n && dist(tx, ty, o.x, o.y) < 24)) continue;
        n.tx = tx; n.ty = ty; n.moving = true; break;
      }
    }
  }
}

/* ================= intérieur de la maison de Myah ================= */
// porte = haut de l'escalier de la maison (près de Miraaï) ; il suffit de s'en approcher
const imgIn = new Image(); imgIn.src = 'assets/interieur2.jpg';
const imgSdb = new Image(); imgSdb.src = 'assets/sdb_ferme.png';   // la salle de bain fermée (murs en bambou et porte) : elle s'ouvre quand Myah s'en approche ou y est
const SDB_BOX = [764, 282];
const sdbLine = x => x <= 1094 ? 557 + (x - 772) * .375 : 678 - (x - 1094) * .497;   // le bas des murs de la salle de bain
const DK_UP = .72;   // à l'étage le bas est assombri (pas tout noir)
const DARK_LOW = [[0,342],[367,262],[594,334],[690,303],[755,301],[850,354],[1022,283],[1275,358],[1375,358],[1375,768],[0,768]];   // tout ce qui est sous l'étage, échelle comprise : assombri quand Myah est en haut, s'éclaircit quand elle descend
const SDB_TRIG = [752, 588, 15];   // point de déclenchement : en bas de l'échelle, tout contre la chaise (rayon ≈ 0,5 cm)
const sdbNear = () => {
  if (IN.floor !== 0 || SC !== SC_HOME) { IN.sdbOn = false; IN.sdbOff = 0; return false; }
  const nearP = Math.hypot(IN.x - SDB_TRIG[0], IN.y - SDB_TRIG[1]) < SDB_TRIG[2];
  const inGate = IN.x > 735 && IN.x < 870 && IN.y > 548 && IN.y < 612;                 // le passage entre la chaise et l'entrée
  const inBath = IN.x >= 782 && IN.x < 1290 && IN.y < sdbLine(IN.x) + 4;                // dans la salle de bain
  const inCorner = IN.x > 1040 && IN.x < 1290 && IN.y > sdbLine(IN.x) - 90 && IN.y < sdbLine(IN.x) + 90;   // l'angle avant-droit de la salle de bain (près du poteau) : elle reste ouverte pour que Myah ne soit jamais coincée
  const want = nearP || inCorner || (!!IN.sdbOn && (inGate || inBath));
  if (want) { IN.sdbOn = true; IN.sdbOff = 0; }
  else if (IN.sdbOn) { if (!IN.sdbOff) IN.sdbOff = IN.t + 20; if (IN.t >= IN.sdbOff) { IN.sdbOn = false; IN.sdbOff = 0; } }   // on sort : le passage reste ouvert encore 20 s avant de se refermer
  return IN.sdbOn;
};
const imgMus = new Image(); imgMus.src = 'assets/musee.jpg';
const imgCare = new Image(); imgCare.src = 'assets/soin2.jpg';
const imgHall = new Image(); imgHall.src = 'assets/mairie3.jpg';
const imgObs = new Image(); imgObs.src = 'assets/observatoire.jpg';
const imgBoat = new Image(); imgBoat.src = 'assets/bateau.jpg';
const fadeEl = $('#fade');
const IN = { on: false, busy: false, cool: 0, near: 0, x: 440, y: 1000, floor: 0, prevTool: 'none', t: 0, lie: null };
const imgLie = new Image(); imgLie.src = 'assets/myah/lie.png'; const imgLieW = new Image(); imgLieW.src = 'assets/myah/lie_wings.png';   // Myah allongée sous son drap (tête et bras dehors)
// lit superposé de la maison (coordonnées de l'image de l'étage) : tête sur l'oreiller, corps le long du lit
const LAD_SPOT = [765, 286], LAD_TOP = [772, 118];   // pied de l'échelle du lit superposé (couchette du haut)
const RAILS = [[[372,181.0],[596,251.3],[596,260.3],[372,190.0]],[[390.8,194.9],[397.2,196.9],[397.2,234.9],[390.8,234.9]],[[411.2,201.3],[417.6,203.3],[417.6,241.3],[411.2,241.3]],[[431.6,207.7],[438.0,209.7],[438.0,247.7],[431.6,247.7]],[[452.0,214.1],[458.4,216.1],[458.4,254.1],[452.0,254.1]],[[472.4,220.5],[478.8,222.5],[478.8,260.5],[472.4,260.5]],[[492.8,226.9],[499.2,228.9],[499.2,266.9],[492.8,266.9]],[[513.2,233.3],[519.6,235.3],[519.6,273.3],[513.2,273.3]],[[533.6,239.7],[540.0,241.8],[540.0,279.7],[533.6,279.7]],[[554.0,246.1],[560.4,248.2],[560.4,286.2],[554.0,286.2]],[[574.4,252.6],[580.8,254.6],[580.8,292.6],[574.4,292.6]],[[596,252.0],[692,219.4],[692,228.4],[596,261.0]],[[611.8,254.6],[618.2,252.5],[618.2,292.5],[611.8,292.5]],[[632.8,247.5],[639.2,245.3],[639.2,285.4],[632.8,285.4]],[[654.8,240.0],[661.2,237.8],[661.2,277.9],[654.8,277.9]],[[676.8,232.5],[683.2,230.4],[683.2,270.4],[676.8,270.4]],[[762,236.0],[852,269.0],[852,278.0],[762,245.0]],[[761.8,243.9],[768.2,246.3],[768.2,284.1],[761.8,284.1]],[[781.8,251.3],[788.2,253.6],[788.2,291.4],[781.8,291.4]],[[802.8,259.0],[809.2,261.3],[809.2,299.1],[802.8,299.1]],[[823.8,266.7],[830.2,269.0],[830.2,306.9],[823.8,306.9]],[[844.8,274.4],[851.2,276.7],[851.2,314.6],[844.8,314.6]],[[852,265.0],[1013,205.8],[1013,214.8],[852,274.0]],[[865.8,267.9],[872.2,265.6],[872.2,305.7],[865.8,305.7]],[[886.3,260.4],[892.7,258.0],[892.7,298.2],[886.3,298.2]],[[906.8,252.8],[913.2,250.5],[913.2,290.7],[906.8,290.7]],[[926.8,245.5],[933.2,243.1],[933.2,283.3],[926.8,283.3]],[[946.8,238.1],[953.2,235.8],[953.2,275.9],[946.8,275.9]],[[967.3,230.6],[973.7,228.2],[973.7,268.4],[967.3,268.4]],[[987.3,223.2],[993.7,220.9],[993.7,261.0],[987.3,261.0]]];   // rambardes de l'étage (devant Myah)
const BED_SPOT = [838, 288], BED_ANG = -69 * Math.PI / 180;
const SLEEP = { top: { box: [752, 30, 270, 252] }, bottom: { box: [752, 30, 270, 252] } };   // illustrations de Myah endormie : emplacement dans le décor
Object.keys(SLEEP).forEach(k => { SLEEP[k].img = new Image(); SLEEP[k].img.src = 'assets/sleep_' + k + '.jpg'; });
const imgSleep = new Image(); imgSleep.src = 'assets/myah/sleep_side.png'; const SLP = { w: 150, dx: 14, dy: -22, rot: .24 };
let bedAsk = 'bottom';
const BEDS = { top: { head: [802, 84], k: .95 }, bottom: { head: [802, 186], k: .95 } };
const imgShower = new Image(); imgShower.src = 'assets/myah/bath_shower.png';   // dessin de Myah sans lunettes pour se laver
const imgShowerHair = new Image(); imgShowerHair.src = '';   // masque des cheveux, pour les recolorer
const showerCache = {};
function showerSprite() {   // le dessin de la douche, avec les cheveux de la couleur choisie dans la valise
  const c = outfit.hair; if (!c || !imgShower.naturalWidth || !imgShowerHair.naturalWidth) return imgShower;
  const key = Math.round(c.h) + ',' + Math.round(c.s * 100) + ',' + Math.round(c.l * 100); if (showerCache[key]) return showerCache[key];
  const w = imgShower.naturalWidth, h = imgShower.naturalHeight, cv = document.createElement('canvas'); cv.width = w; cv.height = h; const x = cv.getContext('2d'), L = document.createElement('canvas'); L.width = w; L.height = h; const lx = L.getContext('2d');
  x.drawImage(imgShower, 0, 0);
  lx.drawImage(imgShower, 0, 0); lx.globalCompositeOperation = 'destination-in'; lx.drawImage(imgShowerHair, 0, 0);
  x.globalCompositeOperation = 'destination-out'; x.drawImage(imgShowerHair, 0, 0);
  lx.globalCompositeOperation = 'color'; lx.fillStyle = hslStr(c); lx.fillRect(0, 0, w, h);
  lx.globalCompositeOperation = 'lighter'; lx.fillStyle = 'hsl(' + Math.round(c.h) + ',' + Math.round(c.s * 90) + '%,' + Math.round(c.l * 52) + '%)'; lx.fillRect(0, 0, w, h);
  lx.globalCompositeOperation = 'destination-in'; lx.drawImage(imgShowerHair, 0, 0);
  x.globalCompositeOperation = 'source-over'; x.drawImage(L, 0, 0);
  showerCache[key] = cv; return cv;
}
const FOAM = [[352,64,50],[318,92,44],[388,92,44],[352,112,56],[296,128,40],[410,128,40],[330,150,38],[376,150,38],[352,160,34],[282,166,32],[424,166,32],[278,200,26],[430,200,26],[300,110,30],[404,110,30],[352,38,30],[330,60,26],[376,62,26],[266,150,24],[440,150,24]];   // mousse sur les cheveux (px du dessin)
const SHOWER_BOX_PX = 246; const SHOWER_BOX = [902.4, 404.7, 85.3, 112.3];   // illustration de Myah sous la douche (dessin fourni)
const SHOWER = { x: 945, y: 517, head: [948, 376], r: 55 };   // douche : Myah se place sur la bonde, l'eau tombe de la pomme
const bedPickOpen = () => $('#bedPick').style.display === 'grid';
const SC_HOME = {
  img: imgIn, W: 1375, H: 768, K: 3.5, spd: .9,
  floors: [   // rez-de-chaussée, puis plancher de l'étage
    [[135, 585], [450, 520], [772, 462], [777, 552], [940, 474], [960, 470], [1100, 505], [1240, 585], [1225, 610], [1000, 708], [700, 748], [560, 755], [400, 742], [135, 605]],
    [[385, 200], [450, 165], [690, 197], [790, 197], [1015, 215], [1020, 285], [850, 326], [775, 312], [700, 306], [692, 268], [612, 288], [596, 291], [391, 231]],   // le bord avant suit le pied des barreaux : Myah touche le plancher le long de la rambarde
  ],
  exit: [715, 740], ladder: [[722, 592], [722, 292]],
  blocks: [   // poêle, plan de travail, tables basses, canapés, table et chaises, meuble de la salle de bain, toilettes
    [[108, 585], [110, 500], [240, 470], [290, 520], [262, 585], [190, 618]],
    [[240, 548], [262, 490], [345, 500], [350, 545], [300, 575]],
    [[411, 634], [460, 614], [538, 650], [541, 656], [525, 662], [500, 668], [488, 676], [472, 668], [414, 650]],
    [[452, 519], [663, 595], [605, 655], [462, 592]],   // canapé du milieu : seulement son pied au sol (Myah peut passer derrière ; le dossier est redessiné devant elle)
    [[295, 616], [345, 608], [470, 660], [518, 678], [508, 730], [400, 724], [300, 664]],
    [[766, 604], [860, 598], [1005, 600], [1005, 650], [965, 742], [850, 732], [780, 742], [766, 690]],
    [[1055, 520], [1100, 500], [1160, 515], [1160, 565], [1110, 575], [1060, 565]],
    [[1165, 520], [1235, 520], [1240, 580], [1200, 598], [1165, 585]],
  ],
  walls: [   // murs de la salle de bain : ils bloquent tant qu'elle est fermée
    [[758, 470], [782, 470], [782, 566], [758, 566]],
    [[772, 548], [1094, 664], [1094, 694], [772, 574]],
    [[1094, 664], [1272, 576], [1272, 604], [1094, 694]],
  ],
  blocks1: [   // étage : grand lit, lit superposé, coffre
    [[425, 175], [560, 150], [700, 205], [700, 245], [640, 262], [560, 240], [470, 215]],
    [[752, 195], [935, 200], [938, 262], [760, 256]],
    [[905, 225], [985, 230], [985, 272], [910, 272]],
  ],
  npc: { x: 360, y: 568, r: 58, get: () => MAN },
  holes: [[686, 90, 32.5, 31.5], [972, 144, 8.5, 22.5], [259, 155.5, 25.5, 33], [1109, 171.5, 25.5, 33]], sky: [300, 0, 760, 175, 200, 40, 1000, 230],
};
const SC_MUS = {
  img: imgMus, W: 768, H: 1024, K: 3.2,
  floors: [
    [[300, 590], [500, 590], [600, 640], [640, 700], [660, 780], [620, 830], [480, 835], [452, 845], [452, 960], [345, 960], [332, 845], [300, 835], [170, 830], [140, 780], [160, 700], [200, 640]],
    [[268, 384], [335, 374], [465, 374], [532, 384], [515, 410], [400, 428], [285, 410]],
  ],
  blocks: [   // meubles : Myah ne peut pas les traverser
    [[360, 705], [430, 705], [430, 750], [360, 750]],                                  // socle central
    [[225, 665], [290, 605], [345, 600], [345, 645], [290, 695], [230, 690]],          // vitrines du cercle intérieur
    [[227, 700], [300, 695], [332, 730], [332, 790], [290, 810], [235, 780]],
    [[462, 600], [575, 640], [575, 690], [505, 690], [462, 650]],
    [[473, 745], [577, 690], [580, 770], [540, 810], [473, 790]],
    [[57, 700], [143, 687], [143, 790], [75, 803]],                                    // vitrines du pourtour
    [[643, 700], [727, 687], [727, 790], [660, 807]],
    [[133, 800], [280, 780], [280, 880], [160, 910]],
    [[510, 800], [653, 783], [653, 860], [530, 893]],
    [[72, 650], [130, 575], [197, 575], [197, 650], [110, 707]],
    [[495, 692], [548, 692], [548, 718], [495, 718]],                                  // Yurii
  ],
  gate: [[293, 775, 205, 62], [305, 833, 22, 155], [455, 833, 28, 155]],                 // portique : Myah passe derrière quand elle est à l'intérieur
  exit: [400, 945], ladder: [[397, 594], [397, 414]],
  holes: [[283, 458, 24, 24], [67, 575, 13, 27], [718, 575, 13, 27]], sky: [300, 0, 700, 190, 30, 420, 720, 200],
  npc: { x: 520, y: 705, get: () => JUL },
};
const SC_CARE = {   // le poste de soin : petite maison au toit de chaume, à côté de la mairie (Lulia)
  img: imgCare, W: 896, H: 1195, K: 3.6,
  floors: [
    [[175, 805], [230, 745], [300, 712], [440, 700], [470, 690], [620, 770], [720, 830], [745, 860], [745, 985], [700, 1000], [560, 1000], [440, 1000], [300, 950], [200, 880]],
    [[0, 0], [1, 0], [1, 1]],   // pas d'étage accessible
  ],
  blocks: [
    [[165, 830], [290, 830], [295, 935], [165, 935]],                                    // chaise gauche
    [[300, 900], [430, 880], [435, 1000], [300, 1000]],                                  // chaise et caisses
    [[360, 830], [450, 795], [505, 830], [505, 885], [430, 910], [360, 880]],            // table basse
    [[465, 690], [545, 620], [780, 690], [780, 860], [710, 880], [610, 860], [500, 780]], // lit et paravents
    [[740, 720], [830, 700], [830, 790], [745, 800]],                                    // table de chevet
    [[555, 930], [640, 910], [645, 985], [560, 995]],                                    // carton
  ],
  exit: [715, 975], ladder: [[-999, -999], [-999, -999]],
  holes: [], sky: [330, 0, 560, 470, 150, 140, 620, 520],
  npc: { x: 330, y: 800, get: () => LUL },
};
const MAI = EXTRAS.find(e => e.key === 'maima'); MAI.x = MAI.y = -999;   // Maïmaï, la cheffe, travaille à la mairie
const SC_HALL = Object.assign({}, SC_CARE, {   // la mairie / maison d'accueil (maison au toit rose) : Maïmaï derrière son comptoir
  img: imgHall,
  floors: [
    [[165, 810], [215, 745], [290, 700], [400, 690], [470, 685], [625, 765], [725, 825], [750, 860], [750, 990], [705, 1005], [560, 1005], [440, 1005], [300, 960], [190, 890]],
    [[0, 0], [1, 0], [1, 1]],
  ],
  blocks: [
    [[165, 830], [290, 830], [295, 935], [165, 935]],                                    // chaise gauche
    [[300, 900], [430, 880], [435, 1000], [300, 1000]],                                  // chaise et caisses
    [[360, 830], [450, 795], [505, 830], [505, 885], [430, 910], [360, 880]],            // table basse
    [[370, 640], [450, 420], [585, 430], [585, 700], [480, 735], [390, 715]],            // escalier
    [[470, 670], [560, 640], [695, 715], [695, 800], [600, 845], [480, 785]],            // comptoir
    [[740, 690], [860, 690], [860, 860], [745, 870]],                                    // vitrines
    [[555, 930], [640, 910], [645, 985], [560, 995]],                                    // carton
  ],
  npc: { x: 625, y: 690, r: 200, get: () => MAI },
});
/* ----- l'observatoire : les ouvertures vertes de l'image sont remplacées par un vrai ciel qui suit l'heure ----- */
const SC_OBS = Object.assign({}, SC_CARE, {
  img: imgObs, W: 896, H: 1200, K: 4.4, spd: .95, chroma: true, npc: null,
  floors: [
    [[50, 885], [330, 668], [600, 672], [850, 882], [600, 1015], [300, 1015]],
    [[0, 0], [1, 0], [1, 1]],
  ],
  blocks: [
    [[45, 780], [255, 770], [255, 880], [215, 950], [130, 940], [50, 905]],           // plantes et télescope de gauche
    [[240, 852], [345, 857], [352, 960], [300, 1012], [250, 1000], [240, 940]],        // grand pot de fougère
    [[235, 690], [330, 680], [335, 745], [245, 748]],                                  // tabouret de bambou
    [[665, 815], [700, 735], [800, 705], [866, 715], [866, 900], [785, 935], [730, 930], [735, 860], [700, 835]],   // télescope et plantes de droite
    [[630, 690], [695, 690], [700, 760], [640, 760]],                                  // pot de plante
  ],
  exit: [450, 1005], ladder: [[-999, -999], [-999, -999]], holes: [], sky: [0, 0, 1, 1, 0, 0, 1, 1],
});
const SC_BOAT = Object.assign({}, SC_CARE, {   // le pont du bateau amarré au ponton
  img: imgBoat, W: 1200, H: 896, K: 5, spd: .95, chroma: true, ckG: 110, ckLo: 38, ckSpan: 45, npc: null,
  floors: [
    [[255, 600], [330, 520], [480, 420], [650, 335], [800, 245], [940, 262], [1075, 330], [1085, 430], [960, 560], [830, 672], [640, 765], [450, 775], [310, 715]],
    [[0, 0], [1, 0], [1, 1]],
  ],
  blocks: [
    [[235, 440], [335, 400], [440, 440], [440, 520], [360, 590], [240, 560]],           // pile de caisses
    [[430, 330], [490, 335], [490, 410], [430, 415]],                                   // tonneau
    [[645, 420], [722, 420], [728, 478], [650, 488]],                                   // pied du mât
    [[715, 355], [885, 335], [935, 395], [865, 455], [770, 455], [715, 425]],           // écoutille et escalier
    [[722, 595], [850, 572], [930, 610], [930, 680], [800, 702], [722, 672]],           // caisses de droite
    [[605, 700], [720, 682], [742, 742], [655, 772], [610, 760]],
    [[360, 680], [425, 678], [428, 745], [365, 750]],                                   // bitte d'amarrage
  ],
  exit: [470, 800], ladder: [[-999, -999], [-999, -999]], holes: [], sky: [0, 0, 1, 1, 0, 0, 1, 1],
});
const imgCabin = new Image(); imgCabin.src = 'assets/cabine.jpg';
const SC_CABIN = Object.assign({}, SC_CARE, {   // la cabine du bateau
  img: imgCabin, W: 1198, H: 896, K: 5, spd: .95, chroma: true, ckG: 110, ckLo: 38, ckSpan: 45, npc: null,
  floors: [
    [[215, 705], [300, 632], [440, 548], [560, 525], [640, 565], [740, 620], [880, 668], [900, 725], [800, 792], [640, 846], [430, 822], [300, 770]],
    [[0, 0], [1, 0], [1, 1]],
  ],
  blocks: [
    [[160, 520], [300, 490], [395, 480], [430, 490], [430, 600], [290, 692], [168, 642]],   // bureau et caisse
    [[395, 500], [458, 492], [458, 590], [400, 590]],                                          // tonneau
  ],
  exit: [660, 705], ladder: [[-999, -999], [-999, -999]], holes: [], sky: [0, 0, 1, 1, 0, 0, 1, 1],
});
const HATCH_SPOT = [800, 492];
const nearHatch = () => SC === SC_BOAT && IN.floor === 0 && dist(IN.x, IN.y, HATCH_SPOT[0], HATCH_SPOT[1]) < 42;
function goScene(sc, x, y) { swapScene(() => { setScene(sc); IN.floor = 0; IN.camY = null; IN.dk = null; IN.zs = null; IN.x = x; IN.y = y; IN.cool = 1; player.dir4 = sc === SC_CABIN ? 'down' : 'up'; sfx.hop && sfx.hop(); }); }
function askHatch(force) { if (bedPickOpen() || IN.busy || (!force && IN.askH && IN.t < IN.askH)) return; bedAsk = 'cabin'; $('#bedPickT').textContent = 'Cabine'; $('#bedPickP').textContent = 'Veux-tu descendre dans la cabine ?'; $('#bedPick').style.display = 'grid'; }
const OBS_SKY = {   // [haut du ciel, bas du ciel, force des étoiles, mer]
  map: [[96, 196, 245], [205, 238, 251], 0, [38, 150, 190]],
  mapx_apm: [[126, 190, 230], [246, 222, 160], 0, [60, 150, 170]],
  mapx_coucher: [[90, 74, 154], [255, 150, 90], .12, [120, 80, 110]],
  mapx_nuit: [[4, 14, 46], [26, 48, 110], 1, [8, 34, 86]],
  mapx_lever: [[138, 154, 208], [255, 190, 190], .2, [150, 130, 170]],
};
const OBS_STARS = Array.from({ length: 150 }, () => [Math.random() * 896, Math.random() * 500, Math.random() * 1.5 + .6, Math.random() * 6]);
function drawObsSky() {
  const ds = dayState(), A = OBS_SKY[ds.A.n] || OBS_SKY.map, B = OBS_SKY[ds.B.n] || A, u = ds.u, mix = (a, b) => a + (b - a) * u;
  const col = i => 'rgb(' + [0, 1, 2].map(k => Math.round(mix(A[i][k], B[i][k]))).join(',') + ')', hz = 520;
  let g = ctx.createLinearGradient(0, 0, 0, hz); g.addColorStop(0, col(0)); g.addColorStop(1, col(1)); ctx.fillStyle = g; ctx.fillRect(0, 0, IN_W, hz);
  const st = mix(A[2], B[2]);
  if (st > .01) {
    ctx.save(); const mg = ctx.createRadialGradient(650, 290, 6, 650, 290, 90); mg.addColorStop(0, 'rgba(255,250,220,' + st + ')'); mg.addColorStop(1, 'rgba(255,250,220,0)'); ctx.fillStyle = mg; ctx.fillRect(540, 180, 220, 220);
    ctx.globalAlpha = st; ctx.fillStyle = '#fffbe6'; ctx.beginPath(); ctx.arc(650, 290, 26, 0, TAU); ctx.fill();
    for (const s of OBS_STARS) { ctx.globalAlpha = st * (.35 + .65 * Math.max(0, Math.sin(IN.t * 1.6 + s[3]))); ctx.fillStyle = '#fff'; ctx.fillRect(s[0], s[1], s[2], s[2]); } ctx.restore();
  }
  g = ctx.createLinearGradient(0, hz, 0, IN_H); const sc = i => Math.round(mix(A[3][i], B[3][i])); g.addColorStop(0, 'rgb(' + sc(0) + ',' + sc(1) + ',' + sc(2) + ')'); g.addColorStop(1, 'rgb(' + Math.round(sc(0) * .6) + ',' + Math.round(sc(1) * .6) + ',' + Math.round(sc(2) * .7) + ')'); ctx.fillStyle = g; ctx.fillRect(0, hz, IN_W, IN_H - hz);
  ctx.save(); ctx.strokeStyle = 'rgba(255,255,255,.35)'; ctx.lineWidth = 2; for (let i = 0; i < 14; i++) { const x = (i * 97 + IN.t * 8 * (1 + i % 3)) % (IN_W + 30) - 12, y = hz + 12 + (i * 41) % 120; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 18, y); ctx.stroke(); } ctx.restore();
}
function chromaCanvas(sc) {   // transforme le vert pur de l'image en transparence
  if (sc._cc) return sc._cc; const im = sc.img; if (!im.complete || !im.naturalWidth) return null;
  const c = document.createElement('canvas'); c.width = im.naturalWidth; c.height = im.naturalHeight; const x = c.getContext('2d'); x.drawImage(im, 0, 0);
  const d = x.getImageData(0, 0, c.width, c.height), p = d.data;
  for (let i = 0; i < p.length; i += 4) {
    const r = p[i], gg = p[i + 1], b = p[i + 2];
    if (gg > (sc.ckG || 150)) { const k = gg - Math.max(r, b), k0 = sc.ckLo || 70; if (k > k0) { const a = 1 - Math.min(1, (k - k0) / (sc.ckSpan || 80)); p[i + 3] = Math.round(255 * a); if (a > 0) p[i + 1] = Math.round(Math.max(r, b) + (gg - Math.max(r, b)) * .25); } }
  }
  x.putImageData(d, 0, 0); return (sc._cc = c);
}


/* ================= peinture libre (le coffre près du lit superposé) ================= */
const PAINT_SPOT = [945, 292], PAINT_KEY = SAVE_KEY + '-paintings';
const nearPaint = () => SC === SC_HOME && IN.floor === 1 && !IN.lie && !IN.bunk && dist(IN.x, IN.y, PAINT_SPOT[0], PAINT_SPOT[1]) < 34 / (IN.zs || 1);
const paintOpen = () => $('#paint').style.display === 'block';
const PAINT_COLS = ['#f9a8c9', '#ffb5a7', '#ffd6a5', '#fdf0a6', '#c8f0b0', '#a8e6cf', '#a8dcf0', '#b8c8f8', '#d4b8f4', '#f4b8e4', '#e8d8c0', '#d9d9e3'];   // pastels
const PNT = { paper: '#ffffff', col: '#e8332b', mode: 'brush', model: null, jit: 0, size: 10, erase: false, down: false, lx: 0, ly: 0, gal: [], hangImg: null };
try { PNT.gal = JSON.parse(localStorage.getItem(PAINT_KEY) || '[]') || []; } catch (e) { PNT.gal = []; }
function paintSaveGal() { try { localStorage.setItem(PAINT_KEY, JSON.stringify(PNT.gal)); } catch (e) {} paintLoadHung(); }
// ===== cadres aux murs de la maison : un cadre de chaque forme, on y accroche les dessins =====
const HANG_SHAPE = { coeur: { w: 140, h: 132, o: [19, 21, 121, 108] }, portrait: { w: 122, h: 140, o: [27, 27, 95, 113] }, paysage: { w: 143, h: 123, o: [26, 27, 117, 94] }, ovale: { w: 105, h: 138, o: [19, 20, 87, 118] }, rond: { w: 134, h: 124, o: [20, 20, 115, 104] } };
const HANG_SLOTS = [   // zones des murs : le centre du cadre se glisse dans [x0, y0, x1, y1] (image de la maison, 1375 × 768) ; floor = étage où Myah doit se trouver
  { id: 'lit', name: 'Au-dessus du grand lit', floor: 1, z: [430, 72, 540, 118], ds: 'portrait' },
  { id: 'm1', name: 'Le salon, mur du fond', floor: 0, z: [398, 308, 438, 352], ds: 'ovale' },
  { id: 'm2', name: 'Le salon, près de la cuisine', floor: 0, z: [326, 322, 354, 388], ds: 'coeur' },
  { id: 'mur', name: "Le mur de l'étage", floor: 0, z: [228, 208, 342, 246], ds: 'paysage' },
  { id: 'sdb', name: 'La salle de bain', floor: 0, z: [1192, 322, 1258, 372], ds: 'rond' },
];
HANG_SHAPE.coeur.dy = -4; HANG_SHAPE.ovale.dy = -.5;
const HANG_W = { coeur: 52, portrait: 50, paysage: 56, ovale: 42, rond: 46 };
for (const k in HANG_SHAPE) { const S = HANG_SHAPE[k]; S.f = new Image(); S.m = new Image(); S.f.src = 'assets/cadres/' + k + '.png'; S.m.src = 'assets/cadres/' + k + '_m.png'; S.f.onload = S.m.onload = () => { if (PNT.gal && PNT.gal.length) paintLoadHung(); }; }
PNT.hang = {};
const hangZone = id => HANG_SLOTS.find(s => s.id === id);
function frameCompose(im, shape) {   // le dessin, découpé dans la forme du cadre, avec le cadre par-dessus (null tant que les images ne sont pas chargées)
  const S = HANG_SHAPE[shape]; if (!S || !(S.f.complete && S.f.naturalWidth && S.m.complete && S.m.naturalWidth) || !im.naturalWidth) return null;
  const K = 2, c = document.createElement('canvas'); c.width = S.w * K; c.height = S.h * K; const x = c.getContext('2d'), o = S.o, ow = o[2] - o[0], oh = o[3] - o[1], cx = o[0] + ow / 2, cy = o[1] + oh / 2 + (S.dy || 0), k = Math.max((ow + 8) / im.naturalWidth, (oh + 8) / im.naturalHeight) * 1.02;
  { const t = document.createElement('canvas'); t.width = t.height = 1; const tx = t.getContext('2d'); let bg = '#fff'; try { const W = im.naturalWidth, H = im.naturalHeight; tx.drawImage(im, 0, 0, W, H, 0, 0, 1, 1); /* moyenne = repli */ const pts = [[4, 4], [W - 5, 4], [4, H - 5], [W - 5, H - 5], [W / 2, 4], [W / 2, H - 5], [4, H / 2], [W - 5, H / 2]], cs = []; for (const q of pts) { tx.clearRect(0, 0, 1, 1); tx.drawImage(im, q[0], q[1], 1, 1, 0, 0, 1, 1); const d = tx.getImageData(0, 0, 1, 1).data; cs.push([d[0], d[1], d[2]]); } cs.sort((a, b) => (a[0] + a[1] + a[2]) - (b[0] + b[1] + b[2])); const m = cs[cs.length >> 1]; bg = 'rgb(' + m[0] + ',' + m[1] + ',' + m[2] + ')'; } catch (e) {} x.fillStyle = bg; x.fillRect(0, 0, c.width, c.height); }
  x.drawImage(im, (cx - im.naturalWidth * k / 2) * K, (cy - im.naturalHeight * k / 2) * K, im.naturalWidth * k * K, im.naturalHeight * k * K);
  x.globalCompositeOperation = 'destination-in'; x.drawImage(S.m, 0, 0, c.width, c.height); x.globalCompositeOperation = 'source-over'; x.drawImage(S.f, 0, 0, c.width, c.height); return c;
}
function paintLoadHung() {
  PNT.gal.forEach(p => { if (p.hung === true) p.hung = 'lit'; if (p.hung && !hangZone(p.hung)) p.hung = false; if (p.hung) { const z = hangZone(p.hung); if (!HANG_SHAPE[p.hs]) p.hs = z.ds; if (!isFinite(p.hx)) { p.hx = (z.z[0] + z.z[2]) / 2; p.hy = (z.z[1] + z.z[3]) / 2; } } });
  PNT.hang = {};
  for (const s of HANG_SLOTS) {
    const p = PNT.gal.find(q => q.hung === s.id); if (!p) continue;
    const im = new Image();
    im.onload = () => { const c = frameCompose(im, p.hs); if (!c) { setTimeout(() => { if (PNT.gal.includes(p) && p.hung === s.id) paintLoadHung(); }, 400); return; } PNT.hang[s.id] = { c, x: p.hx, y: p.hy, w: HANG_W[p.hs] * (p.hz || 1), r: p.hr || 0 }; };
    im.src = p.d;
  }
  PNT.hangImg = null;
}
paintLoadHung();
function hangDraw(x, o) { const c = o.c, w = o.w, h = w * c.height / c.width; x.save(); x.translate(o.x, o.y); if (o.r) x.rotate(o.r * Math.PI / 180); x.shadowColor = 'rgba(40,25,10,.45)'; x.shadowBlur = 4; x.shadowOffsetY = 1.5; x.drawImage(c, -w / 2, -h / 2, w, h); x.restore(); }
function drawHungFrames() { for (const id in PNT.hang) hangDraw(ctx, PNT.hang[id]); }
const nearHang = () => SC === SC_HOME && IN.on ? HANG_SLOTS.find(s => s.floor === IN.floor && Math.abs(IN.x - (s.z[0] + s.z[2]) / 2) < 70 && !(s.id === 'sdb' && IN.shower)) : null;
const HE = { z: null, sel: -1, shape: 'portrait', x: 0, y: 0, sc: 1, rot: 0, cache: {} };
function hangEdOpen(z) {
  if (!PNT.gal.length) { say('Fais d\'abord un dessin ou un coloriage (🎨 mini-jeux) pour l\'accrocher ici !', 4); return; }
  let box = document.getElementById('hangEd'); if (!box) { box = document.createElement('div'); box.id = 'hangEd'; document.body.appendChild(box); }
  const cur = PNT.gal.findIndex(p => p.hung === z.id); HE.z = z; HE.sel = cur >= 0 ? cur : 0; HE.cache = {};
  const p0 = PNT.gal[HE.sel]; HE.shape = cur >= 0 ? p0.hs : z.ds; HE.sc = cur >= 0 ? (p0.hz || 1) : 1; HE.rot = cur >= 0 ? (p0.hr || 0) : 0; HE.x = cur >= 0 ? p0.hx : (z.z[0] + z.z[2]) / 2; HE.y = cur >= 0 ? p0.hy : (z.z[1] + z.z[3]) / 2;
  box.innerHTML = '<div class="hc"><div class="hr hb"><button class="ok" id="heOk">✔ Valider</button><button id="heOff">🗑 Supprimer</button><button id="heNo">✖ Annuler</button></div><p>Glisse le cadre sur le mur, puis valide.</p><canvas id="heCv" width="560" height="320"></canvas>'
    + '<div class="hr" id="heTh">' + PNT.gal.map((p, i) => '<button data-i="' + i + '"><img src="' + p.d + '" alt=""></button>').join('') + '</div>'
    + '<div class="hr" id="heSh">' + Object.keys(HANG_SHAPE).map(k => '<button data-k="' + k + '"><img src="assets/cadres/' + k + '.png" alt=""></button>').join('') + '<button data-z="-">−</button><button data-z="+">+</button><button data-r="-" title="tourner à gauche">⟲</button><button data-r="+" title="tourner à droite">⟳</button></div>'

  box.style.display = 'flex'; hangEdDraw(); hangEdSel();
  const cv = $('#heCv'), V = () => hangEdView(), at = e => { const r = cv.getBoundingClientRect(), v = V(); return [v.x0 + (e.clientX - r.left) / r.width * v.w, v.y0 + (e.clientY - r.top) / r.height * v.h]; };
  const mv = e => { const [x, y] = at(e), zz = HE.z.z; HE.x = clamp(x, zz[0], zz[2]); HE.y = clamp(y, zz[1], zz[3]); hangEdDraw(); };
  let dn = false; cv.onpointerdown = e => { dn = true; try { cv.setPointerCapture(e.pointerId); } catch (er) {} mv(e); }; cv.onpointermove = e => { if (dn) mv(e); }; cv.onpointerup = cv.onpointercancel = () => { dn = false; };
  $('#heTh').onclick = e => { const b = e.target.closest('button'); if (!b) return; HE.sel = +b.dataset.i; hangEdDraw(); hangEdSel(); };
  $('#heSh').onclick = e => { const b = e.target.closest('button'); if (!b) return; if (b.dataset.r) HE.rot = clamp(HE.rot + (b.dataset.r === '+' ? 8 : -8), -45, 45); else if (b.dataset.k) HE.shape = b.dataset.k; else HE.sc = clamp(HE.sc + (b.dataset.z === '+' ? .12 : -.12), .7, 1.4); hangEdDraw(); hangEdSel(); };
  $('#heNo').onclick = () => { box.style.display = 'none'; };
  const off = $('#heOff'); if (off) off.onclick = () => { PNT.gal.forEach(p => { if (p.hung === z.id) p.hung = false; }); paintSaveGal(); paintGalRender(); box.style.display = 'none'; say('Dessin décroché', 2.2); };
  $('#heOk').onclick = () => { PNT.gal.forEach(p => { if (p.hung === z.id) p.hung = false; }); const p = PNT.gal[HE.sel]; p.hung = z.id; p.hs = HE.shape; p.hx = HE.x; p.hy = HE.y; p.hz = HE.sc; p.hr = HE.rot; paintSaveGal(); paintGalRender(); box.style.display = 'none'; say('🖼️ Dessin accroché !', 2.6); };
}
function hangEdView() { const z = HE.z, cx = (z.z[0] + z.z[2]) / 2, cy = (z.z[1] + z.z[3]) / 2, w = 280, h = w * 320 / 560; return { x0: cx - w / 2, y0: cy - h / 2, w, h }; }
function hangEdSel() { document.querySelectorAll('#heTh button').forEach(b => b.classList.toggle('cur', +b.dataset.i === HE.sel)); document.querySelectorAll('#heSh button[data-k]').forEach(b => b.classList.toggle('cur', b.dataset.k === HE.shape)); }
function hangEdDraw() {
  const cv = $('#heCv'); if (!cv || !HE.z) return; const x = cv.getContext('2d'), v = hangEdView(), k = cv.width / v.w; x.setTransform(1, 0, 0, 1, 0, 0); x.fillStyle = '#000'; x.fillRect(0, 0, cv.width, cv.height);
  x.setTransform(k, 0, 0, k, -v.x0 * k, -v.y0 * k); if (imgIn.complete && imgIn.naturalWidth) x.drawImage(imgIn, 0, 0, SC_HOME.W, SC_HOME.H);
  for (const id in PNT.hang) if (id !== HE.z.id) hangDraw(x, PNT.hang[id]);
  const zz = HE.z.z; x.save(); x.setLineDash([4, 3]); x.lineWidth = 1.2; x.strokeStyle = 'rgba(255,240,170,.9)'; x.strokeRect(zz[0], zz[1], zz[2] - zz[0], zz[3] - zz[1]); x.restore();
  const p = PNT.gal[HE.sel]; if (!p) return; const key = HE.sel + '|' + HE.shape; let c = HE.cache[key];
  if (!c) { if (HE.cache['i' + HE.sel]) { c = HE.cache[key] = frameCompose(HE.cache['i' + HE.sel], HE.shape); } else { const im = new Image(); im.onload = () => { HE.cache['i' + HE.sel] = im; hangEdDraw(); }; im.src = p.d; return; } }
  if (c) hangDraw(x, { c, x: HE.x, y: HE.y, w: HANG_W[HE.shape] * HE.sc, r: HE.rot });
}
function paintGalRender() {
  $('#pGal').innerHTML = PNT.gal.length ? PNT.gal.map((p, i) => '<div class="th' + (p.hung ? ' hung' : '') + '" data-i="' + i + '"><img src="' + p.d + '" alt="">' + (p.hung ? '<i>' + ((hangZone(p.hung) || {}).name || 'accroché') + '</i>' : '') + '<b data-del="' + i + '">✕</b></div>').join('') : '';
  $('#pGal').querySelectorAll('.th').forEach(el => el.addEventListener('click', e => { const i = +el.dataset.i;
    if (e.target.dataset.del !== undefined) { PNT.gal.splice(i, 1); paintSaveGal(); paintGalRender(); return; }
    say('Pour accrocher un dessin : va près d\'un mur de la maison, là où brille la petite auréole 🖼️', 4); }));
}
function paintFlat(t) { const x = t.getContext('2d'), cv = $('#pCv'); x.drawImage(cv, 0, 0, t.width, t.height); if (PNT.model) { const ov = $('#pOv'); if (ov.complete && ov.naturalWidth) x.drawImage(ov, 0, 0, t.width, t.height); } }
PNT.undo = []; PNT.redo = [];
const paintSnap = () => ({ a: $('#pCv').getContext('2d').getImageData(0, 0, 720, 540), s: PNT.sk ? PNT.sk.getContext('2d').getImageData(0, 0, 720, 540) : null });
function paintPushUndo() { PNT.redo = []; const c = $('#pCv').getContext('2d'); try { PNT.undo.push({ a: c.getImageData(0, 0, 720, 540), s: PNT.sk ? PNT.sk.getContext('2d').getImageData(0, 0, 720, 540) : null }); if (PNT.undo.length > 15) PNT.undo.shift(); } catch (e) {} }
function paintRestore(u) { $('#pCv').getContext('2d').putImageData(u.a, 0, 0); if (u.s && PNT.sk) PNT.sk.getContext('2d').putImageData(u.s, 0, 0); }
function paintRedo() { const u = PNT.redo.pop(); if (!u) return; try { PNT.undo.push(paintSnap()); } catch (e) {} paintRestore(u); blip(620, .06, 'sine', .05); }
function paintUndo() { const u = PNT.undo.pop(); if (!u) return; try { PNT.redo.push(paintSnap()); } catch (e) {} $('#pCv').getContext('2d').putImageData(u.a, 0, 0); if (u.s && PNT.sk) PNT.sk.getContext('2d').putImageData(u.s, 0, 0); blip(500, .06, 'sine', .05); }
function paintClear() { const c = $('#pCv').getContext('2d'); c.fillStyle = PNT.paper; c.fillRect(0, 0, 720, 540); if (PNT.sk) PNT.sk.getContext('2d').clearRect(0, 0, 720, 540); }
function paintInit() {
  const cv = $('#pCv'), c = cv.getContext('2d', { desynchronized: true }); paintClear(); PNT.undo = []; PNT.redo = []; c.lineCap = 'round'; c.lineJoin = 'round';
  $('#pCols').innerHTML = PAINT_COLS.map((k, i) => '<button style="background:' + k + '" data-c="' + k + '" class="" aria-label="couleur"></button>').join('');
  $('#pCols').querySelectorAll('button').forEach(b => b.addEventListener('click', () => { PNT.col = b.dataset.c; { const cu = $('#pCur'); if (cu) cu.style.background = PNT.col; } PNT.erase = false; $('#pEr').classList.remove('on'); $('#pCols').querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b)); }));
  // roue des couleurs + curseur foncé / clair
  const wh = $('#pWheel'), wc = wh.getContext('2d'), WR = 75, hslHex = (h, s, l) => { s /= 100; l /= 100; const a = s * Math.min(l, 1 - l), f = n => { const k = (n + h / 30) % 12; return Math.round(255 * (l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1)))); }; return '#' + [f(0), f(8), f(4)].map(v => v.toString(16).padStart(2, '0')).join(''); };
  PNT.hue = 0; PNT.sat = 80; PNT.lig = 50;
  const drawWheel = () => { const im = wc.createImageData(150, 150); for (let y = 0; y < 150; y++) for (let x = 0; x < 150; x++) { const dx = x - WR, dy = y - WR, r = Math.hypot(dx, dy), i = (y * 150 + x) * 4; if (r > WR) { im.data[i + 3] = 0; continue; } const hx = hslHex((Math.atan2(dy, dx) * 180 / Math.PI + 360) % 360, r / WR * 100, PNT.lig); im.data[i] = parseInt(hx.slice(1, 3), 16); im.data[i + 1] = parseInt(hx.slice(3, 5), 16); im.data[i + 2] = parseInt(hx.slice(5, 7), 16); im.data[i + 3] = 255; } wc.putImageData(im, 0, 0); wc.strokeStyle = '#fff'; wc.lineWidth = 3; const a = PNT.hue * Math.PI / 180, rr = PNT.sat / 100 * WR; wc.beginPath(); wc.arc(WR + Math.cos(a) * rr, WR + Math.sin(a) * rr, 7, 0, TAU); wc.stroke(); };
  const useMix = () => { PNT.col = hslHex(PNT.hue, PNT.sat, PNT.lig); PNT.erase = false; $('#pEr').classList.remove('on'); $('#pCur').style.background = PNT.col; $('#pCols').querySelectorAll('button').forEach(x => x.classList.remove('on')); drawWheel(); };
  const wheelAt = e => { const r = wh.getBoundingClientRect(), x = (e.clientX - r.left) / r.width * 150 - WR, y = (e.clientY - r.top) / r.height * 150 - WR; PNT.hue = (Math.atan2(y, x) * 180 / Math.PI + 360) % 360; PNT.sat = Math.min(100, Math.hypot(x, y) / WR * 100); useMix(); };
  let wdn = false; wh.addEventListener('pointerdown', e => { e.preventDefault(); wh.setPointerCapture(e.pointerId); wdn = true; wheelAt(e); }); wh.addEventListener('pointermove', e => { if (wdn) wheelAt(e); }); wh.addEventListener('pointerup', () => { wdn = false; }); wh.addEventListener('pointercancel', () => { wdn = false; });
  $('#pLight').addEventListener('input', e => { PNT.lig = +e.target.value; useMix(); });
  drawWheel();
  [['#pS1', 4], ['#pS2', 10], ['#pS3', 22]].forEach(([s, v]) => $(s).addEventListener('click', () => { PNT.size = v; ['#pS1', '#pS2', '#pS3'].forEach(t => $(t).classList.toggle('on', t === s)); }));
  $('#pEr').addEventListener('click', () => { PNT.erase = !PNT.erase; $('#pEr').classList.toggle('on', PNT.erase); });
  $('#pClr').addEventListener('click', () => { if (confirm('Effacer tout le dessin ?')) { paintPushUndo(); paintClear(); } });
  $('#pUndo').addEventListener('click', paintUndo); $('#pRedo').addEventListener('click', paintRedo);
  const pos = e => { const r = cv.getBoundingClientRect(); return [(e.clientX - r.left) * 720 / r.width, (e.clientY - r.top) * 540 / r.height]; };
  const hexRgb = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
  PNT.sk = document.createElement('canvas'); PNT.sk.width = 720; PNT.sk.height = 540; const skc = PNT.sk.getContext('2d', { willReadFrequently: true });   // calque des traits (dessin libre) : sert de contour au remplissage
  const stamps = new Map();
  const wash = (x, y) => {   // un « jus » d'aquarelle : tache douce (tampon préparé une fois, puis simplement posé : aucun temps de latence)
    const r = Math.max(3, PNT.size * .9), [R, G, B] = hexRgb(PNT.col), j = Math.round(PNT.jit || 0), key = PNT.col + '|' + j + '|' + Math.round(r * 2);
    let sp = stamps.get(key);
    if (!sp) {
      if (stamps.size > 80) stamps.clear();
      const k = v => Math.max(0, Math.min(255, Math.round(v + j))), S = Math.ceil(r * 2) + 2; sp = document.createElement('canvas'); sp.width = sp.height = S; const sc = sp.getContext('2d'), m = S / 2;
      const g2 = sc.createRadialGradient(m, m, 0, m, m, r), rg = 'rgba(' + k(R) + ',' + k(G) + ',' + k(B) + ',';
      g2.addColorStop(0, rg + '.07)'); g2.addColorStop(.65, rg + '.09)'); g2.addColorStop(.88, rg + '.16)'); g2.addColorStop(1, rg + '0)');
      sc.fillStyle = g2; sc.beginPath(); sc.arc(m, m, r, 0, TAU); sc.fill(); stamps.set(key, sp);
    }
    c.globalCompositeOperation = 'multiply'; c.drawImage(sp, x - sp.width / 2, y - sp.height / 2); c.globalCompositeOperation = 'source-over';
    if (!PNT.model) { skc.fillStyle = '#000'; skc.beginPath(); skc.arc(x, y, Math.max(2, PNT.size * .55), 0, TAU); skc.fill(); }
  };
  const eraseDot = (x, y) => { c.fillStyle = PNT.paper; c.beginPath(); c.arc(x, y, PNT.size * 1.3, 0, TAU); c.fill(); if (!PNT.model) { skc.globalCompositeOperation = 'destination-out'; skc.beginPath(); skc.arc(x, y, PNT.size * 1.3, 0, TAU); skc.fill(); skc.globalCompositeOperation = 'source-over'; } };
  const stroke = (x0, y0, x1, y1) => { const d = Math.hypot(x1 - x0, y1 - y0), st = Math.max(1.5, PNT.size * .28), n = Math.max(1, Math.ceil(d / st)); for (let i = 1; i <= n; i++) { const t = i / n, x = x0 + (x1 - x0) * t, y = y0 + (y1 - y0) * t; if (PNT.erase) eraseDot(x, y); else wash(x, y); } };
  cv.addEventListener('pointerdown', e => { e.preventDefault(); cv.setPointerCapture(e.pointerId); paintPushUndo(); PNT.down = true; PNT.jit = (Math.random() - .5) * 22; const [x, y] = pos(e); PNT.lx = x; PNT.ly = y; stroke(x, y, x, y); });
  cv.addEventListener('pointermove', e => { if (!PNT.down) return; e.preventDefault(); const evs = e.getCoalescedEvents ? e.getCoalescedEvents() : [e]; for (const ev of (evs.length ? evs : [e])) { const [x, y] = pos(ev); stroke(PNT.lx, PNT.ly, x, y); PNT.lx = x; PNT.ly = y; } });
  // mode « remplir » : un toucher colorie toute la zone fermée par les traits
  const setMode = m => { PNT.mode = m; $('#pBrush').classList.toggle('on', m === 'brush'); $('#pFill').classList.toggle('on', m === 'fill'); cv.style.cursor = m === 'fill' ? 'pointer' : 'crosshair'; if (m === 'fill' && !PNT.model) say('🪣 Choisis un dessin à colorier pour remplir une zone', 3); };
  $('#pDl').addEventListener('click', () => { const t = document.createElement('canvas'); t.width = 720; t.height = 540; paintFlat(t); const a = document.createElement('a'); a.href = t.toDataURL('image/png'); a.download = 'mon-dessin-myah.png'; document.body.appendChild(a); a.click(); a.remove(); say('📥 Dessin téléchargé !', 2.2); });
  $('#pBrush').addEventListener('click', () => setMode('brush')); $('#pFill').addEventListener('click', () => setMode('fill'));
  const barrier = () => { if (!PNT.model) { const d = skc.getImageData(0, 0, 720, 540).data, b = new Uint8Array(720 * 540); for (let i = 0; i < b.length; i++) b[i] = d[i * 4 + 3] > 40 ? 1 : 0; return b; } const ov = $('#pOv'); if (PNT.barSrc === ov.src && PNT.bar) return PNT.bar; if (!ov.complete || !ov.naturalWidth) return null; const t = document.createElement('canvas'); t.width = 720; t.height = 540; const tc = t.getContext('2d'); tc.drawImage(ov, 0, 0, 720, 540); const d = tc.getImageData(0, 0, 720, 540).data, b = new Uint8Array(720 * 540); for (let i = 0; i < b.length; i++) b[i] = d[i * 4 + 3] > 110 ? 1 : 0; PNT.bar = b; PNT.barSrc = ov.src; return b; };
  const fillAt = (x, y) => {
    const b = barrier(); if (!b) return; const X = Math.round(x), Y = Math.round(y); if (X < 0 || Y < 0 || X >= 720 || Y >= 540 || b[Y * 720 + X]) return;
    const seen = new Uint8Array(720 * 540), st = [Y * 720 + X], reg = []; seen[st[0]] = 1;
    while (st.length) { const p = st.pop(); reg.push(p); const px = p % 720, py = (p / 720) | 0; if (px > 0 && !seen[p - 1] && !b[p - 1]) { seen[p - 1] = 1; st.push(p - 1); } if (px < 719 && !seen[p + 1] && !b[p + 1]) { seen[p + 1] = 1; st.push(p + 1); } if (py > 0 && !seen[p - 720] && !b[p - 720]) { seen[p - 720] = 1; st.push(p - 720); } if (py < 539 && !seen[p + 720] && !b[p + 720]) { seen[p + 720] = 1; st.push(p + 720); } }
    const im = c.getImageData(0, 0, 720, 540), d = im.data, hx = PNT.erase ? PNT.paper : PNT.col, R = parseInt(hx.slice(1, 3), 16), G = parseInt(hx.slice(3, 5), 16), B = parseInt(hx.slice(5, 7), 16), a = PNT.erase ? 1 : .82;
    for (const p of reg) { const i = p * 4, n = PNT.erase ? 0 : (Math.random() - .5) * 14, pr = 255, pg = PNT.model ? 250 : 255, pb = PNT.model ? 240 : 255; d[i] = pr * (1 - a) + pr * R / 255 * a + n; d[i + 1] = pg * (1 - a) + pg * G / 255 * a + n; d[i + 2] = pb * (1 - a) + pb * B / 255 * a + n; d[i + 3] = 255; }
    c.putImageData(im, 0, 0); blip(520, .06, 'sine', .06);
  };
  cv.addEventListener('pointerdown', e => { if (PNT.mode !== 'fill') return; e.preventDefault(); e.stopImmediatePropagation(); const [x, y] = pos(e); paintPushUndo(); fillAt(x, y); }, true);
  const curs = () => { cv.style.cursor = PNT.mode === 'fill' ? 'pointer' : PNT.model ? 'crosshair' : 'none'; };   // dessin libre : pas de pointeur par-dessus le trait
  cv.addEventListener('pointerenter', curs); cv.addEventListener('pointermove', curs);
  const P = $('#paint');   // onglets : dessin libre / coloriage (une mosaïque pour choisir, qui se replie ensuite)
  const pTab = t => { P.classList.remove('pFree', 'pPick', 'pCol'); P.classList.add(t === 'free' ? 'pFree' : t === 'pick' ? 'pPick' : 'pCol'); $('#pTabFree').classList.toggle('on', t === 'free'); $('#pTabCol').classList.toggle('on', t !== 'free'); $('#pAgain').style.display = t === 'col' ? '' : 'none'; curs(); };
  const blankM = () => $('#pModels').querySelector('button[data-m=""]');
  $('#pBack').addEventListener('click', () => { const st = P.classList.contains('pCol') ? 'col' : P.classList.contains('pPick') ? 'pick' : 'free'; if (st === 'col') pTab('pick'); else if (st === 'pick') { const b = blankM(); if (b) b.click(); pTab('free'); } else { closePaint(); openMiniMenu(); } });   // ← revient au choix précédent
  $('#pHome').addEventListener('click', () => { closePaint(); openMiniMenu(); });   // 🏠 retour au choix des mini-jeux
  $('#pTabFree').addEventListener('click', () => { const b = blankM(); if (b) b.click(); pTab('free'); });
  $('#pTabCol').addEventListener('click', () => pTab('pick'));
  $('#pAgain').addEventListener('click', () => pTab('pick'));
  pTab('free');
  const up = () => { PNT.down = false; }; cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
  $('#pSave').addEventListener('click', () => { const t = document.createElement('canvas'); t.width = 540; t.height = 405; paintFlat(t); PNT.gal.unshift({ d: t.toDataURL('image/jpeg', .86), hung: false }); PNT.gal = PNT.gal.slice(0, 24); paintSaveGal(); paintGalRender(); blip(660, .1, 'sine', .08); blip(990, .14, 'sine', .07, .09); say('🎨 Dessin gardé !', 2.2); });
  const MODELS = [['', '📄', 'feuille blanche'], ['papillon', 0, 'papillon'], ['hibiscus', 0, 'hibiscus'], ['poisson', 0, 'poisson-clown'], ['cygne', 0, 'cygne'], ['tortue', 0, 'tortue'], ['toucan', 0, 'toucan'], ['perroquet', 0, 'perroquet'], ['gecko', 0, 'gecko'], ['ananas', 0, 'ananas'], ['mangue', 0, 'mangues'], ['frangipanier', 0, 'frangipanier'], ['orchidee', 0, 'orchidée'], ['feuilles', 0, 'feuilles'], ['palmier', 0, 'palmier'], ['aquarium', 0, 'récif']];
  $('#pModels').innerHTML = MODELS.map((m, i) => '<button class="pb' + (i === 0 ? ' on' : '') + '" data-m="' + m[0] + '">' + (m[1] || '<img src="assets/color/' + m[0] + '_cadre.png" alt="" loading="lazy">') + '<small>' + m[2] + '</small></button>').join('');
  $('#pModels').querySelectorAll('button').forEach(b => b.addEventListener('click', () => { PNT.model = b.dataset.m || null; PNT.paper = PNT.model ? '#fffaf0' : '#ffffff'; $('#pCv').style.background = PNT.paper; const ov = $('#pOv'); if (PNT.model) { ov.src = 'assets/color/' + PNT.model + '_cadre.png'; ov.style.display = 'block'; } else ov.style.display = 'none'; paintClear(); PNT.undo = []; PNT.redo = []; $('#pModels').querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b)); }));
  $('#pModels').querySelectorAll('button').forEach(b => b.addEventListener('click', () => { if (b.dataset.m) pTab('col'); }));
  $('#pX').addEventListener('click', closePaint);
}
setTimeout(paintInit, 0);
function openPaint() { if (paintOpen()) return; player.mvx = player.mvy = 0; setAnim('idle'); paintGalRender(); $('#paint').style.display = 'block'; }
function closePaint() { $('#paint').style.display = 'none'; actQueued = false; }


/* ================= memory (18 cartes, 9 paires) ================= */
const MEM_FACES = ['toucan', 'hamac', 'ananas', 'monstera', 'cabane', 'tortue', 'livres', 'collier', 'coco'];
const MEM = { cards: [], first: null, lock: false, moves: 0, found: 0, key: SAVE_KEY + '-memBest' };
const memOpen = () => $('#memory').style.display === 'block';
function memStart() {
  const ids = MEM_FACES.concat(MEM_FACES); for (let i = ids.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [ids[i], ids[j]] = [ids[j], ids[i]]; }
  MEM.cards = ids.map((id, i) => ({ id, i, up: false, ok: false })); MEM.first = null; MEM.lock = false; MEM.moves = 0; MEM.found = 0;
  $('#mWin').style.display = 'none';
  $('#mGrid').innerHTML = MEM.cards.map(c => '<div class="mc" data-i="' + c.i + '"><div><i class="b" style="background-image:url(assets/memory/dos.jpg)"></i><i class="f" style="background-image:url(assets/memory/' + c.id + '.jpg)"></i></div></div>').join('');
  $('#mGrid').querySelectorAll('.mc').forEach(el => el.addEventListener('click', () => memFlip(+el.dataset.i)));
  memInfo();
}
function memInfo() { let best = 0; try { best = +localStorage.getItem(MEM.key) || 0; } catch (e) {} $('#mInfo').textContent = 'Paires trouvées : ' + MEM.found + ' / 9  ·  Essais : ' + MEM.moves + (best ? '  ·  Record : ' + best : ''); }
function memFlip(i) {
  const c = MEM.cards[i], el = $('#mGrid').children[i]; if (MEM.lock || c.up || c.ok) return;
  c.up = true; el.classList.add('up'); blip(520 + (i % 5) * 40, .06, 'sine', .06);
  if (MEM.first === null) { MEM.first = i; return; }
  const a = MEM.cards[MEM.first], ea = $('#mGrid').children[MEM.first]; MEM.moves++;
  if (a.id === c.id) {
    a.ok = c.ok = true; MEM.first = null; MEM.found++; setTimeout(() => { ea.classList.add('ok'); el.classList.add('ok'); blip(780, .1, 'sine', .08); blip(1170, .14, 'sine', .07, .09); }, 350);
    if (MEM.found === 9) memWin();
  } else {
    MEM.lock = true; const fi = MEM.first; MEM.first = null;
    setTimeout(() => { a.up = c.up = false; ea.classList.remove('up'); el.classList.remove('up'); MEM.lock = false; }, 950);
  }
  memInfo();
}
function memWin() {
  let best = 0; try { best = +localStorage.getItem(MEM.key) || 0; if (!best || MEM.moves < best) { localStorage.setItem(MEM.key, MEM.moves); } } catch (e) {}
  const rec = !best || MEM.moves < best;
  setTimeout(() => { $('#mWinT').textContent = '🎉 Bravo Myah ! Toutes les paires en ' + MEM.moves + ' essais' + (rec ? ' · nouveau record ✨' : ''); $('#mWin').style.display = 'block'; blip(660, .12, 'sine', .08); blip(880, .12, 'sine', .08, .12); blip(1320, .2, 'sine', .08, .26); memInfo(); $('#memory').scrollTo({ top: 9999, behavior: 'smooth' }); }, 700);
}
/* ================= rythme avec Kykah (Simon à 6 tambours-coquillages) ================= */
const RYT = { seq: [], pos: 0, state: 'idle', tok: 0, best: 0, key: SAVE_KEY + '-rytBest', built: false };
const RYT_NOTES = [523, 587, 659, 784, 880, 1047], RYT_MAX = 10;
const rytOpen = () => $('#rythme').style.display === 'block';
const rytWait = ms => new Promise(r => setTimeout(r, ms));
function rytBuild() {
  if (RYT.built) return; RYT.built = true;
  try { RYT.best = +localStorage.getItem(RYT.key) || 0; } catch (e) {}
  const g = $('#rGrid'); g.innerHTML = '';
  for (let i = 0; i < 6; i++) { const b = document.createElement('button'); b.className = 'rPad'; b.dataset.i = i; b.setAttribute('aria-label', 'Tambour ' + (i + 1)); b.innerHTML = '<img class="off" src="assets/rythme/s' + i + '.png" alt=""><img class="on" src="assets/rythme/d' + i + '.png" alt="">'; b.addEventListener('pointerdown', e => { e.preventDefault(); rytTap(i); }); g.appendChild(b); }
  const gl = $('#rGlow'); gl.style.left = '88%'; gl.style.top = '10%'; gl.style.width = '14%';
}
function rytInfo() { $('#rInfo').textContent = 'Manche ' + Math.max(1, RYT.seq.length - 1) + ' sur ' + (RYT_MAX - 1) + (RYT.best ? ' · record : ' + RYT.best : ''); }
let _rdT = 0;
function rytDance(ms) { const m = $('#rMyah'); if (!m) return; m.classList.add('dance'); clearTimeout(_rdT); _rdT = setTimeout(() => m.classList.remove('dance'), ms); }   // Myah danse quand on joue juste
function rytSound(i) { blip(RYT_NOTES[i], .38, 'triangle', .13); blip(RYT_NOTES[i] / 4, .16, 'sine', .16); }
function rytLight(i, ms) { const p = $('#rGrid').children[i]; if (!p) return; p.classList.add('lit'); rytSound(i); setTimeout(() => p.classList.remove('lit'), ms); }
function rytPads(on) { [...$('#rGrid').children].forEach(p => p.disabled = !on); }
async function rytPlay() {
  const t = ++RYT.tok; RYT.state = 'show'; RYT.pos = 0; rytPads(false); rytInfo();
  $('#rMsg').textContent = '👂 Écoute bien Kykah…'; $('#rBtn').style.display = 'none';
  await rytWait(800); if (t !== RYT.tok) return;
  for (const i of RYT.seq) { $('#rChefW').classList.add('beat'); rytLight(i, 380); await rytWait(430); $('#rChefW').classList.remove('beat'); await rytWait(260); if (t !== RYT.tok) return; }
  RYT.state = 'input'; rytPads(true); $('#rMsg').textContent = '🥁 À toi, Myah !';
}
function rytNew() { RYT.seq = []; for (let k = 0; k < 2; k++) RYT.seq.push(Math.floor(Math.random() * 6)); rytPlay(); }
async function rytTap(i) {
  if (RYT.state === 'idle' || RYT.state === 'done') { rytLight(i, 300); return; }
  if (RYT.state !== 'input') return;
  const t = RYT.tok; rytLight(i, 300);
  if (i !== RYT.seq[RYT.pos]) { RYT.state = 'wait'; rytPads(false); $('#rMsg').textContent = '🙈 Oups ! On réécoute ensemble.'; blip(220, .25, 'sine', .1); await rytWait(1300); if (t !== RYT.tok) return; rytPlay(); return; }
  RYT.pos++; rytDance(700);
  if (RYT.pos < RYT.seq.length) return;
  RYT.state = 'wait'; rytPads(false);
  const done = RYT.seq.length - 1; if (done > RYT.best) { RYT.best = done; try { localStorage.setItem(RYT.key, RYT.best); } catch (e) {} }
  if (RYT.seq.length >= RYT_MAX) { RYT.state = 'done'; rytDance(4500); rytPads(true); $('#rMsg').textContent = '🎉 Bravo Myah ! Tu es une vraie chef d\'orchestre !'; $('#rBtn').textContent = '🔄 Rejouer'; $('#rBtn').style.display = 'block'; blip(660, .12, 'sine', .08); blip(880, .12, 'sine', .08, .12); blip(1320, .25, 'sine', .08, .26); return; }
  $('#rMsg').textContent = '⭐ Bravo ! Encore une note…'; blip(880, .1, 'sine', .07); blip(1320, .14, 'sine', .07, .1);
  await rytWait(1100); if (t !== RYT.tok) return;
  RYT.seq.push(Math.floor(Math.random() * 6)); rytPlay();
}
function openRythme() { if (rytOpen()) return; player.mvx = player.mvy = 0; setAnim('idle'); rytBuild(); RYT.tok++; RYT.state = 'idle'; RYT.seq = []; rytPads(true); $('#rMsg').textContent = '🐚 Kykah joue, tu répètes !'; $('#rBtn').textContent = '▶ Commencer'; $('#rBtn').style.display = 'block'; rytInfo(); $('#rythme').style.display = 'block'; }
function closeRythme() { RYT.tok++; $('#rythme').style.display = 'none'; actQueued = false; }
setTimeout(() => { $('#rX').addEventListener('click', closeRythme); $('#rBtn').addEventListener('click', rytNew); $('#mmRyt').addEventListener('click', () => { $('#miniMenu').style.display = 'none'; openRythme(); }); }, 0);
const miniMenuOpen = () => $('#miniMenu').style.display === 'grid';
function openMiniMenu() { player.mvx = player.mvy = 0; setAnim('idle'); $('#miniMenu').style.display = 'grid'; }
function openMemory() { if (memOpen()) return; player.mvx = player.mvy = 0; setAnim('idle'); memStart(); $('#memory').style.display = 'block'; }
function closeMemory() { $('#memory').style.display = 'none'; actQueued = false; }
setTimeout(() => { $('#mX').addEventListener('click', closeMemory); $('#mAgain').addEventListener('click', memStart); $('#memB').addEventListener('click', openMemory); $('#mmPaint').addEventListener('click', () => { $('#miniMenu').style.display = 'none'; openPaint(); }); $('#mmMem').addEventListener('click', () => { $('#miniMenu').style.display = 'none'; openMemory(); }); $('#mmX').addEventListener('click', () => { $('#miniMenu').style.display = 'none'; }); }, 0);


/* ================= puzzle de la carte de l'île (12 pièces) ================= */
const PUZ = { W: 996, H: 551, BH: 551, TH: 309, p: [[0, 0, 290, 238], [247, 0, 292, 238], [496, 0, 253, 238], [706, 0, 290, 186], [0, 181, 251, 189], [208, 181, 292, 241], [457, 181, 331, 189], [745, 129, 251, 241], [0, 313, 290, 238], [247, 365, 253, 186], [457, 313, 292, 238], [706, 313, 290, 238]], pieces: [], done: 0, t0: 0, key: SAVE_KEY + '-puzBest', drag: null, guide: (() => { try { return localStorage.getItem(SAVE_KEY + '-puzGuide') !== '0'; } catch (e) { return true; } })() };
const puzKey = () => PUZ.key + (PUZ.guide ? '' : '-sans');   // un record par niveau
const puzOpen = () => $('#puzzle').style.display === 'block';
window.__puz = PUZ;
function puzLevelUi() { $('#zBoard').classList.toggle('noguide', !PUZ.guide); $('#zG1').classList.toggle('on', PUZ.guide); $('#zG0').classList.toggle('on', !PUZ.guide); }
function puzStart() {
  const B = $('#zBoard'); B.classList.remove('done'); puzLevelUi(); $('#zWin').style.display = 'none'; B.querySelectorAll('.zp').forEach(e => e.remove());
  const TOT = PUZ.BH + PUZ.TH; PUZ.pieces = []; PUZ.done = 0; PUZ.t0 = Date.now();
  PUZ.p.forEach((m, i) => {
    const el = document.createElement('img'); el.className = 'zp'; el.src = 'assets/puzzle/p' + i + '.png'; el.draggable = false;
    const pw = m[2] / PUZ.W * 100, ph = m[3] / TOT * 100; el.style.width = pw + '%';
    const tx = m[0] / PUZ.W * 100, ty = m[1] / TOT * 100;   // place juste
    const sx = Math.random() * (100 - pw), sy = (PUZ.BH + 8) / TOT * 100 + Math.random() * Math.max(0, PUZ.TH / TOT * 100 - ph - 2);
    el.style.left = sx + '%'; el.style.top = sy + '%'; el.style.zIndex = 5 + i;
    const pc = { el, i, tx, ty, ok: false }; PUZ.pieces.push(pc);
    el.addEventListener('pointerdown', e => { if (pc.ok) return; e.preventDefault(); el.setPointerCapture(e.pointerId); const r = B.getBoundingClientRect(); PUZ.drag = { pc, dx: (e.clientX - r.left) / r.width * 100 - parseFloat(el.style.left), dy: (e.clientY - r.top) / r.height * 100 - parseFloat(el.style.top) }; el.classList.add('drag'); PUZ.z = (PUZ.z || 40) + 1; el.style.zIndex = PUZ.z; });
    el.addEventListener('pointermove', e => { const d = PUZ.drag; if (!d || d.pc !== pc) return; const r = B.getBoundingClientRect(); el.style.left = ((e.clientX - r.left) / r.width * 100 - d.dx) + '%'; el.style.top = ((e.clientY - r.top) / r.height * 100 - d.dy) + '%'; });
    const end = () => { const d = PUZ.drag; if (!d || d.pc !== pc) return; PUZ.drag = null; el.classList.remove('drag'); puzDrop(pc); };
    el.addEventListener('pointerup', end); el.addEventListener('pointercancel', end);
    B.appendChild(el);
  });
  puzInfo();
}
function puzInfo() { let best = 0; try { best = +localStorage.getItem(puzKey()) || 0; } catch (e) {} $('#zInfo').textContent = 'Pièces bien placées : ' + PUZ.done + ' / 12' + (best ? '  ·  Record : ' + Math.floor(best / 60) + ' min ' + String(best % 60).padStart(2, '0') + ' s' : ''); }
function puzDrop(pc) {
  const el = pc.el, x = parseFloat(el.style.left), y = parseFloat(el.style.top);
  if (Math.hypot((x - pc.tx) * PUZ.W / 100, (y - pc.ty) * (PUZ.BH + PUZ.TH) / 100) < (PUZ.guide ? 30 : 22)) {
    pc.ok = true; el.classList.add('ok'); el.style.left = pc.tx + '%'; el.style.top = pc.ty + '%'; el.style.zIndex = 2; PUZ.done++;
    blip(700 + PUZ.done * 40, .08, 'sine', .07); blip(1050 + PUZ.done * 40, .1, 'sine', .06, .08);
    puzInfo(); if (PUZ.done === 12) puzWin();
  }
}
function puzWin() {
  const s = Math.round((Date.now() - PUZ.t0) / 1000); let best = 0; try { best = +localStorage.getItem(puzKey()) || 0; if (!best || s < best) localStorage.setItem(puzKey(), s); } catch (e) {}
  const rec = !best || s < best;
  setTimeout(() => { $('#zBoard').classList.add('done'); $('#zWinT').textContent = '🎉 Bravo Myah ! La carte de l\'île est complète en ' + Math.floor(s / 60) + ' min ' + String(s % 60).padStart(2, '0') + ' s' + (rec ? ' · nouveau record ✨' : ''); $('#zWin').style.display = 'block'; blip(660, .12, 'sine', .08); blip(880, .12, 'sine', .08, .12); blip(1320, .2, 'sine', .08, .26); puzInfo(); $('#puzzle').scrollTo({ top: 9999, behavior: 'smooth' }); }, 500);
}
function openPuzzle() { if (puzOpen()) return; player.mvx = player.mvy = 0; setAnim('idle'); puzStart(); $('#puzzle').style.display = 'block'; }
function closePuzzle() { $('#puzzle').style.display = 'none'; actQueued = false; }
setTimeout(() => { [['#zG1', true], ['#zG0', false]].forEach(([s, v]) => $(s).addEventListener('click', () => { if (PUZ.guide === v) return; PUZ.guide = v; try { localStorage.setItem(SAVE_KEY + '-puzGuide', v ? '1' : '0'); } catch (e) {} puzStart(); })); $('#zX').addEventListener('click', closePuzzle); $('#zAgain').addEventListener('click', puzStart); $('#mmPuz').addEventListener('click', () => { $('#miniMenu').style.display = 'none'; openPuzzle(); }); }, 0);

/* ================= longue vue de l'observatoire ================= */
const SCOPE_SPOTS = [[290, 782], [665, 792]], SCOPE_HL = [[215, 690], [740, 700]];   // SCOPE_HL : l'auréole d'interaction, sur le pied de la longue-vue
const nearScope = () => SC === SC_OBS && IN.floor === 0 ? SCOPE_SPOTS.findIndex(s => dist(IN.x, IN.y, s[0], s[1]) < 75) + 1 : 0;   // 0 = aucune, 1 = gauche, 2 = droite
const scopeOpen = () => $('#scope').style.display === 'block';
const imgScopeFrame = new Image(); imgScopeFrame.src = 'assets/cadre_longuevue.png';
const imgScopeVid = new Image(); imgScopeVid.src = 'assets/longuevue_lever.jpg';   // 30 images (6×5) tirées de l'animation Gemini, lever / coucher
const SCP = { t: 0, pan: .5, vel: 0, drag: null, birds: [], next: 1.2, kind: 0, raf: 0, last: 0, bc: document.createElement('canvas'), shoot: null };
function drawSwanSc(g, b, t) {
  const fi = ((Math.floor((t * 3.2 + b.ph) % 1 * 5)) + 5) % 5, nm = 'swfly' + fi, sp = SPR[nm], im = img['s_' + nm]; if (!sp || !im || !im.complete) return;
  const w = sp.w * b.s, h = sp.h * b.s; g.save(); g.translate(b.x, b.y + Math.sin(t * 3.2 + b.ph * 6) * 3 * b.s); g.scale(-b.dir, 1); g.drawImage(im, -w / 2, -h * .55, w, h); g.restore();
}
function drawParrotSc(g, b, t) {
  if (mimOk('perroquet')) { const im = MIM.perroquet, w = 120 * b.s, h = w * im.naturalHeight / im.naturalWidth, f = Math.sin(t * 9 + b.ph * 6); g.save(); g.translate(b.x, b.y + Math.sin(t * 5 + b.ph * 6) * 5 * b.s); g.scale(-b.dir, 1 + f * .04); g.rotate(-f * .05); g.drawImage(im, -w / 2, -h / 2, w, h); g.restore(); return; }
  const f = Math.sin(t * 13 + b.ph * 6), s = b.s; g.save(); g.translate(b.x, b.y + Math.sin(t * 5 + b.ph * 6) * 4 * s); g.scale(b.dir * s, s);
  g.fillStyle = b.c2; g.beginPath(); g.moveTo(-14, 2); g.quadraticCurveTo(-52, 14 + f * 3, -64, 30); g.quadraticCurveTo(-40, 8, -10, -2); g.fill();   // longue queue
  g.fillStyle = b.c; g.beginPath(); g.ellipse(0, 0, 22, 11, -.12, 0, TAU); g.fill();   // corps
  g.beginPath(); g.arc(21, -7, 9, 0, TAU); g.fill();   // tête
  g.fillStyle = '#fff'; g.beginPath(); g.arc(24, -9, 3.1, 0, TAU); g.fill(); g.fillStyle = '#111'; g.beginPath(); g.arc(25, -9, 1.5, 0, TAU); g.fill();
  g.fillStyle = '#f4d03f'; g.beginPath(); g.moveTo(28, -11); g.quadraticCurveTo(39, -8, 33, 1); g.quadraticCurveTo(31, -4, 27, -4); g.fill();   // bec
  g.save(); g.translate(-2, -4); g.rotate(-.9 - f * .85); g.fillStyle = b.c3; g.beginPath(); g.ellipse(-4, -20, 11, 26, 0, 0, TAU); g.fill(); g.fillStyle = '#ffd23f'; g.beginPath(); g.ellipse(-2, -34, 6, 11, 0, 0, TAU); g.fill(); g.restore();   // aile
  g.restore();
}
function drawHummSc(g, b, t) {
  if (mimOk('colib0') && mimOk('colib1')) { const im = MIM[Math.sin(t * 22 + b.ph * 9) > 0 ? 'colib0' : 'colib1'], w = 72 * b.s, h = w * im.naturalHeight / im.naturalWidth; g.save(); g.translate(b.x, b.y + Math.sin(t * 4 + b.ph * 6) * 10 * b.s); g.scale(-b.dir, 1); g.drawImage(im, -w / 2, -h / 2, w, h); g.restore(); return; }
  const f = Math.sin(t * 38 + b.ph * 9), s = b.s, yy = Math.sin(t * 4 + b.ph * 6) * 10 * s; g.save(); g.translate(b.x, b.y + yy); g.scale(b.dir * s, s); g.rotate(-.12);
  g.fillStyle = b.c2; g.beginPath(); g.moveTo(-10, 2); g.lineTo(-26, 12); g.lineTo(-22, 2); g.lineTo(-27, -3); g.closePath(); g.fill();   // queue
  g.fillStyle = b.c; g.beginPath(); g.ellipse(0, 0, 13, 7, -.2, 0, TAU); g.fill();   // corps
  g.fillStyle = b.c3; g.beginPath(); g.ellipse(2, 3, 9, 4, -.2, 0, TAU); g.fill();   // ventre
  g.fillStyle = b.c; g.beginPath(); g.arc(14, -5, 6, 0, TAU); g.fill();   // tête
  g.fillStyle = '#111'; g.beginPath(); g.arc(16, -6, 1.2, 0, TAU); g.fill();
  g.strokeStyle = '#2b2b2b'; g.lineWidth = 1.6; g.lineCap = 'round'; g.beginPath(); g.moveTo(19, -5); g.lineTo(37, -2); g.stroke();   // long bec
  g.save(); g.translate(-1, -5); g.rotate(-.5 - f * .9); g.fillStyle = 'rgba(235,245,255,.7)'; g.beginPath(); g.ellipse(-3, -13, 5, 15, 0, 0, TAU); g.fill(); g.restore();   // aile floue
  g.restore();
}
function spawnScope() {
  if (phase === 'returned' && SCP.kind % 4 === 3) { SCP.kind++; const W = SCP.D || 500, dir = Math.random() < .5 ? 1 : -1; SCP.birds.push({ sw: true, dir, x: dir > 0 ? -120 : W + 120, y: W * (.2 + Math.random() * .25), s: W / 520, v: .17 * W, ph: Math.random() }); return; }   // le grand cygne : un seul, seulement une fois le jeu terminé
  const W = SCP.D || 500, dir = SCP.rot && SCP.t - SCP.rotT < 6 && Math.random() < .75 ? -SCP.rot : (Math.random() < .5 ? 1 : -1), hm = SCP.kind++ % 2 === 1, y = W * (.18 + Math.random() * .4), n = 1 + (Math.random() < .5 ? 1 : 0), sp = (hm ? .26 : .3) * W;
  const cols = [['#e8332b', '#1f5fd6', '#2fa84f'], ['#2f9fe0', '#e8332b', '#f4a31f'], ['#f2b01e', '#2fa84f', '#d9342b']][Math.floor(Math.random() * 3)], hc = [['#1f9e6a', '#0f5f6b', '#f2f2e6'], ['#8a3fd0', '#2b2f7a', '#f0e6f6'], ['#2fb36a', '#b8326a', '#fff3d6']][Math.floor(Math.random() * 3)];
  for (let i = 0; i < n; i++) SCP.birds.push({ hm, dir, x: dir > 0 ? -90 - i * 80 : W + 90 + i * 80, y: y + i * W * .06 + (Math.random() - .5) * 14, s: hm ? W / 520 : W / 560, v: sp * (.9 + Math.random() * .2), ph: Math.random(), c: hm ? hc[0] : cols[i % 3 === 0 ? 0 : i % 3], c2: hm ? hc[1] : cols[1], c3: hm ? hc[2] : cols[2] });
}
function scopeFrame(now) {
  if (!scopeOpen()) { SCP.raf = 0; return; }
  const dt = Math.min(.05, (now - SCP.last) / 1000 || .016); SCP.last = now; SCP.t += dt; if (!tutSeen.scopeHint) { SCP.hintT = (SCP.hintT || 0) + dt; if (SCP.hintT > 7) { tutDone('scopeHint'); $('#scopeHint').style.display = 'none'; } }
  const cvs = $('#scopeCv'), dpr = Math.min(2, devicePixelRatio || 1), w = innerWidth, h = innerHeight;
  if (cvs.width !== Math.round(w * dpr) || cvs.height !== Math.round(h * dpr)) { cvs.width = Math.round(w * dpr); cvs.height = Math.round(h * dpr); }
  const g = cvs.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, w, h);
  const F = Math.floor(Math.min(w, h) * .98), fOk = imgScopeFrame.complete && imgScopeFrame.naturalWidth, D = Math.floor(fOk ? F * .70 : Math.min(w, h) * .9), R = D / 2, cx = w / 2, cy = h / 2; SCP.D = D;
  if (((keys.ArrowLeft || keys.KeyA) || SCP.btn === 'l') && !SCP.drag) SCP.vel = -.35; else if (((keys.ArrowRight || keys.KeyD) || SCP.btn === 'r') && !SCP.drag) SCP.vel = .35; else SCP.vel *= .85;
  if (((keys.ArrowUp || keys.KeyW) || SCP.btn === 'u') && !SCP.drag) SCP.vy = -.35; else if (((keys.ArrowDown || keys.KeyS) || SCP.btn === 'd') && !SCP.drag) SCP.vy = .35; else SCP.vy *= .85;
  SCP.pan = Math.max(0, Math.min(1, SCP.pan + SCP.vel * dt * (SCP.which || SCP.sky ? 1 : .32))); SCP.py = Math.max(0, Math.min(1, SCP.py + SCP.vy * dt));
  SCP.next -= dt; if (SCP.next <= 0) { spawnScope(); SCP.next = 4 + Math.random() * 4; }
  { const span = SCP.which ? 330 : 1075, mxN = SCP.pan * span, dm = SCP.lastMx === undefined ? 0 : mxN - SCP.lastMx; SCP.lastMx = mxN; if (Math.abs(dm) > .05) { SCP.rot = dm > 0 ? 1 : -1; SCP.rotT = SCP.t; } }   // sens de rotation de la longue-vue : les oiseaux passent de préférence dans ce sens (image en miroir)
  for (const b of SCP.birds) b.x += b.dir * b.v * dt; SCP.birds = SCP.birds.filter(b => b.dir > 0 ? b.x < D + 160 : b.x > -160);
  const ds = dayState(), night = ds.tint[3] > .25;
  // lentille
  g.save(); g.translate(cx - R, cy - R); g.beginPath(); g.arc(R, R, R, 0, TAU); g.clip();
  const sh = Math.sin(SCP.t * .9) * 2, sv = Math.cos(SCP.t * .7) * 2;   // la main tremble un peu
  if (SCP.sky) drawSkyLens(g, D, R, dt);
  else {
  const zm = SCP.zoom || 1, crop = 300 / zm, mx = (SCP.which ? 120 + SCP.pan * 330 : SCP.pan * 1075) + (300 - crop) / 2, my = Math.max(0, Math.min(768 - crop, (SCP.which ? 450 : 18) + Math.sin(SCP.t * .3) * 6 + (SCP.py - .5) * 150 + (300 - crop) / 2));
  const draw1 = (n, al) => { const im = img[n]; if (!im || !im.naturalWidth) return false; const k = im.naturalWidth / 1375; g.globalAlpha = al; g.drawImage(im, (mx + sh * .3) * k, my * k, crop * k, crop * k, 0, 0, D, D); g.globalAlpha = 1; return true; };
  g.fillStyle = '#6fb7d4'; g.fillRect(0, 0, D, D);
  if (!draw1(ds.A.n, 1)) draw1('map', 1); if (ds.B !== ds.A && ds.u > .002) draw1(ds.B.n, ds.u);
  { const sunny = n => n === 'mapx_lever' || n === 'mapx_coucher', wv = (sunny(ds.A.n) ? 1 - ds.u : 0) + (ds.B !== ds.A && sunny(ds.B.n) ? ds.u : 0);
    SCP.vid = false; }
  if (night) { g.fillStyle = '#fffbe6'; for (let i = 0; i < 40; i++) { const x = (i * 211) % D, y = (i * 97) % (D * .35); g.globalAlpha = .3 + .7 * Math.max(0, Math.sin(SCP.t * 1.7 + i)); g.fillRect(x, y, 1.6, 1.6); } g.globalAlpha = 1;
    if (!SCP.shoot && Math.random() < dt * .12) SCP.shoot = { x: D * (.2 + Math.random() * .6), y: D * .05, u: 0 };
    if (SCP.shoot) { const s = SCP.shoot; s.u += dt * 1.4; g.strokeStyle = 'rgba(255,255,255,' + (1 - s.u) + ')'; g.lineWidth = 2.2; g.beginPath(); g.moveTo(s.x + s.u * 150, s.y + s.u * 70); g.lineTo(s.x + s.u * 150 - 46, s.y + s.u * 70 - 22); g.stroke(); if (s.u >= 1) SCP.shoot = null; } }
  // nuages qui dérivent
  g.fillStyle = night ? 'rgba(120,140,190,.22)' : 'rgba(255,255,255,.14)';
  for (let i = 0; i < 3; i++) { const x = ((SCP.t * (5 + i * 3) + i * D * .45) % (D + 240)) - 120, y = D * (.08 + i * .09); g.beginPath(); g.ellipse(x, y, 70 + i * 14, 13, 0, 0, TAU); g.ellipse(x + 38, y - 8, 46, 12, 0, 0, TAU); g.ellipse(x - 34, y + 3, 40, 10, 0, 0, TAU); g.fill(); }
  // oiseaux (teintés selon l'heure)
  const bc = SCP.bc; if (bc.width !== D) { bc.width = D; bc.height = D; } const b2 = bc.getContext('2d'); b2.clearRect(0, 0, D, D);
  for (const b of SCP.birds) (b.sw ? drawSwanSc : b.hm ? drawHummSc : drawParrotSc)(b2, b, SCP.t);
  const tn = ds.tint; if (tn[3] > .01) { b2.globalCompositeOperation = 'source-atop'; b2.fillStyle = 'rgba(' + Math.round(tn[0]) + ',' + Math.round(tn[1]) + ',' + Math.round(tn[2]) + ',' + Math.min(.7, tn[3] * 1.6) + ')'; b2.fillRect(0, 0, D, D); b2.globalCompositeOperation = 'source-over'; }
  g.globalAlpha = .91; g.drawImage(bc, sh, sv); g.globalAlpha = 1;
  }
  // vignette de la lentille
  const vg = g.createRadialGradient(R, R, R * .62, R, R, R); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,.6)'); g.fillStyle = vg; g.fillRect(0, 0, D, D);
  const hg = g.createRadialGradient(R * .6, R * .55, 4, R * .6, R * .55, R * .9); hg.addColorStop(0, 'rgba(255,255,255,.12)'); hg.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = hg; g.fillRect(0, 0, D, D);
  g.restore();
  if (fOk) g.drawImage(imgScopeFrame, cx - F / 2, cy - F / 2, F, F);
  else { g.lineWidth = Math.max(8, R * .05); g.strokeStyle = '#b8862b'; g.beginPath(); g.arc(cx, cy, R + g.lineWidth / 2 - 1, 0, TAU); g.stroke(); }
  SCP.raf = requestAnimationFrame(scopeFrame);
}
const imgSky = new Image(); imgSky.src = 'assets/sky_night.jpg';
const STR = { pre: 0 };   // pose longue-vue avant d'ouvrir le ciel
function drawSkyLens(g, D, R, dt) {   // le ciel étoilé défile dans la lentille
  g.fillStyle = '#0b1030'; g.fillRect(0, 0, D, D);
  if (imgSky.complete && imgSky.naturalWidth) {
    if (!SCP.drag && !(keys.ArrowLeft || keys.KeyA || keys.ArrowRight || keys.KeyD)) SCP.pan += SCP.dir * dt * .018;
    if (SCP.pan > 1) { SCP.pan = 1; SCP.dir = -1; } if (SCP.pan < 0) { SCP.pan = 0; SCP.dir = 1; }
    const ih = imgSky.naturalHeight, iw = imgSky.naturalWidth, side0 = ih * .72, side = side0 / (SCP.zoom || 1), sx = (iw - side0) * SCP.pan + (side0 - side) / 2, sy = (ih - side0) * SCP.py + (side0 - side) / 2;
    g.drawImage(imgSky, sx, sy, side, side, -D * .04, -D * .04, D * 1.08, D * 1.08);
  }
  g.fillStyle = '#fff';
  for (let i = 0; i < 26; i++) { const x = (i * 211 + SCP.pan * 300) % D, y = (i * 137) % D; g.globalAlpha = .15 + .6 * Math.max(0, Math.sin(SCP.t * 1.9 + i * 1.7)); g.fillRect(x, y, 1.6, 1.6); }
  g.globalAlpha = 1;
  SCP.shootT -= dt; if (!SCP.shoot && SCP.shootT <= 0) { SCP.shoot = { x: D * (.15 + Math.random() * .6), y: D * (.05 + Math.random() * .3), u: 0 }; SCP.shootT = 5 + Math.random() * 6; }
  if (SCP.shoot) { const s = SCP.shoot; s.u += dt * .75; const hx = s.x + s.u * D * .5, hy = s.y + s.u * D * .26, a = Math.sin(Math.min(1, s.u) * Math.PI);
    const gr = g.createLinearGradient(hx, hy, hx - D * .22, hy - D * .11); gr.addColorStop(0, 'rgba(255,255,255,' + a + ')'); gr.addColorStop(1, 'rgba(180,200,255,0)');
    g.strokeStyle = gr; g.lineWidth = 3; g.lineCap = 'round'; g.beginPath(); g.moveTo(hx, hy); g.lineTo(hx - D * .22, hy - D * .11); g.stroke();
    g.fillStyle = 'rgba(255,255,255,' + a + ')'; g.beginPath(); g.arc(hx, hy, 3.2, 0, TAU); g.fill();
    if (s.u >= 1) SCP.shoot = null; }
}
function startStars(withStar) {
  if (STR.pre > 0 || scopeOpen() || player.state !== 'free' || IN.on) return;
  player.state = 'talk'; player.mvx = player.mvy = 0; STR.pre = .9; STR.star = !!withStar; setAnim('idle');
}
function openScope(which = 0, sky = false) {
  tutDone('scope'); $('#scopeHint').style.display = tutSeen.scopeHint ? 'none' : ''; SCP.hintT = 0; SCP.sky = sky; $('#scopeHint').textContent = sky ? '✨ Contemple les étoiles… glisse avec le doigt ou la souris' : 'Glisse pour regarder autour · pince ou molette pour zoomer'; SCP.dir = 1; SCP.shootT = sky ? (STR.star ? .3 : 1.5) : 0; SCP.shoot = null;
  if (scopeOpen()) return; SCP.which = which; SCP.py = .5; SCP.vy = 0; SCP.btn = null; player.mvx = player.mvy = 0; setAnim('idle'); SCP.birds = []; SCP.next = .6; SCP.t = 0; SCP.lastMx = undefined; SCP.rot = 0; SCP.zoom = 1; SCP.ptrs = {}; SCP.pan = (!which && !sky) ? 0 : .5; SCP.vel = 0;
  $('#scope').style.display = 'block'; SCP.last = performance.now(); if (!SCP.raf) SCP.raf = requestAnimationFrame(scopeFrame); blip(520, .12, 'sine', .08); blip(780, .12, 'sine', .06, .1);
}
function closeScope() { $('#scope').style.display = 'none'; if (SCP.sky) { SCP.sky = false; if (player.state === 'talk') player.state = 'free'; } actQueued = false; IN.cool = Math.max(IN.cool || 0, .3); }
document.querySelectorAll('.scArr').forEach(b => { const st = e => { e.preventDefault(); e.stopPropagation(); SCP.btn = b.dataset.d; }, en = e => { SCP.btn = null; }; b.addEventListener('pointerdown', st); ['pointerup', 'pointercancel', 'pointerleave'].forEach(ev => b.addEventListener(ev, en)); });
$('#scopeX').addEventListener('click', e => { e.stopPropagation(); closeScope(); });
{ const sc = $('#scope');
  sc.addEventListener('pointerdown', e => { if (e.target.id === 'scopeX' || e.target.classList.contains('scArr')) return; SCP.drag = { x: e.clientX, y: e.clientY, moved: 0 }; (SCP.ptrs = SCP.ptrs || {})[e.pointerId] = [e.clientX, e.clientY]; if (Object.keys(SCP.ptrs).length === 2) { const q = Object.values(SCP.ptrs); SCP.pd = Math.hypot(q[0][0] - q[1][0], q[0][1] - q[1][1]); SCP.z0 = SCP.zoom || 1; } });
  sc.addEventListener('wheel', e => { e.preventDefault(); SCP.zoom = Math.max(1, Math.min(2.5, (SCP.zoom || 1) * Math.exp(-e.deltaY * .0015))); }, { passive: false });
  sc.addEventListener('pointermove', e => { if (SCP.ptrs && SCP.ptrs[e.pointerId]) SCP.ptrs[e.pointerId] = [e.clientX, e.clientY]; if (SCP.ptrs && Object.keys(SCP.ptrs).length >= 2) { const q = Object.values(SCP.ptrs), d = Math.hypot(q[0][0] - q[1][0], q[0][1] - q[1][1]); if (SCP.pd > 10) SCP.zoom = Math.max(1, Math.min(2.5, SCP.z0 * d / SCP.pd)); if (SCP.drag) SCP.drag.moved = 99; SCP.drag && (SCP.drag.x = e.clientX, SCP.drag.y = e.clientY); return; } if (!SCP.drag) return; const dx = e.clientX - SCP.drag.x, dy = e.clientY - (SCP.drag.y === undefined ? e.clientY : SCP.drag.y); SCP.drag.x = e.clientX; SCP.drag.y = e.clientY; SCP.drag.moved += Math.abs(dx) + Math.abs(dy); SCP.pan = Math.max(0, Math.min(1, SCP.pan - dx / (SCP.D || 500) * .9 * (SCP.which || SCP.sky ? 1 : .32) / (SCP.zoom || 1))); SCP.py = Math.max(0, Math.min(1, SCP.py - dy / (SCP.D || 500) * .9 / (SCP.zoom || 1))); });
  const up = e => { if (SCP.ptrs) delete SCP.ptrs[e.pointerId]; const d = SCP.drag; SCP.drag = Object.keys(SCP.ptrs || {}).length ? { x: e.clientX, y: e.clientY, moved: 99 } : null; if (d && d.moved < 8 && e.target.id !== 'scopeX' && !(e.target.id === 'scopeCv' && false)) { /* simple touche : on reste, la croix ferme */ } };
  sc.addEventListener('pointerup', up); sc.addEventListener('pointercancel', up); }
addEventListener('keydown', e => { if (scopeOpen() && (e.code === 'Escape' || e.code === 'Space' || e.code === 'Enter' || e.code === 'KeyE')) { closeScope(); e.preventDefault(); } }, true);
let SC = SC_HOME, IN_W = SC.W, IN_H = SC.H, IN_K = SC.K, IN_FLOORS = SC.floors, IN_EXIT = SC.exit, IN_LADDER = SC.ladder;
function setScene(sc) { SC = sc; IN_W = sc.W; IN_H = sc.H; IN_K = sc.K; IN_FLOORS = sc.floors; IN_EXIT = sc.exit; IN_LADDER = sc.ladder; }
const HOUSES = [
  { id: 'home', name: 'La maison de Myah', lab: [172, 84], door: [188, 197], exit: [188, 211], r: 11, scene: SC_HOME },
  { id: 'care', name: 'Le Poste de Soin', lab: [342, 176], door: [350, 243], exit: [350, 250], r: 11, scene: SC_CARE },
  { id: 'hall', name: "Le Comptoir de Maïmaï", lab: [418, 128], door: [430, 188], exit: [430, 201], r: 11, scene: SC_HALL },
  { id: 'museum', name: 'Musée Kaïkiti', lab: [628, 52], door: [628, 110], exit: [616, 126], r: 11, scene: SC_MUS },
  { id: 'boat', name: 'Le Bateau', door: [182, 424], exit: [164, 422], r: 8, scene: SC_BOAT },
  { id: 'obs', name: "L'Observatoire", lab: [770, 36], door: [760, 82], exit: [760, 92], r: 9, scene: SC_OBS },
];
let HOUSE = HOUSES[0];
function inPoly(poly, x, y) {
  let c = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i], b = poly[j];
    if ((a[1] > y) !== (b[1] > y) && x < (b[0] - a[0]) * (y - a[1]) / (b[1] - a[1]) + a[0]) c = !c;
  }
  return c;
}
function swapScene(fn) {   // fondu au noir -> changement -> retour de la lumière
  if (IN.busy) return; IN.busy = true; player.mvx = player.mvy = 0;
  fadeEl.classList.add('on');
  setTimeout(() => { fn(); fadeEl.classList.remove('on'); setTimeout(() => { IN.busy = false; }, 500); }, 520);
}
function enterHouse(h) {
  if (!h.scene) { say('Cette porte est fermée pour le moment 🚪', 3); IN.cool = 4; return; }
  swapScene(() => {
    HOUSE = h; setScene(h.scene);
    IN.prevTool = tool; setTool('none'); player.state = 'free'; player.dir4 = 'up'; setAnim('idle');
    IN.on = true; IN.floor = 0; IN.camY = null; IN.dk = null; IN.x = IN_EXIT[0]; IN.y = IN_EXIT[1] - (SC === SC_HOME ? 2 : 30); document.body.classList.add('inside'); sfx.hop && sfx.hop();
  });
}
function leaveHouse() {
  swapScene(() => {
    IN.on = false; document.body.classList.remove('inside'); setTool(IN.prevTool);
    player.x = HOUSE.exit[0]; player.y = HOUSE.exit[1]; player.dir4 = 'down'; player.mvx = player.mvy = 0; IN.cool = 2.5; sfx.hop && sfx.hop();
  });
}
const nearBunkLadder = () => SC === SC_HOME && IN.floor === 1 && !IN.lie && !IN.bunk && dist(IN.x, IN.y, LAD_SPOT[0], LAD_SPOT[1]) < 38;
const nearBed = () => SC === SC_HOME && IN.floor === 1 && !IN.lie && !IN.bunk && dist(IN.x, IN.y, BED_SPOT[0], BED_SPOT[1]) < 46;
let actHtml = '';
function setActLabel(txt) { const b = $('#bAct'); if (!b) return; if (txt) { actHtml = b.innerHTML; b.innerHTML = '<b class="actl">' + txt + '</b>'; } else if (actHtml) { b.innerHTML = actHtml; actHtml = ''; } }
function goToBed(which) {   // court écran noir, puis Myah apparaît couchée (zoom sur le lit)
  $('#bedPick').style.display = 'none';
  swapScene(() => { IN.lie = { bed: which, t: 0 }; IN.bunk = null; IN.zs = null; IN.camY = null; IN.dk = null; IN.x = BED_SPOT[0]; IN.y = BED_SPOT[1]; player.dir4 = 'down'; setActLabel('Se lever'); });
}
const nearShower = () => SC === SC_HOME && IN.floor === 0 && !IN.lie && dist(IN.x, IN.y, SHOWER.x, SHOWER.y) < SHOWER.r;
const waterSnd = { src: null, g: null };
function waterStart() {   // bruit d'eau : du souffle filtré, en boucle
  audio(); if (muted || !actx || waterSnd.src) return;
  try {
    const n = actx.sampleRate, buf = actx.createBuffer(1, n, n), d = buf.getChannelData(0); for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    const src = actx.createBufferSource(), f = actx.createBiquadFilter(), g = actx.createGain();
    src.buffer = buf; src.loop = true; f.type = 'bandpass'; f.frequency.value = 3200; f.Q.value = .5; g.gain.value = 0; g.gain.linearRampToValueAtTime(.07, actx.currentTime + .5);
    src.connect(f).connect(g).connect(masterOut()); src.start(); waterSnd.src = src; waterSnd.g = g;
  } catch (e) {}
}
function waterStop() {
  const { src, g } = waterSnd; if (!src) return; waterSnd.src = null;
  try { g.gain.cancelScheduledValues(actx.currentTime); g.gain.setValueAtTime(g.gain.value, actx.currentTime); g.gain.linearRampToValueAtTime(0, actx.currentTime + .4); src.stop(actx.currentTime + .45); } catch (e) {}
}
function showerOn() { IN.shower = { t: 0 }; IN.x = SHOWER.x; IN.y = SHOWER.y; player.dir4 = 'down'; waterStart(); setActLabel('Fermer l\'eau'); }
const BATH = {}; ['wash', 'towel_back', 'towel_backl', 'towel_front'].forEach(n => { const i = new Image(); i.src = 'assets/myah/' + (n === 'wash' ? 'bath_wash' : n) + '.png'; BATH[n] = i; });
let towelUntil = 0;   // après la douche : Myah reste en serviette quelques secondes
function bathDraw(n, x, y, h, flip) { const i = BATH[n]; if (!i || !i.complete || !i.naturalWidth) return false; const w = i.naturalWidth * h / i.naturalHeight; ctx.save(); ctx.translate(x, y); if (flip) ctx.scale(-1, 1); ctx.drawImage(i, -w / 2, -h, w, h); ctx.restore(); return true; }
function showerOff() { if (!IN.shower) return; towelUntil = time + 7; IN.shower = null; waterStop(); setActLabel(''); }
const TRUNK_SPOT = [708, 232];   // le coffre, au pied du grand lit
const nearTrunk = () => SC === SC_HOME && IN.floor === 1 && !IN.lie && !IN.bunk && !IN.climb && dist(IN.x, IN.y, TRUNK_SPOT[0], TRUNK_SPOT[1]) < 82 / (IN.zs || 1);   // la bulle « Changer de tenue » et Action marchent même depuis le haut de l'escalier
const nearTrunkAuto = () => nearTrunk() && dist(IN.x, IN.y, TRUNK_SPOT[0], TRUNK_SPOT[1]) < 30 / (IN.zs || 1);   // la question qui s'ouvre toute seule : tout près du coffre
// places où Myah s'assoit (le canapé, deux chaises) : ap = où elle se tient pour y aller, pos = où elle est assise ; la moitié basse est cachée par le meuble
const SEATS = [
  { id: 'sofa', line: [[462, 592], [545, 606], [605, 645], [668, 594]], ap: [612, 668], pos: [590, 596], dir: 'down', cut: 2, drop: 53, fg: null, legs: true, spr: { n: 'sit34', f: true, at: [568, 590] } },
  { id: 'chairL', off: true, ap: [765, 615], pos: [790, 600], dir: 'right', cut: 2, drop: 0, fg: 'table', spr: { n: 'sitp', f: false, at: [786, 618] } },
  { id: 'chairR', ap: [1012, 615], pos: [982, 600], dir: 'left', cut: 2, drop: 0, fg: 'table', spr: { n: 'sitp', f: true, at: [985, 618] } },
  { id: 'careL', sc: SC_CARE, ap: [237, 827], pos: [243, 872], dir: 'right', cut: 2, drop: 0, fg: null, spr: { n: 'sitp', f: false, at: [243, 876] } },
  { id: 'careR', sc: SC_CARE, ap: [433, 952], pos: [387, 960], dir: 'right', cut: 2, drop: 0, fg: null, spr: { n: 'sitp', f: false, at: [387, 964] } },
  { id: 'hallL', sc: SC_HALL, ap: [237, 827], pos: [243, 872], dir: 'right', cut: 2, drop: 0, fg: null, spr: { n: 'sitp', f: false, at: [243, 876] } },
  { id: 'hallR', sc: SC_HALL, ap: [433, 952], pos: [387, 960], dir: 'right', cut: 2, drop: 0, fg: null, spr: { n: 'sitp', f: false, at: [387, 964] } },
  { id: 'obsA', sc: SC_OBS, ap: [316, 680], pos: [277, 668], hl: [280, 660], dir: 'down', cut: 2, drop: 0, fg: null, spr: { n: 'sit1', f: false, at: [277, 672] } },
  { id: 'obsB', sc: SC_OBS, ap: [171, 947], pos: [165, 872], hl: [168, 866], dir: 'down', cut: 2, drop: 0, fg: null, spr: { n: 'sit1', f: false, at: [165, 876] } },
  { id: 'boatA', sc: SC_BOAT, ap: [656, 691], pos: [668, 700], dir: 'left', cut: 2, drop: 0, fg: null, spr: { n: 'sit34', f: true, at: [668, 702] } },
  { id: 'boatB', sc: SC_BOAT, ap: [776, 585], pos: [782, 612], dir: 'left', cut: 2, drop: 0, fg: null, spr: { n: 'sit34', f: true, at: [782, 614] } },
  { id: 'wc', ap: [1150, 628], pos: [1203, 549], hl: [1205, 495], dir: 'down', cut: 22, drop: 50, fg: null, cloud: true, label: 'Aller aux toilettes' },   // les toilettes : un petit nuage cache Myah
];
const TABLE_FG = [[800, 585], [830, 570], [900, 566], [965, 580], [972, 612], [940, 648], [880, 660], [820, 650], [795, 625]];   // le plateau de la table : il passe devant Myah assise
const WASH = [   // se laver les mains : l'évier de la cuisine et celui de la salle de bain
  { id: 'kitchen', x: 300, y: 592, tap: [287, 448], basin: [296, 463], hl: [292, 392] },
  { id: 'bath', x: 1103, y: 578, tap: [1099, 457], basin: [1106, 479], hl: [1112, 348] },
];
const segD = (px, py, a, b) => { const dx = b[0] - a[0], dy = b[1] - a[1], l = dx * dx + dy * dy, u = l ? clamp(((px - a[0]) * dx + (py - a[1]) * dy) / l, 0, 1) : 0; return Math.hypot(px - a[0] - u * dx, py - a[1] - u * dy); };
const SOFA_SIL = [[450,545],[520,505],[665,525],[668,592],[665,625],[605,655],[545,620],[500,604],[462,592]];   // silhouette du canapé du milieu (dossier + accoudoirs)
const behindSofa = (x, y) => x > 430 && x < 700 && y > 470 && (663 - 452) * (y - 547) - (623 - 547) * (x - 452) < 0;   // du côté du dossier : au-dessus du bord arrière du canapé
const nearSeat = () => IN.floor === 0 && !IN.shower && !IN.sit && !IN.wash && !(SC === SC_HOME && behindSofa(IN.x, IN.y)) && SEATS.find(t => !t.off && ((t.sc || SC_HOME) === SC && t.line ? t.line.some((q, i) => i && segD(IN.x, IN.y, t.line[i - 1], q) < 30) : dist(IN.x, IN.y, t.ap[0], t.ap[1]) < 38));   // le canapé : tout le devant et le côté droit
const nearWash = () => SC === SC_HOME && IN.floor === 0 && !IN.shower && !IN.sit && !IN.wash && player.dir4 === 'up' && WASH.find(w => dist(IN.x, IN.y, w.x, w.y) < 28);
function sitDown(t) { IN.sit = { seat: t, t: 0 }; player.dir4 = t.dir; player.face = t.dir === 'left' ? -1 : 1; setActLabel('Se lever'); }
function standUp() { const t = IN.sit && IN.sit.seat; IN.sit = null; if (t) { IN.x = t.ap[0]; IN.y = t.ap[1]; } setActLabel(''); }
function washOn(w) { IN.wash = { w, t: 0 }; IN.x = w.x; IN.y = w.y; player.dir4 = 'left'; player.face = -1; waterStart(); setActLabel('Fermer l\'eau'); }
function washOff() { if (!IN.wash) return; IN.wash = null; waterStop(); setActLabel(''); }
const wardOpen = () => $('#wardrobe').style.display === 'grid';
const wd = { o: null, part: 'overall', sel: -1, drag: null, frame: document.createElement('canvas'), wheel: null };
wd.frame.width = wd.frame.height = 256;
const WD_DEF = { shirt: { h: 2, s: .35 }, overall: { h: 347, s: .45 }, shoes: { h: 22, s: .55 }, hair: { h: 25, s: .6 }, glasses: { h: 350, s: .5 }, bag: { h: 270, s: .35 } };
const WD_PASTEL = [[350,.7,.8],[335,.8,.84],[20,.85,.8],[35,.9,.78],[50,.9,.8],[80,.6,.78],[150,.5,.78],[175,.6,.78],[200,.8,.8],[215,.7,.8],[250,.6,.82],[280,.55,.82],[310,.5,.82],[40,.4,.92],[0,0,.8],[25,.25,.68]];   // pastels doux
const WD_SW = [[352, .85, .55], [330, .75, .62], [20, .9, .55], [48, .95, .55], [95, .55, .48], [165, .65, .42], [195, .85, .55], [225, .65, .5], [275, .55, .6], [0, 0, .95], [0, 0, .5], [0, 0, .15]];
const wdIdx = () => myIdx.walk.down1, wdBox = () => MBOX.walk && MBOX.walk[wdIdx()];
function wdTarget() {   // la couleur en cours de réglage : une pièce, ou le sticker choisi
  if (wd.part === 'stickers') return wd.sel >= 0 && wd.o.stickers[wd.sel] ? wd.o.stickers[wd.sel].tint : null;
  return wd.o[wd.part];
}
function wdSetTarget(c) { if (wd.part === 'saved') return; if (wd.part === 'stickers') { if (wd.sel >= 0 && wd.o.stickers[wd.sel]) wd.o.stickers[wd.sel].tint = c; } else { wd.o[wd.part] = c; if (wd.part === 'bag' && c) wd.o.bagOn = true; } }
function wdDrawWheel() {
  const cv = $('#wdWheel'), x = cv.getContext('2d'), R = cv.width / 2;
  if (!wd.wheel) {
    const w = document.createElement('canvas'); w.width = w.height = cv.width; const wx = w.getContext('2d'), id = wx.createImageData(w.width, w.width);
    for (let j = 0; j < w.width; j++) for (let i = 0; i < w.width; i++) {
      const dx = i - R + .5, dy = j - R + .5, r = Math.hypot(dx, dy) / R, o = (j * w.width + i) * 4; if (r > 1) { id.data[o + 3] = 0; continue; }
      const h = (Math.atan2(dy, dx) * 180 / Math.PI + 360) % 360, sat = Math.min(1, r), l = .5, a = sat * Math.min(l, 1 - l), f = n => { const k = (n + h / 30) % 12; return l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1)); };
      id.data[o] = f(0) * 255; id.data[o + 1] = f(8) * 255; id.data[o + 2] = f(4) * 255; id.data[o + 3] = r > .985 ? 255 * (1 - (r - .985) / .015) : 255;
    }
    wx.putImageData(id, 0, 0); wd.wheel = w;
  }
  x.clearRect(0, 0, cv.width, cv.height); x.drawImage(wd.wheel, 0, 0);
  const t = wdTarget(); if (t) {
    const a = t.h * Math.PI / 180, r = t.s * R * .96, px = R + Math.cos(a) * r, py = R + Math.sin(a) * r;
    x.lineWidth = 5; x.strokeStyle = '#fff'; x.beginPath(); x.arc(px, py, 13, 0, TAU); x.stroke(); x.lineWidth = 2; x.strokeStyle = '#333'; x.beginPath(); x.arc(px, py, 15.5, 0, TAU); x.stroke();
  }
}
const WD_HANDLES = [[-1, -1], [0, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [0, 1], [1, 1]];
function wdStkRect(st, box) {   // rectangle du sticker choisi, en unités de l'aperçu (256)
  const bw = box[2] - box[0], sc = stickerCanvas(st.id, st.tint), asp = sc ? sc.height / sc.width : 1, hw = st.w * bw / 2;
  return { cx: box[0] + st.u * bw, cy: box[1] + st.v * bw, hw, hh: hw * asp * (st.sy || 1), asp, bw };
}
function wdDraw() {
  if (wd.part === 'bag') wdBagUi();
  const o = wd.o, cur = JSON.stringify(o), now = performance.now();   // historique pour « Retour » : un pas par série de changements
  if (wd.last !== undefined && cur !== wd.last && !wd.undoing) { if (now - (wd.lastChange || 0) > 500) { wd.hist.push(wd.last); if (wd.hist.length > 80) wd.hist.shift(); } wd.lastChange = now; wd.redo = []; }
  wd.last = cur; $('#wdUndo').disabled = !wd.hist.length; $('#wdRedo').disabled = !(wd.redo && wd.redo.length); renderFrameOutfit('walk', wdIdx(), o, wd.frame);
  const cv = $('#wdPrev'), x = cv.getContext('2d'), k = cv.width / 256; x.clearRect(0, 0, cv.width, cv.height);
  x.fillStyle = 'rgba(0,70,80,.18)'; x.beginPath(); x.ellipse(cv.width / 2, 213 * k, 52 * k, 9 * k, 0, 0, TAU); x.fill();
  x.imageSmoothingEnabled = true; x.drawImage(wd.frame, 0, 0, cv.width, cv.height);
  const box = wdBox(); if (box && wd.part === 'stickers' && wd.sel >= 0 && o.stickers[wd.sel]) {   // cadre de sélection du sticker, avec des poignées pour l'étirer
    const R = wdStkRect(o.stickers[wd.sel], box), M = 6;   // le cadre est un peu plus grand que le sticker, pour que les poignées ne le cachent pas
    x.save(); x.setLineDash([6, 5]); x.lineWidth = 3; x.strokeStyle = '#fff'; x.strokeRect((R.cx - R.hw - M) * k, (R.cy - R.hh - M) * k, (R.hw + M) * 2 * k, (R.hh + M) * 2 * k); x.lineWidth = 1.5; x.strokeStyle = '#c7447a'; x.strokeRect((R.cx - R.hw - M) * k, (R.cy - R.hh - M) * k, (R.hw + M) * 2 * k, (R.hh + M) * 2 * k); x.setLineDash([]);
    WD_HANDLES.forEach(([hx, hy]) => { const px = (R.cx + hx * (R.hw + M)) * k, py = (R.cy + hy * (R.hh + M)) * k; x.beginPath(); x.arc(px, py, 7.5, 0, TAU); x.fillStyle = '#fff'; x.fill(); x.lineWidth = 2.5; x.strokeStyle = '#c7447a'; x.stroke(); });
    x.restore();
  }
  wdDrawWheel();
  const t = wdTarget(); $('#wdLum').value = Math.round((t ? t.l : .5) * 100);
  { const hh = t ? Math.round(t.h) : 0, ss = t ? Math.round(t.s * 100) : 0; $('#wdLum').style.setProperty('--lg', 'linear-gradient(90deg,hsl(' + hh + ',' + ss + '%,12%),hsl(' + hh + ',' + ss + '%,50%),hsl(' + hh + ',' + Math.round(ss * .8) + '%,92%))'); }
}
function wdTab(part) {
  wd.part = part; $('#wardrobe').classList.toggle('savedMode', part === 'saved'); document.querySelectorAll('.wdTabs button').forEach(b => b.classList.toggle('sel', b.dataset.part === part));
  $('#wardrobe').classList.toggle('stkMode', part === 'stickers'); $('#wdStk').style.display = part === 'stickers' ? 'flex' : 'none'; $('#wdBag').style.display = part === 'bag' ? 'flex' : 'none'; if (part === 'bag') wdBagUi(); $('#wdOrig').textContent = part === 'stickers' ? 'Couleur d\'origine du sticker' : 'Couleur d\'origine'; wdDraw();
}
function wdPickColor(e) {
  const cv = $('#wdWheel'), r0 = cv.getBoundingClientRect(), R = r0.width / 2, dx = e.clientX - r0.left - R, dy = e.clientY - r0.top - R;
  let t = wdTarget(); if (!t && wd.part === 'stickers' && wd.sel < 0) return;
  const h = (Math.atan2(dy, dx) * 180 / Math.PI + 360) % 360, sat = Math.min(1, Math.hypot(dx, dy) / (R * .96));
  wdSetTarget({ h, s: sat, l: t ? t.l : (wd.part === 'bag' ? .75 : .5) }); wdDraw();
}
const WD_SAVE_KEY = 'ile-du-cygne-myah-v3-looks';   // tenues enregistrées dans la valise (sur cet appareil)
const WD_SLOTS = 10;
let wdSaved = []; try { const a = JSON.parse(localStorage.getItem(WD_SAVE_KEY) || '[]'); a.forEach(o => { if (o && o.stickers && wdSaved.length < WD_SLOTS) wdSaved.push(o); }); } catch (e) {}
while (wdSaved.length < WD_SLOTS) wdSaved.push(null);   // 10 cases, certaines vides
const wdSaveStore = () => { try { localStorage.setItem(WD_SAVE_KEY, JSON.stringify(wdSaved)); } catch (e) {} };
function wdRenderSaved() {
  const box = $('#wdSaved'); box.innerHTML = '';
  const tmp = document.createElement('canvas'); tmp.width = tmp.height = 256;
  wdSaved.forEach((o, i) => {
    const b = document.createElement('button'), c = document.createElement('canvas'); c.width = 52; c.height = 64; b.appendChild(c);
    if (o) {
      b.title = 'Remettre cette tenue';
      try { renderFrameOutfit('walk', wdIdx(), o, tmp); c.getContext('2d').drawImage(tmp, 52, 8, 152, 187, 0, 0, 52, 64); } catch (e) {}
      b.addEventListener('click', () => { wd.o = JSON.parse(JSON.stringify(o)); wd.sel = -1; wdDraw(); });
      const x = document.createElement('span'); x.className = 'x'; x.textContent = '×'; x.title = 'Supprimer cette tenue';
      x.addEventListener('click', e => { e.stopPropagation(); wdSaved[i] = null; wdSaveStore(); wdRenderSaved(); });
      b.appendChild(x);
    } else {
      b.className = 'empty'; b.title = 'Enregistrer la tenue en cours ici'; const p = document.createElement('span'); p.className = 'plus'; p.textContent = '+'; b.appendChild(p); c.style.display = 'none';
      b.addEventListener('click', () => { wdSaved[i] = JSON.parse(JSON.stringify(wd.o)); wdSaveStore(); wdRenderSaved(); });
    }
    box.appendChild(b);
  });
}
function wdBagUi() {
  const on = !!wd.o.bagOn; $('#wdBagOn').textContent = on ? '🎒 Porter le sac : OUI' : '🎒 Porter le sac : NON'; $('#wdBagOn').classList.toggle('on', on);
  const g = $('#wdBagP'); if (!g.children.length) {
    const mk = (label, val) => { const b = document.createElement('button'); b.dataset.v = val; if (label) b.textContent = label; g.appendChild(b); return b; };
    mk('Sans', -1).addEventListener('click', () => { wd.o.patch = null; wd.o.bagOn = true; wdDraw(); });
    BAG_PATCHES.forEach((n, i) => { const b = mk('', i); b.title = n; const c = document.createElement('canvas'); c.width = c.height = 48; b.appendChild(c);
      const draw = () => { const im = BAGIMG.patches; if (!im || !im.complete || !im.naturalWidth) { setTimeout(draw, 300); return; } c.getContext('2d').drawImage(im, (i % 5) * 96, Math.floor(i / 5) * 96, 96, 96, 0, 0, 48, 48); }; draw();
      b.addEventListener('click', () => { wd.o.patch = i; wd.o.bagOn = true; wdDraw(); }); });
  }
  const sg = $('#wdBagS'); if (!sg.children.length) STK.forEach(d => { const b = document.createElement('button'); b.title = d.n; const c = document.createElement('canvas'); c.width = c.height = 40; b.appendChild(c);
    const draw = () => { const sc = stickerCanvas(d.id); if (!sc) { setTimeout(draw, 300); return; } const k = Math.min(36 / sc.width, 36 / sc.height); c.getContext('2d').drawImage(sc, (40 - sc.width * k) / 2, (40 - sc.height * k) / 2, sc.width * k, sc.height * k); }; draw();
    b.addEventListener('click', () => { if (!wd.o.bagStk) wd.o.bagStk = []; if (wd.o.bagStk.length >= 3) return; const slot = [[.28, .74], [.72, .74], [.5, .84]][wd.o.bagStk.length]; wd.o.bagStk.push({ id: d.id, u: slot[0], v: slot[1] }); wd.o.bagOn = true; wdDraw(); }); sg.appendChild(b); });
  [...g.children].forEach(b => b.classList.toggle('sel', +b.dataset.v === (Number.isInteger(wd.o.patch) ? wd.o.patch : -1)));
}
function wdFillStickers() {
  const gL = $('#wdStkL'), gR = $('#wdStkR'); gL.innerHTML = ''; gR.innerHTML = '';
  STK.forEach((d, si) => { const g = si < 8 ? gL : gR; const b = document.createElement('button'); b.title = d.n; const c = document.createElement('canvas'); c.width = 64; c.height = 64; b.appendChild(c);
    const draw = () => { const sc = stickerCanvas(d.id); if (!sc) { setTimeout(draw, 300); return; } const cx = c.getContext('2d'), k = Math.min(60 / sc.width, 60 / sc.height); cx.clearRect(0, 0, 64, 64); cx.drawImage(sc, (64 - sc.width * k) / 2, (64 - sc.height * k) / 2, sc.width * k, sc.height * k); }; draw();
    b.addEventListener('click', () => { if (wd.o.stickers.length >= 8) return; const slot = [[.5, .6], [.28, 1.25], [.72, 1.25], [.28, 1.85], [.72, 1.85], [.5, 1.55], [.5, .2], [.5, 2.0]][wd.o.stickers.length % 8]; wd.o.stickers.push({ id: d.id, u: slot[0], v: slot[1], w: .42, tint: null }); wd.sel = wd.o.stickers.length - 1; wdDraw(); });
    g.appendChild(b); });
}
function openWardrobe() {
  wd.o = JSON.parse(JSON.stringify(outfit)); wd.sel = -1; wd.part = 'overall'; wd.hist = []; wd.redo = []; wd.last = undefined; wd.lastChange = 0; wd.undoing = false; $('#wardrobe').style.display = 'grid';
  if (!$('#wdStkL').children.length) {
    wdFillStickers();
    const fill = (sel, list) => { const sw = $(sel); list.forEach(c => { const i = document.createElement('i'); i.style.background = 'hsl(' + c[0] + ',' + Math.round(c[1] * 100) + '%,' + Math.round(c[2] * 100) + '%)'; i.addEventListener('click', () => { const t = wdTarget(); if (!t && wd.part === 'stickers' && wd.sel < 0) return; wdSetTarget({ h: c[0], s: c[1], l: wd.part === 'bag' ? Math.max(c[2], .7) : c[2] }); wdDraw(); }); sw.appendChild(i); }); };
    fill('#wdSwP', WD_PASTEL); fill('#wdSw', WD_SW.map(c => [c[0], c[1], c[2] === .5 || c[2] === .15 || c[2] === .95 ? c[2] : .5]));
  }
  wdRenderSaved(); wdTab('overall');
}
function closeWardrobe(ok) {
  $('#wardrobe').style.display = 'none'; $('#wdHelp').style.display = 'none'; wd.drag = null;
  if (ok && JSON.stringify(wd.o) !== JSON.stringify(outfit)) IN.puff = { t: 0, apply: JSON.parse(JSON.stringify(wd.o)) };   // nuage, puis la tenue change
}
const puffAmt = () => IN.puff ? Math.sin(Math.PI * clamp(IN.puff.t / 1.5, 0, 1)) : 0;
function askSleep(which) { bedAsk = which; $('#bedPickT').textContent = 'Dormir'; $('#bedPickP').textContent = 'Veux-tu aller dormir ?'; $('#bedPick').style.display = 'grid'; }
let askHouse = null;
const boatFree = () => qState.toto === 'active';   // pendant sa quête, Myah monte sur le bateau sans lui demander
function askBoat() {   // Zyno propose de monter sur le bateau
  const h = HOUSES.find(o => o.id === 'boat'); if (!h || bedPickOpen() || IN.busy) return;
  h.askUntil = 0; askEnter(h); $('#bedPickT').textContent = 'Le bateau'; $('#bedPickP').textContent = 'Zyno : « Tu veux monter sur mon bateau ? »';
}
function askEnter(h) {   // devant une porte : on demande avant d'entrer ; après « Non », 15 s de tranquillité pour passer devant
  if (bedPickOpen() || IN.busy || (h.askUntil && time < h.askUntil)) return;
  askHouse = h; bedAsk = 'enter'; player.mvx = player.mvy = 0; $('#bedPickT').textContent = 'Entrer'; $('#bedPickP').textContent = 'Veux-tu entrer : ' + h.name + ' ?'; $('#bedPick').style.display = 'grid';
}
function paintBubble() {   // début de partie : bulle sur le petit coffre à mini-jeux (une seule fois, ~20 s ou jusqu'à l'ouverture des mini-jeux)
  if (tutSeen.paint || SC !== SC_HOME || IN.floor !== 1 || IN.lie || IN.bunk || IN.climb || bedPickOpen() || wardOpen() || IN.busy) return;
  const dh = Math.min(.1, Math.max(0, IN.t - (IN._pb || IN.t))); IN._pb = IN.t; tutAcc.paint = (tutAcc.paint || 0) + dh; if (tutAcc.paint > 20) { tutDone('paint'); return; }
  const t = (IS_TOUCH ? 'Touche' : 'Clique') + ' ici pour jouer aux mini-jeux', x = PAINT_SPOT[0], y = PAINT_SPOT[1] - 130 - 45 / (IN.zs || 1);
  ctx.save(); ctx.font = '800 14px "Trebuchet MS", sans-serif'; const w = ctx.measureText(t).width + 20, bob = Math.sin(IN.t * 3) * 2; ctx.globalAlpha = .96; ctx.fillStyle = '#fff'; ctx.strokeStyle = '#2d6f78'; ctx.lineWidth = 2; ctx.beginPath(); ctx.roundRect(x - w / 2, y - 12 + bob, w, 24, 12); ctx.fill(); ctx.stroke(); ctx.fillStyle = '#17606a'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(t, x, y + bob + 1); ctx.restore();
}
function askPaint(force) {   // « Tu veux dessiner ? » oui / non ; 15 s de tranquillité après « Non »
  if (bedPickOpen() || IN.busy || (!force && IN.askP && IN.t < IN.askP)) return;
  tutDone('paint'); bedAsk = 'paint'; $('#bedPickT').textContent = 'Mini-jeux'; $('#bedPickP').textContent = 'Tu veux jouer ou dessiner ?'; $('#bedPick').style.display = 'grid';
}
function askTrunk(force) {   // « Veux-tu ouvrir le coffre ? » ; après « Non », on ne reproposera pas avant 15 s (sauf si elle appuie elle-même sur Action)
  if (bedPickOpen() || IN.busy || (!force && IN.askK && IN.t < IN.askK)) return;
  bedAsk = 'trunk'; $('#bedPickT').textContent = 'Vestiaire'; $('#bedPickP').textContent = 'Veux-tu changer de tenue ?'; $('#bedPick').style.display = 'grid';
}
function askLeave(force) {   // on demande avant de sortir : sinon impossible d'aller jusqu'à la douche
  if (bedPickOpen() || IN.busy || (!force && IN.askT && IN.t < IN.askT)) return;
  bedAsk = 'exit'; $('#bedPickT').textContent = SC === SC_CABIN ? 'Pont' : SC === SC_BOAT ? 'Quitter' : 'Sortir'; $('#bedPickP').textContent = SC === SC_CABIN ? 'Veux-tu remonter sur le pont ?' : SC === SC_BOAT ? 'Veux-tu descendre du bateau ?' : 'Veux-tu sortir de la maison ?'; $('#bedPick').style.display = 'grid';
}
function askClimb(kind) {   // on demande avant de monter / descendre une échelle
  if (bedPickOpen() || IN.busy || IN.climb || (IN.askL && IN.t < IN.askL)) return;
  bedAsk = kind; const up = kind === 'up' || kind === 'bunk';
  $('#bedPickT').textContent = up ? 'Monter' : 'Descendre'; $('#bedPickP').textContent = up ? 'Veux-tu monter à l\'échelle ?' : 'Veux-tu descendre à l\'échelle ?'; $('#bedPick').style.display = 'grid';
}
function bunkClimb() { IN.bunk = { t: 0 }; IN.x = LAD_SPOT[0]; IN.y = LAD_SPOT[1]; player.dir4 = 'up'; setActLabel(''); }   // Myah grimpe l'échelle du lit superposé
function getUp() {
  const top = IN.lie && IN.lie.bed === 'top', sp = top ? LAD_SPOT : BED_SPOT;
  swapScene(() => { IN.lie = null; IN.zs = null; IN.camY = null; IN.dk = null; IN.x = sp[0]; IN.y = sp[1]; player.dir4 = 'down'; setActLabel(''); });
}
function climb(toFloor) {   // Myah s'engage sur l'échelle : ensuite c'est ↑ / ↓ qui la fait monter ou descendre
  if (IN.busy || IN.climb) return;
  const B = IN_LADDER[0], T = IN_LADDER[1];
  IN.climb = { u: toFloor ? 0 : 1 }; IN.x = B[0]; IN.y = toFloor ? B[1] + 6 : T[1] + 8; player.dir4 = 'up';
}
function updateInterior(dt) {
  IN.t += dt; time += dt;
  { const c = IN.climb, tgD = SC === SC_HOME ? (c ? Math.min(1, Math.max(0, c.u)) : (IN.floor === 1 ? 1 : 0)) * DK_UP : 0;
    if (IN.dk == null || c) IN.dk = tgD; else IN.dk += (tgD - IN.dk) * Math.min(1, dt * 6); }   // le bas de la maison est dans le noir quand on est à l'étage
  { const tg = sdbNear() ? 1 : 0; IN.sdb = (IN.sdb || 0) + (tg - (IN.sdb || 0)) * Math.min(1, dt * 5); }   // la salle de bain s'ouvre / se referme
  if (dlg.open || $('#coll').style.display === 'grid' || tipsOpen() || bedPickOpen() || wardOpen() || scopeOpen() || paintOpen() || memOpen() || puzOpen() || rytOpen() || miniMenuOpen()) { player.mvx = player.mvy = 0; setAnim('idle'); if (actQueued && dlg.open) advanceDialog(); actQueued = false; return; }
  if (tool !== 'none') setTool('none');
  jumpQueued = false; swanQueued = false;
  let ix = (keys.ArrowRight || keys.KeyD ? 1 : 0) - (keys.ArrowLeft || keys.KeyA ? 1 : 0), iy = (keys.ArrowDown || keys.KeyS ? 1 : 0) - (keys.ArrowUp || keys.KeyW ? 1 : 0);
  let mag = 0; { const l = Math.hypot(ix, iy); if (l) { ix /= l; iy /= l; mag = 1; } }
  let run = !!(keys.ShiftLeft || keys.ShiftRight);
  if (stick.active && stick.mag > 0.05) { ix = stick.x; iy = stick.y; const l = Math.hypot(ix, iy) || 1; ix /= l; iy /= l; mag = Math.max(stick.mag, .5); run = run || stick.mag > 0.97; }
  const moving = mag > .12, p = player;
  if (IN.lie) {   // Myah dort : plus de déplacement ; Action ou une direction la relève
    p.mvx = p.mvy = 0; p.state = 'free'; setAnim('idle'); IN.lie.t += dt;
    if (!IN.busy && IN.lie.t > .8 && (actQueued || moving)) getUp();
    actQueued = false; return;
  }
  if (IN.puff) {   // nuage de changement de tenue : la tenue change au plus épais
    const f = IN.puff; f.t += dt;
    if (f.apply && f.t > .6) { setOutfit(f.apply); f.apply = null; save(); sfx.unlock && sfx.unlock(); }
    if (f.t > 1.5) IN.puff = null;
    p.mvx = p.mvy = 0; setAnim('idle'); actQueued = false; return;
  }
  if (IN.bunk) {   // montée de l'échelle du lit du haut ; en haut, on demande si elle veut dormir
    const b = IN.bunk; const dir = bedPickOpen() ? 0 : (iy < -.3 ? 1 : iy > .3 ? -1 : 0); b.t = clamp(b.t + dir * dt * 1.1, 0, 1.5); const u = clamp(b.t / 1.5, 0, 1);   // à la main : ↑ monte, ↓ descend
    IN.x = LAD_SPOT[0] + (LAD_TOP[0] - LAD_SPOT[0]) * u; IN.y = LAD_SPOT[1] + (LAD_TOP[1] - LAD_SPOT[1]) * u;
    p.dir4 = 'up'; p.mvx = 0; p.mvy = dir ? -1 : 0; p.state = 'free'; setAnim(dir ? 'walk' : 'idle'); actQueued = false;
    if (dir < 0 && b.t <= 0) { IN.bunk = null; p.mvy = 0; p.dir4 = 'down'; IN.x = LAD_SPOT[0]; IN.y = LAD_SPOT[1]; setAnim('idle'); }
    else if (b.t >= 1.5 && !b.asked) { b.asked = true; p.mvy = 0; setAnim('idle'); askSleep('top'); }   // en haut : le message « Veux-tu aller dormir ? »
    else if (b.t < 1.2) b.asked = false;
    return;
  }
  if (IN.sit) {   // assise : on ne bouge plus, Action ou une direction la relève
    p.mvx = p.mvy = 0; p.state = 'free'; setAnim('idle'); p.dir4 = IN.sit.seat.dir; IN.sit.t += dt;
    if (IN.sit.t > .5 && (actQueued || moving)) { standUp(); actQueued = false; } else { actQueued = false; return; }
    return;
  }
  if (IN.wash) {   // se lave les mains : face à l'évier, l'eau coule
    p.mvx = p.mvy = 0; p.state = 'free'; setAnim('idle'); p.dir4 = 'up'; IN.wash.t += dt;
    if (IN.wash.t > .5 && (actQueued || moving)) { washOff(); actQueued = false; } else { actQueued = false; }
    return;
  }
  IN.steam = clamp((IN.steam || 0) + (IN.shower ? dt / 2.2 : -dt / 1.6), 0, 1);
  if (IN.shower) {   // sous la douche : on reste sur place, une direction ou Action coupe l'eau
    p.mvx = p.mvy = 0; p.state = 'free'; setAnim('idle'); IN.shower.t += dt;
    if (IN.shower.t > .5 && (actQueued || moving)) { showerOff(); actQueued = false; if (!moving) return; } else { actQueued = false; return; }
  }
  if (IN.landUntil) {   // arrivée en bas de l'échelle : elle attend d'être bien posée avant de se tourner de face
    if (IN.t < IN.landUntil) { p.mvx = p.mvy = 0; p.state = 'free'; p.dir4 = 'up'; setAnim('idle'); actQueued = false; return; }
    IN.landUntil = 0; p.dir4 = 'down'; }
  p.mvx = moving ? ix : 0; p.mvy = moving ? iy : 0; p.state = 'free';
  if (moving) { p.dir4 = Math.abs(iy) > Math.abs(ix) * 1.2 ? (iy > 0 ? 'down' : 'up') : (ix > 0 ? 'right' : 'left'); p.face = ix >= 0 ? 1 : -1; }
  setAnim(moving ? (run ? 'run' : 'walk') : 'idle');
  if (IN.climb) {   // l'échelle se monte / se descend à la main : on tient ↑ ou ↓ et on la voit grimper
    const c = IN.climb, B = IN_LADDER[0], T = IN_LADDER[1], len = Math.abs(B[1] - T[1]);
    const dir = iy < -.3 ? 1 : iy > .3 ? -1 : 0; c.u = clamp(c.u + dir * dt * 120 / len, 0, 1);
    IN.x = B[0]; IN.y = B[1] + (T[1] - B[1]) * c.u;
    p.dir4 = 'up'; p.mvx = 0; p.mvy = dir ? -1 : 0; setAnim(dir ? 'walk' : 'idle'); actQueued = false;
    if (c.u >= 1) { IN.floor = 1; IN.climb = null; p.mvy = 0; IN.y = T[1] + 8; IN.upT = IN.t + .6; }
    else if (c.u <= 0) { IN.floor = 0; IN.climb = null; p.mvy = 0; IN.y = B[1] + 6; IN.landUntil = IN.t + .4; }
    else IN.floor = c.u > .5 ? 1 : 0;
    return;
  }
  const poly = IN_FLOORS[IN.floor], sp = (run ? 62 : 43) * SC.K * .85 * mag;   // même vitesse qu'à l'extérieur, comptée en longueurs de Myah (la pièce est agrandie d'un facteur K)
  const bl = IN.floor === 0 ? (SC === SC_HOME && (IN.sdb || 0) < .5 ? SC.blocks.concat(SC.walls) : SC.blocks) : SC.blocks1, okAt = (x, y) => inPoly(poly, x, y) && !(bl && bl.some(b => inPoly(b, x, y)));
  if (moving) {
    const nx = IN.x + ix * sp * dt; let ny = IN.y + iy * sp * dt;
    if (okAt(nx, IN.y)) IN.x = nx;
    else if (SC === SC_HOME && IN.floor === 0 && ix > 0 && IN.x > 690 && IN.x < 870 && IN.y > 540 && IN.y < 640 && okAt(IN.x, IN.y - sp * dt)) { IN.y -= sp * dt * .9; ny = IN.y; }   // contourne le coin de la table par le haut (vers la salle de bain)
    if (okAt(IN.x, ny)) IN.y = ny;
  }
  // échelle : on monte / on descend en la poussant, ou avec Action
  const L = IN_LADDER[IN.floor];
  const nearL = IN.floor === 0 ? (IN.x > L[0] - 38 && IN.x < L[0] + 14 && Math.abs(IN.y - L[1]) < 26 && Math.abs(ix) < .5) : (Math.abs(IN.x - L[0]) < 24 && Math.abs(IN.y - L[1]) < 24 && Math.abs(ix) < .6 && !(IN.upT && IN.t < IN.upT));   // en haut : seulement pile au bord de l'échelle, pour ne pas basculer en descente en allant vers le coffre   // un peu plus de marge pour s'engager sur l'échelle
  if (IN.askL && !nearBunkLadder() && !nearL) IN.askL = 0;
  if (nearBunkLadder() && iy < -.5) { bunkClimb(); return; }
  if (nearL && ((IN.floor === 0 && iy < -.5) || (IN.floor === 1 && iy > .5))) climb(1 - IN.floor);
  // sortie : le seuil de la porte, en bas de la pièce
  if (IN.askK && !nearTrunk() && dist(IN.x, IN.y, TRUNK_SPOT[0], TRUNK_SPOT[1]) > 90) IN.askK = 0;
  if (IN.askH && !nearHatch() && dist(IN.x, IN.y, HATCH_SPOT[0], HATCH_SPOT[1]) > 90) IN.askH = 0;
  if (nearHatch() && !(IN.askH && IN.t < IN.askH)) { askHatch(); return; }
  if (IN.askP && !nearPaint() && dist(IN.x, IN.y, PAINT_SPOT[0], PAINT_SPOT[1]) > 90) IN.askP = 0;
  if (nearPaint() && !(IN.askP && IN.t < IN.askP)) { askPaint(); return; }
  if (IN.askT && dist(IN.x, IN.y, IN_EXIT[0], IN_EXIT[1]) > 95) IN.askT = 0;   // on s'éloigne de la porte : la question reviendra normalement
  if (IN.floor === 0 && dist(IN.x, IN.y, IN_EXIT[0], IN_EXIT[1]) < 40 && iy > .5) askLeave();
  if (actQueued) {
    actQueued = false;
    if (SC.npc && IN.floor === 0 && dist(IN.x, IN.y, SC.npc.x, SC.npc.y) < (SC.npc.r || 70)) { p.dir4 = 'up'; setAnim('idle'); const o = SC.npc.get(); if (o === JUL && (!unlocked(o) || qState[o.id] === 'done' || (qState[o.id] === 'new' && o !== QUESTS.find(z => qState[z.id] !== 'done')))) { openDialog(o.who, o.met ? chatter(o.npc) : (o.met = true, ['Bienvenue au Musée Kaïkiti, Myah ! Je suis Yulia, la directrice. Je veille sur nos trésors. 🏛️', 'Voici le tableau de la collection : les objets en gris sont ceux qu\'il reste à trouver. 🌸🐟']), () => { player.state = 'free'; openColl(); }, o.portrait); } else if (o.id) talkTo(o); else openDialog(o.who, o.met ? chatter(o.key) : (o.met = true, o.lines), () => { if (o === YUR) openColl(); }, o.portrait); }
    else if (nearScope()) openScope(nearScope() - 1);
    else if (nearPaint()) askPaint(true);
    else if (nearHatch()) askHatch(true);
    else if (nearTrunk()) askTrunk(true);
    else if (nearBunkLadder()) bunkClimb();
    else if (nearShower()) showerOn();
    else if (nearSeat()) sitDown(nearSeat());
    else if (nearHang()) hangEdOpen(nearHang());
    else if (nearWash()) washOn(nearWash());
    else if (nearBed()) askSleep('bottom');
    else if (IN.floor === 0 && dist(IN.x, IN.y, IN_EXIT[0], IN_EXIT[1]) < 70) askLeave(true);
    else if (nearL) climb(1 - IN.floor);
  }
}

/* toucher / cliquer sur la malle, la douche, les toilettes, le lavabo, les sièges : une aurole dorée marque l'endroit, la zone sensible est large */
function tapSpots() {
  if (!started || !IN.on || dlg.open || IN.busy || IN.lie || IN.climb || IN.bunk || IN.puff || bedPickOpen() || wardOpen()) return [];
  const L = [], z = IN.zs || 1;
  if (SC === SC_HOME && IN.floor === 1) { if (nearTrunk() || dist(IN.x, IN.y, TRUNK_SPOT[0], TRUNK_SPOT[1]) < 150 / z) L.push({ id: 'trunk', x: 632, y: 203, go: () => { tutDone('trunk'); actQueued = false; askTrunk(true); } });
    L.push({ id: 'paint', x: 955, y: 222, go: () => { actQueued = false; askPaint(true); } });
    return L; }
  if (IN.floor !== 0) return L;
  if (IN.shower) return [{ id: 'shower', x: SHOWER.x, y: SHOWER.y - 128, on: 1, go: () => { tutDone('shower'); showerOff(); } }];
  if (IN.wash) return [{ id: 'wash', x: IN.wash.w.hl[0], y: IN.wash.w.hl[1], on: 1, go: washOff }];
  if (IN.sit) { const t = IN.sit.seat; return [{ id: 'sit', x: t.hl ? t.hl[0] : t.pos[0], y: t.hl ? t.hl[1] : t.pos[1] - 95, on: 1, go: standUp }]; }
  if (SC === SC_HOME) {
    if (nearShower() || dist(IN.x, IN.y, SHOWER.x, SHOWER.y) < 130) L.push({ id: 'shower', x: SHOWER.x, y: SHOWER.y - 128, go: () => { tutDone('shower'); showerOn(); } });
    WASH.forEach(w => { if (dist(IN.x, IN.y, w.x, w.y) < 100) L.push({ id: 'wash', x: w.hl[0], y: w.hl[1], go: () => { tutDone('wash'); washOn(w); } }); });
  }
  if (SC === SC_OBS) SCOPE_SPOTS.forEach((s, i) => { if (dist(IN.x, IN.y, s[0], s[1]) < 120) L.push({ id: 'scope' + i, x: SCOPE_HL[i][0], y: SCOPE_HL[i][1], go: () => { actQueued = false; openScope(i); } }); });
  if (SC === SC_HOME) HANG_SLOTS.forEach(s => { if (s.floor === IN.floor && Math.abs(IN.x - (s.z[0] + s.z[2]) / 2) < 70) L.push({ id: 'hang_' + s.id, x: (s.z[0] + s.z[2]) / 2, y: (s.z[1] + s.z[3]) / 2, go: () => { tutDone('hang'); actQueued = false; hangEdOpen(s); } }); });
  const ns = nearSeat();
  SEATS.forEach(t => { if (t.off || (t.sc || SC_HOME) !== SC) return; if (ns === t || dist(IN.x, IN.y, t.ap[0], t.ap[1]) < 120) L.push({ id: t.id, x: t.hl ? t.hl[0] : t.pos[0], y: t.hl ? t.hl[1] : t.pos[1] - 85, go: () => { tutDone(t.id === 'wc' ? 'wc' : 'seat'); sitDown(t); } }); });
  return L;
}
function tapHalos() {   // petite aurole qui pulse là où l'on peut toucher
  const L = tapSpots(); if (!L.length) return;
  ctx.save();
  L.forEach(o => {
    const p = .5 + .5 * Math.sin(IN.t * 3.2), R = 19 + 2.5 * p;
    const g = ctx.createRadialGradient(o.x, o.y, 2, o.x, o.y, R); g.addColorStop(0, 'rgba(255,240,170,.55)'); g.addColorStop(.45, 'rgba(255,214,120,.28)'); g.addColorStop(1, 'rgba(255,214,120,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(o.x, o.y, R, 0, TAU); ctx.fill();
    ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(255,255,255,' + (.28 + .2 * p) + ')'; ctx.beginPath(); ctx.arc(o.x, o.y, 9 + 3.5 * p, 0, TAU); ctx.stroke();
    ctx.globalAlpha = .7; ctx.fillStyle = '#fff'; ctx.strokeStyle = '#e0a63a'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(o.x, o.y, 3.6, 0, TAU); ctx.fill(); ctx.stroke(); ctx.globalAlpha = 1;
  });
  ctx.restore();
}
cv.addEventListener('pointerdown', e => {
  if (!IN.on || !IN.view) return;
  const L = tapSpots(); if (!L.length) return;
  const r = cv.getBoundingClientRect(), v = IN.view, wx = (e.clientX - r.left - v.ox) / v.s, wy = (e.clientY - r.top - v.oy) / v.s, rad = Math.max(75, 50 / v.s);
  let best = null, bd = 1e9; L.forEach(o => { const d = dist(wx, wy, o.x, o.y); if (d < rad && d < bd) { bd = d; best = o; } });
  if (best) { lastSpotPtr = e.pointerId; e.stopPropagation(); best.go(); }
});
function steamPuffs(cx0, fy, st) {   // nuage de vapeur autour de (cx0, fy)
  ctx.save();
  for (let i = 0; i < 22; i++) {
    const ph = i / 22, u = (IN.t * .13 + ph * 3.1) % 1, side = Math.sin(i * 12.9898) * 43758.5453 % 1, ang = ph * TAU * 2.3;
    const cx = cx0 + Math.cos(ang) * (22 + 26 * Math.abs(side)) + Math.sin(IN.t * .8 + i) * 5, cy = fy - 26 - u * 105 + Math.sin(ang) * 14, r = (26 + 22 * Math.abs(side)) * (.6 + .7 * st);
    const al = st * .62 * Math.sin(Math.min(1, u * 1.25) * Math.PI * .9 + .25);
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r); g.addColorStop(0, 'rgba(255,255,255,' + al + ')'); g.addColorStop(.6, 'rgba(244,250,252,' + al * .7 + ')'); g.addColorStop(1, 'rgba(240,248,250,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, r, 0, TAU); ctx.fill();
  }
  ctx.restore();
}
function renderInterior(vw, vh) {
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.fillStyle = '#000'; ctx.fillRect(0, 0, vw, vh);
  const fit = Math.min(vw / IN_W, vh / IN_H) * .98;
  // écran large (PC) : on se rapproche et la caméra suit Myah en hauteur, pour réduire les bandes noires
  const s0 = vw / vh > .9 ? Math.max(fit, vw / (IN_W * 1.08)) : fit;
  // maison de Myah : plan rapproché, la caméra suit Myah (et se recentre sur le lit quand elle dort)
  const isHome = SC === SC_HOME;
  const dkz = isHome && !IN.lie ? Math.min(1, Math.max(0, (IN.dk || 0) / DK_UP)) : 0;   // à l'étage on zoome : on ne voit que le haut de l'échelle
  const sT = (isHome ? (IN.lie ? Math.min(vw / 700, vh / 340) : Math.min(Math.max(s0, vh / 520), Math.max(s0, vw / 650))) : s0) * (1 + .4 * dkz);
  if (IN.zsSC !== SC || IN.zs == null) { IN.zs = sT; IN.zsSC = SC; } else IN.zs += (sT - IN.zs) * .1;
  const s = IN.zs;
  const camX = IN.lie ? 700 : IN.x, camYt = IN.lie ? 200 : IN.y - 90 * dkz;
  let ox = (vw - IN_W * s) / 2; if (IN_W * s > vw) ox = Math.min(0, Math.max(vw - IN_W * s, vw / 2 - camX * s));
  let oy = (vh - IN_H * s) / 2 + 6;
  if (IN_H * s > vh) { const tgt = vh / 2 - camYt * s; IN.camY = IN.camY == null ? tgt : IN.camY + (tgt - IN.camY) * .12; oy = Math.min(0, Math.max(vh - IN_H * s, IN.camY)); } else IN.camY = null;
  ctx.setTransform(dpr * s, 0, 0, dpr * s, dpr * ox, dpr * oy); IN.view = { s, ox, oy };
  ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
  // les hublots laissent voir le ciel et la mer de la carte
  const holes = SC.holes;
  if (SC.chroma) { drawObsSky(); const cc = chromaCanvas(SC); if (cc) ctx.drawImage(cc, 0, 0); }
  else { const ds = dayState(), im = img[(ds.u < .5 ? ds.A : ds.B).n] || img.map;
    if (im && im.complete && im.naturalWidth) {
      if (SC === SC_HOME) {   // hublots de la maison : l'océan jusqu'à l'horizon, avec de petites îles au loin
        const TW = 420, dy0 = 75;   // bande de mer (la moitié gauche de la carte, sans maison) répétée en miroir ; l'horizon est recalé au milieu de chaque hublot
        holes.forEach((h, hi) => {
          const sh = h[1] + h[3] * .12 - 105;
          ctx.save(); ctx.beginPath(); ctx.ellipse(h[0], h[1], h[2] + 2, h[3] + 2, 0, 0, TAU); ctx.clip(); ctx.translate(0, sh);
          for (let n = -1; n <= 3; n++) {
            const B = 259 + TW * n; ctx.save(); if (n % 2) { ctx.translate(B + TW, 0); ctx.scale(-1, 1); } else ctx.translate(B, 0);
            ctx.drawImage(im, 0, 0, 560, 3, 0, -300, TW, dy0 + 301);
            ctx.drawImage(im, 0, 0, 560, 80, 0, dy0, TW, 60);
            ctx.drawImage(im, 0, 76, 560, 4, 0, dy0 + 59, TW, 300);
            ctx.restore();
          }
          if (hi === 1) ctx.drawImage(im, 580, 15, 250, 70, h[0] - 26, 99.5, 52, 14.5);   // une toute petite île à l'horizon
          if (hi === 0) ctx.drawImage(im, 580, 15, 250, 70, h[0] - 36, 98, 72, 20);   // l'île au loin, dans le grand hublot
          ctx.restore();
        });
      } else ctx.drawImage(im, ...SC.sky);
    } }
  if (SC.img.complete && !SC.chroma) {
    ctx.save(); ctx.beginPath(); ctx.rect(0, 0, IN_W, IN_H); holes.forEach(h => { ctx.moveTo(h[0] + h[2], h[1]); ctx.ellipse(h[0], h[1], h[2], h[3], 0, 0, TAU, true); }); ctx.clip('evenodd');
    ctx.drawImage(SC.img, 0, 0); ctx.restore();
  }
  if (SC === SC_HOME && imgSdb.complete && imgSdb.naturalWidth && IN.floor === 0) { const a = 1 - Math.min(1, Math.max(0, IN.sdb || 0)); if (a > .01) { ctx.save(); ctx.globalAlpha = a; ctx.drawImage(imgSdb, SDB_BOX[0], SDB_BOX[1]); ctx.restore(); } }
  else if (SC === SC_HOME && imgSdb.complete && imgSdb.naturalWidth) { ctx.drawImage(imgSdb, SDB_BOX[0], SDB_BOX[1]); }   // à l'étage on voit la salle de bain fermée
  if (SC === SC_HOME) drawHungFrames();
  const drawYur = () => { const n = SC.npc; ctx.save(); ctx.fillStyle = 'rgba(0,0,0,.28)'; ctx.beginPath(); ctx.ellipse(n.x, n.y + 3, 30, 10, 0, 0, TAU); ctx.fill(); ctx.restore();
    ctx.save(); ctx.globalAlpha = 1; ctx.translate(n.x, n.y); ctx.scale(IN_K, IN_K); drawNpcSprite(npcPick(n.get()), 0, 0, time, false, true); ctx.restore(); };
  if (SC.npc && SC === SC_HOME && (IN.dk || 0) > .004) drawYur();   // en haut, Miraaï reste à sa place, assombrie avec le reste du bas
  if (SC === SC_HOME && (IN.dk || 0) > .004) { ctx.save(); ctx.globalAlpha = Math.min(1, IN.dk); ctx.fillStyle = '#050403'; ctx.beginPath(); DARK_LOW.forEach((q, i) => i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1])); ctx.closePath(); ctx.fill(); ctx.restore(); }
  // repères : seuil de sortie et échelle
  const pulse = .6 + .4 * Math.sin(IN.t * 4);
  if (IN.floor === 0) {
    ctx.save(); ctx.globalAlpha = .55 * pulse; ctx.fillStyle = '#ffe9a6'; ctx.beginPath(); ctx.ellipse(IN_EXIT[0], IN_EXIT[1] + 8, 52, 17, 0, 0, TAU); ctx.fill(); ctx.restore();
  }
  const drawLie = () => {   // Myah endormie : l'illustration du lit (dessin fourni) remplace le lit vide
    const S = SLEEP[IN.lie.bed], B = BEDS[IN.lie.bed];
    if (imgSleep.complete && imgSleep.naturalWidth) { const W = SLP.w, H = W * imgSleep.naturalHeight / imgSleep.naturalWidth, br = 1 + .012 * Math.sin(IN.t * 1.6); ctx.save(); ctx.translate(B.head[0] + SLP.dx, B.head[1] + SLP.dy + (IN.lie.bed === 'top' ? 20 : 4)); ctx.rotate(SLP.rot); ctx.scale(1, br); ctx.drawImage(imgSleep, -W * .16, -H * .5, W, H); ctx.restore(); }   // Myah endormie sur le lit du décor, drap un peu transparent
    // petits Z qui montent
    ctx.save(); ctx.textAlign = 'center'; ctx.font = 'italic 800 15px Pacifico, "Trebuchet MS", sans-serif';
    for (let i = 0; i < 3; i++) { const u = ((IN.t * .32 + i / 3) % 1); ctx.globalAlpha = Math.sin(u * Math.PI) * .9; ctx.fillStyle = '#fff'; ctx.strokeStyle = '#2d6f78'; ctx.lineWidth = 3; const zx = B.head[0] - 18 + u * 14 + i * 4, zy = B.head[1] - 22 - u * 46; ctx.font = (11 + i * 3) + 'px Pacifico, "Trebuchet MS", sans-serif'; ctx.strokeText('z', zx, zy); ctx.fillText('z', zx, zy); }
    ctx.restore();
  };
  const hintBox = (t, x, y) => {   // bulle de texte simple
    ctx.save(); ctx.font = '800 14px "Trebuchet MS", sans-serif'; const w = ctx.measureText(t).width + 20, bob = Math.sin(IN.t * 3) * 2; ctx.globalAlpha = .96; ctx.fillStyle = '#fff'; ctx.strokeStyle = '#2d6f78'; ctx.lineWidth = 2; ctx.beginPath(); ctx.roundRect(x - w / 2, y - 12 + bob, w, 24, 12); ctx.fill(); ctx.stroke(); ctx.fillStyle = '#17606a'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(t, x, y + bob + 1); ctx.restore();
  };
  const bedHint = () => {   // petite bulle au-dessus du lieu où l'on peut agir (pas pour le lit : le bouton Action suffit)
    if (bedPickOpen() || wardOpen() || IN.busy || IN.puff || IN.sit || IN.wash || IN.shower) return;
    let x, y, t, kind = null; const tap = IS_TOUCH ? 'Touche' : 'Clique sur';
    if (nearTrunk()) { kind = 'trunk'; x = TRUNK_SPOT[0]; y = TRUNK_SPOT[1] - 130 - 45 / (IN.zs || 1); t = tap + ' la malle pour changer de tenue'; }
    else if (nearPaint()) { x = PAINT_SPOT[0]; y = PAINT_SPOT[1] - 130 - 45 / (IN.zs || 1); t = 'Mini-jeux'; }
    else if (nearScope()) { kind = 'scope'; const hl = SCOPE_HL[nearScope() - 1]; x = hl[0]; y = hl[1] - 60; t = tap + ' la longue vue pour regarder'; }
    else if (nearHang()) { kind = 'hang'; const hz = nearHang(); x = (hz.z[0] + hz.z[2]) / 2; y = (hz.z[1] + hz.z[3]) / 2 - 60; t = tap + ' le mur pour accrocher un dessin'; }
    else if (nearShower()) { kind = 'shower'; x = SHOWER.x; y = SHOWER.y - 130; t = tap + ' la douche pour te laver'; }
    else { const se = nearSeat(), wa = !se && nearWash(); if (se) { x = se.pos[0]; y = se.pos[1] - 38 * SC.K; t = se.label || 'S\'asseoir'; if (se.id === 'wc') { kind = 'wc'; t = tap + ' les toilettes pour les utiliser'; } else if (!se.label) { kind = 'seat'; t = tap + (se.id === 'sofa' ? ' le canapé' : ' la chaise') + ' pour t\'asseoir'; } } else if (wa) { kind = 'wash'; x = wa.x; y = wa.y - 130; t = tap + ' le lavabo pour te laver les mains'; } else return; }
    if (kind) { if (tutSeen[kind]) return; const dh = Math.min(.1, Math.max(0, IN.t - (IN._hl || IN.t))); IN._hl = IN.t; tutAcc[kind] = (tutAcc[kind] || 0) + dh; if (tutAcc[kind] > 6) tutDone(kind); }   // message affiché une seule fois (tutoriel)
    ctx.save(); ctx.font = '800 14px "Trebuchet MS", sans-serif'; const w = ctx.measureText(t).width + 20, bob = Math.sin(IN.t * 3) * 2; ctx.globalAlpha = .96; ctx.fillStyle = '#fff'; ctx.strokeStyle = '#2d6f78'; ctx.lineWidth = 2; ctx.beginPath(); ctx.roundRect(x - w / 2, y - 12 + bob, w, 24, 12); ctx.fill(); ctx.stroke(); ctx.fillStyle = '#17606a'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(t, x, y + bob + 1); ctx.restore();
  };
  const drawSit = () => {   // assise : on ne voit que le haut du corps, le meuble cache le reste
    const t = IN.sit.seat, o = myahPose(), k = Math.min(1, IN.sit.t / .35), dy = t.drop * k;
    const pi = img.m_pose, sp = t.spr && pi && pi.complete && pi.naturalWidth ? t.spr : null;
    if (sp) {   // vraie pose assise : l'image dédiée, posée sur le siège (le point de repère = le bassin)
      const AN = { sit1: [130, 138], sit2: [128, 142], sitp: [132, 147], sit34: [140, 144], sit34b: [149, 146], sitkick: [153, 147], sitb: [128, 154] }[sp.n], s = MS * (FIX.pose[sp.n] || 1) * IN_K;
      const x = sp.at[0] - (sp.f ? -1 : 1) * (AN[0] - 128) * s, y = sp.at[1] - (AN[1] - 212) * s - 8 * (1 - ease(k));
      ctx.save(); ctx.globalAlpha = 1; myFrame('pose', sp.n, x, y, sp.f, 0, IN_K); ctx.restore();
    } else {
    ctx.save(); ctx.beginPath(); ctx.rect(t.pos[0] - 120, t.pos[1] - 260, 240, 260 + t.cut); ctx.clip(); ctx.globalAlpha = 1;
    myFrame(o.sheet, o.name, t.pos[0], t.pos[1] + dy, o.flip, 0, IN_K); ctx.restore();
    }
    if (t.legs && !sp) {   // jambes écrasées vers l'avant : cuisses en raccourci, pieds posés devant le canapé
      const hy = t.pos[1] + t.cut; ctx.save(); ctx.translate(0, hy); ctx.scale(1, 1 - .45 * k); ctx.translate(0, -hy); ctx.beginPath(); ctx.rect(t.pos[0] - 120, hy, 240, 140); ctx.clip(); ctx.globalAlpha = .95;
      myFrame(o.sheet, o.name, t.pos[0], t.pos[1] + dy, o.flip, 0, IN_K); ctx.restore();
    }
    if (t.id === 'sofa') {   // l'accoudoir du canapé passe devant la jambe de Myah
      ctx.save(); ctx.beginPath(); [[592,606],[597,601],[655,570],[663,574],[664,600],[655,626],[645,628],[607,642],[601,652],[597,652],[596,616]].forEach((q, i) => i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1])); ctx.closePath(); ctx.clip(); ctx.drawImage(imgIn, 0, 0); ctx.restore();
    }
    if (t.cloud) {   // nuage de pudeur : des bouffées blanches qui bougent doucement devant Myah
      const a = ease(Math.min(1, IN.sit.t / .6)), T = IN.t; ctx.save();
      for (let i = 0; i < 11; i++) {
        const ph = i / 11 * TAU, cx = t.pos[0] + Math.cos(ph) * (24 + 4 * Math.sin(T * .9 + i)), cy = t.pos[1] + 14 + Math.sin(ph) * 17 + Math.sin(T * 1.2 + i * 1.7) * 2.5, r = 17 + 4 * Math.sin(T * 1.1 + i * 1.3);
        const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r); g.addColorStop(0, 'rgba(252,254,255,' + .92 * a + ')'); g.addColorStop(.65, 'rgba(238,246,250,' + .8 * a + ')'); g.addColorStop(1, 'rgba(236,245,249,0)');
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, r, 0, TAU); ctx.fill();
      }
      ctx.restore();
    }
    if (t.fg === 'table') { ctx.save(); ctx.beginPath(); TABLE_FG.forEach((q, i) => i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1])); ctx.closePath(); ctx.clip(); ctx.drawImage(SC.img, 0, 0); ctx.restore(); }
  };
  const drawMy = () => { if (IN.lie) { drawLie(); return; } if (IN.sit) { drawSit(); return; } ctx.save(); ctx.fillStyle = 'rgba(0,0,0,.28)'; ctx.beginPath(); ctx.ellipse(IN.x, IN.y + 4, 34, 12, 0, 0, TAU); ctx.fill(); ctx.restore();
    const o = myahPose(); ctx.save(); ctx.globalAlpha = 1 * (1 - Math.min(1, .8 * ease(Math.max(IN.steam || 0, puffAmt())) + (SC === SC_HOME ? .2 * ease(IN.steam || 0) : 0)));
    const bh = 46 * IN_K * .76, d4 = player.dir4 || 'down', bwob = Math.abs(Math.sin(time * 8)) * 1.3 * (Math.hypot(player.mvx || 0, player.mvy || 0) > .1 ? 1 : 0);
    
    if (time < towelUntil && SC === SC_HOME && !IN.puff && bathDraw(d4 === 'up' ? 'towel_back' : d4 === 'down' ? 'towel_front' : 'towel_backl', IN.x, IN.y - bwob, bh, d4 === 'right')) { ctx.restore(); return; }
    myFrame(o.sheet, o.name, IN.x, IN.y, o.flip, o.lift * IN_K, IN_K); ctx.restore(); };
  const npcShown = SC.npc && !(SC === SC_HOME && (IN.dk || 0) > .004);   // (déjà dessinée sous l'ombre quand on est à l'étage)   // à l'étage de la maison, on ne voit pas Miraaï en bas
  const drawMyR = () => drawMy();
  const CH_BACK = [[[775,566],[803,551],[810,553],[812,560],[812,603],[805,603],[804,592],[782,601],[779,600]], [[768,568],[775,565],[779,570],[777,604],[777,650],[767,650],[769,600]], [[777,612],[808,604],[820,608],[802,634],[777,626]], [[959,553],[963,549],[968,552],[968,590],[966,600],[959,602]], [[966,556],[995,563],[995,603],[988,598],[966,589]], [[992,564],[1000,566],[1004,570],[1004,650],[994,650],[992,610]]];
  const LSOFA_BACK = [[296,612],[345,621],[385,639],[412,641],[452,659],[472,669],[508,661],[514,664],[514,692],[488,700],[465,692],[452,708],[300,656],[292,640]];
  const COFFEE_TABLE = [[411,607],[460,585],[538,626],[541,648],[525,658],[500,668],[488,676],[472,668],[414,640]];
  const TUB_FRONT = [[854,513],[936,537],[990,534],[1043,512],[1043,526],[1000,550],[985,556],[940,557],[925,554],[854,526]];
  const chairsFront = () => {   // les chaises du fond et le rebord de la douche passent devant Myah quand elle est derrière eux
    if (SC === SC_HOME && IN.floor === 1 && !IN.lie && !IN.bunk && !IN.climb) {   // à l'étage : barres et barreaux des rambardes devant Myah, on la voit entre les barreaux
      ctx.save(); ctx.beginPath(); RAILS.forEach(r => { ctx.moveTo(r[0][0], r[0][1]); for (let i = 1; i < r.length; i++) ctx.lineTo(r[i][0], r[i][1]); ctx.closePath(); }); ctx.clip(); ctx.drawImage(imgIn, 0, 0); ctx.restore(); return;
    }
    if (SC !== SC_HOME || IN.floor !== 0 || IN.lie || IN.sit) return;
    const polys = [];
    if (IN.y <= 612 && IN.y >= 440 && IN.x >= 700 && IN.x <= 1060) polys.push(...CH_BACK);
    if (IN.y <= 640 && IN.y >= 540 && IN.x >= 395 && IN.x <= 560) polys.push(COFFEE_TABLE);
    if (behindSofa(IN.x, IN.y)) polys.push(SOFA_SIL);   // le dossier et l'accoudoir du canapé du milieu passent devant Myah quand elle marche derrière
    if (IN.y <= 690 && IN.y >= 560 && IN.x >= 280 && IN.x <= 525) polys.push(LSOFA_BACK);   // le dossier du canapé gauche passe devant Myah quand elle le longe par derrière   // la table basse passe devant Myah quand elle est derrière
    { const fy = IN.x < 938 ? 512 + (IN.x - 880) * 22 / 58 : 534 - (IN.x - 938) * 22 / 92;   // bord de la douche : elle le passe par-dessus, sauf quand elle sort depuis l'intérieur
      if (!IN.shower && player.dir4 === 'down' && IN.x >= 880 && IN.x <= 1030 && IN.y < fy + 4 && IN.y > fy - 14) polys.push(TUB_FRONT); }
    if (!polys.length) return;
    ctx.save(); ctx.beginPath(); polys.forEach(r => { ctx.moveTo(r[0][0], r[0][1]); for (let i = 1; i < r.length; i++) ctx.lineTo(r[i][0], r[i][1]); ctx.closePath(); }); ctx.clip();
    ctx.drawImage(imgIn, 0, 0);
    const a = 1 - Math.min(1, Math.max(0, IN.sdb || 0)); if (a > .01 && imgSdb.complete && imgSdb.naturalWidth) { ctx.globalAlpha = a; ctx.drawImage(imgSdb, SDB_BOX[0], SDB_BOX[1]); }
    ctx.restore();
  };
  if (npcShown && IN.y >= SC.npc.y) { drawYur(); drawMyR(); } else { drawMyR(); if (npcShown) drawYur(); }
  chairsFront();
  if (SC.chair && IN.floor === 0 && IN.y < SC.chair.y) { const P = SC.chair.poly; ctx.save(); ctx.beginPath(); P.forEach((q, i) => i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1])); ctx.closePath(); ctx.clip(); ctx.drawImage(SC.img, 380, 900, 140, 115, 380, 900, 140, 115); ctx.restore(); }   // Myah passe derrière la chaise
  if (SC.gate && IN.y < 955 && IN.floor === 0) SC.gate.forEach(g => ctx.drawImage(SC.img, g[0], g[1], g[2], g[3], g[0], g[1], g[2], g[3]));   // la barre passe devant Myah
  if (SC === SC_HOME && IN.floor === 0) {   // douche : l'eau coule, l'illustration de Myah dans son nuage, gouttes et éclaboussures
    const sh = IN.shower, st = ease(IN.steam || 0);
    if (sh || st > .01) {
      const [hx, hy] = SHOWER.head, fy = SHOWER.y - 2, run = sh ? Math.min(1, sh.t / .4) : Math.max(0, st), T = IN.t;
      ctx.save(); ctx.lineCap = 'round';
      // 1) l'eau, derrière le nuage : filets qui ondulent + gouttes qui tombent à des vitesses différentes
      for (let i = 0; i < 16; i++) {
        const a = (i - 7.5) / 8, x0 = hx + a * 17, x1 = hx + a * 34 + Math.sin(T * 2.4 + i) * 1.5;
        ctx.globalAlpha = .38 * run; ctx.strokeStyle = i % 2 ? '#d6f1ff' : '#ffffff'; ctx.lineWidth = 1.5; ctx.setLineDash([9, 7 + (i % 3) * 3]); ctx.lineDashOffset = -T * (70 + (i % 4) * 14);
        ctx.beginPath(); ctx.moveTo(x0, hy + 8); ctx.quadraticCurveTo((x0 + x1) / 2 + Math.sin(T * 3 + i * 1.7) * 2.2, (hy + fy) / 2, x1, fy); ctx.stroke();
      }
      ctx.setLineDash([]);
      for (let i = 0; i < 60; i++) {
        const sp = 1.1 + (i % 7) * .16, u = ((T * sp + i * .137) % 1), a = ((i * 2.399) % 2 - 1), yy = hy + 8 + u * (fy - hy - 8), spread = 10 + u * 30;
        ctx.globalAlpha = .62 * run * (u < .08 ? u / .08 : 1); ctx.strokeStyle = i % 3 ? '#cdeeff' : '#ffffff'; ctx.lineWidth = 1.7;
        ctx.beginPath(); ctx.moveTo(hx + a * spread, yy); ctx.lineTo(hx + a * spread - .8, yy + 8 + (i % 4) * 2); ctx.stroke();
      }
      ctx.restore();
      // 2) Myah dans son nuage (dessin fourni), qui respire doucement
      if (imgShower.complete && imgShower.naturalWidth && st > .01) {
        const k = 1 + .012 * Math.sin(T * 1.7); ctx.save(); ctx.globalAlpha = st; ctx.translate(SHOWER.x, fy); ctx.scale(k, 1 + .008 * Math.sin(T * 1.3 + 1)); ctx.translate(-SHOWER.x, -fy);
        ctx.drawImage(showerSprite(), SHOWER_BOX[0], SHOWER_BOX[1], SHOWER_BOX[2], SHOWER_BOX[3]);
        const ks = SHOWER_BOX[2] / SHOWER_BOX_PX;
        for (let i = 0; i < 9; i++) {   // petites bulles qui s'envolent
          const u = (T * .45 + i * .37) % 1, bx = SHOWER_BOX[0] + (40 + (i * 53) % 170) * ks + Math.sin(T * 2 + i) * 2, by = SHOWER_BOX[1] + (250 - u * 250) * ks, br = (2 + (i % 3)) * ks * 2.2;
          ctx.globalAlpha = st * .8 * Math.sin(u * Math.PI); ctx.strokeStyle = '#ffffff'; ctx.fillStyle = 'rgba(255,255,255,.35)'; ctx.lineWidth = .7; ctx.beginPath(); ctx.arc(bx, by, br, 0, TAU); ctx.fill(); ctx.stroke();
        }
        ctx.restore();
      }
      // 3) le nuage est agrandi vers le bas : plus de pantalon visible ; il bouge en continu
      if (st > .01) {
        ctx.save();
        for (let i = 0; i < 10; i++) {
          const ph = i / 10 * TAU, cx = SHOWER.x + Math.cos(ph) * (13 + 6 * Math.sin(T * .9 + i)) + Math.sin(T * 1.1 + i * 2) * 4, cy = fy - 28 + Math.sin(ph) * 7 + Math.sin(T * 1.3 + i) * 3, r = 21 + 5 * Math.sin(T * 1.2 + i * 1.7);
          const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r); g.addColorStop(0, 'rgba(252,254,255,' + .25 * st + ')'); g.addColorStop(.65, 'rgba(240,248,251,' + .2 * st + ')'); g.addColorStop(1, 'rgba(240,248,250,0)');
          ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, r, 0, TAU); ctx.fill();
        }
        ctx.restore();
        steamPuffs(SHOWER.x, fy, st * .3);   // quelques volutes qui montent, pour l'animation
      }
      // 4) éclaboussures devant : ronds dans la flaque et gouttes qui rebondissent sur le carrelage
      ctx.save(); ctx.lineCap = 'round';
      for (let i = 0; i < 4; i++) { const u = ((T * 1.5 + i / 4) % 1); ctx.globalAlpha = .55 * run * (1 - u); ctx.strokeStyle = '#e8f8ff'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.ellipse(SHOWER.x + (i % 2 ? 14 : -16), fy + 3 + (i % 2) * 2, 5 + u * 20, 2 + u * 7, 0, 0, TAU); ctx.stroke(); }
      for (let i = 0; i < 14; i++) { const u = ((T * 2.2 + i * .31) % 1), side = (i % 2 ? 1 : -1), px = SHOWER.x + side * (8 + (i * 7) % 26) * (.4 + u), py = fy + 2 - Math.sin(u * Math.PI) * (8 + (i % 3) * 3); ctx.globalAlpha = .7 * run * (1 - u * .6); ctx.fillStyle = '#e2f5ff'; ctx.beginPath(); ctx.arc(px, py, 1.3, 0, TAU); ctx.fill(); }
      ctx.restore();
    }
  }
  if (IN.wash) {   // l'eau du robinet coule dans la vasque, avec des ronds et des gouttes
    const w = IN.wash.w, run = Math.min(1, IN.wash.t / .35), T = IN.t; ctx.save(); ctx.lineCap = 'round';
    const [tx, ty] = w.tap, [bx, by] = w.basin;
    ctx.globalAlpha = .85 * run; ctx.strokeStyle = '#d6f1ff'; ctx.lineWidth = 2.6; ctx.setLineDash([7, 4]); ctx.lineDashOffset = -T * 60; ctx.beginPath(); ctx.moveTo(tx, ty); ctx.lineTo(bx - 1, by - 3); ctx.stroke(); ctx.setLineDash([]);
    for (let i = 0; i < 3; i++) { const u = (T * 1.6 + i / 3) % 1; ctx.globalAlpha = .6 * run * (1 - u); ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.ellipse(bx, by, 3 + u * 11, 1.3 + u * 4, 0, 0, TAU); ctx.stroke(); }
    for (let i = 0; i < 6; i++) { const u = (T * 2.1 + i * .27) % 1, sd = i % 2 ? 1 : -1; ctx.globalAlpha = .7 * run * (1 - u); ctx.fillStyle = '#e8f8ff'; ctx.beginPath(); ctx.arc(bx + sd * (3 + u * 10), by - Math.sin(u * Math.PI) * 9, 1.4, 0, TAU); ctx.fill(); }
    ctx.restore();
  }
  if (IN.puff) steamPuffs(IN.x, IN.y + 4, puffAmt());   // nuage de changement de tenue
  tapHalos();
  paintBubble();
  bedHint();
  
  if (SC.npc) { const n = SC.npc; if (dist(IN.x, IN.y, n.x, n.y) < (n.r || 70) && !dlg.open) { const w = String((n.get() || {}).who || '').split(',')[0].trim(); hintBox('Parler à ' + w, n.x, n.y - 135 - 76 / IN.zs); } }
}

function update(dt) {
  if (IN.busy) return;
  if (IN.on) { updateInterior(dt); return; }
  if (tipsOpen()) { player.mvx = player.mvy = 0; actQueued = jumpQueued = swanQueued = false; return; }
  time += dt; miniUpdate(dt);
  if (IN.cool > 0) IN.cool -= dt;
  updateNpcs(dt);
  if (bubble.t > 0) bubble.t -= dt;
  const p = player;
  if (!cine && !dlg.open && p.state === 'free' && !p.mount && IN.cool <= 0 && !bedPickOpen() && HOUSES.some(h => dist(p.x, p.y, h.door[0], h.door[1]) < h.r && !(h.askUntil && time < h.askUntil) && (h.id !== 'boat' || boatFree()))) { IN.near += dt; if (IN.near > .3) { IN.near = 0; const hh = HOUSES.find(h => dist(p.x, p.y, h.door[0], h.door[1]) < h.r && !(h.askUntil && time < h.askUntil) && (h.id !== 'boat' || boatFree())); if (!hh) {} else if (hh.scene) askEnter(hh); else enterHouse(hh); } } else IN.near = 0;

  // entrées
  let ix = (keys.ArrowRight || keys.KeyD ? 1 : 0) - (keys.ArrowLeft || keys.KeyA ? 1 : 0);
  let iy = (keys.ArrowDown || keys.KeyS ? 1 : 0) - (keys.ArrowUp || keys.KeyW ? 1 : 0);
  let mag = 0; { const l = Math.hypot(ix, iy); if (l) { ix /= l; iy /= l; mag = 1; } }
  let run = !!(keys.ShiftLeft || keys.ShiftRight);
  if (stick.active && stick.mag > 0.05) { ix = stick.x; iy = stick.y; const l = Math.hypot(ix, iy) || 1; ix /= l; iy /= l; mag = Math.max(stick.mag, .5); run = run || stick.mag > 0.97; }
  const moving = mag > 0.12 && !cine && !dlg.open && p.state !== 'talk';
  p.mvx = moving ? ix : 0; p.mvy = moving ? iy : 0;
  if (moving) p.dir4 = Math.abs(iy) > Math.abs(ix) * 1.2 ? (iy > 0 ? 'down' : 'up') : (ix > 0 ? 'right' : 'left');

  if (swanQueued) { swanQueued = false; summon(); }
  if (jumpQueued) {
    jumpQueued = false;
    if (!cine && !dlg.open) { if (p.mount) toggleFlight(); else if (p.state === 'free') { p.state = 'jump'; setAnim('jump'); sfx.hop(); } }
  }
  if (actQueued) { actQueued = false; if (dlg.open) advanceDialog(); else doAction(); }

  const tryMove = (speed) => {
    const nx = p.x + ix * speed * dt, ny = p.y + iy * speed * dt;
    let ok;
    if (p.mount === 'fly') ok = (x, y) => x > 8 && x < W - 8 && y > 8 && y < H - 8;
    else if (p.mount === 'float') ok = (x, y) => isWater(x, y);
    else ok = (x, y) => walkable(x, y) && !npcBlocked(x, y);
    if (ok(nx, p.y)) p.x = nx;
    if (ok(p.x, ny)) p.y = ny;
    if (ix) p.face = ix > 0 ? 1 : -1;
  };

  if (p.mount) {
    if (moving) tryMove(p.mount === 'fly' ? (run ? 250 : 175) : (run ? 66 : 47));
    p.alt += (p.altT - p.alt) * Math.min(1, dt * 5); if (Math.abs(p.altT - p.alt) < .6) p.alt = p.altT;
    if (p.dismounting && p.alt < 3) { p.dismounting = false; leavers.push({ x: p.x, y: p.y, t: 0, dir: p.face, fromPerch: true }); p.mount = null; p.alt = 0; sfx.hop(); setAnim('idle'); }
    p.fr = (p.fr + dt * 10) % 18;
  } else if (p.state === 'free') {
    if (!walkable(p.x, p.y)) { const w = nearestWalk(p.x, p.y, 150); if (w) { p.x = w[0]; p.y = w[1]; } }
    if (moving) { tryMove(run ? 62 : 43); setAnim(run ? 'run' : 'walk'); } else setAnim('idle');
  } else if (p.state === 'jump') {
    if (moving) tryMove(38);
  } else if (p.state === 'act') {
    const a = act;
    if (a.kind === 'pick') {
      if (!a.done && p.fr >= 11 && a.target.alive) {
        a.done = true;
        if (a.target.tree) { a.target.fruits--; if (a.target.fruits <= 0) { a.target.alive = false; a.target.t = 0; say('Plus de ' + ({ coconut: 'noix de coco', mango: 'mangues' }[a.target.kind] || 'bananes') + ' sur cet arbre : il repousse dans 30 s 🌱', 3); } }
        else { a.target.alive = false; a.target.t = 0; }
        const kind = bananas.includes(a.target) ? (a.target.kind || 'banana') : 'flower';
        collect(kind, a.target.x, a.target.y - (a.target.tree ? 34 : 0)); floatText(p.x + p.face * 14, p.y - 52, '+1 ' + ICON[kind]); sfx.pick(); burst(a.target.x, a.target.y - (a.target.tree ? 34 : 8), 8);
      }
    } else if (a.kind === 'net') {
      if (!a.done && p.fr >= 12) {
        a.done = true;
        const cx = p.x + p.face * 24, cy = p.y - 8; let got = 0;
        for (const b of butterflies) {
          if (!b.alive) continue;
          if (dist(b.x, b.y - b.z * .5, cx, cy) < DIFF[level].netR) { b.alive = false; b.respawn = 9; got++; collect('butterfly', b.x, b.y - b.z); burst(b.x, b.y - b.z, 10, ['#ffb347', '#ff8fc4', '#7fd1ff', '#fff']); }
        }
        let gf = 0; for (const f of MI.flies) if (!f.gone && f.life > 1 && dist(f.x, f.y - f.z, cx, cy) < DIFF[level].netR + 6) { catchFirefly(f); gf++; }
        a.got = got > 0 || gf > 0;
        if (got) { sfx.catchb(); floatText(p.x + p.face * 14, p.y - 52, '+' + got + ' 🦋'); }
        else if (gf) { sfx.catchb(); floatText(p.x + p.face * 14, p.y - 52, '+' + gf + ' ✨'); }
        else { sfx.no(); say(MI.flies.length ? 'Raté ! Approche-toi plus des lucioles ✨' : 'Raté ! Approche-toi plus des papillons 🦋', 2.4); }
      }
    }
  } else if (p.state === 'fishing') {
    if (moving && fs.phase !== 'reel') { bubble.t = 0; endFishing(); }
  } else if (p.state === 'talk') setAnim('idle');

  // animation de Myah
  const An = ANIM[p.anim];
  if (!p.mount) {
    if (p.state === 'fishing') {
      if (fs.phase === 'cast') { p.fr += dt * 13; if (p.fr >= 9.99) { p.fr = 10; fs.phase = 'wait'; fs.t = 0; sfx.splash(); } }
      else if (fs.phase === 'wait') {
        fs.t += dt; p.fr = 10 + (Math.sin(time * 2.4) * .5 + .5) * 4;
        if (!fs.fish) {
          let best = null, bd = 190;
          for (const f of fishes) if (f.region === fs.region && f.state === 'swim' && f.cool <= 0) { const d = dist(f.x, f.y, fs.tx, fs.ty); if (d < bd) { bd = d; best = f; } }
          if (best) { fs.fish = best; best.state = 'lured'; fs.t = 0; }
          else if (fs.t > 3.4) { say('Pas de poisson par ici… essaie un autre endroit 🐟', 3.2); sfx.no(); endFishing(); }
        } else if (fs.fish.state === 'biting') { fs.phase = 'bite'; fs.t = 0; sfx.bite(); }
      } else if (fs.phase === 'bite') {
        fs.t += dt; p.fr = 11 + (Math.sin(time * 26) * .5 + .5) * 2.5;
        if (fs.t > 3) { releaseFish(7); fs.phase = 'wait'; fs.t = 0; say('Oh, il s\'est échappé ! Réessaie 🐟', 2.2); }
      } else if (fs.phase === 'fight') {   // barre de pêche : garder le poisson 🐟 dans la zone verte en maintenant Action
        const D = DIFF[level], F = fs.fight; F.t += dt; p.fr = 11 + (Math.sin(time * 26) * .5 + .5) * 2.5;
        const held = actHeld(), hard = D.canLose ? (D.fall > 1.3 ? 1.35 : 1.15) : .85;   // plus le niveau est dur, plus le poisson tire fort
        F.mt -= dt; if (F.mt <= 0) { if (F.mode === 'rest') { F.mode = 'pull'; F.mt = (.9 + Math.random() * .7) / Math.sqrt(hard); sfx.bite(); } else { F.mode = 'rest'; F.mt = (1.5 + Math.random() * 1.1) / Math.sqrt(hard); } }
        // tension : monte vite si on tient pendant qu'il tire, doucement sinon ; elle redescend quand on relâche
        if (held) F.T += (F.mode === 'pull' ? 1.05 * hard : .2) * dt; else F.T += ((F.mode === 'pull' ? .3 : .1) - F.T) * Math.min(1, 2.2 * dt);
        F.T = Math.max(0, F.T);
        F.inZ = held && F.mode === 'rest';
        F.prog += (F.inZ ? D.fill : held ? D.fill * .15 : -D.drain * .6) * dt; F.prog = Math.min(1, Math.max(0, F.prog));
        if (F.T >= 1) {   // la ligne a failli casser
          if (D.canLose) { releaseFish(7); fs.phase = 'wait'; fs.t = 0; fs.fight = null; say('La ligne a cassé ! Relâche quand il tire 🐟', 2.6); sfx.no(); return; }
          F.T = .35; F.prog = Math.max(0, F.prog - .12); F.mode = 'rest'; F.mt = 1.6; say('Aïe, la ligne a failli casser ! Relâche quand il tire 🐟', 2.2); sfx.no();
        }
        if (F.prog >= 1) { fs.phase = 'reel'; fs.fight = null; p.fr = 15; sfx.cast(); }
      } else if (fs.phase === 'reel') {
        p.fr += dt * 14;
        if (!fs.caught && p.fr >= 18) {
          fs.caught = true; const f = fs.fish; if (f) { f.state = 'gone'; f.t = 10; }
          collect('fish', fs.tx, fs.ty); sfx.fish(); burst(fs.tx, fs.ty, 14, ['#bfe9ff', '#fff', '#7fd1ff']); floatText(p.x + p.face * 14, p.y - 56, '+1 🐟'); fs.fish = null;
        }
        if (p.fr >= An.n - .01) endFishing();
      }
    } else if (p.state !== 'cine') {
      const spd = p.anim === 'walk' ? (moving ? Math.max(.6, mag) * .72 : 1) : p.anim === 'run' ? .72 : 1;
      p.fr += dt * An.fps * spd;
      if (p.state === 'act' || p.state === 'jump') { if (p.fr >= An.n) { p.state = 'free'; setAnim('idle'); } } else p.fr %= An.n;
    } else p.fr = (p.fr + dt * An.fps) % An.n;
  }

  // coffres cachés : apparition / disparition
  QUESTS.forEach(q => { if (q.rustle > 0) q.rustle -= dt; if (q.found && !opened[q.id] && q.reveal < 1 && time - q.revealAt > .35) q.reveal = Math.min(1, q.reveal + dt * 2.6); if (opened[q.id] && q.reveal > 0 && q.vanishAt && time > q.vanishAt) { if (q.reveal === 1) burst(q.cx, q.cy - 14, 14, ['#fff', '#ffe27a'], true); q.reveal = Math.max(0, q.reveal - dt * 1.6); } });
  // coffres : animation d'ouverture
  QUESTS.forEach(q => { if (q.opening) { q.chestOpen = Math.min(1, q.chestOpen + dt * 2.2); if (q.chestOpen >= 1) { q.opening = false; setTimeout(() => finishChest(q), 250); q.opening = 'wait'; } } });

  // monde : objets immobiles (réapparition), poissons, cygnes, papillons
  for (const b of bananas) if (b.fruits <= 0) { b.t += dt; if (b.t >= TREE_WAIT) { b.fruits = TREE_MAX; b.alive = true; b.t = 0; } }
  for (const f of flowers) if (!f.alive) { f.t += dt; if (f.t > 12) f.alive = true; }
  for (const f of fishes) updateFish(f, dt);
  for (const s of swans) updateSwan(s, dt);
  butterflies.forEach((b, i) => updateButterfly(b, dt, i));
  if (cine) updateCine(dt);

  for (const f of floaters) f.t += dt; for (let i = floaters.length - 1; i >= 0; i--) if (floaters[i].t > 1.4) floaters.splice(i, 1);
  for (const s of sparks) { s.t += dt; s.x += s.vx * dt; s.y += s.vy * dt; s.vy += (s.g === undefined ? 120 : s.g) * dt; }
  for (let i = sparks.length - 1; i >= 0; i--) if (sparks[i].t > sparks[i].life) sparks.splice(i, 1);
  for (const f of flyers) f.t += dt; for (let i = flyers.length - 1; i >= 0; i--) if (flyers[i].t > .7) flyers.splice(i, 1);
  for (const l of leavers) l.t += dt; for (let i = leavers.length - 1; i >= 0; i--) if (leavers[i].t > 1.5) leavers.splice(i, 1);

  updateHint();
  // caméra
  const vw = cv.width / dpr, vh = cv.height / dpr;
  let z = camZ(vw, vh); if (vh / z > H) z = vh / H; cam.z = z;
  const fx = cine && cine.focus ? cine.focus[0] : p.x, fy = cine && cine.focus ? cine.focus[1] : p.y - 22 - p.alt * .4;
  const tx = fx - vw / 2 / z, ty = fy - vh / 2 / z, sm = cine ? 2.2 : 6;
  cam.x += (tx - cam.x) * Math.min(1, dt * sm); cam.y += (ty - cam.y) * Math.min(1, dt * sm);
  cam.x = (W - vw / z) < 0 ? (W - vw / z) / 2 : clamp(cam.x, 0, W - vw / z);
  cam.y = (H - vh / z) < 0 ? (H - vh / z) / 2 : clamp(cam.y, 0, H - vh / z);
  if (lastToolsOff !== !!p.mount) { lastToolsOff = !!p.mount; document.body.classList.toggle('mounted', !!p.mount); $('#tools').classList.toggle('off', lastToolsOff); }
}

function updateFish(f, dt) {
  updateFish0(f, dt);
  if (f.region === 'pond' && f.state !== 'gone' && !cell(POND_FISH, f.x, f.y) && !(f.state === 'lured' || f.state === 'biting')) { const q = snapMask(POND_FISH, f.x, f.y, 40); f.x = q[0]; f.y = q[1]; pickTarget(f); }
}
function updateFish0(f, dt) {
  if (f.state === 'gone') { f.t -= dt; if (f.t <= 0) respawnFish(f); return; }
  if (f.cool > 0) f.cool -= dt;
  let tx = f.tx, ty = f.ty, sp = f.sp;
  const fishing = player.state === 'fishing' && fs.fish === f;
  if (f.state === 'lured' || f.state === 'biting') {
    if (!fishing) { f.state = 'swim'; f.cool = 3; }
    else { tx = fs.tx; ty = fs.ty; if (f.state === 'lured') { sp = DIFF[level].lureSpeed; if (dist(f.x, f.y, tx, ty) < 5) f.state = 'biting'; } else sp = 5; }
  } else if (dist(f.x, f.y, tx, ty) < 5) { pickTarget(f); if (Math.random() < .4) f.pause = rnd(.3, 1.1); }
  if (f.state === 'swim') {   // les poissons s'écartent des autres poissons et des cygnes
    let ax = 0, ay = 0;
    const push = (ox, oy, r) => { const d = dist(f.x, f.y, ox, oy); if (d < r) { const k = (r - d) / r / Math.max(d, .1); ax += (f.x - ox) * k; ay += (f.y - oy) * k; } };
    for (const o of fishes) if (o !== f && o.region === f.region && o.state !== 'gone') push(o.x, o.y, f.region === 'pond' ? 17 : 15);
    if (f.region === 'pond') for (const w of swans) push(w.x, w.y, 21);
    const am = Math.hypot(ax, ay);
    if (am > 0) { const ex = f.x + ax / am * 30, ey = f.y + ay / am * 30; if (cell(fishMask(f), ex, ey)) { tx = ex; ty = ey; f.tx = tx; f.ty = ty; } sp = Math.max(sp, 10); f.pause = 0; }
  }
  if (f.pause > 0) { f.pause -= dt; sp *= .15; }
  if (f.state === 'swim') {   // cap horizontal net (pas de rotation qui tourne, pas de tangage), léger basculement vers la cible
    const dx = tx - f.x, dy = ty - f.y; if (Math.abs(dx) > 1.5) f.dir = dx > 0 ? 1 : -1;
    const tilt = clamp(dy * .012, -.1, .1) * (f.dir > 0 ? 1 : -1); f.ang = f.dir > 0 ? tilt : Math.PI - (-tilt);
  } else {
    const want = Math.atan2(ty - f.y, tx - f.x); let d = want - f.ang; d = Math.atan2(Math.sin(d), Math.cos(d));
    f.ang += clamp(d, -3.2 * dt, 3.2 * dt);
  }
  const nx = f.x + Math.cos(f.ang) * sp * dt, ny = f.y + Math.sin(f.ang) * sp * dt;
  if (f.state === 'swim' && !cell(fishMask(f), nx, ny)) { pickTarget(f); f.ang += 3 * dt; return; }
  f.x = nx; f.y = ny;
  if (f.state === 'swim') {   // séparation ferme : ni poisson/poisson, ni poisson/cygne
    const sep = (o, r, mine) => { const d = dist(f.x, f.y, o.x, o.y); if (d >= r) return; const ux = d > .01 ? (f.x - o.x) / d : 1, uy = d > .01 ? (f.y - o.y) / d : 0, m = r - d;
      const fx = f.x + ux * m * mine, fy = f.y + uy * m * mine;
      if (cell(fishMask(f), fx, fy)) { f.x = fx; f.y = fy; if (!mine || mine < 1) { o.x -= ux * m * (1 - mine); o.y -= uy * m * (1 - mine); } } else if (o.tx !== undefined && cell(POND_SW, o.x - ux * m, o.y - uy * m)) { o.x -= ux * m; o.y -= uy * m; } };
    for (const o of fishes) if (o !== f && o.region === f.region && o.state === 'swim') sep(o, f.region === 'pond' ? 15 : 13, .5);
    if (f.region === 'pond') for (const w of swans) sep(w, 19, 1);
  }
}

let hintAt = null, hintWater = false, hintWT = 0, lastHint = null, lastToolsOff = null, hz = null, hintWaterPt = null;
function updateFightBar() {
  { const fb = $('#fishBtn'); if (fb) { const on = IS_TOUCH && fishHoldNeeded(); if ((fb.style.display === 'flex') !== on) fb.style.display = on ? 'flex' : 'none'; fb.classList.toggle('held', on && touchAct); } }   // mobile : le rond du joystick s'allume pendant la touche, et on le tient pour garder le poisson
  const el = $('#fightBar'); if (!el) return;
  const F = player.state === 'fishing' && fs.phase === 'fight' ? fs.fight : null;
  if (!F) { if (el.style.display !== 'none') el.style.display = 'none'; return; }
  const D = DIFF[level]; if (el.style.display !== 'flex') el.style.display = 'flex';
  $('#fbZone').style.height = '70%'; $('#fbZone').style.bottom = '0%';
  $('#fbHook').style.bottom = (Math.min(1, F.T) * 100) + '%'; $('#fbProg').style.height = (F.prog * 100) + '%';
  el.classList.toggle('inz', !!F.inZ); el.classList.toggle('pull', F.mode === 'pull');
  const hold = IS_TOUCH ? 'le bouton 🎣' : 'Espace', msg = F.mode === 'pull' ? '😮 Il tire fort ! <b>Relâche</b> !' : '😴 Il est fatigué ! <b>Maintiens ' + hold + '</b> pour tirer !';
  const l = el.querySelector('.fbL'); if (l && l.dataset.m !== msg) { l.dataset.m = msg; l.innerHTML = msg; }
}
let tapT = null;   // cible touchable dehors (PNJ, buisson, fleur, eau…) : un clic / toucher assez près déclenche Action
cv.addEventListener('pointerdown', e => { if (IN.on || !started || !tapT || player.state !== 'free' || cine || dlg.open) return; const r = cv.getBoundingClientRect(); if (Math.hypot((e.clientX - r.left) - (tapT.x - cam.x) * cam.z, (e.clientY - r.top) - (tapT.y - cam.y) * cam.z) < 75) actQueued = true; });
function updateHint() {
  updateFightBar();
  const el = $('#hint'); let t = ''; const p = player; hz = null;   // halo = zone interactive en surbrillance (à la place d'une bulle)
  if (cine || dlg.open || p.state === 'talk') t = '';
  else if (p.mount) t = p.mount === 'fly' ? '🦢 En vol ! ⤴ pour te poser sur l\'eau · 🦢 pour descendre' : '🦢 Sur l\'eau ! ⤴ pour reprendre l\'envol · 🦢 pour descendre';
  else if (p.state === 'fishing') t = fs.phase === 'fight' ? '' : fs.phase === 'bite' ? (IS_TOUCH ? '🐟 Ça mord ! Appuie sur le bouton 🎣 !' : '🐟 Ça mord ! Appuie sur Action / Espace !') : (fs.phase === 'wait' ? tutHint('fwait', 'Attends que le poisson morde… [canne]') : '');
  else if (p.state === 'free') {
    tapT = null; let near = null, bd = 1e9, nearQ = null, nearN = '', nearP = null; const nm = w => String(w || '').split(',')[0].trim();
    for (const q of QUESTS) {
      const dn = dist(q.x, q.y, p.x, p.y), dc = dist(q.cx, q.cy, p.x, p.y) + (qState[q.id] === 'done' && !opened[q.id] ? 0 : 40);
      if (dc < R_CHEST && dc < bd) { bd = dc; near = qState[q.id] === 'done' && !opened[q.id] ? (q.found ? '[a-tresor]' : '[a-prendre]') : ''; nearQ = q; }
      if (dn < R_NPC && dn < bd) { bd = dn; near = qState[q.id] === 'active' && hasAll(q) ? '[a-donner]' : '[a-parler]'; nearQ = null; nearN = nm(q.who); nearP = [q.x, q.y]; }
    }
    for (const e of EXTRAS) { const d = dist(e.x, e.y, p.x, p.y); if (d < R_NPC && d < bd) { bd = d; near = '[a-parler]'; nearN = nm(e.who); nearP = [e.x, e.y]; } }
    if (perchVisible() && !perchAway()) { const ds = dist(D.perch[0], D.perch[1], p.x, p.y); if (ds < R_SWAN && ds < bd) { bd = ds; near = phase === 'appeared' ? '[a-donner]' : '[a-parler]'; nearN = 'le Cygne'; nearP = [D.perch[0], D.perch[1]]; } }
    if (near !== null && bd < 1e9) {
      tapT = nearP ? { x: nearP[0], y: nearP[1] - 20 } : nearQ ? { x: nearQ.cx, y: nearQ.cy } : null;
      if ((near === '[a-tresor]' || near === '[a-prendre]') && nearQ) hz = { x: nearQ.cx, y: nearQ.cy, r: 15 };   // buisson / coffre : halo, pas de bulle
      else { const ap = IS_TOUCH ? ' — touche le bouton Action' : ' — appuie sur Action'; t = near === '[a-donner]' ? tutHint('give', 'Donner à ' + nearN + ap) : near === '[a-parler]' ? tutHint('talk', 'Parler à ' + nearN + ap) : near; hintAt = nearP; }   // l'aide ne s'affiche qu'une fois   // bulle de texte simple
    }
    else if (!DIFF[level].halo && (tool === 'basket' || tool === 'net')) { /* niveau Défi : pas de halo, on cherche soi-même */ }
    else if (tool === 'basket' && (nearestItem(bananas, p.x, p.y, R_PICK) || nearestItem(flowers, p.x, p.y, R_PICK))) { const o = nearestItem(bananas, p.x, p.y, R_PICK) || nearestItem(flowers, p.x, p.y, R_PICK); hz = { x: o.x, y: o.y, r: o.tree ? 17 : 10 }; }
    else if (tool === 'net') { const b = butterflies.find(b => b.alive && dist(b.x, b.y, p.x, p.y) < 60), fl = MI.flies.find(f => !f.gone && f.life > 1 && dist(f.x, f.y - f.z, p.x, p.y - 8) < 60); if (b) hz = { x: b.x, y: b.y - b.z, r: 11, air: true }; else if (fl) hz = { x: fl.x, y: fl.y - fl.z, r: 11, air: true }; }
    else if (tool === 'fish') { if (time - hintWT > .25) { hintWT = time; hintWaterPt = waterNear(); } if (hintWaterPt && dist(hintWaterPt.x, hintWaterPt.y, p.x, p.y) < 16) { const isW = (x, y) => cell(POND, x, y) === 1 || cell(SEA, x, y) === 1, ring = (x, y) => { for (let a = 0; a < 10; a++) if (!isW(x + Math.cos(a * .628) * 11, y + Math.sin(a * .628) * 5)) return false; return isW(x, y); }; let hp = null, hd = 1e9; for (let oy = -24; oy <= 24; oy += 3) for (let ox = -24; ox <= 24; ox += 3) { const x = hintWaterPt.x + ox, y = hintWaterPt.y + oy, d = Math.hypot(ox, oy); if (d < hd && ring(x, y)) { hd = d; hp = { x, y }; } } if (hp) hz = { x: hp.x, y: hp.y, r: 9 }; else tapT = { x: hintWaterPt.x, y: hintWaterPt.y }; } }
  }
  if (hz && !tapT && p.state === 'free') tapT = { x: hz.x, y: hz.y };
  if (bubble.t > 0 && p.state !== 'fishing') t = bubble.txt;
  if (t !== lastHint) { lastHint = t; if (t) el.innerHTML = ico(t); el.classList.toggle('on', !!t); }
  if (t && !IN.on) { const q = (t === bubble.txt && bubble.t > 0) || !hintAt ? player : { x: hintAt[0], y: hintAt[1] }; el.style.left = Math.round((q.x - cam.x) * cam.z) + 'px'; { const Y = (q.y - cam.y) * cam.z, t0 = (q.y - cam.y - 50) * cam.z - 76 + (q === player ? 90 : 0); el.style.top = Math.round(Y - Math.max((Y - t0) / 2, 36 * cam.z)) + 'px'; } }   // message au-dessus de Myah : ~2,5 cm plus bas   // au-dessus de la tête (~50) + 2 cm (~76 px)
}

/* ================= dessin ================= */
function resize() { dpr = Math.min(1.5, window.devicePixelRatio || 1, Math.sqrt(1.5e6 / Math.max(1, innerWidth * innerHeight))); cv.width = Math.round(innerWidth * dpr); cv.height = Math.round(innerHeight * dpr); fitToolIcons(); }
addEventListener('resize', resize); resize();

const MS = 0.26;   // pixels de carte par pixel de case (Myah ≈ 48 px de haut)
// Harmonisation des tailles : les planches n'ont pas été dessinées à la même échelle (ancrage = pieds)
const FIX = Object.fromEntries(Object.keys(MY).map(k => [k, Object.fromEntries(MY[k].names.map(n => [n, .69]))]));   // nouvelle Myah : toutes les images à la même échelle
{ const PF = {"sit1": 1.083, "sit2": 1.083, "sitp": 1.083, "sit34": 1.083, "sit34b": 1.083, "sitkick": 1.083, "nwin": 1.083, "jump": 1.13, "joy": 1.083, "wave": 1.061, "letter": 1.02, "gift": 1.02, "pet": 1.083, "surprise": 1.0, "dance": 1.13, "point": 1.106, "point2": 1.209, "scope": 1.106, "drum": 1.106}; for (const n in FIX.pose) if (PF[n]) FIX.pose[n] = .69 * PF[n]; for (const n in FIX.walk) FIX.walk[n] = .69 * 1.106; }   // Myah a la même taille à pied qu'en action (panier, filet, canne) et dans les poses : tête mesurée sur les masques de lunettes
/* ================= tenue de Myah (valise) : couleurs + stickers ================= */
const MK = {}; Object.keys(MY).forEach(k => { MK[k] = {}; ['ov', 'sh', 'shoe', 'hair', 'glass'].forEach(p => { const i = new Image(); i.src = 'assets/myah/mk_' + k + '_' + p + '.png'; MK[k][p] = i; }); });   // masques : salopette / t-shirt / chaussures
const MBOX = window.MYMASK || {};   // cadre de la salopette sur chaque image (pour placer les stickers)
const STK = [   // stickers : objets de l'île (trim = part du bas retirée : terre, eau)
  { id: 'flower1', k: 'flower1', trim: .2, n: 'Frangipanier' }, { id: 'flower4', k: 'flower4', trim: .2, n: 'Hibiscus' }, { id: 'flower8', k: 'flower8', trim: .2, n: 'Passiflore' },
  { id: 'flower9', k: 'flower9', trim: .2, n: 'Lotus bleu' }, { id: 'flower0', k: 'flower0', trim: .2, n: 'Héliconia' }, { id: 'flower5', k: 'flower5', trim: .2, n: 'Fleur rose' },
  { id: 'bfly0', k: 'bfly0', n: 'Papillon orange' }, { id: 'bfly2', k: 'bfly2', n: 'Papillon bleu' }, { id: 'bfly4', k: 'bfly4', n: 'Papillon rose' },
  { id: 'swan0', k: 'swan0', trim: .2, n: 'Cygne' }, { id: 'fishA0', k: 'fishA0', n: 'Poisson vert' }, { id: 'fishB2', k: 'fishB2', n: 'Poisson à carreaux' },
  { id: 'fish5', k: 'fish5', n: 'Poisson ange' }, { id: 'fishrb', k: 'fishrb', n: 'Poisson arc-en-ciel' }, { id: 'bouquet', k: 'bouquet', trim: .14, n: 'Plumes' },
];
const STK_BY = {}; STK.forEach(d => STK_BY[d.id] = d);
const outfitEmpty = () => ({ shirt: null, overall: null, shoes: null, hair: null, glasses: null, stickers: [], bagOn: false, bag: null, patch: null, bagStk: [] });
let outfit = outfitEmpty(), outSheet = {}, outfitDirty = false;
const isDefaultOutfit = o => !o.shirt && !o.overall && !o.shoes && !o.hair && !o.glasses && !o.stickers.length && !o.bagOn;
const hslStr = c => 'hsl(' + Math.round(c.h) + ',' + Math.round(c.s * 100) + '%,50%)';
function lightAdj(x, l, W, H) {   // éclaircit ou assombrit uniquement les pixels déjà présents
  if (Math.abs(l - .5) < .01) return;
  x.globalCompositeOperation = 'source-atop'; x.fillStyle = l < .5 ? 'rgba(0,0,0,' + ((.5 - l) * 1.7) + ')' : 'rgba(255,255,255,' + ((l - .5) * 1.5) + ')'; x.fillRect(0, 0, W, H);
}
const stkCache = {};
function stickerCanvas(id, tint) {
  const key = id + '|' + (tint ? Math.round(tint.h) + ',' + Math.round(tint.s * 100) + ',' + Math.round(tint.l * 100) : '');
  if (stkCache[key]) return stkCache[key];
  const d = STK_BY[id], im = d && img['s_' + d.k]; if (!im || !im.naturalWidth) return null;
  const sw = im.naturalWidth, sh = Math.round(im.naturalHeight * (1 - (d.trim || 0))), W = 96, H = Math.max(8, Math.round(W * sh / sw));
  const c = document.createElement('canvas'); c.width = W; c.height = H; const x = c.getContext('2d'); x.imageSmoothingQuality = 'high';
  x.drawImage(im, 0, 0, sw, sh, 0, 0, W, H);
  if (tint) { x.globalCompositeOperation = 'color'; x.fillStyle = hslStr(tint); x.fillRect(0, 0, W, H); x.globalCompositeOperation = 'destination-in'; x.drawImage(im, 0, 0, sw, sh, 0, 0, W, H); lightAdj(x, tint.l, W, H); }
  stkCache[key] = c; return c;
}
const _ft = document.createElement('canvas'); _ft.width = _ft.height = 256; const _fx = _ft.getContext('2d');
const BACKFRAME = /^(up|fup)/;
/* ================= le sac de Myah (bandoulière) : porté ou non, couleur et écusson au choix ================= */
const BAGIMG = {}; ['front', 'back', 'left', 'right', 'patches'].forEach(k => { const i = new Image(); i.src = 'assets/sac/' + (k === 'patches' ? 'patches' : 'sac_' + k) + '.png'; BAGIMG[k] = i; });
const BAG_DEF = { h: 270, s: .35, l: .75 }, BAG_PATCHES = ['Panda', 'Koala', 'Colibri', 'Hibou', 'Plume', 'Coquillage', 'Étoile', 'Cygne', 'Fleur', 'Renard'];
const _bagCache = {};
function bagTint(view, col) {   // recolore les parties lilas du sac (la sangle crème et les boucles dorées gardent leur couleur)
  const im = BAGIMG[view]; if (!im || !im.complete || !im.naturalWidth) return null; if (!col) return im;
  const key = view + JSON.stringify(col); if (_bagCache[key]) return _bagCache[key];
  const c = document.createElement('canvas'); c.width = im.naturalWidth; c.height = im.naturalHeight; const g = c.getContext('2d'); g.drawImage(im, 0, 0);
  const d = g.getImageData(0, 0, c.width, c.height), a = d.data;
  for (let i = 0; i < a.length; i += 4) { if (a[i + 3] < 8) continue; const r = a[i] / 255, gg = a[i + 1] / 255, b = a[i + 2] / 255, mx = Math.max(r, gg, b), mn = Math.min(r, gg, b), l = (mx + mn) / 2, dd = mx - mn; if (dd < .06) continue;
    let h = 0; if (mx === r) h = ((gg - b) / dd + 6) % 6; else if (mx === gg) h = (b - r) / dd + 2; else h = (r - gg) / dd + 4; h *= 60; const s = l > .5 ? dd / (2 - mx - mn) : dd / (mx + mn);
    if (h < 235 || h > 315) continue;   // pas le doré ni le marron
    const nh = col.h, ns = Math.min(1, s * (col.s / BAG_DEF.s)), nl = clamp(l + (col.l - BAG_DEF.l) * .8, .08, .96), q = nl < .5 ? nl * (1 + ns) : nl + ns - nl * ns, p = 2 * nl - q, f = t => { t = (t + 360) % 360; return t < 60 ? p + (q - p) * t / 60 : t < 180 ? q : t < 240 ? p + (q - p) * (240 - t) / 60 : p; };
    a[i] = f(nh + 120) * 255; a[i + 1] = f(nh) * 255; a[i + 2] = f(nh - 120) * 255; }
  g.putImageData(d, 0, 0); return (_bagCache[key] = c);
}
const BAG_POSE_OK = /^(wave|joy|chest|letter|gift|dance|point2?|drum|sleepstand|scope|surprise)$/;
function bagViewOf(sheet, name) {
  if (['walk', 'walkrod', 'walkbask', 'walknet', 'basket', 'net', 'fish'].indexOf(sheet) < 0 && sheet !== 'pose') return null;
  if (sheet === 'pose') return BAG_POSE_OK.test(name) ? 'front' : null;
  const m = /^f?(right|left|down|up|dr|dl)\d*$/.exec(name); if (!m) return /^(cast|reel|caught|jump|attack|hurt|crouch|cwalk|land|leap)/.test(name) ? null : 'front';
  return m[1] === 'right' ? 'right' : m[1] === 'left' ? 'left' : m[1] === 'up' ? 'back' : 'front';
}
function drawBagOnFrame(c, sheet, name, box, o) {
  const v = bagViewOf(sheet, name); if (!v || !box) return;
  const spr = bagTint(v === 'right' ? 'left' : v === 'left' ? 'right' : v, o.bag); if (!spr) return;   // (la planche : « gauche » = sac tourné vers la droite)
  const x0 = box[0], y0 = box[1], x1 = box[2], y1 = box[3], bw = x1 - x0, hh = y1 - y0, ec = o.bag ? hslStr({ h: o.bag.h, s: o.bag.s, l: Math.max(.3, o.bag.l - .1) }) : '#b6a0dd';
  const strap = (ax, ay, bx, by, w) => { c.save(); c.lineCap = 'butt'; c.strokeStyle = '#6b5a86'; c.lineWidth = w + 1.6; c.beginPath(); c.moveTo(ax, ay); c.lineTo(bx, by); c.stroke(); c.strokeStyle = ec; c.lineWidth = w; c.stroke(); c.strokeStyle = '#efe3c4'; c.lineWidth = w * .45; c.stroke(); c.restore(); };
  c.save(); c.globalCompositeOperation = 'source-over'; c.globalAlpha = 1; c.imageSmoothingQuality = 'high';
  if (v === 'front') {
    const w = clamp(bw * .95, 24, 44), h = w * spr.height / spr.width, cx = x1 - w * .2, cy = y0 + hh * .62;
    strap(x0 + bw * .14, y0 + hh * .04, cx - w * .22, cy - h * .5, 3.4);
    c.drawImage(spr, cx - w / 2, cy - h / 2, w, h);
    const pa = BAGIMG.patches; if (o.patch !== null && o.patch !== undefined && pa.complete && pa.naturalWidth) { const pw = w * .3, px = cx, py = cy - h * .16, sx = (o.patch % 5) * 96, sy = Math.floor(o.patch / 5) * 96; c.drawImage(pa, sx, sy, 96, 96, px - pw / 2, py - pw / 2, pw, pw); }
    for (const st of (o.bagStk || [])) { const sc = stickerCanvas(st.id, null); if (!sc) continue; const sw = w * .26, sh = sw * sc.height / sc.width; c.drawImage(sc, cx - w / 2 + st.u * w - sw / 2, cy - h / 2 + st.v * h - sh / 2, sw, sh); }
  } else if (v === 'back') {
    const w = clamp(bw * 1.1, 28, 50), h = w * spr.height / spr.width, cx = x0 + w * .3, cy = y0 + hh * .62;
    strap(cx + w * .12, cy - h * .4, x1 - bw * .14, y0 + hh * .04, 3.2);
    c.drawImage(spr, cx - w / 2, cy - h / 2, w, h);
  } else {
    const h = clamp(hh * .36, 22, 34), w = h * spr.width / spr.height, dir = v === 'right' ? 1 : -1, cx = (x0 + x1) / 2 - dir * bw * .05, cy = y0 + hh * .64;
    strap((x0 + x1) / 2 - dir * bw * .1, y0 + hh * .05, cx - dir * w * .1, cy - h * .45, 3);
    c.drawImage(spr, cx - w / 2, cy - h / 2, w, h);
  }
  c.restore();
}
function renderFrameOutfit(sheet, i, o, out) {   // une image de Myah, avec sa tenue : recolore chaque pièce (teinte du choix, ombres d'origine) puis pose les stickers
  const cols = MY[sheet].cols, sx = (i % cols) * 256, sy = Math.floor(i / cols) * 256, src = img['m_' + sheet], M = MK[sheet], c = out.getContext('2d');
  c.globalCompositeOperation = 'source-over'; c.globalAlpha = 1; c.clearRect(0, 0, 256, 256); c.drawImage(src, sx, sy, 256, 256, 0, 0, 256, 256);
  const name = MY[sheet].names[i], box = MBOX[sheet] && MBOX[sheet][i];
  for (const [k, col] of [['ov', o.overall], ['sh', o.shirt], ['shoe', o.shoes], ['hair', o.hair], ['glass', o.glasses]]) {
    const stk = k === 'ov' && o.stickers.length && box && !BACKFRAME.test(name);
    if (!col && !stk) continue;
    const mk = M[k];
    _fx.globalCompositeOperation = 'source-over'; _fx.globalAlpha = 1; _fx.clearRect(0, 0, 256, 256); _fx.drawImage(src, sx, sy, 256, 256, 0, 0, 256, 256);
    _fx.globalCompositeOperation = 'destination-in'; _fx.drawImage(mk, sx, sy, 256, 256, 0, 0, 256, 256);
    c.globalCompositeOperation = 'destination-out'; c.drawImage(mk, sx, sy, 256, 256, 0, 0, 256, 256);
    if (col && k === 'sh') { _fx.globalCompositeOperation = 'multiply'; _fx.fillStyle = 'hsl(' + Math.round(col.h) + ',' + Math.round(col.s * 100) + '%,' + Math.round(Math.max(.5, col.l) * 100 + (col.l > .5 ? 0 : 6)) + '%)'; _fx.fillRect(0, 0, 256, 256); _fx.globalCompositeOperation = 'destination-in'; _fx.drawImage(mk, sx, sy, 256, 256, 0, 0, 256, 256); }   // t-shirt blanc : on multiplie (la teinte « color » ne marche pas sur du blanc)
    else if (col) { _fx.globalCompositeOperation = 'color'; _fx.fillStyle = hslStr(col); _fx.fillRect(0, 0, 256, 256);
      if (k === 'hair') { _fx.globalCompositeOperation = 'lighter'; _fx.fillStyle = 'hsl(' + Math.round(col.h) + ',' + Math.round(col.s * 90) + '%,' + Math.round(col.l * 52) + '%)'; _fx.fillRect(0, 0, 256, 256); }   // cheveux très sombres : on ajoute de la couleur en gardant le relief des mèches
      _fx.globalCompositeOperation = 'destination-in'; _fx.drawImage(mk, sx, sy, 256, 256, 0, 0, 256, 256); if (k !== 'hair') lightAdj(_fx, col.l, 256, 256); }
    if (stk) {
      _fx.globalCompositeOperation = 'source-atop'; const bw = box[2] - box[0];
      for (const st of o.stickers) { const sc = stickerCanvas(st.id, st.tint); if (!sc) continue; const w = st.w * bw, h = w * sc.height / sc.width * (st.sy || 1); _fx.globalAlpha = .88; _fx.drawImage(sc, box[0] + st.u * bw - w / 2, box[1] + st.v * bw - h / 2, w, h); }
      _fx.globalAlpha = 1;
    }
    c.globalCompositeOperation = 'source-over'; c.drawImage(_ft, 0, 0);
  }
  if (o.bagOn) drawBagOnFrame(c, sheet, name, box, o);
  c.globalCompositeOperation = 'source-over'; c.globalAlpha = 1;
}
function bakeOutfit() {   // recolore toutes les images de Myah d'un coup (quelques dizaines de ms)
  outfitDirty = false;
  if (isDefaultOutfit(outfit)) { outSheet = {}; return; }
  for (const sh of Object.keys(MY)) { const src = img['m_' + sh]; if (!src || !src.naturalWidth || !['ov', 'sh', 'shoe', 'hair', 'glass'].every(p => MK[sh][p].naturalWidth)) { outfitDirty = true; return; } }
  const fo = document.createElement('canvas'); fo.width = fo.height = 256; const res = {};
  for (const sh of Object.keys(MY)) {
    const src = img['m_' + sh], c = document.createElement('canvas'); c.width = src.naturalWidth; c.height = src.naturalHeight; const cx = c.getContext('2d'), cols = MY[sh].cols;
    MY[sh].names.forEach((n, i) => { renderFrameOutfit(sh, i, outfit, fo); cx.drawImage(fo, (i % cols) * 256, Math.floor(i / cols) * 256); });
    res[sh] = c;
  }
  outSheet = res;
}
function setOutfit(o) {
  outfit = outfitEmpty();
  if (o) { ['shirt', 'overall', 'shoes', 'hair', 'glasses'].forEach(k => { const c = o[k]; if (c && isFinite(c.h) && isFinite(c.s) && isFinite(c.l)) outfit[k] = { h: +c.h, s: clamp(+c.s, 0, 1), l: clamp(+c.l, .05, .95) }; });
    outfit.stickers = (o.stickers || []).filter(t => STK_BY[t.id]).slice(0, 8).map(t => ({ id: t.id, u: +t.u || .5, v: +t.v || .5, w: clamp(+t.w || .3, .08, .8), tint: t.tint ? { h: +t.tint.h, s: +t.tint.s, l: +t.tint.l } : null })); }
  if (o && o.bagOn) { outfit.bagOn = true; const c = o.bag; if (c && isFinite(c.h) && isFinite(c.s) && isFinite(c.l)) outfit.bag = { h: +c.h, s: clamp(+c.s, 0, 1), l: clamp(+c.l, .05, .95) }; if (Number.isInteger(o.patch) && o.patch >= 0 && o.patch < 10) outfit.patch = o.patch; if (Array.isArray(o.bagStk)) outfit.bagStk = o.bagStk.filter(s => s && STK.some(d => d.id === s.id) && isFinite(s.u) && isFinite(s.v)).slice(0, 3).map(s => ({ id: s.id, u: clamp(+s.u, 0, 1), v: clamp(+s.v, 0, 1) })); }
  outfitDirty = true; bakeOutfit();
}
setInterval(() => { if (outfitDirty) bakeOutfit(); }, 300);
const myImg = sheet => outSheet[sheet] || img['m_' + sheet];
function myFrame(sheet, name, x, y, flip, lift = 0, scale = 1, cutTop = 0, cutH = 256) {
  const i = myIdx[sheet][name]; if (i === undefined) return;
  if (FIX[sheet]) scale *= FIX[sheet][name] || 1;
  const cols = MY[sheet].cols, sx = (i % cols) * 256, sy = Math.floor(i / cols) * 256, s = MS * scale;
  ctx.save(); ctx.translate(x, y - lift); ctx.scale(flip ? -1 : 1, 1);
  ctx.filter = 'contrast(1.06)';
  ctx.drawImage(myImg(sheet), sx, sy + cutTop, 256, cutH, -128 * s, (-212 + cutTop) * s, 256 * s, cutH * s);
  ctx.restore();
}
const cyc = (arr, rate) => arr[Math.floor(time * rate) % arr.length];
const pick3 = (arr, v) => arr[clamp(Math.floor(v), 0, arr.length - 1)];
let bwPh = 0, bwT = 0, bwX = null, bwY = null, bwDir = null;
const WALK_N = { right: 6, left: 6, down: 8, up: 8, dr: 8, dl: 8 };   // images par cycle de marche (le profil en a 6)
function bareWalk(d4, mv, run, lift) {   // marche « mains vides » : les pieds avancent au rythme réel du déplacement (plus de glissade)
  const dtw = time - bwT; bwT = time;
  const inn = IN.on, x = inn ? IN.x : player.x, y = inn ? IN.y : player.y;
  let d = 0; if (bwX != null && dtw > 0 && dtw < .25) d = Math.hypot(x - bwX, y - bwY);
  bwX = x; bwY = y;
  // direction de l'image : 8 secteurs (profil, 3/4 bas, face, dos) avec une marge, pour que le joystick tactile ne fasse pas clignoter les poses
  let dir = d4;
  if (mv && !String(player.state).startsWith('cine')) {
    const mx = player.mvx || 0, my = player.mvy || 0, a = (Math.atan2(my, mx) * 180 / Math.PI + 360) % 360;   // 0° = droite, 90° = bas
    const SEC = { right: [0, 22.5], dr: [45, 22.5], down: [90, 22.5], dl: [135, 22.5], left: [180, 22.5], up: [270, 67.5] };
    const inSec = (k, m) => { const c = SEC[k][0], w = SEC[k][1] + m; let df = Math.abs(a - c) % 360; if (df > 180) df = 360 - df; return df <= w; };
    if (bwDir && inSec(bwDir, 14)) dir = bwDir;
    else dir = Object.keys(SEC).find(k => inSec(k, 0)) || d4;
    bwDir = dir;
  } else bwDir = null;
  const N = WALK_N[dir] || 8;
  if (mv && dtw > 0 && dtw < .25) {
    // un cycle complet = 2 pas ≈ 38 px ; dedans, la pièce est agrandie d'un facteur IN_K
    const CYC = { right: 26, left: 26, dr: 28, dl: 28, down: 22, up: 22 }[dir] || 26;   // longueur réelle d'un cycle = deux pas de l'écart des jambes : les pieds ne glissent plus
    const stride = CYC * (run ? 1.3 : 1) * (inn ? IN_K * .88 : 1) / N;
    let adv = d > 400 * dtw ? 0 : d / stride;
    adv = Math.max(adv, dtw * (run ? 4 : 3));   // jamais figée tant qu'elle marche
    bwPh += adv;
  }
  if (!mv) bwPh = 0;
  const ph = Math.floor(bwPh) % N;
  const tk = tool === 'fish' ? 'm_walkrod' : tool === 'basket' ? 'm_walkbask' : tool === 'net' ? 'm_walknet' : null, wi = tk && img[tk], sheet = wi && wi.complete && wi.naturalWidth ? tk.slice(2) : 'walk';   // outil en main : même marche, avec les bras et l'objet
  if (mv && (dir === 'down' || dir === 'up')) {   // de face / de dos : les images de marche sont en 3/4 (ça fait « en diagonale ») → on garde la vraie pose de face / de dos et on la fait glisser avec un petit rebond
    return { sheet, name: dir + (Math.floor(bwPh / N * 2) % 2 ? 5 : 1), flip: false, lift: Math.abs(Math.sin(bwPh / N * 2 * Math.PI)) * 1.7 };
  }
  return { sheet, name: dir + (mv ? ph + 1 : 1), flip: false, lift: mv ? Math.abs(Math.sin(bwPh / N * 2 * Math.PI)) * 1.7 : 0 };   // elle glisse avec un petit rebond
}
const TIPROD = {"cast1": [-74, -202], "cast2": [122, -170], "cast3": [118, -174], "reel1": [114, -184], "reel2": [84, -194], "reel3": [84, -194], "caught1": [60, -201], "caught2": [-24, -193], "caught3": [-44, -194]};   // bout de la canne (nouvelles poses de pêche)
let _idleSince = 0, _wasTalk = false, _waveT = 0;
function myahPose() {
  const p = player, f = p.face < 0, t = tool, run = p.anim === 'run';
  if (p.state === 'fishing') {
    const ph = fs.phase; let name = 'cast3';
    if (ph === 'cast') name = pick3(['cast1', 'cast2', 'cast3'], p.fr / 3.4);
    else if (ph === 'bite' || ph === 'fight') name = cyc(['reel1', 'reel2'], 5);
    else if (ph === 'reel') name = p.fr >= 18 ? pick3(['caught1', 'caught2', 'caught3'], (p.fr - 18) / 2.4) : pick3(['reel1', 'reel2', 'reel3'], p.fr - 15);
    const pkF = img.m_pose, okP = pkF && pkF.complete && pkF.naturalWidth && myIdx.pose && myIdx.pose.fcau !== undefined;
    if (okP && ph === 'reel' && p.fr >= 18) return { sheet: 'pose', name: 'fcau', flip: f, lift: 0 };   // poisson brandi (planche corps entier)
    const wr = img.m_walkrod, ok = wr && wr.complete && wr.naturalWidth && myIdx.walkrod && myIdx.walkrod[name] !== undefined;   // nouvelle pose : bras + canne sur le corps de la marche
    return { sheet: ok ? 'walkrod' : 'fish', name, flip: f, lift: 0 };
  }
  if (p.state === 'act') {
    const u = clamp(p.fr / 25, 0, 1);
    const okS = k => { const im = img['m_' + k]; return !!(im && im.complete && im.naturalWidth); };   // nouvelles poses (bras + objet sur le corps de la marche) si chargées
    const pk = img.m_pose; if (act.kind === 'pick' && pk && pk.complete && pk.naturalWidth && u < .9) return { sheet: 'pose', name: u < .12 ? 'cr1' : u < .24 ? 'cr2' : u < .78 ? cyc(['cr4', 'cr4', 'cr3'], 3) : 'cr5', flip: f, lift: 0 };   // vraie accroupie (image dédiée)
    if (act.kind === 'pick') return { sheet: okS('walkbask') ? 'walkbask' : 'basket', name: u < .18 ? 'crouch' : u < .78 ? 'crouchidle' : u < .9 ? 'crouch' : 'idle', flip: f, lift: 0 };
    if (pk && pk.complete && pk.naturalWidth && myIdx.pose && myIdx.pose.nsw1 !== undefined && u >= .2 && u < .85) {   // coup d'épuisette : poses corps entier (élan → fente → bras levés si prise)
      if (u < .36) return { sheet: 'pose', name: 'nsw1', flip: f, lift: 0 };
      if (u < .62) return { sheet: 'pose', name: 'nsw2', flip: f, lift: 0 };
      if (act.got) return { sheet: 'pose', name: 'nwin', flip: f, lift: 0 };
    }
    return { sheet: okS('walknet') ? 'walknet' : 'net', name: u < .2 ? 'ready' : u < .62 ? 'swing' : u < .85 ? (act.got ? 'victory' : 'ready') : 'idle', flip: f, lift: 0 };
  }
  if (t === 'net' && p.state === 'free' && img.m_walknet && img.m_walknet.complete && img.m_walknet.naturalWidth) return bareWalk(p.dir4 || 'down', Math.hypot(p.mvx || 0, p.mvy || 0) > .1, run, 0);
  if (t === 'basket' && p.state === 'free' && img.m_walkbask && img.m_walkbask.complete && img.m_walkbask.naturalWidth) return bareWalk(p.dir4 || 'down', Math.hypot(p.mvx || 0, p.mvy || 0) > .1, run, 0);
  if (t === 'fish' && p.state === 'free') {
    const d4 = p.dir4 || 'down', mv = Math.hypot(p.mvx || 0, p.mvy || 0) > .1;
    if (img.m_walkrod && img.m_walkrod.complete && img.m_walkrod.naturalWidth) return bareWalk(d4, mv, run, 0);
    const step = mv ? (Math.floor(time * (run ? 9 : 6.2)) % 2 ? 2 : 3) : 1;
    return { sheet: 'fish', name: d4 === 'down' ? 'fdown1' : 'f' + d4 + step, flip: false, lift: mv ? Math.abs(Math.sin(time * (run ? 12 : 9))) * 1.3 : 0 };
  }
  if (t === 'none' && (p.state === 'free' || p.state === 'talk' || p.state === 'cine')) {
    const d4 = p.dir4 || 'down', mv = p.state === 'free' && Math.hypot(p.mvx || 0, p.mvy || 0) > .1;
    if (mv || p.state !== 'free') _idleSince = time;
    if (STR.pre > 0) return { sheet: 'pose', name: 'scope', flip: f, lift: 0 };   // pose longue-vue : elle contemple les étoiles
    if (time < (p.surprise || 0)) return { sheet: 'pose', name: 'surprise', flip: false, lift: 0 };   // aïe ! (crabe qui pince)
    if (MI.deliv && p.state === 'free') return { sheet: 'pose', name: MI.deliv.kind === 'lettre' ? 'letter' : 'gift', flip: false, lift: mv ? Math.abs(Math.sin(time * 8.5)) * 1.5 : 0 };   // elle tient la lettre / le cadeau reçu
    if (p.state === 'talk') { if (!_wasTalk) _waveT = time; _wasTalk = true; if (time - _waveT < 1.5) return { sheet: 'pose', name: 'wave', flip: false, lift: 0 }; } else _wasTalk = false;   // elle salue en commençant à parler
    if (!mv && p.state === 'free' && time - _idleSince > 180) return { sheet: 'pose', name: 'sleepstand', flip: false, lift: 0 };   // elle s'endort debout si on ne fait rien
    if (mv && run && Math.abs(p.mvx || 0) > Math.abs(p.mvy || 0) * 1.2) return { sheet: 'pose', name: 'run', flip: (p.mvx || 0) < 0, lift: Math.abs(Math.sin(time * 12)) * 1.6 };   // course de profil
    const lift = mv ? Math.abs(Math.sin(time * (run ? 12 : 8.5))) * 1.4 : 0;
    return bareWalk(d4, mv, run, lift);
  }
  if (p.state === 'jump') {
    const u = clamp(p.fr / 25, 0, 1), lift = Math.sin(u * Math.PI) * 16;
    if (t === 'none') return { sheet: 'pose', name: 'jump', flip: f, lift };
    if (t === 'fish') return { sheet: 'fish', name: u < .3 ? 'jump1' : u < .7 ? 'jump2' : 'jump3', flip: f, lift };
    const wk = t === 'net' ? img.m_walknet : img.m_walkbask; if (wk && wk.complete && wk.naturalWidth) return bareWalk(p.dir4 || 'down', false, false, lift);   // saut avec l'objet en main : même pose que la marche
    if (t === 'net') return { sheet: 'net', name: u < .8 ? 'leap' : 'ready', flip: f, lift };
    return { sheet: 'basket', name: u < .8 ? 'jump' : 'land', flip: f, lift };
  }
  if (p.state === 'free' && (p.anim === 'walk' || p.anim === 'run') && Math.hypot(p.mvx || 0, p.mvy || 0) > .1) {
    const lift = Math.abs(Math.sin(time * (run ? 12 : 8.5))) * 1.6;
    if (Math.abs(p.mvy) > Math.abs(p.mvx) * 1.2) {   // marche verticale : on garde l'outil en main quand on le voit (de face), sinon pose de marche normale
      if (p.mvy > 0 && t === 'basket') return { sheet: 'basket', name: cyc(['walk1', 'walk2', 'walk3', 'walk2'], run ? 9 : 6.5), flip: false, lift: 0 };
      if (p.mvy > 0 && t === 'net') return { sheet: 'net', name: 'idle', flip: false, lift };
      return bareWalk(p.mvy > 0 ? 'down' : 'up', true, run, lift);
    }
    if (t === 'fish' && img.m_walkrod && img.m_walkrod.complete && img.m_walkrod.naturalWidth) return bareWalk(p.dir4 || 'right', true, run, 0);
    if (t === 'fish') return { sheet: 'fish', name: run ? cyc(['run1', 'run2', 'run3', 'run2'], 12) : cyc(['walk1', 'walk2', 'walk3', 'walk4'], 9), flip: f, lift: 0 };
    if (t === 'net') return { sheet: 'net', name: run ? 'run' : 'walk', flip: f, lift };
    return { sheet: 'basket', name: cyc(['run1', 'run2', 'run3', 'run2'], run ? 9 : 6), flip: f, lift: 0 };   // de profil (les poses 'walk' du panier sont de face)
  }
  return t === 'none' ? bareWalk(p.dir4 || 'down', false, false, 0) : { sheet: t, name: t === 'fish' ? 'f' + (p.dir4 || 'down') + '1' : 'idle', flip: f, lift: 0 };
}
function drawMyah(x, y) { const o = myahPose(); myFrame(o.sheet, o.name, x, y, o.flip, o.lift); }
function shadow(x, y, r = 11) { ctx.fillStyle = 'rgba(0,0,0,.24)'; ctx.beginPath(); ctx.ellipse(x, y + 1, r, r * .38, 0, 0, TAU); ctx.fill(); }
const imgAct = {}; ['parler', 'donner'].forEach(k => { const im = new Image(); im.src = 'assets/icons/a-' + k + '.png'; imgAct[k] = im; });
function drawHalo(h) {   // petit halo doré qui respire, autour de ce avec quoi on peut interagir
  const pulse = .5 + .5 * Math.sin(time * 4), r = h.r * (h.air ? .62 : 1) * (1 + .08 * pulse), cy = h.air ? h.y : h.y;   // papillons / lucioles : cercle plus petit et plus léger
  ctx.save(); ctx.translate(h.x, cy - (h.tree ? 0 : 0));
  const flat = h.air ? 1 : .42;
  ctx.scale(1, flat);
  const g = ctx.createRadialGradient(0, 0, r * .2, 0, 0, r * 1.15);
  g.addColorStop(0, 'rgba(255,240,150,.0)'); g.addColorStop(.7, 'rgba(255,236,140,.34)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.globalAlpha = h.air ? .5 : 1; ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, r * 1.15, 0, TAU); ctx.fill();
  ctx.globalAlpha = (.55 + .35 * pulse) * (h.air ? .5 : 1); ctx.lineWidth = h.air ? 1.1 : 1.6; ctx.strokeStyle = '#fff3b0';
  ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.stroke(); ctx.restore();
}
function drawRoofLabel(txt, x, y) {   // petit nom de lieu, un peu transparent, posé au-dessus du toit
  ctx.save(); ctx.globalAlpha = .78; ctx.font = 'bold 6.5px "Trebuchet MS",system-ui,sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const w = ctx.measureText(txt).width + 9, h = 11; ctx.fillStyle = '#f6ecdb'; ctx.strokeStyle = '#c9a35a'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.roundRect(x - w / 2, y - h / 2, w, h, 5.5); ctx.fill(); ctx.stroke(); ctx.fillStyle = '#4b2a7a'; ctx.fillText(txt, x, y + .5); ctx.restore();
}
function drawBubble(txt, x, y, icon) {
  if (!txt && icon && icon.complete && icon.naturalWidth) {
    const ih = 19, iw = ih * icon.naturalWidth / icon.naturalHeight, p = 3;
    ctx.fillStyle = '#fff8e8'; ctx.strokeStyle = '#7a4b24'; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.roundRect(x - iw / 2 - p, y - ih / 2 - p, iw + 2 * p, ih + 2 * p, 7); ctx.fill(); ctx.stroke();
    ctx.drawImage(icon, x - iw / 2, y - ih / 2, iw, ih); return;
  }
  ctx.font = 'bold 9px "Trebuchet MS",system-ui,sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const ic = icon && icon.complete && icon.naturalWidth ? 15 : 0, w = ctx.measureText(txt).width + 12 + (ic ? ic + 2 : 0);
  ctx.fillStyle = '#fff8e8'; ctx.strokeStyle = '#7a4b24'; ctx.lineWidth = 1.2;
  ctx.beginPath(); ctx.roundRect(x - w / 2, y - 9, w, 18, 6); ctx.fill(); ctx.stroke(); ctx.fillStyle = '#3b2a1e';
  if (ic) { ctx.drawImage(icon, x - w / 2 + 4, y - 7.5, 15, 15); ctx.fillText(txt, x + (ic + 2) / 2, y + 1); } else ctx.fillText(txt, x, y + 1);
}
function marker(x, y, sym, col) {
  ctx.fillStyle = col; ctx.strokeStyle = '#7a4b24'; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.arc(x, y, 8, 0, TAU); ctx.fill(); ctx.stroke();
  ctx.fillStyle = sym === '✔' ? '#fff' : '#5a3a14'; ctx.font = 'bold 11px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(sym, x, y + .5);
}
function drawRider(g) {
  // Myah assise sur le dos du cygne (coordonnées locales du cygne)
  const k = MS / SW_MOUNT;
  myFrame('walk', 'down1', 0, 30 * k + 2, false, 0, 1 / SW_MOUNT, 70, 112);
}

function render() {
  ctx = mainCtx;
  const vw = cv.width / dpr, vh = cv.height / dpr, p = player;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.fillStyle = '#12607f'; ctx.fillRect(0, 0, vw, vh);
  if (!ready()) { ctx.fillStyle = '#fff'; ctx.font = '24px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('Chargement…', vw / 2, vh / 2); return; }
  if (IN.on) { renderInterior(vw, vh); return; }
  ctx.setTransform(dpr * cam.z, 0, 0, dpr * cam.z, -cam.x * cam.z * dpr, -cam.y * cam.z * dpr);
  ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'medium';
  const dst = dayState();
  { const vx = Math.max(0, cam.x), vy = Math.max(0, cam.y), ex = Math.min(W, cam.x + vw / cam.z), ey = Math.min(H, cam.y + vh / cam.z);
    const one = (n, al) => { const im = img[n]; if (!im || !im.naturalWidth) return false; const k = im.naturalWidth / W; ctx.globalAlpha = al; ctx.drawImage(im, vx * k, vy * k, (ex - vx) * k, (ey - vy) * k, vx, vy, ex - vx, ey - vy); ctx.globalAlpha = 1; return true; };
    if (ex > vx && ey > vy) { if (!one(dst.A.n, 1)) one('map', 1); if (dst.B !== dst.A && dst.u > .002) one(dst.B.n, dst.u); } }
  const vL = cam.x - 70, vR = cam.x + vw / cam.z + 70, vT = cam.y - 120, vB = cam.y + vh / cam.z + 70, inV = (x, y) => x > vL && x < vR && y > vT && y < vB;

  if (hz && !IN.on) drawHalo(hz);
  const tint = dst.tint, useL = tint[3] > .012;   // en soirée / la nuit, tout ce qui bouge est teinté pour s'accorder à la carte
  if (useL) { if (lcv.width !== cv.width || lcv.height !== cv.height) { lcv.width = cv.width; lcv.height = cv.height; } lctx.setTransform(1, 0, 0, 1, 0, 0); lctx.clearRect(0, 0, lcv.width, lcv.height); lctx.setTransform(dpr * cam.z, 0, 0, dpr * cam.z, -cam.x * cam.z * dpr, -cam.y * cam.z * dpr); lctx.imageSmoothingEnabled = true; lctx.imageSmoothingQuality = 'medium'; ctx = lctx; }
  for (const f of fishes) if (f.state !== 'gone' && inV(f.x, f.y)) drawFishUnderPier(f);
  for (const s of swans) if (inV(s.x, s.y)) drawPondSwan(s);

  const items = [];
  bananas.forEach(b => inV(b.x, b.y) && items.push({ y: b.y, draw() { drawTree(b); } }));
  flowers.forEach(f => f.alive && inV(f.x, f.y) && items.push({ y: f.y, draw() { sprDraw('flower' + f.col, f.x, f.y + 1, .42, false, .6); } }));
  QUESTS.forEach(q => {
    if (!inV(q.x, q.y) && !inV(q.cx, q.cy)) return;
    items.push({ y: q.cy, draw() {
      const ready = qState[q.id] === 'done' && !opened[q.id];
      const sh = q.rustle > 0 ? Math.sin(time * 48) * 1.6 * Math.min(1, q.rustle * 3) : 0;
      if (ready && !q.found) {   // auréole + scintillements
        const pu = .55 + Math.sin(time * 3.2) * .25;
        const gr = ctx.createRadialGradient(q.cx, q.cy - 8, 2, q.cx, q.cy - 8, 38); gr.addColorStop(0, 'rgba(255,240,150,' + Math.min(1, pu * 1.35) + ')'); gr.addColorStop(1, 'rgba(255,244,170,0)');
        ctx.fillStyle = gr; ctx.fillRect(q.cx - 40, q.cy - 48, 80, 80);
      }
      const idx = opened[q.id] ? [0, 1, 2, 1, 2][QUESTS.indexOf(q)] : q.found ? 4 : ready ? 3 : [0, 1, 2, 1, 2][QUESTS.indexOf(q)];
      const pop = q.found && q.reveal < 1 ? 1 + Math.sin(ease(q.reveal) * Math.PI) * .16 : 1, shk = q.opening ? Math.sin(time * 42) * 1.3 : sh;
      bushShadow(q.cx + shk, q.cy + 3, pop * (q.bsc + .07));
      ctx.save(); ctx.filter = 'saturate(.82) brightness(.78) contrast(1.06)'; sprDraw('bush' + idx, q.cx + shk, q.cy + 3, pop * q.bsc, false, .86); ctx.restore();   // teinte un peu plus sombre pour se fondre dans le décor
      if (q.opening) {   // la plume s'envole du coffre
        const t = q.chestOpen; ctx.save(); ctx.globalAlpha = Math.min(1, t * 3) * (1 - Math.max(0, t - .8) * 5);
        drawBouquet(q.cx, q.cy - 10 - t * 30, 26 + t * 6, Math.sin(time * 9) * .08); ctx.restore();
      }
      if (ready && !q.found) {
        for (let i = 0; i < 6; i++) { const ph = time * 1.7 + i * 1.6, a = Math.max(0, Math.sin(ph)), x = q.cx + Math.cos(i * 2.3 + 1) * 16, y = q.cy - 8 - ((ph % 3.14) / 3.14) * 22;
          ctx.save(); ctx.globalAlpha = a; ctx.translate(x, y); ctx.scale(2 + a * 1.4, 2 + a * 1.4); ctx.fillStyle = i % 2 ? '#fff' : '#ffe27a'; ctx.beginPath(); ctx.moveTo(0, -1.4); ctx.lineTo(.35, -.35); ctx.lineTo(1.4, 0); ctx.lineTo(.35, .35); ctx.lineTo(0, 1.4); ctx.lineTo(-.35, .35); ctx.lineTo(-1.4, 0); ctx.lineTo(-.35, -.35); ctx.closePath(); ctx.fill(); ctx.restore(); }
      }
    } });
    items.push({ y: q.y, draw() {
      shadow(q.x, q.y, q.h * .26);
      ctx.save(); ctx.globalAlpha = 1; drawNpcSprite(npcPick(q), q.x, q.y, time, false); ctx.restore();
      const st = qState[q.id]; if (!unlocked(q) || (st === 'done')) return;
      if (st === 'new' && q !== QUESTS.find(o => qState[o.id] !== 'done')) return;   // '!' seulement pour la prochaine quête, dans l'ordre
      const ready = st === 'active' && hasAll(q);
      marker(q.x, q.y - q.h - 10, ready ? '✔' : (st === 'new' ? '!' : '…'), ready ? '#47b84a' : '#ffc83d');
    } });
  });
  EXTRAS.forEach(e => inV(e.x, e.y) && items.push({ y: e.y, draw() { shadow(e.x, e.y, e.sprite.h * .26); ctx.save(); ctx.globalAlpha = 1; drawNpcSprite(npcPick(e), e.x, e.y, time, false); ctx.restore(); } }));
  butterflies.forEach(b => b.alive && inV(b.x, b.y) && items.push({ y: b.y + 30, draw() {
    ctx.fillStyle = 'rgba(0,0,0,' + clamp(.16 - b.z * .004, .04, .16) + ')'; ctx.beginPath(); ctx.ellipse(b.x, b.y + 1, 3, 1.2, 0, 0, TAU); ctx.fill();
    ctx.save(); ctx.globalAlpha = .5; drawBfly(b); ctx.restore();
  } }));
  if (perchVisible() && !perchAway()) items.push({ y: D.perch[1], draw() {
    drawLegendSpr(ctx, { x: D.perch[0], y: D.perch[1], s: SW_PERCH, t: time, dir: 1, mode: 'perch', alt: swanAlt, sparkle: swanSparkle, feathers: swanFeathers });
  } });
  MI.animals.forEach(a => items.push({ y: a.y, draw() { drawAnimal(a); } }));
  MI.items.forEach(it => it.kind === 'shell' && items.push({ y: it.y - 10, draw() { drawMiniItem(it, 1); } }));   // coquillages triés avec Myah : elle passe devant
  if (!p.mount) items.push({ y: p.y, draw() { shadow(p.x, p.y, 12); ctx.save(); ctx.globalAlpha = 1; drawMyah(p.x, p.y); ctx.restore(); } });
  else if (p.mount === 'float') items.push({ y: p.y, draw() { drawLegendSpr(ctx, { x: p.x, y: p.y, s: SW_MOUNT, t: time, dir: p.face, mode: 'float', alt: p.alt, sparkle: .12, rider: drawRider }); } });
  HOUSES.forEach(h => { if (dist(p.x, p.y, h.door[0], h.door[1]) < 62 && !p.mount && h.id !== 'boat') { const L = h.lab || [h.door[0], h.door[1] - 26]; items.push({ y: h.door[1] + 60, draw() { drawRoofLabel(h.name, L[0], L[1]); } }); } });
  items.sort((a, b) => a.y - b.y).forEach(o => o.draw());

  // ligne de pêche
  if (p.state === 'fishing' && fs.phase) {
    const TIP = TIPROD;
    const TIPW = TIPROD;
    const po = myahPose(), tp = (po.sheet === 'walkrod' ? TIPW[po.name] : TIP[po.name]) || [70, -92], tk = MS * ((FIX[po.sheet] && FIX[po.sheet][po.name]) || 1);   // la ligne part du bout de la canne, selon l'image affichée
    const sx = p.x + (po.flip ? -1 : 1) * tp[0] * tk, sy = p.y + tp[1] * tk - (po.lift || 0);
    const dip = (fs.phase === 'bite' || fs.phase === 'fight') ? Math.sin(time * 30) * 1.2 + 2 : 0;
    if (fs.phase !== 'reel' || p.fr < 17) {
      ctx.strokeStyle = 'rgba(255,255,255,.9)'; ctx.lineWidth = .9; ctx.beginPath(); ctx.moveTo(sx, sy);
      ctx.quadraticCurveTo((sx + fs.tx) / 2, Math.min(sy, fs.ty) - 12, fs.tx, fs.ty + dip); ctx.stroke();
      const t = (time * .9) % 1;
      ctx.globalAlpha = .7 * (1 - t); ctx.strokeStyle = '#fff'; ctx.lineWidth = .8; ctx.beginPath(); ctx.ellipse(fs.tx, fs.ty + 1, 4 + t * 10, 2 + t * 4.5, 0, 0, TAU); ctx.stroke(); ctx.globalAlpha = 1;
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(fs.tx, fs.ty + dip, 3, 0, TAU); ctx.fill();
      ctx.fillStyle = '#ee3b3b'; ctx.beginPath(); ctx.arc(fs.tx, fs.ty + dip - 1, 2.1, Math.PI, 0); ctx.fill();
    }
    if (fs.phase === 'bite') drawBubble('❗', p.x, p.y - 66);
  }
  if (bubble.t > 0 && p.state !== 'fishing' && !p.mount) { /* texte affiché dans la barre d'indice */ }

  // cygne monté en vol : au-dessus de tout
  if (p.mount === 'fly') drawLegendSpr(ctx, { x: p.x, y: p.y, s: SW_MOUNT, t: time, dir: p.face, mode: 'fly', alt: p.alt, phase: time * 8.5, sparkle: .12, rider: drawRider });
  // cygnes qui repartent
  for (const l of leavers) { const k = l.t / 1.4; ctx.save(); ctx.globalAlpha = clamp(1 - k * k, 0, 1); drawLegendSpr(ctx, { x: l.x + l.dir * k * 90, y: l.y - k * 40, s: SW_MOUNT, t: time, dir: l.dir, mode: 'fly', alt: 52 + k * 200, phase: time * 8.5, sparkle: .1 }); ctx.restore(); }

  // objets ramassés qui volent vers Myah
  for (const f of flyers) {
    const k = f.t / .7, ex = p.x, ey = p.y - 40 - p.alt, x = f.x + (ex - f.x) * k, y = f.y + (ey - f.y) * k - Math.sin(k * Math.PI) * 26;
    ctx.save(); ctx.globalAlpha = 1 - k * .5; ctx.translate(x, y); ctx.scale(.8 - k * .3, .8 - k * .3);
    if (f.kind === 'coconut' || f.kind === 'mango') { const al = TALT[f.kind], s = al.s.bunch, kk = .085; ctx.drawImage(img['t_' + f.kind], s[0], s[1], s[2], s[3], -s[2] * kk / 2, -s[3] * kk / 2, s[2] * kk, s[3] * kk); } else if (f.kind === 'banana') { const s = TR.s.bunch, kk = .09; ctx.drawImage(img.t_trees, s[0], s[1], s[2], s[3], -s[2] * kk / 2, -s[3] * kk / 2, s[2] * kk, s[3] * kk); } else if (f.kind === 'flower') sprDraw('flower1', 0, 10, 1);
    else if (f.kind === 'butterfly') drawBfly({ sp: 'monarch', x: 0, y: 0, z: 0, flap: time * 18, tilt: 0, size: 1.1 });
    else drawFishSpr({ x: 0, y: 0, ang: -.4, col: 2, size: 1.2, ph: 0, alpha: 1 }, time);
    ctx.restore();
  }
  // plumes qui volent vers le cygne
  if (cine && cine.kind === 'return') for (const f of cine.flights) {
    const t0 = .3 + f.i * .5, u = (cine.t - t0) / 1.1; if (u < 0 || u >= 1) continue;
    const ex = D.perch[0], ey = D.perch[1] - 66, x = f.sx + (ex - f.sx) * ease(u), y = f.sy + (ey - f.sy) * ease(u) - Math.sin(u * Math.PI) * 50;
    drawBouquet(x, y, 28, u * 1.2 - .3);
  }
  if (useL) { lctx.setTransform(1, 0, 0, 1, 0, 0); lctx.globalCompositeOperation = 'source-atop'; lctx.fillStyle = 'rgba(' + Math.round(tint[0]) + ',' + Math.round(tint[1]) + ',' + Math.round(tint[2]) + ',' + tint[3].toFixed(3) + ')'; lctx.fillRect(0, 0, lcv.width, lcv.height); lctx.globalCompositeOperation = 'source-over';
    ctx = mainCtx; ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.drawImage(lcv, 0, 0); ctx.setTransform(dpr * cam.z, 0, 0, dpr * cam.z, -cam.x * cam.z * dpr, -cam.y * cam.z * dpr); }
  miniDraw();
  for (const s of sparks) {
    ctx.globalAlpha = clamp(1 - s.t / s.life, 0, 1);
    if (s.star) { ctx.save(); ctx.translate(s.x, s.y); ctx.scale(s.r * .5, s.r * .5); ctx.fillStyle = s.c; ctx.beginPath(); ctx.moveTo(0, -1.7); ctx.lineTo(.4, -.4); ctx.lineTo(1.7, 0); ctx.lineTo(.4, .4); ctx.lineTo(0, 1.7); ctx.lineTo(-.4, .4); ctx.lineTo(-1.7, 0); ctx.lineTo(-.4, -.4); ctx.closePath(); ctx.fill(); ctx.restore(); }
    else { ctx.fillStyle = s.c; ctx.fillRect(s.x, s.y, s.r * .8, s.r * .8); }
  } ctx.globalAlpha = 1;
  for (const f of floaters) {
    const k = f.t / 1.4; ctx.globalAlpha = 1 - k * k; ctx.font = 'bold 12px "Trebuchet MS",sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.lineWidth = 3; ctx.strokeStyle = '#7a4b24'; ctx.strokeText(f.txt, f.x, f.y - k * 22); ctx.fillStyle = f.color; ctx.fillText(f.txt, f.x, f.y - k * 22); ctx.globalAlpha = 1;
  }
}

function frame(now) {
  const dt = Math.min(0.05, (now - lastT) / 1000); lastT = now;
  if (dayAuto) { const d0 = dayT; dayT = (dayT + dt / DAY_LEN) % 1; if (dayT < d0) { mini.dayNo = (mini.dayNo || 0) + 1; MI.items = MI.items.filter(i => i.kind !== 'shell'); } }   // nouveau jour : les coquillages changent
  if (started) update(dt);
  else { time += dt; const vw = cv.width / dpr; cam.z = Math.max(vw / W, 1.5); cam.x = (W - vw / cam.z) / 2; cam.y = Math.max(0, (H - cv.height / dpr / cam.z) / 2); for (const f of fishes) updateFish(f, dt); for (const s of swans) updateSwan(s, dt); butterflies.forEach((b, i) => updateButterfly(b, dt, i)); }
  render(); requestAnimationFrame(frame);
}

/* ================= démarrage ================= */
let started = false;
const whenLoaded = fn => { if (ready()) return fn(); const iv = setInterval(() => { if (ready()) { clearInterval(iv); fn(); } }, 80); };   // le texte d'intro attend la fin du chargement
function startGame(fresh) {
  audio();
  if (fresh) { wipe(); resetState(); }
  applyLevel();
  QUESTS.forEach(q => { q.chestOpen = 0; q.opening = false; q.reveal = 0; q.found = false; q.rustle = 0; });
  swanAlt = 0; swanSparkle = phase === 'returned' ? .3 : (phase === 'appeared' ? .55 : 0); swanFeathers = phase === 'returned' ? 5 : 0;
  cine = null; player.mount = null; player.alt = 0; player.altT = 0; player.dismounting = false;
  $('#title').style.display = 'none'; $('#win').style.display = 'none'; $('#veil').classList.remove('on');
  started = true; setTool('none'); renderHud();
  const rp = !fresh && introSeen && lastPos ? lastPos : null;
  const sp = rp ? (rp.inside ? [rp.x, rp.y] : nearestWalk(rp.x, rp.y)) : nearestWalk(D.start[0], D.start[1]);
  player.x = sp[0]; player.y = sp[1]; player.state = 'free'; player.face = rp && rp.face ? rp.face : 1; setAnim('idle');
  if (rp && !rp.inside && ['none', 'basket', 'net', 'fish'].includes(rp.tool) && rp.tool !== 'none') setTool(rp.tool);
  if (rp && rp.inside) { const h = HOUSES.find(o => o.id === rp.inside.id); if (h) { HOUSE = h; setScene(h.scene); IN.prevTool = 'none'; IN.on = true; IN.busy = false; IN.climb = null; IN.floor = rp.inside.floor || 0; IN.camY = null; IN.dk = null; IN.x = rp.inside.x; IN.y = rp.inside.y; IN.cool = 2.5; player.dir4 = 'down'; player.x = h.exit[0]; player.y = h.exit[1]; document.body.classList.add('inside'); } }
  const vw = cv.width / dpr, vh = cv.height / dpr, z = camZ(vw, vh); cam.x = clamp(player.x - vw / 2 / z, 0, Math.max(0, W - vw / z)); cam.y = clamp(player.y - vh / 2 / z, 0, Math.max(0, H - vh / z));
  if (!introSeen) { introSeen = true; player.state = 'talk'; save(true);
    { const h = HOUSES[0]; HOUSE = h; setScene(h.scene); IN.prevTool = 'none'; IN.on = true; IN.busy = false; IN.floor = 1; IN.camY = null; IN.dk = null; IN.x = 722; IN.y = 264; IN.cool = 2.5; player.dir4 = 'down'; player.x = h.exit[0]; player.y = h.exit[1]; document.body.classList.add('inside'); } whenLoaded(() => openDialog('La légende de l\'île', ['Il était une fois Gaïkin, le Cygne légendaire, dont les plumes se sont envolées. 🦢', 'Selon la légende, si tu retrouves ses cinq plumes, il reviendra sur l\'île. Aide les habitants à les retrouver !', 'Pour commencer, descends l\'échelle : ta maman Miraaï a besoin de toi !'], () => { player.state = 'free'; }, LP())); }
  else if (phase === 'appeared') say('Le Cygne légendaire t\'attend près de l\'étang !', 4);
}
// ancienne sauvegarde unique -> emplacement 1
try { const old = localStorage.getItem(SAVE_KEY); if (old && !localStorage.getItem(slotKey(1))) { localStorage.setItem(slotKey(1), old); } if (old) localStorage.removeItem(SAVE_KEY); } catch (e) {}
/* ================= noms des lieux (écran d'accueil, bulle de lieu, future carte interactive) ================= */
const PLACES = [   // [id, nom, « où est Myah », x0, y0, x1, y1] en pixels de la carte : le premier qui correspond gagne
  ['boutique', 'La boutique de Kykah', 'À la boutique de Kykah', 396, 322, 505, 372],
  ['cabanon', 'Le cabanon de l\'est', 'Au cabanon de l\'est', 696, 326, 760, 380],
  ['marche', 'Le marché aux coquillages', 'Au marché aux coquillages', 240, 288, 345, 335],
  ['maison', 'La maison de Myah', 'À la maison', 95, 150, 255, 245],
  ['soin', 'Le Poste de Soin', 'Au Poste de Soin', 270, 170, 380, 262],
  ['comptoir', 'Le Comptoir de Maïmaï', 'Au Comptoir de Maïmaï', 340, 100, 460, 205],
  ['musee', 'Le Musée Kaïkiti', 'Au Musée', 565, 60, 690, 135],
  ['obs', 'L\'Observatoire', 'À l\'observatoire', 725, 40, 830, 135],
  ['escalier', 'L\'escalier du Cygne', 'À l\'escalier du Cygne', 640, 135, 790, 330],
  ['pontonport', 'Le ponton du port', 'Au ponton du port', 120, 370, 250, 450],
  ['pontonlac', 'Le ponton du Lac', 'Au ponton du Lac', 320, 175, 600, 310],
  ['falaise', 'Le jardin de la falaise', 'Au jardin de la falaise', 70, 245, 175, 320],
  ['jungle', 'La jungle', 'Dans la jungle', 250, 60, 565, 175],
  ['plage', 'La plage', 'À la plage', 160, 330, 640, 460],
];
const PLC = { id: null, ready: false, tm: 0 };
function placeAt(x, y) {
  for (const p of PLACES) if (x >= p[3] && x <= p[5] && y >= p[4] && y <= p[6]) return p;
  let best = null, bd = 1e9; for (const p of PLACES) { const d = Math.hypot((p[3] + p[5]) / 2 - x, (p[4] + p[6]) / 2 - y); if (d < bd) { bd = d; best = p; } }
  return bd < 130 ? best : null;
}

/* ================= carte interactive de l'île ================= */
const PLACE_INFO = { maison: 'Ta maison, avec la chambre, la salle de bain et le coffre à tenues.', soin: 'Le poste de soin de Lulia : on y soigne les petits bobos.', comptoir: 'Le comptoir de Maïmaï, la cheffe de l\'île.', musee: 'Le musée Kaïkiti, dirigé par Yulia.', obs: 'L\'observatoire de Yurii : longue-vue et ciel étoilé !', boutique: 'Kykah vend des perles, des coquillages et des colliers.', marche: 'Des coquillages et des trésors de la mer.', cabanon: 'Un petit cabanon tranquille à l\'est de l\'île.', escalier: 'Le grand escalier qui monte le long du cou du Cygne.', pontonport: 'Le ponton où dort le bateau de Zyno.', pontonlac: 'Les ponts de bois au-dessus de l\'étang : cygnes et poissons !', falaise: 'Un petit jardin tout en haut de la falaise.', jungle: 'Palmiers, fougères et mille cachettes.', plage: 'Du sable doré pour les coquillages et la pêche.' };
function openMap() {
  const pins = $('#mapPins'); pins.innerHTML = ''; $('#mapInfo').textContent = 'Touche un lieu pour le découvrir';
  const PIN = { escalier: [715, 232], jungle: [400, 105], plage: [400, 405], pontonlac: [470, 205], maison: [172, 195], comptoir: [405, 160], musee: [628, 112], obs: [770, 82], soin: [328, 215], boutique: [450, 350], marche: [292, 312], cabanon: [728, 352], pontonport: [180, 408], falaise: [118, 270] };
  for (const p of PLACES) {
    const c = PIN[p[0]] || [(p[3] + p[5]) / 2, (p[4] + p[6]) / 2], b = document.createElement('button'); b.className = 'mapPin'; b.dataset.n = p[1]; b.setAttribute('aria-label', p[1]); b.style.left = c[0] / 917 * 100 + '%'; b.style.top = c[1] / 512 * 100 + '%';
    b.addEventListener('click', e => { e.stopPropagation(); pins.querySelectorAll('.on').forEach(o => o.classList.remove('on')); b.classList.add('on'); $('#mapInfo').textContent = '📍 ' + p[1] + ' — ' + (PLACE_INFO[p[0]] || ''); blip(700, .08, 'sine', .06); });
    pins.appendChild(b);
  }
  const me = $('#mapMe'); me.style.left = player.x / 917 * 100 + '%'; me.style.top = player.y / 512 * 100 + '%';
  $('#mapView').style.display = 'grid';
}
const closeMap = () => { $('#mapView').style.display = 'none'; };
$('#inv').addEventListener('pointerdown', e => { const b = e.target.closest && e.target.closest('#mapOpen'); if (b) { e.preventDefault(); e.stopPropagation(); audio(); $('#inv').classList.remove('open'); $('#bagB').classList.remove('on'); openMap(); } }); $('#mapX').addEventListener('click', e => { e.stopPropagation(); closeMap(); }); $('#mapView').addEventListener('pointerdown', e => { if (e.target.id === 'mapView') closeMap(); });
addEventListener('keydown', e => { if ($('#mapView').style.display === 'grid' && (e.code === 'Escape' || e.code === 'KeyM')) { closeMap(); e.preventDefault(); } });
let pendingDel = 0, playerName = '';   // prénom ou surnom choisi à la création du profil (enregistré avec la partie)
function slotSummary(sv) {
  const ins = sv.pos && sv.pos.inside, where = ins ? ({ home: 'À la maison', care: 'Au Poste de Soin', hall: 'Au Comptoir de Maïmaï', museum: 'Au Musée', boat: 'Sur le bateau', obs: "À l'observatoire" }[sv.pos.inside.id] || 'Dans une maison') : ((sv.pos && placeAt(sv.pos.x, sv.pos.y) || [])[2] || "Sur l'île");
  let when = ''; if (sv.ts) { const d = new Date(sv.ts); when = d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }) + ' à ' + d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }); }
  return '<span>📍 ' + where + '</span>' + (when ? '<span>🕒 ' + when + '</span>' : '');
}

/* création du profil : après « Nouvelle partie », on peut choisir un prénom ou un surnom (facultatif) */
const esc = t => String(t).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
function openProfile() { const i = $('#pfName'); i.value = ''; $('#profile').style.display = 'grid'; setTimeout(() => { try { i.focus(); } catch (e) {} }, 60); }
function profileGo(skip) {
  const nm = skip ? '' : $('#pfName').value.replace(/\s+/g, ' ').trim().slice(0, 16);
  $('#profile').style.display = 'none'; audio(); startGame(true); playerName = nm; save(true);
}
setTimeout(() => { $('#pfGo').addEventListener('click', () => profileGo(false)); $('#pfSkip').addEventListener('click', () => profileGo(true)); $('#pfBack').addEventListener('click', () => { $('#profile').style.display = 'none'; }); $('#pfName').addEventListener('keydown', e => { if (e.key === 'Enter') profileGo(false); }); }, 0);
function refreshTitle() {
  const box = $('#slots'); box.innerHTML = ''; let free = 0;
  for (let n = 1; n <= NSLOTS; n++) {
    const sv = readSlot(n); if (!sv) { if (!free) free = n; continue; }
    const el = document.createElement('div'); el.className = 'slot';
    el.innerHTML = '<div class="sl-n">' + n + '</div><div class="sl-b"><div class="sl-t">' + (sv.name ? esc(sv.name) + ' · ' : '') + 'Partie ' + n + '</div><div class="sl-i">' + slotSummary(sv) + '</div></div><button class="sl-d" aria-label="Effacer" data-n="' + n + '">🗑</button><div class="sl-go">▶</div>';
    el.addEventListener('click', e => { if (e.target.closest('.sl-d')) return; audio(); slot = n; load(n); startGame(false); });
    box.appendChild(el);
  }
  if (free) {
    const el = document.createElement('div'); el.className = 'slot empty';
    el.innerHTML = '<div class="sl-n">＋</div><div class="sl-b"><div class="sl-t">Nouvelle partie</div></div>';
    el.addEventListener('click', () => { audio(); slot = free; setLevel($('#lvSel').value); openProfile(); });
    box.appendChild(el);
  }
  box.querySelectorAll('.sl-d').forEach(b => b.addEventListener('click', e => { e.stopPropagation(); pendingDel = +b.dataset.n; $('#newTxt').textContent = 'La partie ' + pendingDel + ' sera effacée pour toujours.'; $('#newConf').style.display = 'grid'; }));
}
refreshTitle();
let _autoTried = false; setTimeout(() => autoStart(), 0);
function autoStart() {   // option : on saute l'écran d'accueil et on reprend la dernière partie
  if (_autoTried || !skipTitle || started) return; let n = 0; try { n = +localStorage.getItem(SAVE_KEY + '-active') || 0; } catch (e) {}
  if (!n || !readSlot(n)) return; _autoTried = true; slot = n; load(n); startGame(false);
}
idbAll(all => { let n = 0; try { for (const k in all) if (k.startsWith(SAVE_KEY + '-s') && !localStorage.getItem(k)) { localStorage.setItem(k, all[k]); n++; } } catch (e) {} if (n && !started) refreshTitle(); autoStart(); });   // sauvegardes retrouvées dans la copie de secours
document.querySelectorAll('#levelPick [data-lv]').forEach(b => b.addEventListener('click', () => { audio(); setLevel(b.dataset.lv); $('#levelPick').style.display = 'none'; startGame(true); }));
$('#levelBack').addEventListener('click', () => { $('#levelPick').style.display = 'none'; });
press($('#newYes'), () => { $('#newConf').style.display = 'none'; if (pendingDel) { try { localStorage.removeItem(slotKey(pendingDel)); } catch (e) {} pendingDel = 0; refreshTitle(); } });
press($('#newNo'), () => { $('#newConf').style.display = 'none'; pendingDel = 0; });
press($('#bedYes'), () => { if (bedAsk === 'enter') { $('#bedPick').style.display = 'none'; const h = askHouse; askHouse = null; if (h) enterHouse(h); } else if (bedAsk === 'paint') { $('#bedPick').style.display = 'none'; IN.askP = IN.t + 15; openMiniMenu(); } else if (bedAsk === 'trunk') { $('#bedPick').style.display = 'none'; IN.askK = IN.t + 15; openWardrobe(); } else if (bedAsk === 'cabin') { $('#bedPick').style.display = 'none'; goScene(SC_CABIN, 660, 640); } else if (bedAsk === 'exit') { $('#bedPick').style.display = 'none'; if (SC === SC_CABIN) goScene(SC_BOAT, 790, 520); else leaveHouse(); } else if (bedAsk === 'up' || bedAsk === 'down') { $('#bedPick').style.display = 'none'; climb(IN.floor === 0 ? 1 : 0); } else if (bedAsk === 'bunk') { $('#bedPick').style.display = 'none'; bunkClimb(); } else goToBed(bedAsk); });
document.querySelectorAll('.wdTabs button').forEach(b => b.addEventListener('click', () => wdTab(b.dataset.part)));
{ const w = $('#wdWheel'); let down = false; w.addEventListener('pointerdown', e => { down = true; w.setPointerCapture(e.pointerId); wdPickColor(e); }); w.addEventListener('pointermove', e => { if (down) wdPickColor(e); }); w.addEventListener('pointerup', () => down = false); w.addEventListener('pointercancel', () => down = false); }
$('#wdLum').addEventListener('input', e => { let t = wdTarget(); const l = (+e.target.value) / 100; if (!t) { if (wd.part === 'stickers') return; const d = WD_DEF[wd.part]; t = { h: d.h, s: d.s, l }; if (wd.part === 'bag') wd.o.bagOn = true; } wdSetTarget({ h: t.h, s: t.s, l }); wdDraw(); });
$('#wdOrig').addEventListener('click', () => { wdSetTarget(null); wdDraw(); });
$('#wdBagStkClr').addEventListener('click', () => { wd.o.bagStk = []; wdDraw(); });
$('#wdBagOn').addEventListener('click', () => { wd.o.bagOn = !wd.o.bagOn; wdDraw(); });
$('#wdStkDel').addEventListener('click', () => { if (wd.sel >= 0) { wd.o.stickers.splice(wd.sel, 1); wd.sel = -1; wdDraw(); } });
$('#wdStkClr').addEventListener('click', () => { wd.o.stickers = []; wd.sel = -1; wdDraw(); });
press($('#wdHelpBtn'), () => { $('#wdHelp').style.display = 'grid'; });
press($('#wdHelpOk'), () => { $('#wdHelp').style.display = 'none'; });
$('#wdReset').addEventListener('click', () => { wd.o = outfitEmpty(); wd.sel = -1; wd.lastChange = 0; wdDraw(); });
$('#wdUndo').addEventListener('click', () => { if (!wd.hist.length) return; (wd.redo = wd.redo || []).push(wd.last); wd.o = JSON.parse(wd.hist.pop()); wd.sel = -1; wd.undoing = true; wdDraw(); wd.undoing = false; wd.lastChange = 0; });   // flèche gauche : une étape en arrière
$('#wdRedo').addEventListener('click', () => { if (!wd.redo || !wd.redo.length) return; wd.hist.push(wd.last); wd.o = JSON.parse(wd.redo.pop()); wd.sel = -1; wd.undoing = true; wdDraw(); wd.undoing = false; wd.lastChange = 0; });   // flèche droite : on revient vers le présent
$('#wdOk').addEventListener('click', () => closeWardrobe(true));
$('#wdCancel').addEventListener('click', () => closeWardrobe(false));
$('#wdX').addEventListener('click', () => closeWardrobe(false));
$('#wdV').addEventListener('click', () => closeWardrobe(true));
{ const pv = $('#wdPrev'), at = e => { const r = pv.getBoundingClientRect(), k = 256 / r.width; return [(e.clientX - r.left) * k, (e.clientY - r.top) * k]; };
  const endDrag = () => { wd.drag = null; };
  pv.addEventListener('pointerdown', e => {
    const box = wdBox(); if (!box || wd.part !== 'stickers') return; e.preventDefault(); const [x, y] = at(e), M = 6, reach = e.pointerType === 'mouse' ? 12 : 20; let hit = -1;
    if (wd.sel >= 0 && wd.o.stickers[wd.sel]) {   // une poignée du sticker choisi : on l'étire (la plus proche, avec une zone large au doigt)
      const st = wd.o.stickers[wd.sel], R = wdStkRect(st, box); let best = null, inside = Math.abs(x - R.cx) < R.hw && Math.abs(y - R.cy) < R.hh, bd = inside ? Math.min(reach, (Math.min(R.hw, R.hh) + M) * .6) : reach;   // zone de saisie large hors du sticker ; à l'intérieur, le centre reste pour le déplacer
      for (const [hx, hy] of WD_HANDLES) { const d = Math.hypot(x - (R.cx + hx * (R.hw + M)), y - (R.cy + hy * (R.hh + M))); if (d < bd) { bd = d; best = [hx, hy]; } }
      if (best) {
        wd.drag = { mode: 'size', hx: best[0], hy: best[1], w0: st.w, sy0: st.sy || 1, hw0: R.hw, hh0: R.hh, dx0: Math.max(Math.abs(x - R.cx), 8), dy0: Math.max(Math.abs(y - R.cy), 8) };
        try { pv.setPointerCapture(e.pointerId); } catch (err) {} return;
      }
    }
    for (let i = wd.o.stickers.length - 1; i >= 0; i--) { const R = wdStkRect(wd.o.stickers[i], box); if (Math.abs(x - R.cx) < R.hw + M && Math.abs(y - R.cy) < R.hh + M) { hit = i; break; } }
    wd.sel = hit;
    if (hit >= 0) { const R = wdStkRect(wd.o.stickers[hit], box); wd.drag = { mode: 'move', ox: x - R.cx, oy: y - R.cy }; try { pv.setPointerCapture(e.pointerId); } catch (err) {} } else wd.drag = null;
    wdDraw();
  });
  pv.addEventListener('pointermove', e => {
    if (!wd.drag || wd.sel < 0) return; e.preventDefault(); const box = wdBox(), [x, y] = at(e), bw = box[2] - box[0], st = wd.o.stickers[wd.sel], d = wd.drag;
    if (d.mode === 'size') {   // étirement libre à partir du centre : proportionnel au geste, sans saut au départ
      const R = wdStkRect(st, box);
      if (d.hx) st.w = clamp(d.w0 * Math.abs(x - R.cx) / d.dx0, .08, 1.3);
      const hw = st.w * bw / 2;
      if (d.hy) st.sy = clamp(d.sy0 * d.hw0 / hw * Math.abs(y - R.cy) / d.dy0, .25, 4);
      else if (d.hx) st.sy = clamp(d.sy0 * d.hw0 / hw, .25, 4);   // une poignée de côté ne change que la largeur : la hauteur ne bouge pas
      wdDraw(); return;
    }
    st.u = clamp((x - d.ox - box[0]) / bw, .02, .98); st.v = clamp((y - d.oy - box[1]) / bw, .02, (box[3] - box[1]) / bw); wdDraw();
  });
  pv.addEventListener('pointerup', endDrag); pv.addEventListener('pointercancel', endDrag); pv.addEventListener('lostpointercapture', endDrag);
  pv.addEventListener('wheel', e => {   // molette de la souris : agrandir / réduire le sticker choisi d'un coup
    if (wd.part !== 'stickers' || wd.sel < 0 || !wd.o.stickers[wd.sel]) return; e.preventDefault(); const st = wd.o.stickers[wd.sel], f = e.deltaY < 0 ? 1.08 : 1 / 1.08;
    st.w = clamp(st.w * f, .08, 1.3); wdDraw();
  }, { passive: false }); }

press($('#bedNo'), () => { $('#bedPick').style.display = 'none'; if (bedAsk === 'enter' && askHouse) { askHouse.askUntil = time + 15; askHouse = null; } if (bedAsk === 'exit') IN.askT = IN.t + 15; if (bedAsk === 'cabin') IN.askH = IN.t + 15; if (bedAsk === 'trunk') IN.askK = IN.t + 15; if (bedAsk === 'paint') IN.askP = IN.t + 15; if (bedAsk === 'up' || bedAsk === 'down' || bedAsk === 'bunk') IN.askL = IN.t + 15; /* 15 s de tranquillité près de la porte */ /* « Non » : elle reste en haut de l'échelle, on redescend avec ↓ */ });

/* ---- sauvegarde automatique + sortie ---- */
setInterval(() => { if (started && autoSv && !$('#quit').style.display.includes('grid')) save(); }, 4000);
document.addEventListener('visibilitychange', () => { if (document.hidden && started) save(); });
addEventListener('pagehide', () => { if (started) save(); });
function openQuit() { if (!started) return; save(); $('#quitNoSave').style.display = autoSv ? 'none' : ''; $('#quit').style.display = 'grid'; }
function closeQuit() { $('#quit').style.display = 'none'; }
function saveAndQuit(keep = true) {
  if (keep) save(true); closeQuit();
  started = false; cine = null; dlg.open = false; dlg.after = null; $('#dialog').style.display = 'none';
  $('#win').style.display = 'none'; $('#veil').classList.remove('on');
  IN.on = false; document.body.classList.remove('inside'); player.mount = null; player.alt = 0; player.state = 'free';
  const sp = nearestWalk(D.start[0], D.start[1]); player.x = sp[0]; player.y = sp[1];
  $('#title').style.display = 'grid'; refreshTitle();
}
press($('#quitYes'), () => saveAndQuit(true));
press($('#quitNoSave'), () => saveAndQuit(false));
press($('#quitNo'), closeQuit);
$('#again').addEventListener('click', () => startGame(true));
$('#keep').addEventListener('click', () => { $('#win').style.display = 'none'; });
if ('ontouchstart' in window || navigator.maxTouchPoints > 0) $('#helpKeys').innerHTML = '<b>Glisse le doigt</b> n\'importe où pour marcher (glisse plus loin pour courir) · <b>tape</b> pour agir · <b>🛟</b> en haut à droite si tu es coincée · <b>touche un outil</b> pour le prendre ou le ranger · bouton <b>Cygne</b> : l\'appeler · bouton <b>flèche</b> : voler ou flotter avec lui';

renderHud(); setTool('none');
requestAnimationFrame(t => { lastT = t; frame(t); });

window.__game = {
  paintLoadHung, hangEdOpen, HE, paintGalRender, HANG_SLOTS, openWardrobe, openMap, get outfit() { return outfit; },
  mini, MI, miniAction, miniPropsInit, miniDeliver, coll, PNT, openPaint, nearPaint, isWater, walkable, waterNear, openScope, closeScope, nearScope, SCP,
  setDay(t) { dayT = t; dayAuto = true; }, get dayT() { return dayT; },
  wd, wdStkRect, wdBox, SC_HOME, SEATS, WASH, SHOWER, showerOn, showerOff, TRUNK_SPOT, IN, HOUSE, HOUSES, enterHouse, YUR, IN_FLOORS, IN_EXIT, IN_LADDER, ALLNPC, player, act, inv, qState, opened, QUESTS, EXTRAS, bananas, flowers, butterflies, fishes, swans, fs, D, cam,
  get phase() { return phase; }, myahPose, get outSheet() { return outSheet; }, setOutfit, get mountUnlocked() { return mountUnlocked; }, get cine() { return cine; }, get dlg() { return dlg; },
  doAction, setTool, startGame, talkTo, touchChest, summon, dismount, toggleFlight, update, render, walkable, isWater, nearestWalk, advanceDialog,
  cheat: {
    finishQuest(id) { const q = QUESTS.find(o => o.id === id); qState[q.id] = 'done'; save(); renderHud(); },
    openAll() { QUESTS.forEach(q => { qState[q.id] = 'done'; opened[q.id] = true; q.chestOpen = 1; }); renderHud(); },
    startReveal, startReturn, setPhase(p) { phase = p; if (p === 'appeared') { swanSparkle = .55; } renderHud(); },
    unlockMount() { mountUnlocked = true; phase = 'returned'; swanFeathers = 5; renderHud(); },
  },
};
})();

/* paramètres : onglets Son / Affichage / Partie */
(() => { const tabs = [...document.querySelectorAll('#setTabs .stab')], panes = [...document.querySelectorAll('#settings .setPane')];
  const show = t => { tabs.forEach(b => b.classList.toggle('on', b.dataset.t === t)); panes.forEach(p => p.style.display = p.dataset.t === t ? '' : 'none'); };
  tabs.forEach(b => b.addEventListener('click', () => show(b.dataset.t))); })();



;(() => {   // paillettes autour du cadre doré et sur le cygne de la page d'accueil
  const box = document.getElementById('sparks'), title = document.getElementById('title'); if (!box || !title || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const COL = ['#fff3c4', '#ffe08a', '#ffffff', '#e4d6fa', '#c9a8ff'];
  const spawn = () => {
    if (document.hidden || title.style.display === 'none' || getComputedStyle(title).display === 'none') return;
    const hero = title.querySelector('.hero'), sw = title.querySelector('.hero-swan'); if (!hero || !sw) return;
    const h = hero.getBoundingClientRect(), w = sw.getBoundingClientRect(); let x, y;
    if (Math.random() < .4) { x = w.left + Math.random() * w.width; y = w.top + Math.random() * w.height; }   // reflets sur le cygne
    else { const t = Math.random() * 2 * (h.width + h.height); if (t < h.width) { x = h.left + t; y = h.top; } else if (t < h.width + h.height) { x = h.right; y = h.top + t - h.width; } else if (t < 2 * h.width + h.height) { x = h.right - (t - h.width - h.height); y = h.bottom; } else { x = h.left; y = h.bottom - (t - 2 * h.width - h.height); } x += (Math.random() - .5) * 14; y += (Math.random() - .5) * 14; }
    const e = document.createElement('i'); e.textContent = Math.random() < .7 ? '✦' : '✧'; e.style.left = x + 'px'; e.style.top = y + 'px'; e.style.fontSize = (7 + Math.random() * 9) + 'px'; e.style.color = COL[Math.floor(Math.random() * COL.length)]; e.style.animationDelay = (Math.random() * .3) + 's';
    e.addEventListener('animationend', () => e.remove()); box.appendChild(e);
  };
  setInterval(spawn, 85);
})();
