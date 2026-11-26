# Wargames Office 3D

An interactive Three.js 3D office experience showcasing live, voice-narrated [OverTheWire](https://overthewire.org/) and SmashTheStack wargame solutions inside a realistic modern workstation.

**Live Site:** https://jaher.github.io/wargames-office-3d/

![Wargames Office 3D — Interactive 3D office workstation with Omarchy Linux monitor, Corsair RTX 5090 PC, and 8× NVIDIA DGX Spark cluster](readme-hero.png)

## Features

- **Realistic 3D Office Interior** — Hardwood oak flooring, woven area rug, Uplift V2 walnut desk, Blender-modeled Herman Miller Aeron chair, Keychron Q1 Pro 75% CNC aluminum mechanical keyboard, Logitech MX Master 3S ergonomic mouse, Anglepoise Type 75 desk lamp, organic Fiddle-Leaf Fig & Sansevieria plants, cloth-bound books, pleated linen window curtains, and live physically-based Three.js lighting and soft shadows.
- **Photorealistic Panoramic Window View** — Large walnut-mullioned window overlooking high-resolution photographic metropolitan vistas (San Francisco Bay Bridge Golden Hour, Twilight Harbor Skyline, and Morning Light) mapped onto a curved panoramic cyclorama with switchable live lighting moods (*Golden Hour*, *Twilight City*, *Morning Light*).
- **Corsair 5000D Airflow + RTX 5090 Founders Edition** — Accurate Blender-modeled Corsair 5000D Airflow mid-tower with triangular-perforated front/top mesh, crystal-clear tempered glass side panel, Corsair iCUE LINK LCD liquid cooler, 4× Vengeance DDR5 RGB sticks, and a true 2-slot **NVIDIA GeForce RTX 5090 Founders Edition** clearly labelled inside the chassis.
- **8× NVIDIA DGX Spark Cluster & MikroTik CRS804-4DDQ-hRM** — Positioned right on the desk alongside the monitor: a stack of 8 accurately proportioned (`150 × 150 × 50.5 mm`) champagne-gold anodized **NVIDIA DGX Spark** machines with porous gold metal-foam front/rear grilles and full rear I/O, linked via 4× 400G-to-2×200GbE QSFP-DD breakout DAC cables to a half-width 1U **MikroTik CRS804-4DDQ-hRM** switch with 4× 400G QSFP56-DD cages, 2× 10GbE RJ45, serial console, and live status LEDs.
- **Live Omarchy Linux Monitor** — Dell UltraSharp 34" monitor rendering an authentic **Omarchy Linux** (Arch + Hyprland borderless tiling + Tokyo Night Waybar + Alacritty/Ghostty + `fastfetch` + `btop`) desktop whose terminal updates in real time as you navigate wargames and levels.
- **Synced Voice Narration & Transcript** — Pick any mission and level from the dropdown selectors to replay commands, listen to synchronized voice narration audio, scrub the timeline, and click any transcript line to jump directly to that moment.
- **No Passwords Exposed** — OverTheWire level passwords are never rendered anywhere in the terminal, transcript, or 3D monitor.

## Controls

- **Orbit / Zoom:** Drag to rotate, scroll to zoom.
- **Click to Inspect:** Click the monitor, Corsair RTX 5090 PC, 8× DGX Spark stack, or panoramic window in 3D to glide the camera into position.
- **Camera Presets:** Use the bottom bar or press keys `1`–`5`:
  - `1` — Office overview
  - `2` — Omarchy Linux monitor close-up
  - `3` — Corsair RTX 5090 rig close-up
  - `4` — 8× DGX Spark + MikroTik CRS804 cluster
  - `5` — Panoramic city skyline view
- **Toggle Side Panel:** Press `P` or click **Hide Panel / Show Panel**.
- **Lighting Mood:** Click the sky button in the top-right corner to cycle between *Golden Hour*, *Twilight City*, and *Morning Light*.

## Data Source & Updating the Submodule

All wargame solution data, narration audio (`.mp3`), and sync transcripts (`.sync.json`) are read directly from the [`overthewire-solutions`](https://github.com/jaher/overthewire-solutions) git submodule pinned to its `main` branch.

To clone this repository with the submodule included:

```bash
git clone --recurse-submodules https://github.com/jaher/wargames-office-3d.git
```

To pull the latest OverTheWire solutions and narration updates from the submodule:

```bash
git submodule update --remote
git add overthewire-solutions
git commit -m "Update overthewire-solutions submodule"
git push
```

## Running Locally

This is a static site with no build step (Three.js is loaded via an ES module import map). Serve the repository root with any local HTTP server:

```bash
python3 -m http.server 8000
```

Then open http://localhost:8000 in a WebGL-capable browser.
