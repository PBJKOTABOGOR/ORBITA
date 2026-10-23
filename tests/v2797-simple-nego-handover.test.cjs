const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const vm=require('node:vm');const path=require('node:path');
const root=path.join(__dirname,'..');const frontend=fs.readFileSync(path.join(root,'assets/js/selection.js'),'utf8');const backend=fs.readFileSync(path.join(root,'backend/Code-TRAXPBJ-Pemilihan.gs'),'utf8');
const first=frontend.indexOf('  const negoDocNames=');const last=frontend.indexOf('  const miniDocNames=',first);
const chunk=frontend.slice(first,last);
function render({stage='SIAP_NEGOSIASI',status='SIAP_PROSES_INAPROC',pagu=100000000000,types=[],role='POKJA'}={}){
  const context=vm.createContext({state:{me:{role}},requestSelectionProcess:r=>r.selection_process,currentDoc:(d,type)=>d.docs.find(x=>x.doc_type===type)||null,docUploadState:()=>null,negoPhaseLabel:()=>'',esc:x=>String(x||'')});
  vm.runInContext(chunk,context);
  const req={request_id:'P-1',selection_process:'NEGOSIASI',status,nego_stage:stage,pagu};
  return vm.runInContext(`negoHtml(${JSON.stringify({request:req,docs:types.map(doc_type=>({doc_type,file_name:'Berita Acara.pdf'}))})})`,context);
}
test('Tidak menampilkan BA saat reviu PPK/Pokja berlangsung',()=>{
  for(const status of ['DRAFT','PERLU_PERBAIKAN_PPK','REVIU_POKJA','REVIU_ULANG'])assert.equal(render({status,stage:''}), '');
});
test('Dua dokumen wajib terlihat setelah reviu, satu tombol handover nonaktif sebelum lengkap',()=>{
  const empty=render();assert.match(empty,/NEGO_BA_HASIL_REVIU/);assert.match(empty,/NEGO_BA_HASIL_EVALUASI/);
  assert.doesNotMatch(empty,/data-nego-action="MULAI"|data-nego-action="HASIL"/);
  assert.match(empty,/data-nego-action="HANDOVER" disabled/);assert.match(empty,/Dokumen lengkap 0 dari 2/);
  const partial=render({types:['NEGO_BA_HASIL_REVIU']});assert.match(partial,/Dokumen lengkap 1 dari 2/);assert.match(partial,/data-nego-action="HANDOVER" disabled/);
  const complete=render({types:['NEGO_BA_HASIL_REVIU','NEGO_BA_HASIL_EVALUASI']});assert.match(complete,/data-nego-action="HANDOVER"/);assert.doesNotMatch(complete,/data-nego-action="HANDOVER" disabled/);
});
test('Di atas Rp100 miliar wajib dokumen PA/KPA; saat sudah handover tidak bisa unggah ulang',()=>{
  const above=render({pagu:100000000001,types:['NEGO_BA_HASIL_REVIU','NEGO_BA_HASIL_EVALUASI']});assert.match(above,/NEGO_SURAT_PENETAPAN_PA_KPA/);assert.match(above,/Dokumen lengkap 2 dari 3/);assert.match(above,/data-nego-action="HANDOVER" disabled/);
  const done=render({stage:'HANDOVER',types:['NEGO_BA_HASIL_REVIU','NEGO_BA_HASIL_EVALUASI']});assert.doesNotMatch(done,/data-nego-doc=/);assert.doesNotMatch(done,/data-nego-action=/);
});
test('Form Pokja dan PPK terpisah, template ditampilkan sebagai tautan',()=>{
  const ppk=render({role:'PPK'});assert.match(ppk,/Template Dokumen Negosiasi ↗/);assert.doesNotMatch(ppk,/data-nego-doc=/);assert.doesNotMatch(ppk,/data-nego-action=/);
});
test('Backend memvalidasi dokumen aktif sekaligus tanpa pembacaan berulang',()=>{
  const f=backend.slice(backend.indexOf('function negoWorkflow_('),backend.indexOf('function directUploadContext_('));
  assert.match(f,/const docs=currentDocs_\(req.request_id\),required=/);
  assert.equal((f.match(/currentDocs_\(/g)||[]).length,1);
  assert.doesNotMatch(f,/step==='MULAI'|step==='HASIL'/);
});
