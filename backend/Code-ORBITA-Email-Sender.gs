/**
 * ORBITA PBJ - Pengirim Email dari DATA ORBITA
 *
 * File ini dipasang pada project Apps Script TERPISAH:
 * 1. Masuk ke DATA ORBITA menggunakan Gmail yang akan menjadi pengirim.
 * 2. Ekstensi > Apps Script > tempel isi file ini ke Code.gs.
 * 3. Jalankan pasangPengirimEmailDATAORBITA() lalu setujui izin.
 *
 * Jangan tempel file ini sebagai pengganti backend Pemilihan.
 * Notifikasi tetap dibuat oleh backend Pemilihan ke sheet PBJ_EMAIL_QUEUE.
 */
const ORBITA_EMAIL_SENDER={
  spreadsheetId:'1WcL5uJBcnIWScOErmR--Ll7CBeRC6lnNHexdcMVsOdE',
  sheet:'PBJ_EMAIL_QUEUE',
  displayName:'ORBITA PBJ KOTA BOGOR',
  portal:'https://pbjkotabogor.github.io/ORBITA/profil-pbj/#pengelolaan-pbj',
  logo:'https://pbjkotabogor.github.io/ORBITA/assets/img/favicon.png',
  batchLimit:12,
  registry:"PBJ_EMAIL_SHARDS", control:"PBJ_EMAIL_CONTROL", keys:"PBJ_EMAIL_KEYS"
};
function cekPengirimEmailDATAORBITA(){
  const ss=SpreadsheetApp.openById(ORBITA_EMAIL_SENDER.spreadsheetId),sh=ss.getSheetByName(ORBITA_EMAIL_SENDER.sheet);
  if(!sh)throw new Error('Tab PBJ_EMAIL_QUEUE belum ada di DATA ORBITA.');
  // Trigger berjalan sebagai akun Google yang memasangnya.
  // Tidak perlu membaca alamat akun via Session.getEffectiveUser(),
  // sehingga tidak memerlukan izin userinfo.email.
  return {akunPengirim:'Akun Google yang memasang trigger ini',sheet:sh.getName(),antrean:Math.max(0,sh.getLastRow()-1)};
}
function pasangPengirimEmailDATAORBITA(){
  const result=cekPengirimEmailDATAORBITA();
  const name='prosesAntreanEmailDATAORBITA';
  ScriptApp.getProjectTriggers().filter(t=>t.getHandlerFunction()===name).forEach(t=>ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger(name).timeBased().everyMinutes(1).create();
  Logger.log('Pengirim email aktif: '+result.akunPengirim);
  return {...result,status:'Pengirim aktif, pemeriksaan antrean setiap 1 menit.'};
}
function hentikanPengirimEmailDATAORBITA(){
  const name='prosesAntreanEmailDATAORBITA';
  const matches=ScriptApp.getProjectTriggers().filter(t=>t.getHandlerFunction()===name);
  matches.forEach(t=>ScriptApp.deleteTrigger(t));
  return 'Trigger email dihentikan: '+matches.length;
}
function orbitaEmailEscape_(value){
  return String(value==null?'':value).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}
// Hanya notifikasi memakai sapaan ORBITA. Surat/undangan resmi tidak diubah.
function orbitaIsNoticeEmail_(key){
  const kind=String(key||'').split(':')[0].toUpperCase();
  return !/(^|_)(UNDANGAN|SURAT_RESMI|SURAT_PERINTAH|SURAT_TUGAS)(_|$)/.test(kind);
}
function orbitaBodyForSend_(body,key){
  const original=String(body||'').trim();
  if(!original||!orbitaIsNoticeEmail_(key))return original;
  if(/^🚀 Halo, Orbiters!/u.test(original)&&/Salam ORBITA! 🚀$/u.test(original))return original;
  const content=original
    .replace(/^Yth\.\s*Bapak\/Ibu[^\n]*\n*/i,'')
    .replace(/\n*(?:Pesan ini dikirim otomatis oleh ORBITA PBJ Kota Bogor\.|Email ini dikirim otomatis oleh (?:sistem )?ORBITA PBJ(?: Kota Bogor)?(?: dan tidak menerima balasan)?\.)\s*$/i,'')
    .trim();
  return '🚀 Halo, Orbiters!\n\n'+content+'\n\nSalam ORBITA! 🚀';
}

function orbitaEmailHTML_(subject,body,key){
  const notice=orbitaIsNoticeEmail_(key);
  const kind=String(key||'').split(':')[0].toUpperCase(),danger=['MINI_BATAL','DITOLAK_KEPALA'].includes(kind),warning=['MINI_GAGAL','KAJI_PERBAIKAN','REVIU_PERBAIKAN','PERBAIKAN_REVIU'].includes(kind);
  const color=danger?'#b91c1c':warning?'#b45309':'#0776a2';
  const tag=danger?'TINDAK LANJUT PERMOHONAN':warning?'PERLU PERHATIAN PPK':'PEMBERITAHUAN PENGADAAN';
  const mailText=String(body||'').trim();
  const bodyText=notice?mailText.replace(/\n*Salam ORBITA! 🚀$/u,'').trim():mailText;
  const paragraphs=bodyText.split(/\n\s*\n/).map(x=>'<p style="margin:0 0 16px">'+orbitaEmailEscape_(x).replace(/\n/g,'<br>')+'</p>').join('');
  const greeting=notice?'<div style="font-size:15px;font-weight:700;margin:12px 0 18px">Salam ORBITA! 🚀</div>':'';
  const ctaPadding=notice?'7px 0 14px':'7px 0 22px';
  const footer=notice?'':('<div style="margin:4px 24px 22px;padding-top:13px;border-top:1px solid #e5ecf2;font-size:12px;line-height:1.6;color:#61788a">'
    +'Pesan ini dikirim otomatis oleh ORBITA PBJ Kota Bogor. Periksa detail permohonan melalui portal ORBITA PBJ.</div>');
  // Lampiran/tautan dan isi surat resmi tidak disentuh.
  return '<div style="margin:0;padding:22px 12px;background:#f2f6fa;font-family:Arial,Helvetica,sans-serif;color:#173042">'
    +'<div style="max-width:700px;margin:0 auto;background:#fff;border:1px solid #dce6ee;border-radius:14px;overflow:hidden">'
    +'<div style="background:'+color+';padding:19px 24px;color:#fff"><table role="presentation" cellpadding="0" cellspacing="0"><tr><td style="vertical-align:middle;padding-right:12px">'
    +'<img src="'+ORBITA_EMAIL_SENDER.logo+'" alt="Logo UKPBJ Kota Bogor" width="48" height="48" style="width:48px;height:48px;display:block;border:0;background:#fff;border-radius:10px;padding:3px"></td>'
    +'<td><div style="font-size:17px;font-weight:700">ORBITA PBJ KOTA BOGOR</div><div style="font-size:11px;letter-spacing:1px;margin-top:5px">'+tag+'</div></td></tr></table></div>'
    +'<div style="padding:22px 24px 8px"><div style="font-size:17px;line-height:1.5;font-weight:700;margin:0 0 20px">'+orbitaEmailEscape_(subject)+'</div>'
    +'<div style="font-size:14px;line-height:1.75">'+paragraphs+'</div>'
    +'<div style="padding:'+ctaPadding+'"><a href="'+ORBITA_EMAIL_SENDER.portal+'" style="display:inline-block;background:#087da5;border-radius:7px;color:#fff;text-decoration:none;font-size:14px;font-weight:700;padding:12px 20px">Buka ORBITA PBJ</a></div>'
    +greeting+'</div>'+footer+'</div></div>';
}
// Pengirim produksi membaca root dan shard hasil Auto Rotation tanpa menyentuh BACKUP24.
// Tidak mengirim ulang SENDING yang hasilnya belum pasti, agar tidak terjadi pengiriman ganda.
function emailDaftarDatabaseProduksi_(){
  const root=SpreadsheetApp.openById(ORBITA_EMAIL_SENDER.spreadsheetId),registry=root.getSheetByName(ORBITA_EMAIL_SENDER.registry);
  if(!registry)return [ORBITA_EMAIL_SENDER.spreadsheetId];
  const len=registry.getLastRow(),rows=len>1?registry.getRange(2,1,len-1,3).getValues():[];
  const ids=rows.filter(r=>r[0]&&String(r[2])==='READY').map(r=>String(r[0]));
  if(new Set(ids).size!==ids.length||ids.includes(ORBITA_EMAIL_SENDER.spreadsheetId))throw new Error('Registry email ganda. Pengiriman dihentikan.');
  const control=root.getSheetByName(ORBITA_EMAIL_SENDER.control);
  const active=control&&control.getLastRow()>1?String(control.getRange(2,2).getValue()||''):'';
  if(active&&active!==ORBITA_EMAIL_SENDER.spreadsheetId&&!ids.includes(active))throw new Error('Database email aktif belum READY. Pengiriman dihentikan.');
  return [ORBITA_EMAIL_SENDER.spreadsheetId,...ids];
}
function cekSeluruhAntreanEmailDATAORBITA(){
  const list=emailDaftarDatabaseProduksi_(),info=[];
  for(const id of list){const ss=SpreadsheetApp.openById(id),sh=ss.getSheetByName(ORBITA_EMAIL_SENDER.sheet);
    if(!sh)throw new Error('PBJ_EMAIL_QUEUE hilang di '+id);
    info.push({id,nama:ss.getName(),jumlah:Math.max(0,sh.getLastRow()-1)});
  }
  Logger.log(JSON.stringify(info));return info;
}
function prosesAntreanEmailDATAORBITA(){
  const lock=LockService.getScriptLock();if(!lock.tryLock(1000))return 0;
  let processed=0;
  try{
    const ids=emailDaftarDatabaseProduksi_();
    for(const id of ids){
      if(processed>=ORBITA_EMAIL_SENDER.batchLimit)break;
      const sh=SpreadsheetApp.openById(id).getSheetByName(ORBITA_EMAIL_SENDER.sheet);
      if(!sh)throw new Error('Sheet email tidak ditemukan di '+id);
      const h=sh.getRange(1,1,1,sh.getLastColumn()).getDisplayValues()[0].map(String),c=Object.fromEntries(h.map((k,i)=>[k,i]));
      for(const key of ['recipient','subject','body','event_key','status','attempts','sent_at','last_error'])
        if(c[key]===undefined)throw new Error('Header email tidak lengkap: '+key);
      const last=sh.getLastRow();if(last<2)continue;
      const finder=sh.getRange(2,c.status+1,last-1,1).createTextFinder('PENDING').matchEntireCell(true);
      let hit,examined=0;
      while(processed<ORBITA_EMAIL_SENDER.batchLimit&&examined<90&&(hit=finder.findNext())){
        examined++;const row=hit.getRow(),val=sh.getRange(row,1,1,h.length).getValues()[0];
        if(String(val[c.status])!=='PENDING')continue;
        const attempts=Number(val[c.attempts]||0)+1;
        if(attempts>3){sh.getRange(row,c.status+1).setValue('FAILED');continue;}
        const address=String(val[c.recipient]||'').trim();
        if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address)){
          val[c.status]='FAILED';val[c.last_error]='Alamat email tidak valid';sh.getRange(row,1,1,h.length).setValues([val]);continue;
        }
        // Reservasi sebelum mengirim. Jika eksekusi terhenti, status SENDING perlu ditinjau manual.
        sh.getRange(row,c.status+1).setValue('SENDING');SpreadsheetApp.flush();
        try{
          const subject=String(val[c.subject]||'ORBITA PBJ'),plain=orbitaBodyForSend_(val[c.body],val[c.event_key]);
          MailApp.sendEmail({to:address,subject,body:plain,htmlBody:orbitaEmailHTML_(subject,plain,val[c.event_key]),name:ORBITA_EMAIL_SENDER.displayName});
          val[c.status]='SENT';val[c.attempts]=attempts;val[c.sent_at]=new Date();val[c.last_error]='';
        }catch(e){val[c.status]=attempts>=3?'FAILED':'PENDING';val[c.attempts]=attempts;val[c.last_error]=String(e).slice(0,400);}
        sh.getRange(row,1,1,h.length).setValues([val]);processed++;
      }
    }
    return processed;
  }finally{lock.releaseLock();}
}
