#Gangster2D
# 2D Driving & Police Chase Game

A dynamic 2D web-based driving game featuring vehicle control, dynamic game environments, medical emergency mechanics, police chase systems, and immersive audio effects. Built with modular JavaScript modules and HTML5 Canvas.

[![live_demo](https://img.shields.io/badge/live_demo-%23444444.svg?style=plastic&logo=rockstargames&logoColor=FCAF17)](https://0xbabyalien.github.io/Gangster2D/) [![sponsors](https://img.shields.io/badge/sponsors-%23444444.svg?style=plastic&logo=githubsponsors&logoColor=EA4AAA)](https://github.com/sponsors/0xbabyalien) [![paypal](https://img.shields.io/badge/paypal-%23444444.svg?style=plastic&logo=paypal&logoColor=002991)](https://paypal.me/0xbabyalien) [![give_btc](https://img.shields.io/badge/give_btc-%23444444.svg?style=plastic&logo=bitcoin&logoColor=F7931A)](https://pay.blink.sv/0xbabyalien) [![give_coin](https://img.shields.io/badge/give_crypto-%23444444.svg?style=plastic&logo=ethereum&logoColor=F0B90B)](https://link.trustwallet.com/send?coin=20000714&address=0x960fbe9b5c9e9bb514f0eb55ad63c4fd459bf07d&amount=0.003)  
  

---

## 📁 Project Structure

```text
game/
├── index.html            # Main HTML entry point
├── css/
│   └── utility.css       # Utility styles and core layout
├── img/                  # Graphic assets and textures
├── sound/                # Sound effect files
│   ├── crash.wav         # Collision sound
│   ├── door.wav          # Door interaction sound
│   ├── engine.wav        # Engine loop audio
│   ├── hit.wav           # Impact sound
│   └── horn.wav          # Vehicle horn sound
└── assets/               # Core JavaScript logic & modules
    ├── main.js           # Main application entry script
    ├── audio.js          # Audio controller
    ├── sounds.js         # Sound management logic
    ├── visuals.js        # Rendering and visual effects
    ├── world.js          # Environment, map, and terrain logic
    ├── vehicles.js       # Vehicle physics and entities
    ├── police.js         # AI police behavior and pursuit system
    ├── medical.js        # Health, damage, and medical mechanics
    └── scenes/
        └── GameScene.js  # Main gameplay scene manager
```

---

## ✨ Features

- **Vehicle Mechanics:** Realistic movement, engine audio, crash handling, and horn effects.
- **Police Chase AI:** Pursuit logic implemented via `police.js` for dynamic police response.
- **Medical & Damage System:** Health and status tracking managed via `medical.js`.
- **Interactive World:** Custom environment rendering and scene management.
- **Audio Engine:** Comprehensive sound management supporting collision, engine, and horn sound effects.

---

## 🚀 Getting Started

### Prerequisites
To run this project, all you need is a modern web browser (such as Google Chrome, Mozilla Firefox, or Microsoft Edge).

### Installation & Running

1. **Clone or Extract the Project**
   Extract the archive files into your desired project directory.

2. **Serve the Files**
   Because web browsers restrict audio/asset loading from local file paths (`file://`), it is recommended to run a lightweight local HTTP server:

   - **Using Python:**
     ```bash
     cd game
     python -m http.server 8000
     ```
   - **Using Node.js (Live Server / http-server):**
     ```bash
     npx http-server game
     ```

3. **Open in Browser**
   Navigate to `http://localhost:8000` in your web browser.

---

## 🕹️ Controls

- **Drive / Steer:** Arrow Keys or `WASD`
- **Horn:** Dedicated horn key (configured in `GameScene.js`)
- **Interaction:** Key controls mapped for entering/exiting vehicles or medical interactions.

---

## 🛠️ Built With

- **HTML5 Canvas** - Core graphics rendering
- **Vanilla JavaScript (ES6 Modules)** - Modular game logic
- **CSS3** - User interface and canvas layout
- **Web Audio API / WAV Audio** - Interactive sound effects

---

## 📄 License

This project is released under the [MIT License](LICENSE).
