// The dashboard: top bar, sidebar, and the central upgrades overlay.
// It only reads the game state and updates text, so the rules stay in state.js.
// Rows and panels are built once and updated in place, so clicks are never lost to a rebuild.

function createUI(game) {
  const { state, galaxy, byId } = game;
  const side = state.player;
  const $ = (id) => document.getElementById(id);

  let selectedId = null;
  let shownPlanet = null; // { section, planet } while a planet card is open
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
    return { li, meta, value };
  }

  // Sections where you own at least one planet. Rows are rebuilt only when that set changes,
  // and their numbers are updated in place, so a click is never lost to a rebuild.
  let overviewSig = '';
  let overviewRows = {};
  function syncOverviewSections() {
    const list = galaxy.sections.filter((s) => !s.nebula && !s.ion && ownedPlanets(state, s, side) > 0);
    const sig = list.map((s) => s.id).join(',');
    if (sig !== overviewSig) {
      overviewSig = sig;
      overviewRows = {};
      $('overview-list').textContent = '';
      for (const s of list) {
        const row = makeRow(s.id, s.id + (s.home ? '  HOME' : ''), '');
        $('overview-list').appendChild(row.li);
        overviewRows[s.id] = row;
      }
    }
    for (const s of list) {
      const row = overviewRows[s.id];
      row.meta.textContent = ownedPlanets(state, s, side) + '/' + s.planets.length + ' planets';
      row.value.textContent = rate(sectionIncome(state, s, side));
    }
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
    upgrades: 'Upgrades for this section go here: income and defense. Coming after ship building.',
  };

  const el = (tag, cls, text) => {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined) e.textContent = text;
    return e;
  };
  const mine = () => state.sides[side];
  const hangarText = () => {
    const h = mine().hangar;
    const parts = SHIP_TYPES.filter((t) => (h[t.id] || 0) > 0).map((t) => h[t.id] + ' ' + t.name);
    return parts.length ? parts.join(', ') : 'empty';
  };

  // ---------- fleet status and sending ----------
  const statusEls = {};   // container id -> [{ fleet, el, recall }], refreshed every tick without rebuilding anything
  const away = (f) => !!f.leg || f.at !== state.home[side];
  const composition = (f) => {
    const parts = SHIP_TYPES.filter((t) => (f.ships[t.id] || 0) > 0).map((t) => f.ships[t.id] + ' ' + t.name);
    return parts.length ? parts.join(', ') : 'no ships';
  };
  const ships = (n) => (n === 1 ? '1 ship' : n + ' ships');
  const pct = (f) => Math.floor((f.progress / CAPTURE_TIME) * 100) + '%';

  function fleetStatusText(f) {
    if (f.leg) return 'to ' + fleetDestination(f) + ', ' + Math.ceil(fleetEta(state, f)) + ' s';
    const o = f.order;
    if (!o) return f.at === state.home[side] ? 'docked at capital' : 'holding ' + f.at;
    if (o.type === 'capture') {
      if (!isArmed(f)) return 'no armed ships';
      if (enemyArmedAt(state, f.at, side)) return 'blocked by an enemy fleet';
      return 'capturing ' + o.planetId + ' ' + pct(f);
    }
    const sec = byId[o.sectionId];
    if (sec.nebula && state.sections[sec.id].owner !== side) {
      if (!isArmed(f)) return 'no armed ships';
      if (enemyArmedAt(state, f.at, side)) return 'blocked by an enemy fleet';
      return 'taking ' + sec.id + ' ' + pct(f);
    }
    const allMine = sec.nebula || ownedPlanets(state, sec, side) === sec.planets.length;
    return (allMine ? 'holding ' : 'contesting ') + sec.id;
  }

  function updateStatuses() {
    for (const key in statusEls) {
      for (const r of statusEls[key]) {
        r.el.textContent = fleetStatusText(r.fleet);
        if (r.recall) r.recall.classList.toggle('hidden', !away(r.fleet));
      }
    }
  }

  // "Send a fleet" buttons, one per fleet. Rebuilt only when what they depend on changes.
  const sendSigs = {};
  function syncSend(container, spec) {
    const fleets = mine().fleets;
    const key = spec ? spec.key + '|' + fleets.map((f) => f.id + ':' + fleetSize(f) + ':' + (isArmed(f) ? 1 : 0)).join(',') : '';
    if (sendSigs[container.id] === key) return;
    sendSigs[container.id] = key;
    statusEls[container.id] = [];
    container.textContent = '';
    container.classList.toggle('hidden', !spec);
    if (!spec) return;
    container.appendChild(el('div', 'send-title', spec.title));
    if (!fleets.length) container.appendChild(el('div', 'ship-note', 'No fleets yet. Build ships and form a fleet at your capital.'));
    for (const f of fleets) {
      const reason = spec.blocked(f);
      const btn = el('button', 'send-btn');
      btn.disabled = !!reason;
      if (reason) btn.title = reason;
      const status = el('span', 'send-status');
      btn.append(el('span', 'send-name', f.name + ' (' + ships(fleetSize(f)) + ')'), status);
      btn.addEventListener('click', () => { sendFleet(state, side, f.id, spec.order()); update(); });
      statusEls[container.id].push({ fleet: f, el: status });
      container.appendChild(btn);
    }
  }

  function sectionSendSpec() {
    if (!selectedId) return null;
    const s = byId[selectedId];
    const owner = state.sections[selectedId].owner;
    const takeNebula = s.nebula && owner !== side;
    const station = s.nebula ? owner === side : ownedPlanets(state, s, side) === s.planets.length;
    const title = takeNebula ? 'Send a fleet to take this nebula' : station ? 'Station a fleet here' : 'Send a fleet to contest this section';
    return {
      key: 'sec:' + selectedId + ':' + title,
      title,
      blocked: (f) => (fleetSize(f) === 0 ? 'fleet is empty' : takeNebula && !isArmed(f) ? 'taking a nebula needs an armed ship' : null),
      order: () => ({ type: 'contest', sectionId: selectedId }),
    };
  }

  function planetSendSpec() {
    if (!shownPlanet) return null;
    const planet = shownPlanet.planet;
    if (state.planets[planet.id].owner === side) return null;
    return {
      key: 'pl:' + planet.id,
      title: 'Send a fleet to capture this planet',
      blocked: (f) => (fleetSize(f) === 0 ? 'fleet is empty' : !isArmed(f) ? 'capturing needs an armed ship' : null),
      order: () => ({ type: 'capture', planetId: planet.id }),
    };
  }

  // The Fleets list in the overview: every fleet, where it is, and a Recall button when it is away.
  let fleetListSig = '';
  function syncOverviewFleets() {
    const box = $('overview-fleets');
    const fleets = mine().fleets;
    const sig = fleets.map((f) => f.id + ':' + composition(f)).join(',');
    if (sig !== fleetListSig) {
      fleetListSig = sig;
      statusEls.overview = [];
      box.textContent = '';
      if (!fleets.length) box.appendChild(el('div', 'ship-note', 'No fleets yet. Build ships at your capital, then form a fleet.'));
      for (const f of fleets) {
        const row = el('div', 'fleet-row');
        const top = el('div', 'ship-head');
        top.append(el('span', 'ship-name', f.name), el('span', 'ship-role', ships(fleetSize(f))));
        const status = el('div', 'fleet-status');
        const recall = el('button', 'act subtle', 'Recall to capital');
        recall.addEventListener('click', () => { recallFleet(state, side, f.id); update(); });
        row.append(top, el('div', 'ship-note', composition(f)), status, recall);
        box.appendChild(row);
        statusEls.overview.push({ fleet: f, el: status, recall });
      }
    }
  }

  let currentTab = null;

  // ---------- Build tab (capital only) ----------
  // The ship cards are built once. The queue and hangar are rebuilt only when their contents change,
  // and progress bars and button states are updated in place, so clicks are never lost.
  let buildCards = [];  // { type, button, cost }
  let queueBox = null;
  let queueSig = '';
  let queueRows = [];   // { item, bar }

  function renderBuild(container) {
    container.textContent = '';
    buildCards = [];
    queueSig = '';
    container.appendChild(el('p', 'ship-note', 'Ships are built here, at your capital, one at a time. Finished ships wait in the hangar until you put them in a fleet. All numbers are placeholders.'));
    queueBox = el('div', 'queue');
    container.appendChild(queueBox);

    for (const t of SHIP_TYPES) {
      const card = el('div', 'ship ' + t.kind);
      const head = el('div', 'ship-head');
      const title = el('span', 'ship-title');
      title.append(shipIcon(t.id, 46, 30), el('span', 'ship-name', t.name));
      head.append(title, el('span', 'ship-role', t.role));
      card.appendChild(head);
      card.appendChild(el('div', 'ship-blurb', t.blurb));

      const stats = el('dl', 'ship-stats');
      const add = (label, value, valueClass) => {
        const dd = el('dd', valueClass || '', value);
        stats.append(el('dt', '', label), dd);
        return dd;
      };
      add('HP', t.hp);
      add('Damage', t.damage ? t.damage + '/s' : 'none');
      add('Speed', t.speed.toFixed(1));
      add('Build', t.buildTime + ' s');
      const cost = add('Cost', fmt(t.cost), 'ship-cost');
      card.appendChild(stats);

      const button = el('button', 'act', 'Build');
      button.addEventListener('click', () => { queueShip(state, side, t.id); update(); });
      card.appendChild(button);
      container.appendChild(card);
      buildCards.push({ type: t, button, cost });
    }
    refreshBuild();
  }

  function refreshBuild() {
    const m = mine();
    const sig = m.queue.map((q) => q.id).join(',') + '|' + hangarText();
    if (sig !== queueSig) {
      queueSig = sig;
      queueBox.textContent = '';
      queueRows = [];
      queueBox.appendChild(el('div', 'hangar', 'Hangar: ' + hangarText()));
      queueBox.appendChild(el('div', 'queue-title', 'Build queue ' + m.queue.length + '/' + QUEUE_LIMIT));
      if (!m.queue.length) queueBox.appendChild(el('div', 'ship-note', 'Nothing queued.'));
      for (const item of m.queue) {
        const row = el('div', 'q-row');
        const bar = el('div', 'q-bar');
        const fill = el('div');
        bar.appendChild(fill);
        const cancel = el('button', 'x', '×');
        cancel.title = 'Cancel and get the full cost back';
        cancel.addEventListener('click', () => { cancelQueued(state, side, item.id); update(); });
        const qn = el('span', 'q-name');
        qn.append(shipIcon(item.shipId, 30, 20), SHIP_BY_ID[item.shipId].name);
        row.append(qn, bar, cancel);
        queueBox.appendChild(row);
        queueRows.push({ item, fill });
      }
    }
    for (const r of queueRows) {
      const total = SHIP_BY_ID[r.item.shipId].buildTime;
      r.fill.style.width = Math.round((1 - r.item.left / total) * 100) + '%';
    }
    const full = m.queue.length >= QUEUE_LIMIT;
    for (const c of buildCards) {
      const short = m.res < c.type.cost;
      c.cost.classList.toggle('short', short);
      c.button.disabled = short || full;
      c.button.textContent = full ? 'Queue full' : short ? 'Not enough resources' : 'Build';
    }
  }

  // ---------- Fleets tab (capital only) ----------
  let fleetSig = '';
  const fleetSignature = () => JSON.stringify([mine().hangar, mine().fleets.map((f) => [f.id, f.ships, away(f)]), mine().limits]);

  function renderFleets(container) {
    const m = mine();
    fleetSig = fleetSignature();
    statusEls['fleets-tab'] = [];
    container.textContent = '';
    container.appendChild(el('p', 'ship-note', 'You have ' + m.fleets.length + ' of ' + m.limits.fleetCount + ' fleets. Each can hold up to ' + m.limits.fleetSize + ' ships. Upgrades will raise both limits. To send a fleet out, pick a planet or section on the map.'));
    container.appendChild(el('div', 'hangar', 'Hangar: ' + hangarText()));

    const create = el('button', 'act', m.fleets.length >= m.limits.fleetCount ? 'Fleet limit reached' : 'New fleet');
    create.disabled = m.fleets.length >= m.limits.fleetCount;
    create.addEventListener('click', () => { createFleet(state, side); update(); });
    container.appendChild(create);

    for (const fleet of m.fleets) {
      const size = fleetSize(fleet);
      const card = el('div', 'fleet');
      const head = el('div', 'ship-head');
      head.append(el('span', 'ship-name', fleet.name), el('span', 'ship-role', size + '/' + m.limits.fleetSize + ' ships'));
      card.appendChild(head);

      if (away(fleet)) {
        // Away from the capital a fleet cannot be changed. It can only be recalled.
        const status = el('div', 'fleet-status');
        const recall = el('button', 'act', 'Recall to capital');
        recall.addEventListener('click', () => { recallFleet(state, side, fleet.id); update(); });
        card.append(el('div', 'ship-note', composition(fleet)), status, recall);
        statusEls['fleets-tab'].push({ fleet, el: status, recall });
        container.appendChild(card);
        continue;
      }

      const rows = SHIP_TYPES.filter((t) => (fleet.ships[t.id] || 0) > 0 || (m.hangar[t.id] || 0) > 0);
      if (!rows.length) card.appendChild(el('div', 'ship-note', 'No ships to add yet. Build some first.'));
      for (const t of rows) {
        const inFleet = fleet.ships[t.id] || 0;
        const row = el('div', 'f-row');
        const minus = el('button', 'step', '−');
        minus.disabled = inFleet === 0;
        minus.addEventListener('click', () => { removeFromFleet(state, side, fleet.id, t.id); update(); });
        const plus = el('button', 'step', '+');
        plus.disabled = (m.hangar[t.id] || 0) < 1 || size >= m.limits.fleetSize;
        plus.addEventListener('click', () => { addToFleet(state, side, fleet.id, t.id); update(); });
        const fn = el('span', 'f-name');
        fn.append(shipIcon(t.id, 30, 20), t.name);
        row.append(fn, el('span', 'f-count', String(inFleet)), minus, plus, el('span', 'f-hangar', (m.hangar[t.id] || 0) + ' left'));
        card.appendChild(row);
      }
      const disband = el('button', 'act subtle', 'Disband fleet');
      disband.addEventListener('click', () => { disbandFleet(state, side, fleet.id); update(); });
      card.appendChild(disband);
      container.appendChild(card);
    }
  }

  function setTab(name) {
    for (const b of $('sec-tabs').children) b.classList.toggle('active', b.dataset.tab === name);
    const s = byId[selectedId];
    const owner = state.sections[selectedId].owner;
    currentTab = owner === side && !s.nebula ? name : null;
    const plain = currentTab === 'build' || currentTab === 'fleets';
    $('sec-tabbody').classList.toggle('plain', plain);
    buildCards = [];
    if (currentTab === 'build') {
      renderBuild($('sec-tabbody'));
    } else if (currentTab === 'fleets') {
      renderFleets($('sec-tabbody'));
    } else if (owner === side) {
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

  // Badge, tabs and tab content depend on who owns the section, so they are redone whenever that changes.
  let shownOwner;
  function refreshOwnerView() {
    const s = byId[selectedId];
    const owner = state.sections[selectedId].owner;
    shownOwner = owner;
    const label = ownerLabel(owner, s);
    const badge = $('sec-owner');
    badge.textContent = label.text;
    badge.className = 'badge ' + label.cls;

    // Ships are built on planets, so a held nebula has no build or upgrade tabs.
    const yours = owner === side;
    const capital = yours && selectedId === state.home[side];
    $('sec-tabs').classList.toggle('hidden', !yours || !!s.nebula);
    for (const b of $('sec-tabs').children) b.classList.toggle('hidden', b.dataset.tab !== 'upgrades' && !capital);
    setTab(yours && !s.nebula ? (capital ? 'build' : 'upgrades') : null);
  }

  function showSection(id) {
    selectedId = id;
    showPlanet(null, null);
    $('view-overview').classList.toggle('hidden', !!id);
    $('view-section').classList.toggle('hidden', !id);
    if (!id) return;

    const s = byId[id];
    $('sec-title').textContent = sectionTitle(s);
    $('sec-income-label').textContent = s.nebula ? 'Research' : 'Income';
    $('sec-planets').textContent = s.nebula ? 'none' : s.planets.length;
    refreshOwnerView();
    refreshSection();
  }

  function refreshSection() {
    const s = byId[selectedId];
    const owner = state.sections[selectedId].owner;
    const yours = s.nebula ? owner === side : ownedPlanets(state, s, side) > 0 || owner === side;
    if (yours) {
      $('sec-income').textContent = rate(s.nebula ? sectionResearch(state, s) : sectionIncome(state, s, side));
      $('sec-safety').textContent = Math.round(safetyFor(state, selectedId, side) * 100) + '%';
    } else {
      $('sec-income').textContent = owner ? 'unknown' : '-';
      $('sec-safety').textContent = owner ? 'unknown' : '-';
    }
    if (!s.nebula) {
      const n = ownedPlanets(state, s, side);
      $('sec-planets').textContent = n === s.planets.length ? String(n) : n + ' of ' + s.planets.length + ' yours';
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
    const { section, planet } = shownPlanet;
    const owner = state.planets[planet.id].owner;
    const label = ownerLabel(owner, section);
    $('pc-owner').textContent = label.text;
    $('pc-owner').className = label.cls;
    let text;
    if (owner === side) {
      text = section.ion ? '-' : rate(planetIncome(state, section, planet));
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

    syncOverviewSections();
    for (const id in nebulaStatus) {
      nebulaStatus[id].textContent = nebulaText(byId[id]);
    }
    const ionOwner = state.sections.M.owner;
    $('overview-ion').textContent = 'M  ' + (ionOwner === side ? 'held by you' : ionOwner ? 'held by the enemy' : 'unclaimed');

    if (selectedId) {
      if (state.sections[selectedId].owner !== shownOwner) refreshOwnerView();
      refreshSection();
    }
    refreshPlanet();
    if (currentTab === 'build') refreshBuild();
    else if (currentTab === 'fleets' && fleetSignature() !== fleetSig) renderFleets($('sec-tabbody'));

    syncOverviewFleets();
    syncSend($('sec-send'), sectionSendSpec());
    syncSend($('pc-send'), planetSendSpec());
    updateStatuses();

    const banner = $('banner');
    banner.classList.toggle('hidden', !state.winner);
    if (state.winner) {
      banner.textContent = state.winner === side
        ? 'VICTORY. You captured the enemy home planet.'
        : 'DEFEAT. Your home planet was captured.';
    }
  }

  return { update, showSection, showPlanet };
}
