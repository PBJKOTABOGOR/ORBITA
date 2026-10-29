'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const src=fs.readFileSync(path.join(__dirname,'../backend/Code-TRAXPBJ-Pemilihan.gs'),'utf8');
function ctx(extra={}){const c=vm.createContext({Date,JSON,Math,Number,Logger:{log(){}},...extra});vm.runInContext(src,c);return c;}

test('DATA ORBITA ditetapkan sebagai database antrean email terpisah',()=>{
  assert.match(src,/MAIL_DB_ID: '1WcL5uJBcnIWScOErmR--Ll7CBeRC6lnNHexdcMVsOdE'/);
  assert.match(src,/if\(name===PBJWF\.SHEETS\.MAIL_QUEUE\)return emailQueueSheet_\(\)/);
  assert.match(src,/filter\(name=>name!==PBJWF\.SHEETS\.MAIL_QUEUE\)/);
  assert.match(src,/function migrasiEmailQueueKeDataOrbita\(/);
});

test('pesan metode tepat untuk tahap persiapan, negosiasi dan minikom konstruksi atau barang',()=>{
  const c=ctx();
  assert.equal(c.requestMailMethod_({selection_process:'PERSIAPAN'}),'Belum ditetapkan Pokja (Kaji Ulang)');
  assert.equal(c.requestMailMethod_({selection_process:'NEGOSIASI'}),'Negosiasi');
  assert.equal(c.requestMailMethod_({selection_process:'MINI_KOMPETISI',competition_type:'CONSTRUCTION'}),'Mini Kompetisi (Pekerjaan Konstruksi)');
  assert.equal(c.requestMailMethod_({selection_process:'MINI_KOMPETISI',competition_type:'NON_CONSTRUCTION'}),'Mini Kompetisi (Barang/Jasa Lainnya)');
  const req={request_id:'P-123-01',kode_rup:'123',nama_paket:'Tes',opd:'UKPBJ',ppk_nama:'PPK',selection_process:'MINI_KOMPETISI',competition_type:'CONSTRUCTION'};
  assert.match(c.handoverMailBody_(req,'Mini Kompetisi'),/Metode Pemilihan: Mini Kompetisi \(Pekerjaan Konstruksi\)/);
  assert.match(c.ppkStatusMail_(req,'MINI_GAGAL','Tidak ada peserta').body,/Metode Pemilihan: Mini Kompetisi \(Pekerjaan Konstruksi\)/);
});

test('mail enqueue deduplikasi dengan TextFinder, tidak membaca seluruh sheet',()=>{
  const rows=[],queue={};const c=ctx();
  c.sheet_=()=>queue;c.findRow_=(_sh,key,value)=>rows.some(r=>r.event_key===value)?{row:2}:null;
  c.appendObj_=(_sh,obj)=>rows.push(obj);c.id_=_=>'EMAIL-1';
  assert.equal(c.mailQueue_('EV:1','p@bogor.go.id','Subjek','Isi'),true);
  assert.equal(c.mailQueue_('EV:1','p@bogor.go.id','Subjek','Isi'),false);
  assert.equal(rows.length,1);assert.equal(rows[0].status,'PENDING');
  assert.match(src,/createTextFinder\('PENDING'\)/);
});

test('proses pengguna tidak menunggu Gmail mengirim email',()=>{
  const c=ctx();let queued=0,trigger=0,sent=0;
  c.mailQueue_=()=>{queued++;return true;};c.ensureMailQueueTrigger_=()=>trigger++;
  c.sendQueueMail_=()=>sent++;
  c.bestEffortMail_('EV:1','p@bogor.go.id','Subjek','Isi');
  assert.equal(queued,1);assert.equal(trigger,1);assert.equal(sent,0);
});
