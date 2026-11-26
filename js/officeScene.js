import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RectAreaLightUniformsLib } from 'three/addons/lights/RectAreaLightUniformsLib.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

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
    pos: [0.54, 1.44, -0.10],
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
    dirLightIntensity: 2.15,
    portalColor: 0xffd7a8,
    portalIntensity: 0.52,
    hemiSky: 0xffe2be,
    hemiGround: 0x4e3522,
    hemiIntensity: 0.78,
    lampIntensity: 13.0,
    lampBounce: 1.55,
    pendantIntensity: 0.68,
    bounceIntensity: 1.15,
    beamOpacity: 0.036,
    exposure: 1.03,
    envIntensity: 0.88,
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
    sunDir: new THREE.Vector3(0.24, 0.06, -0.96).normalize(),
    dirLightColor: 0xffa870,
    dirLightIntensity: 1.08,
    portalColor: 0x8eaad6,
    portalIntensity: 0.28,
    hemiSky: 0x8aa2cc,
    hemiGround: 0x523622,
    hemiIntensity: 0.68,
    lampIntensity: 14.5,
    lampBounce: 1.72,
    pendantIntensity: 0.92,
    bounceIntensity: 1.28,
    beamOpacity: 0.014,
    exposure: 1.02,
    envIntensity: 0.74,
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

// Tactile matte architectural Venetian/limewash plaster (multi-scale organic mottling + fine mineral grain!)
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

  // Soft broad limewash trowel clouds (architectural tonal richness, zero flat CG look!)
  for (let i = 0; i < 64; i++) {
    const x = rng() * size;
    const y = rng() * size;
    const r = 48 + rng() * 115;
    const bright = rng() > 0.48;
    const g = ctx.createRadialGradient(x, y, 4, x, y, r);
    g.addColorStop(0, bright ? 'rgba(255, 246, 232, 0.075)' : 'rgba(68, 48, 34, 0.085)');
    g.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);

    const bg = bctx.createRadialGradient(x, y, 4, x, y, r);
    bg.addColorStop(0, bright ? 'rgba(170,170,170,0.12)' : 'rgba(90,90,90,0.12)');
    bg.addColorStop(1, 'rgba(128,128,128,0)');
    bctx.fillStyle = bg;
    bctx.fillRect(0, 0, size, size);
  }
  // Fine subtle plaster aggregate grain
  const imgCol = ctx.getImageData(0, 0, size, size);
  const imgBmp = bctx.getImageData(0, 0, size, size);
  for (let i = 0; i < size * size; i++) {
    const n = (rng() - 0.5) * 10;
    const idx = i * 4;
    imgCol.data[idx] = THREE.MathUtils.clamp(imgCol.data[idx] + n, 0, 255);
    imgCol.data[idx + 1] = THREE.MathUtils.clamp(imgCol.data[idx + 1] + n, 0, 255);
    imgCol.data[idx + 2] = THREE.MathUtils.clamp(imgCol.data[idx + 2] + n, 0, 255);
    const bv = THREE.MathUtils.clamp(imgBmp.data[idx] + n * 2.4, 0, 255);
    imgBmp.data[idx] = imgBmp.data[idx + 1] = imgBmp.data[idx + 2] = bv;
  }
  ctx.putImageData(imgCol, 0, 0);
  bctx.putImageData(imgBmp, 0, 0);

  const map = new THREE.CanvasTexture(colC);
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = map.wrapT = THREE.RepeatWrapping;
  map.repeat.set(2.5, 1.5);
  map.anisotropy = 8;
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
  // NOTE: On Case_TemperedGlass, glTF UV y=0 is TOP of glass (canvas y=H is TOP in flipY=false glTF!) ->
  // place subtle crisp diagonal golden-hour reflection in UPPER glass (y = 0.55H..0.95H) so lower PSU shroud stays 100% crystal clear with ZERO milky haze or dark shadow bar!
  ctx.fillStyle = 'rgba(8, 12, 18, 0.14)';
  ctx.fillRect(0, 0, W, H);
  // Crisp matte-black silkscreened ceramic frit perimeter border
  ctx.strokeStyle = 'rgba(4, 6, 9, 0.99)';
  ctx.lineWidth = 30;
  ctx.strokeRect(15, 15, W - 30, H - 30);
  // Subtle crisp inner glass bevel hairline & emerald leading glass thickness highlight
  ctx.strokeStyle = 'rgba(165, 184, 204, 0.36)';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(31, 31, W - 62, H - 62);
  ctx.fillStyle = 'rgba(144, 218, 200, 0.52)';
  ctx.fillRect(W - 4, 16, 4, H - 32);

  // Clean sharp diagonal Fresnel reflection streak in UPPER tempered glass ONLY (NO dark bar, NO lower haze!)
  ctx.save();
  ctx.beginPath();
  ctx.rect(32, 32, W - 64, H - 64);
  ctx.clip();
  ctx.translate(W * 0.38, H * 0.74);
  ctx.rotate(0.42);
  const gBand1 = ctx.createLinearGradient(0, -54, 0, 54);
  gBand1.addColorStop(0.0, 'rgba(255, 236, 208, 0.0)');
  gBand1.addColorStop(0.35, 'rgba(255, 236, 208, 0.24)');
  gBand1.addColorStop(0.50, 'rgba(255, 246, 230, 0.42)');
  gBand1.addColorStop(0.65, 'rgba(255, 236, 208, 0.22)');
  gBand1.addColorStop(1.0, 'rgba(255, 236, 208, 0.0)');
  ctx.fillStyle = gBand1;
  ctx.fillRect(-W, -54, W * 2, 108);

  const gBand2 = ctx.createLinearGradient(0, 74, 0, 128);
  gBand2.addColorStop(0.0, 'rgba(255, 234, 204, 0.0)');
  gBand2.addColorStop(0.50, 'rgba(255, 242, 222, 0.26)');
  gBand2.addColorStop(1.0, 'rgba(255, 234, 204, 0.0)');
  ctx.fillStyle = gBand2;
  ctx.fillRect(-W, 74, W * 2, 54);
  ctx.restore();

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function createWindowGlassReflectionTexture() {
  const W = 512;
  const H = 256;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const ctx = c.getContext('2d');
  // Subtle optical window glass haze + warm golden interior reflections & faint atmospheric dust sheen!
  ctx.fillStyle = 'rgba(248, 232, 212, 0.12)';
  ctx.fillRect(0, 0, W, H);
  const g = ctx.createLinearGradient(0, 0, W, H);
  g.addColorStop(0.0, 'rgba(255, 216, 168, 0.34)');
  g.addColorStop(0.24, 'rgba(255, 236, 208, 0.10)');
  g.addColorStop(0.48, 'rgba(255, 224, 184, 0.24)');
  g.addColorStop(0.76, 'rgba(216, 230, 248, 0.08)');
  g.addColorStop(1.0, 'rgba(255, 216, 174, 0.30)');
  ctx.fillStyle = g;
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

    this.brushedMetalTex = createBrushedMetalMap(33);
    this.contactShadowTex = createContactShadowTexture();

    this.skylineTextures = {};
    this.skylineMat = null;
    this.sparkLeds = [];
    this.switchLeds = [];
    this.pcEmissives = [];
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
    this.camera = new THREE.PerspectiveCamera(41, w / h, 0.05, 340);

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
      // Restrained photographic bloom (high threshold 1.48 eliminates any specular blowout patches!)
      this.bloomPass = new UnrealBloomPass(new THREE.Vector2(w, h), 0.12, 0.42, 1.48);
      this.composer.addPass(this.bloomPass);
      this.composer.addPass(new OutputPass());
    } catch {
      this.composer = null;
    }
  }

  // Helper to load a real-world Blender .glb model cleanly with shadow setup & crisp metallic IBL (100% live Three.js rendering!)
  _loadGLB(url, onLoaded) {
    this.gltfLoader.load(
      url,
      (gltf) => {
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
        onLoaded(root);
      },
      undefined,
      (err) => {
        console.warn(`Failed to load GLB ${url}:`, err);
      }
    );
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
      })
    );
    m.rotation.x = -Math.PI / 2;
    m.position.set(x, y, z);
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

    // Preload all 3 ultra-photorealistic 16th-floor panoramic city vistas (Golden Hour, Twilight City, Morning Light)
    for (const mood of SKY_MOODS) {
      const tex = this.texLoader.load(mood.skylineUrl);
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.anisotropy = 16;
      tex.minFilter = THREE.LinearMipmapLinearFilter;
      tex.magFilter = THREE.LinearFilter;
      this.skylineTextures[mood.id] = tex;
    }

    // Large curved panoramic photographic cyclorama extended cleanly WELL ABOVE the upper window sightline (ZERO curved top rim!)
    const panoR = 32.0;
    const arc = Math.PI * 0.58;
    const cylGeo = new THREE.CylinderGeometry(panoR, panoR, 27.5, 72, 1, true, Math.PI - arc * 0.5, arc);
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
      roughBase: 128,
      size: 1024,
    });
    const floorMat = new THREE.MeshStandardMaterial({
      map: floorPBR.map,
      roughnessMap: floorPBR.roughnessMap,
      bumpMap: floorPBR.bumpMap,
      bumpScale: 0.012,
      roughness: 0.58,
      metalness: 0.02,
      envMapIntensity: 0.45,
    });
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(W, D), floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(0, 0, 0.1);
    floor.receiveShadow = true;
    this.scene.add(floor);

    const rugPBR = createRugPBR();
    const rugMat = new THREE.MeshStandardMaterial({
      map: rugPBR.map,
      bumpMap: rugPBR.bumpMap,
      bumpScale: 0.016,
      roughness: 0.94,
    });
    const rug = new THREE.Mesh(new RoundedBoxGeometry(3.38, 0.016, 2.38, 2, 0.005), rugMat);
    rug.position.set(-0.14, 0.008, -0.35);
    rug.receiveShadow = true;
    this.scene.add(rug);
    this._addContactShadow(this.scene, -0.14, 0.0018, -0.35, 3.54, 2.54, 0.52);

    // Warm matte architectural Venetian plaster walls with restrained envMap + corner AO depth!
    const wallPBR = createPlasterPBR('#dfd3c0', 71);
    const wallMat = new THREE.MeshStandardMaterial({
      map: wallPBR.map,
      bumpMap: wallPBR.bumpMap,
      bumpScale: 0.008,
      roughness: 0.94,
      envMapIntensity: 0.18,
    });

    const leftWall = new THREE.Mesh(new THREE.PlaneGeometry(D, H), wallMat);
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

    const ceilMat = new THREE.MeshStandardMaterial({ color: 0xe9e1d5, roughness: 0.92 });
    const ceiling = new THREE.Mesh(new THREE.PlaneGeometry(W, D), ceilMat);
    ceiling.rotation.x = Math.PI / 2;
    ceiling.position.set(0, H, 0.1);
    this.scene.add(ceiling);

    // Back wall framing the panoramic window aperture
    const winWallMat = new THREE.MeshStandardMaterial({
      map: wallPBR.map,
      bumpMap: wallPBR.bumpMap,
      bumpScale: 0.003,
      color: 0xd8cab6,
      roughness: 0.92,
    });
    const wallThick = 0.24;
    const zBack = -2.6 - wallThick * 0.5;
    const addWallBlock = (w, h, x, y) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, wallThick), winWallMat);
      m.position.set(x, y, zBack);
      m.castShadow = true;
      m.receiveShadow = true;
      this.scene.add(m);
    };
    addWallBlock(0.65, H, -3.2 + 0.325, H / 2);
    addWallBlock(0.95, H, 2.25 + 0.475, H / 2);
    addWallBlock(4.8, 0.58, -0.15, 0.29);
    addWallBlock(4.8, 0.28, -0.15, 2.96);

    // Rich warm walnut architectural window mullions (warm wood grain & interior bounce — NEVER crushed pitch-black!)
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
      bumpScale: 0.008,
      roughness: 0.56,
      metalness: 0.04,
      emissive: new THREE.Color(0x28160a),
      emissiveIntensity: 0.45,
    });
    const addMullion = (w, h, d, x, y, z) => {
      const m = new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 2, 0.004), winWoodMat);
      m.position.set(x, y, z);
      m.castShadow = true;
      m.receiveShadow = true;
      this.scene.add(m);
    };
    const wz = -2.68;
    addMullion(4.84, 0.076, 0.18, -0.15, 2.82, wz);
    addMullion(4.84, 0.076, 0.18, -0.15, 0.58, wz);
    addMullion(0.076, 2.28, 0.18, -2.55, 1.7, wz);
    addMullion(0.076, 2.28, 0.18, 2.25, 1.7, wz);
    addMullion(0.056, 2.22, 0.14, -0.95, 1.7, wz);
    addMullion(0.056, 2.22, 0.14, 0.65, 1.7, wz);
    addMullion(4.80, 0.052, 0.13, -0.15, 2.22, wz);

    // Stepped recessed interior wooden sash stop-beads catching warm golden rim highlights (architectural depth like felixrieseberg.com!)
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
    addRimBead(0.016, 2.20, 0.04, -0.916, 1.7, wz + 0.06);
    addRimBead(0.016, 2.20, 0.04, 0.684, 1.7, wz + 0.06);
    addRimBead(4.78, 0.016, 0.04, -0.15, 2.252, wz + 0.055);
    addRimBead(4.78, 0.016, 0.04, -0.15, 2.780, wz + 0.07);

    // Architectural reflective window glass sheet (MeshBasicMaterial -> silky warm interior glass reflection & subtle optical haze with ZERO harsh point-light white orbs!)
    const winGlass = new THREE.Mesh(
      new THREE.PlaneGeometry(4.76, 2.20),
      new THREE.MeshBasicMaterial({
        map: createWindowGlassReflectionTexture(),
        color: 0xffffff,
        transparent: true,
        opacity: 0.44,
        depthWrite: false,
      })
    );
    winGlass.position.set(-0.15, 1.70, wz + 0.02);
    this.scene.add(winGlass);

    // Deep matte oiled walnut window sill (roughness 0.95 & low envMapIntensity -> ZERO blown-out white specular strip!)
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
    const sill = new THREE.Mesh(new RoundedBoxGeometry(4.92, 0.040, 0.32, 2, 0.006), sillMat);
    sill.position.set(-0.15, 0.598, -2.62);
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
      const bracket = new THREE.Mesh(new THREE.BoxGeometry(0.022, 0.042, 0.34), brassMat);
      bracket.position.set(bx, 2.86, -2.43);
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
          obj.material.emissive = new THREE.Color(0x52341a);
          obj.material.emissiveIntensity = 0.18;
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
      slat.position.set(-3.168, 1.48, -2.38 + i * 0.066);
      slat.castShadow = true;
      slat.receiveShadow = true;
      this.scene.add(slat);
    }

    // Crisp baseboards
    const trimMat = new THREE.MeshStandardMaterial({ color: 0xdfd6c7, roughness: 0.58 });
    const addBaseboard = (w, h, d, x, y, z) => {
      const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), trimMat);
      b.position.set(x, y, z);
      b.receiveShadow = true;
      this.scene.add(b);
    };
    addBaseboard(0.024, 0.11, D, -3.188, 0.055, 0.1);
    addBaseboard(0.024, 0.11, D, 3.188, 0.055, 0.1);
    addBaseboard(W, 0.11, 0.024, 0, 0.055, -2.588);

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
      const ring = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.085, 0.015, 20), fixtureMat);
      ring.position.set(dx, H - 0.008, dz);
      this.scene.add(ring);
      const lens = new THREE.Mesh(new THREE.CylinderGeometry(0.058, 0.058, 0.01, 20), glowBulbMat);
      lens.position.set(dx, H - 0.014, dz);
      this.scene.add(lens);
    }

    const pendantGroup = new THREE.Group();
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

    // Subtle warm gallery wall-wash near right wall illuminating the matte SIGNAL / NOISE print naturally!
    this.posterAccentLight = new THREE.PointLight(0xffd29a, 0.34, 2.2, 1.8);
    this.posterAccentLight.position.set(2.38, 1.98, -1.96);
    this.scene.add(this.posterAccentLight);

    // Restrained moody interior PC accent light (preserves deep shadow contrast & metallic highlights!)
    this.pcRgbLight = new THREE.PointLight(0xc2dcf0, 0.15, 0.56, 2.2);
    this.pcRgbLight.position.set(0.84, 1.08, -0.94);
    this.scene.add(this.pcRgbLight);
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
            new THREE.MeshStandardMaterial({ color: si % 2 === 0 ? 0xd9cbb8 : 0x395853, roughness: 0.42 })
          );
          vase.position.set(cursorX + 0.11, baseY, 0.02);
          vase.castShadow = true;
          shelfGroup.add(vase);
          cursorX += 0.24;
          continue;
        }
        const bw = 0.024 + rng() * 0.026;
        const bh = 0.21 + rng() * 0.11;
        const bd = 0.19 + rng() * 0.06;
        const col = bookColors[Math.floor(rng() * bookColors.length)];
        const book = new THREE.Mesh(
          new THREE.BoxGeometry(bw, bh, bd),
          new THREE.MeshStandardMaterial({ color: col, roughness: 0.78 })
        );
        book.position.set(cursorX + bw / 2, baseY + bh / 2, (rng() - 0.5) * 0.03);
        book.rotation.z = (rng() - 0.5) * 0.04;
        book.castShadow = true;
        book.receiveShadow = true;
        shelfGroup.add(book);
        cursorX += bw + 0.005;
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
          emissiveMap: createWallArtTexture(variant),
          emissive: new THREE.Color(0xffffff),
          emissiveIntensity: variant === 1 ? 0.06 : 0.04,
          roughness: 0.68,
        })
      );
      art.position.z = 0.015;
      g.add(art);
      g.position.set(x, y, z);
      g.rotation.y = rotY;
      this.scene.add(g);
    };
    addFramedArt(-3.17, 1.78, -1.62, Math.PI / 2, 0.58, 0.72, 0);
    // Iconic cobalt-blue SIGNAL / NOISE poster cleanly visible & 100% unobstructed between right curtain and right viewport edge!
    addFramedArt(2.64, 1.72, -2.56, 0, 0.36, 0.46, 1);

    // Organic Blender Fiddle-Leaf Fig in Terracotta Planter with subtle warm backlit botanical leaf translucency!
    this._loadGLB('assets/models/fiddle_fig.glb', (fig) => {
      fig.traverse((obj) => {
        if (obj.isMesh && obj.material && obj.material.name?.startsWith('Fig_Leaf')) {
          obj.material.emissive = new THREE.Color(0x284816);
          obj.material.emissiveIntensity = 0.24;
          obj.material.roughness = 0.54;
        }
      });
      fig.position.set(-1.98, 0, -1.48);
      fig.rotation.y = 0.55;
      this._addContactShadow(this.scene, -1.98, 0.003, -1.48, 0.72, 0.72, 0.76);
      this.scene.add(fig);
    });

    // Blender-Sculpted Organic Sansevieria (Snake Plant) in Ribbed Ceramic Planter cleanly inside right viewport!
    this._loadGLB('assets/models/snake_plant.glb', (snake) => {
      snake.position.set(2.22, 0, -1.52);
      snake.rotation.y = -0.35;
      this._addContactShadow(this.scene, 2.22, 0.003, -1.52, 0.58, 0.58, 0.72);
      this.scene.add(snake);
    });
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

    // Rich oiled dark American walnut tabletop (high-res wood pores + directional satin roughness, zero glare blowout!)
    const walnutPBR = createWoodPBR({
      base: '#3d2313',
      grain: '#170a04',
      plankLines: false,
      seed: 108,
      repeatX: 2.2,
      repeatY: 1.1,
      roughBase: 165,
      size: 1024,
    });
    const walnutMat = new THREE.MeshStandardMaterial({
      map: walnutPBR.map,
      roughnessMap: walnutPBR.roughnessMap,
      bumpMap: walnutPBR.bumpMap,
      bumpScale: 0.024,
      roughness: 0.74,
      metalness: 0.01,
      envMapIntensity: 0.24,
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

    // Uplift V2 T-frame standing desk legs
    for (const lx of [deskX - deskW / 2 + 0.14, deskX + deskW / 2 - 0.14]) {
      const colLower = new THREE.Mesh(new RoundedBoxGeometry(0.068, 0.40, 0.068, 2, 0.004), metalMat);
      colLower.position.set(lx, 0.22, deskZ);
      colLower.castShadow = true;
      deskGroup.add(colLower);

      const colUpper = new THREE.Mesh(new RoundedBoxGeometry(0.056, 0.34, 0.056, 2, 0.004), metalMat);
      colUpper.position.set(lx, 0.56, deskZ);
      colUpper.castShadow = true;
      deskGroup.add(colUpper);

      const footBar = new THREE.Mesh(new RoundedBoxGeometry(0.068, 0.028, deskD - 0.18, 2, 0.005), metalMat);
      footBar.position.set(lx, 0.018, deskZ);
      footBar.castShadow = true;
      deskGroup.add(footBar);

      this._addContactShadow(deskGroup, lx, 0.018, deskZ, 0.32, deskD + 0.02, 0.86);
    }
    // Deep, soft ambient occlusion shadow cast by the 2.52m solid walnut desktop onto the rug & floor beneath it!
    this._addContactShadow(deskGroup, deskX, 0.0175, deskZ + 0.04, deskW + 0.24, deskD + 0.34, 0.78);
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

    // Blender Real Peripherals (Keychron Q1 Pro, Logitech MX Master 3S, Anglepoise Type 75, Ceramic Mug — NO speakers!)
    this._loadGLB('assets/models/keychron_q1.glb', (kb) => {
      kb.position.set(-0.68, sy + 0.0045, -0.72);
      this._addContactShadow(deskGroup, -0.68, sy + 0.0048, -0.72, 0.36, 0.18, 0.82);
      deskGroup.add(kb);
    });

    this._loadGLB('assets/models/mx_master_3s.glb', (mouse) => {
      mouse.position.set(-0.30, sy + 0.0045, -0.71);
      mouse.rotation.y = -0.06;
      this._addContactShadow(deskGroup, -0.30, sy + 0.0048, -0.71, 0.12, 0.16, 0.78);
      deskGroup.add(mouse);
    });

    this._loadGLB('assets/models/anglepoise_lamp.glb', (lamp) => {
      lamp.traverse((obj) => {
        if (obj.isMesh && obj.material && obj.material.isMeshStandardMaterial) {
          obj.material.envMapIntensity = 0.55;
        }
      });
      lamp.position.set(-1.22, sy, -1.04);
      // Angled in 3/4 profile so iconic articulated parallel arms & chrome tension springs read clearly!
      lamp.rotation.y = 1.24;
      this._addContactShadow(deskGroup, -1.22, sy + 0.0008, -1.04, 0.25, 0.25, 0.84);
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
    });
    const lampPool = new THREE.Mesh(new THREE.PlaneGeometry(0.96, 0.74), this.lampPoolMat);
    lampPool.rotation.x = -Math.PI / 2;
    lampPool.position.set(-1.08, sy + 0.0014, -0.76);
    deskGroup.add(lampPool);

    this._loadGLB('assets/models/coffee_mug.glb', (mug) => {
      mug.position.set(-1.06, sy, -0.58);
      mug.rotation.y = -0.65;
      this._addContactShadow(deskGroup, -1.06, sy + 0.0008, -0.58, 0.15, 0.15, 0.84);
      deskGroup.add(mug);
    });

    this.scene.add(deskGroup);

    // Herman Miller Aeron Chair with matte elastomeric woven charcoal-silver Pellicle mesh (ZERO harsh white seat glare!)
    this._loadGLB('assets/models/aeron_chair.glb', (aeron) => {
      aeron.traverse((obj) => {
        if (obj.isMesh && obj.material?.name === 'Aeron_PellicleMesh') {
          obj.material.side = THREE.DoubleSide;
          obj.material.transparent = true;
          obj.material.opacity = 0.90;
          obj.material.roughness = 0.78;
          obj.material.metalness = 0.04;
          obj.material.envMapIntensity = 0.25;
          obj.material.depthWrite = true;
          obj.castShadow = true;
        }
      });
      aeron.position.set(-1.14, 0, 0.28);
      aeron.rotation.y = Math.PI + 0.42;
      this._addContactShadow(this.scene, -1.14, 0.018, 0.28, 0.94, 0.94, 0.84);
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
    this._addContactShadow(monGroup, 0, 0.0008, -0.036, 0.34, 0.26, 0.88);
    this._addContactShadow(monGroup, 0, 0.0011, -0.036, 0.30, 0.22, 0.92);

    // Exact 34" 21:9 ultrawide active display (800 x 336 mm) with authentic 1900R curvature matching dell_u3425we.glb!
    const screenW = 0.798;
    const screenH = 0.334;
    const panelCenterY = 0.342;
    const curveR = 1.90;

    const screenGeo = new THREE.PlaneGeometry(screenW, screenH, 24, 1);
    const posAttr = screenGeo.attributes.position;
    for (let i = 0; i < posAttr.count; i++) {
      const x = posAttr.getX(i);
      const zCurve = (curveR - Math.sqrt(Math.max(0.01, curveR * curveR - x * x))) + 0.0022;
      posAttr.setZ(i, zCurve);
    }
    screenGeo.computeVertexNormals();

    // Self-luminous anti-glare IPS Omarchy display (ZERO lamp glare blowout in Golden Hour or Twilight!)
    const screenMat = new THREE.MeshBasicMaterial({
      map: this.omarchyScreen.texture,
      toneMapped: true,
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
      pcModel.traverse((obj) => {
        if (!obj.isMesh) return;
        obj.userData.camPreset = 'pc';
        this.clickableMeshes.push(obj);

        const matName = obj.material?.name || '';
        if (matName === 'Corsair_TemperedGlass') {
          const glassTex = createTemperedGlassTexture();
          obj.material = new THREE.MeshStandardMaterial({
            map: glassTex,
            emissiveMap: glassTex,
            emissive: new THREE.Color(0xffe9cc),
            emissiveIntensity: 0.56,
            color: 0x0a1018,
            side: THREE.DoubleSide,
            transparent: true,
            opacity: 0.78,
            roughness: 0.08,
            metalness: 0.14,
            envMapIntensity: 0.9,
            depthWrite: false,
          });
          obj.castShadow = false;
        } else if (matName === 'RGB_Cyan' || matName === 'RGB_Mint') {
          this.pcEmissives.push({ mat: obj.material, phase: obj.position.y * 4.0 + obj.position.z * 2.0 });
        } else if (matName === 'Corsair_AirflowGrille') {
          obj.material.side = THREE.DoubleSide;
          obj.material.transparent = false;
          obj.material.alphaTest = 0.5;
        } else if (matName === 'Corsair_TopAirflowGrille') {
          obj.material.side = THREE.DoubleSide;
          obj.material.transparent = false;
        }
      });
      pcGroup.add(pcModel);
    });

    // Deep grounded contact shadow directly beneath the Corsair 5000D Airflow feet & belly (suppresses stray under-chassis glare!)
    this._addContactShadow(pcGroup, 0, 0.0008, 0, 0.38, 0.66, 0.94);
    this._addContactShadow(pcGroup, 0, 0.0012, 0, 0.28, 0.56, 0.96);
    this.scene.add(pcGroup);
  }

  // ---------- 8. 8× Real NVIDIA DGX Spark + MikroTik CRS804-4DDQ-hRM ON THE DESK Alongside Monitor! ----------
  _buildDGXSparkClusterAndCRS804() {
    const sy = 0.7718;
    const deskCluster = new THREE.Group();

    // 1. MikroTik CRS804-4DDQ-hRM Switch sitting ON THE DESK immediately right of the Omarchy monitor!
    const swX = 0.00;
    const swZ = -1.04;
    this._addContactShadow(deskCluster, swX, sy + 0.0008, swZ, 0.28, 0.45, 0.88);
    this._addContactShadow(deskCluster, swX, sy + 0.0011, swZ, 0.23, 0.40, 0.92);

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

    // 2. Stack of 8× Champagne-Gold NVIDIA DGX Spark Machines ON THE DESK right alongside the CRS804 & monitor!
    // Each unit gets unique UV flip/offset + subtle champagne tonal variation so ZERO two units ever look cloned!
    const sparkStepY = 0.0543;
    const stackX = 0.31;
    const stackZ = -1.08;
    this._addContactShadow(deskCluster, stackX, sy + 0.0008, stackZ, 0.24, 0.24, 0.90);
    this._addContactShadow(deskCluster, stackX, sy + 0.0011, stackZ, 0.175, 0.175, 0.96);

    this._loadGLB('assets/models/dgx_spark.glb', (sparkTemplate) => {
      for (let i = 0; i < 8; i++) {
        const unit = i === 0 ? sparkTemplate : sparkTemplate.clone(true);
        unit.position.set(stackX, sy + i * sparkStepY, stackZ);
        unit.traverse((obj) => {
          if (!obj.isMesh) return;
          obj.userData.camPreset = 'cluster';
          this.clickableMeshes.push(obj);
          if (obj.material?.name === 'Spark_GoldTop') {
            obj.material.envMapIntensity = 0.72;
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

    // Deep tight contact AO shadows beneath CRS804 chassis & rack ears, staggered breakout pods, flat desk cable loom & yellow uplink!
    this._addContactShadow(deskCluster, swX, sy + 0.0009, swZ + 0.17, 0.29, 0.08, 0.90);
    this._addContactShadow(deskCluster, swX - 0.04, sy + 0.0009, swZ + 0.14, 0.26, 0.20, 0.90);
    this._addContactShadow(deskCluster, 0.145, sy + 0.0009, swZ + 0.165, 0.20, 0.18, 0.92);
    this._addContactShadow(deskCluster, 0.185, sy + 0.0009, swZ - 0.02, 0.11, 0.40, 0.88);
    this._addContactShadow(deskCluster, swX - 0.154, sy + 0.0009, swZ + 0.00, 0.055, 0.48, 0.86);
    this._addContactShadow(deskCluster, swX - 0.082, sy + 0.0009, swZ + 0.222, 0.17, 0.045, 0.88);

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

        // Stay flat on desk beside stack -> sweep visibly up a tidy zip-tied vertical harness hugging the back-left corner of the DGX stack up to Nodes 1–8!
        const laneX = 0.168 + p * 0.009 + sub * 0.0042;
        const deskY = sy + 0.0046 + sub * 0.0010;
        const spineX = stackX - 0.098 + (sub * 0.005);
        const spineZ = stackZ - 0.066 - p * 0.004;
        const leadCurve = new THREE.CatmullRomCurve3([
          splitPos,
          new THREE.Vector3(laneX, deskY, splitZ - 0.045),
          new THREE.Vector3(laneX + 0.008, deskY, stackZ + 0.02),
          new THREE.Vector3(spineX - 0.004, deskY + 0.003, stackZ - 0.044),
          new THREE.Vector3(spineX, Math.max(deskY + 0.008, nodeY - 0.008), spineZ),
          new THREE.Vector3(portX, nodeY, spineZ - 0.022),
          pEnd,
        ]);

        const cableMesh = new THREE.Mesh(
          new THREE.TubeGeometry(leadCurve, 56, 0.0029, 10, false),
          dacMats[sub]
        );
        cableMesh.castShadow = true;
        deskCluster.add(cableMesh);

        const boot = new THREE.Mesh(new THREE.BoxGeometry(0.014, 0.009, 0.018), bootMat);
        boot.position.copy(pEnd).add(new THREE.Vector3(0, 0, -0.006));
        deskCluster.add(boot);
      }
    }

    // Brushed-black circular aluminum desk cable grommet flush-mounted behind the CRS804 (gives yellow 10GbE uplink a real physical destination!)
    const gromPos = new THREE.Vector3(swX - 0.160, sy + 0.001, -1.28);
    const gromRing = new THREE.Mesh(
      new THREE.CylinderGeometry(0.024, 0.024, 0.003, 24),
      new THREE.MeshStandardMaterial({ color: 0x20242c, roughness: 0.42, metalness: 0.78 })
    );
    gromRing.position.copy(gromPos);
    deskCluster.add(gromRing);
    const gromHole = new THREE.Mesh(
      new THREE.CylinderGeometry(0.017, 0.017, 0.0036, 20),
      new THREE.MeshStandardMaterial({ color: 0x090b0f, roughness: 0.92 })
    );
    gromHole.position.copy(gromPos);
    deskCluster.add(gromHole);

    // Yellow 10GbE Cat6a management uplink cable resting flush on desk (satin PVC sheen, zero stiffness or floating!)
    const eth1Pos = new THREE.Vector3(swX - 0.012, sy + 0.022, swZ + 0.197);
    const uplinkCurve = new THREE.CatmullRomCurve3([
      eth1Pos,
      new THREE.Vector3(swX - 0.032, sy + 0.011, swZ + 0.226),
      new THREE.Vector3(swX - 0.146, sy + 0.0042, swZ + 0.224),
      new THREE.Vector3(swX - 0.160, sy + 0.0036, swZ + 0.16),
      new THREE.Vector3(swX - 0.160, sy + 0.0036, swZ - 0.08),
      new THREE.Vector3(swX - 0.160, sy + 0.0048, -1.24),
      new THREE.Vector3(swX - 0.160, sy - 0.018, -1.28),
    ]);
    const uplinkMesh = new THREE.Mesh(
      new THREE.TubeGeometry(uplinkCurve, 56, 0.0029, 12, false),
      new THREE.MeshStandardMaterial({ color: 0xdca432, roughness: 0.34, metalness: 0.06 })
    );
    uplinkMesh.castShadow = true;
    deskCluster.add(uplinkMesh);

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
      door.position.set(-credW / 2 + 0.025, credH - 0.23, -0.42 + i * 0.42);
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
      this.skylineMat.map = this.skylineTextures[m.id];
      this.skylineMat.color.setHex(m.skylineTint || 0xffffff);
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
      const ci = m.id === 'twilight' ? 0.06 : 0.18;
      for (const cm of this.curtainMats) cm.emissiveIntensity = ci;
    }
    if (this.roomBounceLight) this.roomBounceLight.intensity = m.bounceIntensity;
    this.renderer.toneMappingExposure = m.exposure;

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

  goToPreset(name) {
    const preset = CAMERA_PRESETS[name];
    if (!preset) return;
    this.animatingCam = {
      startPos: this.camera.position.clone(),
      endPos: new THREE.Vector3(...preset.pos),
      startTarget: this.controls.target.clone(),
      endTarget: new THREE.Vector3(...preset.target),
      t: 0,
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
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h, false);
    if (this.composer) {
      this.composer.setSize(w, h);
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
        this.animatingCam.t += dt / this.animatingCam.duration;
        const k = Math.min(1, this.animatingCam.t);
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
      if (this.pcRgbLight) {
        this.pcRgbLight.color.setHex(0xb2e4f8);
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

      this.renderFrame();
    };
    tick();
  }
}
