'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const html=fs.readFileSync(path.join(root,'profil-pbj/index.html'),'utf8');
const css=fs.readFileSync(path.join(root,'assets/css/portal-session.css'),'utf8');
const js=fs.readFileSync(path.join(root,'assets/js/portal-session.js'),'utf8');
const sw=fs.readFileSync(path.join(root,'sw.js'),'utf8');
function loginMock(){
  const els=new Map();
  function node(id){
    const attrs={};const classes=new Set();const handlers={};
    const n={id,attrs,handlers,hidden:true,disabled:false,value:'',type:id==='portalPassword'?'password':'text',title:'',
      setAttribute:(key,v)=>{attrs[key]=String(v);},addEventListener:(name,fn)=>{handlers[name]=fn;},
      classList:{toggle:(key,on)=>on?classes.add(key):classes.delete(key),contains:key=>classes.has(key)}};
    els.set(id,n);return n;
  }
  const ids=['portalLogin','portalAccount','portalLoginForm','portalLoginProgress','portalProvider','portalUsername','portalPassword','portalPasswordToggle','portalAccountName','portalAccountOffice','portalContentManager','portalSelectionLink','portalLogout','portalSubmit','portalError'];
  ids.forEach(node);
  const lookup=sel=>els.get(String(sel).replace(/^#/,''))||null;
  const api={hasSession:()=>false};
  const context=vm.createContext({window:{TRAXPBJ_SELECTION_API:api},document:{querySelector:lookup,getElementById:lookup,querySelectorAll:()=>[],addEventListener(){},dispatchEvent(){}},CustomEvent:class{},sessionStorage:{getItem:()=>null,setItem(){},removeItem(){}},URLSearchParams,location:{search:''},setTimeout:()=>0,console});
  vm.runInContext(js,context);
  return {els,session:context.window.TRAXPBJ_SESSION};
}
test('ikon mata ada di dalam input dan bukan tombol submit',()=>{
  assert.match(html, /<button type="button" id="portalPasswordToggle"/);
  assert.match(html, /aria-controls="portalPassword"/);
  assert.match(html, /<label for="portalPassword">Password<\/label>/);
  assert.match(css, /#portalPasswordToggle/);
  assert.match(css, /form\.authenticating>\.portal-password-field\{display:none\}/);
});
test('password bisa dilihat dan disembunyikan lewat satu tombol, tanpa mengubah value',()=>{
  const {els}=loginMock();const input=els.get('portalPassword'),button=els.get('portalPasswordToggle');
  input.value='kataSandi123';
  assert.equal(input.type,'password');
  button.handlers.click();
  assert.equal(input.type,'text');assert.equal(input.value,'kataSandi123');
  assert.equal(button.attrs['aria-pressed'],'true');assert.equal(button.attrs['aria-label'],'Sembunyikan password');
  button.handlers.click();
  assert.equal(input.type,'password');assert.equal(input.value,'kataSandi123');
  assert.equal(button.attrs['aria-pressed'],'false');assert.equal(button.attrs['aria-label'],'Lihat password');
});
test('popup login dibuka/ditutup: password selalu kembali tertutup',()=>{
  const {els,session}=loginMock();const input=els.get('portalPassword'),button=els.get('portalPasswordToggle');
  session.open();button.handlers.click();assert.equal(input.type,'text');
  session.close();assert.equal(input.type,'password');
  session.open();assert.equal(input.type,'password');
});
test('versi CSS dan JS sinkron pada HTML serta service worker',()=>{
  for(const source of [html,sw]){
    assert.match(source,/portal-session\.css\?v=28\.43/);
    assert.match(source,/portal-session\.js\?v=28\.43/);
  }
  assert.match(sw,/orbita-pbj-shell-v28-(?:43-password-eye|44-broadcast|45-notice-page|47-header-bell)/);
});
