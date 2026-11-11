'use strict';
/*
 * brain.js — how Pip thinks and learns.
 *
 * Pip starts out knowing nothing about its world. It has *needs* (hunger,
 * thirst, energy, warmth, fun, health) and a sense of curiosity. Every time it
 * does something to an object it remembers how that made it feel. Over time it
 * builds a model of "what happens if I <verb> a <thing>?" and uses that model
 * to decide what to do next, weighing how much it needs each thing right now.
 *
 * Tasks are given in words. Pip doesn't know what words mean either — it
 * learns which words go with which things and actions from which attempts
 * get rewarded, so it can understand new combinations of words it has learned.
 */

const STOPWORDS = new Set(['the', 'a', 'an', 'to', 'with', 'on', 'in', 'at', 'some', 'of', 'please', 'pip', 'go', 'and',
  'times', 'time', 'x', 'your', 'my', 'it', 'that', 'this', 'from', 'for', 'up', 'can', 'you', 'now']);

function tokenize(text) {
  return String(text).toLowerCase().split(/[^a-z]+/).filter(Boolean).map(w => {
    if (w.length > 4 && w.endsWith('ies')) return w.slice(0, -3) + 'y';
    if (w.length > 3 && w.endsWith('s') && !w.endsWith('ss')) return w.slice(0, -1);
    return w;
  }).filter(w => !STOPWORDS.has(w));
}

class Brain {
  constructor(data) {
    this.effects = {};   // "type:verb" -> { n, d: {need: avg change} }
    this.praise = {};    // "type:verb" -> how much my human liked it (-3..3)
    this.words = {};     // word -> { types: {type: {s,f}}, verbs: {verb: {s,f}} }
    this.seen = {};      // type -> first time seen (sim seconds)
    this.stats = { actions: 0, tasksDone: 0, discoveries: 0 };
    this.curiosity = 1;  // personality: how adventurous Pip is
    this.satedUntil = 0; // after experimenting, curiosity takes a while to build up again
    this.ideas = {};     // things Pip has thought of trying: name -> where the idea came from
    this.skills = {};    // things Pip has practised: name -> { n: tries, hits: successes }
    this.tools = {};     // things Pip has made for itself
    this.spent = {};     // logs with nothing left to pull off
    this.seeds = {};     // seeds Pip has kept: type -> how many
    this.farm = null;    // where Pip grows things
    if (data) Object.assign(this, data);
    // Water play used to do almost nothing; let Pip find out it splashes now.
    const wp = this.effects['water:play'];
    if (wp && (wp.d.fun || 0) < 10) delete this.effects['water:play'];
  }

  toJSON() {
    return { effects: this.effects, praise: this.praise, words: this.words, seen: this.seen, stats: this.stats, curiosity: this.curiosity, satedUntil: this.satedUntil, reading: this.reading, nextReadAt: this.nextReadAt, extraBooks: this.extraBooks, ideas: this.ideas, skills: this.skills, tools: this.tools, spent: this.spent, seeds: this.seeds, farm: this.farm, garden: this.garden, asked: this.asked };
  }

  key(t, v) { return t + ':' + v; }
  known(t, v) { return this.effects[this.key(t, v)] || null; }

  // ---------- learning from experience ----------
  learnEffect(t, v, delta) {
    const k = this.key(t, v);
    let e = this.effects[k];
    const first = !e || e.n === 0;
    if (!e) e = this.effects[k] = { n: 0, d: {} };
    e.n++;
    const alpha = Math.max(1 / e.n, 0.3);
    for (const n of NEEDS) {
      const old = e.d[n] || 0;
      e.d[n] = Math.round((old + alpha * ((delta[n] || 0) - old)) * 10) / 10;
    }
    if (delta.seen) e.seen = delta.seen; // remember what it saw happen, too
    this.stats.actions++;
    if (first) this.stats.discoveries++;
    return first;
  }

  // ---------- ideas and skills ----------
  hasIdea(name) { return !!(this.ideas[name] || this.skills[name]); }
  addIdea(name, from) {
    if (this.hasIdea(name)) return false;
    this.ideas[name] = from;
    return true;
  }
  skill(name) { return this.skills[name] || (this.skills[name] = { n: 0, hits: 0 }); }
  // Where the next plant goes: a tidy patch near the water dish.
  farmSpot(lizard, n) {
    const w = lizard.worldRef;
    const grass = w && [...lizard.memory.values()].find(m => m.type === 'grass' && w.get(m.id));
    // Knows seeds go in grass: plant in a neat grid on the patch
    if (this.hasIdea('grass') && grass) {
      const col = n % 3, row = Math.floor(n / 3) % 3;
      return { x: grass.x + (col - 1) * 30, y: grass.y + (row - 1) * 30 };
    }
    // Doesn't know yet. After a failure or two, Pip experiments with other spots.
    const g = this.garden || {};
    if ((g.sandFails || 0) >= 1 && Math.random() < 0.35) {
      const mem = [...lizard.memory.values()];
      const m = mem[Math.floor(Math.random() * mem.length)];
      if (m) return { x: clamp(m.x + (Math.random() - 0.5) * 50, 30, WORLD_W - 30), y: clamp(m.y + (Math.random() - 0.5) * 50, 30, WORLD_H - 30) };
    }
    if (!this.farm) {
      const water = w && w.objects.find(o => o.type === 'water');
      this.farm = water ? { x: clamp(water.x - 150, 80, WORLD_W - 80), y: clamp(water.y - 40, 80, WORLD_H - 80) } : { x: lizard.x, y: lizard.y };
    }
    const col = n % 3, row = Math.floor(n / 3) % 3;
    return { x: clamp(this.farm.x + (col - 1) * 50, 30, WORLD_W - 30), y: clamp(this.farm.y + (row - 1) * 50, 30, WORLD_H - 30) };
  }

  // Something happened in the garden: learn from it.
  gardenEvent(e) {
    const g = this.garden || (this.garden = { sandFails: 0, dryFails: 0 });
    const T = TYPES[e.grows] || { emoji: '🌱' };
    if (e.kind === 'withered' && e.reason === 'sand') {
      g.sandFails++;
      if (this.hasIdea('grass')) return `One of my ${T.emoji} seedlings shrivelled up in the sand. I should only plant on the grass.`;
      if (g.sandFails >= 2) { g.wonderSoil = true; this.spark('garden', 0.3); return `My ${T.emoji} seedling dried up in the sand again… Maybe seeds don't grow in sand? I should find out where they DO grow. 🤔`; }
      return `Oh no, my ${T.emoji} seedling shrivelled up and died. 😢 Why?`;
    }
    if (e.kind === 'withered' && e.reason === 'dry') {
      g.dryFails++;
      if (this.addIdea('tend', 'experience')) return `My ${T.emoji} seedling dried out and died… It looked so thirsty. Maybe plants need water, like me? 💧`;
      return `My ${T.emoji} seedling dried out. I forgot to water it! 😢`;
    }
    if (e.kind === 'grown') {
      if (!this.hasIdea('grass')) { this.addIdea('grass', 'experience'); return `My ${T.emoji} plant grew big — on the GRASS! So that's where seeds go! 🌿🎉`; }
      return `My ${T.emoji} plant is all grown up! Food for days! 🎉`;
    }
    return null;
  }
  // Eating something that grew from a seed: keep the seed, once Pip knows to.
  keepSeedOk(type) { const T = TYPES[type]; return !!T && !!T.food && !T.hops && !T.crawls && !T.wiggles && !['mushroom', 'salad', 'wrap', 'skewer'].includes(type); }
  keepSeed(type) {
    const T = TYPES[type];
    if (!this.hasIdea('plant') || !T || !T.food || T.hops || T.crawls || T.wiggles) return false;
    if (['mushroom', 'salad', 'wrap', 'skewer'].includes(type)) return false;
    this.seeds[type] = Math.min(5, (this.seeds[type] || 0) + 1);
    return true;
  }

  // the next thing a book (or a thoughtful moment) could put in Pip's head
  nextIdea() {
    if (!this.hasIdea('dig')) return 'dig';
    if (!this.hasIdea('break')) return 'break';
    if (!this.hasIdea('craft') && this.seen.stick) return 'craft';
    if (this.hasIdea('craft')) for (const r of ['nest', 'digger', 'den']) if (!this.hasIdea('recipe:' + r)) return 'recipe:' + r;
    return null;
  }

  // Called every few seconds: slow thoughts that turn experience into new ideas.
  ponder(lizard, world, secs) {
    lizard.hungryTime = lizard.needs.fullness < 35 ? (lizard.hungryTime || 0) + secs : 0;
    lizard.boredTime = lizard.needs.fun < 30 ? (lizard.boredTime || 0) + secs : 0;
    if ((lizard.hungryTime > 80 || lizard.boredTime > 150) && this.addIdea('dig', 'thinking')) {
      return lizard.hungryTime > 80 ? 'I\'ve been hungry for ages… is this really all there is? What about under the sand? 🤔' : 'I wonder what\'s underneath all this sand… 🤔';
    }
    if (this.skills.plant && this.skills.plant.hits && Math.random() < 0.08) {
      const foods = Object.keys(this.effects).filter(k => k.endsWith(':eat') && (this.effects[k].d.fullness || 0) >= 8).map(k => k.split(':')[0]).filter(t => TYPES[t] && !(this.seeds[t] > 0) && this.keepSeedOk(t));
      if (foods.length) { const t = foods[Math.floor(Math.random() * foods.length)]; this.seeds[t] = 1; return `What if I planted a ${TYPES[t].emoji} ${TYPES[t].name}? I saved a little bit to try. 🌱`; }
    }
    const logPlay = this.known('log', 'play');
    if (logPlay && logPlay.n >= 3 && this.addIdea('break', 'playing')) return 'The bark on that log is loose. I wonder if I could pull bits off… 🤔';
    const stickPlay = this.known('stick', 'play');
    if (stickPlay && stickPlay.n >= 2 && this.addIdea('craft', 'playing')) return 'These sticks stack up nicely. Maybe I could build something? 🤔';
    if (this.hasIdea('craft') && this.skills.craft && Math.random() < 0.15) {
      for (const r of Object.keys(RECIPES)) {
        if (!this.hasIdea('recipe:' + r) && world.hasMaterials(r)) { this.addIdea('recipe:' + r, 'thinking'); return `What if I made ${RECIPES[r].label}? 🤔`; }
      }
    }
    return null;
  }

  // Things Pip could do with the skills it has (or has only thought of so far).
  skillCandidates(lizard, weights, desperateFor, now) {
    const out = [], needs = lizard.needs;
    const ready = Math.max(0.5, this.curiosityReadiness(now));
    const mem = [...lizard.memory.values()];
    const count = t => mem.filter(m => m.type === t).length;
    const push = (c, score) => out.push(Object.assign({ kind: 'skill', score, parts: { curious: score } }, c));
    if (this.hasIdea('dig')) {
      const s = this.skills.dig || { n: 0, hits: 0 };
      const rate = (s.hits + 1) / (s.n + 2);
      const a = Math.random() * Math.PI * 2, r = 50 + Math.random() * 110;
      const hungry = desperateFor.eat || (weights.fullness > 0.9 && !mem.some(m => this.known(m.type, 'eat') && this.known(m.type, 'eat').d.fullness >= 8) ? 0.6 : 0);
      push({ verb: 'dig', type: 'ground', objId: null, x: clamp(lizard.x + Math.cos(a) * r, 40, WORLD_W - 40), y: clamp(lizard.y + Math.sin(a) * r, 40, WORLD_H - 40) },
        (s.n < 3 ? 0.75 * ready : 0.08) + hungry * 1.4 * rate + (needs.fun < 35 ? 0.3 * rate : 0));
    }
    // first things first: no gardening while Pip's own tummy or water bar needs topping up
    const busyWithNeeds = lizard.refill && (lizard.refill.fullness || lizard.refill.hydration) ? 0.3 : 1;
    // gardening, once Pip has read about it
    const seedTypes = Object.keys(this.seeds || {}).filter(t => this.seeds[t] > 0 && TYPES[t]);
    const growing = mem.filter(m => m.type === 'seedling' || m.type === 'plant').length;
    if (this.hasIdea('plant') && seedTypes.length && growing < 9) {
      const s = this.skills.plant || { n: 0, hits: 0 };
      const t = seedTypes[Math.floor(Math.random() * seedTypes.length)];
      const spot = this.farmSpot(lizard, growing);
      push({ verb: 'plant', type: t, objId: null, x: spot.x, y: spot.y }, (s.hits < 1 ? 0.7 * ready : 0.35) * busyWithNeeds);
    }
    if (this.hasIdea('tend')) {
      const w = lizard.worldRef;
      const dry = mem.filter(m => m.type === 'seedling' && w && w.get(m.id) && !(w.get(m.id).water > 0)).sort((a, b) => (w.get(b.id).thirst || 0) - (w.get(a.id).thirst || 0))[0];
      if (dry) push({ verb: 'tend', type: 'seedling', objId: dry.id, x: dry.x, y: dry.y }, (0.45 + Math.min(0.6, (w.get(dry.id).thirst || 0) / 300)) * busyWithNeeds);
    }
    if (this.hasIdea('break')) {
      const s = this.skills.break || { n: 0, hits: 0 };
      const log = mem.find(m => m.type === 'log' && !this.spent[m.id]);
      const wantSticks = this.hasIdea('craft') && count('stick') < 3;
      if (log) push({ verb: 'break', type: 'log', objId: log.id, x: log.x, y: log.y }, (s.hits < 1 ? 0.75 * ready : 0.04) + (wantSticks ? 0.6 : 0));
    }
    {
      for (const [r, R] of Object.entries(RECIPES)) {
        if (!this.hasIdea('recipe:' + r)) continue;
        if (!Object.entries(R.needs).every(([t, n]) => count(t) >= n)) continue;
        const want = R.tool ? !this.tools[R.tool] && this.hasIdea('dig') : R.farm ? count(R.makes) === 0 : R.food ? count(R.makes) === 0 && needs.fullness < 75 : count(R.makes) === 0;
        if (!want) continue;
        const first = mem.find(m => m.type === Object.keys(R.needs)[0]);
        push({ verb: 'craft', type: R.makes || 'stick', recipe: r, objId: first.id, x: first.x, y: first.y }, 0.85);
      }
    }
    return out;
  }

  // ---------- learning from books ----------
  learnFromBook(t, v, truth) {
    const k = this.key(t, v);
    if (this.effects[k] && this.effects[k].n > 0) return;
    const d = {};
    for (const n of NEEDS) d[n] = truth[n] || 0;
    this.effects[k] = { n: 0, d, book: true };
    if (truth.seen) this.effects[k].seen = truth.seen;
    this.stats.books = (this.stats.books || 0) + 1;
  }

  // What is on Pip's mind that a book could answer?
  question(lizard, task, desperateFor) {
    if (this.garden && this.garden.wonderSoil && !this.hasIdea('grass')) return { kind: 'garden', idea: 'grass', val: 0.9 };
    if (task && task.auto && task.words.some(w => { const m = this.meaning(w); return !m || !m.type; })) return { kind: 'word', val: 1.3 };
    for (const [verb, val] of Object.entries(desperateFor)) {
      // only worth looking up if Pip has no idea at all what helps (otherwise: go and find it)
      const need = Object.keys(INSTINCT).find(n => INSTINCT[n] === verb);
      const knowsOne = Object.entries(this.effects).some(([k, e]) => k.endsWith(':' + verb) && (e.d[need] || 0) >= 8);
      if (!knowsOne) return { kind: 'need', verb, val: 0.4 + val * 0.8 };
    }
    for (const t of Object.keys(this.seen)) {
      if (!TYPES[t] || TYPES[t].building) continue;
      if (VERBS.some(v => !this.known(t, v))) return { kind: 'wonder', val: 0.35 + 0.7 * (100 - lizard.needs.fun) / 100 };
    }
    if (this.nextIdea()) return { kind: 'wonder', val: 0.3 + 0.5 * (100 - lizard.needs.fun) / 100 };
    if (this.unreadBooks().length) { const top = this.topInterest(); return { kind: 'interest', val: 0.1 + 0.3 * (100 - lizard.needs.fun) / 100 + 0.2 * (top ? top[1] : 0) }; }
    return null;
  }

  // Pip reads a book. Returns what it says to itself afterwards.
  readBook(lizard, world, task, desperateFor) {
    const q = this.question(lizard, task, desperateFor);
    const here = new Set(world.objects.map(o => o.type));
    if (q && q.kind === 'word') {
      for (const w of task.words) {
        const W = this.wordRec(w);
        const rt = W.types[task.type] || (W.types[task.type] = { s: 0, f: 0 }); rt.s += 2;
        if (task.verb !== 'any') { const rv = W.verbs[task.verb] || (W.verbs[task.verb] = { s: 0, f: 0 }); rv.s += 2; }
      }
      const T = TYPES[task.type];
      return `Found it in a dictionary! "${task.text}" means ${task.verb === 'any' ? 'go to' : VERB_INFO[task.verb].phrase} the ${T.emoji} ${T.name}. 📖`;
    }
    if (this.reading || true) return this.readLibrary(lizard, world, q);
    if (q && q.kind === 'need') {
      const need = Object.keys(INSTINCT).find(n => INSTINCT[n] === q.verb);
      const options = Object.keys(TYPES).filter(t => !this.known(t, q.verb) && truthOf(t, q.verb)[need] >= 8);
      options.sort((a, b) => (here.has(b) ? 1 : 0) - (here.has(a) ? 1 : 0));
      if (options.length) {
        const t = options[0], T = TYPES[t];
        this.learnFromBook(t, q.verb, truthOf(t, q.verb));
        return `The book says you can ${VERB_INFO[q.verb].phrase} a ${T.emoji} ${T.name}. I should find one! 📖`;
      }
    }
    // sometimes the book is about something Pip never thought of at all
    const idea = this.nextIdea();
    if (idea && Math.random() < 0.4) {
      this.addIdea(idea, 'a book');
      if (idea === 'dig') return 'This book is about animals that dig for food under the sand. I never thought of that! 📖';
      if (idea === 'break') return 'The book shows an animal pulling a log apart to get sticks. Could I do that? 📖';
      if (idea === 'craft') return 'This book is all about building things out of sticks. Building! 📖';
      return `The book shows how to make ${RECIPES[idea.slice(7)].label}. I want to try! 📖`;
    }
    // otherwise: read about something it has seen and wondered about
    const pairs = [];
    for (const t of Object.keys(this.seen)) {
      if (!TYPES[t] || TYPES[t].building) continue;
      for (const v of VERBS) if (!this.known(t, v)) pairs.push([t, v, EFFECTS[t] && EFFECTS[t][v] ? 3 : 1, here.has(t) ? 2 : 1]);
    }
    if (!pairs.length) return 'I think I\'ve read everything about the things I know. Cosy in here, though. 📚';
    let total = pairs.reduce((s, p) => s + p[2] * p[3], 0), r = Math.random() * total, chosen = pairs[0];
    for (const p of pairs) { r -= p[2] * p[3]; if (r <= 0) { chosen = p; break; } }
    const [t, v] = chosen, T = TYPES[t], truth = truthOf(t, v);
    this.learnFromBook(t, v, truth);
    if (truth.health < -3) return `Whoa — the book says it hurts if you ${VERB_INFO[v].phrase} a ${T.emoji} ${T.name}. Glad I read that first! 📖`;
    const good = NEEDS.some(n => n !== 'warmth' && truth[n] >= 4) || Math.abs(truth.warmth) >= 8;
    if (good) return `Interesting! The book says if you ${VERB_INFO[v].phrase} a ${T.emoji} ${T.name}, it ${this.describeEffect(truth)}. I want to try that. 📖`;
    return `Huh. Apparently there's no point trying to ${VERB_INFO[v].phrase} a ${T.emoji} ${T.name}. Good to know. 📖`;
  }

  // How much Pip cares about +1 of each need right now.
  needWeights(needs, refill) {
    const w = {};
    for (const n of ['fullness', 'hydration', 'energy', 'fun']) {
      const lack = (100 - needs[n]) / 100;
      w[n] = 0.15 + 2.6 * lack * lack;
      // once a bar has got low, Pip keeps at it until it's back up to 80
      if (refill && refill[n]) w[n] += 0.9;
    }
    // warmth: lizards are cold-blooded. Comfortable around 60-85.
    if (needs.warmth < 70) { const c = (70 - needs.warmth) / 70; w.warmth = 0.1 + 2.6 * c * c; }
    else if (needs.warmth > 88) w.warmth = -1.2 * (needs.warmth - 88) / 12;
    else w.warmth = 0.05;
    // health: Pip always really dislikes getting hurt
    w.health = 2.2 + 2 * (100 - needs.health) / 100;
    return w;
  }

  // Expected value of doing verb to type, from what Pip has learned.
  // Worst hurt Pip has had from a thing, whatever it was doing to it.
  danger(t) {
    let worst = 0;
    for (const v of VERBS) { const e = this.known(t, v); if (e) worst = Math.min(worst, e.d.health || 0); }
    return worst;
  }

  expectedValue(t, v, needs, weights) {
    const e = this.known(t, v);
    // Never tried this? If the thing has hurt me before, assume it might again.
    if (!e) return weights.health * 0.7 * this.danger(t) / 30;
    // One try isn't proof: Pip trusts what it knows more after a couple of goes.
    const conf = e.n === 0 ? 0.6 : Math.min(1, 0.5 + 0.25 * e.n);
    let val = 0;
    for (const n of NEEDS) {
      let d = e.d[n] || 0;
      if (n !== 'health' || d > 0) d *= conf;
      if (d > 0 && n !== 'warmth') d = Math.min(d, 100 - needs[n]); // can't eat when already full
      if (n === 'warmth' && d > 0 && weights.warmth > 0) d = Math.min(d, Math.max(0, 85 - needs.warmth));
      val += weights[n] * d;
    }
    return val / 30;
  }

  satisfyCuriosity(now) { this.satedUntil = now + 90 + Math.random() * 90; }

  // 0..1: how ready Pip is to experiment again
  curiosityReadiness(now) {
    if (!now || now >= this.satedUntil) return 1;
    return 0.25;
  }

  curiosityBonus(t, v, needs, now, desperation = 0) {
    const e = this.known(t, v);
    const n = e ? Math.max(e.n, 1) : 0; // something it only read about counts as tried once
    const bored = (100 - needs.fun) / 100;
    if (this.danger(t) < -3 && !(e && e.n)) return 0; // not curious about things that hurt
    const idle = this.curiosityReadiness(now) * this.curiosity * (0.15 + 0.55 * bored);
    return (idle + desperation) / (1 + n * n * 3);
  }

  // When Pip badly needs something and knows nothing nearby that helps,
  // it gets desperate and tries new things (no matter how sated its curiosity is).
  // Instinct: Pip knows which *action* helps each need (thirsty → drink),
  // but has to learn which *things* to do it with.
  desperation(lizard, weights) {
    // only things that are really still around count (not a cricket that got eaten ages ago)
    const w = lizard.worldRef;
    const types = new Set([...lizard.memory.values()].filter(m => !w || w.get(m.id)).map(m => m.type));
    const d = {};
    for (const need of ['fullness', 'hydration', 'warmth', 'energy']) {
      if (weights[need] < 0.7) continue;
      let solved = false;
      for (const [k, e] of Object.entries(this.effects)) {
        const t = k.split(':')[0];
        if (e.n > 0 && (e.d[need] || 0) >= 8 && (types.has(t) || t === 'ground')) { solved = true; break; }
      }
      if (!solved) d[INSTINCT[need]] = Math.min(1.1, 0.5 * (weights[need] - 0.5));
    }
    return d;
  }

  // ---------- learning words ----------
  wordRec(w) { return this.words[w] || (this.words[w] = { types: {}, verbs: {} }); }

  learnTask(words, t, v, success) {
    for (const w of words) {
      const W = this.wordRec(w);
      const rt = W.types[t] || (W.types[t] = { s: 0, f: 0 });
      const rv = W.verbs[v] || (W.verbs[v] = { s: 0, f: 0 });
      if (success) { rt.s++; rv.s++; } else { rt.f += 0.5; rv.f += 0.5; }
    }
  }

  // Pip's guess at P(doing v to t satisfies a task described by these words)
  taskBelief(words, t, v) {
    let pt = null, pv = null;
    for (const w of words) {
      const W = this.words[w];
      if (!W) continue;
      const rt = W.types[t], rv = W.verbs[v];
      if (rt) { const r = (rt.s + 0.15) / (rt.s + rt.f + 1); pt = pt === null ? r : Math.max(pt, r); }
      if (rv) { const r = (rv.s + 0.15) / (rv.s + rv.f + 1); pv = pv === null ? r : Math.max(pv, r); }
    }
    // Unheard-of combos get a hopeful prior so Pip will try them.
    if (pt === null) pt = 0.3;
    if (pv === null) pv = 0.3;
    return pt * pv;
  }

  // What does Pip think a word means? (for the brain panel)
  meaning(w) {
    const W = this.words[w];
    if (!W) return null;
    const best = (recs) => {
      let bk = null, br = 0, bs = 0;
      for (const [k, r] of Object.entries(recs)) {
        const rate = (r.s + 0.15) / (r.s + r.f + 1);
        if (r.s >= 1 && rate > br) { bk = k; br = rate; bs = r.s; }
      }
      return bk ? { key: bk, rate: br, s: bs } : null;
    };
    return { type: best(W.types), verb: best(W.verbs) };
  }

  addPraise(t, v, amount) {
    const k = this.key(t, v);
    this.praise[k] = clamp((this.praise[k] || 0) + amount, -3, 3);
  }

  // ---------- deciding what to do ----------
  // Returns a plan: { kind:'act'|'wander', objId, type, verb, x, y, reason, thought, score }
  decide(lizard, world, task, now) {
    const needs = lizard.needs;
    const weights = this.needWeights(needs, lizard.refill);
    const candidates = [];
    const taskWords = task ? task.words : null;
    const desperateFor = this.desperation(lizard, weights);
    let desperate = 0;
    for (const [v, val] of Object.entries(desperateFor)) {
      // Something nearby I haven't tried this with yet? Try that before searching further away.
      const untried = [...lizard.memory.values()].some(m => !this.known(m.type, v) && this.danger(m.type) >= -3);
      desperate = Math.max(desperate, untried ? val * 0.2 : val);
    }

    const consider = (mem, t, v) => {
      const d = mem ? dist(lizard.x, lizard.y, mem.x, mem.y) : 0;
      const parts = {
        need: this.expectedValue(t, v, needs, weights),
        curious: this.curiosityBonus(t, v, needs, now, desperateFor[v] || 0),
        praise: 0.3 * (this.praise[this.key(t, v)] || 0),
        task: 0,
        travel: -(d / 700) * (0.4 + (100 - needs.energy) / 120),
      };
      // instinct: when Pip badly needs something, things that *look* right are tried first
      if (desperateFor[v] && LOOKS_LIKE[v] && LOOKS_LIKE[v].includes(t) && !this.known(t, v)) parts.curious += 0.6 * desperateFor[v] + 0.2;
      // tried it a couple of times and nothing happened? Clearly that doesn't work.
      const e = this.known(t, v);
      if (e && e.n >= 2 && NEEDS.every(n => n === 'energy' || Math.abs(e.d[n] || 0) < 3)) { parts.curious = 0; parts.need -= 0.4; }
      if (taskWords) {
        const belief = this.taskBelief(taskWords, t, v);
        const failedHere = task.tried[this.key(t, v)] || 0;
        // "Is this what my human means?" — an urge to try things for the task
        parts.task = 2.4 * belief / (1 + failedHere * 1.5) + (this.danger(t) < -3 ? 0 : 0.45 / (1 + failedHere * 3));
        // a task makes Pip a little more willing to experiment
        parts.curious *= 0.6;
      }
      let score = 0;
      for (const p of Object.values(parts)) score += p;
      candidates.push({ kind: 'act', objId: mem ? mem.id : null, type: t, verb: v, x: mem ? mem.x : lizard.x, y: mem ? mem.y : lizard.y, parts, score });
    };

    for (const mem of lizard.memory.values()) {
      if (TYPES[mem.type] && TYPES[mem.type].building) {
        // The book shop: somewhere to go when Pip has a question on its mind.
        const q = this.question(lizard, task, desperateFor);
        consider(mem, mem.type, 'read');
        const c = candidates[candidates.length - 1];
        c.q = q;
        const eRead = this.known(mem.type, 'read');
        if (!eRead && !(task && task.verb === 'read' && task.type === mem.type)) candidates.pop(); // Pip doesn't know reading is a thing yet
        else {
          // the more often books have helped, the more Pip trusts them
          const trust = Math.min(1, 0.5 + 0.2 * eRead.n);
          if (q) q.val *= trust;
          // after a reading session Pip wants a break, unless it urgently needs to look something up
          const rested = !this.nextReadAt || now >= this.nextReadAt;
          const ready = q && (q.kind === 'wonder' || q.kind === 'interest') ? (rested ? this.curiosityReadiness(now) * this.curiosity : 0) : 1;
          c.score += -c.parts.curious + (q ? q.val * ready : 0.02);
          c.parts.curious = q ? q.val * ready : 0.02;
        }
        // ...and like anything else, it can be sniffed, sat in, chewed on:
        for (const v of VERBS) { consider(mem, mem.type, v); const k = candidates[candidates.length - 1]; if (!this.known(mem.type, v)) { k.score += k.parts.curious * 0.5; k.parts.curious *= 1.5; } }
        continue;
      }
      for (const v of VERBS) consider(mem, mem.type, v);
    }
    consider(null, 'ground', 'rest'); // nap right here
    for (const c of this.skillCandidates(lizard, weights, desperateFor, now)) candidates.push(c);

    // Wandering: explore to find new things. More appealing when nothing known is useful.
    const unseenBias = Object.keys(TYPES).length - Object.keys(this.seen).length > 0 ? 0.1 : 0;
    const ready = this.curiosityReadiness(now);
    // ...and go searching when it needs something it doesn't know where to find
    candidates.push({ kind: 'wander', search: desperate > 0, score: ready * (0.06 + unseenBias + 0.15 * this.curiosity * (100 - needs.fun) / 100) + desperate * 1.2, parts: { curious: 0.2 } });
    // Sitting still: lizards spend a lot of time just watching the world.
    const topping = lizard.refill && Object.keys(lizard.refill).length > 0;
    candidates.push({ kind: 'idle', score: task || desperate > 0 ? 0.05 : topping ? 0.15 : 0.5, parts: {} });

    // Softmax choice among the good options (a bit of randomness = personality)
    candidates.sort((a, b) => b.score - a.score);
    const top = candidates.filter(c => c.score > candidates[0].score - 0.6).slice(0, 6);
    const temp = 0.18;
    const ws = top.map(c => Math.exp((c.score - top[0].score) / temp));
    let r = Math.random() * ws.reduce((a, b) => a + b, 0), pick = top[0];
    for (let i = 0; i < top.length; i++) { r -= ws[i]; if (r <= 0) { pick = top[i]; break; } }

    pick.desperateFor = desperateFor;
    pick.reason = this.reasonFor(pick);
    pick.thought = this.thoughtFor(pick, lizard, task, weights);
    return pick;
  }

  reasonFor(c) {
    if (c.kind === 'wander') return 'explore';
    if (c.kind === 'skill') return 'skill';
    if (c.kind === 'idle') return 'idle';
    let best = 'need', bv = -Infinity;
    for (const k of ['need', 'curious', 'praise', 'task']) if (c.parts[k] > bv) { bv = c.parts[k]; best = k; }
    return best;
  }

  topNeed(needs, weights) {
    let best = null, bw = 0.6;
    for (const n of NEEDS) {
      if (n === 'health') { if (needs.health < 60 && weights.health > bw) { best = n; bw = weights.health; } continue; }
      if (weights[n] > bw) { best = n; bw = weights[n]; }
    }
    if (needs.warmth > 90) return 'hot';
    return best;
  }

  // Pip's thoughts are short and plain, like a person muttering to themselves.
  thoughtFor(c, lizard, task, weights) {
    if (c.kind === 'idle') {
      if (Math.random() < 0.35) { const m = this.musing(); if (m) return m; }
      return pick(['…', 'Nice and quiet.', 'Just watching.', 'This is a good spot.', 'Hmm.', 'I like it here.', 'What a day.']);
    }
    if (c.kind === 'skill') {
      const s = this.skills[c.verb === 'craft' ? 'recipe:' + c.recipe : c.verb];
      if (c.verb === 'dig') return !s || !s.n ? 'Let me try scratching at the sand here…' : pick(['Maybe there\'s something buried here.', 'Time to dig.', 'I\'ll try digging over there.']);
      if (c.verb === 'plant') return !s || !s.hits ? `Let me try planting this ${TYPES[c.type].emoji} seed…` : pick([`I'll plant a ${TYPES[c.type].emoji} seed in my garden.`, 'Time to grow some more food.']);
      if (c.verb === 'tend') return pick(['My seedling looks thirsty. I\'ll water it. 💧', 'Let me look after my little plant.']);
      if (c.verb === 'break') return !s || !s.hits ? 'Let me see if I can pull a bit off this log…' : 'I need more sticks. Back to the log.';
      return !s || !s.hits ? `Let me try to make ${RECIPES[c.recipe].label}…` : `I'll make ${RECIPES[c.recipe].label}.`;
    }
    if (c.kind === 'wander') {
      if (c.search) return pick(['I need to find something… let me look around.', 'There must be something around here.']);
      return pick(['Let\'s have a look around.', 'I wonder what\'s over there.', 'Time for a little walk.']);
    }
    const T = typeInfo(c.type), V = VERB_INFO[c.verb];
    const name = `${T.emoji} ${T.name}`;
    if (c.verb === 'read') {
      if (c.reason === 'task' && !(c.q && c.q.kind === 'word')) return `"${task.text}" — off to the ${name}.`;
      if (c.q && c.q.kind === 'word') return `"${task.text}"? I don't know what that means. Maybe there's a book about it. 📖`;
      if (c.q && c.q.kind === 'need') return pick(['I don\'t know what would help. I\'ll go look it up.', 'There must be a book about this.']);
      return pick(['I\'ve been wondering about something. Time for a book. 📖', 'I feel like reading.', 'Let\'s see what I can find out at the book shop.']);
    }
    switch (c.reason) {
      case 'task':
        if (this.taskBelief(task.words, c.type, c.verb) > 0.5) return `"${task.text}" — I know that one!`;
        return `"${task.text}"? Hmm… maybe it means ${V.phrase} the ${name}?`;
      case 'praise':
        return `My human likes it when I ${V.phrase} the ${name}.`;
      case 'curious':
        if (c.type === 'ground') return 'Maybe I\'ll just lie down for a bit.';
        if (!this.known(c.type, c.verb)) return pick([`I wonder what happens if I ${V.phrase} the ${name}…`, `Never tried to ${V.phrase} the ${name}. Why not?`]);
        if (this.known(c.type, c.verb).n === 0) return `The book said something about the ${name}. Let me see for myself.`;
        return `Maybe I'll ${V.phrase} the ${name} again and see.`;
      default:
        if (c.type === 'ground') return pick(['I\'m tired. Nap time. 😴', 'Just a little nap…']);
        return pick({
          eat: [`I'm hungry. That ${name} looks good.`, `Snack time.`, `Mmm, ${name}. Yes please.`],
          drink: ['I need a drink.', 'Thirsty. Off to the water.'],
          bask: [`Brr. I want to warm up by the ${name}.`, 'Time to soak up some heat.'],
          rest: [`I'm tired. The ${name} is a good spot for a nap.`, 'I could use a rest.'],
          play: [`I'm bored. Let's play with the ${name}!`, `The ${name} is always fun.`],
        }[c.verb]);
    }
  }

  // A quiet thought about something Pip has learned.
  musing() {
    const pending = Object.keys(this.ideas).filter(i => !this.skills[i]);
    if (pending.length && Math.random() < 0.5) {
      const i = pending[0];
      const lines = { dig: 'I keep thinking about what\'s under the sand…', break: 'That log… I bet bits would come off.', craft: 'I could build something. But what?', plant: 'I want to grow my own food. I need some seeds…', tend: 'Plants need water too, I think.' };
      if (lines[i]) return lines[i];
      if (i.startsWith('recipe:') && RECIPES[i.slice(7)]) return `I still want to try making ${RECIPES[i.slice(7)].label}.`;
    }
    const foods = [], hurts = [];
    for (const [k, e] of Object.entries(this.effects)) {
      const [t, v] = k.split(':');
      if (!TYPES[t] || !e.n) continue;
      if (v === 'eat' && (e.d.fullness || 0) >= 8) foods.push(TYPES[t]);
      if ((e.d.health || 0) < -3) hurts.push(TYPES[t]);
    }
    const opts = [];
    if (foods.length >= 2) opts.push(`${foods[0].emoji} and ${foods[1].emoji} both fill my tummy. Funny, they look so different.`);
    if (foods.length === 1) opts.push(`I only know one thing to eat: ${foods[0].emoji}. There must be more.`);
    if (hurts.length) opts.push(`I still remember that ${pick(hurts).emoji}. Never again.`);
    if (this.skills.dig && this.skills.dig.hits) opts.push('Who knew there was so much under the sand?');
    if (this.tools.digger) opts.push('I made my own digging stick. Me!');
    return opts.length ? pick(opts) : null;
  }

  describeEffect(d) {
    const bits = [];
    const words = {
      fullness: ['filled my tummy', 'made me hungrier'], hydration: ['quenched my thirst', 'made me thirsty'],
      energy: ['gave me energy', 'tired me out'], warmth: ['warmed me up', 'cooled me down'],
      fun: ['was fun', 'was no fun'], health: ['made me feel better', 'HURT'],
    };
    const sorted = NEEDS.map(n => [n, d[n] || 0]).filter(([, v]) => Math.abs(v) >= 3).sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]));
    for (const [n, v] of sorted.slice(0, 2)) bits.push(words[n][v > 0 ? 0 : 1]);
    return bits.length ? bits.join(' and ') : 'did nothing much';
  }

  // Pip's reaction to what just happened.
  reactionFor(t, v, delta, firstTime) {
    const r = this.reactionCore(t, v, delta, firstTime);
    if (delta.seenText) r.text = delta.seenText + ' ' + r.text;
    else if (delta.seen && SEEN_TEXT[delta.seen] && r.mood !== 'hurt') r.text = SEEN_TEXT[delta.seen] + ' ' + r.text;
    return r;
  }

  reactionCore(t, v, delta, firstTime) {
    const T = typeInfo(t);
    if (v === 'eat' && T && T.cooked && (delta.fullness || 0) > 20) return { mood: 'happy', text: pick([`Mmm! The ${T.emoji} ${T.name} is SO much better than plain food! 🤤`, `That ${T.emoji} filled me right up. Cooking is worth it! 😋`, `Best. Meal. Ever. ${T.emoji}`]) };
    let total = 0;
    // warmth changes are neither good nor bad by themselves, so they don't count here
    for (const n of NEEDS) if (n !== 'warmth' && (n !== 'energy' || delta[n] > 0)) total += (delta[n] || 0) * (n === 'health' ? 2 : 1);
    if (Math.abs(delta.warmth || 0) >= 8) total += 4;
    if (delta.health <= -5) return { mood: 'hurt', text: pick([`OUCH! ${T.emoji} hurts! Note to self: don't ${VERB_INFO[v].phrase} that. 😣`, `Owww! Never doing that again! 😖`, `Bleh! ${T.emoji} is bad news. 🤢`]) };
    if (total >= 20) return { mood: 'happy', text: firstTime ? `WOW! I just discovered I can ${VERB_INFO[v].phrase} ${T.emoji}! It ${this.describeEffect(delta)}! 🤩` : pick([`Ahh, that ${this.describeEffect(delta)}. 😌`, `Yes! ${T.emoji} is the best! 💚`, `Mmm, much better. 😊`]) };
    if (total >= 4) return { mood: 'ok', text: firstTime ? `Ooh, ${VERB_INFO[v].ing} ${T.emoji} ${this.describeEffect(delta)}. Good to know! 📝` : `That ${this.describeEffect(delta)}. 🙂` };
    if (total <= -4) return { mood: 'meh', text: `Hmm, ${VERB_INFO[v].ing} ${T.emoji} ${this.describeEffect(delta)}. 😕` };
    return { mood: 'meh', text: firstTime ? `Nothing happened when I tried to ${VERB_INFO[v].phrase} ${T.emoji}. Weird. 🤷` : `Nope, still nothing. 😐` };
  }

  // Types where some action has hurt Pip — it steers around these.
  painfulTypes() {
    const out = new Set();
    for (const [k, e] of Object.entries(this.effects)) if ((e.d.health || 0) < -3) out.add(k.split(':')[0]);
    return out;
  }

  // Summary of everything Pip has learned, for the Brain panel.
  knowledge() {
    const byType = {};
    for (const [k, e] of Object.entries(this.effects)) {
      const [t, v] = k.split(':');
      (byType[t] || (byType[t] = [])).push({ verb: v, n: e.n, d: e.d, seen: e.seen, book: !!e.book && e.n === 0, told: !!e.told && e.n === 0 });
    }
    return byType;
  }
}

const INSTINCT = { fullness: 'eat', hydration: 'drink', warmth: 'bask', energy: 'rest' };
// what looks drinkable / edible / warm / comfy to a lizard, before it knows for sure
const LOOKS_LIKE = { drink: ['water'], eat: ['cricket', 'mealworm', 'lettuce', 'berry', 'crab', 'salad', 'wrap', 'skewer'], bask: ['lamp', 'rock'], rest: ['log', 'nest', 'den'] };

function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

/* ---------------- Tasks ---------------- */
class Task {
  constructor({ text, verb = null, type = null, count = 1, auto = true, tried = {}, progress = 0, id }) {
    this.text = text;
    this.verb = verb;     // 'any' or a verb (for auto-checked tasks)
    this.type = type;
    this.count = count;
    this.auto = auto;     // false = custom task, you judge it with Good / No
    this.words = tokenize(text);
    this.tried = tried;   // failed attempts by "type:verb", so Pip tries other things
    this.progress = progress;
    this.id = id || Date.now();
  }
  matches(t, v) { return this.auto && t === this.type && (this.verb === 'any' || this.verb === v); }
  toJSON() { return { text: this.text, verb: this.verb, type: this.type, count: this.count, auto: this.auto, tried: this.tried, progress: this.progress, id: this.id }; }
}

function taskTextFor(verb, type) {
  const T = TYPES[type];
  const noun = (T.words ? T.words[0] : T.name.split(' ').pop());
  if (verb === 'any') return `visit the ${noun}`;
  return `${VERB_INFO[verb].phrase} the ${noun}`;
}

