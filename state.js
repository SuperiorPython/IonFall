// Game state and rules. No drawing and no DOM in here, so an AI (or tests) can use it too.
// Numbers marked PLACEHOLDER are meant to be changed when the design is workshopped.

const START_RESOURCES = 100;      // PLACEHOLDER: starting resources for each side
const INCOME_PER_PLANET = 0.2;    // PLACEHOLDER: resources per second per planet in a held section
const RESEARCH_PER_NEBULA = 0.1;  // PLACEHOLDER: research points per second per held nebula
const QUEUE_LIMIT = 5;            // PLACEHOLDER: ships that can wait in the build queue (including the one being built)
const FLEET_SIZE_LIMIT = 10;      // PLACEHOLDER: ships per fleet at the start (upgrades will raise it)
const FLEET_COUNT_LIMIT = 3;      // PLACEHOLDER: fleets you can have at the start (upgrades will raise it)
const PLAYER_SIDE = 'A';

function createState(galaxy) {
  const sections = {};
  for (const s of galaxy.sections) {
    sections[s.id] = {
      owner: s.home ? s.side : null,          // null = unclaimed: every side starts with only its capital, the rest must be claimed
      safety: 1,                              // 1 = routes fully safe, lower = contested (not used yet)
    };
  }
  // res = ship-building resources, rp = research points, weaponCharge is 0..100
  // queue = ships waiting to be built (the first one is in progress), hangar = finished ships not in a fleet,
  // fleets = groups of ships, limits = how big and how many (upgrades will raise them)
  const makeSide = () => ({
    res: START_RESOURCES, ion: 0, rp: 0, weaponCharge: 0,
    queue: [], nextQueueId: 1,
    hangar: {},
    fleets: [], nextFleetId: 1,
    limits: { fleetSize: FLEET_SIZE_LIMIT, fleetCount: FLEET_COUNT_LIMIT },
  });
  // The capital is the only place ships are built.
  const home = {};
  for (const s of galaxy.sections) if (s.home) home[s.side] = s.id;
  // Every planet has its own owner. A section's owner follows from its planets (see recomputeSectionOwner).
  const planets = {};
  const defs = {};
  for (const s of galaxy.sections) {
    defs[s.id] = s;
    for (const p of s.planets) planets[p.id] = { owner: s.home ? s.side : null, sectionId: s.id };
  }
  return {
    time: 0,
    paused: false,
    winner: null,       // set to 'A' or 'B' when a home planet is captured
    player: PLAYER_SIDE,
    home,
    sections,
    planets,
    defs,                          // section id -> the galaxy's section data (read only)
    adj: buildAdjacency(galaxy),   // section id -> lanes out of it, with lengths
    sides: { A: makeSide(), B: makeSide() },
  };
}

// Resources per second that one planet produces for the side that owns it.
// The ion section and nebulae are excluded: ion works differently (shipments to the home planet),
// and nebulae produce research points instead. Enemy ships stationed in the section cut the rate (route safety).
function planetIncome(state, section, planet) {
  const info = state.planets[planet.id];
  if (!info || !info.owner || section.ion || section.nebula) return 0;
  return INCOME_PER_PLANET * safetyFor(state, section.id, info.owner);
}

// Resources per second that `side` gets from its planets in one section.
function sectionIncome(state, section, side) {
  let total = 0;
  for (const p of section.planets) {
    if (state.planets[p.id].owner === side) total += planetIncome(state, section, p);
  }
  return total;
}

function sideIncome(state, galaxy, side) {
  let total = 0;
  for (const s of galaxy.sections) total += sectionIncome(state, s, side);
  return total;
}

// How many planets in a section a side owns.
function ownedPlanets(state, section, side) {
  let n = 0;
  for (const p of section.planets) if (state.planets[p.id].owner === side) n++;
  return n;
}

// A section belongs to whoever owns more than half of its planets. Otherwise it stays with whoever had it.
// (Nebulae have no planets: their owner is set directly when a fleet takes them.)
function recomputeSectionOwner(state, section) {
  if (!section.planets.length) return;
  for (const side of ['A', 'B']) {
    if (ownedPlanets(state, section, side) * 2 > section.planets.length) {
      state.sections[section.id].owner = side;
      return;
    }
  }
}

// Research points per second that a held nebula produces for its owner (other sections produce none).
function sectionResearch(state, section) {
  const info = state.sections[section.id];
  if (!info.owner || !section.nebula) return 0;
  return RESEARCH_PER_NEBULA * info.safety;
}

function sideResearch(state, galaxy, side) {
  let total = 0;
  for (const s of galaxy.sections) {
    if (state.sections[s.id].owner === side) total += sectionResearch(state, s);
  }
  return total;
}

function tickState(state, galaxy, dt) {
  if (state.paused) return;
  state.time += dt;
  for (const side of ['A', 'B']) {
    state.sides[side].res += sideIncome(state, galaxy, side) * dt;
    state.sides[side].rp += sideResearch(state, galaxy, side) * dt;
    tickBuild(state.sides[side], dt);
  }
  tickFleets(state, dt);
}

// ---------- ship building (capital only) ----------

// Ships are built one at a time, in order. A finished ship goes to the hangar.
function tickBuild(me, dt) {
  let time = dt;
  while (me.queue.length && time > 1e-9) {
    const item = me.queue[0];
    const used = Math.min(item.left, time);
    item.left -= used;
    time -= used;
    if (item.left <= 1e-9) {
      me.queue.shift();
      me.hangar[item.shipId] = (me.hangar[item.shipId] || 0) + 1;
    }
  }
}

function hasCapital(state, side) {
  return state.sections[state.home[side]].owner === side;
}

// Pay for a ship and add it to the build queue. Returns { ok, reason }.
function queueShip(state, side, shipId) {
  const type = SHIP_BY_ID[shipId];
  const me = state.sides[side];
  if (!type) return { ok: false, reason: 'unknown ship' };
  if (!hasCapital(state, side)) return { ok: false, reason: 'no capital' };
  if (me.queue.length >= QUEUE_LIMIT) return { ok: false, reason: 'queue full' };
  if (me.res < type.cost) return { ok: false, reason: 'not enough resources' };
  me.res -= type.cost;
  me.queue.push({ id: me.nextQueueId++, shipId, left: type.buildTime });
  return { ok: true };
}

// Remove a ship from the queue. PLACEHOLDER rule: full refund, even if it is already in progress.
function cancelQueued(state, side, queueId) {
  const me = state.sides[side];
  const i = me.queue.findIndex((q) => q.id === queueId);
  if (i < 0) return { ok: false, reason: 'not in queue' };
  me.res += SHIP_BY_ID[me.queue[i].shipId].cost;
  me.queue.splice(i, 1);
  return { ok: true };
}

// ---------- fleets ----------
// For now fleets are only made and changed at the capital. Sending them out comes next.

function fleetSize(fleet) {
  let n = 0;
  for (const id in fleet.ships) n += fleet.ships[id];
  return n;
}

function findFleet(state, side, fleetId) {
  return state.sides[side].fleets.find((f) => f.id === fleetId) || null;
}

function createFleet(state, side) {
  const me = state.sides[side];
  if (!hasCapital(state, side)) return null;
  if (me.fleets.length >= me.limits.fleetCount) return null;
  const used = new Set(me.fleets.map((f) => f.name));
  let n = 1;
  while (used.has('Fleet ' + n)) n++;
  // at = the section it is stationed in (null while travelling along a lane), leg = the lane it is on right now,
  // route = sections still to pass after that, order = what it does on arrival, progress = seconds into a capture
  const fleet = { id: me.nextFleetId++, name: 'Fleet ' + n, ships: {}, at: state.home[side], leg: null, route: [], order: null, progress: 0 };
  me.fleets.push(fleet);
  return fleet;
}

// Move ships from the hangar into a fleet.
function addToFleet(state, side, fleetId, shipId, count) {
  count = count === undefined ? 1 : count;
  const me = state.sides[side];
  const fleet = findFleet(state, side, fleetId);
  if (!fleet) return { ok: false, reason: 'no such fleet' };
  if (fleet.at !== state.home[side]) return { ok: false, reason: 'fleet is away from the capital' };
  if ((me.hangar[shipId] || 0) < count) return { ok: false, reason: 'not enough ships in the hangar' };
  if (fleetSize(fleet) + count > me.limits.fleetSize) return { ok: false, reason: 'fleet is full' };
  me.hangar[shipId] -= count;
  fleet.ships[shipId] = (fleet.ships[shipId] || 0) + count;
  return { ok: true };
}

// Move ships from a fleet back to the hangar.
function removeFromFleet(state, side, fleetId, shipId, count) {
  count = count === undefined ? 1 : count;
  const me = state.sides[side];
  const fleet = findFleet(state, side, fleetId);
  if (!fleet) return { ok: false, reason: 'no such fleet' };
  if (fleet.at !== state.home[side]) return { ok: false, reason: 'fleet is away from the capital' };
  if ((fleet.ships[shipId] || 0) < count) return { ok: false, reason: 'not enough ships in the fleet' };
  fleet.ships[shipId] -= count;
  if (fleet.ships[shipId] === 0) delete fleet.ships[shipId];
  me.hangar[shipId] = (me.hangar[shipId] || 0) + count;
  return { ok: true };
}

// Break a fleet up: all its ships return to the hangar.
function disbandFleet(state, side, fleetId) {
  const me = state.sides[side];
  const fleet = findFleet(state, side, fleetId);
  if (!fleet) return { ok: false, reason: 'no such fleet' };
  if (fleet.at !== state.home[side]) return { ok: false, reason: 'fleet is away from the capital' };
  for (const id in fleet.ships) me.hangar[id] = (me.hangar[id] || 0) + fleet.ships[id];
  me.fleets.splice(me.fleets.indexOf(fleet), 1);
  return { ok: true };
}
