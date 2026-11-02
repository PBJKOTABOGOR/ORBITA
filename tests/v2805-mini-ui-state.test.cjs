const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const vm=require('node:vm');const path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'../assets/js/selection.js'),'utf8');
const win={},doc={addEventListener(){},querySelector(){return null},querySelectorAll(){return []}};
const ctx={window:win,document:doc,console,setTimeout,clearTimeout,Intl,Date,Map,Set,URL,Number,String,JSON,Math,localStorage:{getItem(){return null}},sessionStorage:{getItem(){return null}},navigator:{}};
vm.createContext(ctx);
vm.runInContext(source.replace(/\n\}\)\(\);\s*$/,'\nwindow.__testMini={miniHtml,miniDecisionState,state};\n})();'),ctx,{timeout:1500});
const api=win.__testMini;api.state.me={role:'POKJA',user_id:'U1'};
const req={request_id:'P-1',status:'SIAP_PROSES_INAPROC',mini_stage:'TAYANG',selection_process:'MINI_KOMPETISI',pagu:450000000,mini_tayang_at:'2026-10-09T05:00:00.000Z',current_round:1};
const details={request:req,docs:[{doc_type:'BA_HASIL_REVIU',is_current:true,file_name:'BA Gabungan.pdf',version:1,drive_url:'https://drive.google.com/test'}],reviews:[],notes:[]};
test('Selama penayangan tanpa tindakan terpilih tidak menampilkan BA perubahan maupun pembatalan',()=>{
 const h=api.miniHtml(details);assert.match(h,/Sedang ditayangkan/);assert.match(h,/data-mini-decision="PERUBAHAN"/);assert.match(h,/data-mini-decision="GAGAL"/);
 assert.doesNotMatch(h,/data-mini-doc="BA_PERSETUJUAN"|data-mini-doc="BA_PEMBATALAN"/);
});
test('Tindakan perubahan menampilkan upload BA persetujuan, tanpa BA pembatalan',()=>{
 api.miniDecisionState.set('P-1',{step:'PERUBAHAN',note:'Jadwal diubah'});const h=api.miniHtml(details);
 assert.match(h,/data-mini-doc="BA_PERSETUJUAN"/);assert.doesNotMatch(h,/data-mini-doc="BA_PEMBATALAN"/);
 assert.match(h,/Jadwal diubah/);assert.match(h,/data-mini-decision-save/);
});
test('Tindakan batal meminta BA pembatalan dan tidak meminta BA perubahan',()=>{
 api.miniDecisionState.set('P-1',{step:'BATAL'});const h=api.miniHtml(details);
 assert.match(h,/data-mini-doc="BA_PEMBATALAN"/);assert.doesNotMatch(h,/data-mini-doc="BA_PERSETUJUAN"/);
});
test('Tindakan gagal hanya meminta alasan, tidak menampilkan upload BA apapun',()=>{
 api.miniDecisionState.set('P-1',{step:'GAGAL'});const h=api.miniHtml(details);
 assert.match(h,/Tuliskan alasan kompetisi gagal/);assert.match(h,/Tidak perlu mengunggah dokumen/);
 assert.doesNotMatch(h,/data-mini-doc=/);
});
