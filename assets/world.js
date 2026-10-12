// World data & helpers (independent of Phaser)
const WORLD = { w: 2400, h: 2400 }, ROAD_W = 80;
const roadsX = [0, 400, 800, 1200, 1600, 2000], roadsY = [0, 400, 800, 1200, 1600, 2000];
const buildings = [], trees = [];
const PARKING_LOT = {};   // filled in below: the block next to the start position is a car park
const LOT_BAYS = 9;       // parking bays per row
const randInt = n => Math.floor(Math.random() * n);

/* ---------- road network settings ---------- */
const DRIVE_ON_LEFT = true;                       // set to false for right-hand traffic
const LANE_OFFSET = 14;                           // distance from the road centre line to the centre of a lane
const DIRS = [{ x: 1, y: 0 }, { x: 0, y: 1 }, { x: -1, y: 0 }, { x: 0, y: -1 }]; // 0 = east, 1 = south, 2 = west, 3 = north
const DIR_ANGLE = [0, Math.PI / 2, Math.PI, -Math.PI / 2];
const SIDEWALK_NEAR = 5, SIDEWALK_FAR = 82;       // pedestrian walking lines, measured from a road's left/top edge
const STOP_NEAR = 22, STOP_FAR = ROAD_W + 31;     // where a waiting car's centre stops, relative to the intersection box
const LIGHT_GREEN = 7000, LIGHT_YELLOW = 1500, LIGHT_CLEAR = 1000;   // traffic light timing (ms)
const LIGHT_HALF = LIGHT_GREEN + LIGHT_YELLOW + LIGHT_CLEAR, LIGHT_CYCLE = LIGHT_HALF * 2;

function addB(x, y, w, h, t, color) {
  const wins = []; // window positions are decided ONCE here (fixes the flickering windows bug)
  for (let wx = x + 8; wx < x + w - 8; wx += 18)
    for (let wy = y + 14; wy < y + h - 14; wy += 18) if (Math.random() > 0.4) wins.push([wx, wy]);
  // rooftop props and lit/unlit facade windows are also decided once, so the look never changes between redraws
  const props = Array.from({ length: 2 + randInt(2) }, () => ({ u: 0.12 + Math.random() * 0.66, v: 0.12 + Math.random() * 0.6 }));
  const lit = Array.from({ length: Math.max(1, Math.floor((w - 12) / 16)) }, () => Math.random() > 0.35);
  buildings.push({ x, y, w, h, t, color, wins, props, lit });
}
roadsX.forEach((rx, i) => roadsY.forEach((ry, j) => {
  if (i >= roadsX.length - 1 || j >= roadsY.length - 1) return;
  const bx = rx + ROAD_W, by = ry + ROAD_W, bw = 400 - ROAD_W, bh = 400 - ROAD_W, r = Math.random();
  if (i === 3 && j === 3) Object.assign(PARKING_LOT, { x: bx + 10, y: by + 10, w: bw - 20, h: bh - 20 }); // this block is a car park instead of buildings
  else if (r < 0.3) addB(bx + 10, by + 10, bw - 20, bh - 20, 2, ['#2c3e50', '#34495e', '#2f3542'][Math.floor(Math.random() * 3)]);
  else if (r < 0.6) {
    addB(bx + 10, by + 10, bw - 20, bh / 2 - 15, 1, '#e67e22');
    addB(bx + 10, by + bh / 2 + 5, bw - 20, bh / 2 - 15, 0, '#f1c40f');
  } else {
    const w2 = (bw - 30) / 2, h2 = (bh - 30) / 2;
    addB(bx + 10, by + 10, w2, h2, 0, '#c0392b');
    addB(bx + 20 + w2, by + 10, w2, h2, 0, '#2980b9');
    addB(bx + 10, by + 20 + h2, w2, h2, 1, '#27ae60');
    addB(bx + 20 + w2, by + 20 + h2, w2, h2, 0, '#8e44ad');
  }
  // trees stand on the outer part of the sidewalk (east side of a vertical road, south side of a horizontal road)
  for (let k = 0; k < 4; k++) { trees.push({ x: bx + 20 + k * 80, y: by - 2 }); trees.push({ x: bx - 2, y: by + 20 + k * 80 }); }
}));

// palette used for cars (parked cars and NPC traffic)
const CAR_COLORS = ['#e74c3c', '#e67e22', '#f1c40f', '#2ecc71', '#16a085', '#1abc9c', '#3498db', '#2980b9', '#9b59b6', '#8e44ad',
  '#e84393', '#fd79a8', '#ecf0f1', '#b2bec3', '#636e72', '#2d3436', '#c0392b', '#6c5ce7', '#00cec9', '#badc58',
  '#ffbe76', '#a0522d', '#0984e3', '#7f8c3a'];

// decorative trees in the park area east and south of the street grid (between the road strips)
for (let k = 0; k < 70; k++) {
  if (k % 2) trees.push({ x: 2110 + Math.random() * 270, y: roadsY[randInt(roadsY.length)] + 100 + Math.random() * 280 });
  else trees.push({ x: roadsX[randInt(roadsX.length)] + 100 + Math.random() * 280, y: 2110 + Math.random() * 270 });
}

const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
const hex = c => parseInt(c.slice(1), 16);
function isCollidingBuilding(x, y, w, h) {
  for (const b of buildings) if (x < b.x + b.w && x + w > b.x && y < b.y + b.h && y + h > b.y) return true;
  return false;
}
function weightedPick(list) { // list of [value, weight]
  let r = Math.random() * list.reduce((a, e) => a + e[1], 0);
  for (const e of list) { r -= e[1]; if (r <= 0) return e[0]; }
  return list[list.length - 1][0];
}
function distToSegment(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy;
  const t = l2 ? clamp(((px - ax) * dx + (py - ay) * dy) / l2, 0, 1) : 0;
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

/* ---------- road network (cars) ---------- */
const roadCenterX = i => roadsX[i] + ROAD_W / 2;
const roadCenterY = j => roadsY[j] + ROAD_W / 2;
const inGrid = (i, j) => i >= 0 && j >= 0 && i < roadsX.length && j < roadsY.length;

// offset of the lane used by a car heading in direction d (relative to the road centre line)
function laneShift(d) {
  const side = DRIVE_ON_LEFT ? 1 : -1, f = DIRS[d];
  return { x: f.y * LANE_OFFSET * side, y: -f.x * LANE_OFFSET * side }; // "left of the heading" is (f.y, -f.x)
}
// coordinate (x or y) where a car heading in direction d stops in front of intersection (gi, gj)
function stopCoord(d, gi, gj) {
  if (d === 0) return roadsX[gi] - STOP_NEAR;
  if (d === 2) return roadsX[gi] + STOP_FAR;
  if (d === 1) return roadsY[gj] - STOP_NEAR;
  return roadsY[gj] + STOP_FAR;
}
// where the traffic light for cars heading in direction d is drawn (on the sidewalk next to the stop line)
function lightPos(d, i, j) {
  const x0 = roadsX[i], y0 = roadsY[j], ls = laneShift(d), sx = Math.sign(ls.x), sy = Math.sign(ls.y);
  if (d === 1) return { x: x0 + ROAD_W / 2 + sx * 32, y: y0 - 8 };
  if (d === 3) return { x: x0 + ROAD_W / 2 + sx * 32, y: y0 + ROAD_W + 8 };
  if (d === 0) return { x: x0 - 8, y: y0 + ROAD_W / 2 + sy * 32 };
  return { x: x0 + ROAD_W + 8, y: y0 + ROAD_W / 2 + sy * 32 };
}
// choose the next move at intersection (gi, gj) for a car arriving with direction d (no U-turns, stay inside the grid)
function pickDir(gi, gj, d) {
  const opts = [[d, 6], [(d + 3) % 4, 2], [(d + 1) % 4, 2]]; // straight, left, right
  return weightedPick(opts.filter(o => inGrid(gi + DIRS[o[0]].x, gj + DIRS[o[0]].y)));
}
// random position in the correct lane, somewhere between two intersections
function randomLaneSpawn() {
  const vertical = Math.random() > 0.5;
  const road = randInt(vertical ? roadsX.length : roadsY.length);
  const seg = randInt((vertical ? roadsY.length : roadsX.length) - 1); // segment between intersection seg and seg + 1
  const dir = vertical ? (Math.random() > 0.5 ? 1 : 3) : (Math.random() > 0.5 ? 0 : 2);
  const sh = laneShift(dir), forward = dir <= 1, along = 140 + Math.random() * 200;
  if (vertical) return { x: roadCenterX(road) + sh.x, y: roadsY[seg] + along, dir, gi: road, gj: forward ? seg + 1 : seg };
  return { x: roadsX[seg] + along, y: roadCenterY(road) + sh.y, dir, gi: forward ? seg + 1 : seg, gj: road };
}
// parking bays of the car park: two rows (top row nose to the north, bottom row nose to the south)
function parkingSlots() {
  const L = PARKING_LOT, step = L.w / LOT_BAYS, out = [];
  for (let k = 0; k < LOT_BAYS; k++) {
    out.push({ x: L.x + (k + 0.5) * step, y: L.y + 27, angle: -Math.PI / 2 });
    out.push({ x: L.x + (k + 0.5) * step, y: L.y + L.h - 27, angle: Math.PI / 2 });
  }
  return out;
}

/* ---------- sidewalk network (pedestrians) ----------
   Nodes are the four sidewalk corners of every intersection: { i, j, qx, qy } with qx / qy = 0 (near side) or 1 (far side).
   Neighbours are either the next corner along the sidewalk, or the opposite corner of the same intersection (a crosswalk). */
function pedNodePos(n) {
  return { x: roadsX[n.i] + (n.qx ? SIDEWALK_FAR : SIDEWALK_NEAR), y: roadsY[n.j] + (n.qy ? SIDEWALK_FAR : SIDEWALK_NEAR) };
}
// neighbour of node n in direction d (0 = east, 1 = south, 2 = west, 3 = north); axis = traffic axis being crossed (1 = N-S, 0 = E-W)
function pedNeighbor(n, d) {
  const lastI = roadsX.length - 1, lastJ = roadsY.length - 1;
  if (d === 0) return n.qx === 0 ? { i: n.i, j: n.j, qx: 1, qy: n.qy, cross: true, axis: 1 }
    : n.i < lastI ? { i: n.i + 1, j: n.j, qx: 0, qy: n.qy, cross: false, axis: -1 } : null;
  if (d === 2) return n.qx === 1 ? { i: n.i, j: n.j, qx: 0, qy: n.qy, cross: true, axis: 1 }
    : n.i > 0 ? { i: n.i - 1, j: n.j, qx: 1, qy: n.qy, cross: false, axis: -1 } : null;
  if (d === 1) return n.qy === 0 ? { i: n.i, j: n.j, qx: n.qx, qy: 1, cross: true, axis: 0 }
    : n.j < lastJ ? { i: n.i, j: n.j + 1, qx: n.qx, qy: 0, cross: false, axis: -1 } : null;
  return n.qy === 1 ? { i: n.i, j: n.j, qx: n.qx, qy: 0, cross: true, axis: 0 }
    : n.j > 0 ? { i: n.i, j: n.j - 1, qx: n.qx, qy: 1, cross: false, axis: -1 } : null;
}
