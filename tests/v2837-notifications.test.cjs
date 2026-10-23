const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const base=path.join(__dirname,'..');
const code=fs.readFileSync(path.join(base,'backend/Code-TRAXPBJ-Pemilihan.gs'),'utf8');
function fixture(){
  const requests=[
    {request_id:'R-1',nama_paket:'Paket OPD Satu',ppk_user_id:'ppk1',assigned_pokja_id:'team1',status:'REVIU_POKJA'},
    {request_id:'R-2',nama_paket:'Rahasia OPD Dua',ppk_user_id:'ppk2',assigned_pokja_id:'team2',status:'REVIU_POKJA'},
    {request_id:'R-DRAFT',nama_paket:'Draft OPD Dua',ppk_user_id:'ppk2',status:'DRAFT'}
  ];
  const times=['2026-10-21T09:00:00.000Z','2026-10-21T09:01:00.000Z','2026-10-21T09:02:00.000Z','2026-10-21T09:03:00.000Z','2026-10-21T09:04:00.000Z'];
  const audit=[
    {audit_id:'AUD1',action:'SUBMIT_REQUEST',request_id:'R-1',user_id:'ppk1',created_at:times[0]},
    {audit_id:'AUD2',action:'ASSIGN_POKJA',request_id:'R-1',user_id:'head',created_at:times[1]},
    {audit_id:'AUD3',action:'SEND_REVISION',request_id:'R-1',user_id:'pokja1',created_at:times[2]},
    {audit_id:'AUD4',action:'SEND_REVISION',request_id:'R-2',user_id:'pokja2',created_at:times[3]},
    {audit_id:'AUD5',action:'SUBMIT_REQUEST',request_id:'R-DRAFT',user_id:'ppk2',created_at:times[4]}
  ];
  const broadcasts=[{notification_id:'BC-preexisting01',title:'Pengumuman OPD',message:'Silakan periksa jadwal',target_roles:'["PPK"]',created_at:times[1],request_id:'',active:true}];
  const reads=[];
  const t={PBJ_PERMOHONAN:requests,PBJ_AUDIT_LOG:audit,PBJ_NOTIFIKASI:broadcasts,PBJ_NOTIFIKASI_BACA:reads};
  const context=vm.createContext({console,Date,JSON,Math,Set,Array,Intl,Utilities:{getUuid:()=>'aaa-bbb',formatDate:()=> '261021090000'},LockService:{getScriptLock:()=>({tryLock:()=>true,releaseLock(){}})}});
  vm.runInContext(code,context);
  Object.assign(context,{
    sheet_:key=>key,
    notificationSheets_:()=>({broadcast:'PBJ_NOTIFIKASI',reads:'PBJ_NOTIFIKASI_BACA'}),
    notificationTail_:(sh,lim)=>(t[sh]||[]).slice(-lim).reverse(),
    rows_:key=>t[key]||[],
    findRow_:(sh,key,val)=>{const i=(t[sh]||[]).findIndex(x=>String(x[key])===String(val));return i<0?null:{row:i+2,obj:t[sh][i]};},
    appendObj_:(sh,obj)=>(t[sh]||[]).push({...obj}),
    updateRow_:(sh,row,patch)=>Object.assign(t[sh][row-2],patch),
    getRequest_:id=>requests.find(r=>r.request_id===id)||null
  });
  return {c:context,t,users:{ppk1:{user_id:'ppk1',role:'PPK'},ppk2:{user_id:'ppk2',role:'PPK'},head:{user_id:'head',role:'KEPALA_UKPBJ'},pokja1:{user_id:'pokja1',role:'POKJA',pokja_id:'team1'},pokja2:{user_id:'pokja2',role:'POKJA',pokja_id:'team2'},admin:{user_id:'admin',role:'ADMIN'}}};
}
test('Notifikasi paket menyesuaikan pemilik dan penugasan Pokja',()=>{
  const {c,users}=fixture();
  const ppk=c.listNotifications_(users.ppk1).items;
  assert.deepEqual([...ppk.map(x=>x.id)].sort(),['AUD3','BC-preexisting01'].sort());
  assert.ok(!JSON.stringify(ppk).includes('Rahasia OPD Dua'));
  const pokja=c.listNotifications_(users.pokja1).items;
  assert.deepEqual([...pokja.map(x=>x.id)],['AUD2']);
  const head=c.listNotifications_(users.head).items;
  assert.ok(head.some(n=>n.id==='AUD1'));
  assert.ok(!head.some(n=>n.id==='AUD5'),'Draft tidak muncul kepada Kepala UKPBJ');
});
test('Status dibaca tersimpan sesuai akun, bukan global',()=>{
  const {c,users}=fixture();
  assert.equal(c.listNotifications_(users.ppk1).unread,2);
  assert.equal(c.readNotification_(users.ppk1,{id:'AUD3'}).read,true);
  assert.equal(c.listNotifications_(users.ppk1).unread,1);
  assert.equal(c.listNotifications_(users.ppk2).unread,2);
});
test('Akun asing tidak dapat menandai baca paket milik pengguna lain',()=>{
  const {c,users}=fixture();
  assert.throws(()=>c.readNotification_(users.ppk2,{id:'AUD3'}),/akses|ditemukan/i);
  assert.throws(()=>c.readNotification_(users.ppk1,{id:'AUD2'}),/akses|ditemukan/i);
  assert.throws(()=>c.readNotification_(users.pokja2,{id:'AUD2'}),/akses|ditemukan/i);
  assert.throws(()=>c.readNotification_(users.pokja1,{id:'BC-preexisting01'}),/akses|ditemukan/i);
});
test('Broadcast hanya ADMIN, target role wajib, dan idempoten',()=>{
  const {c,users,t}=fixture();
  const payload={title:'Info Sosialisasi',message:'Kegiatan Senin pagi',roles:['PPK','POKJA'],clientId:'abcdefghijklmnop',requestId:''};
  assert.throws(()=>c.sendBroadcast_(users.ppk1,payload),/akses|role|izin|berwenang|kewenangan/i);
  assert.throws(()=>c.sendBroadcast_(users.admin,{...payload,roles:[]}),/role/i);
  assert.throws(()=>c.sendBroadcast_(users.admin,{...payload,roles:['PPK','BADROLE']}),/role/i);
  assert.equal(c.sendBroadcast_(users.admin,payload).duplicate,false);
  assert.equal(c.sendBroadcast_(users.admin,payload).duplicate,true);
  assert.equal(t.PBJ_NOTIFIKASI.length,2);
  assert.ok(c.listNotifications_(users.ppk1).items.some(x=>x.title==='Info Sosialisasi'));
  assert.ok(c.listNotifications_(users.pokja1).items.some(x=>x.title==='Info Sosialisasi'));
  assert.ok(!c.listNotifications_(users.head).items.some(x=>x.title==='Info Sosialisasi'));
});
test('Tombol lonceng dan form broadcast ada, tanpa menghapus komponen lama',()=>{
  const html=fs.readFileSync(path.join(base,'profil-pbj/index.html'),'utf8');
  const sel=fs.readFileSync(path.join(base,'assets/js/selection.js'),'utf8');
  const api=fs.readFileSync(path.join(base,'assets/js/selection-api.js'),'utf8');
  assert.match(html,/id="orbitNoticeTrigger"/);
  assert.match(html,/data-portal-login/);
  assert.match(html,/notifications\.js\?v=28\.(?:37|41|44|45)/);
  assert.match(sel,/id="selBroadcastForm"/);
  assert.match(sel,/data-sel-view/);
  assert.match(api,/listNotifications/);
});
