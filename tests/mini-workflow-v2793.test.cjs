'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const base=path.join(__dirname,'..');
const source=fs.readFileSync(path.join(base,'backend/Code-TRAXPBJ-Pemilihan.gs'),'utf8');
const frontend=fs.readFileSync(path.join(base,'assets/js/selection.js'),'utf8');
const user={user_id:'pkj-user',role:'POKJA',pokja_id:'PKJ1'};
function sim(overrides={}){
 const req={request_id:'TEST1',competition_type:'NON_CONSTRUCTION',selection_process:'MINI_KOMPETISI',assigned_pokja_id:'PKJ1',status:'SIAP_PROSES_INAPROC',mini_stage:'SIAP_TAYANG',pagu:100000000000,current_round:1,mini_tayang_at:'',...overrides};
 const docs=[],audits=[],notes=[];
 const context=vm.createContext({console,Date,Set,Map,JSON});
 vm.runInContext(source,context);
 context.req=req;context.docs=docs;context.audits=audits;context.notes=notes;
 vm.runInContext(`
 getRequestAuthorized_=function(u,id){if(id!==req.request_id)throw Error('tidak ditemukan');if(u.role==='POKJA'&&u.pokja_id!==req.assigned_pokja_id)throw Error('bukan Pokja');return req};
 getRequest_=function(){return req};
 updateRequest_=function(id,patch){Object.assign(req,patch)};
 currentDocs_=function(){return docs.filter(d=>d.is_current!==false)};
 ensureRequestSchema_=function(){};
 audit_=function(u,a,id,detail){audits.push({a,id,detail})};
 appendNote_=function(u,id,phase,status,note){notes.push({phase,status,note})};
 `,context);
 const exec=(step,payload={})=>vm.runInContext(`miniWorkflow_(${JSON.stringify(user)},${JSON.stringify({requestId:'TEST1',step,...payload})})`,context);
 const addDoc=(type,at=new Date().toISOString())=>docs.push({doc_type:type,uploaded_at:at,is_current:true});
 return {exec,addDoc,req,docs,audits,notes,context};
}
test('penayangan memerlukan BA Hasil Reviu dan BA Persetujuan Pokja',()=>{
 const m=sim();assert.throws(()=>m.exec('TAYANG'),/(Berita Acara|BA) Hasil Reviu/);
 m.addDoc('BA_HASIL_REVIU');assert.throws(()=>m.exec('TAYANG'),/Berita Acara Persetujuan Pokja/);m.addDoc('BA_PERSETUJUAN_POKJA');m.exec('TAYANG');assert.equal(m.req.mini_stage,'TAYANG');assert.equal(m.req.status,'SIAP_PROSES_INAPROC');
});
test('perubahan perlu BA baru dan alasan, lalu tersimpan tanpa memindahkan tahapan',()=>{
 const m=sim({mini_stage:'TAYANG',mini_tayang_at:'2026-10-01T00:00:00.000Z',schedule_start_date:'2026-10-10',schedule_end_date:'2026-10-14',completion_date:'2026-11-01'});
 assert.throws(()=>m.exec('PERUBAHAN'),/Uraian perubahan/);
 assert.throws(()=>m.exec('PERUBAHAN',{note:'Perubahan jadwal'}),/Berita Acara Persetujuan/);
 m.addDoc('BA_PERSETUJUAN');m.exec('PERUBAHAN',{note:'Perpanjang jadwal',scheduleEndDate:'2026-10-16'});
 assert.equal(m.req.schedule_end_date,'2026-10-16');assert.equal(m.req.mini_stage,'TAYANG');
 assert.throws(()=>m.exec('PERUBAHAN',{note:'Ubah lagi'}),/Berita Acara Persetujuan/);
});
test('gagal kembali ke PPK tetapi batal adalah terminal',()=>{
 const make=()=>sim({mini_stage:'TAYANG',mini_tayang_at:'2026-10-01T00:00:00.000Z'});
 const a=make();a.exec('GAGAL',{note:'Tidak ada penawaran memenuhi syarat'});
 assert.equal(a.req.status,'PERLU_PERBAIKAN_PPK');assert.equal(a.req.mini_stage,'GAGAL');assert.equal(a.notes.length,1);
 const b=make();b.addDoc('BA_PEMBATALAN');b.exec('BATAL',{note:'Dibatalkan sesuai BA'});
 assert.equal(b.req.status,'BATAL');assert.equal(b.req.mini_stage,'BATAL');assert.throws(()=>b.exec('EVALUASI'),/belum dapat diproses/);
});
test('evaluasi dan handover batas pagu tepat 100 miliar',()=>{
 const m=sim({mini_stage:'TAYANG',mini_tayang_at:'2026-10-01T00:00:00.000Z'});
 m.exec('EVALUASI');assert.equal(m.req.mini_stage,'EVALUASI');assert.throws(()=>m.exec('HANDOVER'),/Berita Acara Hasil Evaluasi/);
 m.addDoc('BA_HASIL_EVALUASI');m.exec('HANDOVER');assert.equal(m.req.mini_stage,'HANDOVER');assert.ok(m.req.mini_handover_at);
 const big=sim({mini_stage:'EVALUASI',mini_tayang_at:'2026-10-01T00:00:00.000Z',pagu:100000000001});big.addDoc('BA_HASIL_EVALUASI');assert.throws(()=>big.exec('HANDOVER'),/Surat Penetapan Pemenang/);big.addDoc('SURAT_PENETAPAN_PA_KPA');big.exec('HANDOVER');assert.equal(big.req.mini_stage,'HANDOVER');
});
test('dokumen hanya diunggah oleh Pokja pada tahapan tepat',()=>{
 const m=sim({status:'REVIU_POKJA',mini_stage:''});
 assert.equal(vm.runInContext(`miniDocAllowed_(${JSON.stringify(user)},req,'BA_HASIL_REVIU')`,m.context),true);
 assert.equal(vm.runInContext(`miniDocAllowed_(${JSON.stringify(user)},req,'BA_PERSETUJUAN_POKJA')`,m.context),true);
 assert.equal(vm.runInContext(`miniDocAllowed_(${JSON.stringify(user)},req,'BA_HASIL_EVALUASI')`,m.context),false);
 assert.throws(()=>vm.runInContext(`miniDocAllowed_({role:'PPK'},req,'BA_HASIL_REVIU')`,m.context));
});
test('laporan INAPROC tetap berlaku untuk paket lama dan baru setelah handover',()=>{
 const m=sim();
 assert.equal(vm.runInContext('reportEligible_(req)',m.context),false);
 m.req.mini_stage='HANDOVER';assert.equal(vm.runInContext('reportEligible_(req)',m.context),true);
 m.req.mini_stage='';assert.equal(vm.runInContext('reportEligible_(req)',m.context),true);
 m.req.selection_process='NEGOSIASI';assert.equal(vm.runInContext('reportEligible_(req)',m.context),true);
});
test('frontend menyediakan pengingat tanpa pembatalan otomatis ORBITA',()=>{
 assert.match(frontend,/paling lambat 3 hari/);
 assert.match(frontend,/hanya pengingat dan tidak membatalkan paket di ORBITA/);
 assert.match(frontend,/data-mini-action="HANDOVER"/);
 assert.match(frontend,/data-mini-doc=/);
});
