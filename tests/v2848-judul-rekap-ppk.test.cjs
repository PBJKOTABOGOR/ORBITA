const { test }=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'..');
const code=fs.readFileSync(path.join(root,'backend/Code-TRAXPBJ-Pemilihan.gs'),'utf8');
const front=fs.readFileSync(path.join(root,'assets/js/selection.js'),'utf8');
const html=fs.readFileSync(path.join(root,'profil-pbj/index.html'),'utf8');
const sw=fs.readFileSync(path.join(root,'sw.js'),'utf8');
function context(){const sandbox=vm.createContext({console,Date,Number,Math,JSON,Utilities:{},SpreadsheetApp:{}});vm.runInContext(code,sandbox);return sandbox}
function requests(){return [
 {request_id:'P-65213822-01',kode_rup:'65213822',nama_paket:'Nama RUP Asli',judul_permohonan:'Jasa Kebersihan',status:'PROSES_INAPROC',ppk_user_id:'u',year:2026,updated_at:'2026-10-22T01:00:00Z'},
 {request_id:'P-65213822-02',kode_rup:'65213822',nama_paket:'Nama RUP Asli',judul_permohonan:'Belanja Alat Tulis',status:'PROSES_INAPROC',ppk_user_id:'u',year:2026,updated_at:'2026-10-22T02:00:00Z'},
 {request_id:'P-65213822-03',kode_rup:'65213822',nama_paket:'Nama RUP Asli',judul_permohonan:'Pengadaan Komputer',status:'PROSES_INAPROC',ppk_user_id:'u',year:2026,updated_at:'2026-10-22T03:00:00Z'}
]}
test('bootstrapFast menghitung 3 permohonan dengan kode RUP sama sebagai 3 paket',()=>{
 const c=context(),all=requests();
 Object.assign(c,{sheet_:n=>n,rows_:()=>all,publicUser_:u=>u,publicRequest_:r=>r,requestWithReport_:r=>r,listPokjaCapacity_:()=>[]});
 const d=c.bootstrapFast_({user_id:'u',role:'PPK'},{search:'',status:''});
 assert.equal(d.requests.length,3);assert.equal(d.dashboard.total,3);assert.equal(d.dashboard.counts.PROSES_INAPROC,3);
});
test('bootstrap reguler menghasilkan rekap sama tanpa menggabung berdasarkan RUP',()=>{
 const c=context(),all=requests();
 Object.assign(c,{sheet_:n=>n,rows_:()=>all,publicUser_:u=>u,publicRequest_:r=>r,requestWithReport_:r=>r,reportEligible_:()=>false,listPokjaCapacity_:()=>[],syncVersion_:()=>''});
 const d=c.bootstrap_({user_id:'u',role:'PPK'},{search:'',status:''});
 assert.equal(d.requests.length,3);assert.equal(d.dashboard.total,3);assert.equal(d.dashboard.counts.PROSES_INAPROC,3);
});
test('judul permohonan disimpan terpisah dari nama paket RUP, tanpa menimpa pagu atau dokumen',()=>{
 const c=context(),stored=[];
 Object.assign(c,{requireRole_:()=>{},lookupRup_:()=>({kodeRup:'65213822',namaPaket:'Nama RUP Asli',opd:'OPD A',pagu:3700000000,metode:'E-Purchasing',tahun:2026}),ensureRequestSchema_:()=>{},rows_:()=>[],sheet_:x=>x,requestIdForRup_:()=> 'P-65213822-04',createRequestFolder_:()=>({getId:()=> 'folder'}),appendObj_:(name,obj)=>{stored.push(obj)},audit_:()=>{}});
 const out=c.createRequest_({role:'PPK',user_id:'u',opd:'OPD A'},{kodeRup:'65213822',metodePengadaan:'E-Purchasing',initialPreparation:true,ppkNama:'Nama PPK',ppkEmail:'ppk@bogor.go.id',hpsAlokasi:300000000,judulPermohonan:'Judul Permohonan Khusus'});
 assert.equal(stored.length,1);assert.equal(stored[0].nama_paket,'Nama RUP Asli');assert.equal(out.nama_paket,'Nama RUP Asli');assert.equal(out.judul_permohonan,'Judul Permohonan Khusus');assert.equal(out.pagu,3700000000);assert.equal(stored[0].hps_alokasi,300000000);
 assert.throws(()=>c.createRequest_({role:'PPK',user_id:'u',opd:'OPD A'},{kodeRup:'65213822',initialPreparation:true,ppkNama:'Nama PPK',judulPermohonan:'abc'}),/Judul permohonan minimal/);
});
test('frontend PPK memiliki judul dan keterangan sesuai peran tanpa mengubah alur Pokja',()=>{
 assert.match(front,/id="newRequestTitle" maxlength="180"/);
 assert.match(front,/function requestTitle\(r\)/);
 assert.match(front,/const intro=pokja\?/);
 assert.match(front,/Menunggu penayangan Mini Kompetisi/);
 assert.match(front,/Menunggu dokumen hasil Negosiasi/);
 assert.match(front,/Pengingat PPK/);
 assert.match(front,/judulPermohonan,notes:/);
 assert.match(html,/selection\.js\?v=28\.(?:48|49|51)/);
 assert.match(sw,/selection\.js\?v=28\.(?:48|49|51)/);
 assert.match(sw,/shell-v28-(?:48|49|51)/);
});
