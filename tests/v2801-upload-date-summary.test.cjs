'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.join(__dirname,'..');
const js=fs.readFileSync(path.join(root,'assets/js/selection.js'),'utf8');
const gs=fs.readFileSync(path.join(root,'backend/Code-TRAXPBJ-Pemilihan.gs'),'utf8');
const html=fs.readFileSync(path.join(root,'profil-pbj/index.html'),'utf8');
const take=(src,start,end)=>{const a=src.indexOf(start);const b=src.indexOf(end,a+start.length);assert.ok(a>=0&&b>a,`missing ${start} or ${end}`);return src.slice(a,b)};
test('Tanggal dan jam draft dari Google Sheets dinormalkan agar valid di input HTML',()=>{
  const helper=take(js,'  function formYmd(value){','  function hydrateCreateFromDetail(detail){');
  const box=vm.createContext({Intl,Date,Number,String});vm.runInContext(helper,box);
  assert.equal(box.formYmd('2026-10-08T17:00:00.000Z'),'2026-10-09');
  assert.equal(box.formYmd('2026-10-09'),'2026-10-09');
  assert.equal(box.formClock('08:30:00'),'08:30');
  assert.equal(box.formClock('1899-12-30T01:00:00Z'),'08:00');
  assert.match(js,/c\.scheduleStartDate=formYmd\(r\.schedule_start_date\)/);
  assert.match(js,/c\.completionDate=formYmd\(r\.completion_date\)/);
  assert.match(js,/if\(get\('mcStartDate'\)\)c\.scheduleStartDate=get\('mcStartDate'\)\.value/);
  assert.match(js,/if\(get\('mcCompletionDate'\)\)c\.completionDate=get\('mcCompletionDate'\)\.value/);
});
test('Tanggal tersimpan tetap diperiksa saat submit, tetapi tanpa membaca tanggal ISO sebagai hari sebelumnya',()=>{
  assert.match(gs,/requestDateYmd_\(req\.schedule_start_date\)<today/);
  assert.match(gs,/schedule_start_date:requestDateYmd_\(r\.schedule_start_date\)/);
  assert.match(gs,/completion_date:requestDateYmd_\(r\.completion_date\)/);
  assert.match(js,/Perbarui jadwal kompetisi sebelum mengirim permohonan/);
  assert.match(gs,/Perbarui jadwal kompetisi sebelum mengirim permohonan/);
});
test('Detail produk tidak menampilkan kolom yang kosong',()=>{
  const part=take(js,'  function productSummary(', '  function createDocRow(');
  assert.match(part,/fields\.filter\(\(\[,val\]\)=>val===0/);
  assert.doesNotMatch(part,/fields\.map\(\(\[label,val\]\)/);
});
test('File JPG/PNG terlalu besar dicoba diperkecil lokal, tidak mengubah PDF bertanda tangan',()=>{
  const part=take(js,'  const CREATE_DOC_LIMIT=','  function bindCreateDropZones(c){');
  assert.match(part,/async function shrinkLargeImage\(file\)/);
  assert.match(part,/createImageBitmap\(file\)/);
  assert.match(part,/canvas\.toBlob\(resolve,'image\/jpeg',quality\)/);
  assert.match(part,/PDF atau Office di atas 10 MB perlu diperkecil/);
  assert.match(part,/c\.files\.set\(type,ready\)/);
  assert.match(js,/await Promise\.allSettled\(\[\.\.\.c\.filePreparations\.values\(\)\]\)/);
  assert.match(html,/selection\.js\?v=28\.07/);
});
