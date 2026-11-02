const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const js=fs.readFileSync(path.join(__dirname,'../assets/js/selection.js'),'utf8');
const css=fs.readFileSync(path.join(__dirname,'../assets/css/selection.css'),'utf8');
const api=fs.readFileSync(path.join(__dirname,'../assets/js/selection-api.js'),'utf8');
const backend=fs.readFileSync(path.join(__dirname,'../backend/Code-TRAXPBJ-Pemilihan.gs'),'utf8');

test('competition dates enforce today, end-after-start and completion-after-competition',()=>{
  assert.match(js,/id="mcStartDate" type="date" min="\$\{esc\(startMin\)\}"/);
  assert.match(js,/id="mcEndDate" type="date" min="\$\{esc\(endMin\)\}"/);
  assert.match(js,/id="mcCompletionDate" type="date" min="\$\{esc\(completionMin\)\}"/);
  assert.match(backend,/schedule_start_date\)<today/);
  assert.match(backend,/requestDateYmd_\(req\.schedule_end_date\)<requestDateYmd_\(req\.schedule_start_date\)/);
  assert.match(backend,/requestDateYmd_\(req\.completion_date\)<requestDateYmd_\(req\.schedule_end_date\)/);
});

test('form barang jasa langsung pakai itemized default tanpa seksi jenis penawaran',()=>{
  assert.doesNotMatch(js,/id="mcOffer"/);
  assert.doesNotMatch(js,/Jenis Penawaran/);
  assert.match(js,/if\(!c\.offerType\)c\.offerType='ITEMIZED'/);
  assert.match(backend,/offer_type:competitionType==='CONSTRUCTION'\?'':String\(data\.offerType\|\|'ITEMIZED'\)\.toUpperCase\(\)/);
  assert.match(backend,/const offerType=String\(req\.offer_type\|\|'ITEMIZED'\)\.toUpperCase\(\)/);
});

test('health detail form contains requested INAPROC fields and guarded save',()=>{
  for(const label of ['Kode KFA','Spesifikasi Produk','Nomor Izin Edar (NIE)','Masa Berlaku NIE','Daftar Distributor yang Ditunjuk','Izin Distribusi Alat Kesehatan','Hasil Pengujian Post Market','Pemberitahuan Import Barang (PIB)','BMHP','Garansi','Surat Ketersediaan Layanan Purna Jual dan Spare Part','Struktur Harga','Label Produk Ramah Lingkungan Hidup','Spesifikasi Tambahan','HPS Produk','Jumlah','Satuan']) assert.ok(js.includes(label),label);
  assert.match(js,/data-save-product disabled/);
  assert.match(js,/save\.disabled=!\(h>0&&q>0&&String\(unit\?\.value\|\|''\)\.trim\(\)&&!over\)/);
  assert.match(js,/sel-product-limit/);
  assert.match(js,/currencyDisplay\(hps\.value\)/);
  assert.match(js,/Total HPS Produk/);
  assert.match(js,/Total HPS Kompetisi/);
});

test('unit list and product edit-delete summary are included',()=>{
  for(const unit of ['Cartridges','Ha Per Bulan','Orang per Bulan','Pengujian','Rupiah per Jam','Titik Lokasi','Voyage','1 X']) assert.ok(js.includes(`'${unit}'`),unit);
  assert.match(js,/data-edit-product/);
  assert.match(js,/data-delete-product/);
  assert.match(css,/\.sel-product-card/);
});

test('preparation upload uses INAPROC-style dropzone and 10MB direct upload limit',()=>{
  assert.match(js,/Pilih atau tarik dokumen di sini/);
  assert.match(js,/Unggah Dokumen/);
  assert.match(js,/maks\. 10 MB/);
  assert.match(api,/maxBytes=10\*1024\*1024/);
  assert.match(backend,/MAX_FILE_BYTES: 10 \* 1024 \* 1024/);
});

test('product details remain structured in existing request json and documents remain separate',()=>{
  assert.match(backend,/product_details_json:JSON\.stringify\(/);
  assert.match(backend,/PBJ_DOKUMEN:/);
  assert.match(backend,/product_details_json/);
});
