const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.join(__dirname,'..');
const profile=fs.readFileSync(path.join(root,'assets/js/profile.js'),'utf8');
const html=fs.readFileSync(path.join(root,'profil-pbj/index.html'),'utf8');
const sw=fs.readFileSync(path.join(root,'sw.js'),'utf8');

test('topbar back no longer depends on history state for advocacy modules',()=>{
  assert.match(profile,/data-orbita-force-profile-home/);
  assert.match(profile,/history\.replaceState\(\{traxProfileHome:true\}[\s\S]*?#home/);
  assert.match(profile,/location\.reload\(\)/);
  assert.match(profile,/stopImmediatePropagation\(\)/);
});

test('all internal topbar destinations arm a concrete back button',()=>{
  for(const selector of ['data-close-evaluation','data-close-docs','data-close-sdm','data-close-forum','educationExperience','knowledgeExperience','data-close-procurement']) assert.match(profile,new RegExp(selector));
  assert.match(profile,/armTopbarBack\('service',action\)/);
  assert.match(profile,/armTopbarBack\('control',action\)/);
});

test('internal universe navigation disarms the forced topbar return',()=>{
  assert.match(profile,/disarmTopbarBack\('service',action\)/);
});

test('v27.38 cache busting is wired',()=>{
  assert.match(html,/profile\.js\?v=27\.(?:38|58|59)/);
  assert.match(html,/advocacy-portal\.js\?v=27\.(?:38|56)/);
  assert.match(sw,/v27-(?:38-hard-home-back|50-docs-unified-five-lines|54-docs-hover-surat-preview|55-surat-action-only|56-edukasi-doc|57-constellation-bg|58-constellation-interactive|59-atomic-room)/);
});
