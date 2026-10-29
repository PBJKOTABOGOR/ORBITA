(() => {
  'use strict';
  const fetchJSON = async (url) => { try { const r=await fetch(url,{cache:'force-cache'}); if(!r.ok)return null; return await r.json(); } catch { return null; } };
  const leaderDefaults={kabag:{name:'',photo:'',role:'Kepala Bagian Pengadaan Barang dan Jasa'},lpse:{name:'Ketua Kelompok LPSE',photo:'',role:'Ketua Kelompok LPSE'},advokasi:{name:'Ketua Kelompok Pembinaan dan Advokasi',photo:'',role:'Ketua Kelompok Pembinaan dan Advokasi'},pengelolaan:{name:'Ketua Kelompok Pengelolaan PBJ',photo:'',role:'Ketua Kelompok Pengelolaan PBJ'}};
  function mapLeaders(rows=[]){const leaders=JSON.parse(JSON.stringify(leaderDefaults));rows.forEach(r=>{const key=String(r.key||r.kelompok||'').toLowerCase();if(!leaders[key])return;leaders[key]={...leaders[key],name:r.nama||leaders[key].name,photo:r.foto||'',role:r.jabatan||leaders[key].role,fileId:r.fileId||''};});return {leaders};}
  function mapDocumentation(rows=[]){return rows.map(r=>{const media=Array.isArray(r.media)?r.media:(r.foto||[]).map(x=>({...x,type:'image',imageUrl:x.url,embedUrl:''}));const rawIg=r.instagram??r.instagram_urls??[];const instagram=Array.isArray(rawIg)?rawIg:String(rawIg||'').split(/[\n,]+/).map(x=>x.trim()).filter(Boolean);return {id:r.id,date:r.tanggal||'',title:r.judul||'',location:r.lokasi||'',category:r.kategori||'Pendampingan',description:r.deskripsi||'',photo:r.cover||media?.[0]?.imageUrl||media?.[0]?.url||'',photos:r.foto||[],media,instagram};});}
  function mapTeam(rows=[]){return rows.map(r=>({id:r.id,name:r.nama||'',role:r.jabatan||'',group:r.kelompok||'',photo:r.foto||'',fileId:r.fileId||''}));}
  function mapSurat(rows=[]){return rows.map(r=>({id:r.id,date:r.tanggal||'',number:r.nomorSurat||r.nomor_surat||'',title:r.perihal||r.judul||r.namaFile||'',type:r.jenis||'Surat PBJ',fileId:r.fileId||r.file_id||'',url:r.url||r.file_url||'',fileName:r.namaFile||r.nama_file||'',mimeType:r.mimeType||r.mime_type||'',modifiedAt:r.modifiedAt||r.modified_at||''}));}
  function unpackTime(text=''){const m=String(text).match(/^@time:([^\n]+)\n?/i);return {time:m?m[1].trim():'',summary:m?String(text).slice(m[0].length):String(text)};}
  function mapEvents(rows=[]){return rows.map(r=>{const t=unpackTime(r.keterangan||'');return {id:r.id,type:r.jenis||'Kegiatan',title:r.kegiatan||'',date:r.tanggal||'',time:t.time,place:r.tempat||'',summary:t.summary,status:r.status||'',materialUrl:r.link||'',documentUrl:r.fileUrl||'',documentFileId:r.fileId||'',documentFileName:r.namaFile||'',documentMimeType:r.mimeType||''};});}
  function mapKnowledge(rows=[]){return rows.map(r=>({id:r.id,category:r.kategori||'Panduan',title:r.judul||'',year:String(r.tanggal||'').slice(0,4)||'',summary:r.deskripsi||'',url:r.url||'',fileId:r.fileId||'',fileName:r.namaFile||''}));}
  let base={}; let lastSignature=''; let currentVersion='';
  function merge(remote){
    const baseContent=base.content, baseEvaluation=base.evaluation, baseSite=base.site, baseAdvocacy=base.advocacy;
    const leaders=remote?mapLeaders(remote.pimpinan||[]):baseContent||{leaders:leaderDefaults};
    const evalStore=baseEvaluation?.years?JSON.parse(JSON.stringify(baseEvaluation)):{currentYear:2026,years:{}};
    if(remote?.evaluasi?.years?.['2026']) evalStore.years['2026']=remote.evaluasi.years['2026']; evalStore.currentYear=2026;
    const siteContent=remote?{documentation:(remote.dokumentasi||[]).length?mapDocumentation(remote.dokumentasi):baseSite?.documentation||[],team:(remote.tim||[]).length?mapTeam(remote.tim):baseSite?.team||[],suratPBJ:mapSurat(remote.suratPBJ||[])}:{...(baseSite||{documentation:[],team:[]}),suratPBJ:[]};
    const advocacy=remote?{events:(remote.edukasi||[]).length?mapEvents(remote.edukasi):baseAdvocacy?.events||[],knowledge:(remote.pengetahuan||[]).length?mapKnowledge(remote.pengetahuan):baseAdvocacy?.knowledge||[],forum:baseAdvocacy?.forum||[]}:(baseAdvocacy||{events:[],knowledge:[],forum:[]});
    return {leaders,evalStore,siteContent,advocacy};
  }
  function publish(remote,online,source){
    const {leaders,evalStore,siteContent,advocacy}=merge(remote);
    currentVersion=String(remote?.version||currentVersion||''); const signature=JSON.stringify([remote?.version||'',siteContent.documentation.length,siteContent.team.length,siteContent.suratPBJ.length,siteContent.suratPBJ.map(x=>[x.id,x.modifiedAt]),advocacy.events.length,advocacy.knowledge.length,leaders.leaders]);
    window.TRAXPBJ_BACKEND_ONLINE=!!online; window.TRAXPBJ_REMOTE_BOOTSTRAP=remote||null; window.TRAXPBJ_ADMIN_CONTENT=leaders; window.TRAXPBJ_EVALUATIONS=evalStore; window.TRAXPBJ_EVALUATION=evalStore.years['2026']||null; window.TRAXPBJ_SITE_CONTENT=siteContent; window.TRAXPBJ_ADVOCACY=advocacy;
    if(signature!==lastSignature){lastSignature=signature;document.dispatchEvent(new CustomEvent('trax:content-ready',{detail:{content:leaders,evaluations:evalStore,evaluation:evalStore.years['2026']||null,siteContent,advocacy,remote,backendOnline:!!online,source}}));}
  }
  async function refresh(){try{const remote=await window.TRAXPBJ_API.refreshBootstrap();publish(remote,true,'network');return remote;}catch(err){console.warn('TRAXPBJ API:',err);return null;}}
  async function load(){
    const [content,evaluation,site,advocacy]=await Promise.all([fetchJSON('../assets/data/admin-content.json'),fetchJSON('../assets/data/evaluasi-layanan.json'),fetchJSON('../assets/data/site-content.json'),fetchJSON('../assets/data/advocacy-portal.json')]);
    base={content,evaluation,site,advocacy};
    const cached=window.TRAXPBJ_API?.readBootstrapCache?.(0)||null;
    publish(cached,false,cached?'cache':'bundled');
    refresh();
    const checkVersion=async()=>{if(document.visibilityState!=='visible')return;try{const r=await window.TRAXPBJ_API.get('version');const v=String(r.version||'');if(v&&v!==currentVersion)await refresh();}catch(_){}};
    setInterval(checkVersion,20000);
    document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')checkVersion();});
  }
  window.TRAXPBJ_REFRESH_CONTENT=refresh;
  load();
})();
