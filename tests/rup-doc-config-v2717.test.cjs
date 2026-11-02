const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.join(__dirname,'..');
const backend=fs.readFileSync(path.join(root,'backend/Code-TRAXPBJ-Pemilihan.gs'),'utf8');
const frontend=fs.readFileSync(path.join(root,'assets/js/selection.js'),'utf8');

test('RUP source is DETAILPSW from the supplied spreadsheet with a short cache',()=>{
  assert.match(backend,/RUP_DB_ID:\s*'1CkzP7B-rwxb6A167Ykv2Y8WwZOZpidLbDgS3x1UF7QI'/);
  assert.match(backend,/RUP_SHEET:\s*'DETAILPSW'/);
  assert.match(backend,/RUP_CACHE_SECONDS:\s*30/);
  assert.match(backend,/required=\['satuan kerja','kode rup','nama paket','pagu anggaran','metode pemilihan'\]/);
  assert.match(backend,/norm_\(get\(row,'Metode Pemilihan'\)\)!=='epurchasing'/);
  assert.match(backend,/pagu<=200000000/);
});

test('RUP frontend prefetches in background and reuses a short client cache',()=>{
  assert.match(frontend,/function prefetchRupOptions\(\)/);
  assert.match(frontend,/function getRupOptions\(method='E-Purchasing',force=false\)/);
  assert.match(frontend,/Date\.now\(\)-cached\.at<20000/);
  assert.match(frontend,/setTimeout\(prefetchRupOptions,80\)/);
  assert.match(frontend,/RUP dari DETAILPSW belum dapat dimuat/);
});

test('fresh document preparation defaults are exactly the four current OPD documents',()=>{
  const start=backend.indexOf('function seedDocConfig_');
  const end=backend.indexOf('function setSetting_',start);
  const block=backend.slice(start,end);
  for(const type of ['SURAT_PERMOHONAN','KAK','HPS','RANCANGAN_KONTRAK']) assert.match(block,new RegExp("'"+type+"'"));
  for(const legacy of ['SK_PPK','DATA_RUP','WAKTU_PENGGUNAAN','PENDUKUNG']) assert.doesNotMatch(block,new RegExp("'"+legacy+"'"));
  assert.match(block,/Surat Permohonan Pemilihan/);
  assert.match(block,/KAK \/ Spesifikasi Teknis/);
  assert.match(block,/Rancang Kontrak/);
});

test('v27.17 upgrade keeps custom admin docs and deactivates only old defaults',()=>{
  const start=backend.indexOf('function upgradePemilihanV2717');
  const end=backend.indexOf('function upgradePemilihanV2713',start);
  const block=backend.slice(start,end);
  assert.match(block,/\['SK_PPK','DATA_RUP','WAKTU_PENGGUNAAN','PENDUKUNG'\]/);
  assert.match(block,/active:false/);
  assert.doesNotMatch(block,/deleteRow|clearContent|clear\(/);
  assert.match(block,/workflow_version','27\.17'/);
});

test('admin document removal is a soft delete so old uploaded history remains intact',()=>{
  const c=vm.createContext({console,Date});
  vm.runInContext(backend,c);
  let patch=null,audit=null;
  c.requireRole_=()=>{};
  c.sheet_=()=>({});
  c.findRow_=()=>({row:7,obj:{doc_type:'BA_TAMBAHAN',label:'BA Tambahan',active:true}});
  c.updateRow_=(_sh,_row,p)=>{patch=p};
  c.audit_=(_user,action,_requestId,detail)=>{audit={action,detail}};
  const out=c.adminDeleteDocConfig_({role:'ADMIN'},{docType:'BA_TAMBAHAN'});
  assert.equal(patch.active,false);
  assert.equal(out.active,false);
  assert.equal(audit.action,'ADMIN_DELETE_DOC_CONFIG');
});

test('admin UI can add, edit, remove, and reactivate document preparation items',()=>{
  assert.match(frontend,/data-new-doccfg/);
  assert.match(frontend,/data-edit-doccfg/);
  assert.match(frontend,/data-delete-doccfg/);
  assert.match(frontend,/data-enable-doccfg/);
  assert.match(frontend,/adminDeleteDocConfig/);
  assert.match(frontend,/Tambah Dokumen/);
});
