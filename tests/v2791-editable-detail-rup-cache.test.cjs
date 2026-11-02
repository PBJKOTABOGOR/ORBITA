const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const crypto=require('node:crypto');
const path=require('node:path');
const root=path.join(__dirname,'..');
const js=fs.readFileSync(path.join(root,'assets/js/selection.js'),'utf8');
const gs=fs.readFileSync(path.join(root,'backend/Code-TRAXPBJ-Pemilihan.gs'),'utf8');
const css=fs.readFileSync(path.join(root,'assets/css/selection.css'),'utf8');

// Execute the real helper, not a recreation, to verify arbitrary user input stays escaped and selectable.
const helperStart=js.indexOf('  function editableDetailChoice('),helperEnd=js.indexOf('\n  const parseJson=',helperStart);
const helperSource=js.slice(helperStart,helperEnd);
const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
const editableDetailChoice=new Function('esc',helperSource+'\nreturn editableDetailChoice;')(esc);

test('manual values are editable and list suggestions remain available',()=>{
  const html=editableDetailChoice('cdSectoral',['Pilihan A','Pilihan B','Pilihan A'],'Nama <Pekerjaan>','Pilih produk sektoral');
  assert.match(html,/type=|<input/);
  assert.match(html,/list="cdSectoralChoices"/);
  assert.match(html,/value="Nama &lt;Pekerjaan&gt;"/);
  assert.match(html,/<datalist id="cdSectoralChoices">/);
  assert.match(html,/<option value="Pilihan B">/);
  assert.equal((html.match(/value="Pilihan A"/g)||[]).length,1);
});

test('construction and health detail fields keep their backend JSON property names',()=>{
  const construction=js.slice(js.indexOf('  function constructionFieldsDialog('),js.indexOf('  function readDetailedProductDialog('));
  const health=js.slice(js.indexOf('  function productFieldsDialog('),js.indexOf('  async function productCategoryDialog('));
  for(const key of ['cdSectoral','cdMeasurementUnit','cdSbu','cdStandardCertificate','cdUnit']){
    assert.ok(construction.includes(`editableDetailChoice('${key}'`),key);
    assert.ok(construction.includes(`$('#${key}')`)||construction.includes(`$('#${key.slice(0,2)}${key.slice(2)}')`)||['cdSectoral','cdUnit'].includes(key));
  }
  for(const key of ['pdDistributor','pdDistributionPermit','pdGoodManufacturing','pdGoodDistribution','pdPostMarket','pdPib','pdBmhp','pdWarranty','pdAfterSales','pdPriceStructure','pdUnit']){
    assert.ok(health.includes(`editableDetailChoice('${key}'`),key);
    assert.ok(js.includes(`$('#${key}')`),key);
  }
  assert.match(construction,/sectoralEl\?\.addEventListener\('input',refresh\)/);
  assert.match(css,/font-size:10px!important/);
});

// Minimal Apps Script stubs to exercise the original GS caching functions and real RUP filtering.
function setupBackend(rowCount=420){
  const headers=['Satuan Kerja','Kode RUP','Nama Paket','Pagu Anggaran','Metode Pemilihan','Program','Kegiatan','Sub Kegiatan','Jenis Pengadaan','Cara Pengadaan','Produk Dalam Negeri','Sumber Dana','Waktu Pemilihan'];
  const data=[headers];
  for(let i=0;i<rowCount;i++)data.push(['DINAS KESEHATAN',String(100000+i),'Paket Pengadaan Barang '+i+' '.repeat(5)+'X'.repeat(200),'350000000','E-Purchasing','Program','Kegiatan','Sub Kegiatan','Barang','Penyedia','Ya','APBD','Oktober 2026']);
  data.push(['OPD LAIN','999999','Paket Lain',"800000000",'E-Purchasing','','','','','','','','']);
  let sheetReads=0;
  const cacheEntries=new Map();
  const cache={get:k=>cacheEntries.get(k)||null,put:(k,v)=>cacheEntries.set(k,v),getAll:keys=>Object.fromEntries(keys.filter(k=>cacheEntries.has(k)).map(k=>[k,cacheEntries.get(k)])),putAll:entries=>Object.entries(entries).forEach(([k,v])=>cacheEntries.set(k,v))};
  const source=gs.slice(gs.indexOf('function readRupCache_('),gs.indexOf('\nfunction lookupRup_('));
  const sandbox={PBJWF:{RUP_CACHE_SECONDS:600,RUP_DB_ID:'x',RUP_SHEET:'DETAILPSW',SHEETS:{REQUESTS:'PBJ_PERMOHONAN'}},Utilities:{DigestAlgorithm:{MD5:'md5'},computeDigest:(alg,s)=>Array.from(crypto.createHash(alg).update(s).digest()),base64EncodeWebSafe:bytes=>Buffer.from(bytes).toString('base64url'),getUuid:()=>crypto.randomUUID()},SpreadsheetApp:{openById:()=>({getSheetByName:()=>({getLastRow:()=>data.length,getLastColumn:()=>headers.length,getRange:()=>({getDisplayValues:()=>{sheetReads++;return data;}})})})},scriptCache_:()=>cache,norm_:s=>String(s||'').toLowerCase().replace(/[^a-z0-9]/g,''),money_:s=>Number(s)||0,rows_:()=>[{kode_rup:'100002',request_id:'P-100002-01',status:'DRAFT'}],sheet_:()=>({}),requireRole_:()=>{}};
  vm.createContext(sandbox);vm.runInContext(source,sandbox);
  return {backend:sandbox,cacheEntries,data,readCount:()=>sheetReads};
}

test('Apps Script caches large per-OPD RUP as shards and skips full Sheet read on next request',()=>{
  const {backend:b,cacheEntries,readCount}=setupBackend();
  const user={role:'PPK',opd:'DINAS KESEHATAN'};
  const first=b.listRupOptions_(user,{method:'E-Purchasing'});
  assert.equal(first.items.length,420);
  assert.equal(first.items.find(x=>x.kodeRup==='100002').activeRequestId,'P-100002-01');
  assert.equal(readCount(),1);
  assert.ok(cacheEntries.size>2,'large RUP stored as multiple cache shards');
  assert.equal(b.listRupOptions_(user,{method:'E-Purchasing'}).items.length,420);
  assert.equal(readCount(),1,'warm cache does not reread DETAILPSW');
  b.listRupOptions_(user,{method:'E-Purchasing',force:true});
  assert.equal(readCount(),2,'explicit force can refresh updated RUP data');
});

test('browser cache is user scoped and refreshed active request state is applied independently',()=>{
  assert.match(js,/RUP_BROWSER_CACHE_TTL=5\*60\*1000/);
  assert.match(js,/window\.TRAXPBJ_SELECTION_CONFIG\?\.apiUrl/);
  assert.match(js,/state\.me\?\.user_id/);
  assert.match(js,/state\.me\?\.opd/);
  assert.match(js,/state\.requests\.forEach\(r=>/);
  assert.match(js,/getStoredRupOptions\(rupCacheKey\('E-Purchasing'\)\)/);
});
