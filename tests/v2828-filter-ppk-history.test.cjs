'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.resolve(__dirname,'..');
const front=fs.readFileSync(path.join(root,'assets/js/selection.js'),'utf8');
const backend=fs.readFileSync(path.join(root,'backend/Code-TRAXPBJ-Pemilihan.gs'),'utf8');
const html=fs.readFileSync(path.join(root,'profil-pbj/index.html'),'utf8');
const sw=fs.readFileSync(path.join(root,'sw.js'),'utf8');
const context=()=>{const c=vm.createContext({Date,Number,String,Math,JSON,console});vm.runInContext(backend,c);return c};
test('dropdown diringkas jadi 5 status dan backend menerima kelompok baru',()=>{
 const match=front.match(/const filterOptions=(\[.*?\]);const listHtml=/);
 assert.ok(match);
 const opts=vm.runInNewContext(match[1]);
 assert.equal(opts.length,5);assert.deepEqual([...opts.map(x=>x[1])],['Semua status','Draft','Dalam proses','Selesai','Ditolak / Batal']);
 assert.equal((backend.match(/GROUP_ONGOING:/g)||[]).length,2);
 assert.equal((backend.match(/GROUP_CLOSED:/g)||[]).length,2);
});
test('riwayat PPK hanya dari OPD yang sama, hanya pengajuan yang pernah dikirim, dan terbaru menang',()=>{
 const c=context();const user={role:'PPK',opd:'DINAS KESEHATAN'};
 c.requireRole_=()=>{};c.norm_=s=>String(s||'').toLowerCase().trim();c.sheet_=x=>x;
 const rows=[
  {opd:'DINAS KESEHATAN',ppk_nama:'Siti Aminah',ppk_email:'lama@contoh.id',status:'DIAJUKAN',submitted_at:'2025-02-01'},
  {opd:'DINAS KESEHATAN',ppk_nama:'Siti Aminah',ppk_email:'baru@contoh.id',status:'PROSES_INAPROC',submitted_at:'2026-02-01'},
  {opd:'DINAS KESEHATAN',ppk_nama:'Rudi Firmansyah',ppk_email:'rudi@contoh.id',status:'DIAJUKAN',submitted_at:'2026-01-01'},
  {opd:'DINAS KESEHATAN',ppk_nama:'Penerbit Draft',ppk_email:'draft@contoh.id',status:'DRAFT'},
  {opd:'DINAS KESEHATAN',ppk_nama:'A1',ppk_email:'invalid@contoh.id',status:'DIAJUKAN'},
  {opd:'DINAS PU',ppk_nama:'Dinas Lain',ppk_email:'rahasia@contoh.id',status:'DIAJUKAN'}
 ];
 c.rows_=()=>rows;
 const out=c.listPpkHistory_(user);
 assert.deepEqual(JSON.parse(JSON.stringify(out.items)),[
  {name:'Siti Aminah',email:'baru@contoh.id'},
  {name:'Rudi Firmansyah',email:'rudi@contoh.id'}
 ]);
});
test('backend menolak Nama PPK kurang dari tiga huruf sebelum membuat folder',()=>{
 const c=context();c.requireRole_=()=>{};c.lookupRup_=()=>({kodeRup:'1111',namaPaket:'Test',opd:'DINAS KESEHATAN',metode:'E-Purchasing',pagu:15000000,tahun:2026});c.ensureRequestSchema_=()=>{};c.sheet_=x=>x;c.rows_=()=>[];c.requestIdForRup_=()=> 'P-1111-01';
 let folders=0;c.createRequestFolder_=()=>{folders++;return {getId:()=> 'abc'}};
 const user={role:'PPK',opd:'DINAS KESEHATAN',user_id:'ppk1'};
 for(const name of ['A','AB','A 1 2','12']) assert.throws(()=>c.createRequest_(user,{kodeRup:'1111',initialPreparation:true,metodePengadaan:'E-Purchasing',ppkNama:name,ppkEmail:'a@b.co',hpsAlokasi:3000000}),/Nama PPK minimal 3 huruf/);
 assert.equal(folders,0);
});
test('dropdown PPK bisa memilih profil lama, email dapat diedit, dan pengajuan ulang tetap terkunci',()=>{
 assert.match(front,/data-sel-create/);
 assert.match(front,/id="ppkHistorySelect"/);
 assert.match(front,/Tambah PPK baru/);
 assert.match(front,/ppkEmailInput\.value=profile\.email/);
 assert.match(front,/ppkNameInput\?\.addEventListener\('input'/);
 assert.match(front,/letterCount\(ppkNama\)<3/);
 assert.match(front,/el\.readOnly=true/);
 assert.match(html,/selection\.js\?v=28\.(?:28|29|30|31)/);
 assert.match(sw,/orbita-pbj-shell-v28-(?:28|29|30|31)/);
});
