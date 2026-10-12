// Visuals: every texture is painted with the canvas 2D API at RES x resolution, so the game looks smooth instead of blocky.
const RES = 1.5;   // texture / render resolution multiplier (use 2 for extra sharpness on high-DPI screens, 1 for weak devices)

const PED_SHIRTS = ['#e1873b', '#6ab04c', '#eb4d4b', '#2b4a9e', '#f2f4f5'];   // 3 = police uniform, 4 = paramedic

function rr(ctx, x, y, w, h, r) { // rounded rectangle path
  ctx.beginPath(); ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}
function shade(c, amt) { // lighten (amt > 0) or darken (amt < 0) a '#rrggbb' colour
  const n = hex(c), t = amt < 0 ? 0 : 255, p = Math.abs(amt);
  const f = v => Math.round(v + (t - v) * p);
  return `rgb(${f(n >> 16 & 255)},${f(n >> 8 & 255)},${f(n & 255)})`;
}
function ell(ctx, x, y, rx, ry) { ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); }
function mulberry32(a) { return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

/* ---------- cars (36 x 20 canvas, body 32 x 16, nose points to +x) ---------- */
function paintCar(ctx, color) {
  ctx.translate(2, 2);
  ctx.fillStyle = 'rgba(0,0,0,0.30)'; ell(ctx, 16, 8.6, 17, 10); ctx.fill();                       // soft shadow
  ctx.fillStyle = '#14161a';                                                                          // wheels
  [[5.5, -1], [5.5, 14], [22.5, -1], [22.5, 14]].forEach(([x, y]) => { rr(ctx, x, y, 7, 3, 1.3); ctx.fill(); });
  const body = ctx.createLinearGradient(0, 0, 0, 16);                                                 // painted body with volume
  body.addColorStop(0, shade(color, 0.32)); body.addColorStop(0.45, color); body.addColorStop(1, shade(color, -0.35));
  ctx.fillStyle = body; ctx.beginPath();
  ctx.moveTo(4, 1); ctx.lineTo(24, 1); ctx.quadraticCurveTo(31.5, 1.2, 32, 5.5); ctx.lineTo(32, 10.5);
  ctx.quadraticCurveTo(31.5, 14.8, 24, 15); ctx.lineTo(4, 15); ctx.quadraticCurveTo(0, 14.6, 0, 11); ctx.lineTo(0, 5);
  ctx.quadraticCurveTo(0, 1.4, 4, 1); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.38)'; ctx.lineWidth = 0.6; ctx.stroke();
  const glass = ctx.createLinearGradient(8, 0, 26, 0);                                                // windscreen, side glass, rear window
  glass.addColorStop(0, '#1b2733'); glass.addColorStop(0.55, '#3e5468'); glass.addColorStop(1, '#8fb0c8');
  ctx.fillStyle = glass; ctx.beginPath(); ctx.moveTo(8.5, 2.6); ctx.lineTo(21, 2.2); ctx.lineTo(25.5, 4.2); ctx.lineTo(25.5, 11.8);
  ctx.lineTo(21, 13.8); ctx.lineTo(8.5, 13.4); ctx.quadraticCurveTo(7.4, 8, 8.5, 2.6); ctx.closePath(); ctx.fill();
  const roof = ctx.createLinearGradient(0, 3, 0, 13);                                                 // roof
  roof.addColorStop(0, shade(color, 0.38)); roof.addColorStop(1, shade(color, -0.12));
  ctx.fillStyle = roof; rr(ctx, 11.5, 3.6, 8.5, 8.8, 2); ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 0.5; ctx.beginPath(); ctx.moveTo(26.5, 3); ctx.lineTo(30, 3.6); ctx.stroke();   // hood highlight
  ctx.fillStyle = shade(color, -0.2); rr(ctx, 21, -0.6, 3, 1.8, 0.8); ctx.fill(); rr(ctx, 21, 14.8, 3, 1.8, 0.8); ctx.fill();               // mirrors
  [[3.4], [12.6]].forEach(([y]) => {                                                                   // headlights with glow
    const g = ctx.createRadialGradient(31, y, 0, 31, y, 4); g.addColorStop(0, 'rgba(255,248,200,0.9)'); g.addColorStop(1, 'rgba(255,248,200,0)');
    ctx.fillStyle = g; ctx.fillRect(26, y - 4, 10, 8); ctx.fillStyle = '#fffbe6'; ell(ctx, 30.6, y, 1.6, 1.3); ctx.fill();
  });
  ctx.fillStyle = '#e02a2a'; rr(ctx, 0.2, 2.4, 1.8, 3, 0.7); ctx.fill(); rr(ctx, 0.2, 10.6, 1.8, 3, 0.7); ctx.fill();                 // tail lights
}

/* ---------- people (top view, facing +x) ---------- */
function paintPed(ctx, shirt, step, size = 14, opts = {}) { // opts.gun = holds a pistol, opts.cap = police cap, opts.medic = paramedic
  ctx.translate(size / 2, size / 2); ctx.scale(size / 14, size / 14);
  ctx.fillStyle = 'rgba(0,0,0,0.26)'; ell(ctx, 0.4, 0.5, 4.6, 5.6); ctx.fill();
  const f = step ? 2.1 : -2.1;
  ctx.fillStyle = '#23262b'; ell(ctx, f, -2.2, 1.9, 1.1); ctx.fill(); ell(ctx, -f, 2.2, 1.9, 1.1); ctx.fill();            // shoes (alternate = walking)
  ctx.fillStyle = shade(shirt, -0.25); ell(ctx, -f * 0.6, -4.3, 1.7, 1); ctx.fill();                                         // arms
  if (opts.gun) { rr(ctx, 0.2, 3.3, 4.2, 1.7, 0.8); ctx.fill(); ctx.fillStyle = '#16181c'; rr(ctx, 3.2, 3, 3.6, 1.9, 0.5); ctx.fill(); }
  else { ell(ctx, f * 0.6, 4.3, 1.7, 1); ctx.fill(); }
  const g = ctx.createLinearGradient(0, -5, 0, 5); g.addColorStop(0, shade(shirt, 0.25)); g.addColorStop(1, shade(shirt, -0.25));
  ctx.fillStyle = g; ell(ctx, -0.3, 0, 3.4, 5.1); ctx.fill();                                                               // shoulders
  ctx.fillStyle = '#efc7a0'; ctx.beginPath(); ctx.arc(0.7, 0, 2.3, 0, Math.PI * 2); ctx.fill();                            // head
  if (opts.medic) { ctx.fillStyle = '#d63031'; ctx.fillRect(-2.6, -0.6, 3.6, 1.2); ctx.fillRect(-1.4, -1.8, 1.2, 3.6); }   // red cross on the back
  if (opts.cap) {                                                                                                           // police cap with a peak
    ctx.fillStyle = '#16254d'; ctx.beginPath(); ctx.arc(0.5, 0, 2.5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#0b1230'; rr(ctx, 2.2, -1.6, 1.8, 3.2, 0.7); ctx.fill();
    ctx.fillStyle = '#f2c230'; ctx.beginPath(); ctx.arc(0.3, 0, 0.7, 0, 6.28); ctx.fill();
  } else { ctx.fillStyle = '#35261c'; ctx.beginPath(); ctx.arc(0.5, 0, 2.4, Math.PI * 0.5, Math.PI * 1.5); ctx.fill(); }  // hair
}
function paintCopCar(ctx, phase) { // phase: -1 = lights off, 0 = red lit, 1 = blue lit
  paintCar(ctx, '#f3f5f7');                                          // (leaves the context translated by 2, 2)
  ctx.fillStyle = '#18222e'; rr(ctx, 7.5, 0.7, 14, 2.4, 0.8); ctx.fill(); rr(ctx, 7.5, 12.9, 14, 2.4, 0.8); ctx.fill();   // dark door stripes
  ctx.fillStyle = '#2a2f36'; rr(ctx, 12.4, 3, 5.2, 10, 1.2); ctx.fill();                                                  // light bar
  ctx.fillStyle = phase === 0 ? '#ff3b3b' : '#6b1c1c'; rr(ctx, 12.9, 3.5, 4.2, 4.4, 1); ctx.fill();
  ctx.fillStyle = phase === 1 ? '#3d8bff' : '#1b2f57'; rr(ctx, 12.9, 8.1, 4.2, 4.4, 1); ctx.fill();
  [[0, 5.7, 'rgba(255,60,60,'], [1, 10.3, 'rgba(70,140,255,']].forEach(([k, y, col]) => {                                 // glow of the lit lamp
    if (phase !== k) return;
    const gr = ctx.createRadialGradient(15, y, 0, 15, y, 9); gr.addColorStop(0, col + '0.8)'); gr.addColorStop(1, col + '0)');
    ctx.fillStyle = gr; ctx.fillRect(3, y - 9, 24, 18);
  });
}
function paintDead(ctx) { // 26 x 18
  ctx.translate(13, 9);
  const b = ctx.createRadialGradient(0, 0, 1, 0, 0, 11); b.addColorStop(0, 'rgba(120,0,0,0.85)'); b.addColorStop(1, 'rgba(140,10,10,0)');
  ctx.fillStyle = b; ell(ctx, 0, 0, 12, 8.5); ctx.fill();
  ctx.fillStyle = '#4b5563'; rr(ctx, -2.5, 0.8, 7, 2.4, 1); ctx.fill(); rr(ctx, -2.5, -3.2, 7, 2.4, 1); ctx.fill();            // legs
  ctx.fillStyle = '#7f8fa6'; ell(ctx, -4.5, 0, 3, 5); ctx.fill();                                                           // torso
  ctx.fillStyle = '#efc7a0'; ctx.beginPath(); ctx.arc(-8.6, 0, 2.5, 0, Math.PI * 2); ctx.fill();                           // head
}
function paintBlood(ctx) { // 28 x 28
  const g = ctx.createRadialGradient(14, 14, 1, 14, 14, 14);
  g.addColorStop(0, 'rgba(120,0,0,0.95)'); g.addColorStop(0.65, 'rgba(150,10,10,0.75)'); g.addColorStop(1, 'rgba(150,10,10,0)');
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(14, 14, 14, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = 'rgba(120,0,0,0.8)';
  for (let i = 0; i < 7; i++) { const a = Math.random() * 6.28, r = 6 + Math.random() * 7; ctx.beginPath(); ctx.arc(14 + Math.cos(a) * r, 14 + Math.sin(a) * r, 0.8 + Math.random() * 1.4, 0, 6.28); ctx.fill(); }
}

/* ---------- world (painted in chunks; ctx is already translated so that world coordinates can be used directly) ---------- */
function paintTree(ctx, t) {
  ctx.fillStyle = 'rgba(0,0,0,0.28)'; ell(ctx, t.x + 3, t.y + 4, 9, 7); ctx.fill();
  [[0, 0, 8], [-4.5, 2, 5.2], [4.5, 2.5, 5.2], [0, -4.5, 5]].forEach(([dx, dy, r]) => {
    const g = ctx.createRadialGradient(t.x + dx - r * 0.3, t.y + dy - r * 0.35, r * 0.1, t.x + dx, t.y + dy, r);
    g.addColorStop(0, '#6fd786'); g.addColorStop(0.6, '#3aa35a'); g.addColorStop(1, '#1f6e3d');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(t.x + dx, t.y + dy, r, 0, Math.PI * 2); ctx.fill();
  });
  ctx.fillStyle = 'rgba(255,255,255,0.16)'; ell(ctx, t.x - 2.5, t.y - 3.5, 3, 1.8); ctx.fill();
}
function paintBuilding(ctx, b) {
  const F = 20, rh = b.h - F, x = b.x, y = b.y, w = b.w, cx = x + w / 2;
  ctx.save(); ctx.shadowColor = 'rgba(0,0,0,0.42)'; ctx.shadowBlur = 12 * RES; ctx.shadowOffsetX = 7 * RES; ctx.shadowOffsetY = 9 * RES;
  ctx.fillStyle = '#222'; rr(ctx, x, y, w, b.h, 3); ctx.fill(); ctx.restore();
  // roof
  const rg = ctx.createLinearGradient(x, y, x + w, y + rh); rg.addColorStop(0, shade(b.color, 0.25)); rg.addColorStop(1, shade(b.color, -0.2));
  ctx.fillStyle = rg; rr(ctx, x, y, w, rh + 4, 3); ctx.fill();
  ctx.save(); rr(ctx, x, y, w, rh + 4, 3); ctx.clip();
  if (b.t === 0) { // house: pitched roof (two slopes), tile lines and a chimney
    ctx.fillStyle = 'rgba(255,255,255,0.13)'; ctx.fillRect(x, y, w, rh / 2); ctx.fillStyle = 'rgba(0,0,0,0.16)'; ctx.fillRect(x, y + rh / 2, w, rh / 2 + 4);
    ctx.strokeStyle = 'rgba(0,0,0,0.13)'; ctx.lineWidth = 0.7; ctx.beginPath();
    for (let ty = y + 5; ty < y + rh + 4; ty += 6) { ctx.moveTo(x, ty); ctx.lineTo(x + w, ty); } ctx.stroke();
    ctx.strokeStyle = 'rgba(0,0,0,0.4)'; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.moveTo(x, y + rh / 2); ctx.lineTo(x + w, y + rh / 2); ctx.stroke();
    const p = b.props[0]; ctx.fillStyle = '#6d4c41'; rr(ctx, x + p.u * w, y + p.v * rh * 0.7, 8, 8, 1); ctx.fill(); ctx.fillStyle = '#2b1d17'; ctx.fillRect(x + p.u * w + 2, y + p.v * rh * 0.7 + 2, 4, 4);
  } else if (b.t === 1) { // shop: flat roof with air-conditioning units
    b.props.forEach(p => {
      const ax = x + p.u * (w - 16), ay = y + 6 + p.v * (rh - 24);
      ctx.fillStyle = 'rgba(0,0,0,0.25)'; rr(ctx, ax + 2, ay + 2, 14, 10, 2); ctx.fill();
      ctx.fillStyle = '#d5dde1'; rr(ctx, ax, ay, 14, 10, 2); ctx.fill();
      ctx.fillStyle = '#7b8a93'; ctx.beginPath(); ctx.arc(ax + 7, ay + 5, 3.4, 0, 6.28); ctx.fill(); ctx.fillStyle = '#4a555c'; ctx.beginPath(); ctx.arc(ax + 7, ay + 5, 1.2, 0, 6.28); ctx.fill();
    });
  } else { // office: glass roof grid and a machinery block
    ctx.strokeStyle = 'rgba(255,255,255,0.14)'; ctx.lineWidth = 0.7; ctx.beginPath();
    for (let gx = x + 12; gx < x + w; gx += 12) { ctx.moveTo(gx, y); ctx.lineTo(gx, y + rh); }
    for (let gy = y + 12; gy < y + rh; gy += 12) { ctx.moveTo(x, gy); ctx.lineTo(x + w, gy); } ctx.stroke();
    const mx = x + w * 0.3, my = y + rh * 0.3;
    ctx.fillStyle = 'rgba(0,0,0,0.3)'; rr(ctx, mx + 3, my + 4, w * 0.4, rh * 0.35, 3); ctx.fill();
    ctx.fillStyle = '#9fb0b8'; rr(ctx, mx, my, w * 0.4, rh * 0.35, 3); ctx.fill(); ctx.strokeStyle = 'rgba(0,0,0,0.3)'; ctx.lineWidth = 0.8; ctx.stroke();
  }
  ctx.restore();
  ctx.strokeStyle = 'rgba(255,255,255,0.28)'; ctx.lineWidth = 1.2; rr(ctx, x + 2.5, y + 2.5, w - 5, rh - 4, 2); ctx.stroke();     // parapet
  // front wall (facade) with windows and a door
  const fg = ctx.createLinearGradient(0, y + rh, 0, y + b.h); fg.addColorStop(0, shade(b.color, -0.32)); fg.addColorStop(1, shade(b.color, -0.6));
  ctx.fillStyle = fg; rr(ctx, x, y + rh - 3, w, F + 3, 3); ctx.fill();
  ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fillRect(x + 1, y + rh, w - 2, 1.6);                                                    // roof edge shadow
  const n = b.lit.length, step = (w - 12) / n;
  if (b.t === 1) { // awning, sign and shop window
    for (let sx = 0; sx < w; sx += 9) { ctx.fillStyle = (sx / 9) % 2 ? '#f4f4f4' : shade(b.color, 0.1); ctx.fillRect(x + sx, y + rh + 1, Math.min(9, w - sx), 7); }
    ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.fillRect(x, y + rh + 8, w, 1.4);
    ctx.fillStyle = '#1f2a36'; rr(ctx, cx - 14, y + rh + 1.6, 28, 6, 1.5); ctx.fill();
    ctx.fillStyle = '#ffe28a'; ctx.font = 'bold 5.4px Arial, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('SHOP', cx, y + rh + 4.9);
    const sg = ctx.createLinearGradient(x, 0, x + w, 0); sg.addColorStop(0, '#9fdcea'); sg.addColorStop(1, '#5fa8c0');
    ctx.fillStyle = sg; rr(ctx, x + 6, y + rh + 10, w / 2 - 12, 8, 1); ctx.fill(); rr(ctx, cx + 6, y + rh + 10, w / 2 - 12, 8, 1); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.4)'; ctx.fillRect(x + 8, y + rh + 11, 6, 1.2);
    ctx.fillStyle = '#d9f3f8'; rr(ctx, cx - 4.5, y + b.h - 12, 9, 12, 1); ctx.fill(); ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = 0.7; ctx.stroke();
  } else {
    for (let i = 0; i < n; i++) {
      const wx = x + 6 + (i + 0.5) * step - 4.5; if (Math.abs(wx + 4.5 - cx) < 9) continue;
      const wg = ctx.createLinearGradient(0, y + rh + 4, 0, y + rh + 12);
      if (b.lit[i]) { wg.addColorStop(0, '#fff3b8'); wg.addColorStop(1, '#f0b85a'); } else { wg.addColorStop(0, '#506a82'); wg.addColorStop(1, '#1f2f3f'); }
      ctx.fillStyle = wg; rr(ctx, wx, y + rh + 4, 9, 8, 1); ctx.fill(); ctx.strokeStyle = 'rgba(0,0,0,0.55)'; ctx.lineWidth = 0.8; ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.25)'; ctx.fillRect(wx + 1, y + rh + 5, 3, 1.2);
    }
    const dg = ctx.createLinearGradient(0, y + b.h - 13, 0, y + b.h); dg.addColorStop(0, '#6b4630'); dg.addColorStop(1, '#3d2616');
    ctx.fillStyle = dg; rr(ctx, cx - 5, y + b.h - 13, 10, 13, 1.5); ctx.fill(); ctx.fillStyle = '#e9c46a'; ctx.beginPath(); ctx.arc(cx + 2.8, y + b.h - 6, 0.8, 0, 6.28); ctx.fill();
  }
  ctx.strokeStyle = 'rgba(0,0,0,0.55)'; ctx.lineWidth = 1.3; rr(ctx, x, y, w, b.h, 3); ctx.stroke();                              // outline
}

function paintWorld(ctx, vx, vy, vw, vh) {
  const W = WORLD.w, H = WORLD.h, vis = (x, y, w, h) => x < vx + vw && x + w > vx && y < vy + vh && y + h > vy;
  const rnd = mulberry32(((vx + 5000) * 73856093) ^ ((vy + 5000) * 19349663));
  // ground (concrete) and the park (grass) outside the street grid
  ctx.fillStyle = '#8b9598'; ctx.fillRect(vx, vy, vw, vh);
  ctx.fillStyle = '#5f9253'; ctx.fillRect(2090, 0, W - 2090, H); ctx.fillRect(0, 2090, W, H - 2090);
  for (let i = 0; i < 700; i++) {
    const x = vx + rnd() * vw, y = vy + rnd() * vh, grass = x > 2090 || y > 2090;
    ctx.fillStyle = grass ? (rnd() > 0.5 ? 'rgba(120,180,95,0.35)' : 'rgba(40,90,40,0.28)') : (rnd() > 0.5 ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.07)');
    ctx.beginPath(); ctx.arc(x, y, 0.8 + rnd() * 1.6, 0, 6.28); ctx.fill();
  }
  // sidewalks with tile joints
  ctx.fillStyle = '#cdd2d5';
  roadsX.forEach(x => ctx.fillRect(x - 10, 0, ROAD_W + 20, H)); roadsY.forEach(y => ctx.fillRect(0, y - 10, W, ROAD_W + 20));
  ctx.strokeStyle = 'rgba(70,80,90,0.17)'; ctx.lineWidth = 0.6; ctx.beginPath();
  const y0 = Math.floor(vy / 10) * 10, y1 = vy + vh, x0 = Math.floor(vx / 10) * 10, x1 = vx + vw;
  roadsX.forEach(x => { if (x - 10 > x1 || x + 90 < vx) return; for (let y = y0; y <= y1; y += 10) { ctx.moveTo(x - 10, y); ctx.lineTo(x + 12, y); ctx.moveTo(x + 68, y); ctx.lineTo(x + 90, y); } ctx.moveTo(x + 1, vy); ctx.lineTo(x + 1, y1); ctx.moveTo(x + 79, vy); ctx.lineTo(x + 79, y1); });
  roadsY.forEach(y => { if (y - 10 > y1 || y + 90 < vy) return; for (let x = x0; x <= x1; x += 10) { ctx.moveTo(x, y - 10); ctx.lineTo(x, y + 12); ctx.moveTo(x, y + 68); ctx.lineTo(x, y + 90); } ctx.moveTo(vx, y + 1); ctx.lineTo(x1, y + 1); ctx.moveTo(vx, y + 79); ctx.lineTo(x1, y + 79); });
  ctx.stroke();
  // curbs, then asphalt (asphalt of the crossing road covers the curb inside intersections)
  ctx.fillStyle = '#9aa2a6';
  roadsX.forEach(x => ctx.fillRect(x + 10, 0, ROAD_W - 20, H)); roadsY.forEach(y => ctx.fillRect(0, y + 10, W, ROAD_W - 20));
  ctx.fillStyle = '#3b4048';
  roadsX.forEach(x => ctx.fillRect(x + 12, 0, ROAD_W - 24, H)); roadsY.forEach(y => ctx.fillRect(0, y + 12, W, ROAD_W - 24));
  ctx.save(); ctx.beginPath(); roadsX.forEach(x => ctx.rect(x + 12, 0, ROAD_W - 24, H)); roadsY.forEach(y => ctx.rect(0, y + 12, W, ROAD_W - 24)); ctx.clip();
  for (let i = 0; i < 3500; i++) { ctx.fillStyle = rnd() > 0.45 ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.14)'; const s = 0.5 + rnd() * 1.1; ctx.fillRect(vx + rnd() * vw, vy + rnd() * vh, s, s); }
  ctx.restore();
  // lane markings: edge lines and a double yellow centre line, only on the straight parts between intersections
  const gaps = roads => { const out = []; let prev = -100; roads.forEach(r => { out.push([prev, r - 8]); prev = r + 96; }); out.push([prev, W + 100]); return out; };
  const gy = gaps(roadsY), gx = gaps(roadsX);
  ctx.lineWidth = 1.2; ctx.strokeStyle = 'rgba(255,255,255,0.72)'; ctx.beginPath();
  roadsX.forEach(x => gy.forEach(([a, b]) => { ctx.moveTo(x + 16, a); ctx.lineTo(x + 16, b); ctx.moveTo(x + 64, a); ctx.lineTo(x + 64, b); }));
  roadsY.forEach(y => gx.forEach(([a, b]) => { ctx.moveTo(a, y + 16); ctx.lineTo(b, y + 16); ctx.moveTo(a, y + 64); ctx.lineTo(b, y + 64); }));
  ctx.stroke();
  ctx.lineWidth = 1.1; ctx.strokeStyle = '#f2c230'; ctx.beginPath();
  roadsX.forEach(x => gy.forEach(([a, b]) => { ctx.moveTo(x + 38.8, a); ctx.lineTo(x + 38.8, b); ctx.moveTo(x + 41.2, a); ctx.lineTo(x + 41.2, b); }));
  roadsY.forEach(y => gx.forEach(([a, b]) => { ctx.moveTo(a, y + 38.8); ctx.lineTo(b, y + 38.8); ctx.moveTo(a, y + 41.2); ctx.lineTo(b, y + 41.2); }));
  ctx.stroke();
  // zebra crossings and stop lines
  ctx.fillStyle = 'rgba(245,245,245,0.93)';
  roadsX.forEach(rx => roadsY.forEach(ry => {
    if (!vis(rx - 10, ry - 10, 120, 120)) return;
    for (let k = 0; k < 5; k++) {
      const a = 15 + k * 11;
      ctx.fillRect(rx + a, ry + 1, 6, 8); ctx.fillRect(rx + a, ry + ROAD_W + 1, 6, 8);
      ctx.fillRect(rx + 1, ry + a, 8, 6); ctx.fillRect(rx + ROAD_W + 1, ry + a, 8, 6);
    }
    for (let d = 0; d < 4; d++) {
      const ls = laneShift(d);
      if (d === 1) ctx.fillRect(rx + 40 + ls.x - 13, ry - 5, 26, 3);
      else if (d === 3) ctx.fillRect(rx + 40 + ls.x - 13, ry + ROAD_W + 11, 26, 3);
      else if (d === 0) ctx.fillRect(rx - 5, ry + 40 + ls.y - 13, 3, 26);
      else ctx.fillRect(rx + ROAD_W + 11, ry + 40 + ls.y - 13, 3, 26);
    }
  }));
  const L = PARKING_LOT;   // car park: asphalt, kerb, painted bays and a big P
  if (L.w && vis(L.x - 6, L.y - 6, L.w + 12, L.h + 12)) {
    ctx.fillStyle = '#9aa2a6'; rr(ctx, L.x - 3, L.y - 3, L.w + 6, L.h + 6, 7); ctx.fill();
    ctx.fillStyle = '#464c54'; rr(ctx, L.x, L.y, L.w, L.h, 5); ctx.fill();
    ctx.save(); rr(ctx, L.x, L.y, L.w, L.h, 5); ctx.clip();
    for (let i = 0; i < 1800; i++) { ctx.fillStyle = rnd() > 0.45 ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.14)'; const s = 0.5 + rnd() * 1.1; ctx.fillRect(L.x + rnd() * L.w, L.y + rnd() * L.h, s, s); }
    ctx.restore();
    const step = L.w / LOT_BAYS; ctx.strokeStyle = 'rgba(255,255,255,0.85)'; ctx.lineWidth = 1.4; ctx.beginPath();
    for (let k = 0; k <= LOT_BAYS; k++) { ctx.moveTo(L.x + k * step, L.y); ctx.lineTo(L.x + k * step, L.y + 44); ctx.moveTo(L.x + k * step, L.y + L.h); ctx.lineTo(L.x + k * step, L.y + L.h - 44); }
    ctx.moveTo(L.x, L.y + 44); ctx.lineTo(L.x + L.w, L.y + 44); ctx.moveTo(L.x, L.y + L.h - 44); ctx.lineTo(L.x + L.w, L.y + L.h - 44); ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.4)'; ctx.font = 'bold 70px Arial, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('P', L.x + L.w / 2, L.y + L.h / 2);
  }
  buildings.forEach(b => { if (vis(b.x - 20, b.y - 20, b.w + 50, b.h + 50)) paintBuilding(ctx, b); });
  trees.forEach(t => { if (vis(t.x - 14, t.y - 14, 32, 32)) paintTree(ctx, t); });
  ctx.strokeStyle = '#c0392b'; ctx.lineWidth = 8; ctx.strokeRect(0, 0, W, H);                                                  // world border
}
