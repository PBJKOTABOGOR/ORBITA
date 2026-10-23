const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const read=p=>fs.readFileSync(new URL('../'+p,'file://'+__filename),'utf8');
const html=read('profil-pbj/index.html');
const timeline=read('assets/js/orbita-docs-timeline.js');
const store=read('assets/js/content-store.js');
const admin=read('admin/index.html');
const backend=read('backend/Code-TRAXPBJ-CMS.gs');

test('Dokumentasi menggabungkan kegiatan, agenda dan Surat PBJ di satu timeline',()=>{
  assert.match(html,/orbita-docs-timeline\.js\?v=27\.(?:54|55|56)/);
  assert.doesNotMatch(html,/orbita-docs-hub\.js/);
  assert.match(timeline,/DEFAULT_CATEGORIES=\['Briefing Internal','Pendampingan & Konsultasi','Rapat Lainnya','Agenda','Surat PBJ'\]/);
  assert.match(timeline,/category:'Agenda'/);
  assert.match(timeline,/category:'Surat PBJ'/);
  assert.match(timeline,/return \[\.\.\.documentation/);
});

test('bootstrap content carries Surat PBJ and admin can sync Drive',()=>{
  assert.match(store,/suratPBJ:mapSurat/);
  assert.match(admin,/site-surat-admin\.js/);
  assert.match(backend,/SURAT_PBJ_FOLDER_ID:\s*'12xMo_kwfYi2l4g7XsLYwh9mniQ0ye6KW'/);
  assert.match(backend,/action === 'suratPBJ'/);
  assert.match(backend,/action === 'syncSuratPBJ'/);
  assert.match(backend,/function setupSuratPBJSync\(/);
});
