'use strict';
(() => {
  // ---------- Constants ----------
  const COLS = 10, ROWS = 20, BUF = 3, H = ROWS + BUF;
  const TYPES = 'IJLOSTZ';
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
  const KICKS_180 = [[0, 0], [0, 1], [1, 0], [-1, 0], [1, 1], [-1, 1], [0, -1]];

  const LOCK_DELAY = 500, MAX_RESETS = 15;
  const gravityMs = lv => 1000 * Math.pow(Math.max(0.8 - (lv - 1) * 0.007, 0.05), lv - 1);

  const MODES = {
    marathon: { name: 'Marathon', desc: 'Endless. Speeds up every 10 lines.', levels: true, rank: 'score' },
    sprint: { name: 'Sprint', desc: 'Clear 40 lines as fast as you can.', goal: 40, rank: 'time' },
    ultra: { name: 'Ultra', desc: 'Highest score in 2 minutes.', limit: 120000, levels: true, rank: 'score' },
    zen: { name: 'Zen', desc: 'No speed-up, no game over. Just play.', zen: true, rank: 'score' },
  };

  // Each theme pairs a palette with a tile style. `board` is the solid board colour used on canvases,
  // `flash` the rgb used for lock flashes and the line-clear sweep.
  const THEMES = {
    midnight: {
      name: 'Midnight', style: 'soft', meta: '#0c0d11', board: '#07080b', dead: '#3a3d4e', flash: '255,255,255',
      colors: { I: '#45c4d4', J: '#5672e8', L: '#e8954a', O: '#e9c75a', S: '#62bf78', T: '#9a72e6', Z: '#e25768' },
    },
    paper: {
      name: 'Paper', style: 'flat', meta: '#efece5', board: '#faf8f3', dead: '#cfcabf', flash: '60,50,30',
      colors: { I: '#5ea8b2', J: '#4d66b0', L: '#d58a45', O: '#dcb54f', S: '#6ea46f', T: '#8b67b1', Z: '#c95d5d' },
    },
    aurora: {
      name: 'Aurora', style: 'glass', meta: '#0a0f1f', board: '#101a30', dead: '#4a5878', flash: '255,255,255',
      colors: { I: '#7ff3e8', J: '#8fb2ff', L: '#ffc08a', O: '#fff08f', S: '#9ef7a8', T: '#d7a6ff', Z: '#ff9ec4' },
    },
    jewel: {
      name: 'Jewel', style: 'gem', meta: '#140a1f', board: '#0b0612', dead: '#3b3045', flash: '255,240,255',
      colors: { I: '#3fd0d4', J: '#1f5fd0', L: '#f2a65a', O: '#e8be1c', S: '#1fa35b', T: '#9966cc', Z: '#e0115f' },
    },
    sumi: {
      name: 'Sumi', style: 'ink', meta: '#efe8da', board: '#f7f2e7', dead: '#cbc2b0', flash: '192,57,43',
      colors: { I: '#1f2023', J: '#2f3b55', L: '#8a3b2b', O: '#1f2023', S: '#3c4a3e', T: '#c0392b', Z: '#4a3f35' },
    },
    terracotta: {
      name: 'Terracotta', style: 'mosaic', meta: '#e9dccb', board: '#f4ece1', dead: '#cbbba6', flash: '120,70,30',
      colors: { I: '#2f7f7a', J: '#3d4f8a', L: '#c8643b', O: '#d9a441', S: '#7d8a4a', T: '#7a4466', Z: '#b5473a' },
    },
    bauhaus: {
      name: 'Bauhaus', style: 'dot', meta: '#f2ede3', board: '#f8f5ee', dead: '#d6cfc1', flash: '31,31,31',
      colors: { I: '#1b4b9b', J: '#1f1f1f', L: '#e4572e', O: '#f2b705', S: '#2a9d8f', T: '#d7263d', Z: '#6a994e' },
    },
    blueprint: {
      name: 'Blueprint', style: 'blueprint', meta: '#123a6b', board: '#15467f', dead: '#3d6aa3', flash: '255,255,255', grid: 0.9,
      colors: { I: '#bfe9ff', J: '#a9c4ff', L: '#ffd2a8', O: '#fff1a8', S: '#c4f5c8', T: '#e2c6ff', Z: '#ffc1c9' },
    },
    synthwave: {
      name: 'Synthwave', style: 'stripe', meta: '#12062a', board: '#0c0418', dead: '#3a2550', flash: '255,120,220', grid: 0.8,
      colors: { I: '#2de2e6', J: '#7b5cff', L: '#ff9e3d', O: '#ffd319', S: '#00f5a0', T: '#ff3cac', Z: '#ff3864' },
    },
    neon: {
      name: 'Neon', style: 'neon', meta: '#05050a', board: '#030308', dead: '#2b2e44', flash: '255,255,255',
      colors: { I: '#00f0ff', J: '#4d7bff', L: '#ff9a1f', O: '#ffe14d', S: '#3dff7a', T: '#c45bff', Z: '#ff3d7f' },
    },
    arcade: {
      name: '8-Bit', style: 'pixel', meta: '#000000', board: '#000000', dead: '#444444', flash: '255,255,255',
      colors: { I: '#3cbcfc', J: '#0058f8', L: '#f87858', O: '#f8b800', S: '#58d854', T: '#d800cc', Z: '#e40058' },
    },
    terminal: {
      name: 'Terminal', style: 'ascii', meta: '#000000', board: '#020a03', dead: '#145522', flash: '51,255,102',
      colors: { I: '#33ff66', J: '#22cc55', L: '#7dffa4', O: '#33ff66', S: '#22cc55', T: '#ffcc33', Z: '#7dffa4' },
    },
    retro: {
      name: 'Retro', style: 'retro', meta: '#9bbc0f', board: '#8bac0f', dead: '#6b8c0f', flash: '155,188,15',
      colors: { I: '#0f380f', J: '#306230', L: '#0f380f', O: '#306230', S: '#0f380f', T: '#306230', Z: '#306230' },
    },
    graphite: {
      name: 'Graphite', style: 'soft', meta: '#111111', board: '#0a0a0a', dead: '#2c2c2c', flash: '255,255,255',
      colors: { I: '#e8e8e8', J: '#8c8c8c', L: '#bdbdbd', O: '#f6f6f6', S: '#a3a3a3', T: '#d4d4d4', Z: '#747474' },
    },
  };
  // Tile styles with per-cell variation get several sprite variants.
  const VARIANTS = { ink: 4, mosaic: 4 };

  // ---------- DOM ----------
  const $ = s => document.querySelector(s);
  const $$ = s => document.querySelectorAll(s);
  const app = $('#app'), gameEl = $('#game'), boardWrap = $('#board-wrap');
  const boardCv = $('#board'), holdCv = $('#hold'), nextCv = $('#next');
  const bctx = boardCv.getContext('2d'), hctx = holdCv.getContext('2d'), nctx = nextCv.getContext('2d');
  const overlay = $('#overlay'), popupEl = $('#popup'), countEl = $('#count'), pad = $('#pad'), toast = $('#toast');
  const coarse = matchMedia('(pointer: coarse)').matches;
  document.documentElement.classList.add(coarse ? 'coarse' : 'fine');

  // ---------- Storage ----------
  const store = {
    get(k, d) { try { const v = localStorage.getItem('tetris.' + k); return v == null ? d : JSON.parse(v); } catch { return d; } },
    set(k, v) { try { localStorage.setItem('tetris.' + k, JSON.stringify(v)); } catch { /* private mode */ } },
  };
  const settings = Object.assign({
    sound: true, music: false, ghost: true, haptics: true, pad: false, rot180: false,
    sens: 1, das: 150, arr: 33, startLevel: 1, theme: 'midnight', mode: 'marathon',
  }, store.get('settings', {}));
  if (!THEMES[settings.theme]) settings.theme = 'midnight';
  if (!MODES[settings.mode]) settings.mode = 'marathon';
  const saveSettings = () => store.set('settings', settings);

  const records = Object.assign({ marathon: [], sprint: [], ultra: [], zen: [] }, store.get('records', {}));
  // Carry over the best score from the first version.
  const legacyBest = store.get('best', 0);
  if (legacyBest && !records.marathon.length) records.marathon.push({ score: legacyBest, lines: 0, time: 0, level: 1, pps: 0, date: Date.now() });
  const lifetime = Object.assign({ games: 0, lines: 0, pieces: 0, tetrises: 0, tspins: 0, time: 0 }, store.get('lifetime', {}));

  // ---------- Audio (tiny synth, no assets) ----------
  let actx = null;
  function ctxAudio() {
    if (!actx) { try { actx = new (window.AudioContext || window.webkitAudioContext)(); } catch { return null; } }
    if (actx.state === 'suspended') actx.resume();
    return actx;
  }
  function tone(freq, dur, { type = 'sine', vol = 0.08, at = 0, to = 0 } = {}) {
    if (!settings.sound) return;
    const a = ctxAudio(); if (!a) return;
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
    tick: () => tone(660, 0.08, { type: 'sine', vol: 0.06 }),
    go: () => tone(990, 0.16, { type: 'sine', vol: 0.07 }),
    over: () => [392, 330, 262, 196].forEach((f, i) => tone(f, 0.3, { type: 'triangle', vol: 0.08, at: i * 0.16 })),
    win: () => [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.25, { type: 'triangle', vol: 0.08, at: i * 0.1 })),
  };
  const vibrate = ms => { if (settings.haptics && navigator.vibrate) try { navigator.vibrate(ms); } catch { /* ignore */ } };

  // Generative ambient music: slow pads over Am–F–C–G with a sparse pentatonic pluck.
  const music = {
    bus: null, timer: 0, next: 0, step: 0,
    CHORDS: [[57, 60, 64, 67], [53, 57, 60, 64], [48, 55, 60, 64], [55, 59, 62, 67]],
    BAR: 4.8,
    start() {
      if (this.timer || !settings.music) return;
      const a = ctxAudio(); if (!a) return;
      const bus = a.createGain(), lp = a.createBiquadFilter(), dl = a.createDelay(1), fb = a.createGain(), wet = a.createGain();
      lp.type = 'lowpass'; lp.frequency.value = 1600;
      dl.delayTime.value = 0.45; fb.gain.value = 0.35; wet.gain.value = 0.3;
      bus.gain.setValueAtTime(0, a.currentTime);
      bus.gain.linearRampToValueAtTime(0.9, a.currentTime + 2);
      bus.connect(lp); lp.connect(a.destination); lp.connect(dl); dl.connect(fb).connect(dl); dl.connect(wet).connect(a.destination);
      this.bus = bus; this.nodes = [lp, dl, fb, wet];
      this.next = a.currentTime + 0.1;
      this.timer = setInterval(() => this.tick(), 250);
      this.tick();
    },
    note(m, t, dur, vol, type, attack) {
      const a = actx, o = a.createOscillator(), g = a.createGain();
      o.type = type; o.frequency.value = 440 * Math.pow(2, (m - 69) / 12);
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(vol, t + attack);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g).connect(this.bus);
      o.start(t); o.stop(t + dur + 0.05);
    },
    tick() {
      const a = actx; if (!a || !this.bus) return;
      while (this.next < a.currentTime + 1) {
        const t = this.next, beat = this.step % 8, chord = this.CHORDS[Math.floor(this.step / 8) % 4];
        if (beat === 0) {
          chord.slice(0, 3).forEach(m => this.note(m, t, this.BAR + 1.5, 0.018, 'triangle', 1.2));
          this.note(chord[0] - 12, t, this.BAR, 0.035, 'sine', 0.4);
        }
        if (Math.random() < 0.42) {
          const pent = [0, 3, 5, 7, 10], root = chord[0] + 12;
          this.note(root + pent[Math.floor(Math.random() * 5)] + (Math.random() < 0.3 ? 12 : 0), t, 1.4, 0.022, 'sine', 0.01);
        }
        this.step++;
        this.next += this.BAR / 8;
      }
    },
    stop() {
      if (!this.timer) return;
      clearInterval(this.timer); this.timer = 0;
      const bus = this.bus, nodes = this.nodes, a = actx;
      this.bus = null;
      try {
        bus.gain.cancelScheduledValues(a.currentTime);
        bus.gain.setValueAtTime(bus.gain.value, a.currentTime);
        bus.gain.linearRampToValueAtTime(0, a.currentTime + 0.6);
      } catch { /* ignore */ }
      setTimeout(() => { bus.disconnect(); nodes.forEach(n => n.disconnect()); }, 4000);
    },
  };

  // ---------- Game state ----------
  let board, bag, queue, cur, holdType, holdUsed, score, lines, level, combo, b2b;
  let mode = settings.mode, M = MODES[mode];
  let state = 'menu';
  let gravityAcc = 0, lockTimer = 0, lockResets = 0, lowestY = 0;
  let lastRotate = false, lastKick = 0;
  let clearing = null;   // { rows, t, dur }
  let flashes = [];      // [{ cells, t }]
  let softDrop = false;
  let dasDir = 0, dasTimer = 0, arrTimer = 0;
  const held = { left: false, right: false };
  let overAnim = null, countT = 0;
  let elapsed = 0, pieces = 0, tetrises = 0, tspins = 0, dispScore = 0;

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
    mode = settings.mode; M = MODES[mode];
    board = Array.from({ length: H }, emptyRow);
    bag = [];
    queue = [];
    while (queue.length < 5) queue.push(nextType());
    holdType = null; holdUsed = false; cur = null;
    score = 0; dispScore = 0; lines = 0; combo = -1; b2b = false;
    level = M.levels ? settings.startLevel : 1;
    elapsed = 0; pieces = 0; tetrises = 0; tspins = 0;
    clearing = null; flashes = []; overAnim = null;
    softDrop = false; dasDir = 0; held.left = held.right = false;
    updateHud(true);
  }

  function spawn(t) {
    if (!t) { t = queue.shift(); queue.push(nextType()); }
    cur = { t, r: 0, x: t === 'O' ? 4 : 3, y: BUF - 2 };
    if (collide(cur.t, 0, cur.x, cur.y)) {
      if (!M.zen) return finish('topout');
      zenClear();
    }
    if (!collide(cur.t, 0, cur.x, cur.y + 1)) cur.y++;
    gravityAcc = 0; lockTimer = 0; lockResets = 0; lowestY = cur.y;
    lastRotate = false;
    drawSide();
  }

  function zenClear() {
    for (let y = 0; y < H; y++) if (board[y].some(Boolean)) flashes.push({ cells: board[y].map((v, x) => [x, y]).filter(([x]) => board[y][x]), t: 0 });
    board = Array.from({ length: H }, emptyRow);
    popup('Fresh board', '');
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
    const kicks = dir === 2 ? KICKS_180 : (cur.t === 'I' ? KICKS_I : KICKS)[from + '>' + to];
    for (let i = 0; i < kicks.length; i++) {
      const nx = cur.x + kicks[i][0], ny = cur.y - kicks[i][1];
      if (!collide(cur.t, to, nx, ny)) {
        cur.x = nx; cur.y = ny; cur.r = to;
        lastRotate = true; lastKick = dir === 2 ? 0 : i;
        if (cur.y > lowestY) { lowestY = cur.y; lockResets = 0; }
        onMoved(); sfx.rotate();
        return true;
      }
    }
    return false;
  }

  function softStep() {
    if (!cur || grounded()) return false;
    cur.y++; score++; fell();
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
    pieces++;
    if (above) {
      if (!M.zen) return finish('topout');
      zenClear(); spawn(); return;
    }

    const full = [];
    for (let y = 0; y < H; y++) if (board[y].every(Boolean)) full.push(y);
    const n = full.length;

    // Scoring (modern guideline)
    let base = 0, title = '';
    const names = ['', 'Single', 'Double', 'Triple', 'Tetris'];
    if (ts === 2) { base = [400, 800, 1200, 1600][n]; title = 'T-Spin' + (n ? ' ' + names[n] : ''); }
    else if (ts === 1) { base = [100, 200, 400][n] || 400; title = 'Mini T-Spin' + (n ? ' ' + names[n] : ''); }
    else { base = [0, 100, 300, 500, 800][n]; title = n === 4 ? 'Tetris' : ''; }
    if (ts) tspins++;
    if (n === 4) tetrises++;
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
      clearing = { rows: full, t: 0, dur: n === 4 ? 380 : 280, big: n === 4 || pc };
      sfx.clear(n); vibrate(n === 4 ? [20, 40, 30] : 25);
    } else {
      sfx.lock(); vibrate(8);
    }
    if (title || extras.length) popup(title, extras.join(' · '));
    if (!n) spawn();
  }

  function finishClear() {
    const rows = clearing.rows;
    clearing = null;
    for (const y of rows) { board.splice(y, 1); board.unshift(emptyRow()); }
    const before = level;
    lines += rows.length;
    if (M.goal && lines >= M.goal) { lines = Math.min(lines, M.goal); return finish('complete'); }
    if (M.levels) level = settings.startLevel + Math.floor(lines / 10);
    if (level > before) { sfx.level(); setTimeout(() => popup('Level ' + level, ''), 500); }
    spawn();
  }

  // ---------- Ending, records ----------
  const fmtTime = (ms, cs = true) => {
    const s = Math.max(0, ms) / 1000, m = Math.floor(s / 60), r = s - m * 60;
    return m + ':' + (cs ? r.toFixed(2).padStart(5, '0') : String(Math.floor(r)).padStart(2, '0'));
  };
  const pps = () => (elapsed > 0 ? pieces / (elapsed / 1000) : 0);
  const fmtNum = n => Math.round(n).toLocaleString();
  const bestOf = m => records[m][0];
  const recordValue = (m, r) => (MODES[m].rank === 'time' ? fmtTime(r.time) : fmtNum(r.score));

  function finish(reason) {
    cur = null;
    clearing = null;
    state = 'over';
    softDrop = false; dasDir = 0;
    music.stop();
    countEl.classList.remove('tick');
    const won = reason === 'complete' || reason === 'time';
    won ? sfx.win() : sfx.over();
    vibrate(won ? [20, 40, 20] : [40, 60, 40]);

    Object.assign(lifetime, {
      games: lifetime.games + 1, lines: lifetime.lines + lines, pieces: lifetime.pieces + pieces,
      tetrises: lifetime.tetrises + tetrises, tspins: lifetime.tspins + tspins, time: lifetime.time + elapsed,
    });
    store.set('lifetime', lifetime);

    const counts = mode === 'sprint' ? reason === 'complete'
      : mode === 'ultra' ? reason !== 'ended'
      : score > 0;
    let rank = 0;
    if (counts) {
      const entry = { score, lines, time: Math.round(elapsed), level, pps: +pps().toFixed(2), date: Date.now() };
      const list = records[mode];
      list.push(entry);
      list.sort((a, b) => (M.rank === 'time' ? a.time - b.time : b.score - a.score));
      list.length = Math.min(list.length, 10);
      rank = list.indexOf(entry) + 1;
      store.set('records', records);
    }

    $('#over-title').textContent = { topout: 'Game over', complete: 'Complete', time: "Time's up", ended: 'Finished' }[reason];
    $('#final-main').textContent = mode === 'sprint' && reason === 'complete' ? fmtTime(elapsed) : fmtNum(score);
    const rankEl = $('#final-rank');
    rankEl.textContent = rank === 1 ? 'New best' : rank ? `#${rank} in your top 10`
      : mode === 'sprint' && reason !== 'complete' ? `${lines} / ${M.goal} lines` : '';
    rankEl.classList.toggle('best', rank === 1);
    const cells = mode === 'sprint'
      ? [['Lines', lines], ['PPS', pps().toFixed(2)], ['Score', fmtNum(score)]]
      : [['Lines', lines], [M.levels ? 'Level' : 'Time', M.levels ? level : fmtTime(elapsed, false)], ['PPS', pps().toFixed(2)]];
    $('#final-grid').innerHTML = cells.map(([k, v]) => `<div><span class="k">${k}</span><span class="v">${v}</span></div>`).join('');

    overAnim = { t: 0 };
    updateHud(true);
    setTimeout(() => { if (state === 'over') showCard('over'); }, reason === 'ended' ? 0 : 900);
  }

  // ---------- Loop ----------
  function update(dt) {
    elapsed += dt;
    if (M.limit && elapsed >= M.limit) { elapsed = M.limit; return finish('time'); }

    if (clearing) {
      clearing.t += dt;
      if (clearing.t >= clearing.dur) finishClear();
      return;
    }
    if (!cur) return;

    // Horizontal auto-repeat (keyboard + pad)
    if (dasDir) {
      dasTimer += dt;
      if (dasTimer >= settings.das) {
        if (settings.arr <= 0) { while (move(dasDir)); }
        else {
          arrTimer += dt;
          while (arrTimer >= settings.arr) { arrTimer -= settings.arr; if (!move(dasDir)) { arrTimer = 0; break; } }
        }
      }
    }
    if (!cur) return;

    const g = gravityMs(level);
    const interval = softDrop ? Math.min(g, Math.max(g / 20, 16)) : g;
    if (grounded()) {
      gravityAcc = 0;
      lockTimer += dt;
      if (lockTimer >= LOCK_DELAY || (lockResets >= MAX_RESETS && lockTimer >= LOCK_DELAY / 5)) lock();
    } else {
      gravityAcc += dt;
      while (gravityAcc >= interval && !grounded()) {
        gravityAcc -= interval;
        cur.y++;
        if (softDrop) score++;
        fell();
      }
    }
  }

  let last = performance.now();
  function frame(now) {
    const dt = Math.min(now - last, 100);
    last = now;
    if (state === 'play') update(dt);
    else if (state === 'count') {
      const before = Math.ceil(countT / 1000);
      countT -= dt;
      const after = Math.ceil(countT / 1000);
      if (countT <= 0) { state = 'play'; countEl.textContent = ''; sfx.go(); music.start(); }
      else if (after !== before) showCount(after);
    }
    for (const f of flashes) f.t += dt;
    if (flashes.length) flashes = flashes.filter(f => f.t < 220);
    if (dispScore !== score) {
      dispScore = score < dispScore ? score : dispScore + Math.max(1, Math.round((score - dispScore) * (1 - Math.exp(-dt / 90))));
      if (dispScore > score) dispScore = score;
    }
    updateHud();
    if (state === 'play' || overAnim || flashes.length) {
      if (overAnim) overAnim.t += dt;
      drawBoard();
      if (overAnim && overAnim.t > 1200) overAnim = null;
    }
    requestAnimationFrame(frame);
  }

  // ---------- Rendering ----------
  let c = 30, dpr = 1, sprites = {}, bgCanvas = null, layoutMode = 'side';
  let theme = THEMES[settings.theme];
  const hexToRgb = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
  const mix = (hex, amt) => {
    const [r, g, b] = hexToRgb(hex), t = amt > 0 ? 255 : 0, a = Math.abs(amt);
    return `rgb(${Math.round(r + (t - r) * a)},${Math.round(g + (t - g) * a)},${Math.round(b + (t - b) * a)})`;
  };
  const rgba = (hex, a) => { const [r, g, b] = hexToRgb(hex); return `rgba(${r},${g},${b},${a})`; };
  const cssVar = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();

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

  // Small deterministic PRNG so textured tiles look the same every time they are drawn.
  const rng = seed => () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };

  function drawBlock(ctx, x, y, s, color, th = theme, variant = 0) {
    const style = th.style;
    const rand = rng(1 + variant * 7919 + color.charCodeAt(1) * 31 + color.charCodeAt(3));
    ctx.save();
    switch (style) {
      case 'neon': {
        const gap = s * 0.14, w = s - 2 * gap;
        ctx.shadowColor = color; ctx.shadowBlur = s * 0.35;
        ctx.fillStyle = rgba(color, 0.18);
        rr(ctx, x + gap, y + gap, w, w, s * 0.1); ctx.fill();
        ctx.strokeStyle = color; ctx.lineWidth = Math.max(1, s * 0.07); ctx.stroke();
        ctx.shadowBlur = 0;
        ctx.fillStyle = rgba(color, 0.5);
        rr(ctx, x + s * 0.36, y + s * 0.36, s * 0.28, s * 0.28, s * 0.05); ctx.fill();
        break;
      }
      case 'retro': {
        const gap = Math.max(1, Math.round(s * 0.05)), w = s - gap;
        ctx.fillStyle = color; ctx.fillRect(x + gap / 2, y + gap / 2, w, w);
        const i1 = s * 0.2, i2 = s * 0.33;
        ctx.fillStyle = th.board; ctx.fillRect(x + i1, y + i1, s - 2 * i1, s - 2 * i1);
        ctx.fillStyle = color; ctx.fillRect(x + i2, y + i2, s - 2 * i2, s - 2 * i2);
        break;
      }
      case 'flat': {
        const gap = Math.max(1, s * 0.06), w = s - gap, r = Math.min(3, s * 0.08);
        ctx.fillStyle = color;
        rr(ctx, x + gap / 2, y + gap / 2, w, w, r); ctx.fill();
        ctx.fillStyle = 'rgba(0,0,0,0.08)';
        ctx.fillRect(x + gap / 2 + r / 2, y + gap / 2 + w - Math.max(1, s * 0.06), w - r, Math.max(1, s * 0.06));
        break;
      }
      case 'glass': {
        // Frosted glass: translucent body, bright rim, soft sheen across the top.
        const gap = s * 0.07, w = s - 2 * gap, r = s * 0.2, x0 = x + gap, y0 = y + gap;
        ctx.fillStyle = rgba(color, 0.32);
        rr(ctx, x0, y0, w, w, r); ctx.fill();
        ctx.clip();
        const g = ctx.createLinearGradient(x0, y0, x0 + w, y0 + w);
        g.addColorStop(0, 'rgba(255,255,255,0.45)');
        g.addColorStop(0.45, 'rgba(255,255,255,0.06)');
        g.addColorStop(1, rgba(color, 0.35));
        ctx.fillStyle = g; ctx.fillRect(x0, y0, w, w);
        ctx.restore(); ctx.save();
        ctx.strokeStyle = rgba(color, 0.95); ctx.lineWidth = Math.max(1, s * 0.05);
        rr(ctx, x0 + ctx.lineWidth / 2, y0 + ctx.lineWidth / 2, w - ctx.lineWidth, w - ctx.lineWidth, r); ctx.stroke();
        ctx.fillStyle = 'rgba(255,255,255,0.8)';
        ctx.beginPath(); ctx.arc(x0 + w * 0.26, y0 + w * 0.24, s * 0.06, 0, Math.PI * 2); ctx.fill();
        break;
      }
      case 'gem': {
        // Faceted cut: a table in the middle and four bevels catching light from the top-left.
        const gap = Math.max(1, s * 0.05), x0 = x + gap / 2, y0 = y + gap / 2, w = s - gap, t = w * 0.24;
        const P = (...pts) => { ctx.beginPath(); pts.forEach(([px, py], k) => (k ? ctx.lineTo(x0 + px, y0 + py) : ctx.moveTo(x0 + px, y0 + py))); ctx.closePath(); ctx.fill(); };
        ctx.fillStyle = mix(color, 0.42); P([0, 0], [w, 0], [w - t, t], [t, t]);
        ctx.fillStyle = mix(color, 0.18); P([0, 0], [t, t], [t, w - t], [0, w]);
        ctx.fillStyle = mix(color, -0.2); P([w, 0], [w, w], [w - t, w - t], [w - t, t]);
        ctx.fillStyle = mix(color, -0.4); P([0, w], [t, w - t], [w - t, w - t], [w, w]);
        const g = ctx.createLinearGradient(x0 + t, y0 + t, x0 + w - t, y0 + w - t);
        g.addColorStop(0, mix(color, 0.12)); g.addColorStop(1, mix(color, -0.08));
        ctx.fillStyle = g; P([t, t], [w - t, t], [w - t, w - t], [t, w - t]);
        ctx.fillStyle = 'rgba(255,255,255,0.75)';
        ctx.beginPath(); ctx.arc(x0 + t * 1.5, y0 + t * 1.45, s * 0.045, 0, Math.PI * 2); ctx.fill();
        break;
      }
      case 'ink': {
        // Brush-stroke square: wobbly edges, uneven ink, a dry-brush streak.
        const m = s * 0.1, pts = [];
        const corners = [[m, m], [s - m, m], [s - m, s - m], [m, s - m]];
        corners.forEach(([cx, cy], k) => {
          const [nx, ny] = corners[(k + 1) % 4];
          for (let q = 0; q < 4; q++) {
            const f = q / 4, j = s * 0.03;
            pts.push([cx + (nx - cx) * f + (rand() - 0.5) * j * 2, cy + (ny - cy) * f + (rand() - 0.5) * j * 2]);
          }
        });
        ctx.beginPath();
        pts.forEach(([px, py], k) => (k ? ctx.lineTo(x + px, y + py) : ctx.moveTo(x + px, y + py)));
        ctx.closePath();
        ctx.fillStyle = rgba(color, 0.86 + rand() * 0.1); ctx.fill();
        ctx.clip();
        ctx.strokeStyle = 'rgba(255,255,255,0.18)'; ctx.lineWidth = s * 0.04;
        for (let k = 0; k < 3; k++) {
          const yy = y + s * (0.3 + rand() * 0.45);
          ctx.beginPath(); ctx.moveTo(x + s * (0.15 + rand() * 0.2), yy); ctx.lineTo(x + s * (0.6 + rand() * 0.3), yy + (rand() - 0.5) * s * 0.08); ctx.stroke();
        }
        break;
      }
      case 'mosaic': {
        // Four glazed sub-tiles with grout lines and slight colour variation.
        const g = Math.max(1, s * 0.07), h = (s - 3 * g) / 2;
        for (let k = 0; k < 4; k++) {
          const px = x + g + (k % 2) * (h + g), py = y + g + Math.floor(k / 2) * (h + g);
          ctx.fillStyle = mix(color, (rand() - 0.5) * 0.24);
          rr(ctx, px, py, h, h, h * 0.18); ctx.fill();
          ctx.fillStyle = 'rgba(255,255,255,0.22)';
          rr(ctx, px + h * 0.15, py + h * 0.12, h * 0.5, h * 0.16, h * 0.08); ctx.fill();
        }
        break;
      }
      case 'dot': {
        ctx.fillStyle = color;
        ctx.beginPath(); ctx.arc(x + s / 2, y + s / 2, s * 0.4, 0, Math.PI * 2); ctx.fill();
        break;
      }
      case 'blueprint': {
        const lw = Math.max(1, s * 0.05), m = s * 0.12 + lw / 2, w = s - 2 * m;
        ctx.fillStyle = rgba(color, 0.18); ctx.fillRect(x + m, y + m, w, w);
        ctx.strokeStyle = color; ctx.lineWidth = lw; ctx.strokeRect(x + m, y + m, w, w);
        ctx.beginPath(); ctx.rect(x + m, y + m, w, w); ctx.clip();
        ctx.globalAlpha = 0.45; ctx.lineWidth = Math.max(1, s * 0.03);
        for (let k = -1; k < 4; k++) { ctx.beginPath(); ctx.moveTo(x + m + k * w / 3, y + m + w); ctx.lineTo(x + m + (k + 1) * w / 3 + w / 3, y + m - w / 3); ctx.stroke(); }
        break;
      }
      case 'stripe': {
        // Synthwave: hot gradient, scanlines, a glowing top edge.
        const gap = Math.max(1, s * 0.06), x0 = x + gap / 2, y0 = y + gap / 2, w = s - gap;
        const g = ctx.createLinearGradient(x0, y0, x0, y0 + w);
        g.addColorStop(0, mix(color, 0.25)); g.addColorStop(1, mix(color, -0.45));
        ctx.fillStyle = g; ctx.fillRect(x0, y0, w, w);
        ctx.fillStyle = 'rgba(0,0,0,0.22)';
        for (let yy = y0 + w * 0.35; yy < y0 + w; yy += w / 7) ctx.fillRect(x0, yy, w, Math.max(1, w / 18));
        ctx.fillStyle = mix(color, 0.6); ctx.fillRect(x0, y0, w, Math.max(1, s * 0.08));
        break;
      }
      case 'pixel': {
        // NES-style bevel on a pixel grid.
        const p = Math.max(1, Math.round(s / 8)), x0 = Math.round(x), y0 = Math.round(y), w = Math.round(s) - p;
        ctx.fillStyle = color; ctx.fillRect(x0, y0, w, w);
        ctx.fillStyle = mix(color, 0.5); ctx.fillRect(x0, y0, w, p); ctx.fillRect(x0, y0, p, w);
        ctx.fillStyle = mix(color, -0.45); ctx.fillRect(x0, y0 + w - p, w, p); ctx.fillRect(x0 + w - p, y0, p, w);
        ctx.fillStyle = '#ffffff'; ctx.fillRect(x0 + p, y0 + p, p, p);
        break;
      }
      case 'ascii': {
        ctx.fillStyle = color;
        ctx.shadowColor = color; ctx.shadowBlur = s * 0.25;
        ctx.font = `700 ${Math.round(s * 0.78)}px ui-monospace, Menlo, Consolas, monospace`;
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText('[]', x + s / 2, y + s * 0.53);
        break;
      }
      default: { // soft
        const gap = Math.max(1, s * 0.06), w = s - gap, x0 = x + gap / 2, y0 = y + gap / 2;
        const r = Math.min(3, s * 0.08), edge = Math.max(1, s * 0.07);
        const g = ctx.createLinearGradient(x, y, x, y + s);
        g.addColorStop(0, mix(color, 0.1));
        g.addColorStop(1, mix(color, -0.12));
        ctx.fillStyle = g;
        rr(ctx, x0, y0, w, w, r); ctx.fill();
        ctx.clip();
        ctx.fillStyle = 'rgba(255,255,255,0.22)';
        ctx.fillRect(x0, y0, w, edge);
        ctx.fillStyle = 'rgba(0,0,0,0.22)';
        ctx.fillRect(x0, y0 + w - edge, w, edge);
      }
    }
    ctx.restore();
  }

  function makeSprites() {
    sprites = {};
    const px = Math.round(c * dpr), n = VARIANTS[theme.style] || 1;
    for (const t of [...TYPES, 'X']) {
      sprites[t] = [];
      for (let v = 0; v < n; v++) {
        const cv = document.createElement('canvas');
        cv.width = cv.height = px;
        drawBlock(cv.getContext('2d'), 0, 0, px, t === 'X' ? theme.dead : theme.colors[t], theme, v);
        sprites[t].push(cv);
      }
    }
    bgCanvas = document.createElement('canvas');
    bgCanvas.width = Math.round(COLS * c * dpr); bgCanvas.height = Math.round(ROWS * c * dpr);
    const g = bgCanvas.getContext('2d');
    g.scale(dpr, dpr);
    g.strokeStyle = cssVar('--board-line') || 'rgba(255,255,255,0.1)';
    g.globalAlpha = theme.grid || 0.45;
    g.lineWidth = 1 / dpr;
    g.beginPath();
    for (let x = 1; x < COLS; x++) { g.moveTo(x * c, 0); g.lineTo(x * c, ROWS * c); }
    for (let y = 1; y < ROWS; y++) { g.moveTo(0, y * c); g.lineTo(COLS * c, y * c); }
    g.stroke();
  }
  // Variant chosen by board position so textured themes don't repeat one tile everywhere.
  const sprite = (t, x, y) => { const v = sprites[t]; return v[(x * 7 + y * 13) % v.length]; };

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
    const clearP = clearing ? Math.min(1, clearing.t / clearing.dur) : 0;
    const ease = 1 - Math.pow(1 - clearP, 3);
    let highest = H;

    for (let y = BUF; y < H; y++) {
      const isClearing = clearing && clearing.rows.includes(y);
      const py = (y - BUF) * c;
      if (isClearing) {
        // Cells shrink into a line while a light sweeps across the row.
        const sh = c * (1 - ease);
        ctx.globalAlpha = 1 - ease * 0.6;
        for (let x = 0; x < COLS; x++) if (board[y][x]) ctx.drawImage(sprite(board[y][x], x, y), x * c, py + (c - sh) / 2, c, sh);
        ctx.globalAlpha = 1;
        const band = W * 0.5, sx = -band + (W + band) * ease;
        const g = ctx.createLinearGradient(sx, 0, sx + band, 0);
        const glow = theme.flash;
        g.addColorStop(0, `rgba(${glow},0)`);
        g.addColorStop(0.7, `rgba(${glow},${0.55 * (1 - clearP * 0.5)})`);
        g.addColorStop(1, `rgba(${glow},0)`);
        ctx.fillStyle = g;
        ctx.fillRect(0, py, W, c);
        continue;
      }
      for (let x = 0; x < COLS; x++) {
        const v = board[y][x];
        if (!v) continue;
        if (y < highest) highest = y;
        const grey = overAnim && H - 1 - y < overRows;
        ctx.drawImage(sprite(grey ? 'X' : v, x, y), x * c, py, c, c);
      }
    }
    if (clearing && clearing.big) {
      ctx.fillStyle = `rgba(${theme.flash},${0.12 * (1 - clearP)})`;
      ctx.fillRect(0, 0, W, Hh);
    }
    boardWrap.classList.toggle('danger', (state === 'play' || state === 'count') && !M.zen && highest - BUF < 4);

    if (cur) {
      const cells = CELLS[cur.t][cur.r];
      if (settings.ghost) {
        const gy = ghostY(), col = theme.colors[cur.t];
        if (gy !== cur.y) {
          ctx.lineWidth = Math.max(1, Math.round(c * 0.05));
          ctx.strokeStyle = rgba(col, theme.style === 'retro' ? 0.6 : 0.5);
          ctx.fillStyle = rgba(col, 0.07);
          const lw = ctx.lineWidth;
          for (const [cx, cy] of cells) {
            const yy = gy + cy - BUF; if (yy < 0) continue;
            const px = (cur.x + cx) * c, py = yy * c, p = c * 0.03 + lw / 2;
            ctx.fillRect(px + p, py + p, c - 2 * p, c - 2 * p);
            ctx.strokeRect(px + p, py + p, c - 2 * p, c - 2 * p);
          }
        }
      }
      // Fade the piece slightly while lock delay runs out.
      const fade = grounded() ? 1 - 0.35 * Math.min(1, lockTimer / LOCK_DELAY) : 1;
      ctx.globalAlpha = fade;
      for (const [cx, cy] of cells) {
        const yy = cur.y + cy - BUF; if (yy < 0) continue;
        ctx.drawImage(sprite(cur.t, cur.x + cx, cur.y + cy), (cur.x + cx) * c, yy * c, c, c);
      }
      ctx.globalAlpha = 1;
    }

    const flashCol = theme.flash;
    for (const f of flashes) {
      ctx.fillStyle = `rgba(${flashCol},${0.5 * (1 - f.t / 220)})`;
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
    for (const [x, y] of cells) drawBlock(ctx, ox + (x - minX) * s, oy + (y - minY) * s, s, dim ? theme.dead : theme.colors[t]);
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
  const statEls = [...$$('#stats .stat')].map(el => [el.querySelector('.k'), el.querySelector('.v')]);
  const hudCache = [];
  function hudStats() {
    const b = bestOf(mode);
    switch (mode) {
      case 'sprint': return [['Time', fmtTime(elapsed)], ['Lines', `${lines}/${M.goal}`], ['PPS', pps().toFixed(2)], ['Best', b ? fmtTime(b.time) : '–']];
      case 'ultra': return [['Score', fmtNum(dispScore)], ['Time', fmtTime(M.limit - elapsed, false)], ['Lines', lines], ['Best', b ? fmtNum(b.score) : '–']];
      case 'zen': return [['Score', fmtNum(dispScore)], ['Lines', lines], ['PPS', pps().toFixed(2)], ['Time', fmtTime(elapsed, false)]];
      default: return [['Score', fmtNum(dispScore)], ['Level', level], ['Lines', lines], ['Best', fmtNum(Math.max(b ? b.score : 0, score))]];
    }
  }
  function updateHud(force) {
    hudStats().forEach(([k, v], i) => {
      const key = k + '|' + v;
      if (!force && hudCache[i] === key) return;
      hudCache[i] = key;
      statEls[i][0].textContent = k;
      statEls[i][1].textContent = v;
    });
  }

  let popupTimer = 0;
  function popup(big, small) {
    popupEl.innerHTML = (big ? `<span class="big">${big}</span>` : '') + (small ? `<span class="small">${small}</span>` : '');
    popupEl.classList.remove('go'); void popupEl.offsetWidth; popupEl.classList.add('go');
    clearTimeout(popupTimer);
    popupTimer = setTimeout(() => popupEl.classList.remove('go'), 1200);
  }
  function showCount(n) {
    countEl.textContent = n;
    countEl.classList.remove('tick'); void countEl.offsetWidth; countEl.classList.add('tick');
    sfx.tick();
  }

  // ---------- Layout ----------
  function layout() {
    const cs = getComputedStyle(app);
    const W = app.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
    let Hh = app.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom);
    pad.hidden = !settings.pad;
    pad.querySelector('[data-pad="r180"]').hidden = !settings.rot180;
    if (settings.pad) {
      const ph = Math.round(Math.max(52, Math.min(76, Hh * 0.085)));
      app.style.setProperty('--pad-h', ph + 'px');
      Hh -= ph + 12;
    }
    const cSide = Math.floor(Math.min(W / 20.2, (Hh - 2) / 20));
    const cTop = Math.floor(Math.min((W - 2) / 10, (Hh - 2) / 23.9));
    layoutMode = cSide >= cTop ? 'side' : 'top';
    c = Math.max(10, layoutMode === 'side' ? cSide : cTop);
    dpr = Math.min(window.devicePixelRatio || 1, 3);
    document.documentElement.style.setProperty('--c', c + 'px');
    gameEl.className = layoutMode;

    setCanvas(boardCv, bctx, COLS * c, ROWS * c);
    if (layoutMode === 'side') {
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

  function applyTheme() {
    theme = THEMES[settings.theme];
    document.documentElement.dataset.theme = settings.theme;
    $('meta[name="theme-color"]').setAttribute('content', theme.meta);
    makeSprites();
    drawBoard();
    drawSide();
  }

  // ---------- Cards ----------
  let cardStack = [];
  function showCard(name, push = false) {
    if (push) cardStack.push(currentCard());
    else cardStack = [];
    $$('.card').forEach(el => el.classList.toggle('show', el.id === name));
    overlay.classList.toggle('show', !!name);
    overlay.scrollTop = 0;
    if (name === 'menu') renderMenu();
    if (name === 'records') renderRecords();
    if (name === 'settings') renderSettings();
    toast.classList.toggle('show', !!(name && waitingWorker));
    if (name && !coarse) {
      const btn = $(`#${name} .btn.primary`) || $(`#${name} .btn`);
      if (btn) btn.focus({ preventScroll: true });
    }
  }
  const currentCard = () => { const el = $('.card.show'); return el ? el.id : null; };
  function back() {
    const prev = cardStack.pop() || (state === 'pause' ? 'paused' : 'menu'), rest = cardStack;
    showCard(prev);
    cardStack = rest;
  }

  function seg(container, items, selected, onPick) {
    container.innerHTML = '';
    for (const [key, label] of items) {
      const b = document.createElement('button');
      b.textContent = label;
      b.className = key === selected ? 'on' : '';
      b.setAttribute('role', 'tab');
      b.addEventListener('click', () => onPick(key));
      container.appendChild(b);
    }
  }
  const modeItems = Object.entries(MODES).map(([k, v]) => [k, v.name]);

  function renderMenu() {
    seg($('#modes'), modeItems, settings.mode, k => { settings.mode = k; saveSettings(); renderMenu(); reset(); drawBoard(); drawSide(); });
    $('#mode-desc').textContent = MODES[settings.mode].desc;
    const b = bestOf(settings.mode);
    $('#mode-best').innerHTML = b ? `Best <b>${recordValue(settings.mode, b)}</b>` : '';
  }

  let recMode = null;
  function renderRecords() {
    recMode = recMode || settings.mode;
    seg($('#rec-modes'), modeItems, recMode, k => { recMode = k; renderRecords(); });
    const list = records[recMode];
    const fmtDate = d => new Date(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    $('#toplist').innerHTML = list.length
      ? list.map((r, i) => {
        const meta = MODES[recMode].rank === 'time'
          ? `${r.pps} PPS · ${fmtDate(r.date)}`
          : `${r.lines} lines${MODES[recMode].levels ? ' · L' + r.level : ''} · ${fmtDate(r.date)}`;
        return `<li><span class="n">${i + 1}</span><span class="val">${recordValue(recMode, r)}</span><span class="meta">${meta}</span></li>`;
      }).join('')
      : `<li class="empty">No ${MODES[recMode].name} records yet</li>`;
    const hrs = lifetime.time / 3600000;
    const cells = [
      ['Games', fmtNum(lifetime.games)], ['Lines', fmtNum(lifetime.lines)], ['Pieces', fmtNum(lifetime.pieces)],
      ['Tetrises', fmtNum(lifetime.tetrises)], ['T-Spins', fmtNum(lifetime.tspins)],
      ['Played', hrs >= 1 ? hrs.toFixed(1) + ' h' : Math.round(lifetime.time / 60000) + ' min'],
    ];
    $('#lifetime').innerHTML = cells.map(([k, v]) => `<div><span class="k">${k}</span><span class="v">${v}</span></div>`).join('');
  }

  // ---------- Settings ----------
  const SETTINGS = {
    game: [
      ['ghost', 'Ghost piece'],
      ['startLevel', 'Starting level', { min: 1, max: 15, step: 1, fmt: v => v, note: 'Marathon and Ultra' }],
    ],
    controls: [
      ['sens', 'Touch sensitivity', { min: 0.5, max: 2, step: 0.1, fmt: v => Math.round(v * 100) + '%' }],
      ['das', 'Repeat delay (DAS)', { min: 50, max: 300, step: 5, fmt: v => v + ' ms' }],
      ['arr', 'Repeat rate (ARR)', { min: 0, max: 100, step: 1, fmt: v => (v ? v + ' ms' : 'Instant') }],
      ['rot180', '180° rotation', null, 'Two-finger tap, or A key'],
      ['pad', 'On-screen buttons'],
    ],
    sound: [
      ['sound', 'Sound effects'],
      ['music', 'Ambient music'],
      ['haptics', 'Vibration', null, null, () => 'vibrate' in navigator],
    ],
  };
  // A small sample board so themes can be judged without leaving Settings.
  const PREVIEW = [
    '..........',
    '....T.....',
    '...TTT....',
    '..........',
    '....ggg...',
    'I....gLL.O',
    'IZZ.JJLSSO',
    'IJZZJ.LSSO',
  ];
  function drawThemePreview() {
    const cv = $('#theme-preview');
    const w = cv.parentElement.clientWidth - 44;
    if (w <= 0) return;
    const s = Math.min(24, Math.floor(w / 10)), cols = 10, rows = PREVIEW.length;
    const ctx = cv.getContext('2d'), d = Math.min(window.devicePixelRatio || 1, 3);
    cv.width = cols * s * d; cv.height = rows * s * d;
    cv.style.width = cols * s + 'px'; cv.style.height = rows * s + 'px';
    ctx.setTransform(d, 0, 0, d, 0, 0);
    ctx.fillStyle = theme.board;
    ctx.fillRect(0, 0, cols * s, rows * s);
    ctx.strokeStyle = cssVar('--board-line');
    ctx.globalAlpha = theme.grid || 0.45; ctx.lineWidth = 1 / d;
    ctx.beginPath();
    for (let x = 1; x < cols; x++) { ctx.moveTo(x * s, 0); ctx.lineTo(x * s, rows * s); }
    for (let y = 1; y < rows; y++) { ctx.moveTo(0, y * s); ctx.lineTo(cols * s, y * s); }
    ctx.stroke(); ctx.globalAlpha = 1;
    PREVIEW.forEach((row, y) => [...row].forEach((ch, x) => {
      const px = x * s, py = y * s;
      if (ch === 'g') {
        const col = theme.colors.T;
        ctx.strokeStyle = rgba(col, 0.5); ctx.fillStyle = rgba(col, 0.07); ctx.lineWidth = Math.max(1, Math.round(s * 0.05));
        const p = s * 0.03 + ctx.lineWidth / 2;
        ctx.fillRect(px + p, py + p, s - 2 * p, s - 2 * p); ctx.strokeRect(px + p, py + p, s - 2 * p, s - 2 * p);
      } else if (ch !== '.') drawBlock(ctx, px, py, s, theme.colors[ch], theme, (x * 7 + y * 13) % (VARIANTS[theme.style] || 1));
    }));
  }

  function renderSettings() {
    const tbox = $('#themes');
    tbox.innerHTML = '';
    for (const [key, t] of Object.entries(THEMES)) {
      const b = document.createElement('button');
      b.className = 'theme' + (key === settings.theme ? ' on' : '');
      // Swatch: three tiles drawn in the theme's own style.
      const cv = document.createElement('canvas'), sz = 16, d = Math.min(window.devicePixelRatio || 1, 3);
      cv.width = sz * 3 * d + 8 * d; cv.height = sz * d + 8 * d;
      cv.style.width = sz * 3 + 8 + 'px'; cv.style.height = sz + 8 + 'px';
      const x = cv.getContext('2d'); x.scale(d, d);
      x.fillStyle = t.board; rr(x, 0, 0, sz * 3 + 8, sz + 8, 5); x.fill();
      ['T', 'I', 'Z'].forEach((p, k) => drawBlock(x, 4 + k * sz, 4, sz, t.colors[p], t, k));
      b.appendChild(cv);
      b.appendChild(document.createTextNode(t.name));
      b.addEventListener('click', () => { settings.theme = key; saveSettings(); applyTheme(); renderSettings(); });
      tbox.appendChild(b);
    }
    requestAnimationFrame(drawThemePreview);
    for (const [group, items] of Object.entries(SETTINGS)) {
      const box = $('#set-' + group);
      box.innerHTML = '';
      for (const [key, label, range, note, avail] of items) {
        if (avail && !avail()) continue;
        if (range) {
          const l = document.createElement('label');
          l.className = 'range';
          l.innerHTML = `<span>${label}${range.note ? `<small>${range.note}</small>` : ''}</span><output></output>
            <input type="range" min="${range.min}" max="${range.max}" step="${range.step}" value="${settings[key]}">`;
          const out = l.querySelector('output'), inp = l.querySelector('input');
          out.textContent = range.fmt(settings[key]);
          inp.addEventListener('input', () => { settings[key] = +inp.value; out.textContent = range.fmt(+inp.value); saveSettings(); });
          box.appendChild(l);
        } else {
          const l = document.createElement('label');
          l.className = 'row';
          l.innerHTML = `<span>${label}${note ? `<small>${note}</small>` : ''}</span><input type="checkbox"${settings[key] ? ' checked' : ''}><span class="sw"></span>`;
          l.querySelector('input').addEventListener('change', e => {
            settings[key] = e.target.checked; saveSettings();
            if (key === 'pad' || key === 'rot180') layout();
            if (key === 'sound' && settings.sound) sfx.rotate();
            if (key === 'ghost') drawBoard();
          });
          box.appendChild(l);
        }
      }
    }
  }

  // ---------- Flow ----------
  function start() {
    ctxAudio();
    music.stop();
    reset();
    state = 'play';
    showCard(null);
    last = performance.now();
    spawn();
    music.start();
  }
  function pause() {
    if (state !== 'play' && state !== 'count') return;
    state = 'pause';
    softDrop = false; dasDir = 0; held.left = held.right = false; gest = null;
    countEl.classList.remove('tick'); countEl.textContent = '';
    music.stop();
    showCard('paused');
  }
  function resume() {
    if (state !== 'pause') return;
    showCard(null);
    state = 'count';
    countT = 3000;
    last = performance.now();
    showCount(3);
  }
  function toMenu() {
    state = 'menu';
    music.stop();
    reset();
    drawBoard(); drawSide();
    showCard('menu');
  }
  function endGame() { if (state === 'pause') finish('ended'); }

  overlay.addEventListener('click', e => {
    const b = e.target.closest('[data-act]');
    if (!b) return;
    const acts = {
      start, resume, restart: start, menu: toMenu, end: endGame, back,
      settings: () => showCard('settings', true),
      records: () => { recMode = state === 'over' ? mode : settings.mode; showCard('records', true); },
      help: () => showCard('help', true),
    };
    acts[b.dataset.act]();
  });
  $('#pause').addEventListener('click', pause);

  // ---------- Keyboard ----------
  const KEYMAP = {
    ArrowLeft: 'left', ArrowRight: 'right', ArrowDown: 'down',
    ArrowUp: 'cw', KeyX: 'cw', KeyZ: 'ccw', ControlLeft: 'ccw', ControlRight: 'ccw', KeyA: 'r180',
    Space: 'drop', KeyC: 'hold', ShiftLeft: 'hold', ShiftRight: 'hold',
    Escape: 'pause', KeyP: 'pause',
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
      case 'r180': rotate(2); break;
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
      if ((e.code === 'Enter' || e.code === 'Space') && ['menu', 'over'].includes(currentCard()) && !e.target.closest('button,input')) { e.preventDefault(); start(); }
      if (e.code === 'Escape' && cardStack.length) back();
      return;
    }
    if (state === 'pause') {
      if (e.code === 'Escape' && cardStack.length) { back(); return; }
      if ((act === 'pause' || e.code === 'Enter') && currentCard() === 'paused' && !e.target.closest('button,input')) { e.preventDefault(); resume(); }
      return;
    }
    if (state === 'count') { if (act === 'pause') pause(); return; }
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
    if (e.target.closest('button, #pad, #overlay, #toast')) return;
    ctxAudio();
    if (gest) {
      // A second finger landing quickly turns the gesture into a two-finger tap.
      if (!gest.moved && e.timeStamp - gest.t0 < 250) gest.two = true;
      return;
    }
    gest = {
      id: e.pointerId, x0: e.clientX, y0: e.clientY, t0: e.timeStamp,
      ax: e.clientX, ay: e.clientY, axis: null, moved: false, two: false,
      hist: [{ x: e.clientX, y: e.clientY, t: e.timeStamp }],
    };
  });

  app.addEventListener('pointermove', e => {
    if (!gest || e.pointerId !== gest.id || gest.two || state !== 'play') return;
    const g = gest, x = e.clientX, y = e.clientY;
    g.hist.push({ x, y, t: e.timeStamp });
    while (g.hist.length > 2 && e.timeStamp - g.hist[0].t > 100) g.hist.shift();
    const step = Math.max(10, (c * 0.9) / settings.sens);
    const tx = x - g.x0, ty = y - g.y0;
    if (!g.axis && Math.hypot(tx, ty) > TAP_PX) g.axis = Math.abs(tx) > Math.abs(ty) ? 'x' : 'y';
    if (!g.axis) return;
    // Allow switching axis once the other direction clearly dominates.
    if (g.axis === 'x' && y - g.ay > step * 1.6 && Math.abs(y - g.ay) > Math.abs(x - g.ax) * 1.5) g.axis = 'y';
    if (g.axis === 'y' && Math.abs(x - g.ax) > step * 1.2 && Math.abs(x - g.ax) > Math.abs(y - g.ay)) g.axis = 'x';

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
    if (state !== 'play' || e.type === 'pointercancel') return;
    const dt = e.timeStamp - g.t0;
    const tx = e.clientX - g.x0, ty = e.clientY - g.y0;
    if (g.two) { if (settings.rot180 && !g.moved) rotate(2); return; }
    const h0 = g.hist[0];
    const span = Math.max(1, e.timeStamp - h0.t);
    const vy = (e.clientY - h0.y) / span, vx = (e.clientX - h0.x) / span;
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
    ctxAudio();
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

  // ---------- Updates ----------
  let waitingWorker = null, refreshing = false;
  function offerUpdate(w) {
    if (!w || !navigator.serviceWorker.controller) return;
    waitingWorker = w;
    if (state !== 'play' && state !== 'count') toast.classList.add('show');
  }
  $('#toast-btn').addEventListener('click', () => { if (waitingWorker) { refreshing = true; waitingWorker.postMessage('skip'); } });
  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    // Only reload when the player asked for the update (not on the first install's claim).
    navigator.serviceWorker.addEventListener('controllerchange', () => { if (refreshing) { refreshing = false; location.reload(); } });
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('sw.js').then(reg => {
        if (reg.waiting) offerUpdate(reg.waiting);
        reg.addEventListener('updatefound', () => {
          const w = reg.installing;
          w.addEventListener('statechange', () => { if (w.state === 'installed') offerUpdate(w); });
        });
        document.addEventListener('visibilitychange', () => { if (!document.hidden) reg.update().catch(() => {}); });
      }).catch(() => {});
    });
  }

  // ---------- Boot ----------
  reset();
  layout();
  applyTheme();
  showCard('menu');
  requestAnimationFrame(frame);

  // Exposed for automated tests only.
  window.__tetris = {
    get state() { return state; }, get cur() { return cur; }, get board() { return board; }, get score() { return score; },
    get lines() { return lines; }, get elapsed() { return elapsed; }, set elapsed(v) { elapsed = v; },
    get records() { return records; }, settings, press, release, start, pause, resume, rotate, finish,
  };
})();
