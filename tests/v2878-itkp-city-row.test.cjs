const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const script=fs.readFileSync(path.join(__dirname,'../assets/js/live-data.js'),'utf8');
// Read parser without starting network fetch / timers.
const parserOnly=script.slice(0,script.indexOf('  const LIVE_CACHE_KEY'))+'\nwindow.__parseITKP=parseITKP;})();';
const context=vm.createContext({window:{},console,Number,String,Math,Intl});
vm.runInContext(parserOnly,context);
const parse=context.window.__parseITKP;
function table(rows){
  const headers=Array.from({length:30},(_,i)=>`Kolom ${i+1}`);
  headers[0]='Satuan Kerja';
  for(const [i,key] of [[3,'Prosentase (SIRUP)'],[7,'Prosentase (SIRUP Penyedia)'],[11,'Prosentase (et+ep)'],[15,'Prosentase (Realisasi et+ep)'],[19,'Prosentase (Realisasi PL)'],[23,'Prosentase (Realisasi Penunjukan Langsung)'],[27,'Prosentase (Nilai Realisasi P&SW)']]) {
    headers[i]=key;headers[i+1]=`Nilai ITKP - skor maksimal indikator ${i}`;
  }
  headers[29]='Nilai ITKP Indikator Pemanfaatan Sistem - skor maksimal 30 (point)';
  return {cols:headers.map((label,i)=>({label,id:`C${i}`})),rows:rows.map(r=>({c:r.map(v=>({v,f:v}))}))};
}
const city=Array(30).fill(0);
city[0]='PEMERINTAH KOTA BOGOR';
const cityPct=[.984092099,.9729941107,.518076577,.3688305674,.6224092276,.99947175,.597910566];
const cityScore=[5,2.5,2,4,2.5,2.5,2];
for(let i=0;i<7;i++){city[[3,7,11,15,19,23,27][i]]=cityPct[i];city[[4,8,12,16,20,24,28][i]]=cityScore[i];}
city[29]=20.5;
const opd=Array(30).fill(1);opd[0]='DINAS LAIN';for(let i=0;i<7;i++)opd[[4,8,12,16,20,24,28][i]]=0.5;opd[29]=3.5;
test('Kota Bogor takes the exact summary row, never sum of OPD + Kota',()=>{
  const result=parse(table([opd,city]));
  assert.equal(result.city.name,'Pemerintah Kota Bogor');
  assert.equal(result.city.totalScore,20.5);
  assert.equal(result.average,20.5);
  for(let i=0;i<7;i++) {
    assert.equal(result.city.scores[i],cityScore[i]);
    assert.ok(Math.abs(result.city.percentages[i]-cityPct[i]*100)<.000001);
    assert.equal(result.metrics[i].score,cityScore[i]);
  }
  assert.equal(result.rows.length,2);
  assert.equal(result.rows.find(r=>r.name==='DINAS LAIN').totalScore,3.5);
});
test('city row matching is case and whitespace insensitive; no position dependency',()=>{
 const clone=city.slice();clone[0]='  Pemerintah  Kota   Bogor '; const d=parse(table([clone,opd]));
 assert.equal(d.city.totalScore,20.5);
});
test('when city row is missing it does not invent a city score',()=>{
 assert.throws(()=>parse(table([opd])),/baris-pemerintah-kota-bogor-tidak-ditemukan/);
});
test('raw city score from sheet is authoritative even if scoring formula differs',()=>{
 const clone=city.slice();clone[29]=19.75;
 assert.equal(parse(table([clone,opd])).city.totalScore,19.75);
});
