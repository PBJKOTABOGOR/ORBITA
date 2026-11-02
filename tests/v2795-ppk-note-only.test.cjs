const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.join(__dirname,'..');
const backend=fs.readFileSync(path.join(root,'backend/Code-TRAXPBJ-Pemilihan.gs'),'utf8');
const frontend=fs.readFileSync(path.join(root,'assets/js/selection.js'),'utf8');
const css=fs.readFileSync(path.join(root,'assets/css/selection.css'),'utf8');
const ppk={user_id:'ppk-1',role:'PPK'};
const pokja={user_id:'pokja-1',role:'POKJA'};
function setup(opts={}){
  const context=vm.createContext({Date,JSON,Set,Map,console});
  vm.runInContext(backend,context);
  const req={request_id:'P-2026-01',status:'PERLU_PERBAIKAN_PPK',current_round:1,selection_process:'NEGOSIASI',...opts};
  const docs=[{doc_id:'d1',doc_type:'KAK',is_current:true},{doc_id:'d2',doc_type:'HPS',is_current:true}];
  const reviews=[{review_id:'r1',round:1,doc_type:'__PAKET__',doc_id:JSON.stringify(['d1','d2']),status:'PERLU_PERBAIKAN',note:'Jelaskan ruang lingkup.'}];
  const notes=[],audit=[];
  Object.assign(context,{
    requireRole_:(user,roles)=>{if(!roles.includes(user.role))throw Error('Akses ditolak')},
    getRequestAuthorized_:(user,id)=>{if(id!==req.request_id)throw Error('Paket tidak ditemukan');return req},
    assertDocsComplete_:()=>{},
    packageReview_:()=>reviews[0],
    packageDocSnapshot_:()=>JSON.stringify(docs.filter(d=>d.is_current).map(d=>d.doc_id).sort()),
    currentRoundReviews_:()=>reviews,
    currentDocs_:()=>docs.filter(d=>d.is_current),
    appendNote_:(user,id,phase,status,note)=>notes.push({user:user.role,id,phase,status,note}),
    updateRequest_:(id,patch)=>Object.assign(req,patch),
    audit_:(user,action,id,detail)=>audit.push({action,id,detail}),
    getRequest_:()=>req,
    publicRequest_:r=>({...r})
  });
  return {context,req,docs,reviews,notes,audit,submit:payload=>context.resubmitRevision_(ppk,payload)};
}
test('PPK dapat kirim catatan saja tanpa mengganti dokumen, Pokja mendapat reviu ulang',()=>{
  const f=setup();const result=f.submit({requestId:f.req.request_id,note:'KAK tetap. Penjelasan rincian tersedia pada bagian catatan.'});
  assert.equal(result.status,'REVIU_ULANG');assert.equal(result.current_round,2);
  assert.equal(f.notes.length,1);assert.equal(f.notes[0].phase,'PERBAIKAN_PPK');assert.equal(f.notes[0].user,'PPK');
  assert.match(f.notes[0].note,/KAK tetap/);assert.equal(f.audit.at(-1).detail.hasDocumentRevision,false);
});
test('PPK dapat mengirim dokumen revisi tanpa catatan tambahan',()=>{
  const f=setup();f.docs[0].is_current=false;f.docs.push({doc_id:'d3',doc_type:'KAK',is_current:true});
  f.submit({requestId:f.req.request_id,note:''});assert.equal(f.req.status,'REVIU_ULANG');
  assert.equal(f.notes.length,0);assert.equal(f.audit.at(-1).detail.hasDocumentRevision,true);
});
test('Tidak boleh mengirim kosong tanpa catatan maupun revisi',()=>{
  const f=setup();assert.throws(()=>f.submit({requestId:f.req.request_id,note:' '}),/catatan PPK atau unggah dokumen/i);
  assert.equal(f.req.status,'PERLU_PERBAIKAN_PPK');assert.equal(f.notes.length,0);
});
test('Kegagalan Mini Kompetisi dapat dikembalikan dengan catatan untuk reviu ulang',()=>{
  const f=setup({selection_process:'MINI_KOMPETISI',mini_stage:'GAGAL'});
  f.submit({requestId:f.req.request_id,note:'Perlu penyesuaian waktu penayangan saja.'});
  assert.equal(f.req.mini_stage,'REVIU_ULANG');assert.equal(f.req.current_round,2);
});
test('Pengiriman ditolak apabila bukan status perbaikan dan catatan lebih dari batas',()=>{
  const f=setup();assert.throws(()=>f.submit({requestId:f.req.request_id,note:'x'.repeat(2001)}),/2.000 karakter/);
  f.req.status='SELESAI';assert.throws(()=>f.submit({requestId:f.req.request_id,note:'Ada catatan'}),/tidak sedang menunggu/);
});
test('Frontend: kolom catatan, upload opsional, ringkasan untuk Pokja, pipeline tujuh tahap',()=>{
  assert.match(frontend,/id="selPpkRevisionNote"/);
  assert.match(frontend,/data-resubmit-revision/);
  assert.match(frontend,/Catatan PPK untuk Pokja/);
  assert.match(frontend,/Dokumen tidak perlu diunggah ulang jika tidak ada perubahan/);
  assert.match(frontend,/const steps=\[\['DRAFT','Permohonan'\]/);
  assert.match(frontend,/\['PROSES_INAPROC','Handover PPK'\]/);
  assert.match(frontend,/function processStepName/);
  assert.match(css,/\.sel-ppk-revision/);
});
test('Pipeline tujuh tahap membedakan Negosiasi, Mini Kompetisi, handover, dan paket lama',()=>{
  const a=frontend.slice(frontend.indexOf('  const steps=[['),frontend.indexOf('  function stageInfo(d,index){'));
  const b=frontend.slice(frontend.indexOf('  function requestPipeline(r){'),frontend.indexOf('  function requestRow(r,ctx={}){'));
  const c=vm.createContext({requestSelectionProcess:r=>r?.selection_process||'NEGOSIASI',esc:x=>String(x||'')});
  vm.runInContext(a+b,c);
  const index=r=>vm.runInContext(`stepIndex(${JSON.stringify(r)})`,c);
  const label=(r,i)=>vm.runInContext(`processStepName(${JSON.stringify(r)},${i})`,c);
  assert.equal(vm.runInContext('steps.length',c),7);
  assert.equal(index({status:'PERLU_PERBAIKAN_PPK'}),3);
  assert.equal(index({status:'REVIU_ULANG',mini_stage:'REVIU_ULANG'}),3);
  assert.equal(index({status:'SIAP_PROSES_INAPROC',selection_process:'NEGOSIASI',nego_stage:'HASIL_NEGOSIASI'}),4);
  assert.equal(index({status:'SIAP_PROSES_INAPROC',selection_process:'MINI_KOMPETISI',mini_stage:'EVALUASI'}),4);
  assert.equal(index({status:'PROSES_INAPROC',selection_process:'MINI_KOMPETISI',mini_stage:'HANDOVER'}),5);
  assert.equal(index({status:'PROSES_INAPROC',selection_process:'NEGOSIASI',nego_stage:''}),5);
  assert.equal(index({status:'SELESAI',selection_process:'NEGOSIASI'}),6);
  assert.equal(index({status:'BATAL',selection_process:'MINI_KOMPETISI'}),4);
  assert.equal(label({selection_process:'MINI_KOMPETISI'},4),'Mini Kompetisi');
  assert.equal(label({selection_process:'NEGOSIASI'},4),'Negosiasi');
  const mini=vm.runInContext(`requestPipeline(${JSON.stringify({request_id:'P-1',status:'SIAP_PROSES_INAPROC',selection_process:'MINI_KOMPETISI',mini_stage:'TAYANG'})})`,c);
  const nego=vm.runInContext(`requestPipeline(${JSON.stringify({request_id:'P-2',status:'SIAP_PROSES_INAPROC',selection_process:'NEGOSIASI',nego_stage:'HASIL_NEGOSIASI'})})`,c);
  assert.equal((mini.match(/data-request-step=/g)||[]).length,7);
  assert.match(mini,/Mini Kompetisi/);assert.match(nego,/Negosiasi/);
});
