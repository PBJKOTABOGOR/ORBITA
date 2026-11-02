const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const root=path.join(__dirname,'..');
const front=fs.readFileSync(path.join(root,'assets/js/selection.js'),'utf8');
const server=fs.readFileSync(path.join(root,'backend/Code-TRAXPBJ-Pemilihan.gs'),'utf8');
const css=fs.readFileSync(path.join(root,'assets/css/selection.css'),'utf8');
const html=fs.readFileSync(path.join(root,'profil-pbj/index.html'),'utf8');
const miniSource=server.slice(server.indexOf('function miniWorkflow_('),server.indexOf('// Arsip proses Negosiasi'));
test('Reviu sesuai mencatat penayangan langsung dan dua BA terpisah',()=>{
 const part=server.slice(server.indexOf('function submitPackageReview_('),server.indexOf('function savePackageReview_('));
 assert.match(front,/Simpan dan Tayangkan di INAPROC/);
 assert.match(front,/Unggah kedua BA setelah penayangan di INAPROC/);
 assert.match(server,/BA_HASIL_REVIU:'Berita Acara Hasil Reviu Dokumen Pemilihan Kompetisi'/);
 assert.match(server,/BA_PERSETUJUAN_POKJA:'Berita Acara Persetujuan Pokja'/);
 assert.match(part,/mini_stage:'TAYANG',mini_tayang_at:new Date\(\)/);
 assert.match(part,/ensureSubmissionAudit_\(user,req,saved,'MINI_TAYANG'\)/);
});
test('Gagal cukup alasan tanpa BA, batal wajib BA pembatalan, perubahan wajib BA sendiri',()=>{
 assert.match(miniSource,/if\(action==='BATAL'\)miniRequireDoc_\(req,'BA_PEMBATALAN',req.mini_tayang_at\)/);
 assert.match(miniSource,/miniRequireDoc_\(req,'BA_PERSETUJUAN',req.mini_last_change_at\|\|req.mini_tayang_at\)/);
 assert.match(miniSource,/mini_stage='GAGAL'/);
 assert.match(server,/!hasRevision&&!note&&req.mini_stage!=='GAGAL'/);
});
test('Pilihan perubahan dan pembatalan menampilkan BA sesuai tindakan, gagal tanpa BA',()=>{
 assert.match(front,/choice==='PERUBAHAN'\?'BA_PERSETUJUAN':choice==='BATAL'\?'BA_PEMBATALAN':''/);
 assert.match(front,/Tidak perlu mengunggah dokumen/);
 assert.match(front,/data-mini-decision-save/);
 assert.match(front,/miniDecisionIsUploaded\(detail,type\)/);
 assert.match(css,/\.sel-mini-decision-form/);
});
test('Dokumen Laporan dan PDF memuat jenis pemilihan, BA, serta riwayat keputusan',()=>{
 assert.match(front,/\['skp','Dokumen Laporan'/);
 assert.match(front,/<h3>Dokumen Laporan<\/h3>/);
 assert.match(server,/fileName:'Dokumen-Laporan-Pokja-'/);
 assert.match(server,/Riwayat Proses Pemilihan/);
 assert.match(server,/selection_process:requestSelectionProcess_\(r\)/);
 assert.match(server,/const auditRows=assigned.length/);
 assert.match(html,/selection\.css\?v=28\.07/);
 assert.match(html,/selection\.js\?v=28\.07/);
});
test('Upload BA memperbarui cap waktu request tanpa request tambahan sehingga reviu tidak konflik dengan upload sendiri',()=>{
 assert.equal((server.match(/obj\._requestUpdatedAt=docTouchAt\.toISOString\(\)/g)||[]).length,2);
 assert.match(front,/if\(requestUpdatedAt\)state\.detail\.request\.updated_at=requestUpdatedAt/);
});
