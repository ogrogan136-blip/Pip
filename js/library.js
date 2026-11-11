'use strict';
/*
 * library.js — the books in the book shop, and how Pip reads them.
 * Pip starts out only looking at pictures. Each visit it reads a page or two,
 * and gets a little better at reading. Some pages teach it real things.
 */

// learn: [thing, verb] → Pip now knows what that does. idea: a skill or recipe idea.
const BOOKS = {
  bugs: { title: 'Bugs of the Desert', emoji: '🐛', pages: [
    ['Crickets are packed with protein. Lizards love them.', { learn: ['cricket', 'eat'] }],
    ['Crickets hop away when something big comes close. Sneak up slowly.'],
    ['Mealworms are beetle babies. They\'re soft and filling.', { learn: ['mealworm', 'eat'] }],
    ['Ladybugs taste horrible on purpose, so nobody eats them.', { learn: ['ladybug', 'eat'] }],
    ['Lots of bugs hide under the sand during the day.', { idea: 'dig' }],
    ['Crabs dig burrows. Their claws pinch!', { learn: ['crab', 'play'] }],
    ['Beetles have hard wing covers called elytra.'],
    ['Bugs breathe through tiny holes in their sides.'],
    ['There are more kinds of beetle than any other animal on Earth.'],
  ] },
  cooking: { title: 'The Lizard Cookbook', emoji: '🍳', pages: [
    ['Cooking means putting foods together to make something better.', { idea: 'craft' }],
    ['Lettuce is crunchy and full of water.', { learn: ['lettuce', 'eat'] }],
    ['Berries are sweet. Too many make your tummy gurgle.', { learn: ['berry', 'eat'] }],
    ['Recipe: Desert Salad. Toss one lettuce with one berry. Much more filling than plain lettuce!', { idea: 'recipe:salad' }],
    ['Recipe: Lettuce Wrap. Roll a cricket up in a lettuce leaf. A proper meal.', { idea: 'recipe:wrap' }],
    ['Never, ever eat red mushrooms with white spots.', { learn: ['mushroom', 'eat'] }],
    ['Recipe: Bug on a Stick. Push a cricket onto a stick. Crunchy!', { idea: 'recipe:skewer' }],
    ['Eating somewhere warm helps you digest.'],
    ['Flowers make a nice snack, but they\'re mostly fluff.', { learn: ['flower', 'eat'] }],
  ] },
  lizards: { title: 'All About Lizards', emoji: '🦎', pages: [
    ['Lizards are cold-blooded. They need heat to get going.', { learn: ['lamp', 'bask'] }],
    ['A lizard smells the air with its tongue. That\'s why I flick mine!'],
    ['Lizards shed their old skin as they grow.'],
    ['Some lizards can drop their tail and grow a new one!'],
    ['Lizards sleep more when it\'s cool and dark. Logs make good beds.', { learn: ['log', 'rest'] }],
    ['A flat, warm rock is a lizard\'s favourite place to bask.', { learn: ['rock', 'bask'] }],
    ['Lizards can see colours that people can\'t.'],
    ['Every lizard has its own personality. Even me.'],
  ] },
  plants: { title: 'Plants & Fungi', emoji: '🌵', pages: [
    ['Cacti have sharp spines. Do not touch!', { learn: ['cactus', 'play'] }],
    ['Cacti store water inside, but it isn\'t worth the spines.', { learn: ['cactus', 'eat'] }],
    ['Mushrooms aren\'t plants at all. They\'re fungi.'],
    ['Plants make their own food from sunlight.'],
    ['Flowers make sweet nectar so bees will visit.'],
    ['Some desert seeds can wait years for rain.'],
  ] },
  water: { title: 'Water Everywhere', emoji: '💧', pages: [
    ['Every animal needs water to live.', { learn: ['water', 'drink'] }],
    ['Splashing in water cools you down on a hot day.', { learn: ['water', 'play'] }],
    ['Desert lizards lick dew off leaves in the morning.'],
    ['Water turns to ice when it gets very cold.'],
    ['Clouds are made of tiny drops of water floating in the air.'],
  ] },
  sun: { title: 'Sun, Heat & Weather', emoji: '☀️', pages: [
    ['The sun warms the ground during the day.'],
    ['A heat lamp is like a little indoor sun.', { learn: ['lamp', 'bask'] }],
    ['Rocks soak up heat and stay warm for ages.', { learn: ['rock', 'bask'] }],
    ['Too much heat is dangerous. Find some shade.'],
    ['Desert nights get very cold.'],
    ['Lightning is hotter than the surface of the sun!'],
  ] },
  building: { title: 'Builders of the Wild', emoji: '🪵', pages: [
    ['Some animals pull bark off logs to build with.', { idea: 'break' }],
    ['Sticks can be stacked into shelters.', { idea: 'craft' }],
    ['Birds weave sticks into cosy nests.', { idea: 'recipe:nest' }],
    ['A sharpened stick makes digging much easier.', { idea: 'recipe:digger' }],
    ['A den of sticks and leaves keeps you warm at night.', { idea: 'recipe:den' }],
    ['Beavers build dams out of whole trees!'],
    ['Termite towers can be taller than a person.'],
  ] },
  digging: { title: 'Under the Sand', emoji: '⛏️', pages: [
    ['Lots of creatures live underground.', { idea: 'dig' }],
    ['Grubs and worms hide just under the surface.'],
    ['Shells and bones get buried over many, many years.'],
    ['Crabs bury themselves in sand to hide. They\'re good eating.', { learn: ['crab', 'eat'] }],
    ['Fossils are ancient bones that turned to stone.'],
  ] },
  garden: { title: 'Grow Your Own Food', emoji: '🌱', pages: [
    ['Fruit has seeds inside. Keep them after you eat!', { idea: 'plant' }],
    ['Seeds can\'t grow in dry sand. Plant them in soft grass or soil.', { idea: 'grass' }],
    ['Seedlings need watering every so often, or they dry up and die.', { idea: 'tend' }],
    ['Lettuce can grow back from its stump. Plant that too!'],
    ['A grown plant gives food again and again.'],
    ['Lots of plants in one place is called a farm. A farm means food every day!'],
    ['Recipe: Cricket Box. Two sticks and a lettuce leaf make a home where crickets breed.', { idea: 'recipe:cricketbox' }],
    ['Flowers bring bugs, and bugs bring more bugs.'],
    ['Almost anything that grew from a seed can be planted. Experiment!'],
    ['You can\'t carry water in your mouth. Make a bucket from two sticks, fill it at the well and carry it to your plants.', { ideas: ['carry', 'break', 'recipe:bucket'] }],
  ] },
  homes: { title: 'Cosy Homes', emoji: '🛖', pages: [
    ['Every animal needs a safe place to sleep.'],
    ['A log is an okay bed, but a real home is much better.'],
    ['Recipe: Log Cabin. One log and three sticks make a snug little house.', { ideas: ['break', 'recipe:hut'] }],
    ['Sleeping somewhere soft gives the deepest sleep of all.'],
    ['Cotton plants grow fluffy white bolls. Here are some cotton seeds to try!', { ideas: ['plant'], seeds: ['cotton', 3] }],
    ['Cotton grows in grass like other crops, and needs watering too.'],
    ['Recipe: Wool. Spin two cotton bolls into a ball of wool.', { ideas: ['recipe:wool'] }],
    ['Recipe: Comfy Bed. Weave wool over two sticks for the softest bed ever.', { ideas: ['recipe:bed'] }],
    ['A cosy home makes every day better.'],
  ] },
  stars: { title: 'Stars & the Night', emoji: '⭐', pages: [
    ['Stars are giant balls of fire, very far away.'],
    ['The moon has no light of its own. It reflects the sun.'],
    ['Some animals find their way home using the stars.'],
    ['The closest star to us is the Sun!'],
    ['Shooting stars are tiny rocks burning up in the sky.'],
    ['There are more stars in space than grains of sand on Earth.'],
  ] },
  feelings: { title: 'Big Feelings', emoji: '💚', pages: [
    ['Feeling bored means your brain wants something new.'],
    ['Playing makes you happier.', { learn: ['ball', 'play'] }],
    ['It\'s okay to be scared of things that hurt you.'],
    ['Friends make life better. Even big ones with giant hands.'],
    ['Resting helps your mood as well as your body.'],
    ['Being curious is a kind of bravery.'],
  ] },
  seasons: { title: 'The Four Seasons', emoji: '🍂', pages: [
    ['Every year has four seasons: spring, summer, autumn and winter.'],
    ['Rain waters the plants for you. Lucky!'],
    ['Lettuce likes spring and autumn. Berries and cotton love summer.'],
    ['Nothing grows in winter snow. Save food in autumn to eat in winter!', { ideas: ['stockpile', 'recipe:store'] }],
    ['A food store made of four sticks keeps food safe until you need it.', { ideas: ['recipe:store'] }],
    ['Lizards get very cold in winter. A stone stove gives much more heat than a lamp.', { ideas: ['recipe:stove'] }],
    ['A woolly sweater keeps you warm in the cold.', { ideas: ['recipe:sweater'] }],
    ['But never wear a sweater in summer — you\'ll overheat!', { ideas: ['summerhot'] }],
    ['Thunderstorms are loud but they can\'t hurt you indoors.'],
    ['Getting soaked is no fun! When it rains, go indoors, or hold a big leaf over your head.', { ideas: ['shelter', 'recipe:umbrella'] }],
  ] },
  rocks: { title: 'Rocks & Minerals', emoji: '🪨', pages: [
    ['Rocks are made of minerals squashed together.'],
    ['Don\'t chew rocks. Teeth always lose.', { learn: ['rock', 'eat'] }],
    ['Crystals grow in neat, pointy shapes.'],
    ['Sand is just very, very tiny rocks.'],
    ['Some rocks are older than the dinosaurs.'],
    ['A rock is a fine place for a nap.', { learn: ['rock', 'rest'] }],
  ] },
};

const READING_LEVELS = [
  [0, 'Looks at the pictures'], [3, 'Sounding out words'], [7, 'Reads short pages'], [12, 'Reads well'], [20, 'Bookworm'],
];
function readingLevelName(lit) { let n = READING_LEVELS[0][1]; for (const [at, name] of READING_LEVELS) if (lit >= at) n = name; return n; }

// Which book helps with which need, and which experiences spark which interests.
const NEED_BOOKS = { eat: ['seasons', 'garden', 'bugs', 'cooking', 'plants'], drink: ['water'], bask: ['seasons', 'sun', 'lizards'], rest: ['homes', 'lizards', 'feelings'], play: ['feelings'] };
const SPARKS = {
  'cricket:eat': 'bugs', 'mealworm:eat': 'bugs', 'ladybug:eat': 'bugs', 'crab:eat': 'bugs', 'crab:play': 'bugs', 'cricket:play': 'bugs',
  'lettuce:eat': 'garden', 'berry:eat': 'garden', 'plant': 'garden', 'seedling': 'garden', 'flower:eat': 'plants', 'mushroom:eat': 'plants', 'cactus': 'plants',
  'water': 'water', 'lamp': 'sun', 'rock': 'rocks', 'log:rest': 'homes', 'ground:rest': 'homes', 'log': 'building', 'hut': 'homes', 'bed': 'homes', 'cotton': 'homes', 'stick': 'building', 'ball': 'feelings',
};

// Mixed into Brain
const Reading = {
  allBooks() { return Object.assign({}, BOOKS, this.extraBooks || {}); },
  readState() {
    if (!this.reading) this.reading = { literacy: 0, read: {}, interests: {} };
    const r = this.reading;
    if (!r.read) { r.read = {}; for (const [k, n] of Object.entries(r.pages || {})) r.read[k] = [...Array(n).keys()]; delete r.pages; }
    // every lizard starts with a few little quirks of interest
    for (const k of Object.keys(this.allBooks())) if (r.interests[k] === undefined) r.interests[k] = Math.round(Math.random() * 30) / 100;
    return r;
  },
  spark(topic, amount = 0.15) {
    const r = this.readState();
    if (r.interests[topic] === undefined) return;
    r.interests[topic] = Math.min(1, r.interests[topic] + amount * (1 - r.interests[topic]));
  },
  // Something happened: does it make Pip more interested in anything?
  sparkFrom(type, verb, delta) {
    const t = SPARKS[type + ':' + verb] || SPARKS[type];
    if (t) this.spark(t, (delta && delta.health < -3) ? 0.1 : 0.02);
    if (delta && delta.health < -3) this.spark('feelings', 0.05);
  },
  unreadBooks() {
    const r = this.readState(), out = [];
    for (const [k, b] of Object.entries(this.allBooks())) if ((r.read[k] || []).length < b.pages.length) out.push(k);
    return out;
  },
  topInterest() {
    const r = this.readState();
    return Object.entries(r.interests).sort((a, b) => b[1] - a[1])[0];
  },
  readPage(k, i) {
    const r = this.readState(), [text, fx] = this.allBooks()[k].pages[i];
    (r.read[k] || (r.read[k] = [])).push(i);
    if (fx && fx.learn && TYPES[fx.learn[0]]) this.learnFromBook(fx.learn[0], fx.learn[1], truthOf(fx.learn[0], fx.learn[1]));
    if (fx && fx.idea) this.addIdea(fx.idea, 'a book');
    if (fx && fx.ideas) fx.ideas.forEach(i => this.addIdea(i, 'a book'));
    if (fx && fx.seeds) this.seeds[fx.seeds[0]] = Math.min(9, (this.seeds[fx.seeds[0]] || 0) + fx.seeds[1]);
    this.stats.books = (this.stats.books || 0) + 1;
    return text;
  },
  // Pip reads in the book shop. Returns what it thinks afterwards.
  readLibrary(lizard, world, q) {
    const r = this.readState(), books = this.allBooks();
    const unread = this.unreadBooks();
    if (!unread.length) return 'I\'ve read every single book in here! I could read my favourites again. 📚';
    // Seeds keep dying? Look up how gardening works.
    if (q && q.kind === 'garden') {
      const bk = books.garden, i = bk.pages.findIndex((pg, idx) => pg[1] && (pg[1].idea === q.idea || (pg[1].ideas || []).includes(q.idea)) && !(r.read.garden || []).includes(idx));
      if (i >= 0) {
        const text = this.readPage('garden', i);
        r.literacy = Math.min(30, r.literacy + 0.5);
        return q.idea === 'recipe:bucket' ? `I looked up how to water plants, in "${bk.title}" ${bk.emoji}: ${text} A bucket! Of course! 📖` : `I looked up why my seeds keep dying, in "${bk.title}" ${bk.emoji}: ${text} So THAT's what I was doing wrong! 📖`;
      }
    }
    // Something urgent? Look it up in the index and go straight to that page.
    if (q && q.kind === 'need') {
      const need = q.verb === 'play' ? 'fun' : Object.keys(INSTINCT).find(n => INSTINCT[n] === q.verb);
      for (const k of Object.keys(books)) {
        const i = books[k].pages.findIndex((pg, idx) => pg[1] && pg[1].learn && !(r.read[k] || []).includes(idx) && pg[1].learn[1] === q.verb && TYPES[pg[1].learn[0]] && truthOf(pg[1].learn[0], q.verb)[need] >= 8);
        if (i < 0) continue;
        const text = this.readPage(k, i);
        r.literacy = Math.min(30, r.literacy + 0.5);
        return `I looked in the index of "${books[k].title}" ${books[k].emoji}: ${text} That's what I needed! 📖`;
      }
    }
    // pick a book: one that helps with what's on Pip's mind, else by interest
    let pickK = null;
    if (q && q.kind === 'need' && NEED_BOOKS[q.verb]) pickK = NEED_BOOKS[q.verb].find(k => unread.includes(k));
    if (!pickK && r.current && unread.includes(r.current) && Math.random() < 0.7) pickK = r.current; // carry on with the same book
    if (!pickK) {
      const w = unread.map(k => 0.2 + r.interests[k]);
      let x = Math.random() * w.reduce((a, b) => a + b, 0);
      pickK = unread[unread.length - 1];
      for (let i = 0; i < unread.length; i++) { x -= w[i]; if (x <= 0) { pickK = unread[i]; break; } }
    }
    r.current = pickK;
    const book = books[pickK];
    const pagesNow = r.literacy < 7 ? 1 : r.literacy < 20 ? (Math.random() < 0.25 ? 2 : 1) : (Math.random() < 0.5 ? 2 : 1);
    const learnt = [];
    let at = -1;
    for (let i = 0; i < pagesNow; i++) {
      at = book.pages.findIndex((pg, idx) => !(r.read[pickK] || []).includes(idx));
      if (at < 0) break;
      learnt.push(this.readPage(pickK, at));
    }
    r.literacy = Math.min(30, r.literacy + 0.5);
    this.spark(pickK, 0.04);
    this.nextReadAt = (world.time || 0) + 480 + Math.random() * 360; // had enough reading for a while
    const page = at + 1, done = (r.read[pickK] || []).length >= book.pages.length;
    const lead = r.literacy < 3 ? `I can't read the words yet, but the pictures in "${book.title}" ${book.emoji} show… ` : `Reading "${book.title}" ${book.emoji}, page ${page}: `;
    return lead + learnt.join(' ') + (done ? ' …The end! I finished the whole book! 🎉' : ' 📖');
  },
};

// Things you can cook once you've read about them
RECIPES.salad = { needs: { lettuce: 1, berry: 1 }, makes: 'salad', label: 'a desert salad', food: true };
RECIPES.wrap = { needs: { lettuce: 1, cricket: 1 }, makes: 'wrap', label: 'a lettuce wrap', food: true };
TYPES.wrap = { emoji: '🌯', name: 'lettuce wrap', size: 14, food: true, hidden: true };
EFFECTS.wrap = { eat: { fullness: 60, hydration: 10, fun: 15 } };
TYPES.wrap.cooked = true;
RECIPES.cricketbox = { needs: { stick: 2, lettuce: 1 }, makes: 'cricketbox', label: 'a cricket box', farm: true };
RECIPES.skewer = { needs: { cricket: 1, stick: 1 }, makes: 'skewer', label: 'a bug on a stick', food: true };
TYPES.salad = { emoji: '🥗', name: 'desert salad', size: 15, food: true, hidden: true };
TYPES.skewer = { emoji: '🍢', name: 'bug on a stick', size: 14, food: true, hidden: true };
EFFECTS.salad = { eat: { fullness: 45, hydration: 18, fun: 12 } };
TYPES.salad.cooked = true;
EFFECTS.skewer = { eat: { fullness: 48, fun: 10 } };
TYPES.skewer.cooked = true;

Object.assign(Brain.prototype, Reading);
