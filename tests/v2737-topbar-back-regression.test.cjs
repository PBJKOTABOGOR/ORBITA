const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.join(__dirname,'..');
const read=f=>fs.readFileSync(path.join(root,f),'utf8');
const profile=read('assets/js/profile.js');
const advocacy=read('assets/js/advocacy-portal.js');
const forum=read('assets/js/forum.js');
const evaluation=read('assets/js/evaluation.js');
const control=read('assets/js/control-room.js');
const html=read('profil-pbj/index.html');
const sw=read('sw.js');

test('topbar destination is persisted by exact target instead of timing/history state only',()=>{
  assert.match(profile,/TOPBAR_RETURN_KEY='orbita:topbar-return'/);
  assert.match(profile,/sessionStorage\.setItem\(TOPBAR_RETURN_KEY/);
  assert.match(profile,/TRAXPBJ_SHOULD_RETURN_PROFILE_HOME/);
  for(const target of ['#sdm-pbj','#dokumentasi-pendampingan','#konsultasi-pbj','#kegiatan-pbj','#pengetahuan-pbj','#evaluasi-layanan','#pengelolaan-pbj']){
    assert.match(profile,new RegExp(target.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')));
  }
});

test('all Pembinaan & Advokasi back handlers consult the persisted topbar target',()=>{
  assert.match(profile,/TRAXPBJ_SHOULD_RETURN_PROFILE_HOME\?\.\('#sdm-pbj'\)/);
  assert.match(profile,/TRAXPBJ_SHOULD_RETURN_PROFILE_HOME\?\.\('#dokumentasi-pendampingan'\)/);
  assert.match(forum,/TRAXPBJ_SHOULD_RETURN_PROFILE_HOME\?\.\('#konsultasi-pbj'\)/);
  assert.match(advocacy,/TRAXPBJ_SHOULD_RETURN_PROFILE_HOME\?\.\(location\.hash\)/);
});

test('return-home clears stale origin and directly replaces the URL with #home',()=>{
  assert.match(profile,/clearTopbarTarget\(\)/);
  assert.match(profile,/history\.replaceState\(\{traxProfileHome:true\},'',location\.pathname\+location\.search\+'#home'\)/);
});

test('changed navigation scripts use current cache-busting URLs',()=>{
  assert.match(html,/profile\.js\?v=27\.(?:38|58|59)/);
  assert.match(html,/control-room\.js\?v=27\.38/);
  assert.match(html,/advocacy-portal\.js\?v=27\.(?:38|56)/);
  assert.match(html,/forum\.js\?v=27\.38/);
  assert.match(html,/evaluation\.js\?v=27\.38/);
  assert.match(sw,/profile\.js\?v=27\.(?:38|58|59)/);
  assert.match(sw,/advocacy-portal\.js\?v=27\.(?:38|56)/);
});

test('other internal modules also use persisted-origin fallback',()=>{
  assert.match(evaluation,/TRAXPBJ_SHOULD_RETURN_PROFILE_HOME/);
  assert.match(control,/TRAXPBJ_SHOULD_RETURN_PROFILE_HOME/);
});
