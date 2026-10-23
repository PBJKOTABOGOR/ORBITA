const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.join(__dirname,'..');
const js=fs.readFileSync(path.join(root,'assets/js/selection.js'),'utf8');
const back=fs.readFileSync(path.join(root,'backend/Code-TRAXPBJ-Pemilihan.gs'),'utf8');
const css=fs.readFileSync(path.join(root,'assets/css/selection.css'),'utf8');
test('Kartu permohonan tanpa deskripsi tahapan duplikat',()=>{
  const row=js.slice(js.indexOf('function requestRow('),js.indexOf('function requestGroupHtml('));
  assert.doesNotMatch(row,/sel-mini-phase-hint/);
  assert.match(row,/requestBadge\(r\)/);
});
test('Status panjang turun baris, tidak menutupi kolom nilai',()=>{
  assert.match(css,/sel-request-card>\.sel-request>\.sel-badge\{white-space:normal!important/);
  assert.match(css,/max-width:118px/);
});
test('BA lama yang masih aktif diakui tanpa membatalkan kewajiban dua berkas',()=>{
  const body=back.slice(back.indexOf('function miniRequireReviewDocs_('),back.indexOf('function miniWorkflow_('));
  assert.match(body,/const docs=currentDocs_\(req\.request_id\)/);
  assert.match(body,/\['BA_HASIL_REVIU','BA_PERSETUJUAN_POKJA'\]/);
  assert.doesNotMatch(body,/mini_failure_at|uploaded_at/);
});
