'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const backend=fs.readFileSync(path.join(root,'backend/Code-TRAXPBJ-Pemilihan.gs'),'utf8');
const front=fs.readFileSync(path.join(root,'assets/js/selection.js'),'utf8');
function stub(){const c=vm.createContext({Date,Math,JSON,Number,String});vm.runInContext(backend,c);return c;}
test('BA Kaji Ulang tetap menerima upload pengganti sebelum hasil disimpan, pada direct dan legacy',()=>{
 const b=backend.match(/function directUploadContext_\([\s\S]*?function beginDirectUpload_/)[0];
 assert.doesNotMatch(b,/BA Hasil Reviu sudah diunggah/);
 const finalize=backend.match(/function finalizeDirectUpload_\([\s\S]*?function assignPokjaDirect_/)[0];
 assert.doesNotMatch(finalize,/BA Hasil Reviu sudah diunggah/);
 assert.match(front,/active\?`<label class="sel-upload [\s\S]*?data-kaji-doc/);
 assert.match(front,/needsKajiFile\?'Unggah revisi':'Ganti file'/);
});
test('Versioning tetap sama pada tahap yang sama, lalu naik setelah putaran Kaji Ulang baru',()=>{
 const c=stub();c.truthy_=v=>v===true;
 const first={version:1,is_current:true,uploaded_at:'2026-10-21T09:30:00Z'};
 const req={review_started_at:'2026-10-21T09:00:00Z',current_round:1,status:'REVIU_POKJA'};
 assert.equal(c.documentVersionForUpload_([],req,'KAJI_DOCUMENT'),1);
 assert.equal(c.documentVersionForUpload_([first],req,'KAJI_DOCUMENT'),1);
 const sameVersion=[{...first,is_current:false},{version:1,is_current:true,uploaded_at:'2026-10-21T10:00:00Z'}];
 assert.equal(c.documentVersionForUpload_(sameVersion,req,'KAJI_DOCUMENT'),1);
 req.review_started_at='2026-10-21T11:00:00Z';req.current_round=2;req.status='REVIU_ULANG';
 assert.equal(c.documentVersionForUpload_(sameVersion,req,'KAJI_DOCUMENT'),2);
 sameVersion.push({version:2,is_current:true,uploaded_at:'2026-10-21T11:15:00Z'});sameVersion[1].is_current=false;
 assert.equal(c.documentVersionForUpload_(sameVersion,req,'KAJI_DOCUMENT'),2);
});
test('Dokumen PPK yang dikembalikan memperoleh versi baru, bukan tiap ganti berkas',()=>{
 const c=stub();c.truthy_=v=>v===true;
 const req={status:'PERLU_PERBAIKAN_PPK',review_started_at:'2026-10-21T12:00:00Z'};
 const files=[{version:1,is_current:true,uploaded_at:'2026-10-21T08:00:00Z'}];
 assert.equal(c.documentVersionForUpload_(files,req,'DOCUMENT'),2);
 files[0].is_current=false;files.push({version:2,is_current:true,uploaded_at:'2026-10-21T12:10:00Z'});
 assert.equal(c.documentVersionForUpload_(files,req,'DOCUMENT'),2);
});
test('Surat undangan memakai kop Pemerintah Kota Bogor, favicon lokal dan tabel berformat',()=>{
 assert.match(backend,/PEMERINTAH KOTA BOGOR/);
 assert.match(backend,/SEKRETARIAT DAERAH/);
 assert.match(backend,/BAGIAN PENGADAAN BARANG\/JASA/);
 assert.match(backend,/DocumentApp\.create\('Undangan Kaji Ulang/);
 assert.match(backend,/Utilities\.base64Decode\('[A-Za-z0-9+/=]{1000,}'\)/);
 assert.match(backend,/setBorderColor\('#D4E0E9'\)/);
 assert.match(backend,/document\.saveAndClose\(\)/);
 assert.doesNotMatch(backend,/UrlFetchApp\.fetch\('https:\/\/pbjkotabogor\.github\.io\/ORBITA\/assets\/img\/favicon\.png/);
});
