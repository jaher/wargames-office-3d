# Wargames Office 3D

An interactive Three.js 3D office experience showcasing live, voice-narrated [OverTheWire](https://overthewire.org/) and SmashTheStack wargame solutions inside a realistic modern workstation.

**Live Site:** https://jaher.github.io/wargames-office-3d/

## Features

- **Realistic 3D Office Interior** — Hardwood oak flooring, plush geometric area rug, walnut executive desk, ergonomic mesh chair, bookshelves packed with books & decor, indoor plants, warm architectural lighting, soft shadows, and drifting dust motes.
- **Panoramic Skyline Window View** — Large architectural window overlooking a layered 3D city skyline, reflective bay, atmospheric sky shader, glowing sun, drifting clouds, and switchable sky moods (*Golden Hour*, *Clear Day*, *Sunset Dusk*).
- **Corsair RTX 5090 Workstation** — Desk-mounted Corsair airflow tower with a clear tempered glass side panel, animated spinning RGB fans, AIO liquid cooler, DDR5 RGB memory, and a visible flagship **RTX 5090** GPU clearly labelled inside the chassis.
- **8× DGX Spark Cluster & MikroTik CRS804** — Side credenza housing a stack of 8 compact matte-black **DGX Spark** units with pulsing status LEDs connected via curved network patch cables to a **MikroTik CRS804** switch with blinking link/activity LEDs.
- **Live Omarchy Linux Monitor** — The 3D monitor renders a live Omarchy Linux (Hyprland + Waybar + Ghostty) desktop whose terminal updates in real time as you navigate wargames and levels.
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
- **Lighting Mood:** Click the sky button in the top-right corner to cycle between *Golden Hour*, *Clear Day*, and *Sunset Dusk*.

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
