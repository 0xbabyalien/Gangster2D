# Gangster2D

**A top-down 2D open-city driving, shooting and police-chase game built with [Phaser 3](https://phaser.io/).**

[![live_demo](https://img.shields.io/badge/live_demo-%23444444.svg?style=plastic&logo=rockstargames&logoColor=FCAF17)](https://0xbabyalien.github.io/Gangster2D/)
[![license](https://img.shields.io/badge/license-MIT-%23444444.svg?style=plastic)](LICENSE)
![phaser](https://img.shields.io/badge/Phaser-3.80.1-%23444444.svg?style=plastic)
[![sponsors](https://img.shields.io/badge/sponsors-%23444444.svg?style=plastic&logo=githubsponsors&logoColor=EA4AAA)](https://github.com/sponsors/0xbabyalien) [![paypal](https://img.shields.io/badge/paypal-%23444444.svg?style=plastic&logo=paypal&logoColor=002991)](https://paypal.me/0xbabyalien) [![give_btc](https://img.shields.io/badge/give_btc-%23444444.svg?style=plastic&logo=bitcoin&logoColor=F7931A)](https://pay.blink.sv/0xbabyalien) [![give_coin](https://img.shields.io/badge/give_crypto-%23444444.svg?style=plastic&logo=ethereum&logoColor=F0B90B)](https://link.trustwallet.com/send?coin=20000714&address=0x960fbe9b5c9e9bb514f0eb55ad63c4fd459bf07d&amount=0.003)

<!-- Add a screenshot or GIF of the gameplay here, e.g.: ![Gameplay](docs/screenshot.png) -->

Walk around a living city, steal a car, and see how long you can stay out of trouble. Traffic obeys traffic lights, pedestrians use the sidewalks, the police respond to your crimes, and an ambulance is dispatched to anyone you leave injured.

---

## Features

### A living city
- A 2400 × 2400 px city built from a 6 × 6 road grid. Buildings and trees are randomised every time the game loads.
- NPC traffic follows lanes (left-hand traffic by default), obeys a traffic light at every intersection (each with its own phase), turns at junctions and goes around obstacles. Starts with 14 cars; change it live with the **+ / −** buttons.
- 18 pedestrians walk the sidewalks and cross the roads.
- Eleven vehicle types: sedan, hatchback, SUV, pickup, van, taxi, sports car, bus, truck, police car and ambulance. Each has its own size, top speed, acceleration and turning.
- Six cars are parked in the car park next to the start position for the player to take: sports car, SUV, pickup, hatchback, van and sedan.

### Crime and police
- Crimes add **heat**, which sets your **wanted level from 1 to 5 stars** (heat thresholds: 1, 3, 6, 10, 15).
- Crimes that count: firing a weapon, speeding (limit **45 km/h**, shown on the speedometer), driving the wrong way, hit-and-run, and attacking police.
- Police respond to every crime straight away. Patrol cars drive like normal traffic until you are wanted, then leave the lanes and chase you. Officers patrol the sidewalks, run towards you when you are wanted, and **start shooting from 2 stars**.
- Lose the police by staying out of their sight for **10 seconds**.
- You are **BUSTED** if they catch you standing still, and **WASTED** when your health runs out. After either, you respawn at the start position.
- Health recovers slowly when nobody is after you.

### Injuries and ambulances
- A pedestrian hit by a car or a bullet is usually only **injured**: they lie on the ground and bleed for about 25 seconds before dying.
- A second hit, or a very fast car, kills instantly.
- An ambulance (up to 3 at a time) is dispatched to every injured person. Two paramedics get out, treat the victim, and the victim gets back up and walks away.
- If the ambulance arrives too late, the person is dead and the paramedics leave.

### Sound
- Engine loop, horn, door, crash and hit sounds, plus a police and ambulance siren.
- Gunshots and sirens are generated in code with the Web Audio API. The other sounds are embedded in `assets/sounds.js` as base64 data, so no audio files are loaded at runtime.

### Interface
- HUD with a health bar, wanted stars, vehicle name and speed, pop-up notifications, and a minimap.
- On-screen touch controls (D-pad, Enter, Horn, Fire) for mobile devices.
- Rendering resolution is adjustable (see [Configuration](#configuration)).

---

## Controls

| Action | Keyboard | Touch |
| --- | --- | --- |
| Move / accelerate / steer | `W` `A` `S` `D` or arrow keys | D-pad |
| Enter / exit a car | `E` | **E** button |
| Horn | `H` | **HORN** button |
| Fire | `SPACE` or `F` (hold to keep shooting) | **FIRE** button (hold) |
| More / fewer traffic cars | – | **+** / **−** buttons |

---

## Getting started

### Requirements
- A modern browser (Chrome, Firefox, Edge, Safari).
- **An internet connection**, because Phaser 3.80.1 is loaded from the jsDelivr CDN in `index.html`.

### Run it
The game has no build step and no dependencies to install.

1. Clone or extract the repository.
2. Open `index.html` in your browser.

Audio is embedded in `assets/sounds.js`, so opening the file directly should work. If your browser blocks anything when loading from `file://`, run a small local server instead:

```bash
# Python
python -m http.server 8000

# or Node.js
npx http-server
```

Then open `http://localhost:8000`.

---

## Project structure

```
.
├── index.html              # Page, HUD, touch controls, script loading order
├── css/
│   └── utility.css         # Layout (4:3 game wrapper), HUD and control styles
├── assets/
│   ├── main.js             # Creates the Phaser game (800×600 view scaled by RES)
│   ├── scenes/
│   │   └── GameScene.js    # Core of the game: player, traffic and pedestrian AI,
│   │                       #   collisions, input, camera, minimap
│   ├── world.js            # World data and constants: roads, buildings, trees,
│   │                       #   car park, traffic-light timing, lane settings
│   ├── visuals.js          # Paints every texture with the Canvas 2D API
│   │                       #   (cars, pedestrians, buildings, trees, blood)
│   ├── vehicles.js         # Vehicle type definitions (size, speed, handling)
│   │                       #   and vehicle drawing
│   ├── police.js           # Wanted level, police cars and officers, bullets
│   │                       #   (extends GameScene)
│   ├── medical.js          # Injuries, ambulances, paramedics (extends GameScene)
│   ├── audio.js            # Web Audio player: samples, gunshots, sirens, engine
│   └── sounds.js           # Embedded base64 sound data used by audio.js
└── sound/                  # Original .wav files (not loaded at runtime, see below)
    ├── crash.wav
    ├── door.wav
    ├── engine.wav
    ├── hit.wav
    └── horn.wav
```

### Script loading order
Scripts are plain `<script>` tags that share global variables (no ES modules, no bundler), so **order matters**:

`world.js` → `visuals.js` → `vehicles.js` → `sounds.js` → `audio.js` → `GameScene.js` → `police.js` → `medical.js` → `main.js`

`police.js` and `medical.js` add methods to `GameScene`, so they must be loaded after `GameScene.js` and before `main.js`.

### About the `sound/` folder
The `.wav` files are the originals of the sounds embedded in `assets/sounds.js`. The game does not load them. To use your own sounds, either replace the matching entry in `sounds.js` with a base64 data URI of your file, or change `audio.js` to fetch from `sound/` (this needs a web server).

---

## Configuration

Useful constants you can change:

| Constant | File | Default | Effect |
| --- | --- | --- | --- |
| `RES` | `assets/visuals.js` | `1.5` | Render and texture resolution. Use `2` for sharper graphics on high-DPI screens, `1` for weak devices. |
| `DRIVE_ON_LEFT` | `assets/world.js` | `true` | `false` for right-hand traffic. |
| `LANE_OFFSET` | `assets/world.js` | `14` | Distance from the road centre line to the centre of a lane. |
| `LIGHT_GREEN`, `LIGHT_YELLOW`, `LIGHT_CLEAR` | `assets/world.js` | `7000`, `1500`, `1000` ms | Traffic-light timing. |
| `SPEED_LIMIT` | `assets/police.js` | `45` km/h | Speed above which driving on a road counts as a crime. |
| `WANTED_STEPS` | `assets/police.js` | `[1, 3, 6, 10, 15]` | Heat needed for 1 to 5 stars. |
| `BLEED_TIME` | `assets/medical.js` | `1500` frames | How long an injured person survives without help (~25 s). |
| `MAX_AMBULANCES` | `assets/medical.js` | `3` | Maximum ambulances on the map. |

---

## Built with

- [Phaser 3](https://phaser.io/) (3.80.1, loaded from CDN) for the game loop, scene, camera and input
- Canvas 2D API: every texture is painted in code, there are no image files
- Web Audio API for sound
- Plain HTML, CSS and JavaScript (no build tools)

---

## License

Released under the [MIT License](LICENSE).
