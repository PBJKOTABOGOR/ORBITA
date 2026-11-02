const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.join(__dirname,'..');
const ui=fs.readFileSync(path.join(root,'assets/js/selection.js'),'utf8');
const css=fs.readFileSync(path.join(root,'assets/css/selection.css'),'utf8');
const backend=fs.readFileSync(path.join(root,'backend/Code-TRAXPBJ-Pemilihan.gs'),'utf8');
const sw=fs.readFileSync(path.join(root,'sw.js'),'utf8');

function uiContext(){
 const dom={addEventListener(){},hidden:false,activeElement:null,querySelector:()=>null,querySelectorAll:()=>[]};
 const api={hasSession:()=>false,getUrl:()=>'/test',isWriting:()=>false,writeVersion:()=>0,call:async()=>({data:{}})};
 const c=vm.createContext({console,document:dom,window:{TRAXPBJ_SELECTION_API:api},Intl,Date,JSON,Set,sessionStorage:{setItem(){},getItem:()=>null,removeItem(){}},setTimeout:()=>1,clearTimeout(){},setInterval:()=>1,clearInterval(){},CSS:{escape:s=>s}});
 let s=ui.replace(/\}\)\(\);\s*$/,`window.testHooks={state,auditHtml,groupAudit};})();`);vm.runInContext(s,c);return c.window.testHooks;
}
function backendContext(){const c=vm.createContext({console,Date,JSON,Math});vm.runInContext(backend,c);return c;}

test('reapplication history keeps the rejected request in its own group and starts the new group with reapplication wording',()=>{
 const h=uiContext();h.state.me={role:'PPK',user_id:'U1'};
 const oldReq={request_id:'P-64761997-01',status:'DITOLAK_KEPALA',previous_request_id:''};
 const newReq={request_id:'P-64761997-02',status:'DRAFT',previous_request_id:'P-64761997-01'};
 const html=h.auditHtml({request:newReq,audit:[{audit_id:'n1',action:'CREATE_REQUEST',created_at:'2026-10-02T09:18:00Z',role:'PPK',detail_json:'{}'}],previousHistory:[{request:oldReq,audit:[{audit_id:'o1',action:'CREATE_REQUEST',created_at:'2026-10-02T09:00:00Z',role:'PPK',detail_json:'{}'},{audit_id:'o2',action:'REJECT_REQUEST',created_at:'2026-10-02T09:10:00Z',role:'KEPALA_UKPBJ',detail_json:JSON.stringify({reason:'Dokumen belum sesuai'})}]}]});
 assert.match(html,/P-64761997-01/);assert.match(html,/PENGAJUAN SEBELUMNYA/);assert.match(html,/PENGAJUAN ULANG · SEDANG BERJALAN/);assert.match(html,/Pengajuan ulang paket dibuat/);assert.ok(html.indexOf('P-64761997-02')<html.indexOf('P-64761997-01'));assert.match(html,/sel-history-previous collapsed/);assert.match(html,/Lihat pengajuan sebelumnya \(1\)/);assert.match(html,/sel-audit-rejected/);assert.match(html,/sel-history-request-status rejected/);assert.match(html,/Dokumen belum sesuai/);
});

test('backend builds the linked request chain oldest first and keeps it scoped to the same PPK',()=>{
 const c=backendContext();c.publicRequest_=x=>x;c.visibleDetail_=(_u,d)=>d;
 const req={request_id:'R3',previous_request_id:'R2',ppk_user_id:'U1'};
 const requests=[{request_id:'R1',previous_request_id:'',ppk_user_id:'U1',status:'DITOLAK_KEPALA'},{request_id:'R2',previous_request_id:'R1',ppk_user_id:'U1',status:'DITOLAK_KEPALA'}];
 const audits=[{request_id:'R1',created_at:'2026-01-01',action:'REJECT_REQUEST'},{request_id:'R2',created_at:'2026-01-02',action:'REJECT_REQUEST'}];
 const out=c.previousRequestHistory_({role:'PPK',user_id:'U1'},req,requests,audits);assert.equal(Array.from(out,x=>x.request.request_id).join(','),'R1,R2');
 const hidden=c.previousRequestHistory_({role:'PPK',user_id:'OTHER'},req,requests,audits);assert.equal(hidden.length,0);
});

test('v27.22 cache, upgrade and rejected timeline styling are present',()=>{
 assert.match(backend,/function upgradePemilihanV2722\(\)/);assert.match(backend,/workflow_version','27\.22'/);assert.match(backend,/function upgradePemilihanV2724\(\)/);assert.match(sw,/orbita-pbj-shell-v27-(?:34-back-team-selection|38-hard-home-back|49-docs-hub-surat|50-docs-unified-five-lines|54-docs-hover-surat-preview|55-surat-action-only|56-edukasi-doc|57-constellation-bg|58-constellation-interactive|59-atomic-room)/);assert.match(sw,/selection\.js\?v=27\.27/);assert.match(css,/sel-audit-rejected:before/);assert.match(css,/sel-history-request\.rejected/);
});

test('v27.24 builds readable Drive names from the document label and package name',()=>{const c=backendContext();assert.equal(c.prettyDocumentFileName_('Surat Permohonan Pemilihan','Belanja Paket Meeting',1,'KOSONG.pdf'),'Surat Permohonan Pemilihan - Belanja Paket Meeting.pdf');assert.equal(c.prettyDocumentFileName_('HPS','Belanja Paket Meeting',2,'asal.PDF'),'HPS - Belanja Paket Meeting - Revisi 2.pdf');assert.match(backend,/migrateCurrentDocumentNamesV2724_/);});
