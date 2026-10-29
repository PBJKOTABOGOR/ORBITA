(() => {
  'use strict';

  const SOURCES = {
    sdm: { id: '181iiPjY6AiW1dMZIu14fouSzpPVB5Wwon-mmReU7v8I', sheet: 'SDM' },
    itkp: { id: '1OCmZUvwa48ieHrswASks4J1v9JY8ikIZ4hKwiIXSWyU', sheet: 'FIX ITKP OPD' },
    planning: { id: '1ccDgtXNATxSYMZuDgd3polvRiTFNiFnjIGMP7b9qmrU', sheet: 'D_PERENCANAAN' },
    realization: { id: '1ccDgtXNATxSYMZuDgd3polvRiTFNiFnjIGMP7b9qmrU', sheet: 'D_REALISASI_MAP' },
    raporIndex: { id: '1ccDgtXNATxSYMZuDgd3polvRiTFNiFnjIGMP7b9qmrU', sheet: 'INDEX_RAPOT' },
    raporPlanning: { id: '1ccDgtXNATxSYMZuDgd3polvRiTFNiFnjIGMP7b9qmrU', sheet: 'PERENCANAAN' },
    raporRealization: { id: '1ccDgtXNATxSYMZuDgd3polvRiTFNiFnjIGMP7b9qmrU', sheet: 'REALISASI' }
  };

  window.TRAXPBJ_LIVE_SOURCES = SOURCES;

  const norm = value => String(value ?? '')
    .normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().replace(/\s+/g, '');

  const cleanName = value => String(value ?? '').trim()
    .replace(/\s*-\s*\d+(?:\.\d+){2,}(?:\.\d+)*\s*$/g, '')
    .replace(/\s{2,}/g, ' ').trim();

  const asNumber = value => {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (value == null || value === '') return 0;
    let s = String(value).trim().replace(/\u00a0/g,' ').replace(/\s/g,'').replace(/Rp/gi,'');
    const isPct = s.endsWith('%');
    if (isPct) s = s.slice(0,-1);
    s = s.replace(/[^0-9,.-]/g,'');
    if (!s) return 0;

    const commas=(s.match(/,/g)||[]).length;
    const dots=(s.match(/\./g)||[]).length;
    if (commas && dots) {
      const lastComma=s.lastIndexOf(','), lastDot=s.lastIndexOf('.');
      const decimalSep=lastComma>lastDot?',':'.';
      const thousandSep=decimalSep===','?'.':',';
      const tail=s.slice(Math.max(lastComma,lastDot)+1);
      if (tail.length<=2) s=s.split(thousandSep).join('').replace(decimalSep,'.');
      else s=s.replace(/[.,]/g,'');
    } else if (commas>1) {
      s=s.replace(/,/g,'');
    } else if (dots>1) {
      s=s.replace(/\./g,'');
    } else if (commas===1) {
      const tail=s.split(',').pop();
      s=tail.length===3 && !isPct ? s.replace(',','') : s.replace(',','.');
    } else if (dots===1) {
      const tail=s.split('.').pop();
      if (tail.length===3 && !isPct) s=s.replace('.','');
    }
    const n=Number(s);
    if (!Number.isFinite(n)) return 0;
    return isPct ? n/100 : n;
  };

  function querySheetJsonp(source, timeoutMs=14000) {
    return new Promise((resolve, reject) => {
      const cb = `traxGviz${Date.now()}${Math.random().toString(36).slice(2)}`;
      const script = document.createElement('script');
      let done = false;
      const timer = setTimeout(() => finish(new Error('timeout')), timeoutMs);
      function finish(err, data) {
        if (done) return; done = true;
        clearTimeout(timer);
        try { delete window[cb]; } catch (_) { window[cb] = undefined; }
        script.remove();
        err ? reject(err) : resolve(data);
      }
      window[cb] = response => {
        if (!response || response.status === 'error' || !response.table) {
          finish(new Error(response?.errors?.[0]?.detailed_message || 'sheet-unavailable'));
          return;
        }
        finish(null, response.table);
      };
      script.onerror = () => finish(new Error('network-or-permission'));
      const params = new URLSearchParams({ sheet: source.sheet, tqx: `out:json;responseHandler:${cb}` });
      script.src = `https://docs.google.com/spreadsheets/d/${source.id}/gviz/tq?${params}`;
      script.async = true;
      document.head.appendChild(script);
    });
  }

  function parseCsv(text) {
    const rows=[]; let row=[], cell='', quoted=false;
    const pushCell=()=>{row.push(cell);cell='';};
    const pushRow=()=>{pushCell();rows.push(row);row=[];};
    for(let i=0;i<text.length;i++){
      const ch=text[i];
      if(quoted){
        if(ch==='"' && text[i+1]==='"'){cell+='"';i++;}
        else if(ch==='"'){quoted=false;}
        else cell+=ch;
      }else{
        if(ch==='"')quoted=true;
        else if(ch===',')pushCell();
        else if(ch==='\n')pushRow();
        else if(ch!=='\r')cell+=ch;
      }
    }
    if(cell.length||row.length)pushRow();
    return rows.filter(r=>r.some(v=>String(v).trim()!==''));
  }

  async function querySheetFetch(source, timeoutMs=14000) {
    const ctl=new AbortController(); const timer=setTimeout(()=>ctl.abort(),timeoutMs);
    try{
      const url=`https://docs.google.com/spreadsheets/d/${source.id}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(source.sheet)}`;
      const res=await fetch(url,{cache:'no-store',signal:ctl.signal,credentials:'omit'});
      if(!res.ok)throw new Error(`http-${res.status}`);
      const matrix=parseCsv(await res.text());
      if(!matrix.length)throw new Error('empty-sheet');
      const headers=matrix[0];
      return {cols:headers.map((label,i)=>({label:label||`Kolom ${i+1}`,id:`C${i}`})),rows:matrix.slice(1).map(r=>({c:headers.map((_,i)=>({v:r[i]??'',f:r[i]??''}))}))};
    }finally{clearTimeout(timer);}
  }

  async function querySheet(source, timeoutMs=10000) {
    try{return await querySheetFetch(source,timeoutMs);}catch(fetchError){
      try{return await querySheetJsonp(source,timeoutMs);}catch(_){throw fetchError;}
    }
  }

  function tableShape(table) {
    const headers = (table.cols || []).map((c,i) => String(c.label || c.id || `kolom_${i+1}`).trim() || `Kolom ${i+1}`);
    const keys = headers.map(norm);
    const rows = (table.rows || []).map((r,ri) => {
      const record = { __index: ri };
      (r.c || []).forEach((cell,i) => {
        const raw = cell ? cell.v : null;
        record[keys[i]] = raw;
        record[`__f_${keys[i]}`] = cell?.f ?? raw;
      });
      return record;
    });
    return {headers, keys, rows};
  }

  function pickKey(keys, candidates, mode='contains') {
    const cs = candidates.map(norm);
    for (const c of cs) {
      const exact = keys.find(k => k === c);
      if (exact) return exact;
    }
    if (mode === 'contains') {
      for (const c of cs) {
        const found = keys.find(k => k.includes(c) || c.includes(k));
        if (found) return found;
      }
    }
    return null;
  }

  function parseSDM(table) {
    const {headers, keys, rows} = tableShape(table);
    const nameKey = pickKey(keys,['JF','Jabatan Fungsional','Jenjang']);
    const currentKey = pickKey(keys,['Eksisting','Existing','Realisasi','Saat ini']);
    const targetKey = pickKey(keys,['Target','Target:']);
    if (!nameKey || !currentKey || !targetKey) throw new Error('kolom-sdm-tidak-dikenali');
    const wanted = rows.map(r => ({
      name: cleanName(r[nameKey]),
      current: asNumber(r[currentKey]),
      target: asNumber(r[targetKey])
    })).filter(x => x.name && (x.current || x.target));
    const targetBreakdown = wanted.map(x => ({name:x.name,value:x.target}));
    const realizationBreakdown = wanted.map(x => ({name:x.name,value:x.current}));
    return {
      title:'JF PPBJ Kota Bogor',
      target:wanted.reduce((a,b)=>a+b.target,0),
      realization:wanted.reduce((a,b)=>a+b.current,0),
      targetBreakdown, realizationBreakdown,
      source:{headers}
    };
  }

  function percentValue(raw, formatted) {
    if (typeof formatted === 'string' && formatted.includes('%')) {
      const s=formatted.replace('%','').trim().replace(',','.');
      const n=Number(s); return Number.isFinite(n)?n:0;
    }
    const n = asNumber(raw);
    return Math.abs(n) <= 1.000001 ? n * 100 : n;
  }

  const ITKP_LABELS=[
    'Pengumuman RUP','RUP Penyedia diumumkan','RUP e-Tendering + e-Purchasing',
    'Realisasi e-Tendering + e-Purchasing','Realisasi Pengadaan Langsung',
    'Realisasi Penunjukan Langsung','Realisasi Digitalisasi PBJ'
  ];
  const ITKP_MAX=[5,2.5,2.5,10,2.5,2.5,5];
  function scoreITKP(i,p){
    p=Number(p)||0;
    if(i===0){ if(p>=150)return 0;if(p>=110)return 4;if(p>=90)return 5;if(p>=80)return 4;if(p>=70)return 3;if(p>=60)return 2;if(p>=50)return 1;return 0; }
    if(i===1){ if(p>=80)return 2.5;if(p>=70)return 2;if(p>=60)return 1.5;if(p>=50)return 1;if(p>=40)return .5;return 0; }
    if(i===2){ if(p>=60)return 2.5;if(p>=50)return 2;if(p>=40)return 1.5;if(p>=30)return 1;if(p>=20)return .5;return 0; }
    if(i===3){ if(p>=60)return 10;if(p>=50)return 8;if(p>=40)return 6;if(p>=30)return 4;if(p>=20)return 2;return 0; }
    if(i===4||i===5){ if(p>=50)return 2.5;if(p>=40)return 2;if(p>=30)return 1.5;if(p>=20)return 1;if(p>=10)return .5;return 0; }
    if(i===6){ if(p>=80)return 5;if(p>=70)return 4;if(p>=60)return 3;if(p>=50)return 2;if(p>=40)return 1;return 0; }
    return 0;
  }

  function parseITKP(table) {
    const {headers, keys, rows} = tableShape(table);
    const opdKey = pickKey(keys,['Satuan Kerja','Nama Satuan Kerja','OPD','Satker']);
    if (!opdKey) throw new Error('kolom-opd-tidak-dikenali');
    const percentKeys = keys.filter(k => k.includes('prosentase') || k.includes('persentase')).slice(0,7);
    let scoreKeys = keys.filter(k => (k.includes('nilaiitkp') || (k.includes('itkp') && k.includes('skor'))) && !k.includes('pemanfaatansistem')).slice(0,7);
    // Beberapa header total juga memuat kata ITKP; pairing kolom persentase + kolom sesudahnya lebih stabil.
    scoreKeys = percentKeys.map(pk=>{ const idx=keys.indexOf(pk); return keys[idx+1] || null; }).filter(Boolean);
    const totalScoreKey = keys.find(k => k.includes('nilaiitkpindikatorpemanfaatansistem') || (k.includes('skormaksimal30') && k.includes('itkp')));
    const metricSourceKeys = percentKeys.map((pk,i)=>{
      const idx=keys.indexOf(pk);
      if(idx<2) return {numKey:null,denKey:null};
      return {numKey:i===6?keys[idx-1]:keys[idx-2], denKey:i===6?keys[idx-2]:keys[idx-1]};
    });

    const data = rows.map(r => {
      const name = cleanName(r[opdKey]); if (!name) return null;
      const percentages = percentKeys.map(k=>percentValue(r[k],r[`__f_${k}`]));
      const scores = scoreKeys.map((k,i)=>{ const v=asNumber(r[k]); return Number.isFinite(v)?v:scoreITKP(i,percentages[i]); });
      const pairs = metricSourceKeys.map(({numKey,denKey})=>({num:asNumber(r[numKey]),den:asNumber(r[denKey])}));
      const totalScore = totalScoreKey ? asNumber(r[totalScoreKey]) : scores.reduce((a,b)=>a+b,0);
      return {name,totalScore,scores,percentages,pairs};
    }).filter(Boolean).filter(r => r.totalScore || r.percentages.some(Boolean) || (r.pairs||[]).some(p=>p.num||p.den));
    data.sort((a,b)=>b.totalScore-a.totalScore || a.name.localeCompare(b.name,'id'));

    // Kota Bogor sudah memiliki baris rekap sendiri pada FIX ITKP OPD.
    // Jangan menjumlahkan seluruh OPD: baris rekap tersebut sudah memuat totalnya.
    const cityRow=data.find(r=>norm(r.name)==='pemerintahkotabogor');
    if(!cityRow)throw new Error('baris-pemerintah-kota-bogor-tidak-ditemukan');
    if(!totalScoreKey)throw new Error('kolom-total-itkp-tidak-ditemukan');
    const city={
      name:'Pemerintah Kota Bogor',
      percentages:[...cityRow.percentages],
      scores:[...cityRow.scores],
      totalScore:cityRow.totalScore,
      pairs:cityRow.pairs.map(p=>({...p}))
    };
    const metrics=ITKP_LABELS.map((label,i)=>({label,value:city.percentages[i],score:city.scores[i],maxScore:ITKP_MAX[i],pair:city.pairs?.[i]||{num:0,den:0}}));
    return { rows:data, city, average:city.totalScore, maxScore:30, scoreMaxes:ITKP_MAX, metrics, source:{headers} };
  }

  function normalizeMethod(value) {
    const s = String(value ?? '').toLowerCase();
    if (s.includes('swakelola')) return 'Swakelola';
    if (s.includes('e-purch') || s.includes('epurch') || s.includes('katalog')) return 'E-Purchasing';
    if (s.includes('pengadaan langsung')) return 'Pengadaan Langsung';
    if (s.includes('penunjukan langsung')) return 'Penunjukan Langsung';
    if (s.includes('tender cepat')) return 'Tender Cepat';
    if (s.includes('tender') || s.includes('seleksi')) return 'Tender / Seleksi';
    if (s.includes('dikecualikan')) return 'Dikecualikan';
    return 'Lainnya';
  }

  function parseProcurementTable(table, kind) {
    const {headers, keys, rows} = tableShape(table);
    const nameKey = pickKey(keys,['nama satker','satuan kerja','nama satuan kerja','nama opd','opd','satker','nama_satker']);
    const methodKey = pickKey(keys,['metode pengadaan','metode pemilihan','metode','cara pengadaan','metode_pengadaan']);
    const yearKey = pickKey(keys,['tahun anggaran','tahun','tahun_anggaran']);
    const packageKey = kind === 'planning'
      ? pickKey(keys,['kode rup','id rup','kode_rup','id_rup','kode paket','id paket'])
      : pickKey(keys,['kode paket','id paket','kode tender','kode nontender','kode transaksi','nomor paket','kode_paket']);
    const valueKey = kind === 'planning'
      ? pickKey(keys,['pagu rup','pagu pengadaan','pagu','nilai rup','nilai pagu','pagu_rup'])
      : pickKey(keys,['total realisasi','nilai realisasi','realisasi','nilai kontrak','nilai transaksi','total harga','nilai_realisasi']);

    if (!nameKey || !valueKey) throw new Error(`kolom-${kind}-tidak-dikenali`);
    const grouped = new Map();
    rows.forEach((r,i) => {
      if (yearKey) {
        const y = String(r[yearKey] ?? '').match(/20\d{2}/)?.[0];
        if (y && y !== '2026') return;
      }
      const name = cleanName(r[nameKey]); if (!name) return;
      const rawId = packageKey ? String(r[packageKey] ?? '').trim() : '';
      const id = rawId || `${kind}-${i}`;
      const method = normalizeMethod(methodKey ? r[methodKey] : '');
      const value = asNumber(r[valueKey]);
      const key = `${id}`;
      if (!grouped.has(key)) grouped.set(key,{id,name,method,value});
      else {
        const g=grouped.get(key);
        // D_REALISASI_MAP umumnya sudah membawa total paket; max mencegah nilai total yang berulang terhitung berkali-kali.
        g.value = Math.max(g.value,value);
        if (g.method==='Lainnya' && method!=='Lainnya') g.method=method;
        if (!g.name && name) g.name=name;
      }
    });
    return {items:[...grouped.values()], source:{headers, mapping:{nameKey,methodKey,packageKey,valueKey,yearKey}}};
  }

  function build2026(planningTable, realizationTable) {
    const p = parseProcurementTable(planningTable,'planning');
    const r = parseProcurementTable(realizationTable,'realization');
    const methods = ['E-Purchasing','Pengadaan Langsung','Tender / Seleksi','Penunjukan Langsung','Tender Cepat','Swakelola','Dikecualikan','Lainnya'];
    const satkers = new Map();
    const md = Object.fromEntries(methods.map(m=>[m,{planningPackages:0,planningValue:0,realizationPackages:0,realizationValue:0,satker:new Map()}]));
    const touch=(name)=>{ if(!satkers.has(name)) satkers.set(name,{name,planningPackages:0,planningValue:0,realizationPackages:0,realizationValue:0}); return satkers.get(name); };
    const touchM=(method,name)=>{ const bucket=md[method]||md.Lainnya; if(!bucket.satker.has(name)) bucket.satker.set(name,{name,planningPackages:0,planningValue:0,realizationPackages:0,realizationValue:0}); return [bucket,bucket.satker.get(name)]; };
    p.items.forEach(x=>{ const s=touch(x.name); s.planningPackages++; s.planningValue+=x.value; const [b,ms]=touchM(x.method,x.name); b.planningPackages++; b.planningValue+=x.value; ms.planningPackages++; ms.planningValue+=x.value; });
    r.items.forEach(x=>{ const s=touch(x.name); s.realizationPackages++; s.realizationValue+=x.value; const [b,ms]=touchM(x.method,x.name); b.realizationPackages++; b.realizationValue+=x.value; ms.realizationPackages++; ms.realizationValue+=x.value; });
    const planningMethods=methods.map(name=>({name,packages:md[name].planningPackages,value:md[name].planningValue})).filter(x=>x.packages||x.value);
    const realizationMethods=methods.map(name=>({name,packages:md[name].realizationPackages,value:md[name].realizationValue})).filter(x=>x.packages||x.value);
    const methodDetails={};
    methods.forEach(name=>{ const b=md[name]; methodDetails[name]={planningPackages:b.planningPackages,planningValue:b.planningValue,realizationPackages:b.realizationPackages,realizationValue:b.realizationValue,satker:[...b.satker.values()].sort((a,b)=>b.planningValue-a.planningValue||b.realizationValue-a.realizationValue)}; });
    const year={
      year:2026,
      planningPackages:p.items.length,
      planningValue:p.items.reduce((a,b)=>a+b.value,0),
      realizationPackages:r.items.length,
      realizationValue:r.items.reduce((a,b)=>a+b.value,0),
      planningMethods, realizationMethods,
      satker:[...satkers.values()].sort((a,b)=>b.planningValue-a.planningValue||b.realizationValue-a.realizationValue)
    };
    return {year,methodDetails,source:{planning:p.source,realization:r.source}};
  }

  function build2026FromRapor(indexTable, planningTable, realizationTable) {
    const ix=tableShape(indexTable), ps=tableShape(planningTable), rs=tableShape(realizationTable);
    const idKey=pickKey(ix.keys,['id rapot','id_rapot','id']);
    const nameKey=pickKey(ix.keys,['nama opd','nama_opd','satuan kerja','opd']);
    const yearKey=pickKey(ix.keys,['tahun']);
    const monthKey=pickKey(ix.keys,['bulan']);
    if(!idKey||!nameKey) throw new Error('rapor-index-tidak-dikenali');
    let candidates=ix.rows.map(r=>({r,id:String(r[idKey]??'').trim(),name:cleanName(r[nameKey]),year:Number(asNumber(r[yearKey])),month:Number(asNumber(r[monthKey]))})).filter(x=>x.id&&x.name);
    const current=candidates.filter(x=>x.year===2026);
    if(current.length)candidates=current;
    else {
      const maxYear=Math.max(...candidates.map(x=>x.year||0));
      candidates=candidates.filter(x=>x.year===maxYear);
    }
    const latestByName=new Map();
    candidates.forEach(x=>{const old=latestByName.get(x.name);if(!old||x.month>=old.month)latestByName.set(x.name,x);});
    const latest=[...latestByName.values()];
    if(!latest.length)throw new Error('rapor-2026-kosong');

    const pId=pickKey(ps.keys,['id rapot','id_rapot','id']);
    const rId=pickKey(rs.keys,['id rapot','id_rapot','id']);
    if(!pId||!rId)throw new Error('rapor-detail-tidak-dikenali');
    const pMap=new Map(ps.rows.map(r=>[String(r[pId]??'').trim(),r]));
    const rMap=new Map(rs.rows.map(r=>[String(r[rId]??'').trim(),r]));
    const defs=[
      ['Tender / Seleksi',['paket_tender_seleksi'],['pagu_tender_seleksi'],['realisasi_paket_tender_seleksi'],['realisasi_tender_seleksi']],
      ['Pengadaan Langsung',['paket_non_tender','paket_pengadaan_langsung'],['pagu_non_tender','pagu_pengadaan_langsung'],['realisasi_paket_non_tender','realisasi_paket_pengadaan_langsung'],['realisasi_non_tender','realisasi_pengadaan_langsung']],
      ['E-Purchasing',['paket_epurchasing','paket_e_purchasing'],['pagu_epurchasing','pagu_e_purchasing'],['realisasi_paket_epurchasing','realisasi_paket_e_purchasing'],['realisasi_epurchasing','realisasi_e_purchasing']],
      ['Dikecualikan',['paket_pencatatan','paket_dikecualikan'],['pagu_pencatatan','pagu_dikecualikan'],['realisasi_paket_pencatatan','realisasi_paket_dikecualikan'],['realisasi_pencatatan','realisasi_dikecualikan']],
      ['Swakelola',['paket_swakelola'],['pagu_swakelola'],['realisasi_paket_swakelola'],['realisasi_swakelola']]
    ];
    const read=(row,keys,cands)=>{const k=pickKey(keys,cands);return k?asNumber(row?.[k]):0;};
    const md=Object.fromEntries(defs.map(d=>[d[0],{planningPackages:0,planningValue:0,realizationPackages:0,realizationValue:0,satker:[]} ]));
    const satkers=[];
    latest.forEach(x=>{
      const pr=pMap.get(x.id)||{}, rr=rMap.get(x.id)||{};
      const sat={name:x.name,planningPackages:0,planningValue:0,realizationPackages:0,realizationValue:0};
      defs.forEach(([method,pp,pv,rp,rv])=>{
        const a=read(pr,ps.keys,pp),b=read(pr,ps.keys,pv),c=read(rr,rs.keys,rp),d=read(rr,rs.keys,rv);
        const bucket=md[method]; bucket.planningPackages+=a;bucket.planningValue+=b;bucket.realizationPackages+=c;bucket.realizationValue+=d;
        if(a||b||c||d)bucket.satker.push({name:x.name,planningPackages:a,planningValue:b,realizationPackages:c,realizationValue:d});
        sat.planningPackages+=a;sat.planningValue+=b;sat.realizationPackages+=c;sat.realizationValue+=d;
      });
      satkers.push(sat);
    });
    Object.values(md).forEach(b=>b.satker.sort((a,b)=>b.planningValue-a.planningValue||b.realizationValue-a.realizationValue));
    const methods=Object.keys(md);
    const planningMethods=methods.map(name=>({name,packages:md[name].planningPackages,value:md[name].planningValue})).filter(x=>x.packages||x.value);
    const realizationMethods=methods.map(name=>({name,packages:md[name].realizationPackages,value:md[name].realizationValue})).filter(x=>x.packages||x.value);
    const year={year:2026,planningPackages:planningMethods.reduce((a,b)=>a+b.packages,0),planningValue:planningMethods.reduce((a,b)=>a+b.value,0),realizationPackages:realizationMethods.reduce((a,b)=>a+b.packages,0),realizationValue:realizationMethods.reduce((a,b)=>a+b.value,0),planningMethods,realizationMethods,satker:satkers.sort((a,b)=>b.planningValue-a.planningValue||b.realizationValue-a.realizationValue)};
    return {year,methodDetails:md,source:{fallback:'RAPOR',opd:latest.length}};
  }

  const LIVE_CACHE_KEY='traxpbj_live_cache_v22_itkp_kota';
  const readLiveCache=()=>{try{return JSON.parse(localStorage.getItem(LIVE_CACHE_KEY)||'null')}catch{return null}};
  const publishLive=result=>{if(!result)return;window.TRAXPBJ_LIVE_DATA=result;document.dispatchEvent(new CustomEvent('trax:live-data',{detail:result}));};
  let bootPromise=null,lastBootAt=0,liveTables=null;
  async function boot(force=false){if(bootPromise)return bootPromise;if(!force&&window.TRAXPBJ_LIVE_DATA&&Date.now()-lastBootAt<10000)return window.TRAXPBJ_LIVE_DATA;bootPromise=loadLive().finally(()=>{bootPromise=null;lastBootAt=Date.now()});return bootPromise;}
  async function loadLive() {
    const result = {errors:{},loadedAt:new Date().toISOString()};
    const tasks = [
      ['sdm', SOURCES.sdm, parseSDM],
      ['itkp', SOURCES.itkp, parseITKP]
    ].map(async ([key,source,parser]) => {
      try { result[key] = parser(await querySheet(source)); }
      catch (e) { result.errors[key] = e.message || String(e); }
    });
    const procurement = (async()=>{
      try {
        const [pt,rt] = await Promise.all([querySheet(SOURCES.planning),querySheet(SOURCES.realization)]);
        liveTables={planning:pt,realization:rt,loadedAt:Date.now()};window.TRAXPBJ_LIVE_TABLES=liveTables;document.dispatchEvent(new CustomEvent('trax:live-tables',{detail:liveTables}));
        const built=build2026(pt,rt);
        if(!built.year.planningPackages && !built.year.realizationPackages) throw new Error('data-utama-kosong');
        result.pbj2026 = built;
      } catch(primaryError) {
        try{
          const [ix,pt,rt]=await Promise.all([querySheet(SOURCES.raporIndex),querySheet(SOURCES.raporPlanning),querySheet(SOURCES.raporRealization)]);
          result.pbj2026=build2026FromRapor(ix,pt,rt);
          result.errors.pbj2026Primary=primaryError.message||String(primaryError);
        }catch(fallbackError){
          result.errors.pbj2026 = fallbackError.message || primaryError.message || String(fallbackError);
        }
      }
    })();
    await Promise.all([...tasks, procurement]);
    try{localStorage.setItem(LIVE_CACHE_KEY,JSON.stringify(result));}catch(_){}
    publishLive(result);
    return result;
  }

  const cached=readLiveCache(); if(cached) publishLive(cached);
  window.TRAXPBJ_LIVE={refresh:(force=true)=>boot(force),getTables:()=>liveTables||window.TRAXPBJ_LIVE_TABLES||null,age:()=>liveTables?Date.now()-Number(liveTables.loadedAt||0):Infinity};
  boot();
  setInterval(()=>{if(document.visibilityState==='visible')boot(true);},20000);
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'&&Date.now()-lastBootAt>7000)boot(true);});
  addEventListener('online',()=>boot(true));
})();
