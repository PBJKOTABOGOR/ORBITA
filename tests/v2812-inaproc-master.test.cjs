'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const {pathToFileURL,fileURLToPath}=require('node:url');
const base=path.resolve(__dirname,'../assets/data/inaproc-master');
const master=JSON.parse(fs.readFileSync(path.join(base,'categories.json'),'utf8'));
const fieldFiles=fs.readdirSync(base).filter(f=>/^[a-f0-9][0-3]\.json$/.test(f));

test('static category index covers 2870 real category ids and expected group hierarchy',()=>{
  assert.equal(master.rows.length,2415);
  assert.equal(master.constructionRows.length,455);
  const all=[...master.rows,...master.constructionRows];
  assert.equal(new Set(all.map(x=>x.id)).size,2870);
  assert.ok(all.every(x=>x.id&&x.level1&&x.level3&&x.path));
  assert.ok(master.rows.some(x=>x.category==='Jasa'&&x.path.endsWith('Jasa Paket Meeting Fullboard')));
  assert.ok(master.constructionRows.some(x=>x.path.includes('1.13 Building Information Modelling (BIM)')));
  assert.equal(fieldFiles.length,64);
});
test('all field sharded files are parseable and agree with category ids',()=>{
  const fields=new Map();
  for(const fn of fieldFiles){const shard=JSON.parse(fs.readFileSync(path.join(base,fn),'utf8'));
    for(const [id,v] of Object.entries(shard)){assert.ok(!fields.has(id));fields.set(id,v);assert.ok(Array.isArray(v.p));assert.ok(Array.isArray(v.a));assert.ok(Array.isArray(v.k));}}
  assert.equal(fields.size,2870);
  assert.equal([...fields.values()].reduce((s,x)=>s+x.p.length+x.a.length,0),30088);
  for(const row of [...master.rows,...master.constructionRows])assert.ok(fields.has(row.id),row.path);
  const fullboard=master.rows.find(x=>x.path.endsWith('Jasa Paket Meeting Fullboard'));
  assert.ok(fields.get(fullboard.id).p.some(f=>f[1]==='Tipe Paket Meeting'&&f[2]==='CHECKBOX'&&f[3].includes('Fullboard')));
  const bim=master.constructionRows.find(x=>x.path.includes('Building Information Modelling (BIM)'));
  assert.ok(fields.get(bim.id).p.some(f=>f[1]==='Satuan Pengukuran'));
});
test('on-demand loader fetches only one small category shard once',async()=>{
  const entry=pathToFileURL(path.resolve(__dirname,'../assets/js/category-field-store.js')).href;
  const fetches=[];const sandbox={URL,document:{currentScript:{src:entry}},location:{href:entry},window:{},fetch:async u=>{fetches.push(u);return{ok:true,json:async()=>JSON.parse(fs.readFileSync(fileURLToPath(new URL(u)),'utf8'))}}};
  vm.createContext(sandbox);vm.runInContext(fs.readFileSync(fileURLToPath(entry),'utf8'),sandbox);
  const store=sandbox.window.ORBITA_INAPROC_FIELDS;
  assert.equal(fetches.length,0,'no eager data download during home loading');
  const row=master.constructionRows[0];
  const a=await store.get(row.id);assert.ok(a&&Array.isArray(a.p));
  assert.equal(fetches.length,1,'one lazy request for first category');
  await store.get(row.id);assert.equal(fetches.length,1,'cached in memory');
  await store.categoryMaster();assert.equal(fetches.length,2,'master only requested when needed');
  assert.equal(store.isLoaded(row.id),true);
});
test('frontend writes data-driven field values into unchanged draft JSON and keeps API fallback',()=>{
  const js=fs.readFileSync(path.resolve(__dirname,'../assets/js/selection.js'),'utf8');
  const gs=fs.readFileSync(path.resolve(__dirname,'../backend/Code-TRAXPBJ-Pemilihan.gs'),'utf8');
  assert.ok(js.includes('function readInaprocInputs(original={}'));
  assert.ok(js.includes('categoryFieldValues:readInaprocInputs(item)'));
  assert.ok(js.includes('categoryFieldValues:readInaprocInputs(base)'));
  assert.ok(js.includes('if(waitForInaprocSchema('));
  assert.ok(js.includes("API().call('listProductCategories'"));
  assert.ok(js.includes("API().call('listConstructionCategories'"));
  assert.ok(gs.includes('product_details_json:JSON.stringify'));
  assert.ok(gs.includes('construction_details_json:JSON.stringify'));
});
