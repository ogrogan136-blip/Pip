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
      if (this.feederTimer > 25) {
        this.feederTimer = 0;
    this.fx = [];            // visual events for the renderer (splashes etc.), not saved
        const foods = this.objects.filter(o => ['cricket', 'mealworm', 'lettuce', 'berry'].includes(o.type)).length;
        if (foods < 3) {
          const pick = ['cricket', 'cricket', 'mealworm', 'lettuce', 'berry'][Math.floor(Math.random() * 5)];
          this.add(pick, rand(60, WORLD_W - 60), rand(60, WORLD_H - 60));
        }
      }
    }
  }

  // Pip does `verb` to `obj` (null = the ground). Applies the hidden effects
  // to Pip's needs and returns what Pip felt (the raw change).
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
    return delta;
  }
}

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
