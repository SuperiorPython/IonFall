// Ship types. Data only: no drawing and no DOM, so combat, the AI and the build screen can all share it.
// Every number here is a PLACEHOLDER to be tuned when the design is workshopped.
//
//   cost       resources to build one
//   buildTime  seconds to build one
//   hp         hit points
//   damage     damage per second against other ships (0 = unarmed)
//   speed      lane travel speed (relative, not tuned yet)
//   kind       'combat' ships fight; 'infiltrator' is the stealth ship

const SHIP_TYPES = [
  {
    id: 'skirmisher',
    name: 'Skirmisher',
    kind: 'combat',
    role: 'Swarm',
    blurb: 'Cheap and fast. Weak alone, dangerous in numbers. Good for raiding lanes.',
    cost: 20, buildTime: 6, hp: 30, damage: 4, speed: 3.0,
  },
  {
    id: 'frigate',
    name: 'Frigate',
    kind: 'combat',
    role: 'Line ship',
    blurb: 'The all-rounder. Holds a section and makes up most fleets.',
    cost: 50, buildTime: 12, hp: 90, damage: 9, speed: 2.0,
  },
  {
    id: 'cruiser',
    name: 'Cruiser',
    kind: 'combat',
    role: 'Heavy',
    blurb: 'Slow and tough, hits hard. Breaks defended sections.',
    cost: 120, buildTime: 25, hp: 260, damage: 22, speed: 1.2,
  },
  {
    id: 'dreadnought',
    name: 'Dreadnought',
    kind: 'combat',
    role: 'Capital',
    blurb: 'Very expensive and very slow. The kind of ship that can take down a superweapon or a home planet.',
    cost: 400, buildTime: 60, hp: 900, damage: 70, speed: 0.7,
  },
  {
    id: 'infiltrator',
    name: 'Infiltrator',
    kind: 'infiltrator',
    role: 'Infiltration',
    blurb: 'Stealth ship with no weapons. Slips into enemy sections to reveal what is hidden there. What else it can do is still open.',
    cost: 60, buildTime: 15, hp: 20, damage: 0, speed: 2.5,
  },
];

const SHIP_BY_ID = {};
SHIP_TYPES.forEach((t) => { SHIP_BY_ID[t.id] = t; });
