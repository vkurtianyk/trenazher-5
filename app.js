'use strict';

/* ================= Дані ================= */

const COLORS = {
  red:    { hex: '#D7263D', m: 'червоний', n: 'червоне', f: 'червону', name: 'червоний' },
  yellow: { hex: '#F2C200', m: 'жовтий',  n: 'жовте',  f: 'жовту',  name: 'жовтий' },
  green:  { hex: '#2E9E44', m: 'зелений', n: 'зелене', f: 'зелену', name: 'зелений' },
  blue:   { hex: '#1D5FD0', m: 'синій',   n: 'синє',   f: 'синю',   name: 'синій' },
};
const COLOR_ORDER = ['red', 'yellow', 'green', 'blue'];

// g — рід, acc — знахідний відмінок («поклади кубик / ложку»)
const KINDS = {
  cube:  { g: 'm', acc: 'кубик' },
  ball:  { g: 'm', acc: "м'яч" },
  ring:  { g: 'n', acc: 'кільце' },
  spoon: { g: 'f', acc: 'ложку' },
};
const KIND_LIST = Object.keys(KINDS);
const SIZE_WORDS = {
  big:   { m: 'великий',   n: 'велике',   f: 'велику' },
  small: { m: 'маленький', n: 'маленьке', f: 'маленьку' },
};
const MARKS = [
  { id: 'С', text: 'сам' },
  { id: 'П', text: 'з показом' },
  { id: 'Ч', text: 'часткова' },
  { id: 'Р', text: 'рука в руці' },
];

const SETTINGS_KEY = 'kp-settings';
const LOG_KEY = 'kp-log';
const BASE_U = 8;            // px на одиницю при 100 %
const FIT_W = 68, FIT_H = 44; // скільки одиниць має вміститися на сцені
const HOLD_MS = 2000;

const DEFAULTS = {
  scale: 100,
  tasks: 4,
  levels: { put: 1, color: 1, sort: 1, count: 1, size: 1, give: 1, pyramid: 1 },
  options: 4,
  colors: ['red', 'yellow', 'green', 'blue'],
  hint: 'off',          // off | delay | now
  assistLine: true,
  marks: true,
  sound: false,
  reduceMotion: false,
};

/* ================= Допоміжне ================= */

const $ = (sel) => document.querySelector(sel);
const rnd = (n) => Math.floor(Math.random() * n);
const pick = (a) => a[rnd(a.length)];
function shuffle(a) {
  const b = a.slice();
  for (let i = b.length - 1; i > 0; i--) {
    const j = rnd(i + 1);
    [b[i], b[j]] = [b[j], b[i]];
  }
  return b;
}
function h(tag, cls, html) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html != null) e.innerHTML = html;
  return e;
}
function shade(hex, f) {
  const n = parseInt(hex.slice(1), 16);
  const ch = [n >> 16, (n >> 8) & 255, n & 255].map((c) =>
    Math.round(f < 0 ? c * (1 + f) : c + (255 - c) * f));
  return '#' + ch.map((c) => c.toString(16).padStart(2, '0')).join('');
}
const itemName = (kind, color) => `${COLORS[color][KINDS[kind].g]} ${KINDS[kind].acc}`;

/* ================= Збереження ================= */

function loadSettings() {
  const raw = localStorage.getItem(SETTINGS_KEY);
  const s = raw ? JSON.parse(raw) : {};
  return { ...DEFAULTS, ...s, levels: { ...DEFAULTS.levels, ...s.levels } };
}
let settings = loadSettings();

function saveSettings() {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  applySettings();
}
const readLog = () => JSON.parse(localStorage.getItem(LOG_KEY) || '[]');
function addLog(entry) {
  const log = readLog();
  log.push(entry);
  localStorage.setItem(LOG_KEY, JSON.stringify(log));
}

const dur = () => (settings.reduceMotion ? 0 : 450);
const enabledColors = () => COLOR_ORDER.filter((c) => settings.colors.includes(c));

function applySettings() {
  const root = document.documentElement.style;
  root.setProperty('--sc', settings.scale / 100);
  root.setProperty('--dur', dur() + 'ms');
  document.body.classList.toggle('no-say', !settings.assistLine);
  fit();
}

// Розмір одиниці: бажаний масштаб, але так, щоб сцена вмістилася в екран.
function fit() {
  const sc = settings.scale / 100;
  const topbar = 44 * sc + 16;
  const u = Math.min(BASE_U * sc, (innerWidth - 16) / FIT_W, (innerHeight - topbar - 16) / FIT_H);
  document.documentElement.style.setProperty('--u', u.toFixed(2) + 'px');
}

/* ================= Малюнки (SVG) ================= */

const svg = (vb, inner) => `<svg viewBox="${vb}" xmlns="http://www.w3.org/2000/svg">${inner}</svg>`;
const g = (inner, x, y, s) => `<g transform="translate(${x} ${y}) scale(${s})">${inner}</g>`;

// Предмети — viewBox 0 0 100 100
const DRAW = {
  cube: (c) => {
    const s = shade(c, -0.3);
    return `<g stroke="${s}" stroke-width="2" stroke-linejoin="round">
      <path d="M50 10 L88 30 L50 50 L12 30 Z" fill="${shade(c, 0.3)}"/>
      <path d="M12 30 L50 50 L50 92 L12 72 Z" fill="${c}"/>
      <path d="M88 30 L50 50 L50 92 L88 72 Z" fill="${shade(c, -0.15)}"/></g>`;
  },
  ball: (c) => `<circle cx="50" cy="52" r="40" fill="${c}" stroke="${shade(c, -0.3)}" stroke-width="2"/>
      <ellipse cx="36" cy="37" rx="12" ry="8" fill="#fff" opacity=".35"/>`,
  ring: (c) => `<rect x="6" y="32" width="88" height="40" rx="20" fill="${c}" stroke="${shade(c, -0.3)}" stroke-width="2"/>
      <rect x="18" y="37" width="64" height="8" rx="4" fill="#fff" opacity=".3"/>`,
  spoon: (c) => `<g transform="rotate(-40 50 50)" stroke="${shade(c, -0.3)}" stroke-width="2">
      <rect x="45" y="42" width="10" height="54" rx="5" fill="${c}"/>
      <ellipse cx="50" cy="27" rx="19" ry="24" fill="${c}"/>
      <ellipse cx="46" cy="22" rx="8" ry="11" fill="#fff" opacity=".28" stroke="none"/></g>`,
};

// Коробка — viewBox 0 0 120 96. Задня частина (отвір) і передня стінка окремо,
// щоб предмети «лягали» всередину.
const BOX_BACK = `<path d="M6 20 L114 20 L106 42 L14 42 Z" fill="#8C6B46" stroke="#76583A" stroke-width="2" stroke-linejoin="round"/>`;
function boxFront(label, color) {
  const tag = color ? `<rect x="38" y="54" width="44" height="26" rx="5" fill="${COLORS[color].hex}" stroke="${shade(COLORS[color].hex, -0.3)}" stroke-width="2"/>` : '';
  return `<path d="M14 42 L106 42 L110 94 L10 94 Z" fill="#D2B48C" stroke="#B8976A" stroke-width="2" stroke-linejoin="round"/>${tag}`;
}
// Тарілочка — viewBox 0 0 260 150
const PLATE = `<ellipse cx="130" cy="84" rx="124" ry="60" fill="#FFFFFF" stroke="#D6D2CB" stroke-width="3"/>
  <ellipse cx="130" cy="84" rx="88" ry="38" fill="none" stroke="#ECE8E1" stroke-width="3"/>`;
// Стрижень пірамідки — viewBox 0 0 100 120
const PEG = `<rect x="45" y="6" width="10" height="104" rx="5" fill="#B8895C"/>
  <rect x="8" y="106" width="84" height="12" rx="6" fill="#C9A27A" stroke="#B08A60" stroke-width="2"/>`;

function ringPiece(c, w) {
  const W = w * 10;
  return svg(`0 0 ${W} 36`, `<rect x="1" y="1" width="${W - 2}" height="34" rx="17" fill="${c}" stroke="${shade(c, -0.3)}" stroke-width="2"/>
    <rect x="${W * 0.15}" y="6" width="${W * 0.7}" height="6" rx="3" fill="#fff" opacity=".3"/>`);
}

/* ================= Елементи сцени ================= */

function makeItem(kind, color, k = 1) {
  const el = h('div', 'item', svg('0 0 100 100', DRAW[kind](COLORS[color].hex)));
  el.dataset.kind = kind;
  el.dataset.color = color;
  el.style.setProperty('--k', k);
  return el;
}
const movable = (el) => { el.classList.add('movable'); return el; };

function makeBox(color, k = 1) {
  const el = h('div', 'box target');
  el.style.setProperty('--bk', k);
  el.innerHTML = svg('0 0 120 96', BOX_BACK) + '<div class="slot"></div>' + svg('0 0 120 96', boxFront('', color));
  el.lastElementChild.classList.add('front');
  if (color) el.dataset.color = color;
  return el;
}
function makePlate(cls = '') {
  const el = h('div', `plate target ${cls}`);
  el.innerHTML = svg('0 0 260 150', PLATE) + '<div class="slot"></div>';
  return el;
}
const makeTable = () => h('div', 'table target');
const slotOf = (t) => t.querySelector('.slot') || t;

/* ================= Перебіг підходу ================= */

const stage = $('#stage');
const sayEl = $('#say');
const okBtn = $('#ok');
const againBtn = $('#again');
const overlay = $('#overlay');

let run = null;   // { ex, level, index, total, hintUsed, task }
let busy = false; // блокує дотики під час руху та переходів

function startRun(ex) {
  run = { ex, level: settings.levels[ex.id], index: 0, total: ex.free ? 1 : settings.tasks };
  overlay.hidden = true;
  show('play');
  nextTask();
}

function nextTask() {
  clearHint();
  deselect();
  okBtn.hidden = againBtn.hidden = true;
  run.hintUsed = false;
  const top = h('div', 'zone top');
  const bottom = h('div', 'zone bottom');
  stage.replaceChildren(top, bottom);
  run.task = run.ex.build(run.level, { top, bottom });
  renderDots();
  busy = false;
}

function renderDots() {
  const dots = $('#dots');
  dots.replaceChildren();
  if (run.ex.free) return;
  for (let i = 0; i < run.total; i++) dots.append(h('i', i < run.index ? 'on' : ''));
}

const say = (text) => { sayEl.textContent = 'Скажіть: ' + text; };
const assist = () => { okBtn.hidden = againBtn.hidden = false; };

function finishTask() {
  busy = true;
  clearHint();
  okBtn.hidden = againBtn.hidden = true;
  setTimeout(afterTask, dur() + 500);
}

function afterTask() {
  if (run.ex.free) return showReward();
  if (settings.marks) return showMarks();
  record('');
}

function record(mark) {
  addLog({ t: Date.now(), ex: run.ex.id, lvl: run.level, mark, hint: run.hintUsed });
  overlay.hidden = true;
  run.index++;
  if (run.index >= run.total) showReward();
  else nextTask();
}

function showMarks() {
  overlay.className = 'marks';
  overlay.replaceChildren(h('div', 'marks-title', 'Як вийшло?'));
  const row = h('div', 'marks-row');
  for (const m of MARKS) {
    const b = h('button', 'mark', `<b>${m.id}</b><span>${m.text}</span>`);
    b.dataset.mark = m.id;
    b.addEventListener('click', () => record(m.id));
    row.append(b);
  }
  overlay.append(row);
  overlay.hidden = false;
}

function showReward() {
  overlay.className = 'reward';
  overlay.replaceChildren();
  if (!settings.reduceMotion) {
    for (let i = 0; i < 14; i++) {
      const b = h('div', 'bubble');
      const size = 30 + rnd(70);
      Object.assign(b.style, {
        left: rnd(95) + 'vw',
        width: size + 'px',
        height: size + 'px',
        animationDelay: (Math.random() * 0.8).toFixed(2) + 's',
      });
      overlay.append(b);
    }
  }
  overlay.append(h('div', 'bigcheck', svg('0 0 100 100',
    `<circle cx="50" cy="50" r="46" fill="#3FA34D"/>
     <path d="M28 52 L44 67 L73 36" fill="none" stroke="#fff" stroke-width="10" stroke-linecap="round" stroke-linejoin="round"/>`)));
  const actions = h('div', 'reward-actions');
  actions.hidden = true;
  const again = h('button', '', 'Ще раз');
  again.id = 'reward-again';
  again.addEventListener('click', () => startRun(run.ex));
  const menu = h('button', '', 'Меню');
  menu.id = 'reward-menu';
  menu.addEventListener('click', showMenu);
  actions.append(again, menu);
  overlay.append(actions);
  overlay.hidden = false;
  setTimeout(() => { actions.hidden = false; }, settings.reduceMotion ? 800 : 3800);
}

/* ---------- Підказка-підсвітка ---------- */

let hintEls = [];
let hintTimer = 0;
function setHint(els) {
  clearHint();
  hintEls = els;
  if (settings.hint === 'now') showHint();
  if (settings.hint === 'delay') hintTimer = setTimeout(showHint, 5000);
}
function showHint() {
  hintEls.forEach((e) => e.classList.add('hint'));
  run.hintUsed = true;
}
function clearHint() {
  clearTimeout(hintTimer);
  hintEls.forEach((e) => e.classList.remove('hint'));
  hintEls = [];
}

function glow(el) {
  el.classList.add('glow');
  setTimeout(() => el.classList.remove('glow'), 900);
}

/* ---------- Тихий «дзинь» ---------- */

let audio = null;
function ding() {
  if (!settings.sound) return;
  audio = audio || new AudioContext();
  audio.resume();
  const t = audio.currentTime;
  const osc = audio.createOscillator();
  const gain = audio.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(880, t);
  osc.frequency.exponentialRampToValueAtTime(1320, t + 0.12);
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(0.06, t + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.6);
  osc.connect(gain).connect(audio.destination);
  osc.start(t);
  osc.stop(t + 0.65);
}

/* ================= Перетягування і два дотики ================= */

let drag = null;
let selected = null;

function select(el) { deselect(); selected = el; el.classList.add('selected'); }
function deselect() { if (selected) selected.classList.remove('selected'); selected = null; }

stage.addEventListener('pointerdown', (e) => {
  if (drag || busy) return;
  const item = e.target.closest('.item.movable');
  if (item) item.setPointerCapture(e.pointerId);
  drag = {
    id: e.pointerId, x: e.clientX, y: e.clientY, moved: false, el: item,
    choice: e.target.closest('.choice'), target: e.target.closest('.target'),
  };
});

stage.addEventListener('pointermove', (e) => {
  if (!drag || e.pointerId !== drag.id || !drag.el) return;
  const dx = e.clientX - drag.x;
  const dy = e.clientY - drag.y;
  if (!drag.moved) {
    if (Math.hypot(dx, dy) < 10) return;
    drag.moved = true;
    deselect();
    drag.el.classList.add('dragging');
  }
  drag.el.style.transform = `translate(${dx}px, ${dy}px) scale(1.06)`;
});

stage.addEventListener('pointerup', (e) => {
  if (!drag || e.pointerId !== drag.id) return;
  const d = drag;
  drag = null;
  if (busy) return d.el && returnHome(d.el);
  if (d.el && d.moved) {
    d.el.classList.remove('dragging');
    return tryDrop(d.el, targetAt(e.clientX, e.clientY));
  }
  // Дотик до предмета, що вже лежить у коробці/на тарілочці, = дотик до неї самої
  if (d.el && selected && selected !== d.el && d.target && !d.target.contains(selected)) {
    const el = selected;
    deselect();
    return tryDrop(el, d.target);
  }
  if (d.el) return selected === d.el ? deselect() : select(d.el);
  if (d.choice) return run.task.choose(d.choice);
  if (d.target && selected) {
    const el = selected;
    deselect();
    tryDrop(el, d.target);
  }
});

stage.addEventListener('pointercancel', (e) => {
  if (!drag || e.pointerId !== drag.id) return;
  if (drag.el) returnHome(drag.el);
  drag = null;
});

function targetAt(x, y) {
  const pad = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--u'));
  const inside = (el) => {
    const r = el.getBoundingClientRect();
    return x >= r.left - pad && x <= r.right + pad && y >= r.top - pad && y <= r.bottom + pad;
  };
  return [...stage.querySelectorAll('.target')].find((t) => inside(t) || inside(slotOf(t))) || null;
}

function tryDrop(el, target) {
  if (target && !target.contains(el) && run.task.drop(el, target)) {
    moveInto(el, target);
    glow(target);
    ding();
    run.task.placed(el, target);
  } else {
    returnHome(el);
  }
}

function returnHome(el) {
  el.classList.remove('dragging');
  el.style.transform = '';
}

// Плавно переносить предмет у контейнер (прийом FLIP).
function moveInto(el, target) {
  const a = el.getBoundingClientRect();
  slotOf(target).append(el);
  el.style.transition = 'none';
  el.style.transform = '';
  const b = el.getBoundingClientRect();
  el.style.transformOrigin = '0 0';
  el.style.transform = `translate(${a.left - b.left}px, ${a.top - b.top}px) scale(${a.width / b.width})`;
  el.getBoundingClientRect();
  el.style.transition = '';
  el.style.transform = '';
  busy = true;
  setTimeout(() => { busy = false; }, dur());
}

okBtn.addEventListener('click', () => run.task.check());
againBtn.addEventListener('click', () => run.task.reset());

/* ================= Вправи ================= */

// 1. Поклади в коробку / Дістань
function buildPut(level, { top, bottom }) {
  const box = makeBox();
  const table = makeTable();
  top.append(box);
  bottom.append(table);
  const count = level === 1 ? 1 : 2 + rnd(2);
  const pairs = shuffle(enabledColors().flatMap((c) => KIND_LIST.map((k) => [k, c]))).slice(0, count);
  const items = pairs.map(([k, c]) => movable(makeItem(k, c)));
  (level === 3 ? slotOf(box) : table).append(...items);

  if (level === 3) {
    const want = pick(items);
    say(`Дістань ${itemName(want.dataset.kind, want.dataset.color)}`);
    setHint([want, table]);
    return {
      drop: (el, t) => t === table && el === want,
      placed: finishTask,
    };
  }

  const queue = shuffle(items);
  const step = () => {
    const want = queue[0];
    say(`Поклади ${itemName(want.dataset.kind, want.dataset.color)} у коробку`);
    setHint([want, box]);
  };
  step();
  return {
    drop: (el, t) => t === box && el === queue[0],
    placed: () => {
      queue.shift();
      if (queue.length) step();
      else finishTask();
    },
  };
}

// 2. Такий самий колір
function buildColor(level, { top, bottom }) {
  const cols = enabledColors().slice(0, level + 1);
  const count = Math.min(settings.options, cols.length);
  const color = pick(cols);
  const others = shuffle(cols.filter((c) => c !== color)).slice(0, count - 1);
  const sampleKind = level === 3 ? pick(KIND_LIST) : 'cube';
  const kindFor = (c) => (level < 3 ? 'cube'
    : c === color ? pick(KIND_LIST.filter((k) => k !== sampleKind)) : pick(KIND_LIST));

  const plate = makePlate('big-items');
  slotOf(plate).append(makeItem(sampleKind, color));
  top.append(plate);

  const table = makeTable();
  const options = shuffle([color, ...others]).map((c) => movable(makeItem(kindFor(c), c)));
  table.append(...options);
  bottom.append(table);

  say('Дай такий самий');
  setHint([options.find((o) => o.dataset.color === color), plate]);
  return {
    drop: (el, t) => t === plate && el.dataset.color === color,
    placed: finishTask,
  };
}

// 3. Розклади за кольором
function buildSort(level, { top, bottom }) {
  const cols = shuffle(enabledColors()).slice(0, level === 3 ? 3 : 2);
  const boxes = cols.map((c) => makeBox(c));
  top.append(...boxes);
  const table = makeTable();
  bottom.append(table);
  const n = level === 1 ? 4 : 6;
  const queue = shuffle(Array.from({ length: n }, (_, i) =>
    [level === 1 ? 'cube' : pick(KIND_LIST), cols[i % cols.length]]));

  const step = () => {
    const [k, c] = queue.shift();
    const item = movable(makeItem(k, c));
    item.classList.add('appear');
    table.append(item);
    say(`Поклади ${itemName(k, c)} у ${COLORS[c].f} коробку`);
    setHint([item, boxes.find((b) => b.dataset.color === c)]);
  };
  step();
  return {
    drop: (el, t) => t.dataset.color === el.dataset.color,
    placed: () => (queue.length ? setTimeout(step, dur()) : finishTask()),
  };
}

// 4. Один — багато
function buildCount(level, { top, bottom }) {
  const kind = level === 1 ? 'ball' : pick(['cube', 'ring', 'spoon']);
  const color = pick(enabledColors());
  const many = 5 + rnd(4);
  const fill = (plate, n, isMovable) => {
    for (let i = 0; i < n; i++) {
      const it = makeItem(kind, color);
      slotOf(plate).append(isMovable ? movable(it) : it);
    }
  };

  if (level === 3) {
    const source = makePlate('small-items');
    const empty = makePlate('small-items');
    fill(source, many, true);
    top.append(...shuffle([source, empty]));
    say('Поклади ОДИН на порожню тарілочку');
    setHint([empty]);
    assist();
    return {
      drop: () => true,
      placed: () => {},
      check: finishTask,
      reset: () => [...slotOf(empty).children].forEach((el) => moveInto(el, source)),
    };
  }

  const one = makePlate('small-items choice');
  const lots = makePlate('small-items choice');
  fill(one, 1, false);
  fill(lots, many, false);
  bottom.append(...(level === 1 ? [one, lots] : shuffle([one, lots])));
  const want = pick(['one', 'many']) === 'one' ? one : lots;
  say(want === one ? 'Покажи, де ОДИН' : 'Покажи, де БАГАТО');
  setHint([want]);
  return {
    choose: (el) => {
      if (el !== want) return;
      glow(el);
      ding();
      finishTask();
    },
  };
}

// 5. Великий — маленький
function buildSize(level, { top, bottom }) {
  if (level === 3) {
    const big = makeBox(null, 1.2);
    const small = makeBox(null, 0.8);
    big.dataset.size = 'big';
    small.dataset.size = 'small';
    top.append(...shuffle([big, small]));
    const table = makeTable();
    bottom.append(table);
    const n = 4 + rnd(3);
    const queue = shuffle(Array.from({ length: n }, (_, i) => i % 2 ? 'big' : 'small'));
    const step = () => {
      const size = queue.shift();
      const kind = pick(KIND_LIST);
      const item = movable(makeItem(kind, pick(enabledColors()), size === 'big' ? 1.3 : 0.6));
      item.dataset.size = size;
      item.classList.add('appear');
      table.append(item);
      say(`Поклади ${SIZE_WORDS[size][KINDS[kind].g]} ${KINDS[kind].acc} у ${SIZE_WORDS[size].f} коробку`);
      setHint([item, size === 'big' ? big : small]);
    };
    step();
    return {
      drop: (el, t) => t.dataset.size === el.dataset.size,
      placed: () => (queue.length ? setTimeout(step, dur()) : finishTask()),
    };
  }

  const kind = pick(KIND_LIST);
  const color = pick(enabledColors());
  const table = makeTable();
  const big = makeItem(kind, color, 1.5);
  const small = makeItem(kind, color, level === 1 ? 0.5 : 1.05);
  big.classList.add('choice');
  small.classList.add('choice');
  table.append(...shuffle([big, small]));
  table.style.alignItems = 'flex-end';
  bottom.append(table);
  const size = pick(['big', 'small']);
  const want = size === 'big' ? big : small;
  say(`Покажи ${SIZE_WORDS[size][KINDS[kind].g]} ${KINDS[kind].acc}`);
  setHint([want]);
  return {
    choose: (el) => {
      if (el !== want) return;
      glow(el);
      ding();
      finishTask();
    },
  };
}

// 6. Дай 1, 2, 3
function buildGive(level, { top, bottom }) {
  const n = pick([[1], [1, 2], [1, 2, 3]][level - 1]);
  const kind = pick(KIND_LIST);
  const color = pick(enabledColors());
  const plate = makePlate();
  const counter = h('div', 'counter');
  const col = h('div', 'col');
  col.append(plate, counter);
  top.append(col);
  const table = makeTable();
  for (let i = 0; i < level + 2; i++) table.append(movable(makeItem(kind, color)));
  bottom.append(table);
  const count = () => {
    counter.replaceChildren(...[...slotOf(plate).children].map(() => h('i')));
  };
  say(`Дай ${n}`);
  setHint([plate]);
  assist();
  return {
    drop: () => true,
    placed: count,
    check: finishTask,
    reset: () => {
      [...slotOf(plate).children].forEach((el) => moveInto(el, table));
      count();
    },
  };
}

// 7. Пірамідка (вільна гра)
function buildPyramid(level, { top, bottom }) {
  const n = level + 2;
  const peg = h('div', 'peg target', svg('0 0 100 120', PEG) + '<div class="slot"></div>');
  top.append(peg);
  const cols = enabledColors();
  const rings = Array.from({ length: n }, (_, i) => {
    const w = 16 - i * (10 / (n - 1));
    const el = movable(h('div', 'item piece', ringPiece(COLORS[cols[i % cols.length]].hex, w)));
    el.style.setProperty('--w', w);
    el.dataset.rank = i;
    return el;
  });
  const table = makeTable();
  table.append(...shuffle(rings));
  bottom.append(table);
  let next = 0;
  sayEl.textContent = 'Збирайте пірамідку: від великого кільця до маленького';
  setHint([rings[0], peg]);
  return {
    drop: (el, t) => t === peg && Number(el.dataset.rank) === next,
    placed: (el) => {
      el.classList.remove('movable');
      next++;
      if (next === n) finishTask();
      else setHint([rings[next], peg]);
    },
  };
}

/* ---------- Список вправ і малюнки для меню ---------- */

const C = (c) => COLORS[c].hex;
const ICONS = {
  put: g(BOX_BACK + boxFront(''), 40, 44, 1) + g(DRAW.cube(C('red')), 72, 2, 0.56),
  color: g(DRAW.cube(C('red')), 72, 0, 0.6) + g(DRAW.cube(C('red')), 38, 78, 0.55) + g(DRAW.cube(C('yellow')), 108, 78, 0.55),
  sort: g(DRAW.ball(C('red')), 76, 0, 0.48) + g(BOX_BACK + boxFront('', 'red'), 4, 66, 0.75) + g(BOX_BACK + boxFront('', 'yellow'), 106, 66, 0.75),
  count: g(PLATE, 2, 72, 0.36) + g(PLATE, 104, 72, 0.36) + g(DRAW.ball(C('blue')), 35, 70, 0.24)
    + [0, 1, 2, 3, 4, 5].map((i) => g(DRAW.ball(C('blue')), 118 + (i % 3) * 20, 62 + Math.floor(i / 3) * 16, 0.22)).join(''),
  size: g(DRAW.ball(C('green')), 14, 24, 1.0) + g(DRAW.ball(C('green')), 130, 82, 0.4),
  give: g(PLATE, 22, 62, 0.6) + g(DRAW.cube(C('yellow')), 70, 52, 0.36) + g(DRAW.cube(C('yellow')), 104, 52, 0.36)
    + g(DRAW.cube(C('yellow')), 150, 4, 0.36),
  pyramid: g(PEG, 50, 6, 1)
    + ['red', 'yellow', 'green', 'blue'].map((c, i) => {
      const w = 80 - i * 16;
      return `<rect x="${100 - w / 2}" y="${100 - i * 15}" width="${w}" height="14" rx="7" fill="${C(c)}" stroke="${shade(C(c), -0.3)}" stroke-width="1.5"/>`;
    }).join(''),
};

const EXERCISES = [
  { id: 'put',   title: 'Поклади / Дістань',     build: buildPut },
  { id: 'color', title: 'Такий самий колір',     build: buildColor },
  { id: 'sort',  title: 'Розклади за кольором',  build: buildSort },
  { id: 'count', title: 'Один — багато',         build: buildCount },
  { id: 'size',  title: 'Великий — маленький',   build: buildSize },
  { id: 'give',  title: 'Дай 1, 2, 3',           build: buildGive },
];
const PYRAMID = { id: 'pyramid', title: 'Пірамідка', build: buildPyramid, free: true };
const ALL = [...EXERCISES, PYRAMID];
const exTitle = (id) => ALL.find((e) => e.id === id).title;

/* ================= Екрани ================= */

function show(id) {
  for (const s of ['menu', 'play', 'panel']) $('#' + s).hidden = s !== id;
}

function showMenu() {
  clearHint();
  overlay.hidden = true;
  const cards = $('#cards');
  cards.replaceChildren();
  ALL.forEach((ex, i) => {
    const card = h('button', ex.free ? 'card free' : 'card',
      svg(ex.free ? '0 0 200 130' : '0 0 200 140', ICONS[ex.id])
      + `<small>${ex.free ? '' : i + 1 + ' · '}${ex.title} · рівень ${settings.levels[ex.id]}</small>`);
    card.dataset.ex = ex.id;
    card.addEventListener('click', () => startRun(ex));
    cards.append(card);
  });
  show('menu');
}

/* ---------- Налаштування ---------- */

function seg(label, options, current, onPick) {
  const row = h('div', 'row');
  row.append(h('span', '', label));
  const box = h('div', 'seg');
  for (const [value, text] of options) {
    const b = h('button', value === current ? 'on' : '', text);
    b.addEventListener('click', () => { onPick(value); saveSettings(); renderSettings(); });
    box.append(b);
  }
  row.append(box);
  return row;
}
const onOff = (label, key) => seg(label, [[true, 'Увімк.'], [false, 'Вимк.']], settings[key], (v) => { settings[key] = v; });

function renderSettings() {
  const panel = $('#panel');
  const top = panel.scrollTop;
  const p = h('div', 'panel-in');
  p.append(h('h1', '', 'Налаштування'));
  p.append(seg('Розмір усього', [100, 130, 160, 200].map((v) => [v, v + ' %']), settings.scale, (v) => { settings.scale = v; }));
  p.append(seg('Завдань у підході', [3, 4, 5, 6, 7, 8, 9, 10].map((v) => [v, String(v)]), settings.tasks, (v) => { settings.tasks = v; }));

  p.append(h('h2', '', 'Рівень складності'));
  for (const ex of ALL) {
    p.append(seg(ex.title, [1, 2, 3].map((v) => [v, String(v)]), settings.levels[ex.id], (v) => { settings.levels[ex.id] = v; }));
  }

  p.append(h('h2', '', 'Кольори і варіанти'));
  p.append(seg('Варіантів у «Такий самий колір»', [2, 3, 4].map((v) => [v, String(v)]), settings.options, (v) => { settings.options = v; }));
  const colorRow = h('div', 'row');
  colorRow.append(h('span', '', 'Кольори (не менше двох)'));
  const sw = h('div', 'seg');
  for (const c of COLOR_ORDER) {
    const on = settings.colors.includes(c);
    const b = h('button', on ? 'swatch on' : 'swatch');
    b.style.background = COLORS[c].hex;
    b.setAttribute('aria-label', COLORS[c].name);
    b.addEventListener('click', () => {
      if (on && settings.colors.length === 2) return;
      settings.colors = on ? settings.colors.filter((x) => x !== c) : [...settings.colors, c];
      saveSettings();
      renderSettings();
    });
    sw.append(b);
  }
  colorRow.append(sw);
  p.append(colorRow);

  p.append(h('h2', '', 'Допомога і вигляд'));
  p.append(seg('Підсвітка правильної цілі', [['off', 'Вимкнено'], ['delay', 'Через 5 с'], ['now', 'Одразу']], settings.hint, (v) => { settings.hint = v; }));
  p.append(onOff('Рядок для асистента', 'assistLine'));
  p.append(onOff('Позначки С / П / Ч / Р після завдання', 'marks'));
  p.append(onOff('Тихий «дзинь» на правильну дію', 'sound'));
  p.append(onOff('Зменшити анімацію', 'reduceMotion'));

  const actions = h('div', 'actions');
  const journal = h('button', 'btn', 'Журнал');
  journal.addEventListener('click', renderJournal);
  const done = h('button', 'btn main', 'Готово');
  done.id = 'settings-done';
  done.addEventListener('click', showMenu);
  actions.append(journal, done);
  p.append(actions);

  panel.replaceChildren(p);
  panel.scrollTop = top;
  show('panel');
}

/* ---------- Журнал ---------- */

const pad2 = (n) => String(n).padStart(2, '0');
const dayKey = (d) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
const dayText = (d) => `${pad2(d.getDate())}.${pad2(d.getMonth() + 1)}.${d.getFullYear()}`;
const timeText = (d) => `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;

function renderJournal() {
  const panel = $('#panel');
  const p = h('div', 'panel-in');
  p.append(h('h1', '', 'Журнал'));
  const actions = h('div', 'actions');
  const csv = h('button', 'btn main', 'Завантажити CSV');
  csv.addEventListener('click', downloadCsv);
  const back = h('button', 'btn', 'Назад');
  back.addEventListener('click', renderSettings);
  const clear = h('button', 'btn', 'Очистити журнал');
  clear.addEventListener('click', () => {
    if (!confirm('Видалити всі записи журналу?')) return;
    localStorage.removeItem(LOG_KEY);
    renderJournal();
  });
  actions.append(csv, back, clear);
  p.append(actions);

  const log = readLog();
  if (!log.length) p.append(h('p', 'note', 'Записів поки немає.'));
  const days = new Map();
  for (const e of log.slice().reverse()) {
    const d = new Date(e.t);
    const key = dayKey(d);
    if (!days.has(key)) days.set(key, { date: d, rows: [] });
    days.get(key).rows.push(e);
  }
  for (const { date, rows } of days.values()) {
    const day = h('div', 'day');
    const counts = MARKS.map((m) => `${m.id} ${rows.filter((r) => r.mark === m.id).length}`).join(' · ');
    day.append(h('div', 'day-head', `${dayText(date)} <span>${rows.length} завд. · ${counts}</span>`));
    const table = h('table', '', '<tr><th>Час</th><th>Вправа</th><th>Рівень</th><th>Позначка</th><th>Підсвітка</th></tr>');
    for (const r of rows) {
      const tr = h('tr');
      for (const v of [timeText(new Date(r.t)), exTitle(r.ex), r.lvl, r.mark || '—', r.hint ? 'так' : 'ні']) {
        tr.append(h('td', '', String(v)));
      }
      table.append(tr);
    }
    day.append(table);
    p.append(day);
  }
  panel.replaceChildren(p);
  panel.scrollTop = 0;
  show('panel');
}

function downloadCsv() {
  const lines = [['Дата', 'Час', 'Вправа', 'Рівень', 'Позначка', 'Підсвітка']];
  for (const r of readLog()) {
    const d = new Date(r.t);
    lines.push([dayText(d), timeText(d), exTitle(r.ex), r.lvl, r.mark || '—', r.hint ? 'так' : 'ні']);
  }
  const text = '﻿' + lines.map((l) => l.join(';')).join('\r\n');
  const url = URL.createObjectURL(new Blob([text], { type: 'text/csv;charset=utf-8' }));
  const a = h('a');
  a.href = url;
  a.download = `zhurnal-${dayKey(new Date())}.csv`;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/* ================= Захист від випадкових дій ================= */

function holdButton(el, icon, action) {
  el.innerHTML = svg('0 0 40 40', `${icon}<circle class="prog" cx="20" cy="20" r="16" pathLength="100" transform="rotate(-90 20 20)"/>`);
  let timer = 0;
  const cancel = () => { clearTimeout(timer); el.classList.remove('holding'); };
  el.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    el.classList.add('holding');
    timer = setTimeout(() => { cancel(); action(); }, HOLD_MS);
  });
  for (const t of ['pointerup', 'pointercancel', 'pointerleave']) el.addEventListener(t, cancel);
}

const GEAR = `<g fill="none" stroke="#5E5A54" stroke-width="2.4"><circle cx="20" cy="20" r="4.5"/>
  <path d="M20 9v3M20 28v3M9 20h3M28 20h3M12.2 12.2l2.1 2.1M25.7 25.7l2.1 2.1M12.2 27.8l2.1-2.1M25.7 14.3l2.1-2.1"/></g>`;
const HOME = `<path d="M12 20 L20 12 L28 20 M14.5 18v9h11v-9" fill="none" stroke="#5E5A54" stroke-width="2.4" stroke-linejoin="round"/>`;

holdButton($('#gear'), GEAR, renderSettings);
holdButton($('#home'), HOME, showMenu);

document.addEventListener('contextmenu', (e) => e.preventDefault());
document.addEventListener('gesturestart', (e) => e.preventDefault());
document.addEventListener('dblclick', (e) => e.preventDefault());
document.addEventListener('touchmove', (e) => {
  if (!e.target.closest('.scroll')) e.preventDefault();
}, { passive: false });
document.addEventListener('selectstart', (e) => e.preventDefault());

// Кнопка «назад» нічого не робить
history.pushState(null, '', location.href);
addEventListener('popstate', () => history.pushState(null, '', location.href));

addEventListener('resize', fit);

/* ================= Старт ================= */

if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js');
applySettings();
showMenu();
