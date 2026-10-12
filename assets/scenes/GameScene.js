class GameScene extends Phaser.Scene {
  constructor() { super('Game'); }

  /* ---------- sound ---------- */
  sfx(key, vol = 0.5) { Sfx.play(key, vol); }
  crash() { if (this.time.now < (this.nextCrash || 0)) return; this.nextCrash = this.time.now + 300; this.sfx('crash', 0.6); }
  honk() {
    if (this.player.inCar === -1) return; // the horn only works while driving
    this.sfx('horn', 0.5);
    // NPC cars close by stop for a moment when they hear the horn
    this.traffic.forEach(c => { if (Math.hypot(c.x - this.player.x, c.y - this.player.y) < 140) c.waitUntil = this.time.now + 700; });
  }

  /* ---------- textures & world (created once, painted with the canvas 2D API at RES x resolution, see visuals.js) ---------- */
  canvasTex(key, w, h, draw) {
    if (this.textures.exists(key)) return key;
    const t = this.textures.createCanvas(key, Math.ceil(w * RES), Math.ceil(h * RES)), ctx = t.getContext();
    ctx.scale(RES, RES); draw(ctx); t.refresh();
    return key;
  }
  sprite(x, y, key, depth) { return this.add.image(x, y, key).setScale(1 / RES).setDepth(depth); }
  carTex(color, type = 'sedan') { const T = CAR_TYPES[type]; return this.canvasTex(`car_${type}_${color}`, T.len + 4, T.wid + 4, ctx => paintVehicle(ctx, type, color)); }
  makeTextures() {
    PED_SHIRTS.forEach((c, i) => [0, 1].forEach(f => this.canvasTex(`ped${i}_${f}`, 14, 14, ctx => paintPed(ctx, c, f, 14, { cap: i === 3, medic: i === 4 }))));
    [['cop_off', -1], ['cop_0', 0], ['cop_1', 1]].forEach(([k, ph]) => this.canvasTex(k, 36, 20, ctx => paintCopCar(ctx, ph)));
    [['amb_off', -1], ['amb_0', 0], ['amb_1', 1]].forEach(([k, ph]) => this.canvasTex(k, 42, 21, ctx => paintVehicle(ctx, 'ambulance', '#fff', ph)));
    this.canvasTex('dead', 26, 18, paintDead);
    this.canvasTex('player', 16, 16, ctx => paintPed(ctx, '#0984e3', 0, 16, { gun: true }));
    this.canvasTex('blood', 28, 28, paintBlood);
  }
  drawWorld() { // the city is painted in 600 x 600 chunks (a single huge texture would exceed the GPU limit)
    const CH = 600, M = 2;
    for (let cy = 0; cy < WORLD.h; cy += CH) for (let cx = 0; cx < WORLD.w; cx += CH) {
      const key = `world_${cx}_${cy}`, size = CH + 2 * M;
      const t = this.textures.createCanvas(key, Math.ceil(size * RES), Math.ceil(size * RES)), ctx = t.getContext();
      ctx.scale(RES, RES); ctx.translate(M - cx, M - cy);
      paintWorld(ctx, cx - M, cy - M, size, size);
      t.refresh();
      this.add.image(cx - M, cy - M, key).setOrigin(0).setScale(1 / RES).setDepth(0); // 2 px overlap hides seams between chunks
    }
  }

  /* ---------- traffic lights ---------- */
  // axis 1 = north-south traffic, axis 0 = east-west traffic. Cycle: NS green, NS yellow, all red, EW green, EW yellow, all red.
  lightState(i, j, axis) {
    const t = (this.time.now + this.lightOffset[i][j]) % LIGHT_CYCLE;
    const u = axis === 1 ? t : (t + LIGHT_CYCLE - LIGHT_HALF) % LIGHT_CYCLE;
    return u < LIGHT_GREEN ? 'green' : u < LIGHT_GREEN + LIGHT_YELLOW ? 'yellow' : 'red';
  }
  drawLights() { // redraw only when some light changes colour
    let key = '';
    for (let i = 0; i < roadsX.length; i++) for (let j = 0; j < roadsY.length; j++) key += this.lightState(i, j, 0)[0] + this.lightState(i, j, 1)[0];
    if (key === this.lightKey) return;
    this.lightKey = key;
    const g = this.lightGfx, colors = { green: 0x2ecc71, yellow: 0xf1c40f, red: 0xe74c3c };
    g.clear();
    for (let i = 0; i < roadsX.length; i++) for (let j = 0; j < roadsY.length; j++) for (let d = 0; d < 4; d++) {
      const p = lightPos(d, i, j);
      const col = colors[this.lightState(i, j, d % 2)];
      g.fillStyle(0x111111, 0.92).fillRoundedRect(p.x - 4, p.y - 4, 8, 8, 2.5);
      g.fillStyle(col, 0.3).fillCircle(p.x, p.y, 7);   // glow
      g.fillStyle(col).fillCircle(p.x, p.y, 2.8);
    }
  }

  /* ---------- entities ---------- */
  newCar(x, y, angle, color, speed, type = 'sedan') {
    const T = CAR_TYPES[type];
    return { x, y, angle, speed, color, type, len: T.len, wid: T.wid, spr: this.sprite(x, y, this.carTex(color, type), 2).setRotation(angle) };
  }
  spawnTraffic(n) {
    for (let i = 0; i < n; i++) {
      let sp, tries = 0;
      do { sp = randomLaneSpawn(); tries++; }
      while (tries < 40 && [...this.cars, ...this.traffic].some(o => Math.hypot(o.x - sp.x, o.y - sp.y) < 60));
      const type = weightedPick(Object.entries(CAR_TYPES).filter(([, t]) => t.weight).map(([k, t]) => [k, t.weight]));
      let color;
      if (type === 'taxi') color = TAXI_YELLOW;
      else if (type === 'bus') color = BUS_COLORS[randInt(BUS_COLORS.length)];
      else if (type === 'truck') color = TRUCK_COLORS[randInt(TRUCK_COLORS.length)];
      else { // every car gets the colour that is used the least so far (random among ties), so neighbouring cars look different
        const used = {}; [...this.cars, ...this.traffic].forEach(o => { used[o.color] = (used[o.color] || 0) + 1; });
        const fewest = Math.min(...CAR_COLORS.map(k => used[k] || 0)), pool = CAR_COLORS.filter(k => (used[k] || 0) === fewest);
        color = pool[randInt(pool.length)];
      }
      const T = CAR_TYPES[type];
      const car = this.newCar(sp.x, sp.y, DIR_ANGLE[sp.dir], color, 0.8 + Math.random() * 0.5, type);
      // NPC driver state
      Object.assign(car, {
        npc: true, id: ++this.carIds, mode: 'lane',            // 'lane' = following a lane, 'turn' = driving an arc through an intersection
        dir: sp.dir, gi: sp.gi, gj: sp.gj,  // current direction and the intersection the car is heading to
        nextDir: pickDir(sp.gi, sp.gj, sp.dir), turn: null,
        cruise: T.cruise[0] + Math.random() * (T.cruise[1] - T.cruise[0]),  // preferred speed (depends on the vehicle type)
        lat: 0, bypassWait: 0,              // lateral shift used to overtake an abandoned car
        waitUntil: 0, ghostUntil: 0, stuck: 0
      });
      this.traffic.push(car);
    }
    this.label.innerText = this.traffic.length + ' CARS';
  }
  newPed(cop = false, minDist = 0) { // cop = police officer in uniform; minDist = do not appear closer than this to the player
    const type = cop ? 3 : randInt(3), P = this.player;
    let node, d, nb, a, b, off, x, y;
    for (let tries = 0; ; tries++) { // start somewhere on a sidewalk, between two corners
      node = { i: randInt(roadsX.length), j: randInt(roadsY.length), qx: randInt(2), qy: randInt(2) };
      d = randInt(4); nb = pedNeighbor(node, d);
      if (!nb || nb.cross) continue;
      a = pedNodePos(node); b = pedNodePos(nb); const t = 0.1 + Math.random() * 0.8;
      off = { x: Math.random() * 3 - 1.5, y: Math.random() * 3 - 1.5 }; // so pedestrians do not walk on exactly the same line
      x = a.x + (b.x - a.x) * t + off.x; y = a.y + (b.y - a.y) * t + off.y;
      if (!minDist || tries > 60 || Math.hypot(x - P.x, y - P.y) >= minDist) break;
    }
    return {
      x, y, dir: DIR_ANGLE[d], alive: true, deadTime: 0, type, cop, hp: 100, fireCd: 0, walk: 0, frame: 0,
      spr: this.sprite(x, y, `ped${type}_0`, 3).setRotation(DIR_ANGLE[d]),
      from: node, to: nb, heading: d, pending: null, crossing: null, off,
      speed: (cop ? 0.45 : 0.5) + Math.random() * 0.25, state: 'walk', wait: 0, scare: 0
    };
  }
  addBlood(x, y, r) {
    this.bloods.push({ life: 400, spr: this.sprite(x, y, 'blood', 1).setScale(r / 14 / RES) });
  }

  /* ---------- setup ---------- */
  create() {
    this.makeTextures(); this.drawWorld();
    this.lightOffset = roadsX.map(() => roadsY.map(() => Math.random() * LIGHT_CYCLE)); // every intersection has its own phase
    this.lightGfx = this.add.graphics().setDepth(1.5); this.lightKey = '';
    this.hud = document.getElementById('hudSpeed');
    this.label = document.getElementById('trafficCount');
    this.mini = document.getElementById('minimap').getContext('2d');
    this.player = { x: 1200, y: 1200, angle: 0, inCar: -1 };
    this.pSpr = this.sprite(1200, 1200, 'player', 5);
    this.carIds = 0; this.cars = []; this.traffic = []; this.peds = []; this.bloods = [];
    const slots = Phaser.Utils ? Phaser.Utils.Array.Shuffle(parkingSlots()) : parkingSlots().sort(() => Math.random() - 0.5);
    [['sports', '#ff4757'], ['suv', '#2ed573'], ['pickup', '#ffa502'], ['hatch', '#70a1ff'], ['van', '#a55eea'], ['sedan', '#ffffff']].forEach(([type, c]) => { // cars the player can take, parked in the car park
      const slot = slots.pop();
      this.cars.push(this.newCar(slot.x, slot.y, slot.angle, c, 0, type));
    });
    this.spawnTraffic(14);
    for (let k = 0; k < 18; k++) this.peds.push(this.newPed());
    this.initPolice();
    this.initMedical();

    this.k = this.input.keyboard.addKeys('W,A,S,D,UP,DOWN,LEFT,RIGHT,SPACE,F');
    this.input.keyboard.on('keydown-E', () => this.toggleCar());
    this.vk = {};
    const bind = (id, key) => {
      const el = document.getElementById(id);
      el.addEventListener('pointerdown', e => { e.preventDefault(); this.vk[key] = true; });
      ['pointerup', 'pointerleave', 'pointercancel'].forEach(t => el.addEventListener(t, () => { this.vk[key] = false; }));
    };
    bind('up', 'w'); bind('down', 's'); bind('left', 'a'); bind('right', 'd');
    document.getElementById('btnE').addEventListener('pointerdown', e => { e.preventDefault(); this.toggleCar(); });
    const fb = document.getElementById('btnFire'); // hold the fire button to keep shooting
    fb.addEventListener('pointerdown', e => { e.preventDefault(); this.fireHeld = true; });
    ['pointerup', 'pointerleave', 'pointercancel'].forEach(t => fb.addEventListener(t, () => { this.fireHeld = false; }));
    this.hornBtn = document.getElementById('btnHorn');
    this.hornBtn.addEventListener('pointerdown', () => this.honk());
    this.input.keyboard.on('keydown-H', () => this.honk());
    try { Sfx.init(); } catch (e) { console.warn('Audio disabled:', e); }
    window.changeTraffic = d => {
      if (d > 0) this.spawnTraffic(3);
      else if (this.traffic.length > 3) { this.traffic.splice(0, 3).forEach(c => c.spr.destroy()); this.label.innerText = this.traffic.length + ' CARS'; }
    };
    this.cameras.main.setZoom(RES).setBounds(0, 0, WORLD.w, WORLD.h).startFollow(this.pSpr, false, 0.12, 0.12); // the canvas is RES x bigger than the 800 x 600 view
  }

  toggleCar() {
    const P = this.player;
    if (P.inCar !== -1) {
      const car = this.cars[P.inCar];
      const nx = clamp(car.x + 42, 20, WORLD.w - 20), ny = clamp(car.y, 20, WORLD.h - 20);
      if (!isCollidingBuilding(nx - 7, ny - 7, 14, 14)) { P.x = nx; P.y = ny; } else { P.x = car.x - 42; P.y = car.y; }
      P.inCar = -1; this.sfx('door', 0.5); return;
    }
    const all = [...this.cars, ...this.traffic, ...this.police]; let near = -1, dist = 40;
    all.forEach((c, i) => { const d = Math.hypot(P.x - c.x, P.y - c.y); if (d < dist) { dist = d; near = i; } });
    if (near === -1) return;
    this.sfx('door', 0.5);
    const nc = this.cars.length, nt = this.traffic.length;
    if (near < nc) P.inCar = near;
    else if (near < nc + nt) {
      const s = this.traffic.splice(near - nc, 1)[0]; s.speed = 0;
      s.npc = false; // stolen: it is no longer driven by the AI
      this.cars.push(s); P.inCar = this.cars.length - 1;
      this.label.innerText = this.traffic.length + ' CARS';
      this.crime('theft', 1.5, 'CAR THEFT');
    } else {
      const s = this.police.splice(near - nc - nt, 1)[0]; s.speed = 0;
      Object.assign(s, { npc: false, police: false, pursuit: false }); s.spr.setTexture('cop_off');
      this.cars.push(s); P.inCar = this.cars.length - 1;
      this.crime('copcartheft', 3, 'STOLE A POLICE CAR');
    }
  }

  /* ---------- NPC car AI ---------- */
  // Each NPC car follows the centre of its lane from intersection to intersection. Rules, in order of priority:
  //  1. stop at the stop line on red / yellow (and do not enter an intersection that is jammed on the other side)
  //  2. keep a safe distance to the car in front
  //  3. give way to pedestrians (and the player on foot) in front of the car
  //  4. at every intersection go straight, turn left or turn right (never U-turn, never leave the map)
  //  5. overtake a car that the player abandoned in the lane; break deadlocks by driving through for a moment
  updateNpcCar(c, all, walkers, now) {
    const f = DIRS[c.dir], ghost = now < c.ghostUntil, inLane = c.mode === 'lane';
    const hx = Math.cos(c.angle), hy = Math.sin(c.angle); // real heading (differs from the lane direction while turning)
    let vt = c.cruise, s = Infinity, hold = false;        // vt = target speed, s = distance to the stop line

    // 1. traffic light
    if (inLane) {
      const pos = c.dir % 2 === 0 ? c.x : c.y;
      s = (stopCoord(c.dir, c.gi, c.gj) - pos) * (c.dir <= 1 ? 1 : -1) - (c.len / 2 - 16);   // long vehicles stop earlier
      if (s > -6) { // not past the stop line yet
        const state = this.lightState(c.gi, c.gj, c.dir % 2);
        if (state === 'red') hold = true;
        else if (state === 'yellow') hold = s > (c.speed * c.speed) / 0.18 + 4; // stop only if the car can still brake in time
        else if (s < 40 && this.exitBlocked(c, all)) hold = true;                // green, but there is no room on the other side
        if (hold) vt = Math.min(vt, Math.sqrt(0.09 * Math.max(0, s - 2)));       // brake smoothly towards the line
      }
    }

    // 2. keep distance to the car in front
    let gap = Infinity, blocker = null;
    if (!ghost) for (const o of all) {
      if (o === c || now < o.ghostUntil) continue;
      const same = Math.cos(o.angle) * hx + Math.sin(o.angle) * hy > 0.5;           // same direction = queueing behind it
      if (c.lat > 0 && o.npc && Math.cos(o.angle) * hx + Math.sin(o.angle) * hy < -0.5) continue; // while overtaking, oncoming NPCs give way
      if (!same && o.npc && o.id < c.id) continue; // crossing / oncoming conflict: the lower id gives way, so two cars never block each other
      const rx = o.x - c.x, ry = o.y - c.y, along = rx * hx + ry * hy, lat = Math.abs(-rx * hy + ry * hx);
      const half = (c.len + o.len) / 2;
      if (along > 8 && along < 110 && lat < (c.wid + o.wid) / 2 - 1 && along - half < gap) { gap = along - half; blocker = o; }
    }
    const vCar = Math.max(0, gap - 6) * 0.08;
    vt = Math.min(vt, vCar);

    // 3. pedestrians
    let pedGap = Infinity;
    for (const w of walkers) {
      const rx = w.x - c.x, ry = w.y - c.y, along = rx * hx + ry * hy;
      if (along > 6 && along < 90 && Math.abs(-rx * hy + ry * hx) < c.wid / 2 + 6) pedGap = Math.min(pedGap, along - c.len / 2);
    }
    vt = Math.min(vt, Math.max(0, pedGap - 10) * 0.06);

    // 5. overtaking an abandoned car
    if (inLane) this.handleBypass(c, all, blocker, gap, s, now);

    // speed control: the player's horn, slower in corners, smooth acceleration / braking
    if (now < c.waitUntil) vt = 0;
    if (!inLane) vt = Math.min(vt, 0.7);
    else if (c.nextDir !== c.dir && s < 70) vt = Math.min(vt, 0.5 + Math.max(0, s) * 0.012);
    c.speed += clamp(vt - c.speed, -0.12, 0.03);
    if (c.speed < 0.02 && vt < 0.02) c.speed = 0;

    // deadlock breaker: a car blocked by other cars for 15 s ignores them for 3 s
    if (c.speed < 0.05 && vCar < 0.05 && !hold) c.stuck++; else if (c.speed > 0.3) c.stuck = 0;
    if (c.stuck > 900) { c.ghostUntil = now + 3000; c.stuck = 0; }

    // movement
    if (inLane) {
      c.x += f.x * c.speed; c.y += f.y * c.speed;
      const ls = laneShift(c.dir); let sx = 0, sy = 0; // ease towards the lane centre (plus the overtaking shift)
      if (c.dir % 2 === 1) { sx = clamp(roadCenterX(c.gi) + ls.x - Math.sign(ls.x) * c.lat - c.x, -1, 1); c.x += sx; }
      else { sy = clamp(roadCenterY(c.gj) + ls.y - Math.sign(ls.y) * c.lat - c.y, -1, 1); c.y += sy; }
      c.angle = DIR_ANGLE[c.dir] + clamp((sx * -f.y + sy * f.x) / Math.max(0.4, c.speed), -0.5, 0.5);
      this.advanceNpc(c);
    } else this.driveTurn(c);
  }

  // 4. intersection logic: pass the centre going straight, or start the turning arc
  advanceNpc(c) {
    const f = DIRS[c.dir], cx = roadCenterX(c.gi), cy = roadCenterY(c.gj);
    if (c.nextDir === c.dir) {
      if ((c.x - cx) * f.x + (c.y - cy) * f.y >= 0) { // passed the middle of the intersection: head for the next one
        c.gi += f.x; c.gj += f.y; c.nextDir = pickDir(c.gi, c.gj, c.dir);
      }
      return;
    }
    // the turn starts on the arc that joins the current lane to the lane of the new direction
    const a = laneShift(c.dir), b = laneShift(c.nextDir), f2 = DIRS[c.nextDir];
    const px = cx + a.x + b.x, py = cy + a.y + b.y;                      // point where the two lane lines cross
    const R = (px - cx) * f.x + (py - cy) * f.y < 0 ? 12 : 18;           // tight turn (near lane) or wide turn (crossing the oncoming lane)
    const sx = px - f.x * R, sy = py - f.y * R;                          // start of the arc
    if ((c.x - sx) * f.x + (c.y - sy) * f.y >= 0) {
      c.mode = 'turn'; c.lat = 0; c.x = sx; c.y = sy;
      c.turn = { R, ox: sx + f2.x * R, oy: sy + f2.y * R, ax: -f2.x, ay: -f2.y, bx: f.x, by: f.y, phi: 0 };
    }
  }
  driveTurn(c) {
    const T = c.turn;
    T.phi = Math.min(Math.PI / 2, T.phi + c.speed / T.R);
    const co = Math.cos(T.phi), si = Math.sin(T.phi);
    c.x = T.ox + T.R * (T.ax * co + T.bx * si); c.y = T.oy + T.R * (T.ay * co + T.by * si);
    c.angle = Math.atan2(-T.ay * si + T.by * co, -T.ax * si + T.bx * co);
    if (T.phi >= Math.PI / 2) { // arc finished: continue in the new lane towards the next intersection
      c.dir = c.nextDir; c.gi += DIRS[c.dir].x; c.gj += DIRS[c.dir].y;
      c.nextDir = pickDir(c.gi, c.gj, c.dir); c.mode = 'lane'; c.turn = null; c.angle = DIR_ANGLE[c.dir];
    }
  }
  // true when a stopped car sits just behind the intersection in the lane this car wants to use
  exitBlocked(c, all) {
    const f2 = DIRS[c.nextDir], sh = laneShift(c.nextDir);
    const qx = roadCenterX(c.gi) + f2.x * 90 + sh.x, qy = roadCenterY(c.gj) + f2.y * 90 + sh.y;
    return all.some(o => o !== c && Math.abs(o.speed) < 0.3 && Math.hypot(o.x - qx, o.y - qy) < 28);
  }
  // overtake a stationary car that is not an NPC (e.g. one the player left in the lane) when the oncoming lane is free
  handleBypass(c, all, blocker, gap, s, now) {
    const f = DIRS[c.dir], ls = laneShift(c.dir), tc = { x: -Math.sign(ls.x), y: -Math.sign(ls.y) }; // tc = towards the road centre
    if (c.lat === 0) {
      if (blocker && !blocker.npc && Math.abs(blocker.speed) < 0.2 && gap < 26 && c.speed < 0.1 && s > 130) {
        const clear = all.every(o => {
          const rx = o.x - c.x, ry = o.y - c.y, along = rx * f.x + ry * f.y, side = rx * tc.x + ry * tc.y;
          return o === c || along < -45 || along > 200 || side < 8 || side > 48;
        });
        if (++c.bypassWait > 40 && clear) c.lat = 22;
      } else c.bypassWait = 0;
    } else {
      const obstacleAlongside = all.some(o => {
        if (o === c || o.npc || Math.abs(o.speed) > 0.2) return false;
        const rx = o.x - c.x, ry = o.y - c.y, along = rx * f.x + ry * f.y, laneSide = c.lat + rx * tc.x + ry * tc.y;
        return along > -60 && along < 60 && Math.abs(laneSide) < 15;
      });
      if (s < 90 || !obstacleAlongside) c.lat = 0;
    }
  }

  /* ---------- pedestrian AI ---------- */
  // Pedestrians walk along the sidewalks from corner to corner. At every corner they continue straight, turn, or cross the road.
  // They only start crossing when the cars on that road have a red light and no moving car is close to the crosswalk.
  pickPedNext(node, heading) {
    const back = (heading + 2) % 4, opts = [];
    for (let d = 0; d < 4; d++) {
      const nb = pedNeighbor(node, d);
      if (!nb || d === back) continue;                                              // never turn around (unless it is a dead end)
      opts.push([{ nb, d }, (d === heading ? 5 : 2) * (nb.cross ? 0.6 : 1)]);       // prefer going straight, cross a bit less often
    }
    if (!opts.length) opts.push([{ nb: pedNeighbor(node, back), d: back }, 1]);
    return weightedPick(opts);
  }
  crossingBlocked(p, all) {
    const n = p.pending, g = pedNodePos(n), bx = g.x + p.off.x, by = g.y + p.off.y;
    if (this.lightState(n.i, n.j, n.axis) !== 'red') return true;
    return all.some(c => Math.abs(c.speed) > 0.35 && distToSegment(c.x, c.y, p.x, p.y, bx, by) < 55);
  }
  updatePed(p, all) {
    if (!p.alive) { p.deadTime--; return; }
    if (p.medic) { this.updateMedic(p); return; }
    if (p.injured) { this.updateInjured(p); return; }
    if (p.cop) { // officers hunt the player when he is wanted
      if (this.stars > 0 && this.respawnTimer <= 0) { this.updateCopChase(p); return; }
      if (p.state === 'chase') this.rejoinSidewalk(p);
    }
    if (p.scare > 0) p.scare--;
    for (const car of all) if (Math.abs(car.speed) > 1.6 && Math.hypot(p.x - car.x, p.y - car.y) < 70) { p.scare = 120; break; } // run from speeding cars

    if (p.state === 'idle') { if (p.scare > 0 || --p.wait <= 0) p.state = 'walk'; else return; }
    if (p.state === 'wait') { // standing at the curb, waiting to cross
      if (this.crossingBlocked(p, all)) return;
      p.to = p.pending; p.crossing = p.pending; p.pending = null; p.state = 'walk';
    }

    const goal = pedNodePos(p.to), tx = goal.x + p.off.x, ty = goal.y + p.off.y;
    let spd = p.speed * (p.scare > 0 ? 1.8 : 1);
    if (p.crossing && this.lightState(p.crossing.i, p.crossing.j, p.crossing.axis) !== 'red') spd = Math.max(spd, 1.3); // hurry up
    const dx = tx - p.x, dy = ty - p.y, dist = Math.hypot(dx, dy);
    if (dist > spd) {
      p.x += dx / dist * spd; p.y += dy / dist * spd; p.dir = Math.atan2(dy, dx);
      p.walk += spd; const fr = Math.floor(p.walk / 5) % 2;                       // alternate the two walking frames
      if (fr !== p.frame) { p.frame = fr; p.spr.setTexture(`ped${p.type}_${fr}`); }
      p.spr.setRotation(p.dir);
    }
    else { // reached the next corner: decide where to go next
      p.x = tx; p.y = ty; p.from = p.to; p.crossing = null;
      const next = this.pickPedNext(p.from, p.heading);
      p.heading = next.d;
      if (next.nb.cross) { p.pending = next.nb; p.state = 'wait'; }
      else { p.to = next.nb; if (p.scare <= 0 && Math.random() < 0.25) { p.state = 'idle'; p.wait = 40 + randInt(120); } }
    }
    p.spr.setPosition(p.x, p.y);
  }

  // bounding box of a car (a little smaller than the body) used for walls; x / y = where the car would be
  carBox(c, x = c.x, y = c.y) {
    const co = Math.abs(Math.cos(c.angle)), si = Math.abs(Math.sin(c.angle)), w = (co * c.len + si * c.wid) * 0.9, h = (si * c.len + co * c.wid) * 0.9;
    return [x - w / 2, y - h / 2, w, h];
  }
  // true when a point lies inside the body of a car (margin = extra room around it)
  pointInCar(px, py, c, margin = 0) {
    const rx = px - c.x, ry = py - c.y, co = Math.cos(c.angle), si = Math.sin(c.angle);
    return Math.abs(rx * co + ry * si) < c.len / 2 + margin && Math.abs(-rx * si + ry * co) < c.wid / 2 + margin;
  }
  // the car body (not a circle) decides who gets hit, so cars passing along a sidewalk never hit pedestrians
  carHitsPed(car, p) {
    const rx = p.x - car.x, ry = p.y - car.y, co = Math.cos(car.angle), si = Math.sin(car.angle);
    return Math.abs(rx * co + ry * si) < car.len / 2 + 6 && Math.abs(-rx * si + ry * co) < car.wid / 2 + 5;
  }

  /* ---------- game loop (called by Phaser every frame) ---------- */
  update() {
    const now = this.time.now;
    const K = this.k, V = this.vk, P = this.player;
    const frozen = this.respawnTimer > 0; // BUSTED / WASTED screen: no control for a moment
    const my = frozen ? 0 : ((K.S.isDown || K.DOWN.isDown || V.s) ? 1 : 0) - ((K.W.isDown || K.UP.isDown || V.w) ? 1 : 0);
    const mx = frozen ? 0 : ((K.D.isDown || K.RIGHT.isDown || V.d) ? 1 : 0) - ((K.A.isDown || K.LEFT.isDown || V.a) ? 1 : 0);
    const all = [...this.cars, ...this.traffic, ...this.police, ...this.ambulances];
    this.pMoving = !!(mx || my);
    if (!frozen && (K.SPACE.isDown || K.F.isDown || this.fireHeld)) this.fire();

    // the horn button is only visible inside a car (visibility keeps the position of the E button stable)
    const inCar = P.inCar !== -1;
    if (inCar !== this.hornOn) { this.hornOn = inCar; this.hornBtn.style.visibility = inCar ? 'visible' : 'hidden'; }

    if (P.inCar !== -1) {
      const c = this.cars[P.inCar], sg = Math.sign(c.speed || 1), T = CAR_TYPES[c.type] || CAR_TYPES.sedan;
      if (my < 0) c.speed += 0.18 * T.acc; if (my > 0) c.speed -= 0.18 * T.acc;
      if (mx < 0) c.angle -= 0.04 * T.turn * sg; if (mx > 0) c.angle += 0.04 * T.turn * sg;
      c.speed = clamp(c.speed * 0.96, -T.max * 0.75, T.max);
      if (Math.abs(c.speed) < 0.05) c.speed = 0;
      const nx = clamp(c.x + Math.cos(c.angle) * c.speed, 20, WORLD.w - 20);
      const ny = clamp(c.y + Math.sin(c.angle) * c.speed, 20, WORLD.h - 20);
      if (!isCollidingBuilding(...this.carBox(c, nx, ny))) {
        const fx = nx + Math.cos(c.angle) * (c.len / 2 + 10), fy = ny + Math.sin(c.angle) * (c.len / 2 + 10);
        const hit = all.find(o => o !== c && this.pointInCar(fx, fy, o, 3));
        if (!hit) { c.x = nx; c.y = ny; } else { if (Math.abs(c.speed) > 1) this.crash(); if (Math.abs(c.speed) > 1.4) this.carCrash(hit); c.speed *= 0.4; }
      } else { if (Math.abs(c.speed) > 1) this.crash(); c.speed *= -0.3; }
      P.x = c.x; P.y = c.y;
      const kmh = Math.abs(Math.floor(c.speed * 18));
      this.hud.innerHTML = `${T.name}<br><span style="color:${kmh > SPEED_LIMIT ? '#ff6b6b' : '#fff'}">${kmh} KM/H</span> <span class="dim">LIMIT ${SPEED_LIMIT}</span>`;
      Sfx.engineSet(Math.abs(c.speed) / T.max);
    } else {
      const nx = clamp(P.x + mx * 1.9, 10, WORLD.w - 10), ny = clamp(P.y + my * 1.9, 10, WORLD.h - 10);
      if (mx || my) P.angle = Math.atan2(my, mx);
      if (!isCollidingBuilding(nx - 7, ny - 7, 14, 14)) { P.x = nx; P.y = ny; }
      this.hud.innerHTML = 'CITIZEN NPC';
      Sfx.engineSet(null);
    }

    // NPC cars
    const walkers = this.peds.filter(p => p.alive); if (P.inCar === -1) walkers.push(P);
    this.traffic.forEach(c => this.updateNpcCar(c, all, walkers, now));
    this.updatePoliceCars(all, walkers, now);
    this.updateAmbulances(all, walkers, now);

    // car-to-car collisions
    for (let i = 0; i < all.length; i++) for (let j = i + 1; j < all.length; j++) {
      const a = all[i], b = all[j], d = Math.hypot(b.x - a.x, b.y - a.y);
      if (!isFinite(d) || d > (a.len + b.len) / 2 + 4 || now < a.ghostUntil || now < b.ghostUntil) continue;
      this.collideCars(a, b, now);
    }
    if (P.inCar !== -1) { P.x = this.cars[P.inCar].x; P.y = this.cars[P.inCar].y; }

    // pedestrians
    this.peds.forEach(p => {
      this.updatePed(p, all);
      if (!p.alive) return;
      if (p.hitCd > 0) p.hitCd--;
      else for (const car of all) if (Math.abs(car.speed) > 0.9 && !(car.police && p.cop) && !(car.ambulance && (p.medic || p.injured)) && this.carHitsPed(car, p)) {
        p.hitCd = 25; car.speed *= 0.5;
        if (p.cop) this.killPed(p); else this.hurtPed(p, p.injured ? 999 : 30 + 40 * Math.abs(car.speed * 2));   // fast hits kill, slower ones only injure
        if (car === this.playerCar()) this.crime('runover', p.cop ? 4 : 3, p.cop ? 'KILLED A POLICE OFFICER' : 'RAN OVER A PEDESTRIAN');
        break;
      }
    });
    this.peds = this.peds.filter(p => { if (!p.alive && p.deadTime <= 0) { p.spr.destroy(); return false; } return true; });
    this.bloods = this.bloods.filter(b => { if (--b.life <= 0) { b.spr.destroy(); return false; } return true; });
    while (this.peds.filter(p => p.alive && !p.cop && !p.medic).length < 12) this.peds.push(this.newPed());
    this.updateBullets(all);
    this.updateWanted(all);
    this.drawMedical();

    // synchronise sprites
    all.forEach(c => c.spr.setPosition(c.x, c.y).setRotation(c.angle));
    this.pSpr.setPosition(P.x, P.y).setRotation(P.angle).setVisible(P.inCar === -1);
    this.drawLights();
    this.drawMinimap(all);
  }

  drawMinimap(all) {
    const m = this.mini, MM = 96, s = MM / WORLD.w, v = this.cameras.main.worldView;
    m.clearRect(0, 0, MM, MM); m.fillStyle = '#2d3436'; m.fillRect(0, 0, MM, MM);
    m.fillStyle = '#6b767a';
    roadsX.forEach(x => m.fillRect(x * s, 0, ROAD_W * s, MM)); roadsY.forEach(y => m.fillRect(0, y * s, MM, ROAD_W * s));
    buildings.forEach(b => { m.fillStyle = b.color; m.fillRect(b.x * s, b.y * s, b.w * s, b.h * s); });
    all.forEach(c => { m.fillStyle = c.police ? '#4da3ff' : c.ambulance ? '#3be38a' : c.npc ? '#e6e6e6' : '#ffd32a'; m.fillRect(c.x * s - 1.2, c.y * s - 1.2, 2.4, 2.4); }); // yellow = cars you can drive
    this.peds.forEach(p => { m.fillStyle = !p.alive ? '#ff3b3b' : p.injured ? '#ff8f8f' : p.medic ? '#3be38a' : p.cop ? '#4da3ff' : '#ffdbac'; m.fillRect(p.x * s - 0.8, p.y * s - 0.8, 1.6, 1.6); });
    m.fillStyle = '#00e5d4'; m.beginPath(); m.arc(this.player.x * s, this.player.y * s, 2.4, 0, 6.28); m.fill();
    m.strokeStyle = 'rgba(255,255,255,0.9)'; m.lineWidth = 1; m.strokeRect(v.x * s, v.y * s, v.width * s, v.height * s);
  }
}
