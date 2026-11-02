(() => {
  'use strict';
  const $=sel=>document.querySelector(sel);
  const root=$('#orbitNotice'),btn=$('#orbitNoticeTrigger'),menu=$('#orbitNoticeMenu'),list=$('#orbitNoticeList'),count=$('#orbitNoticeCount');
  if(!root||!btn||!menu||!list||!count)return;
  const esc=text=>String(text??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  let userId='',data=null,loadedAt=0,pending=null,generation=0,refreshTimer=null,prevUnread=0,ringTimer=null;
  const page=$('#notifikasi'),pageList=$('#orbitNoticePageList'),pageCount=$('#orbitNoticePageCount');
  const typeFilter=$('#orbitNoticeType'),monthFilter=$('#orbitNoticeMonth'),yearFilter=$('#orbitNoticeYear');
  const pageRange=$('#orbitNoticePageRange'),pageNumber=$('#orbitNoticePageNumber'),pager=$('#orbitNoticePager');
  let archiveData=null,archivePending=null,archiveAt=0,archivePage=1;
  const perPage=10;
  const dateCache=new Map(),noticeDateFormatter=new Intl.DateTimeFormat('en-US',{year:'numeric',month:'2-digit',timeZone:'Asia/Jakarta'});
  const api=()=>window.TRAXPBJ_SELECTION_API;
  const user=()=>window.TRAXPBJ_SESSION?.getProvider()==='pbj'?window.TRAXPBJ_SESSION?.getUser():null;
  const message=txt=>{list.innerHTML='<p class="orbit-notice-empty">'+esc(txt)+'</p>';};
  function triggerBellMotion(){
    if(!btn)return;
    btn.classList.remove('is-ring');
    void btn.offsetWidth;
    btn.classList.add('is-ring');
    if(ringTimer)clearTimeout(ringTimer);
    ringTimer=setTimeout(()=>btn.classList.remove('is-ring'),2200);
  }
  function noticeTone(item){
    // Status pemberitahuan proses berasal dari judul kejadian, bukan nama paket.
    // Broadcast tetap boleh mengacu ke isi pesannya bila judulnya umum.
    const title=String(item?.title||'').toLowerCase();
    const message=String(item?.message||'').toLowerCase();
    const classify=text=>{
      if(/ditolak|penolakan|\btolak\b|dibatalkan|pembatalan|\bbatal\b|kegagalan|\bgagal\b/.test(text))return 'tone-danger';
      if(/undangan|diundang/.test(text))return 'tone-success';
      if(/perlu diperbaiki|perbaikan|revisi|dikembalikan|lengkapi|kelengkapan|tidak sesuai/.test(text))return 'tone-warning';
      if(/selesai|sesuai|disetujui|ditetapkan|handover|berhasil/.test(text))return 'tone-success';
      return 'tone-info';
    };
    const titleTone=classify(title);
    return titleTone!=='tone-info'||item?.type!=='broadcast'?titleTone:classify(message);
  }
  function messageLinks(value){
    const raw=String(value||''),regex=/(https?:\/\/[^\s<>"']+|www\.[^\s<>"']+)/gi;
    let out='',from=0,match;
    while((match=regex.exec(raw))){
      out+=esc(raw.slice(from,match.index));
      const token=match[0],clean=token.replace(/[.,;:!?)]*$/,''),suffix=token.slice(clean.length);
      const url=/^www\./i.test(clean)?'https://'+clean:clean;
      try{const parsed=new URL(url);if(!['http:','https:'].includes(parsed.protocol))throw new Error('not URL');
        out+=`<a class="orbit-notice-link" href="${esc(parsed.href)}" target="_blank" rel="noopener noreferrer">${esc(clean)}</a>`;
      }catch(_){out+=esc(clean)}
      out+=esc(suffix);from=regex.lastIndex;
    }
    return out+esc(raw.slice(from));
  }
  function noticeCard(n){
    const tone=noticeTone(n),hasRequest=Boolean(n.request_id),hasFile=Boolean(n.attachment_url&&/^https:\/\//i.test(n.attachment_url));
    let attachments=[];try{const parsed=JSON.parse(String(n.attachments_json||'[]'));if(Array.isArray(parsed))attachments=parsed;}catch(_){}
    if(!attachments.length&&hasFile)attachments=[{name:n.attachment_name||'Dokumen',url:n.attachment_url}];
    const file=attachments.filter(a=>/^https:\/\//i.test(String(a.url||''))).slice(0,5).map((a,i)=>`<a class="orbit-notice-attachment" href="${esc(a.url)}" target="_blank" rel="noopener noreferrer">Buka lampiran${attachments.length>1?' '+(i+1):''}: ${esc(a.name||'Dokumen')}</a>`).join('');
    const timestamp=esc(n.created_at&&!Number.isNaN(new Date(n.created_at).getTime())?new Date(n.created_at).toLocaleString('id-ID',{day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit',timeZone:'Asia/Jakarta'}):'Waktu tidak tersedia');
    return `<article class="orbit-notice-item ${tone} ${n.read?'is-read':''}" data-orbit-notice-row="${esc(n.id)}"><span class="orbit-notice-dot" aria-hidden="true"></span><div class="orbit-notice-item-copy"><button type="button" class="orbit-notice-item-open" data-orbit-notice="${esc(n.id)}" aria-label="${esc(n.title)}${hasRequest?' — Buka permohonan':''}"><b>${esc(n.title)}</b></button><span>${messageLinks(n.message)}</span>${file}<small>${timestamp} · ${n.type==='broadcast'?'Pengumuman':'Permohonan Pemilihan'}</small></div></article>`;
  }
  function dateParts(value){
    const key=String(value||'');if(dateCache.has(key))return dateCache.get(key);
    const d=new Date(key),parts=Number.isNaN(d.getTime())?[]:noticeDateFormatter.formatToParts(d);
    const result={year:parts.find(x=>x.type==='year')?.value||'',month:parts.find(x=>x.type==='month')?.value||''};
    if(dateCache.size>15000)dateCache.clear();dateCache.set(key,result);return result;
  }
  function rebuildPageFilters(){
    const items=archiveData?.items||[],years=[...new Set(items.map(x=>dateParts(x.created_at).year).filter(Boolean))].sort((a,b)=>b.localeCompare(a));
    const year=yearFilter?.value||'',month=monthFilter?.value||'';
    if(yearFilter){yearFilter.innerHTML='<option value="">Semua tahun</option>'+years.map(y=>`<option value="${esc(y)}">${esc(y)}</option>`).join('');yearFilter.value=years.includes(year)?year:'';}
    if(monthFilter){monthFilter.innerHTML='<option value="">Semua bulan</option>'+Array.from({length:12},(_,i)=>{const m=String(i+1).padStart(2,'0');const name=new Intl.DateTimeFormat('id-ID',{month:'long',timeZone:'Asia/Jakarta'}).format(new Date(Date.UTC(2026,i,1)));return `<option value="${m}">${name}</option>`;}).join('');monthFilter.value=month;}
  }
  function filteredPageItems(){
    const type=typeFilter?.value||'',month=monthFilter?.value||'',year=yearFilter?.value||'';
    return (archiveData?.items||[]).filter(n=>{
      if(type&&!(type==='broadcast'||type==='permohonan'?n.type===type:noticeTone(n)==='tone-'+type))return false;
      if(!month&&!year)return true;
      const parts=dateParts(n.created_at);
      return (!year||parts.year===year)&&(!month||parts.month===month);
    });
  }
  function renderPage(){
    if(!page||page.hidden)return;
    if(!archiveData){pageList.innerHTML='<p class="orbit-notice-empty">Memuat notifikasi…</p>';if(pager)pager.hidden=true;return;}
    const found=filteredPageItems(),total=found.length,pages=Math.max(1,Math.ceil(total/perPage));archivePage=Math.min(archivePage,pages);
    const first=(archivePage-1)*perPage,display=found.slice(first,first+perPage);
    pageList.innerHTML=display.length?display.map(noticeCard).join(''):'<p class="orbit-notice-empty">Tidak ada notifikasi untuk filter ini.</p>';
    pageCount.textContent=`${total} notifikasi sesuai filter · ${archiveData.unread||0} belum dibaca`;
    if(pager){pager.hidden=total===0;pageRange.textContent=total?`${first+1}–${first+display.length} dari ${total} notifikasi`:'';pageNumber.textContent=`Halaman ${archivePage} dari ${pages}`;$('#orbitNoticePrev').disabled=archivePage<=1;$('#orbitNoticeNext').disabled=archivePage>=pages;}
  }
  async function loadArchive(force=false){
    const current=user();if(!page||page.hidden||!current||!api()?.hasSession())return;
    if(!force&&archiveData&&Date.now()-archiveAt<45000){renderPage();return;}
    if(archivePending)return archivePending;
    const g=generation,id=userId;
    if(!archiveData)pageList.innerHTML='<p class="orbit-notice-empty">Memuat notifikasi…</p>';
    archivePending=api().call('listNotifications',{archive:true},{timeoutMs:35000}).then(res=>{
      if(g!==generation||id!==userId)return;
      archiveData=res.data||{items:[],unread:0};archiveAt=Date.now();
      // Daftar rinci hanya memuat data ketika halaman dibuka, tidak saat membuka lonceng.
      rebuildPageFilters();renderPage();
    }).catch(err=>{if(g!==generation)return;pageList.innerHTML='<p class="orbit-notice-empty">Notifikasi belum dapat dimuat. Coba tekan Perbarui.</p>';});
    try{return await archivePending}finally{if(g===generation)archivePending=null;}
  }
  function syncPage(){
    if(!page)return;
    const active=location.hash==='#notifikasi'&&Boolean(user());
    page.hidden=!active;document.body.classList.toggle('orbit-notice-page-open',active);
    if(active){close();loadArchive(false).catch(()=>{});}
  }
  function openPage(){
    if(!user())return;
    close();
    if(location.hash!=='#notifikasi'){
      window.TRAXPBJ_CONTROL_ROOM?.close?.(true);
      history.pushState({orbitaNotifikasi:true},'',location.pathname+location.search+'#notifikasi');
    }
    if(!archiveData&&data){
      archiveData={items:Array.isArray(data.items)?[...data.items]:[],unread:Number(data.unread)||0};
      rebuildPageFilters();
      renderPage();
    }
    syncPage();
  }
  function leavePage(){
    if(location.hash!=='#notifikasi'){syncPage();return;}
    if(history.state?.orbitaNotifikasi)history.back();
    else{history.replaceState(history.state,'',location.pathname+location.search+'#home');syncPage();}
  }
  function paint(){
    if(!data){message('Memuat notifikasi…');return;}
    const unread=Math.max(0,Number(data.unread)||0);
    count.hidden=!unread;count.textContent=unread>99?'99+':String(unread);
    btn.setAttribute('aria-label','Notifikasi'+(unread?' ('+unread+' belum dibaca)':''));
    root.classList.toggle('has-unread',unread>0);
    btn.classList.toggle('has-unread',unread>0);
    btn.dataset.unread=String(unread);
    if(unread>0&&(prevUnread===0||unread>prevUnread))triggerBellMotion();
    if(!unread)btn.classList.remove('is-ring');
    prevUnread=unread;
    const items=Array.isArray(data.items)?data.items:[];
    if(!items.length){message('Belum ada pemberitahuan.');return;}
    // Di lonceng hanya lima pemberitahuan terbaru, tanpa memotong data di halaman Notifikasi.
    list.innerHTML=items.slice(0,5).map(noticeCard).join('');
  }
  async function load(force=false){
    const current=user();if(!current||!api()?.hasSession())return;
    if(!force&&data&&Date.now()-loadedAt<45000){paint();return;}
    if(pending)return pending;
    const myGeneration=generation,myId=userId;
    pending=api().call('listNotifications',{}, {timeoutMs:20000}).then(res=>{
      if(generation!==myGeneration||myId!==userId)return;
      data=res.data||{items:[],unread:0};loadedAt=Date.now();paint();
    }).catch(e=>{
      if(generation!==myGeneration)return;
      if(!data&&menu.hidden===false)message(/aksi tidak dikenal/i.test(String(e?.message||''))?'Notifikasi perlu pembaruan backend Apps Script.':'Notifikasi belum dapat dimuat. Coba perbarui.');
    }).finally(()=>{if(generation===myGeneration)pending=null});
    return pending;
  }
  function close(){menu.hidden=true;btn.setAttribute('aria-expanded','false')}
  function sessionChange(){
    const current=user();generation++;userId=current?String(current.user_id||''):'';data=null;loadedAt=0;pending=null;prevUnread=0;archiveData=null;archivePending=null;archiveAt=0;archivePage=1;dateCache.clear();
    root.hidden=!current;close();count.hidden=true;root.classList.remove('has-unread');btn.classList.remove('has-unread','is-ring');delete btn.dataset.unread;syncPage();
    if(refreshTimer){clearInterval(refreshTimer);refreshTimer=null;}
    if(current){setTimeout(()=>{if(userId===String(user()?.user_id||'')&&!document.hidden)load().catch(()=>{});},220);
      refreshTimer=setInterval(()=>{if(!document.hidden&&!root.hidden)load(true).catch(()=>{});},90000);}
  }
  btn.addEventListener('click',e=>{e.stopPropagation();const opening=menu.hidden;menu.hidden=!opening;btn.setAttribute('aria-expanded',String(opening));if(opening){if(data)paint();load(false).catch(()=>{});}});
  $('#orbitNoticeRefresh')?.addEventListener('click',()=>{loadedAt=0;load(true).catch(()=>{});});
  document.addEventListener('pointerdown',e=>{if(!root.contains(e.target))close()});
  document.addEventListener('keydown',e=>{if(e.key==='Escape')close()});
  function noticeClick(e,fromArchive=false){
    const row=e.target.closest('[data-orbit-notice-row]');if(!row)return;
    const id=row.dataset.orbitNoticeRow;
    const n=(fromArchive?(archiveData?.items||[]):(data?.items||[])).find(x=>String(x.id)===id);
    if(!n)return;
    const onLink=Boolean(e.target.closest('a'));
    if(!n.read){
      for(const model of [data,archiveData]){
        if(!model)continue;
        const match=(model.items||[]).find(x=>String(x.id)===id);
        if(match&&!match.read){match.read=true;model.unread=Math.max(0,(Number(model.unread)||0)-1);}
      }
      // Tautan tetap ada saat diklik, tidak mengganti node sebelum browser membukanya.
      if(onLink){row.classList.add('is-read');if(data){count.hidden=!data.unread;count.textContent=data.unread>99?'99+':String(data.unread);}}
      else {if(data)paint();if(fromArchive)renderPage();}
      api()?.call('readNotification',{id:n.id},{timeoutMs:20000}).catch(()=>{loadedAt=0;archiveAt=0;});
    }
    if(onLink)return;
    if(n.request_id){
      if(fromArchive){page.hidden=true;document.body.classList.remove('orbit-notice-page-open');}
      close();document.dispatchEvent(new CustomEvent('trax:open-control-room',{detail:{module:'selection'}}));
      window.TRAXPBJ_SELECTION?.openRequest?.(String(n.request_id));
    }else if(!fromArchive){
      // Broadcast umum cukup ditandai dibaca, tidak membuka menu permohonan.
      paint();
    }
  }
  list.addEventListener('click',e=>noticeClick(e));
  pageList?.addEventListener('click',e=>noticeClick(e,true));
  $('#orbitNoticeAll')?.addEventListener('click',openPage);
  $('#orbitNoticePageBack')?.addEventListener('click',leavePage);
  $('#orbitNoticePageRefresh')?.addEventListener('click',()=>{archiveAt=0;loadArchive(true).catch(()=>{});});
  [typeFilter,monthFilter,yearFilter].forEach(el=>el?.addEventListener('change',()=>{archivePage=1;renderPage();}));
  $('#orbitNoticePrev')?.addEventListener('click',()=>{archivePage=Math.max(1,archivePage-1);renderPage();page?.scrollTo?.({top:0,behavior:'smooth'});});
  $('#orbitNoticeNext')?.addEventListener('click',()=>{archivePage++;renderPage();page?.scrollTo?.({top:0,behavior:'smooth'});});
  window.addEventListener('popstate',syncPage);
  window.addEventListener('hashchange',syncPage);
  // Tombol menu lama memakai pushState langsung: tutup halaman saat berpindah modul.
  document.addEventListener('trax:open-control-room',()=>{if(page){page.hidden=true;document.body.classList.remove('orbit-notice-page-open');}});
  document.addEventListener('click',e=>{if(page&&!page.hidden&&e.target.closest?.('[data-top-control],[data-top-service],[data-main-chapter]')){page.hidden=true;document.body.classList.remove('orbit-notice-page-open');}},true);
  document.addEventListener('trax:session-change',sessionChange);
  // Sinkron antar tab di origin yang sama, tanpa polling tambahan saat halaman tidak aktif.
  let noticeChannel=null;
  try{if(typeof BroadcastChannel!=='undefined')noticeChannel=new BroadcastChannel('orbita-pbj-notifikasi');}catch(_){}
  if(noticeChannel)noticeChannel.onmessage=e=>{if(e.data?.type==='broadcast-sent'&&!root.hidden&&!document.hidden){loadedAt=0;load(true).catch(()=>{});}};
  document.addEventListener('trax:broadcast-sent',()=>{noticeChannel?.postMessage({type:'broadcast-sent'});});
  document.addEventListener('trax:notification-changed',()=>{loadedAt=0;archiveAt=0;if(!root.hidden){load(true).catch(()=>{});if(page&&!page.hidden)loadArchive(true).catch(()=>{});}});
  document.addEventListener('visibilitychange',()=>{if(!document.hidden&&!root.hidden&&Date.now()-loadedAt>60000)load().catch(()=>{});});
  window.addEventListener?.('focus',()=>{if(!document.hidden&&!root.hidden&&Date.now()-loadedAt>12000)load(true).catch(()=>{});});
  sessionChange();
})();
