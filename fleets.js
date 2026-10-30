// Fleet movement and the rules for capturing and contesting. No drawing and no DOM.
// Every number marked PLACEHOLDER is meant to be tuned when the design is workshopped.
//
// A fleet is either stationed in a section (fleet.at is a section id) or travelling along a lane
// (fleet.leg is set and fleet.at is null). Orders:
//   { type: 'capture', planetId }   go to that planet's section and capture the planet
//   { type: 'contest', sectionId }  go to that section and stay: enemy income there drops; a nebula gets taken
//   null                            nothing to do (this is how a fleet comes home)

const SPEED_SCALE = 55;       // PLACEHOLDER: world units per second for a ship of speed 1.0
const CAPTURE_TIME = 20;      // PLACEHOLDER: seconds a fleet must stay on station to capture a planet or take a nebula
const CONTEST_SAFETY = 0.5;   // PLACEHOLDER: income multiplier for a section while an enemy warfleet sits in it

const otherSide = (side) => (side === 'A' ? 'B' : 'A');

// ---------- the lane graph ----------

function buildAdjacency(galaxy) {
  const pos = {};
  galaxy.sections.forEach((s) => { pos[s.id] = s; });
  const adj = {};
  galaxy.sections.forEach((s) => { adj[s.id] = []; });
  for (const l of galaxy.lanes) {
    const d = Math.hypot(pos[l.a].x - pos[l.b].x, pos[l.a].y - pos[l.b].y);
    adj[l.a].push({ to: l.b, dist: d });
    adj[l.b].push({ to: l.a, dist: d });
  }
  return adj;
}

function laneDist(state, a, b) {
  const e = state.adj[a].find((x) => x.to === b);
  return e ? e.dist : Infinity;
}

// Shortest way along the lanes: a list of section ids from `from` to `to`, or null if there is no way.
function shortestPath(state, from, to) {
  const dist = { [from]: 0 };
  const prev = {};
  const todo = new Set(Object.keys(state.adj));
  while (todo.size) {
    let u = null;
    for (const id of todo) if (dist[id] !== undefined && (u === null || dist[id] < dist[u])) u = id;
    if (u === null) return null;
    todo.delete(u);
    if (u === to) break;
    for (const e of state.adj[u]) {
      const d = dist[u] + e.dist;
      if (dist[e.to] === undefined || d < dist[e.to]) { dist[e.to] = d; prev[e.to] = u; }
    }
  }
  if (dist[to] === undefined) return null;
  const path = [to];
  while (path[0] !== from) path.unshift(prev[path[0]]);
  return path;
}

function pathLength(state, path) {
  let d = 0;
  for (let i = 0; i + 1 < path.length; i++) d += laneDist(state, path[i], path[i + 1]);
  return d;
}

// ---------- fleet facts ----------

function isArmed(fleet) {
  for (const t of SHIP_TYPES) if (t.kind === 'combat' && (fleet.ships[t.id] || 0) > 0) return true;
  return false;
}

// A fleet moves at the speed of its slowest ship.
function fleetSpeed(fleet) {
  let slowest = Infinity;
  for (const t of SHIP_TYPES) if ((fleet.ships[t.id] || 0) > 0) slowest = Math.min(slowest, t.speed);
  return slowest === Infinity ? 0 : slowest * SPEED_SCALE;
}

function fleetMoving(fleet) { return !!fleet.leg; }

// Where a travelling fleet is heading in the end.
function fleetDestination(fleet) {
  if (fleet.route.length) return fleet.route[fleet.route.length - 1];
  return fleet.leg ? fleet.leg.to : fleet.at;
}

// Seconds until a travelling fleet arrives.
function fleetEta(state, fleet) {
  if (!fleet.leg) return 0;
  const speed = fleetSpeed(fleet);
  if (!speed) return Infinity;
  const rest = fleet.leg.dist - fleet.leg.done + pathLength(state, [fleet.leg.to].concat(fleet.route));
  return rest / speed;
}

// Where a travelling fleet is on the map, and which way it points.
function fleetPosition(state, fleet) {
  const a = state.defs[fleet.leg.from];
  const b = state.defs[fleet.leg.to];
  const t = fleet.leg.dist ? fleet.leg.done / fleet.leg.dist : 1;
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, angle: Math.atan2(b.y - a.y, b.x - a.x) };
}

// Fleets of `side` stationed in a section (not travelling).
function fleetsStationed(state, sectionId, side) {
  return state.sides[side].fleets.filter((f) => f.at === sectionId && !f.leg);
}

function enemyArmedAt(state, sectionId, side) {
  return fleetsStationed(state, sectionId, otherSide(side)).some(isArmed);
}

// Route safety for `side` in a section: 1 normally, lower while an enemy warfleet sits there.
function safetyFor(state, sectionId, side) {
  return enemyArmedAt(state, sectionId, side) ? CONTEST_SAFETY : 1;
}

// ---------- giving orders ----------

// Point a fleet at a section. A fleet in the middle of a lane may carry on to the next section or turn around,
// whichever gets it there sooner.
function routeFleet(state, fleet, target) {
  if (!fleet.leg) {
    if (fleet.at === target) return true;
    const path = shortestPath(state, fleet.at, target);
    if (!path) return false;
    fleet.leg = { from: path[0], to: path[1], dist: laneDist(state, path[0], path[1]), done: 0 };
    fleet.route = path.slice(2);
    fleet.at = null;
    return true;
  }
  const { from, to, dist, done } = fleet.leg;
  const ahead = shortestPath(state, to, target);
  const back = shortestPath(state, from, target);
  const aheadCost = ahead ? dist - done + pathLength(state, ahead) : Infinity;
  const backCost = back ? done + pathLength(state, back) : Infinity;
  if (aheadCost === Infinity && backCost === Infinity) return false;
  if (aheadCost <= backCost) {
    fleet.route = ahead.slice(1);
  } else {
    fleet.leg = { from: to, to: from, dist, done: dist - done };
    fleet.route = back.slice(1);
  }
  return true;
}

// order: { type: 'capture', planetId } or { type: 'contest', sectionId }. Returns { ok, reason }.
function sendFleet(state, side, fleetId, order) {
  const fleet = findFleet(state, side, fleetId);
  if (!fleet) return { ok: false, reason: 'no such fleet' };
  if (fleetSize(fleet) === 0) return { ok: false, reason: 'fleet is empty' };
  let target;
  if (order.type === 'capture') {
    const info = state.planets[order.planetId];
    if (!info) return { ok: false, reason: 'no such planet' };
    if (info.owner === side) return { ok: false, reason: 'you already own that planet' };
    if (!isArmed(fleet)) return { ok: false, reason: 'capturing needs an armed ship' };
    target = info.sectionId;
  } else if (order.type === 'contest') {
    if (!state.defs[order.sectionId]) return { ok: false, reason: 'no such section' };
    target = order.sectionId;
  } else {
    return { ok: false, reason: 'unknown order' };
  }
  if (!routeFleet(state, fleet, target)) return { ok: false, reason: 'no route there' };
  fleet.order = order;
  fleet.progress = 0;
  return { ok: true };
}

// Bring a fleet back to the capital.
function recallFleet(state, side, fleetId) {
  const fleet = findFleet(state, side, fleetId);
  if (!fleet) return { ok: false, reason: 'no such fleet' };
  if (!routeFleet(state, fleet, state.home[side])) return { ok: false, reason: 'no route home' };
  fleet.order = null;
  fleet.progress = 0;
  return { ok: true };
}

// ---------- time passing ----------

function moveFleet(state, fleet, dt) {
  let budget = fleetSpeed(fleet) * dt;
  while (fleet.leg && budget > 1e-9) {
    const left = fleet.leg.dist - fleet.leg.done;
    if (budget < left) { fleet.leg.done += budget; return; }
    budget -= left;
    const here = fleet.leg.to;
    if (fleet.route.length) {
      const next = fleet.route.shift();
      fleet.leg = { from: here, to: next, dist: laneDist(state, here, next), done: 0 };
    } else {
      fleet.leg = null;
      fleet.at = here;
    }
  }
}

// What a stationed fleet does with its order.
function workOrder(state, side, fleet, dt) {
  const order = fleet.order;
  if (!order) return;
  const me = side;

  if (order.type === 'capture') {
    const info = state.planets[order.planetId];
    if (info.owner === me) { fleet.order = null; fleet.progress = 0; return; }
    if (!isArmed(fleet) || enemyArmedAt(state, fleet.at, me)) return;
    fleet.progress += dt;
    if (fleet.progress >= CAPTURE_TIME) {
      info.owner = me;
      recomputeSectionOwner(state, state.defs[info.sectionId]);
      fleet.order = null;
      fleet.progress = 0;
      const planet = state.defs[info.sectionId].planets.find((p) => p.id === order.planetId);
      if (planet.home && !state.winner) {
        state.winner = me;      // capturing the enemy home planet wins the game
        state.paused = true;
      }
    }
    return;
  }

  if (order.type === 'contest') {
    const section = state.defs[order.sectionId];
    // A nebula has no planets, so staying there long enough takes it. For other sections, staying is the whole effect.
    if (section.planets.length || state.sections[section.id].owner === me) return;
    if (!isArmed(fleet) || enemyArmedAt(state, fleet.at, me)) return;
    fleet.progress += dt;
    if (fleet.progress >= CAPTURE_TIME) {
      state.sections[section.id].owner = me;
      fleet.order = null;
      fleet.progress = 0;
    }
  }
}

function tickFleets(state, dt) {
  for (const side of ['A', 'B']) {
    for (const fleet of state.sides[side].fleets) {
      if (fleet.leg) moveFleet(state, fleet, dt);
      if (!fleet.leg) workOrder(state, side, fleet, dt);
    }
  }
  // Route safety follows from where the warfleets are.
  for (const id in state.sections) {
    const owner = state.sections[id].owner;
    state.sections[id].safety = owner ? safetyFor(state, id, owner) : 1;
  }
}
