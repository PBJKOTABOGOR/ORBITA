/* ORBITA PBJ — snapshot master INAPROC, per-shard lazy load. No GraphQL token or Apps Script reads. */
(() => {
  'use strict';
  const src=document.currentScript?.src||new URL('../assets/js/category-field-store.js',location.href).href;
  const dir=new URL('../data/inaproc-master/',src);
  // Update this token when publishing a new INAPROC snapshot.
  const version='20261018T135549';
  const inFlight=new Map();
  const resolvedShards=new Map();
  let categoryRequest=null;
  const url=name=>new URL(name+'?v='+version,dir).href;
  async function json(name){const r=await fetch(url(name),{cache:'force-cache',credentials:'same-origin'});if(!r.ok)throw new Error('Master kategori '+name+': HTTP '+r.status);return r.json();}
  function categoryMaster(){return categoryRequest||(categoryRequest=json('categories.json').catch(e=>{categoryRequest=null;throw e}));}
  function shardKey(id){const h=String(id||'').trim().toLowerCase().slice(0,2);return /^[0-9a-f]{2}$/.test(h)?h[0]+String(parseInt(h[1],16)%4):'';}
  function get(id){const key=shardKey(id);if(!key)return Promise.resolve(null);if(!inFlight.has(key))inFlight.set(key,json(key+'.json').then(data=>{resolvedShards.set(key,data);return data}).catch(e=>{inFlight.delete(key);throw e}));return inFlight.get(key).then(map=>map[String(id).toLowerCase()]||null);}
  const isLoaded=id=>resolvedShards.has(shardKey(id));
  window.ORBITA_INAPROC_FIELDS=Object.freeze({version,categoryMaster,get,isLoaded});
})();
