'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.join(__dirname,'..');
const source=fs.readFileSync(path.join(root,'assets/js/selection.js'),'utf8');
const backend=fs.readFileSync(path.join(root,'backend/Code-TRAXPBJ-Pemilihan.gs'),'utf8');
const selectionStart=source.indexOf('  const NEGO_FAST_UPLOAD_MAX=');
const selectionEnd=source.indexOf('  function bindNegoActions(){',selectionStart);
const functionText=source.slice(selectionStart,selectionEnd);
const toRecord=v=>JSON.parse(JSON.stringify(v));
function harness(){
  const calls=[];
  const api={
    filePayload:async(f,maxBytes)=>{calls.push({type:'read',size:f.size,maxBytes});return {name:f.name,mimeType:'application/pdf',base64:'mock'};},
    call:async(action,payload)=>{calls.push({type:'api',action,purpose:payload.purpose,requestId:payload.requestId});return {data:{doc_id:'doc-1'}};},
    directUpload:async(f,opts)=>{calls.push({type:'direct',size:f.size,purpose:opts.purpose});opts.onState?.('starting');opts.onProgress?.(57);return {ticket:'t',drive:{id:'drive-1'}};}
  };
  const context=vm.createContext({API:()=>api,finalizeUploadCall:async(action,payload)=>{calls.push({type:'finalize',action,...payload});return {data:{doc_id:'doc-1'}};}});
  vm.runInContext(functionText,context);
  return {calls,upload:(file,onProgress,onState)=>context.uploadNegoDocumentFast(file,'P-1','NEGO_BA_HASIL_REVIU',onProgress,onState)};
}
test('PDF BA sampai 2 MB memakai satu request backend, bukan pembukaan sesi + PUT + finalisasi',async()=>{
  const h=harness(), states=[];
  await h.upload({name:'BA.pdf',size:100*1024},undefined,s=>states.push(s));
  assert.deepEqual(toRecord(h.calls.map(x=>x.type)),['read','api']);
  assert.equal(h.calls[1].action,'uploadDocument');
  assert.equal(h.calls[1].purpose,'NEGO_DOCUMENT');
  assert.deepEqual(toRecord(states),['reading','sending']);
});
test('PDF 2 MB tepat termasuk fast-path; file di atas 2 MB tetap direct binary upload',async()=>{
  const small=harness();await small.upload({name:'BA.pdf',size:2*1024*1024});
  assert.deepEqual(toRecord(small.calls.map(x=>x.type)),['read','api']);
  const large=harness(),progress=[],states=[];
  await large.upload({name:'BA.pdf',size:2*1024*1024+1},p=>progress.push(p),s=>states.push(s));
  assert.deepEqual(toRecord(large.calls.map(x=>x.type)),['direct','finalize']);
  assert.deepEqual(toRecord(progress),[57]);
  assert.deepEqual(toRecord(states),['starting','saving']);
});
test('Uploader tidak menghalangi BA kedua hanya karena request BA pertama masih berlangsung',()=>{
  const start=source.indexOf('  function bindNegoActions(){');
  const end=source.indexOf('  async function negoAction(',start);
  const bind=source.slice(start,end);
  assert.match(bind,/if\(!file\|\|!requestId\|\|docUploading\(requestId,type\)\|\|state\.busy\)return/);
  assert.doesNotMatch(bind,/\|\|writing\(\)\)return/);
  assert.match(bind,/Mengirim & menyimpan…/);
  assert.match(bind,/flash\(apiErr\(err\),'error'\)/);
});
test('Validasi backend tetap memeriksa tipe dokumen, role, dan status sebelum menerima BA',()=>{
  assert.match(backend,/function uploadDocument_\(user, payload\)/);
  assert.match(backend,/requireRole_\(user,special\?\['POKJA','ADMIN'\]/);
  assert.match(backend,/if\(nego&&!negoDocAllowed_\(user,req,docType\)\)/);
  assert.match(backend,/Dokumen Negosiasi harus PDF maksimal 10 MB/);
});
