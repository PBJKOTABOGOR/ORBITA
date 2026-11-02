const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.join(__dirname,'..');
const html=fs.readFileSync(path.join(root,'profil-pbj/index.html'),'utf8');
const js=fs.readFileSync(path.join(root,'assets/js/orbita-docs-timeline.js'),'utf8');
const adminHtml=fs.readFileSync(path.join(root,'admin/index.html'),'utf8');
const adminJs=fs.readFileSync(path.join(root,'assets/js/site-content-admin.js'),'utf8');

test('documentation timeline has search and three default lanes',()=>{
  assert.match(html,/id="docsSearchInput"/);
  assert.match(html,/Cari kegiatan, lokasi, kategori/);
  assert.match(js,/DEFAULT_CATEGORIES=\['Briefing Internal','Pendampingan & Konsultasi','Rapat Lainnya','Agenda','Surat PBJ'\]/);
  assert.match(js,/matchesSearch/);
  assert.match(js,/title,d\?\.category,categoryOf\(d\),d\?\.location,d\?\.description/);
});

test('legacy categories collapse into the three main lanes while custom categories are allowed',()=>{
  assert.match(js,/brief/);
  assert.match(js,/rapat\|meeting/);
  assert.match(js,/pendamping\|konsult\|asist\|konsolidasi\|advokasi/);
  assert.match(js,/return value;/);
});

test('admin content uses the three requested documentation categories',()=>{
  assert.match(adminHtml,/<select id="documentationCategory">/);
  assert.match(adminHtml,/value="Briefing Internal"/);
  assert.match(adminHtml,/value="Rapat Lainnya"/);
  assert.match(adminHtml,/value="Pendampingan &amp; Konsultasi"/);
  assert.doesNotMatch(adminHtml,/Kategori baru bisa langsung diketik/);
  assert.match(adminJs,/renderDocCategoryOptions/);
  assert.match(adminJs,/Pendampingan & Konsultasi/);
});
