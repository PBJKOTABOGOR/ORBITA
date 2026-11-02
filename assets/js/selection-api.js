(() => {
  'use strict';
  const KEY_TOKEN='traxpbj_selection_token';
  const cfg=window.TRAXPBJ_SELECTION_CONFIG||{};
  const clean=u=>String(u||'').trim();
  const getUrl=()=>clean(cfg.apiUrl||'');
  const setUrl=()=>getUrl();
  const token=()=>sessionStorage.getItem(KEY_TOKEN)||'';
  const setToken=t=>t?sessionStorage.setItem(KEY_TOKEN,t):sessionStorage.removeItem(KEY_TOKEN);

  const readActions=new Set(['health','me','bootstrap','bootstrapFast','syncPulse','dashboard','listRequests','requestDetail','listRupOptions','listProductCategories','listConstructionCategories','getCategoryReference','lookupRup','probeDirectUpload','adminList','adminAudit','adminDbHealth','adminDbFindRequest','listNotifications','pokjaSkpReport','exportPokjaSkpPdf']);
  const nonMutatingActions=new Set([...readActions,'beginDirectUpload','readNotification','sendBroadcast']);
  let pendingWrites=0,activeUploads=0,revision=0;
  const uploadsByRequest=new Map();
  let changeChannel=null;
  try{if(typeof BroadcastChannel!=='undefined'){changeChannel=new BroadcastChannel('traxpbj-selection-v2713');changeChannel.onmessage=e=>document.dispatchEvent(new CustomEvent('trax:selection-remote-change',{detail:e.data||{}}));}}catch(_){}
  function announceChange(action){const detail={action,at:Date.now()};try{document.dispatchEvent(new CustomEvent('trax:selection-local-change',{detail}));}catch(_){}try{changeChannel?.postMessage(detail);}catch(_){}}
  function markUpload(requestId,delta){const key=String(requestId||'');activeUploads=Math.max(0,activeUploads+delta);if(!key)return;const n=Math.max(0,(uploadsByRequest.get(key)||0)+delta);if(n)uploadsByRequest.set(key,n);else uploadsByRequest.delete(key);}
  const readsInFlight=new Map();
  function call(action,payload={},opts={}){
    if(!readActions.has(action))return request(action,payload,opts);
    const key=JSON.stringify([action,payload,token(),revision]);if(readsInFlight.has(key))return readsInFlight.get(key);
    const pending=request(action,payload,opts).finally(()=>readsInFlight.delete(key));readsInFlight.set(key,pending);return pending;
  }
  async function request(action,payload={},opts={}){
    const url=getUrl();
    if(!url)throw new Error('Layanan Pemilihan belum tersedia.');
    const body={action,...payload};
    if(opts.auth!==false)body.token=token();
    const ctl=new AbortController();const tm=setTimeout(()=>ctl.abort(),opts.timeoutMs||30000);
    const writing=!nonMutatingActions.has(action);if(writing){pendingWrites++;revision++;}
    try{
      const res=await fetch(url,{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify(body),signal:ctl.signal,cache:'no-store',redirect:'follow'});
      const text=await res.text();let json;try{json=JSON.parse(text)}catch{throw new Error('Layanan sedang bermasalah. Coba lagi.');}
      if(opts.auth!==false&&body.token!==token())throw new Error('Akun sudah berganti. Buka kembali halaman yang dituju.');
      if(!json?.ok){const message=json?.error||'Permintaan gagal.';if(opts.auth!==false&&body.token===token()&&/sesi|akun tidak aktif/i.test(message))document.dispatchEvent(new CustomEvent('trax:session-expired'));throw new Error(message);}
      if(writing)announceChange(action);
      return json;
    }catch(err){if(err?.name==='AbortError')throw new Error('Koneksi ke layanan terlalu lama. Coba lagi.');throw err;}finally{clearTimeout(tm);if(writing){pendingWrites--;revision++;}}
  }
  async function login(username,password){const r=await call('login',{username,password,fast:true},{auth:false,timeoutMs:75000});if(r.token){setToken(r.token);setTimeout(()=>call('recordLoginMeta',{}, {timeoutMs:15000}).catch(()=>{}),0);}return r;}
  async function logout(){try{if(token())await call('logout',{});}catch(_){}setToken('');}
  function hasSession(){return !!token();}

  // Legacy fallback, dipertahankan agar versi backend lama tetap dapat dipakai saat deployment belum diperbarui.
  async function filePayload(file,maxBytes=10*1024*1024){if(!file)throw new Error('File belum dipilih.');if(file.size>maxBytes)throw new Error('Ukuran file maksimal 10 MB.');return new Promise((resolve,reject)=>{const r=new FileReader();r.onerror=()=>reject(new Error('File tidak dapat dibaca.'));r.onload=()=>{const s=String(r.result||''),i=s.indexOf(',');resolve({name:file.name,mimeType:file.type||'application/octet-stream',base64:i>=0?s.slice(i+1):s});};r.readAsDataURL(file);});}

  const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
  function uploadErr(message,code,status=0){const err=new Error(message);err.code=code;err.status=status;return err;}

  function putDirect(sessionUrl,file,onProgress,{start=0}={}){
    return new Promise((resolve,reject)=>{
      const xhr=new XMLHttpRequest();
      xhr.open('PUT',sessionUrl,true);
      xhr.timeout=120000;
      xhr.setRequestHeader('Content-Type',file.type||'application/octet-stream');
      const offset=Math.max(0,Number(start)||0),body=offset>0&&typeof file.slice==='function'?file.slice(offset):file;
      if(offset>0)xhr.setRequestHeader('Content-Range',`bytes ${offset}-${file.size-1}/${file.size}`);
      let lastPct=0,lastProgressAt=0;
      xhr.upload.onprogress=e=>{if(e.lengthComputable&&typeof onProgress==='function'){const loaded=Math.min(file.size,offset+e.loaded),pct=Math.max(1,Math.min(99,Math.round(loaded/file.size*100))),now=Date.now();if(pct>=99||pct-lastPct>=2||now-lastProgressAt>=120){lastPct=pct;lastProgressAt=now;onProgress(pct);}}};
      xhr.onerror=()=>reject(uploadErr('Koneksi upload terputus.','UPLOAD_NETWORK'));
      xhr.ontimeout=()=>reject(uploadErr('Upload terlalu lama.','UPLOAD_TIMEOUT'));
      xhr.onabort=()=>reject(uploadErr('Upload dibatalkan.','UPLOAD_ABORT'));
      xhr.onload=()=>{
        if(xhr.status===308){const range=String(xhr.getResponseHeader?.('Range')||''),m=range.match(/bytes=0-(\d+)/i),next=m?Number(m[1])+1:offset;const err=uploadErr('Upload belum lengkap.','UPLOAD_INCOMPLETE',308);err.offset=next;return reject(err);}
        if(xhr.status<200||xhr.status>=300)return reject(uploadErr(`Google Drive menolak upload (${xhr.status}).`,'UPLOAD_HTTP',xhr.status));
        let data={};try{data=JSON.parse(xhr.responseText||'{}')}catch(_){ }
        if(!data?.id)return reject(uploadErr('Google Drive belum mengembalikan ID file.','UPLOAD_NO_ID',xhr.status));
        if(typeof onProgress==='function')onProgress(100);
        resolve(data);
      };
      xhr.send(body);
    });
  }

  async function probeUpload(sessionUrl,ticket,requestId,purpose){
    let last;
    for(let i=0;i<2;i++){
      try{return await call('probeDirectUpload',{sessionUrl,ticket,requestId,purpose},{timeoutMs:20000});}
      catch(err){last=err;if(/aksi tidak dikenal/i.test(err?.message||''))throw err;if(i===0)await wait(250);}
    }
    throw last;
  }

  async function beginUpload(file,purpose,requestId,docType){
    try{return await call('beginDirectUpload',{purpose,requestId,docType,file:{name:file.name,mimeType:file.type||'application/octet-stream',sizeBytes:file.size}},{timeoutMs:20000});}
    catch(err){if(/aksi tidak dikenal/i.test(err?.message||''))err.code='DIRECT_UPLOAD_UNSUPPORTED';throw err;}
  }

  async function directUpload(file,{purpose='DOCUMENT',requestId='',docType='',maxBytes=10*1024*1024,onProgress,onState}={}){
    if(!file)throw new Error('File belum dipilih.');
    if(Number(file.size||0)<=0)throw new Error('File kosong.');
    if(maxBytes&&file.size>maxBytes)throw new Error(`Ukuran file maksimal ${Math.round(maxBytes/1024/1024)} MB.`);
    markUpload(requestId,1);
    try{
      onState?.('starting',{attempt:0,offset:0});
      let begin=await beginUpload(file,purpose,requestId,docType),sessionUrl=begin?.data?.sessionUrl,ticket=begin?.data?.ticket,offset=0;
      if(!sessionUrl||!ticket)throw new Error('Sesi upload Google Drive tidak tersedia.');
      for(let attempt=0;attempt<3;attempt++){
        try{
          onState?.(attempt||offset?'resuming':'uploading',{attempt,offset});
          const drive=await putDirect(sessionUrl,file,onProgress,{start:offset});
          return {ticket,drive,begin:begin.data,recovered:false};
        }catch(err){
          if(err?.code==='UPLOAD_ABORT')throw err;
          onState?.('checking',{attempt,offset});
          let probe;
          try{probe=await probeUpload(sessionUrl,ticket,requestId,purpose);}catch(probeErr){
            if(/aksi tidak dikenal/i.test(probeErr?.message||''))throw err;
            if(attempt>=2)throw err;
            await wait(350*(attempt+1));
            continue;
          }
          const status=probe?.data||{};
          if(status.complete&&status.drive?.id){if(typeof onProgress==='function')onProgress(100);return {ticket,drive:status.drive,begin:begin.data,recovered:true};}
          if(status.expired){
            if(attempt>=2)throw uploadErr('Sesi upload berakhir. Silakan upload ulang.','UPLOAD_EXPIRED');
            onState?.('restarting',{attempt,offset:0});
            begin=await beginUpload(file,purpose,requestId,docType);sessionUrl=begin?.data?.sessionUrl;ticket=begin?.data?.ticket;offset=0;
            if(!sessionUrl||!ticket)throw new Error('Sesi upload Google Drive tidak tersedia.');
          }else{
            offset=Math.max(0,Math.min(Math.max(0,file.size-1),Number(status.offset)||Number(err?.offset)||0));
          }
          if(attempt<2)await wait(250*(attempt+1));
          else throw err;
        }
      }
      throw new Error('Upload belum selesai.');
    }finally{markUpload(requestId,-1);}
  }

  window.TRAXPBJ_SELECTION_API={getUrl,setUrl,token,setToken,call,login,logout,hasSession,filePayload,directUpload,isWriting:()=>pendingWrites>0,isUploading:requestId=>requestId?!!uploadsByRequest.get(String(requestId)):activeUploads>0,writeVersion:()=>revision};
})();
