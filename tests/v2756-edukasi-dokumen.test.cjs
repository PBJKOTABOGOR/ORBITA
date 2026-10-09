const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const backend=fs.readFileSync(path.join(root,'backend/Code-TRAXPBJ-CMS.gs'),'utf8');
const admin=fs.readFileSync(path.join(root,'assets/js/admin.js'),'utf8');
const adminHtml=fs.readFileSync(path.join(root,'admin/index.html'),'utf8');
const store=fs.readFileSync(path.join(root,'assets/js/content-store.js'),'utf8');
const advocacy=fs.readFileSync(path.join(root,'assets/js/advocacy-portal.js'),'utf8');
const docs=fs.readFileSync(path.join(root,'assets/js/orbita-docs-timeline.js'),'utf8');
const sw=fs.readFileSync(path.join(root,'sw.js'),'utf8');

test('edukasi sheet schema and backend persist one optional Drive document',()=>{
  assert.match(backend,/EDUKASI_FOLDER_ID:\s*'1vQg8onte8aYu5wt4_4YWM2DPcCUoHiPT'/);
  assert.match(backend,/EDUKASI_KEGIATAN:[^\n]*'file_id','file_url','nama_file','mime_type'/);
  assert.match(backend,/saveUploadedFileToFolderId_\(TRAX\.EDUKASI_FOLDER_ID, body\.file/);
  assert.match(backend,/fileUrl:\s*str_\(r\.file_url\) \|\| driveViewUrl_\(r\.file_id\)/);
  assert.match(backend,/deleteRowBy_\('EDUKASI_KEGIATAN', 'id', id, true\)/);
});

test('admin can upload event document without replacing the existing document unless a new file is selected',()=>{
  assert.match(adminHtml,/id="eventDocumentFile"/);
  assert.match(adminHtml,/>Tautan Materi</);
  assert.match(admin,/const picked=\$\('#eventDocumentFile'\)\?\.files\?\.\[0\]\|\|null/);
  assert.match(admin,/API\.fileToPayload\(picked,\{maxBytes:8\*1024\*1024/);
  assert.match(admin,/\.\.\.\(file\?\{file\}:\{\}\)/);
  assert.match(admin,/Dokumen saat ini:/);
});

test('public education cards show document and material as separate optional buttons',()=>{
  assert.match(store,/documentUrl:r\.fileUrl\|\|''/);
  assert.match(advocacy,/x\.documentUrl\?`<a[^`]*Buka dokumen ↗/);
  assert.match(advocacy,/x\.materialUrl\?`<a[^`]*Materi ↗/);
});

test('documentation Agenda shows document/material buttons without loading document preview',()=>{
  assert.match(docs,/documentUrl:x\.documentUrl\|\|'',materialUrl:x\.materialUrl\|\|''/);
  assert.match(docs,/if\(isAgenda&&d\.documentUrl\)actionLinks\.push/);
  assert.match(docs,/if\(isAgenda&&d\.materialUrl\)actionLinks\.push/);
  assert.match(docs,/if\(isAgenda\)\{\s*host\.hidden=true;host\.innerHTML=''/);
});

test('v27.56 cache busting is active',()=>{
  assert.match(sw,/orbita-pbj-shell-v27-(?:56-edukasi-doc|57-constellation-bg|58-constellation-interactive|59-atomic-room)/);
  assert.match(sw,/orbita-docs-timeline\.js\?v=27\.56/);
  assert.match(sw,/advocacy-portal\.js\?v=27\.56/);
});
