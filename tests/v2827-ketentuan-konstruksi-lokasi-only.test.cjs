'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const js=fs.readFileSync(path.join(root,'assets/js/selection.js'),'utf8');
const html=fs.readFileSync(path.join(root,'profil-pbj/index.html'),'utf8');
const sw=fs.readFileSync(path.join(root,'sw.js'),'utf8');
test('rekap Ketentuan Pekerjaan untuk Mini Kompetisi Konstruksi hanya Lokasi Pekerjaan',()=>{
  const group=js.match(/recapGroup\('Ketentuan Pekerjaan',construction\?(\[\[.*?\]\]):(\[\[.*?\]\])\)/);
  assert.ok(group,'Ketentuan Pekerjaan tetap tampil');
  assert.equal(group[1],"[['Lokasi Pekerjaan',r.work_location]]");
  assert.doesNotMatch(group[1],/Pembayaran|Termin|Tanggal Penyelesaian/);
  assert.match(group[2],/Lokasi Pekerjaan/);
  assert.match(js,/<h4>Pembayaran<\/h4>/,'form pembayaran tetap ada, hanya rekap yang diubah');
});
test('asset JavaScript menggunakan versi baru supaya perbaikan tidak tertahan cache',()=>{
  assert.match(html,/selection\.js\?v=28\.(?:28|29|30)/);
  assert.match(sw,/selection\.js\?v=28\.(?:28|29|30)/);
  assert.match(sw,/orbita-pbj-shell-v28-(?:28|29|30)/);
});
