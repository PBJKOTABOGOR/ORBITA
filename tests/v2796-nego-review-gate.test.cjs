const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.join(__dirname,'..');
const frontend=fs.readFileSync(path.join(root,'assets/js/selection.js'),'utf8');
const css=fs.readFileSync(path.join(root,'assets/css/selection.css'),'utf8');
const backend=fs.readFileSync(path.join(root,'backend/Code-TRAXPBJ-Pemilihan.gs'),'utf8');

test('Negosiasi tidak muncul saat masih reviu dan upload BA baru sesudah reviu selesai',()=>{
  assert.doesNotMatch(frontend,/if\(!review&&!ready&&!negotiating&&!results&&!handover\)return ''/);
  assert.match(frontend,/if\(!pending&&!handover\)return ''/);
  assert.match(frontend,/const types=\['NEGO_BA_HASIL_REVIU','NEGO_BA_HASIL_EVALUASI'/);
  assert.match(backend,/return req\.status===STATUS\.SIAP_INAPROC&&\['SIAP_NEGOSIASI','NEGOSIASI','HASIL_NEGOSIASI'\]/);
});

test('Tombol upload BA seragam dan tautan template lebih jelas',()=>{
  assert.match(css,/\.sel-upload input\[type=file\]\{display:none\}/);
  assert.match(css,/\.sel-mini-field-help a\{color:#0b7bc6;font-weight:900;text-decoration:none\}/);
});
