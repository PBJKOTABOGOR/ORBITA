const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.join(__dirname,'..');
const profile=fs.readFileSync(path.join(root,'assets/js/profile.js'),'utf8');
const forum=fs.readFileSync(path.join(root,'assets/js/forum.js'),'utf8');
const control=fs.readFileSync(path.join(root,'assets/js/control-room.js'),'utf8');
const evaluation=fs.readFileSync(path.join(root,'assets/js/evaluation.js'),'utf8');
const advocacy=fs.readFileSync(path.join(root,'assets/js/advocacy-portal.js'),'utf8');
const content=fs.readFileSync(path.join(root,'assets/js/site-content.js'),'utf8');
const controlCss=fs.readFileSync(path.join(root,'assets/css/control-room.css'),'utf8');
const profileCss=fs.readFileSync(path.join(root,'assets/css/profile.css'),'utf8');
const sw=fs.readFileSync(path.join(root,'sw.js'),'utf8');

test('topbar source is consumed explicitly so module back always returns profile home',()=>{
  assert.match(profile,/TRAXPBJ_CONSUME_TOPBAR_ENTRY/);
  for(const src of [forum,control,evaluation,advocacy]){
    assert.match(src,/fromTopbar:window\.TRAXPBJ_CONSUME_TOPBAR_ENTRY/);
    assert.match(src,/TRAXPBJ_RETURN_PROFILE_HOME/);
  }
});

test('Tim PBJ vertical scrolling maps deterministically to horizontal position',()=>{
  assert.match(content,/const progress=clamp01\(-rect\.top\/range\)/);
  assert.match(content,/rail\.scrollLeft=max\*progress/);
  assert.match(profileCss,/height:calc\(100vh \+ var\(--team-scroll-travel,1200px\)\)/);
  assert.doesNotMatch(content,/teamAutoFrame/);
});

test('Permohonan Pemilihan is visually standalone from other procurement modules',()=>{
  assert.match(control,/syncRoomHeading/);
  assert.match(controlCss,/body\.proc-selection-open \.proc-filter-bar,body\.proc-selection-open \.proc-module-nav\{display:none!important\}/);
  assert.match(controlCss,/body\.proc-selection-open \.proc-room-content/);
});

test('v27.34 service worker caches the updated profile assets',()=>{
  assert.match(sw,/orbita-pbj-shell-v27-(?:34-back-team-selection|38-hard-home-back|49-docs-hub-surat|50-docs-unified-five-lines|54-docs-hover-surat-preview|55-surat-action-only|56-edukasi-doc|57-constellation-bg|58-constellation-interactive|59-atomic-room)/);
  assert.match(sw,/profile\.css\?v=27\.(?:34|56|57|58|59)/);
  assert.match(sw,/site-content\.js\?v=27\.34/);
  assert.match(sw,/control-room\.js\?v=27\.(?:34|37|38)/);
});
