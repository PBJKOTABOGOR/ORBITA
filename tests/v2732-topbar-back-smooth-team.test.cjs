const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.join(__dirname,'..');
const profile=fs.readFileSync(path.join(root,'assets/js/profile.js'),'utf8');
const forum=fs.readFileSync(path.join(root,'assets/js/forum.js'),'utf8');
const control=fs.readFileSync(path.join(root,'assets/js/control-room.js'),'utf8');
const evalJs=fs.readFileSync(path.join(root,'assets/js/evaluation.js'),'utf8');
const advocacy=fs.readFileSync(path.join(root,'assets/js/advocacy-portal.js'),'utf8');
const content=fs.readFileSync(path.join(root,'assets/js/site-content.js'),'utf8');
const css=fs.readFileSync(path.join(root,'assets/css/profile.css'),'utf8');

test('topbar-opened internal modules remember their source and return home',()=>{
  assert.match(profile,/markTopbarEntry\(/);
  assert.match(profile,/TRAXPBJ_RETURN_PROFILE_HOME/);
  for(const src of [forum,control,evalJs,advocacy]){
    assert.match(src,/fromTopbar:window\.TRAXPBJ_CONSUME_TOPBAR_ENTRY/);
    assert.match(src,/TRAXPBJ_RETURN_PROFILE_HOME/);
  }
});

test('team movement is driven by vertical scroll instead of autoplay',()=>{
  assert.match(content,/function syncTeamScroll\(\)/);
  assert.match(content,/rail\.scrollLeft=max\*progress/);
  assert.match(content,/requestAnimationFrame\(\(\)=>\{teamScrollRaf=0;syncTeamScroll\(\)\}\)/);
  assert.doesNotMatch(content,/setInterval\(autoStep/);
  assert.match(css,/team-scroll-travel/);
});

test('topbar font grows slightly while keeping one shared size',()=>{
  assert.match(css,/\.main-nav-mega\{--nav-font:12\.75px\}/);
  assert.match(css,/font-size:var\(--nav-font\)!important/);
});
