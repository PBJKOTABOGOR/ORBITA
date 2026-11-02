const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
test('reads share one request within a revision but never reuse pre-write results',async()=>{
 const pending=[],store=new Map([['traxpbj_selection_token','abc']]);
 const c=vm.createContext({window:{TRAXPBJ_SELECTION_CONFIG:{apiUrl:'https://example.invalid/api'}},sessionStorage:{getItem:k=>store.get(k),setItem:(k,v)=>store.set(k,v),removeItem:k=>store.delete(k)},AbortController,setTimeout,clearTimeout,fetch:()=>new Promise(r=>pending.push(r)),document:{dispatchEvent(){}}});
 vm.runInContext(fs.readFileSync(path.join(__dirname,'../assets/js/selection-api.js'),'utf8'),c);const api=c.window.TRAXPBJ_SELECTION_API;
 const first=api.call('requestDetail',{requestId:'A'});assert.equal(first,api.call('requestDetail',{requestId:'A'}));
 const write=api.call('submitRequest',{requestId:'A'});pending[1]({text:async()=>JSON.stringify({ok:true})});await write;
 const fresh=api.call('requestDetail',{requestId:'A'});assert.notEqual(fresh,first);assert.equal(pending.length,3);
 pending[2]({text:async()=>JSON.stringify({ok:true,data:'new'})});assert.equal((await fresh).data,'new');
 pending[0]({text:async()=>JSON.stringify({ok:true,data:'old'})});assert.equal((await first).data,'old');
});
