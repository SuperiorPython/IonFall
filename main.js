// Drawing and input for the galaxy map, plus the loop that ticks the game.
// Rules live in state.js and the dashboard lives in ui.js.

(function () {
  const stage = document.getElementById('stage');
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');

  const COLORS = {
    A: '#4aa3ff',    // side A (blue)
    B: '#ff6a55',    // side B (red)
    N: '#7ff0ff',    // ion / neutral (cyan)
    lane: 'rgba(255, 255, 255, 0.5)',
    text: '#c9d4e8',
  };
  const PAD = 8; // empty border around the map, in screen pixels

  const galaxy = generateGalaxy();
  const byId = {};
  for (const s of galaxy.sections) byId[s.id] = s;

  const state = createState(galaxy);
  const ui = createUI({ state, galaxy, byId, select });

  // Background stars: random but fixed, stored as fractions of the screen.
  const starRng = mulberry32(777);
  const stars = [];
  for (let i = 0; i < 260; i++) {
    stars.push({ u: starRng(), v: starRng(), a: 0.2 + starRng() * 0.6 });
  }

  let view = { dpr: 1, w: 0, h: 0, scale: 1, ox: 0, oy: 0 };
  let hover = null;
  let selected = null;

  function select(id) {
    selected = id ? byId[id] : null;
    ui.showSection(id);
    draw();
  }

  function resize() {
    const dpr = window.devicePixelRatio || 1;
    const w = stage.clientWidth;
    const h = stage.clientHeight;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';
    const scale = Math.min((w - PAD * 2) / WORLD_W, (h - PAD * 2) / WORLD_H);
    view = {
      dpr, w, h, scale,
      ox: (w - WORLD_W * scale) / 2,
      oy: (h - WORLD_H * scale) / 2,
    };
    draw();
  }

  function sideColor(side) { return COLORS[side] || COLORS.N; }

  function drawStars() {
    ctx.setTransform(view.dpr, 0, 0, view.dpr, 0, 0);
    ctx.fillStyle = '#ffffff';
    for (const s of stars) {
      ctx.globalAlpha = s.a;
      ctx.fillRect(Math.floor(s.u * view.w), Math.floor(s.v * view.h), 1, 1);
    }
    ctx.globalAlpha = 1;
  }

  function drawLanes() {
    ctx.lineWidth = 2;
    ctx.strokeStyle = COLORS.lane;
    for (const lane of galaxy.lanes) {
      const a = byId[lane.a];
      const b = byId[lane.b];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const len = Math.hypot(dx, dy);
      const ux = dx / len;
      const uy = dy / len;
      ctx.setLineDash(lane.cross ? [10, 8] : []);
      ctx.beginPath();
      ctx.moveTo(a.x + ux * (a.r + 6), a.y + uy * (a.r + 6));
      ctx.lineTo(b.x - ux * (b.r + 6), b.y - uy * (b.r + 6));
      ctx.stroke();
    }
    ctx.setLineDash([]);
  }

  function drawSection(s) {
    const owner = state.sections[s.id].owner;
    const color = sideColor(owner || 'N');
    const isHover = hover === s;
    const isSelected = selected === s;

    // soft tinted fill
    const g = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, s.r);
    g.addColorStop(0, color + (isHover || isSelected ? '33' : '1f'));
    g.addColorStop(1, color + '08');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
    ctx.fill();

    // outline: white when selected, bright when hovered
    ctx.lineWidth = isSelected ? 3.5 : isHover ? 3 : 1.5;
    ctx.strokeStyle = isSelected ? '#ffffff' : color + (isHover ? 'ff' : '88');
    ctx.stroke();

    // label above the section
    ctx.fillStyle = COLORS.text;
    ctx.font = '14px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    const label = s.ion ? 'M  ION SECTION' : s.home ? s.id + '  HOME' : s.id;
    ctx.fillText(label, s.x, s.y - s.r - 8);

    for (const p of s.planets) drawPlanet(p, color);
  }

  function drawPlanet(p, color) {
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
      ctx.lineWidth = 2;
      ctx.strokeStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r + 6, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  function drawHoverInfo() {
    if (!hover) return;
    ctx.setTransform(view.dpr, 0, 0, view.dpr, 0, 0);
    const owner = state.sections[hover.id].owner;
    const ownerText = owner ? 'side ' + owner : 'unclaimed';
    const extra = hover.ion ? ' | superweapon fuel' : hover.home ? ' | home section' : '';
    ctx.fillStyle = COLORS.text;
    ctx.font = '14px monospace';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(hover.id + ' | ' + hover.planets.length + ' planets | ' + ownerText + extra, 16, view.h - 16);
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
    drawLanes();
    for (const s of galaxy.sections) drawSection(s);

    drawHoverInfo();
  }

  function sectionAt(e) {
    const rect = canvas.getBoundingClientRect();
    const wx = (e.clientX - rect.left - view.ox) / view.scale;
    const wy = (e.clientY - rect.top - view.oy) / view.scale;
    for (const s of galaxy.sections) {
      if (Math.hypot(wx - s.x, wy - s.y) <= s.r) return s;
    }
    return null;
  }

  canvas.addEventListener('mousemove', (e) => {
    const found = sectionAt(e);
    if (found !== hover) {
      hover = found;
      draw();
    }
  });

  canvas.addEventListener('mouseleave', () => {
    if (hover) {
      hover = null;
      draw();
    }
  });

  canvas.addEventListener('click', (e) => {
    const found = sectionAt(e);
    select(found ? found.id : null);
  });

  // Game loop: tick the rules about 10 times a second and refresh the dashboard.
  let last = performance.now();
  setInterval(() => {
    const now = performance.now();
    const dt = Math.min((now - last) / 1000, 0.25); // cap so a background tab doesn't jump ahead
    last = now;
    tickState(state, galaxy, dt);
    ui.update();
  }, 100);

  new ResizeObserver(resize).observe(stage);
  ui.update();
  resize();

  // Handy for poking at the game from the browser console while developing.
  window.ionfall = {
    galaxy, state,
    toClient(x, y) {
      const rect = canvas.getBoundingClientRect();
      return { x: rect.left + view.ox + x * view.scale, y: rect.top + view.oy + y * view.scale };
    },
  };
})();
