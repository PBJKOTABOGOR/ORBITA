(() => {
  'use strict';
  const $=(s,c=document)=>c.querySelector(s); const $$=(s,c=document)=>[...c.querySelectorAll(s)];
  const KEY='traxpbj_forum_threads_v2';
  const SESSION_KEY='traxpbj_forum_session';
  const cfg=()=>window.TRAXPBJ_FORUM_CONFIG||{};
  const esc=s=>String(s??'').replace(/[&<>'"]/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[m]));
  const safeJSON=v=>{try{return JSON.parse(v)}catch{return null}};
  const now=()=>new Date().toISOString();
  const uid=(p='F')=>`${p}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,8)}`;
  const session=()=>{let v=localStorage.getItem(SESSION_KEY);if(!v){v=uid('S');localStorage.setItem(SESSION_KEY,v)}return v};
  const categories=['Semua','Perencanaan','e-Purchasing','Pemilihan','Kontrak','SiRUP','SPSE','Lainnya'];
  const reactions=['👍','💡','🙌','👀'];
  const initial=[
    {id:'contoh-epurchasing',createdAt:'2026-09-08T08:20:00+07:00',updatedAt:'2026-09-08T09:12:00+07:00',author:'Pengguna PBJ',opd:'Perangkat Daerah',category:'e-Purchasing',title:'Tahapan transaksi e-Purchasing dalam satu hari',body:'Apakah negosiasi, surat pesanan, dan penyelesaian administrasi transaksi dapat dilakukan pada hari yang sama?',status:'Dijawab',published:true,pinned:false,reactions:{'👍':8,'💡':3,'🙌':1,'👀':4},reactedBy:{},comments:[{id:'c1',createdAt:'2026-09-08T09:12:00+07:00',author:'Admin UKPBJ',body:'Boleh kirim ID paketnya? Kami cek dulu tahapan transaksi dan dokumen yang terbentuk di sistem.',official:true,published:true}]},
    {id:'contoh-ppk',createdAt:'2026-09-07T11:05:00+07:00',updatedAt:'2026-09-07T13:40:00+07:00',author:'Pengguna PBJ',opd:'Perangkat Daerah',category:'Kontrak',title:'Pergantian PPK dalam pelaksanaan kontrak',body:'Apabila terjadi pergantian PPK pada saat kontrak masih berjalan, bagian apa saja yang perlu disesuaikan dalam administrasi pelaksanaan kontrak?',status:'Pendampingan',published:true,pinned:false,reactions:{'👍':12,'💡':5,'🙌':2,'👀':6},reactedBy:{},comments:[{id:'c2',createdAt:'2026-09-07T13:40:00+07:00',author:'Admin UKPBJ',body:'Untuk kasus seperti ini, detail paket dan dokumen kontraknya perlu dilihat dulu. Kalau ada, lampirkan dokumen pendukung supaya bisa ditelaah lebih lanjut.',official:true,published:true}]},
    {id:'contoh-sirup',createdAt:'2026-09-06T10:15:00+07:00',updatedAt:'2026-09-06T10:15:00+07:00',author:'Pengguna PBJ',opd:'Perangkat Daerah',category:'SiRUP',title:'Penyesuaian RUP setelah pergeseran anggaran',body:'Bagaimana langkah penyesuaian paket RUP ketika terjadi perubahan struktur anggaran dan nilai paket setelah pergeseran?',status:'Dibuka',published:true,pinned:false,reactions:{'👍':5,'💡':2,'🙌':0,'👀':3},reactedBy:{},comments:[]}
  ];
  const readLocal=()=>{let d=safeJSON(localStorage.getItem(KEY));if(!Array.isArray(d)){d=initial;localStorage.setItem(KEY,JSON.stringify(d))}return d};
  const writeLocal=d=>{try{localStorage.setItem(KEY,JSON.stringify(d))}catch(_){}};
  const endpoint=()=>String(cfg().endpoint||localStorage.getItem('traxpbj_forum_endpoint')||'').trim();
  async function api(action,payload={},method='GET'){
    const ep=endpoint(); if(!ep) throw new Error('NO_ENDPOINT');
    if(method==='GET'){
      const u=new URL(ep);u.searchParams.set('action',action);Object.entries(payload).forEach(([k,v])=>v!==undefined&&v!==null&&u.searchParams.set(k,String(v)));
      const r=await fetch(u.toString(),{cache:'no-store',credentials:'omit'}); if(!r.ok)throw new Error('HTTP_'+r.status); const j=await r.json(); if(j.ok===false)throw new Error(j.error||'API'); return j;
    }
    const r=await fetch(ep,{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify({action,...payload}),credentials:'omit'});if(!r.ok)throw new Error('HTTP_'+r.status);const j=await r.json();if(j.ok===false)throw new Error(j.error||'API');return j;
  }
  const rel=iso=>{const d=new Date(iso); if(!Number.isFinite(d.getTime()))return ''; const sec=Math.max(1,(Date.now()-d.getTime())/1000); if(sec<60)return 'baru saja';if(sec<3600)return `${Math.floor(sec/60)} menit`;if(sec<86400)return `${Math.floor(sec/3600)} jam`;if(sec<604800)return `${Math.floor(sec/86400)} hari`;return d.toLocaleDateString('id-ID',{day:'numeric',month:'short',year:'numeric'})};
  const initials=name=>String(name||'PBJ').trim().split(/\s+/).slice(0,2).map(x=>x[0]).join('').toUpperCase()||'PBJ';
  let all=[]; let mode='local'; let currentCategory='Semua'; let currentSort='latest'; let search=''; let activeId='';
  const root=$('#forumExperience'); if(!root)return;
  const feed=$('#forumFeed'), stateLine=$('#forumStateLine'), searchInput=$('#forumSearch'), postDialog=$('#forumPostDialog'), threadDialog=$('#forumThreadDialog');
  function normalized(t){return {...t,reactions:t.reactions||{},comments:Array.isArray(t.comments)?t.comments:[],published:t.published!==false,status:t.status||'Dibuka'}}
  async function load(){
    try{const r=await api('listThreads');all=(r.threads||[]).map(normalized);mode='sheet'}catch(_){all=readLocal().map(normalized);mode='local'}
    render();
  }
  function visible(){
    let rows=all.filter(t=>t.published!==false);
    if(currentCategory!=='Semua')rows=rows.filter(t=>String(t.category).toLowerCase()===currentCategory.toLowerCase());
    const q=search.trim().toLowerCase();if(q)rows=rows.filter(t=>[t.title,t.body,t.category,t.opd,t.author].join(' ').toLowerCase().includes(q));
    if(currentSort==='discussed')rows.sort((a,b)=>((b.comments?.length||b.replyCount||0)+(Object.values(b.reactions||{}).reduce((x,y)=>x+(+y||0),0)))-((a.comments?.length||a.replyCount||0)+(Object.values(a.reactions||{}).reduce((x,y)=>x+(+y||0),0))));
    else if(currentSort==='answered')rows.sort((a,b)=>(/dijawab|selesai/i.test(b.status)?1:0)-(/dijawab|selesai/i.test(a.status)?1:0)||new Date(b.updatedAt||b.createdAt)-new Date(a.updatedAt||a.createdAt));
    else rows.sort((a,b)=>(b.pinned?1:0)-(a.pinned?1:0)||new Date(b.createdAt)-new Date(a.createdAt));
    return rows;
  }
  const statusClass=s=>/pendampingan/i.test(s)?'pendampingan':/dibuka|menunggu/i.test(s)?'open':'';
  function reactionTotal(t){return Object.values(t.reactions||{}).reduce((a,b)=>a+(Number(b)||0),0)}
  function render(){
    const rows=visible();
    stateLine.className='forum-state-line'+(mode==='local'?' local':'');
    stateLine.innerHTML=`<i></i><span>${mode==='sheet'?'Terhubung ke Google Sheet':'Mode lokal · sambungkan Google Sheet dari menu Admin untuk forum lintas perangkat'}</span>`;
    $('#forumThreadCount').textContent=String(all.filter(x=>x.published!==false).length);
    $('#forumAnsweredCount').textContent=String(all.filter(x=>/dijawab|selesai/i.test(x.status)).length);
    feed.innerHTML=rows.length?rows.map(t=>{
      const comments=t.comments?.filter(c=>c.published!==false).length??Number(t.replyCount||0);
      return `<article class="forum-post" data-forum-thread="${esc(t.id)}">
        <div class="forum-avatar">${esc(initials(t.author))}</div><div>
          <div class="forum-post-meta"><b>${esc(t.author||'Pengguna PBJ')}</b><span>•</span><span>${esc(t.opd||'')}</span><span>•</span><span>${esc(rel(t.createdAt))}</span><span class="forum-flair">${esc(t.category||'Lainnya')}</span><span class="forum-status ${statusClass(t.status)}">${esc(t.status)}</span></div>
          <h3>${esc(t.title)}</h3><p>${esc(t.body)}</p>
          <div class="forum-actions">${reactions.slice(0,3).map(r=>`<button class="forum-action reaction" data-react="${r}" data-id="${esc(t.id)}" type="button">${r} ${Number(t.reactions?.[r]||0)}</button>`).join('')}<span class="forum-action">💬 ${comments}</span>${t.pinned?'<span class="forum-action">📌 Disematkan</span>':''}</div>
        </div></article>`;
    }).join(''):`<div class="forum-empty"><b>Belum ada pembahasan.</b><span>Coba ganti topik atau kata pencarian.</span></div>`;
    renderPopular();
  }
  function renderPopular(){const pop=[...all].filter(x=>x.published!==false).sort((a,b)=>(reactionTotal(b)+(b.comments?.length||0)*2)-(reactionTotal(a)+(a.comments?.length||0)*2)).slice(0,4);$('#forumPopular').innerHTML=pop.map((t,i)=>`<button type="button" data-popular-id="${esc(t.id)}"><span>${String(i+1).padStart(2,'0')}</span>${esc(t.title)}</button>`).join('')||'<p>Belum ada topik.</p>'}
  async function react(id,emoji,button){
    const t=all.find(x=>x.id===id);if(!t)return; t.reactions=t.reactions||{};t.reactedBy=t.reactedBy||{};const key=`${session()}:${emoji}`;if(t.reactedBy[key])return;
    t.reactions[emoji]=(Number(t.reactions[emoji])||0)+1;t.reactedBy[key]=true;button?.classList.add('reacted');render();
    if(mode==='local'){const d=readLocal();const x=d.find(v=>v.id===id);if(x){x.reactions=t.reactions;x.reactedBy=t.reactedBy;writeLocal(d)}}else{try{await api('react',{threadId:id,emoji,sessionId:session()},'POST')}catch(_){}}
  }
  async function getThread(id){
    if(mode==='sheet'){try{const r=await api('getThread',{id});if(r.thread)return normalized(r.thread)}catch(_){}}
    return all.find(x=>x.id===id)||readLocal().find(x=>x.id===id);
  }
  async function openThread(id){activeId=id;let t=await getThread(id);if(!t)return;const comments=(t.comments||[]).filter(c=>c.published!==false);$('#forumThreadContent').innerHTML=`
    ${t.published===false?'<div class="forum-pending-banner">Topik ini masih menunggu telaah admin sebelum tampil di ruang konsultasi.</div>':''}
    <div class="forum-thread-top"><span class="forum-flair">${esc(t.category)}</span><b>${esc(t.author||'Pengguna PBJ')}</b><span>${esc(t.opd||'')}</span><span>• ${esc(rel(t.createdAt))}</span><span class="forum-status ${statusClass(t.status)}">${esc(t.status)}</span></div>
    <h2>${esc(t.title)}</h2><div class="forum-thread-text">${esc(t.body)}</div>${t.attachmentUrl?`<a class="forum-attachment" href="${esc(t.attachmentUrl)}" target="_blank" rel="noopener">📎 ${esc(t.attachmentName||'Lampiran')}</a>`:''}
    <div class="forum-thread-reactions">${reactions.map(r=>`<button class="forum-action reaction" data-dialog-react="${r}" type="button">${r} ${Number(t.reactions?.[r]||0)}</button>`).join('')}</div>
    <section class="forum-comments"><div class="forum-comments-title">${comments.length} tanggapan</div>${comments.length?comments.map(c=>`<article class="forum-comment"><div class="forum-avatar">${esc(initials(c.author))}</div><div><div class="forum-comment-head"><b>${esc(c.author||'Pengguna')}</b>${c.official?'<span class="forum-official">UKPBJ</span>':''} · ${esc(rel(c.createdAt))}</div><p>${esc(c.body)}</p></div></article>`).join(''):'<div class="forum-empty"><b>Belum ada tanggapan.</b><span>Jadilah yang pertama menanggapi.</span></div>'}</section>
    <div class="forum-reply-box"><input id="forumReplyName" maxlength="60" placeholder="Nama / inisial"><textarea id="forumReplyText" rows="2" maxlength="1500" placeholder="Tulis tanggapan..."></textarea><button id="forumReplySend" type="button">Kirim</button></div>`;
    threadDialog.classList.add('open');
    $$('[data-dialog-react]',threadDialog).forEach(b=>b.addEventListener('click',()=>react(id,b.dataset.dialogReact,b).then(()=>openThread(id))));
    $('#forumReplySend')?.addEventListener('click',()=>submitReply(id));
  }
  async function submitReply(id){const name=$('#forumReplyName')?.value.trim()||'Pengguna PBJ';const body=$('#forumReplyText')?.value.trim();if(!body)return;const btn=$('#forumReplySend');btn.disabled=true;btn.textContent='Mengirim...';
    if(mode==='sheet'){try{await api('createComment',{threadId:id,author:name,body},'POST');btn.textContent='Terkirim';setTimeout(()=>{threadDialog.classList.remove('open');load().then(()=>openThread(id))},650);return}catch(_){}}
    const d=readLocal();const t=d.find(x=>x.id===id);if(t){t.comments=t.comments||[];t.comments.push({id:uid('C'),createdAt:now(),author:name,body,official:false,published:true});t.updatedAt=now();writeLocal(d);all=d.map(normalized)}render();openThread(id);}
  const fileToPayload=file=>new Promise((resolve,reject)=>{if(!file)return resolve(null);const max=(Number(cfg().attachmentMaxMB)||5)*1024*1024;if(file.size>max)return reject(new Error('FILE_TOO_LARGE'));const r=new FileReader();r.onerror=reject;r.onload=()=>resolve({name:file.name,type:file.type||'application/octet-stream',base64:String(r.result).split(',')[1]||''});r.readAsDataURL(file)});
  async function submitPost(e){e.preventDefault();const m=$('#forumPostMessage');m.textContent='';const fd=new FormData(e.currentTarget);const p={author:String(fd.get('author')||'').trim()||'Pengguna PBJ',opd:String(fd.get('opd')||'').trim(),category:String(fd.get('category')||'Lainnya'),title:String(fd.get('title')||'').trim(),body:String(fd.get('body')||'').trim()};if(!p.title||!p.body){m.textContent='Judul dan uraian permasalahan wajib diisi.';return}const submit=$('#forumPostSubmit');submit.disabled=true;submit.textContent='Mengirim...';
    try{p.attachment=await fileToPayload($('#forumAttachment')?.files?.[0]);}catch(err){m.textContent='Lampiran maksimal 5 MB.';submit.disabled=false;submit.textContent='Kirim topik';return}
    if(mode==='sheet'){try{const r=await api('createThread',p,'POST');m.textContent='Topik terkirim dan menunggu telaah admin.';e.currentTarget.reset();setTimeout(()=>{postDialog.classList.remove('open');if(r.thread)openThread(r.thread.id)},700);submit.disabled=false;submit.textContent='Kirim topik';return}catch(err){m.textContent='Google Sheet tidak dapat dihubungi. Data disimpan sementara di browser ini.'}}
    const d=readLocal();const t={id:uid('T'),createdAt:now(),updatedAt:now(),author:p.author,opd:p.opd,category:p.category,title:p.title,body:p.body,status:'Dibuka',published:true,pinned:false,reactions:{},reactedBy:{},comments:[],attachmentName:p.attachment?.name||'',attachmentUrl:''};d.unshift(t);writeLocal(d);all=d.map(normalized);render();e.currentTarget.reset();m.textContent='Topik tersimpan di browser ini. Sambungkan Google Sheet agar dapat dibaca dari perangkat lain.';submit.disabled=false;submit.textContent='Kirim topik';setTimeout(()=>{postDialog.classList.remove('open');openThread(t.id)},700)}
  function open(fromPop=false){root.classList.add('open');root.setAttribute('aria-hidden','false');document.body.classList.add('forum-open');if(!fromPop&&location.hash!=='#konsultasi-pbj')history.pushState({traxPanel:'forum',fromTopbar:window.TRAXPBJ_CONSUME_TOPBAR_ENTRY?.()===true},'',location.pathname+location.search+'#konsultasi-pbj');load()}
  function close(fromPop=false){if(!root.classList.contains('open'))return;root.classList.remove('open');root.setAttribute('aria-hidden','true');document.body.classList.remove('forum-open');threadDialog.classList.remove('open');postDialog.classList.remove('open');if(!fromPop&&location.hash==='#konsultasi-pbj'){if((history.state?.fromTopbar||window.TRAXPBJ_SHOULD_RETURN_PROFILE_HOME?.('#konsultasi-pbj'))&&window.TRAXPBJ_RETURN_PROFILE_HOME){window.TRAXPBJ_RETURN_PROFILE_HOME();return}history.back()}}
  $$('.forum-category-list button').forEach(b=>b.addEventListener('click',()=>{$$('.forum-category-list button').forEach(x=>x.classList.toggle('active',x===b));currentCategory=b.dataset.category;render()}));
  $$('.forum-sort button').forEach(b=>b.addEventListener('click',()=>{$$('.forum-sort button').forEach(x=>x.classList.toggle('active',x===b));currentSort=b.dataset.sort;render()}));
  searchInput?.addEventListener('input',()=>{search=searchInput.value;render()});
  feed?.addEventListener('click',e=>{const r=e.target.closest('[data-react]');if(r){e.stopPropagation();react(r.dataset.id,r.dataset.react,r);return}const p=e.target.closest('[data-forum-thread]');if(p)openThread(p.dataset.forumThread)});
  $('#forumPopular')?.addEventListener('click',e=>{const b=e.target.closest('[data-popular-id]');if(b)openThread(b.dataset.popularId)});
  $('[data-forum-new]')?.addEventListener('click',()=>postDialog.classList.add('open'));
  $$('[data-forum-close-post]').forEach(b=>b.addEventListener('click',()=>postDialog.classList.remove('open')));
  $$('[data-forum-close-thread]').forEach(b=>b.addEventListener('click',()=>threadDialog.classList.remove('open')));
  $$('[data-close-forum]').forEach(b=>b.addEventListener('click',()=>close(false)));
  $('#forumPostForm')?.addEventListener('submit',submitPost);
  window.TRAXPBJ_FORUM={open,close,reload:load};
})();
