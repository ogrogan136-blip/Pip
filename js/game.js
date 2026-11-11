'use strict';
/*
 * game.js — ties the world, Pip's body, Pip's brain and tasks together.
 * No DOM code here, so the simulation can also run headless (see tests/).
 */

const SAVE_KEY = 'pip-lizard-save-v1';

class Game {
  constructor(save) {
    // things the human invented have to exist before the world is loaded
    this.custom = (save && save.custom) || [];
    this.custom.forEach(registerCustomType);
    this.chat = (save && save.chat) || [];
    this.question = (save && save.question) || null;
    this.nextAsk = 0;
    this.askTimer = 5;
    this.world = new World(save && save.world);
    this.world.objects = this.world.objects.filter(o => TYPES[o.type]);
    this.world.objects.forEach(o => { o.held = false; });
    // older saves: the book shop is new, so build one
    if (save && !save.bookshop && !this.world.objects.some(o => o.type === 'bookstore')) this.world.add('bookstore', 470, 85);
    this.brain = new Brain(save && save.brain);
    // earlier versions told Pip what the book shop was for; now it has to find out itself
    if (save && (save.v || 1) < 3) delete this.brain.effects['bookstore:read'];
    this.lizard = new Lizard(save && save.lizard);
    this.task = save && save.task ? new Task(save.task) : null;
    this.taskHistory = (save && save.taskHistory) || [];
    this.log = [];
    this.listeners = {};
    this.celebrate = 0;
    this.lizard.onThought = (text, kind) => this.addLog(text, kind);
    this.lizard.onAction = (t, v, d) => this.handleAction(t, v, d);
  }

  on(evt, fn) { (this.listeners[evt] || (this.listeners[evt] = [])).push(fn); }
  emit(evt, ...a) { (this.listeners[evt] || []).forEach(f => f(...a)); }

  addLog(text, kind = 'thought') {
    const last = this.log[this.log.length - 1];
    if (last && last.text === text) return;
    this.log.push({ text, kind, time: this.world.time });
    if (this.log.length > 60) this.log.shift();
    this.emit('log');
  }

  step(dt) {
    this.world.update(dt, this.lizard);
    this.lizard.update(dt, this.world, this.brain, this.task);
    if (this.celebrate > 0) this.celebrate -= dt;
    this.askTimer -= dt;
    if (this.askTimer <= 0) {
      const idea = this.brain.ponder(this.lizard, this.world, 5);
      if (idea) { this.lizard.think(idea, 'discover'); this.lizard.setMood('curious', 4); }
    }
    if (this.askTimer <= 0) { this.askTimer = 5; if (!this.nextAsk) this.nextAsk = this.world.time + 45; this.maybeAsk(); }
  }

  // ---- tasks ----
  giveTask(opts) {
    this.task = new Task(opts);
    this.task.givenAt = this.world.time;
    this.addLog(`📋 New task: "${this.task.text}"${this.task.count > 1 ? ` ×${this.task.count}` : ''}`, 'task');
    // drop what it's doing and think about the task
    if (['moving', 'pausing', 'idling', 'considering'].includes(this.lizard.state)) this.lizard.state = 'deciding';
    this.emit('task');
  }

  cancelTask() {
    if (!this.task) return;
    this.addLog(`📋 Task "${this.task.text}" cancelled.`, 'task');
    this.task = null;
    this.emit('task');
  }

  taskSuccess(t, v) {
    const task = this.task;
    this.brain.learnTask(task.words, t, v, true);
    task.progress++;
    this.lizard.needs.fun = clamp(this.lizard.needs.fun + 6, 0, 100);
    if (task.progress >= task.count) {
      this.brain.stats.tasksDone++;
      this.taskHistory.unshift({ text: task.text, done: true, time: this.world.time });
      this.taskHistory = this.taskHistory.slice(0, 12);
      this.lizard.think(`I did it! "${task.text}" — done! 🎉`, 'task');
      this.lizard.setMood('happy', 4);
      this.celebrate = 2.5;
      this.task = null;
    } else {
      this.lizard.think(`That's it! "${task.text}" — ${task.progress}/${task.count} ✅`, 'task');
      this.lizard.setMood('happy');
    }
    this.emit('task');
  }

  handleAction(t, v) {
    const task = this.task;
    if (!task) return;
    if (task.matches(t, v)) { this.taskSuccess(t, v); return; }
    const k = this.brain.key(t, v);
    if (task.auto) {
      this.brain.learnTask(task.words, t, v, false);
      task.tried[k] = (task.tried[k] || 0) + 1;
    } else {
      // custom task: no verdict yet, but try something different next time
      task.tried[k] = (task.tried[k] || 0) + 0.5;
    }
  }

  // ---- training by the human ----
  goodPip() {
    const la = this.lizard.lastAction;
    this.lizard.needs.fun = clamp(this.lizard.needs.fun + 8, 0, 100);
    this.lizard.setMood('happy');
    if (!la || this.world.time - la.time > 20) {
      this.lizard.think('Yay, my human is happy! But… what did I do? 😊', 'happy');
      return;
    }
    this.brain.addPraise(la.type, la.verb, 1);
    if (this.task && !this.task.auto) { this.taskSuccess(la.type, la.verb); return; }
    const T = typeInfo(la.type);
    this.lizard.think(`Yay! You liked it when I ${la.verb === 'rest' ? 'rested on' : VERB_INFO[la.verb].phrase} the ${T.emoji}! I'll remember that. 💚`, 'happy');
  }

  noPip() {
    const la = this.lizard.lastAction;
    this.lizard.setMood('meh');
    if (!la || this.world.time - la.time > 20) { this.lizard.think('Uh oh, did I do something wrong? 😟', 'meh'); return; }
    this.brain.addPraise(la.type, la.verb, -1);
    if (this.task && !this.task.auto) {
      this.brain.learnTask(this.task.words, la.type, la.verb, false);
      const k = this.brain.key(la.type, la.verb);
      this.task.tried[k] = (this.task.tried[k] || 0) + 1;
    }
    const T = typeInfo(la.type);
    this.lizard.think(`Oh… you didn't want me to ${VERB_INFO[la.verb].phrase} the ${T.emoji}. Sorry! 😔`, 'meh');
  }

  pet() {
    this.lizard.needs.fun = clamp(this.lizard.needs.fun + 5, 0, 100);
    this.lizard.setMood('happy', 2);
    this.lizard.think(pick(['Hehe, scritches! 🥰', 'I like you, human. 💚', 'Mmm, that\'s nice. 😌']), 'happy');
  }

  // ---- save / load ----
  toJSON() {
    return { v: 3, bookshop: true, world: this.world, brain: this.brain, lizard: this.lizard, task: this.task, taskHistory: this.taskHistory, custom: this.custom, chat: this.chat, question: this.question };
  }
}

Object.assign(Game.prototype, Talk);
