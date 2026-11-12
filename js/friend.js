'use strict';
/*
 * friend.js — Shelly the tortoise: a second creature with her own brain,
 * needs, likes and hobbies. Pip and Shelly play together, teach each other
 * what they know, and both help with tasks.
 */

// How each creature is seen by the other (an invisible marker that follows them around)
TYPES.pal = { emoji: '🐢', name: 'Shelly', size: 16, friend: true, hidden: true, words: ['shelly', 'tortoise', 'friend', 'turtle'] };
TYPES.pippal = { emoji: '🦎', name: 'Pip', size: 14, friend: true, hidden: true, words: ['pip', 'lizard', 'friend'] };
EFFECTS.pal = { play: { fun: 24 }, rest: { energy: 8, fun: 8 } };
EFFECTS.pippal = { play: { fun: 24 }, rest: { energy: 8, fun: 8 } };

// Different likes and hobbies
const HOBBIES = {
  pip:    { verbs: { read: 1.3, tinker: 1.4, cook: 1.3, chip: 1.1, dig: 1.2 }, likes: ['cricket', 'roastcricket', 'mealworm', 'ball', 'bookstore'], dislikes: [] },
  shelly: { verbs: { plant: 1.8, tend: 1.8, rest: 1.25, read: 0.7, tinker: 0.6, cook: 0.8, dig: 0.6, chip: 0.6, break: 0.8 }, likes: ['lettuce', 'berry', 'flower', 'salad', 'mint', 'grass', 'plant'], dislikes: ['cricket', 'mealworm', 'roastcricket', 'grubgrill', 'beetle', 'crab', 'roastcrab'] },
};

const Friend = {
  initFriend(save) {
    const f = save && save.friend;
    this.friendArrival = f ? 0 : ((save && save.friendArrival) || 60);
    if (f) this.makeFriend(f);
  },

  makeFriend(data) {
    const body = new Lizard(data && data.body);
    if (!data) { body.name = 'Shelly'; body.x = 120; body.y = 500; for (const s of body.segs) { s.x = body.x; s.y = body.y; } body.needs = { fullness: 70, hydration: 70, energy: 80, warmth: 55, fun: 60, health: 100 }; }
    body.kind = 'tortoise';
    body.speedFactor = 0.6;
    const brain = new Brain(data && data.brain);
    if (!data) {
      brain.personality = { bravery: 0.35, laziness: 0.6, curiosity: 0.45, chattiness: 0.4 };
      const r = brain.readState(); Object.assign(r.interests, { garden: 0.8, plants: 0.6, water: 0.4, bugs: 0.02, cooking: 0.15 });
    }
    brain.hobbies = HOBBIES.shelly;
    this.brain.hobbies = HOBBIES.pip;
    body.onThought = (text, kind) => this.addLog(`🐢 ${body.name}: ${text}`, kind === 'discover' ? 'friend' : 'friend');
    body.onAction = (t, v, d) => { brain.sparkFrom(t, v, d); this.friendAction(body, brain, t, v); };
    body.onTinker = (a, b, x, y) => tinker(this, a, b, x, y, brain);
    this.friend = body; this.friendBrain = brain;
    this.syncFriendMarkers();
  },

  // the two invisible markers that let each creature see (and play with) the other
  syncFriendMarkers() {
    const W = this.world, F = this.friend, L = this.lizard;
    if (!F) return;
    let pal = W.objects.find(o => o.type === 'pal'), pip = W.objects.find(o => o.type === 'pippal');
    if (!pal) pal = W.add('pal', F.x, F.y);
    if (!pip) pip = W.add('pippal', L.x, L.y);
    pal.x = F.x; pal.y = F.y; pal.held = true;
    pip.x = L.x; pip.y = L.y; pip.held = true;
    L.selfMarker = pip.id; F.selfMarker = pal.id;
  },

  friendStep(dt) {
    if (!this.friend) {
      if (this.friendArrival > 0) {
        this.friendArrival -= dt;
        if (this.friendArrival <= 0) {
          this.makeFriend(null);
          this.lizard.think('Oh! A little tortoise just wandered in… She says her name is Shelly! 🐢💚', 'discover');
          this.note("A tortoise called Shelly moved in today. I think we're going to be best friends!", 3);
          this.celebrate = 2.5;
          this.emit('friend');
        }
      }
      return;
    }
    const F = this.friend;
    F.update(dt, this.world, this.friendBrain, this.task);
    this.syncFriendMarkers();
    // hanging out: when they're close and calm, they chat and teach each other
    this.chatTimer = (this.chatTimer || 0) + dt;
    const L = this.lizard, near = dist(L.x, L.y, F.x, F.y) < 70;
    if (near && this.chatTimer > 90 && L.state !== 'acting' && F.state !== 'acting') {
      this.chatTimer = 0;
      if (Math.random() < 0.5) this.share(this.brain, this.friendBrain, L.name, F.name); else this.share(this.friendBrain, this.brain, F.name, L.name);
    }
    // Shelly grows up too
    F.age = (F.age || 0) + dt / this.world.dayLength;
    F.growth = clamp(0.8 + (F.age || 0) / 120, 0.8, 1.15);
  },

  friendAction(body, brain, t, v) {
    // tasks can be done by either of them
    if (this.task && this.task.matches(t, v)) { this.taskSuccess(t, v); this.addLog(`🐢 ${body.name} helped with the task!`, 'task'); }
    if ((t === 'pippal' && v === 'play')) this.playedTogether(this.friendBrain, this.brain, body.name, this.lizard.name);
  },

  // Pip or Shelly played with the other: both have fun, and one teaches the other something
  playedTogether(fromBrain, toBrain, fromName, toName) {
    const L = this.lizard, F = this.friend;
    L.needs.fun = clamp(L.needs.fun + 18, 0, 100); F.needs.fun = clamp(F.needs.fun + 18, 0, 100);
    L.setMood('happy', 4); F.setMood('happy', 4);
    this.addLog(pick([`🦎🐢 ${L.name} and ${F.name} played tag round the tank!`, `🦎🐢 ${L.name} and ${F.name} played hide and seek!`, `🦎🐢 ${L.name} and ${F.name} had a race. ${F.name} was very slow. 😄`]), 'happy');
    this.note(`I played with ${F.name}. Best friends!`, 2);
    if (Math.random() < 0.5) this.share(fromBrain, toBrain, fromName, toName); else this.share(toBrain, fromBrain, toName, fromName);
  },

  // Teach one thing the other doesn't know yet
  share(teacher, learner, tName, lName) {
    const options = [];
    for (const [k, e] of Object.entries(teacher.effects)) {
      if (!e.n || learner.known(...k.split(':'))) continue;
      const [t, v] = k.split(':');
      if (!TYPES[t] || TYPES[t].friend) continue;
      const good = NEEDS.some(n => n !== 'health' && (e.d[n] || 0) >= 8), bad = (e.d.health || 0) < -3;
      if (good || bad) options.push({ kind: 'effect', t, v, e, bad });
    }
    for (const i of Object.keys(teacher.ideas)) if (!learner.hasIdea(i) && (teacher.skills[i.replace('recipe:', 'recipe:')] || teacher.ideas[i])) options.push({ kind: 'idea', i });
    if (!options.length) return false;
    const o = options[Math.floor(Math.random() * options.length)];
    let what;
    if (o.kind === 'effect') {
      learner.learnFromBook(o.t, o.v, o.e.d);
      const T = TYPES[o.t];
      what = o.bad ? `that the ${T.emoji} ${T.name} hurts if you ${VERB_INFO[o.v].phrase} it` : `that you can ${VERB_INFO[o.v].phrase} the ${T.emoji} ${T.name} (it ${teacher.describeEffect(o.e.d)})`;
    } else {
      learner.addIdea(o.i, tName);
      what = o.i.startsWith('recipe:') && RECIPES[o.i.slice(7)] ? `how to make ${RECIPES[o.i.slice(7)].label}` : `how to ${(typeof IDEA_WORDS !== 'undefined' && IDEA_WORDS[o.i]) || o.i}`;
    }
    learner.stats.taught = (learner.stats.taught || 0) + 1;
    this.addLog(`💬 ${tName} taught ${lName} ${what}!`, 'friend');
    this.note(`${tName} taught ${lName} ${what}.`, 2);
    return true;
  },
};
Object.assign(Game.prototype, Friend);
