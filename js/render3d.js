'use strict';
/*
 * render3d.js — draws the terrarium in 3D with three.js.
 * The simulation stays on a flat 960×600 floor (x, y); here sim y becomes 3D z.
 */

const toV = (x, y, h = 0) => new THREE.Vector3(x - WORLD_W / 2, h, y - WORLD_H / 2);

// ---------- small mesh helpers ----------
const MATS = {};
function mat(color, opts = {}) {
  const key = color + JSON.stringify(opts);
  return MATS[key] || (MATS[key] = new THREE.MeshStandardMaterial(Object.assign({ color, roughness: 0.7, metalness: 0 }, opts)));
}
function mesh(geo, m, x = 0, y = 0, z = 0) {
  const o = new THREE.Mesh(geo, m);
  o.position.set(x, y, z);
  o.castShadow = true; o.receiveShadow = true;
  return o;
}
const sphere = (r, seg = 16) => new THREE.SphereGeometry(r, seg, Math.max(8, seg * 0.75 | 0));
const cyl = (rt, rb, h, seg = 14) => new THREE.CylinderGeometry(rt, rb, h, seg);
const UP = new THREE.Vector3(0, 1, 0);
function placeBetween(o, a, b) {
  const d = new THREE.Vector3().subVectors(b, a);
  o.position.copy(a).addScaledVector(d, 0.5);
  o.scale.set(1, Math.max(0.01, d.length()), 1);
  o.quaternion.setFromUnitVectors(UP, d.normalize());
}
function jitterGeo(geo, amt, seed = 1) {
  const p = geo.attributes.position;
  let s = seed;
  const r = () => ((s = (s * 16807) % 2147483647) / 2147483647) - 0.5;
  const map = new Map();
  for (let i = 0; i < p.count; i++) {
    const k = `${p.getX(i).toFixed(2)},${p.getY(i).toFixed(2)},${p.getZ(i).toFixed(2)}`;
    if (!map.has(k)) map.set(k, [r() * amt, r() * amt, r() * amt]);
    const j = map.get(k);
    p.setXYZ(i, p.getX(i) + j[0], p.getY(i) + j[1], p.getZ(i) + j[2]);
  }
  geo.computeVertexNormals();
  return geo;
}

// ---------- object models ----------
function buildModel(type, o) {
  const g = new THREE.Group();
  const add = o => (g.add(o), o);
  switch (type) {
    case 'cricket': {
      const body = add(mesh(new THREE.CapsuleGeometry(3.2, 9, 4, 10), mat('#6b4a24'), 0, 5, 0));
      body.rotation.z = Math.PI / 2;
      add(mesh(sphere(3.6), mat('#4e3418'), 7, 6, 0));
      for (const s of [-1, 1]) {
        const leg = add(mesh(cyl(0.7, 0.7, 12, 6), mat('#4e3418'), -3, 7, s * 4));
        leg.rotation.x = s * 0.5; leg.rotation.z = -0.9;
        const ant = add(mesh(cyl(0.3, 0.3, 14, 4), mat('#3a2610'), 13, 10, s * 2));
        ant.rotation.z = -1.0; ant.rotation.x = s * 0.4;
      }
      g.userData.legs = true;
      break;
    }
    case 'mealworm': {
      g.userData.segs = [];
      for (let i = 0; i < 7; i++) g.userData.segs.push(add(mesh(sphere(2.8 - Math.abs(i - 3) * 0.2, 10), mat(i % 2 ? '#d9a441' : '#c48f30'), (i - 3) * 3.6, 2.8, 0)));
      break;
    }
    case 'lettuce': {
      for (let i = 0; i < 6; i++) {
        const leaf = add(mesh(jitterGeo(sphere(9, 10), 3, i + 3), mat(i < 2 ? '#a5d65a' : '#6fb53d', { roughness: 0.6 }), 0, 6, 0));
        leaf.scale.set(1, 0.35, 0.6);
        leaf.rotation.y = i * 1.05; leaf.rotation.z = 0.4 + (i % 3) * 0.2;
        leaf.position.set(Math.cos(i) * 3, 4 + i * 0.6, Math.sin(i) * 3);
      }
      break;
    }
    case 'berry': {
      const b = add(mesh(sphere(7), mat('#d8323c', { roughness: 0.35 }), 0, 7, 0));
      b.scale.set(1, 1.15, 1);
      for (let i = 0; i < 3; i++) {
        const leaf = add(mesh(sphere(3, 6), mat('#3c8a2e'), Math.cos(i * 2.1) * 3, 14.5, Math.sin(i * 2.1) * 3));
        leaf.scale.set(1.4, 0.3, 0.6); leaf.rotation.y = -i * 2.1;
      }
      break;
    }
    case 'mushroom': {
      add(mesh(cyl(3, 4, 12), mat('#f1e6d0'), 0, 6, 0));
      const cap = add(mesh(new THREE.SphereGeometry(11, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2), mat('#c9302c', { roughness: 0.5 }), 0, 11, 0));
      cap.scale.y = 0.7;
      for (let i = 0; i < 6; i++) {
        const a = i * 1.1, r = i === 0 ? 0 : 6;
        add(mesh(sphere(1.6, 8), mat('#ffffff'), Math.cos(a) * r, 18 - (r ? 1.8 : 0), Math.sin(a) * r));
      }
      break;
    }
    case 'ladybug': {
      const shell = add(mesh(new THREE.SphereGeometry(6, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), mat('#d42a25', { roughness: 0.3 }), 0, 1, 0));
      shell.scale.set(1.1, 0.8, 1);
      add(mesh(sphere(3, 10), mat('#1a1a1a'), 6, 2.5, 0));
      for (const [x, z] of [[0, 2.5], [0, -2.5], [-3, 3.5], [-3, -3.5], [2.5, 0]]) add(mesh(sphere(1.2, 6), mat('#111'), x, 5.3, z));
      break;
    }
    case 'water': {
      add(mesh(cyl(26, 22, 8, 28), mat('#8f99a3', { roughness: 0.4 }), 0, 4, 0));
      const w = add(mesh(cyl(22, 22, 1, 28), mat('#3b9be0', { roughness: 0.05, metalness: 0.1, transparent: true, opacity: 0.9 }), 0, 8.4, 0));
      w.castShadow = false;
      g.userData.water = w;
      break;
    }
    case 'rock': {
      const r = add(mesh(jitterGeo(new THREE.DodecahedronGeometry(20, 1), 6, 7), mat('#8d8a84', { roughness: 0.95, flatShading: true }), 0, 9, 0));
      r.scale.set(1.25, 0.6, 1);
      break;
    }
    case 'lamp': {
      add(mesh(cyl(16, 18, 4, 20), mat('#33363b', { metalness: 0.5, roughness: 0.4 }), 0, 2, 0));
      add(mesh(cyl(2, 2, 110, 10), mat('#33363b', { metalness: 0.6, roughness: 0.3 }), 0, 57, 0));
      const shade = add(mesh(new THREE.ConeGeometry(18, 20, 20, 1, true), mat('#2b2e33', { metalness: 0.5, roughness: 0.4, side: THREE.DoubleSide }), 0, 106, 0));
      shade.castShadow = false;
      const bulb = add(mesh(sphere(8), new THREE.MeshStandardMaterial({ color: '#ffd27a', emissive: '#ffb347', emissiveIntensity: 2 }), 0, 98, 0));
      bulb.castShadow = false;
      const light = new THREE.PointLight('#ffb35c', 1.4, 360, 1.6);
      light.position.set(0, 92, 0);
      g.add(light);
      g.userData.light = light;
      break;
    }
    case 'log': {
      const l = add(mesh(cyl(13, 14, 64, 16), mat('#7a5230', { roughness: 0.9 }), 0, 13, 0));
      l.rotation.z = Math.PI / 2;
      for (const s of [-1, 1]) {
        const end = add(mesh(cyl(11.5, 11.5, 1, 16), mat('#c9a06a'), s * 32.2, 13, 0));
        end.rotation.z = Math.PI / 2;
      }
      add(mesh(cyl(3, 4, 10, 8), mat('#6b4627'), 8, 26, 4)).rotation.x = 0.3;
      break;
    }
    case 'ball': {
      const tex = ballTexture();
      const b = add(mesh(sphere(13, 24), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.5 }), 0, 13, 0));
      g.userData.ball = b;
      break;
    }
    case 'cactus': {
      const m = mat('#3f8f47', { roughness: 0.8 });
      add(mesh(cyl(14, 16, 10, 16), mat('#b5603a'), 0, 5, 0));
      add(mesh(new THREE.CapsuleGeometry(8, 34, 6, 12), m, 0, 30, 0));
      const arm1 = add(mesh(new THREE.CapsuleGeometry(4.5, 14, 4, 10), m, 11, 32, 0));
      add(mesh(new THREE.CapsuleGeometry(4.5, 8, 4, 10), m, 7, 26, 0)).rotation.z = Math.PI / 2;
      arm1.position.set(13, 34, 0);
      const arm2 = add(mesh(new THREE.CapsuleGeometry(4, 10, 4, 10), m, -12, 38, 0));
      add(mesh(new THREE.CapsuleGeometry(4, 6, 4, 10), m, -8, 33, 0)).rotation.z = Math.PI / 2;
      arm2.position.set(-12, 40, 0);
      for (let i = 0; i < 14; i++) add(mesh(cyl(0.2, 0.6, 3, 4), mat('#f4ecd0'), Math.cos(i) * 8.5, 16 + i * 2.4, Math.sin(i) * 8.5)).rotation.z = Math.cos(i) * 1.4;
      break;
    }
    case 'bookstore': {
      // a little shop: door faces the front of the tank
      add(mesh(new THREE.BoxGeometry(92, 46, 60), mat('#f1e3c4', { roughness: 0.9 }), 0, 23, 0));
      const roof = add(mesh(new THREE.ConeGeometry(74, 30, 4), mat('#b5483a', { roughness: 0.8, flatShading: true }), 0, 61, 0));
      roof.rotation.y = Math.PI / 4; roof.scale.z = 0.72;
      add(mesh(new THREE.BoxGeometry(22, 32, 2), mat('#3a2a1c'), 0, 16, 30.2)).castShadow = false;       // open doorway
      add(mesh(new THREE.BoxGeometry(3, 32, 3), mat('#7a5230'), -12, 16, 30.6));
      add(mesh(new THREE.BoxGeometry(3, 32, 3), mat('#7a5230'), 12, 16, 30.6));
      add(mesh(new THREE.BoxGeometry(27, 3, 3), mat('#7a5230'), 0, 33, 30.6));
      const winMat = new THREE.MeshStandardMaterial({ color: '#ffe9a8', emissive: '#ffc95c', emissiveIntensity: 0.3, roughness: 0.3 });
      for (const sx of [-30, 30]) {
        add(mesh(new THREE.BoxGeometry(18, 16, 1.5), winMat, sx, 24, 30.3)).castShadow = false;
        add(mesh(new THREE.BoxGeometry(20, 2, 3), mat('#7a5230'), sx, 15, 30.8));
        // books on the windowsill
        ['#c0392b', '#2e86c1', '#27ae60', '#f39c12'].forEach((c, i) => add(mesh(new THREE.BoxGeometry(2.4, 7 + (i % 2) * 2, 4), mat(c), sx - 5 + i * 3.2, 20 + (i % 2), 31.4)));
      }
      const sc = document.createElement('canvas'); sc.width = 256; sc.height = 64;
      const sx2 = sc.getContext('2d');
      sx2.fillStyle = '#2f6b3a'; sx2.fillRect(0, 0, 256, 64);
      sx2.fillStyle = '#fff6dc'; sx2.font = 'bold 44px Georgia, serif'; sx2.textAlign = 'center'; sx2.textBaseline = 'middle';
      sx2.fillText('BOOKS', 128, 34);
      const sign = add(new THREE.Mesh(new THREE.PlaneGeometry(44, 11), new THREE.MeshStandardMaterial({ map: new THREE.CanvasTexture(sc), roughness: 0.7 })));
      sign.position.set(0, 41, 30.4);
      add(mesh(new THREE.BoxGeometry(26, 0.8, 14), mat('#8a3b2e'), 0, 0.4, 39)).castShadow = false; // doormat
      // a stack of books outside
      ['#2e86c1', '#f39c12', '#8e44ad'].forEach((c, i) => { const b = add(mesh(new THREE.BoxGeometry(11, 3, 8), mat(c), 22, 1.5 + i * 3, 40)); b.rotation.y = i * 0.35; });
      g.userData.winMat = winMat;
      break;
    }
    case 'salad': {
      add(mesh(new THREE.SphereGeometry(13, 18, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), mat('#e9e2d0', { side: THREE.DoubleSide }), 0, 12, 0));
      for (let i = 0; i < 7; i++) { const l = add(mesh(jitterGeo(sphere(5, 8), 1.5, i + 1), mat(i % 3 ? '#6fb53d' : '#a5d65a'), Math.cos(i) * 5, 12 + (i % 2) * 2, Math.sin(i) * 5)); l.scale.y = 0.5; }
      for (let i = 0; i < 3; i++) add(mesh(sphere(2.6, 8), mat('#d8323c'), Math.cos(i * 2) * 4, 15, Math.sin(i * 2) * 4));
      break;
    }
    case 'wrap': {
      const w = add(mesh(cyl(6, 6, 22, 14), mat('#7fbf45', { roughness: 0.6 }), 0, 6, 0));
      w.rotation.z = Math.PI / 2;
      for (const s of [-1, 1]) { const e = add(mesh(cyl(5, 5, 1, 12), mat('#6b4a24'), s * 11.2, 6, 0)); e.rotation.z = Math.PI / 2; }
      break;
    }
    case 'skewer': {
      const st = add(mesh(cyl(0.9, 0.9, 30, 6), mat('#8a5a2b'), 0, 4, 0)); st.rotation.z = Math.PI / 2;
      for (let i = 0; i < 3; i++) { const b = add(mesh(new THREE.CapsuleGeometry(2.6, 5, 4, 8), mat(i === 1 ? '#6b4a24' : '#8c6a3a'), -7 + i * 7, 4, 0)); b.rotation.z = Math.PI / 2; }
      break;
    }
    case 'seedling': {
      add(mesh(cyl(9, 10, 2, 14), mat('#7a5a3a', { roughness: 1 }), 0, 1, 0));
      const sprout = new THREE.Group();
      sprout.add(mesh(cyl(0.7, 0.9, 10, 6), mat('#4b9a3c'), 0, 5, 0));
      for (const s of [-1, 1]) { const l = mesh(sphere(3, 8), mat('#6fbf45'), s * 3, 10, 0); l.scale.set(1.3, 0.35, 0.8); l.rotation.z = s * 0.4; sprout.add(l); }
      g.add(sprout); g.userData.sprout = sprout;
      break;
    }
    case 'plant': {
      const prod = TYPES[o && o.produce] || TYPES.berry;
      const leaf = { lettuce: '#6fb53d', berry: '#3c8a2e', flower: '#4b9a3c' }[o && o.produce] || '#4f9a3f';
      add(mesh(cyl(12, 13, 3, 14), mat('#7a5a3a', { roughness: 1 }), 0, 1.5, 0));
      const bush = add(mesh(jitterGeo(sphere(15, 12), 4, 9), mat(leaf, { roughness: 0.8, flatShading: true }), 0, 16, 0));
      bush.scale.y = 0.85;
      const fruit = prod.custom ? prod.color : ({ berry: '#d8323c', lettuce: '#a5d65a', flower: '#ffd23f' }[o && o.produce] || '#e85a38');
      for (let i = 0; i < 6; i++) add(mesh(sphere(2.6, 8), mat(fruit, { roughness: 0.4 }), Math.cos(i * 1.1) * 12, 13 + (i % 3) * 5, Math.sin(i * 1.1) * 12));
      g.userData.labelEmoji = prod.emoji;
      break;
    }
    case 'cricketbox': {
      add(mesh(new THREE.BoxGeometry(34, 16, 24), mat('#9c6b35', { roughness: 0.9 }), 0, 8, 0));
      add(mesh(new THREE.BoxGeometry(30, 1, 20), mat('#6fb53d'), 0, 16.3, 0));
      for (let i = 0; i < 4; i++) add(mesh(cyl(1, 1, 36, 6), mat('#7a4f25'), 0, 17.5, -9 + i * 6)).rotation.z = Math.PI / 2;
      g.userData.labelEmoji = '🦗';
      break;
    }
    case 'stick': {
      const st = add(mesh(cyl(1.6, 1.3, 26, 7), mat('#8a5a2b', { roughness: 0.9 }), 0, 1.8, 0));
      st.rotation.z = Math.PI / 2; st.rotation.y = 0.2;
      add(mesh(cyl(0.9, 0.7, 8, 5), mat('#8a5a2b'), 5, 3, 3)).rotation.set(1.1, 0, 0.6);
      break;
    }
    case 'crab': {
      const sh = add(mesh(sphere(8, 14), mat('#d9482b', { roughness: 0.45 }), 0, 6, 0));
      sh.scale.set(1.25, 0.6, 1);
      for (const s of [-1, 1]) {
        add(mesh(sphere(3.4, 10), mat('#e85a38'), 8, 6, s * 8));
        add(mesh(cyl(1, 1, 7, 6), mat('#d9482b'), 4, 5, s * 7)).rotation.x = s * 1.1;
        add(mesh(sphere(1.2, 8), mat('#111'), 6, 10.5, s * 2.5));
        add(mesh(cyl(0.4, 0.4, 3, 5), mat('#d9482b'), 6, 9, s * 2.5));
        for (let i = 0; i < 3; i++) add(mesh(cyl(0.8, 0.6, 9, 5), mat('#c23a20'), -4 + i * 3.5, 3.5, s * 10)).rotation.x = s * 0.9;
      }
      break;
    }
    case 'shell': {
      const c = add(mesh(new THREE.ConeGeometry(7, 14, 14), mat('#f3e3cf', { roughness: 0.35 }), 0, 5, 0));
      c.rotation.z = Math.PI / 2.4;
      add(mesh(sphere(5.5, 12), mat('#f0cdb0', { roughness: 0.35 }), -4, 5, 0));
      for (let i = 0; i < 3; i++) add(mesh(new THREE.TorusGeometry(5.5 - i * 1.6, 0.5, 6, 14), mat('#d99b78'), -1 + i * 3.4, 5.6 + i * 1.2, 0)).rotation.set(0, Math.PI / 2, 0.25);
      break;
    }
    case 'bone': {
      const b = add(mesh(cyl(2, 2, 18, 8), mat('#f2eee2', { roughness: 0.6 }), 0, 3, 0));
      b.rotation.z = Math.PI / 2;
      for (const sx of [-9, 9]) for (const sz of [-2.2, 2.2]) add(mesh(sphere(3, 10), mat('#f2eee2'), sx, 3, sz));
      break;
    }
    case 'nest': {
      const ring = add(mesh(new THREE.TorusGeometry(19, 7, 8, 18), mat('#8a5a2b', { roughness: 1, flatShading: true }), 0, 6, 0));
      ring.rotation.x = Math.PI / 2;
      add(mesh(cyl(18, 18, 3, 18), mat('#b08a4f', { roughness: 1 }), 0, 2, 0));
      for (let i = 0; i < 12; i++) { const s = add(mesh(cyl(1.1, 0.9, 20, 5), mat(i % 2 ? '#7a4f25' : '#9c6b35'), Math.cos(i * 0.52) * 20, 9 + (i % 3), Math.sin(i * 0.52) * 20)); s.rotation.set(Math.PI / 2, 0, i * 0.52 + 0.3); }
      break;
    }
    case 'den': {
      const tent = add(mesh(new THREE.ConeGeometry(30, 38, 7, 1, true), mat('#6f9b4a', { roughness: 0.9, flatShading: true, side: THREE.DoubleSide }), 0, 19, 0));
      tent.rotation.y = 0.2;
      for (let i = 0; i < 7; i++) { const a = i * 0.898 + 0.2; const s = add(mesh(cyl(1.3, 1.3, 46, 5), mat('#8a5a2b'), Math.cos(a) * 15, 20, Math.sin(a) * 15)); s.rotation.set(Math.sin(a) * -0.66, 0, Math.cos(a) * 0.66); }
      add(mesh(new THREE.CircleGeometry(11, 14), mat('#2a2219', { side: THREE.DoubleSide }), 0, 9, 27.2)).castShadow = false;
      break;
    }
    case 'flower': {
      add(mesh(cyl(0.8, 0.8, 16, 6), mat('#4b9a3c'), 0, 8, 0));
      for (let i = 0; i < 8; i++) {
        const p = add(mesh(sphere(3.2, 8), mat('#ffd23f'), Math.cos(i * 0.785) * 4.5, 16.5, Math.sin(i * 0.785) * 4.5));
        p.scale.set(1.3, 0.35, 0.8); p.rotation.y = -i * 0.785;
      }
      add(mesh(sphere(2.6, 10), mat('#b5651d'), 0, 17.2, 0));
      break;
    }
  }
  const CT = TYPES[type];
  if (CT && CT.custom) {
    const r = CT.size, m = mat(CT.color, { roughness: 0.5 });
    if (CT.shape === 'box') add(mesh(new THREE.BoxGeometry(r * 1.6, r * 1.6, r * 1.6), m, 0, r * 0.8, 0));
    else if (CT.shape === 'cone') add(mesh(new THREE.ConeGeometry(r, r * 2.2, 18), m, 0, r * 1.1, 0));
    else if (CT.shape === 'cylinder') add(mesh(cyl(r, r, r * 1.4, 20), m, 0, r * 0.7, 0));
    else if (CT.shape === 'blob') { const b = add(mesh(jitterGeo(new THREE.DodecahedronGeometry(r, 1), r * 0.3, 5), mat(CT.color, { roughness: 0.6, flatShading: true }), 0, r * 0.7, 0)); b.scale.y = 0.8; }
    else if (CT.shape === 'star') { for (let i = 0; i < 3; i++) { const c = add(mesh(new THREE.OctahedronGeometry(r, 0), m, 0, r, 0)); c.rotation.set(i * 1.05, i * 0.7, 0); c.scale.set(1, 0.45, 0.45); } }
    else add(mesh(sphere(r, 20), m, 0, r, 0));
  }
  g.traverse(o => { if (o.isMesh) o.userData.type = type; });
  return g;
}

let _ballTex = null;
function ballTexture() {
  if (_ballTex) return _ballTex;
  const c = document.createElement('canvas'); c.width = 128; c.height = 64;
  const x = c.getContext('2d');
  x.fillStyle = '#f5f5f5'; x.fillRect(0, 0, 128, 64);
  x.fillStyle = '#1e1e1e';
  for (let i = 0; i < 8; i++) { x.beginPath(); x.arc((i * 37) % 128, 10 + (i * 23) % 44, 7, 0, 7); x.fill(); }
  _ballTex = new THREE.CanvasTexture(c);
  return _ballTex;
}

function radialTexture(inner, outer) {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const x = c.getContext('2d');
  const g = x.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, inner); g.addColorStop(1, outer);
  x.fillStyle = g; x.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(c);
}

function sandTexture() {
  const b = document.createElement('canvas');
  b.width = 1024; b.height = 640;
  const x = b.getContext('2d');
  const g = x.createLinearGradient(0, 0, 1024, 640);
  g.addColorStop(0, '#d9bb80'); g.addColorStop(1, '#c49e62');
  x.fillStyle = g; x.fillRect(0, 0, 1024, 640);
  let seed = 7;
  const r = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < 2600; i++) {
    x.fillStyle = `rgba(${120 + r() * 60},${90 + r() * 40},${50 + r() * 30},${0.1 + r() * 0.2})`;
    x.beginPath(); x.arc(r() * 1024, r() * 640, 0.6 + r() * 2.4, 0, 7); x.fill();
  }
  for (let i = 0; i < 26; i++) {
    x.fillStyle = 'rgba(110,85,50,0.14)';
    x.beginPath(); x.ellipse(r() * 1024, r() * 640, 8 + r() * 14, 5 + r() * 8, r() * 3, 0, 7); x.fill();
  }
  const t = new THREE.CanvasTexture(b);
  t.anisotropy = 4;
  return t;
}

// ---------- the renderer ----------
class Renderer3D {
  constructor(canvas, overlay) {
    this.canvas = canvas;
    this.overlay = overlay;
    this.r = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    this.r.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.r.shadowMap.enabled = true;
    this.r.shadowMap.type = THREE.PCFSoftShadowMap;
    if ('outputEncoding' in this.r) this.r.outputEncoding = THREE.sRGBEncoding;

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(40, 16 / 10, 10, 5000);
    this.view = { theta: 0.35, phi: 0.95, radius: 820, target: new THREE.Vector3(0, 0, 20), follow: false };

    this.hemi = new THREE.HemisphereLight('#fff6e6', '#8a7350', 0.75);
    this.scene.add(this.hemi);
    this.sun = new THREE.DirectionalLight('#fff3dc', 0.9);
    this.sun.position.set(-300, 700, 250);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    Object.assign(this.sun.shadow.camera, { left: -560, right: 560, top: 400, bottom: -400, near: 100, far: 1600 });
    this.sun.shadow.bias = -0.0008;
    this.scene.add(this.sun);

    this.buildTerrarium();
    this.objMeshes = new Map();
    this.buildLizard();
    this.particles = [];
    this.ripples = [];
    this.raycaster = new THREE.Raycaster();
    this.groundPlane = new THREE.Plane(UP, 0);

    // highlight ring / placement ghost
    this.ring = new THREE.Mesh(new THREE.RingGeometry(1, 1.15, 40), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.85, side: THREE.DoubleSide }));
    this.ring.rotation.x = -Math.PI / 2; this.ring.visible = false;
    this.scene.add(this.ring);
    this.ghost = null; this.ghostType = null;

    // path line to Pip's target
    const lg = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]);
    this.path = new THREE.Line(lg, new THREE.LineDashedMaterial({ color: '#2f7f3a', dashSize: 6, gapSize: 8, transparent: true, opacity: 0.6 }));
    this.scene.add(this.path);

    this.bubble = document.createElement('div'); this.bubble.className = 'bubble'; overlay.appendChild(this.bubble);
    this.status = document.createElement('div'); this.status.className = 'status-emoji'; overlay.appendChild(this.status);
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  resize() {
    const w = this.canvas.clientWidth || 960, h = this.canvas.clientHeight || 600;
    this.r.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  buildTerrarium() {
    const W = WORLD_W, H = WORLD_H;
    const sand = new THREE.Mesh(new THREE.BoxGeometry(W, 16, H), [mat('#c9a86f'), mat('#c9a86f'), new THREE.MeshStandardMaterial({ map: sandTexture(), roughness: 1 }), mat('#c9a86f'), mat('#b8975e'), mat('#b8975e')]);
    sand.position.y = -8; sand.receiveShadow = true;
    this.scene.add(sand);
    // base cabinet
    const base = mesh(new THREE.BoxGeometry(W + 40, 40, H + 40), mat('#4a3423', { roughness: 0.8 }), 0, -36, 0);
    base.castShadow = false;
    this.scene.add(base);
    // glass walls (front and right lower, so they don't block the view much)
    const glass = new THREE.MeshPhysicalMaterial({ color: '#cfe8f0', transparent: true, opacity: 0.12, roughness: 0.05, metalness: 0, side: THREE.DoubleSide, depthWrite: false });
    const wallH = 150;
    const walls = [[W, wallH, 0, -H / 2, 0], [W, wallH, 0, H / 2, 0], [H, wallH, -W / 2, 0, Math.PI / 2], [H, wallH, W / 2, 0, Math.PI / 2]];
    for (const [w, h, x, z, ry] of walls) {
      const p = new THREE.Mesh(new THREE.PlaneGeometry(w, h), glass);
      p.position.set(x, h / 2, z); p.rotation.y = ry; p.renderOrder = 2;
      this.scene.add(p);
    }
    // frame
    const fm = mat('#2c2c2c', { metalness: 0.4, roughness: 0.5 });
    for (const [x, z] of [[-W / 2, -H / 2], [W / 2, -H / 2], [-W / 2, H / 2], [W / 2, H / 2]]) this.scene.add(mesh(new THREE.BoxGeometry(6, wallH, 6), fm, x, wallH / 2, z));
    for (const [w, d, x, z] of [[W, 6, 0, -H / 2], [W, 6, 0, H / 2], [6, H, -W / 2, 0], [6, H, W / 2, 0]]) {
      this.scene.add(mesh(new THREE.BoxGeometry(w, 6, d), fm, x, wallH, z));
      this.scene.add(mesh(new THREE.BoxGeometry(w, 4, d), fm, x, 2, z));
    }
    // a few pebbles and grass tufts for life
    let s = 11; const r = () => (s = (s * 16807) % 2147483647) / 2147483647;
    for (let i = 0; i < 40; i++) {
      const p = mesh(jitterGeo(new THREE.DodecahedronGeometry(2 + r() * 4, 0), 1, i + 2), mat(['#9c958a', '#b3a998', '#7e776e'][i % 3], { flatShading: true }), (r() - 0.5) * (W - 40), 1.5, (r() - 0.5) * (H - 40));
      p.scale.y = 0.6; p.castShadow = false;
      this.scene.add(p);
    }
    for (let i = 0; i < 14; i++) {
      const tuft = new THREE.Group();
      const x = (r() - 0.5) * (W - 60), z = (r() - 0.5) * (H - 60);
      for (let j = 0; j < 7; j++) {
        const blade = mesh(new THREE.ConeGeometry(1.2, 10 + r() * 8, 4), mat('#7e9b46'), (r() - 0.5) * 8, 6, (r() - 0.5) * 8);
        blade.rotation.set((r() - 0.5) * 0.7, 0, (r() - 0.5) * 0.7); blade.castShadow = false;
        tuft.add(blade);
      }
      tuft.position.set(x, 0, z);
      this.scene.add(tuft);
    }
    // heat glow decal texture
    this.glowTex = radialTexture('rgba(255,170,60,0.55)', 'rgba(255,170,60,0)');
  }

  buildLizard() {
    const L = new THREE.Group();
    this.skin = new THREE.MeshStandardMaterial({ color: '#4fae58', roughness: 0.55 });
    this.skinDark = new THREE.MeshStandardMaterial({ color: '#2f7f3a', roughness: 0.6 });
    this.belly = new THREE.MeshStandardMaterial({ color: '#c9e39a', roughness: 0.6 });
    this.segMeshes = [];
    for (let i = 0; i < SEGMENTS; i++) {
      const m = mesh(sphere(1, 14), this.skin);
      this.segMeshes.push(m); L.add(m);
      if (i >= 2 && i <= 11 && i % 2 === 0) {
        for (const s of [-1, 1]) { const spot = mesh(sphere(1, 8), this.skinDark); spot.userData.spot = { i, s }; L.add(spot); this.segMeshes.push(spot); }
      }
    }
    // head
    const head = new THREE.Group();
    const skull = mesh(sphere(1, 18), this.skin); skull.scale.set(15, 8, 10.5); skull.position.set(4, 0, 0); head.add(skull);
    const jaw = mesh(sphere(1, 14), this.belly); jaw.scale.set(12, 4, 8.5); jaw.position.set(5, -3.5, 0); head.add(jaw);
    this.eyes = [];
    for (const s of [-1, 1]) {
      const eye = new THREE.Group();
      const white = mesh(sphere(4.2, 14), new THREE.MeshStandardMaterial({ color: '#e9f5c9', roughness: 0.3 }));
      const pupil = mesh(sphere(1, 10), new THREE.MeshStandardMaterial({ color: '#111', roughness: 0.2 }));
      pupil.scale.set(1.6, 3, 1.4); pupil.position.set(1.6, 0.5, s * 3.2);
      const lid = mesh(sphere(4.5, 14), this.skin); lid.scale.y = 0.15; lid.visible = false;
      eye.add(white, pupil, lid);
      eye.position.set(6, 4.5, s * 7);
      head.add(eye);
      this.eyes.push({ white, pupil, lid });
    }
    const tongue = new THREE.Group();
    const tm = new THREE.MeshStandardMaterial({ color: '#e0446a', roughness: 0.4 });
    const t1 = mesh(cyl(0.9, 0.9, 1, 6), tm); t1.rotation.z = Math.PI / 2; t1.position.x = 0.5; t1.scale.y = 1;
    tongue.add(t1);
    for (const s of [-1, 1]) { const f = mesh(cyl(0.6, 0.6, 4, 5), tm); f.rotation.z = Math.PI / 2; f.rotation.y = s * 0.6; f.position.set(1.4, 0, s * 1.1); tongue.add(f); }
    tongue.position.set(17, -2, 0);
    tongue.visible = false;
    head.add(tongue);
    this.tongue = tongue; this.tongueStem = t1;
    L.add(head);
    this.head = head;
    // legs: upper + lower + foot
    this.legs = [];
    for (let k = 0; k < 4; k++) {
      const upper = mesh(cyl(2.6, 2.2, 1, 8), this.skinDark), lower = mesh(cyl(2.2, 1.6, 1, 8), this.skinDark);
      const foot = mesh(sphere(3, 8), this.skinDark); foot.scale.set(1.3, 0.4, 1.3);
      L.add(upper, lower, foot);
      this.legs.push({ upper, lower, foot });
    }
    this.scene.add(L);
    this.lizardGroup = L;
  }

  syncObjects(world) {
    const alive = new Set();
    for (const o of world.objects) {
      alive.add(o.id);
      let m = this.objMeshes.get(o.id);
      // a seedling that grew up: rebuild its model
      if (m && m.userData.type !== o.type) { this.scene.remove(m); this.objMeshes.delete(o.id); m = null; }
      if (!m) {
        m = buildModel(o.type, o);
        m.userData.id = o.id;
        m.userData.type = o.type;
        if (!TYPES[o.type].building) m.rotation.y = (o.id * 2.39) % (Math.PI * 2);
        if (TYPES[o.type].heat) {
          const glow = new THREE.Mesh(new THREE.PlaneGeometry(TYPES[o.type].heat * 2, TYPES[o.type].heat * 2), new THREE.MeshBasicMaterial({ map: this.glowTex, transparent: true, depthWrite: false }));
          glow.rotation.x = -Math.PI / 2; glow.position.y = 0.6;
          m.userData.glow = glow; m.add(glow);
        }
        m.scale.setScalar(0.01); m.userData.grow = 0;
        this.scene.add(m);
        this.objMeshes.set(o.id, m);
      }
      const T = TYPES[o.type];
      m.position.copy(toV(o.x, o.y));
      if (o.carried) {
        m.position.y += o.lift || 0;
        m.scale.setScalar(Math.min(1, 15 / T.size));
        m.rotation.z = o.swing || 0;
        m.userData.grow = 1;
      } else if (m.userData.wasCarried) { m.scale.setScalar(1); m.rotation.z = 0; }
      m.userData.wasCarried = !!o.carried;
      if ((T.custom || m.userData.labelEmoji) && !m.userData.label) {
        // a floating icon, so you can tell what an invented thing is
        const c = document.createElement('canvas'); c.width = c.height = 64;
        const x = c.getContext('2d'); x.font = '48px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif';
        x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(m.userData.labelEmoji || T.emoji, 32, 36);
        const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false }));
        sp.scale.set(20, 20, 1); sp.position.y = T.size * 2 + 14;
        m.add(sp); m.userData.label = sp;
      }
      if (m.userData.label) m.userData.label.position.y = T.size * 2 + 14 + Math.sin(o.t * 2) * 2;
      if (m.userData.grow < 1) { m.userData.grow = Math.min(1, m.userData.grow + 0.08); const g = m.userData.grow; m.scale.setScalar(g < 1 ? 1 + Math.sin(g * Math.PI) * 0.25 - (1 - g) : 1); }
      if (T.hops) {
        if (o.hop > 0) m.position.y = Math.sin((0.35 - o.hop) / 0.35 * Math.PI) * 14;
        if (Math.hypot(o.vx, o.vy) > 1) m.rotation.y = -Math.atan2(o.vy, o.vx);
      }
      if (T.crawls && Math.hypot(o.vx, o.vy) > 1) m.rotation.y = -Math.atan2(o.vy, o.vx);
      if (m.userData.segs) m.userData.segs.forEach((s, i) => { s.position.z = Math.sin(o.t * 5 + i * 0.9) * 1.6; });
      if (m.userData.ball) {
        const sp = Math.hypot(o.vx, o.vy);
        if (sp > 0.5) {
          const axis = new THREE.Vector3(o.vy, 0, -o.vx).normalize();
          m.userData.ball.rotateOnWorldAxis(axis, -sp / 60 / 13 * 2);
        }
      }
      if (m.userData.sprout) { const g2 = 0.5 + Math.min(1, (o.age || 0) / 600) * 1.3; m.userData.sprout.scale.setScalar(g2); }
      if (m.userData.water) m.userData.water.position.y = 8.4 + Math.sin(o.t * 2) * 0.2;
      if (m.userData.winMat) m.userData.winMat.emissiveIntensity = 0.25 + (1 - world.daylight) * 1.6 + (this.reading === o.id ? 0.8 : 0);
      if (m.userData.light) m.userData.light.intensity = 1.2 + (1 - world.daylight) * 1.2 + Math.sin(o.t * 13) * 0.03;
    }
    for (const [id, m] of this.objMeshes) if (!alive.has(id)) { this.scene.remove(m); this.objMeshes.delete(id); }
  }

  updateLizard(L, game) {
    const s = L.segs;
    const acting = L.state === 'acting' && L.plan;
    const verb = acting ? L.plan.verb : null;
    const sleeping = verb === 'rest' || L.state === 'fainted';
    const w = i => i === 0 ? 10 : i === 1 ? 7.5 : i < 7 ? 10.5 - (i - 2) * 0.3 : Math.max(1.5, 9 - (i - 6) * 0.85);
    const wig = verb === 'play' ? Math.sin(L.anim * 18) * 4 : ['dig', 'break', 'craft'].includes(verb) ? Math.sin(L.anim * 22) * 2.2 : 0;
    const flat = verb === 'bask' ? 0.75 : 1;
    const breathe = 1 + Math.sin(L.anim * (sleeping ? 2 : 4)) * 0.03;
    const faded = L.state === 'fainted';
    this.skin.color.set(faded ? '#8a9a7a' : verb === 'bask' ? '#5cbf5f' : '#4fae58');

    let mi = 0;
    for (let i = 0; i < SEGMENTS; i++) {
      const a = i > 0 ? Math.atan2(s[i - 1].y - s[i].y, s[i - 1].x - s[i].x) : L.heading;
      const off = wig * Math.sin(i * 0.7);
      const px = s[i].x + Math.cos(a + Math.PI / 2) * off, py = s[i].y + Math.sin(a + Math.PI / 2) * off;
      const r = w(i);
      const m = this.segMeshes[mi++];
      const isBody = i >= 2 && i <= 6;
      m.scale.set(r * 1.25, r * 0.62 * flat * (isBody ? breathe : 1), r);
      m.position.copy(toV(px, py, r * 0.62 * flat));
      m.rotation.y = -a;
      if (i >= 2 && i <= 11 && i % 2 === 0) {
        for (const side of [-1, 1]) {
          const sp = this.segMeshes[mi++];
          sp.scale.setScalar(r * 0.28);
          sp.scale.y = r * 0.12;
          sp.position.copy(toV(px + Math.cos(a + side * 1.4) * r * 0.45, py + Math.sin(a + side * 1.4) * r * 0.45, r * 1.12 * flat));
        }
      }
    }
    // head
    const hx = s[0].x, hy = s[0].y;
    this.head.position.copy(toV(hx, hy, 9 * flat));
    this.head.rotation.set(0, -L.heading, 0);
    if (verb === 'eat' || verb === 'dig' || verb === 'break') this.head.rotation.z = -0.25 + Math.sin(L.anim * 14) * 0.2;
    else if (L.state === 'considering') this.head.rotation.z = 0.12;
    else this.head.rotation.z = 0;
    const closed = sleeping || L.blink > 0;
    for (const e of this.eyes) { e.lid.visible = closed; e.pupil.visible = !closed; e.white.visible = !closed; }
    this.tongue.visible = L.tongue > 0 && !sleeping;
    if (this.tongue.visible) { const len = 8 + Math.sin(L.tongue * 40) * 4; this.tongueStem.scale.y = len; this.tongueStem.position.x = len / 2; this.tongue.children.slice(1).forEach(f => { f.position.x = len + 1; }); }

    // legs with planted feet (same gait as before)
    if (!L.feet) L.feet = [2, 2, 6, 6].map((si, j) => ({ si, side: j % 2 ? 1 : -1, x: s[si].x, y: s[si].y, tx: s[si].x, ty: s[si].y, lift: 0 }));
    L.feet.forEach((f, k) => {
      const a = s[f.si], b = s[f.si + 1];
      const ang = Math.atan2(a.y - b.y, a.x - b.x);
      const nx = Math.cos(ang + f.side * Math.PI / 2), ny = Math.sin(ang + f.side * Math.PI / 2);
      const fwd = f.si === 2 ? 7 : -2;
      const ix = a.x + nx * 18 + Math.cos(ang) * fwd, iy = a.y + ny * 18 + Math.sin(ang) * fwd;
      // feet stay planted, then swing smoothly to the next spot (left/right take turns)
      const other = L.feet[k ^ 1];
      if (dist(f.tx, f.ty, ix, iy) > 14 && !(other.lift > 0.05)) { f.tx = ix + Math.cos(ang) * 7; f.ty = iy + Math.sin(ang) * 7; f.lift = 1; }
      if (dist(f.x, f.y, ix, iy) > 40) { f.x = f.tx = ix; f.y = f.ty = iy; }
      f.x += (f.tx - f.x) * 0.3; f.y += (f.ty - f.y) * 0.3;
      f.lift = Math.max(0, f.lift - 0.12);
      const lift = Math.sin(f.lift * Math.PI) * 4;
      const hip = toV(a.x + nx * 7, a.y + ny * 7, 6 * flat);
      const foot = toV(f.x, f.y, 1.2 + lift);
      const knee = toV((a.x + f.x) / 2 + nx * 4, (a.y + f.y) / 2 + ny * 4, 9 * flat + lift);
      const leg = this.legs[k];
      placeBetween(leg.upper, hip, knee);
      placeBetween(leg.lower, knee, foot);
      leg.foot.position.copy(foot);
      leg.foot.rotation.y = -ang;
    });
  }

  spawnFx(world) {
    while (world.fx.length) {
      const e = world.fx.shift();
      const at = toV(e.x, e.y);
      if (e.kind === 'splash') {
        for (let i = 0; i < 28; i++) this.addParticle(at, '#7cc8f2', 2 + Math.random() * 2, 60 + Math.random() * 90, 1.1);
        this.addRipple(at, 1.0);
      } else if (e.kind === 'ripple') {
        this.addRipple(at, 0.6); setTimeout(() => this.addRipple(at, 0.5), 250);
      } else if (e.kind === 'crumbs') {
        for (let i = 0; i < 10; i++) this.addParticle(at, '#c9a35a', 1.2 + Math.random(), 30 + Math.random() * 40, 0.7);
      } else if (e.kind === 'sand') {
        for (let i = 0; i < 9; i++) this.addParticle(at.clone().setY(-6), '#d9bb80', 1.4 + Math.random() * 1.4, 40 + Math.random() * 50, 0.7);
      } else if (e.kind === 'sparkle') {
        for (let i = 0; i < 16; i++) this.addParticle(at.clone().setY(12), ['#ff6ad5', '#ffd23f', '#6ae0ff', '#a6ff6a'][i % 4], 1.6, 60 + Math.random() * 60, 1.0);
      } else if (e.kind === 'chips') {
        for (let i = 0; i < 14; i++) this.addParticle(at, '#8a5a2b', 1.2 + Math.random() * 1.2, 40 + Math.random() * 60, 0.8);
      } else if (e.kind === 'ouch') {
        for (let i = 0; i < 8; i++) this.addParticle(at.clone().setY(15), '#ff4b4b', 1.5, 40, 0.6);
      }
    }
  }

  addParticle(at, color, r, speed, life) {
    const m = new THREE.Mesh(sphere(r, 6), new THREE.MeshStandardMaterial({ color, transparent: true, opacity: 0.9, roughness: 0.2 }));
    m.position.copy(at).add(new THREE.Vector3(0, 9, 0));
    const a = Math.random() * Math.PI * 2;
    m.userData = { v: new THREE.Vector3(Math.cos(a) * speed * 0.6, speed, Math.sin(a) * speed * 0.6), life, max: life };
    this.scene.add(m); this.particles.push(m);
  }

  addRipple(at, strength) {
    const m = new THREE.Mesh(new THREE.RingGeometry(0.8, 1, 32), new THREE.MeshBasicMaterial({ color: '#e8f6ff', transparent: true, opacity: 0.8, side: THREE.DoubleSide, depthWrite: false }));
    m.rotation.x = -Math.PI / 2; m.position.copy(at).setY(8.3);
    m.userData = { life: 1, s: strength };
    this.scene.add(m); this.ripples.push(m);
  }

  updateFx(dt) {
    this.particles = this.particles.filter(p => {
      const u = p.userData;
      u.life -= dt;
      u.v.y -= 260 * dt;
      p.position.addScaledVector(u.v, dt);
      if (p.position.y < 1) { p.position.y = 1; u.v.multiplyScalar(0.3); }
      p.material.opacity = Math.max(0, u.life / u.max);
      if (u.life <= 0) { this.scene.remove(p); p.geometry.dispose(); p.material.dispose(); return false; }
      return true;
    });
    this.ripples = this.ripples.filter(r => {
      const u = r.userData;
      u.life -= dt * 1.2;
      const sc = 4 + (1 - u.life) * 22 * u.s;
      r.scale.set(sc, sc, sc);
      r.material.opacity = Math.max(0, u.life * 0.8);
      if (u.life <= 0) { this.scene.remove(r); r.geometry.dispose(); r.material.dispose(); return false; }
      return true;
    });
  }

  updateCamera(lizard) {
    const v = this.view;
    if (v.follow) v.target.lerp(toV(lizard.x, lizard.y), 0.06);
    const sp = Math.sin(v.phi);
    this.camera.position.set(v.target.x + v.radius * sp * Math.sin(v.theta), v.target.y + v.radius * Math.cos(v.phi), v.target.z + v.radius * sp * Math.cos(v.theta));
    this.camera.lookAt(v.target);
  }

  orbit(dx, dy) {
    this.view.theta -= dx * 0.006;
    this.view.phi = clamp(this.view.phi - dy * 0.005, 0.25, 1.35);
  }
  zoom(f) { this.view.radius = clamp(this.view.radius * f, 220, 1600); }
  resetView() { Object.assign(this.view, { theta: 0.35, phi: 0.95, radius: 820, follow: false }); this.view.target.set(0, 0, 20); }

  // screen point → sim coords on the floor (or null)
  pick(clientX, clientY) {
    const rect = this.canvas.getBoundingClientRect();
    const ndc = new THREE.Vector2((clientX - rect.left) / rect.width * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1);
    this.raycaster.setFromCamera(ndc, this.camera);
    // objects first, so you can grab tall things like the lamp
    const hits = this.raycaster.intersectObjects([...this.objMeshes.values()], true);
    let objId = null;
    for (const h of hits) { let o = h.object; while (o && !o.userData.id) o = o.parent; if (o) { objId = o.userData.id; break; } }
    const lizHit = this.raycaster.intersectObject(this.lizardGroup, true).length > 0;
    const p = new THREE.Vector3();
    if (!this.raycaster.ray.intersectPlane(this.groundPlane, p)) return { objId, lizard: lizHit, x: null, y: null };
    const x = p.x + WORLD_W / 2, y = p.z + WORLD_H / 2;
    const inside = x >= 0 && x <= WORLD_W && y >= 0 && y <= WORLD_H;
    return { objId, lizard: lizHit, x: inside ? x : null, y: inside ? y : null };
  }

  screenPos(x, y, h) {
    const v = toV(x, y, h).project(this.camera);
    const rect = this.canvas.getBoundingClientRect();
    return { x: (v.x + 1) / 2 * rect.width, y: (1 - v.y) / 2 * rect.height, behind: v.z > 1 };
  }

  setGhost(type, x, y) {
    if (this.ghostType !== type) {
      if (this.ghost) this.scene.remove(this.ghost);
      this.ghost = type ? buildModel(type) : null;
      if (this.ghost) {
        this.ghost.traverse(o => { if (o.isMesh) { o.material = o.material.clone(); o.material.transparent = true; o.material.opacity = 0.45; o.castShadow = false; } if (o.isLight) o.intensity = 0; });
        this.scene.add(this.ghost);
      }
      this.ghostType = type;
    }
    if (this.ghost) { this.ghost.visible = x !== null && x !== undefined; if (this.ghost.visible) this.ghost.position.copy(toV(x, y)); }
  }

  draw(game, ui, dt) {
    const { world, lizard } = game;
    // day / night lighting
    const d = world.daylight;
    this.sun.intensity = 0.1 + 0.6 * d;
    this.sun.color.setHSL(0.1, 0.5, 0.55 + 0.35 * d);
    this.hemi.intensity = 0.2 + 0.35 * d;
    this.hemi.color.setHSL(0.6 - d * 0.5, 0.4, 0.5 + 0.35 * d);

    const inside = lizard.state === 'acting' && lizard.plan && lizard.inside;
    this.reading = inside ? lizard.plan.objId : null;
    this.syncObjects(world);
    this.lizardGroup.visible = !inside;
    this.updateLizard(lizard, game);
    this.spawnFx(world);
    this.updateFx(dt);

    // highlight + ghost
    const hl = ui.highlight && world.get(ui.highlight);
    this.ring.visible = !!hl;
    if (hl) {
      const r = TYPES[hl.type].size + 14;
      this.ring.scale.set(r, r, r);
      this.ring.position.copy(toV(hl.x, hl.y, 1));
      this.ring.material.color.set(ui.tool === 'remove' ? '#e04a3c' : '#ffffff');
    }
    this.setGhost(TYPES[ui.tool] ? ui.tool : null, ui.ghost ? ui.ghost.x : null, ui.ghost ? ui.ghost.y : null);

    const showPath = lizard.state === 'moving' && lizard.plan && ui.showIntent && lizard.plan.x !== undefined;
    this.path.visible = !!showPath;
    if (showPath) {
      this.path.geometry.setFromPoints([toV(lizard.x, lizard.y, 2), toV(lizard.plan.x, lizard.plan.y, 2)]);
      this.path.computeLineDistances();
    }

    this.updateCamera(lizard);
    this.r.render(this.scene, this.camera);
    this.drawOverlay(game);
  }

  drawOverlay(game) {
    const L = game.lizard;
    const p = L.plan;
    let icon = null;
    if (L.state === 'holding') icon = '👀✨';
    else if (L.state === 'idling') icon = '💭';
    else if ((L.state === 'moving' || L.state === 'considering') && p) {
      if (p.kind === 'wander') icon = '🧭';
      else if (p.kind === 'idle') icon = '💭';
      else if (!VERB_INFO[p.verb]) icon = '🏃' + (typeInfo(p.type) ? typeInfo(p.type).emoji : '');
      else icon = VERB_INFO[p.verb].icon + (p.type === 'ground' ? '' : typeInfo(p.type).emoji) + (p.reason === 'curious' ? '?' : p.reason === 'task' ? '📋' : '');
    } else if (L.state === 'acting' && p) icon = p.verb === 'read' ? '📖 …' : L.inside ? '…' : VERB_INFO[p.verb].icon;
    else if (L.mood === 'happy') icon = '💚';
    else if (L.mood === 'curious') icon = '❓';
    if (L.state === 'fainted') icon = '💫';
    const sp = this.screenPos(L.x, L.y, 40);
    this.bubble.hidden = !icon || sp.behind;
    if (icon) {
      if (this.bubble.textContent !== icon) this.bubble.textContent = icon;
      this.bubble.style.transform = `translate(${sp.x + 10}px, ${sp.y - 46}px)`;
    }
    let st = '';
    const sleeping = L.state === 'acting' && p && p.verb === 'rest';
    if (sleeping) st = '💤';
    else if (L.mood === 'hurt') st = '💢';
    else if (game.celebrate > 0) st = '🎉';
    else if (game.question) st = '🙋';
    this.status.hidden = !st;
    if (st) {
      if (this.status.textContent !== st) this.status.textContent = st;
      const bob = Math.sin(L.anim * 3) * 4;
      this.status.style.transform = `translate(${sp.x - 34}px, ${sp.y - 30 + bob}px)`;
    }
  }
}
