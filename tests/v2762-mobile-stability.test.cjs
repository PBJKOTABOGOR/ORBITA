const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const html=read('profil-pbj/index.html');
const css=read('assets/css/profile.css');
const profile=read('assets/js/profile.js');
const motion=read('assets/js/pbj-motion.js');
const sections=read('assets/js/orbita-section-motion.js');
const sw=read('sw.js');

test('mobile topbar has a real navigation button and destination scrolling no longer hides the topbar',()=>{
  assert.match(html,/id="chapterButton"[\s\S]*aria-label="Buka menu navigasi"/);
  assert.match(css,/\.mobile-chapter-button\{display:none!important\}/);
  assert.match(css,/@media\(max-width:980px\)[\s\S]*\.mobile-chapter-button[\s\S]*display:grid!important/);
  assert.doesNotMatch(css,/body\.topnav-destination-active \.topbar,/);
});

test('mobile Ruang PBJ is immediately formed when opened from Home',()=>{
  assert.match(profile,/const compactReady=innerWidth<=900/);
  assert.match(profile,/const visualP=compactReady\?Math\.max\(\.24,p\):p/);
  assert.match(profile,/classList\.toggle\('is-settled',visualP>\.22\)/);
});

test('particle canvas is suspended outside Home and Ruang PBJ',()=>{
  assert.match(profile,/orbita-content-chapter/);
  assert.match(css,/body\.orbita-content-chapter \.pbj-motion-canvas/);
  assert.match(motion,/document\.body\.classList\.contains\('orbita-content-chapter'\)/);
  assert.match(motion,/if \(homeVis <= \.008 && universeVis <= \.008\)/);
});

test('mobile constellation is significantly lighter than desktop',()=>{
  assert.match(motion,/compact \? \(w < 520 \? 38 : 48\)/);
  assert.match(motion,/compact \? 1 : 1\.35/);
  assert.match(motion,/if \(finePointer\)/);
});

test('ITKP Data and Rapor pointer motion is rAF-throttled and disabled on touch',()=>{
  assert.match(sections,/finePointer = matchMedia\('\(hover: hover\) and \(pointer: fine\)'\)/);
  assert.match(sections,/requestAnimationFrame\(paintPointer\)/);
  assert.doesNotMatch(sections,/scene\.addEventListener\('pointermove'/);
});

test('expensive mobile ITKP and Rapor continuous animations are disabled',()=>{
  assert.match(css,/@media\(max-width:980px\)[\s\S]*\.score-orbit,\.score-wave i,\.rapor-ambient span,\.history-viz \.hist-line\{animation:none!important\}/);
  assert.match(css,/\.rapor-ambient\{display:none!important\}/);
  assert.match(css,/\.rapor-card,\.rapor-period,\.rapor-img-link span\{backdrop-filter:none!important/);
});

test('full-section live gradients were replaced with small compositor spotlights',()=>{
  assert.match(css,/#itkp:after,#rekam:after,#rapor-kota:after/);
  assert.match(css,/transform:translate3d\(calc\(var\(--scene-px/);
  assert.match(css,/\.itkp-scene\{\s*background:[\s\S]*linear-gradient\(180deg,#fbfdfd 0%,#f1f7f9 100%\)!important/);
  assert.match(css,/\.rapor-scene\{\s*background:[\s\S]*linear-gradient\(180deg,#071c2f 0%,#0a2740 55%,#061827 100%\)!important/);
});

test('v27.62 cache busting is complete',()=>{
  assert.match(html,/profile\.css\?v=27\.62/);
  assert.match(html,/pbj-motion\.js\?v=27\.62/);
  assert.match(html,/orbita-section-motion\.js\?v=27\.62/);
  assert.match(sw,/orbita-pbj-shell-v27-62-mobile-stability/);
  assert.match(sw,/profile\.css\?v=27\.62/);
});
