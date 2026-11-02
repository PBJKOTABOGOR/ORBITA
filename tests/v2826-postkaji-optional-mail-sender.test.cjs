'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.join(__dirname,'..');
const js=fs.readFileSync(path.join(root,'assets/js/selection.js'),'utf8');
const backend=fs.readFileSync(path.join(root,'backend/Code-TRAXPBJ-Pemilihan.gs'),'utf8');
const sender=fs.readFileSync(path.join(root,'backend/Code-ORBITA-Email-Sender.gs'),'utf8');
const css=fs.readFileSync(path.join(root,'assets/css/selection.css'),'utf8');

test('jenis mini kompetisi Kaji Ulang terkunci di UI, event dan route',()=>{
  assert.match(js,/function lockedPostKajiCompetitionType\(/);
  assert.match(js,/const original=String\(c\.sourceDetail\?\.request\?\.competition_type/);
  assert.match(js,/unavailable\?'disabled aria-disabled="true"'/);
  assert.match(js,/locked&&type!==locked\)return/);
  assert.match(js,/lockedPostKajiCompetitionType\(state\.create\)==='CONSTRUCTION'/);
  assert.match(js,/lockedPostKajiCompetitionType\(state\.create\)==='NON_CONSTRUCTION'/);
  assert.match(css,/\.sel-competition-card\.kaji-locked-out/);
  assert.match(backend,/Jenis Mini Kompetisi sudah ditetapkan Pokja dan tidak dapat diubah/);
});
test('Informasi Umum konstruksi opsional, harga/jumlah/satuan tetap wajib',()=>{
  assert.match(js,/Daftar Produk Sektoral <em>Tidak Wajib<\/em>/);
  assert.match(js,/Nama Pekerjaan <em>Tidak Wajib<\/em>/);
  assert.match(js,/if\(save\)save\.disabled=!\(h>0&&q>0&&String\(unit\?\.value\|\|''\)\.trim\(\)&&!over\)/);
  assert.doesNotMatch(js,/const sectoralOk=!sectoral\.length/);
  assert.match(backend,/!String\(d&&d\.categoryPath\|\|''\)\.trim\(\)\|\|!\(Number\(d&&d\.hps\)>0\)/);
  assert.doesNotMatch(backend,/!String\(d&&d\.name\|\|''\)\.trim\(\)/);
});
test('backend utama mengantre, tidak mengirim dan tidak fallback ke Sheet lama',()=>{
  assert.match(backend,/function processPemilihanMailQueue\(\)\{\s*\/\/ Trigger lama[^\n]*\n\s*return 0;/);
  assert.match(backend,/function ensureMailQueueTrigger_\(\)\{return;\}/);
  assert.doesNotMatch(backend,/MailApp\.sendEmail\(/);
  assert.doesNotMatch(backend,/GmailApp\.sendEmail\(/);
  assert.match(backend,/function nonaktifkanTriggerEmailBackendLama\(/);
  assert.match(backend,/function emailQueueSheet_\(\)\{\s*const sh=mailSs_\(\)/);
});
test('pengirim DATA ORBITA memakai akun yang menjalankan trigger, logo tanpa attachment',()=>{
  const captured=[];
  const headers=['id','created_at','event_key','recipient','subject','body','status','attempts','sent_at','last_error'];
  const entry=['EML-1','19/10/2026','DISPOSISI:P-100','pokja@bogor.go.id','Penugasan Pokja','Metode Pemilihan: Mini Kompetisi (Pekerjaan Konstruksi)','PENDING',0,'',''];
  const sh={getSheetByName(){return this},getLastRow(){return 2},getLastColumn(){return headers.length},getRange(row,col,numRows=1,numCols=1){
    if(row===1)return {getDisplayValues(){return [headers]}};
    if(col===7)return {createTextFinder(){let once=false;return {matchEntireCell(){return this;},findNext(){if(once)return null;once=true;return {getRow(){return 2;}};}};}};
    return {getValues(){return [[...entry]]},setValues(value){entry.splice(0,entry.length,...value[0]);}};
  }};
  const scope=vm.createContext({
    Date,Math,Number,String,JSON,
    SpreadsheetApp:{openById(){return sh}},
    LockService:{getScriptLock(){return {tryLock(){return true},releaseLock(){}}}},
    MailApp:{sendEmail(o){captured.push(o)}},
    Session:{getEffectiveUser(){return {getEmail(){return 'pemilik-data-orbita@gmail.com'}}}},
    ScriptApp:{getProjectTriggers(){return []},newTrigger(){return {timeBased(){return this},everyMinutes(){return this},create(){}}}},
    Logger:{log(){}}
  });
  vm.runInContext(sender,scope);
  assert.equal(scope.prosesAntreanEmailDATAORBITA(),1);
  assert.equal(captured.length,1);
  assert.equal(captured[0].name,'ORBITA PBJ KOTA BOGOR');
  assert.match(captured[0].htmlBody,/Buka ORBITA PBJ/);
  assert.match(captured[0].htmlBody,/https:\/\/pbjkotabogor\.github\.io\/ORBITA\/assets\/img\/favicon\.png/);
  assert.doesNotMatch(captured[0].htmlBody,/cid:/);
  assert.equal(captured[0].attachments,undefined);
  assert.equal(captured[0].inlineImages,undefined);
  assert.equal(entry[6],'SENT');
  assert.equal(entry[7],1);
  assert.match(captured[0].body,/Pekerjaan Konstruksi/);
});
