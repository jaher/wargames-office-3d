import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RectAreaLightUniformsLib } from 'three/addons/lights/RectAreaLightUniformsLib.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { BlueAngelsShow } from './blueAngelsShow.js';
import { BlueAngelsAudio } from './blueAngelsAudio.js';
import { versionedUrl } from './assetUrl.js';

// Camera presets matching index.html [data-cam] buttons.
export const CAMERA_PRESETS = {
  overview: {
    pos: [-0.14, 1.40, 2.52],
    target: [-0.14, 1.02, -0.96],
  },
  monitor: {
    pos: [-0.62, 1.07, -0.10],
    target: [-0.62, 1.01, -1.14],
  },
  pc: {
    pos: [0.53, 1.35, -0.08],
    target: [0.85, 1.04, -0.96],
  },
  cluster: {
    pos: [0.44, 1.49, 0.04],
    target: [0.16, 0.94, -1.04],
  },
  window: {
    pos: [-0.15, 1.54, 1.48],
    target: [-0.15, 1.58, -2.68],
  },
  door: {
    pos: [-0.25, 1.32, 0.86],
    target: [3.18, 1.12, 1.56],
  },
  gpu: {
    pos: [0.58, 1.27, -0.57],
    target: [0.85, 1.04, -0.98],
  },
  cables_rear: {
    pos: [0.68, 1.15, -2.18],
    target: [0.46, 0.72, -1.16],
  },
};

// Note: BMP-safe Unicode icons (☀ / ☾ / ☼) ensure zero missing-glyph tofu boxes across all OS/browsers.
// 100% live Three.js physically-based lighting (NO baked Blender lightmaps!) + photographic window panoramas.
const SKY_MOODS = [
  {
    id: 'golden',
    label: '☀ Golden Hour',
    skylineUrl: 'assets/textures/skyline_golden.jpg',
    skylineTint: 0xffffff,
    zenith: new THREE.Color('#2a4572'),
    mid: new THREE.Color('#8e7a8a'),
    horizon: new THREE.Color('#f4a96c'),
    haze: new THREE.Color('#8c6f70'),
    sunColor: new THREE.Color('#ffeed2'),
    sunGlow: new THREE.Color('#f78c42'),
    cloudLight: new THREE.Color('#ffd6ad'),
    cloudShadow: new THREE.Color('#3c4460'),
    sunDir: new THREE.Vector3(-0.34, 0.14, -0.93).normalize(),
    dirLightColor: 0xffcb8c,
    dirLightIntensity: 2.25,
    portalColor: 0xffd7a8,
    portalIntensity: 0.48,
    hemiSky: 0xffe2be,
    hemiGround: 0x3a2618,
    hemiIntensity: 0.58,
    lampIntensity: 14.5,
    lampBounce: 1.05,
    pendantIntensity: 0.56,
    bounceIntensity: 0.80,
    beamOpacity: 0.036,
    exposure: 1.04,
    envIntensity: 0.82,
  },
  {
    id: 'twilight',
    label: '☾ Twilight City',
    skylineUrl: 'assets/textures/skyline_twilight.jpg',
    skylineTint: 0xf4f6ff,
    zenith: new THREE.Color('#070d1f'),
    mid: new THREE.Color('#162444'),
    horizon: new THREE.Color('#a45a4a'),
    haze: new THREE.Color('#1e2438'),
    sunColor: new THREE.Color('#ffb272'),
    sunGlow: new THREE.Color('#c8523e'),
    cloudLight: new THREE.Color('#b66e5e'),
    cloudShadow: new THREE.Color('#10162b'),
    sunDir: new THREE.Vector3(0.24, 0.34, -0.92).normalize(),
    dirLightColor: 0xffa870,
    dirLightIntensity: 0.22,
    portalColor: 0x9ab4dc,
    portalIntensity: 0.42,
    hemiSky: 0x96aad0,
    hemiGround: 0x644024,
    hemiIntensity: 0.72,
    lampIntensity: 15.2,
    lampBounce: 1.80,
    pendantIntensity: 0.68,
    bounceIntensity: 1.42,
    beamOpacity: 0.014,
    exposure: 1.06,
    envIntensity: 0.72,
  },
  {
    id: 'day',
    label: '☼ Morning Light',
    skylineUrl: 'assets/textures/skyline_morning.jpg',
    skylineTint: 0xffffff,
    zenith: new THREE.Color('#3b7ec9'),
    mid: new THREE.Color('#8ec2ee'),
    horizon: new THREE.Color('#e6f2ff'),
    haze: new THREE.Color('#b8d2ea'),
    sunColor: new THREE.Color('#ffffff'),
    sunGlow: new THREE.Color('#fff2d0'),
    cloudLight: new THREE.Color('#ffffff'),
    cloudShadow: new THREE.Color('#8ea6be'),
    sunDir: new THREE.Vector3(0.30, 0.34, -0.89).normalize(),
    dirLightColor: 0xfff4e4,
    dirLightIntensity: 2.35,
    portalColor: 0xdcf0ff,
    portalIntensity: 0.65,
    hemiSky: 0xdcf0ff,
    hemiGround: 0x624d38,
    hemiIntensity: 0.92,
    lampIntensity: 3.4,
    lampBounce: 0.45,
    pendantIntensity: 0.55,
    bounceIntensity: 0.85,
    beamOpacity: 0.020,
    exposure: 1.01,
    envIntensity: 0.94,
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

// ---------- Multi-Channel PBR Procedural Textures ----------

function createWoodPBR({
  base = '#7c5534',
  grain = '#472b16',
  plankLines = true,
  planksX = 5,
  planksY = 12,
  seed = 19,
  repeatX = 3,
  repeatY = 3,
  roughBase = 140,
  size = 512,
} = {}) {
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
        const shade = (rng() - 0.5) * 34;
        ctx.fillStyle = adjustHex(base, shade);
        ctx.fillRect(px + 1, py + 1, pw - 2, ph - 2);

        const rv = THREE.MathUtils.clamp(Math.round(roughBase + (rng() - 0.5) * 32), 95, 225);
        rctx.fillStyle = `rgb(${rv},${rv},${rv})`;
        rctx.fillRect(px + 1, py + 1, pw - 2, ph - 2);

        const bv = Math.round(132 + (rng() - 0.5) * 20);
        bctx.fillStyle = `rgb(${bv},${bv},${bv})`;
        bctx.fillRect(px + 1, py + 1, pw - 2, ph - 2);

        ctx.save();
        ctx.beginPath();
        ctx.rect(px + 1, py + 1, pw - 2, ph - 2);
        ctx.clip();
        for (let g = 0; g < 18; g++) {
          const gx = px + rng() * pw;
          const cp1 = (rng() - 0.5) * 14;
          const cp2 = (rng() - 0.5) * 14;
          const lw = 0.7 + rng() * 1.9;
          ctx.strokeStyle = rgbaHex(grain, 0.08 + rng() * 0.16);
          ctx.lineWidth = lw;
          ctx.beginPath();
          ctx.moveTo(gx, py);
          ctx.bezierCurveTo(gx + cp1, py + ph * 0.33, gx + cp2, py + ph * 0.66, gx + cp1 * 0.5, py + ph);
          ctx.stroke();

          bctx.strokeStyle = `rgba(95,95,95,${0.10 + rng() * 0.14})`;
          bctx.lineWidth = lw;
          bctx.beginPath();
          bctx.moveTo(gx, py);
          bctx.bezierCurveTo(gx + cp1, py + ph * 0.33, gx + cp2, py + ph * 0.66, gx + cp1 * 0.5, py + ph);
          bctx.stroke();
        }
        ctx.restore();

        ctx.strokeStyle = 'rgba(24, 14, 6, 0.28)';
        ctx.lineWidth = 1.1;
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
    // High-resolution organic cathedral American walnut wood grain + fine tactile pores
    for (let i = 0; i < (size > 512 ? 520 : 220); i++) {
      const y = rng() * size;
      const cp1 = (rng() - 0.5) * (size * 0.055);
      const cp2 = (rng() - 0.5) * (size * 0.055);
      const lw = 0.6 + rng() * 2.2;
      ctx.strokeStyle = rgbaHex(grain, 0.06 + rng() * 0.16);
      ctx.lineWidth = lw;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.bezierCurveTo(size * 0.33, y + cp1, size * 0.66, y + cp2, size, y + cp1 * 0.4);
      ctx.stroke();

      rctx.strokeStyle = `rgba(${Math.min(245, roughBase + 36)},${Math.min(245, roughBase + 36)},${Math.min(245, roughBase + 36)},0.22)`;
      rctx.lineWidth = lw;
      rctx.beginPath();
      rctx.moveTo(0, y);
      rctx.bezierCurveTo(size * 0.33, y + cp1, size * 0.66, y + cp2, size, y + cp1 * 0.4);
      rctx.stroke();

      bctx.strokeStyle = 'rgba(84,84,84,0.22)';
      bctx.lineWidth = lw;
      bctx.beginPath();
      bctx.moveTo(0, y);
      bctx.bezierCurveTo(size * 0.33, y + cp1, size * 0.66, y + cp2, size, y + cp1 * 0.4);
      bctx.stroke();
    }
    if (size > 512) {
      // Micro wood pores & subtle satin sheen variation for close-up photorealism
      for (let p = 0; p < 1800; p++) {
        const px = rng() * size;
        const py = rng() * size;
        const pw = 6 + rng() * 24;
        ctx.fillStyle = rgbaHex(grain, 0.14 + rng() * 0.16);
        ctx.fillRect(px, py, pw, 1.3);
        bctx.fillStyle = 'rgba(65,65,65,0.26)';
        bctx.fillRect(px, py, pw, 1.3);
      }
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

// Smooth, 100% seamlessly tileable architectural matte plaster (ZERO rectangular tile seams or faceted noise!)
function createPlasterPBR(baseHex = '#ddd2c0', seed = 71) {
  const size = 512;
  const colC = document.createElement('canvas');
  const bmpC = document.createElement('canvas');
  colC.width = bmpC.width = size;
  colC.height = bmpC.height = size;
  const ctx = colC.getContext('2d');
  const bctx = bmpC.getContext('2d');
  const rng = mulberry32(seed);

  ctx.fillStyle = baseHex;
  ctx.fillRect(0, 0, size, size);
  bctx.fillStyle = 'rgb(128,128,128)';
  bctx.fillRect(0, 0, size, size);

  // Ultra-soft toroidally wrapped plaster tonal clouds (drawn across all 9 wrap offsets -> ZERO tile edge seams!)
  for (let i = 0; i < 42; i++) {
    const x = rng() * size;
    const y = rng() * size;
    const r = 64 + rng() * 110;
    const bright = rng() > 0.48;
    for (const ox of [-size, 0, size]) {
      for (const oy of [-size, 0, size]) {
        const cx = x + ox;
        const cy = y + oy;
        if (cx + r < 0 || cx - r > size || cy + r < 0 || cy - r > size) continue;
        const g = ctx.createRadialGradient(cx, cy, 4, cx, cy, r);
        g.addColorStop(0, bright ? 'rgba(255, 248, 236, 0.032)' : 'rgba(72, 54, 40, 0.035)');
        g.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, size, size);

        const bg = bctx.createRadialGradient(cx, cy, 4, cx, cy, r);
        bg.addColorStop(0, bright ? 'rgba(138,138,138,0.06)' : 'rgba(118,118,118,0.06)');
        bg.addColorStop(1, 'rgba(128,128,128,0)');
        bctx.fillStyle = bg;
        bctx.fillRect(0, 0, size, size);
      }
    }
  }

  // Ultra-fine smooth architectural eggshell mineral finish (eliminates gritty dFdx/dFdy bump faceting!)
  const imgCol = ctx.getImageData(0, 0, size, size);
  for (let i = 0; i < size * size; i++) {
    const n = (rng() - 0.5) * 3.0;
    const idx = i * 4;
    imgCol.data[idx] = THREE.MathUtils.clamp(imgCol.data[idx] + n, 0, 255);
    imgCol.data[idx + 1] = THREE.MathUtils.clamp(imgCol.data[idx + 1] + n, 0, 255);
    imgCol.data[idx + 2] = THREE.MathUtils.clamp(imgCol.data[idx + 2] + n, 0, 255);
  }
  ctx.putImageData(imgCol, 0, 0);

  const map = new THREE.CanvasTexture(colC);
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = map.wrapT = THREE.RepeatWrapping;
  map.repeat.set(2, 1);
  map.anisotropy = 8;
  const bumpMap = new THREE.CanvasTexture(bmpC);
  bumpMap.wrapS = bumpMap.wrapT = THREE.RepeatWrapping;
  bumpMap.repeat.set(2, 1);
  return { map, bumpMap };
}

function createBrushedMetalMap(seed = 33) {
  const size = 256;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');
  const rng = mulberry32(seed);
  ctx.fillStyle = 'rgb(112,112,112)';
  ctx.fillRect(0, 0, size, size);
  for (let y = 0; y < size; y++) {
    const v = Math.round(96 + rng() * 36);
    ctx.fillStyle = `rgb(${v},${v},${v})`;
    ctx.fillRect(0, y, size, 1);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(2, 2);
  return tex;
}

function createRugPBR() {
  // High-resolution organic woven wool-boucle rug (ZERO 2px horizontal aliasing stripes!)
  const W = 1024;
  const H = 768;
  const colC = document.createElement('canvas');
  const bmpC = document.createElement('canvas');
  colC.width = bmpC.width = W;
  colC.height = bmpC.height = H;
  const ctx = colC.getContext('2d');
  const bctx = bmpC.getContext('2d');
  const rng = mulberry32(42);

  ctx.fillStyle = '#9e8d74';
  ctx.fillRect(0, 0, W, H);
  bctx.fillStyle = 'rgb(122,122,122)';
  bctx.fillRect(0, 0, W, H);

  // Subtle organic woven wool pile flecks & heathering (non-aliasing tactile fabric depth!)
  for (let i = 0; i < 9500; i++) {
    const x = rng() * W;
    const y = rng() * H;
    const fw = 3 + rng() * 9;
    const fh = 2 + rng() * 5;
    const v = rng();
    ctx.fillStyle = v > 0.52 ? 'rgba(232,218,196,0.16)' : 'rgba(62,48,36,0.17)';
    ctx.fillRect(x, y, fw, fh);
    bctx.fillStyle = v > 0.52 ? 'rgba(182,182,182,0.34)' : 'rgba(72,72,72,0.34)';
    bctx.fillRect(x, y, fw, fh);
  }

  // Soft woven architectural border & muted mid-century diamond pattern
  ctx.strokeStyle = 'rgba(46, 42, 38, 0.30)';
  ctx.lineWidth = 10;
  ctx.strokeRect(36, 36, W - 72, H - 72);
  ctx.strokeStyle = 'rgba(128, 86, 52, 0.24)';
  ctx.lineWidth = 4;
  ctx.strokeRect(56, 56, W - 112, H - 112);

  ctx.strokeStyle = 'rgba(54, 48, 44, 0.16)';
  ctx.lineWidth = 5;
  const cols = 4;
  const rows = 3;
  const cw = (W - 148) / cols;
  const ch = (H - 148) / rows;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const cx = 74 + (c + 0.5) * cw;
      const cy = 74 + (r + 0.5) * ch;
      ctx.beginPath();
      ctx.moveTo(cx, cy - ch * 0.42);
      ctx.lineTo(cx + cw * 0.42, cy);
      ctx.lineTo(cx, cy + ch * 0.42);
      ctx.lineTo(cx - cw * 0.42, cy);
      ctx.closePath();
      ctx.stroke();
    }
  }

  const map = new THREE.CanvasTexture(colC);
  map.colorSpace = THREE.SRGBColorSpace;
  map.anisotropy = 16;
  map.minFilter = THREE.LinearMipmapLinearFilter;
  const bumpMap = new THREE.CanvasTexture(bmpC);
  bumpMap.anisotropy = 8;
  return { map, bumpMap };
}

function createContactShadowTexture() {
  const size = 128;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(size / 2, size / 2, 4, size / 2, size / 2, size / 2);
  g.addColorStop(0.0, 'rgba(3, 2, 1, 0.90)');
  g.addColorStop(0.45, 'rgba(4, 3, 2, 0.58)');
  g.addColorStop(0.76, 'rgba(5, 3, 2, 0.22)');
  g.addColorStop(1.0, 'rgba(6, 4, 3, 0.0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  return new THREE.CanvasTexture(c);
}

function createTemperedGlassTexture() {
  const W = 512;
  const H = 512;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const ctx = c.getContext('2d');
  // Photorealistic dark-smoked Corsair 5000D tempered glass with crisp golden-hour window pane reflection & chamfered bevel!
  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = 'rgba(6, 9, 14, 0.24)';
  ctx.fillRect(28, 28, W - 56, H - 56);

  ctx.save();
  ctx.beginPath();
  ctx.rect(30, 30, W - 60, H - 60);
  ctx.clip();
  // Diagonal reflected architectural window sky + crisp mullion shadow bar across upper-right/left glass
  ctx.save();
  ctx.translate(W * 0.5, H * 0.5);
  ctx.rotate(-0.34);
  const skyRefl = ctx.createLinearGradient(-220, -240, 220, 120);
  skyRefl.addColorStop(0.0, 'rgba(255, 226, 188, 0.34)');
  skyRefl.addColorStop(0.28, 'rgba(255, 214, 174, 0.16)');
  skyRefl.addColorStop(0.55, 'rgba(218, 232, 250, 0.07)');
  skyRefl.addColorStop(1.0, 'rgba(180, 210, 240, 0.0)');
  ctx.fillStyle = skyRefl;
  ctx.fillRect(-300, -300, 600, 270);
  // Crisp reflected dark architectural window mullion silhouette cutting cleanly across the diagonal sky reflection
  ctx.fillStyle = 'rgba(10, 14, 22, 0.20)';
  ctx.fillRect(-300, -138, 600, 14);
  ctx.fillRect(-26, -300, 16, 260);
  // Sharp secondary grazing sheen strip near top edge
  const streak = ctx.createLinearGradient(-260, -210, 260, -155);
  streak.addColorStop(0.0, 'rgba(255, 238, 212, 0.22)');
  streak.addColorStop(0.5, 'rgba(255, 238, 212, 0.06)');
  streak.addColorStop(1.0, 'rgba(255, 238, 212, 0.0)');
  ctx.fillStyle = streak;
  ctx.fillRect(-280, -225, 560, 44);
  ctx.restore();
  // Razor-crisp Fresnel grazing edge highlights along left & right chamfered glass bevels
  const edgeR = ctx.createLinearGradient(W - 46, 0, W - 28, 0);
  edgeR.addColorStop(0, 'rgba(210, 228, 245, 0.0)');
  edgeR.addColorStop(1, 'rgba(232, 244, 255, 0.44)');
  ctx.fillStyle = edgeR;
  ctx.fillRect(W - 46, 30, 18, H - 60);
  const edgeL = ctx.createLinearGradient(28, 0, 44, 0);
  edgeL.addColorStop(0, 'rgba(255, 224, 186, 0.34)');
  edgeL.addColorStop(1, 'rgba(255, 224, 186, 0.0)');
  ctx.fillStyle = edgeL;
  ctx.fillRect(28, 30, 16, H - 60);
  ctx.restore();

  // Crisp matte-black silkscreened ceramic frit border matching real 5000D tempered glass
  ctx.strokeStyle = 'rgba(4, 6, 9, 0.99)';
  ctx.lineWidth = 30;
  ctx.strokeRect(15, 15, W - 30, H - 30);
  // Crisp chamfered physical glass-edge inner specular hairline
  ctx.strokeStyle = 'rgba(224, 238, 252, 0.68)';
  ctx.lineWidth = 2.0;
  ctx.strokeRect(30.5, 30.5, W - 61, H - 61);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// High-detail botanical Sansevieria (Snake Plant) variegated tiger-stripe + golden-chartreuse edge texture
function createSnakePlantLeafPBR() {
  const W = 256;
  const H = 512;
  const c = document.createElement('canvas');
  const b = document.createElement('canvas');
  c.width = b.width = W;
  c.height = b.height = H;
  const ctx = c.getContext('2d');
  const bctx = b.getContext('2d');
  const rng = mulberry32(417);

  // Rich deep forest-green blade interior
  const baseG = ctx.createLinearGradient(0, 0, W, 0);
  baseG.addColorStop(0.0, '#8ba234');
  baseG.addColorStop(0.11, '#9ab03c');
  baseG.addColorStop(0.16, '#26451e');
  baseG.addColorStop(0.50, '#2d5224');
  baseG.addColorStop(0.84, '#26451e');
  baseG.addColorStop(0.89, '#9ab03c');
  baseG.addColorStop(1.0, '#8ba234');
  ctx.fillStyle = baseG;
  ctx.fillRect(0, 0, W, H);
  bctx.fillStyle = 'rgb(128,128,128)';
  bctx.fillRect(0, 0, W, H);

  // Organic horizontal silver-sage variegated tiger bands across the blade center
  for (let y = 14; y < H; y += 22) {
    const bandH = 6 + rng() * 9;
    ctx.fillStyle = `rgba(116, 150, 94, ${0.26 + rng() * 0.24})`;
    ctx.beginPath();
    ctx.moveTo(34, y);
    for (let x = 44; x <= W - 34; x += 18) {
      ctx.lineTo(x, y + (rng() - 0.5) * 9);
    }
    for (let x = W - 34; x >= 34; x -= 18) {
      ctx.lineTo(x, y + bandH + (rng() - 0.5) * 9);
    }
    ctx.closePath();
    ctx.fill();
  }
  // Fine vertical fibrous leaf striations
  for (let x = 8; x < W - 8; x += 3) {
    ctx.fillStyle = rng() > 0.5 ? 'rgba(18, 34, 14, 0.16)' : 'rgba(148, 178, 112, 0.10)';
    ctx.fillRect(x, 0, 1.4, H);
    bctx.fillStyle = rng() > 0.5 ? 'rgb(144,144,144)' : 'rgb(112,112,112)';
    bctx.fillRect(x, 0, 1.5, H);
  }
  const map = new THREE.CanvasTexture(c);
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = map.wrapT = THREE.RepeatWrapping;
  const bumpMap = new THREE.CanvasTexture(b);
  bumpMap.wrapS = bumpMap.wrapT = THREE.RepeatWrapping;
  return { map, bumpMap };
}

// High-detail botanical Fiddle-Leaf Fig leaf venation, organic color variation & micro-relief bump texture
function createFigLeafPBR() {
  const S = 512;
  const c = document.createElement('canvas');
  const b = document.createElement('canvas');
  c.width = b.width = S;
  c.height = b.height = S;
  const ctx = c.getContext('2d');
  const bctx = b.getContext('2d');
  const rng = mulberry32(812);

  const g = ctx.createRadialGradient(S * 0.5, S * 0.45, 24, S * 0.5, S * 0.5, S * 0.62);
  g.addColorStop(0.0, '#3e6422');
  g.addColorStop(0.55, '#2b4b18');
  g.addColorStop(1.0, '#1e3811');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, S, S);
  bctx.fillStyle = 'rgb(122,122,122)';
  bctx.fillRect(0, 0, S, S);

  // Subtle organic chlorophyll mottling patches
  for (let i = 0; i < 42; i++) {
    const rx = rng() * S;
    const ry = rng() * S;
    const rr = 28 + rng() * 68;
    const mg = ctx.createRadialGradient(rx, ry, 2, rx, ry, rr);
    mg.addColorStop(0, rng() > 0.5 ? 'rgba(92, 134, 42, 0.16)' : 'rgba(20, 38, 12, 0.18)');
    mg.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = mg;
    ctx.fillRect(rx - rr, ry - rr, rr * 2, rr * 2);
  }

  // Prominent pale-chartreuse central midrib & branching pinnate veins (iconic Ficus lyrata look!)
  ctx.strokeStyle = 'rgba(136, 168, 72, 0.68)';
  ctx.lineWidth = 7;
  ctx.beginPath();
  ctx.moveTo(S * 0.5, S);
  ctx.lineTo(S * 0.5, 18);
  ctx.stroke();
  bctx.strokeStyle = 'rgb(218,218,218)';
  bctx.lineWidth = 8;
  bctx.beginPath();
  bctx.moveTo(S * 0.5, S);
  bctx.lineTo(S * 0.5, 18);
  bctx.stroke();

  for (let i = 0; i < 8; i++) {
    const y0 = S * 0.88 - i * (S * 0.105);
    for (const side of [-1, 1]) {
      ctx.strokeStyle = 'rgba(128, 162, 68, 0.52)';
      ctx.lineWidth = 3.2 - i * 0.18;
      ctx.beginPath();
      ctx.moveTo(S * 0.5, y0);
      ctx.quadraticCurveTo(S * 0.5 + side * S * 0.24, y0 - 26, S * 0.5 + side * S * 0.46, y0 - 68);
      ctx.stroke();
      bctx.strokeStyle = 'rgb(186,186,186)';
      bctx.lineWidth = 4.0;
      bctx.beginPath();
      bctx.moveTo(S * 0.5, y0);
      bctx.quadraticCurveTo(S * 0.5 + side * S * 0.24, y0 - 26, S * 0.5 + side * S * 0.46, y0 - 68);
      bctx.stroke();
    }
  }
  const map = new THREE.CanvasTexture(c);
  map.colorSpace = THREE.SRGBColorSpace;
  const bumpMap = new THREE.CanvasTexture(b);
  return { map, bumpMap };
}

function createWindowGlassReflectionTexture() {
  const W = 512;
  const H = 256;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const ctx = c.getContext('2d');
  // Subtle architectural glass optical sheen + soft warm interior desk-lamp reflection on left glass pane!
  ctx.fillStyle = 'rgba(226, 234, 248, 0.08)';
  ctx.fillRect(0, 0, W, H);
  const g = ctx.createLinearGradient(0, 0, W, H);
  g.addColorStop(0.0, 'rgba(255, 212, 162, 0.28)');
  g.addColorStop(0.28, 'rgba(255, 232, 204, 0.08)');
  g.addColorStop(0.55, 'rgba(210, 228, 250, 0.18)');
  g.addColorStop(0.80, 'rgba(196, 218, 248, 0.06)');
  g.addColorStop(1.0, 'rgba(255, 214, 168, 0.24)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  // Soft warm ghost reflection of the tungsten Anglepoise desk lamp on the lower-left pane
  const lg = ctx.createRadialGradient(W * 0.22, H * 0.68, 4, W * 0.22, H * 0.68, 72);
  lg.addColorStop(0.0, 'rgba(255, 186, 98, 0.26)');
  lg.addColorStop(0.5, 'rgba(255, 170, 82, 0.09)');
  lg.addColorStop(1.0, 'rgba(255, 160, 72, 0.0)');
  ctx.fillStyle = lg;
  ctx.fillRect(0, 0, W, H);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function createSoftParticleTexture() {
  const size = 64;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, 'rgba(255, 232, 192, 0.9)');
  g.addColorStop(0.35, 'rgba(255, 224, 175, 0.35)');
  g.addColorStop(1, 'rgba(255, 224, 175, 0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  return new THREE.CanvasTexture(c);
}

// High-resolution fine-scale photorealistic architectural facade (1024x1024, tiny crisp office panes, mullions, blinds & interior depth — ZERO Lego squares!)
function createFineArchitecturalFacade(seed, style = 'glass') {
  const W = 512;
  const H = 1024;
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
  rctx.fillStyle = 'rgb(190,190,190)';
  rctx.fillRect(0, 0, W, H);

  const rng = mulberry32(seed);
  const palettes = {
    glass: ['#121a26', '#16202e', '#1a2534', '#141c28'],
    stone: ['#242224', '#2c2725', '#1f1f24', '#312b28'],
    dark: ['#0d1119', '#111621', '#151b26', '#0f141e'],
  };
  const pal = palettes[style] || palettes.glass;
  ctx.fillStyle = pal[Math.floor(rng() * pal.length)];
  ctx.fillRect(0, 0, W, H);

  // Fine real-world architectural rhythm: 24–32 narrow window bays × 64–76 office floors!
  const cols = 24 + Math.floor(rng() * 8);
  const rows = 68 + Math.floor(rng() * 12);
  const cellW = W / cols;
  const cellH = H / rows;
  const padX = Math.max(2.2, cellW * 0.24);
  const padY = Math.max(3.6, cellH * 0.36); // Thick real concrete spandrel floor slabs!

  for (let r = 0; r < rows; r++) {
    const isMechFloor = r > 4 && r % 18 === 0;
    const floorLitDensity = rng() < 0.38 ? 0.08 + rng() * 0.28 : 0.03 + rng() * 0.10;
    let runLit = false;
    let runTone = 0;

    for (let c = 0; c < cols; c++) {
      if (rng() < 0.26) {
        runLit = rng() < floorLitDensity;
        runTone = rng();
      }
      const x = c * cellW + padX * 0.5;
      const y = r * cellH + padY * 0.5;
      const ww = cellW - padX;
      const wh = cellH - padY;

      if (isMechFloor) {
        ctx.fillStyle = 'rgba(8, 10, 15, 0.92)';
        ctx.fillRect(x, y, ww, wh);
        continue;
      }

      // Slightly glossy curtain glass (restrained roughness 75 prevents blown-out specular glare patches!)
      rctx.fillStyle = 'rgb(84,84,84)';
      rctx.fillRect(x, y, ww, wh);

      if (runLit) {
        const alpha = 0.55 + rng() * 0.45;
        let col;
        if (runTone > 0.28) {
          // Warm tungsten interior office light
          const g = 186 + Math.floor(rng() * 44);
          const b = 114 + Math.floor(rng() * 52);
          col = `rgba(255, ${g}, ${b}, ${alpha})`;
        } else {
          // Crisp cool-white office LED ceiling light
          const g = 216 + Math.floor(rng() * 32);
          col = `rgba(196, ${g}, 255, ${alpha * 0.85})`;
        }
        ctx.fillStyle = col;
        ctx.fillRect(x, y, ww, wh);

        // Interior depth: ceiling slab shadow at top + subtle desk silhouette at bottom!
        ctx.fillStyle = 'rgba(14, 18, 26, 0.45)';
        ctx.fillRect(x, y, ww, wh * (0.20 + rng() * 0.25));
        ctx.fillStyle = 'rgba(14, 16, 22, 0.32)';
        ctx.fillRect(x, y + wh * 0.78, ww, wh * 0.22);

        ectx.fillStyle = col;
        ectx.fillRect(x, y + wh * 0.2, ww, wh * 0.62);
      } else {
        const v = 22 + Math.floor(rng() * 24);
        const gPane = ctx.createLinearGradient(x, y, x, y + wh);
        gPane.addColorStop(0, `rgb(${v + 10}, ${v + 18}, ${v + 30})`);
        gPane.addColorStop(1, `rgb(${v}, ${v + 6}, ${v + 14})`);
        ctx.fillStyle = gPane;
        ctx.fillRect(x, y, ww, wh);
      }
    }
  }

  // Structural horizontal spandrel beams & vertical corner pilasters
  ctx.fillStyle = 'rgba(8, 11, 16, 0.72)';
  for (let r = 0; r < rows; r += 1) {
    ctx.fillRect(0, r * cellH, W, 1.8);
  }
  ctx.fillStyle = 'rgba(8, 11, 16, 0.65)';
  ctx.fillRect(0, 0, 5, H);
  ctx.fillRect(W - 5, 0, 5, H);

  const map = new THREE.CanvasTexture(canvas);
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = map.wrapT = THREE.RepeatWrapping;
  map.anisotropy = 8;

  const emissiveMap = new THREE.CanvasTexture(emCanvas);
  emissiveMap.colorSpace = THREE.SRGBColorSpace;
  emissiveMap.wrapS = emissiveMap.wrapT = THREE.RepeatWrapping;
  emissiveMap.anisotropy = 8;

  const roughnessMap = new THREE.CanvasTexture(rghCanvas);
  roughnessMap.wrapS = roughnessMap.wrapT = THREE.RepeatWrapping;

  return { map, emissiveMap, roughnessMap };
}

// Ultra-high-resolution photographic distant twilight city panorama (4096x1024 bokeh lights, avenues, shoreline glow & misty skyscrapers!)
function createDistantCityPanoramaTexture() {
  const W = 4096;
  const H = 1024;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const ctx = c.getContext('2d');
  const rng = mulberry32(9002);

  ctx.clearRect(0, 0, W, H);

  // Rich atmospheric urban twilight horizon glow (deep indigo-slate above -> warm golden street-glow at waterfront!)
  const glow = ctx.createLinearGradient(0, H * 0.25, 0, H);
  glow.addColorStop(0.0, 'rgba(18, 22, 42, 0.0)');
  glow.addColorStop(0.42, 'rgba(26, 28, 48, 0.28)');
  glow.addColorStop(0.70, 'rgba(68, 46, 46, 0.48)');
  glow.addColorStop(0.84, 'rgba(28, 22, 32, 0.84)');
  glow.addColorStop(1.0, 'rgba(10, 13, 22, 0.96)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);

  // Three distant misty metropolitan skyline depth layers with thousands of crisp pinpoint office lights!
  for (let layer = 0; layer < 3; layer++) {
    const col =
      layer === 0
        ? 'rgba(24, 28, 44, 0.42)'
        : layer === 1
        ? 'rgba(16, 20, 34, 0.68)'
        : 'rgba(10, 14, 24, 0.88)';
    const baseY = H * (0.80 + layer * 0.045);
    let x = 0;
    while (x < W) {
      const bw = (layer === 0 ? 18 : 14) + rng() * (layer === 0 ? 46 : 34);
      const bh = (layer === 0 ? 90 + rng() * 250 : layer === 1 ? 60 + rng() * 190 : 38 + rng() * 130);
      ctx.fillStyle = col;
      ctx.fillRect(x, baseY - bh, bw, bh + 180);
      // Setback crown on taller distant towers
      if (bh > 140 && rng() > 0.35) {
        const cw = bw * 0.58;
        const ch = 18 + rng() * 44;
        ctx.fillRect(x + (bw - cw) * 0.5, baseY - bh - ch, cw, ch);
        if (rng() > 0.5) {
          ctx.fillStyle = 'rgba(255, 72, 62, 0.85)';
          ctx.fillRect(x + bw * 0.5 - 1, baseY - bh - ch - 16, 2, 2);
        }
      }
      // Fine architectural horizontal office floor light strips + pinpoint windows
      const floorStep = layer === 0 ? 5.5 : 4.2;
      for (let fy = baseY - bh + 8; fy < baseY - 6; fy += floorStep) {
        if (rng() > 0.55) continue;
        for (let fx = x + 3; fx < x + bw - 4; fx += 4.2) {
          if (rng() > 0.36) continue;
          const warm = rng() > 0.24;
          const a = (0.28 + rng() * 0.62) * (0.55 + layer * 0.22);
          ctx.fillStyle = warm
            ? `rgba(255, ${192 + Math.floor(rng() * 52)}, ${112 + Math.floor(rng() * 64)}, ${a})`
            : `rgba(186, 224, 255, ${a * 0.88})`;
          ctx.fillRect(fx, fy, 2.4, 1.6);
        }
      }
      x += bw + rng() * 5;
    }
  }

  // Sparkling waterfront boulevard & city traffic bokeh ribbon + vertical water light shimmer!
  for (let i = 0; i < 1600; i++) {
    const lx = rng() * W;
    const ly = H * 0.77 + rng() * (H * 0.14);
    const r = 1.0 + rng() * 2.8;
    const roll = rng();
    const col = roll > 0.32
      ? `rgba(255, ${190 + Math.floor(rng() * 55)}, 108, ${0.42 + rng() * 0.52})`
      : roll > 0.12
      ? `rgba(255, 96, 80, ${0.38 + rng() * 0.48})`
      : `rgba(135, 222, 255, ${0.40 + rng() * 0.48})`;
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.arc(lx, ly, r, 0, Math.PI * 2);
    ctx.fill();
    // Subtle vertical shimmering reflection streak on harbor water below waterfront lights
    if (ly > H * 0.83 && rng() < 0.35) {
      ctx.fillStyle = col.replace(/[\d.]+\)$/, '0.16)');
      ctx.fillRect(lx - r * 0.6, ly + 4, r * 1.2, 18 + rng() * 48);
    }
  }

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
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
    ctx.fillStyle = '#efe5d4';
    ctx.fillRect(0, 0, W, H);
    const sunG = ctx.createRadialGradient(W * 0.56, H * 0.36, 10, W * 0.56, H * 0.36, 104);
    sunG.addColorStop(0, '#dd8650');
    sunG.addColorStop(1, '#c3623a');
    ctx.fillStyle = sunG;
    ctx.beginPath();
    ctx.arc(W * 0.56, H * 0.36, 92, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#202e40';
    ctx.beginPath();
    ctx.moveTo(42, H - 52);
    ctx.lineTo(164, 218);
    ctx.lineTo(272, H - 52);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#151f2b';
    ctx.beginPath();
    ctx.moveTo(164, H - 52);
    ctx.lineTo(266, 186);
    ctx.lineTo(348, H - 52);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#b4885a';
    ctx.lineWidth = 3;
    ctx.strokeRect(26, 26, W - 52, H - 52);
  } else {
    // Homage to felixrieseberg.com's cobalt-blue "SIGNAL / NOISE" wall poster
    ctx.fillStyle = '#2445a6';
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#eff4ff';
    ctx.font = 'bold 46px Inter, sans-serif';
    ctx.fillText('SIGNAL', 32, 86);
    ctx.fillText('+', W - 70, 86);
    ctx.fillText('NOISE', 32, H - 46);

    ctx.strokeStyle = 'rgba(225, 238, 255, 0.72)';
    ctx.lineWidth = 2.2;
    for (let i = 0; i < 3; i++) {
      ctx.save();
      ctx.translate(W * 0.5, H * 0.5);
      ctx.rotate((i * Math.PI) / 3 - 0.3);
      ctx.beginPath();
      ctx.ellipse(0, 0, 128, 48, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
    ctx.fillStyle = '#d6e5ff';
    ctx.font = '600 14px monospace';
    ctx.fillText('OMARCHY · RTX 5090 · 8× DGX SPARK', 32, H - 18);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function createNeonCitySignTexture(text, colorHex) {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 64;
  const ctx = c.getContext('2d');
  ctx.clearRect(0, 0, 256, 64);
  ctx.shadowColor = colorHex;
  ctx.shadowBlur = 10;
  ctx.fillStyle = colorHex;
  ctx.font = 'bold 30px Inter, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 128, 34);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// ---------- Main OfficeScene Class ----------

export class OfficeScene {
  constructor(canvas, omarchyScreen, onInteractPreset) {
    this.canvas = canvas;
    this.omarchyScreen = omarchyScreen;
    this.onInteractPreset = onInteractPreset;

    this.moodIndex = 0;
    this.clock = new THREE.Clock();
    this.animatingCam = null;
    this.envRenderTarget = null;

    this.gltfLoader = new GLTFLoader();
    this.texLoader = new THREE.TextureLoader();
    this._glbQueue = [];
    this._glbInFlight = 0;
    this._glbMaxConcurrent = 6;
    this._assetStats = { total: 0, loaded: [], failed: [], pending: 0 };
    this._assetProgressCbs = [];
    this._assetReadyResolvers = [];
    if (typeof window !== 'undefined') {
      window.__assetStats = this._assetStats;
    }

    this.brushedMetalTex = createBrushedMetalMap(33);
    this.contactShadowTex = createContactShadowTexture();

    this.skylineTextures = {};
    this.skylineMat = null;
    this.sparkLeds = [];
    this.switchLeds = [];
    this.pcEmissives = [];
    this.spinningFans = [];
    this.lavaBlobs = [];
    this.lavaLight = null;
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
    this._buildDeskAndRealPeripherals();
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
    this.scene.background = new THREE.Color('#131b2b');

    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
      powerPreference: 'high-performance',
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;

    this.pmremGenerator = new THREE.PMREMGenerator(this.renderer);
    this.pmremGenerator.compileEquirectangularShader();

    const w = this.canvas.clientWidth || window.innerWidth;
    const h = this.canvas.clientHeight || window.innerHeight;
    // Tighter near/far planes (0.12..210) boost WebGL depth-buffer precision >2.4x to eliminate Z-fighting!
    this.camera = new THREE.PerspectiveCamera(41, w / h, 0.12, 210);

    this.controls = new OrbitControls(this.camera, this.canvas);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.065;
    this.controls.maxDistance = 5.0;
    this.controls.minDistance = 0.42;
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
      // Restrained photographic bloom (soft halation on warm lamp & RGB accents without specular blowout!)
      this.bloomPass = new UnrealBloomPass(new THREE.Vector2(w, h), 0.11, 0.42, 1.40);
      this.composer.addPass(this.bloomPass);
      this.composer.addPass(new OutputPass());
    } catch {
      this.composer = null;
    }
  }

  _notifyAssetProgress(lastUrl = '') {
    const done = this._assetStats.loaded.length + this._assetStats.failed.length;
    const total = Math.max(done, this._assetStats.total);
    for (const cb of this._assetProgressCbs) {
      try { cb(done, total, lastUrl); } catch { /* ignore */ }
    }
    if (this._assetStats.pending === 0 && this._assetReadyResolvers.length > 0) {
      const resolvers = this._assetReadyResolvers.splice(0);
      for (const r of resolvers) r(this._assetStats);
    }
  }

  whenAllAssetsLoaded(onProgress) {
    if (typeof onProgress === 'function') {
      this._assetProgressCbs.push(onProgress);
      const done = this._assetStats.loaded.length + this._assetStats.failed.length;
      onProgress(done, Math.max(done, this._assetStats.total), '');
    }
    if (this._assetStats.pending === 0 && this._assetStats.total > 0) {
      return Promise.resolve(this._assetStats);
    }
    return new Promise((resolve) => {
      this._assetReadyResolvers.push(resolve);
    });
  }

  // Helper to load a real-world Blender .glb model cleanly with bounded concurrency,
  // automatic retries on transient HTTP/2 or network hiccups, shadow setup & crisp metallic IBL.
  _loadGLB(url, onLoaded, retries = 3) {
    this._assetStats.total++;
    this._assetStats.pending++;
    this._glbQueue.push({ url, onLoaded, retries, attempt: 0 });
    this._drainGLBQueue();
  }

  _drainGLBQueue() {
    while (this._glbInFlight < this._glbMaxConcurrent && this._glbQueue.length > 0) {
      const job = this._glbQueue.shift();
      this._glbInFlight++;
      const reqUrl = versionedUrl(job.url, job.attempt > 0 ? { retry: job.attempt } : null);
      this.gltfLoader.load(
        reqUrl,
        (gltf) => {
          this._glbInFlight--;
          this._assetStats.pending = Math.max(0, this._assetStats.pending - 1);
          this._assetStats.loaded.push(job.url);
          const root = gltf.scene;
          root.traverse((obj) => {
            if (obj.isMesh) {
              obj.castShadow = true;
              obj.receiveShadow = true;
              if (obj.material && obj.material.isMeshStandardMaterial && obj.material.metalness >= 0.55) {
                obj.material.envMapIntensity = 1.48;
              }
            }
          });
          job.onLoaded(root);
          this._notifyAssetProgress(job.url);
          this._drainGLBQueue();
        },
        undefined,
        (err) => {
          this._glbInFlight--;
          if (job.attempt < job.retries) {
            job.attempt++;
            const delay = 350 * Math.pow(2, job.attempt - 1);
            setTimeout(() => {
              this._glbQueue.push(job);
              this._drainGLBQueue();
            }, delay);
          } else {
            this._assetStats.pending = Math.max(0, this._assetStats.pending - 1);
            this._assetStats.failed.push(job.url);
            console.warn(`Failed to load GLB ${job.url} after ${job.retries} retries:`, err);
            this._notifyAssetProgress(job.url);
            this._drainGLBQueue();
          }
        }
      );
    }
  }

  _loadSkylineTexture(mood, attempt = 0) {
    const reqUrl = versionedUrl(mood.skylineUrl, attempt > 0 ? { retry: attempt } : null);
    if (attempt === 0) {
      this._assetStats.total++;
      this._assetStats.pending++;
    }
    const tex = this.texLoader.load(
      reqUrl,
      (loadedTex) => {
        loadedTex.colorSpace = THREE.SRGBColorSpace;
        loadedTex.anisotropy = Math.min(16, this.renderer.capabilities.getMaxAnisotropy());
        loadedTex.minFilter = THREE.LinearMipmapLinearFilter;
        loadedTex.magFilter = THREE.LinearFilter;
        loadedTex.wrapS = THREE.MirroredRepeatWrapping;
        loadedTex.wrapT = THREE.ClampToEdgeWrapping;
        loadedTex.repeat.set(1.98, 1.0);
        loadedTex.offset.set(-0.49, 0.0);
        loadedTex.needsUpdate = true;
        this.skylineTextures[mood.id] = loadedTex;
        this._assetStats.pending = Math.max(0, this._assetStats.pending - 1);
        this._assetStats.loaded.push(mood.skylineUrl);
        if (this.skylineMat && SKY_MOODS[this.moodIndex]?.id === mood.id) {
          this.skylineMat.map = loadedTex;
          this.skylineMat.opacity = 1.0;
          this.skylineMat.transparent = false;
          this.skylineMat.needsUpdate = true;
        }
        this._notifyAssetProgress(mood.skylineUrl);
      },
      undefined,
      (err) => {
        if (attempt < 3) {
          setTimeout(() => this._loadSkylineTexture(mood, attempt + 1), 350 * Math.pow(2, attempt));
        } else {
          this._assetStats.pending = Math.max(0, this._assetStats.pending - 1);
          this._assetStats.failed.push(mood.skylineUrl);
          console.warn(`Failed to load skyline texture ${mood.skylineUrl}:`, err);
          this._notifyAssetProgress(mood.skylineUrl);
        }
      }
    );
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = Math.min(16, this.renderer.capabilities.getMaxAnisotropy());
    tex.wrapS = THREE.MirroredRepeatWrapping;
    tex.wrapT = THREE.ClampToEdgeWrapping;
    tex.repeat.set(1.98, 1.0);
    tex.offset.set(-0.49, 0.0);
    return tex;
  }

  _loadTrackedTexture(url, onReady, attempt = 0) {
    const reqUrl = versionedUrl(url, attempt > 0 ? { retry: attempt } : null);
    if (attempt === 0) {
      this._assetStats.total++;
      this._assetStats.pending++;
    }
    const tex = this.texLoader.load(
      reqUrl,
      (loadedTex) => {
        loadedTex.colorSpace = THREE.SRGBColorSpace;
        loadedTex.anisotropy = Math.min(16, this.renderer.capabilities.getMaxAnisotropy());
        loadedTex.minFilter = THREE.LinearMipmapLinearFilter;
        loadedTex.magFilter = THREE.LinearFilter;
        loadedTex.needsUpdate = true;
        this._assetStats.pending = Math.max(0, this._assetStats.pending - 1);
        this._assetStats.loaded.push(url);
        if (onReady) onReady(loadedTex);
        this._notifyAssetProgress(url);
      },
      undefined,
      (err) => {
        if (attempt < 3) {
          setTimeout(() => this._loadTrackedTexture(url, onReady, attempt + 1), 350 * Math.pow(2, attempt));
        } else {
          this._assetStats.pending = Math.max(0, this._assetStats.pending - 1);
          this._assetStats.failed.push(url);
          console.warn(`Failed to load texture ${url}:`, err);
          this._notifyAssetProgress(url);
        }
      }
    );
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  _updateEnvironmentMap(mood) {
    // High-dynamic-range architectural studio environment so anodized gold (DGX Spark), brushed steel (CRS804),
    // platinum aluminum (Dell stand), and dark gunmetal titanium (RTX 5090 FE) catch crisp specular bands & dark contrast!
    const envScene = new THREE.Scene();

    const envDome = new THREE.Mesh(
      new THREE.SphereGeometry(20, 24, 16),
      new THREE.ShaderMaterial({
        side: THREE.BackSide,
        uniforms: {
          uTop: { value: mood.zenith.clone() },
          uMid: { value: mood.mid.clone() },
          uBot: { value: new THREE.Color('#18110c') },
        },
        vertexShader: `
          varying vec3 vP;
          void main() { vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
        `,
        fragmentShader: `
          uniform vec3 uTop; uniform vec3 uMid; uniform vec3 uBot;
          varying vec3 vP;
          void main() {
            vec3 c = vP.y > 0.0 ? mix(uMid, uTop, pow(vP.y, 0.7)) : mix(uMid * 0.35, uBot, clamp(-vP.y * 2.5, 0.0, 1.0));
            gl_FragColor = vec4(c * 0.72, 1.0);
          }
        `,
      })
    );
    envScene.add(envDome);

    // Bright HDR panoramic window specular cards separated by dark mullion strips (creates authentic metallic sheen gradients!)
    const winColor = mood.horizon.clone().multiplyScalar(2.8);
    for (const wx of [-4.2, 0.0, 4.2]) {
      const paneCard = new THREE.Mesh(
        new THREE.PlaneGeometry(3.4, 5.2),
        new THREE.MeshBasicMaterial({ color: winColor })
      );
      paneCard.position.set(wx, 2.6, -10.5);
      envScene.add(paneCard);
    }
    // Crisp dark architectural contrast strips (ceiling soffit + room side walls -> gives metals rich dark-to-bright reflections!)
    const darkStrip = new THREE.MeshBasicMaterial({ color: new THREE.Color('#0c0a09') });
    for (const sx of [-11.5, 11.5]) {
      const sidePanel = new THREE.Mesh(new THREE.PlaneGeometry(18, 12), darkStrip);
      sidePanel.rotation.y = sx < 0 ? Math.PI / 2 : -Math.PI / 2;
      sidePanel.position.set(sx, 1.5, 0);
      envScene.add(sidePanel);
    }
    const rearDark = new THREE.Mesh(new THREE.PlaneGeometry(22, 12), new THREE.MeshBasicMaterial({ color: new THREE.Color('#1a1410') }));
    rearDark.rotation.y = Math.PI;
    rearDark.position.set(0, 1.5, 11.5);
    envScene.add(rearDark);

    // Soft overhead linear pendant card shifted left so it NEVER clips Unit 8's horizontal top face to white!
    const pendantCard = new THREE.Mesh(
      new THREE.PlaneGeometry(7.5, 1.0),
      new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffd8a4').multiplyScalar(0.92) })
    );
    pendantCard.rotation.x = Math.PI / 2;
    pendantCard.position.set(-2.6, 8.2, -1.2);
    envScene.add(pendantCard);

    const lampCard = new THREE.Mesh(
      new THREE.SphereGeometry(1.4, 12, 10),
      new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffb860').multiplyScalar(2.4) })
    );
    lampCard.position.set(-6.5, 1.8, -2.0);
    envScene.add(lampCard);

    const floorBounce = new THREE.Mesh(
      new THREE.PlaneGeometry(16, 16),
      new THREE.MeshBasicMaterial({ color: new THREE.Color('#342214') })
    );
    floorBounce.rotation.x = -Math.PI / 2;
    floorBounce.position.set(0, -6, 0);
    envScene.add(floorBounce);

    const nextRT = this.pmremGenerator.fromScene(envScene, 0.04);
    envScene.traverse((obj) => {
      if (obj.geometry) obj.geometry.dispose();
      if (obj.material) obj.material.dispose();
    });
    if (this.envRenderTarget) this.envRenderTarget.dispose();
    this.envRenderTarget = nextRT;
    this.scene.environment = nextRT.texture;
    this.scene.environmentIntensity = mood.envIntensity;
  }

  _addContactShadow(parent, x, y, z, w, d, opacity = 0.56) {
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(w, d),
      new THREE.MeshBasicMaterial({
        map: this.contactShadowTex,
        transparent: true,
        opacity,
        depthWrite: false,
        polygonOffset: true,
        polygonOffsetFactor: -2,
        polygonOffsetUnits: -2,
      })
    );
    m.rotation.x = -Math.PI / 2;
    m.position.set(x, y, z);
    m.renderOrder = 2;
    parent.add(m);
    return m;
  }

  // ---------- 1. Ultra-Photorealistic Panoramic Exterior Cityscape & Sky Backdrop ----------
  _buildSkyAndCityView() {
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

    // Soft atmospheric outer sky dome fallback for extreme orbit angles
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
        uniform vec3 uZenith;
        uniform vec3 uMid;
        uniform vec3 uHorizon;
        varying vec3 vWorldDir;
        void main() {
          float h = clamp(normalize(vWorldDir).y, -0.2, 1.0);
          vec3 col = h < 0.0
            ? mix(uHorizon, uHorizon * 0.28, clamp(-h * 5.0, 0.0, 1.0))
            : (h < 0.24 ? mix(uHorizon, uMid, smoothstep(0.0, 0.24, h)) : mix(uMid, uZenith, smoothstep(0.24, 0.85, h)));
          gl_FragColor = vec4(col, 1.0);
        }
      `,
    });
    this.scene.add(new THREE.Mesh(new THREE.SphereGeometry(180, 32, 20), skyMat));

    // Preload all 3 ultra-photorealistic 16th-floor panoramic city vistas with retry protection
    for (const mood of SKY_MOODS) {
      this.skylineTextures[mood.id] = this._loadSkylineTexture(mood);
    }

    // Wide 207° curved panoramic photographic cyclorama so even extreme left/right room orbit angles
    // never expose a vertical cutoff edge outside the window (MirroredRepeatWrapping keeps Bay Bridge centered!)
    const panoR = 32.0;
    const arc = Math.PI * 1.15;
    const cylGeo = new THREE.CylinderGeometry(panoR, panoR, 27.5, 96, 1, true, Math.PI - arc * 0.5, arc);
    const uvAttr = cylGeo.attributes.uv;
    for (let i = 0; i < uvAttr.count; i++) {
      uvAttr.setX(i, 1.0 - uvAttr.getX(i));
    }
    uvAttr.needsUpdate = true;

    this.skylineMat = new THREE.MeshBasicMaterial({
      map: this.skylineTextures.golden,
      color: 0xffffff,
      side: THREE.BackSide,
      toneMapped: true,
      transparent: true,
      opacity: 0.0,
    });
    const skylineCyl = new THREE.Mesh(cylGeo, this.skylineMat);
    skylineCyl.position.set(-0.15, 2.55, -1.8);
    this.scene.add(skylineCyl);

    // Subtle exterior architectural balcony concrete ledge & dark steel parapet rail (visible at bottom of window!)
    const extLedge = new THREE.Mesh(
      new THREE.BoxGeometry(6.4, 0.14, 0.95),
      new THREE.MeshStandardMaterial({ color: 0x2a2d34, roughness: 0.85 })
    );
    extLedge.position.set(-0.15, 0.42, -3.22);
    this.scene.add(extLedge);

    const extRail = new THREE.Mesh(
      new THREE.BoxGeometry(6.2, 0.032, 0.042),
      new THREE.MeshStandardMaterial({ color: 0x1e222a, roughness: 0.38, metalness: 0.82 })
    );
    extRail.position.set(-0.15, 0.96, -3.65);
    this.scene.add(extRail);

    // U.S. Navy Blue Angels 6-Jet Fleet Week Airshow over San Francisco Bay (outside window, inside cyclorama!)
    this.blueAngels = new BlueAngelsShow(this.scene, this.camera);
    this.blueAngelsAudio = new BlueAngelsAudio();
    window.__blueAngelsAudio = this.blueAngelsAudio;
    this._loadGLB('assets/models/blue_angel_f18.glb', (jetModel) => {
      this.blueAngels.attachModel(jetModel);
      this.blueAngels.applySkyMood(SKY_MOODS[this.moodIndex].id);
    });

    // Clickable window hotspot
    const winHit = new THREE.Mesh(
      new THREE.PlaneGeometry(4.4, 2.1),
      new THREE.MeshBasicMaterial({ visible: false })
    );
    winHit.position.set(-0.15, 1.72, -2.56);
    winHit.userData.camPreset = 'window';
    this.clickableMeshes.push(winHit);
    this.scene.add(winHit);
  }

  // ---------- 2. Architectural Room Shell (100% Live Three.js PBR Lighting & Shadows — ZERO baked lightmaps!) ----------
  _buildRoomShell() {
    const W = 6.4;
    const H = 3.1;
    const D = 5.4;

    // Authentic long staggered hardwood oak/walnut planks (NOT square tile grid!)
    const floorPBR = createWoodPBR({
      base: '#7a5232',
      grain: '#3e2310',
      plankLines: true,
      planksX: 16,
      planksY: 3,
      seed: 19,
      repeatX: 2.0,
      repeatY: 2.2,
      roughBase: 196,
      size: 1024,
    });
    const floorMat = new THREE.MeshStandardMaterial({
      map: floorPBR.map,
      roughnessMap: floorPBR.roughnessMap,
      bumpMap: floorPBR.bumpMap,
      bumpScale: 0.014,
      roughness: 0.88,
      metalness: 0.02,
      envMapIntensity: 0.26,
    });
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(W, D + 0.04), floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(0, 0, 0.08);
    floor.receiveShadow = true;
    this.scene.add(floor);

    // Authentic Antique Hand-Knotted Persian Kashan/Tabriz Wool Rug (3.38 x 2.38 m) with woven knot pile bump & cotton fringe!
    const rugPBR = createRugPBR();
    const rugBackingMat = new THREE.MeshStandardMaterial({
      color: 0x3a1c1a,
      bumpMap: rugPBR.bumpMap,
      bumpScale: 0.008,
      roughness: 0.94,
      metalness: 0.0,
      envMapIntensity: 0.12,
    });
    const rugBase = new THREE.Mesh(new RoundedBoxGeometry(3.38, 0.015, 2.38, 2, 0.005), rugBackingMat);
    rugBase.position.set(-0.14, 0.0080, -0.35);
    rugBase.receiveShadow = true;
    this.scene.add(rugBase);

    const persianMat = new THREE.MeshStandardMaterial({
      color: 0xebe4da,
      bumpMap: rugPBR.bumpMap,
      bumpScale: 0.009,
      roughness: 0.93,
      metalness: 0.0,
      envMapIntensity: 0.14,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
    });
    const persianTex = this._loadTrackedTexture('assets/textures/persian_rug.jpg', (tex) => {
      persianMat.map = tex;
      persianMat.needsUpdate = true;
    });
    persianMat.map = persianTex;

    const rugTop = new THREE.Mesh(new THREE.PlaneGeometry(3.36, 2.36), persianMat);
    rugTop.rotation.x = -Math.PI / 2;
    rugTop.position.set(-0.14, 0.0158, -0.35);
    rugTop.receiveShadow = true;
    this.scene.add(rugTop);

    // Delicate hand-tied ivory cotton fringe along the left and right short ends of the Persian carpet
    const fringeC = document.createElement('canvas');
    fringeC.width = 64;
    fringeC.height = 512;
    const fctx = fringeC.getContext('2d');
    const frng = mulberry32(314);
    fctx.clearRect(0, 0, 64, 512);
    for (let y = 0; y < 512; y += 3) {
      const len = 42 + frng() * 18;
      const shade = Math.round(205 + frng() * 28);
      fctx.fillStyle = `rgba(${shade}, ${shade - 10}, ${shade - 26}, ${0.78 + frng() * 0.2})`;
      fctx.fillRect(0, y, len, 1.8);
    }
    const fringeTex = new THREE.CanvasTexture(fringeC);
    fringeTex.colorSpace = THREE.SRGBColorSpace;
    const fringeMat = new THREE.MeshStandardMaterial({
      map: fringeTex,
      transparent: true,
      alphaTest: 0.12,
      roughness: 0.95,
      metalness: 0.0,
      side: THREE.DoubleSide,
    });
    for (const side of [-1, 1]) {
      const fringe = new THREE.Mesh(new THREE.PlaneGeometry(0.068, 2.34), fringeMat);
      fringe.rotation.x = -Math.PI / 2;
      if (side < 0) fringe.rotation.z = Math.PI;
      fringe.position.set(-0.14 + side * (3.38 / 2 + 0.032), 0.0024, -0.35);
      fringe.receiveShadow = true;
      this.scene.add(fringe);
    }
    this._addContactShadow(this.scene, -0.14, 0.0014, -0.35, 3.56, 2.54, 0.54);

    // Silky-smooth matte architectural plaster walls (subdivided planes + subtle seamless finish -> ZERO triangle facets or tile seams!)
    const wallPBR = createPlasterPBR('#dfd3c0', 71);
    const wallMat = new THREE.MeshStandardMaterial({
      map: wallPBR.map,
      bumpMap: wallPBR.bumpMap,
      bumpScale: 0.0018,
      roughness: 0.94,
      metalness: 0.0,
      envMapIntensity: 0.16,
    });

    const leftWall = new THREE.Mesh(new THREE.PlaneGeometry(D + 0.04, H, 16, 10), wallMat);
    leftWall.rotation.y = Math.PI / 2;
    leftWall.position.set(-W / 2, H / 2, 0.08);
    leftWall.receiveShadow = true;
    this.scene.add(leftWall);

    const rightWall = new THREE.Mesh(new THREE.PlaneGeometry(D + 0.04, H, 16, 10), wallMat);
    rightWall.rotation.y = -Math.PI / 2;
    rightWall.position.set(W / 2, H / 2, 0.08);
    rightWall.receiveShadow = true;
    this.scene.add(rightWall);

    const rearWall = new THREE.Mesh(new THREE.PlaneGeometry(W, H, 16, 10), wallMat);
    rearWall.rotation.y = Math.PI;
    rearWall.position.set(0, H / 2, 2.8);
    rearWall.receiveShadow = true;
    this.scene.add(rearWall);

    const ceilMat = new THREE.MeshStandardMaterial({ color: 0xe9e1d5, roughness: 0.94 });
    const ceiling = new THREE.Mesh(new THREE.PlaneGeometry(W, D + 0.04, 12, 12), ceilMat);
    ceiling.rotation.x = Math.PI / 2;
    ceiling.position.set(0, H, 0.08);
    this.scene.add(ceiling);

    // Back wall framing the panoramic window aperture (strictly non-overlapping with side walls, floor, ceiling & outer mullions -> ZERO Z-fighting!)
    const winWallMat = new THREE.MeshStandardMaterial({
      map: wallPBR.map,
      bumpMap: wallPBR.bumpMap,
      bumpScale: 0.0015,
      color: 0xd8cab6,
      roughness: 0.94,
      metalness: 0.0,
      envMapIntensity: 0.16,
    });
    const wallThick = 0.24;
    const zBack = -2.6 - wallThick * 0.5;
    const addWallBlock = (w, h, x, y) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, wallThick, 4, 4, 1), winWallMat);
      m.position.set(x, y, zBack);
      m.castShadow = true;
      m.receiveShadow = true;
      this.scene.add(m);
    };
    // Side piers trimmed 4mm inside left/right walls, floor & ceiling (x: [-3.196..-2.550] & [2.250..3.196], y: [0.004..3.096])
    addWallBlock(0.646, H - 0.008, -2.873, H / 2);
    addWallBlock(0.946, H - 0.008, 2.723, H / 2);
    // Bottom & top spandrels trimmed strictly inside side piers AND stopping cleanly outside outer mullions (y<=0.542 & y>=2.858)!
    addWallBlock(4.796, 0.538, -0.15, 0.273);
    addWallBlock(4.796, 0.238, -0.15, 2.977);

    // Rich warm walnut architectural window mullions (100% non-overlapping joints & strict depth stepping -> ZERO window Z-fighting!)
    const sillPBR = createWoodPBR({
      base: '#7a4e2d',
      grain: '#432512',
      plankLines: false,
      seed: 31,
      repeatX: 2.2,
      repeatY: 1,
      roughBase: 132,
    });
    const winWoodMat = new THREE.MeshStandardMaterial({
      map: sillPBR.map,
      roughnessMap: sillPBR.roughnessMap,
      bumpMap: sillPBR.bumpMap,
      bumpScale: 0.014,
      roughness: 0.44,
      metalness: 0.05,
      envMapIntensity: 0.65,
      emissive: new THREE.Color(0x28160a),
      emissiveIntensity: 0.38,
    });
    const addMullion = (w, h, d, x, y, z) => {
      const m = new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 2, 0.004), winWoodMat);
      m.position.set(x, y, z);
      m.castShadow = true;
      m.receiveShadow = true;
      this.scene.add(m);
    };
    const wz = -2.70;
    // Outer frame strictly inside wall aperture (x: [-2.546..2.246], y: [0.544..2.856], z: [-2.788..-2.612])
    addMullion(4.792, 0.072, 0.176, -0.15, 2.820, wz);
    addMullion(4.792, 0.072, 0.176, -0.15, 0.580, wz);
    // Outer left & right verticals strictly BETWEEN top & bottom outer frames (y: [0.618..2.782]) & strictly INSIDE side piers!
    addMullion(0.072, 2.164, 0.170, -2.510, 1.700, wz);
    addMullion(0.072, 2.164, 0.170, 2.210, 1.700, wz);
    // Horizontal transom strictly BETWEEN outer left & right verticals (x: [-2.472..2.172], y: [2.194..2.246])
    addMullion(4.644, 0.052, 0.140, -0.15, 2.220, wz);
    // Two inner vertical mullions SPLIT cleanly below & above the horizontal transom (ZERO cross-joint overlap!)
    for (const mx of [-0.95, 0.65]) {
      addMullion(0.056, 1.574, 0.112, mx, 1.405, wz);
      addMullion(0.056, 0.534, 0.112, mx, 2.515, wz);
    }

    // Recessed interior wooden sash stop-beads cleanly split & offset with ZERO overlap!
    const sashRimMat = new THREE.MeshStandardMaterial({
      map: sillPBR.map,
      color: 0xa6744c,
      roughness: 0.48,
      emissive: new THREE.Color(0x3a200e),
      emissiveIntensity: 0.35,
    });
    const addRimBead = (w, h, d, x, y, z) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), sashRimMat);
      m.position.set(x, y, z);
      this.scene.add(m);
    };
    addRimBead(4.640, 0.014, 0.016, -0.15, 2.775, -2.618);
    addRimBead(4.640, 0.014, 0.016, -0.15, 2.255, -2.632);
    for (const bx of [-0.914, 0.686]) {
      addRimBead(0.014, 1.570, 0.016, bx, 1.405, -2.646);
      addRimBead(0.014, 0.502, 0.016, bx, 2.515, -2.646);
    }

    // Architectural reflective window glass sheet strictly BEHIND all mullions & outer frame (z = -2.805 -> ZERO glass/mullion intersection!)
    const winGlass = new THREE.Mesh(
      new THREE.PlaneGeometry(4.66, 2.17),
      new THREE.MeshBasicMaterial({
        map: createWindowGlassReflectionTexture(),
        color: 0xffffff,
        transparent: true,
        opacity: 0.52,
        depthWrite: false,
      })
    );
    winGlass.position.set(-0.15, 1.70, -2.805);
    winGlass.renderOrder = 1;
    this.scene.add(winGlass);

    // Deep matte oiled walnut window sill strictly IN FRONT of back wall (-2.600) & bottom mullion (-2.612) -> ZERO overlap!
    const sillMat = new THREE.MeshStandardMaterial({
      map: sillPBR.map,
      roughnessMap: sillPBR.roughnessMap,
      bumpMap: sillPBR.bumpMap,
      bumpScale: 0.008,
      color: 0x5c3a22,
      roughness: 0.95,
      metalness: 0.0,
      envMapIntensity: 0.06,
    });
    const sill = new THREE.Mesh(new RoundedBoxGeometry(4.92, 0.036, 0.21, 2, 0.006), sillMat);
    sill.position.set(-0.15, 0.598, -2.490);
    sill.receiveShadow = true;
    this.scene.add(sill);

    // Brushed-brass curtain rod with architectural wall brackets & visible curtain rings (Z = -2.26!)
    const brassMat = new THREE.MeshStandardMaterial({
      color: 0xc99c58,
      roughnessMap: this.brushedMetalTex,
      roughness: 0.34,
      metalness: 0.88,
    });
    const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.013, 0.013, 5.42, 16), brassMat);
    rod.rotation.z = Math.PI / 2;
    rod.position.set(-0.15, 2.86, -2.26);
    this.scene.add(rod);
    // Brass end finials, mounting brackets & rings along the curtain panels
    for (const fx of [-2.86, 2.56]) {
      const finial = new THREE.Mesh(new THREE.SphereGeometry(0.024, 14, 10), brassMat);
      finial.position.set(fx, 2.86, -2.26);
      this.scene.add(finial);
    }
    for (const bx of [-2.68, -0.15, 2.38]) {
      const bracket = new THREE.Mesh(new THREE.BoxGeometry(0.022, 0.042, 0.334), brassMat);
      bracket.position.set(bx, 2.86, -2.429);
      this.scene.add(bracket);
    }
    for (const rx of [-2.66, -2.52, -2.38, -2.24, -2.10, 1.78, 1.92, 2.06, 2.20, 2.34]) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.021, 0.004, 8, 16), brassMat);
      ring.rotation.y = Math.PI / 2;
      ring.position.set(rx, 2.855, -2.26);
      this.scene.add(ring);
    }

    this._loadGLB('assets/models/window_curtain.glb', (curtainModel) => {
      curtainModel.traverse((obj) => {
        if (obj.isMesh && obj.material) {
          obj.material.roughness = 0.94;
          obj.material.emissive = new THREE.Color(0x6e4420);
          obj.material.emissiveIntensity = 0.24;
          this.curtainMats = this.curtainMats || [];
          this.curtainMats.push(obj.material);
        }
      });
      const leftCurtain = curtainModel;
      leftCurtain.position.set(-2.46, 0.0, -2.26);
      leftCurtain.scale.set(0.88, 1.06, 1.0);
      this.scene.add(leftCurtain);

      const rightCurtain = curtainModel.clone(true);
      rightCurtain.position.set(1.98, 0.0, -2.26);
      rightCurtain.scale.set(-0.68, 1.06, 1.0);
      this.scene.add(rightCurtain);
    });

    // Architectural acoustic oak wood-slat accent panel on left wall
    const slatWoodMat = new THREE.MeshStandardMaterial({
      color: 0x7c5030,
      roughnessMap: sillPBR.roughnessMap,
      roughness: 0.64,
    });
    const feltMat = new THREE.MeshStandardMaterial({ color: 0x16191e, roughness: 0.96 });
    const feltBacking = new THREE.Mesh(new THREE.BoxGeometry(0.014, 2.66, 1.62), feltMat);
    feltBacking.position.set(-3.188, 1.48, -1.62);
    this.scene.add(feltBacking);
    for (let i = 0; i < 24; i++) {
      const slat = new THREE.Mesh(new THREE.BoxGeometry(0.028, 2.66, 0.036), slatWoodMat);
      slat.position.set(-3.164, 1.48, -2.38 + i * 0.066);
      slat.castShadow = true;
      slat.receiveShadow = true;
      this.scene.add(slat);
    }

    // Architectural warm-taupe baseboards offset cleanly from wall planes & trimmed at corners (ZERO wall/corner Z-fighting!)
    const trimMat = new THREE.MeshStandardMaterial({ color: 0xa99d8d, roughness: 0.74 });
    const addBaseboard = (w, h, d, x, y, z) => {
      const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), trimMat);
      b.position.set(x, y, z);
      b.receiveShadow = true;
      this.scene.add(b);
    };
    addBaseboard(0.022, 0.11, D - 0.056, -3.186, 0.056, 0.1);
    // Right wall baseboard split cleanly on either side of the office entrance door casing (z = 1.07..2.17)
    addBaseboard(0.022, 0.11, 3.63, 3.186, 0.056, -0.765);
    addBaseboard(0.022, 0.11, 0.59, 3.186, 0.056, 2.485);
    addBaseboard(W - 0.060, 0.11, 0.022, 0, 0.056, -2.586);
    addBaseboard(W - 0.060, 0.11, 0.022, 0, 0.056, 2.786);

    // Realistic Architectural Oiled-Walnut Office Entrance Door (with brass lever, hinges, threshold & wall dimmer switch!)
    this._loadGLB('assets/models/office_door.glb', (door) => {
      door.position.set(3.196, 0, 1.62);
      door.rotation.y = -Math.PI / 2;
      door.traverse((obj) => {
        if (obj.isMesh && obj.material?.map) {
          obj.material.map.anisotropy = this.renderer.capabilities.getMaxAnisotropy();
        }
      });
      this._addContactShadow(this.scene, 3.06, 0.0025, 1.62, 0.34, 1.18, 0.78);
      this.scene.add(door);
    });

    // Subtle ceiling downlights + linear brass-accent pendant
    const fixtureMat = new THREE.MeshStandardMaterial({ color: 0x1e222a, roughness: 0.38, metalness: 0.78 });
    const glowBulbMat = new THREE.MeshStandardMaterial({
      color: 0xfff3dc,
      emissive: 0xffcf88,
      emissiveIntensity: 0.85,
    });
    for (const [dx, dz] of [
      [-1.7, -1.2],
      [1.7, -1.2],
      [-1.7, 1.2],
      [1.7, 1.2],
    ]) {
      const ring = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.085, 0.014, 20), fixtureMat);
      ring.position.set(dx, H - 0.009, dz);
      this.scene.add(ring);
      const lens = new THREE.Mesh(new THREE.CylinderGeometry(0.058, 0.058, 0.004, 20), glowBulbMat);
      lens.position.set(dx, H - 0.0185, dz);
      this.scene.add(lens);
    }

    const pendantGroup = new THREE.Group();
    const bar = new THREE.Mesh(new RoundedBoxGeometry(1.42, 0.042, 0.058, 2, 0.006), fixtureMat);
    bar.position.set(-0.35, 2.48, -0.95);
    pendantGroup.add(bar);
    const barAccent = new THREE.Mesh(new THREE.BoxGeometry(1.44, 0.008, 0.062), brassMat);
    barAccent.position.set(-0.35, 2.506, -0.95);
    pendantGroup.add(barAccent);
    const diffuser = new THREE.Mesh(new THREE.BoxGeometry(1.34, 0.008, 0.04), glowBulbMat);
    diffuser.position.set(-0.35, 2.454, -0.95);
    pendantGroup.add(diffuser);
    for (const sx of [-0.92, 0.22]) {
      const wire = new THREE.Mesh(new THREE.CylinderGeometry(0.0035, 0.0035, 0.62, 8), fixtureMat);
      wire.position.set(sx, 2.79, -0.95);
      pendantGroup.add(wire);
    }
    this.scene.add(pendantGroup);
  }

  // ---------- 3. Warm Photographic Lighting (Strong Cozy Anglepoise Pool, Zero Desk Glare Hotspot!) ----------
  _buildLighting() {
    this.hemiLight = new THREE.HemisphereLight(0xffdfb8, 0x423022, 0.48);
    this.scene.add(this.hemiLight);

    this.sunLight = new THREE.DirectionalLight(0xffc686, 1.45);
    this.sunLight.position.set(-3.2, 3.0, -13.5);
    this.sunLight.target.position.set(0.05, 0.72, -0.75);
    this.sunLight.castShadow = true;
    this.sunLight.shadow.mapSize.set(2048, 2048);
    this.sunLight.shadow.camera.near = 4;
    this.sunLight.shadow.camera.far = 20;
    this.sunLight.shadow.camera.left = -2.6;
    this.sunLight.shadow.camera.right = 2.6;
    this.sunLight.shadow.camera.top = 2.5;
    this.sunLight.shadow.camera.bottom = -1.2;
    this.sunLight.shadow.bias = -0.00028;
    this.sunLight.shadow.normalBias = 0.012;
    this.scene.add(this.sunLight);
    this.scene.add(this.sunLight.target);

    this.windowPortalLight = new THREE.RectAreaLight(0xffd5aa, 1.40, 4.4, 2.1);
    this.windowPortalLight.position.set(-0.15, 1.7, -2.52);
    this.windowPortalLight.lookAt(-0.15, 1.35, 1.0);
    this.scene.add(this.windowPortalLight);

    this.pendantAreaLight = new THREE.RectAreaLight(0xffd59c, 0.90, 1.34, 0.12);
    this.pendantAreaLight.position.set(-0.35, 2.43, -0.95);
    this.pendantAreaLight.lookAt(-0.35, 0.75, -0.95);
    this.scene.add(this.pendantAreaLight);

    // Warm Golden Anglepoise Lamp Pool aimed cleanly over books & mug (shielded from monitor!)
    this.deskLampLight = new THREE.SpotLight(0xffa438, 12.2, 1.05, Math.PI * 0.36, 0.86, 1.8);
    this.deskLampLight.position.set(-1.14, 1.15, -0.94);
    this.deskLampLight.target.position.set(-1.16, 0.77, -0.72);
    this.deskLampLight.castShadow = true;
    this.deskLampLight.shadow.mapSize.set(1024, 1024);
    this.deskLampLight.shadow.bias = -0.0004;
    this.scene.add(this.deskLampLight);
    this.scene.add(this.deskLampLight.target);

    // Warm tungsten bounce PointLight inside the Anglepoise shade (short 0.62m radius -> ZERO under-desk bleed onto rug!)
    this.lampGlowBounce = new THREE.PointLight(0xff9830, 1.45, 0.62, 2.2);
    this.lampGlowBounce.position.set(-1.12, 1.08, -0.90);
    this.scene.add(this.lampGlowBounce);

    // Live warm interior room bounce fill
    this.roomBounceLight = new THREE.PointLight(0xffcf94, 0.72, 7.5, 1.4);
    this.roomBounceLight.position.set(-0.2, 2.15, 0.45);
    this.scene.add(this.roomBounceLight);

    // Subtle cool Omarchy monitor bounce onto keyboard
    this.screenGlowLight = new THREE.PointLight(0x7aa2f7, 0.24, 1.4, 2.0);
    this.screenGlowLight.position.set(-0.62, 1.10, -0.90);
    this.scene.add(this.screenGlowLight);

    // Raking warm-neutral front-left key light over CRS804 & 8× DGX Spark (casts real cable shadows WITHOUT clipping Unit 8 top face!)
    this.clusterKeyLight = new THREE.SpotLight(0xffe6c4, 1.12, 2.8, Math.PI * 0.42, 0.82, 1.6);
    this.clusterKeyLight.position.set(-0.26, 1.56, 0.22);
    this.clusterKeyLight.target.position.set(0.18, 0.90, -1.06);
    this.clusterKeyLight.castShadow = true;
    this.clusterKeyLight.shadow.mapSize.set(1024, 1024);
    this.clusterKeyLight.shadow.bias = -0.0003;
    this.clusterKeyLight.shadow.normalBias = 0.008;
    this.scene.add(this.clusterKeyLight);
    this.scene.add(this.clusterKeyLight.target);

    // Warm front-right grazing fill revealing the Corsair 5000D Airflow front triangular mesh, snake plant & poster
    this.rightFillLight = new THREE.PointLight(0xffe2be, 1.15, 3.8, 1.7);
    this.rightFillLight.position.set(1.56, 1.34, -0.26);
    this.scene.add(this.rightFillLight);

    // Warm gallery wall-wash near right wall illuminating the cobalt SIGNAL + NOISE print & Venetian plaster naturally!
    this.posterAccentLight = new THREE.PointLight(0xffcb8c, 0.42, 2.8, 1.6);
    this.posterAccentLight.position.set(2.34, 1.98, -1.86);
    this.scene.add(this.posterAccentLight);

    // Subtle foreground chair-back warm/cool fill so Herman Miller Aeron translucent Pellicle mesh weave reads cleanly!
    this.chairRimLight = new THREE.PointLight(0xd8c6b0, 0.38, 2.2, 1.6);
    this.chairRimLight.position.set(-1.35, 1.05, 1.15);
    this.scene.add(this.chairRimLight);

    // Restrained localized cyan-teal RGB bounce inside the Corsair 5000D (preserves rich dark contrast & metallic shadow depth!)
    this.pcRgbLight = new THREE.PointLight(0x66d4f8, 0.16, 0.50, 2.2);
    this.pcRgbLight.position.set(0.86, 1.24, -0.98);
    this.scene.add(this.pcRgbLight);
    // Subtle front-intake cyan bounce light inside the 3x front RX120 fans
    this.pcFrontRgbBounce = new THREE.PointLight(0x52ccf4, 0.14, 0.40, 2.1);
    this.pcFrontRgbBounce.position.set(0.96, 1.09, -0.80);
    this.scene.add(this.pcFrontRgbBounce);
    // Clean neutral lower-motherboard/M.2 interior fill strictly capped ABOVE the desk surface (illuminates MP600 CORE XT R2 & chipset!)
    this.pcLowerFill = new THREE.PointLight(0xdce8f6, 0.28, 0.34, 1.9);
    this.pcLowerFill.position.set(0.76, 0.96, -0.95);
    this.scene.add(this.pcLowerFill);
  }

  // ---------- 4. Bookshelf, Books, Framed Art & Plants ----------
  _buildBookshelfAndDecor() {
    const shelfGroup = new THREE.Group();
    shelfGroup.position.set(-2.96, 0, 0.42);
    shelfGroup.rotation.y = Math.PI / 2;

    const steelMat = new THREE.MeshStandardMaterial({
      color: 0x1b1f26,
      roughnessMap: this.brushedMetalTex,
      roughness: 0.44,
      metalness: 0.78,
    });
    const shelfPBR = createWoodPBR({
      base: '#6d472c',
      grain: '#3e2514',
      plankLines: false,
      seed: 77,
      repeatX: 2,
      repeatY: 1,
      roughBase: 128,
    });
    const shelfWoodMat = new THREE.MeshStandardMaterial({
      map: shelfPBR.map,
      roughnessMap: shelfPBR.roughnessMap,
      bumpMap: shelfPBR.bumpMap,
      bumpScale: 0.006,
      roughness: 0.70,
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
      const board = new THREE.Mesh(new RoundedBoxGeometry(sw - 0.068, 0.028, sd - 0.012, 2, 0.003), shelfWoodMat);
      board.position.set(0, y, 0);
      board.castShadow = true;
      board.receiveShadow = true;
      shelfGroup.add(board);
    }

    // Curated CS & Springer Mathematics Bookshelf (Knuth TAOCP, Architecture, OS, Springer GTM/UTM/SUMS, Systems)
    const createBookSpineTexture = (spec) => {
      const c = document.createElement('canvas');
      c.width = 128;
      c.height = 512;
      const ctx = c.getContext('2d');
      const W = c.width;
      const H = c.height;

      // Base cloth/hardcover color with subtle vertical spine shading & linen grain
      const grad = ctx.createLinearGradient(0, 0, W, 0);
      grad.addColorStop(0.0, 'rgba(0,0,0,0.22)');
      grad.addColorStop(0.14, 'rgba(255,255,255,0.06)');
      grad.addColorStop(0.5, 'rgba(255,255,255,0.0)');
      grad.addColorStop(0.86, 'rgba(0,0,0,0.08)');
      grad.addColorStop(1.0, 'rgba(0,0,0,0.28)');

      ctx.fillStyle = spec.bg;
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, W, H);

      // Subtle cloth weave speckles
      ctx.fillStyle = 'rgba(255,255,255,0.03)';
      for (let y = 0; y < H; y += 6) {
        ctx.fillRect(0, y, W, 1);
      }

      const style = spec.style || 'classic';
      if (style === 'gtm') {
        // Iconic Springer GTM: bright yellow spine + signature white top series band + black typography!
        ctx.fillStyle = '#f8f8f5';
        ctx.fillRect(0, 18, W, 72);
        ctx.fillStyle = '#181a1f';
        ctx.fillRect(0, 18, W, 3);
        ctx.fillRect(0, 88, W, 3);
        ctx.font = '700 18px "Inter", "DejaVu Sans", sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('GTM', W / 2, 46);
        ctx.font = '700 26px "Inter", "DejaVu Sans", sans-serif';
        ctx.fillText(spec.vol || '', W / 2, 76);

        // Springer bottom band
        ctx.fillStyle = '#181a1f';
        ctx.fillRect(10, H - 56, W - 20, 2);
        ctx.font = '700 16px "Georgia", serif';
        ctx.fillText('Springer', W / 2, H - 28);
      } else if (style === 'utm') {
        // Classic Springer UTM: crisp white spine + yellow/blue top accent band!
        ctx.fillStyle = '#f2c828';
        ctx.fillRect(0, 16, W, 56);
        ctx.fillStyle = '#15325c';
        ctx.fillRect(0, 72, W, 6);
        ctx.font = '700 22px "Inter", "DejaVu Sans", sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('UTM', W / 2, 52);

        ctx.fillStyle = '#15325c';
        ctx.fillRect(10, H - 56, W - 20, 2);
        ctx.font = '700 16px "Georgia", serif';
        ctx.fillText('Springer', W / 2, H - 28);
      } else if (style === 'sums') {
        // Classic Springer SUMS: rich royal blue spine + crisp white top block + Springer mark!
        ctx.fillStyle = '#f6f7fa';
        ctx.fillRect(0, 16, W, 62);
        ctx.fillStyle = '#194d8c';
        ctx.font = '700 22px "Inter", "DejaVu Sans", sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('SUMS', W / 2, 54);

        ctx.fillStyle = '#f6f7fa';
        ctx.fillRect(10, H - 56, W - 20, 2);
        ctx.font = '700 16px "Georgia", serif';
        ctx.fillText('Springer', W / 2, H - 28);
      } else if (style === 'knuth') {
        // Iconic Addison-Wesley Knuth TAOCP: matte black cloth + double gold bands + crisp gold serif lettering!
        ctx.fillStyle = '#d8b24c';
        ctx.fillRect(8, 22, W - 16, 4);
        ctx.fillRect(8, 30, W - 16, 2);
        ctx.fillRect(8, 96, W - 16, 2);
        ctx.fillRect(8, H - 72, W - 16, 2);
        ctx.fillRect(8, H - 30, W - 16, 4);
        ctx.textAlign = 'center';
        ctx.font = '700 22px "Georgia", serif';
        ctx.fillText(spec.vol || 'VOL. 1', W / 2, 68, W - 14);
        ctx.font = '600 14px "Georgia", serif';
        ctx.fillText('ADDISON-WESLEY', W / 2, H - 46, W - 14);
      } else {
        // Classic CS Textbook (top/bottom color bands + publisher footer)
        if (spec.band) {
          ctx.fillStyle = spec.band;
          ctx.fillRect(0, 20, W, 44);
          ctx.fillRect(0, H - 56, W, 18);
        }
        if (spec.vol) {
          ctx.fillStyle = spec.bandFg || spec.fg || '#f4f0e6';
          ctx.textAlign = 'center';
          ctx.font = '700 18px "Inter", "DejaVu Sans", sans-serif';
          ctx.fillText(spec.vol, W / 2, 48, W - 12);
        }
        if (spec.pub) {
          ctx.fillStyle = spec.fg || '#f4f0e6';
          ctx.textAlign = 'center';
          ctx.font = '700 13px "Inter", "DejaVu Sans", sans-serif';
          ctx.fillText(spec.pub, W / 2, H - 20, W - 12);
        }
      }

      // Vertical title + author along the spine center (readable top-to-bottom like real US/EU books!)
      ctx.save();
      ctx.translate(W / 2, H * 0.51);
      ctx.rotate(Math.PI / 2);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      const fg = spec.fg || (style === 'gtm' || style === 'utm' ? '#15171c' : '#f4f0e6');
      ctx.fillStyle = fg;
      const titleStr = spec.title || '';
      const authorStr = spec.author || '';
      const fontFamily = (style === 'gtm' || style === 'knuth') ? '"Georgia", serif' : '"Inter", "DejaVu Sans", sans-serif';
      const titleSize = titleStr.length > 26 ? 19 : titleStr.length > 18 ? 22 : 25;
      ctx.font = `700 ${titleSize}px ${fontFamily}`;
      ctx.fillText(titleStr, 0, authorStr ? -14 : 0, 315);

      if (authorStr) {
        ctx.fillStyle = spec.authorFg || (style === 'knuth' ? '#f2ebd4' : fg);
        ctx.globalAlpha = 0.86;
        ctx.font = `600 15px ${fontFamily}`;
        ctx.fillText(authorStr, 0, 16, 300);
      }
      ctx.restore();

      const tex = new THREE.CanvasTexture(c);
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.anisotropy = this.renderer.capabilities.getMaxAnisotropy();
      return tex;
    };

    const pageMat = new THREE.MeshStandardMaterial({ color: 0xe6dfd0, roughness: 0.88 });
    const addBook = (parent, xLeft, baseY, spec) => {
      const bw = spec.w || 0.036;
      const bh = spec.h || 0.245;
      const bd = spec.d || 0.195;
      const zOff = spec.zOff || 0;
      const tiltZ = spec.tilt || 0;

      const spineTex = createBookSpineTexture(spec);
      const boardMat = new THREE.MeshStandardMaterial({ color: spec.bg, roughness: 0.68, metalness: 0.04 });
      const spineMat = new THREE.MeshStandardMaterial({ map: spineTex, roughness: 0.58, metalness: 0.04 });

      // BoxGeometry face order: +X (right cover), -X (left cover), +Y (top pages), -Y (bottom pages), +Z (SPINE facing room!), -Z (fore-edge pages)
      const mats = [boardMat, boardMat, pageMat, pageMat, spineMat, pageMat];
      const book = new THREE.Mesh(new THREE.BoxGeometry(bw, bh, bd), mats);
      book.position.set(xLeft + bw / 2, baseY + bh / 2 + 0.0005, 0.035 + zOff);
      book.rotation.z = tiltZ;
      book.castShadow = true;
      book.receiveShadow = true;
      parent.add(book);
      return bw + 0.003;
    };

    const addDecorVase = (parent, xLeft, baseY, colHex) => {
      const vase = new THREE.Mesh(
        new THREE.LatheGeometry(
          [
            new THREE.Vector2(0.032, 0),
            new THREE.Vector2(0.056, 0.075),
            new THREE.Vector2(0.044, 0.15),
            new THREE.Vector2(0.025, 0.195),
            new THREE.Vector2(0.033, 0.215),
          ],
          20
        ),
        new THREE.MeshStandardMaterial({ color: colHex, roughness: 0.42 })
      );
      vase.position.set(xLeft + 0.075, baseY + 0.0005, 0.03);
      vase.castShadow = true;
      parent.add(vase);
      return 0.16;
    };

    const shelvesCatalog = [
      // Shelf 0 (bottom, y=0.14): Networking, Security, Distributed Systems & Classic Reference
      [
        { title: 'TCP/IP ILLUSTRATED VOL. 1', author: 'W. R. STEVENS', bg: '#1e3554', band: '#c8a654', fg: '#f4f0e6', pub: 'ADDISON-WESLEY', w: 0.046, h: 0.248 },
        { title: 'TCP/IP ILLUSTRATED VOL. 2', author: 'WRIGHT & STEVENS', bg: '#1a2f4a', band: '#c8a654', fg: '#f4f0e6', pub: 'ADDISON-WESLEY', w: 0.054, h: 0.248 },
        { title: 'UNIX NETWORK PROGRAMMING', author: 'W. R. STEVENS', bg: '#213a58', band: '#b83c32', fg: '#f4f0e6', pub: 'ADDISON-WESLEY', w: 0.050, h: 0.248 },
        { title: 'DESIGNING DATA-INTENSIVE APPS', author: 'M. KLEPPMANN', bg: '#f3f1eb', band: '#c62828', fg: '#16181e', bandFg: '#ffffff', pub: "O'REILLY", w: 0.044, h: 0.238 },
        { title: 'COMPUTER NETWORKS', author: 'TANENBAUM', bg: '#1b4f5c', band: '#e0a938', fg: '#f4f6f8', pub: 'PEARSON', w: 0.048, h: 0.245 },
        { title: 'SYSTEMS PERFORMANCE', author: 'BRENDAN GREGG', bg: '#6e1d26', band: '#1b1d22', fg: '#f5efe6', pub: 'ADDISON-WESLEY', w: 0.048, h: 0.245 },
        { title: 'HACKING: ART OF EXPLOITATION', author: 'JON ERICKSON', bg: '#15181e', band: '#2e9e56', fg: '#e8f5ec', pub: 'NO STARCH', w: 0.036, h: 0.236 },
        { title: 'PRACTICAL BINARY ANALYSIS', author: 'D. ANDRIESSE', bg: '#181a20', band: '#d98c24', fg: '#f4f2ec', pub: 'NO STARCH', w: 0.038, h: 0.236 },
        { title: "SHELLCODER'S HANDBOOK", author: 'ANLEY ET AL.', bg: '#5a1e28', band: '#d4b46a', fg: '#f6f2ea', pub: 'WILEY', w: 0.044, h: 0.238 },
        { title: 'SERIOUS CRYPTOGRAPHY', author: 'J.-P. AUMASSON', bg: '#171c26', band: '#3296c8', fg: '#eef6fc', pub: 'NO STARCH', w: 0.032, h: 0.236 },
        { title: "HACKER'S DELIGHT", author: 'H. S. WARREN', bg: '#214536', band: '#d4b252', fg: '#f4f0e4', pub: 'ADDISON-WESLEY', w: 0.038, h: 0.242 },
        { title: 'DATABASE INTERNALS', author: 'ALEX PETROV', bg: '#f2f0ea', band: '#34498a', fg: '#161820', pub: "O'REILLY", w: 0.034, h: 0.236 },
        { title: 'CRAFTING INTERPRETERS', author: 'R. NYSTROM', bg: '#ede4d4', band: '#b84a2a', fg: '#231d18', pub: 'GENE VERD', w: 0.040, h: 0.240 },
        { title: 'PRINCIPLES OF MATH. ANALYSIS', author: 'WALTER RUDIN', bg: '#4e7ca8', band: '#1b314a', fg: '#f6f8fc', pub: 'MCGRAW-HILL', w: 0.030, h: 0.228 },
        { title: 'ALGEBRA', author: 'MICHAEL ARTIN', bg: '#632632', band: '#d9c59a', fg: '#f6f0e4', pub: 'PEARSON', w: 0.044, h: 0.242 },
        { title: 'THE UNIX PROG. ENVIRONMENT', author: 'KERNIGHAN & PIKE', bg: '#f4f2ec', band: '#28568f', fg: '#161a22', pub: 'PRENTICE HALL', w: 0.028, h: 0.232 },
        { title: 'CODE COMPLETE', author: 'S. MCCONNELL', bg: '#243c64', band: '#d87a28', fg: '#f4f6fa', pub: 'MS PRESS', w: 0.048, h: 0.244 },
        { title: 'DESIGN PATTERNS', author: 'GAMMA ET AL.', bg: '#2b3240', band: '#b59448', fg: '#f2eee4', pub: 'ADDISON-WESLEY', w: 0.036, h: 0.240 },
        { title: 'CLEAN ARCHITECTURE', author: 'R. C. MARTIN', bg: '#f0eee8', band: '#2b2d34', fg: '#16181e', pub: 'PRENTICE HALL', w: 0.032, h: 0.236 },
        { title: 'C++ PROGRAMMING LANGUAGE', author: 'B. STROUSTRUP', bg: '#1b263c', band: '#c43e32', fg: '#f6f4ee', pub: 'ADDISON-WESLEY', w: 0.056, h: 0.246 },
        { title: 'ELEMENTS OF INFORMATION THEORY', author: 'COVER & THOMAS', bg: '#2c483e', band: '#c8a652', fg: '#f4f2e8', pub: 'WILEY', w: 0.044, h: 0.244 },
        { title: 'PROBABILITY & RANDOM PROC.', author: 'GRIMMETT & STIRZAKER', bg: '#20385e', band: '#e4e6ec', fg: '#f5f6fa', pub: 'OXFORD', w: 0.040, h: 0.242 },
      ],
      // Shelf 1 (y=0.54): Springer UTM (White/Yellow) + Springer SUMS (Blue/White) Mathematics Series!
      [
        { style: 'utm', title: 'LINEAR ALGEBRA DONE RIGHT', author: 'S. AXLER', bg: '#f5f4ee', w: 0.030, h: 0.244 },
        { style: 'utm', title: 'UNDERSTANDING ANALYSIS', author: 'S. ABBOTT', bg: '#f5f4ee', w: 0.028, h: 0.244 },
        { style: 'utm', title: 'MATHEMATICS AND ITS HISTORY', author: 'J. STILLWELL', bg: '#f5f4ee', w: 0.042, h: 0.244 },
        { style: 'utm', title: 'NAIVE SET THEORY', author: 'P. R. HALMOS', bg: '#f5f4ee', w: 0.024, h: 0.244 },
        { style: 'utm', title: 'ELEMENTARY ANALYSIS', author: 'K. A. ROSS', bg: '#f5f4ee', w: 0.030, h: 0.244 },
        { style: 'utm', title: 'TOPOLOGY', author: 'K. JANICH', bg: '#f5f4ee', w: 0.026, h: 0.244 },
        { style: 'utm', title: 'ANALYTIC NUMBER THEORY', author: 'T. M. APOSTOL', bg: '#f5f4ee', w: 0.034, h: 0.244 },
        { style: 'utm', title: 'IDEALS, VARIETIES & ALGORITHMS', author: 'COX, LITTLE, O\'SHEA', bg: '#f5f4ee', w: 0.042, h: 0.244 },
        { style: 'utm', title: 'RATIONAL POINTS ON ELLIPTIC CURVES', author: 'SILVERMAN & TATE', bg: '#f5f4ee', w: 0.030, h: 0.244 },
        { style: 'utm', title: 'REAL MATHEMATICAL ANALYSIS', author: 'C. C. PUGH', bg: '#f5f4ee', w: 0.036, h: 0.244 },
        { style: 'utm', title: 'NUMBERS AND GEOMETRY', author: 'J. STILLWELL', bg: '#f5f4ee', w: 0.032, h: 0.244 },
        { vase: 0xd9cbb8 },
        { style: 'sums', title: 'ELEMENTARY NUMBER THEORY', author: 'JONES & JONES', bg: '#1b599e', fg: '#f6f8fc', w: 0.030, h: 0.242 },
        { style: 'sums', title: 'METRIC & TOPOLOGICAL SPACES', author: 'SUTHERLAND', bg: '#1b599e', fg: '#f6f8fc', w: 0.028, h: 0.242 },
        { style: 'sums', title: 'BASIC LINEAR ALGEBRA', author: 'BLYTH & ROBERTSON', bg: '#1b599e', fg: '#f6f8fc', w: 0.028, h: 0.242 },
        { style: 'sums', title: 'COMPLEX ANALYSIS', author: 'J. M. HOWIE', bg: '#1b599e', fg: '#f6f8fc', w: 0.030, h: 0.242 },
        { style: 'sums', title: 'INTRO. TO LIE ALGEBRAS', author: 'ERDMANN & WILDON', bg: '#1b599e', fg: '#f6f8fc', w: 0.030, h: 0.242 },
        { style: 'sums', title: 'MEASURE, INTEGRAL & PROBABILITY', author: 'CAPINSKI & KOPP', bg: '#1b599e', fg: '#f6f8fc', w: 0.030, h: 0.242 },
        { style: 'sums', title: 'GROUPS, RINGS AND FIELDS', author: 'D. A. R. WALLACE', bg: '#1b599e', fg: '#f6f8fc', w: 0.030, h: 0.242 },
        { style: 'sums', title: 'REAL ANALYSIS', author: 'J. M. HOWIE', bg: '#1b599e', fg: '#f6f8fc', w: 0.028, h: 0.242 },
        { style: 'sums', title: 'ELEMENTARY DIFF. GEOMETRY', author: 'A. PRESSLEY', bg: '#1b599e', fg: '#f6f8fc', w: 0.034, h: 0.242 },
        { style: 'sums', title: 'VECTOR CALCULUS', author: 'P. C. MATTHEWS', bg: '#1b599e', fg: '#f6f8fc', w: 0.028, h: 0.242 },
        { style: 'sums', title: 'DISCRETE MATHEMATICS', author: 'N. L. BIGGS', bg: '#1b599e', fg: '#f6f8fc', w: 0.032, h: 0.242 },
        { style: 'sums', title: 'FIELDS AND GALOIS THEORY', author: 'J. M. HOWIE', bg: '#1b599e', fg: '#f6f8fc', w: 0.028, h: 0.242 },
      ],
      // Shelf 2 (center hero shelf, y=0.94): Iconic Yellow Springer GTM (Graduate Texts in Mathematics) Row!
      [
        { style: 'gtm', vol: '9', title: 'INTRO. TO LIE ALGEBRAS', author: 'J. E. HUMPHREYS', bg: '#f2c828', w: 0.028, h: 0.246 },
        { style: 'gtm', vol: '52', title: 'ALGEBRAIC GEOMETRY', author: 'R. HARTSHORNE', bg: '#f2c828', w: 0.040, h: 0.246 },
        { style: 'gtm', vol: '60', title: 'MATH. METHODS CLASS. MECH.', author: 'V. I. ARNOLD', bg: '#f2c828', w: 0.038, h: 0.246 },
        { style: 'gtm', vol: '73', title: 'ALGEBRA', author: 'T. W. HUNGERFORD', bg: '#f2c828', w: 0.040, h: 0.246 },
        { style: 'gtm', vol: '84', title: 'MODERN NUMBER THEORY', author: 'IRELAND & ROSEN', bg: '#f2c828', w: 0.034, h: 0.246 },
        { style: 'gtm', vol: '96', title: 'FUNCTIONAL ANALYSIS', author: 'J. B. CONWAY', bg: '#f2c828', w: 0.036, h: 0.246 },
        { style: 'gtm', vol: '103', title: 'COMPLEX ANALYSIS', author: 'SERGE LANG', bg: '#f2c828', w: 0.038, h: 0.246 },
        { style: 'gtm', vol: '150', title: 'COMMUTATIVE ALGEBRA', author: 'D. EISENBUD', bg: '#f2c828', w: 0.048, h: 0.246 },
        { style: 'gtm', vol: '173', title: 'GRAPH THEORY', author: 'R. DIESTEL', bg: '#f2c828', w: 0.034, h: 0.246 },
        { style: 'gtm', vol: '211', title: 'ALGEBRA (REV. 3RD ED.)', author: 'SERGE LANG', bg: '#f2c828', w: 0.052, h: 0.246 },
        { style: 'gtm', vol: '218', title: 'INTRO. TO SMOOTH MANIFOLDS', author: 'JOHN M. LEE', bg: '#f2c828', w: 0.046, h: 0.246 },
        { style: 'gtm', vol: '222', title: 'LIE GROUPS & REPRESENTATIONS', author: 'BRIAN C. HALL', bg: '#f2c828', w: 0.038, h: 0.246 },
        { style: 'gtm', vol: '242', title: 'LINEAR REP. FINITE GROUPS', author: 'J.-P. SERRE', bg: '#f2c828', w: 0.028, h: 0.246 },
        { style: 'gtm', vol: '267', title: 'QUANTUM THEORY FOR MATH.', author: 'BRIAN C. HALL', bg: '#f2c828', w: 0.040, h: 0.246 },
        { style: 'gtm', vol: '118', title: 'CATEGORY THEORY', author: 'S. MAC LANE', bg: '#f2c828', w: 0.032, h: 0.246 },
        { style: 'gtm', vol: '176', title: 'RIEMANNIAN MANIFOLDS', author: 'JOHN M. LEE', bg: '#f2c828', w: 0.032, h: 0.246 },
        { style: 'gtm', vol: '207', title: 'COURSE IN COMBINATORICS', author: 'J. H. VAN LINT', bg: '#f2c828', w: 0.038, h: 0.246 },
        { style: 'gtm', vol: '275', title: 'PROBABILITY & STOCHASTICS', author: 'E. CINLAR', bg: '#f2c828', w: 0.040, h: 0.246 },
        { vase: 0x395853 },
        { style: 'gtm', vol: '5', title: 'CATEGORIES FOR WORKING MATH.', author: 'S. MAC LANE', bg: '#f2c828', w: 0.032, h: 0.246 },
        { style: 'gtm', vol: '42', title: 'LINEAR REPRESENTATIONS', author: 'J.-P. SERRE', bg: '#f2c828', w: 0.028, h: 0.246 },
        { style: 'gtm', vol: '106', title: 'ARITHMETIC ELLIPTIC CURVES', author: 'J. H. SILVERMAN', bg: '#f2c828', w: 0.038, h: 0.246 },
      ],
      // Shelf 3 (y=1.34): Computer Architecture & Operating Systems Classics!
      [
        { title: 'COMPUTER ARCHITECTURE', author: 'HENNESSY & PATTERSON', bg: '#1b2c4e', band: '#b5342a', fg: '#f6f2e8', vol: '6TH ED', pub: 'MORGAN KAUFMANN', w: 0.056, h: 0.252 },
        { title: 'COMPUTER ORG. & DESIGN', author: 'PATTERSON & HENNESSY', bg: '#1f4478', band: '#d6a438', fg: '#f6f6fa', vol: 'RISC-V', pub: 'MORGAN KAUFMANN', w: 0.050, h: 0.252 },
        { title: 'COMPUTER SYSTEMS (CS:APP)', author: 'BRYANT & O\'HALLARON', bg: '#1b365d', band: '#df7224', fg: '#ffffff', vol: '3RD ED', pub: 'PEARSON', w: 0.056, h: 0.256 },
        { title: 'DIGITAL DESIGN & COMP. ARCH.', author: 'HARRIS & HARRIS', bg: '#263a47', band: '#4da6a6', fg: '#f2f6f8', pub: 'MORGAN KAUFMANN', w: 0.042, h: 0.248 },
        { title: 'MODERN PROCESSOR DESIGN', author: 'SHEN & LIPASTI', bg: '#5e222a', band: '#d8c49a', fg: '#f8f2e8', pub: 'WAVELAND', w: 0.042, h: 0.246 },
        { title: 'MASSIVELY PARALLEL PROC.', author: 'HWU, KIRK, EL HAJJ', bg: '#161a18', band: '#76b900', fg: '#f2f8ee', vol: 'CUDA', pub: 'MORGAN KAUFMANN', w: 0.038, h: 0.246 },
        { title: 'OPERATING SYSTEMS: OSTEP', author: 'ARPACI-DUSSEAU', bg: '#f3f2ec', band: '#d45d28', fg: '#161a24', pub: 'OSTEP', w: 0.046, h: 0.248 },
        { title: 'MODERN OPERATING SYSTEMS', author: 'A. S. TANENBAUM', bg: '#9e2228', band: '#1a1c22', fg: '#f8f4ee', vol: '4TH ED', pub: 'PEARSON', w: 0.054, h: 0.252 },
        { title: 'OPERATING SYSTEM CONCEPTS', author: 'SILBERSCHATZ ET AL.', bg: '#1c545e', band: '#d9a438', fg: '#f5f8fa', vol: '10TH', pub: 'WILEY', w: 0.054, h: 0.254 },
        { title: 'ADV. PROG. UNIX ENVIRONMENT', author: 'W. R. STEVENS', bg: '#1b4736', band: '#d4b254', fg: '#f6f2e6', vol: 'APUE', pub: 'ADDISON-WESLEY', w: 0.054, h: 0.252 },
        { title: 'LINUX PROGRAMMING INTERFACE', author: 'MICHAEL KERRISK', bg: '#16181c', band: '#e6b828', fg: '#f6f6f2', bandFg: '#14161a', pub: 'NO STARCH', w: 0.064, h: 0.258 },
        { title: 'LINUX KERNEL DEVELOPMENT', author: 'ROBERT LOVE', bg: '#2c3442', band: '#c43a32', fg: '#f4f6fa', pub: 'ADDISON-WESLEY', w: 0.036, h: 0.242 },
        { title: 'DESIGN & IMPL. OF FREEBSD', author: 'MCKUSICK ET AL.', bg: '#74202c', band: '#ebe6dc', fg: '#f8f4ee', pub: 'ADDISON-WESLEY', w: 0.046, h: 0.246 },
        { title: 'COMPUTER ARCHITECTURE', author: 'BLAINE & GORDON', bg: '#303b4a', band: '#9fb4cc', fg: '#f2f5fa', pub: 'MIT PRESS', w: 0.038, h: 0.244 },
        { title: 'UNDERSTANDING LINUX KERNEL', author: 'BOVET & CESATI', bg: '#f4f2ec', band: '#1d6b6e', fg: '#161a20', pub: "O'REILLY", w: 0.048, h: 0.244 },
        { title: 'STRUCTURED COMP. ORG.', author: 'A. S. TANENBAUM', bg: '#22385c', band: '#c84a36', fg: '#f4f6fa', pub: 'PEARSON', w: 0.044, h: 0.246 },
        { title: 'SYNTHESIS OF RISC-V CORES', author: 'PATTERSON & WATERMAN', bg: '#202634', band: '#4a90d9', fg: '#f4f6fa', pub: 'RISC-V', w: 0.034, h: 0.240 },
        { title: 'MEMORY SYSTEMS: CACHE/DRAM', author: 'JACOB, NG, WANG', bg: '#2e343c', band: '#c88832', fg: '#f4f2ec', pub: 'MORGAN KAUFMANN', w: 0.050, h: 0.250 },
        { title: 'PARALLEL COMPUTER ARCH.', author: 'CULLER & SINGH', bg: '#362c44', band: '#d0b060', fg: '#f6f2ea', pub: 'MORGAN KAUFMANN', w: 0.052, h: 0.250 },
      ],
      // Shelf 4 (top hero shelf, y=1.74): Donald Knuth TAOCP Set + Algorithms & CS Foundations!
      [
        { style: 'knuth', vol: 'VOL. 1', title: 'THE ART OF COMPUTER PROG.', author: 'DONALD E. KNUTH', bg: '#16181c', fg: '#dfc068', w: 0.048, h: 0.248 },
        { style: 'knuth', vol: 'VOL. 2', title: 'SEMINUMERICAL ALGORITHMS', author: 'DONALD E. KNUTH', bg: '#16181c', fg: '#dfc068', w: 0.050, h: 0.248 },
        { style: 'knuth', vol: 'VOL. 3', title: 'SORTING AND SEARCHING', author: 'DONALD E. KNUTH', bg: '#16181c', fg: '#dfc068', w: 0.052, h: 0.248 },
        { style: 'knuth', vol: 'VOL. 4A', title: 'COMBINATORIAL ALGORITHMS', author: 'DONALD E. KNUTH', bg: '#16181c', fg: '#dfc068', w: 0.056, h: 0.248 },
        { style: 'knuth', vol: 'VOL. 4B', title: 'COMBINATORIAL ALG. PT. 2', author: 'DONALD E. KNUTH', bg: '#16181c', fg: '#dfc068', w: 0.048, h: 0.248 },
        { title: 'CONCRETE MATHEMATICS', author: 'GRAHAM, KNUTH, PATASHNIK', bg: '#223856', band: '#e4d5b4', fg: '#f4f0e4', pub: 'ADDISON-WESLEY', w: 0.042, h: 0.246 },
        { title: 'INTRODUCTION TO ALGORITHMS', author: 'CORMEN ET AL. (CLRS)', bg: '#f4f2ec', band: '#b82428', fg: '#14161c', vol: '4TH ED', pub: 'MIT PRESS', w: 0.062, h: 0.258 },
        { title: 'SICP — COMPUTER PROGRAMS', author: 'ABELSON & SUSSMAN', bg: '#3e2d54', band: '#d9b85c', fg: '#f6f2e8', pub: 'MIT PRESS', w: 0.044, h: 0.246 },
        { title: 'COMPILERS (DRAGON BOOK)', author: 'AHO, LAM, SETHI, ULLMAN', bg: '#6e1e28', band: '#e0b848', fg: '#f8f2e4', pub: 'ADDISON-WESLEY', w: 0.054, h: 0.250 },
        { title: 'THE C PROG. LANGUAGE', author: 'KERNIGHAN & RITCHIE', bg: '#f4f5f8', band: '#1e5ba8', fg: '#141c2c', vol: 'K&R 2E', pub: 'PRENTICE HALL', w: 0.024, h: 0.236 },
        { title: 'TYPES & PROG. LANGUAGES', author: 'BENJAMIN C. PIERCE', bg: '#1b4a52', band: '#e6e2d6', fg: '#f4f6f8', pub: 'MIT PRESS', w: 0.040, h: 0.244 },
        { title: 'THEORY OF COMPUTATION', author: 'MICHAEL SIPSER', bg: '#1c2b48', band: '#d69028', fg: '#f4f6fa', pub: 'CENGAGE', w: 0.036, h: 0.242 },
        { title: 'ALGORITHM DESIGN MANUAL', author: 'STEVEN S. SKIENA', bg: '#243a62', band: '#e2c242', fg: '#f4f6fa', pub: 'SPRINGER', w: 0.046, h: 0.248 },
        { title: 'COMPUTATIONAL COMPLEXITY', author: 'ARORA & BARAK', bg: '#2d3a2c', band: '#d8c89c', fg: '#f6f4ec', pub: 'CAMBRIDGE', w: 0.038, h: 0.246 },
        { title: 'MODERN COMPILER IMPL. IN C', author: 'ANDREW W. APPEL', bg: '#482838', band: '#dcd0b8', fg: '#f6f2ea', pub: 'CAMBRIDGE', w: 0.038, h: 0.244 },
        { title: 'PURELY FUNCTIONAL DATA STR.', author: 'CHRIS OKASAKI', bg: '#2a4654', band: '#c8b482', fg: '#f4f6f8', pub: 'CAMBRIDGE', w: 0.026, h: 0.236 },
        { title: 'DEEP LEARNING', author: 'GOODFELLOW, BENGIO, COURVILLE', bg: '#1b2434', band: '#4ea8de', fg: '#f4f8fc', pub: 'MIT PRESS', w: 0.048, h: 0.246 },
        { title: 'PATTERN REC. & MACHINE LEARN.', author: 'C. M. BISHOP', bg: '#1e4268', band: '#f0c832', fg: '#f6f8fc', pub: 'SPRINGER', w: 0.048, h: 0.248 },
        { title: 'THE ELEMENTS OF STAT. LEARN.', author: 'HASTIE, TIBSHIRANI', bg: '#263e52', band: '#d49a38', fg: '#f4f6fa', pub: 'SPRINGER', w: 0.048, h: 0.248 },
        { vase: 0xd9cbb8 },
      ],
    ];

    const rng = mulberry32(909);
    for (let si = 0; si < 5; si++) {
      const baseY = shelfYs[si] + 0.014;
      const items = shelvesCatalog[si];
      // Compute total row width and center naturally on each shelf so left/right balance feels authentic
      const rightLimit = sw / 2 - 0.065;
      const maxSpan = sw - 0.13;
      let usedSpan = 0;
      const fitItems = [];
      for (const item of items) {
        const step = item.vase ? 0.16 : ((item.w || 0.036) + 0.003);
        if (usedSpan + step > maxSpan) break;
        fitItems.push(item);
        usedSpan += step;
      }
      let cursorX = -usedSpan / 2;
      for (const item of fitItems) {
        if (item.vase) {
          cursorX += addDecorVase(shelfGroup, cursorX, baseY, item.vase);
          continue;
        }
        cursorX += addBook(shelfGroup, cursorX, baseY, {
          ...item,
          zOff: (rng() - 0.5) * 0.014,
          tilt: (rng() - 0.5) * 0.012,
        });
      }
    }

    this._addContactShadow(shelfGroup, 0, 0.003, 0, 1.85, 0.54, 0.46);
    this.scene.add(shelfGroup);

    // Framed Prints
    const addFramedArt = (x, y, z, rotY, w, h, variant) => {
      const g = new THREE.Group();
      const frame = new THREE.Mesh(
        new RoundedBoxGeometry(w + 0.048, h + 0.048, 0.028, 2, 0.004),
        new THREE.MeshStandardMaterial({ color: 0x1c1a18, roughness: 0.48 })
      );
      frame.castShadow = true;
      g.add(frame);
      const art = new THREE.Mesh(
        new THREE.PlaneGeometry(w, h),
        new THREE.MeshStandardMaterial({
          map: createWallArtTexture(variant),
          roughness: 0.56,
          metalness: 0.02,
          envMapIntensity: 0.35,
          polygonOffset: true,
          polygonOffsetFactor: -2,
          polygonOffsetUnits: -2,
        })
      );
      art.position.z = 0.0165;
      g.add(art);
      g.position.set(x, y, z);
      g.rotation.y = rotY;
      this.scene.add(g);
    };
    // Salvador Dalí — "The Persistence of Memory" (1931) museum-framed oil painting on the left wood-slat accent wall!
    // Exact 1.339:1 landscape canvas (0.84 m x 0.627 m) with stepped dark-walnut gallery frame & brushed antique-gold inner fillet.
    {
      const daliGroup = new THREE.Group();
      const cw = 0.84;
      const ch = 0.627;

      // Subtle procedural linen canvas weave bump so the oil painting catches realistic gallery light
      const weaveC = document.createElement('canvas');
      weaveC.width = weaveC.height = 128;
      const wctx = weaveC.getContext('2d');
      wctx.fillStyle = '#808080';
      wctx.fillRect(0, 0, 128, 128);
      for (let i = 0; i < 128; i += 2) {
        wctx.fillStyle = i % 4 === 0 ? '#929292' : '#707070';
        wctx.fillRect(i, 0, 1, 128);
        wctx.fillRect(0, i, 128, 1);
      }
      const weaveBump = new THREE.CanvasTexture(weaveC);
      weaveBump.wrapS = weaveBump.wrapT = THREE.RepeatWrapping;
      weaveBump.repeat.set(16, 12);

      const outerFrameMat = new THREE.MeshStandardMaterial({
        color: 0x1b1510,
        roughness: 0.42,
        metalness: 0.14,
      });
      const goldFilletMat = new THREE.MeshStandardMaterial({
        color: 0xb99248,
        roughness: 0.34,
        metalness: 0.82,
      });

      // Stepped antique brushed-gold museum fillet lip inset cleanly inside the outer molding (ZERO overlap!)
      const fW = 0.014;
      const fD = 0.022;
      const barW = 0.044;
      const barD = 0.036;
      const innerW = cw + fW * 2;
      const innerH = ch + fW * 2;
      const outerW = innerW + barW * 2;
      const outerH = innerH + barW * 2;
      const addBar = (w, h, d, bx, by, bz, mat) => {
        const m = new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 2, 0.004), mat);
        m.position.set(bx, by, bz);
        m.castShadow = true;
        m.receiveShadow = true;
        daliGroup.add(m);
      };
      // Gold inner fillet bars
      addBar(innerW, fW, fD, 0, ch / 2 + fW / 2, -0.002, goldFilletMat);
      addBar(innerW, fW, fD, 0, -ch / 2 - fW / 2, -0.002, goldFilletMat);
      addBar(fW, ch, fD, -cw / 2 - fW / 2, 0, -0.002, goldFilletMat);
      addBar(fW, ch, fD, cw / 2 + fW / 2, 0, -0.002, goldFilletMat);

      // Outer dark walnut gallery frame molding strictly outside the gold fillet
      addBar(outerW, barW, barD, 0, innerH / 2 + barW / 2, 0, outerFrameMat);
      addBar(outerW, barW, barD, 0, -innerH / 2 - barW / 2, 0, outerFrameMat);
      addBar(barW, innerH, barD, -innerW / 2 - barW / 2, 0, 0, outerFrameMat);
      addBar(barW, innerH, barD, innerW / 2 + barW / 2, 0, 0, outerFrameMat);

      // Solid backing panel behind canvas
      const backing = new THREE.Mesh(new THREE.BoxGeometry(cw + 0.02, ch + 0.02, 0.010), outerFrameMat);
      backing.position.set(0, 0, -0.012);
      daliGroup.add(backing);

      const daliMat = new THREE.MeshStandardMaterial({
        color: 0xffffff,
        bumpMap: weaveBump,
        bumpScale: 0.004,
        roughness: 0.46,
        metalness: 0.02,
        envMapIntensity: 0.32,
        emissive: new THREE.Color(0xffffff),
        emissiveIntensity: 0.14,
      });
      const daliTex = this._loadTrackedTexture('assets/textures/dali_persistence_of_memory.jpg', (tex) => {
        daliMat.map = tex;
        daliMat.emissiveMap = tex;
        daliMat.needsUpdate = true;
      });
      daliMat.map = daliTex;
      daliMat.emissiveMap = daliTex;

      const canvasMesh = new THREE.Mesh(new THREE.PlaneGeometry(cw, ch), daliMat);
      canvasMesh.position.set(0, 0, -0.005);
      daliGroup.add(canvasMesh);

      // Sleek matte-brass museum picture light mounted just above the frame grazing the Dalí oil painting
      const picLightBar = new THREE.Mesh(new THREE.CylinderGeometry(0.009, 0.009, 0.34, 14), goldFilletMat);
      picLightBar.rotation.z = Math.PI / 2;
      picLightBar.position.set(0, outerH / 2 + 0.055, 0.095);
      daliGroup.add(picLightBar);
      const picLightStem = new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.005, 0.11, 10), goldFilletMat);
      picLightStem.rotation.x = Math.PI / 2;
      picLightStem.position.set(0, outerH / 2 + 0.055, 0.042);
      daliGroup.add(picLightStem);

      // Mounted flush against the front of the left oak slats (x = -3.150)
      daliGroup.position.set(-3.132, 1.76, -1.56);
      daliGroup.rotation.y = Math.PI / 2;
      this.scene.add(daliGroup);
    }
    // Iconic cobalt-blue SIGNAL / NOISE poster cleanly visible & 100% unobstructed between right curtain and right viewport edge!
    addFramedArt(2.64, 1.72, -2.56, 0, 0.36, 0.46, 1);

    // Google Nest Learning Thermostat (3rd Gen, Stainless Steel, Ø 84 mm x 31 mm) mounted flush on the right plaster wall
    // directly above the architectural wall light switch beside the oiled-walnut entrance door (standard ~1.50 m eye-level height!)
    const nestX = 3.199;
    const nestY = 1.50;
    const nestZ = 0.962;
    this._loadGLB('assets/models/nest_thermostat.glb', (nest) => {
      nest.position.set(nestX, nestY, nestZ);
      nest.rotation.y = -Math.PI / 2;
      nest.traverse((obj) => {
        if (!obj.isMesh || !obj.material) return;
        const mName = obj.material.name || '';
        if (obj.material.map) {
          obj.material.map.anisotropy = this.renderer.capabilities.getMaxAnisotropy();
        }
        if (obj.material.emissiveMap) {
          obj.material.emissiveMap.anisotropy = this.renderer.capabilities.getMaxAnisotropy();
        }
        if (mName === 'Nest_CoverGlass') {
          obj.material = new THREE.MeshPhysicalMaterial({
            color: 0xffffff,
            transparent: true,
            opacity: 0.14,
            roughness: 0.04,
            metalness: 0.05,
            clearcoat: 1.0,
            clearcoatRoughness: 0.03,
            reflectivity: 0.95,
            envMapIntensity: 1.8,
            depthWrite: false,
          });
          obj.renderOrder = 5;
          obj.castShadow = false;
        } else if (mName === 'Nest_StainlessRing') {
          obj.material.metalness = 0.94;
          obj.material.roughness = 0.21;
          obj.material.envMapIntensity = 1.35;
        } else if (mName === 'Nest_DisplayFace') {
          obj.material.emissiveIntensity = 1.05;
          obj.material.roughness = 0.14;
        }
      });
      this.scene.add(nest);
    });
    // Subtle circular ambient occlusion shadow directly on the plaster wall behind the Nest thermostat
    const nestAo = new THREE.Mesh(
      new THREE.PlaneGeometry(0.118, 0.118),
      new THREE.MeshBasicMaterial({
        map: this.contactShadowTex,
        transparent: true,
        opacity: 0.65,
        depthWrite: false,
        polygonOffset: true,
        polygonOffsetFactor: -2,
        polygonOffsetUnits: -2,
      })
    );
    nestAo.position.set(nestX - 0.002, nestY - 0.004, nestZ);
    nestAo.rotation.y = -Math.PI / 2;
    nestAo.renderOrder = 2;
    this.scene.add(nestAo);

    // Helper to ensure procedural Blender botanical meshes have clean 0..1 UVs so leaf venation & variegation textures map accurately!
    const ensureLeafUVs = (geo) => {
      if (geo.attributes.uv) return;
      geo.computeBoundingBox();
      const bb = geo.boundingBox;
      const pos = geo.attributes.position;
      const sx = Math.max(0.001, bb.max.x - bb.min.x);
      const sy = Math.max(0.001, bb.max.y - bb.min.y);
      const sz = Math.max(0.001, bb.max.z - bb.min.z);
      const uvs = new Float32Array(pos.count * 2);
      for (let i = 0; i < pos.count; i++) {
        const u = (pos.getX(i) - bb.min.x) / sx;
        const v = sy >= sz ? (pos.getY(i) - bb.min.y) / sy : (pos.getZ(i) - bb.min.z) / sz;
        uvs[i * 2] = u;
        uvs[i * 2 + 1] = v;
      }
      geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
    };

    // Organic Blender Fiddle-Leaf Fig in textured terracotta planter with realistic pinnate leaf venation & natural satin-matte botanical finish!
    const figLeafPBR = createFigLeafPBR();
    const potPBR = createPlasterPBR('#9a6349', 51);
    this._loadGLB('assets/models/fiddle_fig.glb', (fig) => {
      fig.traverse((obj) => {
        if (!obj.isMesh || !obj.material) return;
        if (obj.material.name?.startsWith('Fig_Leaf')) {
          ensureLeafUVs(obj.geometry);
          obj.material = new THREE.MeshPhysicalMaterial({
            name: obj.material.name,
            color: new THREE.Color(0xf4f6ec),
            map: figLeafPBR.map,
            bumpMap: figLeafPBR.bumpMap,
            bumpScale: 0.018,
            roughness: 0.50,
            metalness: 0.0,
            clearcoat: 0.16,
            clearcoatRoughness: 0.45,
            sheen: 0.28,
            sheenColor: new THREE.Color(0x5c7c28),
            sheenRoughness: 0.65,
            emissive: new THREE.Color(0x283e0e),
            emissiveIntensity: 0.18,
            side: THREE.DoubleSide,
          });
        } else if ((obj.material.name || '').toLowerCase().includes('pot') || (obj.material.name || '').toLowerCase().includes('terra')) {
          obj.material.map = potPBR.map;
          obj.material.bumpMap = potPBR.bumpMap;
          obj.material.bumpScale = 0.014;
          obj.material.roughness = 0.92;
        }
      });
      fig.position.set(-1.98, 0, -1.48);
      fig.rotation.y = 0.55;
      this._addContactShadow(this.scene, -1.98, 0.004, -1.48, 0.72, 0.72, 0.94);
      this.scene.add(fig);
    });

    // Blender-Sculpted Organic Sansevieria (Snake Plant) with variegated tiger-stripe + chartreuse edge texture & matte stoneware planter!
    const snakeLeafPBR = createSnakePlantLeafPBR();
    const stonePotPBR = createPlasterPBR('#8c8073', 93);
    this._loadGLB('assets/models/snake_plant.glb', (snake) => {
      snake.traverse((obj) => {
        if (!obj.isMesh || !obj.material) return;
        const mn = (obj.material.name || '').toLowerCase();
        if (mn.includes('pot') || mn.includes('planter') || mn.includes('ceramic')) {
          obj.material.map = stonePotPBR.map;
          obj.material.bumpMap = stonePotPBR.bumpMap;
          obj.material.bumpScale = 0.015;
          obj.material.color.setHex(0xffffff);
          obj.material.roughness = 0.94;
          obj.material.metalness = 0.02;
        } else if (mn.includes('leaf') || mn.includes('blade') || mn.includes('snake')) {
          ensureLeafUVs(obj.geometry);
          obj.material = new THREE.MeshPhysicalMaterial({
            name: obj.material.name,
            color: new THREE.Color(0xf6f8ef),
            map: snakeLeafPBR.map,
            bumpMap: snakeLeafPBR.bumpMap,
            bumpScale: 0.016,
            roughness: 0.46,
            metalness: 0.0,
            clearcoat: 0.18,
            clearcoatRoughness: 0.44,
            sheen: 0.24,
            sheenColor: new THREE.Color(0x5a7e28),
            emissive: new THREE.Color(0x1c320e),
            emissiveIntensity: 0.16,
            side: THREE.DoubleSide,
          });
        }
      });
      snake.position.set(2.22, 0, -1.52);
      snake.rotation.y = -0.35;
      this._addContactShadow(this.scene, 2.22, 0.004, -1.52, 0.58, 0.58, 0.94);
      this.scene.add(snake);
    });

    // Subtle non-overlapping floor-to-baseboard crevice AO strips (stepped lengths -> ZERO corner Z-fighting!)
    this._addContactShadow(this.scene, 0.0, 0.0022, -2.52, 6.0, 0.30, 0.74);
    this._addContactShadow(this.scene, 3.05, 0.0026, 0.10, 0.30, 4.9, 0.66);
    this._addContactShadow(this.scene, -3.10, 0.0026, 0.10, 0.30, 4.9, 0.66);
  }

  // ---------- 5. Uplift V2 Walnut Desk + Blender Real Peripherals (NO speakers per owner!) ----------
  _buildDeskAndRealPeripherals() {
    const deskGroup = new THREE.Group();
    const deskX = -0.10;
    const deskZ = -0.95;
    const topY = 0.75;
    const topThick = 0.042;
    const deskW = 2.52;
    const deskD = 0.90;

    // Deep, rich oiled American walnut tabletop (rich visible grain + satin oil sheen, ZERO pinkish sky-mirror washout!)
    const walnutPBR = createWoodPBR({
      base: '#361e0f',
      grain: '#0e0502',
      plankLines: false,
      seed: 108,
      repeatX: 2.2,
      repeatY: 1.1,
      roughBase: 178,
      size: 1024,
    });
    const walnutMat = new THREE.MeshStandardMaterial({
      map: walnutPBR.map,
      roughnessMap: walnutPBR.roughnessMap,
      bumpMap: walnutPBR.bumpMap,
      bumpScale: 0.034,
      roughness: 0.80,
      metalness: 0.0,
      envMapIntensity: 0.14,
    });
    const metalMat = new THREE.MeshStandardMaterial({
      color: 0x1a1e26,
      roughnessMap: this.brushedMetalTex,
      roughness: 0.44,
      metalness: 0.80,
    });

    const desktop = new THREE.Mesh(new RoundedBoxGeometry(deskW, topThick, deskD, 3, 0.007), walnutMat);
    desktop.position.set(deskX, topY, deskZ);
    desktop.castShadow = true;
    desktop.receiveShadow = true;
    deskGroup.add(desktop);

    // Uplift V2 T-frame standing desk legs (resting cleanly ON TOP of rug at y=0.017 -> ZERO rug/shadow Z-fighting!)
    for (const lx of [deskX - deskW / 2 + 0.14, deskX + deskW / 2 - 0.14]) {
      const footBar = new THREE.Mesh(new RoundedBoxGeometry(0.068, 0.028, deskD - 0.18, 2, 0.005), metalMat);
      footBar.position.set(lx, 0.0315, deskZ);
      footBar.castShadow = true;
      deskGroup.add(footBar);

      const colLower = new THREE.Mesh(new RoundedBoxGeometry(0.068, 0.40, 0.068, 2, 0.004), metalMat);
      colLower.position.set(lx, 0.246, deskZ);
      colLower.castShadow = true;
      deskGroup.add(colLower);

      const colUpper = new THREE.Mesh(new RoundedBoxGeometry(0.056, 0.29, 0.056, 2, 0.004), metalMat);
      colUpper.position.set(lx, 0.592, deskZ);
      colUpper.castShadow = true;
      deskGroup.add(colUpper);

      this._addContactShadow(deskGroup, lx, 0.0172, deskZ, 0.22, deskD - 0.08, 0.94);
    }
    // Deep, soft ambient occlusion shadow cast by the 2.52m solid walnut desktop onto the rug & floor beneath it!
    this._addContactShadow(deskGroup, deskX, 0.0166, deskZ + 0.04, deskW + 0.24, deskD + 0.34, 0.76);
    const beam = new THREE.Mesh(new THREE.BoxGeometry(deskW - 0.30, 0.048, 0.042), metalMat);
    beam.position.set(deskX, topY - 0.055, deskZ - 0.18);
    deskGroup.add(beam);

    const sy = topY + topThick / 2 + 0.0008;

    // Charcoal wool felt desk mat centered cleanly under the Omarchy monitor, keyboard & mouse
    const matMesh = new THREE.Mesh(
      new RoundedBoxGeometry(0.92, 0.0045, 0.42, 2, 0.002),
      new THREE.MeshStandardMaterial({ color: 0x1b1e25, roughness: 0.94 })
    );
    matMesh.position.set(-0.62, sy + 0.0022, -0.74);
    matMesh.receiveShadow = true;
    deskGroup.add(matMesh);

    // Blender-modeled stacked cloth-bound hardcover books on left desk edge under the warm Anglepoise lamp pool!
    this._loadGLB('assets/models/desk_books.glb', (books) => {
      books.position.set(-1.26, sy, -0.80);
      this._addContactShadow(deskGroup, -1.26, sy + 0.0008, -0.80, 0.29, 0.23, 0.80);
      deskGroup.add(books);
    });

    // Authentic Corsair Peripherals (Corsair K70 PRO TKL Black Aluminum Keyboard + Corsair M75 Wireless Black Mouse — NO speakers!)
    this._loadGLB('assets/models/corsair_k70_kb.glb', (kb) => {
      kb.position.set(-0.68, sy + 0.00485, -0.72);
      kb.traverse((obj) => {
        if (obj.isMesh && obj.material) {
          if (obj.material.map) {
            obj.material.map.anisotropy = this.renderer.capabilities.getMaxAnisotropy();
          }
          if (obj.material.emissiveMap) {
            obj.material.emissiveMap.anisotropy = this.renderer.capabilities.getMaxAnisotropy();
          }
        }
      });
      this._addContactShadow(deskGroup, -0.68, sy + 0.00465, -0.72, 0.385, 0.155, 0.86);
      deskGroup.add(kb);
    });

    this._loadGLB('assets/models/corsair_mouse.glb', (mouse) => {
      mouse.position.set(-0.30, sy + 0.0045, -0.71);
      mouse.rotation.y = -0.08;
      mouse.traverse((obj) => {
        if (obj.isMesh && obj.material?.map) {
          obj.material.map.anisotropy = this.renderer.capabilities.getMaxAnisotropy();
        }
      });
      this._addContactShadow(deskGroup, -0.30, sy + 0.0048, -0.71, 0.11, 0.15, 0.84);
      deskGroup.add(mouse);
    });

    // Meta Ray-Ban Display Smart Glasses (Shiny Black 51-23-150 Wayfarer + right-lens waveguide) & Meta Neural Band
    this._loadGLB('assets/models/meta_rayban_display.glb', (glasses) => {
      const maxAniso = this.renderer.capabilities.getMaxAnisotropy();
      glasses.position.set(0.06, sy, -0.59);
      glasses.rotation.y = -0.34;
      glasses.traverse((obj) => {
        if (!obj.isMesh || !obj.material) return;
        if (obj.material.map) {
          obj.material.map.anisotropy = maxAniso;
          obj.material.map.needsUpdate = true;
        }
        if (obj.material.emissiveMap) {
          obj.material.emissiveMap.anisotropy = maxAniso;
          obj.material.emissiveMap.needsUpdate = true;
        }
        const mn = obj.material.name || '';
        if (mn === 'MetaRB_Lens') {
          obj.material.transparent = true;
          obj.material.opacity = 0.56;
          obj.material.depthWrite = false;
        } else if (mn === 'MetaRB_DisplayLens') {
          obj.material.transparent = true;
          obj.material.opacity = 0.68;
          obj.material.emissiveIntensity = 0.72;
          obj.material.depthWrite = false;
        } else if (mn === 'MetaRB_ShinyBlack') {
          obj.material.envMapIntensity = 1.75;
        } else if (mn === 'MetaRB_TempleLogo') {
          obj.material.polygonOffset = true;
          obj.material.polygonOffsetFactor = -2;
          obj.material.polygonOffsetUnits = -2;
        }
      });
      this._addContactShadow(deskGroup, 0.06, sy + 0.0014, -0.59, 0.19, 0.16, 0.92);
      deskGroup.add(glasses);
    });

    this._loadGLB('assets/models/meta_neural_band.glb', (band) => {
      band.position.set(0.21, sy + 0.002, -0.58);
      // Resting gently on its side edge at a 3/4 angle so the hollow oval sEMG wristband loop & clasp read unmistakably from overview!
      band.rotation.set(0.28, 0.72, 0.14);
      band.traverse((obj) => {
        if (obj.isMesh && obj.material && obj.material.name === 'NeuralBand_CharcoalTextile') {
          obj.material.color.setHex(0x6c7588);
          obj.material.roughness = 0.68;
        }
      });
      this._addContactShadow(deskGroup, 0.21, sy + 0.0014, -0.58, 0.13, 0.11, 0.94);
      deskGroup.add(band);
    });

    // comma.ai Chestnut USB4 eGPU Dock + NVIDIA GeForce RTX 3090 Founders Edition (exact 313 x 61 x 138 mm 3-slot GPU!)
    const egpuX = 0.50;
    const egpuZ = -0.62;
    const egpuRotY = -0.22;
    this._loadGLB('assets/models/comma_rtx3090.glb', (egpu) => {
      const maxAniso = this.renderer.capabilities.getMaxAnisotropy();
      egpu.position.set(egpuX, sy, egpuZ);
      egpu.rotation.y = egpuRotY;
      const rtx3090Fans = [];
      egpu.traverse((obj) => {
        // Multi-material Blender meshes (blades + hub) export as a glTF Group named RTX3090_FanFront / RTX3090_FanBack;
        // register them BEFORE the isMesh guard so the entire impeller (blades + hub) spins around its local Z axis!
        if (obj.name === 'RTX3090_FanFront') {
          this.spinningFans.push({ obj, axis: 'z', speed: 8.4 });
          rtx3090Fans.push(obj);
        } else if (obj.name === 'RTX3090_FanBack') {
          this.spinningFans.push({ obj, axis: 'z', speed: -8.8 });
          rtx3090Fans.push(obj);
        }
        if (!obj.isMesh) return;
        obj.userData.camPreset = 'pc';
        this.clickableMeshes.push(obj);
        if (obj.material) {
          if (obj.material.map) {
            obj.material.map.anisotropy = maxAniso;
            obj.material.map.needsUpdate = true;
          }
          if (obj.material.emissiveMap) {
            obj.material.emissiveMap.anisotropy = maxAniso;
            obj.material.emissiveMap.needsUpdate = true;
          }
          const mName = obj.material.name || '';
          if (mName === 'RTX3090_TitaniumFrame' || mName === 'Comma_Steel') {
            obj.material.envMapIntensity = 1.15;
          } else if (mName === 'Comma_AluBase' || mName === 'RTX3090_GunmetalBody') {
            obj.material.envMapIntensity = 0.65;
          } else if (mName === 'RTX3090_FanBlade') {
            obj.material.color.setHex(0x2a303c);
            obj.material.roughness = 0.34;
            obj.material.metalness = 0.32;
            obj.material.envMapIntensity = 1.15;
          } else if (mName === 'RTX3090_FanHub') {
            obj.material.envMapIntensity = 1.25;
          } else if (mName === 'RTX3090_GeForceLogo') {
            obj.material.emissiveIntensity = 1.65;
            obj.material.polygonOffset = true;
            obj.material.polygonOffsetFactor = -2;
            obj.material.polygonOffsetUnits = -2;
          } else if (mName === 'Comma_LinkLED') {
            obj.material.emissiveIntensity = 3.2;
          } else if (mName === 'RTX3090_ModelBadge' || mName === 'Comma_ChestnutPCB') {
            obj.material.polygonOffset = true;
            obj.material.polygonOffsetFactor = -2;
            obj.material.polygonOffsetUnits = -2;
          }
        }
      });
      window.__rtx3090Fans = rtx3090Fans;
      this._addContactShadow(deskGroup, egpuX + 0.02, sy + 0.0012, egpuZ, 0.34, 0.16, 0.92);
      deskGroup.add(egpu);
    });

    // Tripp Lite ISOBAR8ULTRA 8-Outlet All-Metal Surge Suppressor Seated Flush on Floor/Rug + Grounded AO + Direct Rear Wall-Outlet Routing!
    const isoX = 0.44;
    const isoY = 0.0165; // Flush on top of the rug surface with tight under-chassis contact shadow!
    const isoZ = -1.30;
    const isoRotY = -0.14;
    this._loadGLB('assets/models/tripp_lite_isobar8.glb', (isobar) => {
      isobar.position.set(isoX, isoY, isoZ);
      isobar.rotation.y = isoRotY;
      isobar.traverse((obj) => {
        if (obj.isMesh && obj.material?.map) {
          obj.material.map.anisotropy = this.renderer.capabilities.getMaxAnisotropy();
        }
      });
      this._addContactShadow(deskGroup, isoX, isoY + 0.0016, isoZ, 0.34, 0.18, 0.96);
      deskGroup.add(isobar);
    });

    // Realistic black AC power cords routed device-to-outlet with clean desk-edge clearance (z = -1.400) & natural gravity slack!
    const acCordMat = new THREE.MeshStandardMaterial({ color: 0x0e1014, roughness: 0.80, metalness: 0.04 });
    const acPlugMat = new THREE.MeshStandardMaterial({ color: 0x14171d, roughness: 0.64, metalness: 0.08 });
    const addAcCord = (pts, radius = 0.0044, addPlug = true) => {
      const curve = new THREE.CatmullRomCurve3(pts.map((p) => new THREE.Vector3(...p)), false, 'centripetal', 0.5);
      const tube = new THREE.Mesh(new THREE.TubeGeometry(curve, 52, radius, 8, false), acCordMat);
      tube.castShadow = true;
      deskGroup.add(tube);
      if (addPlug) {
        const end = pts[pts.length - 1];
        const plug = new THREE.Mesh(new RoundedBoxGeometry(0.022, 0.024, 0.024, 2, 0.004), acPlugMat);
        plug.position.set(end[0], end[1] + 0.010, end[2]);
        plug.rotation.y = isoRotY;
        deskGroup.add(plug);
      }
    };
    const isoTopY = isoY + 0.067;
    const isoPt = (lx, lz) => {
      const c = Math.cos(isoRotY), s = Math.sin(isoRotY);
      return [isoX + lx * c + lz * s, isoTopY, isoZ - lx * s + lz * c];
    };

    // 1. Corsair HX1500i PSU heavy-duty AC cord — plugged DIRECTLY into rotated Corsair 5000D rear PSU AC inlet (0.713, sy+0.088, -1.165)!
    const pcRotY = 0.56;
    const pcPsuInlet = [
      0.86 + (-0.016) * Math.cos(pcRotY) + (-0.252) * Math.sin(pcRotY),
      sy + 0.088,
      -0.96 - (-0.016) * Math.sin(pcRotY) + (-0.252) * Math.cos(pcRotY),
    ];
    const pcIecPlug = new THREE.Mesh(new RoundedBoxGeometry(0.026, 0.022, 0.032, 2, 0.004), acPlugMat);
    pcIecPlug.position.set(
      pcPsuInlet[0] - Math.sin(pcRotY) * 0.014,
      pcPsuInlet[1],
      pcPsuInlet[2] - Math.cos(pcRotY) * 0.014
    );
    pcIecPlug.rotation.y = pcRotY;
    deskGroup.add(pcIecPlug);
    addAcCord([
      [pcPsuInlet[0] - Math.sin(pcRotY) * 0.024, pcPsuInlet[1], pcPsuInlet[2] - Math.cos(pcRotY) * 0.024],
      [pcPsuInlet[0] - Math.sin(pcRotY) * 0.062, sy + 0.072, pcPsuInlet[2] - Math.cos(pcRotY) * 0.062],
      [0.648, sy + 0.008, -1.295],
      [0.628, sy + 0.006, -1.365],
      [0.618, sy + 0.003, -1.414],
      [0.605, 0.716, -1.428],
      [0.542, 0.54, -1.430],
      [0.515, 0.24, -1.422],
      [0.545, 0.115, -1.355],
      isoPt(0.084, 0.016),
    ], 0.0052);

    // 2. 6× NVIDIA DGX Spark + 2× ASUS GX10 Rear USB-C PD Power Harness -> Grounded Rear PD Hub -> 2 AC Feeders into ISOBAR8ULTRA Bank 3!
    const pdHub = new THREE.Mesh(new RoundedBoxGeometry(0.070, 0.024, 0.088, 2, 0.005), acPlugMat);
    pdHub.position.set(0.355, sy + 0.0125, -1.275);
    pdHub.castShadow = true;
    pdHub.receiveShadow = true;
    deskGroup.add(pdHub);
    for (let i = 0; i < 8; i++) {
      const nodeY = sy + i * 0.0543 + 0.020;
      const usbcX = 0.31 + 0.047;
      const usbcZ = -1.08 - 0.073;
      const pBoot = new THREE.Mesh(new RoundedBoxGeometry(0.011, 0.007, 0.016, 2, 0.002), acPlugMat);
      pBoot.position.set(usbcX, nodeY, usbcZ - 0.006);
      deskGroup.add(pBoot);

      const spineX = 0.368 + (i % 2) * 0.005;
      const spineZ = -1.178 - Math.floor(i / 2) * 0.0035;
      const pts = [
        [usbcX, nodeY, usbcZ - 0.011],
        [usbcX + 0.008, nodeY, spineZ],
        [spineX, Math.max(sy + 0.012, nodeY - 0.008), spineZ],
      ];
      if (i >= 3) {
        pts.push([spineX, sy + (nodeY - sy) * 0.52, spineZ]);
      }
      pts.push(
        [spineX, sy + 0.014, spineZ - 0.008],
        [0.362 + (i % 2) * 0.006, sy + 0.006, -1.215],
        [0.345 + (i % 3) * 0.010, sy + 0.012, -1.238]
      );
      addAcCord(pts, 0.0021, false);
    }
    // Two primary AC feeder cords exiting rear of PD hub cleanly over the desk back edge (z=-1.400) down to ISOBAR8ULTRA Bank 3
    addAcCord([
      [0.370, sy + 0.012, -1.318],
      [0.382, sy + 0.006, -1.368],
      [0.390, sy + 0.003, -1.414],
      [0.402, 0.716, -1.428],
      [0.448, 0.44, -1.430],
      [0.468, 0.145, -1.392],
      isoPt(0.043, -0.018),
    ], 0.0046);
    addAcCord([
      [0.342, sy + 0.012, -1.318],
      [0.354, sy + 0.006, -1.368],
      [0.364, sy + 0.003, -1.414],
      [0.378, 0.716, -1.428],
      [0.422, 0.40, -1.430],
      [0.448, 0.135, -1.352],
      isoPt(0.043, 0.016),
    ], 0.0046);

    // 3. MikroTik CRS804 switch AC power cord — plugged DIRECTLY into rear PSU1 IEC inlet (-0.055, sy+0.022, -1.242), clearing rear desk edge cleanly!
    const crsPlug = new THREE.Mesh(new RoundedBoxGeometry(0.022, 0.018, 0.026, 2, 0.003), acPlugMat);
    crsPlug.position.set(-0.055, sy + 0.022, -1.252);
    deskGroup.add(crsPlug);
    addAcCord([
      [-0.055, sy + 0.022, -1.262],
      [-0.042, sy + 0.008, -1.315],
      [-0.020, sy + 0.005, -1.368],
      [-0.005, sy + 0.003, -1.414],
      [0.025, 0.716, -1.428],
      [0.355, 0.640, -1.430],
      [0.415, 0.360, -1.428],
      [0.408, 0.132, -1.380],
      isoPt(0.002, -0.018),
    ], 0.0042);

    // 4. Dell UltraSharp U3425WE monitor AC cord — exits behind monitor stand column (-0.60, sy+0.22, -1.185), clears rear desk edge cleanly!
    addAcCord([
      [-0.60, sy + 0.22, -1.185],
      [-0.60, sy + 0.10, -1.202],
      [-0.59, sy + 0.007, -1.295],
      [-0.58, sy + 0.005, -1.368],
      [-0.56, sy + 0.003, -1.414],
      [-0.52, 0.716, -1.428],
      [-0.20, 0.675, -1.430],
      [0.34, 0.655, -1.430],
      [0.388, 0.340, -1.424],
      [0.380, 0.130, -1.350],
      isoPt(-0.039, 0.016),
    ], 0.0044);

    // 5. Anglepoise desk lamp cord — exits flush from rear of lamp base (-1.22, sy+0.007, -1.132), clears rear desk edge cleanly!
    addAcCord([
      [-1.22, sy + 0.007, -1.132],
      [-1.215, sy + 0.005, -1.260],
      [-1.21, sy + 0.005, -1.368],
      [-1.20, sy + 0.002, -1.414],
      [-1.16, 0.716, -1.428],
      [-0.60, 0.680, -1.434],
      [0.32, 0.668, -1.436],
      [0.376, 0.320, -1.428],
      [0.368, 0.122, -1.380],
      isoPt(-0.039, -0.018),
    ], 0.0036);

    // 6. Tripp Lite ISOBAR8ULTRA heavy-duty 12 ft main power cord routing cleanly along floor to the flush wall duplex outlet!
    const cordStart = isoPt(-0.128, 0.0);
    cordStart[1] = isoY + 0.025;
    addAcCord([
      cordStart,
      [isoX - 0.165, 0.022, isoZ - 0.055],
      [isoX - 0.140, 0.021, -1.62],
      [0.44, 0.021, -2.18],
      [0.48, 0.024, -2.545],
      [0.48, 0.165, -2.572],
    ], 0.0062, false);
    // Crisp wall duplex AC outlet plate seated FLUSH against back wall (z = -2.600) + seated right-angle black NEMA plug!
    const wallOutlet = new THREE.Mesh(
      new RoundedBoxGeometry(0.072, 0.114, 0.010, 2, 0.002),
      new THREE.MeshStandardMaterial({ color: 0xe2dcd2, roughness: 0.65 })
    );
    wallOutlet.position.set(0.48, 0.18, -2.594);
    deskGroup.add(wallOutlet);
    const wallPlug = new THREE.Mesh(
      new RoundedBoxGeometry(0.026, 0.030, 0.024, 2, 0.004),
      acPlugMat
    );
    wallPlug.position.set(0.48, 0.165, -2.578);
    deskGroup.add(wallPlug);

    this._loadGLB('assets/models/anglepoise_lamp.glb', (lamp) => {
      lamp.traverse((obj) => {
        if (obj.isMesh && obj.material && obj.material.isMeshStandardMaterial) {
          // Satin warm brushed brass (prevents overexposed white specular glare on the articulated arm!)
          obj.material.envMapIntensity = 0.30;
          if (obj.material.metalness > 0.4) {
            obj.material.roughness = Math.max(obj.material.roughness, 0.42);
            obj.material.color.multiplyScalar(0.84);
          }
        }
      });
      lamp.position.set(-1.22, sy, -1.04);
      // Angled in 3/4 profile so iconic articulated parallel arms & chrome tension springs read clearly!
      lamp.rotation.y = 1.24;
      this._addContactShadow(deskGroup, -1.22, sy + 0.0008, -1.04, 0.26, 0.26, 0.90);
      deskGroup.add(lamp);
    });

    // Warm soft tungsten desk-lamp light pool on left walnut surface (matches cozy felixrieseberg.com lamp falloff!)
    const poolC = document.createElement('canvas');
    poolC.width = poolC.height = 128;
    const pctx = poolC.getContext('2d');
    const pg = pctx.createRadialGradient(64, 64, 4, 64, 64, 64);
    pg.addColorStop(0.0, 'rgba(255, 192, 108, 0.52)');
    pg.addColorStop(0.45, 'rgba(255, 168, 76, 0.24)');
    pg.addColorStop(1.0, 'rgba(255, 150, 60, 0.0)');
    pctx.fillStyle = pg;
    pctx.fillRect(0, 0, 128, 128);
    this.lampPoolMat = new THREE.MeshBasicMaterial({
      map: new THREE.CanvasTexture(poolC),
      transparent: true,
      opacity: 0.78,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -4,
      polygonOffsetUnits: -4,
    });
    const lampPool = new THREE.Mesh(new THREE.PlaneGeometry(0.96, 0.74), this.lampPoolMat);
    lampPool.rotation.x = -Math.PI / 2;
    lampPool.position.set(-1.08, sy + 0.0026, -0.76);
    lampPool.renderOrder = 3;
    deskGroup.add(lampPool);

    this._loadGLB('assets/models/coffee_mug.glb', (mug) => {
      mug.position.set(-1.06, sy, -0.58);
      mug.rotation.y = -0.65;
      this._addContactShadow(deskGroup, -1.06, sy + 0.0008, -0.58, 0.15, 0.15, 0.84);
      deskGroup.add(mug);
    });

    // Authentic Mathmos Astro Classic Lava Lamp (430 x 140 mm) between 8x DGX Spark stack & Corsair PC!
    const lavaX = 0.51;
    const lavaZ = -0.98;
    this._loadGLB('assets/models/lava_lamp.glb', (lava) => {
      lava.position.set(lavaX, sy, lavaZ);
      lava.traverse((obj) => {
        if (!obj.isMesh || !obj.material) return;
        const mName = obj.material.name || '';
        if (obj.material.map) {
          obj.material.map.anisotropy = this.renderer.capabilities.getMaxAnisotropy();
        }
        if (mName === 'LavaLamp_Glass') {
          obj.material = new THREE.MeshPhysicalMaterial({
            color: 0xfff8f5,
            transparent: true,
            opacity: 0.22,
            roughness: 0.05,
            metalness: 0.04,
            clearcoat: 1.0,
            clearcoatRoughness: 0.04,
            reflectivity: 0.95,
            envMapIntensity: 1.75,
            depthWrite: false,
          });
          obj.renderOrder = 6;
          obj.castShadow = false;
        } else if (mName === 'LavaLamp_Liquid') {
          obj.material.transparent = true;
          obj.material.opacity = 0.58;
          obj.material.roughness = 0.14;
          obj.material.emissiveIntensity = 0.62;
          obj.material.depthWrite = false;
          obj.material.side = THREE.FrontSide;
          obj.renderOrder = 4;
          obj.castShadow = false;
        } else if (mName.startsWith('LavaLamp_Wax')) {
          obj.material = obj.material.clone();
          obj.material.roughness = 0.30;
          obj.renderOrder = 2;
          obj.castShadow = false;
        } else if (mName === 'LavaLamp_SpunAlu') {
          obj.material.metalness = 0.90;
          obj.material.roughness = 0.25;
          obj.material.envMapIntensity = 1.2;
        } else if (mName === 'LavaLamp_BulbCore') {
          obj.renderOrder = 1;
        }
        if (obj.name.startsWith('LavaBlob_')) {
          const idx = parseInt(obj.name.split('_')[1], 10) || 0;
          this.lavaBlobs.push({
            obj,
            mat: obj.material,
            basePos: obj.position.clone(),
            phase: idx * 1.18 + 0.4,
            speed: 0.24 + (idx % 3) * 0.07,
            ampY: idx === 4 ? 0.018 : (idx === 5 ? 0.022 : 0.032),
            ampXZ: 0.0045,
          });
        }
      });
      this._addContactShadow(deskGroup, lavaX, sy + 0.0012, lavaZ, 0.175, 0.175, 0.90);
      deskGroup.add(lava);
    });

    // Warm molten amber-orange point light & soft localized desk halo radiating from the lava lamp
    this.lavaLight = new THREE.PointLight(0xff6b26, 0.72, 0.95, 2);
    this.lavaLight.position.set(lavaX, sy + 0.23, lavaZ);
    deskGroup.add(this.lavaLight);

    const lavaGlowC = document.createElement('canvas');
    lavaGlowC.width = lavaGlowC.height = 128;
    const lgctx = lavaGlowC.getContext('2d');
    const lgg = lgctx.createRadialGradient(64, 64, 6, 64, 64, 64);
    lgg.addColorStop(0.0, 'rgba(255, 118, 42, 0.48)');
    lgg.addColorStop(0.45, 'rgba(255, 84, 34, 0.20)');
    lgg.addColorStop(1.0, 'rgba(255, 64, 24, 0.0)');
    lgctx.fillStyle = lgg;
    lgctx.fillRect(0, 0, 128, 128);
    const lavaPool = new THREE.Mesh(
      new THREE.PlaneGeometry(0.44, 0.44),
      new THREE.MeshBasicMaterial({
        map: new THREE.CanvasTexture(lavaGlowC),
        transparent: true,
        opacity: 0.72,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        polygonOffset: true,
        polygonOffsetFactor: -4,
        polygonOffsetUnits: -4,
      })
    );
    lavaPool.rotation.x = -Math.PI / 2;
    lavaPool.position.set(lavaX, sy + 0.0022, lavaZ);
    lavaPool.renderOrder = 3;
    deskGroup.add(lavaPool);

    // 7. Lava Lamp AC power cord routing cleanly from rear base grommet into Tripp Lite ISOBAR8ULTRA
    addAcCord([
      [lavaX, sy + 0.011, lavaZ - 0.070],
      [lavaX + 0.01, sy + 0.008, -1.24],
      [lavaX, sy - 0.004, -1.408],
      [lavaX - 0.01, 0.675, -1.425],
      [lavaX - 0.02, 0.340, -1.410],
      [lavaX - 0.02, 0.130, -1.365],
      isoPt(0.068, 0.022),
    ], 0.0032);

    // 8. comma.ai Chestnut USB4 Type-C host cable + RTX 3090 12-pin / XT60i power loom!
    const egpuPt = (lx, ly, lz) => {
      const c = Math.cos(egpuRotY), s = Math.sin(egpuRotY);
      return [egpuX + lx * c + lz * s, sy + ly, egpuZ - lx * s + lz * c];
    };
    // Molded USB4 Type-C plug seated in Comma_USB4Port + braided black USB4 host cable curving to the workstation
    const usb4PlugPos = egpuPt(0.060, 0.0203, 0.044);
    const usb4Plug = new THREE.Mesh(new RoundedBoxGeometry(0.012, 0.007, 0.018, 2, 0.002), acPlugMat);
    usb4Plug.position.set(...usb4PlugPos);
    usb4Plug.rotation.y = egpuRotY;
    deskGroup.add(usb4Plug);
    addAcCord([
      egpuPt(0.060, 0.0203, 0.052),
      egpuPt(0.072, 0.015, 0.074),
      egpuPt(0.145, 0.006, 0.068),
      egpuPt(0.195, 0.005, 0.005),
      [0.645, sy + 0.005, -0.78],
      [0.635, sy + 0.005, -1.04],
      [0.665, sy + 0.022, -1.16],
    ], 0.0028, false);

    // RTX 3090 FE angled 12-pin top power cable + Chestnut yellow XT60i 12V cable bundling cleanly back to ISOBAR8ULTRA
    addAcCord([
      egpuPt(0.060, 0.181, 0.000),
      egpuPt(0.068, 0.197, -0.012),
      egpuPt(0.084, 0.172, -0.048),
      egpuPt(0.084, 0.092, -0.066),
      egpuPt(0.078, 0.022, -0.068),
      [0.605, sy + 0.007, -0.86],
      [0.588, sy + 0.006, -1.24],
      [0.578, sy + 0.003, -1.412],
      [0.558, 0.695, -1.428],
      [0.515, 0.340, -1.418],
      [0.505, 0.125, -1.365],
      isoPt(0.084, -0.018),
    ], 0.0040);
    addAcCord([
      egpuPt(0.066, 0.026, -0.027),
      egpuPt(0.072, 0.024, -0.048),
      egpuPt(0.078, 0.022, -0.068),
    ], 0.0034, false);

    this.scene.add(deskGroup);

    // Herman Miller Aeron Chair with clearly visible translucent woven Pellicle mesh & sculpted satin-graphite PostureFit frame!
    this._loadGLB('assets/models/aeron_chair.glb', (aeron) => {
      aeron.traverse((obj) => {
        if (!obj.isMesh || !obj.material) return;
        if (obj.material.name === 'Aeron_PellicleMesh') {
          obj.material.side = THREE.DoubleSide;
          obj.material.color.setHex(0x646e80);
          obj.material.emissive = new THREE.Color(0x242b36);
          obj.material.emissiveIntensity = 0.28;
          obj.material.transparent = true;
          obj.material.opacity = 0.92;
          obj.material.roughness = 0.64;
          obj.material.metalness = 0.08;
          obj.material.envMapIntensity = 0.50;
          obj.material.depthWrite = true;
          obj.castShadow = true;
        } else {
          // Satin graphite-metallic sculpted finish on spine, lumbar PostureFit pads & arm frames (eliminates flat dark blocks!)
          obj.material.color.setHex(0x2b303a);
          obj.material.roughness = 0.44;
          obj.material.metalness = 0.36;
          obj.material.envMapIntensity = 0.78;
        }
      });
      aeron.position.set(-0.92, 0, 0.34);
      aeron.rotation.y = Math.PI + 0.32;
      this._addContactShadow(this.scene, -0.92, 0.018, 0.34, 0.96, 0.96, 0.92);
      this.scene.add(aeron);
    });
  }

  // ---------- 6. True 34" 21:9 Curved Dell UltraSharp U3425WE Monitor + Glare-Free Live Omarchy Screen ----------
  _buildOmarchyMonitor() {
    const sy = 0.7718;
    const monGroup = new THREE.Group();
    monGroup.position.set(-0.62, sy, -1.14);

    this._loadGLB('assets/models/dell_u3425we.glb', (monModel) => {
      monModel.traverse((obj) => {
        if (obj.isMesh) {
          obj.userData.camPreset = 'monitor';
          this.clickableMeshes.push(obj);
        }
      });
      monGroup.add(monModel);
    });
    this._addContactShadow(monGroup, 0, 0.0016, -0.036, 0.33, 0.25, 0.92);

    // Exact 34" 21:9 ultrawide active display (800 x 336 mm) cleanly offset +4.2mm in front of curved Dell panel (ZERO Z-fighting!)
    const screenW = 0.798;
    const screenH = 0.334;
    const panelCenterY = 0.342;
    const curveR = 1.90;

    const screenGeo = new THREE.PlaneGeometry(screenW, screenH, 24, 1);
    const posAttr = screenGeo.attributes.position;
    for (let i = 0; i < posAttr.count; i++) {
      const x = posAttr.getX(i);
      const zCurve = (curveR - Math.sqrt(Math.max(0.01, curveR * curveR - x * x))) + 0.0044;
      posAttr.setZ(i, zCurve);
    }
    screenGeo.computeVertexNormals();

    // Self-luminous anti-glare IPS Omarchy display (ZERO lamp glare blowout & ZERO Z-fighting!)
    const screenMat = new THREE.MeshBasicMaterial({
      map: this.omarchyScreen.texture,
      toneMapped: true,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
    });
    const screenMesh = new THREE.Mesh(screenGeo, screenMat);
    screenMesh.position.set(0, panelCenterY, 0);
    screenMesh.userData.camPreset = 'monitor';
    this.clickableMeshes.push(screenMesh);
    monGroup.add(screenMesh);

    this.scene.add(monGroup);
  }

  // ---------- 7. Corsair 5000D Airflow + NVIDIA GeForce RTX 5090 Founders Edition ----------
  _buildCorsairRTX5090PC() {
    const sy = 0.7718;
    const pcGroup = new THREE.Group();
    pcGroup.position.set(0.86, sy, -0.96);
    pcGroup.rotation.y = 0.56;

    this._loadGLB('assets/models/corsair_rtx5090.glb', (pcModel) => {
      const maxAniso = this.renderer.capabilities.getMaxAnisotropy();
      pcModel.traverse((obj) => {
        if (!obj.isMesh) return;
        obj.userData.camPreset = 'pc';
        this.clickableMeshes.push(obj);

        const matName = obj.material?.name || '';
        if (obj.material?.map) {
          obj.material.map.anisotropy = maxAniso;
          obj.material.map.needsUpdate = true;
        }
        if (obj.material?.roughnessMap) {
          obj.material.roughnessMap.anisotropy = maxAniso;
          obj.material.roughnessMap.needsUpdate = true;
        }

        if (matName === 'Corsair_TemperedGlass') {
          const glassTex = createTemperedGlassTexture();
          glassTex.anisotropy = maxAniso;
          obj.material = new THREE.MeshPhysicalMaterial({
            map: glassTex,
            emissiveMap: glassTex,
            emissive: new THREE.Color(0xffe6c4),
            emissiveIntensity: 0.22,
            color: 0xffffff,
            side: THREE.DoubleSide,
            transparent: true,
            opacity: 0.90,
            roughness: 0.03,
            metalness: 0.06,
            ior: 1.52,
            reflectivity: 0.96,
            clearcoat: 1.0,
            clearcoatRoughness: 0.03,
            envMapIntensity: 1.35,
            depthWrite: false,
          });
          obj.renderOrder = 10;
          obj.castShadow = false;
        } else if (matName === 'FE_TitaniumExoskeleton' || matName === 'FE_XFrameBevel' || matName === 'FE_DarkSteelBracket') {
          obj.material.envMapIntensity = 0.72;
        } else if (matName === 'FE_PocketRecess' || matName === 'FE_PlugMoldedHousing') {
          obj.material.envMapIntensity = 0.12;
        } else if (matName === 'FE_AnodizedFin') {
          obj.material.envMapIntensity = 0.38;
        } else if (matName === 'FE_FanPolymer' || matName === 'FE_FanShroudRing') {
          obj.material.envMapIntensity = 0.74;
        } else if (matName === 'RTX5090_VLEDMat') {
          obj.material.transparent = true;
          obj.material.depthWrite = false;
          obj.material.side = THREE.DoubleSide;
          obj.material.polygonOffset = true;
          obj.material.polygonOffsetFactor = -2;
          obj.material.polygonOffsetUnits = -2;
          obj.renderOrder = 6;
          obj.castShadow = false;
        } else if (matName === 'AIO_BraidedHose') {
          obj.material.envMapIntensity = 0.22;
          obj.material.roughness = 0.84;
        } else if (matName === 'Corsair_RX120Blade') {
          obj.material.transparent = true;
          obj.material.opacity = 0.88;
          obj.material.side = THREE.DoubleSide;
          obj.material.depthWrite = false;
          obj.renderOrder = 4;
        } else if (matName === 'Corsair_TitanDomeGlass') {
          obj.material.transparent = true;
          obj.material.opacity = 0.34;
          obj.material.depthWrite = false;
          obj.renderOrder = 6;
        } else if (matName === 'RTX5090_SideLogoMat' || matName === 'RTX5090_TopLogoMat') {
          obj.material.transparent = true;
          obj.material.alphaTest = 0.04;
          obj.material.depthWrite = false;
          obj.material.polygonOffset = true;
          obj.material.polygonOffsetFactor = -2;
          obj.material.polygonOffsetUnits = -2;
          obj.renderOrder = 5;
          obj.castShadow = false;
        } else if (matName === 'Braided_Cable' || matName === 'Braided_CableGraphite' || matName === 'Corsair_RubberGrommet') {
          obj.castShadow = false;
          obj.material.envMapIntensity = 0.16;
        } else if (matName === 'Corsair_PSUTopVent' || matName === 'Corsair_RapidRouteMatte') {
          obj.material.envMapIntensity = 0.28;
        } else if (matName === 'RGB_Cyan' || matName === 'RGB_Mint') {
          this.pcEmissives.push({ mat: obj.material, phase: obj.position.y * 4.0 + obj.position.z * 2.0 });
        } else if (matName === 'Corsair_AirflowGrille' || matName === 'Corsair_TopAirflowGrille') {
          // Opaque cutout stamped steel with depthWrite:true so front RX120 fans stay strictly BEHIND the perforated steel mesh (ZERO clipping!)
          obj.material.side = THREE.DoubleSide;
          obj.material.transparent = false;
          obj.material.alphaTest = 0.46;
          obj.material.depthWrite = true;
          obj.renderOrder = 2;
        }

        // Register all 7 Corsair iCUE LINK RX120 case fans & both RTX 5090 FE axial fans for smooth, wagon-wheel-free live rotation!
        const objName = obj.name || '';
        if (objName.endsWith('_Blades')) {
          if (objName.startsWith('Fan_Front_') || objName === 'Fan_Rear_Blades') {
            this.spinningFans.push({ obj, axis: 'z', speed: objName === 'Fan_Rear_Blades' ? -7.8 : 7.2 + (this.spinningFans.length % 3) * 0.35 });
          } else if (objName.startsWith('Fan_Top_')) {
            this.spinningFans.push({ obj, axis: 'y', speed: 7.4 + (this.spinningFans.length % 3) * 0.3 });
          } else if (objName.startsWith('RTX5090_AxialFan_')) {
            this.spinningFans.push({ obj, axis: 'y', speed: objName.includes('_0_') ? 9.2 : -9.2 });
          }
        }
      });
      pcGroup.add(pcModel);
    });

    // Deep grounded contact shadow directly beneath the Corsair 5000D Airflow feet & belly + subtle cyan desk spill beside tempered glass!
    this._addContactShadow(pcGroup, 0, 0.0016, 0, 0.38, 0.64, 0.96);
    const pcSpillC = document.createElement('canvas');
    pcSpillC.width = pcSpillC.height = 128;
    const psc = pcSpillC.getContext('2d');
    const psg = psc.createRadialGradient(64, 64, 4, 64, 64, 64);
    psg.addColorStop(0.0, 'rgba(92, 212, 248, 0.18)');
    psg.addColorStop(0.5, 'rgba(72, 188, 232, 0.07)');
    psg.addColorStop(1.0, 'rgba(64, 176, 224, 0.0)');
    psc.fillStyle = psg;
    psc.fillRect(0, 0, 128, 128);
    const pcSpill = new THREE.Mesh(
      new THREE.PlaneGeometry(0.46, 0.58),
      new THREE.MeshBasicMaterial({
        map: new THREE.CanvasTexture(pcSpillC),
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        polygonOffset: true,
        polygonOffsetFactor: -4,
        polygonOffsetUnits: -4,
      })
    );
    pcSpill.rotation.x = -Math.PI / 2;
    pcSpill.position.set(-0.24, 0.0028, 0.02);
    pcSpill.renderOrder = 3;
    pcGroup.add(pcSpill);
    this.scene.add(pcGroup);
  }

  // ---------- 8. 8× Real NVIDIA DGX Spark + MikroTik CRS804-4DDQ-hRM ON THE DESK Alongside Monitor! ----------
  _buildDGXSparkClusterAndCRS804() {
    const sy = 0.7718;
    const deskCluster = new THREE.Group();

    // 1. MikroTik CRS804-4DDQ-hRM Switch sitting ON THE DESK immediately right of the Omarchy monitor!
    const swX = 0.00;
    const swZ = -1.04;
    this._addContactShadow(deskCluster, swX, sy + 0.0015, swZ, 0.27, 0.44, 0.92);

    this._loadGLB('assets/models/crs804.glb', (crsModel) => {
      crsModel.position.set(swX, sy, swZ);
      crsModel.traverse((obj) => {
        if (!obj.isMesh) return;
        obj.userData.camPreset = 'cluster';
        this.clickableMeshes.push(obj);
        if (obj.material?.name?.startsWith('CRS_LED_')) {
          obj.material = obj.material.clone();
          this.switchLeds.push({
            mat: obj.material,
            phase: obj.position.x * 18.0 + obj.position.z * 9.0,
            rate: 5.5 + (Math.abs(obj.position.x * 100) % 4) * 2.2,
          });
        }
      });
      deskCluster.add(crsModel);
    });

    // 2. Stack of 8× GB10 Nodes ON THE DESK right alongside the CRS804 & monitor:
    //    - Bottom 2 units (indices 0, 1): Stellar Grey ASUS Ascent GX10 (asus_gx10.glb)
    //    - Top 6 units (indices 2..7): Champagne-Gold NVIDIA DGX Spark (dgx_spark.glb) with front NVIDIA logo & per-unit varied metal foam!
    const sparkStepY = 0.0543;
    const stackX = 0.31;
    const stackZ = -1.08;
    this._addContactShadow(deskCluster, stackX, sy + 0.0015, stackZ, 0.22, 0.22, 0.95);

    const maxAniso = this.renderer.capabilities.getMaxAnisotropy();

    // Load 2× ASUS Ascent GX10 (Stellar Grey) at the base of the 8-node stack
    this._loadGLB('assets/models/asus_gx10.glb', (gxTemplate) => {
      for (let i = 0; i < 2; i++) {
        const unit = i === 0 ? gxTemplate : gxTemplate.clone(true);
        unit.position.set(stackX, sy + i * sparkStepY, stackZ);
        unit.traverse((obj) => {
          if (!obj.isMesh) return;
          obj.userData.camPreset = 'cluster';
          this.clickableMeshes.push(obj);
          if (obj.material?.map) {
            obj.material.map.anisotropy = maxAniso;
            obj.material.map.needsUpdate = true;
          }
          if (obj.material?.name === 'GX10_PowerLED') {
            obj.material = obj.material.clone();
            this.sparkLeds.push({ mat: obj.material, phase: i * 1.1 });
          }
        });
        deskCluster.add(unit);
      }
    });

    // Load 6× NVIDIA DGX Spark (Champagne Gold) stacked cleanly above the 2 ASUS Ascent GX10 units
    this._loadGLB('assets/models/dgx_spark.glb', (sparkTemplate) => {
      for (let i = 2; i < 8; i++) {
        const unit = i === 2 ? sparkTemplate : sparkTemplate.clone(true);
        unit.position.set(stackX, sy + i * sparkStepY, stackZ);
        unit.traverse((obj) => {
          if (!obj.isMesh) return;
          obj.userData.camPreset = 'cluster';
          this.clickableMeshes.push(obj);
          if (obj.material?.name === 'Spark_GoldTop') {
            obj.material.envMapIntensity = 0.72;
          }
          if (obj.material?.name === 'Spark_FrontNvidiaLogo' && obj.material.map) {
            obj.material.map.anisotropy = maxAniso;
            obj.material.map.needsUpdate = true;
          }
          if (obj.material?.name === 'Spark_GoldMetalFoam') {
            const m = obj.material.clone();
            const flipX = i % 2 === 1 ? -1 : 1;
            const flipY = i % 4 >= 2 ? -1 : 1;
            const uOff = ((i * 0.37) % 1);
            const vOff = ((i * 0.29) % 1);
            for (const key of ['map', 'normalMap', 'roughnessMap']) {
              if (m[key]) {
                m[key] = m[key].clone();
                m[key].wrapS = m[key].wrapT = THREE.RepeatWrapping;
                m[key].repeat.set(flipX, flipY);
                m[key].offset.set(uOff, vOff);
                m[key].needsUpdate = true;
              }
            }
            const tintShift = 0.94 + ((i * 37) % 11) * 0.012;
            m.color.setRGB(tintShift, tintShift * 0.98, tintShift * 0.94);
            m.needsUpdate = true;
            obj.material = m;
          }
        });
        deskCluster.add(unit);
      }
    });

    // 3. Authentic 4× 400G QSFP56-DD -> 8× 200GbE ConnectX-7 Passive Copper DAC Breakout Cables
    // Routed flat along the desk into a clean vertical rear spine BEHIND the DGX stack (ZERO spiky mid-air triangular web!)
    const qsfpLocalXs = [0.016, 0.042, 0.068, 0.094];
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x161a22, roughness: 0.36, metalness: 0.14 });
    const splitterMat = new THREE.MeshStandardMaterial({ color: 0x242a34, roughness: 0.34, metalness: 0.48 });
    const splitterBandMat = new THREE.MeshStandardMaterial({ color: 0x2c789a, roughness: 0.34, metalness: 0.26 });
    const bootMat = new THREE.MeshStandardMaterial({ color: 0x151820, roughness: 0.45 });
    const dacMats = [
      new THREE.MeshStandardMaterial({ color: 0x181c24, roughness: 0.36, metalness: 0.16 }),
      new THREE.MeshStandardMaterial({ color: 0x212732, roughness: 0.34, metalness: 0.18 }),
    ];

    // Clean non-overlapping contact AO shadows beneath staggered breakout pods & yellow uplink (stepped Y -> ZERO Z-fighting!)
    this._addContactShadow(deskCluster, 0.155, sy + 0.0012, swZ + 0.165, 0.19, 0.16, 0.90);
    this._addContactShadow(deskCluster, 0.185, sy + 0.0018, swZ - 0.04, 0.09, 0.34, 0.86);
    this._addContactShadow(deskCluster, swX - 0.154, sy + 0.0018, swZ + 0.00, 0.055, 0.44, 0.84);

    for (let p = 0; p < 4; p++) {
      const px = swX + qsfpLocalXs[p];
      const portExit = new THREE.Vector3(px, sy + 0.022, swZ + 0.206);
      const splitX = 0.140 + p * 0.015;
      const splitZ = swZ + 0.194 - p * 0.024;
      const splitPos = new THREE.Vector3(splitX, sy + 0.0080, splitZ);

      const trunkCurve = new THREE.CatmullRomCurve3([
        portExit,
        new THREE.Vector3(px + 0.006, sy + 0.017, swZ + 0.218 + (3 - p) * 0.003),
        new THREE.Vector3(px + 0.022 + p * 0.005, sy + 0.0095, swZ + 0.220 + (3 - p) * 0.003),
        splitPos,
      ]);
      const trunkMesh = new THREE.Mesh(new THREE.TubeGeometry(trunkCurve, 24, 0.0048, 12, false), trunkMat);
      trunkMesh.castShadow = true;
      deskCluster.add(trunkMesh);

      const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.0074, 0.0064, 0.028, 14), splitterMat);
      collar.rotation.x = Math.PI / 2;
      collar.rotation.z = -0.25;
      collar.position.copy(splitPos);
      collar.castShadow = true;
      deskCluster.add(collar);

      const band = new THREE.Mesh(new THREE.CylinderGeometry(0.0077, 0.0077, 0.005, 14), splitterBandMat);
      band.rotation.x = Math.PI / 2;
      band.rotation.z = -0.25;
      band.position.copy(splitPos);
      deskCluster.add(band);

      for (let sub = 0; sub < 2; sub++) {
        const nodeIdx = p * 2 + sub;
        const nodeY = sy + nodeIdx * sparkStepY + 0.021;
        const portX = stackX - (sub === 0 ? 0.042 : 0.060);
        const pEnd = new THREE.Vector3(portX, nodeY, stackZ - 0.077);

        // Flat along desk beside stack -> crisp centripetal vertical zip-tied harness strictly BEHIND back-left corner (z <= -1.170 -> ZERO chassis or desk clipping!)
        const laneX = 0.168 + p * 0.009 + sub * 0.0042;
        const deskY = sy + 0.0046 + sub * 0.0010;
        const spineX = stackX - 0.095 + (sub * 0.005);
        const spineZ = stackZ - 0.090 - p * 0.004;
        const leadPts = [
          splitPos,
          new THREE.Vector3(laneX, deskY, splitZ - 0.045),
          new THREE.Vector3(laneX + 0.008, deskY, stackZ + 0.01),
          new THREE.Vector3(spineX - 0.004, deskY + 0.003, stackZ - 0.068),
          new THREE.Vector3(spineX, deskY + 0.016, spineZ),
        ];
        if (nodeIdx >= 3) {
          leadPts.push(new THREE.Vector3(spineX, sy + (nodeY - sy) * 0.52, spineZ));
        }
        leadPts.push(
          new THREE.Vector3(spineX, Math.max(deskY + 0.018, nodeY - 0.008), spineZ),
          new THREE.Vector3(portX, nodeY, spineZ - 0.012),
          pEnd
        );
        const leadCurve = new THREE.CatmullRomCurve3(leadPts, false, 'centripetal', 0.5);

        const cableMesh = new THREE.Mesh(
          new THREE.TubeGeometry(leadCurve, 64, 0.0029, 10, false),
          dacMats[sub]
        );
        cableMesh.castShadow = true;
        deskCluster.add(cableMesh);

        const boot = new THREE.Mesh(new THREE.BoxGeometry(0.014, 0.009, 0.018), bootMat);
        boot.position.copy(pEnd).add(new THREE.Vector3(0, 0, -0.006));
        deskCluster.add(boot);
      }
    }
    // Three tidy matte-black velcro cable straps binding the vertical DAC spine behind the DGX stack
    const strapMat = new THREE.MeshStandardMaterial({ color: 0x101318, roughness: 0.85 });
    for (const strapY of [sy + 0.08, sy + 0.21, sy + 0.34]) {
      const strap = new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.011, 0.010, 14), strapMat);
      strap.position.set(stackX - 0.093, strapY, stackZ - 0.096);
      deskCluster.add(strap);
    }

    // Continuous Yellow 10GbE Cat6a management uplink cable: exits MikroTik CRS804 ETH1 front port ->
    // runs cleanly along desk & over the rear desk edge -> drops neatly alongside the power harness ->
    // glides continuously ON TOP of the rug & hardwood floor straight into the RJ45 wall jack (ZERO splits or floor clipping!)
    const eth1Pos = new THREE.Vector3(swX - 0.012, sy + 0.022, swZ + 0.197);
    const uplinkCurve = new THREE.CatmullRomCurve3([
      eth1Pos,
      new THREE.Vector3(swX - 0.032, sy + 0.011, swZ + 0.226),
      new THREE.Vector3(swX - 0.146, sy + 0.0045, swZ + 0.224),
      new THREE.Vector3(swX - 0.160, sy + 0.0040, swZ + 0.14),
      new THREE.Vector3(swX - 0.160, sy + 0.0040, swZ - 0.10),
      new THREE.Vector3(swX - 0.155, sy + 0.0040, -1.355),
      new THREE.Vector3(swX - 0.145, sy + 0.0025, -1.412),
      new THREE.Vector3(swX - 0.120, 0.710, -1.428),
      new THREE.Vector3(0.14, 0.675, -1.434),
      new THREE.Vector3(0.355, 0.655, -1.436),
      new THREE.Vector3(0.360, 0.360, -1.440),
      new THREE.Vector3(0.360, 0.095, -1.458),
      new THREE.Vector3(0.360, 0.024, -1.520),
      new THREE.Vector3(0.360, 0.016, -1.680),
      new THREE.Vector3(0.360, 0.014, -2.020),
      new THREE.Vector3(0.360, 0.014, -2.360),
      new THREE.Vector3(0.360, 0.022, -2.535),
      new THREE.Vector3(0.360, 0.095, -2.568),
      new THREE.Vector3(0.360, 0.175, -2.582),
    ], false, 'centripetal', 0.5);
    const uplinkMesh = new THREE.Mesh(
      new THREE.TubeGeometry(uplinkCurve, 148, 0.0032, 12, false),
      new THREE.MeshStandardMaterial({ color: 0xe6ad2e, roughness: 0.34, metalness: 0.06 })
    );
    uplinkMesh.castShadow = true;
    deskCluster.add(uplinkMesh);
    // Flush RJ45 Ethernet wall keystone jack plate tucked neatly beside the AC wall outlet!
    const ethWallPlate = new THREE.Mesh(
      new RoundedBoxGeometry(0.072, 0.114, 0.010, 2, 0.002),
      new THREE.MeshStandardMaterial({ color: 0xe2dcd2, roughness: 0.65 })
    );
    ethWallPlate.position.set(0.36, 0.18, -2.594);
    deskCluster.add(ethWallPlate);
    const ethWallPlug = new THREE.Mesh(
      new RoundedBoxGeometry(0.014, 0.014, 0.020, 2, 0.002),
      new THREE.MeshStandardMaterial({ color: 0xe6ad2e, roughness: 0.38 })
    );
    ethWallPlug.position.set(0.36, 0.175, -2.582);
    deskCluster.add(ethWallPlug);

    this.scene.add(deskCluster);

    // 4. Clean Minimalist Mid-Century Walnut Credenza on Right Wall (sculptural ceramic vases & art books, balancing the room!)
    const credGroup = new THREE.Group();
    credGroup.position.set(2.68, 0, -0.22);
    const credW = 0.56;
    const credH = 0.66;
    const credD = 1.44;
    const credPBR = createWoodPBR({
      base: '#5a3a22',
      grain: '#2f1b0d',
      plankLines: false,
      seed: 211,
      repeatX: 1.4,
      repeatY: 2.2,
      roughBase: 146,
    });
    const credWoodMat = new THREE.MeshStandardMaterial({
      map: credPBR.map,
      roughnessMap: credPBR.roughnessMap,
      bumpMap: credPBR.bumpMap,
      bumpScale: 0.006,
      roughness: 0.72,
    });
    const frameMat = new THREE.MeshStandardMaterial({
      color: 0x181c23,
      roughnessMap: this.brushedMetalTex,
      roughness: 0.44,
      metalness: 0.78,
    });

    const credTop = new THREE.Mesh(new RoundedBoxGeometry(credW, 0.036, credD, 3, 0.006), credWoodMat);
    credTop.position.set(0, credH, 0);
    credTop.castShadow = true;
    credTop.receiveShadow = true;
    credGroup.add(credTop);

    const credBody = new THREE.Mesh(new THREE.BoxGeometry(credW - 0.06, 0.42, credD - 0.08), frameMat);
    credBody.position.set(0, credH - 0.23, 0);
    credBody.castShadow = true;
    credBody.receiveShadow = true;
    credGroup.add(credBody);

    for (let i = 0; i < 3; i++) {
      const door = new THREE.Mesh(new RoundedBoxGeometry(0.018, 0.36, 0.40, 2, 0.003), credWoodMat);
      door.position.set(-credW / 2 + 0.018, credH - 0.23, -0.42 + i * 0.42);
      credGroup.add(door);
    }
    for (const lx of [-credW / 2 + 0.06, credW / 2 - 0.06]) {
      for (const lz of [-credD / 2 + 0.08, credD / 2 - 0.08]) {
        const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.014, 0.22, 10), frameMat);
        leg.position.set(lx, 0.11, lz);
        leg.castShadow = true;
        credGroup.add(leg);
      }
    }
    // Minimalist sculptural stoneware vase + art books on right credenza
    const credSurfY = credH + 0.018;
    const vase = new THREE.Mesh(
      new THREE.LatheGeometry(
        [
          new THREE.Vector2(0.052, 0),
          new THREE.Vector2(0.088, 0.11),
          new THREE.Vector2(0.068, 0.22),
          new THREE.Vector2(0.038, 0.29),
          new THREE.Vector2(0.048, 0.32),
        ],
        24
      ),
      new THREE.MeshStandardMaterial({ color: 0xd8cbb6, roughness: 0.46 })
    );
    vase.position.set(0, credSurfY, -0.24);
    vase.castShadow = true;
    credGroup.add(vase);

    const artBook = new THREE.Mesh(
      new RoundedBoxGeometry(0.28, 0.032, 0.36, 2, 0.003),
      new THREE.MeshStandardMaterial({ color: 0x243447, roughness: 0.72 })
    );
    artBook.position.set(-0.02, credSurfY + 0.016, 0.22);
    artBook.rotation.y = 0.06;
    artBook.castShadow = true;
    credGroup.add(artBook);

    this._addContactShadow(credGroup, 0, 0.003, 0, credW + 0.24, credD + 0.24, 0.54);
    this.scene.add(credGroup);
  }

  // ---------- 9. Subtle Volumetric Sunbeams & Soft Circular Upper-Window Dust Motes ----------
  _buildSunbeamsAndDust() {
    const beamC = document.createElement('canvas');
    beamC.width = 64;
    beamC.height = 256;
    const bctx = beamC.getContext('2d');
    const g = bctx.createLinearGradient(0, 0, 0, 256);
    g.addColorStop(0, 'rgba(255, 220, 170, 0.0)');
    g.addColorStop(0.2, 'rgba(255, 220, 170, 0.65)');
    g.addColorStop(0.75, 'rgba(255, 220, 170, 0.14)');
    g.addColorStop(1, 'rgba(255, 220, 170, 0.0)');
    bctx.fillStyle = g;
    bctx.fillRect(0, 0, 64, 256);

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
      color: 0xffcf90,
      transparent: true,
      opacity: 0.036,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    });

    for (const bx of [-1.55, -0.15, 1.25]) {
      const beam = new THREE.Mesh(new THREE.PlaneGeometry(1.25, 3.6), this.beamMat);
      beam.position.set(bx + 0.30, 1.48, -1.35);
      beam.rotation.x = -0.68;
      beam.rotation.y = 0.22;
      this.sunBeams.push(beam);
      this.scene.add(beam);
    }
    // NOTE: Removed floating dust point sprites so zero artificial white orbs ever appear over the window skyline!
    this.dustPoints = null;
  }

  // ---------- Sky Mood Switching ----------
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

    if (this.skylineMat && this.skylineTextures[m.id]) {
      const tex = this.skylineTextures[m.id];
      this.skylineMat.map = tex;
      this.skylineMat.color.setHex(m.skylineTint || 0xffffff);
      const ready = Boolean(tex.image && tex.image.width > 0);
      this.skylineMat.opacity = ready ? 1.0 : 0.0;
      this.skylineMat.transparent = !ready;
      this.skylineMat.needsUpdate = true;
    }

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
    if (this.lampGlowBounce) this.lampGlowBounce.intensity = m.lampBounce || 0.48;
    if (this.lampPoolMat) this.lampPoolMat.opacity = m.id === 'day' ? 0.22 : (m.id === 'twilight' ? 0.85 : 0.72);
    if (this.curtainMats) {
      const ci = m.id === 'twilight' ? 0.15 : 0.20;
      for (const cm of this.curtainMats) cm.emissiveIntensity = ci;
    }
    if (this.roomBounceLight) this.roomBounceLight.intensity = m.bounceIntensity;
    this.renderer.toneMappingExposure = m.exposure;

    if (this.beamMat) {
      this.beamMat.color.setHex(m.dirLightColor);
      this.beamMat.opacity = m.beamOpacity;
    }
    if (this.blueAngels) {
      this.blueAngels.applySkyMood(m.id);
    }

    this._updateEnvironmentMap(m);
    return m;
  }

  nextSkyMood() {
    return this.applySkyMood(this.moodIndex + 1);
  }

  toggleJetAudio() {
    return this.blueAngelsAudio ? this.blueAngelsAudio.toggle() : false;
  }

  goToPreset(name) {
    const preset = CAMERA_PRESETS[name];
    if (!preset) return;
    this.animatingCam = {
      startPos: this.camera.position.clone(),
      endPos: new THREE.Vector3(...preset.pos),
      startTarget: this.controls.target.clone(),
      endTarget: new THREE.Vector3(...preset.target),
      startMs: performance.now(),
      duration: 0.72,
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
    const aspect = w / h;
    this.camera.aspect = aspect;
    // On portrait phones (aspect < 0.95), gently widen vertical FOV so the full desk & window stay comfortably framed
    this.camera.fov = aspect < 0.95 ? Math.min(64, 41 / Math.pow(aspect, 0.42)) : 41;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h, false);
    if (this.composer) {
      this.composer.setSize(w, h);
    }
    if (this.bloomPass) {
      this.bloomPass.setSize(w, h);
      // Avoid HalfFloat odd-height mip bloom artifacts on very short landscape mobile viewports
      this.bloomPass.enabled = h >= 440;
    }
  }

  renderFrame() {
    if (this.composer) {
      this.composer.render();
    } else {
      this.renderer.render(this.scene, this.camera);
    }
  }

  start() {
    const tick = () => {
      this._rafId = requestAnimationFrame(tick);
      const dt = Math.min(this.clock.getDelta(), 0.05);
      const elapsed = this.clock.elapsedTime;

      this.skyUniforms.uTime.value = elapsed;

      if (this.animatingCam) {
        const k = Math.min(1, (performance.now() - this.animatingCam.startMs) / (this.animatingCam.duration * 1000));
        const ease = k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
        this.camera.position.lerpVectors(this.animatingCam.startPos, this.animatingCam.endPos, ease);
        this.controls.target.lerpVectors(this.animatingCam.startTarget, this.animatingCam.endTarget, ease);
        if (k >= 1) this.animatingCam = null;
      }

      this.controls.update();

      for (const item of this.pcEmissives) {
        const hue = (0.50 + Math.sin(elapsed * 0.45 + item.phase) * 0.08 + 1) % 1;
        item.mat.emissive.setHSL(hue, 0.78, 0.54);
      }
      for (const fan of this.spinningFans) {
        fan.obj.rotation[fan.axis] += dt * fan.speed;
      }
      for (const b of this.lavaBlobs) {
        const s = Math.sin(elapsed * b.speed + b.phase);
        const c = Math.cos(elapsed * b.speed * 0.7 + b.phase);
        const ny = Math.max(0.188, Math.min(0.354, b.basePos.y + s * b.ampY));
        // Gently tighten radial wander as a blob rises into the narrower upper glass cone
        const heightFrac = Math.max(0, Math.min(1, (ny - 0.18) / 0.18));
        const radialScale = 1.0 - heightFrac * 0.36;
        b.obj.position.set(
          b.basePos.x * radialScale + c * b.ampXZ,
          ny,
          b.basePos.z * radialScale + Math.sin(elapsed * b.speed * 0.55 + b.phase * 1.4) * b.ampXZ
        );
        // Volume-preserving organic fluid stretch & squash
        const stretch = 1.0 + Math.sin(elapsed * b.speed * 1.6 + b.phase) * 0.09;
        const inv = 1.0 / Math.sqrt(stretch);
        b.obj.scale.set(inv, stretch, inv);
        // Hotter molten tangerine glow near the bottom bulb, deeper ruby-orange higher up
        if (b.mat && b.mat.emissiveIntensity !== undefined) {
          b.mat.emissiveIntensity = 0.72 + (1.0 - heightFrac) * 0.58;
        }
      }
      if (this.lavaLight) {
        this.lavaLight.intensity = 0.72 + Math.sin(elapsed * 0.9) * 0.06;
      }
      if (this.pcRgbLight) {
        this.pcRgbLight.color.setHex(0x5ad8fc);
      }

      for (const s of this.sparkLeds) {
        s.mat.emissiveIntensity = 1.6 + Math.sin(elapsed * 2.8 + s.phase) * 0.6;
      }

      for (const l of this.switchLeds) {
        const blink = Math.sin(elapsed * l.rate + l.phase) > -0.25 ? 2.4 : 0.45;
        l.mat.emissiveIntensity = blink;
      }

      if (this.dustPoints) {
        const pos = this.dustPoints.geometry.attributes.position;
        for (let i = 0; i < pos.count; i++) {
          let y = pos.getY(i) + dt * 0.010;
          if (y > 2.6) y = 1.55;
          pos.setY(i, y);
        }
        pos.needsUpdate = true;
      }

      if (this.omarchyScreen) {
        this.omarchyScreen.tick(elapsed);
      }

      if (this.blueAngels) {
        this.blueAngels.update(dt);
        if (this.blueAngelsAudio) {
          this.blueAngelsAudio.update(this.blueAngels.getAudioMetrics(), dt);
        }
      }

      this.renderFrame();
    };
    tick();
  }
}
