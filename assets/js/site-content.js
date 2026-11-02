(() => {
  'use strict';
  const $=(s,c=document)=>c.querySelector(s); const $$=(s,c=document)=>[...c.querySelectorAll(s)];
  const esc=v=>String(v??'').replace(/[&<>'"]/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':'&quot;'}[ch]));
  const fmtDate=v=>{if(!v)return '—';try{return new Intl.DateTimeFormat('id-ID',{day:'2-digit',month:'short',year:'numeric'}).format(new Date(v+'T00:00:00'))}catch{return v}};
  let state=window.TRAXPBJ_SITE_CONTENT||{documentation:[],team:[]};
  let docIndex=0, mediaIndex=0, mediaObserver=null;
  let leadership=window.TRAXPBJ_ADMIN_CONTENT?.leaders||{}; let leadershipIndex=0;
  const fallbackDoc={id:'fallback',date:'',title:'Dokumentasi Pendampingan PBJ',location:'Kota Bogor',category:'Pendampingan',description:'Dokumentasi kegiatan pendampingan Pengadaan Barang/Jasa Kota Bogor.',photo:'',media:[],instagram:[]};

  function normalizeState(next){
    const docs=Array.isArray(next?.documentation)?next.documentation:[];
    const team=Array.isArray(next?.team)?next.team:[];
    state={documentation:docs.length?docs:[fallbackDoc],team};
  }

  function instagramCanonicalUrl(raw){
    try{
      const text=String(raw||'').trim();
      const found=text.match(/https?:\/\/(?:www\.)?instagram\.com\/[^\s<>'\"]+/i);
      const u=new URL(found?found[0]:text);
      if(!/(^|\.)instagram\.com$/i.test(u.hostname))return '';
      const parts=u.pathname.split('/').filter(Boolean);
      let type='',code='';
      if(['p','reel','reels','tv'].includes(parts[0])&&parts[1]){type=parts[0]==='reels'?'reel':parts[0];code=parts[1];}
      else if(parts[0]==='share'&&['p','reel','reels','tv'].includes(parts[1])&&parts[2]){type=parts[1]==='reels'?'reel':parts[1];code=parts[2];}
      if(!type||!code)return '';
      return `https://www.instagram.com/${type}/${code}/`;
    }catch{return ''}
  }
  function instagramEmbedUrl(raw){const canonical=instagramCanonicalUrl(raw);return canonical?canonical+'embed/':'';}

  function docMedia(d){
    const rows=Array.isArray(d?.media)?[...d.media]:[];
    if(!rows.length&&d?.photo)rows.push({id:'cover',type:'image',url:d.photo,imageUrl:d.photo,caption:d.title||''});
    (d?.photos||[]).forEach(x=>{if(!x?.url||rows.some(m=>m.url===x.url))return;rows.push({id:x.id||'',type:'image',url:x.url,imageUrl:x.url,caption:x.caption||''});});
    (d?.instagram||[]).forEach((url,i)=>{
      const embed=instagramEmbedUrl(url); if(!embed)return;
      rows.push({id:`ig-${i}`,type:'instagram',url:String(url),embedUrl:embed,caption:d.title||'Instagram'});
    });
    return rows;
  }

  function updateMediaStatus(index,total){
    mediaIndex=Math.max(0,Math.min(index,Math.max(0,total-1)));
    const progress=$('#docsMediaProgress');if(progress)progress.style.width=`${((mediaIndex+1)/Math.max(1,total))*100}%`;
    $$('.docs-media-card').forEach((card,i)=>card.classList.toggle('active',i===mediaIndex));
  }

  function observeMedia(total){
    if(mediaObserver)mediaObserver.disconnect();
    const stream=$('#docsMediaStream');if(!stream)return;
    const cards=$$('.docs-media-card',stream);
    if(!cards.length)return;
    mediaObserver=new IntersectionObserver(entries=>{
      const visible=entries.filter(e=>e.isIntersecting).sort((a,b)=>b.intersectionRatio-a.intersectionRatio);
      visible.forEach(entry=>{
        const iframe=entry.target.querySelector('iframe[data-src]');
        if(iframe&&!iframe.src)iframe.src=iframe.dataset.src||'';
      });
      if(visible[0]){
        const i=Number(visible[0].target.dataset.mediaIndex)||0;
        updateMediaStatus(i,total);
      }
    },{root:stream,threshold:[.22,.42,.62,.82],rootMargin:'12% 0px 12% 0px'});
    cards.forEach(card=>mediaObserver.observe(card));
  }

  function ensureDocsLightbox(){
    let box=$('#docsLightbox');
    if(box)return box;
    box=document.createElement('div');
    box.id='docsLightbox'; box.className='docs-lightbox'; box.setAttribute('aria-hidden','true');
    box.innerHTML='<button type="button" class="docs-lightbox-close" aria-label="Tutup">×</button><div class="docs-lightbox-stage"></div><div class="docs-lightbox-caption"></div>';
    document.body.appendChild(box);
    const close=()=>{box.classList.remove('open');box.setAttribute('aria-hidden','true');const stage=$('.docs-lightbox-stage',box);if(stage)stage.innerHTML='';};
    $('.docs-lightbox-close',box)?.addEventListener('click',close);
    box.addEventListener('click',e=>{if(e.target===box)close()});
    document.addEventListener('keydown',e=>{if(e.key==='Escape'&&box.classList.contains('open'))close()});
    return box;
  }

  function openDocsMedia(card){
    const type=card?.dataset?.mediaType||'';
    const box=ensureDocsLightbox(), stage=$('.docs-lightbox-stage',box), caption=$('.docs-lightbox-caption',box);
    const src=card?.dataset?.mediaSrc||'', label=card?.dataset?.mediaCaption||'';
    if(!src)return;
    stage.innerHTML=type==='video'
      ? `<iframe src="${esc(src)}" title="${esc(label)}" allow="autoplay; fullscreen" allowfullscreen></iframe>`
      : `<img src="${esc(src)}" alt="${esc(label)}">`;
    if(caption)caption.textContent=label;
    box.classList.add('open');box.setAttribute('aria-hidden','false');
  }

  function renderDocs(){
    if(window.ORBITA_DOCS_TIMELINE_MODE===true)return;
    const docs=state.documentation; docIndex=Math.max(0,Math.min(docIndex,docs.length-1));
    const d=docs[docIndex]||fallbackDoc; const media=docMedia(d);
    const set=(id,v)=>{const e=$(id);if(e)e.textContent=v};
    set('#docsDate',fmtDate(d.date));set('#docsLocation',d.location||'Kota Bogor');set('#docsCategory',d.category||'Pendampingan');
    set('#docsKicker',(d.category||'DOKUMENTASI').toUpperCase());set('#docsTitle',d.title||'Dokumentasi Pendampingan PBJ');set('#docsDescription',d.description||'');

    const archive=$('#docsArchive');
    if(archive)archive.innerHTML=docs.map((x,i)=>`<button type="button" class="${i===docIndex?'active':''}" data-doc-index="${i}"><div><b>${esc(x.title||'Dokumentasi')}</b><small>${esc(fmtDate(x.date))}</small></div></button>`).join('');

    const stream=$('#docsMediaStream');
    if(stream){
      const actual=media.length?media:[{id:'empty',type:'image',url:'../assets/img/LOGOPBJ.png',imageUrl:'../assets/img/LOGOPBJ.png',caption:'Belum ada media'}];
      stream.innerHTML=actual.map((m,i)=>{
        const isVideo=m.type==='video'||String(m.mimeType||'').startsWith('video/');
        const isInstagram=m.type==='instagram';
        const caption=m.caption||d.title||'Dokumentasi';
        const visual=isInstagram
          ? `<div class="docs-instagram-wrap"><iframe title="Instagram · ${esc(caption)}" src="${esc(m.embedUrl||'')}" loading="lazy" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" referrerpolicy="strict-origin-when-cross-origin" allowtransparency="true" allowfullscreen></iframe><span class="docs-instagram-label">INSTAGRAM</span></div>`
          : isVideo
            ? `<div class="docs-video-wrap"><iframe title="${esc(caption)}" data-src="${esc(m.embedUrl||m.url||'')}" allow="autoplay; fullscreen" allowfullscreen loading="lazy"></iframe><span class="docs-media-badge">VIDEO</span></div>`
            : `<img src="${esc(m.imageUrl||m.url||'../assets/img/LOGOPBJ.png')}" alt="${esc(caption)}" loading="${i<2?'eager':'lazy'}" decoding="async">`;
        const mediaSrc=isVideo?(m.embedUrl||m.url||''):(m.imageUrl||m.url||'');
        return `<article class="docs-media-card ${i===0?'active':''} ${isInstagram?'is-instagram':''}" data-media-index="${i}" data-media-type="${isInstagram?'instagram':isVideo?'video':'image'}" data-media-src="${esc(mediaSrc)}" data-media-caption="${esc(caption)}"><div class="docs-media-visual">${visual}</div><footer><b>${esc(caption)}</b><small>${isInstagram?'INSTAGRAM':isVideo?'VIDEO':'FOTO'}</small></footer></article>`;
      }).join('');
      stream.scrollTop=0;
      requestAnimationFrame(()=>observeMedia(actual.length));
      updateMediaStatus(0,actual.length);
    }
  }

  if(window.ORBITA_DOCS_TIMELINE_MODE!==true)$('#docsMediaStream')?.addEventListener('click',e=>{
    if(e.target.closest('a,iframe')||e.target.closest('.is-instagram'))return;
    const card=e.target.closest('.docs-media-card');if(card)openDocsMedia(card);
  });

  if(window.ORBITA_DOCS_TIMELINE_MODE!==true)$('#docsArchive')?.addEventListener('click',e=>{
    const b=e.target.closest('[data-doc-index]');if(!b)return;
    docIndex=Number(b.dataset.docIndex)||0;mediaIndex=0;renderDocs();
  });

  const leaderRoles={kabag:'Kepala Bagian Pengadaan Barang dan Jasa',lpse:'Ketua Kelompok LPSE',advokasi:'Ketua Kelompok Pembinaan dan Advokasi',pengelolaan:'Ketua Kelompok Pengelolaan PBJ'};
  const leaderOrder=['kabag','lpse','advokasi','pengelolaan'];
  const leaderFallbackName=key=>leadership?.[key]?.name||leaderRoles[key];
  function renderLeadership(){
    const list=$('#leadershipList'), photo=$('#leadershipPhoto'), activeName=$('#leadershipActiveName'), activeRole=$('#leadershipActiveRole');
    if(!list||!photo)return;
    const people=leaderOrder.map((key,i)=>({key,index:i+1,name:leaderFallbackName(key),role:leadership?.[key]?.role||leaderRoles[key],photo:leadership?.[key]?.photo||''}));
    leadershipIndex=Math.max(0,Math.min(leadershipIndex,people.length-1));
    const active=people[leadershipIndex];
    list.innerHTML=people.map((x,i)=>`<button type="button" class="leadership-person ${i===leadershipIndex?'active':''}" data-leadership-index="${i}"><span>${String(i+1).padStart(2,'0')}</span><div><b>${esc(x.name)}</b><small>${esc(x.role)}</small></div></button>`).join('');
    photo.classList.remove('is-changing'); void photo.offsetWidth;
    photo.innerHTML=active.photo?`<img src="${esc(active.photo)}" alt="${esc(active.name)}" loading="eager" fetchpriority="high" decoding="async">`:`<div class="leadership-placeholder"><img src="../assets/img/LOGOPBJ.png" alt=""><span>Foto pimpinan</span></div>`;
    photo.classList.add('is-changing');
    if(activeName)activeName.textContent=active.name;if(activeRole)activeRole.textContent=active.role;
  }
  $('#leadershipList')?.addEventListener('pointerover',e=>{const b=e.target.closest('[data-leadership-index]');if(!b)return;const i=Number(b.dataset.leadershipIndex);if(Number.isInteger(i)&&i!==leadershipIndex){leadershipIndex=i;renderLeadership();}});
  $('#leadershipList')?.addEventListener('click',e=>{const b=e.target.closest('[data-leadership-index]');if(!b)return;leadershipIndex=Number(b.dataset.leadershipIndex)||0;renderLeadership();});

  let teamScrollRaf=0;
  let teamResizeObserver=null;
  let teamDragState=null;
  const clamp01=v=>Math.max(0,Math.min(1,v));
  function scheduleTeamScroll(){
    if(teamScrollRaf)return;
    teamScrollRaf=requestAnimationFrame(()=>{teamScrollRaf=0;syncTeamScroll()});
  }
  function measureTeamScroll(){
    const scene=$('#tim-pbj'),rail=$('#teamRail');if(!scene||!rail)return;
    const max=Math.max(0,rail.scrollWidth-rail.clientWidth);
    const travel=Math.max(760,Math.min(2200,max*.46));
    scene.style.setProperty('--team-scroll-travel',`${Math.round(travel)}px`);
    scheduleTeamScroll();
  }
  function syncTeamScroll(){
    const scene=$('#tim-pbj'),rail=$('#teamRail');if(!scene||!rail||teamDragState?.down)return;
    const max=Math.max(0,rail.scrollWidth-rail.clientWidth);if(!max){rail.scrollLeft=0;return;}
    const rect=scene.getBoundingClientRect();
    const range=Math.max(1,scene.offsetHeight-innerHeight);
    const progress=clamp01(-rect.top/range);
    rail.scrollLeft=max*progress;
    rail.style.setProperty('--team-progress',progress.toFixed(4));
  }
  function renderTeam(){
    const rail=$('#teamRail');if(!rail)return;
    if(teamResizeObserver){teamResizeObserver.disconnect();teamResizeObserver=null;}
    if(!state.team.length){rail.innerHTML='<div class="team-empty"><img src="../assets/img/LOGOPBJ.png" alt=""><b>Tim PBJ Kota Bogor</b></div>';return;}
    rail.innerHTML=state.team.map((p,i)=>`<article class="team-person" style="--i:${i}"><div class="team-photo">${p.photo?`<img src="${p.photo}" alt="${esc(p.name||'Pegawai PBJ')}" loading="eager" fetchpriority="low" decoding="async">`:`<img class="placeholder" src="../assets/img/LOGOPBJ.png" alt="">`}<span>${String(i+1).padStart(2,'0')}</span></div><div class="team-copy"><b>${esc(p.name||'Pegawai PBJ')}</b><small>${esc(p.role||'')}</small><em>${esc(p.group||'')}</em></div></article>`).join('');
    teamDragState={down:false,start:0,left:0};
    rail.onpointerdown=e=>{teamDragState.down=true;teamDragState.start=e.clientX;teamDragState.left=rail.scrollLeft;rail.setPointerCapture?.(e.pointerId);rail.classList.add('dragging')};
    rail.onpointermove=e=>{if(teamDragState?.down)rail.scrollLeft=teamDragState.left-(e.clientX-teamDragState.start)};
    rail.onpointerup=rail.onpointercancel=()=>{if(!teamDragState)return;teamDragState.down=false;rail.classList.remove('dragging');};
    requestAnimationFrame(()=>{measureTeamScroll();syncTeamScroll()});
    if('ResizeObserver'in window){teamResizeObserver=new ResizeObserver(measureTeamScroll);teamResizeObserver.observe(rail);}
  }
  // Apabila Google Drive tidak menyediakan foto, pakai logo sebagai pengganti, bukan ruang kosong.
  const photoFallback = event => {
    const img = event.target;
    if (!(img instanceof HTMLImageElement)) return;
    const fallback = '../assets/img/LOGOPBJ.png';
    if (img.getAttribute('src') === fallback) return;
    img.src = fallback;
    img.classList.add('is-photo-fallback');
  };
  $('#leadershipPhoto')?.addEventListener('error', photoFallback, true);
  $('#teamRail')?.addEventListener('error', photoFallback, true);
  addEventListener('scroll',scheduleTeamScroll,{passive:true});
  addEventListener('resize',()=>{measureTeamScroll();scheduleTeamScroll()},{passive:true});

  function renderAll(){normalizeState(state);renderDocs();renderLeadership();renderTeam();}
  document.addEventListener('trax:content-ready',e=>{
    state=e.detail?.siteContent||state;
    leadership=e.detail?.content?.leaders||leadership;
    renderAll();
  });
  renderAll();
})();
