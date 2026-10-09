const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const apiSource=fs.readFileSync(path.join(__dirname,'../assets/js/selection-api.js'),'utf8');
const uiSource=fs.readFileSync(path.join(__dirname,'../assets/js/selection.js'),'utf8');
const backend=fs.readFileSync(path.join(__dirname,'../backend/Code-TRAXPBJ-Pemilihan.gs'),'utf8');

function contextWith({xhrFactory,fetchHandler}){
  const store=new Map([['traxpbj_selection_token','abc']]);
  const c=vm.createContext({
    window:{TRAXPBJ_SELECTION_CONFIG:{apiUrl:'https://example.invalid/api'}},
    sessionStorage:{getItem:k=>store.get(k),setItem:(k,v)=>store.set(k,v),removeItem:k=>store.delete(k)},
    AbortController,setTimeout,clearTimeout,XMLHttpRequest:xhrFactory,
    FileReader:class{constructor(){throw new Error('direct upload must not use FileReader')}},
    fetch:fetchHandler,document:{dispatchEvent(){}},CustomEvent:class{}
  });
  vm.runInContext(apiSource,c);return c;
}

test('Kode RUP form supports typing/search as well as opening the dropdown list',()=>{
  assert.match(uiSource,/id="newRupSearch" type="search"/);
  assert.match(uiSource,/Cari Kode RUP atau nama paket/);
  assert.match(uiSource,/matchingItems/);
  assert.match(uiSource,/id="rupToggle"/);
});

test('failed document upload becomes Upload ulang instead of staying at 99 percent',()=>{
  assert.match(uiSource,/text:'Upload ulang'/);
  assert.match(uiSource,/Upload belum selesai\. Pilih Upload ulang untuk mencoba lagi\./);
  assert.match(uiSource,/inp\.value=''/);
});

test('backend can probe a signed Drive resumable session and recover a completed file',()=>{
  assert.match(backend,/action === 'probeDirectUpload'/);
  assert.match(backend,/sessionHash:hash_\(sessionUrl\)/);
  assert.match(backend,/function probeDirectUpload_/);
  assert.match(backend,/findDirectTempFile_/);
  assert.match(backend,/Content-Range':'bytes \*\//);
});

test('network error after bytes are sent is recovered when Drive already has the file',async()=>{
  let xhrCount=0,fetchCount=0;
  class XHR{
    constructor(){this.upload={};this.status=0;xhrCount++}
    open(method,url){this.method=method;this.url=url}
    setRequestHeader(){}
    send(){setTimeout(()=>{this.upload.onprogress?.({lengthComputable:true,loaded:8,total:8});this.onerror?.()},0)}
  }
  const c=contextWith({xhrFactory:XHR,fetchHandler:async(_url,opts)=>{
    fetchCount++;const body=JSON.parse(opts.body);
    if(body.action==='beginDirectUpload')return{text:async()=>JSON.stringify({ok:true,data:{sessionUrl:'https://upload.example/s',ticket:'t'}})};
    if(body.action==='probeDirectUpload')return{text:async()=>JSON.stringify({ok:true,data:{complete:true,offset:8,drive:{id:'drive-recovered'}}})};
    throw Error('unexpected '+body.action);
  }});
  const file={name:'KAK.pdf',type:'application/pdf',size:8};
  const out=await c.window.TRAXPBJ_SELECTION_API.directUpload(file,{requestId:'R1',docType:'KAK'});
  assert.equal(out.drive.id,'drive-recovered');assert.equal(out.recovered,true);assert.equal(xhrCount,1);assert.equal(fetchCount,2);
});

test('partial upload resumes from the confirmed byte instead of restarting the whole file',async()=>{
  const sent=[];let n=0;
  class XHR{
    constructor(){this.upload={};this.status=0;this.headers={};sent.push(this)}
    open(method,url){this.method=method;this.url=url}
    setRequestHeader(k,v){this.headers[k]=v}
    send(body){this.body=body;const turn=n++;setTimeout(()=>{if(turn===0){this.upload.onprogress?.({lengthComputable:true,loaded:4,total:8});this.onerror?.();}else{this.upload.onprogress?.({lengthComputable:true,loaded:4,total:4});this.status=200;this.responseText=JSON.stringify({id:'drive-resumed'});this.onload?.();}},0)}
  }
  const c=contextWith({xhrFactory:XHR,fetchHandler:async(_url,opts)=>{const body=JSON.parse(opts.body);if(body.action==='beginDirectUpload')return{text:async()=>JSON.stringify({ok:true,data:{sessionUrl:'https://upload.example/s',ticket:'t'}})};if(body.action==='probeDirectUpload')return{text:async()=>JSON.stringify({ok:true,data:{complete:false,offset:4,code:308}})};throw Error('unexpected')}});
  const tail={tail:true};const file={name:'HPS.pdf',type:'application/pdf',size:8,slice:start=>{assert.equal(start,4);return tail;}};
  const out=await c.window.TRAXPBJ_SELECTION_API.directUpload(file,{requestId:'R1',docType:'HPS'});
  assert.equal(out.drive.id,'drive-resumed');assert.equal(sent.length,2);assert.equal(sent[1].body,tail);assert.equal(sent[1].headers['Content-Range'],'bytes 4-7/8');
});
