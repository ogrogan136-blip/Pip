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
    if (data) Object.assign(this, data);
  }

  toJSON() {
    return { effects: this.effects, praise: this.praise, words: this.words, seen: this.seen, stats: this.stats, curiosity: this.curiosity, satedUntil: this.satedUntil };
  }

  key(t, v) { return t + ':' + v; }
  known(t, v) { return this.effects[this.key(t, v)] || null; }

  // ---------- learning from experience ----------
  learnEffect(t, v, delta) {
    const k = this.key(t, v);
    let e = this.effects[k];
    const first = !e;
    if (!e) e = this.effects[k] = { n: 0, d: {} };
    e.n++;
    const alpha = Math.max(1 / e.n, 0.3);
    for (const n of NEEDS) {
      const old = e.d[n] || 0;
      e.d[n] = Math.round((old + alpha * ((delta[n] || 0) - old)) * 10) / 10;
    }
    this.stats.actions++;
    if (first) this.stats.discoveries++;
    return first;
  }

  // How much Pip cares about +1 of each need right now.
  needWeights(needs) {
    const w = {};
    for (const n of ['fullness', 'hydration', 'energy', 'fun']) {
      const lack = (100 - needs[n]) / 100;
      w[n] = 0.15 + 2.6 * lack * lack;
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
    let val = 0;
    for (const n of NEEDS) {
      let d = e.d[n] || 0;
      if (d > 0 && n !== 'warmth') d = Math.min(d, 100 - needs[n]); // can't eat when already full
      if (n === 'warmth' && d > 0 && weights.warmth > 0) d = Math.min(d, Math.max(0, 85 - needs.warmth));
      val += weights[n] * d;
    }
    return val / 30;
  }

  satisfyCuriosity(now) { this.satedUntil = now + 30 + Math.random() * 30; }

  // 0..1: how ready Pip is to experiment again
  curiosityReadiness(now) {
    if (!now || now >= this.satedUntil) return 1;
    return 0.25;
  }

  curiosityBonus(t, v, needs, now, desperation = 0) {
    const e = this.known(t, v);
    const n = e ? e.n : 0;
    const bored = (100 - needs.fun) / 100;
    if (!e && this.danger(t) < -3) return 0; // not curious about things that hurt
    const idle = this.curiosityReadiness(now) * this.curiosity * (0.15 + 0.55 * bored);
    return (idle + desperation) / (1 + n * n * 3);
  }

  // When Pip badly needs something and knows nothing nearby that helps,
  // it gets desperate and tries new things (no matter how sated its curiosity is).
  // Instinct: Pip knows which *action* helps each need (thirsty → drink),
  // but has to learn which *things* to do it with.
  desperation(lizard, weights) {
    const types = new Set([...lizard.memory.values()].map(m => m.type));
    const d = {};
    for (const need of ['fullness', 'hydration', 'warmth', 'energy']) {
      if (weights[need] < 0.7) continue;
      let solved = false;
      for (const [k, e] of Object.entries(this.effects)) {
        const t = k.split(':')[0];
        if ((e.d[need] || 0) >= 8 && (types.has(t) || t === 'ground')) { solved = true; break; }
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
    const weights = this.needWeights(needs);
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

    for (const mem of lizard.memory.values()) for (const v of VERBS) consider(mem, mem.type, v);
    consider(null, 'ground', 'rest'); // nap right here

    // Wandering: explore to find new things. More appealing when nothing known is useful.
    const unseenBias = Object.keys(TYPES).length - Object.keys(this.seen).length > 0 ? 0.1 : 0;
    const ready = this.curiosityReadiness(now);
    // ...and go searching when it needs something it doesn't know where to find
    candidates.push({ kind: 'wander', search: desperate > 0, score: ready * (0.06 + unseenBias + 0.15 * this.curiosity * (100 - needs.fun) / 100) + desperate * 1.2, parts: { curious: 0.2 } });
    // Sitting still: lizards spend a lot of time just watching the world.
    candidates.push({ kind: 'idle', score: task || desperate > 0 ? 0.05 : 0.26, parts: {} });

    // Softmax choice among the good options (a bit of randomness = personality)
    candidates.sort((a, b) => b.score - a.score);
    const top = candidates.filter(c => c.score > candidates[0].score - 0.6).slice(0, 6);
    const temp = 0.18;
    const ws = top.map(c => Math.exp((c.score - top[0].score) / temp));
    let r = Math.random() * ws.reduce((a, b) => a + b, 0), pick = top[0];
    for (let i = 0; i < top.length; i++) { r -= ws[i]; if (r <= 0) { pick = top[i]; break; } }

    pick.reason = this.reasonFor(pick);
    pick.thought = this.thoughtFor(pick, lizard, task, weights);
    return pick;
  }

  reasonFor(c) {
    if (c.kind === 'wander') return 'explore';
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

  thoughtFor(c, lizard, task, weights) {
    const needLine = {
      fullness: 'My tummy is rumbling 🍖.', hydration: 'I\'m so thirsty 💧.', energy: 'I\'m getting sleepy ⚡.',
      warmth: 'Brrr, I\'m cold 🥶.', fun: 'I\'m bored 🥱.', health: 'I don\'t feel so good 🤕.', hot: 'Phew, I\'m too hot 🥵.',
    };
    const tn = this.topNeed(lizard.needs, weights);
    const pre = tn ? needLine[tn] + ' ' : '';
    if (c.kind === 'idle') {
      return pick([
        'Just sitting here, watching the world go by. 🦎', 'Mmm. Nice and quiet. 😌', 'Thinking lizard thoughts… 💭',
        'I\'ll stay still for a bit. 🪷', 'Watching… waiting… 👀', 'Hmm, what should I do next? 🤔',
      ]);
    }
    if (c.kind === 'wander' && c.search) return `${pre}I need to find something that helps. Searching… 🔎`;
    if (c.kind === 'wander') {
      return pick([
        pre + 'Let\'s go exploring. 🧭', pre + 'I wonder what\'s over there… 👀',
        pre + 'Maybe I\'ll find something new. 🔎', 'Just wandering around. 🦎',
      ]);
    }
    const T = typeInfo(c.type), V = VERB_INFO[c.verb];
    const thing = c.type === 'ground' ? 'right here' : `the ${T.emoji} ${T.name}`;
    switch (c.reason) {
      case 'task': {
        const b = this.taskBelief(task.words, c.type, c.verb);
        if (b > 0.5) return `You asked me to "${task.text}". I know this one — ${V.phrase} ${thing}! 💡`;
        return `"${task.text}"… what does that mean? Maybe ${V.phrase} ${thing}? 🤔`;
      }
      case 'praise':
        return `My human liked it when I ${c.verb === 'rest' ? 'rested on' : V.phrase} the ${T.emoji}. Let's do it again! 😊`;
      case 'curious':
        if (!this.known(c.type, c.verb)) return `Hmm… what happens if I ${V.phrase} ${thing}? 🤔`;
        return `Let me try to ${V.phrase} ${thing} again, just to be sure. 🧐`;
      default: {
        const e = this.known(c.type, c.verb);
        const why = e ? this.describeEffect(e.d) : '';
        if (c.type === 'ground') return pre + 'I\'ll take a nap right here. 😴';
        return `${pre}${V.phrase[0].toUpperCase() + V.phrase.slice(1)} ${thing} — last time it ${why}.`;
      }
    }
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
    const T = typeInfo(t);
    let total = 0;
    for (const n of NEEDS) if (n !== 'energy' || delta[n] > 0) total += (delta[n] || 0) * (n === 'health' ? 2 : 1);
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
      (byType[t] || (byType[t] = [])).push({ verb: v, n: e.n, d: e.d });
    }
    return byType;
  }
}

const INSTINCT = { fullness: 'eat', hydration: 'drink', warmth: 'bask', energy: 'rest' };

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
