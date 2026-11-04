/* Art procédural : PNJ (style Myah), papillons réalistes, poissons, cygnes, coffres, plumes, objets. Tout est dessiné par le code. */
(function () {
'use strict';
const TAU = Math.PI * 2;
const rad = d => d * Math.PI / 180;
function rng(seed) { return function () { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function hex(c) { c = c.replace('#', ''); if (c.length === 3) c = c.split('').map(x => x + x).join(''); return [parseInt(c.slice(0, 2), 16), parseInt(c.slice(2, 4), 16), parseInt(c.slice(4, 6), 16)]; }
function shade(c, a) { const [r, g, b] = hex(c); const t = a < 0 ? 0 : 255, p = Math.abs(a); return 'rgb(' + Math.round(r + (t - r) * p) + ',' + Math.round(g + (t - g) * p) + ',' + Math.round(b + (t - b) * p) + ')'; }
function ell(g, x, y, rx, ry, rot) { g.beginPath(); g.ellipse(x, y, rx, ry, rot || 0, 0, TAU); }
function star4(g, x, y, r, fill) { g.fillStyle = fill; g.beginPath(); g.moveTo(x, y - r * 1.7); g.lineTo(x + r * .38, y - r * .38); g.lineTo(x + r * 1.7, y); g.lineTo(x + r * .38, y + r * .38); g.lineTo(x, y + r * 1.7); g.lineTo(x - r * .38, y + r * .38); g.lineTo(x - r * 1.7, y); g.lineTo(x - r * .38, y - r * .38); g.closePath(); g.fill(); }

/* ====================================================== PERSONNES (style Myah) ====================================================== */
function person(g, o, blink) {
  const skin = o.skin, skinD = shade(skin, -0.24), skinL = shade(skin, 0.16);
  const hc = (o.hair && o.hair.color) || '#1f1410', hcL = shade(hc, hc === '#f2f2f4' || hc === '#e9e9ee' ? -0.12 : 0.28);
  const OUT = 'rgba(58,30,18,.55)';
  const k = o.scale || 1, hs = o.headScale || 1, wide = o.wide || 1;
  g.save(); g.lineJoin = 'round'; g.lineCap = 'round';
  g.fillStyle = 'rgba(0,0,0,.22)'; ell(g, 0, 1, 46 * k * wide, 9 * k); g.fill();
  g.scale(k, k);
  const HY = -164, hr = 32 * hs;
  const style = o.hair && o.hair.style;

  // ----- cheveux arrière -----
  g.fillStyle = hc; g.strokeStyle = OUT; g.lineWidth = 1.6;
  const scallop = (cx, cy, R, n, r0) => { for (let i = 0; i < n; i++) { const a = i / n * TAU; ell(g, cx + Math.cos(a) * R, cy + Math.sin(a) * R * .92, r0, r0); g.fill(); } };
  if (style === 'afro') { ell(g, 0, HY - 10, 46 * hs, 44 * hs); g.fill(); scallop(0, HY - 10, 43 * hs, 22, 9 * hs); }
  else if (style === 'bigpuff') { ell(g, 0, HY - 40, 38 * hs, 34 * hs); g.fill(); scallop(0, HY - 40, 35 * hs, 18, 8); ell(g, 0, HY - 6, 38, 34); g.fill(); }
  else if (style === 'twopuffs') { for (const sx of [-1, 1]) { ell(g, sx * 32 * hs, HY - 28 * hs, 21, 21); g.fill(); scallop(sx * 32 * hs, HY - 28 * hs, 19, 10, 6.5); } }
  else if (style === 'locs') {
    g.lineWidth = 1.2;
    for (let i = 0; i < 15; i++) { const x = -36 + i * 5.2, len = 36 + (i % 3) * 8 + Math.abs(i - 7) * -2 + 8; g.fillStyle = i % 2 ? hc : shade(hc, .1); g.beginPath(); g.roundRect(x - 3.2, HY - 6, 6.4, len + 6, 3.2); g.fill(); g.stroke(); }
  } else if (style === 'braids') {
    ell(g, 0, HY - 42, 22, 20); g.fill(); scallop(0, HY - 42, 20, 12, 6);
    // longue natte
    for (let i = 0; i < 9; i++) { const t = i / 8, x = 26 + t * 14 + Math.sin(t * 6) * 3, y = HY - 22 + t * 78; g.fillStyle = i % 2 ? hc : shade(hc, .18); ell(g, x, y, 6.5 - t * 2, 7.2); g.fill(); g.stroke(); }
    g.fillStyle = '#ff6fa5'; ell(g, 33, HY - 20, 4, 4); g.fill();
  } else if (style === 'baldside') { for (const sx of [-1, 1]) { g.fillStyle = hc; ell(g, sx * 31 * hs, HY + 2, 10, 14); g.fill(); g.stroke(); } }

  // ----- jambes / chaussures -----
  const lowerC = o.lowerColor || '#33427a', lower = o.lower || 'pants';
  const shoeC = o.shoes || '#6a4326';
  const legW = 16 * (o.legWide || 1);
  const legTop = -66;
  const legBot = lower === 'shorts' ? -40 : -8;
  for (const sx of [-1, 1]) {
    const lx = sx * 11.5;
    g.fillStyle = skin; g.strokeStyle = OUT; g.lineWidth = 1.5; g.beginPath(); g.roundRect(lx - legW / 2, legTop, legW, -legTop - 6, 7); g.fill(); g.stroke();
    if (lower === 'pants' || lower === 'longpants') { g.fillStyle = lowerC; g.beginPath(); g.roundRect(lx - legW / 2 - 1, legTop - 2, legW + 2, 56, 7); g.fill(); g.stroke(); }
    else if (lower === 'shorts') { g.fillStyle = lowerC; g.beginPath(); g.roundRect(lx - legW / 2 - 2, legTop - 2, legW + 4, 30, 8); g.fill(); g.stroke(); }
    // chaussure
    g.fillStyle = shoeC; g.strokeStyle = OUT; ell(g, lx + sx * 1.5, -5, 11.5, 7); g.fill(); g.stroke();
    if (o.boots) { g.fillStyle = shoeC; g.beginPath(); g.roundRect(lx - 9, -34, 18, 30, 6); g.fill(); g.stroke(); }
  }

  // ----- corps -----
  const topC = o.top || '#e8493d', top2 = o.top2 || shade(topC, -0.18);
  const shoulderY = -122;
  if (lower === 'skirt' || lower === 'longskirt') {
    const bot = lower === 'skirt' ? -34 : -18;
    const sg = g.createLinearGradient(0, -100, 0, bot); sg.addColorStop(0, lowerC); sg.addColorStop(1, shade(lowerC, -0.2));
    g.fillStyle = sg; g.strokeStyle = OUT; g.beginPath(); g.moveTo(-23, -92); g.bezierCurveTo(-30, -70, -46, -50, -50 * wide, bot); g.quadraticCurveTo(0, bot + 12, 50 * wide, bot); g.bezierCurveTo(46, -50, 30, -70, 23, -92); g.closePath(); g.fill(); g.stroke();
    if (o.skirtDots) { g.fillStyle = o.skirtDots; for (let i = 0; i < 14; i++) { const a = (i * 53 % 100) / 100, b2 = (i * 37 % 100) / 100; ell(g, -36 + a * 72, -88 + b2 * 52, 2.4, 2.4); g.fill(); } }
  }
  // torse
  const tg = g.createLinearGradient(-26, shoulderY, 26, -66); tg.addColorStop(0, topC); tg.addColorStop(1, top2);
  g.fillStyle = tg; g.strokeStyle = OUT; g.lineWidth = 1.6;
  const longCoat = o.coat;
  const torsoBot = longCoat ? -34 : (lower === 'skirt' || lower === 'longskirt' ? -88 : -62);
  g.beginPath(); g.moveTo(-22 * wide, torsoBot); g.quadraticCurveTo(-31 * wide, torsoBot - 30, -28, shoulderY + 6); g.quadraticCurveTo(0, shoulderY - 10, 28, shoulderY + 6); g.quadraticCurveTo(31 * wide, torsoBot - 30, 22 * wide, torsoBot); g.closePath(); g.fill(); g.stroke();
  if (longCoat) { g.fillStyle = shade(topC, -.06); g.beginPath(); g.moveTo(-23 * wide, torsoBot); g.lineTo(-30 * wide, -34); g.lineTo(30 * wide, -34); g.lineTo(23 * wide, torsoBot); g.fill(); g.stroke(); g.strokeStyle = 'rgba(0,0,0,.18)'; g.beginPath(); g.moveTo(0, shoulderY + 4); g.lineTo(0, -34); g.stroke(); g.fillStyle = shade(topC, -.3); for (const y of [-108, -92, -76, -60]) { ell(g, 7, y, 2.6, 2.6); g.fill(); } }
  if (o.vest) { g.fillStyle = o.vest; g.strokeStyle = OUT; g.beginPath(); g.moveTo(-22 * wide, -66); g.quadraticCurveTo(-30, -95, -26, shoulderY + 6); g.lineTo(-9, shoulderY + 4); g.lineTo(-7, -66); g.closePath(); g.fill(); g.stroke(); g.beginPath(); g.moveTo(22 * wide, -66); g.quadraticCurveTo(30, -95, 26, shoulderY + 6); g.lineTo(9, shoulderY + 4); g.lineTo(7, -66); g.closePath(); g.fill(); g.stroke(); g.fillStyle = shade(o.vest, -.25); g.fillRect(-20, -86, 12, 11); g.fillRect(8, -86, 12, 11); }
  if (o.apron) { g.fillStyle = o.apron; g.strokeStyle = OUT; g.beginPath(); g.moveTo(-19, -112); g.lineTo(19, -112); g.lineTo(26 * wide, -52); g.quadraticCurveTo(0, -44, -26 * wide, -52); g.closePath(); g.fill(); g.stroke(); g.fillStyle = shade(o.apron, -.12); g.beginPath(); g.roundRect(-11, -80, 22, 14, 3); g.fill(); }
  if (o.suspenders) { g.strokeStyle = o.suspenders; g.lineWidth = 4.5; for (const sx of [-1, 1]) { g.beginPath(); g.moveTo(sx * 13, shoulderY + 4); g.lineTo(sx * 13, -66); g.stroke(); } g.lineWidth = 1.6; }
  if (o.pattern) { g.fillStyle = o.pattern; for (let i = 0; i < 9; i++) { const a = (i * 47 % 100) / 100, b2 = (i * 29 % 100) / 100; ell(g, -20 + a * 40, -116 + b2 * 46, 3.4, 2.4, .6); g.fill(); } }
  if (o.scarf) { g.fillStyle = o.scarf; g.strokeStyle = OUT; g.beginPath(); g.roundRect(-17, shoulderY - 4, 34, 12, 6); g.fill(); g.stroke(); g.beginPath(); g.moveTo(4, shoulderY + 6); g.lineTo(14, shoulderY + 26); g.lineTo(4, shoulderY + 22); g.closePath(); g.fill(); g.stroke(); }
  // cou
  g.fillStyle = skinD; g.strokeStyle = OUT; g.beginPath(); g.roundRect(-8.5, -136, 17, 16, 5); g.fill();
  // sac / bandoulière
  if (o.bag) { g.strokeStyle = o.bag; g.lineWidth = 4; g.beginPath(); g.moveTo(-16, shoulderY + 2); g.lineTo(20, -74); g.stroke(); g.fillStyle = o.bag; g.strokeStyle = OUT; g.lineWidth = 1.5; g.beginPath(); g.roundRect(14, -86, 26, 22, 5); g.fill(); g.stroke(); }

  // ----- bras (et objets tenus) -----
  const arm = (sx, hand, pose) => {
    const sh = [sx * 27, shoulderY + 8], mid = [(sh[0] + hand[0]) / 2 + sx * 3, (sh[1] + hand[1]) / 2];
    g.lineWidth = 11; g.strokeStyle = skin; g.beginPath(); g.moveTo(sh[0], sh[1]); g.quadraticCurveTo(mid[0], mid[1], hand[0], hand[1]); g.stroke();
    // manche
    const sleeve = o.sleeve === 'long' ? .8 : .42;
    g.lineWidth = 14; g.strokeStyle = o.coat ? shade(topC, -.06) : topC; g.beginPath(); g.moveTo(sh[0], sh[1]); g.quadraticCurveTo(sh[0] + (mid[0] - sh[0]) * sleeve, sh[1] + (mid[1] - sh[1]) * sleeve, sh[0] + (hand[0] - sh[0]) * sleeve * .9, sh[1] + (hand[1] - sh[1]) * sleeve * .9); g.stroke();
    g.fillStyle = skin; g.strokeStyle = OUT; g.lineWidth = 1.4; ell(g, hand[0], hand[1], 6.4, 6.4); g.fill(); g.stroke();
  };
  const hL = o.handL || [-33, -72], hR = o.handR || [33, -72];
  // objet derrière la main droite
  if (o.prop === 'rod') {
    g.strokeStyle = '#7a4c24'; g.lineWidth = 3.2; g.beginPath(); g.moveTo(hR[0] - 4, hR[1] + 8); g.lineTo(78, -236); g.stroke();
    g.strokeStyle = 'rgba(255,255,255,.8)'; g.lineWidth = 1.2; g.beginPath(); g.moveTo(78, -236); g.quadraticCurveTo(92, -190, 84, -140); g.stroke();
    // poisson au bout
    g.save(); g.translate(84, -132); g.rotate(1.2); g.fillStyle = '#ff8a2a'; ell(g, 0, 0, 11, 5); g.fill(); g.beginPath(); g.moveTo(-9, 0); g.lineTo(-18, -6); g.lineTo(-18, 6); g.fill(); g.fillStyle = '#222'; ell(g, 6, -1, 1.4, 1.4); g.fill(); g.restore();
  }
  if (o.prop === 'spoon') { g.strokeStyle = '#a8763c'; g.lineWidth = 5; g.beginPath(); g.moveTo(hR[0], hR[1]); g.lineTo(hR[0] + 12, hR[1] - 64); g.stroke(); g.fillStyle = '#c99358'; g.strokeStyle = OUT; g.lineWidth = 1.4; ell(g, hR[0] + 13, hR[1] - 72, 8, 12, .12); g.fill(); g.stroke(); }
  if (o.prop === 'scope') { g.save(); g.translate(hR[0], hR[1]); g.rotate(-.9); g.fillStyle = '#c9902f'; g.strokeStyle = '#6f4b12'; g.lineWidth = 1.4; g.beginPath(); g.roundRect(-4, -46, 12, 52, 3); g.fill(); g.stroke(); g.fillStyle = '#e8b64a'; g.beginPath(); g.roundRect(-6, -58, 16, 16, 3); g.fill(); g.stroke(); g.fillStyle = '#9fd8ff'; ell(g, 2, -60, 5, 2.4); g.fill(); g.restore(); }
  arm(-1, hL); arm(1, hR);
  // objets devant la main
  if (o.prop === 'banana') { g.save(); g.translate(hR[0] + 8, hR[1] - 10); g.rotate(.5); g.strokeStyle = '#a97c10'; g.lineWidth = 10; g.beginPath(); g.arc(0, 0, 16, 3.6, 5.5); g.stroke(); g.strokeStyle = '#ffd93d'; g.lineWidth = 7; g.beginPath(); g.arc(0, 0, 16, 3.6, 5.5); g.stroke(); g.restore(); }
  if (o.prop === 'jar') { g.fillStyle = 'rgba(190,230,255,.55)'; g.strokeStyle = 'rgba(70,120,170,.8)'; g.lineWidth = 1.8; g.beginPath(); g.roundRect(hL[0] - 14, hL[1] - 30, 28, 32, 6); g.fill(); g.stroke(); g.fillStyle = '#8a5a2c'; g.fillRect(hL[0] - 12, hL[1] - 34, 24, 6); g.fillStyle = '#2f7be0'; g.beginPath(); g.ellipse(hL[0] - 4, hL[1] - 16, 6, 8, -.5, 0, TAU); g.ellipse(hL[0] + 5, hL[1] - 16, 6, 8, .5, 0, TAU); g.fill(); g.fillStyle = '#123'; g.fillRect(hL[0] - .8, hL[1] - 22, 1.6, 12); }
  if (o.prop === 'bouquet') { const cs = ['#ff6fa5', '#ffd23d', '#b98cff', '#ff8a5c', '#ffffff']; g.strokeStyle = '#3f9c45'; g.lineWidth = 2.4; for (let i = 0; i < 5; i++) { g.beginPath(); g.moveTo(hR[0], hR[1] + 2); g.lineTo(hR[0] - 12 + i * 6, hR[1] - 32); g.stroke(); } for (let i = 0; i < 5; i++) { const x = hR[0] - 12 + i * 6, y = hR[1] - 34 - (i % 2) * 5; g.fillStyle = cs[i]; for (let j = 0; j < 5; j++) { const a = j * 1.2566; ell(g, x + Math.cos(a) * 4.4, y + Math.sin(a) * 4.4, 3.4, 3.4); g.fill(); } g.fillStyle = '#f6b53a'; ell(g, x, y, 2.4, 2.4); g.fill(); } }
  if (o.prop === 'ball') { g.fillStyle = '#ffd23d'; g.strokeStyle = '#a77a10'; g.lineWidth = 1.6; ell(g, hR[0] + 4, hR[1] - 12, 14, 14); g.fill(); g.stroke(); g.strokeStyle = '#e8493d'; g.lineWidth = 3; g.beginPath(); g.arc(hR[0] + 4, hR[1] - 12, 14, .3, 1.9); g.stroke(); g.beginPath(); g.arc(hR[0] + 4, hR[1] - 12, 14, 3.4, 5); g.stroke(); }
  if (o.prop === 'ukulele') { g.save(); g.translate(-8, -88); g.rotate(-.5); g.fillStyle = '#c8803a'; g.strokeStyle = '#6f4012'; g.lineWidth = 1.6; ell(g, 0, 10, 17, 15); g.fill(); g.stroke(); ell(g, 0, -10, 12, 11); g.fill(); g.stroke(); g.fillStyle = '#3a2210'; ell(g, 0, 4, 5.5, 5.5); g.fill(); g.fillStyle = '#7a4b24'; g.fillRect(-3, -64, 6, 50); g.fillStyle = '#5a3414'; g.fillRect(-5, -72, 10, 10); g.strokeStyle = 'rgba(255,255,255,.8)'; g.lineWidth = .8; for (let i = -1.5; i <= 1.5; i++) { g.beginPath(); g.moveTo(i * 1.7, -64); g.lineTo(i * 1.7, 8); g.stroke(); } g.restore(); arm(1, [-8, -90]); }

  // ----- tête -----
  const hg = g.createRadialGradient(-8, HY - 10, 4, 0, HY, hr + 6); hg.addColorStop(0, skinL); hg.addColorStop(1, skin);
  g.fillStyle = skin; g.strokeStyle = OUT; g.lineWidth = 1.6;
  for (const sx of [-1, 1]) { ell(g, sx * (hr + 1), HY + 3, 6, 8); g.fill(); g.stroke(); g.fillStyle = skinD; ell(g, sx * (hr + 1.5), HY + 3, 2.6, 4); g.fill(); g.fillStyle = skin; }
  g.fillStyle = hg; ell(g, 0, HY, hr, hr * .97); g.fill(); g.stroke();
  // joues
  g.fillStyle = 'rgba(255,110,110,.22)'; ell(g, -20 * hs, HY + 10, 7, 4.6); g.fill(); ell(g, 20 * hs, HY + 10, 7, 4.6); g.fill();

  // ----- barbe (derrière la bouche) -----
  if (o.beard) { g.fillStyle = o.beard; g.strokeStyle = OUT; g.lineWidth = 1.4; g.beginPath(); g.moveTo(-hr + 2, HY + 4); g.bezierCurveTo(-hr, HY + 36, -12, HY + 44, 0, HY + 44); g.bezierCurveTo(12, HY + 44, hr, HY + 36, hr - 2, HY + 4); g.bezierCurveTo(hr - 6, HY + 14, 14, HY + 14, 0, HY + 16); g.bezierCurveTo(-14, HY + 14, -hr + 6, HY + 14, -hr + 2, HY + 4); g.closePath(); g.fill(); g.stroke(); }
  if (o.goatee) { g.fillStyle = o.goatee; g.beginPath(); g.moveTo(-8, HY + 18); g.quadraticCurveTo(0, HY + 36, 8, HY + 18); g.quadraticCurveTo(0, HY + 22, -8, HY + 18); g.fill(); }
  if (o.stubble) { g.fillStyle = 'rgba(30,18,12,.28)'; g.beginPath(); g.moveTo(-hr + 3, HY + 8); g.quadraticCurveTo(0, HY + 46, hr - 3, HY + 8); g.quadraticCurveTo(0, HY + 18, -hr + 3, HY + 8); g.fill(); }

  // ----- visage -----
  const ex = 13 * hs, ey = HY - 2;
  // lunettes derrière les yeux ? (cadre dessiné après)
  if (blink) { g.strokeStyle = '#2a1810'; g.lineWidth = 2.6; for (const sx of [-1, 1]) { g.beginPath(); g.arc(sx * ex, ey + 1, 5.2, .15, Math.PI - .15); g.stroke(); } }
  else {
    for (const sx of [-1, 1]) {
      g.fillStyle = '#fff'; ell(g, sx * ex, ey, 7.2 * (o.bigEyes || 1), 8 * (o.bigEyes || 1)); g.fill();
      g.fillStyle = '#2a1810'; ell(g, sx * ex + 0.6, ey + .8, 5.2 * (o.bigEyes || 1), 6.4 * (o.bigEyes || 1)); g.fill();
      g.fillStyle = '#fff'; ell(g, sx * ex - 1.4, ey - 2, 1.9, 1.9); g.fill(); ell(g, sx * ex + 2, ey + 2.4, 1, 1); g.fill();
      g.strokeStyle = '#2a1810'; g.lineWidth = 2.2; g.beginPath(); g.arc(sx * ex, ey - .2, 7.4, Math.PI + .5, TAU - .5); g.stroke();
    }
  }
  // sourcils
  g.strokeStyle = o.browColor || shade(hc, hc === '#f2f2f4' || hc === '#e9e9ee' ? -.45 : -.2); g.lineWidth = 2.6; for (const sx of [-1, 1]) { g.beginPath(); g.moveTo(sx * (ex + 7), ey - 13); g.quadraticCurveTo(sx * ex, ey - 17, sx * (ex - 7), ey - 13.5); g.stroke(); }
  // nez + bouche
  g.strokeStyle = skinD; g.lineWidth = 2; g.beginPath(); g.moveTo(-3, HY + 8); g.quadraticCurveTo(0, HY + 12, 3.4, HY + 8); g.stroke();
  g.strokeStyle = '#7a2e2e'; g.lineWidth = 2.4; g.beginPath(); g.moveTo(-8, HY + 19); g.quadraticCurveTo(0, HY + (o.smile || 28), 8, HY + 19); g.stroke();
  if (o.stubble || o.beard) { /* bouche légèrement visible */ }
  if (o.wrinkles) { g.strokeStyle = 'rgba(60,30,20,.32)'; g.lineWidth = 1.2; for (const sx of [-1, 1]) { g.beginPath(); g.moveTo(sx * (ex + 9), ey + 2); g.lineTo(sx * (ex + 14), ey - 1); g.moveTo(sx * (ex + 9), ey + 6); g.lineTo(sx * (ex + 14), ey + 8); g.stroke(); } g.beginPath(); g.moveTo(-10, HY - 24); g.quadraticCurveTo(0, HY - 27, 10, HY - 24); g.stroke(); }
  if (o.mustache) { g.fillStyle = o.mustache === true ? (o.beard || hc) : o.mustache; g.strokeStyle = OUT; g.lineWidth = 1.2; g.beginPath(); g.moveTo(0, HY + 13); g.bezierCurveTo(-8, HY + 9, -17, HY + 12, -19, HY + 20); g.bezierCurveTo(-12, HY + 17, -5, HY + 17, 0, HY + 16); g.bezierCurveTo(5, HY + 17, 12, HY + 17, 19, HY + 20); g.bezierCurveTo(17, HY + 12, 8, HY + 9, 0, HY + 13); g.fill(); g.stroke(); }
  if (o.glasses) { g.strokeStyle = o.glasses; g.lineWidth = o.glassSize ? 3.2 : 2.6; const gr = o.glassSize || 11; for (const sx of [-1, 1]) { ell(g, sx * ex, ey, gr, gr); g.stroke(); g.fillStyle = 'rgba(200,235,255,.16)'; g.fill(); } g.beginPath(); g.moveTo(-ex + gr, ey - 1); g.lineTo(ex - gr, ey - 1); g.stroke(); g.beginPath(); g.moveTo(-ex - gr, ey - 1); g.lineTo(-hr, ey - 2); g.moveTo(ex + gr, ey - 1); g.lineTo(hr, ey - 2); g.stroke(); }

  // ----- cheveux avant -----
  g.fillStyle = hc; g.strokeStyle = OUT; g.lineWidth = 1.6;
  const cap = (lift, side) => { g.beginPath(); g.moveTo(-hr - 1, HY - 2); g.bezierCurveTo(-hr - 4, HY - lift, hr + 4, HY - lift, hr + 1, HY - 2); g.quadraticCurveTo(hr - 8 + (side || 0), HY - 17, 0, HY - 19); g.quadraticCurveTo(-hr + 8 - (side || 0), HY - 17, -hr - 1, HY - 2); g.closePath(); g.fill(); g.stroke(); };
  if (style === 'afro') { cap(54 * hs, 0); g.fillStyle = hcL; g.globalAlpha = .35; ell(g, -12, HY - 38, 14, 5, -.4); g.fill(); g.globalAlpha = 1; }
  else if (style === 'bigpuff') { cap(48, 2); g.fillStyle = o.hairband || '#ffd23d'; g.strokeStyle = OUT; g.beginPath(); g.ellipse(0, HY - 30, 30, 7, 0, 0, TAU); g.fill(); g.stroke(); g.fillStyle = hcL; g.globalAlpha = .35; ell(g, -10, HY - 58, 12, 5, -.3); g.fill(); g.globalAlpha = 1; }
  else if (style === 'twopuffs') { cap(46, 0); for (const sx of [-1, 1]) { g.fillStyle = '#ff6fa5'; ell(g, sx * 27, HY - 18, 5, 4); g.fill(); } }
  else if (style === 'braids') { cap(44, 2); g.strokeStyle = shade(hc, .3); g.lineWidth = 1.4; for (let i = -3; i <= 3; i++) { g.beginPath(); g.moveTo(i * 8, HY - 19); g.lineTo(i * 8 + 3, HY - 38); g.stroke(); } }
  else if (style === 'short') { cap(40, 0); if (o.hair.gray) { g.strokeStyle = '#e8e8ee'; g.lineWidth = 3; for (const sx of [-1, 1]) { g.beginPath(); g.moveTo(sx * (hr - 2), HY - 6); g.quadraticCurveTo(sx * (hr - 4), HY - 18, sx * (hr - 12), HY - 26); g.stroke(); } } }
  else if (style === 'locs') { cap(46, 0); for (const sx of [-1, 1]) for (let i = 0; i < 2; i++) { g.fillStyle = hc; g.beginPath(); g.roundRect(sx * (hr - 3 - i * 5) - 3, HY - 12, 6, 30 + i * 8, 3); g.fill(); g.stroke(); } }
  else if (style === 'baldside') { g.fillStyle = skinL; g.globalAlpha = .3; ell(g, -8, HY - 20, 12, 5); g.fill(); g.globalAlpha = 1; }
  if (style === 'afro' && o.hair.gray) { g.strokeStyle = '#ffffff'; g.lineWidth = 3; g.beginPath(); g.moveTo(-22, HY - 28); g.quadraticCurveTo(-8, HY - 44, 6, HY - 36); g.stroke(); }

  // ----- chapeaux et accessoires de tête -----
  if (o.hat === 'straw') { g.fillStyle = '#e6c47a'; g.strokeStyle = '#a9812f'; g.lineWidth = 1.8; g.beginPath(); g.ellipse(0, HY - 22, 56, 13, 0, 0, TAU); g.fill(); g.stroke(); const cg = g.createLinearGradient(0, HY - 60, 0, HY - 22); cg.addColorStop(0, '#f1d58f'); cg.addColorStop(1, '#d8b360'); g.fillStyle = cg; g.beginPath(); g.moveTo(-30, HY - 22); g.bezierCurveTo(-30, HY - 66, 30, HY - 66, 30, HY - 22); g.closePath(); g.fill(); g.stroke(); g.fillStyle = o.hatBand || '#2f8f6e'; g.fillRect(-30, HY - 34, 60, 9); g.strokeStyle = 'rgba(150,110,40,.45)'; g.lineWidth = 1; for (let i = -24; i < 28; i += 8) { g.beginPath(); g.moveTo(i, HY - 56); g.lineTo(i * 1.1, HY - 36); g.stroke(); } }
  if (o.hat === 'cap') { g.fillStyle = o.hatColor || '#2a5fb8'; g.strokeStyle = OUT; g.lineWidth = 1.8; g.beginPath(); g.ellipse(0, HY - 24, 38, 18, 0, Math.PI, TAU); g.fill(); g.stroke(); g.beginPath(); g.moveTo(-36, HY - 24); g.quadraticCurveTo(0, HY - 8, 40, HY - 22); g.quadraticCurveTo(0, HY - 28, -36, HY - 24); g.fill(); g.stroke(); g.fillStyle = shade(o.hatColor || '#2a5fb8', -.25); g.beginPath(); g.ellipse(26, HY - 22, 20, 5, .12, 0, TAU); g.fill(); g.stroke(); }
  if (o.hat === 'chef') { g.fillStyle = '#ffffff'; g.strokeStyle = 'rgba(80,80,100,.55)'; g.lineWidth = 1.8; const by = HY - 26; for (const [x, y, r] of [[-24, by - 40, 20], [24, by - 40, 20], [0, by - 56, 24], [-12, by - 48, 20], [12, by - 48, 20]]) { ell(g, x, y, r, r); g.fill(); g.stroke(); } g.beginPath(); g.roundRect(-30, by - 26, 60, 28, 6); g.fill(); g.stroke(); g.strokeStyle = 'rgba(80,80,100,.25)'; for (const x of [-16, 0, 16]) { g.beginPath(); g.moveTo(x, by - 22); g.lineTo(x, by); g.stroke(); } g.fillStyle = '#d6dbe8'; g.fillRect(-30, by - 4, 60, 4);
    // plume
    g.save(); g.translate(22, by - 12); g.rotate(rad(-24)); const fg = g.createLinearGradient(0, 0, 0, -64); fg.addColorStop(0, '#7d3cc8'); fg.addColorStop(.55, '#c8a6ff'); fg.addColorStop(1, '#ffffff'); g.fillStyle = fg; g.strokeStyle = 'rgba(80,40,140,.6)'; g.lineWidth = 1.2; g.beginPath(); g.moveTo(0, 0); g.bezierCurveTo(-12, -22, -8, -50, 2, -70); g.bezierCurveTo(12, -50, 12, -20, 0, 0); g.fill(); g.stroke(); g.restore(); }
  if (o.flower) { const fx = -24, fy = HY - (style === 'bigpuff' ? 58 : 30); g.fillStyle = o.flower; g.strokeStyle = 'rgba(120,70,0,.5)'; g.lineWidth = 1.2; for (let j = 0; j < 6; j++) { const a = j * 1.047; ell(g, fx + Math.cos(a) * 8, fy + Math.sin(a) * 8, 6, 6); g.fill(); g.stroke(); } g.fillStyle = '#f08a1a'; ell(g, fx, fy, 5, 5); g.fill(); }
  if (o.headphones) { g.strokeStyle = '#2a2f3a'; g.lineWidth = 6; g.beginPath(); g.arc(0, HY - 4, hr + 6, Math.PI * 1.08, Math.PI * 1.92); g.stroke(); for (const sx of [-1, 1]) { g.fillStyle = o.headphones; g.strokeStyle = '#2a2f3a'; g.lineWidth = 2; ell(g, sx * (hr + 6), HY + 2, 9, 12); g.fill(); g.stroke(); } }
  g.restore();
}

const NPC_SPECS = {
  rose:   { name: 'Mamie Rose', skin: '#8a5836', hair: { style: 'afro', color: '#e9e9ee' }, glasses: '#d4a017', top: '#f08fb8', top2: '#e277a4', lower: 'longskirt', lowerColor: '#d96a9a', skirtDots: '#ffd1e4', apron: '#fff2c8', prop: 'banana', scale: .9, headScale: 1.02, wrinkles: true, shoes: '#6a4326', sleeve: 'short', handR: [34, -78], smile: 30 },
  bleu:   { name: 'Papi Bleu', skin: '#4c2e1e', hair: { style: 'baldside', color: '#f2f2f4' }, beard: '#f4f4f6', mustache: true, hat: 'cap', hatColor: '#2a5fb8', top: '#3a74d6', top2: '#2d5fb8', suspenders: '#7a4b24', lower: 'pants', lowerColor: '#c9b27a', prop: 'jar', scale: .93, wrinkles: true, handL: [-36, -78], shoes: '#5a3a22', sleeve: 'long', smile: 30 },
  soleil: { name: 'Miss Soleil', skin: '#946042', hair: { style: 'bigpuff', color: '#1a100c' }, hairband: '#ffd23d', flower: '#ffffff', top: '#ffd23d', top2: '#ffbf1f', lower: 'skirt', lowerColor: '#ffcf3a', skirtDots: '#fff3b0', prop: 'bouquet', scale: 1, shoes: '#c97a2a', sleeve: 'short', handR: [38, -84], smile: 31 },
  toto:   { name: 'Pêcheur Toto', skin: '#573523', hair: { style: 'locs', color: '#1c120d' }, hat: 'straw', hatBand: '#2f8f6e', stubble: true, top: '#f4f0e6', top2: '#e2dccc', vest: '#2fa58a', lower: 'shorts', lowerColor: '#c9b27a', boots: true, shoes: '#2b5a8a', prop: 'rod', scale: 1.04, wide: 1.06, sleeve: 'short', handR: [36, -86], smile: 30 },
  plume:  { name: 'Chef Plume', skin: '#6d4330', hair: { style: 'short', color: '#1b120e' }, hat: 'chef', mustache: '#1b120e', top: '#ffffff', top2: '#e6e9f2', coat: true, scarf: '#e5493a', lower: 'pants', lowerColor: '#3a3a48', shoes: '#2a2a2a', prop: 'spoon', scale: 1.05, wide: 1.14, sleeve: 'long', handR: [40, -92], smile: 31 },
  jo:     { name: 'Ti-Jo', skin: '#9b6844', hair: { style: 'twopuffs', color: '#1f1410' }, top: '#e8493d', top2: '#c93a30', lower: 'shorts', lowerColor: '#2e6fd0', shoes: '#ffffff', prop: 'ball', scale: .72, headScale: 1.2, bigEyes: 1.1, sleeve: 'short', handR: [34, -72], smile: 32, legWide: 1.05 },
  zoe:    { name: 'Zoé', skin: '#7c4e34', hair: { style: 'braids', color: '#1a100c' }, headphones: '#2fb7a8', top: '#2fb7a8', top2: '#239a8d', lower: 'pants', lowerColor: '#33427a', bag: '#e0a53a', shoes: '#fafafa', scale: .95, sleeve: 'short', smile: 30 },
  gaby:   { name: 'Tonton Gaby', skin: '#6b4229', hair: { style: 'short', color: '#1b120e', gray: true }, goatee: '#1b120e', top: '#ff8a3d', top2: '#f0701f', pattern: '#fff0c8', lower: 'shorts', lowerColor: '#e9dcb4', shoes: '#7a4b24', prop: 'ukulele', scale: 1.05, wide: 1.05, sleeve: 'short', smile: 31 },
  astrid: { name: 'Professeur Astrid', skin: '#8b5a3c', hair: { style: 'afro', color: '#2a1a14', gray: true }, glasses: '#d93b4a', glassSize: 12.5, top: '#6a3fa0', top2: '#593388', coat: true, lower: 'pants', lowerColor: '#3a3a48', shoes: '#5a3a22', prop: 'scope', scale: 1, sleeve: 'long', handR: [34, -92], smile: 30 },
};
// la blouse blanche d'Astrid : manteau clair par-dessus
NPC_SPECS.astrid.top = '#f6f7fb'; NPC_SPECS.astrid.top2 = '#dfe3ee'; NPC_SPECS.astrid.scarf = '#6a3fa0';

const NPC_UNIT = 0.256, NPC_PR = 1.6, NPC_CW = 210, NPC_CH = 330, NPC_OX = 105, NPC_OY = 316;
function makeNPC(id) {
  const spec = NPC_SPECS[id];
  const mk = blink => { const c = document.createElement('canvas'); c.width = Math.round(NPC_CW * NPC_PR); c.height = Math.round(NPC_CH * NPC_PR); const g = c.getContext('2d'); g.scale(NPC_PR, NPC_PR); g.translate(NPC_OX, NPC_OY); person(g, spec, blink); return c; };
  const open = mk(false), blink = mk(true);
  // portrait
  const p = document.createElement('canvas'); p.width = p.height = 120; const pg = p.getContext('2d');
  const k = spec.scale || 1, hs = spec.headScale || 1;
  const cy = -168 * k + (spec.hat === 'chef' ? -26 * k : 0), size = (spec.hat === 'chef' ? 150 : 112) * k * Math.max(1, hs * .95);
  const bg = pg.createLinearGradient(0, 0, 0, 120); bg.addColorStop(0, '#ffe9b8'); bg.addColorStop(1, '#ffc98a'); pg.fillStyle = bg; pg.fillRect(0, 0, 120, 120);
  pg.drawImage(open, (NPC_OX - size / 2) * NPC_PR, (NPC_OY + cy - size / 2) * NPC_PR, size * NPC_PR, size * NPC_PR, 0, 0, 120, 120);
  return { id, name: spec.name, open, blink, portrait: p, unit: NPC_UNIT, ox: NPC_OX, oy: NPC_OY, cw: NPC_CW, ch: NPC_CH, spec };
}
function drawNPC(ctx, n, x, y, flip, blinkNow, bob) {
  const u = n.unit, c = blinkNow ? n.blink : n.open;
  ctx.save(); ctx.translate(x, y); if (flip) ctx.scale(-1, 1);
  ctx.drawImage(c, -n.ox * u, -n.oy * u - (bob || 0), n.cw * u, n.ch * u * (1 + (bob || 0) * 0.002));
  ctx.restore();
}

/* ====================================================== PAPILLONS RÉALISTES ====================================================== */
const SPECIES = {
  monarch: { a: '#ff9a1f', b: '#e85d04', edge: '#1b1008', vein: '#1b1008', dots: '#ffffff', hindDark: .0 },
  morpho:  { a: '#3fb4ff', b: '#0a3fbf', edge: '#0b0f24', vein: '#0b1a55', dots: '#bfe6ff', irid: true },
  swallow: { a: '#fff06a', b: '#ffd21f', edge: '#1a1408', vein: '#1a1408', stripes: true, tails: true, blueSpots: '#4aa8ff' },
  cabbage: { a: '#ffffff', b: '#eef1f6', edge: '#8c93a0', vein: '#b6bcc8', spots: '#2a2a33', tip: '#4a4f5b' },
  peacock: { a: '#c2321f', b: '#7a1410', edge: '#2a0d0a', vein: '#3a0f0b', eye: true },
  admiral: { a: '#16182a', b: '#0b0c18', edge: '#05060c', vein: '#2a2d48', bands: '#ffffff', red: '#e83a2a' },
};
function makeWings(name) {
  const sp = SPECIES[name], S = 3, W = 70, H = 96;
  const c = document.createElement('canvas'); c.width = W * S; c.height = H * S; const g = c.getContext('2d'); g.scale(S, S); g.translate(4, 46); g.lineJoin = 'round'; g.lineCap = 'round';
  const fore = () => { g.beginPath(); g.moveTo(1, -3); g.bezierCurveTo(6, -30, 28, -52, 58, -46); g.bezierCurveTo(63, -30, 54, -10, 38, 1); g.bezierCurveTo(24, 4, 8, 3, 1, 0); g.closePath(); };
  const hind = () => { g.beginPath(); g.moveTo(1, 0); g.bezierCurveTo(22, -7, 46, 3, 44, 22); g.bezierCurveTo(42, 38, 24, 44, 13, 35); g.bezierCurveTo(5, 27, 1, 14, 1, 0); g.closePath(); };
  const tail = () => { if (!sp.tails) return; g.beginPath(); g.moveTo(26, 38); g.bezierCurveTo(30, 52, 34, 58, 38, 62); g.bezierCurveTo(36, 50, 38, 42, 40, 36); g.closePath(); g.fillStyle = sp.a; g.fill(); g.strokeStyle = sp.edge; g.lineWidth = 1.4; g.stroke(); };
  const paint = (path, isFore) => {
    g.save(); path(); g.clip();
    const gr = g.createRadialGradient(2, 0, 2, 2, 0, isFore ? 64 : 48); gr.addColorStop(0, sp.b); gr.addColorStop(.55, sp.a); gr.addColorStop(1, sp.a);
    if (sp.irid) { gr.addColorStop(0, '#0a2d9c'); gr.addColorStop(.35, '#1f7bff'); gr.addColorStop(.7, '#5cc8ff'); gr.addColorStop(1, '#9be3ff'); }
    g.fillStyle = gr; g.fillRect(-4, -60, 80, 120);
    // zones sombres à la base (duvet)
    const bs = g.createRadialGradient(0, 0, 0, 0, 0, 16); bs.addColorStop(0, 'rgba(10,6,4,.78)'); bs.addColorStop(1, 'rgba(10,6,4,0)'); g.fillStyle = bs; g.fillRect(-4, -30, 40, 70);
    if (sp.stripes) { g.strokeStyle = sp.edge; g.lineWidth = 3.4; for (const [x0, y0, x1, y1] of isFore ? [[10, -8, 30, -40], [20, -4, 44, -34], [30, -2, 52, -26]] : [[8, 4, 22, 32], [16, 2, 34, 30]]) { g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke(); } }
    if (sp.bands && isFore) { g.fillStyle = sp.bands; g.beginPath(); g.moveTo(34, -44); g.lineTo(52, -42); g.lineTo(48, -30); g.lineTo(34, -34); g.fill(); g.fillStyle = sp.red; g.beginPath(); g.moveTo(8, -12); g.bezierCurveTo(22, -26, 36, -22, 46, -12); g.lineTo(42, -6); g.bezierCurveTo(32, -14, 20, -16, 10, -6); g.fill(); }
    if (sp.bands && !isFore) { g.fillStyle = sp.red; g.beginPath(); g.moveTo(14, 34); g.bezierCurveTo(24, 38, 34, 32, 38, 24); g.lineTo(42, 26); g.bezierCurveTo(36, 40, 22, 46, 12, 40); g.fill(); }
    if (sp.tip && isFore) { g.fillStyle = sp.tip; g.beginPath(); g.moveTo(40, -50); g.lineTo(64, -50); g.lineTo(58, -26); g.bezierCurveTo(52, -34, 46, -40, 40, -50); g.fill(); }
    if (sp.spots) { g.fillStyle = sp.spots; ell(g, isFore ? 36 : 24, isFore ? -18 : 8, 4.2, 3.6); g.fill(); if (isFore) { ell(g, 46, -10, 3.2, 3); g.fill(); } }
    if (sp.eye) { const [ex, ey] = isFore ? [44, -24] : [26, 18]; g.fillStyle = '#f2c14a'; ell(g, ex, ey, 9.5, 9); g.fill(); g.fillStyle = '#10152a'; ell(g, ex, ey, 6.6, 6.2); g.fill(); g.fillStyle = '#3f7be0'; ell(g, ex - .5, ey - .5, 4.2, 3.8); g.fill(); g.fillStyle = '#fff'; ell(g, ex - 2.2, ey - 2.2, 1.6, 1.6); g.fill(); }
    if (sp.blueSpots && !isFore) { g.fillStyle = sp.blueSpots; for (let i = 0; i < 4; i++) { ell(g, 16 + i * 6.5, 30 - Math.abs(i - 1.5) * 3.5, 2.8, 2); g.fill(); } }
    // nervures
    g.strokeStyle = sp.vein; g.globalAlpha = .62; g.lineWidth = 1.1;
    const veins = isFore ? 9 : 7; for (let i = 0; i < veins; i++) { const t = i / (veins - 1), a = isFore ? rad(-95 + t * 78) : rad(-12 + t * 92); g.beginPath(); g.moveTo(2, isFore ? -2 : 0); g.quadraticCurveTo(26 * Math.cos(a) * .9 + 4, 26 * Math.sin(a) * .9 - 2, (isFore ? 62 : 46) * Math.cos(a * .6 + (isFore ? .1 : 0)) + 2, (isFore ? 52 : 40) * Math.sin(a) ); g.stroke(); }
    g.globalAlpha = 1;
    // lueur irisée
    if (sp.irid) { const sh = g.createLinearGradient(8, -40, 46, 0); sh.addColorStop(0, 'rgba(255,255,255,0)'); sh.addColorStop(.5, 'rgba(190,235,255,.45)'); sh.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = sh; g.fillRect(-4, -60, 80, 120); }
    g.restore();
    // bordure
    path(); g.strokeStyle = sp.edge; g.lineWidth = sp.name === 'cabbage' ? 1.6 : 3.2; g.stroke();
    // points blancs sur la bordure
    if (sp.dots) { g.fillStyle = sp.dots; const pts = isFore ? [[50, -43], [57, -36], [58, -26], [54, -16], [46, -6], [36, -1]] : [[42, 12], [43, 24], [38, 34], [30, 40], [20, 40]]; for (const [x, y] of pts) { ell(g, x - 1.2, y + 1.6, 1.7, 1.7); g.fill(); } }
  };
  tail(); paint(hind, false); paint(fore, true);
  return c;
}
const wingCache = {};
function drawButterfly(g, b, time) {
  const sp = b.sp;
  if (!wingCache[sp]) wingCache[sp] = makeWings(sp);
  const wc = wingCache[sp];
  const sc = 0.165 * (b.size || 1);
  const f = 0.2 + 0.8 * Math.abs(Math.cos(b.flap));
  g.save(); g.translate(b.x, b.y - b.z); g.rotate((b.tilt || 0));
  for (const sx of [1, -1]) { g.save(); g.scale(sx * f * sc, sc); g.drawImage(wc, -4, -46, 70, 96); g.restore(); }
  // corps
  g.fillStyle = '#2a1a12'; ell(g, 0, 1.2, 0.95, 5.6); g.fill(); ell(g, 0, -3.4, 1.35, 1.9); g.fill(); ell(g, 0, -6.2, 1.25, 1.3); g.fill();
  g.strokeStyle = '#2a1a12'; g.lineWidth = .55; g.beginPath(); g.moveTo(-.5, -7); g.quadraticCurveTo(-3.4, -10.5, -5, -9.6); g.moveTo(.5, -7); g.quadraticCurveTo(3.4, -10.5, 5, -9.6); g.stroke();
  g.fillStyle = '#2a1a12'; ell(g, -5, -9.6, .6, .6); g.fill(); ell(g, 5, -9.6, .6, .6); g.fill();
  g.restore();
}

/* ====================================================== OBJETS STATIQUES ====================================================== */
function drawBananaBunch(g, x, y) {
  g.save(); g.translate(x, y); g.lineCap = 'round';
  g.fillStyle = 'rgba(0,0,0,.22)'; ell(g, 0, 2, 13, 4); g.fill();
  g.fillStyle = '#3f9c45'; g.strokeStyle = 'rgba(20,70,30,.6)'; g.lineWidth = 1; g.beginPath(); g.ellipse(-8, -2, 9, 3.4, -.5, 0, TAU); g.fill(); g.stroke(); g.beginPath(); g.ellipse(9, -2, 9, 3.4, .5, 0, TAU); g.fill(); g.stroke();
  for (let i = -1; i <= 1; i++) {
    g.save(); g.translate(i * 5.5, -4); g.rotate(i * .22);
    g.strokeStyle = '#6b4a05'; g.lineWidth = 8.4; g.beginPath(); g.arc(0, 0, 11, 3.6, 5.8); g.stroke();
    g.strokeStyle = '#ffd93d'; g.lineWidth = 6; g.beginPath(); g.arc(0, 0, 11, 3.6, 5.8); g.stroke();
    g.strokeStyle = 'rgba(255,255,255,.55)'; g.lineWidth = 1.4; g.beginPath(); g.arc(0, -1, 10, 4.1, 4.9); g.stroke();
    g.fillStyle = '#5a3a10'; g.beginPath(); g.arc(Math.cos(3.6) * 11, Math.sin(3.6) * 11, 1.8, 0, TAU); g.arc(Math.cos(5.8) * 11, Math.sin(5.8) * 11, 1.8, 0, TAU); g.fill();
    g.restore();
  }
  g.fillStyle = '#4a7a2a'; g.fillRect(-2, -15, 4, 6);
  g.restore();
}
const FCOL = { pink: ['#ff8fc0', '#ffe3ef', '#d9558f'], yellow: ['#ffd84a', '#fff4b0', '#d99a10'], purple: ['#a98ae8', '#e8defc', '#6f4fc8'], red: ['#ff5a6e', '#ffc7ce', '#c2283c'] };
function drawFlowerItem(g, x, y, col) {
  const c = FCOL[col] || FCOL.pink;
  g.save(); g.translate(x, y); g.fillStyle = 'rgba(0,0,0,.2)'; ell(g, 0, 2, 8, 2.8); g.fill();
  g.strokeStyle = '#2f8a3e'; g.lineWidth = 2.6; g.lineCap = 'round'; g.beginPath(); g.moveTo(0, 1); g.lineTo(0, -9); g.stroke();
  g.fillStyle = '#4ab04f'; g.beginPath(); g.ellipse(-4.4, -4, 4.4, 1.9, -.6, 0, TAU); g.ellipse(4.4, -5, 4.4, 1.9, .6, 0, TAU); g.fill();
  g.translate(0, -13);
  for (let i = 0; i < 6; i++) { const a = i * 1.047 + .3; g.fillStyle = c[0]; g.strokeStyle = '#fff'; g.lineWidth = 1.5; ell(g, Math.cos(a) * 5.4, Math.sin(a) * 5.4, 4, 4); g.stroke(); g.strokeStyle = c[2]; g.lineWidth = .8; g.stroke(); g.fill(); }
  g.fillStyle = c[1]; ell(g, 0, 0, 3.6, 3.6); g.fill(); g.fillStyle = '#f6b53a'; ell(g, 0, 0, 2, 2); g.fill();
  g.restore();
}

/* ====================================================== POISSONS ====================================================== */
const FISH_COL = [
  { a: '#ff8a2a', b: '#fff2dd', f: '#ff5a10' },   // poisson rouge
  { a: '#ffffff', b: '#ff7a2a', f: '#ff9a4a' },   // koï
  { a: '#2f7be0', b: '#ffd21f', f: '#1d57b0' },   // chirurgien bleu
  { a: '#ff7a1a', b: '#ffffff', f: '#e05a00', band: true },   // poisson-clown
  { a: '#ffd21f', b: '#fff3a0', f: '#e0a800' },   // jaune
  { a: '#b98cff', b: '#ffd0f0', f: '#8a5ce0' },   // violet
];
function drawFish(g, f, time) {
  const c = FISH_COL[f.col % FISH_COL.length], L = 8.5 * (f.size || 1), ang = f.ang || 0;
  const wag = Math.sin(time * 9 + f.ph) * .45;
  g.save(); g.translate(f.x, f.y); const dir = Math.cos(ang) >= 0 ? 1 : -1; g.scale(dir, 1); g.rotate(dir > 0 ? ang : Math.PI - ang);
  g.globalAlpha = f.alpha === undefined ? .95 : f.alpha;
  g.fillStyle = 'rgba(0,30,60,.18)'; ell(g, 1, 4, L, 2.6); g.fill();
  g.fillStyle = c.f; g.beginPath(); g.moveTo(-L * .8, 0); g.lineTo(-L * 1.55, -L * .55 + wag * L * .5); g.lineTo(-L * 1.55, L * .55 + wag * L * .5); g.closePath(); g.fill();
  g.fillStyle = c.f; g.beginPath(); g.moveTo(-L * .2, -L * .32); g.quadraticCurveTo(0, -L * .82, L * .35, -L * .34); g.closePath(); g.fill();
  const bg = g.createLinearGradient(0, -L * .4, 0, L * .4); bg.addColorStop(0, c.a); bg.addColorStop(1, c.b);
  g.fillStyle = bg; ell(g, 0, 0, L, L * .46); g.fill(); g.strokeStyle = 'rgba(40,20,10,.4)'; g.lineWidth = .8; g.stroke();
  if (c.band) { g.fillStyle = '#fff'; g.fillRect(L * .1, -L * .44, L * .26, L * .88); g.fillRect(-L * .5, -L * .42, L * .2, L * .84); }
  g.fillStyle = '#10151f'; ell(g, L * .55, -L * .1, L * .12, L * .12); g.fill(); g.fillStyle = '#fff'; ell(g, L * .58, -L * .14, L * .04, L * .04); g.fill();
  g.restore();
}

/* ====================================================== CYGNES DE L'ÉTANG ====================================================== */
function drawSmallSwan(g, s, time) {
  g.save(); g.translate(s.x, s.y);
  const dir = s.dir >= 0 ? 1 : -1, bob = Math.sin(time * 1.6 + s.ph);
  // sillage
  g.strokeStyle = 'rgba(255,255,255,.55)'; g.lineWidth = 1.2; const w = ((time * .8 + s.ph) % 1);
  g.globalAlpha = .55 * (1 - w); ell(g, -dir * 4, 5, 22 + w * 14, 6 + w * 4); g.stroke(); g.globalAlpha = .4 * (1 - ((w + .5) % 1)); ell(g, -dir * 4, 5, 16 + ((w + .5) % 1) * 14, 4.5 + ((w + .5) % 1) * 4); g.stroke(); g.globalAlpha = 1;
  g.scale(dir * (s.size || 1), (s.size || 1));
  g.fillStyle = 'rgba(0,50,90,.2)'; ell(g, 0, 5, 18, 5); g.fill();
  // queue + corps
  const bg = g.createLinearGradient(0, -14, 0, 4); bg.addColorStop(0, '#ffffff'); bg.addColorStop(1, '#d6dfeb');
  g.fillStyle = bg; g.strokeStyle = 'rgba(110,130,160,.6)'; g.lineWidth = .9; g.beginPath(); g.moveTo(-20, -6); g.quadraticCurveTo(-14, -16, 0, -14); g.quadraticCurveTo(14, -13, 17, -4); g.quadraticCurveTo(10, 5, -2, 5); g.quadraticCurveTo(-14, 5, -20, -6); g.closePath(); g.fill(); g.stroke();
  g.strokeStyle = 'rgba(120,140,170,.55)'; g.lineWidth = .8; g.beginPath(); g.moveTo(-14, -6); g.quadraticCurveTo(-4, -12, 6, -6); g.moveTo(-12, -2); g.quadraticCurveTo(-2, -8, 8, -2); g.stroke();
  // cou
  const nb = bob * 1.2;
  g.strokeStyle = '#ffffff'; g.lineWidth = 5.4; g.beginPath(); g.moveTo(10, -8); g.quadraticCurveTo(21, -14, 15, -24 + nb); g.quadraticCurveTo(13, -28 + nb, 18, -30 + nb); g.stroke();
  g.strokeStyle = 'rgba(110,130,160,.45)'; g.lineWidth = .8; g.beginPath(); g.moveTo(8, -9); g.quadraticCurveTo(18, -14, 12, -24 + nb); g.stroke();
  g.fillStyle = '#fff'; ell(g, 18.5, -30 + nb, 4.2, 3.6); g.fill(); g.strokeStyle = 'rgba(110,130,160,.6)'; g.lineWidth = .8; g.stroke();
  g.fillStyle = '#ff8a2a'; g.beginPath(); g.moveTo(22, -31 + nb); g.lineTo(29, -29.4 + nb); g.lineTo(22, -27.6 + nb); g.closePath(); g.fill();
  g.fillStyle = '#1a1a1a'; g.beginPath(); g.moveTo(22, -31 + nb); g.lineTo(24, -30.6 + nb); g.lineTo(22, -29.5 + nb); g.fill(); ell(g, 19.6, -31 + nb, .8, .8); g.fill();
  g.restore();
}

/* ====================================================== PLUMES, COFFRES ====================================================== */
function drawFeather(g, x, y, len, ang, c1, c2, glow) {
  g.save(); g.translate(x, y); g.rotate(ang);
  if (glow) { const gr = g.createRadialGradient(len * .5, 0, 0, len * .5, 0, len * .9); gr.addColorStop(0, glow); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(-len * .5, -len, len * 2, len * 2); }
  const w = len * .2, gr2 = g.createLinearGradient(0, 0, len, 0); gr2.addColorStop(0, c2 || '#fff'); gr2.addColorStop(1, c1);
  g.fillStyle = gr2; g.strokeStyle = 'rgba(70,40,110,.55)'; g.lineWidth = Math.max(.6, len * .03);
  g.beginPath(); g.moveTo(0, 0); g.bezierCurveTo(len * .2, -w * 1.1, len * .7, -w * .95, len, 0); g.bezierCurveTo(len * .7, w * .7, len * .25, w * .8, 0, 0); g.closePath(); g.fill(); g.stroke();
  g.strokeStyle = 'rgba(255,255,255,.7)'; g.lineWidth = Math.max(.5, len * .022); g.beginPath(); g.moveTo(len * .06, 0); g.quadraticCurveTo(len * .5, -len * .04, len * .96, 0); g.stroke();
  g.strokeStyle = 'rgba(70,40,110,.3)'; g.lineWidth = Math.max(.4, len * .014); for (let i = 1; i < 7; i++) { const t = i / 7; g.beginPath(); g.moveTo(len * t, -len * .02); g.lineTo(len * (t + .08), -w * (.55 - Math.abs(t - .45) * .6)); g.moveTo(len * t, len * .02); g.lineTo(len * (t + .08), w * (.45 - Math.abs(t - .45) * .5)); g.stroke(); }
  g.restore();
}
function drawChest(g, x, y, openT, t, glow) {
  g.save(); g.translate(x, y);
  g.fillStyle = 'rgba(0,0,0,.28)'; ell(g, 0, 2, 20, 5.5); g.fill();
  if (glow) { const k = .5 + .5 * Math.sin(t * 3); const gr = g.createRadialGradient(0, -12, 2, 0, -12, 40 + k * 6); gr.addColorStop(0, 'rgba(255,232,120,' + (.55 + .2 * k) + ')'); gr.addColorStop(1, 'rgba(255,232,120,0)'); g.fillStyle = gr; g.fillRect(-50, -60, 100, 100); }
  const W = 30, H = 17;
  // intérieur lumineux si ouvert
  if (openT > 0) { const rg = g.createLinearGradient(0, -H, 0, -H - 70 * openT); rg.addColorStop(0, 'rgba(255,240,170,.85)'); rg.addColorStop(1, 'rgba(255,240,170,0)'); g.fillStyle = rg; g.beginPath(); g.moveTo(-W / 2 + 3, -H); g.lineTo(-W, -H - 70 * openT); g.lineTo(W, -H - 70 * openT); g.lineTo(W / 2 - 3, -H); g.closePath(); g.fill(); }
  // corps
  const bg = g.createLinearGradient(0, -H, 0, 0); bg.addColorStop(0, '#c07a34'); bg.addColorStop(1, '#8a4f1e');
  g.fillStyle = bg; g.strokeStyle = '#4a2a0c'; g.lineWidth = 1.6; g.beginPath(); g.roundRect(-W / 2, -H, W, H, 3); g.fill(); g.stroke();
  g.strokeStyle = 'rgba(60,30,10,.4)'; g.lineWidth = .8; for (const yy of [-11.5, -6]) { g.beginPath(); g.moveTo(-W / 2, yy); g.lineTo(W / 2, yy); g.stroke(); }
  g.fillStyle = '#e8c24a'; g.strokeStyle = '#7a5a10'; g.lineWidth = 1; for (const xx of [-W / 2 + 2, W / 2 - 6]) { g.beginPath(); g.rect(xx, -H, 4, H); g.fill(); g.stroke(); }
  if (openT < .3) { g.fillStyle = '#f6d15a'; g.beginPath(); g.roundRect(-3.2, -H + 2, 6.4, 7.5, 1.4); g.fill(); g.stroke(); g.fillStyle = '#4a2a0c'; ell(g, 0, -H + 5, 1.1, 1.1); g.fill(); }
  // couvercle
  g.save(); g.translate(0, -H); const rot = -openT * 1.75; g.translate(0, 0); g.rotate(rot * 0.0);
  const lidH = 9;
  if (openT < 0.02) {
    g.fillStyle = '#d28a3c'; g.strokeStyle = '#4a2a0c'; g.lineWidth = 1.6; g.beginPath(); g.moveTo(-W / 2, 0); g.quadraticCurveTo(-W / 2, -lidH - 2, 0, -lidH - 2); g.quadraticCurveTo(W / 2, -lidH - 2, W / 2, 0); g.closePath(); g.fill(); g.stroke();
    g.fillStyle = '#e8c24a'; g.strokeStyle = '#7a5a10'; g.lineWidth = 1; for (const xx of [-W / 2 + 2, W / 2 - 6]) { g.beginPath(); g.rect(xx, -lidH + 1, 4, lidH - 1); g.fill(); g.stroke(); }
  } else {
    // couvercle ouvert (vu de dessus, basculé vers l'arrière)
    const lift = openT * 14;
    g.fillStyle = '#9a5a22'; g.strokeStyle = '#4a2a0c'; g.lineWidth = 1.6; g.beginPath(); g.roundRect(-W / 2, -lidH - lift - 4, W, lidH + 2, 3); g.fill(); g.stroke();
    g.fillStyle = '#e8c24a'; for (const xx of [-W / 2 + 2, W / 2 - 6]) { g.fillRect(xx, -lidH - lift - 3, 4, lidH); }
  }
  g.restore();
  g.restore();
}

/* ====================================================== CYGNE LÉGENDAIRE ====================================================== */
const VIO = '#9a5be8', VIO_D = '#6b2fc4', SIL = '#cfd5ea', WHT = '#ffffff';
function featherShape(g, L, w, curl) {
  g.beginPath(); g.moveTo(0, 0); g.bezierCurveTo(L * .22, -w * .95, L * .72, -w * .85 + (curl || 0), L, (curl || 0) * .5); g.bezierCurveTo(L * .72, w * .6 + (curl || 0) * .4, L * .26, w * .75, 0, 0); g.closePath();
}
function royalFeather(g, L, w, curl, alpha) {
  const gr = g.createLinearGradient(0, 0, L, 0);
  gr.addColorStop(0, VIO_D); gr.addColorStop(.18, VIO); gr.addColorStop(.36, '#b79af0'); gr.addColorStop(.46, SIL); gr.addColorStop(.66, '#e8ebf8'); gr.addColorStop(.78, WHT); gr.addColorStop(1, WHT);
  g.globalAlpha = alpha === undefined ? 1 : alpha;
  g.fillStyle = gr; featherShape(g, L, w, curl); g.fill();
  g.strokeStyle = 'rgba(80,40,150,.5)'; g.lineWidth = 1; g.stroke();
  g.strokeStyle = 'rgba(255,255,255,.55)'; g.lineWidth = .9; g.beginPath(); g.moveTo(L * .08, 0); g.quadraticCurveTo(L * .5, -w * .06 + (curl || 0) * .2, L * .94, (curl || 0) * .45); g.stroke();
  g.globalAlpha = 1;
}
function wingFan(g, th, spread, scale, tone) {
  const N = 13, armDir = th - spread * .5;
  // plumes primaires/secondaires : du bord de fuite au bord d'attaque
  for (let i = 0; i < N; i++) {
    const u = i / (N - 1), a = th + (u - .5) * spread;
    const L = (66 + 44 * Math.sin(Math.PI * (.12 + .78 * u))) * scale, w = 10.5 + 3 * Math.sin(Math.PI * u);
    g.save(); g.translate(Math.cos(armDir + Math.PI * .0) * u * 20 * scale, Math.sin(armDir) * u * 20 * scale); g.rotate(a); royalFeather(g, L, w, (u - .5) * 6, 1); g.restore();
  }
  // petites couvertures argentées/blanches
  for (let i = 0; i < 9; i++) {
    const u = i / 8, a = th + (u - .5) * spread * .9;
    const L = (30 + 16 * Math.sin(Math.PI * (.2 + .6 * u))) * scale, w = 9;
    g.save(); g.translate(Math.cos(armDir) * u * 14 * scale, Math.sin(armDir) * u * 14 * scale); g.rotate(a);
    const gr = g.createLinearGradient(0, 0, L, 0); gr.addColorStop(0, '#a98ae8'); gr.addColorStop(.35, SIL); gr.addColorStop(1, WHT); g.fillStyle = gr; featherShape(g, L, w, 0); g.fill(); g.strokeStyle = 'rgba(80,40,150,.4)'; g.lineWidth = .8; g.stroke(); g.restore();
  }
  if (tone) { g.fillStyle = tone; g.save(); g.globalCompositeOperation = 'source-atop'; g.restore(); }
}
function neckPath(g, w0, w1, P) {
  const bez = (t) => { const mt = 1 - t; return [mt * mt * mt * P[0][0] + 3 * mt * mt * t * P[1][0] + 3 * mt * t * t * P[2][0] + t * t * t * P[3][0], mt * mt * mt * P[0][1] + 3 * mt * mt * t * P[1][1] + 3 * mt * t * t * P[2][1] + t * t * t * P[3][1]]; };
  const L = [], R = [];
  for (let i = 0; i <= 24; i++) { const t = i / 24, p = bez(t), q = bez(Math.min(1, t + .01)), p0 = bez(Math.max(0, t - .01)); let dx = q[0] - p0[0], dy = q[1] - p0[1]; const l = Math.hypot(dx, dy) || 1; dx /= l; dy /= l; const w = (w0 + (w1 - w0) * t) / 2; L.push([p[0] - dy * w, p[1] + dx * w]); R.push([p[0] + dy * w, p[1] - dx * w]); }
  g.beginPath(); g.moveTo(L[0][0], L[0][1]); for (const p of L) g.lineTo(p[0], p[1]); for (let i = R.length - 1; i >= 0; i--) g.lineTo(R[i][0], R[i][1]); g.closePath();
}
function mixc(c, to, a) { const p = hex(c), q = hex(to); return 'rgb(' + Math.round(p[0] + (q[0] - p[0]) * a) + ',' + Math.round(p[1] + (q[1] - p[1]) * a) + ',' + Math.round(p[2] + (q[2] - p[2]) * a) + ')'; }
const WING_STOPS = [[0, '#ffffff'], [.26, '#f3f5fc'], [.5, '#cdd3ea'], [.74, '#b99cf2'], [1, '#8a3fe0']];
const COVER_STOPS = [[0, '#ffffff'], [.6, '#f6f7fd'], [1, '#d6dbef']];
// plume du Cygne : blanc à la base, argent au milieu, violet au bout
function lfeather(g, L, w, curl, dim, stops) {
  const gr = g.createLinearGradient(0, 0, L, 0);
  (stops || WING_STOPS).forEach(([o, c]) => gr.addColorStop(o, dim ? mixc(c, '#59608f', dim) : c));
  g.fillStyle = gr; featherShape(g, L, w, curl); g.fill();
  g.strokeStyle = 'rgba(86,50,160,.55)'; g.lineWidth = 1; g.stroke();
  g.strokeStyle = 'rgba(255,255,255,.55)'; g.lineWidth = .9; g.beginPath(); g.moveTo(L * .06, 0); g.quadraticCurveTo(L * .5, -w * .05 + (curl || 0) * .2, L * .94, (curl || 0) * .45); g.stroke();
}
function bigWing(g, sx, sy, axis, spread, len, k, dim) {
  g.save(); g.translate(sx, sy); g.scale(1, k);
  const N = 14;
  for (let i = N - 1; i >= 0; i--) {
    const u = i / (N - 1), a = axis + u * spread, L = len * (1 - .46 * Math.pow(u, 1.15));
    g.save(); g.rotate(a); lfeather(g, L, 11.5 + 3.5 * (1 - u), (u - .5) * -7, dim); g.restore();
  }
  for (let row = 0; row < 2; row++) for (let i = 8; i >= 0; i--) {
    const u = i / 8, a = axis + u * spread * .97, L = len * (.5 - row * .13) * (1 - .28 * u);
    g.save(); g.rotate(a); lfeather(g, L, 10 - row * 1.4, 0, dim, COVER_STOPS); g.restore();
  }
  g.fillStyle = dim ? mixc('#f4f5fc', '#59608f', dim) : '#f4f5fc'; g.strokeStyle = 'rgba(86,50,160,.5)'; g.lineWidth = 1; ell(g, 0, 0, 10, 8); g.fill(); g.stroke();
  g.restore();
}
function swanNeck(g, P, r0, r1, col, grow, dx) {
  g.fillStyle = col;
  for (let i = 0; i <= 44; i++) {
    const t = i / 44, mt = 1 - t;
    const x = mt * mt * mt * P[0][0] + 3 * mt * mt * t * P[1][0] + 3 * mt * t * t * P[2][0] + t * t * t * P[3][0];
    const y = mt * mt * mt * P[0][1] + 3 * mt * mt * t * P[1][1] + 3 * mt * t * t * P[2][1] + t * t * t * P[3][1];
    const r = r0 + (r1 - r0) * Math.pow(t, .7) + (grow || 0);
    g.beginPath(); g.arc(x + (dx ? -dx * r : 0), y, dx ? r * .5 : r, 0, TAU); g.fill();
  }
}
function drawLegend(g, o) {
  const s = o.s || .6, t = o.t || 0, dir = o.dir >= 0 ? 1 : -1;
  const flying = o.mode === 'fly', ph = o.phase === undefined ? t * 6 : o.phase;
  const alt = o.alt || 0;
  g.save(); g.translate(o.x, o.y);
  // ombre ou ondulations
  if (flying || alt > 2) { g.fillStyle = 'rgba(0,0,0,' + (.26 * Math.max(.25, 1 - alt / 220)) + ')'; ell(g, 0, 4, 52 * s * (1 - Math.min(.5, alt / 400)), 11 * s); g.fill(); }
  else {
    const w = (t * .7) % 1;
    g.strokeStyle = 'rgba(255,255,255,.65)'; g.lineWidth = 1.4; for (let i = 0; i < 3; i++) { const k = (w + i / 3) % 1; g.globalAlpha = .6 * (1 - k); ell(g, 0, 2, (46 + k * 40) * s, (11 + k * 9) * s); g.stroke(); } g.globalAlpha = 1;
    g.fillStyle = 'rgba(120,70,200,.18)'; ell(g, 0, 3, 54 * s, 12 * s); g.fill();
  }
  // halo
  const pulse = .5 + .5 * Math.sin(t * 2.4);
  const hg = g.createRadialGradient(0, -alt - 70 * s, 4, 0, -alt - 70 * s, 170 * s);
  const ha = .18 + .16 * pulse + (o.sparkle || 0) * .3;
  hg.addColorStop(0, 'rgba(225,200,255,' + ha + ')'); hg.addColorStop(.5, 'rgba(170,120,255,' + ha * .4 + ')'); hg.addColorStop(1, 'rgba(170,120,255,0)');
  g.fillStyle = hg; g.fillRect(-190 * s, -alt - 260 * s, 380 * s, 360 * s);
  const bodyBob = flying ? Math.sin(ph) * 3 : Math.sin(t * 1.6) * 1.4;
  g.save(); g.translate(0, -alt); g.scale(dir * s, s); g.translate(0, bodyBob);
  const cf = Math.cos(ph);
  const kNear = flying ? .225 + .775 * cf : 1 + Math.sin(t * 1.3) * .015;
  const kFar = flying ? .225 + .775 * Math.cos(ph - .55) : 1 + Math.sin(t * 1.3 + .6) * .015;
  const axis = rad(flying ? -96 : -100), spread = rad(-52);
  // aile lointaine (plus sombre)
  bigWing(g, -14, -55, axis + rad(7), spread, 104, kFar, .3);
  // plumes de queue
  g.save(); g.translate(-50, -32);
  for (let i = 0; i < 5; i++) { g.save(); g.rotate(rad(-182 + i * 10) + Math.sin(t * 2 + i) * .02); lfeather(g, 54 - Math.abs(i - 2) * 6, 8.5, 0); g.restore(); }
  g.restore();
  const nb = Math.sin(t * 1.3) * 2;
  const P = [[34, -36], [84, -52], [22, -98 + nb * .5], [57, -127 + nb]];
  swanNeck(g, P, 12.8, 6.6, 'rgba(96,70,170,.9)', 1.5);
  // corps
  const bg = g.createLinearGradient(0, -56, 0, 0); bg.addColorStop(0, '#ffffff'); bg.addColorStop(.7, '#e9ecf8'); bg.addColorStop(1, '#cbbff0');
  g.fillStyle = bg; g.strokeStyle = 'rgba(96,70,170,.9)'; g.lineWidth = 1.6; g.beginPath(); g.moveTo(-60, -40); g.bezierCurveTo(-48, -30, -36, -2, -4, -2); g.bezierCurveTo(26, 0, 56, -8, 58, -30); g.bezierCurveTo(60, -54, 30, -60, 6, -54); g.bezierCurveTo(-22, -48, -48, -54, -60, -40); g.closePath(); g.fill(); g.stroke();
  g.strokeStyle = 'rgba(150,130,210,.5)'; g.lineWidth = 1; g.beginPath(); g.moveTo(-36, -22); g.quadraticCurveTo(-4, -10, 30, -20); g.moveTo(-40, -33); g.quadraticCurveTo(-8, -21, 32, -33); g.moveTo(-26, -12); g.quadraticCurveTo(0, -4, 24, -10); g.stroke();
  // cou par-dessus le corps : jonction invisible
  swanNeck(g, P, 12.8, 6.6, '#ffffff', 0);
  swanNeck(g, P, 12.8, 6.6, 'rgba(205,196,240,.6)', 0, .42);
  // tête
  const hx = 62, hy = -133 + nb;
  g.fillStyle = '#ffffff'; g.strokeStyle = 'rgba(96,70,170,.9)'; g.lineWidth = 1.4; ell(g, hx, hy, 12.5, 11.2); g.fill(); g.stroke();
  // bec violet
  const bgd = g.createLinearGradient(0, hy - 8, 0, hy + 6); bgd.addColorStop(0, '#b583ff'); bgd.addColorStop(1, VIO_D);
  g.fillStyle = bgd; g.strokeStyle = '#4b1f94'; g.lineWidth = 1.3; g.beginPath(); g.moveTo(hx + 8, hy - 7); g.quadraticCurveTo(hx + 28, hy - 6, hx + 41, hy + 3); g.quadraticCurveTo(hx + 28, hy + 8, hx + 8, hy + 6); g.closePath(); g.fill(); g.stroke();
  g.strokeStyle = 'rgba(60,20,120,.7)'; g.lineWidth = 1; g.beginPath(); g.moveTo(hx + 10, hy + 0); g.quadraticCurveTo(hx + 28, hy + 1, hx + 39, hy + 3); g.stroke();
  g.fillStyle = '#4b1f94'; ell(g, hx + 15, hy - 3, 1.5, 1); g.fill();
  g.fillStyle = 'rgba(255,255,255,.45)'; ell(g, hx + 20, hy - 5, 8, 1.4, .1); g.fill();
  // œil
  g.fillStyle = '#2a1252'; ell(g, hx + 3, hy - 3, 3.4, 3.8); g.fill(); g.fillStyle = '#ffffff'; ell(g, hx + 2, hy - 4.4, 1.2, 1.2); g.fill(); g.strokeStyle = '#6b2fc4'; g.lineWidth = 1.2; g.beginPath(); g.arc(hx + 3, hy - 3, 5, Math.PI * 1.1, Math.PI * 1.9); g.stroke();
  // crête majestueuse (façon chocobo) : gerbe de longues plumes balayées vers l'arrière
  const cr = [[-96, 40], [-110, 52], [-124, 62], [-138, 66], [-152, 62], [-166, 54], [-178, 44]];
  g.save(); g.translate(hx - 3, hy - 9);
  cr.forEach(([deg, L], i) => { g.save(); g.rotate(rad(deg) + Math.sin(t * 2.6 + i * .8) * .07 - (flying ? .16 : 0)); lfeather(g, L, 8.6, -4 - i * .8); g.restore(); });
  g.restore();
  g.fillStyle = '#d9c2ff'; g.strokeStyle = '#6b2fc4'; g.lineWidth = 1; g.beginPath(); g.moveTo(hx - 2, hy - 13); g.lineTo(hx + 2, hy - 9); g.lineTo(hx - 2, hy - 5); g.lineTo(hx - 6, hy - 9); g.closePath(); g.fill(); g.stroke();
  // grande aile proche
  bigWing(g, -6, -53, axis, spread, 118, kNear, 0);
  // cavalière
  if (o.rider) {
    g.save(); g.translate(6, -50); o.rider(g); g.restore();
    g.fillStyle = '#ffffff'; g.strokeStyle = 'rgba(96,70,170,.6)'; g.lineWidth = 1;
    for (let i = 0; i < 4; i++) { ell(g, -6 + i * 8, -48 + (i % 2) * 2, 9, 5.5, -.1 + i * .06); g.fill(); g.stroke(); }
  }
  g.restore();
  // plumes rendues : couronne orbitale
  const nf = o.feathers || 0, cols = ['#ff7eb6', '#4aa3ff', '#ffd23d', '#3ed6b0', '#b980ff'];
  for (let j = 0; j < nf; j++) { const a = t * .9 + j * TAU / 5; drawFeather(g, Math.cos(a) * 82 * s, -alt - 66 * s + Math.sin(a) * 26 * s, 26 * s, a + Math.PI / 2, cols[j], '#fff', 'rgba(255,255,255,.35)'); }
  // scintillements
  const spk = o.sparkle || 0, n = Math.round(9 + 30 * spk);
  for (let i = 0; i < n; i++) {
    const a = i * 2.399 + t * .35, rr = (40 + (i * 37 % 120)) * s * (1 + .12 * Math.sin(t + i)), x = Math.cos(a) * rr * 1.25, y = -alt - 66 * s + Math.sin(a) * rr * .8;
    const tw = Math.max(0, Math.sin(t * 3.2 + i * 1.7)); if (tw < .15) continue;
    star4(g, x, y, (1.4 + 3 * tw) * (s + .4), ['rgba(255,255,255,', 'rgba(210,170,255,', 'rgba(255,240,180,', 'rgba(200,215,255,'][i % 4] + (.35 + .65 * tw) + ')');
  }
  g.restore();
}
function legendPortrait() {
  const c = document.createElement('canvas'); c.width = c.height = 120; const g = c.getContext('2d');
  const bg = g.createRadialGradient(60, 60, 5, 60, 60, 90); bg.addColorStop(0, '#f3e6ff'); bg.addColorStop(1, '#8d62d8'); g.fillStyle = bg; g.fillRect(0, 0, 120, 120);
  g.save(); g.translate(-11, 245); drawLegend(g, { x: 0, y: 0, s: 1.15, t: 1.4, dir: 1, mode: 'perch', sparkle: .3 }); g.restore();
  return c;
}

window.ART = { NPC_SPECS, makeNPC, drawNPC, drawButterfly, SPECIES: Object.keys(SPECIES), drawBananaBunch, drawFlowerItem, drawFish, drawSmallSwan, drawFeather, drawChest, drawLegend, legendPortrait, star4, rng, shade, person };
})();
