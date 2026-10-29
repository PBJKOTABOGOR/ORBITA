"use strict";
const {test}=require('node:test'), assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'..');
const src=fs.readFileSync(path.join(root,'assets/js/selection.js'),'utf8');
const backend=fs.readFileSync(path.join(root,'backend/Code-TRAXPBJ-Pemilihan.gs'),'utf8');
const a=src.indexOf('  function detailHeroHtml(d){');
const b=src.indexOf('  // Menggunakan daftar anggota dari bootstrap',a);
assert.ok(a>0&&b>a);
const renderSource=src.slice(a,b)+'\nthis.render=detailHeroHtml;';
const roles=['ADMIN','POKJA','KEPALA_UKPBJ'];
function render(role,docs,assigned='PKJ-1'){
 const state={me:{role}};
 const context={state,URL,Date,
  canSeeOrder:()=>roles.includes(role),
  currentDoc:(d,t)=>d.docs.filter(x=>x.doc_type===t&&String(x.is_current).toLowerCase()!=='false').sort((a,b)=>Number(b.version)-Number(a.version))[0]||null,
  esc:s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])),
  fmtRp:n=>'Rp '+n,requestTitle:r=>r.nama_paket,dateOnly:s=>s,
 };
 vm.runInNewContext(renderSource,context);
 return context.render({request:{request_id:'P-123-01',nama_paket:'Paket Uji',opd:'OPD',jenis:'Barang',pagu:1,hps_alokasi:1,assigned_pokja_id:assigned,program:'Program',kegiatan:'Kegiatan',sub_kegiatan:'Sub',ppk_nama:'PPK'},pokja:[{pokja_id:'PKJ-1',nama:'POKJA 4'}],docs});
}
const good={doc_type:'SURAT_PERINTAH_POKJA',version:1,is_current:true,drive_url:'https://drive.google.com/file/d/abc/view',file_name:'Surat Perintah Paket Uji.pdf'};
test('Hanya tiga role internal mendapat tautan dokumen Pokja',()=>{
 for(const role of roles){const h=render(role,[good]);assert.match(h,/Lihat Surat Perintah Pokja/);assert.match(h,/https:\/\/drive\.google\.com\/file\/d\/abc\/view/);assert.match(h,/target="_blank" rel="noopener noreferrer"/);}
 for(const role of ['PPK','PIMPINAN','PENGAWAS']) assert.doesNotMatch(render(role,[good]),/Lihat Surat Perintah Pokja/);
});
test('Tautan hanya mengarah ke dokumen penugasan paket ini, bukan dokumen lainnya',()=>{
 const docs=[{doc_type:'HPS',is_current:true,drive_url:'https://drive.google.com/file/d/other/view'},good];
 const h=render('ADMIN',docs);assert.match(h,/\/abc\/view/);assert.doesNotMatch(h,/\/other\/view/);
 assert.doesNotMatch(render('ADMIN',docs.filter(x=>x.doc_type==='HPS')),/Lihat Surat Perintah Pokja/);
});
test('Tautan URL tidak aman diblok dan HTML di-escape',()=>{
 assert.doesNotMatch(render('POKJA',[{...good,drive_url:'javascript:alert(1)'}]),/Lihat Surat Perintah Pokja/);
 assert.doesNotMatch(render('POKJA',[{...good,drive_url:'https://drive.google.com.evil.example/abc'}]),/Lihat Surat Perintah Pokja/);
 const safe=render('ADMIN',[{...good,drive_url:'https://drive.google.com/file/d/abc/view?a=1&b=2'}]);
 assert.match(safe,/a=1&amp;b=2/);
});
test('Cache dan file versi 28.84 konsisten',()=>{
 const html=fs.readFileSync(path.join(root,'profil-pbj/index.html'),'utf8');const sw=fs.readFileSync(path.join(root,'sw.js'),'utf8');
 for(const v of ['selection.js?v=28.84','selection.css?v=28.84']){assert.ok(html.includes(v));assert.ok(sw.includes(v));}
 assert.match(sw,/orbita-pbj-shell-v28-84/);
});
test('Backend tetap membatasi dokumen penugasan dari PPK',()=>{
 assert.match(backend,/const docs=detail\.docs\.filter\(d=>d\.doc_type!=='SURAT_PERINTAH_POKJA'\)/);
 assert.match(backend,/function canSeeOrder_\(user\)/);
});
