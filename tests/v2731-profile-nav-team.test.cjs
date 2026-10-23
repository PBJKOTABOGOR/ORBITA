const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.join(__dirname,'..');
const profile=fs.readFileSync(path.join(root,'assets/js/profile.js'),'utf8');
const content=fs.readFileSync(path.join(root,'assets/js/site-content.js'),'utf8');
const css=fs.readFileSync(path.join(root,'assets/css/profile.css'),'utf8');
const html=fs.readFileSync(path.join(root,'profil-pbj/index.html'),'utf8');
const sw=fs.readFileSync(path.join(root,'sw.js'),'utf8');

test('topbar destination state follows scroll so returning to profile top restores navigation',()=>{
  assert.match(profile,/topnav-destination-active',scrollY>threshold/);
  assert.match(profile,/syncTopbarDestination\(\);/);
  assert.match(css,/body\.topnav-destination-active \.topbar/);
});

test('main navigation and submenu share the same regular SPSE typography',()=>{
  assert.match(css,/--nav-font:12\.75px/);
  assert.match(css,/\.main-nav-dropdown a,[\s\S]*font-weight:500!important/);
  assert.match(css,/\.main-nav-mega>a,[\s\S]*font-size:var\(--nav-font\)!important/);
});

test('team rail follows vertical scroll and keeps manual dragging',()=>{
  assert.match(content,/function syncTeamScroll\(\)/);
  assert.match(content,/rail\.scrollLeft=max\*progress/);
  assert.match(content,/addEventListener\('scroll',scheduleTeamScroll/);
  assert.match(content,/rail\.onpointerdown=/);
});

test('back to top control appears after the opening profile page and scrolls home',()=>{
  assert.match(html,/id="backToTop"/);
  assert.match(profile,/backToTop\.classList\.toggle\('show',scrollY>innerHeight\*\.82\)/);
  assert.match(profile,/window\.scrollTo\(\{top:0,behavior:'smooth'\}\)/);
  assert.match(css,/\.back-to-top\.show/);
});

test('v27.33 shell cache is current',()=>assert.match(sw,/orbita-pbj-shell-v27-(?:34-back-team-selection|38-hard-home-back|49-docs-hub-surat|50-docs-unified-five-lines|54-docs-hover-surat-preview|55-surat-action-only|56-edukasi-doc|57-constellation-bg|58-constellation-interactive|59-atomic-room)/));
