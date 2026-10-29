const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const html=fs.readFileSync(path.join(root,'profil-pbj','index.html'),'utf8');
const css=fs.readFileSync(path.join(root,'assets','css','profile.css'),'utf8');
const js=fs.readFileSync(path.join(root,'assets','js','profile.js'),'utf8');

test('mobile topbar exposes the desktop chapter destinations',()=>{
  assert.match(html,/mobile-inline-nav/);
  for(const href of ['#home','#ruang-pbj','#itkp','#rekam','#rapor-kota']) assert.match(html,new RegExp(`href="${href}"`));
  assert.match(css,/\.mobile-inline-nav\{[\s\S]*display:none/);
  assert.match(css,/@media\(max-width:980px\)[\s\S]*\.mobile-inline-nav\{[\s\S]*display:flex!important/);
});

test('mobile Ruang PBJ has a hard light-background failsafe and immediate reveal',()=>{
  assert.match(css,/#ruang-pbj\.pbj-universe-scene,[\s\S]*background:#fbfbf8!important/);
  assert.match(css,/#ruang-pbj \.pbj-universe-node\{[\s\S]*opacity:\.78!important/);
  assert.match(js,/forceMobileUniverseReady/);
  assert.match(js,/classList\.add\('is-formed','is-settled'\)/);
});
