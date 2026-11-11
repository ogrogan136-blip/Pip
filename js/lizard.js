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
      for (const m of data.memory || []) this.memory.set(m.id, m);
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
    let s = 75 * (0.35 + 0.65 * warm);
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
        if (this.plan.kind === 'idle') { this.state = 'idling'; this.timer = 5 + Math.random() * 8; this.speed = 0; break; }
        // take a moment to think before setting off
        this.state = 'considering'; this.timer = 1.2 + Math.random() * 1.5;
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
          if (obj && dist(this.x, this.y, obj.x, obj.y) < VISION) { p.x = obj.x; p.y = obj.y; }
        }
        const reachDist = p.objId ? this.reach + TYPES[p.type].size * 0.6 : 8;
        const d = dist(this.x, this.y, p.x, p.y);
        if (p.kind === 'act' && p.type === 'ground') { this.startAction(null, p); break; }
        if (d < reachDist) {
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
    this.timer = { rest: 8, bask: 6, play: 4, drink: 3, eat: 2.5 }[plan.verb] || 3;
    if (obj) { this.heading = Math.atan2(obj.y - this.y, obj.x - this.x); obj.held = true; }
  }

  finishAction(world, brain, task) {
    const p = this.plan;
    const obj = this.actObj && world.get(this.actObj.id);
    if (obj) obj.held = false;
    if (p.type !== 'ground' && !obj) { this.state = 'deciding'; return; }
    const delta = world.interact(this, obj, p.verb);
    const first = brain.learnEffect(p.type, p.verb, delta);
    const r = brain.reactionFor(p.type, p.verb, delta, first);
    this.think(r.text, r.mood);
    this.setMood(r.mood);
    this.lastAction = { type: p.type, verb: p.verb, time: world.time };
    if (this.onAction) this.onAction(p.type, p.verb, delta);
    if (p.reason === 'curious') brain.satisfyCuriosity(world.time);
    this.state = 'pausing';
    this.timer = 2.5 + Math.random() * 2;
  }

  steer(dt, tx, ty, world, brain) {
    let desired = Math.atan2(ty - this.y, tx - this.x);
    // steer around things Pip has learned are painful (like cacti)
    const painful = brain.painfulTypes();
    for (const o of world.objects) {
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
    this.heading += clamp(diff, -4 * dt, 4 * dt) + Math.sin(this.anim * 9) * 0.6 * dt;
    const target = this.maxSpeed() * (Math.abs(diff) > 1.4 ? 0.4 : 1);
    this.speed += clamp(target - this.speed, -220 * dt, 160 * dt);
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
    n.fullness -= 0.32 * dt;
    n.hydration -= 0.42 * dt;
    n.energy -= (0.12 + (this.speed > 5 ? 0.14 : 0) + (world.isNight ? 0.12 : 0)) * dt * (resting ? 0 : 1);
    n.fun -= 0.28 * dt;
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
