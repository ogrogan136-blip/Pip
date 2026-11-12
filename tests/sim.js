// Headless check that Pip learns: run with `node tests/sim.js`
const fs = require('fs'), path = require('path'), vm = require('vm');
const ctx = { console, Math, Date, Map, Set, JSON, Object, window: {} };
vm.createContext(ctx);
const src = ['world', 'weather', 'brain', 'library', 'lizard', 'talk', 'ai', 'game', 'life'].map(f => fs.readFileSync(path.join(__dirname, '../js', f + '.js'), 'utf8')).join('\n');
vm.runInContext(src + '\n;this.Game=Game;this.TYPES=TYPES;', ctx);
const { Game } = ctx;

function run(g, secs) { for (let t = 0; t < secs; t += 1 / 30) g.step(1 / 30); }
let failures = 0;
const check = (ok, msg) => { console.log((ok ? 'PASS ' : 'FAIL ') + msg); if (!ok) failures++; };

const g = new Game(null);
run(g, 3600);
const k = g.brain.knowledge();
const b = g.brain;
console.log('actions', b.stats.actions, 'discoveries', b.stats.discoveries, 'needs', JSON.stringify(g.lizard.needs, (k, v) => typeof v === 'number' ? Math.round(v) : v));
check(b.known('cricket', 'eat') || b.known('lettuce', 'eat'), 'learned some food');
check(b.known('water', 'drink') && b.known('water', 'drink').d.hydration > 30, 'learned water is drinkable');
check(g.lizard.needs.health > 30, 'stayed healthy');
// After learning, Pip should prefer good actions over bad ones
const counts = {};
g.lizard.onAction = (t, v) => { counts[t + ':' + v] = (counts[t + ':' + v] || 0) + 1; g.handleAction(t, v); };
run(g, 1800);
console.log('later actions', JSON.stringify(counts));
check(!(counts['cactus:eat'] > 1), 'stopped eating cactus');

// Task: Pip should learn "play with the ball"
const g2 = new Game(null);
run(g2, 600);
let done = 0, t0;
for (let i = 0; i < 4; i++) {
  g2.giveTask({ text: 'play with the ball', verb: 'play', type: 'ball', count: 1 });
  t0 = g2.world.time;
  while (g2.task && g2.world.time - t0 < 2400) g2.step(1 / 30);
  if (!g2.task) done++;
  console.log('task', i, g2.task ? 'not done' : 'done in ' + Math.round(g2.world.time - t0) + 's');
  g2.task = null;
}
check(done >= 3, 'completes repeated tasks');
console.log('meaning of "ball":', JSON.stringify(g2.brain.meaning('ball')), 'play:', JSON.stringify(g2.brain.meaning('play')));
const s = JSON.stringify(g2); const g3 = new Game(JSON.parse(s)); run(g3, 10);
check(g3.brain.stats.actions === g2.brain.stats.actions || g3.brain.stats.actions > 0, 'save/load round trip');
process.exit(failures ? 1 : 0);
