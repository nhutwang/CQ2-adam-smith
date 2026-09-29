/* ==========================================================================
   Bàn tay vô hình — Bàn tay hữu hình · scene3d.js
   Sân khấu 3D: hai bàn tay người "sống" bên trong trang web.

   - Bàn tay hữu hình : hand-visible.glb (mô hình giải phẫu, da thật). Cổ tay tan vào
                        bóng tối; khi nằm sau chữ trên nền tối thì chìm xuống, chỉ còn
                        viền sáng (như lenis.dev) để chữ luôn đọc được mà tay vẫn to.
   - Bàn tay vô hình  : hand-invisible.glb (cùng bộ 21 xương), chỉ thấy qua ánh sáng:
                        viền phát sáng + đám mây hạt bám theo xương.
   - Đạo diễn         : KEYS là các khung hình khóa neo vào vị trí cuộn (phần tử trong
                        trang hoặc tiến độ của một đoạn được ghim). Giữa hai khóa, mọi
                        thông số được nội suy liên tục theo cuộn; lớp vật lý (lò xo theo
                        đà cuộn, nhịp thở, cử chỉ tự phát) đặt chồng lên trên.
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
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1));
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
   3. Shader dùng chung
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
   4. Bàn tay có xương — chuẩn hóa: cổ tay ở gốc, ngón theo +Y, dài 1
   -------------------------------------------------------------------------- */
const tmpV = new THREE.Vector3(), tmpV2 = new THREE.Vector3(), tmpQ = new THREE.Quaternion();

class RiggedHand {
  constructor(gltf, kind) {
    this.kind = kind;
    this.holder = new THREE.Group();
    this.inner = new THREE.Group();
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
    const inv = new THREE.Matrix4().makeBasis(x, y, z).invert();
    const m = new THREE.Matrix4().makeScale(1 / len, 1 / len, 1 / len).multiply(inv).multiply(new THREE.Matrix4().makeTranslation(-wrist.x, -wrist.y, -wrist.z));
    m.decompose(this.inner.position, this.inner.quaternion, this.inner.scale);
  }
  computeBindFrame() {
    const mesh = this.meshes[0];
    const sk = mesh.skeleton;
    const pos = name => {
      const i = sk.bones.findIndex(b => b.name === name);
      return new THREE.Vector3().setFromMatrixPosition(sk.boneInverses[i].clone().invert()).applyMatrix4(mesh.bindMatrixInverse);
    };
    const wrist = pos('radius_ulna');
    const midd = pos('midd_meta');
    this.bindWrist = wrist;
    this.bindAxis = midd.clone().sub(wrist).normalize();
    this.bindLen = midd.distanceTo(wrist);
    // chiều dài thật từ cổ tay tới đầu ngón xa nhất theo trục cánh tay (dùng cho dải tan vào bóng tối)
    const pa = mesh.geometry.attributes.position;
    let maxAlong = 0;
    for (let i = 0; i < pa.count; i++) {
      const d = (pa.getX(i) - wrist.x) * this.bindAxis.x + (pa.getY(i) - wrist.y) * this.bindAxis.y + (pa.getZ(i) - wrist.z) * this.bindAxis.z;
      if (d > maxAlong) maxAlong = d;
    }
    this.handLen = maxAlong;
  }
  applyPose(deltas) {
    for (const name in deltas) {
      const bone = this.bones[name];
      if (bone) bone.quaternion.copy(this.rest[name]).multiply(deltas[name]);
    }
  }
}

/* --------------------------------------------------------------------------
   5. Thư viện tư thế
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
LIB.reach = blendPose(LIB.open, LIB.point, 0.42);   // vươn ngón trỏ
LIB.relax = blendPose(LIB.open, LIB.fist, 0.2);     // thả lỏng
LIB.cup = blendPose(LIB.open, LIB.fist, 0.45);      // khum tay
LIB.grip = blendPose(LIB.open, LIB.fist, 0.78);     // nắm chặt — can thiệp quá tay
LIB.god = blendPose(LIB.open, LIB.point, 0.62);     // "Sáng tạo Adam": ngón trỏ duỗi, ngón khác chùng
LIB.adam = blendPose(LIB.relax, LIB.reach, 0.55);   // bàn tay Adam: mềm, ngón trỏ hơi rũ
LIB.spread = LIB.open;
function resolvePose(spec) {
  if (!spec) return LIB.relax;
  if (typeof spec === 'string') return LIB[spec] || LIB.relax;
  return blendPose(LIB[spec[0]], LIB[spec[1]], spec[2]);
}

/* --------------------------------------------------------------------------
   6. Vật liệu bàn tay hữu hình: da thật + tan vào bóng tối + tan rã + chế độ chìm
   -------------------------------------------------------------------------- */
function upgradeSkinMaterial(material, uniforms) {
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
        uniform vec3 uWrist; uniform vec3 uAxis; uniform float uLen; uniform float uHandLen;
        uniform float uFadeA; uniform float uFadeB;
        uniform float uDissolve; uniform float uNoiseScale; uniform vec3 uEdge;
        uniform float uDim; uniform float uWash; uniform vec3 uBg;
        ${NOISE_GLSL}`)
      .replace('#include <opaque_fragment>', `
        float fadeArm = armFade(vBindPos, uWrist, uAxis, uHandLen, uFadeA, uFadeB);
        float nD = fbm(vBindPos * uNoiseScale / uLen);
        if (nD < uDissolve * 1.02 || fadeArm < 0.004) discard;
        float edge = 1.0 - smoothstep(uDissolve, uDissolve + 0.07, nD);
        outgoingLight = mix(outgoingLight, uEdge * 2.2, edge * step(0.002, uDissolve));
        // chế độ chìm: thân tối, chỉ còn viền sáng màu đất nung
        float fres = pow(1.0 - abs(dot(normalize(normal), normalize(vViewPosition))), 2.2);
        vec3 lowKey = outgoingLight * 0.16 + uEdge * fres * 1.35;
        outgoingLight = mix(outgoingLight, lowKey, uDim);
        outgoingLight = mix(outgoingLight, uBg, uWash);
        outgoingLight = mix(uBg, outgoingLight, fadeArm);
        diffuseColor.a *= smoothstep(0.0, 0.35, fadeArm);
        #include <opaque_fragment>`);
  };
  material.customProgramCacheKey = () => 'skin-fade-dissolve-dim';
  material.needsUpdate = true;
}

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
      uniform vec3 uWrist; uniform vec3 uAxis; uniform float uLen; uniform float uHandLen; uniform float uFadeA; uniform float uFadeB;
      varying vec3 vN; varying vec3 vV; varying vec3 vBindPos;
      ${NOISE_GLSL}
      void main() {
        float f = pow(1.0 - abs(dot(normalize(vN), normalize(vV))), 2.4);
        float fade = armFade(vBindPos, uWrist, uAxis, uHandLen, uFadeA, uFadeB);
        float shimmer = 0.85 + 0.15 * sin(uTime * 1.3 + dot(vBindPos, uAxis) / uHandLen * 9.0);
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
  constructor(mesh, count, uniforms) {
    this.mesh = mesh;
    const geo = mesh.geometry;
    const pos = geo.attributes.position, index = geo.index;
    const triCount = index ? index.count / 3 : pos.count / 3;
    const ia = i => (index ? index.getX(i) : i);
    const areas = new Float32Array(triCount); let total = 0;
    const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
    for (let t = 0; t < triCount; t++) {
      a.fromBufferAttribute(pos, ia(t * 3)); b.fromBufferAttribute(pos, ia(t * 3 + 1)); c.fromBufferAttribute(pos, ia(t * 3 + 2));
      total += new THREE.Triangle(a, b, c).getArea(); areas[t] = total;
    }
    this.count = count;
    this.tri = new Uint32Array(count * 3);
    this.bary = new Float32Array(count * 3);
    const bind = new Float32Array(count * 3), seed = new Float32Array(count), cluster = new Float32Array(count * 3), groupId = new Float32Array(count);
    const fingerW = new Float32Array(count);
    // ba nhóm ngón ứng với ba chủ thể: ngón cái | trỏ + giữa | áp út + út
    const sk = mesh.skeleton;
    const skinIndex = geo.attributes.skinIndex, skinWeight = geo.attributes.skinWeight;
    const group = name => name.startsWith('thumb') ? 0 : (name.startsWith('index') || name.startsWith('midd')) ? 1 : (name.startsWith('ring') || name.startsWith('pinky')) ? 2 : -1;
    const bindBone = bn => new THREE.Vector3().setFromMatrixPosition(sk.boneInverses[sk.bones.indexOf(bn)].clone().invert()).applyMatrix4(mesh.bindMatrixInverse);
    const gCent = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()], gN = [0, 0, 0];
    sk.bones.forEach(bn => { const g = group(bn.name); if (g >= 0) { gCent[g].add(bindBone(bn)); gN[g]++; } });
    gCent.forEach((cc, g) => cc.multiplyScalar(1 / Math.max(1, gN[g])));
    const handCent = gCent[0].clone().add(gCent[1]).add(gCent[2]).multiplyScalar(1 / 3);
    this.clusterDirs = gCent.map(cc => cc.clone().sub(handCent).normalize());
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
      let best = 0, bw = -1;
      for (let k = 0; k < 4; k++) { const w = skinWeight.getComponent(i0, k); if (w > bw) { bw = w; best = skinIndex.getComponent(i0, k); } }
      let g = group(sk.bones[best].name);
      if (g < 0) {
        let md = Infinity;
        for (let k = 0; k < 3; k++) { const dd = a.distanceToSquared(gCent[k]); if (dd < md) { md = dd; g = k; } }
      }
      const d = this.clusterDirs[g];
      cluster.set([d.x, d.y, d.z], p * 3);
      groupId[p] = g;
      // mức "thuộc về ngón" lấy theo trọng số da: đốt ngón = 1, xương bàn = 0,35, lòng bàn tay = 0
      // → vùng sáng chuyển mượt qua khớp, lòng bàn tay giữ nguyên nên bàn tay không có đường nứt
      let fw = 0;
      for (let k = 0; k < 4; k++) {
        const wk = skinWeight.getComponent(i0, k); if (wk <= 0) continue;
        const bn = sk.bones[skinIndex.getComponent(i0, k)].name;
        if (group(bn) === g) fw += wk * (bn.endsWith('_meta') ? 0.35 : 1);
      }
      fingerW[p] = Math.min(1, fw);
    }
    this.geometry = new THREE.BufferGeometry();
    this.positions = new Float32Array(count * 3);
    this.geometry.setAttribute('position', new THREE.BufferAttribute(this.positions, 3).setUsage(THREE.DynamicDrawUsage));
    this.geometry.setAttribute('aBind', new THREE.BufferAttribute(bind, 3));
    this.geometry.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
    this.geometry.setAttribute('aCluster', new THREE.BufferAttribute(cluster, 3));
    this.geometry.setAttribute('aGroup', new THREE.BufferAttribute(groupId, 1));
    this.geometry.setAttribute('aFinger', new THREE.BufferAttribute(fingerW, 1));
    this.material = new THREE.ShaderMaterial({
      uniforms: { ...uniforms, uMap: { value: sprite } },
      vertexShader: /* glsl */`
        uniform float uTime; uniform float uSize; uniform float uScatter; uniform float uLen;
        uniform vec3 uWrist; uniform vec3 uAxis; uniform float uHandLen; uniform float uFadeA; uniform float uFadeB; uniform float uPixelRatio;
        uniform vec3 uFocus; uniform float uFocusOn;
        attribute vec3 aBind; attribute float aSeed; attribute float aGroup; attribute float aFinger;
        varying float vAlpha; varying float vSeed; varying float vFocus;
        ${NOISE_GLSL}
        void main() {
          vec3 p = position;
          float w = aGroup < 0.5 ? uFocus.x : (aGroup < 1.5 ? uFocus.y : uFocus.z);
          // làm nổi nhóm ngón chỉ bằng ánh sáng: hạt nằm yên trên mặt da, bàn tay luôn liền một khối
          float fo = uFocusOn * aFinger;
          vec3 jitter = vec3(vnoise(aBind * 3.0 / uLen + uTime * 0.9), vnoise(aBind * 3.0 / uLen + 11.0 + uTime * 0.8), vnoise(aBind * 3.0 / uLen + 23.0 + uTime * 1.1)) - 0.5;
          p += jitter * uLen * (0.012 + uScatter * 0.12);
          float along = dot(aBind - uWrist, uAxis) / uHandLen;
          float fade = smoothstep(uFadeA, uFadeB, along);
          // phía cổ tay: hạt thưa dần và trôi ra xa như tan vào không khí — không có mép cắt
          p += uAxis * (1.0 - fade) * (0.3 + aSeed) * uHandLen * -0.18;
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          float tw = 0.65 + 0.35 * sin(uTime * (1.2 + aSeed * 2.0) + aSeed * 40.0);
          vFocus = mix(1.0, mix(0.4, 2.8, w), fo);
          vAlpha = fade * tw * vFocus;
          vSeed = aSeed;
          gl_PointSize = uSize * uPixelRatio * (0.6 + aSeed * 0.8) * (10.0 / -mv.z) * mix(1.0, 1.3, w * fo);
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: /* glsl */`
        uniform sampler2D uMap; uniform vec3 uColor; uniform vec3 uColor2; uniform float uOpacity; uniform float uWarm;
        varying float vAlpha; varying float vSeed; varying float vFocus;
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
    mesh.add(this.points);
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
    C.forEach(cc => cc.set(0, 0, 0));
    const active = this.active || this.count;
    for (let p = 0; p < active; p++) {
      const a = tri[p * 3] * 3, b = tri[p * 3 + 1] * 3, c = tri[p * 3 + 2] * 3;
      const u = bary[p * 3], w = bary[p * 3 + 1], z = bary[p * 3 + 2];
      out[p * 3] = s[a] * u + s[b] * w + s[c] * z;
      out[p * 3 + 1] = s[a + 1] * u + s[b + 1] * w + s[c + 1] * z;
      out[p * 3 + 2] = s[a + 2] * u + s[b + 2] * w + s[c + 2] * z;
      const g = gid[p]; C[g].x += out[p * 3]; C[g].y += out[p * 3 + 1]; C[g].z += out[p * 3 + 2]; n[g]++;
    }
    C.forEach((cc, g) => cc.multiplyScalar(1 / Math.max(1, n[g])));
    this.geometry.attributes.position.needsUpdate = true;
  }
}

/* --------------------------------------------------------------------------
   8. Kịch bản
   Mỗi khóa: at (bộ chọn) + p (tiến độ trong đoạn được ghim, 0..1) hoặc line (vạch trên
   màn hình mà đỉnh phần tử chạm tới, mặc định 0,55). hold: tỉ lệ đứng yên trước khi
   chuyển sang khóa sau. Thông số không ghi thì kế thừa từ khóa trước.

   Bàn tay (inv, vis):
     show   0..1 hiện/ẩn          x, y   cổ tay theo tọa độ màn hình (-1..1)
     size   dài bàn tay / cao khung   angle  hướng ngón (0 lên, 90 trái, -90 phải)
     tilt   ngả ngón về phía người xem     roll   xoay quanh trục cánh tay
     dim    chìm tối, chỉ còn viền sáng    fade   cổ tay tan vào bóng tối (0..1)
     pose   tên tư thế trong LIB
   Toàn cảnh (g): meet (tự khớp hai đầu ngón trỏ), mx, my (điểm gặp), gap (khe hở),
     spark (tia sáng ở khe), ghost (bóc lớp da), f0 f1 f2 (làm sáng nhóm ngón), stage
     (x tính theo vùng sân khấu bên phải cột chữ thay vì toàn màn hình).
   -------------------------------------------------------------------------- */
const HAND_KEYS = ['show', 'x', 'y', 'size', 'angle', 'tilt', 'roll', 'dim', 'fade'];
const G_KEYS = ['meet', 'mx', 'my', 'gap', 'spark', 'ghost', 'f0', 'f1', 'f2'];
const HAND_DEFAULT = { show: 0, x: 0.6, y: -1.3, size: 0.9, angle: 0, tilt: 10, roll: 0, dim: 0, fade: 0.2, pose: 'relax' };
const G_DEFAULT = { meet: 0, mx: 0, my: 0, gap: 0.1, spark: 0, ghost: 0, f0: 0, f1: 0, f2: 0 };

/* Ngôn ngữ chung của hai bàn tay: bàn tay vô hình luôn rủ từ trên xuống (ngón chỉ xuống),
   bàn tay hữu hình luôn vươn từ dưới lên (ngón chỉ lên). Cảnh "chạm tay" dựng dọc như ảnh
   tham khảo: hai đầu ngón trỏ gặp nhau qua một khe sáng tại (mx, my). */
const ADAM = (x, y, size, extra = {}) => ({ show: 1, x, y, size, angle: -8, tilt: 14, roll: 135, fade: 0.7, dim: 0, pose: 'reach', ...extra });
const GOD = (x, y, size, extra = {}) => ({ show: 1, x, y, size, angle: 188, tilt: 14, roll: -145, fade: 0.7, dim: 0, pose: 'god', ...extra });
/* cặp chạm tay: cổ tay đặt sẵn gần đúng chỗ (đo từ mô hình) để lúc bật/tắt tự khớp không bị giật */
const VIS_SCALE = 0.9;  // bàn tay hữu hình dày hơn nên thu nhỏ một chút cho cân với bàn tay vô hình
const PAIR = (mx, my, size, gap, spark, vis = {}, inv = {}, g = {}) => ({
  vis: ADAM(mx - 0.39 * size * VIS_SCALE, my - 1.7 * size * VIS_SCALE - gap / 2, size * VIS_SCALE, vis),
  inv: GOD(mx - 0.16 * size, my + 1.87 * size + gap / 2, size, inv),
  g: { meet: 1, mx, my, gap, spark, ...g }
});
const UP_OUT = { show: 0, y: 2.3 };     // vô hình rút lên trên
const DOWN_OUT = { show: 0, y: -2.3 };  // hữu hình lui xuống dưới

const KEYS_SPEC = [
  // ── Trang đầu: tiêu đề bên trái, cặp bàn tay dọc ở nửa phải, hai ngón trỏ gần chạm
  { at: '#hero', p: 0, abs: true, hold: 0.15, ...PAIR(0.56, 0.0, 0.44, 0.12, 0.15) },
  // cuộn: chữ phóng to bay qua camera, hai bàn tay ra giữa, lớn dần và tách nhẹ
  { at: '#hero', p: 0.34, abs: true, ...PAIR(0, 0.02, 0.6, 0.34, 0.1) },
  { at: '#hero', p: 0.6, abs: true, ...PAIR(0.16, 0.02, 0.66, 0.06, 0.35) },
  // khe hở gần như khép lại, tia sáng lóe lên đúng lúc luận điểm hiện bên trái
  { at: '#hero', p: 0.72, abs: true, hold: 0.5, ...PAIR(0.3, 0.02, 0.68, 0.026, 1) },
  { at: '#hero', p: 1, abs: true, ...PAIR(0.3, 0.02, 0.68, 0.5, 0) },
  // mục 1 — chỉ có chữ: vô hình rút lên, hữu hình lui xuống
  { at: '#s1 .section__head', abs: true, hold: 0.6,
    vis: { ...DOWN_OUT, size: 0.6 }, inv: { ...UP_OUT, size: 0.6 }, g: { meet: 0, spark: 0 } },
  // mục 2 — bàn tay vô hình rủ từ trên xuống, khum trên phiên chợ
  { at: '#s2 .section__head', stage: true, hold: 0.2,
    inv: { show: 1, x: 0.55, y: 1.16, size: 0.9, angle: 182, tilt: 24, roll: -170, fade: 0.5, dim: 0, pose: 'cup' },
    vis: { show: 0, x: 0.7, y: -2.3, size: 0.8, angle: -6, tilt: 16, roll: 150, fade: 0.5, dim: 0.8, pose: 'reach' } },
  { at: '#s2 .story', line: 0.95, id: 'story', stage: true, hold: 0.7,
    inv: { x: 0.53, y: 1.1, size: 0.95 } },
  { at: '#s2 .prose', stage: true, inv: { ...UP_OUT } },
  // đoạn chữ lớn "Bàn tay vô hình": chữ bay qua, bàn tay vô hình rủ xuống từ trên cao
  { at: '#i1', p: 0.45, abs: true, inv: { show: 0, x: 0, y: 2.4, size: 1.05, angle: 180, tilt: 8, roll: -170, fade: 0.25, pose: 'relax' } },
  { at: '#i1', p: 0.82, abs: true, hold: 0.3, inv: { show: 1, x: 0.02, y: 1.2, size: 1.08, pose: 'open' } },
  // mục 3 — bàn tay vô hình lớn ở nửa phải, rủ từ trên, nhãn ở đầu ngón
  { at: '#s3 .section__head', stage: true, hold: 0.25,
    inv: { show: 1, x: 0.55, y: 1.14, size: 0.88, angle: 180, tilt: 12, roll: -170, fade: 0.3, pose: 'open' },
    labels: [['inv', 'thumb_dist', 'Tư lợi'], ['inv', 'index_dist', 'Cạnh tranh'], ['inv', 'midd_dist', 'Giá cả – tín hiệu']] },
  { at: '#s3 .pillars', stage: true, hold: 0.5, inv: { x: 0.56, y: 1.14, size: 0.88, angle: 182 },
    labels: [['inv', 'thumb_dist', 'Tư lợi'], ['inv', 'index_dist', 'Cạnh tranh'], ['inv', 'midd_dist', 'Giá cả – tín hiệu']] },
  { at: '#s3 .subhead:nth-of-type(2)', stage: true, inv: { x: 0.62, y: 1.2, size: 0.92, angle: 174, tilt: 20, roll: -150, pose: 'relax' } },
  { at: '#s3-laws', stage: true, hold: 0.5, inv: { x: 0.54, y: 1.14, size: 0.88, angle: 180, tilt: 12, roll: -170, pose: 'open' },
    labels: [['inv', 'index_dist', 'Quy luật giá trị'], ['inv', 'midd_dist', 'Cung – cầu'], ['inv', 'ring_dist', 'Cạnh tranh'], ['inv', 'pinky_dist', 'Lưu thông tiền tệ']] },
  // mục 4 — bàn tay nguyên vẹn; nhóm ngón của từng chủ thể sáng lên khi được nhắc tới
  { at: '#s4 .section__head', stage: true, hold: 0.3, inv: { x: 0.56, y: 1.14, size: 0.88, angle: 182, pose: 'open' }, g: { f0: 0, f1: 0, f2: 0 } },
  { at: '#s4 .actor:nth-of-type(1)', stage: true, hold: 0.55, inv: { angle: 176 }, g: { f0: 1, f1: 0, f2: 0 }, labels: [['group', 0, 'Người sản xuất']] },
  { at: '#s4 .actor:nth-of-type(2)', stage: true, hold: 0.55, inv: { angle: 184 }, g: { f0: 0, f1: 1, f2: 0 }, labels: [['group', 1, 'Người tiêu dùng']] },
  { at: '#s4 .actor:nth-of-type(3)', stage: true, hold: 0.55, inv: { angle: 180 }, g: { f0: 0, f1: 0, f2: 1 }, labels: [['group', 2, 'Trung gian']] },
  { at: '#s4 .table-wrap', stage: true, hold: 0.6, inv: { pose: 'cup' }, g: { f0: 0.7, f1: 0.7, f2: 0.7 } },
  { at: '#i2', p: 0.3, abs: true, inv: { ...UP_OUT }, g: { f0: 0, f1: 0, f2: 0 } },
  // đoạn chữ lớn "Bàn tay hữu hình": lá chớp phủ nền giấy, bàn tay hữu hình vươn lên từ đáy
  { at: '#i2', p: 0.8, abs: true, vis: { show: 0, x: 0.04, y: -2.4, size: 1.05, angle: -4, tilt: 10, roll: 0, fade: 0.25, dim: 0, pose: 'point' } },
  { at: '#i2', p: 1, abs: true, vis: { show: 1, x: 0.04, y: -1.22, size: 1.05 } },
  // mục 5 — bàn tay hữu hình trên nền giấy
  { at: '#s5 .section__head', stage: true, hold: 0.3,
    vis: { show: 1, x: 0.56, y: -1.14, size: 0.88, angle: -2, tilt: 14, roll: 0, fade: 0.3, pose: 'flat' },
    labels: [['vis', 'thumb_dist', 'Pháp luật'], ['vis', 'index_dist', 'Chính sách'], ['vis', 'pinky_dist', 'Công cụ kinh tế']] },
  { at: '#s5 .sd-widget', id: 'price', stage: true, hold: 0.6, vis: { x: 0.9, y: -1.15, size: 0.9, angle: 10, pose: 'cup' } },
  { at: '#s5 .subhead:nth-of-type(2)', stage: true, hold: 0.4, vis: { x: 0.62, y: -1.2, size: 0.95, angle: 0, pose: 'point' } },
  // mục 6 — nghị quyết về kinh tế tư nhân: bàn tay vô hình rủ xuống; kinh tế nhà nước: bàn tay hữu hình vươn lên
  { at: '#s6 .section__head', stage: true, vis: { ...DOWN_OUT, x: 0.36, roll: 150 },
    inv: { show: 0, x: 0.6, y: 2.3, size: 0.9, angle: 172, tilt: 20, roll: -170, fade: 0.55, dim: 0, pose: 'reach' } },
  { at: '#s6 .policy', stage: true, hold: 0.5, inv: { show: 1, x: 0.6, y: 1.12, size: 0.9 } },
  { at: '#s6 .policy--vis', stage: true, hold: 0.5, inv: { ...UP_OUT },
    vis: { show: 1, x: 0.36, y: -1.12, size: 0.9, angle: 8, tilt: 18, roll: 150, fade: 0.55, dim: 0.85, pose: 'reach' } },
  { at: '#s6 .table-wrap', stage: true, vis: { ...DOWN_OUT } },
  // đoạn chữ lớn "Mỗi bàn tay / một phần việc": hai bàn tay chạm nhau ở giữa
  { at: '#i3', p: 0.46, abs: true, vis: ADAM(-0.25, -2.6, 0.63, { show: 0, dim: 0.35 }), inv: GOD(-0.11, 2.7, 0.7, { show: 0 }),
    g: { meet: 0, mx: 0, my: 0.02, gap: 0.3, spark: 0 } },
  { at: '#i3', p: 0.78, abs: true, ...PAIR(0, 0.02, 0.7, 0.06, 0.4, { dim: 0.35 }) },
  { at: '#i3', p: 1, abs: true, hold: 0.2, ...PAIR(0, 0.02, 0.71, 0, 1, { dim: 0.35 }) },
  // mục 7 — cặp bàn tay lui về nửa phải, tách ra một khe rộng
  { at: '#s7 .section__head', abs: true, hold: 0.3, ...PAIR(0.62, 0.0, 0.6, 0.3, 0, { dim: 0.75, fade: 0.4 }, { fade: 0.4 }) },
  // 7.2 — lớp da tan dần, lộ bàn tay vô hình bên trong
  { at: '#s7 .subhead:nth-of-type(2)', stage: true,
    vis: { show: 1, x: 0.58, y: -1.2, size: 1.0, angle: 0, tilt: 12, roll: 0, dim: 0, fade: 0.3, pose: 'open' },
    inv: { ...UP_OUT }, g: { meet: 0, spark: 0, ghost: 0 } },
  { at: '#s7 .verdict__item:nth-of-type(2)', stage: true, hold: 0.4, g: { ghost: 1 } },
  // 7.3 — phản biện: hai ngón trỏ lại hướng vào nhau nhưng chưa chạm
  { at: '#s7 .subhead:nth-of-type(3)', abs: true, hold: 0.3,
    ...PAIR(0.6, 0.0, 0.62, 0.22, 0.2, { dim: 0.75, fade: 0.4 }, { fade: 0.4 }, { ghost: 0 }) },
  { at: '#s7 .discussion', abs: true, vis: { ...DOWN_OUT }, inv: { ...UP_OUT }, g: { meet: 0, spark: 0 } },
  // trắc nghiệm — cặp chạm tay thu nhỏ khép lại cả trang
  { at: '#quiz', abs: true, hold: 0.2, ...PAIR(0.74, 0.0, 0.42, 0.05, 0.6, { dim: 0.35 }) }
];

/* hợp nhất: mỗi khóa đầy đủ thông số (kế thừa khóa trước) */
const KEYS = [];
(function buildKeys() {
  let prev = { inv: { ...HAND_DEFAULT }, vis: { ...HAND_DEFAULT }, g: { ...G_DEFAULT } };
  for (const spec of KEYS_SPEC) {
    const k = {
      at: spec.at, p: spec.p, line: spec.line ?? 0.55, hold: spec.hold ?? 0, id: spec.id || null,
      stage: !!spec.stage && !spec.abs, labels: spec.labels || null,
      inv: { ...prev.inv, ...(spec.inv || {}) }, vis: { ...prev.vis, ...(spec.vis || {}) }, g: { ...prev.g, ...(spec.g || {}) }
    };
    KEYS.push(k);
    prev = k;
  }
})();

/* vị trí cuộn của từng khóa + tọa độ x tuyệt đối */
let stageL = 0;
function textRight(el) {
  if (!el) return 0;
  const r = document.createRange(); r.selectNodeContents(el);
  let right = 0; for (const rect of r.getClientRects()) right = Math.max(right, rect.right);
  return right;
}
function measureStage() {
  const inner = document.querySelector('#s1 .section__inner');
  const colRightPx = inner ? inner.getBoundingClientRect().right : innerWidth * 0.45;
  stageL = Math.max(-0.2, ((colRightPx + 28) / innerWidth) * 2 - 1);
}
function measureKeys() {
  measureStage();
  let last = -Infinity;
  for (const k of KEYS) {
    const el = document.querySelector(k.at);
    let y = last + 1;
    if (el) {
      const top = el.getBoundingClientRect().top + window.scrollY;
      y = k.p != null ? top + k.p * Math.max(1, el.offsetHeight - innerHeight) : top - innerHeight * k.line;
    }
    k.y = Math.max(y, last + 1);
    last = k.y;
    for (const side of ['inv', 'vis']) {
      const h = k[side];
      h.xa = k.stage ? stageL + h.x * (1 - stageL) : h.x;
    }
  }
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
let visHand = null, invHand = null, invParticles = null, visGhost = null;
const visUniforms = {
  uWrist: { value: new THREE.Vector3() }, uAxis: { value: new THREE.Vector3(0, 1, 0) }, uLen: { value: 1 }, uHandLen: { value: 1 },
  uFadeA: { value: -0.12 }, uFadeB: { value: -0.06 },
  uDissolve: { value: 0 }, uNoiseScale: { value: 3.2 }, uEdge: { value: new THREE.Color('#e8895e') },
  uDim: { value: 0 }, uWash: { value: 0 }, uBg: { value: new THREE.Color('#06080c') }
};
const invUniforms = {
  uWrist: { value: new THREE.Vector3() }, uAxis: { value: new THREE.Vector3(0, 1, 0) }, uLen: { value: 1 }, uHandLen: { value: 1 },
  uFadeA: { value: -0.1 }, uFadeB: { value: 0.04 },
  uColor: { value: new THREE.Color('#8ccfff') }, uColor2: { value: new THREE.Color('#ff6b5e') },
  uOpacity: { value: 1 }, uTime: { value: 0 }, uSize: { value: 2.1 }, uScatter: { value: 0 },
  uWarm: { value: 0 }, uPixelRatio: { value: 1 }, uFocus: { value: new THREE.Vector3() }, uFocusOn: { value: 0 }
};
const invGhostUniforms = {
  uWrist: invUniforms.uWrist, uAxis: invUniforms.uAxis, uLen: invUniforms.uLen, uHandLen: invUniforms.uHandLen,
  uFadeA: { value: 0.0 }, uFadeB: { value: 0.08 },
  uColor: invUniforms.uColor, uOpacity: { value: 1 }, uTime: invUniforms.uTime
};
const visGhostUniforms = {
  uWrist: visUniforms.uWrist, uAxis: visUniforms.uAxis, uLen: visUniforms.uLen, uHandLen: visUniforms.uHandLen,
  uFadeA: { value: -0.05 }, uFadeB: { value: 0.05 },
  uColor: invUniforms.uColor, uOpacity: { value: 0 }, uTime: invUniforms.uTime
};

/* tia sáng ở khe hở giữa hai đầu ngón */
const sparkMat = new THREE.SpriteMaterial({ map: sprite, color: 0xffffff, transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending, opacity: 0 });
const spark = new THREE.Sprite(sparkMat);
spark.renderOrder = 10;
scene.add(spark);
const sparkHalo = new THREE.Sprite(new THREE.SpriteMaterial({ map: sprite, color: 0xffffff, transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending, opacity: 0 }));
sparkHalo.renderOrder = 9;
scene.add(sparkHalo);

const loader = new GLTFLoader();
Promise.all([loader.loadAsync('./models/hand-visible.glb'), loader.loadAsync('./models/hand-invisible.glb')])
  .then(async ([gVis, gInv]) => {
    visHand = new RiggedHand(gVis, 'vis');
    const bumpIndex = gVis.parser.json.materials[0]?.extras?.bumpTexture;
    const bump = bumpIndex != null ? await gVis.parser.getDependency('texture', bumpIndex) : null;
    visUniforms.uWrist.value.copy(visHand.bindWrist); visUniforms.uAxis.value.copy(visHand.bindAxis); visUniforms.uLen.value = visHand.bindLen; visUniforms.uHandLen.value = visHand.handLen;
    visHand.meshes.forEach(mesh => {
      const m = mesh.material;
      if (bump && mesh.name.toLowerCase().includes('hand')) { m.bumpMap = bump; m.bumpScale = 1.4; }
      m.roughness = 1.0;
      upgradeSkinMaterial(m, visUniforms);
    });
    const handMesh = visHand.meshes.find(m => m.name.toLowerCase().includes('hand')) || visHand.meshes[0];
    visGhost = new THREE.SkinnedMesh(handMesh.geometry, makeGhostMaterial(visGhostUniforms));
    visGhost.bind(handMesh.skeleton, handMesh.bindMatrix);
    visGhost.frustumCulled = false;
    visGhost.renderOrder = 2;
    handMesh.parent.add(visGhost);

    invHand = new RiggedHand(gInv, 'inv');
    invUniforms.uWrist.value.copy(invHand.bindWrist); invUniforms.uAxis.value.copy(invHand.bindAxis); invUniforms.uLen.value = invHand.bindLen; invUniforms.uHandLen.value = invHand.handLen;
    const invMesh = invHand.meshes[0];
    invMesh.material = makeGhostMaterial(invGhostUniforms);
    invMesh.renderOrder = 3;
    invParticles = new ParticleSkin(invMesh, innerWidth < 700 ? 5000 : 12000, invUniforms);
    invParticles.points.renderOrder = 4;
    // hai bàn tay đối xứng như tay trái – tay phải thật
    invHand.mirror = -1;

    scene.add(visHand.holder, invHand.holder);
    applyQuality();
    measureKeys();
    document.body.dataset.stage = 'ready';
    start();
  })
  .catch(err => {
    document.body.dataset.stage = 'error';
    console.error('Không tải được mô hình bàn tay:', err);
  });

/* --------------------------------------------------------------------------
   11. Chất lượng tự điều chỉnh theo máy (đo trên Iris Xe: Full HD 150% ~50–60 fps)
   -------------------------------------------------------------------------- */
const clock = new THREE.Clock();
const forcedQ = new URLSearchParams(location.search).get('q');
const perf = { level: forcedQ != null ? Math.max(0, Math.min(2, Number(forcedQ))) : 2, locked: forcedQ != null, acc: 0, frames: [], slow: 0 };
function applyQuality() {
  const dpr = window.devicePixelRatio || 1;
  const budget = [0.9e6, 1.4e6, 2.2e6][perf.level];
  const fit = Math.sqrt(budget / Math.max(1, innerWidth * innerHeight));
  const ratio = Math.max(0.6, Math.min(dpr, perf.level === 2 ? 1.6 : 1.2, fit));
  renderer.setPixelRatio(ratio);
  renderer.setSize(innerWidth, innerHeight);
  if (composer.setPixelRatio) composer.setPixelRatio(ratio);
  composer.setSize(innerWidth, innerHeight);
  bloom.enabled = perf.level > 0;
  const div = perf.level === 2 ? 2 : 3;
  bloom.resolution.set(innerWidth / div, innerHeight / div);
  invUniforms.uPixelRatio.value = ratio;
  if (invParticles) invParticles.setActive(perf.level === 0 ? 0.5 : 1);
  document.body.dataset.quality = String(perf.level);
}
function trackPerf(dt, t) {
  if (perf.locked || perf.level === 0 || t < 3 || document.hidden) return;
  perf.acc += Math.min(dt, 0.5); perf.frames.push(dt);
  if (perf.acc < 2.5) return;
  const sorted = perf.frames.slice().sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)];
  perf.acc = 0; perf.frames.length = 0;
  perf.slow = median > 1 / 36 ? perf.slow + 1 : 0;
  if (perf.slow >= 2) { perf.slow = 0; perf.level -= 1; applyQuality(); }
}

/* --------------------------------------------------------------------------
   12. Trạng thái động: nội suy theo cuộn → làm mượt → lớp vật lý
   -------------------------------------------------------------------------- */
function clamp01(x) { return x < 0 ? 0 : x > 1 ? 1 : x; }
function smoothstep(a, b, x) { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); }
function ease(t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }
function lerp(a, b, t) { return a + (b - a) * t; }
const poseCache = new Map();
function poseOf(spec) {
  const k = JSON.stringify(spec);
  if (!poseCache.has(k)) poseCache.set(k, resolvePose(spec));
  return poseCache.get(k);
}

const target = { inv: {}, vis: {}, g: {} };
const view = {
  inv: { ...HAND_DEFAULT, xa: 0.6, poseQ: null }, vis: { ...HAND_DEFAULT, xa: 0.6, poseQ: null },
  g: { ...G_DEFAULT }, reading: 0, scatter: 0, squeeze: 0, support: 0, init: false
};
const overlay = { reading: 0, act: 1, squeezeT: 0 };
const targetPose = { inv: {}, vis: {} };

function sampleKeys(s) {
  let i = 0;
  while (i < KEYS.length - 1 && KEYS[i + 1].y <= s) i++;
  const A = KEYS[i];
  const B = KEYS[Math.min(i + 1, KEYS.length - 1)];
  let t = 0;
  if (B !== A && s > A.y) t = clamp01((s - A.y) / (B.y - A.y));
  const raw = t;
  t = ease(clamp01((t - A.hold) / Math.max(0.0001, 1 - A.hold)));
  for (const side of ['inv', 'vis']) {
    const a = A[side], b = B[side], out = target[side];
    for (const k of HAND_KEYS) out[k] = lerp(a[k], b[k], t);
    out.xa = lerp(a.xa, b.xa, t);
    const pa = poseOf(a.pose), pb = poseOf(b.pose), tp = targetPose[side];
    for (const n of BONE_NAMES) (tp[n] || (tp[n] = new THREE.Quaternion())).copy(pa[n]).slerp(pb[n], t);
  }
  for (const k of G_KEYS) target.g[k] = lerp(A.g[k], B.g[k], t);
  return { A, B, t, raw, i };
}

/* lò xo theo đà cuộn: bàn tay bị trang kéo theo rồi đàn hồi về chỗ */
const spring = { inv: { y: 0, v: 0, r: 0, rv: 0 }, vis: { y: 0, v: 0, r: 0, rv: 0 } };
let scrollVel = 0, lastScrollY = window.scrollY, stillTime = 0;
/* cử chỉ tự phát khi người xem dừng cuộn: xòe tay áp vào "mặt kính" màn hình */
const gesture = { who: null, t: 0, next: 6 };

const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
const pointer = { x: 0, y: 0, tx: 0, ty: 0 };
if (finePointer && !reduceMotion) {
  window.addEventListener('pointermove', e => {
    pointer.tx = (e.clientX / innerWidth) * 2 - 1;
    pointer.ty = (e.clientY / innerHeight) * 2 - 1;
  }, { passive: true });
  document.addEventListener('mouseleave', () => { pointer.tx = 0; pointer.ty = 0; });
}
let intro = reduceMotion || /[?&]still\b/.test(location.search) ? 1 : 0;

function worldHalf() {
  const halfH = Math.tan(camera.fov * DEG / 2) * camera.position.z;
  return { halfH, halfW: halfH * camera.aspect };
}

const tmpPose = {};
for (const n of BONE_NAMES) tmpPose[n] = new THREE.Quaternion();
const FINGER_ORDER = { thumb: 0, index: 1, midd: 2, ring: 3, pinky: 4 };

function placeHand(hand, st, poseMap, t, kindIndex, sp, gest) {
  const { halfH, halfW } = worldHalf();
  const narrow = innerWidth < 1100;
  const sgn = kindIndex === 0 ? 1 : -1;
  const x = narrow ? lerp(0, st.xa, 0.35) : st.xa;
  hand.holder.position.set(x * halfW + pointer.x * 0.012 * halfW * sgn, st.y * halfH + sp.y * halfH - pointer.y * 0.012 * halfH * sgn, 0);
  const sc = st.size * 2 * halfH * (narrow ? 0.85 : 1) * (1 + gest * 0.05);
  hand.holder.scale.set(sc * (hand.mirror || 1), sc, sc);
  const breathe = reduceMotion ? 0 : Math.sin(t * 0.6 + kindIndex * 2.1);
  const tilt = st.tilt - gest * 14 + pointer.y * 4 * sgn + sp.r * 0.6;
  const roll = st.roll * (hand.mirror || 1) + pointer.x * 7 * sgn;
  const angle = st.angle + breathe * 1.2 + pointer.x * 1.5 + sp.r;
  hand.holder.quaternion.setFromEuler(new THREE.Euler(tilt * DEG + breathe * 0.02, roll * DEG, angle * DEG, 'ZXY'));
  hand.holder.position.y += breathe * 0.012 * halfH;
  // ngón tay: nhịp sống lệch pha từ ngón trỏ tới ngón út + gợn theo đà cuộn + cử chỉ tự phát
  const drag = Math.min(1, Math.abs(scrollVel) / 40);
  for (const n of BONE_NAMES) {
    const f = FINGER_ORDER[n.split('_')[0]] ?? 2;
    const seg = n.endsWith('dist') ? 1.2 : n.endsWith('midd') ? 1 : 0.7;
    const wave = Math.sin(t * 1.15 - f * 0.55 + kindIndex * 1.7) * 0.5 + 0.5;
    const k = reduceMotion ? 0 : (0.025 + 0.035 * wave + drag * 0.22 * seg * (0.6 + 0.4 * Math.sin(t * 7 - f)));
    tmpPose[n].copy(poseMap[n]).slerp(LIB.fist[n], k);
    if (gest > 0) tmpPose[n].slerp(LIB.open[n], gest * 0.8);
  }
  hand.applyPose(tmpPose);
}

const tipA = new THREE.Vector3(), tipB = new THREE.Vector3(), mid = new THREE.Vector3(), dir = new THREE.Vector3();
function alignTips(meet, mx, my, gap) {
  const { halfH, halfW } = worldHalf();
  visHand.holder.updateMatrixWorld(true);
  invHand.holder.updateMatrixWorld(true);
  visHand.tipWorld('index_dist', tipA);
  invHand.tipWorld('index_dist', tipB);
  // hướng khớp đi từ cổ tay trái sang cổ tay phải → hai đầu ngón không bao giờ bắt chéo
  visHand.boneWorld('radius_ulna', tmpV); invHand.boneWorld('radius_ulna', tmpV2);
  dir.copy(tmpV2).sub(tmpV); dir.z = 0;
  if (dir.lengthSq() < 1e-6) dir.set(1, 0, 0); else dir.normalize();
  mid.set(mx * halfW, my * halfH, 0);
  const g = gap * halfH * 0.5;
  const dA = mid.clone().addScaledVector(dir, -g).sub(tipA); dA.z = 0;
  const dB = mid.clone().addScaledVector(dir, g).sub(tipB); dB.z = 0;
  visHand.holder.position.addScaledVector(dA, meet);
  invHand.holder.position.addScaledVector(dB, meet);
  return mid;
}

function supportTip(w) {
  const { halfH } = worldHalf();
  visHand.holder.updateMatrixWorld(true);
  invHand.holder.updateMatrixWorld(true);
  visHand.tipWorld('index_dist', tipA);
  invHand.tipWorld('index_dist', tipB);
  visHand.holder.position.x += (tipB.x - tipA.x) * w;
  visHand.holder.position.y += (tipB.y - 0.07 * halfH - tipA.y) * w;
}

function update() {
  const rawDt = clock.getDelta();
  const dt = Math.min(rawDt, 0.1);
  const t = clock.elapsedTime;
  trackPerf(rawDt, t);
  readCssColors();
  scene.background.copy(cssColor.bg);
  invUniforms.uColor.value.copy(cssColor.inv);
  invUniforms.uColor2.value.copy(cssColor.danger);
  visUniforms.uEdge.value.copy(cssColor.vis);
  visUniforms.uBg.value.copy(cssColor.bg);
  invUniforms.uTime.value = t;

  pointer.x += (pointer.tx - pointer.x) * (1 - Math.exp(-dt * 3));
  pointer.y += (pointer.ty - pointer.y) * (1 - Math.exp(-dt * 3));
  if (intro < 1) intro = Math.min(1, intro + dt / 2.2);
  const introE = intro * intro * (3 - 2 * intro);

  // đà cuộn
  const sy = window.scrollY;
  const lenisVel = window.__cqLenis ? window.__cqLenis.velocity : (sy - lastScrollY) / Math.max(dt, 0.001) / 60;
  lastScrollY = sy;
  scrollVel = lerp(scrollVel, lenisVel || 0, 1 - Math.exp(-dt * 8));
  stillTime = Math.abs(scrollVel) < 0.5 ? stillTime + dt : 0;

  const { A, raw } = sampleKeys(sy);

  // câu chuyện ba hồi: Hồi 2 nhiễu loạn, Hồi 3 bàn tay hữu hình vươn lên đỡ lấy phiên chợ
  const inStory = A.id === 'story';
  if (inStory && overlay.act === 3) {
    Object.assign(target.vis, { show: 1, xa: stageL + 0.3 * (1 - stageL), y: -1.2, size: 0.58, angle: -6, tilt: 16, roll: 140, dim: 0.5, fade: 0.6 });
    target.inv.y += 0.3;  // phiên chợ được nâng lên, chừa chỗ cho bàn tay hữu hình đỡ bên dưới
  }
  const supportT = inStory && overlay.act === 3 ? 1 : 0;
  const actScatter = inStory && overlay.act === 2 ? 1 : 0;
  const squeezeT = A.id === 'price' ? overlay.squeezeT : 0;

  // làm mượt: bám theo cuộn nhưng có quán tính
  const k = reduceMotion || !view.init ? 1 : 1 - Math.exp(-dt * 6);
  const kp = reduceMotion || !view.init ? 1 : 1 - Math.exp(-dt * 4);
  for (const side of ['inv', 'vis']) {
    const v = view[side], tg = target[side];
    for (const key2 of HAND_KEYS) v[key2] = lerp(v[key2], tg[key2], k);
    v.xa = lerp(v.xa, tg.xa, k);
    if (!v.poseQ) { v.poseQ = {}; for (const n of BONE_NAMES) v.poseQ[n] = targetPose[side][n].clone(); }
    for (const n of BONE_NAMES) v.poseQ[n].slerp(targetPose[side][n], kp);
  }
  for (const key2 of G_KEYS) view.g[key2] = lerp(view.g[key2], target.g[key2], key2 === 'ghost' ? 1 - Math.exp(-dt * 8) : k);
  view.init = true;
  view.reading = lerp(view.reading, overlay.reading, 1 - Math.exp(-dt * 3));
  view.scatter = lerp(view.scatter, actScatter, 1 - Math.exp(-dt * 2.5));
  view.squeeze = lerp(view.squeeze, squeezeT, 1 - Math.exp(-dt * 5));
  view.support = lerp(view.support, supportT, 1 - Math.exp(-dt * 4));

  // lò xo theo đà cuộn
  for (const side of ['inv', 'vis']) {
    const sp = spring[side];
    const pull = reduceMotion ? 0 : Math.max(-60, Math.min(60, scrollVel)) * 0.0022 * (side === 'inv' ? 1 : 1.25);
    const ay = -38 * (sp.y - pull) - 7 * sp.v;
    sp.v += ay * dt; sp.y += sp.v * dt;
    const pr = reduceMotion ? 0 : Math.max(-60, Math.min(60, scrollVel)) * 0.09 * (side === 'inv' ? -1 : 1);
    const ar = -30 * (sp.r - pr) - 6 * sp.rv;
    sp.rv += ar * dt; sp.r += sp.rv * dt;
  }

  // cử chỉ tự phát khi trang đứng yên
  if (!reduceMotion && visHand) {
    if (gesture.who) {
      gesture.t += dt;
      if (gesture.t > 2.6 || Math.abs(scrollVel) > 2) { gesture.who = null; gesture.next = 7 + Math.random() * 6; }
    } else if (stillTime > 2.5) {
      gesture.next -= dt;
      if (gesture.next <= 0) {
        const cands = ['inv', 'vis'].filter(s => view[s].show > 0.9 && view.g.meet < 0.5);
        if (cands.length) { gesture.who = cands[Math.floor(Math.random() * cands.length)]; gesture.t = 0; }
        else gesture.next = 3;
      }
    }
  }
  const gestAmt = s => (gesture.who === s ? Math.sin(Math.min(1, gesture.t / 2.6) * Math.PI) ** 2 : 0);

  // ánh sáng theo chủ đề
  const theme = rootEl.dataset.theme || 'night';
  const L = LIGHTING[theme] || LIGHTING.night;
  const kl = 1 - Math.exp(-dt * 2.2);
  for (const key2 in light) light[key2] = lerp(light[key2], L[key2], kl);
  hemi.intensity = light.hemi; key.intensity = light.key; rim.intensity = light.rim;
  bloom.strength = light.bloom; renderer.toneMappingExposure = light.exposure;

  if (visHand && invHand) {
    const sInv = { ...view.inv }, sVis = { ...view.vis };
    sVis.show *= smoothstep(0.25, 1, introE);
    sInv.show *= smoothstep(0, 0.7, introE);

    const visPose = {};
    for (const n of BONE_NAMES) visPose[n] = view.vis.poseQ[n].clone().slerp(LIB.grip[n], view.squeeze * 0.9);
    placeHand(visHand, sVis, visPose, t, 0, spring.vis, gestAmt('vis'));
    placeHand(invHand, sInv, view.inv.poseQ, t, 1, spring.inv, gestAmt('inv'));

    // tự khớp hai đầu ngón trỏ ("Sáng tạo Adam")
    const g = view.g;
    if (g.meet > 0.001) {
      const breatheGap = reduceMotion ? 0 : Math.sin(t * 1.3) * 0.006;
      const m = alignTips(g.meet, g.mx, g.my, Math.max(0, g.gap + breatheGap));
      const { halfH } = worldHalf();
      spark.position.copy(m); sparkHalo.position.copy(m);
      const pulse = 0.85 + 0.15 * Math.sin(t * 5.2);
      const sOn = g.spark * g.meet * Math.min(sVis.show, sInv.show);
      spark.scale.setScalar(halfH * (0.05 + 0.07 * sOn) * pulse);
      sparkHalo.scale.setScalar(halfH * (0.25 + 0.55 * sOn));
      sparkMat.opacity = sOn;
      sparkHalo.material.opacity = sOn * 0.35;
      sparkHalo.material.color.copy(cssColor.inv).lerp(cssColor.vis, 0.5);
    } else {
      sparkMat.opacity = 0; sparkHalo.material.opacity = 0;
    }
    // Hồi 3: ngón trỏ bàn tay hữu hình vươn lên đỡ ngay dưới đầu ngón bàn tay vô hình, không chạm vào lòng bàn tay
    if (view.support > 0.001) supportTip(view.support);

    // hiện/ẩn và chế độ đọc
    const onPaper = theme === 'paper';
    const r = view.reading;
    visUniforms.uDissolve.value = Math.max(1 - sVis.show, view.g.ghost * 0.98);
    visHand.holder.visible = visUniforms.uDissolve.value < 0.985;
    visUniforms.uDim.value = onPaper ? 0 : Math.min(1, sVis.dim + r * 0.6);
    visUniforms.uWash.value = onPaper ? r * 0.55 : 0;
    const vf = sVis.fade;
    visUniforms.uFadeA.value = lerp(-0.12, 0.0, vf);
    visUniforms.uFadeB.value = lerp(-0.06, 0.52, vf);
    visGhostUniforms.uOpacity.value = view.g.ghost * 0.9;
    const invShow = sInv.show * (onPaper ? 0 : 1) * (1 - r * 0.5) * (1 - sInv.dim * 0.5);
    invUniforms.uOpacity.value = invShow;
    invGhostUniforms.uOpacity.value = invShow * (1 - 0.5 * view.scatter) * (1 - 0.2 * Math.max(view.g.f0, view.g.f1, view.g.f2));
    invHand.holder.visible = invShow > 0.01;
    const inf = sInv.fade;
    invUniforms.uFadeA.value = lerp(-0.1, 0.0, inf);
    invUniforms.uFadeB.value = lerp(0.04, 0.5, inf);
    invGhostUniforms.uFadeA.value = lerp(0.0, 0.08, inf);
    invGhostUniforms.uFadeB.value = lerp(0.08, 0.6, inf);
    invUniforms.uScatter.value = view.scatter;
    invUniforms.uWarm.value = view.scatter;
    invUniforms.uSize.value = 2.1 * (0.75 + 0.45 * sInv.size);
    const fx = view.g;
    invUniforms.uFocus.value.set(fx.f0, fx.f1, fx.f2);
    invUniforms.uFocusOn.value = Math.max(fx.f0, fx.f1, fx.f2);
    if (invHand.holder.visible) {
      invHand.model.updateMatrixWorld(true);
      invParticles.update();
    }
    updateLabels(A, raw);
  }

  document.body.dataset.cue = String(KEYS.indexOf(A));
  composer.render();
}

/* --------------------------------------------------------------------------
   13. Nhãn
   -------------------------------------------------------------------------- */
const projV = new THREE.Vector3(), centerV = new THREE.Vector3();
function toScreen(v) {
  projV.copy(v).project(camera);
  return { x: (projV.x * 0.5 + 0.5) * innerWidth, y: (-projV.y * 0.5 + 0.5) * innerHeight };
}
let colRight = 0, colKey = null;
function updateLabels(A, raw) {
  const labels = A.labels || [];
  const on = innerWidth >= 1100 && raw < Math.max(0.5, A.hold + 0.1) && view.reading < 0.2 && raw >= 0;
  if (A !== colKey) {
    colKey = A;
    const el = document.querySelector(A.at);
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
    if (who === 'group') {
      const m = invHand.meshes[0];
      p = invParticles.centers[ref].clone().applyMatrix4(m.matrixWorld);
    } else {
      p = hand.tipWorld(ref, new THREE.Vector3());
    }
    const tip = toScreen(p);
    hand.boneWorld('midd_meta', centerV);
    const c = toScreen(centerV);
    let dx = tip.x - c.x, dy = tip.y - c.y;
    const len = Math.hypot(dx, dy) || 1; dx /= len; dy /= len;
    if (L.text !== text) { L.el.textContent = text; L.text = text; L.w = 0; }
    if (!L.w) L.w = L.el.offsetWidth || 120;
    const reach = 64;
    const ax = tip.x + dx * reach;
    let ay = tip.y + dy * reach;
    const leftSide = dx < -0.2;
    let lx = leftSide ? ax - L.w : ax;
    lx = Math.max(colRight + 20, Math.min(innerWidth - 70 - L.w, lx));
    ay = Math.max(76, Math.min(innerHeight - 40, ay));
    const endX = leftSide ? lx + L.w : lx;
    const color = who === 'vis' ? 'var(--vis)' : 'var(--inv)';
    L.el.style.setProperty('--accent', color);
    L.el.style.transform = `translate(${lx.toFixed(1)}px, ${(ay - 14).toFixed(1)}px)`;
    L.line.setAttribute('x1', tip.x.toFixed(1)); L.line.setAttribute('y1', tip.y.toFixed(1));
    L.line.setAttribute('x2', endX.toFixed(1)); L.line.setAttribute('y2', ay.toFixed(1));
    L.dot.setAttribute('cx', tip.x.toFixed(1)); L.dot.setAttribute('cy', tip.y.toFixed(1));
    L.dot.style.fill = color;
    L.el.classList.add('is-on'); L.line.classList.add('is-on'); L.dot.classList.add('is-on');
  }
}

let running = false;
function loop() {
  requestAnimationFrame(loop);
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
   14. Sự kiện từ trang
   -------------------------------------------------------------------------- */
window.addEventListener('hands:reading', e => { overlay.reading = e.detail.on ? 1 : 0; });
window.addEventListener('hands:act', e => { overlay.act = e.detail.act; });
window.addEventListener('hands:price', e => { overlay.squeezeT = Math.max(0, Math.min(1, e.detail.gap * 1.6)); });
function onResize() {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  applyQuality();
  measureKeys();
}
window.addEventListener('resize', onResize, { passive: true });
window.addEventListener('load', measureKeys);
document.fonts?.ready.then(measureKeys);
if ('ResizeObserver' in window) new ResizeObserver(() => measureKeys()).observe(document.body);

// để kiểm thử và tinh chỉnh từ console
window.__hands = {
  KEYS, view, overlay, LIB, perf, measureKeys, visUniforms, invUniforms,
  get visHand() { return visHand; }, get invHand() { return invHand; },
  tip(who, bone) { const h = who === 'vis' ? visHand : invHand; return h ? toScreen(h.tipWorld(bone, new THREE.Vector3())) : null; },
  wrist(who) { const h = who === 'vis' ? visHand : invHand; return h ? toScreen(h.boneWorld('radius_ulna', new THREE.Vector3())) : null; }
};
