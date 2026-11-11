'use strict';
/*
 * world.js — the terrarium: what exists, and the hidden "laws of nature".
 *
 * Pip never reads EFFECTS directly. It only experiences the results of its
 * own actions and has to learn what everything does.
 */

const WORLD_W = 960;
const WORLD_H = 600;

const NEEDS = ['fullness', 'hydration', 'energy', 'warmth', 'fun', 'health'];
const NEED_INFO = {
  fullness:  { icon: '🍖', label: 'Tummy' },
  hydration: { icon: '💧', label: 'Water' },
  energy:    { icon: '⚡', label: 'Energy' },
  warmth:    { icon: '🔥', label: 'Warmth' },
  fun:       { icon: '🎾', label: 'Fun' },
  health:    { icon: '❤️', label: 'Health' },
};

const VERBS = ['eat', 'drink', 'bask', 'rest', 'play'];
const VERB_INFO = {
  eat:   { icon: '😋', phrase: 'eat',        ing: 'eating' },
  drink: { icon: '👅', phrase: 'drink from', ing: 'drinking from' },
  bask:  { icon: '☀️', phrase: 'bask on',    ing: 'basking on' },
  rest:  { icon: '💤', phrase: 'rest on',    ing: 'resting on' },
  play:  { icon: '🤸', phrase: 'play with',  ing: 'playing with' },
  read:  { icon: '📖', phrase: 'read at',    ing: 'reading at' }, // only at the book shop
  // skills Pip is not born with — it has to get the idea first
  dig:   { icon: '⛏️', phrase: 'dig in',     ing: 'digging in' },
  break: { icon: '💪', phrase: 'break up',   ing: 'breaking up' },
  craft: { icon: '🔨', phrase: 'build',      ing: 'building' },
};

// What can be placed in the world. `food` = disappears when eaten.
const TYPES = {
  cricket:  { emoji: '🦗', name: 'cricket',    size: 13, food: true, hops: true },
  mealworm: { emoji: '🐛', name: 'mealworm',   size: 13, food: true, wiggles: true },
  lettuce:  { emoji: '🥬', name: 'lettuce',    size: 15, food: true },
  berry:    { emoji: '🍓', name: 'berry',      size: 12, food: true },
  mushroom: { emoji: '🍄', name: 'mushroom',   size: 14, food: true },
  ladybug:  { emoji: '🐞', name: 'ladybug',    size: 11, food: true, crawls: true },
  water:    { emoji: '💧', name: 'water dish', size: 22, words: ['water', 'dish'] },
  rock:     { emoji: '🪨', name: 'rock',       size: 24 },
  lamp:     { emoji: '💡', name: 'heat lamp',  size: 18, heat: 140, words: ['lamp', 'heat', 'light'] },
  log:      { emoji: '🪵', name: 'log',        size: 26, words: ['log', 'wood'] },
  ball:     { emoji: '⚽', name: 'ball',       size: 14, rolls: true },
  cactus:   { emoji: '🌵', name: 'cactus',     size: 20 },
  flower:   { emoji: '🌼', name: 'flower',     size: 13, food: true },
  // hidden things: they only show up in the palette once Pip has discovered them
  stick:    { emoji: '🥢', name: 'stick',      size: 12, hidden: true },
  crab:     { emoji: '🦀', name: 'crab',       size: 13, food: true, crawls: true, hidden: true },
  shell:    { emoji: '🐚', name: 'shell',      size: 11, hidden: true },
  bone:     { emoji: '🦴', name: 'bone',       size: 12, hidden: true },
  nest:     { emoji: '🪹', name: 'nest',       size: 24, hidden: true },
  den:      { emoji: '⛺', name: 'den',        size: 26, hidden: true },
  seedling: { emoji: '🌱', name: 'seedling',   size: 10, hidden: true },
  plant:    { emoji: '🪴', name: 'food plant', size: 20, hidden: true },
  cricketbox: { emoji: '📦', name: 'cricket box', size: 20, hidden: true },
  bookstore: { emoji: '📚', name: 'book shop', size: 40, building: true, words: ['bookshop', 'book', 'shop', 'store', 'library'] },
};
// 'ground' is a pseudo-object: Pip can nap wherever it is.
const GROUND = { emoji: '🟫', name: 'ground', size: 0 };
function typeInfo(t) { return t === 'ground' ? GROUND : TYPES[t]; }

// The hidden truth. Anything not listed does nothing (except cost a little energy).
const EFFECTS = {
  cricket:  { eat: { fullness: 30, fun: 6 } },
  mealworm: { eat: { fullness: 22 } },
  lettuce:  { eat: { fullness: 10, hydration: 10 } },
  berry:    { eat: { fullness: 12, hydration: 5, fun: 3 } },
  flower:   { eat: { fullness: 5, fun: 4 }, play: { fun: 6 } },
  mushroom: { eat: { fullness: 4, health: -25, fun: -10 } },
  ladybug:  { eat: { health: -6, fun: -10 }, play: { fun: 4 } },
  water:    { drink: { hydration: 45 }, play: { fun: 16, warmth: -5, hydration: 4 }, bask: { warmth: -10, fun: 3 } },
  rock:     { eat: { health: -8, fun: -4 }, bask: { warmth: 8 }, rest: { energy: 10 }, play: { fun: 7, energy: -3 } },
  lamp:     { bask: { warmth: 22 }, rest: { energy: 8 } },
  log:      { rest: { energy: 35 }, play: { fun: 9, energy: -3 }, bask: { warmth: 3 } },
  ball:     { play: { fun: 32, energy: -6 } },
  cactus:   { eat: { health: -18, fun: -8 }, play: { health: -12 }, rest: { health: -10 }, bask: { health: -8 }, drink: { health: -6 } },
  ground:   { rest: { energy: 14 } },
  bookstore: { play: { fun: 8 }, rest: { energy: 10 }, eat: { fun: -4 } },
  stick:    { play: { fun: 9 }, eat: { fun: -3 } },
  seedling: { eat: { fullness: 2 } },
  plant:    { eat: { fullness: 4 }, rest: { energy: 8 }, play: { fun: 4 } },
  cricketbox: { play: { fun: 5 } },
  crab:     { eat: { fullness: 30, fun: 4 }, play: { health: -5, fun: 5 } },
  shell:    { play: { fun: 12 }, drink: { hydration: 6 } },
  bone:     { play: { fun: 13 }, eat: { health: -4 } },
  nest:     { rest: { energy: 48, fun: 3 }, play: { fun: 4 } },
  den:      { rest: { energy: 40, warmth: 6 }, play: { fun: 8 } },
};

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const dist = (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by);
const rand = (a, b) => a + Math.random() * (b - a);

class World {
  constructor(data) {
    this.objects = [];
    this.nextId = 1;
    this.time = 60;          // seconds of sim time; day cycle uses this
    this.dayLength = 240;    // one full day = 4 minutes at 1x
    this.autoFeeder = true;
    this.feederTimer = 0;
    this.fx = [];            // visual events for the renderer (splashes etc.), not saved
    if (data) {
      this.objects = data.objects || [];
      this.nextId = data.nextId || (this.objects.reduce((m, o) => Math.max(m, o.id), 0) + 1);
      this.time = data.time || 60;
      this.autoFeeder = data.autoFeeder !== false;
    } else {
      this.populateDefault();
    }
  }

  populateDefault() {
    this.add('lamp', 160, 140);
    this.add('rock', 185, 170);
    this.add('water', 780, 480);
    this.add('log', 820, 140);
    this.add('cricket', 520, 300);
    this.add('lettuce', 420, 470);
    this.add('ball', 600, 180);
    this.add('cactus', 330, 330);
    this.add('mushroom', 680, 380);
    this.add('bookstore', 470, 85);
  }

  toJSON() {
    return { objects: this.objects, nextId: this.nextId, time: this.time, autoFeeder: this.autoFeeder };
  }

  add(type, x, y) {
    if (!TYPES[type]) return null;
    const o = { id: this.nextId++, type, x: clamp(x, 15, WORLD_W - 15), y: clamp(y, 15, WORLD_H - 15), vx: 0, vy: 0, t: Math.random() * 10 };
    this.objects.push(o);
    return o;
  }

  // Keep the tank from overflowing: clear away the oldest bits of clutter.
  makeRoom(max = 60) {
    // only small loose things get tidied away, never furniture like the water dish or lamp
    const clutter = ['stick', 'shell', 'bone', 'flower', 'ladybug', 'mushroom', 'crab', 'mealworm', 'cricket', 'berry', 'lettuce'];
    while (this.objects.length >= max) {
      const old = this.objects.find(o => clutter.includes(o.type)) || this.objects.find(o => TYPES[o.type].custom && TYPES[o.type].byPip && !o.carried);
      if (!old) break;
      this.remove(old.id);
    }
  }

  remove(id) { this.objects = this.objects.filter(o => o.id !== id); }
  get(id) { return this.objects.find(o => o.id === id) || null; }

  objectAt(x, y, pad = 6) {
    let best = null, bd = Infinity;
    for (const o of this.objects) {
      const d = dist(x, y, o.x, o.y);
      if (d < TYPES[o.type].size + pad && d < bd) { best = o; bd = d; }
    }
    return best;
  }

  // 0 = night, 1 = noon
  get daylight() {
    const p = (this.time % this.dayLength) / this.dayLength; // 0..1, 0 = sunrise
    return clamp(Math.sin(p * Math.PI * 2) * 0.5 + 0.5 + 0.15, 0, 1);
  }
  get isNight() { return this.daylight < 0.3; }

  heatAt(x, y) {
    let h = 0;
    for (const o of this.objects) {
      const r = TYPES[o.type].heat;
      if (!r) continue;
      const d = dist(x, y, o.x, o.y);
      if (d < r) h = Math.max(h, 1 - d / r);
    }
    return h;
  }

  ambientAt(x, y) {
    return 25 + this.daylight * 20 + this.heatAt(x, y) * 48;
  }

  update(dt, lizard) {
    this.time += dt;
    for (const o of this.objects) {
      const T = TYPES[o.type];
      o.t += dt;
      if (o.held) continue;
      const nearPip = lizard ? dist(o.x, o.y, lizard.x, lizard.y) : 999;
      if (o.type === 'seedling') {
        // grows on its own, three times faster while watered
        o.age = (o.age || 0) + dt * ((o.water || 0) > 0 ? 3 : 1);
        if (o.water > 0) o.water -= dt;
        if (o.age >= 600) { o.type = 'plant'; o.produce = o.grows || 'berry'; o.timer = 0; this.addFx('sparkle', o.x, o.y); }
        continue;
      }
      if (o.type === 'plant' || o.type === 'cricketbox') {
        // a grown plant keeps making food; a cricket box keeps making crickets
        const makes = o.type === 'plant' ? (TYPES[o.produce] ? o.produce : 'berry') : 'cricket';
        o.timer = (o.timer || 0) + dt;
        if (o.timer >= (o.type === 'plant' ? 200 : 260)) {
          o.timer = 0;
          const near = this.objects.filter(x => x.type === makes && dist(x.x, x.y, o.x, o.y) < 90).length;
          if (near < 2) { const a = rand(0, Math.PI * 2); const n = this.add(makes, o.x + Math.cos(a) * 38, o.y + Math.sin(a) * 38); if (n) this.addFx('sparkle', n.x, n.y); }
        }
        continue;
      }
      if (T.hops) {
        // crickets hop randomly, and away from Pip when it gets close
        const scared = nearPip < 70 && Math.random() < dt * 0.9;
        if (scared || Math.random() < dt * 0.15) {
          let ang = rand(0, Math.PI * 2);
          if (scared) ang = Math.atan2(o.y - lizard.y, o.x - lizard.x) + rand(-0.9, 0.9);
          const s = rand(120, 220);
          o.vx = Math.cos(ang) * s; o.vy = Math.sin(ang) * s;
          o.hop = 0.35;
        }
        if (o.hop > 0) { o.hop -= dt; if (o.hop <= 0) { o.vx = 0; o.vy = 0; } }
      } else if (T.crawls) {
        if (Math.random() < dt * 0.3) { const a = rand(0, Math.PI * 2); o.vx = Math.cos(a) * 14; o.vy = Math.sin(a) * 14; }
      } else if (T.rolls) {
        o.vx *= Math.pow(0.35, dt); o.vy *= Math.pow(0.35, dt);
      }
      o.x += o.vx * dt; o.y += o.vy * dt;
      if (o.x < 15 || o.x > WORLD_W - 15) { o.vx = -o.vx; o.x = clamp(o.x, 15, WORLD_W - 15); }
      if (o.y < 15 || o.y > WORLD_H - 15) { o.vy = -o.vy; o.y = clamp(o.y, 15, WORLD_H - 15); }
    }
    // Auto-feeder: keeps a little food around so Pip doesn't starve while you're away
    if (this.autoFeeder) {
      this.feederTimer += dt;
      if (this.feederTimer > 150) {
        this.feederTimer = 0;
        // the keeper always makes sure there's a water dish
        if (!this.objects.some(o => o.type === 'water')) this.add('water', 780, 480);
        const foods = this.objects.filter(o => ['cricket', 'mealworm', 'lettuce', 'berry'].includes(o.type)).length;
        // food only turns up now and then; growing more is up to Pip
        if (foods < 2) {
          const pick = ['cricket', 'mealworm', 'lettuce', 'lettuce', 'berry', 'berry'][Math.floor(Math.random() * 6)];
          this.add(pick, rand(60, WORLD_W - 60), rand(60, WORLD_H - 60));
        }
      }
    }
  }

  // Pip does `verb` to `obj` (null = the ground). Applies the hidden effects
  // to Pip's needs and returns what Pip felt (the raw change).
  // ----- things Pip can learn to do -----
  // Digging: is there anything under the sand here?
  dig(x, y, luck) {
    this.addFx('sand', x, y);
    const r = Math.random();
    const table = luck ? [['mealworm', 0.3], ['crab', 0.55], ['shell', 0.72], ['bone', 0.85], ['berry', 1]] : [['mealworm', 0.4], ['crab', 0.58], ['shell', 0.76], ['bone', 0.9], ['berry', 1]];
    let type = table.find(([, p]) => r <= p)[0];
    // things Pip imagined might be buried
    const extras = Object.keys(TYPES).filter(k => TYPES[k].buried);
    if (extras.length && Math.random() < 0.3) type = extras[Math.floor(Math.random() * extras.length)];
    this.add(type, x, y);
    return type;
  }
  // Pulling a log apart gives sticks, until there's nothing loose left.
  breakOff(obj) {
    if ((obj.breaks || 0) >= 3) return 0;
    obj.breaks = (obj.breaks || 0) + 1;
    this.addFx('chips', obj.x, obj.y);
    for (let i = 0; i < 2; i++) { const a = Math.random() * Math.PI * 2; this.add('stick', obj.x + Math.cos(a) * 45, obj.y + Math.sin(a) * 45); }
    return 2;
  }
  hasMaterials(recipe) {
    return Object.entries(RECIPES[recipe].needs).every(([t, n]) => this.objects.filter(o => o.type === t).length >= n);
  }
  craft(recipe, x, y) {
    if (!this.hasMaterials(recipe)) return false;
    const R = RECIPES[recipe];
    for (const [t, n] of Object.entries(R.needs)) {
      const near = this.objects.filter(o => o.type === t).sort((a, b) => dist(a.x, a.y, x, y) - dist(b.x, b.y, x, y)).slice(0, n);
      near.forEach(o => this.remove(o.id));
    }
    this.addFx('chips', x, y);
    if (R.makes) this.add(R.makes, x, y);
    return true;
  }

  // What Pip sees happen when it does something (shown in its thoughts and memory)
  addFx(kind, x, y) {
    this.fx.push({ kind, x, y });
    if (this.fx.length > 30) this.fx.shift();
  }

  interact(lizard, obj, verb) {
    const type = obj ? obj.type : 'ground';
    const base = (EFFECTS[type] && EFFECTS[type][verb]) || {};
    const delta = {};
    for (const n of NEEDS) delta[n] = base[n] || 0;
    delta.energy -= 1; // every action takes a little effort
    // made-up things can be unpredictable: a different surprise every time
    const CT = TYPES[type];
    if (CT && CT.wild && CT.wild[verb]) {
      const n = NEEDS[Math.floor(Math.random() * NEEDS.length)];
      delta[n] += Math.random() < 0.75 ? 8 + Math.round(Math.random() * 20) : -(4 + Math.round(Math.random() * 8));
    }
    if (verb === 'bask') delta.warmth += Math.round(this.heatAt(lizard.x, lizard.y) * 18);
    if (verb === 'rest' && this.isNight && delta.energy > 0) delta.energy = Math.round(delta.energy * 1.4);

    for (const n of NEEDS) lizard.needs[n] = clamp(lizard.needs[n] + delta[n], 0, 100);

    let seen = null;
    if (obj) {
      const T = TYPES[type];
      if (type === 'water' && (verb === 'play' || verb === 'bask')) { seen = 'splash'; this.addFx('splash', obj.x, obj.y); }
      else if (type === 'water' && verb === 'drink') { seen = 'ripple'; this.addFx('ripple', obj.x, obj.y); }
      else if (verb === 'eat' && T.food) { seen = 'crunch'; this.addFx('crumbs', obj.x, obj.y); }
      else if (verb === 'play' && T.rolls) seen = 'roll';
      else if (verb === 'play' && T.hops) seen = 'hop';
      else if (type === 'lamp' && verb === 'bask') seen = 'glow';
      if ((delta.health || 0) <= -5) this.addFx('ouch', lizard.x, lizard.y);
      if (verb === 'eat' && TYPES[type].food) this.remove(obj.id);
      if (verb === 'play' && TYPES[type].rolls) {
        const a = Math.atan2(obj.y - lizard.y, obj.x - lizard.x) + rand(-0.5, 0.5);
        obj.vx = Math.cos(a) * 260; obj.vy = Math.sin(a) * 260;
      }
      if (verb === 'play' && TYPES[type].hops) { obj.vx = rand(-150, 150); obj.vy = rand(-150, 150); obj.hop = 0.3; }
    }
    delta.seen = seen;
    if (CT && CT.says && CT.says[verb]) delta.seenText = String(CT.says[verb]);
    if (CT && CT.custom && delta.seenText) this.addFx('sparkle', lizard.x, lizard.y);
    return delta;
  }
}

// Things that can be built, once Pip works out how.
const RECIPES = {
  nest:   { needs: { stick: 3 }, makes: 'nest', label: 'a nest out of sticks' },
  digger: { needs: { stick: 1 }, makes: null, tool: 'digger', label: 'a digging stick' },
  den:    { needs: { stick: 2, lettuce: 1 }, makes: 'den', label: 'a den from sticks and leaves' },
};

// What the books say: the real effect of doing verb to type.
function truthOf(type, verb) {
  const base = (EFFECTS[type] && EFFECTS[type][verb]) || {};
  const d = {};
  for (const n of NEEDS) d[n] = base[n] || 0;
  if (type === 'lamp' && verb === 'bask') d.warmth += 18;
  if (type === 'water' && verb === 'play') d.seen = 'splash';
  return d;
}

// How Pip describes what it saw happen
const SEEN_TEXT = {
  splash: 'The water splashed everywhere! 💦', ripple: 'Ripples spread across the water.', crunch: 'Crunch!',
  roll: 'It rolled away!', hop: 'It jumped!', glow: 'The light is so warm.',
};
const SEEN_ICON = { splash: '💦', ripple: '〰️', crunch: '😋', roll: '💨', hop: '🦘', glow: '✨' };
