const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.resolve(__dirname,'..');
const source=fs.readFileSync(path.join(root,'assets/js/selection.js'),'utf8');
const backend=fs.readFileSync(path.join(root,'backend/Code-TRAXPBJ-Pemilihan.gs'),'utf8');
const css=fs.readFileSync(path.join(root,'assets/css/selection.css'),'utf8');
const html=fs.readFileSync(path.join(root,'profil-pbj/index.html'),'utf8');
function ui(role='POKJA'){
  const win={};const doc={addEventListener(){},querySelector(){return null},querySelectorAll(){return []}};
  const context={window:win,document:doc,console,setTimeout,clearTimeout,Intl,Date,Map,Set,URL,Number,String,JSON,Math,localStorage:{getItem(){return null}},sessionStorage:{getItem(){return null}},navigator:{}};
  vm.createContext(context);
  vm.runInContext(source.replace(/\n\}\)\(\);\s*$/,'\nwindow.__check={detailHtml,reviewPanelHtml,docsHtml,state,confirmPackageReview,syncReviewDecisionUi};\n})();'),context,{timeout:1500});
  win.__check.state.me={role,user_id:'POKJA_A'};
  return win.__check;
}
const base={request_id:'P-62688119-01',current_round:1,status:'REVIU_POKJA',assigned_pokja_id:'POKJA_A',selection_process:'MINI_KOMPETISI',competition_type:'NON_CONSTRUCTION',kode_rup:'62688119',nama_paket:'Jasa Kebersihan',opd:'DINAS KESEHATAN',pagu:356300000,jenis:'Jasa Lainnya',year:'2026'};
const detail=req=>({request:req,docs:[],reviews:[],notes:[],audit:[],docConfig:[],pokja:[],inaproc:null});
test('Reviu Pokja di atas Rekap OPD dan tidak muncul dua kali',()=>{
  const x=ui(),render=x.detailHtml(detail({...base}));
  const iReview=render.indexOf('Reviu Paket</b>'),iRecap=render.indexOf('Rekap Permohonan OPD');
  assert.ok(iReview>=0&&iRecap>=0&&iReview<iRecap);
  assert.equal((render.match(/data-save-review="__PAKET__"/g)||[]).length,1);
  assert.equal((render.match(/data-mini-doc="BA_HASIL_REVIU"/g)||[]).length,0);
  assert.doesNotMatch(render,/Reviu paket dan unggah dokumen hasil reviu dilakukan pada bagian yang sama/);
  assert.doesNotMatch(render,/Unggah BA hasil reviu di bagian ini sebelum klik Simpan Reviu/);
  assert.doesNotMatch(render,/sel-mini-workflow" id="selMiniWorkflow"/);
});
test('Pilihan hasil reviu berupa dua kartu, tanpa dua upload BA lama',()=>{
  const x=ui(),out=x.reviewPanelHtml(detail({...base}));
  assert.match(out,/data-review-choice="SESUAI"/);
  assert.match(out,/data-review-choice="PERLU_PERBAIKAN"/);
  assert.doesNotMatch(out,/data-review-upload-slot/);
  assert.match(out,/data-review-note="__PAKET__"/);
  assert.ok(out.indexOf('data-review-choices')<0); // native styling uses class rather than a data attribute
  assert.ok(out.indexOf('data-review-choice')<out.indexOf('data-review-note'));
  assert.ok(out.indexOf('data-review-note')<out.indexOf('data-save-review'));
});
test('Negosiasi tidak memaksa upload BA sebelum tahap negosiasi',()=>{
  const x=ui(),render=x.detailHtml(detail({...base,selection_process:'NEGOSIASI'}));
  assert.match(render,/Reviu Paket/);
  assert.doesNotMatch(render,/data-nego-doc="NEGO_BA_HASIL_REVIU"/);
  assert.doesNotMatch(render,/data-review-upload-slot/);
  assert.doesNotMatch(source,/Unggah BA Hasil Reviu dan BA Persetujuan Pokja terlebih dahulu/);
});
test('Backend membedakan Sesuai tanpa dua BA lama dan Perlu Perbaikan dengan catatan',()=>{
  const part=backend.slice(backend.indexOf('function submitPackageReview_('),backend.indexOf('function savePackageReview_('));
  assert.doesNotMatch(part,/miniRequireReviewDocs_/);
  assert.match(part,/if\(status==='PERLU_PERBAIKAN'&&!note\)/);
  assert.match(part,/const target=status==='SESUAI'\?STATUS\.SIAP_INAPROC:STATUS\.PERLU_PERBAIKAN_PPK/);
  assert.match(source,/if\(correction&&!note\)/);
  assert.match(css,/\.sel-review-upload-slot\[hidden\]/);
  assert.match(html,/selection\.css\?v=28\.71/);
  assert.match(html,/selection\.js\?v=28\.77/);
});
