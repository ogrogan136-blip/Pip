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
Current task: ${game.task ? '"' + game.task.text + '"' : 'none'}.
Recent chat:
${chat || '(none)'}`;
  },

  rules() {
    return `You are the inner voice of Pip, a small pet lizard in a 3D terrarium game. Pip is curious, gentle and a bit simple: it talks in short, plain sentences (1-2 sentences, under 30 words), like a young child, with at most one emoji. Pip only knows what is listed below; it is not an AI and never says so.
Verbs Pip can do to things: eat, drink, bask, rest, play. Skills Pip may develop: dig, break (pull sticks off logs), craft. Recipes: nest, digger, den.
Valid thing types: ${Object.keys(TYPES).filter(t => !TYPES[t].hidden || TYPES[t].custom).map(t => t + (TYPES[t].custom ? ' (' + TYPES[t].name + ')' : '')).join(', ')}.
This is a playful game: silly, strange and impossible things are welcome (a tiny disco ball, a sandwich that hums, a cloud on a string). Play along with jokes and odd requests, as long as it stays kind and suitable for a child.`;
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
   {"do": "create", "thing": {"name": "1-3 words", "emoji": "one emoji", "shape": "ball|box|cone|cylinder|blob|star", "color": "#rrggbb", "size": "small|medium|big", "where": "dig|here", "moves": true/false, "goneWhenEaten": true/false,
  "does": {"eat": "nothing|good|great|bad|random", "drink": "...", "bask": "...", "rest": "...", "play": "..."},
  "says": {"eat": "what Pip sees happen, max 12 words", "play": "...", ...only for verbs that do something}}}   // the human gave or asked for something that does not exist yet: invent it, however silly
   {"do": "praise"} or {"do": "scold"}
 ]}
Only use thing type keys from the list for learn/give/task. If the human wants something that does not exist, use create (it appears next to Pip). \"random\" means a different surprise each time.`;
    const out = await this.sample.json(prompt, { modelTier: 'quick', cache: false });
    return out && typeof out === 'object' ? out : { say: String(out || '') };
  },

  // ---- deep thought (button) ----
  async reflect(game) {
    const canInvent = game.custom.length < 40;
    const prompt = `${this.rules()}

${this.describe(game)}

Pip sits quietly and thinks deeply about its life, what it has learned, and what might be out there that it hasn't found yet.
${canInvent ? `Pip usually imagines ONE new kind of thing that might exist. It can be ordinary or wonderfully strange (a singing pebble, a pocket-sized moon, a sock that is also a snack). It must not be one of the existing types. Decide what it really does: good, bad, useless, or random surprises.` : 'Pip should not invent anything new this time.'}
Reply with only a JSON object:
{"thought": "Pip's thought, 1-2 short sentences",
 "idea": null or one of "dig","break","craft","recipe:nest","recipe:digger","recipe:den" (only if it follows naturally),
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
  for (const a of Array.isArray(r.actions) ? r.actions.slice(0, 4) : []) {
    if (!a || typeof a !== 'object') continue;
    if (a.do === 'learn' && valid(a.thing) && verbs.includes(a.verb) && a.effect !== 'nothing') game.believe(a.thing, a.verb, a.effect === 'bad');
    else if (a.do === 'give' && valid(a.thing) && !TYPES[a.thing].building && game.world.objects.length < 40) { const p = game.lizard, ang = Math.random() * 6.28; game.world.add(a.thing, p.x + Math.cos(ang) * 70, p.y + Math.sin(ang) * 70); }
    else if (a.do === 'idea' && typeof a.idea === 'string' && (['dig', 'break', 'craft'].includes(a.idea) || (a.idea.startsWith('recipe:') && RECIPES[a.idea.slice(7)]))) game.brain.addIdea(a.idea, 'you');
    else if (a.do === 'task' && valid(a.thing) && (verbs.includes(a.verb) || a.verb === 'any')) game.giveTask({ text: taskTextFor(a.verb, a.thing), verb: a.verb, type: a.thing, count: clamp(Math.round(+a.count || 1), 1, 5), auto: true });
    else if (a.do === 'create' && a.thing && game.world.objects.length < 40) {
      const key = createInvented(game, a.thing, false);
      if (key) { const p = game.lizard, ang = Math.random() * 6.28; game.world.add(key, p.x + Math.cos(ang) * 70, p.y + Math.sin(ang) * 70); }
    }
    else if (a.do === 'praise') { const la = game.lizard.lastAction; if (la) game.brain.addPraise(la.type, la.verb, 1); game.lizard.needs.fun = clamp(game.lizard.needs.fun + 6, 0, 100); }
    else if (a.do === 'scold') { const la = game.lizard.lastAction; if (la) game.brain.addPraise(la.type, la.verb, -1); }
  }
  const say = String(r.say || '').trim().slice(0, 220);
  game.question = null;
  game.pipSay(say || '…', 'happy');
  if (['idling', 'pausing'].includes(game.lizard.state)) game.lizard.state = 'deciding';
}

// Turn an invented thing into a real kind of object (checked so it always works in the game).
function createInvented(game, inv, byPip) {
  if (!inv || typeof inv !== 'object' || !inv.name || game.custom.length >= 40) return null;
  const levels = ['nothing', 'good', 'great', 'bad', 'random'];
  const does = {}, says = {};
  for (const v of VERBS) {
    does[v] = levels.includes(inv.does && inv.does[v]) ? inv.does[v] : 'nothing';
    if (inv.says && typeof inv.says[v] === 'string' && inv.says[v].trim()) says[v] = inv.says[v].trim().slice(0, 90);
  }
  const name = String(inv.name).toLowerCase().replace(/[^a-z0-9 '-]/g, '').trim().slice(0, 22);
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
  let extra = '';
  const inv = r.invention;
  if (inv && typeof inv === 'object' && inv.name) {
    const key = createInvented(game, inv, true);
    if (key) {
      if (inv.where === 'dig') { game.brain.addIdea('dig', 'thinking'); extra = ' Maybe it\'s buried somewhere…'; }
      else { const L = game.lizard, a = Math.random() * 6.28; game.world.add(key, L.x + Math.cos(a) * 90, L.y + Math.sin(a) * 90); extra = ` Wait… is that a ${TYPES[key].emoji} over there?`; }
    }
  }
  if (typeof r.idea === 'string' && (['dig', 'break', 'craft'].includes(r.idea) || (r.idea.startsWith('recipe:') && RECIPES[r.idea.slice(7)]))) game.brain.addIdea(r.idea, 'thinking');
  const t = String(r.thought || '').trim().slice(0, 220);
  if (t || extra) { game.lizard.think((t + extra).trim(), 'discover'); game.lizard.setMood('curious', 4); }
}
