'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const backend=fs.readFileSync(path.join(root,'backend/Code-TRAXPBJ-Pemilihan.gs'),'utf8');
const frontend=fs.readFileSync(path.join(root,'assets/js/selection.js'),'utf8');
const html=fs.readFileSync(path.join(root,'profil-pbj/index.html'),'utf8');
const sw=fs.readFileSync(path.join(root,'sw.js'),'utf8');
const ppk={user_id:'ppkA',role:'PPK'},pokja={user_id:'pokjaA',role:'POKJA',pokja_id:'pokja-1'},head={user_id:'headA',role:'KEPALA_UKPBJ'},admin={user_id:'adm',role:'ADMIN'};
function runtime(){
  const c=vm.createContext({console,Date,Math,JSON,Array,Set,Intl,Utilities:{getUuid:()=>'test',formatDate:()=> '2026-10-21'}});vm.runInContext(backend,c);
  const reqs=[{request_id:'P-1',nama_paket:'Hotmix',ppk_user_id:'ppkA',assigned_pokja_id:'pokja-1',status:'REVIU_POKJA'}];
  const audits=[
    {audit_id:'A1',created_at:'2026-10-21T01:00:00Z',action:'SUBMIT_REQUEST',request_id:'P-1',user_id:'ppkA'},
    {audit_id:'A2',created_at:'2026-10-21T02:00:00Z',action:'ASSIGN_POKJA',request_id:'P-1',user_id:'headA'},
    {audit_id:'A3',created_at:'2026-10-21T03:00:00Z',action:'KIRIM_UNDANGAN_KAJI',request_id:'P-1',user_id:'pokjaA'},
    {audit_id:'A4',created_at:'2026-10-21T04:00:00Z',action:'KAJI_ULANG_PERBAIKAN',request_id:'P-1',user_id:'pokjaA'},
    {audit_id:'A5',created_at:'2026-10-21T05:00:00Z',action:'RESUBMIT_KAJI_REVISION',request_id:'P-1',user_id:'ppkA'},
    {audit_id:'A6',created_at:'2026-10-21T06:00:00Z',action:'NEGO_HANDOVER',request_id:'P-1',user_id:'pokjaA'},
    {audit_id:'A7',created_at:'2026-10-21T07:00:00Z',action:'START_REVIEW',request_id:'P-1',user_id:'pokjaA'},
  ];
  const broadcasts=[{notification_id:'BC-target',created_at:'2026-10-21T08:00:00Z',target_roles:'["PPK","POKJA"]',title:'Informasi OPD',message:'Rapat hari Senin',request_id:'',active:true}];
  const tables={PBJ_PERMOHONAN:reqs,PBJ_AUDIT_LOG:audits,PBJ_NOTIFIKASI:broadcasts,PBJ_NOTIFIKASI_BACA:[]};
  Object.assign(c,{
    sheet_:key=>key,notificationSheets_:()=>({broadcast:'PBJ_NOTIFIKASI',reads:'PBJ_NOTIFIKASI_BACA'}),
    notificationTail_:(key,limit)=>(tables[key]||[]).slice(-limit).reverse(),
    rows_:key=>tables[key]||[],
    findRow_:(key,field,id)=>{const index=(tables[key]||[]).findIndex(x=>String(x[field])===String(id));return index<0?null:{row:index+2,obj:tables[key][index]};},
    updateRow_:(key,row,patch)=>Object.assign(tables[key][row-2],patch),
    appendObj_:(key,obj)=>(tables[key]||[]).push({...obj})
  });
  return c;
}
test('PPK menerima tindak lanjutnya saja; penugasan, start review, dan balasan PPK tidak muncul',()=>{
  const c=runtime(),d=c.listNotifications_(ppk);
  assert.deepEqual([...d.items.map(x=>x.id)].sort(),['A3','A4','A6','BC-target'].sort());
  assert.equal(d.unread,4);
  assert.throws(()=>c.readNotification_(ppk,{id:'A2'}),/tidak ditemukan|akses/i);
  assert.throws(()=>c.readNotification_(ppk,{id:'A7'}),/tidak ditemukan|akses/i);
  assert.equal(c.readNotification_(ppk,{id:'A3'}).read,true);
  assert.equal(c.listNotifications_(ppk).unread,3);
});
test('Pokja menerima disposisi dan tindak lanjut PPK, bukan peringatan untuk PPK',()=>{
  const c=runtime(),d=c.listNotifications_(pokja);
  assert.deepEqual([...d.items.map(x=>x.id)].sort(),['A2','A5','BC-target'].sort());
  assert.equal(d.unread,3);
  assert.throws(()=>c.readNotification_(pokja,{id:'A4'}),/tidak ditemukan|akses/i);
});
test('Kepala UKPBJ hanya mendapat permohonan yang perlu didisposisikan',()=>{
  const c=runtime(),d=c.listNotifications_(head);
  assert.deepEqual([...d.items.map(x=>x.id)],['A1']);
});
test('Broadcast tetap ditampilkan untuk role pilihan, tidak menjadi notifikasi otomatis role lain',()=>{
  const c=runtime();assert.ok(c.listNotifications_(ppk).items.some(x=>x.id==='BC-target'));assert.ok(c.listNotifications_(pokja).items.some(x=>x.id==='BC-target'));assert.equal(c.listNotifications_(admin).items.length,0);
});
test('Frontend/backend sepakat catatan minimal 5 karakter termasuk satu kata aiueo',()=>{
  const c=runtime();
  assert.equal(c.characterCount_('aiueo'),5);
  assert.equal(c.characterCount_(' a  '),1);
  assert.equal(c.characterCount_('abcd'),4);
  assert.equal(c.characterCount_(' lima'),4);
  assert.match(frontend,/const characterCount=value=>Array\.from\(String\(value\|\|''\)\.trim\(\)\)\.length/);
  assert.match(frontend,/characterCount\(note\)<5/);
  assert.match(frontend,/Minimal 5 karakter\./);
  assert.match(frontend,/5 karakter/);
  assert.doesNotMatch(frontend,/Minimal 5 kata|wordCount\(/);
  const req={request_id:'P-1',status:'PERLU_PERBAIKAN_PPK',workflow_scheme:'KAJI_ULANG_2026',current_round:1};
  const out=[];
  Object.assign(c,{requireRole_:()=>{},getRequestAuthorized_:()=>req,assertDocsComplete_:()=>{},appendNote_:(_,id,phase,st,note)=>out.push(note),updateRequest_:(_,patch)=>Object.assign(req,patch),audit_:()=>{},notifyPokjaStatus_:()=>{},getRequest_:()=>req,publicRequest_:()=>req});
  assert.throws(()=>c.resubmitRevision_(ppk,{requestId:req.request_id,note:'abcd'}),/minimal 5 karakter/i);
  assert.equal(req.status,'PERLU_PERBAIKAN_PPK');
  assert.equal(c.resubmitRevision_(ppk,{requestId:req.request_id,note:'aiueo'}).status,'REVIU_ULANG');
  assert.equal(out[0],'aiueo');
});
test('Aset pilihan benar, notif warna/animasi dan backend interface tidak diubah',()=>{
  assert.match(html,/selection\.js\?v=28\.(?:42|44|45)/);
  assert.match(sw,/selection\.js\?v=28\.(?:42|44|45)/);
  assert.match(sw,/orbita-pbj-shell-v28-(?:42-role-ppk-note|44-broadcast|45-notice-page)/);
  assert.match(html,/notifications\.js\?v=28\.(?:41|44|45)/);
  assert.match(html,/notifications\.css\?v=28\.(?:41|44|45)/);
});
