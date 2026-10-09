const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.resolve(__dirname,'..');
const source=fs.readFileSync(path.join(root,'assets/js/selection.js'),'utf8');
const css=fs.readFileSync(path.join(root,'assets/css/selection.css'),'utf8');
const html=fs.readFileSync(path.join(root,'profil-pbj/index.html'),'utf8');
function makeUi(role='KEPALA_UKPBJ'){
 const w={};const doc={addEventListener(){},querySelector(){return null},querySelectorAll(){return []}};
 const context={window:w,document:doc,console,setTimeout,clearTimeout,Intl,Date,Map,Set,URL,Number,String,JSON,Math,localStorage:{getItem(){return null}},sessionStorage:{getItem(){return null}},navigator:{}};
 vm.createContext(context);
 const exported=source.replace(/\n\}\)\(\);\s*$/,'\n window.__recapTest={opdRecapHtml,detailHtml,state};\n})();');
 vm.runInContext(exported,context,{timeout:1500});
 w.__recapTest.state.me={role,user_id:'test'};
 return w.__recapTest;
}
const base={request_id:'P-62688119-01',year:'2026',kode_rup:'62688119',nama_paket:'Belanja Jasa Tenaga Kebersihan',opd:'DINAS KESEHATAN',jenis:'Jasa Lainnya',pagu:356300000,sumber_dana:'APBD',status:'MENUNGGU_DISPOSISI',current_round:1,metode_pengadaan:'E-Purchasing',schedule_start_date:'2026-10-14',schedule_end_date:'2026-10-18',schedule_start_time:'09:30',schedule_end_time:'16:30',completion_date:'2026-11-30',work_location:'Kota Bogor',competition_title:'Paket Kebersihan',qualification_json:JSON.stringify({umk:true,mikro:true,kecil:false,nonUmk:false}),offer_type:'ITEMIZED',product_category:'Barang'};
const wrap=r=>({request:r,docs:[],reviews:[],notes:[],audit:[],docConfig:[],pokja:[]});
test('label proses tampil terpisah dari status dengan warna dan tidak mengubah status paket',()=>{
 const x=makeUi();const mini=x.detailHtml(wrap({...base,selection_process:'MINI_KOMPETISI',competition_type:'NON_CONSTRUCTION'}));
 assert.match(mini,/sel-detail-process competition">Mini Kompetisi/);assert.match(mini,/Menunggu Disposisi/);
 const nego=x.detailHtml(wrap({...base,selection_process:'NEGOSIASI',competition_type:'',notes:'Tinjau spesifikasi.'}));
 assert.match(nego,/sel-detail-process negotiation">Negosiasi/);
 assert.match(css,/\.sel-detail-process\.negotiation\{/);assert.match(css,/\.sel-detail-process\.competition\{/);
});
test('Kepala UKPBJ dan Pokja melihat rekap lengkap dan data kosong tidak muncul',()=>{
 for(const role of ['KEPALA_UKPBJ','POKJA']){
  const x=makeUi(role);const r={...base,selection_process:'MINI_KOMPETISI',competition_type:'NON_CONSTRUCTION',product_details_json:JSON.stringify([{name:'Produk A',categoryPath:'Alat Kesehatan > Produk A',kbli:'12345',qty:2,unit:'buah',hps:1200000,nie:'',kfa:''}])};
  const result=x.opdRecapHtml(wrap(r));
  assert.match(result,/data-opd-recap="P-62688119-01" open/);
  for(const v of ['Jadwal Kompetisi','Kualifikasi Penyedia','14 Okt 2026','18 Okt 2026','Penyelesaian','30 Nov 2026','Detail Produk','Produk A','12345','Lokasi Pekerjaan','Jenis Penawaran'])assert.ok(result.includes(v),v);
  assert.doesNotMatch(result,/>Kode KFA</);assert.doesNotMatch(result,/>Nomor Izin Edar/);
  assert.doesNotMatch(result,/data-edit-product|data-delete-product/);
 }
});
test('Rekap konstruksi berisi kualifikasi, pembayaran dan pekerjaan, tanpa kolom kosong',()=>{
 const x=makeUi('POKJA');const r={...base,selection_process:'MINI_KOMPETISI',competition_type:'CONSTRUCTION',qualification_json:JSON.stringify({kecil:true,menengah:true}),payment_type:'TERMIN',payment_terms_count:2,payment_terms_note:'Termin 1: 50%',construction_details_json:JSON.stringify([{name:'Pembangunan Kantor',categoryPath:'Gedung > Pemeliharaan',sbu:'BG001',productCode:'',qty:2,hps:25000000}])};
 const result=x.opdRecapHtml(wrap(r));
 for(const v of ['Pekerjaan Konstruksi','Pembangunan Kantor','Sertifikat Badan Usaha','Termin 1: 50%','Jumlah Termin','UMK - Kecil','Non-UMK - Menengah'])assert.ok(result.includes(v),v);
 assert.doesNotMatch(result,/Kode Produk/);
});
test('Negosiasi menampilkan data relevan saja dan aman dari HTML tidak tepercaya',()=>{
 const x=makeUi('KEPALA_UKPBJ');const r={...base,selection_process:'NEGOSIASI',competition_type:'',notes:'Mohon teliti <script>alert(1)</script>'};
 const result=x.opdRecapHtml(wrap(r));
 assert.match(result,/Informasi Negosiasi/);assert.match(result,/Catatan PPK/);assert.match(result,/&lt;script&gt;/);
 assert.doesNotMatch(result,/<script>alert/);assert.doesNotMatch(result,/Jadwal Kompetisi/);
});
test('Tidak ada request tambahan maupun perubahan skema database, cache bust telah diperbarui',()=>{
 assert.match(html,/selection\.css\?v=28\.07/);assert.match(html,/selection\.js\?v=28\.07/);
 assert.match(source,/function opdRecapHtml\(d\)/);
 assert.doesNotMatch(source.slice(source.indexOf('function opdRecapHtml(d)'),source.indexOf('function detailHtml(d)')),/API\(\)\.call\(/);
});
