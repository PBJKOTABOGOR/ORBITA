const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const js=fs.readFileSync(path.join(root,'assets/js/orbita-docs-timeline.js'),'utf8');
const page=fs.readFileSync(path.join(root,'profil-pbj/index.html'),'utf8');
const sw=fs.readFileSync(path.join(root,'sw.js'),'utf8');

test('detail action never leaks Buka surat outside Surat PBJ and Agenda uses its own links',()=>{
  assert.match(js,/if\(isSurat&&d\.actionUrl\)actionLinks\.push\(\{url:d\.actionUrl,label:'Buka surat'\}\)/);
  assert.match(js,/if\(isAgenda&&d\.documentUrl\)actionLinks\.push\(\{url:d\.documentUrl,label:'Buka dokumen'\}\)/);
  assert.match(js,/if\(isAgenda&&d\.materialUrl\)actionLinks\.push\(\{url:d\.materialUrl,label:'Buka materi'\}\)/);
  assert.doesNotMatch(js,/isAgenda&&d\.actionUrl[^\n]*Buka surat/);
});

test('latest documentation cache refs are used',()=>{
  assert.match(page,/orbita-docs-timeline\.js\?v=27\.(?:55|56)/);
  assert.match(page,/docs-timeline\.css\?v=27\.(?:55|56)/);
  assert.match(sw,/v27-(?:55-surat-action-only|56-edukasi-doc|57-constellation-bg|58-constellation-interactive|59-atomic-room)/);
});
