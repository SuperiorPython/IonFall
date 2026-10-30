// The dashboard: top bar, sidebar, and the central upgrades overlay.
// It only reads the game state and updates text, so the rules stay in state.js.
// Rows and panels are built once and updated in place, so clicks are never lost to a rebuild.

function createUI(game) {
  const { state, galaxy, byId } = game;
  const side = state.player;
  const $ = (id) => document.getElementById(id);

  let selectedId = null;
  let activeTab = null;
  const overviewRates = {};

  const fmt = (n) => Math.floor(n).toLocaleString('en-US');
  const rate = (n) => '+' + n.toFixed(1) + '/s';
  const clock = (t) => {
    const m = Math.floor(t / 60);
    const s = Math.floor(t % 60);
    return String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
  };

  // ---------- overview rows (your sections) ----------
  const list = $('overview-list');
  for (const s of galaxy.sections.filter((sec) => sec.side === side)) {
    const li = document.createElement('li');
    li.className = 'row clickable';
    const id = document.createElement('span');
    id.className = 'id';
    id.textContent = s.id + (s.home ? '  HOME' : '');
    const meta = document.createElement('span');
    meta.className = 'meta';
    meta.textContent = s.planets.length + ' planets';
    const inc = document.createElement('span');
    inc.className = 'inc';
    li.append(id, meta, inc);
    li.addEventListener('click', () => game.select(s.id));
    list.appendChild(li);
    overviewRates[s.id] = inc;
  }

  // ---------- section panel ----------
  const TAB_TEXT = {
    build: 'Ship building goes here: pick a ship, see its cost and build time, and queue it. Coming in the next piece.',
    upgrades: 'Upgrades for this section go here: income, defense, and build capacity. Coming after ship building.',
  };

  function setTab(name) {
    activeTab = name;
    for (const b of $('sec-tabs').children) b.classList.toggle('active', b.dataset.tab === name);
    const s = byId[selectedId];
    const owner = state.sections[selectedId].owner;
    if (owner === side) {
      $('sec-tabbody').textContent = TAB_TEXT[name];
    } else if (owner) {
      $('sec-tabbody').textContent = 'Enemy territory. You can see it on the map, but not what is inside it.';
    } else {
      $('sec-tabbody').textContent = s.ion
        ? 'Unclaimed. Hold this section to supply ion to your home planet.'
        : 'Unclaimed.';
    }
  }

  for (const b of $('sec-tabs').children) {
    b.addEventListener('click', () => setTab(b.dataset.tab));
  }

  function ownerLabel(owner) {
    if (owner === side) return { text: 'YOURS', cls: 'yours' };
    if (owner) return { text: 'ENEMY', cls: 'enemy' };
    return { text: 'UNCLAIMED', cls: 'neutral' };
  }

  function showSection(id) {
    selectedId = id;
    $('view-overview').classList.toggle('hidden', !!id);
    $('view-section').classList.toggle('hidden', !id);
    if (!id) return;

    const s = byId[id];
    const owner = state.sections[id].owner;
    const label = ownerLabel(owner);
    $('sec-title').textContent = s.ion ? 'M  Ion section' : s.id + (s.home ? '  Home section' : '');
    const badge = $('sec-owner');
    badge.textContent = label.text;
    badge.className = 'badge ' + label.cls;
    $('sec-planets').textContent = s.planets.length;

    const yours = owner === side;
    $('sec-tabs').classList.toggle('hidden', !yours);
    setTab(yours ? 'build' : null);
    refreshSection();
  }

  function refreshSection() {
    const owner = state.sections[selectedId].owner;
    if (owner === side) {
      $('sec-income').textContent = rate(sectionIncome(state, byId[selectedId]));
      $('sec-safety').textContent = Math.round(state.sections[selectedId].safety * 100) + '%';
    } else {
      $('sec-income').textContent = owner ? 'unknown' : '-';
      $('sec-safety').textContent = owner ? 'unknown' : '-';
    }
  }

  $('btn-back').addEventListener('click', () => game.select(null));

  // ---------- central overlay ----------
  const central = $('central');
  const centralOpen = () => !central.classList.contains('hidden');
  const openCentral = () => central.classList.remove('hidden');
  const closeCentral = () => central.classList.add('hidden');

  $('btn-central').addEventListener('click', openCentral);
  $('central-close').addEventListener('click', closeCentral);
  central.addEventListener('click', (e) => { if (e.target === central) closeCentral(); });

  // ---------- pause ----------
  $('btn-pause').addEventListener('click', (e) => {
    state.paused = !state.paused;
    e.currentTarget.blur();
    update();
  });

  // ---------- keyboard ----------
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (centralOpen()) closeCentral();
      else if (selectedId) game.select(null);
    }
  });

  // ---------- refresh from state ----------
  function update() {
    const mine = state.sides[side];
    $('clock').textContent = clock(state.time);
    $('res-value').textContent = fmt(mine.res);
    $('res-rate').textContent = rate(sideIncome(state, galaxy, side));
    $('ion-value').textContent = fmt(mine.ion);
    $('ion-note').textContent = state.sections.M.owner === side ? 'held' : 'hold M';
    $('weapon-status').textContent = 'OFFLINE';
    $('weapon-fill').style.width = mine.weaponCharge + '%';
    $('btn-pause').textContent = state.paused ? 'Resume' : 'Pause';

    for (const id in overviewRates) {
      overviewRates[id].textContent = rate(sectionIncome(state, byId[id]));
    }
    const ionOwner = state.sections.M.owner;
    $('overview-ion').textContent = 'M  ' + (ionOwner === side ? 'held by you' : ionOwner ? 'held by the enemy' : 'unclaimed');

    if (selectedId) refreshSection();
  }

  return { update, showSection };
}
