'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'..');
const be=fs.readFileSync(path.join(root,'backend/Code-TRAXPBJ-Pemilihan.gs'),'utf8');
const fe=fs.readFileSync(path.join(root,'assets/js/selection.js'),'utf8');
function ctx(){const c=vm.createContext({console,Date,Math,JSON,Logger:{log(){}},Utilities:{getUuid:()=> 'abcd-1234',formatDate:()=> '20261019150000'}});vm.runInContext(be,c);return c;}
const req={request_id:'P-111-01',kode_rup:'111',nama_paket:'Paket Contoh',opd:'Dinas Uji',assigned_pokja_id:'POKJA2'};

test('CTA yang sama muncul pada setiap notifikasi Kepala, PPK dan Pokja',()=>{
 const c=ctx(),link='https://pbjkotabogor.github.io/ORBITA/profil-pbj/#pengelolaan-pbj';
 assert.ok(be.includes("const PBJ_MAIL_PORTAL_URL='"+link+"'"));
 for(const k of ['NEW','DITOLAK_KEPALA','HANDOVER','DISPOSISI','PPK_KIRIM_ULANG']){
   const html=c.mailHtmlTemplate_('Status permohonan','Halo\n\nKode RUP: 111',k+':P-111-01');
   assert.ok(html.includes('href="'+link+'"'),k);
   assert.ok(html.includes('Buka ORBITA PBJ'),k);
   assert.ok(html.includes('https://pbjkotabogor.github.io/ORBITA/assets/img/favicon.png'),k);
 }
});

test('notification assigns only matching active POKJA members with registered email, no duplicate address',()=>{
 const c=ctx(),captured=[],users=[
  {role:'POKJA',pokja_id:'POKJA2',active:true,email:'orang1@bogor.go.id'},
  {role:'POKJA',pokja_id:'POKJA2',active:true,email:'ORANG1@bogor.go.id'},
  {role:'POKJA',pokja_id:'POKJA2',active:true,email:'orang2@bogor.go.id'},
  {role:'POKJA',pokja_id:'POKJA2',active:false,email:'nonaktif@bogor.go.id'},
  {role:'POKJA',pokja_id:'POKJA3',active:true,email:'salah@bogor.go.id'},
  {role:'PPK',pokja_id:'POKJA2',active:true,email:'ppk@bogor.go.id'}
 ];
 c.ensureUserEmailSchema_=()=>{};
 c.sheet_=name=>name;
 c.rows_=name=>name==='PBJ_USERS'?users:[];
 c.ensureMailQueueTrigger_=()=>{};
 c.mailQueue_=(key,to,subject,body)=>{captured.push({key,to,subject,body});return true};
 c.notifyPokjaStatus_(req,'DISPOSISI','Laksanakan kaji ulang','initial');
 assert.equal(captured.length,2);
 assert.deepEqual(captured.map(x=>x.to).sort(),['orang1@bogor.go.id','orang2@bogor.go.id']);
 assert.ok(captured.every(x=>x.body.includes('Penugasan')===false && x.body.includes('surat perintah')));
 assert.ok(captured.every(x=>x.subject.includes('Penugasan Paket kepada Pokja')));
 captured.length=0;
 c.notifyPokjaStatus_(req,'PPK_KIRIM_ULANG','KAK diperbarui',2);
 assert.equal(captured.length,2);
 assert.ok(captured[0].body.includes('Catatan PPK: KAK diperbarui'));
 assert.ok(captured[0].key.includes(':2'));
});

test('admin user email may be edited while public user profile still hides email',()=>{
 const c=ctx();
 const user={user_id:'USR-1',role:'POKJA',username:'tespokja',nama:'Pokja A',opd:'',pokja_id:'POKJA2',email:'x@bogor.go.id',active:true};
 assert.equal(c.publicUser_(user).email,undefined);
 const table=[user]; c.requireRole_=()=>{};c.ensureUserEmailSchema_=()=>{};c.sheet_=name=>name;
 c.findRow_=(name,key,v)=>{const i=table.findIndex(x=>x[key]===v);return i<0?null:{obj:table[i],row:i+2}};
 c.updateRow_=(name,row,patch)=>Object.assign(table[row-2],patch);c.audit_=()=>{};
 const result=c.adminSaveUser_({role:'ADMIN'},{userId:'USR-1',username:'tespokja',nama:'Pokja A',role:'POKJA',pokjaId:'POKJA2',email:'Baru@Bogor.Go.Id',active:true});
 assert.equal(table[0].email,'baru@bogor.go.id');
 assert.equal(result.email,'baru@bogor.go.id');
 assert.throws(()=>c.adminSaveUser_({role:'ADMIN'},{userId:'USR-1',username:'tespokja',nama:'Pokja A',role:'POKJA',email:'salah-email'}),/Alamat email tidak valid/);
});

test('rejected request action sits immediately after notice, before documents, once',()=>{
 assert.ok(fe.includes("</p></section>${roleActions(d)}`:''}"));
 assert.ok(fe.includes("'PERLU_DETAIL_PPK','DITOLAK_KEPALA'].includes(r.status)?'':roleActions(d)"));
 assert.ok(fe.includes('id="auEmail"'));
 assert.ok(fe.includes("email:$('#auEmail').value.trim()"));
});

test('notification wires disposition and both PPK return paths',()=>{
 for(const snippet of [
   "notifyPokjaStatus_(assigned,'DISPOSISI'",
   "notifyPokjaStatus_({...req,...assigned},'DISPOSISI'",
   "notifyPokjaStatus_(req,'PPK_KIRIM_ULANG',note,prev+1)",
   "notifyPokjaStatus_(req,'PPK_KIRIM_ULANG',note,next)",
   "notifyPokjaStatus_(req,'PPK_DETAIL_LENGKAP'"
 ])assert.ok(be.includes(snippet),snippet);
});
