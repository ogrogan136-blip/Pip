'use strict';
/*
 * crops.js — realistic-ish 3D crops that grow in stages.
 * Lettuce grows as a rosette that closes into a head, strawberries grow
 * three-part leaves, flower, then berries that ripen green → white → red.
 * Dry plants droop and fade; watered soil is dark.
 */

function lerpColor(a, b, t) {
  const ca = new THREE.Color(a), cb = new THREE.Color(b);
  return '#' + ca.lerp(cb, clamp(t, 0, 1)).getHexString();
}

// A leaf whose base sits at the group's origin, pointing along +x.
function leafMesh(len, wid, color, crinkle, seed) {
  const pivot = new THREE.Group();
  let geo = sphere(1, 12);
  if (crinkle) geo = jitterGeo(geo, crinkle, seed || 1);
  const m = mesh(geo, mat(color, { roughness: 0.65 }), len * 0.5, 0, 0);
  m.scale.set(len * 0.5, Math.max(0.25, wid * 0.12), wid * 0.5);
  pivot.add(m);
  return pivot;
}

function soilMound(r, wet, dry) {
  const g = new THREE.Group();
  const col = wet ? '#3f2c1c' : lerpColor('#6e5038', '#a88a62', dry);
  const base = mesh(new THREE.SphereGeometry(r, 16, 6, 0, Math.PI * 2, 0, Math.PI / 2), mat(col, { roughness: 1 }), 0, 0.6, 0);
  base.scale.y = 0.28; base.castShadow = false;
  g.add(base);
  if (wet) { const sheen = mesh(new THREE.CircleGeometry(r * 0.6, 14), new THREE.MeshStandardMaterial({ color: '#2b1e13', roughness: 0.2, transparent: true, opacity: 0.5 }), 0, r * 0.29, 0); sheen.rotation.x = -Math.PI / 2; sheen.castShadow = false; g.add(sheen); }
  if (dry > 0.6) for (let i = 0; i < 3; i++) { const c = mesh(new THREE.BoxGeometry(r * 1.1, 0.2, 0.5), mat('#5a4330'), 0, r * 0.28, 0); c.rotation.y = i * 1.1; c.castShadow = false; g.add(c); }
  return g;
}

// kind: lettuce | berry | flower | generic.  g: growth 0..1.  ripe: 0..1 (grown plants).
function buildCrop(kind, g, opts = {}) {
  const grp = new THREE.Group();
  const droop = clamp(opts.droop || 0, 0, 1);
  const fade = c => droop > 0.05 ? lerpColor(c, '#a8954a', droop * 0.8) : c;
  if (opts.soil !== false) grp.add(soilMound(opts.mature ? 15 : 10, opts.wet, droop));
  const y0 = opts.mature ? 3.6 : 2.4;

  if (g < 0.08) {
    // just planted: a seed peeking out, or the first loop of a sprout
    const s = mesh(sphere(1.1, 8), mat('#8a6a3a'), 0, y0, 0); s.scale.set(1, 0.6, 1.4); grp.add(s);
    if (g > 0.03) { const st = mesh(new THREE.TorusGeometry(1.4, 0.35, 6, 10, Math.PI), mat(fade('#9ccc65'))); st.position.set(0, y0, 0); grp.add(st); }
    return grp;
  }
  // first two seed-leaves (cotyledons), on every young plant
  if (g < 0.35) {
    const h = 2 + g * 10;
    grp.add(mesh(cyl(0.35, 0.45, h, 6), mat(fade('#8bc34a')), 0, y0 + h / 2, 0));
    for (const s of [-1, 1]) {
      const l = leafMesh(2.5 + g * 6, 2 + g * 4, fade('#8bc34a'));
      l.position.set(0, y0 + h, 0); l.rotation.set(0, s > 0 ? 0 : Math.PI, 0.35 - droop * 0.9);
      grp.add(l);
    }
    if (g < 0.2) return grp;
  }

  if (kind === 'lettuce') {
    // a rosette of crinkly leaves that closes up into a head
    const n = Math.round(4 + g * 14);
    for (let i = 0; i < n; i++) {
      const t = i / n; // 0 = outer, oldest
      const len = (5 + 11 * g) * (1 - 0.45 * t);
      const col = fade(lerpColor('#3f8f2f', '#b6e07a', t));
      const l = leafMesh(len, len * 0.8, col, 0.18, i + 2);
      l.position.set(0, y0 + t * 3 * g, 0);
      l.rotation.set(0, i * 2.39996, (0.15 + 1.1 * t * g) - droop * 0.8);
      grp.add(l);
    }
    if (g > 0.65) { const head = mesh(jitterGeo(sphere(1, 12), 0.08, 3), mat(fade('#c5e68a'), { roughness: 0.6 }), 0, y0 + 4, 0); const hs = 3 + 6 * (g - 0.65) / 0.35; head.scale.set(hs, hs * 0.85, hs); grp.add(head); }
  } else if (kind === 'berry') {
    // strawberry: three-part leaves on stalks, white flowers, then berries
    const k = Math.round(2 + g * 6), h = 3 + 9 * g;
    for (let i = 0; i < k; i++) {
      const a = i * 2.39996, r = 2 + 6 * g;
      const tip = new THREE.Vector3(Math.cos(a) * r, y0 + h * (0.7 + 0.3 * ((i * 7) % 3) / 2) - droop * h * 0.5, Math.sin(a) * r);
      const stalk = mesh(cyl(0.3, 0.3, 1, 5), mat(fade('#4c8c3a'))); placeBetween(stalk, new THREE.Vector3(0, y0, 0), tip); grp.add(stalk);
      for (let j = -1; j <= 1; j++) {
        const lf = leafMesh(3 + 3.5 * g, 2.6 + 3 * g, fade(j === 0 ? '#2e7d32' : '#388e3c'), 0.05, i * 3 + j + 5);
        lf.position.copy(tip); lf.rotation.set(0, -a + j * 0.75, 0.25 - droop * 0.7); grp.add(lf);
      }
    }
    const flowers = opts.mature ? 1 : g > 0.55 ? Math.round((g - 0.55) * 7) : 0;
    for (let i = 0; i < flowers; i++) {
      const a = i * 2.1 + 0.7, p = new THREE.Vector3(Math.cos(a) * 5, y0 + h * 0.8, Math.sin(a) * 5);
      for (let q = 0; q < 5; q++) { const pt = mesh(sphere(1, 6), mat('#ffffff', { roughness: 0.5 }), p.x + Math.cos(q * 1.257) * 1.3, p.y, p.z + Math.sin(q * 1.257) * 1.3); pt.scale.set(1, 0.35, 1); grp.add(pt); }
      grp.add(mesh(sphere(0.8, 6), mat('#f4c430'), p.x, p.y + 0.3, p.z));
    }
    if (opts.mature) {
      const ripe = opts.ripe || 0;
      const col = ripe < 0.45 ? lerpColor('#9ccc65', '#e8e4c0', ripe / 0.45) : lerpColor('#e8e4c0', '#d32f2f', (ripe - 0.45) / 0.55);
      for (let i = 0; i < 4; i++) {
        const a = i * 1.6 + 0.3, sz = 0.8 + 0.8 * ripe;
        const bx = Math.cos(a) * 12, bz = Math.sin(a) * 12, by = y0 + 5;
        const stem = mesh(cyl(0.25, 0.25, 1, 4), mat('#4c8c3a')); placeBetween(stem, new THREE.Vector3(Math.cos(a) * 4, y0 + h * 0.6, Math.sin(a) * 4), new THREE.Vector3(bx, by + 3.4 * sz, bz)); grp.add(stem);
        const berry = mesh(new THREE.ConeGeometry(2.4 * sz, 4.4 * sz, 10), mat(col, { roughness: 0.35 }), bx, by + 1.4 * sz, bz); berry.rotation.x = Math.PI; grp.add(berry);
        const top = mesh(sphere(2.4 * sz, 10), mat(col, { roughness: 0.35 }), bx, by + 2.9 * sz, bz); top.scale.y = 0.55; grp.add(top);
        const cap = mesh(new THREE.ConeGeometry(2 * sz, 1, 5), mat('#2e7d32'), bx, by + 3.6 * sz, bz); cap.scale.y = 0.6; grp.add(cap);
        if (ripe > 0.6) for (let q = 0; q < 5; q++) grp.add(mesh(sphere(0.22, 4), mat('#f6d55c'), bx + Math.cos(q * 1.3) * 1.7 * sz, by + (1 + q % 2) * sz, bz + Math.sin(q * 1.3) * 1.7 * sz));
      }
    }
  } else if (kind === 'flower') {
    const stems = opts.mature ? 3 : 1;
    for (let s = 0; s < stems; s++) {
      const off = stems > 1 ? 5 : 0, a = s * 2.1;
      const h = (5 + 18 * g) * (1 - s * 0.12), bx = Math.cos(a) * off, bz = Math.sin(a) * off;
      grp.add(mesh(cyl(0.45, 0.55, h, 6), mat(fade('#4b9a3c')), bx, y0 + h / 2 - droop * 2, bz));
      for (let i = 0; i < 2 + Math.round(g * 2); i++) { const l = leafMesh(3 + 3 * g, 2 + 2 * g, fade('#4f9a35')); l.position.set(bx, y0 + h * (0.25 + 0.2 * i), bz); l.rotation.set(0, i * 2.3 + a, 0.4 - droop); grp.add(l); }
      const top = new THREE.Vector3(bx, y0 + h - droop * 2, bz);
      const bloom = opts.mature ? 0.5 + 0.5 * (opts.ripe || 0) : clamp((g - 0.75) / 0.25, 0, 1);
      if (bloom <= 0) { const bud = mesh(sphere(1.6, 8), mat(fade('#7cb342')), top.x, top.y + 1, top.z); bud.scale.y = 1.5; grp.add(bud); }
      else {
        for (let q = 0; q < 10; q++) { const p = mesh(sphere(1, 6), mat(fade('#ffd23f'), { roughness: 0.5 }), top.x + Math.cos(q * 0.628) * 2.6 * bloom, top.y + 1, top.z + Math.sin(q * 0.628) * 2.6 * bloom); p.scale.set(1.8 * bloom, 0.3, 0.8 * bloom); p.rotation.y = -q * 0.628; grp.add(p); }
        grp.add(mesh(sphere(1.5 * bloom + 0.4, 8), mat('#7b4a1e'), top.x, top.y + 1.4, top.z));
      }
    }
  } else {
    // anything else (including foods Pip imagined): a leafy plant whose fruit swells as it ripens
    const n = Math.round(4 + g * 8), color = opts.color || '#e85a38';
    for (let i = 0; i < n; i++) { const t = i / n, len = (4 + 9 * g) * (1 - 0.3 * t); const l = leafMesh(len, len * 0.55, fade(lerpColor('#2f7d32', '#7cb342', t)), 0.06, i + 9); l.position.set(0, y0 + t * 4 * g, 0); l.rotation.set(0, i * 2.39996, 0.35 + 0.6 * t - droop * 0.8); grp.add(l); }
    if (opts.mature) {
      const ripe = opts.ripe || 0;
      for (let i = 0; i < 3; i++) { const a = i * 2.1 + 0.5; grp.add(mesh(sphere(1.2 + 2.2 * ripe, 10), mat(lerpColor('#9ccc65', color, ripe), { roughness: 0.4 }), Math.cos(a) * 6, y0 + 6 + (i % 2) * 2, Math.sin(a) * 6)); }
    }
  }
  return grp;
}

function cropKind(type) { return ['lettuce', 'berry', 'flower'].includes(type) ? type : 'generic'; }

// What a growing thing looks like right now (used to decide when to rebuild its model).
function cropState(o) {
  if (o.type === 'seedling') {
    const g = Math.min(1, (o.age || 0) / 600);
    const droop = Math.min(1, (o.thirst || 0) / 300) + (o.onGrass === false ? Math.min(1, (o.sandTime || 0) / 150) : 0);
    return { g, droop: Math.min(1, droop), wet: (o.water || 0) > 0, key: `s${Math.round(g * 24)}|${Math.round(droop * 4)}|${(o.water || 0) > 0 ? 1 : 0}` };
  }
  const ripe = Math.min(1, (o.timer || 0) / 200);
  return { g: 1, ripe, mature: true, key: `p${Math.round(ripe * 10)}` };
}
