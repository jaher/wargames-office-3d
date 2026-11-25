import * as THREE from 'three';

// Renders an authentic Omarchy Linux (Hyprland + Waybar + Ghostty) desktop
// onto a high-resolution CanvasTexture displayed on the 3D office monitor.
export class OmarchyScreen {
  constructor() {
    this.width = 1600;
    this.height = 960;
    this.canvas = document.createElement('canvas');
    this.canvas.width = this.width;
    this.canvas.height = this.height;
    this.ctx = this.canvas.getContext('2d');

    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.colorSpace = THREE.SRGBColorSpace;
    this.texture.anisotropy = 8;
    this.texture.minFilter = THREE.LinearMipmapLinearFilter;
    this.texture.magFilter = THREE.LinearFilter;

    this.state = {
      header: 'BANDIT — LEVEL 0',
      host: 'bandit0@bandit.labs.overthewire.org',
      goal: 'Loading OverTheWire solutions…',
      lines: [{ kind: 'note', text: 'Booting Omarchy Linux workspace…' }],
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
    // Redraw when state changed, or ~3x/sec for blinking cursor, clock, and audio bars
    if (this._dirty || elapsed - this._lastDraw > 0.32) {
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

  render(elapsed) {
    const ctx = this.ctx;
    const W = this.width;
    const H = this.height;

    // 1. Omarchy Linux Desktop Wallpaper (Tokyo Night geometric gradient)
    const bgGrad = ctx.createLinearGradient(0, 0, W, H);
    bgGrad.addColorStop(0, '#0d111a');
    bgGrad.addColorStop(0.5, '#13192a');
    bgGrad.addColorStop(1, '#0b1420');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, W, H);

    // Subtle glowing wallpaper horizon waves
    ctx.save();
    const glow = ctx.createRadialGradient(W * 0.78, H * 0.25, 40, W * 0.78, H * 0.25, 580);
    glow.addColorStop(0, 'rgba(125, 207, 255, 0.16)');
    glow.addColorStop(0.5, 'rgba(187, 154, 247, 0.08)');
    glow.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, W, H);

    // Subtle geometric ridge silhouette behind gaps
    ctx.fillStyle = 'rgba(115, 218, 202, 0.06)';
    ctx.beginPath();
    ctx.moveTo(0, H);
    ctx.lineTo(0, H * 0.78);
    ctx.lineTo(W * 0.22, H * 0.62);
    ctx.lineTo(W * 0.44, H * 0.74);
    ctx.lineTo(W * 0.7, H * 0.56);
    ctx.lineTo(W, H * 0.72);
    ctx.lineTo(W, H);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    // 2. Omarchy Waybar Top Bar
    const barH = 44;
    ctx.fillStyle = 'rgba(15, 18, 28, 0.94)';
    ctx.fillRect(0, 0, W, barH);
    ctx.fillStyle = 'rgba(125, 207, 255, 0.22)';
    ctx.fillRect(0, barH - 1, W, 1);

    // Left: Omarchy arch/logo pill + Hyprland workspaces
    ctx.fillStyle = '#7dcfff';
    ctx.font = 'bold 18px "JetBrains Mono", monospace';
    ctx.fillText('▲ OMARCHY', 20, 29);

    const wsX = 165;
    for (let i = 1; i <= 5; i++) {
      const x = wsX + (i - 1) * 34;
      const active = i === 1;
      ctx.fillStyle = active ? '#7dcfff' : 'rgba(138, 155, 184, 0.22)';
      ctx.beginPath();
      ctx.roundRect(x, 10, 26, 24, 6);
      ctx.fill();
      ctx.fillStyle = active ? '#0b0f18' : '#a9b7d0';
      ctx.font = 'bold 14px "JetBrains Mono", monospace';
      ctx.fillText(String(i), x + 9, 27);
    }

    // Center: active window title
    ctx.fillStyle = '#dce6f7';
    ctx.font = '600 15px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    ctx.fillText(`ghostty  ·  ${this.state.header}`, W * 0.5, 28);
    ctx.textAlign = 'left';

    // Right: system metrics + audio indicator + clock
    const now = new Date();
    const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    ctx.font = '500 14px "JetBrains Mono", monospace';
    ctx.textAlign = 'right';
    const narrIcon = this.state.narrating ? '🎙 VOICE ON   ' : '';
    ctx.fillStyle = this.state.narrating ? '#73daca' : '#9aaac8';
    ctx.fillText(`${narrIcon}RTX 5090 42°C   8× SPARK ONLINE   ${timeStr}`, W - 22, 28);
    ctx.textAlign = 'left';

    // 3. Hyprland Tiled Layout: Main Ghostty Terminal (left 76%) + Omarchy System Tile (right 24%)
    const pad = 16;
    const topY = barH + pad;
    const availH = H - topY - pad;
    const termW = Math.floor((W - pad * 3) * 0.76);
    const sideX = pad * 2 + termW;
    const sideW = W - sideX - pad;

    // --- Main Terminal Window ---
    ctx.save();
    ctx.fillStyle = 'rgba(10, 13, 20, 0.94)';
    ctx.beginPath();
    ctx.roundRect(pad, topY, termW, availH, 12);
    ctx.fill();

    // Hyprland active cyan/mint gradient border
    const borderGrad = ctx.createLinearGradient(pad, topY, pad + termW, topY + availH);
    borderGrad.addColorStop(0, '#7dcfff');
    borderGrad.addColorStop(1, '#73daca');
    ctx.strokeStyle = borderGrad;
    ctx.lineWidth = 2.5;
    ctx.stroke();

    // Window title bar
    ctx.fillStyle = '#151b2a';
    ctx.beginPath();
    ctx.roundRect(pad + 1, topY + 1, termW - 2, 36, [11, 11, 0, 0]);
    ctx.fill();

    const dots = ['#f7768e', '#e0af68', '#9ece6a'];
    dots.forEach((c, idx) => {
      ctx.fillStyle = c;
      ctx.beginPath();
      ctx.arc(pad + 22 + idx * 18, topY + 19, 5.5, 0, Math.PI * 2);
      ctx.fill();
    });

    ctx.fillStyle = '#8fa3c4';
    ctx.font = '600 14px "JetBrains Mono", monospace';
    ctx.fillText(`ghostty — ${this.state.host}`, pad + 82, topY + 24);

    // Clip to terminal content viewport
    const innerX = pad + 20;
    const innerY = topY + 48;
    const innerW = termW - 40;
    const innerH = availH - 64;
    ctx.beginPath();
    ctx.rect(innerX, innerY, innerW, innerH);
    ctx.clip();

    const lineH = 25;
    ctx.font = '500 17px "JetBrains Mono", Consolas, monospace';

    // Render either active Vim overlay or scrolling shell transcript
    if (this.state.vim) {
      this._renderVimOnCanvas(ctx, this.state.vim, innerX, innerY, innerW, innerH, elapsed);
    } else {
      const renderRows = [];
      for (const item of (this.state.lines || [])) {
        const hl =
          this.state.activeNarrSeg >= 0 &&
          Array.isArray(item.segs) &&
          item.segs.includes(this.state.activeNarrSeg);

        if (item.kind === 'cmd') {
          const full = `${item.prompt || ''}${item.text || ''}`;
          const wrapped = this._wrapText(ctx, full, innerW - 14);
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
          const wrapped = this._wrapText(ctx, item.text || '', innerW - 18);
          wrapped.forEach((w) => {
            renderRows.push({ kind: item.kind, text: w, hl });
          });
        }
      }

      const maxVisible = Math.floor(innerH / lineH);
      const slice = renderRows.slice(-maxVisible);
      let y = innerY + 22;

      for (const row of slice) {
        if (row.hl) {
          ctx.fillStyle = 'rgba(115, 218, 202, 0.16)';
          ctx.fillRect(innerX - 6, y - 18, innerW + 12, lineH);
          ctx.fillStyle = '#73daca';
          ctx.fillRect(innerX - 6, y - 18, 3, lineH);
        }

        if (row.kind === 'goal') {
          ctx.fillStyle = 'rgba(125, 207, 255, 0.09)';
          ctx.fillRect(innerX - 4, y - 18, innerW + 8, lineH);
          ctx.fillStyle = '#e6f3ff';
          ctx.fillText(row.text, innerX + 6, y);
        } else if (row.kind === 'cmd') {
          const pPart = row.text.slice(0, row.promptLen);
          const cPart = row.text.slice(row.promptLen);
          let cx = innerX;
          if (pPart) {
            ctx.fillStyle = '#7dcfff';
            ctx.fillText(pPart, cx, y);
            cx += ctx.measureText(pPart).width;
          }
          ctx.fillStyle = '#f5faff';
          ctx.fillText(cPart, cx, y);
          cx += ctx.measureText(cPart).width;
          if (row.typing && Math.floor(elapsed * 2.2) % 2 === 0) {
            ctx.fillStyle = '#73daca';
            ctx.fillRect(cx + 2, y - 15, 10, 19);
          }
        } else if (row.kind === 'note') {
          ctx.fillStyle = '#7d93b5';
          ctx.fillText(row.text, innerX, y);
        } else if (row.kind === 'pw') {
          ctx.fillStyle = '#e0af68';
          ctx.fillText(row.text, innerX, y);
        } else {
          // Output line — highlight [REDACTED] in warm amber
          if (row.text.includes('[REDACTED]')) {
            const parts = row.text.split('[REDACTED]');
            let cx = innerX;
            parts.forEach((part, pi) => {
              ctx.fillStyle = '#a8e8be';
              ctx.fillText(part, cx, y);
              cx += ctx.measureText(part).width;
              if (pi < parts.length - 1) {
                ctx.fillStyle = '#e0af68';
                ctx.fillText('[REDACTED]', cx, y);
                cx += ctx.measureText('[REDACTED]').width;
              }
            });
          } else {
            ctx.fillStyle = '#a8e8be';
            ctx.fillText(row.text, innerX, y);
          }
        }
        y += lineH;
      }

      // Idle blinking prompt cursor if nothing is actively typing
      if (!slice.some((r) => r.typing) && Math.floor(elapsed * 2) % 2 === 0) {
        ctx.fillStyle = '#73daca';
        ctx.fillRect(innerX, Math.min(y - 14, innerY + innerH - 22), 10, 18);
      }
    }
    ctx.restore();

    // --- Right Hyprland Companion Tiles (Omarchy Telemetry + Voice Caption) ---
    const topTileH = Math.floor(availH * 0.46);
    const botTileY = topY + topTileH + pad;
    const botTileH = availH - topTileH - pad;

    // Tile 1: Omarchy Fastfetch / Rig Telemetry
    ctx.save();
    ctx.fillStyle = 'rgba(13, 17, 27, 0.92)';
    ctx.beginPath();
    ctx.roundRect(sideX, topY, sideW, topTileH, 12);
    ctx.fill();
    ctx.strokeStyle = 'rgba(125, 207, 255, 0.28)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.fillStyle = '#7dcfff';
    ctx.font = 'bold 17px "JetBrains Mono", monospace';
    ctx.fillText('OMARCHY LINUX', sideX + 18, topY + 36);
    ctx.fillStyle = '#73daca';
    ctx.font = '500 13px "JetBrains Mono", monospace';
    ctx.fillText('Hyprland · Wayland · Ghostty', sideX + 18, topY + 58);

    const specs = [
      ['OS', 'Omarchy Linux x86_64'],
      ['GPU', 'NVIDIA RTX 5090 32GB'],
      ['CASE', 'Corsair Airflow RGB'],
      ['CLUSTER', '8× DGX Spark Nodes'],
      ['SWITCH', 'MikroTik CRS804'],
      ['TARGET', this.state.header],
    ];
    let sy = topY + 98;
    for (const [k, v] of specs) {
      ctx.fillStyle = '#bb9af7';
      ctx.font = 'bold 13px "JetBrains Mono", monospace';
      ctx.fillText(`${k.padEnd(8, ' ')}`, sideX + 18, sy);
      ctx.fillStyle = '#d6e3f8';
      ctx.font = '500 13px "JetBrains Mono", monospace';
      const valTrim = v.length > 21 ? `${v.slice(0, 20)}…` : v;
      ctx.fillText(valTrim, sideX + 102, sy);
      sy += 34;
    }

    // Mini animated CPU/GPU activity bars
    const barBaseY = topY + topTileH - 28;
    for (let i = 0; i < 16; i++) {
      const h = 10 + Math.abs(Math.sin(elapsed * 2.2 + i * 0.55)) * 26;
      ctx.fillStyle = i % 2 === 0 ? 'rgba(125, 207, 255, 0.7)' : 'rgba(115, 218, 202, 0.7)';
      ctx.fillRect(sideX + 18 + i * 19, barBaseY - h, 11, h);
    }
    ctx.restore();

    // Tile 2: Live Narration Caption / Mission Goal
    ctx.save();
    ctx.fillStyle = 'rgba(13, 17, 27, 0.92)';
    ctx.beginPath();
    ctx.roundRect(sideX, botTileY, sideW, botTileH, 12);
    ctx.fill();
    ctx.strokeStyle = this.state.narrating ? 'rgba(115, 218, 202, 0.65)' : 'rgba(125, 207, 255, 0.28)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.fillStyle = this.state.narrating ? '#73daca' : '#e0af68';
    ctx.font = 'bold 15px "JetBrains Mono", monospace';
    ctx.fillText(
      this.state.narrating ? '🎙 LIVE NARRATION' : '◈ MISSION BRIEF',
      sideX + 18,
      botTileY + 34
    );

    // Animated voice equalizer when narrating
    if (this.state.narrating) {
      for (let i = 0; i < 6; i++) {
        const eh = 4 + Math.abs(Math.sin(elapsed * 9 + i * 1.1)) * 16;
        ctx.fillStyle = '#73daca';
        ctx.fillRect(sideX + sideW - 56 + i * 7, botTileY + 32 - eh, 4, eh);
      }
    }

    ctx.fillStyle = '#e5effd';
    ctx.font = '500 15px "JetBrains Mono", monospace';
    const captionText = this.state.narrCaption || this.state.goal || 'Select a mission and level to replay.';
    const capLines = this._wrapText(ctx, captionText, sideW - 36);
    let cy = botTileY + 72;
    for (const ln of capLines.slice(0, 14)) {
      ctx.fillText(ln, sideX + 18, cy);
      cy += 24;
    }
    ctx.restore();

    this.texture.needsUpdate = true;
  }

  _renderVimOnCanvas(ctx, vim, x, y, w, h, elapsed) {
    ctx.fillStyle = '#070a10';
    ctx.fillRect(x, y, w, h);

    const rowH = 26;
    let ry = y + 26;
    ctx.font = '500 17px "JetBrains Mono", monospace';

    for (const r of vim.rows) {
      if (ry > y + h - 64) break;
      if (r.tilde) {
        ctx.fillStyle = '#3b4b66';
        ctx.fillText('    ~', x + 8, ry);
      } else {
        ctx.fillStyle = '#566a88';
        ctx.fillText(`${String(r.num).padStart(3, ' ')} `, x + 8, ry);
        ctx.fillStyle = '#c8f5d4';
        ctx.fillText(r.text, x + 56, ry);
        if (r.active && Math.floor(elapsed * 3) % 2 === 0) {
          const preW = ctx.measureText(r.text.slice(0, Math.max(0, r.col - 1))).width;
          ctx.fillStyle = '#73daca';
          ctx.fillRect(x + 56 + preW, ry - 16, 10, 20);
        }
      }
      ry += rowH;
    }

    // Vim status bar
    ctx.fillStyle = '#1b2b3e';
    ctx.fillRect(x, y + h - 54, w, 26);
    ctx.fillStyle = '#dceeff';
    ctx.font = '600 15px "JetBrains Mono", monospace';
    ctx.fillText(vim.status || vim.file, x + 12, y + h - 36);

    ctx.fillStyle = '#e0af68';
    ctx.fillText(vim.mode || '', x + 12, y + h - 10);
  }
}
