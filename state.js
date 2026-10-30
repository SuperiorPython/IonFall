// Game state and rules. No drawing and no DOM in here, so an AI (or tests) can use it too.
// Numbers marked PLACEHOLDER are meant to be changed when the design is workshopped.

const START_RESOURCES = 100;    // PLACEHOLDER: starting resources for each side
const INCOME_PER_PLANET = 0.2;  // PLACEHOLDER: resources per second per planet in a held section
const PLAYER_SIDE = 'A';

function createState(galaxy) {
  const sections = {};
  for (const s of galaxy.sections) {
    sections[s.id] = {
      owner: s.side === 'N' ? null : s.side, // null = unclaimed (the ion section starts that way)
      safety: 1,                              // 1 = routes fully safe, lower = contested (not used yet)
    };
  }
  const makeSide = () => ({ res: START_RESOURCES, ion: 0, weaponCharge: 0 }); // weaponCharge is 0..100
  return {
    time: 0,
    paused: false,
    player: PLAYER_SIDE,
    sections,
    sides: { A: makeSide(), B: makeSide() },
  };
}

// Resources per second that one section produces for its owner.
// The ion section is excluded: its output will work differently (shipments to the home planet).
function sectionIncome(state, section) {
  const info = state.sections[section.id];
  if (!info.owner || section.ion) return 0;
  return section.planets.length * INCOME_PER_PLANET * info.safety;
}

function sideIncome(state, galaxy, side) {
  let total = 0;
  for (const s of galaxy.sections) {
    if (state.sections[s.id].owner === side) total += sectionIncome(state, s);
  }
  return total;
}

function tickState(state, galaxy, dt) {
  if (state.paused) return;
  state.time += dt;
  for (const side of ['A', 'B']) {
    state.sides[side].res += sideIncome(state, galaxy, side) * dt;
  }
}
