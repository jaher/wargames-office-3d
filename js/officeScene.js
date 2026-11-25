import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { RectAreaLightUniformsLib } from 'three/addons/lights/RectAreaLightUniformsLib.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

// Camera presets matching index.html [data-cam] buttons
export const CAMERA_PRESETS = {
  overview: {
    pos: [1.48, 1.72, 2.28],
    target: [0.02, 1.06, -1.15],
  },
  monitor: {
    pos: [-0.56, 1.18, -0.22],
    target: [-0.56, 1.14, -1.16],
  },
  pc: {
    pos: [-0.14, 1.09, -0.34],
    target: [0.46, 1.03, -0.96],
  },
  cluster: {
    pos: [1.38, 1.12, -0.10],
    target: [2.62, 0.96, -0.25],
  },
  window: {
    pos: [-0.15, 1.56, 0.85],
    target: [-0.15, 1.48, -22.0],
  },
};

const SKY_MOODS = [
  {
    id: 'golden',
    label: '☀ Golden Hour',
    zenith: new THREE.Color('#173b73'),
    mid: new THREE.Color('#5a8ec2'),
    horizon: new THREE.Color('#ffaf68'),
    haze: new THREE.Color('#f0a96e'),
    sunColor: new THREE.Color('#fff4d6'),
    sunGlow: new THREE.Color('#ff8e3c'),
    cloudLight: new THREE.Color('#ffe2be'),
    cloudShadow: new THREE.Color('#5e6782'),
    sunDir: new THREE.Vector3(-0.24, 0.21, -0.947).normalize(),
    dirLightColor: 0xffd299,
    dirLightIntensity: 3.4,
    portalColor: 0xffdfb8,
    portalIntensity: 2.8,
    hemiSky: 0xffe4c4,
    hemiGround: 0x4d3a2c,
    hemiIntensity: 0.72,
    lampIntensity: 3.2,
    pendantIntensity: 1.4,
    windowLitBoost: 0.72,
    beamOpacity: 0.068,
    exposure: 1.06,
    envIntensity: 0.88,
  },
  {
    id: 'day',
    label: '🌤 Clear Day',
    zenith: new THREE.Color('#1455b8'),
    mid: new THREE.Color('#6db4ee'),
    horizon: new THREE.Color('#d9edff'),
    haze: new THREE.Color('#c8dff2'),
    sunColor: new THREE.Color('#ffffff'),
    sunGlow: new THREE.Color('#ffefc4'),
    cloudLight: new THREE.Color('#ffffff'),
    cloudShadow: new THREE.Color('#8ea5be'),
    sunDir: new THREE.Vector3(0.24, 0.42, -0.875).normalize(),
    dirLightColor: 0xfff7eb,
    dirLightIntensity: 3.8,
    portalColor: 0xdff0ff,
    portalIntensity: 3.4,
    hemiSky: 0xd8eeff,
    hemiGround: 0x615040,
    hemiIntensity: 0.92,
    lampIntensity: 1.5,
    pendantIntensity: 0.8,
    windowLitBoost: 0.24,
    beamOpacity: 0.042,
    exposure: 1.08,
    envIntensity: 0.98,
  },
  {
    id: 'dusk',
    label: '🌆 Sunset Dusk',
    zenith: new THREE.Color('#0f1636'),
    mid: new THREE.Color('#4d356e'),
    horizon: new THREE.Color('#ff6e4a'),
    haze: new THREE.Color('#965267'),
    sunColor: new THREE.Color('#ffcf96'),
    sunGlow: new THREE.Color('#ff4f33'),
    cloudLight: new THREE.Color('#ff9d76'),
    cloudShadow: new THREE.Color('#2c2848'),
    sunDir: new THREE.Vector3(-0.32, 0.11, -0.941).normalize(),
    dirLightColor: 0xff8c52,
    dirLightIntensity: 2.2,
    portalColor: 0xc992a8,
    portalIntensity: 1.9,
    hemiSky: 0x9c7ab8,
    hemiGround: 0x33241e,
    hemiIntensity: 0.48,
    lampIntensity: 5.0,
    pendantIntensity: 2.4,
    windowLitBoost: 1.55,
    beamOpacity: 0.052,
    exposure: 1.04,
    envIntensity: 0.72,
  },
];

function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function adjustHex(hex, delta) {
  const c = new THREE.Color(hex);
  const r = THREE.MathUtils.clamp(Math.round(c.r * 255 + delta), 0, 255);
  const g = THREE.MathUtils.clamp(Math.round(c.g * 255 + delta), 0, 255);
  const b = THREE.MathUtils.clamp(Math.round(c.b * 255 + delta), 0, 255);
  return `rgb(${r},${g},${b})`;
}

function rgbaHex(hex, a) {
  const c = new THREE.Color(hex);
  return `rgba(${Math.round(c.r * 255)},${Math.round(c.g * 255)},${Math.round(c.b * 255)},${a})`;
}

// ---------- Fast Multi-Channel PBR Texture Generators (Albedo + Roughness + Bump) ----------

function createWoodPBR({
  base = '#946842',
  grain = '#5b391e',
  plankLines = true,
  planksX = 4,
  planksY = 10,
  seed = 11,
  repeatX = 3,
  repeatY = 3,
  roughBase = 115,
} = {}) {
  const size = 512;
  const colC = document.createElement('canvas');
  const rghC = document.createElement('canvas');
  const bmpC = document.createElement('canvas');
  colC.width = rghC.width = bmpC.width = size;
  colC.height = rghC.height = bmpC.height = size;

  const ctx = colC.getContext('2d');
  const rctx = rghC.getContext('2d');
  const bctx = bmpC.getContext('2d');
  const rng = mulberry32(seed);

  ctx.fillStyle = base;
  ctx.fillRect(0, 0, size, size);
  rctx.fillStyle = `rgb(${roughBase},${roughBase},${roughBase})`;
  rctx.fillRect(0, 0, size, size);
  bctx.fillStyle = 'rgb(140,140,140)';
  bctx.fillRect(0, 0, size, size);

  if (plankLines) {
    const pw = size / planksX;
    const ph = size / planksY;
    for (let x = 0; x < planksX; x++) {
      const offset = (x % 2) * (ph * 0.5);
      for (let y = -1; y <= planksY; y++) {
        const px = x * pw;
        const py = y * ph + offset;
        const shade = (rng() - 0.5) * 32;
        ctx.fillStyle = adjustHex(base, shade);
        ctx.fillRect(px + 1, py + 1, pw - 2, ph - 2);

        const rv = THREE.MathUtils.clamp(Math.round(roughBase + (rng() - 0.5) * 34), 60, 210);
        rctx.fillStyle = `rgb(${rv},${rv},${rv})`;
        rctx.fillRect(px + 1, py + 1, pw - 2, ph - 2);

        const bv = Math.round(132 + (rng() - 0.5) * 20);
        bctx.fillStyle = `rgb(${bv},${bv},${bv})`;
        bctx.fillRect(px + 1, py + 1, pw - 2, ph - 2);

        ctx.save();
        ctx.beginPath();
        ctx.rect(px + 1, py + 1, pw - 2, ph - 2);
        ctx.clip();
        for (let g = 0; g < 16; g++) {
          const gx = px + rng() * pw;
          const cp1 = (rng() - 0.5) * 14;
          const cp2 = (rng() - 0.5) * 14;
          const lw = 0.8 + rng() * 2.1;
          ctx.strokeStyle = rgbaHex(grain, 0.08 + rng() * 0.16);
          ctx.lineWidth = lw;
          ctx.beginPath();
          ctx.moveTo(gx, py);
          ctx.bezierCurveTo(gx + cp1, py + ph * 0.33, gx + cp2, py + ph * 0.66, gx + cp1 * 0.5, py + ph);
          ctx.stroke();

          bctx.strokeStyle = `rgba(95,95,95,${0.12 + rng() * 0.18})`;
          bctx.lineWidth = lw;
          bctx.beginPath();
          bctx.moveTo(gx, py);
          bctx.bezierCurveTo(gx + cp1, py + ph * 0.33, gx + cp2, py + ph * 0.66, gx + cp1 * 0.5, py + ph);
          bctx.stroke();
        }
        // Occasional subtle wood knot
        if (rng() < 0.25) {
          const kx = px + pw * (0.25 + rng() * 0.5);
          const ky = py + ph * (0.25 + rng() * 0.5);
          ctx.fillStyle = rgbaHex(grain, 0.26);
          ctx.beginPath();
          ctx.ellipse(kx, ky, 3 + rng() * 3, 7 + rng() * 6, 0, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();

        // Recessed plank bevel groove
        ctx.strokeStyle = 'rgba(22, 12, 5, 0.55)';
        ctx.lineWidth = 1.6;
        ctx.strokeRect(px, py, pw, ph);

        rctx.strokeStyle = 'rgb(235,235,235)';
        rctx.lineWidth = 2;
        rctx.strokeRect(px, py, pw, ph);

        bctx.strokeStyle = 'rgb(28,28,28)';
        bctx.lineWidth = 2;
        bctx.strokeRect(px, py, pw, ph);
      }
    }
  } else {
    for (let i = 0; i < 140; i++) {
      const y = rng() * size;
      const cp1 = (rng() - 0.5) * 18;
      const cp2 = (rng() - 0.5) * 18;
      const lw = 0.8 + rng() * 2.6;
      ctx.strokeStyle = rgbaHex(grain, 0.06 + rng() * 0.16);
      ctx.lineWidth = lw;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.bezierCurveTo(size * 0.33, y + cp1, size * 0.66, y + cp2, size, y + cp1 * 0.4);
      ctx.stroke();

      rctx.strokeStyle = `rgba(${roughBase + 38},${roughBase + 38},${roughBase + 38},0.22)`;
      rctx.lineWidth = lw;
      rctx.beginPath();
      rctx.moveTo(0, y);
      rctx.bezierCurveTo(size * 0.33, y + cp1, size * 0.66, y + cp2, size, y + cp1 * 0.4);
      rctx.stroke();

      bctx.strokeStyle = 'rgba(85,85,85,0.22)';
      bctx.lineWidth = lw;
      bctx.beginPath();
      bctx.moveTo(0, y);
      bctx.bezierCurveTo(size * 0.33, y + cp1, size * 0.66, y + cp2, size, y + cp1 * 0.4);
      bctx.stroke();
    }
  }

  const wrap = (c, isColor) => {
    const t = new THREE.CanvasTexture(c);
    if (isColor) t.colorSpace = THREE.SRGBColorSpace;
    t.wrapS = THREE.RepeatWrapping;
    t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(repeatX, repeatY);
    t.anisotropy = 8;
    return t;
  };
  return {
    map: wrap(colC, true),
    roughnessMap: wrap(rghC, false),
    bumpMap: wrap(bmpC, false),
  };
}

function createPlasterPBR(baseHex = '#eae3d7', seed = 71) {
  const size = 256;
  const colC = document.createElement('canvas');
  const bmpC = document.createElement('canvas');
  colC.width = bmpC.width = size;
  colC.height = bmpC.height = size;
  const ctx = colC.getContext('2d');
  const bctx = bmpC.getContext('2d');
  const rng = mulberry32(seed);

  // Baked subtle top/bottom wall ambient-occlusion gradient
  const grad = ctx.createLinearGradient(0, 0, 0, size);
  grad.addColorStop(0.0, adjustHex(baseHex, -16));
  grad.addColorStop(0.12, baseHex);
  grad.addColorStop(0.86, baseHex);
  grad.addColorStop(1.0, adjustHex(baseHex, -20));
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);

  bctx.fillStyle = 'rgb(128,128,128)';
  bctx.fillRect(0, 0, size, size);

  // Subtle Venetian plaster micro-trowel clouds
  for (let i = 0; i < 320; i++) {
    const x = rng() * size;
    const y = rng() * size;
    const r = 4 + rng() * 18;
    const light = rng() > 0.5;
    ctx.fillStyle = light ? 'rgba(255,252,246,0.035)' : 'rgba(110,98,84,0.03)';
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();

    const bv = light ? 136 : 120;
    bctx.fillStyle = `rgba(${bv},${bv},${bv},0.16)`;
    bctx.beginPath();
    bctx.arc(x, y, r * 0.7, 0, Math.PI * 2);
    bctx.fill();
  }

  const map = new THREE.CanvasTexture(colC);
  map.colorSpace = THREE.SRGBColorSpace;
  const bumpMap = new THREE.CanvasTexture(bmpC);
  bumpMap.wrapS = bumpMap.wrapT = THREE.RepeatWrapping;
  bumpMap.repeat.set(3, 2);
  return { map, bumpMap };
}

function createBrushedMetalMap(seed = 33) {
  const size = 256;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');
  const rng = mulberry32(seed);
  ctx.fillStyle = 'rgb(96,96,96)';
  ctx.fillRect(0, 0, size, size);
  for (let y = 0; y < size; y++) {
    const v = Math.round(78 + rng() * 44);
    ctx.fillStyle = `rgb(${v},${v},${v})`;
    ctx.fillRect(0, y, size, 1);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(2, 2);
  return tex;
}

function createRugPBR() {
  const W = 512;
  const H = 384;
  const colC = document.createElement('canvas');
  const bmpC = document.createElement('canvas');
  colC.width = bmpC.width = W;
  colC.height = bmpC.height = H;
  const ctx = colC.getContext('2d');
  const bctx = bmpC.getContext('2d');
  const rng = mulberry32(42);

  ctx.fillStyle = '#ddd4c4';
  ctx.fillRect(0, 0, W, H);
  bctx.fillStyle = 'rgb(120,120,120)';
  bctx.fillRect(0, 0, W, H);

  for (let y = 0; y < H; y += 2) {
    ctx.fillStyle = y % 4 === 0 ? 'rgba(128,116,100,0.11)' : 'rgba(255,250,242,0.14)';
    ctx.fillRect(0, y, W, 1);
    bctx.fillStyle = y % 4 === 0 ? 'rgb(95,95,95)' : 'rgb(155,155,155)';
    bctx.fillRect(0, y, W, 1);
  }
  for (let x = 0; x < W; x += 3) {
    ctx.fillStyle = rng() > 0.5 ? 'rgba(105,94,80,0.08)' : 'rgba(255,255,255,0.08)';
    ctx.fillRect(x, 0, 1.5, H);
  }

  // Architectural Scandinavian border & subtle diamond linework
  ctx.strokeStyle = 'rgba(48, 52, 60, 0.36)';
  ctx.lineWidth = 6;
  ctx.strokeRect(20, 20, W - 40, H - 40);
  ctx.strokeStyle = 'rgba(155, 110, 72, 0.28)';
  ctx.lineWidth = 2.5;
  ctx.strokeRect(30, 30, W - 60, H - 60);

  ctx.strokeStyle = 'rgba(54, 60, 70, 0.22)';
  ctx.lineWidth = 3;
  const cols = 4;
  const rows = 3;
  const cw = (W - 76) / cols;
  const ch = (H - 76) / rows;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const cx = 38 + (c + 0.5) * cw;
      const cy = 38 + (r + 0.5) * ch;
      ctx.beginPath();
      ctx.moveTo(cx, cy - ch * 0.43);
      ctx.lineTo(cx + cw * 0.43, cy);
      ctx.lineTo(cx, cy + ch * 0.43);
      ctx.lineTo(cx - cw * 0.43, cy);
      ctx.closePath();
      ctx.stroke();
    }
  }

  const map = new THREE.CanvasTexture(colC);
  map.colorSpace = THREE.SRGBColorSpace;
  map.anisotropy = 8;
  const bumpMap = new THREE.CanvasTexture(bmpC);
  return { map, bumpMap };
}

function createCorsairAirflowMeshAlpha() {
  const size = 256;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');
  // Solid metal frame background (opaque white in alphaMap)
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, size, size);

  // Corsair signature triangular airflow perforations (transparent black holes!)
  ctx.fillStyle = '#080808';
  const stepX = 18;
  const stepY = 16;
  for (let row = 0; row < size / stepY + 1; row++) {
    for (let col = 0; col < size / stepX + 1; col++) {
      const x = col * stepX + (row % 2 ? stepX * 0.5 : 0);
      const y = row * stepY;
      ctx.beginPath();
      ctx.moveTo(x, y - 5.5);
      ctx.lineTo(x + 6.5, y + 5.5);
      ctx.lineTo(x - 6.5, y + 5.5);
      ctx.closePath();
      ctx.fill();
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(1.2, 2.5);
  return tex;
}

function createLeafPBR() {
  const size = 256;
  const colC = document.createElement('canvas');
  const bmpC = document.createElement('canvas');
  colC.width = bmpC.width = size;
  colC.height = bmpC.height = size;
  const ctx = colC.getContext('2d');
  const bctx = bmpC.getContext('2d');

  const g = ctx.createLinearGradient(0, 0, size, size);
  g.addColorStop(0, '#275931');
  g.addColorStop(0.5, '#346e3d');
  g.addColorStop(1, '#234f2b');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);

  bctx.fillStyle = 'rgb(128,128,128)';
  bctx.fillRect(0, 0, size, size);

  // Central midrib + organic lateral leaf veins
  ctx.strokeStyle = 'rgba(130, 184, 112, 0.55)';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(size * 0.5, size);
  ctx.lineTo(size * 0.5, 8);
  ctx.stroke();

  bctx.strokeStyle = 'rgb(220,220,220)';
  bctx.lineWidth = 5;
  bctx.beginPath();
  bctx.moveTo(size * 0.5, size);
  bctx.lineTo(size * 0.5, 8);
  bctx.stroke();

  ctx.lineWidth = 2;
  bctx.lineWidth = 2.5;
  for (let i = 1; i <= 7; i++) {
    const y = size - i * 32;
    for (const dir of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(size * 0.5, y);
      ctx.quadraticCurveTo(size * 0.5 + dir * 55, y - 10, size * 0.5 + dir * 112, y - 34);
      ctx.stroke();

      bctx.beginPath();
      bctx.moveTo(size * 0.5, y);
      bctx.quadraticCurveTo(size * 0.5 + dir * 55, y - 10, size * 0.5 + dir * 112, y - 34);
      bctx.stroke();
    }
  }

  const map = new THREE.CanvasTexture(colC);
  map.colorSpace = THREE.SRGBColorSpace;
  const bumpMap = new THREE.CanvasTexture(bmpC);
  return { map, bumpMap };
}

function createContactShadowTexture() {
  const size = 128;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(size / 2, size / 2, 4, size / 2, size / 2, size / 2);
  g.addColorStop(0, 'rgba(10, 8, 6, 0.52)');
  g.addColorStop(0.55, 'rgba(10, 8, 6, 0.22)');
  g.addColorStop(1, 'rgba(10, 8, 6, 0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  return new THREE.CanvasTexture(c);
}

function createBuildingFacadeTexture(seed, style = 'glass') {
  const W = 256;
  const H = 512;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');

  const emCanvas = document.createElement('canvas');
  emCanvas.width = W;
  emCanvas.height = H;
  const ectx = emCanvas.getContext('2d');
  ectx.fillStyle = '#000000';
  ectx.fillRect(0, 0, W, H);

  const rghCanvas = document.createElement('canvas');
  rghCanvas.width = W;
  rghCanvas.height = H;
  const rctx = rghCanvas.getContext('2d');
  rctx.fillStyle = 'rgb(165,165,165)'; // Matte mullions/spandrels
  rctx.fillRect(0, 0, W, H);

  const rng = mulberry32(seed);
  const palettes = {
    glass: ['#1e2b3c', '#182434', '#263649', '#2b3e52'],
    warm: ['#453e3a', '#524942', '#3a373a', '#5d534b'],
    dark: ['#151b26', '#1c2330', '#222b38', '#121822'],
  };
  const pal = palettes[style] || palettes.glass;
  ctx.fillStyle = pal[Math.floor(rng() * pal.length)];
  ctx.fillRect(0, 0, W, H);

  const cols = 6 + Math.floor(rng() * 5);
  const rows = 20 + Math.floor(rng() * 14);
  const padX = 3.5;
  const padY = 4;
  const cellW = W / cols;
  const cellH = H / rows;

  for (let r = 0; r < rows; r++) {
    const floorLitBias = rng();
    const isMechFloor = r > 2 && r % 11 === 0;
    for (let c = 0; c < cols; c++) {
      const x = c * cellW + padX * 0.5;
      const y = r * cellH + padY * 0.5;
      const ww = cellW - padX;
      const wh = cellH - padY;

      if (isMechFloor) {
        ctx.fillStyle = 'rgba(18, 22, 30, 0.85)';
        ctx.fillRect(x, y, ww, wh);
        continue;
      }

      // Glossy glass pane in roughnessMap
      rctx.fillStyle = 'rgb(28,28,28)';
      rctx.fillRect(x, y, ww, wh);

      const lit = rng() < 0.16 + floorLitBias * 0.34;
      if (lit) {
        const warm = rng() > 0.26;
        const alpha = 0.65 + rng() * 0.35;
        const col = warm
          ? `rgba(255, ${198 + Math.floor(rng() * 44)}, ${128 + Math.floor(rng() * 55)}, ${alpha})`
          : `rgba(188, ${222 + Math.floor(rng() * 32)}, 255, ${alpha})`;
        ctx.fillStyle = col;
        ctx.fillRect(x, y, ww, wh);
        // Subtle half-drawn office blinds inside lit window
        if (rng() < 0.45) {
          ctx.fillStyle = 'rgba(20, 26, 36, 0.38)';
          ctx.fillRect(x, y, ww, wh * (0.25 + rng() * 0.35));
        }
        ectx.fillStyle = col;
        ectx.fillRect(x, y, ww, wh);
      } else {
        // Sky-reflecting tinted curtain-wall glass pane
        const v = 54 + Math.floor(rng() * 50);
        const gPane = ctx.createLinearGradient(x, y, x, y + wh);
        gPane.addColorStop(0, `rgb(${v + 18}, ${v + 34}, ${v + 56})`);
        gPane.addColorStop(1, `rgb(${v - 6}, ${v + 6}, ${v + 20})`);
        ctx.fillStyle = gPane;
        ctx.fillRect(x, y, ww, wh);
      }
    }
  }

  // Structural spandrel bands
  ctx.fillStyle = 'rgba(14, 18, 26, 0.52)';
  for (let r = 0; r < rows; r += 4) {
    ctx.fillRect(0, r * cellH, W, 3.2);
  }

  const map = new THREE.CanvasTexture(canvas);
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = map.wrapT = THREE.RepeatWrapping;

  const emissiveMap = new THREE.CanvasTexture(emCanvas);
  emissiveMap.colorSpace = THREE.SRGBColorSpace;
  emissiveMap.wrapS = emissiveMap.wrapT = THREE.RepeatWrapping;

  const roughnessMap = new THREE.CanvasTexture(rghCanvas);
  roughnessMap.wrapS = roughnessMap.wrapT = THREE.RepeatWrapping;

  return { map, emissiveMap, roughnessMap };
}

function createLabelTexture({
  width = 512,
  height = 128,
  bg = '#12151c',
  border = null,
  draw,
}) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, width, height);
  if (border) {
    ctx.strokeStyle = border;
    ctx.lineWidth = 4;
    ctx.strokeRect(2, 2, width - 4, height - 4);
  }
  draw(ctx, width, height);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

function createWallArtTexture(variant = 0) {
  const W = 384;
  const H = 480;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');

  if (variant === 0) {
    ctx.fillStyle = '#f2eadc';
    ctx.fillRect(0, 0, W, H);
    const sunG = ctx.createRadialGradient(W * 0.56, H * 0.36, 10, W * 0.56, H * 0.36, 108);
    sunG.addColorStop(0, '#e39664');
    sunG.addColorStop(1, '#cf754a');
    ctx.fillStyle = sunG;
    ctx.beginPath();
    ctx.arc(W * 0.56, H * 0.36, 96, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#243447';
    ctx.beginPath();
    ctx.moveTo(42, H - 52);
    ctx.lineTo(164, 218);
    ctx.lineTo(272, H - 52);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#182330';
    ctx.beginPath();
    ctx.moveTo(164, H - 52);
    ctx.lineTo(266, 186);
    ctx.lineTo(348, H - 52);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#c4986a';
    ctx.lineWidth = 3;
    ctx.strokeRect(26, 26, W - 52, H - 52);
  } else {
    ctx.fillStyle = '#101724';
    ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = 'rgba(125, 207, 255, 0.22)';
    ctx.lineWidth = 1.5;
    for (let i = 36; i < W - 36; i += 24) {
      ctx.beginPath();
      ctx.moveTo(i, 36);
      ctx.lineTo(i, H - 36);
      ctx.stroke();
    }
    for (let j = 36; j < H - 36; j += 24) {
      ctx.beginPath();
      ctx.moveTo(36, j);
      ctx.lineTo(W - 36, j);
      ctx.stroke();
    }
    ctx.strokeStyle = '#73daca';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(W * 0.5, H * 0.44, 96, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = '#7dcfff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(W * 0.5, H * 0.44, 62, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = '#dce8fb';
    ctx.font = 'bold 19px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('WARGAMES // LAB', W * 0.5, H - 82);
    ctx.fillStyle = '#73daca';
    ctx.font = '12px monospace';
    ctx.fillText('OMARCHY · RTX 5090 · 8× SPARK', W * 0.5, H - 56);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// ---------- Main Photorealistic OfficeScene Class ----------

export class OfficeScene {
  constructor(canvas, omarchyScreen, onInteractPreset) {
    this.canvas = canvas;
    this.omarchyScreen = omarchyScreen;
    this.onInteractPreset = onInteractPreset;

    this.moodIndex = 0;
    this.clock = new THREE.Clock();
    this.animatingCam = null;
    this.envRenderTarget = null;

    // Shared PBR utility textures (created once for blazing fast startup)
    this.brushedMetalTex = createBrushedMetalMap(33);
    this.contactShadowTex = createContactShadowTexture();

    // Animated handles
    this.rgbFans = [];
    this.rgbRings = [];
    this.ramBars = [];
    this.sparkLeds = [];
    this.switchLeds = [];
    this.buildingWindowMaterials = [];
    this.hazeUniforms = {
      uHazeColor: { value: SKY_MOODS[0].haze.clone() },
      uSunDir: { value: SKY_MOODS[0].sunDir.clone() },
      uSunGlow: { value: SKY_MOODS[0].sunGlow.clone() },
    };
    this.sunBeams = [];
    this.clickableMeshes = [];
    this.dustPoints = null;

    RectAreaLightUniformsLib.init();

    this._initRendererAndCamera();
    this._initPostProcessing();
    this._buildSkyAndCityView();
    this._buildRoomShell();
    this._buildLighting();
    this._buildBookshelfAndDecor();
    this._buildPlants();
    this._buildDeskAndChair();
    this._buildOmarchyMonitor();
    this._buildCorsairRTX5090PC();
    this._buildDGXSparkClusterAndCRS804();
    this._buildSunbeamsAndDust();

    this.applySkyMood(0);
    this._bindPointerPick();
    this.resize();
  }

  _initRendererAndCamera() {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color('#182436');

    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
      powerPreference: 'high-performance',
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.06;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;

    this.pmremGenerator = new THREE.PMREMGenerator(this.renderer);
    this.pmremGenerator.compileEquirectangularShader();

    const w = this.canvas.clientWidth || window.innerWidth;
    const h = this.canvas.clientHeight || window.innerHeight;
    this.camera = new THREE.PerspectiveCamera(43, w / h, 0.05, 340);

    this.controls = new OrbitControls(this.camera, this.canvas);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.065;
    this.controls.maxDistance = 5.2;
    this.controls.minDistance = 0.45;
    this.controls.maxPolarAngle = Math.PI * 0.56;
    this.controls.minPolarAngle = 0.22;

    const p = CAMERA_PRESETS.overview;
    this.camera.position.set(...p.pos);
    this.controls.target.set(...p.target);
    this.controls.update();
  }

  _initPostProcessing() {
    try {
      const w = Math.max(1, this.canvas.clientWidth || window.innerWidth);
      const h = Math.max(1, this.canvas.clientHeight || window.innerHeight);
      const isWebGL2 = this.renderer.capabilities.isWebGL2;
      const samples = isWebGL2 ? Math.min(4, this.renderer.capabilities.maxSamples || 0) : 0;
      const rt = new THREE.WebGLRenderTarget(w, h, {
        type: THREE.HalfFloatType,
        samples,
      });
      this.composer = new EffectComposer(this.renderer, rt);
      this.composer.addPass(new RenderPass(this.scene, this.camera));
      this.bloomPass = new UnrealBloomPass(new THREE.Vector2(w, h), 0.22, 0.55, 1.08);
      this.composer.addPass(this.bloomPass);
      this.composer.addPass(new OutputPass());
    } catch {
      this.composer = null;
    }
  }

  // Generate physically-matched HDR IBL environment map matching the window, sky, sun & warm room
  _updateEnvironmentMap(mood) {
    const envScene = new THREE.Scene();

    // Sky-tinted dome shell
    const envDome = new THREE.Mesh(
      new THREE.SphereGeometry(20, 24, 16),
      new THREE.ShaderMaterial({
        side: THREE.BackSide,
        uniforms: {
          uTop: { value: mood.zenith.clone() },
          uMid: { value: mood.mid.clone() },
          uBot: { value: new THREE.Color('#3b2c22') },
        },
        vertexShader: `
          varying vec3 vP;
          void main() { vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
        `,
        fragmentShader: `
          uniform vec3 uTop; uniform vec3 uMid; uniform vec3 uBot;
          varying vec3 vP;
          void main() {
            vec3 c = vP.y > 0.0 ? mix(uMid, uTop, pow(vP.y, 0.7)) : mix(uMid * 0.5, uBot, clamp(-vP.y * 2.5, 0.0, 1.0));
            gl_FragColor = vec4(c * 1.15, 1.0);
          }
        `,
      })
    );
    envScene.add(envDome);

    // Bright HDR panoramic window light card in -Z direction (drives realistic wood/glass speculars!)
    const winCard = new THREE.Mesh(
      new THREE.PlaneGeometry(10, 5.2),
      new THREE.MeshBasicMaterial({ color: mood.horizon.clone().multiplyScalar(3.2) })
    );
    winCard.position.set(-0.4, 2.2, -9.5);
    envScene.add(winCard);

    // Intense HDR solar reflection hotspot aligned with real sunDir
    const sunCard = new THREE.Mesh(
      new THREE.CircleGeometry(1.6, 16),
      new THREE.MeshBasicMaterial({ color: mood.sunColor.clone().multiplyScalar(10.0) })
    );
    sunCard.position.copy(mood.sunDir).multiplyScalar(12);
    sunCard.lookAt(0, 0, 0);
    envScene.add(sunCard);

    // Warm interior ceiling & plaster wall soft bounce cards
    const warmBounce = new THREE.Mesh(
      new THREE.PlaneGeometry(12, 12),
      new THREE.MeshBasicMaterial({ color: new THREE.Color('#7a6857') })
    );
    warmBounce.rotation.x = Math.PI / 2;
    warmBounce.position.set(0, 8, 0);
    envScene.add(warmBounce);

    const floorBounce = new THREE.Mesh(
      new THREE.PlaneGeometry(14, 14),
      new THREE.MeshBasicMaterial({ color: new THREE.Color('#5c412a') })
    );
    floorBounce.rotation.x = -Math.PI / 2;
    floorBounce.position.set(0, -6, 0);
    envScene.add(floorBounce);

    // Linear warm pendant strip reflection
    const pendCard = new THREE.Mesh(
      new THREE.PlaneGeometry(3.2, 0.25),
      new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffdfa8').multiplyScalar(2.4) })
    );
    pendCard.rotation.x = Math.PI / 2;
    pendCard.position.set(-0.5, 6.5, -1.5);
    envScene.add(pendCard);

    const nextRT = this.pmremGenerator.fromScene(envScene, 0.035);
    if (this.envRenderTarget) this.envRenderTarget.dispose();
    this.envRenderTarget = nextRT;
    this.scene.environment = nextRT.texture;
    this.scene.environmentIntensity = mood.envIntensity;
  }

  _addContactShadow(parent, x, y, z, w, d, opacity = 0.45) {
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(w, d),
      new THREE.MeshBasicMaterial({
        map: this.contactShadowTex,
        transparent: true,
        opacity,
        depthWrite: false,
      })
    );
    m.rotation.x = -Math.PI / 2;
    m.position.set(x, y, z);
    parent.add(m);
    return m;
  }

  // ---------- 1. Photorealistic Sky + Volumetric FBM Clouds + Aerial-Haze City Skyline + Water ----------
  _buildSkyAndCityView() {
    // Physically-inspired Rayleigh/Mie atmospheric sky dome with procedural volumetric FBM clouds
    this.skyUniforms = {
      uTime: { value: 0 },
      uZenith: { value: SKY_MOODS[0].zenith.clone() },
      uMid: { value: SKY_MOODS[0].mid.clone() },
      uHorizon: { value: SKY_MOODS[0].horizon.clone() },
      uSunColor: { value: SKY_MOODS[0].sunColor.clone() },
      uSunGlow: { value: SKY_MOODS[0].sunGlow.clone() },
      uCloudLight: { value: SKY_MOODS[0].cloudLight.clone() },
      uCloudShadow: { value: SKY_MOODS[0].cloudShadow.clone() },
      uSunDir: { value: SKY_MOODS[0].sunDir.clone() },
    };

    const skyMat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      uniforms: this.skyUniforms,
      vertexShader: `
        varying vec3 vWorldDir;
        void main() {
          vec4 wp = modelMatrix * vec4(position, 1.0);
          vWorldDir = normalize(wp.xyz);
          gl_Position = projectionMatrix * viewMatrix * wp;
        }
      `,
      fragmentShader: `
        uniform float uTime;
        uniform vec3 uZenith;
        uniform vec3 uMid;
        uniform vec3 uHorizon;
        uniform vec3 uSunColor;
        uniform vec3 uSunGlow;
        uniform vec3 uCloudLight;
        uniform vec3 uCloudShadow;
        uniform vec3 uSunDir;
        varying vec3 vWorldDir;

        float hash(vec2 p) {
          p = fract(p * vec2(123.34, 456.21));
          p += dot(p, p + 45.32);
          return fract(p.x * p.y);
        }

        float noise(vec2 p) {
          vec2 i = floor(p);
          vec2 f = fract(p);
          vec2 u = f * f * (3.0 - 2.0 * f);
          return mix(
            mix(hash(i + vec2(0.0, 0.0)), hash(i + vec2(1.0, 0.0)), u.x),
            mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x),
            u.y
          );
        }

        float fbm(vec2 p) {
          float v = 0.0;
          float a = 0.5;
          mat2 rot = mat2(0.8, 0.6, -0.6, 0.8);
          for (int i = 0; i < 5; i++) {
            v += a * noise(p);
            p = rot * p * 2.02 + vec2(13.1, 7.4);
            a *= 0.5;
          }
          return v;
        }

        void main() {
          vec3 dir = normalize(vWorldDir);
          vec3 sDir = normalize(uSunDir);
          float h = clamp(dir.y, -0.15, 1.0);

          // Rayleigh vertical atmospheric gradient
          vec3 col;
          if (h < 0.0) {
            col = mix(uHorizon, uHorizon * 0.45, clamp(-h * 6.5, 0.0, 1.0));
          } else if (h < 0.24) {
            col = mix(uHorizon, uMid, smoothstep(0.0, 0.24, h));
          } else {
            col = mix(uMid, uZenith, smoothstep(0.24, 0.90, h));
          }

          // Mie forward scattering halo & blazing solar disc
          float sunDot = max(dot(dir, sDir), 0.0);
          float wideMie = pow(sunDot, 5.0) * 0.48;
          float tightMie = pow(sunDot, 48.0) * 0.95;
          float corona = pow(sunDot, 240.0) * 1.4;
          float sunDisc = smoothstep(0.9987, 0.99945, sunDot);

          col += uSunGlow * wideMie;
          col += mix(uSunGlow, uSunColor, 0.65) * tightMie;
          col += uSunColor * corona;
          col = mix(col, uSunColor * 2.6, sunDisc);

          // Warm horizon atmospheric glow band
          float band = exp(-abs(dir.y - 0.012) * 16.0) * 0.26;
          col += uSunGlow * band;

          // Volumetric-look procedural FBM cloud plane above the skyline
          if (dir.y > 0.03) {
            vec2 uv = dir.xz / (dir.y + 0.14) * 1.35;
            uv.x += uTime * 0.008;
            uv.y -= uTime * 0.003;
            float c1 = fbm(uv);
            float c2 = fbm(uv * 2.15 + vec2(4.2, -2.8));
            float density = smoothstep(0.46, 0.78, c1 * 0.72 + c2 * 0.28);

            // Fade clouds gracefully near horizon and right over the solar disc
            float horizonFade = smoothstep(0.03, 0.22, dir.y);
            density *= horizonFade * 0.82;

            // Silver-lining directional sunlight scatter through cloud edges
            float sunOffset = fbm(uv + sDir.xz * 0.08);
            float litFactor = clamp((c1 - sunOffset) * 2.8 + 0.55 + pow(sunDot, 4.0) * 0.65, 0.0, 1.35);
            vec3 cloudCol = mix(uCloudShadow, uCloudLight, clamp(litFactor, 0.0, 1.0));
            cloudCol += uSunGlow * pow(sunDot, 8.0) * 0.65 * (1.0 - density * 0.45);

            col = mix(col, cloudCol, density);
          }

          gl_FragColor = vec4(col, 1.0);
        }
      `,
    });

    const skyDome = new THREE.Mesh(new THREE.SphereGeometry(210, 48, 32), skyMat);
    this.scene.add(skyDome);

    // Animated shimmering Bay / Harbor Water Shader below the skyline
    this.waterUniforms = {
      uTime: { value: 0 },
      uSunDir: { value: SKY_MOODS[0].sunDir.clone() },
      uSunColor: { value: SKY_MOODS[0].sunColor.clone() },
      uSkyColor: { value: SKY_MOODS[0].horizon.clone() },
      uDeepColor: { value: new THREE.Color('#132436') },
    };
    const waterMat = new THREE.ShaderMaterial({
      uniforms: this.waterUniforms,
      vertexShader: `
        varying vec3 vWorldPos;
        void main() {
          vec4 wp = modelMatrix * vec4(position, 1.0);
          vWorldPos = wp.xyz;
          gl_Position = projectionMatrix * viewMatrix * wp;
        }
      `,
      fragmentShader: `
        uniform float uTime;
        uniform vec3 uSunDir;
        uniform vec3 uSunColor;
        uniform vec3 uSkyColor;
        uniform vec3 uDeepColor;
        varying vec3 vWorldPos;

        void main() {
          vec2 p = vWorldPos.xz * 0.35;
          float w1 = sin(p.x * 1.9 + uTime * 0.9) * cos(p.y * 1.4 - uTime * 0.7);
          float w2 = sin(p.x * 4.3 - uTime * 1.4 + p.y * 2.8) * 0.5;
          vec3 n = normalize(vec3((w1 + w2) * 0.055, 1.0, (w1 - w2) * 0.075));

          vec3 viewDir = normalize(cameraPosition - vWorldPos);
          float fresnel = pow(1.0 - max(dot(viewDir, n), 0.0), 4.0);
          vec3 col = mix(uDeepColor, uSkyColor * 0.78, clamp(fresnel * 1.2 + 0.18, 0.0, 1.0));

          vec3 halfV = normalize(normalize(uSunDir) + viewDir);
          float spec = pow(max(dot(n, halfV), 0.0), 140.0) * 2.8;
          float wideSpec = pow(max(dot(n, halfV), 0.0), 18.0) * 0.45;
          col += uSunColor * (spec + wideSpec);

          float distFade = smoothstep(35.0, 155.0, length(vWorldPos.xz));
          col = mix(col, uSkyColor * 0.92, distFade * 0.85);
          gl_FragColor = vec4(col, 1.0);
        }
      `,
    });
    const water = new THREE.Mesh(new THREE.PlaneGeometry(280, 190), waterMat);
    water.rotation.x = -Math.PI / 2;
    water.position.set(0, -14.8, -96);
    this.scene.add(water);

    // Distant hazy coastal mountain ridge silhouette behind the bay
    const ridgeGroup = new THREE.Group();
    const ridgeMat = new THREE.MeshBasicMaterial({
      color: 0x4b536b,
      transparent: true,
      opacity: 0.46,
    });
    const rng = mulberry32(2026);
    for (let i = 0; i < 16; i++) {
      const rx = -110 + i * 14.5 + (rng() - 0.5) * 7;
      const rw = 28 + rng() * 24;
      const rh = 11 + rng() * 16;
      const hill = new THREE.Mesh(new THREE.ConeGeometry(rw * 0.78, rh, 7), ridgeMat);
      hill.position.set(rx, -14.6 + rh * 0.45, -146 - rng() * 18);
      hill.scale.set(1.75, 1, 0.45);
      ridgeGroup.add(hill);
    }
    this.scene.add(ridgeGroup);

    // Aerial-perspective atmospheric haze injection applied ONLY to exterior skyline materials
    const injectAerialHaze = (mat) => {
      mat.onBeforeCompile = (shader) => {
        shader.uniforms.uHazeColor = this.hazeUniforms.uHazeColor;
        shader.uniforms.uSunDir = this.hazeUniforms.uSunDir;
        shader.uniforms.uSunGlow = this.hazeUniforms.uSunGlow;
        shader.vertexShader = shader.vertexShader
          .replace('#include <common>', '#include <common>\nvarying vec3 vCityWorldPos;')
          .replace(
            '#include <worldpos_vertex>',
            '#include <worldpos_vertex>\nvCityWorldPos = (modelMatrix * vec4(transformed, 1.0)).xyz;'
          );
        shader.fragmentShader = shader.fragmentShader
          .replace(
            '#include <common>',
            '#include <common>\nuniform vec3 uHazeColor;\nuniform vec3 uSunDir;\nuniform vec3 uSunGlow;\nvarying vec3 vCityWorldPos;'
          )
          .replace(
            '#include <dithering_fragment>',
            `
              float cDist = length(vCityWorldPos - cameraPosition);
              float distFactor = smoothstep(14.0, 92.0, cDist);
              float heightFactor = exp(-max(vCityWorldPos.y + 12.0, 0.0) * 0.045);
              float fogAmt = clamp(distFactor * (0.58 + 0.34 * heightFactor), 0.0, 0.84);
              vec3 vDir = normalize(vCityWorldPos - cameraPosition);
              float sunScatter = pow(max(dot(vDir, normalize(uSunDir)), 0.0), 5.0);
              vec3 finalHaze = mix(uHazeColor, uSunGlow * 1.15, sunScatter * 0.55);
              gl_FragColor.rgb = mix(gl_FragColor.rgb, finalHaze, fogAmt);
              #include <dithering_fragment>
            `
          );
      };
    };

    // Multi-layered Architectural 3D City Skyline
    const cityGroup = new THREE.Group();
    const facadeVariants = [
      createBuildingFacadeTexture(101, 'glass'),
      createBuildingFacadeTexture(202, 'glass'),
      createBuildingFacadeTexture(303, 'warm'),
      createBuildingFacadeTexture(404, 'dark'),
      createBuildingFacadeTexture(505, 'glass'),
      createBuildingFacadeTexture(606, 'warm'),
    ];

    const bldgMaterials = facadeVariants.map((f, idx) => {
      const mat = new THREE.MeshStandardMaterial({
        map: f.map,
        emissiveMap: f.emissiveMap,
        roughnessMap: f.roughnessMap,
        emissive: new THREE.Color('#ffd494'),
        emissiveIntensity: 0.7,
        roughness: idx % 2 === 0 ? 0.35 : 0.55,
        metalness: idx % 2 === 0 ? 0.68 : 0.32,
      });
      injectAerialHaze(mat);
      this.buildingWindowMaterials.push(mat);
      return mat;
    });

    const roofMat = new THREE.MeshStandardMaterial({ color: 0x222936, roughness: 0.68, metalness: 0.32 });
    injectAerialHaze(roofMat);
    const spireMat = new THREE.MeshStandardMaterial({ color: 0xdbe5f2, roughness: 0.25, metalness: 0.85 });
    injectAerialHaze(spireMat);
    const beaconMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(2.4, 0.35, 0.35) });
    const crownGlowMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.4, 1.6, 2.0) });

    const tiers = [
      { count: 22, zMin: -19, zMax: -30, xSpan: 52, hMin: 10, hMax: 23, wMin: 2.4, wMax: 4.6 },
      { count: 36, zMin: -32, zMax: -56, xSpan: 92, hMin: 15, hMax: 37, wMin: 2.9, wMax: 6.2 },
      { count: 30, zMin: -58, zMax: -88, xSpan: 136, hMin: 18, hMax: 45, wMin: 3.6, wMax: 7.4 },
    ];

    const baseFloorY = -14.8;
    for (const tier of tiers) {
      for (let i = 0; i < tier.count; i++) {
        const x = (rng() - 0.5) * tier.xSpan;
        const z = tier.zMin + rng() * (tier.zMax - tier.zMin);
        // Frame a natural golden sun corridor through the skyscrapers
        const sunCorridor = Math.abs(x + 7.2) < 5.8 ? 0.58 : 1.0;
        const centerBoost = 1.0 - Math.min(Math.abs(x) / (tier.xSpan * 0.55), 0.72) * 0.36;
        const h = (tier.hMin + rng() * (tier.hMax - tier.hMin)) * centerBoost * sunCorridor;
        const w = tier.wMin + rng() * (tier.wMax - tier.wMin);
        const d = tier.wMin + rng() * (tier.wMax - tier.wMin);

        const mat = bldgMaterials[Math.floor(rng() * bldgMaterials.length)];
        const bMesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), [mat, mat, roofMat, roofMat, mat, mat]);
        bMesh.position.set(x, baseFloorY + h * 0.5, z);
        cityGroup.add(bMesh);

        // Architectural setback crown, glowing parapet accent & antenna spire on taller towers
        if (h > 19 && rng() > 0.28) {
          const crownH = 2.6 + rng() * 5.2;
          const crownW = w * (0.58 + rng() * 0.22);
          const crownD = d * (0.58 + rng() * 0.22);
          const crown = new THREE.Mesh(
            new THREE.BoxGeometry(crownW, crownH, crownD),
            [mat, mat, roofMat, roofMat, mat, mat]
          );
          crown.position.set(x, baseFloorY + h + crownH * 0.5, z);
          cityGroup.add(crown);

          if (rng() > 0.55) {
            const strip = new THREE.Mesh(new THREE.BoxGeometry(crownW + 0.08, 0.22, crownD + 0.08), crownGlowMat);
            strip.position.set(x, baseFloorY + h + crownH - 0.2, z);
            cityGroup.add(strip);
          }

          if (h > 25 && rng() > 0.38) {
            const spireH = 3.6 + rng() * 7.2;
            const spire = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.18, spireH, 6), spireMat);
            spire.position.set(x, baseFloorY + h + crownH + spireH * 0.5, z);
            cityGroup.add(spire);

            const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.15, 8, 8), beaconMat);
            beacon.position.set(x, baseFloorY + h + crownH + spireH, z);
            cityGroup.add(beacon);
          }
        }
      }
    }
    this.scene.add(cityGroup);

    // Subtle exterior 32nd-floor architectural concrete terrace ledge & glass balustrade outside window
    const extLedge = new THREE.Mesh(
      new THREE.BoxGeometry(6.2, 0.14, 0.95),
      new THREE.MeshStandardMaterial({ color: 0x3b3f47, roughness: 0.78 })
    );
    extLedge.position.set(-0.15, 0.42, -3.22);
    this.scene.add(extLedge);

    const extRail = new THREE.Mesh(
      new THREE.BoxGeometry(6.0, 0.035, 0.045),
      new THREE.MeshStandardMaterial({ color: 0x262a33, roughness: 0.32, metalness: 0.85 })
    );
    extRail.position.set(-0.15, 1.04, -3.65);
    this.scene.add(extRail);

    // Clickable window hotspot for Skyline View
    const winHit = new THREE.Mesh(
      new THREE.PlaneGeometry(4.6, 2.1),
      new THREE.MeshBasicMaterial({ visible: false })
    );
    winHit.position.set(-0.15, 1.72, -2.54);
    winHit.userData.camPreset = 'window';
    this.clickableMeshes.push(winHit);
    this.scene.add(winHit);
  }

  // ---------- 2. Photorealistic Office Architecture, Multi-Channel PBR Wood & Plaster ----------
  _buildRoomShell() {
    const W = 6.4; // X: -3.2 .. +3.2
    const H = 3.1; // Y: 0 .. 3.1
    const D = 5.4; // Z: -2.6 .. +2.8

    // Satin-oiled European oak hardwood floor with color + roughness + bump + clearcoat
    const floorPBR = createWoodPBR({
      base: '#996f48',
      grain: '#5e3c20',
      plankLines: true,
      planksX: 5,
      planksY: 12,
      seed: 19,
      repeatX: 3.4,
      repeatY: 3.0,
      roughBase: 108,
    });
    const floorMat = new THREE.MeshPhysicalMaterial({
      map: floorPBR.map,
      roughnessMap: floorPBR.roughnessMap,
      bumpMap: floorPBR.bumpMap,
      bumpScale: 0.012,
      roughness: 0.68,
      metalness: 0.02,
      clearcoat: 0.24,
      clearcoatRoughness: 0.36,
    });
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(W, D), floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(0, 0, 0.1);
    floor.receiveShadow = true;
    this.scene.add(floor);

    // Plush woven geometric area rug with physical sheen + bump + soft edge contact shadow
    const rugPBR = createRugPBR();
    const rugMat = new THREE.MeshPhysicalMaterial({
      map: rugPBR.map,
      bumpMap: rugPBR.bumpMap,
      bumpScale: 0.016,
      roughness: 0.94,
      metalness: 0.0,
      sheen: 0.65,
      sheenRoughness: 0.85,
      sheenColor: new THREE.Color('#f5efe4'),
    });
    const rug = new THREE.Mesh(new RoundedBoxGeometry(3.26, 0.016, 2.36, 2, 0.005), rugMat);
    rug.position.set(-0.28, 0.008, -0.35);
    rug.receiveShadow = true;
    this.scene.add(rug);

    // Subtle plaster walls with baked corner AO & micro-stucco bump
    const wallPBR = createPlasterPBR('#ebe4d9', 71);
    const accentPBR = createPlasterPBR('#ddd5c8', 89);
    const wallMat = new THREE.MeshStandardMaterial({
      map: wallPBR.map,
      bumpMap: wallPBR.bumpMap,
      bumpScale: 0.004,
      roughness: 0.88,
      metalness: 0.0,
    });
    const accentWallMat = new THREE.MeshStandardMaterial({
      map: accentPBR.map,
      bumpMap: accentPBR.bumpMap,
      bumpScale: 0.004,
      roughness: 0.86,
      metalness: 0.0,
    });
    const ceilingMat = new THREE.MeshStandardMaterial({
      color: 0xf4f0ea,
      roughness: 0.92,
    });
    const trimMat = new THREE.MeshStandardMaterial({
      color: 0xf0ebe2,
      roughness: 0.45,
    });

    const leftWall = new THREE.Mesh(new THREE.PlaneGeometry(D, H), accentWallMat);
    leftWall.rotation.y = Math.PI / 2;
    leftWall.position.set(-W / 2, H / 2, 0.1);
    leftWall.receiveShadow = true;
    this.scene.add(leftWall);

    const rightWall = new THREE.Mesh(new THREE.PlaneGeometry(D, H), wallMat);
    rightWall.rotation.y = -Math.PI / 2;
    rightWall.position.set(W / 2, H / 2, 0.1);
    rightWall.receiveShadow = true;
    this.scene.add(rightWall);

    const rearWall = new THREE.Mesh(new THREE.PlaneGeometry(W, H), wallMat);
    rearWall.rotation.y = Math.PI;
    rearWall.position.set(0, H / 2, 2.8);
    rearWall.receiveShadow = true;
    this.scene.add(rearWall);

    const ceiling = new THREE.Mesh(new THREE.PlaneGeometry(W, D), ceilingMat);
    ceiling.rotation.x = Math.PI / 2;
    ceiling.position.set(0, H, 0.1);
    this.scene.add(ceiling);

    // Back wall (Z = -2.6) cleanly framing the panoramic window aperture
    const wallThick = 0.24;
    const zBack = -2.6 - wallThick * 0.5;
    const addWallBlock = (w, h, x, y) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, wallThick), wallMat);
      m.position.set(x, y, zBack);
      m.castShadow = true;
      m.receiveShadow = true;
      this.scene.add(m);
    };
    addWallBlock(0.65, H, -3.2 + 0.325, H / 2);
    addWallBlock(0.95, H, 2.25 + 0.475, H / 2);
    addWallBlock(4.8, 0.58, -0.15, 0.29);
    addWallBlock(4.8, 0.28, -0.15, 2.96);

    // Anodized dark-bronze architectural curtain-wall window frame & slim mullions
    const frameMat = new THREE.MeshStandardMaterial({
      color: 0x20232a,
      roughnessMap: this.brushedMetalTex,
      roughness: 0.38,
      metalness: 0.82,
    });
    const addMullion = (w, h, d, x, y, z) => {
      const m = new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 2, 0.004), frameMat);
      m.position.set(x, y, z);
      m.castShadow = true;
      m.receiveShadow = true;
      this.scene.add(m);
    };
    const wz = -2.68;
    addMullion(4.84, 0.064, 0.15, -0.15, 2.82, wz);
    addMullion(4.84, 0.064, 0.15, -0.15, 0.58, wz);
    addMullion(0.064, 2.28, 0.15, -2.55, 1.7, wz);
    addMullion(0.064, 2.28, 0.15, 2.25, 1.7, wz);
    addMullion(0.044, 2.22, 0.11, -0.95, 1.7, wz);
    addMullion(0.044, 2.22, 0.11, 0.65, 1.7, wz);

    // Deep beveled walnut window sill catching golden sun reflections
    const sillPBR = createWoodPBR({
      base: '#6c472d',
      grain: '#3e2514',
      plankLines: false,
      seed: 31,
      repeatX: 2.2,
      repeatY: 1,
      roughBase: 92,
    });
    const sill = new THREE.Mesh(
      new RoundedBoxGeometry(4.92, 0.038, 0.34, 2, 0.006),
      new THREE.MeshPhysicalMaterial({
        map: sillPBR.map,
        roughnessMap: sillPBR.roughnessMap,
        bumpMap: sillPBR.bumpMap,
        bumpScale: 0.008,
        roughness: 0.55,
        clearcoat: 0.3,
        clearcoatRoughness: 0.3,
      })
    );
    sill.position.set(-0.15, 0.598, -2.62);
    sill.receiveShadow = true;
    this.scene.add(sill);

    // Crisp architectural acoustic oak wood-slat accent panel on left wall
    const slatWoodMat = new THREE.MeshStandardMaterial({
      color: 0x8b5d3a,
      roughnessMap: sillPBR.roughnessMap,
      roughness: 0.58,
    });
    const feltMat = new THREE.MeshStandardMaterial({ color: 0x1a1d22, roughness: 0.96 });
    const feltBacking = new THREE.Mesh(new THREE.BoxGeometry(0.014, 2.66, 1.62), feltMat);
    feltBacking.position.set(-3.188, 1.48, -1.62);
    this.scene.add(feltBacking);
    for (let i = 0; i < 24; i++) {
      const slat = new THREE.Mesh(new THREE.BoxGeometry(0.028, 2.66, 0.036), slatWoodMat);
      slat.position.set(-3.168, 1.48, -2.38 + i * 0.066);
      slat.castShadow = true;
      slat.receiveShadow = true;
      this.scene.add(slat);
    }

    // Crisp recessed baseboards & crown shadow-gap trim
    const addBaseboard = (w, h, d, x, y, z) => {
      const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), trimMat);
      b.position.set(x, y, z);
      b.receiveShadow = true;
      this.scene.add(b);
    };
    addBaseboard(0.024, 0.11, D, -3.188, 0.055, 0.1);
    addBaseboard(0.024, 0.11, D, 3.188, 0.055, 0.1);
    addBaseboard(W, 0.11, 0.024, 0, 0.055, -2.588);

    // Recessed warm ceiling downlights + architectural brass & matte-black linear pendant
    const fixtureMat = new THREE.MeshStandardMaterial({
      color: 0x22262e,
      roughness: 0.32,
      metalness: 0.78,
    });
    const glowBulbMat = new THREE.MeshStandardMaterial({
      color: 0xfff5e0,
      emissive: 0xffd596,
      emissiveIntensity: 2.8,
    });
    for (const [dx, dz] of [
      [-1.7, -1.2],
      [1.7, -1.2],
      [-1.7, 1.2],
      [1.7, 1.2],
    ]) {
      const ring = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.085, 0.015, 20), fixtureMat);
      ring.position.set(dx, H - 0.008, dz);
      this.scene.add(ring);
      const lens = new THREE.Mesh(new THREE.CylinderGeometry(0.058, 0.058, 0.01, 20), glowBulbMat);
      lens.position.set(dx, H - 0.014, dz);
      this.scene.add(lens);
    }

    const pendantGroup = new THREE.Group();
    const brassMat = new THREE.MeshStandardMaterial({
      color: 0xd0a764,
      roughnessMap: this.brushedMetalTex,
      roughness: 0.28,
      metalness: 0.9,
    });
    const bar = new THREE.Mesh(new RoundedBoxGeometry(1.42, 0.042, 0.058, 2, 0.006), fixtureMat);
    bar.position.set(-0.35, 2.48, -0.95);
    pendantGroup.add(bar);
    const barAccent = new THREE.Mesh(new THREE.BoxGeometry(1.44, 0.01, 0.062), brassMat);
    barAccent.position.set(-0.35, 2.502, -0.95);
    pendantGroup.add(barAccent);
    const diffuser = new THREE.Mesh(new THREE.BoxGeometry(1.34, 0.01, 0.04), glowBulbMat);
    diffuser.position.set(-0.35, 2.456, -0.95);
    pendantGroup.add(diffuser);
    for (const sx of [-0.92, 0.22]) {
      const wire = new THREE.Mesh(new THREE.CylinderGeometry(0.0035, 0.0035, 0.62, 8), fixtureMat);
      wire.position.set(sx, 2.79, -0.95);
      pendantGroup.add(wire);
    }
    this.scene.add(pendantGroup);
  }

  // ---------- 3. Photorealistic Lighting: Window Area Light + Crisp Sun + Shadow Spot Lamp ----------
  _buildLighting() {
    this.hemiLight = new THREE.HemisphereLight(0xffe4c4, 0x4d3a2c, 0.72);
    this.scene.add(this.hemiLight);

    // Primary Sunlight pouring diagonally through the panoramic window (tight high-res shadow frustum!)
    this.sunLight = new THREE.DirectionalLight(0xffd299, 3.4);
    this.sunLight.position.set(-3.4, 3.6, -13.2);
    this.sunLight.target.position.set(0.15, 0.6, -0.1);
    this.sunLight.castShadow = true;
    this.sunLight.shadow.mapSize.set(2048, 2048);
    this.sunLight.shadow.camera.near = 4;
    this.sunLight.shadow.camera.far = 22;
    this.sunLight.shadow.camera.left = -3.8;
    this.sunLight.shadow.camera.right = 3.8;
    this.sunLight.shadow.camera.top = 3.6;
    this.sunLight.shadow.camera.bottom = -1.6;
    this.sunLight.shadow.bias = -0.0004;
    this.sunLight.shadow.normalBias = 0.018;
    this.scene.add(this.sunLight);
    this.scene.add(this.sunLight.target);

    // Real Window Sky Portal RectAreaLight — casts true soft window reflections across wood, metal & glass!
    this.windowPortalLight = new THREE.RectAreaLight(0xffdfb8, 2.8, 4.7, 2.15);
    this.windowPortalLight.position.set(-0.15, 1.7, -2.52);
    this.windowPortalLight.lookAt(-0.15, 1.35, 1.0);
    this.scene.add(this.windowPortalLight);

    // Real Linear Pendant RectAreaLight over the walnut desk
    this.pendantAreaLight = new THREE.RectAreaLight(0xffdca8, 1.4, 1.34, 0.12);
    this.pendantAreaLight.position.set(-0.35, 2.43, -0.95);
    this.pendantAreaLight.lookAt(-0.35, 0.75, -0.95);
    this.scene.add(this.pendantAreaLight);

    // Warm Architect Desk Lamp SpotLight (casts cozy golden pool across walnut desk & mug!)
    this.deskLampLight = new THREE.SpotLight(0xffc275, 3.2, 3.8, Math.PI * 0.38, 0.68, 1.8);
    this.deskLampLight.position.set(-1.1, 1.19, -1.03);
    this.deskLampLight.target.position.set(-0.98, 0.77, -0.78);
    this.deskLampLight.castShadow = true;
    this.deskLampLight.shadow.mapSize.set(512, 512);
    this.deskLampLight.shadow.bias = -0.0006;
    this.scene.add(this.deskLampLight);
    this.scene.add(this.deskLampLight.target);

    // Subtle cool cyan screen bounce onto desk mat & keyboard
    this.screenGlowLight = new THREE.PointLight(0x7dcfff, 0.55, 2.2, 2.0);
    this.screenGlowLight.position.set(-0.56, 1.14, -0.9);
    this.scene.add(this.screenGlowLight);

    // Subtle interior RGB fill inside the Corsair tower
    this.pcRgbLight = new THREE.PointLight(0x73daca, 0.85, 1.35, 2.0);
    this.pcRgbLight.position.set(0.45, 1.04, -0.95);
    this.scene.add(this.pcRgbLight);
  }

  // ---------- 4. Bookshelf, Books & Gallery Wall Art ----------
  _buildBookshelfAndDecor() {
    const shelfGroup = new THREE.Group();
    shelfGroup.position.set(-2.96, 0, 0.42);
    shelfGroup.rotation.y = Math.PI / 2;

    const steelMat = new THREE.MeshStandardMaterial({
      color: 0x1d2128,
      roughnessMap: this.brushedMetalTex,
      roughness: 0.4,
      metalness: 0.8,
    });
    const shelfPBR = createWoodPBR({
      base: '#7a5234',
      grain: '#482d1a',
      plankLines: false,
      seed: 77,
      repeatX: 2,
      repeatY: 1,
      roughBase: 105,
    });
    const shelfWoodMat = new THREE.MeshStandardMaterial({
      map: shelfPBR.map,
      roughnessMap: shelfPBR.roughnessMap,
      bumpMap: shelfPBR.bumpMap,
      bumpScale: 0.006,
      roughness: 0.62,
    });

    const sw = 1.68;
    const sh = 2.18;
    const sd = 0.36;

    for (const ux of [-sw / 2 + 0.02, sw / 2 - 0.02]) {
      for (const uz of [-sd / 2 + 0.02, sd / 2 - 0.02]) {
        const post = new THREE.Mesh(new THREE.BoxGeometry(0.026, sh, 0.026), steelMat);
        post.position.set(ux, sh / 2, uz);
        post.castShadow = true;
        post.receiveShadow = true;
        shelfGroup.add(post);
      }
    }

    const shelfYs = [0.14, 0.54, 0.94, 1.34, 1.74, 2.12];
    for (const y of shelfYs) {
      const board = new THREE.Mesh(new RoundedBoxGeometry(sw - 0.02, 0.028, sd - 0.01, 2, 0.003), shelfWoodMat);
      board.position.set(0, y, 0);
      board.castShadow = true;
      board.receiveShadow = true;
      shelfGroup.add(board);
    }

    const rng = mulberry32(909);
    const bookColors = [
      0x274060, 0x8c3b32, 0x2e5b4f, 0xc79248, 0x3b354d,
      0x5d432c, 0x1f3a52, 0xa8583b, 0x4b5d4e, 0xd4c7b0,
      0x262d38, 0x7a2e45,
    ];

    for (let si = 0; si < 5; si++) {
      const baseY = shelfYs[si] + 0.014;
      let cursorX = -sw / 2 + 0.08;
      while (cursorX < sw / 2 - 0.14) {
        if (rng() < 0.18 && cursorX < sw / 2 - 0.32) {
          if (rng() < 0.5) {
            const box = new THREE.Mesh(
              new RoundedBoxGeometry(0.24, 0.16, 0.25, 2, 0.004),
              new THREE.MeshStandardMaterial({ color: 0x2c323e, roughness: 0.85 })
            );
            box.position.set(cursorX + 0.13, baseY + 0.08, 0.01);
            box.castShadow = true;
            shelfGroup.add(box);
            cursorX += 0.29;
          } else {
            const vase = new THREE.Mesh(
              new THREE.LatheGeometry(
                [
                  new THREE.Vector2(0.035, 0),
                  new THREE.Vector2(0.062, 0.08),
                  new THREE.Vector2(0.048, 0.16),
                  new THREE.Vector2(0.028, 0.21),
                  new THREE.Vector2(0.036, 0.23),
                ],
                18
              ),
              new THREE.MeshPhysicalMaterial({
                color: si % 2 === 0 ? 0xd9cbb8 : 0x395853,
                roughness: 0.36,
                clearcoat: 0.45,
              })
            );
            vase.position.set(cursorX + 0.11, baseY, 0.02);
            vase.castShadow = true;
            shelfGroup.add(vase);
            cursorX += 0.24;
          }
          continue;
        }

        const bw = 0.024 + rng() * 0.026;
        const bh = 0.21 + rng() * 0.11;
        const bd = 0.19 + rng() * 0.06;
        const col = bookColors[Math.floor(rng() * bookColors.length)];
        const book = new THREE.Mesh(
          new THREE.BoxGeometry(bw, bh, bd),
          new THREE.MeshStandardMaterial({ color: col, roughness: 0.72 })
        );
        book.position.set(cursorX + bw / 2, baseY + bh / 2, (rng() - 0.5) * 0.03);
        book.rotation.z = (rng() - 0.5) * 0.04;
        book.castShadow = true;
        book.receiveShadow = true;
        shelfGroup.add(book);
        cursorX += bw + 0.005;
      }
    }

    // Trailing pothos plant on top shelf
    const pot = new THREE.Mesh(
      new THREE.CylinderGeometry(0.075, 0.058, 0.12, 18),
      new THREE.MeshStandardMaterial({ color: 0xe2d9cc, roughness: 0.5 })
    );
    pot.position.set(0.42, shelfYs[5] + 0.074, 0.02);
    shelfGroup.add(pot);
    const leafMat = new THREE.MeshPhysicalMaterial({
      color: 0x366e40,
      roughness: 0.42,
      clearcoat: 0.25,
      side: THREE.DoubleSide,
    });
    for (let l = 0; l < 14; l++) {
      const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.038, 8, 6), leafMat);
      leaf.scale.set(1.2, 0.25, 0.85);
      const a = l * 0.55;
      leaf.position.set(
        0.42 + Math.cos(a) * (0.04 + l * 0.009),
        shelfYs[5] + 0.14 - Math.max(0, l - 5) * 0.028,
        0.04 + Math.sin(a) * 0.05 + Math.max(0, l - 5) * 0.015
      );
      leaf.rotation.set(0.3, a, 0.4);
      shelfGroup.add(leaf);
    }

    this._addContactShadow(shelfGroup, 0, 0.003, 0, 1.85, 0.54, 0.42);
    this.scene.add(shelfGroup);

    // Framed gallery art with glass reflections
    const addFramedArt = (x, y, z, rotY, w, h, variant) => {
      const g = new THREE.Group();
      const frame = new THREE.Mesh(
        new RoundedBoxGeometry(w + 0.055, h + 0.055, 0.032, 2, 0.004),
        new THREE.MeshStandardMaterial({ color: 0x1d1c1b, roughness: 0.42 })
      );
      frame.castShadow = true;
      g.add(frame);
      const art = new THREE.Mesh(
        new THREE.PlaneGeometry(w, h),
        new THREE.MeshPhysicalMaterial({
          map: createWallArtTexture(variant),
          roughness: 0.22,
          clearcoat: 0.65,
          clearcoatRoughness: 0.12,
        })
      );
      art.position.z = 0.017;
      g.add(art);
      g.position.set(x, y, z);
      g.rotation.y = rotY;
      this.scene.add(g);
    };

    addFramedArt(-3.17, 1.78, -1.62, Math.PI / 2, 0.58, 0.72, 0);
    addFramedArt(3.17, 1.84, -0.32, -Math.PI / 2, 0.64, 0.78, 1);
  }

  // ---------- 5. Veined Wax-Gloss Office Plants ----------
  _buildPlants() {
    const leafPBR = createLeafPBR();
    const leafMat1 = new THREE.MeshPhysicalMaterial({
      map: leafPBR.map,
      bumpMap: leafPBR.bumpMap,
      bumpScale: 0.006,
      roughness: 0.38,
      clearcoat: 0.3,
      clearcoatRoughness: 0.28,
      side: THREE.DoubleSide,
    });
    const leafMat2 = leafMat1.clone();
    leafMat2.color = new THREE.Color('#c2e0be');

    const buildFiddleFig = (x, z, scale = 1) => {
      const g = new THREE.Group();
      const planter = new THREE.Mesh(
        new THREE.CylinderGeometry(0.22, 0.16, 0.36, 26),
        new THREE.MeshPhysicalMaterial({ color: 0xe9e2d6, roughness: 0.48, clearcoat: 0.25 })
      );
      planter.position.y = 0.18;
      planter.castShadow = true;
      planter.receiveShadow = true;
      g.add(planter);

      const standMat = new THREE.MeshStandardMaterial({ color: 0x764f30, roughness: 0.48 });
      for (let i = 0; i < 4; i++) {
        const a = (i * Math.PI) / 2 + Math.PI / 4;
        const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.014, 0.34, 8), standMat);
        leg.position.set(Math.cos(a) * 0.18, 0.17, Math.sin(a) * 0.18);
        g.add(leg);
      }

      const soil = new THREE.Mesh(
        new THREE.CylinderGeometry(0.2, 0.2, 0.02, 20),
        new THREE.MeshStandardMaterial({ color: 0x2b1e14, roughness: 0.96 })
      );
      soil.position.y = 0.35;
      g.add(soil);

      const trunkMat = new THREE.MeshStandardMaterial({ color: 0x563e2a, roughness: 0.88 });
      const trunkCurve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(0, 0.35, 0),
        new THREE.Vector3(0.04, 0.72, -0.02),
        new THREE.Vector3(-0.02, 1.12, 0.03),
        new THREE.Vector3(0.03, 1.48, 0.01),
      ]);
      const trunk = new THREE.Mesh(new THREE.TubeGeometry(trunkCurve, 14, 0.024, 8, false), trunkMat);
      trunk.castShadow = true;
      g.add(trunk);

      const rng = mulberry32(555);
      const leafShape = new THREE.Shape();
      leafShape.moveTo(0, 0);
      leafShape.bezierCurveTo(0.08, 0.05, 0.12, 0.18, 0.07, 0.26);
      leafShape.bezierCurveTo(0.03, 0.31, -0.03, 0.31, -0.07, 0.26);
      leafShape.bezierCurveTo(-0.12, 0.18, -0.08, 0.05, 0, 0);
      const leafGeo = new THREE.ShapeGeometry(leafShape, 10);

      for (let i = 0; i < 28; i++) {
        const t = 0.28 + (i / 28) * 0.72;
        const pt = trunkCurve.getPoint(t);
        const angle = i * 2.39996;
        const radius = 0.06 + (1 - Math.abs(t - 0.68)) * 0.22;

        const stemEnd = new THREE.Vector3(
          pt.x + Math.cos(angle) * radius,
          pt.y + 0.05 + rng() * 0.1,
          pt.z + Math.sin(angle) * radius
        );
        g.add(
          new THREE.Mesh(
            new THREE.TubeGeometry(new THREE.LineCurve3(pt, stemEnd), 2, 0.0055, 5, false),
            trunkMat
          )
        );

        const leaf = new THREE.Mesh(leafGeo, i % 2 === 0 ? leafMat1 : leafMat2);
        leaf.position.copy(stemEnd);
        leaf.rotation.set(0.65 + rng() * 0.45, angle + Math.PI / 2, (rng() - 0.5) * 0.4);
        const ls = 0.72 + rng() * 0.48;
        leaf.scale.set(ls, ls, ls);
        leaf.castShadow = true;
        g.add(leaf);
      }

      this._addContactShadow(g, 0, 0.003, 0, 0.65, 0.65, 0.45);
      g.position.set(x, 0, z);
      g.scale.setScalar(scale);
      this.scene.add(g);
    };

    buildFiddleFig(-2.45, -2.02, 1.05);

    // Tall Snake Plant near right window corner
    const snakeGroup = new THREE.Group();
    const sPot = new THREE.Mesh(
      new THREE.CylinderGeometry(0.17, 0.13, 0.32, 22),
      new THREE.MeshPhysicalMaterial({ color: 0x282d36, roughness: 0.52, clearcoat: 0.2 })
    );
    sPot.position.y = 0.16;
    sPot.castShadow = true;
    snakeGroup.add(sPot);

    const bladeMat = new THREE.MeshPhysicalMaterial({
      color: 0x316640,
      roughness: 0.4,
      clearcoat: 0.22,
      side: THREE.DoubleSide,
    });
    const bladeEdgeMat = new THREE.MeshPhysicalMaterial({
      color: 0x598c52,
      roughness: 0.42,
      clearcoat: 0.2,
      side: THREE.DoubleSide,
    });
    const rng2 = mulberry32(314);
    for (let i = 0; i < 16; i++) {
      const bh = 0.42 + rng2() * 0.44;
      const bw = 0.045 + rng2() * 0.025;
      const blade = new THREE.Mesh(
        new THREE.ConeGeometry(bw, bh, 4),
        i % 3 === 0 ? bladeEdgeMat : bladeMat
      );
      blade.scale.set(1, 1, 0.18);
      const a = (i / 16) * Math.PI * 2 + rng2() * 0.25;
      const r = 0.03 + rng2() * 0.08;
      blade.position.set(Math.cos(a) * r, 0.28 + bh * 0.46, Math.sin(a) * r);
      blade.rotation.set((rng2() - 0.5) * 0.18, a, (rng2() - 0.5) * 0.18);
      blade.castShadow = true;
      snakeGroup.add(blade);
    }
    this._addContactShadow(snakeGroup, 0, 0.003, 0, 0.52, 0.52, 0.45);
    snakeGroup.position.set(2.55, 0, -1.92);
    this.scene.add(snakeGroup);
  }

  // ---------- 6. Beveled Walnut Desk, Tactile Peripherals, Lamp & Sculpted Chair ----------
  _buildDeskAndChair() {
    const deskGroup = new THREE.Group();
    const deskX = -0.35;
    const deskZ = -0.95;
    const topY = 0.75;
    const topThick = 0.042;
    const deskW = 2.18;
    const deskD = 0.9;

    const walnutPBR = createWoodPBR({
      base: '#6b452a',
      grain: '#382112',
      plankLines: false,
      seed: 108,
      repeatX: 2.2,
      repeatY: 1.0,
      roughBase: 86,
    });
    const walnutMat = new THREE.MeshPhysicalMaterial({
      map: walnutPBR.map,
      roughnessMap: walnutPBR.roughnessMap,
      bumpMap: walnutPBR.bumpMap,
      bumpScale: 0.008,
      roughness: 0.52,
      metalness: 0.02,
      clearcoat: 0.36,
      clearcoatRoughness: 0.28,
    });
    const metalMat = new THREE.MeshStandardMaterial({
      color: 0x1c2028,
      roughnessMap: this.brushedMetalTex,
      roughness: 0.36,
      metalness: 0.84,
    });

    // Beveled walnut slab desktop (catches crisp specular edge highlights!)
    const desktop = new THREE.Mesh(new RoundedBoxGeometry(deskW, topThick, deskD, 3, 0.007), walnutMat);
    desktop.position.set(deskX, topY, deskZ);
    desktop.castShadow = true;
    desktop.receiveShadow = true;
    deskGroup.add(desktop);

    for (const lx of [deskX - deskW / 2 + 0.12, deskX + deskW / 2 - 0.12]) {
      const legFront = new THREE.Mesh(new RoundedBoxGeometry(0.052, topY - 0.02, 0.052, 2, 0.004), metalMat);
      legFront.position.set(lx, (topY - 0.02) / 2, deskZ + deskD / 2 - 0.12);
      legFront.castShadow = true;
      deskGroup.add(legFront);

      const legBack = new THREE.Mesh(new RoundedBoxGeometry(0.052, topY - 0.02, 0.052, 2, 0.004), metalMat);
      legBack.position.set(lx, (topY - 0.02) / 2, deskZ - deskD / 2 + 0.12);
      legBack.castShadow = true;
      deskGroup.add(legBack);

      const footBar = new THREE.Mesh(new RoundedBoxGeometry(0.052, 0.036, deskD - 0.2, 2, 0.004), metalMat);
      footBar.position.set(lx, 0.022, deskZ);
      footBar.castShadow = true;
      deskGroup.add(footBar);

      const topBar = new THREE.Mesh(new THREE.BoxGeometry(0.052, 0.036, deskD - 0.2), metalMat);
      topBar.position.set(lx, topY - 0.04, deskZ);
      deskGroup.add(topBar);

      this._addContactShadow(deskGroup, lx, 0.017, deskZ, 0.24, deskD - 0.08, 0.42);
    }
    const beam = new THREE.Mesh(new THREE.BoxGeometry(deskW - 0.26, 0.045, 0.04), metalMat);
    beam.position.set(deskX, topY - 0.08, deskZ - 0.26);
    deskGroup.add(beam);

    const sy = topY + topThick / 2; // 0.771

    // Tactile charcoal wool/leather desk mat
    const matMesh = new THREE.Mesh(
      new RoundedBoxGeometry(1.06, 0.005, 0.44, 2, 0.002),
      new THREE.MeshPhysicalMaterial({
        color: 0x1b1f27,
        roughness: 0.9,
        sheen: 0.5,
        sheenRoughness: 0.85,
      })
    );
    matMesh.position.set(-0.56, sy + 0.0025, -0.78);
    matMesh.receiveShadow = true;
    deskGroup.add(matMesh);

    // Mechanical 75% Aluminum RGB Keyboard
    const kbGroup = new THREE.Group();
    const kbBody = new THREE.Mesh(
      new RoundedBoxGeometry(0.34, 0.018, 0.135, 2, 0.003),
      new THREE.MeshStandardMaterial({ color: 0x181c24, roughness: 0.34, metalness: 0.65 })
    );
    kbBody.castShadow = true;
    kbGroup.add(kbBody);

    const kbGlow = new THREE.Mesh(
      new THREE.BoxGeometry(0.344, 0.004, 0.139),
      new THREE.MeshStandardMaterial({
        color: 0x7dcfff,
        emissive: 0x73daca,
        emissiveIntensity: 1.6,
      })
    );
    kbGlow.position.y = -0.006;
    kbGroup.add(kbGlow);

    const keyMat = new THREE.MeshStandardMaterial({ color: 0x252b37, roughness: 0.52 });
    const accentKeyMat = new THREE.MeshStandardMaterial({ color: 0x2f7585, roughness: 0.42 });
    for (let r = 0; r < 5; r++) {
      for (let c = 0; c < 14; c++) {
        if (r === 4 && c >= 4 && c <= 9) continue;
        const cap = new THREE.Mesh(
          new THREE.BoxGeometry(0.018, 0.009, 0.018),
          (r === 0 && c === 0) || (r === 2 && c === 13) ? accentKeyMat : keyMat
        );
        cap.position.set(-0.148 + c * 0.0225, 0.012, -0.046 + r * 0.023);
        kbGroup.add(cap);
      }
    }
    const spacebar = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.009, 0.018), keyMat);
    spacebar.position.set(-0.01, 0.012, 0.046);
    kbGroup.add(spacebar);

    kbGroup.position.set(-0.62, sy + 0.014, -0.73);
    kbGroup.rotation.x = 0.06;
    deskGroup.add(kbGroup);

    // Ergonomic wireless mouse
    const mouse = new THREE.Mesh(
      new THREE.SphereGeometry(0.042, 18, 14),
      new THREE.MeshPhysicalMaterial({ color: 0x1e232d, roughness: 0.32, clearcoat: 0.25 })
    );
    mouse.scale.set(0.75, 0.45, 1.38);
    mouse.position.set(-0.24, sy + 0.018, -0.73);
    mouse.castShadow = true;
    deskGroup.add(mouse);

    // Studio monitor speakers with spun-copper woofer cones
    const copperMat = new THREE.MeshStandardMaterial({
      color: 0xc47b47,
      roughnessMap: this.brushedMetalTex,
      roughness: 0.26,
      metalness: 0.86,
    });
    for (const sx of [-1.06, -0.05]) {
      const spk = new THREE.Group();
      const cab = new THREE.Mesh(
        new RoundedBoxGeometry(0.11, 0.18, 0.13, 2, 0.006),
        new THREE.MeshStandardMaterial({ color: 0x171b22, roughness: 0.52 })
      );
      cab.position.y = 0.09;
      cab.castShadow = true;
      spk.add(cab);
      const woofer = new THREE.Mesh(new THREE.CylinderGeometry(0.036, 0.036, 0.01, 22), copperMat);
      woofer.rotation.x = Math.PI / 2;
      woofer.position.set(0, 0.065, 0.063);
      spk.add(woofer);
      const tweeter = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.01, 16), metalMat);
      tweeter.rotation.x = Math.PI / 2;
      tweeter.position.set(0, 0.135, 0.063);
      spk.add(tweeter);
      spk.position.set(sx, sy, -1.16);
      spk.rotation.y = sx < -0.5 ? 0.22 : -0.22;
      deskGroup.add(spk);
    }

    // Warm Brushed-Brass & Matte-Black Architect Desk Lamp
    const lampGroup = new THREE.Group();
    const brassMat = new THREE.MeshStandardMaterial({
      color: 0xd4a964,
      roughnessMap: this.brushedMetalTex,
      roughness: 0.24,
      metalness: 0.9,
    });
    const lampBase = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.092, 0.022, 26), metalMat);
    lampBase.position.y = 0.011;
    lampBase.castShadow = true;
    lampGroup.add(lampBase);

    const arm1 = new THREE.Mesh(new THREE.CylinderGeometry(0.009, 0.01, 0.34, 12), brassMat);
    arm1.position.set(-0.02, 0.17, -0.02);
    arm1.rotation.z = 0.16;
    lampGroup.add(arm1);

    const arm2 = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.009, 0.26, 12), brassMat);
    arm2.position.set(0.06, 0.37, 0.04);
    arm2.rotation.z = -0.82;
    arm2.rotation.x = 0.35;
    lampGroup.add(arm2);

    const shade = new THREE.Mesh(new THREE.ConeGeometry(0.095, 0.13, 26, 1, true), metalMat);
    shade.position.set(0.16, 0.42, 0.09);
    shade.rotation.z = -0.35;
    shade.rotation.x = 0.22;
    shade.castShadow = true;
    lampGroup.add(shade);

    const bulb = new THREE.Mesh(
      new THREE.SphereGeometry(0.03, 14, 14),
      new THREE.MeshStandardMaterial({
        color: 0xfff5db,
        emissive: 0xffc66e,
        emissiveIntensity: 4.0,
      })
    );
    bulb.position.set(0.16, 0.39, 0.09);
    lampGroup.add(bulb);

    lampGroup.position.set(-1.26, sy, -1.12);
    deskGroup.add(lampGroup);

    // Glazed ceramic coffee mug on cork coaster
    const coaster = new THREE.Mesh(
      new THREE.CylinderGeometry(0.048, 0.048, 0.006, 20),
      new THREE.MeshStandardMaterial({ color: 0xa67c52, roughness: 0.9 })
    );
    coaster.position.set(-1.18, sy + 0.003, -0.72);
    deskGroup.add(coaster);

    const mug = new THREE.Mesh(
      new THREE.CylinderGeometry(0.038, 0.034, 0.092, 22),
      new THREE.MeshPhysicalMaterial({ color: 0xeee8de, roughness: 0.24, clearcoat: 0.6 })
    );
    mug.position.set(-1.18, sy + 0.052, -0.72);
    mug.castShadow = true;
    deskGroup.add(mug);

    const coffee = new THREE.Mesh(
      new THREE.CylinderGeometry(0.033, 0.033, 0.005, 18),
      new THREE.MeshPhysicalMaterial({ color: 0x26140a, roughness: 0.08, clearcoat: 0.9 })
    );
    coffee.position.set(-1.18, sy + 0.088, -0.72);
    deskGroup.add(coffee);

    // Terracotta desk succulent
    const sucPot = new THREE.Mesh(
      new THREE.CylinderGeometry(0.046, 0.036, 0.075, 18),
      new THREE.MeshStandardMaterial({ color: 0xc27756, roughness: 0.72 })
    );
    sucPot.position.set(-1.32, sy + 0.038, -0.84);
    sucPot.castShadow = true;
    deskGroup.add(sucPot);

    const sucMat = new THREE.MeshPhysicalMaterial({ color: 0x4c8256, roughness: 0.45, clearcoat: 0.2 });
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const petal = new THREE.Mesh(new THREE.ConeGeometry(0.018, 0.055, 6), sucMat);
      petal.position.set(-1.32 + Math.cos(a) * 0.018, sy + 0.09, -0.84 + Math.sin(a) * 0.018);
      petal.rotation.set(Math.sin(a) * 0.5, 0, -Math.cos(a) * 0.5);
      deskGroup.add(petal);
    }

    this.scene.add(deskGroup);

    // ---------- Sculpted Ergonomic Executive Chair ----------
    const chair = new THREE.Group();
    const chairFabric = new THREE.MeshPhysicalMaterial({
      color: 0x242933,
      roughness: 0.84,
      sheen: 0.55,
      sheenRoughness: 0.8,
    });
    const chairMeshMat = new THREE.MeshStandardMaterial({ color: 0x1a1e26, roughness: 0.72 });
    const chromeMat = new THREE.MeshStandardMaterial({ color: 0xd4dce6, roughness: 0.14, metalness: 0.95 });

    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      const spoke = new THREE.Mesh(new RoundedBoxGeometry(0.034, 0.024, 0.3, 2, 0.005), metalMat);
      spoke.position.set(Math.sin(a) * 0.15, 0.065, Math.cos(a) * 0.15);
      spoke.rotation.y = a;
      chair.add(spoke);

      const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.032, 14), metalMat);
      wheel.rotation.z = Math.PI / 2;
      wheel.position.set(Math.sin(a) * 0.28, 0.026, Math.cos(a) * 0.28);
      chair.add(wheel);
    }

    const cyl = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.03, 0.38, 16), chromeMat);
    cyl.position.y = 0.26;
    chair.add(cyl);

    const seat = new THREE.Mesh(new RoundedBoxGeometry(0.5, 0.08, 0.48, 3, 0.022), chairFabric);
    seat.position.set(0, 0.47, 0);
    seat.castShadow = true;
    seat.receiveShadow = true;
    chair.add(seat);

    const spine = new THREE.Mesh(new RoundedBoxGeometry(0.06, 0.56, 0.04, 2, 0.008), metalMat);
    spine.position.set(0, 0.74, 0.25);
    spine.rotation.x = -0.09;
    chair.add(spine);

    const backFrame = new THREE.Mesh(new RoundedBoxGeometry(0.46, 0.54, 0.038, 3, 0.014), chairMeshMat);
    backFrame.position.set(0, 0.82, 0.22);
    backFrame.rotation.x = -0.09;
    backFrame.castShadow = true;
    chair.add(backFrame);

    const headrest = new THREE.Mesh(new RoundedBoxGeometry(0.28, 0.12, 0.056, 3, 0.018), chairFabric);
    headrest.position.set(0, 1.15, 0.24);
    headrest.rotation.x = 0.08;
    headrest.castShadow = true;
    chair.add(headrest);

    for (const ax of [-0.27, 0.27]) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.21, 0.03), metalMat);
      post.position.set(ax, 0.57, 0.02);
      chair.add(post);
      const pad = new THREE.Mesh(new RoundedBoxGeometry(0.068, 0.028, 0.24, 2, 0.008), chairMeshMat);
      pad.position.set(ax, 0.68, 0.0);
      chair.add(pad);
    }

    this._addContactShadow(chair, 0, 0.017, 0, 0.72, 0.72, 0.42);
    chair.position.set(-0.56, 0, -0.08);
    chair.rotation.y = 0.34;
    this.scene.add(chair);
  }

  // ---------- 7. Omarchy Linux 34" Monitor ----------
  _buildOmarchyMonitor() {
    const sy = 0.771;
    const monGroup = new THREE.Group();
    monGroup.position.set(-0.56, sy, -1.16);

    const bezelMat = new THREE.MeshStandardMaterial({ color: 0x14171f, roughness: 0.3, metalness: 0.62 });
    const standMat = new THREE.MeshStandardMaterial({
      color: 0x242934,
      roughnessMap: this.brushedMetalTex,
      roughness: 0.28,
      metalness: 0.86,
    });

    const basePlate = new THREE.Mesh(new RoundedBoxGeometry(0.28, 0.012, 0.21, 2, 0.003), standMat);
    basePlate.position.set(0, 0.006, 0.01);
    basePlate.castShadow = true;
    monGroup.add(basePlate);
    this._addContactShadow(monGroup, 0, 0.001, 0.01, 0.36, 0.28, 0.36);

    const neck = new THREE.Mesh(new RoundedBoxGeometry(0.055, 0.36, 0.032, 2, 0.005), standMat);
    neck.position.set(0, 0.19, -0.05);
    neck.rotation.x = 0.08;
    neck.castShadow = true;
    monGroup.add(neck);

    const screenW = 0.82;
    const screenH = 0.492;
    const panelCenterY = 0.38;

    const body = new THREE.Mesh(
      new RoundedBoxGeometry(screenW + 0.024, screenH + 0.032, 0.028, 2, 0.005),
      bezelMat
    );
    body.position.set(0, panelCenterY, 0);
    body.castShadow = true;
    body.userData.camPreset = 'monitor';
    this.clickableMeshes.push(body);
    monGroup.add(body);

    const led = new THREE.Mesh(
      new THREE.BoxGeometry(0.018, 0.004, 0.004),
      new THREE.MeshBasicMaterial({ color: 0x73daca })
    );
    led.position.set(screenW / 2 - 0.05, panelCenterY - screenH / 2 - 0.008, 0.015);
    monGroup.add(led);

    // Anti-glare semi-gloss IPS panel showing live Omarchy Linux CanvasTexture
    const screenMat = new THREE.MeshStandardMaterial({
      map: this.omarchyScreen.texture,
      emissiveMap: this.omarchyScreen.texture,
      emissive: new THREE.Color(0xffffff),
      emissiveIntensity: 0.86,
      roughness: 0.16,
      metalness: 0.04,
    });
    const screenMesh = new THREE.Mesh(new THREE.PlaneGeometry(screenW, screenH), screenMat);
    screenMesh.position.set(0, panelCenterY + 0.003, 0.0155);
    screenMesh.userData.camPreset = 'monitor';
    this.clickableMeshes.push(screenMesh);
    monGroup.add(screenMesh);

    this.scene.add(monGroup);
  }

  // ---------- 8. Beefed-Up Corsair Tower with Perforated Airflow Mesh, Glass Side Panel & RTX 5090 ----------
  _buildCorsairRTX5090PC() {
    const sy = 0.771;
    const pc = new THREE.Group();
    pc.position.set(0.42, sy, -0.96);
    pc.rotation.y = -0.32;

    const W = 0.255;
    const H = 0.51;
    const D = 0.49;

    const caseMat = new THREE.MeshStandardMaterial({
      color: 0x181c23,
      roughnessMap: this.brushedMetalTex,
      roughness: 0.36,
      metalness: 0.74,
    });
    const darkSteel = new THREE.MeshStandardMaterial({ color: 0x11141a, roughness: 0.42, metalness: 0.76 });

    for (const fx of [-W / 2 + 0.032, W / 2 - 0.032]) {
      for (const fz of [-D / 2 + 0.045, D / 2 - 0.045]) {
        const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.018, 12), darkSteel);
        foot.position.set(fx, 0.009, fz);
        pc.add(foot);
      }
    }
    this._addContactShadow(pc, 0, 0.001, 0, W + 0.1, D + 0.1, 0.44);

    const baseY = 0.018;
    const addPanel = (pw, ph, pd, x, y, z, mat = caseMat) => {
      const m = new THREE.Mesh(new RoundedBoxGeometry(pw, ph, pd, 2, 0.003), mat);
      m.position.set(x, baseY + y, z);
      m.castShadow = true;
      m.receiveShadow = true;
      m.userData.camPreset = 'pc';
      this.clickableMeshes.push(m);
      pc.add(m);
      return m;
    };

    addPanel(W, 0.016, D, 0, 0.008, 0);
    addPanel(W, 0.018, D, 0, H - 0.009, 0);
    addPanel(0.014, H, D, W / 2 - 0.007, H / 2, 0);
    addPanel(W, H, 0.014, 0, H / 2, -D / 2 + 0.007);

    // Front Corsair Triangular-Perforated Airflow Grille (alpha-cutout metal panel!)
    addPanel(0.022, H, 0.022, -W / 2 + 0.011, H / 2, D / 2 - 0.011);
    addPanel(0.022, H, 0.022, W / 2 - 0.011, H / 2, D / 2 - 0.011);
    addPanel(W, 0.042, 0.022, 0, H - 0.021, D / 2 - 0.011);
    addPanel(W, 0.068, 0.022, 0, 0.034, D / 2 - 0.011);

    const airflowAlpha = createCorsairAirflowMeshAlpha();
    const frontMeshPanel = new THREE.Mesh(
      new THREE.PlaneGeometry(W - 0.044, H - 0.11),
      new THREE.MeshStandardMaterial({
        color: 0x1d222b,
        alphaMap: airflowAlpha,
        alphaTest: 0.45,
        roughness: 0.42,
        metalness: 0.72,
        side: THREE.DoubleSide,
      })
    );
    frontMeshPanel.position.set(0, baseY + 0.268, D / 2 - 0.004);
    pc.add(frontMeshPanel);

    // Corsair Front & PSU Shroud Brand Badge
    const corsairFrontTex = createLabelTexture({
      width: 512,
      height: 128,
      bg: '#151920',
      draw: (ctx) => {
        ctx.fillStyle = '#f5c542';
        ctx.beginPath();
        ctx.moveTo(96, 98);
        ctx.quadraticCurveTo(114, 52, 102, 24);
        ctx.quadraticCurveTo(132, 54, 122, 98);
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(126, 98);
        ctx.quadraticCurveTo(148, 46, 134, 18);
        ctx.quadraticCurveTo(168, 52, 152, 98);
        ctx.fill();
        ctx.fillStyle = '#eef4ff';
        ctx.font = 'bold 46px Inter, sans-serif';
        ctx.fillText('CORSAIR', 184, 78);
      },
    });
    const frontBadge = new THREE.Mesh(
      new THREE.PlaneGeometry(0.145, 0.036),
      new THREE.MeshStandardMaterial({ map: corsairFrontTex, roughness: 0.32 })
    );
    frontBadge.position.set(0, baseY + 0.036, D / 2 + 0.002);
    pc.add(frontBadge);

    addPanel(W - 0.03, 0.105, D - 0.04, 0.005, 0.066, -0.005, darkSteel);
    const psuBadge = new THREE.Mesh(
      new THREE.PlaneGeometry(0.17, 0.042),
      new THREE.MeshStandardMaterial({
        map: corsairFrontTex,
        emissiveMap: corsairFrontTex,
        emissive: 0xffffff,
        emissiveIntensity: 0.28,
        roughness: 0.3,
      })
    );
    psuBadge.rotation.y = -Math.PI / 2;
    psuBadge.position.set(-W / 2 + 0.017, baseY + 0.068, 0.04);
    pc.add(psuBadge);

    // ATX Motherboard + VRM Heatsinks
    const mbX = W / 2 - 0.034;
    const mobo = new THREE.Mesh(
      new THREE.BoxGeometry(0.012, 0.31, 0.26),
      new THREE.MeshStandardMaterial({ color: 0x13171f, roughness: 0.48, metalness: 0.38 })
    );
    mobo.position.set(mbX, baseY + 0.295, -0.065);
    pc.add(mobo);

    const vrmMat = new THREE.MeshStandardMaterial({
      color: 0x2d3544,
      roughnessMap: this.brushedMetalTex,
      roughness: 0.26,
      metalness: 0.88,
    });
    const vrmRear = new THREE.Mesh(new RoundedBoxGeometry(0.026, 0.12, 0.042, 2, 0.003), vrmMat);
    vrmRear.position.set(mbX - 0.015, baseY + 0.36, -0.165);
    pc.add(vrmRear);
    const vrmTop = new THREE.Mesh(new RoundedBoxGeometry(0.026, 0.032, 0.12, 2, 0.003), vrmMat);
    vrmTop.position.set(mbX - 0.015, baseY + 0.425, -0.085);
    pc.add(vrmTop);

    // 4× Corsair Vengeance RGB DDR5 RAM Sticks
    for (let i = 0; i < 4; i++) {
      const zPos = 0.002 + i * 0.013;
      const stick = new THREE.Mesh(new THREE.BoxGeometry(0.032, 0.115, 0.006), darkSteel);
      stick.position.set(mbX - 0.02, baseY + 0.34, zPos);
      pc.add(stick);

      const barMat = new THREE.MeshStandardMaterial({
        color: 0xffffff,
        emissive: new THREE.Color('#7dcfff'),
        emissiveIntensity: 2.2,
      });
      const rgbBar = new THREE.Mesh(new THREE.BoxGeometry(0.008, 0.112, 0.0065), barMat);
      rgbBar.position.set(mbX - 0.036, baseY + 0.34, zPos);
      this.ramBars.push({ mat: barMat, phase: i * 0.55 });
      pc.add(rgbBar);
    }

    // Corsair iCUE Liquid AIO CPU Pump Head with LCD Temp Readout + Braided Coolant Tubes
    const pumpBody = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.037, 0.046, 16), darkSteel);
    pumpBody.rotation.z = Math.PI / 2;
    pumpBody.position.set(mbX - 0.028, baseY + 0.34, -0.085);
    pc.add(pumpBody);

    const aioLcdTex = createLabelTexture({
      width: 256,
      height: 256,
      bg: '#0c111a',
      draw: (ctx) => {
        ctx.strokeStyle = '#73daca';
        ctx.lineWidth = 10;
        ctx.beginPath();
        ctx.arc(128, 128, 108, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 74px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('38°', 128, 144);
        ctx.fillStyle = '#7dcfff';
        ctx.font = 'bold 26px monospace';
        ctx.fillText('LIQUID', 128, 184);
      },
    });
    const aioFace = new THREE.Mesh(
      new THREE.CircleGeometry(0.029, 24),
      new THREE.MeshBasicMaterial({ map: aioLcdTex })
    );
    aioFace.rotation.y = -Math.PI / 2;
    aioFace.position.set(mbX - 0.052, baseY + 0.34, -0.085);
    pc.add(aioFace);

    const pumpRingMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      emissive: new THREE.Color('#73daca'),
      emissiveIntensity: 2.4,
    });
    const pumpRing = new THREE.Mesh(new THREE.TorusGeometry(0.031, 0.0038, 10, 28), pumpRingMat);
    pumpRing.rotation.y = Math.PI / 2;
    pumpRing.position.set(mbX - 0.051, baseY + 0.34, -0.085);
    this.rgbRings.push({ mat: pumpRingMat, phase: 0.4 });
    pc.add(pumpRing);

    const radiator = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.032, 0.35), darkSteel);
    radiator.position.set(0.01, baseY + H - 0.038, -0.01);
    pc.add(radiator);

    const tubeMat = new THREE.MeshStandardMaterial({ color: 0x161920, roughness: 0.72 });
    for (const tz of [-0.012, 0.012]) {
      const curve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(mbX - 0.04, baseY + 0.34, -0.06 + tz),
        new THREE.Vector3(mbX - 0.085, baseY + 0.37, 0.05 + tz),
        new THREE.Vector3(mbX - 0.06, baseY + 0.44, 0.11 + tz),
        new THREE.Vector3(0.01, baseY + H - 0.045, 0.14 + tz),
      ]);
      pc.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 16, 0.0068, 8, false), tubeMat));
    }

    const buildRgbFan = (radius = 0.054, phase = 0) => {
      const fg = new THREE.Group();
      fg.add(new THREE.Mesh(new THREE.BoxGeometry(radius * 2.08, radius * 2.08, 0.022), darkSteel));

      const ringMat = new THREE.MeshStandardMaterial({
        color: 0xffffff,
        emissive: new THREE.Color('#7dcfff'),
        emissiveIntensity: 2.2,
      });
      const ring = new THREE.Mesh(new THREE.TorusGeometry(radius * 0.9, 0.0055, 10, 28), ringMat);
      ring.position.z = 0.011;
      fg.add(ring);
      const ringBack = ring.clone();
      ringBack.position.z = -0.011;
      fg.add(ringBack);
      this.rgbRings.push({ mat: ringMat, phase });

      const rotor = new THREE.Group();
      const hub = new THREE.Mesh(new THREE.CylinderGeometry(radius * 0.25, radius * 0.25, 0.02, 14), caseMat);
      hub.rotation.x = Math.PI / 2;
      rotor.add(hub);
      const bladeMat = new THREE.MeshPhysicalMaterial({
        color: 0xd9ecff,
        transparent: true,
        opacity: 0.82,
        roughness: 0.2,
      });
      for (let b = 0; b < 7; b++) {
        const a = (b / 7) * Math.PI * 2;
        const blade = new THREE.Mesh(new THREE.BoxGeometry(radius * 0.62, radius * 0.22, 0.004), bladeMat);
        blade.position.set(Math.cos(a) * radius * 0.5, Math.sin(a) * radius * 0.5, 0);
        blade.rotation.z = a;
        blade.rotation.x = 0.42;
        rotor.add(blade);
      }
      fg.add(rotor);
      this.rgbFans.push({ rotor, speed: 9.5 + (phase % 3) });
      return fg;
    };

    [0.145, 0.268, 0.391].forEach((fy, idx) => {
      const f = buildRgbFan(0.056, idx * 0.9);
      f.position.set(0.005, baseY + fy, D / 2 - 0.036);
      pc.add(f);
    });
    [-0.08, 0.055].forEach((fz, idx) => {
      const f = buildRgbFan(0.056, 2.5 + idx * 0.8);
      f.rotation.x = Math.PI / 2;
      f.position.set(0.01, baseY + H - 0.064, fz);
      pc.add(f);
    });
    const rearFan = buildRgbFan(0.052, 4.1);
    rearFan.position.set(0.005, baseY + 0.365, -D / 2 + 0.03);
    pc.add(rearFan);

    // ---------- Flagship NVIDIA GeForce RTX 5090 GPU (Machined Titanium + Crisp RTX 5090 Labels) ----------
    const gpu = new THREE.Group();
    const gpuLen = 0.335;
    const gpuHeight = 0.068;
    const gpuWidth = 0.138;

    const gpuShroudMat = new THREE.MeshStandardMaterial({
      color: 0x20252f,
      roughnessMap: this.brushedMetalTex,
      roughness: 0.26,
      metalness: 0.88,
    });
    const gpuTrimMat = new THREE.MeshStandardMaterial({
      color: 0x9aa4b4,
      roughnessMap: this.brushedMetalTex,
      roughness: 0.2,
      metalness: 0.94,
    });
    const gpuFinMat = new THREE.MeshStandardMaterial({ color: 0x3b4250, roughness: 0.36, metalness: 0.86 });

    const gpuBody = new THREE.Mesh(
      new RoundedBoxGeometry(gpuWidth, gpuHeight, gpuLen, 2, 0.004),
      gpuShroudMat
    );
    gpuBody.castShadow = true;
    gpuBody.userData.camPreset = 'pc';
    this.clickableMeshes.push(gpuBody);
    gpu.add(gpuBody);

    const topTrim = new THREE.Mesh(new THREE.BoxGeometry(gpuWidth + 0.004, 0.007, gpuLen + 0.004), gpuTrimMat);
    topTrim.position.y = gpuHeight / 2;
    gpu.add(topTrim);
    const botTrim = new THREE.Mesh(new THREE.BoxGeometry(gpuWidth + 0.004, 0.007, gpuLen + 0.004), gpuTrimMat);
    botTrim.position.y = -gpuHeight / 2;
    gpu.add(botTrim);

    for (let f = 0; f < 14; f++) {
      const fin = new THREE.Mesh(new THREE.BoxGeometry(0.008, gpuHeight * 0.72, 0.004), gpuFinMat);
      fin.position.set(-gpuWidth / 2 - 0.001, 0, -gpuLen / 2 + 0.025 + f * 0.009);
      gpu.add(fin);
    }

    // Illuminated Side Nameplate facing directly through tempered glass: "GEFORCE RTX 5090"
    const gpuSideTex = createLabelTexture({
      width: 1024,
      height: 220,
      bg: '#151920',
      border: '#667387',
      draw: (ctx, cw, ch) => {
        const g = ctx.createLinearGradient(0, 0, cw, 0);
        g.addColorStop(0, '#171b23');
        g.addColorStop(0.5, '#272e3a');
        g.addColorStop(1, '#151921');
        ctx.fillStyle = g;
        ctx.fillRect(4, 4, cw - 8, ch - 8);

        ctx.fillStyle = '#76b900';
        ctx.fillRect(28, 34, 16, ch - 68);

        ctx.fillStyle = '#b4c2d8';
        ctx.font = '600 42px Inter, sans-serif';
        ctx.fillText('GEFORCE', 68, 92);

        ctx.fillStyle = '#ffffff';
        ctx.font = '900 106px Inter, sans-serif';
        ctx.fillText('RTX 5090', 64, 184);

        ctx.fillStyle = 'rgba(118, 185, 0, 0.22)';
        ctx.fillRect(cw - 260, 74, 224, 72);
        ctx.strokeStyle = '#76b900';
        ctx.lineWidth = 3;
        ctx.strokeRect(cw - 260, 74, 224, 72);
        ctx.fillStyle = '#bdf748';
        ctx.font = 'bold 34px monospace';
        ctx.fillText('32GB GDDR7', cw - 242, 122);
      },
    });
    const gpuSideLabel = new THREE.Mesh(
      new THREE.PlaneGeometry(gpuLen * 0.9, gpuHeight * 0.84),
      new THREE.MeshStandardMaterial({
        map: gpuSideTex,
        emissiveMap: gpuSideTex,
        emissive: new THREE.Color('#eef7ff'),
        emissiveIntensity: 0.95,
        roughness: 0.22,
      })
    );
    gpuSideLabel.rotation.y = -Math.PI / 2;
    gpuSideLabel.position.set(-gpuWidth / 2 - 0.0025, 0, 0);
    gpuSideLabel.userData.camPreset = 'pc';
    this.clickableMeshes.push(gpuSideLabel);
    gpu.add(gpuSideLabel);

    // Top Backplate brushed-titanium silkscreen: "RTX 5090" (correctly oriented left-to-right!)
    const gpuTopTex = createLabelTexture({
      width: 1024,
      height: 440,
      bg: '#1c212b',
      border: '#505a6e',
      draw: (ctx, cw, ch) => {
        ctx.fillStyle = '#0d1016';
        for (let i = 0; i < 9; i++) {
          ctx.fillRect(660 + i * 32, 46, 18, ch - 92);
        }
        ctx.fillStyle = '#76b900';
        ctx.fillRect(46, 52, 16, ch - 104);
        ctx.fillStyle = '#e6eefb';
        ctx.font = '900 124px Inter, sans-serif';
        ctx.fillText('RTX 5090', 86, 250);
        ctx.fillStyle = '#9aa9c4';
        ctx.font = '600 40px monospace';
        ctx.fillText('NVIDIA BLACKWELL', 90, 326);
      },
    });
    const gpuTopPlate = new THREE.Mesh(
      new THREE.PlaneGeometry(gpuLen * 0.94, gpuWidth * 0.9),
      new THREE.MeshStandardMaterial({
        map: gpuTopTex,
        emissiveMap: gpuTopTex,
        emissive: 0xffffff,
        emissiveIntensity: 0.36,
        roughness: 0.26,
        metalness: 0.58,
      })
    );
    gpuTopPlate.rotation.x = -Math.PI / 2;
    gpuTopPlate.rotation.z = -Math.PI / 2;
    gpuTopPlate.position.set(0, gpuHeight / 2 + 0.0045, 0);
    gpu.add(gpuTopPlate);

    // Braided 12VHPWR power cable
    const pwrCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-gpuWidth / 2 + 0.01, -0.004, 0.055),
      new THREE.Vector3(-gpuWidth / 2 - 0.025, -0.02, 0.068),
      new THREE.Vector3(-gpuWidth / 2 - 0.015, -0.085, 0.072),
      new THREE.Vector3(0.01, -0.115, 0.072),
    ]);
    gpu.add(
      new THREE.Mesh(
        new THREE.TubeGeometry(pwrCurve, 12, 0.008, 8, false),
        new THREE.MeshStandardMaterial({ color: 0x1e242e, roughness: 0.78 })
      )
    );

    gpu.position.set(mbX - gpuWidth / 2 - 0.014, baseY + 0.215, -0.028);
    pc.add(gpu);

    // Physical Reflective Tempered Glass Side Panel + 4 Knurled Thumbscrews
    const glassMat = new THREE.MeshPhysicalMaterial({
      color: 0xdff0ff,
      transparent: true,
      opacity: 0.13,
      roughness: 0.04,
      metalness: 0.06,
      reflectivity: 0.95,
      clearcoat: 1.0,
      clearcoatRoughness: 0.04,
      depthWrite: false,
    });
    const glassPanel = new THREE.Mesh(new THREE.BoxGeometry(0.005, H - 0.032, D - 0.036), glassMat);
    glassPanel.position.set(-W / 2 + 0.003, baseY + H / 2, 0);
    glassPanel.userData.camPreset = 'pc';
    this.clickableMeshes.push(glassPanel);
    pc.add(glassPanel);

    const screwMat = new THREE.MeshStandardMaterial({ color: 0xa4aebf, roughness: 0.22, metalness: 0.92 });
    for (const syPos of [0.045, H - 0.045]) {
      for (const szPos of [-D / 2 + 0.04, D / 2 - 0.04]) {
        const screw = new THREE.Mesh(new THREE.CylinderGeometry(0.007, 0.007, 0.012, 12), screwMat);
        screw.rotation.z = Math.PI / 2;
        screw.position.set(-W / 2 - 0.002, baseY + syPos, szPos);
        pc.add(screw);
      }
    }

    this.scene.add(pc);
  }

  // ---------- 9. 8× DGX Spark Stack + MikroTik CRS804 Switch + Network Patch Cables ----------
  _buildDGXSparkClusterAndCRS804() {
    const clusterGroup = new THREE.Group();
    clusterGroup.position.set(2.68, 0, -0.32);

    const credW = 0.62;
    const credH = 0.66;
    const credD = 1.48;
    const credPBR = createWoodPBR({
      base: '#68442b',
      grain: '#3b2314',
      plankLines: false,
      seed: 211,
      repeatX: 1,
      repeatY: 2,
      roughBase: 92,
    });
    const credWoodMat = new THREE.MeshPhysicalMaterial({
      map: credPBR.map,
      roughnessMap: credPBR.roughnessMap,
      bumpMap: credPBR.bumpMap,
      bumpScale: 0.007,
      roughness: 0.54,
      clearcoat: 0.3,
      clearcoatRoughness: 0.3,
    });
    const frameMat = new THREE.MeshStandardMaterial({
      color: 0x191d25,
      roughnessMap: this.brushedMetalTex,
      roughness: 0.38,
      metalness: 0.82,
    });

    const credTop = new THREE.Mesh(new RoundedBoxGeometry(credW, 0.036, credD, 2, 0.005), credWoodMat);
    credTop.position.set(0, credH, 0);
    credTop.castShadow = true;
    credTop.receiveShadow = true;
    clusterGroup.add(credTop);

    const credBody = new THREE.Mesh(new THREE.BoxGeometry(credW - 0.06, 0.42, credD - 0.08), frameMat);
    credBody.position.set(0, credH - 0.23, 0);
    credBody.castShadow = true;
    credBody.receiveShadow = true;
    clusterGroup.add(credBody);

    for (let i = 0; i < 3; i++) {
      const door = new THREE.Mesh(new RoundedBoxGeometry(0.018, 0.36, 0.42, 2, 0.003), credWoodMat);
      door.position.set(-credW / 2 + 0.025, credH - 0.23, -0.44 + i * 0.44);
      clusterGroup.add(door);
    }

    for (const lx of [-credW / 2 + 0.06, credW / 2 - 0.06]) {
      for (const lz of [-credD / 2 + 0.08, credD / 2 - 0.08]) {
        const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.014, 0.22, 10), frameMat);
        leg.position.set(lx, 0.11, lz);
        leg.castShadow = true;
        clusterGroup.add(leg);
      }
    }
    this._addContactShadow(clusterGroup, 0, 0.003, 0, credW + 0.22, credD + 0.22, 0.46);

    const topSurfY = credH + 0.018;

    // Stack of 8 Precision-Machined Matte-Black DGX Spark Units
    const sparkW = 0.24;
    const sparkH = 0.056;
    const sparkD = 0.24;
    const sparkGap = 0.008;
    const stackZ = -0.26;
    const stackX = -0.02;

    const sparkCaseMat = new THREE.MeshStandardMaterial({
      color: 0x12151b,
      roughnessMap: this.brushedMetalTex,
      roughness: 0.34,
      metalness: 0.78,
    });
    const sparkGoldTrim = new THREE.MeshStandardMaterial({
      color: 0xc9a86b,
      roughnessMap: this.brushedMetalTex,
      roughness: 0.28,
      metalness: 0.88,
    });

    this._addContactShadow(clusterGroup, stackX, topSurfY + 0.001, stackZ, sparkW + 0.08, sparkD + 0.08, 0.45);
    const sparkPortPositions = [];

    for (let i = 0; i < 8; i++) {
      const nodeNum = String(i + 1).padStart(2, '0');
      const unitY = topSurfY + sparkGap + i * (sparkH + sparkGap) + sparkH / 2;
      const unit = new THREE.Group();

      const chassis = new THREE.Mesh(
        new RoundedBoxGeometry(sparkW, sparkH, sparkD, 2, 0.004),
        sparkCaseMat
      );
      chassis.castShadow = true;
      chassis.receiveShadow = true;
      chassis.userData.camPreset = 'cluster';
      this.clickableMeshes.push(chassis);
      unit.add(chassis);

      for (const fx of [-0.085, 0.085]) {
        for (const fz of [-0.085, 0.085]) {
          const ft = new THREE.Mesh(
            new THREE.CylinderGeometry(0.01, 0.01, sparkGap, 8),
            new THREE.MeshStandardMaterial({ color: 0x090b0e, roughness: 0.9 })
          );
          ft.position.set(fx, -sparkH / 2 - sparkGap / 2, fz);
          unit.add(ft);
        }
      }

      const trimTop = new THREE.Mesh(new THREE.BoxGeometry(sparkW + 0.002, 0.003, sparkD + 0.002), sparkGoldTrim);
      trimTop.position.y = sparkH / 2 - 0.002;
      unit.add(trimTop);

      const faceTex = createLabelTexture({
        width: 384,
        height: 96,
        bg: '#101318',
        border: '#7a6542',
        draw: (ctx, cw, ch) => {
          ctx.strokeStyle = 'rgba(201, 168, 107, 0.4)';
          ctx.lineWidth = 1.6;
          for (let gx = 12; gx < 162; gx += 14) {
            ctx.beginPath();
            ctx.moveTo(gx, 10);
            ctx.lineTo(gx + 10, ch / 2);
            ctx.lineTo(gx, ch - 10);
            ctx.stroke();
          }
          ctx.fillStyle = '#efe5d0';
          ctx.font = 'bold 26px Inter, sans-serif';
          ctx.fillText('DGX SPARK', 176, 46);
          ctx.fillStyle = '#76b900';
          ctx.font = 'bold 18px monospace';
          ctx.fillText(`NODE ${nodeNum}  ·  100GbE`, 178, 76);
        },
      });
      const facePlate = new THREE.Mesh(
        new THREE.PlaneGeometry(sparkD * 0.94, sparkH * 0.84),
        new THREE.MeshStandardMaterial({
          map: faceTex,
          emissiveMap: faceTex,
          emissive: 0xffffff,
          emissiveIntensity: 0.28,
          roughness: 0.3,
          metalness: 0.48,
        })
      );
      facePlate.rotation.y = -Math.PI / 2;
      facePlate.position.set(-sparkW / 2 - 0.0018, 0, 0);
      facePlate.userData.camPreset = 'cluster';
      this.clickableMeshes.push(facePlate);
      unit.add(facePlate);

      const ledMat = new THREE.MeshStandardMaterial({
        color: 0x76b900,
        emissive: 0x76b900,
        emissiveIntensity: 2.6,
      });
      const led = new THREE.Mesh(new THREE.BoxGeometry(0.004, 0.008, 0.008), ledMat);
      led.position.set(-sparkW / 2 - 0.002, 0.01, sparkD / 2 - 0.02);
      this.sparkLeds.push({ mat: ledMat, phase: i * 0.72 });
      unit.add(led);

      const portCollar = new THREE.Mesh(
        new THREE.BoxGeometry(0.024, 0.016, 0.014),
        new THREE.MeshStandardMaterial({ color: 0x8a95a8, roughness: 0.28, metalness: 0.88 })
      );
      const portLocalX = -0.065 + (i % 2) * 0.032;
      portCollar.position.set(portLocalX, 0, sparkD / 2 + 0.005);
      unit.add(portCollar);

      unit.position.set(stackX, unitY, stackZ);
      clusterGroup.add(unit);
      sparkPortPositions.push(new THREE.Vector3(stackX + portLocalX, unitY, stackZ + sparkD / 2 + 0.012));
    }

    // MikroTik CRS804 Switch beside the 8× DGX Spark stack
    const swW = 0.22;
    const swH = 0.052;
    const swD = 0.34;
    const swX = -0.02;
    const swZ = 0.34;
    const swY = topSurfY + swH / 2 + 0.004;

    const switchGroup = new THREE.Group();
    const swChassisMat = new THREE.MeshStandardMaterial({
      color: 0x242a35,
      roughnessMap: this.brushedMetalTex,
      roughness: 0.3,
      metalness: 0.82,
    });
    const swSilverMat = new THREE.MeshStandardMaterial({
      color: 0xc8d2de,
      roughness: 0.24,
      metalness: 0.88,
    });

    const swBody = new THREE.Mesh(new RoundedBoxGeometry(swW, swH, swD, 2, 0.004), swChassisMat);
    swBody.castShadow = true;
    swBody.receiveShadow = true;
    swBody.userData.camPreset = 'cluster';
    this.clickableMeshes.push(swBody);
    switchGroup.add(swBody);

    const swTopTex = createLabelTexture({
      width: 512,
      height: 320,
      bg: '#232934',
      border: '#66748a',
      draw: (ctx) => {
        ctx.fillStyle = '#e2ecfa';
        ctx.font = 'bold 48px Inter, sans-serif';
        ctx.fillText('MikroTik', 38, 128);
        ctx.fillStyle = '#7dcfff';
        ctx.font = 'bold 62px monospace';
        ctx.fillText('CRS804', 38, 206);
        ctx.fillStyle = '#9aa9c4';
        ctx.font = '600 26px monospace';
        ctx.fillText('400G / QSFP-DD SWITCH', 38, 260);
      },
    });
    const swTopLabel = new THREE.Mesh(
      new THREE.PlaneGeometry(swD * 0.92, swW * 0.88),
      new THREE.MeshStandardMaterial({
        map: swTopTex,
        emissiveMap: swTopTex,
        emissive: 0xffffff,
        emissiveIntensity: 0.26,
        roughness: 0.28,
      })
    );
    swTopLabel.rotation.x = -Math.PI / 2;
    swTopLabel.rotation.z = -Math.PI / 2;
    swTopLabel.position.y = swH / 2 + 0.0015;
    switchGroup.add(swTopLabel);

    const swFrontTex = createLabelTexture({
      width: 640,
      height: 112,
      bg: '#1c222c',
      border: '#95a4ba',
      draw: (ctx) => {
        ctx.fillStyle = '#edf4ff';
        ctx.font = 'bold 30px Inter, sans-serif';
        ctx.fillText('MikroTik', 20, 46);
        ctx.fillStyle = '#7dcfff';
        ctx.font = 'bold 34px monospace';
        ctx.fillText('CRS804', 20, 88);
        ctx.font = 'bold 18px monospace';
        for (let p = 0; p < 4; p++) {
          const px = 215 + p * 98;
          ctx.fillStyle = '#0d1118';
          ctx.fillRect(px, 28, 76, 48);
          ctx.strokeStyle = '#7c8ca3';
          ctx.lineWidth = 2;
          ctx.strokeRect(px, 28, 76, 48);
          ctx.fillStyle = '#a8bddb';
          ctx.fillText(`QSFP${p + 1}`, px + 10, 96);
        }
      },
    });
    const swFront = new THREE.Mesh(
      new THREE.PlaneGeometry(swD * 0.96, swH * 0.88),
      new THREE.MeshStandardMaterial({
        map: swFrontTex,
        emissiveMap: swFrontTex,
        emissive: 0xffffff,
        emissiveIntensity: 0.34,
        roughness: 0.26,
      })
    );
    swFront.rotation.y = -Math.PI / 2;
    swFront.position.set(-swW / 2 - 0.0015, 0, 0);
    swFront.userData.camPreset = 'cluster';
    this.clickableMeshes.push(swFront);
    switchGroup.add(swFront);

    for (let l = 0; l < 8; l++) {
      const isAmber = l % 3 === 0;
      const ledMat = new THREE.MeshStandardMaterial({
        color: isAmber ? 0xffb74d : 0x33ff88,
        emissive: isAmber ? 0xffb74d : 0x33ff88,
        emissiveIntensity: 2.8,
      });
      const led = new THREE.Mesh(new THREE.BoxGeometry(0.004, 0.006, 0.006), ledMat);
      led.position.set(-swW / 2 - 0.0025, 0.014, -0.055 + l * 0.028);
      this.switchLeds.push({ mat: ledMat, phase: l * 1.13, rate: 5 + (l % 4) * 2.5 });
      switchGroup.add(led);
    }

    const switchPortPositions = [];
    for (let i = 0; i < 8; i++) {
      const col = i % 4;
      const row = Math.floor(i / 4);
      const px = -0.072 + col * 0.044;
      const py = row === 0 ? -0.008 : 0.01;
      const cage = new THREE.Mesh(new THREE.BoxGeometry(0.022, 0.013, 0.014), swSilverMat);
      cage.position.set(px, py, -swD / 2 - 0.004);
      switchGroup.add(cage);
      switchPortPositions.push(new THREE.Vector3(swX + px, swY + py, swZ - swD / 2 - 0.012));
    }

    switchGroup.position.set(swX, swY, swZ);
    clusterGroup.add(switchGroup);
    this._addContactShadow(clusterGroup, swX, topSurfY + 0.001, swZ, swW + 0.08, swD + 0.08, 0.42);

    // 8 Curved High-Speed Network Patch Cables connecting MikroTik CRS804 to all 8 DGX Spark boxes
    const cableColors = [0x2ec4b6, 0x3a86ff, 0x2ec4b6, 0x3a86ff, 0x2ec4b6, 0x3a86ff, 0x2ec4b6, 0x3a86ff];
    const bootMat = new THREE.MeshStandardMaterial({ color: 0x161a22, roughness: 0.55 });

    for (let i = 0; i < 8; i++) {
      const pStart = switchPortPositions[i];
      const pEnd = sparkPortPositions[i];
      const arcOutX = -0.055 - (i % 4) * 0.014;
      const midZ = (pStart.z + pEnd.z) * 0.5;

      const curve = new THREE.CatmullRomCurve3([
        pStart,
        new THREE.Vector3(pStart.x + arcOutX * 0.35, pStart.y + 0.015, pStart.z - 0.065),
        new THREE.Vector3(
          (pStart.x + pEnd.x) * 0.5 + arcOutX,
          Math.min(pStart.y + 0.04 + i * 0.036, pEnd.y - 0.015),
          midZ
        ),
        new THREE.Vector3(pEnd.x + arcOutX * 0.4, pEnd.y, pEnd.z + 0.06),
        pEnd,
      ]);

      const cableMesh = new THREE.Mesh(
        new THREE.TubeGeometry(curve, 22, 0.0046, 8, false),
        new THREE.MeshStandardMaterial({ color: cableColors[i], roughness: 0.4, metalness: 0.22 })
      );
      cableMesh.castShadow = true;
      clusterGroup.add(cableMesh);

      const b1 = new THREE.Mesh(new THREE.CylinderGeometry(0.0062, 0.0062, 0.022, 8), bootMat);
      b1.rotation.x = Math.PI / 2;
      b1.position.copy(pStart).add(new THREE.Vector3(0, 0, -0.008));
      clusterGroup.add(b1);

      const b2 = new THREE.Mesh(new THREE.CylinderGeometry(0.0062, 0.0062, 0.022, 8), bootMat);
      b2.rotation.x = Math.PI / 2;
      b2.position.copy(pEnd).add(new THREE.Vector3(0, 0, 0.008));
      clusterGroup.add(b2);
    }

    const uplinkCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(swX + 0.04, swY, swZ + swD / 2),
      new THREE.Vector3(swX + 0.12, swY, swZ + swD / 2 + 0.07),
      new THREE.Vector3(0.22, topSurfY - 0.02, swZ + swD / 2 + 0.09),
      new THREE.Vector3(0.24, 0.08, swZ + swD / 2 + 0.09),
    ]);
    clusterGroup.add(
      new THREE.Mesh(
        new THREE.TubeGeometry(uplinkCurve, 16, 0.0052, 8, false),
        new THREE.MeshStandardMaterial({ color: 0xf4b942, roughness: 0.35 })
      )
    );

    this.scene.add(clusterGroup);
  }

  // ---------- 10. Soft Volumetric Sunbeams & Drifting Dust Motes ----------
  _buildSunbeamsAndDust() {
    const beamC = document.createElement('canvas');
    beamC.width = 64;
    beamC.height = 256;
    const bctx = beamC.getContext('2d');
    const g = bctx.createLinearGradient(0, 0, 0, 256);
    g.addColorStop(0, 'rgba(255, 224, 178, 0.0)');
    g.addColorStop(0.18, 'rgba(255, 224, 178, 0.72)');
    g.addColorStop(0.75, 'rgba(255, 224, 178, 0.18)');
    g.addColorStop(1, 'rgba(255, 224, 178, 0.0)');
    bctx.fillStyle = g;
    bctx.fillRect(0, 0, 64, 256);

    // Feather horizontal edges so beam never looks like a hard card
    bctx.globalCompositeOperation = 'destination-in';
    const hg = bctx.createLinearGradient(0, 0, 64, 0);
    hg.addColorStop(0, 'rgba(0,0,0,0)');
    hg.addColorStop(0.3, 'rgba(0,0,0,1)');
    hg.addColorStop(0.7, 'rgba(0,0,0,1)');
    hg.addColorStop(1, 'rgba(0,0,0,0)');
    bctx.fillStyle = hg;
    bctx.fillRect(0, 0, 64, 256);

    const beamTex = new THREE.CanvasTexture(beamC);
    this.beamMat = new THREE.MeshBasicMaterial({
      map: beamTex,
      color: 0xffd79c,
      transparent: true,
      opacity: 0.068,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    });

    for (const bx of [-1.7, -0.15, 1.4]) {
      const beam = new THREE.Mesh(new THREE.PlaneGeometry(1.35, 3.8), this.beamMat);
      beam.position.set(bx + 0.32, 1.48, -1.35);
      beam.rotation.x = -0.68;
      beam.rotation.y = 0.22;
      this.sunBeams.push(beam);
      this.scene.add(beam);
    }

    const count = 80;
    const positions = new Float32Array(count * 3);
    const rng = mulberry32(707);
    for (let i = 0; i < count; i++) {
      positions[i * 3] = (rng() - 0.5) * 4.8;
      positions[i * 3 + 1] = 0.55 + rng() * 2.05;
      positions[i * 3 + 2] = -2.3 + rng() * 2.6;
    }
    const dustGeo = new THREE.BufferGeometry();
    dustGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    this.dustPoints = new THREE.Points(
      dustGeo,
      new THREE.PointsMaterial({
        color: 0xffe6bd,
        size: 0.015,
        transparent: true,
        opacity: 0.34,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    );
    this.scene.add(this.dustPoints);
  }

  // ---------- Sky Mood Switching (Updates Sky, Clouds, Haze, Water, Area Lights & HDR IBL!) ----------
  applySkyMood(index) {
    this.moodIndex = ((index % SKY_MOODS.length) + SKY_MOODS.length) % SKY_MOODS.length;
    const m = SKY_MOODS[this.moodIndex];

    this.skyUniforms.uZenith.value.copy(m.zenith);
    this.skyUniforms.uMid.value.copy(m.mid);
    this.skyUniforms.uHorizon.value.copy(m.horizon);
    this.skyUniforms.uSunColor.value.copy(m.sunColor);
    this.skyUniforms.uSunGlow.value.copy(m.sunGlow);
    this.skyUniforms.uCloudLight.value.copy(m.cloudLight);
    this.skyUniforms.uCloudShadow.value.copy(m.cloudShadow);
    this.skyUniforms.uSunDir.value.copy(m.sunDir);

    this.waterUniforms.uSunDir.value.copy(m.sunDir);
    this.waterUniforms.uSunColor.value.copy(m.sunColor);
    this.waterUniforms.uSkyColor.value.copy(m.horizon);

    this.hazeUniforms.uHazeColor.value.copy(m.haze);
    this.hazeUniforms.uSunDir.value.copy(m.sunDir);
    this.hazeUniforms.uSunGlow.value.copy(m.sunGlow);

    this.sunLight.color.setHex(m.dirLightColor);
    this.sunLight.intensity = m.dirLightIntensity;
    this.sunLight.position.copy(m.sunDir).multiplyScalar(14);

    this.windowPortalLight.color.setHex(m.portalColor);
    this.windowPortalLight.intensity = m.portalIntensity;
    this.pendantAreaLight.intensity = m.pendantIntensity;

    this.hemiLight.color.setHex(m.hemiSky);
    this.hemiLight.groundColor.setHex(m.hemiGround);
    this.hemiLight.intensity = m.hemiIntensity;
    this.deskLampLight.intensity = m.lampIntensity;
    this.renderer.toneMappingExposure = m.exposure;

    for (const mat of this.buildingWindowMaterials) {
      mat.emissiveIntensity = m.windowLitBoost;
    }
    if (this.beamMat) {
      this.beamMat.color.setHex(m.dirLightColor);
      this.beamMat.opacity = m.beamOpacity;
    }

    this._updateEnvironmentMap(m);
    return m;
  }

  nextSkyMood() {
    return this.applySkyMood(this.moodIndex + 1);
  }

  goToPreset(name, duration = 0.85) {
    const p = CAMERA_PRESETS[name];
    if (!p) return;
    this.animatingCam = {
      startTime: this.clock.getElapsedTime(),
      duration,
      fromPos: this.camera.position.clone(),
      toPos: new THREE.Vector3(...p.pos),
      fromTarget: this.controls.target.clone(),
      toTarget: new THREE.Vector3(...p.target),
    };
  }

  _bindPointerPick() {
    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    let downX = 0;
    let downY = 0;

    this.canvas.addEventListener('pointerdown', (e) => {
      downX = e.clientX;
      downY = e.clientY;
      if (this.animatingCam) this.animatingCam = null;
    });

    this.canvas.addEventListener('pointerup', (e) => {
      if (Math.hypot(e.clientX - downX, e.clientY - downY) > 6) return;
      const rect = this.canvas.getBoundingClientRect();
      pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.setFromCamera(pointer, this.camera);
      const hits = raycaster.intersectObjects(this.clickableMeshes, false);
      if (hits.length > 0) {
        const preset = hits[0].object.userData.camPreset;
        if (preset) {
          this.goToPreset(preset);
          if (this.onInteractPreset) this.onInteractPreset(preset);
        }
      }
    });
  }

  resize() {
    const parent = this.canvas.parentElement;
    const w = Math.max(1, parent ? parent.clientWidth : window.innerWidth);
    const h = Math.max(1, parent ? parent.clientHeight : window.innerHeight);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h, false);
    if (this.composer) {
      this.composer.setSize(w, h);
    }
  }

  start() {
    const tmpColor = new THREE.Color();
    const loop = () => {
      requestAnimationFrame(loop);
      const dt = Math.min(this.clock.getDelta(), 0.05);
      const elapsed = this.clock.getElapsedTime();

      this.skyUniforms.uTime.value = elapsed;
      this.waterUniforms.uTime.value = elapsed;

      if (this.animatingCam) {
        const a = this.animatingCam;
        const t = Math.min(1, (elapsed - a.startTime) / a.duration);
        const ease = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
        this.camera.position.lerpVectors(a.fromPos, a.toPos, ease);
        this.controls.target.lerpVectors(a.fromTarget, a.toTarget, ease);
        if (t >= 1) this.animatingCam = null;
      }

      this.camera.position.x = THREE.MathUtils.clamp(this.camera.position.x, -2.95, 2.95);
      this.camera.position.y = THREE.MathUtils.clamp(this.camera.position.y, 0.35, 2.88);
      this.camera.position.z = THREE.MathUtils.clamp(this.camera.position.z, -2.35, 2.65);

      this.controls.update();

      for (const f of this.rgbFans) {
        f.rotor.rotation.z -= dt * f.speed;
      }
      for (const r of this.rgbRings) {
        const hue = (0.5 + 0.14 * Math.sin(elapsed * 0.75 + r.phase) + 0.06 * Math.cos(elapsed * 0.35)) % 1;
        tmpColor.setHSL(hue < 0 ? hue + 1 : hue, 0.85, 0.62);
        r.mat.emissive.copy(tmpColor);
      }
      for (const rb of this.ramBars) {
        const hue = (0.55 + 0.18 * Math.sin(elapsed * 1.1 + rb.phase)) % 1;
        tmpColor.setHSL(hue < 0 ? hue + 1 : hue, 0.88, 0.65);
        rb.mat.emissive.copy(tmpColor);
      }
      if (this.pcRgbLight) {
        this.pcRgbLight.color.setHSL(0.52 + 0.12 * Math.sin(elapsed * 0.7), 0.8, 0.62);
      }
      for (const s of this.sparkLeds) {
        s.mat.emissiveIntensity = 1.5 + 1.2 * Math.sin(elapsed * 2.4 + s.phase);
      }
      for (const l of this.switchLeds) {
        l.mat.emissiveIntensity = Math.sin(elapsed * l.rate + l.phase) > -0.15 ? 2.8 : 0.25;
      }
      if (this.dustPoints) {
        this.dustPoints.position.y = Math.sin(elapsed * 0.35) * 0.04;
      }

      this.omarchyScreen.tick(elapsed);

      if (this.composer) {
        this.composer.render();
      } else {
        this.renderer.render(this.scene, this.camera);
      }
    };
    loop();
  }
}
