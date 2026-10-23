'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.resolve(__dirname,'..');
const js=fs.readFileSync(path.join(root,'assets/js/selection.js'),'utf8');
const css=fs.readFileSync(path.join(root,'assets/css/selection.css'),'utf8');
const html=fs.readFileSync(path.join(root,'profil-pbj/index.html'),'utf8');
const sw=fs.readFileSync(path.join(root,'sw.js'),'utf8');
function runtime(){
  const instrumented=js.replace("  document.addEventListener('trax:session-change'", "  window.__testDetail={render:detailHtml,setUser:user=>{state.me=user},stepIndex};\n  document.addEventListener('trax:session-change'");
  const world={window:{},document:{addEventListener:()=>{}},location:{hash:''},console,Intl,Date,Math,JSON,Number,String,Set,Map,URL,URLSearchParams,Promise,setTimeout:()=>0};
  world.window.window=world.window;
  vm.runInNewContext(instrumented,world,{timeout:5000});
  world.window.__testDetail.setUser({role:'POKJA',user_id:'test-pokja'});
  return world.window.__testDetail;
}
const base={request_id:'P-67609385-01',kode_rup:'67609385',current_round:3,workflow_scheme:'KAJI_ULANG_2026',
  nama_paket:'Pengadaan Hotmix Dan Coldmix Paket 3',opd:'DINAS PEKERJAAN UMUM DAN PENATAAN RUANG',jenis:'Barang',metode_epurchasing:'E-Purchasing',
  pagu:2000000000,hps_alokasi:250000000,ppk_nama:'PPK Bidang Jalan',ppk_email:'ppk@bogor.go.id',assigned_pokja_id:'POKJA3',
  program:'Program Penyelenggaraan Jalan',kegiatan:'Pemeliharaan Jalan Kabupaten/Kota',sub_kegiatan:'Pemeliharaan Rutin Jalan',
  selection_process:'NEGOSIASI',nego_stage:'HANDOVER',status:'PROSES_INAPROC',
  inaproc_progress:{state:'ready',count:1,completed:0,total:420750000,transactions:[{rup_name:'Paket Uji',order_date:'2026-10-20',total:420750000,status:'ON_PROCESS',shipment_status:'COMPLETED'}]},
  kaji_ulang_date:'2026-10-19',kaji_ulang_result:'LANJUT'};
function fixture(req){return {request:req,loading:false,pokja:[{pokja_id:'POKJA3',nama:'POKJA 3'}],inaproc:req.inaproc_progress,docs:[{doc_type:'SURAT_UNDANGAN_KAJI_ULANG',version:1,is_current:true,uploaded_at:'2026-10-19T08:00:00Z',file_name:'Surat Undangan.pdf',drive_url:'https://example.org/surat.pdf'}],docConfig:[],notes:[],audit:[],reviews:[],previousHistory:[]}}
function pos(h,needle){const n=h.indexOf(needle);assert.ok(n>=0,`Missing ${needle}`);return n;}
test('Pada Handover, Progres INAPROC di atas undangan, Kaji Ulang, serta dokumen historis',()=>{
 const t=runtime(),page=t.render(fixture({...base}));
 assert.ok(pos(page,'id="selInaprocReport"')<pos(page,'id="selNegoWorkflow"'));
 assert.ok(pos(page,'id="selNegoWorkflow"')<pos(page,'sel-invite"'));
 assert.ok(pos(page,'sel-invite"')<pos(page,'sel-kaji-wrap'));
 assert.equal((page.match(/id="selInaprocReport"/g)||[]).length,1);
 assert.equal((page.match(/id="selNegoWorkflow"/g)||[]).length,1);
});
test('Sebelum handover, Undangan Kaji Ulang tetap lebih dulu dari progres pemilihan',()=>{
 const t=runtime(),req={...base,status:'SIAP_PROSES_INAPROC',nego_stage:'NEGOSIASI'};
 const page=t.render(fixture(req));
 assert.ok(pos(page,'sel-invite"')<pos(page,'id="selNegoWorkflow"'));
});
test('Ringkasan paket menunjukkan pagu, HPS, PPK, Pokja dan INAPROC tanpa kartu gantung',()=>{
 const t=runtime(),page=t.render(fixture({...base}));
 for(const text of ['PAGU RUP','HPS DIAJUKAN','PPK','POKJA','INAPROC','sel-meta-money','sel-meta-person','sel-meta-inaproc'])assert.ok(page.includes(text));
 assert.match(css,/\.sel-app \.sel-detail-meta \.sel-meta-inaproc\{[\s\S]*?grid-column:1\/-1/);
 assert.match(css,/@media\(max-width:650px\)/);
});
test('Versi cache CSS / JS diperbarui tanpa mengganti backend',()=>{
 assert.match(html,/selection\.css\?v=28\.(?:33|36)/);assert.match(html,/selection\.js\?v=28\.(?:33|36|37)/);
 assert.match(sw,/orbita-pbj-shell-v28-(?:33|36|37)/);
 assert.match(sw,/selection\.css\?v=28\.(?:33|36)/);assert.match(sw,/selection\.js\?v=28\.(?:33|36|37)/);
});
