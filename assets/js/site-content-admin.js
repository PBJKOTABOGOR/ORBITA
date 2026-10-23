(() => {
  'use strict';

  const $=(s,c=document)=>c.querySelector(s);
  const API=window.TRAXPBJ_API;
  const esc=v=>String(v??'').replace(/[&<>'"]/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':'&quot;'}[ch]));
  const safeJSON=v=>{try{return JSON.parse(v)}catch{return null}};
  const toast=msg=>{const t=$('#adminToast');if(!t)return;t.textContent=msg;t.classList.add('show');clearTimeout(toast.t);toast.t=setTimeout(()=>t.classList.remove('show'),3200)};
  const setBusy=(el,busy,label)=>{if(!el)return;if(busy){el.dataset.oldText=el.textContent;el.disabled=true;el.textContent=label||'Menyimpan...'}else{el.disabled=false;el.textContent=el.dataset.oldText||el.textContent}};
  const download=(name,data)=>{const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),800)};
  const wait=ms=>new Promise(r=>setTimeout(r,ms));

  const normalizeDocCategory=raw=>{const value=String(raw||'').trim(),low=value.toLowerCase();if(/brief/.test(low))return 'Briefing Internal';if(/rapat|meeting/.test(low))return 'Rapat Lainnya';if(/pendamping|konsult|asist|konsolidasi|advokasi/.test(low)||!value)return 'Pendampingan & Konsultasi';return value;};

  let state={documentation:[],team:[]};
  let docFiles=[];
  let teamFiles=[];
  let loaded=false;

  function mapDocs(rows=[]){
    return rows.map(r=>{
      const media=Array.isArray(r.media)?r.media:(r.foto||[]).map(x=>({...x,type:'image',imageUrl:x.url}));
      return {
        id:r.id,date:r.tanggal||'',title:r.judul||'',location:r.lokasi||'',category:normalizeDocCategory(r.kategori),description:r.deskripsi||'',
        photo:r.cover||media?.[0]?.imageUrl||media?.[0]?.url||'',photos:r.foto||[],media,instagram:Array.isArray(r.instagram)?r.instagram:String(r.instagram||r.instagram_urls||'').split(/[\n,]+/).map(x=>x.trim()).filter(Boolean)
      };
    });
  }
  function mapTeam(rows=[]){return rows.map(r=>({id:r.id,name:r.nama||'',role:r.jabatan||'',group:r.kelompok||'',photo:r.foto||'',fileId:r.fileId||''}))}
  function dateLabel(v){if(!v)return 'Tanpa tanggal';try{return new Intl.DateTimeFormat('id-ID',{day:'2-digit',month:'short',year:'numeric'}).format(new Date(v+'T00:00:00'))}catch{return v}}

  function renderDocs(){
    const h=$('#documentationAdminList');if(!h)return;
    h.innerHTML=state.documentation.length?state.documentation.map(x=>{
      const count=x.media?.length||0;
      const videos=(x.media||[]).filter(m=>m.type==='video').length; const ig=(x.instagram||[]).length;
      return `<article class="portal-admin-item"><div class="portal-item-thumb">${x.photo?`<img src="${x.photo}" alt="">`:'DOC'}</div><div><small>${esc(x.category||'Pendampingan & Konsultasi')} · ${esc(dateLabel(x.date))}</small><b>${esc(x.title||'Tanpa judul')}</b><span>${esc(x.location||'')} · ${count} media${videos?` · ${videos} video`:''}${ig?` · ${ig} Instagram`:''}</span></div><div class="portal-item-actions"><button type="button" data-edit-documentation="${esc(x.id)}">Ubah</button><button class="danger-lite" type="button" data-delete-documentation="${esc(x.id)}">Hapus</button></div></article>`;
    }).join(''):'<div class="portal-admin-empty">Belum ada dokumentasi.</div>';
  }

  function renderDocCategoryOptions(){
    const select=$('#documentationCategory');if(!select)return;
    const rows=['Briefing Internal','Pendampingan & Konsultasi','Rapat Lainnya'];
    const current=normalizeDocCategory(select.value);
    select.innerHTML=rows.map(c=>`<option value="${esc(c)}">${esc(c)}</option>`).join('');
    select.value=rows.includes(current)?current:'Pendampingan & Konsultasi';
  }

  function renderTeam(){
    const h=$('#teamAdminList');if(!h)return;
    h.innerHTML=state.team.length?state.team.map(x=>`<article class="portal-admin-item"><div class="portal-item-thumb portrait">${x.photo?`<img src="${x.photo}" alt="">`:'PBJ'}</div><div><small>${esc(x.group||'PEGAWAI PBJ')}</small><b>${esc(x.name||'Tanpa nama')}</b><span>${esc(x.role||'')}</span></div><div class="portal-item-actions"><button type="button" data-edit-team="${esc(x.id)}">Ubah</button><button class="danger-lite" type="button" data-delete-team="${esc(x.id)}">Hapus</button></div></article>`).join(''):'<div class="portal-admin-empty">Belum ada profil pegawai.</div>';
  }

  function renderAll(){renderDocs();renderDocCategoryOptions();renderTeam()}

  function resetDoc(){
    ['#documentationId','#documentationDate','#documentationTitle','#documentationLocation','#documentationDescription','#documentationInstagram'].forEach(id=>{const e=$(id);if(e)e.value=''});
    if($('#documentationCategory'))$('#documentationCategory').value='Pendampingan & Konsultasi';
    if($('#documentationPhoto'))$('#documentationPhoto').value='';
    docFiles=[];
    const p=$('#documentationPhotoPreview');if(p)p.innerHTML='<span>Belum ada foto / video</span>';
  }

  function resetTeam(){
    ['#teamId','#teamName','#teamRole','#teamGroup'].forEach(id=>{const e=$(id);if(e)e.value=''});
    if($('#teamPhoto'))$('#teamPhoto').value='';
    teamFiles=[];
    const p=$('#teamPhotoPreview');if(p)p.innerHTML='<span>Belum ada foto</span>';
  }

  function docFileKind(file){const type=String(file?.type||'').toLowerCase(),name=String(file?.name||'').toLowerCase();return type.startsWith('video/')||/\.(mp4|webm|mov)$/i.test(name)?'video':'image'}
  function validDocFile(file){const type=String(file?.type||'').toLowerCase(),name=String(file?.name||'').toLowerCase();return type.startsWith('image/')||type.startsWith('video/')||/\.(jpe?g|png|webp|gif|mp4|webm|mov)$/i.test(name)}
  function videoMime(file){const type=String(file?.type||'');if(type)return type;const name=String(file?.name||'').toLowerCase();if(name.endsWith('.webm'))return 'video/webm';if(name.endsWith('.mov'))return 'video/quicktime';return 'video/mp4';}
  function objectUrl(file){try{return URL.createObjectURL(file)}catch{return ''}}
  function renderPendingDocFiles(){
    const host=$('#documentationPhotoPreview');if(!host)return;
    if(!docFiles.length){host.innerHTML='<span>Belum ada foto / video</span>';return;}
    host.innerHTML=`<div class="doc-upload-preview-grid">${docFiles.map((file,i)=>{
      const kind=docFileKind(file); const url=objectUrl(file);
      return `<article><div class="doc-upload-thumb">${kind==='video'?`<video src="${url}" muted preload="metadata"></video><span>VIDEO</span>`:`<img src="${url}" alt=""><span>FOTO</span>`}</div><b>${esc(file.name)}</b><small>${(file.size/1024/1024).toFixed(1)} MB</small></article>`;
    }).join('')}</div><div class="doc-upload-summary">${docFiles.length} file dipilih · ${(docFiles.reduce((s,f)=>s+f.size,0)/1024/1024).toFixed(1)} MB</div>`;
  }

  $('#documentationPhoto')?.addEventListener('change',e=>{
    const files=[...(e.target.files||[])];
    const invalid=files.filter(f=>!validDocFile(f));
    const oversizedVideo=files.find(f=>docFileKind(f)==='video'&&f.size>20*1024*1024);
    if(invalid.length){toast('Dokumentasi hanya menerima foto, MP4, WebM, atau MOV.');e.target.value='';docFiles=[];renderPendingDocFiles();return;}
    if(oversizedVideo){toast(`Video ${oversizedVideo.name} lebih dari 20 MB.`);e.target.value='';docFiles=[];renderPendingDocFiles();return;}
    docFiles=files;
    renderPendingDocFiles();
  });

  $('#teamPhoto')?.addEventListener('change',async e=>{
    const files=[...(e.target.files||[])];teamFiles=[];if(!files.length)return;
    const ui=window.TRAX_ADMIN_PROCESS;
    try{
      ui?.show('Menyiapkan foto pegawai',`0 / ${files.length}`,0);
      for(let i=0;i<files.length;i++){
        ui?.progress((i/files.length)*100,`${i+1} / ${files.length} · ${files[i].name}`);
        teamFiles.push(await API.imageFileToPayload(files[i],{maxSide:1200,quality:.8}));
      }
      $('#teamPhotoPreview').innerHTML=`<img src="data:${teamFiles[0].mimeType};base64,${teamFiles[0].base64}" alt="Preview"><span>${files.length} foto dipilih</span>`;
    }catch{toast('Foto tidak dapat dibaca.')}finally{ui?.hide()}
  });

  function uploadKey(docId,file,index){
    return [docId,file.name,file.size,file.lastModified,index].join(':').replace(/\s+/g,'_').slice(0,240);
  }

  async function prepareDocPayload(file,ui,fileIndex,total){
    const kind=docFileKind(file);
    if(kind==='image'){
      ui?.progress(Math.min(88,8+(fileIndex/Math.max(1,total))*72),`${fileIndex+1} / ${total} · menyiapkan ${file.name}`);
      return API.imageFileToPayload(file,{maxSide:1800,quality:.8});
    }
    ui?.progress(Math.min(88,8+(fileIndex/Math.max(1,total))*72),`${fileIndex+1} / ${total} · membaca ${file.name}`);
    const payload=await API.fileToPayload(file,{maxBytes:20*1024*1024});
    payload.mimeType=videoMime(file);
    return payload;
  }

  async function uploadOneWithRetry(docId,file,index,total,isCover,ui){
    const key=uploadKey(docId,file,index);
    let lastError=null;
    for(let attempt=1;attempt<=3;attempt++){
      try{
        const payload=await prepareDocPayload(file,ui,index,total);
        ui?.progress(Math.min(96,12+((index+.55)/Math.max(1,total))*80),`${index+1} / ${total} · upload${attempt>1?` ulang ${attempt}`:''} ${file.name}`);
        return await API.post('uploadDokumentasiMedia',{
          id:docId,file:payload,isCover,uploadKey:key,caption:file.name
        },{timeoutMs:docFileKind(file)==='video'?210000:120000,emit:false});
      }catch(err){
        lastError=err;
        // Jika browser timeout, Apps Script bisa saja tetap menyelesaikan upload.
        // Cek server dulu memakai uploadKey sebelum mengulang agar tidak duplikat.
        if(/terlalu lama|dihentikan|abort/i.test(String(err?.message||''))){
          await wait(1800*attempt);
          try{
            const check=await API.get('dokumentasi',{id:docId});
            const found=(check?.data?.media||[]).find(m=>m.uploadKey===key);
            if(found)return check;
          }catch(_){}
        }
        if(attempt<3) await wait(1200*attempt);
      }
    }
    throw lastError||new Error('Upload gagal.');
  }

  $('#documentationForm')?.addEventListener('submit',async e=>{
    e.preventDefault();
    const btn=e.submitter;setBusy(btn,true,'Menyimpan...');
    const ui=window.TRAX_ADMIN_PROCESS;
    try{
      ui?.show('Menyimpan kegiatan','Menyiapkan metadata',3);
      const payload={data:{
        id:$('#documentationId').value||'',tanggal:$('#documentationDate').value,judul:$('#documentationTitle').value.trim(),
        lokasi:$('#documentationLocation').value.trim(),kategori:$('#documentationCategory').value.trim()||'Pendampingan & Konsultasi',
        deskripsi:$('#documentationDescription').value.trim(),instagramUrls:$('#documentationInstagram')?.value.trim()||'',instagram_urls:$('#documentationInstagram')?.value.trim()||'',instagram:$('#documentationInstagram')?.value.trim()||'',tampil:true
      }};
      const saved=await API.post('saveDokumentasi',payload,{timeoutMs:45000,emit:false});
      const docId=saved?.data?.id||saved?.data?.id_kegiatan||payload.data.id;
      if(!docId)throw new Error('ID kegiatan tidak diterima dari backend.');

      const total=docFiles.length; const failures=[];
      if(total){
        const firstImageIndex=Math.max(0,docFiles.findIndex(f=>docFileKind(f)==='image'));
        for(let i=0;i<total;i++){
          try{
            await uploadOneWithRetry(docId,docFiles[i],i,total,i===firstImageIndex,ui);
          }catch(err){
            console.error('Upload dokumentasi gagal:',docFiles[i].name,err);
            failures.push(`${docFiles[i].name}: ${err.message||'gagal'}`);
          }
        }
      }
      ui?.progress(98,'Menyegarkan galeri');
      await refresh();
      ui?.progress(100,'Selesai');
      const okCount=total-failures.length;
      resetDoc();
      if(failures.length){
        toast(`${okCount}/${total} media tersimpan. ${failures.length} file gagal; bisa diupload ulang tanpa menggandakan file yang sudah masuk.`);
      }else{
        toast(total?`${total} media tersimpan di Google Drive.`:'Dokumentasi tersimpan.');
      }
    }catch(err){
      console.error(err);toast(err.message||'Dokumentasi gagal disimpan.');
    }finally{
      ui?.hide();setBusy(btn,false);
    }
  });

  $('#teamForm')?.addEventListener('submit',async e=>{
    e.preventDefault();const btn=e.submitter;setBusy(btn,true,'Menyimpan...');
    try{
      const base={id:$('#teamId').value||'',nama:$('#teamName').value.trim(),jabatan:$('#teamRole').value.trim(),kelompok:$('#teamGroup').value.trim(),aktif:true};
      if(teamFiles.length>1){
        const items=teamFiles.map((file,i)=>({data:{...base,id:i===0?base.id:'',nama:i===0&&base.nama?base.nama:file.name.replace(/\.[^.]+$/,'').replace(/[_-]+/g,' ').trim()},file}));
        try{await API.post('saveTimBatch',{items});}catch(batchErr){if(!/dikenal/i.test(batchErr.message||''))throw batchErr;for(const item of items)await API.post('saveTim',item);}
      }else{
        const payload={data:base};if(teamFiles[0])payload.file=teamFiles[0];await API.post('saveTim',payload);
      }
      resetTeam();await refresh();toast('Profil pegawai tersimpan di Google Drive.');
    }catch(err){console.error(err);toast(err.message||'Profil pegawai gagal disimpan.')}finally{setBusy(btn,false)}
  });

  $('#documentationReset')?.addEventListener('click',resetDoc);
  $('#teamReset')?.addEventListener('click',resetTeam);

  $('#documentationAdminList')?.addEventListener('click',async e=>{
    const ed=e.target.closest('[data-edit-documentation]'),del=e.target.closest('[data-delete-documentation]');
    if(ed){
      const x=state.documentation.find(v=>v.id===ed.dataset.editDocumentation);if(!x)return;
      $('#documentationId').value=x.id;$('#documentationDate').value=x.date||'';$('#documentationTitle').value=x.title||'';$('#documentationLocation').value=x.location||'';
      $('#documentationCategory').value=x.category||'Pendampingan & Konsultasi';$('#documentationDescription').value=x.description||'';if($('#documentationInstagram'))$('#documentationInstagram').value=(x.instagram||[]).join('\n');docFiles=[];
      const count=x.media?.length||0;$('#documentationPhotoPreview').innerHTML=`<div class="doc-upload-current"><b>${count} media tersimpan</b><span>Pilih file baru bila ingin menambah foto atau video.</span></div>`;
      $('#documentationTitle').focus();
    }
    if(del&&confirm('Hapus dokumentasi ini?')){
      try{await API.post('deleteDokumentasi',{id:del.dataset.deleteDocumentation});await refresh();toast('Dokumentasi dihapus.')}catch(err){toast(err.message||'Dokumentasi gagal dihapus.')}
    }
  });

  $('#teamAdminList')?.addEventListener('click',async e=>{
    const ed=e.target.closest('[data-edit-team]'),del=e.target.closest('[data-delete-team]');
    if(ed){const x=state.team.find(v=>v.id===ed.dataset.editTeam);if(!x)return;$('#teamId').value=x.id;$('#teamName').value=x.name||'';$('#teamRole').value=x.role||'';$('#teamGroup').value=x.group||'';teamFiles=[];$('#teamPhotoPreview').innerHTML=x.photo?`<img src="${x.photo}" alt="Preview">`:'<span>Belum ada foto</span>';$('#teamName').focus()}
    if(del&&confirm('Hapus profil pegawai ini?')){try{await API.post('deleteTim',{id:del.dataset.deleteTeam});await refresh();toast('Profil pegawai dihapus.')}catch(err){toast(err.message||'Profil pegawai gagal dihapus.')}}
  });

  $('#exportSiteContentDocs')?.addEventListener('click',()=>download('dokumentasi-pendampingan.json',state.documentation));
  $('#exportSiteContentTeam')?.addEventListener('click',()=>download('tim-pbj.json',state.team));

  async function migrateLegacy(remote){
    if(localStorage.getItem('traxpbj_v20_site_migrated')==='1')return;
    const old=safeJSON(localStorage.getItem('traxpbj_site_content'));
    if(!old){localStorage.setItem('traxpbj_v20_site_migrated','1');return;}
    try{
      if(!(remote.dokumentasi||[]).length){
        for(const x of old.documentation||[]){
          if(x.id==='docs-default'&&!x.photo)continue;
          await API.post('saveDokumentasi',{data:{id:x.id||'',tanggal:x.date||'',judul:x.title||'',lokasi:x.location||'',kategori:x.category||'Pendampingan & Konsultasi',deskripsi:x.description||'',tampil:true},...(String(x.photo||'').startsWith('data:')?{cover:API.dataUrlToFile(x.photo,`dokumentasi-${x.id||Date.now()}.jpg`)}:{})});
        }
      }
      if(!(remote.tim||[]).length){
        for(const x of old.team||[]){
          await API.post('saveTim',{data:{id:x.id||'',nama:x.name||'',jabatan:x.role||'',kelompok:x.group||'',aktif:true},...(String(x.photo||'').startsWith('data:')?{file:API.dataUrlToFile(x.photo,`tim-${x.id||Date.now()}.jpg`)}:{})});
        }
      }
      localStorage.setItem('traxpbj_v20_site_migrated','1');
    }catch(err){console.warn('Migrasi dokumentasi/tim belum selesai.',err)}
  }

  async function refresh(){
    const remote=await API.refreshBootstrap();
    state={documentation:mapDocs(remote.dokumentasi||[]),team:mapTeam(remote.tim||[])};
    renderAll();return remote;
  }

  async function init(remote){
    if(loaded)return;loaded=true;
    try{
      remote=remote||await API.bootstrap();
      state={documentation:mapDocs(remote.dokumentasi||[]),team:mapTeam(remote.tim||[])};
      renderAll();await migrateLegacy(remote);
    }catch(err){console.error(err);toast('Data Dokumentasi/Tim belum dapat dimuat dari Google.')}
  }

  document.addEventListener('trax:admin-api-ready',e=>init(e.detail));
  if(API?.hasSession())setTimeout(()=>init(),0);
})();
