(() => {
  'use strict';

  const canvas = document.getElementById('pbjMotionCanvas');
  const home = document.querySelector('.pbj-intro');
  const universe = document.querySelector('.pbj-universe-scene');
  const universeCore = document.getElementById('pbjUniverseCore');
  const introLogo = document.getElementById('introLogo');
  if (!canvas || !home || !universe) return;

  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduced) return;
  const compact = matchMedia('(max-width: 900px)').matches || matchMedia('(pointer: coarse)').matches;
  const finePointer = matchMedia('(hover: hover) and (pointer: fine)').matches;

  const ctx = canvas.getContext('2d', { alpha: true, desynchronized: true });
  const palette = ['#3978ff', '#12aee6', '#7a5cff', '#ee4f86', '#ff8a3d', '#27b878', '#d9a115'];
  const categoryColors = { lpse: '#3978ff', advokasi: '#ff8a3d', pengelolaan: '#27b878' };
  const homeColors = { ruang: '#3978ff', itkp: '#12aee6', data: '#7a5cff', rapor: '#ff8a3d', pimpinan: '#ee4f86', tim: '#27b878' };
  const clamp = (n, a = 0, b = 1) => Math.max(a, Math.min(b, n));
  const lerp = (a, b, t) => a + (b - a) * t;
  const smooth = t => { t = clamp(t); return t * t * (3 - 2 * t); };
  const rand = i => {
    const x = Math.sin(i * 12.9898 + 78.233) * 43758.5453123;
    return x - Math.floor(x);
  };

  let w = 0, h = 0, dpr = 1, stars = [], edges = [], raf = 0;
  let homeVis = 1, universeVis = 0, universeP = 0;
  let pointer = { x: -9999, y: -9999, active: false };
  let hovered = null;
  const magnetic = { x: 0, y: 0, tx: 0, ty: 0, rx: 0, ry: 0, trx: 0, try: 0 };
  const homeMagnetic = { x: 0, y: 0, tx: 0, ty: 0, rx: 0, ry: 0, trx: 0, try: 0 };

  const pointCount = () => compact ? (w < 520 ? 42 : 56) : (w < 1200 ? 132 : 184);

  function buildField() {
    const n = pointCount();
    stars = Array.from({ length: n }, (_, i) => ({
      x: rand(i + 1) * w,
      y: rand(i + 801) * h,
      r: .35 + rand(i + 1601) * 1.35,
      a: .18 + rand(i + 2401) * .62,
      phase: rand(i + 3201) * Math.PI * 2,
      depth: .35 + rand(i + 4001) * .95,
      color: Math.floor(rand(i + 4801) * palette.length) % palette.length
    }));

    const max = w < 700 ? 120 : 188;
    const max2 = max * max;
    const set = new Set();
    for (let i = 0; i < stars.length; i++) {
      const near = [];
      for (let j = 0; j < stars.length; j++) {
        if (i === j) continue;
        const dx = stars[i].x - stars[j].x, dy = stars[i].y - stars[j].y;
        const d2 = dx * dx + dy * dy;
        if (d2 <= max2) near.push([d2, j]);
      }
      near.sort((a, b) => a[0] - b[0]);
      near.slice(0, 2 + (i % 3 === 0 ? 1 : 0)).forEach(([, j]) => {
        const a = Math.min(i, j), b = Math.max(i, j);
        set.add(`${a}:${b}`);
      });
    }
    edges = [...set].map(v => {
      const [a, b] = v.split(':').map(Number);
      return [a, b, (stars[a].color + stars[b].color + a + b) % palette.length];
    });
  }

  function resize() {
    w = innerWidth; h = innerHeight;
    dpr = Math.min(devicePixelRatio || 1, compact ? 1 : 1.35);
    canvas.width = Math.max(1, Math.floor(w * dpr));
    canvas.height = Math.max(1, Math.floor(h * dpr));
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    buildField();
    readScenes();
  }

  function readScenes() {
    const hr = home.getBoundingClientRect();
    const ur = universe.getBoundingClientRect();
    homeVis = smooth(clamp(Math.min(hr.bottom, h) / Math.max(1, h * .62))) * smooth(clamp((h - hr.top) / Math.max(1, h * .45)));
    universeVis = smooth(clamp((h - ur.top) / Math.max(1, h * .55))) * smooth(clamp(ur.bottom / Math.max(1, h * .48)));
    universeP = clamp(-ur.top / Math.max(1, universe.offsetHeight - h));
    if (homeVis <= .008 && universeVis <= .008) {
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
      ctx.clearRect(0, 0, w, h);
      return;
    }
    if (!raf && !document.hidden) raf = requestAnimationFrame(frame);
  }

  function roomMix() {
    const total = Math.max(.001, homeVis + universeVis);
    return smooth(clamp(universeVis / total));
  }

  function starPosition(s, now) {
    const t = roomMix() * universeP;
    const driftX = Math.sin(now * .00009 + s.phase) * (3.5 + s.depth * 4.5);
    const driftY = Math.cos(now * .000075 + s.phase * .71) * (2.5 + s.depth * 3.6);
    const px = pointer.active ? (pointer.x / Math.max(1, w) - .5) * (7 + s.depth * 7) : 0;
    const py = pointer.active ? (pointer.y / Math.max(1, h) - .5) * (6 + s.depth * 5) : 0;
    const handoffX = (s.y / Math.max(1, h) - .5) * 18 * t;
    const handoffY = (s.x / Math.max(1, w) - .5) * -11 * t;
    return { x: s.x + driftX + px + handoffX, y: s.y + driftY + py + handoffY };
  }

  function centerOf(el, fallbackX = w * .5, fallbackY = h * .5) {
    if (!el) return { x: fallbackX, y: fallbackY };
    const r = el.getBoundingClientRect();
    if (r.width <= 0 || r.height <= 0 || r.bottom < 0 || r.top > h) return { x: fallbackX, y: fallbackY };
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  }

  function visible(el) {
    if (!el) return false;
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden' || Number(cs.opacity) < .03) return false;
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < h && r.right > 0 && r.left < w;
  }

  function drawField(now, alpha, mix) {
    if (alpha <= .01) return [];
    const pos = stars.map(s => starPosition(s, now));

    ctx.save();
    ctx.lineWidth = .72;
    for (let k = 0; k < edges.length; k++) {
      const [i, j, ci] = edges[k], a = pos[i], b = pos[j];
      const dx = a.x - b.x, dy = a.y - b.y;
      const d = Math.sqrt(dx * dx + dy * dy);
      const local = clamp(1 - d / (w < 700 ? 138 : 208));
      ctx.globalAlpha = alpha * local * lerp(.30, .42, mix);
      ctx.strokeStyle = mix > .35 ? palette[ci] : palette[(ci + 2) % palette.length];
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
    }

    if (pointer.active) {
      const radius = w < 700 ? 108 : 172;
      const r2 = radius * radius;
      let linked = 0;
      for (let i = 0; i < pos.length && linked < 16; i++) {
        const p = pos[i];
        const dx = p.x - pointer.x, dy = p.y - pointer.y, d2 = dx * dx + dy * dy;
        if (d2 > r2) continue;
        const near = 1 - Math.sqrt(d2) / radius;
        ctx.globalAlpha = alpha * near * lerp(.46, .60, mix);
        ctx.strokeStyle = mix > .35 ? palette[stars[i].color] : palette[(stars[i].color + 1) % palette.length];
        ctx.beginPath(); ctx.moveTo(pointer.x, pointer.y); ctx.lineTo(p.x, p.y); ctx.stroke();
        linked++;
      }
    }

    for (let i = 0; i < pos.length; i++) {
      const s = stars[i], p = pos[i];
      const tw = .72 + .28 * Math.sin(now * .0009 + s.phase);
      const homeAccent = i % 10 === 0;
      const roomAccent = i % 5 !== 0;
      ctx.globalAlpha = alpha * s.a * tw * (mix > .35 ? (roomAccent ? .90 : .58) : (homeAccent ? .98 : .62));
      ctx.fillStyle = mix > .35 ? (roomAccent ? palette[s.color] : '#6c7982') : (homeAccent ? palette[s.color] : '#8fa4af');
      ctx.beginPath(); ctx.arc(p.x, p.y, mix > .35 ? Math.max(.65, s.r * .92) : (homeAccent ? Math.max(1.05, s.r * .96) : Math.max(.6, s.r * .8)), 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
    return pos;
  }

  function drawRail(a, b, alpha = .12, width = .55, color = '#f4f4f0', bend = 0) {
    const dx = b.x - a.x, dy = b.y - a.y;
    const len = Math.max(1, Math.hypot(dx, dy));
    const nx = -dy / len, ny = dx / len;
    const mx = (a.x + b.x) / 2 + nx * len * bend;
    const my = (a.y + b.y) / 2 + ny * len * bend;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.beginPath(); ctx.moveTo(a.x, a.y);
    if (Math.abs(bend) > .001) ctx.quadraticCurveTo(mx, my, b.x, b.y);
    else ctx.lineTo(b.x, b.y);
    ctx.stroke();
    ctx.restore();
  }

  function drawFan(a, b, intensity, color = '#f5f5f2') {
    if (intensity <= .01) return;
    const dx = b.x - a.x, dy = b.y - a.y;
    const len = Math.max(1, Math.sqrt(dx * dx + dy * dy));
    const nx = -dy / len, ny = dx / len;
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineCap = 'round';
    for (let i = -4; i <= 4; i++) {
      const spread = i * 3.6;
      const endSpread = i * 1.1;
      ctx.globalAlpha = intensity * (i === 0 ? .66 : .11 + (4 - Math.abs(i)) * .024);
      ctx.lineWidth = i === 0 ? .9 : .5;
      ctx.beginPath();
      ctx.moveTo(a.x + nx * spread, a.y + ny * spread);
      ctx.lineTo(b.x + nx * endSpread, b.y + ny * endSpread);
      ctx.stroke();
    }
    ctx.globalAlpha = intensity * .9;
    ctx.fillStyle = color;
    ctx.beginPath(); ctx.arc(b.x, b.y, 2.2, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  function homeColor(el, index = 0) {
    if (!el) return palette[index % palette.length];
    const key = el.dataset?.constellationNode;
    return homeColors[key] || palette[index % palette.length];
  }

  function drawMagneticCloud(c, now, strength = 1) {
    if (strength <= .02) return;
    const loops = [
      { rx: 56, ry: 18, rot: .25, speed: .00115, color: palette[0], count: 7 },
      { rx: 42, ry: 26, rot: 1.18, speed: -.00095, color: palette[4], count: 6 },
      { rx: 36, ry: 14, rot: 2.32, speed: .00135, color: palette[5], count: 5 },
      { rx: 24, ry: 24, rot: .0, speed: -.00165, color: palette[3], count: 5 }
    ];
    ctx.save();
    loops.forEach((loop, li) => {
      for (let i = 0; i < loop.count; i++) {
        const t = now * loop.speed + (Math.PI * 2 / loop.count) * i + li * .85;
        const ex = loop.rx * Math.cos(t), ey = loop.ry * Math.sin(t);
        const cr = Math.cos(loop.rot), sr = Math.sin(loop.rot);
        const x = c.x + ex * cr - ey * sr;
        const y = c.y + ex * sr + ey * cr;
        ctx.globalAlpha = (.32 + ((i + li) % 3) * .09) * strength;
        ctx.fillStyle = loop.color;
        ctx.beginPath();
        ctx.arc(x, y, 1.4 + (i % 2) * .55, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = .12 * strength;
        ctx.beginPath();
        ctx.arc(x, y, 5.8, 0, Math.PI * 2);
        ctx.fill();
        if ((i + li) % 3 === 0) {
          ctx.globalAlpha = .065 * strength;
          ctx.strokeStyle = loop.color;
          ctx.lineWidth = .72;
          ctx.beginPath();
          ctx.moveTo(c.x, c.y);
          ctx.lineTo(x, y);
          ctx.stroke();
        }
      }
    });
    ctx.globalAlpha = .16 * strength;
    ctx.fillStyle = '#ef2633';
    ctx.beginPath();
    ctx.arc(c.x, c.y, 3.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawAtom(c, now, strength = 1) {
    const rings = [
      { rx: 92, ry: 28, rot: .30, speed: .00035, color: palette[0] },
      { rx: 90, ry: 27, rot: 2.23, speed: -.00029, color: palette[4] },
      { rx: 88, ry: 25, rot: 1.34, speed: .00024, color: palette[5] }
    ];
    ctx.save();
    ctx.lineWidth = .75;
    rings.forEach((r, i) => {
      ctx.globalAlpha = .14 * strength;
      ctx.strokeStyle = r.color;
      ctx.beginPath(); ctx.ellipse(c.x, c.y, r.rx, r.ry, r.rot, 0, Math.PI * 2); ctx.stroke();
      const t = now * r.speed + i * 2.1;
      const ex = r.rx * Math.cos(t), ey = r.ry * Math.sin(t);
      const cr = Math.cos(r.rot), sr = Math.sin(r.rot);
      const x = c.x + ex * cr - ey * sr, y = c.y + ex * sr + ey * cr;
      ctx.globalAlpha = .88 * strength; ctx.fillStyle = r.color;
      ctx.beginPath(); ctx.arc(x, y, 2.5, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = .10 * strength;
      ctx.beginPath(); ctx.arc(x, y, 7.5, 0, Math.PI * 2); ctx.fill();
    });
    ctx.restore();
  }

  function serviceColor(el, index = 0) {
    if (!el) return palette[index % palette.length];
    const category = el.dataset?.universe;
    if (category && categoryColors[category]) return categoryColors[category];
    const siblings = el.parentElement ? [...el.parentElement.querySelectorAll('button')] : [];
    const idx = siblings.indexOf(el);
    return palette[(idx >= 0 ? idx : index) % palette.length];
  }

  function drawDomNetwork(scene, now) {
    if (scene === 'home') {
      const c = centerOf(document.getElementById('introLogo'), w * .5, h * .5);
      drawMagneticCloud(c, now, clamp(homeVis * 1.15));
      const nodes = [...document.querySelectorAll('.orbita-home-node')].filter(visible);
      nodes.forEach((el, i) => {
        const p = centerOf(el);
        drawRail(c, p, .11 + (i % 2) * .022, .72, homeColor(el, i), (i % 2 ? .042 : -.042));
      });
      if (hovered && hovered.matches?.('.orbita-home-node')) drawFan(c, centerOf(hovered), .92, homeColor(hovered));
      return;
    }

    const c = centerOf(universeCore, w * .51, h * .52);
    drawAtom(c, now, clamp(universeVis * 1.25));
    const categoryNodes = [...document.querySelectorAll('.pbj-universe-node')].filter(visible);
    const serviceNodes = [...document.querySelectorAll('.pbj-universe-elements button')].filter(visible);
    const nodes = serviceNodes.length ? serviceNodes : categoryNodes;
    nodes.forEach((el, i) => {
      const color = serviceColor(el, i);
      const bend = ((i % 3) - 1) * .045 + (i % 2 ? .018 : -.018);
      drawRail(c, centerOf(el), serviceNodes.length ? .24 : .20, serviceNodes.length ? .92 : .82, color, bend);
    });
    if (hovered && (hovered.matches?.('.pbj-universe-node') || hovered.matches?.('.pbj-universe-elements button'))) {
      drawFan(c, centerOf(hovered), .90, serviceColor(hovered));
    }
  }

  function updateMagneticCore(now) {
    if (!universeCore) return;
    const c = centerOf(universeCore, w * .5, h * .5);
    const dx = pointer.x - c.x, dy = pointer.y - c.y;
    const dist = pointer.active ? Math.hypot(dx, dy) : 9999;
    const awake = universeVis > .04 && dist < Math.min(340, w * .28);
    const pull = awake ? clamp(1 - dist / Math.min(340, w * .28)) : 0;
    magnetic.tx = awake ? clamp(dx * .055 * pull, -13, 13) : 0;
    magnetic.ty = awake ? clamp(dy * .055 * pull, -11, 11) : 0;
    magnetic.try = awake ? clamp(dx / 36, -7, 7) * pull : 0;
    magnetic.trx = awake ? clamp(-dy / 42, -6, 6) * pull : 0;
    magnetic.x = lerp(magnetic.x, magnetic.tx + Math.sin(now * .00125) * 1.35, .095);
    magnetic.y = lerp(magnetic.y, magnetic.ty + Math.cos(now * .00108) * 1.15, .095);
    magnetic.rx = lerp(magnetic.rx, magnetic.trx, .10);
    magnetic.ry = lerp(magnetic.ry, magnetic.try, .10);
    universeCore.style.setProperty('--mag-x', `${magnetic.x.toFixed(2)}px`);
    universeCore.style.setProperty('--mag-y', `${magnetic.y.toFixed(2)}px`);
    universeCore.style.setProperty('--tilt-x', `${magnetic.rx.toFixed(2)}deg`);
    universeCore.style.setProperty('--tilt-y', `${magnetic.ry.toFixed(2)}deg`);
    universeCore.classList.toggle('is-core-hot', awake && pull > .12);
  }

  function updateMagneticHome(now) {
    if (!introLogo) return;
    const c = centerOf(introLogo, w * .5, h * .5);
    const dx = pointer.x - c.x, dy = pointer.y - c.y;
    const dist = pointer.active ? Math.hypot(dx, dy) : 9999;
    const awake = homeVis > .08 && dist < Math.min(390, w * .30);
    const pull = awake ? clamp(1 - dist / Math.min(390, w * .30)) : 0;
    homeMagnetic.tx = awake ? clamp(dx * .038 * pull, -11, 11) : 0;
    homeMagnetic.ty = awake ? clamp(dy * .038 * pull, -9, 9) : 0;
    homeMagnetic.try = awake ? clamp(dx / 48, -5, 5) * pull : 0;
    homeMagnetic.trx = awake ? clamp(-dy / 54, -4, 4) * pull : 0;
    homeMagnetic.x = lerp(homeMagnetic.x, homeMagnetic.tx + Math.sin(now * .0011) * .8, .09);
    homeMagnetic.y = lerp(homeMagnetic.y, homeMagnetic.ty + Math.cos(now * .0010) * .7, .09);
    homeMagnetic.rx = lerp(homeMagnetic.rx, homeMagnetic.trx, .10);
    homeMagnetic.ry = lerp(homeMagnetic.ry, homeMagnetic.try, .10);
    introLogo.style.setProperty('--home-mag-x', `${homeMagnetic.x.toFixed(2)}px`);
    introLogo.style.setProperty('--home-mag-y', `${homeMagnetic.y.toFixed(2)}px`);
    introLogo.style.setProperty('--home-tilt-x', `${homeMagnetic.rx.toFixed(2)}deg`);
    introLogo.style.setProperty('--home-tilt-y', `${homeMagnetic.ry.toFixed(2)}deg`);
    introLogo.classList.toggle('is-logo-hot', awake && pull > .10);
  }

  function frame(now) {
    raf = 0;
    const strength = clamp(Math.max(homeVis, universeVis));
    if (strength <= .008 || document.body.classList.contains('orbita-content-chapter')) {
      ctx.clearRect(0, 0, w, h);
      return;
    }
    ctx.clearRect(0, 0, w, h);
    const mix = roomMix();
    drawField(now, strength, mix);
    updateMagneticCore(now);
    updateMagneticHome(now);
    if (homeVis >= universeVis && homeVis > .05) drawDomNetwork('home', now);
    else if (universeVis > .05) drawDomNetwork('universe', now);
    if (!document.hidden) raf = requestAnimationFrame(frame);
  }

  function setHovered(el) {
    if (hovered === el) return;
    hovered?.classList?.remove('is-network-hot');
    hovered = el || null;
    hovered?.classList?.add('is-network-hot');
  }

  addEventListener('resize', resize, { passive: true });
  addEventListener('scroll', readScenes, { passive: true });
  if (finePointer) {
    addEventListener('pointermove', e => {
      pointer.x = e.clientX; pointer.y = e.clientY; pointer.active = true;
      const el = e.target?.closest?.('.orbita-home-node,.pbj-universe-node,.pbj-universe-elements button');
      setHovered(el);
    }, { passive: true });
    addEventListener('pointerleave', () => { pointer.active = false; setHovered(null); }, { passive: true });
    document.addEventListener('pointerout', e => {
      if (hovered && !e.relatedTarget?.closest?.('.orbita-home-node,.pbj-universe-node,.pbj-universe-elements button')) setHovered(null);
    }, { passive: true });
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { if (raf) cancelAnimationFrame(raf); raf = 0; }
    else { readScenes(); }
  });

  resize();
  readScenes();
})();
