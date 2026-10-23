'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const front=fs.readFileSync(path.join(root,'assets/js/selection.js'),'utf8');
const backend=fs.readFileSync(path.join(root,'backend/Code-TRAXPBJ-Pemilihan.gs'),'utf8');
const html=fs.readFileSync(path.join(root,'profil-pbj/index.html'),'utf8');
const sw=fs.readFileSync(path.join(root,'sw.js'),'utf8');
const manifest=fs.readFileSync(path.join(root,'backend/appsscript.json'),'utf8');
function setup(){
 const files=[],mails=[],docs=[],audits=[];
 const req={request_id:'P-1234-01',kode_rup:'1234',nama_paket:'Belanja Peralatan',opd:'DINAS A',status:'DITUGASKAN_POKJA',assigned_pokja_id:'POKJA1',workflow_scheme:'KAJI_ULANG_2026',ppk_nama:'PPK A',ppk_email:'ppk@example.id',folder_id:'FOLDER1',updated_at:'2026-10-21'};
 const fakePdf={getSize:()=>100,getUrl:()=> 'https://drive.google.com/file/d/ABC/view',getName:()=> 'Surat Undangan.pdf',getId:()=> 'ABC',setName:()=>{},setTrashed:()=>{}};
 // Style chain mimics DocumentApp elements, including formatted tables and embedded favicon.
 const block={};const chain=new Proxy(block,{get(t,key){if(key==='getChild'||key==='asParagraph'||key==='appendParagraph'||key==='appendTable'||key==='getCell'||key==='appendText'||key==='appendInlineImage'||key==='editAsText'||key==='setMarginTop'||key==='setMarginBottom'||key==='setMarginLeft'||key==='setMarginRight'||key==='setBorderWidth'||key==='setBorderColor'||key==='setWidth'||key==='setHeight'||key==='setFontFamily'||key==='setFontSize'||key==='setForegroundColor'||key==='setBackgroundColor'||key==='setPaddingTop'||key==='setPaddingBottom'||key==='setPaddingLeft'||key==='setPaddingRight'||key==='setSpacingBefore'||key==='setSpacingAfter'||key==='setAlignment'||key==='setBold')return ()=>chain;return t[key]}});
 const context=vm.createContext({console,Date,JSON,Number,Math,String,Utilities:{base64Decode:v=>Buffer.from(v,'base64'),newBlob:()=>({}),formatDate:(date,tz,format)=>{const d=new Date(date),hh=String(d.getUTCHours()+7).padStart(2,'0');return format.includes('yyyy-MM-dd')?'2026-10-22T'+hh+':00':'22 Oktober 2026, '+hh+':00'}},MimeType:{PDF:'application/pdf'},DocumentApp:{HorizontalAlignment:{CENTER:'CENTER',RIGHT:'RIGHT'},create:()=>({getId:()=> 'TEMP',getBody:()=>chain,saveAndClose:()=>{}})},DriveApp:{getFileById:()=>({getAs:()=>({}),setTrashed:()=>{}}),getFolderById:()=>({createFile:()=>{files.push(fakePdf);return fakePdf}})}});
 vm.runInContext(backend,context);
 context.getRequestAuthorized_=()=>req;context.requireRole_=(u,roles)=>{if(!roles.includes(u.role))throw Error('Dilarang')};context.sheet_=name=>name;
 context.rows_=name=>name==='PBJ_DOKUMEN'?docs:[];context.currentDocs_=()=>docs.filter(x=>x.is_current);
 context.findRow_=(sh,key,id)=>sh==='PBJ_POKJA'?{obj:{nama:'Pokja 1'}}:null;
 context.appendObj_=(sh,data)=>{if(sh!=='PBJ_DOKUMEN')throw Error('Wrong sheet');docs.push(data)};
 context.id_=()=> 'DOC1';context.prettyDocumentFileName_=()=> 'Surat Undangan.pdf';context.audit_=(u,act,r,p)=>audits.push(act);context.touchRequest_=()=>{};context.bestEffortMail_=(...args)=>{mails.push(args);return true};context.getRequest_=()=>req;context.publicRequest_=r=>({request_id:r.request_id});
 const payload={requestId:req.request_id,start:'2026-10-22T09:00',end:'2026-10-22T10:00',method:'OFFLINE',place:'Ruang Rapat Bagian PBJ',provided:'KAK, HPS, Rancangan Kontrak',attendees:'PPK atau Tim Teknis',attachment:''};
 return {c:context,req,files,mails,docs,audits,payload};
}
test('Undangan hanya untuk paket yang telah didisposisi Pokja, divalidasi server',()=>{
 const o=setup(),u={role:'POKJA'};o.req.status='DRAFT';assert.throws(()=>o.c.sendKajiInvitation_(u,o.payload),/Undangan hanya/);o.req.status='DITUGASKAN_POKJA';assert.throws(()=>o.c.sendKajiInvitation_(u,{...o.payload,end:'2026-10-22T08:00'}),/Jam selesai/);assert.throws(()=>o.c.sendKajiInvitation_({role:'PPK'},o.payload),/Dilarang/);
 assert.equal(o.files.length,0);assert.equal(o.mails.length,0);
});
test('Undangan menghasilkan PDF arsip dan antrean email tanpa merubah tahapan',()=>{
 const o=setup(),result=o.c.sendKajiInvitation_({role:'POKJA',user_id:'USR1'},o.payload);
 assert.equal(o.req.status,'DITUGASKAN_POKJA');assert.equal(o.files.length,1);assert.equal(o.docs.length,1);
 assert.equal(o.docs[0].doc_type,'SURAT_UNDANGAN_KAJI_ULANG');assert.equal(o.docs[0].drive_url,'https://drive.google.com/file/d/ABC/view');
 assert.equal(o.mails.length,1);assert.equal(o.mails[0][1],'ppk@example.id');assert.match(o.mails[0][3],/Yang Harus Disiapkan: KAK/);assert.match(o.mails[0][3],/Surat undangan \(PDF\)/);
 assert.ok(o.audits.includes('KIRIM_UNDANGAN_KAJI'));assert.equal(result.email_queued,true);
});
test('Judul kompetisi dapat diedit dan tetap masuk ke payload dan disimpan di backend',()=>{
 assert.equal((front.match(/id="mcTitle"[^>]+readonly/g)||[]).length,0);
 assert.equal((front.match(/id="mcTitle" maxlength="180"/g)||[]).length,2);
 assert.match(front,/c\.title=String\(get\('mcTitle'\)\?\.value/);
 assert.match(backend,/competition_title:String\(data\.competitionTitle/);
 assert.match(backend,/competitionTitle:c\.title|function requestFormPatch_/);
});
test('Surat penyampaian muncul di PPK saat Handover dan Riwayat Paket',()=>{
 assert.match(front,/\(currentDoc\(d,'SURAT_PENYAMPAIAN_HASIL'\)\|\|isKajiRequest\(r\)\)/);
 assert.match(front,/sel-history-documents/);
 assert.match(front,/SURAT_UNDANGAN_KAJI_ULANG:'Surat Undangan Kaji Ulang'/);
 assert.match(front,/const invitation=kajiInvitationHtml\(d\)/);
 assert.match(html,/selection\.js\?v=28\.(?:29|30|31|32|33|36|37)/);assert.match(sw,/orbita-pbj-shell-v28-(?:29|30|31|32|33|36|37)/);
 assert.ok(JSON.parse(manifest).oauthScopes.includes('https://www.googleapis.com/auth/documents'));
});
