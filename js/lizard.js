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
    this.onThought = null; // callback(text, kind)
    this.onAction = null;  // callback(type, verb, delta)
  }

  toJSON() {
    return { name: this.name, x: this.x, y: this.y, heading: this.heading, needs: this.needs, memory: [...this.memory.values()] };
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

    this.senseTimer -= dt;
    if (this.senseTimer <= 0) {
      this.senseTimer = 0.4;
      const fresh = this.sense(world, brain);
      if (fresh && this.state !== 'acting' && this.state !== 'fainted') {
        const T = TYPES[fresh.type];
        this.think(`Ooh! What's that ${T.emoji}? I've never seen one before! 👀`, 'discover');
        this.setMood('curious');
        this.state = 'pausing'; this.timer = 2.5; this.speed = 0;
      }
    }

    if (this.needs.health <= 0 && this.state !== 'fainted') {
      this.state = 'fainted'; this.timer = 6;
      this.inside = false;
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
        const reachDist = !p.objId ? 8 : TYPES[p.type].building ? 10 : this.reach + TYPES[p.type].size * 0.6;
        const d = dist(this.x, this.y, p.x, p.y);
        if (p.kind === 'act' && p.type === 'ground') { this.startAction(null, p); break; }
        if (d < reachDist) {
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
        if (this.moveTime > 14) { this.state = 'deciding'; break; }
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
    this.timer = { rest: 16, bask: 12, play: 7, drink: 4.5, eat: 4.5, read: 12, dig: 9, break: 9, craft: 13 }[plan.verb] || 4;
    this.longSleep = plan.verb === 'rest' && this.needs.energy < 40;
    if (this.longSleep) this.timer = 26; // a proper sleep
    this.inside = !!(obj && TYPES[obj.type].building && ['read', 'play', 'rest'].includes(plan.verb));
    if (obj) { this.heading = Math.atan2(obj.y - this.y, obj.x - this.x); obj.held = !TYPES[obj.type].building; }
  }

  finishAction(world, brain, task) {
    const p = this.plan;
    const obj = this.actObj && world.get(this.actObj.id);
    this.inside = false;
    if (obj) obj.held = false;
    if (p.type !== 'ground' && !obj) { this.state = 'deciding'; return; }
    if (p.kind === 'skill') return this.finishSkill(world, brain, obj);
    let delta, r;
    if (p.verb === 'read') {
      // Inside the book shop: look up whatever was on its mind
      delta = { fullness: 0, hydration: 0, energy: -1, warmth: 0, fun: 6, health: 0 };
      this.needs.fun = clamp(this.needs.fun + 6, 0, 100);
      const firstVisit = brain.learnEffect(p.type, 'read', delta);
      const text = brain.readBook(this, world, task, p.desperateFor || {});
      r = { mood: 'happy', text: firstVisit ? 'It\'s full of books! ' + text : text };
      brain.satisfyCuriosity(world.time);
    } else {
      delta = world.interact(this, obj, p.verb);
      if (p.verb === 'rest' && this.longSleep) { const extra = 20; this.needs.energy = clamp(this.needs.energy + extra, 0, 100); }
      const first = brain.learnEffect(p.type, p.verb, delta);
      r = brain.reactionFor(p.type, p.verb, delta, first);
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
        this.needs.fun = clamp(this.needs.fun + 12, 0, 100);
        text = `I did it! I made ${R.label}! ${s.hits === 1 ? 'All by myself! 🤩' : ''}`;
      }
    }
    brain.stats.actions++;
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
    const amb = world.ambientAt(this.x, this.y);
    n.warmth += (amb - n.warmth) * 0.03 * dt;
    if (n.fullness > 25 && n.hydration > 25 && n.warmth > 30) n.health += 0.25 * dt;
    if (n.fullness <= 1 || n.hydration <= 1) n.health -= 0.6 * dt;
    if (n.warmth > 97) n.health -= 0.3 * dt;
    for (const k of NEEDS) n[k] = clamp(n[k], 0, 100);
  }

  // How Pip feels overall (for the face in the header)
  overallMood() {
    if (this.state === 'fainted') return '😵';
    if (this.state === 'acting' && this.plan && this.plan.verb === 'rest') return '😴';
    const m = { hurt: '😣', happy: '😄', curious: '🤔', meh: '😕' }[this.mood];
    if (m) return m;
    const low = Math.min(...NEEDS.map(k => this.needs[k]));
    if (low < 15) return '😫';
    if (low < 35) return '😐';
    return '🙂';
  }
}
