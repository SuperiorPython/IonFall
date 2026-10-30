// How ships look. Drawn entirely in code, no images. Every ship points right (+x) at angle 0.
// Shapes are lists of points around (0, 0); 1 unit is about half a ship length.
// Used by the sidebar (icons) and by the map (fleet markers), so both always match.

const SHIP_ART = {
  skirmisher: {
    rel: 0.62,
    pts: [[1.2, 0], [-0.9, 0.55], [-0.5, 0], [-0.9, -0.55]],
  },
  frigate: {
    rel: 0.78,
    pts: [[1.2, 0], [-0.8, 0.8], [-0.4, 0], [-0.8, -0.8]],
  },
  cruiser: {
    rel: 0.9,
    pts: [[1.2, 0], [0.5, 0.75], [-0.7, 0.75], [-1, 0.4], [-1, -0.4], [-0.7, -0.75], [0.5, -0.75]],
    stripe: [[-0.3, 0.75], [-0.3, -0.75]],
  },
  dreadnought: {
    rel: 1,
    pts: [[1.3, 0], [0.7, 0.55], [0.2, 0.75], [-0.9, 0.75], [-1.2, 0.45], [-1.2, -0.45], [-0.9, -0.75], [0.2, -0.75], [0.7, -0.55]],
    turrets: [[-0.2, 0.35, 0.16], [-0.2, -0.35, 0.16], [0.4, 0, 0.14]],
  },
  infiltrator: {
    rel: 0.78,
    stealth: true, // outline only, dashed, barely filled: it is meant to look half hidden
    pts: [[1.2, 0], [-0.2, 0.35], [-1, 0.95], [-0.7, 0], [-1, -0.95], [-0.2, -0.35]],
  },
};

// Draw one ship. (x, y) is its center, u is the size of one unit in the current drawing units
// (the ship's own size class is applied on top), angle is in radians (0 = pointing right).
function drawShip(ctx, shipId, x, y, u, angle, color, alpha) {
  const art = SHIP_ART[shipId];
  if (!art) return;
  const prevAlpha = ctx.globalAlpha;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.scale(u * art.rel, u * art.rel);
  ctx.globalAlpha = prevAlpha * (alpha === undefined ? 1 : alpha);

  ctx.beginPath();
  art.pts.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])));
  ctx.closePath();
  if (art.stealth) {
    ctx.globalAlpha *= 0.18;
    ctx.fillStyle = color;
    ctx.fill();
    ctx.globalAlpha = prevAlpha * (alpha === undefined ? 1 : alpha);
    ctx.setLineDash([0.25, 0.18]);
    ctx.strokeStyle = color;
    ctx.lineWidth = 0.09;
    ctx.stroke();
    ctx.setLineDash([]);
  } else {
    ctx.fillStyle = color + 'cc';
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.9)';
    ctx.lineWidth = 0.07;
    ctx.stroke();
    if (art.stripe) {
      ctx.beginPath();
      ctx.moveTo(art.stripe[0][0], art.stripe[0][1]);
      ctx.lineTo(art.stripe[1][0], art.stripe[1][1]);
      ctx.strokeStyle = 'rgba(255,255,255,0.5)';
      ctx.lineWidth = 0.06;
      ctx.stroke();
    }
    for (const t of art.turrets || []) {
      ctx.beginPath();
      ctx.arc(t[0], t[1], t[2], 0, Math.PI * 2);
      ctx.fillStyle = '#04060d';
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.9)';
      ctx.lineWidth = 0.05;
      ctx.stroke();
    }
  }
  ctx.restore();
}

// The ship type that stands for a whole fleet on the map: its biggest warship, or the infiltrator if that is all it has.
function fleetLeader(fleet) {
  for (let i = SHIP_TYPES.length - 1; i >= 0; i--) {
    const t = SHIP_TYPES[i];
    if (t.kind === 'combat' && (fleet.ships[t.id] || 0) > 0) return t.id;
  }
  for (const t of SHIP_TYPES) if ((fleet.ships[t.id] || 0) > 0) return t.id;
  return null;
}

// A small canvas with one ship drawn on it, for the sidebar.
function shipIcon(shipId, w, h, color) {
  const dpr = window.devicePixelRatio || 1;
  const c = document.createElement('canvas');
  c.width = Math.round(w * dpr);
  c.height = Math.round(h * dpr);
  c.style.width = w + 'px';
  c.style.height = h + 'px';
  c.className = 'ship-icon';
  const ctx = c.getContext('2d');
  ctx.scale(dpr, dpr);
  // fit the biggest ship (rel 1, about 2.5 units long and 1.5 tall) into the box
  const u = Math.min((w - 4) / 2.5, (h - 4) / 1.6);
  drawShip(ctx, shipId, w / 2, h / 2, u, 0, color || '#4aa3ff');
  return c;
}
