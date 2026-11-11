'use strict';
/*
 * lizard.js — Pip's body: moving, sensing, remembering where things are,
 * and carrying out the plans its brain comes up with.
 */

const SEGMENTS = 16;
const SEG_SPACING = 7;
const VISION = 280;

class Lizard {
  constructor(data) {
    this.name = 'Pip';
    this.x = WORLD_W / 2; this.y = WORLD_H / 2;
    this.heading = 0;
    this.speed = 0;
    this.needs = { fullness: 70, hydration: 70, energy: 80, warmth: 55, fun: 60, health: 100 };
    this.memory = new Map(); // object id -> {id, type, x, y, t}
    if (data) {
      this.name = data.name || 'Pip';
      this.x = data.x; this.y = data.y; this.heading = data.heading || 0;
      Object.assign(this.needs, data.needs || {});
      this.wearing = data.wearing || null;
      this.wet = data.wet || 0;
      for (const m of data.memory || []) if (TYPES[m.type]) this.memory.set(m.id, m);
    }
    this.segs = [];
    for (let i = 0; i < SEGMENTS; i++) this.segs.push({ x: this.x - Math.cos(this.heading) * i * SEG_SPACING, y: this.y - Math.sin(this.heading) * i * SEG_SPACING });
    this.feet = null;
    this.state = 'deciding';
    this.plan = null;
    this.timer = 0;
    this.senseTimer = 0;
    this.misses = 0;
    this.moveTime = 0;
    this.thought = 'Where am I? 🦎';
    this.mood = 'ok';
    this.moodTimer = 0;
    this.lastAction = null;
    this.blink = 0;
    this.tongue = 0;
    this.anim = 0;
    this.carrying = null;  // id of the object in Pip's mouth
    this.refill = {};      // needs Pip is busy topping back up
    this.wet = 0;          // how soaked Pip is (0-100)
    this.onThought = null; // callback(text, kind)
    this.onAction = null;  // callback(type, verb, delta)
  }

  toJSON() {
    return { name: this.name, x: this.x, y: this.y, heading: this.heading, needs: this.needs, wearing: this.wearing || null, wet: Math.round(this.wet), memory: [...this.memory.values()] };
  }

  think(text, kind = 'thought') {
    this.thought = text;
    if (this.onThought) this.onThought(text, kind);
  }

  setMood(m, secs = 3) { this.mood = m; this.moodTimer = secs; }

  get reach() { return 14; }

  maxSpeed() {
    const warm = clamp(this.needs.warmth / 60, 0, 1);
    let s = 58 * (0.35 + 0.65 * warm);
    if (this.needs.energy < 12) s *= 0.55;
    return s;
  }

  sense(world, brain) {
    const range = VISION * (world.isNight ? 0.6 : 1);
    let sawNew = null;
    for (const o of world.objects) {
      if (dist(this.x, this.y, o.x, o.y) > range) continue;
      this.memory.set(o.id, { id: o.id, type: o.type, x: o.x, y: o.y, t: world.time });
      if (!brain.seen[o.type]) { brain.seen[o.type] = world.time; sawNew = o; }
    }
    // things I can see aren't there anymore → forget them
    for (const [id, m] of this.memory) {
      if (dist(this.x, this.y, m.x, m.y) < range * 0.5 && !world.get(id)) this.memory.delete(id);
    }
    return sawNew;
  }

  update(dt, world, brain, task) {
    this.anim += dt;
    this.blink -= dt; if (this.blink < -3.5 - Math.random() * 3) this.blink = 0.15;
    if (this.tongue > 0) this.tongue -= dt; else if (Math.random() < dt * 0.25 && this.state !== 'acting') this.tongue = 0.25;
    if (this.moodTimer > 0) { this.moodTimer -= dt; if (this.moodTimer <= 0) this.mood = 'ok'; }

    this.updateNeeds(dt, world);
    this.updateCarry(dt, world);
    if (this.inside && this.state !== 'acting') this.inside = false;

    this.senseTimer -= dt;
    if (this.senseTimer <= 0) {
      this.senseTimer = 0.4;
      const fresh = this.sense(world, brain);
      const busy = this.state === 'holding' || (this.plan && this.plan.kind === 'fetch' && this.state === 'moving');
      if (fresh && this.state !== 'acting' && this.state !== 'fainted' && !busy) {
        const T = TYPES[fresh.type];
        this.think(`Ooh! What's that ${T.emoji}? I've never seen one before! 👀`, 'discover');
        this.setMood('curious');
        this.state = 'pausing'; this.timer = 2.5; this.speed = 0;
      }
    }

    if (this.needs.health <= 0 && this.state !== 'fainted') {
      this.state = 'fainted'; this.timer = 6;
      this.inside = false;
      this.drop(world);
      this.think(`${this.name} fainted! 😵 I need to take better care of myself…`, 'bad');
    }

    switch (this.state) {
      case 'deciding': {
        this.plan = brain.decide(this, world, task, world.time);
        this.misses = 0; this.moveTime = 0;
        if (this.plan.kind === 'wander') {
          const a = Math.random() * Math.PI * 2, r = 120 + Math.random() * 260;
          this.plan.x = clamp(this.x + Math.cos(a) * r, 40, WORLD_W - 40);
          this.plan.y = clamp(this.y + Math.sin(a) * r, 40, WORLD_H - 40);
        }
        this.think(this.plan.thought, this.plan.reason);
        if (this.plan.kind === 'idle') { this.state = 'idling'; this.timer = 12 + Math.random() * 20; this.speed = 0; break; }
        // take a moment to think before setting off
        this.state = 'considering'; this.timer = 2 + Math.random() * 2.5;
        if (this.plan.x !== undefined) this.lookAt = Math.atan2(this.plan.y - this.y, this.plan.x - this.x);
        break;
      }
      case 'considering':
      case 'idling': {
        this.speed = Math.max(0, this.speed - 200 * dt);
        if (this.state === 'considering' && this.lookAt !== undefined) {
          let diff = this.lookAt - this.heading;
          while (diff > Math.PI) diff -= Math.PI * 2;
          while (diff < -Math.PI) diff += Math.PI * 2;
          this.heading += clamp(diff, -2 * dt, 2 * dt);
        }
        this.moveBody(dt);
        this.timer -= dt;
        if (this.timer <= 0) this.state = this.state === 'considering' ? 'moving' : 'deciding';
        break;
      }
      case 'moving': {
        this.moveTime += dt;
        const p = this.plan;
        let obj = null;
        if (p.objId) {
          obj = world.get(p.objId);
          const door = TYPES[p.type].building ? 38 : 0; // walk to the front door
          if (obj && dist(this.x, this.y, obj.x, obj.y) < VISION) { p.x = obj.x; p.y = obj.y + door; }
        }
        const reachDist = !p.objId ? (p.verb === 'plant' ? 20 : 8) : TYPES[p.type].building ? 10 : this.reach + TYPES[p.type].size * 0.6;
        const d = dist(this.x, this.y, p.x, p.y);
        if (p.kind === 'act' && p.type === 'ground') { this.startAction(null, p); break; }
        if (d < reachDist) {
          if (p.kind === 'fetch') {
            if (!obj) { this.think('Huh, where did it go? 🤨', 'meh'); this.state = 'pausing'; this.timer = 1; break; }
            this.pickUp(obj);
            this.state = 'holding'; this.timer = 180; this.speed = 0;
            this.heading = Math.atan2(WORLD_H - this.y, WORLD_W / 2 - this.x); // turn towards you
            const T = TYPES[obj.type];
            this.think(T.byPip ? `Look! This is the ${T.emoji} ${T.name} I made! (Click me when you're done looking.)` : `Here's the ${T.emoji} ${T.name}! (Click me when you're done.)`, 'happy');
            this.setMood('happy', 4);
            break;
          }
          if (p.kind === 'skill' && !p.objId) { this.startAction(null, p); break; }
          if (p.kind === 'wander') { this.state = 'pausing'; this.timer = 1.5 + Math.random() * 2; this.speed = 0; break; }
          if (!obj) {
            this.memory.delete(p.objId);
            this.think(`Huh? The ${TYPES[p.type].emoji} isn't here anymore. 🤨`, 'meh');
            this.state = 'pausing'; this.timer = 0.6; this.speed = 0; break;
          }
          if (TYPES[obj.type].hops && Math.random() < 0.45) {
            this.misses++;
            this.tongue = 0.3;
            obj.vx = Math.cos(Math.random() * 6.3) * 200; obj.vy = Math.sin(Math.random() * 6.3) * 200; obj.hop = 0.35;
            if (this.misses === 1 || this.misses === 3) this.think(pick(['Missed! Sneaky little thing. 😤', 'Come back here! 🏃', 'So fast!! 💨']), 'meh');
            if (this.misses > 5) { this.think('I give up on catching that one… 😮‍💨', 'meh'); this.state = 'pausing'; this.timer = 0.8; }
            break;
          }
          this.startAction(obj, p);
          break;
        }
        if (this.moveTime > (p.kind === 'fetch' ? 40 : 14)) { this.state = 'deciding'; break; }
        this.steer(dt, p.x, p.y, world, brain);
        break;
      }
      case 'acting': {
        this.timer -= dt;
        this.speed = 0;
        if (this.plan.verb === 'eat') this.tongue = 0.1;
        if (this.plan.verb === 'dig' && Math.random() < dt * 2) world.addFx('sand', this.x + Math.cos(this.heading) * 16, this.y + Math.sin(this.heading) * 16);
        if (this.timer <= 0) this.finishAction(world, brain, task);
        break;
      }
      case 'pausing': {
        this.speed = Math.max(0, this.speed - 200 * dt);
        this.moveBody(dt);
        this.timer -= dt;
        if (this.timer <= 0) this.state = 'deciding';
        break;
      }
      case 'holding': {
        // showing something off to its human until clicked
        this.speed = 0;
        this.moveBody(dt);
        this.timer -= dt;
        const n = this.needs;
        if (this.timer <= 0 || n.health < 25 || n.fullness < 10 || n.hydration < 10) { this.release(); this.think('I\'ll put this down for now.', 'meh'); }
        break;
      }
      case 'fainted': {
        this.timer -= dt;
        this.speed = 0;
        if (this.timer <= 0) {
          this.needs.health = 40; this.needs.fullness = Math.max(this.needs.fullness, 40); this.needs.hydration = Math.max(this.needs.hydration, 40);
          this.needs.energy = Math.max(this.needs.energy, 30);
          this.think('Ugh… I\'m awake again. That was scary. 😓', 'bad');
          this.state = 'deciding';
        }
        break;
      }
    }
  }

  startAction(obj, plan) {
    this.state = 'acting';
    this.speed = 0;
    this.actObj = obj;
    this.timer = { rest: 16, bask: 12, play: 7, drink: 4.5, eat: 4.5, read: 12, dig: 9, break: 9, craft: 13, plant: 7, tend: 5, grab: 2, fill: 4, tinker: 10, stash: 3, wear: 4, unwear: 3, shelter: 25, putdown: 2 }[plan.verb] || 4;
    this.longSleep = plan.verb === 'rest' && this.needs.energy < 40;
    if (this.longSleep) this.timer = 26; // a proper sleep
    this.inside = !!(obj && TYPES[obj.type].building && ['read', 'play', 'rest', 'shelter'].includes(plan.verb));
    if (obj) { this.heading = Math.atan2(obj.y - this.y, obj.x - this.x); obj.held = !TYPES[obj.type].building; }
    // small things get picked up and used in Pip's mouth
    if (plan.verb === 'rest') { this.keepCarry = false; this.drop(this.worldRef); } // put things down before sleeping
    if (obj && plan.verb === 'play' && this.canCarry(obj) && !this.keepCarry) this.pickUp(obj);
  }

  finishAction(world, brain, task) {
    const p = this.plan;
    const obj = this.actObj && world.get(this.actObj.id);
    this.inside = false;
    if (obj) obj.held = false;
    if (!this.keepCarry) this.drop(world);
    if (p.kind === 'skill') return this.finishSkill(world, brain, obj);
    if (p.type !== 'ground' && !obj) { this.state = 'deciding'; return; }
    let delta, r;
    if (p.verb === 'read') {
      // Inside the book shop: look up whatever was on its mind
      delta = { fullness: 0, hydration: 0, energy: -1, warmth: 0, fun: 6, health: 0 };
      this.needs.fun = clamp(this.needs.fun + 6, 0, 100);
      const firstVisit = brain.learnEffect(p.type, 'read', delta);
      let text;
      try { text = brain.readBook(this, world, task, p.desperateFor || {}); }
      catch (e) { console.error(e); text = 'I flipped through a book but got a bit muddled. 😵‍💫'; }
      r = { mood: 'happy', text: firstVisit ? 'It\'s full of books! ' + text : text };
      if (this.onRead && !firstVisit) this.onRead(text);
      brain.satisfyCuriosity(world.time);
    } else {
      delta = world.interact(this, obj, p.verb);
      // a long sleep restores more in a better bed
      if (p.verb === 'rest' && this.longSleep) { const base = ((EFFECTS[p.type] || {}).rest || {}).energy || 0; this.needs.energy = clamp(this.needs.energy + Math.round(base * 0.5), 0, 100); }
      const first = brain.learnEffect(p.type, p.verb, delta);
      r = brain.reactionFor(p.type, p.verb, delta, first);
      if (p.verb === 'eat' && brain.keepSeed(p.type)) r.text += ' I kept a seed. 🌱';
      // Nobody told Pip what a book shop is for. Poking around inside is how it finds out.
      if (TYPES[p.type] && TYPES[p.type].building && p.verb === 'play' && !brain.known(p.type, 'read')) {
        brain.learnEffect(p.type, 'read', { fun: 6 });
        const found = brain.readBook(this, world, task, p.desperateFor || {});
        r = { mood: 'happy', text: `There are things with pages in here… I looked inside one. ${found} Wait — I can find things out in here! 🤯` };
      }
    }
    this.think(r.text, r.mood);
    this.setMood(r.mood);
    this.lastAction = { type: p.type, verb: p.verb, time: world.time };
    if (this.onAction) this.onAction(p.type, p.verb, delta);
    if (p.reason === 'curious') brain.satisfyCuriosity(world.time);
    this.state = 'pausing';
    this.timer = 6 + Math.random() * 5;
  }

  canCarry(o) {
    const T = TYPES[o.type];
    return !!T && !T.building && (T.custom || ['stick', 'shell', 'bone', 'flower', 'berry'].includes(o.type));
  }
  pickUp(o) {
    if (this.carrying && this.carrying !== o.id) this.drop(this.worldRef);
    this.carrying = o.id;
    o.held = true; o.carried = true; o.vx = o.vy = 0;
  }
  // put it down where Pip is: next time Pip wants it, it has to come back for it
  drop(world) {
    this.keepCarry = false;
    if (!this.carrying || !world) return;
    const o = world.get(this.carrying);
    if (o) { o.held = false; o.carried = false; o.lift = 0; o.swing = 0; o.x = clamp(this.x + Math.cos(this.heading) * 20, 15, WORLD_W - 15); o.y = clamp(this.y + Math.sin(this.heading) * 20, 15, WORLD_H - 15); }
    this.carrying = null;
  }
  release() {
    this.dropPending = true;
    this.state = 'pausing'; this.timer = 1.5;
  }
  fetch(obj) {
    if (!obj) return false;
    this.drop(this.worldRef);
    this.plan = { kind: 'fetch', objId: obj.id, type: obj.type, x: obj.x, y: obj.y, reason: 'task' };
    this.state = 'moving'; this.moveTime = 0;
    this.think(`Oh, you want to see it? I'll go get the ${TYPES[obj.type].emoji}!`, 'happy');
    return true;
  }
  updateCarry(dt, world) {
    this.worldRef = world;
    if (this.dropPending) { this.dropPending = false; this.drop(world); }
    if (!this.carrying) return;
    const o = world.get(this.carrying);
    if (!o) { this.carrying = null; return; }
    const using = this.state === 'acting' && this.plan && this.plan.verb === 'play';
    const side = using ? Math.sin(this.anim * 7) * 9 : 0;
    const h = this.heading;
    o.x = this.x + Math.cos(h) * 20 + Math.cos(h + Math.PI / 2) * side;
    o.y = this.y + Math.sin(h) * 20 + Math.sin(h + Math.PI / 2) * side;
    o.lift = this.state === 'holding' ? 16 + Math.sin(this.anim * 3) * 2 : o.type === 'umbrella' ? 14 : 9;
    o.swing = using ? Math.sin(this.anim * 7) * 0.6 : 0;
    // brushes and brooms kick up dust when used
    const T = TYPES[o.type];
    if (using && T && /brush|broom|mop|sweep|duster/.test(T.name) && Math.random() < dt * 4) world.addFx('sand', o.x, o.y);
  }

  // Trying out something Pip wasn't born knowing. Clumsy at first, better with practice.
  finishSkill(world, brain, obj) {
    const p = this.plan;
    let text, mood = 'ok';
    this.needs.energy = clamp(this.needs.energy - 3, 0, 100);
    if (p.verb === 'dig') {
      const s = brain.skill('dig');
      const chance = Math.min(0.8, 0.3 + 0.1 * s.n) + (brain.tools.digger ? 0.15 : 0);
      s.n++;
      if (Math.random() < chance) {
        world.makeRoom();
        const found = world.dig(this.x + Math.cos(this.heading) * 20, this.y + Math.sin(this.heading) * 20, brain.tools.digger);
        const T = TYPES[found];
        s.hits++;
        this.needs.fun = clamp(this.needs.fun + 6, 0, 100);
        text = s.hits === 1 ? `I dug and dug… and there's a ${T.emoji} down here! There ARE things under the sand! 🤯` : `Found a ${T.emoji} ${T.name} under the sand.`;
        mood = 'happy';
      } else text = pick(['Just sand. Maybe I should try somewhere else.', 'Nothing here. Hmm.', 'I scratched around but found nothing. I\'m not very good at this yet.']);
    } else if (p.verb === 'break') {
      const s = brain.skill('break');
      const chance = Math.min(0.9, 0.45 + 0.15 * s.n);
      s.n++;
      if (Math.random() >= chance) text = 'I pulled at the bark but nothing came off. I\'ll try a different way next time.';
      else if (!world.breakOff(obj)) { brain.spent[obj.id] = 1; text = 'There\'s nothing more to pull off this one.'; }
      else { s.hits++; mood = 'happy'; text = s.hits === 1 ? 'CRACK! Bits of the log came off. Sticks! I made sticks! 🤯' : 'Crack. More sticks.'; }
    } else if (p.verb === 'plant') {
      const s = brain.skill('plant');
      const chance = Math.min(0.9, 0.55 + 0.1 * s.n);
      s.n++;
      if ((brain.seeds[p.type] || 0) <= 0) text = 'Oh, I\'ve run out of those seeds.';
      else if (Math.random() >= chance) { brain.seeds[p.type]--; text = 'I dropped the seed and lost it in the sand. Oops.'; }
      else {
        brain.seeds[p.type]--;
        world.makeRoom();
        const o = world.add('seedling', p.x, p.y);
        if (o) { o.grows = p.type; o.age = 0; o.water = 45; o.onGrass = world.onGrass(o.x, o.y); world.addFx('sand', o.x, o.y); }
        s.hits++; mood = 'happy';
        text = s.hits === 1 ? `I planted a ${TYPES[p.type].emoji} seed! Now I just have to wait for it to grow. 🌱` : o && o.onGrass ? `Planted a ${TYPES[p.type].emoji} seed in the grass. Grow, little seed!` : `Planted another ${TYPES[p.type].emoji} seed.`;
      }
    } else if (p.verb === 'tinker') {
      const res = this.onTinker ? this.onTinker(p.type, p.with, this.x + Math.cos(this.heading) * 22, this.y + Math.sin(this.heading) * 22) : null;
      text = res ? res.text : 'Hmm.';
      mood = res && res.ok ? 'happy' : 'meh';
    } else if (p.verb === 'grab') {
      if (obj) { this.pickUp(obj); this.keepCarry = true; text = obj.type === 'bucket' ? 'Got my bucket. 🪣' : obj.type === 'umbrella' ? 'Got my umbrella. Now the rain can\'t get me! ☂️' : `Got a ${TYPES[obj.type].emoji}. Off to the food store!`; mood = 'happy'; }
      else text = 'Where did it go?';
    } else if (p.verb === 'stash') {
      const held = this.carrying && world.get(this.carrying);
      if (obj && held) {
        (obj.contents || (obj.contents = [])).push(held.type);
        world.remove(held.id); this.carrying = null; this.keepCarry = false;
        text = `Stored a ${TYPES[held.type].emoji} for winter. That's ${obj.contents.length} in my food store! 🏚️`; mood = 'happy';
      } else text = 'Hmm, I dropped it somewhere.';
    } else if (p.verb === 'shelter') {
      const first = !brain.skills.shelter;
      brain.skill('shelter').n++; brain.skill('shelter').hits++;
      text = first ? 'Ahh, it\'s nice and dry in here. Much better! ☺️' : world.raining ? 'Staying in until the rain stops. 🌧️' : 'The rain stopped! Back outside. 🌤️';
      mood = 'happy';
      if (world.raining) { this.state = 'acting'; this.timer = 25; this.inside = !!(obj && TYPES[obj.type].building); this.think(text, 'happy'); return; }
    } else if (p.verb === 'putdown') {
      this.keepCarry = false; this.drop(world);
      text = 'Rain\'s stopped. I\'ll put my umbrella down. ☂️';
    } else if (p.verb === 'wear') {
      if (obj) { world.remove(obj.id); this.wearing = 'sweater'; text = 'Ahh, snug and warm in my sweater! 🧥'; mood = 'happy'; }
      else text = 'Where did my sweater go?';
    } else if (p.verb === 'unwear') {
      this.wearing = null;
      world.add('sweater', this.x + Math.cos(this.heading) * 20, this.y + Math.sin(this.heading) * 20);
      const hot = world.season === 'summer' || world.weather === 'heatwave';
      if (hot && brain.addIdea('summerhot', 'experience')) text = 'PHEW! Way too hot for a sweater in summer! I won\'t do that again. 🥵';
      else text = 'Too warm for my sweater now. Off it comes!';
      mood = 'ok';
    } else if (p.verb === 'fill') {
      const b = this.carrying && world.get(this.carrying);
      if (b && b.type === 'bucket') { b.full = 3; world.addFx('ripple', obj ? obj.x : this.x, obj ? obj.y : this.y); text = 'Filled my bucket at the well. 🪣💧'; mood = 'happy'; }
      else text = 'I need my bucket to carry the water.';
    } else if (p.verb === 'tend') {
      const s = brain.skill('tend');
      s.n++;
      const b = this.carrying && world.get(this.carrying);
      if (!obj) { text = 'Hm, where did my seedling go?'; mood = 'meh'; }
      else if (!b || b.type !== 'bucket' || !(b.full > 0)) {
        // nothing to water it with!
        const g = brain.garden || (brain.garden = { sandFails: 0, dryFails: 0 });
        g.waterTries = (g.waterTries || 0) + 1;
        if (brain.addIdea('carry', 'experience')) text = 'I licked the seedling but it\'s still dry… I can\'t carry water in my mouth. I need something to carry it in. 🤔';
        else text = 'I\'ve got no water to give it. I need a bucket from the well.';
        if (!brain.hasIdea('recipe:bucket')) { g.needBucket = true; brain.spark('garden', 0.2); }
        mood = 'meh';
      } else {
        s.hits++; b.full--;
        obj.water = 150; world.addFx('splash', obj.x, obj.y);
        text = b.full > 0 ? 'There you go, little plant. Grow big! 💧🌱' : 'There you go! My bucket is empty now.';
        mood = 'happy';
        // nothing else thirsty? put the bucket down by the farm
        const others = world.objects.some(o => o.type === 'seedling' && o.id !== obj.id && !(o.water > 0));
        if (!others || !(b.full > 0)) { if (!others) { this.keepCarry = false; this.drop(world); } }
      }
    } else if (p.verb === 'craft') {
      const R = RECIPES[p.recipe], s = brain.skill('recipe:' + p.recipe);
      brain.skill('craft').n++;
      const chance = Math.min(0.95, 0.5 + 0.2 * s.n);
      s.n++;
      if (Math.random() >= chance) text = 'It fell apart. Let me think about how to do it better.';
      else if (!world.craft(p.recipe, this.x + Math.cos(this.heading) * 22, this.y + Math.sin(this.heading) * 22)) text = 'Hm, I don\'t have everything I need for that.';
      else {
        s.hits++; brain.skill('craft').hits++; mood = 'happy';
        if (R.tool) brain.tools[R.tool] = true;
        if (p.recipe === 'wool') brain.seeds.cotton = (brain.seeds.cotton || 0) + 1;
        // Pip knows what it built a home or bed for
        if (['hut', 'bed', 'nest', 'den'].includes(R.makes)) brain.learnFromBook(R.makes, 'rest', truthOf(R.makes, 'rest'));
        if (R.makes === 'hut') brain.spark('homes', 0.5); // a home of my own! now to make it cosy…
        this.needs.fun = clamp(this.needs.fun + 12, 0, 100);
        text = `I did it! I made ${R.label}! ${s.hits === 1 ? 'All by myself! 🤩' : ''}`;
      }
    }
    brain.stats.actions++;
    if (p.verb === 'tinker') brain.spark('building', 0.03);
    else brain.spark(p.verb === 'dig' ? 'digging' : ['plant', 'tend'].includes(p.verb) || (RECIPES[p.recipe] && RECIPES[p.recipe].farm) ? 'garden' : RECIPES[p.recipe] && RECIPES[p.recipe].food ? 'cooking' : 'building', 0.03);
    this.think(text, mood === 'happy' ? 'discover' : 'meh');
    this.setMood(mood === 'happy' ? 'happy' : 'meh');
    brain.satisfyCuriosity(world.time);
    this.state = 'pausing';
    this.timer = 6 + Math.random() * 5;
  }

  steer(dt, tx, ty, world, brain) {
    let desired = Math.atan2(ty - this.y, tx - this.x);
    // steer around things Pip has learned are painful (like cacti)
    const painful = brain.painfulTypes();
    for (const o of world.objects) {
      if (TYPES[o.type].building) {
        // walk around buildings (and up to the front door when going in)
        const isTarget = this.plan && o.id === this.plan.objId;
        const d = dist(this.x, this.y, o.x, o.y);
        if (d > 80 || (isTarget && this.y > o.y + 20)) continue;
        const away = Math.atan2(this.y - o.y, this.x - o.x);
        let perp = away + Math.PI / 2;
        if (Math.cos(perp) * (tx - this.x) + Math.sin(perp) * (ty - this.y) < 0) perp -= Math.PI;
        const push = (80 - d) / 80;
        desired = Math.atan2(Math.sin(desired) + (Math.sin(away) * 1.2 + Math.sin(perp) * 1.6) * push, Math.cos(desired) + (Math.cos(away) * 1.2 + Math.cos(perp) * 1.6) * push);
        continue;
      }
      if (!painful.has(o.type)) continue;
      const d = dist(this.x, this.y, o.x, o.y);
      if (d > 60 || (this.plan && o.id === this.plan.objId)) continue;
      const away = Math.atan2(this.y - o.y, this.x - o.x);
      const push = (60 - d) / 60;
      const dx = Math.cos(desired) + Math.cos(away) * push * 1.5;
      const dy = Math.sin(desired) + Math.sin(away) * push * 1.5;
      desired = Math.atan2(dy, dx);
    }
    let diff = desired - this.heading;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    // ease into turns and slow down on arrival, so Pip moves smoothly
    this.heading += clamp(diff * 4 * dt, -3 * dt, 3 * dt);
    const left = dist(this.x, this.y, tx, ty);
    const target = this.maxSpeed() * (Math.abs(diff) > 1.4 ? 0.35 : 1) * clamp(left / 50, 0.3, 1);
    this.speed += clamp(target - this.speed, -150 * dt, 90 * dt);
    this.x = clamp(this.x + Math.cos(this.heading) * this.speed * dt, 12, WORLD_W - 12);
    this.y = clamp(this.y + Math.sin(this.heading) * this.speed * dt, 12, WORLD_H - 12);
    this.moveBody(dt);
  }

  moveBody() {
    this.segs[0].x = this.x; this.segs[0].y = this.y;
    for (let i = 1; i < this.segs.length; i++) {
      const a = this.segs[i - 1], b = this.segs[i];
      const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || 1;
      if (d > SEG_SPACING) { b.x = a.x + dx / d * SEG_SPACING; b.y = a.y + dy / d * SEG_SPACING; }
    }
  }

  updateNeeds(dt, world) {
    const n = this.needs;
    const resting = this.state === 'acting' && this.plan && this.plan.verb === 'rest';
    // needs drop slowly, so Pip isn't constantly chasing them
    n.fullness -= 0.11 * dt;
    n.hydration -= 0.14 * dt;
    n.energy -= (0.05 + (this.speed > 5 ? 0.06 : 0) + (world.isNight ? 0.06 : 0)) * dt * (resting ? 0 : 1);
    n.fun -= 0.09 * dt;
    // cold-blooded: body temperature drifts toward the surroundings
    const amb = world.ambientAt(this.x, this.y) + (this.wearing ? 18 : 0); // a sweater keeps Pip ~18° warmer
    n.warmth += (amb - n.warmth) * 0.03 * dt;
    if (n.warmth < 12) n.health -= 0.12 * dt; // dangerously cold
    // rain: out in it, Pip gets soaked and grumpy; under a roof or an umbrella it stays dry
    const held = this.carrying && world.get(this.carrying);
    this.covered = this.inside || (held && held.type === 'umbrella') || world.underRoof(this.x, this.y);
    if (world.raining && !this.covered) this.wet = Math.min(100, this.wet + dt * (world.weather === 'thunder' ? 8 : 6));
    else this.wet = Math.max(0, this.wet - dt * (1.5 + world.heatAt(this.x, this.y) * 6));
    if (this.wet > 25) { n.fun -= 0.3 * dt * (0.5 + this.wet / 100); n.warmth -= 0.06 * dt * this.wet / 100; }
    if (this.wet > 35 && !this.grumbled && this.state !== 'acting') { this.grumbled = true; this.think(pick(['Ugh, I\'m getting soaked. 😒', 'Rain, rain, go away… I\'m all wet. 😒', 'Blech. Wet scales are the worst. 😒']), 'meh'); this.setMood('meh', 4); }
    if (this.wet < 5) this.grumbled = false;
    if (n.fullness > 25 && n.hydration > 25 && n.warmth > 30) n.health += 0.25 * dt;
    if (n.fullness <= 1 || n.hydration <= 1) n.health -= 0.6 * dt;
    if (n.warmth > 97) n.health -= 0.3 * dt;
    for (const k of NEEDS) n[k] = clamp(n[k], 0, 100);
    for (const k of ['fullness', 'hydration', 'fun']) {
      if (n[k] < 45 && !this.refill[k]) { this.refill[k] = true; if (this.onLow) this.onLow(k); }
      else if (n[k] >= 80) delete this.refill[k];
    }
  }

  // How Pip feels overall (for the face in the header)
  overallMood() {
    if (this.state === 'fainted') return '😵';
    if (this.state === 'acting' && this.plan && this.plan.verb === 'rest') return '😴';
    if (this.wet > 40) return '😒';
    const m = { hurt: '😣', happy: '😄', curious: '🤔', meh: '😕' }[this.mood];
    if (m) return m;
    const low = Math.min(...NEEDS.map(k => this.needs[k]));
    if (low < 15) return '😫';
    if (low < 35) return '😐';
    return '🙂';
  }
}
