import * as THREE from 'three';

// Deterministic PRNG for repeatable wear, page aging, and lived-in placement jitter
function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ============================================================================
// High-Resolution Procedural Textures: Page Leaves, Woven Headbands, Cloth Bump
// ============================================================================

function createPageEdgesTexture() {
  const W = 512;
  const H = 512;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const ctx = c.getContext('2d');
  const rng = mulberry32(4117);

  // Warm natural book-paper base
  ctx.fillStyle = '#efe7d6';
  ctx.fillRect(0, 0, W, H);

  // Hundreds of fine horizontal page-leaf lines + subtle Smyth-sewn signature bundle seams
  for (let y = 0; y < H; y++) {
    const isSig = (y % 28 === 0);
    const v = rng();
    if (isSig) {
      ctx.fillStyle = 'rgba(110, 92, 66, 0.28)';
      ctx.fillRect(0, y, W, 1);
    } else if (v > 0.56) {
      const a = 0.06 + (v - 0.56) * 0.34;
      ctx.fillStyle = `rgba(128, 108, 78, ${a.toFixed(3)})`;
      ctx.fillRect(0, y, W, 1);
    } else if (v < 0.22) {
      ctx.fillStyle = 'rgba(255, 252, 244, 0.36)';
      ctx.fillRect(0, y, W, 1);
    }
  }

  // Subtle horizontal edge wear & slight thumb-foxing gradient near outer edges
  const sideGrad = ctx.createLinearGradient(0, 0, W, 0);
  sideGrad.addColorStop(0.0, 'rgba(92, 74, 48, 0.22)');
  sideGrad.addColorStop(0.08, 'rgba(92, 74, 48, 0.04)');
  sideGrad.addColorStop(0.5, 'rgba(255, 250, 240, 0.0)');
  sideGrad.addColorStop(0.92, 'rgba(92, 74, 48, 0.05)');
  sideGrad.addColorStop(1.0, 'rgba(84, 66, 42, 0.24)');
  ctx.fillStyle = sideGrad;
  ctx.fillRect(0, 0, W, H);

  // Subtle organic dust/age blotches
  for (let i = 0; i < 36; i++) {
    const px = rng() * W;
    const py = rng() * H;
    const r = 18 + rng() * 44;
    const g = ctx.createRadialGradient(px, py, 1, px, py, r);
    g.addColorStop(0, 'rgba(148, 124, 86, 0.055)');
    g.addColorStop(1, 'rgba(148, 124, 86, 0.0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(px, py, r, 0, Math.PI * 2);
    ctx.fill();
  }

  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function createHeadbandTexture() {
  const W = 128;
  const H = 32;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const ctx = c.getContext('2d');
  // Alternating woven silk headband threads (tinted per book via vertex color)
  for (let x = 0; x < W; x += 4) {
    const alt = ((x / 4) | 0) % 2 === 0;
    ctx.fillStyle = alt ? '#f5efe2' : '#96342c';
    ctx.fillRect(x, 0, 4, H);
    ctx.fillStyle = 'rgba(0,0,0,0.16)';
    ctx.fillRect(x, 0, 1, H);
  }
  const grad = ctx.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0.0, 'rgba(0,0,0,0.34)');
  grad.addColorStop(0.35, 'rgba(255,255,255,0.12)');
  grad.addColorStop(0.75, 'rgba(0,0,0,0.08)');
  grad.addColorStop(1.0, 'rgba(0,0,0,0.36)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function createClothBumpTexture() {
  const S = 128;
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(S, S);
  const rng = mulberry32(7731);
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const weave = (((x & 1) ^ (y & 1)) ? 14 : -14) + Math.sin(x * 0.7) * 5 + Math.cos(y * 0.7) * 5;
      const noise = (rng() - 0.5) * 18;
      const v = Math.max(0, Math.min(255, 128 + weave + noise));
      const idx = (y * S + x) * 4;
      img.data[idx] = img.data[idx + 1] = img.data[idx + 2] = v;
      img.data[idx + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(18, 18);
  return tex;
}

// ============================================================================
// Publisher Colophons & Vector Marks (Springer Knight, MIT 7-Bar, O'Reilly)
// ============================================================================

function drawSpringerKnight(ctx, cx, cy, size, color) {
  ctx.save();
  ctx.translate(cx, cy);
  const s = size / 24;
  ctx.scale(s, s);
  ctx.fillStyle = color;
  // Iconic leaping Springer chess-knight silhouette
  ctx.beginPath();
  ctx.moveTo(-7, 10);
  ctx.lineTo(7, 10);
  ctx.lineTo(6, 7);
  ctx.lineTo(3, 6);
  ctx.quadraticCurveTo(5, 1, 7, -3);
  ctx.quadraticCurveTo(8, -7, 3, -9);
  ctx.lineTo(1, -11);
  ctx.lineTo(-1, -8);
  ctx.lineTo(-6, -5);
  ctx.lineTo(-6, -2);
  ctx.lineTo(-2, -2);
  ctx.quadraticCurveTo(-5, 2, -6, 7);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawMitPressColophon(ctx, cx, cy, w, h, color) {
  ctx.save();
  ctx.translate(cx - w / 2, cy - h / 2);
  ctx.fillStyle = color;
  // Iconic Muriel Cooper 7-bar MIT Press colophon
  const bars = [
    [0.00, 0.00, 0.09, 1.00],
    [0.15, 0.00, 0.09, 0.68],
    [0.30, 0.00, 0.09, 1.00],
    [0.45, 0.00, 0.09, 0.22],
    [0.45, 0.34, 0.09, 0.66],
    [0.60, 0.00, 0.09, 0.22],
    [0.75, 0.00, 0.09, 1.00],
    [0.90, 0.34, 0.09, 0.66],
  ];
  for (const [bx, by, bw, bh] of bars) {
    ctx.fillRect(bx * w, by * h, bw * w, bh * h);
  }
  ctx.restore();
}

function drawWearAndGrain(ctx, W, H, rng, isCloth, wear = 0.5) {
  // Subtle cloth/paper grain texture
  ctx.save();
  if (isCloth) {
    ctx.fillStyle = 'rgba(255,255,255,0.035)';
    for (let y = 0; y < H; y += 3) ctx.fillRect(0, y, W, 1);
    ctx.fillStyle = 'rgba(0,0,0,0.04)';
    for (let x = 0; x < W; x += 3) ctx.fillRect(x, 0, 1, H);
  } else {
    for (let i = 0; i < 90; i++) {
      ctx.fillStyle = rng() > 0.5 ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)';
      ctx.fillRect(rng() * W, rng() * H, 2 + rng() * 5, 2 + rng() * 5);
    }
  }

  // Authentic top & bottom cap shelf-wear scuffing (subtle rubbed pale edges)
  if (wear > 0.05) {
    const capAlpha = 0.09 + wear * 0.14;
    const topWear = ctx.createLinearGradient(0, 0, 0, 18);
    topWear.addColorStop(0, `rgba(246, 238, 222, ${capAlpha.toFixed(3)})`);
    topWear.addColorStop(0.5, `rgba(0, 0, 0, ${(capAlpha * 0.45).toFixed(3)})`);
    topWear.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = topWear;
    ctx.fillRect(0, 0, W, 18);

    const botWear = ctx.createLinearGradient(0, H, 0, H - 18);
    botWear.addColorStop(0, `rgba(242, 234, 218, ${(capAlpha * 1.1).toFixed(3)})`);
    botWear.addColorStop(0.5, `rgba(0, 0, 0, ${(capAlpha * 0.4).toFixed(3)})`);
    botWear.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = botWear;
    ctx.fillRect(0, H - 18, W, 18);

    // Subtle hinge-crease streaks on left/right edges
    const edgeL = ctx.createLinearGradient(0, 0, 14, 0);
    edgeL.addColorStop(0, 'rgba(0,0,0,0.28)');
    edgeL.addColorStop(0.45, `rgba(255,250,238,${(0.05 + wear * 0.07).toFixed(3)})`);
    edgeL.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = edgeL;
    ctx.fillRect(0, 0, 14, H);

    const edgeR = ctx.createLinearGradient(W, 0, W - 14, 0);
    edgeR.addColorStop(0, 'rgba(0,0,0,0.32)');
    edgeR.addColorStop(0.45, `rgba(255,250,238,${(0.04 + wear * 0.06).toFixed(3)})`);
    edgeR.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = edgeR;
    ctx.fillRect(W - 14, 0, 14, H);
  }
  ctx.restore();
}

// ============================================================================
// High-Resolution Spine & Front Cover Atlas Painter
// ============================================================================

class BookTextureAtlas {
  constructor(renderer) {
    // Spine atlas: 16 x 6 = 96 crisp high-res spines (128 x 340 px each -> 2048 x 2048)
    this.SPINE_COLS = 16;
    this.SPINE_ROWS = 6;
    this.S_CELL_W = 128;
    this.S_CELL_H = 340;
    this.spineCanvas = document.createElement('canvas');
    this.spineCanvas.width = this.SPINE_COLS * this.S_CELL_W;
    this.spineCanvas.height = this.SPINE_ROWS * this.S_CELL_H;
    this.sctx = this.spineCanvas.getContext('2d');
    this.nextSpineSlot = 0;

    // Cover atlas: 8 x 6 = 48 detailed front covers (256 x 340 px each -> 2048 x 2048)
    this.COVER_COLS = 8;
    this.COVER_ROWS = 6;
    this.C_CELL_W = 256;
    this.C_CELL_H = 340;
    this.coverCanvas = document.createElement('canvas');
    this.coverCanvas.width = this.COVER_COLS * this.C_CELL_W;
    this.coverCanvas.height = this.COVER_ROWS * this.C_CELL_H;
    this.cctx = this.coverCanvas.getContext('2d');
    this.nextCoverSlot = 0;
    this.renderer = renderer;
    this.rng = mulberry32(20261);
  }

  drawSpine(spec) {
    const slot = Math.min(this.nextSpineSlot++, this.SPINE_COLS * this.SPINE_ROWS - 1);
    const col = slot % this.SPINE_COLS;
    const row = Math.floor(slot / this.SPINE_COLS);
    const ox = col * this.S_CELL_W;
    const oy = row * this.S_CELL_H;
    const W = 128;
    const H = 408;

    const ctx = this.sctx;
    ctx.save();
    ctx.beginPath();
    ctx.rect(ox, oy, this.S_CELL_W, this.S_CELL_H);
    ctx.clip();
    ctx.translate(ox, oy);
    ctx.scale(this.S_CELL_W / W, this.S_CELL_H / H);

    const style = spec.style || 'classic';
    const isCloth = spec.binding !== 'paperback' && style !== 'gtm' && style !== 'utm' && style !== 'sums';

    // Base fill
    ctx.fillStyle = spec.bg || '#243044';
    ctx.fillRect(0, 0, W, H);

    // Subtle cylindrical spine shading (enhances the 3D rounded crown geometry)
    const cylGrad = ctx.createLinearGradient(0, 0, W, 0);
    cylGrad.addColorStop(0.0, 'rgba(0,0,0,0.24)');
    cylGrad.addColorStop(0.16, 'rgba(255,255,255,0.08)');
    cylGrad.addColorStop(0.45, 'rgba(255,255,255,0.03)');
    cylGrad.addColorStop(0.84, 'rgba(0,0,0,0.08)');
    cylGrad.addColorStop(1.0, 'rgba(0,0,0,0.28)');
    ctx.fillStyle = cylGrad;
    ctx.fillRect(0, 0, W, H);

    // Style-specific researched layouts
    if (style === 'gtm') {
      // Iconic Springer Yellow GTM: crisp white upper panel + black rules + vol # + Springer knight at foot
      ctx.fillStyle = '#faf9f3';
      ctx.fillRect(0, 14, W, 62);
      ctx.fillStyle = '#14161a';
      ctx.fillRect(0, 14, W, 2.5);
      ctx.fillRect(0, 76, W, 2.5);
      ctx.textAlign = 'center';
      ctx.font = '700 11px "Inter", "DejaVu Sans", sans-serif';
      ctx.fillText('Graduate Texts', W / 2, 32);
      ctx.fillText('in Mathematics', W / 2, 44);
      ctx.font = '800 22px "Inter", "DejaVu Sans", sans-serif';
      ctx.fillText(spec.vol || '', W / 2, 68);
      // Bottom Springer colophon + knight
      ctx.fillStyle = '#14161a';
      ctx.fillRect(10, H - 56, W - 20, 1.5);
      drawSpringerKnight(ctx, W / 2, H - 38, 17, '#14161a');
      ctx.font = '700 13px "Georgia", serif';
      ctx.fillText('Springer', W / 2, H - 14);
    } else if (style === 'utm') {
      // Researched authentic Springer UTM: Iconic Springer Yellow spine with crisp white series panel at top
      ctx.fillStyle = '#faf9f4';
      ctx.fillRect(0, 14, W, 56);
      ctx.fillStyle = '#161a22';
      ctx.fillRect(0, 14, W, 2.5);
      ctx.fillRect(0, 70, W, 3);
      ctx.textAlign = 'center';
      ctx.font = '700 11px "Inter", "DejaVu Sans", sans-serif';
      ctx.fillText('Undergraduate', W / 2, 34);
      ctx.fillText('Texts in Math.', W / 2, 48);
      ctx.font = '800 14px "Inter", "DejaVu Sans", sans-serif';
      ctx.fillText('UTM', W / 2, 64);
      ctx.fillStyle = '#161a22';
      ctx.fillRect(10, H - 54, W - 20, 1.5);
      drawSpringerKnight(ctx, W / 2, H - 36, 16, '#161a22');
      ctx.font = '700 13px "Georgia", serif';
      ctx.fillText('Springer', W / 2, H - 13);
    } else if (style === 'sums') {
      // Researched modern Springer SUMS paperbacks: white/light/accent banded spines with color panel + knight
      const bandCol = spec.band || '#1e63a8';
      ctx.fillStyle = bandCol;
      ctx.fillRect(0, 0, W, 58);
      ctx.fillRect(0, H - 46, W, 46);
      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'center';
      ctx.font = '800 19px "Inter", "DejaVu Sans", sans-serif';
      ctx.fillText('SUMS', W / 2, 36);
      ctx.font = '600 9px "Inter", "DejaVu Sans", sans-serif';
      ctx.fillText('SPRINGER UNDERGRAD', W / 2, 50, W - 12);
      drawSpringerKnight(ctx, W / 2, H - 29, 15, '#ffffff');
      ctx.font = '700 12px "Georgia", serif';
      ctx.fillText('Springer', W / 2, H - 8);
    } else if (style === 'knuth') {
      // Authentic Addison-Wesley uniform dark navy-blue cloth with metallic gold-foil double rules & raised hubs!
      ctx.fillStyle = '#e0be62';
      for (const ry of [18, 25, 76, 82, H - 80, H - 74, H - 26, H - 20]) {
        ctx.fillRect(6, ry, W - 12, ry === 18 || ry === H - 20 ? 3.5 : 1.8);
      }
      ctx.textAlign = 'center';
      ctx.font = '700 20px "Georgia", serif';
      ctx.fillText(spec.vol || 'VOL. 1', W / 2, 57, W - 14);
      ctx.font = '600 11px "Georgia", serif';
      ctx.fillText('ADDISON', W / 2, H - 52, W - 12);
      ctx.fillText('WESLEY', W / 2, H - 38, W - 12);
    } else if (style === 'oreilly') {
      // Authentic O'Reilly Animal Books: stark white paperback with vibrant colored top & bottom strips
      const bandCol = spec.band || '#c62828';
      ctx.fillStyle = bandCol;
      ctx.fillRect(0, 0, W, 28);
      ctx.fillRect(0, H - 44, W, 12);
      ctx.fillStyle = '#181a20';
      ctx.textAlign = 'center';
      ctx.font = '700 14px "Georgia", serif';
      ctx.fillText("O'REILLY®", W / 2, H - 14, W - 10);
    } else if (style === 'mit') {
      // Authentic MIT Press with crisp Muriel Cooper 7-bar colophon
      if (spec.band) {
        ctx.fillStyle = spec.band;
        ctx.fillRect(0, 14, W, 32);
        ctx.fillRect(0, H - 58, W, 10);
      }
      if (spec.vol) {
        ctx.fillStyle = spec.bandFg || '#ffffff';
        ctx.textAlign = 'center';
        ctx.font = '700 14px "Inter", "DejaVu Sans", sans-serif';
        ctx.fillText(spec.vol, W / 2, 35, W - 10);
      }
      drawMitPressColophon(ctx, W / 2, H - 26, 40, 22, spec.fg || '#f4f0e6');
    } else if (style === 'kr') {
      // Iconic K&R 2nd Edition: white paperback with bold blue C & red ANSI rule
      ctx.fillStyle = '#1b58a8';
      ctx.fillRect(0, 0, W, 10);
      ctx.fillRect(0, H - 10, W, 10);
      ctx.fillStyle = '#c82828';
      ctx.fillRect(0, 56, W, 6);
      ctx.fillStyle = '#1b58a8';
      ctx.textAlign = 'center';
      ctx.font = '900 32px "Inter", "DejaVu Sans", sans-serif';
      ctx.fillText('C', W / 2, 46);
      ctx.fillStyle = '#161b24';
      ctx.font = '700 10px "Inter", "DejaVu Sans", sans-serif';
      ctx.fillText('PRENTICE HALL', W / 2, H - 20, W - 10);
    } else if (style === 'nostarch') {
      // No Starch Press: jet-black/charcoal spine with vivid accent block at top & bottom
      ctx.fillStyle = spec.band || '#e6b828';
      ctx.fillRect(0, 10, W, 42);
      ctx.fillRect(0, H - 40, W, 28);
      ctx.fillStyle = spec.bandFg || '#121418';
      ctx.textAlign = 'center';
      ctx.font = '800 11px "Inter", "DejaVu Sans", sans-serif';
      ctx.fillText('NO STARCH', W / 2, H - 22, W - 10);
      if (spec.vol) {
        ctx.font = '800 15px "Inter", "DejaVu Sans", sans-serif';
        ctx.fillText(spec.vol, W / 2, 36, W - 10);
      }
    } else {
      // Classic Academic Cloth/Paperback (Addison-Wesley, Pearson, Wiley, Morgan Kaufmann, Cambridge, McGraw-Hill)
      if (spec.band) {
        ctx.fillStyle = spec.band;
        ctx.fillRect(0, 16, W, 38);
        ctx.fillRect(0, H - 48, W, 12);
      }
      if (spec.vol) {
        ctx.fillStyle = spec.bandFg || spec.fg || '#f4f0e6';
        ctx.textAlign = 'center';
        ctx.font = '700 15px "Inter", "DejaVu Sans", sans-serif';
        ctx.fillText(spec.vol, W / 2, 40, W - 12);
      }
      if (spec.pub) {
        ctx.fillStyle = spec.fg || '#f4f0e6';
        ctx.textAlign = 'center';
        ctx.font = '700 11px "Inter", "DejaVu Sans", sans-serif';
        ctx.fillText(spec.pub, W / 2, H - 18, W - 12);
      }
    }

    // Vertical spine title & author lettering
    ctx.save();
    ctx.translate(W / 2, H * 0.515);
    ctx.rotate(Math.PI / 2);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const fg = spec.fg || (style === 'gtm' || style === 'utm' || style === 'oreilly' || style === 'kr' ? '#15171c' : '#f4f0e6');
    ctx.fillStyle = fg;
    const titleStr = spec.title || '';
    const authorStr = spec.author || '';
    const isSerif = (style === 'gtm' || style === 'utm' || style === 'knuth' || style === 'oreilly' || style === 'dragon');
    const fontFamily = isSerif ? '"Georgia", serif' : '"Inter", "DejaVu Sans", sans-serif';
    const titleSize = titleStr.length > 26 ? 16 : titleStr.length > 18 ? 19 : 22;
    ctx.font = `700 ${titleSize}px ${fontFamily}`;
    ctx.fillText(titleStr, 0, authorStr ? -13 : 0, 248);

    if (authorStr) {
      ctx.fillStyle = spec.authorFg || (style === 'knuth' ? '#f3e7c2' : fg);
      ctx.globalAlpha = 0.86;
      ctx.font = `600 13px ${fontFamily}`;
      ctx.fillText(authorStr, 0, 14, 240);
    }
    ctx.restore();

    drawWearAndGrain(ctx, W, H, this.rng, isCloth, spec.wear ?? 0.45);
    ctx.restore();

    const padU = 0.014;
    const padV = 0.010;
    return {
      u0: (col + padU) / this.SPINE_COLS,
      u1: (col + 1 - padU) / this.SPINE_COLS,
      vTop: 1.0 - (row + padV) / this.SPINE_ROWS,
      vBot: 1.0 - (row + 1 - padV) / this.SPINE_ROWS,
    };
  }

  // Dedicated realistic front cover artwork (visible on horizontal stacks, leaning books & row ends!)
  drawFrontCover(spec) {
    const slot = Math.min(this.nextCoverSlot++, this.COVER_COLS * this.COVER_ROWS - 1);
    const col = slot % this.COVER_COLS;
    const row = Math.floor(slot / this.COVER_COLS);
    const ox = col * this.C_CELL_W;
    const oy = row * this.C_CELL_H;
    const W = 256;
    const H = 340;

    const ctx = this.cctx;
    ctx.save();
    ctx.beginPath();
    ctx.rect(ox, oy, this.C_CELL_W, this.C_CELL_H);
    ctx.clip();
    ctx.translate(ox, oy);

    const style = spec.style || 'classic';
    const isCloth = spec.binding !== 'paperback' && style !== 'gtm' && style !== 'utm' && style !== 'sums';

    // Base cover color
    ctx.fillStyle = spec.coverBg || spec.bg || '#243044';
    ctx.fillRect(0, 0, W, H);

    // Subtle hinge crease shadow along left spine edge of front cover
    const hingeGrad = ctx.createLinearGradient(0, 0, 20, 0);
    hingeGrad.addColorStop(0.0, 'rgba(0,0,0,0.28)');
    hingeGrad.addColorStop(0.35, 'rgba(255,255,255,0.08)');
    hingeGrad.addColorStop(0.55, 'rgba(0,0,0,0.14)');
    hingeGrad.addColorStop(1.0, 'rgba(0,0,0,0.0)');
    ctx.fillStyle = hingeGrad;
    ctx.fillRect(0, 0, 20, H);

    const wrapTitle = (text, x, y, maxW, lineH, maxLines = 3) => {
      const words = text.split(' ');
      let line = '';
      let cy = y;
      let lines = 0;
      for (let i = 0; i < words.length; i++) {
        const test = line ? `${line} ${words[i]}` : words[i];
        if (ctx.measureText(test).width > maxW && line) {
          ctx.fillText(line, x, cy, maxW);
          line = words[i];
          cy += lineH;
          lines++;
          if (lines >= maxLines - 1) break;
        } else {
          line = test;
        }
      }
      if (line) ctx.fillText(line, x, cy, maxW);
    };

    if (style === 'gtm' || style === 'utm') {
      // Iconic Springer Yellow Cover: crisp white header strip with series + vol, bold black serif/sans title, Springer knight!
      ctx.fillStyle = '#faf9f3';
      ctx.fillRect(0, 18, W, 46);
      ctx.fillStyle = '#14161a';
      ctx.fillRect(0, 18, W, 2);
      ctx.fillRect(0, 64, W, 2);
      ctx.textAlign = 'left';
      ctx.font = '700 13px "Inter", "DejaVu Sans", sans-serif';
      ctx.fillText(style === 'gtm' ? 'Graduate Texts in Mathematics' : 'Undergraduate Texts in Mathematics', 22, 42, W - 64);
      if (spec.vol) {
        ctx.textAlign = 'right';
        ctx.font = '800 18px "Inter", "DejaVu Sans", sans-serif';
        ctx.fillText(spec.vol, W - 18, 46);
      }
      // Author & Title
      ctx.textAlign = 'left';
      ctx.fillStyle = '#14161a';
      ctx.font = '600 15px "Georgia", serif';
      ctx.fillText(spec.author || '', 22, 108, W - 40);
      ctx.font = '700 26px "Georgia", serif';
      wrapTitle(spec.title || '', 22, 144, W - 40, 32, 3);
      // Decorative fine rule
      ctx.fillRect(22, H - 72, W - 44, 1.5);
      drawSpringerKnight(ctx, 38, H - 40, 22, '#14161a');
      ctx.font = '700 18px "Georgia", serif';
      ctx.fillText('Springer', 58, H - 33);
    } else if (style === 'sums') {
      // Modern Springer SUMS geometric graphic cover
      const bandCol = spec.band || '#1e63a8';
      ctx.fillStyle = '#f8f9fb';
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = bandCol;
      ctx.fillRect(0, 0, W, 118);
      ctx.fillStyle = 'rgba(255,255,255,0.16)';
      ctx.beginPath();
      ctx.arc(W - 44, 88, 66, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'left';
      ctx.font = '700 11px "Inter", "DejaVu Sans", sans-serif';
      ctx.fillText('SPRINGER UNDERGRADUATE MATHEMATICS SERIES', 20, 28, W - 36);
      ctx.font = '700 22px "Inter", "DejaVu Sans", sans-serif';
      wrapTitle(spec.title || '', 20, 62, W - 36, 26, 2);
      ctx.fillStyle = '#1a2434';
      ctx.font = '600 15px "Inter", "DejaVu Sans", sans-serif';
      ctx.fillText(spec.author || '', 20, 152, W - 36);
      // Subtle geometric math diagram motif
      ctx.strokeStyle = bandCol;
      ctx.globalAlpha = 0.35;
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let i = 0; i < 4; i++) {
        ctx.arc(W * 0.54, 232, 24 + i * 14, 0, Math.PI * 2);
      }
      ctx.stroke();
      ctx.globalAlpha = 1.0;
      drawSpringerKnight(ctx, 34, H - 32, 18, bandCol);
      ctx.fillStyle = '#1a2434';
      ctx.font = '700 16px "Georgia", serif';
      ctx.fillText('Springer', 52, H - 26);
    } else if (style === 'oreilly') {
      // Iconic O'Reilly Animal Cover (white page, crisp colored banner, engraved silhouette box)
      ctx.fillStyle = '#f8f7f3';
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = spec.band || '#c62828';
      ctx.fillRect(0, 0, W, 18);
      ctx.fillRect(20, 174, W - 40, 82);
      // Engraved animal medallion placeholder (stylized woodcut boar/animal contour)
      ctx.strokeStyle = '#242220';
      ctx.lineWidth = 2;
      ctx.fillStyle = '#2a2622';
      ctx.beginPath();
      ctx.ellipse(W * 0.52, 98, 54, 34, -0.08, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#f8f7f3';
      ctx.lineWidth = 1.2;
      for (let k = -36; k <= 36; k += 6) {
        ctx.beginPath();
        ctx.moveTo(W * 0.52 + k, 68);
        ctx.lineTo(W * 0.52 + k - 8, 126);
        ctx.stroke();
      }
      // White title on color banner
      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'left';
      ctx.font = '700 20px "Georgia", serif';
      wrapTitle(spec.title || '', 28, 202, W - 56, 24, 3);
      ctx.fillStyle = '#202228';
      ctx.font = '600 14px "Inter", "DejaVu Sans", sans-serif';
      ctx.fillText(spec.author || '', 22, 286, W - 44);
      ctx.font = '700 15px "Georgia", serif';
      ctx.fillText("O'REILLY®", 22, H - 20);
    } else if (style === 'knuth') {
      // Dark navy cloth with gold-foil stamped frame & serif title
      ctx.strokeStyle = '#e0be62';
      ctx.lineWidth = 2.5;
      ctx.strokeRect(22, 24, W - 44, H - 48);
      ctx.lineWidth = 1;
      ctx.strokeRect(28, 30, W - 56, H - 60);
      ctx.fillStyle = '#e8ca74';
      ctx.textAlign = 'center';
      ctx.font = '700 18px "Georgia", serif';
      ctx.fillText('THE ART OF', W / 2, 86);
      ctx.fillText('COMPUTER', W / 2, 110);
      ctx.fillText('PROGRAMMING', W / 2, 134);
      ctx.fillStyle = '#e0be62';
      ctx.fillRect(64, 152, W - 128, 1.5);
      ctx.font = '700 22px "Georgia", serif';
      ctx.fillText(spec.vol || 'VOLUME 1', W / 2, 192);
      ctx.font = '600 15px "Georgia", serif';
      ctx.fillStyle = '#f2e6c0';
      ctx.fillText('DONALD E. KNUTH', W / 2, 256);
      ctx.font = '600 11px "Georgia", serif';
      ctx.fillText('ADDISON-WESLEY', W / 2, H - 46);
    } else if (style === 'mit' || style === 'nostarch' || style === 'kr' || style === 'classic' || style === 'dragon') {
      // Rich publisher-styled front cover with bold accent panel & clean typography
      const bandCol = spec.band || '#c89b3c';
      const fg = spec.fg || '#f5f2ea';
      if (style === 'kr') {
        ctx.fillStyle = '#f6f7fa';
        ctx.fillRect(0, 0, W, H);
        ctx.fillStyle = '#1b58a8';
        ctx.fillRect(20, 24, W - 40, 8);
        ctx.font = '900 118px "Inter", "DejaVu Sans", sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('C', W / 2, 188);
        ctx.fillStyle = '#c82828';
        ctx.font = '800 16px "Inter", "DejaVu Sans", sans-serif';
        ctx.fillText('SECOND EDITION · ANSI C', W / 2, 224);
        ctx.fillStyle = '#141924';
        ctx.font = '700 18px "Georgia", serif';
        ctx.fillText('THE C PROGRAMMING LANGUAGE', W / 2, 260, W - 36);
        ctx.font = '600 14px "Georgia", serif';
        ctx.fillText('KERNIGHAN · RITCHIE', W / 2, 290);
      } else {
        ctx.fillStyle = bandCol;
        ctx.fillRect(0, 24, W, 14);
        ctx.fillRect(0, H - 56, W, 8);
        // Subtle geometric cover motif (Calder circles / neural net / architecture grid)
        ctx.save();
        ctx.globalAlpha = 0.22;
        ctx.fillStyle = bandCol;
        ctx.beginPath();
        ctx.arc(W * 0.72, H * 0.62, 54, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = fg;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(28, H * 0.60);
        ctx.lineTo(W - 28, H * 0.56);
        ctx.stroke();
        ctx.restore();

        ctx.fillStyle = fg;
        ctx.textAlign = 'left';
        ctx.font = '700 24px "Inter", "DejaVu Sans", sans-serif';
        wrapTitle(spec.title || '', 24, 86, W - 44, 30, 3);
        ctx.font = '600 15px "Inter", "DejaVu Sans", sans-serif';
        ctx.globalAlpha = 0.88;
        ctx.fillText(spec.author || '', 24, 214, W - 44);
        ctx.globalAlpha = 1.0;
        if (style === 'mit') {
          drawMitPressColophon(ctx, 48, H - 26, 44, 20, fg);
        } else if (spec.pub) {
          ctx.font = '700 13px "Inter", "DejaVu Sans", sans-serif';
          ctx.fillText(spec.pub, 24, H - 22, W - 48);
        }
      }
    }

    drawWearAndGrain(ctx, W, H, this.rng, isCloth, spec.wear ?? 0.40);
    ctx.restore();

    const pad = 0.01;
    return {
      u0: (col + pad) / this.COVER_COLS,
      u1: (col + 1 - pad) / this.COVER_COLS,
      vTop: 1.0 - (row + pad) / this.COVER_ROWS,
      vBot: 1.0 - (row + 1 - pad) / this.COVER_ROWS,
    };
  }

  buildMaterials() {
    const maxAniso = Math.min(8, this.renderer ? this.renderer.capabilities.getMaxAnisotropy() : 4);
    const clothBump = createClothBumpTexture();

    const spineTex = new THREE.CanvasTexture(this.spineCanvas);
    spineTex.colorSpace = THREE.SRGBColorSpace;
    spineTex.anisotropy = maxAniso;

    const coverTex = new THREE.CanvasTexture(this.coverCanvas);
    coverTex.colorSpace = THREE.SRGBColorSpace;
    coverTex.anisotropy = maxAniso;

    const pageTex = createPageEdgesTexture();
    pageTex.anisotropy = maxAniso;

    const headbandTex = createHeadbandTexture();

    return {
      spineMat: new THREE.MeshStandardMaterial({
        map: spineTex,
        bumpMap: clothBump,
        bumpScale: 0.0014,
        roughness: 0.56,
        metalness: 0.05,
      }),
      frontCoverMat: new THREE.MeshStandardMaterial({
        map: coverTex,
        bumpMap: clothBump,
        bumpScale: 0.0014,
        roughness: 0.58,
        metalness: 0.04,
      }),
      boardMat: new THREE.MeshStandardMaterial({
        vertexColors: true,
        bumpMap: clothBump,
        bumpScale: 0.0016,
        roughness: 0.66,
        metalness: 0.03,
      }),
      pageMat: new THREE.MeshStandardMaterial({
        map: pageTex,
        vertexColors: true,
        roughness: 0.90,
        metalness: 0.0,
      }),
      headbandMat: new THREE.MeshStandardMaterial({
        map: headbandTex,
        vertexColors: true,
        roughness: 0.78,
        metalness: 0.02,
      }),
    };
  }
}

// ============================================================================
// Merged Detailed 3D Book Geometry Builder (Curved Spines, Overhanging Boards,
// French Hinge Grooves, Raised Bands, Inset Page Blocks, Woven Headbands!)
// ============================================================================

class MergedBookGeometry {
  constructor(atlas) {
    this.atlas = atlas;
    this.spineBuf = { pos: [], norm: [], uv: [] };
    this.frontCoverBuf = { pos: [], norm: [], uv: [] };
    this.boardBuf = { pos: [], norm: [], col: [] };
    this.pageBuf = { pos: [], norm: [], uv: [], col: [] };
    this.headbandBuf = { pos: [], norm: [], uv: [], col: [] };

    this._v = new THREE.Vector3();
    this._n = new THREE.Vector3();
    this._normMat = new THREE.Matrix3();
    this._col = new THREE.Color();
    this._colDark = new THREE.Color();
  }

  _pushQuad(buf, p0, p1, p2, p3, n0, n1, n2, n3, mat4, uvs = null, col = null) {
    this._normMat.getNormalMatrix(mat4);
    const pts = [p0, p1, p2, p0, p2, p3];
    const norms = [n0, n1, n2, n0, n2, n3];
    const uvIdx = [0, 1, 2, 0, 2, 3];
    for (let i = 0; i < 6; i++) {
      this._v.set(pts[i][0], pts[i][1], pts[i][2]).applyMatrix4(mat4);
      buf.pos.push(this._v.x, this._v.y, this._v.z);
      this._n.set(norms[i][0], norms[i][1], norms[i][2]).applyMatrix3(this._normMat).normalize();
      buf.norm.push(this._n.x, this._n.y, this._n.z);
      if (uvs && buf.uv) {
        const uv = uvs[uvIdx[i]];
        buf.uv.push(uv[0], uv[1]);
      }
      if (col && buf.col) {
        buf.col.push(col.r, col.g, col.b);
      }
    }
  }

  _pushFlatQuad(buf, p0, p1, p2, p3, n, mat4, uvs = null, col = null) {
    this._pushQuad(buf, p0, p1, p2, p3, n, n, n, n, mat4, uvs, col);
  }

  /**
   * Appends one physically accurate 3D book centered at local origin transformed by `mat4`:
   *   X = thickness [-bw/2, +bw/2]  (+X = front cover, -X = back cover)
   *   Y = height    [-bh/2, +bh/2]
   *   Z = depth     [-bd/2, +bd/2]  (+Z = curved spine facing room, -Z = fore-edge pages)
   */
  addBook(spec, mat4, needsFrontCover = false) {
    const bw = spec.w || 0.036;
    const bh = spec.h || 0.244;
    const bd = spec.d || 0.188;
    const isPaperback = spec.binding === 'paperback';

    const hw = bw * 0.5;
    const hh = bh * 0.5;
    const hd = bd * 0.5;

    // Hardcover boards overhang recessed page block; paperbacks are flush-trimmed
    const boardT = isPaperback ? 0.0010 : Math.min(0.0032, bw * 0.11);
    const overY = isPaperback ? 0.0005 : 0.0042;
    const overZ = isPaperback ? 0.0006 : 0.0048;
    const crown = isPaperback ? Math.min(0.0022, bw * 0.06) : Math.min(0.0068, bw * 0.17);

    // Draw spine into high-res atlas; draw detailed front cover if exposed (stacked, leaning, or end-of-row)
    const sUV = this.atlas.drawSpine(spec);
    const cUV = needsFrontCover ? this.atlas.drawFrontCover(spec) : null;

    this._col.set(spec.coverBg || spec.bg || '#2b3240');
    this._colDark.copy(this._col).multiplyScalar(0.76);

    // 1. CURVED CONVEX SPINE CROWN + FRENCH HINGE GROOVES (+Z side)
    //    Profile across t in [0, 1] from -hw to +hw: slight indented hinge groove at shoulders + smooth convex arch!
    const segs = isPaperback ? 4 : 6;
    const spineZAt = (t) => {
      const s = t * 2 - 1; // [-1, 1]
      const arch = Math.sqrt(Math.max(0, 1 - s * s * 0.92)) * crown;
      // Subtle French hinge groove right near t = 0.08 and t = 0.92 on hardcovers
      const groove = !isPaperback
        ? -0.0011 * (Math.exp(-Math.pow((t - 0.08) / 0.045, 2)) + Math.exp(-Math.pow((t - 0.92) / 0.045, 2)))
        : 0;
      return hd + arch + groove;
    };
    const spineNAt = (t) => {
      const dt = 0.01;
      const dz = spineZAt(Math.min(1, t + dt)) - spineZAt(Math.max(0, t - dt));
      const dx = bw * (Math.min(1, t + dt) - Math.max(0, t - dt));
      const nx = -dz;
      const nz = dx;
      const len = Math.hypot(nx, nz) || 1;
      return [nx / len, 0, nz / len];
    };

    for (let i = 0; i < segs; i++) {
      const t0 = i / segs;
      const t1 = (i + 1) / segs;
      const x0 = -hw + bw * t0;
      const x1 = -hw + bw * t1;
      const z0 = spineZAt(t0);
      const z1 = spineZAt(t1);
      const n0 = spineNAt(t0);
      const n1 = spineNAt(t1);
      const u0 = sUV.u0 + (sUV.u1 - sUV.u0) * t0;
      const u1 = sUV.u0 + (sUV.u1 - sUV.u0) * t1;

      this._pushQuad(
        this.spineBuf,
        [x0, -hh, z0], [x1, -hh, z1], [x1, hh, z1], [x0, hh, z0],
        n0, n1, n1, n0,
        mat4,
        [[u0, sUV.vBot], [u1, sUV.vBot], [u1, sUV.vTop], [u0, sUV.vTop]]
      );

      // Top & bottom thin spine-cap lip connecting outer crown inward to the spine back
      const zIn = hd - boardT * 0.9;
      this._pushFlatQuad(
        this.boardBuf,
        [x0, hh, z0], [x1, hh, z1], [x1, hh, zIn], [x0, hh, zIn],
        [0, 1, 0], mat4, null, this._colDark
      );
      this._pushFlatQuad(
        this.boardBuf,
        [x0, -hh, zIn], [x1, -hh, zIn], [x1, -hh, z1], [x0, -hh, z0],
        [0, -1, 0], mat4, null, this._colDark
      );
    }

    // Optional 3D raised horizontal spine bands/hubs on prestige cloth hardcovers (Knuth TAOCP, Stevens, Rudin, SICP)
    // Placed cleanly above & below the vertical title/author lettering (never occluding text!)
    if (spec.raisedBands && !isPaperback) {
      const bandYs = [-hh * 0.68, -hh * 0.60, hh * 0.60, hh * 0.68];
      const bandH = 0.0036;
      const bandP = 0.0014;
      for (const by of bandYs) {
        for (let i = 0; i < segs; i++) {
          const t0 = i / segs;
          const t1 = (i + 1) / segs;
          const x0 = -hw + bw * t0;
          const x1 = -hw + bw * t1;
          const z0 = spineZAt(t0);
          const z1 = spineZAt(t1);
          const n0 = spineNAt(t0);
          const n1 = spineNAt(t1);
          // Raised face
          this._pushQuad(
            this.boardBuf,
            [x0, by - bandH * 0.5, z0 + bandP], [x1, by - bandH * 0.5, z1 + bandP],
            [x1, by + bandH * 0.5, z1 + bandP], [x0, by + bandH * 0.5, z0 + bandP],
            n0, n1, n1, n0, mat4, null, this._col
          );
          // Upper & lower bevels of rib so it catches grazing window light
          this._pushFlatQuad(
            this.boardBuf,
            [x0, by + bandH * 0.5, z0 + bandP], [x1, by + bandH * 0.5, z1 + bandP],
            [x1, by + bandH * 0.85, z1], [x0, by + bandH * 0.85, z0],
            [0, 0.7, 0.7], mat4, null, this._col
          );
          this._pushFlatQuad(
            this.boardBuf,
            [x0, by - bandH * 0.85, z0], [x1, by - bandH * 0.85, z1],
            [x1, by - bandH * 0.5, z1 + bandP], [x0, by - bandH * 0.5, z0 + bandP],
            [0, -0.7, 0.7], mat4, null, this._colDark
          );
        }
      }
    }

    // 2. FRONT (+X) & BACK (-X) COVER BOARDS WITH REAL THICKNESS & OVERHANGING LIPS!
    const pgHw = hw - boardT;
    const pgHh = hh - overY;
    const pgFrontZ = hd - boardT * 1.05;
    const pgBackZ = -hd + overZ;

    // Front cover outer face (+X): UV-mapped front cover art if exposed, else rich cloth board
    if (cUV) {
      this._pushFlatQuad(
        this.frontCoverBuf,
        [hw, -hh, hd], [hw, -hh, -hd], [hw, hh, -hd], [hw, hh, hd],
        [1, 0, 0], mat4,
        [[cUV.u0, cUV.vBot], [cUV.u1, cUV.vBot], [cUV.u1, cUV.vTop], [cUV.u0, cUV.vTop]]
      );
    } else {
      this._pushFlatQuad(
        this.boardBuf,
        [hw, -hh, hd], [hw, -hh, -hd], [hw, hh, -hd], [hw, hh, hd],
        [1, 0, 0], mat4, null, this._col
      );
    }

    // Back cover outer face (-X)
    this._pushFlatQuad(
      this.boardBuf,
      [-hw, -hh, -hd], [-hw, -hh, hd], [-hw, hh, hd], [-hw, hh, -hd],
      [-1, 0, 0], mat4, null, this._col
    );

    // Front & back cover board edge rims (top, bottom, fore-edge) + inner pastedown overhang returns!
    for (const side of [1, -1]) {
      const xOut = side * hw;
      const xIn = side * pgHw;
      const xMin = Math.min(xOut, xIn);
      const xMax = Math.max(xOut, xIn);

      // Top rim (+Y)
      this._pushFlatQuad(this.boardBuf, [xMin, hh, hd], [xMax, hh, hd], [xMax, hh, -hd], [xMin, hh, -hd], [0, 1, 0], mat4, null, this._col);
      // Bottom rim (-Y)
      this._pushFlatQuad(this.boardBuf, [xMin, -hh, -hd], [xMax, -hh, -hd], [xMax, -hh, hd], [xMin, -hh, hd], [0, -1, 0], mat4, null, this._colDark);
      // Fore-edge rim (-Z)
      this._pushFlatQuad(this.boardBuf, [xMax, -hh, -hd], [xMin, -hh, -hd], [xMin, hh, -hd], [xMax, hh, -hd], [0, 0, -1], mat4, null, this._col);

      // Inner overhanging pastedown return lips facing the recessed page block (creates real crisp 3D shadow recess!)
      if (!isPaperback) {
        const innerNorm = [-side, 0, 0];
        if (side === 1) {
          // Top inner overhang lip
          this._pushFlatQuad(this.boardBuf, [xIn, pgHh, -hd], [xIn, pgHh, hd], [xIn, hh, hd], [xIn, hh, -hd], innerNorm, mat4, null, this._colDark);
          // Bottom inner overhang lip
          this._pushFlatQuad(this.boardBuf, [xIn, -hh, -hd], [xIn, -hh, hd], [xIn, -pgHh, hd], [xIn, -pgHh, -hd], innerNorm, mat4, null, this._colDark);
          // Fore-edge inner overhang lip
          this._pushFlatQuad(this.boardBuf, [xIn, -pgHh, -hd], [xIn, -pgHh, pgBackZ], [xIn, pgHh, pgBackZ], [xIn, pgHh, -hd], innerNorm, mat4, null, this._colDark);
        } else {
          this._pushFlatQuad(this.boardBuf, [xIn, pgHh, hd], [xIn, pgHh, -hd], [xIn, hh, -hd], [xIn, hh, hd], innerNorm, mat4, null, this._colDark);
          this._pushFlatQuad(this.boardBuf, [xIn, -hh, hd], [xIn, -hh, -hd], [xIn, -pgHh, -hd], [xIn, -pgHh, hd], innerNorm, mat4, null, this._colDark);
          this._pushFlatQuad(this.boardBuf, [xIn, -pgHh, pgBackZ], [xIn, -pgHh, -hd], [xIn, pgHh, -hd], [xIn, pgHh, pgBackZ], innerNorm, mat4, null, this._colDark);
        }
      }
    }

    // 3. RECESSED CREAM PAPER PAGE BLOCK WITH FINELY STRIPED PAGE-LEAF TEXTURE & SLIGHT CONCAVE FORE-EDGE!
    //    Per-book paper aging tint (bright ivory for newer books -> warm vintage cream for older classics)
    const age = spec.pageAge ?? 0.35;
    const pageCol = new THREE.Color().setRGB(
      1.0 - age * 0.05,
      0.985 - age * 0.08,
      0.945 - age * 0.14
    );
    const topDustCol = pageCol.clone().multiplyScalar(0.92); // subtle dust/ambient occlusion on top edge

    // Top page edge (+Y): UV V runs across book thickness (-pgHw..+pgHw) so horizontal texture lines represent individual pages!
    const leafRepeats = Math.max(0.6, bw / 0.036);
    this._pushFlatQuad(
      this.pageBuf,
      [-pgHw, pgHh, pgFrontZ], [pgHw, pgHh, pgFrontZ], [pgHw, pgHh, pgBackZ], [-pgHw, pgHh, pgBackZ],
      [0, 1, 0], mat4,
      [[0, 0], [0, leafRepeats], [1, leafRepeats], [1, 0]],
      topDustCol
    );
    // Bottom page edge (-Y)
    this._pushFlatQuad(
      this.pageBuf,
      [-pgHw, -pgHh, pgBackZ], [pgHw, -pgHh, pgBackZ], [pgHw, -pgHh, pgFrontZ], [-pgHw, -pgHh, pgFrontZ],
      [0, -1, 0], mat4,
      [[1, 0], [1, leafRepeats], [0, leafRepeats], [0, 0]],
      pageCol
    );
    // Slightly concave 3-segment fore-edge (-Z) matching real Smyth-sewn / rounded-spine books!
    const foreSegs = 3;
    const foreConcave = isPaperback ? 0.0006 : Math.min(0.0032, bw * 0.08);
    for (let i = 0; i < foreSegs; i++) {
      const t0 = i / foreSegs;
      const t1 = (i + 1) / foreSegs;
      const x0 = -pgHw + (2 * pgHw) * t0;
      const x1 = -pgHw + (2 * pgHw) * t1;
      const s0 = t0 * 2 - 1;
      const s1 = t1 * 2 - 1;
      const z0 = pgBackZ + Math.sqrt(Math.max(0, 1 - s0 * s0 * 0.92)) * foreConcave;
      const z1 = pgBackZ + Math.sqrt(Math.max(0, 1 - s1 * s1 * 0.92)) * foreConcave;
      this._pushFlatQuad(
        this.pageBuf,
        [x1, -pgHh, z1], [x0, -pgHh, z0], [x0, pgHh, z0], [x1, pgHh, z1],
        [0, 0, -1], mat4,
        [[0, t1 * leafRepeats], [0, t0 * leafRepeats], [1, t0 * leafRepeats], [1, t1 * leafRepeats]],
        pageCol
      );
    }

    // 4. WOVEN FABRIC HEADBAND & TAILBAND (ENDBANDS) TUCKED BETWEEN SPINE & PAGE BLOCK ON HARDCOVERS!
    if (!isPaperback) {
      const hbCol = new THREE.Color(spec.headband || '#e8dfc8');
      const hbH = Math.min(overY * 0.72, 0.0028);
      const hbZ0 = pgFrontZ - 0.0024;
      const hbZ1 = pgFrontZ + 0.0014;
      // Top headband (+Y)
      this._pushFlatQuad(
        this.headbandBuf,
        [-pgHw, pgHh + hbH, hbZ1], [pgHw, pgHh + hbH, hbZ1], [pgHw, pgHh + hbH, hbZ0], [-pgHw, pgHh + hbH, hbZ0],
        [0, 1, 0], mat4, [[0, 0], [1, 0], [1, 1], [0, 1]], hbCol
      );
      this._pushFlatQuad(
        this.headbandBuf,
        [pgHw, pgHh, hbZ0], [-pgHw, pgHh, hbZ0], [-pgHw, pgHh + hbH, hbZ0], [pgHw, pgHh + hbH, hbZ0],
        [0, 0, -1], mat4, [[1, 0], [0, 0], [0, 1], [1, 1]], hbCol
      );
      // Bottom tailband (-Y)
      this._pushFlatQuad(
        this.headbandBuf,
        [-pgHw, -pgHh - hbH, hbZ0], [pgHw, -pgHh - hbH, hbZ0], [pgHw, -pgHh - hbH, hbZ1], [-pgHw, -pgHh - hbH, hbZ1],
        [0, -1, 0], mat4, [[0, 0], [1, 0], [1, 1], [0, 1]], hbCol
      );
    }
  }

  finalizeInto(parent, castShadow = false) {
    const mats = this.atlas.buildMaterials();
    const entries = [
      [this.spineBuf, mats.spineMat],
      [this.frontCoverBuf, mats.frontCoverMat],
      [this.boardBuf, mats.boardMat],
      [this.pageBuf, mats.pageMat],
      [this.headbandBuf, mats.headbandMat],
    ];
    for (const [buf, mat] of entries) {
      if (buf.pos.length === 0) continue;
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(buf.pos, 3));
      g.setAttribute('normal', new THREE.Float32BufferAttribute(buf.norm, 3));
      if (buf.uv && buf.uv.length > 0) g.setAttribute('uv', new THREE.Float32BufferAttribute(buf.uv, 2));
      if (buf.col && buf.col.length > 0) g.setAttribute('color', new THREE.Float32BufferAttribute(buf.col, 3));
      const mesh = new THREE.Mesh(g, mat);
      mesh.castShadow = castShadow;
      mesh.receiveShadow = true;
      parent.add(mesh);
    }
  }
}

// ============================================================================
// Researched Curated Catalog: Classic CS & Springer Mathematics Bookshelf
// ============================================================================

const SHELVES_SPEC = [
  // ── Shelf 0 (y = 0.14): Networking, Distributed Systems, Security & Math Foundations ──
  {
    items: [
      { title: 'TCP/IP ILLUSTRATED VOL. 1', author: 'W. R. STEVENS', bg: '#1b3150', band: '#c8a654', fg: '#f4f0e6', pub: 'ADDISON-WESLEY', w: 0.044, h: 0.246, d: 0.190, raisedBands: true, pageAge: 0.55 },
      { title: 'TCP/IP ILLUSTRATED VOL. 2', author: 'WRIGHT & STEVENS', bg: '#172b46', band: '#c8a654', fg: '#f4f0e6', pub: 'ADDISON-WESLEY', w: 0.056, h: 0.246, d: 0.192, raisedBands: true, pageAge: 0.55 },
      { title: 'UNIX NETWORK PROGRAMMING', author: 'W. R. STEVENS', bg: '#1e3756', band: '#b83c32', fg: '#f4f0e6', pub: 'ADDISON-WESLEY', w: 0.050, h: 0.245, d: 0.190, raisedBands: true, pageAge: 0.50 },
      { style: 'oreilly', binding: 'paperback', title: 'DESIGNING DATA-INTENSIVE APPS', author: 'MARTIN KLEPPMANN', bg: '#f6f5f0', band: '#b8242a', fg: '#16181e', w: 0.036, h: 0.233, d: 0.178, wear: 0.65, pageAge: 0.22 },
      { title: 'COMPUTER NETWORKS', author: 'A. S. TANENBAUM', bg: '#194b58', band: '#e0a938', fg: '#f4f6f8', pub: 'PEARSON', w: 0.048, h: 0.244, d: 0.192, pageAge: 0.40 },
      { title: 'SYSTEMS PERFORMANCE', author: 'BRENDAN GREGG', bg: '#681b24', band: '#1b1d22', fg: '#f5efe6', pub: 'ADDISON-WESLEY', w: 0.046, h: 0.238, d: 0.184, pageAge: 0.25 },
      { title: "HACKER'S DELIGHT", author: 'HENRY S. WARREN', bg: '#1f4434', band: '#d4b252', fg: '#f4f0e4', pub: 'ADDISON-WESLEY', w: 0.034, h: 0.240, d: 0.176, raisedBands: true, pageAge: 0.45 },
      { style: 'oreilly', binding: 'paperback', title: 'DATABASE INTERNALS', author: 'ALEX PETROV', bg: '#f5f4ef', band: '#32488e', fg: '#161820', w: 0.026, h: 0.233, d: 0.178, pageAge: 0.18 },
      { binding: 'paperback', title: 'CRAFTING INTERPRETERS', author: 'ROBERT NYSTROM', bg: '#ede4d2', band: '#b84a2a', fg: '#231d18', pub: 'GENEVERD', w: 0.038, h: 0.236, d: 0.182, pageAge: 0.20 },
      // Compact iconic "Baby Rudin" (dark blue McGraw-Hill cloth octavo)
      { title: 'PRINCIPLES OF MATH. ANALYSIS', author: 'WALTER RUDIN', bg: '#1d365c', band: '#8ea8c8', fg: '#f4f6fa', pub: 'MCGRAW-HILL', w: 0.024, h: 0.228, d: 0.156, raisedBands: true, pageAge: 0.72, wear: 0.75 },
      { title: 'ALGEBRA', author: 'MICHAEL ARTIN', bg: '#5d222e', band: '#d9c59a', fg: '#f6f0e4', pub: 'PEARSON', w: 0.042, h: 0.242, d: 0.186, raisedBands: true, pageAge: 0.50 },
      { binding: 'paperback', title: 'THE UNIX PROG. ENVIRONMENT', author: 'KERNIGHAN & PIKE', bg: '#f3f1ea', band: '#28568f', fg: '#161a22', pub: 'PRENTICE HALL', w: 0.022, h: 0.228, d: 0.172, pageAge: 0.68, wear: 0.70 },
      { title: 'DESIGN PATTERNS', author: 'GAMMA ET AL.', bg: '#27303e', band: '#b89648', fg: '#f2eee4', pub: 'ADDISON-WESLEY', w: 0.032, h: 0.240, d: 0.188, pageAge: 0.48 },
      { title: 'THE C++ PROG. LANGUAGE', author: 'B. STROUSTRUP', bg: '#182438', band: '#c43e32', fg: '#f6f4ee', pub: 'ADDISON-WESLEY', w: 0.058, h: 0.244, d: 0.194, pageAge: 0.35 },
      { title: 'ELEMENTS OF INFO. THEORY', author: 'COVER & THOMAS', bg: '#26443a', band: '#c8a652', fg: '#f4f2e8', pub: 'WILEY', w: 0.042, h: 0.242, d: 0.168, pageAge: 0.42 },
      // Casual leaning paperback resting against the row!
      {
        lean: 0.26,
        book: { title: 'PROBABILITY & RANDOM PROC.', author: 'GRIMMETT & STIRZAKER', bg: '#1e365c', band: '#e4e6ec', fg: '#f5f6fa', pub: 'OXFORD', w: 0.038, h: 0.238, d: 0.168, pageAge: 0.38 },
      },
      { gap: 0.035 },
      // Horizontal stack of 3 iconic Security / Binary Analysis classics (exposing crisp front covers!)
      {
        stack: [
          { title: "THE SHELLCODER'S HANDBOOK", author: 'ANLEY · HEASMAN · LINDNER', bg: '#5a1e28', band: '#d4b46a', fg: '#f6f2ea', pub: 'WILEY', w: 0.044, h: 0.238, d: 0.188, pageAge: 0.40 },
          { style: 'nostarch', binding: 'paperback', title: 'HACKING: ART OF EXPLOITATION', author: 'JON ERICKSON', bg: '#15181e', band: '#2e9e56', fg: '#e8f5ec', bandFg: '#0e1210', w: 0.034, h: 0.234, d: 0.180, wear: 0.65, pageAge: 0.45 },
          { style: 'nostarch', binding: 'paperback', title: 'PRACTICAL BINARY ANALYSIS', author: 'DENNIS ANDRIESSE', bg: '#171a20', band: '#d98c24', fg: '#f4f2ec', bandFg: '#121418', w: 0.032, h: 0.232, d: 0.178, pageAge: 0.22 },
          { style: 'nostarch', binding: 'paperback', title: 'SERIOUS CRYPTOGRAPHY', author: 'J.-P. AUMASSON', bg: '#171c26', band: '#3296c8', fg: '#eef6fc', bandFg: '#0e141c', w: 0.024, h: 0.228, d: 0.174, pageAge: 0.18 },
        ],
      },
    ],
  },

  // ── Shelf 1 (y = 0.54): Authentic Springer Yellow UTM + Modern Springer SUMS Paperbacks ──
  {
    items: [
      { style: 'utm', title: 'LINEAR ALGEBRA DONE RIGHT', author: 'SHELDON AXLER', bg: '#f4cb20', w: 0.028, h: 0.236, d: 0.158, pageAge: 0.24 },
      { style: 'utm', title: 'UNDERSTANDING ANALYSIS', author: 'STEPHEN ABBOTT', bg: '#eec118', w: 0.024, h: 0.235, d: 0.156, pageAge: 0.34 },
      { style: 'utm', title: 'MATHEMATICS & ITS HISTORY', author: 'JOHN STILLWELL', bg: '#f2c81c', w: 0.042, h: 0.238, d: 0.160, pageAge: 0.42 },
      { style: 'utm', title: 'NAIVE SET THEORY', author: 'PAUL R. HALMOS', bg: '#e6b818', w: 0.018, h: 0.234, d: 0.155, wear: 0.72, pageAge: 0.66 },
      { style: 'utm', title: 'ELEMENTARY ANALYSIS', author: 'KENNETH A. ROSS', bg: '#f0c51c', w: 0.028, h: 0.236, d: 0.158, pageAge: 0.38 },
      { style: 'utm', title: 'TOPOLOGY', author: 'KLAUS JÄNICH', bg: '#ebc018', w: 0.022, h: 0.234, d: 0.156, pageAge: 0.48 },
      { style: 'utm', title: 'ANALYTIC NUMBER THEORY', author: 'TOM M. APOSTOL', bg: '#e8bc16', w: 0.032, h: 0.237, d: 0.158, pageAge: 0.58 },
      { style: 'utm', title: 'IDEALS, VARIETIES & ALGORITHMS', author: "COX, LITTLE, O'SHEA", bg: '#f4ca1e', w: 0.044, h: 0.238, d: 0.160, pageAge: 0.30 },
      { style: 'utm', title: 'ELLIPTIC CURVES', author: 'SILVERMAN & TATE', bg: '#efc31a', w: 0.026, h: 0.235, d: 0.157, pageAge: 0.40 },
      { style: 'utm', title: 'REAL MATHEMATICAL ANALYSIS', author: 'CHARLES C. PUGH', bg: '#f3c91d', w: 0.036, h: 0.237, d: 0.158, pageAge: 0.28 },
      {
        lean: 0.28,
        book: { style: 'utm', title: 'NUMBERS AND GEOMETRY', author: 'JOHN STILLWELL', bg: '#ebc01a', w: 0.030, h: 0.235, d: 0.158, pageAge: 0.44 },
      },
      { vase: 0xd9cbb8 },
      // Researched authentic Springer SUMS paperbacks (clean modern white/light spines with vivid geometric bands!)
      { style: 'sums', binding: 'paperback', title: 'ELEMENTARY NUMBER THEORY', author: 'JONES & JONES', bg: '#f4f5f8', band: '#1d5fa6', fg: '#162030', w: 0.024, h: 0.232, d: 0.156, pageAge: 0.26 },
      { style: 'sums', binding: 'paperback', title: 'METRIC & TOPOLOGICAL SPACES', author: 'W. A. SUTHERLAND', bg: '#eef3f8', band: '#24768c', fg: '#162230', w: 0.022, h: 0.232, d: 0.155, pageAge: 0.28 },
      { style: 'sums', binding: 'paperback', title: 'BASIC LINEAR ALGEBRA', author: 'BLYTH & ROBERTSON', bg: '#f5f6f8', band: '#2c4f8e', fg: '#162030', w: 0.024, h: 0.232, d: 0.156, pageAge: 0.30 },
      { style: 'sums', binding: 'paperback', title: 'COMPLEX ANALYSIS', author: 'JOHN M. HOWIE', bg: '#f4f6f9', band: '#1d6c64', fg: '#162228', w: 0.024, h: 0.232, d: 0.156, pageAge: 0.24 },
      { style: 'sums', binding: 'paperback', title: 'INTRO. TO LIE ALGEBRAS', author: 'ERDMANN & WILDON', bg: '#f5f4f8', band: '#4a3c88', fg: '#181828', w: 0.026, h: 0.232, d: 0.156, pageAge: 0.20 },
      { style: 'sums', binding: 'paperback', title: 'MEASURE, INTEGRAL & PROB.', author: 'CAPINSKI & KOPP', bg: '#f4f6f8', band: '#1c5a99', fg: '#162030', w: 0.026, h: 0.232, d: 0.156, pageAge: 0.26 },
      { style: 'sums', binding: 'paperback', title: 'GROUPS, RINGS & FIELDS', author: 'D. A. R. WALLACE', bg: '#f5f5f7', band: '#286694', fg: '#162030', w: 0.024, h: 0.232, d: 0.156, pageAge: 0.32 },
      { style: 'sums', binding: 'paperback', title: 'ELEMENTARY DIFF. GEOMETRY', author: 'ANDREW PRESSLEY', bg: '#f6f5f2', band: '#a64d28', fg: '#221a16', w: 0.032, h: 0.234, d: 0.158, pageAge: 0.22 },
      { gap: 0.03 },
      {
        stack: [
          { style: 'sums', binding: 'paperback', title: 'DISCRETE MATHEMATICS', author: 'NORMAN L. BIGGS', bg: '#f4f6f9', band: '#1f5e9e', fg: '#162030', w: 0.030, h: 0.234, d: 0.158, pageAge: 0.28 },
          { style: 'sums', binding: 'paperback', title: 'FIELDS AND GALOIS THEORY', author: 'JOHN M. HOWIE', bg: '#f5f5f8', band: '#207268', fg: '#162426', w: 0.024, h: 0.232, d: 0.156, pageAge: 0.22 },
          { style: 'sums', binding: 'paperback', title: 'VECTOR CALCULUS', author: 'P. C. MATTHEWS', bg: '#f6f5f2', band: '#3a4f8c', fg: '#162030', w: 0.022, h: 0.230, d: 0.155, pageAge: 0.26 },
        ],
      },
    ],
  },

  // ── Shelf 2 (Hero Center Shelf, y = 0.94): Iconic Springer Yellow GTM Library + Hartshorne Stack! ──
  {
    items: [
      { style: 'gtm', vol: '9', title: 'INTRO. TO LIE ALGEBRAS', author: 'J. E. HUMPHREYS', bg: '#ecc018', w: 0.024, h: 0.236, d: 0.158, pageAge: 0.56, wear: 0.62 },
      { style: 'gtm', vol: '60', title: 'MATH. METHODS CLASS. MECH.', author: 'V. I. ARNOLD', bg: '#f2c81c', w: 0.036, h: 0.238, d: 0.160, pageAge: 0.44 },
      { style: 'gtm', vol: '73', title: 'ALGEBRA', author: 'T. W. HUNGERFORD', bg: '#e9bd16', w: 0.038, h: 0.237, d: 0.160, pageAge: 0.54, wear: 0.58 },
      { style: 'gtm', vol: '84', title: 'MODERN NUMBER THEORY', author: 'IRELAND & ROSEN', bg: '#f3ca1e', w: 0.030, h: 0.236, d: 0.158, pageAge: 0.42 },
      { style: 'gtm', vol: '96', title: 'FUNCTIONAL ANALYSIS', author: 'JOHN B. CONWAY', bg: '#f0c51a', w: 0.032, h: 0.236, d: 0.158, pageAge: 0.46 },
      { style: 'gtm', vol: '103', title: 'COMPLEX ANALYSIS', author: 'SERGE LANG', bg: '#ebbf18', w: 0.036, h: 0.238, d: 0.160, pageAge: 0.50 },
      { style: 'gtm', vol: '150', title: 'COMMUTATIVE ALGEBRA', author: 'DAVID EISENBUD', bg: '#f5cd20', w: 0.052, h: 0.240, d: 0.164, pageAge: 0.30 },
      { style: 'gtm', vol: '173', title: 'GRAPH THEORY', author: 'REINHARD DIESTEL', bg: '#f2c71c', w: 0.030, h: 0.236, d: 0.158, pageAge: 0.28 },
      { style: 'gtm', vol: '211', title: 'ALGEBRA (REV. 3RD ED.)', author: 'SERGE LANG', bg: '#f4cb1f', w: 0.056, h: 0.240, d: 0.164, pageAge: 0.34, wear: 0.55 },
      { style: 'gtm', vol: '218', title: 'INTRO. TO SMOOTH MANIFOLDS', author: 'JOHN M. LEE', bg: '#f6ce22', w: 0.046, h: 0.239, d: 0.162, pageAge: 0.22 },
      { style: 'gtm', vol: '222', title: 'LIE GROUPS & REPRESENTATIONS', author: 'BRIAN C. HALL', bg: '#f1c71c', w: 0.036, h: 0.237, d: 0.160, pageAge: 0.26 },
      { style: 'gtm', vol: '42', title: 'LINEAR REP. FINITE GROUPS', author: 'J.-P. SERRE', bg: '#e6b916', w: 0.022, h: 0.234, d: 0.156, pageAge: 0.62, wear: 0.68 },
      { style: 'gtm', vol: '267', title: 'QUANTUM THEORY FOR MATH.', author: 'BRIAN C. HALL', bg: '#f4cc20', w: 0.038, h: 0.238, d: 0.160, pageAge: 0.20 },
      { style: 'gtm', vol: '5', title: 'CATEGORIES WORKING MATH.', author: 'SAUNDERS MAC LANE', bg: '#e9be16', w: 0.028, h: 0.236, d: 0.158, pageAge: 0.58, wear: 0.60 },
      { style: 'gtm', vol: '176', title: 'RIEMANNIAN MANIFOLDS', author: 'JOHN M. LEE', bg: '#f2c81d', w: 0.028, h: 0.236, d: 0.158, pageAge: 0.30 },
      // Casual leaning GTM volume resting organically against the upright row!
      {
        lean: 0.27,
        book: { style: 'gtm', vol: '275', title: 'PROBABILITY & STOCHASTICS', author: 'ERHAN ÇINLAR', bg: '#f3ca1e', w: 0.038, h: 0.238, d: 0.160, pageAge: 0.24 },
      },
      { gap: 0.04 },
      // Horizontal stack of 3 iconic Springer GTM volumes with Hartshorne GTM 52 proudly on top!
      {
        stack: [
          { style: 'gtm', vol: '106', title: 'ARITHMETIC ELLIPTIC CURVES', author: 'J. H. SILVERMAN', bg: '#efc21a', w: 0.036, h: 0.238, d: 0.160, pageAge: 0.38 },
          { style: 'gtm', vol: '207', title: 'COURSE IN COMBINATORICS', author: 'VAN LINT & WILSON', bg: '#f3ca1e', w: 0.036, h: 0.238, d: 0.160, pageAge: 0.32 },
          { style: 'gtm', vol: '52', title: 'ALGEBRAIC GEOMETRY', author: 'ROBIN HARTSHORNE', bg: '#ecc016', w: 0.038, h: 0.236, d: 0.158, wear: 0.68, pageAge: 0.56 },
        ],
      },
      { vase: 0x395853 },
    ],
  },

  // ── Shelf 3 (y = 1.34): Computer Architecture & Operating Systems + Cirrus SR22 Showcase! ──
  {
    maxSpan: 1.02, // Stops well left of Cirrus SR22 at sr22X = 0.46!
    leftAligned: true,
    items: [
      { title: 'COMPUTER ARCHITECTURE', author: 'HENNESSY & PATTERSON', bg: '#1b2c4e', band: '#b5342a', fg: '#f6f2e8', vol: '6TH ED', pub: 'MORGAN KAUFMANN', w: 0.052, h: 0.248, d: 0.194, pageAge: 0.28 },
      { title: 'COMPUTER ORG. & DESIGN', author: 'PATTERSON & HENNESSY', bg: '#1e4274', band: '#d6a438', fg: '#f6f6fa', vol: 'RISC-V', pub: 'MORGAN KAUFMANN', w: 0.046, h: 0.244, d: 0.192, pageAge: 0.24 },
      { title: 'COMPUTER SYSTEMS (CS:APP)', author: "BRYANT & O'HALLARON", bg: '#1b365d', band: '#df7224', fg: '#ffffff', vol: '3RD ED', pub: 'PEARSON', w: 0.056, h: 0.258, d: 0.204, pageAge: 0.32 },
      { title: 'DIGITAL DESIGN & COMP. ARCH.', author: 'HARRIS & HARRIS', bg: '#263a47', band: '#4da6a6', fg: '#f2f6f8', pub: 'MORGAN KAUFMANN', w: 0.038, h: 0.242, d: 0.190, pageAge: 0.30 },
      { binding: 'paperback', title: 'MASSIVELY PARALLEL PROC.', author: 'HWU, KIRK, EL HAJJ', bg: '#161b18', band: '#76b900', fg: '#f2f8ee', vol: 'CUDA', pub: 'MORGAN KAUFMANN', w: 0.034, h: 0.236, d: 0.184, pageAge: 0.20 },
      { binding: 'paperback', title: 'OPERATING SYSTEMS: OSTEP', author: 'ARPACI-DUSSEAU', bg: '#f4f2ec', band: '#d45d28', fg: '#161a24', pub: 'OSTEP', w: 0.042, h: 0.242, d: 0.184, pageAge: 0.24 },
      { title: 'MODERN OPERATING SYSTEMS', author: 'A. S. TANENBAUM', bg: '#962026', band: '#1a1c22', fg: '#f8f4ee', vol: '4TH ED', pub: 'PEARSON', w: 0.052, h: 0.246, d: 0.194, pageAge: 0.38 },
      { title: 'OPERATING SYSTEM CONCEPTS', author: 'SILBERSCHATZ ET AL.', bg: '#1b505a', band: '#d9a438', fg: '#f5f8fa', vol: '10TH', pub: 'WILEY', w: 0.050, h: 0.252, d: 0.198, pageAge: 0.34 },
      { title: 'ADV. PROG. UNIX ENVIRONMENT', author: 'W. R. STEVENS', bg: '#1a4434', band: '#d4b254', fg: '#f6f2e6', vol: 'APUE', pub: 'ADDISON-WESLEY', w: 0.052, h: 0.246, d: 0.190, raisedBands: true, pageAge: 0.50 },
      // Iconic towering 62mm thick No Starch TLPI tome!
      { style: 'nostarch', title: 'LINUX PROGRAMMING INTERFACE', author: 'MICHAEL KERRISK', bg: '#16181c', band: '#e6b828', fg: '#f6f6f2', bandFg: '#14161a', vol: 'TLPI', w: 0.062, h: 0.256, d: 0.198, pageAge: 0.26, wear: 0.55 },
      { binding: 'paperback', title: 'LINUX KERNEL DEVELOPMENT', author: 'ROBERT LOVE', bg: '#2c3442', band: '#c43a32', fg: '#f4f6fa', pub: 'ADDISON-WESLEY', w: 0.028, h: 0.232, d: 0.178, pageAge: 0.42 },
      { title: 'DESIGN & IMPL. OF FREEBSD', author: 'MCKUSICK ET AL.', bg: '#6e1e2a', band: '#ebe6dc', fg: '#f8f4ee', pub: 'ADDISON-WESLEY', w: 0.044, h: 0.244, d: 0.188, pageAge: 0.38 },
      { style: 'oreilly', binding: 'paperback', title: 'UNDERSTANDING LINUX KERNEL', author: 'BOVET & CESATI', bg: '#f5f4ee', band: '#1d6b6e', fg: '#161a20', w: 0.046, h: 0.234, d: 0.178, wear: 0.62, pageAge: 0.46 },
      { title: 'MEMORY SYSTEMS: CACHE/DRAM', author: 'JACOB, NG, WANG', bg: '#2c323a', band: '#c88832', fg: '#f4f2ec', pub: 'MORGAN KAUFMANN', w: 0.048, h: 0.246, d: 0.192, pageAge: 0.34 },
      // Leaning gently inward against the row, framing the Cirrus SR22 showcase cleanly!
      {
        lean: 0.25,
        book: { title: 'PARALLEL COMPUTER ARCH.', author: 'CULLER & SINGH', bg: '#342a44', band: '#d0b060', fg: '#f6f2ea', pub: 'MORGAN KAUFMANN', w: 0.046, h: 0.244, d: 0.190, pageAge: 0.42 },
      },
    ],
  },

  // ── Shelf 4 (Top Hero Shelf, y = 1.74): Authentic Navy-Cloth Knuth TAOCP + CS Classics + ML Stack ──
  {
    items: [
      // Researched authentic Addison-Wesley uniform dark navy cloth with gold-foil rules & raised hubs!
      { style: 'knuth', vol: 'VOL. 1', title: 'FUNDAMENTAL ALGORITHMS', author: 'DONALD E. KNUTH', bg: '#162540', fg: '#e4c66c', w: 0.044, h: 0.244, d: 0.174, raisedBands: true, headband: '#d8b45c', pageAge: 0.34 },
      { style: 'knuth', vol: 'VOL. 2', title: 'SEMINUMERICAL ALGORITHMS', author: 'DONALD E. KNUTH', bg: '#162540', fg: '#e4c66c', w: 0.046, h: 0.244, d: 0.174, raisedBands: true, headband: '#d8b45c', pageAge: 0.34 },
      { style: 'knuth', vol: 'VOL. 3', title: 'SORTING AND SEARCHING', author: 'DONALD E. KNUTH', bg: '#162540', fg: '#e4c66c', w: 0.048, h: 0.244, d: 0.174, raisedBands: true, headband: '#d8b45c', pageAge: 0.34 },
      { style: 'knuth', vol: 'VOL. 4A', title: 'COMBINATORIAL ALGORITHMS', author: 'DONALD E. KNUTH', bg: '#162540', fg: '#e4c66c', w: 0.052, h: 0.244, d: 0.174, raisedBands: true, headband: '#d8b45c', pageAge: 0.28 },
      { style: 'knuth', vol: 'VOL. 4B', title: 'COMBINATORIAL ALG. PT. 2', author: 'DONALD E. KNUTH', bg: '#162540', fg: '#e4c66c', w: 0.044, h: 0.244, d: 0.174, raisedBands: true, headband: '#d8b45c', pageAge: 0.22 },
      { title: 'CONCRETE MATHEMATICS', author: 'GRAHAM, KNUTH, PATASHNIK', bg: '#223856', band: '#e4d5b4', fg: '#f4f0e4', pub: 'ADDISON-WESLEY', w: 0.040, h: 0.244, d: 0.184, raisedBands: true, pageAge: 0.44 },
      // Massive iconic CLRS hardcover (tall, wide, chunky white/red MIT Press!)
      { style: 'mit', title: 'INTRODUCTION TO ALGORITHMS', author: 'CORMEN · LEISERSON · RIVEST · STEIN', bg: '#f4f2ec', band: '#c42428', fg: '#14161c', bandFg: '#ffffff', vol: '4TH ED', w: 0.058, h: 0.258, d: 0.208, pageAge: 0.22, wear: 0.50 },
      // Iconic royal-purple MIT Press SICP ("The Wizard Book")
      { style: 'mit', title: 'SICP — COMPUTER PROGRAMS', author: 'ABELSON & SUSSMAN', bg: '#452660', band: '#e2c264', fg: '#f8f3e8', bandFg: '#28143a', w: 0.040, h: 0.242, d: 0.184, raisedBands: true, pageAge: 0.48, wear: 0.60 },
      // Iconic Dragon Book (Compilers, Aho/Lam/Sethi/Ullman)
      { style: 'dragon', title: 'COMPILERS (DRAGON BOOK)', author: 'AHO, LAM, SETHI, ULLMAN', bg: '#ead8a8', band: '#b42428', fg: '#1e1614', bandFg: '#faf4e6', pub: 'ADDISON-WESLEY', w: 0.052, h: 0.248, d: 0.194, pageAge: 0.46, wear: 0.62 },
      // Iconic thin stark-white K&R 2e paperback!
      { style: 'kr', binding: 'paperback', title: 'THE C PROGRAMMING LANGUAGE', author: 'KERNIGHAN & RITCHIE', bg: '#f6f7fa', w: 0.019, h: 0.228, d: 0.174, wear: 0.72, pageAge: 0.62 },
      { style: 'mit', title: 'TYPES & PROG. LANGUAGES', author: 'BENJAMIN C. PIERCE', bg: '#1b4a52', band: '#e6e2d6', fg: '#f4f6f8', w: 0.038, h: 0.240, d: 0.180, pageAge: 0.36 },
      { title: 'THEORY OF COMPUTATION', author: 'MICHAEL SIPSER', bg: '#1c2b48', band: '#d69028', fg: '#f4f6fa', pub: 'CENGAGE', w: 0.032, h: 0.238, d: 0.174, pageAge: 0.40 },
      { title: 'ALGORITHM DESIGN MANUAL', author: 'STEVEN S. SKIENA', bg: '#223860', band: '#e2c242', fg: '#f4f6fa', pub: 'SPRINGER', w: 0.044, h: 0.244, d: 0.178, pageAge: 0.30 },
      { title: 'COMPUTATIONAL COMPLEXITY', author: 'ARORA & BARAK', bg: '#2d3b2c', band: '#d8c89c', fg: '#f6f4ec', pub: 'CAMBRIDGE', w: 0.034, h: 0.244, d: 0.178, pageAge: 0.32 },
      { title: 'MODERN COMPILER IMPL. IN C', author: 'ANDREW W. APPEL', bg: '#482838', band: '#dcd0b8', fg: '#f6f2ea', pub: 'CAMBRIDGE', w: 0.034, h: 0.240, d: 0.176, pageAge: 0.44 },
      // Thin leaning classic leaning organically against the upright row!
      {
        lean: 0.26,
        book: { binding: 'paperback', title: 'PURELY FUNCTIONAL DATA STR.', author: 'CHRIS OKASAKI', bg: '#2a4654', band: '#c8b482', fg: '#f4f6f8', pub: 'CAMBRIDGE', w: 0.022, h: 0.228, d: 0.158, pageAge: 0.46 },
      },
      { gap: 0.038 },
      // Horizontal stack of 3 iconic ML/Statistical Learning hardcovers with Deep Learning prominently on top!
      {
        stack: [
          { title: 'ELEMENTS OF STAT. LEARNING', author: 'HASTIE · TIBSHIRANI · FRIEDMAN', bg: '#243c50', band: '#d49a38', fg: '#f4f6fa', pub: 'SPRINGER', w: 0.044, h: 0.244, d: 0.178, pageAge: 0.32 },
          { title: 'PATTERN REC. & MACHINE LEARN.', author: 'CHRISTOPHER M. BISHOP', bg: '#1d4066', band: '#f0c832', fg: '#f6f8fc', pub: 'SPRINGER', w: 0.046, h: 0.244, d: 0.180, pageAge: 0.34 },
          { style: 'mit', title: 'DEEP LEARNING', author: 'GOODFELLOW · BENGIO · COURVILLE', bg: '#172234', band: '#4ea8de', fg: '#f4f8fc', w: 0.044, h: 0.238, d: 0.184, pageAge: 0.20 },
        ],
      },
    ],
  },
];

// ============================================================================
// Public Builder: Bookshelf Books (merged into 5 GPU draw calls total!)
// ============================================================================

export function buildBookshelfBooks(shelfGroup, shelfYs, sw, renderer, addDecorVase) {
  const atlas = new BookTextureAtlas(renderer);
  const builder = new MergedBookGeometry(atlas);
  const rng = mulberry32(909);

  const mat4 = new THREE.Matrix4();
  const quat = new THREE.Quaternion();
  const pos = new THREE.Vector3();
  const scaleOne = new THREE.Vector3(1, 1, 1);
  const euler = new THREE.Euler();

  // Compute exact width footprint of an item so shelf rows center cleanly with zero collisions
  const itemSpan = (item) => {
    if (item.vase) return 0.16;
    if (item.gap) return item.gap;
    if (item.stack) {
      let maxH = 0;
      for (const b of item.stack) maxH = Math.max(maxH, b.h || 0.24);
      return maxH + 0.022;
    }
    if (item.lean) {
      const b = item.book;
      const bw = b.w || 0.032;
      const bh = b.h || 0.236;
      const theta = item.lean;
      return bw * Math.cos(theta) + bh * Math.sin(theta) + 0.008;
    }
    return (item.w || 0.036) + 0.0022;
  };

  for (let si = 0; si < SHELVES_SPEC.length; si++) {
    const shelfCfg = SHELVES_SPEC[si];
    const baseY = shelfYs[si] + 0.014;
    const maxSpan = shelfCfg.maxSpan || (sw - 0.11);

    let usedSpan = 0;
    const fitItems = [];
    for (const item of shelfCfg.items) {
      const step = itemSpan(item);
      if (usedSpan + step > maxSpan) break;
      fitItems.push(item);
      usedSpan += step;
    }

    let cursorX = shelfCfg.leftAligned ? (-sw / 2 + 0.07) : (-usedSpan / 2);

    for (let idx = 0; idx < fitItems.length; idx++) {
      const item = fitItems[idx];

      if (item.vase) {
        cursorX += addDecorVase(shelfGroup, cursorX, baseY, item.vase);
        continue;
      }
      if (item.gap) {
        cursorX += item.gap;
        continue;
      }

      if (item.stack) {
        // Horizontal book stack: spine facing +Z (room), front cover facing +Y (up!), slight human rotational jitter!
        const span = itemSpan(item);
        const stackCenterX = cursorX + span * 0.5;
        let stackY = baseY + 0.0004;
        for (let bi = 0; bi < item.stack.length; bi++) {
          const b = item.stack[bi];
          const bw = b.w || 0.036;
          const bd = b.d || 0.180;
          const jitterX = (rng() - 0.5) * 0.010;
          const jitterZ = (rng() - 0.5) * 0.012;
          const yawY = (rng() - 0.5) * 0.13; // realistic ±3.7° human hand placement!

          // Rotate local +X (front cover) -> world +Y (up!), keeping local +Z (spine) -> world +Z (facing room!)
          euler.set(0, yawY, Math.PI / 2, 'YXZ');
          quat.setFromEuler(euler);
          // Align front spine edge near front of shelf (z ≈ +0.125 - bd/2)
          const cz = 0.125 - bd * 0.5 + jitterZ;
          pos.set(stackCenterX + jitterX, stackY + bw * 0.5, cz);
          mat4.compose(pos, quat, scaleOne);

          // Top book & every stacked book gets its real front cover artwork!
          builder.addBook(b, mat4, true);
          stackY += bw + 0.0004;
        }
        cursorX += span;
        continue;
      }

      if (item.lean) {
        // Mathematically exact leaning book:
        // Tilted by +theta around Z (so top leans LEFT onto the preceding upright book, bottom rests squarely on baseY!)
        const b = item.book;
        const bw = b.w || 0.032;
        const bh = b.h || 0.236;
        const bd = b.d || 0.175;
        const theta = item.lean; // positive radians -> top moves left (-X), bottom-right corner sits at baseY!
        const cosT = Math.cos(theta);
        const sinT = Math.sin(theta);

        // Lowest vertex in rotated book is (-bw/2, -bh/2) or (+bw/2, -bh/2):
        // y' = x*sinT + y*cosT -> min y' = -(bw/2)*sinT - (bh/2)*cosT
        const cy = baseY + (bw * 0.5) * sinT + (bh * 0.5) * cosT + 0.0004;
        // Leftmost upper corner (-bw/2, +bh/2) has x' = -(bw/2)*cosT - (bh/2)*sinT -> touches cursorX cleanly!
        const cx = cursorX + (bw * 0.5) * cosT + (bh * 0.5) * sinT + 0.002;
        const cz = 0.122 - bd * 0.5 + (rng() - 0.5) * 0.010;

        euler.set(0, (rng() - 0.5) * 0.025, theta, 'YXZ');
        quat.setFromEuler(euler);
        pos.set(cx, cy, cz);
        mat4.compose(pos, quat, scaleOne);

        // Exposed front cover (+X faces slightly upward/right) gets full front-cover artwork!
        builder.addBook(b, mat4, true);
        cursorX += itemSpan(item);
        continue;
      }

      // Standard upright book with varied real depth, organic push-in/pull-out & subtle ±1° shelf lean
      const bw = item.w || 0.036;
      const bh = item.h || 0.242;
      const bd = item.d || 0.184;
      const microTilt = (rng() - 0.5) * 0.020;
      const absSin = Math.abs(Math.sin(microTilt));
      const cosT = Math.cos(microTilt);

      // Keep spines organically aligned near the front shelf lip (z ≈ +0.128) with ±10mm lived-in pull-out variation!
      const spineZ = 0.126 + (rng() - 0.5) * 0.018;
      const cz = spineZ - bd * 0.5;
      const cx = cursorX + bw * 0.5 + 0.001;
      const cy = baseY + (bh * 0.5) * cosT + (bw * 0.5) * absSin + 0.0003;

      euler.set(0, (rng() - 0.5) * 0.018, microTilt, 'YXZ');
      quat.setFromEuler(euler);
      pos.set(cx, cy, cz);
      mat4.compose(pos, quat, scaleOne);

      // Books adjacent to a vase, gap, stack, or end-of-row expose their front cover -> give them real cover art!
      const next = fitItems[idx + 1];
      const coverExposed = !next || Boolean(next.vase || next.gap || next.stack || next.lean);
      builder.addBook(item, mat4, coverExposed);

      cursorX += bw + 0.0022;
    }
  }

  builder.finalizeInto(shelfGroup, false);
}

// ============================================================================
// Public Builder: Credenza Coffee-Table Art & Architecture Monographs
// ============================================================================

export function buildCredenzaArtBooks(credGroup, credSurfY, renderer) {
  const atlas = new BookTextureAtlas(renderer);
  const builder = new MergedBookGeometry(atlas);
  const mat4 = new THREE.Matrix4();
  const quat = new THREE.Quaternion();
  const pos = new THREE.Vector3();
  const scaleOne = new THREE.Vector3(1, 1, 1);
  const euler = new THREE.Euler();

  const stack = [
    {
      title: 'DIETER RAMS: LESS, BUT BETTER',
      author: 'KLAUS KLEMP · KEIKO UEKI-POLET',
      bg: '#233246',
      band: '#d49a3a',
      fg: '#f5f2ea',
      pub: 'GESTALTEN',
      w: 0.032,
      h: 0.305,
      d: 0.240,
      pageAge: 0.18,
      wear: 0.22,
      headband: '#d8b668',
    },
    {
      style: 'mit',
      title: 'SAN FRANCISCO: ARCHITECTURE & LIGHT',
      author: 'SALLY WOODBRIDGE',
      bg: '#ece6da',
      band: '#b8422c',
      fg: '#1a1e26',
      pub: 'MIT PRESS',
      w: 0.026,
      h: 0.268,
      d: 0.214,
      pageAge: 0.14,
      wear: 0.18,
      headband: '#b8422c',
    },
  ];

  let y = credSurfY + 0.0005;
  const yaws = [-Math.PI / 2 + 0.08, -Math.PI / 2 - 0.05];
  const offsets = [[-0.02, 0.22], [-0.015, 0.215]];

  for (let i = 0; i < stack.length; i++) {
    const b = stack[i];
    // Rotate +X (front cover) -> +Y (up!), then yaw so spine faces cleanly toward room (-X of credenza)
    euler.set(0, yaws[i], Math.PI / 2, 'YXZ');
    quat.setFromEuler(euler);
    pos.set(offsets[i][0], y + b.w * 0.5, offsets[i][1]);
    mat4.compose(pos, quat, scaleOne);
    builder.addBook(b, mat4, true);
    y += b.w + 0.0005;
  }

  builder.finalizeInto(credGroup, true);
}
