(() => {
  'use strict';
  const $=(s,c=document)=>c.querySelector(s);
  const $$=(s,c=document)=>[...c.querySelectorAll(s)];
  const idNum=new Intl.NumberFormat('id-ID');
  const idDec=new Intl.NumberFormat('id-ID',{minimumFractionDigits:2,maximumFractionDigits:2});
  const colors=['#f05a64','#f0a34a','#2389d7','#21b58f'];
  const labels=['Tidak Memuaskan','Kurang Memuaskan','Memuaskan','Sangat Memuaskan'];
  let store=window.TRAXPBJ_EVALUATIONS||{currentYear:2026,years:{'2026':window.TRAXPBJ_EVALUATION||null}};
  let activeYear=String(store.currentYear||2026);
  let activeIndex=0;
  const scene=$('#evaluationExperience');
  const total=(arr=[])=>arr.reduce((a,b)=>a+(Number(b)||0),0);

  const yearData=year=>store?.years?.[String(year)]||null;
  const normalizedData=year=>{
    const d=yearData(year)||{year:Number(year),title:`Evaluasi Pengguna Layanan ${year}`,period:String(year),parameters:[]};
    const params=(Array.isArray(d.parameters)?d.parameters:[]).map(p=>{
      const counts=(Array.isArray(p.counts)?p.counts:[0,0,0,0]).slice(0,4).map(v=>Math.max(0,Number(v)||0));
      while(counts.length<4)counts.push(0);
      const votes=total(counts);
      const weighted=counts.reduce((s,v,i)=>s+v*(i+1),0);
      const score4=votes?weighted/votes:0;
      const scorePct=votes?score4/4*100:0;
      return {...p,counts,votes,score4,scorePct};
    });
    const categoryTotals=[0,0,0,0];
    params.forEach(p=>p.counts.forEach((v,i)=>categoryTotals[i]+=v));
    const allVotes=total(categoryTotals);
    const weightedAll=categoryTotals.reduce((s,v,i)=>s+v*(i+1),0);
    const computedIkm=allVotes?weightedAll/allVotes:0;
    let ikm=(d.ikm!==null&&d.ikm!==undefined&&Number.isFinite(Number(d.ikm)))?Number(d.ikm):computedIkm;if(ikm>4)ikm=ikm/25;
    const maxRespondents=params.reduce((m,p)=>Math.max(m,p.votes),0);
    return {...d,params,categoryTotals,allVotes,respondents:Number(d.respondents)||maxRespondents,ikm};
  };

  const renderYears=()=>{
    const host=$('#evaluationYears'); if(!host)return;
    const years=['2023','2024','2025','2026'];
    host.innerHTML=years.map(y=>`<button type="button" data-eval-year="${y}" class="${y===activeYear?'active':''}"><span>${y}</span>${y==='2026'?'<i>TAHUN BERJALAN</i>':''}</button>`).join('');
    $$('[data-eval-year]',host).forEach(btn=>btn.addEventListener('click',()=>{
      const y=btn.dataset.evalYear;if(y===activeYear)return;
      activeYear=y;activeIndex=0;
      const grid=$('#evaluationStoryGrid');grid?.classList.add('is-year-switching');
      setTimeout(()=>{render();grid?.classList.remove('is-year-switching');},150);
    }));
  };

  const renderFocus=(d,index,animate=true)=>{
    const chart=$('#evaluationChart');
    if(!chart||!d.params.length)return;
    activeIndex=Math.max(0,Math.min(d.params.length-1,index));
    const p=d.params[activeIndex];
    const maxCount=Math.max(1,...p.counts);
    const focus=chart.querySelector('.evaluation-focus');
    if(focus && animate){focus.classList.add('is-switching');setTimeout(()=>paintFocus(),150);}else paintFocus();

    function paintFocus(){
      const host=chart.querySelector('.evaluation-focus');if(!host)return;
      host.innerHTML=`
        <div class="evaluation-focus-top">
          <div><small>PARAMETER ${String(activeIndex+1).padStart(2,'0')} / ${String(d.params.length).padStart(2,'0')}</small><h3>${p.name}</h3></div>
          <div class="evaluation-focus-score"><strong>${p.votes?idDec.format(p.score4):'—'}</strong><span>${p.votes?'dari 4':'belum ada penilaian'}</span></div>
        </div>
        <div class="evaluation-focus-bars">${p.counts.map((v,i)=>`<div class="evaluation-focus-bar"><div><span><i style="--c:${colors[i]}"></i>${labels[i]}</span><b>${p.votes?idNum.format(v):'—'}</b></div><em><u style="--c:${colors[i]};--w:${p.votes?(v/maxCount*100):0}%"></u></em></div>`).join('')}</div>
        <div class="evaluation-focus-foot"><span>${p.votes?`${idNum.format(p.votes)} penilaian`:'Belum ada penilaian'}</span><div><button type="button" data-eval-prev aria-label="Parameter sebelumnya">←</button><button type="button" data-eval-next aria-label="Parameter berikutnya">→</button></div></div>`;
      host.classList.remove('is-switching');host.classList.remove('is-entering');void host.offsetWidth;host.classList.add('is-entering');
      $('[data-eval-prev]',host)?.addEventListener('click',()=>renderFocus(d,(activeIndex-1+d.params.length)%d.params.length));
      $('[data-eval-next]',host)?.addEventListener('click',()=>renderFocus(d,(activeIndex+1)%d.params.length));
      $$('.evaluation-rail-button',chart).forEach((b,i)=>b.classList.toggle('active',i===activeIndex));
      chart.querySelector(`.evaluation-rail-button[data-eval-index="${activeIndex}"]`)?.scrollIntoView({behavior:'smooth',inline:'center',block:'nearest'});
    }
  };

  const render=()=>{
    const d=normalizedData(activeYear);const params=d.params;
    renderYears();
    $('#evaluationPeriod').textContent=d.period||activeYear;
    $('#evaluationIkm').textContent=d.ikm>0?idDec.format(d.ikm):'—';
    $('#evaluationQuality').textContent=d.ikm>0?'dari 4':'Belum ada nilai';
    $('#evaluationRespondents').textContent=d.respondents?idNum.format(d.respondents):'—';
    $('#evaluationParameterCount').textContent=idNum.format(params.length||14);
    const ring=$('#evaluationScoreRing');if(ring){const pct=d.ikm>0?Math.max(0,Math.min(100,d.ikm/4*100)):0;ring.style.strokeDashoffset=String(452.39*(1-pct/100));}
    $('#evaluationLegend').innerHTML=labels.map((l,i)=>`<span><i style="--c:${colors[i]}"></i>${l}</span>`).join('');
    const allVotes=total(d.categoryTotals);
    $('#evaluationDistribution').innerHTML=`<small>DISTRIBUSI PENILAIAN</small>`+d.categoryTotals.map((v,i)=>{const pct=allVotes?v/allVotes*100:0;return `<div class="evaluation-dist-row"><span><i style="--c:${colors[i]}"></i>${labels[i]}</span><b>${allVotes?idNum.format(v):'—'}</b><em><u style="--c:${colors[i]};--w:${pct}%"></u></em></div>`;}).join('');

    const chart=$('#evaluationChart');if(!chart)return;
    if(!params.length){chart.innerHTML='<div class="evaluation-empty">Belum ada data evaluasi.</div>';return;}
    chart.innerHTML=`<div class="evaluation-focus"></div><div class="evaluation-rail" role="tablist" aria-label="Parameter penilaian">${params.map((p,i)=>`<button type="button" class="evaluation-rail-button" data-eval-index="${i}" title="${p.name}"><span>${String(i+1).padStart(2,'0')}</span><b>${p.name}</b></button>`).join('')}</div>`;
    $$('.evaluation-rail-button',chart).forEach((b,i)=>b.addEventListener('click',()=>renderFocus(d,i)));
    renderFocus(d,Math.min(activeIndex,params.length-1),false);
    const detail=$('#evaluationDetail');if(detail){detail.hidden=true;detail.innerHTML='';}
  };

  const open=(fromPop=false)=>{if(!scene)return;render();scene.classList.add('active');scene.setAttribute('aria-hidden','false');document.body.classList.add('evaluation-open');if(!fromPop&&location.hash!=='#evaluasi-layanan')history.pushState({traxPanel:'evaluation',fromTopbar:window.TRAXPBJ_CONSUME_TOPBAR_ENTRY?.()===true},'',location.pathname+location.search+'#evaluasi-layanan');};
  const close=(fromPop=false)=>{if(!scene?.classList.contains('active'))return;scene.classList.remove('active');scene.setAttribute('aria-hidden','true');document.body.classList.remove('evaluation-open');if(!fromPop&&location.hash==='#evaluasi-layanan'){if((history.state?.fromTopbar||window.TRAXPBJ_SHOULD_RETURN_PROFILE_HOME?.('#evaluasi-layanan'))&&window.TRAXPBJ_RETURN_PROFILE_HOME){window.TRAXPBJ_RETURN_PROFILE_HOME();return;}history.back();return;}};

  document.addEventListener('trax:open-evaluation',()=>open(false));
  document.addEventListener('trax:content-ready',e=>{store=e.detail?.evaluations||store;if(scene?.classList.contains('active'))render();});
  $$('[data-close-evaluation]').forEach(el=>el.addEventListener('click',()=>close(false)));
  addEventListener('keydown',e=>{if(!scene?.classList.contains('active'))return;if(e.key==='Escape')close(false);const d=normalizedData(activeYear);if(!d.params.length)return;if(e.key==='ArrowRight')renderFocus(d,(activeIndex+1)%d.params.length);if(e.key==='ArrowLeft')renderFocus(d,(activeIndex-1+d.params.length)%d.params.length);});
  addEventListener('popstate',()=>{if(location.hash==='#evaluasi-layanan')open(true);else close(true);});
  if(location.hash==='#evaluasi-layanan')requestAnimationFrame(()=>open(true));
})();
