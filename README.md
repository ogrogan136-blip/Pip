# 🦎 Pip the Lizard

A virtual lizard that learns about its world on its own.

Open `index.html` in a browser — no install or build needed. Pip's memories are saved in your browser automatically.

## What Pip does
- **Has needs:** tummy, water, energy, warmth (it's cold-blooded, so it needs the heat lamp), fun and health.
- **Starts out knowing nothing.** It doesn't know a cricket is food or a cactus hurts. It tries things out of curiosity (eat, drink, bask, rest, play) and remembers how each one made it feel.
- **Uses what it learned** to decide what to do next, depending on what it needs most right now. When it's hungry it goes for food it knows works; when it's bored it explores and experiments.
- **Learns to avoid** things that hurt it, and even steers around them.
- **Reads books.** When something is on its mind (a word it doesn't know, a need it can't solve, a thing it wonders about), it walks into the 📚 book shop and looks it up.
- **Thinks out loud.** The 💭 box and the thoughts log show its reasoning.

## What you can do
- **Add things to the world:** crickets, mealworms, lettuce, berries, flowers, mushrooms, ladybugs, water, rocks, a heat lamp, logs, a ball, cacti. Drag them around with ✋, or remove them with 🧹.
- **Give tasks**, like "play with the ball ×3" or "visit the rock". Pip doesn't understand words at first. It learns what they mean from which attempts work, then combines words it knows for new tasks.
- **Teach your own tasks** in plain words ("go to bed on the log"). Press **🍬 Good Pip!** when it gets it right, or **✋ No!** when it doesn't.
- **Train behaviour:** Good / No work any time, on whatever Pip just did. Click Pip to pet it.
- Speed up time (3×, 10×) to watch it learn faster, change its curiosity, or reset its memory.

## Code
- `js/world.js`: the terrarium and its hidden rules (what everything really does)
- `js/brain.js`: needs, learning, word learning, decision-making
- `js/lizard.js`: body, senses, memory of where things are, carrying out plans
- `js/game.js`: tasks, training, saving
- `js/render3d.js`: the 3D terrarium (three.js)
- `js/ui.js`: the page and controls

Headless learning test: `node tests/sim.js`

To bundle everything into one HTML file: `node tools/build-single.js pip-single.html`
