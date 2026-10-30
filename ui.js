// The dashboard: top bar, sidebar, and the central upgrades overlay.
// It only reads the game state and updates text, so the rules stay in state.js.
// Rows and panels are built once and updated in place, so clicks are never lost to a rebuild.

function createUI(game) {
  const { state, galaxy, byId } = game;
  const side = state.player;
  const $ = (id) => document.getElementById(id);

  let selectedId = null;
  let shownPlanet = null; // { section, planet } while a planet card is open
  const overviewRates = {};
  const nebulaStatus = {};

  const fmt = (n) => Math.floor(n).toLocaleString('en-US');
  const rate = (n) => '+' + n.toFixed(1) + '/s';
  const clock = (t) => {
    const m = Math.floor(t / 60);
    const s = Math.floor(t % 60);
    return String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
  };

  // ---------- overview rows ----------
  function makeRow(sectionId, idText, metaText) {
    const li = document.createElement('li');
    li.className = 'row clickable';
    const id = document.createElement('span');
    id.className = 'id';
    id.textContent = idText;
    const meta = document.createElement('span');
    meta.className = 'meta';
    meta.textContent = metaText;
    const value = document.createElement('span');
    value.className = 'inc';
    li.append(id, meta, value);
    li.addEventListener('click', () => game.select(sectionId));
    return { li, value };
  }

  // Your sections.
  for (const s of galaxy.sections.filter((sec) => sec.side === side)) {
    const row = makeRow(s.id, s.id + (s.home ? '  HOME' : ''), s.planets.length + ' planets');
    $('overview-list').appendChild(row.li);
    overviewRates[s.id] = row.value;
  }

  // Every nebula, whoever holds it.
  for (const s of galaxy.sections.filter((sec) => sec.nebula)) {
    const row = makeRow(s.id, s.id, 'nebula');
    $('overview-nebulae').appendChild(row.li);
    nebulaStatus[s.id] = row.value;
  }

  function nebulaText(s) {
    const owner = state.sections[s.id].owner;
    if (owner === side) return rate(sectionResearch(state, s));
    return owner ? 'enemy' : 'unclaimed';
  }

  // ---------- section panel ----------
  const TAB_TEXT = {
    build: 'Ship building goes here: pick a ship, see its cost and build time, and queue it. Coming in the next piece.',
    upgrades: 'Upgrades for this section go here: income, defense, and build capacity. Coming after ship building.',
  };

  function setTab(name) {
    for (const b of $('sec-tabs').children) b.classList.toggle('active', b.dataset.tab === name);
    const s = byId[selectedId];
    const owner = state.sections[selectedId].owner;
    if (owner === side) {
      $('sec-tabbody').textContent = s.nebula
        ? 'You hold this nebula. It produces research points, which will be spent on upgrades. Coming after ship building.'
        : TAB_TEXT[name];
    } else if (owner) {
      $('sec-tabbody').textContent = 'Enemy territory. You can see it on the map, but not what is inside it.';
    } else if (s.ion) {
      $('sec-tabbody').textContent = 'Unclaimed. Hold this section to supply ion to your home planet.';
    } else if (s.nebula) {
      $('sec-tabbody').textContent = 'Unclaimed. Hold this nebula to earn research points.';
    } else {
      $('sec-tabbody').textContent = 'Unclaimed.';
    }
  }

  for (const b of $('sec-tabs').children) {
    b.addEventListener('click', () => setTab(b.dataset.tab));
  }

  function ownerLabel(owner, section) {
    if (owner === side) return { text: 'YOURS', cls: 'yours' };
    if (owner) return { text: 'ENEMY', cls: 'enemy' };
    return { text: 'UNCLAIMED', cls: section.nebula ? 'nebula' : 'neutral' };
  }

  function sectionTitle(s) {
    if (s.ion) return 'M  Ion section';
    if (s.nebula) return s.id + '  Nebula';
    return s.id + (s.home ? '  Home section' : '');
  }

  function showSection(id) {
    selectedId = id;
    showPlanet(null, null);
    $('view-overview').classList.toggle('hidden', !!id);
    $('view-section').classList.toggle('hidden', !id);
    if (!id) return;

    const s = byId[id];
    const owner = state.sections[id].owner;
    const label = ownerLabel(owner, s);
    $('sec-title').textContent = sectionTitle(s);
    const badge = $('sec-owner');
    badge.textContent = label.text;
    badge.className = 'badge ' + label.cls;
    $('sec-income-label').textContent = s.nebula ? 'Research' : 'Income';
    $('sec-planets').textContent = s.nebula ? 'none' : s.planets.length;

    // Ships are built on planets, so a held nebula has no build or upgrade tabs.
    const yours = owner === side;
    $('sec-tabs').classList.toggle('hidden', !yours || !!s.nebula);
    setTab(yours && !s.nebula ? 'build' : null);
    refreshSection();
  }

  function refreshSection() {
    const s = byId[selectedId];
    const owner = state.sections[selectedId].owner;
    if (owner === side) {
      $('sec-income').textContent = rate(s.nebula ? sectionResearch(state, s) : sectionIncome(state, s));
      $('sec-safety').textContent = Math.round(state.sections[selectedId].safety * 100) + '%';
    } else {
      $('sec-income').textContent = owner ? 'unknown' : '-';
      $('sec-safety').textContent = owner ? 'unknown' : '-';
    }
  }

  $('btn-back').addEventListener('click', () => game.select(null));

  // ---------- planet card ----------
  function planetKind(planet) {
    return planet.home ? 'Home planet' : planet.ion ? 'Ion planet' : 'Colony';
  }

  function showPlanet(section, planet) {
    shownPlanet = planet ? { section, planet } : null;
    $('planet-card').classList.toggle('hidden', !planet);
    if (!planet) return;
    $('pc-name').textContent = planet.id;
    $('pc-kind').textContent = planetKind(planet);
    refreshPlanet();
  }

  function refreshPlanet() {
    if (!shownPlanet) return;
    const { section } = shownPlanet;
    const owner = state.sections[section.id].owner;
    let text;
    if (owner === side) {
      text = section.ion ? '-' : rate(planetIncome(state, section));
    } else {
      text = owner ? 'unknown' : '-';
    }
    $('pc-income').textContent = text;
  }

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

  // ---------- keyboard: Esc steps back one level ----------
  window.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (centralOpen()) closeCentral();
    else if (shownPlanet) game.selectPlanet(null);
    else if (selectedId) game.select(null);
  });

  // ---------- refresh from state ----------
  function update() {
    const mine = state.sides[side];
    $('clock').textContent = clock(state.time);
    $('res-value').textContent = fmt(mine.res);
    $('res-rate').textContent = rate(sideIncome(state, galaxy, side));
    $('ion-value').textContent = fmt(mine.ion);
    $('ion-note').textContent = state.sections.M.owner === side ? 'held' : 'hold M';
    $('rp-value').textContent = mine.rp.toFixed(1);
    $('rp-rate').textContent = rate(sideResearch(state, galaxy, side));
    $('weapon-status').textContent = 'OFFLINE';
    $('weapon-fill').style.width = mine.weaponCharge + '%';
    $('btn-pause').textContent = state.paused ? 'Resume' : 'Pause';

    for (const id in overviewRates) {
      overviewRates[id].textContent = rate(sectionIncome(state, byId[id]));
    }
    for (const id in nebulaStatus) {
      nebulaStatus[id].textContent = nebulaText(byId[id]);
    }
    const ionOwner = state.sections.M.owner;
    $('overview-ion').textContent = 'M  ' + (ionOwner === side ? 'held by you' : ionOwner ? 'held by the enemy' : 'unclaimed');

    if (selectedId) refreshSection();
    refreshPlanet();
  }

  return { update, showSection, showPlanet };
}
