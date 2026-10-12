// Police, weapons and the wanted level (extends GameScene; loaded after GameScene.js)
//
//  * Crimes add "heat". Heat decides the number of stars (1-5). Police respond to every crime straight away (dispatch).
//  * Police cars patrol the streets like normal traffic (lanes, traffic lights). When wanted they switch to pursuit:
//    they leave the lanes, follow the roads towards the player and drive straight at the player once they can see him.
//  * Police officers patrol the sidewalks. When wanted they run along the sidewalks to the player; from 2 stars they shoot.
//  * You lose the cops by getting out of their sight for 10 seconds. You get BUSTED when they catch you standing still,
//    and WASTED when your health runs out.

const WANTED_STEPS = [1, 3, 6, 10, 15];   // heat needed for 1..5 stars
const SPEED_LIMIT = 45;                   // km/h (the speedometer shows speed x 18)
const CRIME_COOLDOWN = { gunfire: 5000, speeding: 6000, wrongway: 6000, hitrun: 4000, copcar: 3000, copshot: 1500 };

const nearestIdx = (v, roads) => { let b = 0; roads.forEach((r, i) => { if (Math.abs(v - r - ROAD_W / 2) < Math.abs(v - roads[b] - ROAD_W / 2)) b = i; }); return b; };
const angDiff = (a, b) => Math.atan2(Math.sin(a - b), Math.cos(a - b));
const onRoad = (x, y) => roadsX.some(r => x > r + 12 && x < r + ROAD_W - 12) || roadsY.some(r => y > r + 12 && y < r + ROAD_W - 12);
const nodeIndex = n => ((n.i * roadsY.length + n.j) * 2 + n.qx) * 2 + n.qy;
function nearestNode(nodes, x, y) {
  let best = 0, bd = Infinity;
  for (let k = 0; k < nodes.length; k++) { const d = (nodes[k].x - x) ** 2 + (nodes[k].y - y) ** 2; if (d < bd) { bd = d; best = k; } }
  return best;
}

Object.assign(GameScene.prototype, {

  /* ---------- setup ---------- */
  initPolice() {
    this.police = []; this.bullets = []; this.flashes = [];
    this.bulletGfx = this.add.graphics().setDepth(4);
    this.heat = 0; this.stars = 0; this.lostTimer = 0; this.hp = 100; this.fireCd = 0; this.respawnTimer = 0; this.bustTimer = 0;
    this.crimeCd = {}; this.hurtCd = 0; this.reinforceCd = 0; this.copCd = 0; this.hitFlash = 0; this.toastT = 0;
    this.prevBox = null; this.wrongFrames = 0; this.fireHeld = false; this.hudKey = ''; this.pedDist = null; this.tick = 0;
    // sidewalk graph used by officers to run to the player (same corners the pedestrians use)
    this.nodes = [];
    roadsX.forEach((_, i) => roadsY.forEach((__, j) => [0, 1].forEach(qx => [0, 1].forEach(qy => this.nodes.push({ i, j, qx, qy, ...pedNodePos({ i, j, qx, qy }) })))));
    this.adj = this.nodes.map(n => [0, 1, 2, 3].map(d => pedNeighbor(n, d)).filter(Boolean).map(nodeIndex));
    this.elStars = document.getElementById('wanted'); this.elHp = document.getElementById('hp'); this.elToast = document.getElementById('toast');
    this.elBanner = document.getElementById('banner'); this.elHit = document.getElementById('hitflash');
    for (let k = 0; k < 3; k++) this.spawnPoliceCar(false);
    for (let k = 0; k < 4; k++) this.peds.push(this.newPed(true));
  },
  playerCar() { return this.player.inCar !== -1 ? this.cars[this.player.inCar] : null; },

  /* ---------- crimes, stars, health ---------- */
  crime(kind, heat, text) {
    if (this.respawnTimer > 0) return;
    const now = this.time.now;
    if (this.crimeCd[kind] && now < this.crimeCd[kind]) return;
    this.crimeCd[kind] = now + (CRIME_COOLDOWN[kind] || 0);
    this.heat = Math.min(20, this.heat + heat); this.lostTimer = 0;
    const before = this.stars; this.setStars();
    if (before === 0 && this.stars > 0) this.computePedDist();
    this.toast(text);
  },
  setStars() { let s = 0; WANTED_STEPS.forEach((t, i) => { if (this.heat >= t) s = i + 1; }); this.stars = s; },
  toast(text, kind) { this.elToast.innerText = text; this.elToast.className = 'show' + (kind === 'info' ? ' info' : ''); this.toastT = 170; },
  hurt(n) {
    if (this.respawnTimer > 0) return;
    this.hp = Math.max(0, this.hp - n); this.hitFlash = 6;
    if (this.hp <= 0) this.endRun('WASTED', 'You were taken down');
  },
  endRun(title, sub) { // WASTED / BUSTED: freeze for a moment, then start again on foot
    this.respawnTimer = 170; this.bustTimer = 0; this.bullets = []; this.fireHeld = false;
    this.player.inCar = -1; Sfx.engineSet(null);
    this.elBanner.innerHTML = `${title}<small>${sub}</small>`; this.elBanner.className = 'show ' + title.toLowerCase();
  },
  doRespawn() {
    const P = this.player; P.x = 1200; P.y = 1200; P.inCar = -1; this.hp = 100; this.heat = 0; this.stars = 0; this.lostTimer = 0;
    this.elBanner.className = ''; this.prevBox = null;
  },

  /* ---------- shooting ---------- */
  fire() {
    if (this.fireCd > 0 || this.respawnTimer > 0) return;
    const P = this.player, car = this.playerCar(), ox = car ? car.x : P.x, oy = car ? car.y : P.y;
    let ang = car ? car.angle : P.angle;
    let best = null, bd = 0.32;                                  // aim assist: snap to a target close to the aiming direction
    for (const p of this.peds) {
      if (!p.alive) continue;
      const dx = p.x - ox, dy = p.y - oy, d = Math.hypot(dx, dy);
      if (d > 320 || d < 12) continue;
      const a = Math.abs(angDiff(Math.atan2(dy, dx), ang));
      if (a < bd) { bd = a; best = Math.atan2(dy, dx); }
    }
    if (best !== null) ang = best;
    if (!car) P.angle = ang;
    const reach = car ? 22 : 12, x = ox + Math.cos(ang) * reach, y = oy + Math.sin(ang) * reach;
    this.bullets.push({ x, y, vx: Math.cos(ang) * 9, vy: Math.sin(ang) * 9, life: 45, own: 'p' });
    this.flashes.push({ x, y, life: 3 }); this.fireCd = 14; Sfx.shot(0.35);
    this.peds.forEach(p => { if (p.alive && !p.cop && Math.hypot(p.x - ox, p.y - oy) < 260) p.scare = 220; });   // people run from gunfire
    this.crime('gunfire', 0.7, 'FIRING A WEAPON');
  },
  hitsCar(b, c) { // bullet inside the body of a car?
    const rx = b.x - c.x, ry = b.y - c.y, co = Math.cos(c.angle), si = Math.sin(c.angle);
    return Math.abs(rx * co + ry * si) < c.len / 2 + 1 && Math.abs(-rx * si + ry * co) < c.wid / 2 + 1;
  },
  killPed(p) {
    p.alive = false; p.injured = false; p.deadTime = 180; p.spr.setTexture('dead').setRotation(p.dir);
    this.addBlood(p.x, p.y, 14); this.addBlood(p.x + 5, p.y + 3, 7); this.sfx('hit', 0.7);
  },
  updateBullets(all) {
    const P = this.player, car = this.playerCar();
    this.bullets = this.bullets.filter(b => {
      for (let s = 0; s < 3; s++) {
        b.x += b.vx / 3; b.y += b.vy / 3;
        if (isCollidingBuilding(b.x - 1, b.y - 1, 2, 2)) return false;
        if (b.own === 'p') {
          for (const p of this.peds) if (p.alive && Math.hypot(p.x - b.x, p.y - b.y) < 8) {
            if (p.cop) { p.hp -= 34; this.crime('copshot', 3, 'SHOT A POLICE OFFICER'); if (p.hp <= 0) this.killPed(p); else this.sfx('hit', 0.3); }
            else { this.hurtPed(p, p.injured ? 999 : 60); this.crime('murder', 3, 'SHOT A PEDESTRIAN'); }
            return false;
          }
          for (const c of all) if (c !== car && this.hitsCar(b, c)) { if (c.police) this.crime('copcar', 1.5, 'SHOT AT A POLICE CAR'); return false; }
        } else if (car) { if (this.hitsCar(b, car)) { this.hurt(2.5); return false; } }
        else if (Math.hypot(P.x - b.x, P.y - b.y) < 9) { this.hurt(6); return false; }
      }
      return --b.life > 0;
    });
    const g = this.bulletGfx; g.clear();
    this.bullets.forEach(b => { g.lineStyle(1.8, 0xffe27a, 0.95); g.lineBetween(b.x - b.vx * 1.6, b.y - b.vy * 1.6, b.x, b.y); });
    this.flashes = this.flashes.filter(f => { g.fillStyle(0xfff2a8, 0.9).fillCircle(f.x, f.y, 5); return --f.life > 0; });
  },

  /* ---------- police cars ---------- */
  spawnPoliceCar(pursuit) {
    const P = this.player, all = [...this.cars, ...this.traffic, ...this.police], minD = pursuit ? 650 : 450;
    let sp, tries = 0;
    do { sp = randomLaneSpawn(); tries++; }
    while (tries < 80 && (Math.hypot(sp.x - P.x, sp.y - P.y) < minD || all.some(o => Math.hypot(o.x - sp.x, o.y - sp.y) < 60)));
    const car = { x: sp.x, y: sp.y, angle: DIR_ANGLE[sp.dir], speed: pursuit ? 1.5 : 0.9, color: 'police', type: 'police', len: 32, wid: 16, spr: this.sprite(sp.x, sp.y, 'cop_off', 2).setRotation(DIR_ANGLE[sp.dir]) };
    Object.assign(car, {
      npc: true, police: true, id: ++this.carIds, mode: pursuit ? 'chase' : 'lane', pursuit,
      dir: sp.dir, gi: sp.gi, gj: sp.gj, nextDir: pickDir(sp.gi, sp.gj, sp.dir), turn: null, cruise: 1.0 + Math.random() * 0.15,
      lat: 0, bypassWait: 0, waitUntil: 0, ghostUntil: 0, stuck: 0, wp: null, flash: 0, phase: -1, noLos: 0, blockedFrames: 0
    });
    this.police.push(car); return car;
  },
  updatePoliceCars(all, walkers, now) {
    const P = this.player;
    this.police.forEach(c => {
      const d = Math.hypot(P.x - c.x, P.y - c.y);
      const respond = this.stars > 0 && this.respawnTimer <= 0 && (this.stars >= 3 || d < (this.stars === 1 ? 1100 : 1700));
      if (respond && !c.pursuit) { c.pursuit = true; c.mode = 'chase'; c.wp = null; c.turn = null; }
      if (!respond && c.pursuit) this.trySnapToLane(c);
      if (c.pursuit) this.pursueStep(c); else this.updateNpcCar(c, all, walkers, now);
      const ph = c.pursuit && this.stars > 0 ? (++c.flash >> 3) & 1 : -1;     // flashing lights only while chasing
      if (ph !== c.phase) { c.phase = ph; c.spr.setTexture(ph < 0 ? 'cop_off' : 'cop_' + ph); }
    });
  },
  // back to normal patrol: join the lane of the road the car is driving on (only on a straight piece of road)
  trySnapToLane(c) {
    const hx = Math.cos(c.angle), hy = Math.sin(c.angle);
    const vi = roadsX.findIndex(r => Math.abs(c.x - r - ROAD_W / 2) < 26), hj = roadsY.findIndex(r => Math.abs(c.y - r - ROAD_W / 2) < 26);
    const nearCross = (v, roads) => roads.some(r => Math.abs(v - r - ROAD_W / 2) < 85);
    let dir = -1, gi = 0, gj = 0;
    if (vi >= 0 && !nearCross(c.y, roadsY) && Math.abs(hy) > 0.9) {
      dir = hy > 0 ? 1 : 3; gi = vi;
      const ys = roadsY.map(r => r + ROAD_W / 2);
      gj = dir === 1 ? ys.findIndex(v => v > c.y) : ys.reduce((a, v, k) => v < c.y ? k : a, -1);
    } else if (hj >= 0 && !nearCross(c.x, roadsX) && Math.abs(hx) > 0.9) {
      dir = hx > 0 ? 0 : 2; gj = hj;
      const xs = roadsX.map(r => r + ROAD_W / 2);
      gi = dir === 0 ? xs.findIndex(v => v > c.x) : xs.reduce((a, v, k) => v < c.x ? k : a, -1);
    }
    if (dir < 0 || !inGrid(gi, gj)) return false;
    Object.assign(c, { mode: 'lane', pursuit: false, dir, gi, gj, nextDir: pickDir(gi, gj, dir), lat: 0, turn: null, angle: DIR_ANGLE[dir], stuck: 0 });
    return true;
  },
  lineClear(x1, y1, x2, y2, r) { // no building between the two points?
    const n = Math.ceil(Math.hypot(x2 - x1, y2 - y1) / 14);
    for (let k = 1; k < n; k++) { const t = k / n; if (isCollidingBuilding(x1 + (x2 - x1) * t - r, y1 + (y2 - y1) * t - r, 2 * r, 2 * r)) return false; }
    return true;
  },
  // the next intersection to drive to: towards the target (if there is one), otherwise a random one
  nextWaypoint(c, target) {
    if (!c.wp) c.wp = { i: nearestIdx(c.x, roadsX), j: nearestIdx(c.y, roadsY), last: -1 };
    const w = c.wp, tx = roadCenterX(w.i), ty = roadCenterY(w.j);
    if (Math.hypot(tx - c.x, ty - c.y) > 42) return { x: tx, y: ty };
    const pi = target ? nearestIdx(target.x, roadsX) : 0, pj = target ? nearestIdx(target.y, roadsY) : 0;
    if (target && w.i === pi && w.j === pj) return { x: target.x, y: target.y };
    let best = -1, bs = Infinity;
    for (let d = 0; d < 4; d++) {
      const ni = w.i + DIRS[d].x, nj = w.j + DIRS[d].y;
      if (!inGrid(ni, nj) || (w.last >= 0 && d === (w.last + 2) % 4)) continue;           // no U-turns
      const score = (target ? Math.abs(ni - pi) + Math.abs(nj - pj) + Math.random() * 0.3 : Math.random()) - (d === w.last ? 0.4 : 0);
      if (score < bs) { bs = score; best = d; }
    }
    if (best < 0) { w.last = -1; return { x: tx, y: ty }; }
    w.i += DIRS[best].x; w.j += DIRS[best].y; w.last = best;
    return { x: roadCenterX(w.i), y: roadCenterY(w.j) };
  },
  // free driving (not tied to a lane), used by police in pursuit and by ambulances:
  // steer towards the target (straight at it when it is in sight, otherwise along the roads), brake in corners
  driveFree(c, target, vmax, stopDist, walkers) {
    const dist = target ? Math.hypot(target.x - c.x, target.y - c.y) : Infinity;
    if (c.noLos > 0) c.noLos--;
    let tx, ty, direct = false;
    if (target && c.noLos <= 0 && dist < 380 && this.lineClear(c.x, c.y, target.x, target.y, 12)) { tx = target.x; ty = target.y; direct = true; c.wp = null; }
    else { const wp = this.nextWaypoint(c, target); tx = wp.x; ty = wp.y; }
    const diff = angDiff(Math.atan2(ty - c.y, tx - c.x), c.angle), turn = 0.07 * (CAR_TYPES[c.type] ? CAR_TYPES[c.type].turn : 1);
    c.angle += clamp(diff, -turn, turn);
    let vt = vmax * (1 - Math.min(0.55, Math.abs(diff) * 0.5));
    if (direct && dist < stopDist) vt = 0;                                                 // stop next to the target
    if (walkers) { // do not run over people on the way
      const hx = Math.cos(c.angle), hy = Math.sin(c.angle);
      for (const w of walkers) {
        if (w === target) continue;
        const rx = w.x - c.x, ry = w.y - c.y, along = rx * hx + ry * hy;
        if (along > 6 && along < 90 && Math.abs(-rx * hy + ry * hx) < c.wid / 2 + 6) vt = Math.min(vt, Math.max(0, along - c.len / 2 - 10) * 0.06);
      }
    }
    c.speed += clamp(vt - c.speed, -0.12, 0.05);
    const nx = c.x + Math.cos(c.angle) * c.speed, ny = c.y + Math.sin(c.angle) * c.speed;
    if (!isCollidingBuilding(nx - 12, ny - 12, 24, 24)) { c.x = nx; c.y = ny; c.blockedFrames = 0; }
    else { c.speed *= 0.5; if (++c.blockedFrames > 20) { c.noLos = 90; c.wp = null; c.blockedFrames = 0; } }
    return dist;
  },
  pursueStep(c) { // police in pursuit: after the player while he is wanted, otherwise just cruising
    const hunting = this.stars > 0;
    this.driveFree(c, hunting ? this.player : null, hunting ? 2.3 + 0.15 * Math.min(this.stars, 4) : 1.3, 52);
  },
  isRam(c) { return !!((c.police && c.pursuit) || (c.ambulance && c.state === 'respond')); }, // emergency vehicles on a mission push through traffic
  // exact overlap test of two rotated rectangles (separating axis); returns the push direction a -> b and the depth, or null
  overlap(a, b) {
    const ca = Math.cos(a.angle), sa = Math.sin(a.angle), cb = Math.cos(b.angle), sb = Math.sin(b.angle), dx = b.x - a.x, dy = b.y - a.y;
    const axes = [[ca, sa], [-sa, ca], [cb, sb], [-sb, cb]];
    let depth = Infinity, nx = 0, ny = 0;
    for (const [ux, uy] of axes) {
      const ra = a.len / 2 * Math.abs(ux * ca + uy * sa) + a.wid / 2 * Math.abs(-ux * sa + uy * ca);
      const rb = b.len / 2 * Math.abs(ux * cb + uy * sb) + b.wid / 2 * Math.abs(-ux * sb + uy * cb);
      const dist = ux * dx + uy * dy, ov = ra + rb - Math.abs(dist);
      if (ov <= 0) return null;
      if (ov < depth) { depth = ov; nx = dist >= 0 ? ux : -ux; ny = dist >= 0 ? uy : -uy; }
    }
    return { nx, ny, ov: depth };
  },
  // two cars overlap: an emergency vehicle on a mission rams through, everybody else is pushed apart equally
  collideCars(a, b, now) {
    const hit = this.overlap(a, b);
    if (!hit) return;
    const { nx, ny, ov } = hit, old = [a.x, a.y, b.x, b.y], pc = this.playerCar(), ra = this.isRam(a), rb = this.isRam(b);
    if (ra !== rb) {
      const cop = ra ? a : b, other = ra ? b : a, s = ra ? 1 : -1;
      other.x += nx * ov * s; other.y += ny * ov * s; other.speed *= 0.4; cop.speed *= 0.93;
      if (cop.police && other === pc && Math.abs(cop.speed) + Math.abs(other.speed) > 1.2 && this.hurtCd <= 0) { this.hurt(5); this.hurtCd = 40; this.crash(); }
    } else { a.x -= nx * ov / 2; a.y -= ny * ov / 2; b.x += nx * ov / 2; b.y += ny * ov / 2; a.speed *= 0.6; b.speed *= 0.6; }
    [a, b].forEach((c, k) => { if (isCollidingBuilding(...this.carBox(c))) { c.x = old[k * 2]; c.y = old[k * 2 + 1]; } });   // never push a car into a building
  },
  carCrash(hit) { // the player's car hits another car at speed
    if (hit.police) this.crime('copcar', 2, 'RAMMED A POLICE CAR');
    else if (hit.npc) this.crime('hitrun', 0.8, 'HIT AND RUN');
  },

  /* ---------- police officers on foot ---------- */
  computePedDist() { // BFS over the sidewalk graph, starting at the corner closest to the player
    const dist = new Array(this.nodes.length).fill(Infinity), start = nearestNode(this.nodes, this.player.x, this.player.y), q = [start];
    dist[start] = 0;
    for (let h = 0; h < q.length; h++) for (const m of this.adj[q[h]]) if (dist[m] === Infinity) { dist[m] = dist[q[h]] + 1; q.push(m); }
    this.pedDist = dist;
  },
  moveCop(p, tx, ty, spd) { // walk towards a point, sliding along buildings
    const dx = tx - p.x, dy = ty - p.y, d = Math.hypot(dx, dy) || 1, sx = dx / d * spd, sy = dy / d * spd;
    if (!isCollidingBuilding(p.x + sx - 6, p.y - 6, 12, 12)) p.x += sx;
    if (!isCollidingBuilding(p.x - 6, p.y + sy - 6, 12, 12)) p.y += sy;
    p.dir = Math.atan2(dy, dx); p.walk += spd;
    const fr = Math.floor(p.walk / 5) % 2; if (fr !== p.frame) { p.frame = fr; p.spr.setTexture(`ped${p.type}_${fr}`); }
  },
  updateCopChase(p) {
    const P = this.player, dist = Math.hypot(P.x - p.x, P.y - p.y);
    p.state = 'chase'; p.pending = null; p.crossing = null; p.fireCd = Math.max(0, (p.fireCd || 0) - 1);
    if (!this.pedDist) this.computePedDist();
    const spd = 1.25 + 0.1 * Math.min(this.stars, 4), armed = this.stars >= 2, keepAway = this.stars >= 3;
    if (dist < 240 && this.lineClear(p.x, p.y, P.x, P.y, 5)) {                              // he is in sight: go straight for him
      if (!(keepAway && dist < 110) && dist > 12) this.moveCop(p, P.x, P.y, spd);           // from 3 stars they keep their distance and shoot
      p.dir = Math.atan2(P.y - p.y, P.x - p.x);
      if (armed && dist < 300 && p.fireCd <= 0) this.copShoot(p);
    } else {                                                                               // follow the sidewalks
      const n = nearestNode(this.nodes, p.x, p.y);
      let best = n, bd = this.pedDist[n];
      for (const m of this.adj[n]) if (this.pedDist[m] < bd) { bd = this.pedDist[m]; best = m; }
      if (best === n) this.moveCop(p, P.x, P.y, spd); else this.moveCop(p, this.nodes[best].x, this.nodes[best].y, spd);
    }
    p.spr.setPosition(p.x, p.y).setRotation(p.dir);
  },
  rejoinSidewalk(p) { // back to the sidewalk network (officers after the chase, injured people after treatment)
    const n = this.nodes[nearestNode(this.nodes, p.x, p.y)], heading = Math.round(((p.dir % 6.2832) + 6.2832) % 6.2832 / (Math.PI / 2)) % 4;
    p.from = n; p.heading = heading; p.crossing = null;
    const next = this.pickPedNext(n, heading); p.heading = next.d;
    if (next.nb.cross) { p.pending = next.nb; p.to = n; p.state = 'wait'; } else { p.to = next.nb; p.state = 'walk'; }
  },
  copShoot(p) {
    const P = this.player, a = Math.atan2(P.y - p.y, P.x - p.x) + (Math.random() - 0.5) * 0.18, d = Math.hypot(P.x - p.x, P.y - p.y);
    this.bullets.push({ x: p.x + Math.cos(a) * 8, y: p.y + Math.sin(a) * 8, vx: Math.cos(a) * 7, vy: Math.sin(a) * 7, life: 60, own: 'c' });
    this.flashes.push({ x: p.x + Math.cos(a) * 8, y: p.y + Math.sin(a) * 8, life: 3 });
    p.fireCd = 70 - 6 * Math.min(this.stars, 4) + randInt(20); Sfx.shot(clamp(0.28 - d / 1500, 0.05, 0.28));
  },

  /* ---------- traffic rules (only checked for the car the player drives) ---------- */
  checkTraffic(car) {
    const sp = Math.abs(car.speed);
    let box = null;                                                                      // red light: entering an intersection while it is red
    roadsX.forEach((rx, i) => roadsY.forEach((ry, j) => { if (car.x > rx + 12 && car.x < rx + ROAD_W - 12 && car.y > ry + 12 && car.y < ry + ROAD_W - 12) box = { i, j }; }));
    if (box && !this.prevBox && sp > 0.6) {
      const axis = Math.abs(Math.cos(car.angle)) > Math.abs(Math.sin(car.angle)) ? 0 : 1;
      if (this.lightState(box.i, box.j, axis) === 'red') this.crime('redlight', 1, 'RAN A RED LIGHT');
    }
    this.prevBox = box;
    if (sp * 18 > SPEED_LIMIT && onRoad(car.x, car.y)) this.crime('speeding', 0.6, 'SPEEDING');
    // wrong way: driving against the direction of the lane (on a straight piece of road)
    let wrong = false;
    if (sp > 1) {
      const sg = Math.sign(car.speed), vx = Math.cos(car.angle) * sg, vy = Math.sin(car.angle) * sg;
      const vi = roadsX.findIndex(r => { const o = Math.abs(car.x - r - ROAD_W / 2); return o < 27 && o > 4; });
      const hj = roadsY.findIndex(r => { const o = Math.abs(car.y - r - ROAD_W / 2); return o < 27 && o > 4; });
      if (vi >= 0 && !roadsY.some(r => Math.abs(car.y - r - ROAD_W / 2) < 55) && Math.abs(vy) > 0.8)
        wrong = Math.sign(laneShift(vy > 0 ? 1 : 3).x) !== Math.sign(car.x - roadCenterX(vi));
      else if (hj >= 0 && !roadsX.some(r => Math.abs(car.x - r - ROAD_W / 2) < 55) && Math.abs(vx) > 0.8)
        wrong = Math.sign(laneShift(vx > 0 ? 0 : 2).y) !== Math.sign(car.y - roadCenterY(hj));
    }
    this.wrongFrames = wrong ? this.wrongFrames + 1 : 0;
    if (this.wrongFrames > 50) this.crime('wrongway', 1, 'DRIVING THE WRONG WAY');
  },

  /* ---------- per-frame bookkeeping: wanted level, busting, reinforcements, HUD ---------- */
  updateWanted(all) {
    const P = this.player, car = this.playerCar();
    this.tick++;
    if (this.respawnTimer > 0 && --this.respawnTimer === 0) this.doRespawn();
    if (this.fireCd > 0) this.fireCd--;
    if (this.hurtCd > 0) this.hurtCd--;
    if (this.hitFlash > 0) this.hitFlash--;
    if (this.toastT > 0 && --this.toastT === 0) this.elToast.className = '';
    if (car && this.respawnTimer <= 0) this.checkTraffic(car); else { this.prevBox = null; this.wrongFrames = 0; }
    if (this.stars === 0 && this.hp < 100) this.hp = Math.min(100, this.hp + 0.03);   // slow recovery when nobody is after you

    if (this.stars > 0 && this.respawnTimer <= 0) {
      if (this.tick % 15 === 0) this.computePedDist();
      // escaping: stay out of sight of every police unit for 10 seconds
      let seen = this.police.some(c => Math.hypot(c.x - P.x, c.y - P.y) < 420) || this.peds.some(p => p.cop && p.alive && Math.hypot(p.x - P.x, p.y - P.y) < 380);
      this.lostTimer = seen ? 0 : this.lostTimer + 1;
      if (this.lostTimer > 600) { this.heat = 0; this.stars = 0; this.lostTimer = 0; this.toast('WANTED LEVEL LOST'); }
      // busted: an officer catches you, or a police car boxes you in while you stand still
      const still = car ? Math.abs(car.speed) < 0.6 : !this.pMoving;
      let caught = !car && this.peds.some(p => p.cop && p.alive && Math.hypot(p.x - P.x, p.y - P.y) < 16);
      if (still && !caught) caught = this.police.some(c => c.pursuit && Math.hypot(c.x - P.x, c.y - P.y) < 62);
      this.bustTimer = caught ? this.bustTimer + 1 : Math.max(0, this.bustTimer - 2);
      if (this.bustTimer > 110) this.endRun('BUSTED', 'You were arrested');
      // a police car in pursuit running over a player on foot
      if (!car) for (const c of this.police) if (c.pursuit && Math.abs(c.speed) > 0.8 && this.hurtCd <= 0 && this.carHitsPed(c, P)) { this.hurt(12); this.hurtCd = 45; this.sfx('hit', 0.5); }
    } else this.bustTimer = 0;

    // police cars: more of them the higher the wanted level; calm again = 3 patrol cars, extra ones leave
    if (this.reinforceCd > 0) this.reinforceCd--;
    const want = this.stars ? Math.min(6, 1 + this.stars) : 3;
    if (this.stars && this.police.length < want && this.reinforceCd <= 0) { this.spawnPoliceCar(true); this.reinforceCd = 150; }
    else if (!this.stars && this.police.length < 3 && this.reinforceCd <= 0) { this.spawnPoliceCar(false); this.reinforceCd = 300; }
    if (!this.stars) for (const c of [...this.police]) if (this.police.length > 3 && Math.hypot(c.x - P.x, c.y - P.y) > 800) { c.spr.destroy(); this.police.splice(this.police.indexOf(c), 1); }
    // police officers: keep four on patrol
    if (this.copCd > 0) this.copCd--;
    if (this.peds.filter(p => p.cop && p.alive).length < 4 && this.copCd <= 0) { this.peds.push(this.newPed(true, 500)); this.copCd = 400; }

    // siren: louder the closer the nearest chasing police car is
    let near = Infinity; if (this.stars) for (const c of this.police) if (c.pursuit) near = Math.min(near, Math.hypot(c.x - P.x, c.y - P.y));
    const lp = near < 900 ? 1 - near / 900 : 0, la = this.ambulanceLevel();
    if (la > lp) Sfx.siren(la, 'amb'); else Sfx.siren(lp, 'police');
    this.refreshHud();
  },
  refreshHud() {
    const key = this.stars + '|' + Math.ceil(this.hp);
    if (key !== this.hudKey) {
      this.hudKey = key; let s = '';
      for (let i = 0; i < 5; i++) s += `<i class="${i < this.stars ? 'on' : ''}">★</i>`;
      this.elStars.innerHTML = s; this.elStars.classList.toggle('hunt', this.stars > 0);
      const f = clamp(this.hp / 100, 0, 1);
      this.elHp.style.width = (f * 100) + '%'; this.elHp.style.background = f > 0.5 ? '#2ecc71' : f > 0.25 ? '#f1c40f' : '#e74c3c';
    }
    const hit = this.hitFlash > 0; if (hit !== this.hitOn) { this.hitOn = hit; this.elHit.style.opacity = hit ? 0.5 : 0; }
  }
});
