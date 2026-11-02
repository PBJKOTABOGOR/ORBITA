'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const backend=fs.readFileSync(path.join(root,'backend/Code-TRAXPBJ-Pemilihan.gs'),'utf8');
const selection=fs.readFileSync(path.join(root,'assets/js/selection.js'),'utf8');
const notices=fs.readFileSync(path.join(root,'assets/js/notifications.js'),'utf8');
const css=fs.readFileSync(path.join(root,'assets/css/notifications.css'),'utf8');
const html=fs.readFileSync(path.join(root,'profil-pbj/index.html'),'utf8');
const sw=fs.readFileSync(path.join(root,'sw.js'),'utf8');
function apiMock(){
 const tables={PBJ_NOTIFIKASI:[],PBJ_NOTIFIKASI_BACA:[],PBJ_AUDIT_LOG:[],PBJ_PERMOHONAN:[]};
 const c=vm.createContext({console,Date,Math,JSON,Array,Set,Intl,Utilities:{getUuid:()=>'1234-5678',formatDate:()=> '2026-10-22'},DriveApp:{Access:{ANYONE_WITH_LINK:'ANYONE_WITH_LINK'},Permission:{VIEW:'VIEW'}}});
 vm.runInContext(backend,c);
 const drive={name:'TMP_DIRECT_FILE.pdf',shared:false,getId:()=> 'FILE01',getUrl:()=> 'https://drive.google.com/file/d/FILE01/view',setName(name){this.name=name},setSharing(access,permission){if(access==='ANYONE_WITH_LINK'&&permission==='VIEW')this.shared=true}};
 Object.assign(c,{
   sheet_:key=>key,notificationSheets_:()=>({broadcast:'PBJ_NOTIFIKASI',reads:'PBJ_NOTIFIKASI_BACA'}),
   notificationTail_:(key,limit)=>(tables[key]||[]).slice(-limit).reverse(),
   rows_:key=>tables[key]||[],
   findRow_:(key,field,id)=>{const i=(tables[key]||[]).findIndex(x=>String(x[field])===String(id));return i<0?null:{row:i+2,obj:tables[key][i]};},
   appendObj_:(key,obj)=>(tables[key]||[]).push({...obj}),
   updateRow_:(key,row,patch)=>Object.assign(tables[key][row-2],patch),
   getRequest_:()=>null,
   getVerifiedDirectDriveFile_:()=>drive,
   verifyDirectUploadClaims_:()=>({docType:'BROADCAST_ATTACHMENT',fileName:'Info-ATK.pdf'}),
   headers_:()=>['notification_id','attachment_url']
 });
 return {c,tables,drive,users:{admin:{role:'ADMIN',user_id:'adm'},ppk:{role:'PPK',user_id:'ppk'},pokja:{role:'POKJA',user_id:'team'},head:{role:'KEPALA_UKPBJ',user_id:'head'}}};
}
test('Broadcast role PPK/POKJA tersimpan dan terlihat, akun lain tidak',()=>{
 const {c,users,tables}=apiMock();
 const payload={title:'Konsolidasi ATK',message:'Isi formulir www.google.com',roles:['PPK','POKJA'],requestId:'',clientId:'bc_role_20261022'};
 assert.equal(c.sendBroadcast_(users.admin,payload).duplicate,false);
 assert.equal(c.sendBroadcast_(users.admin,payload).duplicate,true);
 assert.equal(tables.PBJ_NOTIFIKASI.length,1);
 assert.equal(c.listNotifications_(users.ppk).items[0].title,'Konsolidasi ATK');
 assert.equal(c.listNotifications_(users.pokja).items[0].title,'Konsolidasi ATK');
 assert.equal(c.listNotifications_(users.head).items.length,0);
});
test('Lampiran diverifikasi dan tersimpan bersama broadcast untuk penerima',()=>{
 const {c,users,drive,tables}=apiMock();
 const payload={title:'Berkas baru',message:'Lihat lampiran',roles:['PPK'],requestId:'',clientId:'bc_file_20261022',attachment:{ticket:'signed-ticket',driveFileId:'FILE01'}};
 const result=c.sendBroadcast_(users.admin,payload);
 assert.equal(result.attachment_name,'Info-ATK.pdf');assert.equal(drive.shared,true);
 assert.equal(drive.name,'Info-ATK.pdf');
 assert.equal(tables.PBJ_NOTIFIKASI[0].attachment_url,'https://drive.google.com/file/d/FILE01/view');
 const item=c.listNotifications_(users.ppk).items[0];
 assert.equal(item.attachment_name,'Info-ATK.pdf');assert.equal(item.attachment_url,tables.PBJ_NOTIFIKASI[0].attachment_url);
 assert.equal(c.listNotifications_(users.pokja).items.length,0);
});
test('Upload BROADCAST hanya admin dan memanfaatkan folder terpisah',()=>{
 const {c,users}=apiMock();
 Object.assign(c,{
  getOrCreateWorkflowFolder_:()=>({}),getOrCreateChildFolder_:()=>({getId:()=> 'BROADCASTFOLDER'}),
  sanitizeFileName_:name=>name
 });
 const payload={purpose:'BROADCAST',requestId:'',file:{name:'undangan.pdf',mimeType:'application/pdf',sizeBytes:2000}};
 const context=c.directUploadContext_(users.admin,payload);
 assert.equal(context.purpose,'BROADCAST');assert.equal(context.req.folder_id,'BROADCASTFOLDER');
 assert.equal(context.docType,'BROADCAST_ATTACHMENT');
 assert.throws(()=>c.directUploadContext_(users.ppk,payload),/role|akses|kewenangan/i);
 assert.throws(()=>c.directUploadContext_(users.admin,{...payload,file:{...payload.file,name:'script.html'}}),/PDF|Office|ZIP/i);
});
test('Tautan teks broadcast aman, www dan https bisa diklik, HTML dieksekusi tidak',()=>{
 const hook='  sessionChange();';
 const code=notices.replace(hook, "  window.__noticeTest={messageLinks,noticeTone};\n"+hook);
 const node=()=>({hidden:true,innerHTML:'',classList:{remove(){},add(){},toggle(){}},dataset:{},addEventListener(){},setAttribute(){},textContent:''});
 const elements={};for(const id of ['orbitNotice','orbitNoticeTrigger','orbitNoticeMenu','orbitNoticeList','orbitNoticeCount'])elements['#'+id]=node();
 const window={addEventListener(){},TRAXPBJ_SESSION:{getProvider:()=>null}};
 const context=vm.createContext({window,URL,document:{querySelector:id=>elements[id]||null,addEventListener(){}},setTimeout:()=>0,clearTimeout(){},setInterval:()=>0,clearInterval(){},console,Date,Math,JSON});
 vm.runInContext(code,context);
 const text=window.__noticeTest.messageLinks('Buka www.google.com dan https://contoh.id/form. <img src=x onerror=alert(1)>');
 assert.match(text,/href="https:\/\/www.google.com\//);
 assert.match(text,/href="https:\/\/contoh.id\/form"/);
 assert.match(text,/&lt;img/);assert.doesNotMatch(text,/<img/);
 assert.doesNotMatch(text,/javascript:/);
});
test('Audit Log default tertutup, pembuka tersedia, dan semua aset versi baru aktif',()=>{
 assert.match(selection,/data-admin-audit-content hidden/);
 assert.match(selection,/data-admin-audit-toggle aria-expanded="false"/);
 assert.match(selection,/body.hidden=!body.hidden/);
 assert.match(selection,/id="selBroadcastFile"/);
 assert.match(selection,/purpose:'BROADCAST'/);
 assert.match(selection,/trax:broadcast-sent/);
 assert.match(notices,/messageLinks\(n.message\)/);
 assert.match(notices,/data-orbit-notice-row/);
 assert.match(notices,/window.addEventListener\?\.\('focus'/);
 assert.match(css,/sel-admin-audit/);
 for(const content of [html,sw])for(const asset of ['notifications.js','notifications.css','selection.js'])assert.match(content,new RegExp(asset.replace('.','\\.')+'\\?v=28\\.(?:44|45)'));
 assert.match(sw,/orbita-pbj-shell-v28-(?:44-broadcast|45-notice-page)/);
});
