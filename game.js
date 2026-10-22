'use strict';
(() => {
  // ---------- Constants ----------
  const COLS = 10, ROWS = 20, BUF = 3, H = ROWS + BUF;
  const TYPES = 'IJLOSTZ';
  const COLORS = { I: '#45c4d4', J: '#5672e8', L: '#e8954a', O: '#e9c75a', S: '#62bf78', T: '#9a72e6', Z: '#e25768' };
  const SHAPES = {
    I: [[0, 0, 0, 0], [1, 1, 1, 1], [0, 0, 0, 0], [0, 0, 0, 0]],
    J: [[1, 0, 0], [1, 1, 1], [0, 0, 0]],
    L: [[0, 0, 1], [1, 1, 1], [0, 0, 0]],
    O: [[1, 1], [1, 1]],
    S: [[0, 1, 1], [1, 1, 0], [0, 0, 0]],
    T: [[0, 1, 0], [1, 1, 1], [0, 0, 0]],
    Z: [[1, 1, 0], [0, 1, 1], [0, 0, 0]],
  };
  const rotCW = m => m[0].map((_, c) => m.map(r => r[c]).reverse());
  const CELLS = {};
  for (const t of TYPES) {
    let m = SHAPES[t];
    CELLS[t] = [];
    for (let r = 0; r < 4; r++) {
      const cells = [];
      m.forEach((row, y) => row.forEach((v, x) => v && cells.push([x, y])));
      CELLS[t].push(cells);
      m = rotCW(m);
    }
  }

  // SRS wall kicks, y-up as in the guideline (converted when applied).
  const KICKS = {
    '0>1': [[0, 0], [-1, 0], [-1, 1], [0, -2], [-1, -2]],
    '1>0': [[0, 0], [1, 0], [1, -1], [0, 2], [1, 2]],
    '1>2': [[0, 0], [1, 0], [1, -1], [0, 2], [1, 2]],
    '2>1': [[0, 0], [-1, 0], [-1, 1], [0, -2], [-1, -2]],
    '2>3': [[0, 0], [1, 0], [1, 1], [0, -2], [1, -2]],
    '3>2': [[0, 0], [-1, 0], [-1, -1], [0, 2], [-1, 2]],
    '3>0': [[0, 0], [-1, 0], [-1, -1], [0, 2], [-1, 2]],
    '0>3': [[0, 0], [1, 0], [1, 1], [0, -2], [1, -2]],
  };
  const KICKS_I = {
    '0>1': [[0, 0], [-2, 0], [1, 0], [-2, -1], [1, 2]],
    '1>0': [[0, 0], [2, 0], [-1, 0], [2, 1], [-1, -2]],
    '1>2': [[0, 0], [-1, 0], [2, 0], [-1, 2], [2, -1]],
    '2>1': [[0, 0], [1, 0], [-2, 0], [1, -2], [-2, 1]],
    '2>3': [[0, 0], [2, 0], [-1, 0], [2, 1], [-1, -2]],
    '3>2': [[0, 0], [-2, 0], [1, 0], [-2, -1], [1, 2]],
    '3>0': [[0, 0], [1, 0], [-2, 0], [1, -2], [-2, 1]],
    '0>3': [[0, 0], [-1, 0], [2, 0], [-1, 2], [2, -1]],
  };

  const DAS = 150, ARR = 33, LOCK_DELAY = 500, MAX_RESETS = 15;
  const gravityMs = lv => 1000 * Math.pow(Math.max(0.8 - (lv - 1) * 0.007, 0.05), lv - 1);

  // ---------- DOM ----------
  const $ = s => document.querySelector(s);
  const app = $('#app'), gameEl = $('#game'), boardWrap = $('#board-wrap');
  const boardCv = $('#board'), holdCv = $('#hold'), nextCv = $('#next');
  const bctx = boardCv.getContext('2d'), hctx = holdCv.getContext('2d'), nctx = nextCv.getContext('2d');
  const overlay = $('#overlay'), popupEl = $('#popup'), pad = $('#pad');
  const coarse = matchMedia('(pointer: coarse)').matches;
  document.documentElement.classList.add(coarse ? 'coarse' : 'fine');

  // ---------- Storage ----------
  const store = {
    get(k, d) { try { const v = localStorage.getItem('tetris.' + k); return v == null ? d : JSON.parse(v); } catch { return d; } },
    set(k, v) { try { localStorage.setItem('tetris.' + k, JSON.stringify(v)); } catch { /* private mode */ } },
  };
  const settings = Object.assign({ sound: true, ghost: true, haptics: true, pad: false }, store.get('settings', {}));
  let best = store.get('best', 0);

  // ---------- Audio (tiny synth, no assets) ----------
  let actx = null;
  function audio() {
    if (!settings.sound) return null;
    if (!actx) { try { actx = new (window.AudioContext || window.webkitAudioContext)(); } catch { return null; } }
    if (actx.state === 'suspended') actx.resume();
    return actx;
  }
  function tone(freq, dur, { type = 'sine', vol = 0.08, at = 0, to = 0 } = {}) {
    const a = audio(); if (!a) return;
    const t = a.currentTime + at;
    const o = a.createOscillator(), g = a.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (to) o.frequency.exponentialRampToValueAtTime(to, t + dur);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(a.destination);
    o.start(t); o.stop(t + dur + 0.02);
  }
  const sfx = {
    move: () => tone(330, 0.035, { type: 'triangle', vol: 0.025 }),
    rotate: () => tone(520, 0.05, { type: 'triangle', vol: 0.04, to: 620 }),
    lock: () => tone(140, 0.09, { vol: 0.12, to: 80 }),
    hard: () => { tone(200, 0.12, { vol: 0.16, to: 60 }); tone(90, 0.12, { type: 'triangle', vol: 0.08 }); },
    hold: () => tone(420, 0.08, { type: 'sine', vol: 0.06, to: 300 }),
    clear(n) {
      const notes = [523, 659, 784, 1047, 1319];
      for (let i = 0; i < n + 1; i++) tone(notes[i], 0.16, { type: 'triangle', vol: 0.07, at: i * 0.055 });
      if (n >= 4) tone(1568, 0.35, { type: 'sine', vol: 0.06, at: 0.28 });
    },
    tspin: () => { tone(880, 0.1, { type: 'square', vol: 0.03 }); tone(1175, 0.18, { type: 'triangle', vol: 0.06, at: 0.07 }); },
    level: () => [523, 784, 1047].forEach((f, i) => tone(f, 0.18, { type: 'triangle', vol: 0.07, at: i * 0.09 })),
    over: () => [392, 330, 262, 196].forEach((f, i) => tone(f, 0.3, { type: 'triangle', vol: 0.08, at: i * 0.16 })),
  };
  const vibrate = ms => { if (settings.haptics && navigator.vibrate) try { navigator.vibrate(ms); } catch { /* ignore */ } };

  // ---------- Game state ----------
  let board, bag, queue, cur, holdType, holdUsed, score, lines, level, combo, b2b;
  let state = 'menu';
  let gravityAcc = 0, lockTimer = 0, lockResets = 0, lowestY = 0;
  let lastRotate = false, lastKick = 0;
  let clearing = null;   // { rows, t, dur }
  let flashes = [];      // [{ cells, t }]
  let softDrop = false;
  let dasDir = 0, dasTimer = 0, arrTimer = 0;
  const held = { left: false, right: false };
  let overAnim = null;

  const emptyRow = () => new Array(COLS).fill(null);

  function shuffle(a) {
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    return a;
  }
  function nextType() {
    if (!bag.length) bag = shuffle([...TYPES]);
    return bag.pop();
  }

  function collide(t, r, x, y) {
    for (const [cx, cy] of CELLS[t][r]) {
      const bx = x + cx, by = y + cy;
      if (bx < 0 || bx >= COLS || by >= H) return true;
      if (by >= 0 && board[by][bx]) return true;
    }
    return false;
  }
  const grounded = () => collide(cur.t, cur.r, cur.x, cur.y + 1);

  function reset() {
    board = Array.from({ length: H }, emptyRow);
    bag = [];
    queue = [];
    while (queue.length < 5) queue.push(nextType());
    holdType = null; holdUsed = false;
    score = 0; lines = 0; level = 1; combo = -1; b2b = false;
    clearing = null; flashes = []; overAnim = null;
    softDrop = false; dasDir = 0; held.left = held.right = false;
    updateHud(true);
  }

  function spawn(t) {
    if (!t) { t = queue.shift(); queue.push(nextType()); }
    cur = { t, r: 0, x: t === 'O' ? 4 : 3, y: BUF - 2 };
    if (collide(cur.t, 0, cur.x, cur.y)) return gameOver();
    if (!collide(cur.t, 0, cur.x, cur.y + 1)) cur.y++;
    gravityAcc = 0; lockTimer = 0; lockResets = 0; lowestY = cur.y;
    lastRotate = false;
    drawSide();
  }

  function onMoved() {
    if (grounded() && lockResets < MAX_RESETS) { lockTimer = 0; lockResets++; }
  }
  function fell() {
    lastRotate = false;
    if (cur.y > lowestY) { lowestY = cur.y; lockResets = 0; lockTimer = 0; }
  }

  function move(dx) {
    if (!cur || collide(cur.t, cur.r, cur.x + dx, cur.y)) return false;
    cur.x += dx; lastRotate = false; onMoved(); sfx.move();
    return true;
  }

  function rotate(dir) {
    if (!cur || cur.t === 'O') return false;
    const from = cur.r, to = (from + dir + 4) % 4;
    const kicks = (cur.t === 'I' ? KICKS_I : KICKS)[from + '>' + to];
    for (let i = 0; i < kicks.length; i++) {
      const nx = cur.x + kicks[i][0], ny = cur.y - kicks[i][1];
      if (!collide(cur.t, to, nx, ny)) {
        cur.x = nx; cur.y = ny; cur.r = to;
        lastRotate = true; lastKick = i;
        if (cur.y > lowestY) { lowestY = cur.y; lockResets = 0; }
        onMoved(); sfx.rotate();
        return true;
      }
    }
    return false;
  }

  function softStep() {
    if (!cur || grounded()) return false;
    cur.y++; score++; fell(); updateHud();
    return true;
  }

  function hardDrop() {
    if (!cur) return;
    let d = 0;
    while (!grounded()) { cur.y++; d++; }
    if (d) { score += 2 * d; lastRotate = false; }
    sfx.hard(); vibrate(15);
    boardWrap.classList.remove('bump'); void boardWrap.offsetWidth; boardWrap.classList.add('bump');
    lock();
  }

  function hold() {
    if (!cur || holdUsed) return;
    holdUsed = true;
    const t = cur.t;
    sfx.hold();
    if (holdType) { const h = holdType; holdType = t; spawn(h); }
    else { holdType = t; spawn(); }
  }

  function tspinKind() {
    if (cur.t !== 'T' || !lastRotate) return 0;
    const occ = (x, y) => x < 0 || x >= COLS || y >= H || (y >= 0 && !!board[y][x]);
    const { x, y } = cur;
    const c = [occ(x, y), occ(x + 2, y), occ(x + 2, y + 2), occ(x, y + 2)];
    if (c.filter(Boolean).length < 3) return 0;
    const [a, b] = [[0, 1], [1, 2], [2, 3], [3, 0]][cur.r];
    return (c[a] && c[b]) || lastKick === 4 ? 2 : 1;
  }

  function lock() {
    const ts = tspinKind();
    const cells = [];
    let above = true;
    for (const [cx, cy] of CELLS[cur.t][cur.r]) {
      const x = cur.x + cx, y = cur.y + cy;
      if (y >= 0) board[y][x] = cur.t;
      if (y >= BUF) above = false;
      cells.push([x, y]);
    }
    flashes.push({ cells, t: 0 });
    cur = null;
    holdUsed = false;
    if (above) return gameOver();

    const full = [];
    for (let y = 0; y < H; y++) if (board[y].every(Boolean)) full.push(y);
    const n = full.length;

    // Scoring (modern guideline)
    let base = 0, title = '';
    const names = ['', 'Single', 'Double', 'Triple', 'Tetris'];
    if (ts === 2) { base = [400, 800, 1200, 1600][n]; title = 'T-Spin' + (n ? ' ' + names[n] : ''); }
    else if (ts === 1) { base = [100, 200, 400][n] || 400; title = 'Mini T-Spin' + (n ? ' ' + names[n] : ''); }
    else { base = [0, 100, 300, 500, 800][n]; title = n === 4 ? 'Tetris' : ''; }
    const extras = [];
    if (n) {
      const hard = n === 4 || ts > 0;
      if (hard && b2b) { base *= 1.5; extras.push('Back-to-Back'); }
      b2b = hard;
      combo++;
      if (combo > 0) { score += 50 * combo * level; extras.push('Combo ×' + combo); }
    } else combo = -1;
    score += Math.round(base * level);

    if (ts) sfx.tspin();
    if (n) {
      // Perfect clear: every row empty apart from the ones being cleared.
      const pc = board.every((row, y) => full.includes(y) || row.every(v => !v));
      if (pc) { score += [0, 800, 1200, 1800, 2000][n] * level; title = 'Perfect Clear'; extras.unshift(names[n]); }
      clearing = { rows: full, t: 0, dur: n === 4 ? 320 : 240 };
      sfx.clear(n); vibrate(n === 4 ? [20, 40, 30] : 25);
    } else {
      sfx.lock(); vibrate(8);
    }
    if (title || extras.length) popup(title, extras.join(' · '));
    updateHud();
    if (!n) spawn();
  }

  function finishClear() {
    const rows = clearing.rows;
    clearing = null;
    for (const y of rows) { board.splice(y, 1); board.unshift(emptyRow()); }
    const before = level;
    lines += rows.length;
    level = 1 + Math.floor(lines / 10);
    if (level > before) { sfx.level(); setTimeout(() => popup('Level ' + level, ''), 500); }
    updateHud();
    spawn();
  }

  function gameOver() {
    cur = null;
    state = 'over';
    softDrop = false; dasDir = 0;
    sfx.over(); vibrate([40, 60, 40]);
    const isBest = score > best;
    if (isBest) { best = score; store.set('best', best); }
    $('#final-score').textContent = score.toLocaleString();
    $('#final-detail').innerHTML = `Level <b>${level}</b> · Lines <b>${lines}</b>`;
    $('#new-best').hidden = !isBest || score === 0;
    overAnim = { t: 0 };
    updateHud(true);
    setTimeout(() => showOverlay('over'), 900);
  }

  // ---------- Loop ----------
  function update(dt) {
    for (const f of flashes) f.t += dt;
    flashes = flashes.filter(f => f.t < 160);

    if (clearing) {
      clearing.t += dt;
      if (clearing.t >= clearing.dur) finishClear();
      return;
    }
    if (!cur) return;

    // Horizontal auto-repeat (keyboard + pad)
    if (dasDir) {
      dasTimer += dt;
      if (dasTimer >= DAS) {
        arrTimer += dt;
        while (arrTimer >= ARR) { arrTimer -= ARR; if (!move(dasDir)) { arrTimer = 0; break; } }
      }
    }
    if (!cur) return;

    const g = gravityMs(level);
    const interval = softDrop ? Math.min(g, Math.max(g / 20, 16)) : g;
    if (grounded()) {
      gravityAcc = 0;
      lockTimer += dt;
      if (lockTimer >= LOCK_DELAY || lockResets >= MAX_RESETS && lockTimer >= LOCK_DELAY / 5) lock();
    } else {
      gravityAcc += dt;
      while (gravityAcc >= interval && !grounded()) {
        gravityAcc -= interval;
        cur.y++;
        if (softDrop) score++;
        fell();
      }
      if (softDrop) updateHud();
    }
  }

  let last = performance.now();
  function frame(now) {
    const dt = Math.min(now - last, 100);
    last = now;
    if (state === 'play') update(dt);
    if (state === 'play' || overAnim || flashes.length) {
      if (overAnim) overAnim.t += dt;
      drawBoard();
      if (overAnim && overAnim.t > 1200) overAnim = null;
    }
    requestAnimationFrame(frame);
  }

  // ---------- Rendering ----------
  let c = 30, dpr = 1, sprites = {}, bgCanvas = null, mode = 'side';
  const hexToRgb = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
  const mix = (hex, amt) => {
    const [r, g, b] = hexToRgb(hex), t = amt > 0 ? 255 : 0, a = Math.abs(amt);
    return `rgb(${Math.round(r + (t - r) * a)},${Math.round(g + (t - g) * a)},${Math.round(b + (t - b) * a)})`;
  };
  const rgba = (hex, a) => { const [r, g, b] = hexToRgb(hex); return `rgba(${r},${g},${b},${a})`; };

  function rr(ctx, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function drawBlock(ctx, x, y, s, color) {
    const gap = Math.max(1, s * 0.06), w = s - gap, x0 = x + gap / 2, y0 = y + gap / 2;
    const r = Math.min(3, s * 0.08), edge = Math.max(1, s * 0.07);
    const g = ctx.createLinearGradient(x, y, x, y + s);
    g.addColorStop(0, mix(color, 0.1));
    g.addColorStop(1, mix(color, -0.12));
    ctx.fillStyle = g;
    rr(ctx, x0, y0, w, w, r); ctx.fill();
    ctx.save();
    rr(ctx, x0, y0, w, w, r); ctx.clip();
    ctx.fillStyle = 'rgba(255,255,255,0.22)';
    ctx.fillRect(x0, y0, w, edge);
    ctx.fillStyle = 'rgba(0,0,0,0.22)';
    ctx.fillRect(x0, y0 + w - edge, w, edge);
    ctx.restore();
  }

  function makeSprites() {
    sprites = {};
    const px = Math.round(c * dpr);
    for (const t of [...TYPES, 'X']) {
      const cv = document.createElement('canvas');
      cv.width = cv.height = px;
      const ctx = cv.getContext('2d');
      drawBlock(ctx, 0, 0, px, t === 'X' ? '#3a3d4e' : COLORS[t]);
      sprites[t] = cv;
    }
    bgCanvas = document.createElement('canvas');
    bgCanvas.width = Math.round(COLS * c * dpr); bgCanvas.height = Math.round(ROWS * c * dpr);
    const g = bgCanvas.getContext('2d');
    g.scale(dpr, dpr);
    g.strokeStyle = 'rgba(255,255,255,0.045)';
    g.lineWidth = 1 / dpr;
    g.beginPath();
    for (let x = 1; x < COLS; x++) { g.moveTo(x * c, 0); g.lineTo(x * c, ROWS * c); }
    for (let y = 1; y < ROWS; y++) { g.moveTo(0, y * c); g.lineTo(COLS * c, y * c); }
    g.stroke();
  }

  function setCanvas(cv, ctx, w, h) {
    cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr);
    cv.style.width = w + 'px'; cv.style.height = h + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function ghostY() {
    let y = cur.y;
    while (!collide(cur.t, cur.r, cur.x, y + 1)) y++;
    return y;
  }

  function drawBoard() {
    const ctx = bctx, W = COLS * c, Hh = ROWS * c;
    ctx.clearRect(0, 0, W, Hh);
    ctx.drawImage(bgCanvas, 0, 0, W, Hh);

    const overRows = overAnim ? Math.min(ROWS, Math.floor(overAnim.t / 40)) : -1;
    const clearP = clearing ? clearing.t / clearing.dur : 0;
    let highest = H;

    for (let y = BUF; y < H; y++) {
      const isClearing = clearing && clearing.rows.includes(y);
      for (let x = 0; x < COLS; x++) {
        const v = board[y][x];
        if (!v) continue;
        if (y < highest) highest = y;
        if (isClearing) {
          // Wipe from the center outward.
          if (Math.abs(x - 4.5) < clearP * 6) continue;
        }
        const grey = overAnim && H - 1 - y < overRows;
        ctx.drawImage(sprites[grey ? 'X' : v], x * c, (y - BUF) * c, c, c);
      }
      if (isClearing) {
        ctx.fillStyle = `rgba(255,255,255,${0.35 * (1 - clearP)})`;
        ctx.fillRect(0, (y - BUF) * c, W, c);
      }
    }
    boardWrap.classList.toggle('danger', state === 'play' && highest - BUF < 4);

    if (cur) {
      const cells = CELLS[cur.t][cur.r];
      if (settings.ghost) {
        const gy = ghostY(), col = COLORS[cur.t];
        if (gy !== cur.y) {
          ctx.lineWidth = Math.max(1, Math.round(c * 0.05));
          ctx.strokeStyle = rgba(col, 0.5);
          ctx.fillStyle = rgba(col, 0.07);
          const lw = ctx.lineWidth;
          for (const [cx, cy] of cells) {
            const yy = gy + cy - BUF; if (yy < 0) continue;
            const px = (cur.x + cx) * c, py = yy * c, pad = c * 0.03 + lw / 2;
            ctx.fillRect(px + pad, py + pad, c - 2 * pad, c - 2 * pad);
            ctx.strokeRect(px + pad, py + pad, c - 2 * pad, c - 2 * pad);
          }
        }
      }
      // Fade the piece slightly while lock delay runs out.
      const fade = grounded() ? 1 - 0.35 * Math.min(1, lockTimer / LOCK_DELAY) : 1;
      ctx.globalAlpha = fade;
      for (const [cx, cy] of cells) {
        const yy = cur.y + cy - BUF; if (yy < 0) continue;
        ctx.drawImage(sprites[cur.t], (cur.x + cx) * c, yy * c, c, c);
      }
      ctx.globalAlpha = 1;
    }

    for (const f of flashes) {
      ctx.fillStyle = `rgba(255,255,255,${0.5 * (1 - f.t / 160)})`;
      for (const [x, y] of f.cells) {
        if (y < BUF) continue;
        ctx.fillRect(x * c + c * 0.03, (y - BUF) * c + c * 0.03, c * 0.94, c * 0.94);
      }
    }
  }

  function drawPiece(ctx, t, cx, cy, s, dim = false) {
    const cells = CELLS[t][0];
    const xs = cells.map(p => p[0]), ys = cells.map(p => p[1]);
    const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
    const ox = cx - ((maxX - minX + 1) * s) / 2, oy = cy - ((maxY - minY + 1) * s) / 2;
    for (const [x, y] of cells) drawBlock(ctx, ox + (x - minX) * s, oy + (y - minY) * s, s, dim ? '#3a3d4e' : COLORS[t]);
  }

  let holdDims, nextDims;
  function drawSide() {
    const [hw, hh, hs] = holdDims;
    hctx.clearRect(0, 0, hw, hh);
    if (holdType) drawPiece(hctx, holdType, hw / 2, hh / 2, hs, holdUsed);

    const { w, h, slots } = nextDims;
    nctx.clearRect(0, 0, w, h);
    if (!queue) return;
    slots.forEach((sl, i) => { if (queue[i]) drawPiece(nctx, queue[i], sl.x, sl.y, sl.s); });
  }

  // ---------- HUD ----------
  const scoreEl = $('#score'), levelEl = $('#level'), linesEl = $('#lines'), bestEl = $('#best');
  let hudCache = '';
  function updateHud(force) {
    const key = score + '|' + level + '|' + lines + '|' + best;
    if (!force && key === hudCache) return;
    hudCache = key;
    scoreEl.textContent = score.toLocaleString();
    levelEl.textContent = level;
    linesEl.textContent = lines;
    bestEl.textContent = Math.max(best, score).toLocaleString();
    document.querySelectorAll('.best-val').forEach(e => { e.textContent = best.toLocaleString(); });
  }

  let popupTimer = 0;
  function popup(big, small) {
    popupEl.innerHTML = (big ? `<span class="big">${big}</span>` : '') + (small ? `<span class="small">${small}</span>` : '');
    popupEl.classList.remove('go'); void popupEl.offsetWidth; popupEl.classList.add('go');
    clearTimeout(popupTimer);
    popupTimer = setTimeout(() => popupEl.classList.remove('go'), 1200);
  }

  // ---------- Layout ----------
  function layout() {
    const cs = getComputedStyle(app);
    const W = app.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
    let Hh = app.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom);
    const showPad = settings.pad;
    pad.hidden = !showPad;
    if (showPad) {
      const ph = Math.round(Math.max(52, Math.min(76, Hh * 0.085)));
      app.style.setProperty('--pad-h', ph + 'px');
      Hh -= ph + 12;
    }
    const cSide = Math.floor(Math.min(W / 20.2, (Hh - 2) / 20));
    const cTop = Math.floor(Math.min((W - 2) / 10, (Hh - 2) / 23.9));
    mode = cSide >= cTop ? 'side' : 'top';
    c = Math.max(10, mode === 'side' ? cSide : cTop);
    dpr = Math.min(window.devicePixelRatio || 1, 3);
    document.documentElement.style.setProperty('--c', c + 'px');
    gameEl.className = mode;

    setCanvas(boardCv, bctx, COLS * c, ROWS * c);
    if (mode === 'side') {
      const w = Math.round(c * 3.8), s1 = Math.round(c * 0.8), s2 = Math.round(c * 0.62);
      holdDims = [w, Math.round(c * 2.2), s1];
      const slots = [{ x: w / 2, y: c * 1.1, s: s1 }];
      for (let i = 1; i < 5; i++) slots.push({ x: w / 2, y: c * 2.2 + c * 1.75 * (i - 0.5), s: s2 });
      nextDims = { w, h: Math.round(c * 2.2 + c * 1.75 * 4), slots };
    } else {
      const s1 = Math.round(c * 0.5), s2 = Math.round(c * 0.38), h = Math.round(c * 1.25);
      holdDims = [Math.round(c * 2.0), h, s1];
      const first = c * 2.1, rest = c * 1.45;
      const slots = [{ x: first / 2, y: h / 2, s: s1 }];
      for (let i = 0; i < 3; i++) slots.push({ x: first + rest * (i + 0.5), y: h / 2, s: s2 });
      nextDims = { w: Math.round(first + rest * 3), h, slots };
    }
    setCanvas(holdCv, hctx, holdDims[0], holdDims[1]);
    setCanvas(nextCv, nctx, nextDims.w, nextDims.h);
    makeSprites();
    drawBoard();
    drawSide();
  }

  // ---------- Overlay & settings ----------
  function showOverlay(name) {
    document.querySelectorAll('.card').forEach(el => el.classList.toggle('show', el.id === name));
    overlay.classList.toggle('show', !!name);
    if (name) {
      const btn = document.querySelector(`#${name} .btn.primary`);
      if (btn && !coarse) btn.focus({ preventScroll: true });
    }
  }

  const TOGGLES = [
    ['sound', 'Sound'],
    ['ghost', 'Ghost piece'],
    ['haptics', 'Vibration', () => 'vibrate' in navigator],
    ['pad', 'On-screen buttons'],
  ];
  function buildSettings() {
    document.querySelectorAll('.settings').forEach(box => {
      box.innerHTML = '';
      for (const [key, label, avail] of TOGGLES) {
        if (avail && !avail()) continue;
        const l = document.createElement('label');
        l.className = 'toggle';
        l.innerHTML = `<span>${label}</span><input type="checkbox" data-set="${key}"><span class="sw"></span>`;
        box.appendChild(l);
      }
    });
    syncSettings();
  }
  function syncSettings() {
    document.querySelectorAll('[data-set]').forEach(i => { i.checked = !!settings[i.dataset.set]; });
  }
  overlay.addEventListener('change', e => {
    const k = e.target.dataset && e.target.dataset.set;
    if (!k) return;
    settings[k] = e.target.checked;
    store.set('settings', settings);
    syncSettings();
    if (k === 'pad') layout();
    if (k === 'sound' && settings.sound) sfx.rotate();
  });

  function start() {
    audio();
    reset();
    state = 'play';
    showOverlay(null);
    last = performance.now();
    spawn();
  }
  function pause() {
    if (state !== 'play') return;
    state = 'pause';
    softDrop = false; dasDir = 0; held.left = held.right = false;
    showOverlay('paused');
  }
  function resume() {
    if (state !== 'pause') return;
    state = 'play';
    last = performance.now();
    showOverlay(null);
  }
  function toMenu() {
    state = 'menu';
    updateHud(true);
    showOverlay('menu');
  }

  overlay.addEventListener('click', e => {
    const b = e.target.closest('[data-act]');
    if (!b) return;
    ({ start, resume, restart: start, menu: toMenu })[b.dataset.act]();
  });
  $('#pause').addEventListener('click', pause);

  // ---------- Keyboard ----------
  const KEYMAP = {
    ArrowLeft: 'left', ArrowRight: 'right', ArrowDown: 'down',
    ArrowUp: 'cw', KeyX: 'cw', KeyW: 'cw',
    KeyZ: 'ccw', ControlLeft: 'ccw', ControlRight: 'ccw',
    Space: 'drop', KeyC: 'hold', ShiftLeft: 'hold', ShiftRight: 'hold',
    Escape: 'pause', KeyP: 'pause', KeyA: 'left', KeyD: 'right', KeyS: 'down',
  };

  function press(act) {
    if (state !== 'play') return;
    switch (act) {
      case 'left': case 'right': {
        const d = act === 'left' ? -1 : 1;
        held[act] = true;
        dasDir = d; dasTimer = 0; arrTimer = 0;
        move(d);
        break;
      }
      case 'down': softDrop = true; softStep(); break;
      case 'cw': rotate(1); break;
      case 'ccw': rotate(-1); break;
      case 'drop': hardDrop(); break;
      case 'hold': hold(); break;
      case 'pause': pause(); break;
    }
  }
  function release(act) {
    if (act === 'left' || act === 'right') {
      held[act] = false;
      const other = act === 'left' ? 'right' : 'left';
      if (held[other]) { dasDir = other === 'left' ? -1 : 1; dasTimer = 0; arrTimer = 0; }
      else dasDir = 0;
    } else if (act === 'down') softDrop = false;
  }

  document.addEventListener('keydown', e => {
    const act = KEYMAP[e.code];
    if (state === 'menu' || state === 'over') {
      if (e.code === 'Enter' || e.code === 'Space') { e.preventDefault(); start(); }
      return;
    }
    if (state === 'pause') {
      if (act === 'pause' || e.code === 'Enter') { e.preventDefault(); resume(); }
      return;
    }
    if (!act) return;
    e.preventDefault();
    if (e.repeat) return;
    press(act);
  });
  document.addEventListener('keyup', e => {
    const act = KEYMAP[e.code];
    if (act) release(act);
  });

  // ---------- Touch gestures ----------
  let gest = null;
  const TAP_MS = 250, TAP_PX = 10;

  app.addEventListener('pointerdown', e => {
    if (e.pointerType === 'mouse' || state !== 'play') return;
    if (e.target.closest('button, #pad, #overlay')) return;
    if (gest) return; // single-finger gestures only
    audio();
    gest = {
      id: e.pointerId, x0: e.clientX, y0: e.clientY, t0: e.timeStamp,
      ax: e.clientX, ay: e.clientY, axis: null, moved: false, done: false,
      hist: [{ x: e.clientX, y: e.clientY, t: e.timeStamp }],
    };
  });

  app.addEventListener('pointermove', e => {
    if (!gest || e.pointerId !== gest.id || gest.done || state !== 'play') return;
    const g = gest, x = e.clientX, y = e.clientY;
    g.hist.push({ x, y, t: e.timeStamp });
    while (g.hist.length > 2 && e.timeStamp - g.hist[0].t > 100) g.hist.shift();
    const step = Math.max(14, c * 0.9);
    const tx = x - g.x0, ty = y - g.y0;
    if (!g.axis && Math.hypot(tx, ty) > TAP_PX) g.axis = Math.abs(tx) > Math.abs(ty) ? 'x' : 'y';
    if (!g.axis) return;
    // Allow switching axis once the other direction clearly dominates.
    if (g.axis === 'x' && y - g.ay > step * 1.6 && Math.abs(y - g.ay) > Math.abs(x - g.ax) * 1.5) g.axis = 'y';
    if (g.axis === 'y' && Math.abs(x - g.ax) > step * 1.2 && Math.abs(x - g.ax) > Math.abs(y - g.ay)) { g.axis = 'x'; }

    if (g.axis === 'x') {
      let dx = x - g.ax;
      while (Math.abs(dx) >= step) {
        const d = Math.sign(dx);
        move(d); g.ax += d * step; dx -= d * step; g.moved = true;
      }
      g.ay = y;
    } else {
      let dy = y - g.ay;
      while (dy >= step) { softStep(); g.ay += step; dy -= step; g.moved = true; }
      if (dy < 0) g.ay = Math.min(g.ay, y); // moving up re-anchors
      g.ax = x;
    }
  });

  function endGesture(e) {
    if (!gest || e.pointerId !== gest.id) return;
    const g = gest; gest = null;
    if (g.done || state !== 'play') return;
    const dt = e.timeStamp - g.t0;
    const tx = e.clientX - g.x0, ty = e.clientY - g.y0;
    const h0 = g.hist[0];
    const span = Math.max(1, e.timeStamp - h0.t);
    const vy = (e.clientY - h0.y) / span, vx = (e.clientX - h0.x) / span;

    if (e.type === 'pointercancel') return;
    if (vy > 0.9 && ty > 40 && Math.abs(vy) > Math.abs(vx) * 1.4) { hardDrop(); return; }
    if (vy < -0.6 && ty < -40 && Math.abs(vy) > Math.abs(vx)) { hold(); return; }
    if (!g.moved && dt < TAP_MS + 150 && Math.hypot(tx, ty) < TAP_PX * 1.6) {
      rotate(e.clientX < window.innerWidth / 2 ? -1 : 1);
    }
  }
  app.addEventListener('pointerup', endGesture);
  app.addEventListener('pointercancel', endGesture);

  // On-screen pad
  pad.addEventListener('pointerdown', e => {
    const b = e.target.closest('[data-pad]');
    if (!b) return;
    e.preventDefault();
    audio();
    b.classList.add('on');
    try { b.setPointerCapture(e.pointerId); } catch { /* ignore */ }
    press(b.dataset.pad);
  });
  const padUp = e => {
    const b = e.target.closest('[data-pad]');
    if (!b) return;
    b.classList.remove('on');
    release(b.dataset.pad);
  };
  pad.addEventListener('pointerup', padUp);
  pad.addEventListener('pointercancel', padUp);
  pad.addEventListener('contextmenu', e => e.preventDefault());

  // Block page gestures (iOS pinch, double-tap zoom, pull to refresh).
  document.addEventListener('touchmove', e => { if (!e.target.closest('#overlay')) e.preventDefault(); }, { passive: false });
  document.addEventListener('gesturestart', e => e.preventDefault());
  document.addEventListener('dblclick', e => e.preventDefault());

  document.addEventListener('visibilitychange', () => { if (document.hidden) pause(); });
  window.addEventListener('blur', pause);

  let resizeRaf = 0;
  const onResize = () => { cancelAnimationFrame(resizeRaf); resizeRaf = requestAnimationFrame(layout); };
  window.addEventListener('resize', onResize);
  window.addEventListener('orientationchange', () => setTimeout(layout, 250));
  if (window.visualViewport) visualViewport.addEventListener('resize', onResize);

  // ---------- Boot ----------
  reset();
  buildSettings();
  layout();
  showOverlay('menu');
  requestAnimationFrame(frame);

  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
  }

  // Exposed for automated tests only.
  window.__tetris = { get state() { return state; }, get cur() { return cur; }, get board() { return board; }, get score() { return score; }, press, release, start };
})();
