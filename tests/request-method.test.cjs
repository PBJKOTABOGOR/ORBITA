const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.join(__dirname,'..');
const backend=fs.readFileSync(path.join(root,'backend/Code-TRAXPBJ-Pemilihan.gs'),'utf8');
const frontend=fs.readFileSync(path.join(root,'assets/js/selection.js'),'utf8');

function backendContext(){
  const rows=[
    ['Kode RUP','Nama Paket','Satuan Kerja','Program','Kegiatan','Sub Kegiatan','Jenis Pengadaan','Cara Pengadaan','Metode Pemilihan','Pagu Anggaran','Produk Dalam Negeri','Sumber Dana','Waktu Pemilihan'],
    ['111','Paket E Besar','OPD A','P','K','SK','Barang','Penyedia','E-Purchasing','Rp300.000.000','Ya','APBD','Oktober'],
    ['222','Paket E Kecil','OPD A','P','K','SK','Barang','Penyedia','E-Purchasing','Rp150.000.000','Ya','APBD','Oktober'],
    ['223','Paket E Tepat 200','OPD A','P','K','SK','Barang','Penyedia','E-Purchasing','Rp200.000.000','Ya','APBD','Oktober'],
    ['333','Paket Tender','OPD A','P','K','SK','Konstruksi','Penyedia','Tender','Rp900.000.000','','APBD','Oktober'],
    ['444','Paket OPD Lain','OPD B','P','K','SK','Barang','Penyedia','E-Purchasing','Rp500.000.000','','APBD','Oktober'],
    ['555','Paket E Aktif','OPD A','P','K','SK','Barang','Penyedia','E-Purchasing','Rp400.000.000','','APBD','Oktober']
  ];
  const c=vm.createContext({console,Date,SpreadsheetApp:{openById:()=>({getSheetByName:()=>({getLastRow:()=>rows.length,getLastColumn:()=>rows[0].length,getRange:()=>({getDisplayValues:()=>rows.map(r=>r.slice())})})})}});
  vm.runInContext(backend,c);
  c.sheet_=()=>'';
  c.rows_=()=>[{request_id:'P-555-01',kode_rup:'555',status:'DIAJUKAN'}];
  return c;
}

test('form chooses procurement method before RUP and removes e-purchasing submethod dropdown',()=>{
  const block=frontend.slice(frontend.indexOf("function openCreate"),frontend.indexOf('function uploadLabelProgress'));
  assert.ok(block.indexOf('METODE PENGADAAN')<block.indexOf('KODE RUP'));
  assert.match(block,/option value="E-Purchasing"/);
  assert.match(block,/option value="Tender"/);
  assert.match(block,/option value="Seleksi"/);
  assert.doesNotMatch(block,/Mini Kompetisi|Negosiasi|Pembelian Langsung|newEpurMethod/);
  assert.match(block,/Pengajuan \$\{method\} saat ini belum tersedia/);
});

test('E-Purchasing RUP list is scoped to account OPD and minimum Rp200 million',()=>{
  const c=backendContext();
  const r=c.listRupOptions_({role:'PPK',opd:'OPD A'},{method:'E-Purchasing'});
  assert.equal(r.available,true);
  assert.deepEqual(Array.from(r.items,x=>x.kodeRup).sort(),['111','555']);
  assert.equal(r.items.find(x=>x.kodeRup==='111').activeRequestId,'');
  assert.equal(r.items.find(x=>x.kodeRup==='555').activeRequestId,'P-555-01');
  assert.ok(r.items.every(x=>x.pagu>200000000));
  assert.ok(r.items.every(x=>x.opd==='OPD A'));
});

test('Tender and Seleksi stay visible but cannot start an unsupported request',()=>{
  const c=backendContext();
  for(const method of ['Tender','Seleksi']){
    const r=c.listRupOptions_({role:'PPK',opd:'OPD A'},{method});
    assert.equal(r.available,false);
    assert.equal(r.items.length,0);
    assert.match(r.message,/belum tersedia/i);
  }
  c.lookupRup_=()=>({kodeRup:'111',opd:'OPD A',namaPaket:'Paket',pagu:300000000,tahun:2026});
  assert.throws(()=>c.createRequest_({role:'PPK',user_id:'u',opd:'OPD A'},{kodeRup:'111',metodePengadaan:'Tender'}),/belum tersedia/i);
});
