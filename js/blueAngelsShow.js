import * as THREE from 'three';

const CYCLE_DURATION = 48.0; // 4 seamless 12-second Blue Angels airshow acts
const ACT_DURATION = 12.0;
const TRAIL_POINTS = 96;
const TRAIL_SAMPLE_DT = 0.045;
const TRAIL_MAX_AGE = 4.2;

// Tight Blue Angels Diamond formation offsets expressed in Boss (#1) local frame:
// (right, up, forward) where forward = +Z, up = +Y, right = +X.
const DIAMOND_OFFSETS = [
  new THREE.Vector3(0.0, 0.0, 0.0),      // #1 Boss (Lead)
  new THREE.Vector3(0.95, -0.10, -1.02), // #2 Right Wing
  new THREE.Vector3(-0.95, -0.10, -1.02),// #3 Left Wing
  new THREE.Vector3(0.0, -0.22, -2.04),  // #4 Slot
];

const DELTA_EXTRA_OFFSETS = [
  new THREE.Vector3(1.90, -0.18, -2.04),  // #5 Outer Right Delta
  new THREE.Vector3(-1.90, -0.18, -2.04), // #6 Outer Left Delta
];

function smoothstep(edge0, edge1, x) {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

function createSmokeRibbonTexture() {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 128;
  const ctx = c.getContext('2d');
  ctx.clearRect(0, 0, 128, 128);

  // Soft billowy cross-section profile (thick core across V=0.5, wispy feathered edges at V=0 & V=1)
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

  // Subtle organic paraffin-smoke turbulence puffs along length U
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

  pushSample(pos, age, breakRibbon = false) {
    this.samples.unshift({
      pos: pos.clone(),
      age,
      broken: breakRibbon,
    });
    if (this.samples.length > this.maxPoints) {
      this.samples.length = this.maxPoints;
    }
  }

  advanceAges(dt) {
    for (let i = 0; i < this.samples.length; i++) {
      this.samples[i].age += dt;
      // Gentle atmospheric sea-breeze drift & subtle buoyancy
      this.samples[i].pos.x += dt * 0.14;
      this.samples[i].pos.y += dt * 0.04;
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

      const jumpBreak = s.broken || prev.broken || s.pos.distanceToSquared(next.pos) > 3.5;

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
      // Billow outward from crisp exhaust nozzle width to soft dissipating plume
      const halfW = jumpBreak ? 0.0 : (0.042 + Math.pow(ageNorm, 0.72) * 0.22);
      // Fade in slightly right behind exhaust and dissipate gracefully toward tail
      const headFade = smoothstep(0.0, 0.035, ageNorm);
      const tailFade = Math.pow(Math.max(0, 1.0 - ageNorm), 1.35);
      const alpha = jumpBreak ? 0.0 : headFade * tailFade;

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

    // Start mid-maneuver (Act 0 Diamond vertical loop + opposing solo cross) so the show is alive on frame 1!
    this.phaseOffset = 4.65;
    this.showTime = this.phaseOffset;
    this._sampleAccum = 0;

    this.smokeTex = createSmokeRibbonTexture();

    // Reusable scratch vectors/matrices (zero per-frame GC churn)
    this._p0 = new THREE.Vector3();
    this._p1 = new THREE.Vector3();
    this._fwd = new THREE.Vector3();
    this._right = new THREE.Vector3();
    this._up = new THREE.Vector3();
    this._basis = new THREE.Matrix4();
    this._q = new THREE.Quaternion();
    this._rollQ = new THREE.Quaternion();
    this._exhaust = new THREE.Vector3();
    this._worldPos = new THREE.Vector3();
    this._bossFrame = {
      pos: new THREE.Vector3(),
      right: new THREE.Vector3(),
      up: new THREE.Vector3(),
      fwd: new THREE.Vector3(),
      smoke: true,
    };
  }

  attachModel(templateModel) {
    // Tune jet PBR materials so navy blue + bright gold livery pops cleanly out over San Francisco Bay
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
        prevPos: new THREE.Vector3(),
        hasPrev: false,
      });

      const ribbon = new SmokeTrailRibbon(this.smokeTex);
      this.group.add(ribbon.mesh);
      this.trails.push(ribbon);
    }

    this.ready = true;
    this._prewarmTrails();
    window.__blueAngelsActive = true;
  }

  applySkyMood(moodId) {
    if (moodId === 'twilight') {
      for (const tr of this.trails) tr.setMoodStyle(0xdfd4ee, 0.66);
      for (const m of this.jetMaterials) {
        if (m.name === 'BA_InsigniaBlue') m.emissiveIntensity = 0.44;
        else if (m.name === 'BA_InsigniaYellow') m.emissiveIntensity = 0.56;
      }
    } else if (moodId === 'day') {
      for (const tr of this.trails) tr.setMoodStyle(0xffffff, 0.84);
      for (const m of this.jetMaterials) {
        if (m.name === 'BA_InsigniaBlue') m.emissiveIntensity = 0.24;
        else if (m.name === 'BA_InsigniaYellow') m.emissiveIntensity = 0.28;
      }
    } else {
      // Golden Hour warm sunlit cream contrails
      for (const tr of this.trails) tr.setMoodStyle(0xfff3de, 0.80);
      for (const m of this.jetMaterials) {
        if (m.name === 'BA_InsigniaBlue') m.emissiveIntensity = 0.34;
        else if (m.name === 'BA_InsigniaYellow') m.emissiveIntensity = 0.40;
      }
    }
  }

  _prewarmTrails() {
    // Simulate 3.4s of flight history so sweeping white smoke loops are already painted on frame 1!
    const steps = 74;
    const startT = this.phaseOffset - steps * TRAIL_SAMPLE_DT;
    for (let s = 0; s <= steps; s++) {
      const t = startT + s * TRAIL_SAMPLE_DT;
      for (const tr of this.trails) tr.advanceAges(TRAIL_SAMPLE_DT);
      this._evaluateAndPlace(t, true);
    }
    for (const tr of this.trails) tr.updateGeometry(this.camera.position);
  }

  // ---------- Analytic 3D Flight Path Evaluators (Strictly Inside Exterior Bay Airspace) ----------
  _evalBossPos(act, u, out) {
    if (act === 0) {
      // ACT 0: Iconic Blue Angels Diamond Vertical Loop over the San Francisco Bay Bridge!
      // u in [0, 0.24]: level entry from left; [0.24, 0.78]: full 360° vertical loop; [0.78, 1.0]: exit right w/ roll
      const zBase = -20.4;
      if (u < 0.24) {
        const k = u / 0.24;
        out.set(-15.5 + k * 14.9, 3.05, zBase);
      } else if (u < 0.78) {
        const a = ((u - 0.24) / 0.54) * Math.PI * 2.0; // 0 -> 2π CCW loop
        const rx = 2.65;
        const ry = 2.15;
        // Gentle helical Z shift during loop so ascending & descending trails never self-intersect!
        out.set(-0.60 + Math.sin(a) * rx, 5.20 - Math.cos(a) * ry, zBase - (a / (Math.PI * 2)) * 1.15);
      } else {
        const k = (u - 0.78) / 0.22;
        out.set(-0.60 + k * 16.4, 3.05 + Math.sin(k * Math.PI) * 0.55, zBase - 1.15);
      }
      return;
    }

    if (act === 1) {
      // ACT 1: 6-Ship Delta Sweep & Climb into Center-Bay Fleur-de-Lis / Bomb Burst Break!
      const x = 15.0 - u * 30.0;
      const climb = Math.sin(u * Math.PI) * 3.15;
      const z = -21.2 + Math.sin(u * Math.PI * 1.4) * 1.6;
      out.set(x, 3.25 + climb, z);
      return;
    }

    if (act === 2) {
      // ACT 2: Diamond Double Synchronized Formation Barrel Roll across Upper-Mid Bay!
      const x = -15.5 + u * 31.0;
      const y = 5.25 + Math.sin(u * Math.PI * 2.0) * 0.95;
      const z = -20.2 - Math.cos(u * Math.PI * 2.0) * 1.35;
      out.set(x, y, z);
      return;
    }

    // ACT 3: High-G Sweeping S-Turn / Figure-8 Banked Pass across the Bay!
    const x = 15.5 - u * 31.0;
    const y = 4.65 + Math.sin(u * Math.PI * 2.0 - 0.5) * 1.75;
    const z = -20.8 + Math.sin(u * Math.PI) * 2.4;
    out.set(x, y, z);
  }

  _evalBossOrientation(act, u) {
    const eps = 0.0025;
    const u0 = Math.max(0, u - eps);
    const u1 = Math.min(1, u + eps);
    this._evalBossPos(act, u, this._bossFrame.pos);
    this._evalBossPos(act, u0, this._p0);
    this._evalBossPos(act, u1, this._p1);

    this._fwd.subVectors(this._p1, this._p0).normalize();

    if (act === 0) {
      // Singularity-free vertical loop frame tilted ~24° toward the bay viewer so all 4 Diamond jets
      // show crisp 3/4 blue-and-yellow F/A-18 wings & twin canted tails all the way around the 360° loop!
      const rollInLoop = u > 0.79 ? smoothstep(0.79, 0.95, u) * Math.PI * 2.0 : 0.0;
      this._right.set(0.38, 0.0, 0.925).normalize();
      // Orthogonalize right against forward
      this._right.addScaledVector(this._fwd, -this._right.dot(this._fwd)).normalize();
      this._up.crossVectors(this._fwd, this._right).normalize();
      if (rollInLoop > 0) {
        this._rollQ.setFromAxisAngle(this._fwd, rollInLoop);
        this._right.applyQuaternion(this._rollQ);
        this._up.applyQuaternion(this._rollQ);
      }
      this._bossFrame.fwd.copy(this._fwd);
      this._bossFrame.right.copy(this._right);
      this._bossFrame.up.copy(this._up);
      this._bossFrame.smoke = u > 0.04 && u < 0.96;
      return;
    }

    // Smooth general flight frame with dynamic roll/bank
    this._up.set(0, 1, 0);
    this._right.crossVectors(this._up, this._fwd).normalize();
    this._up.crossVectors(this._fwd, this._right).normalize();

    let rollAngle = 0.0;
    if (act === 1) {
      // Graceful banked approach into Delta break
      rollAngle = Math.sin(u * Math.PI) * 0.55;
    } else if (act === 2) {
      // Two crisp 360° synchronized formation aileron/barrel rolls!
      const r1 = smoothstep(0.20, 0.46, u) * Math.PI * 2.0;
      const r2 = smoothstep(0.54, 0.80, u) * Math.PI * 2.0;
      rollAngle = r1 + r2;
    } else {
      // High-G theatrical bank into S-turn curves (up to ~65° bank!)
      rollAngle = Math.cos(u * Math.PI * 2.0 - 0.5) * 1.12;
    }

    if (Math.abs(rollAngle) > 1e-4) {
      this._rollQ.setFromAxisAngle(this._fwd, rollAngle);
      this._right.applyQuaternion(this._rollQ);
      this._up.applyQuaternion(this._rollQ);
    }

    this._bossFrame.fwd.copy(this._fwd);
    this._bossFrame.right.copy(this._right);
    this._bossFrame.up.copy(this._up);
    this._bossFrame.smoke = u > 0.04 && u < 0.96;
  }

  _evalSoloPos(act, u, soloIdx, out) {
    // soloIdx: 0 = Jet #5 (Lead Solo), 1 = Jet #6 (Opposing Solo)
    const dir = soloIdx === 0 ? 1 : -1;

    if (act === 0) {
      // Opposing High-Speed Knife-Edge Cross right over the Bay Bridge while Diamond loops overhead!
      const su = Math.max(0, Math.min(1, (u - 0.14) / 0.74));
      const x = -0.15 + dir * (-16.0 + su * 32.0);
      const y = 3.08 + Math.sin(su * Math.PI) * 0.45 + (su > 0.65 ? Math.pow((su - 0.65) / 0.35, 1.8) * 2.2 : 0);
      const z = -17.6 + dir * 0.48;
      out.set(x, y, z);
      return;
    }

    if (act === 2) {
      // Iconic Blue Angels Mirror Pass: #5 flies INVERTED directly canopy-to-canopy above upright #6!
      const x = 15.2 - u * 30.4;
      const split = smoothstep(0.66, 0.96, u);
      const yBase = 3.35 + Math.sin(u * Math.PI) * 0.32;
      const y = soloIdx === 0
        ? yBase + 0.56 + split * 2.4
        : yBase - split * 0.55;
      const z = -17.9 + (soloIdx === 0 ? -0.15 : 0.15);
      out.set(x, y, z);
      return;
    }

    // ACT 3: Twin Helical Corkscrew Climb spiraling dramatically around each other's smoke trails!
    const x = -14.2 + u * 28.4;
    const yCenter = 2.95 + u * 4.25;
    const zCenter = -18.2 - Math.sin(u * Math.PI) * 1.2;
    const helixAngle = u * Math.PI * 5.0 + (soloIdx === 1 ? Math.PI : 0.0);
    const radius = 0.58 * Math.sin(u * Math.PI);
    out.set(
      x,
      yCenter + Math.sin(helixAngle) * radius,
      zCenter + Math.cos(helixAngle) * radius
    );
  }

  _placeJetFromBasis(jetIdx, pos, right, up, fwd, smokeOn, recordSample) {
    const entry = this.jets[jetIdx];
    const mesh = entry.mesh;

    mesh.position.copy(pos);
    // Construct clean right-handed rotation matrix: local +X -> right, local +Y -> up, local +Z -> fwd (nose!)
    this._basis.makeBasis(right, up, fwd);
    this._q.setFromRotationMatrix(this._basis);
    mesh.quaternion.copy(this._q);

    // Detect act boundary wrap (> 5 m jump) to cleanly break smoke ribbon
    const jumped = !entry.hasPrev || entry.prevPos.distanceToSquared(pos) > 25.0;
    entry.prevPos.copy(pos);
    entry.hasPrev = true;

    if (recordSample) {
      // Smoke injects from the right exhaust nozzle behind the tail (-0.52 along fwd)
      this._exhaust.copy(pos)
        .addScaledVector(fwd, -0.52)
        .addScaledVector(right, 0.03);
      this.trails[jetIdx].pushSample(this._exhaust, 0.0, jumped || !smokeOn);
    }
  }

  _evaluateAndPlace(t, recordSample) {
    const cyc = ((t % CYCLE_DURATION) + CYCLE_DURATION) % CYCLE_DURATION;
    const act = Math.floor(cyc / ACT_DURATION);
    const u = (cyc - act * ACT_DURATION) / ACT_DURATION;

    this._evalBossOrientation(act, u);
    const bf = this._bossFrame;

    // 1. Place Jets #1–#4 (Diamond) — or all 6 in Act 1 Delta + Fleur-de-Lis Bomb Burst!
    if (act === 1) {
      const burst = smoothstep(0.42, 0.94, u);
      // 6 distinct radial Fleur-de-Lis / Bomb Burst break vectors (in Boss local frame + world fan!)
      const burstVecs = [
        new THREE.Vector3(0.0, 2.85, 0.6),    // #1 straight pitch-up climb!
        new THREE.Vector3(3.4, 1.55, 0.2),    // #2 high-right break!
        new THREE.Vector3(-3.4, 1.55, 0.2),   // #3 high-left break!
        new THREE.Vector3(0.0, -1.95, 0.3),   // #4 low swoop!
        new THREE.Vector3(4.5, -0.65, 0.9),   // #5 outer right break!
        new THREE.Vector3(-4.5, -0.65, 0.9),  // #6 outer left break!
      ];
      const allOffsets = [...DIAMOND_OFFSETS, ...DELTA_EXTRA_OFFSETS];

      for (let i = 0; i < 6; i++) {
        const off = allOffsets[i];
        const bv = burstVecs[i];
        this._worldPos.copy(bf.pos)
          .addScaledVector(bf.right, off.x + bv.x * burst)
          .addScaledVector(bf.up, off.y + bv.y * burst)
          .addScaledVector(bf.fwd, off.z + bv.z * burst);

        // Compute tangent direction cleanly during the burst fan-out + victory aileron roll!
        const rVec = this._right.copy(bf.right);
        const uVec = this._up.copy(bf.up);
        const fVec = this._fwd.copy(bf.fwd);
        if (burst > 0.01) {
          const eps = 0.004;
          const b1 = smoothstep(0.42, 0.94, Math.min(1, u + eps));
          const db = (b1 - burst) / eps;
          // Velocity nudge from burst expansion
          fVec.addScaledVector(bf.right, (bv.x * db) * 0.032)
            .addScaledVector(bf.up, (bv.y * db) * 0.032)
            .normalize();
          rVec.crossVectors(uVec, fVec).normalize();
          uVec.crossVectors(fVec, rVec).normalize();

          const victoryRoll = burst * Math.PI * 3.0 * (i % 2 === 0 ? 1 : -1);
          this._rollQ.setFromAxisAngle(fVec, victoryRoll);
          rVec.applyQuaternion(this._rollQ);
          uVec.applyQuaternion(this._rollQ);
        }
        this._placeJetFromBasis(i, this._worldPos, rVec, uVec, fVec, bf.smoke, recordSample);
      }
      return;
    }

    // Place #1–#4 Diamond locked in Boss's local frame
    for (let i = 0; i < 4; i++) {
      const off = DIAMOND_OFFSETS[i];
      this._worldPos.copy(bf.pos)
        .addScaledVector(bf.right, off.x)
        .addScaledVector(bf.up, off.y)
        .addScaledVector(bf.fwd, off.z);
      this._placeJetFromBasis(i, this._worldPos, bf.right, bf.up, bf.fwd, bf.smoke, recordSample);
    }

    // Place #5 & #6 Solos (Acts 0, 2, 3)
    const eps = 0.0025;
    for (let s = 0; s < 2; s++) {
      const jetIdx = 4 + s;
      const u0 = Math.max(0, u - eps);
      const u1 = Math.min(1, u + eps);
      this._evalSoloPos(act, u, s, this._worldPos);
      this._evalSoloPos(act, u0, s, this._p0);
      this._evalSoloPos(act, u1, s, this._p1);

      this._fwd.subVectors(this._p1, this._p0).normalize();
      this._up.set(0, 1, 0);
      this._right.crossVectors(this._up, this._fwd).normalize();
      this._up.crossVectors(this._fwd, this._right).normalize();

      let roll = 0.0;
      let smokeOn = u > 0.04 && u < 0.96;
      if (act === 0) {
        smokeOn = u > 0.16 && u < 0.86;
        // 90° Knife-edge roll right through center window + exit roll!
        const knife = Math.sin(smoothstep(0.24, 0.72, u) * Math.PI) * (Math.PI * 0.48) * (s === 0 ? 1 : -1);
        const exitRoll = smoothstep(0.68, 0.86, u) * Math.PI * 2.0 * (s === 0 ? 1 : -1);
        roll = knife + exitRoll;
      } else if (act === 2) {
        // Mirror Pass: #5 rolls inverted (π rad) right above upright #6, then snaps upright on exit!
        if (s === 0) {
          const invIn = smoothstep(0.06, 0.18, u);
          const invOut = smoothstep(0.66, 0.78, u);
          roll = Math.PI * (invIn - invOut) + smoothstep(0.76, 0.94, u) * Math.PI * 2.0;
        } else {
          roll = smoothstep(0.72, 0.92, u) * -Math.PI * 2.0;
        }
      } else if (act === 3) {
        // Continuous corkscrew aileron roll synchronized with helix!
        roll = u * Math.PI * 6.0 * (s === 0 ? 1 : -1);
      }

      if (Math.abs(roll) > 1e-4) {
        this._rollQ.setFromAxisAngle(this._fwd, roll);
        this._right.applyQuaternion(this._rollQ);
        this._up.applyQuaternion(this._rollQ);
      }

      this._placeJetFromBasis(jetIdx, this._worldPos, this._right, this._up, this._fwd, smokeOn, recordSample);
    }
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
