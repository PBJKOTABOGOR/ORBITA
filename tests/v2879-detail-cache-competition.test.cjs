const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const src=fs.readFileSync(path.join(__dirname,'../assets/js/selection.js'),'utf8');
const start=src.indexOf('  function detailMatchesSummary(detail,summary){');
const end=src.indexOf('  function withPokja(d){', start);
assert.ok(start>0&&end>start,'Cache validation block exists');
const block=src.slice(start,end);
function scenario(summary,stored){
 const storage=new Map();
 const cache=new Map([[`account:${summary.request_id}`,stored]]);
 const timestamps=new Map();
 storage.set('saved:'+summary.request_id,JSON.stringify(stored));
 const deps=[cache,timestamps,()=>stored,(id)=>id===summary.request_id?summary:undefined,(id)=>'account:'+id,(id)=>'saved:'+id,{removeItem(k){storage.delete(k)}}];
 const load=new Function('detailCache','detailCacheAt','storedDetail','requestSummary','detailKey','detailStorageKey','sessionStorage',block+'\nreturn {cachedDetail,detailMatchesSummary};');
 return {...load(...deps),cache,storage};
}
const base={request_id:'P-68122081-01',updated_at:'28/10/2026 16:56:52',inaproc_version:'',selection_process:'MINI_KOMPETISI',mini_stage:'TAYANG',status:'SIAP_PROSES_INAPROC',current_round:2};
test('manual Sheet correction CONSTRUCTION -> NON_CONSTRUCTION invalidates stale detail even if updated_at same',()=>{
 const summary={...base,competition_type:'NON_CONSTRUCTION'};
 const older={request:{...base,competition_type:'CONSTRUCTION'}};
 const x=scenario(summary,older);
 assert.equal(x.cachedDetail(summary.request_id),null);
 assert.equal(x.cache.size,0);
 assert.equal(x.storage.size,0);
});
test('unchanged competition reuses cache, no redundant request',()=>{
 const summary={...base,competition_type:'NON_CONSTRUCTION'};
 const cached={request:{...summary},docs:[]};
 const x=scenario(summary,cached);
 assert.equal(x.cachedDetail(summary.request_id),cached);
 assert.equal(x.cache.size,1);
});
test('different mini_stage invalidates cache even when updated_at unchanged',()=>{
 const summary={...base,competition_type:'NON_CONSTRUCTION',mini_stage:'HANDOVER'};
 const cached={request:{...base,competition_type:'NON_CONSTRUCTION'}};
 const x=scenario(summary,cached);
 assert.equal(x.cachedDetail(summary.request_id),null);
});
test('source uses cache validator for prefetch and busts browser asset revision',()=>{
 assert.match(src,/if\(cached&&summary&&detailMatchesSummary\(cached,summary\)\)return cached;/);
 const html=fs.readFileSync(path.join(__dirname,'../profil-pbj/index.html'),'utf8');
 const sw=fs.readFileSync(path.join(__dirname,'../sw.js'),'utf8');
 assert.match(html,/selection\.js\?v=28\.79/);
 assert.match(sw,/selection\.js\?v=28\.79/);
});
