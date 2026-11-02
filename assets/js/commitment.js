(() => {
  'use strict';

  const $=(s,c=document)=>c.querySelector(s);
  const $$=(s,c=document)=>[...c.querySelectorAll(s)];
  const API=()=>window.TRAXPBJ_API;
  const idNum=new Intl.NumberFormat('id-ID');
  const idPct=new Intl.NumberFormat('id-ID',{maximumFractionDigits:1});
  const fmtRp=n=>{n=Number(n)||0;const a=Math.abs(n);if(a>=1e12)return`Rp ${idPct.format(n/1e12)} T`;if(a>=1e9)return`Rp ${idPct.format(n/1e9)} M`;if(a>=1e6)return`Rp ${idPct.format(n/1e6)} Jt`;return`Rp ${idNum.format(Math.round(n))}`;};
  const fmtFullRp=n=>`Rp ${idNum.format(Math.round(Number(n)||0))}`;
  const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const norm=s=>String(s??'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'');
  const num=v=>{if(typeof v==='number')return Number.isFinite(v)?v:0;let s=String(v??'').replace(/[^0-9,-]/g,'').replace(/\./g,'').replace(',','.');const n=Number(s);return Number.isFinite(n)?n:0;};
  const clampMoney=v=>Math.max(0,Math.round(num(v)));
  const debounce=(fn,ms=180)=>{let t;return(...a)=>{clearTimeout(t);t=setTimeout(()=>fn(...a),ms);};};
  const fmtTime=v=>{if(!v)return'—';const d=new Date(v);return Number.isNaN(d.getTime())?'—':d.toLocaleString('id-ID',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'});};

  const JENIS=['','Barang','Jasa Konsultansi','Jasa Lainnya','Pekerjaan Konstruksi'];
  const METODE=['','Tender','Seleksi','Pengadaan Langsung','E-Purchasing','Penunjukan Langsung','Tender Cepat','Belum ditetapkan'];
  const state={meta:null,workspace:null,drafts:new Map(),dirty:new Set(),page:1,pageSize:24,search:'',filter:'all',busy:false,accessCode:'',year:'2026',opd:'',active:false};
  const host=()=>$('#procCommitment');
  let accountVersion=0,accountKey='';
  const session=()=>window.TRAXPBJ_SESSION;
  const accountCurrent=v=>v===accountVersion;

  function setBusy(on,msg='Memproses data…'){
    state.busy=!!on;
    const el=$('#commitBusy'); if(el){el.classList.toggle('show',!!on);const s=el.querySelector('span');if(s)s.textContent=msg;}
    $$('[data-commit-action]').forEach(b=>b.disabled=!!on);
  }
  function flash(message,type='ok'){
    let el=$('#commitFlash');
    if(!el)return;
    el.className=`commit-flash show ${type}`;el.textContent=message;
    clearTimeout(flash._t);flash._t=setTimeout(()=>el.classList.remove('show'),4200);
  }
  function apiError(err){const m=String(err?.message||err||'Terjadi kesalahan.');if(/Aksi tidak dikenal|unknown/i.test(m))return 'Backend TRAX belum memakai versi Komitmen SIPD. Update Code.gs, jalankan setupKomitmenPBJ(), lalu deploy ulang Web App.';return m;}

  async function loadMeta(force=false){
    if(state.meta&&!force)return state.meta;
    if(!API())throw new Error('TRAX API belum siap.');
    const res=await API().get('sipdMeta',{year:state.year,...(force?{force:1}:{})});
    state.meta=res.data||{};
    if(!state.year)state.year=String(state.meta.years?.[0]||'2026');
    return state.meta;
  }

  function loginHtml(){
    if(session()&&!session().getUser())return '<div class="commit-entry"><div class="commit-entry-copy"><h3>Komitmen Perencanaan</h3><p>Login melalui menu kanan atas untuk membuka data dinas.</p><button type="button" data-commit-action="login">Login</button></div></div>';
    const years=state.meta?.years?.length?state.meta.years:['2026'];
    const opds=session()?.filter(state.meta?.opds||[])||state.meta?.opds||[];
    const locked=session()?.scoped();
    return `<div class="commit-entry">
      <div class="commit-entry-copy"><small>KOMITMEN PERENCANAAN · SIPD</small><h3>Pemetaan pagu pengadaan dan non pengadaan.</h3><p>Nilai pagu dibaca langsung dari <b>${esc(state.meta?.sourceSheet||'SIPDTARIKSIPD')}</b>. OPD menetapkan pembagian <b>Penyedia</b>, <b>Swakelola</b>, dan <b>Non Pengadaan</b> tanpa mengetik ulang pagu SIPD.</p><div class="commit-live-note"><i></i><span>Sumber SIPD terbaru${state.meta?.sourceUpdatedAt?` · ${fmtTime(state.meta.sourceUpdatedAt)}`:''}</span></div><div class="commit-source-tags">${(state.meta?.accountPrefixes||['5.1.02','5.1.05','5.1.06','5.2','5.3']).map(x=>`<span>${esc(x)}</span>`).join('')}</div></div>
      <form class="commit-login" id="commitLoginForm">
        <div class="commit-login-head"><i></i><div><b>Akses Perangkat Daerah</b><span>${locked?'OPD mengikuti akun. Masukkan kode verifikasi komitmen.':'Pilih OPD dan masukkan kode verifikasi komitmen.'}</span></div></div>
        <label><span>Tahun Anggaran</span><select id="commitYear">${years.map(y=>`<option value="${esc(y)}" ${String(y)===String(state.year)?'selected':''}>${esc(y)}</option>`).join('')}</select></label>
        <label><span>Perangkat Daerah</span><select id="commitOpd" required ${locked?'disabled':''}>${locked?'':'<option value="">Pilih Perangkat Daerah</option>'}${opds.map(o=>`<option value="${esc(o.name)}">${esc(o.name)} · ${fmtRp(o.pagu)}</option>`).join('')}</select></label>
        <label><span>Kode Verifikasi Komitmen</span><input id="commitAccess" type="password" autocomplete="one-time-code" maxlength="24" placeholder="Masukkan kode akses" required></label>
        <button type="submit" data-commit-action>Buka Komitmen Perencanaan <span>→</span></button>
        <small class="commit-login-note">Input OPD disimpan di database TRAX. Sheet SIPD tetap sebagai sumber baca.</small>
      </form>
      <div class="commit-flash" id="commitFlash"></div>
      <div class="commit-busy" id="commitBusy"><i></i><span>Memuat data…</span></div>
    </div>`;
  }

  function renderEntry(){
    if(!host())return;
    host().innerHTML=loginHtml();
  }

  async function login(){
    if(session()&&!session().getUser()){session().open();return;}
    const version=accountVersion;
    const y=$('#commitYear')?.value||state.year,opd=$('#commitOpd')?.value||'',code=$('#commitAccess')?.value||'';
    if(!opd||!code){flash('Pilih Perangkat Daerah dan isi kode akses.','error');return;}
    if(session()&&!session().matches(opd)){flash('OPD tidak sesuai akun.','error');return;}
    state.year=y;state.opd=opd;state.accessCode=code.trim();
    setBusy(true,'Mengambil data SIPD terbaru…');
    try{
      const res=await API().post('loadKomitmenWorkspace',{year:y,opd,accessCode:state.accessCode},{token:false,timeoutMs:90000});
      if(!accountCurrent(version))return;
      state.workspace=res.data||{};state.drafts=new Map();state.dirty.clear();state.page=1;state.search='';state.filter='all';
      const savedMap=new Map((state.workspace.saved||[]).map(x=>[x.sourceKey,x]));
      (state.workspace.rows||[]).forEach(r=>{
        const s=savedMap.get(r.sourceKey)||{};
        state.drafts.set(r.sourceKey,{sourceKey:r.sourceKey,penyedia:Number(s.penyedia)||0,swakelola:Number(s.swakelola)||0,nonPengadaan:Number(s.nonPengadaan)||0,jenis:s.jenis||'',metode:s.metode||'',dikecualikan:!!s.dikecualikan,catatan:s.catatan||'',sourcePagu:Number(s.sourcePagu)||0,updatedAt:s.updatedAt||''});
      });
      renderWorkspace();
    }catch(err){if(!accountCurrent(version))return;state.workspace=null;renderEntry();flash(apiError(err),'error');}
    finally{setBusy(false);}
  }

  function getDraft(row){return state.drafts.get(row.sourceKey)||{sourceKey:row.sourceKey,penyedia:0,swakelola:0,nonPengadaan:0,jenis:'',metode:'',dikecualikan:false,catatan:'',sourcePagu:0};}
  function allocated(d){return (Number(d.penyedia)||0)+(Number(d.swakelola)||0)+(Number(d.nonPengadaan)||0);}
  function rowClass(row,d){const a=allocated(d);if(!a)return'unmapped';if(Math.abs(a-row.pagu)>1)return'partial';const parts=[d.penyedia>0,d.swakelola>0,d.nonPengadaan>0].filter(Boolean).length;if(parts>1)return'mixed';if(d.penyedia>0)return'provider';if(d.swakelola>0)return'self';return'non';}
  function sourceChanged(row,d){return d.sourcePagu>0&&Math.abs(Number(d.sourcePagu)-Number(row.pagu))>1;}

  function totals(){
    const rows=state.workspace?.rows||[];let sipd=0,penyedia=0,swakelola=0,non=0,unmapped=0,changed=0;
    rows.forEach(r=>{const d=getDraft(r);sipd+=r.pagu;penyedia+=d.penyedia||0;swakelola+=d.swakelola||0;non+=d.nonPengadaan||0;const a=allocated(d);if(a===0||Math.abs(a-r.pagu)>1)unmapped+=Math.max(0,r.pagu-Math.min(r.pagu,a));if(sourceChanged(r,d))changed++;});
    const commitment=penyedia+swakelola;
    const model=window.TRAXPBJ_CONTROL_ROOM?.getModel?.();
    let sirup=0,sirupPackages=0;
    if(model?.plans){const target=norm(state.opd);model.plans.forEach(p=>{if(String(p.tahun)!==String(state.year))return;if(norm(p.satker)===target){sirup+=Number(p.pagu)||0;sirupPackages++;}});}
    return{sipd,penyedia,swakelola,non,unmapped,commitment,changed,sirup,sirupPackages,coverage:commitment?sirup/commitment*100:0};
  }

  function statusBadge(){const s=String(state.workspace?.status?.status||'DRAFT').toUpperCase();return `<span class="commit-status ${s.replace(/\s+/g,'-').toLowerCase()}"><i></i>${esc(s)}</span>`;}

  function workspaceHeader(){const t=totals(),st=state.workspace?.status||{};return `<div class="commit-top">
    <div class="commit-title"><small>KOMITMEN PERENCANAAN · ${esc(state.year)}</small><h3>${esc(state.opd)}</h3><p><b>${idNum.format(state.workspace?.rows?.length||0)} baris</b> dibaca dari ${esc(state.workspace?.sourceSheet||'SIPDTARIKSIPD')}.</p><div class="commit-source-live"><i></i><span>Data SIPD terbaru${state.workspace?.sourceUpdatedAt?` · diperbarui ${fmtTime(state.workspace.sourceUpdatedAt)}`:''}</span></div></div>
    <div class="commit-top-actions">${statusBadge()}<button type="button" class="ghost" data-commit-action="refresh">Perbarui Data</button><button type="button" class="ghost" data-commit-action="switch">Ganti OPD</button></div>
  </div>
  <div class="commit-kpis">
    <article class="hero"><small>PAGU SIPD DIPANTAU</small><strong>${fmtRp(t.sipd)}</strong><span>Rekening 5.1.02 · 5.1.05 · 5.1.06 · 5.2 · 5.3</span></article>
    <article><small>KOMITMEN RUP</small><strong>${fmtRp(t.commitment)}</strong><span>Penyedia + Swakelola</span></article>
    <article><small>PENYEDIA</small><strong>${fmtRp(t.penyedia)}</strong><span>Pagu melalui penyedia</span></article>
    <article><small>SWAKELOLA</small><strong>${fmtRp(t.swakelola)}</strong><span>Pagu swakelola</span></article>
    <article><small>NON PENGADAAN</small><strong>${fmtRp(t.non)}</strong><span>Tidak menjadi target RUP</span></article>
    <article class="${t.unmapped?'warn':''}"><small>BELUM DIPETAKAN</small><strong>${fmtRp(t.unmapped)}</strong><span>${t.changed?`${t.changed} baris berubah dari data yang terakhir disimpan`:'Harus Rp0 sebelum diajukan'}</span></article>
  </div>
  <div class="commit-rup-compare"><div><small>REKONSILIASI SIRUP</small><b>${fmtRp(t.sirup)}</b><span>${idNum.format(t.sirupPackages)} paket SiRUP pada OPD ini</span></div><div class="commit-rup-meter"><i style="--w:${Math.max(0,Math.min(100,t.coverage))}%"></i></div><strong>${t.commitment?`${idPct.format(t.coverage)}%`:'—'}</strong><p>Perbandingan pagu SiRUP dengan Komitmen RUP berdasarkan nama OPD.</p></div>
  <div class="commit-profile">
    <label><span>PIC / Penginput</span><input id="commitPic" value="${esc(st.pic||'')}" placeholder="Nama penginput"></label>
    <label><span>NIP / Identitas</span><input id="commitNip" value="${esc(st.nip||'')}" placeholder="Opsional"></label>
    <label><span>No. WhatsApp</span><input id="commitWhatsapp" value="${esc(st.whatsapp||'')}" placeholder="08xxxxxxxxxx"></label>
    <label class="wide"><span>Catatan OPD</span><input id="commitNote" value="${esc(st.catatan||'')}" placeholder="Catatan umum bila ada"></label>
  </div>`;}

  function filteredRows(){
    const rows=state.workspace?.rows||[],q=norm(state.search);
    return rows.filter(r=>{const d=getDraft(r),cls=rowClass(r,d);if(state.filter==='unmapped'&&cls!=='unmapped'&&cls!=='partial')return false;if(state.filter==='provider'&&!(d.penyedia>0))return false;if(state.filter==='self'&&!(d.swakelola>0))return false;if(state.filter==='non'&&!(d.nonPengadaan>0))return false;if(state.filter==='mixed'&&cls!=='mixed')return false;if(state.filter==='changed'&&!sourceChanged(r,d))return false;if(q&&!norm([r.namaPaket,r.namaRekening,r.namaSubKegiatan,r.kodeRekening,r.kodeSubKegiatan].join(' ')).includes(q))return false;return true;});
  }

  function selectOptions(values,current){return values.map(v=>`<option value="${esc(v)}" ${v===current?'selected':''}>${esc(v||'— Pilih —')}</option>`).join('');}
  function rowCard(row,index){const d=getDraft(row),cls=rowClass(row,d),sum=allocated(d),diff=row.pagu-sum,changed=sourceChanged(row,d);return `<article class="commit-row ${cls} ${changed?'source-changed':''}" data-source-key="${esc(row.sourceKey)}">
    <div class="commit-row-main"><div class="commit-row-no">${String(index+1).padStart(2,'0')}</div><div class="commit-row-copy"><div class="commit-row-tags"><span>${esc(row.kodeRekening)}</span><span>${esc(row.paketKelompok||'Paket')}</span>${changed?'<span class="changed">PAGU BERUBAH</span>':''}</div><b>${esc(row.namaPaket||row.namaRekening||'Tanpa nama paket')}</b><p>${esc(row.namaSubKegiatan||'—')}</p><small>${esc(row.namaRekening||'—')}</small></div><div class="commit-row-pagu"><small>PAGU SIPD</small><strong>${fmtFullRp(row.pagu)}</strong>${changed?`<span>Sebelumnya ${fmtFullRp(d.sourcePagu)}</span>`:''}</div></div>
    <div class="commit-quick"><span>PILIH CEPAT</span><button type="button" data-quick="provider">Penyedia 100%</button><button type="button" data-quick="self">Swakelola 100%</button><button type="button" data-quick="non">Non Pengadaan 100%</button><button type="button" data-quick="clear">Kosongkan</button></div>
    <div class="commit-allocation">
      <label><span>Penyedia</span><input inputmode="numeric" data-field="penyedia" value="${d.penyedia?Math.round(d.penyedia):''}" placeholder="0"><em>${fmtRp(d.penyedia)}</em></label>
      <label><span>Swakelola</span><input inputmode="numeric" data-field="swakelola" value="${d.swakelola?Math.round(d.swakelola):''}" placeholder="0"><em>${fmtRp(d.swakelola)}</em></label>
      <label><span>Non Pengadaan</span><input inputmode="numeric" data-field="nonPengadaan" value="${d.nonPengadaan?Math.round(d.nonPengadaan):''}" placeholder="0"><em>${fmtRp(d.nonPengadaan)}</em></label>
      <div class="commit-balance ${Math.abs(diff)<=1&&sum>0?'ok':sum===0?'empty':'bad'}"><small>SELISIH</small><b>${sum===0?fmtFullRp(row.pagu):fmtFullRp(diff)}</b><span>${sum===0?'Belum dipetakan':Math.abs(diff)<=1?'Pagu sudah seimbang':'Harus Rp0'}</span></div>
    </div>
    <div class="commit-provider ${d.penyedia>0?'show':''}">
      <label><span>Jenis Pengadaan</span><select data-field="jenis">${selectOptions(JENIS,d.jenis)}</select></label>
      <label><span>Metode Rencana</span><select data-field="metode">${selectOptions(METODE,d.metode)}</select></label>
      <label class="commit-check"><input type="checkbox" data-field="dikecualikan" ${d.dikecualikan?'checked':''}><span><b>PBJ Dikecualikan</b><small>Gunakan bila belanja tetap PBJ dan termasuk pengadaan dikecualikan.</small></span></label>
      <label class="wide"><span>Catatan</span><input data-field="catatan" value="${esc(d.catatan)}" placeholder="Alasan klasifikasi / keterangan bila perlu"></label>
    </div>
  </article>`;}

  function listHtml(){const rows=filteredRows(),pages=Math.max(1,Math.ceil(rows.length/state.pageSize));state.page=Math.min(state.page,pages);const start=(state.page-1)*state.pageSize,part=rows.slice(start,start+state.pageSize);return `<div class="commit-toolbar"><label class="commit-search"><span>CARI PAKET / REKENING</span><input id="commitSearch" value="${esc(state.search)}" placeholder="Nama paket, rekening, sub kegiatan…"></label><label><span>STATUS PEMETAAN</span><select id="commitFilter"><option value="all" ${state.filter==='all'?'selected':''}>Semua data</option><option value="unmapped" ${state.filter==='unmapped'?'selected':''}>Belum dipetakan</option><option value="provider" ${state.filter==='provider'?'selected':''}>Ada Penyedia</option><option value="self" ${state.filter==='self'?'selected':''}>Ada Swakelola</option><option value="non" ${state.filter==='non'?'selected':''}>Ada Non Pengadaan</option><option value="mixed" ${state.filter==='mixed'?'selected':''}>Campuran</option><option value="changed" ${state.filter==='changed'?'selected':''}>Pagu SIPD berubah</option></select></label><div class="commit-toolbar-count"><b>${idNum.format(rows.length)}</b><span>baris ditemukan</span></div></div>
  <div class="commit-list">${part.length?part.map((r,i)=>rowCard(r,start+i)).join(''):'<div class="commit-empty">Tidak ada data sesuai filter.</div>'}</div>
  <div class="commit-pagination"><button type="button" data-page="prev" ${state.page<=1?'disabled':''}>← Sebelumnya</button><span>Halaman <b>${state.page}</b> dari ${pages}</span><button type="button" data-page="next" ${state.page>=pages?'disabled':''}>Berikutnya →</button></div>`;}

  function footerHtml(){return `<div class="commit-footer"><div><small>PERUBAHAN BELUM DISIMPAN</small><b id="commitDirtyCount">${state.dirty.size} baris berubah</b><span>Simpan sebelum berpindah halaman atau mengajukan komitmen.</span></div><div class="commit-footer-actions"><button type="button" class="secondary" data-commit-action="save">Simpan Draft</button><button type="button" class="primary" data-commit-action="submit">Ajukan Komitmen OPD</button></div></div><div class="commit-flash" id="commitFlash"></div><div class="commit-busy" id="commitBusy"><i></i><span>Memproses data…</span></div>`;}

  function renderWorkspace(){if(!host()||!state.workspace)return;host().innerHTML=`<div class="commit-workspace">${workspaceHeader()}${listHtml()}${footerHtml()}</div>`;}
  function captureProfile(){if(!state.workspace?.status)return;const p=profilePayload();state.workspace.status={...state.workspace.status,pic:p.pic,nip:p.nip,whatsapp:p.whatsapp,catatan:p.note};}
  function rerenderList({focusSearch=false}={}){captureProfile();const scrollTop=host()?.scrollTop||0;renderWorkspace();if(host())host().scrollTop=Math.min(scrollTop,host().scrollHeight);if(focusSearch){const el=$('#commitSearch');if(el){el.focus();try{el.setSelectionRange(el.value.length,el.value.length);}catch(_){}}}}
  function markDirty(key){state.dirty.add(key);const el=$('#commitDirtyCount');if(el)el.textContent=`${state.dirty.size} baris berubah`;}
  function refreshCard(card,row,d){if(!card||!row||!d)return;const sum=allocated(d),diff=row.pagu-sum,cls=rowClass(row,d);card.classList.remove('unmapped','partial','provider','self','non','mixed');card.classList.add(cls);const fields=['penyedia','swakelola','nonPengadaan'];fields.forEach(f=>{const input=card.querySelector(`[data-field="${f}"]`);const em=input?.parentElement?.querySelector('em');if(em)em.textContent=fmtRp(d[f]||0);});const bal=card.querySelector('.commit-balance');if(bal){bal.classList.remove('ok','bad','empty');bal.classList.add(Math.abs(diff)<=1&&sum>0?'ok':sum===0?'empty':'bad');const b=bal.querySelector('b'),sp=bal.querySelector('span');if(b)b.textContent=sum===0?fmtFullRp(row.pagu):fmtFullRp(diff);if(sp)sp.textContent=sum===0?'Belum dipetakan':Math.abs(diff)<=1?'Pagu sudah seimbang':'Harus Rp0';}card.querySelector('.commit-provider')?.classList.toggle('show',d.penyedia>0);}

  function updateDraftFromInput(card,input){const key=card?.dataset.sourceKey,row=(state.workspace?.rows||[]).find(r=>r.sourceKey===key);if(!key||!row)return;const d=getDraft(row),field=input.dataset.field;if(['penyedia','swakelola','nonPengadaan'].includes(field)){d[field]=clampMoney(input.value);}else if(field==='dikecualikan'){d[field]=!!input.checked;}else d[field]=input.value||'';state.drafts.set(key,d);markDirty(key);}
  function applyQuick(card,type){const key=card?.dataset.sourceKey,row=(state.workspace?.rows||[]).find(r=>r.sourceKey===key);if(!row)return;const d=getDraft(row);d.penyedia=0;d.swakelola=0;d.nonPengadaan=0;if(type==='provider')d.penyedia=row.pagu;if(type==='self')d.swakelola=row.pagu;if(type==='non')d.nonPengadaan=row.pagu;if(type!=='provider'){d.jenis='';d.metode='';d.dikecualikan=false;}state.drafts.set(key,d);markDirty(key);rerenderList();}

  function profilePayload(){return{pic:$('#commitPic')?.value?.trim()||'',nip:$('#commitNip')?.value?.trim()||'',whatsapp:$('#commitWhatsapp')?.value?.trim()||'',note:$('#commitNote')?.value?.trim()||''};}
  function validateDirty(keys){for(const key of keys){const row=(state.workspace?.rows||[]).find(r=>r.sourceKey===key),d=state.drafts.get(key);if(!row||!d)continue;const a=allocated(d);if(a>0&&Math.abs(a-row.pagu)>1)throw new Error(`Pagu belum seimbang: ${row.namaPaket||row.namaRekening}. Selisih ${fmtFullRp(row.pagu-a)}.`);if(d.penyedia>0&&!d.dikecualikan&&!d.jenis)throw new Error(`Jenis pengadaan belum dipilih: ${row.namaPaket||row.namaRekening}.`);}return true;}
  function rowPayload(key){const d=state.drafts.get(key);return{sourceKey:key,penyedia:d.penyedia||0,swakelola:d.swakelola||0,nonPengadaan:d.nonPengadaan||0,jenis:d.jenis||'',metode:d.metode||'',dikecualikan:!!d.dikecualikan,catatan:d.catatan||''};}

  async function saveDirty({silent=false}={}){
    const version=accountVersion;
    const keys=[...state.dirty];if(!keys.length){if(!silent)flash('Tidak ada perubahan yang perlu disimpan.','info');return 0;}
    validateDirty(keys);const profile=profilePayload();let total=0;
    for(let i=0;i<keys.length;i+=100){const batch=keys.slice(i,i+100);setBusy(true,`Menyimpan draft ${Math.min(i+100,keys.length)} / ${keys.length}…`);const res=await API().post('saveKomitmen',{year:state.year,opd:state.opd,accessCode:state.accessCode,rows:batch.map(rowPayload),...profile},{token:false,timeoutMs:120000});if(!accountCurrent(version))throw new Error('Akun sudah berganti.');total+=Number(res.data?.saved)||batch.length;batch.forEach(k=>{state.dirty.delete(k);const d=state.drafts.get(k);const row=(state.workspace?.rows||[]).find(r=>r.sourceKey===k);if(d&&row)d.sourcePagu=row.pagu;});}
    if(state.workspace?.status){state.workspace.status={...state.workspace.status,status:'DRAFT',...profile,catatan:profile.note,updatedAt:new Date().toISOString()};}
    if(!silent)flash(`${total} baris disimpan.`,'ok');return total;
  }

  async function submitCommitment(){
    const version=accountVersion;
    const rows=state.workspace?.rows||[];const missing=rows.filter(r=>{const d=getDraft(r),a=allocated(d);return Math.abs(a-r.pagu)>1;});
    if(missing.length){state.filter='unmapped';state.page=1;rerenderList();throw new Error(`Masih ada ${missing.length} baris yang belum dipetakan penuh. Filter sudah diarahkan ke data yang belum selesai.`);}
    if(state.dirty.size)await saveDirty({silent:true});
    const p=profilePayload();if(!p.pic)throw new Error('Isi nama PIC / penginput sebelum mengajukan komitmen.');
    setBusy(true,'Mengajukan komitmen OPD…');
    const res=await API().post('submitKomitmen',{year:state.year,opd:state.opd,accessCode:state.accessCode,...p},{token:false,timeoutMs:120000});
    if(!accountCurrent(version))return;
    state.workspace.status={...state.workspace.status,status:res.data?.status||'DIAJUKAN',pic:p.pic,nip:p.nip,whatsapp:p.whatsapp,catatan:p.note,submittedAt:res.data?.submittedAt||new Date().toISOString()};
    renderWorkspace();flash('Komitmen perencanaan diajukan ke PBJ.','ok');
  }

  async function refreshWorkspace(){
    const version=accountVersion;
    if(!state.opd||!state.accessCode)return;
    if(state.dirty.size){flash('Simpan perubahan sebelum memperbarui data SIPD.','info');return;}
    setBusy(true,'Memperbarui data SIPD…');
    const res=await API().post('loadKomitmenWorkspace',{year:state.year,opd:state.opd,accessCode:state.accessCode,force:true},{token:false,timeoutMs:90000});
    if(!accountCurrent(version))return;
    state.workspace=res.data||{};
    const savedMap=new Map((state.workspace.saved||[]).map(x=>[x.sourceKey,x]));
    state.drafts=new Map();
    (state.workspace.rows||[]).forEach(r=>{
      const x=savedMap.get(r.sourceKey)||{};
      state.drafts.set(r.sourceKey,{sourceKey:r.sourceKey,penyedia:Number(x.penyedia)||0,swakelola:Number(x.swakelola)||0,nonPengadaan:Number(x.nonPengadaan)||0,jenis:x.jenis||'',metode:x.metode||'',dikecualikan:!!x.dikecualikan,catatan:x.catatan||'',sourcePagu:Number(x.sourcePagu)||0,updatedAt:x.updatedAt||''});
    });
    state.page=1;
    renderWorkspace();
    flash('Data SIPD sudah diperbarui.','ok');
  }

  async function activate(){
    state.active=true;if(!host())return;
    if(state.workspace){renderWorkspace();return;}
    host().innerHTML='<div class="commit-boot"><i></i><b>Memuat Komitmen Perencanaan</b><span>Mengambil daftar OPD dari SIPDTARIKSIPD…</span></div>';
    try{await loadMeta();renderEntry();}catch(err){host().innerHTML=`<div class="commit-error"><b>Komitmen Perencanaan belum dapat dibuka.</b><p>${esc(apiError(err))}</p><button type="button" data-commit-action="retry">Coba lagi</button></div>`;}
  }

  document.addEventListener('submit',e=>{if(e.target?.id==='commitLoginForm'){e.preventDefault();login();}});
  document.addEventListener('click',async e=>{
    const quick=e.target.closest('[data-quick]');if(quick){applyQuick(quick.closest('.commit-row'),quick.dataset.quick);return;}
    const page=e.target.closest('[data-page]');if(page){state.page+=page.dataset.page==='next'?1:-1;rerenderList();return;}
    const action=e.target.closest('[data-commit-action]')?.dataset.commitAction;if(!action)return;
    try{
      if(action==='login'){session()?.open();return;}
      if(action==='switch'){state.workspace=null;state.opd='';state.accessCode='';state.drafts.clear();state.dirty.clear();renderEntry();}
      else if(action==='save'){setBusy(true,'Menyimpan draft…');await saveDirty();renderWorkspace();}
      else if(action==='submit'){await submitCommitment();}
      else if(action==='refresh'){await refreshWorkspace();}
      else if(action==='retry'){state.meta=null;await activate();}
    }catch(err){flash(apiError(err),'error');}finally{setBusy(false);}
  });
  document.addEventListener('input',debounce(e=>{
    if(e.target?.id==='commitSearch'){state.search=e.target.value||'';state.page=1;rerenderList({focusSearch:true});return;}
    const input=e.target.closest('.commit-row [data-field]');if(input){const card=input.closest('.commit-row');updateDraftFromInput(card,input);if(['penyedia','swakelola','nonPengadaan'].includes(input.dataset.field)){const key=card?.dataset.sourceKey,row=(state.workspace?.rows||[]).find(r=>r.sourceKey===key);refreshCard(card,row,state.drafts.get(key));}}
  },180));
  document.addEventListener('change',e=>{
    if(e.target?.id==='commitFilter'){state.filter=e.target.value||'all';state.page=1;rerenderList();return;}
    if(e.target?.id==='commitYear'&&!state.workspace){state.year=e.target.value;state.meta=null;loadMeta(true).then(renderEntry).catch(err=>flash(apiError(err),'error'));return;}
    const input=e.target.closest('.commit-row [data-field]');if(input){updateDraftFromInput(input.closest('.commit-row'),input);rerenderList();}
  });

  document.addEventListener('trax:session-change',()=>{const u=session()?.getUser(),key=JSON.stringify([u?.user_id,u?.role,u?.opd]);if(key===accountKey)return;accountKey=key;accountVersion++;state.workspace=null;state.opd='';state.accessCode='';state.drafts.clear();state.dirty.clear();if(state.active)renderEntry();});

  window.TRAXPBJ_COMMITMENT={activate,rerender:()=>{if(state.workspace)renderWorkspace();},refresh:async()=>{if(state.workspace)await refreshWorkspace();else{state.meta=null;await activate();}},prefetch:()=>loadMeta().catch(()=>null),getState:()=>state};
  const idle=window.requestIdleCallback||((fn)=>setTimeout(fn,1600));
  idle(()=>{if(!state.meta)loadMeta().catch(()=>{});},{timeout:3500});
})();
