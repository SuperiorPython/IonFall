// Galaxy data and generation. No drawing happens here.
// Everything is a plain object so the map can later be saved, mirrored, or fed to an AI.

const WORLD_SCALE = 2.2;                       // the map is this much bigger than the first 1600 x 900 version
const WORLD_W = Math.round(1600 * WORLD_SCALE);
const WORLD_H = Math.round(900 * WORLD_SCALE);
const DEFAULT_SEED = 20271029;

// Every section is a territory: a core circle (where the planets live) plus the land around it that it claims.
const PIECE_PAD = 40;                           // room kept between a core circle and the map edge or a lane
const GAP = 12;                                 // least space between two core circles

// Small, fast, seedable random number generator. Same seed = same map every time.
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------- galaxy shape ----------
// A two-armed spiral. Nothing is mirrored: every seed gives a different, lopsided galaxy.
// Fairness is checked instead of guaranteed: several candidate galaxies are generated and the most balanced wins.
const CX = WORLD_W / 2;
const CY = WORLD_H / 2;
const ARM_RX = 1485;           // how far an arm reaches sideways, in world units
const ARM_SQUASH = 0.6;        // the galaxy is a flattened disc, so up/down reach is 60% of sideways
const SECTIONS_PER_ARM = 10;   // the home section plus 9 more, per side
const NEBULA_COUNT = 12;
const CANDIDATES = 24;         // balanced galaxies to compare per seed

// Where an arm is at t (0 = core, 1 = outer tip).
function armPoint(arm, t) {
  const th = arm.base + arm.twist * t;
  const R = t * ARM_RX;
  return { x: CX + R * Math.cos(th), y: CY + R * Math.sin(th) * ARM_SQUASH };
}

// ---------- geometry helpers ----------

function distToSegment(px, py, ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  const len2 = dx * dx + dy * dy;
  let t = len2 === 0 ? 0 : ((px - ax) * dx + (py - ay) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(ax + t * dx - px, ay + t * dy - py);
}

// True if segment a-b properly crosses segment c-d (touching at an end does not count).
function segmentsCross(a, b, c, d) {
  const o = (p, q, r) => (q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x);
  const d1 = o(c, d, a);
  const d2 = o(c, d, b);
  const d3 = o(a, b, c);
  const d4 = o(a, b, d);
  if (d1 === 0 || d2 === 0 || d3 === 0 || d4 === 0) return false;
  return (d1 > 0) !== (d2 > 0) && (d3 > 0) !== (d4 > 0);
}

// Everything that would make the map look or play wrong. An empty list means the layout is clean.
function layoutProblems(sections, lanes) {
  const problems = [];
  const byId = {};
  sections.forEach((s) => { byId[s.id] = s; });

  for (let i = 0; i < sections.length; i++) {
    const a = sections[i];
    const reach = a.r + PIECE_PAD;
    if (a.x - reach < 4 || a.x + reach > WORLD_W - 4 || a.y - reach < 28 || a.y + reach > WORLD_H - 4) {
      problems.push('outside the map: ' + a.id);
    }
    for (let j = i + 1; j < sections.length; j++) {
      const b = sections[j];
      if (Math.hypot(a.x - b.x, a.y - b.y) < a.r + b.r + GAP - 2) problems.push('too close: ' + a.id + ' ' + b.id);
    }
  }

  for (const l of lanes) {
    const a = byId[l.a];
    const b = byId[l.b];
    for (const s of sections) {
      if (s === a || s === b) continue;
      if (distToSegment(s.x, s.y, a.x, a.y, b.x, b.y) < s.r + PIECE_PAD - 4) problems.push('lane ' + l.a + '-' + l.b + ' touches ' + s.id);
    }
  }

  for (let i = 0; i < lanes.length; i++) {
    for (let j = i + 1; j < lanes.length; j++) {
      const p = lanes[i];
      const q = lanes[j];
      if (p.a === q.a || p.a === q.b || p.b === q.a || p.b === q.b) continue; // they share a section
      if (segmentsCross(byId[p.a], byId[p.b], byId[q.a], byId[q.b])) problems.push('lanes cross: ' + p.a + '-' + p.b + ' and ' + q.a + '-' + q.b);
    }
  }
  return problems;
}

// ---------- planets ----------

// Scatter `count` bodies inside a circle without overlapping `existing` ones.
// Radius is rMin .. rMin + rSpan - 1.
// Planets keep clear of the piece edge (so puzzle tabs never touch them) and of the top strip (where the label sits).
function scatter(cx, cy, radius, count, rng, existing, rMin = 7, rSpan = 8) {
  const placed = existing.slice();
  const out = [];
  let tries = 0;
  while (out.length < count && tries < 5000) {
    tries++;
    const angle = rng() * Math.PI * 2;
    const dist = Math.sqrt(rng()) * (radius - 44);
    const x = cx + Math.cos(angle) * dist;
    const y = cy + Math.sin(angle) * dist;
    if (y - cy < -(radius - 62)) continue;
    const r = rMin + Math.floor(rng() * rSpan);
    let ok = true;
    for (const p of placed) {
      if (Math.hypot(p.x - x, p.y - y) < p.r + r + 14) { ok = false; break; }
    }
    if (ok) {
      const planet = { x, y, r };
      placed.push(planet);
      out.push(planet);
    }
  }
  return out;
}

// ---------- helpers for one candidate galaxy ----------

function pathDistances(ids, lanes, byId, from) {
  const dist = {};
  ids.forEach((id) => { dist[id] = Infinity; });
  dist[from] = 0;
  const done = {};
  for (let k = 0; k < ids.length; k++) {
    let u = null;
    for (const id of ids) if (!done[id] && (u === null || dist[id] < dist[u])) u = id;
    if (u === null || dist[u] === Infinity) break;
    done[u] = true;
    for (const l of lanes) {
      const v = l.a === u ? l.b : l.b === u ? l.a : null;
      if (v === null || !byId[v]) continue;
      const d = dist[u] + Math.hypot(byId[u].x - byId[v].x, byId[u].y - byId[v].y);
      if (d < dist[v]) dist[v] = d;
    }
  }
  return dist;
}

// Place one arm's sections. The home section sits near the outer tip, the rest are scattered along the arm.
function placeArm(side, arm, rng, taken) {
  const out = [];
  const normalAt = (t) => {
    const p = armPoint(arm, t);
    const q = armPoint(arm, t + 0.02);
    const len = Math.hypot(q.x - p.x, q.y - p.y) || 1;
    return { x: -(q.y - p.y) / len, y: (q.x - p.x) / len };
  };
  const fits = (x, y, r) => {
    const reach = r + PIECE_PAD;
    if (x - reach < 8 || x + reach > WORLD_W - 8 || y - reach < 34 || y + reach > WORLD_H - 8) return false;
    for (const s of taken.concat(out)) if (Math.hypot(s.x - x, s.y - y) < s.r + r + GAP) return false;
    return true;
  };
  for (let i = 0; i < SECTIONS_PER_ARM; i++) {
    const home = i === 0;
    let placed = null;
    for (let tries = 0; tries < 3000 && !placed; tries++) {
      const t = home ? 0.88 + rng() * 0.1 : 0.3 + rng() * 0.66;
      const lateral = (rng() + rng() + rng() - 1.5) * (home ? 150 : 410);
      const n = normalAt(t);
      const p = armPoint(arm, t);
      // sizes are random: big and small systems side by side (the home system is always one of the big ones)
      const r = home ? 120 + rng() * 22 : 84 + rng() * 50;
      const x = p.x + n.x * lateral;
      const y = p.y + n.y * lateral;
      if (fits(x, y, r)) placed = { x, y, r };
    }
    if (!placed) return null;
    out.push({ side, x: placed.x, y: placed.y, r: placed.r, home });
  }
  return out;
}

function planetsFor(section, rng) {
  const planets = [];
  let existing = [];
  if (section.home) {
    const home = { x: section.x, y: section.y + 14, r: 18, home: true };
    planets.push(home);
    existing = [home];
  }
  const want = section.home ? 4 + Math.floor(rng() * 2) : Math.max(2, Math.min(7, Math.round(section.r / 22) + Math.floor(rng() * 3) - 1));
  for (const p of scatter(section.x, section.y, section.r, want, rng, existing)) planets.push(p);
  return planets;
}

// Build one complete candidate galaxy, or return null if this attempt does not work out.
function buildCandidate(cseed) {
  const rng = mulberry32(cseed);
  const arms = [
    { side: 'A', base: Math.PI + (rng() - 0.5) * 0.4, twist: 0.45 + rng() * 0.25 },
    { side: 'B', base: 0 + (rng() - 0.5) * 0.4, twist: 0.45 + rng() * 0.25 },
  ];

  // The ion core sits near the middle, nudged a little off center.
  const middle = {
    id: 'M', side: 'N', home: false, ion: true,
    x: CX + (rng() - 0.5) * 150, y: CY + (rng() - 0.5) * 110, r: 150 + rng() * 26,
  };
  const taken = [middle];
  const armSections = {};
  for (const arm of arms) {
    const list = placeArm(arm.side, arm, rng, taken);
    if (!list) return null;
    list.forEach((s) => taken.push(s));
    armSections[arm.side] = list;
  }

  // Name them: home is 1, the rest are numbered outward from home.
  const sections = [];
  for (const side of ['A', 'B']) {
    const list = armSections[side];
    const home = list[0];
    const rest = list.slice(1).sort((p, q) => Math.hypot(p.x - home.x, p.y - home.y) - Math.hypot(q.x - home.x, q.y - home.y));
    [home].concat(rest).forEach((s, i) => {
      s.id = side + (i + 1);
      s.planets = planetsFor(s, rng);
      sections.push(s);
    });
  }

  // The ion section: a planet near its center plus a few more, all ion planets.
  const centerPlanet = { x: middle.x, y: middle.y + 18, r: 16, ion: true };
  middle.planets = [centerPlanet];
  for (const p of scatter(middle.x, middle.y, middle.r, 4, rng, [centerPlanet])) middle.planets.push({ x: p.x, y: p.y, r: p.r, ion: true });
  sections.push(middle);

  if (layoutProblems(sections, []).length) return null;

  // Lanes: a spanning tree of the shortest clear links, then a few extra links so there are loops and choices.
  const byId = {};
  sections.forEach((s) => { byId[s.id] = s; });
  const edges = [];
  for (let i = 0; i < sections.length; i++) {
    for (let j = i + 1; j < sections.length; j++) {
      const d = Math.hypot(sections[i].x - sections[j].x, sections[i].y - sections[j].y);
      if (d <= 770) edges.push({ a: sections[i].id, b: sections[j].id, d });
    }
  }
  edges.sort((p, q) => p.d - q.d);

  const lanes = [];
  const parent = {};
  sections.forEach((s) => { parent[s.id] = s.id; });
  const find = (x) => (parent[x] === x ? x : (parent[x] = find(parent[x])));
  const degree = {};
  const mk = (e) => ({ a: e.a, b: e.b, cross: byId[e.a].side !== byId[e.b].side && e.a !== 'M' && e.b !== 'M' });
  const clear = (e) => layoutProblems(sections, lanes.concat([mk(e)])).length === 0;
  const add = (e) => {
    lanes.push(mk(e));
    degree[e.a] = (degree[e.a] || 0) + 1;
    degree[e.b] = (degree[e.b] || 0) + 1;
  };
  const used = new Set();
  for (const e of edges) {
    if (find(e.a) === find(e.b)) continue;
    if (!clear(e)) continue;
    parent[find(e.a)] = find(e.b);
    add(e);
    used.add(e);
  }
  if (new Set(sections.map((s) => find(s.id))).size !== 1) return null;

  for (const e of edges) {
    if (used.has(e) || e.d > 650) continue;
    if ((degree[e.a] || 0) >= 4 || (degree[e.b] || 0) >= 4) continue;
    if (rng() < 0.45 && clear(e)) { add(e); used.add(e); }
  }
  // Long lanes between the two arms that go around the ion core: the slow way to win without it.
  const crossEdges = [];
  for (const a of sections.filter((s) => s.side === 'A')) {
    for (const b of sections.filter((s) => s.side === 'B')) {
      crossEdges.push({ a: a.id, b: b.id, d: Math.hypot(a.x - b.x, a.y - b.y) });
    }
  }
  crossEdges.sort((p, q) => p.d - q.d);
  const crossEnds = new Set();
  let crossAdded = lanes.filter((l) => l.cross).length;
  for (const e of crossEdges) {
    if (crossAdded >= 2) break;
    if (crossEnds.has(e.a) || crossEnds.has(e.b)) continue;
    if (lanes.some((l) => (l.a === e.a && l.b === e.b) || (l.a === e.b && l.b === e.a))) continue;
    if (!clear(e)) continue;
    add(e);
    crossEnds.add(e.a);
    crossEnds.add(e.b);
    crossAdded++;
  }

  // The ion core should be a real crossroads.
  for (const e of edges) {
    if ((degree.M || 0) >= 3) break;
    if (used.has(e) || (e.a !== 'M' && e.b !== 'M')) continue;
    if (clear(e)) { add(e); used.add(e); }
  }

  // You must be able to reach the enemy home without going through the ion section.
  const noM = lanes.filter((l) => l.a !== 'M' && l.b !== 'M');
  const reach = pathDistances(sections.map((s) => s.id).filter((id) => id !== 'M'), noM, byId, 'A1');
  if (!Number.isFinite(reach.B1)) return null;

  // Nebulae: scattered anywhere there is room, each linked to one or two nearby sections.
  const mains = sections.slice();
  const nebulae = [];
  let tries = 0;
  while (nebulae.length < NEBULA_COUNT && tries < 8000) {
    tries++;
    const r = 70 + rng() * 40;
    const reach = r + PIECE_PAD;
    const x = reach + 10 + rng() * (WORLD_W - 2 * reach - 20);
    const y = reach + 36 + rng() * (WORLD_H - 2 * reach - 46);
    const all = sections.concat(nebulae);
    if (all.some((s) => Math.hypot(s.x - x, s.y - y) < s.r + r + GAP)) continue;
    const lookup = Object.assign({}, byId);
    nebulae.forEach((n) => { lookup[n.id] = n; });
    if (lanes.some((l) => distToSegment(x, y, lookup[l.a].x, lookup[l.a].y, lookup[l.b].x, lookup[l.b].y) < r + PIECE_PAD)) continue;

    const neb = { id: 'T' + nebulae.length, side: 'N', x, y, r, home: false, nebula: true, planets: [] };
    const trial = all.concat([neb]);
    const near = mains.slice().sort((p, q) => Math.hypot(p.x - x, p.y - y) - Math.hypot(q.x - x, q.y - y)).slice(0, 6);
    const added = [];
    for (const s of near) {
      if (added.length >= 2) break;
      if (Math.hypot(s.x - x, s.y - y) > 740) break;
      const attempt = lanes.concat(added, [{ a: neb.id, b: s.id, cross: false }]);
      if (layoutProblems(trial, attempt).length === 0) added.push({ a: neb.id, b: s.id, cross: false });
    }
    if (!added.length) continue;

    const blobs = [];
    for (let i = 0; i < 7; i++) {
      const a = rng() * Math.PI * 2;
      const d = Math.sqrt(rng()) * 0.5;
      blobs.push({ dx: Math.cos(a) * d, dy: Math.sin(a) * d, rr: 0.45 + rng() * 0.3, a: 0.12 + rng() * 0.16 });
    }
    neb.blobs = blobs;
    neb.links = added;
    nebulae.push(neb);
    lanes.push(...added); // ids are renamed below, so keep a handle on these objects
    neb.laneObjs = added;
  }
  if (nebulae.length < NEBULA_COUNT) return null;

  // Number the nebulae from left to right and fix up their lane ends.
  nebulae.sort((p, q) => p.x - q.x);
  nebulae.forEach((n, i) => {
    const id = 'N' + (i + 1);
    n.laneObjs.forEach((l) => { l.a = id; });
    n.id = id;
    delete n.links;
    delete n.laneObjs;
    sections.push(n);
  });
  return { sections, lanes, arms };
}

// How even the two sides are. Lower score = fairer.
function balanceOf(cand) {
  const byId = {};
  cand.sections.forEach((s) => { byId[s.id] = s; });
  const ids = cand.sections.map((s) => s.id);
  const dA = pathDistances(ids, cand.lanes, byId, 'A1');
  const dB = pathDistances(ids, cand.lanes, byId, 'B1');
  const side = (sd, d, other) => {
    const mine = cand.sections.filter((s) => s.side === sd);
    let nebulaeCloser = 0;
    for (const n of cand.sections.filter((s) => s.nebula)) if (d[n.id] + 40 < other[n.id]) nebulaeCloser++;
    return {
      sections: mine.length,
      planets: mine.reduce((sum, s) => sum + s.planets.length, 0),
      toIon: Math.round(d.M),
      nebulaeCloser,
    };
  };
  const A = side('A', dA, dB);
  const B = side('B', dB, dA);
  const score = 4 * Math.abs(A.planets - B.planets) + Math.abs(A.toIon - B.toIon) / 15 + 5 * Math.abs(A.nebulaeCloser - B.nebulaeCloser);
  return { A, B, score: Math.round(score * 10) / 10 };
}


// ---------- territories ----------
// The whole map is divided into territories, like states on a map: every section borders its neighbours along a
// shared line, with no gaps between them. The borders are the cuts of a "power diagram" (bigger sections claim
// more land), then roughened with noise so they wander like real borders instead of running straight.
// Both sides of a border use the same points, so they always meet exactly. Shapes are plain point lists (s.shape)
// so drawing, clicking and tests all use the same outline.

const LAND_PAD = 44;       // how far the land reaches past the outermost sections
const WOBBLE = 22;         // how far borders wander off their straight line

function clipHalfPlane(poly, nx, ny, c, tag) {
  // keep the part where nx*x + ny*y <= c. A vertex's tag names the edge that leaves it.
  const out = [];
  const n = poly.length;
  for (let k = 0; k < n; k++) {
    const a = poly[k];
    const b = poly[(k + 1) % n];
    const da = nx * a.x + ny * a.y - c;
    const db = nx * b.x + ny * b.y - c;
    if (da <= 0 && db <= 0) {
      out.push({ x: a.x, y: a.y, tag: a.tag });
    } else if (da <= 0) {
      const t = da / (da - db);
      out.push({ x: a.x, y: a.y, tag: a.tag });
      out.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, tag });
    } else if (db <= 0) {
      const t = da / (da - db);
      out.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, tag: a.tag });
    }
  }
  return out;
}

function convexHull(points) {
  const pts = points.slice().sort((p, q) => p.x - q.x || p.y - q.y);
  const cross = (o, a, b) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
  const lower = [];
  for (const p of pts) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) lower.pop();
    lower.push(p);
  }
  const upper = [];
  for (let i = pts.length - 1; i >= 0; i--) {
    const p = pts[i];
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) upper.pop();
    upper.push(p);
  }
  lower.pop();
  upper.pop();
  return lower.concat(upper);
}

function pointInPolygon(poly, x, y) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i];
    const b = poly[j];
    if ((a.y > y) !== (b.y > y) && x < ((b.x - a.x) * (y - a.y)) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}

// How far from the section's center its outline is in direction (ux, uy): the outermost crossing.
function rayExit(section, ux, uy) {
  const poly = section.shape;
  let best = 0;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i];
    const b = poly[(i + 1) % poly.length];
    const ex = b.x - a.x;
    const ey = b.y - a.y;
    const den = ux * ey - uy * ex;
    if (Math.abs(den) < 1e-9) continue;
    const ax = a.x - section.x;
    const ay = a.y - section.y;
    const t = (ax * ey - ay * ex) / den;
    const s = (ax * uy - ay * ux) / den;
    if (t > 0 && s >= 0 && s <= 1 && t > best) best = t;
  }
  return best;
}

// Smooth random 2D field in 0..1 (value noise), the same everywhere for a given salt.
function makeNoise(salt) {
  const h = (ix, iy) => {
    let n = Math.imul(ix, 374761393) ^ Math.imul(iy, 668265263) ^ salt;
    n = Math.imul(n ^ (n >>> 13), 1274126177);
    return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
  };
  return (x, y, cell) => {
    const gx = x / cell;
    const gy = y / cell;
    const ix = Math.floor(gx);
    const iy = Math.floor(gy);
    const fx = gx - ix;
    const fy = gy - iy;
    const u = fx * fx * (3 - 2 * fx);
    const v = fy * fy * (3 - 2 * fy);
    const a = h(ix, iy) + (h(ix + 1, iy) - h(ix, iy)) * u;
    const b = h(ix, iy + 1) + (h(ix + 1, iy + 1) - h(ix, iy + 1)) * u;
    return a + (b - a) * v;
  };
}

function buildPieces(sections, seed) {
  const n = sections.length;
  const noiseX = makeNoise((seed ^ 0x2545f491) | 0);
  const noiseY = makeNoise((seed ^ 0x9e3779b9) | 0);
  const wobble = (x, y) => ({
    x: x + (noiseX(x, y, 90) - 0.5) * 2 * WOBBLE * 0.7 + (noiseX(x + 500, y, 34) - 0.5) * 2 * WOBBLE * 0.3,
    y: y + (noiseY(x, y, 90) - 0.5) * 2 * WOBBLE * 0.7 + (noiseY(x, y + 500, 34) - 0.5) * 2 * WOBBLE * 0.3,
  });

  // the land: a loose outline around every section (convex, so every territory is cut from the same shape)
  const ring = [];
  for (const s of sections) {
    for (let k = 0; k < 24; k++) {
      const ang = (k / 24) * Math.PI * 2;
      ring.push({ x: s.x + Math.cos(ang) * (s.r + LAND_PAD), y: s.y + Math.sin(ang) * (s.r + LAND_PAD) });
    }
  }
  const land = convexHull(ring);

  // each territory: the land, with a cut for every other section (no gap left between neighbours)
  const polys = sections.map((a, i) => {
    let poly = land.map((p) => ({ x: p.x, y: p.y, tag: 'coast' }));
    for (let j = 0; j < n; j++) {
      if (i === j) continue;
      const b = sections[j];
      const d = Math.hypot(b.x - a.x, b.y - a.y);
      const nx = (b.x - a.x) / d;
      const ny = (b.y - a.y) / d;
      const sM = (d * d + a.r * a.r - b.r * b.r) / (2 * d); // where the cut crosses the line between the two centers
      poly = clipHalfPlane(poly, nx, ny, a.x * nx + a.y * ny + sM, j);
    }
    return poly;
  });

  // roughen: split every border into short steps and push each point by the noise field. A shared border is split
  // from the same end by both territories, so both sides get identical points.
  const STEP = 14;
  const round1 = (v) => Math.round(v * 10) / 10;
  sections.forEach((s, i) => {
    const poly = polys[i];
    const out = [];
    for (let k = 0; k < poly.length; k++) {
      const p = poly[k];
      const q = poly[(k + 1) % poly.length];
      const flip = round1(p.x) > round1(q.x) || (round1(p.x) === round1(q.x) && round1(p.y) > round1(q.y));
      const a = flip ? q : p;
      const b = flip ? p : q;
      const steps = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / STEP));
      for (let m = 0; m < steps; m++) {
        const t = (flip ? steps - m : m) / steps; // always measured from the same end, whichever way we walk
        out.push(wobble(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t));
      }
    }
    s.shape = out.map((c) => ({ x: round1(c.x), y: round1(c.y) }));
    s.R = Math.max(...s.shape.map((c) => Math.hypot(c.x - s.x, c.y - s.y)));
  });
}

// ---------- the whole galaxy ----------

function generateGalaxy(seed) {
  if (seed === undefined || seed === null || Number.isNaN(seed)) seed = DEFAULT_SEED;
  let best = null;
  let found = 0;
  for (let i = 0; i < 3000 && found < CANDIDATES; i++) {
    const cand = buildCandidate((seed + Math.imul(i + 1, 0x9e3779b1)) >>> 0);
    if (!cand) continue;
    found++;
    cand.balance = balanceOf(cand);
    if (!best || cand.balance.score < best.balance.score) best = cand;
  }
  if (!best) throw new Error('Could not generate a galaxy for seed ' + seed);

  // Give every planet a stable name like "A5-3" (section id + position in that section).
  for (const s of best.sections) {
    s.planets.forEach((p, i) => { p.id = s.id + '-' + (i + 1); });
  }
  buildPieces(best.sections, seed);
  return { sections: best.sections, lanes: best.lanes, seed, arms: best.arms, balance: best.balance };
}
