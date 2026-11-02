const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');

test('direct upload sends the original file to Drive session without FileReader/base64',async()=>{
  const store=new Map([['traxpbj_selection_token','abc']]);
  const sent=[];let fetchCount=0;
  class XHR{
    constructor(){this.upload={};this.status=0;this.responseText='';sent.push(this)}
    open(method,url){this.method=method;this.url=url}
    setRequestHeader(k,v){(this.headers||(this.headers={}))[k]=v}
    send(body){this.body=body;setTimeout(()=>{this.upload.onprogress?.({lengthComputable:true,loaded:4,total:8});this.status=200;this.responseText=JSON.stringify({id:'drive-1',name:'TMP'});this.onload?.()},0)}
  }
  const c=vm.createContext({
    window:{TRAXPBJ_SELECTION_CONFIG:{apiUrl:'https://example.invalid/api'}},
    sessionStorage:{getItem:k=>store.get(k),setItem:(k,v)=>store.set(k,v),removeItem:k=>store.delete(k)},
    AbortController,setTimeout,clearTimeout,XMLHttpRequest:XHR,
    FileReader:class{constructor(){throw new Error('FileReader must not be used by direct upload')}},
    fetch:async(_url,opts)=>{fetchCount++;const body=JSON.parse(opts.body);assert.equal(body.action,'beginDirectUpload');assert.equal(body.file.sizeBytes,8);return{text:async()=>JSON.stringify({ok:true,data:{sessionUrl:'https://upload.example/session',ticket:'ticket-1'}})}},
    document:{dispatchEvent(){}},CustomEvent:class{}
  });
  vm.runInContext(fs.readFileSync(path.join(__dirname,'../assets/js/selection-api.js'),'utf8'),c);
  const file={name:'KAK.pdf',type:'application/pdf',size:8};const progress=[];
  const result=await c.window.TRAXPBJ_SELECTION_API.directUpload(file,{requestId:'REQ-1',docType:'KAK',onProgress:p=>progress.push(p)});
  assert.equal(fetchCount,1);assert.equal(sent.length,1);assert.equal(sent[0].method,'PUT');assert.equal(sent[0].body,file);assert.equal(result.drive.id,'drive-1');assert.deepEqual(progress,[50,100]);
});
