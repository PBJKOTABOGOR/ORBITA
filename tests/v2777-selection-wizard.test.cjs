const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.join(__dirname,'..');
const selection=fs.readFileSync(path.join(root,'assets/js/selection.js'),'utf8');
const control=fs.readFileSync(path.join(root,'assets/js/control-room.js'),'utf8');
const profile=fs.readFileSync(path.join(root,'assets/js/profile.js'),'utf8');
const docs=fs.readFileSync(path.join(root,'assets/js/orbita-docs-timeline.js'),'utf8');
const css=fs.readFileSync(path.join(root,'assets/css/selection.css'),'utf8');
const backend=fs.readFileSync(path.join(root,'backend/Code-TRAXPBJ-Pemilihan.gs'),'utf8');
const html=fs.readFileSync(path.join(root,'profil-pbj/index.html'),'utf8');

test('documentation back returns home and intro only plays once',()=>{
  assert.match(profile,/history\.replaceState\(\{traxPanel:'home'\}[^\n]+#home/);
  assert.match(profile,/let docsOpenedOnce=false/);
  assert.match(docs,/let introPlayed=false/);
  assert.match(docs,/modal&&!introPlayed/);
});

test('repair review gets semantic amber styling in pipeline and history',()=>{
  assert.match(css,/sel-stepper\[data-status="PERLU_PERBAIKAN_PPK"\]/);
  assert.match(css,/sel-audit-repair:before\{background:#d88b16/);
  assert.match(selection,/sel-audit-repair/);
});

test('selection flow has route-per-page hashes and browser history support',()=>{
  assert.match(selection,/permohonan\/jenis/);
  assert.match(selection,/permohonan\/form\/barang-jasa/);
  assert.match(selection,/permohonan\/detail\//);
  assert.match(control,/startsWith\('#pengelolaan-pbj'\)/);
  assert.match(control,/\^\(permohonan\|laporan\|admin\)/);
});

test('non construction request form includes requested sections and draft submission actions',()=>{
  for(const text of ['Pilih Jenis Kompetisi','Barang/Jasa Lainnya','Rencana Umum Pengadaan (RUP)','Jadwal Kompetisi','Kualifikasi Penyedia','Detail Produk','Lokasi','Penyelesaian Pekerjaan','Dokumen Persiapan','Simpan Draft','Kirim ke Kepala UKPBJ'])assert.ok(selection.includes(text),text);
  for(const cat of ['Alat Kesehatan','Barang','Material Konstruksi','Digital','Jasa','Telekomunikasi','Obat'])assert.ok(selection.includes(cat),cat);
  for(const scale of ['Mikro','Kecil','Menengah','Besar'])assert.ok(selection.includes(scale),scale);
});

test('backend persists wizard fields and exposes save draft without changing direct upload path',()=>{
  assert.match(backend,/if \(action === 'saveDraftRequest'\)/);
  for(const col of ['competition_type','competition_title','schedule_start_date','qualification_json','product_category','product_details_json','offer_type','work_location','completion_date'])assert.ok(backend.includes(col),col);
  assert.match(backend,/function saveDraftRequest_/);
  assert.match(backend,/function submitRequest_/);
  assert.match(backend,/finalizeDirectUpload/);
});

test('frontend cache links untuk modul utama tetap terpasang',()=>{
  for(const asset of ['selection.css?v=','selection.js?v=','control-room.js?v=','profile.js?v=','orbita-docs-timeline.js?v='])assert.ok(html.includes(asset),asset);
});
