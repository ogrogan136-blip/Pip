'use strict';
/* ui.js — the page: controls, panels, saving, and the main loop. */

(function () {
  const $ = id => document.getElementById(id);

  function loadSave() {
    try { const s = localStorage.getItem(SAVE_KEY); return s ? JSON.parse(s) : null; } catch (e) { return null; }
  }
  function save() {
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(game)); } catch (e) { /* storage unavailable */ }
  }

  let game;
  try { game = new Game(loadSave()); } catch (e) { console.warn('Save was unreadable, starting fresh', e); game = new Game(null); }
  if (!game.log.length) game.addLog(game.brain.stats.actions ? `I'm back! I still remember ${game.brain.stats.discoveries} things I've learned. 🦎` : 'Hi! I\'m Pip. I don\'t know anything about this place yet… 🦎', 'thought');

  const renderer = new Renderer($('world'));
  const ui = { tool: 'hand', ghost: null, highlight: null, showIntent: true, drag: null };
  let speed = 1;

  // ---------- palette ----------
  const palette = $('palette');
  const tools = [['hand', '✋', 'Pet / move'], ...Object.entries(TYPES).map(([k, t]) => [k, t.emoji, t.name]), ['remove', '🧹', 'Remove']];
  for (const [k, e, label] of tools) {
    const b = document.createElement('button');
    b.dataset.tool = k;
    b.innerHTML = `<span class="e">${e}</span>${label}`;
    b.title = k === 'hand' ? 'Click Pip to pet it, drag things to move them' : k === 'remove' ? 'Click something to remove it' : `Place a ${label}`;
    b.onclick = () => setTool(k);
    palette.appendChild(b);
  }
  function setTool(k) {
    ui.tool = k;
    for (const b of palette.children) b.classList.toggle('on', b.dataset.tool === k);
  }
  setTool('hand');

  // ---------- canvas input ----------
  const canvas = $('world');
  function toWorld(ev) {
    const r = canvas.getBoundingClientRect();
    return { x: (ev.clientX - r.left) / r.width * WORLD_W, y: (ev.clientY - r.top) / r.height * WORLD_H };
  }
  canvas.addEventListener('pointerdown', ev => {
    const p = toWorld(ev);
    const L = game.lizard;
    if (ui.tool === 'hand') {
      if (dist(p.x, p.y, L.x, L.y) < 30 || L.segs.some(s => dist(p.x, p.y, s.x, s.y) < 14)) { game.pet(); return; }
      const o = game.world.objectAt(p.x, p.y);
      if (o) { ui.drag = o; canvas.setPointerCapture(ev.pointerId); }
    } else if (ui.tool === 'remove') {
      const o = game.world.objectAt(p.x, p.y);
      if (o) game.world.remove(o.id);
    } else {
      game.world.add(ui.tool, p.x, p.y);
    }
  });
  canvas.addEventListener('pointermove', ev => {
    const p = toWorld(ev);
    if (ui.drag) { ui.drag.x = clamp(p.x, 15, WORLD_W - 15); ui.drag.y = clamp(p.y, 15, WORLD_H - 15); ui.drag.vx = ui.drag.vy = 0; return; }
    ui.ghost = TYPES[ui.tool] && ev.pointerType === 'mouse' ? { type: ui.tool, x: p.x, y: p.y } : null;
    ui.highlight = (ui.tool === 'hand' || ui.tool === 'remove') ? game.world.objectAt(p.x, p.y) : null;
  });
  canvas.addEventListener('pointerup', () => { ui.drag = null; });
  canvas.addEventListener('pointerleave', () => { ui.ghost = null; ui.highlight = null; });

  // ---------- header ----------
  for (const b of document.querySelectorAll('.speed button')) {
    b.onclick = () => {
      speed = +b.dataset.speed;
      document.querySelectorAll('.speed button').forEach(x => x.classList.toggle('on', x === b));
    };
  }
  $('pipName').onclick = () => {
    const n = prompt('What should your lizard be called?', game.lizard.name);
    if (n && n.trim()) { game.lizard.name = n.trim().slice(0, 20); save(); }
  };

  // ---------- needs ----------
  const needsEl = $('needs');
  const needRows = {};
  for (const n of NEEDS) {
    const row = document.createElement('div');
    row.className = 'need';
    row.innerHTML = `<span>${NEED_INFO[n].icon}</span><span>${NEED_INFO[n].label}</span><div class="bar"><i></i></div><span class="val"></span>`;
    needsEl.appendChild(row);
    needRows[n] = row;
  }
  function renderNeeds() {
    for (const n of NEEDS) {
      const v = game.lizard.needs[n];
      const row = needRows[n];
      const bar = row.querySelector('.bar');
      bar.querySelector('i').style.width = v + '%';
      const bad = n === 'warmth' ? (v < 35 || v > 92) : v < 25;
      const mid = n === 'warmth' ? (v < 55) : v < 50;
      bar.classList.toggle('low', bad);
      bar.classList.toggle('mid', !bad && mid);
      row.querySelector('.val').textContent = Math.round(v);
    }
  }

  // ---------- tasks ----------
  const typeSel = $('taskType');
  for (const [k, t] of Object.entries(TYPES)) {
    const o = document.createElement('option');
    o.value = k; o.textContent = `${t.emoji} ${t.name}`;
    typeSel.appendChild(o);
  }
  typeSel.value = 'ball';
  $('giveTask').onclick = () => {
    const verb = $('taskVerb').value, type = typeSel.value, count = +$('taskCount').value;
    game.giveTask({ text: taskTextFor(verb, type), verb, type, count, auto: true });
    if (!game.world.objects.some(o => o.type === type)) game.addLog(`(Psst — there's no ${TYPES[type].emoji} in the world. Add one!)`, 'task');
  };
  $('giveCustom').onclick = () => {
    const text = $('customText').value.trim();
    if (!text) return;
    const words = tokenize(text);
    if (!words.length) { game.addLog('Pip didn\'t catch any words in that. Try something like "climb the rock".', 'task'); return; }
    game.giveTask({ text, auto: false, count: 1 });
    $('customText').value = '';
  };
  $('customText').addEventListener('keydown', e => { if (e.key === 'Enter') $('giveCustom').click(); });
  $('good').onclick = () => game.goodPip();
  $('no').onclick = () => game.noPip();

  let taskSig = null;
  function renderTask() {
    const el = $('currentTask');
    const t = game.task;
    const sig = t ? t.id + ':' + t.progress : '';
    if (sig === taskSig) return;
    taskSig = sig;
    el.classList.toggle('on', !!t);
    if (!t) { el.innerHTML = ''; return; }
    el.innerHTML = `<span>📋</span><span class="txt">"${escapeHtml(t.text)}" ${t.count > 1 ? `<b>${t.progress}/${t.count}</b>` : ''}${t.auto ? '' : ' <small>(you judge)</small>'}</span><button id="cancelTask">Cancel</button>`;
    $('cancelTask').onclick = () => game.cancelTask();
  }
  game.on('task', renderTask);

  // ---------- log ----------
  let logLen = -1;
  function renderLog() {
    if (logLen === game.log.length && game.log.length < 60) return;
    logLen = game.log.length;
    const el = $('log');
    el.innerHTML = game.log.slice(-25).reverse().map(l => `<li class="k-${l.kind}">${escapeHtml(l.text)}</li>`).join('');
  }

  // ---------- brain panel ----------
  const needShort = { fullness: '🍖', hydration: '💧', energy: '⚡', warmth: '🔥', fun: '🎾', health: '❤️' };
  function renderBrain() {
    const k = game.brain.knowledge();
    const types = Object.keys(k).sort((a, b) => k[b].reduce((s, x) => s + x.n, 0) - k[a].reduce((s, x) => s + x.n, 0));
    const el = $('brain');
    if (!types.length) { el.innerHTML = '<div class="empty">Nothing yet — Pip is still figuring things out.</div>'; }
    else {
      el.innerHTML = types.map(t => {
        const T = typeInfo(t);
        const chips = k[t].sort((a, b) => b.n - a.n).map(e => {
          const effs = NEEDS.filter(n => Math.abs(e.d[n] || 0) >= 2).map(n => `${needShort[n]}${e.d[n] > 0 ? '+' : ''}${Math.round(e.d[n])}`);
          const score = NEEDS.reduce((s, n) => s + (e.d[n] || 0) * (n === 'health' ? 3 : n === 'energy' && e.d[n] < 0 ? 0.3 : 1), 0);
          const cls = (e.d.health || 0) < -2 || score < -3 ? 'bad' : score > 4 ? 'good' : '';
          return `<span class="chip ${cls}" title="tried ${e.n}×">${e.verb} ${effs.length ? effs.join(' ') : '· nothing'}</span>`;
        }).join('');
        return `<div class="row"><span class="e" title="${T.name}">${T.emoji}</span><div>${chips}</div></div>`;
      }).join('');
    }
    const s = game.brain.stats;
    $('stats').textContent = `· ${s.actions} things tried · ${s.tasksDone} tasks done`;
    const words = Object.keys(game.brain.words).map(w => [w, game.brain.meaning(w)]).filter(([, m]) => m && (m.type || m.verb));
    $('words').innerHTML = words.length ? words.map(([w, m]) => {
      const parts = [];
      if (m.type && m.type.rate > 0.4) parts.push(typeInfo(m.type.key).emoji);
      if (m.verb && m.verb.rate > 0.4) parts.push(m.verb.key);
      return parts.length ? `<span class="chip good">"${escapeHtml(w)}" → ${parts.join(' + ')}</span>` : `<span class="chip">"${escapeHtml(w)}" → ?</span>`;
    }).join('') : '<div class="empty">Give Pip tasks to teach it words.</div>';
  }

  // ---------- settings ----------
  $('autoFeeder').checked = game.world.autoFeeder;
  $('autoFeeder').onchange = e => { game.world.autoFeeder = e.target.checked; };
  $('showIntent').onchange = e => { ui.showIntent = e.target.checked; };
  $('curiosity').value = game.brain.curiosity;
  $('curiosity').oninput = e => { game.brain.curiosity = +e.target.value; };
  $('resetBrain').onclick = () => {
    if (!confirm(`Make ${game.lizard.name} forget everything it has learned?`)) return;
    const s = JSON.parse(JSON.stringify(game));
    s.brain = null; s.lizard.memory = []; s.task = null; s.taskHistory = [];
    restart(s);
    game.addLog('Huh? Where am I? Everything feels new… 🦎', 'thought');
  };
  $('resetWorld').onclick = () => {
    if (!confirm('Put the terrarium back to how it started? (Pip keeps its memories.)')) return;
    const s = JSON.parse(JSON.stringify(game));
    s.world = null; s.lizard.memory = []; s.lizard.x = WORLD_W / 2; s.lizard.y = WORLD_H / 2;
    restart(s);
  };
  function restart(s) {
    const listeners = game.listeners;
    game = new Game(s);
    game.listeners = listeners;
    $('autoFeeder').checked = game.world.autoFeeder;
    $('curiosity').value = game.brain.curiosity;
    logLen = -1; taskSig = null;
    renderTask(); renderBrain();
    save();
  }

  // ---------- main loop ----------
  const STEP = 1 / 30;
  let acc = 0, last = performance.now(), slowTimer = 0, saveTimer = 0;
  function frame(now) {
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    acc += dt * speed;
    let steps = 0;
    while (acc >= STEP && steps < 400) { game.step(STEP); acc -= STEP; steps++; }
    if (acc > STEP) acc = 0;
    renderer.draw(game, ui);
    renderNeeds();
    renderLog();
    $('thought').textContent = game.lizard.thought;
    $('mood').textContent = game.lizard.overallMood();
    $('pipName').textContent = game.lizard.name;
    slowTimer += dt; saveTimer += dt;
    if (slowTimer > 0.5) {
      slowTimer = 0;
      renderBrain();
      renderTask();
      const day = Math.floor(game.world.time / game.world.dayLength) + 1;
      $('clock').textContent = `${game.world.isNight ? '🌙 Night' : '☀️ Day'} ${day}`;
    }
    if (saveTimer > 5) { saveTimer = 0; save(); }
    requestAnimationFrame(frame);
  }
  window.addEventListener('beforeunload', save);
  document.addEventListener('visibilitychange', () => { if (document.hidden) save(); });
  renderTask(); renderBrain();
  requestAnimationFrame(frame);

  function escapeHtml(s) { return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
  window.pipGame = () => game; // handy for poking around in the console
})();
