(() => {
  'use strict';
  const $=(s,c=document)=>c.querySelector(s);
  const esc=v=>String(v??'').replace(/[&<>'"]/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':'&quot;'}[ch]));
  const API=window.TRAXPBJ_API;
  let rows=[];
  let mounted=false;
  const toast=msg=>{const t=$('#adminToast');if(!t)return;t.textContent=msg;t.classList.add('show');clearTimeout(toast.t);toast.t=setTimeout(()=>t.classList.remove('show'),3400)};
  const dateLabel=v=>{if(!v)return 'Tanggal belum diisi';try{return new Intl.DateTimeFormat('id-ID',{day:'2-digit',month:'short',year:'numeric'}).format(new Date(String(v).slice(0,10)+'T00:00:00'))}catch{return v}};

  function ensureUI(){
    if(mounted)return;
    const panel=$('[data-admin-panel="documentation"]');if(!panel)return;
    mounted=true;
    const block=document.createElement('div');block.className='surat-admin-block';block.innerHTML=`
      <div class="panel-head surat-admin-head"><div><small>PRODUK SURAT PBJ</small><h2>Kelola Surat PBJ</h2><p>Bisa sinkron dari Google Drive atau upload file surat manual langsung dari admin konten.</p></div><button class="panel-export" id="syncSuratPBJ" type="button">Sinkron Drive</button></div>
      <form class="portal-admin-form surat-admin-form" id="suratPBJForm">
        <input type="hidden" id="suratPBJId"><input type="hidden" id="suratPBJFileId">
        <div class="portal-form-grid">
          <label><span>Tanggal Surat</span><input id="suratPBJTanggal" type="date"></label>
          <label><span>Jenis Surat</span><input id="suratPBJJenis" type="text" list="suratPBJJenisList" placeholder="Surat Penyampaian"><datalist id="suratPBJJenisList"><option value="Surat Penyampaian"><option value="Surat Pemberitahuan"><option value="Surat Undangan"><option value="Surat Edaran"><option value="Surat Permohonan"><option value="Surat Tugas"><option value="Lainnya"></datalist></label>
          <label class="span-2"><span>Nomor Surat</span><input id="suratPBJNomor" type="text" placeholder="Nomor surat"></label>
          <label class="span-2"><span>Perihal</span><input id="suratPBJPerihal" type="text" placeholder="Perihal surat"></label>
          <label class="span-2"><span>File Surat (opsional untuk tambah manual / ganti file)</span><input id="suratPBJUpload" type="file" accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.jpg,.jpeg,.png"></label>
        </div>
        <div class="admin-file-note" id="suratPBJFileInfo">Pilih surat dari daftar di bawah untuk melengkapi keterangannya, atau upload file baru untuk menambah surat manual.</div>
        <div class="admin-actions"><button type="button" id="suratPBJReset">Batal / Kosongkan</button><button class="primary" type="submit">Simpan Surat</button></div>
      </form>
      <div class="portal-admin-list" id="suratPBJAdminList"></div>`;
    panel.appendChild(block);
    $('#syncSuratPBJ')?.addEventListener('click',syncDrive);
    $('#suratPBJReset')?.addEventListener('click',resetForm);
    $('#suratPBJForm')?.addEventListener('submit',saveRow);
    $('#suratPBJUpload')?.addEventListener('change',e=>{const f=e.target.files?.[0];const n=$('#suratPBJFileInfo');if(n&&f)n.textContent=`File manual dipilih: ${f.name}`});
    $('#suratPBJAdminList')?.addEventListener('click',e=>{const b=e.target.closest('[data-edit-surat]');if(!b)return;const x=rows.find(r=>String(r.id)===b.dataset.editSurat);if(x)fillForm(x)});
  }

  function normalize(list=[]){return list.map(r=>({id:r.id||'',date:r.tanggal||'',number:r.nomorSurat||r.nomor_surat||'',title:r.perihal||r.judul||'',type:r.jenis||'',fileId:r.fileId||r.file_id||'',url:r.url||r.file_url||'',fileName:r.namaFile||r.nama_file||'',modifiedAt:r.modifiedAt||r.modified_at||''}));}
  function render(){
    ensureUI();const host=$('#suratPBJAdminList');if(!host)return;
    host.innerHTML=rows.length?rows.map(x=>`<article class="portal-admin-item"><div class="portal-item-mark doc">PDF</div><div><small>${esc(x.type||'Surat PBJ')} · ${esc(dateLabel(x.date))}</small><b>${esc(x.title||x.fileName||'Tanpa judul')}</b><span>${x.number?`Nomor ${esc(x.number)} · `:''}${esc(x.fileName||'')}</span></div><div class="portal-item-actions">${x.url?`<a href="${esc(x.url)}" target="_blank" rel="noopener noreferrer">Buka</a>`:''}<button type="button" data-edit-surat="${esc(x.id)}">Ubah</button></div></article>`).join(''):'<div class="portal-admin-empty">Belum ada surat. Klik Sinkron Drive atau upload file surat manual.</div>';
  }
  function resetForm(){['#suratPBJId','#suratPBJFileId','#suratPBJTanggal','#suratPBJJenis','#suratPBJNomor','#suratPBJPerihal','#suratPBJUpload'].forEach(id=>{const e=$(id);if(e)e.value=''});const n=$('#suratPBJFileInfo');if(n)n.textContent='Pilih surat dari daftar di bawah untuk melengkapi keterangannya, atau upload file baru untuk menambah surat manual.';}
  function fillForm(x){$('#suratPBJId').value=x.id||'';$('#suratPBJFileId').value=x.fileId||'';$('#suratPBJTanggal').value=String(x.date||'').slice(0,10);$('#suratPBJJenis').value=x.type||'';$('#suratPBJNomor').value=x.number||'';$('#suratPBJPerihal').value=x.title||'';$('#suratPBJFileInfo').textContent=x.fileName||'File Drive';if($('#suratPBJUpload'))$('#suratPBJUpload').value='';$('#suratPBJPerihal').focus();}

  async function syncDrive(){
    const btn=$('#syncSuratPBJ');if(!btn)return;const old=btn.textContent;btn.disabled=true;btn.textContent='Menyinkronkan...';
    try{const res=await API.post('syncSuratPBJ',{recursive:true,maxFiles:1500},{timeoutMs:120000,emit:false});rows=normalize(res?.data?.data||[]);render();API.clearBootstrapCache?.();toast(`${res?.data?.created||0} surat baru · ${res?.data?.updated||0} diperbarui.`)}
    catch(err){toast(err.message||'Sinkron surat gagal. Pastikan Code.gs terbaru sudah di-deploy.')}finally{btn.disabled=false;btn.textContent=old}
  }
  async function saveRow(e){
    e.preventDefault();const btn=e.submitter;const file=$('#suratPBJUpload')?.files?.[0]||null;if(!$('#suratPBJId').value&&!file){toast('Pilih surat dari daftar atau upload file surat manual terlebih dahulu.');return;}const old=btn.textContent;btn.disabled=true;btn.textContent='Menyimpan...';
    try{
      const payload={data:{id:$('#suratPBJId').value,fileId:$('#suratPBJFileId').value,tanggal:$('#suratPBJTanggal').value,jenis:$('#suratPBJJenis').value.trim(),nomorSurat:$('#suratPBJNomor').value.trim(),perihal:$('#suratPBJPerihal').value.trim(),tampil:true}};
      if(file)payload.file=await API.fileToPayload(file,{maxBytes:20*1024*1024});
      const res=await API.post('saveSuratPBJ',payload,{timeoutMs:file?120000:45000,emit:false});rows=normalize(res?.data||[]);render();resetForm();API.clearBootstrapCache?.();toast(file&&!payload.data.id?'Surat manual tersimpan.':'Keterangan surat tersimpan.');}
    catch(err){toast(err.message||'Keterangan surat gagal disimpan.')}finally{btn.disabled=false;btn.textContent=old}
  }

  function syncRemote(remote){ensureUI();rows=normalize(remote?.suratPBJ||[]);render()}
  document.addEventListener('trax:admin-api-ready',e=>syncRemote(e.detail||{}));
  requestAnimationFrame(()=>{ensureUI();const r=window.TRAXPBJ_REMOTE_BOOTSTRAP;if(r)syncRemote(r)});
  if(API?.hasSession())setTimeout(async()=>{try{const remote=await API.bootstrap();if(remote)syncRemote(remote)}catch(_){}},0);
})();
