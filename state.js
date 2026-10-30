// Game state and rules. No drawing and no DOM in here, so an AI (or tests) can use it too.
// Numbers marked PLACEHOLDER are meant to be changed when the design is workshopped.

const START_RESOURCES = 100;      // PLACEHOLDER: starting resources for each side
const INCOME_PER_PLANET = 0.2;    // PLACEHOLDER: resources per second per planet in a held section
const RESEARCH_PER_NEBULA = 0.1;  // PLACEHOLDER: research points per second per held nebula
const PLAYER_SIDE = 'A';

function createState(galaxy) {
  const sections = {};
  for (const s of galaxy.sections) {
    sections[s.id] = {
      owner: s.side === 'N' ? null : s.side, // null = unclaimed (the ion section and nebulae start that way)
      safety: 1,                              // 1 = routes fully safe, lower = contested (not used yet)
    };
  }
  // res = ship-building resources, rp = research points, weaponCharge is 0..100
  const makeSide = () => ({ res: START_RESOURCES, ion: 0, rp: 0, weaponCharge: 0 });
  return {
    time: 0,
    paused: false,
    player: PLAYER_SIDE,
    sections,
    sides: { A: makeSide(), B: makeSide() },
  };
}

// Resources per second that one planet produces for the owner of its section.
// The ion section and nebulae are excluded: ion works differently (shipments to the home planet),
// and nebulae produce research points instead.
function planetIncome(state, section) {
  const info = state.sections[section.id];
  if (!info.owner || section.ion || section.nebula) return 0;
  return INCOME_PER_PLANET * info.safety;
}

// Resources per second that a whole section produces for its owner.
function sectionIncome(state, section) {
  return section.planets.length * planetIncome(state, section);
}

function sideIncome(state, galaxy, side) {
  let total = 0;
  for (const s of galaxy.sections) {
    if (state.sections[s.id].owner === side) total += sectionIncome(state, s);
  }
  return total;
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
  }
}
