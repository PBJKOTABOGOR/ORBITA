'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.join(__dirname,'..');
const gs=fs.readFileSync(path.join(root,'backend/Code-TRAXPBJ-Pemilihan.gs'),'utf8');
const fe=fs.readFileSync(path.join(root,'assets/js/selection.js'),'utf8');
const html=fs.readFileSync(path.join(root,'profil-pbj/index.html'),'utf8');
const sw=fs.readFileSync(path.join(root,'sw.js'),'utf8');
const prev={notes:'Catatan lama',request_id:'P-62584465-02',kode_rup:'62584465',status:'DITOLAK_KEPALA',ppk_user_id:'ppk1',ppk_nama:'PPK Asli',ppk_email:'ppk.asli@contoh.go.id',hps_alokasi:201000000,metode_pengadaan:'E-Purchasing'};
const rup={kodeRup:'62584465',namaPaket:'Belanja Jasa Tenaga Keamanan',opd:'DINAS PU',jenis:'Jasa Lainnya',cara:'Penyedia',metode:'E-Purchasing',pagu:603500000,tahun:2026};
const user={user_id:'ppk1',role:'PPK',opd:'DINAS PU'};
function setup(allocated=0){
 const c=vm.createContext({Date,JSON,Math,Number,String,Utilities:{},console});vm.runInContext(gs,c);
 const rows={PBJ_PERMOHONAN:[prev,...(allocated?[{kode_rup:prev.kode_rup,request_id:'P-other',status:'PROSES_INAPROC',hps_alokasi:allocated}]:[])],PBJ_AUDIT_LOG:[]};
 let written=null;
 c.requireRole_=()=>{};c.lookupRup_=(id)=>{if(String(id)!==prev.kode_rup)throw new Error('RUP beda');return {...rup}};
 c.ensureRequestSchema_=()=>{};c.sheet_=(x)=>x;c.rows_=(x)=>rows[x]||[];
 c.requestIdForRup_=()=> 'P-62584465-03';c.createRequestFolder_=()=>({getId:()=> 'folder'});
 c.appendObj_=(sh,obj)=>{written=obj;rows.PBJ_PERMOHONAN.push(obj)};
 c.audit_=(u,a,id)=>rows.PBJ_AUDIT_LOG.push({action:a,request_id:id});c.touchRequest_=()=>{};
 const create=(extra={})=>c.createRequest_(user,{initialPreparation:true,selectionProcess:'PERSIAPAN',kodeRup:prev.kode_rup,metodePengadaan:'E-Purchasing',previousRequestId:prev.request_id,ppkNama:'DIPALSUKAN',ppkEmail:'palsu@contoh.go.id',hpsAlokasi:1,notes:'Catatan baru',...extra});
 return{create,get:()=>written,rows};
}
test('pengajuan ulang menjaga identitas sumber tetapi Total HPS bisa diperbarui',()=>{
 const s=setup();const out=s.create({hpsAlokasi:250000000});assert.equal(out.request_id,'P-62584465-03');assert.equal(s.get().ppk_nama,prev.ppk_nama);assert.equal(s.get().ppk_email,prev.ppk_email);assert.equal(s.get().hps_alokasi,250000000);assert.equal(s.get().kode_rup,prev.kode_rup);assert.equal(s.get().previous_request_id,prev.request_id);assert.equal(s.get().notes,'Catatan lama');
 assert.equal(s.rows.PBJ_AUDIT_LOG.filter(x=>x.action==='REAPPLY_REQUEST').length,1);
});
test('pengajuan ulang menolak ganti RUP, metode atau pemakaian ulang sumber',()=>{
 assert.throws(()=>setup().create({kodeRup:'99999999'}),/RUP beda/);
 assert.throws(()=>setup().create({metodePengadaan:'Tender'}),/belum tersedia/);
 const s=setup();s.create();assert.throws(()=>s.create(),/sudah pernah dibuat/);
});
test('Total HPS baru dibatasi oleh sisa pagu, bukan HPS pengajuan asal',()=>{
 const s=setup(450000000);assert.throws(()=>s.create({hpsAlokasi:160000000}),/Total HPS melebihi sisa pagu RUP/);
 assert.equal(s.rows.PBJ_PERMOHONAN.length,2,'Gagal validasi sebelum menambah paket');
 assert.equal(s.create({hpsAlokasi:153500000}).hps_alokasi,153500000);
 assert.equal(setup(100000000).create({hpsAlokasi:300000000}).hps_alokasi,300000000);
});
test('Total HPS baru harus positif dan dalam rupiah penuh',()=>{
 for(const hps of [0,-1,1.5,NaN,Infinity,'']){
  const s=setup();assert.throws(()=>s.create({hpsAlokasi:hps}),/Total HPS harus lebih dari nol/);assert.equal(s.rows.PBJ_PERMOHONAN.length,1);
 }
});
test('form pengajuan ulang hanya membebaskan HPS; metode, RUP, PPK dan catatan dikunci',()=>{
 const code=fe.slice(fe.indexOf('  function openNegotiationCreate('),fe.indexOf('  async function openDraftEditor('));
 assert.ok(code.includes("state.detail?.request?.request_id===reapplyFromId"));
 assert.ok(code.includes('method.disabled=true'));
 assert.ok(code.includes('el.readOnly=true'));
 assert.match(code,/\['newPpkNama',reapplySource\.ppk_nama\].*\['newPpkEmail',reapplySource\.ppk_email\].*\['newNote',reapplySource\.notes\]/);
 assert.ok(code.includes("const hps=$('#newHpsAlokasi');if(hps)hps.value=currencyDisplay(reapplySource.hps_alokasi);"));
 assert.doesNotMatch(code,/'newHpsAlokasi',currencyDisplay\(reapplySource\.hps_alokasi\)/);
 assert.ok(code.includes('searchInput.disabled=true'));
 assert.ok(code.includes('toggle.disabled=true'));
 assert.ok(code.includes('reapplySource.notes'));assert.ok(code.includes('Maksimal ${fmtRp(max)} sesuai sisa pagu RUP.'));
 assert.ok(code.includes('rupItems.find(x=>String(x.kodeRup)===initialRup)'));
 assert.ok(code.includes('Sisa pagu RUP'));
 assert.match(html,/selection\.js\?v=28\.(?:28|29|30|31)/);assert.match(html,/selection\.css\?v=28\.(?:28|29|30|31)/);
 assert.match(sw,/orbita-pbj-shell-v28-(?:28|29|30|31)/);
});
