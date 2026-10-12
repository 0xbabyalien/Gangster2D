// Vehicle types: size and driving characteristics (data) + the painters that draw every type (loaded after visuals.js)
//   len / wid = body size in world units, max = top speed, acc = acceleration factor, turn = steering factor,
//   cruise = [min, max] speed of NPC drivers, weight = how common the type is in traffic
const CAR_TYPES = {
  sedan:     { name: 'SEDAN',      len: 32, wid: 16, max: 3.2, acc: 1.00, turn: 1.00, cruise: [0.9, 1.3],  weight: 26 },
  hatch:     { name: 'HATCHBACK',  len: 28, wid: 15, max: 3.0, acc: 1.05, turn: 1.15, cruise: [0.9, 1.3],  weight: 20 },
  suv:       { name: 'SUV',        len: 34, wid: 18, max: 3.0, acc: 0.90, turn: 0.90, cruise: [0.9, 1.2],  weight: 14 },
  pickup:    { name: 'PICKUP',     len: 38, wid: 17, max: 2.8, acc: 0.85, turn: 0.85, cruise: [0.85, 1.15], weight: 10 },
  van:       { name: 'VAN',        len: 38, wid: 17, max: 2.6, acc: 0.75, turn: 0.80, cruise: [0.8, 1.1],  weight: 8 },
  taxi:      { name: 'TAXI',       len: 32, wid: 16, max: 3.2, acc: 1.00, turn: 1.00, cruise: [1.0, 1.4],  weight: 8 },
  sports:    { name: 'SPORTS CAR', len: 33, wid: 16, max: 4.2, acc: 1.35, turn: 1.10, cruise: [1.1, 1.5],  weight: 5 },
  bus:       { name: 'BUS',        len: 52, wid: 19, max: 2.0, acc: 0.50, turn: 0.55, cruise: [0.7, 0.9],  weight: 4 },
  truck:     { name: 'TRUCK',      len: 44, wid: 19, max: 2.2, acc: 0.55, turn: 0.60, cruise: [0.75, 1.0], weight: 4 },
  police:    { name: 'POLICE CAR', len: 32, wid: 16, max: 3.4, acc: 1.10, turn: 1.00 },
  ambulance: { name: 'AMBULANCE',  len: 38, wid: 17, max: 3.0, acc: 0.95, turn: 0.95 }
};
const TAXI_YELLOW = '#f6c90e';
const BUS_COLORS = ['#d63031', '#0984e3', '#00a86b'], TRUCK_COLORS = ['#ecf0f1', '#fdcb6e', '#b2bec3'];

function rrr(ctx, x, y, w, h, tl, tr, br, bl) { // rounded rectangle with a different radius per corner
  ctx.beginPath(); ctx.moveTo(x + tl, y);
  ctx.arcTo(x + w, y, x + w, y + h, tr); ctx.arcTo(x + w, y + h, x, y + h, br);
  ctx.arcTo(x, y + h, x, y, bl); ctx.arcTo(x, y, x + w, y, tl); ctx.closePath();
}
function vBase(ctx, L, W, axles, ww = 6.5) { // shadow + wheels (the context is translated by 2, 2: the body spans 0..L x 0..W)
  ctx.translate(2, 2);
  ctx.fillStyle = 'rgba(0,0,0,0.30)'; ell(ctx, L / 2, W / 2 + 0.6, L / 2 + 1, W / 2 + 2); ctx.fill();
  ctx.fillStyle = '#14161a';
  axles.forEach(x => { rr(ctx, x - ww / 2, -1.2, ww, 3.2, 1.3); ctx.fill(); rr(ctx, x - ww / 2, W - 2, ww, 3.2, 1.3); ctx.fill(); });
}
function vBody(ctx, L, W, color, front, rear) { // painted body with volume (gradient across the width)
  const g = ctx.createLinearGradient(0, 0, 0, W);
  g.addColorStop(0, shade(color, 0.32)); g.addColorStop(0.45, color); g.addColorStop(1, shade(color, -0.35));
  ctx.fillStyle = g; rrr(ctx, 0, 0.8, L, W - 1.6, rear, front, front, rear); ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.38)'; ctx.lineWidth = 0.6; ctx.stroke();
}
function vGlass(ctx, x0, x1, y0, y1, r = 1.6) { // dark glass panel
  const g = ctx.createLinearGradient(x0, 0, x1, 0); g.addColorStop(0, '#1b2733'); g.addColorStop(0.55, '#3e5468'); g.addColorStop(1, '#8fb0c8');
  ctx.fillStyle = g; rr(ctx, x0, y0, x1 - x0, y1 - y0, r); ctx.fill();
}
function vRoof(ctx, color, x0, x1, y0, y1, r = 2) { // roof panel (lighter than the body)
  const g = ctx.createLinearGradient(0, y0, 0, y1); g.addColorStop(0, shade(color, 0.38)); g.addColorStop(1, shade(color, -0.12));
  ctx.fillStyle = g; rr(ctx, x0, y0, x1 - x0, y1 - y0, r); ctx.fill();
}
function vLights(ctx, L, W, tail = true) { // headlights with glow, tail lights
  [3.4, W - 3.4].forEach(y => {
    const g = ctx.createRadialGradient(L - 1.2, y, 0, L - 1.2, y, 4); g.addColorStop(0, 'rgba(255,248,200,0.9)'); g.addColorStop(1, 'rgba(255,248,200,0)');
    ctx.fillStyle = g; ctx.fillRect(L - 6, y - 4, 10, 8); ctx.fillStyle = '#fffbe6'; ell(ctx, L - 1.4, y, 1.6, 1.3); ctx.fill();
  });
  if (tail) { ctx.fillStyle = '#e02a2a'; rr(ctx, 0.2, 2.4, 1.8, 3, 0.7); ctx.fill(); rr(ctx, 0.2, W - 5.4, 1.8, 3, 0.7); ctx.fill(); }
}

function paintVehicle(ctx, type, color, phase = -1) {
  const T = CAR_TYPES[type], L = T.len, W = T.wid;
  if (type === 'sedan') return paintCar(ctx, color);
  if (type === 'taxi') {
    paintCar(ctx, TAXI_YELLOW);                                                  // a yellow sedan with a roof sign and a checker stripe
    ctx.fillStyle = '#18222e'; rr(ctx, 7.5, 0.7, 14, 1.6, 0.6); ctx.fill(); rr(ctx, 7.5, 13.7, 14, 1.6, 0.6); ctx.fill();
    ctx.fillStyle = '#fffbe6'; rr(ctx, 13, 5, 5.4, 6, 1); ctx.fill(); ctx.strokeStyle = 'rgba(0,0,0,0.6)'; ctx.lineWidth = 0.6; ctx.stroke();
    ctx.fillStyle = '#18222e'; ctx.fillRect(14.2, 7.6, 3, 0.8);
    return;
  }
  if (type === 'hatch') {
    vBase(ctx, L, W, [6, 21]); vBody(ctx, L, W, color, 5, 3);
    vGlass(ctx, 5.5, 22, 2.4, W - 2.4, 2); vRoof(ctx, color, 8, 17, 3.4, W - 3.4); vLights(ctx, L, W);
  } else if (type === 'suv') {
    vBase(ctx, L, W, [8, 27], 7.5); vBody(ctx, L, W, color, 4, 3);
    vGlass(ctx, 6, 30, 2.8, W - 2.8, 2); vRoof(ctx, color, 9, 25, 3.8, W - 3.8, 2.5);
    ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = 0.9; ctx.beginPath(); ctx.moveTo(10, 5.6); ctx.lineTo(24, 5.6); ctx.moveTo(10, W - 5.6); ctx.lineTo(24, W - 5.6); ctx.stroke();  // roof rails
    vLights(ctx, L, W);
  } else if (type === 'pickup') {
    vBase(ctx, L, W, [8, 30], 7); vBody(ctx, L, W, color, 4, 2);
    ctx.fillStyle = 'rgba(0,0,0,0.42)'; rr(ctx, 2.5, 2.2, 16, W - 4.4, 1); ctx.fill();                      // open cargo bed
    ctx.strokeStyle = 'rgba(255,255,255,0.12)'; ctx.lineWidth = 0.6; ctx.beginPath(); for (let x = 5; x < 18; x += 3) { ctx.moveTo(x, 2.6); ctx.lineTo(x, W - 2.6); } ctx.stroke();
    vGlass(ctx, 21, 33, 2.4, W - 2.4, 2); vRoof(ctx, color, 23, 29, 3.4, W - 3.4); vLights(ctx, L, W);
  } else if (type === 'van') {
    vBase(ctx, L, W, [8, 30], 7); vBody(ctx, L, W, color, 5, 3);
    vRoof(ctx, color, 2, 31, 2.2, W - 2.2, 3); vGlass(ctx, 31.5, 36.5, 2.4, W - 2.4, 1.5);
    ctx.fillStyle = 'rgba(0,0,0,0.18)'; rr(ctx, 8, 4.5, 6, 3, 1); ctx.fill(); rr(ctx, 18, 4.5, 6, 3, 1); ctx.fill();   // roof vents
    ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 0.7; ctx.beginPath(); ctx.moveTo(3, 1.2); ctx.lineTo(30, 1.2); ctx.moveTo(3, W - 1.2); ctx.lineTo(30, W - 1.2); ctx.stroke();
    vLights(ctx, L, W);
  } else if (type === 'sports') {
    vBase(ctx, L, W, [7, 26], 7); vBody(ctx, L, W, color, 9, 3);
    vGlass(ctx, 14, 25, 3, W - 3, 2.5); vRoof(ctx, color, 15.5, 21, 4, W - 4, 2.2);
    ctx.fillStyle = 'rgba(255,255,255,0.85)'; ctx.fillRect(1.5, 6.3, 30, 1.2); ctx.fillRect(1.5, 8.5, 30, 1.2);        // racing stripes
    ctx.fillStyle = '#16181c'; rr(ctx, 0.2, 1.6, 2.6, W - 3.2, 0.8); ctx.fill();                                    // rear spoiler
    vLights(ctx, L, W, false);
  } else if (type === 'bus') {
    vBase(ctx, L, W, [10, 41], 8); vBody(ctx, L, W, color, 5, 3);
    vRoof(ctx, color, 2, 46, 2.2, W - 2.2, 2.5); vGlass(ctx, 46.5, 51, 2.6, W - 2.6, 1.5);
    ctx.fillStyle = 'rgba(255,255,255,0.7)'; ctx.fillRect(2, 3.6, 43, 1); ctx.fillRect(2, W - 4.6, 43, 1);                   // side stripes
    ctx.fillStyle = '#cfd8dc'; rr(ctx, 8, 6.5, 8, 6, 1); ctx.fill(); rr(ctx, 22, 6.5, 8, 6, 1); ctx.fill(); rr(ctx, 35, 6.5, 6, 6, 1); ctx.fill();   // roof units
    vLights(ctx, L, W);
  } else if (type === 'truck') {
    vBase(ctx, L, W, [7, 22, 38], 7.5);
    const cg = ctx.createLinearGradient(0, 0, 0, W); cg.addColorStop(0, '#fbfcfd'); cg.addColorStop(1, '#aab3ba');        // cargo box
    ctx.fillStyle = cg; rrr(ctx, 0, 0.6, 32, W - 1.2, 2, 1, 1, 2); ctx.fill(); ctx.strokeStyle = 'rgba(0,0,0,0.4)'; ctx.lineWidth = 0.6; ctx.stroke();
    ctx.strokeStyle = 'rgba(0,0,0,0.16)'; ctx.beginPath(); for (let x = 5; x < 31; x += 5) { ctx.moveTo(x, 1); ctx.lineTo(x, W - 1); } ctx.stroke();
    ctx.fillStyle = color === '#ecf0f1' ? '#2d6cdf' : shade(color, -0.1); ctx.fillRect(2, 8.4, 28, 2.2);                    // stripe on the box
    const cab = ctx.createLinearGradient(0, 0, 0, W); cab.addColorStop(0, shade(color === '#ecf0f1' ? '#2d6cdf' : color, 0.3)); cab.addColorStop(1, shade(color === '#ecf0f1' ? '#2d6cdf' : color, -0.35));
    ctx.fillStyle = cab; rrr(ctx, 32.5, 1, 11.5, W - 2, 1, 4, 4, 1); ctx.fill(); ctx.strokeStyle = 'rgba(0,0,0,0.38)'; ctx.stroke();
    vGlass(ctx, 39.5, 43.2, 2.6, W - 2.6, 1.2); vLights(ctx, L, W);
  } else if (type === 'ambulance') {
    vBase(ctx, L, W, [8, 30], 7); vBody(ctx, L, W, '#f7f8fa', 5, 3);
    vRoof(ctx, '#f7f8fa', 2, 31, 2.2, W - 2.2, 3); vGlass(ctx, 31.5, 36.5, 2.4, W - 2.4, 1.5);
    ctx.fillStyle = '#d63031'; ctx.fillRect(3, 0.9, 28, 1.7); ctx.fillRect(3, W - 2.6, 28, 1.7);                          // red side stripes
    ctx.fillStyle = '#d63031'; ctx.fillRect(14, 5.4, 6, 1.9); ctx.fillRect(16.05, 3.4, 1.9, 6); ctx.fillRect(14, 9.8, 0, 0); // roof cross
    ctx.fillStyle = '#2a2f36'; rr(ctx, 25.4, 3, 3.6, W - 6, 1); ctx.fill();                                              // light bar
    ctx.fillStyle = phase === 0 ? '#ff3b3b' : '#6b1c1c'; rr(ctx, 25.8, 3.4, 2.8, 4, 0.8); ctx.fill();
    ctx.fillStyle = phase === 1 ? '#3d8bff' : '#1b2f57'; rr(ctx, 25.8, W - 7.4, 2.8, 4, 0.8); ctx.fill();
    [[0, 5.4, 'rgba(255,60,60,'], [1, W - 5.4, 'rgba(70,140,255,']].forEach(([k, y, col]) => {
      if (phase !== k) return; const gr = ctx.createRadialGradient(27, y, 0, 27, y, 9); gr.addColorStop(0, col + '0.8)'); gr.addColorStop(1, col + '0)'); ctx.fillStyle = gr; ctx.fillRect(18, y - 9, 20, 18);
    });
    vLights(ctx, L, W);
  }
}
