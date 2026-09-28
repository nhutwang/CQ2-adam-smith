/* ==========================================================================
   Bàn tay vô hình — Bàn tay hữu hình · scene3d.js
   Sân khấu 3D: hai bàn tay có xương, diễn theo vị trí cuộn.

   - Bàn tay hữu hình : hand-visible.glb (mô hình giải phẫu, da thật). Cẳng tay mờ dần
                        theo trục cánh tay; hiện/ẩn bằng hiệu ứng tan rã, không dùng
                        độ trong suốt toàn khối (tránh ngón nhìn xuyên nhau).
   - Bàn tay vô hình  : hand-invisible.glb (cùng bộ 21 xương). Chỉ thấy qua ánh sáng:
                        viền phát sáng + đám mây hạt bám theo xương; hạt tách thành
                        ba cụm (ba chủ thể) và rung nhiễu (Hồi 2).
   - Tư thế           : poses.js — độ lệch xương so với tư thế nghỉ, dùng chung hai tay.
   - Đạo diễn         : mỗi "cue" neo vào một phần tử trong trang; trạng thái hai tay
                        được nội suy liên tục theo vị trí cuộn giữa hai cue liền nhau.
   ========================================================================== */
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { POSES } from './poses.js';

const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const rootEl = document.documentElement;
const DEG = Math.PI / 180;

/* --------------------------------------------------------------------------
   1. Renderer, camera, ánh sáng
   -------------------------------------------------------------------------- */
const canvas = document.createElement('canvas');
canvas.id = 'hand-stage';
canvas.setAttribute('aria-hidden', 'true');
document.body.prepend(canvas);

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.6));
renderer.setSize(innerWidth, innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;

const scene = new THREE.Scene();
scene.background = new THREE.Color('#06080c');
const camera = new THREE.PerspectiveCamera(30, innerWidth / innerHeight, 0.1, 100);
camera.position.set(0, 0, 10);
camera.lookAt(0, 0, 0);

const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
pmrem.dispose();

const hemi = new THREE.HemisphereLight(0xe6edf7, 0x2b2420, 0.9);
const key = new THREE.DirectionalLight(0xfff0e0, 2.2);
key.position.set(-3, 4, 6);
const rim = new THREE.DirectionalLight(0x9fd3ff, 1.6);
rim.position.set(3, 1.5, -5);
scene.add(hemi, key, rim);

const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth / 2, innerHeight / 2), 0.55, 0.45, 0.9);
composer.addPass(bloom);
composer.addPass(new OutputPass());

/* bảng ánh sáng theo chủ đề — thay đổi theo chương, không theo từng pixel cuộn */
const LIGHTING = {
  night: { hemi: 0.42, key: 1.35, rim: 1.5, bloom: 0.85, exposure: 0.92 },
  dusk:  { hemi: 0.55, key: 1.45, rim: 1.0, bloom: 0.6, exposure: 0.92 },
  paper: { hemi: 0.9, key: 1.7, rim: 0.35, bloom: 0.0, exposure: 0.95 }
};
const light = { ...LIGHTING.night };

/* --------------------------------------------------------------------------
   2. Màu lấy trực tiếp từ biến CSS (đang chuyển mượt) → nền và bàn tay luôn khớp chữ
   -------------------------------------------------------------------------- */
const cssColor = { bg: new THREE.Color(), inv: new THREE.Color(), vis: new THREE.Color(), danger: new THREE.Color() };
function readCssColors() {
  const cs = getComputedStyle(rootEl);
  cssColor.bg.setStyle(cs.getPropertyValue('--bg').trim() || '#06080c', THREE.SRGBColorSpace);
  cssColor.inv.setStyle(cs.getPropertyValue('--inv').trim() || '#8ccfff', THREE.SRGBColorSpace);
  cssColor.vis.setStyle(cs.getPropertyValue('--vis').trim() || '#e8895e', THREE.SRGBColorSpace);
  cssColor.danger.setStyle(cs.getPropertyValue('--danger').trim() || '#ff6b5e', THREE.SRGBColorSpace);
}

/* --------------------------------------------------------------------------
   3. Shader dùng chung: nhiễu 3D, làm mờ cẳng tay theo trục cánh tay
   -------------------------------------------------------------------------- */
const NOISE_GLSL = /* glsl */`
  float hash13(vec3 p) { p = fract(p * 0.1031); p += dot(p, p.zyx + 31.32); return fract((p.x + p.y) * p.z); }
  float vnoise(vec3 p) {
    vec3 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
    float n000 = hash13(i), n100 = hash13(i + vec3(1,0,0)), n010 = hash13(i + vec3(0,1,0)), n110 = hash13(i + vec3(1,1,0));
    float n001 = hash13(i + vec3(0,0,1)), n101 = hash13(i + vec3(1,0,1)), n011 = hash13(i + vec3(0,1,1)), n111 = hash13(i + vec3(1,1,1));
    return mix(mix(mix(n000, n100, f.x), mix(n010, n110, f.x), f.y), mix(mix(n001, n101, f.x), mix(n011, n111, f.x), f.y), f.z);
  }
  float fbm(vec3 p) { return 0.6 * vnoise(p) + 0.3 * vnoise(p * 2.1) + 0.1 * vnoise(p * 4.3); }
  float armFade(vec3 bindPos, vec3 wrist, vec3 axis, float len, float a, float b) {
    return smoothstep(a, b, dot(bindPos - wrist, axis) / len);
  }
`;

/* --------------------------------------------------------------------------
   4. Bàn tay có xương — chuẩn hóa hướng, tư thế, hiện/ẩn
   -------------------------------------------------------------------------- */
const tmpV = new THREE.Vector3(), tmpV2 = new THREE.Vector3(), tmpQ = new THREE.Quaternion();
const IDENTITY_Q = new THREE.Quaternion();

class RiggedHand {
  constructor(gltf, kind) {
    this.kind = kind;
    this.holder = new THREE.Group();              // vị trí/hướng trên sân khấu
    this.inner = new THREE.Group();               // chuẩn hóa: cổ tay ở gốc, ngón theo +Y, lòng bàn tay hướng +Z, dài 1
    this.holder.add(this.inner);
    this.model = gltf.scene;
    this.inner.add(this.model);
    this.meshes = [];
    this.bones = {};
    this.rest = {};
    this.model.traverse(o => {
      if (o.isSkinnedMesh) { this.meshes.push(o); o.frustumCulled = false; }
      if (o.isBone) { this.bones[o.name] = o; this.rest[o.name] = o.quaternion.clone(); }
    });
    this.normalize();
    this.computeBindFrame();
  }

  boneWorld(name, target) { return this.bones[name].getWorldPosition(target); }
  tipWorld(name, target) {
    // đầu ngón = khớp cuối + (khớp cuối - khớp trước) * 0.9
    const b = this.bones[name];
    b.getWorldPosition(target);
    b.parent.getWorldPosition(tmpV2);
    return target.add(tmpV.copy(target).sub(tmpV2).multiplyScalar(0.9));
  }

  normalize() {
    this.model.updateMatrixWorld(true);
    const wrist = this.boneWorld('radius_ulna', new THREE.Vector3());
    const tip = this.tipWorld('midd_dist', new THREE.Vector3());
    const thumb = this.boneWorld('thumb_meta', new THREE.Vector3());
    const y = tip.clone().sub(wrist);
    const len = y.length(); y.normalize();
    const t = thumb.clone().sub(wrist); t.sub(y.clone().multiplyScalar(t.dot(y)));
    const x = t.normalize().multiplyScalar(-1);
    const z = new THREE.Vector3().crossVectors(x, y).normalize();
    const basis = new THREE.Matrix4().makeBasis(x, y, z);
    const inv = basis.clone().invert();
    const m = new THREE.Matrix4().makeScale(1 / len, 1 / len, 1 / len).multiply(inv).multiply(new THREE.Matrix4().makeTranslation(-wrist.x, -wrist.y, -wrist.z));
    m.decompose(this.inner.position, this.inner.quaternion, this.inner.scale);
    this.length = len;
  }

  /* cổ tay và trục cánh tay trong không gian hình học gốc (bind space) của mesh → cho shader */
  computeBindFrame() {
    const mesh = this.meshes[0];
    const sk = mesh.skeleton;
    const pos = name => {
      const i = sk.bones.findIndex(b => b.name === name);
      const m = sk.boneInverses[i].clone().invert();
      return new THREE.Vector3().setFromMatrixPosition(m).applyMatrix4(mesh.bindMatrixInverse);
    };
    const wrist = pos('radius_ulna');
    const midd = pos('midd_meta');
    this.bindWrist = wrist;
    this.bindAxis = midd.clone().sub(wrist).normalize();
    this.bindLen = midd.distanceTo(wrist);
  }

  /* pose: Map tên xương → quaternion lệch; áp lên tư thế nghỉ */
  applyPose(deltas) {
    for (const name in deltas) {
      const bone = this.bones[name];
      if (bone) bone.quaternion.copy(this.rest[name]).multiply(deltas[name]);
    }
  }
}

/* --------------------------------------------------------------------------
   5. Thư viện tư thế: bản đồ quaternion + các tư thế pha trộn
   -------------------------------------------------------------------------- */
const BONE_NAMES = Object.keys(POSES.open);
const LIB = {};
for (const name in POSES) {
  LIB[name] = {};
  for (const b of BONE_NAMES) LIB[name][b] = new THREE.Quaternion().fromArray(POSES[name][b]);
}
function blendPose(a, b, t) {
  const out = {};
  for (const n of BONE_NAMES) out[n] = a[n].clone().slerp(b[n], t);
  return out;
}
LIB.reach = blendPose(LIB.open, LIB.point, 0.42);   // vươn ngón trỏ, các ngón khác chùng nhẹ (Sáng tạo Adam)
LIB.relax = blendPose(LIB.open, LIB.fist, 0.2);     // thả lỏng
LIB.cup = blendPose(LIB.open, LIB.fist, 0.45);      // khum tay, như nâng đỡ
LIB.grip = blendPose(LIB.open, LIB.fist, 0.78);     // nắm chặt — can thiệp quá tay
LIB.spread = LIB.open;
function resolvePose(spec) {
  if (!spec) return LIB.relax;
  if (typeof spec === 'string') return LIB[spec] || LIB.relax;
  return blendPose(LIB[spec[0]], LIB[spec[1]], spec[2]);
}

/* --------------------------------------------------------------------------
   6. Vật liệu bàn tay hữu hình: da thật + mờ cẳng tay + tan rã
   -------------------------------------------------------------------------- */
function upgradeSkinMaterial(material, hand, uniforms) {
  material.vertexColors = false;
  material.transparent = true;
  material.depthWrite = true;
  material.side = THREE.FrontSide;
  material.envMapIntensity = 0.55;
  material.onBeforeCompile = shader => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vBindPos;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvBindPos = position;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>
        varying vec3 vBindPos;
        uniform vec3 uWrist; uniform vec3 uAxis; uniform float uLen;
        uniform float uFadeA; uniform float uFadeB;
        uniform float uDissolve; uniform float uNoiseScale; uniform vec3 uEdge;
        ${NOISE_GLSL}`)
      .replace('#include <opaque_fragment>', `
        float fadeArm = armFade(vBindPos, uWrist, uAxis, uLen, uFadeA, uFadeB);
        float nD = fbm(vBindPos * uNoiseScale / uLen);
        if (nD < uDissolve * 1.02 || fadeArm < 0.004) discard;
        float edge = 1.0 - smoothstep(uDissolve, uDissolve + 0.07, nD);
        outgoingLight = mix(outgoingLight, uEdge * 2.2, edge * step(0.002, uDissolve));
        diffuseColor.a *= fadeArm;
        #include <opaque_fragment>`);
  };
  material.customProgramCacheKey = () => 'skin-fade-dissolve';
  material.needsUpdate = true;
}

/* lớp "linh hồn" phát sáng: viền fresnel, cộng sáng — dùng cho bàn tay vô hình
   và cho lớp bên trong bàn tay hữu hình ở phần kết luận */
function makeGhostMaterial(uniforms) {
  return new THREE.ShaderMaterial({
    uniforms,
    vertexShader: /* glsl */`
      #include <common>
      #include <skinning_pars_vertex>
      varying vec3 vN; varying vec3 vV; varying vec3 vBindPos;
      void main() {
        #include <skinbase_vertex>
        #include <begin_vertex>
        #include <beginnormal_vertex>
        #include <skinnormal_vertex>
        #include <skinning_vertex>
        vBindPos = position;
        vec4 mv = modelViewMatrix * vec4(transformed, 1.0);
        vN = normalize(normalMatrix * objectNormal);
        vV = normalize(-mv.xyz);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */`
      uniform vec3 uColor; uniform float uOpacity; uniform float uTime;
      uniform vec3 uWrist; uniform vec3 uAxis; uniform float uLen; uniform float uFadeA; uniform float uFadeB;
      varying vec3 vN; varying vec3 vV; varying vec3 vBindPos;
      ${NOISE_GLSL}
      void main() {
        float f = pow(1.0 - abs(dot(normalize(vN), normalize(vV))), 2.4);
        float fade = armFade(vBindPos, uWrist, uAxis, uLen, uFadeA, uFadeB);
        float shimmer = 0.85 + 0.15 * sin(uTime * 1.3 + dot(vBindPos, uAxis) / uLen * 6.0);
        float a = (0.05 + f * 1.1) * uOpacity * fade * shimmer;
        gl_FragColor = vec4(uColor * (0.35 + f * 1.4), a);
      }`,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide
  });
}

/* --------------------------------------------------------------------------
   7. Đám mây hạt bám theo xương (bàn tay vô hình)
   -------------------------------------------------------------------------- */
function makeSprite() {
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.35, 'rgba(255,255,255,.55)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad; g.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
const sprite = makeSprite();

class ParticleSkin {
  constructor(mesh, hand, count, uniforms) {
    this.mesh = mesh;
    const geo = mesh.geometry;
    const pos = geo.attributes.position, index = geo.index;
    const triCount = index ? index.count / 3 : pos.count / 3;
    const ia = i => (index ? index.getX(i) : i);
    // lấy mẫu theo diện tích tam giác
    const areas = new Float32Array(triCount); let total = 0;
    const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
    for (let t = 0; t < triCount; t++) {
      a.fromBufferAttribute(pos, ia(t * 3)); b.fromBufferAttribute(pos, ia(t * 3 + 1)); c.fromBufferAttribute(pos, ia(t * 3 + 2));
      total += new THREE.Triangle(a, b, c).getArea(); areas[t] = total;
    }
    this.count = count;
    this.tri = new Uint32Array(count * 3);
    this.bary = new Float32Array(count * 3);
    const bind = new Float32Array(count * 3), seed = new Float32Array(count), cluster = new Float32Array(count * 3);
    // ba cụm theo nhóm ngón: ngón cái | trỏ + giữa | áp út + út (+ lòng bàn tay chia theo khoảng cách)
    const sk = mesh.skeleton;
    const skinIndex = geo.attributes.skinIndex, skinWeight = geo.attributes.skinWeight;
    const group = name => name.startsWith('thumb') ? 0 : (name.startsWith('index') || name.startsWith('midd')) ? 1 : (name.startsWith('ring') || name.startsWith('pinky')) ? 2 : -1;
    // tâm từng nhóm ngón trong bind space (từ vị trí khớp)
    const bindBone = b => new THREE.Vector3().setFromMatrixPosition(sk.boneInverses[sk.bones.indexOf(b)].clone().invert()).applyMatrix4(mesh.bindMatrixInverse);
    const gCent = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()], gN = [0, 0, 0];
    sk.bones.forEach(bn => { const g = group(bn.name); if (g >= 0) { gCent[g].add(bindBone(bn)); gN[g]++; } });
    gCent.forEach((c, g) => c.multiplyScalar(1 / Math.max(1, gN[g])));
    const handCent = gCent[0].clone().add(gCent[1]).add(gCent[2]).multiplyScalar(1 / 3);
    const clusterDirs = gCent.map(c => c.clone().sub(handCent).normalize());
    this.clusterDirs = clusterDirs;
    const groupId = new Float32Array(count);
    let rnd = 7;
    const random = () => { rnd = (rnd * 16807) % 2147483647; return (rnd - 1) / 2147483646; };
    for (let p = 0; p < count; p++) {
      const r = random() * total;
      let lo = 0, hi = triCount - 1;
      while (lo < hi) { const mid = (lo + hi) >> 1; if (areas[mid] < r) lo = mid + 1; else hi = mid; }
      let u = random(), v = random(); if (u + v > 1) { u = 1 - u; v = 1 - v; }
      const i0 = ia(lo * 3), i1 = ia(lo * 3 + 1), i2 = ia(lo * 3 + 2);
      this.tri.set([i0, i1, i2], p * 3);
      this.bary.set([1 - u - v, u, v], p * 3);
      a.fromBufferAttribute(pos, i0).multiplyScalar(1 - u - v)
        .add(b.fromBufferAttribute(pos, i1).multiplyScalar(u))
        .add(c.fromBufferAttribute(pos, i2).multiplyScalar(v));
      bind.set([a.x, a.y, a.z], p * 3);
      seed[p] = random();
      // cụm: xương có trọng số lớn nhất của đỉnh đầu tiên
      let best = 0, bw = -1;
      for (let k = 0; k < 4; k++) { const w = skinWeight.getComponent(i0, k); if (w > bw) { bw = w; best = skinIndex.getComponent(i0, k); } }
      let g = group(sk.bones[best].name);
      if (g < 0) {  // lòng bàn tay / cổ tay: về cụm gần nhất
        let md = Infinity;
        for (let k = 0; k < 3; k++) { const dd = a.distanceToSquared(gCent[k]); if (dd < md) { md = dd; g = k; } }
      }
      const d = clusterDirs[g];
      cluster.set([d.x, d.y, d.z], p * 3);
      groupId[p] = g;
    }
    this.geometry = new THREE.BufferGeometry();
    this.positions = new Float32Array(count * 3);
    this.geometry.setAttribute('position', new THREE.BufferAttribute(this.positions, 3).setUsage(THREE.DynamicDrawUsage));
    this.geometry.setAttribute('aBind', new THREE.BufferAttribute(bind, 3));
    this.geometry.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
    this.geometry.setAttribute('aCluster', new THREE.BufferAttribute(cluster, 3));
    this.material = new THREE.ShaderMaterial({
      uniforms: { ...uniforms, uMap: { value: sprite } },
      vertexShader: /* glsl */`
        uniform float uTime; uniform float uSize; uniform float uSplit; uniform float uScatter; uniform float uLen;
        uniform vec3 uWrist; uniform vec3 uAxis; uniform float uFadeA; uniform float uFadeB; uniform float uPixelRatio;
        attribute vec3 aBind; attribute float aSeed; attribute vec3 aCluster;
        varying float vAlpha; varying float vSeed;
        ${NOISE_GLSL}
        void main() {
          vec3 p = position;
          p += aCluster * uSplit * uLen * 1.25;
          vec3 jitter = vec3(vnoise(aBind * 3.0 / uLen + uTime * 0.9), vnoise(aBind * 3.0 / uLen + 11.0 + uTime * 0.8), vnoise(aBind * 3.0 / uLen + 23.0 + uTime * 1.1)) - 0.5;
          p += jitter * uLen * (0.02 + uScatter * 0.55);
          float along = dot(aBind - uWrist, uAxis) / uLen;
          float fade = smoothstep(uFadeA, uFadeB, along);
          // phía cẳng tay: hạt thưa dần và trôi ra xa → không có mép cắt
          p += uAxis * (1.0 - fade) * aSeed * uLen * -0.6;
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          float tw = 0.65 + 0.35 * sin(uTime * (1.2 + aSeed * 2.0) + aSeed * 40.0);
          vAlpha = fade * tw;
          vSeed = aSeed;
          gl_PointSize = uSize * uPixelRatio * (0.6 + aSeed * 0.8) * (10.0 / -mv.z);
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: /* glsl */`
        uniform sampler2D uMap; uniform vec3 uColor; uniform vec3 uColor2; uniform float uOpacity; uniform float uWarm;
        varying float vAlpha; varying float vSeed;
        void main() {
          vec4 t = texture2D(uMap, gl_PointCoord);
          vec3 col = mix(uColor, uColor2, uWarm * step(0.55, vSeed));
          gl_FragColor = vec4(col * (1.1 + vSeed * 0.6), t.a * vAlpha * uOpacity);
        }`,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    });
    this.points = new THREE.Points(this.geometry, this.material);
    this.points.frustumCulled = false;
    mesh.add(this.points);  // cùng không gian cục bộ với mesh
    this.skinned = new Float32Array(pos.count * 3);
    this.vtx = new THREE.Vector3();
    this.groupId = groupId;
    this.centers = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()];
  }
  setActive(fraction) {
    this.active = Math.max(1, Math.floor(this.count * fraction));
    this.geometry.setDrawRange(0, this.active);
  }
  update() {
    const mesh = this.mesh, pos = mesh.geometry.attributes.position, s = this.skinned, v = this.vtx;
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i);
      mesh.applyBoneTransform(i, v);
      s[i * 3] = v.x; s[i * 3 + 1] = v.y; s[i * 3 + 2] = v.z;
    }
    const out = this.positions, tri = this.tri, bary = this.bary, gid = this.groupId, C = this.centers, n = [0, 0, 0];
    C.forEach(c => c.set(0, 0, 0));
    const active = this.active || this.count;
    for (let p = 0; p < active; p++) {
      const a = tri[p * 3] * 3, b = tri[p * 3 + 1] * 3, c = tri[p * 3 + 2] * 3;
      const u = bary[p * 3], w = bary[p * 3 + 1], z = bary[p * 3 + 2];
      out[p * 3] = s[a] * u + s[b] * w + s[c] * z;
      out[p * 3 + 1] = s[a + 1] * u + s[b + 1] * w + s[c + 1] * z;
      out[p * 3 + 2] = s[a + 2] * u + s[b + 2] * w + s[c + 2] * z;
      const g = gid[p]; C[g].x += out[p * 3]; C[g].y += out[p * 3 + 1]; C[g].z += out[p * 3 + 2]; n[g]++;
    }
    C.forEach((c, g) => c.multiplyScalar(1 / Math.max(1, n[g])));
    this.geometry.attributes.position.needsUpdate = true;
  }
}

/* --------------------------------------------------------------------------
   8. Kịch bản: cue neo vào phần tử trang
   Tọa độ: x, y là vị trí cổ tay theo NDC (-1..1); size = chiều dài bàn tay / chiều cao khung;
   angle = hướng ngón tay trong mặt phẳng màn hình (0 = hướng lên, dương = ngược chiều kim đồng hồ);
   tilt = nghiêng ngón về phía người xem; roll = xoay quanh trục cánh tay (0 = lòng bàn tay hướng người xem).
   -------------------------------------------------------------------------- */
const HAND_KEYS = ['show', 'x', 'y', 'size', 'angle', 'tilt', 'roll'];
function H(show, x, y, size, angle, tilt, roll, pose) { return { show, x, y, size, angle, tilt, roll, pose }; }

const CUES = [
  { at: '#hero', inv: H(1, 0.99, 0.9, 0.78, 138, 12, 150, 'reach'), vis: H(1, 0.66, -1.05, 0.76, 30, 18, 25, 'reach'), split: 0, ghost: 0 },
  { at: '#s1 .section__head', inv: H(1, 1.06, 1.02, 0.72, 150, 8, 150, 'relax'), vis: H(1, 0.8, -1.22, 0.7, 22, 18, 25, 'relax'), split: 0, ghost: 0 },
  { at: '#s2 .section__head', id: 'story', inv: H(1, 0.62, -0.9, 0.82, -8, 22, 180, 'cup'), vis: H(0, 0.9, -1.3, 0.6, 20, 0, 0, 'relax'), split: 0, ghost: 0 },
  { at: '#s3 .section__head', inv: H(1, 0.58, -0.86, 0.74, 6, 12, 0, 'open'), vis: H(0, 0.9, -1.3, 0.6, 20, 0, 0, 'relax'), split: 0, ghost: 0,
    labels: [['inv', 'thumb_dist', 'Tư lợi'], ['inv', 'index_dist', 'Cạnh tranh'], ['inv', 'midd_dist', 'Giá cả – tín hiệu']] },
  { at: '#s3-laws', inv: H(1, 0.56, -0.84, 0.72, 0, 10, 0, 'open'), vis: H(0, 0.9, -1.3, 0.6, 20, 0, 0, 'relax'), split: 0, ghost: 0,
    labels: [['inv', 'index_dist', 'Quy luật giá trị'], ['inv', 'midd_dist', 'Cung – cầu'], ['inv', 'ring_dist', 'Cạnh tranh'], ['inv', 'pinky_dist', 'Lưu thông tiền tệ']] },
  { at: '#s4 .section__head', inv: H(1, 0.58, -0.85, 0.78, 0, 10, 0, 'open'), vis: H(0, 0.9, -1.3, 0.6, 20, 0, 0, 'relax'), split: 1, ghost: 0,
    labels: [['cluster', 0, 'Người sản xuất'], ['cluster', 1, 'Người tiêu dùng'], ['cluster', 2, 'Trung gian']] },
  { at: '#s4 .table-wrap', inv: H(1, 0.62, -0.9, 0.78, 4, 10, 0, 'cup'), vis: H(0, 0.9, -1.3, 0.6, 20, 0, 0, 'relax'), split: 0, ghost: 0 },
  { at: '#s5 .section__head', inv: H(0, 0.9, 1.3, 0.6, 160, 0, 150, 'relax'), vis: H(1, 0.58, -0.9, 0.74, -2, 14, 0, 'flat'), split: 0, ghost: 0,
    labels: [['vis', 'thumb_dist', 'Pháp luật'], ['vis', 'index_dist', 'Chính sách'], ['vis', 'pinky_dist', 'Công cụ kinh tế']] },
  { at: '#s5 .sd-widget', id: 'price', inv: H(0, 0.9, 1.3, 0.6, 160, 0, 150, 'relax'), vis: H(1, 0.7, -1.0, 0.8, 0, 20, 0, 'cup'), split: 0, ghost: 0 },
  { at: '#s6 .section__head', inv: H(1, 0.52, -1.02, 0.56, 12, 25, 180, 'cup'), vis: H(1, 0.78, -1.04, 0.56, -12, 25, 180, 'cup'), split: 0, ghost: 0 },
  { at: '#s7 .section__head', inv: H(1, 0.99, 0.9, 0.78, 138, 12, 150, 'reach'), vis: H(1, 0.665, -1.035, 0.77, 30, 18, 25, 'reach'), split: 0, ghost: 0 },
  { at: '#s7 .subhead:nth-of-type(2)', id: 'peel', inv: H(0, 0.98, 0.96, 0.8, 140, 12, 150, 'reach'), vis: H(1, 0.6, -1.0, 0.92, 2, 12, 0, 'open'), split: 0, ghost: 1 },
  { at: '#s7 .subhead:nth-of-type(3)', inv: H(1, 0.42, -1.08, 0.6, 12, 20, 0, 'relax'), vis: H(1, 0.76, -1.08, 0.6, -12, 20, 0, 'relax'), split: 0, ghost: 0 },
  { at: '#s8', inv: H(0, 0.99, 0.9, 0.6, 138, 12, 150, 'relax'), vis: H(0, 0.66, -1.2, 0.6, 30, 18, 25, 'relax'), split: 0, ghost: 0 },
  { at: '#quiz', inv: H(1, 1.0, 0.95, 0.62, 138, 12, 150, 'reach'), vis: H(1, 0.78, -1.08, 0.6, 30, 18, 25, 'reach'), split: 0, ghost: 0 }
];

/* trạng thái đang hiển thị (được làm mượt tiến về trạng thái mục tiêu) */
const view = {
  inv: { ...CUES[0].inv, poseQ: null }, vis: { ...CUES[0].vis, poseQ: null },
  split: 0, ghost: 0, reading: 0, scatter: 0, warm: 0, squeeze: 0, act: 1, actVis: 0
};
const overlay = { reading: 0, act: 1, scatterT: 0, actVisT: 0, squeezeT: 0 };

let anchors = [];
/* vùng sân khấu: bắt đầu từ mép phải thực tế của cột chữ (đo từ trang), để tay không lấn chữ
   ở mọi độ rộng màn hình. Tọa độ x trong CUES được viết cho mép trái sân khấu = 0 (NDC). */
let stageL = 0;
function textRight(el) {
  if (!el) return 0;
  const r = document.createRange(); r.selectNodeContents(el);
  let right = 0; for (const rect of r.getClientRects()) right = Math.max(right, rect.right);
  return right;
}
function measureStage() {
  const inner = document.querySelector('#s1 .section__inner');
  const colRightPx = Math.max(textRight(document.querySelector('.hero__title')), textRight(document.querySelector('.hero__sub')), inner ? inner.getBoundingClientRect().right : 0);
  stageL = Math.max(0, ((colRightPx + 28) / innerWidth) * 2 - 1);
}
function remapX(x) { return stageL + x * (1 - stageL); }
function measureAnchors() {
  measureStage();
  anchors = CUES.map(cue => {
    const el = document.querySelector(cue.at);
    if (!el) return null;
    return el.getBoundingClientRect().top + window.scrollY;
  });
}

/* --------------------------------------------------------------------------
   9. Nhãn neo vào đầu ngón tay
   -------------------------------------------------------------------------- */
const labelLayer = document.getElementById('stage-labels');
const lineLayer = document.getElementById('stage-lines');
const labelPool = [];
function getLabel(i) {
  if (!labelPool[i] && labelLayer && lineLayer) {
    const el = document.createElement('div'); el.className = 'stage-label';
    labelLayer.appendChild(el);
    const ns = 'http://www.w3.org/2000/svg';
    const line = document.createElementNS(ns, 'line'); lineLayer.appendChild(line);
    const dot = document.createElementNS(ns, 'circle'); dot.setAttribute('r', '3'); lineLayer.appendChild(dot);
    labelPool[i] = { el, line, dot, text: '' };
  }
  return labelPool[i];
}

/* --------------------------------------------------------------------------
   10. Nạp mô hình
   -------------------------------------------------------------------------- */
let visHand = null, invHand = null, invParticles = null, invGhost = null, visGhost = null;
const visUniforms = {
  uWrist: { value: new THREE.Vector3() }, uAxis: { value: new THREE.Vector3(0, 1, 0) }, uLen: { value: 1 },
  uFadeA: { value: -0.62 }, uFadeB: { value: -0.18 },
  uDissolve: { value: 0 }, uNoiseScale: { value: 3.2 }, uEdge: { value: new THREE.Color('#e8895e') }
};
const invUniforms = {
  uWrist: { value: new THREE.Vector3() }, uAxis: { value: new THREE.Vector3(0, 1, 0) }, uLen: { value: 1 },
  uFadeA: { value: -0.3 }, uFadeB: { value: 0.22 },
  uColor: { value: new THREE.Color('#8ccfff') }, uColor2: { value: new THREE.Color('#ff6b5e') },
  uOpacity: { value: 1 }, uTime: { value: 0 }, uSize: { value: 2.1 }, uSplit: { value: 0 }, uScatter: { value: 0 },
  uWarm: { value: 0 }, uPixelRatio: { value: renderer.getPixelRatio() }
};
const invGhostOpacity = { value: 1 };
const visGhostUniforms = {
  uWrist: visUniforms.uWrist, uAxis: visUniforms.uAxis, uLen: visUniforms.uLen,
  uFadeA: { value: -0.3 }, uFadeB: { value: 0.1 },
  uColor: invUniforms.uColor, uOpacity: { value: 0 }, uTime: invUniforms.uTime
};

const loader = new GLTFLoader();
Promise.all([loader.loadAsync('./models/hand-visible.glb'), loader.loadAsync('./models/hand-invisible.glb')])
  .then(async ([gVis, gInv]) => {
    /* bàn tay hữu hình */
    visHand = new RiggedHand(gVis, 'vis');
    const bumpIndex = gVis.parser.json.materials[0]?.extras?.bumpTexture;
    const bump = bumpIndex != null ? await gVis.parser.getDependency('texture', bumpIndex) : null;
    visUniforms.uWrist.value.copy(visHand.bindWrist); visUniforms.uAxis.value.copy(visHand.bindAxis); visUniforms.uLen.value = visHand.bindLen;
    visHand.meshes.forEach(mesh => {
      const m = mesh.material;
      if (bump && mesh.name.toLowerCase().includes('hand')) { m.bumpMap = bump; m.bumpScale = 1.4; }
      m.roughness = 1.0;
      upgradeSkinMaterial(m, visHand, visUniforms);
    });
    // lớp "bàn tay vô hình bên trong bàn tay hữu hình" — hiện ra khi da tan ở phần kết luận
    const handMesh = visHand.meshes.find(m => m.name.toLowerCase().includes('hand')) || visHand.meshes[0];
    visGhost = new THREE.SkinnedMesh(handMesh.geometry, makeGhostMaterial(visGhostUniforms));
    visGhost.bind(handMesh.skeleton, handMesh.bindMatrix);
    visGhost.frustumCulled = false;
    visGhost.renderOrder = 2;
    handMesh.parent.add(visGhost);

    /* bàn tay vô hình */
    invHand = new RiggedHand(gInv, 'inv');
    invUniforms.uWrist.value.copy(invHand.bindWrist); invUniforms.uAxis.value.copy(invHand.bindAxis); invUniforms.uLen.value = invHand.bindLen;
    const invMesh = invHand.meshes[0];
    invGhost = invMesh;
    // viền phát sáng tắt sớm hơn hạt ở phía cổ tay → mép hở của mô hình không lóe sáng
    invMesh.material = makeGhostMaterial({ ...invUniforms, uOpacity: invGhostOpacity, uFadeA: { value: 0.05 }, uFadeB: { value: 0.42 } });
    invMesh.renderOrder = 3;
    invParticles = new ParticleSkin(invMesh, invHand, innerWidth < 700 ? 5000 : 11000, invUniforms);
    invParticles.points.renderOrder = 4;
    applyQuality();

    scene.add(visHand.holder, invHand.holder);
    document.body.dataset.stage = 'ready';
    measureAnchors();
    start();
  })
  .catch(err => {
    document.body.dataset.stage = 'error';
    console.error('Không tải được mô hình bàn tay:', err);
  });

/* --------------------------------------------------------------------------
   11. Mỗi khung hình: tính trạng thái mục tiêu từ vị trí cuộn, làm mượt, áp lên hai tay
   -------------------------------------------------------------------------- */
function smoothstep(a, b, x) { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); }
function lerp(a, b, t) { return a + (b - a) * t; }

function targetFromScroll() {
  const probe = window.scrollY + innerHeight * 0.55;
  let i = 0;
  for (let k = 0; k < anchors.length; k++) { if (anchors[k] != null && anchors[k] <= probe) i = k; }
  const cur = CUES[i];
  const prev = CUES[Math.max(0, i - 1)];
  const y0 = anchors[i] ?? 0;
  let next = i + 1; while (next < anchors.length && anchors[next] == null) next++;
  const gap = next < anchors.length ? anchors[next] - y0 : innerHeight;
  const span = Math.min(gap * 0.55, innerHeight * 0.45);
  const w = i === 0 ? 1 : smoothstep(0, span, probe - y0);
  return { cur, prev, w, index: i };
}

const handTarget = { inv: {}, vis: {} };
function mixHand(a, b, w, out) {
  for (const k of HAND_KEYS) out[k] = lerp(a[k], b[k], w);
  out.show = lerp(a.show, b.show, smoothstep(0.25, 0.75, w));   // hiện/ẩn dứt khoát, không lửng lơ nửa tan
  return out;
}

const clock = new THREE.Clock();

/* chất lượng tự điều chỉnh theo tốc độ khung hình thật của máy chiếu
   2 = đầy đủ · 1 = giảm độ phân giải · 0 = giảm thêm hạt và tắt phát sáng
   có thể ép bằng ?q=0|1|2 trên thanh địa chỉ */
const forcedQ = new URLSearchParams(location.search).get('q');
const perf = { level: forcedQ != null ? Math.max(0, Math.min(2, Number(forcedQ))) : 2, locked: forcedQ != null, acc: 0, n: 0, since: 0 };
function applyQuality() {
  const dpr = window.devicePixelRatio || 1;
  const ratio = perf.level === 2 ? Math.min(dpr, 1.6) : perf.level === 1 ? Math.min(dpr, 1.1) : Math.min(dpr, 0.85);
  renderer.setPixelRatio(ratio);
  renderer.setSize(innerWidth, innerHeight);
  composer.setPixelRatio ? composer.setPixelRatio(ratio) : null;
  composer.setSize(innerWidth, innerHeight);
  bloom.enabled = perf.level > 0;
  const div = perf.level === 2 ? 2 : 3;
  bloom.resolution.set(innerWidth / div, innerHeight / div);
  invUniforms.uPixelRatio.value = ratio;
  if (invParticles) invParticles.setActive(perf.level === 0 ? 0.5 : 1);
  document.body.dataset.quality = String(perf.level);
}
function trackPerf(dt, t) {
  if (perf.locked || perf.level === 0 || t < 2 || document.hidden) return;
  perf.acc += Math.min(dt, 0.5); perf.n++;
  if (perf.acc < 2.5) return;            // đánh giá mỗi 2,5 giây, bất kể máy nhanh hay chậm
  const avg = perf.acc / perf.n;
  perf.acc = 0; perf.n = 0;
  if (avg > 1 / 40) { perf.level -= 1; perf.since = t; applyQuality(); }
}

/* con trỏ chuột: hai bàn tay nghiêng nhẹ, lệch chiều nhau để tạo chiều sâu */
const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
const pointer = { x: 0, y: 0, tx: 0, ty: 0 };
if (finePointer && !reduceMotion) {
  window.addEventListener('pointermove', e => {
    pointer.tx = (e.clientX / innerWidth) * 2 - 1;
    pointer.ty = (e.clientY / innerHeight) * 2 - 1;
  }, { passive: true });
  document.addEventListener('mouseleave', () => { pointer.tx = 0; pointer.ty = 0; });
}
let intro = reduceMotion ? 1 : 0;
let running = false, rafId = 0, lastIndex = -1, poseCache = new Map();
function poseOf(spec) {
  const k = JSON.stringify(spec);
  if (!poseCache.has(k)) poseCache.set(k, resolvePose(spec));
  return poseCache.get(k);
}

function worldHalf() {
  const halfH = Math.tan(camera.fov * DEG / 2) * camera.position.z;
  return { halfH, halfW: halfH * camera.aspect };
}

const idleQ = {};
for (const n of BONE_NAMES) idleQ[n] = new THREE.Quaternion();

function placeHand(hand, st, poseMap, t, kindIndex) {
  const { halfH, halfW } = worldHalf();
  const narrow = innerWidth < 1100;
  const x = narrow ? lerp(0, st.x, 0.35) : remapX(st.x);
  hand.holder.position.set(x * halfW, st.y * halfH, 0);
  const s = st.size * 2 * halfH * (narrow ? 0.85 : 1);
  hand.holder.scale.setScalar(s);
  // hướng: quay trong mặt phẳng màn hình ∘ nghiêng về người xem ∘ xoay quanh trục cánh tay
  const breathe = reduceMotion ? 0 : Math.sin(t * 0.6 + kindIndex * 2.1);
  const sgn = kindIndex === 0 ? 1 : -1;
  const e = new THREE.Euler((st.tilt + pointer.y * 4 * sgn) * DEG + breathe * 0.02, (st.roll + pointer.x * 7 * sgn) * DEG, (st.angle + breathe * 1.2 + pointer.x * 1.5) * DEG, 'ZXY');
  hand.holder.quaternion.setFromEuler(e);
  hand.holder.position.y += breathe * 0.012 * halfH - pointer.y * 0.012 * halfH * sgn;
  hand.holder.position.x += pointer.x * 0.012 * halfW * sgn;
  // tư thế + nhịp thở nhẹ ở ngón (không bao giờ đứng như tượng)
  const pose = {};
  for (const n of BONE_NAMES) {
    const phase = (n.charCodeAt(0) + n.length) * 0.37 + kindIndex;
    const k = reduceMotion ? 0 : 0.035 + 0.02 * Math.sin(t * 0.8 + phase);
    pose[n] = tmpQ.copy(poseMap[n]).slerp(LIB.fist[n], k).clone();
  }
  hand.applyPose(pose);
}

function update() {
  const rawDt = clock.getDelta();
  const dt = Math.min(rawDt, 0.12);
  const t = clock.elapsedTime;
  trackPerf(rawDt, t);
  pointer.x += (pointer.tx - pointer.x) * (1 - Math.exp(-dt * 3));
  pointer.y += (pointer.ty - pointer.y) * (1 - Math.exp(-dt * 3));
  if (intro < 1) intro = Math.min(1, intro + dt / 2.2);
  const introE = intro * intro * (3 - 2 * intro);
  readCssColors();
  scene.background.copy(cssColor.bg);
  invUniforms.uColor.value.copy(cssColor.inv);
  invUniforms.uColor2.value.copy(cssColor.danger);
  visUniforms.uEdge.value.copy(cssColor.vis);
  invUniforms.uTime.value = t;

  const { cur, prev, w, index } = targetFromScroll();
  mixHand(prev.inv, cur.inv, w, handTarget.inv);
  mixHand(prev.vis, cur.vis, w, handTarget.vis);
  const targetSplit = lerp(prev.split || 0, cur.split || 0, w);
  let targetGhost = lerp(prev.ghost || 0, cur.ghost || 0, w);

  // cue "câu chuyện": Hồi 2 rung nhiễu, Hồi 3 bàn tay hữu hình bước vào
  const inStory = cur.id === 'story';
  const actScatter = inStory && overlay.act === 2 ? 1 : 0;
  const actVis = inStory && overlay.act === 3 ? 1 : 0;
  if (actVis) {
    handTarget.vis.show = 1; handTarget.vis.x = 0.9; handTarget.vis.y = 1.05; handTarget.vis.size = 0.75;
    handTarget.vis.angle = 170; handTarget.vis.tilt = 18; handTarget.vis.roll = 180;
  }
  // cue "giá ấn định": kéo giá càng thấp, bàn tay hữu hình càng nắm chặt
  const squeezeT = cur.id === 'price' ? overlay.squeezeT : 0;

  // cue "bóc lớp": tiến độ tan da gắn trực tiếp với cuộn trong phạm vi cue này
  if (cur.id === 'peel') {
    const i2 = CUES.indexOf(cur);
    const y0 = anchors[i2], y1 = anchors[i2 + 1] ?? (y0 + innerHeight);
    const probe = window.scrollY + innerHeight * 0.55;
    targetGhost = smoothstep(y0 + (y1 - y0) * 0.05, y0 + (y1 - y0) * 0.6, probe);
  }

  // chế độ đọc: bảng rộng đang chiếm màn hình → tay lùi ra mép phải, nhỏ lại, mờ bớt
  const k = reduceMotion ? 1 : 1 - Math.exp(-dt * 4.5);
  view.reading = lerp(view.reading, overlay.reading, 1 - Math.exp(-dt * 3));
  for (const side of ['inv', 'vis']) {
    const tgt = handTarget[side], v = view[side];
    for (const key2 of HAND_KEYS) v[key2] = lerp(v[key2], tgt[key2], k);
    const pose = poseOf(w > 0.5 ? cur[side].pose : prev[side].pose);
    // chuyển tư thế mượt theo thời gian (quaternion)
    if (!v.poseQ) v.poseQ = {};
    for (const n of BONE_NAMES) {
      if (!v.poseQ[n]) v.poseQ[n] = pose[n].clone();
      v.poseQ[n].slerp(pose[n], reduceMotion ? 1 : 1 - Math.exp(-dt * 3.2));
    }
  }
  view.split = lerp(view.split, targetSplit, k);
  view.ghost = lerp(view.ghost, targetGhost, reduceMotion ? 1 : 1 - Math.exp(-dt * 6));
  view.scatter = lerp(view.scatter, actScatter, 1 - Math.exp(-dt * 2.5));
  view.squeeze = lerp(view.squeeze, squeezeT, 1 - Math.exp(-dt * 5));

  // ánh sáng theo chủ đề
  const L = LIGHTING[rootEl.dataset.theme] || LIGHTING.night;
  const kl = 1 - Math.exp(-dt * 2.2);
  for (const key2 in light) light[key2] = lerp(light[key2], L[key2], kl);
  hemi.intensity = light.hemi; key.intensity = light.key; rim.intensity = light.rim;
  bloom.strength = light.bloom; renderer.toneMappingExposure = light.exposure;

  if (visHand && invHand) {
    const r = view.reading;
    const retreat = (st) => ({ ...st, x: lerp(st.x, 0.96, r), y: lerp(st.y, st.y - 0.18, r), size: lerp(st.size, st.size * 0.6, r) });
    const sInv = retreat(view.inv), sVis = retreat(view.vis);
    // mở màn: bàn tay hữu hình hiện dần từ nhiễu, bàn tay vô hình sáng dần lên
    sVis.show *= smoothstep(0.25, 1, introE);
    sInv.show *= smoothstep(0, 0.7, introE);

    // bàn tay hữu hình: tư thế + nắm lại khi giá bị ấn định
    const visPose = {};
    for (const n of BONE_NAMES) visPose[n] = view.vis.poseQ[n].clone().slerp(LIB.grip[n], view.squeeze * 0.9);
    placeHand(visHand, sVis, visPose, t, 0);
    placeHand(invHand, sInv, view.inv.poseQ, t, 1);

    // hiện/ẩn
    const onPaper = rootEl.dataset.theme === 'paper';
    visUniforms.uDissolve.value = Math.max(1 - sVis.show, view.ghost * 0.98);
    visHand.holder.visible = visUniforms.uDissolve.value < 0.985;
    visGhostUniforms.uOpacity.value = view.ghost * 0.9;
    const invShow = sInv.show * (onPaper ? 0 : 1) * (1 - view.reading * 0.45);
    invUniforms.uOpacity.value = invShow;
    invGhostOpacity.value = invShow * (1 - 0.8 * view.split) * (1 - 0.5 * view.scatter);
    invHand.holder.visible = invShow > 0.01;
    invUniforms.uSplit.value = view.split;
    invUniforms.uScatter.value = view.scatter;
    invUniforms.uWarm.value = view.scatter;
    if (invHand.holder.visible) {
      invHand.model.updateMatrixWorld(true);
      invParticles.update();
    }
    updateLabels(cur, w, sInv, sVis);
  }

  if (index !== lastIndex) { lastIndex = index; document.body.dataset.cue = String(index); }
  composer.render();
}

const tipV = new THREE.Vector3(), projV = new THREE.Vector3();
function toScreen(v) {
  projV.copy(v).project(camera);
  return { x: (projV.x * 0.5 + 0.5) * innerWidth, y: (-projV.y * 0.5 + 0.5) * innerHeight };
}
function clusterCenter(c) {
  // tâm cụm: trung bình vài xương đại diện + độ lệch tách cụm (khớp với shader)
  const names = [['thumb_prox', 'thumb_dist'], ['index_midd', 'midd_midd'], ['ring_midd', 'pinky_midd']][c];
  tipV.set(0, 0, 0);
  const tv = new THREE.Vector3();
  names.forEach(n => tipV.add(invHand.boneWorld(n, tv)));
  tipV.multiplyScalar(1 / names.length);
  return tipV;
}
let colRight = 0, colCue = -1;
const centerV = new THREE.Vector3();
function updateLabels(cue, w, sInv, sVis) {
  const labels = cue.labels || [];
  const on = innerWidth >= 1100 && w > 0.7 && view.reading < 0.2;
  const ci = CUES.indexOf(cue);
  if (ci !== colCue) {
    colCue = ci;
    const el = document.querySelector(cue.at);
    const inner = el && el.closest('.section') && el.closest('.section').querySelector('.section__inner');
    colRight = inner ? inner.getBoundingClientRect().left + Math.min(inner.getBoundingClientRect().width, 44 * 16) : innerWidth * 0.45;
  }
  for (let i = 0; i < Math.max(labels.length, labelPool.length); i++) {
    const L = getLabel(i);
    if (!L) continue;
    const spec = labels[i];
    if (!spec || !on) { L.el.classList.remove('is-on'); L.line.classList.remove('is-on'); L.dot.classList.remove('is-on'); continue; }
    const [who, ref, text] = spec;
    const hand = who === 'vis' ? visHand : invHand;
    let p;
    if (who === 'cluster') {
      const m = invHand.meshes[0];
      p = invParticles.centers[ref].clone().addScaledVector(invParticles.clusterDirs[ref], view.split * invHand.bindLen * 1.25).applyMatrix4(m.matrixWorld);
    } else {
      p = hand.tipWorld(ref, tipV).clone();
    }
    const tip = toScreen(p);
    // tâm bàn tay trên màn hình: giữa cổ tay và khớp gốc ngón giữa
    const h = who === 'vis' ? visHand : invHand;
    h.boneWorld('midd_meta', centerV);
    const c = toScreen(centerV);
    let dx = tip.x - c.x, dy = tip.y - c.y;
    const len = Math.hypot(dx, dy) || 1; dx /= len; dy /= len;
    if (L.text !== text) { L.el.textContent = text; L.text = text; L.w = 0; }
    if (!L.w) L.w = L.el.offsetWidth || 120;
    const reach = 64;
    let ax = tip.x + dx * reach, ay = tip.y + dy * reach;
    const leftSide = dx < -0.2;
    let lx = leftSide ? ax - L.w : ax;
    lx = Math.max(colRight + 20, Math.min(innerWidth - 70 - L.w, lx));
    ay = Math.max(76, Math.min(innerHeight - 40, ay));
    const endX = leftSide ? lx + L.w : lx;
    L.el.style.setProperty('--accent', who === 'vis' ? 'var(--vis)' : 'var(--inv)');
    L.el.style.transform = `translate(${lx.toFixed(1)}px, ${(ay - 14).toFixed(1)}px)`;
    L.line.setAttribute('x1', tip.x.toFixed(1)); L.line.setAttribute('y1', tip.y.toFixed(1));
    L.line.setAttribute('x2', endX.toFixed(1)); L.line.setAttribute('y2', ay.toFixed(1));
    L.dot.setAttribute('cx', tip.x.toFixed(1)); L.dot.setAttribute('cy', tip.y.toFixed(1));
    L.dot.style.fill = who === 'vis' ? 'var(--vis)' : 'var(--inv)';
    L.el.classList.add('is-on'); L.line.classList.add('is-on'); L.dot.classList.add('is-on');
  }
}

function loop() {
  rafId = requestAnimationFrame(loop);
  if (document.hidden) return;
  update();
}
function start() {
  if (running) return;
  running = true;
  clock.start();
  loop();
}

/* --------------------------------------------------------------------------
   12. Sự kiện từ trang
   -------------------------------------------------------------------------- */
window.addEventListener('hands:reading', e => { overlay.reading = e.detail.on ? 1 : 0; });
window.addEventListener('hands:act', e => { overlay.act = e.detail.act; });
window.addEventListener('hands:price', e => { overlay.squeezeT = Math.max(0, Math.min(1, e.detail.gap * 1.6)); });
function onResize() {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  applyQuality();
  measureAnchors();
}
window.addEventListener('resize', onResize, { passive: true });
window.addEventListener('load', measureAnchors);
document.fonts?.ready.then(measureAnchors);
// đo lại vị trí neo khi bố cục thay đổi (ảnh, quiz mở rộng, v.v.)
if ('ResizeObserver' in window) new ResizeObserver(() => measureAnchors()).observe(document.body);

// để kiểm thử và tinh chỉnh từ console
window.__hands = {
  CUES, view, overlay, LIB, measureAnchors, perf,
  tip(who, bone) { const h = who === 'vis' ? visHand : invHand; return h ? toScreen(h.tipWorld(bone, new THREE.Vector3()).clone()) : null; }
};
