const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.join(__dirname,'..');
const html=fs.readFileSync(path.join(root,'profil-pbj/index.html'),'utf8');
const js=fs.readFileSync(path.join(root,'assets/js/orbita-docs-timeline.js'),'utf8');
const ambient=fs.readFileSync(path.join(root,'assets/js/orbita-docs-ambient.js'),'utf8');
const css=fs.readFileSync(path.join(root,'assets/css/docs-timeline.css'),'utf8');

test('wheel zoom direction is camera-like and anchored to mouse timeline position',()=>{
  assert.match(js,/factor=Math\.exp\(-raw\*sensitivity\)/);
  assert.match(js,/timeRatio=clamp\(\(oldContentX-oldLayout\.edge\)/);
  assert.match(js,/newContentX=layout\.edge\+layout\.usable\*timeRatio/);
  assert.match(js,/queueZoom\(zoomTarget\*factor,e\.clientX\)/);
});

test('timeline stays draggable with inertia while event buttons remain clickable',()=>{
  assert.match(js,/vp\.addEventListener\('pointerdown'/);
  assert.match(js,/vp\.scrollLeft=drag\.left-dx/);
  assert.match(js,/drag\.velocity/);
  assert.match(js,/v\*=\.92/);
  assert.match(js,/e\.target\.closest\('button,a,input,select,textarea,iframe,\[data-doc-event\],\[data-doc-cluster\]'/);
});

test('documentation has subtle animated Dorot-like ambient background without a custom cursor',()=>{
  assert.match(html,/docsAmbientCanvas/);
  assert.match(html,/orbita-docs-ambient\.js\?v=27\.48/);
  assert.match(ambient,/requestAnimationFrame\(draw\)/);
  assert.match(ambient,/colors=\['#f3a1a5','#f0bf58','#b889b0','#d98b7b'\]/);
  assert.match(css,/docs-tl-ambient-canvas/);
  assert.doesNotMatch(css,/cursor:\s*none/i);
});
