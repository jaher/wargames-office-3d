import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

// Camera presets matching index.html [data-cam] buttons
export const CAMERA_PRESETS = {
  overview: {
    pos: [1.55, 1.82, 2.38],
    target: [0.05, 1.05, -1.05],
  },
  monitor: {
    pos: [-0.56, 1.18, -0.22],
    target: [-0.56, 1.14, -1.16],
  },
  pc: {
    pos: [-0.15, 1.10, -0.34],
    target: [0.46, 1.03, -0.96],
  },
  cluster: {
    pos: [1.38, 1.12, -0.10],
    target: [2.62, 0.96, -0.25],
  },
  window: {
    pos: [-0.15, 1.56, 0.92],
    target: [-0.15, 1.52, -16.0],
  },
};

const SKY_MOODS = [
  {
    id: 'golden',
    label: '☀ Golden Hour',
    zenith: new THREE.Color('#1f4e8c'),
    mid: new THREE.Color('#6ea4d4'),
    horizon: new THREE.Color('#ffbe7b'),
    sunColor: new THREE.Color('#fff2cc'),
    sunGlow: new THREE.Color('#ff9d47'),
    sunDir: new THREE.Vector3(-0.26, 0.24, -0.93).normalize(),
    dirLightColor: 0xffd7a3,
    dirLightIntensity: 3.1,
    hemiSky: 0xffe4c4,
    hemiGround: 0x5c4636,
    hemiIntensity: 1.05,
    ambientIntensity: 0.42,
    lampIntensity: 1.6,
    ceilingIntensity: 0.9,
    windowLitBoost: 0.55,
    beamOpacity: 0.085,
    exposure: 1.08,
  },
  {
    id: 'day',
    label: '🌤 Clear Day',
    zenith: new THREE.Color('#1b66c9'),
    mid: new THREE.Color('#74b9f0'),
    horizon: new THREE.Color('#dceeff'),
    sunColor: new THREE.Color('#ffffff'),
    sunGlow: new THREE.Color('#ffe9b8'),
    sunDir: new THREE.Vector3(0.22, 0.44, -0.87).normalize(),
    dirLightColor: 0xfff6e8,
    dirLightIntensity: 3.4,
    hemiSky: 0xdff0ff,
    hemiGround: 0x6b5848,
    hemiIntensity: 1.25,
    ambientIntensity: 0.52,
    lampIntensity: 0.85,
    ceilingIntensity: 0.65,
    windowLitBoost: 0.22,
    beamOpacity: 0.055,
    exposure: 1.12,
  },
  {
    id: 'dusk',
    label: '🌆 Sunset Dusk',
    zenith: new THREE.Color('#141c3d'),
    mid: new THREE.Color('#5a3f78'),
    horizon: new THREE.Color('#ff7b54'),
    sunColor: new THREE.Color('#ffd3a1'),
    sunGlow: new THREE.Color('#ff5e3a'),
    sunDir: new THREE.Vector3(-0.34, 0.13, -0.93).normalize(),
    dirLightColor: 0xff9b62,
    dirLightIntensity: 2.1,
    hemiSky: 0xb98dc8,
    hemiGround: 0x3b2c26,
    hemiIntensity: 0.72,
    ambientIntensity: 0.34,
    lampIntensity: 2.8,
    ceilingIntensity: 1.45,
    windowLitBoost: 1.15,
    beamOpacity: 0.065,
    exposure: 1.04,
  },
];

// Deterministic PRNG so skyline and books look consistent and curated
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

// ---------- Procedural PBR Canvas Textures ----------

function createWoodTexture({
  base = '#9a6b43',
  grain = '#6e4728',
  plankLines = true,
  planksX = 4,
  planksY = 10,
  seed = 11,
  repeatX = 3,
  repeatY = 3,
} = {}) {
  const size = 1024;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  const rng = mulberry32(seed);

  ctx.fillStyle = base;
  ctx.fillRect(0, 0, size, size);

  if (plankLines) {
    const pw = size / planksX;
    const ph = size / planksY;
    for (let x = 0; x < planksX; x++) {
      const offset = (x % 2) * (ph * 0.5);
      for (let y = -1; y <= planksY; y++) {
        const px = x * pw;
        const py = y * ph + offset;
        const shade = (rng() - 0.5) * 26;
        ctx.fillStyle = adjustHex(base, shade);
        ctx.fillRect(px + 1, py + 1, pw - 2, ph - 2);

        // Fine wood grain streaks inside each plank
        ctx.save();
        ctx.beginPath();
        ctx.rect(px + 1, py + 1, pw - 2, ph - 2);
        ctx.clip();
        for (let g = 0; g < 22; g++) {
          ctx.strokeStyle = rgbaHex(grain, 0.06 + rng() * 0.14);
          ctx.lineWidth = 1 + rng() * 2.5;
          ctx.beginPath();
          const gx = px + rng() * pw;
          ctx.moveTo(gx, py);
          ctx.bezierCurveTo(
            gx + (rng() - 0.5) * 16,
            py + ph * 0.33,
            gx + (rng() - 0.5) * 16,
            py + ph * 0.66,
            gx + (rng() - 0.5) * 8,
            py + ph
          );
          ctx.stroke();
        }
        ctx.restore();

        // Subtle bevel seam
        ctx.strokeStyle = 'rgba(28, 16, 8, 0.42)';
        ctx.lineWidth = 2;
        ctx.strokeRect(px, py, pw, ph);
      }
    }
  } else {
    // Continuous walnut tabletop grain
    for (let i = 0; i < 240; i++) {
      ctx.strokeStyle = rgbaHex(grain, 0.05 + rng() * 0.15);
      ctx.lineWidth = 1 + rng() * 3.5;
      const y = rng() * size;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.bezierCurveTo(
        size * 0.3,
        y + (rng() - 0.5) * 24,
        size * 0.7,
        y + (rng() - 0.5) * 24,
        size,
        y + (rng() - 0.5) * 12
      );
      ctx.stroke();
    }
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeatX, repeatY);
  tex.anisotropy = 8;
  return tex;
}

function createRugTexture() {
  const W = 1024;
  const H = 768;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  const rng = mulberry32(42);

  // Warm oat-cream woven base
  ctx.fillStyle = '#ddd4c5';
  ctx.fillRect(0, 0, W, H);

  // Fine woven textile fibers
  for (let y = 0; y < H; y += 3) {
    ctx.fillStyle = y % 6 === 0 ? 'rgba(130, 118, 102, 0.09)' : 'rgba(255, 250, 240, 0.12)';
    ctx.fillRect(0, y, W, 1.5);
  }
  for (let x = 0; x < W; x += 4) {
    ctx.fillStyle = rng() > 0.5 ? 'rgba(110, 98, 84, 0.07)' : 'rgba(255, 255, 255, 0.08)';
    ctx.fillRect(x, 0, 2, H);
  }

  // Modern architectural border & subtle charcoal geometric diamond lines
  ctx.strokeStyle = 'rgba(55, 58, 66, 0.34)';
  ctx.lineWidth = 10;
  ctx.strokeRect(36, 36, W - 72, H - 72);

  ctx.strokeStyle = 'rgba(166, 118, 78, 0.25)';
  ctx.lineWidth = 4;
  ctx.strokeRect(56, 56, W - 112, H - 112);

  ctx.strokeStyle = 'rgba(58, 64, 74, 0.22)';
  ctx.lineWidth = 5;
  const cols = 4;
  const rows = 3;
  const cw = (W - 140) / cols;
  const ch = (H - 140) / rows;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const cx = 70 + (c + 0.5) * cw;
      const cy = 70 + (r + 0.5) * ch;
      ctx.beginPath();
      ctx.moveTo(cx, cy - ch * 0.44);
      ctx.lineTo(cx + cw * 0.44, cy);
      ctx.lineTo(cx, cy + ch * 0.44);
      ctx.lineTo(cx - cw * 0.44, cy);
      ctx.closePath();
      ctx.stroke();
    }
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

function createBuildingFacadeTexture(seed, style = 'glass') {
  const W = 256;
  const H = 512;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  const rng = mulberry32(seed);

  const palettes = {
    glass: ['#263547', '#1e2c3e', '#2d3f52', '#35485b'],
    warm: ['#484340', '#585049', '#3f3d3f', '#605751'],
    dark: ['#1b2330', '#232b38', '#2a3342', '#171f2b'],
  };
  const pal = palettes[style] || palettes.glass;
  ctx.fillStyle = pal[Math.floor(rng() * pal.length)];
  ctx.fillRect(0, 0, W, H);

  const cols = 6 + Math.floor(rng() * 5);
  const rows = 18 + Math.floor(rng() * 14);
  const padX = 4;
  const padY = 4;
  const cellW = W / cols;
  const cellH = H / rows;

  const emCanvas = document.createElement('canvas');
  emCanvas.width = W;
  emCanvas.height = H;
  const ectx = emCanvas.getContext('2d');
  ectx.fillStyle = '#000000';
  ectx.fillRect(0, 0, W, H);

  for (let r = 0; r < rows; r++) {
    const floorLitBias = rng();
    for (let c = 0; c < cols; c++) {
      const x = c * cellW + padX * 0.5;
      const y = r * cellH + padY * 0.5;
      const ww = cellW - padX;
      const wh = cellH - padY;

      const lit = rng() < 0.22 + floorLitBias * 0.32;
      if (lit) {
        const warm = rng() > 0.28;
        const col = warm
          ? `rgba(255, ${205 + Math.floor(rng() * 40)}, ${135 + Math.floor(rng() * 55)}, ${0.65 + rng() * 0.35})`
          : `rgba(180, ${215 + Math.floor(rng() * 35)}, 255, ${0.55 + rng() * 0.35})`;
        ctx.fillStyle = col;
        ctx.fillRect(x, y, ww, wh);
        ectx.fillStyle = col;
        ectx.fillRect(x, y, ww, wh);
      } else {
        // Reflective sky-tinted unlit pane
        const v = 52 + Math.floor(rng() * 46);
        ctx.fillStyle = `rgb(${v}, ${v + 16}, ${v + 34})`;
        ctx.fillRect(x, y, ww, wh);
      }
    }
  }

  // Horizontal architectural spandrel bands
  ctx.fillStyle = 'rgba(15, 20, 28, 0.45)';
  for (let r = 0; r < rows; r += 4) {
    ctx.fillRect(0, r * cellH, W, 3);
  }

  const map = new THREE.CanvasTexture(canvas);
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = THREE.RepeatWrapping;
  map.wrapT = THREE.RepeatWrapping;

  const emissiveMap = new THREE.CanvasTexture(emCanvas);
  emissiveMap.colorSpace = THREE.SRGBColorSpace;
  emissiveMap.wrapS = THREE.RepeatWrapping;
  emissiveMap.wrapT = THREE.RepeatWrapping;

  return { map, emissiveMap };
}

function createLabelTexture({
  width = 1024,
  height = 256,
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
  const W = 512;
  const H = 640;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');

  if (variant === 0) {
    // Minimalist architectural warm sunset geometry print
    ctx.fillStyle = '#f3ece0';
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#d98a5f';
    ctx.beginPath();
    ctx.arc(W * 0.56, H * 0.36, 130, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#243447';
    ctx.beginPath();
    ctx.moveTo(60, H - 70);
    ctx.lineTo(220, 290);
    ctx.lineTo(360, H - 70);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#18222f';
    ctx.beginPath();
    ctx.moveTo(220, H - 70);
    ctx.lineTo(350, 250);
    ctx.lineTo(460, H - 70);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#c89b6e';
    ctx.lineWidth = 4;
    ctx.strokeRect(36, 36, W - 72, H - 72);
  } else {
    // Dark cyber/architecture schematic art print
    ctx.fillStyle = '#111826';
    ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = 'rgba(125, 207, 255, 0.28)';
    ctx.lineWidth = 2;
    for (let i = 48; i < W - 48; i += 32) {
      ctx.beginPath();
      ctx.moveTo(i, 48);
      ctx.lineTo(i, H - 48);
      ctx.stroke();
    }
    for (let j = 48; j < H - 48; j += 32) {
      ctx.beginPath();
      ctx.moveTo(48, j);
      ctx.lineTo(W - 48, j);
      ctx.stroke();
    }
    ctx.strokeStyle = '#73daca';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(W * 0.5, H * 0.44, 128, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = '#7dcfff';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(W * 0.5, H * 0.44, 86, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = '#dce8fb';
    ctx.font = 'bold 24px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('WARGAMES // LAB', W * 0.5, H - 108);
    ctx.fillStyle = '#73daca';
    ctx.font = '16px monospace';
    ctx.fillText('OMARCHY · RTX 5090 · 8× SPARK', W * 0.5, H - 74);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
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

function createSoftGlowSpriteTexture(innerColor, outerColor) {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, innerColor);
  g.addColorStop(0.35, outerColor);
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(canvas);
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

    // Animated scene handles
    this.rgbFans = [];
    this.rgbRings = [];
    this.ramBars = [];
    this.sparkLeds = [];
    this.switchLeds = [];
    this.clouds = [];
    this.buildingWindowMaterials = [];
    this.sunBeams = [];
    this.clickableMeshes = [];
    this.dustPoints = null;

    this._initRendererAndCamera();
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
    this.renderer.toneMappingExposure = 1.08;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;

    // Realistic PBR environment reflections for glass, aluminum, brushed GPU shroud
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    const roomEnv = new RoomEnvironment();
    this.scene.environment = pmrem.fromScene(roomEnv, 0.04).texture;
    this.scene.environmentIntensity = 0.45;
    roomEnv.dispose();
    pmrem.dispose();

    const w = this.canvas.clientWidth || window.innerWidth;
    const h = this.canvas.clientHeight || window.innerHeight;
    this.camera = new THREE.PerspectiveCamera(44, w / h, 0.05, 320);

    this.controls = new OrbitControls(this.camera, this.canvas);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.065;
    this.controls.maxDistance = 5.4;
    this.controls.minDistance = 0.48;
    this.controls.maxPolarAngle = Math.PI * 0.56;
    this.controls.minPolarAngle = 0.22;

    const p = CAMERA_PRESETS.overview;
    this.camera.position.set(...p.pos);
    this.controls.target.set(...p.target);
    this.controls.update();
  }

  // ---------- 1. Panoramic Sky Dome, Sun, Clouds & Layered City Skyline ----------
  _buildSkyAndCityView() {
    // Atmospheric sky shader dome
    this.skyUniforms = {
      uZenith: { value: SKY_MOODS[0].zenith.clone() },
      uMid: { value: SKY_MOODS[0].mid.clone() },
      uHorizon: { value: SKY_MOODS[0].horizon.clone() },
      uSunColor: { value: SKY_MOODS[0].sunColor.clone() },
      uSunGlow: { value: SKY_MOODS[0].sunGlow.clone() },
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
        uniform vec3 uZenith;
        uniform vec3 uMid;
        uniform vec3 uHorizon;
        uniform vec3 uSunColor;
        uniform vec3 uSunGlow;
        uniform vec3 uSunDir;
        varying vec3 vWorldDir;

        void main() {
          vec3 dir = normalize(vWorldDir);
          float h = clamp(dir.y, -0.15, 1.0);
          vec3 col;
          if (h < 0.0) {
            col = mix(uHorizon, uHorizon * 0.55, clamp(-h * 6.0, 0.0, 1.0));
          } else if (h < 0.26) {
            col = mix(uHorizon, uMid, smoothstep(0.0, 0.26, h));
          } else {
            col = mix(uMid, uZenith, smoothstep(0.26, 0.92, h));
          }

          // Solar glow halo & crisp sun disc
          float sunDot = max(dot(dir, normalize(uSunDir)), 0.0);
          float wideGlow = pow(sunDot, 7.0) * 0.45;
          float tightGlow = pow(sunDot, 64.0) * 0.85;
          float sunDisc = smoothstep(0.9985, 0.99945, sunDot);

          col += uSunGlow * wideGlow;
          col += mix(uSunGlow, uSunColor, 0.65) * tightGlow;
          col = mix(col, uSunColor * 1.55, sunDisc);

          // Subtle horizon atmospheric warmth band
          float band = exp(-abs(dir.y - 0.015) * 14.0) * 0.22;
          col += uSunGlow * band;

          gl_FragColor = vec4(col, 1.0);
        }
      `,
    });

    const skyDome = new THREE.Mesh(new THREE.SphereGeometry(195, 48, 32), skyMat);
    this.scene.add(skyDome);

    // Distant glistening water/bay plane below the skyline
    const waterGeo = new THREE.PlaneGeometry(240, 180);
    const waterMat = new THREE.MeshStandardMaterial({
      color: 0x1e354d,
      roughness: 0.16,
      metalness: 0.72,
      emissive: 0x3a2a1d,
      emissiveIntensity: 0.18,
    });
    const water = new THREE.Mesh(waterGeo, waterMat);
    water.rotation.x = -Math.PI / 2;
    water.position.set(0, -14.5, -88);
    this.scene.add(water);

    // Distant mountain/hills silhouette far behind the city
    const ridgeGroup = new THREE.Group();
    const ridgeMat = new THREE.MeshBasicMaterial({
      color: 0x3b4863,
      transparent: true,
      opacity: 0.55,
    });
    const rng = mulberry32(2026);
    for (let i = 0; i < 14; i++) {
      const rx = -95 + i * 14.5 + (rng() - 0.5) * 8;
      const rw = 26 + rng() * 22;
      const rh = 11 + rng() * 14;
      const hill = new THREE.Mesh(new THREE.ConeGeometry(rw * 0.75, rh, 6), ridgeMat);
      hill.position.set(rx, -14 + rh * 0.45, -138 - rng() * 18);
      hill.scale.set(1.6, 1, 0.5);
      ridgeGroup.add(hill);
    }
    this.scene.add(ridgeGroup);

    // Multi-layered procedural 3D City Skyline
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
        emissive: new THREE.Color('#ffda9e'),
        emissiveIntensity: 0.55,
        roughness: idx % 2 === 0 ? 0.24 : 0.42,
        metalness: idx % 2 === 0 ? 0.58 : 0.25,
      });
      this.buildingWindowMaterials.push(mat);
      return mat;
    });

    const roofMat = new THREE.MeshStandardMaterial({
      color: 0x242c38,
      roughness: 0.65,
      metalness: 0.35,
    });
    const spireMat = new THREE.MeshStandardMaterial({
      color: 0xcbd6e6,
      roughness: 0.3,
      metalness: 0.8,
    });
    const beaconMat = new THREE.MeshBasicMaterial({ color: 0xff4444 });

    // 3 skyline depth bands (near/mid/far) with dramatic central high-rise cluster
    const tiers = [
      { count: 24, zMin: -18, zMax: -28, xSpan: 48, hMin: 9, hMax: 22, wMin: 2.2, wMax: 4.5 },
      { count: 38, zMin: -30, zMax: -52, xSpan: 86, hMin: 14, hMax: 36, wMin: 2.8, wMax: 6.2 },
      { count: 34, zMin: -54, zMax: -84, xSpan: 128, hMin: 16, hMax: 44, wMin: 3.5, wMax: 7.5 },
    ];

    const baseFloorY = -14.5;
    for (const tier of tiers) {
      for (let i = 0; i < tier.count; i++) {
        const x = (rng() - 0.5) * tier.xSpan;
        const z = tier.zMin + rng() * (tier.zMax - tier.zMin);
        // Leave a graceful visual corridor around the sun so the sun shines clearly through!
        const sunCorridorFactor = Math.abs(x + 7.5) < 5.5 ? 0.62 : 1.0;
        const centerBoost = 1.0 - Math.min(Math.abs(x) / (tier.xSpan * 0.55), 0.72) * 0.38;
        const h = (tier.hMin + rng() * (tier.hMax - tier.hMin)) * centerBoost * sunCorridorFactor;
        const w = tier.wMin + rng() * (tier.wMax - tier.wMin);
        const d = tier.wMin + rng() * (tier.wMax - tier.wMin);

        const mat = bldgMaterials[Math.floor(rng() * bldgMaterials.length)];
        const bMesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), [mat, mat, roofMat, roofMat, mat, mat]);
        bMesh.position.set(x, baseFloorY + h * 0.5, z);
        cityGroup.add(bMesh);

        // Architectural setback crown / penthouse / spire on taller towers
        if (h > 20 && rng() > 0.32) {
          const crownH = 2.2 + rng() * 5.0;
          const crownW = w * (0.55 + rng() * 0.25);
          const crownD = d * (0.55 + rng() * 0.25);
          const crown = new THREE.Mesh(
            new THREE.BoxGeometry(crownW, crownH, crownD),
            [mat, mat, roofMat, roofMat, mat, mat]
          );
          crown.position.set(x, baseFloorY + h + crownH * 0.5, z);
          cityGroup.add(crown);

          if (h > 26 && rng() > 0.4) {
            const spireH = 3.2 + rng() * 6.5;
            const spire = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.18, spireH, 6), spireMat);
            spire.position.set(x, baseFloorY + h + crownH + spireH * 0.5, z);
            cityGroup.add(spire);

            const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.14, 8, 8), beaconMat);
            beacon.position.set(x, baseFloorY + h + crownH + spireH, z);
            cityGroup.add(beacon);
          }
        }
      }
    }
    this.scene.add(cityGroup);

    // Soft atmospheric clouds drifting across the upper sky
    const cloudTex = createSoftGlowSpriteTexture('rgba(255,248,238,0.68)', 'rgba(255,226,196,0.22)');
    for (let i = 0; i < 20; i++) {
      const cluster = new THREE.Group();
      const puffs = 3 + Math.floor(rng() * 3);
      for (let p = 0; p < puffs; p++) {
        const spMat = new THREE.SpriteMaterial({
          map: cloudTex,
          transparent: true,
          opacity: 0.42 + rng() * 0.28,
          depthWrite: false,
        });
        const sp = new THREE.Sprite(spMat);
        const sx = 12 + rng() * 14;
        sp.scale.set(sx, sx * (0.34 + rng() * 0.16), 1);
        sp.position.set((p - puffs * 0.5) * 5.2, (rng() - 0.5) * 1.8, (rng() - 0.5) * 2.5);
        cluster.add(sp);
      }
      cluster.position.set((rng() - 0.5) * 145, 16 + rng() * 24, -75 - rng() * 55);
      cluster.userData = { speed: 0.18 + rng() * 0.26 };
      this.clouds.push(cluster);
      this.scene.add(cluster);
    }

    // Subtle invisible clickable window hitbox for "Skyline View"
    const winHit = new THREE.Mesh(
      new THREE.PlaneGeometry(4.6, 2.1),
      new THREE.MeshBasicMaterial({ visible: false })
    );
    winHit.position.set(-0.15, 1.72, -2.54);
    winHit.userData.camPreset = 'window';
    this.clickableMeshes.push(winHit);
    this.scene.add(winHit);
  }

  // ---------- 2. Realistic Office Room Shell, Hardwood Floor, Rug & Panoramic Window Frame ----------
  _buildRoomShell() {
    const W = 6.4; // X: -3.2 .. +3.2
    const H = 3.1; // Y: 0 .. 3.1
    const D = 5.4; // Z: -2.6 .. +2.8

    // Warm European oak hardwood floor
    const floorTex = createWoodTexture({
      base: '#9b7048',
      grain: '#694426',
      plankLines: true,
      planksX: 5,
      planksY: 12,
      seed: 19,
      repeatX: 3.4,
      repeatY: 3.0,
    });
    const floorMat = new THREE.MeshStandardMaterial({
      map: floorTex,
      roughness: 0.46,
      metalness: 0.04,
    });
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(W, D), floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(0, 0, 0.1);
    floor.receiveShadow = true;
    this.scene.add(floor);

    // Plush woven geometric area rug
    const rugMat = new THREE.MeshStandardMaterial({
      map: createRugTexture(),
      roughness: 0.94,
      metalness: 0.0,
    });
    const rug = new THREE.Mesh(new THREE.BoxGeometry(3.25, 0.014, 2.35), rugMat);
    rug.position.set(-0.28, 0.007, -0.35);
    rug.receiveShadow = true;
    this.scene.add(rug);

    // Warm matte architectural plaster walls
    const wallMat = new THREE.MeshStandardMaterial({
      color: 0xeae3d8,
      roughness: 0.88,
      metalness: 0.0,
    });
    const accentWallMat = new THREE.MeshStandardMaterial({
      color: 0xd9d1c5,
      roughness: 0.86,
      metalness: 0.0,
    });
    const ceilingMat = new THREE.MeshStandardMaterial({
      color: 0xf4f0ea,
      roughness: 0.92,
    });
    const trimMat = new THREE.MeshStandardMaterial({
      color: 0xf0ebe3,
      roughness: 0.55,
    });

    // Left wall (X = -3.2)
    const leftWall = new THREE.Mesh(new THREE.PlaneGeometry(D, H), accentWallMat);
    leftWall.rotation.y = Math.PI / 2;
    leftWall.position.set(-W / 2, H / 2, 0.1);
    leftWall.receiveShadow = true;
    this.scene.add(leftWall);

    // Right wall (X = +3.2)
    const rightWall = new THREE.Mesh(new THREE.PlaneGeometry(D, H), wallMat);
    rightWall.rotation.y = -Math.PI / 2;
    rightWall.position.set(W / 2, H / 2, 0.1);
    rightWall.receiveShadow = true;
    this.scene.add(rightWall);

    // Rear wall behind camera (Z = +2.8)
    const rearWall = new THREE.Mesh(new THREE.PlaneGeometry(W, H), wallMat);
    rearWall.rotation.y = Math.PI;
    rearWall.position.set(0, H / 2, 2.8);
    rearWall.receiveShadow = true;
    this.scene.add(rearWall);

    // Ceiling (Y = 3.1)
    const ceiling = new THREE.Mesh(new THREE.PlaneGeometry(W, D), ceilingMat);
    ceiling.rotation.x = Math.PI / 2;
    ceiling.position.set(0, H, 0.1);
    this.scene.add(ceiling);

    // Back wall (Z = -2.6) constructed cleanly around the giant panoramic window:
    // Window aperture: X in [-2.55, +2.25], Y in [0.58, 2.82]
    const wallThick = 0.22;
    const zBack = -2.6 - wallThick * 0.5;
    const addWallBlock = (w, h, x, y) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, wallThick), wallMat);
      m.position.set(x, y, zBack);
      m.castShadow = true;
      m.receiveShadow = true;
      this.scene.add(m);
    };
    // Left pillar: X = -3.2 .. -2.55 (width 0.65)
    addWallBlock(0.65, H, -3.2 + 0.325, H / 2);
    // Right pillar: X = +2.25 .. +3.2 (width 0.95)
    addWallBlock(0.95, H, 2.25 + 0.475, H / 2);
    // Bottom knee-wall under window: X = -2.55 .. +2.25 (width 4.8), Y = 0 .. 0.58
    addWallBlock(4.8, 0.58, -0.15, 0.29);
    // Top lintel above window: X = -2.55 .. +2.25, Y = 2.82 .. 3.1 (height 0.28)
    addWallBlock(4.8, 0.28, -0.15, 2.96);

    // Sleek dark-charcoal architectural window frame & slim mullions
    const frameMat = new THREE.MeshStandardMaterial({
      color: 0x22262e,
      roughness: 0.32,
      metalness: 0.72,
    });
    const addMullion = (w, h, d, x, y, z) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), frameMat);
      m.position.set(x, y, z);
      m.castShadow = true;
      m.receiveShadow = true;
      this.scene.add(m);
    };
    const wz = -2.66;
    // Perimeter frame
    addMullion(4.84, 0.06, 0.14, -0.15, 2.82, wz);
    addMullion(4.84, 0.06, 0.14, -0.15, 0.58, wz);
    addMullion(0.06, 2.28, 0.14, -2.55, 1.7, wz);
    addMullion(0.06, 2.28, 0.14, 2.25, 1.7, wz);
    // Two slim architectural vertical mullions framing the skyline like a gallery triptych
    addMullion(0.04, 2.22, 0.1, -0.95, 1.7, wz);
    addMullion(0.04, 2.22, 0.1, 0.65, 1.7, wz);

    // Warm walnut deep window sill
    const sillTex = createWoodTexture({
      base: '#6f4b30',
      grain: '#422918',
      plankLines: false,
      seed: 31,
      repeatX: 2,
      repeatY: 1,
    });
    const sill = new THREE.Mesh(
      new THREE.BoxGeometry(4.92, 0.036, 0.32),
      new THREE.MeshStandardMaterial({ map: sillTex, roughness: 0.36, metalness: 0.05 })
    );
    sill.position.set(-0.15, 0.598, -2.62);
    sill.receiveShadow = true;
    this.scene.add(sill);

    // Very subtle crystal-clear architectural window glass (barely tinted so view stays vivid)
    const winGlass = new THREE.Mesh(
      new THREE.PlaneGeometry(4.78, 2.2),
      new THREE.MeshPhysicalMaterial({
        color: 0xeef7ff,
        transparent: true,
        opacity: 0.06,
        roughness: 0.05,
        metalness: 0.1,
        reflectivity: 0.6,
        depthWrite: false,
      })
    );
    winGlass.position.set(-0.15, 1.7, -2.68);
    this.scene.add(winGlass);

    // Acoustic vertical oak wood-slat accent panel on left wall
    const slatWoodMat = new THREE.MeshStandardMaterial({
      color: 0x8b5e3b,
      roughness: 0.52,
    });
    const feltMat = new THREE.MeshStandardMaterial({
      color: 0x1d2026,
      roughness: 0.95,
    });
    const feltBacking = new THREE.Mesh(new THREE.BoxGeometry(0.015, 2.65, 1.6), feltMat);
    feltBacking.position.set(-3.185, 1.48, -1.62);
    this.scene.add(feltBacking);
    for (let i = 0; i < 24; i++) {
      const slat = new THREE.Mesh(new THREE.BoxGeometry(0.028, 2.65, 0.036), slatWoodMat);
      slat.position.set(-3.168, 1.48, -2.38 + i * 0.066);
      slat.castShadow = true;
      slat.receiveShadow = true;
      this.scene.add(slat);
    }

    // Baseboards
    const addBaseboard = (w, h, d, x, y, z) => {
      const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), trimMat);
      b.position.set(x, y, z);
      b.receiveShadow = true;
      this.scene.add(b);
    };
    addBaseboard(0.025, 0.11, D, -3.185, 0.055, 0.1);
    addBaseboard(0.025, 0.11, D, 3.185, 0.055, 0.1);
    addBaseboard(W, 0.11, 0.025, 0, 0.055, -2.585);

    // Recessed ceiling downlights + sleek linear pendant light over desk
    const fixtureMat = new THREE.MeshStandardMaterial({ color: 0x262930, roughness: 0.35, metalness: 0.7 });
    const glowBulbMat = new THREE.MeshStandardMaterial({
      color: 0xfff3de,
      emissive: 0xffd79c,
      emissiveIntensity: 2.2,
    });
    const downlightPos = [
      [-1.7, -1.2],
      [1.7, -1.2],
      [-1.7, 1.2],
      [1.7, 1.2],
    ];
    for (const [dx, dz] of downlightPos) {
      const ring = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.085, 0.015, 20), fixtureMat);
      ring.position.set(dx, H - 0.008, dz);
      this.scene.add(ring);
      const lens = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.01, 20), glowBulbMat);
      lens.position.set(dx, H - 0.014, dz);
      this.scene.add(lens);
    }

    // Linear brass & matte-black pendant bar suspended over desk
    const pendantGroup = new THREE.Group();
    const brassMat = new THREE.MeshStandardMaterial({ color: 0xc9a165, roughness: 0.28, metalness: 0.85 });
    const bar = new THREE.Mesh(new THREE.BoxGeometry(1.38, 0.042, 0.058), fixtureMat);
    bar.position.set(-0.35, 2.48, -0.95);
    pendantGroup.add(bar);
    const barAccent = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.012, 0.062), brassMat);
    barAccent.position.set(-0.35, 2.502, -0.95);
    pendantGroup.add(barAccent);
    const diffuser = new THREE.Mesh(new THREE.BoxGeometry(1.32, 0.01, 0.042), glowBulbMat);
    diffuser.position.set(-0.35, 2.456, -0.95);
    pendantGroup.add(diffuser);
    for (const sx of [-0.9, 0.2]) {
      const wire = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.62, 8), fixtureMat);
      wire.position.set(sx, 2.79, -0.95);
      pendantGroup.add(wire);
    }
    this.scene.add(pendantGroup);
  }

  // ---------- 3. Warm Lighting & Soft Shadows ----------
  _buildLighting() {
    this.ambientLight = new THREE.AmbientLight(0xfff1e0, 0.42);
    this.scene.add(this.ambientLight);

    this.hemiLight = new THREE.HemisphereLight(0xffe4c4, 0x5c4636, 1.05);
    this.scene.add(this.hemiLight);

    // Primary sun directional light pouring through the large window
    this.sunLight = new THREE.DirectionalLight(0xffd7a3, 3.1);
    this.sunLight.position.set(-4.0, 5.2, -11.5);
    this.sunLight.target.position.set(0.3, 0.5, 0.2);
    this.sunLight.castShadow = true;
    this.sunLight.shadow.mapSize.set(2048, 2048);
    this.sunLight.shadow.camera.near = 2;
    this.sunLight.shadow.camera.far = 24;
    this.sunLight.shadow.camera.left = -4.6;
    this.sunLight.shadow.camera.right = 4.6;
    this.sunLight.shadow.camera.top = 4.2;
    this.sunLight.shadow.camera.bottom = -2.2;
    this.sunLight.shadow.bias = -0.0005;
    this.sunLight.shadow.normalBias = 0.02;
    this.scene.add(this.sunLight);
    this.scene.add(this.sunLight.target);

    // Warm ceiling overhead fill light
    this.ceilingLight = new THREE.PointLight(0xffe4bc, 0.9, 10, 1.6);
    this.ceilingLight.position.set(0.1, 2.38, -0.35);
    this.scene.add(this.ceilingLight);

    // Warm architect desk lamp pool
    this.deskLampLight = new THREE.PointLight(0xffc985, 1.6, 3.6, 1.8);
    this.deskLampLight.position.set(-1.12, 1.18, -1.04);
    this.scene.add(this.deskLampLight);

    // Subtle cool screen bounce glow from Omarchy monitor
    this.screenGlowLight = new THREE.PointLight(0x7dcfff, 0.45, 2.1, 2.0);
    this.screenGlowLight.position.set(-0.56, 1.14, -0.92);
    this.scene.add(this.screenGlowLight);

    // Subtle interior RGB light inside the Corsair PC
    this.pcRgbLight = new THREE.PointLight(0x73daca, 0.72, 1.35, 2.0);
    this.pcRgbLight.position.set(0.45, 1.04, -0.95);
    this.scene.add(this.pcRgbLight);
  }

  // ---------- 4. Bookshelf, Books & Framed Wall Art ----------
  _buildBookshelfAndDecor() {
    const shelfGroup = new THREE.Group();
    shelfGroup.position.set(-2.96, 0, 0.42);
    shelfGroup.rotation.y = Math.PI / 2;

    const steelMat = new THREE.MeshStandardMaterial({ color: 0x20242c, roughness: 0.38, metalness: 0.78 });
    const shelfWoodTex = createWoodTexture({
      base: '#7c5335',
      grain: '#4f321e',
      plankLines: false,
      seed: 77,
      repeatX: 2,
      repeatY: 1,
    });
    const shelfWoodMat = new THREE.MeshStandardMaterial({ map: shelfWoodTex, roughness: 0.42 });

    const sw = 1.68;
    const sh = 2.18;
    const sd = 0.36;

    // 4 vertical steel uprights + cross-bracing
    for (const ux of [-sw / 2 + 0.02, sw / 2 - 0.02]) {
      for (const uz of [-sd / 2 + 0.02, sd / 2 - 0.02]) {
        const post = new THREE.Mesh(new THREE.BoxGeometry(0.026, sh, 0.026), steelMat);
        post.position.set(ux, sh / 2, uz);
        post.castShadow = true;
        post.receiveShadow = true;
        shelfGroup.add(post);
      }
    }

    // 6 walnut shelves
    const shelfYs = [0.14, 0.54, 0.94, 1.34, 1.74, 2.12];
    for (const y of shelfYs) {
      const board = new THREE.Mesh(new THREE.BoxGeometry(sw - 0.02, 0.028, sd - 0.01), shelfWoodMat);
      board.position.set(0, y, 0);
      board.castShadow = true;
      board.receiveShadow = true;
      shelfGroup.add(board);
    }

    // Populate shelves with rich varied books, storage boxes, and decor objects
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
        // Occasional open decor gap or horizontal stack
        if (rng() < 0.18 && cursorX < sw / 2 - 0.32) {
          // Small decorative storage box or ceramic vase
          if (rng() < 0.5) {
            const box = new THREE.Mesh(
              new THREE.BoxGeometry(0.24, 0.16, 0.25),
              new THREE.MeshStandardMaterial({ color: 0x303642, roughness: 0.85 })
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
                  new THREE.Vector2(0.06, 0.08),
                  new THREE.Vector2(0.048, 0.16),
                  new THREE.Vector2(0.028, 0.21),
                  new THREE.Vector2(0.036, 0.23),
                ],
                16
              ),
              new THREE.MeshStandardMaterial({
                color: si % 2 === 0 ? 0xd9cbb8 : 0x3d5c57,
                roughness: 0.45,
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

    // Small trailing pothos plant on top shelf
    const pot = new THREE.Mesh(
      new THREE.CylinderGeometry(0.075, 0.058, 0.12, 16),
      new THREE.MeshStandardMaterial({ color: 0xded5c8, roughness: 0.55 })
    );
    pot.position.set(0.42, shelfYs[5] + 0.074, 0.02);
    shelfGroup.add(pot);
    const leafMat = new THREE.MeshStandardMaterial({ color: 0x3b7244, roughness: 0.52, side: THREE.DoubleSide });
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

    this.scene.add(shelfGroup);

    // Framed Wall Art prints (left wall beside acoustic slats + right wall above DGX cluster)
    const addFramedArt = (x, y, z, rotY, w, h, variant) => {
      const g = new THREE.Group();
      const frame = new THREE.Mesh(
        new THREE.BoxGeometry(w + 0.05, h + 0.05, 0.032),
        new THREE.MeshStandardMaterial({ color: 0x22201e, roughness: 0.45 })
      );
      frame.castShadow = true;
      g.add(frame);
      const art = new THREE.Mesh(
        new THREE.PlaneGeometry(w, h),
        new THREE.MeshStandardMaterial({ map: createWallArtTexture(variant), roughness: 0.45 })
      );
      art.position.z = 0.017;
      g.add(art);
      g.position.set(x, y, z);
      g.rotation.y = rotY;
      this.scene.add(g);
    };

    addFramedArt(-3.17, 1.78, -1.62, Math.PI / 2, 0.58, 0.72, 0);
    addFramedArt(3.17, 1.82, -0.32, -Math.PI / 2, 0.64, 0.78, 1);
  }

  // ---------- 5. Lush Realistic Office Plants ----------
  _buildPlants() {
    // Tall Fiddle-Leaf Fig in ceramic planter in the sunlit left-window corner
    const buildFiddleFig = (x, z, scale = 1) => {
      const g = new THREE.Group();
      const planter = new THREE.Mesh(
        new THREE.CylinderGeometry(0.22, 0.16, 0.36, 24),
        new THREE.MeshStandardMaterial({ color: 0xe6dfd3, roughness: 0.55 })
      );
      planter.position.y = 0.18;
      planter.castShadow = true;
      planter.receiveShadow = true;
      g.add(planter);

      // Wooden planter stand legs
      const standMat = new THREE.MeshStandardMaterial({ color: 0x7b5333, roughness: 0.5 });
      for (let i = 0; i < 4; i++) {
        const a = (i * Math.PI) / 2 + Math.PI / 4;
        const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.014, 0.34, 8), standMat);
        leg.position.set(Math.cos(a) * 0.18, 0.17, Math.sin(a) * 0.18);
        g.add(leg);
      }

      const soil = new THREE.Mesh(
        new THREE.CylinderGeometry(0.2, 0.2, 0.02, 20),
        new THREE.MeshStandardMaterial({ color: 0x2e2117, roughness: 0.95 })
      );
      soil.position.y = 0.35;
      g.add(soil);

      const trunkMat = new THREE.MeshStandardMaterial({ color: 0x5c432e, roughness: 0.85 });
      const leafMat1 = new THREE.MeshStandardMaterial({ color: 0x2f683a, roughness: 0.42, side: THREE.DoubleSide });
      const leafMat2 = new THREE.MeshStandardMaterial({ color: 0x3f7e48, roughness: 0.38, side: THREE.DoubleSide });

      // Curved organic trunk + 3 branches
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
      // Leaf shape geometry
      const leafShape = new THREE.Shape();
      leafShape.moveTo(0, 0);
      leafShape.bezierCurveTo(0.08, 0.05, 0.12, 0.18, 0.07, 0.26);
      leafShape.bezierCurveTo(0.03, 0.31, -0.03, 0.31, -0.07, 0.26);
      leafShape.bezierCurveTo(-0.12, 0.18, -0.08, 0.05, 0, 0);
      const leafGeo = new THREE.ShapeGeometry(leafShape, 10);

      for (let i = 0; i < 28; i++) {
        const t = 0.28 + (i / 28) * 0.72;
        const pt = trunkCurve.getPoint(t);
        const angle = i * 2.39996; // Golden angle phyllotaxis!
        const radius = 0.06 + (1 - Math.abs(t - 0.68)) * 0.22;

        const stemEnd = new THREE.Vector3(
          pt.x + Math.cos(angle) * radius,
          pt.y + 0.05 + rng() * 0.1,
          pt.z + Math.sin(angle) * radius
        );
        const stem = new THREE.Mesh(
          new THREE.TubeGeometry(new THREE.LineCurve3(pt, stemEnd), 2, 0.006, 5, false),
          trunkMat
        );
        g.add(stem);

        const leaf = new THREE.Mesh(leafGeo, i % 2 === 0 ? leafMat1 : leafMat2);
        leaf.position.copy(stemEnd);
        leaf.rotation.set(0.65 + rng() * 0.45, angle + Math.PI / 2, (rng() - 0.5) * 0.4);
        const ls = 0.72 + rng() * 0.48;
        leaf.scale.set(ls, ls, ls);
        leaf.castShadow = true;
        g.add(leaf);
      }

      g.position.set(x, 0, z);
      g.scale.setScalar(scale);
      this.scene.add(g);
    };

    buildFiddleFig(-2.45, -2.02, 1.05);

    // Tall Snake Plant (Sansevieria) in matte charcoal planter near right window corner
    const snakeGroup = new THREE.Group();
    const sPot = new THREE.Mesh(
      new THREE.CylinderGeometry(0.17, 0.13, 0.32, 20),
      new THREE.MeshStandardMaterial({ color: 0x2a2f38, roughness: 0.62 })
    );
    sPot.position.y = 0.16;
    sPot.castShadow = true;
    snakeGroup.add(sPot);

    const bladeMat = new THREE.MeshStandardMaterial({ color: 0x356b45, roughness: 0.45, side: THREE.DoubleSide });
    const bladeEdgeMat = new THREE.MeshStandardMaterial({ color: 0x5c8f54, roughness: 0.45, side: THREE.DoubleSide });
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
    snakeGroup.position.set(2.55, 0, -1.92);
    this.scene.add(snakeGroup);
  }

  // ---------- 6. Executive Walnut Desk, Peripherals, Lamp & Ergonomic Chair ----------
  _buildDeskAndChair() {
    const deskGroup = new THREE.Group();
    const deskX = -0.35;
    const deskZ = -0.95;
    const topY = 0.75;
    const topThick = 0.042;
    const deskW = 2.18;
    const deskD = 0.9;

    const walnutTex = createWoodTexture({
      base: '#6d472c',
      grain: '#3c2414',
      plankLines: false,
      seed: 108,
      repeatX: 2.2,
      repeatY: 1.0,
    });
    const walnutMat = new THREE.MeshStandardMaterial({
      map: walnutTex,
      roughness: 0.34,
      metalness: 0.04,
    });
    const metalMat = new THREE.MeshStandardMaterial({
      color: 0x1e222a,
      roughness: 0.35,
      metalness: 0.82,
    });

    // Desktop surface (top at Y = 0.771)
    const desktop = new THREE.Mesh(new THREE.BoxGeometry(deskW, topThick, deskD), walnutMat);
    desktop.position.set(deskX, topY, deskZ);
    desktop.castShadow = true;
    desktop.receiveShadow = true;
    deskGroup.add(desktop);

    // Sturdy matte-black steel desk legs + crossbar
    for (const lx of [deskX - deskW / 2 + 0.12, deskX + deskW / 2 - 0.12]) {
      const legFront = new THREE.Mesh(new THREE.BoxGeometry(0.052, topY - 0.02, 0.052), metalMat);
      legFront.position.set(lx, (topY - 0.02) / 2, deskZ + deskD / 2 - 0.12);
      legFront.castShadow = true;
      deskGroup.add(legFront);

      const legBack = new THREE.Mesh(new THREE.BoxGeometry(0.052, topY - 0.02, 0.052), metalMat);
      legBack.position.set(lx, (topY - 0.02) / 2, deskZ - deskD / 2 + 0.12);
      legBack.castShadow = true;
      deskGroup.add(legBack);

      const footBar = new THREE.Mesh(new THREE.BoxGeometry(0.052, 0.036, deskD - 0.2), metalMat);
      footBar.position.set(lx, 0.022, deskZ);
      footBar.castShadow = true;
      deskGroup.add(footBar);

      const topBar = new THREE.Mesh(new THREE.BoxGeometry(0.052, 0.036, deskD - 0.2), metalMat);
      topBar.position.set(lx, topY - 0.04, deskZ);
      deskGroup.add(topBar);
    }
    // Under-desk stability beam & cable tray
    const beam = new THREE.Mesh(new THREE.BoxGeometry(deskW - 0.26, 0.045, 0.04), metalMat);
    beam.position.set(deskX, topY - 0.08, deskZ - 0.26);
    deskGroup.add(beam);

    // Surface Y of desktop
    const sy = topY + topThick / 2; // 0.771

    // Charcoal felt desk mat
    const matMesh = new THREE.Mesh(
      new THREE.BoxGeometry(1.06, 0.004, 0.44),
      new THREE.MeshStandardMaterial({ color: 0x1c2028, roughness: 0.92 })
    );
    matMesh.position.set(-0.56, sy + 0.002, -0.78);
    matMesh.receiveShadow = true;
    deskGroup.add(matMesh);

    // Mechanical 75% RGB Keyboard
    const kbGroup = new THREE.Group();
    const kbBody = new THREE.Mesh(
      new THREE.BoxGeometry(0.34, 0.018, 0.135),
      new THREE.MeshStandardMaterial({ color: 0x181c24, roughness: 0.35, metalness: 0.5 })
    );
    kbBody.castShadow = true;
    kbGroup.add(kbBody);

    // Subtle RGB underglow rim
    const kbGlow = new THREE.Mesh(
      new THREE.BoxGeometry(0.344, 0.004, 0.139),
      new THREE.MeshStandardMaterial({
        color: 0x7dcfff,
        emissive: 0x73daca,
        emissiveIntensity: 1.4,
      })
    );
    kbGlow.position.y = -0.006;
    kbGroup.add(kbGlow);

    // Sculpted keycap rows
    const keyMat = new THREE.MeshStandardMaterial({ color: 0x262c38, roughness: 0.55 });
    const accentKeyMat = new THREE.MeshStandardMaterial({ color: 0x2e6f7e, roughness: 0.45 });
    for (let r = 0; r < 5; r++) {
      for (let c = 0; c < 14; c++) {
        if (r === 4 && c >= 4 && c <= 9) continue; // Spacebar slot
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

    kbGroup.position.set(-0.62, sy + 0.013, -0.73);
    kbGroup.rotation.x = 0.06;
    deskGroup.add(kbGroup);

    // Sleek wireless ergonomic mouse
    const mouse = new THREE.Mesh(
      new THREE.SphereGeometry(0.042, 16, 12),
      new THREE.MeshStandardMaterial({ color: 0x20252f, roughness: 0.34, metalness: 0.2 })
    );
    mouse.scale.set(0.75, 0.45, 1.38);
    mouse.position.set(-0.24, sy + 0.018, -0.73);
    mouse.castShadow = true;
    deskGroup.add(mouse);

    // Pair of compact studio speakers with copper woofer cones flanking the monitor
    const copperMat = new THREE.MeshStandardMaterial({ color: 0xb87443, roughness: 0.3, metalness: 0.78 });
    for (const sx of [-1.06, -0.05]) {
      const spk = new THREE.Group();
      const cab = new THREE.Mesh(
        new THREE.BoxGeometry(0.11, 0.18, 0.13),
        new THREE.MeshStandardMaterial({ color: 0x191d24, roughness: 0.55 })
      );
      cab.position.y = 0.09;
      cab.castShadow = true;
      spk.add(cab);
      const woofer = new THREE.Mesh(new THREE.CylinderGeometry(0.036, 0.036, 0.01, 20), copperMat);
      woofer.rotation.x = Math.PI / 2;
      woofer.position.set(0, 0.065, 0.064);
      spk.add(woofer);
      const tweeter = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.01, 16), metalMat);
      tweeter.rotation.x = Math.PI / 2;
      tweeter.position.set(0, 0.135, 0.064);
      spk.add(tweeter);
      spk.position.set(sx, sy, -1.16);
      spk.rotation.y = sx < -0.5 ? 0.22 : -0.22;
      deskGroup.add(spk);
    }

    // Warm Brass & Matte-Black Architect Desk Lamp (left side of desk)
    const lampGroup = new THREE.Group();
    const brassMat = new THREE.MeshStandardMaterial({ color: 0xcfa463, roughness: 0.26, metalness: 0.85 });
    const lampBase = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.092, 0.022, 24), metalMat);
    lampBase.position.y = 0.011;
    lampBase.castShadow = true;
    lampGroup.add(lampBase);

    const arm1 = new THREE.Mesh(new THREE.CylinderGeometry(0.009, 0.01, 0.34, 10), brassMat);
    arm1.position.set(-0.02, 0.17, -0.02);
    arm1.rotation.z = 0.16;
    lampGroup.add(arm1);

    const arm2 = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.009, 0.26, 10), brassMat);
    arm2.position.set(0.06, 0.37, 0.04);
    arm2.rotation.z = -0.82;
    arm2.rotation.x = 0.35;
    lampGroup.add(arm2);

    const shade = new THREE.Mesh(new THREE.ConeGeometry(0.095, 0.13, 24, 1, true), metalMat);
    shade.position.set(0.16, 0.42, 0.09);
    shade.rotation.z = -0.35;
    shade.rotation.x = 0.22;
    shade.castShadow = true;
    lampGroup.add(shade);

    const bulb = new THREE.Mesh(
      new THREE.SphereGeometry(0.032, 12, 12),
      new THREE.MeshStandardMaterial({
        color: 0xfff0cc,
        emissive: 0xffc670,
        emissiveIntensity: 3.0,
      })
    );
    bulb.position.set(0.16, 0.39, 0.09);
    lampGroup.add(bulb);

    lampGroup.position.set(-1.26, sy, -1.12);
    deskGroup.add(lampGroup);

    // Ceramic coffee mug + cork coaster
    const coaster = new THREE.Mesh(
      new THREE.CylinderGeometry(0.048, 0.048, 0.006, 18),
      new THREE.MeshStandardMaterial({ color: 0xa67c52, roughness: 0.9 })
    );
    coaster.position.set(-1.18, sy + 0.003, -0.72);
    deskGroup.add(coaster);

    const mug = new THREE.Mesh(
      new THREE.CylinderGeometry(0.038, 0.034, 0.092, 20),
      new THREE.MeshStandardMaterial({ color: 0xeae5dc, roughness: 0.35 })
    );
    mug.position.set(-1.18, sy + 0.052, -0.72);
    mug.castShadow = true;
    deskGroup.add(mug);

    const coffee = new THREE.Mesh(
      new THREE.CylinderGeometry(0.033, 0.033, 0.005, 16),
      new THREE.MeshStandardMaterial({ color: 0x2b180e, roughness: 0.15 })
    );
    coffee.position.set(-1.18, sy + 0.088, -0.72);
    deskGroup.add(coffee);

    // Small desk succulent pot
    const sucPot = new THREE.Mesh(
      new THREE.CylinderGeometry(0.046, 0.036, 0.075, 16),
      new THREE.MeshStandardMaterial({ color: 0xc27756, roughness: 0.72 })
    );
    sucPot.position.set(-1.32, sy + 0.038, -0.84);
    sucPot.castShadow = true;
    deskGroup.add(sucPot);

    const sucMat = new THREE.MeshStandardMaterial({ color: 0x4f8459, roughness: 0.55 });
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const petal = new THREE.Mesh(new THREE.ConeGeometry(0.018, 0.055, 6), sucMat);
      petal.position.set(-1.32 + Math.cos(a) * 0.018, sy + 0.09, -0.84 + Math.sin(a) * 0.018);
      petal.rotation.set(Math.sin(a) * 0.5, 0, -Math.cos(a) * 0.5);
      deskGroup.add(petal);
    }

    this.scene.add(deskGroup);

    // ---------- Ergonomic Executive Mesh Office Chair ----------
    const chair = new THREE.Group();
    const chairFabric = new THREE.MeshStandardMaterial({ color: 0x252a34, roughness: 0.85 });
    const chairMeshMat = new THREE.MeshStandardMaterial({ color: 0x1b1f27, roughness: 0.75 });
    const chromeMat = new THREE.MeshStandardMaterial({ color: 0xc8d0da, roughness: 0.2, metalness: 0.9 });

    // 5-star caster base
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      const spoke = new THREE.Mesh(new THREE.BoxGeometry(0.034, 0.024, 0.3), metalMat);
      spoke.position.set(Math.sin(a) * 0.15, 0.065, Math.cos(a) * 0.15);
      spoke.rotation.y = a;
      chair.add(spoke);

      const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.032, 14), metalMat);
      wheel.rotation.z = Math.PI / 2;
      wheel.position.set(Math.sin(a) * 0.28, 0.026, Math.cos(a) * 0.28);
      chair.add(wheel);
    }

    // Pneumatic lift cylinder
    const cyl = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.03, 0.38, 16), chromeMat);
    cyl.position.y = 0.26;
    chair.add(cyl);

    // Contoured seat cushion
    const seat = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.075, 0.48), chairFabric);
    seat.position.set(0, 0.47, 0);
    seat.castShadow = true;
    seat.receiveShadow = true;
    chair.add(seat);

    // Spine + Backrest frame + breathable mesh back + headrest
    const spine = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.56, 0.04), metalMat);
    spine.position.set(0, 0.74, 0.25);
    spine.rotation.x = -0.09;
    chair.add(spine);

    const backFrame = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.54, 0.035), chairMeshMat);
    backFrame.position.set(0, 0.82, 0.22);
    backFrame.rotation.x = -0.09;
    backFrame.castShadow = true;
    chair.add(backFrame);

    const headrest = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.12, 0.055), chairFabric);
    headrest.position.set(0, 1.15, 0.24);
    headrest.rotation.x = 0.08;
    headrest.castShadow = true;
    chair.add(headrest);

    // Armrests
    for (const ax of [-0.27, 0.27]) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.21, 0.03), metalMat);
      post.position.set(ax, 0.57, 0.02);
      chair.add(post);
      const pad = new THREE.Mesh(new THREE.BoxGeometry(0.065, 0.028, 0.24), chairMeshMat);
      pad.position.set(ax, 0.68, 0.0);
      chair.add(pad);
    }

    chair.position.set(-0.56, 0, -0.08);
    chair.rotation.y = 0.34; // Natural inviting angle
    this.scene.add(chair);
  }

  // ---------- 7. Omarchy Linux 34" Monitor ----------
  _buildOmarchyMonitor() {
    const sy = 0.771;
    const monGroup = new THREE.Group();
    monGroup.position.set(-0.56, sy, -1.16);

    const bezelMat = new THREE.MeshStandardMaterial({ color: 0x151820, roughness: 0.32, metalness: 0.6 });
    const standMat = new THREE.MeshStandardMaterial({ color: 0x222731, roughness: 0.28, metalness: 0.82 });

    // Sleek V-base stand + ergonomic neck
    const basePlate = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.012, 0.21), standMat);
    basePlate.position.set(0, 0.006, 0.01);
    basePlate.castShadow = true;
    monGroup.add(basePlate);

    const neck = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.36, 0.032), standMat);
    neck.position.set(0, 0.19, -0.05);
    neck.rotation.x = 0.08;
    neck.castShadow = true;
    monGroup.add(neck);

    // Monitor chassis (exact 5:3 display ratio matching 1600x960 OmarchyScreen)
    const screenW = 0.82;
    const screenH = 0.492;
    const panelCenterY = 0.38;

    const body = new THREE.Mesh(new THREE.BoxGeometry(screenW + 0.024, screenH + 0.032, 0.028), bezelMat);
    body.position.set(0, panelCenterY, 0);
    body.castShadow = true;
    body.userData.camPreset = 'monitor';
    this.clickableMeshes.push(body);
    monGroup.add(body);

    // Subtle chin power LED
    const led = new THREE.Mesh(
      new THREE.BoxGeometry(0.018, 0.004, 0.004),
      new THREE.MeshBasicMaterial({ color: 0x73daca })
    );
    led.position.set(screenW / 2 - 0.05, panelCenterY - screenH / 2 - 0.008, 0.015);
    monGroup.add(led);

    // Live Omarchy Linux CanvasTexture display surface
    const screenMat = new THREE.MeshStandardMaterial({
      map: this.omarchyScreen.texture,
      emissiveMap: this.omarchyScreen.texture,
      emissive: new THREE.Color(0xffffff),
      emissiveIntensity: 0.82,
      roughness: 0.18,
      metalness: 0.05,
    });
    const screenMesh = new THREE.Mesh(new THREE.PlaneGeometry(screenW, screenH), screenMat);
    screenMesh.position.set(0, panelCenterY + 0.003, 0.0155);
    screenMesh.userData.camPreset = 'monitor';
    this.clickableMeshes.push(screenMesh);
    monGroup.add(screenMesh);

    this.scene.add(monGroup);
  }

  // ---------- 8. Beefed-Up Corsair Tower with Glass Side Panel, RGB Fans & RTX 5090 ----------
  _buildCorsairRTX5090PC() {
    const sy = 0.771;
    const pc = new THREE.Group();
    pc.position.set(0.42, sy, -0.96);
    pc.rotation.y = -0.32; // Angled toward viewer so glass side panel & RTX 5090 shine clearly!

    const W = 0.255;
    const H = 0.51;
    const D = 0.49;

    const caseMat = new THREE.MeshStandardMaterial({ color: 0x181b22, roughness: 0.36, metalness: 0.68 });
    const darkSteel = new THREE.MeshStandardMaterial({ color: 0x111419, roughness: 0.45, metalness: 0.72 });
    const meshGrillMat = new THREE.MeshStandardMaterial({ color: 0x1f242e, roughness: 0.55, metalness: 0.65 });

    // Rubber case feet
    for (const fx of [-W / 2 + 0.032, W / 2 - 0.032]) {
      for (const fz of [-D / 2 + 0.045, D / 2 - 0.045]) {
        const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.018, 12), darkSteel);
        foot.position.set(fx, 0.009, fz);
        pc.add(foot);
      }
    }

    const baseY = 0.018;
    const addPanel = (pw, ph, pd, x, y, z, mat = caseMat) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(pw, ph, pd), mat);
      m.position.set(x, baseY + y, z);
      m.castShadow = true;
      m.receiveShadow = true;
      m.userData.camPreset = 'pc';
      this.clickableMeshes.push(m);
      pc.add(m);
      return m;
    };

    // Bottom, top frame, right solid panel, rear panel, front perimeter rails (open left side for glass!)
    addPanel(W, 0.016, D, 0, 0.008, 0);
    addPanel(W, 0.018, D, 0, H - 0.009, 0);
    addPanel(0.014, H, D, W / 2 - 0.007, H / 2, 0); // Right side panel (behind motherboard tray)
    addPanel(W, H, 0.014, 0, H / 2, -D / 2 + 0.007); // Rear I/O panel

    // Front Airflow Mesh Panel (semi-transparent slatted grille so 3 front RGB fans glow through)
    addPanel(0.022, H, 0.022, -W / 2 + 0.011, H / 2, D / 2 - 0.011);
    addPanel(0.022, H, 0.022, W / 2 - 0.011, H / 2, D / 2 - 0.011);
    addPanel(W, 0.042, 0.022, 0, H - 0.021, D / 2 - 0.011);
    addPanel(W, 0.068, 0.022, 0, 0.034, D / 2 - 0.011);
    // Horizontal airflow louvers across front
    for (let i = 0; i < 16; i++) {
      const bar = new THREE.Mesh(new THREE.BoxGeometry(W - 0.044, 0.005, 0.012), meshGrillMat);
      bar.position.set(0, baseY + 0.08 + i * 0.024, D / 2 - 0.008);
      pc.add(bar);
    }

    // Front Corsair Logo Badge
    const corsairFrontTex = createLabelTexture({
      width: 512,
      height: 128,
      bg: '#161a22',
      draw: (ctx, cw, ch) => {
        // Stylized triple-sail emblem
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
      new THREE.MeshStandardMaterial({ map: corsairFrontTex, roughness: 0.35 })
    );
    frontBadge.position.set(0, baseY + 0.036, D / 2 + 0.002);
    pc.add(frontBadge);

    // PSU Shroud along bottom interior with crisp CORSAIR branding facing through glass
    const psuShroud = addPanel(W - 0.03, 0.105, D - 0.04, 0.005, 0.066, -0.005, darkSteel);
    const psuBadge = new THREE.Mesh(
      new THREE.PlaneGeometry(0.17, 0.042),
      new THREE.MeshStandardMaterial({
        map: corsairFrontTex,
        emissiveMap: corsairFrontTex,
        emissive: 0xffffff,
        emissiveIntensity: 0.25,
        roughness: 0.3,
      })
    );
    psuBadge.rotation.y = -Math.PI / 2;
    psuBadge.position.set(-W / 2 + 0.017, baseY + 0.068, 0.04);
    pc.add(psuBadge);

    // ATX Motherboard mounted on right tray (facing -X toward the glass panel)
    const mbX = W / 2 - 0.034;
    const mobo = new THREE.Mesh(
      new THREE.BoxGeometry(0.012, 0.31, 0.26),
      new THREE.MeshStandardMaterial({ color: 0x141820, roughness: 0.5, metalness: 0.35 })
    );
    mobo.position.set(mbX, baseY + 0.295, -0.065);
    pc.add(mobo);

    // VRM metallic heatsinks on motherboard
    const vrmMat = new THREE.MeshStandardMaterial({ color: 0x2c3340, roughness: 0.28, metalness: 0.85 });
    const vrmRear = new THREE.Mesh(new THREE.BoxGeometry(0.026, 0.12, 0.042), vrmMat);
    vrmRear.position.set(mbX - 0.015, baseY + 0.36, -0.165);
    pc.add(vrmRear);
    const vrmTop = new THREE.Mesh(new THREE.BoxGeometry(0.026, 0.032, 0.12), vrmMat);
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

    // Corsair iCUE Liquid AIO CPU Pump Head (glowing ring) + Top 360mm Radiator + Braided Tubes
    const pumpBody = new THREE.Mesh(new THREE.CylinderGeometry(0.034, 0.036, 0.045, 8), darkSteel);
    pumpBody.rotation.z = Math.PI / 2;
    pumpBody.position.set(mbX - 0.028, baseY + 0.34, -0.085);
    pc.add(pumpBody);

    const pumpRingMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      emissive: new THREE.Color('#73daca'),
      emissiveIntensity: 2.6,
    });
    const pumpRing = new THREE.Mesh(new THREE.TorusGeometry(0.022, 0.004, 10, 24), pumpRingMat);
    pumpRing.rotation.y = Math.PI / 2;
    pumpRing.position.set(mbX - 0.052, baseY + 0.34, -0.085);
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

    // Helper to build an animated Corsair RGB Fan
    const buildRgbFan = (radius = 0.054, phase = 0) => {
      const fg = new THREE.Group();
      const housing = new THREE.Mesh(
        new THREE.BoxGeometry(radius * 2.08, radius * 2.08, 0.022),
        darkSteel
      );
      fg.add(housing);

      const ringMat = new THREE.MeshStandardMaterial({
        color: 0xffffff,
        emissive: new THREE.Color('#7dcfff'),
        emissiveIntensity: 2.3,
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
      const bladeMat = new THREE.MeshStandardMaterial({
        color: 0xd9ecff,
        transparent: true,
        opacity: 0.78,
        roughness: 0.25,
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

    // 3× Front 120mm RGB Intake Fans
    [0.145, 0.268, 0.391].forEach((fy, idx) => {
      const f = buildRgbFan(0.056, idx * 0.9);
      f.position.set(0.005, baseY + fy, D / 2 - 0.036);
      pc.add(f);
    });
    // 2× Top Radiator RGB Exhaust Fans
    [-0.08, 0.055].forEach((fz, idx) => {
      const f = buildRgbFan(0.056, 2.5 + idx * 0.8);
      f.rotation.x = Math.PI / 2;
      f.position.set(0.01, baseY + H - 0.064, fz);
      pc.add(f);
    });
    // 1× Rear 120mm RGB Exhaust Fan
    const rearFan = buildRgbFan(0.052, 4.1);
    rearFan.position.set(0.005, baseY + 0.365, -D / 2 + 0.03);
    pc.add(rearFan);

    // ---------- Flagship NVIDIA GeForce RTX 5090 GPU (Visible & Clearly Labelled RTX 5090!) ----------
    const gpu = new THREE.Group();
    const gpuLen = 0.335; // Z length inside case
    const gpuHeight = 0.068; // Massive triple-slot thickness
    const gpuWidth = 0.138; // X width from motherboard toward glass side panel

    const gpuShroudMat = new THREE.MeshStandardMaterial({
      color: 0x20252e,
      roughness: 0.28,
      metalness: 0.84,
    });
    const gpuTrimMat = new THREE.MeshStandardMaterial({
      color: 0x8a93a2,
      roughness: 0.24,
      metalness: 0.9,
    });
    const gpuFinMat = new THREE.MeshStandardMaterial({
      color: 0x3a404c,
      roughness: 0.4,
      metalness: 0.8,
    });

    const gpuBody = new THREE.Mesh(new THREE.BoxGeometry(gpuWidth, gpuHeight, gpuLen), gpuShroudMat);
    gpuBody.castShadow = true;
    gpuBody.userData.camPreset = 'pc';
    this.clickableMeshes.push(gpuBody);
    gpu.add(gpuBody);

    // Chamfered brushed-titanium Founder-style frame strips
    const topTrim = new THREE.Mesh(new THREE.BoxGeometry(gpuWidth + 0.004, 0.007, gpuLen + 0.004), gpuTrimMat);
    topTrim.position.y = gpuHeight / 2;
    gpu.add(topTrim);
    const botTrim = new THREE.Mesh(new THREE.BoxGeometry(gpuWidth + 0.004, 0.007, gpuLen + 0.004), gpuTrimMat);
    botTrim.position.y = -gpuHeight / 2;
    gpu.add(botTrim);

    // Exposed radiator cooling fin stack along the front half
    for (let f = 0; f < 14; f++) {
      const fin = new THREE.Mesh(new THREE.BoxGeometry(0.008, gpuHeight * 0.72, 0.004), gpuFinMat);
      fin.position.set(-gpuWidth / 2 - 0.001, 0, -gpuLen / 2 + 0.025 + f * 0.009);
      gpu.add(fin);
    }

    // Crisp illuminated side-edge label facing directly out through the tempered glass: "GEFORCE RTX 5090"
    const gpuSideTex = createLabelTexture({
      width: 1024,
      height: 220,
      bg: '#161a21',
      border: '#5a6678',
      draw: (ctx, cw, ch) => {
        // Subtle metallic brushed horizontal gradient
        const g = ctx.createLinearGradient(0, 0, cw, 0);
        g.addColorStop(0, '#181c24');
        g.addColorStop(0.5, '#252b36');
        g.addColorStop(1, '#161a22');
        ctx.fillStyle = g;
        ctx.fillRect(4, 4, cw - 8, ch - 8);

        // Glowing NVIDIA emerald accent bar on left
        ctx.fillStyle = '#76b900';
        ctx.fillRect(28, 34, 16, ch - 68);

        // Crisp GEFORCE + bold RTX 5090 typography
        ctx.fillStyle = '#a8b6cc';
        ctx.font = '600 42px Inter, sans-serif';
        ctx.fillText('GEFORCE', 68, 92);

        ctx.fillStyle = '#ffffff';
        ctx.font = '900 106px Inter, sans-serif';
        ctx.fillText('RTX 5090', 64, 184);

        // 32GB GDDR7 pill on right
        ctx.fillStyle = 'rgba(118, 185, 0, 0.22)';
        ctx.fillRect(cw - 260, 74, 224, 72);
        ctx.strokeStyle = '#76b900';
        ctx.lineWidth = 3;
        ctx.strokeRect(cw - 260, 74, 224, 72);
        ctx.fillStyle = '#b9f542';
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
        emissiveIntensity: 0.72,
        roughness: 0.24,
      })
    );
    gpuSideLabel.rotation.y = -Math.PI / 2;
    gpuSideLabel.position.set(-gpuWidth / 2 - 0.0025, 0, 0);
    gpuSideLabel.userData.camPreset = 'pc';
    this.clickableMeshes.push(gpuSideLabel);
    gpu.add(gpuSideLabel);

    // Top Backplate metallic silkscreen label: "RTX 5090" (also clearly visible from elevated overview!)
    const gpuTopTex = createLabelTexture({
      width: 1024,
      height: 440,
      bg: '#1c2029',
      border: '#495264',
      draw: (ctx, cw, ch) => {
        // Flow-through vent stripes on front side
        ctx.fillStyle = '#0e1117';
        for (let i = 0; i < 9; i++) {
          ctx.fillRect(660 + i * 32, 46, 18, ch - 92);
        }
        ctx.fillStyle = '#76b900';
        ctx.fillRect(46, 52, 16, ch - 104);

        ctx.fillStyle = '#dfe8f7';
        ctx.font = '900 124px Inter, sans-serif';
        ctx.fillText('RTX 5090', 86, 250);
        ctx.fillStyle = '#9aa9c4';
        ctx.font = '600 40px monospace';
        ctx.fillText('NVIDIA FOUNDERS ARCH', 90, 326);
      },
    });
    const gpuTopPlate = new THREE.Mesh(
      new THREE.PlaneGeometry(gpuLen * 0.94, gpuWidth * 0.9),
      new THREE.MeshStandardMaterial({
        map: gpuTopTex,
        emissiveMap: gpuTopTex,
        emissive: 0xffffff,
        emissiveIntensity: 0.34,
        roughness: 0.28,
        metalness: 0.55,
      })
    );
    gpuTopPlate.rotation.x = -Math.PI / 2;
    gpuTopPlate.rotation.z = -Math.PI / 2;
    gpuTopPlate.position.set(0, gpuHeight / 2 + 0.0045, 0);
    gpu.add(gpuTopPlate);

    // Braided 12VHPWR power cable curving smoothly from GPU edge into PSU shroud
    const pwrCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-gpuWidth / 2 + 0.01, -0.004, 0.055),
      new THREE.Vector3(-gpuWidth / 2 - 0.025, -0.02, 0.068),
      new THREE.Vector3(-gpuWidth / 2 - 0.015, -0.085, 0.072),
      new THREE.Vector3(0.01, -0.115, 0.072),
    ]);
    gpu.add(
      new THREE.Mesh(
        new THREE.TubeGeometry(pwrCurve, 12, 0.008, 8, false),
        new THREE.MeshStandardMaterial({ color: 0x202630, roughness: 0.78 })
      )
    );

    gpu.position.set(mbX - gpuWidth / 2 - 0.014, baseY + 0.215, -0.028);
    pc.add(gpu);

    // Tempered Glass Left Side Panel (crystal clear with slight smoky tint & 4 thumbscrews)
    const glassMat = new THREE.MeshPhysicalMaterial({
      color: 0xddeeff,
      transparent: true,
      opacity: 0.14,
      roughness: 0.06,
      metalness: 0.05,
      reflectivity: 0.85,
      clearcoat: 1.0,
      clearcoatRoughness: 0.05,
      depthWrite: false,
    });
    const glassPanel = new THREE.Mesh(new THREE.BoxGeometry(0.005, H - 0.032, D - 0.036), glassMat);
    glassPanel.position.set(-W / 2 + 0.003, baseY + H / 2, 0);
    glassPanel.userData.camPreset = 'pc';
    this.clickableMeshes.push(glassPanel);
    pc.add(glassPanel);

    // Subtle dark bezel border around tempered glass + 4 knurled metallic thumbscrews
    const screwMat = new THREE.MeshStandardMaterial({ color: 0x9aa4b4, roughness: 0.25, metalness: 0.9 });
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

    // Sleek Walnut & Matte-Black Steel Server Credenza along the right wall
    const credW = 0.62;
    const credH = 0.66;
    const credD = 1.48;
    const credWoodTex = createWoodTexture({
      base: '#68452c',
      grain: '#3c2415',
      plankLines: false,
      seed: 211,
      repeatX: 1,
      repeatY: 2,
    });
    const credWoodMat = new THREE.MeshStandardMaterial({ map: credWoodTex, roughness: 0.38 });
    const frameMat = new THREE.MeshStandardMaterial({ color: 0x1a1e26, roughness: 0.38, metalness: 0.78 });

    const credTop = new THREE.Mesh(new THREE.BoxGeometry(credW, 0.036, credD), credWoodMat);
    credTop.position.set(0, credH, 0);
    credTop.castShadow = true;
    credTop.receiveShadow = true;
    clusterGroup.add(credTop);

    const credBody = new THREE.Mesh(new THREE.BoxGeometry(credW - 0.06, 0.42, credD - 0.08), frameMat);
    credBody.position.set(0, credH - 0.23, 0);
    credBody.castShadow = true;
    credBody.receiveShadow = true;
    clusterGroup.add(credBody);

    // Slatted walnut cabinet doors on front of credenza
    for (let i = 0; i < 3; i++) {
      const door = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.36, 0.42), credWoodMat);
      door.position.set(-credW / 2 + 0.025, credH - 0.23, -0.44 + i * 0.44);
      clusterGroup.add(door);
    }

    // 4 short steel legs
    for (const lx of [-credW / 2 + 0.06, credW / 2 - 0.06]) {
      for (const lz of [-credD / 2 + 0.08, credD / 2 - 0.08]) {
        const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.014, 0.22, 10), frameMat);
        leg.position.set(lx, 0.11, lz);
        leg.castShadow = true;
        clusterGroup.add(leg);
      }
    }

    const topSurfY = credH + 0.018; // 0.678

    // ---------- Stack of 8 DGX Spark Machines (Compact Matte-Black Anodized Boxes) ----------
    const sparkW = 0.24; // X depth
    const sparkH = 0.056; // Y height per unit
    const sparkD = 0.24; // Z width
    const sparkGap = 0.008; // Spacer feet gap
    const stackZ = -0.26;
    const stackX = -0.02;

    const sparkCaseMat = new THREE.MeshStandardMaterial({
      color: 0x12151a,
      roughness: 0.34,
      metalness: 0.72,
    });
    const sparkGoldTrim = new THREE.MeshStandardMaterial({
      color: 0xc2a167,
      roughness: 0.32,
      metalness: 0.82,
    });

    const sparkPortPositions = [];

    for (let i = 0; i < 8; i++) {
      const nodeNum = String(i + 1).padStart(2, '0');
      const unitY = topSurfY + sparkGap + i * (sparkH + sparkGap) + sparkH / 2;
      const unit = new THREE.Group();

      // Matte-black machined chassis
      const chassis = new THREE.Mesh(new THREE.BoxGeometry(sparkW, sparkH, sparkD), sparkCaseMat);
      chassis.castShadow = true;
      chassis.receiveShadow = true;
      chassis.userData.camPreset = 'cluster';
      this.clickableMeshes.push(chassis);
      unit.add(chassis);

      // Subtle rubber stacking feet beneath each unit
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

      // Signature champagne-gold subtle side chamfer trim
      const trimTop = new THREE.Mesh(new THREE.BoxGeometry(sparkW + 0.002, 0.003, sparkD + 0.002), sparkGoldTrim);
      trimTop.position.y = sparkH / 2 - 0.002;
      unit.add(trimTop);

      // Crisp front faceplate texture facing -X (toward the office room) with diamond mesh & DGX SPARK label
      const faceTex = createLabelTexture({
        width: 512,
        height: 128,
        bg: '#101318',
        border: '#6e5c3d',
        draw: (ctx, cw, ch) => {
          // Signature geometric faceted front grille texture on left half
          ctx.strokeStyle = 'rgba(194, 161, 103, 0.35)';
          ctx.lineWidth = 2;
          for (let gx = 16; gx < 215; gx += 18) {
            ctx.beginPath();
            ctx.moveTo(gx, 14);
            ctx.lineTo(gx + 14, ch / 2);
            ctx.lineTo(gx, ch - 14);
            ctx.stroke();
          }
          // DGX SPARK typography
          ctx.fillStyle = '#e8dec8';
          ctx.font = 'bold 34px Inter, sans-serif';
          ctx.fillText('DGX SPARK', 238, 62);
          ctx.fillStyle = '#76b900';
          ctx.font = 'bold 24px monospace';
          ctx.fillText(`NODE ${nodeNum}  ·  100GbE`, 240, 100);
        },
      });
      const facePlate = new THREE.Mesh(
        new THREE.PlaneGeometry(sparkD * 0.95, sparkH * 0.86),
        new THREE.MeshStandardMaterial({
          map: faceTex,
          emissiveMap: faceTex,
          emissive: 0xffffff,
          emissiveIntensity: 0.24,
          roughness: 0.32,
          metalness: 0.45,
        })
      );
      facePlate.rotation.y = -Math.PI / 2;
      facePlate.position.set(-sparkW / 2 - 0.0018, 0, 0);
      facePlate.userData.camPreset = 'cluster';
      this.clickableMeshes.push(facePlate);
      unit.add(facePlate);

      // Pulsing emerald status LED on front-right corner
      const ledMat = new THREE.MeshStandardMaterial({
        color: 0x76b900,
        emissive: 0x76b900,
        emissiveIntensity: 2.2,
      });
      const led = new THREE.Mesh(new THREE.BoxGeometry(0.004, 0.008, 0.008), ledMat);
      led.position.set(-sparkW / 2 - 0.002, 0.01, sparkD / 2 - 0.02);
      this.sparkLeds.push({ mat: ledMat, phase: i * 0.72 });
      unit.add(led);

      // High-speed QSFP / Ethernet transceiver port on the +Z side (facing the MikroTik CRS804 switch)
      const portCollar = new THREE.Mesh(
        new THREE.BoxGeometry(0.024, 0.016, 0.014),
        new THREE.MeshStandardMaterial({ color: 0x7a8599, roughness: 0.3, metalness: 0.85 })
      );
      const portLocalX = -0.065 + (i % 2) * 0.032;
      portCollar.position.set(portLocalX, 0, sparkD / 2 + 0.005);
      unit.add(portCollar);

      unit.position.set(stackX, unitY, stackZ);
      clusterGroup.add(unit);

      // Record exact port anchor in clusterGroup space for patch cable termination
      sparkPortPositions.push(new THREE.Vector3(stackX + portLocalX, unitY, stackZ + sparkD / 2 + 0.012));
    }

    // ---------- MikroTik CRS804 High-Speed Switch (beside the 8× DGX Spark stack) ----------
    const swW = 0.22; // X depth
    const swH = 0.052; // Y height
    const swD = 0.34; // Z width
    const swX = -0.02;
    const swZ = 0.34;
    const swY = topSurfY + swH / 2 + 0.004;

    const switchGroup = new THREE.Group();
    const swChassisMat = new THREE.MeshStandardMaterial({
      color: 0x242a34,
      roughness: 0.32,
      metalness: 0.76,
    });
    const swSilverMat = new THREE.MeshStandardMaterial({
      color: 0xc2ccd8,
      roughness: 0.28,
      metalness: 0.82,
    });

    const swBody = new THREE.Mesh(new THREE.BoxGeometry(swW, swH, swD), swChassisMat);
    swBody.castShadow = true;
    swBody.receiveShadow = true;
    swBody.userData.camPreset = 'cluster';
    this.clickableMeshes.push(swBody);
    switchGroup.add(swBody);

    // Subtle top silver lid with bold "MikroTik CRS804" silkscreen
    const swTopTex = createLabelTexture({
      width: 512,
      height: 320,
      bg: '#232934',
      border: '#5f6c80',
      draw: (ctx, cw, ch) => {
        ctx.fillStyle = '#dce6f5';
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
        emissiveIntensity: 0.22,
        roughness: 0.3,
      })
    );
    swTopLabel.rotation.x = -Math.PI / 2;
    swTopLabel.rotation.z = -Math.PI / 2;
    swTopLabel.position.y = swH / 2 + 0.0015;
    switchGroup.add(swTopLabel);

    // Front face of MikroTik CRS804 facing -X (toward room) with port cages & branding
    const swFrontTex = createLabelTexture({
      width: 640,
      height: 112,
      bg: '#1c222c',
      border: '#8f9eb3',
      draw: (ctx, cw, ch) => {
        ctx.fillStyle = '#edf4ff';
        ctx.font = 'bold 30px Inter, sans-serif';
        ctx.fillText('MikroTik', 20, 46);
        ctx.fillStyle = '#7dcfff';
        ctx.font = 'bold 34px monospace';
        ctx.fillText('CRS804', 20, 88);

        // Drawn port labels
        ctx.fillStyle = '#9db0cc';
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
        emissiveIntensity: 0.3,
        roughness: 0.28,
      })
    );
    swFront.rotation.y = -Math.PI / 2;
    swFront.position.set(-swW / 2 - 0.0015, 0, 0);
    swFront.userData.camPreset = 'cluster';
    this.clickableMeshes.push(swFront);
    switchGroup.add(swFront);

    // 8 Blinking Activity/Link LEDs along front edge of CRS804
    for (let l = 0; l < 8; l++) {
      const isAmber = l % 3 === 0;
      const ledMat = new THREE.MeshStandardMaterial({
        color: isAmber ? 0xffb74d : 0x33ff88,
        emissive: isAmber ? 0xffb74d : 0x33ff88,
        emissiveIntensity: 2.4,
      });
      const led = new THREE.Mesh(new THREE.BoxGeometry(0.004, 0.006, 0.006), ledMat);
      led.position.set(-swW / 2 - 0.0025, 0.014, -0.055 + l * 0.028);
      this.switchLeds.push({ mat: ledMat, phase: l * 1.13, rate: 5 + (l % 4) * 2.5 });
      switchGroup.add(led);
    }

    // 8 breakout / QSFP port collars on the -Z edge (facing the DGX Spark stack) for neat cable routing
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

    // ---------- Realistic Curved Network Patch Cables Connecting CRS804 to All 8 DGX Sparks ----------
    const cableColors = [0x2ec4b6, 0x3a86ff, 0x2ec4b6, 0x3a86ff, 0x2ec4b6, 0x3a86ff, 0x2ec4b6, 0x3a86ff];
    const bootMat = new THREE.MeshStandardMaterial({ color: 0x161a22, roughness: 0.55 });

    for (let i = 0; i < 8; i++) {
      const pStart = switchPortPositions[i];
      const pEnd = sparkPortPositions[i];
      const arcOutX = -0.055 - (i % 4) * 0.014; // Clean layered waterfall so cables never collide
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

      const cableMat = new THREE.MeshStandardMaterial({
        color: cableColors[i],
        roughness: 0.42,
        metalness: 0.18,
      });
      const cableMesh = new THREE.Mesh(new THREE.TubeGeometry(curve, 22, 0.0046, 8, false), cableMat);
      cableMesh.castShadow = true;
      clusterGroup.add(cableMesh);

      // Connector boots at both ends
      const b1 = new THREE.Mesh(new THREE.CylinderGeometry(0.0062, 0.0062, 0.022, 8), bootMat);
      b1.rotation.x = Math.PI / 2;
      b1.position.copy(pStart).add(new THREE.Vector3(0, 0, -0.008));
      clusterGroup.add(b1);

      const b2 = new THREE.Mesh(new THREE.CylinderGeometry(0.0062, 0.0062, 0.022, 8), bootMat);
      b2.rotation.x = Math.PI / 2;
      b2.position.copy(pEnd).add(new THREE.Vector3(0, 0, 0.008));
      clusterGroup.add(b2);
    }

    // Main fiber uplink cable from CRS804 running cleanly down the back edge of the credenza
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

  // ---------- 10. Volumetric Sunbeams & Soft Drifting Dust Motes ----------
  _buildSunbeamsAndDust() {
    const beamMat = new THREE.MeshBasicMaterial({
      color: 0xffd79c,
      transparent: true,
      opacity: 0.08,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    this.beamMat = beamMat;

    const beamXs = [-1.7, -0.15, 1.4];
    for (const bx of beamXs) {
      const beam = new THREE.Mesh(new THREE.PlaneGeometry(1.15, 3.6), beamMat);
      beam.position.set(bx + 0.35, 1.48, -1.35);
      beam.rotation.x = -0.68;
      beam.rotation.y = 0.24;
      this.sunBeams.push(beam);
      this.scene.add(beam);
    }

    // Subtle sunlit dust motes floating in the window light
    const count = 90;
    const positions = new Float32Array(count * 3);
    const rng = mulberry32(707);
    for (let i = 0; i < count; i++) {
      positions[i * 3] = (rng() - 0.5) * 4.8;
      positions[i * 3 + 1] = 0.5 + rng() * 2.1;
      positions[i * 3 + 2] = -2.3 + rng() * 2.8;
    }
    const dustGeo = new THREE.BufferGeometry();
    dustGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const dustMat = new THREE.PointsMaterial({
      color: 0xffe4b8,
      size: 0.018,
      transparent: true,
      opacity: 0.35,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    this.dustPoints = new THREE.Points(dustGeo, dustMat);
    this.scene.add(this.dustPoints);
  }

  // ---------- Sky Mood Cycling ----------
  applySkyMood(index) {
    this.moodIndex = ((index % SKY_MOODS.length) + SKY_MOODS.length) % SKY_MOODS.length;
    const m = SKY_MOODS[this.moodIndex];

    this.skyUniforms.uZenith.value.copy(m.zenith);
    this.skyUniforms.uMid.value.copy(m.mid);
    this.skyUniforms.uHorizon.value.copy(m.horizon);
    this.skyUniforms.uSunColor.value.copy(m.sunColor);
    this.skyUniforms.uSunGlow.value.copy(m.sunGlow);
    this.skyUniforms.uSunDir.value.copy(m.sunDir);

    this.sunLight.color.setHex(m.dirLightColor);
    this.sunLight.intensity = m.dirLightIntensity;
    this.sunLight.position.copy(m.sunDir).multiplyScalar(14);

    this.hemiLight.color.setHex(m.hemiSky);
    this.hemiLight.groundColor.setHex(m.hemiGround);
    this.hemiLight.intensity = m.hemiIntensity;
    this.ambientLight.intensity = m.ambientIntensity;
    this.deskLampLight.intensity = m.lampIntensity;
    this.ceilingLight.intensity = m.ceilingIntensity;
    this.renderer.toneMappingExposure = m.exposure;

    for (const mat of this.buildingWindowMaterials) {
      mat.emissiveIntensity = m.windowLitBoost;
    }
    if (this.beamMat) {
      this.beamMat.color.setHex(m.dirLightColor);
      this.beamMat.opacity = m.beamOpacity;
    }

    return m;
  }

  nextSkyMood() {
    return this.applySkyMood(this.moodIndex + 1);
  }

  // ---------- Smooth Camera Preset Transitions & Raycasting ----------
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
      // Cancel preset tween if user starts dragging
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
  }

  start() {
    const loop = () => {
      requestAnimationFrame(loop);
      const dt = Math.min(this.clock.getDelta(), 0.05);
      const elapsed = this.clock.getElapsedTime();

      // Update camera preset smooth interpolation
      if (this.animatingCam) {
        const a = this.animatingCam;
        const t = Math.min(1, (elapsed - a.startTime) / a.duration);
        const ease = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
        this.camera.position.lerpVectors(a.fromPos, a.toPos, ease);
        this.controls.target.lerpVectors(a.fromTarget, a.toTarget, ease);
        if (t >= 1) this.animatingCam = null;
      }

      // Clamp camera gracefully inside the room walls
      this.camera.position.x = THREE.MathUtils.clamp(this.camera.position.x, -2.95, 2.95);
      this.camera.position.y = THREE.MathUtils.clamp(this.camera.position.y, 0.35, 2.88);
      this.camera.position.z = THREE.MathUtils.clamp(this.camera.position.z, -2.35, 2.65);

      this.controls.update();

      // Spin Corsair RGB fans
      for (const f of this.rgbFans) {
        f.rotor.rotation.z -= dt * f.speed;
      }

      // Smooth Tokyo Night RGB color cycle across Corsair fans, AIO pump, and DDR5 RAM
      const tmpColor = new THREE.Color();
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
        const hue = 0.52 + 0.12 * Math.sin(elapsed * 0.7);
        this.pcRgbLight.color.setHSL(hue, 0.8, 0.62);
      }

      // Pulse 8× DGX Spark status LEDs & blink MikroTik CRS804 network activity LEDs
      for (const s of this.sparkLeds) {
        s.mat.emissiveIntensity = 1.3 + 1.1 * Math.sin(elapsed * 2.4 + s.phase);
      }
      for (const l of this.switchLeds) {
        const blink = Math.sin(elapsed * l.rate + l.phase) > -0.15 ? 2.6 : 0.25;
        l.mat.emissiveIntensity = blink;
      }

      // Drift sky clouds lazily across the skyline
      for (const c of this.clouds) {
        c.position.x += dt * c.userData.speed;
        if (c.position.x > 82) c.position.x = -82;
      }

      // Gentle dust float
      if (this.dustPoints) {
        this.dustPoints.position.y = Math.sin(elapsed * 0.35) * 0.04;
      }

      // Tick live Omarchy Linux monitor texture
      this.omarchyScreen.tick(elapsed);

      this.renderer.render(this.scene, this.camera);
    };
    loop();
  }
}
