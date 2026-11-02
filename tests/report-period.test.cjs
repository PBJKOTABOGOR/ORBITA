const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
function fixture(now){const RealDate=Date;class Clock extends RealDate{constructor(...a){super(...(a.length?a:[now]));}}const c=vm.createContext({window:{TRAXPBJ_SESSION:{matches:()=>true,scoped:()=>false,opd:()=>''}},document:{querySelector:()=>null,querySelectorAll:()=>[],addEventListener(){}},Date:Clock,Intl,location:{hash:''},setInterval(){},IntersectionObserver:class{observe(){}},console});let s=fs.readFileSync(path.join(__dirname,'../assets/js/rapor-kota.js'),'utf8').replace(/\}\)\(\);\s*$/,'window.pick=latestCityIndexRows;window.pickNotes=analysisRowsForScope;})();');vm.runInContext(s,c);return c.window;}
const rows=[
  {id_rapot:'aug-city',nama_opd:'KOTA BOGOR',kode_opd:'00_kotabogor',tahun:2026,bulan:8},
  {id_rapot:'sep-a',nama_opd:'DINAS A',kode_opd:'1-A',tahun:2026,bulan:9},
  {id_rapot:'sep-b',nama_opd:'DINAS B',kode_opd:'2-B',tahun:2026,bulan:9},
  {id_rapot:'sep-city',nama_opd:'KOTA BOGOR',kode_opd:'00_kotabogor',tahun:2026,bulan:9},
  {id_rapot:'jul-city',nama_opd:'KOTA BOGOR',kode_opd:'00_kotabogor',tahun:2026,bulan:7}
];
test('October reads only September KOTA BOGOR and never aggregates OPD rows',()=>{assert.deepEqual(Array.from(fixture('2026-10-03T08:00:00Z').pick(rows),x=>x.id),['sep-city']);});
test('target month without KOTA BOGOR stays unavailable instead of falling back or summing OPDs',()=>{const onlyOpd=rows.filter(x=>x.id_rapot!=='sep-city');assert.equal(fixture('2026-10-03T08:00:00Z').pick(onlyOpd).length,0);});
test('January uses December of the preceding year for KOTA BOGOR',()=>{const pick=fixture('2027-01-15T08:00:00Z').pick;assert.equal(pick([{id_rapot:'dec',nama_opd:'KOTA BOGOR',kode_opd:'00_kotabogor',tahun:2026,bulan:12}])[0]?.id,'dec');});
test('report month follows Jakarta at a UTC month boundary',()=>{assert.equal(fixture('2026-09-30T18:00:00Z').pick(rows)[0]?.id,'sep-city');});
test('Kesimpulan dan saran always uses only the KOTA BOGOR analysis row',()=>{const indexes=[{id:'city',name:'KOTA BOGOR',code:'00_kotabogor',r:{kode_opd:'00_kotabogor'}},{id:'a',name:'DINAS A',code:'1-A',r:{kode_opd:'1-A'}}];const notes=[{id_rapot:'city',kesimpulan_progres:'Kota saja'},{id_rapot:'a',kesimpulan_progres:'OPD A'}];assert.deepEqual(Array.from(fixture('2026-10-03T08:00:00Z').pickNotes(notes,indexes),x=>x.id_rapot),['city']);});
