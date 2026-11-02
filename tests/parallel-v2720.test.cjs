const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const root=path.join(__dirname,'..');
const apiSource=fs.readFileSync(path.join(root,'assets/js/selection-api.js'),'utf8');
const uiSource=fs.readFileSync(path.join(root,'assets/js/selection.js'),'utf8');
const backend=fs.readFileSync(path.join(root,'backend/Code-TRAXPBJ-Pemilihan.gs'),'utf8');

function apiContext(){
  const store=new Map([['traxpbj_selection_token','abc']]);let seq=0;const xhr=[];
  class XHR{
    constructor(){this.upload={};this.headers={};this.status=0;xhr.push(this)}
    open(method,url){this.method=method;this.url=url}
    setRequestHeader(k,v){this.headers[k]=v}
    send(body){this.body=body;this.sent=true}
    finish(id){this.upload.onprogress?.({lengthComputable:true,loaded:this.body.size||8,total:this.body.size||8});this.status=200;this.responseText=JSON.stringify({id});this.onload?.()}
  }
  const c=vm.createContext({window:{TRAXPBJ_SELECTION_CONFIG:{apiUrl:'https://example.invalid/api'}},sessionStorage:{getItem:k=>store.get(k),setItem:(k,v)=>store.set(k,v),removeItem:k=>store.delete(k)},AbortController,setTimeout,clearTimeout,XMLHttpRequest:XHR,FileReader:class{constructor(){throw new Error('parallel direct upload must not use FileReader')}},document:{dispatchEvent(){}},CustomEvent:class{},fetch:async(_url,opts)=>{const b=JSON.parse(opts.body);if(b.action==='beginDirectUpload'){seq++;return{text:async()=>JSON.stringify({ok:true,data:{sessionUrl:`https://upload.example/${seq}`,ticket:`t${seq}`}})}};throw Error('unexpected '+b.action)}});
  vm.runInContext(apiSource,c);return{c,xhr};
}

test('two documents from the same package transfer at the same time',async()=>{
  const {c,xhr}=apiContext(),api=c.window.TRAXPBJ_SELECTION_API;
  const a={name:'KAK.pdf',type:'application/pdf',size:8},b={name:'HPS.pdf',type:'application/pdf',size:8};
  const p1=api.directUpload(a,{requestId:'R1',docType:'KAK'}),p2=api.directUpload(b,{requestId:'R1',docType:'HPS'});
  await new Promise(r=>setImmediate(r));
  assert.equal(xhr.length,2);assert.equal(xhr.every(x=>x.sent),true);assert.equal(api.isUploading('R1'),true);
  xhr[0].finish('drive-kak');xhr[1].finish('drive-hps');
  const [r1,r2]=await Promise.all([p1,p2]);assert.equal(r1.drive.id,'drive-kak');assert.equal(r2.drive.id,'drive-hps');assert.equal(api.isUploading('R1'),false);
});

test('frontend uses per-document upload state instead of locking the whole package',()=>{
  assert.match(uiSource,/const docUploadStates=new Map\(\)/);
  assert.match(uiSource,/docUploading\(requestId,docType\)/);
  assert.doesNotMatch(uiSource,/if\(!f\|\|writing\(\)\|\|uploading\(d\.request\.request_id\)\)return/);
  assert.match(uiSource,/Masih ada dokumen yang sedang diunggah\. Tunggu sampai selesai sebelum melanjutkan\./);
});

test('successful uploads update package history immediately without waiting for polling',()=>{
  assert.match(backend,/obj\._audit=audit_\(user,'UPLOAD_DOCUMENT'/);
  assert.match(uiSource,/addLocalAudit\(audit\)/);
  assert.match(backend,/function audit_\([^)]*\)\{const obj=/);
});

test('send and destructive actions require a clear confirmation',()=>{
  assert.match(uiSource,/Kirim permohonan ke UKPBJ\?/);
  assert.match(uiSource,/Periksa kembali dokumen sebelum dikirim ke UKPBJ\./);
  assert.match(uiSource,/Ya, kirim/);
  assert.match(uiSource,/Tolak permohonan ini\?/);
  assert.match(uiSource,/Hapus \$\{d\.label\} dari daftar\?/);
  assert.match(uiSource,/Ganti password akun ini\?/);
});

test('realtime pulse yields completely during uploads so it cannot compete with Drive transfer',()=>{
  assert.match(uiSource,/\|\|uploading\(\)\|\|anyDocUploading\(\)\|\|userIsInteracting\(\)\)return/);
  assert.match(uiSource,/function canBackgroundRender\(\).*userIsInteracting\(\)/);
});

test('v27.20 upgrade is present and keeps the direct Drive upload path',()=>{
  assert.match(backend,/function upgradePemilihanV2720\(\)/);
  assert.match(backend,/workflow_version','27\.20'/);
  assert.match(backend,/DIRECT_RESUMABLE/);
});
