(() => {
  'use strict';
  const DB = window.PBJ_WORLD_DATA || {years:{},methods:[],methodDetails:{},sdm2026:{}};
  const $ = (s, c=document) => c.querySelector(s);
  const $$ = (s, c=document) => [...c.querySelectorAll(s)];
  const idNum = new Intl.NumberFormat('id-ID');
  const idPct = new Intl.NumberFormat('id-ID',{maximumFractionDigits:1});
  const idPct2 = new Intl.NumberFormat('id-ID',{minimumFractionDigits:0,maximumFractionDigits:2});

  const rupiahFull = n => `Rp ${idNum.format(Math.round(Number(n)||0))}`;
  const rupiahCompact = n => {
    n=Number(n)||0;
    const a=Math.abs(n);
    if(a>=1e12) return `Rp ${idPct.format(n/1e12)} T`;
    if(a>=1e9) return `Rp ${idPct.format(n/1e9)} M`;
    if(a>=1e6) return `Rp ${idPct.format(n/1e6)} Jt`;
    return rupiahFull(n);
  };
  const slugify = s => s.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
  const methodBySlug = slug => DB.methods.find(m => slugify(m)===slug);

  // reveal
  const io = new IntersectionObserver(entries => entries.forEach(e => { if(e.isIntersecting) e.target.classList.add('in-view'); }), {threshold:.12});
  $$('.reveal').forEach(el=>io.observe(el));

  // progress + chapter state
  const chapterButton=$('#chapterButton');
  const scenes=$$('.scene[data-chapter]');
  const dockLinks=$$('.chapter-dock a');
  const mainNavLinks=$$('.main-nav [data-main-chapter]');
  const topDropdowns=$$('[data-top-dropdown]');
  const topbar=$('.topbar');
  let topbarEntryAt=0;
  const TOPBAR_RETURN_KEY='orbita:topbar-return';
  const topbarTargetFor=(kind,action)=>{
    if(kind==='control')return '#pengelolaan-pbj';
    return ({evaluation:'#evaluasi-layanan',documentation:'#dokumentasi-pendampingan',sdm:'#sdm-pbj',forum:'#konsultasi-pbj','advocacy-events':'#kegiatan-pbj','advocacy-knowledge':'#pengetahuan-pbj'})[action]||'';
  };
  const topbarBackSelectorFor=(kind,action)=>{
    if(kind==='control')return '[data-close-procurement]';
    return ({
      evaluation:'[data-close-evaluation]',
      documentation:'[data-close-docs]',
      sdm:'[data-close-sdm]',
      forum:'[data-close-forum]',
      'advocacy-events':'#educationExperience [data-close-advocacy]',
      'advocacy-knowledge':'#knowledgeExperience [data-close-advocacy]'
    })[action]||'';
  };
  const disarmTopbarBack=(kind,action)=>{const sel=topbarBackSelectorFor(kind,action);if(!sel)return;document.querySelectorAll(sel).forEach(btn=>btn.removeAttribute('data-orbita-force-profile-home'));};
  const armTopbarBack=(kind,action)=>{
    const sel=topbarBackSelectorFor(kind,action);if(!sel)return;
    document.querySelectorAll(sel).forEach(btn=>btn.setAttribute('data-orbita-force-profile-home','1'));
  };
  const hardReturnProfileHome=()=>{
    try{sessionStorage.removeItem(TOPBAR_RETURN_KEY);}catch(_){}
    window.__ORBITA_TOPBAR_RETURN_TARGET='';window.__ORBITA_PENDING_TOPBAR_ENTRY=false;window.__ORBITA_TOPBAR_ENTRY_AT=0;
    history.replaceState({traxProfileHome:true},'',location.pathname+location.search+'#home');
    location.reload();
  };
  document.addEventListener('click',e=>{
    const back=e.target.closest('[data-orbita-force-profile-home="1"]');if(!back)return;
    e.preventDefault();e.stopImmediatePropagation();hardReturnProfileHome();
  },true);
  const rememberTopbarTarget=target=>{
    if(!target)return;
    try{sessionStorage.setItem(TOPBAR_RETURN_KEY,JSON.stringify({target,at:Date.now()}));}catch(_){window.__ORBITA_TOPBAR_RETURN_TARGET=target;}
  };
  const readTopbarTarget=()=>{
    let data=null;
    try{data=JSON.parse(sessionStorage.getItem(TOPBAR_RETURN_KEY)||'null');}catch(_){data=null;}
    if(data?.at&&Date.now()-Number(data.at)>6*60*60*1000){try{sessionStorage.removeItem(TOPBAR_RETURN_KEY);}catch(_){};data=null;}
    return data?.target||window.__ORBITA_TOPBAR_RETURN_TARGET||'';
  };
  const clearTopbarTarget=()=>{try{sessionStorage.removeItem(TOPBAR_RETURN_KEY);}catch(_){};window.__ORBITA_TOPBAR_RETURN_TARGET='';};
  const markTopbarEntry=target=>{topbarEntryAt=Date.now();window.__ORBITA_TOPBAR_ENTRY_AT=topbarEntryAt;window.__ORBITA_PENDING_TOPBAR_ENTRY=true;rememberTopbarTarget(target);};
  window.TRAXPBJ_IS_TOPBAR_ENTRY=()=>window.__ORBITA_PENDING_TOPBAR_ENTRY===true||Date.now()-Number(window.__ORBITA_TOPBAR_ENTRY_AT||0)<1200;
  window.TRAXPBJ_CONSUME_TOPBAR_ENTRY=()=>{const fromTopbar=window.TRAXPBJ_IS_TOPBAR_ENTRY?.()===true;window.__ORBITA_PENDING_TOPBAR_ENTRY=false;window.__ORBITA_TOPBAR_ENTRY_AT=0;return fromTopbar;};
  window.TRAXPBJ_SHOULD_RETURN_PROFILE_HOME=(target=location.hash)=>readTopbarTarget()===target;
  addEventListener('popstate',()=>{const target=readTopbarTarget();if(target&&location.hash!==target)clearTopbarTarget();});
  window.TRAXPBJ_RETURN_PROFILE_HOME=(smooth=true)=>{
    clearTopbarTarget();
    window.__ORBITA_PENDING_TOPBAR_ENTRY=false;window.__ORBITA_TOPBAR_ENTRY_AT=0;
    history.replaceState({traxProfileHome:true},'',location.pathname+location.search+'#home');
    window.scrollTo({top:0,behavior:smooth?'smooth':'auto'});
    document.body.classList.remove('topnav-destination-active');
    requestAnimationFrame(()=>{syncTopbarDestination();setChapterFromHash();});
  };
  const syncTopbarDestination=()=>{const threshold=Math.max(170,Math.min(360,innerHeight*.34));document.body.classList.toggle('topnav-destination-active',scrollY>threshold);};
  let topDropdownCloseTimer=0;
  const syncTopbarNavState=()=>topbar?.classList.toggle('nav-open',topDropdowns.some(el=>el.classList.contains('open')));
  const closeTopDropdowns=except=>{clearTimeout(topDropdownCloseTimer);topDropdowns.forEach(el=>{if(el!==except)el.classList.remove('open')});syncTopbarNavState()};
  const openTopDropdown=item=>{if(!item)return;clearTimeout(topDropdownCloseTimer);closeTopDropdowns(item);item.classList.add('open');syncTopbarNavState()};
  const scheduleTopDropdownClose=item=>{clearTimeout(topDropdownCloseTimer);topDropdownCloseTimer=setTimeout(()=>{item?.classList.remove('open');syncTopbarNavState()},260)};
  topDropdowns.forEach(item=>{
    item.addEventListener('pointerenter',()=>openTopDropdown(item));
    item.addEventListener('pointerleave',()=>scheduleTopDropdownClose(item));
    item.querySelector('.main-nav-dropdown')?.addEventListener('pointerenter',()=>{clearTimeout(topDropdownCloseTimer);openTopDropdown(item)});
  });
  $$('.main-nav-item>.main-nav-trigger').forEach(trigger=>trigger.addEventListener('click',e=>{
    const item=trigger.closest('[data-top-dropdown]');
    if(!item)return;
    if(trigger.tagName==='BUTTON'){
      e.preventDefault();
      const open=!item.classList.contains('open');
      if(open)openTopDropdown(item);else{item.classList.remove('open');syncTopbarNavState()}
    }else closeTopDropdowns();
  }));
  document.addEventListener('click',e=>{if(!e.target.closest('[data-top-dropdown]'))closeTopDropdowns()});
  document.addEventListener('keydown',e=>{if(e.key==='Escape')closeTopDropdowns()});
  document.addEventListener('click',e=>{
    const control=e.target.closest('[data-top-control]');
    if(control){const action=control.dataset.topControl||'overview';e.preventDefault();markTopbarEntry(topbarTargetFor('control',action));armTopbarBack('control',action);closeTopDropdowns();document.dispatchEvent(new CustomEvent('trax:open-control-room',{detail:{module:action}}));return;}
    const service=e.target.closest('[data-top-service]');
    if(!service)return;
    const action=service.dataset.topService;
    e.preventDefault();markTopbarEntry(topbarTargetFor('service',action));armTopbarBack('service',action);closeTopDropdowns();
    if(action==='evaluation'){document.dispatchEvent(new CustomEvent('trax:open-evaluation'));return;}
    if(action==='documentation'){openDocs();return;}
    if(action==='sdm'){openSdm();return;}
    if(action==='forum'){window.TRAXPBJ_FORUM?.open(false);return;}
    if(action==='advocacy-events'){if(window.TRAXPBJ_ADVOCACY_PORTAL?.open)window.TRAXPBJ_ADVOCACY_PORTAL.open('events');else document.dispatchEvent(new CustomEvent('trax:open-advocacy',{detail:{panel:'events'}}));return;}
    if(action==='advocacy-knowledge'){if(window.TRAXPBJ_ADVOCACY_PORTAL?.open)window.TRAXPBJ_ADVOCACY_PORTAL.open('knowledge');else document.dispatchEvent(new CustomEvent('trax:open-advocacy',{detail:{panel:'knowledge'}}));}
  });
  const mobileQuickTrigger=document.querySelector('[data-mobile-quick]');
  const mobileQuickMenu=document.getElementById('mobileQuickMenu');
  const setMobileQuickOpen=open=>{
    if(!mobileQuickTrigger||!mobileQuickMenu)return;
    mobileQuickTrigger.setAttribute('aria-expanded',open?'true':'false');
    mobileQuickMenu.setAttribute('aria-hidden',open?'false':'true');
    mobileQuickMenu.classList.toggle('open',open);
  };
  mobileQuickTrigger?.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();setMobileQuickOpen(!mobileQuickMenu?.classList.contains('open'))});
  document.addEventListener('click',e=>{if(mobileQuickMenu?.classList.contains('open')&&!e.target.closest('.mobile-quick-menu')&&!e.target.closest('[data-mobile-quick]'))setMobileQuickOpen(false)});
  mobileQuickMenu?.addEventListener('click',()=>setMobileQuickOpen(false));

  const profileNav=$('#profileNav');
  const profileNavButton=$('#profileNavButton');
  const profileNavMenu=$('#profileNavMenu');
  const setProfileNavOpen=(open)=>{
    profileNav?.classList.toggle('open',open);
    profileNavButton?.setAttribute('aria-expanded',open?'true':'false');
    profileNavMenu?.setAttribute('aria-hidden',open?'false':'true');
  };
  profileNavButton?.addEventListener('click',e=>{e.stopPropagation();setProfileNavOpen(!profileNav?.classList.contains('open'));});
  profileNavMenu?.querySelectorAll('a').forEach(a=>a.addEventListener('click',()=>setProfileNavOpen(false)));
  document.addEventListener('click',e=>{if(profileNav&&!profileNav.contains(e.target))setProfileNavOpen(false);});
  document.addEventListener('keydown',e=>{if(e.key==='Escape')setProfileNavOpen(false);});
  const setChapter=(no,title)=>{
    if(chapterButton){chapterButton.querySelector('span').textContent=no;chapterButton.querySelector('b').textContent=title;}
    dockLinks.forEach(a=>a.classList.toggle('active',a.dataset.chapter===no));
    mainNavLinks.forEach(a=>a.classList.toggle('active',a.dataset.mainChapter===no));
    if(innerWidth<=980){
      const mobileNav=document.querySelector('.mobile-inline-nav');
      const mobileActive=mobileNav?.querySelector('[data-main-chapter="'+no+'"]');
      if(mobileNav&&mobileActive){
        const target=Math.max(0,mobileActive.offsetLeft-(mobileNav.clientWidth-mobileActive.offsetWidth)/2);
        if(Math.abs(mobileNav.scrollLeft-target)>8)mobileNav.scrollTo({left:target,behavior:'auto'});
      }
    }
    profileNav?.classList.toggle('active',no==='06'||no==='07');
    document.body.classList.remove('orbita-dark-chapter');
    document.body.classList.toggle('orbita-room-chapter',no==='02');
    document.body.classList.toggle('orbita-home-chapter',no==='01');
    document.body.classList.toggle('orbita-content-chapter',no!=='01'&&no!=='02');
  };
  const updateChapterState=()=>{
    const probe=Math.min(innerHeight-1,Math.max(90,(document.querySelector('.topbar')?.getBoundingClientRect().bottom||76)+28));
    let active=scenes[0]||null;
    for(const scene of scenes){const r=scene.getBoundingClientRect();if(r.top<=probe&&r.bottom>probe){active=scene;break;}if(r.top<=probe)active=scene;}
    if(active)setChapter(active.dataset.chapter,active.dataset.title);
  };
  const setChapterFromHash=()=>{const el=location.hash?document.querySelector(location.hash):null;if(el?.dataset?.chapter)setChapter(el.dataset.chapter,el.dataset.title);else updateChapterState();};
  addEventListener('hashchange',()=>{syncTopbarDestination();setChapterFromHash();setTimeout(updateChapterState,500)});
  syncTopbarDestination();
  const chapterMenu=$('#chapterMenu');
  const setMenuOpen=open=>{
    document.body.classList.toggle('chapter-menu-open',open);
    chapterMenu?.classList.toggle('open',open);
    chapterMenu?.setAttribute('aria-hidden',open?'false':'true');
    chapterButton?.setAttribute('aria-expanded',open?'true':'false');
  };
  chapterButton?.addEventListener('click',()=>setMenuOpen(!chapterMenu?.classList.contains('open')));
  $$('#chapterMenu a').forEach(a=>a.addEventListener('click',()=>setMenuOpen(false)));
  addEventListener('keydown',e=>{if(e.key==='Escape')setMenuOpen(false)});
  const backToTop=$('#backToTop');
  const onScroll=()=>{
    const max=Math.max(1,document.documentElement.scrollHeight-innerHeight);
    const pct=Math.max(0,Math.min(100,(scrollY/max)*100));
    const progress=$('#scrollProgress');if(progress)progress.style.width=`${pct}%`;
    if(backToTop){backToTop.style.setProperty('--scroll-p',`${pct}%`);backToTop.classList.toggle('show',scrollY>innerHeight*.82);}
    syncTopbarDestination();
  };
  backToTop?.addEventListener('click',()=>{history.replaceState(history.state,'',location.pathname+location.search+'#home');window.scrollTo({top:0,behavior:'smooth'});});
  let scrollTick=false;
  const updateSceneMotion=()=>{ scenes.forEach(s=>{const r=s.getBoundingClientRect();const p=Math.max(-1,Math.min(1,(innerHeight/2-(r.top+r.height/2))/Math.max(innerHeight,r.height)));s.style.setProperty('--scene-shift',p.toFixed(3));}); scrollTick=false; };
  addEventListener('scroll',()=>{onScroll();updateChapterState();if(!scrollTick){scrollTick=true;requestAnimationFrame(updateSceneMotion)}},{passive:true}); onScroll(); updateSceneMotion(); setChapterFromHash();

  if(location.hash==='#pengantar') history.replaceState(history.state,'',location.pathname+location.search+'#home');

  // PBJ opening + universe interaction
  requestAnimationFrame(()=>document.body.classList.add('pbj-loaded'));

  const introScene=$('.pbj-intro');
  const universeScene=$('.pbj-universe-scene');
  const universeSticky=$('.pbj-universe-sticky');
  const universeCore=$('#pbjUniverseCore');
  const universeNodes=$$('.pbj-universe-node');
  const universeElements=$('#pbjUniverseElements');
  const universeSelected=$('#pbjUniverseSelected');
  const universeBack=$('#pbjUniverseBack');
  const universeHint=$('#pbjUniverseHint');
  const forceMobileUniverseReady=()=>{
    if(!universeSticky||innerWidth>980)return;
    universeSticky.style.setProperty('--universe-progress','.32');
    universeSticky.classList.add('is-formed','is-settled');
  };
  if(innerWidth<=980)requestAnimationFrame(forceMobileUniverseReady);
  addEventListener('hashchange',()=>{if(location.hash==='#ruang-pbj')requestAnimationFrame(forceMobileUniverseReady)});

  const universeData={
    lpse:{
      no:'01',title:'LPSE',tag:'LAYANAN ELEKTRONIK',
      leaderDefault:'Ketua Kelompok LPSE',
      items:[
        {title:'SPSE',action:'external',url:'https://spse.inaproc.id/kotabogor'},
        {title:'Helpdesk LPSE',action:'external',url:'https://helpdesklpse.kotabogor.go.id/'},
        {title:'SIPPBJ',action:'external',url:'https://sippbj.kotabogor.go.id/'},
        {title:'Dashboard Monitoring',action:'external',url:'https://pbjkotabogor.github.io/DASH-SIPPBJ/'},
        {title:'Evaluasi Pengguna Layanan',action:'evaluation'},
        {title:'Chat Konsultasi PBJ',action:'external',url:'https://wa.me/628151667956?text=Halo%20admin%20UKPBJ%20Kota%20Bogor%2C%20saya%20ingin%20bertanya%20terkait%20penggunaan%20portal.'}
      ]
    },
    advokasi:{
      no:'02',title:'Pembinaan & Advokasi',tag:'PENGUATAN KAPASITAS PBJ',leaderDefault:'Ketua Kelompok Pembinaan dan Advokasi',
      items:[{title:'SDM PBJ',action:'sdm'},{title:'Konsultasi & Pendampingan',action:'forum'},{title:'Edukasi & Kegiatan PBJ',action:'advocacy-events'},{title:'Pusat Pengetahuan PBJ',action:'advocacy-knowledge'},{title:'Dokumentasi',action:'documentation'}]
    },
    pengelolaan:{
      no:'03',title:'Pengelolaan PBJ',tag:'PERENCANAAN HINGGA REALISASI',leaderDefault:'Ketua Kelompok Pengelolaan PBJ',
      items:[{title:'Permohonan Pemilihan',action:'control-selection'},{title:'Capaian Pengadaan',action:'control-overview'},{title:'Monitoring Paket',action:'control-monitoring'},{title:'Ketepatan Pelaksanaan',action:'control-timing'},{title:'Perhatian & Tindak Lanjut',action:'control-alerts'}]
    }
  };

  const universePositions={
    4:[[18,30],[82,30],[18,70],[82,70]],
    5:[[18,22],[82,22],[18,60],[82,60],[50,82]],
    6:[[18,20],[82,20],[18,50],[82,50],[27,80],[73,80]],
    7:[[17,22],[83,22],[17,43],[83,43],[17,64],[83,64],[50,82]]
  };
  let adminContent=window.TRAXPBJ_ADMIN_CONTENT||{leaders:{}};
  let universeActive='';
  const leaderInitial=(key)=>key==='lpse'?'LPSE':key==='advokasi'?'P&A':'PBJ';
  const leaderFocus=$('#leaderFocus');
  const leaderFocusContinue=$('#leaderFocusContinue');
  let universePhase='idle';
  const leaderGroupLabel={lpse:'Layanan Pengadaan Secara Elektronik',advokasi:'Pembinaan dan Advokasi Pengadaan Barang/Jasa',pengelolaan:'Pengelolaan Pengadaan Barang/Jasa'};
  const renderUniverseLeader=(key)=>{
    const d=universeData[key]; if(!d)return;
    const leader=adminContent?.leaders?.[key]||{};
    const wrap=$('#universeLeader'), photo=$('#universeLeaderPhoto'), name=$('#universeLeaderName');
    if(wrap&&photo&&name){
      name.textContent=leader.name||d.leaderDefault;
      photo.innerHTML=leader.photo?`<img src="${leader.photo}" alt="${leader.name||d.leaderDefault}">`:`<span>${leaderInitial(key)}</span>`;
      wrap.classList.remove('show'); wrap.setAttribute('aria-hidden','true');
    }
    const fName=$('#leaderFocusName'), fGroup=$('#leaderFocusGroup'), fPhoto=$('#leaderFocusPhoto'), fNo=$('#leaderFocusNo'), fIndex=$('#leaderFocusIndex');
    if(fName)fName.textContent=leader.name||d.leaderDefault;
    if(fGroup)fGroup.textContent=leaderGroupLabel[key]||d.title;
    if(fNo)fNo.textContent=d.no;
    if(fIndex)fIndex.textContent=`${d.no} · KETUA KELOMPOK`;
    if(fPhoto){
      fPhoto.innerHTML=leader.photo?`<img src="${leader.photo}" alt="${leader.name||d.leaderDefault}">`:`<div class="leader-focus-placeholder"><img src="../assets/img/LOGOPBJ.png" alt=""><span>Foto Ketua Kelompok</span></div>`;
    }
    const bg=$('#universeLeaderBackground'), bgImage=$('#universeLeaderBackgroundImage');
    bg?.classList.remove('show','has-photo'); if(bgImage)bgImage.style.backgroundImage='';
    universeSticky?.classList.remove('has-leader-photo');
  };
  const hideUniverseLeader=()=>{
    const wrap=$('#universeLeader'); wrap?.classList.remove('show'); wrap?.setAttribute('aria-hidden','true');
    leaderFocus?.classList.remove('show'); leaderFocus?.setAttribute('aria-hidden','true');
    const bg=$('#universeLeaderBackground'); bg?.classList.remove('show','has-photo');
    const bgImage=$('#universeLeaderBackgroundImage'); if(bgImage) bgImage.style.backgroundImage='';
    universeSticky?.classList.remove('has-leader-photo');
  };

  const resetUniverse=()=>{
    universeActive=''; universePhase='idle';
    universeSticky?.classList.remove('has-selection','leader-first','service-open');
    universeSticky?.removeAttribute('data-active');
    universeNodes.forEach(n=>n.classList.remove('active','muted'));
    if(universeElements){ universeElements.innerHTML=''; universeElements.removeAttribute('data-count'); universeElements.classList.remove('show'); }
    universeSelected?.classList.remove('show');
    universeBack?.classList.remove('show');
    hideUniverseLeader();
    if(universeHint) universeHint.textContent='KLIK SALAH SATU';
  };

  const showUniverseServices=()=>{
    const key=universeActive, d=universeData[key]; if(!d||!universeSticky)return;
    universePhase='services';
    universeSticky.classList.remove('leader-first'); universeSticky.classList.add('service-open');
    leaderFocus?.classList.remove('show'); leaderFocus?.setAttribute('aria-hidden','true');
    $('#universeSelectedNo').textContent=d.no;
    $('#universeSelectedTitle').textContent=d.title;
    $('#universeSelectedTag').textContent=d.tag;
    if(universeElements){
      const positions=universePositions[d.items.length]||universePositions[4];
      universeElements.dataset.count=String(d.items.length);
      const rails=positions.map((pos,i)=>{
        const [x,y]=pos; const c1=x<50?38:(x>50?62:50); const c2=x<50?Math.min(43,x+9):(x>50?Math.max(57,x-9):50);
        const path=`M50 50 C${c1} 50 ${c2} ${y} ${x} ${y}`;
        return `<path d="${path}" pathLength="1" style="--i:${i}"></path>`;
      }).join('');
      const cards=d.items.map((item,i)=>{const pos=positions[i]||[50,50];return `<button type="button" style="--i:${i};--x:${pos[0]};--y:${pos[1]}" data-service-action="${item.action||''}" data-service-url="${item.url||''}"><b>${item.title}</b></button>`;}).join('');
      universeElements.innerHTML=`<svg class="pbj-service-connectors" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">${rails}</svg>${cards}`;
    }
    requestAnimationFrame(()=>requestAnimationFrame(()=>{universeSelected?.classList.add('show');universeBack?.classList.add('show');universeElements?.classList.add('show');}));
  };

  const selectUniverse=key=>{
    const d=universeData[key]; if(!d || !universeSticky) return;
    if(universeActive===key && universePhase==='services'){ resetUniverse(); return; }
    universeActive=key;
    universeSticky.classList.add('has-selection');
    universeSticky.classList.remove('leader-first');
    universeSticky.dataset.active=key;
    universeNodes.forEach(n=>{const on=n.dataset.universe===key;n.classList.toggle('active',on);n.classList.toggle('muted',!on);});
    universeSelected?.classList.remove('show');
    universeElements?.classList.remove('show');
    if(universeElements)universeElements.innerHTML='';
    if(universeHint) universeHint.textContent='';
    showUniverseServices();
  };

  const sdmExperience=$('#sdmExperience');
  const renderSdmExperience=()=>{
    const host=$('#sdmExperienceStage'); if(!host)return;
    const sdm=DB.sdm2026||{};
    const current=Number(sdm.realization||0), target=Number(sdm.target||0), pct=target?current/target*100:0;
    const targets=Object.fromEntries((sdm.targetBreakdown||[]).map(x=>[x.name,Number(x.value)||0]));
    const actuals=Object.fromEntries((sdm.realizationBreakdown||[]).map(x=>[x.name,Number(x.value)||0]));
    const names=Object.keys(targets);
    const dominant=Object.entries(actuals).sort((a,b)=>b[1]-a[1])[0]||['Belum ada data',0];
    const priority=Object.entries(targets).map(([name,t])=>[name,Math.max(0,t-(actuals[name]||0)),t]).sort((a,b)=>b[1]-a[1])[0]||['Belum ada data',0,0];
    host.innerHTML=`
      <div class="sdm-experience-gauge">
        <div class="sdm-experience-ring" style="--p:${Math.min(100,pct)}">
          <div><small>JF PPBJ</small><strong>${idNum.format(current)}</strong><span>dari ${idNum.format(target)}</span></div>
        </div>
        <div class="sdm-experience-mini"><div><small>PEMENUHAN</small><b>${idPct.format(pct)}%</b></div><div><small>KEBUTUHAN</small><b>${idNum.format(Math.max(0,target-current))}</b></div></div>
      </div>
      <div class="sdm-experience-bars">
        <div class="sdm-experience-title"><small>KOMPOSISI JF PPBJ</small><h3>Target dan kondisi saat ini</h3></div>
        ${names.map((name,i)=>{
          const t=targets[name]||0,a=actuals[name]||0,w=t?Math.min(100,a/t*100):0;
          return `<article style="--i:${i}"><div><span>${String(i+1).padStart(2,'0')}</span><b>${name}</b></div><div class="sdm-experience-track"><i style="--w:${w}%"></i></div><strong>${idNum.format(a)}<small>/ ${idNum.format(t)}</small></strong></article>`;
        }).join('')}
      </div>
      <div class="sdm-experience-types">
        <article>
          <span>01</span>
          <b>Rasio pemenuhan</b>
          <small>${idPct.format(pct)}% dari target formasi JF PPBJ sudah terpenuhi.</small>
          <i style="--w:${Math.min(100,pct)}%"></i>
        </article>
        <article>
          <span>02</span>
          <b>Jenjang dominan</b>
          <small>${dominant[0]} menjadi komposisi terbesar saat ini (${idNum.format(dominant[1])} orang).</small>
          <i style="--w:${Math.min(100,(dominant[1]/Math.max(current,1))*100)}%"></i>
        </article>
        <article>
          <span>03</span>
          <b>Prioritas penguatan</b>
          <small>${priority[0]} masih membutuhkan ${idNum.format(priority[1])} orang dari target ${idNum.format(priority[2])}.</small>
          <i style="--w:${Math.min(100,(Math.max(0,target-current)/Math.max(target,1))*100)}%"></i>
        </article>
      </div>`;
  };
  const openSdm=(fromPop=false)=>{
    renderSdmExperience();
    sdmExperience?.classList.add('open');sdmExperience?.setAttribute('aria-hidden','false');document.body.classList.add('sdm-experience-open');
    if(!fromPop&&location.hash!=='#sdm-pbj')history.pushState({traxPanel:'sdm',fromTopbar:window.TRAXPBJ_CONSUME_TOPBAR_ENTRY?.()===true},'',location.pathname+location.search+'#sdm-pbj');
  };
  const closeSdm=(fromPop=false)=>{
    if(!sdmExperience?.classList.contains('open'))return;
    sdmExperience.classList.remove('open');sdmExperience.setAttribute('aria-hidden','true');document.body.classList.remove('sdm-experience-open');
    if(!fromPop&&location.hash==='#sdm-pbj'){if((history.state?.fromTopbar||window.TRAXPBJ_SHOULD_RETURN_PROFILE_HOME?.('#sdm-pbj'))&&window.TRAXPBJ_RETURN_PROFILE_HOME){window.TRAXPBJ_RETURN_PROFILE_HOME();return;}history.back();return;}
  };
  $$('[data-close-sdm]').forEach(el=>el.addEventListener('click',()=>closeSdm(false)));

  const docsModal=$('#docsModal');
  let docsOpenedOnce=false;
  const openDocs=(fromPop=false)=>{
    if(!docsOpenedOnce){docsOpenedOnce=true;window.TRAXPBJ_REFRESH_CONTENT?.().catch?.(()=>{});}
    const frame=$('#docsDriveFrame'), loader=$('#docsFrameLoader');
    if(frame && !frame.dataset.bound){
      frame.dataset.bound='1';
      frame.addEventListener('load',()=>loader?.classList.add('done'));
    }
    if(frame && !frame.src){
      loader?.classList.remove('done');
      frame.src='https://drive.google.com/embeddedfolderview?id=1q20bq0uDCeshNYDN2qqwQI6blvQzGMyT#grid';
    }
    docsModal?.classList.add('open'); docsModal?.setAttribute('aria-hidden','false'); document.body.classList.add('docs-experience-open');
    if(!fromPop&&location.hash!=='#dokumentasi-pendampingan') history.pushState({traxPanel:'docs',fromTopbar:window.TRAXPBJ_CONSUME_TOPBAR_ENTRY?.()===true},'',location.pathname+location.search+'#dokumentasi-pendampingan');
  };
  const closeDocs=(fromPop=false)=>{
    if(!docsModal?.classList.contains('open'))return;
    docsModal.classList.remove('open'); docsModal.setAttribute('aria-hidden','true'); document.body.classList.remove('docs-experience-open');
    if(!fromPop && location.hash==='#dokumentasi-pendampingan'){
      history.replaceState({traxPanel:'home'},'',location.pathname+location.search+'#home');
      document.querySelector('#home')?.scrollIntoView({behavior:'auto',block:'start'});
      return;
    }
  };
  $$('[data-close-docs]').forEach(el=>el.addEventListener('click',()=>closeDocs(false)));
  universeElements?.addEventListener('click',e=>{
    const btn=e.target.closest('[data-service-action]'); if(!btn)return;
    const action=btn.dataset.serviceAction, url=btn.dataset.serviceUrl;
    disarmTopbarBack('service',action);
    if(action==='external'&&url){window.open(url,'_blank','noopener,noreferrer');return;}
    if(action==='evaluation'){document.dispatchEvent(new CustomEvent('trax:open-evaluation'));return;}
    if(action==='documentation'){openDocs();return;}
    if(action==='sdm'){openSdm();return;}
    if(action==='forum'){window.TRAXPBJ_FORUM?.open(false);return;}
    if(action==='advocacy-events'){if(window.TRAXPBJ_ADVOCACY_PORTAL?.open)window.TRAXPBJ_ADVOCACY_PORTAL.open('events');else document.dispatchEvent(new CustomEvent('trax:open-advocacy',{detail:{panel:'events'}}));return;}
    if(action==='advocacy-knowledge'){if(window.TRAXPBJ_ADVOCACY_PORTAL?.open)window.TRAXPBJ_ADVOCACY_PORTAL.open('knowledge');else document.dispatchEvent(new CustomEvent('trax:open-advocacy',{detail:{panel:'knowledge'}}));return;}
    if(action?.startsWith('control-')){document.dispatchEvent(new CustomEvent('trax:open-control-room',{detail:{module:action.replace('control-','')}}));return;}
  });

  document.addEventListener('trax:content-ready',e=>{
    adminContent=e.detail?.content||adminContent;
    // Pimpinan dirender di section tersendiri di bawah Rapor.
  });
  universeNodes.forEach(n=>n.addEventListener('click',()=>selectUniverse(n.dataset.universe)));
  universeNodes.find?.(n=>n.dataset.universe==='pengelolaan')?.addEventListener('mouseenter',()=>window.TRAXPBJ_CONTROL_ROOM?.prefetch?.(),{once:true});
  universeCore?.addEventListener('click',resetUniverse);
  universeBack?.addEventListener('click',resetUniverse);

  const updateUniverseScroll=()=>{
    if(introScene){
      const r=introScene.getBoundingClientRect();
      const p=Math.max(0,Math.min(1,-r.top/Math.max(1,r.height-innerHeight*.2)));
      introScene.style.setProperty('--intro-progress',p.toFixed(3));
    }
    if(universeScene && universeSticky){
      const r=universeScene.getBoundingClientRect();
      const range=Math.max(1,r.height-innerHeight);
      const p=Math.max(0,Math.min(1,-r.top/range));
      const compactReady=innerWidth<=980&&r.top<innerHeight*.82&&r.bottom>innerHeight*.08;
      const visualP=compactReady?Math.max(.32,p):p;
      universeSticky.style.setProperty('--universe-progress',visualP.toFixed(3));
      if(innerWidth<=980&&compactReady){
        universeSticky.classList.add('is-formed','is-settled');
      }else{
        universeSticky.classList.toggle('is-formed',visualP>.08);
        universeSticky.classList.toggle('is-settled',visualP>.22);
      }
    }
  };
  addEventListener('scroll',updateUniverseScroll,{passive:true});
  addEventListener('resize',updateUniverseScroll,{passive:true});
  updateUniverseScroll();

  // actors (plain-language summaries aligned to modules + 2025 supplement)
  const actors={
    pakpa:{code:'PA/KPA',full:'Pengguna Anggaran / Kuasa Pengguna Anggaran',headline:'Menetapkan arah dan keputusan sesuai kewenangan anggaran.',tasks:['Menetapkan dan menjalankan kewenangan pengadaan sesuai pendelegasian.','Menetapkan perencanaan/RUP dan pelaku pengadaan sesuai kewenangannya.','KPA dapat melaksanakan tugas PPK dengan persyaratan yang berlaku.'],stages:['Kebutuhan','Perencanaan','Penetapan','Pengendalian']},
    ppk:{code:'PPK',full:'Pejabat Pembuat Komitmen',headline:'Menjaga paket dari perencanaan teknis sampai kontraknya selesai.',tasks:['Menyusun perencanaan pengadaan, konsolidasi, spesifikasi/KAK, HPS, dan rancangan kontrak.','Melaksanakan kewenangan e-Purchasing sesuai ketentuan.','Menginput e-Kontrak, mengendalikan kontrak, menyimpan dokumen, menyerahkan hasil, dan menilai kinerja penyedia.'],stages:['Perencanaan','Persiapan','e-Purchasing','Kontrak','Serah terima']},
    pp:{code:'PP',full:'Pejabat Pengadaan',headline:'Menjalankan pemilihan yang menjadi kewenangan Pejabat Pengadaan.',tasks:['Melaksanakan persiapan dan pelaksanaan Pengadaan Langsung.','Menjalankan Penunjukan Langsung dan/atau E-Purchasing sesuai kewenangan.','Mendokumentasikan proses pemilihan dan hasilnya.'],stages:['Persiapan pemilihan','Pengadaan Langsung','Penunjukan Langsung','E-Purchasing']},
    pokja:{code:'POKJA',full:'Kelompok Kerja Pemilihan',headline:'Mengelola pemilihan penyedia yang membutuhkan proses evaluasi.',tasks:['Melaksanakan persiapan dan pelaksanaan pemilihan penyedia selain Pengadaan Langsung dan E-Purchasing dengan pembelian langsung.','Menjalankan Tender, Seleksi, Tender Cepat, Penunjukan Langsung, dan proses lain sesuai kewenangan.','Melakukan evaluasi dan menetapkan atau menyampaikan hasil pemilihan sesuai ketentuan.'],stages:['Persiapan pemilihan','Tender','Seleksi','Tender Cepat','Hasil pemilihan']}
  };
  const renderActor=key=>{
    const d=actors[key]; if(!d||!$('#actorCode'))return;
    $('#actorCode').textContent=d.code; $('#actorFull').textContent=d.full; $('#actorHeadline').textContent=d.headline;
    $('#actorTasks').innerHTML=d.tasks.map((x,i)=>`<div><span>${String(i+1).padStart(2,'0')}</span><p>${x}</p></div>`).join('');
    $('#actorStages').innerHTML=d.stages.map(x=>`<span>${x}</span>`).join('');
    $$('.actor-node').forEach(b=>b.classList.toggle('active',b.dataset.role===key));
  };
  $$('.actor-node').forEach(b=>b.addEventListener('click',()=>renderActor(b.dataset.role))); renderActor('pakpa');

  // SDM
  const renderSDM=()=>{
    if(!$('#sdmCurrent'))return;
    const sdm=DB.sdm2026||{}; const current=Number(sdm.realization||0), target=Number(sdm.target||0), pct=target?current/target*100:0;
    $('#sdmCurrent').textContent=idNum.format(current); $('#sdmTarget').textContent=idNum.format(target); $('#sdmPercent').textContent=`${idPct.format(pct)}%`; $('#sdmGap').textContent=idNum.format(Math.max(0,target-current));
    const circle=2*Math.PI*92; $('#sdmGaugeValue').style.strokeDasharray=String(circle); $('#sdmGaugeValue').style.strokeDashoffset=String(circle*(1-Math.min(1,pct/100)));
    const tMap=Object.fromEntries((sdm.targetBreakdown||[]).map(x=>[x.name,x.value]));
    const rMap=Object.fromEntries((sdm.realizationBreakdown||[]).map(x=>[x.name,x.value]));
    const maxS=Math.max(...Object.values(tMap),1);
    $('#sdmBreakdown').innerHTML=Object.keys(tMap).map(name=>`<div class="sdm-row"><div><b>${name}</b><small>JF PPBJ</small></div><div class="sdm-track"><i class="sdm-target-bar" style="width:${tMap[name]/maxS*100}%"></i><i class="sdm-real-bar" style="width:${(rMap[name]||0)/maxS*100}%"></i></div><div class="sdm-value"><b>${idNum.format(rMap[name]||0)}</b><small>/ ${idNum.format(tMap[name])}</small></div></div>`).join('');
  };
  renderSDM();
  $$('.sdm-type-list button').forEach(b=>b.addEventListener('click',()=>{$$('.sdm-type-list button').forEach(x=>x.classList.toggle('active',x===b));}));

  // ITKP explorer
  let itkpData=null, itkpShown=12, itkpSelected=null;
  const pctText=n=>`${idPct2.format(Number(n)||0)}%`;
  const scoreText=n=>idPct2.format(Number(n)||0);
  const compactValue=n=>{
    const value=Number(n)||0;
    const abs=Math.abs(value);
    const fmt=(num,d=2)=>new Intl.NumberFormat('id-ID',{minimumFractionDigits:0,maximumFractionDigits:d}).format(num);
    if(abs>=1e12) return `${fmt(value/1e12)} T`;
    if(abs>=1e9) return `${fmt(value/1e9)} M`;
    if(abs>=1e6) return `${fmt(value/1e6)} Jt`;
    if(abs>=1e3) return `${fmt(value/1e3,1)} Rb`;
    return fmt(value,0);
  };
  const pairText=pair=>{
    if(!pair) return '—';
    const num=Number(pair.num)||0, den=Number(pair.den)||0;
    if(!num && !den) return '—';
    return `${compactValue(num)} / ${compactValue(den)}`;
  };
  const itkpFiltered=()=>{
    const q=$('#itkpSearch')?.value.trim().toLocaleLowerCase('id-ID')||'';
    return (itkpData?.rows||[]).filter(r=>!q||r.name.toLocaleLowerCase('id-ID').includes(q));
  };
  const renderItkpMetrics=(row=null)=>{
    if(!itkpData)return;
    const context=row || itkpData.city || {name:'Pemerintah Kota Bogor',totalScore:itkpData.average,percentages:itkpData.metrics.map(m=>m.value),scores:itkpData.metrics.map(m=>m.score),pairs:itkpData.metrics.map(m=>m.pair)};
    const values=context.percentages||[], scores=context.scores||[], pairs=context.pairs||[];
    $('#itkpAverage').textContent=scoreText(context.totalScore);
    $('#itkpAverageMax').textContent=`${context.name} · ${scoreText(context.totalScore)} / 30`;
    const cards=$$('#itkpMetrics article');
    cards.forEach((card,i)=>{
      const m=itkpData.metrics[i]||{label:`Indikator ${i+1}`,value:0,maxScore:(itkpData.scoreMaxes||[])[i]||0,pair:{num:0,den:0}};
      const v=Number(values[i] ?? m.value ?? 0), sc=Number(scores[i] ?? m.score ?? 0), mx=Number(m.maxScore ?? (itkpData.scoreMaxes||[])[i] ?? 0);
      const pair=pairs[i] || m.pair || {num:0,den:0};
      card.querySelector('b').textContent=m.label;
      card.querySelector('strong').textContent=pairText(pair);
      const scoreLine=card.querySelector('.itkp-scoreline'); if(scoreLine) scoreLine.textContent=`${scoreText(sc)} / ${scoreText(mx)}`;
      let pctBadge=card.querySelector('.itkp-percent-badge');
      if(!pctBadge){pctBadge=document.createElement('em');pctBadge.className='itkp-percent-badge';card.appendChild(pctBadge);}
      pctBadge.textContent=pctText(v);
      card.querySelector('i').style.width=`${Math.max(0,Math.min(100,v))}%`;
      card.setAttribute('title', `${pctText(v)} · skor ${scoreText(sc)} / ${scoreText(mx)}`);
    });
  };
  const renderItkpRanks=()=>{
    if(!itkpData)return; const rows=itkpFiltered(); const max=30;
    const visible=rows.slice(0,itkpShown);
    $('#itkpRankList').innerHTML=visible.length?visible.map((r,i)=>`<button class="rank-row ${itkpSelected===r.name?'active':''}" data-itkp-opd="${r.name.replace(/"/g,'&quot;')}"><span class="rank-no">${String(i+1).padStart(2,'0')}</span><div class="rank-name"><b>${r.name}</b><small>${(r.percentages||[]).slice(0,3).map(p=>pctText(p)).join(' · ')}</small></div><div class="rank-bar"><i style="width:${Math.max(2,Math.min(100,r.totalScore/max*100))}%"></i></div><strong>${scoreText(r.totalScore)}</strong><svg viewBox="0 0 24 24"><path d="M7 12h10M13 8l4 4-4 4"/></svg></button>`).join(''):'<div class="rank-empty">OPD tidak ditemukan.</div>';
    $('#itkpMore').hidden=itkpShown>=rows.length;
    $$('[data-itkp-opd]').forEach(b=>b.addEventListener('click',()=>{
      const row=(itkpData.rows||[]).find(x=>x.name===b.dataset.itkpOpd); if(!row)return;
      itkpSelected=itkpSelected===row.name?null:row.name; renderItkpMetrics(itkpSelected?row:null); renderItkpRanks();
    }));
  };
  const renderITKP=()=>{ renderItkpMetrics(itkpSelected?(itkpData?.rows||[]).find(x=>x.name===itkpSelected):null); renderItkpRanks(); };
  $('#itkpSearch')?.addEventListener('input',()=>{itkpShown=12;itkpSelected=null;renderITKP()});
  $('#itkpMore')?.addEventListener('click',()=>{itkpShown+=12;renderItkpRanks()});

  // data exploration
  const methodInfo={
    'E-Purchasing':'Pembelian atau perolehan barang/jasa melalui sistem katalog elektronik.',
    'Pengadaan Langsung':'Pemilihan penyedia melalui mekanisme Pengadaan Langsung sesuai ketentuan paket.',
    'Tender / Seleksi':'Tender digunakan untuk Barang/Pekerjaan Konstruksi/Jasa Lainnya, sedangkan Seleksi untuk Jasa Konsultansi.',
    'Penunjukan Langsung':'Pemilihan penyedia untuk kondisi atau kriteria tertentu sesuai ketentuan.',
    'Tender Cepat':'Proses tender cepat untuk pengadaan yang memenuhi persyaratan penggunaan metode tersebut.',
    'Swakelola':'Pengadaan yang pelaksanaannya dilakukan secara swakelola sesuai tipe dan penyelenggara yang ditetapkan.',
    'Dikecualikan':'Pengadaan yang tercatat dalam kelompok pengadaan yang dikecualikan dan mengikuti ketentuan khususnya.',
    'Lainnya':'Metode lain yang tercatat dalam pengadaan.'
  };
  let selectedYear='2025';
  let selectedOverviewMethod='ALL';
  let pendingYear=null;
  let modalMethod=null; let modalYear='2025'; let modalShown=20;
  const getMethodYear=(method,year)=>{const value=DB.methodDetails?.[method]?.[year]||{planningPackages:0,planningValue:0,realizationPackages:0,realizationValue:0,satker:[]};return window.TRAXPBJ_SESSION?.scopeBucket(value)||value;};
  const yearData=year=>{const value=DB.years?.[year];return window.TRAXPBJ_SESSION?.scopeYear(value,DB.methodDetails)||value;};
  const snapshotFor=year=>{
    const base=yearData(year);
    if(!base)return null;
    if(selectedOverviewMethod==='ALL')return base;
    const d=getMethodYear(selectedOverviewMethod,year);
    return {year:Number(year),planningPackages:d.planningPackages||0,planningValue:d.planningValue||0,realizationPackages:d.realizationPackages||0,realizationValue:d.realizationValue||0};
  };
  const populateOverviewMethodOptions=()=>{
    const methods=['Semua metode',...DB.methods];
    const list=$('#overviewMethodOptions');
    if(list) list.innerHTML=methods.map(m=>`<option value="${m.replace(/"/g,'&quot;')}"></option>`).join('');
    const select=$('#overviewMethodSelect');
    if(select){
      const current=selectedOverviewMethod==='ALL'?'ALL':selectedOverviewMethod;
      select.innerHTML=`<option value="ALL">Semua metode</option>`+DB.methods.map(m=>`<option value="${m.replace(/"/g,'&quot;')}">${m}</option>`).join('');
      select.value=current;
    }
  };
  const methodMatch=value=>{
    const q=String(value||'').trim().toLocaleLowerCase('id-ID');
    if(!q || q==='semua' || q==='semua metode')return 'ALL';
    return DB.methods.find(m=>m.toLocaleLowerCase('id-ID')===q)
      || DB.methods.find(m=>m.toLocaleLowerCase('id-ID').startsWith(q))
      || DB.methods.find(m=>m.toLocaleLowerCase('id-ID').includes(q))
      || null;
  };
  const renderHistory=()=>{
    const ys=Object.keys(DB.years||{}).sort(); if(!ys.length)return;
    const snaps=ys.map(y=>snapshotFor(y)||{planningValue:0,realizationValue:0});
    const max=Math.max(...snaps.map(d=>Math.max(Number(d.planningValue)||0,Number(d.realizationValue)||0)),1);
    const W=1000,H=260,padX=72,padY=34;
    const x=i=>ys.length===1?W/2:padX+i*(W-padX*2)/(ys.length-1);
    const y=v=>H-padY-(Number(v)||0)/max*(H-padY*2);
    const pPlan=snaps.map((d,i)=>[x(i),y(d.planningValue)]),pReal=snaps.map((d,i)=>[x(i),y(d.realizationValue)]);
    const pathOf=pts=>pts.map((p,i)=>(i?'L':'M')+p[0].toFixed(1)+' '+p[1].toFixed(1)).join(' ');
    const area=`${pathOf(pReal)} L ${pReal[pReal.length-1][0]} ${H-padY} L ${pReal[0][0]} ${H-padY} Z`;
    const label=selectedOverviewMethod==='ALL'?'Perjalanan nilai pengadaan':`Perjalanan ${selectedOverviewMethod}`;
    const ht=$('#historyTitle'); if(ht)ht.textContent=label;
    $('#historyChart').innerHTML=`<div class="history-viz"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${label.replace(/"/g,'&quot;')}"><defs><linearGradient id="histArea" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0a6dd8" stop-opacity=".20"/><stop offset="1" stop-color="#0a6dd8" stop-opacity="0"/></linearGradient></defs><path class="hist-area" d="${area}"/><path class="hist-line plan" d="${pathOf(pPlan)}"/><path class="hist-line real" d="${pathOf(pReal)}"/>${ys.map((yr,i)=>{const d=snaps[i];return `<g class="hist-node ${yr===selectedYear?'active':''}" data-hyear="${yr}" transform="translate(${x(i)} 0)"><circle class="plan-dot2" cy="${y(d.planningValue)}" r="8"/><circle class="real-dot2" cy="${y(d.realizationValue)}" r="8"/><text class="hist-year-label" y="${H-5}" text-anchor="middle">${yr}</text><g class="hist-tooltip" transform="translate(0 ${Math.min(y(d.planningValue),y(d.realizationValue))-18})"><rect x="-82" y="-42" width="164" height="34" rx="10"/><text x="0" y="-28" text-anchor="middle">${rupiahCompact(d.planningValue)} · ${rupiahCompact(d.realizationValue)}</text></g></g>`}).join('')}</svg></div>`;
    $$('#historyChart [data-hyear]').forEach(g=>g.addEventListener('click',()=>setYear(g.dataset.hyear)));
  };
  const renderMethods=()=>{
    const d=yearData(selectedYear); if(!d)return;
    const q=$('#methodSearch')?.value.trim().toLocaleLowerCase('id-ID')||'';
    const methods=DB.methods.filter(m=>!q||m.toLocaleLowerCase('id-ID').includes(q)||(methodInfo[m]||'').toLocaleLowerCase('id-ID').includes(q));
    $('#methodGrid').innerHTML=methods.map((m,i)=>{const md=getMethodYear(m,selectedYear);return `<button class="method-card ${selectedOverviewMethod===m?'overview-active':''}" data-method="${m}"><div class="method-top"><span class="method-index">${String(i+1).padStart(2,'0')}</span><span class="method-arrow"><svg viewBox="0 0 24 24"><path d="M6 18 18 6M9 6h9v9"/></svg></span></div><h4>${m}</h4><p>${methodInfo[m]||''}</p><div class="method-stats"><div><small>PERENCANAAN</small><b>${idNum.format(md.planningPackages)}</b></div><div><small>REALISASI</small><b>${idNum.format(md.realizationPackages)}</b></div></div><div class="method-value"><small>Pagu / realisasi nilai</small><b>${rupiahCompact(md.planningValue)} · ${rupiahCompact(md.realizationValue)}</b></div></button>`}).join('');
    $$('#methodGrid [data-method]').forEach(b=>b.addEventListener('click',()=>openModal(b.dataset.method,selectedYear,true)));
  };
  const renderOverview=()=>{
    const d=snapshotFor(selectedYear); if(!d)return;
    $('#yearNumber').textContent=selectedYear;
    $('#overviewPlanPackages').textContent=idNum.format(d.planningPackages||0); $('#overviewPlanValue').textContent=rupiahCompact(d.planningValue); $('#overviewPlanValue').title=rupiahFull(d.planningValue);
    $('#overviewRealPackages').textContent=idNum.format(d.realizationPackages||0); $('#overviewRealValue').textContent=rupiahCompact(d.realizationValue); $('#overviewRealValue').title=rupiahFull(d.realizationValue);
    const ratio=d.planningValue?d.realizationValue/d.planningValue*100:0; $('#overviewRatio').textContent=`${idPct.format(ratio)}%`; $('#overviewRatioBar').style.width=`${Math.min(100,ratio)}%`;
    const label=selectedOverviewMethod==='ALL'?'Semua metode':selectedOverviewMethod;
    $('#overviewMethodLabel').textContent=label;
    const clear=$('#overviewMethodClear'); if(clear)clear.hidden=selectedOverviewMethod==='ALL';
    renderHistory(); renderMethods();
  };
  const setOverviewMethod=method=>{
    selectedOverviewMethod=method&&method!=='ALL'?method:'ALL';
    const input=$('#overviewMethodSearch'); if(input)input.value=selectedOverviewMethod==='ALL'?'':selectedOverviewMethod;
    const select=$('#overviewMethodSelect'); if(select)select.value=selectedOverviewMethod==='ALL'?'ALL':selectedOverviewMethod;
    renderOverview();
  };
  const setYear=year=>{
    if(!yearData(year)){
      if(String(year)==='2026') pendingYear='2026';
      return;
    }
    pendingYear=null; selectedYear=String(year);
    $$('.year-control [data-year]').forEach(b=>b.classList.toggle('active',b.dataset.year===selectedYear));
    renderOverview();
  };
  $('#methodSearch')?.addEventListener('input',renderMethods);
  populateOverviewMethodOptions();
  const overviewInput=$('#overviewMethodSearch');
  overviewInput?.addEventListener('input',()=>{ if(!overviewInput.value.trim()) setOverviewMethod('ALL'); else { const m=methodMatch(overviewInput.value); if(m&&m!=='ALL'&&m.toLocaleLowerCase('id-ID')===overviewInput.value.trim().toLocaleLowerCase('id-ID')) setOverviewMethod(m); } });
  overviewInput?.addEventListener('change',()=>{ const m=methodMatch(overviewInput.value); if(m) setOverviewMethod(m); });
  overviewInput?.addEventListener('keydown',e=>{ if(e.key==='Enter'){e.preventDefault();const m=methodMatch(overviewInput.value);if(m)setOverviewMethod(m);} });
  $('#overviewMethodSelect')?.addEventListener('change',e=>setOverviewMethod(e.target.value));
  $('#overviewMethodClear')?.addEventListener('click',()=>setOverviewMethod('ALL'));
  $$('.year-control [data-year]').forEach(b=>b.addEventListener('click',()=>setYear(b.dataset.year)));
  setYear('2025');
  // Tahun berjalan menjadi tampilan utama segera setelah data 2026 selesai dibaca.
  pendingYear='2026';

  // modal + browser history
  const modal=$('#methodModal');
  const renderModalYearTabs=()=>{
    const ys=Object.keys(DB.years||{}).sort(); $('#modalYearTabs').innerHTML=ys.map(y=>`<button class="${y===modalYear?'active':''}" data-myear="${y}">${y}</button>`).join('');
    $$('[data-myear]').forEach(b=>b.addEventListener('click',()=>{modalYear=b.dataset.myear;modalShown=20;renderModal(true);}));
  };
  const modalRows=()=>{
    const q=$('#modalSearch').value.trim().toLocaleLowerCase('id-ID'); const sort=$('#modalSort').value; const d=getMethodYear(modalMethod,modalYear);
    const rows=(d.satker||[]).filter(r=>!q||r.name.toLocaleLowerCase('id-ID').includes(q));
    rows.sort((a,b)=>sort==='name'?a.name.localeCompare(b.name,'id'):(Number(b[sort]||0)-Number(a[sort]||0))||a.name.localeCompare(b.name,'id'));
    return rows;
  };
  const renderModalTable=()=>{
    const all=modalRows(); const rows=all.slice(0,modalShown);
    $('#modalTableBody').innerHTML=rows.length?rows.map(r=>`<tr><td>${r.name}</td><td>${idNum.format(r.planningPackages)}</td><td title="${rupiahFull(r.planningValue)}">${rupiahCompact(r.planningValue)}</td><td>${idNum.format(r.realizationPackages)}</td><td title="${rupiahFull(r.realizationValue)}">${rupiahCompact(r.realizationValue)}</td></tr>`).join(''):'<tr><td colspan="5">Data tidak ditemukan.</td></tr>';
    $('#modalCount').textContent=`${idNum.format(all.length)} perangkat daerah / unit`; $('#modalLoadMore').hidden=modalShown>=all.length;
  };
  const renderModal=(pushUrl=false)=>{
    const d=getMethodYear(modalMethod,modalYear); $('#modalTitle').textContent=modalMethod; $('#modalDescription').textContent=methodInfo[modalMethod]||''; $('#modalYearLabel').textContent=`Tahun ${modalYear}`;
    const modalKicker=$('.method-sheet-head small'); if(modalKicker) modalKicker.textContent=modalMethod==='Swakelola'?'REKAP CARA PENGADAAN':'REKAP METODE / KELOMPOK';
    $('#modalPlanPackages').textContent=idNum.format(d.planningPackages); $('#modalPlanValue').textContent=rupiahFull(d.planningValue); $('#modalRealPackages').textContent=idNum.format(d.realizationPackages); $('#modalRealValue').textContent=rupiahFull(d.realizationValue); $('#modalTableTitle').textContent=window.TRAXPBJ_SESSION?.opd?.()?`Rincian ${modalMethod} · ${window.TRAXPBJ_SESSION.opd()}`:`Rincian ${modalMethod} per OPD`;
    renderModalYearTabs(); renderModalTable();
    if(pushUrl){const u=new URL(location.href);u.searchParams.set('metode',slugify(modalMethod));u.searchParams.set('tahun',modalYear);history.pushState({method:modalMethod,year:modalYear},'',u);}
  };
  const openModal=(method,year,pushUrl=false)=>{modalMethod=method;modalYear=year&&yearData(year)?year:selectedYear;modalShown=20;$('#modalSearch').value='';$('#modalSort').value='planningValue';modal.classList.add('open');modal.setAttribute('aria-hidden','false');document.body.classList.add('modal-open');renderModal(pushUrl);setTimeout(()=>$('.modal-close')?.focus(),300);};
  const closeModal=(fromPop=false)=>{if(!modal.classList.contains('open'))return;modal.classList.remove('open');modal.setAttribute('aria-hidden','true');document.body.classList.remove('modal-open');if(!fromPop){if(history.state?.method){history.back();}else{const u=new URL(location.href);u.searchParams.delete('metode');u.searchParams.delete('tahun');history.replaceState({},'',u);}}};
  $$('[data-close-modal]').forEach(el=>el.addEventListener('click',()=>closeModal(false)));
  $('#modalSearch').addEventListener('input',()=>{modalShown=20;renderModalTable()}); $('#modalSort').addEventListener('change',()=>{modalShown=20;renderModalTable()}); $('#modalLoadMore').addEventListener('click',()=>{modalShown+=20;renderModalTable()});
  addEventListener('keydown',e=>{if(e.key==='Escape'&&modal.classList.contains('open'))closeModal(false)});
  const scopeName=()=>window.TRAXPBJ_SESSION?.opd?.()||'';
  const syncScopedPresentation=()=>{
    const opd=scopeName(),scoped=!!opd;
    const city='Kota Bogor';
    const itkpTitle=$('#itkpScopeTitle'),itkpLead=$('#itkpScopeLead'),itkpIndex=$('#itkpScopeIndex');
    if(itkpTitle)itkpTitle.textContent=`Capaian ITKP ${scoped?opd:city}`;
    if(itkpLead)itkpLead.textContent=scoped?`Indikator Pemanfaatan Sistem Pengadaan · ${opd} · skor maksimal 30 poin.`:'Indikator Pemanfaatan Sistem Pengadaan · skor maksimal 30 poin.';
    if(itkpIndex)itkpIndex.textContent=scoped?'03 · CAPAIAN ITKP PERANGKAT DAERAH':'03 · CAPAIAN ITKP KOTA BOGOR';
    const rankKicker=$('#itkpRankKicker'),rankTitle=$('#itkpRankTitle'),rankSearch=$('#itkpSearchWrap');
    if(rankKicker)rankKicker.textContent=scoped?'CAPAIAN AKUN AKTIF':'PERINGKAT OPD';
    if(rankTitle)rankTitle.textContent=scoped?`Rincian capaian ${opd}`:'Capaian ITKP per Satuan Kerja';
    if(rankSearch)rankSearch.hidden=scoped;

    const dataTitle=$('#dataScopeTitle'),dataLead=$('#dataScopeLead'),dataIndex=$('#dataScopeIndex'),methodLead=$('#dataMethodLead');
    if(dataTitle)dataTitle.textContent=`Profil Pengadaan ${scoped?opd:city}`;
    if(dataLead)dataLead.textContent=scoped?`Pilih tahun dan metode untuk melihat paket, nilai pengadaan, dan realisasi ${opd}.`:'Pilih tahun dan metode untuk melihat paket, nilai pengadaan, realisasi, dan rincian per perangkat daerah.';
    if(dataIndex)dataIndex.textContent=scoped?'04 · REKAM PENGADAAN PERANGKAT DAERAH':'04 · REKAM PENGADAAN KOTA BOGOR';
    if(methodLead)methodLead.textContent=scoped?`Pilih metode untuk melihat rincian ${opd}.`:'Pilih metode, lalu lihat rincian OPD.';
  };
  syncScopedPresentation();

  // Live Google Sheet updates
  const applyLiveData=d=>{
    if(!d)return;
    if(d.sdm){ DB.sdm2026=d.sdm; renderSDM(); }
    if(d.itkp){
      itkpData=window.TRAXPBJ_SESSION?.scopeItkp(d.itkp)||d.itkp; renderITKP();
      $('#itkpLiveStatus').textContent='ITKP 2026'; $('#itkpLiveNote').textContent=window.TRAXPBJ_SESSION?.opd()||`${idNum.format(d.itkp.rows.length)} satuan kerja`; 
      $('#itkpLiveStatus').closest('.live-source-line')?.classList.add('is-live');
    }else{ $('#itkpLiveStatus').textContent='ITKP 2026'; $('#itkpLiveNote').textContent=''; }
    if(d.pbj2026){
      DB.years['2026']=d.pbj2026.year;
      Object.entries(d.pbj2026.methodDetails||{}).forEach(([method,val])=>{ if(!DB.methodDetails[method])DB.methodDetails[method]={}; DB.methodDetails[method]['2026']=val; if(!DB.methods.includes(method) && (val.planningPackages||val.realizationPackages))DB.methods.push(method); });
      const yb=$('[data-year="2026"]'); if(yb){ yb.disabled=false; yb.classList.add('ready'); yb.title='Data 2026 tersedia'; }
      populateOverviewMethodOptions();
      if(pendingYear==='2026') setYear('2026'); else renderOverview();
    }else{
      const yb=$('[data-year="2026"]'); if(yb){ yb.disabled=true; yb.classList.remove('ready'); yb.title='Data 2026 belum terbaca'; }
    }
  };
  document.addEventListener('trax:session-change',()=>{syncScopedPresentation();itkpSelected=null;itkpShown=12;if($('#itkpSearch'))$('#itkpSearch').value='';if(window.TRAXPBJ_LIVE_DATA)applyLiveData(window.TRAXPBJ_LIVE_DATA);renderOverview();if(modal.classList.contains('open'))renderModal(false);});
  document.addEventListener('trax:live-data',e=>applyLiveData(e.detail));
  if(window.TRAXPBJ_LIVE_DATA) applyLiveData(window.TRAXPBJ_LIVE_DATA);

  // subtle pointer parallax: gerak visual, bukan mengganggu baca
  const hero=$('.hero');
  hero?.addEventListener('pointermove',e=>{ const r=hero.getBoundingClientRect(); const x=(e.clientX-r.left)/r.width-.5, y=(e.clientY-r.top)/r.height-.5; hero.style.setProperty('--px',x.toFixed(3)); hero.style.setProperty('--py',y.toFixed(3)); });

  const syncFromUrl=()=>{const u=new URL(location.href);const m=methodBySlug(u.searchParams.get('metode')||'');const y=u.searchParams.get('tahun');if(m){openModal(m,y||selectedYear,false)}else{closeModal(true)} if(location.hash==='#dokumentasi-pendampingan'){openDocs(true);closeSdm(true);window.TRAXPBJ_FORUM?.close(true);}else if(location.hash==='#sdm-pbj'){openSdm(true);closeDocs(true);window.TRAXPBJ_FORUM?.close(true);}else if(location.hash==='#konsultasi-pbj'){closeDocs(true);closeSdm(true);window.TRAXPBJ_FORUM?.open(true);}else{closeDocs(true);closeSdm(true);window.TRAXPBJ_FORUM?.close(true);}};
  addEventListener('popstate',syncFromUrl); syncFromUrl();
})();
