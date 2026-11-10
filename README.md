# LuckySpin — Physics-Based Lucky Draw Wheel

**LuckySpin** is a browser-based, physics-driven lucky draw wheel application built with vanilla HTML, CSS, and JavaScript.

> **Purpose:** This project serves primarily as a sample application for demonstrating **Google Agent Skills**—showcasing how AI coding agents use structured skills to design, implement, and ship interactive web applications.

## Features

- **Custom Number Range**: Configure any integer range from `A` to `B` (supports 2 to 200 numbers) or use quick presets (`1 ~ 10`, `1 ~ 20`, `1 ~ 50`, `1 ~ 100`).
- **Physics Damping Presets**: Choose between **Quick Spin** (~4s), **Standard Inertia** (~6.5s), and **High Suspense Glide** (~9.5s).
- **Winner Elimination**: Optional toggle to automatically remove drawn numbers so no number is picked twice, or remove winners manually from the result modal.
- **Live Telemetry & History**: Real-time pointer readout, angular velocity meter (`rad/s`), spin state indicator, and a timestamped draw history panel.
- **Synthesized Audio & Confetti**: Mechanical peg tick sounds and a celebratory win fanfare with confetti burst (with a mute toggle in the header).
- **Keyboard Shortcuts**: Press `Space` to spin the wheel and `Esc` to dismiss the winner modal.

## Implementation Overview

The application is implemented with **zero external runtime dependencies** or build steps:

- **High-DPI HTML5 Canvas Rendering (`app.js`, `index.html`)**:
  - Draws the wheel slices, metallic outer bezel, animated perimeter LEDs, radial number labels, and boundary pegs onto a `devicePixelRatio`-scaled `<canvas>`.
  - Uses a separate full-viewport `<canvas>` overlay for confetti particle physics.
- **Physics Simulation (`app.js`)**:
  - Seeds initial angular velocity using `window.crypto.getRandomValues` (with a `Math.random` fallback).
  - Models wheel deceleration with combined viscous drag and dry Coulomb friction.
  - Simulates the top pointer flapper using a spring-damper system that deflects physically as each peg passes beneath it.
- **Web Audio API Synthesizer (`app.js`)**:
  - Generates peg clicks (frequency-modulated by wheel speed) and a multi-note winning arpeggio purely via `AudioContext` oscillators and gain envelopes—no external audio assets required.
- **Modern Dark Glassmorphic UI (`styles.css`)**:
  - Built with CSS Grid/Flexbox, custom properties, backdrop blur cards, and ambient radial glows.

## Getting Started

Because this is a static web application with no build dependencies, you can run it directly in any modern browser:

1. Clone the repository:
   ```bash
   git clone https://github.com/ericsk/luckydraw.git
   cd luckydraw
   ```
2. Open `index.html` directly in your browser, or serve it with a local static server:
   ```bash
   python3 -m http.server 8080
   ```
   Then visit `http://localhost:8080`.

## Project Structure

```text
.
├── index.html      # Application markup and layout
├── styles.css      # Glassmorphic styling, responsive layout, and animations
├── app.js          # Wheel canvas renderer, physics engine, Web Audio synth, and UI logic
├── LICENSE         # MIT License
└── README.md       # Project documentation
```

## License

This project is licensed under the [MIT License](LICENSE).
