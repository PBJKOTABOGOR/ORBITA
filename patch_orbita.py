from pathlib import Path
p=Path('/mnt/data/orbita_work/backend/Code-TRAXPBJ-Pemilihan.gs')
s=p.read_text()
def replace_once(old,new):
 global s
 count=s.count(old)
 if count!=1: raise AssertionError(f'Expected one {old[:60]!r}, got {count}')
 s=s.replace(old,new)
replace_once("version:'28.28'","version:'28.29'")
replace_once("  if (action === 'submitKajiUlang')", "  if (action === 'sendKajiInvitation') return {data:sendKajiInvitation_(user,payload)};\n  if (action === 'submitKajiUlang')")
anchor="function submitKajiUlang_(user,payload){"
assert s.count(anchor)==1
addition='''// Undangan kaji ulang dibuat hanya saat Pokja telah ditetapkan. Tidak menambah kolom Sheet.
// PDF tersimpan sebagai dokumen paket; notifikasi dikirim oleh pengirim DATA ORBITA.
function invitationEscape_(value){return String(value||'').replace(/[&<>"']/g,function(ch){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch];});}
function invitationDate_(value){
  const v=String(value||'').trim();
  if(!/^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}$/.test(v))throw new Error('Isi tanggal dan jam undangan.');
  const stamp=new Date(v+':00+07:00');
  if(isNaN(stamp.getTime())||Utilities.formatDate(stamp,'Asia/Jakarta',"yyyy-MM-dd'T'HH:mm")!==v)throw new Error('Tanggal atau jam undangan tidak sesuai.');
  return stamp;
}
function sendKajiInvitation_(user,payload){
  requireRole_(user,['POKJA','ADMIN']);
  const req=getRequestAuthorized_(user,payload.requestId);
  if(!isKajiWorkflow_(req)||!['DITUGASKAN_POKJA','REVIU_POKJA','REVIU_ULANG'].includes(String(req.status||'')))throw new Error('Undangan hanya dapat dikirim setelah disposisi dan sebelum Kaji Ulang selesai.');
  if(!req.assigned_pokja_id)throw new Error('Pokja belum ditetapkan oleh Kepala UKPBJ.');
  const email=String(req.ppk_email||'').trim();
  if(!/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(email))throw new Error('Email PPK belum tersedia. Minta PPK melengkapinya sebelum mengirim undangan.');
  const start=invitationDate_(payload.start),end=invitationDate_(payload.end);
  if(end.getTime()<=start.getTime())throw new Error('Jam selesai harus setelah jam mulai.');
  const method=String(payload.method||'').trim().toUpperCase();
  if(!['OFFLINE','ONLINE'].includes(method))throw new Error('Pilih mekanisme undangan Offline atau Online.');
  const place=String(payload.place||'').trim(),provided=String(payload.provided||'').trim(),attendees=String(payload.attendees||'').trim(),attachment=String(payload.attachment||'').trim();
  if(!place||!provided||!attendees)throw new Error('Isi tempat/tautan, dokumen yang disiapkan, dan peserta yang harus hadir.');
  if([place,provided,attendees,attachment].some(x=>x.length>1000))throw new Error('Isian undangan maksimal 1.000 karakter per bagian.');
  const sh=sheet_(PBJWF.SHEETS.DOCS),old=currentDocs_(req.request_id).filter(d=>String(d.doc_type)==='SURAT_UNDANGAN_KAJI_ULANG');
  const version=rows_(sh).filter(d=>d.request_id===req.request_id&&d.doc_type==='SURAT_UNDANGAN_KAJI_ULANG').reduce((m,d)=>Math.max(m,Number(d.version)||0),0)+1;
  const pokja=findRow_(sheet_(PBJWF.SHEETS.POKJA),'pokja_id',req.assigned_pokja_id)?.obj;
  const sender=String(pokja?.nama||'Pokja Pemilihan'),ppk=String(req.ppk_nama||'PPK');
  const prettyTime=x=>Utilities.formatDate(x,'Asia/Jakarta','dd MMMM yyyy, HH:mm')+' WIB';
  const timeLabel=prettyTime(start)+' s.d. '+prettyTime(end);
  const subject='ORBITA PBJ - Undangan Kaji Ulang '+req.request_id;
  const values=[['Nomor Permohonan',req.request_id],['Kode RUP',req.kode_rup],['Nama Paket',req.nama_paket],['Waktu',timeLabel],['Tempat / Tautan',place],['Mekanisme',method==='OFFLINE'?'Offline':'Online'],['Yang Harus Disiapkan',provided],['Yang Harus Hadir',attendees],['Lampiran',attachment||'-']];
  // Buat surat PDF sekali, hanya ketika tombol Kirim Undangan ditekan.
  let temp=null,file=null;
  try{
    const document=DocumentApp.create('Undangan Kaji Ulang - '+req.request_id);
    temp=DriveApp.getFileById(document.getId());
    const body=document.getBody();
    body.appendParagraph('ORBITA PBJ KOTA BOGOR').setHeading(DocumentApp.ParagraphHeading.HEADING2);
    body.appendParagraph('UNDANGAN KAJI ULANG DOKUMEN PERSIAPAN').setHeading(DocumentApp.ParagraphHeading.HEADING3);
    body.appendParagraph('Kepada Yth. Bapak/Ibu '+ppk+'\\n'+req.opd);
    body.appendParagraph('Bersama ini kami mengundang Bapak/Ibu untuk mengikuti Kaji Ulang Dokumen Persiapan dengan rincian sebagai berikut:');
    body.appendTable(values.map(row=>row.map(x=>String(x==null?'':x))));
    body.appendParagraph('Mohon hadir sesuai jadwal dan menyiapkan dokumen yang diperlukan.');
    body.appendParagraph('Hormat kami,\\n'+sender+'\\nUKPBJ Kota Bogor');
    document.saveAndClose();
    file=DriveApp.getFolderById(req.folder_id).createFile(temp.getAs(MimeType.PDF));
    file.setName(prettyDocumentFileName_('Surat Undangan Kaji Ulang',req.nama_paket,version,'.pdf'));
    const doc={doc_id:id_('DOC'),request_id:req.request_id,doc_type:'SURAT_UNDANGAN_KAJI_ULANG',doc_label:'Surat Undangan Kaji Ulang',version:version,drive_file_id:file.getId(),drive_url:file.getUrl(),file_name:file.getName(),mime_type:'application/pdf',size_bytes:file.getSize(),uploader_user_id:user.user_id,uploaded_at:new Date(),is_current:true};
    appendObj_(sh,doc);
    old.forEach(d=>{const hit=findRow_(sh,'doc_id',d.doc_id);if(hit)updateRow_(sh,hit.row,{is_current:false});});
    audit_(user,'KIRIM_UNDANGAN_KAJI',req.request_id,{docType:doc.doc_type,docId:doc.doc_id,fileName:doc.file_name,version:version,start:payload.start,end:payload.end,method:method,place:place,provided:provided,attendees:attendees,attachment:attachment});
    touchRequest_(req.request_id);
    const message=['Yth. Bapak/Ibu '+ppk+',','','Pokja Pemilihan mengundang Bapak/Ibu untuk mengikuti Kaji Ulang Dokumen Persiapan.','',...values.map(row=>row[0]+': '+row[1]),'', 'Surat undangan (PDF): '+file.getUrl(),'', 'Mohon hadir sesuai jadwal dan membawa dokumen yang diperlukan.','', 'Undangan ini dikirim melalui ORBITA PBJ Kota Bogor.'].join('\\n');
    const queued=bestEffortMail_('KAJI_UNDANGAN:'+req.request_id+':'+version,email,subject,message);
    return {document:doc,email_queued:queued!==false,request:publicRequest_(getRequest_(req.request_id))};
  }catch(error){if(file)try{file.setTrashed(true);}catch(_){}throw error;}
  finally{if(temp)try{temp.setTrashed(true);}catch(_){}}
}

'''
s=s.replace(anchor,addition+anchor)
# bestEffortMail_ previously returns undefined; make it return a concrete enqueue success so no false status.
replace_once("function bestEffortMail_(key,to,subject,body){\n  try{const queued=mailQueue_(key,to,subject,body);if(queued)ensureMailQueueTrigger_();}\n  catch(err){Logger.log('Notifikasi tertunda: '+String(err));}\n}","function bestEffortMail_(key,to,subject,body){\n  try{const queued=mailQueue_(key,to,subject,body);if(queued)ensureMailQueueTrigger_();return queued;}\n  catch(err){Logger.log('Notifikasi tertunda: '+String(err));return false;}\n}")
# fix title when editable: already stored in req via requestFormPatch_
# do not store a public note on successful invite; audit is sufficient
p.write_text(s)
print('backend patched',len(s))
