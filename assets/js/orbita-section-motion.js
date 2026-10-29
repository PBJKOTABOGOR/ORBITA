(() => {
  'use strict';
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const finePointer = matchMedia('(hover: hover) and (pointer: fine)').matches && innerWidth > 900;
  const $$ = (s, r=document) => [...r.querySelectorAll(s)];
  const clamp = (n,a,b)=>Math.max(a,Math.min(b,n));
  const scenes = $$('#itkp,#rekam,#rapor-kota');
  const cardSelector = '#itkp .itkp-score-card,#itkp .itkp-metrics article,#itkp .itkp-rank-board,#rekam .year-kicker,#rekam .overview-card,#rekam .history-panel,#rekam .method-card,#rapor-kota .rapor-card';
  let activeCard = null;
  let pointerFrame = 0;
  let latestEvent = null;

  scenes.forEach((scene,idx)=>{
    scene.style.setProperty('--scene-order',idx);
    scene.style.setProperty('--scene-px','50vw');
    scene.style.setProperty('--scene-py','45vh');
  });

  const resetCard=card=>{
    if(!card)return;
    card.style.setProperty('--card-rx','0deg');
    card.style.setProperty('--card-ry','0deg');
    card.style.setProperty('--card-x','50%');
    card.style.setProperty('--card-y','50%');
    card.classList.remove('orbita-card-hot');
  };

  const paintPointer=()=>{
    pointerFrame=0;
    const e=latestEvent;
    if(!e)return;
    const scene=e.target.closest?.('#itkp,#rekam,#rapor-kota');
    if(scene){
      const r=scene.getBoundingClientRect();
      const x=clamp(e.clientX-r.left,0,r.width);
      const y=clamp(e.clientY-r.top,0,r.height);
      const nx=clamp(x/Math.max(1,r.width),0,1);
      const ny=clamp(y/Math.max(1,r.height),0,1);
      scene.style.setProperty('--scene-px',`${x.toFixed(1)}px`);
      scene.style.setProperty('--scene-py',`${y.toFixed(1)}px`);
      scene.style.setProperty('--head-x',`${((nx-.5)*5).toFixed(2)}px`);
      scene.style.setProperty('--head-y',`${((ny-.5)*3).toFixed(2)}px`);
    }
    const card=e.target.closest?.(cardSelector)||null;
    if(card!==activeCard){resetCard(activeCard);activeCard=card;}
    if(!card)return;
    const r=card.getBoundingClientRect();
    const x=clamp((e.clientX-r.left)/Math.max(1,r.width),0,1);
    const y=clamp((e.clientY-r.top)/Math.max(1,r.height),0,1);
    card.style.setProperty('--card-x',`${(x*100).toFixed(1)}%`);
    card.style.setProperty('--card-y',`${(y*100).toFixed(1)}%`);
    card.style.setProperty('--card-rx',`${((.5-y)*3.1).toFixed(2)}deg`);
    card.style.setProperty('--card-ry',`${((x-.5)*3.8).toFixed(2)}deg`);
    card.classList.add('orbita-card-hot');
  };

  if(!reduced && finePointer){
    document.addEventListener('pointermove',e=>{
      latestEvent=e;
      if(!pointerFrame)pointerFrame=requestAnimationFrame(paintPointer);
    },{passive:true});
    document.addEventListener('pointerout',e=>{
      if(activeCard&&!e.relatedTarget?.closest?.(cardSelector)){resetCard(activeCard);activeCard=null;}
      const leaving=e.target.closest?.('#itkp,#rekam,#rapor-kota');
      if(leaving&&!e.relatedTarget?.closest?.('#itkp,#rekam,#rapor-kota')){
        leaving.style.setProperty('--head-x','0px');
        leaving.style.setProperty('--head-y','0px');
      }
    },{passive:true});
  }

  const tagMotionOrder=()=>{
    $$(cardSelector).forEach((card,i)=>{if(!card.style.getPropertyValue('--motion-i'))card.style.setProperty('--motion-i',i%8);});
  };
  tagMotionOrder();
  const methodGrid=document.getElementById('methodGrid');
  if(methodGrid&&'MutationObserver' in window)new MutationObserver(tagMotionOrder).observe(methodGrid,{childList:true,subtree:true});

  if('IntersectionObserver' in window){
    const io=new IntersectionObserver(entries=>entries.forEach(entry=>entry.target.classList.toggle('orbita-awake',entry.isIntersecting)),{threshold:.08,rootMargin:'-4% 0px -5% 0px'});
    scenes.forEach(scene=>io.observe(scene));
  }else scenes.forEach(scene=>scene.classList.add('orbita-awake'));

  document.addEventListener('click',e=>{
    const button=e.target.closest?.('.year-control button,.overview-method-select-wrap,.itkp-metrics article,.rank-row');
    if(!button)return;
    button.classList.remove('orbita-tap');
    requestAnimationFrame(()=>button.classList.add('orbita-tap'));
    setTimeout(()=>button.classList.remove('orbita-tap'),420);
  });

  const pulseScope=()=>{
    ['#itkpScopeTitle','#dataScopeTitle','#raporScopeTitle'].forEach(sel=>{
      const el=document.querySelector(sel);if(!el)return;
      el.classList.remove('orbita-scope-swap');requestAnimationFrame(()=>el.classList.add('orbita-scope-swap'));
      setTimeout(()=>el.classList.remove('orbita-scope-swap'),620);
    });
  };
  document.addEventListener('trax:session-change',pulseScope);
})();
