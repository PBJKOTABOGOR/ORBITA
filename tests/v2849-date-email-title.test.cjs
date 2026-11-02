'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.resolve(__dirname,'..');
const backend=fs.readFileSync(path.join(root,'backend/Code-TRAXPBJ-Pemilihan.gs'),'utf8');
const frontend=fs.readFileSync(path.join(root,'assets/js/selection.js'),'utf8');
function build(){const context=vm.createContext({});vm.runInContext(backend,context);return context;}

test('Bantuan judul yang tidak perlu dihapus, input tetap tersedia',()=>{
  assert.match(frontend,/id="newRequestTitle"/);
  assert.doesNotMatch(frontend,/Judul ini tampil pada permohonan\. Nama paket RUP tetap sesuai SiRUP\./);
});

test('Tanggal tidak valid dari sel Sheets tidak menimbulkan Invalid time value',()=>{
  const ctx=build();
  assert.equal(vm.runInContext("normalizeCell_(new Date('INVALID'))",ctx),'');
  assert.equal(vm.runInContext("normalizeCell_(new Date('2026-10-22T07:00:00Z'))",ctx),'2026-10-22T07:00:00.000Z');
  assert.equal(vm.runInContext("normalizeCell_('January 2026')",ctx),'January 2026');
  assert.equal(vm.runInContext("requestDateYmd_(new Date('INVALID'))",ctx),'');
  assert.equal(vm.runInContext("requestTimeHHmm_(new Date('INVALID'))",ctx),'');
});

test('Email PPK memakai judul permohonan, bukan nama paket RUP',()=>{
 const ctx=build();
 const response=vm.runInContext(`(function(){
  const req={request_id:'P-62584457-01',judul_permohonan:'Jasa Kebersihan Gedung Kantor',nama_paket:'Belanja Jasa Tenaga Kebersihan',kode_rup:'62584457',metode_pengadaan:'E-Purchasing',ppk_nama:'Ben',ppk_email:'ben@example.com',opd:'DINAS PUPR',selection_process:'NEGOSIASI'};
  return {subject:requestMailSubject_('Undangan Kaji Ulang',req),ppk:ppkStatusMail_(req,'KAJI_PERBAIKAN','Mohon perbaikan.'),handover:handoverMailBody_(req,'Negosiasi'),fallback:requestMailTitle_({nama_paket:'Paket Lawas'})};
 })()`,ctx);
 assert.match(response.subject,/Jasa Kebersihan Gedung Kantor/);
 assert.match(response.ppk.subject,/Jasa Kebersihan Gedung Kantor/);
 assert.match(response.ppk.body,/Judul Permohonan: Jasa Kebersihan Gedung Kantor/);
 assert.match(response.handover,/Judul Permohonan: Jasa Kebersihan Gedung Kantor/);
 assert.equal(response.fallback,'Paket Lawas');
 assert.match(backend,/Judul Permohonan: '\+requestMailTitle_\(req\)/);
 assert.match(backend,/requestMailSubject_\('Undangan Kaji Ulang',req\)/);
 assert.match(backend,/notifyAccountUsers_\(req,'KEPALA_UKPBJ','PERMOHONAN_BARU'/);
 assert.match(backend,/const subject=requestMailSubject_\(message.title,req\)/);
 assert.match(backend,/requestMailSubject_\('Penyampaian Hasil Pemilihan',req\)/);
});
