(() => {
  'use strict';
  const body=document.body;
  const btn=document.getElementById('themeToggle');
  if(!body||!btn) return;
  const meta=document.querySelector('meta[name="theme-color"]');
  let dark=false;
  let busy=false;
  const random=(min,max)=>min+Math.random()*(max-min);

  const makeTransition=(toDark,origin)=>{
    const layer=document.createElement('div');
    layer.className=`theme-cosmos-transition ${toDark?'to-dark':'to-light'}`;
    layer.style.setProperty('--ox',`${origin.x}px`);
    layer.style.setProperty('--oy',`${origin.y}px`);
    layer.style.setProperty('--cx',`${Math.round(innerWidth/2)}px`);
    layer.style.setProperty('--cy',`${Math.round(innerHeight/2)}px`);

    const core=document.createElement('div');
    core.className='theme-cosmos-core';
    core.innerHTML='<span></span><i></i><b></b>';
    layer.appendChild(core);

    const system=document.createElement('div');
    system.className='theme-cosmos-system';
    for(let r=0;r<4;r++){
      const ring=document.createElement('i');
      ring.className='theme-cosmos-ring';
      ring.style.setProperty('--ring',String(r));
      system.appendChild(ring);
    }
    for(let i=0;i<24;i++){
      const p=document.createElement('span');
      p.className='theme-cosmos-particle';
      const angle=(Math.PI*2*i/24)+random(-.18,.18);
      const radius=random(160,Math.min(520,Math.max(260,innerWidth*.34)));
      const tx=Math.cos(angle)*radius;
      const ty=Math.sin(angle)*radius*.66;
      const tz=random(-260,260);
      p.style.setProperty('--tx',`${tx.toFixed(1)}px`);
      p.style.setProperty('--ty',`${ty.toFixed(1)}px`);
      p.style.setProperty('--tz',`${tz.toFixed(1)}px`);
      p.style.setProperty('--delay',`${(i%8)*18}ms`);
      p.style.setProperty('--size',`${random(2.5,7).toFixed(1)}px`);
      p.style.setProperty('--hue',String((i*37)%360));
      system.appendChild(p);
    }
    layer.appendChild(system);
    document.body.appendChild(layer);
    requestAnimationFrame(()=>layer.classList.add('play'));
    return layer;
  };

  const setTheme=(next,{animate=true,event=null}={})=>{
    if(busy||next===dark) return;
    busy=true;
    const rect=btn.getBoundingClientRect();
    const origin={x:event?.clientX||rect.left+rect.width/2,y:event?.clientY||rect.top+rect.height/2};
    const layer=animate?makeTransition(next,origin):null;
    btn.classList.add('switching');
    body.classList.add('theme-is-transitioning');

    const commit=()=>{
      dark=next;
      body.classList.toggle('theme-dark',dark);
      body.dataset.theme=dark?'dark':'light';
      btn.setAttribute('aria-pressed',String(dark));
      btn.setAttribute('title',dark?'Ganti ke mode terang':'Ganti ke mode gelap');
      if(meta) meta.setAttribute('content',dark?'#07111c':'#f4f8fb');
    };
    if(!animate){commit();busy=false;btn.classList.remove('switching');body.classList.remove('theme-is-transitioning');return;}
    setTimeout(commit,next?360:250);
    setTimeout(()=>{
      layer?.remove();
      btn.classList.remove('switching');
      body.classList.remove('theme-is-transitioning');
      busy=false;
    },1250);
  };

  // Always start in light mode on a fresh page load.
  body.classList.remove('theme-dark');
  body.dataset.theme='light';
  btn.setAttribute('aria-pressed','false');
  btn.addEventListener('click',e=>setTheme(!dark,{animate:true,event:e}));
})();
