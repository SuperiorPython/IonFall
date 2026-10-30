// Drawing, camera, and input for the galaxy map, plus the loop that ticks the game.
// Rules live in state.js and the dashboard lives in ui.js.
//
// The camera works like this: cam.x / cam.y is the world point at the center of the screen,
// and cam.zoom multiplies the "fit the whole galaxy" scale. zoom = 1 shows everything.
// Clicking a section flies the camera into it; clicking empty space (or Esc) steps back out.

(function () {
  const stage = document.getElementById('stage');
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');

  const COLORS = {
    A: '#4aa3ff',    // side A (blue)
    B: '#ff6a55',    // side B (red)
    N: '#7ff0ff',    // ion / neutral (cyan)
    V: '#b58cff',    // nebula (violet)
    lane: 'rgba(255, 255, 255, 0.5)',
    text: '#c9d4e8',
    dim: '#7d8aa5',
    pick: '#ffd24a', // selected planet
  };
  const PAD = 8;               // empty border around the galaxy view, in screen pixels
  const ZOOM_FILL = 0.78;      // how much of the screen a zoomed section fills
  const FLY_MS = 380;          // camera animation length
  const reduceMotion = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

  // A different map: add ?seed=123 to the page address.
  const seedParam = new URLSearchParams(window.location.search).get('seed');
  const seed = seedParam !== null && seedParam.trim() !== '' && !Number.isNaN(Number(seedParam)) ? Number(seedParam) : DEFAULT_SEED;
  const galaxy = generateGalaxy(seed);
  document.getElementById('seed-note').textContent = 'Map seed ' + seed + '. Add ?seed=123 to the address for a different layout.';
  const byId = {};
  for (const s of galaxy.sections) byId[s.id] = s;

  const state = createState(galaxy);
  const ui = createUI({ state, galaxy, byId, select, selectPlanet });

  // Background stars: random but fixed, stored as fractions of the screen.
  const starRng = mulberry32(777);
  const stars = [];
  for (let i = 0; i < 260; i++) {
    stars.push({ u: starRng(), v: starRng(), a: 0.2 + starRng() * 0.6 });
  }

  // Galaxy dust: thousands of faint points that follow the two spiral arms, thicker and warmer near the core.
  // Only for looks. Fixed per map seed, stored in world coordinates.
  const dustRng = mulberry32((seed ^ 0x5bd1e995) >>> 0);
  const gauss = () => dustRng() + dustRng() + dustRng() + dustRng() - 2;
  const dust = [];
  for (let i = 0; i < 3600; i++) {
    const arm = galaxy.arms[i % 2];
    const t = Math.pow(dustRng(), 0.8) * 1.08 + 0.02;
    const p = armPoint(arm, t);
    const q = armPoint(arm, t + 0.02);
    const len = Math.hypot(q.x - p.x, q.y - p.y) || 1;
    const spread = (28 + 70 * t) * gauss();
    dust.push({
      x: p.x - ((q.y - p.y) / len) * spread + gauss() * 14,
      y: p.y + ((q.x - p.x) / len) * spread + gauss() * 14,
      a: 0.08 + dustRng() * 0.3,
      warm: t < 0.45 ? 1 : 0,
      s: dustRng() < 0.12 ? 2 : 1,
    });
  }

  const cam = { x: WORLD_W / 2, y: WORLD_H / 2, zoom: 1 };
  const view = { dpr: 1, w: 0, h: 0, scale: 1, ox: 0, oy: 0 };
  let anim = null;

  let hover = null;          // section under the mouse (galaxy view)
  let hoverPlanet = null;    // planet under the mouse (zoomed view)
  let selected = null;       // selected section
  let selectedPlanet = null;
  let zoomedId = null;       // section we are zoomed into (null = galaxy view)
  let focusId = null;        // like zoomedId, but kept until the zoom-out animation finishes

  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const px = (n) => n / view.scale; // a size in screen pixels, converted to world units

  // ---------- camera ----------
  function fitScale() {
    return Math.min((view.w - PAD * 2) / WORLD_W, (view.h - PAD * 2) / WORLD_H);
  }

  function updateView() {
    view.scale = fitScale() * cam.zoom;
    view.ox = view.w / 2 - cam.x * view.scale;
    view.oy = view.h / 2 - cam.y * view.scale;
  }

  function targetFor(section) {
    if (!section) return { x: WORLD_W / 2, y: WORLD_H / 2, zoom: 1 };
    const wanted = (ZOOM_FILL * Math.min(view.w, view.h)) / (2 * section.r);
    return { x: section.x, y: section.y, zoom: Math.max(1, wanted / fitScale()) };
  }

  function flyTo(target) {
    if (reduceMotion) {
      Object.assign(cam, target);
      anim = null;
      if (!zoomedId) focusId = null;
      updateView();
      draw();
      return;
    }
    anim = { from: { x: cam.x, y: cam.y, zoom: cam.zoom }, to: target, t0: performance.now() };
    requestAnimationFrame(step);
  }

  function step(now) {
    if (!anim) return;
    const t = clamp((now - anim.t0) / FLY_MS, 0, 1);
    const e = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; // ease in-out
    cam.x = lerp(anim.from.x, anim.to.x, e);
    cam.y = lerp(anim.from.y, anim.to.y, e);
    cam.zoom = Math.exp(lerp(Math.log(anim.from.zoom), Math.log(anim.to.zoom), e)); // zoom evenly
    updateView();
    draw();
    if (t < 1) {
      requestAnimationFrame(step);
    } else {
      anim = null;
      if (!zoomedId) focusId = null;
      draw();
    }
  }

  function zoomInto(section) {
    zoomedId = focusId = section.id;
    hover = null;
    hoverPlanet = null;
    flyTo(targetFor(section));
  }

  function zoomOut() {
    zoomedId = null;
    hoverPlanet = null;
    flyTo(targetFor(null));
  }

  // ---------- selection ----------
  function select(id) {
    selectedPlanet = null;
    ui.showPlanet(null, null);
    selected = id ? byId[id] : null;
    ui.showSection(id);
    // Only sections with planets are worth zooming into; a nebula just gets selected.
    if (id && byId[id].planets.length) zoomInto(byId[id]);
    else if (zoomedId || cam.zoom !== 1) zoomOut();
    draw();
  }

  function selectPlanet(planet) {
    selectedPlanet = planet;
    ui.showPlanet(planet && zoomedId ? byId[zoomedId] : null, planet);
    draw();
  }

  // ---------- drawing ----------
  function resize() {
    const dpr = window.devicePixelRatio || 1;
    const w = stage.clientWidth;
    const h = stage.clientHeight;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';
    view.dpr = dpr;
    view.w = w;
    view.h = h;

    anim = null; // a resize snaps the camera to where it should be
    Object.assign(cam, targetFor(zoomedId ? byId[zoomedId] : null));
    if (!zoomedId) focusId = null;
    updateView();
    draw();
  }

  function sideColor(side) { return COLORS[side] || COLORS.N; }

  // 0 in the galaxy view, up to 1 when fully zoomed: how much to fade everything but the focused section.
  function dimAmount() {
    return focusId ? clamp((cam.zoom - 1.05) / 1.0, 0, 1) : 0;
  }

  function drawStars() {
    ctx.setTransform(view.dpr, 0, 0, view.dpr, 0, 0);
    ctx.fillStyle = '#ffffff';
    for (const s of stars) {
      ctx.globalAlpha = s.a;
      ctx.fillRect(Math.floor(s.u * view.w), Math.floor(s.v * view.h), 1, 1);
    }
    ctx.globalAlpha = 1;
  }

  // The galaxy itself: a soft flattened disc, a warm glowing core, and dust along the arms. Drawn in world space.
  function drawBackdrop() {
    const fade = 1 - 0.7 * dimAmount();
    const core = byId.M;

    ctx.save();
    ctx.globalAlpha = fade;
    ctx.translate(WORLD_W / 2, WORLD_H / 2);
    ctx.scale(1, ARM_SQUASH);
    const disc = ctx.createRadialGradient(0, 0, 0, 0, 0, 820);
    disc.addColorStop(0, 'rgba(70, 95, 170, 0.20)');
    disc.addColorStop(0.55, 'rgba(40, 60, 120, 0.09)');
    disc.addColorStop(1, 'rgba(20, 30, 70, 0)');
    ctx.fillStyle = disc;
    ctx.beginPath();
    ctx.arc(0, 0, 820, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    ctx.globalAlpha = fade;
    const glow = ctx.createRadialGradient(core.x, core.y, 0, core.x, core.y, 330);
    glow.addColorStop(0, 'rgba(255, 214, 150, 0.16)');
    glow.addColorStop(0.4, 'rgba(255, 190, 130, 0.06)');
    glow.addColorStop(1, 'rgba(255, 190, 130, 0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(core.x, core.y, 330, 0, Math.PI * 2);
    ctx.fill();

    const size = px(1.4);
    for (const d of dust) {
      ctx.globalAlpha = d.a * fade;
      ctx.fillStyle = d.warm ? '#ffe2b8' : '#b9d0ff';
      ctx.fillRect(d.x, d.y, size * d.s, size * d.s);
    }
    ctx.globalAlpha = 1;
  }

  function drawLanes() {
    ctx.globalAlpha = 1 - 0.8 * dimAmount();
    ctx.lineWidth = px(2);
    for (const lane of galaxy.lanes) {
      const a = byId[lane.a];
      const b = byId[lane.b];
      ctx.strokeStyle = a.nebula || b.nebula ? 'rgba(181, 140, 255, 0.55)' : COLORS.lane;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const len = Math.hypot(dx, dy);
      const ux = dx / len;
      const uy = dy / len;
      ctx.setLineDash(lane.cross ? [px(10), px(8)] : []);
      ctx.beginPath();
      ctx.moveTo(a.x + ux * (a.r + 6), a.y + uy * (a.r + 6));
      ctx.lineTo(b.x - ux * (b.r + 6), b.y - uy * (b.r + 6));
      ctx.stroke();
    }
    ctx.setLineDash([]);
    ctx.globalAlpha = 1;
  }

  function drawSection(s) {
    const owner = state.sections[s.id].owner;
    const color = sideColor(owner || (s.nebula ? 'V' : 'N'));
    const faded = focusId && s.id !== focusId;
    const isHover = hover === s;
    const isSelected = selected === s;

    ctx.globalAlpha = faded ? 1 - 0.8 * dimAmount() : 1;

    // soft tinted fill (nebulas always stay violet, so they read as a separate kind of section)
    const fill = s.nebula ? COLORS.V : color;
    const g = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, s.r);
    g.addColorStop(0, fill + (isHover || isSelected ? '33' : '1f'));
    g.addColorStop(1, fill + '08');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
    ctx.fill();
    if (s.nebula) drawNebulaCloud(s, isHover || isSelected);

    // outline: white when selected, bright when hovered. Nebulas are dashed and take the owner's color when held.
    ctx.lineWidth = px(isSelected ? 3.5 : isHover ? 3 : 1.5);
    ctx.strokeStyle = isSelected ? '#ffffff' : color + (isHover ? 'ff' : '88');
    ctx.setLineDash(s.nebula && !isSelected ? [px(5), px(5)] : []);
    ctx.stroke();
    ctx.setLineDash([]);

    // label above the section
    ctx.fillStyle = COLORS.text;
    ctx.font = px(14) + 'px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    const label = s.ion ? 'M  ION SECTION' : s.nebula ? s.id + '  NEBULA' : s.home ? s.id + '  HOME' : s.id;
    ctx.fillText(label, s.x, s.y - s.r - px(8));

    for (const p of s.planets) drawPlanet(p, s, color);
    ctx.globalAlpha = 1;
  }

  // A nebula is a few overlapping soft violet blobs. This is only for looks: there are no planets inside.
  function drawNebulaCloud(s, bright) {
    for (const b of s.blobs) {
      const bx = s.x + b.dx * s.r;
      const by = s.y + b.dy * s.r;
      const br = b.rr * s.r;
      const g = ctx.createRadialGradient(bx, by, 0, bx, by, br);
      g.addColorStop(0, 'rgba(181, 140, 255, ' + Math.min(0.9, b.a * (bright ? 2.8 : 2.2)) + ')');
      g.addColorStop(1, 'rgba(181, 140, 255, 0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(bx, by, br, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawPlanet(p, s, color) {
    if (p.ion) {
      const glow = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r * 3);
      glow.addColorStop(0, 'rgba(127, 240, 255, 0.45)');
      glow.addColorStop(1, 'rgba(127, 240, 255, 0)');
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r * 3, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.fillStyle = p.ion ? COLORS.N : color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
    ctx.fill();

    if (p.home) {
      ctx.lineWidth = px(2);
      ctx.strokeStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r + px(6), 0, Math.PI * 2);
      ctx.stroke();
    }
    if (p === hoverPlanet) {
      ctx.lineWidth = px(1.5);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)';
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r + px(p.home ? 11 : 5), 0, Math.PI * 2);
      ctx.stroke();
    }
    if (p === selectedPlanet) {
      ctx.lineWidth = px(2.5);
      ctx.strokeStyle = COLORS.pick;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r + px(p.home ? 11 : 5), 0, Math.PI * 2);
      ctx.stroke();
    }

    // Names fade in as the camera closes in on the section.
    if (s.id === focusId) {
      const alpha = clamp((cam.zoom - 1.6) / 1.2, 0, 1);
      if (alpha > 0) {
        const prev = ctx.globalAlpha;
        ctx.globalAlpha = prev * alpha;
        ctx.textAlign = 'center';
        ctx.fillStyle = COLORS.text;
        ctx.font = px(13) + 'px monospace';
        ctx.fillText(p.id, p.x, p.y + p.r + px(p.home ? 26 : 18));
        const owner = state.sections[s.id].owner;
        const sub = owner === state.player ? (s.ion ? '' : '+' + planetIncome(state, s).toFixed(1) + '/s') : p.ion ? 'ion' : '';
        if (sub) {
          ctx.fillStyle = COLORS.dim;
          ctx.font = px(12) + 'px monospace';
          ctx.fillText(sub, p.x, p.y + p.r + px(p.home ? 40 : 32));
        }
        ctx.globalAlpha = prev;
      }
    }
  }

  function drawHoverInfo() {
    let text = null;
    if (zoomedId && hoverPlanet) {
      const kind = hoverPlanet.home ? 'home planet' : hoverPlanet.ion ? 'ion planet' : 'colony';
      text = hoverPlanet.id + ' | ' + kind;
    } else if (!zoomedId && hover) {
      const owner = state.sections[hover.id].owner;
      const ownerText = owner ? 'side ' + owner : 'unclaimed';
      const extra = hover.ion ? ' | superweapon fuel' : hover.home ? ' | home section' : '';
      text = hover.nebula
        ? hover.id + ' | nebula | research | ' + ownerText
        : hover.id + ' | ' + hover.planets.length + ' planets | ' + ownerText + extra;
    }
    if (!text) return;
    ctx.setTransform(view.dpr, 0, 0, view.dpr, 0, 0);
    ctx.fillStyle = COLORS.text;
    ctx.font = '14px monospace';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(text, 16, view.h - 16);
  }

  function draw() {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#04060d';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    drawStars();

    ctx.setTransform(
      view.dpr * view.scale, 0, 0, view.dpr * view.scale,
      view.dpr * view.ox, view.dpr * view.oy
    );
    drawBackdrop();
    drawLanes();
    for (const s of galaxy.sections) drawSection(s);

    drawHoverInfo();
  }

  // ---------- picking ----------
  function worldPoint(e) {
    updateView();
    const rect = canvas.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left - view.ox) / view.scale,
      y: (e.clientY - rect.top - view.oy) / view.scale,
    };
  }

  function sectionAt(e) {
    const w = worldPoint(e);
    for (const s of galaxy.sections) {
      if (Math.hypot(w.x - s.x, w.y - s.y) <= s.r) return s;
    }
    return null;
  }

  function planetAt(e) {
    const w = worldPoint(e);
    for (const p of byId[zoomedId].planets) {
      if (Math.hypot(w.x - p.x, w.y - p.y) <= p.r + px(6)) return p;
    }
    return null;
  }

  function updateCursor() {
    canvas.style.cursor = (zoomedId ? hoverPlanet : hover) ? 'pointer' : 'default';
  }

  canvas.addEventListener('mousemove', (e) => {
    if (anim) return;
    if (zoomedId) {
      const p = planetAt(e);
      if (p !== hoverPlanet) {
        hoverPlanet = p;
        updateCursor();
        draw();
      }
      return;
    }
    const s = sectionAt(e);
    if (s !== hover) {
      hover = s;
      updateCursor();
      draw();
    }
  });

  canvas.addEventListener('mouseleave', () => {
    if (hover || hoverPlanet) {
      hover = null;
      hoverPlanet = null;
      updateCursor();
      draw();
    }
  });

  // Clicking empty space always steps back one level: planet -> section -> galaxy.
  canvas.addEventListener('click', (e) => {
    if (anim) return; // ignore clicks while the camera is moving
    if (zoomedId) {
      const p = planetAt(e);
      if (p) selectPlanet(p);
      else if (selectedPlanet) selectPlanet(null);
      else select(null);
      return;
    }
    const s = sectionAt(e);
    select(s ? s.id : null);
  });

  // ---------- game loop ----------
  // Tick the rules about 10 times a second and refresh the dashboard.
  let last = performance.now();
  setInterval(() => {
    const now = performance.now();
    const dt = Math.min((now - last) / 1000, 0.25); // cap so a background tab doesn't jump ahead
    last = now;
    tickState(state, galaxy, dt);
    ui.update();
    if (zoomedId) draw(); // keeps the per-planet income labels current
  }, 100);

  new ResizeObserver(resize).observe(stage);
  ui.update();
  resize();

  // Handy for poking at the game from the browser console while developing.
  window.ionfall = {
    galaxy, state,
    camera: cam,
    get zoomedId() { return zoomedId; },
    get selectedPlanetId() { return selectedPlanet ? selectedPlanet.id : null; },
    get animating() { return !!anim; },
    toClient(x, y) {
      updateView();
      const rect = canvas.getBoundingClientRect();
      return { x: rect.left + view.ox + x * view.scale, y: rect.top + view.oy + y * view.scale };
    },
  };
})();
