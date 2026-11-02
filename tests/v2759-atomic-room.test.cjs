const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.join(__dirname,'..');
const html=fs.readFileSync(path.join(root,'profil-pbj/index.html'),'utf8');
const css=fs.readFileSync(path.join(root,'assets/css/profile.css'),'utf8');
const js=fs.readFileSync(path.join(root,'assets/js/profile.js'),'utf8');
const motion=fs.readFileSync(path.join(root,'assets/js/pbj-motion.js'),'utf8');
const sw=fs.readFileSync(path.join(root,'sw.js'),'utf8');

test('Ruang PBJ stays light while only Home uses dark navigation chrome',()=>{
  assert.match(js,/orbita-dark-chapter',no==='01'/);
  assert.match(js,/orbita-room-chapter',no==='02'/);
  assert.match(css,/--orbita-room-paper:#fbfbf8/);
  assert.match(css,/\.pbj-universe-scene\{[\s\S]*background:var\(--orbita-room-paper\)!important/);
  assert.match(css,/body\.orbita-room-chapter \.topbar/);
});

test('legacy blue LPSE service cards are explicitly removed at service-open specificity',()=>{
  assert.match(css,/Kill the legacy blue 3D service cards/);
  assert.match(css,/\.pbj-universe-sticky\.service-open \.pbj-universe-elements button\{[\s\S]*background:transparent!important;[\s\S]*border:0!important;[\s\S]*box-shadow:none!important/);
  assert.match(css,/\.pbj-universe-sticky\.service-open \.pbj-service-connectors\{display:none!important\}/);
});

test('atomic constellation uses multiple colors and a magnetic interactive ORBITA nucleus',()=>{
  assert.match(motion,/const palette = \['#3978ff', '#12aee6', '#7a5cff', '#ee4f86', '#ff8a3d', '#27b878'/);
  assert.match(motion,/function drawAtom\(/);
  assert.match(motion,/function updateMagneticCore\(/);
  assert.match(motion,/--mag-x/);
  assert.match(css,/Magnetic nucleus/);
  assert.match(css,/orbitaOrbitA/);
  assert.match(css,/is-core-hot/);
});

test('v27.59 cache busts all profile animation assets',()=>{
  assert.match(html,/profile\.css\?v=27\.59/);
  assert.match(html,/profile\.js\?v=27\.59/);
  assert.match(html,/pbj-motion\.js\?v=27\.59/);
  assert.match(sw,/orbita-pbj-shell-v27-59-atomic-room/);
  assert.match(sw,/profile\.css\?v=27\.59/);
  assert.match(sw,/profile\.js\?v=27\.59/);
  assert.match(sw,/pbj-motion\.js\?v=27\.59/);
});
