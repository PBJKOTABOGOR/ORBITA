const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.join(__dirname,'..');
const html=fs.readFileSync(path.join(root,'profil-pbj/index.html'),'utf8');
const js=fs.readFileSync(path.join(root,'assets/js/profile.js'),'utf8');
const rapor=fs.readFileSync(path.join(root,'assets/js/rapor-kota.js'),'utf8');
test('topbar right side contains only the primary portal login control',()=>{
  const top=html.match(/<header class="topbar">([\s\S]*?)<\/header>/)?.[1]||'';
  assert.match(top,/data-portal-login/);
  assert.match(top,/top-login-primary/);
  assert.doesNotMatch(top,/id="profileNav"|id="chapterButton"/);
});
test('middle navigation has hierarchical Home, Ruang PBJ and highlighted quick access',()=>{
  assert.match(html,/class="main-nav main-nav-mega"/);
  assert.match(html,/PROFIL PBJ[\s\S]*Pimpinan PBJ[\s\S]*Tim PBJ/);
  assert.match(html,/LPSE[\s\S]*SPSE[\s\S]*Helpdesk LPSE/);
  assert.match(html,/PEMBINAAN &amp; ADVOKASI[\s\S]*SDM PBJ[\s\S]*Dokumentasi/);
  assert.match(html,/PENGELOLAAN PBJ[\s\S]*Permohonan Pemilihan[\s\S]*Perhatian &amp; Tindak Lanjut/);
  assert.match(html,/quick-access[\s\S]*SIPPBJ[\s\S]*DASH-SIPPBJ[\s\S]*Dokumentasi/);
  assert.match(js,/data-top-control/);
  assert.match(js,/data-top-service/);
});
test('rapor keeps previous-month period logic and scopes analysis notes separately',()=>{
  assert.match(rapor,/month===1\?\{year:year-1,month:12\}:\{year,month:month-1\}/);
  assert.match(rapor,/analysisRowsForScope/);
  assert.match(rapor,/KOTA BOGOR|kota bogor/);
});
