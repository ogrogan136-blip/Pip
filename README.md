# 🦎 Pip the Lizard

A virtual lizard that learns about its world on its own.

Open `index.html` in a browser — no install or build needed. Pip's memories are saved in your browser automatically.

## What Pip does
- **Has needs:** tummy, water, energy, warmth (it's cold-blooded, so it needs the heat lamp), fun and health.
- **Starts out knowing nothing.** It doesn't know a cricket is food or a cactus hurts. It tries things out of curiosity (eat, drink, bask, rest, play) and remembers how each one made it feel.
- **Uses what it learned** to decide what to do next, depending on what it needs most right now. When it's hungry it goes for food it knows works; when it's bored it explores and experiments.
- **Learns to avoid** things that hurt it, and even steers around them.
- **Learns to read.** Once Pip works out what the 📚 book shop is for, it starts by looking at pictures and slowly learns to read. The shop has 11 books (bugs, cooking, lizards, plants, water, sun, building, digging, stars, feelings, rocks). Pip reads a page or two per visit, picks books by its interests, and some pages teach it real things or recipes. With Smart Pip you can add new books on any topic.
- **Gets ideas over time.** After long hunger it wonders what's under the sand and learns to dig (finding crabs, shells and more). Playing with logs leads to pulling sticks off them, and sticks lead to building a nest, a den and a digging stick. Books and hints from you can plant these ideas too. Every skill starts clumsy and improves with practice.
- **Grows its own food.** Food only turns up now and then. After reading "Grow Your Own Food", Pip keeps seeds from what it eats, plants them in a patch by the water, waters the seedlings, and grown plants keep producing food. It can build a cricket box where crickets breed, and it can plant foods it imagined itself.
- **Thinks out loud.** The 💭 box and the thoughts log show its reasoning.

## What you can do
- **Add things to the world:** crickets, mealworms, lettuce, berries, flowers, mushrooms, ladybugs, water, rocks, a heat lamp, logs, a ball, cacti. Drag them around with ✋, or remove them with 🧹.
- **Give tasks**, like "play with the ball ×3" or "visit the rock". Pip doesn't understand words at first. It learns what they mean from which attempts work, then combines words it knows for new tasks.
- **Teach your own tasks** in plain words ("go to bed on the log"). Press **🍬 Good Pip!** when it gets it right, or **✋ No!** when it doesn't.
- **Train behaviour:** Good / No work any time, on whatever Pip just did. Click Pip to pet it.
- **Talk with Pip:** it asks you when it wants or wonders about something. Answer with the buttons or type ("you can eat the berry", "don't touch the cactus", "here, have a ball").
- **Smart Pip:** on claude.ai, Pip can use your own Claude account to understand anything you type and, when you press "Let Pip think deeply", to imagine brand-new things that might exist (some buried under the sand). It only thinks this way when you ask, so it doesn't use your plan in the background.
- **Make your own things:** invent a new object, choose its look and what it secretly does, and place it.
- Speed up time (3×, 10×) to watch it learn faster, change its curiosity, or reset its memory.

## Code
- `js/world.js`: the terrarium and its hidden rules (what everything really does)
- `js/brain.js`: needs, learning, word learning, decision-making
- `js/lizard.js`: body, senses, memory of where things are, carrying out plans
- `js/ai.js`: optional smart thinking through the artifact's Claude capability
- `js/library.js`: the books, reading level and interests
- `js/talk.js`: Pip's questions, understanding replies, custom things
- `js/game.js`: tasks, training, saving
- `js/render3d.js`: the 3D terrarium (three.js)
- `js/crops.js`: crop models that grow in stages
- `js/ui.js`: the page and controls

Headless learning test: `node tests/sim.js`

To bundle everything into one HTML file: `node tools/build-single.js pip-single.html`
