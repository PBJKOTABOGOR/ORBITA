'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const source=fs.readFileSync(path.join(__dirname,'../backend/Code-TRAXPBJ-Pemilihan.gs'),'utf8');
function fixture(){
  const ctx=vm.createContext({console,Date,Math,JSON,Logger:{log(){}}});
  vm.runInContext(source,ctx);
  const team=[{pokja_id:'PKJ-ALPHA',nama:'POKJA 1',active:true},{pokja_id:'PKJ-BETA',nama:'POKJA 3',active:true}];
  const members=[{user_id:'U1',pokja_id:'PKJ-ALPHA',active:true},{user_id:'U1',pokja_id:'PKJ-BETA',active:true},{user_id:'U2',pokja_id:'PKJ-ALPHA',active:true}];
  const users=[{user_id:'U1',role:'POKJA',pokja_id:'PKJ-ALPHA',active:true,email:'multitim@bogor.go.id'},{user_id:'U2',role:'POKJA',pokja_id:'PKJ-ALPHA',active:true,email:'satutim@bogor.go.id'},{user_id:'U3',role:'KEPALA_UKPBJ',active:true,email:'kepala@bogor.go.id'}];
  const out=[];
  ctx.sheet_=n=>n;
  ctx.rows_=n=>n==='PBJ_USERS'?users:n==='PBJ_POKJA'?team:n==='PBJ_POKJA_MEMBERS'?members:[];
  ctx.findRow_=(_sh,col,id)=>col==='pokja_id'?{obj:team.find(t=>t.pokja_id===id)}:null;
  ctx.ensureUserEmailSchema_=()=>{};
  ctx.ensureMailQueueTrigger_=()=>{};
  ctx.mailQueue_=(key,email,subject,body)=>{out.push({key,email,subject,body});return true;};
  return {ctx,out};
}
const baseReq={request_id:'P-555-01',judul_permohonan:'Belanja Perlengkapan Laboratorium',nama_paket:'Nama RUP Lama',kode_rup:'555',opd:'DINAS KESEHATAN',assigned_pokja_id:'PKJ-BETA'};
test('Email Pokja mencantumkan POKJA 3 dari penugasan paket, bukan Pokja aktif akun',()=>{
  const {ctx,out}=fixture();
  ctx.notifyPokjaStatus_(baseReq,'DISPOSISI','Periksa dokumen',1);
  assert.equal(out.length,1);
  assert.equal(out[0].email,'multitim@bogor.go.id');
  assert.match(out[0].subject,/\[POKJA 3\].*Penugasan Paket kepada Pokja/);
  assert.match(out[0].body,/^Ditujukan untuk: POKJA 3/);
  assert.match(out[0].body,/Judul Permohonan: Belanja Perlengkapan Laboratorium/);
  assert.match(out[0].body,/Nomor Permohonan: P-555-01/);
});
test('PPK kirim ulang dan detail mini kompetisi mencantumkan Pokja yang sama',()=>{
  const {ctx,out}=fixture();
  ctx.notifyPokjaStatus_(baseReq,'PPK_KIRIM_ULANG','Dokumen diperbaiki',2);
  ctx.notifyPokjaStatus_(baseReq,'PPK_DETAIL_LENGKAP','Sudah lengkap',3);
  assert.equal(out.length,2);
  assert.ok(out.every(mail=>mail.subject.includes('[POKJA 3]')&&mail.body.includes('Ditujukan untuk: POKJA 3')));
  assert.match(out[0].body,/Catatan PPK: Dokumen diperbaiki/);
});
test('Penugasan POKJA 1 hanya ditujukan ke anggota Pokja 1 dan label berganti sesuai paket',()=>{
  const {ctx,out}=fixture();
  ctx.notifyPokjaStatus_({...baseReq,request_id:'P-555-02',assigned_pokja_id:'PKJ-ALPHA'},'DISPOSISI','',1);
  assert.equal(out.length,2);
  assert.ok(out.every(mail=>mail.subject.includes('[POKJA 1]')&&mail.body.includes('Ditujukan untuk: POKJA 1')));
  assert.deepEqual(out.map(x=>x.email).sort(),['multitim@bogor.go.id','satutim@bogor.go.id']);
});
test('Email Kepala UKPBJ, PPK dan format pengirim email tidak berubah',()=>{
  const {ctx,out}=fixture();
  ctx.notifyAccountUsers_(baseReq,'KEPALA_UKPBJ','PERMOHONAN_BARU',{title:'Permohonan Baru',text:'Perlu disposisi',next:'Lihat detail'});
  assert.equal(out.length,1);
  assert.doesNotMatch(out[0].subject,/\[POKJA/);
  assert.doesNotMatch(out[0].body,/Ditujukan untuk: POKJA/);
  const mail=ctx.ppkStatusMail_(baseReq,'MINI_DETAIL','Lengkapi rincian');
  assert.doesNotMatch(mail.subject,/\[POKJA/);
  assert.ok(source.includes("function formatOrbitaNoticeBody_(eventKey,body)"));
});
test('Sapaan email ORBITA dan nama Pokja tampil dalam HTML email asli',()=>{
  const {ctx,out}=fixture();
  ctx.notifyPokjaStatus_(baseReq,'DISPOSISI','',1);
  const e=out[0];
  const message=ctx.formatOrbitaNoticeBody_(e.key,e.body);
  assert.ok(message.startsWith('🚀 Halo, Orbiters!'));
  assert.ok(message.includes('Ditujukan untuk: POKJA 3'));
  assert.ok(message.endsWith('Salam ORBITA! 🚀'));
  const sender=vm.createContext({Date,Math,Number,String,JSON});
  vm.runInContext(fs.readFileSync(path.join(__dirname,'../backend/Code-ORBITA-Email-Sender.gs'),'utf8'),sender);
  const html=sender.orbitaEmailHTML_(e.subject,message,e.key);
  assert.ok(html.includes('POKJA 3'));
  assert.ok(html.includes('Belanja Perlengkapan Laboratorium'));
  assert.ok(html.includes('Buka ORBITA PBJ'));
});
