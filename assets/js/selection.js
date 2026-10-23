(() => {
  'use strict';
  const $=(s,c=document)=>c.querySelector(s), $$=(s,c=document)=>[...c.querySelectorAll(s)];
  const API=()=>window.TRAXPBJ_SELECTION_API;
  const host=()=>$('#procSelection');
  const nf=new Intl.NumberFormat('id-ID'), pf=new Intl.NumberFormat('id-ID',{maximumFractionDigits:1});
  const fmtRp=n=>{n=Number(n)||0;const a=Math.abs(n);if(a>=1e12)return`Rp ${pf.format(n/1e12)} T`;if(a>=1e9)return`Rp ${pf.format(n/1e9)} M`;if(a>=1e6)return`Rp ${pf.format(n/1e6)} Jt`;return`Rp ${nf.format(Math.round(n))}`};
  const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const dt=v=>{if(!v)return'—';const d=new Date(v);return Number.isNaN(d.getTime())?String(v):d.toLocaleString('id-ID',{day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit',timeZone:'Asia/Jakarta'})};
  const dateOnly=v=>{if(!v)return'—';const d=new Date(v);return Number.isNaN(d.getTime())?String(v):d.toLocaleDateString('id-ID',{day:'2-digit',month:'short',year:'numeric',timeZone:'Asia/Jakarta'})};
  const roleLabel={ADMIN:'Admin',PPK:'PPK / OPD',KEPALA_UKPBJ:'Kepala UKPBJ',POKJA:'Pokja Pemilihan',PIMPINAN:'Pimpinan',PENGAWAS:'Pengawas'};
  const statusLabel={DRAFT:'Draft',DIAJUKAN:'Menunggu Disposisi',PERLU_KELENGKAPAN:'Draft',MENUNGGU_DISPOSISI:'Menunggu Disposisi',DITUGASKAN_POKJA:'Ditugaskan ke Pokja',REVIU_POKJA:'Reviu Pokja',PERLU_PERBAIKAN_PPK:'Perlu Perbaikan PPK',REVIU_ULANG:'Reviu Ulang',PERLU_DETAIL_PPK:'Lengkapi Detail Pemilihan',SIAP_PROSES_INAPROC:'Siap Proses INAPROC',PROSES_INAPROC:'Proses INAPROC',SELESAI:'Selesai',DITOLAK_KEPALA:'Pengajuan Ditolak',BATAL:'Batal'};
  const warnStatuses=new Set(['PERLU_KELENGKAPAN','PERLU_PERBAIKAN_PPK']);
  const redStatuses=new Set(['BATAL','DITOLAK_KEPALA']); const greenStatuses=new Set(['SELESAI']);
  const skpYear=new Date().toLocaleDateString('en-CA',{timeZone:'Asia/Jakarta',year:'numeric'});
  const state={skp:null,skpPeriod:{from:skpYear+'-01-01',to:skpYear+'-12-31'},skpError:'',skpExport:false,me:null,dashboard:null,requests:[],requestsLoading:false,detail:null,view:'dashboard',busy:false,admin:null,filterStatus:'',search:'',lastSync:0,syncing:false,syncVersion:'',create:null,sidebarCollapsed:false};
  const rupOptionCache=new Map(),rupOptionLoads=new Map();
  const ppkRevisionDrafts=new Map();
  const ppkHistoryCache=new Map();
  const ppkHistoryTtl=5*60*1000;
  const letterCount=value=>(String(value||'').match(/\p{L}/gu)||[]).length;
  const characterCount=value=>Array.from(String(value||'').trim()).length;
  function ppkHistoryFromRows(rows){
    const items=(rows||[]).filter(r=>{const status=String(r.status||'').toUpperCase();return Boolean(r.ppk_nama&&r.ppk_email&&(r.submitted_at||(!['DRAFT','PERLU_KELENGKAPAN'].includes(status))));});
    const seen=new Set(),out=[];
    items.sort((a,b)=>new Date(b.submitted_at||b.updated_at||b.created_at||0)-new Date(a.submitted_at||a.updated_at||a.created_at||0));
    items.forEach(r=>{const name=String(r.ppk_nama||r.name||'').trim(),email=String(r.ppk_email||r.email||'').trim();if(letterCount(name)<3||!/^\S+@\S+\.\S+$/.test(email))return;const key=name.toLocaleLowerCase('id-ID');if(seen.has(key))return;seen.add(key);out.push({name,email});});
    return out.slice(0,60);
  }
  function ppkHistoryFromApi(items){return ppkHistoryFromRows((items||[]).map(r=>({...r,ppk_nama:r.ppk_nama||r.name,ppk_email:r.ppk_email||r.email,submitted_at:r.submitted_at||r.updated_at||new Date().toISOString()})));}

  function ppkRevisionDraftKey(r){return String(state.me?.user_id||'')+':'+String(r?.request_id||'');}
  const selectionBase='#pengelolaan-pbj';
  let competitionCategories=[];
  let productCategoryGroupsLoaded=false;
  const productCategoryRows=new Map(),productCategoryLoads=new Map();
  let productCategoryMasterLoad=null;
  const PRODUCT_CATEGORY_CACHE_KEY='orbit_pbj_product_categories_v2785';
  const PRODUCT_CATEGORY_CACHE_TTL=6*60*60*1000;
  const CATEGORY_REFERENCE_CACHE_TTL=6*60*60*1000;
  const categoryReferenceCache=new Map(),categoryReferenceLoads=new Map();
  function categoryReferenceStorageKey(id){return `orbit_pbj_category_reference_v2790_${String(id||'')}`}
  function restoreCategoryReference(id){
    id=String(id||'').trim();if(!id||categoryReferenceCache.has(id))return categoryReferenceCache.get(id)||null;
    try{const raw=sessionStorage.getItem(categoryReferenceStorageKey(id));if(!raw)return null;const box=JSON.parse(raw);if(!box?.at||Date.now()-Number(box.at)>CATEGORY_REFERENCE_CACHE_TTL){sessionStorage.removeItem(categoryReferenceStorageKey(id));return null}categoryReferenceCache.set(id,box.data||null);return box.data||null}catch(_){return null}
  }
  async function ensureCategoryReference(id){
    id=String(id||'').trim();if(!id)return null;
    if(categoryReferenceCache.has(id))return categoryReferenceCache.get(id);
    const stored=restoreCategoryReference(id);if(stored)return stored;
    if(categoryReferenceLoads.has(id))return categoryReferenceLoads.get(id);
    const load=(async()=>{
      try{
        const schema=await window.ORBITA_INAPROC_FIELDS?.get?.(id);
        if(schema){const kbli=(schema.k||[]).map(([code,version])=>({code,version}));return {categoryId:id,kbli,kbliText:kbli.map(x=>`KBLI ${x.version||'-'} - ${x.code}`).join(' / ')}}
      }catch(_){/* use existing API when file unavailable */}
      const r=await API().call('getCategoryReference',{categoryId:id},{timeoutMs:12000});
      return r?.data||null;
    })().then(data=>{
      categoryReferenceCache.set(id,data);
      try{sessionStorage.setItem(categoryReferenceStorageKey(id),JSON.stringify({at:Date.now(),data}))}catch(_){}
      return data;
    }).catch(()=>null).finally(()=>categoryReferenceLoads.delete(id));
    categoryReferenceLoads.set(id,load);return load;
  }
  function hydrateProductCategoryMaster(data,{persist=true}={}){
    const groups=(data?.groups||[]).map(String).filter(Boolean);
    const rows=Array.isArray(data?.rows)?data.rows:[];
    competitionCategories=groups;
    productCategoryRows.clear();
    rows.forEach(row=>{
      const key=String(row?.category||row?.kelompok||'').trim();
      if(!key)return;
      if(!productCategoryRows.has(key))productCategoryRows.set(key,[]);
      const clean={...row};delete clean.category;delete clean.kelompok;
      productCategoryRows.get(key).push(clean);
    });
    productCategoryGroupsLoaded=true;
    if(persist&&rows.length){
      try{sessionStorage.setItem(PRODUCT_CATEGORY_CACHE_KEY,JSON.stringify({at:Date.now(),version:window.ORBITA_INAPROC_FIELDS?.version||'legacy',groups,rows}))}catch(_){}
    }
    return groups;
  }
  function restoreProductCategoryMaster(){
    if(productCategoryGroupsLoaded)return true;
    try{
      const raw=sessionStorage.getItem(PRODUCT_CATEGORY_CACHE_KEY);if(!raw)return false;
      const box=JSON.parse(raw);
      if(!box?.at||box.version!==(window.ORBITA_INAPROC_FIELDS?.version||'legacy')||Date.now()-Number(box.at)>PRODUCT_CATEGORY_CACHE_TTL){sessionStorage.removeItem(PRODUCT_CATEGORY_CACHE_KEY);return false}
      hydrateProductCategoryMaster(box,{persist:false});
      return true;
    }catch(_){return false}
  }
  async function ensureProductCategoryGroups(){
    if(productCategoryGroupsLoaded||restoreProductCategoryMaster())return competitionCategories;
    if(productCategoryMasterLoad)return productCategoryMasterLoad;
    productCategoryMasterLoad=(async()=>{
      let master=null;
      try{master=await window.ORBITA_INAPROC_FIELDS?.categoryMaster?.()}catch(_){/* backend fallback */}
      const r=master?.rows?.length?{data:master}:await API().call('listProductCategories',{includeAll:true},{timeoutMs:25000});
      const groups=hydrateProductCategoryMaster(r?.data||{});
      if(state.view==='create-form'&&host()?.closest('.proc-module.active'))renderPreservingPosition();
      return groups;
    })().catch(e=>{
      productCategoryGroupsLoaded=true;
      flash('Master kategori belum dapat dimuat. Periksa sheet PBJ_KATEGORI_PRODUK.','error');
      return [];
    }).finally(()=>{productCategoryMasterLoad=null});
    return productCategoryMasterLoad;
  }
  async function ensureProductCategoryRows(category){
    const key=String(category||'').trim();if(!key)return[];
    if(productCategoryRows.has(key))return productCategoryRows.get(key);
    if(restoreProductCategoryMaster()&&productCategoryRows.has(key))return productCategoryRows.get(key);
    await ensureProductCategoryGroups();
    if(productCategoryRows.has(key))return productCategoryRows.get(key);
    if(productCategoryLoads.has(key))return productCategoryLoads.get(key);
    const load=(async()=>{
      const r=await API().call('listProductCategories',{category:key},{timeoutMs:25000});
      const rows=Array.isArray(r?.data?.rows)?r.data.rows:[];
      productCategoryRows.set(key,rows);return rows;
    })().finally(()=>productCategoryLoads.delete(key));
    productCategoryLoads.set(key,load);return load;
  }
  let constructionCategoryRows=[];
  let constructionCategoryLoaded=false;
  let constructionCategoryLoad=null;
  const CONSTRUCTION_CATEGORY_CACHE_KEY='orbit_pbj_construction_categories_v2786';
  const CONSTRUCTION_CATEGORY_CACHE_TTL=6*60*60*1000;
  function hydrateConstructionCategories(data,{persist=true}={}){
    constructionCategoryRows=Array.isArray(data?.rows)?data.rows:[];
    constructionCategoryLoaded=true;
    if(persist&&constructionCategoryRows.length){
      try{sessionStorage.setItem(CONSTRUCTION_CATEGORY_CACHE_KEY,JSON.stringify({at:Date.now(),version:window.ORBITA_INAPROC_FIELDS?.version||'legacy',rows:constructionCategoryRows}))}catch(_){}
    }
    return constructionCategoryRows;
  }
  function restoreConstructionCategories(){
    if(constructionCategoryLoaded)return true;
    try{
      const raw=sessionStorage.getItem(CONSTRUCTION_CATEGORY_CACHE_KEY);if(!raw)return false;
      const box=JSON.parse(raw);
      if(!box?.at||box.version!==(window.ORBITA_INAPROC_FIELDS?.version||'legacy')||Date.now()-Number(box.at)>CONSTRUCTION_CATEGORY_CACHE_TTL){sessionStorage.removeItem(CONSTRUCTION_CATEGORY_CACHE_KEY);return false}
      hydrateConstructionCategories(box,{persist:false});return true;
    }catch(_){return false}
  }
  async function ensureConstructionCategories(){
    if(constructionCategoryLoaded||restoreConstructionCategories())return constructionCategoryRows;
    if(constructionCategoryLoad)return constructionCategoryLoad;
    constructionCategoryLoad=(async()=>{
      let master=null;
      try{master=await window.ORBITA_INAPROC_FIELDS?.categoryMaster?.()}catch(_){/* backend fallback */}
      if(master?.constructionRows?.length)return hydrateConstructionCategories({rows:master.constructionRows});
      const r=await API().call('listConstructionCategories',{}, {timeoutMs:25000});
      return hydrateConstructionCategories(r?.data||{});
    })().catch(e=>{
      constructionCategoryLoaded=true;
      flash('Master kategori konstruksi belum dapat dimuat. Periksa sheet PBJ_KATEGORI_KONSTRUKSI.','error');
      return [];
    }).finally(()=>{constructionCategoryLoad=null});
    return constructionCategoryLoad;
  }
  const constructionDefaultQualifications=()=>({umk:true,mikro:false,kecil:true,nonUmk:true,menengah:true,besar:true});
  const isDetailedProductCategory=category=>['Barang','Alat Kesehatan'].includes(String(category||''));
  const createDocTypes=[
    ['SURAT_PERMOHONAN','Surat Permohonan Pemilihan'],['KAK','KAK / Spesifikasi Teknis'],['HPS','HPS'],['RANCANGAN_KONTRAK','Rancang Kontrak']
  ];
  const productUnits=['Ah','Ampuh','Artikel','Bal','Barel','Batang','Blister','Botol','Buah','Buah Jembatan','Bulan','Butir','Canister','Cartridges','Cm','Drum','Dus','Gelas','Hari','Ha Per Bulan','Hektare','Ikat','Jam','Jam Terbang','Jerigen','Kaleng','Kantong','Kaplet','Kapsul','Karung','Kegiatan','Kg','Kilometer','Kotak','Lembar','Liter','Lokasi','Ls','Lump Sum','Lusin','M2','M3','M3 per Km','Meter','Milimeter','Minggu','Orang per Bulan','Orang per Jam','Orang per Kegiatan','Pail','Pak','Paket','Pasang','Pcs','Pekerjaan','Pengujian','Periode','Per Potong','Pohon','Pola','Porsi','Rim','Ritase','Roll','Rupiah per Jam','Sampel','Satuan Ukur','Set','Tablet','Tahun','Titik','Titik Lokasi','Ton','Trip','Tube','Tunggul Pohon','Unit','Vial','Voyage','Watt','Zak','1 X'];
  const availabilityOptions=['Tersedia','Tidak Tersedia'];
  const yesNoOptions=['Ya','Tidak'];
  const yesNo=v=>v===true?'Ada':v===false?'Tidak Ada':'-';
  const adaOptions=['Ada','Tidak Ada'];
  const warrantyOptions=['Tidak Tersedia',...Array.from({length:10},(_,i)=>`${i+1} Tahun`)];
  const constructionPresenceOptions=['Memiliki','Tidak Memiliki'];
  const constructionMeasurementUnits=['Meter Kubik','Meter Persegi','Meter Panjang','Ton','Kilogram','Buah','Liter','Lump Sum','Jam','1x','Pohon','cm','Pola','sampel','Rupiah/Jam','set','M3/Km','Buah Jembatan','Kegiatan','Lembar','Pengujian','Lokasi','Per Potong'];
  const constructionSectoralByPath={
    'Bidang Cipta Karya > Drainase Jalan > Saluran Buis Beton':[
      "1 m’ Buis Beton D 80 - 100 cm","1 m’ Buis Beton D 60 - 100 cm","1 m’ Buis Beton D 50 - 100 cm",
      "1 m’ Buis Beton D 40 - 100 cm","1 m’ Buis Beton D 30 - 100 cm","1 m’ Buis Beton D 100 - 100 cm",
      "1 m’ Buis Beton 1/2 D 80 - 100 cm","1 m’ Buis Beton 1/2 D 60 - 100 cm","1 m’ Buis Beton 1/2 D 50 - 100 cm",
      "1 m’ Buis Beton 1/2 D 40 - 100 cm","1 m’ Buis Beton 1/2 D 30 - 100 cm","1 m’ Buis Beton 1/2 D 100 - 100 cm"
    ]
  };
  const jakartaDay=()=>{const parts=new Intl.DateTimeFormat('en-US',{timeZone:'Asia/Jakarta',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date()),get=t=>parts.find(x=>x.type===t)?.value||'';return `${get('year')}-${get('month')}-${get('day')}`};
  const fullRp=n=>'Rp'+new Intl.NumberFormat('id-ID',{minimumFractionDigits:2,maximumFractionDigits:2}).format(Number(n)||0);
  const currencyDigits=v=>String(v??'').replace(/\D/g,'').replace(/^0+(?=\d)/,'');
  const currencyDisplay=v=>{const digits=currencyDigits(v);return digits?new Intl.NumberFormat('id-ID',{maximumFractionDigits:0}).format(Number(digits)):''};
  const daysShift=(iso,delta)=>{if(!iso)return'';const [y,m,d]=String(iso).split('-').map(Number),x=new Date(Date.UTC(y,m-1,d));if(!Number.isFinite(x.getTime()))return'';x.setUTCDate(x.getUTCDate()+delta);return `${x.getUTCFullYear()}-${String(x.getUTCMonth()+1).padStart(2,'0')}-${String(x.getUTCDate()).padStart(2,'0')}`};
  const selectOptions=(values,current,placeholder='Pilih')=>`<option value="">${esc(placeholder)}</option>`+values.map(x=>option(x,x,current)).join('');
  // Atribut detail: dapat memilih nilai master atau mengisi nilai sendiri.
  function editableDetailChoice(id,values,current,placeholder){
    const listId=`${id}Choices`,unique=[...new Set((values||[]).map(v=>String(v||'').trim()).filter(Boolean))];
    return `<input id="${esc(id)}" class="sel-detail-choice" list="${esc(listId)}" value="${esc(current||'')}" placeholder="${esc(placeholder||'Pilih atau ketik sendiri')}" autocomplete="off"><datalist id="${esc(listId)}">${unique.map(v=>`<option value="${esc(v)}"></option>`).join('')}</datalist>`;
  }

  const parseJson=(text,fallback)=>{try{const v=JSON.parse(String(text||''));return v??fallback}catch(_){return fallback}};
  function newCreateState(){return{competitionType:'NON_CONSTRUCTION',requestId:'',previousRequestId:'',rupCode:'',rupData:null,title:'',scheduleStartDate:'',scheduleEndDate:'',scheduleStartTime:'',scheduleEndTime:'',qualifications:{umk:false,mikro:false,kecil:false,nonUmk:false,menengah:false,besar:false},category:'',products:[],offerType:'ITEMIZED',constructionDetails:[],paymentType:'SINGLE',paymentTermsCount:'',paymentTermsNote:'',location:'',completionDate:'',files:new Map(),existingDocs:[],dirty:false,rupItems:[],rupLoading:false,rupLoaded:false,sourceDetail:null};}
  function browserLocation(){return typeof location!=='undefined'?location:(typeof window!=='undefined'?window.location:null)}
  function browserHistory(){return typeof history!=='undefined'?history:(typeof window!=='undefined'?window.history:null)}
  function selectionPath(){const loc=browserLocation();const h=String(loc?.hash||'');if(!h.startsWith(selectionBase))return'';return h.slice(selectionBase.length).replace(/^\/+|\/+$/g,'');}
  function selectionHash(path=''){return selectionBase+(path?'/'+String(path).replace(/^\/+/, ''):'');}
  function setSelectionHash(path='',replace=false){const loc=browserLocation(),hist=browserHistory();if(!loc||!hist)return;const next=selectionHash(path);if(loc.hash===next)return;hist[replace?'replaceState':'pushState']({traxPanel:'procurement',module:'selection'},'',loc.pathname+loc.search+next);}
  function requestSummary(id){return state.requests.find(x=>String(x.request_id)===String(id));}
  function isKajiRequest(r){return String(r?.workflow_scheme||'')==='KAJI_ULANG_2026'}
  function requestSelectionProcess(r){
    const explicit=String(r?.selection_process||'').trim().toUpperCase().replace(/\s+/g,'_');
    if(explicit==='PERSIAPAN')return 'PERSIAPAN';if(['NEGOSIASI','PERMOHONAN_NEGOSIASI'].includes(explicit))return 'NEGOSIASI';
    if(['MINI_KOMPETISI','PERMOHONAN_MINI_KOMPETISI'].includes(explicit))return 'MINI_KOMPETISI';
    return ['NON_CONSTRUCTION','CONSTRUCTION'].includes(String(r?.competition_type||'').toUpperCase())?'MINI_KOMPETISI':'NEGOSIASI';
  }
  function requestProcessLabel(r){
    if(requestSelectionProcess(r)==='PERSIAPAN')return 'Dokumen Persiapan';
    if(requestSelectionProcess(r)==='NEGOSIASI')return 'Negosiasi';
    const type=String(r?.competition_type||'').toUpperCase();
    if(type==='CONSTRUCTION')return 'Mini Kompetisi · Pekerjaan Konstruksi';
    if(type==='NON_CONSTRUCTION')return 'Mini Kompetisi · Barang/Jasa Lainnya';
    return 'Mini Kompetisi';
  }
  const RUP_BROWSER_CACHE_TTL=5*60*1000;
  const rupCacheKey=method=>`${window.TRAXPBJ_SELECTION_CONFIG?.apiUrl||''}|${state.me?.user_id||''}|${state.me?.opd||''}|${method}`;
  const rupStorageKey=key=>`orbit_pbj_rup_v2791_${key}`;
  function clearRupOptions(){rupOptionCache.clear();rupOptionLoads.clear();}
  function getStoredRupOptions(key){
    const memory=rupOptionCache.get(key);
    if(memory&&Date.now()-memory.at<RUP_BROWSER_CACHE_TTL)return memory;
    if(memory)rupOptionCache.delete(key);
    try{
      const raw=sessionStorage.getItem(rupStorageKey(key));if(!raw)return null;
      const entry=JSON.parse(raw);
      if(!entry?.at||Date.now()-entry.at>=RUP_BROWSER_CACHE_TTL||!Array.isArray(entry?.data?.items)){
        sessionStorage.removeItem(rupStorageKey(key));return null;
      }
      rupOptionCache.set(key,entry);return entry;
    }catch(_){return null}
  }
  function requestConsumesRup(r){return !!r&&!['DRAFT','PERLU_KELENGKAPAN','DITOLAK_KEPALA','BATAL'].includes(String(r.status||''));}
  function normalizedRupCode(v){return String(v||'').replace(/\D/g,'');}
  function requestSubmissionLabel(r){return r?.submitted_at?dateOnly(r.submitted_at):'Belum dikirim';}
  function syncActiveRupOptions(data){
    if(!data||!Array.isArray(data.items))return data;
    const baseItems=data.items.map(item=>({...item}));
    if(state.me?.role!=='PPK'||state.requestsLoading||state.filterStatus||state.search){
      return {...data,items:baseItems.map(item=>{
        const pagu=Math.max(0,Number(item.pagu)||0);
        const sisaRaw=Number(item.sisaPagu),usedRaw=Number(item.terpakai);
        const sisa=Number.isFinite(sisaRaw)?Math.max(0,sisaRaw):Math.max(0,pagu-Math.max(0,usedRaw||0));
        const terpakai=Number.isFinite(usedRaw)?Math.max(0,usedRaw):Math.max(0,pagu-sisa);
        return {...item,sisaPagu:sisa,terpakai,activeRequestId:String(item.activeRequestId||'')};
      })};
    }
    const active=new Map(),reserved={};
    state.requests.forEach(r=>{
      const code=normalizedRupCode(r.kode_rup);
      if(!code)return;
      if(!['SELESAI','BATAL','DITOLAK_KEPALA'].includes(String(r.status||'')))active.set(code,r.request_id);
      if(!requestConsumesRup(r))return;
      reserved[code]=(reserved[code]||0)+Math.max(0,Number(r.hps_alokasi)||Number(r.pagu)||0);
    });
    return {...data,items:baseItems.map(item=>{
      const code=normalizedRupCode(item.kodeRup),pagu=Math.max(0,Number(item.pagu)||0),terpakai=Math.max(0,Number(reserved[code]||0));
      return {...item,sisaPagu:Math.max(0,pagu-terpakai),terpakai,activeRequestId:active.get(code)||''};
    }),activeCount:active.size};
  }
  async function getRupOptions(method='E-Purchasing',force=false){
    const key=rupCacheKey(method),cached=!force&&getStoredRupOptions(key);
    if(cached)return syncActiveRupOptions(cached.data);
    if(rupOptionLoads.has(key))return syncActiveRupOptions(await rupOptionLoads.get(key));
    const pending=API().call('listRupOptions',{method,...(force?{force:true}:{})},{timeoutMs:30000}).then(r=>{
      const data=r.data||{items:[]},entry={at:Date.now(),data};
      rupOptionCache.set(key,entry);
      try{sessionStorage.setItem(rupStorageKey(key),JSON.stringify(entry))}catch(_){}
      return data;
    }).finally(()=>rupOptionLoads.delete(key));
    rupOptionLoads.set(key,pending);return syncActiveRupOptions(await pending);
  }
  function prefetchRupOptions(){if(state.me?.role==='PPK'&&state.me?.opd&&!getStoredRupOptions(rupCacheKey('E-Purchasing')))getRupOptions('E-Purchasing').catch(()=>{});}
  let pollTimer=null;
  let inspectedStep=null,assignmentOpen=false;
  const canSeeOrder=()=>['ADMIN','KEPALA_UKPBJ','POKJA'].includes(state.me?.role);
  const detailCache=new Map(),detailCacheAt=new Map(),detailPrefetchLoads=new Map();
  const DETAIL_CACHE_PREFIX='orbit_pbj_detail_v2726:';
  const detailKey=id=>`${state.me?.user_id||''}:${state.me?.role==='POKJA'?(state.me?.pokja_id||''):''}:${id}`;
  const detailStorageKey=id=>DETAIL_CACHE_PREFIX+detailKey(id);
  function storedDetail(id){try{const raw=sessionStorage.getItem(detailStorageKey(id));if(!raw)return null;const box=JSON.parse(raw);if(!box?.data||Date.now()-Number(box.at||0)>30*60*1000){sessionStorage.removeItem(detailStorageKey(id));return null}detailCacheAt.set(detailKey(id),Number(box.at)||0);return box.data}catch(_){return null}}
  function rememberDetail(d){if(!d?.request||d.loading)return;const key=detailKey(d.request.request_id),at=Date.now();detailCache.set(key,d);detailCacheAt.set(key,at);if(detailCache.size>20){const first=detailCache.keys().next().value;detailCache.delete(first);detailCacheAt.delete(first)}try{sessionStorage.setItem(detailStorageKey(d.request.request_id),JSON.stringify({at,data:d}))}catch(_){}}
  function cachedDetail(id){const key=detailKey(id),memory=detailCache.get(key);if(memory)return memory;const stored=storedDetail(id);if(stored){detailCache.set(key,stored);return stored}return null}
  function withPokja(d){return {...d,pokja:state.dashboard?.pokja||d.pokja||[],loading:false}}
  async function prefetchDetail(id){id=String(id||'');if(!id||!state.me||writing())return null;const key=detailKey(id),summary=state.requests.find(x=>String(x.request_id)===id),cached=cachedDetail(id);if(cached&&summary&&String(cached.request?.updated_at||'')===String(summary.updated_at||'')&&String(cached.request?.inaproc_version||'')===String(summary.inaproc_version||''))return cached;if(detailPrefetchLoads.has(key))return detailPrefetchLoads.get(key);const userId=state.me.user_id,activePokja=state.me.role==='POKJA'?state.me.pokja_id:'',rev=writeVersion();const pending=API().call('requestDetail',{requestId:id},{timeoutMs:22000}).then(r=>{if(state.me?.user_id!==userId||(state.me?.role==='POKJA'&&state.me?.pokja_id!==activePokja)||rev!==writeVersion())return null;const next=withPokja(r.data);rememberDetail(next);return next}).catch(()=>null).finally(()=>detailPrefetchLoads.delete(key));detailPrefetchLoads.set(key,pending);return pending}
  function scheduleDetailPrefetch(){clearTimeout(scheduleDetailPrefetch._t);scheduleDetailPrefetch._t=setTimeout(async()=>{if(!state.me||document.hidden||writing()||state.busy)return;const groups=groupRequests(state.requests),limit=state.me.role==='POKJA'?3:2;for(const g of groups.slice(0,limit)){if(!canBackgroundRender())break;await prefetchDetail(g[0]?.request_id)}},60)}
  const BOOT_CACHE='traxpbj_selection_bootstrap_v2713';
  function saveBootCache(b){try{sessionStorage.setItem(BOOT_CACHE,JSON.stringify({at:Date.now(),data:b}))}catch(_){}}
  function readBootCache(){try{const x=JSON.parse(sessionStorage.getItem(BOOT_CACHE)||'null');return x&&x.data?x:null}catch(_){return null}}
  function clearBootCache(){try{sessionStorage.removeItem(BOOT_CACHE)}catch(_){}}
  let navigationVersion=0,detailFetchVersion=0,backgroundRenderPending=false,pendingDetail=null,pendingDetailVersion=-1;
  const writing=()=>!!API()?.isWriting?.();
  const uploading=requestId=>!!API()?.isUploading?.(requestId);
  const writeVersion=()=>API()?.writeVersion?.()||0;
  const docUploadStates=new Map();
  const docUploadKey=(requestId,docType)=>`${String(requestId||'')}::${String(docType||'')}`;
  const docUploadState=(requestId,docType)=>docUploadStates.get(docUploadKey(requestId,docType))||null;
  const docUploading=(requestId,docType)=>!!docUploadState(requestId,docType)?.active;
  const anyDocUploading=()=>[...docUploadStates.values()].some(x=>x?.active);
  const requestUploading=requestId=>uploading(requestId)||[...docUploadStates.entries()].some(([key,x])=>x?.active&&key.startsWith(String(requestId||'')+'::'));
  function updateDocUploadState(requestId,docType,patch){
    const key=docUploadKey(requestId,docType),next={...(docUploadStates.get(key)||{}),...patch};docUploadStates.set(key,next);
    const detailMatch=state.detail?.request?.request_id===requestId,createMatch=state.create?.requestId===requestId;
    if(!detailMatch&&!createMatch)return;
    const input=detailMatch?($(`[data-doc-upload="${CSS.escape(docType)}"]`)||$(`[data-mini-doc="${CSS.escape(docType)}"]`)||$(`[data-nego-doc="${CSS.escape(docType)}"]`)||$(`[data-kaji-doc]`)):$(`[data-create-doc-file="${CSS.escape(docType)}"]`),label=input?.closest('.sel-upload');if(!label)return;
    label.classList.toggle('uploading',!!next.active);label.classList.toggle('upload-failed',!!next.failed);if(input)input.disabled=!!next.active;
    if(next.progress!=null)label.style.setProperty('--upload-progress',Math.max(1,Math.min(100,Math.round(Number(next.progress)||1)))+'%');else label.style.removeProperty('--upload-progress');
    if(next.text)uploadLabelText(label,next.text);
  }
  function clearDocUploadState(requestId,docType){docUploadStates.delete(docUploadKey(requestId,docType));}
  function addLocalAudit(entry){if(!entry||!state.detail)return;const rows=state.detail.audit||[];if(entry.audit_id&&rows.some(x=>x.audit_id===entry.audit_id))return;state.detail.audit=[...rows,entry].sort((a,b)=>new Date(a.created_at)-new Date(b.created_at));}
  function reviewHasChanges(){return $$('[data-review-note],[data-review-status]',host()||document).some(el=>el.tagName==='SELECT'?el.value!==([...el.options].find(o=>o.defaultSelected)||el.options[0])?.value:el.value!==el.defaultValue);}
  function userIsInteracting(){
    if(state.view==='create-form'&&state.create?.dirty)return true;
    const a=document.activeElement;
    const focused=a&&host()?.contains(a)&&/^(INPUT|SELECT|TEXTAREA)$/.test(a.tagName);
    const dirtyReview=reviewHasChanges();
    const dirtyFilter=($('#selSearch')&&$('#selSearch').value!==state.search)||($('#selStatus')&&$('#selStatus').value!==state.filterStatus);
    const dirtySkp=($('#skpFrom')&&$('#skpFrom').value!==state.skpPeriod.from)||($('#skpTo')&&$('#skpTo').value!==state.skpPeriod.to);
    return !!focused||!!dirtySkp||dirtyReview||!!dirtyFilter||uploading()||anyDocUploading()||!!$('.sel-upload.uploading');
  }
  function canBackgroundRender(){return !document.hidden&&!state.busy&&!writing()&&!userIsInteracting()&&!$('#selModal')?.classList.contains('open')}
  function silentSync(delay=450){clearTimeout(silentSync._t);silentSync._t=setTimeout(()=>{if(!canBackgroundRender()){silentSync(1000);return}backgroundSync().catch(()=>{})},delay)}
  function renderPreservingPosition(){
    const main=$('.sel-main'),top=main?.scrollTop||0,left=main?.scrollLeft||0,room=$('#procurementControlRoom'),roomTop=room?.scrollTop||0;
    const reportScroll=$('.sel-report-table-wrap'),reportTop=reportScroll?.scrollTop||0,reportLeft=reportScroll?.scrollLeft||0;
    const historyOpen=$('#selHistory')&&!$('#selHistory').classList.contains('collapsed');
    const currentHistoryCollapsed=!!$('[data-current-history].collapsed');
    const previousHistoryOpen=!!$('[data-previous-history]')&&!$('[data-previous-history]').classList.contains('collapsed');
    const requestHistoryOpen=$$('.sel-request-previous:not(.collapsed)').map(el=>el.dataset.requestHistory);
    const groups=$$('.sel-audit-group-items.open').map(el=>el.dataset.auditGroup);
    const drafts=$$('[data-review-note],[data-review-status]').map(el=>({key:el.dataset.reviewNote||el.dataset.reviewStatus,kind:el.hasAttribute('data-review-note')?'data-review-note':'data-review-status',value:el.value,dirty:el.tagName==='SELECT'?el.value!==([...el.options].find(o=>o.defaultSelected)||el.options[0])?.value:el.value!==el.defaultValue}));
    const active=document.activeElement,focusKey=active?.dataset?.reviewNote||active?.dataset?.reviewStatus;
    const focusKind=active?.hasAttribute?.('data-review-note')?'data-review-note':'data-review-status';
    const start=active?.selectionStart,end=active?.selectionEnd;
    render();
    for(const d of drafts){const el=$(`[${d.kind}="${CSS.escape(d.key)}"]`);if(el&&d.dirty)el.value=d.value;}
    syncReviewDecisionUi();
    if(historyOpen){$('#selHistory')?.classList.remove('collapsed');const b=$('[data-toggle-history]');if(b){b.textContent='Sembunyikan';b.setAttribute('aria-expanded','true')}}
    if(currentHistoryCollapsed){$('[data-current-history]')?.classList.add('collapsed');const b=$('[data-toggle-current-history]');if(b){b.textContent='Tampilkan';b.setAttribute('aria-expanded','false')}}
    if(previousHistoryOpen){$('[data-previous-history]')?.classList.remove('collapsed');const b=$('[data-toggle-previous-history]');if(b){b.textContent='Sembunyikan pengajuan sebelumnya';b.setAttribute('aria-expanded','true')}}
    for(const key of requestHistoryOpen){$(`[data-request-history="${CSS.escape(key)}"]`)?.classList.remove('collapsed');const b=$(`[data-toggle-request-history="${CSS.escape(key)}"]`);if(b){b.textContent='Sembunyikan pengajuan sebelumnya';b.setAttribute('aria-expanded','true')}}
    for(const key of groups){$(`[data-audit-group="${CSS.escape(key)}"]`)?.classList.add('open');const b=$(`[data-toggle-audit-group="${CSS.escape(key)}"]`);if(b){b.textContent='Tutup rincian';b.setAttribute('aria-expanded','true')}}
    if(focusKey){const el=$(`[${focusKind}="${CSS.escape(focusKey)}"]`);el?.focus({preventScroll:true});if(el?.setSelectionRange&&start!=null)el.setSelectionRange(start,end);}
    const nextReport=$('.sel-report-table-wrap');if(nextReport){nextReport.scrollTop=reportTop;nextReport.scrollLeft=reportLeft;}
    const next=$('.sel-main');if(next){next.scrollTop=top;next.scrollLeft=left;}if(room)room.scrollTop=roomTop;
  }
  async function backgroundSync(){
    if(!canBackgroundRender()||state.syncing)return;
    if(state.view==='skp'){await loadSkp(true);return;}
    const nav=navigationVersion,fetchVersion=detailFetchVersion,view=state.view,id=state.detail?.request?.request_id;
    const before=JSON.stringify([state.me,state.requests,state.dashboard?.counts,state.dashboard?.pokja]);
    await sync();
    if(before!==JSON.stringify([state.me,state.requests,state.dashboard?.counts,state.dashboard?.pokja]))backgroundRenderPending=true;
    if(nav!==navigationVersion||fetchVersion!==detailFetchVersion||!canBackgroundRender())return;
    if(view==='detail'&&id&&state.view==='detail'){
      const summary=state.requests.find(r=>r.request_id===id);
      if(pendingDetailVersion!==writeVersion()||pendingDetail?.request?.updated_at!==summary?.updated_at||pendingDetail?.request?.inaproc_version!==summary?.inaproc_version)pendingDetail=null;
      if(pendingDetail?.request?.request_id===id){state.detail=pendingDetail;pendingDetail=null;renderPreservingPosition();}else if(!summary||summary.updated_at!==state.detail?.request?.updated_at||summary.inaproc_version!==state.detail?.request?.inaproc_version)await refreshDetail(true);
    }else if(view===state.view&&backgroundRenderPending)renderPreservingPosition();
  }

  function flash(msg,type='ok'){const el=$('#selFlash');if(!el)return;el.textContent=msg;el.className=`sel-flash show ${type}`;clearTimeout(flash._t);flash._t=setTimeout(()=>el.classList.remove('show'),3600)}
  function busy(on,msg='Memproses…'){state.busy=!!on;clearTimeout(busy._t);const el=$('#selBusy');if(!el)return;if(!on){el.classList.remove('show');return}const s=$('span',el);if(s)s.textContent=msg;busy._t=setTimeout(()=>{if(state.busy)el.classList.add('show')},180)}
  function apiErr(err){const m=String(err?.message||err||'Terjadi kesalahan.');if(/belum dihubungkan/i.test(m))return m;if(/sesi/i.test(m)){API()?.setToken('');state.me=null}return m}

  function loginHtml(){const current=window.TRAXPBJ_SESSION?.getUser();return `<div class="sel-signed-out"><h3>Permohonan Pemilihan</h3><p>${current?'Gunakan akun PBJ untuk membuka permohonan pemilihan.':'Masuk untuk membuka permohonan dan tindak lanjut paket.'}</p><button type="button" class="sel-primary" data-open-portal>${current?'Buka akun':'Login'}</button></div>`}

  function appShell(inner=''){return `<div class="sel-app"><header class="sel-top"><div class="sel-brand"><small>PEMILIHAN PENYEDIA · UKPBJ KOTA BOGOR</small><b>Permohonan & Reviu Pokja</b></div><div class="sel-user"><div><b>${esc(state.me?.nama||'')}</b><span>${esc(roleLabel[state.me?.role]||state.me?.role||'')} ${state.me?.opd?`· ${esc(state.me.opd)}`:''}</span></div></div></header>${inner}<div class="sel-modal" id="selModal"></div><div class="sel-flash" id="selFlash"></div><div class="sel-busy" id="selBusy"><div class="sel-busy-card"><i class="sel-spinner"></i><b>Memproses</b><span>Menyiapkan data</span></div></div></div>`}

  function navItems(){const counts=state.dashboard?.counts||{}, me=state.me||{};const items=[['dashboard','Ringkasan',state.dashboard?.total||0],['requests',me.role==='PPK'?'Permohonan Saya':'Daftar Permohonan',visiblePackageCount()]];if(me.role==='POKJA')items.push(['skp','Dokumen Laporan','']);if(me.role==='ADMIN')items.push(['admin','Akun & Pokja','']);return items}
  function layout(content){const activeNav=['create-process','create-kind','create-form'].includes(state.view)?'requests':state.view;return `<div class="sel-shell ${state.sidebarCollapsed?'side-collapsed':''}"><aside class="sel-side ${state.sidebarCollapsed?'is-collapsed':''}"><div class="sel-side-head"><small>RUANG KERJA</small><button type="button" class="sel-side-toggle" data-sel-side-toggle aria-label="${state.sidebarCollapsed?'Buka menu ruang kerja':'Minimalkan menu ruang kerja'}" title="${state.sidebarCollapsed?'Buka menu':'Minimalkan menu'}">${state.sidebarCollapsed?'›':'‹'}</button></div><nav class="sel-nav">${navItems().map(([k,l,c])=>`<button type="button" data-sel-view="${k}" data-short="${esc(l.slice(0,1).toUpperCase())}" title="${esc(l)}" class="${activeNav===k?'active':''}"><b>${esc(l)}</b><span>${c===''?'•':esc(c)}</span></button>`).join('')}</nav></aside><main class="sel-main">${content}</main></div>`}
  function kpi(label,value,sub,hero=false){const filter={'TOTAL PAKET':'','MENUNGGU TINDAK LANJUT':'GROUP_PENDING','REVIU & PERBAIKAN':'GROUP_REVIEW','INAPROC':'GROUP_INAPROC','SELESAI':'SELESAI'}[label]||'';return `<button type="button" data-dashboard-filter="${esc(filter)}" class="sel-kpi ${hero?'hero':''}"><small>${esc(label)}</small><strong>${esc(value)}</strong><span>${esc(sub||'')}</span></button>`}
  function badge(status){const cls=warnStatuses.has(status)?'warn':redStatuses.has(status)?'red':greenStatuses.has(status)?'green':'';return `<span class="sel-badge ${cls}" data-status="${esc(status)}">${esc(statusLabel[status]||status||'—')}</span>`}
  function requestBadge(r){if(requestSelectionProcess(r)==='NEGOSIASI'&&r.nego_stage&&r.nego_stage!=='HANDOVER'&&r.status==='SIAP_PROSES_INAPROC')return `<span class="sel-badge" data-status="${esc(r.status)}">${esc(negoPhaseLabel(r))}</span>`;if(requestSelectionProcess(r)==='MINI_KOMPETISI'&&r.mini_stage&&r.mini_stage!=='HANDOVER'&&r.status==='SIAP_PROSES_INAPROC')return `<span class="sel-badge" data-status="${esc(r.status)}">${esc(miniPhaseLabel(r))}</span>`;return badge(r.status)}
  function roleActionText(){const r=state.me?.role;if(r==='PPK')return'Buat Permohonan';if(r==='KEPALA_UKPBJ')return'Tentukan Pokja';if(r==='POKJA')return'Reviu paket';if(r==='ADMIN')return'Kelola akun dan Pokja';return'Pantau proses pemilihan'}
  function capacityTone(loadPct){const n=Number(loadPct)||0;return n>=80?'high':n>=50?'mid':'low'}
  function requestCodeLabel(r,ctx={}){if(ctx.isLatestInGroup&&r.previous_request_id)return'Pengajuan ulang';if(ctx.groupSize>1&&ctx.index>0)return'Pengajuan sebelumnya';if(r.previous_request_id)return'Pengajuan ulang';return'Nomor paket'}
  function requestChainOrderId(r){const m=String(r?.request_id||'').match(/-(\d+)$/);return m?Number(m[1]):0}
  function groupRequests(list){const items=(list||[]).filter(Boolean);if(!items.length)return[];const byId=new Map(items.map(r=>[String(r.request_id||''),r]));const childMap=new Map();items.forEach(r=>{const prev=String(r.previous_request_id||'').trim();if(!prev)return;const arr=childMap.get(prev)||[];arr.push(r);childMap.set(prev,arr)});const roots=[];items.forEach(r=>{const prev=String(r.previous_request_id||'').trim();if(!prev||!byId.has(prev))roots.push(r)});const seen=new Set(),groups=[];const walk=(node,bucket)=>{const id=String(node.request_id||'');if(!id||seen.has(id))return;seen.add(id);bucket.push(node);const children=(childMap.get(id)||[]).slice().sort((a,b)=>requestChainOrderId(a)-requestChainOrderId(b)||(new Date(a.created_at||a.updated_at||0)-new Date(b.created_at||b.updated_at||0)));children.forEach(child=>walk(child,bucket))};roots.sort((a,b)=>new Date(b.updated_at||b.created_at||0)-new Date(a.updated_at||a.created_at||0)||requestChainOrderId(b)-requestChainOrderId(a));roots.forEach(root=>{const bucket=[];walk(root,bucket);if(bucket.length)groups.push(bucket)});items.forEach(r=>{const id=String(r.request_id||'');if(seen.has(id))return;groups.push([r]);seen.add(id)});return groups.map(bucket=>bucket.sort((a,b)=>new Date(b.updated_at||b.created_at||0)-new Date(a.updated_at||a.created_at||0)||requestChainOrderId(b)-requestChainOrderId(a))).sort((a,b)=>new Date(b[0]?.updated_at||b[0]?.created_at||0)-new Date(a[0]?.updated_at||a[0]?.created_at||0)||requestChainOrderId(b[0])-requestChainOrderId(a[0]))}
  const visiblePackageCount=()=>groupRequests(state.requests).length;

  function dashboardHtml(){const c=state.dashboard?.counts||{}, pokja=state.dashboard?.pokja||[];const pending=(c.DIAJUKAN||0)+(c.MENUNGGU_DISPOSISI||0),review=(c.DITUGASKAN_POKJA||0)+(c.REVIU_POKJA||0)+(c.REVIU_ULANG||0)+(c.PERLU_PERBAIKAN_PPK||0)+(c.PERLU_DETAIL_PPK||0),inap=(c.SIAP_PROSES_INAPROC||0)+(c.PROSES_INAPROC||0);const max=Math.max(1,...Object.values(c).map(Number));return `<div class="sel-head"><div><small>RINGKASAN</small><h3>${esc(roleActionText())}</h3><p>Terakhir sinkron ${state.lastSync?dt(state.lastSync):'—'}</p></div><div class="sel-head-actions">${state.me?.role==='PPK'?'<button class="sel-primary" type="button" data-sel-create>+ Buat Permohonan</button>':''}<button class="sel-ghost" type="button" data-sel-refresh>Perbarui</button></div></div>
    <div class="sel-kpis">${kpi('TOTAL PAKET',nf.format(state.dashboard?.total||0),'Paket aktif pada akun ini',true)}${kpi('MENUNGGU TINDAK LANJUT',nf.format(pending),'Menunggu disposisi')}${kpi('REVIU & PERBAIKAN',nf.format(review),'Pokja / PPK')}${kpi('INAPROC',nf.format(inap),'Sedang proses')}${kpi('SELESAI',nf.format(c.SELESAI||0),'Proses pemilihan selesai')}</div>
    <div class="sel-grid"><section class="sel-card"><header><b>Posisi Paket</b><span>berdasarkan status terbaru</span></header><div class="sel-status-bars">${Object.entries(c).sort((a,b)=>b[1]-a[1]).map(([s,n])=>`<button type="button" class="sel-status-row" data-dashboard-filter="${esc(s)}" data-status="${esc(s)}"><b>${esc(statusLabel[s]||s)}</b><i style="--w:${Math.max(4,n/max*100)}%"></i><strong>${nf.format(n)}</strong></button>`).join('')||'<div class="sel-empty"><b>Belum ada permohonan</b>Data akan muncul setelah permohonan pertama dibuat.</div>'}</div></section>
    <section class="sel-card"><header><b>Distribusi Beban Pokja</b><span>beban kerja saat ini</span></header><div class="sel-pokja-grid">${pokja.length?pokja.map(p=>`<article class="sel-pokja"><div class="sel-pokja-top"><div><b>${esc(p.nama)}</b></div><strong>${nf.format(p.remaining)} sisa</strong></div><div class="sel-meter ${capacityTone(p.loadPct)}"><i style="--w:${pf.format(p.loadPct||0)}%"></i></div><div class="sel-pokja-foot"><span>${nf.format(p.activeCount||0)} aktif</span><span>${nf.format(p.doneCount||0)} selesai</span><span>${pf.format(p.loadPct||0)}%</span></div></article>`).join(''):'<div class="sel-empty"><b>Pokja belum dibuat</b>Admin dapat menambahkan Pokja dan kapasitasnya.</div>'}</div></section></div>`}

  function negoPhaseLabel(r){return ({SIAP_NEGOSIASI:'Menunggu dokumen Negosiasi',NEGOSIASI:'Menunggu dokumen Negosiasi',HASIL_NEGOSIASI:'Menunggu dokumen Negosiasi',HANDOVER:'Handover ke PPK'})[r.nego_stage]||''}
  function miniPhaseLabel(r){return ({SIAP_TAYANG:'Menunggu penayangan',TAYANG:'Sedang ditayangkan',EVALUASI:'Evaluasi pemenang',HANDOVER:'Handover ke PPK',GAGAL:'Kompetisi gagal · Perbaikan PPK',REVIU_ULANG:'Reviu ulang',BATAL:'Kompetisi dibatalkan'})[r.mini_stage]||''}
  function requestPipeline(r){
    const current=stepIndex(r),stopped=['DITOLAK_KEPALA','BATAL'].includes(r.status);
    return `<nav class="sel-mini-pipeline" data-status="${esc(r.status)}" aria-label="Tahapan ${esc(r.request_id)}">${pipelineSteps(r).map((step,i)=>{
      const active=i===current,done=i<current&&!stopped;const label=active&&stopped?(r.status==='BATAL'?'Batal':'Ditolak'):(active&&r.status==='PERLU_PERBAIKAN_PPK'?'Perlu Perbaikan PPK':processStepName(r,i)),running=active&&r.status==='PROSES_INAPROC';
      return `<button type="button" class="sel-mini-step ${done?'done':''} ${active?'active':''} ${running?'running':''} ${active&&stopped?'stopped':''}" data-request-step="${i}" data-step-request="${esc(r.request_id)}" aria-current="${active?'step':'false'}" aria-label="${esc(label)}${running?' · Sedang berjalan':active?' · Aktif':done?' · Selesai':' · Belum dimulai'}"><i aria-hidden="true">${done?'✓':i+1}</i><span>${esc(label)}</span>${running?'<em>Sedang berjalan</em>':''}</button>`;
    }).join('')}</nav>`;
  }
  function requestTitle(r){return String(r?.judul_permohonan||r?.nama_paket||'Tanpa judul permohonan').trim()}
  function requestRow(r,ctx={}){const label=requestCodeLabel(r,ctx),canDeleteDraft=state.me?.role==='PPK'&&['DRAFT','PERLU_KELENGKAPAN'].includes(String(r.status||''));return `<article class="sel-request-card" data-status="${esc(r.status)}"><button type="button" class="sel-request" data-request-id="${esc(r.request_id)}"><div class="sel-request-code"><small>${esc(label)}</small><code>${esc(r.request_id)}</code></div><div class="sel-request-copy"><b>${esc(requestTitle(r))}</b><span class="sel-process-label ${requestSelectionProcess(r)==='NEGOSIASI'?'negotiation':requestSelectionProcess(r)==='PERSIAPAN'?'preparation':'competition'}">${esc(requestProcessLabel(r))}</span><span>RUP ${esc(r.kode_rup)} · ${esc(r.metode_epurchasing||r.metode_pengadaan||'')}</span></div><div class="sel-request-opd"><b>${esc(r.opd||'—')}</b><span>${esc(requestSubmissionLabel(r))}</span></div><div class="sel-money"><b>${fmtRp(r.pagu)}</b><span>${esc(r.jenis||'')}</span></div>${requestBadge(r)}</button>${canDeleteDraft?`<div class="sel-request-draft-actions"><button type="button" class="sel-request-delete-draft" data-delete-draft-request="${esc(r.request_id)}" aria-label="Hapus draft ${esc(r.request_id)}">Hapus Draft</button></div>`:''}${requestPipeline(r)}</article>`}
  function requestGroupHtml(group){const latest=group[0]||{},multi=group.length>1,key=String(latest.kode_rup||latest.request_id||'group').replace(/[^A-Za-z0-9_-]/g,'_');if(!multi)return `<section class="sel-request-group">${requestRow(latest,{groupSize:1,index:0,isLatestInGroup:true})}</section>`;const previous=group.slice(1).map((r,index)=>requestRow(r,{groupSize:group.length,index:index+1,isLatestInGroup:false})).join('');return `<section class="sel-request-group grouped"><div class="sel-request-group-head"><div><b>${esc(requestTitle(latest))}</b><span>RUP ${esc(latest.kode_rup||'—')} · ${nf.format(group.length)} pengajuan</span></div></div>${requestRow(latest,{groupSize:group.length,index:0,isLatestInGroup:true})}<div class="sel-request-group-footer"><button type="button" class="sel-ghost sel-request-history-toggle" data-toggle-request-history="${esc(key)}" aria-expanded="false">Lihat pengajuan sebelumnya (${group.length-1})</button></div><div class="sel-request-previous collapsed" data-request-history="${esc(key)}">${previous}</div></section>`}
  function requestsHtml(){const groups=groupRequests(state.requests);const filterOptions=[['','Semua status'],['GROUP_DRAFT','Draft'],['GROUP_ONGOING','Dalam proses'],['SELESAI','Selesai'],['GROUP_CLOSED','Ditolak / Batal']];const listHtml=state.requestsLoading&&!groups.length?'<div class="sel-request-loading"><i></i><b>Memuat permohonan…</b><span>Mengambil data permohonan sebelumnya.</span></div>':groups.length?groups.map(requestGroupHtml).join(''):'<div class="sel-empty"><b>Belum ada data</b>Belum ada permohonan pada filter ini.</div>';return `<div class="sel-head"><div><small>PERMOHONAN PEMILIHAN</small><h3>${state.me?.role==='PPK'?'Permohonan Saya':'Daftar Permohonan'}</h3><p>${state.requestsLoading&&!groups.length?'Memuat…':nf.format(state.requests.length)+' paket'}</p></div><div class="sel-head-actions">${state.me?.role==='PPK'?'<button class="sel-primary" type="button" data-sel-create>+ Buat Permohonan</button>':''}<button class="sel-ghost" type="button" data-sel-refresh>Perbarui</button></div></div><div class="sel-toolbar"><input id="selSearch" type="search" placeholder="Cari judul permohonan, kode RUP, paket, OPD" value="${esc(state.search)}"><select id="selStatus">${filterOptions.map(([value,label])=>`<option value="${esc(value)}" ${value===state.filterStatus?'selected':''}>${esc(label)}</option>`).join('')}</select><button class="sel-ghost" type="button" data-sel-apply>Terapkan</button></div><div class="sel-list">${listHtml}</div>`}

  const kajiSteps=[['DRAFT','Dokumen Persiapan'],['MENUNGGU_DISPOSISI','Disposisi Kepala'],['REVIU_POKJA','Kaji Ulang'],['PERLU_DETAIL_PPK','Detail Pemilihan'],['SIAP_PROSES_INAPROC','Proses Pemilihan'],['PROSES_INAPROC','Handover PPK'],['SELESAI','Selesai']];
  function pipelineSteps(r){return isKajiRequest(r)?kajiSteps:steps}
  const steps=[['DRAFT','Permohonan'],['MENUNGGU_DISPOSISI','Disposisi Kepala'],['DITUGASKAN_POKJA','Penugasan Pokja'],['REVIU_POKJA','Reviu'],['SIAP_PROSES_INAPROC','Proses Pemilihan'],['PROSES_INAPROC','Handover PPK'],['SELESAI','Selesai']];
  function processStepName(r,index){if(isKajiRequest(r))return index===4?(requestSelectionProcess(r)==='PERSIAPAN'?'Proses Pemilihan':requestProcessLabel(r)):kajiSteps[index]?.[1]||'Tahap paket';return index===4?(requestSelectionProcess(r)==='MINI_KOMPETISI'?'Mini Kompetisi':'Negosiasi'):steps[index]?.[1]||'Tahap paket';}
  function stepIndex(r){
    const st=r?.status||r;
    if(isKajiRequest(r)){
      if(['DIAJUKAN','MENUNGGU_DISPOSISI','DITOLAK_KEPALA'].includes(st))return 1;
      if(['DITUGASKAN_POKJA','REVIU_POKJA','REVIU_ULANG','PERLU_PERBAIKAN_PPK'].includes(st))return 2;
      if(st==='PERLU_DETAIL_PPK')return 3;
      if(st==='BATAL')return 4;
      if(st==='SELESAI')return 6;
      if(['SIAP_PROSES_INAPROC','PROSES_INAPROC'].includes(st)){const phase=requestSelectionProcess(r)==='MINI_KOMPETISI'?r.mini_stage:r.nego_stage;return phase&&phase!=='HANDOVER'?4:5;}
      return 0;
    }
    if(['DIAJUKAN','MENUNGGU_DISPOSISI','DITOLAK_KEPALA'].includes(st))return 1;
    if(st==='DITUGASKAN_POKJA')return 2;
    if(['REVIU_POKJA','PERLU_PERBAIKAN_PPK','REVIU_ULANG'].includes(st))return 3;
    if(st==='BATAL')return 4;
    if(st==='SELESAI')return 6;
    if(['SIAP_PROSES_INAPROC','PROSES_INAPROC'].includes(st)){
      // Paket lama tidak memiliki mini_stage/nego_stage, langsung lanjut ke INAPROC.
      const phase=requestSelectionProcess(r)==='MINI_KOMPETISI'?r.mini_stage:r.nego_stage;
      return phase&&phase!=='HANDOVER'?4:5;
    }
    return 0;
  }
  function stepper(r){const cur=stepIndex(r),rejected=r.status==='DITOLAK_KEPALA',stopped=['DITOLAK_KEPALA','BATAL'].includes(r.status);return `<div class="sel-stepper" data-status="${esc(r.status)}">${pipelineSteps(r).map((x,i)=>{const isRejected=rejected&&i===1,isCancelled=r.status==='BATAL'&&i===4;const label=isRejected?'Ditolak':isCancelled?'Batal':i<cur&&!stopped?'Selesai':i===cur?'Saat ini':'Berikutnya';return `<button type="button" class="sel-step ${i<cur&&!stopped?'done':i===cur?'active':''} ${warnStatuses.has(r.status)&&i===cur?'warn':''} ${isRejected||isCancelled?'rejected':''} ${inspectedStep===i?'inspecting':''}" data-step-tip="${i}" aria-pressed="${(inspectedStep??cur)===i}" aria-current="${i===cur?'step':'false'}"><small>${String(i+1).padStart(2,'0')}</small><b>${esc(processStepName(r,i))}</b><span>${label}</span></button>`}).join('')}</div>`}

  function stageInfo(d,index){
    const r=d.request,cur=stepIndex(r),role=state.me?.role;
    const head=['KEPALA_UKPBJ','ADMIN'].includes(role),reviewer=['POKJA','ADMIN'].includes(role),forPpk=role==='PPK';
    const actions=[];let title=processStepName(r,index),text='';
    if(isKajiRequest(r)){
      if(index===0){title='Dokumen Persiapan';text=cur===0?'Unggah dokumen persiapan sebelum dikirim ke Kepala UKPBJ.':'Dokumen persiapan telah dikirim.';}
      if(index===1){title='Disposisi Kepala UKPBJ';text=cur===1?'Menunggu penetapan Pokja dan Surat Perintah Pokja.':'Pokja sudah ditetapkan.';}
      if(index===2){title=r.status==='PERLU_PERBAIKAN_PPK'?'Menunggu tindak lanjut PPK':'Kaji Ulang';text=r.status==='PERLU_PERBAIKAN_PPK'?'PPK dapat menambahkan catatan atau mengganti dokumen yang perlu diperbaiki.':r.kaji_ulang_date?'Kaji Ulang terakhir: '+dateOnly(r.kaji_ulang_date):(forPpk?'Menunggu hasil Kaji Ulang.':'Pokja memeriksa dokumen persiapan dan membuat BA Kaji Ulang.');}
      if(index===3){title=r.status==='PERLU_DETAIL_PPK'?'Lengkapi detail '+requestProcessLabel(r):'Detail Pemilihan';text=r.status==='PERLU_DETAIL_PPK'?'Metode sudah ditetapkan Pokja. PPK melengkapi detail proses sebelum dilanjutkan.':(requestSelectionProcess(r)==='NEGOSIASI'&&['SIAP_PROSES_INAPROC','PROSES_INAPROC','SELESAI','BATAL'].includes(r.status)?'Tahap ini dilewati karena Negosiasi langsung dilanjutkan setelah Kaji Ulang.':'Menunggu hasil Kaji Ulang.');}
      if(index>=4){text=forPpk?'Pantau perkembangan paket dan periksa dokumen hasil pemilihan jika sudah tersedia.':'Proses dilakukan sesuai metode yang dipilih Pokja.';}
      return {title,text,actions};
    }
    if(index===0){text=r.previous_request_id?`Pengajuan ulang dari ${r.previous_request_id}.`:(cur===0?'Lengkapi dokumen sebelum mengirim permohonan.':'Permohonan telah dikirim oleh PPK.');actions.push(['docs','Lihat dokumen']);}
    if(index===1){
      if(r.status==='DITOLAK_KEPALA'){title='Permohonan ditolak';text=r.rejected_reason||'Lihat alasan pada catatan proses.';}
      else if(['MENUNGGU_DISPOSISI','DIAJUKAN'].includes(r.status)){title='Menunggu disposisi Kepala UKPBJ';text='Pokja belum ditetapkan. Surat perintah dilampirkan saat disposisi.';}
      else if(cur<1){text='Permohonan belum dikirim ke Kepala UKPBJ.';}
      else{text=`Disposisi tersimpan${r.assigned_at?' pada '+dt(r.assigned_at)+' WIB':''}.`;if(canSeeOrder())actions.push(['assignment',assignmentOpen?'Tutup surat perintah':'Lihat surat perintah']);}
    }
    if(index===2){
      if(!r.assigned_pokja_id){title='Belum didisposisikan';text=r.status==='DITOLAK_KEPALA'?'Permohonan ditolak. PPK dapat membuat permohonan ulang.':'Penugasan Pokja menunggu disposisi Kepala UKPBJ.';}
      else{const team=(d.pokja||[]).find(p=>p.pokja_id===r.assigned_pokja_id);title=team?.nama||'Pokja telah ditetapkan';text=r.sop_started_at?`SOP mulai ${dt(r.sop_started_at)} WIB.`:'Pokja telah ditetapkan.';if(canSeeOrder())actions.push(['assignment',assignmentOpen?'Tutup surat perintah':'Lihat surat perintah']);}
    }
    if(index===3){
      if(r.status==='PERLU_PERBAIKAN_PPK'){title='Menunggu tindak lanjut PPK';text='PPK dapat memberi catatan dan mengunggah revisi jika diperlukan.';actions.push(['docs','Lihat dokumen']);}
      else if(r.status==='REVIU_ULANG'){title='Tindak lanjut PPK diterima';text=forPpk?'Perbaikan sudah dikirim. Menunggu hasil reviu ulang.':'Pokja dapat memeriksa catatan PPK dan dokumen yang diperbarui, jika ada.';}
      else if(r.status==='DITUGASKAN_POKJA'){title='Reviu belum dimulai';text=forPpk?'Menunggu proses reviu dokumen.':'Pokja dapat memulai reviu dokumen.';if(reviewer)actions.push(['start-review','Mulai reviu']);}
      else if(r.status==='REVIU_POKJA'){title='Reviu sedang berjalan';text=`Reviu ke-${r.current_round||1}.`;actions.push(['docs','Lihat hasil reviu']);}
      else{text=cur>3?'Reviu selesai.':'Menunggu penugasan Pokja.';}
    }
    if(index===4){
      if(cur<4){text='Menunggu hasil reviu Pokja.';}
      else if(requestSelectionProcess(r)==='MINI_KOMPETISI'){title=miniPhaseLabel(r)||'Mini Kompetisi';text=forPpk?'Pantau perkembangan Mini Kompetisi dan dokumen hasilnya.':'Penayangan, evaluasi, dan dokumen hasil kompetisi dicatat pada bagian Proses Mini Kompetisi.';}
      else{title=negoPhaseLabel(r)||'Negosiasi';text=forPpk?'Menunggu dokumen hasil Negosiasi disampaikan kepada PPK.':'Unggah dokumen hasil Negosiasi sebelum handover ke PPK.';}
    }
    if(index===5){
      const p=d.inaproc||r.inaproc_progress;
      if(cur<5){text='Menunggu hasil pemilihan diserahkan kepada PPK.';}
      else{title='Handover ke PPK';text=p?.state==='ready'?`${p.count-p.completed} transaksi berjalan · ${p.completed} selesai.`:'Hasil pemilihan diserahkan kepada PPK. Tindak lanjuti persetujuan pesanan sesuai ketentuan 3 hari kerja.';actions.push(['report','Lihat progres INAPROC']);}
    }
    if(index===6){const p=d.inaproc||r.inaproc_progress;title=r.status==='SELESAI'?'Paket selesai':'Menunggu penyelesaian';text=p?.state==='ready'?(p.completed===p.count?'Seluruh transaksi selesai.':`${p.completed} dari ${p.count} transaksi selesai.`):r.status==='SELESAI'?'Paket telah diselesaikan.':'Masih menunggu penyelesaian transaksi.';if(cur>=5)actions.push(['report','Lihat progres INAPROC']);actions.push(['history','Lihat riwayat']);}
    return {title,text,actions};
  }
  function stagePanel(d){const index=inspectedStep??stepIndex(d.request),info=stageInfo(d,index);return `<section class="sel-stage-panel" id="selStagePanel" aria-live="polite"><div><small>TAHAP ${index+1} · ${esc(processStepName(d.request,index))}</small><h5>${esc(info.title)}</h5><p>${esc(info.text)}</p></div><div class="sel-stage-actions">${info.actions.map(([key,label])=>`<button type="button" class="sel-ghost" data-stage-action="${key}">${esc(label)}</button>`).join('')}</div></section>`}
  function foldCard(title,meta,body,opts={}){const cls=opts.className?` ${opts.className}`:'',icon=opts.icon||'▾',open=opts.open!==false;return `<details class="sel-card sel-fold${cls}" ${open?'open':''}><summary><div><b>${esc(title)}</b>${meta?`<span>${meta}</span>`:''}</div><i aria-hidden="true">${icon}</i></summary><div class="sel-fold-body">${body}</div></details>`}
  function bindPipeline(){
    $$('[data-step-tip]').forEach(b=>b.addEventListener('click',()=>{inspectedStep=Number(b.dataset.stepTip);$$('[data-step-tip]').forEach(el=>{el.classList.toggle('inspecting',el===b);el.setAttribute('aria-pressed',String(el===b))});const panel=$('#selStagePanel');if(panel){panel.outerHTML=stagePanel(state.detail);bindStageActions()}}));bindStageActions();
  }
  function bindStageActions(){
    $$('[data-stage-action]').forEach(b=>b.addEventListener('click',()=>{const key=b.dataset.stageAction;if(state.detail?.loading||writing())return;
      if(key==='assignment'){if(!canSeeOrder())return;assignmentOpen=!assignmentOpen;renderPreservingPosition();if(assignmentOpen)$('.sel-assignment-order')?.scrollIntoView({behavior:'smooth',block:'nearest'});return;}
      if(key==='assign')return openAssign();if(key==='reject')return openReject();if(key==='start-review')return confirmWorkflowAction('startReview');
      const selector={docs:'.sel-docs',assignment:'.sel-assignment-order',history:'#selHistory',report:'#selInaprocReport'}[key];const el=selector?$(selector):null;
      if(key==='history'&&el){el.classList.remove('collapsed');const toggle=$('[data-toggle-history]',el);if(toggle){toggle.textContent='Sembunyikan';toggle.setAttribute('aria-expanded','true')}}el?.scrollIntoView({behavior:'smooth',block:'center'});
    }));
  }
  function currentDoc(detail,type){return (detail.docs||[]).filter(d=>d.doc_type===type&&String(d.is_current).toLowerCase()!=='false').sort((a,b)=>Number(b.version)-Number(a.version))[0]||null}
  function currentReview(detail,doc){if(!doc)return null;const round=Number(detail.request.current_round)||1;return (detail.reviews||[]).find(x=>Number(x.round)===round&&x.doc_id===doc.doc_id)||null}
  function canUpload(r){return state.me?.role==='PPK'&&['DRAFT','PERLU_KELENGKAPAN','PERLU_PERBAIKAN_PPK'].includes(r.status)}
  function canReview(r){return ['POKJA','ADMIN'].includes(state.me?.role)&&['REVIU_POKJA','REVIU_ULANG'].includes(r.status)}

  function reviewPanelHtml(d){
    if(d.loading||isKajiRequest(d.request))return '';
    const review=canReview(d.request),round=Number(d.request.current_round)||1,cur=stepIndex(d.request);
    const rv=(d.reviews||[]).find(x=>x.doc_type==='__PAKET__'&&Number(x.round)===round);
    if(!review&&!rv)return '';
    const ppkNote=(d.notes||[]).filter(n=>n.phase==='PERBAIKAN_PPK').slice(-1)[0];
    const ppkNoteBox=review&&ppkNote?`<div class="sel-ppk-note"><small>CATATAN PPK UNTUK POKJA</small><p>${esc(ppkNote.note)}</p><span>${dt(ppkNote.created_at)} WIB</span></div>`:'';
    const result=rv?`<div class="sel-package-review-result ${rv.status==='SESUAI'?'ok':'fix'}"><b>${rv.status==='SESUAI'?'Sesuai':'Perlu perbaikan'}</b>${rv.note?`<p>${esc(rv.note)}</p>`:''}<small>${dt(rv.updated_at||rv.created_at)} WIB</small></div>`:'';
    const selected=rv?.status||'';
    const controls=review?`<div class="sel-review-form">
      <div class="sel-review-decision"><div class="sel-review-label">Hasil reviu</div>
        <select data-review-status="__PAKET__" class="sel-review-status-proxy" tabindex="-1" aria-hidden="true"><option value="" ${!selected?'selected':''}>Pilih hasil reviu</option><option value="SESUAI" ${selected==='SESUAI'?'selected':''}>Sesuai</option><option value="PERLU_PERBAIKAN" ${selected==='PERLU_PERBAIKAN'?'selected':''}>Perlu perbaikan</option></select>
        <div class="sel-review-choices" role="group" aria-label="Hasil reviu">
          <button type="button" class="sel-review-choice ${selected==='SESUAI'?'selected':''}" data-review-choice="SESUAI" aria-pressed="${selected==='SESUAI'}"><span class="sel-review-choice-mark">✓</span><span><b>Sesuai</b><small>Dokumen dapat dilanjutkan</small></span></button>
          <button type="button" class="sel-review-choice ${selected==='PERLU_PERBAIKAN'?'selected':''}" data-review-choice="PERLU_PERBAIKAN" aria-pressed="${selected==='PERLU_PERBAIKAN'}"><span class="sel-review-choice-mark">!</span><span><b>Tidak Sesuai</b><small>Kembalikan ke PPK</small></span></button>
        </div>
      </div>
      ${requestSelectionProcess(d.request)==='MINI_KOMPETISI'?`<div class="sel-review-upload-slot" data-review-upload-slot ${selected==='SESUAI'?'':'hidden'}>${reviewUploadSectionHtml(d)}</div>`:''}
      <label class="sel-review-note-field"><span>Catatan <em data-review-note-required ${selected==='PERLU_PERBAIKAN'?'':'hidden'}>*</em></span><textarea data-review-note="__PAKET__" placeholder="Tulis hasil pemeriksaan atau bagian yang perlu diperbaiki.">${esc(rv?.note||'')}</textarea></label>
      <div class="sel-review-submit">${requestSelectionProcess(d.request)==='MINI_KOMPETISI'?'<p class="sel-review-publish-info" data-review-publish-info hidden>Unggah kedua BA setelah penayangan di INAPROC.</p>':''}<button class="sel-primary" type="button" data-save-review="__PAKET__">Simpan Reviu</button></div>
    </div>`:'';
    return foldCard('Reviu Paket',`Reviu ke-${round}`,`${ppkNoteBox}${controls||result}`,{className:'sel-package-review',open:cur<=3||review||d.request.status==='PERLU_PERBAIKAN_PPK'});
  }
  function docsHtml(d){
    if(d.loading)return '<section class="sel-card"><p class="sel-detail-updating">Memuat dokumen…</p></section>';
    const upload=canUpload(d.request),review=canReview(d.request)&&!isKajiRequest(d.request),cur=stepIndex(d.request);
    const fields=(d.docConfig||[]).filter(c=>c.doc_type!=='SURAT_PERINTAH_POKJA'&&c.doc_type!=='BA_KAJI_ULANG'&&((isKajiRequest(d.request)||Boolean(d.request.ppk_email&&Number(d.request.hps_alokasi)>0))||!['SK_PPK','DPA_ANGGARAN','SCREENSHOT_RUP'].includes(c.doc_type)));
    const files=fields.map(c=>{const doc=currentDoc(d,c.doc_type),up=docUploadState(d.request.request_id,c.doc_type),replaceOnly=['DRAFT','PERLU_KELENGKAPAN'].includes(String(d.request.status||''));const text=up?.active?(up.text||`Mengunggah ${Math.max(1,Number(up.progress)||1)}%`):up?.failed?'Upload ulang':doc?(replaceOnly?'Upload ulang':'Unggah revisi'):'Unggah';const cls=`sel-upload${up?.active?' uploading':''}${up?.failed?' upload-failed':''}`,style=up?.active?` style="--upload-progress:${Math.max(1,Math.min(100,Math.round(Number(up.progress)||1)))}%"`:'';return `<article class="sel-doc"><div class="sel-doc-title"><b>${esc(c.label)} ${d.request.status!=='PERLU_PERBAIKAN_PPK'&&String(c.required).toLowerCase()!=='false'?'<sup>*</sup>':''}</b><span>${doc?`${esc(doc.file_name)} · v${doc.version} · ${dateOnly(doc.uploaded_at)}`:'Belum diunggah'}</span></div><div class="sel-doc-version">${doc?`<a href="${esc(doc.drive_url)}" target="_blank" rel="noopener">Buka dokumen ↗</a>`:'—'}</div><div class="sel-doc-actions">${upload?`<label class="${cls}"${style}>${esc(text)}<input type="file" data-doc-upload="${esc(c.doc_type)}" accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png" ${up?.active?'disabled':''}></label>`:''}</div></article>`}).join('');
    return `${foldCard('Dokumen Persiapan',`${fields.length} dokumen`,`<div class="sel-docs">${files}</div>`,{open:cur<=3||upload||d.request.status==='PERLU_PERBAIKAN_PPK'})}${review||isKajiRequest(d.request)?'':reviewPanelHtml(d)}`;
  }

  function documentHistoryHtml(d){
    if(d.loading)return '';
    const prepTypes=new Set((d.docConfig||[]).map(x=>String(x.doc_type)));const versions=(d.docs||[]).filter(x=>prepTypes.has(String(x.doc_type)));
    if(!versions.length)return '';
    const grouped={};versions.forEach(doc=>(grouped[doc.doc_type]||(grouped[doc.doc_type]=[])).push(doc));
    const history=Object.keys(grouped).map(type=>{
      const rows=grouped[type].sort((a,b)=>Number(b.version||0)-Number(a.version||0));
      return `<div class="sel-doc-history-group"><b>${esc(rows[0].doc_label||docTypeText(type))}</b>${rows.map(x=>`<div><span>v${esc(x.version)} · ${esc(dateOnly(x.uploaded_at))} · ${esc(x.file_name)}</span><a href="${esc(x.drive_url)}" target="_blank" rel="noopener">Lihat dokumen ↗</a></div>`).join('')}</div>`;
    }).join('');
    return foldCard('Riwayat Dokumen Persiapan',`${versions.length} berkas`,`<div class="sel-doc-history">${history}</div>`,{open:false});
  }
  function roleActions(d){if(d.loading)return'';const r=d.request,role=state.me?.role;let out='';
    if(role==='PPK'&&['DRAFT','PERLU_KELENGKAPAN'].includes(r.status))out+=`<button class="sel-primary" data-submit-request>Kirim ke Kepala UKPBJ</button>`;
    
    if(role==='PPK'&&r.status==='PERLU_PERBAIKAN_PPK'){
      const previousKaji=(d.notes||[]).filter(n=>n.phase==='KAJI_ULANG'&&n.status==='PERBAIKAN').slice(-1)[0];
      const pokjaKajiNote=String(r.kaji_ulang_note||previousKaji?.note||'').trim();
      const pokjaCorrection=isKajiRequest(r)&&pokjaKajiNote?`<div class="sel-pokja-correction"><b>Catatan perbaikan Pokja</b><p>${esc(pokjaKajiNote)}</p><small>Kaji Ulang${r.kaji_ulang_date?' · '+dateOnly(r.kaji_ulang_date):''}</small></div>`:'';
      const revisionNote=String(ppkRevisionDrafts.get(ppkRevisionDraftKey(r))||'');
      const revisionChars=characterCount(revisionNote),needsKajiChars=isKajiRequest(r),kajiValid=!needsKajiChars||revisionChars>=5;
      const revisionHint=needsKajiChars?(revisionChars>=5?'Catatan dapat dikirim.':'Minimal 5 karakter.'):(r.mini_stage==='GAGAL'?'Dokumen lama tetap berlaku. Revisi dan catatan tidak wajib.':'Dokumen tidak perlu diunggah ulang jika tidak ada perubahan. Isi catatan atau unggah dokumen revisi.');
      out+=`<div class="sel-ppk-revision ${needsKajiChars&&!kajiValid?'is-invalid':''}">${pokjaCorrection}<label for="selPpkRevisionNote">Catatan PPK untuk Pokja ${needsKajiChars?'<sup>*</sup>':''}</label><textarea id="selPpkRevisionNote" maxlength="2000" rows="3" placeholder="Tulis penjelasan atau tindak lanjut hasil reviu." ${needsKajiChars&&!kajiValid?'class="is-invalid"':''}>${esc(revisionNote)}</textarea><small id="selPpkRevisionHint" class="${needsKajiChars&&!kajiValid?'is-error':''}">${esc(revisionHint)}${needsKajiChars?` (${revisionChars}/5 karakter)`:''}</small></div><button class="sel-primary" data-resubmit-revision ${!kajiValid?'disabled':''}>Kirim ke Pokja</button>`;
    }
    if(role==='PPK'&&r.status==='DITOLAK_KEPALA'){const reapplied=(d.audit||[]).find(x=>x.action==='REAPPLY_REQUEST');out+=reapplied?`<button class="sel-ghost sel-action-done" type="button" disabled>Sudah dilakukan pengajuan ulang</button>`:`<button class="sel-primary" data-reapply>Ajukan Ulang</button>`;}
    if(role==='KEPALA_UKPBJ'&&['MENUNGGU_DISPOSISI','DIAJUKAN'].includes(r.status))out+=`<button class="sel-danger" data-open-reject>Tolak Permohonan</button><button class="sel-primary" data-open-assign>Tetapkan Pokja</button>`;
    if(['POKJA','ADMIN'].includes(role)&&r.status==='DITUGASKAN_POKJA'&&!isKajiRequest(r))out+=`<button class="sel-primary" data-start-review>Mulai Reviu</button>`;
    return out?`<div class="sel-actions">${out}</div>`:''}
  function notesHtml(d){if(d.loading)return'';const notes=d.notes||[],cur=stepIndex(d.request);return notes.length?foldCard('Catatan Proses',`${notes.length} catatan`,notes.map(n=>`<article class="sel-note"><small>${esc(n.phase)} · ${dateOnly(n.created_at)}</small><b>${esc(n.status||'')}</b><p>${esc(n.note||'')}</p></article>`).join(''),{open:cur<=3||d.request.status==='PERLU_PERBAIKAN_PPK'}):''}
  function auditLabel(a,opts={}){if(a==='CREATE_REQUEST'&&opts.reapplication)return 'Pengajuan ulang paket dibuat';const map={CREATE_REQUEST:'Permohonan dibuat',UPLOAD_DOCUMENT:'Dokumen diunggah',SUBMIT_REQUEST:'Dikirim ke Kepala UKPBJ',STATUS_DIAJUKAN:'Dikirim ke Kepala UKPBJ',STATUS_MENUNGGU_DISPOSISI:'Menunggu disposisi Kepala UKPBJ',ASSIGN_POKJA:'Pokja ditetapkan',REJECT_REQUEST:'Permohonan ditolak',REAPPLY_REQUEST:'Pengajuan ulang dibuat',START_REVIEW:'Reviu dimulai',SAVE_REVIEW:'Hasil reviu disimpan',SAVE_PACKAGE_REVIEW:'Reviu paket disimpan',SEND_REVISION:'Perbaikan diminta',RESUBMIT_REVISION:'Tindak lanjut PPK dikirim',COMPLETE_REVIEW:'Reviu selesai',START_INAPROC:'Proses INAPROC dimulai',COMPLETE_REQUEST:'Pemilihan selesai',LOGIN:'Masuk',LOGOUT:'Keluar',ADMIN_CREATE_USER:'Akun dibuat',ADMIN_UPDATE_USER:'Akun diubah',ADMIN_RESET_PASSWORD:'Password diubah',ADMIN_SAVE_POKJA:'Pokja disimpan',ADMIN_SAVE_DOC_CONFIG:'Dokumen diatur',ADMIN_DELETE_DOC_CONFIG:'Dokumen dihapus dari daftar',SAVE_DRAFT_REQUEST:'Draft disimpan',DELETE_DRAFT_REQUEST:'Draft dihapus',MINI_TAYANG:'Kompetisi ditayangkan',MINI_PERUBAHAN:'Perubahan kompetisi dicatat',MINI_BATAL:'Kompetisi dibatalkan',MINI_GAGAL:'Kompetisi gagal, dikembalikan ke PPK',MINI_EVALUASI:'Evaluasi pemenang dimulai',MINI_HANDOVER:'Handover ke PPK',NEGO_MULAI:'Negosiasi dimulai',NEGO_HASIL:'Hasil Negosiasi dicatat',NEGO_HANDOVER:'Handover Negosiasi ke PPK',KAJI_ULANG_LANJUT:'Kaji Ulang selesai · Metode ditetapkan',KAJI_ULANG_PERBAIKAN:'Kaji Ulang · Perlu perbaikan',RESUBMIT_KAJI_REVISION:'Tindak lanjut Kaji Ulang dikirim',SUBMIT_KAJI_DETAILS:'Detail proses pemilihan dikirim',KIRIM_UNDANGAN_KAJI:'Undangan Kaji Ulang dibuat untuk PPK'};return map[a]||String(a||'').replace(/_/g,' ')}
  function auditDetail(x){try{return JSON.parse(x?.detail_json||'{}')}catch(_){return{}}}
  function docTypeText(t){const m={SURAT_PERMOHONAN:'Surat Permohonan E-Purchasing',SK_PPK:'SK Pengangkatan PPK',DPA_ANGGARAN:'Dokumen DPA Anggaran',SCREENSHOT_RUP:'Screenshot RUP',KAK:'KAK / Spesifikasi Teknis',HPS:'HPS',RANCANGAN_KONTRAK:'Rancang Kontrak',DATA_RUP:'Data / ID RUP',WAKTU_PENGGUNAAN:'Rencana Waktu Penggunaan',PENDUKUNG:'Dokumen Pendukung',SURAT_PERINTAH_POKJA:'Surat Perintah Pokja',BA_KAJI_ULANG:'Berita Acara Kaji Ulang',SURAT_UNDANGAN_KAJI_ULANG:'Surat Undangan Kaji Ulang',SURAT_PENYAMPAIAN_HASIL:'Surat Penyampaian Hasil Pemilihan'};return m[t]||String(t||'Dokumen').replace(/_/g,' ')}
  function findDocVersionLink(source,docType,fileName,version){const docs=Array.isArray(source?.docs)?source.docs:[];let row=docs.find(doc=>String(doc.doc_type)===String(docType||'')&&String(doc.version||'')===String(version||'')&&String(doc.file_name||'')===String(fileName||'')&&doc.drive_url);if(!row)row=docs.find(doc=>String(doc.doc_type)===String(docType||'')&&String(doc.version||'')===String(version||'')&&doc.drive_url);if(!row)row=docs.find(doc=>String(doc.doc_type)===String(docType||'')&&String(doc.file_name||'')===String(fileName||'')&&doc.drive_url);if(!row&&String(fileName||'').trim())row=docs.find(doc=>String(doc.file_name||'')===String(fileName||'')&&doc.drive_url);return row?.drive_url||''}
  // Riwayat upload dibuat sekali di dalam timeline, tidak diduplikasi di atas.
  function groupAudit(a){
    const out=[];
    const rows=Array.isArray(a)?a:[];
    const submitIndex=rows.findIndex(x=>['SUBMIT_REQUEST','STATUS_DIAJUKAN','STATUS_MENUNGGU_DISPOSISI'].includes(String(x.action||'')));
    const boundary=submitIndex>=0?submitIndex:rows.length;
    const keepBeforeSubmit=new Set();
    if(boundary>0){
      const latestByType=new Map();
      for(let i=0;i<boundary;i++){
        const row=rows[i];
        if(row.action!=='UPLOAD_DOCUMENT')continue;
        const q=auditDetail(row),key=String(q.docType||'').trim()||'__UNKNOWN__';
        latestByType.set(key,String(row.audit_id||i));
      }
      latestByType.forEach(v=>keepBeforeSubmit.add(v));
    }
    for(let i=0;i<rows.length;i++){
      const x=rows[i],auditKey=String(x.audit_id||i);
      if(i<boundary&&x.action==='UPLOAD_DOCUMENT'&&!keepBeforeSubmit.has(auditKey))continue;
      if(x.action==='UPLOAD_DOCUMENT'){
        const items=[x];
        // Pertahankan urutan log dan batasi pengelompokan pada pengguna/hari yang sama.
        while(i+1<rows.length){
          const next=rows[i+1],nextKey=String(next.audit_id||(i+1));
          if(i+1<boundary&&next.action==='UPLOAD_DOCUMENT'&&!keepBeforeSubmit.has(nextKey)){i++;continue;}
          if(next.action==='UPLOAD_DOCUMENT'&&next.user_id===x.user_id&&dateOnly(next.created_at)===dateOnly(x.created_at)){items.push(rows[++i]);continue;}
          break;
        }
        out.push({type:'uploads',items,created_at:items[0].created_at,role:items[0].role});
      }else out.push({type:'single',item:x});
    }
    return out;
  }
  function auditNoteToggleHtml(id,label,body){if(!body)return '';return `<button type="button" class="sel-audit-group-toggle sel-audit-note-toggle" data-toggle-audit-note="${esc(id)}" aria-expanded="false">${esc(label||'Lihat Catatan')}</button><div class="sel-audit-group-items sel-audit-note-box" data-audit-note="${esc(id)}"><div class="sel-audit-note-content">${esc(body)}</div></div>`}
  function uploadAuditGroupHtml(source,g,idx){
    return `<article class="sel-audit-entry sel-audit-entry-upload"><small>${dt(g.created_at)} WIB</small><div><b>${g.items.length} dokumen diunggah</b><p>${esc(roleLabel[g.role]||g.role||'')}</p><button type="button" class="sel-audit-group-toggle" data-toggle-audit-group="${esc(g.items[0].audit_id||idx)}" aria-expanded="false">Lihat Riwayat Upload</button><div class="sel-audit-group-items" data-audit-group="${esc(g.items[0].audit_id||idx)}">${g.items.map(x=>{const q=auditDetail(x),url=findDocVersionLink(source,q.docType,q.fileName,q.version),displayDoc=(source?.docs||[]).find(doc=>String(doc.doc_type)===String(q.docType||'')&&String(doc.version||'')===String(q.version||'')),fileLabel=displayDoc?.file_name||q.fileName||'';return `<div class="sel-audit-doc-item"><div class="sel-audit-doc-copy"><strong>${esc(docTypeText(q.docType))}</strong><small>${q.version?`v${esc(q.version)} · `:''}${esc(dateOnly(x.created_at))} · ${esc(fileLabel)}</small></div><div class="sel-audit-doc-meta">${url?`<a class="sel-audit-doc-link" href="${esc(url)}" target="_blank" rel="noopener">Lihat dokumen ↗</a>`:''}</div></div>`}).join('')}</div></div></article>`;
  }
  function auditTimelineHtml(source,opts={}){const audits=Array.isArray(source?.audit)?source.audit:(Array.isArray(source)?source:[]),groups=groupAudit(audits).slice().reverse();return groups.length?groups.map((g,idx)=>{if(g.type==='uploads')return uploadAuditGroupHtml(source,g,idx);const x=g.item,q=auditDetail(x),rejected=x.action==='REJECT_REQUEST',failed=x.action==='MINI_GAGAL',cancelled=x.action==='MINI_BATAL',repair=['SEND_REVISION','KAJI_ULANG_PERBAIKAN'].includes(x.action)||(x.action==='SAVE_PACKAGE_REVIEW'&&String(q.status||'').toUpperCase()==='PERLU_PERBAIKAN');const warning=rejected||failed||cancelled||repair;const noteText=String(q.note||q.reason||'').trim();const extra=x.action==='REAPPLY_REQUEST'&&q.newRequestId?`<span class="sel-audit-link">Pengajuan baru: ${esc(q.newRequestId)}</span>`:'';const noteToggle=noteText?auditNoteToggleHtml(`note-${idx}-${x.audit_id||x.created_at||''}`,'Lihat Catatan',noteText):'';return `<article class="${warning?'sel-audit-warning ':''}${rejected?'sel-audit-rejected ':''}${failed?'sel-audit-failed ':''}${cancelled?'sel-audit-cancelled ':''}${repair?'sel-audit-repair':''}"><small>${dt(x.created_at)} WIB</small><div><b>${esc(auditLabel(x.action,opts))}</b><p>${esc(roleLabel[x.role]||x.role||'')}</p>${extra}${noteToggle}</div></article>`}).join(''):'<div class="sel-empty"><b>Belum ada riwayat</b></div>'}
  function historyNotesInlineHtml(source){
    const existing=new Set((source?.audit||[]).map(x=>String(auditDetail(x).note||auditDetail(x).reason||'').trim()).filter(Boolean));
    const notes=(Array.isArray(source?.notes)?source.notes:[]).filter(n=>String(n.note||'').trim()&&!existing.has(String(n.note||'').trim()));
    if(!notes.length)return '';
    const list=notes.map(n=>`<div class="sel-history-note"><small>${esc(n.phase||'Catatan')} · ${dateOnly(n.created_at)}${n.status?' · '+esc(n.status):''}</small><p>${esc(n.note||'')}</p></div>`).join('');
    return `<div class="sel-history-notes"><button type="button" class="sel-audit-group-toggle" data-toggle-history-notes aria-expanded="false">Lihat Catatan (${notes.length})</button><div class="sel-history-notes-content" data-history-notes>${list}</div></div>`;
  }
  function historyRequestBlock(item,current=false){const r=item.request||{},reapplication=Boolean(r.previous_request_id),rejected=r.status==='DITOLAK_KEPALA';const label=current?(reapplication?'PENGAJUAN ULANG · SEDANG BERJALAN':'PENGAJUAN SAAT INI'):(reapplication?'PENGAJUAN ULANG SEBELUMNYA':'PENGAJUAN SEBELUMNYA');const status=rejected?'Ditolak':statusLabel[r.status]||r.status||'';const toggle=current?`<button type="button" class="sel-history-toggle sel-history-current-toggle" data-toggle-current-history aria-expanded="true">Sembunyikan</button>`:'';const statusChip=current?'':`<span class="sel-history-request-status${rejected?' rejected':''}">${esc(status)}</span>`;return `<section class="sel-history-request${rejected?' rejected':''}${current?' current':''}"${current?' data-current-history':''}><div class="sel-history-request-head"><div><small>${esc(label)}</small><b>${esc(r.request_id||'')}</b></div><div class="sel-history-request-head-actions">${statusChip}${toggle}</div></div><div class="sel-history-request-body"><div class="sel-timeline">${auditTimelineHtml(item,{reapplication})}</div></div></section>`}
  function auditHtml(d){if(d.loading)return'';const current=d.audit||[],previous=Array.isArray(d.previousHistory)?d.previousHistory:[],allCount=current.length+previous.reduce((n,x)=>n+(x.audit||[]).length,0),reapplication=Boolean(d.request?.previous_request_id);let body='';if(previous.length){body=`<div class="sel-history-chain">${historyRequestBlock({request:d.request,audit:current,docs:d.docs||[]},true)}<div class="sel-history-previous-toggle-wrap"><button type="button" class="sel-ghost" data-toggle-previous-history aria-expanded="false">Lihat pengajuan sebelumnya (${previous.length})</button></div><div class="sel-history-previous collapsed" data-previous-history>${previous.slice().reverse().map(x=>historyRequestBlock(x,false)).join('')}</div></div>`}else body=`<div class="sel-timeline">${auditTimelineHtml({audit:current,docs:d.docs||[]},{reapplication})}</div>`;const specialDocs=(d.docs||[]).filter(x=>['SURAT_PENYAMPAIAN_HASIL','SURAT_UNDANGAN_KAJI_ULANG'].includes(String(x.doc_type))&&String(x.is_current).toLowerCase()!=='false');const docHistory=specialDocs.length?`<details class="sel-history-documents"><summary><b>Dokumen terkait</b><span>${specialDocs.length} surat</span><span class="sel-history-doc-arrow" aria-hidden="true">⌄</span></summary><div class="sel-history-doc-list">${specialDocs.map(x=>`<div class="sel-history-doc-row"><span>${esc(docTypeText(x.doc_type))}<small>${esc(x.file_name)}</small></span><a href="${esc(x.drive_url)}" target="_blank" rel="noopener">Lihat surat ↗</a></div>`).join('')}</div></details>`:'';const notesInline=historyNotesInlineHtml(d);const seriesCount=previous.length+1;return `<section class="sel-card sel-history collapsed" id="selHistory"><header><div><b>Riwayat Paket</b><span>${allCount} aktivitas${previous.length?' · '+seriesCount+' pengajuan':''}</span></div><button type="button" class="sel-history-toggle" data-toggle-history aria-expanded="false">Tampilkan</button></header><div class="sel-history-body">${docHistory}${body}${notesInline}</div></section>`}
  function assignmentOrderHtml(d){if(!assignmentOpen||!canSeeOrder()||d.loading)return '';const r=d.request,doc=currentDoc(d,'SURAT_PERINTAH_POKJA');if(!doc&&!r.assigned_at&&!r.sop_started_at)return'';return `<section class="sel-card sel-assignment-order"><header><b>Penugasan Pokja</b><span>${r.sop_started_at||r.assigned_at?`${r.sop_started_at?'SOP mulai '+dt(r.sop_started_at)+' WIB':'Penugasan lama · '+dt(r.assigned_at)+' WIB'}`:''}</span></header><div class="sel-assignment-row"><div><small>SURAT PERINTAH</small><b>${doc?esc(doc.file_name):'Belum tersedia'}</b></div>${doc?`<a class="sel-ghost sel-doc-link" href="${esc(doc.drive_url)}" target="_blank" rel="noopener">Buka surat ↗</a>`:''}</div></section>`}
  function reportStatusHtml(code,shipment=false){
    const labels=shipment?{DRAFT:'Belum diproses',PROCESSING:'Sedang diproses',SHIPPING:'Dalam pengiriman',DELIVERED:'Sudah dikirim',BUYER_CONFIRMED:'Dikonfirmasi pembeli',COMPLETED:'Pengiriman selesai'}:{ON_PROCESS:'Sedang berjalan',ON_ADDENDUM:'Proses adendum',PAYMENT_OUTSIDE_SYSTEM:'Pembayaran di luar sistem',COMPLETED:'Selesai'};
    const done=shipment?code==='COMPLETED':['PAYMENT_OUTSIDE_SYSTEM','COMPLETED'].includes(code);
    return `<span class="sel-report-status ${done?'done':code==='ON_ADDENDUM'?'amend':code==='DRAFT'?'waiting':'ongoing'}">${esc(labels[code]||code||'Belum tersedia')}</span>`;
  }
  function inaprocHtml(d){
    if(d.loading||!['SIAP_PROSES_INAPROC','PROSES_INAPROC','SELESAI'].includes(d.request.status)||(requestSelectionProcess(d.request)==='MINI_KOMPETISI'&&d.request.mini_stage&&d.request.mini_stage!=='HANDOVER')||(requestSelectionProcess(d.request)==='NEGOSIASI'&&d.request.nego_stage&&d.request.nego_stage!=='HANDOVER'))return '';
    const p=d.inaproc||d.request.inaproc_progress||{state:'empty',message:'Belum ada transaksi.'},r=d.request;
    const head=`<header><div><b>Progres INAPROC</b><span>RUP ${esc(r.kode_rup)}${r.year?' · '+esc(r.year):''}</span></div><button type="button" class="sel-ghost" data-report-refresh>Perbarui</button></header>`;
    if(p.state!=='ready')return `<section class="sel-card sel-inaproc-report" id="selInaprocReport">${head}<p class="sel-report-message" role="status">${esc(p.message||'Belum ada transaksi.')}</p></section>`;
    const count=Number(p.count)||0,done=Number(p.completed)||0,finished=count>0&&done===count,stage=finished?6:5,percent=stage/6*100;
    return `<section class="sel-card sel-inaproc-report" id="selInaprocReport">${head}<div class="sel-report-summary"><div><b>${finished?'Selesai':'Sedang Berjalan'}</b><span>${count-done} berjalan · ${done} selesai</span></div><div><span>Total transaksi</span><b>${esc(new Intl.NumberFormat('id-ID',{style:'currency',currency:'IDR',maximumFractionDigits:2}).format(p.total||0))}</b>${p.missing_values?'<small>Beberapa nilai belum tersedia.</small>':''}</div></div><div class="sel-report-meter ${finished?'finished':'running'}" role="progressbar" aria-label="Tahapan paket" aria-valuemin="1" aria-valuemax="6" aria-valuenow="${stage}" aria-valuetext="Tahap ${stage} dari 6"><span style="width:${percent}%"></span></div><div class="sel-report-table-wrap" tabindex="0" aria-label="Rincian transaksi INAPROC"><table class="sel-report-table"><thead><tr><th scope="col">Transaksi</th><th scope="col">Tanggal pesanan</th><th scope="col">Nilai</th><th scope="col">Pengiriman</th><th scope="col">Status proses</th></tr></thead><tbody>${(p.transactions||[]).map((t,i)=>`<tr><td><b>${esc(t.rup_name||r.nama_paket)}</b><small>Transaksi ${i+1}</small></td><td>${esc(dateOnly(t.order_date))}</td><td class="sel-report-amount">${t.total==null?'—':esc(new Intl.NumberFormat('id-ID',{style:'currency',currency:'IDR',maximumFractionDigits:2}).format(t.total))}</td><td>${reportStatusHtml(t.shipment_status,true)}</td><td>${reportStatusHtml(t.status)}</td></tr>`).join('')}</tbody></table></div></section>`;
  }

  const negoDocNames={SURAT_PENYAMPAIAN_HASIL:'Surat Penyampaian Hasil Pemilihan',NEGO_BA_HASIL_REVIU:'Berita Acara Hasil Reviu Dokumen Pemilihan Paket Negosiasi',NEGO_BA_HASIL_EVALUASI:'Berita Acara Hasil Evaluasi Kesepakatan Negosiasi Harga',NEGO_SURAT_PENETAPAN_PA_KPA:'Surat Penetapan Pemenang PA/KPA'};
  function reviewUploadSectionHtml(d){
    const r=d.request,review=['REVIU_POKJA','REVIU_ULANG'].includes(String(r.status||''));
    if(!review||requestSelectionProcess(r)!=='MINI_KOMPETISI'||!['POKJA','ADMIN'].includes(state.me?.role))return '';
    const types=['BA_HASIL_REVIU','BA_PERSETUJUAN_POKJA'];
    return types.map(type=>{
      const doc=currentDoc(d,type),up=docUploadState(r.request_id,type);
      const upload=`<label class="sel-upload ${up?.active?'uploading':''}${up?.failed?' upload-failed':''}" ${up?.active?`style="--upload-progress:${Math.max(1,Number(up.progress)||1)}%"`:''}>${esc(up?.active?up.text||'Mengunggah…':up?.failed?'Upload ulang':doc?'Unggah revisi':'Unggah')}<input type="file" data-mini-doc="${type}" accept=".pdf,.doc,.docx" ${up?.active?'disabled':''}></label>`;
      return `<article class="sel-mini-document sel-review-ba-row"><div><b>${esc(miniDocNames[type])} <sup>*</sup></b><small>${doc?esc(doc.file_name):'Belum diunggah'}</small></div><div class="sel-mini-document-actions">${doc?`<a href="${esc(doc.drive_url)}" target="_blank" rel="noopener">Lihat dokumen ↗</a>`:''}${upload}</div></article>`;
    }).join('');
  }

  function negoHtml(d){
    const r=d.request;if(d.loading||requestSelectionProcess(r)!=='NEGOSIASI')return '';
    const stage=String(r.nego_stage||''),pending=r.status==='SIAP_PROSES_INAPROC'&&['SIAP_NEGOSIASI','NEGOSIASI','HASIL_NEGOSIASI'].includes(stage),handover=stage==='HANDOVER';
    if(!pending&&!handover)return '';
    const pokja=['POKJA','ADMIN'].includes(state.me?.role),needsPa=Number(r.pagu)>100000000000;
    const types=['NEGO_BA_HASIL_REVIU','NEGO_BA_HASIL_EVALUASI',...(needsPa?['NEGO_SURAT_PENETAPAN_PA_KPA']:[]),...((r.ppk_email&&Number(r.hps_alokasi)>0&&String(r.workflow_scheme||'')==='KAJI_ULANG_2026'||currentDoc(d,'SURAT_PENYAMPAIAN_HASIL'))?['SURAT_PENYAMPAIAN_HASIL']:[])];
    const complete=types.every(type=>Boolean(currentDoc(d,type))),uploaded=types.filter(type=>Boolean(currentDoc(d,type))).length;
    const docs=types.map(type=>{const doc=currentDoc(d,type),up=docUploadState(r.request_id,type);return `<article class="sel-mini-document"><div><b>${esc(negoDocNames[type])} <sup>*</sup></b><small>${doc?esc(doc.file_name):'Belum diunggah'}</small></div><div class="sel-mini-document-actions">${doc?`<a href="${esc(doc.drive_url)}" target="_blank" rel="noopener">Lihat dokumen ↗</a>`:''}${pokja&&pending?`<label class="sel-upload ${up?.active?'uploading':''}${up?.failed?' upload-failed':''}" ${up?.active?`style="--upload-progress:${Math.max(1,Number(up.progress)||1)}%"`:''}>${esc(up?.active?up.text||'Mengunggah…':up?.failed?'Upload ulang':doc?'Unggah revisi':'Unggah')}<input type="file" data-nego-doc="${type}" accept=".pdf" ${up?.active?'disabled':''}></label>`:''}</div></article>`}).join('');
    const intro=pending?(pokja?'Unggah dokumen hasil Negosiasi setelah diproses di INAPROC. Seluruh dokumen wajib dilengkapi sebelum handover.':'Menunggu dokumen hasil Negosiasi disampaikan kepada PPK.'):'Dokumen hasil Negosiasi telah diterima PPK. Progres Surat Pesanan dapat dipantau melalui INAPROC.';
    const helper=pending&&pokja?`<p class="sel-mini-field-help">Dokumen lengkap ${uploaded} dari ${types.length}. PDF maksimal 10 MB. <a href="https://bit.ly/4i4j4fb" target="_blank" rel="noopener noreferrer">Template Dokumen Negosiasi ↗</a></p>`:'';
    const buttons=pokja&&pending?`<div class="sel-mini-buttons"><button type="button" class="sel-primary" data-nego-action="HANDOVER" ${!complete?'disabled title="Lengkapi seluruh dokumen wajib terlebih dahulu"':''}>Handover ke PPK</button></div>`:'';
    const reminder=handover?`<p class="sel-mini-reminder"><b>Pengingat PPK:</b> Hasil pemilihan sudah disampaikan. Mohon segera buat Surat Pesanan di katalog.inaproc.id paling lambat 3 hari kerja sejak hari ini agar paket tidak terlambat diproses.</p>`:'';
    return `<section class="sel-card sel-mini-workflow" id="selNegoWorkflow"><header><div><small>NEGOSIASI</small><h4>${handover?'Handover ke PPK':'Dokumen Negosiasi'}</h4><p>${esc(intro)}</p></div></header><div class="sel-mini-documents">${docs}</div>${helper}${reminder}${buttons}</section>`;
  }

  const miniDocNames={BA_HASIL_REVIU:'Dokumen Persiapan Pengadaan',SURAT_PENYAMPAIAN_HASIL:'Surat Penyampaian Hasil Pemilihan',BA_PERSETUJUAN_POKJA:'Berita Acara Persetujuan Pokja',BA_PERSETUJUAN:'Berita Acara Persetujuan Perubahan Kompetisi',BA_PEMBATALAN:'Berita Acara Pembatalan Kompetisi',BA_HASIL_EVALUASI:'Berita Acara Hasil Evaluasi Mini Kompetisi',SURAT_PENETAPAN_PA_KPA:'Surat Penetapan Pemenang PA/KPA'};
  function miniHtml(d){
    const r=d.request;if(d.loading||requestSelectionProcess(r)!=='MINI_KOMPETISI')return '';
    const stage=r.mini_stage||'',review=['REVIU_POKJA','REVIU_ULANG'].includes(r.status),pending=stage==='SIAP_TAYANG'&&r.status==='SIAP_PROSES_INAPROC',tayang=stage==='TAYANG'&&r.status==='SIAP_PROSES_INAPROC',evalStage=stage==='EVALUASI'&&r.status==='SIAP_PROSES_INAPROC',handover=stage==='HANDOVER',failed=stage==='GAGAL'&&r.status==='PERLU_PERBAIKAN_PPK';
    if(review)return '';
    if(!pending&&!tayang&&!evalStage&&!handover&&!failed)return '';
    const pokja=['POKJA','ADMIN'].includes(state.me?.role),canUpload=pokja&&(review||pending||tayang||evalStage),needsPa=Number(r.pagu)>100000000000;
    const key=String(r.request_id),draft=miniDecisionState.get(key)||{},choice=(tayang||evalStage)?String(draft.step||''):'';
    const types=review?['BA_HASIL_REVIU','BA_PERSETUJUAN_POKJA']:tayang?['BA_HASIL_REVIU','BA_PERSETUJUAN_POKJA']:evalStage?['BA_HASIL_EVALUASI',...(needsPa?['SURAT_PENETAPAN_PA_KPA']:[]),...((r.ppk_email&&Number(r.hps_alokasi)>0&&String(r.workflow_scheme||'')==='KAJI_ULANG_2026')?['SURAT_PENYAMPAIAN_HASIL']:[])]:pending?['BA_HASIL_REVIU','BA_PERSETUJUAN_POKJA']:['BA_HASIL_REVIU','BA_PERSETUJUAN_POKJA','BA_HASIL_EVALUASI',...(needsPa?['SURAT_PENETAPAN_PA_KPA']:[]),...((currentDoc(d,'SURAT_PENYAMPAIAN_HASIL')||isKajiRequest(r))?['SURAT_PENYAMPAIAN_HASIL']:[])];
    const docRow=(type,allow)=>{const doc=currentDoc(d,type),up=docUploadState(r.request_id,type);return `<article class="sel-mini-document"><div><b>${esc(miniDocNames[type])}</b><small>${doc?esc(doc.file_name):'Belum diunggah'}</small></div><div class="sel-mini-document-actions">${doc?`<a href="${esc(doc.drive_url)}" target="_blank" rel="noopener">Lihat dokumen ↗</a>`:''}${allow?`<label class="sel-upload ${up?.active?'uploading':''}${up?.failed?' upload-failed':''}" ${up?.active?`style="--upload-progress:${Math.max(1,Number(up.progress)||1)}%"`:''}>${esc(up?.active?up.text||'Mengunggah…':up?.failed?'Upload ulang':doc?'Unggah revisi':'Unggah')}<input type="file" data-mini-doc="${type}" accept=".pdf,.doc,.docx" ${up?.active?'disabled':''}></label>`:''}</div></article>`};
    const displayTypes=(currentDoc(d,'SURAT_PENYAMPAIAN_HASIL')&&!types.includes('SURAT_PENYAMPAIAN_HASIL'))?[...types,'SURAT_PENYAMPAIAN_HASIL']:types;
    const documents=displayTypes.map(type=>docRow(type,canUpload&&((evalStage&&['BA_HASIL_EVALUASI','SURAT_PENETAPAN_PA_KPA','SURAT_PENYAMPAIAN_HASIL'].includes(type))||(isKajiRequest(r)&&pending&&['BA_HASIL_REVIU','BA_PERSETUJUAN_POKJA'].includes(type))))).join('');
    const decisionType=choice==='PERUBAHAN'?'BA_PERSETUJUAN':choice==='BATAL'?'BA_PEMBATALAN':'';
    const decisionTitle=choice==='PERUBAHAN'?'Catat Perubahan':choice==='BATAL'?'Batalkan Kompetisi':'Kompetisi Gagal';
    const decisionForm=choice&&pokja?`<div class="sel-mini-decision-form" data-mini-decision-form><div class="sel-mini-decision-title"><b>${decisionTitle}</b><button type="button" class="sel-ghost" data-mini-decision-cancel>Batal</button></div><label class="sel-field"><span>${choice==='PERUBAHAN'?'URAIAN PERUBAHAN':'ALASAN'} *</span><textarea id="miniDecisionNote" rows="3" maxlength="2000" placeholder="${choice==='GAGAL'?'Tuliskan alasan kompetisi gagal.':'Tuliskan keterangan sesuai hasil di INAPROC.'}">${esc(draft.note||'')}</textarea></label>${decisionType?`<div class="sel-mini-documents">${docRow(decisionType,true)}</div><small class="sel-mini-decision-help">${choice==='PERUBAHAN'?'BA Persetujuan Perubahan Kompetisi tidak wajib.':'BA Pembatalan Kompetisi wajib diunggah sebelum membatalkan paket.'}</small>`:'<small class="sel-mini-decision-help">Tidak perlu mengunggah dokumen. Paket akan dikembalikan ke PPK untuk reviu ulang. Dokumen persiapan lama tetap bisa digunakan.</small>'}${choice==='PERUBAHAN'?`<div class="sel-mini-decision-dates"><label class="sel-field"><span>TANGGAL AKHIR PENAWARAN (OPSIONAL)</span><input id="miniDecisionEnd" type="date" value="${esc(draft.end??formYmd(r.schedule_end_date))}"></label><label class="sel-field"><span>TANGGAL PENYELESAIAN (OPSIONAL)</span><input id="miniDecisionCompletion" type="date" value="${esc(draft.completion??formYmd(r.completion_date))}"></label></div>`:''}<div class="sel-mini-buttons"><button type="button" class="${choice==='BATAL'?'sel-danger':'sel-primary'}" data-mini-decision-save>${choice==='PERUBAHAN'?'Simpan Perubahan':choice==='BATAL'?'Batalkan Kompetisi':'Tandai Gagal'}</button></div></div>`:'';
    const decisions=pokja&&(tayang||evalStage)?`<div class="sel-mini-decision-actions"><button type="button" class="sel-ghost ${choice==='PERUBAHAN'?'selected':''}" data-mini-decision="PERUBAHAN" ${!tayang?'disabled':''}>Catat Perubahan</button><button type="button" class="sel-ghost ${choice==='GAGAL'?'selected':''}" data-mini-decision="GAGAL">Kompetisi Gagal</button><button type="button" class="sel-danger ${choice==='BATAL'?'selected':''}" data-mini-decision="BATAL">Batalkan Kompetisi</button></div>${decisionForm}`:'';
    const actions=pokja?pending?`<button type="button" class="sel-primary" data-mini-action="TAYANG">Sudah Ditayangkan di INAPROC</button>`:tayang?`<button type="button" class="sel-primary" data-mini-action="EVALUASI">Mulai Evaluasi</button>`:evalStage?`<button type="button" class="sel-primary" data-mini-action="HANDOVER">Handover ke PPK</button>`:'':'';
    const title=review?'Dokumen hasil reviu':failed?'Kompetisi gagal':stage==='HANDOVER'?'Handover ke PPK':miniPhaseLabel(r)||'Mini Kompetisi';
    const intro=pokja?(review?'Unggah BA Hasil Reviu sebelum menyelesaikan reviu.':pending?'Lakukan penayangan di INAPROC terlebih dahulu, kemudian catat hasilnya di ORBITA.':tayang?'Catat perubahan, hasil evaluasi, atau keputusan lainnya.':evalStage?'Setelah pemenang ditetapkan di INAPROC, unggah dokumen hasil evaluasi sebelum handover.':failed?'Menunggu perbaikan dokumen dari PPK.':handover?'Paket sudah diserahkan ke PPK. Progres Surat Pesanan mengikuti data INAPROC.':''):(pending?'Menunggu penayangan Mini Kompetisi.':tayang?'Mini Kompetisi sedang ditayangkan. Pantau perkembangan paket.':evalStage?'Menunggu dokumen hasil evaluasi dan penyampaian hasil pemilihan.':failed?'Periksa catatan kegagalan. PPK dapat memperbaiki dokumen persiapan dan mengirim kembali kepada Pokja.':handover?'Paket sudah diserahkan kepada PPK. Progres Surat Pesanan mengikuti data INAPROC.':'');
    const reminder=handover?`<p class="sel-mini-reminder"><b>Pengingat PPK:</b> Hasil pemilihan sudah disampaikan. Mohon segera buat Surat Pesanan di katalog.inaproc.id paling lambat 3 hari kerja sejak hari ini agar paket tidak terlambat diproses.</p>`:'';
    return `<section class="sel-card sel-mini-workflow" id="selMiniWorkflow"><header><div><small>MINI KOMPETISI</small><h4>${esc(title)}</h4><p>${esc(intro)}</p></div></header>${failed?'':`<div class="sel-mini-documents">${documents}</div>`}${tayang&&pokja?`<p class="sel-mini-field-help">Jika masih ada penawaran, perubahan di INAPROC terbatas pada RUP, jadwal, dan penyelesaian pekerjaan. Periksa ketentuan tambahan waktu penawaran sebelum menyimpan perubahan.</p>`:''}${decisions}${reminder}${actions?`<div class="sel-mini-buttons">${actions}</div>`:''}</section>`;
  }
  const miniDecisionState=new Map();
  const opdRecapOpen=new Map();
  function recapFilled(value){return value!==null&&value!==undefined&&String(value).trim()!==''&&String(value).trim()!=='—'}
  function recapMoney(value){return Number(value)>0?fullRp(value):''}
  function recapDate(value){const ymd=formYmd(value);if(!ymd)return '';const [year,month,day]=ymd.split('-');const names=['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'];return `${day} ${names[Number(month)-1]||month} ${year}`}
  function recapFields(entries){return entries.filter(([,value])=>recapFilled(value)).map(([label,value])=>`<div class="sel-opd-recap-field"><small>${esc(label)}</small><strong>${esc(value)}</strong></div>`).join('')}
  function recapGroup(title,entries){const fields=recapFields(entries);return fields?`<div class="sel-opd-recap-group"><h5>${esc(title)}</h5><div class="sel-opd-recap-grid">${fields}</div></div>`:''}
  function recapQualifications(value,construction){const q=parseJson(value,{}),parts=[];
    if(construction){if(q.kecil)parts.push('UMK - Kecil');if(q.menengah)parts.push('Non-UMK - Menengah');if(q.besar)parts.push('Non-UMK - Besar');}
    else{if(q.mikro)parts.push('UMK - Mikro');if(q.kecil)parts.push('UMK - Kecil');if(q.umk&&!q.mikro&&!q.kecil)parts.push('UMK');if(q.menengah)parts.push('Non-UMK - Menengah');if(q.besar)parts.push('Non-UMK - Besar');if(q.nonUmk&&!q.menengah&&!q.besar)parts.push('Non-UMK');}
    return parts.join(', ');
  }
  function recapProductFields(item,construction){
    if(construction){const total=Number(item.totalPrice)||((Number(item.hps)||0)*(Number(item.qty)||0));return [
      ['Kategori',item.categoryPath||item.category],['KBLI',item.kbli],['Daftar Produk Sektoral',item.sectoralProduct],['Nama Pekerjaan',item.name],
      ['Satuan Pengukuran',item.measurementUnit],['Kode Produk',item.productCode],['Lingkup Kegiatan',item.activityScope],
      ['Lokasi Layanan (Kecamatan)',item.serviceLocation],['Sertifikat Badan Usaha (SBU) Konstruksi',item.sbu],
      ['Masa Berlaku SBU',item.sbuValidity],['Sertifikat Standar',item.standardCertificate],['Komponen Struktur Biaya Tayang',item.costStructureComponent],
      ['Informasi Lainnya',item.otherInfo],['Spesifikasi Tambahan',item.extraSpecification],['Jumlah',Number(item.qty)>0?nf.format(Number(item.qty)):null],
      ['Satuan',item.unit],['HPS Pekerjaan',recapMoney(item.hps)],['Total HPS Pekerjaan',recapMoney(total)],...inaprocExtraSummary(item)
    ];}
    const d=detailedProductView(item),total=Number(d.totalPrice)||((Number(d.qty)||0)*(Number(d.hps)||0));return [
      ['Kategori',item.categoryPath||item.productCategory||item.category],['KBLI',item.kbli],['Nama Produk',item.name],['Uraian',item.desc],
      ['Kode KFA',d.kfa],['Spesifikasi Produk',d.specification],['Nomor Izin Edar (NIE)',d.nie],['Masa Berlaku NIE',d.nieValidity],
      ['Daftar Distributor yang Ditunjuk',d.distributor],['Izin Distribusi Alat Kesehatan',d.distributionPermit],
      ['Sertifikat Cara Pembuatan Alat Kesehatan yang Baik',d.goodManufacturing],['Sertifikat Cara Distribusi Alat Kesehatan yang Baik',d.goodDistribution],
      ['Sertifikat Alat Telekomunikasi',d.telecomCertificate],['Izin Pemanfaatan Sumber Radiasi Pengion (SRP)',d.radiationPermit],
      ['Hasil Pengujian Post Market',d.postMarket],['Pemberitahuan Import Barang (PIB)',d.pib],['BMHP',d.bmhp],
      ['Garansi',d.warranty],['Layanan Purna Jual dan Spare Part',d.afterSales],['Struktur Harga',d.priceStructure],
      ['Informasi Lainnya',d.otherInfo],['Label Produk Ramah Lingkungan Hidup',d.ecoLabel],['Spesifikasi Tambahan',d.extraSpecification],
      ['Jumlah',Number(d.qty)>0?nf.format(Number(d.qty)):null],['Satuan',d.unit],['HPS Produk',recapMoney(d.hps)],['Total HPS Produk',recapMoney(total)],...inaprocExtraSummary(item)
    ];
  }
  function recapItems(items,construction){if(!items.length)return '<p class="sel-opd-recap-empty">Belum ada rincian yang tersimpan.</p>';
    return `<div class="sel-opd-recap-items">${items.map((item,index)=>{
      const title=item.name||item.desc||item.categoryPath||`Item ${index+1}`;
      return `<details class="sel-opd-recap-item"><summary><span><b>${construction?'Pekerjaan':'Produk'} ${index+1}</b><em>${esc(title)}</em></span><span class="sel-opd-recap-arrow" aria-hidden="true">⌄</span></summary><div class="sel-opd-recap-grid">${recapFields(recapProductFields(item,construction))}</div></details>`;
    }).join('')}</div>`;
  }
  // Satu undangan per putaran Kaji Ulang. Undangan baru hanya setelah PPK
  // menyampaikan hasil perbaikan dan paket kembali ke Pokja.
  function canResendKajiInvitation(d){
    const old=currentDoc(d,'SURAT_UNDANGAN_KAJI_ULANG');
    if(!old)return true;
    const events=(d.audit||[]).filter(a=>['KIRIM_UNDANGAN_KAJI','RESUBMIT_KAJI_REVISION'].includes(String(a.action||'')));
    const lastInvite=events.map((a,i)=>a.action==='KIRIM_UNDANGAN_KAJI'?i:-1).reduce((a,b)=>Math.max(a,b),-1);
    const lastResubmit=events.map((a,i)=>a.action==='RESUBMIT_KAJI_REVISION'?i:-1).reduce((a,b)=>Math.max(a,b),-1);
    if(lastResubmit<0||lastResubmit<=lastInvite)return false;
    const resubmitted=events[lastResubmit];
    return new Date(resubmitted.created_at).getTime()>new Date(old.uploaded_at).getTime();
  }
  function kajiInvitationHtml(d){
    const r=d?.request;if(d.loading||!isKajiRequest(r))return '';
    const old=currentDoc(d,'SURAT_UNDANGAN_KAJI_ULANG');
    const active=['POKJA','ADMIN'].includes(state.me?.role)&&['DITUGASKAN_POKJA','REVIU_POKJA','REVIU_ULANG'].includes(r.status)&&!!r.assigned_pokja_id;
    const canSend=active&&canResendKajiInvitation(d);
    if(!active&&!old)return '';
    const link=old?`<article class="sel-mini-document sel-invite-sent"><div><b>Surat Undangan Kaji Ulang</b><small>${esc(old.file_name)}</small></div><div class="sel-mini-document-actions"><a href="${esc(old.drive_url)}" target="_blank" rel="noopener">Lihat surat ↗</a></div></article>`:'';
    const form=canSend?`<div class="sel-invite-form"><div class="sel-invite-grid"><label class="sel-field"><span>MULAI *</span><input type="datetime-local" id="selInviteStart" required></label><label class="sel-field"><span>SELESAI *</span><input type="datetime-local" id="selInviteEnd" required></label></div><div class="sel-invite-grid"><label class="sel-field"><span>MEKANISME *</span><select id="selInviteMethod"><option value="OFFLINE">Offline</option><option value="ONLINE">Online</option></select></label><label class="sel-field"><span id="selInvitePlaceLabel">TEMPAT *</span><input id="selInvitePlace" maxlength="1000" placeholder="Contoh: Ruang Rapat Bagian PBJ Setda Kota Bogor" required></label></div><label class="sel-field"><span>YANG HARUS DISEDIAKAN *</span><textarea id="selInviteProvided" maxlength="1000" rows="2" required placeholder="Contoh: KAK, HPS, Rancangan Kontrak">KAK, HPS, Rancangan Kontrak</textarea></label><label class="sel-field"><span>YANG HARUS HADIR *</span><input id="selInviteAttendees" maxlength="1000" value="PPK dan/atau Tim Teknis" required></label><label class="sel-field"><span>LAMPIRAN (OPSIONAL)</span><input id="selInviteAttachment" maxlength="1000" placeholder="Kosongkan jika tidak ada"></label><div class="sel-invite-actions"><small>Surat dibuat otomatis dan masuk ke email PPK setelah diproses pengirim.</small><button type="button" class="sel-primary" data-send-kaji-invite>Kirim Undangan</button></div></div>`:'';
    return `<details class="sel-card sel-fold sel-invite" ${canSend&&!old?'open':''}><summary><div><b>Undangan Kaji Ulang</b><span>${old?(canSend?'Perbaikan diterima · Undangan baru dapat dikirim':'Sudah dikirim'):active?'Undang PPK sebelum Kaji Ulang':''}</span></div><i aria-hidden="true">▾</i></summary><div class="sel-fold-body">${link}${old&&active&&!canSend?'<p class="sel-invite-locked">Undangan sudah dikirim. Undangan baru tersedia jika hasil Kaji Ulang dikembalikan ke PPK dan PPK telah mengirim perbaikannya ke Pokja.</p>':''}${form}</div></details>`;
  }
  function bindKajiInvitation(){
    const method=$('#selInviteMethod');method?.addEventListener('change',()=>{const online=method.value==='ONLINE',el=$('#selInvitePlaceLabel'),input=$('#selInvitePlace');if(el)el.textContent=online?'TAUTAN RAPAT *':'TEMPAT *';if(input)input.placeholder=online?'Contoh: https://meet.google.com/...':'Contoh: Ruang Rapat Bagian PBJ Setda Kota Bogor';});
    $('[data-send-kaji-invite]')?.addEventListener('click',async e=>{
      if(writing()||state.busy||!state.detail?.request)return;
      if(!canResendKajiInvitation(state.detail)){flash('Undangan untuk kaji ulang ini sudah dikirim.','error');return;}
      const payload={requestId:state.detail.request.request_id,start:$('#selInviteStart')?.value||'',end:$('#selInviteEnd')?.value||'',method:method?.value||'OFFLINE',place:$('#selInvitePlace')?.value.trim()||'',provided:$('#selInviteProvided')?.value.trim()||'',attendees:$('#selInviteAttendees')?.value.trim()||'',attachment:$('#selInviteAttachment')?.value.trim()||''};
      if(!payload.start||!payload.end||!payload.place||!payload.provided||!payload.attendees){flash('Lengkapi waktu, tempat, dokumen, dan peserta undangan.','error');return;}
      if(new Date(payload.end)<=new Date(payload.start)){flash('Jam selesai harus setelah jam mulai.','error');return;}
      if(!await confirmCritical({eyebrow:'UNDANGAN KAJI ULANG',title:'Kirim undangan kepada PPK?',message:'Surat Undangan Kaji Ulang akan disimpan di paket dan notifikasi dikirim ke email PPK.',yes:'Ya, kirim'}))return;
      const proc=criticalProcess({eyebrow:'UNDANGAN KAJI ULANG',title:'Membuat undangan',message:'Membuat surat dan menyiapkan email PPK…'}),id=payload.requestId;
      try{const r=await API().call('sendKajiInvitation',payload,{timeoutMs:60000});if(state.detail?.request?.request_id!==id){proc.close();return;}const doc=r.data?.document;if(doc){state.detail.docs=[...(state.detail.docs||[]).map(x=>x.doc_type===doc.doc_type?{...x,is_current:false}:x),doc];}if(r.data?.request)state.detail.request={...state.detail.request,...r.data.request};rememberDetail(state.detail);renderPreservingPosition();await proc.success(r.data?.email_queued?'Undangan disimpan. Email masuk antrean pengiriman.':'Surat tersimpan, tetapi antrean email belum berhasil. Hubungi admin.');if(!r.data?.email_queued)flash('Antrean email belum berhasil. Periksa DATA ORBITA.','error');silentSync(120);}catch(err){const message=apiErr(err);proc.fail(message);flash(message,'error');}
    });
  }
  function opdRecapHtml(d){if(d.loading||!d.request)return '';
    const r=d.request,mini=requestSelectionProcess(r)==='MINI_KOMPETISI',construction=mini&&r.competition_type==='CONSTRUCTION';
    const data=mini?parseJson(construction?r.construction_details_json:r.product_details_json,[]):[],items=Array.isArray(data)?data:[];
    const scheduleStart=recapDate(r.schedule_start_date),scheduleEnd=recapDate(r.schedule_end_date);
    const startTime=formClock(r.schedule_start_time),endTime=formClock(r.schedule_end_time);
    const period=[scheduleStart+(startTime?' · '+startTime+' WIB':''),scheduleEnd+(endTime?' · '+endTime+' WIB':'')].filter(recapFilled).join(' s.d. ');
    const details=mini?[
      recapGroup('Informasi Kompetisi',[['Jenis Kompetisi',construction?'Pekerjaan Konstruksi':'Barang/Jasa Lainnya'],['Judul Kompetisi',r.competition_title||r.nama_paket],['Jadwal Kompetisi',period],['Kualifikasi Penyedia',recapQualifications(r.qualification_json,construction)]]),
      recapGroup('Ketentuan Pekerjaan',construction?[['Lokasi Pekerjaan',r.work_location]]:[['Lokasi Pekerjaan',r.work_location],['Tanggal Penyelesaian',recapDate(r.completion_date)]]),
      `<div class="sel-opd-recap-group"><div class="sel-opd-recap-item-head"><h5>${construction?'Detail Pekerjaan Konstruksi':'Detail Produk'}</h5><span>${items.length} ${construction?'pekerjaan':'produk'}${items.length?' · Total HPS '+fullRp(construction?constructionHps(items):competitionHps(items)):''}</span></div>${recapItems(items,construction)}</div>`
    ].filter(Boolean).join(''):
      recapGroup(isKajiRequest(r)&&requestSelectionProcess(r)==='PERSIAPAN'?'Informasi Permohonan':'Informasi Negosiasi',[['Metode Pengadaan',r.metode_pengadaan||r.metode_epurchasing],['Kode RUP',r.kode_rup],['Nama PPK',r.ppk_nama],['Email PPK',r.ppk_email],['Total HPS yang Diajukan',r.hps_alokasi?fullRp(r.hps_alokasi):''],['Catatan PPK',r.notes]]);
    const key=String(r.request_id),open=opdRecapOpen.has(key)?opdRecapOpen.get(key):(stepIndex(r)<5&&['KEPALA_UKPBJ','POKJA','ADMIN'].includes(state.me?.role));
    return `<details class="sel-card sel-fold sel-opd-recap" data-opd-recap="${esc(key)}" ${open?'open':''}><summary><div><b>Rekap Permohonan OPD</b><span>${requestSelectionProcess(r)==='PERSIAPAN'?'Dokumen Persiapan':mini?(construction?'Mini Kompetisi · Konstruksi':'Mini Kompetisi · Barang/Jasa Lainnya'):'Negosiasi'}</span></div><i aria-hidden="true">▾</i></summary><div class="sel-fold-body">${details}</div></details>`;
  }
  const kajiDraftState=new Map();
  function kajiPanelHtml(d){
    const r=d.request;if(d.loading||!isKajiRequest(r))return '';
    const cur=stepIndex(r);
    const pokja=['POKJA','ADMIN'].includes(state.me?.role),active=pokja&&['DITUGASKAN_POKJA','REVIU_POKJA','REVIU_ULANG'].includes(r.status);
    const doc=currentDoc(d,'BA_KAJI_ULANG'),up=docUploadState(r.request_id,'BA_KAJI_ULANG'),draft=kajiDraftState.get(r.request_id)||{},needsKajiFile=!doc||(r.review_started_at&&new Date(doc.uploaded_at)<new Date(r.review_started_at));
    if(!active&&!r.kaji_ulang_date)return '';
    const note=(d.notes||[]).filter(n=>n.phase==='PERBAIKAN_PPK').slice(-1)[0];
    const fields=active?`<div class="sel-kaji-form">${note?`<div class="sel-ppk-note"><small>CATATAN PPK UNTUK POKJA</small><p>${esc(note.note)}</p></div>`:''}<label class="sel-field"><span>TANGGAL KAJI ULANG *</span><input type="date" id="selKajiDate" value="${esc(draft.date||r.kaji_ulang_date||jakartaDay())}"></label><div class="sel-review-choices"><button type="button" class="sel-review-choice ${draft.decision==='LANJUT'?'selected':''}" data-kaji-choice="LANJUT"><span class="sel-review-choice-mark">✓</span><span><b>Sesuai</b><small>Tetapkan proses pemilihan</small></span></button><button type="button" class="sel-review-choice ${draft.decision==='PERBAIKAN'?'selected':''}" data-kaji-choice="PERBAIKAN"><span class="sel-review-choice-mark">!</span><span><b>Tidak Sesuai</b><small>Kembalikan ke PPK</small></span></button></div><div data-kaji-method ${draft.decision==='LANJUT'?'':'hidden'}><label class="sel-field"><span>PROSES PEMILIHAN *</span><select id="selKajiMethod"><option value="">Pilih proses pemilihan</option>${option('NEGOSIASI','Negosiasi',draft.method||'')}${option('MINI_KOMPETISI_NON_CONSTRUCTION','Mini Kompetisi (Barang/Jasa Lainnya)',draft.method||'')}${option('MINI_KOMPETISI_CONSTRUCTION','Mini Kompetisi (Pekerjaan Konstruksi)',draft.method||'')}</select></label></div><label class="sel-field"><span>CATATAN ${draft.decision==='PERBAIKAN'?'*':''}</span><textarea id="selKajiNote" rows="3" maxlength="2000" placeholder="Catatan hasil Kaji Ulang">${esc(draft.note||'')}</textarea></label>`:'';
    const row=`<article class="sel-mini-document"><div><b>BA Hasil Reviu Kaji Ulang ${active?'*':''}</b><small>${esc(doc?.file_name||'Belum diunggah')}</small></div><div class="sel-mini-document-actions">${doc?`<a href="${esc(doc.drive_url)}" target="_blank" rel="noopener">Lihat dokumen ↗</a>`:''}${active?`<label class="sel-upload ${up?.active?'uploading':''}${up?.failed?' upload-failed':''}" ${up?.active?`style="--upload-progress:${Math.max(1,Math.min(100,Math.round(Number(up.progress)||1)))}%"`:''}>${esc(up?.active?up.text||'Mengunggah…':up?.failed?'Upload ulang':!doc?'Unggah':needsKajiFile?'Unggah revisi':'Ganti file')}<input type="file" data-kaji-doc accept=".pdf,.doc,.docx" ${up?.active?'disabled':''}></label>`:''}</div></article>`;
    const panel=`<section class="sel-kaji-panel" id="selKajiPanel"><header><div>${active?'<small>KAJI ULANG</small>':''}<h4>${active?'Hasil Kaji Ulang Dokumen Persiapan':'Hasil Kaji Ulang'}</h4>${!active?`<p>${esc(r.kaji_ulang_result==='LANJUT'?'Lanjut ke '+requestProcessLabel(r):r.kaji_ulang_result==='PERBAIKAN'?'Dikembalikan ke PPK':'')} · ${esc(dateOnly(r.kaji_ulang_date))}</p>`:''}</div></header>${fields}<div class="sel-mini-documents">${row}</div>${active?`<div class="sel-kaji-bottom"><div class="sel-kaji-mini-path" data-kaji-mini-path ${draft.decision==='LANJUT'&&(draft.method||'').startsWith('MINI_KOMPETISI')?'':'hidden'}><span>SELANJUTNYA</span><label><input type="radio" name="selKajiMiniPath" value="PPK" ${(draft.miniPath||'PPK')==='PPK'?'checked':''}><b>Minta PPK Lengkapi Detail</b><small>PPK mengisi kategori, rincian produk/pekerjaan, dan lokasi.</small></label><label><input type="radio" name="selKajiMiniPath" value="LANGSUNG" ${draft.miniPath==='LANGSUNG'?'checked':''}><b>Langsung ke Penayangan</b><small>Lewati pengisian detail PPK. Pokja melanjutkan proses di INAPROC.</small></label></div><div class="sel-mini-buttons"><button type="button" class="sel-primary" data-save-kaji>Simpan Hasil Kaji Ulang</button></div></div>`:''}</section>`;
    return foldCard('Kaji Ulang',active?'Periksa lalu simpan hasil':'Hasil terakhir',panel,{className:'sel-kaji-wrap',open:active||cur<=3||r.status==='PERLU_PERBAIKAN_PPK'});
  }
  function postKajiDetailHtml(d){
    const r=d.request;if(!isKajiRequest(r)||r.status!=='PERLU_DETAIL_PPK')return '';
    const ppk=state.me?.role==='PPK'||state.me?.role==='ADMIN',mini=requestSelectionProcess(r)==='MINI_KOMPETISI';
    return `<section class="sel-card sel-kaji-post"><header><div><small>DETAIL PEMILIHAN</small><h4>${esc(requestProcessLabel(r))}</h4><p>Metode ditetapkan oleh Pokja berdasarkan BA Kaji Ulang. ${ppk?'Lengkapi detail untuk melanjutkan.':'Menunggu detail dari PPK.'}</p></div></header>${ppk?mini?`<button type="button" class="sel-primary" data-kaji-open-form>Lengkapi Mini Kompetisi</button>`:`<label class="sel-field"><span>CATATAN PPK</span><textarea id="selKajiNegotiationNote" rows="3" maxlength="2000" placeholder="Catatan jika diperlukan">${esc(r.notes||'')}</textarea></label><button type="button" class="sel-primary" data-kaji-open-nego>Kirim Detail Negosiasi</button>`:''}</section>`;
  }
  // Detail paket: tampilkan pekerjaan yang sedang berlangsung lebih dahulu.
  // Undangan dan Kaji Ulang tetap tersedia, tetapi menjadi riwayat proses saat Handover.
  function detailHeroHtml(d){
    const r=d.request;
    const pokja=(d.pokja||[]).find(x=>x.pokja_id===r.assigned_pokja_id)?.nama||'Belum ditetapkan';
    const inaproc=r.inaproc_progress?.count
      ?`${r.inaproc_progress.completed} / ${r.inaproc_progress.count} transaksi selesai`
      :r.inaproc_code||'Belum ada transaksi';
    const inaprocEmpty=/belum ada transaksi/i.test(String(inaproc||''));
    const rupDetails=[r.opd,r.jenis,r.waktu_pemilihan].filter(Boolean).join(' · ');
    return `<section class="sel-detail-hero">
      <div class="sel-detail-overview">
        <small>${esc(r.metode_epurchasing||r.metode_pengadaan||'PEMILIHAN')}</small>
        <h4>${esc(requestTitle(r))}</h4>
        <p class="sel-package-identity">${esc(rupDetails)}</p>
        ${r.ppk_email?`<p class="sel-package-contact">${esc(r.ppk_email)}</p>`:''}
        <div class="sel-package-path">${[r.program,r.kegiatan,r.sub_kegiatan].filter(Boolean).map(x=>`<span>${esc(x)}</span>`).join('')}</div>
      </div>
      <div class="sel-detail-meta" aria-label="Informasi utama paket">
        <div class="sel-meta-money"><span>PAGU RUP</span><b>${fmtRp(r.pagu)}</b></div>
        <div class="sel-meta-money"><span>HPS DIAJUKAN</span><b>${fmtRp(r.hps_alokasi)}</b></div>
        <div class="sel-meta-person"><span>PPK</span><b>${esc(r.ppk_nama||'—')}</b></div>
        <div class="sel-meta-person"><span>POKJA</span><b>${esc(pokja)}</b></div>
        <div class="sel-meta-inaproc ${inaprocEmpty?'empty':''}"><span>INAPROC</span><b>${esc(inaproc)}</b></div>
      </div>
    </section>`;
  }
  function detailHtml(d){
    const r=d.request;
    const handoverStage=stepIndex(r)>=5;
    const invitation=kajiInvitationHtml(d);
    const kaji=isKajiRequest(r)?kajiPanelHtml(d)+postKajiDetailHtml(d):canReview(r)&&!d.loading?reviewPanelHtml(d):'';
    const workflow=miniHtml(d)+negoHtml(d);
    const progress=inaprocHtml(d);
    // Pada Handover / Selesai, INAPROC langsung di bawah progres tahapan.
    // Tahap lainnya tetap memakai urutan lama agar tidak mengubah alur kerja.
    const activeSection=handoverStage
      ?progress+workflow+invitation+kaji
      :invitation+kaji+(r.status==='PERLU_PERBAIKAN_PPK'?roleActions(d)+docsHtml(d):'')
        +(['DRAFT','PERLU_KELENGKAPAN','MENUNGGU_DISPOSISI','DIAJUKAN','DITUGASKAN_POKJA'].includes(r.status)?roleActions(d):'')
        +(['SIAP_PROSES_INAPROC','PROSES_INAPROC','SELESAI'].includes(r.status)?workflow+progress:'');
    return `<div class="sel-head"><div><small>DETAIL PERMOHONAN</small><h3>${esc(r.request_id)}</h3><p>RUP ${esc(r.kode_rup)} · Reviu ${esc(r.current_round)}</p></div><div class="sel-head-actions"><span class="sel-detail-process ${requestSelectionProcess(r)==='NEGOSIASI'?'negotiation':requestSelectionProcess(r)==='PERSIAPAN'?'preparation':'competition'}">${esc(requestProcessLabel(r))}</span><button class="sel-ghost" type="button" data-back-requests>← Daftar Permohonan</button>${requestBadge(r)}</div></div><div class="sel-detail">
      ${detailHeroHtml(d)}
      ${r.previous_request_id?`<p class="sel-reapply-reference">Paket ini diajukan ulang dari ${esc(r.previous_request_id)}</p>`:''}
      ${stepper(r)}${stagePanel(d)}${activeSection}
      ${opdRecapHtml(d)}
      ${r.status==='DITOLAK_KEPALA'?`<section class="sel-card sel-rejected-card"><b>Permohonan ditolak</b><p>${esc(r.rejected_reason||'Lihat catatan proses untuk keterangan penolakan.')}</p></section>${roleActions(d)}`:''}
      ${assignmentOrderHtml(d)}
      ${r.status==='PERLU_PERBAIKAN_PPK'?'':docsHtml(d)}
      ${['DRAFT','PERLU_KELENGKAPAN','MENUNGGU_DISPOSISI','DIAJUKAN','DITUGASKAN_POKJA','PERLU_PERBAIKAN_PPK','PERLU_DETAIL_PPK','DITOLAK_KEPALA'].includes(r.status)?'':roleActions(d)}
      ${auditHtml(d)}
    </div>`;
  }

  function skpStatus(r){
    if(r.status==='SELESAI')return 'Selesai';
    if(r.selection_process==='MINI_KOMPETISI'){
      if(r.status==='BATAL'||r.mini_stage==='BATAL')return 'Kompetisi batal';
      if(r.mini_stage==='GAGAL')return 'Kompetisi gagal';
      if(r.mini_stage==='TAYANG')return 'Sedang ditayangkan';
      if(r.mini_stage==='EVALUASI')return 'Evaluasi pemenang';
      if(r.mini_stage==='HANDOVER'&&!r.reached)return 'Handover PPK';
      if(r.mini_stage==='SIAP_TAYANG')return 'Menunggu penayangan';
    }
    if(r.selection_process==='NEGOSIASI'&&r.nego_stage==='HANDOVER'&&!r.reached)return 'Handover PPK';
    if(r.source_state==='unavailable')return 'Data belum tersedia';
    return r.reached?'INAPROC Berjalan':r.stage===3?'Menunggu INAPROC':r.stage===2?'Reviu Berjalan':'Ditugaskan';
  }
  function skpStatusTone(r){if(r.status==='SELESAI')return'done';if(r.reached)return'inaproc';if(r.source_state==='unavailable')return'neutral';return'waiting'}
  function skpHtml(){
    const p=state.skp,from=state.skpPeriod.from,to=state.skpPeriod.to;
    return `<div class="sel-head"><div><small>POKJA</small><h3>Dokumen Laporan</h3><p>${esc(p?.pokja||state.me?.nama||'')}</p></div><button type="button" class="sel-primary" data-skp-pdf ${!p||state.skpExport?'disabled':''}>${state.skpExport?'Menyiapkan PDF…':'Unduh PDF'}</button></div><form class="sel-skp-filter" id="skpFilter"><label>Dari tanggal<input id="skpFrom" type="date" ${state.skpExport?'disabled':''} required value="${esc(from)}"></label><label>Sampai tanggal<input id="skpTo" type="date" ${state.skpExport?'disabled':''} required value="${esc(to)}"></label><button class="sel-ghost" type="submit" ${state.skpExport?'disabled':''}>Tampilkan</button></form>${state.skpError?`<p class="sel-skp-error" role="alert">${esc(state.skpError)}</p>`:''}${!p?'<div class="sel-empty"><b>Memuat penugasan…</b></div>':`<div class="sel-skp-kpis"><article><span>Penugasan</span><b>${p.counts.assigned}</b></article><article><span>Selesai reviu</span><b>${p.counts.reviewed}</b></article><article><span>Masuk INAPROC</span><b>${p.counts.started}</b></article></div><div class="sel-skp-list">${p.items.map(r=>`<article class="sel-card sel-skp-item"><div class="sel-skp-item-head"><div><small>RUP ${esc(r.kode_rup)} · ${esc(r.opd)}</small><h4>${esc(requestTitle(r))}</h4></div><span class="sel-skp-status ${skpStatusTone(r)}"><i aria-hidden="true"></i>${esc(skpStatus(r))}</span></div><div class="sel-skp-stages">${[['Penugasan',r.assigned_at],['Mulai reviu',r.review_started_at],['Selesai reviu',r.review_completed_at],['INAPROC',r.reached?'Sedang diproses':'']].map(([label,date],i)=>`<div class="${i<r.stage?'done':''}"><b>${esc(label)}</b><span>${i===3?(date||'Menunggu'):(date?dateOnly(date):'—')}</span></div>`).join('')}</div><div class="sel-skp-item-foot"><span>${r.order_date?'Pesanan '+esc(dateOnly(r.order_date)):''}</span><button type="button" class="sel-ghost" data-request-id="${esc(r.request_id)}">Lihat paket</button></div></article>`).join('')||'<div class="sel-empty"><b>Belum ada penugasan pada periode ini.</b></div>'}</div>`}`;
  }
  let skpFetchVersion=0,skpLoading=false;
  async function loadSkp(background=false){
    if(state.me?.role!=='POKJA'||state.view!=='skp'||state.skpExport||(background&&skpLoading))return;
    const seq=++skpFetchVersion,nav=navigationVersion,userId=state.me.user_id,period={...state.skpPeriod};skpLoading=true;
    try{const res=await API().call('pokjaSkpReport',period);if(seq!==skpFetchVersion||nav!==navigationVersion||userId!==state.me?.user_id||state.view!=='skp')return;
      if(background&&!canBackgroundRender())return;
      const previous=JSON.stringify([state.skp?.items,state.skp?.counts,state.skp?.pokja,state.skpError]);state.skp=res.data;state.skpError='';
      if(!background||previous!==JSON.stringify([state.skp?.items,state.skp?.counts,state.skp?.pokja,state.skpError]))renderPreservingPosition();
    }catch(e){if(seq!==skpFetchVersion||nav!==navigationVersion||userId!==state.me?.user_id)return;state.skpError=apiErr(e);if(!background||canBackgroundRender())renderPreservingPosition();}finally{if(seq===skpFetchVersion)skpLoading=false;}
  }
  async function downloadSkp(){
    if(state.me?.role!=='POKJA'||state.skpExport||!state.skp)return;
    if(($('#skpFrom')&&$('#skpFrom').value!==state.skpPeriod.from)||($('#skpTo')&&$('#skpTo').value!==state.skpPeriod.to)){flash('Klik Tampilkan untuk memakai periode yang dipilih.','error');return;}
    const nav=navigationVersion,userId=state.me.user_id,period={...state.skpPeriod};state.skpExport=true;$$('#skpFilter input,#skpFilter button').forEach(el=>el.disabled=true);const btn=$('[data-skp-pdf]');if(btn){btn.disabled=true;btn.textContent='Menyiapkan PDF…';}
    try{const r=await API().call('exportPokjaSkpPdf',period,{timeoutMs:60000});if(nav!==navigationVersion||userId!==state.me?.user_id||state.view!=='skp')return;
      const data=r.data;if(data?.mimeType!=='application/pdf'||!data.base64)throw Error('PDF belum berhasil dibuat. Coba lagi.');
      const bytes=Uint8Array.from(atob(data.base64),c=>c.charCodeAt(0));const url=URL.createObjectURL(new Blob([bytes],{type:'application/pdf'}));const a=document.createElement('a');a.href=url;a.download=data.fileName||'Dokumen-Laporan-Pokja.pdf';document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);
    }catch(e){if(nav===navigationVersion&&userId===state.me?.user_id)flash(apiErr(e),'error');}finally{if(userId===state.me?.user_id){state.skpExport=false;$$('#skpFilter input,#skpFilter button').forEach(el=>el.disabled=false);const current=state.view==='skp'?$('[data-skp-pdf]'):null;if(current){current.disabled=false;current.textContent='Unduh PDF';}}}
  }
  function bindSkp(){
    $('#skpFilter')?.addEventListener('submit',e=>{e.preventDefault();if(state.skpExport)return;const from=$('#skpFrom')?.value,to=$('#skpTo')?.value;if(!from||!to||from>to){flash('Periksa tanggal periode penugasan.','error');return;}state.skpPeriod={from,to};state.skp=null;state.skpError='';renderPreservingPosition();loadSkp();});
    $('[data-skp-pdf]')?.addEventListener('click',downloadSkp);
  }

  function adminHtml(){const a=state.admin||{users:[],pokja:[],docConfig:[],audit:[]},activeDocs=(a.docConfig||[]).filter(d=>String(d.active).toLowerCase()!=='false');return `<div class="sel-head"><div><small>ADMIN</small><h3>Akun, Pokja & Dokumen</h3><p>Kelola akun, Pokja, dan dokumen.</p></div><div class="sel-head-actions"><button class="sel-ghost" data-admin-reload>Perbarui</button></div></div><div class="sel-admin-grid"><section class="sel-card"><header><b>Akun Pengguna</b><span>${a.users?.length||0} akun</span></header><div class="sel-admin-user-filter"><input id="selAdminUserSearch" type="search" placeholder="Cari nama, username, OPD" aria-label="Cari akun pengguna"><select id="selAdminUserRole" aria-label="Filter role"><option value="">Semua role</option>${Object.entries(roleLabel).map(([id,label])=>`<option value="${id}">${esc(label)}</option>`).join('')}</select></div><div class="sel-admin-list" id="selAdminUserList">${(a.users||[]).map(u=>`<article class="sel-admin-item" data-user-role="${esc(u.role)}" data-user-query="${esc([u.nama,u.username,u.opd,u.email].join(' ').toLowerCase())}"><div><b>${esc(u.nama)}</b><span>${esc(u.username)} · ${esc(roleLabel[u.role]||u.role)} ${u.opd?`· ${esc(u.opd)}`:''}${u.email?` · ${esc(u.email)}`:''}</span></div><div class="sel-admin-item-actions"><button class="sel-mini" data-edit-user="${esc(u.user_id)}">Ubah</button><button class="sel-mini" data-reset-user="${esc(u.user_id)}">Password</button>${u.user_id===state.me?.user_id?'':`<button class="sel-mini sel-mini-danger" data-delete-user="${esc(u.user_id)}" title="Hapus akses pengguna">Hapus</button>`}</div></article>`).join('')}</div><button class="sel-primary" style="margin-top:10px" data-new-user>+ Buat Akun</button></section><section class="sel-card"><header><b>Pokja Pemilihan</b><span>${a.pokja?.length||0} tim</span></header><div class="sel-admin-list">${(a.pokja||[]).map(p=>`<article class="sel-admin-item"><div><b>${esc(p.nama)}</b><span>${p.activeCount||0}/${p.capacity_max||8} aktif · sisa ${p.remaining||0}</span></div><div class="sel-admin-item-actions"><button class="sel-mini" data-edit-pokja="${esc(p.pokja_id)}">Ubah</button></div></article>`).join('')}</div><button class="sel-primary" style="margin-top:10px" data-new-pokja>+ Buat Pokja</button></section></div><section class="sel-card sel-admin-rup" style="margin-top:10px"><header><div><b>Perbarui Kode RUP Permohonan</b><span>Untuk permohonan berjalan yang berganti Kode RUP di SiRUP</span></div></header><div class="sel-admin-rup-fields"><label>Cari Permohonan<input id="selAdminRupSearch" placeholder="Nomor permohonan, judul, atau kode RUP" autocomplete="off"></label><button class="sel-ghost" type="button" id="selAdminRupFind">Cari</button></div><div id="selAdminRupResults" class="sel-admin-rup-results"><small>Masukkan nomor atau judul permohonan yang akan diperbarui.</small></div></section><section class="sel-card sel-broadcast-card" style="margin-top:10px"><header><div><b>Broadcast Notifikasi</b><span>Kirim pemberitahuan ke role yang dipilih</span></div></header><form id="selBroadcastForm" class="sel-broadcast-form"><label>Judul<input id="selBroadcastTitle" name="title" maxlength="120" required placeholder="Judul pemberitahuan"></label><label>Isi pemberitahuan<textarea id="selBroadcastMessage" name="message" rows="3" maxlength="1400" required placeholder="Tulis pesan yang akan diterima pengguna"></textarea></label><label>Lampiran (opsional)<input type="file" id="selBroadcastFile" multiple accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.jpg,.jpeg,.png,.zip"><small>PDF, Office, gambar, atau ZIP · maksimal 5 file, masing-masing 10 MB. Penerima bisa membuka lampiran dari notifikasi. Tautan Drive bisa diteruskan ke orang lain.</small></label><fieldset><legend>Penerima</legend><div class="sel-broadcast-roles">${['ADMIN','PPK','KEPALA_UKPBJ','POKJA','PIMPINAN','PENGAWAS'].map(r=>`<label><input type="checkbox" name="broadcast-role" value="${r}"><span>${esc(roleLabel[r]||r)}</span></label>`).join('')}</div></fieldset><label>ID permohonan (opsional)<input id="selBroadcastRequest" name="requestId" maxlength="120" placeholder="Kosongkan untuk pengumuman umum"><small>Jika diisi, notifikasi akan membuka detail permohonan tersebut.</small></label><div class="sel-broadcast-footer"><small id="selBroadcastResult" role="status">Pilih minimal satu role penerima.</small><button class="sel-primary" id="selBroadcastSend" type="submit">Kirim Broadcast</button></div></form></section><section class="sel-card" style="margin-top:10px"><header><div><b>Dokumen Persiapan</b><span>${activeDocs.length} dokumen aktif</span></div><button class="sel-primary" type="button" data-new-doccfg>+ Tambah Dokumen</button></header><div class="sel-admin-list">${(a.docConfig||[]).map(d=>{const active=String(d.active).toLowerCase()!=='false';return `<article class="sel-admin-item ${active?'':'is-inactive'}"><div><b>${esc(d.label)}</b><span>${esc(d.doc_type)} · ${String(d.required).toLowerCase()!=='false'?'Wajib':'Opsional'} · ${active?'Aktif':'Nonaktif'}</span></div><div class="sel-admin-item-actions"><button class="sel-mini" data-edit-doccfg="${esc(d.doc_type)}">Ubah</button>${active?`<button class="sel-mini sel-mini-danger" data-delete-doccfg="${esc(d.doc_type)}">Hapus</button>`:`<button class="sel-mini" data-enable-doccfg="${esc(d.doc_type)}">Aktifkan</button>`}</div></article>`}).join('')||'<div class="sel-empty"><b>Belum ada dokumen persiapan</b></div>'}</div></section><section class="sel-card sel-admin-audit" style="margin-top:10px"><header><div><b>Audit Log Terbaru</b><span>${a.audit?.length||0} aktivitas terakhir</span></div><button type="button" class="sel-history-toggle" data-admin-audit-toggle aria-expanded="false">Tampilkan</button></header><div class="sel-timeline" data-admin-audit-content hidden>${(a.audit||[]).slice(0,30).map(x=>`<article><small>${dt(x.created_at)} WIB</small><div><b>${esc(auditLabel(x.action))}</b><p>${esc(roleLabel[x.role]||x.role||'')} ${x.request_id?'· '+esc(x.request_id):''}</p></div></article>`).join('')||'<div class="sel-empty"><b>Belum ada aktivitas</b></div>'}</div></section>`}

  function render(){
    const h=host();if(!h)return;backgroundRenderPending=false;
    if(!state.me){h.innerHTML=loginHtml();bindLogin();return}
    let content=state.view==='create-process'?createProcessHtml():state.view==='create-kind'?createKindHtml():state.view==='create-form'?createFormHtml():state.view==='skp'&&state.me.role==='POKJA'?skpHtml():state.view==='requests'?requestsHtml():state.view==='detail'&&state.detail?detailHtml(state.detail):state.view==='admin'&&state.me.role==='ADMIN'?adminHtml():dashboardHtml();
    h.innerHTML=appShell(layout(content));bindApp();if(state.view==='create-process')bindCreateProcess();if(state.view==='create-kind')bindCreateKind();if(state.view==='create-form')bindCreateForm();
  }

  function bindLogin(){$('[data-open-portal]')?.addEventListener('click',()=>window.TRAXPBJ_SESSION?.open())}
  async function openDashboardFilter(status){const nav=++navigationVersion,userId=state.me?.user_id;state.filterStatus=status;state.search='';state.view='requests';state.create=null;createRoute('permohonan');try{const rev=writeVersion(),r=await API().call('listRequests',{status,search:''});if(nav===navigationVersion&&userId===state.me?.user_id&&rev===writeVersion()){state.requests=r.data||[];state.requestsLoading=false;render();}}catch(e){if(nav===navigationVersion)flash(apiErr(e),'error')}}
  function bindApp(){
    $('[data-sel-side-toggle]')?.addEventListener('click',()=>{state.sidebarCollapsed=!state.sidebarCollapsed;try{localStorage.setItem('orbit_pbj_selection_side_collapsed',state.sidebarCollapsed?'1':'0')}catch(_){}renderPreservingPosition()});
    $$('[data-dashboard-filter]').forEach(b=>b.addEventListener('click',()=>openDashboardFilter(b.dataset.dashboardFilter)));
    $('#selLogout')?.addEventListener('click',async()=>{navigationVersion++;stopPolling();busy(true,'Keluar…');await API().logout();clearBootCache();state.me=null;state.dashboard=null;state.requests=[];state.detail=null;state.admin=null;state.create=null;busy(false);render()});
    $$('[data-sel-view]').forEach(b=>b.addEventListener('click',async()=>{navigationVersion++;state.create=null;state.detail=null;state.view=b.dataset.selView;if(state.view==='requests')createRoute('permohonan');else if(state.view==='skp')createRoute('laporan');else if(state.view==='admin')createRoute('admin');else createRoute('',true);if(state.view==='skp'){render();await loadSkp();return;}if(state.view==='admin'&&!state.admin)await loadAdmin();render()}));
    $$('[data-sel-refresh]').forEach(b=>b.addEventListener('click',()=>sync(true).then(render).catch(e=>flash(apiErr(e),'error'))));
    $$('[data-sel-create]').forEach(b=>b.addEventListener('click',()=>openCreate()));
    $('[data-sel-apply]')?.addEventListener('click',applyFilter);$('#selSearch')?.addEventListener('keydown',e=>{if(e.key==='Enter')applyFilter()});$('#selStatus')?.addEventListener('change',applyFilter);
    $$('[data-request-id]').forEach(el=>{const id=el.dataset.requestId;const summary=requestSummary(id);el.addEventListener('click',()=>{if(state.me?.role==='PPK'&&['DRAFT','PERLU_KELENGKAPAN'].includes(summary?.status)&&requestSelectionProcess(summary)==='MINI_KOMPETISI')openDraftEditor(id);else openDetail(id)});el.addEventListener('mouseenter',()=>prefetchDetail(id));el.addEventListener('focus',()=>prefetchDetail(id))});
    $$('[data-delete-draft-request]').forEach(btn=>btn.addEventListener('click',async e=>{
      e.preventDefault();e.stopPropagation();
      const id=String(btn.dataset.deleteDraftRequest||''),summary=requestSummary(id);
      if(!id||!summary||!['DRAFT','PERLU_KELENGKAPAN'].includes(String(summary.status||'')))return;
      if(!await confirmCritical({eyebrow:'HAPUS DRAFT',title:'Hapus draft permohonan?',message:'Draft dan dokumen yang sudah diunggah pada draft ini akan dihapus. Tindakan ini tidak dapat dibatalkan.',yes:'Ya, hapus draft',no:'Batal',danger:true}))return;
      const proc=criticalProcess({eyebrow:'HAPUS DRAFT',title:'Menghapus draft',message:'Menghapus data permohonan…'});
      try{
        await API().call('deleteDraftRequest',{requestId:id},{timeoutMs:30000});
        state.requests=state.requests.filter(x=>String(x.request_id)!==id);
        const key=detailKey(id);detailCache.delete(key);detailCacheAt.delete(key);detailPrefetchLoads.delete(key);
        try{sessionStorage.removeItem(detailStorageKey(id))}catch(_){}
        render();
        await proc.success('Draft permohonan berhasil dihapus.');
        silentSync(120);
      }catch(err){const message=apiErr(err);proc.fail(message);flash(message,'error')}
    }));
    $$('[data-request-step]').forEach(el=>{el.addEventListener('click',()=>openDetail(el.dataset.stepRequest,Number(el.dataset.requestStep)));el.addEventListener('mouseenter',()=>prefetchDetail(el.dataset.stepRequest))});
    $('[data-back-requests]')?.addEventListener('click',()=>{navigationVersion++;state.view='requests';state.detail=null;state.create=null;createRoute('permohonan');render()});
    bindPipeline();
    $('[data-toggle-history]')?.addEventListener('click',()=>{const c=$('#selHistory');if(!c)return;const closed=c.classList.toggle('collapsed');const btn=$('[data-toggle-history]',c);if(btn){btn.textContent=closed?'Tampilkan':'Sembunyikan';btn.setAttribute('aria-expanded',String(!closed))}});
    $$('[data-toggle-audit-group]').forEach(btn=>btn.addEventListener('click',()=>{const box=$(`[data-audit-group="${CSS.escape(btn.dataset.toggleAuditGroup)}"]`);if(!box)return;const open=box.classList.toggle('open');btn.textContent=open?'Tutup Riwayat Upload':'Lihat Riwayat Upload';btn.setAttribute('aria-expanded',String(open))}));
    $$('[data-toggle-audit-note]').forEach(btn=>btn.addEventListener('click',()=>{const key=btn.dataset.toggleAuditNote,box=$(`[data-audit-note="${CSS.escape(key)}"]`);if(!box)return;const open=box.classList.toggle('open');btn.textContent=open?'Tutup Catatan':'Lihat Catatan';btn.setAttribute('aria-expanded',String(open))}));
    $('[data-toggle-history-notes]')?.addEventListener('click',e=>{const box=$('[data-history-notes]');if(!box)return;const open=box.classList.toggle('open');e.currentTarget.setAttribute('aria-expanded',String(open));e.currentTarget.textContent=open?'Tutup Catatan':'Lihat Catatan ('+box.children.length+')';});
    $$('[data-toggle-request-history]').forEach(btn=>btn.addEventListener('click',()=>{const box=$(`[data-request-history="${CSS.escape(btn.dataset.toggleRequestHistory)}"]`);if(!box)return;const closed=box.classList.toggle('collapsed');btn.textContent=closed?`Lihat pengajuan sebelumnya (${box.children.length})`:'Sembunyikan pengajuan sebelumnya';btn.setAttribute('aria-expanded',String(!closed))}));
    $('[data-toggle-previous-history]')?.addEventListener('click',e=>{const box=$('[data-previous-history]');if(!box)return;const closed=box.classList.toggle('collapsed');e.currentTarget.textContent=closed?`Lihat pengajuan sebelumnya (${box.children.length})`:'Sembunyikan pengajuan sebelumnya';e.currentTarget.setAttribute('aria-expanded',String(!closed))});
    $('[data-toggle-current-history]')?.addEventListener('click',e=>{const box=$('[data-current-history]');if(!box)return;const closed=box.classList.toggle('collapsed');e.currentTarget.textContent=closed?'Tampilkan':'Sembunyikan';e.currentTarget.setAttribute('aria-expanded',String(!closed))});
    bindDetailActions();bindAdmin();bindSkp();
  }

  async function sync(force=false){if(!API()?.hasSession()||state.syncing)return;state.syncing=true;const nav=navigationVersion,filter=state.filterStatus,search=state.search,rev=writeVersion(),fetchVersion=detailFetchVersion,userId=state.me?.user_id;try{const r=await API().call('bootstrap',{status:state.filterStatus,search:state.search,...(state.view==='detail'&&state.detail?.request?{detailRequestId:state.detail.request.request_id,detailUpdatedAt:state.detail.request.updated_at||'',detailInaprocVersion:state.detail.request.inaproc_version||''}:{})},{timeoutMs:30000});if(nav!==navigationVersion||filter!==state.filterStatus||search!==state.search||rev!==writeVersion()||fetchVersion!==detailFetchVersion||writing()||(userId&&userId!==state.me?.user_id))return;const b=r.data||{};state.me=b.user||state.me;state.dashboard=b.dashboard||state.dashboard;state.requests=b.requests||[];state.requestsLoading=false;state.lastSync=Date.now();state.syncVersion=String(b.syncVersion||state.syncVersion||'');saveBootCache(b);if(b.detail){pendingDetail=withPokja(b.detail);pendingDetailVersion=rev;rememberDetail(pendingDetail)}scheduleDetailPrefetch();if(state.me?.role==='ADMIN'&&state.view==='admin'&&(force||!state.admin))await loadAdmin()}finally{state.syncing=false}}
  async function applyFilter(){const nav=navigationVersion,userId=state.me?.user_id;state.search=$('#selSearch')?.value||'';state.filterStatus=$('#selStatus')?.value||'';busy(true,'Memuat permohonan…');try{const r=await API().call('listRequests',{status:state.filterStatus,search:state.search});if(nav!==navigationVersion||userId!==state.me?.user_id)return;state.requests=r.data||[];state.requestsLoading=false;render()}catch(e){flash(apiErr(e),'error')}finally{busy(false)}}
  async function openDetail(id,step=null,{push=true}={}){
    const nav=++navigationVersion,rev=writeVersion();inspectedStep=step;assignmentOpen=false;pendingDetail=null;
    const summary=state.requests.find(x=>x.request_id===id),cached=cachedDetail(id);
    state.view='detail';state.create=null;if(push)createRoute('permohonan/detail/'+encodeURIComponent(id));state.detail=cached?withPokja(cached):{request:summary||{request_id:id},docs:[],reviews:[],notes:[],audit:[],docConfig:[],pokja:state.dashboard?.pokja||[],loading:true};render();
    try{const key=detailKey(id),next=detailPrefetchLoads.has(key)?await detailPrefetchLoads.get(key):await prefetchDetail(id);if(!next)throw new Error('Detail paket belum dapat dimuat.');if(nav!==navigationVersion||rev!==writeVersion()||writing())return;rememberDetail(next);
      if($('#selModal')?.classList.contains('open')||userIsInteracting()){pendingDetail=next;pendingDetailVersion=rev;silentSync();return;}state.detail=withPokja(next);renderPreservingPosition();}
    catch(e){if(nav!==navigationVersion||rev!==writeVersion())return;if(!cached){state.view='requests';state.detail=null;render();}flash(apiErr(e),'error')}
  }
  async function refreshDetail(background=false){
    const id=state.detail?.request?.request_id;if(!id||state.view!=='detail')return;
    const nav=navigationVersion,rev=writeVersion(),fetchVersion=++detailFetchVersion;
    const r=await API().call('requestDetail',{requestId:id},{timeoutMs:30000});
    if(nav!==navigationVersion||state.view!=='detail'||id!==state.detail?.request?.request_id||rev!==writeVersion()||writing()||fetchVersion!==detailFetchVersion)return;
    if(background&&!canBackgroundRender())return;
    if($('#selModal')?.classList.contains('open')){silentSync();return;}
    pendingDetail=null;state.detail=withPokja(r.data);rememberDetail(state.detail);renderPreservingPosition();
  }

  function modal(html){const m=$('#selModal');if(!m)return;m.innerHTML=`<div class="sel-dialog">${html}</div>`;m.classList.add('open');$$('[data-close-sel-modal]',m).forEach(b=>b.addEventListener('click',()=>{if(!writing())m.classList.remove('open')}))}
  function confirmCritical({eyebrow='KONFIRMASI',title,message,yes='Ya, lanjutkan',no='Batal',danger=false}={}){
    return new Promise(resolve=>{const root=$('#selModal');if(!root){resolve(false);return}const wasOpen=root.classList.contains('open'),layer=document.createElement('div');layer.className='sel-confirm-layer';layer.innerHTML=`<div class="sel-confirm-box" role="alertdialog" aria-modal="true"><small>${esc(eyebrow)}</small><h4>${esc(title||'Lanjutkan?')}</h4><p>${esc(message||'Periksa kembali sebelum melanjutkan.')}</p><div class="sel-form-actions"><button type="button" class="sel-ghost" data-confirm-no>${esc(no)}</button><button type="button" class="${danger?'sel-danger':'sel-primary'}" data-confirm-yes>${esc(yes)}</button></div></div>`;root.appendChild(layer);root.classList.add('open');const finish=v=>{layer.remove();if(!wasOpen)root.classList.remove('open');resolve(v)};layer.querySelector('[data-confirm-no]')?.addEventListener('click',()=>finish(false));layer.querySelector('[data-confirm-yes]')?.addEventListener('click',()=>finish(true));layer.addEventListener('click',e=>{if(e.target===layer)finish(false)});layer.querySelector('[data-confirm-yes]')?.focus();});
  }
  let criticalProcessSeq=0;
  function criticalProcess({eyebrow='SEDANG DIPROSES',title='Memproses',message='Tunggu sampai proses selesai.'}={}){
    const id=++criticalProcessSeq;state.busy=true;
    if(typeof document==='undefined'||typeof document.getElementById!=='function'||!document.body||typeof document.body.appendChild!=='function'){let closed=false;const close=()=>{if(closed)return;closed=true;if(id===criticalProcessSeq)state.busy=false};return{set(){},phase(){},async success(){close()},fail(){close()},close};}
    let root=document.getElementById('orbitCriticalProcess');
    if(!root){root=document.createElement('div');root.id='orbitCriticalProcess';root.className='sel-process-overlay';document.body.appendChild(root);}
    root.className='sel-process-overlay show';
    root.innerHTML=`<div class="sel-process-card" role="alertdialog" aria-modal="true" aria-live="assertive"><div class="sel-process-mark"><i></i></div><small data-process-eyebrow>${esc(eyebrow)}</small><h4 data-process-title>${esc(title)}</h4><p data-process-message>${esc(message)}</p><div class="sel-process-track" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="6"><i style="width:6%"></i></div><div class="sel-process-meta"><strong data-process-pct>6%</strong><span data-process-hint>Jangan tutup halaman</span></div><button type="button" class="sel-ghost sel-process-close" data-process-close hidden>Tutup</button></div>`;
    document.documentElement.classList.add('sel-process-lock');
    let pct=6,done=false,closed=false;
    const bar=$('.sel-process-track',root),fill=$('.sel-process-track i',root),pctEl=$('[data-process-pct]',root),titleEl=$('[data-process-title]',root),msgEl=$('[data-process-message]',root),hintEl=$('[data-process-hint]',root),closeBtn=$('[data-process-close]',root);
    const paint=(value,text)=>{pct=Math.max(pct,Math.min(99,Math.round(Number(value)||0)));if(fill)fill.style.width=pct+'%';if(pctEl)pctEl.textContent=pct+'%';bar?.setAttribute('aria-valuenow',String(pct));if(text&&msgEl)msgEl.textContent=text;};
    const timer=setInterval(()=>{if(done||closed)return;const add=pct<42?5:pct<70?3:pct<86?2:1;paint(Math.min(92,pct+add));},260);
    const close=()=>{if(closed)return;closed=true;clearInterval(timer);if(id===criticalProcessSeq)state.busy=false;root.classList.remove('show','success','error');root.innerHTML='';document.documentElement.classList.remove('sel-process-lock');};
    closeBtn?.addEventListener('click',close);
    return {
      set(value,text){if(!done&&!closed)paint(value,text)},
      phase(text,value){if(!done&&!closed)paint(value==null?pct:value,text)},
      async success(text='Proses selesai.'){if(closed)return;done=true;clearInterval(timer);paint(100);if(fill)fill.style.width='100%';if(pctEl)pctEl.textContent='100%';bar?.setAttribute('aria-valuenow','100');root.classList.add('success');if(titleEl)titleEl.textContent='Berhasil';if(msgEl)msgEl.textContent=text;if(hintEl)hintEl.textContent='Proses sudah selesai';await new Promise(r=>setTimeout(r,360));close();},
      fail(text='Proses belum berhasil. Coba lagi.'){if(closed)return;done=true;clearInterval(timer);root.classList.add('error');if(titleEl)titleEl.textContent='Belum berhasil';if(msgEl)msgEl.textContent=text;if(hintEl)hintEl.textContent=/tanggal|jadwal|pekerjaan|dokumen|kualifikasi|kategori/i.test(text)?'Periksa isian permohonan lalu coba lagi':'Periksa koneksi lalu coba lagi';if(closeBtn)closeBtn.hidden=false;setTimeout(()=>{if(!closed)close()},4500);},
      close
    };
  }
  // Broadcast: persentase hanya untuk upload yang memberi progres nyata.
  // Saat backend menyimpan, tampilkan indikator menunggu tanpa angka perkiraan.
  function broadcastProcess(){
    state.busy=true;
    let root=document.getElementById('orbitBroadcastProcess');
    if(!root){root=document.createElement('div');root.id='orbitBroadcastProcess';root.className='sel-process-overlay';document.body.appendChild(root);}
    root.className='sel-process-overlay show broadcast-process';
    root.innerHTML=`<div class="sel-process-card" role="alertdialog" aria-modal="true" aria-live="polite"><div class="sel-process-mark"><i></i></div><small>BROADCAST NOTIFIKASI</small><h4 data-broadcast-title>Mengirim pemberitahuan</h4><p data-broadcast-message>Menyiapkan pengiriman…</p><div class="sel-process-track" role="progressbar" aria-label="Proses broadcast"><i></i></div><div class="sel-process-meta"><strong data-broadcast-pct>Memproses…</strong><span data-broadcast-hint>Jangan tutup halaman</span></div><button class="sel-ghost sel-process-close" type="button" data-broadcast-close hidden>Tutup</button></div>`;
    document.documentElement.classList.add('sel-process-lock');
    const bar=$('.sel-process-track',root),fill=$('.sel-process-track i',root),pct=$('[data-broadcast-pct]',root),title=$('[data-broadcast-title]',root),msg=$('[data-broadcast-message]',root),hint=$('[data-broadcast-hint]',root),closeBtn=$('[data-broadcast-close]',root);
    let closed=false,finished=false;
    const close=()=>{if(closed)return;closed=true;state.busy=false;root.classList.remove('show','success','error');root.innerHTML='';document.documentElement.classList.remove('sel-process-lock');};
    const waiting=text=>{if(finished||closed)return;root.classList.add('is-waiting');bar?.removeAttribute('aria-valuenow');bar?.setAttribute('aria-valuetext',text);if(pct)pct.textContent='Memproses…';if(msg)msg.textContent=text;};
    const upload=value=>{if(finished||closed)return;root.classList.remove('is-waiting');const progress=Math.max(0,Math.min(100,Math.round(Number(value)||0)));if(pct)pct.textContent=progress+'%';if(fill)fill.style.width=progress+'%';bar?.setAttribute('aria-valuenow',String(progress));bar?.removeAttribute('aria-valuetext');if(msg)msg.textContent='Mengunggah lampiran…';};
    closeBtn?.addEventListener('click',close);
    waiting('Menyiapkan pengiriman…');
    return {
      waiting,upload,
      async success(){if(finished||closed)return;finished=true;root.classList.remove('is-waiting');root.classList.add('success');if(title)title.textContent='Berhasil dikirim';if(msg)msg.textContent='Pemberitahuan sudah disimpan untuk penerima yang dipilih.';if(pct)pct.textContent='100%';if(fill)fill.style.width='100%';bar?.setAttribute('aria-valuenow','100');bar?.removeAttribute('aria-valuetext');if(hint)hint.textContent='Pengiriman selesai';await new Promise(r=>setTimeout(r,1200));close();},
      fail(error){if(finished||closed)return;finished=true;root.classList.remove('is-waiting');root.classList.add('error');if(title)title.textContent='Belum berhasil';if(msg)msg.textContent=error||'Pemberitahuan belum terkirim.';if(pct)pct.textContent='Gagal';if(hint)hint.textContent='Periksa keterangan di atas';bar?.removeAttribute('aria-valuenow');bar?.setAttribute('aria-valuetext','Gagal');if(closeBtn)closeBtn.hidden=false;},
      close
    };
  }
  function createRoute(path,replace=false){setSelectionHash(path,replace);}
  function createItemFromRequest(r={}){return{kodeRup:String(r.kode_rup||''),namaPaket:r.nama_paket||'',opd:r.opd||'',program:r.program||'',kegiatan:r.kegiatan||'',subKegiatan:r.sub_kegiatan||'',jenis:r.jenis||'',metode:r.metode_epurchasing||r.metode_pengadaan||'E-Purchasing',pagu:Number(r.pagu)||0,pdn:r.produk_dalam_negeri||'',sumberDana:r.sumber_dana||'',waktuPemilihan:r.waktu_pemilihan||'',activeRequestId:r.request_id||''};}
  // Google Sheets may return date/time cells as ISO timestamps. Keep native input values stable across drafts.
  function formYmd(value){
    const v=String(value||'').trim();if(!v)return '';
    if(/^\d{4}-\d{2}-\d{2}$/.test(v))return v;
    const d=new Date(v);if(!Number.isNaN(d.getTime()))return new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Jakarta',year:'numeric',month:'2-digit',day:'2-digit'}).format(d);
    return '';
  }
  function formClock(value){const v=String(value||'').trim();if(/^\d{2}:\d{2}/.test(v))return v.slice(0,5);if(!v)return '';const d=new Date(v);if(Number.isNaN(d.getTime()))return '';if(d.getUTCFullYear()<1902){const minutes=(d.getUTCHours()*60+d.getUTCMinutes()+420)%1440;return String(Math.floor(minutes/60)).padStart(2,'0')+':'+String(minutes%60).padStart(2,'0')}return new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Jakarta',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(d)}
  function hydrateCreateFromDetail(detail){
    const r=detail?.request||{},c=newCreateState(),q=parseJson(r.qualification_json,{}),products=parseJson(r.product_details_json,[]),construction=parseJson(r.construction_details_json,[]);
    c.competitionType=String(r.competition_type||'NON_CONSTRUCTION').toUpperCase();
    c.requestId=String(r.request_id||'');c.previousRequestId=String(r.previous_request_id||'');c.rupCode=String(r.kode_rup||'');c.rupData=createItemFromRequest(r);c.title=r.competition_title||r.nama_paket||'';
    c.scheduleStartDate=formYmd(r.schedule_start_date);c.scheduleEndDate=formYmd(r.schedule_end_date);c.scheduleStartTime=formClock(r.schedule_start_time);c.scheduleEndTime=formClock(r.schedule_end_time);
    c.qualifications={umk:!!(q.umk||q.mikro||q.kecil),mikro:!!q.mikro,kecil:!!q.kecil,nonUmk:!!(q.nonUmk||q.menengah||q.besar),menengah:!!q.menengah,besar:!!q.besar};
    if(c.competitionType==='CONSTRUCTION'&&!(c.qualifications.kecil||c.qualifications.menengah||c.qualifications.besar))c.qualifications=constructionDefaultQualifications();
    c.category=r.product_category||'';c.products=Array.isArray(products)?products:[];c.offerType=r.offer_type||'ITEMIZED';
    c.constructionDetails=Array.isArray(construction)?construction:[];c.paymentType=String(r.payment_type||'SINGLE').toUpperCase();c.paymentTermsCount=r.payment_terms_count?String(r.payment_terms_count):'';c.paymentTermsNote=r.payment_terms_note||'';
    c.location=r.work_location||'';c.completionDate=formYmd(r.completion_date);
    c.hpsAlokasi=Number(r.hps_alokasi)||0;c.compactKaji=Boolean(r.ppk_email&&c.hpsAlokasi>0);c.existingDocs=(detail?.docs||[]).filter(d=>String(d.is_current).toLowerCase()!=='false');c.sourceDetail=detail;c.dirty=false;return c;
  }
  function currentCreate(){if(!state.create)state.create=newCreateState();return state.create}
  // Sesudah Kaji Ulang, jenis Mini Kompetisi merupakan keputusan Pokja.
  // Tombol Kembali hanya untuk melihat jenis; bukan membuka pilihan lain.
  function lockedPostKajiCompetitionType(c=currentCreate()){
    if(!c.postKaji)return '';
    const original=String(c.sourceDetail?.request?.competition_type||'').toUpperCase();
    return original==='CONSTRUCTION'||original==='NON_CONSTRUCTION'?original:'';
  }
  function createProcessHtml(){return `<div class="sel-competition-page"><div class="sel-head sel-create-head"><div><small>PERMOHONAN PEMILIHAN</small><h3>Pilih Proses Permohonan</h3><p>Pilih proses yang akan diajukan.</p></div><button type="button" class="sel-ghost" data-process-back>← Permohonan Saya</button></div><div class="sel-competition-grid sel-process-grid"><button type="button" class="sel-competition-card" data-select-process="NEGOSIASI"><i class="sel-competition-illustration goods" aria-hidden="true"><span></span><span></span><span></span></i><b>Negosiasi</b><p>Permohonan Negosiasi dengan memilih metode pengadaan dan Kode RUP.</p><em>Pilih Negosiasi</em></button><button type="button" class="sel-competition-card" data-select-process="MINI_KOMPETISI"><i class="sel-competition-illustration build" aria-hidden="true"><span></span><span></span><span></span></i><b>Mini Kompetisi</b><p>Permohonan Mini Kompetisi dengan jadwal, kualifikasi penyedia, serta detail produk atau pekerjaan.</p><em>Pilih Mini Kompetisi</em></button></div></div>`}
  function bindCreateProcess(){
    $('[data-process-back]')?.addEventListener('click',()=>{state.create=null;state.view='requests';createRoute('permohonan');render()});
    $$('[data-select-process]').forEach(btn=>btn.addEventListener('click',()=>{
      if(btn.dataset.selectProcess==='NEGOSIASI'){state.create=null;state.view='requests';createRoute('permohonan');render();openNegotiationCreate();}
      else openMiniCreate();
    }));
  }
  function createKindHtml(){
    const c=currentCreate(),locked=lockedPostKajiCompetitionType(c);
    if(locked)c.competitionType=locked;
    const choice=(type,title,description,illustration)=>{
      const selected=c.competitionType===type,unavailable=!!locked&&locked!==type;
      return `<button type="button" class="sel-competition-card ${type==='CONSTRUCTION'?'construction ':''}${selected?'selected ':''}${unavailable?'kaji-locked-out':''}" data-competition-type="${type}" ${unavailable?'disabled aria-disabled="true"':''}><i class="sel-competition-illustration ${illustration}" aria-hidden="true"><span></span><span></span><span></span></i><b>${title}</b><p>${description}</p><em>${unavailable?'Tidak tersedia':locked?'Ditetapkan Pokja':selected?'Dipilih':'Pilih'}</em></button>`;
    };
    return `<div class="sel-competition-page"><div class="sel-head sel-create-head"><div><small>PERMOHONAN PEMILIHAN</small><h3>Pilih Jenis Kompetisi</h3>${locked?'<p>Jenis kompetisi sudah ditetapkan Pokja melalui Kaji Ulang.</p>':'<p>Pilih jenis kompetisi sebelum mengisi rincian permohonan.</p>'}</div><button type="button" class="sel-ghost" data-create-back-list>${locked?'← Detail Permohonan':'← Pilih Proses'}</button></div><div class="sel-competition-grid">${choice('NON_CONSTRUCTION','Barang/Jasa Lainnya','Untuk kategori Barang, Jasa, Digital, Material Konstruksi, Alat Kesehatan, Telekomunikasi, dan Obat.','goods')}${choice('CONSTRUCTION','Pekerjaan Konstruksi','Untuk kompetisi pekerjaan konstruksi dengan detail pekerjaan, pembayaran, dan kualifikasi penyedia konstruksi.','build')}</div><div class="sel-create-bottom"><button type="button" class="sel-primary sel-create-next">${locked?'Lanjutkan Detail Kompetisi':'Buat Kompetisi'}</button></div></div>`;
  }
  function option(value,label,current){return `<option value="${esc(value)}" ${String(current)===String(value)?'selected':''}>${esc(label)}</option>`}
  function availableCreateRups(c){
    const items=syncActiveRupOptions({items:c.rupItems||[]}).items,rows=items.filter(x=>Number(x.sisaPagu??x.pagu)>0);
    const current=c.rupData&&c.rupCode&&!rows.some(x=>String(x.kodeRup)===String(c.rupCode))?[c.rupData]:[];
    return [...current,...rows];
  }
  function createRupComboHtml(c){
    const available=availableCreateRups(c),selected=(c.rupData&&c.rupCode)?c.rupData:available.find(x=>String(x.kodeRup)===String(c.rupCode));
    const value=selected?`${selected.kodeRup} · ${selected.namaPaket||'Tanpa nama paket'} · ${fmtRp(selected.pagu||0)}`:'';
    const locked=Boolean(c.postKaji);
    const disabled=(c.rupLoading&&!available.length)||(!c.rupLoading&&c.rupLoaded&&!available.length);
    const placeholder=locked?'Kode RUP mengikuti permohonan awal':(c.rupLoading?'Memuat RUP…':available.length?'Cari Kode RUP atau nama paket':'Belum ada RUP lain yang dapat diajukan');
    return `<div class="sel-rup-combo" id="mcRupCombo"><input id="mcRupSearch" type="search" autocomplete="off" spellcheck="false" placeholder="${esc(placeholder)}" value="${esc(value)}" ${(disabled||locked)?'disabled':''} ${locked?'readonly aria-readonly="true"':''}><input id="mcRupSelect" type="hidden" value="${esc(c.rupCode||'')}"><button type="button" class="sel-rup-toggle" id="mcRupToggle" aria-label="Buka daftar Kode RUP" aria-expanded="false" ${(disabled||locked)?'disabled':''}>⌄</button><div class="sel-rup-options" id="mcRupOptions" hidden></div></div><small class="sel-field-help">${locked?'Kode RUP dikunci mengikuti permohonan awal dan tidak bisa diubah lagi.':'Cari Kode RUP atau nama paket. Pagu langsung terlihat pada daftar.'}</small>`;
  }
  function productTotal(item){return (Number(item?.hps)||0)*(Number(item?.qty)||0)}
  function competitionHps(products){return (products||[]).reduce((sum,item)=>sum+productTotal(item),0)}
  function rupBudget(create){return Math.max(0,Number(create?.postKaji?(create?.hpsAlokasi||0):(create?.rupData?.pagu||0))||0)}
  function exceedsRupBudget(total,budget){return budget>0&&total>budget}
  function rupBudgetMessage(total,budget,label='kompetisi'){return `Total HPS ${label} ${fullRp(total)} melebihi pagu RUP ${fullRp(budget)}.`}
  const boolAvailability=v=>v===true?'Tersedia':v===false?'Tidak Tersedia':'';
  const boolAda=v=>v===true?'Ada':v===false?'Tidak Ada':'';
  const boolYesNo=v=>v===true?'Ya':v===false?'Tidak':'';
  function detailedProductView(item={}){
    return {
      ...item,
      specification:item.specification ?? item.spec ?? '',
      nieValidity:item.nieValidity ?? item.nieExpiry ?? '',
      distributor:item.distributor ?? item.distributors ?? '',
      distributionPermit:item.distributionPermit ?? boolAvailability(item.hasDistributionPermit),
      goodManufacturing:item.goodManufacturing ?? boolAvailability(item.hasCpakb),
      goodDistribution:item.goodDistribution ?? boolAvailability(item.hasCdakb),
      telecomCertificate:item.telecomCertificate ?? (typeof item.hasTelekomPermit==='boolean'?boolAda(item.hasTelekomPermit):''),
      radiationPermit:item.radiationPermit ?? (typeof item.hasSiprp==='boolean'?boolAda(item.hasSiprp):''),
      postMarket:item.postMarket ?? (typeof item.hasPostMarket==='boolean'?boolAda(item.hasPostMarket):''),
      pib:item.pib ?? (typeof item.hasPib==='boolean'?boolAda(item.hasPib):''),
      bmhp:item.bmhp ?? (typeof item.isBmhp==='boolean'?boolYesNo(item.isBmhp):''),
      priceStructure:item.priceStructure ?? boolAvailability(item.hasPriceStructure),
      otherInfo:item.otherInfo ?? item.additionalInfo ?? '',
      ecoLabel:item.ecoLabel ?? (typeof item.hasEcoLabel==='boolean'?boolAda(item.hasEcoLabel):''),
      extraSpecification:item.extraSpecification ?? item.additionalSpec ?? '',
      hps:Number(item.hps ?? item.unitPrice ?? 0)||0,
      unitPrice:Number(item.unitPrice ?? item.hps ?? 0)||0,
      totalPrice:Number(item.totalPrice || ((Number(item.qty)||0)*(Number(item.hps ?? item.unitPrice)||0)) || 0)
    };
  }
  function productSummary(item,index){
    const category=item.category||'Barang',detailed=isDetailedProductCategory(category),d=detailedProductView(item);
    const path=item.categoryPath||[category,(item.rootCategory&&item.rootCategory!==category)?item.rootCategory:'',item.level2,item.level3].filter(Boolean).join(' > ')||(item.productCategory||category||'—');
    const total=Number(d.totalPrice||((Number(d.qty)||0)*(Number(d.hps)||0))||0),fields=[['Kategori',path||'—'],['KBLI',item.kbli||'—'],['Tipe Kategori',category]];
    if(detailed){
      [
        ['Kode KFA',d.kfa],['Spesifikasi Produk',d.specification],['Nomor Izin Edar (NIE)',d.nie],['Masa Berlaku NIE',d.nieValidity],
        ['Daftar Distributor yang Ditunjuk',d.distributor],['Izin Distribusi Alat Kesehatan',d.distributionPermit],['Sertifikat Cara Pembuatan Alat Kesehatan yang Baik Yang Masih Berlaku',d.goodManufacturing],
        ['Sertifikat Cara Distribusi Alat Kesehatan Yang Baik Yang Masih Berlaku',d.goodDistribution],['Sertifikat Alat Telekomunikasi dan/atau Perangkat Telekomunikasi',d.telecomCertificate],
        ['Sertifikat Izin Pemanfaatan Sumber Radiasi Pengion (SRP)',d.radiationPermit],['Hasil Pengujian Post Market',d.postMarket],['Pemberitahuan Import Barang (PIB)',d.pib],['BMHP',d.bmhp],
        ['Garansi',d.warranty],['Surat Ketersediaan Layanan Purna Jual dan Spare Part',d.afterSales],['Struktur Harga',d.priceStructure],['Informasi Lainnya',d.otherInfo],
        ['Label Produk Ramah Lingkungan Hidup',d.ecoLabel],['Spesifikasi Tambahan',d.extraSpecification],['Jumlah',d.qty],['Satuan',d.unit],['HPS Produk',fullRp(d.hps)],['Total HPS Produk',fullRp(total)]
      ].forEach(pair=>fields.push(pair));
    }else{
      fields.push(['Uraian',item.desc||item.name],['Spesifikasi Tambahan',item.extraSpecification||item.spec||''],['Jumlah',item.qty],['Satuan',item.unit],['Harga Satuan',fullRp(item.unitPrice||item.hps||0)],['Total',fullRp(total)]);
    }
    addInaprocExtraSummary(fields,item);
    return `<article class="sel-product-card"><header><b>Produk ${index+1}</b><div><button type="button" class="sel-product-edit" data-edit-product="${index}">Ubah</button><button type="button" class="sel-product-trash" data-delete-product="${index}" aria-label="Hapus Produk ${index+1}" title="Hapus"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 3h6l1 2h4v2H4V5h4l1-2Zm-2 6h10l-1 11H8L7 9Zm3 2v7h2v-7h-2Zm4 0v7h2v-7h-2Z"/></svg></button></div></header><div class="sel-product-summary-grid">${fields.filter(([,val])=>val===0||(val!==null&&val!==undefined&&String(val).trim()!==''&&String(val).trim()!=='—')).map(([label,val])=>`<span>${esc(label)}</span><b>${esc(val)}</b>`).join('')}</div></article>`;
  }
  function createDocRow(c,type,label){
    if(c.postKaji){const doc=(c.existingDocs||[]).find(x=>x.doc_type===type);return `<div class="sel-create-doc-readonly"><b>${esc(label)}</b>${doc?`<a target="_blank" rel="noopener" href="${esc(doc.drive_url)}">Buka dokumen ↗</a>`:'Belum diunggah'}</div>`;}
    const existing=(c.existingDocs||[]).find(d=>String(d.doc_type)===type),picked=c.files.get(type),name=picked?.name||existing?.file_name||'';
    const status=name?'Siap diunggah':'Belum diunggah';
    return `<article class="sel-create-doc" data-create-dropzone="${esc(type)}"><div class="sel-create-doc-name"><b>${esc(label)} <sup>*</sup></b><span>${esc(status)}</span>${existing?.drive_url?`<a href="${esc(existing.drive_url)}" target="_blank" rel="noopener noreferrer">Buka dokumen ↗</a>`:''}</div><label class="sel-drop-upload" data-create-drop-label="${esc(type)}"><input type="file" accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png" data-create-doc-file="${esc(type)}"><i class="sel-drop-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M12 3 7 8h3v6h4V8h3l-5-5Zm-7 9h3v6h8v-6h3v7a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-7Z"/></svg></i><span class="sel-drop-copy"><b>${name?esc(name):'Pilih atau tarik dokumen di sini'}</b><small>Format .pdf, .doc, .docx, .xls, .xlsx, .jpeg, .jpg, .png (maks. 10 MB; gambar besar diperkecil otomatis)</small></span><em>${name?'Ganti File':'Unggah Dokumen'}</em></label></article>`;
  }
  function createConstructionFormHtml(){
    const c=currentCreate(),q=c.qualifications||constructionDefaultQualifications(),rup=c.rupData||{},today=jakartaDay(),startMin=today,endMin=c.scheduleStartDate||today,completionMin=c.scheduleEndDate||c.scheduleStartDate||today,totalHps=constructionHps(c.constructionDetails),rupLimit=rupBudget(c),overBudget=exceedsRupBudget(totalHps,rupLimit);
    return `<div class="sel-mc-page ${c.postKaji&&c.compactKaji?'kaji-compact':''}"><div class="sel-head sel-create-head"><div><small>PEKERJAAN KONSTRUKSI</small><h3>${c.postKaji?'Lengkapi Detail Mini Kompetisi':c.requestId?'Lanjutkan Draft':'Form Permohonan Kompetisi'}</h3><p>${c.requestId?esc(c.requestId)+' · ':''}${c.postKaji?'Dokumen persiapan sebelumnya tetap digunakan.':'Data baru dikirim ke Kepala UKPBJ setelah tombol Kirim ditekan.'}</p></div><button type="button" class="sel-ghost" data-create-back-kind>← Jenis Kompetisi</button></div><div class="sel-mc-layout"><aside class="sel-mc-nav"><button data-create-jump="mcRup">RUP</button><button data-create-jump="mcSchedule">Jadwal Kompetisi</button><button data-create-jump="mcConstruction">Detail Pekerjaan Konstruksi</button><button data-create-jump="mcQualification">Kualifikasi Penyedia</button><button data-create-jump="mcPayment">Pembayaran</button><button data-create-jump="mcLocation">Lokasi</button><button data-create-jump="mcCompletion">Penyelesaian Pekerjaan</button><button data-create-jump="mcDocs">Dokumen Persiapan</button></aside><div class="sel-mc-content">
    <section class="sel-mc-section" id="mcRup"><div class="sel-mc-copy"><small>01</small><h4>Rencana Umum Pengadaan (RUP)</h4><p>Pilih RUP yang akan dibuatkan kompetisi.</p></div><div class="sel-mc-fields"><label class="sel-field"><span>KODE RUP</span>${createRupComboHtml(c)}</label><label class="sel-field"><span>JUDUL KOMPETISI</span><input id="mcTitle" maxlength="180" value="${esc(c.title||rup.namaPaket||'')}" placeholder="Isi judul kompetisi"></label>${c.rupCode?`<div class="sel-mc-rup-preview"><b>${esc(rup.namaPaket||c.title)}</b><span>${esc(rup.opd||state.me?.opd||'')} · ${fmtRp(rup.pagu||0)} · ${esc(rup.sumberDana||'—')}</span><small>${esc(rup.program||'')}${rup.kegiatan?' · '+esc(rup.kegiatan):''}</small></div>`:''}</div></section>
    <section class="sel-mc-section" id="mcSchedule"><div class="sel-mc-copy"><small>02</small><h4>Jadwal Kompetisi</h4><p>Tentukan periode dan jam penawaran.</p></div><div class="sel-mc-fields"><div class="sel-form-grid"><label class="sel-field"><span>TANGGAL MULAI</span><input id="mcStartDate" type="date" min="${esc(startMin)}" value="${esc(c.scheduleStartDate)}"></label><label class="sel-field"><span>TANGGAL BERAKHIR</span><input id="mcEndDate" type="date" min="${esc(endMin)}" value="${esc(c.scheduleEndDate)}"></label><label class="sel-field"><span>JAM MULAI</span><input id="mcStartTime" type="time" value="${esc(c.scheduleStartTime)}"></label><label class="sel-field"><span>JAM BERAKHIR</span><input id="mcEndTime" type="time" value="${esc(c.scheduleEndTime)}"></label></div><small class="sel-field-help">Tanggal mulai hanya dapat dipilih mulai hari ini. Jam mengikuti waktu WIB.</small></div></section>
    <section class="sel-mc-section" id="mcConstruction"><div class="sel-mc-copy"><small>03</small><h4>Detail Pekerjaan Konstruksi</h4><p>Tambahkan satu atau lebih detail pekerjaan sesuai kebutuhan kompetisi.</p></div><div class="sel-mc-fields">${c.constructionDetails.length?`<div class="sel-competition-total ${overBudget?'is-error':''}">Total HPS Kompetisi <b>${fullRp(totalHps)}</b></div>${overBudget?`<div class="sel-competition-warning">${rupBudgetMessage(totalHps,rupLimit,'pekerjaan')}</div>`:''}`:''}<div class="sel-product-list">${c.constructionDetails.length?c.constructionDetails.map(constructionSummary).join(''):'<div class="sel-empty compact"><b>Belum ada detail pekerjaan</b>Tambahkan minimal satu pekerjaan konstruksi.</div>'}</div><button type="button" class="sel-ghost sel-add-product" data-add-construction>Tambah Detail Pekerjaan</button></div></section>
    <section class="sel-mc-section" id="mcQualification"><div class="sel-mc-copy"><small>04</small><h4>Kualifikasi Penyedia</h4><p>Kualifikasi penyedia konstruksi terpilih otomatis dan dapat disesuaikan jika diperlukan.</p></div><div class="sel-mc-fields sel-construction-qualification"><label class="sel-check-card"><input type="checkbox" id="mcKecil" ${q.kecil?'checked':''}><span><b>UMK - Kecil</b><small>Penyedia konstruksi dari skala usaha Kecil.</small></span></label><div class="sel-construction-nonumk"><label class="sel-check-card"><input type="checkbox" id="mcNonUmk" ${q.nonUmk?'checked':''}><span><b>Non-UMK</b><small>Penyedia konstruksi dari skala usaha Menengah dan Besar.</small></span></label><div class="sel-construction-business-types"><b>Pilih Jenis Non-UMK</b><label><input type="checkbox" id="mcMenengah" ${q.menengah?'checked':''}> Menengah</label><label><input type="checkbox" id="mcBesar" ${q.besar?'checked':''}> Besar</label></div></div></div></section>
    <section class="sel-mc-section" id="mcPayment"><div class="sel-mc-copy"><small>05</small><h4>Pembayaran</h4><p>Tentukan tipe pembayaran pekerjaan.</p></div><div class="sel-mc-fields"><div class="sel-offer-grid"><label class="sel-radio-card"><input type="radio" name="mcPaymentType" value="SINGLE" ${c.paymentType!=='TERMIN'?'checked':''}><span><b>Sekali Bayar</b></span></label><label class="sel-radio-card"><input type="radio" name="mcPaymentType" value="TERMIN" ${c.paymentType==='TERMIN'?'checked':''}><span><b>Termin</b></span></label></div>${c.paymentType==='TERMIN'?`<div class="sel-payment-terms"><label class="sel-field"><span>JUMLAH TERMIN</span><input id="mcPaymentTermsCount" type="number" min="1" step="1" value="${esc(c.paymentTermsCount||'')}" placeholder="Masukkan jumlah termin"></label><small class="sel-field-help">Jumlah termin akan ditetapkan saat persetujuan oleh PPK, namun tidak akan melebihi jumlah yang dimasukkan di kolom ini.</small><label class="sel-field"><span>PENJELASAN TERMIN</span><div class="sel-termin-editor"><div class="sel-termin-toolbar"><button type="button" tabindex="-1"><b>B</b></button><button type="button" tabindex="-1"><u>U</u></button><button type="button" tabindex="-1"><i>I</i></button><button type="button" tabindex="-1">☷</button></div><textarea id="mcPaymentTermsNote" placeholder="Masukkan detail skema sesuai dengan termin yang disetujui.&#10;&#10;Contoh:&#10;Termin 1: Rp ...&#10;Catatan Termin 1: ......&#10;Tanggal Penyelesaian Pekerjaan Termin 1: DD - MM - YYYY&#10;&#10;Termin 2: Rp ...&#10;Catatan Termin 2: ......&#10;Tanggal Penyelesaian Pekerjaan Termin 2: DD - MM - YYYY">${esc(c.paymentTermsNote||'')}</textarea></div></label></div>`:''}</div></section>
    <section class="sel-mc-section" id="mcLocation"><div class="sel-mc-copy"><small>06</small><h4>Lokasi</h4><p>Isi alamat lokasi pekerjaan secara manual.</p></div><div class="sel-mc-fields"><label class="sel-field"><span>LOKASI PEKERJAAN</span><textarea id="mcLocationInput" placeholder="Contoh: Gedung Dinas Kesehatan Kota Bogor, Jl. ...">${esc(c.location)}</textarea></label></div></section>
    <section class="sel-mc-section" id="mcCompletion"><div class="sel-mc-copy"><small>07</small><h4>Penyelesaian Pekerjaan</h4><p>Tentukan tanggal penyelesaian pekerjaan.</p></div><div class="sel-mc-fields"><label class="sel-field"><span>TANGGAL PENYELESAIAN</span><input id="mcCompletionDate" type="date" min="${esc(completionMin)}" value="${esc(c.completionDate)}"></label><small class="sel-field-help">Tanggal penyelesaian tidak dapat lebih awal dari tanggal berakhir kompetisi.</small></div></section>
    <section class="sel-mc-section" id="mcDocs"><div class="sel-mc-copy"><small>08</small><h4>Dokumen Persiapan</h4><p>${c.postKaji?'Dokumen dari pengajuan awal.':'Unggah dokumen persiapan paket sebelum dikirim ke Kepala UKPBJ.'}</p></div><div class="sel-mc-fields sel-create-docs">${createDocTypes.map(([type,label])=>createDocRow(c,type,label)).join('')}</div></section>
    <div class="sel-mc-actions"><button type="button" class="sel-ghost" data-create-back-kind>Kembali</button><button type="button" class="sel-danger-outline" data-save-create-draft>Simpan Draft</button><button type="button" class="sel-primary" data-send-create>${c.postKaji?'Kirim Detail Pemilihan':'Kirim ke Kepala UKPBJ'}</button></div>
    </div></div></div>`}
  function createFormHtml(){
    if(currentCreate().competitionType==='CONSTRUCTION')return createConstructionFormHtml();
    const c=currentCreate(),q=c.qualifications||{},rup=c.rupData||{},today=jakartaDay(),startMin=today,endMin=c.scheduleStartDate||today,completionMin=c.scheduleEndDate||c.scheduleStartDate||today,totalHps=competitionHps(c.products),rupLimit=rupBudget(c),overBudget=exceedsRupBudget(totalHps,rupLimit),categoryOptions=competitionCategories.length?competitionCategories.map(x=>option(x,x,c.category)).join(''):(c.category?option(c.category,c.category,c.category):''),categoryPlaceholder=productCategoryGroupsLoaded?'Pilih kategori':'Memuat kategori…',categorySelectDisabled=c.products.length||(!productCategoryGroupsLoaded&&!c.category);
    if(!c.offerType)c.offerType='ITEMIZED';
    return `<div class="sel-mc-page ${c.postKaji&&c.compactKaji?'kaji-compact':''}"><div class="sel-head sel-create-head"><div><small>BARANG/JASA LAINNYA</small><h3>${c.postKaji?'Lengkapi Detail Mini Kompetisi':c.requestId?'Lanjutkan Draft':'Form Permohonan Kompetisi'}</h3><p>${c.requestId?esc(c.requestId)+' · ':''}${c.postKaji?'Data dikirim ke Pokja setelah detail pemilihan dilengkapi.':'Data baru dikirim ke Kepala UKPBJ setelah tombol Kirim ditekan.'}</p></div><button type="button" class="sel-ghost" data-create-back-kind>← Jenis Kompetisi</button></div><div class="sel-mc-layout"><aside class="sel-mc-nav"><button data-create-jump="mcRup">RUP</button><button data-create-jump="mcSchedule">Jadwal Kompetisi</button><button data-create-jump="mcQualification">Kualifikasi Penyedia</button><button data-create-jump="mcProducts">Detail Produk</button><button data-create-jump="mcLocation">Lokasi</button><button data-create-jump="mcCompletion">Penyelesaian Pekerjaan</button><button data-create-jump="mcDocs">Dokumen Persiapan</button></aside><div class="sel-mc-content">
    <section class="sel-mc-section" id="mcRup"><div class="sel-mc-copy"><small>01</small><h4>Rencana Umum Pengadaan (RUP)</h4><p>Pilih RUP yang akan dibuatkan kompetisi.</p></div><div class="sel-mc-fields"><label class="sel-field"><span>KODE RUP</span>${createRupComboHtml(c)}</label><label class="sel-field"><span>JUDUL KOMPETISI</span><input id="mcTitle" maxlength="180" value="${esc(c.title||rup.namaPaket||'')}" placeholder="Isi judul kompetisi"></label>${c.rupCode?`<div class="sel-mc-rup-preview"><b>${esc(rup.namaPaket||c.title)}</b><span>${esc(rup.opd||state.me?.opd||'')} · ${fmtRp(rup.pagu||0)} · ${esc(rup.sumberDana||'—')}</span><small>${esc(rup.program||'')}${rup.kegiatan?' · '+esc(rup.kegiatan):''}</small></div>`:''}</div></section>
    <section class="sel-mc-section" id="mcSchedule"><div class="sel-mc-copy"><small>02</small><h4>Jadwal Kompetisi</h4><p>Tentukan periode dan jam penawaran.</p></div><div class="sel-mc-fields"><div class="sel-form-grid"><label class="sel-field"><span>TANGGAL MULAI</span><input id="mcStartDate" type="date" min="${esc(startMin)}" value="${esc(c.scheduleStartDate)}"></label><label class="sel-field"><span>TANGGAL BERAKHIR</span><input id="mcEndDate" type="date" min="${esc(endMin)}" value="${esc(c.scheduleEndDate)}"></label><label class="sel-field"><span>JAM MULAI</span><input id="mcStartTime" type="time" value="${esc(c.scheduleStartTime)}"></label><label class="sel-field"><span>JAM BERAKHIR</span><input id="mcEndTime" type="time" value="${esc(c.scheduleEndTime)}"></label></div><small class="sel-field-help">Tanggal mulai hanya dapat dipilih mulai hari ini. Jam mengikuti waktu WIB.</small></div></section>
    <section class="sel-mc-section" id="mcQualification"><div class="sel-mc-copy"><small>03</small><h4>Kualifikasi Penyedia</h4><p>Pilih skala usaha penyedia yang dapat mengikuti kompetisi.</p></div><div class="sel-mc-fields sel-qualification-grid"><label class="sel-check-card"><input type="checkbox" id="mcUmk" ${q.umk?'checked':''}><span><b>UMK</b><small>Penyedia barang/jasa dari skala usaha Mikro dan Kecil.</small></span></label><div class="sel-subchecks ${q.umk?'show':''}" data-umk-types><b class="sel-subcheck-title">Pilih Jenis UMK</b><label><input type="checkbox" id="mcMikro" ${q.mikro?'checked':''}> Mikro</label><label><input type="checkbox" id="mcKecil" ${q.kecil?'checked':''}> Kecil</label></div><label class="sel-check-card"><input type="checkbox" id="mcNonUmk" ${q.nonUmk?'checked':''}><span><b>Non-UMK</b><small>Penyedia barang/jasa dari skala usaha Menengah dan Besar.</small></span></label><div class="sel-subchecks ${q.nonUmk?'show':''}" data-nonumk-types><b class="sel-subcheck-title">Pilih Jenis NON-UMK</b><label><input type="checkbox" id="mcMenengah" ${q.menengah?'checked':''}> Menengah</label><label><input type="checkbox" id="mcBesar" ${q.besar?'checked':''}> Besar</label></div></div></section>
    <section class="sel-mc-section" id="mcProducts"><div class="sel-mc-copy"><small>04</small><h4>Detail Produk</h4><p>Pilih satu kategori, lalu tambahkan rincian produk yang akan dikompetisikan.</p></div><div class="sel-mc-fields"><label class="sel-field"><span>KATEGORI</span><select id="mcCategory" ${categorySelectDisabled?'disabled':''}><option value="">${esc(categoryPlaceholder)}</option>${categoryOptions}</select></label>${c.products.length?'<small class="sel-field-help">Hapus seluruh detail produk jika ingin mengganti kategori.</small>':''}${c.products.length?`<div class="sel-competition-total ${overBudget?'is-error':''}">Total HPS Kompetisi <b>${fullRp(totalHps)}</b></div>${overBudget?`<div class="sel-competition-warning">${rupBudgetMessage(totalHps,rupLimit,'produk')}</div>`:''}`:''}<div class="sel-product-list">${c.products.length?c.products.map(productSummary).join(''):'<div class="sel-empty compact"><b>Belum ada detail produk</b>Tambahkan minimal satu item.</div>'}</div><button type="button" class="sel-ghost sel-add-product" data-add-product ${!c.category?'disabled':''}>＋ Tambah Detail Produk</button></div></section>
    <section class="sel-mc-section" id="mcLocation"><div class="sel-mc-copy"><small>05</small><h4>Lokasi</h4><p>Isi alamat lokasi pekerjaan secara manual.</p></div><div class="sel-mc-fields"><label class="sel-field"><span>LOKASI PEKERJAAN</span><textarea id="mcLocationInput" placeholder="Contoh: Gedung Dinas Kesehatan Kota Bogor, Jl. ...">${esc(c.location)}</textarea></label></div></section>
    <section class="sel-mc-section" id="mcCompletion"><div class="sel-mc-copy"><small>06</small><h4>Penyelesaian Pekerjaan</h4><p>Tentukan tanggal penyelesaian pekerjaan.</p></div><div class="sel-mc-fields"><label class="sel-field"><span>TANGGAL PENYELESAIAN</span><input id="mcCompletionDate" type="date" min="${esc(completionMin)}" value="${esc(c.completionDate)}"></label><small class="sel-field-help">Tanggal penyelesaian tidak dapat lebih awal dari tanggal berakhir kompetisi.</small></div></section>
    <section class="sel-mc-section" id="mcDocs"><div class="sel-mc-copy"><small>07</small><h4>Dokumen Persiapan</h4><p>${c.postKaji?'Dokumen dari pengajuan awal.':'Unggah dokumen persiapan paket sebelum dikirim ke Kepala UKPBJ.'}</p></div><div class="sel-mc-fields sel-create-docs">${createDocTypes.map(([type,label])=>createDocRow(c,type,label)).join('')}</div></section>
    <div class="sel-mc-actions"><button type="button" class="sel-ghost" data-create-back-kind>Kembali</button><button type="button" class="sel-danger-outline" data-save-create-draft>Simpan Draft</button><button type="button" class="sel-primary" data-send-create>${c.postKaji?'Kirim Detail Pemilihan':'Kirim ke Kepala UKPBJ'}</button></div>
    </div></div></div>`}
  function syncCreateFromDom(){
    const c=currentCreate(),get=id=>$('#'+id),construction=c.competitionType==='CONSTRUCTION';
    if(get('mcRupSelect')){c.rupCode=String(get('mcRupSelect').value||'');const item=(c.rupItems||[]).find(x=>String(x.kodeRup)===c.rupCode);if(item)c.rupData=item;c.title=String(get('mcTitle')?.value||c.title||c.rupData?.namaPaket||'').trim();}
    if(get('mcStartDate'))c.scheduleStartDate=get('mcStartDate').value;if(get('mcEndDate'))c.scheduleEndDate=get('mcEndDate').value;if(get('mcStartTime'))c.scheduleStartTime=get('mcStartTime').value;if(get('mcEndTime'))c.scheduleEndTime=get('mcEndTime').value;
    c.qualifications=construction
      ?{umk:!!get('mcKecil')?.checked,mikro:false,kecil:!!get('mcKecil')?.checked,nonUmk:!!get('mcNonUmk')?.checked,menengah:!!get('mcMenengah')?.checked,besar:!!get('mcBesar')?.checked}
      :{umk:!!get('mcUmk')?.checked,mikro:!!get('mcMikro')?.checked,kecil:!!get('mcKecil')?.checked,nonUmk:!!get('mcNonUmk')?.checked,menengah:!!get('mcMenengah')?.checked,besar:!!get('mcBesar')?.checked};
    c.category=get('mcCategory')?.value||c.category;c.offerType=$('input[name="mcOfferType"]:checked')?.value||c.offerType;
    c.paymentType=$('input[name="mcPaymentType"]:checked')?.value||c.paymentType||'SINGLE';
    c.paymentTermsCount=get('mcPaymentTermsCount')?.value??c.paymentTermsCount;c.paymentTermsNote=get('mcPaymentTermsNote')?.value??c.paymentTermsNote;
    if(get('mcLocationInput'))c.location=get('mcLocationInput').value;if(get('mcCompletionDate'))c.completionDate=get('mcCompletionDate').value;c.dirty=true;return c;
  }
  function createPayload(){
    const c=syncCreateFromDom(),construction=c.competitionType==='CONSTRUCTION';
    return{
      kodeRup:c.rupCode,metodePengadaan:'E-Purchasing',selectionProcess:'MINI_KOMPETISI',competitionType:construction?'CONSTRUCTION':'NON_CONSTRUCTION',competitionTitle:c.title,
      scheduleStartDate:c.scheduleStartDate,scheduleEndDate:c.scheduleEndDate,scheduleStartTime:c.scheduleStartTime,scheduleEndTime:c.scheduleEndTime,
      qualifications:c.qualifications,productCategory:construction?'':c.category,productDetails:construction?[]:c.products,offerType:construction?'':c.offerType,
      constructionDetails:construction?c.constructionDetails:[],paymentType:construction?c.paymentType:'',paymentTermsCount:construction?c.paymentTermsCount:'',paymentTermsNote:construction?c.paymentTermsNote:'',
      workLocation:c.location,completionDate:c.completionDate,previousRequestId:c.previousRequestId||''
    };
  }
  function validateCreateForSubmit(){
    const c=syncCreateFromDom(),today=jakartaDay(),construction=c.competitionType==='CONSTRUCTION';
    if(!c.rupCode)return'Pilih RUP terlebih dahulu.';
    if(c.postKaji&&c.compactKaji){
      const details=construction?c.constructionDetails:c.products;
      if(!construction&&!c.category)return'Pilih kategori produk.';
      if(!details.length)return'Tambahkan minimal satu detail '+(construction?'pekerjaan':'produk')+'.';
      if(details.some(d=>!(Number(d.hps)>0)||!(Number(d.qty)>0)||!String(d.unit||'').trim()))return'Lengkapi HPS, jumlah, dan satuan.';
      const total=construction?constructionHps(details):competitionHps(details);
      if(exceedsRupBudget(total,rupBudget(c)))return'Total HPS detail melebihi HPS permohonan.';
      if(!String(c.location||'').trim())return'Isi lokasi pekerjaan.';
      return '';
    }
    if(!c.scheduleStartDate||!c.scheduleEndDate||!c.scheduleStartTime||!c.scheduleEndTime)return'Lengkapi jadwal kompetisi.';
    if(c.scheduleStartDate<today)return'Tanggal mulai sudah lewat. Perbarui jadwal kompetisi sebelum mengirim permohonan.';
    if(c.scheduleEndDate<c.scheduleStartDate)return'Tanggal berakhir tidak boleh sebelum tanggal mulai.';
    if(construction){
      if(!(c.qualifications.kecil||c.qualifications.menengah||c.qualifications.besar))return'Pilih kualifikasi penyedia konstruksi.';
      if(!c.constructionDetails.length)return'Tambahkan minimal satu detail pekerjaan konstruksi.';
      const invalid=c.constructionDetails.find(x=>!String(x.categoryPath||'').trim()||!(Number(x.hps)>0)||!(Number(x.qty)>0)||!String(x.unit||'').trim());
      if(invalid)return'Lengkapi kategori, HPS, jumlah, dan satuan pada setiap detail pekerjaan.';
      const totalConstructionHps=constructionHps(c.constructionDetails),constructionBudget=rupBudget(c);
      if(exceedsRupBudget(totalConstructionHps,constructionBudget))return rupBudgetMessage(totalConstructionHps,constructionBudget,'pekerjaan');
      if(!['SINGLE','TERMIN'].includes(String(c.paymentType||'')))return'Pilih tipe pembayaran.';
      if(c.paymentType==='TERMIN'&&!(Number(c.paymentTermsCount)>0))return'Isi jumlah termin.';
    }else{
      if(!(c.qualifications.mikro||c.qualifications.kecil||c.qualifications.menengah||c.qualifications.besar))return'Pilih kualifikasi penyedia.';
      if(!c.category)return'Pilih kategori produk.';
      if(!c.products.length)return'Tambahkan minimal satu detail produk.';
      if(!c.offerType)c.offerType='ITEMIZED';
      const invalidProduct=c.products.find(p=>!(Number(p.hps)>0)||!(Number(p.qty)>0)||!String(p.unit||'').trim());
      if(invalidProduct)return'Lengkapi HPS, jumlah, dan satuan pada setiap detail produk.';
      const totalProductHps=competitionHps(c.products),productBudget=rupBudget(c);
      if(exceedsRupBudget(totalProductHps,productBudget))return rupBudgetMessage(totalProductHps,productBudget,'produk');
    }
    if(!String(c.location||'').trim())return'Isi lokasi pekerjaan.';
    if(!c.completionDate)return'Pilih tanggal penyelesaian pekerjaan.';
    if(c.scheduleEndDate&&c.completionDate<c.scheduleEndDate)return'Tanggal penyelesaian pekerjaan tidak boleh sebelum tanggal berakhir kompetisi.';
    const existing=new Set((c.existingDocs||[]).map(d=>String(d.doc_type)));const missing=createDocTypes.filter(([type])=>!existing.has(type)&&!c.files.has(type));if(missing.length)return`Lengkapi dokumen persiapan: ${missing.map(x=>x[1]).join(', ')}.`;return''
  }
  async function ensureCreateRups(){
    const c=currentCreate();if(c.rupLoaded||c.rupLoading)return;
    const stored=getStoredRupOptions(rupCacheKey('E-Purchasing'));
    if(!stored){c.rupLoading=true;if(state.view==='create-form')renderPreservingPosition();}
    try{
      const data=stored?syncActiveRupOptions(stored.data):await getRupOptions('E-Purchasing');
      if(state.create!==c||state.view!=='create-form')return;
      c.rupItems=Array.isArray(data?.items)?data.items:[];c.rupLoaded=true;
      if(c.rupCode){const hit=c.rupItems.find(x=>String(x.kodeRup)===String(c.rupCode));if(hit)c.rupData=hit;}
      else if(c.rupItems.length===1&&Number(c.rupItems[0].sisaPagu??c.rupItems[0].pagu)>0){c.rupData=c.rupItems[0];c.rupCode=String(c.rupData.kodeRup);c.title=c.rupData.namaPaket||'';}
    }catch(e){flash(apiErr(e),'error')}
    finally{c.rupLoading=false;if(state.create===c&&state.view==='create-form')renderPreservingPosition()}
  }
  function bindCreateRupPicker(c){
    const input=$('#mcRupSearch'),hidden=$('#mcRupSelect'),toggle=$('#mcRupToggle'),options=$('#mcRupOptions'),combo=$('#mcRupCombo');
    if(!input||!hidden||!toggle||!options||!combo)return;
    if(c.postKaji){hidden.value=String(c.rupCode||'');return;}
    const rows=availableCreateRups(c),norm=v=>String(v||'').toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/\s+/g,' ').trim();
    const selectedText=()=>c.rupData&&c.rupCode?`${c.rupData.kodeRup} · ${c.rupData.namaPaket||'Tanpa nama paket'} · ${fmtRp(c.rupData.pagu||0)}`:'';
    const matching=query=>{const q=norm(query);if(!q)return rows;return rows.filter(x=>norm(`${x.kodeRup} ${x.namaPaket||''} ${x.program||''} ${x.kegiatan||''} ${x.subKegiatan||''} ${x.pagu||''}`).includes(q));};
    const close=()=>{options.hidden=true;toggle.setAttribute('aria-expanded','false')};
    const renderOptions=(query='')=>{const hits=matching(query);options.innerHTML=hits.length?hits.map(x=>`<button type="button" class="sel-rup-option" data-mc-rup="${esc(x.kodeRup)}"><strong>${esc(x.kodeRup)}</strong><span>${esc(x.namaPaket||'Tanpa nama paket')}</span><small>${fmtRp(x.pagu||0)}</small></button>`).join(''):'<div class="sel-rup-empty">RUP tidak ditemukan.</div>';$$('[data-mc-rup]',options).forEach(btn=>btn.addEventListener('click',()=>{const item=rows.find(x=>String(x.kodeRup)===String(btn.dataset.mcRup));if(!item)return;c.rupCode=String(item.kodeRup||'');c.rupData=item;c.title=item.namaPaket||'';c.dirty=true;hidden.value=c.rupCode;input.value=selectedText();close();renderPreservingPosition()}));};
    const open=(query='')=>{renderOptions(query);options.hidden=false;toggle.setAttribute('aria-expanded','true')};
    input.addEventListener('focus',()=>open(''));
    input.addEventListener('input',()=>{const keep=selectedText();if(input.value!==keep){c.rupCode='';c.rupData=null;c.title='';hidden.value='';const title=$('#mcTitle');if(title)title.value='';$('.sel-mc-rup-preview')?.remove()}open(input.value)});
    input.addEventListener('keydown',e=>{if(e.key==='Escape'){close();input.blur();return}if(e.key==='Enter'){e.preventDefault();const hits=matching(input.value);if(hits.length===1){const item=hits[0];c.rupCode=String(item.kodeRup||'');c.rupData=item;c.title=item.namaPaket||'';c.dirty=true;hidden.value=c.rupCode;input.value=selectedText();close();renderPreservingPosition()}else open(input.value)}});
    toggle.addEventListener('click',()=>{if(options.hidden)open('');else close();input.focus({preventScroll:true})});
    combo.addEventListener('focusout',()=>setTimeout(()=>{if(!combo.contains(document.activeElement))close()},0));
  }
  function constructionHps(items){return (items||[]).reduce((sum,item)=>sum+(Number(item?.totalPrice)||((Number(item?.hps)||0)*(Number(item?.qty)||0))||0),0)}
  function constructionSummary(item,index){
    const total=Number(item?.totalPrice)||((Number(item?.hps)||0)*(Number(item?.qty)||0))||0;
    const qtyText=new Intl.NumberFormat('id-ID',{maximumFractionDigits:2}).format(Number(item?.qty)||0);
    const fields=[
      ['Kategori',item?.categoryPath||'—'],['KBLI',item?.kbli||'—'],['Daftar Produk Sektoral',item?.sectoralProduct||'—'],['Nama Pekerjaan',item?.name||'—'],
      ['Satuan Pengukuran',item?.measurementUnit||'—'],['Kode Produk',item?.productCode||'—'],['Lingkup Kegiatan',item?.activityScope||'—'],
      ['Lokasi Layanan (Kecamatan)',item?.serviceLocation||'—'],['Sertifikat Badan Usaha (SBU) Konstruksi',item?.sbu||'—'],
      ['Masa Berlaku Sertifikat Badan Usaha (SBU) Konstruksi',item?.sbuValidity||'—'],['Sertifikat Standar',item?.standardCertificate||'—'],
      ['Komponen Struktur Biaya Tayang',item?.costStructureComponent||'—'],['Informasi Lainnya',item?.otherInfo||'—'],
      ['Spesifikasi Tambahan',item?.extraSpecification||'—'],['Jumlah',qtyText],['Satuan',item?.unit||'—'],
      ['HPS Pekerjaan',fullRp(item?.hps||0)],['Total HPS Pekerjaan',fullRp(total)]
    ];
    addInaprocExtraSummary(fields,item);
    const filled=fields.filter(([label,val])=>!(['Daftar Produk Sektoral','Nama Pekerjaan','Satuan Pengukuran','Kode Produk','Lingkup Kegiatan','Lokasi Layanan (Kecamatan)','Sertifikat Badan Usaha (SBU) Konstruksi','Masa Berlaku Sertifikat Badan Usaha (SBU) Konstruksi','Sertifikat Standar','Komponen Struktur Biaya Tayang','Informasi Lainnya','Spesifikasi Tambahan'].includes(label)&&(!val||val==='—')));
    return `<article class="sel-product-card sel-construction-card"><header><b>Pekerjaan ${index+1}</b><div><button type="button" class="sel-product-edit" data-edit-construction="${index}">Ubah</button><button type="button" class="sel-product-trash" data-delete-construction="${index}" aria-label="Hapus Pekerjaan ${index+1}" title="Hapus"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 3h6l1 2h4v2H4V5h4l1-2Zm-2 6h10l-1 11H8L7 9Zm3 2v7h2v-7h-2Zm4 0v7h2v-7h-2Z"/></svg></button></div></header><div class="sel-product-summary-grid">${filled.map(([label,val])=>`<span>${esc(label)}</span><b>${esc(val||val===0?val:'—')}</b>`).join('')}</div></article>`;
  }
  async function constructionCategoryDialog(index=-1,item={},preset={}){
    let rows=[];
    const timer=setTimeout(()=>modal(`<div class="sel-dialog-head"><div><h4>Tambah Detail Pekerjaan</h4><p>Menyiapkan kategori pekerjaan…</p></div><button class="sel-dialog-close" data-close-sel-modal>×</button></div><div class="sel-category-loading"><span class="sel-category-loading-bar"></span><b>Menyiapkan kategori</b><small>Mohon tunggu sebentar.</small></div>`),120);
    try{rows=await ensureConstructionCategories()}catch(e){clearTimeout(timer);flash(apiErr(e),'error');$('#selModal')?.classList.remove('open');return}
    clearTimeout(timer);
    if(!rows.length){flash('Kategori konstruksi belum tersedia di sheet PBJ_KATEGORI_KONSTRUKSI.','error');$('#selModal')?.classList.remove('open');return}
    const norm=v=>String(v||'').toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/\s+/g,' ').trim(),uniq=a=>[...new Set(a.filter(Boolean))];
    const current=rows.find(r=>String(r.id)===String(item?.categoryId||''))||rows.find(r=>String(r.path)===String(item?.categoryPath||''))||null;
    const firstRoot=uniq(rows.map(r=>r.level1))[0]||'';
    const selected={level1:preset.level1||current?.level1||item?.rootCategory||firstRoot,level2:preset.level2||current?.level2||item?.level2||'',level3:preset.level3||current?.level3||item?.level3||''};
    const renderPicker=(query='')=>{
      const q=norm(query),matches=r=>!q||[r.level1,r.level2,r.level3,r.path].some(v=>norm(v).includes(q));
      const visible=rows.filter(matches),roots=uniq((q?visible:rows).map(r=>r.level1));
      if(!roots.includes(selected.level1))selected.level1=roots[0]||firstRoot;
      const rootRows=rows.filter(r=>r.level1===selected.level1),visibleRoot=q?rootRows.filter(matches):rootRows;
      const groups=uniq(visibleRoot.map(r=>r.level2));
      if(!groups.includes(selected.level2))selected.level2=groups[0]||uniq(rootRows.map(r=>r.level2))[0]||'';
      const groupRows=rootRows.filter(r=>r.level2===selected.level2),visibleGroup=q?groupRows.filter(matches):groupRows;
      const leaves=uniq(visibleGroup.map(r=>r.level3));
      if(selected.level3&&!leaves.includes(selected.level3))selected.level3='';
      const chosen=groupRows.find(r=>r.level3===selected.level3)||null;
      const breadcrumb=[selected.level1,selected.level2,selected.level3].filter(Boolean).join(' > ');
      modal(`<div class="sel-health-picker sel-construction-picker"><div class="sel-dialog-head"><div><h4>Tambah Detail Pekerjaan</h4><p>Pilih kategori pekerjaan yang dapat mengikuti kompetisi.</p></div><button class="sel-dialog-close" data-close-sel-modal>×</button></div><label class="sel-health-search"><span aria-hidden="true">⌕</span><input id="constructionCatSearch" type="search" value="${esc(query)}" placeholder="Cari kategori di sini" autocomplete="off"></label><b class="sel-health-label">Pilih Kategori</b><div class="sel-health-breadcrumb">${esc(breadcrumb||'Pilih kategori pekerjaan')}</div><div class="sel-health-columns"><div class="sel-health-col">${roots.map(root=>`<button type="button" class="${root===selected.level1?'active':''}" data-construction-cat-root="${esc(root)}">${esc(root)} <span>›</span></button>`).join('')||'<div class="sel-health-empty">Kategori tidak ditemukan.</div>'}</div><div class="sel-health-col">${groups.map(group=>`<button type="button" class="${group===selected.level2?'active':''}" data-construction-cat-group="${esc(group)}">${esc(group)} <span>›</span></button>`).join('')||'<div class="sel-health-empty">Pilih kategori tingkat pertama.</div>'}</div><div class="sel-health-col">${leaves.map(leaf=>`<button type="button" class="${leaf===selected.level3?'active':''}" data-construction-cat-leaf="${esc(leaf)}">${esc(leaf)}</button>`).join('')||'<div class="sel-health-empty">Tidak ada pilihan.</div>'}</div></div><div class="sel-health-footer"><span>${chosen?'Kategori siap dipakai.':'Pilih kategori sampai tingkat akhir.'}</span><button type="button" class="sel-primary" data-construction-next ${chosen?'':'disabled'}>Selanjutnya</button></div></div>`);
      const search=$('#constructionCatSearch');
      if(search){search.focus({preventScroll:true});search.setSelectionRange?.(search.value.length,search.value.length);search.addEventListener('input',e=>{clearTimeout(constructionCategoryDialog._t);constructionCategoryDialog._t=setTimeout(()=>renderPicker(e.target.value),80)})}
      $$('[data-construction-cat-root]').forEach(b=>b.addEventListener('click',()=>{selected.level1=b.dataset.constructionCatRoot;selected.level2='';selected.level3='';renderPicker(search?.value||'')}));
      $$('[data-construction-cat-group]').forEach(b=>b.addEventListener('click',()=>{selected.level2=b.dataset.constructionCatGroup;selected.level3='';renderPicker(search?.value||'')}));
      $$('[data-construction-cat-leaf]').forEach(b=>b.addEventListener('click',()=>{selected.level3=b.dataset.constructionCatLeaf;renderPicker(search?.value||'')}));
      $('[data-construction-next]')?.addEventListener('click',()=>{const row=rows.find(r=>r.level1===selected.level1&&r.level2===selected.level2&&r.level3===selected.level3);if(row)constructionFieldsDialog(index,item,row)});
    };
    renderPicker('');
  }
  // v28.12: dynamic INAPROC metadata is static, sharded, loaded ONLY on selecting a detail.
  // Existing detail fields, server schema, budget logic, and historical draft keys remain intact.
  const inaprocLegacyProps={
    'Kode KFA':'kfa','Spesifikasi Produk':'specification','Nomor Izin Edar (NIE)':'nie','Masa Berlaku NIE':'nieValidity',
    'Daftar Distributor yang Ditunjuk':'distributor','Izin Distribusi Alat Kesehatan':'distributionPermit',
    'Sertifikat Cara Pembuatan Alat Kesehatan yang Baik Yang Masih Berlaku':'goodManufacturing',
    'Sertifikat Cara Distribusi Alat Kesehatan Yang Baik Yang Masih Berlaku':'goodDistribution',
    'Sertifikat Alat Telekomunikasi dan/atau Perangkat Telekomunikasi':'telecomCertificate',
    'Sertifikat Izin Pemanfaatan Sumber Radiasi Pengion (SRP)':'radiationPermit',
    'Hasil Pengujian Post Market':'postMarket','Pemberitahuan Import Barang (PIB)':'pib','BMHP':'bmhp',
    'Garansi':'warranty','Surat Ketersediaan Layanan Purna Jual dan Spare Part':'afterSales','Struktur Harga':'priceStructure',
    'Informasi Lainnya':'otherInfo','Label Produk Ramah Lingkungan Hidup':'ecoLabel',
    'Satuan Pengukuran':'measurementUnit','Kode Produk':'productCode','Lingkup Kegiatan':'activityScope',
    'Lokasi Layanan (Kecamatan)':'serviceLocation','Sertifikat Badan Usaha (SBU) Konstruksi':'sbu',
    'Masa Berlaku Sertifikat Badan Usaha (SBU) Konstruksi':'sbuValidity','Sertifikat Standar':'standardCertificate',
    'Komponen Struktur Biaya Tayang':'costStructureComponent'
  };
  const inaprocLegacyIds={
    kfa:'pdKfa',specification:'pdSpecification',nie:'pdNie',nieValidity:'pdNieValidity',distributor:'pdDistributor',
    distributionPermit:'pdDistributionPermit',goodManufacturing:'pdGoodManufacturing',goodDistribution:'pdGoodDistribution',
    telecomCertificate:'pdTelecomCertificate',radiationPermit:'pdRadiationPermit',postMarket:'pdPostMarket',pib:'pdPib',
    bmhp:'pdBmhp',warranty:'pdWarranty',afterSales:'pdAfterSales',priceStructure:'pdPriceStructure',otherInfo:'pdOtherInfo',ecoLabel:'pdEcoLabel',
    measurementUnit:'cdMeasurementUnit',productCode:'cdProductCode',activityScope:'cdActivityScope',serviceLocation:'cdServiceLocation',
    sbu:'cdSbu',sbuValidity:'cdSbuValidity',standardCertificate:'cdStandardCertificate',costStructureComponent:'cdCostStructureComponent'
  };
  function savedInaprocEntries(item){
    const vals=item?.categoryFieldValues;
    return Array.isArray(vals)?vals.filter(x=>x&&typeof x==='object'&&x.id&&x.name):[];
  }
  function readInaprocInputs(original={}){
    const fields=$$('[data-inaproc-field-id]',$('#selModal')||document);
    if(!fields.length)return savedInaprocEntries(original);
    return fields.map(el=>({id:el.dataset.inaprocFieldId,name:el.dataset.inaprocFieldName,value:String(el.value||'')}));
  }
  function inaprocExtraSummary(item){return savedInaprocEntries(item).filter(x=>String(x.value||'').trim()).map(x=>[String(x.name),String(x.value)]);}
  function addInaprocExtraSummary(fields,item){
    const exists=new Set(fields.map(([name])=>String(name).toLowerCase()));
    for(const pair of inaprocExtraSummary(item))if(!exists.has(pair[0].toLowerCase())){fields.push(pair);exists.add(pair[0].toLowerCase())}
    return fields;
  }
  function renderInaprocInputs(entries,item,kind){
    const known=new Map(savedInaprocEntries(item).map(x=>[String(x.id),String(x.value??'')]));
    return (entries||[]).map(([fid,name,type,defaults])=>{
      if(!fid||!name)return'';
      const prop=inaprocLegacyProps[name],legacy=prop?item?.[prop]:undefined;
      const raw=known.has(fid)?known.get(fid):(legacy??((name==='Spesifikasi Produk')?(item?.spec||''):''));
      const value=String(raw??'');
      const oldId=inaprocLegacyIds[prop]||'';
      const id=oldId&&((kind==='construction')===oldId.startsWith('cd'))?oldId:'inaproc_'+fid.replace(/[^a-zA-Z0-9]/g,'');
      const attrs=`id="${esc(id)}" data-inaproc-field-id="${esc(fid)}" data-inaproc-field-name="${esc(name)}"`;
      const options=String(defaults||'').split(',').map(x=>x.trim()).filter(Boolean);
      let input='';
      if(type==='CHECKBOX'){
        const listId=id+'Choices';
        input=`<input ${attrs} class="sel-detail-choice" list="${esc(listId)}" value="${esc(value)}" placeholder="Pilih ${esc(name)}" autocomplete="off"><datalist id="${esc(listId)}">${[...new Set(options)].map(x=>`<option value="${esc(x)}"></option>`).join('')}</datalist>`;
      }else if(type==='DATE'){
        const ymd=/^\d{4}-\d{2}-\d{2}$/.test(value)?value:'';
        input=`<input ${attrs} type="date" value="${esc(ymd)}" title="${esc(name)}">`;
      }else{
        input=`<input ${attrs} type="text" value="${esc(value)}" placeholder="Masukkan ${esc(name)}">`;
      }
      return `<label class="sel-detail-field"><span>${esc(name)} <em>Tidak Wajib</em></span>${input}</label>`;
    }).join('');
  }
  const inaprocSchemaFailed=new Set();
  function waitForInaprocSchema(id,resume){
    id=String(id||'').trim();const store=window.ORBITA_INAPROC_FIELDS;
    if(!id||!store?.get||store.isLoaded?.(id)||inaprocSchemaFailed.has(id))return false;
    modal(`<div class="sel-dialog-head"><div><h4>Menyiapkan Detail Kategori</h4><p>Memuat field kategori terpilih…</p></div><button class="sel-dialog-close" data-close-sel-modal>×</button></div><div class="sel-category-loading"><span class="sel-category-loading-bar"></span><b>Menyiapkan field</b><small>Data kategori hanya dimuat saat diperlukan.</small></div>`);
    const overlay=$('#selModal'),expected=overlay?.querySelector('.sel-dialog');
    store.get(id).catch(()=>{inaprocSchemaFailed.add(id)}).finally(()=>{
      if(overlay?.classList.contains('open')&&overlay.querySelector('.sel-dialog')===expected)resume();
    });
    return true;
  }
  function syncInaprocForm(categoryId,item={},kind='generic'){
    const id=String(categoryId||'').trim(),api=window.ORBITA_INAPROC_FIELDS;
    if(!id||!api?.get)return;
    const overlay=$('#selModal'),dialog=overlay?.querySelector('.sel-dialog');
    if(!dialog)return;
    api.get(id).then(schema=>{
      if(!schema||!overlay?.classList.contains('open')||overlay.querySelector('.sel-dialog')!==dialog)return;
      const primary=renderInaprocInputs(schema.p,item,kind),additional=renderInaprocInputs(schema.a,item,kind);
      if(kind==='construction'){
        const sections=$$('.sel-construction-field-section',dialog);
        if(sections.length<3)return;
        sections[1].innerHTML='<h5>Informasi Utama</h5>'+primary;
        const extra=sections[2].querySelector('#cdExtraSpecification')?.value??item?.extraSpecification??'';
        sections[2].innerHTML='<h5>Informasi Lainnya</h5>'+additional+
          `<label class="sel-detail-field"><span>Spesifikasi Tambahan <em>Tidak Wajib</em></span><textarea id="cdExtraSpecification" placeholder="Masukkan Spesifikasi Tambahan">${esc(extra)}</textarea><small>Isi spesifikasi tambahan jika diperlukan.</small></label>`;
      }else if(kind==='health'){
        const fields=$('.sel-product-fields',dialog);if(!fields)return;
        fields.innerHTML=primary+additional+
          `<label class="sel-detail-field"><span>Spesifikasi Tambahan <em>Tidak Wajib</em></span><textarea id="pdExtraSpecification" placeholder="Masukkan Spesifikasi Tambahan">${esc(item?.extraSpecification||'')}</textarea></label>`;
      }else{
        // Keep INAPROC category fields above HPS, quantity and unit.
        // Same inputs / IDs / save handler, only the insertion position changes.
        const priceField=$('#pdHps',dialog)?.closest('.sel-field');
        if(!priceField?.closest('.sel-product-basic-grid'))return;
        const block=document.createElement('div');block.className='sel-product-fields sel-inaproc-extra wide';
        block.innerHTML=primary+additional;
        // Field kategori muncul lebih dulu; spesifikasi tambahan menjadi bagian terakhir sebelum HPS.
        // Tetap ringan: satu sisipan DOM, tanpa request API tambahan.
        const specificationField=$('#pdSpec',dialog)?.closest('.sel-field');
        (specificationField||priceField).before(block);
      }
    }).catch(()=>{/* Offline or older publication: preserve baseline form without blocking the user. */});
  }
  function constructionFieldsDialog(index,item={},category={}){
    if(waitForInaprocSchema(category.id||item?.categoryId,()=>constructionFieldsDialog(index,item,category)))return;
    const c=currentCreate(),path=category.path||item.categoryPath||[category.level1,category.level2,category.level3].filter(Boolean).join(' > '),sectoral=constructionSectoralByPath[path]||[];
    const categoryRefPromise=category.id?ensureCategoryReference(category.id):Promise.resolve(null);
    const qty=Number(item?.qty)>0?Number(item.qty):0.01;
    const opt=(values,current,placeholder)=>selectOptions(values,current,placeholder);
    modal(`<div class="sel-construction-detail"><div class="sel-dialog-head"><div><h4>${index>=0?'Ubah':'Tambah'} Detail Pekerjaan</h4><p>Tambah detail pekerjaan yang bisa mengikuti kompetisi.</p></div><button class="sel-dialog-close" data-close-sel-modal>×</button></div><div class="sel-product-category-path"><b>${esc(path)}</b><button type="button" data-construction-category-back>Ubah Kategori</button></div><small class="sel-product-kind-note">Kategori ini termasuk jenis Produk/Jasa</small>
      <section class="sel-construction-field-section"><h5>Informasi Umum</h5><label class="sel-detail-field"><span>Daftar Produk Sektoral <em>Tidak Wajib</em></span>${editableDetailChoice('cdSectoral',sectoral,item?.sectoralProduct,'Pilih produk sektoral')}</label><label class="sel-detail-field"><span>Nama Pekerjaan <em>Tidak Wajib</em></span><input id="cdName" value="${esc(item?.name||'')}" placeholder="contoh: Pemasangan Lift Kantor"></label></section>
      <section class="sel-construction-field-section"><h5>Informasi Utama</h5>
        <label class="sel-detail-field"><span>Satuan Pengukuran <em>Tidak Wajib</em></span>${editableDetailChoice('cdMeasurementUnit',constructionMeasurementUnits,item?.measurementUnit,'Pilih Satuan Pengukuran')}</label>
        <label class="sel-detail-field"><span>Kode Produk <em>Tidak Wajib</em></span><input id="cdProductCode" value="${esc(item?.productCode||'')}" placeholder="Masukkan Kode Produk"></label>
        <label class="sel-detail-field"><span>Lingkup Kegiatan <em>Tidak Wajib</em></span><input id="cdActivityScope" value="${esc(item?.activityScope||'')}" placeholder="Masukkan Lingkup Kegiatan"></label>
        <label class="sel-detail-field"><span>Lokasi Layanan (Kecamatan) <em>Tidak Wajib</em></span><input id="cdServiceLocation" value="${esc(item?.serviceLocation||'')}" placeholder="Masukkan Lokasi Layanan (Kecamatan)"></label>
        <label class="sel-detail-field"><span>Sertifikat Badan Usaha (SBU) Konstruksi <em>Tidak Wajib</em></span>${editableDetailChoice('cdSbu',constructionPresenceOptions,item?.sbu,'Pilih Sertifikat Badan Usaha (SBU) Konstruksi')}</label>
        <label class="sel-detail-field"><span>Masa Berlaku Sertifikat Badan Usaha (SBU) Konstruksi <em>Tidak Wajib</em></span><input id="cdSbuValidity" value="${esc(item?.sbuValidity||'')}" placeholder="Masukkan Masa Berlaku Sertifikat Badan Usaha (SBU) Konstruksi"></label>
        <label class="sel-detail-field"><span>Sertifikat Standar <em>Tidak Wajib</em></span>${editableDetailChoice('cdStandardCertificate',constructionPresenceOptions,item?.standardCertificate,'Pilih Sertifikat Standar')}</label>
        <label class="sel-detail-field"><span>Komponen Struktur Biaya Tayang <em>Tidak Wajib</em></span><input id="cdCostStructureComponent" value="${esc(item?.costStructureComponent||'')}" placeholder="Masukkan Komponen Struktur Biaya Tayang"></label>
      </section>
      <section class="sel-construction-field-section"><h5>Informasi Lainnya</h5>
        <label class="sel-detail-field"><span>Informasi Lainnya <em>Tidak Wajib</em></span><input id="cdOtherInfo" value="${esc(item?.otherInfo||'')}" placeholder="Masukkan Informasi Lainnya"></label>
        <label class="sel-detail-field"><span>Spesifikasi Tambahan <em>Tidak Wajib</em></span><textarea id="cdExtraSpecification" placeholder="Masukkan Spesifikasi Tambahan">${esc(item?.extraSpecification||'')}</textarea><small>Isi spesifikasi tambahan jika diperlukan.</small></label>
      </section>
      <div class="sel-product-price-grid"><label><span>HPS Pekerjaan</span><div class="sel-money-input"><i>Rp</i><input id="cdHps" inputmode="numeric" autocomplete="off" value="${esc(currencyDisplay(item?.hps||''))}" placeholder="Masukan Harga"></div><small>Harga di atas adalah harga sudah termasuk pajak.</small></label><label><span>Jumlah</span><div class="sel-qty-input"><button type="button" data-cd-minus>−</button><input id="cdQty" type="number" min="0.01" step="0.01" value="${esc(qty)}"><button type="button" data-cd-plus>＋</button></div></label><label><span>Satuan</span>${editableDetailChoice('cdUnit',productUnits,item?.unit,'Pilih Satuan')}</label></div><div class="sel-product-total">Total HPS Pekerjaan <b id="cdTotalHps">${fullRp((Number(item?.hps)||0)*qty)}</b></div><div class="sel-product-limit" id="cdBudgetNote"></div><button type="button" class="sel-product-save" data-save-construction disabled>Simpan</button></div>`);
    syncInaprocForm(category.id||item?.categoryId,item,'construction');
    const hps=$('#cdHps'),qtyEl=$('#cdQty'),unit=$('#cdUnit'),name=$('#cdName'),sectoralEl=$('#cdSectoral'),save=$('[data-save-construction]'),total=$('#cdTotalHps'),budgetNote=$('#cdBudgetNote');
    const currentTotal=index>=0?(Number(c.constructionDetails[index]?.totalPrice)||((Number(c.constructionDetails[index]?.hps)||0)*(Number(c.constructionDetails[index]?.qty)||0))||0):0,budget=rupBudget(c);
    const refresh=()=>{const h=Number(currencyDigits(hps?.value)||0),q=Number(qtyEl?.value)||0,nextItemTotal=h*q,nextTotal=Math.max(0,constructionHps(c.constructionDetails)-currentTotal+nextItemTotal),over=exceedsRupBudget(nextTotal,budget);if(total)total.textContent=fullRp(nextItemTotal);if(budgetNote){budgetNote.textContent=over?rupBudgetMessage(nextTotal,budget,'pekerjaan'):budget?`Sisa pagu RUP ${fullRp(Math.max(0,budget-nextTotal))}.`:'';budgetNote.classList.toggle('is-error',over)}if(save)save.disabled=!(h>0&&q>0&&String(unit?.value||'').trim()&&!over)};
    hps?.addEventListener('input',()=>{hps.value=currencyDisplay(hps.value);try{hps.setSelectionRange(hps.value.length,hps.value.length)}catch(_){}refresh()});
    qtyEl?.addEventListener('input',refresh);unit?.addEventListener('input',refresh);name?.addEventListener('input',refresh);sectoralEl?.addEventListener('input',refresh);
    $('[data-cd-minus]')?.addEventListener('click',()=>{qtyEl.value=String(Math.max(.01,Math.round(((Number(qtyEl.value)||.01)-.01)*100)/100));refresh()});
    $('[data-cd-plus]')?.addEventListener('click',()=>{qtyEl.value=String(Math.round(((Number(qtyEl.value)||0)+.01)*100)/100);refresh()});
    $('[data-construction-category-back]')?.addEventListener('click',()=>constructionCategoryDialog(index,item,{level1:category.level1||item.rootCategory||'',level2:category.level2||item.level2||'',level3:category.level3||item.level3||''}));
    save?.addEventListener('click',async()=>{
      refresh();if(save.disabled)return;
      const ref=categoryReferenceCache.get(String(category.id||item.categoryId||''))||await categoryRefPromise;
      const h=Number(currencyDigits(hps?.value)||0),q=Number(qtyEl?.value)||0,next={
        categoryId:category.id||item.categoryId||'',rootCategory:category.level1||item.rootCategory||'',level2:category.level2||item.level2||'',level3:category.level3||item.level3||'',categoryPath:path,
        productType:category.productType||item.productType||'',productSubType:category.productSubType||item.productSubType||'',kbli:ref?.kbliText||item.kbli||'',
        sectoralProduct:sectoralEl?.value||'',name:name?.value.trim()||'',measurementUnit:$('#cdMeasurementUnit')?.value||'',productCode:$('#cdProductCode')?.value.trim()||'',
        activityScope:$('#cdActivityScope')?.value.trim()||'',serviceLocation:$('#cdServiceLocation')?.value.trim()||'',sbu:$('#cdSbu')?.value||'',sbuValidity:$('#cdSbuValidity')?.value.trim()||'',
        standardCertificate:$('#cdStandardCertificate')?.value||'',costStructureComponent:$('#cdCostStructureComponent')?.value.trim()||'',otherInfo:$('#cdOtherInfo')?.value.trim()||'',
        extraSpecification:$('#cdExtraSpecification')?.value.trim()||'',categoryFieldValues:readInaprocInputs(item),hps:h,unitPrice:h,qty:q,unit:unit?.value||'',totalPrice:h*q
      };
      if(index>=0)c.constructionDetails[index]=next;else c.constructionDetails.push(next);c.dirty=true;$('#selModal').classList.remove('open');renderPreservingPosition();
    });
    refresh();
  }
  function readDetailedProductDialog(c,base={}){
    const hps=$('#pdHps'),qty=$('#pdQty'),unit=$('#pdUnit');
    const price=Number(currencyDigits(hps?.value)||0),count=Number(qty?.value)||0;
    return {...base,category:c.category,categoryFieldValues:readInaprocInputs(base),kfa:$('#pdKfa')?.value.trim()||'',specification:$('#pdSpecification')?.value.trim()||'',spec:$('#pdSpecification')?.value.trim()||'',nie:$('#pdNie')?.value.trim()||'',nieValidity:$('#pdNieValidity')?.value.trim()||'',nieExpiry:$('#pdNieValidity')?.value.trim()||'',distributor:$('#pdDistributor')?.value||'',distributionPermit:$('#pdDistributionPermit')?.value||'',goodManufacturing:$('#pdGoodManufacturing')?.value||'',goodDistribution:$('#pdGoodDistribution')?.value||'',telecomCertificate:$('#pdTelecomCertificate')?.value.trim()||'',radiationPermit:$('#pdRadiationPermit')?.value.trim()||'',postMarket:$('#pdPostMarket')?.value||'',pib:$('#pdPib')?.value||'',bmhp:$('#pdBmhp')?.value||'',warranty:$('#pdWarranty')?.value||'',afterSales:$('#pdAfterSales')?.value||'',priceStructure:$('#pdPriceStructure')?.value||'',otherInfo:$('#pdOtherInfo')?.value.trim()||'',ecoLabel:$('#pdEcoLabel')?.value.trim()||'',extraSpecification:$('#pdExtraSpecification')?.value.trim()||'',hps:price,unitPrice:price,qty:count,unit:unit?.value||'',totalPrice:price*count};
  }
  function productFieldsDialog(c,index,item,categoryPath){
    const lookupId=Array.isArray(categoryPath)?String(item?.categoryId||''):String(categoryPath?.id||item?.categoryId||'');
    if(waitForInaprocSchema(lookupId,()=>productFieldsDialog(c,index,item,categoryPath)))return;
    const isHealth=c.category==='Alat Kesehatan',isBarang=c.category==='Barang',detailed=isHealth||isBarang;
    const meta=Array.isArray(categoryPath)?{level1:categoryPath[0]||'',level2:categoryPath[1]||'',level3:categoryPath[2]||''}:{...(categoryPath||{})};
    const rootCategory=meta.level1||item?.rootCategory||'',level2=meta.level2||item?.level2||'',level3=meta.level3||item?.level3||'';
    const categoryId=meta.id||item?.categoryId||'',productType=meta.productType||item?.productType||'',productSubType=meta.productSubType||item?.productSubType||'';
    const categoryRefPromise=categoryId?ensureCategoryReference(categoryId):Promise.resolve(null);
    const path=meta.path||item?.categoryPath||[c.category,(rootCategory&&rootCategory!==c.category)?rootCategory:'',level2,level3].filter(Boolean).join(' > ');
    if(!detailed){
      // Nama detail disimpan untuk kompatibilitas draft dan rekap, tanpa menambah input di popup.
      // Saat kategori diganti, gunakan nama kategori baru; saat mengedit kategori yang sama, pertahankan nama lama.
      const sameCategory=!!categoryId&&String(item?.categoryId||'')===String(categoryId) || (!item?.categoryId&&!!item?.level3&&item.level3===level3);
      const detailName=String((sameCategory&&item?.name)||level3||item?.name||c.category).trim();
      const genericQty=Number(item?.qty)>0?Number(item.qty):1;
      modal(`<div class="sel-dialog-head"><div><small>${esc(String(c.category||'').toUpperCase())}</small><h4>${index>=0?'Ubah':'Tambah'} Detail Produk</h4></div><button class="sel-dialog-close" data-close-sel-modal>×</button></div><div class="sel-product-category-path"><b>${esc(path)}</b><button type="button" data-product-category-back>Ubah Kategori</button></div><div class="sel-form-grid sel-product-basic-grid"><label class="sel-field sel-detail-field wide"><span>Spesifikasi Tambahan <em>Tidak Wajib</em></span><textarea id="pdSpec" placeholder="Masukkan Spesifikasi Tambahan">${esc(item?.extraSpecification||item?.spec||item?.specification||'')}</textarea></label><label class="sel-field"><span>HARGA SATUAN</span><div class="sel-money-input"><i>Rp</i><input id="pdHps" inputmode="numeric" autocomplete="off" value="${esc(currencyDisplay(item?.unitPrice||item?.hps||''))}" placeholder="Masukan Harga"></div></label><label class="sel-field"><span>KUANTITAS</span><input id="pdQty" type="number" min="1" step="1" value="${esc(genericQty)}" placeholder="1"></label><label class="sel-field"><span>SATUAN</span>${editableDetailChoice('pdUnit',productUnits,item?.unit,'Pilih Satuan')}</label><div class="sel-product-total wide">Total HPS Produk <b id="pdTotalHps">${fullRp((Number(item?.unitPrice||item?.hps)||0)*genericQty)}</b></div><div class="sel-product-limit wide" id="pdBudgetNote"></div></div><div class="sel-form-actions"><button class="sel-ghost" data-close-sel-modal>Batal</button><button class="sel-primary" data-save-product disabled>Simpan Detail</button></div>`);
      syncInaprocForm(categoryId,item,'generic');
      const ghps=$('#pdHps'),gqty=$('#pdQty'),gunit=$('#pdUnit'),gsave=$('[data-save-product]'),gtotal=$('#pdTotalHps'),gbudgetNote=$('#pdBudgetNote');
      const gcurrentTotal=index>=0?productTotal(c.products[index]):0,gbudget=rupBudget(c);
      const grefresh=()=>{const h=Number(currencyDigits(ghps?.value)||0),q=Number(gqty?.value)||0,nextItemTotal=h*q,nextTotal=Math.max(0,competitionHps(c.products)-gcurrentTotal+nextItemTotal),over=exceedsRupBudget(nextTotal,gbudget);if(gtotal)gtotal.textContent=fullRp(nextItemTotal);if(gbudgetNote){gbudgetNote.textContent=over?rupBudgetMessage(nextTotal,gbudget,'produk'):gbudget?`Sisa pagu RUP ${fullRp(Math.max(0,gbudget-nextTotal))}.`:'';gbudgetNote.classList.toggle('is-error',over)}if(gsave)gsave.disabled=!(detailName&&h>0&&q>0&&String(gunit?.value||'').trim()&&!over)};
      ghps?.addEventListener('input',()=>{ghps.value=currencyDisplay(ghps.value);try{ghps.setSelectionRange(ghps.value.length,ghps.value.length)}catch(_){}grefresh()});
      gqty?.addEventListener('input',grefresh);gunit?.addEventListener('input',grefresh);grefresh();
      $('[data-product-category-back]')?.addEventListener('click',()=>productCategoryDialog(index,item,{level1:rootCategory,level2,level3}));
      gsave?.addEventListener('click',async()=>{const h=Number(currencyDigits($('#pdHps')?.value)||0),q=Number($('#pdQty')?.value)||0,nextTotal=Math.max(0,competitionHps(c.products)-gcurrentTotal+(h*q));if(exceedsRupBudget(nextTotal,gbudget)){grefresh();return}const ref=categoryReferenceCache.get(String(categoryId||''))||await categoryRefPromise;const next={name:detailName,desc:detailName,category:c.category,productCategory:c.category,categoryId,rootCategory,level2,level3,categoryPath:path,productType,productSubType,kbli:ref?.kbliText||item?.kbli||'',spec:$('#pdSpec')?.value.trim(),extraSpecification:$('#pdSpec')?.value.trim(),unitPrice:h,hps:h,qty:q,unit:$('#pdUnit')?.value||'',totalPrice:h*q,categoryFieldValues:readInaprocInputs(item)};if(!next.name||!next.unitPrice||!next.qty||!next.unit){grefresh();return}if(index>=0)c.products[index]=next;else c.products.push(next);c.dirty=true;$('#selModal').classList.remove('open');renderPreservingPosition()});
      return;
    }
    const normalized=detailedProductView(item||{}),cur={...normalized,category:c.category,categoryId,rootCategory,level2,level3,categoryPath:path,productType,productSubType};
    const qty=Number(cur.qty)>0?Number(cur.qty):1;
    const opt=(vals,current,placeholder)=>selectOptions(vals,current,placeholder);
    modal(`<div class="sel-health-detail"><div class="sel-dialog-head"><div><h4>${index>=0?'Ubah':'Tambah'} Detail Produk</h4><p>Tambah detail spesifikasi produk yang bisa mengikuti kompetisi.</p></div><button class="sel-dialog-close" data-close-sel-modal>×</button></div><div class="sel-product-category-path"><b>${esc(path)}</b><button type="button" data-product-category-back>Ubah Kategori</button></div><small class="sel-product-kind-note">Kategori ini termasuk jenis Produk Barang</small><div class="sel-product-fields">
      <label class="sel-detail-field"><span>Kode KFA <em>Tidak Wajib</em></span><input id="pdKfa" value="${esc(cur.kfa||'')}" placeholder="Masukkan Kode KFA"></label>
      <label class="sel-detail-field"><span>Spesifikasi Produk <em>Tidak Wajib</em></span><input id="pdSpecification" value="${esc(cur.specification||'')}" placeholder="Masukkan Spesifikasi Produk"></label>
      <label class="sel-detail-field"><span>Nomor Izin Edar (NIE) <em>Tidak Wajib</em></span><input id="pdNie" value="${esc(cur.nie||'')}" placeholder="Masukkan Nomor Izin Edar (NIE)"></label>
      <label class="sel-detail-field"><span>Masa Berlaku NIE <em>Tidak Wajib</em></span><input id="pdNieValidity" value="${esc(cur.nieValidity||'')}" placeholder="Masukkan Masa Berlaku NIE"></label>
      <label class="sel-detail-field"><span>Daftar Distributor yang Ditunjuk <em>Tidak Wajib</em></span>${editableDetailChoice('pdDistributor',['Menunjuk','Tidak Menunjuk'],cur.distributor,'Pilih Daftar Distributor yang Ditunjuk')}</label>
      <label class="sel-detail-field"><span>Izin Distribusi Alat Kesehatan <em>Tidak Wajib</em></span>${editableDetailChoice('pdDistributionPermit',availabilityOptions,cur.distributionPermit,'Pilih Izin Distribusi Alat Kesehatan')}</label>
      <label class="sel-detail-field"><span>Sertifikat Cara Pembuatan Alat Kesehatan yang Baik Yang Masih Berlaku <em>Tidak Wajib</em></span>${editableDetailChoice('pdGoodManufacturing',availabilityOptions,cur.goodManufacturing,'Pilih Sertifikat Cara Pembuatan Alat Kesehatan yang Baik Yang Masih Berlaku')}</label>
      <label class="sel-detail-field"><span>Sertifikat Cara Distribusi Alat Kesehatan Yang Baik Yang Masih Berlaku <em>Tidak Wajib</em></span>${editableDetailChoice('pdGoodDistribution',availabilityOptions,cur.goodDistribution,'Pilih Sertifikat Cara Distribusi Alat Kesehatan Yang Baik Yang Masih Berlaku')}</label>
      <label class="sel-detail-field"><span>Sertifikat Alat Telekomunikasi dan/atau Perangkat Telekomunikasi <em>Tidak Wajib</em></span><input id="pdTelecomCertificate" value="${esc(cur.telecomCertificate||'')}" placeholder="Masukkan Sertifikat Alat Telekomunikasi dan/atau Perangkat Telekomunikasi"></label>
      <label class="sel-detail-field"><span>Sertifikat Izin Pemanfaatan Sumber Radiasi Pengion (SRP) <em>Tidak Wajib</em></span><input id="pdRadiationPermit" value="${esc(cur.radiationPermit||'')}" placeholder="Masukkan Sertifikat Izin Pemanfaatan Sumber Radiasi Pengion (SRP)"></label>
      <label class="sel-detail-field"><span>Hasil Pengujian Post Market <em>Tidak Wajib</em></span>${editableDetailChoice('pdPostMarket',adaOptions,cur.postMarket,'Pilih Hasil Pengujian Post Market')}</label>
      <label class="sel-detail-field"><span>Pemberitahuan Import Barang (PIB) <em>Tidak Wajib</em></span>${editableDetailChoice('pdPib',adaOptions,cur.pib,'Pilih Pemberitahuan Import Barang (PIB)')}</label>
      <label class="sel-detail-field"><span>BMHP <em>Tidak Wajib</em></span>${editableDetailChoice('pdBmhp',yesNoOptions,cur.bmhp,'Pilih BMHP')}</label>
      <label class="sel-detail-field"><span>Garansi <em>Tidak Wajib</em></span>${editableDetailChoice('pdWarranty',warrantyOptions,cur.warranty,'Pilih Garansi')}</label>
      <label class="sel-detail-field"><span>Surat Ketersediaan Layanan Purna Jual dan Spare Part <em>Tidak Wajib</em></span>${editableDetailChoice('pdAfterSales',warrantyOptions,cur.afterSales,'Pilih Surat Ketersediaan Layanan Purna Jual dan Spare Part')}</label>
      <label class="sel-detail-field"><span>Struktur Harga <em>Tidak Wajib</em></span>${editableDetailChoice('pdPriceStructure',availabilityOptions,cur.priceStructure,'Pilih Struktur Harga')}</label>
      <label class="sel-detail-field"><span>Informasi Lainnya <em>Tidak Wajib</em></span><input id="pdOtherInfo" value="${esc(cur.otherInfo||'')}" placeholder="Masukkan Informasi Lainnya"></label>
      <label class="sel-detail-field"><span>Label Produk Ramah Lingkungan Hidup <em>Tidak Wajib</em></span><input id="pdEcoLabel" value="${esc(cur.ecoLabel||'')}" placeholder="Masukkan Label Produk Ramah Lingkungan Hidup"></label>
      <label class="sel-detail-field"><span>Spesifikasi Tambahan <em>Tidak Wajib</em></span><textarea id="pdExtraSpecification" placeholder="Masukkan Spesifikasi Tambahan">${esc(cur.extraSpecification||'')}</textarea><small>Isi layanan tambahan yang dibutuhkan pada spesifikasi tambahan jika diperlukan.</small></label>
    </div><div class="sel-product-price-grid"><label><span>HPS Produk</span><div class="sel-money-input"><i>Rp</i><input id="pdHps" inputmode="numeric" autocomplete="off" value="${esc(currencyDisplay(cur.hps||''))}" placeholder="Masukan Harga"></div><small>Harga di atas adalah harga per produk</small></label><label><span>Jumlah</span><div class="sel-qty-input"><button type="button" data-qty-minus>−</button><input id="pdQty" type="number" min="1" step="1" value="${esc(qty)}"><button type="button" data-qty-plus>＋</button></div></label><label><span>Satuan</span>${editableDetailChoice('pdUnit',productUnits,cur.unit,'Pilih Satuan')}</label></div><div class="sel-product-total">Total HPS Produk <b id="pdTotalHps">${fullRp((Number(cur.hps)||0)*qty)}</b></div><div class="sel-product-limit" id="pdBudgetNote"></div><button type="button" class="sel-product-save" data-save-product disabled>Simpan</button></div>`);
    syncInaprocForm(categoryId,cur,'health');
    const hps=$('#pdHps'),qtyEl=$('#pdQty'),unit=$('#pdUnit'),save=$('[data-save-product]'),total=$('#pdTotalHps'),budgetNote=$('#pdBudgetNote');
    const currentTotal=index>=0?productTotal(c.products[index]):0,budget=rupBudget(c);
    const refresh=()=>{const h=Number(currencyDigits(hps?.value)||0),q=Math.max(0,Number(qtyEl?.value)||0),nextItemTotal=h*q,nextTotal=Math.max(0,competitionHps(c.products)-currentTotal+nextItemTotal),over=exceedsRupBudget(nextTotal,budget);if(total)total.textContent=fullRp(nextItemTotal);if(budgetNote){budgetNote.textContent=over?rupBudgetMessage(nextTotal,budget,'produk'):budget?`Sisa pagu RUP ${fullRp(Math.max(0,budget-nextTotal))}.`:'';budgetNote.classList.toggle('is-error',over)}if(save)save.disabled=!(h>0&&q>0&&String(unit?.value||'').trim()&&!over)};
    hps?.addEventListener('input',()=>{hps.value=currencyDisplay(hps.value);try{hps.setSelectionRange(hps.value.length,hps.value.length)}catch(_){}refresh()});
    qtyEl?.addEventListener('input',refresh);unit?.addEventListener('input',refresh);
    $('[data-qty-minus]')?.addEventListener('click',()=>{qtyEl.value=String(Math.max(1,(Number(qtyEl.value)||1)-1));refresh()});
    $('[data-qty-plus]')?.addEventListener('click',()=>{qtyEl.value=String(Math.max(1,(Number(qtyEl.value)||0)+1));refresh()});
    $('[data-product-category-back]')?.addEventListener('click',()=>{const snap=readDetailedProductDialog(c,cur);productCategoryDialog(index,snap,{level1:rootCategory,level2,level3})});
    refresh();
    save?.addEventListener('click',async()=>{const next=readDetailedProductDialog(c,cur),nextTotal=Math.max(0,competitionHps(c.products)-currentTotal+productTotal(next));if(!(next.hps>0&&next.qty>0&&next.unit)||exceedsRupBudget(nextTotal,budget)){refresh();return}const ref=categoryReferenceCache.get(String(categoryId||''))||await categoryRefPromise;next.kbli=ref?.kbliText||cur.kbli||'';if(index>=0)c.products[index]=next;else c.products.push(next);if(c.products.length<2&&c.offerType==='NON_ITEMIZED')c.offerType='ITEMIZED';c.dirty=true;$('#selModal').classList.remove('open');renderPreservingPosition()});
  }
  async function productCategoryDialog(index=-1,item={},preset={}){
    const c=syncCreateFromDom();
    let loadingTimer=null;
    if(!productCategoryRows.has(String(c.category||'').trim())){
      loadingTimer=setTimeout(()=>modal(`<div class="sel-dialog-head"><div><h4>Tambah Detail Produk</h4><p>Menyiapkan kategori produk…</p></div><button class="sel-dialog-close" data-close-sel-modal>×</button></div><div class="sel-category-loading"><span class="sel-category-loading-bar"></span><b>Menyiapkan kategori</b><small>Mohon tunggu sebentar.</small></div>`),140);
    }
    let rows=[];try{rows=await ensureProductCategoryRows(c.category)}catch(e){if(loadingTimer)clearTimeout(loadingTimer);flash(apiErr(e),'error');$('#selModal')?.classList.remove('open');return}
    if(loadingTimer)clearTimeout(loadingTimer);
    if(!rows.length){flash('Kategori untuk '+c.category+' belum tersedia di sheet PBJ_KATEGORI_PRODUK.','error');$('#selModal')?.classList.remove('open');return}
    const norm=v=>String(v||'').toLowerCase(),uniq=a=>[...new Set(a.filter(Boolean))];
    const firstRoot=uniq(rows.map(r=>r.level1))[0]||'';
    const selected={level1:preset.level1||item.rootCategory||firstRoot,level2:preset.level2||item.level2||'',level3:preset.level3||item.level3||''};
    const renderPicker=(q='')=>{
      const query=norm(q),matches=r=>!query||[r.level1,r.level2,r.level3,r.path].some(v=>norm(v).includes(query));
      const visible=rows.filter(matches),roots=uniq((query?visible:rows).map(r=>r.level1));
      if(!roots.includes(selected.level1))selected.level1=roots[0]||firstRoot;
      const rootRows=rows.filter(r=>r.level1===selected.level1),visibleRoot=query?rootRows.filter(matches):rootRows;
      const groups=uniq(visibleRoot.map(r=>r.level2));
      if(!groups.includes(selected.level2))selected.level2=groups[0]||uniq(rootRows.map(r=>r.level2))[0]||'';
      const groupRows=rootRows.filter(r=>r.level2===selected.level2),visibleGroup=query?groupRows.filter(matches):groupRows;
      const leaves=uniq(visibleGroup.map(r=>r.level3));
      if(selected.level3&&!leaves.includes(selected.level3))selected.level3='';
      const chosen=groupRows.find(r=>r.level3===selected.level3)||null;
      const breadcrumb=[c.category,(selected.level1&&selected.level1!==c.category)?selected.level1:'',selected.level2,selected.level3].filter(Boolean).join(' > ');
      modal(`<div class="sel-health-picker"><div class="sel-dialog-head"><div><h4>Tambah Detail Produk</h4><p>Pilih kategori produk yang dapat mengikuti kompetisi.</p></div><button class="sel-dialog-close" data-close-sel-modal>×</button></div><label class="sel-health-search"><span aria-hidden="true">⌕</span><input id="productCatSearch" type="search" value="${esc(q)}" placeholder="Cari kategori di sini" autocomplete="off"></label><b class="sel-health-label">Pilih Kategori</b><div class="sel-health-breadcrumb">${esc(breadcrumb||c.category)}</div><div class="sel-health-columns"><div class="sel-health-col">${roots.map(root=>`<button type="button" class="${root===selected.level1?'active':''}" data-cat-root="${esc(root)}">${esc(root)} <span>›</span></button>`).join('')||'<div class="sel-health-empty">Kategori tidak ditemukan.</div>'}</div><div class="sel-health-col">${groups.map(group=>`<button type="button" class="${group===selected.level2?'active':''}" data-cat-group="${esc(group)}">${esc(group)} <span>›</span></button>`).join('')||'<div class="sel-health-empty">Pilih kategori tingkat pertama.</div>'}</div><div class="sel-health-col">${leaves.map(leaf=>`<button type="button" class="${leaf===selected.level3?'active':''}" data-cat-leaf="${esc(leaf)}">${esc(leaf)}</button>`).join('')||'<div class="sel-health-empty">Tidak ada pilihan.</div>'}</div></div><div class="sel-health-footer"><span>${selected.level3?'Kategori siap dipakai.':'Pilih kategori sampai tingkat akhir.'}</span><button type="button" class="sel-primary" data-cat-continue ${selected.level3?'':'disabled'}>Gunakan Kategori</button></div></div>`);
      const search=$('#productCatSearch');if(search){search.focus({preventScroll:true});search.setSelectionRange?.(search.value.length,search.value.length);search.addEventListener('input',e=>{clearTimeout(productCategoryDialog._t);productCategoryDialog._t=setTimeout(()=>renderPicker(e.target.value),90)})}
      $$('[data-cat-root]').forEach(b=>b.addEventListener('click',()=>{selected.level1=b.dataset.catRoot;selected.level2='';selected.level3='';renderPicker(search?.value||'')}));
      $$('[data-cat-group]').forEach(b=>b.addEventListener('click',()=>{selected.level2=b.dataset.catGroup;selected.level3='';renderPicker(search?.value||'')}));
      $$('[data-cat-leaf]').forEach(b=>b.addEventListener('click',()=>{selected.level3=b.dataset.catLeaf;const row=rows.find(r=>r.level1===selected.level1&&r.level2===selected.level2&&r.level3===selected.level3);if(row)productFieldsDialog(c,index,item,row)}));
      $('[data-cat-continue]')?.addEventListener('click',()=>{if(!selected.level1||!selected.level2||!selected.level3)return;const row=rows.find(r=>r.level1===selected.level1&&r.level2===selected.level2&&r.level3===selected.level3);if(!row)return;productFieldsDialog(c,index,item,row)});
    };
    renderPicker('');
  }
  async function productDialog(index=-1){
    const c=syncCreateFromDom();if(!c.category){flash('Pilih kategori terlebih dahulu.','error');return}
    const item=index>=0?c.products[index]:{};
    await productCategoryDialog(index,item,{level1:item.rootCategory,level2:item.level2,level3:item.level3});
  }
  async function saveCreateDraft({submit=false,routeAfter='requests'}={}){const c=syncCreateFromDom();if(c.filePreparations?.size){await Promise.allSettled([...c.filePreparations.values()]);}if(!c.rupCode){flash('Pilih RUP terlebih dahulu.','error');return false}if(submit){const err=validateCreateForSubmit();if(err){flash(err,'error');if(/tanggal mulai|jadwal kompetisi|tanggal berakhir/i.test(err))$('#mcSchedule')?.scrollIntoView({behavior:'smooth',block:'center'});else if(/penyelesaian pekerjaan/i.test(err))$('#mcCompletion')?.scrollIntoView({behavior:'smooth',block:'center'});return false}if(!await confirmCritical({eyebrow:c.postKaji?'DETAIL PEMILIHAN':'KIRIM PERMOHONAN',title:c.postKaji?'Kirim detail pemilihan ke Pokja?':'Kirim permohonan ke UKPBJ?',message:c.postKaji?'Periksa kembali detail kompetisi sebelum dikirim. Dokumen persiapan yang sudah disampaikan tetap digunakan.':'Periksa kembali dokumen sebelum dikirim ke UKPBJ. Pastikan file yang diunggah sudah benar dan sesuai paket.',yes:'Ya, kirim',no:'Tidak, periksa lagi'}))return false}
    const proc=criticalProcess({eyebrow:submit?(c.postKaji?'DETAIL PEMILIHAN':'KIRIM PERMOHONAN'):'SIMPAN DRAFT',title:submit?(c.postKaji?'Mengirim detail pemilihan':'Mengirim permohonan'):'Menyimpan draft',message:'Menyimpan data permohonan…'});try{const r=await API().call('saveDraftRequest',{requestId:c.requestId,data:createPayload()},{timeoutMs:30000});const saved=r.data;c.requestId=saved.request_id;c.rupCode=String(saved.kode_rup||c.rupCode);c.title=saved.competition_title||saved.nama_paket||c.title;state.requests=[saved,...state.requests.filter(x=>x.request_id!==saved.request_id)];proc.set(28,'Data tersimpan. Menyiapkan dokumen…');const files=[...c.files.entries()];if(files.length){let completed=0;const results=await Promise.allSettled(files.map(async([type,file])=>{const out=await uploadDocumentFast(file,c.requestId,type);completed++;proc.set(28+Math.round(completed/files.length*54),`Mengunggah dokumen ${completed} dari ${files.length}…`);return{type,out}}));const failed=results.filter(x=>x.status==='rejected');results.filter(x=>x.status==='fulfilled').forEach(x=>{c.files.delete(x.value.type);const raw=x.value.out?.data||x.value.out||null;if(raw)c.existingDocs=[...c.existingDocs.filter(d=>String(d.doc_type)!==x.value.type),raw]});if(failed.length)throw failed[0].reason||new Error('Ada dokumen yang belum berhasil diunggah.');}proc.set(86,submit?(c.postKaji?'Mengirim detail ke Pokja…':'Mengirim ke Kepala UKPBJ…'):'Menyimpan draft…');let final=saved;if(submit){const sent=await API().call(c.postKaji?'completeKajiDetails':'submitRequest',{requestId:c.requestId},{timeoutMs:30000});final=sent.data;state.requests=[final,...state.requests.filter(x=>x.request_id!==final.request_id)];clearRupOptions();}c.dirty=false;await proc.success(submit?(c.postKaji?'Detail pemilihan berhasil dikirim.':'Permohonan berhasil dikirim ke Kepala UKPBJ.'):'Draft berhasil disimpan.');if(routeAfter==='kind'){state.create=newCreateState();state.view='create-kind';createRoute('permohonan/jenis');render();}else{state.create=null;state.view='requests';createRoute('permohonan');render();}silentSync(120);return true}catch(e){const msg=apiErr(e);proc.fail(msg);flash(msg,'error');return false}}
  function confirmCreateExit(){return new Promise(resolve=>{const root=$('#selModal');if(!root){resolve('exit');return}const wasOpen=root.classList.contains('open'),layer=document.createElement('div');layer.className='sel-confirm-layer';layer.innerHTML=`<div class="sel-confirm-box"><button type="button" class="sel-confirm-x" data-exit-cancel aria-label="Tutup">×</button><h4>Yakin Ingin Keluar?</h4><p>Data yang telah terisi akan hilang saat Anda keluar dari halaman ini. Pilih “Simpan Sebagai Draft” untuk melanjutkan nanti.</p><div class="sel-form-actions"><button type="button" class="sel-ghost" data-exit-now>Keluar</button><button type="button" class="sel-primary" data-exit-save>Simpan Sebagai Draft</button></div></div>`;root.appendChild(layer);root.classList.add('open');const done=v=>{layer.remove();if(!wasOpen)root.classList.remove('open');resolve(v)};layer.querySelector('[data-exit-now]')?.addEventListener('click',()=>done('exit'));layer.querySelector('[data-exit-save]')?.addEventListener('click',()=>done('save'));layer.querySelector('[data-exit-cancel]')?.addEventListener('click',()=>done('cancel'));layer.addEventListener('click',e=>{if(e.target===layer)done('cancel')})})}
  async function backCreateKind(){const c=syncCreateFromDom();if(c.postKaji){state.view='create-kind';createRoute('permohonan/jenis');render();return;}if(!c.dirty&&!c.requestId){state.create=newCreateState();state.view='create-kind';createRoute('permohonan/jenis');render();return}const action=await confirmCreateExit();if(action==='cancel')return;if(action==='save'){await saveCreateDraft({submit:false,routeAfter:'kind'});return}state.create=newCreateState();state.view='create-kind';createRoute('permohonan/jenis');render()}
  function bindCreateKind(){
    $('[data-create-back-list]')?.addEventListener('click',()=>{const id=state.create?.requestId;state.create=null;state.view='requests';createRoute('permohonan');render();if(id)openDetail(id)});
    $$('[data-competition-type]').forEach(btn=>btn.addEventListener('click',()=>{
      const c=currentCreate(),type=btn.dataset.competitionType;
      const locked=lockedPostKajiCompetitionType(c);
      if(locked&&type!==locked)return;
      c.competitionType=type;
      if(type==='CONSTRUCTION'&&!(c.qualifications?.kecil||c.qualifications?.menengah||c.qualifications?.besar))c.qualifications=constructionDefaultQualifications();
      render();
    }));
    $('[data-create-next]')?.addEventListener('click',()=>{
      const c=currentCreate(),locked=lockedPostKajiCompetitionType(c);
      if(locked)c.competitionType=locked;
      state.view='create-form';
      if(c.competitionType==='CONSTRUCTION'){
        if(!(c.qualifications?.kecil||c.qualifications?.menengah||c.qualifications?.besar))c.qualifications=constructionDefaultQualifications();
        createRoute('permohonan/form/konstruksi');render();ensureCreateRups();ensureConstructionCategories().catch(()=>{});
      }else{
        createRoute('permohonan/form/barang-jasa');render();ensureCreateRups();ensureProductCategoryGroups();
      }
    });
  }
  const CREATE_DOC_LIMIT=10*1024*1024;
  const CREATE_DOC_TARGET=9.5*1024*1024;
  async function shrinkLargeImage(file){
    if(file.size<=CREATE_DOC_LIMIT)return file;
    if(!/\.(jpe?g|png)$/i.test(file.name||''))throw new Error('File PDF atau Office di atas 10 MB perlu diperkecil sebelum diunggah. Dokumen asli tidak diubah otomatis.');
    if(typeof createImageBitmap!=='function')throw new Error('Peramban ini belum mendukung kompresi gambar. Perkecil gambar sebelum diunggah.');
    const bitmap=await createImageBitmap(file);
    try{
      // Run only for oversized images; never add a download or Apps Script request.
      const canvas=document.createElement('canvas'),ctx=canvas.getContext('2d',{alpha:false});
      if(!ctx)throw new Error('Gambar belum bisa diperkecil di perangkat ini.');
      let scale=Math.min(1,2800/Math.max(bitmap.width,bitmap.height));
      for(let i=0;i<5;i++){
        canvas.width=Math.max(1,Math.round(bitmap.width*scale));canvas.height=Math.max(1,Math.round(bitmap.height*scale));
        ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(bitmap,0,0,canvas.width,canvas.height);
        const quality=Math.max(.58,.86-i*.07);
        const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/jpeg',quality));
        if(blob&&blob.size>0&&blob.size<=CREATE_DOC_TARGET){return new File([blob],String(file.name).replace(/\.[^.]+$/,'')+'.jpg',{type:'image/jpeg',lastModified:file.lastModified});}
        scale*=.78;
      }
      throw new Error('Gambar masih lebih dari 10 MB. Perkecil ukuran atau resolusinya sebelum diunggah.');
    }finally{bitmap.close?.();}
  }
  function setCreateFileRow(row,file,oldSize){
    const label=row?.querySelector('.sel-drop-upload'),title=label?.querySelector('.sel-drop-copy b'),action=label?.querySelector('em'),status=row?.querySelector('.sel-create-doc-name>span');
    if(status)status.textContent=oldSize&&oldSize>file.size?`Diperkecil ${nf.format(Math.round(oldSize/1048576*10)/10)} MB → ${nf.format(Math.round(file.size/1048576*10)/10)} MB`:'Siap diunggah';
    if(title)title.textContent=file.name;if(action)action.textContent='Ganti Dokumen';
    row?.classList.remove('drag-over');label?.classList.remove('drag-over');
  }
  function acceptCreateDocFile(c,type,file,row){
    if(!file)return;
    if(!/\.(pdf|doc|docx|xls|xlsx|jpg|jpeg|png)$/i.test(file.name||'')){flash('Gunakan file PDF, DOC, DOCX, XLS, XLSX, JPG, JPEG, atau PNG.','error');return}
    if(!c.filePreparations)c.filePreparations=new Map();
    // Keep existing uploaded/selected file until a replacement is ready.
    const working=async()=>{
      try{
        const status=row?.querySelector('.sel-create-doc-name>span');if(status&&file.size>CREATE_DOC_LIMIT)status.textContent='Memperkecil file…';
        const ready=await shrinkLargeImage(file);
        if(c.filePreparations.get(type)!==task)return;
        c.files.set(type,ready);c.dirty=true;setCreateFileRow(row,ready,file.size);
      }catch(err){if(c.filePreparations.get(type)===task){flash(err.message||'File belum dapat diproses.','error');const status=row?.querySelector('.sel-create-doc-name>span');if(status)status.textContent='File belum dipilih atau belum dapat diperkecil.';}}
    };
    const task=working();c.filePreparations.set(type,task);task.finally(()=>{if(c.filePreparations.get(type)===task)c.filePreparations.delete(type)});
  }
  function bindCreateDropZones(c){
    $$('[data-create-dropzone]').forEach(row=>{
      const type=row.dataset.createDropzone,input=row.querySelector(`[data-create-doc-file="${CSS.escape(type)}"]`),label=row.querySelector('.sel-drop-upload');
      if(!input||!label)return;
      input.addEventListener('change',()=>acceptCreateDocFile(c,type,input.files?.[0],row));
      const over=e=>{e.preventDefault();e.stopPropagation();if(e.dataTransfer)e.dataTransfer.dropEffect='copy';row.classList.add('drag-over');label.classList.add('drag-over')};
      ['dragenter','dragover'].forEach(name=>row.addEventListener(name,over));
      row.addEventListener('dragleave',e=>{e.preventDefault();e.stopPropagation();if(!row.contains(e.relatedTarget)){row.classList.remove('drag-over');label.classList.remove('drag-over')}});
      row.addEventListener('drop',e=>{e.preventDefault();e.stopPropagation();row.classList.remove('drag-over');label.classList.remove('drag-over');acceptCreateDocFile(c,type,e.dataTransfer?.files?.[0],row)});
    });
  }
  function bindCreateForm(){
    const c=currentCreate(),construction=c.competitionType==='CONSTRUCTION';
    ensureCreateRups();
    if(construction)ensureConstructionCategories().catch(()=>{});
    else ensureProductCategoryGroups().then(()=>{if(c.category)ensureProductCategoryRows(c.category).catch(()=>{})});

    $$('[data-create-jump]').forEach(btn=>btn.addEventListener('click',()=>$('#'+btn.dataset.createJump)?.scrollIntoView({behavior:'smooth',block:'start'})));
    bindCreateRupPicker(c);
    if(c.postKaji){const rupSearch=$('#mcRupSearch'),rupToggle=$('#mcRupToggle');if(rupSearch){rupSearch.disabled=true;rupSearch.readOnly=true;rupSearch.setAttribute('aria-label','Kode RUP sudah dikunci');}if(rupToggle)rupToggle.disabled=true;}


    const startDate=$('#mcStartDate'),endDate=$('#mcEndDate'),completionDate=$('#mcCompletionDate');
    startDate?.addEventListener('change',()=>{
      if(startDate.value<jakartaDay())startDate.value=jakartaDay();
      if(endDate){endDate.min=startDate.value||jakartaDay();if(endDate.value&&endDate.value<endDate.min)endDate.value=''}
      if(completionDate){completionDate.min=endDate?.value||startDate.value||jakartaDay();if(completionDate.value&&completionDate.value<completionDate.min)completionDate.value=''}
      syncCreateFromDom();
    });
    endDate?.addEventListener('change',()=>{
      const min=startDate?.value||jakartaDay();endDate.min=min;
      if(endDate.value&&endDate.value<min){endDate.value='';flash('Tanggal berakhir tidak boleh sebelum tanggal mulai.','error')}
      if(completionDate){completionDate.min=endDate.value||min;if(completionDate.value&&completionDate.value<completionDate.min)completionDate.value=''}
      syncCreateFromDom();
    });
    completionDate?.addEventListener('change',()=>{
      const min=endDate?.value||startDate?.value||jakartaDay();completionDate.min=min;
      if(completionDate.value&&completionDate.value<min){completionDate.value='';flash('Tanggal penyelesaian pekerjaan tidak boleh sebelum tanggal berakhir kompetisi.','error')}
      syncCreateFromDom();
    });
    ['mcStartTime','mcEndTime','mcLocationInput'].forEach(id=>$('#'+id)?.addEventListener('input',()=>syncCreateFromDom()));

    if(construction){
      $('#mcKecil')?.addEventListener('change',()=>syncCreateFromDom());
      $('#mcNonUmk')?.addEventListener('change',e=>{
        syncCreateFromDom();c.qualifications.nonUmk=e.target.checked;
        if(!e.target.checked){c.qualifications.menengah=false;c.qualifications.besar=false}
        else if(!(c.qualifications.menengah||c.qualifications.besar)){c.qualifications.menengah=true;c.qualifications.besar=true}
        renderPreservingPosition();
      });
      ['mcMenengah','mcBesar'].forEach(id=>$('#'+id)?.addEventListener('change',()=>syncCreateFromDom()));
      $('[data-add-construction]')?.addEventListener('click',()=>constructionCategoryDialog(-1,{}));
      $$('[data-edit-construction]').forEach(b=>b.addEventListener('click',()=>{
        const index=Number(b.dataset.editConstruction),item=c.constructionDetails[index]||{};
        constructionCategoryDialog(index,item);
      }));
      $$('[data-delete-construction]').forEach(b=>b.addEventListener('click',()=>{
        c.constructionDetails.splice(Number(b.dataset.deleteConstruction),1);c.dirty=true;renderPreservingPosition();
      }));
      $$('input[name="mcPaymentType"]').forEach(el=>el.addEventListener('change',e=>{
        syncCreateFromDom();c.paymentType=e.target.value;
        if(c.paymentType!=='TERMIN'){c.paymentTermsCount='';c.paymentTermsNote=''}
        c.dirty=true;renderPreservingPosition();
      }));
      $('#mcPaymentTermsCount')?.addEventListener('input',()=>syncCreateFromDom());
      $('#mcPaymentTermsNote')?.addEventListener('input',()=>syncCreateFromDom());
    }else{
      $('#mcUmk')?.addEventListener('change',e=>{syncCreateFromDom();c.qualifications.umk=e.target.checked;if(!e.target.checked){c.qualifications.mikro=false;c.qualifications.kecil=false}renderPreservingPosition()});
      $('#mcNonUmk')?.addEventListener('change',e=>{syncCreateFromDom();c.qualifications.nonUmk=e.target.checked;if(!e.target.checked){c.qualifications.menengah=false;c.qualifications.besar=false}renderPreservingPosition()});
      ['mcMikro','mcKecil','mcMenengah','mcBesar'].forEach(id=>$('#'+id)?.addEventListener('change',()=>syncCreateFromDom()));
      $('#mcCategory')?.addEventListener('change',e=>{c.category=e.target.value;c.dirty=true;if(c.category)ensureProductCategoryRows(c.category).catch(()=>{});renderPreservingPosition()});
      $$('input[name="mcOfferType"]').forEach(el=>el.addEventListener('change',()=>syncCreateFromDom()));
      $('[data-add-product]')?.addEventListener('click',()=>productDialog(-1));
      $$('[data-edit-product]').forEach(b=>b.addEventListener('click',()=>productDialog(Number(b.dataset.editProduct))));
      $$('[data-delete-product]').forEach(b=>b.addEventListener('click',()=>{c.products.splice(Number(b.dataset.deleteProduct),1);if(c.products.length<2&&c.offerType==='NON_ITEMIZED')c.offerType='ITEMIZED';c.dirty=true;renderPreservingPosition()}));
    }

    $('#mcTitle')?.addEventListener('input',e=>{c.title=e.target.value;c.dirty=true});
    bindCreateDropZones(c);
    $$('[data-create-back-kind]').forEach(b=>b.addEventListener('click',backCreateKind));
    $('[data-save-create-draft]')?.addEventListener('click',()=>saveCreateDraft({submit:false}));
    $('[data-send-create]')?.addEventListener('click',()=>saveCreateDraft({submit:true}));
  }
  function openMiniCreate(initialRup='',reapplyFromId=''){state.create=newCreateState();state.create.rupCode=String(initialRup||'').replace(/\D/g,'');state.create.previousRequestId=String(reapplyFromId||'');state.view='create-kind';createRoute('permohonan/jenis');render()}
  function openCreate(initialRup='',reapplyFromId=''){state.create=null;state.view='requests';createRoute('permohonan');render();openNegotiationCreate(initialRup,reapplyFromId)}
  function openNegotiationCreate(initialRup='',reapplyFromId=''){
    initialRup=typeof initialRup==='string'?initialRup.replace(/\D/g,''):'';reapplyFromId=String(reapplyFromId||'').trim();
    // Pengajuan ulang memakai identitas permohonan yang ditolak, bukan formulir baru yang bebas diubah.
    const reapplySource=reapplyFromId?(state.detail?.request?.request_id===reapplyFromId?state.detail.request:state.requests.find(r=>r.request_id===reapplyFromId)):null;
    if(reapplyFromId&&(!reapplySource||reapplySource.status!=='DITOLAK_KEPALA')){flash('Data permohonan yang ditolak belum tersedia. Buka detail paket lalu coba lagi.','error');return;}
    if(reapplySource)initialRup=String(reapplySource.kode_rup||'').replace(/\D/g,'');
    let preview=null,rupItems=[],loadSeq=0,selectedRup='';
    modal(`<div class="sel-dialog-head"><div><small>PPK / OPD</small><h4>${reapplySource?'Ajukan Ulang Dokumen Persiapan':'Buat Permohonan Dokumen Persiapan'}</h4></div><button class="sel-dialog-close" data-close-sel-modal>×</button></div>${reapplySource?`<div class="sel-reapply-lock-note">Pengajuan ulang dari <b>${esc(reapplyFromId)}</b>. Total HPS dapat diubah sesuai sisa pagu RUP. Data lainnya tetap mengikuti permohonan sebelumnya.</div>`:''}<div class="sel-form-grid"><label class="sel-field wide"><span>METODE PENGADAAN</span><select id="newMethod"><option value="">Pilih metode pengadaan</option><option value="E-Purchasing">E-Purchasing</option><option value="Tender">Tender</option><option value="Seleksi">Seleksi</option></select></label><div class="sel-method-notice wide" id="methodNotice" hidden></div><div class="sel-field wide"><span>KODE RUP</span><div class="sel-rup-combo" id="rupCombo"><input id="newRupSearch" type="search" autocomplete="off" spellcheck="false" placeholder="Pilih metode terlebih dahulu" disabled><button type="button" class="sel-rup-toggle" id="rupToggle" aria-label="Buka daftar Kode RUP" aria-expanded="false" disabled>⌄</button><div class="sel-rup-options" id="rupOptions" hidden></div></div><small class="sel-field-help" id="rupHelp">Pilih metode pengadaan terlebih dahulu.</small></div><div class="sel-rup-preview" id="rupPreview"><div class="wide"><span>PAKET</span><b>Belum dipilih</b></div></div><label class="sel-field wide"><span>JUDUL PERMOHONAN *</span><input id="newRequestTitle" maxlength="180" placeholder="Contoh: Pengadaan Jasa Kebersihan Gedung Kantor" autocomplete="off"></label><label class="sel-field wide sel-ppk-history" id="ppkHistoryWrap" hidden><span>PILIH PPK</span><select id="ppkHistorySelect" aria-label="Pilih PPK yang pernah mengajukan"><option value="">Pilih PPK sebelumnya</option><option value="NEW">+ Tambah PPK baru</option></select></label><label class="sel-field wide"><span>NAMA PPK *</span><input id="newPpkNama" value="" placeholder="Nama lengkap PPK" autocomplete="off"><small class="sel-field-help" id="newPpkNameHelp">Minimal 3 huruf.</small></label><label class="sel-field wide"><span>EMAIL PPK *</span><input id="newPpkEmail" type="email" autocomplete="email" placeholder="nama@instansi.go.id"></label><label class="sel-field wide"><span>TOTAL HPS YANG DIAJUKAN (Rp) *</span><input id="newHpsAlokasi" type="text" inputmode="numeric" placeholder="Masukkan total HPS pekerjaan"><small id="newHpsHelp">Total HPS ini mengurangi sisa pagu RUP setelah permohonan dikirim.</small></label><label class="sel-field wide"><span>CATATAN</span><input id="newNote" placeholder="Opsional"></label></div><div class="sel-form-actions"><button class="sel-ghost" data-close-sel-modal>Batal</button><button class="sel-primary" id="createRequestBtn" disabled>Buat Permohonan</button></div>`);

    const createBtn=$('#createRequestBtn'),searchInput=$('#newRupSearch'),toggle=$('#rupToggle'),optionsEl=$('#rupOptions'),combo=$('#rupCombo'),help=$('#rupHelp'),notice=$('#methodNotice'),previewEl=$('#rupPreview');prefetchRupOptions();
    if(reapplySource){
      const method=$('#newMethod');if(method){method.value=reapplySource.metode_pengadaan||reapplySource.metode_epurchasing||'E-Purchasing';method.disabled=true;}
      [['newRequestTitle',reapplySource.judul_permohonan||reapplySource.nama_paket],['newPpkNama',reapplySource.ppk_nama],['newPpkEmail',reapplySource.ppk_email],['newNote',reapplySource.notes]].forEach(([id,value])=>{const el=$('#'+id);if(el){el.value=String(value||'');el.readOnly=true;el.classList.add('sel-reapply-locked-input');}});
      const hps=$('#newHpsAlokasi');if(hps)hps.value=currencyDisplay(reapplySource.hps_alokasi);
      if(searchInput){searchInput.readOnly=true;searchInput.classList.add('sel-reapply-locked-input');}
    }
    // Tampilkan PPK dari riwayat permohonan OPD, tanpa menambah loading halaman utama.
    const ppkSelect=$('#ppkHistorySelect'),ppkWrap=$('#ppkHistoryWrap'),ppkNameInput=$('#newPpkNama'),ppkEmailInput=$('#newPpkEmail'),ppkNameHelp=$('#newPpkNameHelp');
    let knownPpk=[];
    const updatePpkChoice=items=>{
      if(reapplySource||!ppkSelect||!ppkWrap)return;
      const currentKey=ppkSelect.value,oldSelected=currentKey!==''&&currentKey!=='NEW'?knownPpk[Number(currentKey)]:null;
      const combined=ppkHistoryFromApi([...items,...knownPpk]);
      // Prioritaskan data paling baru dari Sheet saat pilihan PPK yang sama sudah tersedia.
      knownPpk=combined;
      ppkWrap.hidden=!combined.length;
      if(!combined.length)return;
      ppkSelect.innerHTML='<option value="">Pilih PPK sebelumnya</option>'+combined.map((p,i)=>`<option value="${i}">${esc(p.name)}</option>`).join('')+'<option value="NEW">+ Tambah PPK baru</option>';
      if(oldSelected){const idx=combined.findIndex(x=>x.name.toLowerCase()===oldSelected.name.toLowerCase());ppkSelect.value=idx>=0?String(idx):'';}
      else if(currentKey==='NEW')ppkSelect.value='NEW';
    };
    ppkSelect?.addEventListener('change',()=>{
      if(reapplySource)return;
      const choice=ppkSelect.value;
      if(choice==='NEW'){ppkNameInput.value='';ppkEmailInput.value='';ppkNameInput.focus({preventScroll:true});}
      else if(choice!==''){const profile=knownPpk[Number(choice)];if(profile){ppkNameInput.value=profile.name;ppkEmailInput.value=profile.email;}}
      syncPpkName();syncHpsLimit();
    });
    const sameOpd=state.requests.filter(x=>String(x.opd||'').trim().toLowerCase()===String(state.me?.opd||'').trim().toLowerCase());
    if(!reapplySource){
      updatePpkChoice(ppkHistoryFromRows(sameOpd));
      const cacheKey=String(state.me?.opd||'').trim().toLowerCase(),stored=ppkHistoryCache.get(cacheKey);
      if(stored&&Date.now()-stored.at<ppkHistoryTtl)updatePpkChoice(stored.items);
      else if(cacheKey)API().call('listPpkHistory',{}, {timeoutMs:12000}).then(result=>{
        const items=ppkHistoryFromApi(result?.data?.items||[]);ppkHistoryCache.set(cacheKey,{at:Date.now(),items});
        if($('#ppkHistorySelect')===ppkSelect)updatePpkChoice(items);
      }).catch(()=>{}); // Backend lama: daftar dari permohonan yang sudah tampil tetap digunakan.
    }
    const syncPpkName=()=>{
      if(!ppkNameInput||!ppkNameHelp)return;
      const name=ppkNameInput.value.trim(),valid=letterCount(name)>=3;
      ppkNameInput.classList.toggle('is-invalid',Boolean(name&&!valid));
      ppkNameHelp.textContent=valid?'':(name?'Nama PPK minimal 3 huruf.':'Minimal 3 huruf.');
      ppkNameHelp.classList.toggle('is-error',Boolean(name&&!valid));
    };
    ppkNameInput?.addEventListener('input',()=>{syncPpkName();syncHpsLimit();});
    syncPpkName();
    const norm=v=>String(v||'').toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/\s+/g,' ').trim();
    const emptyPreview=text=>{preview=null;selectedRup='';if(createBtn)createBtn.disabled=true;if(previewEl)previewEl.innerHTML=`<div class="wide"><span>PAKET</span><b>${esc(text||'Belum dipilih')}</b></div>`;syncHpsLimit?.();};
    const renderPreview=item=>{if(!item){emptyPreview('Belum dipilih');return}preview=item;selectedRup=String(item.kodeRup);if(previewEl)previewEl.innerHTML=`<div class="wide"><span>NAMA PAKET</span><b>${esc(item.namaPaket)}</b></div><div><span>KODE RUP</span><b>${esc(item.kodeRup)}</b></div><div><span>SATUAN KERJA</span><b>${esc(item.opd)}</b></div><div><span>PAGU RUP</span><b>${fmtRp(item.pagu)}</b></div><div><span>SISA PAGU</span><b>${fmtRp(item.sisaPagu??item.pagu)}</b></div><div><span>JENIS</span><b>${esc(item.jenis||'—')}</b></div><div><span>METODE</span><b>${esc(item.metode||'E-Purchasing')}</b></div><div><span>SUMBER DANA</span><b>${esc(item.sumberDana||'—')}</b></div><div><span>WAKTU PEMILIHAN</span><b>${esc(item.waktuPemilihan||'—')}</b></div><div class="wide"><span>PROGRAM</span><b>${esc(item.program||'—')}</b></div><div class="wide"><span>KEGIATAN</span><b>${esc(item.kegiatan||'—')}</b></div><div class="wide"><span>SUB KEGIATAN</span><b>${esc(item.subKegiatan||'—')}</b></div>`;syncHpsLimit();};
    const showNotice=(text,type='info')=>{if(!notice)return;if(!text){notice.hidden=true;notice.textContent='';notice.className='sel-method-notice wide';return}notice.hidden=false;notice.textContent=text;notice.className=`sel-method-notice wide ${type}`;};
    const selectableItems=()=>rupItems.filter(x=>Number(x.sisaPagu??x.pagu)>0);
    const hpsInput=$('#newHpsAlokasi'),hpsHelp=$('#newHpsHelp');
    const syncHpsLimit=()=>{
      const max=Number(preview?.sisaPagu??preview?.pagu??0),value=Number(currencyDigits(hpsInput?.value)||0);
      if(hpsInput)hpsInput.dataset.max=String(max||0);
      if(hpsHelp){
        if(max>0)hpsHelp.textContent=`Maksimal ${fmtRp(max)} sesuai sisa pagu RUP.`;
        else hpsHelp.textContent=reapplySource?'Sisa pagu RUP belum tersedia.':'Total HPS ini mengurangi sisa pagu RUP setelah permohonan dikirim.';
        hpsHelp.classList.toggle('is-error',Boolean(max>0&&value>max));
        if(value>max&&max>0)hpsHelp.textContent=`Total HPS tidak boleh melebihi ${fmtRp(max)}.`;
      }
      if(hpsInput)hpsInput.classList.toggle('is-invalid',Boolean(max>0&&value>max));
      if(createBtn)createBtn.disabled=!preview||!(value>0&&value<=max)||letterCount(ppkNameInput?.value)<3||String($('#newRequestTitle')?.value||'').trim().length<5;
    };
    const matchingItems=query=>{const q=norm(query);if(!q)return rupItems;return rupItems.filter(x=>norm(`${x.kodeRup} ${x.namaPaket||''} ${x.program||''} ${x.kegiatan||''} ${x.subKegiatan||''}`).includes(q));};
    const closeOptions=()=>{if(optionsEl)optionsEl.hidden=true;if(toggle)toggle.setAttribute('aria-expanded','false');};
    const pickRup=item=>{if(!item||Number(item.sisaPagu??item.pagu)<=0)return;renderPreview(item);if(searchInput)searchInput.value=`${item.kodeRup} · ${item.namaPaket||'Tanpa nama paket'}`;closeOptions();};
    const renderOptions=(query='')=>{
      if(!optionsEl)return;const items=matchingItems(query);
      optionsEl.innerHTML=items.length?items.map(x=>`<button type="button" class="sel-rup-option${Number(x.sisaPagu??x.pagu)<=0?' disabled':''}" data-rup-code="${esc(x.kodeRup)}" ${Number(x.sisaPagu??x.pagu)<=0?'disabled':''}><strong>${esc(x.kodeRup)}</strong><span>${esc(x.namaPaket||'Tanpa nama paket')}</span><small>${fmtRp(x.pagu)} · Sisa ${fmtRp(x.sisaPagu??x.pagu)}</small></button>`).join(''):'<div class="sel-rup-empty">RUP tidak ditemukan.</div>';
      $$('[data-rup-code]',optionsEl).forEach(btn=>btn.addEventListener('click',()=>pickRup(rupItems.find(x=>String(x.kodeRup)===String(btn.dataset.rupCode)))));
    };
    const openOptions=()=>{if(!searchInput||searchInput.disabled||!optionsEl)return;renderOptions(selectedRup?'':searchInput.value);optionsEl.hidden=false;if(toggle)toggle.setAttribute('aria-expanded','true');};
    const resetCombo=(placeholder,disabled=true)=>{selectedRup='';if(searchInput){searchInput.value='';searchInput.placeholder=placeholder;searchInput.disabled=disabled||!!reapplySource}if(toggle)toggle.disabled=disabled||!!reapplySource;closeOptions();};
    const loadMethod=async()=>{
      const method=$('#newMethod')?.value||'',seq=++loadSeq;
      rupItems=[];emptyPreview(method?'Pilih Kode RUP':'Belum dipilih');
      if(!searchInput||!help)return;
      resetCombo(method?'Menyiapkan RUP…':'Pilih metode terlebih dahulu',true);
      if(!method){help.textContent='Pilih metode pengadaan terlebih dahulu.';showNotice('');return;}
      if(method==='Tender'||method==='Seleksi'){
        resetCombo('Belum tersedia',true);help.textContent='Kode RUP belum dapat dipilih untuk metode ini.';showNotice(`Pengajuan ${method} saat ini belum tersedia.`,'warn');emptyPreview(`Pengajuan ${method} belum tersedia`);return;
      }
      showNotice('');help.textContent='Menyiapkan RUP E-Purchasing dengan pagu di atas Rp200 juta sesuai satuan kerja akun.';
      try{
        const data=await getRupOptions(method);
        if(seq!==loadSeq)return;
        rupItems=Array.isArray(data?.items)?data.items:[];
        const selectable=selectableItems();
        resetCombo(selectable.length?'Cari Kode RUP atau nama paket':'Belum ada RUP lain',!selectable.length);
        help.textContent=data?.message||'Ketik Kode RUP atau nama paket, atau buka daftar.';
        if(reapplySource){
          // Jangan buka pilihan RUP atau ganti paket saat pengajuan ulang.
          const item=rupItems.find(x=>String(x.kodeRup)===initialRup);
          if(item){renderPreview(item);if(searchInput)searchInput.value=`${item.kodeRup} · ${item.namaPaket||'Tanpa nama paket'}`;}
          else{emptyPreview('Kode RUP dari permohonan sebelumnya tidak ditemukan.');if(searchInput)searchInput.value=initialRup;}
          if(searchInput)searchInput.disabled=true;
          if(toggle)toggle.disabled=true;
          help.textContent=item?'Kode RUP mengikuti permohonan sebelumnya.':'RUP sebelumnya tidak ditemukan. Hubungi admin UKPBJ.';
        }else{
          renderOptions('');
          if(initialRup&&selectable.some(x=>String(x.kodeRup)===initialRup)){const item=selectable.find(x=>String(x.kodeRup)===initialRup);initialRup='';pickRup(item);}
          else if(!selectable.length)emptyPreview('Belum ada RUP lain yang dapat diajukan');
        }
      }catch(e){
        if(seq!==loadSeq)return;
        resetCombo('RUP tidak dapat dimuat',true);const msg=/aksi tidak dikenal/i.test(String(e?.message||''))?'Backend Pemilihan belum diperbarui.':'RUP dari DETAILPSW belum dapat dimuat. Coba lagi.';help.textContent=msg;emptyPreview('RUP belum dapat dimuat');flash(apiErr(e),'error');
      }
    };
    $('#newHpsAlokasi')?.addEventListener('input',e=>{e.target.value=currencyDisplay(e.target.value);syncHpsLimit();});
    $('#newRequestTitle')?.addEventListener('input',syncHpsLimit);
    syncHpsLimit();
    $('#newMethod')?.addEventListener('change',loadMethod);
    searchInput?.addEventListener('focus',openOptions);
    searchInput?.addEventListener('input',()=>{selectedRup='';preview=null;if(createBtn)createBtn.disabled=true;emptyPreview('Pilih Kode RUP');renderOptions(searchInput.value);if(optionsEl)optionsEl.hidden=false;if(toggle)toggle.setAttribute('aria-expanded','true');});
    searchInput?.addEventListener('keydown',e=>{if(e.key==='Escape'){closeOptions();searchInput.blur();return}if(e.key==='Enter'){e.preventDefault();const hits=matchingItems(searchInput.value).filter(x=>Number(x.sisaPagu??x.pagu)>0);if(hits.length===1)pickRup(hits[0]);else openOptions();}});
    toggle?.addEventListener('click',()=>{if(optionsEl?.hidden)openOptions();else closeOptions();searchInput?.focus({preventScroll:true});});
    combo?.addEventListener('focusout',()=>setTimeout(()=>{if(combo&&!combo.contains(document.activeElement))closeOptions()},0));
    if(initialRup){const method=$('#newMethod');if(method&&!reapplySource)method.value='E-Purchasing';loadMethod();}
    createBtn?.addEventListener('click',async()=>{
      if(!preview||!selectedRup)return;
      const method=$('#newMethod')?.value||'';
      if(method!=='E-Purchasing'){showNotice(`Pengajuan ${method||'metode ini'} saat ini belum tersedia.`,'warn');return;}
      const ppkEmail=String($('#newPpkEmail')?.value||'').trim(),ppkNama=String($('#newPpkNama')?.value||'').trim(),judulPermohonan=String($('#newRequestTitle')?.value||'').trim(),hpsAlokasi=Number(currencyDigits($('#newHpsAlokasi')?.value)||0);if(judulPermohonan.length<5){flash('Judul permohonan minimal 5 karakter.','error');$('#newRequestTitle')?.focus();return}if(letterCount(ppkNama)<3){flash('Nama PPK minimal 3 huruf.','error');ppkNameInput?.focus();return}if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(ppkEmail)){flash('Isi email PPK yang valid.','error');return}if(!(hpsAlokasi>0&&hpsAlokasi<=Number(preview.sisaPagu??preview.pagu))){flash('Total HPS harus lebih dari nol dan tidak melebihi sisa pagu RUP.','error');return}if(reapplyFromId&&!await confirmCritical({eyebrow:'PENGAJUAN ULANG',title:'Ajukan ulang paket ini?',message:'Total HPS yang baru akan disimpan. Setelah dibuat, periksa dokumen persiapan lalu kirim ke Kepala UKPBJ.',yes:'Ya, ajukan ulang',no:'Batal'}))return;
      const btn=createBtn;btn.disabled=true;btn.textContent='Membuat…';
      const proc=reapplyFromId?criticalProcess({eyebrow:'PENGAJUAN ULANG',title:'Membuat pengajuan ulang',message:'Menyimpan permohonan baru…'}):null;
      try{
        const r=await createRequestCall({kodeRup:preview.kodeRup,metodePengadaan:method,selectionProcess:'PERSIAPAN',initialPreparation:true,judulPermohonan,notes:$('#newNote')?.value||'',ppkNama,ppkEmail,hpsAlokasi,previousRequestId:reapplyFromId});
        clearRupOptions();$('#selModal').classList.remove('open');state.requests=[r.data,...state.requests.filter(x=>x.request_id!==r.data.request_id)];state.detail={request:r.data,docs:[],reviews:[],notes:[],audit:[],docConfig:state.detail?.docConfig||[],pokja:state.dashboard?.pokja||[]};await openDetail(r.data.request_id);if(proc)await proc.success('Pengajuan ulang berhasil dibuat.');flash(reapplyFromId?'Pengajuan ulang dibuat. Lengkapi dokumen lalu kirim ke Kepala UKPBJ.':'Permohonan dibuat. Lengkapi dokumen lalu kirim ke Kepala UKPBJ.');silentSync();
      }catch(e){const message=apiErr(e);if(proc)proc.fail(message);else flash(message,'error');btn.disabled=false;btn.textContent='Buat Permohonan';}
    });
  }


  async function openDraftEditor(id,{push=true}={}){
    id=String(id||'');if(!id)return;
    const summary=state.requests.find(x=>String(x.request_id)===id),knownType=String(summary?.competition_type||'').toUpperCase();
    state.view='create-form';state.create=newCreateState();state.create.requestId=id;state.create.rupLoading=true;
    if(knownType==='CONSTRUCTION'){state.create.competitionType='CONSTRUCTION';state.create.qualifications=constructionDefaultQualifications();}
    render();
    try{
      const detail=await prefetchDetail(id)||await API().call('requestDetail',{requestId:id},{timeoutMs:22000}).then(r=>withPokja(r.data));
      if(!detail)throw new Error('Draft belum dapat dimuat.');
      state.create=hydrateCreateFromDetail(detail);state.create.postKaji=isKajiRequest(detail.request)&&detail.request.status==='PERLU_DETAIL_PPK';state.create.rupLoading=false;
      const construction=state.create.competitionType==='CONSTRUCTION';
      if(push)createRoute((construction?'permohonan/form/konstruksi/':'permohonan/form/barang-jasa/')+encodeURIComponent(id));
      render();ensureCreateRups();
      if(construction)ensureConstructionCategories().catch(()=>{});else ensureProductCategoryGroups();
    }catch(e){flash(apiErr(e),'error');state.view='requests';createRoute('permohonan',true);render()}
  }


  function uploadLabelProgress(label,pct,text='Mengunggah'){
    if(!label)return;const p=Math.max(0,Math.min(100,Math.round(Number(pct)||0)));label.style.setProperty('--upload-progress',p+'%');
    const node=[...label.childNodes].find(n=>n.nodeType===Node.TEXT_NODE);if(node)node.nodeValue=`${text} ${p}%`;
  }
  function uploadLabelText(label,text){if(!label)return;const node=[...label.childNodes].find(n=>n.nodeType===Node.TEXT_NODE);if(node)node.nodeValue=text;}
  async function finalizeUploadCall(action,payload){
    let last;for(let i=0;i<3;i++){try{return await API().call(action,payload,{timeoutMs:30000})}catch(err){last=err;if(i>=2||!/paket sedang diperbarui|koneksi ke layanan terlalu lama|layanan sedang bermasalah/i.test(err?.message||''))throw err;await new Promise(r=>setTimeout(r,350*(i+1)))}}throw last;
  }
  async function createRequestCall(data){
    let last;
    for(let i=0;i<4;i++){
      try{return await API().call('createRequest',{data},{timeoutMs:30000})}
      catch(err){
        last=err;
        if(i>=3||!/paket sedang diperbarui|koneksi ke layanan terlalu lama|layanan sedang bermasalah/i.test(err?.message||''))throw err;
        await new Promise(r=>setTimeout(r,450*(i+1)));
      }
    }
    throw last;
  }
  async function uploadDocumentFast(file,requestId,docType,label){
    const set=(patch)=>updateDocUploadState(requestId,docType,patch);
    try{
      const up=await API().directUpload(file,{purpose:'DOCUMENT',requestId,docType,onProgress:p=>set({active:true,failed:false,progress:p,text:`Mengunggah ${p}%`}),onState:stateName=>{if(stateName==='starting')set({active:true,text:'Menyiapkan…'});else if(stateName==='checking')set({active:true,text:'Memeriksa upload…'});else if(stateName==='resuming')set({active:true,text:'Melanjutkan upload…'});else if(stateName==='restarting')set({active:true,text:'Menyambungkan ulang…'})}});
      set({active:true,progress:100,text:'Menyimpan…'});
      return await finalizeUploadCall('finalizeDirectUpload',{requestId,docType,ticket:up.ticket,driveFileId:up.drive.id});
    }catch(err){
      if(err?.code!=='DIRECT_UPLOAD_UNSUPPORTED')throw err;
      set({active:true,text:'Mengunggah…'});
      const payload=await API().filePayload(file);
      return await API().call('uploadDocument',{requestId,docType,file:payload},{timeoutMs:90000});
    }
  }
  async function assignPokjaFast(file,{requestId,pokjaId,note,onProgress,onState}){
    try{
      const up=await API().directUpload(file,{purpose:'ASSIGNMENT',requestId,onProgress,onState});
      return await finalizeUploadCall('assignPokjaDirect',{requestId,pokjaId,note,ticket:up.ticket,driveFileId:up.drive.id});
    }catch(err){
      if(err?.code!=='DIRECT_UPLOAD_UNSUPPORTED')throw err;
      const payload=await API().filePayload(file);
      return await API().call('assignPokja',{requestId,pokjaId,note,file:payload},{timeoutMs:90000});
    }
  }

  function syncReviewDecisionUi(){
    const select=$('[data-review-status="__PAKET__"]');if(!select)return;
    const status=select.value||'';
    $$('[data-review-choice]').forEach(btn=>{const active=btn.dataset.reviewChoice===status;btn.classList.toggle('selected',active);btn.setAttribute('aria-pressed',String(active));});
    const upload=$('[data-review-upload-slot]');if(upload)upload.hidden=status!=='SESUAI';
    const required=$('[data-review-note-required]');if(required)required.hidden=status!=='PERLU_PERBAIKAN';
    const btn=$('[data-save-review="__PAKET__"]');if(btn)btn.textContent=status==='SESUAI'&&requestSelectionProcess(state.detail?.request)==='MINI_KOMPETISI'?'Simpan dan Tayangkan di INAPROC':'Simpan Reviu';
    const info=$('[data-review-publish-info]');if(info)info.hidden=status!=='SESUAI';
  }
  function confirmPackageReview(type){
    if(writing()||uploading(state.detail?.request?.request_id)||state.busy||!state.detail||!canReview(state.detail.request))return;
    const statusEl=$(`[data-review-status="${CSS.escape(type)}"]`),noteEl=$(`[data-review-note="${CSS.escape(type)}"]`);
    const status=statusEl?.value||'',note=(noteEl?.value||'').trim();
    if(!['SESUAI','PERLU_PERBAIKAN'].includes(status)){flash('Pilih hasil reviu.','error');return;}
    if(status==='SESUAI'&&requestSelectionProcess(state.detail?.request)==='MINI_KOMPETISI'&&['BA_HASIL_REVIU','BA_PERSETUJUAN_POKJA'].some(type=>!currentDoc(state.detail,type))){
      flash('Unggah BA Hasil Reviu dan BA Persetujuan Pokja terlebih dahulu.','error');
      $('.sel-package-review')?.scrollIntoView?.({behavior:'smooth',block:'center'});
      return;
    }
    const correction=status==='PERLU_PERBAIKAN';
    if(correction&&!note){flash('Isi catatan perbaikan terlebih dahulu.','error');noteEl?.focus?.();return;}
    const nav=navigationVersion,requestId=state.detail.request.request_id,expectedUpdatedAt=state.detail.request.updated_at||'';
    const isNego=requestSelectionProcess(state.detail?.request)==='NEGOSIASI';
    const mini=requestSelectionProcess(state.detail?.request)==='MINI_KOMPETISI';
    const title=correction?'Kembalikan ke PPK?':mini?'Simpan hasil reviu dan penayangan?':'Simpan dan lanjutkan?',message=correction?'Kembalikan paket ke PPK untuk diperbaiki sesuai catatan reviu?':isNego?'Simpan hasil reviu dan lanjutkan ke proses Negosiasi?':'Paket sudah ditayangkan di INAPROC dan kedua BA sudah diunggah?',label=correction?'Ya, kembalikan':mini?'Ya, simpan penayangan':'Ya, simpan dan lanjut';
    modal(`<div role="alertdialog" aria-modal="true" aria-labelledby="reviewConfirmTitle" aria-describedby="reviewConfirmMessage"><div class="sel-dialog-head"><div><small>HASIL REVIU</small><h4 id="reviewConfirmTitle">${title}</h4></div><button type="button" class="sel-dialog-close" data-close-sel-modal aria-label="Tutup">×</button></div><p class="sel-confirm-message" id="reviewConfirmMessage">${message}</p>${note?`<div class="sel-confirm-note"><small>CATATAN REVIU</small><p>${esc(note)}</p></div>`:''}<p class="sel-confirm-error" id="reviewConfirmError" role="alert"></p><div class="sel-form-actions"><button type="button" class="sel-ghost" data-close-sel-modal>Batal</button><button type="button" class="${correction?'sel-danger':'sel-primary'}" id="reviewConfirmGo">${label}</button></div></div>`);
    const button=$('#reviewConfirmGo');button?.focus();
    button?.addEventListener('click',async()=>{
      if(button.disabled||writing()||nav!==navigationVersion)return;
      if(statusEl.value!==status||noteEl.value.trim()!==note){$('#selModal')?.classList.remove('open');flash('Pilihan atau catatan berubah. Klik Simpan Reviu lagi.','error');return;}
      button.disabled=true;button.textContent='Menyimpan…';statusEl.disabled=true;noteEl.disabled=true;
      const error=$('#reviewConfirmError');if(error)error.textContent='';
      const proc=criticalProcess({eyebrow:'HASIL REVIU',title:correction?'Mengembalikan paket':'Menyimpan hasil reviu',message:'Menyimpan hasil pemeriksaan…'});
      try{
        const r=await API().call('submitPackageReview',{requestId,status,note,expectedUpdatedAt},{timeoutMs:30000});
        if(nav!==navigationVersion){proc.close();return;}
        proc.phase('Memperbarui tahapan paket…',94);state.detail=withPokja(r.data);rememberDetail(state.detail);pendingDetail=null;
        state.requests=state.requests.map(x=>x.request_id===requestId?state.detail.request:x);
        $('#selModal')?.classList.remove('open');renderPreservingPosition();
        const doneText=correction?'Paket berhasil dikembalikan ke PPK.':isNego?'Reviu selesai. Paket siap masuk proses Negosiasi.':'Hasil reviu dan penayangan INAPROC telah dicatat.';await proc.success(doneText);flash(correction?'Paket dikembalikan ke PPK.':isNego?'Reviu selesai. Paket siap masuk Negosiasi.':'Reviu dan penayangan berhasil dicatat.');silentSync();
      }catch(e){if(nav!==navigationVersion){proc.close();return;}const message=String(e?.message||'Reviu belum tersimpan. Coba lagi.');if(error)error.textContent=message;proc.fail(message);}
      finally{button.disabled=false;button.textContent=label;statusEl.disabled=false;noteEl.disabled=false;}
    });
  }

  async function startPostKajiMini(){
    const r=state.detail?.request;if(!r||r.status!=='PERLU_DETAIL_PPK'||!isKajiRequest(r)||requestSelectionProcess(r)!=='MINI_KOMPETISI')return;
    const detail=state.detail;state.create=hydrateCreateFromDetail(detail);state.create.postKaji=true;
    const construction=String(state.create.competitionType||r.competition_type||'').toUpperCase()==='CONSTRUCTION';
    state.view='create-form';
    createRoute(construction?'permohonan/form/konstruksi':'permohonan/form/barang-jasa');
    render();ensureCreateRups();if(construction)ensureConstructionCategories().catch(()=>{});else ensureProductCategoryGroups();
  }
  async function finishPostKajiNego(){
    const r=state.detail?.request;if(!r||r.status!=='PERLU_DETAIL_PPK'||!isKajiRequest(r)||requestSelectionProcess(r)!=='NEGOSIASI')return;
    const notes=$('#selKajiNegotiationNote')?.value||r.notes||'';
    if(!await confirmCritical({eyebrow:'NEGOSIASI',title:'Kirim detail Negosiasi ke Pokja?',message:'Metode sudah ditetapkan berdasarkan BA Kaji Ulang.',yes:'Ya, kirim'}))return;
    const proc=criticalProcess({eyebrow:'NEGOSIASI',title:'Mengirim detail pemilihan',message:'Menyimpan data…'});
    try{const response=await API().call('completeKajiDetails',{requestId:r.request_id,notes},{timeoutMs:30000});state.detail.request={...state.detail.request,...response.data};await proc.success('Detail Negosiasi dikirim.');renderPreservingPosition();refreshDetail().catch(()=>{});silentSync(90);}catch(e){const msg=apiErr(e);proc.fail(msg);flash(msg,'error')}
  }
  function bindKajiActions(){
    const d=state.detail;if(!d||!isKajiRequest(d.request))return;const r=d.request,id=r.request_id,saveDraft=()=>{const old=kajiDraftState.get(id)||{};kajiDraftState.set(id,{...old,date:$('#selKajiDate')?.value||old.date||'',note:$('#selKajiNote')?.value??old.note??'',method:$('#selKajiMethod')?.value||old.method||'',miniPath:$('input[name="selKajiMiniPath"]:checked')?.value||old.miniPath||'PPK'});};
    $$('[data-kaji-choice]').forEach(btn=>btn.addEventListener('click',()=>{saveDraft();const draft=kajiDraftState.get(id)||{};draft.decision=btn.dataset.kajiChoice;kajiDraftState.set(id,draft);$$('[data-kaji-choice]').forEach(x=>x.classList.toggle('selected',x.dataset.kajiChoice===draft.decision));const method=$('[data-kaji-method]');if(method)method.hidden=draft.decision!=='LANJUT';const mini=$('[data-kaji-mini-path]');if(mini)mini.hidden=draft.decision!=='LANJUT'||!(draft.method||'').startsWith('MINI_KOMPETISI');}));
    ['selKajiDate','selKajiNote','selKajiMethod'].forEach(x=>$('#'+x)?.addEventListener('input',saveDraft));
    $('#selKajiMethod')?.addEventListener('change',()=>{const isMini=($('#selKajiMethod')?.value||'').startsWith('MINI_KOMPETISI');const field=$('[data-kaji-mini-path]');if(field)field.hidden=!isMini||!($('[data-kaji-choice="LANJUT"]')?.classList.contains('selected'));saveDraft();});
    $$('input[name="selKajiMiniPath"]').forEach(x=>x.addEventListener('change',saveDraft));
    $('[data-kaji-doc]')?.addEventListener('change',async e=>{const file=e.target.files?.[0];if(!file||writing()||requestUploading(id))return;saveDraft();updateDocUploadState(id,'BA_KAJI_ULANG',{active:true,progress:1,text:'Mengunggah…'});try{const up=await API().directUpload(file,{purpose:'KAJI_DOCUMENT',requestId:id,docType:'BA_KAJI_ULANG',onProgress:p=>updateDocUploadState(id,'BA_KAJI_ULANG',{progress:p,text:'Mengunggah '+p+'%'})});const response=await finalizeUploadCall('finalizeDirectUpload',{requestId:id,docType:'BA_KAJI_ULANG',purpose:'KAJI_DOCUMENT',ticket:up.ticket,driveFileId:up.drive.id});const doc=response.data||response;state.detail.docs=(state.detail.docs||[]).map(x=>x.doc_type==='BA_KAJI_ULANG'?{...x,is_current:false}:x).concat(doc);clearDocUploadState(id,'BA_KAJI_ULANG');renderPreservingPosition();flash('BA Kaji Ulang diunggah.')}catch(err){if(err?.code==='DIRECT_UPLOAD_UNSUPPORTED'){try{const payload=await API().filePayload(file);const response=await API().call('uploadDocument',{purpose:'KAJI_DOCUMENT',requestId:id,docType:'BA_KAJI_ULANG',file:payload},{timeoutMs:90000});const doc=response.data||response;state.detail.docs=(state.detail.docs||[]).map(x=>x.doc_type==='BA_KAJI_ULANG'?{...x,is_current:false}:x).concat(doc);clearDocUploadState(id,'BA_KAJI_ULANG');renderPreservingPosition();flash('BA Kaji Ulang diunggah.');return}catch(fallback){err=fallback}}updateDocUploadState(id,'BA_KAJI_ULANG',{active:false,failed:true,progress:null,text:'Upload ulang'});flash(apiErr(err),'error')}finally{e.target.value=''}});
    $('[data-save-kaji]')?.addEventListener('click',async()=>{saveDraft();const x=kajiDraftState.get(id)||{},decision=x.decision||'',method=x.method||'',date=x.date||'',note=String(x.note||'').trim(),miniPath=x.miniPath||'PPK';const competitionType=method==='MINI_KOMPETISI_CONSTRUCTION'?'CONSTRUCTION':method==='MINI_KOMPETISI_NON_CONSTRUCTION'?'NON_CONSTRUCTION':'';const selectionProcess=competitionType?'MINI_KOMPETISI':method;if(!decision){flash('Pilih hasil Kaji Ulang.','error');return;}if(!date){flash('Isi tanggal Kaji Ulang.','error');return;}if(decision==='LANJUT'&&!method){flash('Pilih proses pemilihan.','error');return;}if(decision==='PERBAIKAN'&&!note){flash('Isi catatan perbaikan.','error');return;}if(!currentDoc(state.detail,'BA_KAJI_ULANG')){flash('Unggah BA Kaji Ulang terlebih dahulu.','error');return;}const methodLabel=selectionProcess==='NEGOSIASI'?'Negosiasi':competitionType==='CONSTRUCTION'?'Mini Kompetisi (Pekerjaan Konstruksi)':'Mini Kompetisi (Barang/Jasa Lainnya)';if(!await confirmCritical({eyebrow:'KAJI ULANG',title:decision==='LANJUT'?'Lanjutkan ke '+methodLabel+'?':'Kembalikan dokumen ke PPK?',message:decision==='LANJUT'&&competitionType?(miniPath==='LANGSUNG'?'PPK tidak perlu mengisi detail. Pokja langsung menyiapkan penayangan di INAPROC.':'PPK diminta mengisi detail Mini Kompetisi sebelum ditayangkan.'):'Hasil Kaji Ulang dan BA akan disimpan pada paket.',yes:'Ya, simpan'}))return;const proc=criticalProcess({eyebrow:'KAJI ULANG',title:'Menyimpan hasil',message:'Menyimpan BA dan hasil Kaji Ulang…'});try{const response=await API().call('submitKajiUlang',{requestId:id,decision,date,note,selectionProcess,competitionType,miniDetailMode:competitionType?miniPath:''},{timeoutMs:30000});state.detail=withPokja(response.data);kajiDraftState.delete(id);await proc.success('Hasil Kaji Ulang disimpan.');renderPreservingPosition();silentSync(90);}catch(e){const msg=apiErr(e);proc.fail(msg);flash(msg,'error')}});
    $('[data-kaji-open-form]')?.addEventListener('click',startPostKajiMini);
    $('[data-kaji-open-nego]')?.addEventListener('click',finishPostKajiNego);
  }
  function bindDetailActions(){
    $('[data-report-refresh]')?.addEventListener('click',async e=>{const b=e.currentTarget;if(b.disabled)return;b.disabled=true;b.textContent='Memperbarui…';try{await refreshDetail();silentSync();}catch(err){flash(apiErr(err),'error');}finally{b.disabled=false;b.textContent='Perbarui';}});
    const d=state.detail;if(!d)return;
    bindKajiActions();
    bindKajiInvitation();
    $('[data-opd-recap]')?.addEventListener('toggle',e=>{opdRecapOpen.set(String(e.currentTarget.dataset.opdRecap),e.currentTarget.open)});
    const syncPpkRevisionValidation=()=>{
      const noteField=$('#selPpkRevisionNote'),hint=$('#selPpkRevisionHint'),btn=$('[data-resubmit-revision]');
      if(!noteField)return true;
      const note=String(noteField.value||'');
      ppkRevisionDrafts.set(ppkRevisionDraftKey(d.request),note);
      if(!isKajiRequest(d.request))return true;
      const chars=characterCount(note),valid=chars>=5;
      noteField.classList.toggle('is-invalid',!valid);
      if(hint){hint.textContent=`${valid?'Catatan dapat dikirim.':'Minimal 5 karakter.'} (${chars}/5 karakter)`;hint.classList.toggle('is-error',!valid);}
      if(btn)btn.disabled=!valid;
      return valid;
    };
    $('#selPpkRevisionNote')?.addEventListener('input',syncPpkRevisionValidation);
    syncPpkRevisionValidation();
    $$('[data-doc-upload]').forEach(inp=>inp.addEventListener('change',async()=>{
      const f=inp.files?.[0],docType=inp.dataset.docUpload,requestId=d.request.request_id;if(!f||state.busy||docUploading(requestId,docType))return;const nav=navigationVersion;
      updateDocUploadState(requestId,docType,{active:true,failed:false,progress:1,text:'Menyiapkan…'});inp.disabled=true;
      try{
        const r=await uploadDocumentFast(f,requestId,docType,null);const raw=r.data||{},audit=raw._audit||null,doc={...raw};delete doc._audit;
        clearDocUploadState(requestId,docType);
        if(nav!==navigationVersion||state.detail?.request?.request_id!==requestId){silentSync(80);return;}(state.detail.docs||[]).forEach(x=>{if(x.doc_type===doc.doc_type)x.is_current=false});state.detail.docs=[...(state.detail.docs||[]),doc];addLocalAudit(audit);rememberDetail(state.detail);renderPreservingPosition();flash('Dokumen berhasil diunggah.');silentSync(80);
      }catch(e){updateDocUploadState(requestId,docType,{active:false,failed:true,progress:null,text:'Upload ulang'});if(nav===navigationVersion)flash('Upload belum selesai. Pilih Upload ulang untuk mencoba lagi.','error')}
      finally{inp.disabled=false;inp.value='';}
    }));
    bindMiniActions();
    bindNegoActions();
    $$('[data-review-choice]').forEach(btn=>btn.addEventListener('click',()=>{
      const select=$('[data-review-status="__PAKET__"]');if(!select)return;
      select.value=btn.dataset.reviewChoice||'';
      syncReviewDecisionUi();
    }));
    syncReviewDecisionUi();
    $$('[data-save-review]').forEach(btn=>btn.addEventListener('click',()=>confirmPackageReview(btn.dataset.saveReview)));
    $('[data-submit-request]')?.addEventListener('click',()=>confirmWorkflowAction('submitRequest'));$('[data-resubmit-revision]')?.addEventListener('click',sendPpkRevision);$('[data-start-review]')?.addEventListener('click',()=>confirmWorkflowAction('startReview'));$('[data-open-assign]')?.addEventListener('click',openAssign);$('[data-open-reject]')?.addEventListener('click',openReject);$('[data-reapply]')?.addEventListener('click',()=>openCreate(state.detail?.request?.kode_rup||'',state.detail?.request?.request_id||''))
  }
  // PDF BA kecil cukup satu request Apps Script. File besar tetap memakai upload langsung
  // ke Drive agar payload base64 tidak membebani memori backend.
  const NEGO_FAST_UPLOAD_MAX=2*1024*1024;
  async function uploadNegoDocumentFast(file,requestId,docType,onProgress,onState){
    if(file.size<=NEGO_FAST_UPLOAD_MAX){
      onState?.('reading');
      const payload=await API().filePayload(file,NEGO_FAST_UPLOAD_MAX);
      onState?.('sending');
      return API().call('uploadDocument',{requestId,docType,purpose:'NEGO_DOCUMENT',file:payload},{timeoutMs:75000});
    }
    try{
      const up=await API().directUpload(file,{purpose:'NEGO_DOCUMENT',requestId,docType,onProgress,onState});
      onState?.('saving');
      return await finalizeUploadCall('finalizeDirectUpload',{requestId,docType,purpose:'NEGO_DOCUMENT',ticket:up.ticket,driveFileId:up.drive.id});
    }catch(err){
      if(err?.code!=='DIRECT_UPLOAD_UNSUPPORTED')throw err;
      onState?.('reading');
      const payload=await API().filePayload(file);
      onState?.('sending');
      return API().call('uploadDocument',{requestId,docType,purpose:'NEGO_DOCUMENT',file:payload},{timeoutMs:90000});
    }
  }
  function bindNegoActions(){
    $$('[data-nego-doc]').forEach(inp=>inp.addEventListener('change',async()=>{
      const file=inp.files?.[0],type=inp.dataset.negoDoc,requestId=state.detail?.request?.request_id,nav=navigationVersion;
      if(!file||!requestId||docUploading(requestId,type)||state.busy)return;
      if(!/\.pdf$/i.test(file.name)||!file.size||file.size>10*1024*1024){flash('Gunakan PDF maksimal 10 MB.','error');inp.value='';return;}
      const set=patch=>updateDocUploadState(requestId,type,{active:true,failed:false,...patch});
      set({progress:null,text:'Menghubungkan…'});inp.disabled=true;
      const onState=s=>{
        const labels={reading:'Membaca PDF…',sending:'Mengirim & menyimpan…',starting:'Menghubungkan ke Drive…',uploading:'Mengunggah…',checking:'Memeriksa upload…',resuming:'Melanjutkan upload…',restarting:'Menyambungkan ulang…',saving:'Menyimpan dokumen…'};
        if(labels[s])set({text:labels[s],progress:null});
      };
      try{const response=await uploadNegoDocumentFast(file,requestId,type,p=>set({progress:p,text:`Mengunggah ${p}%`}),onState);const doc={...(response.data||{})},audit=doc._audit;delete doc._audit;clearDocUploadState(requestId,type);
        if(nav===navigationVersion&&state.detail?.request?.request_id===requestId){(state.detail.docs||[]).forEach(x=>{if(x.doc_type===type)x.is_current=false});state.detail.docs=[...(state.detail.docs||[]),doc];addLocalAudit(audit);rememberDetail(state.detail);renderPreservingPosition();flash('Dokumen berhasil diunggah.')}silentSync(80);
      }catch(err){updateDocUploadState(requestId,type,{active:false,failed:true,progress:null,text:'Upload ulang'});flash(apiErr(err),'error')}finally{inp.disabled=false;inp.value='';}
    }));
    $$('[data-nego-action]').forEach(b=>b.addEventListener('click',()=>negoAction(b.dataset.negoAction)));
  }
  async function negoAction(step){
    if(step!=='HANDOVER'||writing()||requestUploading(state.detail?.request?.request_id))return;
    const detail=state.detail,req=detail?.request;if(!req)return;
    const types=['NEGO_BA_HASIL_REVIU','NEGO_BA_HASIL_EVALUASI',...(Number(req.pagu)>100000000000?['NEGO_SURAT_PENETAPAN_PA_KPA']:[])];
    const missing=types.filter(type=>!currentDoc(detail,type));
    if(missing.length){flash('Lengkapi seluruh dokumen wajib sebelum handover ke PPK.','error');return;}
    if(!await confirmCritical({eyebrow:'NEGOSIASI',title:'Serahkan hasil Negosiasi ke PPK?',message:'Pastikan proses Negosiasi di INAPROC sudah selesai dan seluruh dokumen yang diunggah sesuai.',yes:'Ya, handover',no:'Periksa kembali'}))return;
    const id=req.request_id,nav=navigationVersion;
    const proc=criticalProcess({eyebrow:'NEGOSIASI',title:'Handover ke PPK',message:'Menyimpan perubahan…'});
    try{const response=await API().call('negoWorkflow',{requestId:id,step:'HANDOVER'},{timeoutMs:30000});if(nav!==navigationVersion){proc.close();return;}state.detail.request={...state.detail.request,...response.data};renderPreservingPosition();await proc.success('Handover ke PPK berhasil disimpan.');flash('Hasil Negosiasi diserahkan ke PPK.');refreshDetail().catch(()=>{})}catch(err){const message=apiErr(err);proc.fail(message);flash(message,'error')}
  }

  async function uploadMiniDocumentFast(file,requestId,docType,onProgress){
    try{const up=await API().directUpload(file,{purpose:'MINI_DOCUMENT',requestId,docType,onProgress});return await finalizeUploadCall('finalizeDirectUpload',{requestId,docType,purpose:'MINI_DOCUMENT',ticket:up.ticket,driveFileId:up.drive.id});}
    catch(err){if(err?.code!=='DIRECT_UPLOAD_UNSUPPORTED')throw err;const payload=await API().filePayload(file);return API().call('uploadDocument',{requestId,docType,purpose:'MINI_DOCUMENT',file:payload},{timeoutMs:90000});}
  }
  function bindMiniActions(){
    $$('[data-mini-doc]').forEach(inp=>inp.addEventListener('change',async()=>{
      const file=inp.files?.[0],type=inp.dataset.miniDoc,requestId=state.detail?.request?.request_id,nav=navigationVersion;
      if(!file||!requestId||docUploading(requestId,type)||writing())return;
      if(!/\.(pdf|doc|docx)$/i.test(file.name)||file.size>10*1024*1024){flash('Gunakan PDF, DOC, atau DOCX maksimal 10 MB.','error');inp.value='';return}
      updateDocUploadState(requestId,type,{active:true,failed:false,progress:1,text:'Menyiapkan…'});inp.disabled=true;
      try{const response=await uploadMiniDocumentFast(file,requestId,type,p=>updateDocUploadState(requestId,type,{active:true,progress:p,text:`Mengunggah ${p}%`}));const doc={...(response.data||{})};const audit=doc._audit,requestUpdatedAt=doc._requestUpdatedAt;delete doc._audit;delete doc._requestUpdatedAt;clearDocUploadState(requestId,type);
        if(nav===navigationVersion&&state.detail?.request?.request_id===requestId){if(requestUpdatedAt)state.detail.request.updated_at=requestUpdatedAt;(state.detail.docs||[]).forEach(x=>{if(x.doc_type===type)x.is_current=false});state.detail.docs=[...(state.detail.docs||[]),doc];addLocalAudit(audit);rememberDetail(state.detail);renderPreservingPosition();flash('Dokumen berhasil diunggah.')}silentSync(80);
      }catch(err){updateDocUploadState(requestId,type,{active:false,failed:true,progress:null,text:'Upload ulang'});flash(apiErr(err),'error')}finally{inp.disabled=false;inp.value=''}
    }));
    $$('[data-mini-decision]').forEach(btn=>btn.addEventListener('click',()=>{
      const req=state.detail?.request;if(!req)return;
      const key=String(req.request_id),old=miniDecisionState.get(key)||{};
      miniDecisionState.set(key,{...old,step:btn.dataset.miniDecision,note:old.step===btn.dataset.miniDecision?(old.note||''):''});renderPreservingPosition();
    }));
    const saveMiniDraft=()=>{const req=state.detail?.request;if(!req)return;const key=String(req.request_id),old=miniDecisionState.get(key)||{};miniDecisionState.set(key,{...old,note:$('#miniDecisionNote')?.value||'',end:$('#miniDecisionEnd')?.value,completion:$('#miniDecisionCompletion')?.value});};
    $('#miniDecisionNote')?.addEventListener('input',saveMiniDraft);
    $('#miniDecisionEnd')?.addEventListener('change',saveMiniDraft);
    $('#miniDecisionCompletion')?.addEventListener('change',saveMiniDraft);
    $('[data-mini-decision-cancel]')?.addEventListener('click',()=>{const id=state.detail?.request?.request_id;if(!id)return;miniDecisionState.delete(String(id));renderPreservingPosition();});
    $('[data-mini-decision-save]')?.addEventListener('click',()=>{
      saveMiniDraft();const detail=state.detail,key=String(detail?.request?.request_id||''),draft=miniDecisionState.get(key)||{},step=draft.step,note=String(draft.note||'').trim();
      if(!note){flash('Isi alasan atau uraian terlebih dahulu.','error');$('#miniDecisionNote')?.focus();return;}
      const type=step==='PERUBAHAN'?'BA_PERSETUJUAN':step==='BATAL'?'BA_PEMBATALAN':'';
      if(type&&!miniDecisionIsUploaded(detail,type)){flash('Unggah berita acara yang sesuai sebelum melanjutkan.','error');return;}
      const dates=step==='PERUBAHAN'?{scheduleEndDate:draft.end||'',completionDate:draft.completion||''}:{};
      submitMiniAction(step,note,dates);
    });
    $$('[data-mini-action]').forEach(b=>b.addEventListener('click',()=>miniAction(b.dataset.miniAction)));
  }
  function miniAction(step){submitMiniAction(step);}
  function miniDecisionIsUploaded(detail,type){
    const doc=currentDoc(detail,type);if(!doc)return false;
    const r=detail.request,since=type==='BA_PERSETUJUAN'?(r.mini_last_change_at||r.mini_tayang_at):r.mini_tayang_at;
    if(!since)return true;return Date.parse(doc.uploaded_at||0)>Date.parse(since);
  }
  async function submitMiniAction(step,note='',dates={}){
    const messages={TAYANG:'Penayangan kompetisi sudah dilakukan di INAPROC?',PERUBAHAN:'Simpan catatan perubahan kompetisi?',BATAL:'Batalkan kompetisi ini? Paket tidak dapat dilanjutkan.',GAGAL:'Tandai kompetisi gagal dan kembalikan ke PPK untuk reviu ulang?',EVALUASI:'Proses penawaran selesai dan evaluasi pemenang dimulai?',HANDOVER:'Pemenang sudah ditetapkan dan seluruh dokumen wajib sudah diunggah?'};
    if(writing()||requestUploading(state.detail?.request?.request_id))return;
    if(!await confirmCritical({eyebrow:'MINI KOMPETISI',title:messages[step],message:step==='HANDOVER'?'Pastikan penetapan pemenang telah dilakukan di INAPROC.':'Pastikan tindakan sudah dilakukan atau disepakati sebelum dicatat.',yes:'Ya, lanjutkan',no:'Periksa kembali',danger:step==='BATAL'}))return;
    const id=state.detail?.request?.request_id,nav=navigationVersion;if(!id)return;
    const proc=criticalProcess({eyebrow:'MINI KOMPETISI',title:'Menyimpan tahap kompetisi',message:'Menyimpan perubahan…'});
    try{const response=await API().call('miniWorkflow',{requestId:id,step,note,...dates},{timeoutMs:30000});if(nav!==navigationVersion){proc.close();return;}$('#selModal')?.classList.remove('open');state.detail.request={...state.detail.request,...response.data};miniDecisionState.delete(String(id));renderPreservingPosition();if(response?.data?.status==='BATAL')clearRupOptions();await proc.success('Tahap kompetisi berhasil disimpan.');flash('Tahap kompetisi diperbarui.');refreshDetail().catch(()=>{});silentSync(100)}catch(err){const message=apiErr(err);proc.fail(message);flash(message,'error')}
  }
  async function sendPpkRevision(){
    const r=state.detail?.request,id=r?.request_id,note=String($('#selPpkRevisionNote')?.value||'').trim();
    if(!id||r.status!=='PERLU_PERBAIKAN_PPK'||writing()||state.busy)return;
    if(requestUploading(id)){flash('Tunggu sampai unggah dokumen selesai.','error');return;}
    if(isKajiRequest(r)&&!note){flash('Isi catatan PPK untuk Pokja sebelum mengirim ulang.','error');$('#selPpkRevisionNote')?.focus();return;}
    if(isKajiRequest(r)&&characterCount(note)<5){flash('Catatan PPK minimal 5 karakter.','error');$('#selPpkRevisionNote')?.focus();return;}
    if(note.length>2000){flash('Catatan maksimal 2.000 karakter.','error');return;}
    if(!await confirmCritical({eyebrow:'TINDAK LANJUT REVIU',title:'Kirim kembali ke Pokja?',message:'Pokja akan menerima catatan PPK dan dokumen terbaru jika ada. Dokumen yang tidak berubah tetap digunakan.',yes:'Ya, kirim',no:'Periksa kembali'}))return;
    const nav=navigationVersion,proc=criticalProcess({title:'Mengirim ke Pokja',message:'Menyimpan tindak lanjut reviu…'});
    try{
      const response=await API().call('resubmitRevision',{requestId:id,note},{timeoutMs:30000});
      if(nav!==navigationVersion){proc.close();return;}
      state.detail.request={...state.detail.request,...response.data};
      ppkRevisionDrafts.delete(ppkRevisionDraftKey(r));
      renderPreservingPosition();await proc.success('Tindak lanjut dikirim ke Pokja.');flash('Tindak lanjut dikirim ke Pokja.');refreshDetail().catch(()=>{});silentSync(100);
    }catch(err){const message=apiErr(err);proc.fail(message);flash(message,'error');}
  }
  async function confirmWorkflowAction(action){const requestId=state.detail?.request?.request_id;if(!requestId)return;if(requestUploading(requestId)){flash('Masih ada dokumen yang sedang diunggah. Tunggu sampai selesai sebelum melanjutkan.','error');return}const cfg={submitRequest:{eyebrow:'KIRIM PERMOHONAN',title:'Kirim permohonan ke UKPBJ?',message:'Periksa kembali dokumen sebelum dikirim ke UKPBJ. Pastikan file yang diunggah sudah benar dan sesuai paket.',yes:'Ya, kirim',no:'Tidak, periksa lagi',msg:'Mengirim…',ok:'Permohonan dikirim ke Kepala UKPBJ.'},resubmitRevision:{eyebrow:'KIRIM PERBAIKAN',title:'Kirim perbaikan ke Pokja?',message:'Pastikan dokumen yang diperbaiki sudah benar dan catatan perbaikan sudah dipenuhi.',yes:'Ya, kirim perbaikan',no:'Tidak, periksa lagi',msg:'Mengirim…',ok:'Perbaikan dikirim ke Pokja.'},startReview:{eyebrow:'MULAI REVIU',title:'Mulai reviu paket ini?',message:'Setelah dimulai, paket masuk ke tahap reviu Pokja.',yes:'Ya, mulai reviu',no:'Batal',msg:'Membuka reviu…',ok:'Reviu dimulai.'}}[action];if(!cfg)return simpleAction(action,'Memproses…','Proses selesai.');if(!await confirmCritical(cfg))return;return simpleAction(action,cfg.msg,cfg.ok)}
  async function simpleAction(action,msg,ok){if(['sendRevision','completeReview'].includes(action)&&reviewHasChanges()){flash('Simpan hasil reviu terlebih dahulu.','error');return false;}if(requestUploading(state.detail?.request?.request_id)){flash('Masih ada dokumen yang sedang diunggah. Tunggu sampai selesai sebelum melanjutkan.','error');return false;}if(writing()||state.busy)return false;const nav=navigationVersion;const proc=criticalProcess({title:String(msg||'Memproses').replace(/…+$/,''),message:'Tunggu sampai proses selesai.'});$$('.sel-actions button').forEach(b=>b.disabled=true);try{const r=await API().call(action,{requestId:state.detail.request.request_id},{timeoutMs:30000});if(nav!==navigationVersion){proc.close();return false}proc.phase('Menyimpan perubahan…',94);if(r.data?.request)state.detail=r.data;else if(r.data?.request_id)state.detail.request={...state.detail.request,...r.data};renderPreservingPosition();await proc.success(ok);flash(ok);refreshDetail().catch(()=>{});silentSync();return true}catch(e){const message=apiErr(e);proc.fail(message);flash(message,'error');return false}finally{$$('.sel-actions button').forEach(b=>b.disabled=false)}}
  function openAssign(){const teams=state.detail?.pokja||[];modal(`<div class="sel-dialog-head"><div><small>DISPOSISI KEPALA UKPBJ</small><h4>Tetapkan Pokja Pemilihan</h4></div><button class="sel-dialog-close" data-close-sel-modal>×</button></div><div class="sel-pokja-grid">${teams.map(p=>`<label class="sel-pokja" style="cursor:pointer"><div class="sel-pokja-top"><div><b><input type="radio" name="assignPokja" value="${esc(p.pokja_id)}"> ${esc(p.nama)}</b><span>${p.members?.map(x=>esc(x.nama)).join(', ')||'Belum ada anggota'}</span></div><strong>${nf.format(p.remaining)} sisa</strong></div><div class="sel-meter ${capacityTone(p.loadPct)}"><i style="--w:${pf.format(p.loadPct||0)}%"></i></div><div class="sel-pokja-foot"><span>${p.activeCount||0} aktif</span><span>Kapasitas ${p.capacity_max||8}</span><span>${pf.format(p.loadPct||0)}%</span></div></label>`).join('')||'<div class="sel-empty"><b>Pokja belum dibuat</b>Admin harus membuat Pokja terlebih dahulu.</div>'}</div><div class="sel-field" style="margin-top:10px" id="assignOrderField"><span>SURAT PERINTAH POKJA *</span><div class="sel-assign-upload"><input id="assignOrderFile" type="file" accept=".pdf,.doc,.docx"><label class="sel-assign-upload-button" for="assignOrderFile">Pilih Dokumen</label><span class="sel-assign-upload-name" id="assignOrderName">Belum ada dokumen</span></div></label><small class="sel-field-help">PDF, DOC, DOCX · Maksimal 10 MB</small></div><label class="sel-field" style="margin-top:10px"><span>CATATAN</span><input id="assignNote" placeholder="Opsional"></label><div class="sel-form-actions"><button class="sel-ghost" data-close-sel-modal>Batal</button><button class="sel-primary" id="assignGo">Disposisikan</button></div>`);$$('input[name=assignPokja]').forEach(input=>input.addEventListener('change',()=>{$('#assignOrderFile')?.closest('.sel-field')?.scrollIntoView({behavior:window.matchMedia?.('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'center'});}));$('#assignOrderFile')?.addEventListener('change',e=>{const label=$('#assignOrderName');if(label)label.textContent=e.currentTarget.files?.[0]?.name||'Belum ada dokumen';});$('#assignGo')?.addEventListener('click',async()=>{const id=$('input[name=assignPokja]:checked')?.value,file=$('#assignOrderFile')?.files?.[0],team=teams.find(x=>String(x.pokja_id)===String(id)),note=$('#assignNote')?.value||'';if(!id){flash('Pilih Pokja.','error');return}if(!file){flash('Surat perintah Pokja wajib diunggah.','error');return}if(!/\.(pdf|doc|docx)$/i.test(file.name)){flash('Gunakan file PDF, DOC, atau DOCX.','error');return}if(writing()||uploading(state.detail?.request?.request_id)||state.busy)return;if(!await confirmCritical({eyebrow:'DISPOSISI POKJA',title:'Tetapkan Pokja untuk paket ini?',message:`Paket akan ditugaskan kepada ${team?.nama||'Pokja yang dipilih'}. Pastikan Pokja dan surat perintah sudah benar.`,yes:'Ya, tetapkan',no:'Tidak, periksa lagi'}))return;const btn=$('#assignGo');if(!btn)return;const nav=navigationVersion;btn.disabled=true;const proc=criticalProcess({eyebrow:'DISPOSISI POKJA',title:'Menetapkan Pokja',message:'Menyiapkan surat perintah…'});try{const r=await assignPokjaFast(file,{requestId:state.detail.request.request_id,pokjaId:id,note,onProgress:p=>proc.set(8+Math.round(Math.min(99,p)*.78),`Mengunggah surat perintah ${p}%`),onState:s=>{if(s==='checking')proc.phase('Memeriksa hasil upload…',86);else if(s==='resuming')proc.phase('Melanjutkan upload…',72);else if(s==='restarting')proc.phase('Menyambungkan kembali ke Drive…',24)}});if(nav!==navigationVersion){proc.close();return}proc.phase('Menyimpan disposisi…',94);$('#selModal').classList.remove('open');if(r.data?.request_id)state.detail.request={...state.detail.request,...r.data};if(r.data?.assignment_document){state.detail.docs=(state.detail.docs||[]).filter(x=>x.doc_type!=='SURAT_PERINTAH_POKJA').concat(r.data.assignment_document)}renderPreservingPosition();await proc.success('Pokja berhasil ditetapkan.');flash('Paket ditugaskan ke Pokja.');silentSync()}catch(e){const message=apiErr(e);btn.disabled=false;proc.fail(message);flash(message,'error')}})}
  function openReject(){modal(`<div class="sel-dialog-head"><div><small>KEPALA UKPBJ</small><h4>Tolak Permohonan</h4></div><button class="sel-dialog-close" data-close-sel-modal>×</button></div><label class="sel-field"><span>ALASAN PENOLAKAN *</span><select id="rejectTemplate"><option value="">Pilih alasan</option><option value="Kekurangan Dokumen">Kekurangan Dokumen</option><option value="Lainnya">Lainnya</option></select></label><label class="sel-field"><span>KETERANGAN</span><textarea id="rejectReason" placeholder="Sebutkan dokumen yang perlu dilengkapi."></textarea></label><div class="sel-form-actions"><button class="sel-ghost" data-close-sel-modal>Batal</button><button class="sel-danger" id="rejectGo">Tolak Permohonan</button></div>`);$('#rejectTemplate')?.addEventListener('change',e=>{const field=$('#rejectReason');if(field&&e.target.value==='Kekurangan Dokumen'&&!field.value.trim())field.placeholder='Sebutkan dokumen yang belum lengkap.';});$('#rejectGo')?.addEventListener('click',async()=>{const template=$('#rejectTemplate')?.value||'',note=$('#rejectReason').value.trim(),reason=template==='Kekurangan Dokumen'?(note?template+': '+note:template):note;if(!reason){flash('Keterangan penolakan wajib diisi.','error');return}if(writing()||state.busy)return;if(!await confirmCritical({eyebrow:'TOLAK PERMOHONAN',title:'Tolak permohonan ini?',message:'Permohonan akan dikembalikan ke PPK / OPD dengan alasan yang sudah ditulis.',yes:'Ya, tolak',no:'Tidak, periksa lagi',danger:true}))return;const btn=$('#rejectGo');if(!btn)return;const nav=navigationVersion;btn.disabled=true;const proc=criticalProcess({eyebrow:'TOLAK PERMOHONAN',title:'Menolak permohonan',message:'Menyimpan keputusan…'});try{const r=await API().call('rejectRequest',{requestId:state.detail.request.request_id,reason},{timeoutMs:30000});if(nav!==navigationVersion){proc.close();return}proc.phase('Memperbarui status paket…',94);clearRupOptions();$('#selModal').classList.remove('open');if(r.data?.request_id)state.detail.request={...state.detail.request,...r.data};renderPreservingPosition();await proc.success('Permohonan berhasil ditolak.');flash('Permohonan ditolak.');refreshDetail().catch(()=>{});silentSync()}catch(e){const message=apiErr(e);btn.disabled=false;proc.fail(message);flash(message,'error')}})}
  async function loadAdmin(){const nav=navigationVersion,userId=state.me?.user_id;const [r,a]=await Promise.all([API().call('adminList'),API().call('adminAudit',{limit:120})]);if(nav!==navigationVersion||userId!==state.me?.user_id)return;state.admin={...(r.data||{}),audit:a.data||[]}}
  function bindAdmin(){if(state.view!=='admin'||state.me?.role!=='ADMIN')return;
    $('[data-admin-audit-toggle]')?.addEventListener('click',event=>{const body=$('[data-admin-audit-content]'),btn=event.currentTarget;if(!body)return;body.hidden=!body.hidden;btn.textContent=body.hidden?'Tampilkan':'Sembunyikan';btn.setAttribute('aria-expanded',String(!body.hidden));});
    $('#selAdminRupFind')?.addEventListener('click',async()=>{
      const term=String($('#selAdminRupSearch')?.value||'').trim(),out=$('#selAdminRupResults'),btn=$('#selAdminRupFind');
      if(term.length<3){out.textContent='Isi minimal 3 karakter untuk mencari.';return;}
      btn.disabled=true;out.textContent='Mencari permohonan…';
      try{const response=await API().call('adminSearchRupRequests',{term},{timeoutMs:30000});
        const items=response.data||[];
        out.innerHTML=items.length?items.map(r=>`<article class="sel-admin-rup-result"><div><b>${esc(requestTitle(r))}</b><small>${esc(r.request_id)} · RUP ${esc(r.kode_rup)} · ${esc(r.opd)} · ${esc(r.status)}</small></div><button type="button" class="sel-ghost" data-admin-rup-choose="${esc(r.request_id)}">Perbarui RUP</button></article>`).join(''):'<small>Permohonan tidak ditemukan.</small>';
        $$('[data-admin-rup-choose]',out).forEach(el=>el.addEventListener('click',()=>adminUpdateRupModal(items.find(x=>x.request_id===el.dataset.adminRupChoose))));
      }catch(e){out.textContent=apiErr(e)}finally{btn.disabled=false;}
    });
    $('#selAdminRupSearch')?.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();$('#selAdminRupFind')?.click();}});
    $('#selBroadcastForm')?.addEventListener('input',event=>{delete event.currentTarget.dataset.broadcastNonce;});
    $('#selBroadcastForm')?.addEventListener('change',event=>{delete event.currentTarget.dataset.broadcastNonce;});
    $('#selBroadcastForm')?.addEventListener('submit',async event=>{
      event.preventDefault();const form=event.currentTarget,btn=$('#selBroadcastSend'),info=$('#selBroadcastResult');
      const roles=$$('input[name="broadcast-role"]:checked',form).map(el=>el.value);
      const title=$('#selBroadcastTitle').value.trim(),message=$('#selBroadcastMessage').value.trim(),requestId=$('#selBroadcastRequest').value.trim();
      const files=Array.from($('#selBroadcastFile')?.files||[]);
      if(files.length>5||files.some(file=>!file.size||file.size>10*1024*1024||!/\.(pdf|doc|docx|xls|xlsx|ppt|pptx|jpg|jpeg|png|zip)$/i.test(file.name))){info.textContent='Maksimal 5 file PDF, Office, gambar, atau ZIP. Tiap file maksimal 10 MB.';return;}
      if(!roles.length){info.textContent='Pilih minimal satu role penerima.';return;}
      if(!title||!message){info.textContent='Isi judul dan pemberitahuan dulu.';return;}
      if(state.busy||btn.disabled)return;
      const roleNames=roles.map(r=>roleLabel[r]||r).join(', ');
      if(!await confirmCritical({eyebrow:'KONFIRMASI BROADCAST',title:'Kirim pemberitahuan ini?',message:`Pemberitahuan akan dikirim ke ${roleNames}. Pastikan judul, isi, dan lampirannya sudah benar.`,yes:'Ya, kirim',no:'Periksa lagi'}))return;
      // Nonce sama saat retry jaringan, agar tidak menyimpan broadcast ganda.
      const clientId=form.dataset.broadcastNonce||('orb'+Date.now().toString(36)+Math.random().toString(36).slice(2,12));form.dataset.broadcastNonce=clientId;
      btn.disabled=true;info.textContent='Memproses pengiriman…';
      const proc=broadcastProcess();
      try{
        const attachments=[];
        if(files.length){
          // Upload bertahap supaya progress jelas dan koneksi tetap stabil.
          for(let i=0;i<files.length;i++){
            const file=files[i];proc.waiting('Mengunggah lampiran '+(i+1)+' dari '+files.length+'…');
            const uploaded=await API().directUpload(file,{purpose:'BROADCAST',requestId:'',docType:'BROADCAST_ATTACHMENT',onProgress:pct=>proc.upload(Math.round((i*100+pct)/files.length)),onState:phase=>{
              if(phase==='checking')proc.waiting('Memeriksa lampiran '+(i+1)+'…');
              else if(phase==='resuming')proc.waiting('Melanjutkan lampiran '+(i+1)+'…');
            }});
            attachments.push({ticket:uploaded.ticket,driveFileId:uploaded.drive.id});
          }
        }
        proc.waiting('Menyimpan broadcast dan penerimanya…');
        await API().call('sendBroadcast',{title,message,roles,requestId,clientId,attachments},{timeoutMs:45000});
        info.textContent='Broadcast berhasil dikirim.';form.reset();delete form.dataset.broadcastNonce;
        document.dispatchEvent(new CustomEvent('trax:notification-changed'));
        document.dispatchEvent(new CustomEvent('trax:broadcast-sent'));
        await proc.success();
      }catch(e){const error=apiErr(e);info.textContent='Belum berhasil: '+error;proc.fail(error);}
      finally{btn.disabled=false;}
    });$('[data-admin-reload]')?.addEventListener('click',async()=>{busy(true,'Memuat data admin…');try{await loadAdmin();render()}catch(e){flash(apiErr(e),'error')}finally{busy(false)}});const roleFilter=$('#selAdminUserRole'),userSearch=$('#selAdminUserSearch');
    const filterUsers=()=>{const q=String(userSearch?.value||'').trim().toLowerCase(),role=String(roleFilter?.value||'');let shown=0;$$('#selAdminUserList [data-user-role]').forEach(el=>{const visible=(!role||el.dataset.userRole===role)&&(!q||el.dataset.userQuery.includes(q));el.hidden=!visible;if(visible)shown++});const empty=$('#selAdminUserEmpty');if(empty)empty.hidden=shown!==0;};
    userSearch?.addEventListener('input',filterUsers);roleFilter?.addEventListener('change',filterUsers);
    $$('[data-delete-user]').forEach(b=>b.addEventListener('click',async()=>{
      const u=(state.admin?.users||[]).find(x=>x.user_id===b.dataset.deleteUser);if(!u)return;
      if(!await confirmCritical({eyebrow:'HAPUS PENGGUNA',title:`Hapus akses ${u.nama}?`,message:'Akun tidak bisa digunakan lagi. Riwayat permohonan dan aktivitasnya tetap tersimpan.',yes:'Ya, hapus akun',no:'Batal',danger:true}))return;
      const proc=criticalProcess({eyebrow:'HAPUS PENGGUNA',title:'Menghapus akses akun',message:'Menyimpan perubahan…'});
      try{await API().call('adminDeleteUser',{userId:u.user_id});proc.phase('Memperbarui daftar pengguna…',94);await loadAdmin();render();await proc.success('Akun dihapus dari daftar.');flash('Akun sudah dihapus.');}
      catch(e){const msg=apiErr(e);proc.fail(msg);flash(msg,'error')}
    }));
    $('[data-new-user]')?.addEventListener('click',()=>userModal());$$('[data-edit-user]').forEach(b=>b.addEventListener('click',()=>userModal(state.admin.users.find(x=>x.user_id===b.dataset.editUser))));$$('[data-reset-user]').forEach(b=>b.addEventListener('click',()=>resetPasswordModal(b.dataset.resetUser)));$('[data-new-pokja]')?.addEventListener('click',()=>pokjaModal());$$('[data-edit-pokja]').forEach(b=>b.addEventListener('click',()=>pokjaModal(state.admin.pokja.find(x=>x.pokja_id===b.dataset.editPokja))));$('[data-new-doccfg]')?.addEventListener('click',()=>docConfigModal());$$('[data-edit-doccfg]').forEach(b=>b.addEventListener('click',()=>docConfigModal(state.admin.docConfig.find(x=>x.doc_type===b.dataset.editDoccfg))));$$('[data-delete-doccfg]').forEach(b=>b.addEventListener('click',async()=>{const d=state.admin.docConfig.find(x=>x.doc_type===b.dataset.deleteDoccfg);if(!d)return;if(!await confirmCritical({eyebrow:'HAPUS DOKUMEN',title:`Hapus ${d.label} dari daftar?`,message:'Dokumen ini tidak akan muncul untuk unggahan baru. Dokumen yang sudah pernah diunggah tetap tersimpan.',yes:'Ya, hapus dari daftar',no:'Batal',danger:true}))return;const proc=criticalProcess({eyebrow:'HAPUS DOKUMEN',title:'Menghapus dari daftar',message:'Menyimpan perubahan…'});try{await API().call('adminDeleteDocConfig',{docType:d.doc_type});proc.phase('Memperbarui daftar dokumen…',94);await loadAdmin();render();await proc.success('Dokumen berhasil dihapus dari daftar persiapan.');flash('Dokumen dihapus dari daftar persiapan.')}catch(e){const message=apiErr(e);proc.fail(message);flash(message,'error')}}));$$('[data-enable-doccfg]').forEach(b=>b.addEventListener('click',async()=>{const d=state.admin.docConfig.find(x=>x.doc_type===b.dataset.enableDoccfg);if(!d)return;busy(true,'Mengaktifkan dokumen…');try{await API().call('adminSaveDocConfig',{data:{docType:d.doc_type,label:d.label,sort:Number(d.sort)||99,required:String(d.required).toLowerCase()!=='false',scope:d.scope||'ALL',active:true}});await loadAdmin();render();flash('Dokumen diaktifkan.')}catch(e){flash(apiErr(e),'error')}finally{busy(false)}}))}
  function adminUpdateRupModal(r){
    if(!r)return;
    modal(`<div class="sel-dialog-head"><div><small>ADMIN · KODE RUP</small><h4>Perbarui Kode RUP</h4></div><button class="sel-dialog-close" data-close-sel-modal>×</button></div><p class="sel-confirm-message"><b>${esc(requestTitle(r))}</b><br>Nomor ${esc(r.request_id)} · ${esc(r.opd)}<br>Kode RUP saat ini: <b>${esc(r.kode_rup)}</b></p><label class="sel-field"><span>KODE RUP BARU *</span><input id="adminNewRupCode" inputmode="numeric" autocomplete="off" placeholder="Masukkan Kode RUP terbaru" maxlength="20"></label><small class="sel-field-help">Kode baru harus ada di SiRUP, berada pada OPD yang sama, dan memiliki sisa pagu yang cukup. Nomor permohonan dan dokumen tidak berubah.</small><div class="sel-form-actions"><button class="sel-ghost" data-close-sel-modal>Batal</button><button class="sel-primary" id="adminRupSave">Simpan Kode RUP</button></div>`);
    $('#adminRupSave')?.addEventListener('click',async()=>{
      const newCode=String($('#adminNewRupCode')?.value||'').replace(/\D/g,'');
      if(!/^\d{6,20}$/.test(newCode)){flash('Isi Kode RUP terbaru yang benar.','error');return;}
      if(newCode===String(r.kode_rup)){flash('Kode RUP masih sama.','error');return;}
      if(!await confirmCritical({eyebrow:'PERUBAHAN KODE RUP',title:'Ganti Kode RUP permohonan?',message:`Permohonan ${r.request_id} akan menggunakan RUP ${newCode} untuk pencocokan INAPROC. Dokumen dan status tetap.`,yes:'Ya, perbarui',no:'Periksa lagi'}))return;
      const proc=criticalProcess({eyebrow:'PERUBAHAN KODE RUP',title:'Memeriksa RUP',message:'Memeriksa kode dan pagu di SiRUP…'});
      try{await API().call('adminUpdateRequestRup',{requestId:r.request_id,oldCode:r.kode_rup,newCode},{timeoutMs:40000});
        $('#selModal')?.classList.remove('open');clearRupOptions();
        const input=$('#selAdminRupSearch');if(input)input.value=r.request_id;
        await proc.success('Kode RUP berhasil diperbarui.');$('#selAdminRupFind')?.click();flash('Kode RUP permohonan sudah diperbarui.');
      }catch(e){const msg=apiErr(e);proc.fail(msg);flash(msg,'error');}
    });
  }
  function userModal(u={}){const opd=(state.admin?.opdMaster||[]).map(x=>x.nama_opd).filter(Boolean),selected=new Set((u.pokja_ids||[u.pokja_id]).filter(Boolean).map(String));modal(`<div class="sel-dialog-head"><div><small>ADMIN</small><h4>${u.user_id?'Ubah Akun':'Buat Akun'}</h4></div><button class="sel-dialog-close" data-close-sel-modal>×</button></div><div class="sel-form-grid"><label class="sel-field"><span>USERNAME</span><input id="auUsername" value="${esc(u.username||'')}"></label><label class="sel-field"><span>NAMA</span><input id="auName" value="${esc(u.nama||'')}"></label><label class="sel-field"><span>EMAIL</span><input id="auEmail" type="email" autocomplete="email" placeholder="nama@instansi.go.id" value="${esc(u.email||'')}"></label><label class="sel-field"><span>ROLE</span><select id="auRole">${Object.keys(roleLabel).map(r=>`<option value="${r}" ${u.role===r?'selected':''}>${esc(roleLabel[r])}</option>`).join('')}</select></label><label class="sel-field"><span>SATUAN KERJA</span><select id="auOpd"><option value="">Tidak ada</option>${opd.map(x=>`<option value="${esc(x)}" ${u.opd===x?'selected':''}>${esc(x)}</option>`).join('')}</select></label><div class="sel-field sel-pokja-member-field" id="auPokjaField"><span>ANGGOTA POKJA (BISA LEBIH DARI SATU)</span><div class="sel-pokja-members">${(state.admin.pokja||[]).map(p=>`<label><input type="checkbox" name="auPokjaIds" value="${esc(p.pokja_id)}" ${selected.has(String(p.pokja_id))?'checked':''}><span>${esc(p.nama)}</span></label>`).join('')}</div><small class="sel-field-help">Pengguna memilih Pokja aktif setelah masuk.</small></div><label class="sel-field"><span>STATUS AKUN</span><select id="auActive"><option value="1" ${u.active!==false?'selected':''}>Aktif</option><option value="0" ${u.active===false?'selected':''}>Nonaktif</option></select></label>${u.user_id?'':`<label class="sel-field"><span>PASSWORD AWAL</span><input id="auPassword" type="password"></label>`}</div><div class="sel-form-actions"><button class="sel-ghost" data-close-sel-modal>Batal</button><button class="sel-primary" id="auSave">Simpan Akun</button></div>`);const togglePokja=()=>{const field=$('#auPokjaField');if(field)field.hidden=$('#auRole')?.value!=='POKJA'};$('#auRole')?.addEventListener('change',togglePokja);togglePokja();$('#auSave')?.addEventListener('click',async()=>{const btn=$('#auSave');btn.disabled=true;try{await API().call('adminSaveUser',{data:{userId:u.user_id||'',username:$('#auUsername').value,nama:$('#auName').value,email:$('#auEmail').value.trim(),role:$('#auRole').value,opd:$('#auOpd').value,pokjaIds:$$('input[name=auPokjaIds]:checked').map(x=>x.value),password:$('#auPassword')?.value||'',active:$('#auActive').value==='1'}});$('#selModal').classList.remove('open');await loadAdmin();render();flash('Akun disimpan.')}catch(e){btn.disabled=false;flash(apiErr(e),'error')}})}
  function resetPasswordModal(userId){modal(`<div class="sel-dialog-head"><div><small>ADMIN</small><h4>Reset Password</h4></div><button class="sel-dialog-close" data-close-sel-modal>×</button></div><label class="sel-field"><span>PASSWORD BARU</span><input id="arp" type="password"></label><div class="sel-form-actions"><button class="sel-ghost" data-close-sel-modal>Batal</button><button class="sel-primary" id="arpGo">Simpan Password</button></div>`);$('#arpGo')?.addEventListener('click',async()=>{const password=$('#arp')?.value||'';if(!password){flash('Isi password baru terlebih dahulu.','error');return}if(!await confirmCritical({eyebrow:'GANTI PASSWORD',title:'Ganti password akun ini?',message:'Password lama tidak dapat dipakai lagi setelah perubahan disimpan.',yes:'Ya, ganti password',no:'Batal'}))return;const proc=criticalProcess({eyebrow:'GANTI PASSWORD',title:'Mengganti password',message:'Menyimpan password baru…'});try{await API().call('adminResetPassword',{userId,password});$('#selModal').classList.remove('open');await proc.success('Password berhasil diganti.');flash('Password diganti.')}catch(e){const message=apiErr(e);proc.fail(message);flash(message,'error')}})}
  function pokjaModal(p={}){modal(`<div class="sel-dialog-head"><div><small>ADMIN</small><h4>${p.pokja_id?'Ubah Pokja':'Buat Pokja'}</h4></div><button class="sel-dialog-close" data-close-sel-modal>×</button></div><div class="sel-form-grid"><label class="sel-field"><span>NAMA POKJA</span><input id="apName" value="${esc(p.nama||'')}"></label><label class="sel-field"><span>KAPASITAS PAKET AKTIF</span><input id="apCap" type="number" min="1" value="${esc(p.capacity_max||8)}"></label><label class="sel-field"><span>STATUS POKJA</span><select id="apActive"><option value="1" ${p.active!==false?'selected':''}>Aktif</option><option value="0" ${p.active===false?'selected':''}>Nonaktif</option></select></label></div><div class="sel-form-actions"><button class="sel-ghost" data-close-sel-modal>Batal</button><button class="sel-primary" id="apSave">Simpan Pokja</button></div>`);$('#apSave')?.addEventListener('click',async()=>{busy(true,'Menyimpan Pokja…');try{await API().call('adminSavePokja',{data:{pokjaId:p.pokja_id||'',nama:$('#apName').value,capacityMax:Number($('#apCap').value)||8,active:$('#apActive').value==='1'}});$('#selModal').classList.remove('open');await loadAdmin();render();flash('Pokja tersimpan.')}catch(e){flash(apiErr(e),'error')}finally{busy(false)}})}
  function docConfigModal(d={}){const existing=!!d.doc_type;modal(`<div class="sel-dialog-head"><div><small>ADMIN</small><h4>${existing?'Ubah Dokumen Persiapan':'Tambah Dokumen Persiapan'}</h4></div><button class="sel-dialog-close" data-close-sel-modal>×</button></div><div class="sel-form-grid"><label class="sel-field"><span>KODE</span><input id="adcType" value="${esc(d.doc_type||'')}" ${existing?'readonly':''} placeholder="CONTOH_DOKUMEN"></label><label class="sel-field"><span>NAMA DOKUMEN</span><input id="adcLabel" value="${esc(d.label||'')}" placeholder="Nama dokumen"></label><label class="sel-field"><span>URUTAN</span><input id="adcSort" type="number" min="1" value="${esc(d.sort||((state.admin?.docConfig?.length||0)+1)*10)}"></label><label class="sel-field"><span>KEWAJIBAN</span><select id="adcReq"><option value="1" ${String(d.required).toLowerCase()!=='false'?'selected':''}>Wajib</option><option value="0" ${String(d.required).toLowerCase()==='false'?'selected':''}>Opsional</option></select></label></div><div class="sel-form-actions"><button class="sel-ghost" data-close-sel-modal>Batal</button><button class="sel-primary" id="adcSave">Simpan</button></div>`);const type=$('#adcType'),label=$('#adcLabel');if(!existing&&type&&label)label.addEventListener('input',()=>{if(type.dataset.manual==='1')return;type.value=label.value.toUpperCase().normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/[^A-Z0-9]+/g,'_').replace(/^_+|_+$/g,'').slice(0,48)});if(!existing&&type)type.addEventListener('input',()=>type.dataset.manual='1');$('#adcSave')?.addEventListener('click',async()=>{busy(true,'Menyimpan dokumen…');try{await API().call('adminSaveDocConfig',{data:{docType:$('#adcType').value,label:$('#adcLabel').value,sort:Number($('#adcSort').value)||99,required:$('#adcReq').value==='1',scope:'ALL',active:true}});$('#selModal').classList.remove('open');await loadAdmin();render();flash('Dokumen persiapan tersimpan.')}catch(e){flash(apiErr(e),'error')}finally{busy(false)}})}

  async function applySelectionRoute(){
    if(!state.me)return false;
    const path=selectionPath();
    if(!path)return false;
    if(path==='permohonan'){state.view='requests';state.detail=null;state.create=null;render();return true;}
    if(path==='permohonan/proses'){state.view='requests';state.create=null;state.detail=null;createRoute('permohonan',true);render();if(state.me?.role==='PPK')openNegotiationCreate();return true;}
    if(path==='permohonan/jenis'){if(!state.create?.postKaji){state.view='requests';createRoute('permohonan',true);render();return true;}state.view='create-kind';state.detail=null;render();return true;}
    if(path==='permohonan/form/barang-jasa'){if(!state.create?.postKaji){createRoute('permohonan',true);state.view='requests';render();return true;}if(lockedPostKajiCompetitionType(state.create)==='CONSTRUCTION'){createRoute('permohonan/form/konstruksi',true);return applySelectionRoute();}state.view='create-form';state.detail=null;if(!state.create)state.create=newCreateState();state.create.competitionType='NON_CONSTRUCTION';render();ensureCreateRups();ensureProductCategoryGroups();return true;}
    if(path==='permohonan/form/konstruksi'){if(!state.create?.postKaji){createRoute('permohonan',true);state.view='requests';render();return true;}if(lockedPostKajiCompetitionType(state.create)==='NON_CONSTRUCTION'){createRoute('permohonan/form/barang-jasa',true);return applySelectionRoute();}state.view='create-form';state.detail=null;if(!state.create)state.create=newCreateState();state.create.competitionType='CONSTRUCTION';if(!(state.create.qualifications?.kecil||state.create.qualifications?.menengah||state.create.qualifications?.besar))state.create.qualifications=constructionDefaultQualifications();render();ensureCreateRups();ensureConstructionCategories().catch(()=>{});return true;}
    if(path.startsWith('permohonan/form/barang-jasa/')){const id=decodeURIComponent(path.slice('permohonan/form/barang-jasa/'.length));if(state.view==='create-form'&&state.create?.requestId===id&&state.create?.competitionType!=='CONSTRUCTION'){render();ensureCreateRups();ensureProductCategoryGroups();return true;}await openDraftEditor(id,{push:false});ensureProductCategoryGroups();return true;}
    if(path.startsWith('permohonan/form/konstruksi/')){const id=decodeURIComponent(path.slice('permohonan/form/konstruksi/'.length));if(state.view==='create-form'&&state.create?.requestId===id&&state.create?.competitionType==='CONSTRUCTION'){render();ensureCreateRups();ensureConstructionCategories().catch(()=>{});return true;}await openDraftEditor(id,{push:false});ensureConstructionCategories().catch(()=>{});return true;}
    if(path.startsWith('permohonan/detail/')){const id=decodeURIComponent(path.slice('permohonan/detail/'.length));if(state.view==='detail'&&state.detail?.request?.request_id===id){render();return true;}await openDetail(id,null,{push:false});return true;}
    if(path==='laporan'&&state.me.role==='POKJA'){state.view='skp';state.detail=null;state.create=null;render();await loadSkp();return true;}
    if(path==='admin'&&state.me.role==='ADMIN'){state.view='admin';state.detail=null;state.create=null;if(!state.admin)await loadAdmin();render();return true;}
    return false;
  }

  async function pollChanges(){
    if(document.hidden||!API()?.hasSession()||!host()?.closest('.proc-module.active')||state.busy||writing()||uploading()||anyDocUploading()||userIsInteracting())return;
    try{
      const r=await API().call('syncPulse',{}, {timeoutMs:10000}),next=String(r?.data?.version||'');
      if(!next){if(canBackgroundRender())await backgroundSync();return;}
      if(!state.syncVersion){state.syncVersion=next;return;}
      if(next===state.syncVersion){if(Date.now()-state.lastSync>12000&&canBackgroundRender())await backgroundSync();return;}
      if(canBackgroundRender())await backgroundSync();else silentSync(120);
    }catch(e){if(/aksi tidak dikenal/i.test(String(e?.message||''))&&canBackgroundRender())await backgroundSync().catch(()=>{});}
  }
  function startPolling(){stopPolling();const compact=typeof innerWidth==='number'&&innerWidth<=760,ms=compact?9000:6000;pollTimer=setInterval(()=>{pollChanges().catch(()=>{})},ms)}
  async function loadFastBootstrap(){
    if(!state.me||!API()?.hasSession()||state.syncing)return false;
    const nav=navigationVersion,userId=state.me.user_id,rev=writeVersion();state.syncing=true;
    try{
      let r;try{r=await API().call('bootstrapFast',{status:state.filterStatus,search:state.search},{timeoutMs:15000});}
      catch(e){if(/aksi tidak dikenal/i.test(String(e?.message||'')))return false;throw e}
      if(nav!==navigationVersion||userId!==state.me?.user_id||rev!==writeVersion()||writing())return false;
      const b=r.data||{};state.me=b.user||state.me;state.dashboard=b.dashboard||state.dashboard;state.requests=b.requests||state.requests||[];state.requestsLoading=false;
      state.lastSync=Date.now();state.syncVersion=String(b.syncVersion||state.syncVersion||'');saveBootCache(b);scheduleDetailPrefetch();
      if(host()?.closest('.proc-module.active')){if(!await applySelectionRoute())renderPreservingPosition();}
      setTimeout(()=>{if(canBackgroundRender()&&!state.syncing)backgroundSync().catch(()=>{})},900);return true;
    }finally{state.syncing=false}
  }
  function stopPolling(){if(pollTimer){clearInterval(pollTimer);pollTimer=null}}
  function useSession(user,bootstrap){
    navigationVersion++;clearRupOptions();docUploadStates.clear();skpFetchVersion++;skpLoading=false;state.skp=null;state.skpError='';state.skpExport=false;assignmentOpen=false;pendingDetail=null;detailCache.clear();detailCacheAt.clear();detailPrefetchLoads.clear();state.detail=null;state.admin=null;state.create=null;state.search='';state.filterStatus='';state.view='dashboard';
    state.me=user&&user.role!=='ADMIN_CONTENT'?user:null;state.dashboard=bootstrap?.dashboard||null;state.requests=bootstrap?.requests||[];state.requestsLoading=!!(state.me&&!bootstrap);
    try{state.sidebarCollapsed=localStorage.getItem('orbit_pbj_selection_side_collapsed')==='1'}catch(_){}
    state.lastSync=bootstrap?Date.now():0;state.syncVersion=String(bootstrap?.syncVersion||'');if(bootstrap)saveBootCache(bootstrap);else clearBootCache();
    if(host()?.closest('.proc-module.active')){Promise.resolve(applySelectionRoute()).then(handled=>{if(!handled)render();if(state.me){startPolling();if(bootstrap){setTimeout(()=>{if(canBackgroundRender())prefetchRupOptions();},700);scheduleDetailPrefetch();}else{setTimeout(async()=>{if(!state.me||!host()?.closest('.proc-module.active')||state.syncing)return;try{const fast=await loadFastBootstrap();if(!fast){await sync(true);if(!await applySelectionRoute())renderPreservingPosition();}setTimeout(()=>{if(canBackgroundRender())prefetchRupOptions();},180);scheduleDetailPrefetch();}catch(e){flash(apiErr(e),'error')}},30);}}else stopPolling();});}
  }

  async function activate(){
    if(!host())return;const session=window.TRAXPBJ_SESSION;
    if(session){
      const user=session.getUser(),bootstrap=session.getBootstrap();
      if(user&&user.role!=='ADMIN_CONTENT'&&(!state.me||state.me.user_id!==user.user_id))useSession(user,bootstrap);
      if(!user){state.me=null;render();session.restore().then(()=>{if(session.getUser()&&host()?.closest('.proc-module.active'))activate()});return;}
      if(user.role==='ADMIN_CONTENT'){state.me=null;render();return;}
    }
    if(state.me){if(!await applySelectionRoute())render();startPolling();if(Date.now()-state.lastSync>7000)backgroundSync().then(async()=>{if(!await applySelectionRoute()&&canBackgroundRender())renderPreservingPosition();if(canBackgroundRender())setTimeout(prefetchRupOptions,500);scheduleDetailPrefetch();}).catch(()=>{});else{setTimeout(()=>{if(canBackgroundRender())prefetchRupOptions();},700);scheduleDetailPrefetch();}return;}
    if(API()?.hasSession()){try{const fast=await loadFastBootstrap();if(!fast)await sync(true);if(!await applySelectionRoute())render();startPolling()}catch(e){flash(apiErr(e),'error')}}else render();
  }

  document.addEventListener('trax:session-change',e=>{const d=e.detail||{};if(state.me?.user_id&&state.me.user_id===d.user?.user_id&&state.me.role==='POKJA'&&String(state.me.pokja_id||'')!==String(d.user?.pokja_id||'')){navigationVersion++;detailFetchVersion++;state.detail=null;pendingDetail=null;state.create=null;state.requests=[];state.dashboard=null;state.admin=null;state.view='requests';state.lastSync=0;state.requestsLoading=true;try{clearBootCache();}catch(_){}createRoute('permohonan',true);}
    if(state.me?.user_id===d.user?.user_id&&d.bootstrap){state.me=d.user;state.dashboard=d.bootstrap.dashboard;state.requests=d.bootstrap.requests||[];state.requestsLoading=false;state.lastSync=Date.now();state.syncVersion=String(d.bootstrap.syncVersion||state.syncVersion||'');saveBootCache(d.bootstrap);scheduleDetailPrefetch();if(host()?.closest('.proc-module.active')&&canBackgroundRender())renderPreservingPosition();return;}useSession(d.user,d.bootstrap)});
  function rerender(){if(state.me&&canBackgroundRender())renderPreservingPosition()}
  function realtimeKick(){if(state.me&&host()?.closest('.proc-module.active'))pollChanges().catch(()=>{});}
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)realtimeKick()});
  document.addEventListener('trax:selection-remote-change',()=>{if(state.me)silentSync(60)});
  document.addEventListener('trax:selection-local-change',()=>{if(state.me)silentSync(60)});
  if(typeof addEventListener==='function'){addEventListener('online',realtimeKick);addEventListener('focus',realtimeKick);}
  if(typeof addEventListener==='function'){addEventListener('popstate',()=>{if(String(location.hash||'').startsWith(selectionBase)&&host()?.closest('.proc-module.active'))applySelectionRoute().catch(()=>{})});}
  window.TRAXPBJ_SELECTION={activate,rerender,useSession,openRequest:async id=>{const current=window.TRAXPBJ_SESSION?.getUser();if(!current||current.role==='ADMIN_CONTENT')return;if(!state.me||state.me.user_id!==current.user_id)useSession(current,window.TRAXPBJ_SESSION?.getBootstrap());if(id)await openDetail(String(id));else{state.view='dashboard';state.detail=null;createRoute('',true);render();}},refresh:async()=>{if(state.view==='skp')await loadSkp();else if(state.view==='detail')await refreshDetail();else{await sync(true);renderPreservingPosition()}}};
})();
