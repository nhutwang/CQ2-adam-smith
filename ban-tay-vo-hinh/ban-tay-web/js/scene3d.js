import * as THREE from 'https://esm.sh/three@0.160.0';
import { GLTFLoader } from 'https://esm.sh/three@0.160.0/examples/jsm/loaders/GLTFLoader.js';
import { EffectComposer } from 'https://esm.sh/three@0.160.0/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'https://esm.sh/three@0.160.0/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'https://esm.sh/three@0.160.0/examples/jsm/postprocessing/UnrealBloomPass.js';

// ECONOMY SCROLL STAGE ENGINE
const canvas=document.createElement('canvas');
canvas.id='economy-3d-stage';
Object.assign(canvas.style,{position:'fixed',inset:'0',width:'100vw',height:'100vh',zIndex:'-1',pointerEvents:'none'});
document.body.appendChild(canvas);

const renderer=new THREE.WebGLRenderer({canvas,alpha:true,antialias:true});
renderer.setPixelRatio(Math.min(devicePixelRatio,2));
renderer.setSize(innerWidth,innerHeight);
const scene=new THREE.Scene();
scene.fog=new THREE.FogExp2(0x060a12,.035);
const camera=new THREE.PerspectiveCamera(45,innerWidth/innerHeight,.1,100);
camera.position.z=9;

const root=new THREE.Group(); scene.add(root);
scene.add(new THREE.AmbientLight(0xffffff,.7));
const key=new THREE.PointLight(0xd7a84c,8,30); key.position.set(5,4,4); scene.add(key);
const steel=new THREE.PointLight(0x5f90b8,8,30); steel.position.set(-5,2,4); scene.add(steel);

// Screen 1: global economy model
const globe=new THREE.Mesh(new THREE.SphereGeometry(1.5,64,64),new THREE.MeshStandardMaterial({color:0x1b3653,wireframe:true,emissive:0x12304a,emissiveIntensity:1}));
root.add(globe);
const city=new THREE.Group();
for(let i=0;i<35;i++){
 const h=.1+Math.random()*.7;
 const b=new THREE.Mesh(new THREE.BoxGeometry(.12,.12,h),new THREE.MeshStandardMaterial({color:0xd7a84c,emissive:0x6b4010}));
 b.position.set((Math.random()-.5)*3,(Math.random()-.5)*3,h/2-1.3); city.add(b);
}
root.add(city);

// market particles
const count=1400, geo=new THREE.BufferGeometry(), pos=new Float32Array(count*3);
for(let i=0;i<count;i++){pos[i*3]=(Math.random()-.5)*8;pos[i*3+1]=(Math.random()-.5)*6;pos[i*3+2]=(Math.random()-.5)*5;}
geo.setAttribute('position',new THREE.BufferAttribute(pos,3));
const market=new THREE.Points(geo,new THREE.PointsMaterial({color:0xebcf92,size:.035,transparent:true,opacity:.8}));
root.add(market);

let invisibleHand, metalHand;
function makeHand(material){
 const loader=new GLTFLoader();
 loader.load('models/hand_model.glb',g=>{
  const h=g.scene; h.scale.set(1.8,1.8,1.8); h.rotation.x=-1.2;
  h.traverse(o=>{if(o.isMesh)o.material=material;});
  root.add(h); return h;
 });
}
const meshMaterial=new THREE.MeshStandardMaterial({color:0xcfe7ff,transparent:true,opacity:.18,wireframe:true,metalness:0,roughness:1});
const metalMaterial=new THREE.MeshStandardMaterial({color:0x9ca9b8,metalness:1,roughness:.25,transparent:true,opacity:0});
// load two instances (clone via separate loader calls)
new GLTFLoader().load('models/hand_model.glb',g=>{invisibleHand=g.scene; setupHand(invisibleHand,meshMaterial,-1.5);});
new GLTFLoader().load('models/hand_model.glb',g=>{metalHand=g.scene; setupHand(metalHand,metalMaterial,1.5);});
function setupHand(h,mat,x){h.scale.set(2,2,2);h.rotation.x=-1.4;h.position.x=x;h.traverse(o=>{if(o.isMesh)o.material=mat;});root.add(h);}

// balance scale ending
const balance=new THREE.Group();
const beam=new THREE.Mesh(new THREE.BoxGeometry(3,.05,.08),new THREE.MeshStandardMaterial({color:0xd7a84c,metalness:.8}));
const stand=new THREE.Mesh(new THREE.CylinderGeometry(.12,.2,.8),new THREE.MeshStandardMaterial({color:0x8c98a8,metalness:1}));
beam.position.y=.4; balance.add(beam); balance.add(stand); balance.position.y=-1.8; root.add(balance);

const composer=new EffectComposer(renderer);composer.addPass(new RenderPass(scene,camera));
composer.addPass(new UnrealBloomPass(new THREE.Vector2(innerWidth,innerHeight),1.2,.5,.8));

let scroll=0;
addEventListener('scroll',()=>scroll=scrollY/Math.max(1,document.body.scrollHeight-innerHeight));
addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);composer.setSize(innerWidth,innerHeight);});
const clock=new THREE.Clock();
function animate(){requestAnimationFrame(animate);const t=clock.getElapsedTime();
 const s=scroll;
 globe.rotation.y=t*.2; city.rotation.y=-t*.1;
 market.rotation.y=t*.05; market.position.y=Math.sin(t)*.2;
 // four cinematic chapters
 const m1=Math.max(0,1-s*5); const m2=Math.min(1,Math.max(0,(s-.15)*5)); const m3=Math.min(1,Math.max(0,(s-.45)*5)); const m4=Math.min(1,Math.max(0,(s-.75)*5));
 globe.scale.setScalar(1+m2*.25); globe.material.opacity=.35+m1*.65;
 if(invisibleHand){invisibleHand.visible=m2>.05; invisibleHand.position.y=-1+m2*.8; invisibleHand.rotation.z=Math.sin(t)*.05; invisibleHand.traverse(o=>{if(o.material)o.material.opacity=.18*m2;});}
 if(metalHand){metalHand.visible=m3>.05; metalHand.position.y=3-m3*4; metalHand.rotation.z=m3*.08; metalMaterial.opacity=m3;}
 if(m3>.1){root.rotation.z=Math.sin(t*8)*.02*m3;}
 balance.visible=m4>.1; balance.rotation.z=Math.sin(t)*.02;
 camera.position.y=Math.sin(s*Math.PI)*.4;
 composer.render();
}
animate();
