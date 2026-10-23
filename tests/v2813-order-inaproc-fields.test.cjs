'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const src=fs.readFileSync(path.resolve(__dirname,'../assets/js/selection.js'),'utf8');
const start=src.indexOf('  function syncInaprocForm(categoryId,item={},kind=\'generic\'){');
const end=src.indexOf('  function constructionFieldsDialog(',start);
assert.ok(start>0&&end>start);
const body=src.slice(start,end);

test('generic INAPROC fields are inserted before additional specification and HPS without extra API reads',async()=>{
  const nodes=[{name:'spec'},{name:'hps'},{name:'qty'},{name:'unit'},{name:'total'}];
  const grid={};
  const priceField=nodes[1];
  priceField.closest=sel=>sel==='.sel-product-basic-grid'?grid:null;
  priceField.before=node=>nodes.splice(nodes.indexOf(priceField),0,node);
  nodes[0].before=node=>nodes.splice(nodes.indexOf(nodes[0]),0,node);
  const input={closest:sel=>sel==='.sel-field'?priceField:null};
  const specInput={closest:sel=>sel==='.sel-field'?nodes[0]:null};
  const dialog={};
  const overlay={classList:{contains:c=>c==='open'},querySelector:sel=>sel==='.sel-dialog'?dialog:null};
  let loads=0,created=0;
  const api={get:id=>{loads++;assert.equal(id,'test-id');return Promise.resolve({p:[['a','Tipe Paket Meeting','CHECKBOX','Fullboard']],a:[['b','Informasi Lainnya','TEXT','']]})}};
  const context={window:{ORBITA_INAPROC_FIELDS:api},
    $:(sel,scope)=>sel==='#selModal'?overlay:sel==='#pdHps'&&scope===dialog?input:sel==='#pdSpec'&&scope===dialog?specInput:null,
    $$:()=>[],
    document:{createElement:tag=>{assert.equal(tag,'div');created++;return {className:'',innerHTML:''}}},
    renderInaprocInputs:entries=>entries.map(r=>`<label data-id="${r[0]}">${r[1]}</label>`).join('')};
  vm.runInNewContext(body+'\nthis.syncInaprocForm=syncInaprocForm;',context);
  context.syncInaprocForm('test-id',{},'generic');
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(loads,1);assert.equal(created,1);
  assert.deepEqual(nodes.map(n=>n.name||'fields'),['fields','spec','hps','qty','unit','total']);
  assert.match(nodes[0].className,/\bwide\b/);
  assert.match(nodes[0].innerHTML,/Tipe Paket Meeting/);
  assert.match(nodes[0].innerHTML,/Informasi Lainnya/);
});

test('HPS, save handlers, and independent health/construction field renderers remain untouched',()=>{
  assert.match(src,/const ghps=\$\('#pdHps'\)/);
  assert.match(src,/categoryFieldValues:readInaprocInputs\(item\)/);
  assert.match(src,/sections\[1\]\.innerHTML='<h5>Informasi Utama<\/h5>'\+primary/);
  assert.match(src,/const fields=\$\('\.sel-product-fields',dialog\)/);
  const html=fs.readFileSync(path.resolve(__dirname,'../profil-pbj/index.html'),'utf8');
  const sw=fs.readFileSync(path.resolve(__dirname,'../sw.js'),'utf8');
  assert.match(html,/selection\.js\?v=28\.15/);
  assert.match(sw,/selection\.js\?v=28\.15/);
});
