const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.join(__dirname,'..');
const js=fs.readFileSync(path.join(root,'assets/js/selection.js'),'utf8');
const css=fs.readFileSync(path.join(root,'assets/css/selection.css'),'utf8');
const html=fs.readFileSync(path.join(root,'profil-pbj/index.html'),'utf8');

test('Bagian proses sebelumnya dibuat ringkas dengan fold card',()=>{
  assert.match(js,/function foldCard\(title,meta,body,opts=\{\}\)/);
  assert.match(js,/foldCard\('Dokumen Persiapan'/);
  assert.match(js,/foldCard\('Reviu Paket'/);
  assert.match(js,/foldCard\('Catatan Proses'/);
});

test('Badge status INAPROC punya warna khusus dan aset diperbarui',()=>{
  assert.match(css,/\.sel-badge\[data-status="SIAP_PROSES_INAPROC"\]\{background:#e8f1ff;color:#1556a8/);
  assert.match(css,/\.sel-badge\[data-status="PROSES_INAPROC"\]\{background:#e6f9f6;color:#0f7f6b/);
  assert.match(html,/selection\.css\?v=28\.07/);
  assert.match(html,/selection\.js\?v=28\.07/);
});
