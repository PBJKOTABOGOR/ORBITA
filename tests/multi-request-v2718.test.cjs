const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.join(__dirname,'..');
const backend=fs.readFileSync(path.join(root,'backend/Code-TRAXPBJ-Pemilihan.gs'),'utf8');
const frontend=fs.readFileSync(path.join(root,'assets/js/selection.js'),'utf8');

function ctx(){const c=vm.createContext({console,Date,JSON,Math});vm.runInContext(backend,c);return c;}

test('an active package never locks the whole OPD; only the same RUP is marked active',()=>{
  const c=ctx();
  c.requireRole_=()=>{};
  c.rupMasterOptions_=()=>[
    {kodeRup:'111',namaPaket:'Paket A',opd:'OPD TEST',pagu:300000000},
    {kodeRup:'222',namaPaket:'Paket B',opd:'OPD TEST',pagu:400000000}
  ];
  c.sheet_=()=>({});
  c.rows_=()=>[{request_id:'REQ-A',kode_rup:'111',status:'REVIU_POKJA',opd:'OPD TEST'}];
  const out=c.listRupOptions_({role:'PPK',opd:'OPD TEST'},{method:'E-Purchasing'});
  assert.equal(out.items.length,2);
  assert.equal(out.items.find(x=>x.kodeRup==='111').activeRequestId,'REQ-A');
  assert.equal(out.items.find(x=>x.kodeRup==='222').activeRequestId,'');
  assert.equal(out.selectableCount,1);
  assert.match(out.message,/tidak membatasi pengajuan paket lain/i);
});

test('creating a different RUP succeeds even while another package from the same OPD is active',()=>{
  const c=ctx();
  c.requireRole_=()=>{};
  c.norm_=v=>String(v||'').toLowerCase().replace(/[^a-z0-9]+/g,'');
  c.lookupRup_=()=>({kodeRup:'222',namaPaket:'Paket B',opd:'OPD TEST',tahun:2026,jenis:'Barang',cara:'Penyedia',metode:'E-Purchasing',pagu:400000000,sumberDana:'APBD',waktuPemilihan:'October 2026'});
  c.ensureRequestSchema_=()=>{};
  c.sheet_=()=>({});
  c.rows_=()=>[{request_id:'REQ-A',kode_rup:'111',status:'REVIU_POKJA',opd:'OPD TEST',ppk_user_id:'USR-1'}];
  c.requestIdForRup_=code=>'REQ-'+code;
  c.createRequestFolder_=()=>({getId:()=> 'FOLDER-B'});
  let appended=null;
  c.appendObj_=(_sh,obj)=>{appended=obj};
  c.audit_=()=>{};
  c.publicRequest_=x=>x;
  const out=c.createRequest_({role:'PPK',opd:'OPD TEST',user_id:'USR-1'},{kodeRup:'222',metodePengadaan:'E-Purchasing'});
  assert.equal(out.kode_rup,'222');
  assert.equal(appended.request_id,'REQ-222');
});

test('the same active RUP is still protected from duplicate submission',()=>{
  const c=ctx();
  c.requireRole_=()=>{};
  c.norm_=v=>String(v||'').toLowerCase().replace(/[^a-z0-9]+/g,'');
  c.lookupRup_=()=>({kodeRup:'111',namaPaket:'Paket A',opd:'OPD TEST',tahun:2026,jenis:'Barang',cara:'Penyedia',metode:'E-Purchasing',pagu:300000000,sumberDana:'APBD',waktuPemilihan:'October 2026'});
  c.ensureRequestSchema_=()=>{};
  c.sheet_=()=>({});
  c.rows_=()=>[{request_id:'REQ-A',kode_rup:'111',status:'REVIU_POKJA',opd:'OPD TEST',ppk_user_id:'USR-1'}];
  assert.throws(()=>c.createRequest_({role:'PPK',opd:'OPD TEST',user_id:'USR-1'},{kodeRup:'111',metodePengadaan:'E-Purchasing'}),/Kode RUP ini masih memiliki permohonan aktif/);
});

test('form wording does not imply that an OPD must wait for another request to finish',()=>{
  assert.doesNotMatch(frontend,/RUP yang memenuhi kriteria sudah memiliki permohonan aktif/);
  assert.match(frontend,/sedang diproses/);
  assert.match(frontend,/Belum ada RUP lain yang dapat diajukan/);
});
