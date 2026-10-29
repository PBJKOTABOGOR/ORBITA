'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const backend=fs.readFileSync(path.join(root,'backend/Code-TRAXPBJ-Pemilihan.gs'),'utf8');
const front=fs.readFileSync(path.join(root,'assets/js/selection.js'),'utf8');
function mock(){
  const c=vm.createContext({console,Date,Number,Math,JSON,String});vm.runInContext(backend,c);
  let r={request_id:'P-TEST-01',selection_process:'NEGOSIASI',status:'SIAP_PROSES_INAPROC',nego_stage:'SIAP_NEGOSIASI',ppk_email:'ppk@example.id',current_round:1},audits=[],mails=[],docsRead=0;
  c.requireRole_=(user,roles)=>{if(!roles.includes(user.role))throw Error('Tidak berwenang')};
  c.getRequestAuthorized_=()=>r;
  c.getRequest_=()=>r;
  c.publicRequest_=x=>({...x});
  c.updateRequest_=(_id,patch)=>Object.assign(r,patch);
  c.audit_=(_user,action,_requestId,detail)=>audits.push({action,detail});
  c.notifyPpkStatus_=(_r,kind,detail)=>mails.push({kind,detail});
  c.currentDocs_=()=>{docsRead++;return []};
  c.ensureRequestSchema_=()=>{};
  return {c,get r(){return r},audits,mails,get docsRead(){return docsRead}};
}
const pokja={role:'POKJA',user_id:'USR-1'};
test('Pembatalan setelah diverifikasi menyimpan BATAL, audit & notifikasi sekali, tanpa dokumen Handover',()=>{
 const x=mock();
 const result=x.c.negoWorkflow_(pokja,{requestId:'P-TEST-01',step:'BATAL',reason:'PESANAN_TIDAK_DAPAT_DIPENUHI',inaprocCancelled:true,note:'Nomor transaksi uji 42'});
 assert.equal(result.status,'BATAL');assert.equal(result.nego_stage,'BATAL');assert.equal(x.docsRead,0);
 assert.equal(x.audits.length,1);assert.equal(x.audits[0].action,'NEGO_BATAL');assert.match(x.audits[0].detail.note,/Nomor transaksi uji 42/);
 assert.deepEqual(x.mails.map(x=>x.kind),['NEGO_BATAL']);
 assert.throws(()=>x.c.negoWorkflow_(pokja,{requestId:'P-TEST-01',step:'BATAL',reason:'PESANAN_TIDAK_DAPAT_DIPENUHI',inaprocCancelled:true}),/Tahapan Negosiasi sudah berubah/);
});
test('Belum dikonfirmasi, salah alasan, atau dicoba lewat HANDOVER tidak dapat membatalkan',()=>{
 const x=mock();
 assert.throws(()=>x.c.negoWorkflow_(pokja,{step:'BATAL',reason:'PESANAN_TIDAK_DAPAT_DIPENUHI'}),/Pastikan Negosiasi/);
 assert.throws(()=>x.c.negoWorkflow_(pokja,{step:'BATAL',reason:'DITOLAK_HARGA',inaprocCancelled:true}),/Pilih alasan/);
 assert.throws(()=>x.c.negoWorkflow_(pokja,{step:'HANDOVER'}),/wajib diunggah/);
 assert.equal(x.r.status,'SIAP_PROSES_INAPROC');assert.equal(x.audits.length,0);
});
test('Bukan proses Negosiasi, sudah Handover, sudah BATAL: ditolak backend',()=>{
 const x=mock();
 x.r.selection_process='MINI_KOMPETISI';assert.throws(()=>x.c.negoWorkflow_(pokja,{step:'BATAL'}),/hanya untuk Negosiasi/);
 x.r.selection_process='NEGOSIASI';x.r.nego_stage='HANDOVER';assert.throws(()=>x.c.negoWorkflow_(pokja,{step:'BATAL'}),/Tahapan Negosiasi sudah berubah/);
 x.r.nego_stage='SIAP_NEGOSIASI';x.r.status='BATAL';assert.throws(()=>x.c.negoWorkflow_(pokja,{step:'BATAL'}),/Tahapan Negosiasi sudah berubah/);
});
test('Form punya alasan tetap, checkbox verifikasi, tombol Handover tetap ada',()=>{
 assert.match(front,/data-nego-action="BATAL"/);
 assert.match(front,/data-nego-action="HANDOVER"/);
 assert.match(front,/selNegoCancelVerified/);
 assert.match(front,/PESANAN_TIDAK_DAPAT_DIPENUHI/);
 assert.match(front,/NEGO_BATAL:'Negosiasi dibatalkan/);
});
test('Notifikasi dan status Riwayat tercatat',()=>{
 const c=vm.createContext({Date,Number,JSON,Math,String});vm.runInContext(backend,c);
 assert.equal(vm.runInContext('PBJ_NOTIFICATION_EVENTS.NEGO_BATAL[1]',c),'PPK');
 const mail=c.ppkStatusMail_({request_id:'P-001',kode_rup:'123',nama_paket:'Paket',opd:'Dinas',ppk_nama:'PPK'},'NEGO_BATAL','Pesanan tidak bisa dipenuhi');
 assert.ok(mail.subject.includes('Negosiasi Dibatalkan'));assert.ok(mail.body.includes('Pesanan tidak bisa dipenuhi'));
});
