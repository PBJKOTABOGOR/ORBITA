'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.resolve(__dirname,'..');
const ui=fs.readFileSync(path.join(root,'assets/js/selection.js'),'utf8');
const css=fs.readFileSync(path.join(root,'assets/css/selection.css'),'utf8');
const backend=fs.readFileSync(path.join(root,'backend/Code-TRAXPBJ-Pemilihan.gs'),'utf8');
const page=fs.readFileSync(path.join(root,'profil-pbj/index.html'),'utf8');
const sw=fs.readFileSync(path.join(root,'sw.js'),'utf8');
test('Catatan Pokja Kaji Ulang muncul pada balasan PPK tanpa permintaan data tambahan',()=>{
 assert.match(ui,/const pokjaKajiNote=String\(r\.kaji_ulang_note\|\|previousKaji\?\.note\|\|''\)/);
 assert.match(ui,/sel-pokja-correction/);
 assert.match(ui,/Catatan perbaikan Pokja/);
 assert.match(ui,/esc\(pokjaKajiNote\)/);
 assert.match(css,/\.sel-app \.sel-pokja-correction/);
});
test('Kirim ulang Kaji Ulang tanpa catatan ditolak dari backend, tanpa mengubah status',()=>{
 const c=vm.createContext({console,Date,Math,JSON,String});
 vm.runInContext(backend,c);
 const req={request_id:'P-123-01',status:'PERLU_PERBAIKAN_PPK',workflow_scheme:'KAJI_ULANG_2026',current_round:1};
 const events=[],notes=[];
 c.requireRole_=()=>{};c.getRequestAuthorized_=()=>req;c.assertDocsComplete_=()=>{};
 c.appendNote_=(_u,id,phase,status,note)=>notes.push({id,phase,status,note});
 c.updateRequest_=(_id,patch)=>Object.assign(req,patch);c.audit_=(_u,action)=>events.push(action);
 c.notifyPokjaStatus_=()=>{};c.getRequest_=()=>req;c.publicRequest_=()=>({...req});
 const ppk={role:'PPK',user_id:'ppk'};
 assert.throws(()=>c.resubmitRevision_(ppk,{requestId:req.request_id,note:'  '}),/Catatan PPK.*wajib/i);
 assert.equal(req.status,'PERLU_PERBAIKAN_PPK');assert.equal(notes.length,0);assert.equal(events.length,0);
 const result=c.resubmitRevision_(ppk,{requestId:req.request_id,note:'Revisi KAK sudah dilengkapi.'});
 assert.equal(result.status,'REVIU_ULANG');assert.equal(req.current_round,2);
 assert.equal(notes.at(-1).note,'Revisi KAK sudah dilengkapi.');
 assert.equal(events.at(-1),'RESUBMIT_KAJI_REVISION');
});
test('Surat Undangan dan BA menggunakan komponen dokumen yang sama',()=>{
 assert.match(ui,/class="sel-mini-document sel-invite-sent"/);
 assert.match(ui,/class="sel-mini-document-actions"><a href="\$\{esc\(old\.drive_url\)\}"/);
 assert.match(css,/\.sel-app \.sel-invite-sent\.sel-mini-document b\{font-size:12px/);
 assert.match(css,/\.sel-app \.sel-invite-sent\.sel-mini-document a\{font-size:11px/);
 assert.match(ui,/function canResendKajiInvitation/);
});
test('Hanya aset pemilihan versi baru dimuat tanpa mengubah versi aset lain',()=>{
 assert.match(page,/selection\.js\?v=28\.(?:31|32|33|36|37|42)/);
 assert.match(page,/selection\.css\?v=28\.(?:31|32|33|36|38)/);
 assert.match(sw,/orbita-pbj-shell-v28-(?:31|32|33|36|37|42)/);
});
