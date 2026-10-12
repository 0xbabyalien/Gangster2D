// Injuries, ambulances and paramedics (extends GameScene; loaded after police.js)
//
//  * A pedestrian hit by a car or a bullet is usually only INJURED: he lies on the ground, bleeds, and dies when the timer
//    runs out. A second hit (or a very fast car) kills at once.
//  * An ambulance is dispatched to every injured person. It drives there (free driving, like the police in pursuit),
//    two paramedics jump out, treat the person, and the person gets up and walks away. Then the ambulance leaves.
//  * If the ambulance arrives too late, the person is dead and the paramedics go home.

const BLEED_TIME = 1500;   // frames an injured person survives without help (25 s)
const TREAT_TIME = 300;    // treatment points needed (each paramedic adds 1 per frame)
const MAX_AMBULANCES = 3;

Object.assign(GameScene.prototype, {
  initMedical() {
    this.ambulances = []; this.medCd = 0;
    this.medGfx = this.add.graphics().setDepth(3.5);
  },

  /* ---------- injuries ---------- */
  // damage a pedestrian: injured first, dead when the damage is too much. Returns true when he died.
  hurtPed(p, dmg) {
    if (!p.alive) return false;
    if (p.medic) { this.killPed(p); return true; }
    p.hp -= dmg;
    if (p.hp <= 0) { this.killPed(p); return true; }
    if (!p.injured) {
      Object.assign(p, { injured: true, bleed: dmg > 80 ? 1000 : BLEED_TIME, treat: 0, ambulance: null, state: 'injured', pending: null, crossing: null });
      p.spr.setTexture('dead').setRotation(p.dir);                                  // lying on the ground
      this.addBlood(p.x, p.y, 10); this.sfx('hit', 0.6);
    } else this.sfx('hit', 0.4);
    return false;
  },
  updateInjured(p) { // lying there: bleeding, dying
    if (--p.bleed % 80 === 0) this.addBlood(p.x + Math.random() * 6 - 3, p.y + Math.random() * 6 - 3, 6);
    if (p.bleed <= 0) this.killPed(p);
  },
  healPed(v) { // treated: gets up and limps away, frightened
    Object.assign(v, { injured: false, hp: 50, treat: 0, bleed: 0, ambulance: null, speed: 0.45, scare: 220 });
    v.spr.setTexture(`ped${v.type}_0`);
    this.rejoinSidewalk(v);
    this.toast('LIFE SAVED', 'info');
  },
  drawMedical() { // bars above injured people: red = time left, green = treatment progress
    const g = this.medGfx; g.clear();
    this.peds.forEach(p => {
      if (!p.alive || !p.injured) return;
      const x = p.x - 8, y = p.y - 12;
      g.fillStyle(0x000000, 0.55).fillRect(x - 1, y - 1, 18, p.treat > 0 ? 7 : 4);
      g.fillStyle(0xe74c3c).fillRect(x, y, 16 * clamp(p.bleed / BLEED_TIME, 0, 1), 2);
      if (p.treat > 0) g.fillStyle(0x2ecc71).fillRect(x, y + 3, 16 * clamp(p.treat / TREAT_TIME, 0, 1), 2);
    });
  },

  /* ---------- ambulances ---------- */
  updateAmbulances(all, walkers, now) {
    if (this.medCd > 0) this.medCd--;
    if (this.medCd <= 0 && this.ambulances.length < MAX_AMBULANCES) {
      const v = this.peds.find(p => p.alive && p.injured && !p.ambulance);
      if (v) { this.spawnAmbulance(v); this.medCd = 90; }
    }
    this.ambulances.forEach(a => this.driveAmbulance(a, all, walkers, now));
    this.ambulances = this.ambulances.filter(a => {
      if (!a.done) return true;
      a.medics.forEach(m => { m.alive = false; m.deadTime = 0; });
      if (a.victim) a.victim.ambulance = null;
      a.spr.destroy(); return false;
    });
  },
  spawnAmbulance(v) { // appears on a road out of sight and heads for the victim
    const P = this.player, all = [...this.cars, ...this.traffic, ...this.police, ...this.ambulances];
    let sp, tries = 0;
    do { sp = randomLaneSpawn(); tries++; }
    while (tries < 100 && (Math.hypot(sp.x - v.x, sp.y - v.y) < (tries < 60 ? 450 : 250) || (tries < 60 && Math.hypot(sp.x - v.x, sp.y - v.y) > 800) || Math.hypot(sp.x - P.x, sp.y - P.y) < (tries < 80 ? 560 : 300)
      || all.some(o => Math.hypot(o.x - sp.x, o.y - sp.y) < 60)));
    const a = { x: sp.x, y: sp.y, angle: DIR_ANGLE[sp.dir], speed: 1.5, color: '#ffffff', type: 'ambulance', len: 38, wid: 17, spr: this.sprite(sp.x, sp.y, 'amb_0', 2).setRotation(DIR_ANGLE[sp.dir]) };
    Object.assign(a, { ambulance: true, npc: true, id: ++this.carIds, mode: 'chase', state: 'respond', victim: v, medics: [], flash: 0, phase: 0,
      wp: null, noLos: 0, blockedFrames: 0, age: 0, done: false, ghostUntil: 0, waitUntil: 0 });
    v.ambulance = a; this.ambulances.push(a);
    if (Math.hypot(v.x - P.x, v.y - P.y) < 600) this.toast('AMBULANCE DISPATCHED', 'info');
  },
  driveAmbulance(a, all, walkers, now) {
    const P = this.player, v = a.victim;
    a.age++; a.flash++;
    if (a.state === 'respond') {
      if (!v || !v.alive || !v.injured) { a.state = 'leave'; a.victim = null; }       // died or already helped: nothing to do
      else if (this.driveFree(a, v, 2.8, 40, walkers) < 48) { a.state = 'treat'; this.deployMedics(a); }
      if (a.age > 2400) a.done = true;
    }
    if (a.state === 'treat') {
      a.speed = 0;                                                                   // parked while the paramedics work
      a.medics = a.medics.filter(m => m.alive);
      if (!a.medics.length) { a.state = 'leave'; if (a.victim) a.victim.ambulance = null; a.victim = null; }
    } else if (a.state === 'leave') {
      this.driveFree(a, null, 1.6, 0, walkers);
      const d = Math.hypot(a.x - P.x, a.y - P.y);
      if ((d > 650 && a.age > 400) || d > 1000 || a.age > 3600) a.done = true;
    }
    const ph = a.state === 'respond' ? (a.flash >> 3) & 1 : -1;                      // lights flash while on a mission
    if (ph !== a.phase) { a.phase = ph; a.spr.setTexture(ph < 0 ? 'amb_off' : 'amb_' + ph); }
  },
  ambulanceLevel() { // loudness of the ambulance siren (0 = silent)
    let near = Infinity; const P = this.player;
    for (const a of this.ambulances) if (a.state === 'respond') near = Math.min(near, Math.hypot(a.x - P.x, a.y - P.y));
    return near < 800 ? 0.8 * (1 - near / 800) : 0;
  },

  /* ---------- paramedics ---------- */
  deployMedics(a) { // two paramedics step out at the side of the ambulance
    a.medics = [];
    const sx = -Math.sin(a.angle), sy = Math.cos(a.angle);
    for (let k = 0; k < 2; k++) {
      const x = a.x + sx * (k ? 12 : -12), y = a.y + sy * (k ? 12 : -12);
      const m = { x, y, dir: a.angle, alive: true, deadTime: 0, type: 4, medic: true, cop: false, hp: 100, walk: 0, frame: 0, amb: a, victim: a.victim,
        state: 'toVictim', scare: 0, off: { x: 0, y: 0 }, spr: this.sprite(x, y, 'ped4_0', 3) };
      a.medics.push(m); this.peds.push(m);
    }
    this.sfx('door', 0.4);
  },
  updateMedic(m) {
    const a = m.amb, v = m.victim;
    if (!a || a.done) { m.alive = false; m.deadTime = 0; return; }
    if (m.state !== 'back' && (!v || !v.alive || !v.injured)) m.state = 'back';     // nothing left to do: back to the ambulance
    if (m.state === 'toVictim') {
      if (Math.hypot(v.x - m.x, v.y - m.y) > 11) this.moveCop(m, v.x, v.y, 1.6); else m.state = 'treat';
    } else if (m.state === 'treat') {
      m.dir = Math.atan2(v.y - m.y, v.x - m.x);
      if (++v.treat >= TREAT_TIME) this.healPed(v);
    } else if (Math.hypot(a.x - m.x, a.y - m.y) > 18) this.moveCop(m, a.x, a.y, 1.7);
    else { m.alive = false; m.deadTime = 0; }                                         // back in the ambulance
    m.spr.setPosition(m.x, m.y).setRotation(m.dir);
  }
});
