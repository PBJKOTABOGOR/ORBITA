(() => {
  'use strict';
  const API_URL = 'https://script.google.com/macros/s/AKfycbyMPm_W1ZfCSFLHDBzDv2Yj-Pqc2IaXzQKbluwMdRITqG2YX8tQ33EImWPl7ezXsuz8AQ/exec';
  const TOKEN_KEY = 'traxpbj_admin_token';
  const BOOT_KEY = 'traxpbj_bootstrap_cache_v24';
  const BOOT_TTL = 5 * 60 * 1000;
  let bootstrapPromise = null;

  const emit=(name,detail={})=>document.dispatchEvent(new CustomEvent(name,{detail}));
  async function parseResponse(response){
    const text = await response.text();
    let data;
    try { data = JSON.parse(text); }
    catch { throw new Error('Respons backend tidak dapat dibaca.'); }
    if (!response.ok || data?.ok === false) throw new Error(data?.error || `HTTP ${response.status}`);
    return data;
  }

  async function get(action, params = {}){
    const url = new URL(API_URL);
    url.searchParams.set('action', action);
    Object.entries(params).forEach(([key,value]) => {
      if (value !== undefined && value !== null && value !== '') url.searchParams.set(key, String(value));
    });
    const controller=new AbortController(); const timer=setTimeout(()=>controller.abort(),20000);
    try{
      const response = await fetch(url.toString(), { method:'GET', cache:'no-store', redirect:'follow', signal:controller.signal });
      return await parseResponse(response);
    } finally { clearTimeout(timer); }
  }

  async function post(action, payload = {}, options = {}){
    const body = { action, ...payload };
    const token = options.token === false ? '' : sessionStorage.getItem(TOKEN_KEY);
    if (token && !Object.prototype.hasOwnProperty.call(body,'token')) body.token = token;
    const timeoutMs = Math.max(5000, Number(options.timeoutMs || 90000));
    const controller=new AbortController(); const timer=setTimeout(()=>controller.abort(),timeoutMs);
    const shouldEmit = options.emit !== false;
    if(shouldEmit) emit('trax:api-start',{action});
    try{
      const response = await fetch(API_URL, {
        method:'POST', headers:{ 'Content-Type':'text/plain;charset=UTF-8' }, body:JSON.stringify(body),
        redirect:'follow', cache:'no-store', signal:controller.signal
      });
      const result=await parseResponse(response);
      if(!['login','logout','getKomitmenAkses','resetKomitmenAkses'].includes(action)) clearBootstrapCache();
      if(shouldEmit) emit('trax:api-success',{action,result});
      return result;
    } catch(error){
      const err = error?.name === 'AbortError'
        ? new Error('Proses ke Google terlalu lama dan koneksi dihentikan.')
        : error;
      if(shouldEmit) emit('trax:api-error',{action,error:err}); throw err;
    } finally { clearTimeout(timer); if(shouldEmit) emit('trax:api-end',{action}); }
  }

  async function login(password){
    const res = await post('login', { password }, { token:false });
    if (res?.token) sessionStorage.setItem(TOKEN_KEY, res.token);
    return res;
  }
  async function logout(){
    const token = sessionStorage.getItem(TOKEN_KEY);
    try { if (token) await post('logout', { token }, { token:false }); } catch (_) {}
    sessionStorage.removeItem(TOKEN_KEY);
  }
  function hasSession(){ return !!sessionStorage.getItem(TOKEN_KEY); }
  function clearSession(){ sessionStorage.removeItem(TOKEN_KEY); }

  function readBootstrapCache(maxAge=BOOT_TTL){
    try{
      const x=JSON.parse(localStorage.getItem(BOOT_KEY)||'null');
      if(!x?.data) return null;
      if(maxAge && Date.now()-Number(x.savedAt||0)>maxAge) return null;
      return x.data;
    }catch{return null;}
  }
  function writeBootstrapCache(data){
    try{localStorage.setItem(BOOT_KEY,JSON.stringify({savedAt:Date.now(),data}));}catch(_){ }
  }
  function clearBootstrapCache(){ try{localStorage.removeItem(BOOT_KEY)}catch(_){} bootstrapPromise=null; }

  async function bootstrap(force = false){
    if(!force){
      const cached=readBootstrapCache();
      if(cached) return cached;
    }
    if (force || !bootstrapPromise) {
      bootstrapPromise = get('bootstrap',force?{force:1}:{}).then(r => {
        const data=r.data||{}; writeBootstrapCache(data); return data;
      }).catch(err => { bootstrapPromise = null; throw err; });
    }
    return bootstrapPromise;
  }
  async function refreshBootstrap(){
    bootstrapPromise=null;
    const data=await bootstrap(true);
    return data;
  }

  function dataUrlToFile(dataUrl, name='file.jpg'){
    if (!dataUrl || !String(dataUrl).startsWith('data:')) return null;
    const [head, base64=''] = String(dataUrl).split(',',2);
    const mimeType = (head.match(/^data:([^;]+)/)||[])[1] || 'application/octet-stream';
    return { name, mimeType, base64 };
  }
  function fileToPayload(file,{maxBytes=0,onProgress}={}){
    return new Promise((resolve,reject) => {
      if(maxBytes && Number(file?.size||0) > maxBytes) return reject(new Error('Ukuran file melebihi batas upload.'));
      const reader = new FileReader();
      reader.onerror = () => reject(new Error('File tidak dapat dibaca.'));
      reader.onprogress = e => { if(e.lengthComputable && typeof onProgress==='function') onProgress(e.loaded/e.total*100); };
      reader.onload = () => {
        const dataUrl = String(reader.result || ''); const comma = dataUrl.indexOf(',');
        resolve({ name:file.name, mimeType:file.type || 'application/octet-stream', base64: comma >= 0 ? dataUrl.slice(comma+1) : dataUrl });
      };
      reader.readAsDataURL(file);
    });
  }
  function imageFileToPayload(file,{maxSide=1600,quality=.82}={}){
    if(!file?.type?.startsWith('image/')) return fileToPayload(file);
    return new Promise((resolve,reject)=>{
      const fr=new FileReader(); fr.onerror=()=>reject(new Error('Foto tidak dapat dibaca.'));
      fr.onload=()=>{ const img=new Image(); img.onerror=()=>reject(new Error('Foto tidak dapat dibaca.'));
        img.onload=()=>{ const scale=Math.min(1,maxSide/Math.max(img.naturalWidth||img.width,img.naturalHeight||img.height));
          const c=document.createElement('canvas'); c.width=Math.max(1,Math.round((img.naturalWidth||img.width)*scale)); c.height=Math.max(1,Math.round((img.naturalHeight||img.height)*scale));
          const ctx=c.getContext('2d',{alpha:false}); ctx.drawImage(img,0,0,c.width,c.height);
          c.toBlob(blob=>{if(!blob)return reject(new Error('Foto gagal diproses.')); const r=new FileReader(); r.onerror=reject; r.onload=()=>resolve({name:(file.name||'foto').replace(/\.[^.]+$/,'.jpg'),mimeType:'image/jpeg',base64:String(r.result).split(',')[1]||''}); r.readAsDataURL(blob);},'image/jpeg',quality);
        }; img.src=String(fr.result);
      }; fr.readAsDataURL(file);
    });
  }

  window.TRAXPBJ_API = {
    url:API_URL,get,post,login,logout,hasSession,clearSession,bootstrap,refreshBootstrap,
    readBootstrapCache,writeBootstrapCache,clearBootstrapCache,dataUrlToFile,fileToPayload,imageFileToPayload
  };
})();
