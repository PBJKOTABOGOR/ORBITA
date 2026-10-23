'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const root=path.join(__dirname,'..');
const source=fs.readFileSync(path.join(root,'backend/Code-TRAXPBJ-Pemilihan.gs'),'utf8');
const frontend=fs.readFileSync(path.join(root,'assets/js/selection.js'),'utf8');
const user={user_id:'p1',role:'POKJA',pokja_id:'POKJA_A'};
function create(overrides={}){
  const req={request_id:'P-TEST',selection_process:'NEGOSIASI',assigned_pokja_id:'POKJA_A',status:'SIAP_PROSES_INAPROC',nego_stage:'SIAP_NEGOSIASI',pagu:100000000000,current_round:1,...overrides};
  const docs=[],audits=[];
  const c=vm.createContext({Date,Map,Set,console,JSON});vm.runInContext(source,c);
  c.req=req;c.docs=docs;c.audits=audits;c.docReads=0;
  vm.runInContext(`
    getRequestAuthorized_=function(u,id){if(id!==req.request_id)throw Error('Tidak ditemukan');if(u.role==='POKJA'&&u.pokja_id!==req.assigned_pokja_id)throw Error('Bukan Pokja');return req};
    getRequest_=function(){return req};
    updateRequest_=function(id,patch){Object.assign(req,patch)};
    currentDocs_=function(){docReads++;return docs.filter(d=>d.is_current!==false)};
    ensureRequestSchema_=function(){};
    audit_=function(u,a,id,detail){audits.push({a,id,detail})};
  `,c);
  const act=(step='HANDOVER',actor=user)=>vm.runInContext(`negoWorkflow_(${JSON.stringify(actor)},{requestId:'P-TEST',step:${JSON.stringify(step)}})`,c);
  const allowed=(type,actor=user)=>vm.runInContext(`negoDocAllowed_(${JSON.stringify(actor)},req,${JSON.stringify(type)})`,c);
  const addDoc=(type)=>docs.push({doc_type:type,is_current:true});
  return {act,allowed,addDoc,docs,req,c,audits};
}
test('Sesudah reviu: BA Reviu dan BA Evaluasi wajib untuk handover tanpa tahap perantara',()=>{
  const s=create();assert.throws(()=>s.act(),/Berita Acara Hasil Reviu/);
  s.addDoc('NEGO_BA_HASIL_REVIU');assert.throws(()=>s.act(),/Berita Acara Hasil Evaluasi/);
  s.addDoc('NEGO_BA_HASIL_EVALUASI');s.act();
  assert.equal(s.req.nego_stage,'HANDOVER');assert.ok(s.req.nego_handover_at);
  assert.deepEqual(s.audits.map(x=>x.a),['NEGO_HANDOVER']);
  assert.equal(s.c.docReads,3,'Masing-masing percobaan memeriksa semua BA dalam satu pembacaan');
});
test('Pagu tepat Rp100 miliar cukup dua BA, pagu di atasnya wajib Surat Penetapan',()=>{
  const standard=create();standard.addDoc('NEGO_BA_HASIL_REVIU');standard.addDoc('NEGO_BA_HASIL_EVALUASI');standard.act();assert.equal(standard.req.nego_stage,'HANDOVER');
  const big=create({pagu:100000000001});big.addDoc('NEGO_BA_HASIL_REVIU');big.addDoc('NEGO_BA_HASIL_EVALUASI');assert.throws(()=>big.act(),/Surat Penetapan Pemenang PA\/KPA/);
  big.addDoc('NEGO_SURAT_PENETAPAN_PA_KPA');big.act();assert.equal(big.req.nego_stage,'HANDOVER');
});
test('Dokumen yang sudah dicabut tidak memenuhi syarat handover',()=>{
  const s=create();s.addDoc('NEGO_BA_HASIL_REVIU');s.addDoc('NEGO_BA_HASIL_EVALUASI');s.docs[0].is_current=false;
  assert.throws(()=>s.act(),/Berita Acara Hasil Reviu/);
});
test('Bisa mengunggah ketiga dokumen setelah reviu, tidak selama reviu dan tidak setelah handover',()=>{
  const s=create({status:'REVIU_POKJA',nego_stage:''});assert.equal(s.allowed('NEGO_BA_HASIL_REVIU'),false);
  assert.equal(s.allowed('NEGO_BA_HASIL_EVALUASI'),false);assert.throws(()=>s.allowed('NEGO_BA_HASIL_REVIU',{role:'PPK'}));
  assert.throws(()=>s.act('HANDOVER',{role:'POKJA',pokja_id:'POKJA_B'}),/Bukan Pokja/);
  s.req.status='SIAP_PROSES_INAPROC';s.req.nego_stage='SIAP_NEGOSIASI';
  for(const type of ['NEGO_BA_HASIL_REVIU','NEGO_BA_HASIL_EVALUASI','NEGO_SURAT_PENETAPAN_PA_KPA'])assert.equal(s.allowed(type),true);
  s.req.nego_stage='HANDOVER';assert.equal(s.allowed('NEGO_BA_HASIL_REVIU'),false);
});
test('Paket yang terlanjur melewati MULAI/HASIL versi lama tetap dapat handover langsung',()=>{
  for(const stage of ['NEGOSIASI','HASIL_NEGOSIASI']){
    const s=create({nego_stage:stage});s.addDoc('NEGO_BA_HASIL_REVIU');s.addDoc('NEGO_BA_HASIL_EVALUASI');s.act();assert.equal(s.req.nego_stage,'HANDOVER');
  }
});
test('Proses negosiasi lama tetap tercatat; Mini Kompetisi dan INAPROC tetap terpisah',()=>{
  const s=create({selection_process:'MINI_KOMPETISI'});assert.throws(()=>s.act(),/hanya untuk Negosiasi/);
  s.req.selection_process='NEGOSIASI';s.req.nego_stage='SIAP_NEGOSIASI';assert.equal(vm.runInContext('reportEligible_(req)',s.c),false);
  s.req.nego_stage='HANDOVER';assert.equal(vm.runInContext('reportEligible_(req)',s.c),true);
  s.req.nego_stage='';assert.equal(vm.runInContext('reportEligible_(req)',s.c),true);
  assert.match(source,/purpose==='NEGO_DOCUMENT'/);assert.match(source,/Dokumen Negosiasi harus PDF maksimal 10 MB/);
  assert.match(frontend,/data-nego-doc/);assert.match(frontend,/accept="\.pdf"/);
  assert.match(frontend,/ORBITA hanya menampilkan pengingat dan tidak membatalkan paket/);
});
