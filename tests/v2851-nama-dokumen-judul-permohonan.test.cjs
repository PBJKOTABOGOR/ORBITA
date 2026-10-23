const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'..');
const code=fs.readFileSync(path.join(root,'backend/Code-TRAXPBJ-Pemilihan.gs'),'utf8');
const front=fs.readFileSync(path.join(root,'assets/js/selection.js'),'utf8');
function context(){const sandbox=vm.createContext({console,Date,Number,Math,JSON,Utilities:{},SpreadsheetApp:{}});vm.runInContext(code,sandbox);return sandbox}
test('nama HPS, revisi, surat, dan BA memakai judul permohonan terpisah untuk RUP sama',()=>{
 const c=context();const a={nama_paket:'Pengadaan Hotmix Dan Coldmix Paket 1',judul_permohonan:'PAKET 1'};
 const b={nama_paket:'Pengadaan Hotmix Dan Coldmix Paket 1',judul_permohonan:'PAKET 2'};
 assert.equal(c.prettyDocumentFileName_('HPS',c.requestDocumentTitle_(a),1,'hps.pdf'),'HPS - PAKET 1.pdf');
 assert.equal(c.prettyDocumentFileName_('HPS',c.requestDocumentTitle_(b),2,'hps.pdf'),'HPS - PAKET 2 - Revisi 2.pdf');
 assert.equal(c.prettyDocumentFileName_('Surat Undangan Kaji Ulang',c.requestDocumentTitle_(b),1,'.pdf'),'Surat Undangan Kaji Ulang - PAKET 2.pdf');
 assert.equal(c.requestDocumentTitle_({nama_paket:'RUP TANPA JUDUL'}),'RUP TANPA JUDUL');
 assert.equal(b.nama_paket,a.nama_paket);
});
test('semua jalur upload membuat nama pakai Judul Permohonan',()=>{
 const paths=['cfg.label','Surat Perintah Pokja','Surat Undangan Kaji Ulang'];
 for(const item of paths)assert.match(code,new RegExp(`prettyDocumentFileName_\\([^\\n]+requestDocumentTitle_\\(req\\)`));
 assert.doesNotMatch(code,/prettyDocumentFileName_\([^\n]*req\.nama_paket/);
 assert.match(code,/function perbaruiNamaDokumenSesuaiJudulV2851\(\)/);
 assert.match(code,/Math\.min\(40,last-start\+1\)/);
});
test('detail membaca nama baru untuk dokumen lama tanpa mengubah Drive saat load',()=>{
 const c=context();const req={request_id:'P-65213822-05',nama_paket:'Pengadaan Hotmix Dan Coldmix Paket 1',judul_permohonan:'PAKET 2',status:'DRAFT',updated_at:'2026-10-22T03:00:00Z'};
 const docs=[{request_id:'P-65213822-05',doc_type:'HPS',doc_label:'HPS',version:1,file_name:'HPS - Pengadaan Hotmix Dan Coldmix Paket 1.pdf',is_current:true,drive_file_id:'id1',drive_url:'https://drive.google.com/file/d/id1'}];
 Object.assign(c,{
  getRequestAuthorized_:()=>req,reportEligible_:()=>false,requestWithReport_:r=>r,publicRequest_:r=>r,
  sheet_:s=>s,rows_:name=>String(name)==='PBJ_DOKUMEN'?docs:[],activeDocConfig_:()=>[],
  visibleDetail_:(_,d)=>d,hash_:x=>x,CacheService:{getScriptCache:()=>({get:()=>null,put:()=>{}})}
 });
 const result=c.requestDetail_({user_id:'x',role:'ADMIN'},req.request_id);
 assert.equal(result.docs[0].file_name,'HPS - PAKET 2.pdf');
 assert.equal(result.docs[0].drive_file_id,'id1');
 assert.equal(result.docs[0].drive_url,'https://drive.google.com/file/d/id1');
 assert.equal(result.request.nama_paket,req.nama_paket);
 assert.equal(docs[0].file_name,'HPS - Pengadaan Hotmix Dan Coldmix Paket 1.pdf');
});
test('riwayat upload mengambil nama dari dokumen dan cache JS ikut naik',()=>{
 assert.match(front,/fileLabel=displayDoc\?\.file_name\|\|q\.fileName\|\|''/);
 assert.match(fs.readFileSync(path.join(root,'profil-pbj/index.html'),'utf8'),/selection\.js\?v=28\.51/);
 assert.match(fs.readFileSync(path.join(root,'sw.js'),'utf8'),/selection\.js\?v=28\.51/);
});
