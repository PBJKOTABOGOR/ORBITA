(() => {
  'use strict';

  const canvas=document.getElementById('docsAmbientCanvas');
  const modal=document.getElementById('docsModal');
  const stage=document.getElementById('docsTimelineStage');
  if(!canvas||!modal||!stage)return;
  const ctx=canvas.getContext('2d',{alpha:true,desynchronized:true});
  if(!ctx)return;

  const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
  const DPR_MAX=1.5;
  const colors=['#f3a1a5','#f0bf58','#b889b0','#d98b7b'];
  let dpr=1,w=1,h=1,raf=0,last=0,open=false;
  let dots=[],links=[];
  let pointer={x:.5,y:.5,tx:.5,ty:.5};

  const clamp=(n,a=0,b=1)=>Math.max(a,Math.min(b,n));
  const hash=n=>{const x=Math.sin(n*12.9898+78.233)*43758.5453;return x-Math.floor(x)};

  function resize(){
    const r=stage.getBoundingClientRect();
    w=Math.max(1,Math.round(r.width));h=Math.max(1,Math.round(r.height));
    dpr=Math.min(devicePixelRatio||1,DPR_MAX);
    canvas.width=Math.round(w*dpr);canvas.height=Math.round(h*dpr);
    canvas.style.width=w+'px';canvas.style.height=h+'px';
    ctx.setTransform(dpr,0,0,dpr,0,0);
    build();
  }

  function build(){
    const count=w<700?28:46;
    dots=Array.from({length:count},(_,i)=>({
      x:hash(i+11)*w,
      y:hash(i+97)*h,
      ox:(hash(i+151)-.5)*18,
      oy:(hash(i+211)-.5)*14,
      r:.8+hash(i+277)*1.5,
      a:.18+hash(i+331)*.4,
      c:colors[Math.floor(hash(i+401)*colors.length)%colors.length],
      p:hash(i+509)*Math.PI*2
    }));
    links=[];
    const max=w<700?106:136;
    for(let i=0;i<dots.length;i++){
      const near=[];
      for(let j=i+1;j<dots.length;j++){
        const dx=dots[i].x-dots[j].x,dy=dots[i].y-dots[j].y,d=Math.hypot(dx,dy);
        if(d<max)near.push([j,d]);
      }
      near.sort((a,b)=>a[1]-b[1]);
      near.slice(0,w<700?1:2).forEach(([j])=>links.push([i,j]));
    }
  }

  function rgba(hex,a){
    const n=parseInt(hex.slice(1),16),r=(n>>16)&255,g=(n>>8)&255,b=n&255;
    return `rgba(${r},${g},${b},${a})`;
  }

  function draw(now){
    if(!open){raf=0;return}
    const dt=last?Math.min(2,(now-last)/16.67):1;last=now;
    pointer.x+=(pointer.tx-pointer.x)*Math.min(.08,.035*dt);
    pointer.y+=(pointer.ty-pointer.y)*Math.min(.08,.035*dt);
    ctx.clearRect(0,0,w,h);

    const px=(pointer.x-.5)*10,py=(pointer.y-.5)*8;
    const positions=dots.map((d,i)=>({
      x:d.x+Math.sin(now*.00012+i)*d.ox+px,
      y:d.y+Math.cos(now*.0001+i*.7)*d.oy+py
    }));

    ctx.save();
    ctx.lineWidth=1;
    for(const [a,b] of links){
      const A=positions[a],B=positions[b],da=dots[a],db=dots[b];
      const alpha=.10+Math.sin(now*.0008+da.p)*.022;
      ctx.strokeStyle=rgba(da.c,alpha);
      ctx.beginPath();ctx.moveTo(A.x,A.y);ctx.lineTo(B.x,B.y);ctx.stroke();
      const mx=(A.x+B.x)/2,my=(A.y+B.y)/2;
      ctx.fillStyle=rgba(db.c,.11);ctx.beginPath();ctx.arc(mx,my,.7,0,Math.PI*2);ctx.fill();
    }
    positions.forEach((p,i)=>{
      const d=dots[i],pulse=.65+.35*Math.sin(now*.001+d.p);
      ctx.fillStyle=rgba(d.c,d.a*pulse);
      ctx.beginPath();ctx.arc(p.x,p.y,d.r*(.9+.1*pulse),0,Math.PI*2);ctx.fill();
    });
    ctx.restore();
    raf=requestAnimationFrame(draw);
  }

  function start(){
    if(reduced)return;
    open=true;
    if(!raf){last=performance.now();raf=requestAnimationFrame(draw)}
  }
  function stop(){open=false;if(raf)cancelAnimationFrame(raf);raf=0;ctx.clearRect(0,0,w,h)}

  stage.addEventListener('pointermove',e=>{
    const r=stage.getBoundingClientRect();
    pointer.tx=clamp((e.clientX-r.left)/Math.max(1,r.width));
    pointer.ty=clamp((e.clientY-r.top)/Math.max(1,r.height));
  },{passive:true});
  stage.addEventListener('pointerleave',()=>{pointer.tx=.5;pointer.ty=.5},{passive:true});
  addEventListener('resize',resize,{passive:true});
  document.addEventListener('visibilitychange',()=>{if(document.hidden)stop();else if(modal.classList.contains('open'))start()});

  const obs=new MutationObserver(()=>{const isOpen=modal.classList.contains('open');if(isOpen){resize();start()}else stop()});
  obs.observe(modal,{attributes:true,attributeFilter:['class']});
  resize();
  if(modal.classList.contains('open'))start();
})();
