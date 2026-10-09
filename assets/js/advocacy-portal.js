(() => {
  'use strict';
  const $=(s,c=document)=>c.querySelector(s);
  const $$=(s,c=document)=>[...c.querySelectorAll(s)];
  const escapeHTML=value=>String(value??'').replace(/[&<>'"]/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':'&quot;'}[ch]));
  const fmtDate=value=>{if(!value)return 'Tanggal belum ditetapkan'; const d=new Date(value+'T00:00:00'); return new Intl.DateTimeFormat('id-ID',{day:'2-digit',month:'long',year:'numeric'}).format(d)};
  const nowYmd=()=>new Date().toLocaleDateString('en-CA');
  let data=window.TRAXPBJ_ADVOCACY||{events:[],knowledge:[]};
  let activePanel='';

  const panels={events:$('#educationExperience'),knowledge:$('#knowledgeExperience')};
  function openPanel(key,fromPop=false){
    const panel=panels[key]; if(!panel)return;
    activePanel=key;
    panel.classList.add('open'); panel.setAttribute('aria-hidden','false');
    document.body.classList.add('advocacy-panel-open');
    renderAll();
    const hash=key==='events'?'#kegiatan-pbj':'#pengetahuan-pbj';
    if(!fromPop&&location.hash!==hash)history.pushState({traxPanel:key,fromTopbar:window.TRAXPBJ_CONSUME_TOPBAR_ENTRY?.()===true},'',location.pathname+location.search+hash);
  }
  function closePanel(fromPop=false){
    if(!activePanel)return;
    const panel=panels[activePanel]; panel?.classList.remove('open'); panel?.setAttribute('aria-hidden','true');
    document.body.classList.remove('advocacy-panel-open');activePanel='';
    if(!fromPop&&['#kegiatan-pbj','#pengetahuan-pbj'].includes(location.hash)){if((history.state?.fromTopbar||window.TRAXPBJ_SHOULD_RETURN_PROFILE_HOME?.(location.hash))&&window.TRAXPBJ_RETURN_PROFILE_HOME){window.TRAXPBJ_RETURN_PROFILE_HOME();return;}history.back();return;}
  }

  function renderEvents(){
    const host=$('#educationList'); if(!host)return;
    const filter=$('#educationFilter')?.value||'all';
    const q=($('#educationSearch')?.value||'').trim().toLowerCase();
    const today=nowYmd();
    const items=(data.events||[]).map(x=>({...x,_future:(x.status==='upcoming'||x.status==='Akan datang'||x.date>=today)}))
      .filter(x=>filter==='all'||(filter==='upcoming'?x._future:!x._future))
      .filter(x=>!q||[x.title,x.type,x.place,x.summary].join(' ').toLowerCase().includes(q))
      .sort((a,b)=>{if(filter==='done')return String(b.date).localeCompare(String(a.date));if(filter==='upcoming')return String(a.date).localeCompare(String(b.date));if(a._future!==b._future)return a._future?-1:1;return a._future?String(a.date).localeCompare(String(b.date)):String(b.date).localeCompare(String(a.date))});
    const next=(data.events||[]).filter(x=>x.status==='upcoming'||x.status==='Akan datang'||x.date>=today).sort((a,b)=>String(a.date).localeCompare(String(b.date)))[0];
    const feature=$('#educationFeature');
    if(feature){feature.innerHTML=next?`<div class="education-feature-date"><small>AGENDA TERDEKAT</small><strong>${escapeHTML(fmtDate(next.date).split(' ')[0])}</strong><span>${escapeHTML(fmtDate(next.date).split(' ').slice(1).join(' '))}</span></div><div class="education-feature-copy"><span>${escapeHTML(next.type)}</span><h3>${escapeHTML(next.title)}</h3><p>${escapeHTML(next.summary||'')}</p><div><b>${escapeHTML(next.time||'')}</b><b>${escapeHTML(next.place||'')}</b></div></div>`:'<div class="advocacy-empty"><b>Belum ada agenda terdekat.</b></div>'}
    $('#educationCount').textContent=`${items.length} kegiatan`;
    host.innerHTML=items.length?items.map((x,i)=>{const actions=[x.documentUrl?`<a href="${escapeHTML(x.documentUrl)}" target="_blank" rel="noopener noreferrer">Buka dokumen ↗</a>`:'',x.materialUrl?`<a href="${escapeHTML(x.materialUrl)}" target="_blank" rel="noopener noreferrer">Materi ↗</a>`:''].filter(Boolean).join('');return `<article class="education-card" style="--i:${i}"><div class="education-card-index">${String(i+1).padStart(2,'0')}</div><div><span class="education-type">${escapeHTML(x.type)}</span><h3>${escapeHTML(x.title)}</h3><p>${escapeHTML(x.summary||'')}</p><div class="education-card-meta"><b>${escapeHTML(fmtDate(x.date))}</b><span>${escapeHTML(x.place||'')}</span></div></div>${actions?`<div class="education-card-actions">${actions}</div>`:`<span class="education-state">${x._future?'Akan datang':'Selesai'}</span>`}</article>`}).join(''):'<div class="advocacy-empty"><b>Belum ada kegiatan.</b></div>';
  }

  function renderKnowledge(){
    const host=$('#knowledgeList'); if(!host)return;
    const q=($('#knowledgeSearch')?.value||'').trim().toLowerCase();
    const category=$('#knowledgeCategory')?.value||'all';
    const allKnowledge=data.knowledge||[];
    const categoryCounts=allKnowledge.reduce((acc,x)=>{const k=x.category||'Lainnya';acc[k]=(acc[k]||0)+1;return acc;},{});
    $$('[data-knowledge-quick]').forEach(btn=>{btn.dataset.count=String(categoryCounts[btn.dataset.knowledgeQuick]||0)});
    const items=allKnowledge.filter(x=>category==='all'||x.category===category).filter(x=>!q||[x.title,x.category,x.summary,x.year].join(' ').toLowerCase().includes(q));
    $('#knowledgeCount').textContent=`${items.length} dokumen`;
    host.innerHTML=items.length?items.map((x,i)=>`<article class="knowledge-card" style="--i:${i}"><div class="knowledge-icon"><span></span><span></span><span></span></div><div class="knowledge-card-copy"><div><span>${escapeHTML(x.category)}</span><b>${escapeHTML(x.year||'')}</b></div><h3>${escapeHTML(x.title)}</h3><p>${escapeHTML(x.summary||'')}</p></div>${x.url?`<a href="${escapeHTML(x.url)}" target="_blank" rel="noopener noreferrer">Buka dokumen <span>↗</span></a>`:`<button type="button" disabled>Belum ditautkan</button>`}</article>`).join(''):'<div class="advocacy-empty"><b>Dokumen tidak ditemukan.</b></div>';
  }
  const renderAll=()=>{renderEvents();renderKnowledge()};

  $('#educationSearch')?.addEventListener('input',renderEvents);
  $('#educationFilter')?.addEventListener('change',renderEvents);
  $$('[data-knowledge-quick]').forEach(btn=>btn.addEventListener('click',()=>{
    const select=$('#knowledgeCategory'); if(select)select.value=btn.dataset.knowledgeQuick||'all';
    $$('[data-knowledge-quick]').forEach(x=>x.classList.toggle('active',x===btn));
    renderKnowledge();
  }));
  $('#knowledgeSearch')?.addEventListener('input',renderKnowledge);
  $('#knowledgeCategory')?.addEventListener('change',renderKnowledge);
  $$('[data-close-advocacy]').forEach(x=>x.addEventListener('click',()=>closePanel(false)));
  window.TRAXPBJ_ADVOCACY_PORTAL={open:(panel='events')=>openPanel(panel,false),close:()=>closePanel(false)};
  document.addEventListener('trax:open-advocacy',e=>openPanel(e.detail?.panel||'events'));
  document.addEventListener('trax:content-ready',e=>{data=e.detail?.advocacy||data;renderAll();});
  window.addEventListener('popstate',()=>{const hash=location.hash;if(hash==='#kegiatan-pbj')openPanel('events',true);else if(hash==='#pengetahuan-pbj')openPanel('knowledge',true);else closePanel(true);});
  renderAll();
  if(location.hash==='#kegiatan-pbj')requestAnimationFrame(()=>openPanel('events',true));
  if(location.hash==='#pengetahuan-pbj')requestAnimationFrame(()=>openPanel('knowledge',true));
})();
