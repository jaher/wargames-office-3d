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
      header: 'OMARCHY WORKSTATION',
      host: 'omarchy@workstation',
      goal: 'Loading OverTheWire solutions…',
      lines: [{ kind: 'note', text: 'Booting Omarchy Linux (Hyprland / Wayland)…' }],
      vim: null,
      lastVim: null,
      promptIdle: false,
      activeNarrSeg: -1,
      narrating: false,
      narrCaption: '',
    };

    this._lastDraw = 0;
    this._lastElapsed = 0;
    this._dirty = true;
    this._nvimScrollTop = 0;
    this._nvimScrollKey = '';
    this.render(0);
  }

  update(state) {
    this.state = {
      ...state,
      lines: Array.isArray(state?.lines) ? [...state.lines] : [],
    };
    this._dirty = true;
  }

  tick(elapsed) {
    this._lastElapsed = elapsed;
    if (this._dirty || elapsed - this._lastDraw > 0.35) {
      this.render(elapsed);
      this._lastDraw = elapsed;
      this._dirty = false;
    }
  }

  _wrapCodeLine(ctx, text, maxWidth) {
    const clean = String(text || '').replace(/\r/g, '');
    if (!clean) return [''];
    if (ctx.measureText(clean).width <= maxWidth) return [clean];
    const charW = Math.max(1, ctx.measureText('M').width);
    const maxCols = Math.max(12, Math.floor(maxWidth / charW));
    const out = [];
    let rest = clean;
    while (rest.length > 0) {
      if (rest.length <= maxCols && ctx.measureText(rest).width <= maxWidth) {
        out.push(rest);
        break;
      }
      // Find largest prefix fitting within maxWidth
      let take = Math.min(rest.length, maxCols);
      while (take > 1 && ctx.measureText(rest.slice(0, take)).width > maxWidth) take--;
      while (take < rest.length && ctx.measureText(rest.slice(0, take + 1)).width <= maxWidth) take++;
      // Prefer breaking on a space within the last 30% of the line when possible
      let cut = take;
      if (take < rest.length) {
        const minBreak = Math.floor(take * 0.65);
        const sp = rest.lastIndexOf(' ', take);
        if (sp >= minBreak) cut = sp + 1;
      }
      out.push(rest.slice(0, cut));
      rest = rest.slice(cut);
    }
    return out.length ? out : [''];
  }

  _wrapText(ctx, text, maxWidth) {
    const clean = String(text || '').replace(/\r/g, '');
    const out = [];
    const charW = Math.max(1, ctx.measureText('M').width);
    const estCols = Math.max(12, Math.floor(maxWidth / charW));
    for (const para of clean.split('\n')) {
      if (!para) {
        out.push('');
        continue;
      }
      if (para.length <= estCols && ctx.measureText(para).width <= maxWidth) {
        out.push(para);
        continue;
      }
      // Fast monospace fallback for very long single lines so huge outputs never stall rendering
      if (para.length > 2000) {
        for (const chunk of this._wrapCodeLine(ctx, para, maxWidth)) out.push(chunk);
        continue;
      }
      // Word-boundary wrapping first (never split ordinary words mid-word!), character fallback only for single long tokens
      const words = para.split(/(\s+)/);
      let cur = '';
      for (const tok of words) {
        if (!tok) continue;
        if (ctx.measureText(cur + tok).width <= maxWidth) {
          cur += tok;
        } else if (cur.trim().length > 0 && tok.trim().length === 0) {
          out.push(cur.trimEnd());
          cur = '';
        } else if (cur.trim().length > 0 && ctx.measureText(tok.trimStart()).width <= maxWidth) {
          out.push(cur.trimEnd());
          cur = tok.trimStart();
        } else {
          // Single unbroken token wider than maxWidth (e.g., long hash/path): wrap cleanly by char
          for (let i = 0; i < tok.length; i++) {
            const ch = tok[i];
            if (ctx.measureText(cur + ch).width > maxWidth && cur.length > 0) {
              out.push(cur);
              cur = ch;
            } else {
              cur += ch;
            }
          }
        }
      }
      if (cur.trimEnd()) out.push(cur.trimEnd());
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

    // 1. Recognizable Tokyo Night Mountain & Twilight Horizon Wallpaper (vividly visible in Hyprland gaps & translucent tiles!)
    const wp = ctx.createLinearGradient(0, 0, 0, H);
    wp.addColorStop(0.0, '#141936');
    wp.addColorStop(0.30, '#2a346b');
    wp.addColorStop(0.60, '#5a3d8c');
    wp.addColorStop(0.84, '#9e5394');
    wp.addColorStop(1.0, '#1d2038');
    ctx.fillStyle = wp;
    ctx.fillRect(0, 0, W, H);

    // Subtle crisp starlight dots in upper Tokyo Night sky visible around top gaps
    ctx.fillStyle = 'rgba(226, 236, 255, 0.72)';
    for (let i = 0; i < 85; i++) {
      const sx = ((i * 397) % W);
      const sy = 48 + ((i * 193) % (H * 0.48));
      ctx.fillRect(sx, sy, 2.5, 2.5);
    }

    // Glowing Tokyo Night neon twilight moon aurora behind mountain ridge
    const moon = ctx.createRadialGradient(W * 0.62, H * 0.42, 24, W * 0.62, H * 0.42, 760);
    moon.addColorStop(0, 'rgba(255, 138, 166, 0.74)');
    moon.addColorStop(0.28, 'rgba(196, 162, 255, 0.56)');
    moon.addColorStop(0.58, 'rgba(122, 162, 247, 0.34)');
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

    // 3. Authentic 21:9 Hyprland Borderless Tiled Layout — Full Omarchy Wargame Terminal + Neovim + Telemetry!
    const gap = 14;
    const topY = barH + gap;
    const availH = H - topY - gap;
    const leftW = Math.floor((W - gap * 3) * 0.72);
    const rightX = gap * 2 + leftW;
    const rightW = W - rightX - gap;

    // --- Left Active Hyprland Tile: Full Ghostty / Tmux Wargame Terminal Replica (Neovim Split + Live Shell!) ---
    ctx.save();
    ctx.fillStyle = 'rgba(22, 22, 30, 0.94)';
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

    // Top Ghostty / Tmux window bar
    const hdrH = 36;
    const tmuxBarH = 34;
    ctx.fillStyle = 'rgba(31, 35, 53, 0.96)';
    ctx.beginPath();
    ctx.roundRect(gap + 2, topY + 2, leftW - 4, hdrH, [8, 8, 0, 0]);
    ctx.fill();

    const hasSplitCode = Boolean(this.state.lastVim && this.state.lastVim.file);
    ctx.fillStyle = TN.blue;
    ctx.font = '700 18px "JetBrains Mono", monospace';
    ctx.fillText(
      hasSplitCode ? `[0] ${this.state.header}  ·  nvim ${this.state.lastVim.file} + zsh` : `[0] ${this.state.header}`,
      gap + 18,
      topY + 24
    );
    ctx.fillStyle = TN.comment;
    ctx.font = '500 17px "JetBrains Mono", monospace';
    ctx.textAlign = 'right';
    ctx.fillText(`ssh ${this.state.host}`, gap + leftW - 18, topY + 24);
    ctx.textAlign = 'left';

    const bodyY = topY + hdrH + 6;
    const bodyH = availH - hdrH - tmuxBarH - 12;

    if (this.state.vim && !hasSplitCode) {
      this._renderVimOnCanvas(ctx, this.state.vim, gap + 18, bodyY, leftW - 36, bodyH, elapsed, TN);
    } else if (hasSplitCode) {
      // Authentic Ultrawide Omarchy Tmux Vertical Split:
      // Left 54%: Full Syntax-Highlighted Neovim Source File (e.g. v0.c)
      // Right 46%: Full Live Wargame Shell Execution, Compilation & Output
      const splitX = gap + Math.floor(leftW * 0.54);
      const nvimX = gap + 16;
      const nvimW = splitX - gap - 26;
      const shX = splitX + 16;
      const shW = gap + leftW - splitX - 28;

      // Crisp tmux vertical pane divider line
      ctx.fillStyle = 'rgba(122, 162, 247, 0.38)';
      ctx.fillRect(splitX, topY + hdrH + 2, 2, availH - hdrH - tmuxBarH - 4);

      this._renderNeovimPane(ctx, this.state.lastVim, this.state.vim, nvimX, bodyY, nvimW, bodyH, elapsed, TN);
      this._renderShellPane(ctx, shX, bodyY, shW, bodyH, elapsed, TN, 21, 30);
    } else {
      // Full-width crisp interactive shell terminal for pure CLI wargame levels
      this._renderShellPane(ctx, gap + 22, bodyY, leftW - 44, bodyH, elapsed, TN, 23, 34);
    }

    // Authentic Bottom Tmux Status Bar across full Ghostty window
    const tmY = topY + availH - tmuxBarH - 2;
    ctx.fillStyle = 'rgba(26, 27, 38, 0.98)';
    ctx.beginPath();
    ctx.roundRect(gap + 2, tmY, leftW - 4, tmuxBarH, [0, 0, 8, 8]);
    ctx.fill();
    ctx.fillStyle = TN.blue;
    ctx.fillRect(gap + 2, tmY, 96, tmuxBarH);
    ctx.fillStyle = TN.bgDark;
    ctx.font = '700 16px "JetBrains Mono", monospace';
    ctx.fillText(' TMUX 0 ', gap + 10, tmY + 22);
    ctx.fillStyle = TN.teal;
    ctx.fillText(hasSplitCode ? ` 0:nvim*  1:zsh  2:otw` : ` 0:zsh*  1:otw  2:btop`, gap + 108, tmY + 22);
    ctx.fillStyle = TN.comment;
    ctx.textAlign = 'right';
    ctx.fillText(`${this.state.host}  │  omarchy@workstation`, gap + leftW - 18, tmY + 22);
    ctx.textAlign = 'left';
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
    ctx.font = '700 15px "JetBrains Mono", monospace';
    archArt.forEach((ln, idx) => {
      ctx.fillText(ln, rightX + 16, topY + 70 + idx * 20);
    });

    ctx.fillStyle = TN.purple;
    ctx.font = '700 20px "JetBrains Mono", monospace';
    ctx.fillText('omarchy@workstation', rightX + 164, topY + 76);
    ctx.fillStyle = TN.comment;
    ctx.font = '500 15px "JetBrains Mono", monospace';
    ctx.fillText('──────────────────────', rightX + 164, topY + 96);
    ctx.fillStyle = TN.teal;
    ctx.font = '700 16px "JetBrains Mono", monospace';
    ctx.fillText('Arch Linux · Hyprland 0.48', rightX + 164, topY + 122);
    ctx.fillStyle = TN.fgBright;
    ctx.fillText('Theme: Tokyo Night · Ghostty', rightX + 164, topY + 146);
    ctx.fillStyle = TN.green;
    ctx.fillText('Kernel: 6.14.2-arch1-1', rightX + 164, topY + 170);

    const specs = [
      ['CPU', 'Intel Core Ultra 9 285K · 96GB'],
      ['GPU', 'NVIDIA RTX 5090 FE 32GB'],
      ['NODES', '6× DGX Spark + 2× GX10'],
      ['FABRIC', 'MikroTik CRS804 400G'],
    ];
    let sy = topY + 230;
    for (const [k, v] of specs) {
      ctx.fillStyle = TN.blue;
      ctx.font = '700 17px "JetBrains Mono", monospace';
      ctx.fillText(k.padEnd(7, ' '), rightX + 20, sy);
      ctx.fillStyle = TN.fgBright;
      ctx.font = '600 17px "JetBrains Mono", monospace';
      ctx.fillText(v, rightX + 112, sy);
      sy += 33;
    }

    const swatches = [TN.red, TN.green, TN.amber, TN.blue, TN.purple, TN.cyan, TN.teal, TN.fg];
    swatches.forEach((col, i) => {
      ctx.fillStyle = col;
      ctx.fillRect(rightX + 24 + i * 44, topY + topTileH - 36, 36, 16);
    });
    ctx.restore();

    // Tile 2: Authentic Dense `btop++` System, Cluster, Network & Process TUI + Compact Mission Footer
    ctx.save();
    ctx.fillStyle = 'rgba(20, 22, 34, 0.82)';
    ctx.beginPath();
    ctx.roundRect(rightX, botTileY, rightW, botTileH, 10);
    ctx.fill();
    ctx.strokeStyle = this.state.narrating ? TN.teal : TN.gutter;
    ctx.lineWidth = 2;
    ctx.stroke();

    const bx = rightX + 20;
    const bw = rightW - 40;

    ctx.fillStyle = TN.purple;
    ctx.font = '700 16px "JetBrains Mono", monospace';
    ctx.fillText('┌─ btop++ · system, 400G fabric & procs ──────────', bx, botTileY + 28);

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
      ['RAM   18.4 /  96 GiB', 0.24, TN.green],
      ['VRAM  11.2 /  32 GiB', 0.36, TN.cyan],
      ['DGX   8/8 ONLINE 200G', 0.88, TN.amber],
    ];
    meters.forEach(([lbl, pct, col], idx) => {
      const my = memY + 34 + idx * 32;
      ctx.fillStyle = TN.fgBright;
      ctx.font = '700 15.5px "JetBrains Mono", monospace';
      ctx.fillText(lbl, bx + 12, my);
      const gx = bx + 245;
      const gw = bw - 258;
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

    const hostRaw = this.state.host || 'omarchy@workstation';
    const [hostUser, hostDomain = 'otw'] = hostRaw.split('@');
    const shortDomain = hostDomain.includes('smashthestack') ? 's2s' : hostDomain.includes('overthewire') ? 'otw' : hostDomain.split('.')[0];
    const sshCmd = `ssh ${hostUser}@${shortDomain}`.slice(0, 19).padEnd(19, ' ');
    const procs = [
      ['PID   COMMAND             MEM    CPU%', TN.comment],
      ['1042  hyprland --wayland  412M   2.1%', TN.fgBright],
      ['1188  ghostty -e tmux     196M   0.8%', TN.cyan],
      [`2401  ${sshCmd}  24M   0.2%`, TN.green],
      ['3110  dgx-spark-rdma      4.8G   9.4%', TN.amber],
    ];
    procs.forEach(([txt, col], idx) => {
      ctx.fillStyle = col;
      ctx.font = idx === 0 ? '700 14px "JetBrains Mono", monospace' : '600 15px "JetBrains Mono", monospace';
      ctx.fillText(txt, bx + 12, procY + 28 + idx * 24);
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
    const fallbackObjective = this.state.header
      ? `${this.state.header}${this.state.host ? ` · ${this.state.host}` : ''}`
      : 'Select a mission and level to replay.';
    const captionText = this.state.narrCaption || this.state.goal || fallbackObjective;
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
    const maxCodeW = Math.max(120, w - 84);
    ctx.font = '500 22px "JetBrains Mono", monospace';

    for (const r of vim.rows) {
      if (ry > y + h - 78) break;
      if (r.tilde) {
        ctx.fillStyle = TN.gutter;
        ctx.fillText('    ~', x + 8, ry);
        ry += rowH;
      } else {
        const wrapped = this._wrapCodeLine(ctx, r.text || '', maxCodeW);
        let charOffset = 0;
        const cursorIdx = Math.max(0, (r.col || 1) - 1);
        for (let wi = 0; wi < wrapped.length; wi++) {
          if (ry > y + h - 78) break;
          const seg = wrapped[wi];
          if (wi === 0) {
            ctx.fillStyle = TN.comment;
            ctx.fillText(`${String(r.num).padStart(3, ' ')} `, x + 8, ry);
          }
          ctx.fillStyle = TN.fgBright;
          ctx.fillText(seg, x + 74, ry);
          const isLastSeg = wi === wrapped.length - 1;
          if (
            r.active &&
            Math.floor(elapsed * 3) % 2 === 0 &&
            cursorIdx >= charOffset &&
            (cursorIdx < charOffset + seg.length || isLastSeg)
          ) {
            const localIdx = Math.min(seg.length, cursorIdx - charOffset);
            const preW = ctx.measureText(seg.slice(0, localIdx)).width;
            ctx.fillStyle = TN.blue;
            ctx.fillRect(x + 74 + preW, ry - 20, 13, 25);
          }
          charOffset += seg.length;
          ry += rowH;
        }
      }
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

  _colorForCodeLine(line, TN) {
    const t = (line || '').trim();
    if (!t) return TN.fg;
    if (t.startsWith('#include') || t.startsWith('#define') || t.startsWith('import ') || t.startsWith('from ')) return TN.purple;
    if (t.startsWith('/*') || t.startsWith('//') || t.startsWith('*') || t.startsWith('#')) return TN.comment;
    if (/^(int|void|char|unsigned|struct|ssize_t|size_t|uint32_t|return|if|for|while|def|class)\b/.test(t)) return TN.cyan;
    if (t.includes('"') || t.includes("'")) return TN.green;
    return TN.fgBright;
  }

  _renderNeovimPane(ctx, lastVim, activeVim, x, y, w, h, elapsed, TN) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(x - 6, y - 4, w + 12, h + 8);
    ctx.clip();

    // Neovim buffer tab bar
    ctx.fillStyle = 'rgba(26, 27, 38, 0.96)';
    ctx.fillRect(x - 6, y, w + 12, 28);
    ctx.fillStyle = TN.blue;
    ctx.fillRect(x - 6, y, 168, 28);
    ctx.fillStyle = TN.bgDark;
    ctx.font = '700 15px "JetBrains Mono", monospace';
    ctx.fillText(`  ${lastVim.file}  `, x, y + 19);
    ctx.fillStyle = TN.comment;
    const ext = String(lastVim.file || '').split('.').pop().toLowerCase();
    const ftMap = { c: 'c', h: 'c', py: 'python', sh: 'sh', php: 'php', pl: 'perl', rb: 'ruby', js: 'js', s: 'asm', asm: 'asm' };
    const ft = ftMap[ext] || 'text';
    ctx.fillText(`  [utf-8 · unix · ${ft}]`, x + 178, y + 19);

    const rowH = 26;
    const lualineH = 30;
    const codeY = y + 36;
    const maxRows = Math.max(1, Math.floor((h - 38 - lualineH) / rowH));
    const maxCodeW = Math.max(120, w - 58);
    ctx.font = '500 18.5px "JetBrains Mono", Consolas, monospace';

    // Wrap every logical code line across visual rows (like Neovim `set wrap`) so long lines
    // are NEVER truncated with "..." or clipped off the edge.
    const allLines = lastVim.lines || [];
    const activeNum = lastVim.activeLine || 1;
    const scrollKey = `${this.state.header || ''}::${lastVim.file || ''}`;
    if (scrollKey !== this._nvimScrollKey || allLines.length === 0) {
      this._nvimScrollKey = scrollKey;
      this._nvimScrollTop = 0;
    }

    const visualRows = [];
    let activeFirstVisualIdx = -1;
    let activeLastVisualIdx = -1;
    for (const ln of allLines) {
      const color = this._colorForCodeLine(ln.text, TN);
      const isCur = Boolean(lastVim.editing && ln.num === activeNum);
      const wrapped = this._wrapCodeLine(ctx, ln.text || '', maxCodeW);
      wrapped.forEach((seg, wi) => {
        const isCursorRow = isCur && wi === wrapped.length - 1;
        visualRows.push({
          num: wi === 0 ? ln.num : null,
          text: seg,
          color,
          isCur,
          isCursorRow,
        });
        if (isCur) {
          if (activeFirstVisualIdx < 0) activeFirstVisualIdx = visualRows.length - 1;
          activeLastVisualIdx = visualRows.length - 1;
        }
      });
    }

    // Sticky Neovim viewport scrolling: only scroll the minimum rows required to keep
    // the active cursor line in view — never snap back to line 1 between lines or on :wq!
    if (lastVim.editing && activeFirstVisualIdx >= 0) {
      if (activeLastVisualIdx >= this._nvimScrollTop + maxRows) {
        this._nvimScrollTop = activeLastVisualIdx - maxRows + 1;
      } else if (activeFirstVisualIdx < this._nvimScrollTop) {
        this._nvimScrollTop = activeFirstVisualIdx;
      }
    }
    const maxScroll = Math.max(0, visualRows.length - maxRows);
    this._nvimScrollTop = Math.max(0, Math.min(this._nvimScrollTop, maxScroll));
    const visible = visualRows.slice(this._nvimScrollTop, this._nvimScrollTop + maxRows);

    let ry = codeY + 18;
    for (const vr of visible) {
      if (vr.isCur) {
        ctx.fillStyle = 'rgba(122, 162, 247, 0.14)';
        ctx.fillRect(x - 4, ry - 19, w + 8, rowH);
      }
      if (vr.num !== null) {
        ctx.fillStyle = vr.isCur ? TN.blue : TN.gutter;
        ctx.fillText(String(vr.num).padStart(3, ' '), x, ry);
      }
      ctx.fillStyle = vr.color;
      ctx.fillText(vr.text, x + 52, ry);
      if (vr.isCursorRow && Math.floor(elapsed * 2.6) % 2 === 0) {
        const tw = ctx.measureText(vr.text).width;
        ctx.fillStyle = TN.blue;
        ctx.fillRect(x + 54 + tw, ry - 17, 10, 21);
      }
      ry += rowH;
    }

    // Fill remaining rows with authentic Vim ~ tildes
    for (let k = visible.length; k < maxRows; k++) {
      ctx.fillStyle = TN.gutter;
      ctx.fillText('  ~', x, ry);
      ry += rowH;
    }

    // Authentic Neovim Lualine Status Bar at bottom of editor pane
    const ly = y + h - lualineH;
    ctx.fillStyle = TN.bgFloat;
    ctx.fillRect(x - 6, ly, w + 12, lualineH);
    const isIns = (lastVim.mode || '').includes('INSERT');
    ctx.fillStyle = isIns ? TN.green : TN.purple;
    ctx.fillRect(x - 6, ly, 104, lualineH);
    ctx.fillStyle = TN.bgDark;
    ctx.font = '700 15px "JetBrains Mono", monospace';
    ctx.fillText(isIns ? ' INSERT ' : ' NORMAL ', x + 4, ly + 20);
    ctx.fillStyle = TN.fgBright;
    ctx.fillText(` ${lastVim.file}  │  ${allLines.length} lines`, x + 108, ly + 20);
    ctx.fillStyle = TN.cyan;
    ctx.textAlign = 'right';
    ctx.fillText(`Ln ${activeNum}, Col 1  100% `, x + w + 2, ly + 20);
    ctx.textAlign = 'left';
    ctx.restore();
  }

  _renderShellPane(ctx, innerX, innerY, innerW, innerH, elapsed, TN, fontSize = 22, lineH = 32) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(innerX - 8, innerY - 4, innerW + 16, innerH + 8);
    ctx.clip();

    ctx.font = `500 ${fontSize}px "JetBrains Mono", Consolas, monospace`;
    const renderRows = [];
    for (const item of (this.state.lines || [])) {
      const hl =
        this.state.activeNarrSeg >= 0 &&
        Array.isArray(item.segs) &&
        item.segs.includes(this.state.activeNarrSeg);

      if (item.kind === 'cmd') {
        const full = `${item.prompt || ''}${item.text || ''}`;
        const wrapped = this._wrapText(ctx, full, innerW - 12);
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
        const wrapped = this._wrapText(ctx, item.text || '', innerW - 16);
        wrapped.forEach((w) => {
          renderRows.push({ kind: item.kind, text: w, hl });
        });
      }
    }

    const maxVisible = Math.max(1, Math.floor(innerH / lineH) - 1);
    const slice = renderRows.slice(-maxVisible);
    let y = innerY + lineH - 6;

    for (const row of slice) {
      if (row.hl) {
        ctx.fillStyle = 'rgba(115, 218, 202, 0.16)';
        ctx.fillRect(innerX - 6, y - fontSize, innerW + 12, lineH);
        ctx.fillStyle = TN.teal;
        ctx.fillRect(innerX - 6, y - fontSize, 4, lineH);
      }

      if (row.kind === 'goal') {
        ctx.fillStyle = 'rgba(122, 162, 247, 0.14)';
        ctx.fillRect(innerX - 6, y - fontSize, innerW + 12, lineH);
        ctx.fillStyle = TN.fgBright;
        ctx.fillText(row.text, innerX + 4, y);
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
          ctx.fillRect(cx + 3, y - fontSize + 2, 12, fontSize + 3);
        }
      } else if (row.kind === 'note') {
        ctx.fillStyle = TN.purple;
        ctx.fillText(row.text, innerX, y);
      } else if (row.kind === 'pw') {
        ctx.fillStyle = TN.amber;
        ctx.fillText(row.text, innerX, y);
      } else if (row.text.includes('[REDACTED]')) {
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
      y += lineH;
    }

    if (this.state.promptIdle && !slice.some((r) => r.typing)) {
      const lastCmd = [...(this.state.lines || [])].reverse().find((l) => l.kind === 'cmd' && l.prompt);
      const promptStr = lastCmd ? lastCmd.prompt : `${(this.state.host || 'omarchy@workstation').split('.')[0]}:~$ `;
      const py = Math.min(y + 4, innerY + innerH - 10);
      ctx.fillStyle = TN.cyan;
      ctx.fillText(promptStr, innerX, py);
      if (Math.floor(elapsed * 2) % 2 === 0) {
        const pw = ctx.measureText(promptStr).width;
        ctx.fillStyle = TN.blue;
        ctx.fillRect(innerX + pw + 2, py - fontSize + 2, 12, fontSize + 3);
      }
    }
    ctx.restore();
  }
}
