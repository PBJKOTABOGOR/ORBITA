const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const root = path.join(__dirname, '..');
const frontend = fs.readFileSync(path.join(root, 'assets/js/selection.js'), 'utf8');
const backend = fs.readFileSync(path.join(root, 'backend/Code-TRAXPBJ-Pemilihan.gs'), 'utf8');
const w = {}, document = { addEventListener(){},querySelector(){return null},querySelectorAll(){return []} };
const ctx = { window:w, document,console,setTimeout,clearTimeout,Intl,Date,Map,Set,URL,Number,String,JSON,Math,localStorage:{getItem(){return null}},sessionStorage:{getItem(){return null}},navigator:{} };
vm.createContext(ctx);
vm.runInContext(frontend.replace(/\n\}\)\(\);\s*$/, '\nwindow.__miniV2877={miniHtml,reviewPanelHtml,state};\n})();'), ctx,{timeout:1500});
w.__miniV2877.state.me={role:'POKJA',user_id:'U1'};
const req=(stage, status='SIAP_PROSES_INAPROC')=>({request_id:'P-NEW-1',selection_process:'MINI_KOMPETISI',mini_stage:stage,status,pagu:300000000,ppk_email:'',current_round:1});
const det=r=>({request:r,docs:[],reviews:[],notes:[]});
test('Tahap menunggu penayangan tidak lagi menampilkan dua unggahan',()=>{
 const html=w.__miniV2877.miniHtml(det(req('SIAP_TAYANG')));
 assert.match(html,/Sudah Ditayangkan di INAPROC/);
 assert.doesNotMatch(html,/Dokumen Persiapan Pengadaan|Berita Acara Persetujuan Pokja/);
 assert.doesNotMatch(html,/data-mini-doc=/);
 assert.doesNotMatch(html,/sel-mini-documents/);
});
test('Tahap sedang ditayangkan juga tidak menampilkan dua dokumen lama',()=>{
 const html=w.__miniV2877.miniHtml(det(req('TAYANG')));
 assert.match(html,/Mulai Evaluasi/);
 assert.doesNotMatch(html,/Dokumen Persiapan Pengadaan|Berita Acara Persetujuan Pokja/);
});
test('Dokumen hasil evaluasi Mini Kompetisi tetap muncul',()=>{
 const html=w.__miniV2877.miniHtml(det(req('EVALUASI')));
 assert.match(html,/Berita Acara Hasil Evaluasi Mini Kompetisi/);
 assert.match(html,/data-mini-doc="BA_HASIL_EVALUASI"/);
 assert.match(html,/Handover ke PPK/);
});
test('Reviu Mini Kompetisi tidak lagi menampilkan upload dua dokumen',()=>{
 const html=w.__miniV2877.reviewPanelHtml(det(req('','REVIU_POKJA')));
 assert.doesNotMatch(html,/data-mini-doc="BA_HASIL_REVIU"|data-mini-doc="BA_PERSETUJUAN_POKJA"/);
 assert.match(html,/Simpan Reviu/);
});
test('Backend menayangkan paket tanpa membaca kedua berkas lama',()=>{
 const mini=backend.slice(backend.indexOf('function miniWorkflow_('),backend.indexOf('// Arsip proses Negosiasi'));
 assert.doesNotMatch(mini,/miniRequireReviewDocs_\(/);
 const mockRequest={request_id:'P-NEW-1',mini_stage:'SIAP_TAYANG',status:'SIAP_PROSES_INAPROC',selection_process:'MINI_KOMPETISI',pagu:300000000};
 let saved;
 const scope={ STATUS:{SIAP_INAPROC:'SIAP_PROSES_INAPROC'},requireRole_(){},getRequestAuthorized_(){return mockRequest;},requestSelectionProcess_(){return 'MINI_KOMPETISI';},miniRequireReviewDocs_(){throw Error('Unexpected required two docs');}, ensureRequestSchema_(){},updateRequest_(id,patch){saved=patch},audit_(){},getRequest_(){return {...mockRequest,...saved}},publicRequest_(r){return r},Date,String,Number};
 vm.createContext(scope);vm.runInContext(mini,scope);
 const result=scope.miniWorkflow_({role:'POKJA'},{requestId:'P-NEW-1',step:'TAYANG'});
 assert.equal(result.mini_stage,'TAYANG');
 assert.equal(result.status,'SIAP_PROSES_INAPROC');
});
test('Backend reviu sesuai dan selesai reviu tidak lagi memerlukan dua berkas',()=>{
 const a=backend.slice(backend.indexOf('function submitPackageReview_('),backend.indexOf('function savePackageReview_('));
 const b=backend.slice(backend.indexOf('function completeReview_('),backend.indexOf('function',backend.indexOf('function completeReview_(')+15));
 assert.doesNotMatch(a,/miniRequireReviewDocs_\(/);
 assert.doesNotMatch(b,/miniRequireReviewDocs_\(/);
 assert.match(a,/assertDocsComplete_/); // PPK's own preparation document requirements remain unchanged.
});
test('Lainnya tetap: tombol penayangan dan BA tahap evaluasi/negosiasi tidak dicabut',()=>{
 assert.match(frontend,/data-mini-action="TAYANG"/);
 assert.match(frontend,/NEGO_BA_HASIL_EVALUASI/);
 assert.match(backend,/miniRequireDoc_\(req,'BA_HASIL_EVALUASI'/);
 assert.match(backend,/miniRequireDoc_\(req,'BA_PEMBATALAN'/);
});
