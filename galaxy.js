// Galaxy data and generation. No drawing happens here.
// Everything is a plain object so the map can later be saved, mirrored, or fed to an AI.

const WORLD_W = 1600;
const WORLD_H = 900;

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

// Side A (left) sections. Side B (right) is mirrored from these, so both sides are identical.
// x, y, r are in world units (1600 x 900). planets = how many planets the section holds.
const SIDE_A = [
  { n: 1, x: 150, y: 450, r: 85, planets: 4, home: true },
  { n: 2, x: 330, y: 260, r: 75, planets: 3 },
  { n: 3, x: 330, y: 640, r: 75, planets: 3 },
  { n: 4, x: 560, y: 130, r: 80, planets: 4 },
  { n: 5, x: 500, y: 450, r: 90, planets: 5 },
  { n: 6, x: 560, y: 770, r: 80, planets: 4 },
];

// The ion section sits in the middle and belongs to nobody at the start.
const MIDDLE = { id: 'M', x: WORLD_W / 2, y: WORLD_H / 2, r: 110 };

// Lanes inside one side (numbers refer to SIDE_A). The same set is mirrored for side B.
const SIDE_LANES = [
  [1, 2], [1, 3], [1, 5],
  [2, 4], [2, 5],
  [3, 5], [3, 6],
  [4, 'M'], [5, 'M'], [6, 'M'],
];

// Long lanes that run straight across between the two sides, bypassing the ion section.
// These are how you can still win without taking the middle, just slower.
const CROSS_LANES = [[4, 4], [6, 6]];

// Scatter `count` planets inside a circle without overlapping `existing` ones.
function scatter(cx, cy, radius, count, rng, existing) {
  const placed = existing.slice();
  const out = [];
  let tries = 0;
  while (out.length < count && tries < 5000) {
    tries++;
    const angle = rng() * Math.PI * 2;
    const dist = Math.sqrt(rng()) * (radius - 18);
    const x = cx + Math.cos(angle) * dist;
    const y = cy + Math.sin(angle) * dist;
    const r = 5 + Math.floor(rng() * 7); // radius 5..11
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

function generateGalaxy(seed) {
  const rng = mulberry32(seed === undefined ? 20271029 : seed);
  const sections = [];

  // Side A: generate planets once.
  for (const def of SIDE_A) {
    const id = 'A' + def.n;
    const planets = [];
    let existing = [];
    if (def.home) {
      const home = { x: def.x, y: def.y, r: 14, home: true };
      planets.push(home);
      existing = [home];
    }
    for (const p of scatter(def.x, def.y, def.r, def.planets - planets.length, rng, existing)) {
      planets.push(p);
    }
    sections.push({ id, side: 'A', x: def.x, y: def.y, r: def.r, home: !!def.home, planets });
  }

  // Side B: exact mirror of side A (x flipped), so the game starts fair.
  for (const a of sections.filter((s) => s.side === 'A')) {
    sections.push({
      id: 'B' + a.id.slice(1),
      side: 'B',
      x: WORLD_W - a.x,
      y: a.y,
      r: a.r,
      home: a.home,
      planets: a.planets.map((p) => ({ x: WORLD_W - p.x, y: p.y, r: p.r, home: p.home })),
    });
  }

  // Middle: one planet dead center plus a mirrored pair, all ion planets.
  const centerPlanet = { x: MIDDLE.x, y: MIDDLE.y, r: 12, ion: true };
  const leftHalf = scatter(MIDDLE.x - 40, MIDDLE.y, MIDDLE.r - 40, 2, rng, [centerPlanet]);
  const middlePlanets = [centerPlanet];
  for (const p of leftHalf) {
    middlePlanets.push({ x: p.x, y: p.y, r: p.r, ion: true });
    middlePlanets.push({ x: WORLD_W - p.x, y: p.y, r: p.r, ion: true });
  }
  sections.push({ id: 'M', side: 'N', x: MIDDLE.x, y: MIDDLE.y, r: MIDDLE.r, home: false, ion: true, planets: middlePlanets });

  // Lanes.
  const lanes = [];
  const ref = (side, v) => (v === 'M' ? 'M' : side + v);
  for (const side of ['A', 'B']) {
    for (const [a, b] of SIDE_LANES) {
      lanes.push({ a: ref(side, a), b: ref(side, b), cross: false });
    }
  }
  for (const [a, b] of CROSS_LANES) {
    lanes.push({ a: 'A' + a, b: 'B' + b, cross: true });
  }

  return { sections, lanes };
}
