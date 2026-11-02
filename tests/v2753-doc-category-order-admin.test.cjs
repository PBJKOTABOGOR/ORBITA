const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const read=p=>fs.readFileSync(new URL('../'+p,'file://'+__filename),'utf8');
const timeline=read('assets/js/orbita-docs-timeline.js');
const adminJs=read('assets/js/site-content-admin.js');
const adminHtml=read('admin/index.html');

test('timeline uses requested five-line order',()=>{
  assert.match(timeline,/DEFAULT_CATEGORIES=\['Briefing Internal','Pendampingan & Konsultasi','Rapat Lainnya','Agenda','Surat PBJ'\]/);
  assert.match(timeline,/if\(\/brief\/\.test\(low\)\)return 'Briefing Internal'/);
  assert.match(timeline,/if\(\/rapat\|meeting\/\.test\(low\)\)return 'Rapat Lainnya'/);
});

test('admin documentation type is a fixed dropdown',()=>{
  assert.match(adminHtml,/<select id="documentationCategory">/);
  assert.match(adminHtml,/value="Briefing Internal"/);
  assert.match(adminHtml,/value="Pendampingan &amp; Konsultasi" selected/);
  assert.match(adminHtml,/value="Rapat Lainnya"/);
  assert.doesNotMatch(adminHtml,/documentationCategoryOptions/);
  assert.match(adminJs,/const rows=\['Briefing Internal','Pendampingan & Konsultasi','Rapat Lainnya'\]/);
});
