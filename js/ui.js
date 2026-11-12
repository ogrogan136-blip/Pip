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
  function buildPalette() {
    palette.innerHTML = '';
    // hidden things appear once Pip has discovered them
    const tools = [['hand', '✋', 'Pet / move'], ...Object.entries(TYPES).filter(([k, t]) => !t.hidden || game.brain.seen[k]).map(([k, t]) => [k, t.emoji, t.name]), ['remove', '🧹', 'Remove']];
    for (const [k, e, label] of tools) {
      const b = document.createElement('button');
      b.dataset.tool = k;
      b.innerHTML = `<span class="e">${escapeHtml(e)}</span>${escapeHtml(label)}`;
      b.title = k === 'hand' ? 'Click Pip to pet it, drag things to move them, drag empty space to turn the view' : k === 'remove' ? 'Click something to remove it' : `Place a ${label}`;
      b.onclick = () => setTool(k);
      palette.appendChild(b);
    }
    if ((!TYPES[ui.tool] || (TYPES[ui.tool].hidden && !game.brain.seen[ui.tool])) && ui.tool !== 'remove') ui.tool = 'hand';
    setTool(ui.tool);
  }
  function setTool(k) {
    ui.tool = k;
    for (const b of palette.children) b.classList.toggle('on', b.dataset.tool === k);
  }
  buildPalette();

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
  function buildTypeSelect() {
    const keep = typeSel.value || 'ball';
    typeSel.innerHTML = '';
    for (const [k, t] of Object.entries(TYPES)) {
      if (t.hidden && !game.brain.seen[k]) continue;
      const o = document.createElement('option');
      o.value = k; o.textContent = `${t.emoji} ${t.name}`;
      typeSel.appendChild(o);
    }
    typeSel.value = TYPES[keep] ? keep : 'ball';
  }
  buildTypeSelect();
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
  let lastSeenCount = -1;
  const needShort = { fullness: '🍖', hydration: '💧', energy: '⚡', warmth: '🔥', fun: '🎾', health: '❤️' };
  function renderBrain() {
    const k = game.brain.knowledge();
    const types = Object.keys(k).filter(t => typeInfo(t)).sort((a, b) => k[b].reduce((s, x) => s + x.n, 0) - k[a].reduce((s, x) => s + x.n, 0));
    const el = $('brain');
    if (!types.length) { el.innerHTML = '<div class="empty">Nothing yet — Pip is still figuring things out.</div>'; }
    else {
      el.innerHTML = types.map(t => {
        const T = typeInfo(t);
        const chips = k[t].sort((a, b) => b.n - a.n).map(e => {
          const effs = NEEDS.filter(n => Math.abs(e.d[n] || 0) >= 2).map(n => `${needShort[n]}${e.d[n] > 0 ? '+' : ''}${Math.round(e.d[n])}`);
          const score = NEEDS.reduce((s, n) => s + (e.d[n] || 0) * (n === 'health' ? 3 : n === 'energy' && e.d[n] < 0 ? 0.3 : 1), 0);
          const cls = (e.d.health || 0) < -2 || score < -3 ? 'bad' : score > 4 ? 'good' : '';
          const saw = (e.told ? '💬 ' : e.book ? '📖 ' : '') + (e.seen && SEEN_ICON[e.seen] ? SEEN_ICON[e.seen] + ' ' : '');
          return `<span class="chip ${cls}" title="${e.told ? 'you told Pip this' : e.book ? 'read about it in a book' : 'tried ' + e.n + '×'}">${e.verb} ${saw}${effs.length ? effs.join(' ') : (saw ? '' : '· nothing')}</span>`;
        }).join('');
        return `<div class="row"><span class="e" title="${T.name}">${T.emoji}</span><div>${chips}</div></div>`;
      }).join('');
    }
    // skills and ideas
    const b = game.brain, sk = [];
    const label = n => n.startsWith('recipe:') ? 'make ' + RECIPES[n.slice(7)].label : { dig: '⛏️ dig in the sand', break: '💪 pull logs apart', craft: '🔨 build things', plant: '🌱 plant seeds', tend: '💧 water seedlings', grass: '🌿 seeds grow in grass', carry: '🪣 carry water in a bucket', stockpile: '🏚️ save food for winter', shelter: '🏠 stay dry indoors when it rains', chip: '🪨 knock stones off rocks', cook: '🔥 cook food on the stove', summerhot: '🥵 no sweaters in summer' }[n];
    for (const n of Object.keys(b.skills)) { const s2 = b.skills[n]; if (label(n)) sk.push(`<span class="chip ${s2.hits ? 'good' : ''}" title="tried ${s2.n}×, worked ${s2.hits}×">${escapeHtml(label(n))}${s2.hits ? '' : ' · still practising'}</span>`); }
    for (const n of Object.keys(b.ideas)) if (!b.skills[n] && label(n)) sk.push(`<span class="chip" title="idea from ${escapeHtml(b.ideas[n])}">💡 ${escapeHtml(label(n))}?</span>`);
    if (b.tools.digger) sk.push('<span class="chip good">has a digging stick</span>');
    if (b.tools.hammer) sk.push('<span class="chip good">has a stone hammer 🔨</span>');
    const seeds = Object.entries(b.seeds || {}).filter(([t, n]) => n > 0 && TYPES[t]);
    if (seeds.length) sk.push(`<span class="chip">seeds: ${seeds.map(([t, n]) => TYPES[t].emoji + '×' + n).join(' ')}</span>`);
    $('skills').innerHTML = sk.length ? sk.join('') : '<div class="empty">None yet. Ideas come with time, play and books.</div>';
    const seenCount = Object.keys(b.seen).length;
    if (seenCount !== lastSeenCount) { lastSeenCount = seenCount; buildPalette(); buildTypeSelect(); }
    const s = game.brain.stats;
    $('stats').textContent = `· ${s.actions} things tried · ${s.books || 0} read in books · ${s.tasksDone} tasks done`;
    const words = Object.keys(game.brain.words).map(w => [w, game.brain.meaning(w)]).filter(([, m]) => m && (m.type || m.verb));
    $('words').innerHTML = words.length ? words.map(([w, m]) => {
      const parts = [];
      if (m.type && m.type.rate > 0.4) parts.push(typeInfo(m.type.key).emoji);
      if (m.verb && m.verb.rate > 0.4) parts.push(m.verb.key);
      return parts.length ? `<span class="chip good">"${escapeHtml(w)}" → ${parts.join(' + ')}</span>` : `<span class="chip">"${escapeHtml(w)}" → ?</span>`;
    }).join('') : '<div class="empty">Give Pip tasks to teach it words.</div>';
  }

  // ---------- talking with Pip ----------
  let chatSig = null;
  function renderChat() {
    const q = game.question;
    const sig = game.chat.length + ':' + (game.chat.length ? game.chat[game.chat.length - 1].text : '') + ':' + (q ? q.text : '');
    if (sig === chatSig) return;
    chatSig = sig;
    const el = $('chat');
    el.innerHTML = game.chat.length ? game.chat.slice(-14).map(m => `<li class="${m.from === 'pip' ? 'pip' : 'you'}">${m.from === 'pip' ? '🦎 ' : ''}${escapeHtml(m.text)}</li>`).join('')
      : '<li class="empty"><span class="empty">Pip hasn\'t asked for anything yet.</span></li>';
    el.scrollTop = el.scrollHeight;
    $('quick').innerHTML = q ? q.options.map((o, i) => `<button type="button" data-i="${i}">${escapeHtml(o.label)}</button>`).join('') : '';
    $('chatPanel').classList.toggle('asking', !!q);
    $('chatText').placeholder = q && q.kind === 'word' ? 'Explain it, e.g. "play with the ball"' : 'Say something to Pip…';
  }
  $('quick').addEventListener('click', e => { const b = e.target.closest('button'); if (b) { game.answerOption(+b.dataset.i); renderChat(); } });
  function showThinking(on) {
    const el = $('chat');
    const old = el.querySelector('.thinking');
    if (old) old.remove();
    if (on) { const li = document.createElement('li'); li.className = 'pip thinking'; li.textContent = '🦎 …'; el.appendChild(li); el.scrollTop = el.scrollHeight; }
  }
  function aiProblem(kind) {
    if (kind === 'off') { $('aiRow').hidden = true; game.addLog('(Smart Pip is off, so Pip uses its simple word-matching.)', 'task'); }
    else if (kind === 'busy') game.addLog('(Pip\'s smart brain needs a rest. Try again in a bit.)', 'task');
  }
  $('chatForm').addEventListener('submit', async e => {
    e.preventDefault();
    const t = $('chatText').value.trim();
    if (!t || AI.busy) return;
    $('chatText').value = '';
    if (!(AI.ready && $('aiOn').checked)) { game.say(t); renderChat(); return; }
    game.youSay(t); renderChat();
    AI.busy = true; showThinking(true);
    try {
      const r = await AI.reply(game, t);
      if (r && typeof r === 'object') r._asked = t;
      applyAiReply(game, r);
      if (r && r._missing) {
        // Pip mentioned making something: get that exact thing's details so it really appears
        let def = null;
        try { def = await AI.describeThing(game, String(r.say || ''), t); } catch (e2) { def = null; }
        const key = createInvented(game, def && def.name ? def : (game.daydreams.shift() || randomInvention()), true);
        if (key) { spawnInvention(game, key, 70); game.lizard.think(`There it is — my ${TYPES[key].emoji} ${TYPES[key].name}!`, 'discover'); }
      }
    }
    catch (err) { aiProblem(AI.handleError(err)); game.chat.pop(); game.say(t); }
    finally { AI.busy = false; showThinking(false); chatSig = null; renderChat(); save(); }
  });
  $('aiThink').onclick = async () => {
    if (AI.busy || !AI.ready) return;
    AI.busy = true; $('aiThink').disabled = true; $('aiThink').textContent = '💭 Thinking…';
    game.lizard.think('Hmm… let me think about everything…', 'thought');
    try { applyAiReflection(game, await AI.reflect(game)); }
    catch (err) { aiProblem(AI.handleError(err)); }
    finally { AI.busy = false; $('aiThink').disabled = false; $('aiThink').textContent = '💭 Let Pip think deeply'; save(); }
  };
  AI.init().then(ok => { if (ok) $('aiRow').hidden = false; });

  // ---------- make your own thing ----------
  const LEVELS = [['nothing', 'nothing happens'], ['good', 'good'], ['great', 'great'], ['bad', 'it hurts'], ['random', 'a random surprise']];
  $('mkDoes').innerHTML = VERBS.map(v => `<label>If Pip tries to ${v === 'play' ? 'play with' : v === 'bask' ? 'bask on' : v === 'rest' ? 'rest on' : v === 'drink' ? 'drink' : 'eat'} it
    <select id="mk_${v}">${LEVELS.map(([k, l]) => `<option value="${k}">${l}</option>`).join('')}</select></label>`).join('');
  function renderCustomList() {
    $('mkList').innerHTML = game.custom.map(d => `<span class="chip">${escapeHtml(d.emoji)} ${escapeHtml(d.name)}<button type="button" data-key="${d.key}" title="Delete this kind of thing" aria-label="Delete ${escapeHtml(d.name)}">✕</button></span>`).join('');
  }
  $('mkList').addEventListener('click', e => { const b = e.target.closest('button'); if (b) game.removeCustom(b.dataset.key); });
  $('mkRandom').onclick = () => {
    const r = a => a[Math.floor(Math.random() * a.length)];
    $('mkShape').value = r(['ball', 'box', 'cone', 'cylinder', 'blob', 'star']);
    $('mkColor').value = '#' + [0, 0, 0].map(() => (60 + Math.floor(Math.random() * 180)).toString(16)).join('');
    $('mkSize').value = r(['10', '15', '22']);
    for (const v of VERBS) $('mk_' + v).value = r(['nothing', 'nothing', 'good', 'great', 'bad', 'random']);
    $('mkMoves').checked = Math.random() < 0.25;
    if (!$('mkName').value) $('mkName').value = r(['wibble', 'zonk', 'mystery', 'blorp', 'gizmo', 'thingy']);
    if (!$('mkEmoji').value) $('mkEmoji').value = r(['❔', '🎁', '🔮', '🧩', '🪀']);
  };
  $('mkCreate').onclick = () => {
    const name = $('mkName').value.trim();
    if (!name) { $('mkName').focus(); return; }
    const does = {};
    for (const v of VERBS) does[v] = $('mk_' + v).value;
    const key = game.addCustom({
      name, emoji: $('mkEmoji').value.trim() || '❔', shape: $('mkShape').value, color: $('mkColor').value, size: +$('mkSize').value,
      moves: $('mkMoves').checked, consumable: $('mkGone').checked || (does.eat !== 'nothing' && does.eat !== 'bad' && $('mkGone').checked), does,
    });
    $('mkName').value = ''; $('mkEmoji').value = '';
    setTool(key);
    game.addLog(`(You made a new thing: ${TYPES[key].emoji} ${TYPES[key].name}. Click in the terrarium to place it.)`, 'task');
    save();
  };
  function onTypesChanged() { buildPalette(); buildTypeSelect(); renderCustomList(); }
  game.on('types', onTypesChanged);
  renderCustomList();

  // ---------- Pip's books ----------
  let booksSig = null;
  function renderBooks() {
    const b = game.brain, r = b.readState(), books = b.allBooks();
    const sig = JSON.stringify([r.literacy, r.read, Object.values(r.interests).map(v => Math.round(v * 50)), Object.keys(books).length, b.known('bookstore', 'read') ? 1 : 0]);
    if (sig === booksSig) return;
    booksSig = sig;
    const knows = !!b.known('bookstore', 'read');
    $('readLevel').textContent = knows ? '· ' + readingLevelName(r.literacy) : '· hasn\'t found the books yet';
    const ints = Object.entries(r.interests).filter(([k]) => books[k]).sort((a, c) => c[1] - a[1]).slice(0, 6);
    const word = v => v > 0.75 ? 'obsessed' : v > 0.5 ? 'loves it' : v > 0.3 ? 'interested' : v > 0.12 ? 'a bit curious' : 'not yet';
    $('interests').innerHTML = ints.map(([k, v]) => `<div class="interest"><span>${books[k].emoji}</span><div class="bar" title="${escapeHtml(books[k].title)}"><i style="width:${Math.round(v * 100)}%"></i></div><span class="hint" style="margin:0">${word(v)}</span></div>`).join('');
    const readBooks = Object.keys(books).filter(k => (r.read[k] || []).length).sort((a, c) => (r.read[c] || []).length - (r.read[a] || []).length);
    $('booksRead').innerHTML = readBooks.length ? readBooks.map(k => {
      const bk = books[k], idx = (r.read[k] || []).slice().sort((x, y) => x - y);
      return `<details><summary><span>${bk.emoji}</span><span>${escapeHtml(bk.title)}</span><span class="prog">${idx.length}/${bk.pages.length} pages</span></summary><ol>${idx.map(i => `<li value="${i + 1}">${escapeHtml(bk.pages[i][0])}</li>`).join('')}</ol></details>`;
    }).join('') : `<div class="empty">${knows ? 'Nothing read yet.' : 'Pip doesn\'t know what the 📚 book shop is for yet.'}</div>`;
  }

  // Smart Pip can stock the shop with a new book
  $('newBook').onclick = async () => {
    if (AI.busy || !AI.ready) return;
    const b = game.brain, top = b.topInterest();
    const topic = $('bookTopic').value.trim() || (top ? b.allBooks()[top[0]].title : 'lizards');
    AI.busy = true; $('newBook').disabled = true; $('newBook').textContent = 'Writing…';
    try {
      const out = await AI.writeBook(game, topic);
      if (out && out.title && Array.isArray(out.pages) && out.pages.length) {
        const key = 'x' + Date.now().toString(36);
        b.extraBooks = b.extraBooks || {};
        b.extraBooks[key] = { title: String(out.title).slice(0, 50), emoji: [...String(out.emoji || '📗')].slice(0, 2).join(''), pages: out.pages.slice(0, 12).map(p => [String(p).slice(0, 160)]) };
        b.readState().interests[key] = 0.2;
        $('bookTopic').value = '';
        game.addLog(`(A new book arrived at the book shop: "${b.extraBooks[key].title}")`, 'task');
        booksSig = null; save();
      }
    } catch (err) { aiProblem(AI.handleError(err)); }
    finally { AI.busy = false; $('newBook').disabled = false; $('newBook').textContent = '＋ Add a new book'; }
  };
  AI.init().then(ok => { if (ok) $('bookAiRow').hidden = false; });

  // ---------- settings ----------
  $('autoFeeder').checked = game.world.autoFeeder;
  $('autoFeeder').onchange = e => { game.world.autoFeeder = e.target.checked; };
  $('freeImagination').checked = game.freeImagination;
  $('freeImagination').onchange = e => { game.freeImagination = e.target.checked; };
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
    renderTask(); renderBrain(); onTypesChanged(); chatSig = null; booksSig = null;
    save();
  }

  // ---------- if anything goes wrong, keep going instead of freezing ----------
  let lastErr = '';
  function recover(err) {
    const msg = (err && err.message) || String(err);
    console.error('Pip hit a problem:', err);
    if (msg !== lastErr) { lastErr = msg; game.addLog(`⚠️ Something went wrong (${msg}). Pip shook it off.`, 'bad'); }
    const L = game.lizard;
    try { L.drop(game.world); } catch (e) { L.carrying = null; }
    L.inside = false; L.state = 'pausing'; L.timer = 1; L.plan = null;
    game.world.objects.forEach(o => { o.held = false; o.carried = false; o.lift = 0; });
  }

  // ---------- main loop ----------
  const STEP = 1 / 60;
  let acc = 0, last = performance.now(), slowTimer = 0, saveTimer = 0;
  function frame(now) {
    requestAnimationFrame(frame); // schedule the next frame first, so nothing can freeze the game
    try {
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    acc += dt * speed;
    let steps = 0;
    try { while (acc >= STEP && steps < 800) { game.step(STEP); acc -= STEP; steps++; } }
    catch (err) { acc = 0; recover(err); }
    if (acc > STEP) acc = 0;
    try { renderer.draw(game, ui, dt); } catch (err) { recover(err); }
    renderNeeds();
    renderLog();
    renderChat();
    $('thought').textContent = game.lizard.thought;
    $('mood').textContent = game.lizard.overallMood();
    if (document.activeElement !== nameEl) nameEl.textContent = game.lizard.name;
    slowTimer += dt; saveTimer += dt;
    if (slowTimer > 0.5) {
      slowTimer = 0;
      renderBrain();
      renderBooks();
      renderTask();
      const day = Math.floor(game.world.time / game.world.dayLength) + 1;
      const W = game.world, SI = SEASON_INFO[W.season], WI = WEATHER_INFO[W.weather || 'sunny'];
      $('clock').textContent = `${SI.icon} ${SI.label} · ${W.isNight ? '🌙' : ''}Day ${((day - 1) % DAYS_PER_SEASON) + 1} · ${WI.icon} ${WI.label}`;
      $('clock').title = `Year ${W.year}`;
    }
    if (saveTimer > 5) { saveTimer = 0; save(); }
    } catch (err) { recover(err); }
  }
  window.addEventListener('beforeunload', save);
  document.addEventListener('visibilitychange', () => { if (document.hidden) save(); });
  renderTask(); renderBrain();
  requestAnimationFrame(frame);

  function escapeHtml(s) { return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
  window.pipGame = () => game; // handy for poking around in the console
})();
