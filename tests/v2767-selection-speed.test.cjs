const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const ROOT=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(ROOT,p),'utf8');

test('login uses fast backend path and keeps token',()=>{
  const api=read('assets/js/selection-api.js');
  assert.match(api,/login',\{username,password,fast:true\}/);
  const gs=read('backend/Code-TRAXPBJ-Pemilihan.gs');
  assert.match(gs,/if\(truthy_\(payload\.fast\)\)return \{token:rawToken,data:publicUser_\(hit\.obj\),fast:true\}/);
});

test('upload progress is throttled and polling yields during uploads',()=>{
  const api=read('assets/js/selection-api.js');
  const ui=read('assets/js/selection.js');
  assert.match(api,/pct-lastPct>=2\|\|now-lastProgressAt>=120/);
  assert.match(ui,/\|\|uploading\(\)\|\|anyDocUploading\(\)\|\|userIsInteracting\(\)\)return/);
  assert.match(ui,/innerWidth<=760,ms=compact\?9000:6000/);
});

test('backend caches short lived auth and doc config',()=>{
  const gs=read('backend/Code-TRAXPBJ-Pemilihan.gs');
  assert.match(gs,/pbj_sess_/);
  assert.match(gs,/cacheSession_\(rawToken,u\.obj,hit\.obj\.expires_at\)/);
  assert.match(gs,/pbj_doc_config_active_v1/);
  assert.match(gs,/clearDocConfigCache_\(\)/);
});

test('frontend cache versions bumped',()=>{
  const html=read('profil-pbj/index.html');
  const sw=read('sw.js');
  assert.match(html,/selection-api\.js\?v=27\.67/);
  assert.match(html,/portal-session\.js\?v=27\.67/);
  assert.match(html,/selection\.js\?v=27\.67/);
  assert.match(sw,/v27-67-selection-speed/);
});
