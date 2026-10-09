(() => {
  'use strict';
  const $=(s,c=document)=>c.querySelector(s);
  const $$=(s,c=document)=>[...c.querySelectorAll(s)];
  const esc=v=>String(v??'').replace(/[&<>'"]/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':'&quot;'}[ch]));
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  const fmtDate=v=>{if(!v)return '—';try{return new Intl.DateTimeFormat('id-ID',{day:'2-digit',month:'short',year:'numeric'}).format(new Date(v+'T00:00:00'))}catch{return v}};
  const fmtMonth=v=>{try{return new Intl.DateTimeFormat('id-ID',{month:'short',year:'numeric'}).format(new Date(v))}catch{return '—'}};
  const fmtRangeEdge=v=>{try{const d=new Date(v);return new Intl.DateTimeFormat('id-ID',{month:'short',year:'numeric'}).format(d).toUpperCase()}catch{return '—'}};
  const timeOf=v=>{const raw=String(v||'').trim();if(!raw)return NaN;const d=new Date(/T/.test(raw)?raw:raw+'T00:00:00');return Number.isFinite(d.getTime())?d.getTime():NaN};
  const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
  const palette=[
    ['#f6c84f','#f1a77e'],
    ['#ee6847','#f39a42'],
    ['#8e5a98','#6d8ed9'],
    ['#46a3a9','#71c9b4'],
    ['#4b78b7','#6ba6d7'],
    ['#b26b86','#d58d9d']
  ];

  const DEFAULT_CATEGORIES=['Briefing Internal','Pendampingan & Konsultasi','Rapat Lainnya','Agenda','Surat PBJ'];
  let docs=[];
  let zoom=1;
  let activeFilters=new Set();
  let selected=-1;
  let initialized=false;
  let introPlayed=false;
  let drag=null;
  let baseWidth=1400;
  let layout=null;
  let searchQuery='';
  let yearFrom='';
  let yearTo='';
  let monthFilter='';
  let zoomTarget=1;
  let zoomRaf=0;
  let zoomAnchorX=NaN;
  let inertiaRaf=0;
  let hoverPlayhead={active:false,x:0,label:'',clientX:NaN};
  let detailMediaIndex=0;

  const viewport=()=>$('#docsTimelineViewport');
  const track=()=>$('#docsTimelineTrack');
  const fan=()=>$('#docsTimelineFan');
  const archive=()=>$('#docsArchive');

  function mediaOf(d){
    const rows=Array.isArray(d?.media)?[...d.media]:[];
    if(!rows.length&&d?.photo)rows.push({type:'image',url:d.photo,imageUrl:d.photo,caption:d.title||''});
    (d?.photos||[]).forEach(x=>{if(!x?.url||rows.some(m=>m.url===x.url))return;rows.push({type:'image',url:x.url,imageUrl:x.url,caption:x.caption||''});});
    (d?.instagram||[]).forEach(url=>{if(!url)return;rows.push({type:'instagram',url:String(url),caption:d.title||'Instagram'});});
    return rows;
  }
  function imageOf(d){
    const media=mediaOf(d);
    const m=media.find(x=>(x.type==='image'||String(x.mimeType||'').startsWith('image/'))&&(x.imageUrl||x.url));
    return m?.imageUrl||m?.url||d?.photo||'../assets/img/LOGOPBJ.png';
  }
  function sourceKindOf(d){
    const cat=categoryOf(d);
    if(d?.sourceKind==='surat'||cat==='Surat PBJ')return 'surat';
    if(d?.sourceKind==='agenda'||cat==='Agenda')return 'agenda';
    return 'documentation';
  }
  function driveFileIdOf(d){
    const direct=String(d?.fileId||'').trim();if(direct)return direct;
    const raw=String(d?.actionUrl||d?.url||'');
    const m=raw.match(/\/d\/([^/?#]+)/)||raw.match(/[?&]id=([^&#]+)/);
    return m?decodeURIComponent(m[1]):'';
  }
  function suratThumbOf(d,size=240){
    const id=driveFileIdOf(d);
    return id?`https://drive.google.com/thumbnail?id=${encodeURIComponent(id)}&sz=w${Math.max(120,Math.round(size))}`:'';
  }
  function eventCount(d){return sourceKindOf(d)==='documentation'?Math.max(1,mediaOf(d).length):1}
  function agendaMarkOf(d){
    const t=timeOf(d?.date),date=Number.isFinite(t)?new Date(t):null;
    const day=date?String(date.getDate()).padStart(2,'0'):'--';
    const mon=date?new Intl.DateTimeFormat('id-ID',{month:'short'}).format(date).replace('.','').toUpperCase():'AGENDA';
    return {day,mon};
  }
  function timelineVisual(d,{stack=0}={}){
    const kind=sourceKindOf(d);
    if(kind==='agenda'){
      const mark=agendaMarkOf(d);
      return `<span class="docs-tl-agenda-mark" style="--stack:${stack}"><b>${esc(mark.day)}</b><small>${esc(mark.mon)}</small></span>`;
    }
    if(kind==='surat'){
      const src=suratThumbOf(d,180);
      return `<span class="docs-tl-doc-thumb" style="--stack:${stack}"><span class="docs-tl-doc-fallback">SURAT</span>${src?`<img data-doc-preview src="${esc(src)}" alt="" loading="lazy" decoding="async" fetchpriority="low" onerror="this.style.display='none'">`:''}</span>`;
    }
    return `<span class="docs-tl-thumb" style="--stack:${stack}"><img src="${esc(imageOf(d))}" alt="" loading="lazy" decoding="async"></span>`;
  }

  function timelineHoverVisual(d){
    return timelineVisual(d,{stack:0}).replace('loading="lazy"','loading="eager"').replace('fetchpriority="low"','fetchpriority="high"');
  }
  function hoverMetaOf(d){
    const parts=[];
    const location=String(d?.location||'').trim();
    const date=fmtDate(d?.date);
    if(location)parts.push(location);
    if(date&&(!parts.length||parts[parts.length-1]!==date))parts.push(date);
    return parts.join(' · ');
  }
  function hoverCardMarkup(d,title,meta){
    return `<span class="docs-tl-hover-card" aria-hidden="true"><span class="docs-tl-hover-copy"><b>${esc(title||'Dokumentasi PBJ')}</b>${meta?`<small>${esc(meta)}</small>`:''}</span><span class="docs-tl-hover-visual">${timelineHoverVisual(d)}</span></span>`;
  }
  function normalizeCategory(raw){
    const value=String(raw||'').trim();
    const low=value.toLowerCase();
    if(low==='agenda')return 'Agenda';
    if(/surat/.test(low))return 'Surat PBJ';
    if(/brief/.test(low))return 'Briefing Internal';
    if(/rapat|meeting/.test(low))return 'Rapat Lainnya';
    if(/pendamping|konsult|asist|konsolidasi|advokasi/.test(low)||!value)return 'Pendampingan & Konsultasi';
    return value;
  }
  function categoryOf(d){return normalizeCategory(d?.category)}
  function searchableText(d){return [d?.title,d?.category,categoryOf(d),d?.location,d?.description,d?.date,d?.type,d?.number,d?.fileName,d?.status,d?.time,d?.extraSearch].filter(Boolean).join(' ').toLocaleLowerCase('id-ID')}
  function matchesSearch(d){const q=searchQuery.trim().toLocaleLowerCase('id-ID');return !q||searchableText(d).includes(q)}
  function yearOf(d){const t=timeOf(d?.date);return Number.isFinite(t)?new Date(t).getFullYear():NaN}
  function monthOf(d){const t=timeOf(d?.date);return Number.isFinite(t)?new Date(t).getMonth():NaN}
  function matchesYear(d){
    const y=yearOf(d);
    if(!Number.isFinite(y))return !yearFrom&&!yearTo;
    const from=Number(yearFrom)||-Infinity,to=Number(yearTo)||Infinity;
    return y>=Math.min(from,to)&&y<=Math.max(from,to);
  }
  function matchesMonth(d){const m=monthOf(d);return monthFilter===''?true:(Number.isFinite(m)&&String(m)===String(monthFilter))}
  function matchesVisible(d){return matchesSearch(d)&&matchesYear(d)&&matchesMonth(d)}

  function normalizeRange(items){
    const valid=items.map((d,i)=>({i,t:timeOf(d.date)})).filter(x=>Number.isFinite(x.t));
    let min=valid.length?Math.min(...valid.map(x=>x.t)):Date.now()-86400000*30;
    let max=valid.length?Math.max(...valid.map(x=>x.t)):Date.now()+86400000*30;
    if(max-min<86400000*45){min-=86400000*18;max+=86400000*18;}
    else {min-=86400000*7;max+=86400000*7;}
    return {min,max,span:Math.max(1,max-min)};
  }
  function categories(){
    const out=[...DEFAULT_CATEGORIES];
    docs.forEach(d=>{const c=categoryOf(d);if(c&&!out.includes(c))out.push(c)});
    return out;
  }
  function currentCategories(){const all=categories();return activeFilters.size?all.filter(c=>activeFilters.has(c)):all}

  function buildLayout(){
    const vp=viewport();
    const cats=categories();
    const shown=currentCategories();
    const ranged=docs.filter(d=>matchesYear(d)&&matchesMonth(d));
    const range=normalizeRange(ranged.length?ranged:docs);
    baseWidth=Math.max(vp?.clientWidth||0,Math.min(2600,980+docs.length*86));
    const width=Math.max(vp?.clientWidth||0,baseWidth*zoom);
    const edge=Math.max(74,Math.min(150,(vp?.clientWidth||1000)*.075));
    const usable=Math.max(300,width-edge*2-110);
    let laneH=96,gap=16,top=38;
    const vpH=vp?.clientHeight||700;
    const naturalH=top+cats.length*(laneH+gap)+42;
    if(vpH<naturalH){
      const s=clamp((vpH-8)/naturalH,.78,1);
      laneH=Math.round(laneH*s);gap=Math.max(10,Math.round(gap*s));top=Math.max(24,Math.round(top*s));
    }
    const vpW=vp?.clientWidth||1000;
    const joinX=vpW<620?138:(vpW<900?184:(vpW<1280?232:268));
    const originX=0;
    const stemX=vpW<620?42:(vpW<900?48:(vpW<1280?56:64));
    const stemHalf=vpW<620?1.6:1.9;
    const originY=top+((cats.length-1)*(laneH+gap))/2+laneH/2;
    const points=docs.map((d,index)=>{
      let t=timeOf(d.date);if(!Number.isFinite(t))t=range.min+(range.span*((index+.5)/Math.max(1,docs.length)));
      const ratio=clamp((t-range.min)/range.span,0,1);
      const cat=categoryOf(d),lane=cats.indexOf(cat);
      return {index,t,ratio,x:edge+usable*ratio,cat,lane,y:top+lane*(laneH+gap)+laneH/2};
    });
    const height=Math.max(330,top+cats.length*(laneH+gap)+42);
    return {cats,shown,range,width,edge,usable,laneH,gap,top,height,points,joinX,originX,originY,stemX,stemHalf};
  }

  function renderFilters(){
    const cats=categories();
    if(!activeFilters.size)cats.forEach(c=>activeFilters.add(c));
    const host=$('#docsTimelineFilters');if(!host)return;
    host.innerHTML=cats.map(c=>`<button type="button" class="docs-filter-chip ${activeFilters.has(c)?'active':''}" data-doc-filter="${esc(c)}">${esc(c)}</button>`).join('')+'<button type="button" class="docs-tl-reset" data-doc-reset>Reset</button>';
  }

  function buildTicks(){
    const host=$('#docsTimelineTicks');if(!host||!layout)return;
    const {min,max}=layout.range;
    const start=new Date(min),end=new Date(max);
    const cursor=new Date(start.getFullYear(),start.getMonth(),1);
    const ticks=[];
    let guard=0;
    while(cursor.getTime()<=end.getTime()&&guard++<120){
      const t=cursor.getTime(),ratio=clamp((t-min)/(max-min),0,1),x=layout.edge+layout.usable*ratio;
      ticks.push(`<div class="docs-tl-tick" style="left:${Math.round(x)}px"><span>${esc(new Intl.DateTimeFormat('id-ID',{month:'short',year:'2-digit'}).format(cursor))}</span></div>`);
      cursor.setMonth(cursor.getMonth()+1);
    }
    host.innerHTML=ticks.join('');
  }

  function buildBands(){
    const host=$('#docsTimelineBands');if(!host||!layout)return;
    host.innerHTML=layout.cats.map((cat,i)=>{
      const [a,b]=palette[i%palette.length],y=layout.top+i*(layout.laneH+layout.gap);
      const muted=!activeFilters.has(cat);
      return `<div class="docs-tl-band ${muted?'muted':''}" style="--lane-y:${y}px;--lane-h:${layout.laneH}px;--lane-a:${a};--lane-b:${b};--lane-index:${i};--fan-join:${layout.joinX}px"><span class="docs-tl-band-label">${esc(cat)}</span></div>`;
    }).join('');
  }

  function buildFan(){
    const host=fan();if(!host||!layout)return;
    const {width,height,originX,originY,joinX,stemX,stemHalf,laneH,gap,top,cats}=layout;
    host.setAttribute('viewBox',`0 0 ${Math.max(1,Math.round(width))} ${Math.max(1,Math.round(height))}`);
    host.setAttribute('width',String(Math.round(width)));
    host.setAttribute('height',String(Math.round(height)));
    const defs=[];
    const shapes=[];
    cats.forEach((cat,i)=>{
      const [a,b]=palette[i%palette.length];
      const laneTop=top+i*(laneH+gap);
      const laneBottom=laneTop+laneH;
      const laneMid=laneTop+laneH/2;
      const branchC1=stemX+(joinX-stemX)*.26;
      const branchC2=stemX+(joinX-stemX)*.84;
      const id=`docsFanGrad${i}`;
      defs.push(`<linearGradient id="${id}" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="${a}" stop-opacity=".94"/><stop offset="1" stop-color="${b}"/></linearGradient>`);
      const d=[
        `M ${originX} ${originY-stemHalf}`,
        `L ${stemX} ${originY-stemHalf}`,
        `C ${branchC1} ${originY-stemHalf} ${branchC2} ${laneTop} ${joinX} ${laneTop}`,
        `L ${joinX} ${laneBottom}`,
        `C ${branchC2} ${laneBottom} ${branchC1} ${originY+stemHalf} ${stemX} ${originY+stemHalf}`,
        `L ${originX} ${originY+stemHalf}`,
        'Z'
      ].join(' ');
      const center=`M ${originX} ${originY} L ${stemX} ${originY} C ${branchC1} ${originY} ${branchC2} ${laneMid} ${joinX+16} ${laneMid}`;
      const muted=!activeFilters.has(cat);
      shapes.push(`<g class="docs-tl-fan-branch ${muted?'muted':''}" style="--lane-index:${i}"><path class="docs-tl-fan-ribbon" d="${d}" fill="url(#${id})"/><path class="docs-tl-fan-axis" d="${center}"/></g>`);
    });
    host.innerHTML=`<defs>${defs.join('')}</defs><g class="docs-tl-fan-trunk"><line x1="${originX}" y1="${originY}" x2="${stemX}" y2="${originY}"/></g>${shapes.join('')}`;
  }


  function clusterPoints(points){
    const byLane=new Map();
    points.filter(p=>activeFilters.has(p.cat)&&matchesVisible(docs[p.index])).forEach(p=>{const arr=byLane.get(p.lane)||[];arr.push(p);byLane.set(p.lane,arr)});
    const groups=[];
    for(const arr of byLane.values()){
      arr.sort((a,b)=>a.x-b.x);
      let group=[];
      for(const p of arr){
        if(!group.length||p.x-group[group.length-1].x<48){group.push(p)}else{groups.push(group);group=[p]}
      }
      if(group.length)groups.push(group);
    }
    return groups;
  }

  function renderEvents(){
    const host=archive();if(!host||!layout)return;
    const groups=clusterPoints(layout.points);
    host.innerHTML=groups.map(group=>{
      if(group.length===1){
        const p=group[0],d=docs[p.index],count=eventCount(d),active=p.index===selected,kind=sourceKindOf(d);
        const title=d.title||'Dokumentasi PBJ';
        const meta=hoverMetaOf(d);
        const spawnDx=layout.originX-p.x,spawnDy=layout.originY-p.y;
        return `<button type="button" class="docs-tl-event is-${kind} ${active?'active':''}" data-doc-event="${p.index}" data-doc-title="${esc(title)}" data-doc-hover-date="${esc(fmtDate(d.date))}" style="--x:${p.x}px;--y:${p.y}px;--event-index:${p.index};--spawn-dx:${spawnDx}px;--spawn-dy:${spawnDy}px" aria-label="${esc(title)}">${timelineVisual(d)}${count>1?`<span class="docs-tl-count">${count}</span>`:''}${hoverCardMarkup(d,title,meta)}</button>`;
      }
      const cx=group.reduce((sum,p)=>sum+p.x,0)/group.length,cy=group[0].y;
      const first=docs[group[0].index],kind=sourceKindOf(first);
      const visuals=group.slice(0,3).map((p,i)=>timelineVisual(docs[p.index],{stack:i})).join('');
      const titles=group.slice(0,3).map(p=>docs[p.index]?.title).filter(Boolean);
      const title=(titles[0]||`${group.length} dokumentasi`) + (group.length>1?` +${group.length-1}`:'');
      const meta=group.length>1?`${group.length} item dalam ${categoryOf(first)}`:hoverMetaOf(first);
      const spawnDx=layout.originX-cx,spawnDy=layout.originY-cy;
      return `<button type="button" class="docs-tl-cluster is-${kind}" data-doc-cluster="${group.map(p=>p.index).join(',')}" data-doc-title="${esc(title)}" style="--x:${cx}px;--y:${cy}px;--event-index:${group[0]?.index||0};--spawn-dx:${spawnDx}px;--spawn-dy:${spawnDy}px">${visuals}<strong>${group.length>9?'9+':group.length}</strong>${hoverCardMarkup(first,title,meta)}</button>`;
    }).join('');
  }

  function updateHeader(){
    if(!layout)return;
    const s=$('#docsRangeStart'),e=$('#docsRangeEnd'),r=$('#docsTimelineRange'),out=$('#docsZoomValue'),status=$('#docsTimelineStatus');
    if(s)s.textContent=fmtRangeEdge(layout.range.min);if(e)e.textContent=fmtRangeEdge(layout.range.max);
    if(r)r.textContent=`${fmtMonth(layout.range.min)} — ${fmtMonth(layout.range.max)}`;
    if(out)out.value=`${Math.round(zoom*100)}%`;
    if(status){const matched=docs.filter(d=>activeFilters.has(categoryOf(d))&&matchesVisible(d)).length;const filtered=searchQuery||yearFrom||yearTo||monthFilter!=='';status.textContent=filtered?`${matched} HASIL · ${docs.length} ITEM`:`${docs.length} ITEM · ${layout.cats.length} LINE`;}
    const tr=track();if(tr){tr.style.setProperty('--timeline-width',`${Math.round(layout.width)}px`);tr.style.setProperty('--tl-height',`${Math.round(layout.height)}px`);tr.style.setProperty('--fan-join',`${Math.round(layout.joinX)}px`)}
  }

  function updateYearControls(){
    const years=docs.map(yearOf).filter(Number.isFinite);
    const min=years.length?Math.min(...years):new Date().getFullYear();
    const max=years.length?Math.max(...years):min;
    const from=$('#docsYearFrom'),to=$('#docsYearTo');
    if(from){from.min=String(min);from.max=String(max);from.placeholder=String(min);if(yearFrom&&from.value!==String(yearFrom))from.value=String(yearFrom)}
    if(to){to.min=String(min);to.max=String(max);to.placeholder=String(max);if(yearTo&&to.value!==String(yearTo))to.value=String(yearTo)}
  }

  function renderTimeline(){
    layout=buildLayout();
    renderFilters();updateYearControls();updateHeader();buildBands();buildFan();buildTicks();renderEvents();
    const play=$('#docsTimelinePlayhead');
    if(play){
      const visible=layout.points.filter(x=>activeFilters.has(x.cat)&&matchesVisible(docs[x.index]));
      const fallback=visible.find(x=>x.index===selected)||visible.slice().sort((a,b)=>b.t-a.t)[0];
      const hasHover=hoverPlayhead.active&&Number.isFinite(hoverPlayhead.x);
      play.hidden=!fallback&&!hasHover;
      if(hasHover){
        play.style.setProperty('--play-x',`${hoverPlayhead.x}px`);
        play.dataset.label=hoverPlayhead.label||'';
      }else if(fallback){
        play.style.setProperty('--play-x',`${fallback.x}px`);
        play.dataset.label=fmtDate(docs[fallback.index]?.date);
      }
    }
  }

  function hoverLabelFromClientX(clientX){
    const vp=viewport();
    if(!vp||!layout)return '';
    const rect=vp.getBoundingClientRect();
    const localX=clamp(clientX-rect.left,0,rect.width);
    const contentX=vp.scrollLeft+localX;
    const ratio=clamp((contentX-layout.edge)/Math.max(1,layout.usable),0,1);
    const time=layout.range.min+(layout.range.span*ratio);
    try{return new Intl.DateTimeFormat('id-ID',{day:'2-digit',month:'short',year:'numeric'}).format(new Date(time))}catch{return ''}
  }

  function updateHoverPlayhead(clientX,{sticky=false}={}){
    const vp=viewport();
    if(!vp||!layout)return;
    const rect=vp.getBoundingClientRect();
    const localX=clamp(clientX-rect.left,0,rect.width);
    const contentX=vp.scrollLeft+localX;
    hoverPlayhead={active:true,x:contentX,label:hoverLabelFromClientX(clientX),clientX};
    const play=$('#docsTimelinePlayhead');
    if(play){
      play.hidden=false;
      play.style.setProperty('--play-x',`${contentX}px`);
      play.dataset.label=hoverPlayhead.label||'';
    }
    if(!sticky) return;
  }

  function clearHoverPlayhead(){
    if(!hoverPlayhead.active)return;
    hoverPlayhead={active:false,x:0,label:'',clientX:NaN};
    renderTimeline();
  }

  function setZoom(next,anchorClientX){
    const vp=viewport();if(!vp)return;
    const oldLayout=layout||buildLayout();
    const rect=vp.getBoundingClientRect();
    const anchor=Number.isFinite(anchorClientX)?clamp(anchorClientX-rect.left,0,rect.width):rect.width/2;
    // Pertahankan titik waktu persis di bawah pointer saat zoom, bukan sekadar rasio lebar track.
    const oldContentX=vp.scrollLeft+anchor;
    const timeRatio=clamp((oldContentX-oldLayout.edge)/Math.max(1,oldLayout.usable),0,1);
    zoom=clamp(next,.75,4.5);
    renderTimeline();
    requestAnimationFrame(()=>{
      const newContentX=layout.edge+layout.usable*timeRatio;
      vp.scrollLeft=clamp(newContentX-anchor,0,Math.max(0,vp.scrollWidth-vp.clientWidth));
    });
  }
  function stopZoomMotion(){if(zoomRaf){cancelAnimationFrame(zoomRaf);zoomRaf=0}zoomTarget=zoom}
  function queueZoom(next,anchorClientX){
    zoomTarget=clamp(next,.75,4.5);
    if(Number.isFinite(anchorClientX))zoomAnchorX=anchorClientX;
    if(zoomRaf)return;
    const step=()=>{
      const diff=zoomTarget-zoom;
      if(Math.abs(diff)<.003){setZoom(zoomTarget,zoomAnchorX);zoom=zoomTarget;zoomRaf=0;return}
      setZoom(zoom+diff*.24,zoomAnchorX);
      zoomRaf=requestAnimationFrame(step);
    };
    zoomRaf=requestAnimationFrame(step);
  }
  function fit(){stopZoomMotion();zoomTarget=1;zoom=1;renderTimeline();const vp=viewport();if(vp)vp.scrollLeft=0}

  function centerIndex(index,smooth=true){
    const vp=viewport(),p=layout?.points.find(x=>x.index===index);if(!vp||!p)return;
    vp.scrollTo({left:Math.max(0,p.x-vp.clientWidth*.5),behavior:reduced||!smooth?'auto':'smooth'});
  }

  function ensureLightbox(){
    let box=$('#docsLightbox');if(box)return box;
    box=document.createElement('div');box.id='docsLightbox';box.className='docs-lightbox';box.setAttribute('aria-hidden','true');
    box.innerHTML='<button type="button" class="docs-lightbox-close" aria-label="Tutup">×</button><div class="docs-lightbox-stage"></div><div class="docs-lightbox-caption"></div>';
    document.body.appendChild(box);
    const close=()=>{box.classList.remove('open');box.setAttribute('aria-hidden','true');$('.docs-lightbox-stage',box).innerHTML=''};
    $('.docs-lightbox-close',box)?.addEventListener('click',close);box.addEventListener('click',e=>{if(e.target===box)close()});document.addEventListener('keydown',e=>{if(e.key==='Escape'&&box.classList.contains('open'))close()});
    return box;
  }
  function openImage(src,caption){const box=ensureLightbox();$('.docs-lightbox-stage',box).innerHTML=`<img src="${esc(src)}" alt="${esc(caption||'Dokumentasi')}">`;$('.docs-lightbox-caption',box).textContent=caption||'';box.classList.add('open');box.setAttribute('aria-hidden','false')}

  function instagramEmbed(raw){try{const u=new URL(raw);const parts=u.pathname.split('/').filter(Boolean);if(['p','reel','reels','tv'].includes(parts[0])&&parts[1])return `https://www.instagram.com/${parts[0]==='reels'?'reel':parts[0]}/${parts[1]}/embed/`}catch{}return ''}
  function renderMediaItem(m,caption,i,cls,asPrimary){
    const isVideo=m.type==='video'||String(m.mimeType||'').startsWith('video/');
    const isIg=m.type==='instagram';
    if(isIg){
      const src=instagramEmbed(m.url||'');
      return src?`<div class="docs-event-embed ${cls}${asPrimary?' is-primary':''}" data-doc-media-index="${i}"><iframe src="${esc(src)}" title="Instagram · ${esc(caption)}" loading="lazy" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen></iframe><span class="docs-media-kind">INSTAGRAM</span></div>`:'';
    }
    if(isVideo){
      const src=m.embedUrl||m.url||'';
      return `<div class="docs-event-embed ${cls}${asPrimary?' is-primary':''}" data-doc-media-index="${i}"><iframe src="${esc(src)}" title="${esc(caption)}" loading="lazy" allow="autoplay; fullscreen" allowfullscreen></iframe><span class="docs-media-kind">VIDEO</span></div>`;
    }
    const src=m.imageUrl||m.url||'../assets/img/LOGOPBJ.png';
    return `<button type="button" class="${cls}${asPrimary?' is-primary':''}" data-doc-image="${esc(src)}" data-caption="${esc(caption)}" data-doc-media-index="${i}"><img src="${esc(src)}" alt="${esc(caption)}" loading="${asPrimary?'eager':'lazy'}" decoding="async"><span class="docs-media-kind">FOTO ${i+1}</span></button>`;
  }

  function renderDetail(index,mediaIndex){
    const d=docs[index];if(!d)return;
    selected=index;
    const set=(id,v)=>{const e=$(id);if(e)e.textContent=v};
    set('#docsDate',fmtDate(d.date));set('#docsLocation',d.location||'Kota Bogor');set('#docsCategory',categoryOf(d));set('#docsKicker',categoryOf(d).toUpperCase());set('#docsTitle',d.title||'Dokumentasi PBJ');set('#docsDescription',d.description||'');
    const copy=$('.docs-event-copy');
    let actions=$('#docsEventActions');
    const kind=sourceKindOf(d),isSurat=kind==='surat',isAgenda=kind==='agenda';
    if(actions)actions.remove();
    const actionLinks=[];
    if(isSurat&&d.actionUrl)actionLinks.push({url:d.actionUrl,label:'Buka surat'});
    if(isAgenda&&d.documentUrl)actionLinks.push({url:d.documentUrl,label:'Buka dokumen'});
    if(isAgenda&&d.materialUrl)actionLinks.push({url:d.materialUrl,label:'Buka materi'});
    if(actionLinks.length&&copy){
      actions=document.createElement('div');actions.id='docsEventActions';actions.className='docs-event-actions';
      actions.innerHTML=actionLinks.map(x=>`<a class="docs-event-action" href="${esc(x.url)}" target="_blank" rel="noopener noreferrer">${esc(x.label)}</a>`).join('');
      copy.appendChild(actions);
    }
    const catIndex=Math.max(0,categories().indexOf(categoryOf(d))), colors=palette[catIndex%palette.length];
    const panel=$('#docsEventPanel');
    panel?.style.setProperty('--detail-a',colors[0]);panel?.style.setProperty('--detail-b',colors[1]);
    if(panel)panel.dataset.detailKind=kind;
    const host=$('#docsMediaStream'),media=mediaOf(d);
    if(host){
      host.hidden=false;
      if(isAgenda){
        host.hidden=true;host.innerHTML='';detailMediaIndex=0;
      }else if(isSurat){
        const preview=suratThumbOf(d,1000);
        host.innerHTML=`<div class="docs-surat-preview-wrap">${d.actionUrl?`<a class="docs-surat-preview" href="${esc(d.actionUrl)}" target="_blank" rel="noopener noreferrer" aria-label="Buka ${esc(d.title||'surat')}">`:'<div class="docs-surat-preview">'}<span class="docs-surat-paper-fallback"><b>SURAT PBJ</b><small>${esc(d.fileName||d.number||'Dokumen')}</small></span>${preview?`<img data-doc-preview src="${esc(preview)}" alt="Tampilan awal ${esc(d.title||'surat PBJ')}" loading="eager" decoding="async" fetchpriority="high" onerror="this.style.display='none'">`:''}<span class="docs-surat-preview-label">TAMPILAN SURAT</span>${d.actionUrl?'</a>':'</div>'}</div>`;
        detailMediaIndex=0;
      }else{
        const actual=media.length?media:[{type:'image',url:'../assets/img/LOGOPBJ.png',imageUrl:'../assets/img/LOGOPBJ.png',caption:'Belum ada media'}];
        const resolvedIndex=clamp(Number.isFinite(mediaIndex)?mediaIndex:detailMediaIndex,0,Math.max(0,actual.length-1));
        detailMediaIndex=resolvedIndex;
        const primary=actual[resolvedIndex];
        const caption=primary.caption||d.title||'Dokumentasi';
        const thumbs=actual.length>1?actual.map((m,i)=>{
          const cap=m.caption||d.title||'Dokumentasi';
          const active=i===resolvedIndex?' active':'';
          const isVideo=m.type==='video'||String(m.mimeType||'').startsWith('video/');
          const isIg=m.type==='instagram';
          const src=isIg?'../assets/img/LOGOPBJ.png':(m.imageUrl||m.url||'../assets/img/LOGOPBJ.png');
          return `<button type="button" class="docs-gallery-bubble${active}${isVideo?' is-video':''}${isIg?' is-instagram':''}" data-doc-media-pick="${i}" aria-label="Media ${i+1}">${src?`<img src="${esc(src)}" alt="${esc(cap)}" loading="lazy" decoding="async">`:''}<span>${isIg?'IG':isVideo?'VID':i+1}</span></button>`;
        }).join(''):'';
        host.innerHTML=`<div class="docs-detail-stage">${renderMediaItem(primary,caption,resolvedIndex,'docs-detail-primary',true)}</div>${thumbs?`<div class="docs-detail-bubbles">${thumbs}</div>`:''}`;
      }
    }
    panel?.classList.add('open');panel?.setAttribute('aria-hidden','false');
    renderTimeline();centerIndex(index);
  }
  function closeDetail(){selected=-1;detailMediaIndex=0;$('#docsEventPanel')?.classList.remove('open');$('#docsEventPanel')?.setAttribute('aria-hidden','true');renderTimeline()}
  function navEvent(dir){
    if(selected<0||!layout)return;
    const sorted=layout.points.filter(p=>activeFilters.has(p.cat)&&matchesVisible(docs[p.index])).slice().sort((a,b)=>a.t-b.t);const at=sorted.findIndex(p=>p.index===selected);if(at<0)return;const next=sorted[clamp(at+dir,0,sorted.length-1)];if(next)renderDetail(next.index)
  }

  function bindOnce(){
    const vp=viewport();if(!vp||vp.dataset.orbitaTimelineBound)return;vp.dataset.orbitaTimelineBound='1';
    vp.addEventListener('wheel',e=>{
      e.preventDefault();
      // Arah seperti kamera: scroll ke depan/atas = zoom in, scroll ke belakang/bawah = zoom out.
      // deltaY negatif = roda didorong ke depan. Lokasi pointer menjadi titik fokus zoom.
      let raw=e.deltaY;
      if(!raw&&e.deltaX)raw=e.deltaX;
      if(!raw)return;
      const modeScale=e.deltaMode===1?18:e.deltaMode===2?120:1;
      raw=clamp(raw*modeScale,-240,240);
      const sensitivity=e.ctrlKey?.0019:.00145;
      const factor=Math.exp(-raw*sensitivity);
      queueZoom(zoomTarget*factor,e.clientX);
    },{passive:false});
    const stopInertia=()=>{if(inertiaRaf){cancelAnimationFrame(inertiaRaf);inertiaRaf=0}};
    vp.addEventListener('pointerdown',e=>{
      if(e.button!==0)return;
      if(e.target.closest('button,a,input,select,textarea,iframe,[data-doc-event],[data-doc-cluster]'))return;
      stopInertia();
      drag={x:e.clientX,left:vp.scrollLeft,id:e.pointerId,moved:false,lastX:e.clientX,lastT:performance.now(),velocity:0};
      vp.setPointerCapture?.(e.pointerId);
      vp.classList.add('dragging');
    });
    vp.addEventListener('pointermove',e=>{
      updateHoverPlayhead(e.clientX,{sticky:true});
      if(!drag)return;
      const now=performance.now(),dx=e.clientX-drag.x,dt=Math.max(8,now-drag.lastT),step=e.clientX-drag.lastX;
      if(Math.abs(dx)>3)drag.moved=true;
      vp.scrollLeft=drag.left-dx;
      drag.velocity=(-step/dt)*16.67;
      drag.lastX=e.clientX;drag.lastT=now;
      updateHoverPlayhead(e.clientX,{sticky:true});
    });
    const end=e=>{
      if(!drag)return;
      const velocity=drag.velocity||0;
      try{vp.releasePointerCapture?.(drag.id)}catch{}
      drag=null;
      vp.classList.remove('dragging');
      if(Math.abs(velocity)>.35){
        let v=velocity;
        const glide=()=>{vp.scrollLeft+=v;v*=.92;if(Math.abs(v)>.12)inertiaRaf=requestAnimationFrame(glide);else inertiaRaf=0};
        inertiaRaf=requestAnimationFrame(glide);
      }
    };
    vp.addEventListener('pointerup',end);
    vp.addEventListener('pointercancel',end);
    vp.addEventListener('pointerenter',e=>updateHoverPlayhead(e.clientX,{sticky:true}));
    vp.addEventListener('pointerleave',()=>clearHoverPlayhead());
    vp.addEventListener('keydown',e=>{if(e.key==='ArrowRight'){vp.scrollBy({left:220,behavior:reduced?'auto':'smooth'});e.preventDefault()}else if(e.key==='ArrowLeft'){vp.scrollBy({left:-220,behavior:reduced?'auto':'smooth'});e.preventDefault()}else if(e.key==='+'||e.key==='='){queueZoom(zoomTarget*1.2);e.preventDefault()}else if(e.key==='-'){queueZoom(zoomTarget/1.2);e.preventDefault()}else if(e.key==='Home'){vp.scrollTo({left:0,behavior:'smooth'});e.preventDefault()}else if(e.key==='End'){vp.scrollTo({left:vp.scrollWidth,behavior:'smooth'});e.preventDefault()}});
    archive()?.addEventListener('click',e=>{const event=e.target.closest('[data-doc-event]');if(event){renderDetail(Number(event.dataset.docEvent));return}const cluster=e.target.closest('[data-doc-cluster]');if(cluster){const ids=cluster.dataset.docCluster.split(',').map(Number).filter(Number.isFinite);if(!ids.length)return;const p=layout.points.find(x=>x.index===ids[0]);if(zoom<3.8){const rect=vp.getBoundingClientRect(),clientX=rect.left+(p?.x||0)-vp.scrollLeft;queueZoom(Math.min(4.5,zoomTarget*1.55),clientX);requestAnimationFrame(()=>centerIndex(ids[Math.floor(ids.length/2)],false))}else renderDetail(ids[0])}});
    $('#docsTimelineFilters')?.addEventListener('click',e=>{const b=e.target.closest('[data-doc-filter]');if(b){const c=b.dataset.docFilter;if(activeFilters.has(c)&&activeFilters.size>1)activeFilters.delete(c);else activeFilters.add(c);renderTimeline();return}if(e.target.closest('[data-doc-reset]')){activeFilters=new Set(categories());searchQuery='';yearFrom='';yearTo='';monthFilter='';const input=$('#docsSearchInput');if(input)input.value='';const yf=$('#docsYearFrom'),yt=$('#docsYearTo'),mf=$('#docsMonthFilter');if(yf)yf.value='';if(yt)yt.value='';if(mf)mf.value='';fit()}});
    const search=$('#docsSearchInput');
    if(search&&!search.dataset.bound){
      search.dataset.bound='1';
      let timer=0;
      const apply=()=>{searchQuery=search.value.trim();renderTimeline();};
      search.addEventListener('input',()=>{clearTimeout(timer);timer=setTimeout(apply,110)});
      search.addEventListener('keydown',e=>{if(e.key==='Escape'){search.value='';searchQuery='';renderTimeline();search.blur()}else if(e.key==='Enter'){clearTimeout(timer);apply();e.preventDefault()}});
      $('#docsSearchClear')?.addEventListener('click',()=>{search.value='';searchQuery='';renderTimeline();search.focus()});
    }
    const bindYear=(id,key)=>{
      const el=$(id);if(!el||el.dataset.bound)return;el.dataset.bound='1';
      let timer=0;
      const apply=()=>{const raw=String(el.value||'').trim();const val=raw?String(Math.trunc(Number(raw))):'';if(key==='from')yearFrom=val;else yearTo=val;renderTimeline();};
      el.addEventListener('input',()=>{clearTimeout(timer);timer=setTimeout(apply,120)});
      el.addEventListener('change',apply);
      el.addEventListener('keydown',e=>{if(e.key==='Enter'){clearTimeout(timer);apply();el.blur()}else if(e.key==='Escape'){el.value='';if(key==='from')yearFrom='';else yearTo='';renderTimeline();el.blur()}});
    };
    bindYear('#docsYearFrom','from');bindYear('#docsYearTo','to');
    const month=$('#docsMonthFilter');
    if(month&&!month.dataset.bound){
      month.dataset.bound='1';
      month.addEventListener('change',()=>{monthFilter=String(month.value||'');renderTimeline();});
    }
    const bindZoom=(id,fn)=>{
      const btn=$(id);
      if(!btn||btn.dataset.zoomBound)return;
      btn.dataset.zoomBound='1';
      btn.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();fn();});
    };
    bindZoom('#docsZoomIn',()=>queueZoom(zoomTarget*1.28));
    bindZoom('#docsZoomOut',()=>queueZoom(zoomTarget/1.28));
    bindZoom('#docsZoomFit',fit);
    vp.addEventListener('dblclick',e=>{
      if(e.target.closest('[data-doc-event],[data-doc-cluster]'))return;
      e.preventDefault();
      queueZoom(zoomTarget<2.2?zoomTarget*1.45:1,e.clientX);
    });
    $('#docsEventClose')?.addEventListener('click',closeDetail);$('#docsPrevEvent')?.addEventListener('click',()=>navEvent(-1));$('#docsNextEvent')?.addEventListener('click',()=>navEvent(1));
    $('#docsMediaStream')?.addEventListener('click',e=>{
      const picker=e.target.closest('[data-doc-media-pick]');
      if(picker){renderDetail(selected,Number(picker.dataset.docMediaPick));return}
      const b=e.target.closest('.docs-detail-primary[data-doc-image]');
      if(b)openImage(b.dataset.docImage,b.dataset.caption);
    });
    addEventListener('resize',()=>{const old=layout;renderTimeline();if(selected>=0)centerIndex(selected,false);else if(old&&vp.scrollWidth)vp.scrollLeft=clamp(vp.scrollLeft,0,Math.max(0,vp.scrollWidth-vp.clientWidth))},{passive:true});
  }

  function render(nextDocs){
    docs=Array.isArray(nextDocs)&&nextDocs.length?nextDocs:[{id:'fallback',date:'',title:'Dokumentasi PBJ',location:'Kota Bogor',category:'Pendampingan & Konsultasi',description:'Dokumentasi kegiatan Pengadaan Barang/Jasa Kota Bogor.',photo:'../assets/img/LOGOPBJ.png',media:[]}];
    const catSet=new Set(categories());activeFilters=new Set([...activeFilters].filter(c=>catSet.has(c)));if(!activeFilters.size)categories().forEach(c=>activeFilters.add(c));
    zoomTarget=zoom;bindOnce();renderTimeline();
  }

  function unifiedRows(detail={}){
    const site=detail.siteContent||window.TRAXPBJ_SITE_CONTENT||{};
    const advocacy=detail.advocacy||window.TRAXPBJ_ADVOCACY||{};
    const remote=detail.remote||window.TRAXPBJ_REMOTE_BOOTSTRAP||{};
    const documentation=Array.isArray(site.documentation)?site.documentation:[];
    const agenda=(Array.isArray(advocacy.events)?advocacy.events:[]).map(x=>({
      id:`agenda:${x.id||x.date||x.title||Math.random()}`,
      date:x.date||'',
      title:x.title||'Agenda Kegiatan PBJ',
      location:x.place||'Kota Bogor',
      category:'Agenda',
      description:[x.summary||'',x.time?`Waktu ${x.time}`:'',x.status==='upcoming'?'Akan datang':x.status==='done'?'Sudah dilaksanakan':x.status||''].filter(Boolean).join(' · '),
      type:x.type||'Kegiatan',status:x.status||'',time:x.time||'',extraSearch:[x.type,x.status,x.time].filter(Boolean).join(' '),
      documentUrl:x.documentUrl||'',materialUrl:x.materialUrl||'',sourceKind:'agenda',media:[]
    }));
    const suratSource=Array.isArray(site.suratPBJ)?site.suratPBJ:(Array.isArray(remote.suratPBJ)?remote.suratPBJ:[]);
    const surat=suratSource.map(x=>({
      id:`surat:${x.id||x.fileId||x.fileName||Math.random()}`,
      date:x.date||x.modifiedAt||'',
      title:x.title||x.fileName||'Surat PBJ',
      location:x.type||'Produk Surat PBJ',
      category:'Surat PBJ',
      description:[x.number?`Nomor ${x.number}`:'',x.fileName||''].filter(Boolean).join(' · '),
      type:x.type||'Surat PBJ',number:x.number||'',fileName:x.fileName||'',fileId:x.fileId||'',mimeType:x.mimeType||'',extraSearch:[x.number,x.type,x.fileName].filter(Boolean).join(' '),
      actionUrl:x.url||'',actionLabel:'Buka surat',sourceKind:'surat',media:[]
    }));
    return [...documentation.map(x=>({...x,sourceKind:x.sourceKind||'documentation'})),...agenda,...surat];
  }
  function activate(){
    bindOnce();renderTimeline();
    const modal=$('#docsModal');
    if(modal&&!introPlayed){introPlayed=true;modal.classList.remove('docs-intro-running');void modal.offsetWidth;modal.classList.add('docs-intro-running');setTimeout(()=>modal.classList.remove('docs-intro-running'),2400)}
    if(!initialized){initialized=true;requestAnimationFrame(()=>{const vp=viewport();const latest=layout?.points.slice().sort((a,b)=>b.t-a.t)[0];if(vp&&latest)vp.scrollLeft=Math.max(0,latest.x-vp.clientWidth*.72)})}
  }

  window.ORBITA_DOCS_TIMELINE={render,activate,fit,setZoom};

  const syncFromContent=e=>{
    render(unifiedRows(e?.detail||{}));
  };
  document.addEventListener('trax:content-ready',syncFromContent);
  requestAnimationFrame(()=>syncFromContent());
  const docsModal=$('#docsModal');
  if(docsModal&&'MutationObserver'in window){
    let wasOpen=docsModal.classList.contains('open');
    new MutationObserver(()=>{
      const isOpen=docsModal.classList.contains('open');
      if(isOpen&&!wasOpen)requestAnimationFrame(activate);
      wasOpen=isOpen;
    }).observe(docsModal,{attributes:true,attributeFilter:['class']});
    if(wasOpen)requestAnimationFrame(activate);
  }
})();
