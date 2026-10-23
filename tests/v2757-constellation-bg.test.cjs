const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.join(__dirname,'..');
const html=fs.readFileSync(path.join(root,'profil-pbj/index.html'),'utf8');
const css=fs.readFileSync(path.join(root,'assets/css/profile.css'),'utf8');
const motion=fs.readFileSync(path.join(root,'assets/js/pbj-motion.js'),'utf8');
const sw=fs.readFileSync(path.join(root,'sw.js'),'utf8');

test('constellation engine stays lightweight across v27.58+ visual revisions',()=>{
  assert.match(html,/pbj-motion\.js\?v=27\.(?:58|59)/);
  assert.match(html,/profile\.css\?v=27\.(?:58|59)/);
  assert.match(motion,/nearest-neighbour graph|const pointCount/);
  assert.match(motion,/pointer\.active/);
  assert.match(motion,/drawDomNetwork/);
  assert.doesNotMatch(html,/three\.js|webgl|gsap/i);
});

test('Home keeps the dark constellation while Ruang PBJ can evolve independently without heavy 3D libraries',()=>{
  assert.match(css,/ORBITA v27\.58 · interactive constellation home \+ Ruang PBJ/);
  assert.match(css,/--orbita-black:#050606/);
  assert.match(css,/\.pbj-intro\{[\s\S]*background:var\(--orbita-black\)!important/);
  assert.match(css,/\.pbj-universe-scene\{/);
  assert.match(css,/typography nodes instead of floating cards/);
});

test('service worker cache is bumped for the interactive constellation revision',()=>{
  assert.match(sw,/orbita-pbj-shell-v27-(?:58-constellation-interactive|59-atomic-room)/);
  assert.match(sw,/profile\.css\?v=27\.(?:58|59)/);
  assert.match(sw,/pbj-motion\.js\?v=27\.(?:58|59)/);
  assert.match(sw,/profile\.js\?v=27\.(?:58|59)/);
});
