'use strict';
const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const base=path.resolve(__dirname,'..');const src=fs.readFileSync(path.join(base,'assets/js/selection.js'),'utf8'),back=fs.readFileSync(path.join(base,'backend/Code-TRAXPBJ-Pemilihan.gs'),'utf8'),css=fs.readFileSync(path.join(base,'assets/css/selection.css'),'utf8');
const user={user_id:'u',role:'POKJA',pokja_id:'PG1'};
function make(overrides={}){
  const req={request_id:'R',status:'REVIU_POKJA',mini_stage:'',selection_process:'MINI_KOMPETISI',assigned_pokja_id:'PG1',...overrides},docs=[];
  const ctx=vm.createContext({Date,JSON,Set,Map,console});vm.runInContext(back,ctx);
  ctx.req=req;ctx.docs=docs;
  vm.runInContext(`currentDocs_=function(){return docs.filter(x=>x.is_current!==false)};`,ctx);
  return {req,docs,check:()=>vm.runInContext('miniRequireReviewDocs_(req)',ctx),allowed:type=>vm.runInContext(`miniDocAllowed_(${JSON.stringify(user)},req,${JSON.stringify(type)})`,ctx)};
}
test('Mini Kompetisi memakai dua kode BA yang berbeda di frontend dan backend',()=>{
  assert.match(src,/BA_HASIL_REVIU:'Berita Acara Hasil Reviu Dokumen Pemilihan Kompetisi'/);
  assert.match(src,/BA_PERSETUJUAN_POKJA:'Berita Acara Persetujuan Pokja'/);
  assert.match(src,/const types=\['BA_HASIL_REVIU','BA_PERSETUJUAN_POKJA'\]/);
  assert.match(back,/BA_PERSETUJUAN_POKJA:'Berita Acara Persetujuan Pokja'/);
});
test('Kedua BA wajib pada reviu Sesuai; upload PPK tidak dapat menjadi pengganti',()=>{
  const t=make();assert.equal(t.allowed('BA_HASIL_REVIU'),true);assert.equal(t.allowed('BA_PERSETUJUAN_POKJA'),true);
  assert.throws(t.check,/Berita Acara Hasil Reviu/);
  const stamp=new Date().toISOString();t.docs.push({doc_type:'BA_HASIL_REVIU',uploaded_at:stamp,is_current:true});
  assert.throws(t.check,/Berita Acara Persetujuan Pokja/);
  t.docs.push({doc_type:'BA_PERSETUJUAN_POKJA',uploaded_at:stamp,is_current:true});assert.doesNotThrow(t.check);
  assert.match(back,/status==='SESUAI'.*miniRequireReviewDocs_\(req\)/);
});
test('Setelah kompetisi gagal, dua BA aktif yang sudah diunggah tetap berlaku saat reviu ulang',()=>{
  const past='2026-10-09T06:00:00Z',failed='2026-10-09T07:00:00Z';const t=make({status:'REVIU_ULANG',mini_stage:'REVIU_ULANG',mini_failure_at:failed});
  t.docs.push({doc_type:'BA_HASIL_REVIU',uploaded_at:past,is_current:true});
  assert.throws(t.check,/Persetujuan Pokja/);
  t.docs.push({doc_type:'BA_PERSETUJUAN_POKJA',uploaded_at:past,is_current:true});
  assert.doesNotThrow(t.check);
  t.docs[0].is_current=false;assert.throws(t.check,/Hasil Reviu/);
});
test('Kompetisi gagal ditandai warna berbeda, Mini Kompetisi merah',()=>{
  assert.match(src,/failed=x.action==='MINI_GAGAL'/);
  assert.match(src,/sel-audit-failed/);
  assert.match(css,/\.sel-timeline article\.sel-audit-failed:before/);
  assert.match(css,/\.sel-request-copy \.sel-process-label\.competition.*#fff0f0/);
});
test('Kepala UKPBJ langsung menuju Surat Perintah Pokja dan tombol pilih dokumen seragam',()=>{
  assert.match(src,/\$\$\('input\[name=assignPokja\]'\)\.forEach/);
  assert.match(src,/scrollIntoView\(\{behavior:/);
  assert.match(src,/for="assignOrderFile">Pilih Dokumen/);
  assert.match(src,/id="assignOrderName"/);
});
test('Tindakan aktif ditampilkan sebelum rekap dan aset versi baru',()=>{
  const start=src.indexOf('function detailHtml('),stop=src.indexOf('\n  function ',start+12);
  const part=src.slice(start,stop>start?stop:undefined);
  assert.ok(part.indexOf('roleActions(d)+docsHtml(d)')<part.indexOf('${opdRecapHtml(d)}'));
  assert.ok(part.indexOf('miniHtml(d)+negoHtml(d)+inaprocHtml(d)')<part.indexOf('${opdRecapHtml(d)}'));
  const h=fs.readFileSync(path.join(base,'profil-pbj/index.html'),'utf8');assert.match(h,/selection\.js\?v=28\.07/);assert.match(h,/selection\.css\?v=28\.07/);
});
