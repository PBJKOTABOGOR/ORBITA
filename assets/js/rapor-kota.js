(() => {
  'use strict';

  const SHEET_ID='1ccDgtXNATxSYMZuDgd3polvRiTFNiFnjIGMP7b9qmrU';
  const SHEETS={index:'INDEX_RAPOT',sirup:'SIRUP_STRUKTUR_ANGGARAN',perencanaan:'PERENCANAAN',realisasi:'REALISASI',monitoring:'MONITORING_JADWAL',itkp:'ITKP',analisis:'ANALISIS_MANUAL'};
  const MONTHS={1:'Januari',2:'Februari',3:'Maret',4:'April',5:'Mei',6:'Juni',7:'Juli',8:'Agustus',9:'September',10:'Oktober',11:'November',12:'Desember'};
  const $=(s,r=document)=>r.querySelector(s), $$=(s,r=document)=>[...r.querySelectorAll(s)];
  const normKey=s=>String(s??'').toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'_').replace(/^_+|_+$/g,'');
  const normText=s=>String(s??'').toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,' ').trim().replace(/\s+/g,' ');
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
  const first=(row,keys,fallback='')=>{for(const k of keys){const nk=normKey(k);if(row&&row[nk]!==undefined&&row[nk]!==null&&String(row[nk]).trim()!=='')return row[nk];}return fallback;};
  const n=value=>{if(typeof value==='number'&&Number.isFinite(value))return value;let s=String(value??'').trim().replace(/Rp/gi,'').replace(/\s/g,'');if(!s||s==='-')return 0;if(s.includes(',')&&s.includes('.'))s=s.replace(/\./g,'').replace(',','.');else if(s.includes(','))s=s.replace(',','.');else if((s.match(/\./g)||[]).length>1)s=s.replace(/\./g,'');s=s.replace(/[^0-9.-]/g,'');const x=Number(s);return Number.isFinite(x)?x:0;};
  const i=v=>Math.round(n(v));
  const pct=v=>{const raw=String(v??'').trim();if(!raw)return 0;if(raw.includes('%'))return n(raw.replace('%',''));const x=n(v);return Math.abs(x)<=1.000001?x*100:x;};
  const num=v=>new Intl.NumberFormat('id-ID').format(i(v));
  const compact=v=>{const x=n(v),a=Math.abs(x);if(a>=1e12)return`Rp ${(x/1e12).toLocaleString('id-ID',{maximumFractionDigits:2})} T`;if(a>=1e9)return`Rp ${(x/1e9).toLocaleString('id-ID',{maximumFractionDigits:2})} M`;if(a>=1e6)return`Rp ${(x/1e6).toLocaleString('id-ID',{maximumFractionDigits:1})} jt`;return`Rp ${new Intl.NumberFormat('id-ID').format(Math.round(x))}`;};
  const percent=v=>`${pct(v).toLocaleString('id-ID',{maximumFractionDigits:2})}%`;

  function tableToRows(table){
    const keys=(table?.cols||[]).map((c,idx)=>normKey(c.label||c.id||`kolom_${idx+1}`));
    return (table?.rows||[]).map(r=>{const o={};(r.c||[]).forEach((cell,idx)=>{const k=keys[idx]||`kolom_${idx+1}`;o[k]=cell?.v??'';o[`__f_${k}`]=cell?.f??cell?.v??'';});return o;});
  }
  function parseCsv(text){
    const rows=[];let row=[],cell='',quoted=false;
    const pushCell=()=>{row.push(cell);cell='';};const pushRow=()=>{pushCell();rows.push(row);row=[];};
    for(let x=0;x<text.length;x++){const ch=text[x];if(quoted){if(ch==='"'&&text[x+1]==='"'){cell+='"';x++;}else if(ch==='"')quoted=false;else cell+=ch;}else{if(ch==='"')quoted=true;else if(ch===',')pushCell();else if(ch==='\n')pushRow();else if(ch!=='\r')cell+=ch;}}
    if(cell.length||row.length)pushRow();return rows.filter(r=>r.some(v=>String(v).trim()!==''));
  }
  function csvRows(text){const matrix=parseCsv(text);if(!matrix.length)return[];const keys=matrix[0].map((h,idx)=>normKey(h||`kolom_${idx+1}`));return matrix.slice(1).map(r=>{const o={};keys.forEach((k,idx)=>o[k]=r[idx]??'');return o;});}
  const scopeOpd=()=>window.TRAXPBJ_SESSION?.opd?.()||'';
  const scopeName=()=>scopeOpd()||'KOTA BOGOR';
  const gvizText=value=>String(value??'').replace(/'/g,"''");
  const scopeQuery=name=>`select * where E = '${gvizText(name||scopeName())}'`;
  function queryJsonp(sheet,timeoutMs=15000,tq=scopeQuery()){
    return new Promise((resolve,reject)=>{const cb=`traxRapor${Date.now()}${Math.random().toString(36).slice(2)}`;const script=document.createElement('script');let done=false;const timer=setTimeout(()=>finish(new Error('timeout')),timeoutMs);const finish=(err,data)=>{if(done)return;done=true;clearTimeout(timer);try{delete window[cb]}catch(_){window[cb]=undefined}script.remove();err?reject(err):resolve(data);};window[cb]=resp=>{if(!resp||resp.status==='error'||!resp.table)return finish(new Error('sheet'));finish(null,tableToRows(resp.table));};script.onerror=()=>finish(new Error('network'));const p=new URLSearchParams({sheet,tq,tqx:`out:json;responseHandler:${cb}`});script.src=`https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?${p}`;script.async=true;document.head.appendChild(script);});
  }
  async function queryFetch(sheet,timeoutMs=15000,tq=scopeQuery()){const ctl=new AbortController(),timer=setTimeout(()=>ctl.abort(),timeoutMs);try{const p=new URLSearchParams({tqx:'out:csv',sheet,tq});const url=`https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?${p}`;const res=await fetch(url,{cache:'no-store',credentials:'omit',signal:ctl.signal});if(!res.ok)throw new Error(`http-${res.status}`);return csvRows(await res.text());}finally{clearTimeout(timer);}}
  async function querySheet(sheet,tq=scopeQuery()){try{return await queryFetch(sheet,8000,tq)}catch(fetchErr){try{return await queryJsonp(sheet,8000,tq)}catch(_){throw fetchErr}}}

  function reportPeriod(){
    const parts=new Intl.DateTimeFormat('en',{timeZone:'Asia/Jakarta',year:'numeric',month:'numeric'}).formatToParts(new Date());
    const year=Number(parts.find(p=>p.type==='year').value),month=Number(parts.find(p=>p.type==='month').value);
    return month===1?{year:year-1,month:12}:{year,month:month-1};
  }
  function latestScopeIndexRows(rows,targetName=scopeName()){
    const period=reportPeriod(),target=normText(targetName),city=!scopeOpd();
    let list=(rows||[]).map((r,order)=>({r,order,id:String(first(r,['id_rapot','id rapot'])).trim(),name:String(first(r,['nama_opd','nama opd','satuan kerja'])).trim(),code:String(first(r,['kode_opd','kode opd'])).trim(),year:i(first(r,['tahun'])),month:i(first(r,['bulan'])),status:normText(first(r,['status_qc','status qc']))})).filter(x=>x.id&&x.year===period.year&&x.month===period.month&&(normText(x.name)===target||(city&&normText(x.code)==='00 kotabogor')));
    if(!list.length)return[];
    const byName=new Map();
    list.forEach(x=>{const key=normText(x.name);const old=byName.get(key);const score=(x.status==='ok'?1:0);const oldScore=old?(old.status==='ok'?1:0):-1;if(!old||score>oldScore||(score===oldScore&&x.order>old.order))byName.set(key,x);});
    return [...byName.values()];
  }
  function rowsForIds(rows,ids){const out=[],seen=new Set();(rows||[]).forEach(r=>{const id=String(first(r,['id_rapot','id rapot'])).trim();if(id&&ids.has(id)&&!seen.has(id)){seen.add(id);out.push(r);}});return out;}
  function analysisRowsForScope(rows,indexes){
    const target=(indexes||[])[0];
    if(!target)return [];
    return rowsForIds(rows,new Set([target.id]));
  }
  function sumField(rows,keys){return (rows||[]).reduce((a,r)=>a+n(first(r,keys)),0);}
  function aggregateSirup(rows){
    const penyedia=sumField(rows,['total_pagu_penyedia']),swak=sumField(rows,['total_pagu_swakelola']),sirup=sumField(rows,['total_pagu_sirup']),struktur=sumField(rows,['total_struktur_anggaran_rup']);
    return {total_pagu_penyedia:penyedia,total_pagu_swakelola:swak,total_pagu_sirup:sirup,total_struktur_anggaran_rup:struktur,persentase:struktur?sirup/struktur*100:0};
  }
  const PLAN_DEFS=[['Tender / Seleksi',['paket_tender_seleksi'],['pagu_tender_seleksi']],['Pengadaan Langsung',['paket_non_tender','paket_pengadaan_langsung'],['pagu_non_tender','pagu_pengadaan_langsung']],['E-Purchasing',['paket_epurchasing','paket_e_purchasing'],['pagu_epurchasing','pagu_e_purchasing']],['Dikecualikan',['paket_pencatatan','paket_dikecualikan'],['pagu_pencatatan','pagu_dikecualikan']],['Swakelola',['paket_swakelola'],['pagu_swakelola']]];
  const REAL_DEFS=[['Tender / Seleksi',['realisasi_paket_tender_seleksi'],['realisasi_tender_seleksi']],['Pengadaan Langsung',['realisasi_paket_non_tender','realisasi_paket_pengadaan_langsung'],['realisasi_non_tender','realisasi_pengadaan_langsung']],['E-Purchasing',['realisasi_paket_epurchasing','realisasi_paket_e_purchasing'],['realisasi_epurchasing','realisasi_e_purchasing']],['Dikecualikan',['realisasi_paket_pencatatan','realisasi_paket_dikecualikan'],['realisasi_pencatatan','realisasi_dikecualikan']],['Swakelola',['realisasi_paket_swakelola'],['realisasi_swakelola']]];
  function aggregateMethods(rows,defs){return defs.map(([label,pks,vks])=>({label,packages:sumField(rows,pks),value:sumField(rows,vks)}));}
  function aggregateMonitoring(rows){return{total_paket:sumField(rows,['total_paket']),sedang_berjalan:sumField(rows,['sedang_berjalan','total_berjalan']),selesai:sumField(rows,['selesai','total_selesai']),melewati_waktu_pemilihan:sumField(rows,['melewati_waktu_pemilihan','total_melewati'])};}
  function aggregateNotes(rows){const vals=[];(rows||[]).forEach(r=>{const v=String(first(r,['kesimpulan_progres','kesimpulan progres'])).trim();if(v&&v!=='-'&&!vals.includes(v))vals.push(v);});return vals.slice(0,12);}

  function renderMethodBars(target,rows){const el=$(target);if(!el)return;const max=Math.max(1,...rows.map(x=>x.value));el.innerHTML=rows.map((x,idx)=>`<div class="rapor-method-row"><div class="rapor-method-copy"><span>${String(idx+1).padStart(2,'0')}</span><b>${x.label}</b><em>${num(x.packages)} paket</em></div><div class="rapor-method-track"><i style="--w:${Math.max(x.value?2:0,x.value/max*100).toFixed(1)}%"></i></div><strong>${compact(x.value)}</strong></div>`).join('');}
  function renderNotes(notes){const el=$('#rkNotes');if(!el)return;if(!notes.length){el.innerHTML='<p>Belum ada catatan rapor.</p>';return;}el.innerHTML=`<ul>${notes.map(x=>`<li>${esc(x)}</li>`).join('')}</ul>`;}
  function renderITKPScope(data){
    const raw=data?.itkp||data;if(!raw)return;
    const scoped=window.TRAXPBJ_SESSION?.scopeItkp?.(raw)||raw;
    const target=scoped?.city||null;if(!target)return;
    setText('#rkItkpScore',Number(target.totalScore||0).toLocaleString('id-ID',{maximumFractionDigits:2}));
    const metrics=scoped?.metrics||[];const host=$('#rkItkpMetrics');if(host)host.innerHTML=metrics.map(m=>`<div class="rapor-itkp-metric"><span>${esc(m.label)}</span><b>${Number(m.value||0).toLocaleString('id-ID',{maximumFractionDigits:1})}%</b><small>${Number(m.score||0).toLocaleString('id-ID',{maximumFractionDigits:2})} / ${Number(m.maxScore||0).toLocaleString('id-ID',{maximumFractionDigits:2})}</small><i style="--w:${Math.max(0,Math.min(100,Number(m.value)||0))}%"></i></div>`).join('');
  }
  function setText(sel,val){const el=$(sel);if(el)el.textContent=val;}

  function render({indexes,sirupRows,planningRows,realRows,monitorRows,notesRows}){
    const year=Math.max(...indexes.map(x=>x.year||0));const maxMonth=Math.max(...indexes.map(x=>x.month||0));const okCount=indexes.filter(x=>x.status==='ok').length;
    const period=$('#raporPeriod');if(period)period.innerHTML=`<span class="rapor-pulse is-live"></span><b>${MONTHS[maxMonth]||''} ${year}</b><em>${indexes.length} unit${okCount?` · ${okCount} QC OK`:''}</em>`;
    const sirup=aggregateSirup(sirupRows);
    setText('#rkPenyedia',compact(sirup.total_pagu_penyedia));setText('#rkSwakelola',compact(sirup.total_pagu_swakelola));setText('#rkSirup',compact(sirup.total_pagu_sirup));setText('#rkPersen',percent(sirup.persentase));const bar=$('#rkPersenBar');if(bar)bar.style.setProperty('--w',`${Math.max(0,Math.min(100,sirup.persentase))}%`);
    const plans=aggregateMethods(planningRows,PLAN_DEFS);renderMethodBars('#rkPlanningMethods',plans);setText('#rkPlanningTotal',`${num(plans.reduce((a,b)=>a+b.packages,0))} paket`);setText('#rkPlanningPagu',compact(plans.reduce((a,b)=>a+b.value,0)));
    const reals=aggregateMethods(realRows,REAL_DEFS);renderMethodBars('#rkRealMethods',reals);setText('#rkRealTotal',`${num(reals.reduce((a,b)=>a+b.packages,0))} paket`);setText('#rkRealValue',compact(reals.reduce((a,b)=>a+b.value,0)));
    const mon=aggregateMonitoring(monitorRows);setText('#rkMonTotal',num(mon.total_paket));setText('#rkMonRun',num(mon.sedang_berjalan));setText('#rkMonDone',num(mon.selesai));setText('#rkMonLate',num(mon.melewati_waktu_pemilihan));
    renderNotes(aggregateNotes(notesRows));$$('.rapor-chapter').forEach(el=>el.classList.remove('is-loading'));
    if(window.TRAXPBJ_LIVE_DATA)renderITKPScope(window.TRAXPBJ_LIVE_DATA);
  }
  function clearReport(){for(const id of ['rkPenyedia','rkSwakelola','rkSirup','rkPersen','rkPlanningTotal','rkPlanningPagu','rkRealTotal','rkRealValue','rkMonTotal','rkMonRun','rkMonDone','rkMonLate','rkItkpScore'])setText('#'+id,'—');for(const id of ['rkPlanningMethods','rkRealMethods','rkNotes','rkItkpMetrics']){const el=$('#'+id);if(el)el.innerHTML='';}$('#rkPersenBar')?.style.setProperty('--w','0%');}
  function renderError(message=`Rapor ${MONTHS[reportPeriod().month]} ${reportPeriod().year} belum tersedia`){
    clearReport();const period=$('#raporPeriod');if(period)period.innerHTML=`<span class="rapor-pulse"></span><b>${esc(message)}</b>`;$$('.rapor-chapter').forEach(el=>el.classList.remove('is-loading'));
  }

  let reportData=null,loadPromise=null,lastLoad=0,loadSeq=0,loadedScope='';
  function syncRaporHeading(){
    const opd=scopeOpd(),label=opd||'Pemerintah Kota Bogor';
    const title=$('#raporScopeTitle'),lead=$('#raporScopeLead'),index=$('#raporScopeIndex');
    if(title)title.textContent=label;
    if(lead)lead.textContent=opd?`Gambaran PBJ ${opd} dari perencanaan, realisasi, proses pemilihan, sampai pemanfaatan sistem pengadaan.`:'Gambaran PBJ Pemerintah Kota Bogor dari perencanaan, realisasi, proses pemilihan, sampai pemanfaatan sistem pengadaan.';
    if(index)index.textContent=opd?'05 · RAPOR PBJ PERANGKAT DAERAH':'05 · RAPOR PBJ KOTA BOGOR';
  }
  function applyReportScope(){
    syncRaporHeading();
    const requested=scopeName(),key=normText(requested);
    if(!reportData||loadedScope!==key){clearReport();return;}
    const indexes=latestScopeIndexRows(reportData[0],requested);if(!indexes.length){renderError(`Rapor ${MONTHS[reportPeriod().month]} ${reportPeriod().year} · ${requested.toUpperCase()} belum tersedia`);return;}
    const ids=new Set(indexes.map(x=>x.id));
    render({indexes,sirupRows:rowsForIds(reportData[1],ids),planningRows:rowsForIds(reportData[2],ids),realRows:rowsForIds(reportData[3],ids),monitorRows:rowsForIds(reportData[4],ids),notesRows:analysisRowsForScope(reportData[5],indexes)});
  }
  async function load(force=false){
    if(loadPromise&&!force)return loadPromise;
    const seq=++loadSeq,requested=scopeName(),scopeKey=normText(requested);
    const job=(async()=>{try{
      const indexRows=await querySheet(SHEETS.index,'select *');
      if(seq!==loadSeq)return;
      const indexes=latestScopeIndexRows(indexRows,requested);
      if(!indexes.length){reportData=[indexRows,[],[],[],[],[]];loadedScope=scopeKey;lastLoad=Date.now();applyReportScope();return;}
      const matched=indexes[0].name||requested;
      const tq=scopeQuery(matched);
      const details=await Promise.all([SHEETS.sirup,SHEETS.perencanaan,SHEETS.realisasi,SHEETS.monitoring,SHEETS.analisis].map(sheet=>querySheet(sheet,tq)));
      if(seq!==loadSeq)return;
      reportData=[indexRows,...details];loadedScope=scopeKey;lastLoad=Date.now();applyReportScope();
    }catch(e){if(seq!==loadSeq)return;console.warn('TRAXPBJ Rapor:',e);reportData=null;loadedScope='';renderError('Rapor belum dapat dimuat.');}
    finally{if(loadPromise===job)loadPromise=null;}})();
    loadPromise=job;return job;
  }
  syncRaporHeading();
  document.addEventListener('trax:session-change',()=>{reportData=null;loadedScope='';clearReport();syncRaporHeading();if(loaded)load(true)});
  setInterval(()=>{if(loaded&&!document.hidden&&$('#rapor-kota')?.getBoundingClientRect().bottom>0&&$('#rapor-kota')?.getBoundingClientRect().top<innerHeight)load(true)},30000);

  document.addEventListener('trax:live-data',e=>renderITKPScope(e.detail));

  const chapters=$$('.rapor-chapter');
  const io=new IntersectionObserver(entries=>{entries.forEach(e=>{if(e.isIntersecting)e.target.classList.add('is-visible');});const visible=entries.filter(e=>e.isIntersecting).sort((a,b)=>b.intersectionRatio-a.intersectionRatio)[0];if(visible)chapters.forEach(c=>c.classList.toggle('is-current',c===visible.target));},{threshold:[.18,.35,.55,.72],rootMargin:'-12% 0px -18% 0px'});
  chapters.forEach(c=>io.observe(c));
  let loaded=false;const section=$('#rapor-kota');if(section){const lazy=new IntersectionObserver(entries=>{if(entries.some(e=>e.isIntersecting)&&!loaded){loaded=true;lazy.disconnect();load();}},{rootMargin:'1200px 0px'});lazy.observe(section);if(location.hash==='#rapor-kota'){loaded=true;lazy.disconnect();load();}}
})();
