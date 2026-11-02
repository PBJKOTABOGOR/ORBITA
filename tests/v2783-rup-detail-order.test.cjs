const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const js=fs.readFileSync(path.join(__dirname,'../assets/js/selection.js'),'utf8');
const html=fs.readFileSync(path.join(__dirname,'../profil-pbj/index.html'),'utf8');
const backend=fs.readFileSync(path.join(__dirname,'../backend/Code-TRAXPBJ-Pemilihan.gs'),'utf8');

test('RUP picker is searchable and shows pagu in option rows',()=>{
  assert.match(js,/id="mcRupSearch" type="search"/);
  assert.match(js,/Cari Kode RUP atau nama paket\. Pagu langsung terlihat pada daftar\./);
  assert.match(js,/class="sel-rup-option"[\s\S]*?<small>\$\{fmtRp\(x\.pagu\|\|0\)\}<\/small>/);
});

test('product category master is loaded from spreadsheet, not hardcoded category trees',()=>{
  assert.match(js,/listProductCategories/);
  assert.doesNotMatch(js,/healthCategoryTree|barangCategoryTree|barangRootCategories|healthCategoryGroups/);
  assert.match(backend,/PBJ_KATEGORI_PRODUK/);
  assert.match(backend,/function listProductCategories_/);
});

test('detail popup follows INAPROC field order and controls',()=>{
  const labels=['Kode KFA','Spesifikasi Produk','Nomor Izin Edar (NIE)','Masa Berlaku NIE','Daftar Distributor yang Ditunjuk','Izin Distribusi Alat Kesehatan','Sertifikat Cara Pembuatan Alat Kesehatan yang Baik Yang Masih Berlaku','Sertifikat Cara Distribusi Alat Kesehatan Yang Baik Yang Masih Berlaku','Sertifikat Alat Telekomunikasi dan/atau Perangkat Telekomunikasi','Sertifikat Izin Pemanfaatan Sumber Radiasi Pengion (SRP)','Hasil Pengujian Post Market','Pemberitahuan Import Barang (PIB)','BMHP','Garansi','Surat Ketersediaan Layanan Purna Jual dan Spare Part','Struktur Harga','Informasi Lainnya','Label Produk Ramah Lingkungan Hidup','Spesifikasi Tambahan'];
  let pos=-1;for(const label of labels){const next=js.indexOf(`<span>${label} <em>Tidak Wajib</em></span>`);assert.ok(next>pos,`${label} must be in order`);pos=next;}
  assert.match(js,/data-save-product disabled/);
  assert.match(js,/currencyDisplay\(hps\.value\)/);
});

test('request row already persists category and full product detail json',()=>{
  assert.match(backend,/['"]product_category['"]/);
  assert.match(backend,/['"]product_details_json['"]/);
  assert.match(backend,/product_details_json:JSON\.stringify\(details\)/);
});

test('selection asset cache bust points to current version',()=>{
  assert.match(html,/selection\.js\?v=27\.90/);
});
