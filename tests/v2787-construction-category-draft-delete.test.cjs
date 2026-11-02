const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const js=fs.readFileSync(path.join(__dirname,'../assets/js/selection.js'),'utf8');
const css=fs.readFileSync(path.join(__dirname,'../assets/css/selection.css'),'utf8');
const backend=fs.readFileSync(path.join(__dirname,'../backend/Code-TRAXPBJ-Pemilihan.gs'),'utf8');
const html=fs.readFileSync(path.join(__dirname,'../profil-pbj/index.html'),'utf8');

test('construction category picker is hierarchical like product picker',()=>{
  assert.match(js,/data-construction-cat-root/);
  assert.match(js,/data-construction-cat-group/);
  assert.match(js,/data-construction-cat-leaf/);
  assert.match(js,/sel-health-columns/);
  assert.match(js,/selected\.level1/);
  assert.match(js,/selected\.level2/);
  assert.match(js,/selected\.level3/);
  assert.doesNotMatch(js,/id="constructionCatSelect"/);
});

test('construction leaf selection still requires Selanjutnya',()=>{
  assert.match(js,/data-construction-next/);
  assert.match(js,/>Selanjutnya<\/button>/);
  assert.match(js,/constructionFieldsDialog\(index,item,row\)/);
});

test('PPK draft cards expose a delete draft button only for draft statuses',()=>{
  assert.match(js,/canDeleteDraft=state\.me\?\.role==='PPK'/);
  assert.match(js,/\['DRAFT','PERLU_KELENGKAPAN'\]/);
  assert.match(js,/data-delete-draft-request/);
  assert.match(js,/Hapus Draft/);
  assert.match(css,/sel-request-delete-draft/);
});

test('draft deletion is authorized and removes draft data server-side',()=>{
  assert.match(backend,/action === 'deleteDraftRequest'/);
  assert.match(backend,/function deleteDraftRequest_/);
  assert.match(backend,/Hanya permohonan yang masih Draft yang dapat dihapus/);
  assert.match(backend,/DriveApp\.getFolderById/);
  assert.match(backend,/PBJWF\.SHEETS\.DOCS/);
  assert.match(backend,/PBJWF\.SHEETS\.REVIEWS/);
  assert.match(backend,/PBJWF\.SHEETS\.NOTES/);
  assert.match(backend,/DELETE_DRAFT_REQUEST/);
});

test('deleting a reapplication draft clears its reapply lock audit',()=>{
  assert.match(backend,/REAPPLY_REQUEST/);
  assert.match(backend,/d\.newRequestId/);
  assert.match(backend,/linkedAuditIds/);
});

test('construction hierarchy still works in current cache-busted build',()=>{
  assert.match(html,/selection\.css\?v=27\.97/);
  assert.match(html,/selection-api\.js\?v=27\.91/);
  assert.match(html,/selection\.js\?v=27\.98/);
  assert.match(backend,/upgradePemilihanV2790/);
  assert.match(backend,/upgradePemilihanV2787/);
});
