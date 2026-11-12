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
- **Carries water and builds a home.** The water comes from a stone well. To water crops Pip has to learn to make a bucket, fill it at the well and carry it over. A log is a poor bed: Pip can dig a cosy burrow propped up with a log and sticks, and after reading "Cosy Homes" it grows cotton, spins it into wool and makes a comfy bed, the best sleep of all.
- **Thinks things up itself.** Books are just a guide: with the right materials and a reason (hungry next to lettuce and a cricket, sleeping badly on a log), Pip works out recipes on its own. When bored it tinkers, combining two things to see what happens, and some combinations become brand-new inventions it can make again. It also asks you for ideas or for help when it's stuck.
- **Lives through the seasons.** Spring, summer, autumn and winter bring sun, rain, thunderstorms, heatwaves and snow. Crops grow in their own seasons, rain waters them, and nothing grows in winter. Pip learns (from a hungry winter, the Seasons book, or you) to build a food store and fill it in autumn, to build a stone stove that's warmer than the lamp, and to wear a woolly sweater in the cold, but not in summer.
- **Has a life story.** Pip writes a diary entry each day, works towards 15 goals, grows from hatchling to grown-up (and sheds its skin), develops a personality and favourites, can fall ill from staying wet and cold or eating food that's gone off (mint and warm rest help), and gets visits from a food-stealing beetle and a friendly gecko. A panel shows what Pip is weighing up.
- **Has a friend.** Shelly the tortoise moves in: her own brain, needs and reading, slow and steady, loves gardening, greens and naps, not keen on eating bugs. She and Pip play together, teach each other what they know, and both help with tasks.
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
- `js/weather.js`: seasons and weather
- `js/library.js`: the books, reading level and interests
- `js/life.js`: diary, goals, personality, growing up, sickness, visitors
- `js/friend.js`: Shelly the tortoise, playing together and sharing knowledge
- `js/talk.js`: Pip's questions, understanding replies, custom things
- `js/game.js`: tasks, training, saving
- `js/render3d.js`: the 3D terrarium (three.js)
- `js/crops.js`: crop models that grow in stages
- `js/shapes.js`: 3D shapes for invented things, chosen by name
- `js/ui.js`: the page and controls

Headless learning test: `node tests/sim.js`

To bundle everything into one HTML file: `node tools/build-single.js pip-single.html`
