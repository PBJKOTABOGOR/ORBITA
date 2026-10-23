const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.join(__dirname,'..');
const ui=fs.readFileSync(path.join(root,'assets/js/selection.js'),'utf8');
const css=fs.readFileSync(path.join(root,'assets/css/selection.css'),'utf8');
const backend=fs.readFileSync(path.join(root,'backend/Code-TRAXPBJ-Pemilihan.gs'),'utf8');
const sw=fs.readFileSync(path.join(root,'sw.js'),'utf8');

function backendContext(){const c=vm.createContext({console,Date,JSON,Math});vm.runInContext(backend,c);return c;}

test('important confirmed actions use a blocking progress popup with a bounded waiting state',()=>{
  assert.match(ui,/function criticalProcess\(/);
  assert.match(ui,/Math\.min\(92,pct\+add\)/);
  assert.match(ui,/await proc\.success\(ok\)/);
  assert.match(ui,/proc\.fail\(message\)/);
  assert.match(css,/\.sel-process-overlay\{position:fixed/);
  assert.match(css,/z-index:100000/);
  assert.match(css,/html\.sel-process-lock/);
});

test('reject, disposition, package review, admin delete and password reset all show process status',()=>{
  assert.match(ui,/title:'Menolak permohonan'/);
  assert.match(ui,/title:'Menetapkan Pokja'/);
  assert.match(ui,/eyebrow:'HASIL REVIU'/);
  assert.match(ui,/title:'Menghapus dari daftar'/);
  assert.match(ui,/title:'Mengganti password'/);
});

test('a rejected request that already spawned a reapplication is shown as completed instead of actionable',()=>{
  assert.match(ui,/find\(x=>x\.action==='REAPPLY_REQUEST'\)/);
  assert.match(ui,/Sudah dilakukan pengajuan ulang/);
  assert.match(ui,/sel-action-done/);
});

test('backend rejects a second reapplication from the same rejected request even from another tab',()=>{
  const c=backendContext();
  c.requireRole_=()=>{};
  c.norm_=v=>String(v||'').toLowerCase().replace(/[^a-z0-9]+/g,'');
  c.lookupRup_=()=>({kodeRup:'777',namaPaket:'Paket',opd:'OPD TEST',tahun:2026,jenis:'Barang',cara:'Penyedia',metode:'E-Purchasing',pagu:500000000,sumberDana:'APBD',waktuPemilihan:'October 2026'});
  c.ensureRequestSchema_=()=>{};
  c.sheet_=name=>name;
  c.rows_=name=>name==='PBJ_PERMOHONAN'?[{request_id:'P-777-01',kode_rup:'777',status:'DITOLAK_KEPALA',ppk_user_id:'U1',updated_at:new Date()}]:name==='PBJ_AUDIT_LOG'?[{request_id:'P-777-01',action:'REAPPLY_REQUEST'}]:[];
  assert.throws(()=>c.createRequest_({role:'PPK',opd:'OPD TEST',user_id:'U1'},{kodeRup:'777',metodePengadaan:'E-Purchasing',previousRequestId:'P-777-01'}),/sudah pernah dibuat/i);
});


test('explicit reapplication from a rejected request creates one linked draft and records the relationship',()=>{
  const c=backendContext();
  c.requireRole_=()=>{};
  c.norm_=v=>String(v||'').toLowerCase().replace(/[^a-z0-9]+/g,'');
  c.lookupRup_=()=>({kodeRup:'778',namaPaket:'Paket B',opd:'OPD TEST',tahun:2026,jenis:'Barang',cara:'Penyedia',metode:'E-Purchasing',pagu:550000000,sumberDana:'APBD',waktuPemilihan:'October 2026'});
  c.ensureRequestSchema_=()=>{};
  c.sheet_=name=>name;
  const req=[{request_id:'P-778-01',kode_rup:'778',status:'DITOLAK_KEPALA',ppk_user_id:'U1',updated_at:new Date()}];
  c.rows_=name=>name==='PBJ_PERMOHONAN'?req:name==='PBJ_AUDIT_LOG'?[]:[];
  c.requestIdForRup_=()=> 'P-778-02';c.createRequestFolder_=()=>({getId:()=> 'F2'});
  let appended=null;const audits=[];c.appendObj_=(_sh,obj)=>{appended=obj};c.audit_=(_u,action,id,detail)=>{audits.push({action,id,detail})};c.touchRequest_=()=>{};c.publicRequest_=x=>x;
  const out=c.createRequest_({role:'PPK',opd:'OPD TEST',user_id:'U1'},{kodeRup:'778',metodePengadaan:'E-Purchasing',previousRequestId:'P-778-01'});
  assert.equal(out.previous_request_id,'P-778-01');assert.equal(appended.request_id,'P-778-02');assert.equal(audits.filter(x=>x.action==='REAPPLY_REQUEST').length,1);
});

test('v27.21 upgrade remains available after later cache bumps',()=>{
  assert.match(backend,/function upgradePemilihanV2721\(\)/);
  assert.match(backend,/workflow_version','27\.21'/);
  assert.match(sw,/orbita-pbj-shell-v27-(?:34-back-team-selection|38-hard-home-back|49-docs-hub-surat|50-docs-unified-five-lines|54-docs-hover-surat-preview|55-surat-action-only|56-edukasi-doc|57-constellation-bg|58-constellation-interactive|59-atomic-room)/);
  assert.match(sw,/selection\.js\?v=27\.27/);
});
