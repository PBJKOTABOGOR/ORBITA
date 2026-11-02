'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const src=fs.readFileSync(path.resolve(__dirname,'../assets/js/selection.js'),'utf8');

test('Spesifikasi Tambahan appears once in generic form, directly before HPS before schema is resolved',()=>{
  const start=src.indexOf('  function productFieldsDialog(');
  const end=src.indexOf('  async function productCategoryDialog(',start);
  const snippet=src.slice(start,end);
  const captured={html:'',save:null};
  const state={category:'Jasa',products:[],dirty:false};
  const values={'#pdHps':'250000','#pdQty':'2','#pdUnit':'Paket','#pdSpec':'Kebutuhan proyektor'};
  const fields=Object.fromEntries(Object.entries(values).map(([k,value])=>[k,{value,addEventListener(){}}]));
  fields['#pdTotalHps']={textContent:''};fields['#pdBudgetNote']={textContent:'',classList:{toggle(){}}};
  fields['[data-save-product]']={disabled:true,addEventListener:(evt,cb)=>{if(evt==='click')captured.save=cb}};
  fields['#selModal']={classList:{remove(){}}};
  const ctx={
    modal:html=>captured.html=html,waitForInaprocSchema:()=>false,categoryReferenceCache:new Map(),ensureCategoryReference:()=>Promise.resolve(null),syncInaprocForm:()=>{},
    currentCreate:()=>state,esc:v=>String(v??''),currencyDisplay:v=>String(v??''),currencyDigits:v=>String(v??'').replace(/\D/g,''),fullRp:v=>String(v),
    editableDetailChoice:()=>'<select></select>',productUnits:['Paket'],productTotal:p=>Number(p.hps||0)*Number(p.qty||0),rupBudget:()=>10000000,
    competitionHps:()=>0,exceedsRupBudget:()=>false,rupBudgetMessage:()=>'',readInaprocInputs:()=>[],renderPreservingPosition:()=>{},productCategoryDialog:()=>{},
    $:sel=>fields[sel]||null
  };
  vm.runInNewContext(snippet+'\nthis.productFieldsDialog=productFieldsDialog;',ctx);
  const item={spec:'Catatan lama',unitPrice:250000,qty:2,unit:'Paket'};
  ctx.productFieldsDialog(state,-1,item,{id:'id-x',level1:'Jasa Akomodasi',level2:'Jasa Akomodasi',level3:'Jasa Paket Meeting Fullboard'});
  const html=captured.html;
  assert.equal((html.match(/id="pdSpec"/g)||[]).length,1);
  assert.ok(!html.includes('SPESIFIKASI / ATRIBUT'));
  assert.ok(html.indexOf('Spesifikasi Tambahan')<html.indexOf('id="pdHps"'));
  assert.ok(html.includes('Catatan lama'));
  assert.ok(!html.includes('id="pdName"'));
  return captured.save().then(()=>{
    assert.equal(state.products[0].spec,'Kebutuhan proyektor');
    assert.equal(state.products[0].extraSpecification,'Kebutuhan proyektor');
    assert.equal(state.products[0].name,'Jasa Paket Meeting Fullboard');
    assert.equal(state.products[0].hps,250000);
    assert.equal(state.products[0].qty,2);
  });
});

test('lazy-loaded dynamic INAPROC fields precede Spesifikasi Tambahan and HPS',async()=>{
  const start=src.indexOf("  function syncInaprocForm(categoryId,item={},kind='generic'){");
  const end=src.indexOf('  function constructionFieldsDialog(',start);
  const nodes=[{name:'spec'},{name:'hps'},{name:'qty'},{name:'unit'}];
  for(const node of nodes)node.before=function(value){nodes.splice(nodes.indexOf(this),0,value)};
  const grid={};nodes[1].closest=sel=>sel==='.sel-product-basic-grid'?grid:null;
  const overlay={classList:{contains:()=>true},querySelector:()=>dialog};
  const dialog={};let count=0;
  const inputSpec={closest:()=>nodes.find(n=>n.name==='spec')};
  const inputHps={closest:()=>nodes.find(n=>n.name==='hps')};
  const ctx={window:{ORBITA_INAPROC_FIELDS:{get:()=>{count++;return Promise.resolve({p:[['x','Tipe Paket Meeting','CHECKBOX','Fullboard']],a:[]})}}},
    $:(q,scope)=>q==='#selModal'?overlay:q==='#pdSpec'?inputSpec:q==='#pdHps'?inputHps:null,
    $$:()=>[],document:{createElement:()=>({className:'',innerHTML:''})},renderInaprocInputs:rows=>rows.map(r=>r[1]).join('')};
  vm.runInNewContext(src.slice(start,end)+'\nthis.syncInaprocForm=syncInaprocForm;',ctx);
  ctx.syncInaprocForm('id-x',{},'generic');await new Promise(resolve=>setImmediate(resolve));
  assert.equal(count,1);
  assert.deepEqual(nodes.map(n=>n.name||n.innerHTML),['Tipe Paket Meeting','spec','hps','qty','unit']);
});

test('health and construction paths, master data and backend are unchanged',()=>{
  assert.ok(src.includes("if(kind==='construction')"));
  assert.ok(src.includes("}else if(kind==='health')"));
  assert.ok(src.includes("categoryFieldValues:readInaprocInputs(item)"));
  const html=fs.readFileSync(path.resolve(__dirname,'../profil-pbj/index.html'),'utf8');
  const sw=fs.readFileSync(path.resolve(__dirname,'../sw.js'),'utf8');
  assert.ok(html.includes('selection.js?v=28.15'));
  assert.ok(sw.includes('selection.js?v=28.15'));
});
