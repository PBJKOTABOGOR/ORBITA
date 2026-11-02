'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'..');
const read=f=>fs.readFileSync(path.join(root,f),'utf8');
const notices=read('assets/js/notifications.js');
const selection=read('assets/js/selection.js');
const backend=read('backend/Code-TRAXPBJ-Pemilihan.gs');
const html=read('profil-pbj/index.html');
const css=read('assets/css/notifications.css');
function dom(){
 const els={};const events={};
 const node=id=>{const classes=new Set();return {id,hidden:true,innerHTML:'',textContent:'',value:'',disabled:false,scrollTo(){},offsetWidth:40,dataset:{},classList:{add:(...names)=>names.forEach(x=>classes.add(x)),remove:(...names)=>names.forEach(x=>classes.delete(x)),toggle:(name,force)=>{if(force===undefined)force=!classes.has(name);force?classes.add(name):classes.delete(name);return force},contains:name=>classes.has(name)},setAttribute(){},removeAttribute(){},addEventListener(event,cb){(events[id+':'+event]||=[]).push(cb)}};};
 for(const id of ['orbitNotice','orbitNoticeTrigger','orbitNoticeMenu','orbitNoticeList','orbitNoticeCount','notifikasi','orbitNoticePageList','orbitNoticePageCount','orbitNoticeType','orbitNoticeMonth','orbitNoticeYear','orbitNoticePageRange','orbitNoticePageNumber','orbitNoticePager','orbitNoticePrev','orbitNoticeNext','orbitNoticeAll','orbitNoticePageBack','orbitNoticePageRefresh','orbitNoticeRefresh'])els['#'+id]=node(id);
 let hash='#home';const location={get hash(){return hash},set hash(v){hash=v},pathname:'/profil-pbj/index.html',search:''};
 const history={state:{},pushState(state,_,url){this.state=state;hash=url.split('#')[1]?'#'+url.split('#')[1]:'';},replaceState(state,_,url){this.state=state;hash=url.split('#')[1]?'#'+url.split('#')[1]:'';},back(){hash='#home'}};
 const items=Array.from({length:12},(_,i)=>({id:'BC-'+i,type:i%2===0?'broadcast':'permohonan',title:'Berita '+i,message:'Isi '+i,created_at:`${i<8?'2026-10':'2025-09'}-${String(22-i%8).padStart(2,'0')}T02:00:00.000Z`,read:i%3===0,request_id:''}));
 const calls=[];const api={hasSession:()=>true,call:(action,payload)=>{calls.push({action,payload});return Promise.resolve({data:{items,unread:items.filter(x=>!x.read).length}})}};
 const session={getProvider:()=> 'pbj',getUser:()=>({user_id:'ppk2',role:'PPK'})};
 const window={TRAXPBJ_SELECTION_API:api,TRAXPBJ_SESSION:session,addEventListener(){},TRAXPBJ_CONTROL_ROOM:{close(){}},location};
 const body={classList:node('body').classList};
 const document={body,hidden:false,querySelector:selector=>els[selector]||null,addEventListener(){},dispatchEvent(){}};
 const code=notices.replace('  sessionChange();','  window.__testV2845={paint,renderPage,openPage,filteredPageItems,dateParts,rebuildPageFilters,loadArchive,setData:v=>{data=v},setArchive:v=>{archiveData=v},getData:()=>data};\n  sessionChange();');
 const sandbox={window,document,location,history,URL,Intl,Date,Math,JSON,Array,Set,Promise,console,setTimeout:()=>1,clearTimeout(){},setInterval:()=>1,clearInterval(){},CustomEvent:class{}};
 vm.runInNewContext(code,sandbox,{timeout:15000});
 return {app:window.__testV2845,els,events,items,calls,location,history};
}
test('Lonceng hanya merender 5 notifikasi teratas, tautan dan lampiran tetap ada',()=>{
 const x=dom();x.app.setData({items:x.items,unread:7});x.app.paint();
 const rendered=x.els['#orbitNoticeList'].innerHTML;
 assert.equal((rendered.match(/data-orbit-notice-row=/g)||[]).length,5);
 assert.match(rendered,/Berita 0/);assert.match(rendered,/Berita 4/);assert.doesNotMatch(rendered,/Berita 5/);
 assert.equal(x.els['#orbitNoticeCount'].textContent,'7');
});
test('Halaman notifikasi memuat semua item, bisa difilter jenis, bulan dan tahun, serta dipaginasi',async()=>{
 const x=dom();x.app.openPage();await x.app.loadArchive();
 assert.equal(x.location.hash,'#notifikasi');assert.equal(x.els['#notifikasi'].hidden,false);
 assert.equal((x.els['#orbitNoticePageList'].innerHTML.match(/data-orbit-notice-row=/g)||[]).length,10);
 assert.equal(x.els['#orbitNoticeNext'].disabled,false);
 x.els['#orbitNoticeType'].value='broadcast';x.app.renderPage();
 assert.equal((x.els['#orbitNoticePageList'].innerHTML.match(/data-orbit-notice-row=/g)||[]).length,6);
 x.els['#orbitNoticeYear'].value='2025';x.app.renderPage();
 assert.equal(x.app.filteredPageItems().length,2);
 x.els['#orbitNoticeMonth'].value='09';x.app.renderPage();assert.equal(x.app.filteredPageItems().length,2);
 x.els['#orbitNoticeMonth'].value='10';x.app.renderPage();assert.match(x.els['#orbitNoticePageList'].innerHTML,/Tidak ada notifikasi/);
 assert.ok(x.calls.some(c=>c.action==='listNotifications'&&c.payload.archive===true));
});
test('Konfirmasi broadcast dan progres upload riil, bukan simulasi waktu',()=>{
 assert.match(selection,/confirmCritical\(\{eyebrow:'KONFIRMASI BROADCAST'/);
 assert.match(selection,/title:'Kirim pemberitahuan ini\?'/);
 assert.match(selection,/yes:'Ya, kirim',no:'Periksa lagi'/);
 assert.match(selection,/function broadcastProcess\(/);
 assert.match(selection,/onProgress:pct=>proc\.upload\(pct\)/);
 assert.match(selection,/proc\.waiting\('Menyimpan broadcast dan penerimanya…'\)/);
 assert.doesNotMatch(selection.match(/function broadcastProcess\([\s\S]+?function createRoute\(/)?.[0]||'',/setInterval/);
 assert.match(css,/orbitBroadcastWait/);
});
test('Backend mengambil riwayat penuh hanya pada permintaan halaman archive',()=>{
 assert.match(backend,/notificationCandidates_\(user,\{archive:payload\.archive===true\}\)/);
 assert.match(backend,/return archive\?result:result\.slice\(0,85\)/);
 assert.match(backend,/archive\?Math\.max\(0,auditSheet\.getLastRow\(\)-1\):360/);
 for(const name of ['orbitNoticeAll','orbitNoticePageList','orbitNoticeYear','orbitNoticeMonth','orbitNoticeType'])assert.ok(html.includes(`id="${name}"`),name);
 for(const value of ['notifications.js','notifications.css','selection.js'])assert.match(html,new RegExp(value.replace('.','\\.')+'\\?v=28\\.45'));
 assert.match(read('sw.js'),/v28-45-notice-page/);
});
test('Riwayat backend tidak dipotong 85 saat membuka halaman, tetapi lonceng tetap ringan',()=>{
 const c=vm.createContext({console,Date,Math,JSON,Set,Array,Intl});vm.runInContext(backend,c,{timeout:15000});
 const notices=Array.from({length:115},(_,i)=>({notification_id:'BC-'+String(i),created_at:new Date(Date.UTC(2026,9,22,0,i)).toISOString(),active:true,target_roles:'["PPK"]',request_id:'',title:'Pesan '+i,message:'Info '+i}));
 const broadcast={getLastRow:()=>notices.length+1},audit={getLastRow:()=>1};
 Object.assign(c,{notificationSheets_:()=>({broadcast,reads:{}}),sheet_:()=>audit,notificationTail_:(sh,limit)=>sh===broadcast?notices.slice(-limit).reverse():[],findRow_:()=>null,rows_:()=>[]});
 const user={role:'PPK',user_id:'ppk-1'};
 const compact=c.listNotifications_(user);
 const archive=c.listNotifications_(user,{archive:true});
 assert.equal(compact.items.length,85);
 assert.equal(archive.items.length,115);
 assert.equal(archive.unread,115);
 assert.equal(archive.items[0].title,'Pesan 114');
});
