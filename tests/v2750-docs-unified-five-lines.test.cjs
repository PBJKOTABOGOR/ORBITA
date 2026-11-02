const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const read=p=>fs.readFileSync(new URL('../'+p,'file://'+__filename),'utf8');
const html=read('profil-pbj/index.html');
const js=read('assets/js/orbita-docs-timeline.js');

test('Dokumentasi uses one viewport with five default lines',()=>{
  assert.match(js,/DEFAULT_CATEGORIES=\['Briefing Internal','Pendampingan & Konsultasi','Rapat Lainnya','Agenda','Surat PBJ'\]/);
  assert.match(html,/id="docsTimelineViewport"/);
  assert.doesNotMatch(html,/orbita-docs-hub\.js/);
});

test('Agenda and Surat PBJ are normalized as timeline items',()=>{
  assert.match(js,/const agenda=.*\.map\(x=>\(\{/s);
  assert.match(js,/category:'Agenda'/);
  assert.match(js,/const surat=.*\.map\(x=>\(\{/s);
  assert.match(js,/category:'Surat PBJ'/);
  assert.match(js,/actionLabel:'Buka surat'/);
});
