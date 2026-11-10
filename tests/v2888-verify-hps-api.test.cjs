'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'..');
const backend=fs.readFileSync(path.join(root,'backend/Code-TRAXPBJ-Pemilihan.gs'),'utf8');
const ui=fs.readFileSync(path.join(root,'assets/js/selection.js'),'utf8');
const fn=backend.slice(backend.indexOf('function verifyRequestHps_('),backend.indexOf('function requestDetail_(',backend.indexOf('function verifyRequestHps_(')));
function runBackend(ids,denied){
 const db={getRange(row,col){assert.equal(col,76);return {getValue(){return row===8?574230000:0}};}};
 const context={PBJWF:{SHEETS:{REQUESTS:'PBJ_PERMOHONAN'}},sheet_:()=>db,headers_:()=>Array.from({length:77},(_,i)=>i===75?'hps_alokasi':'col'+i),
 getRequestHitAuthorized_(_u,id){if(denied&&id===denied)throw Error('Tidak berhak');return {row:8,obj:{updated_at:'2026-11-09T07:52:51Z'}}},
 pbjResolveRow_:(_sh,row)=>({sheet:db,row})};
 vm.runInNewContext(fn+';this.verify=verifyRequestHps_;',context);
 return context.verify({role:'ADMIN'}, {requestIds:ids});
}
test('Verifikasi hanya membaca sel HPS fisik, bukan pagu atau cache daftar',()=>{
 const r=runBackend(['P-68098206-01']);assert.equal(r.items[0].hps_alokasi,574230000);assert.equal(r.items[0].request_id,'P-68098206-01');
});
test('Verifikasi tetap memeriksa hak akses paket',()=>assert.throws(()=>runBackend(['P-68098206-01'],'P-68098206-01'),/Tidak berhak/));
test('Batas batch verifikasi 12 dan tidak menerima input kosong',()=>{
 const ids=Array.from({length:17},(_,i)=>'P-'+String(i+10000)+'-01');assert.equal(runBackend(ids).items.length,12);
 assert.throws(()=>runBackend(['']),/valid/);
});
test('Frontend menggunakan verifikasi hanya untuk HPS kosong',()=>{
 assert.match(ui,/if\(!id\|\|seen\.has\(id\)\|\|displayHps\(r\)>0/);
 assert.match(ui,/API\(\)\.call\('verifyRequestHps'/);
 assert.match(ui,/const check=verifiedHps\.get/);
 assert.match(ui,/renderPreservingPosition\(\)/);
});
test('Versi frontend/service worker dan backend telah diperbarui',()=>{
 const html=fs.readFileSync(path.join(root,'profil-pbj/index.html'),'utf8');const sw=fs.readFileSync(path.join(root,'sw.js'),'utf8');
 assert.match(html,/selection\.js\?v=28\.88/);assert.match(sw,/selection\.js\?v=28\.88/);assert.match(sw,/shell-v28-88/);
 assert.match(backend,/version:'28\.88-PRODUKSI-HPS'/);
});
