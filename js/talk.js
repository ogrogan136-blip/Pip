'use strict';
/*
 * talk.js — Pip asking its human for things, understanding replies,
 * and things the human invents (custom object types).
 */

// ---------- custom things ----------
const PRESETS = {
  eat:   { good: { fullness: 15 }, great: { fullness: 30, fun: 4 } },
  drink: { good: { hydration: 25 }, great: { hydration: 45 } },
  bask:  { good: { warmth: 12 }, great: { warmth: 25 } },
  rest:  { good: { energy: 15 }, great: { energy: 35 } },
  play:  { good: { fun: 15 }, great: { fun: 30, energy: -5 } },
};
const BAD_EFFECT = { health: -12, fun: -5 };

// def: { key, name, emoji, shape, color, size, moves, consumable, does: {verb: 'nothing'|'good'|'great'|'bad'} }
function registerCustomType(def) {
  TYPES[def.key] = {
    emoji: def.emoji || '❔', name: def.name, size: def.size || 14, food: !!def.consumable, crawls: !!def.moves,
    buried: !!def.buried, hidden: !!def.buried, byPip: !!def.byPip, says: def.says || {}, wild: {},
    custom: true, shape: def.shape || 'ball', color: def.color || '#8e6ad8', words: wordsOf(def.name),
  };
  const fx = {};
  for (const v of VERBS) {
    const level = def.does && def.does[v];
    if (level === 'random') TYPES[def.key].wild[v] = true;
    if (level === 'bad') fx[v] = Object.assign({}, BAD_EFFECT);
    else if (level === 'good' || level === 'great') fx[v] = Object.assign({}, PRESETS[v][level]);
  }
  EFFECTS[def.key] = fx;
}
function unregisterCustomType(key) { delete TYPES[key]; delete EFFECTS[key]; }

// ---------- understanding what the human types ----------
function wordsOf(text) {
  return String(text).toLowerCase().split(/[^a-z]+/).filter(Boolean).map(w => {
    if (w.length > 4 && w.endsWith('ies')) return w.slice(0, -3) + 'y';
    if (w.length > 3 && w.endsWith('s') && !w.endsWith('ss')) return w.slice(0, -1);
    return w;
  });
}
const VERB_WORDS = {
  eat: ['eat', 'food', 'yummy', 'tasty', 'snack', 'meal', 'bite', 'chew', 'edible', 'delicious', 'munch'],
  drink: ['drink', 'sip', 'lick', 'thirst', 'thirsty'],
  bask: ['bask', 'warm', 'sun', 'sunbathe', 'hot', 'cosy', 'cozy'],
  rest: ['rest', 'sleep', 'nap', 'bed', 'lie', 'snooze', 'relax', 'sit'],
  play: ['play', 'toy', 'fun', 'game', 'kick', 'push', 'climb', 'splash', 'chase'],
  read: ['read', 'study', 'learn', 'reading', 'research', 'browse'],
};
const BAD_WORDS = ['don', 'dont', 'not', 'never', 'bad', 'danger', 'dangerou', 'poison', 'poisonou', 'hurt', 'ouch', 'careful', 'avoid', 'sharp', 'yuck', 'cant', 'cannot'];
const GIVE_WORDS = ['give', 'here', 'have', 'take', 'present', 'gift', 'brought', 'got'];
const PRAISE_WORDS = ['good', 'clever', 'well', 'love', 'great', 'nice', 'yay', 'bravo', 'smart'];
const SCOLD_WORDS = ['no', 'stop', 'naughty', 'wrong'];
const GREET_WORDS = ['hi', 'hello', 'hey', 'morning', 'night', 'goodnight'];

function understand(text) {
  const ws = wordsOf(text);
  const has = list => ws.some(w => list.includes(w));
  const types = [];
  for (const [k, T] of Object.entries(TYPES)) {
    const names = (T.words || []).concat(wordsOf(T.name));
    // multi-word names ("heat lamp") need their most specific word; single words match directly
    if (names.some(n => ws.includes(n) && n.length > 2 && !STOPWORDS.has(n) && !['heat', 'dish', 'shop', 'store', 'ball'].includes(n)) || ws.join(' ').includes(T.name)) types.push(k);
  }
  let verb = null;
  for (const [v, list] of Object.entries(VERB_WORDS)) if (has(list)) { verb = v; break; }
  return { types, verb, bad: has(BAD_WORDS), give: has(GIVE_WORDS), praise: has(PRAISE_WORDS), scold: has(SCOLD_WORDS), greet: has(GREET_WORDS), words: ws };
}

const ASK_FOR = {
  fullness: ['I\'m hungry and I can\'t find anything to eat. Could I have some food?', 'eat'],
  hydration: ['I\'m really thirsty and I don\'t know where to get a drink. Can you help?', 'drink'],
  warmth: ['I\'m cold. Is there somewhere I can warm up?', 'bask'],
  energy: ['I\'m so tired. Is there a good place to sleep?', 'rest'],
  fun: ['I\'m bored. Could I have something to play with?', 'play'],
};
// Special uses that aren't just eat / drink / bask / rest / play
const SPECIAL_USES = {
  log: { label: '🪵 Pull sticks off it', idea: 'break', also: ['craft'] },
  rock: { label: '🪨 Knock stones off it', idea: 'chip', also: ['craft'] },
  bucket: { label: '🪣 Carry water to your plants in it', idea: 'carry', also: ['tend'] },
  umbrella: { label: '☂️ Hold it over your head in the rain', idea: 'recipe:umbrella', also: ['shelter'] },
  sweater: { label: '🧥 Wear it when you\'re cold', idea: 'recipe:sweater' },
  store: { label: '🏚️ Keep food in it for winter', idea: 'stockpile' },
  stove: { label: '🔥 Warm up and cook food on it', idea: 'cook' },
  grass: { label: '🌱 Plant seeds in it', idea: 'grass', also: ['plant'] },
  bookstore: { label: '📚 Read the books to learn things', act: 'read' },
  hut: { label: '🏠 Hide inside when it rains', idea: 'shelter' },
  mint: { label: '🌿 Eat it when you feel poorly', verb: 'eat' },
  water: { label: '🌱 Fill a bucket here to water plants', idea: 'carry', also: ['tend'] },
  beetle: { label: '😠 Shoo it away, it steals food!', verb: 'play' },
};
const VERB_ANSWERS = { eat: '😋 It\'s food', drink: '👅 You can drink from it', bask: '☀️ Warm up by it', rest: '💤 Sleep on it', play: '🤸 It\'s fun to play with' };
const IDEA_WORDS = { break: 'pull sticks off logs', chip: 'knock stones off rocks', carry: 'carry water in a bucket', shelter: 'hide indoors from the rain', stockpile: 'save food for winter', cook: 'cook food', grass: 'plant seeds in the grass', plant: 'plant seeds', tend: 'water my plants', craft: 'build things' };

// The right answers to "What's that for?" for this particular thing
function answersFor(type) {
  const opts = [], T = TYPES[type];
  if (SPECIAL_USES[type]) opts.push(Object.assign({ act: SPECIAL_USES[type].act || (SPECIAL_USES[type].idea ? 'idea' : 'tell') }, SPECIAL_USES[type]));
  const hurtVerbs = [];
  for (const v of VERBS) {
    const d = truthOf(type, v);
    if ((d.health || 0) < -3) { hurtVerbs.push(v); continue; }
    const good = NEEDS.some(n => n !== 'health' && (d[n] || 0) >= 6) || (d.health || 0) > 3 || (T && T.wild && T.wild[v]);
    if (good && !opts.some(o => o.verb === v)) opts.push({ label: VERB_ANSWERS[v], act: 'tell', verb: v });
  }
  // something you can build with?
  const all = Object.entries(RECIPES).filter(([, R]) => R.needs[type] && !R.custom), built = all.filter(([, R]) => !R.food);
  const uses = built.length ? built : all;
  if (uses.length) { const [r, R] = uses[Math.floor(Math.random() * uses.length)]; opts.push({ label: `🔨 Build with it (like ${R.label})`, act: 'idea', idea: 'recipe:' + r, also: ['craft'] }); }
  if (hurtVerbs.length === 1 && hurtVerbs[0] === 'eat') opts.push({ label: type === 'mushroom' ? '🚫 Don\'t eat it, it\'s poisonous!' : '🚫 Don\'t eat it!', act: 'tell', bad: true, verb: 'eat' });
  else if (hurtVerbs.length) opts.push({ label: '⚠️ Careful, it hurts!', act: 'tell', bad: true });
  if (!opts.length) opts.push({ label: '🤷 It doesn\'t really do anything', act: 'nothing' });
  return opts.slice(0, 4);
}

const TELL_OPTIONS = [
  { label: '😋 It\'s food', verb: 'eat' }, { label: '👅 You drink it', verb: 'drink' }, { label: '☀️ Warm up there', verb: 'bask' },
  { label: '💤 Sleep on it', verb: 'rest' }, { label: '🤸 It\'s a toy', verb: 'play' }, { label: '⚠️ Careful, it hurts!', bad: true },
];

// Mixed into Game (see game.js)
const Talk = {
  pipSay(text, mood = 'happy') {
    if (this._relay && !text.startsWith('🐢')) text = `🐢 ${this._relay} says: ${text}`;
    this.chat.push({ from: 'pip', text });
    if (this.chat.length > 40) this.chat.shift();
    this.lizard.think(text, 'ask');
    if (mood) this.lizard.setMood(mood === 'happy' ? 'happy' : 'curious', 3);
    this.emit('chat');
  },
  youSay(text) {
    this.chat.push({ from: 'you', text });
    if (this.chat.length > 40) this.chat.shift();
    this.emit('chat');
  },

  ask(q) {
    this.question = q;
    q.options = (q.options || []).concat([{ label: q.kind === 'want' ? '🔎 Find it yourself' : '🤷 Work it out yourself', act: 'dismiss' }]);
    this.nextAsk = this.world.time + 300 + Math.random() * 300;
    this.pipSay(q.text, 'curious');
  },

  // Does Pip have something it wants to ask right now?
  // Run something as if Shelly were the one talking (Pip passes the messages on)
  asFriend(fn) {
    const L = this.lizard, b = this.brain;
    this.lizard = this.friend; this.brain = this.friendBrain; this._relay = this.friend.name;
    try { return fn(); } finally { this.lizard = L; this.brain = b; this._relay = null; }
  },

  maybeAsk() {
    if (this.question || this.world.time < this.nextAsk) return;
    this.maybeAskSelf();
    // nothing on Pip's mind? maybe Shelly has something she wants Pip to ask
    if (!this.question && this.friend && !this._relay && Math.random() < 0.5) {
      const before = this.chat.length;
      this.asFriend(() => this.maybeAskSelf());
      if (this.question) {
        this.question.who = 'friend';
        this.question.text = `🐢 ${this.friend.name} wants to know: ${this.question.text}`;
        if (this.chat.length > before) this.chat[this.chat.length - 1].text = this.question.text;
        this.lizard.think(`${this.friend.name} asked me to ask you something. 🐢`, 'ask');
        this.emit('chat');
      }
    }
  },

  maybeAskSelf() {
    const L = this.lizard, b = this.brain;
    if (this.question || this.world.time < this.nextAsk || L.state === 'fainted' || L.state === 'acting') return;
    // 1. a task it can't make sense of
    const task = this.task;
    if (task && !task.askedWord && this.world.time - (task.givenAt || 0) > 40 && task.words.some(w => { const m = b.meaning(w); return !m || !m.type; })) {
      task.askedWord = true;
      return this.ask({ kind: 'word', text: `What does "${task.text}" mean? Can you say it another way?` });
    }
    // 2. a need it has no answer for
    const weights = b.needWeights(L.needs, L.refill);
    const desp = b.desperation(L, weights);
    if (L.needs.fun < 30) {
      const knowsToy = Object.entries(b.effects).some(([k, e]) => k.endsWith(':play') && (e.d.fun || 0) >= 8 && [...L.memory.values()].some(m => k.startsWith(m.type + ':')));
      if (!knowsToy) desp.play = 1;
    }
    for (const verb of Object.keys(desp)) {
      const need = verb === 'play' ? 'fun' : Object.keys(INSTINCT).find(n => INSTINCT[n] === verb);
      // already asked about this recently, or already been told/read what helps and it's here? then don't ask again
      b.askedNeed = b.askedNeed || {};
      if (this.world.time - (b.askedNeed[need] || -1e9) < this.world.dayLength * 3) continue;
      const knowsAnswer = Object.entries(b.effects).some(([k, e]) => k.endsWith(':' + verb) && (e.d[need] || 0) >= 8 && this.world.objects.some(o => k.startsWith(o.type + ':')));
      if (knowsAnswer) continue;
      b.askedNeed[need] = this.world.time;
      const gifts = Object.keys(TYPES).filter(t => !TYPES[t].building && truthOf(t, verb)[need] >= 8).slice(0, 4);
      const fixtures = gifts.filter(t => ['water', 'lamp', 'log', 'hut', 'bed', 'grass'].includes(t) && this.world.objects.some(o => o.type === t));
      const opts = gifts.filter(t => !fixtures.includes(t) && !TYPES[t].patch).map(t => ({ label: `Give ${TYPES[t].emoji} ${TYPES[t].name}`, act: 'give', type: t, verb }));
      fixtures.forEach(t => opts.unshift({ label: `${TYPES[t].emoji} Try the ${TYPES[t].name}`, act: 'tell', verb }));
      const qq = this.ask({ kind: 'want', need, verb, text: ASK_FOR[need][0], options: opts });
      if (fixtures.length) this.question.type = fixtures[0];
      return qq;
    }
    // 3. stuck on something it wants to do: ask for help
    const g = b.garden || {};
    if (g.needBucket && !b.hasIdea('recipe:bucket') && !b.asked?.bucket) {
      (b.asked = b.asked || {}).bucket = 1;
      return this.ask({ kind: 'help', text: 'My seedlings are thirsty but I can\'t carry water in my mouth. How do I get water to them?', options: [{ label: '🪣 Make a bucket from two sticks', act: 'idea', idea: 'recipe:bucket', also: ['carry', 'break'] }] });
    }
    if (L.needs.energy < 50 && !this.world.objects.some(o => o.type === 'hut' || o.type === 'bed') && !b.hasIdea('recipe:hut') && !b.asked?.hut && b.known('log', 'rest')) {
      (b.asked = b.asked || {}).hut = 1;
      return this.ask({ kind: 'help', text: 'Sleeping on logs and sand isn\'t very comfy. Any ideas for a better place to sleep?', options: [{ label: '🪨 Dig a burrow, propped up with a log and sticks', act: 'idea', idea: 'recipe:hut', also: ['break', 'craft'] }, { label: '🪺 Make a nest from sticks', act: 'idea', idea: 'recipe:nest', also: ['break', 'craft'] }] });
    }
    // soaked
    if (L.wet > 60 && !b.hasIdea('shelter') && !b.hasIdea('recipe:umbrella') && !b.asked?.rain) {
      (b.asked = b.asked || {}).rain = 1;
      return this.ask({ kind: 'help', text: 'I\'m soaking wet and grumpy. How do I stay dry when it rains? 😒', options: [{ label: '🏠 Go inside a building when it rains', act: 'idea', idea: 'shelter' }, { label: '🍃 Hold a big leaf over your head', act: 'idea', idea: 'recipe:umbrella', also: ['craft', 'break'] }] });
    }
    // winter troubles
    const W = this.world;
    if (W.season === 'winter' && L.refill && L.refill.fullness && !b.hasIdea('stockpile') && !b.asked?.winter) {
      (b.asked = b.asked || {}).winter = 1;
      return this.ask({ kind: 'help', text: 'It\'s winter and nothing grows. How am I supposed to find food?', options: [{ label: '🏚️ Build a food store and fill it in autumn', act: 'idea', idea: 'recipe:store', also: ['stockpile', 'craft', 'break'] }] });
    }
    if (L.needs.warmth < 35 && !W.objects.some(o => o.type === 'stove') && !b.asked?.cold) {
      (b.asked = b.asked || {}).cold = 1;
      return this.ask({ kind: 'help', text: 'I\'m freezing! The lamp isn\'t enough. How can I stay warm?', options: [{ label: '🔥 Knock stones off the rock and build a stove', act: 'idea', idea: 'recipe:stove', also: ['craft', 'break', 'chip'] }, { label: '🧶 Knit a sweater from wool', act: 'idea', idea: 'recipe:sweater', also: ['craft'] }] });
    }
    // 4. wants to make something new: ask its human for ideas
    if (this.world.time > this.nextIdeaAsk && b.hasIdea('craft') && L.needs.fun < 70 && !(L.refill && (L.refill.fullness || L.refill.hydration)) && Math.random() < 0.35) {
      this.nextIdeaAsk = this.world.time + 900 + Math.random() * 900;
      return this.ask({ kind: 'idea', text: pick(['I want to make something new! What should I make?', 'I\'m out of ideas. Got anything you think I should invent?', 'Help me think of something to make!']), options: [{ label: '🍽️ Something tasty', act: 'suggest', kind: 'food' }, { label: '🧸 Something comfy', act: 'suggest', kind: 'comfy' }, { label: '🪀 A toy', act: 'suggest', kind: 'toy' }, { label: '🤪 Something weird', act: 'suggest', kind: 'weird' }] });
    }
    // 5. something it has seen and knows nothing about
    b.asked = b.asked || {};
    const mem = [...L.memory.values()].find(m => TYPES[m.type] && !TYPES[m.type].byPip && !b.asked[m.type] && VERBS.filter(v => b.known(m.type, v)).length <= 1 && !b.known(m.type, 'read') && b.danger(m.type) > -3);
    if (mem) {
      b.asked[mem.type] = 1;
      const T = TYPES[mem.type];
      return this.ask({ kind: 'whatis', type: mem.type, text: `What's that ${T.emoji} thing for?`, options: answersFor(mem.type) });
    }
    // 4. a favourite it would like more of
    let fav = null, best = 12;
    for (const [k, e] of Object.entries(b.effects)) {
      const [t, v] = k.split(':');
      if (!TYPES[t] || !TYPES[t].food || v !== 'eat' || e.n < 2 || this.world.objects.some(o => o.type === t)) continue;
      const score = (e.d.fullness || 0) + (e.d.fun || 0) + (e.d.health || 0) * 3;
      if (score > best) { best = score; fav = t; }
    }
    if (fav && Math.random() < 0.4) {
      const T = TYPES[fav];
      this.ask({ kind: 'want', need: 'fullness', verb: 'eat', text: `Could I have another ${T.emoji} ${T.name}? They're my favourite.`, options: [{ label: `Give ${T.emoji} ${T.name}`, act: 'give', type: fav, verb: 'eat' }] });
    }
  },

  // Pip takes its human's word for it — until its own experience says otherwise.
  believe(type, verb, bad) {
    const T = TYPES[type], b = this.brain;
    const verbs = bad && !verb ? ['eat', 'play'] : [verb];
    let doubted = false;
    for (const v of verbs) {
      const e = b.known(type, v);
      if (e && e.n > 0) { doubted = true; continue; }
      const need = v === 'play' ? 'fun' : Object.keys(INSTINCT).find(n => INSTINCT[n] === v);
      const d = {};
      for (const n of NEEDS) d[n] = 0;
      if (bad) d.health = -12; else d[need] = { eat: 15, drink: 25, bask: 15, rest: 20, play: 15 }[v];
      b.effects[b.key(type, v)] = { n: 0, d, book: true, told: true };
    }
    if (doubted) {
      const e = b.known(type, verbs[0]);
      const hurt = (e.d.health || 0) < -3, helped = NEEDS.some(n => n !== 'health' && (e.d[n] || 0) >= 4);
      if (bad ? hurt : helped) return `Yes! I found that out too — it ${b.describeEffect(e.d)}.`;
      return `Hmm. When I tried it myself, it ${b.describeEffect(e.d)}. I'll go with what I felt.`;
    }
    if (bad && verb === 'eat') return `Okay! I won't eat the ${T.emoji} ${T.name}. Thanks for the warning!`;
    if (bad) return `Yikes. I'll stay away from the ${T.emoji}. Thanks for the warning!`;
    return `Oh! So I can ${VERB_INFO[verb].phrase} the ${T.emoji} ${T.name}. I'll try that.`;
  },

  give(type, verb) {
    const L = this.lizard, a = Math.random() * Math.PI * 2;
    this.world.add(type, L.x + Math.cos(a) * 70, L.y + Math.sin(a) * 70);
    L.needs.fun = clamp(L.needs.fun + 4, 0, 100);
    const T = TYPES[type];
    const fav = this.favourites();
    if (type === fav.food || type === fav.toy) return `A ${T.emoji} ${T.name}?! That's my FAVOURITE! Thank you thank you thank you! 🤩💚`;
    if (verb && !this.brain.known(type, verb)) { this.believe(type, verb, false); return `Thank you! A ${T.emoji} ${T.name}! Is it to ${VERB_INFO[verb].phrase}? I'll try. 💚`; }
    return `Thank you for the ${T.emoji} ${T.name}! 💚`;
  },

  teachWords(type, verb) {
    const task = this.task;
    for (const w of task.words) {
      const W = this.brain.wordRec(w);
      const rt = W.types[type] || (W.types[type] = { s: 0, f: 0 }); rt.s += 2;
      if (verb) { const rv = W.verbs[verb] || (W.verbs[verb] = { s: 0, f: 0 }); rv.s += 2; }
    }
  },

  // clicking one of the quick-reply buttons
  answerOption(i) {
    const q = this.question;
    if (q && q.who === 'friend' && !this._relay && this.friend) return this.asFriend(() => this.answerOption(i));
    if (!q || !q.options[i]) return;
    const o = q.options[i];
    this.youSay(o.label);
    this.question = null;
    if (o.act === 'give') this.pipSay(this.give(o.type, o.verb));
    else if (o.act === 'tell') this.pipSay(this.believe(q.type, o.verb || null, !!o.bad));
    else if (o.act === 'idea') {
      this.brain.addIdea(o.idea, 'you'); (o.also || []).forEach(i => this.brain.addIdea(i, 'you'));
      const what = o.idea.startsWith('recipe:') && RECIPES[o.idea.slice(7)] ? `I could make ${RECIPES[o.idea.slice(7)].label}` : IDEA_WORDS[o.idea] ? `I can ${IDEA_WORDS[o.idea]}` : 'that';
      this.pipSay(`Ooh, ${what}! Why didn't I think of that? I'll try! 💡`);
    }
    else if (o.act === 'read') { this.brain.learnEffect('bookstore', 'read', { fun: 18 }); this.pipSay('Books! I can learn things from them? I\'m going to go and look! 📚'); }
    else if (o.act === 'nothing') { this.pipSay('Oh. It\'s just for looking at, then. 🙂'); }
    else if (o.act === 'suggest') {
      const key = createInvented(this, suggestedInvention(o.kind), true);
      if (key) { spawnInvention(this, key, 70); this.pipSay(`Good idea! I made a ${TYPES[key].emoji} ${TYPES[key].name}! 🤩`); }
    }
    else this.pipSay('Okay. I\'ll work it out myself.', null);
    if (['idling', 'pausing'].includes(this.lizard.state)) this.lizard.state = 'deciding';
  },

  // typing a message to Pip
  say(text) {
    if (this.question && this.question.who === 'friend' && !this._relay && this.friend) return this.asFriend(() => this.say(text));
    text = String(text).trim().slice(0, 140);
    if (!text) return;
    this.youSay(text);
    const u = understand(text), q = this.question, T0 = u.types[0] && TYPES[u.types[0]];
    const done = reply => { this.pipSay(reply); if (['idling', 'pausing'].includes(this.lizard.state)) this.lizard.state = 'deciding'; };

    if (q && q.kind === 'idea') {
      // your idea becomes a real thing
      this.question = null;
      const key = createInvented(this, inventionFromText(text), true);
      if (key) { spawnInvention(this, key, 70); return done(`Ooh, a ${TYPES[key].emoji} ${TYPES[key].name}! I made it! 🤩`); }
    }
    if (q && q.kind === 'help') this.question = null;
    if (q && q.kind === 'word' && this.task) {
      if (!T0) return this.pipSay('I still don\'t get it. Which thing do you mean?', 'curious');
      this.teachWords(u.types[0], u.verb && u.verb !== 'read' ? u.verb : null);
      this.question = null;
      return done(`Ah! "${this.task.text}" means ${u.verb ? VERB_INFO[u.verb].phrase : 'something with'} the ${T0.emoji} ${T0.name}. Got it!`);
    }
    if (T0 && (u.give || (q && q.kind === 'want' && !u.bad && !u.verb))) {
      const verb = q && q.kind === 'want' ? q.verb : null;
      if (q && q.kind === 'want') this.question = null;
      return done(this.give(u.types[0], verb));
    }
    // "go read", "study", "look at the books": that's reading at the book shop
    const lookAtBooks = u.words.some(w => ['look', 'see', 'flip'].includes(w)) && u.words.some(w => ['book', 'bookshop', 'library'].includes(w));
    if (u.verb === 'read' || lookAtBooks) {
      const shop = this.world.objects.find(o => o.type === 'bookstore');
      if (!shop) return done('There\'s no book shop here to read in. 📚');
      this.giveTask({ text: taskTextFor('read', 'bookstore'), verb: 'read', type: 'bookstore', count: 1, auto: true });
      return done(this.brain.known('bookstore', 'read') ? 'Off to the book shop to read! 📚' : 'Read? At the book shop? I\'ll go and look at the books! 📚');
    }
    const verb = u.verb;
    if (T0 && (verb || u.bad)) {
      if (q && q.kind === 'whatis' && q.type === u.types[0]) this.question = null;
      return done(this.believe(u.types[0], verb, u.bad));
    }
    if (q && q.kind === 'whatis' && (verb || u.bad)) {
      this.question = null;
      return done(this.believe(q.type, verb, u.bad));
    }
    // "show me what you made" → fetch it and hold it up
    if (u.words.some(w => ['show', 'see', 'look', 'hold', 'bring', 'fetch'].includes(w)) && !u.words.some(w => ['book', 'bookshop', 'library'].includes(w))) {
      const key = u.types.find(t => !TYPES[t].building) || this.lastInvented;
      const obj = key && this.world.objects.filter(o => o.type === key).sort((a, b) => dist(a.x, a.y, this.lizard.x, this.lizard.y) - dist(b.x, b.y, this.lizard.x, this.lizard.y))[0];
      if (obj) { this.lizard.fetch(obj); this.chat.push({ from: 'pip', text: this.lizard.thought }); return this.emit('chat'); }
    }
    const hint = u.words.some(w => ['dig', 'burrow', 'bury', 'buried', 'underground'].includes(w)) ? 'dig' : u.words.some(w => ['break', 'snap', 'rip', 'tear', 'apart'].includes(w)) ? 'break' : u.words.some(w => ['craft', 'build', 'make', 'nest', 'den'].includes(w)) ? 'craft' : null;
    if (hint) {
      if (hint === 'craft') { this.brain.addIdea('break', 'you'); for (const r of Object.keys(RECIPES)) if (u.words.includes(r)) this.brain.addIdea('recipe:' + r, 'you'); }
      const fresh = this.brain.addIdea(hint, 'you');
      return done(fresh ? { dig: 'Dig? In the sand? I never thought of that. I\'ll try!', break: 'Break things apart? Huh. Maybe that log…', craft: 'Build something? Me? I\'d like to try.' }[hint] : 'Yes, I\'ve been thinking about that too.');
    }
    if ((u.scold && !u.praise) || u.praise) {
      if (u.praise) this.goodPip(); else this.noPip();
      this.chat.push({ from: 'pip', text: this.lizard.thought });
      return this.emit('chat');
    }
    if (u.greet) return this.pipSay(pick(['Hi! 🦎', 'Hello, human!', 'Oh, hi!']));
    this.pipSay('I don\'t know all those words yet. Try telling me what to do with something, like "you can eat the berry".', 'curious');
  },

  // ---------- inventing new things ----------
  addCustom(def) {
    def.key = 'c' + Date.now().toString(36) + Math.floor(Math.random() * 99);
    def.name = String(def.name || 'thing').trim().slice(0, 30).toLowerCase() || 'thing';
    this.custom.push(def);
    registerCustomType(def);
    this.emit('types');
    return def.key;
  },
  removeCustom(key) {
    this.custom = this.custom.filter(d => d.key !== key);
    this.world.objects = this.world.objects.filter(o => o.type !== key);
    for (const [id, m] of this.lizard.memory) if (m.type === key) this.lizard.memory.delete(id);
    for (const k of Object.keys(this.brain.effects)) if (k.startsWith(key + ':')) delete this.brain.effects[k];
    delete this.brain.seen[key];
    if (this.task && this.task.type === key) this.task = null;
    if (this.lizard.plan && this.lizard.plan.type === key) this.lizard.state = 'deciding';
    if (this.question && (this.question.type === key || (this.question.options || []).some(o => o.type === key))) this.question = null;
    for (const [k, R] of Object.entries(this.brain.customRecipes || {})) if (R.makes === key) { delete this.brain.customRecipes[k]; delete RECIPES[k]; }
    unregisterCustomType(key);
    this.emit('types');
  },
};
