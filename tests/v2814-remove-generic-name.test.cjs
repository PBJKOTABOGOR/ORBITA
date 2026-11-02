'use strict';
const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const src = fs.readFileSync(path.resolve(__dirname, '../assets/js/selection.js'), 'utf8');
const start = src.indexOf('  function productFieldsDialog(');
const end = src.indexOf('  async function productCategoryDialog(', start);
const body = src.slice(start, end);

function harness({oldItem = {}, categoryId = 'test-cat-id', categoryLeaf = 'Jasa Paket Meeting Fullboard'} = {}) {
  const state = {category: 'Jasa', products: [], dirty: false};
  if (Object.keys(oldItem).length) state.products.push(oldItem);
  const calls = {html:'', saved:false, listeners:{}};
  const input = (value)=>({value, addEventListener(name,cb){this.listeners ??= {};this.listeners[name]=cb}});
  const price = input('120000');
  const qty = input('2');
  const unit = input('Paket');
  const specification = input('Layanan rapat');
  const save = {disabled:true, addEventListener(name,cb){calls.listeners[name]=cb}};
  const total = {textContent:''};
  const budgetNote = {textContent:'',classList:{toggle(){}}};
  const overlay = {classList:{remove(name){if(name==='open')calls.closed=true}}};
  const elems = {'#pdHps':price,'#pdQty':qty,'#pdUnit':unit,'#pdSpec':specification,'[data-save-product]':save,'#pdTotalHps':total,'#pdBudgetNote':budgetNote,'#selModal':overlay};
  const context = {
    modal(html){calls.html=html},
    waitForInaprocSchema:()=>false,
    categoryReferenceCache:new Map([[categoryId,{kbliText:'55101'}]]),
    ensureCategoryReference:()=>Promise.resolve({kbliText:'55101'}),
    syncInaprocForm:()=>{},
    esc:s=>String(s??'').replaceAll('&','&amp;').replaceAll('<','&lt;'),
    currencyDisplay:s=>String(s??''),
    currencyDigits:s=>String(s??'').replace(/[^0-9]/g,''),
    fullRp:s=>'Rp'+s,
    editableDetailChoice:(id,arr,value)=>`<select id="${id}"><option>${value||''}</option></select>`,
    productUnits:['Paket'],
    productTotal:p=>(Number(p.unitPrice||p.hps)||0)*(Number(p.qty)||0),
    rupBudget:()=>1e12,
    competitionHps:c=>c.reduce((acc,p)=>acc+(Number(p.unitPrice)||0)*(Number(p.qty)||0),0),
    exceedsRupBudget:(total,budget)=>total>budget,
    rupBudgetMessage:()=>'',
    readInaprocInputs:()=>[{id:'x',name:'Tipe Paket Meeting',value:'Fullboard'}],
    renderPreservingPosition(){calls.saved=true},
    productCategoryDialog:()=>{},
    $:sel=>elems[sel]||null
  };
  vm.runInNewContext(body+'\nthis.productFieldsDialog=productFieldsDialog;',context);
  const meta = {id:categoryId, level1:'Jasa Akomodasi', level2:'Jasa Akomodasi', level3:categoryLeaf, path:`Jasa Akomodasi > Jasa Akomodasi > ${categoryLeaf}`,productType:'SERVICE'};
  context.productFieldsDialog(state,oldItem&&Object.keys(oldItem).length?0:-1,oldItem,meta);
  return {state,calls,save,price,qty,unit,context};
}

test('field Nama Produk/Jasa tidak dibuat dan tombol Simpan aktif tanpa input nama',()=>{
  const {calls,save} = harness();
  assert.ok(calls.html.includes('Spesifikasi Tambahan'));
  assert.ok(calls.html.includes('HARGA SATUAN'));
  assert.ok(!calls.html.includes('id="pdName"'));
  assert.ok(!calls.html.includes('NAMA LAYANAN/JASA'));
  assert.ok(!src.includes("$('#pdName')"));
  assert.equal(save.disabled,false);
});

test('detail baru memakai nama kategori, nilai tetap disimpan ke format lama',async()=>{
  const {state,calls} = harness();
  await calls.listeners.click();
  assert.equal(state.products.length,1);
  assert.equal(state.products[0].name,'Jasa Paket Meeting Fullboard');
  assert.equal(state.products[0].desc,'Jasa Paket Meeting Fullboard');
  assert.equal(state.products[0].spec,'Layanan rapat');
  assert.equal(state.products[0].unitPrice,120000);
  assert.equal(state.products[0].qty,2);
  assert.equal(state.products[0].unit,'Paket');
  assert.equal(state.products[0].categoryFieldValues[0].value,'Fullboard');
  assert.equal(state.dirty,true);
  assert.equal(calls.saved,true);
});

test('saat edit detail pada kategori sama, nama lama tetap tersimpan',async()=>{
  const prev={name:'Nama dari draft lama',desc:'Nama dari draft lama',categoryId:'test-cat-id',level3:'Jasa Paket Meeting Fullboard',hps:240000,qty:1,unit:'Paket'};
  const {state,calls} = harness({oldItem:prev});
  await calls.listeners.click();
  assert.equal(state.products.length,1);
  assert.equal(state.products[0].name,'Nama dari draft lama');
});

test('ketika ganti kategori, nama ikut kategori baru bukan nama lama',async()=>{
  const prev={name:'Nama lama',categoryId:'old-category',level3:'Kategori Lama',hps:100000,qty:1,unit:'Paket'};
  const {state,calls} = harness({oldItem:prev});
  await calls.listeners.click();
  assert.equal(state.products.length,1);
  assert.equal(state.products[0].name,'Jasa Paket Meeting Fullboard');
});

test('field dinamis tetap di atas HPS, asset master dan backend tidak berubah',()=>{
  const block=src.slice(src.indexOf('function syncInaprocForm('),src.indexOf('function constructionFieldsDialog('));
  assert.ok(block.includes('(specificationField||priceField).before(block)'));
  assert.ok(src.includes("categoryFieldValues:readInaprocInputs(item)"));
  const html=fs.readFileSync(path.resolve(__dirname,'../profil-pbj/index.html'),'utf8');
  const sw=fs.readFileSync(path.resolve(__dirname,'../sw.js'),'utf8');
  assert.ok(html.includes('selection.js?v=28.15'));
  assert.ok(sw.includes('selection.js?v=28.15'));
});
