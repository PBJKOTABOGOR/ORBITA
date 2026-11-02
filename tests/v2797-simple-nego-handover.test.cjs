const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const vm=require('node:vm');const path=require('node:path');
const root=path.join(__dirname,'..');const frontend=fs.readFileSync(path.join(root,'assets/js/selection.js'),'utf8');const backend=fs.readFileSync(path.join(root,'backend/Code-TRAXPBJ-Pemilihan.gs'),'utf8');
const first=frontend.indexOf('  const negoDocNames=');const last=frontend.indexOf('  const miniDocNames=',first);
const chunk=frontend.slice(first,last);
function render({stage='SIAP_NEGOSIASI',status='SIAP_PROSES_INAPROC',pagu=100000000000,types=[],role='POKJA',prepare=false,workflow_scheme='KAJI_ULANG_2026'}={}){
  const context=vm.createContext({state:{me:{role}},negoHandoverPreparation:new Set(prepare?['P-1']:[]),requestSelectionProcess:r=>r.selection_process,currentDoc:(d,type)=>d.docs.find(x=>x.doc_type===type)||null,docUploadState:()=>null,negoPhaseLabel:()=>'',esc:x=>String(x||'')});
  vm.runInContext(chunk,context);
  const req={request_id:'P-1',selection_process:'NEGOSIASI',status,nego_stage:stage,pagu,ppk_email:'ppk@example.com',hps_alokasi:100,workflow_scheme};
  return vm.runInContext(`negoHtml(${JSON.stringify({request:req,docs:types.map(doc_type=>({doc_type,file_name:'Berita Acara.pdf'}))})})`,context);
}
test('Tidak menampilkan BA saat reviu PPK/Pokja berlangsung',()=>{
  for(const status of ['DRAFT','PERLU_PERBAIKAN_PPK','REVIU_POKJA','REVIU_ULANG'])assert.equal(render({status,stage:''}), '');
});
test('Awal negosiasi hanya pilihan Handover dan Batal, tanpa dokumen',()=>{
  const empty=render();assert.doesNotMatch(empty,/NEGO_BA_HASIL_REVIU|data-nego-doc=|SURAT_PENYAMPAIAN_HASIL/);
  assert.match(empty,/data-nego-action="PREPARE_HANDOVER"/);
  assert.match(empty,/data-nego-action="BATAL"/);
  assert.doesNotMatch(empty,/data-nego-action="HANDOVER"/);
});
test('Dokumen baru terlihat setelah memilih persiapan Handover; Kirim PPK terkunci sebelum lengkap',()=>{
  const empty=render({prepare:true});assert.match(empty,/NEGO_BA_HASIL_REVIU/);assert.match(empty,/NEGO_BA_HASIL_EVALUASI/);assert.match(empty,/SURAT_PENYAMPAIAN_HASIL/);
  assert.match(empty,/data-nego-action="HANDOVER" disabled/);assert.match(empty,/Dokumen lengkap 0 dari 3/);
  const partial=render({prepare:true,types:['NEGO_BA_HASIL_REVIU']});assert.match(partial,/Dokumen lengkap 1 dari 3/);assert.match(partial,/data-nego-action="HANDOVER" disabled/);
  const complete=render({prepare:true,types:['NEGO_BA_HASIL_REVIU','NEGO_BA_HASIL_EVALUASI','SURAT_PENYAMPAIAN_HASIL']});assert.match(complete,/data-nego-action="HANDOVER"/);assert.doesNotMatch(complete,/data-nego-action="HANDOVER" disabled/);
});
test('Di atas Rp100 miliar tetap perlu surat PA/KPA; setelah handover dokumen arsip tanpa upload',()=>{
  const above=render({prepare:true,pagu:100000000001,types:['NEGO_BA_HASIL_REVIU','NEGO_BA_HASIL_EVALUASI','SURAT_PENYAMPAIAN_HASIL']});assert.match(above,/NEGO_SURAT_PENETAPAN_PA_KPA/);assert.match(above,/Dokumen lengkap 3 dari 4/);assert.match(above,/data-nego-action="HANDOVER" disabled/);
  const done=render({stage:'HANDOVER',types:['NEGO_BA_HASIL_REVIU','NEGO_BA_HASIL_EVALUASI']});assert.doesNotMatch(done,/data-nego-doc=/);assert.doesNotMatch(done,/data-nego-action=/);
});
test('PPK hanya melihat status menunggu; tidak dapat melihat form upload ataupun tombol',()=>{
  const ppk=render({role:'PPK'});assert.match(ppk,/Menunggu Pokja menyampaikan hasil/);assert.doesNotMatch(ppk,/Template Dokumen Negosiasi ↗|data-nego-doc=|data-nego-action=/);
});
test('Backend memvalidasi dokumen aktif sekaligus tanpa pembacaan berulang',()=>{
  const f=backend.slice(backend.indexOf('function negoWorkflow_('),backend.indexOf('function directUploadContext_('));
  assert.match(f,/const docs=currentDocs_\(req.request_id\),required=/);
  assert.equal((f.match(/currentDocs_\(/g)||[]).length,1);
  assert.doesNotMatch(f,/step==='MULAI'|step==='HASIL'/);
});
