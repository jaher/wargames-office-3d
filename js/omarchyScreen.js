import * as THREE from 'three';

// Renders an authentic Omarchy Linux desktop (basecamp/omarchy: Arch Linux + Hyprland +
// minimalist Waybar + Alacritty/Ghostty + fastfetch + dense btop++ TUI, Tokyo Night theme)
// onto a razor-sharp 21:9 ultrawide 2560x1080 CanvasTexture matching the 34" Dell U3425WE.
export class OmarchyScreen {
  constructor() {
    this.scale = 1.2;
    this.width = 2560;
    this.height = 1080;
    this.canvas = document.createElement('canvas');
    this.canvas.width = Math.round(this.width * this.scale);
    this.canvas.height = Math.round(this.height * this.scale);
    this.ctx = this.canvas.getContext('2d');
    this.ctx.setTransform(this.scale, 0, 0, this.scale, 0, 0);

    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.colorSpace = THREE.SRGBColorSpace;
    this.texture.anisotropy = 16;
    this.texture.minFilter = THREE.LinearMipmapLinearFilter;
    this.texture.magFilter = THREE.LinearFilter;

    this.state = {
      header: 'BANDIT — LEVEL 0',
      host: 'bandit0@bandit.labs.overthewire.org',
      goal: 'Loading OverTheWire solutions…',
      lines: [{ kind: 'note', text: 'Booting Omarchy Linux (Hyprland / Wayland)…' }],
      vim: null,
      activeNarrSeg: -1,
      narrating: false,
      narrCaption: '',
    };

    this._lastDraw = 0;
    this._dirty = true;
    this.render(0);
  }

  update(state) {
    this.state = state;
    this._dirty = true;
  }

  tick(elapsed) {
    if (this._dirty || elapsed - this._lastDraw > 0.35) {
      this.render(elapsed);
      this._lastDraw = elapsed;
      this._dirty = false;
    }
  }

  _wrapText(ctx, text, maxWidth) {
    const clean = String(text || '').replace(/\r/g, '');
    const out = [];
    for (const para of clean.split('\n')) {
      if (!para) {
        out.push('');
        continue;
      }
      if (ctx.measureText(para).width <= maxWidth) {
        out.push(para);
        continue;
      }
      let cur = '';
      for (let i = 0; i < para.length; i++) {
        const ch = para[i];
        if (ctx.measureText(cur + ch).width > maxWidth && cur.length > 0) {
          out.push(cur);
          cur = ch;
        } else {
          cur += ch;
        }
      }
      if (cur) out.push(cur);
    }
    return out;
  }

  _drawWaybarIcon(ctx, type, x, y, color) {
    ctx.save();
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = 2;
    if (type === 'cpu') {
      ctx.strokeRect(x, y - 9, 14, 14);
      ctx.fillRect(x + 4, y - 5, 6, 6);
    } else if (type === 'mem') {
      ctx.strokeRect(x, y - 8, 16, 11);
      ctx.fillRect(x + 3, y - 5, 3, 5);
      ctx.fillRect(x + 10, y - 5, 3, 5);
    } else if (type === 'net') {
      ctx.beginPath();
      ctx.moveTo(x, y + 4);
      ctx.lineTo(x + 5, y - 6);
      ctx.lineTo(x + 10, y + 4);
      ctx.moveTo(x + 10, y - 6);
      ctx.lineTo(x + 14, y + 4);
      ctx.stroke();
    } else if (type === 'vol') {
      ctx.beginPath();
      ctx.moveTo(x, y - 3);
      ctx.lineTo(x + 4, y - 3);
      ctx.lineTo(x + 9, y - 8);
      ctx.lineTo(x + 9, y + 6);
      ctx.lineTo(x + 4, y + 1);
      ctx.lineTo(x, y + 1);
      ctx.closePath();
      ctx.fill();
      ctx.beginPath();
      ctx.arc(x + 11, y - 1, 5, -0.7, 0.7);
      ctx.stroke();
    } else if (type === 'bt') {
      ctx.beginPath();
      ctx.moveTo(x + 5, y - 9);
      ctx.lineTo(x + 5, y + 7);
      ctx.lineTo(x + 10, y + 3);
      ctx.lineTo(x + 1, y - 5);
      ctx.moveTo(x + 1, y + 3);
      ctx.lineTo(x + 10, y - 5);
      ctx.lineTo(x + 5, y - 9);
      ctx.stroke();
    }
    ctx.restore();
  }

  render(elapsed) {
    const ctx = this.ctx;
    const W = this.width;
    const H = this.height;

    const TN = {
      bg: '#1a1b26',
      bgDark: '#16161e',
      bgFloat: '#1f2335',
      fg: '#c0caf5',
      fgBright: '#e2e8ff',
      comment: '#565f89',
      gutter: '#3b4261',
      blue: '#7aa2f7',
      cyan: '#7dcfff',
      teal: '#73daca',
      purple: '#bb9af7',
      green: '#9ece6a',
      amber: '#e0af68',
      red: '#f7768e',
    };

    // 1. Recognizable Tokyo Night Mountain & Twilight Horizon Wallpaper (clearly visible in Hyprland gaps!)
    const wp = ctx.createLinearGradient(0, 0, 0, H);
    wp.addColorStop(0.0, '#0f1224');
    wp.addColorStop(0.32, '#1d244b');
    wp.addColorStop(0.62, '#3d3069');
    wp.addColorStop(0.84, '#6d447b');
    wp.addColorStop(1.0, '#171929');
    ctx.fillStyle = wp;
    ctx.fillRect(0, 0, W, H);

    // Subtle crisp starlight dots in upper Tokyo Night sky visible around top gaps
    ctx.fillStyle = 'rgba(220, 232, 255, 0.55)';
    for (let i = 0; i < 60; i++) {
      const sx = ((i * 397) % W);
      const sy = 50 + ((i * 193) % (H * 0.45));
      ctx.fillRect(sx, sy, 2, 2);
    }

    // Glowing Tokyo Night sunset/neon moon aurora behind mountain ridge
    const moon = ctx.createRadialGradient(W * 0.66, H * 0.44, 18, W * 0.66, H * 0.44, 680);
    moon.addColorStop(0, 'rgba(247, 118, 142, 0.52)');
    moon.addColorStop(0.26, 'rgba(187, 154, 247, 0.42)');
    moon.addColorStop(0.55, 'rgba(122, 162, 247, 0.24)');
    moon.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = moon;
    ctx.fillRect(0, 0, W, H);

    // Layered Mt. Fuji + distant violet ridges + neon horizon mist
    ctx.fillStyle = 'rgba(34, 38, 68, 0.85)';
    ctx.beginPath();
    ctx.moveTo(0, H);
    ctx.lineTo(0, H * 0.58);
    ctx.lineTo(W * 0.16, H * 0.42);
    ctx.lineTo(W * 0.34, H * 0.60);
    ctx.lineTo(W * 0.66, H * 0.32);
    ctx.lineTo(W * 0.84, H * 0.54);
    ctx.lineTo(W, H * 0.44);
    ctx.lineTo(W, H);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = 'rgba(18, 20, 36, 0.92)';
    ctx.beginPath();
    ctx.moveTo(0, H);
    ctx.lineTo(0, H * 0.72);
    ctx.lineTo(W * 0.28, H * 0.58);
    ctx.lineTo(W * 0.52, H * 0.74);
    ctx.lineTo(W * 0.78, H * 0.54);
    ctx.lineTo(W, H * 0.68);
    ctx.lineTo(W, H);
    ctx.closePath();
    ctx.fill();

    // 2. Authentic Minimal Omarchy Waybar Top Bar
    const barH = 42;
    ctx.fillStyle = 'rgba(26, 27, 38, 0.90)';
    ctx.fillRect(0, 0, W, barH);
    ctx.fillStyle = 'rgba(122, 162, 247, 0.32)';
    ctx.fillRect(0, barH - 2, W, 2);

    // Left: Omarchy arch/chevron glyph + minimal Hyprland workspaces (1..5)
    ctx.fillStyle = TN.blue;
    ctx.beginPath();
    ctx.moveTo(26, 30);
    ctx.lineTo(36, 10);
    ctx.lineTo(46, 30);
    ctx.lineTo(41, 30);
    ctx.lineTo(36, 20);
    ctx.lineTo(31, 30);
    ctx.closePath();
    ctx.fill();

    for (let i = 1; i <= 5; i++) {
      const wx = 74 + (i - 1) * 40;
      const isAct = i === 1;
      if (isAct) {
        ctx.fillStyle = 'rgba(122, 162, 247, 0.24)';
        ctx.beginPath();
        ctx.roundRect(wx, 7, 32, 28, 6);
        ctx.fill();
      }
      ctx.fillStyle = isAct ? TN.blue : TN.comment;
      ctx.font = '700 18px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      ctx.fillText(String(i), wx + 16, 27);
    }
    ctx.textAlign = 'left';

    // Center: Waybar Clock
    const now = new Date();
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const hh = String(now.getHours()).padStart(2, '0');
    const mm = String(now.getMinutes()).padStart(2, '0');
    ctx.fillStyle = TN.fgBright;
    ctx.font = '600 18px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    ctx.fillText(`${days[now.getDay()]}  ${hh}:${mm}`, W * 0.5, 28);
    ctx.textAlign = 'left';

    // Right: Minimalist Omarchy Waybar icon strip
    const sysItems = [
      { icon: 'cpu', text: '14%', col: TN.blue },
      { icon: 'mem', text: '18G', col: TN.purple },
      { icon: 'net', text: '200G', col: TN.cyan },
      { icon: 'vol', text: this.state.narrating ? 'LIVE' : '78%', col: this.state.narrating ? TN.teal : TN.fg },
      { icon: 'bt', text: '', col: TN.blue },
    ];
    let rx = W - 28;
    ctx.font = '600 17px "JetBrains Mono", monospace';
    for (let i = sysItems.length - 1; i >= 0; i--) {
      const it = sysItems[i];
      const tw = it.text ? ctx.measureText(it.text).width + 6 : 0;
      const itemW = 20 + tw;
      rx -= itemW;
      this._drawWaybarIcon(ctx, it.icon, rx, 23, it.col);
      if (it.text) {
        ctx.fillStyle = it.col;
        ctx.fillText(it.text, rx + 22, 27);
      }
      rx -= 24;
    }

    // 3. Authentic 21:9 Hyprland Borderless Tiled Layout (generous 24px gaps showing Tokyo Night wallpaper!)
    const gap = 24;
    const topY = barH + gap;
    const availH = H - topY - gap;
    const leftW = Math.floor((W - gap * 3) * 0.63);
    const rightX = gap * 2 + leftW;
    const rightW = W - rightX - gap;

    // --- Left Active Hyprland Tile: Borderless Ghostty / Alacritty Terminal ---
    ctx.save();
    ctx.fillStyle = 'rgba(22, 22, 30, 0.90)';
    ctx.beginPath();
    ctx.roundRect(gap, topY, leftW, availH, 10);
    ctx.fill();

    const actBorder = ctx.createLinearGradient(gap, topY, gap + leftW, topY + availH);
    actBorder.addColorStop(0, TN.blue);
    actBorder.addColorStop(0.5, TN.cyan);
    actBorder.addColorStop(1, TN.purple);
    ctx.strokeStyle = actBorder;
    ctx.lineWidth = 3;
    ctx.stroke();

    // Tmux status header strip
    const hdrH = 38;
    ctx.fillStyle = 'rgba(31, 35, 53, 0.94)';
    ctx.beginPath();
    ctx.roundRect(gap + 2, topY + 2, leftW - 4, hdrH, [8, 8, 0, 0]);
    ctx.fill();

    ctx.fillStyle = TN.blue;
    ctx.font = '700 18px "JetBrains Mono", monospace';
    ctx.fillText(`[0] ${this.state.header}`, gap + 20, topY + 26);
    ctx.fillStyle = TN.comment;
    ctx.font = '500 17px "JetBrains Mono", monospace';
    ctx.textAlign = 'right';
    ctx.fillText(`ssh ${this.state.host}`, gap + leftW - 22, topY + 26);
    ctx.textAlign = 'left';

    const innerX = gap + 26;
    const innerY = topY + hdrH + 14;
    const innerW = leftW - 52;
    const innerH = availH - hdrH - 28;
    ctx.beginPath();
    ctx.rect(innerX - 8, innerY - 6, innerW + 16, innerH + 12);
    ctx.clip();

    const lineH = 33;
    ctx.font = '500 22px "JetBrains Mono", Consolas, monospace';

    if (this.state.vim) {
      this._renderVimOnCanvas(ctx, this.state.vim, innerX, innerY, innerW, innerH, elapsed, TN);
    } else {
      const renderRows = [];
      for (const item of (this.state.lines || [])) {
        const hl =
          this.state.activeNarrSeg >= 0 &&
          Array.isArray(item.segs) &&
          item.segs.includes(this.state.activeNarrSeg);

        if (item.kind === 'cmd') {
          const full = `${item.prompt || ''}${item.text || ''}`;
          const wrapped = this._wrapText(ctx, full, innerW - 16);
          wrapped.forEach((w, wi) => {
            renderRows.push({
              kind: 'cmd',
              promptLen: wi === 0 ? (item.prompt || '').length : 0,
              text: w,
              typing: item.typing && wi === wrapped.length - 1,
              hl,
            });
          });
        } else {
          const wrapped = this._wrapText(ctx, item.text || '', innerW - 20);
          wrapped.forEach((w) => {
            renderRows.push({ kind: item.kind, text: w, hl });
          });
        }
      }

      const maxVisible = Math.max(1, Math.floor(innerH / lineH) - 1);
      const slice = renderRows.slice(-maxVisible);
      let y = innerY + 26;

      for (const row of slice) {
        if (row.hl) {
          ctx.fillStyle = 'rgba(115, 218, 202, 0.16)';
          ctx.fillRect(innerX - 8, y - 24, innerW + 16, lineH);
          ctx.fillStyle = TN.teal;
          ctx.fillRect(innerX - 8, y - 24, 4, lineH);
        }

        if (row.kind === 'goal') {
          ctx.fillStyle = 'rgba(122, 162, 247, 0.12)';
          ctx.fillRect(innerX - 6, y - 24, innerW + 12, lineH);
          ctx.fillStyle = TN.fgBright;
          ctx.fillText(row.text, innerX + 6, y);
        } else if (row.kind === 'cmd') {
          const pPart = row.text.slice(0, row.promptLen);
          const cPart = row.text.slice(row.promptLen);
          let cx = innerX;
          if (pPart) {
            ctx.fillStyle = TN.cyan;
            ctx.fillText(pPart, cx, y);
            cx += ctx.measureText(pPart).width;
          }
          ctx.fillStyle = '#ffffff';
          ctx.fillText(cPart, cx, y);
          cx += ctx.measureText(cPart).width;
          if (row.typing && Math.floor(elapsed * 2.2) % 2 === 0) {
            ctx.fillStyle = TN.blue;
            ctx.fillRect(cx + 3, y - 21, 13, 25);
          }
        } else if (row.kind === 'note') {
          ctx.fillStyle = TN.purple;
          ctx.fillText(row.text, innerX, y);
        } else if (row.kind === 'pw') {
          ctx.fillStyle = TN.amber;
          ctx.fillText(row.text, innerX, y);
        } else {
          if (row.text.includes('[REDACTED]')) {
            const parts = row.text.split('[REDACTED]');
            let cx = innerX;
            parts.forEach((part, pi) => {
              ctx.fillStyle = TN.green;
              ctx.fillText(part, cx, y);
              cx += ctx.measureText(part).width;
              if (pi < parts.length - 1) {
                ctx.fillStyle = TN.amber;
                ctx.fillText('[REDACTED]', cx, y);
                cx += ctx.measureText('[REDACTED]').width;
              }
            });
          } else {
            ctx.fillStyle = TN.green;
            ctx.fillText(row.text, innerX, y);
          }
        }
        y += lineH;
      }

      if (!slice.some((r) => r.typing)) {
        const promptStr = `${(this.state.host || 'bandit0@bandit').split('.')[0]}:~$ `;
        const py = Math.min(y + 4, innerY + innerH - 10);
        ctx.fillStyle = TN.cyan;
        ctx.fillText(promptStr, innerX, py);
        if (Math.floor(elapsed * 2) % 2 === 0) {
          const pw = ctx.measureText(promptStr).width;
          ctx.fillStyle = TN.blue;
          ctx.fillRect(innerX + pw + 2, py - 21, 13, 25);
        }
      }
    }
    ctx.restore();

    // --- Right Hyprland Split Tiles (Crisp, Balanced, Zero Blank Voids!) ---
    const topTileH = Math.floor(availH * 0.43);
    const botTileY = topY + topTileH + gap;
    const botTileH = availH - topTileH - gap;

    // Tile 1: Crisp High-Contrast Omarchy `fastfetch`
    ctx.save();
    ctx.fillStyle = 'rgba(26, 27, 38, 0.90)';
    ctx.beginPath();
    ctx.roundRect(rightX, topY, rightW, topTileH, 10);
    ctx.fill();
    ctx.strokeStyle = TN.gutter;
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.fillStyle = TN.cyan;
    ctx.font = '700 18px "JetBrains Mono", monospace';
    ctx.fillText('❯ fastfetch', rightX + 22, topY + 34);

    const archArt = [
      '      /\\      ',
      '     /  \\     ',
      '    /\\   \\    ',
      '   /  ..  \\   ',
      '  /  \'  \'  \\  ',
      ' /_.\'    \'._\\ ',
    ];
    ctx.fillStyle = TN.blue;
    ctx.font = '700 17px "JetBrains Mono", monospace';
    archArt.forEach((ln, idx) => {
      ctx.fillText(ln, rightX + 20, topY + 72 + idx * 21);
    });

    ctx.fillStyle = TN.purple;
    ctx.font = '700 22px "JetBrains Mono", monospace';
    ctx.fillText('omarchy@workstation', rightX + 195, topY + 78);
    ctx.fillStyle = TN.comment;
    ctx.font = '500 16px "JetBrains Mono", monospace';
    ctx.fillText('──────────────────────────', rightX + 195, topY + 100);
    ctx.fillStyle = TN.teal;
    ctx.font = '700 18px "JetBrains Mono", monospace';
    ctx.fillText('Arch Linux · Hyprland 0.48', rightX + 195, topY + 126);
    ctx.fillStyle = TN.fgBright;
    ctx.fillText('Theme: Tokyo Night · Ghostty', rightX + 195, topY + 152);
    ctx.fillStyle = TN.green;
    ctx.fillText('Kernel: 6.14.2-arch1-1', rightX + 195, topY + 178);

    const specs = [
      ['WM', 'Hyprland (Wayland)'],
      ['GPU', 'NVIDIA GeForce RTX 5090 FE 32GB'],
      ['NODES', '8× NVIDIA DGX Spark (1.6 TB)'],
      ['FABRIC', 'MikroTik CRS804 400G QSFP56-DD'],
    ];
    let sy = topY + 234;
    for (const [k, v] of specs) {
      ctx.fillStyle = TN.blue;
      ctx.font = '700 19px "JetBrains Mono", monospace';
      ctx.fillText(k.padEnd(7, ' '), rightX + 24, sy);
      ctx.fillStyle = TN.fgBright;
      ctx.font = '600 19px "JetBrains Mono", monospace';
      ctx.fillText(v, rightX + 126, sy);
      sy += 34;
    }

    const swatches = [TN.red, TN.green, TN.amber, TN.blue, TN.purple, TN.cyan, TN.teal, TN.fg];
    swatches.forEach((col, i) => {
      ctx.fillStyle = col;
      ctx.fillRect(rightX + 24 + i * 44, topY + topTileH - 36, 36, 16);
    });
    ctx.restore();

    // Tile 2: Authentic Dense `btop++` System, Cluster, Network & Process TUI + Compact Mission Footer
    ctx.save();
    ctx.fillStyle = 'rgba(22, 22, 30, 0.90)';
    ctx.beginPath();
    ctx.roundRect(rightX, botTileY, rightW, botTileH, 10);
    ctx.fill();
    ctx.strokeStyle = this.state.narrating ? TN.teal : TN.gutter;
    ctx.lineWidth = 2;
    ctx.stroke();

    const bx = rightX + 20;
    const bw = rightW - 40;

    ctx.fillStyle = TN.purple;
    ctx.font = '700 17px "JetBrains Mono", monospace';
    ctx.fillText('┌─ btop++ · system, 400G fabric & processes ──────────────', bx, botTileY + 28);

    // 1. CPU & GPU Wave Graph
    const cpuY = botTileY + 42;
    const cpuH = 114;
    ctx.strokeStyle = TN.blue;
    ctx.lineWidth = 1.5;
    ctx.strokeRect(bx, cpuY, bw, cpuH);
    ctx.fillStyle = TN.bgDark;
    ctx.fillRect(bx + 10, cpuY - 10, 315, 18);
    ctx.fillStyle = TN.cyan;
    ctx.font = '700 15px "JetBrains Mono", monospace';
    ctx.fillText('CPU 14.2% · RTX 5090 36°C · 42W', bx + 16, cpuY + 4);

    const bars = 36;
    const barStep = (bw - 24) / bars;
    for (let i = 0; i < bars; i++) {
      const h1 = 14 + Math.abs(Math.sin(elapsed * 1.6 + i * 0.38)) * 52;
      const h2 = 8 + Math.abs(Math.cos(elapsed * 1.1 + i * 0.27)) * 30;
      ctx.fillStyle = 'rgba(122, 162, 247, 0.80)';
      ctx.fillRect(bx + 12 + i * barStep, cpuY + cpuH - 10 - h1, barStep - 4, h1);
      ctx.fillStyle = 'rgba(115, 218, 202, 0.74)';
      ctx.fillRect(bx + 12 + i * barStep, cpuY + cpuH - 10 - h2, barStep - 4, h2);
    }

    // 2. Memory, VRAM & 8x DGX Spark Cluster Fabric
    const memY = cpuY + cpuH + 16;
    const memH = 122;
    ctx.strokeStyle = TN.purple;
    ctx.strokeRect(bx, memY, bw, memH);
    ctx.fillStyle = TN.bgDark;
    ctx.fillRect(bx + 10, memY - 10, 340, 18);
    ctx.fillStyle = TN.purple;
    ctx.fillText('MEM · VRAM · 8× DGX SPARK · CRS804', bx + 16, memY + 4);

    const meters = [
      ['RAM   18.4 / 128 GiB', 0.24, TN.green],
      ['VRAM  11.2 /  32 GiB', 0.36, TN.cyan],
      ['DGX   8/8 ONLINE 200G', 0.88, TN.amber],
    ];
    meters.forEach(([lbl, pct, col], idx) => {
      const my = memY + 34 + idx * 32;
      ctx.fillStyle = TN.fgBright;
      ctx.font = '700 17px "JetBrains Mono", monospace';
      ctx.fillText(lbl, bx + 14, my);
      const gx = bx + 275;
      const gw = bw - 290;
      ctx.fillStyle = '#24283b';
      ctx.fillRect(gx, my - 13, gw, 15);
      ctx.fillStyle = col;
      ctx.fillRect(gx, my - 13, Math.max(8, gw * pct), 15);
    });

    // 3. Dense btop++ Active Processes + 400G Fabric Telemetry Table (eliminates empty void!)
    const procY = memY + memH + 16;
    const procH = 136;
    ctx.strokeStyle = TN.teal;
    ctx.strokeRect(bx, procY, bw, procH);
    ctx.fillStyle = TN.bgDark;
    ctx.fillRect(bx + 10, procY - 10, 310, 18);
    ctx.fillStyle = TN.teal;
    ctx.font = '700 16px "JetBrains Mono", monospace';
    ctx.fillText('PROC · NET 200GbE (enp4s0)', bx + 16, procY + 4);

    const procs = [
      ['PID    COMMAND               MEM     CPU%', TN.comment],
      ['1042   hyprland --wayland    412M    2.1%', TN.fgBright],
      ['1188   ghostty -e tmux       196M    0.8%', TN.cyan],
      ['2401   ssh bandit0@otw        24M    0.2%', TN.green],
      ['3110   dgx-spark-mesh-rdma  4.8G    9.4%', TN.amber],
    ];
    procs.forEach(([txt, col], idx) => {
      ctx.fillStyle = col;
      ctx.font = idx === 0 ? '700 15px "JetBrains Mono", monospace' : '600 16px "JetBrains Mono", monospace';
      ctx.fillText(txt, bx + 14, procY + 28 + idx * 24);
    });

    // 4. Compact Mission / Live Narration Footer Box
    const footY = procY + procH + 14;
    const footH = Math.max(54, botTileY + botTileH - footY - 14);
    ctx.strokeStyle = this.state.narrating ? TN.teal : TN.amber;
    ctx.strokeRect(bx, footY, bw, footH);
    ctx.fillStyle = TN.bgDark;
    ctx.fillRect(bx + 10, footY - 10, 240, 18);
    ctx.fillStyle = this.state.narrating ? TN.teal : TN.amber;
    ctx.font = '700 15px "JetBrains Mono", monospace';
    ctx.fillText(this.state.narrating ? 'LIVE VOICE NARRATION' : 'MISSION OBJECTIVE', bx + 16, footY + 4);

    ctx.fillStyle = TN.fgBright;
    ctx.font = '600 17px "JetBrains Mono", monospace';
    const captionText = this.state.narrCaption || this.state.goal || 'Select a mission and level to replay.';
    const capLines = this._wrapText(ctx, captionText, bw - 28);
    let cy = footY + 30;
    for (const ln of capLines.slice(0, 2)) {
      if (cy > footY + footH - 8) break;
      ctx.fillText(ln, bx + 14, cy);
      cy += 22;
    }

    ctx.restore();
    this.texture.needsUpdate = true;
  }

  _renderVimOnCanvas(ctx, vim, x, y, w, h, elapsed, TN) {
    ctx.fillStyle = TN.bgDark;
    ctx.fillRect(x - 6, y - 6, w + 12, h + 12);

    const rowH = 33;
    let ry = y + 28;
    ctx.font = '500 22px "JetBrains Mono", monospace';

    for (const r of vim.rows) {
      if (ry > y + h - 78) break;
      if (r.tilde) {
        ctx.fillStyle = TN.gutter;
        ctx.fillText('    ~', x + 8, ry);
      } else {
        ctx.fillStyle = TN.comment;
        ctx.fillText(`${String(r.num).padStart(3, ' ')} `, x + 8, ry);
        ctx.fillStyle = TN.fgBright;
        ctx.fillText(r.text, x + 74, ry);
        if (r.active && Math.floor(elapsed * 3) % 2 === 0) {
          const preW = ctx.measureText(r.text.slice(0, Math.max(0, r.col - 1))).width;
          ctx.fillStyle = TN.blue;
          ctx.fillRect(x + 74 + preW, ry - 20, 13, 25);
        }
      }
      ry += rowH;
    }

    ctx.fillStyle = TN.bgFloat;
    ctx.fillRect(x - 4, y + h - 66, w + 8, 32);
    ctx.fillStyle = TN.blue;
    ctx.fillRect(x - 4, y + h - 66, 98, 32);
    ctx.fillStyle = TN.bgDark;
    ctx.font = '700 17px "JetBrains Mono", monospace';
    ctx.fillText(' NORMAL ', x + 2, y + h - 44);
    ctx.fillStyle = TN.fgBright;
    ctx.fillText(vim.status || vim.file, x + 112, y + h - 44);
    ctx.fillStyle = TN.amber;
    ctx.fillText(vim.mode || '', x + 10, y + h - 10);
  }
}
