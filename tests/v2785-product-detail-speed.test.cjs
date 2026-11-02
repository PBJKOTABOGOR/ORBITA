const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const js=fs.readFileSync(path.join(__dirname,'../assets/js/selection.js'),'utf8');
const css=fs.readFileSync(path.join(__dirname,'../assets/css/selection.css'),'utf8');
const backend=fs.readFileSync(path.join(__dirname,'../backend/Code-TRAXPBJ-Pemilihan.gs'),'utf8');
const html=fs.readFileSync(path.join(__dirname,'../profil-pbj/index.html'),'utf8');

test('category master is prefetched once and cached in the browser session',()=>{
  assert.match(js,/listProductCategories',\{includeAll:true\}/);
  assert.match(js,/PRODUCT_CATEGORY_CACHE_KEY='orbit_pbj_product_categories_v2785'/);
  assert.match(js,/sessionStorage\.setItem\(PRODUCT_CATEGORY_CACHE_KEY/);
  assert.match(js,/if\(c\.category\)ensureProductCategoryRows\(c\.category\)\.catch/);
  assert.match(backend,/payload&&payload\.includeAll/);
  assert.match(backend,/out\.category=String\(r\.kelompok/);
});

test('health detail is one vertical scroll flow and header scrolls away like source',()=>{
  assert.match(css,/v27\.85 — detail produk/);
  assert.match(css,/\.sel-health-detail\{[\s\S]*?max-height:min\(640px,72vh\)[\s\S]*?overflow-y:auto/);
  assert.match(css,/\.sel-health-detail \.sel-dialog-head\{[\s\S]*?position:static/);
  assert.match(css,/\.sel-health-detail \.sel-product-fields\{[\s\S]*?grid-template-columns:1fr/);
});

test('INAPROC dropdown values and order are retained',()=>{
  assert.match(js,/\['Menunjuk','Tidak Menunjuk'\]/);
  assert.match(js,/const availabilityOptions=\['Tersedia','Tidak Tersedia'\]/);
  assert.match(js,/const adaOptions=\['Ada','Tidak Ada'\]/);
  assert.match(js,/const yesNoOptions=\['Ya','Tidak'\]/);
  assert.match(js,/const warrantyOptions=\['Tidak Tersedia',\.\.\.Array\.from\(\{length:10\}/);
  const order=['pdDistributor','pdDistributionPermit','pdGoodManufacturing','pdGoodDistribution','pdTelecomCertificate','pdRadiationPermit','pdPostMarket','pdPib','pdBmhp','pdWarranty','pdAfterSales','pdPriceStructure'];
  let last=-1;
  for(const id of order){const i=Math.max(js.indexOf(`editableDetailChoice('${id}'`),js.indexOf(`id="${id}"`));assert.ok(i>last,`${id} order`);last=i;}
});

test('terminal category click opens detail immediately',()=>{
  assert.match(js,/data-cat-leaf[\s\S]*?productFieldsDialog\(c,index,item,row\)/);
});

test('HPS formats thousands and total is recalculated live',()=>{
  assert.match(js,/currencyDisplay\(hps\.value\)/);
  assert.match(js,/total\.textContent=fullRp\(h\*q\)/);
  assert.match(js,/currencyDisplay\(item\?\.unitPrice\|\|item\?\.hps\|\|''\)/);
  assert.match(js,/gtotal\.textContent=fullRp\(h\*q\)/);
});

test('browser cache bust points to current assets',()=>{
  assert.match(html,/selection\.css\?v=27\.97/);
  assert.match(html,/selection\.js\?v=27\.98/);
});
