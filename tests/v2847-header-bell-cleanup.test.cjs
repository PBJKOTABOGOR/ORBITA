'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.join(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const html=read('profil-pbj/index.html');
const css=read('assets/css/control-room.css');
const bellCss=read('assets/css/notifications.css');
const roomJs=read('assets/js/control-room.js');
const sw=read('sw.js');

test('Header Pemilihan hanya satu, user ditampilkan pada header utama',()=>{
 assert.match(roomJs,/h2\.textContent='Permohonan Pemilihan'/);
 assert.doesNotMatch(roomJs,/Permohonan Pemilihan <span>Permohonan & Reviu Pokja<\/span>/);
 assert.match(css,/body\.proc-selection-open \.sel-app>\.sel-top\{display:none!important\}/);
 assert.match(html,/id="procSelectionAccount" hidden/);
 assert.match(html,/id="procSelectionAccountName"/);
 assert.match(html,/id="procSelectionAccountRole"/);
 assert.match(roomJs,/document\.addEventListener\('trax:session-change',syncSelectionAccount\)/);
});
test('Header tetap menampilkan identitas sesuai role dan disembunyikan saat modul lain',()=>{
 const start=roomJs.indexOf('  function syncSelectionAccount(){');
 const end=roomJs.indexOf('  function syncRoomHeading(){',start);
 assert.ok(start>0&&end>start);
 const code=roomJs.slice(start,end);
 const els=Object.fromEntries(['#procSelectionAccount','#procSelectionAccountName','#procSelectionAccountRole'].map(k=>[k,{hidden:true,textContent:''}]));
 let activeModule='selection',person={nama:'Tes Pokja',role:'POKJA'};
 const context={window:{TRAXPBJ_SESSION:{getProvider:()=> 'pbj',getUser:()=>person}},$:k=>els[k],activeModule};
 vm.runInNewContext(code+';syncSelectionAccount();',context);
 assert.equal(els['#procSelectionAccount'].hidden,false);
 assert.equal(els['#procSelectionAccountName'].textContent,'Tes Pokja');
 assert.equal(els['#procSelectionAccountRole'].textContent,'Pokja Pemilihan');
 context.activeModule='overview';
 vm.runInNewContext('syncSelectionAccount();',context);
 assert.equal(els['#procSelectionAccount'].hidden,true);
});
test('Lonceng sederhana tanpa border ataupun ornamen orbit',()=>{
 assert.doesNotMatch(html,/orbit-notice-cosmos/);
 assert.match(bellCss,/\.orbit-notice-trigger\{width:42px;height:42px;border:0/);
 assert.match(bellCss,/\.orbit-notice-trigger:before,\.orbit-notice-trigger:after\{content:none!important;display:none!important\}/);
 assert.match(bellCss,/\.orbit-notice-trigger\.is-ring svg\{animation:orbitBellRing/);
 assert.match(bellCss,/prefers-reduced-motion:reduce/);
});
test('Versi cache diperbarui dan sesuai file yang dimuat',()=>{
 assert.match(sw,/orbita-pbj-shell-v28-47-header-bell/);
 for(const suffix of ['assets/css/control-room.css?v=28.47','assets/js/control-room.js?v=28.47','assets/css/notifications.css?v=28.47']){
  assert.ok(sw.includes(suffix),suffix+' tidak tercatat di SW');
  assert.ok(html.includes('../'+suffix),suffix+' tidak tercatat di HTML');
 }
});
test('Cuma tiga catatan update terakhir dan backend tidak tersentuh',()=>{
 const notes=fs.readdirSync(root).filter(f=>/^CATATAN_UPDATE_v.*\.txt$/.test(f)).sort();
 assert.deepEqual(notes,['CATATAN_UPDATE_v28.45.txt','CATATAN_UPDATE_v28.46.txt','CATATAN_UPDATE_v28.47.txt']);
 assert.ok(read('backend/Code-TRAXPBJ-Pemilihan.gs').includes('function listNotifications_'));
});
