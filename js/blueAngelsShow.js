import * as THREE from 'three';

// 100% Continuous Closed-Loop Periodic Airshow Circuits (ZERO teleports, jumps, or jerky resets!)
const DIAMOND_PERIOD = 44.0;
const SOLO_PERIOD = 30.0;
const LUT_STEPS = 256;
const TRAIL_POINTS = 104;
const TRAIL_SAMPLE_DT = 0.042;
const TRAIL_MAX_AGE = 4.3;

// Tight Blue Angels Diamond formation offsets expressed in Boss (#1) local frame:
// (right = +X, up = +Y, forward = +Z).
const DIAMOND_OFFSETS = [
  new THREE.Vector3(0.0, 0.0, 0.0),      // #1 Boss (Lead)
  new THREE.Vector3(0.95, -0.10, -1.02), // #2 Right Wing
  new THREE.Vector3(-0.95, -0.10, -1.02),// #3 Left Wing
  new THREE.Vector3(0.0, -0.22, -2.04),  // #4 Slot
];

function smoothstep(edge0, edge1, x) {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

// Smooth periodic bump in [0, 1] returning 0 outside [a, d], peaking smoothly at 1 on [b, c]
function smoothBump(u, a, b, c, d) {
  return smoothstep(a, b, u) * (1.0 - smoothstep(c, d, u));
}

function createSmokeRibbonTexture() {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 128;
  const ctx = c.getContext('2d');
  ctx.clearRect(0, 0, 128, 128);

  const g = ctx.createLinearGradient(0, 0, 0, 128);
  g.addColorStop(0.0, 'rgba(255,255,255,0.0)');
  g.addColorStop(0.18, 'rgba(255,255,255,0.28)');
  g.addColorStop(0.38, 'rgba(255,255,255,0.82)');
  g.addColorStop(0.50, 'rgba(255,255,255,1.0)');
  g.addColorStop(0.62, 'rgba(255,255,255,0.82)');
  g.addColorStop(0.82, 'rgba(255,255,255,0.28)');
  g.addColorStop(1.0, 'rgba(255,255,255,0.0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);

  for (let i = 0; i < 28; i++) {
    const px = ((i * 47) % 128);
    const py = 46 + ((i * 29) % 36);
    const r = 10 + (i % 4) * 5;
    const pg = ctx.createRadialGradient(px, py, 1, px, py, r);
    pg.addColorStop(0, 'rgba(255,255,255,0.24)');
    pg.addColorStop(1, 'rgba(255,255,255,0.0)');
    ctx.fillStyle = pg;
    ctx.beginPath();
    ctx.arc(px, py, r, 0, Math.PI * 2);
    ctx.fill();
  }

  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

class SmokeTrailRibbon {
  constructor(texture) {
    this.samples = [];
    this.maxPoints = TRAIL_POINTS;

    const vertCount = this.maxPoints * 2;
    const positions = new Float32Array(vertCount * 3);
    const uvs = new Float32Array(vertCount * 2);
    const colors = new Float32Array(vertCount * 4);
    const indices = [];
    for (let i = 0; i < this.maxPoints - 1; i++) {
      const a = i * 2;
      const b = a + 1;
      const c = a + 2;
      const d = a + 3;
      indices.push(a, b, c, b, d, c);
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 4));
    geo.setIndex(indices);

    this.mat = new THREE.MeshBasicMaterial({
      map: texture,
      vertexColors: true,
      transparent: true,
      opacity: 0.78,
      depthWrite: false,
      side: THREE.DoubleSide,
      forceSinglePass: true,
      toneMapped: true,
    });
    this.tint = new THREE.Color(0xfff4e2);

    this.mesh = new THREE.Mesh(geo, this.mat);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 0;

    this._tmpDir = new THREE.Vector3();
    this._tmpCamDir = new THREE.Vector3();
    this._tmpSide = new THREE.Vector3();
  }

  setMoodStyle(hexColor, opacity) {
    this.tint.setHex(hexColor);
    this.mat.opacity = opacity;
  }

  pushSample(pos, age) {
    this.samples.unshift({ pos: pos.clone(), age });
    if (this.samples.length > this.maxPoints) {
      this.samples.length = this.maxPoints;
    }
  }

  advanceAges(dt) {
    for (let i = 0; i < this.samples.length; i++) {
      this.samples[i].age += dt;
      // Gentle San Francisco Bay sea-breeze drift & buoyancy
      this.samples[i].pos.x += dt * 0.11;
      this.samples[i].pos.y += dt * 0.03;
    }
    while (this.samples.length > 0 && this.samples[this.samples.length - 1].age > TRAIL_MAX_AGE) {
      this.samples.pop();
    }
  }

  updateGeometry(cameraPos) {
    const posAttr = this.mesh.geometry.attributes.position;
    const uvAttr = this.mesh.geometry.attributes.uv;
    const colAttr = this.mesh.geometry.attributes.color;
    const n = this.samples.length;

    const r = this.tint.r;
    const g = this.tint.g;
    const b = this.tint.b;

    for (let i = 0; i < this.maxPoints; i++) {
      const idx = Math.min(i, Math.max(0, n - 1));
      if (n < 2 || i >= n) {
        const last = n > 0 ? this.samples[n - 1].pos : null;
        const px = last ? last.x : 0;
        const py = last ? last.y : -100;
        const pz = last ? last.z : -20;
        posAttr.setXYZ(i * 2, px, py, pz);
        posAttr.setXYZ(i * 2 + 1, px, py, pz);
        colAttr.setXYZW(i * 2, r, g, b, 0);
        colAttr.setXYZW(i * 2 + 1, r, g, b, 0);
        continue;
      }

      const s = this.samples[idx];
      const prev = this.samples[Math.max(0, idx - 1)];
      const next = this.samples[Math.min(n - 1, idx + 1)];

      this._tmpDir.subVectors(prev.pos, next.pos);
      if (this._tmpDir.lengthSq() < 1e-6) {
        this._tmpDir.set(1, 0, 0);
      } else {
        this._tmpDir.normalize();
      }

      this._tmpCamDir.subVectors(cameraPos, s.pos).normalize();
      this._tmpSide.crossVectors(this._tmpDir, this._tmpCamDir);
      if (this._tmpSide.lengthSq() < 1e-6) {
        this._tmpSide.set(0, 1, 0);
      } else {
        this._tmpSide.normalize();
      }

      const ageNorm = Math.min(1.0, s.age / TRAIL_MAX_AGE);
      const halfW = 0.042 + Math.pow(ageNorm, 0.72) * 0.22;
      const headFade = smoothstep(0.0, 0.032, ageNorm);
      const tailFade = Math.pow(Math.max(0, 1.0 - ageNorm), 1.35);
      const alpha = headFade * tailFade;

      posAttr.setXYZ(
        i * 2,
        s.pos.x + this._tmpSide.x * halfW,
        s.pos.y + this._tmpSide.y * halfW,
        s.pos.z + this._tmpSide.z * halfW
      );
      posAttr.setXYZ(
        i * 2 + 1,
        s.pos.x - this._tmpSide.x * halfW,
        s.pos.y - this._tmpSide.y * halfW,
        s.pos.z - this._tmpSide.z * halfW
      );

      const uCoord = i * 0.22;
      uvAttr.setXY(i * 2, uCoord, 0);
      uvAttr.setXY(i * 2 + 1, uCoord, 1);

      colAttr.setXYZW(i * 2, r, g, b, alpha);
      colAttr.setXYZW(i * 2 + 1, r, g, b, alpha);
    }

    posAttr.needsUpdate = true;
    uvAttr.needsUpdate = true;
    colAttr.needsUpdate = true;
  }
}

/**
 * Closed, arc-length-parameterized 3D airshow circuit with a precomputed,
 * twist-free, singularity-free aerodynamic banked quaternion LUT.
 * Guarantees C1/C2 continuity around the entire closed loop (ZERO teleports or flips!).
 */
class ClosedFlightTrack {
  constructor(waypoints, period, rollFn = null, bankScale = 3.2) {
    this.curve = new THREE.CatmullRomCurve3(waypoints, true, 'centripetal');
    this.period = period;
    this.rollFn = rollFn;
    this.totalLength = this.curve.getLength();
    this.speed = this.totalLength / this.period;

    this.positions = new Array(LUT_STEPS + 1);
    this.tangents = new Array(LUT_STEPS + 1);
    this.quats = new Array(LUT_STEPS + 1);
    this.gLoad = new Array(LUT_STEPS + 1);

    this._buildContinuousFrames(bankScale);
  }

  _buildContinuousFrames(bankScale) {
    const N = LUT_STEPS;
    const worldUp = new THREE.Vector3(0, 1, 0);
    const eps = 1.0 / N;

    // 1. Sample exact arc-length positions & tangents
    for (let i = 0; i <= N; i++) {
      const u = (i % N) / N;
      this.positions[i] = this.curve.getPointAt(u);
      this.tangents[i] = this.curve.getTangentAt(u).normalize();
    }

    // 2. Parallel-transport a singularity-free reference Up vector around the closed loop,
    //    gently blending toward aerodynamic lift (worldUp + centripetal acceleration) so jets
    //    naturally bank into every turn and smoothly invert over the apex of vertical loops!
    const ups = new Array(N + 1);
    const fwd0 = this.tangents[0];
    const initRight = new THREE.Vector3().crossVectors(worldUp, fwd0).normalize();
    ups[0] = new THREE.Vector3().crossVectors(fwd0, initRight).normalize();

    const acc = new THREE.Vector3();
    const desiredUp = new THREE.Vector3();
    const rotAxis = new THREE.Vector3();
    const stepQ = new THREE.Quaternion();

    for (let i = 0; i < N; i++) {
      const fPrev = this.tangents[i];
      const fNext = this.tangents[i + 1];
      const fPrev2 = this.tangents[(i - 1 + N) % N];

      // Centripetal curvature acceleration vector (dT/du)
      acc.subVectors(fNext, fPrev2).multiplyScalar(0.5 / eps);
      this.gLoad[i] = Math.min(1.0, acc.length() / 12.0);

      // Parallel-transport previous Up to next tangent
      const uTransport = ups[i].clone();
      rotAxis.crossVectors(fPrev, fNext);
      if (rotAxis.lengthSq() > 1e-10) {
        rotAxis.normalize();
        const angle = Math.acos(Math.max(-1, Math.min(1, fPrev.dot(fNext))));
        stepQ.setFromAxisAngle(rotAxis, angle);
        uTransport.applyQuaternion(stepQ);
      }
      uTransport.addScaledVector(fNext, -uTransport.dot(fNext)).normalize();

      // Aerodynamic lift target: gravity up + inward turn/loop centripetal force
      desiredUp.copy(worldUp).addScaledVector(acc, bankScale * 0.085);
      desiredUp.addScaledVector(fNext, -desiredUp.dot(fNext));
      if (desiredUp.lengthSq() > 0.04) {
        desiredUp.normalize();
        // Only pull toward desiredUp when aligned within 110° so vertical loops stay 100% smooth & inverted at apex!
        if (desiredUp.dot(uTransport) > -0.35) {
          uTransport.lerp(desiredUp, 0.16).normalize();
        }
      }
      ups[i + 1] = uTransport;
    }
    this.gLoad[N] = this.gLoad[0];

    // 3. Measure any tiny residual holonomy twist between ups[N] and ups[0] in the exact right-hand basis
    //    around +fEnd (so rotating ups[N] by -residualTwist around +fEnd aligns it to ups[0] with < 1e-6 error!).
    const fEnd = this.tangents[0];
    const perp0 = new THREE.Vector3().crossVectors(fEnd, ups[0]).normalize();
    const cosT = Math.max(-1, Math.min(1, ups[N].dot(ups[0])));
    const sinT = ups[N].dot(perp0);
    const residualTwist = Math.atan2(sinT, cosT);

    const basis = new THREE.Matrix4();
    const right = new THREE.Vector3();
    const up = new THREE.Vector3();
    const twistQ = new THREE.Quaternion();

    for (let i = 0; i <= N; i++) {
      const frac = i / N;
      const fwd = this.tangents[i];
      up.copy(ups[i]);
      const extraRoll = -residualTwist * frac + (this.rollFn ? this.rollFn(frac) : 0.0);
      if (Math.abs(extraRoll) > 1e-6) {
        twistQ.setFromAxisAngle(fwd, extraRoll);
        up.applyQuaternion(twistQ);
      }
      up.addScaledVector(fwd, -up.dot(fwd)).normalize();
      right.crossVectors(up, fwd).normalize();
      up.crossVectors(fwd, right).normalize();
      basis.makeBasis(right, up, fwd);
      this.quats[i] = new THREE.Quaternion().setFromRotationMatrix(basis);
      // Enforce same quaternion hemisphere as previous sample so slerp always takes the shortest arc
      if (i > 0 && this.quats[i].dot(this.quats[i - 1]) < 0) {
        const q = this.quats[i];
        q.set(-q.x, -q.y, -q.z, -q.w);
      }
    }
    this.quats[N].copy(this.quats[0]);
    if (this.quats[N].dot(this.quats[N - 1]) < 0) {
      const q = this.quats[N];
      q.set(-q.x, -q.y, -q.z, -q.w);
    }
  }

  sample(t, outPos, outQuat, outFwd) {
    const u = (((t / this.period) % 1) + 1) % 1;
    const fIdx = u * LUT_STEPS;
    const i0 = Math.floor(fIdx) % LUT_STEPS;
    const i1 = i0 + 1;
    const alpha = fIdx - Math.floor(fIdx);

    outPos.lerpVectors(this.positions[i0], this.positions[i1], alpha);
    outFwd.lerpVectors(this.tangents[i0], this.tangents[i1], alpha).normalize();
    outQuat.slerpQuaternions(this.quats[i0], this.quats[i1], alpha);

    return {
      u,
      gLoad: this.gLoad[i0] * (1 - alpha) + this.gLoad[i1] * alpha,
      speed: this.speed,
    };
  }
}

export class BlueAngelsShow {
  constructor(scene, camera) {
    this.scene = scene;
    this.camera = camera;
    this.group = new THREE.Group();
    this.group.name = 'BlueAngelsAirshow';
    this.scene.add(this.group);

    this.jets = [];
    this.trails = [];
    this.jetMaterials = [];
    this.ready = false;

    // Start right as the 4-ship Diamond pulls up into the Bay Bridge vertical loop while both Solos converge!
    this.phaseOffset = 7.4;
    this.showTime = this.phaseOffset;
    this._sampleAccum = 0;

    this.smokeTex = createSmokeRibbonTexture();
    this._buildClosedTracks();

    // Reusable scratch vectors (zero per-frame allocations)
    this._bossPos = new THREE.Vector3();
    this._bossQuat = new THREE.Quaternion();
    this._bossFwd = new THREE.Vector3();
    this._bossRight = new THREE.Vector3();
    this._bossUp = new THREE.Vector3();
    this._jetPos = new THREE.Vector3();
    this._jetQuat = new THREE.Quaternion();
    this._jetFwd = new THREE.Vector3();
    this._jetVel = new THREE.Vector3();
    this._exhaust = new THREE.Vector3();
    this._toCam = new THREE.Vector3();
    this._rollQ = new THREE.Quaternion();
    this._audioMetrics = {
      intensity: 0.25,
      pan: 0,
      doppler: 1.0,
      brightness: 0.3,
      afterburner: 0.2,
      windowProximity: 0.65,
    };
  }

  _buildClosedTracks() {
    // 1. 4-Ship Diamond Continuous Closed San Francisco Bay Circuit (44 s):
    //    Left-to-right entry -> Giant 360° Vertical Loop over Bay Bridge -> Exit Aileron Roll ->
    //    High right skyline turn -> Upper sky Right-to-Left sweeping Barrel Roll & Fleur-de-Lis spread ->
    //    Smooth left skyline bank back into the Bay Bridge loop!
    const diamondPts = [
      new THREE.Vector3(-14.2, 3.65, -22.6), // Smooth entry from far-left bay
      new THREE.Vector3(-7.6, 3.05, -20.2),  // Low approach over left bay
      new THREE.Vector3(-1.4, 3.00, -19.6),  // Pull-up base over Bay Bridge!
      new THREE.Vector3(1.85, 4.45, -19.3),  // Vertical climb right side of loop (tilted nicely!)
      new THREE.Vector3(1.60, 6.75, -19.8),  // High climb toward apex
      new THREE.Vector3(-0.35, 7.55, -20.5), // Inverted apex high above Bay Bridge!
      new THREE.Vector3(-2.45, 6.25, -21.1), // Descending left arc of loop
      new THREE.Vector3(-1.95, 3.70, -20.9), // Pull-out dive
      new THREE.Vector3(0.90, 3.05, -20.1),  // Level pull-out accelerating right
      new THREE.Vector3(7.40, 3.55, -19.6),  // Fast exit right (360° formation roll!)
      new THREE.Vector3(13.6, 4.85, -21.2),  // Climbing right bank
      new THREE.Vector3(15.6, 6.15, -23.6),  // Far-right skyline turnaround
      new THREE.Vector3(10.8, 6.45, -23.8),  // High return entry
      new THREE.Vector3(4.20, 5.55, -20.6),  // Sweeping upper bay right-to-left
      new THREE.Vector3(-2.20, 5.15, -19.5), // Center-window high barrel roll!
      new THREE.Vector3(-8.80, 5.85, -20.4), // Left upper climb
      new THREE.Vector3(-14.8, 5.75, -22.8), // Far-left skyline turnaround
      new THREE.Vector3(-15.8, 4.65, -24.0), // Smooth descending left bank -> closes into pt 0!
    ];
    // Smooth periodic rolls: exact 2π on exit right (u ~ 0.36..0.50) + exact 2π on upper return (u ~ 0.68..0.84)
    const diamondRoll = (u) => {
      const r1 = smoothstep(0.36, 0.50, u) * Math.PI * 2.0;
      const r2 = smoothstep(0.68, 0.84, u) * Math.PI * 2.0;
      return r1 + r2;
    };
    this.diamondTrack = new ClosedFlightTrack(diamondPts, DIAMOND_PERIOD, diamondRoll, 3.8);

    // 2. Solo #5 Continuous Closed Circuit (30 s):
    //    Low fast Left-to-Right Bay Bridge Knife-Edge Pass -> Climbing Right Loop-back ->
    //    High Right-to-Left Inverted Mirror / Corkscrew Return -> Smooth Left Bank back in!
    const solo5Pts = [
      new THREE.Vector3(-14.8, 3.25, -20.8),
      new THREE.Vector3(-7.4, 3.00, -18.0),
      new THREE.Vector3(0.0, 3.15, -17.3),   // Low center Bay Bridge opposing cross!
      new THREE.Vector3(7.6, 3.55, -18.0),
      new THREE.Vector3(14.6, 4.95, -20.6),
      new THREE.Vector3(15.2, 6.65, -23.6),
      new THREE.Vector3(8.4, 6.85, -22.4),
      new THREE.Vector3(0.4, 6.05, -19.0),   // High return pass with crisp aileron roll
      new THREE.Vector3(-7.8, 6.55, -20.6),
      new THREE.Vector3(-14.8, 6.10, -23.2),
      new THREE.Vector3(-15.8, 4.55, -23.0),
    ];
    const solo5Roll = (u) => {
      // 90° knife-edge bank through the Bay Bridge pass + crisp full 360° roll on high return
      const knife = smoothBump(u, 0.08, 0.16, 0.24, 0.34) * (Math.PI * 0.48);
      const highRoll = smoothstep(0.56, 0.78, u) * Math.PI * 2.0;
      return knife + highRoll;
    };
    this.solo5Track = new ClosedFlightTrack(solo5Pts, SOLO_PERIOD, solo5Roll, 3.0);

    // 3. Solo #6 Continuous Closed Circuit (30 s, mirrored opposing X direction!):
    //    Low fast Right-to-Left Bay Bridge Opposing Knife-Edge Pass -> Climbing Left Turn ->
    //    High Left-to-Right Corkscrew Roll Return -> Smooth Right Bank back in!
    const solo6Pts = [
      new THREE.Vector3(14.8, 3.30, -21.2),
      new THREE.Vector3(7.4, 3.05, -18.5),
      new THREE.Vector3(-0.1, 3.18, -17.9),  // Opposing cross right beside #5!
      new THREE.Vector3(-7.6, 3.55, -18.5),
      new THREE.Vector3(-14.6, 4.95, -21.0),
      new THREE.Vector3(-15.2, 6.60, -23.8),
      new THREE.Vector3(-8.4, 6.35, -22.2),
      new THREE.Vector3(-0.2, 5.45, -18.8),  // Opposing high return pass
      new THREE.Vector3(7.8, 6.20, -20.4),
      new THREE.Vector3(14.8, 5.95, -23.2),
      new THREE.Vector3(15.8, 4.55, -23.2),
    ];
    const solo6Roll = (u) => {
      const knife = -smoothBump(u, 0.08, 0.16, 0.24, 0.34) * (Math.PI * 0.48);
      const highRoll = -smoothstep(0.56, 0.78, u) * Math.PI * 2.0;
      return knife + highRoll;
    };
    this.solo6Track = new ClosedFlightTrack(solo6Pts, SOLO_PERIOD, solo6Roll, 3.0);
  }

  attachModel(templateModel) {
    templateModel.traverse((obj) => {
      if (!obj.isMesh || !obj.material) return;
      obj.castShadow = false;
      obj.receiveShadow = false;
      const mn = obj.material.name || '';
      if (mn === 'BA_InsigniaBlue') {
        obj.material.color.setHex(0x0b3486);
        obj.material.metalness = 0.34;
        obj.material.roughness = 0.24;
        obj.material.emissive = new THREE.Color(0x0d2f7a);
        obj.material.emissiveIntensity = 0.42;
      } else if (mn === 'BA_InsigniaYellow') {
        obj.material.emissive = new THREE.Color(0xf8c922);
        obj.material.emissiveIntensity = 0.62;
      } else if (mn === 'BA_Afterburner') {
        obj.material.emissiveIntensity = 4.2;
      } else if (mn === 'BA_NoseLight') {
        obj.material.emissiveIntensity = 6.5;
      }
      this.jetMaterials.push(obj.material);
    });

    for (let i = 0; i < 6; i++) {
      const jet = i === 0 ? templateModel : templateModel.clone(true);
      jet.name = `BlueAngel_${i + 1}`;
      jet.scale.setScalar(1.12);
      this.group.add(jet);
      this.jets.push({
        mesh: jet,
        pos: new THREE.Vector3(),
        vel: new THREE.Vector3(),
        gLoad: 0,
      });

      const ribbon = new SmokeTrailRibbon(this.smokeTex);
      this.group.add(ribbon.mesh);
      this.trails.push(ribbon);
    }

    this.ready = true;
    this._prewarmTrails();
    window.__blueAngelsActive = true;
    window.__blueAngelsShow = this;
  }

  applySkyMood(moodId) {
    if (moodId === 'twilight') {
      for (const tr of this.trails) tr.setMoodStyle(0xdfd4ee, 0.66);
      for (const m of this.jetMaterials) {
        if (m.name === 'BA_InsigniaBlue') m.emissiveIntensity = 0.46;
        else if (m.name === 'BA_InsigniaYellow') m.emissiveIntensity = 0.68;
      }
    } else if (moodId === 'day') {
      for (const tr of this.trails) tr.setMoodStyle(0xffffff, 0.84);
      for (const m of this.jetMaterials) {
        if (m.name === 'BA_InsigniaBlue') m.emissiveIntensity = 0.28;
        else if (m.name === 'BA_InsigniaYellow') m.emissiveIntensity = 0.42;
      }
    } else {
      for (const tr of this.trails) tr.setMoodStyle(0xfff3de, 0.80);
      for (const m of this.jetMaterials) {
        if (m.name === 'BA_InsigniaBlue') m.emissiveIntensity = 0.42;
        else if (m.name === 'BA_InsigniaYellow') m.emissiveIntensity = 0.62;
      }
    }
  }

  _prewarmTrails() {
    const steps = 82;
    const startT = this.phaseOffset - steps * TRAIL_SAMPLE_DT;
    for (let s = 0; s <= steps; s++) {
      const t = startT + s * TRAIL_SAMPLE_DT;
      for (const tr of this.trails) tr.advanceAges(TRAIL_SAMPLE_DT);
      this._evaluateAndPlace(t, true);
    }
    for (const tr of this.trails) tr.updateGeometry(this.camera.position);
  }

  /**
   * Pure deterministic pose evaluator for any show timestamp `t` (used both live and by continuity tests).
   */
  evaluateJetPose(jetIdx, t, outPos, outQuat, outFwd) {
    if (jetIdx < 4) {
      const info = this.diamondTrack.sample(t, this._bossPos, this._bossQuat, this._bossFwd);
      this._bossRight.set(1, 0, 0).applyQuaternion(this._bossQuat);
      this._bossUp.set(0, 1, 0).applyQuaternion(this._bossQuat);

      // Gentle Fleur-de-Lis spread during upper sky return pass, tightening smoothly back into razor-tight Diamond
      const spread = 1.0 + 0.55 * smoothBump(info.u, 0.54, 0.64, 0.78, 0.90);
      const off = DIAMOND_OFFSETS[jetIdx];
      outPos.copy(this._bossPos)
        .addScaledVector(this._bossRight, off.x * spread)
        .addScaledVector(this._bossUp, off.y * spread)
        .addScaledVector(this._bossFwd, off.z * (1.0 + (spread - 1.0) * 0.45));
      outQuat.copy(this._bossQuat);
      outFwd.copy(this._bossFwd);
      return info;
    }

    const track = jetIdx === 4 ? this.solo5Track : this.solo6Track;
    // Offset solo phase slightly so both solos converge directly over the Bay Bridge right as Diamond climbs the loop!
    return track.sample(t - 1.5, outPos, outQuat, outFwd);
  }

  _evaluateAndPlace(t, recordSample) {
    for (let i = 0; i < 6; i++) {
      const info = this.evaluateJetPose(i, t, this._jetPos, this._jetQuat, this._jetFwd);
      const entry = this.jets[i];
      entry.mesh.position.copy(this._jetPos);
      entry.mesh.quaternion.copy(this._jetQuat);
      entry.pos.copy(this._jetPos);
      entry.vel.copy(this._jetFwd).multiplyScalar(info.speed);
      entry.gLoad = info.gLoad;

      if (recordSample) {
        // Right exhaust smoke nozzle (-0.54 along fwd)
        this._exhaust.copy(this._jetPos).addScaledVector(this._jetFwd, -0.54);
        this.trails[i].pushSample(this._exhaust, 0.0);
      }
    }
  }

  getAudioMetrics() {
    if (!this.ready) return this._audioMetrics;

    const camPos = this.camera.position;
    let totalWeight = 0;
    let weightedPan = 0;
    let weightedDoppler = 0;
    let weightedBright = 0;
    let maxAfterburner = 0;

    for (let i = 0; i < this.jets.length; i++) {
      const j = this.jets[i];
      this._toCam.subVectors(camPos, j.pos);
      const dist = Math.max(8.0, this._toCam.length());
      this._toCam.divideScalar(dist);

      // Weight loudest jets closest to the center window pane
      const horizFactor = Math.exp(-(j.pos.x * j.pos.x) / 170.0);
      const distWeight = Math.pow(18.5 / dist, 2.2) * (0.35 + 0.65 * horizFactor);

      // Physical acoustic Doppler factor: approaching (>1.0 pitch), receding (<1.0 pitch)
      const vRadial = j.vel.dot(this._toCam); // positive when approaching camera
      const doppler = Math.max(0.76, Math.min(1.28, 1.0 / (1.0 - vRadial / 34.0)));

      const pan = Math.max(-0.9, Math.min(0.9, j.pos.x / 11.5));
      const bright = Math.max(0.0, Math.min(1.0, (24.0 - dist) / 8.0)) * horizFactor;

      totalWeight += distWeight;
      weightedPan += pan * distWeight;
      weightedDoppler += doppler * distWeight;
      weightedBright += bright * distWeight;
      maxAfterburner = Math.max(maxAfterburner, j.gLoad * horizFactor);
    }

    const norm = Math.max(0.001, totalWeight);
    // Closer camera to window (e.g. Skyline View vs Desk) subtly opens acoustic presence
    const camZ = camPos.z;
    const windowProximity = Math.max(0.55, Math.min(1.20, 0.62 + (1.9 - camZ) * 0.28));

    this._audioMetrics.intensity = Math.min(1.0, totalWeight * 0.26);
    this._audioMetrics.pan = weightedPan / norm;
    this._audioMetrics.doppler = weightedDoppler / norm;
    this._audioMetrics.brightness = Math.min(1.0, weightedBright / norm);
    this._audioMetrics.afterburner = maxAfterburner;
    this._audioMetrics.windowProximity = windowProximity;
    return this._audioMetrics;
  }

  update(dt) {
    if (!this.ready) return;
    this.showTime += dt;
    this._sampleAccum += dt;

    for (const tr of this.trails) tr.advanceAges(dt);

    const shouldSample = this._sampleAccum >= TRAIL_SAMPLE_DT;
    if (shouldSample) {
      this._sampleAccum = Math.min(this._sampleAccum - TRAIL_SAMPLE_DT, TRAIL_SAMPLE_DT);
    }

    this._evaluateAndPlace(this.showTime, shouldSample);
    for (const tr of this.trails) tr.updateGeometry(this.camera.position);
  }
}
