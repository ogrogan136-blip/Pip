'use strict';
/* render.js — draws the terrarium and Pip on a canvas. */

class Renderer {
  constructor(canvas) {
    this.c = canvas;
    this.ctx = canvas.getContext('2d');
    this.dpr = 1;
    this.bg = this.makeBackground();
    this.resize();
  }

  resize() {
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.c.width = WORLD_W * this.dpr;
    this.c.height = WORLD_H * this.dpr;
  }

  makeBackground() {
    const b = document.createElement('canvas');
    b.width = WORLD_W; b.height = WORLD_H;
    const x = b.getContext('2d');
    const g = x.createLinearGradient(0, 0, WORLD_W, WORLD_H);
    g.addColorStop(0, '#e8d3a3'); g.addColorStop(1, '#d9bc84');
    x.fillStyle = g; x.fillRect(0, 0, WORLD_W, WORLD_H);
    let seed = 7;
    const r = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    for (let i = 0; i < 1400; i++) {
      x.fillStyle = `rgba(${120 + r() * 60},${90 + r() * 40},${50 + r() * 30},${0.12 + r() * 0.2})`;
      x.beginPath(); x.arc(r() * WORLD_W, r() * WORLD_H, 0.6 + r() * 2.2, 0, 7); x.fill();
    }
    for (let i = 0; i < 18; i++) {
      x.fillStyle = 'rgba(110,85,50,0.18)';
      x.beginPath(); x.ellipse(r() * WORLD_W, r() * WORLD_H, 6 + r() * 10, 4 + r() * 6, r() * 3, 0, 7); x.fill();
    }
    // glass edge
    x.strokeStyle = 'rgba(80,60,30,0.35)'; x.lineWidth = 10; x.strokeRect(0, 0, WORLD_W, WORLD_H);
    return b;
  }

  draw(game, ui) {
    const { ctx } = this;
    const { world, lizard } = game;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.drawImage(this.bg, 0, 0);

    // heat glow
    for (const o of world.objects) {
      const T = TYPES[o.type];
      if (!T.heat) continue;
      const g = ctx.createRadialGradient(o.x, o.y, 0, o.x, o.y, T.heat);
      g.addColorStop(0, 'rgba(255,170,60,0.45)'); g.addColorStop(1, 'rgba(255,170,60,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(o.x, o.y, T.heat, 0, 7); ctx.fill();
    }

    // shadows + objects
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (const o of world.objects) {
      const T = TYPES[o.type];
      let y = o.y, sc = 1;
      if (T.hops && o.hop > 0) y -= Math.sin((0.35 - o.hop) / 0.35 * Math.PI) * 10;
      if (T.wiggles) sc = 1 + Math.sin(o.t * 6) * 0.06;
      ctx.fillStyle = 'rgba(60,40,20,0.22)';
      ctx.beginPath(); ctx.ellipse(o.x, o.y + T.size * 0.7, T.size * 0.9, T.size * 0.35, 0, 0, 7); ctx.fill();
      if (o.type === 'water') {
        ctx.fillStyle = '#9aa3ad'; ctx.beginPath(); ctx.ellipse(o.x, o.y, 26, 19, 0, 0, 7); ctx.fill();
        ctx.fillStyle = '#5fb3e8'; ctx.beginPath(); ctx.ellipse(o.x, o.y, 21, 14, 0, 0, 7); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.beginPath(); ctx.ellipse(o.x - 6, o.y - 4, 6, 3, -0.4, 0, 7); ctx.fill();
        continue;
      }
      ctx.save();
      ctx.translate(o.x, y);
      if (T.rolls) ctx.rotate((o.x + o.y) / 14);
      ctx.scale(sc, sc);
      ctx.font = `${T.size * 2}px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif`;
      ctx.fillText(T.emoji, 0, 0);
      ctx.restore();
    }

    // hover/placement ghost
    if (ui.ghost) {
      ctx.globalAlpha = 0.5;
      const T = TYPES[ui.ghost.type];
      ctx.font = `${T.size * 2}px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif`;
      ctx.fillText(T.emoji, ui.ghost.x, ui.ghost.y);
      ctx.globalAlpha = 1;
    }
    if (ui.highlight) {
      ctx.strokeStyle = ui.tool === 'remove' ? '#d33' : '#fff';
      ctx.lineWidth = 2; ctx.setLineDash([4, 4]);
      ctx.beginPath(); ctx.arc(ui.highlight.x, ui.highlight.y, TYPES[ui.highlight.type].size + 8, 0, 7); ctx.stroke();
      ctx.setLineDash([]);
    }

    // where Pip is heading
    if (lizard.state === 'moving' && lizard.plan && ui.showIntent) {
      ctx.strokeStyle = 'rgba(40,120,60,0.35)'; ctx.lineWidth = 2; ctx.setLineDash([3, 6]);
      ctx.beginPath(); ctx.moveTo(lizard.x, lizard.y); ctx.lineTo(lizard.plan.x, lizard.plan.y); ctx.stroke();
      ctx.setLineDash([]);
    }

    this.drawLizard(lizard, game);

    // night
    const dark = 1 - world.daylight;
    if (dark > 0.05) {
      ctx.fillStyle = `rgba(15,20,60,${dark * 0.4})`;
      ctx.fillRect(0, 0, WORLD_W, WORLD_H);
      for (const o of world.objects) {
        const T = TYPES[o.type];
        if (!T.heat) continue;
        ctx.globalCompositeOperation = 'lighter';
        const g = ctx.createRadialGradient(o.x, o.y, 0, o.x, o.y, T.heat * 0.9);
        g.addColorStop(0, `rgba(255,150,50,${dark * 0.35})`); g.addColorStop(1, 'rgba(255,150,50,0)');
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(o.x, o.y, T.heat, 0, 7); ctx.fill();
        ctx.globalCompositeOperation = 'source-over';
      }
    }

    this.drawBubble(lizard, game);

    if (game.celebrate > 0) {
      ctx.font = '28px sans-serif';
      for (let i = 0; i < 8; i++) {
        const a = i / 8 * Math.PI * 2 + game.celebrate * 2, r = 40 + (2.5 - game.celebrate) * 30;
        ctx.globalAlpha = Math.min(1, game.celebrate);
        ctx.fillText(['🎉', '⭐', '✨', '💚'][i % 4], lizard.x + Math.cos(a) * r, lizard.y + Math.sin(a) * r);
      }
      ctx.globalAlpha = 1;
    }
  }

  drawLizard(L, game) {
    const ctx = this.ctx;
    const s = L.segs;
    const acting = L.state === 'acting' && L.plan;
    const verb = acting ? L.plan.verb : null;
    const sleeping = verb === 'rest' || L.state === 'fainted';
    // body width profile
    const w = i => i === 0 ? 10 : i === 1 ? 7.5 : i < 7 ? 10.5 - (i - 2) * 0.3 : Math.max(1.5, 9 - (i - 6) * 0.85);
    const wig = verb === 'play' ? Math.sin(L.anim * 18) * 4 : 0;

    // legs (planted feet that step as Pip moves)
    if (!L.feet) L.feet = [2, 2, 6, 6].map((si, j) => ({ si, side: j % 2 ? 1 : -1, x: s[si].x, y: s[si].y }));
    const color = L.state === 'fainted' ? '#8a9a7a' : '#4fae58';
    const dark = L.state === 'fainted' ? '#677557' : '#2f7f3a';
    ctx.lineCap = 'round';
    for (const f of L.feet) {
      const a = s[f.si], b = s[f.si + 1];
      const ang = Math.atan2(a.y - b.y, a.x - b.x);
      const nx = Math.cos(ang + f.side * Math.PI / 2), ny = Math.sin(ang + f.side * Math.PI / 2);
      const fwd = f.si === 2 ? 7 : -2;
      const ix = a.x + nx * 17 + Math.cos(ang) * fwd, iy = a.y + ny * 17 + Math.sin(ang) * fwd;
      if (dist(f.x, f.y, ix, iy) > 13) { f.x = ix + Math.cos(ang) * 6; f.y = iy + Math.sin(ang) * 6; }
      const kx = (a.x + f.x) / 2 + nx * 3, ky = (a.y + f.y) / 2 + ny * 3;
      ctx.strokeStyle = dark; ctx.lineWidth = 4.5;
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.quadraticCurveTo(kx, ky, f.x, f.y); ctx.stroke();
      ctx.lineWidth = 1.8;
      for (let t = -1; t <= 1; t++) {
        const ta = ang + f.side * 0.4 + t * 0.5;
        ctx.beginPath(); ctx.moveTo(f.x, f.y); ctx.lineTo(f.x + Math.cos(ta) * 5, f.y + Math.sin(ta) * 5); ctx.stroke();
      }
    }

    // shadow
    ctx.fillStyle = 'rgba(50,35,15,0.2)';
    for (let i = 0; i < s.length; i += 2) { ctx.beginPath(); ctx.arc(s[i].x + 3, s[i].y + 5, w(i), 0, 7); ctx.fill(); }

    // body: draw tail to head
    for (let i = s.length - 1; i >= 0; i--) {
      const off = wig * Math.sin(i * 0.7);
      const a = i > 0 ? Math.atan2(s[i - 1].y - s[i].y, s[i - 1].x - s[i].x) : L.heading;
      const px = s[i].x + Math.cos(a + Math.PI / 2) * off, py = s[i].y + Math.sin(a + Math.PI / 2) * off;
      ctx.fillStyle = color;
      ctx.beginPath(); ctx.arc(px, py, w(i), 0, 7); ctx.fill();
      if (i >= 2 && i <= 11 && i % 2 === 0) {
        ctx.fillStyle = dark;
        ctx.beginPath(); ctx.arc(px + Math.cos(a + 1.6) * w(i) * 0.35, py + Math.sin(a + 1.6) * w(i) * 0.35, w(i) * 0.25, 0, 7); ctx.fill();
        ctx.beginPath(); ctx.arc(px + Math.cos(a - 1.6) * w(i) * 0.35, py + Math.sin(a - 1.6) * w(i) * 0.35, w(i) * 0.22, 0, 7); ctx.fill();
      }
      if (i >= 2 && i <= 6) { // belly highlight
        ctx.fillStyle = 'rgba(255,255,200,0.12)';
        ctx.beginPath(); ctx.arc(px, py, w(i) * 0.5, 0, 7); ctx.fill();
      }
    }

    // head
    const h = L.heading, hx = s[0].x, hy = s[0].y;
    ctx.save(); ctx.translate(hx, hy); ctx.rotate(h);
    ctx.fillStyle = color;
    ctx.beginPath(); ctx.ellipse(4, 0, 13, 9.5, 0, 0, 7); ctx.fill();
    // tongue
    if (L.tongue > 0 && !sleeping) {
      const len = 10 + Math.sin(L.tongue * 40) * 4;
      ctx.strokeStyle = '#e0446a'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(16, 0); ctx.lineTo(16 + len, 0);
      ctx.lineTo(19 + len, -3); ctx.moveTo(16 + len, 0); ctx.lineTo(19 + len, 3); ctx.stroke();
    }
    // eyes
    for (const side of [-1, 1]) {
      ctx.fillStyle = '#e9f5c9';
      ctx.beginPath(); ctx.arc(6, side * 7, 4.2, 0, 7); ctx.fill();
      if (sleeping || L.blink > 0) {
        ctx.strokeStyle = '#1c3a20'; ctx.lineWidth = 1.6;
        ctx.beginPath(); ctx.moveTo(3, side * 7); ctx.lineTo(9, side * 7); ctx.stroke();
      } else {
        ctx.fillStyle = '#111';
        ctx.beginPath(); ctx.ellipse(7, side * 7.4, 1.4, 3, 0, 0, 7); ctx.fill();
        ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(6.2, side * 6.2, 0.9, 0, 7); ctx.fill();
      }
    }
    // nostrils
    ctx.fillStyle = dark;
    ctx.beginPath(); ctx.arc(15, -2.5, 0.9, 0, 7); ctx.arc(15, 2.5, 0.9, 0, 7); ctx.fill();
    ctx.restore();

    // status text near Pip
    ctx.font = '16px sans-serif';
    if (sleeping && L.state !== 'fainted') {
      const t = L.anim % 2;
      ctx.globalAlpha = 1 - t / 2;
      ctx.fillText('💤', hx + 14 + t * 8, hy - 18 - t * 14);
      ctx.globalAlpha = 1;
    }
    if (verb === 'bask') ctx.fillText('☀️', hx + 10, hy - 22 + Math.sin(L.anim * 3) * 2);
    if (L.state === 'fainted') ctx.fillText('💫', hx, hy - 22);
    if (L.mood === 'hurt') ctx.fillText('💢', hx - 12, hy - 18);
  }

  drawBubble(L) {
    const ctx = this.ctx;
    let icon = null;
    const p = L.plan;
    if (L.state === 'fainted') return;
    if (L.state === 'idling') icon = '💭';
    else if ((L.state === 'moving' || L.state === 'considering') && p) {
      if (p.kind === 'wander') icon = '🧭';
      else if (p.kind === 'idle') icon = '💭';
      else {
        const T = typeInfo(p.type);
        icon = VERB_INFO[p.verb].icon + (p.type === 'ground' ? '' : T.emoji) + (p.reason === 'curious' ? '?' : p.reason === 'task' ? '📋' : '');
      }
    } else if (L.mood === 'happy') icon = '💚';
    else if (L.mood === 'curious') icon = '❓';
    if (!icon) return;
    const x = clamp(L.x + 24, 40, WORLD_W - 60), y = clamp(L.y - 44, 24, WORLD_H - 20);
    ctx.font = '17px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif';
    const tw = ctx.measureText(icon).width + 18;
    ctx.fillStyle = 'rgba(255,255,255,0.92)';
    ctx.strokeStyle = 'rgba(40,60,40,0.25)'; ctx.lineWidth = 1;
    roundRect(ctx, x - tw / 2, y - 15, tw, 30, 15); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.arc(x - tw / 2 + 6, y + 20, 4, 0, 7); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.arc(L.x + 8, L.y - 14, 2.5, 0, 7); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#222';
    ctx.fillText(icon, x, y + 1);
  }
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}
