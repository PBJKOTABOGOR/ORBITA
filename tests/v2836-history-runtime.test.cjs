'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const js=fs.readFileSync(path.join(root,'assets/js/selection.js'),'utf8');
const html=fs.readFileSync(path.join(root,'profil-pbj/index.html'),'utf8');
const css=fs.readFileSync(path.join(root,'assets/css/selection.css'),'utf8');
const sw=fs.readFileSync(path.join(root,'sw.js'),'utf8');
function runtime(){
  const injection='  window.__testHistory={auditHtml,detailHtml,auditTimelineHtml,groupAudit,setUser:role=>{state.me={role,user_id:"POKJA3"}}};\n';
  const needle="  document.addEventListener('trax:session-change'";
  assert.ok(js.includes(needle));
  const script=js.replace(needle,injection+needle);
  const w={window:{},document:{addEventListener:()=>{}},location:{hash:''},console,Intl,Date,Math,JSON,Number,String,Set,Map,URL,URLSearchParams,Promise,setTimeout:()=>0};
  w.window.window=w.window;
  vm.runInNewContext(script,w,{timeout:15000});
  w.window.__testHistory.setUser('POKJA');
  return w.window.__testHistory;
}
const iso='2026-10-21T10:00:00.000Z';
const mk=(action,i,details={},day=iso)=>({audit_id:'AUD-'+i,action,user_id:'POKJA3',created_at:new Date(Date.parse(day)+i*60000).toISOString(),role:'POKJA',detail_json:JSON.stringify(details)});
function fixture(){
  const req={request_id:'P-67609385-01',workflow_scheme:'KAJI_ULANG_2026',status:'PROSES_INAPROC',selection_process:'NEGOSIASI',nego_stage:'HANDOVER',kode_rup:'67609385',nama_paket:'Pengadaan Jalan',current_round:3,pagu:2000000000,hps_alokasi:250000000,ppk_nama:'PPK A',ppk_email:'ppk@example.com',opd:'DINAS PEKERJAAN UMUM DAN PENATAAN RUANG'};
  return {loading:false,request:req,pokja:[],audit:[
    mk('CREATE_REQUEST',0),
    mk('UPLOAD_DOCUMENT',1,{docType:'DPA_ANGGARAN',version:1,fileName:'DPA.pdf'}),
    mk('UPLOAD_DOCUMENT',2,{docType:'HPS',version:1,fileName:'HPS.pdf'}),
    mk('SUBMIT_REQUEST',3),
    mk('KAJI_ULANG_PERBAIKAN',4,{note:'KAK perlu diperbaiki'}),
    mk('UPLOAD_DOCUMENT',5,{docType:'HPS',version:2,fileName:'HPS-revisi.pdf'}),
    mk('RESUBMIT_KAJI_REVISION',6),
    mk('NEGO_HANDOVER',7),
  ],docs:[
    {doc_type:'DPA_ANGGARAN',version:1,file_name:'DPA.pdf',drive_url:'https://example.org/dpa'},
    {doc_type:'HPS',version:1,file_name:'HPS.pdf',drive_url:'https://example.org/hps-v1'},
    {doc_type:'HPS',version:2,file_name:'HPS-revisi.pdf',drive_url:'https://example.org/hps-v2'},
    {doc_type:'SURAT_UNDANGAN_KAJI_ULANG',version:1,is_current:true,file_name:'Undangan.pdf',drive_url:'https://example.org/undangan'},
  ],notes:[{phase:'KAJI_ULANG',status:'PERBAIKAN',note:'Catatan perbaikan',created_at:iso}],previousHistory:[],docConfig:[],inaproc:{state:'empty',message:'Belum ada transaksi'}};
}
test('Fungsi groupAudit ada dan mengelompokkan upload saja pada sesi berurutan',()=>{
  const {groupAudit}=runtime();
  const d=fixture();const gs=groupAudit(d.audit);
  assert.equal(gs.length,7);
  assert.equal(gs.filter(x=>x.type==='uploads').length,2);
  assert.equal(gs.find(x=>x.type==='uploads').items.length,2);
});
test('Riwayat detail dapat dirender tanpa ReferenceError',()=>{
  const {detailHtml,auditHtml}=runtime();const d=fixture();
  const page=detailHtml(d),audit=auditHtml(d);
  assert.match(page,/Riwayat Paket/);
  assert.match(audit,/8 aktivitas/);
  assert.equal((audit.match(/Lihat Riwayat Upload/g)||[]).length,2);
  assert.doesNotMatch(audit,/sel-history-extra-body|data-toggle-history-extra/);
  assert.match(audit,/href="https:\/\/example.org\/hps-v1"/);
  assert.match(audit,/href="https:\/\/example.org\/hps-v2"/);
  assert.match(audit,/Lihat Catatan/);
  assert.match(audit,/data-toggle-history-notes/);
  assert.match(audit,/KAK perlu diperbaiki/);
});
test('Riwayat dari pengajuan lama dan tanpa audit aman',()=>{
  const {auditHtml,detailHtml}=runtime();const d=fixture();d.previousHistory=[{request:{request_id:'P-123-00',status:'DITOLAK_KEPALA'},audit:[mk('REJECT_REQUEST',1,{reason:'Kurang dokumen'})],docs:[]}];
  const result=auditHtml(d);
  assert.match(result,/Lihat pengajuan sebelumnya \(1\)/);
  assert.match(result,/Pengajuan sebelumnya/i);
  assert.match(result,/Kurang dokumen/);
  d.audit=[];d.previousHistory=[];d.notes=[];
  assert.match(detailHtml(d),/Belum ada riwayat/);
});
test('Halaman berbeda role tetap aman dan opsi riwayat pada detail tidak menggandakan upload',()=>{
  const h=runtime();const d=fixture();
  for(const role of ['POKJA','PPK','KEPALA_UKPBJ','ADMIN']){
    h.setUser(role);
    assert.match(h.detailHtml(d),/Riwayat Paket/);
    assert.equal((h.auditHtml(d).match(/data-toggle-history-extra=/g)||[]).length,0);
  }
});
test('Cache versi sesuai HTML, SW, dan CSS punya layout dokumen fleksibel',()=>{
  assert.match(html,/selection\.js\?v=28\.(?:36|37|38|42)/);
  assert.match(html,/selection\.css\?v=28\.(?:36|38)/);
  assert.match(sw,/shell-v28-(?:36-history-fix|37-notifikasi|38-fix-permohonan|42-role-ppk-note)/);
  assert.match(sw,/selection\.js\?v=28\.(?:36|37|38|42)/);
  assert.match(sw,/selection\.css\?v=28\.(?:36|38)/);
  assert.match(css,/\.sel-app \.sel-history \.sel-audit-doc-item\{display:flex!important/);
});
