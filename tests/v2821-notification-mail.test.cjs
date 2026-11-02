'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'..');
const backend=fs.readFileSync(path.join(root,'backend/Code-TRAXPBJ-Pemilihan.gs'),'utf8');
const logo=fs.readFileSync(path.join(root,'assets/img/favicon.png'));
function backendVm({mails=[]}={}){
  const ctx=vm.createContext({console,Date,Number,Math,JSON,Buffer,Logger:{log(){}},
    Utilities:{base64Decode:text=>Buffer.from(text,'base64'),newBlob:(bytes,mime,name)=>({bytes,mime,name})},
    GmailApp:{getAliases:()=>[]},MailApp:{sendEmail:msg=>mails.push(msg)}});
  vm.runInContext(backend,ctx);
  return ctx;
}
const req={request_id:'P-62584465-01',kode_rup:'62584465',nama_paket:'Belanja Jasa Tenaga Keamanan',opd:'DINAS PEKERJAAN UMUM DAN PENATAAN RUANG',ppk_nama:'Ben',ppk_email:'ppk@example.go.id',current_round:2};

test('email dikirim oleh Apps Script DATA ORBITA, identitas resmi tetap ditampilkan',()=>{
  const code=fs.readFileSync(path.join(root,'backend/Code-ORBITA-Email-Sender.gs'),'utf8');
  const c=vm.createContext({Date,Math,Number,String,JSON});vm.runInContext(code,c);
  const html=c.orbitaEmailHTML_('ORBITA PBJ - Tes','Yth. Bapak/Ibu Ben,\n\nKode RUP: 62584465','REVIU_PERBAIKAN:P-62584465-01:2');
  assert.ok(html.includes('ORBITA PBJ KOTA BOGOR'));
  assert.ok(html.includes('src="https://pbjkotabogor.github.io/ORBITA/assets/img/favicon.png"'));
  assert.ok(html.includes('#b45309'));
  assert.ok(html.includes('Kode RUP: 62584465'));
  assert.ok(!html.includes('cid:'));
  assert.ok(!code.includes('inlineImages:'));
  assert.ok(!code.includes('attachments:'));
});

test('backend utama tidak boleh mengirim Gmail; pengirim memakai trigger DATA ORBITA',()=>{
  const c=backendVm();
  assert.throws(()=>c.sendQueueMail_({recipient:req.ppk_email,subject:'Subjek',body:'Isi',event_key:'HANDOVER:P-62584465-01'}),/dipindahkan ke akun DATA ORBITA/);
  assert.match(backend,/function processPemilihanMailQueue\(\)\{\s*\/\/ Trigger lama[^\n]*\n\s*return 0;/);
  const code=fs.readFileSync(path.join(root,'backend/Code-ORBITA-Email-Sender.gs'),'utf8');
  assert.match(code,/function pasangPengirimEmailDATAORBITA\(/);
  assert.match(code,/MailApp\.sendEmail\(/);
  assert.match(code,/name:ORBITA_EMAIL_SENDER\.displayName/);
});

test('semua email PPK memiliki konteks dan arahan tindak lanjut yang berbeda',()=>{
  const c=backendVm();
  for(const [kind,fragment] of Object.entries({KAJI_PERBAIKAN:'Kaji Ulang',MINI_DETAIL:'Lengkapi Detail',REVIU_PERBAIKAN:'Dikembalikan',MINI_GAGAL:'Gagal',MINI_BATAL:'Pembatalan',DITOLAK_KEPALA:'Ditolak'})){
    const mail=c.ppkStatusMail_(req,kind,'Catatan: <script>alert(1)</script>');
    assert.ok(mail.subject.includes(fragment),kind);
    assert.ok(mail.body.includes(req.request_id),kind);
    assert.ok(mail.body.includes(req.kode_rup),kind);
    assert.ok(mail.body.includes('Tindak Lanjut:'),kind);
    const html=c.mailHtmlTemplate_(mail.subject,mail.body,kind+':'+req.request_id);
    assert.ok(!html.includes('<script>'),kind);
  }
});

test('gagal, batal dan tolak memicu tepat satu notifikasi status sesudah perubahan data',()=>{
  const c=backendVm(),sent=[];
  c.requireRole_=()=>{};
  let current;
  c.getRequestAuthorized_=()=>current;
  c.getRequest_=()=>current;
  c.publicRequest_=r=>({...r});
  c.ensureRequestSchema_=()=>{};
  c.updateRequest_=(_id,patch)=>Object.assign(current,patch);
  c.audit_=()=>{};
  c.appendNote_=()=>{};
  c.notifyPpkStatus_=(r,kind,note)=>sent.push({id:r.request_id,kind,note});
  const user={role:'POKJA',user_id:'pokja'};
  current={...req,status:'SIAP_PROSES_INAPROC',selection_process:'MINI_KOMPETISI',mini_stage:'TAYANG'};
  c.miniWorkflow_(user,{requestId:req.request_id,step:'GAGAL',note:'Tidak ada peserta memenuhi syarat'});
  assert.equal(current.status,'PERLU_PERBAIKAN_PPK');
  assert.equal(sent[0].kind,'MINI_GAGAL');
  current={...req,status:'SIAP_PROSES_INAPROC',selection_process:'MINI_KOMPETISI',mini_stage:'TAYANG'};
  c.miniRequireDoc_=()=>({});
  c.miniWorkflow_(user,{requestId:req.request_id,step:'BATAL',note:'Kebutuhan sudah tidak berlaku'});
  assert.equal(current.status,'BATAL');
  assert.equal(sent[1].kind,'MINI_BATAL');
  current={...req,status:'MENUNGGU_DISPOSISI'};
  c.rejectRequest_({role:'KEPALA_UKPBJ',user_id:'kepala'},{requestId:req.request_id,reason:'HPS belum sesuai'});
  assert.equal(current.status,'DITOLAK_KEPALA');
  assert.equal(sent[2].kind,'DITOLAK_KEPALA');
  assert.equal(sent.length,3);
});

test('jalur reviu dan kaji ulang sama-sama memasang notifikasi saat kembali ke PPK',()=>{
  for(const snippet of [
    "notifyPpkStatus_(req,'KAJI_PERBAIKAN',note,Number(req.current_round)||1)",
    "notifyPpkStatus_(req,'MINI_DETAIL',note,Number(req.current_round)||1)",
    "if(returnedToPpk)notifyPpkStatus_(req,'REVIU_PERBAIKAN',note,Number(req.current_round)||1)",
    "notifyPpkStatus_(req,'REVIU_PERBAIKAN',review.note,Number(req.current_round)||1)"
  ])assert.ok(backend.includes(snippet),snippet);
});
