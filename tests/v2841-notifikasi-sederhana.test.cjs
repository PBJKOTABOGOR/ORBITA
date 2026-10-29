'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.resolve(__dirname,'..');
const js=fs.readFileSync(path.join(root,'assets/js/notifications.js'),'utf8');
const css=fs.readFileSync(path.join(root,'assets/css/notifications.css'),'utf8');
const html=fs.readFileSync(path.join(root,'profil-pbj/index.html'),'utf8');
const sw=fs.readFileSync(path.join(root,'sw.js'),'utf8');
const match=js.match(/  function noticeTone\(item\)\{[\s\S]*?\n  \}\n  function paint\(\)/);
assert.ok(match, 'Fungsi noticeTone tetap ditemukan');
const classify=vm.runInNewContext(match[0].replace(/\n  function paint\(\)/,'')+'\nnoticeTone;');
const tone=(title,message='',type='permohonan')=>classify({title,message,type});

test('Merah: penolakan, pembatalan, gagal',()=>{
  for(const title of ['Permohonan ditolak','Permohonan Penolakan','Mini Kompetisi dibatalkan','Paket batal','Mini Kompetisi gagal'])assert.equal(tone(title),'tone-danger',title);
});
test('Kuning: perbaikan, revisi, kelengkapan',()=>{
  for(const title of ['Dokumen perlu diperbaiki','Perbaikan dokumen diperlukan','Dokumen revisi diterima','Kelengkapan dokumen belum ada','Hasil Kaji Ulang tidak sesuai'])assert.equal(tone(title),'tone-warning',title);
});
test('Hijau: undangan, sesuai, selesai, handover, berhasil',()=>{
  for(const title of ['Undangan Kaji Ulang','Surat undangan Pokja','Hasil Kaji Ulang sesuai','Pemilihan selesai','Handover Negosiasi','Berhasil dikirim','Pokja telah ditetapkan'])assert.equal(tone(title),'tone-success',title);
});
test('Biru: lainnya, judul status tidak terkecoh nama paket',()=>{
  assert.equal(tone('Permohonan masuk'),'tone-info');
  assert.equal(tone('Permohonan masuk','Paket Evaluasi Gagal'),'tone-info');
  assert.equal(tone('Undangan Kaji Ulang','Paket Revisi gagal'),'tone-success');
  assert.equal(tone('Permohonan ditolak','Undangan perbaikan'),'tone-danger');
  assert.equal(tone('Pokja mulai memeriksa dokumen','Paket gagal Tender'),'tone-info');
  assert.equal(tone('Pengumuman','Surat undangan sudah tersedia','broadcast'),'tone-success');
  assert.equal(tone('Pengumuman','Permohonan ditolak','broadcast'),'tone-danger');
});
test('Warna hanya garis dan titik; latar notif netral',()=>{
  for(const toneName of ['danger','warning','success','info']){
    assert.match(css,new RegExp('\\.orbit-notice-item\\.tone-'+toneName+'\\{border-left-color:'));
    assert.match(css,new RegExp('\\.orbit-notice-item\\.tone-'+toneName+' \\.orbit-notice-dot\\{background:'));
  }
  assert.doesNotMatch(css,/\.orbit-notice-item\.tone-(?:danger|warning|success|info)(?::[^{]+)?\{[^}]*background:/);
  assert.match(css,/\.orbit-notice-item:not\(\.is-read\)\{background:#f7fafc\}/);
  assert.match(css,/@keyframes orbitBellRing/);
});
test('Versi frontend/cache sinkron tanpa sentuh API dan backend',()=>{
  assert.match(html,/notifications\.js\?v=28\.(?:41|45)/);
  assert.match(html,/notifications\.css\?v=28\.(?:41|45)/);
  assert.match(sw,/orbita-pbj-shell-v28-(?:41-notif-simple|42-role-ppk-note|45-notice-page)/);
  assert.match(sw,/notifications\.js\?v=28\.(?:41|45)/);
  assert.match(sw,/notifications\.css\?v=28\.(?:41|45)/);
});
