(() => {
  'use strict';
  const $=(s,c=document)=>c.querySelector(s); const $$=(s,c=document)=>[...c.querySelectorAll(s)];
  const panel=$('[data-admin-panel="forum"]'); if(!panel)return;
  const KEY='traxpbj_forum_threads_v2';
  const esc=s=>String(s??'').replace(/[&<>'"]/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[m]));
  const safeJSON=v=>{try{return JSON.parse(v)}catch{return null}};
  const initials=name=>String(name||'PBJ').trim().split(/\s+/).slice(0,2).map(x=>x[0]).join('').toUpperCase()||'PBJ';
  const statusEl=$('#forumAdminStatus'); let rows=[]; let mode='local';
  const endpoint=()=>$('#forumEndpoint').value.trim(); const adminKey=()=>$('#forumAdminKey').value.trim();
  const setStatus=(text,cls='')=>{statusEl.className='forum-admin-status'+(cls?' '+cls:'');statusEl.innerHTML=`<i></i><span>${esc(text)}</span>`};
  async function api(action,payload={},method='GET'){
    const ep=endpoint();if(!ep)throw new Error('NO_ENDPOINT');
    if(method==='GET'){const u=new URL(ep);u.searchParams.set('action',action);Object.entries(payload).forEach(([k,v])=>v!==undefined&&v!==null&&u.searchParams.set(k,String(v)));const r=await fetch(u.toString(),{cache:'no-store',credentials:'omit'});if(!r.ok)throw new Error('HTTP_'+r.status);const j=await r.json();if(j.ok===false)throw new Error(j.error||'API');return j}
    const r=await fetch(ep,{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify({action,...payload}),credentials:'omit'});if(!r.ok)throw new Error('HTTP_'+r.status);const j=await r.json();if(j.ok===false)throw new Error(j.error||'API');return j;
  }
  function localRows(){const d=safeJSON(localStorage.getItem(KEY));return Array.isArray(d)?d:[]}
  function saveLocal(d){localStorage.setItem(KEY,JSON.stringify(d))}
  async function load(){
    setStatus('Memuat data...');
    if(endpoint()){
      try{const r=await api('listThreads',{adminKey:adminKey(),includeUnpublished:1});rows=Array.isArray(r.threads)?r.threads:[];mode='sheet';setStatus(`Terhubung · ${rows.length} topik`,'online');render();return}catch(err){console.error(err);setStatus('Koneksi Google gagal · menampilkan data lokal','offline')}
    }else setStatus('Belum terhubung · data lokal browser','');
    rows=localRows();mode='local';render();
  }
  function render(){
    $('#forumAdminTotal').textContent=rows.length;
    $('#forumAdminPending').textContent=rows.filter(x=>x.published===false).length;
    $('#forumAdminMentoring').textContent=rows.filter(x=>x.status==='Pendampingan').length;
    $('#forumAdminDone').textContent=rows.filter(x=>x.status==='Selesai').length;
    const q=$('#forumAdminSearch').value.trim().toLowerCase(), f=$('#forumAdminFilter').value;
    const list=rows.filter(t=>{if(q&&![t.title,t.body,t.opd,t.author,t.category].join(' ').toLowerCase().includes(q))return false;if(f==='pending')return t.published===false;if(f!=='all')return t.status===f;return true}).sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt));
    $('#forumAdminList').innerHTML=list.length?list.map(t=>{
      const comments=(t.comments||[]).filter(c=>c.published!==false);
      return `<article class="forum-admin-card" data-admin-thread="${esc(t.id)}">
        <div class="forum-admin-card-head"><div class="forum-admin-avatar">${esc(initials(t.author))}</div><div class="forum-admin-card-copy"><small>${esc(t.author||'Pengguna PBJ')} · ${esc(t.opd||'Tanpa OPD')} · ${new Date(t.createdAt).toLocaleString('id-ID')}</small><h3>${esc(t.title)}</h3><p>${esc(t.body)}</p><div class="forum-admin-badges"><span>${esc(t.category||'Lainnya')}</span><span>${esc(t.status||'Dibuka')}</span>${t.published===false?'<span class="pending">BELUM PUBLIK</span>':''}</div></div></div>
        <div class="forum-admin-controls"><select data-field="status"><option ${t.status==='Dibuka'?'selected':''}>Dibuka</option><option ${t.status==='Dijawab'?'selected':''}>Dijawab</option><option ${t.status==='Pendampingan'?'selected':''}>Pendampingan</option><option ${t.status==='Selesai'?'selected':''}>Selesai</option></select><label class="forum-admin-check"><input data-field="published" type="checkbox" ${t.published!==false?'checked':''}> Tampilkan</label><label class="forum-admin-check"><input data-field="pinned" type="checkbox" ${t.pinned?'checked':''}> Sematkan</label><button class="primary" data-save-thread type="button">Simpan status</button></div>
        <div class="forum-admin-reply"><textarea data-reply-text placeholder="Tulis jawaban resmi UKPBJ..."></textarea><button data-send-reply type="button">Kirim jawaban</button></div>
        ${comments.length?`<div class="forum-admin-comments">${comments.slice(-4).map(c=>`<div class="forum-admin-comment"><b>${esc(c.author||'Pengguna')}</b>${c.official?' · UKPBJ':''}<br>${esc(c.body)}</div>`).join('')}</div>`:''}
      </article>`}).join(''):'<div class="forum-admin-empty">Tidak ada topik yang sesuai.</div>';
  }
  async function saveThread(card){const id=card.dataset.adminThread;const payload={threadId:id,status:$('[data-field="status"]',card).value,published:$('[data-field="published"]',card).checked,pinned:$('[data-field="pinned"]',card).checked};const b=$('[data-save-thread]',card);b.disabled=true;b.textContent='Menyimpan...';
    try{if(mode==='sheet'){await api('adminUpdateThread',{...payload,adminKey:adminKey()},'POST')}else{const d=localRows();const t=d.find(x=>x.id===id);if(t)Object.assign(t,payload,{updatedAt:new Date().toISOString()});saveLocal(d)}b.textContent='Tersimpan';setTimeout(()=>{b.disabled=false;b.textContent='Simpan status';load()},500)}catch(err){console.error(err);b.disabled=false;b.textContent='Gagal · coba lagi'}}
  async function sendReply(card){const id=card.dataset.adminThread;const ta=$('[data-reply-text]',card);const body=ta.value.trim();if(!body)return;const b=$('[data-send-reply]',card);b.disabled=true;b.textContent='Mengirim...';
    try{if(mode==='sheet'){await api('adminReply',{threadId:id,body,adminKey:adminKey()},'POST')}else{const d=localRows();const t=d.find(x=>x.id===id);if(t){t.comments=t.comments||[];t.comments.push({id:'C-'+Date.now().toString(36),createdAt:new Date().toISOString(),author:'Admin UKPBJ',body,official:true,published:true});t.status='Dijawab';t.updatedAt=new Date().toISOString();saveLocal(d)}}ta.value='';b.textContent='Terkirim';setTimeout(()=>{b.disabled=false;b.textContent='Kirim jawaban';load()},500)}catch(err){console.error(err);b.disabled=false;b.textContent='Gagal · coba lagi'}}
  $('#forumAdminList').addEventListener('click',e=>{const card=e.target.closest('[data-admin-thread]');if(!card)return;if(e.target.closest('[data-save-thread]'))saveThread(card);if(e.target.closest('[data-send-reply]'))sendReply(card)});
  $('#forumAdminSearch').addEventListener('input',render);$('#forumAdminFilter').addEventListener('change',render);
  $('#saveForumConnection').addEventListener('click',()=>{localStorage.setItem('traxpbj_forum_endpoint',endpoint());sessionStorage.setItem('traxpbj_forum_admin_key',adminKey());setStatus('Koneksi disimpan. Memeriksa...');load()});
  $('#refreshForumAdmin').addEventListener('click',load);
  $('[data-admin-tab="forum"]')?.addEventListener('click',load);
  $('#forumEndpoint').value=localStorage.getItem('traxpbj_forum_endpoint')||'';$('#forumAdminKey').value=sessionStorage.getItem('traxpbj_forum_admin_key')||'';
})();
