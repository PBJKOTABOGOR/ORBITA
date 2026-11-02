const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const js=fs.readFileSync(path.join(__dirname,'../assets/js/selection.js'),'utf8');
const backend=fs.readFileSync(path.join(__dirname,'../backend/Code-TRAXPBJ-Pemilihan.gs'),'utf8');

test('kode RUP minikom kaji ulang dikunci total di form',()=>{
  for(const snippet of [
    'const locked=Boolean(c.postKaji)',
    'Kode RUP dikunci mengikuti permohonan awal dan tidak bisa diubah lagi.',
    'hidden.value=String(c.rupCode||',
    'rupSearch.disabled=true;rupSearch.readOnly=true'
  ]) assert.ok(js.includes(snippet),snippet);
});

test('email masuk queue tanpa menunggu Gmail, trigger retry tetap dijaga',()=>{
  assert.match(backend,/function ensureMailQueueTrigger_\(/);
  assert.match(backend,/function attemptQueuedMailByKey_\(/);
  assert.match(backend,/const queued=mailQueue_\(key,to,subject,body\);if\(queued\)ensureMailQueueTrigger_\(\)/);
});
