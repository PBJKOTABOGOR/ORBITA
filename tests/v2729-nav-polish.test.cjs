const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.join(__dirname,'..');
const css=fs.readFileSync(path.join(root,'assets/css/profile.css'),'utf8');
const portalCss=fs.readFileSync(path.join(root,'assets/css/portal-session.css'),'utf8');
const js=fs.readFileSync(path.join(root,'assets/js/profile.js'),'utf8');
const session=fs.readFileSync(path.join(root,'assets/js/portal-session.js'),'utf8');
test('center navigation is viewport-centered and quick access uses the same navigation sizing',()=>{
  assert.match(css,/\.main-nav-mega\{[\s\S]*position:absolute;[\s\S]*left:50%;[\s\S]*transform:translate\(-50%,-50%\)/);
  assert.match(css,/--nav-h:38px/);
  assert.match(css,/\.main-nav-mega \.quick-trigger\{[\s\S]*height:var\(--nav-h\)[\s\S]*font:800 var\(--nav-font\)/);
});
test('dropdowns stay open briefly while the pointer crosses into the submenu',()=>{
  assert.match(css,/\.main-nav-mega>\.main-nav-item\.has-dropdown:after/);
  assert.match(js,/scheduleTopDropdownClose/);
  assert.match(js,/260/);
  assert.match(js,/pointerenter/);
  assert.match(js,/pointerleave/);
});
test('top navigation layers above modules and OPD identity is emphasized',()=>{
  assert.match(css,/\.topbar\{overflow:visible!important;isolation:isolate;z-index:620!important\}/);
  assert.match(css,/\.main-nav-dropdown\{[\s\S]*background:#fff/);
  assert.match(portalCss,/\.portal-scope:not\(\[hidden\]\)::before/);
  assert.match(portalCss,/font-weight:900/);
  assert.match(session,/Satuan kerja aktif/);
});
