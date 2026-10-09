const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const js=fs.readFileSync(path.join(__dirname,'../assets/js/selection.js'),'utf8');
const css=fs.readFileSync(path.join(__dirname,'../assets/css/selection.css'),'utf8');
const api=fs.readFileSync(path.join(__dirname,'../assets/js/selection-api.js'),'utf8');
const backend=fs.readFileSync(path.join(__dirname,'../backend/Code-TRAXPBJ-Pemilihan.gs'),'utf8');
const html=fs.readFileSync(path.join(__dirname,'../profil-pbj/index.html'),'utf8');

test('construction flow is selectable and has its own route',()=>{
  assert.match(js,/data-competition-type="CONSTRUCTION"/);
  assert.match(js,/permohonan\/form\/konstruksi/);
  assert.match(js,/createConstructionFormHtml/);
  assert.doesNotMatch(js,/Form Pekerjaan Konstruksi dilanjutkan pada tahap berikutnya/);
});

test('construction categories come from PBJ_KATEGORI_KONSTRUKSI and are cached',()=>{
  assert.match(backend,/CONSTRUCTION_CATEGORIES:\s*'PBJ_KATEGORI_KONSTRUKSI'/);
  assert.match(backend,/function listConstructionCategories_/);
  assert.match(api,/listConstructionCategories/);
  assert.match(js,/CONSTRUCTION_CATEGORY_CACHE_KEY='orbit_pbj_construction_categories_v2786'/);
  assert.match(js,/sessionStorage\.setItem\(CONSTRUCTION_CATEGORY_CACHE_KEY/);
});

test('construction qualifications default to checked Kecil Menengah Besar',()=>{
  assert.match(js,/constructionDefaultQualifications=\(\)=>\(\{umk:true,mikro:false,kecil:true,nonUmk:true,menengah:true,besar:true\}\)/);
  assert.match(js,/UMK - Kecil/);
  assert.match(js,/Pilih Jenis Non-UMK/);
});

test('payment supports single and termin with termin fields',()=>{
  assert.match(js,/name="mcPaymentType" value="SINGLE"/);
  assert.match(js,/name="mcPaymentType" value="TERMIN"/);
  assert.match(js,/id="mcPaymentTermsCount"/);
  assert.match(js,/id="mcPaymentTermsNote"/);
  assert.match(backend,/payment_terms_count/);
  assert.match(backend,/payment_terms_note/);
});

test('drainase detail follows supplied fields without SIPASTI',()=>{
  const start=js.indexOf('function constructionFieldsDialog');
  const end=js.indexOf('function readDetailedProductDialog',start);
  const block=js.slice(start,end);
  for(const text of ['Daftar Produk Sektoral','Nama Pekerjaan','Satuan Pengukuran','Kode Produk','Lingkup Kegiatan','Lokasi Layanan (Kecamatan)','Sertifikat Badan Usaha (SBU) Konstruksi','Masa Berlaku Sertifikat Badan Usaha (SBU) Konstruksi','Sertifikat Standar','Komponen Struktur Biaya Tayang','Informasi Lainnya','Spesifikasi Tambahan','HPS Pekerjaan','Total HPS Pekerjaan']) assert.ok(block.includes(text),text);
  assert.ok(!block.includes('SIPASTI'));
});

test('drainase dropdown values are present',()=>{
  assert.match(js,/1 m’ Buis Beton D 80 - 100 cm/);
  assert.match(js,/1 m’ Buis Beton 1\/2 D 100 - 100 cm/);
  assert.match(js,/const constructionMeasurementUnits=\['Meter Kubik','Meter Persegi','Meter Panjang'/);
  assert.match(js,/const constructionPresenceOptions=\['Memiliki','Tidak Memiliki'\]/);
});

test('construction HPS formats and totals live',()=>{
  assert.match(js,/id="cdHps"[\s\S]*?currencyDisplay\(item\?\.hps\|\|''\)/);
  assert.match(js,/total\.textContent=fullRp\(h\*q\)/);
  assert.match(js,/data-save-construction disabled/);
});

test('backend persists construction details and accepts construction submit',()=>{
  assert.match(backend,/construction_details_json/);
  assert.match(backend,/\['NON_CONSTRUCTION','CONSTRUCTION'\]/);
  assert.match(backend,/Tambahkan minimal satu detail pekerjaan konstruksi/);
  assert.match(backend,/upgradePemilihanV2786/);
});

test('construction assets remain cache busted in current build',()=>{
  assert.match(html,/selection\.css\?v=27\.97/);
  assert.match(html,/selection-api\.js\?v=27\.91/);
  assert.match(html,/selection\.js\?v=27\.98/);
  assert.match(css,/v27\.86 — Pekerjaan Konstruksi/);
});
