const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.resolve(__dirname,'..');
const js=fs.readFileSync(path.join(root,'assets/js/selection.js'),'utf8');
const gs=fs.readFileSync(path.join(root,'backend/Code-TRAXPBJ-Pemilihan.gs'),'utf8');
const css=fs.readFileSync(path.join(root,'assets/css/selection.css'),'utf8');
const html=fs.readFileSync(path.join(root,'profil-pbj/index.html'),'utf8');
function context(){const c=vm.createContext({console,Date,JSON,Math,Set,Map});vm.runInContext(gs,c);return c;}
const user={role:'PPK',user_id:'usr',opd:'Dinas Kesehatan'};
function stubCreate(c){
 const saved=[];
 c.requireRole_=()=>{};c.lookupRup_=()=>({kodeRup:'123',namaPaket:'Paket Contoh',opd:'Dinas Kesehatan',jenis:'Barang',cara:'Penyedia',metode:'E-Purchasing',pagu:350000000,sumberDana:'APBD',waktuPemilihan:'Oktober 2026',tahun:2026});
 c.ensureRequestSchema_=()=>{};c.sheet_=()=>({});c.rows_=()=>[];c.requestIdForRup_=()=> 'P-123-01';c.createRequestFolder_=()=>({getId:()=> 'drive-folder'});c.appendObj_=(_sh,obj)=>saved.push(obj);c.audit_=()=>{};
 return saved;
}
test('process selection and negotiation modal keep two independent paths',()=>{
 assert.match(js,/function createProcessHtml\(/);assert.match(js,/data-select-process="NEGOSIASI"/);assert.match(js,/data-select-process="MINI_KOMPETISI"/);
 assert.match(js,/function openNegotiationCreate\(/);assert.match(js,/function openMiniCreate\(/);
 const neg=js.slice(js.indexOf('function openNegotiationCreate('),js.indexOf('function uploadLabelProgress('));
 assert.match(neg,/id="newMethod"/);assert.match(neg,/id="newRupSearch"/);assert.match(neg,/id="newNote"/);
 assert.match(neg,/selectionProcess:'NEGOSIASI'/);
 assert.match(js,/selectionProcess:'MINI_KOMPETISI',competitionType/);
 assert.match(js,/requestSelectionProcess\(summary\)==='MINI_KOMPETISI'/);
 assert.match(js,/path==='permohonan\/proses'/);
});
test('request card shows saved process and keeps both RUP and pipeline',()=>{
 assert.match(js,/sel-process-label/);assert.match(js,/requestSelectionProcess\(r\)==='NEGOSIASI'\?'Negosiasi':'Mini Kompetisi'/);assert.match(js,/Mini Kompetisi/);
 assert.match(js,/data-request-id/);assert.match(js,/requestPipeline\(r\)/);assert.match(css,/sel-process-label/);
 assert.match(html,/selection\.js\?v=27\.98/);
});
test('legacy rows are recognized from previously saved competition type',()=>{
 const c=context();
 assert.equal(c.requestSelectionProcess_({competition_type:'NON_CONSTRUCTION'}),'MINI_KOMPETISI');
 assert.equal(c.requestSelectionProcess_({competition_type:'CONSTRUCTION'}),'MINI_KOMPETISI');
 assert.equal(c.requestSelectionProcess_({competition_type:''}),'NEGOSIASI');
 assert.equal(c.requestSelectionProcess_({competition_type:'NON_CONSTRUCTION',selection_process:'NEGOSIASI'}),'NEGOSIASI');
 assert.equal(c.requestedSelectionProcess_({competitionType:'CONSTRUCTION'}),'MINI_KOMPETISI');
 assert.equal(c.requestedSelectionProcess_({}),'NEGOSIASI');
});
test('backend creates Negosiasi as simple draft, preserves Mini Kompetisi attributes',()=>{
 const c=context(),saved=stubCreate(c);
 const neg=c.createRequest_(user,{kodeRup:'123',metodePengadaan:'E-Purchasing',selectionProcess:'NEGOSIASI',notes:'Mohon ditindaklanjuti'});
 assert.equal(neg.selection_process,'NEGOSIASI');assert.equal(neg.competition_type,'');assert.equal(neg.notes,'Mohon ditindaklanjuti');
 assert.equal(saved[0].competition_type,undefined);
 const mini=c.createRequest_(user,{kodeRup:'123',selectionProcess:'MINI_KOMPETISI',competitionType:'CONSTRUCTION',scheduleStartDate:'2026-10-20',constructionDetails:[{name:'Konstruksi',hps:1,qty:1,unit:'meter'}]});
 assert.equal(mini.selection_process,'MINI_KOMPETISI');assert.equal(mini.competition_type,'CONSTRUCTION');assert.match(mini.construction_details_json,/Konstruksi/);
 assert.throws(()=>c.createRequest_(user,{kodeRup:'123',selectionProcess:'MINI_KOMPETISI'}),/Jenis kompetisi belum dipilih/);
});
test('negotiation can submit without competition schedule but mini still requires it',()=>{
 const c=context();let item={request_id:'P-123-01',status:'DRAFT',selection_process:'NEGOSIASI',competition_type:''};let docs=0;
 c.requireRole_=()=>{};c.getRequestAuthorized_=()=>item;c.assertDocsComplete_=()=>{docs++};c.updateRequest_=(_id,patch)=>{item={...item,...patch}};c.audit_=()=>{};c.getRequest_=()=>item;
 const result=c.submitRequest_(user,'P-123-01');assert.equal(result.status,'MENUNGGU_DISPOSISI');assert.equal(docs,1);
 item={request_id:'P-123-02',status:'DRAFT',selection_process:'MINI_KOMPETISI',competition_type:'NON_CONSTRUCTION'};
 assert.throws(()=>c.submitRequest_(user,'P-123-02'),/Jadwal kompetisi belum lengkap/);assert.equal(docs,1);
});
