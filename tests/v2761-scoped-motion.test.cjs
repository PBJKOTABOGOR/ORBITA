const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.join(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');

test('v27.61 account loader uses particle/orbit progress without changing login fields',()=>{
  const html=read('profil-pbj/index.html'), css=read('assets/css/portal-session.css'), js=read('assets/js/portal-session.js');
  assert.match(html,/portal-auth-stage/);assert.match(html,/auth-ring ring-a/);assert.match(html,/auth-particle p8/);
  assert.match(css,/portal-card-ambient/);assert.match(css,/portal-particle-drift/);assert.match(js,/AUTH_PHASES/);
  assert.match(html,/id="portalUsername"/);assert.match(html,/id="portalPassword"/);
});

test('ITKP and data headings follow scoped OPD while signed-out copy remains Kota Bogor',()=>{
  const html=read('profil-pbj/index.html'), js=read('assets/js/profile.js');
  assert.match(html,/id="itkpScopeTitle">Capaian ITKP Kota Bogor/);
  assert.match(html,/id="dataScopeTitle">Profil Pengadaan Kota Bogor/);
  assert.match(js,/Capaian ITKP \$\{scoped\?opd:city\}/);
  assert.match(js,/Profil Pengadaan \$\{scoped\?opd:city\}/);
  assert.match(js,/itkpSearchWrap/);
});

test('Rapor loads the current OPD scope and keeps city fallback for signed-out users',()=>{
  const js=read('assets/js/rapor-kota.js');
  assert.match(js,/const scopeOpd=/);assert.match(js,/scopeOpd\(\)\|\|'KOTA BOGOR'/);
  assert.match(js,/latestScopeIndexRows/);assert.match(js,/scopeQuery\(matched\)/);
  assert.match(js,/RAPOR PBJ PERANGKAT DAERAH/);assert.match(js,/RAPOR PBJ KOTA BOGOR/);
  assert.match(js,/scopeItkp/);
});

test('award motion layer is isolated to ITKP, data and Rapor scenes',()=>{
  const html=read('profil-pbj/index.html'), js=read('assets/js/orbita-section-motion.js'), css=read('assets/css/profile.css');
  assert.match(html,/orbita-section-motion\.js\?v=27\.61/);
  assert.match(js,/#itkp,#rekam,#rapor-kota/);assert.match(js,/MutationObserver/);
  assert.match(css,/ORBITA v27\.61 · DATA SCENES/);assert.match(css,/orbita-card-hot/);
});
