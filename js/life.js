'use strict';
/*
 * life.js — Pip's life story: a diary, goals, personality, growing up,
 * getting sick, visitors, and "what Pip is thinking about".
 */

// ---------- new things in the world ----------
TYPES.beetle = { emoji: '🪲', name: 'beetle', size: 10, food: true, crawls: true, hidden: true, visitor: true, words: ['beetle', 'bug'] };
TYPES.gecko = { emoji: '🦎', name: 'gecko visitor', size: 14, crawls: true, hidden: true, visitor: true, words: ['gecko', 'friend', 'visitor'] };
TYPES.mint = { emoji: '🌿', name: 'mint leaves', size: 10, food: true, hidden: true, words: ['mint', 'herb', 'herbs', 'medicine'] };
TYPES.shed = { emoji: '🫧', name: 'shed skin', size: 14, hidden: true, words: ['skin', 'shed'] };
EFFECTS.beetle = { eat: { fullness: 16, fun: 4 }, play: { fun: 10 } };
EFFECTS.gecko = { play: { fun: 26 }, rest: { energy: 6, fun: 8 } };
EFFECTS.mint = { eat: { fullness: 3, health: 12 } };
EFFECTS.shed = { play: { fun: 6 }, eat: { fullness: 4, fun: -2 } };

// Stages of a lizard's life (in in-game days)
const LIFE_STAGES = [[0, 'Hatchling', 0.72], [8, 'Youngster', 0.85], [20, 'Young adult', 0.97], [38, 'Grown-up', 1.08]];
function lifeStage(days) { let s = LIFE_STAGES[0]; for (const st of LIFE_STAGES) if (days >= st[0]) s = st; return s; }

// ---------- goals ----------
const GOALS = [
  ['eat', '🍖 Find something to eat', g => Object.keys(g.brain.effects).some(k => k.endsWith(':eat') && g.brain.effects[k].n > 0 && (g.brain.effects[k].d.fullness || 0) >= 8)],
  ['drink', '💧 Find water', g => (g.brain.known('water', 'drink') || {}).n > 0],
  ['read', '📚 Discover the book shop', g => !!g.brain.known('bookstore', 'read')],
  ['pages', '📖 Read 10 pages', g => (g.brain.stats.books || 0) >= 10],
  ['plant', '🌱 Plant a seed', g => !!(g.brain.skills.plant && g.brain.skills.plant.hits)],
  ['crop', '🌾 Grow a crop', g => g.world.objects.some(o => o.type === 'plant')],
  ['burrow', '🪨 Build a burrow', g => g.world.objects.some(o => o.type === 'hut')],
  ['cook', '🔥 Cook a meal', g => !!(g.brain.skills.cook && g.brain.skills.cook.hits)],
  ['invent', '💡 Invent something by tinkering', g => Object.keys(g.brain.customRecipes || {}).length > 0],
  ['store', '🏚️ Save 5 foods for winter', g => g.world.objects.some(o => o.type === 'store' && (o.contents || []).length >= 5)],
  ['winter', '❄️ Survive a winter', g => (g.brain.winters || 0) >= 1 && g.world.season === 'spring'],
  ['bed', '🛏️ Make a comfy bed', g => g.world.objects.some(o => o.type === 'bed')],
  ['friend', '🦎 Make a friend', g => (g.brain.known('gecko', 'play') || {}).n > 0],
  ['grown', '🌟 Grow up', g => lifeStage(g.lizard.age || 0)[1] === 'Grown-up'],
  ['bookworm', '🐛 Become a bookworm', g => ((g.brain.reading || {}).literacy || 0) >= 20],
];

// Mixed into Game
const Life = {
  initLife(save) {
    this.diary = (save && save.diary) || [];
    this.today = (save && save.today) || [];
    this.goals = (save && save.goals) || {};
    this.lastDay = save && save.lastDay !== undefined ? save.lastDay : Math.floor(this.world.time / this.world.dayLength);
    this.visitorTimer = (save && save.visitorTimer) || 300;
    this.lifeTimer = 0;
    const b = this.brain;
    b.personality = b.personality || { bravery: 0.5, laziness: 0.4, curiosity: 0.5, chattiness: 0.5 };
  },

  lifeStep(dt) {
    this.lifeTimer += dt;
    if (this.lifeTimer < 2) return;
    const secs = this.lifeTimer; this.lifeTimer = 0;
    const L = this.lizard, W = this.world, b = this.brain, P = b.personality;
    // growing up: age in days; eating well helps you grow
    L.age = (L.age || 0) + secs / W.dayLength;
    const wellFed = L.needs.fullness > 50 && L.needs.hydration > 50;
    L.growth = clamp((L.growth || lifeStage(L.age)[2]) + (wellFed ? 0.00012 : -0.00002) * secs, 0.68, lifeStage(L.age)[2] + 0.06);
    const stage = lifeStage(L.age)[1];
    if (L.stage && L.stage !== stage) { L.think(`I feel bigger! I'm a ${stage.toLowerCase()} now! 🌟`, 'discover'); this.note(`I grew up into a ${stage.toLowerCase()}!`, 3); this.celebrate = 2.5; }
    L.stage = stage;
    // shedding skin every few days
    L.shedTimer = (L.shedTimer || 0) + secs;
    if (L.shedTimer > W.dayLength * 6 && L.state !== 'acting' && L.state !== 'fainted') {
      L.shedTimer = 0; L.shedding = 40;
      const a = Math.random() * 6.28; W.add('shed', L.x + Math.cos(a) * 26, L.y + Math.sin(a) * 26);
      L.think('Itchy itchy… I\'m shedding my old skin! Ooh, shiny new scales. ✨', 'discover');
      this.note('I shed my skin today. My new scales are so shiny!', 2);
    }
    if (L.shedding > 0) L.shedding -= secs;
    // getting sick: wet and cold for too long
    if (L.wet > 55 && L.needs.warmth < 25) L.sick = Math.min(80, (L.sick || 0) + secs * 0.4);
    if (L.sick > 0) {
      const resting = L.state === 'acting' && L.plan && L.plan.verb === 'rest' && L.needs.warmth > 50;
      L.sick = Math.max(0, L.sick - secs * (resting ? 0.8 : 0.15));
      if (L.sick <= 0) { L.think('I feel better! 😊', 'happy'); this.note('I got better after being poorly.', 2); }
    }
    // personality drifts with experience
    P.curiosity = clamp(P.curiosity + (b.stats.discoveries - (this._disc || b.stats.discoveries)) * 0.004, 0.1, 1);
    this._disc = b.stats.discoveries;
    if (L.needs.health < 40) P.bravery = clamp(P.bravery - 0.0006 * secs, 0.05, 1);
    else P.bravery = clamp(P.bravery + 0.00003 * secs, 0.05, 1);
    if (L.state === 'idling' || (L.state === 'acting' && L.plan && L.plan.verb === 'rest')) P.laziness = clamp(P.laziness + 0.00004 * secs, 0.05, 0.95);
    else if (L.state === 'acting') P.laziness = clamp(P.laziness - 0.00003 * secs, 0.05, 0.95);
    b.curiosity = clamp(0.6 + P.curiosity * 0.9, 0.2, 2);
    // visitors: a food-stealing beetle, or a friendly gecko
    this.visitorTimer -= secs;
    if (this.visitorTimer <= 0) {
      this.visitorTimer = W.dayLength * (1.5 + Math.random() * 2);
      if (!W.objects.some(o => TYPES[o.type].visitor) && W.season !== 'winter') {
        const kind = Math.random() < 0.55 ? 'beetle' : 'gecko';
        const o = W.add(kind, Math.random() < 0.5 ? 30 : WORLD_W - 30, 60 + Math.random() * 200);
        if (o) { o.stay = kind === 'gecko' ? 300 : 999; L.think(kind === 'beetle' ? 'Hey! A beetle just crept in… it\'s looking at my food! 🪲😠' : 'Oh! Another lizard! Hello there! 🦎💚', 'discover'); }
      }
    }
    // mint grows wild in the meadow now and then (spring and summer)
    if ((W.season === 'spring' || W.season === 'summer') && Math.random() < secs / 900 && W.objects.filter(o => o.type === 'mint').length < 2) {
      W.add('mint', 100 + Math.random() * 760, MEADOW.y - 60 + Math.random() * 150);
    }
    this.checkGoals();
    // a new day: write in the diary
    const day = Math.floor(W.time / W.dayLength);
    if (day > this.lastDay) { this.writeDiary(this.lastDay + 1); this.lastDay = day; }
  },

  // remember something for today's diary (importance 1-3)
  note(text, importance = 1) {
    // everyday chores don't make it into the diary, and nothing twice
    if (/^(Eek|BOOM|So loud|Ooh! What's that|There you go|Got a|Got my|Planted another|Sizzle… one|Filled my bucket|Stored a|Time to|Off to|I'll grab|Clack\. More|Crack\. More|Bonk|Found a|That (filled|quenched|gave|warmed|was)|Nope|Rainy day…|Listening|Pitter|Cosy in here|Staying in|Nothing here|Just sand|Tap, tap|I pulled at)/.test(text)) return;
    const key = text.replace(/[^a-z ]/gi, '').slice(0, 40);
    if (this.today.some(t => t.key === key)) return;
    this.today.push({ text, importance, key });
    if (this.today.length > 40) this.today.shift();
  },

  writeDiary(dayNum) {
    const W = this.world, L = this.lizard;
    const picked = this.today.slice().sort((a, b) => b.importance - a.importance).slice(0, 3);
    const seasonDay = ((dayNum - 1) % DAYS_PER_SEASON) + 1;
    const weatherLine = { rain: 'It rained.', thunder: 'There was a scary storm.', snow: 'It snowed!', heatwave: 'It was SO hot.', sunny: 'It was sunny.', cloudy: 'It was cloudy.' }[W.weather] || '';
    const n = L.needs, low = Math.min(n.fullness, n.hydration, n.fun);
    const feel = L.sick > 30 ? 'I still feel poorly.' : low < 25 ? 'I\'m tired and hungry.' : n.fun > 70 ? 'It was a good day. 😊' : 'An okay sort of day.';
    let body = picked.map(p => p.text.replace(/\s*\(.*?\)\s*/g, ' ').trim()).join(' ');
    if (!body) body = pick(['Nothing much happened. I watched the world go by.', 'A quiet day.', 'I pottered about.']);
    this.diary.unshift({ day: dayNum, season: W.season, text: `${weatherLine} ${body} ${feel}`.trim() });
    if (this.diary.length > 80) this.diary.pop();
    this.today = [];
    this.emit('diary');
  },

  checkGoals() {
    for (const [id, label, test] of GOALS) {
      if (this.goals[id]) continue;
      let ok = false; try { ok = test(this); } catch (e) { ok = false; }
      if (ok) {
        this.goals[id] = this.world.time;
        this.addLog(`🏆 Goal reached: ${label}!`, 'task');
        this.note(`I did something big today: ${label.replace(/^\S+\s/, '').toLowerCase()}!`, 3);
        this.celebrate = 2.5;
        this.emit('goals');
      }
    }
  },

  // Pip's favourite and least favourite things, from experience
  favourites() {
    const b = this.brain, out = { food: null, toy: null, bed: null, hates: [] };
    let bf = 0, bt = 0, bb = 0;
    for (const [k, e] of Object.entries(b.effects)) {
      if (!e.n) continue;
      const [t, v] = k.split(':');
      if (!TYPES[t] && t !== 'ground') continue;
      const d = e.d;
      if (v === 'eat' && (d.health || 0) >= 0) { const s = (d.fullness || 0) + (d.fun || 0) * 1.5; if (s > bf) { bf = s; out.food = t; } }
      if (v === 'play') { const s = d.fun || 0; if (s > bt) { bt = s; out.toy = t; } }
      if (v === 'rest') { const s = d.energy || 0; if (s > bb) { bb = s; out.bed = t; } }
      if ((d.health || 0) < -3 && !out.hates.includes(t)) out.hates.push(t);
    }
    return out;
  },
};

// Visitors' own behaviour, run by the world each step
function visitorStep(world, o, dt, lizard) {
  o.stay -= dt;
  if (o.stay <= 0) { world.addFx('sparkle', o.x, o.y); world.remove(o.id); return; }
  if (o.type === 'beetle') {
    // heads for the food store (or crops) and nibbles
    const target = world.objects.find(x => x.type === 'store' && (x.contents || []).length) || world.objects.find(x => x.type === 'plant');
    if (target) {
      const a = Math.atan2(target.y + 30 - o.y, target.x - o.x);
      o.vx = Math.cos(a) * 18; o.vy = Math.sin(a) * 18;
      if (dist(o.x, o.y, target.x, target.y + 30) < 22) {
        o.nibble = (o.nibble || 0) + dt;
        if (o.nibble > 25) {
          o.nibble = 0;
          if (target.type === 'store') { const gone = target.contents.pop(); world.events.push({ kind: 'stolen', what: gone }); }
          else target.timer = Math.max(0, (target.timer || 0) - 80);
        }
      }
    }
  }
}

Object.assign(Game.prototype, Life);
