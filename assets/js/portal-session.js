(() => {
  'use strict';
  const $=s=>document.querySelector(s);
  const KEY='traxpbj_portal_session_v277';
  let user=null,provider='',boot=null,restoring=null,generation=0;
  const norm=s=>String(s??'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/\s*-\s*\d+(?:\.\d+){2,}\s*$/,'').toLowerCase().replace(/[^a-z0-9]/g,'');
  const scoped=()=>!!user&&['PPK','OPD'].includes(user.role);
  const opd=()=>scoped()?String(user.opd||'').trim():'';
  const matches=name=>!scoped()||!!opd()&&norm(name)===norm(opd());
  const filter=(rows,name=x=>x.name)=>(rows||[]).filter(r=>matches(name(r)));
  function scopeBucket(value={}){
    if(!scoped())return value;
    const rows=filter(value.satker),out={...value,satker:rows};
    for(const key of ['planningPackages','planningValue','realizationPackages','realizationValue'])out[key]=rows.reduce((n,r)=>n+(Number(r[key])||0),0);
    return out;
  }
  function scopeYear(value,details={}){
    if(!value||!scoped())return value;
    const out=scopeBucket(value),methods=Object.entries(details).map(([name,years])=>({name,...scopeBucket(years[value.year]||{})}));
    out.planningMethods=methods.map(m=>({name:m.name,packages:m.planningPackages,value:m.planningValue})).filter(m=>m.packages||m.value);
    out.realizationMethods=methods.map(m=>({name:m.name,packages:m.realizationPackages,value:m.realizationValue})).filter(m=>m.packages||m.value);
    return out;
  }
  function scopeItkp(value){
    if(!value||!scoped())return value;
    const rows=filter(value.rows),city=rows[0]||{name:opd()||'OPD belum ditetapkan',totalScore:0,percentages:[],scores:[],pairs:[]};
    return {...value,rows,city,average:city.totalScore,metrics:(value.metrics||[]).map((m,i)=>({...m,value:city.percentages?.[i]||0,score:city.scores?.[i]||0,pair:city.pairs?.[i]||{num:0,den:0}}))};
  }
  function header(){
    const label=$('[data-portal-label]');if(label)label.textContent=user?(user.nama||'Akun'):'Login';
    const entry=$('[data-portal-login]');if(entry)entry.setAttribute('aria-label',user?'Buka akun':'Login');
    const banner=$('#portalScope');if(banner){banner.hidden=!scoped();banner.textContent=scoped()?(opd()||'OPD akun belum ditetapkan'):'';banner.setAttribute('role','status');banner.title=scoped()?'Satuan kerja aktif':'';}
  }
  function accept(next,data=null,source='pbj'){
    generation++;
    const changed=JSON.stringify(user)!==JSON.stringify(next)||provider!==(next?source:'');
    user=next||null;provider=user?source:'';boot=data||null;
    try{if(user)sessionStorage.setItem(KEY,JSON.stringify({user,provider}));else sessionStorage.removeItem(KEY);}catch(_){}
    header();
    if(changed||data)document.dispatchEvent(new CustomEvent('trax:session-change',{detail:{user,provider,bootstrap:boot}}));
  }
  function open(){
    const dialog=$('#portalLogin');if(!dialog)return;
    const account=$('#portalAccount'),form=$('#portalLoginForm');if(account)account.hidden=!user;if(form)form.hidden=!!user;
    const name=$('#portalAccountName'),office=$('#portalAccountOffice');if(name)name.textContent=user?.nama||'';if(office)office.textContent=user?.opd||user?.role||'';
    const cms=$('#portalContentManager');if(cms)cms.hidden=provider!=='content';
    const selection=$('#portalSelectionLink');if(selection)selection.hidden=provider==='content';
    dialog.hidden=false;dialog.setAttribute('aria-hidden','false');setTimeout(()=>$(user?'#portalLogout':'#portalUsername')?.focus(),0);
  }
  function close(){const d=$('#portalLogin');if(d){d.hidden=true;d.setAttribute('aria-hidden','true')}}
  const AUTH_PHASES=[
    ['Sedang masuk','Memeriksa akun dan hak akses'],
    ['Akses diterima','Membuka ruang kerja'],
    ['Ruang kerja siap','Data dimuat saat dibutuhkan']
  ];
  function setAuthPhase(step,success=false){
    const progress=$('#portalLoginProgress'),title=$('#portalAuthTitle'),text=$('#portalAuthText');
    if(!progress)return;
    progress.classList.toggle('is-success',success);
    const phase=success?['Akses siap','Ruang kerja siap digunakan']:AUTH_PHASES[Math.max(0,Math.min(AUTH_PHASES.length-1,step))];
    if(title)title.textContent=phase[0];if(text)text.textContent=phase[1];
    progress.querySelectorAll?.('.portal-auth-dots i')?.forEach((dot,i)=>dot.classList.toggle('active',success||i<=step));
  }
  function loginBusy(on){
    const form=$('#portalLoginForm'),progress=$('#portalLoginProgress');
    form?.classList.toggle('authenticating',on);form?.setAttribute('aria-busy',String(on));if(progress)progress.hidden=!on;
    for(const id of ['#portalProvider','#portalUsername','#portalPassword']){const el=$(id);if(el)el.disabled=on;}
    if(on)setAuthPhase(0,false);
    else if(progress)progress.classList.toggle('is-success',false);
  }
  async function logout(){
    const pbj=window.TRAXPBJ_SELECTION_API,content=window.TRAXPBJ_API;
    if(pbj?.hasSession()){const token=pbj.token();pbj.call('logout',{token},{auth:false}).catch(()=>{});pbj.setToken('');}
    if(content?.hasSession()){const token=sessionStorage.getItem('traxpbj_admin_token');content.post('logout',{token},{token:false,emit:false}).catch(()=>{});content.clearSession();}
    for(const key of ['traxpbj_selection_bootstrap_v275','traxpbj_selection_bootstrap_v276','traxpbj_selection_bootstrap_v277','traxpbj_selection_bootstrap_v2713'])sessionStorage.removeItem(key);
    accept(null);close();
  }
  async function restore(){
    if(restoring)return restoring;
    restoring=(async()=>{
      const api=window.TRAXPBJ_SELECTION_API;
      let cached=null;try{cached=JSON.parse(sessionStorage.getItem(KEY)||'null')}catch(_){}
      if(api?.hasSession()){
        let cachedBoot=null;try{const box=JSON.parse(sessionStorage.getItem('traxpbj_selection_bootstrap_v2713')||'null');if(box?.data&&Date.now()-Number(box.at||0)<10*60*1000)cachedBoot=box.data;}catch(_){}
        if(cached?.provider==='pbj')accept(cached.user,cachedBoot,'pbj');
        const started=generation,token=api.token();
        const current=()=>started===generation&&token===api.token();
        try{const r=await api.call('bootstrap');if(!current())return null;accept(r.data.user,r.data,'pbj');return r.data;}
        catch(e){if(!current())return null;if(/sesi|akun tidak aktif|masuk kembali/i.test(e.message||'')){api.setToken('');accept(null);}else{const hint=$('#portalConnection');if(hint)hint.textContent='Koneksi belum tersedia. Data akan diperbarui saat tersambung.';}return null;}
      }
      if(window.TRAXPBJ_API?.hasSession()){accept({user_id:'content-admin',nama:'Admin Konten',role:'ADMIN_CONTENT'},null,'content');return null;}
      accept(null);return null;
    })().finally(()=>{restoring=null});return restoring;
  }
  async function primeSelectionBootstrap(expectedUser){
    const api=window.TRAXPBJ_SELECTION_API;if(!api?.hasSession()||!expectedUser)return;
    const expectedId=String(expectedUser.user_id||''),expectedToken=api.token();
    try{
      const r=await api.call('bootstrapFast',{status:'',search:''},{timeoutMs:15000});
      if(expectedToken!==api.token()||String(user?.user_id||'')!==expectedId)return;
      accept(expectedUser,r.data||null,'pbj');
    }catch(e){if(/aksi tidak dikenal/i.test(String(e?.message||'')))return;}
  }
  window.TRAXPBJ_SESSION={getUser:()=>user,getBootstrap:()=>boot,getProvider:()=>provider,scoped,opd,matches,filter,scopeBucket,scopeYear,scopeItkp,accept,open,close,logout,restore};
  if(!document.getElementById('portalLogin'))return;
  $('[data-portal-login]')?.addEventListener('click',e=>{e.preventDefault();open()});
  document.querySelectorAll('[data-close-portal]').forEach(b=>b.addEventListener('click',close));
  document.addEventListener('keydown',e=>{if(e.key==='Escape')close()});
  $('#portalLogout')?.addEventListener('click',logout);
  $('#portalSelectionLink')?.addEventListener('click',()=>{close();document.dispatchEvent(new CustomEvent('trax:open-control-room',{detail:{module:'selection'}}))});
  $('#portalProvider')?.addEventListener('change',()=>{const content=$('#portalProvider').value==='content';$('#portalUsernameField').hidden=content;$('#portalUsername').required=!content;});
  $('#portalLoginForm')?.addEventListener('submit',async e=>{
    e.preventDefault();const button=$('#portalSubmit'),error=$('#portalError');if(button.disabled)return;
    const mode=$('#portalProvider').value,username=$('#portalUsername').value.trim(),password=$('#portalPassword').value;
    button.disabled=true;button.textContent='Masuk…';error.textContent='';loginBusy(true);setAuthPhase(1,false);
    try{
      if(mode==='content'){
        await window.TRAXPBJ_API.login(password);
        window.TRAXPBJ_SELECTION_API?.setToken('');
        accept({user_id:'content-admin',nama:'Admin Konten',role:'ADMIN_CONTENT'},null,'content');
      }else{
        const result=await window.TRAXPBJ_SELECTION_API.login(username,password);
        window.TRAXPBJ_API?.clearSession();accept(result.data,result.bootstrap||null,'pbj');
        if(!result.bootstrap)setTimeout(()=>primeSelectionBootstrap(result.data),0);
      }
      $('#portalPassword').value='';setAuthPhase(2,false);setAuthPhase(AUTH_PHASES.length-1,true);
      close();
      if(mode==='content'&&new URLSearchParams(location.search).get('next')==='admin')location.href='../admin/';
    }catch(err){error.textContent=err.message||'Login gagal.';}
    finally{loginBusy(false);button.disabled=false;button.textContent='Masuk';}
  });
  document.addEventListener('trax:session-expired',()=>{window.TRAXPBJ_SELECTION_API?.setToken('');accept(null)});
  restore().finally(()=>{const params=new URLSearchParams(location.search);if(params.has('login')&&!user){if(params.get('next')==='admin'){$('#portalProvider').value='content';$('#portalUsernameField').hidden=true;$('#portalUsername').required=false;}open();}});
})();
