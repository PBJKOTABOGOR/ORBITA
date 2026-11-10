'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const api=fs.readFileSync(path.join(root,'assets/js/selection-api.js'),'utf8');
const ui=fs.readFileSync(path.join(root,'assets/js/selection.js'),'utf8');
const html=fs.readFileSync(path.join(root,'profil-pbj/index.html'),'utf8');
const sw=fs.readFileSync(path.join(root,'sw.js'),'utf8');
const backend=fs.readFileSync(path.join(root,'backend/Code-TRAXPBJ-Pemilihan.gs'),'utf8');

// Uji jalur API sebenarnya: verifikasi HARUS baca, tidak mengubah revision atau mengumumkan perubahan data.
test('verifyRequestHps tidak menaikkan writeVersion atau menyiarkan aksi tulis',async()=>{
  const session=new Map([['traxpbj_selection_token','SESSION_TEST']]);
  const dispatch=[];
  const ctx={window:{TRAXPBJ_SELECTION_CONFIG:{apiUrl:'https://example.test/exec'}},sessionStorage:{getItem:k=>session.get(k)||'',setItem:(k,v)=>session.set(k,v),removeItem:k=>session.delete(k)},
    document:{dispatchEvent:v=>dispatch.push(v)},CustomEvent:class{constructor(type,detail){this.type=type;this.detail=detail}},BroadcastChannel:undefined,
    AbortController,Error,Map,Set,JSON,fetch:async(_url,options)=>{assert.equal(JSON.parse(options.body).action,'verifyRequestHps');return {text:async()=>JSON.stringify({ok:true,data:{items:[{request_id:'P-68098206-01',hps_alokasi:574230000}]}})}},setTimeout,clearTimeout,Promise,FileReader:class{},XMLHttpRequest:class{}};
  vm.runInNewContext(api,ctx);
  const driver=ctx.window.TRAXPBJ_SELECTION_API,rev=driver.writeVersion();
  const received=await driver.call('verifyRequestHps',{requestIds:['P-68098206-01']});
  assert.equal(received.data.items[0].hps_alokasi,574230000);
  assert.equal(driver.writeVersion(),rev);
  assert.equal(driver.isWriting(),false);
  assert.equal(dispatch.length,0);
});
test('Saat verifikasi sukses, nilai HPS masuk ke state daftar dan detail, tanpa mengambil dari pagu',()=>{
  assert.match(ui,/state\.requests=state\.requests\.map\(r=>\{/);
  assert.match(ui,/request:\{\.\.\.state\.detail\.request,hps_alokasi:amount\}/);
  assert.match(ui,/if\(!ids\.includes\(id\)\|\|!Number\.isSafeInteger\(amount\)\|\|amount<=0\)return/);
  assert.match(ui,/clearBootCache\(\);if\(\['requests','detail'\]/);
  assert.match(ui,/HPS DIAJUKAN<\/span><b>\$\{displayHps\(r\)>0\?/);
});
test('Perubahan frontend mempunyai versi cache tersendiri; backend pemilihan tidak diubah',()=>{
  assert.match(html,/selection-api\.js\?v=28\.89/);
  assert.match(html,/selection\.js\?v=28\.89/);
  assert.match(sw,/shell-v28-89-hps-sinkron/);
  assert.match(sw,/selection-api\.js\?v=28\.89/);
  assert.match(backend,/version:'28\.88-PRODUKSI-HPS'/);
});
