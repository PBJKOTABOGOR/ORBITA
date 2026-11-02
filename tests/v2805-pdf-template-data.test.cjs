const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const path=require('node:path');const vm=require('node:vm');
const src=fs.readFileSync(path.join(__dirname,'../backend/Code-TRAXPBJ-Pemilihan.gs'),'utf8');
const ctx=vm.createContext({Date,console,Set,Map,JSON});vm.runInContext(src,ctx);
test('Template PDF Dokumen Laporan memisahkan BA Pokja dan dokumen PPK serta riwayat Mini Kompetisi',()=>{
 const rep={user:{nama:'Pokja Uji'},pokja:'POKJA 2',period:{from:'2026-01-01',to:'2026-12-31'},generated_at:'2026-10-09T08:00:00Z',counts:{assigned:1,reviewed:1,started:0},items:[{
  request_id:'P-1',kode_rup:'62688119',nama_paket:'Jasa Kebersihan',opd:'DINAS KESEHATAN',selection_process:'MINI_KOMPETISI',mini_stage:'TAYANG',status:'SIAP_PROSES_INAPROC',reached:false,source_state:'not_started',stage:3,
  assigned_at:'2026-10-08',review_started_at:'2026-10-08',review_completed_at:'2026-10-09',assignment_document:null,
  documents:[{name:'KAK',url:'https://drive.google.com/kak'}],process_documents:[{name:'BA Hasil Reviu dan Persetujuan Pokja',url:'https://drive.google.com/ba'}],review_rounds:[{round:1,status:'Sesuai',date:'2026-10-09',note:'Sesuai'}],actions:[{action:'MINI_TAYANG',date:'2026-10-09T07:00:00Z',note:''}],order_date:'',transaction_count:0
 }]};
 const html=vm.runInContext('pokjaSkpPdfHtml_('+JSON.stringify(rep)+')',ctx);
 for(const str of ['Dokumen Laporan Pokja','Dokumen Persiapan PPK','Dokumen Proses Pemilihan','BA Hasil Reviu dan Persetujuan Pokja','KAK','Sedang ditayangkan','Riwayat Proses Pemilihan','Ditayangkan di INAPROC']) assert.ok(html.includes(str),str);
 assert.match(html,/href="https:\/\/drive.google.com\/ba"/);
 assert.doesNotMatch(html,/<h1>Laporan SKP<\/h1>/);
});
