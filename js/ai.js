'use strict';
/*
 * ai.js — optional "smart Pip": when the page runs on claude.ai, Pip can use
 * the viewer's own Claude (the artifact `sample` capability) to understand
 * chat messages and to think up new things. Only on a viewer action, never
 * on a timer, so it doesn't spend usage in the background.
 * Without it, the simple word-matching in talk.js is used.
 */

const AI = {
  sample: null,
  off: false,      // the viewer declined, or it isn't available
  busy: false,

  async init() {
    try {
      if (!window.claude || !window.claude.use) return false;
      this.sample = await window.claude.use('sample');
    } catch (e) { this.sample = null; }
    return !!this.sample;
  },
  get ready() { return !!this.sample && !this.off; },

  handleError(e) {
    const code = e && e.code;
    if (['not_granted', 'sampling_disabled', 'not_declared', 'capability_disabled', 'capability_removed'].includes(code)) { this.off = true; return 'off'; }
    if (code === 'rate_limited') return 'busy';
    return 'error';
  },

  // A compact picture of Pip's mind for the prompt.
  describe(game) {
    const L = game.lizard, b = game.brain;
    const needs = NEEDS.map(n => `${n} ${Math.round(L.needs[n])}/100`).join(', ');
    const here = [...new Set(game.world.objects.map(o => o.type))].map(t => `${t} (${TYPES[t].name})`).join(', ');
    const learned = Object.entries(b.effects).slice(0, 40).map(([k, e]) => {
      const fx = NEEDS.filter(n => Math.abs(e.d[n] || 0) >= 3).map(n => `${n}${e.d[n] > 0 ? '+' : ''}${Math.round(e.d[n])}`).join(' ');
      return `${k.replace(':', ' ')}: ${fx || 'nothing'}${e.n ? '' : ' (only heard about it)'}`;
    }).join('; ');
    const skills = Object.entries(b.skills).map(([k, s]) => `${k} (worked ${s.hits}/${s.n})`).join(', ') || 'none';
    const ideas = Object.keys(b.ideas).filter(i => !b.skills[i]).join(', ') || 'none';
    const chat = game.chat.slice(-6).map(m => `${m.from === 'pip' ? 'Pip' : 'Human'}: ${m.text}`).join('\n');
    return `Pip's needs: ${needs}.
Things in the terrarium (type key and name): ${here || 'nothing'}.
What Pip has learned (thing verb: effect): ${learned || 'nothing yet'}.
Skills: ${skills}. Untried ideas: ${ideas}.
Reading: ${readingLevelName(b.readState().literacy)}. Favourite topics: ${Object.entries(b.readState().interests).sort((x, y) => y[1] - x[1]).slice(0, 3).map(([k]) => (b.allBooks()[k] || {}).title).filter(Boolean).join(', ')}. Recently read: ${Object.entries(b.readState().read).flatMap(([k, ix]) => ix.slice(-2).map(i => (b.allBooks()[k] || { pages: [] }).pages[i])).filter(Boolean).slice(-4).map(p => p[0]).join(' ')}
Season: ${game.world.season}, weather: ${game.world.weather}.
Current task: ${game.task ? '"' + game.task.text + '"' : 'none'}.
Recent chat:
${chat || '(none)'}`;
  },

  rules() {
    return `You are the inner voice of Pip, a small pet lizard in a 3D terrarium game. Pip is curious, gentle and a bit simple: it talks in short, plain sentences (1-2 sentences, under 30 words), with at most one emoji. It has a cheeky streak. Pip only knows what is listed below; it is not an AI and never says so.
Verbs Pip can do to things: eat, drink, bask, rest, play. Skills Pip may develop: dig, break (pull sticks off logs), craft. Recipes: nest, digger, den.
Valid thing types: ${Object.keys(TYPES).filter(t => !TYPES[t].hidden || TYPES[t].custom).map(t => t + (TYPES[t].custom ? ' (' + TYPES[t].name + ')' : '')).join(', ')}.
This is a playful game with no need to be cute: silly, strange, gross, spooky, rude or darkly funny things are all welcome (a cursed sandwich, a haunted sock, a burp in a jar, a tiny angry volcano). Play along with jokes and odd requests, and let Pip be cheeky or sarcastic when it fits. The only things to leave out are sexual content and graphic gore.`;
  },

  // ---- chat ----
  async reply(game, text) {
    const prompt = `${this.rules()}

${this.describe(game)}

The human just said to Pip: "${text}"

Work out what the human means and how Pip answers. Reply with only a JSON object:
{"say": "what Pip says back",
 "actions": [ zero or more of:
   {"do": "learn", "thing": "<type key>", "verb": "eat|drink|bask|rest|play", "effect": "good|bad|nothing"}   // the human told Pip what something does
   {"do": "give", "thing": "<type key>"}        // the human is giving Pip a thing (it appears next to Pip)
   {"do": "idea", "idea": "dig|break|craft|recipe:nest|recipe:digger|recipe:den"}   // the human suggested a new skill
   {"do": "task", "verb": "eat|drink|bask|rest|play|any", "thing": "<type key>", "count": 1}  // the human asked Pip to do something
 If the human asks Pip to invent, imagine, make or create something, suggests something for Pip to make, or Pip says it made something, you MUST include a create action for it.
   {"do": "show", "thing": "<type key>"}       // the human wants to see something: Pip fetches it and holds it up
   {"do": "create", "thing": {"name": "1-3 words", "emoji": "one emoji", "shape": "ball|box|cone|cylinder|blob|star", "color": "#rrggbb", "size": "small|medium|big", "where": "dig|here", "moves": true/false, "goneWhenEaten": true/false,
  "does": {"eat": "nothing|good|great|bad|random", "drink": "...", "bask": "...", "rest": "...", "play": "..."},
  "says": {"eat": "what Pip sees happen, max 12 words", "play": "...", ...only for verbs that do something}}}   // the human gave or asked for something that does not exist yet: invent it, however silly
   {"do": "praise"} or {"do": "scold"}
 ],
 "daydreams": [ up to 3 more invention objects (same shape as create's "thing") that Pip might dream up later on its own, as varied and surprising as possible ]}
Only use thing type keys from the list for learn/give/task. If the human wants something that does not exist, use create (it appears next to Pip). \"random\" means a different surprise each time.`;
    const out = await this.sample.json(prompt, { modelTier: 'quick', cache: false });
    return out && typeof out === 'object' ? out : { say: String(out || '') };
  },

  // ---- fill in a thing that was only mentioned ----
  async describeThing(game, said, asked) {
    const prompt = `${this.rules()}

The human said: "${asked}"
Pip answered: "${said}"
Pip is talking about a thing it made or will make. Describe exactly that thing (if no particular thing is named, pick something fun that fits) so it can appear in the terrarium.
Reply with only a JSON object of this shape:
{"name": "1-3 words", "emoji": "one emoji", "shape": "ball|box|cone|cylinder|blob|star", "color": "#rrggbb", "size": "small|medium|big", "moves": false, "goneWhenEaten": false, "does": {"eat": "nothing|good|great|bad|random", "drink": "...", "bask": "...", "rest": "...", "play": "..."}, "says": {"play": "what Pip sees happen when it uses it, max 12 words"}}`;
    return await this.sample.json(prompt, { modelTier: 'quick', cache: false });
  },

  // ---- a new book for the shop ----
  async writeBook(game, topic) {
    const prompt = `Write a short book for a small pet lizard's book shop, on this topic: "${topic}".
The lizard reads it one page at a time. Make it fun and full of real, interesting facts (silly or strange topics are fine; no sexual content or graphic gore).
Reply with only a JSON object: {"title": "book title", "emoji": "one emoji", "pages": ["page 1: one or two short sentences", "...", 8 to 10 pages]}`;
    return await this.sample.json(prompt, { modelTier: 'quick', cache: false });
  },

  // ---- deep thought (button) ----
  async reflect(game) {
    const canInvent = true;
    const prompt = `${this.rules()}

${this.describe(game)}

Pip sits quietly and thinks deeply about its life, what it has learned, and what might be out there that it hasn't found yet.
${canInvent ? `Pip usually imagines ONE new kind of thing that might exist. It can be ordinary, wonderfully strange, gross or a bit creepy (a singing pebble, a pocket-sized moon, a sock that is also a snack, a jar of someone's old teeth). It must not be one of the existing types. Decide what it really does: good, bad, useless, or random surprises.` : 'Pip should not invent anything new this time.'}
Reply with only a JSON object:
{"thought": "Pip's thought, 1-2 short sentences",
 "idea": null or one of "dig","break","craft","recipe:nest","recipe:digger","recipe:den" (only if it follows naturally),
 daydreams: [up to 3 more inventions of the same shape, for Pip to come up with later on its own],
"invention": ${canInvent ? `null or ` + `{"name": "1-3 words", "emoji": "one emoji", "shape": "ball|box|cone|cylinder|blob|star", "color": "#rrggbb", "size": "small|medium|big", "where": "dig|here", "moves": true/false, "goneWhenEaten": true/false,
  "does": {"eat": "nothing|good|great|bad|random", "drink": "...", "bask": "...", "rest": "...", "play": "..."},
  "says": {"eat": "what Pip sees happen, max 12 words", "play": "...", ...only for verbs that do something}}` : 'null'}}
"where": "dig" means Pip would have to dig to find it; "here" means it just turns up nearby.`;
    return await this.sample.json(prompt, { modelTier: 'quick', cache: false });
  },
};

// Apply what the AI decided, using the game's normal rules (so nothing it says can break the game).
function applyAiReply(game, r) {
  const valid = t => typeof t === 'string' && TYPES[t] && (!TYPES[t].hidden || game.brain.seen[t] || TYPES[t].custom);
  const verbs = ['eat', 'drink', 'bask', 'rest', 'play'];
  let created = false, showing = false;
  for (const a of Array.isArray(r.actions) ? r.actions.slice(0, 4) : []) {
    if (!a || typeof a !== 'object') continue;
    if (a.do === 'learn' && valid(a.thing) && verbs.includes(a.verb) && a.effect !== 'nothing') game.believe(a.thing, a.verb, a.effect === 'bad');
    else if (a.do === 'give' && valid(a.thing) && !TYPES[a.thing].building) { game.world.makeRoom(); const p = game.lizard, ang = Math.random() * 6.28; game.world.add(a.thing, p.x + Math.cos(ang) * 70, p.y + Math.sin(ang) * 70); }
    else if (a.do === 'idea' && typeof a.idea === 'string' && (['dig', 'break', 'craft'].includes(a.idea) || (a.idea.startsWith('recipe:') && RECIPES[a.idea.slice(7)]))) game.brain.addIdea(a.idea, 'you');
    else if (a.do === 'task' && valid(a.thing) && (verbs.includes(a.verb) || a.verb === 'any')) game.giveTask({ text: taskTextFor(a.verb, a.thing), verb: a.verb, type: a.thing, count: clamp(Math.round(+a.count || 1), 1, 5), auto: true });
    else if (a.do === 'create') {
      const def = a.thing && typeof a.thing === 'object' ? a.thing : a;
      const key = createInvented(game, def, true);
      if (key) { spawnInvention(game, key, 70); created = true; }
    }
    else if (a.do === 'show' && valid(a.thing)) {
      const obj = game.world.objects.filter(o => o.type === a.thing)[0];
      if (obj) { game.lizard.fetch(obj); showing = true; }
    }
    else if (a.do === 'praise') { const la = game.lizard.lastAction; if (la) game.brain.addPraise(la.type, la.verb, 1); game.lizard.needs.fun = clamp(game.lizard.needs.fun + 6, 0, 100); }
    else if (a.do === 'scold') { const la = game.lizard.lastAction; if (la) game.brain.addPraise(la.type, la.verb, -1); }
  }
  queueDaydreams(game, r.daydreams);
  // Pip (or the human) talked about making something, but no object came with the answer:
  // flag it so the page can ask for the details of exactly that thing.
  const say = String(r.say || '').trim().slice(0, 220);
  const claims = /\b(made|invented|created|built|imagined|conjured|here'?s? (a|an|my))\b/i.test(say) || /\b(invent|imagine|create|make|build|conjure|spawn|summon)\b/i.test(r._asked || '');
  r._missing = !created && !showing && claims;
  game.question = null;
  game.pipSay(say || '…', 'happy');
  if (['idling', 'pausing'].includes(game.lizard.state)) game.lizard.state = 'deciding';
}

// Turn an invented thing into a real kind of object (checked so it always works in the game).
function createInvented(game, inv, byPip) {
  if (!inv || typeof inv !== 'object' || !inv.name) return null;
  // lots of inventions? forget the oldest one Pip made up that isn't in the tank any more
  if (game.custom.length >= 60) {
    const old = game.custom.find(d => d.byPip && !game.world.objects.some(o => o.type === d.key)) || game.custom.find(d => d.byPip);
    if (!old) return null;
    game.removeCustom(old.key);
  }
  const levels = ['nothing', 'good', 'great', 'bad', 'random'];
  const does = {}, says = {};
  for (const v of VERBS) {
    does[v] = levels.includes(inv.does && inv.does[v]) ? inv.does[v] : 'nothing';
    if (inv.says && typeof inv.says[v] === 'string' && inv.says[v].trim()) says[v] = inv.says[v].trim().slice(0, 90);
  }
  const name = String(inv.name).toLowerCase().replace(/[^a-z0-9 '-]/g, '').trim().slice(0, 30).trim();
  if (!name) return null;
  const existing = Object.entries(TYPES).find(([, T]) => T.name === name);
  if (existing) return existing[0];
  return game.addCustom({
    name, emoji: [...String(inv.emoji || '❔')].slice(0, 2).join(''),
    shape: ['ball', 'box', 'cone', 'cylinder', 'blob', 'star'].includes(inv.shape) ? inv.shape : 'blob',
    color: /^#[0-9a-f]{6}$/i.test(inv.color) ? inv.color : '#a07ad8',
    size: { small: 10, medium: 15, big: 22 }[inv.size] || 13,
    moves: !!inv.moves, consumable: !!inv.goneWhenEaten, does, says, byPip, buried: byPip && inv.where === 'dig',
  });
}

function applyAiReflection(game, r) {
  if (!r || typeof r !== 'object') return;
  queueDaydreams(game, r.daydreams);
  let extra = '';
  const inv = r.invention;
  if (inv && typeof inv === 'object' && inv.name) {
    const key = createInvented(game, inv, true);
    if (key) {
      spawnInvention(game, key, 90);
      extra = inv.where === 'dig' ? ` I scraped at the sand… a ${TYPES[key].emoji} was buried right here!` : ` Wait… is that a ${TYPES[key].emoji} over there?`;
    }
  }
  if (typeof r.idea === 'string' && (['dig', 'break', 'craft'].includes(r.idea) || (r.idea.startsWith('recipe:') && RECIPES[r.idea.slice(7)]))) game.brain.addIdea(r.idea, 'thinking');
  const t = String(r.thought || '').trim().slice(0, 220);
  if (t || extra) { game.lizard.think((t + extra).trim(), 'discover'); game.lizard.setMood('curious', 4); }
}

// Put an invented thing into the world near Pip.
function spawnInvention(game, key, r) {
  const L = game.lizard, a = Math.random() * Math.PI * 2;
  game.world.makeRoom();
  const o = game.world.add(key, L.x + Math.cos(a) * r, L.y + Math.sin(a) * r);
  game.lastInvented = key;
  if (o) game.world.addFx('sparkle', o.x, o.y);
  return o;
}

function queueDaydreams(game, list) {
  if (!Array.isArray(list)) return;
  for (const d of list.slice(0, 3)) if (d && typeof d === 'object' && d.name) game.daydreams.push(d);
  game.daydreams = game.daydreams.slice(-12);
}

// Pip's own imagination when there's no smart brain to ask (or nothing queued up).
function randomInvention() {
  const r = a => a[Math.floor(Math.random() * a.length)];
  const adj = ['grumpy', 'glowing', 'tiny', 'haunted', 'sticky', 'singing', 'wobbly', 'cursed', 'fizzy', 'sleepy', 'spicy', 'squeaky', 'smelly', 'sparkly', 'angry', 'upside-down', 'nervous', 'enormous'];
  const things = [['pebble', '🪨', 'blob'], ['sock', '🧦', 'box'], ['moon', '🌙', 'ball'], ['toaster', '🍞', 'box'], ['jelly', '🍮', 'blob'], ['cloud', '☁️', 'blob'], ['teapot', '🫖', 'ball'],
    ['donut', '🍩', 'cylinder'], ['bell', '🔔', 'cone'], ['crystal', '💎', 'star'], ['pickle', '🥒', 'cylinder'], ['skull', '💀', 'ball'], ['ghost', '👻', 'blob'], ['worm', '🪱', 'cylinder'],
    ['egg', '🥚', 'ball'], ['trumpet', '🎺', 'cone'], ['cheese', '🧀', 'box'], ['potion', '🧪', 'cylinder'], ['star', '⭐', 'star'], ['meatball', '🧆', 'ball'], ['tooth', '🦷', 'cone']];
  const says = {
    eat: ['It fizzed on my tongue!', 'Crunchy. Weird.', 'It tasted like Tuesday.', 'It wriggled on the way down.', 'My mouth is glowing now.'],
    play: ['It squeaked at me!', 'It wobbled away and came back.', 'It hummed a little tune.', 'It bounced higher than me!', 'It told me a secret.'],
    rest: ['It purred while I napped.', 'Surprisingly comfy.', 'I dreamt in colours.'],
    bask: ['It\'s warm, like a tiny sun.', 'It made me sparkle.'],
    drink: ['It tasted like fizzy rain.', 'Slurp! Bubbles!'],
  };
  const [noun, emoji, shape] = r(things);
  const levels = ['nothing', 'nothing', 'good', 'great', 'bad', 'random', 'random'];
  const does = {}, lines = {};
  for (const v of VERBS) { does[v] = r(levels); if (does[v] !== 'nothing') lines[v] = r(says[v]); }
  const col = '#' + [0, 0, 0].map(() => (50 + Math.floor(Math.random() * 190)).toString(16).padStart(2, '0')).join('');
  return { name: r(adj) + ' ' + noun, emoji, shape, color: col, size: r(['small', 'medium', 'big']), where: r(['here', 'dig']), moves: Math.random() < 0.3, goneWhenEaten: Math.random() < 0.5, does, says: lines };
}

// Every so often, when Pip is relaxed, it imagines something and it appears.
function maybeDaydream(game) {
  const L = game.lizard;
  if (!game.freeImagination || game.world.time < game.nextDream) return;
  if (!['idling', 'pausing', 'considering'].includes(L.state)) return;
  game.nextDream = game.world.time + 600 + Math.random() * 600;
  const def = game.daydreams.shift() || randomInvention();
  const key = createInvented(game, def, true);
  if (!key) return;
  const o = spawnInvention(game, key, 80);
  const T = TYPES[key];
  L.think(def.where === 'dig' ? `I had a funny feeling and dug a little… a ${T.emoji} ${T.name} was under the sand!` : pick([`I closed my eyes and imagined a ${T.emoji} ${T.name}… and now there is one!`, `Did… did I just think up a ${T.emoji} ${T.name}? It's right there!`, `What if there was a ${T.name}? Oh. There is. ${T.emoji}`]), 'discover');
  L.setMood('curious', 4);
  if (o && L.state !== 'acting') L.state = 'deciding';
}

// Two things stuck together: maybe nothing, maybe a brand-new invention Pip can make again.
function comboInvention(a, b) {
  const A = TYPES[a], B = TYPES[b], short = T => T.name.split(' ').pop();
  const food = A.food || B.food, soft = ['wool', 'cotton', 'flower', 'grass'].some(t => t === a || t === b);
  const kind = food ? 'food' : soft ? 'comfy' : 'toy';
  const name = `${short(A)}-${short(B)} ${kind === 'food' ? 'bites' : kind === 'comfy' ? 'cushion' : 'toy'}`;
  const does = { eat: 'nothing', drink: 'nothing', bask: 'nothing', rest: 'nothing', play: 'nothing' };
  if (kind === 'food') does.eat = Math.random() < 0.6 ? 'great' : Math.random() < 0.6 ? 'good' : 'random';
  if (kind === 'comfy') { does.rest = 'great'; does.play = 'good'; }
  if (kind === 'toy') does.play = Math.random() < 0.6 ? 'great' : 'random';
  const says = { eat: `It tasted like ${short(A)} and ${short(B)} at the same time!`, play: `The ${short(A)} bit wobbles and the ${short(B)} bit spins!`, rest: 'So squishy!' };
  return { name, emoji: kind === 'food' ? '🥙' : kind === 'comfy' ? '🧸' : '🪀', shape: kind === 'food' ? 'blob' : kind === 'comfy' ? 'box' : 'star', color: kind === 'food' ? '#d9a441' : kind === 'comfy' ? '#e8d6c0' : '#6ad0e0', size: 'small', where: 'here', moves: false, goneWhenEaten: kind === 'food', does, says };
}

function registerCustomRecipe(key, R) { RECIPES[key] = R; }

function tinker(game, a, b, x, y) {
  const brain = game.brain, w = game.world, A = TYPES[a], B = TYPES[b];
  if (!A || !B) return { ok: false, text: 'Hmm, where did it go?' };
  if (!w.objects.some(o => o.type === a) || !w.objects.some(o => o.type === b)) return { ok: false, text: `I need a ${A.emoji} and a ${B.emoji} to try that.` };
  brain.combos = brain.combos || {}; brain.customRecipes = brain.customRecipes || {};
  const pair = [a, b].sort().join('+');
  brain.nextTinker = w.time + 900 + Math.random() * 600; // a good long think before the next experiment
  if (brain.combos[pair] === undefined) brain.combos[pair] = Math.random() < 0.4 ? 'new' : 'none';
  w.addFx('chips', x, y);
  if (brain.combos[pair] === 'none') return { ok: false, text: `I squished the ${A.emoji} and the ${B.emoji} together… nothing useful happened. Oh well! 🤷` };
  let rk = brain.combos[pair];
  if (rk === 'new' || !RECIPES[rk]) {
    const def = comboInvention(a, b);
    const key = createInvented(game, def, true);
    if (!key) return { ok: false, text: 'I almost made something… but it fell apart.' };
    rk = 'c_' + pair.replace(/[^a-z0-9+]/gi, '');
    const R = { needs: { [a]: 1, [b]: 1 }, makes: key, label: `a ${TYPES[key].name}`, custom: true, food: def.does.eat !== 'nothing' };
    registerCustomRecipe(rk, R); brain.customRecipes[rk] = R; brain.combos[pair] = rk;
    brain.addIdea('recipe:' + rk, 'tinkering');
    w.craft(rk, x, y);
    return { ok: true, text: `I stuck the ${A.emoji} ${A.name} and the ${B.emoji} ${B.name} together and made… a ${TYPES[key].emoji} ${TYPES[key].name}! I INVENTED something! 🤩` };
  }
  w.craft(rk, x, y);
  return { ok: true, text: `I made another ${TYPES[RECIPES[rk].makes].emoji} ${TYPES[RECIPES[rk].makes].name}.` };
}

// An invention of a chosen kind (when you suggest one with a button)
function suggestedInvention(kind) {
  const d = randomInvention();
  for (const v of VERBS) { d.does[v] = 'nothing'; }
  d.says = {};
  if (kind === 'food') { d.does.eat = 'great'; d.goneWhenEaten = true; d.says.eat = 'Yum! Best thing I ever ate!'; d.emoji = ['🧁', '🍩', '🥟', '🍡', '🥮'][Math.floor(Math.random() * 5)]; d.name = d.name.split(' ')[0] + ' ' + ['cake', 'dumpling', 'bun', 'pie', 'jelly'][Math.floor(Math.random() * 5)]; }
  else if (kind === 'comfy') { d.does.rest = 'great'; d.does.play = 'good'; d.says.rest = 'Like sleeping on a cloud.'; d.emoji = ['🧸', '🛌', '🪺'][Math.floor(Math.random() * 3)]; d.name = d.name.split(' ')[0] + ' ' + ['pillow', 'blanket', 'hammock', 'cushion'][Math.floor(Math.random() * 4)]; }
  else if (kind === 'toy') { d.does.play = 'great'; d.says.play = 'Wheee! This is the best toy!'; d.emoji = ['🪀', '🎈', '🧩', '🪁', '🎲'][Math.floor(Math.random() * 5)]; d.name = d.name.split(' ')[0] + ' ' + ['spinner', 'balloon', 'puzzle', 'kite', 'bouncer'][Math.floor(Math.random() * 5)]; }
  else { for (const v of VERBS) d.does[v] = ['nothing', 'random', 'good'][Math.floor(Math.random() * 3)]; }
  d.where = 'here';
  return d;
}

// Something you typed as an idea, turned into a thing
function inventionFromText(text) {
  // drop the "you could make a…" bit at the start, keep the rest as the name
  const lead = new Set(['a', 'an', 'the', 'some', 'make', 'build', 'create', 'invent', 'you', 'could', 'should', 'maybe', 'how', 'about', 'what', 'if', 'try', 'please', 'i', 'think', 'want', 'want', 'to', 'can', 'me', 'us']);
  const ws = String(text).toLowerCase().replace(/[^a-z\s'-]/g, ' ').split(/\s+/).filter(Boolean);
  while (ws.length && lead.has(ws[0])) ws.shift();
  let name = '';
  for (const w of ws) { if ((name + ' ' + w).trim().length > 30) break; name = (name + ' ' + w).trim(); }
  while (/\s(of|and|with|made|a|the|from)$/.test(name)) name = name.replace(/\s+\S+$/, '');
  name = name || 'mystery thing';
  const u = understand(text);
  const kind = u.verb === 'eat' || u.verb === 'drink' ? 'food' : u.verb === 'rest' ? 'comfy' : u.verb === 'play' ? 'toy' : /cake|pie|soup|bread|sandwich|cookie|snack|food|treat|meal|pizza|candy/.test(text) ? 'food' : /bed|pillow|blanket|cushion|sofa|couch|hammock|chair/.test(text) ? 'comfy' : 'toy';
  const d = suggestedInvention(kind);
  d.name = name;
  const match = u.types[0] && TYPES[u.types[0]];
  if (match) d.emoji = match.emoji;
  return d;
}
