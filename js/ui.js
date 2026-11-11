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

  const renderer = new Renderer3D($('world'), $('overlay'));
  const ui = { tool: 'hand', ghost: null, highlight: null, showIntent: true, drag: null };
  let speed = 1;

  // ---------- palette ----------
  const palette = $('palette');
  const tools = [['hand', '✋', 'Pet / move'], ...Object.entries(TYPES).map(([k, t]) => [k, t.emoji, t.name]), ['remove', '🧹', 'Remove']];
  for (const [k, e, label] of tools) {
    const b = document.createElement('button');
    b.dataset.tool = k;
    b.innerHTML = `<span class="e">${e}</span>${label}`;
    b.title = k === 'hand' ? 'Click Pip to pet it, drag things to move them, drag empty space to turn the view' : k === 'remove' ? 'Click something to remove it' : `Place a ${label}`;
    b.onclick = () => setTool(k);
    palette.appendChild(b);
  }
  function setTool(k) {
    ui.tool = k;
    for (const b of palette.children) b.classList.toggle('on', b.dataset.tool === k);
  }
  setTool('hand');

  // ---------- canvas input ----------
  // Click = place / pet / remove. Drag a thing = move it. Drag empty space = turn the camera.
  const canvas = $('world');
  let down = null;
  canvas.addEventListener('pointerdown', ev => {
    canvas.setPointerCapture(ev.pointerId);
    const h = renderer.pick(ev.clientX, ev.clientY);
    down = { x: ev.clientX, y: ev.clientY, h, moved: false, orbit: false };
    if (ui.tool === 'hand' && h.objId && !h.lizard) ui.drag = game.world.get(h.objId);
  });
  canvas.addEventListener('pointermove', ev => {
    if (down) {
      const dx = ev.clientX - down.x, dy = ev.clientY - down.y;
      if (!down.moved && Math.hypot(dx, dy) > 6) { down.moved = true; down.orbit = !ui.drag; down.lx = ev.clientX; down.ly = ev.clientY; }
      if (down.moved && ui.drag) {
        const h = renderer.pick(ev.clientX, ev.clientY);
        if (h.x !== null) { ui.drag.x = clamp(h.x, 15, WORLD_W - 15); ui.drag.y = clamp(h.y, 15, WORLD_H - 15); ui.drag.vx = ui.drag.vy = 0; }
      } else if (down.orbit) {
        renderer.orbit(ev.clientX - down.lx, ev.clientY - down.ly);
        down.lx = ev.clientX; down.ly = ev.clientY;
      }
      return;
    }
    const h = renderer.pick(ev.clientX, ev.clientY);
    ui.ghost = TYPES[ui.tool] && ev.pointerType === 'mouse' && h.x !== null ? { x: h.x, y: h.y } : null;
    ui.highlight = (ui.tool === 'hand' || ui.tool === 'remove') ? h.objId : null;
  });
  canvas.addEventListener('pointerup', ev => {
    if (!down) return;
    const { h, moved } = down;
    down = null; ui.drag = null;
    if (moved) return;
    if (ui.tool === 'hand') { if (h.lizard) game.pet(); }
    else if (ui.tool === 'remove') { if (h.objId) game.world.remove(h.objId); }
    else if (h.x !== null) game.world.add(ui.tool, h.x, h.y);
  });
  canvas.addEventListener('pointerleave', () => { if (!down) { ui.ghost = null; ui.highlight = null; } });
  canvas.addEventListener('wheel', ev => { ev.preventDefault(); renderer.zoom(ev.deltaY > 0 ? 1.1 : 0.9); }, { passive: false });
  $('zoomIn').onclick = () => renderer.zoom(0.85);
  $('zoomOut').onclick = () => renderer.zoom(1.18);
  $('resetView').onclick = () => { renderer.resetView(); $('follow').classList.remove('on'); };
  $('follow').onclick = () => { renderer.view.follow = !renderer.view.follow; $('follow').classList.toggle('on', renderer.view.follow); if (renderer.view.follow) renderer.zoom(0.6); };

  // ---------- header ----------
  for (const b of document.querySelectorAll('.speed button')) {
    b.onclick = () => {
      speed = +b.dataset.speed;
      document.querySelectorAll('.speed button').forEach(x => x.classList.toggle('on', x === b));
    };
  }
  // Rename in place (pop-up dialogs aren't available everywhere)
  const nameEl = $('pipName');
  nameEl.onclick = () => { nameEl.contentEditable = 'true'; nameEl.focus(); document.getSelection().selectAllChildren(nameEl); };
  nameEl.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === 'Escape') { e.preventDefault(); if (e.key === 'Escape') nameEl.textContent = game.lizard.name; nameEl.blur(); } });
  nameEl.addEventListener('blur', () => {
    nameEl.contentEditable = 'false';
    const n = nameEl.textContent.trim().slice(0, 20);
    if (n) { game.lizard.name = n; save(); }
    nameEl.textContent = game.lizard.name;
  });

  // Two-click confirm for destructive buttons
  function confirmClick(btn, label, action) {
    const orig = btn.textContent;
    let armed = null;
    btn.onclick = () => {
      if (armed) { clearTimeout(armed); armed = null; btn.textContent = orig; btn.classList.remove('confirming'); action(); return; }
      btn.textContent = label; btn.classList.add('confirming');
      armed = setTimeout(() => { armed = null; btn.textContent = orig; btn.classList.remove('confirming'); }, 3500);
    };
  }

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
          const saw = e.seen && SEEN_ICON[e.seen] ? SEEN_ICON[e.seen] + ' ' : '';
          return `<span class="chip ${cls}" title="tried ${e.n}×">${e.verb} ${saw}${effs.length ? effs.join(' ') : (saw ? '' : '· nothing')}</span>`;
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
  confirmClick($('resetBrain'), 'Click again to erase memories', () => {
    const s = JSON.parse(JSON.stringify(game));
    s.brain = null; s.lizard.memory = []; s.task = null; s.taskHistory = [];
    restart(s);
    game.addLog('Huh? Where am I? Everything feels new… 🦎', 'thought');
  });
  confirmClick($('resetWorld'), 'Click again to reset the world', () => {
    const s = JSON.parse(JSON.stringify(game));
    s.world = null; s.lizard.memory = []; s.lizard.x = WORLD_W / 2; s.lizard.y = WORLD_H / 2;
    restart(s);
  });
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
    renderer.draw(game, ui, dt);
    renderNeeds();
    renderLog();
    $('thought').textContent = game.lizard.thought;
    $('mood').textContent = game.lizard.overallMood();
    if (document.activeElement !== nameEl) nameEl.textContent = game.lizard.name;
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
