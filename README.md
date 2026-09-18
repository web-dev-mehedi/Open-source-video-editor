# CaptionForge — Open Source Video Editor (NLE 2.0)

<div align="center">

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Status: Under Active Development](https://img.shields.io/badge/Status-Under%20Active%20Development-orange.svg)](https://github.com/web-dev-mehedi/Open-source-video-editor)
[![Electron](https://img.shields.io/badge/Electron-34.x-47848F?logo=electron&logoColor=white)](https://electronjs.org/)
[![React](https://img.shields.io/badge/React-18.x-61DAFB?logo=react&logoColor=black)](https://reactjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Tests](https://img.shields.io/badge/Tests-155%20Passing-brightgreen.svg)](https://vitest.dev/)

**A modern, desktop-first, non-linear video editor (NLE) built for creators, educators, and storytellers.**  
*Free, privacy-respecting, offline-capable, and forever open-source.*

[Explore Features](#-key-features) • [Current Status](#-project-status--active-roadmap) • [Getting Started](#-getting-started) • [Tech Stack](#-architecture--tech-stack) • [Contributing](#-contributing)

</div>

---

> ⚠️ **NOTICE: UNDER ACTIVE DEVELOPMENT**  
> This project is currently in active development. We are actively building, testing, and optimizing core timeline engines, AI media pipelines, and rendering workflows. Features and APIs may evolve rapidly as we approach our first public release milestone.

---

## 🎬 About CaptionForge

**CaptionForge** is designed as a next-generation desktop Non-Linear Editor (NLE 2.0). 

Modern creators rely heavily on fast-paced, multi-layer video workflows with kinetic captions, visual effects, and audio stems. However, existing tools often lock users into expensive recurring subscriptions, force cloud uploads that compromise privacy, or restrict basic features behind artificial paywalls.

CaptionForge delivers a **fully local, open-source alternative** to tools like CapCut and Premiere Pro — running directly on your machine with offline-first media processing.

---

## ✨ Key Features

### 🎞️ Multi-Track NLE Timeline
- **Hierarchical Tracks**: Dedicated tracks for Main Video (V1), Overlay B-Roll (V2), Background Music & Sound Effects (A1, A2), Dynamic Captions, and Effects.
- **Precision Trimming & Snapping**: Non-destructive ripple edit, slip/slide, multi-clip selection, razor split, and magnetic playhead alignment.
- **Keyframe Engine**: Smooth Bezier and linear curve interpolation for position, scale, rotation, and opacity.
- **Interactive Drag & Drop**: Fluid asset placement directly from the file explorer or footage pool onto any track.

### 💬 Kinetic Captions & Subtitle Studio
- **Word-Level Highlighting**: Karaoke-style word tracking with synchronized scale and color pops.
- **Rich Style Presets**: 30+ pre-engineered typography presets inspired by top digital creators.
- **Export Standards**: Dual export support for styled ASS, standard SRT, and WebVTT subtitles.

### 🧠 Local & Offline AI Media Processing
- **Smart Background Removal**: 100% client-side foreground subject extraction and matting without sending private video to external servers.
- **Text Behind Subject**: Automatically sandwiches animated captions and graphic overlays behind the speaker with real-time viewport compositing.
- **Local Vocal Stem Separation**: In-memory center-channel phase cancellation isolating dialogue vocals from background music stems.
- **Adaptive Spectral Denoise**: Real-time noise floor estimation and speech-formant preservation to remove hums, hiss, and room reverberation.

### 🎨 Color, Shaders & Visual FX
- **Parametric Color Grading**: Real-time exposure, contrast, temperature, tint, vibrance, and saturation adjustments.
- **Transition Library**: Smooth crossfades, luma wipes, directional zooms, glitch, and whip pans.
- **Shader Effects**: Real-time canvas filters and WebGL visual effects.

### ⚡ Performance & Export Engine
- **Hardware Acceleration**: WebCodecs and multi-threaded FFmpeg pipelines.
- **Pro Export Control**: Custom resolution, frame rate, CRF bitrate targets, and audio mixdown controls.

---

## 🚧 Project Status & Active Roadmap

We are continuously working to bring CaptionForge to a stable v1.0 release:

| Area | Milestone / Feature | Status |
| :--- | :--- | :---: |
| **Timeline Core** | Multi-track audio/video/caption sequencing | ✅ Implemented |
| **Editing Tools** | Split, trim, speed ramp, keyframe transforms | ✅ Implemented |
| **Captions** | Word-level timing, styling presets, subtitle import/export | ✅ Implemented |
| **Audio Suite** | Local vocal isolation, denoise, parametric EQ | ✅ Implemented |
| **AI Matting** | Offline background removal & text behind subject | ✅ Implemented |
| **Export** | WebCodecs + FFmpeg hardware rendering | ✅ Implemented |
| **Testing** | 155+ unit & integration test coverage | ✅ Active (100% Pass) |
| **UI Polish** | Responsive inspector panels & theme refinement | 🔄 In Progress |
| **Multi-Platform** | Cross-platform builds (Windows, macOS, Linux) | 🔄 In Progress |
| **Plugin API** | Community effect & transition extensions | 📋 Planned |

---

## 🛠️ Architecture & Tech Stack

```
CaptionForge/
├── electron/               # Electron main process, IPC services & FFmpeg bridge
│   ├── services/           # Native SQLite, storage, and media transcoding services
│   └── main.ts             # Application lifecycle, window management, custom protocols
├── src/
│   ├── components/         # React 18 modular UI components
│   │   ├── timeline/       # Multi-track NLE canvas & interaction layer
│   │   ├── player/         # 60fps real-time viewport & canvas compositor
│   │   ├── inspector/      # Clip, audio, keyframe, and caption inspectors
│   │   └── editor/         # Media pool, effects library, transition panels
│   ├── services/           # Background media processing, audio DSP, and export
│   ├── utils/              # Math engines, keyframing, shaders, and subtitle parsers
│   └── context/            # Centralized project state, history & undo/redo stack
```

- **Frontend**: React 18, TypeScript, Tailwind CSS, Lucide Icons
- **Desktop Runtime**: Electron 34, Node.js
- **Media & DSP**: HTML5 Canvas, Web Audio API, WebCodecs, FFmpeg
- **Build System**: Vite 6, `vite-plugin-electron`
- **Testing**: Vitest (14 test suites, 155 automated tests)

---

## 🚀 Getting Started

### Prerequisites
- [Node.js](https://nodejs.org/) (version 18.0 or higher recommended)
- [npm](https://www.npmjs.com/) or [pnpm](https://pnpm.io/)
- [Git](https://git-scm.com/)

### Installation

1. **Clone the repository**:
   ```bash
   git clone https://github.com/web-dev-mehedi/Open-source-video-editor.git
   cd Open-source-video-editor
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Launch in development mode**:
   ```bash
   npm run dev
   ```

4. **Run the test suite**:
   ```bash
   npm test
   ```

5. **Build production binaries**:
   ```bash
   npm run build
   ```

---

## 🤝 Contributing

Contributions, issues, and feature requests are very welcome!

Since the project is in active development:
1. Check the [Issues tab](https://github.com/web-dev-mehedi/Open-source-video-editor/issues) to see ongoing discussions or report bugs.
2. Fork the repository and create a feature branch (`git checkout -b feature/amazing-feature`).
3. Commit your changes with clear messages (`git commit -m 'Add amazing feature'`).
4. Ensure all tests pass (`npm test` & `npx tsc --noEmit`).
5. Open a Pull Request.

---

## 📜 License

Distributed under the **MIT License**. See [`LICENSE`](LICENSE) for more information.

---

<div align="center">
  <sub>Built with ❤️ by Mehedi and the open-source community.</sub>
</div>
