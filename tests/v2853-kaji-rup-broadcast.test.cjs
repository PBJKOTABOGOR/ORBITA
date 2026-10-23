'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const backend=fs.readFileSync(path.join(root,'backend/Code-TRAXPBJ-Pemilihan.gs'),'utf8');
const selection=fs.readFileSync(path.join(root,'assets/js/selection.js'),'utf8');
const notifications=fs.readFileSync(path.join(root,'assets/js/notifications.js'),'utf8');
function context(){const c=vm.createContext({console,Date,Math,JSON,Array,Set,Intl,Utilities:{formatDate:()=> '2026-10-23'},DriveApp:{Access:{ANYONE_WITH_LINK:'LINK'},Permission:{VIEW:'VIEW'}}});vm.runInContext(backend,c);return c;}
function miniFlow(mode){
 const c=context(),updates=[],mails=[],logs=[];
 const req={request_id:'P-65213822-13',workflow_scheme:'KAJI_ULANG_2026',status:'REVIU_POKJA',current_round:1,selection_process:'PERSIAPAN',ppk_email:'ppk@example.com',hps_alokasi:4000000};
 Object.assign(c,{getRequestAuthorized_:()=>req,currentDocs_:()=>[{doc_type:'BA_KAJI_ULANG',doc_id:'DOC-1',uploaded_at:'2026-10-23T09:00:00Z'}],updateRequest_:(id,patch)=>{updates.push(patch);Object.assign(req,patch)},appendNote_:()=>{},audit_:(...args)=>logs.push(args),notifyPpkStatus_:(...args)=>mails.push(args),requestDetail_:()=>({request:req})});
 const payload={requestId:req.request_id,decision:'LANJUT',date:'2026-10-23',selectionProcess:'MINI_KOMPETISI',competitionType:'CONSTRUCTION',miniDetailMode:mode};
 c.submitKajiUlang_({role:'POKJA',user_id:'pokja'},payload);
 return {req,updates,mails,logs};
}
test('Kaji ulang: pilihan langsung melewati form PPK tapi tetap SIAP_TAYANG Pokja',()=>{
 const {req,mails}=miniFlow('LANGSUNG');
 assert.equal(req.status,'SIAP_PROSES_INAPROC');assert.equal(req.mini_stage,'SIAP_TAYANG');assert.ok(req.details_submitted_at);assert.equal(mails.length,0);
});
test('Kaji ulang: pilihan PPK mempertahankan alur pengisian detail lama',()=>{
 const {req,mails}=miniFlow('PPK');assert.equal(req.status,'PERLU_DETAIL_PPK');assert.equal(req.mini_stage,'');assert.equal(mails.length,1);
});
test('Admin update RUP: per nomor permohonan, cek OPD, pagu, dan audit perubahan',()=>{
 const c=context(),writes=[],audits=[];
 const req={request_id:'P-65213822-13',kode_rup:'65213822',pagu:1000000000,opd:'DINAS KESEHATAN',status:'SIAP_PROSES_INAPROC',hps_alokasi:100000000};
 Object.assign(c,{sheet_:()=> 'SHEET',findRow_:()=>({row:2,obj:req}),lookupRup_:()=>({kodeRup:'66990001',opd:'DINAS KESEHATAN',pagu:2000000000}),rupAllocationTotal_:()=>100000000,updateRow_:(sh,row,patch)=>writes.push(patch),audit_:(...args)=>audits.push(args)});
 const result=c.adminUpdateRequestRup_({role:'ADMIN',user_id:'adm'},{requestId:req.request_id,oldCode:req.kode_rup,newCode:'66990001'});
 assert.equal(result.kode_rup,'66990001');assert.equal(writes[0].kode_rup,'66990001');assert.equal(writes[0].pagu,2000000000);assert.equal(writes[0].status,undefined);assert.equal(audits[0][1],'ADMIN_UPDATE_RUP');
});
test('Admin update RUP: perubahan lintas OPD ditolak',()=>{
 const c=context(),req={request_id:'P-123-01',kode_rup:'12312312',opd:'DINAS KESEHATAN',status:'REVIU_POKJA',hps_alokasi:1000};
 Object.assign(c,{sheet_:()=> 'SHEET',findRow_:()=>({row:2,obj:req}),lookupRup_:()=>({opd:'DINAS PUPR',pagu:1000000000})});
 assert.throws(()=>c.adminUpdateRequestRup_({role:'ADMIN'},{requestId:req.request_id,oldCode:req.kode_rup,newCode:'88998899'}),/OPD yang sama/);
});
test('Multi-file broadcast: dua lampiran disimpan dan kompatibel dengan file lama',()=>{
 const c=context(),rows=[],files={},storage='SH';
 Object.assign(c,{notificationSheets_:()=>({broadcast:storage}),findRow_:()=>null,appendObj_:(sh,obj)=>rows.push(obj),verifyDirectUploadClaims_:(u,t)=>({docType:'BROADCAST_ATTACHMENT',fileName:'Dokumen '+(t.ticket==='a'?'A':'B')+'.pdf'}),getVerifiedDirectDriveFile_:(claim,id)=>files[id]||(files[id]={getId:()=>id,getUrl:()=> 'https://drive.google.com/file/d/'+id,setName:()=>{},setSharing:()=>{}}),headers_:()=>['notification_id','attachment_name','attachment_url'],getRequest_:()=>({request_id:'abc'})});
 const result=c.sendBroadcast_({role:'ADMIN',user_id:'adm'},{title:'Pengumuman',message:'Ada dua lampiran',roles:['PPK'],requestId:'',clientId:'orb12345678',attachments:[{ticket:'a',driveFileId:'A1'},{ticket:'b',driveFileId:'B1'}]});
 assert.equal(result.attachment_count,2);assert.equal(JSON.parse(rows[0].attachments_json).length,2);assert.equal(rows[0].attachment_file_id,'A1');
});
test('Frontend menyediakan pilihan Mini, RUP admin, file multiple dan daftar tautan aman',()=>{
 for(const key of ['Minta PPK Lengkapi Detail','Langsung ke Penayangan','miniDetailMode','adminUpdateRequestRup','adminSearchRupRequests','multiple accept'])assert.ok(selection.includes(key),key);
 assert.ok(notifications.includes('attachments_json'));
 assert.ok(backend.includes('formatOrbitaNoticeBody_'));
});
