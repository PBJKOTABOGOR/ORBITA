/**
 * TRAXPBJ Kota Bogor - Backend API v1
 * Google Sheet + Google Drive centralized CMS for GitHub Pages.
 */

const TRAX = {
  SPREADSHEET_ID: '1638oxufJFu79C-kZcX1TIoRwp1dd3_ZC1WiKWcTrxTA',
  SIPD_SPREADSHEET_ID: '1ES67SRI9Or_iXoG-nDxwUxbNngpvR9Jhk_4pYnLPcEU',
  SIPD_SHEET: 'SIPDTARIKSIPD',
  SIPD_ACCOUNT_PREFIXES: ['5.1.02','5.1.05','5.1.06','5.2','5.3'],
  ROOT_FOLDER_ID: '1GTFg_JBFKZlhjq8ZtY7RAE4WGriD8PP0',
  SURAT_PBJ_FOLDER_ID: '12xMo_kwfYi2l4g7XsLYwh9mniQ0ye6KW',
  EDUKASI_FOLDER_ID: '1vQg8onte8aYu5wt4_4YWM2DPcCUoHiPT',
  TZ: 'Asia/Jakarta',
  SESSION_TTL: 21600,
  MAX_UPLOAD_BYTES: 8 * 1024 * 1024,
  MAX_VIDEO_BYTES: 20 * 1024 * 1024,
  PUBLIC_CACHE_TTL: 20,
  FOLDERS: {
    PIMPINAN: '01_PIMPINAN_PBJ',
    TIM: '02_TIM_PBJ',
    DOKUMENTASI: '03_DOKUMENTASI_PENDAMPINGAN',
    PENGETAHUAN: '04_PUSAT_PENGETAHUAN',
    EVALUASI: '05_IMPORT_EVALUASI'
  },
  SHEETS: {
    CONFIG: ['key','value'],
    PIMPINAN: ['id','kelompok','nama','jabatan','file_id','file_url','urutan','aktif','updated_at'],
    TIM_PBJ: ['id','nama','jabatan','kelompok','file_id','file_url','urutan','aktif','updated_at'],
    DOKUMENTASI: ['id_kegiatan','tanggal','judul','lokasi','kategori','deskripsi','cover_file_id','cover_url','folder_id','urutan','tampil','instagram_urls','updated_at'],
    DOKUMENTASI_FOTO: ['id_foto','id_kegiatan','file_id','file_url','caption','urutan','updated_at','media_type','mime_type','nama_file','upload_key'],
    PUSAT_PENGETAHUAN: ['id','kategori','judul','deskripsi','tanggal','file_id','file_url','nama_file','urutan','tampil','updated_at'],
    EDUKASI_KEGIATAN: ['id','tanggal','kegiatan','jenis','tempat','keterangan','link','status','urutan','tampil','updated_at','file_id','file_url','nama_file','mime_type'],
    SURAT_PBJ: ['id','tanggal','nomor_surat','perihal','jenis','file_id','file_url','nama_file','mime_type','modified_at','tampil','updated_at'],
    EVALUASI_LAYANAN: ['tahun','parameter_no','parameter','tidak_memuaskan','kurang_memuaskan','memuaskan','sangat_memuaskan','total','nilai_rata2','updated_at'],
    EVALUASI_RINGKASAN: ['tahun','responden','ikm','tanggal_update','source_file_id','source_file_name'],
    KOMITMEN_AKSES: ['opd','kode_akses','aktif','updated_at'],
    KOMITMEN_PERENCANAAN: ['id','tahun','opd','source_key','kode_skpd','kode_sub_unit','kode_sub_kegiatan','nama_sub_kegiatan','kode_sumber_dana','nama_sumber_dana','kode_rekening','nama_rekening','paket_kelompok','nama_paket','pagu_sipd','pagu_penyedia','pagu_swakelola','pagu_non_pengadaan','jenis_pengadaan','metode_pemilihan','dikecualikan','catatan','pic','nip','whatsapp','status','created_at','updated_at'],
    KOMITMEN_STATUS: ['id','tahun','opd','status','pic','nip','whatsapp','catatan','submitted_at','updated_at'],
    KOMITMEN_LOG: ['id','tahun','opd','aksi','pic','keterangan','created_at']
  },
  // SHA-256 password admin yang sudah dipakai di TRAXPBJ. Plaintext tidak ditaruh di frontend/API.
  DEFAULT_ADMIN_PASSWORD_HASH: '73c45eb278258fb4db2e495dbaff5d5ee5b4198e3b55b5daf31a64d60fd9321e'
};

let TRAX_SS_RUNTIME = null;
let TRAX_ROWS_RUNTIME = {};

function doGet(e) {
  try {
    const p = (e && e.parameter) || {};
    const action = String(p.action || 'health');

    if (action === 'health') return json_({ ok: true, service: 'TRAXPBJ API', version: 9, contentVersion: contentVersion_(), time: nowIso_() });
    if (action === 'version') return json_({ ok: true, version: contentVersion_(), time: nowIso_() });
    if (action === 'bootstrap') return json_({ ok: true, data: bootstrap_(p.force === '1') });
    if (action === 'pimpinan') return json_({ ok: true, data: getPimpinan_(), version: contentVersion_() });
    if (action === 'tim') return json_({ ok: true, data: getTim_(), version: contentVersion_() });
    if (action === 'dokumentasi') return json_({ ok: true, data: getDokumentasi_(p.id || ''), version: contentVersion_() });
    if (action === 'pengetahuan') return json_({ ok: true, data: getPengetahuan_(), version: contentVersion_() });
    if (action === 'edukasi') return json_({ ok: true, data: getEdukasi_(), version: contentVersion_() });
    if (action === 'suratPBJ') return json_({ ok: true, data: getSuratPBJ_(false), version: contentVersion_() });
    if (action === 'dokumentasiHub') return json_({ ok: true, data: getDokumentasiHub_(), version: contentVersion_() });
    if (action === 'evaluasi') return json_({ ok: true, data: getEvaluasi_(p.tahun || ''), version: contentVersion_() });
    if (action === 'sipdMeta') return json_({ ok: true, data: getSipdMeta_(p.tahun || '', p.force === '1'), version: contentVersion_() });

    return json_({ ok: false, error: 'Aksi tidak dikenal.' });
  } catch (err) {
    return json_({ ok: false, error: errorMessage_(err) });
  }
}

function doPost(e) {
  try {
    const body = parseBody_(e);
    const action = String(body.action || '');

    if (action === 'login') return json_(login_(body.password));
    if (action === 'logout') return json_(logout_(body.token));
    if (action === 'loadKomitmenWorkspace') return json_({ ok: true, data: loadKomitmenWorkspace_(body) });
    if (action === 'saveKomitmen') return json_({ ok: true, data: saveKomitmen_(body) });
    if (action === 'submitKomitmen') return json_({ ok: true, data: submitKomitmen_(body) });

    requireAdmin_(body.token);

    // Data akses OPD hanya dibaca saat menu Akses OPD dibuka agar halaman Admin tetap ringan.
    if (action === 'getKomitmenAkses') return json_({ ok: true, data: getKomitmenAksesAdmin_() });
    if (action === 'resetKomitmenAkses') return json_({ ok: true, data: resetKomitmenAksesAdmin_(body) });

    let data;
    if (action === 'savePimpinan') data = savePimpinan_(body);
    else if (action === 'savePimpinanBatch') data = savePimpinanBatch_(body);
    else if (action === 'saveTim') data = saveTim_(body);
    else if (action === 'saveTimBatch') data = saveTimBatch_(body);
    else if (action === 'deleteTim') data = deleteTim_(body.id);
    else if (action === 'saveDokumentasi') data = saveDokumentasi_(body);
    else if (action === 'uploadDokumentasiMedia') data = uploadDokumentasiMedia_(body);
    else if (action === 'deleteDokumentasiMedia') data = deleteDokumentasiMedia_(body);
    else if (action === 'deleteDokumentasi') data = deleteDokumentasi_(body.id);
    else if (action === 'savePengetahuan') data = savePengetahuan_(body);
    else if (action === 'savePengetahuanBatch') data = savePengetahuanBatch_(body);
    else if (action === 'deletePengetahuan') data = deletePengetahuan_(body.id);
    else if (action === 'saveEdukasi') data = saveEdukasi_(body);
    else if (action === 'deleteEdukasi') data = deleteEdukasi_(body.id);
    else if (action === 'syncSuratPBJ') data = syncSuratPBJ_(body);
    else if (action === 'saveSuratPBJ') data = saveSuratPBJ_(body);
    else if (action === 'importEvaluasiXlsx') data = importEvaluasiXlsx_(body);
    else if (action === 'saveEvaluasiRekap') data = saveEvaluasiRekap_(body);
    else if (action === 'setKomitmenStatus') data = setKomitmenStatus_(body);
    else return json_({ ok: false, error: 'Aksi admin tidak dikenal.' });

    const version = touchContent_();
    return json_({ ok: true, data: data, version: version });
  } catch (err) {
    return json_({ ok: false, error: errorMessage_(err) });
  }
}

/** Jalankan SEKALI setelah paste semua file Apps Script. */
function setupTRAXPBJ() {
  const ss = SpreadsheetApp.openById(TRAX.SPREADSHEET_ID);
  Object.keys(TRAX.SHEETS).forEach(name => ensureSheet_(ss, name, TRAX.SHEETS[name]));
  repairDokumentasiMediaSheet_(ss);

  const root = DriveApp.getFolderById(TRAX.ROOT_FOLDER_ID);
  Object.keys(TRAX.FOLDERS).forEach(key => ensureChildFolder_(root, TRAX.FOLDERS[key]));

  const props = PropertiesService.getScriptProperties();
  if (!props.getProperty('ADMIN_PASSWORD_HASH')) {
    props.setProperty('ADMIN_PASSWORD_HASH', TRAX.DEFAULT_ADMIN_PASSWORD_HASH);
  }

  seedConfig_(ss);
  seedPimpinan_(ss);
  try { seedKomitmenAkses_(); } catch (err) { Logger.log('Komitmen SIPD belum disiapkan: ' + errorMessage_(err)); }
  if (!props.getProperty('CONTENT_VERSION')) props.setProperty('CONTENT_VERSION', String(Date.now()));

  Logger.log('TRAXPBJ backend siap. Spreadsheet: ' + ss.getUrl());
  Logger.log('Folder utama: ' + root.getUrl());
  return { ok: true, spreadsheetId: TRAX.SPREADSHEET_ID, rootFolderId: TRAX.ROOT_FOLDER_ID };
}

function bootstrap_(force) {
  const cache = CacheService.getScriptCache();
  const key = 'bootstrap:v6:' + contentVersion_();
  if (!force) {
    const hit = cache.get(key);
    if (hit) {
      try { return JSON.parse(hit); } catch (_) {}
    }
  }
  const data = {
    version: contentVersion_(),
    generatedAt: nowIso_(),
    config: getConfig_(),
    pimpinan: getPimpinan_(),
    tim: getTim_(),
    dokumentasi: getDokumentasi_(''),
    pengetahuan: getPengetahuan_(),
    edukasi: getEdukasi_(),
    suratPBJ: getSuratPBJ_(false),
    evaluasi: getEvaluasi_('')
  };
  try {
    const raw = JSON.stringify(data);
    if (raw.length < 90000) cache.put(key, raw, TRAX.PUBLIC_CACHE_TTL);
  } catch (_) {}
  return data;
}

function contentVersion_() {
  return PropertiesService.getScriptProperties().getProperty('CONTENT_VERSION') || '1';
}
function touchContent_() {
  const old = contentVersion_();
  const v = String(Date.now());
  PropertiesService.getScriptProperties().setProperty('CONTENT_VERSION', v);
  TRAX_ROWS_RUNTIME = {};
  try { CacheService.getScriptCache().remove('bootstrap:v6:' + old); } catch (_) {}
  return v;
}


// ---------- KOMITMEN PERENCANAAN SIPD ----------
function setupKomitmenPBJ() {
  const ss = ss_();
  ['KOMITMEN_AKSES','KOMITMEN_PERENCANAAN','KOMITMEN_STATUS','KOMITMEN_LOG'].forEach(name => ensureSheet_(ss, name, TRAX.SHEETS[name]));
  seedKomitmenAkses_();
  Logger.log('Komitmen Perencanaan siap. Kode akses OPD tersedia pada sheet KOMITMEN_AKSES.');
  return { ok:true, aksesSheet:'KOMITMEN_AKSES', sourceSpreadsheetId:TRAX.SIPD_SPREADSHEET_ID, sourceSheet:TRAX.SIPD_SHEET };
}

function sipdSheet_() {
  const src = SpreadsheetApp.openById(TRAX.SIPD_SPREADSHEET_ID);
  const sh = src.getSheetByName(TRAX.SIPD_SHEET);
  if (!sh) throw new Error('Sheet sumber SIPD "' + TRAX.SIPD_SHEET + '" tidak ditemukan.');
  return sh;
}

function sipdHeaderMap_(headers) {
  const out = {};
  headers.forEach((h,i) => out[String(h||'').trim().toUpperCase()] = i);
  const req = ['TAHUN','KODE SKPD','NAMA SKPD','KODE SUB UNIT','NAMA SUB UNIT','KODE SUB KEGIATAN','NAMA SUB KEGIATAN','KODE SUMBER DANA','NAMA SUMBER DANA','KODE REKENING','NAMA REKENING','PAKET/KELOMPOK','NAMA PAKET/KELOMPOK','PAGU'];
  const miss = req.filter(k => out[k] === undefined);
  if (miss.length) throw new Error('Kolom SIPDTARIKSIPD tidak lengkap: ' + miss.join(', '));
  return out;
}

function isSipdProcurementAccount_(code) {
  code = str_(code);
  return TRAX.SIPD_ACCOUNT_PREFIXES.some(p => code === p || code.indexOf(p + '.') === 0);
}

function sourceKeyBaseFromSipd_(r) {
  return [r.tahun,r.kodeSkpd,r.kodeSubUnit,r.kodeSubKegiatan,r.kodeRekening,r.kodeSumberDana,r.paketKelompok,r.namaPaket]
    .map(v => String(v == null ? '' : v).trim().replace(/\s+/g,' ')).join('|');
}

function sipdSourceStamp_() {
  try {
    return String(DriveApp.getFileById(TRAX.SIPD_SPREADSHEET_ID).getLastUpdated().getTime());
  } catch (_) {
    const sh = sipdSheet_();
    return String(sh.getLastRow()) + '-' + String(sh.getLastColumn());
  }
}

function sipdSourceUpdatedAt_(stamp) {
  const n = Number(stamp);
  return Number.isFinite(n) && n > 1000000000000 ? new Date(n).toISOString() : '';
}

function sipdCacheGet_(key) {
  try {
    const raw = CacheService.getScriptCache().get(key);
    return raw ? JSON.parse(raw) : null;
  } catch (_) { return null; }
}

function sipdCachePut_(key, value, ttl) {
  try {
    const raw = JSON.stringify(value);
    // CacheService membatasi ukuran item. Data besar tetap dibaca langsung dari sumber.
    if (raw.length < 90000) CacheService.getScriptCache().put(key, raw, ttl || 21600);
  } catch (_) {}
}

function getSipdOpdBounds_(force, stamp) {
  stamp = stamp || sipdSourceStamp_();
  const key = 'sipd:bounds:' + stamp;
  if (!force) {
    const hit = sipdCacheGet_(key);
    if (hit) return hit;
  }
  const sh = sipdSheet_(), lastRow = sh.getLastRow();
  if (lastRow < 2) return {};
  // Hanya membaca kolom NAMA SKPD untuk mencari blok OPD. Ini jauh lebih ringan
  // dibanding membaca seluruh 23 kolom SIPD untuk setiap permintaan.
  const names = sh.getRange(2, 6, lastRow - 1, 1).getDisplayValues();
  const bounds = {};
  for (let i = 0; i < names.length; i++) {
    const name = str_(names[i][0]);
    if (!name) continue;
    const row = i + 2;
    if (!bounds[name]) bounds[name] = { first: row, last: row };
    else bounds[name].last = row;
  }
  sipdCachePut_(key, bounds, 21600);
  return bounds;
}

function getSipdRowsForOpd_(year, opd, force) {
  year = String(year || '').trim(); opd = str_(opd);
  if (!opd) throw new Error('Perangkat Daerah belum dipilih.');

  const stamp = sipdSourceStamp_();
  const cacheKey = 'sipd:rows:' + stamp + ':' + year + ':' + sha256Hex_(opd).slice(0, 14);
  if (!force) {
    const hit = sipdCacheGet_(cacheKey);
    if (hit) return hit;
  }

  const sh = sipdSheet_(), lastCol = Math.min(sh.getLastColumn(), 23);
  const bounds = getSipdOpdBounds_(!!force, stamp), bound = bounds[opd];
  if (!bound) return [];

  const header = sh.getRange(1, 1, 1, lastCol).getValues()[0];
  const H = sipdHeaderMap_(header);
  const values = sh.getRange(bound.first, 1, bound.last - bound.first + 1, lastCol).getValues();
  const rows = [];
  for (let i = 0; i < values.length; i++) {
    const v = values[i];
    const rowYear = String(v[H['TAHUN']] || '').trim();
    const rowOpd = str_(v[H['NAMA SKPD']]);
    const pagu = num_(v[H['PAGU']]);
    const kodeRekening = str_(v[H['KODE REKENING']]);
    if (year && rowYear !== year) continue;
    if (rowOpd !== opd || pagu <= 0 || !isSipdProcurementAccount_(kodeRekening)) continue;
    const r = {
      no: str_(v[0]), tahun: rowYear,
      kodeSkpd: str_(v[H['KODE SKPD']]), namaSkpd: rowOpd,
      kodeSubUnit: str_(v[H['KODE SUB UNIT']]), namaSubUnit: str_(v[H['NAMA SUB UNIT']]),
      kodeSubKegiatan: str_(v[H['KODE SUB KEGIATAN']]), namaSubKegiatan: str_(v[H['NAMA SUB KEGIATAN']]),
      kodeSumberDana: str_(v[H['KODE SUMBER DANA']]), namaSumberDana: str_(v[H['NAMA SUMBER DANA']]),
      kodeRekening: kodeRekening, namaRekening: str_(v[H['NAMA REKENING']]),
      paketKelompok: str_(v[H['PAKET/KELOMPOK']]), namaPaket: str_(v[H['NAMA PAKET/KELOMPOK']]), pagu: pagu
    };
    rows.push(r);
  }

  // Kunci tidak memasukkan pagu agar perubahan nilai SIPD tetap dapat dideteksi.
  const groups = {};
  rows.forEach(r => {
    const base = sourceKeyBaseFromSipd_(r);
    (groups[base] = groups[base] || []).push(r);
  });
  Object.keys(groups).forEach(base => {
    const g = groups[base];
    if (g.length === 1) {
      g[0].sourceKey = base;
      return;
    }
    const byAmount = {};
    g.forEach(r => {
      const amountKey = String(Math.round(num_(r.pagu)));
      const seq = (byAmount[amountKey] || 0) + 1;
      byAmount[amountKey] = seq;
      r.sourceKey = base + '|DUP|' + amountKey + (seq > 1 ? '|#' + seq : '');
    });
  });
  sipdCachePut_(cacheKey, rows, 21600);
  return rows;
}

function getSipdMeta_(year, force) {
  year = String(year || '').trim();
  const stamp = sipdSourceStamp_();
  const cacheKey = 'sipd:meta:' + stamp + ':' + (year || 'all');
  if (!force) {
    const hit = sipdCacheGet_(cacheKey);
    if (hit) return hit;
  }

  const sh = sipdSheet_(), lastRow = sh.getLastRow(), lastCol = Math.min(sh.getLastColumn(), 23);
  if (lastRow < 2) return { years:[], opds:[], accountPrefixes:TRAX.SIPD_ACCOUNT_PREFIXES, sourceSheet:TRAX.SIPD_SHEET, sourceUpdatedAt:sipdSourceUpdatedAt_(stamp) };
  const header = sh.getRange(1,1,1,lastCol).getValues()[0];
  const H = sipdHeaderMap_(header);
  const count = lastRow - 1;
  // Metadata hanya membutuhkan 4 kolom. Pembacaan dibuat kecil agar halaman awal cepat.
  const yearsCol = sh.getRange(2,H['TAHUN']+1,count,1).getValues();
  const opdCol = sh.getRange(2,H['NAMA SKPD']+1,count,1).getDisplayValues();
  const accountCol = sh.getRange(2,H['KODE REKENING']+1,count,1).getDisplayValues();
  const paguCol = sh.getRange(2,H['PAGU']+1,count,1).getValues();
  const years = {}, opds = {};
  for (let i=0;i<count;i++) {
    const rowYear=String(yearsCol[i][0]||'').trim(), opd=str_(opdCol[i][0]), kode=str_(accountCol[i][0]), pagu=num_(paguCol[i][0]);
    if (!rowYear || !opd || pagu<=0 || !isSipdProcurementAccount_(kode)) continue;
    years[rowYear]=true;
    if (year && rowYear !== year) continue;
    if (!opds[opd]) opds[opd]={name:opd,pagu:0,rows:0};
    opds[opd].pagu += pagu; opds[opd].rows++;
  }
  const data = {
    years:Object.keys(years).sort((a,b)=>Number(b)-Number(a)),
    opds:Object.keys(opds).sort((a,b)=>a.localeCompare(b)).map(k=>opds[k]),
    accountPrefixes:TRAX.SIPD_ACCOUNT_PREFIXES,
    sourceSpreadsheetId:TRAX.SIPD_SPREADSHEET_ID,
    sourceSheet:TRAX.SIPD_SHEET,
    sourceUpdatedAt:sipdSourceUpdatedAt_(stamp),
    loadedAt:nowIso_()
  };
  sipdCachePut_(cacheKey, data, 21600);
  return data;
}

function seedKomitmenAkses_() {
  const sh = sheet_('KOMITMEN_AKSES');
  const existing = {};
  rowsObject_('KOMITMEN_AKSES').forEach(r => existing[str_(r.opd)] = true);
  const meta = getSipdMeta_('');
  const chars='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  meta.opds.forEach(x => {
    if (existing[x.name]) return;
    let code=''; for(let i=0;i<8;i++) code += chars.charAt(Math.floor(Math.random()*chars.length));
    sh.appendRow([x.name,code,true,new Date()]); existing[x.name]=true;
  });
  clearRowsRuntime_('KOMITMEN_AKSES');
}

function validateOpdAccess_(opd, accessCode) {
  opd=str_(opd); accessCode=String(accessCode||'').trim().toUpperCase();
  if (!opd || !accessCode) throw new Error('Perangkat Daerah dan kode akses wajib diisi.');
  const row = rowsObject_('KOMITMEN_AKSES').find(r => str_(r.opd)===opd && truthy_(r.aktif));
  if (!row || String(row.kode_akses||'').trim().toUpperCase() !== accessCode) throw new Error('Kode akses OPD tidak sesuai.');
  return true;
}

function newKomitmenAccessCode_() {
  const chars='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const used={};
  rowsObject_('KOMITMEN_AKSES').forEach(r => used[String(r.kode_akses||'').trim().toUpperCase()]=true);
  let code='';
  do {
    code='';
    for(let i=0;i<8;i++) code += chars.charAt(Math.floor(Math.random()*chars.length));
  } while (used[code]);
  return code;
}

function getKomitmenAksesAdmin_() {
  return rowsObject_('KOMITMEN_AKSES')
    .map(r => ({
      opd:str_(r.opd),
      kodeAkses:String(r.kode_akses||'').trim().toUpperCase(),
      aktif:truthy_(r.aktif),
      updatedAt:dateTimeIso_(r.updated_at)
    }))
    .filter(r => r.opd)
    .sort((a,b) => a.opd.localeCompare(b.opd));
}

function resetKomitmenAksesAdmin_(body) {
  const opd=str_(body.opd);
  if (!opd) throw new Error('Perangkat Daerah belum dipilih.');
  const lock=LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const sh=sheet_('KOMITMEN_AKSES');
    if (sh.getLastRow() < 2) throw new Error('Data akses OPD belum tersedia.');
    const names=sh.getRange(2,1,sh.getLastRow()-1,1).getDisplayValues().flat().map(str_);
    const idx=names.indexOf(opd);
    if (idx < 0) throw new Error('Perangkat Daerah tidak ditemukan pada KOMITMEN_AKSES.');
    const rowNo=idx+2, code=newKomitmenAccessCode_(), now=new Date();
    sh.getRange(rowNo,2,1,3).setValues([[code,true,now]]);
    clearRowsRuntime_('KOMITMEN_AKSES');
    appendObject_('KOMITMEN_LOG',{id:id_('LOG'),tahun:'',opd:opd,aksi:'RESET_KODE_AKSES',pic:'ADMIN',keterangan:'Kode akses OPD diperbarui dari Admin TRAXPBJ.',created_at:now});
    return {opd:opd,kodeAkses:code,aktif:true,updatedAt:dateTimeIso_(now)};
  } finally {
    lock.releaseLock();
  }
}

function komitmenStatus_(year, opd) {
  const id = String(year)+'|'+str_(opd);
  const row = rowsObject_('KOMITMEN_STATUS').find(r=>str_(r.id)===id);
  return row ? {
    status:str_(row.status)||'DRAFT', pic:str_(row.pic), nip:str_(row.nip), whatsapp:str_(row.whatsapp), catatan:str_(row.catatan),
    submittedAt:dateTimeIso_(row.submitted_at), updatedAt:dateTimeIso_(row.updated_at)
  } : {status:'DRAFT',pic:'',nip:'',whatsapp:'',catatan:'',submittedAt:'',updatedAt:''};
}

function loadKomitmenWorkspace_(body) {
  const year=String(body.year||'').trim(), opd=str_(body.opd);
  validateOpdAccess_(opd, body.accessCode);
  const sourceRows=getSipdRowsForOpd_(year,opd,!!body.force);
  const saved=rowsObject_('KOMITMEN_PERENCANAAN').filter(r=>String(r.tahun)===year && str_(r.opd)===opd).map(r=>({
    sourceKey:str_(r.source_key), sourcePagu:num_(r.pagu_sipd), penyedia:num_(r.pagu_penyedia), swakelola:num_(r.pagu_swakelola), nonPengadaan:num_(r.pagu_non_pengadaan),
    jenis:str_(r.jenis_pengadaan), metode:str_(r.metode_pemilihan), dikecualikan:truthy_(r.dikecualikan), catatan:str_(r.catatan), status:str_(r.status), updatedAt:dateTimeIso_(r.updated_at)
  }));
  const total=sourceRows.reduce((s,r)=>s+r.pagu,0);
  const stamp=sipdSourceStamp_();
  return {year,opd,rows:sourceRows,saved,status:komitmenStatus_(year,opd),summary:{paguSipd:total,rowCount:sourceRows.length},sourceSheet:TRAX.SIPD_SHEET,sourceUpdatedAt:sipdSourceUpdatedAt_(stamp),loadedAt:nowIso_()};
}

function komitmenId_(year, opd, sourceKey) {
  const bytes=Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, String(year)+'|'+opd+'|'+sourceKey, Utilities.Charset.UTF_8);
  const hex=bytes.map(b=>(b<0?b+256:b).toString(16).padStart(2,'0')).join('').slice(0,24);
  return 'KOM-'+hex;
}

function saveKomitmen_(body) {
  const year=String(body.year||'').trim(), opd=str_(body.opd), pic=str_(body.pic), nip=str_(body.nip), whatsapp=str_(body.whatsapp), accessCode=body.accessCode;
  validateOpdAccess_(opd,accessCode);
  const incoming=Array.isArray(body.rows)?body.rows:[];
  if (!incoming.length) throw new Error('Tidak ada perubahan yang dikirim.');
  if (incoming.length>150) throw new Error('Terlalu banyak baris dalam satu penyimpanan. Maksimal 150 baris per proses.');
  const source=getSipdRowsForOpd_(year,opd), sourceMap={}; source.forEach(r=>sourceMap[r.sourceKey]=r);
  const now=new Date(), sh=sheet_('KOMITMEN_PERENCANAAN'), h=headers_(sh), idCol=h.indexOf('id'), createdCol=h.indexOf('created_at');
  const existingVals=sh.getLastRow()>=2?sh.getRange(2,1,sh.getLastRow()-1,h.length).getValues():[];
  const byId={}; existingVals.forEach((r,i)=>{const id=str_(r[idCol]);if(id)byId[id]=i;});
  const updateIdx=[], appendRows=[]; let savedCount=0;
  incoming.forEach(x=>{
    const key=str_(x.sourceKey), src=sourceMap[key];
    if(!src) throw new Error('Baris SIPD tidak ditemukan atau sudah berubah: '+key.slice(0,80));
    const penyedia=Math.max(0,num_(x.penyedia)), swakelola=Math.max(0,num_(x.swakelola)), nonPengadaan=Math.max(0,num_(x.nonPengadaan));
    const allocated=penyedia+swakelola+nonPengadaan;
    if (allocated>0 && Math.abs(allocated-src.pagu)>1) throw new Error('Pembagian pagu belum sama dengan pagu SIPD pada paket: '+(src.namaPaket||src.namaRekening));
    const id=komitmenId_(year,opd,key), oldIdx=Object.prototype.hasOwnProperty.call(byId,id)?byId[id]:-1;
    const createdAt=oldIdx>=0 && createdCol>=0 ? existingVals[oldIdx][createdCol] || now : now;
    const obj={
      id:id,tahun:year,opd:opd,source_key:key,kode_skpd:src.kodeSkpd,kode_sub_unit:src.kodeSubUnit,kode_sub_kegiatan:src.kodeSubKegiatan,nama_sub_kegiatan:src.namaSubKegiatan,
      kode_sumber_dana:src.kodeSumberDana,nama_sumber_dana:src.namaSumberDana,kode_rekening:src.kodeRekening,nama_rekening:src.namaRekening,paket_kelompok:src.paketKelompok,nama_paket:src.namaPaket,
      pagu_sipd:src.pagu,pagu_penyedia:penyedia,pagu_swakelola:swakelola,pagu_non_pengadaan:nonPengadaan,jenis_pengadaan:penyedia?str_(x.jenis):'',metode_pemilihan:penyedia?str_(x.metode):'',
      dikecualikan:penyedia?!!x.dikecualikan:false,catatan:str_(x.catatan),pic:pic,nip:nip,whatsapp:whatsapp,status:'DRAFT',created_at:createdAt,updated_at:now
    };
    const row=h.map(col=>Object.prototype.hasOwnProperty.call(obj,col)?obj[col]:'');
    if(oldIdx>=0){existingVals[oldIdx]=row;updateIdx.push(oldIdx);} else {appendRows.push(row);}
    savedCount++;
  });
  const sorted=[...new Set(updateIdx)].sort((a,b)=>a-b);
  for(let i=0;i<sorted.length;){let j=i+1;while(j<sorted.length&&sorted[j]===sorted[j-1]+1)j++;const first=sorted[i], block=sorted.slice(i,j).map(idx=>existingVals[idx]);sh.getRange(first+2,1,block.length,h.length).setValues(block);i=j;}
  if(appendRows.length)sh.getRange(sh.getLastRow()+1,1,appendRows.length,h.length).setValues(appendRows);
  clearRowsRuntime_('KOMITMEN_PERENCANAAN');
  upsert_('KOMITMEN_STATUS','id',year+'|'+opd,{id:year+'|'+opd,tahun:year,opd:opd,status:'DRAFT',pic:pic,nip:nip,whatsapp:whatsapp,catatan:str_(body.note),submitted_at:'',updated_at:now});
  appendObject_('KOMITMEN_LOG',{id:id_('LOG'),tahun:year,opd:opd,aksi:'SIMPAN_DRAFT',pic:pic,keterangan:savedCount+' baris diperbarui',created_at:now});
  return {saved:savedCount,status:'DRAFT',updatedAt:nowIso_()};
}

function submitKomitmen_(body) {
  const year=String(body.year||'').trim(), opd=str_(body.opd), pic=str_(body.pic), nip=str_(body.nip), whatsapp=str_(body.whatsapp);
  validateOpdAccess_(opd,body.accessCode);
  const source=getSipdRowsForOpd_(year,opd,true), savedRows=rowsObject_('KOMITMEN_PERENCANAAN').filter(r=>String(r.tahun)===year&&str_(r.opd)===opd), map={};
  savedRows.forEach(r=>map[str_(r.source_key)]=r);
  const incomplete=[];
  source.forEach(src=>{const r=map[src.sourceKey]; if(!r){incomplete.push(src);return;} const total=num_(r.pagu_penyedia)+num_(r.pagu_swakelola)+num_(r.pagu_non_pengadaan); if(Math.abs(total-src.pagu)>1) incomplete.push(src);});
  if(incomplete.length) throw new Error('Masih ada '+incomplete.length+' baris SIPD yang belum dipetakan penuh. Lengkapi sebelum mengajukan komitmen.');
  const now=new Date();
  upsert_('KOMITMEN_STATUS','id',year+'|'+opd,{id:year+'|'+opd,tahun:year,opd:opd,status:'DIAJUKAN',pic:pic,nip:nip,whatsapp:whatsapp,catatan:str_(body.note),submitted_at:now,updated_at:now});
  appendObject_('KOMITMEN_LOG',{id:id_('LOG'),tahun:year,opd:opd,aksi:'AJUKAN_KOMITMEN',pic:pic,keterangan:source.length+' baris SIPD telah dipetakan',created_at:now});
  return {status:'DIAJUKAN',submittedAt:nowIso_(),rows:source.length};
}

function setKomitmenStatus_(body) {
  const year=String(body.year||'').trim(), opd=str_(body.opd), status=str_(body.status).toUpperCase();
  if(!['DRAFT','DIAJUKAN','PERLU PERBAIKAN','FINAL'].includes(status)) throw new Error('Status komitmen tidak dikenal.');
  const old=komitmenStatus_(year,opd), now=new Date();
  upsert_('KOMITMEN_STATUS','id',year+'|'+opd,{id:year+'|'+opd,tahun:year,opd:opd,status:status,pic:str_(old.pic),nip:str_(old.nip),whatsapp:str_(old.whatsapp),catatan:str_(body.note||old.catatan),submitted_at:old.submittedAt||'',updated_at:now});
  appendObject_('KOMITMEN_LOG',{id:id_('LOG'),tahun:year,opd:opd,aksi:'STATUS_'+status,pic:'ADMIN PBJ',keterangan:str_(body.note),created_at:now});
  return {status:status,updatedAt:nowIso_()};
}

// ---------- AUTH ----------
function login_(password) {
  const expected = PropertiesService.getScriptProperties().getProperty('ADMIN_PASSWORD_HASH') || TRAX.DEFAULT_ADMIN_PASSWORD_HASH;
  const actual = sha256Hex_(String(password || ''));
  if (!constantTimeEqual_(actual, expected)) return { ok: false, error: 'Password tidak sesuai.' };

  const token = Utilities.getUuid().replace(/-/g, '') + Utilities.getUuid().replace(/-/g, '');
  CacheService.getScriptCache().put('admin:' + token, '1', TRAX.SESSION_TTL);
  return { ok: true, token: token, expiresIn: TRAX.SESSION_TTL };
}

function logout_(token) {
  if (token) CacheService.getScriptCache().remove('admin:' + token);
  return { ok: true };
}

function requireAdmin_(token) {
  if (!token || CacheService.getScriptCache().get('admin:' + token) !== '1') {
    throw new Error('Sesi admin berakhir. Silakan login kembali.');
  }
}

function sha256Hex_(text) {
  const bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, text, Utilities.Charset.UTF_8);
  return bytes.map(b => (b < 0 ? b + 256 : b).toString(16).padStart(2, '0')).join('');
}

function constantTimeEqual_(a, b) {
  a = String(a || ''); b = String(b || '');
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

// ---------- PUBLIC READ ----------
function getPimpinan_() {
  return rowsObject_('PIMPINAN')
    .filter(r => truthy_(r.aktif))
    .sort(sortUrutan_)
    .map(r => ({
      id: str_(r.id), key: str_(r.kelompok), kelompok: str_(r.kelompok), nama: str_(r.nama), jabatan: str_(r.jabatan),
      foto: publicFileUrl_(r.file_id), fileId: str_(r.file_id), urutan: num_(r.urutan)
    }));
}

function getTim_() {
  return rowsObject_('TIM_PBJ')
    .filter(r => truthy_(r.aktif))
    .sort(sortUrutan_)
    .map(r => ({ id: str_(r.id), nama: str_(r.nama), jabatan: str_(r.jabatan), kelompok: str_(r.kelompok), foto: publicFileUrl_(r.file_id), fileId: str_(r.file_id), urutan: num_(r.urutan) }));
}


function getDokumentasi_(id) {
  repairDokumentasiMediaSheet_(ss_());
  const docs = rowsObject_('DOKUMENTASI')
    .filter(r => truthy_(r.tampil))
    .sort((a,b) => String(b.tanggal || '').localeCompare(String(a.tanggal || '')) || sortUrutan_(a,b))
    .map(r => ({
      id: str_(r.id_kegiatan), tanggal: dateIso_(r.tanggal), judul: str_(r.judul), lokasi: str_(r.lokasi), kategori: str_(r.kategori), deskripsi: str_(r.deskripsi),
      cover: publicFileUrl_(r.cover_file_id), coverFileId: str_(r.cover_file_id), folderId: str_(r.folder_id), urutan: num_(r.urutan), instagram: splitInstagramUrls_(r.instagram_urls)
    }));

  const mediaRows = rowsObject_('DOKUMENTASI_FOTO');
  docs.forEach(d => {
    const media = mediaRows
      .filter(r => str_(r.id_kegiatan) === d.id)
      .sort(sortUrutan_)
      .map(r => {
        const fileId = str_(r.file_id);
        const mime = str_(r.mime_type);
        const mediaType = str_(r.media_type) || (mime.indexOf('video/') === 0 ? 'video' : 'image');
        return {
          id: str_(r.id_foto),
          fileId: fileId,
          url: mediaType === 'video' ? drivePreviewUrl_(fileId) : (str_(r.file_url) || publicFileUrl_(fileId)),
          imageUrl: publicFileUrl_(fileId),
          embedUrl: drivePreviewUrl_(fileId),
          caption: str_(r.caption),
          urutan: num_(r.urutan),
          type: mediaType,
          mimeType: mime || (mediaType === 'video' ? 'video/mp4' : 'image/jpeg'),
          name: str_(r.nama_file),
          uploadKey: str_(r.upload_key)
        };
      });

    // Kompatibilitas data V21: cover lama disimpan di DOKUMENTASI,
    // sementara foto berikutnya ada di DOKUMENTASI_FOTO.
    if (d.coverFileId && !media.some(m => m.fileId === d.coverFileId)) {
      media.unshift({
        id: 'COVER-' + d.id,
        fileId: d.coverFileId,
        url: d.cover || publicFileUrl_(d.coverFileId),
        imageUrl: d.cover || publicFileUrl_(d.coverFileId),
        embedUrl: drivePreviewUrl_(d.coverFileId),
        caption: d.judul,
        urutan: 0,
        type: 'image',
        mimeType: 'image/jpeg',
        name: 'cover',
        uploadKey: ''
      });
    }

    d.media = media;
    d.foto = media.filter(m => m.type === 'image').map(m => ({
      id: m.id, url: m.imageUrl || m.url, fileId: m.fileId, caption: m.caption, urutan: m.urutan
    }));
    d.mediaCount = media.length;
  });
  return id ? (docs.find(d => d.id === String(id)) || null) : docs;
}

function getPengetahuan_() {
  return rowsObject_('PUSAT_PENGETAHUAN')
    .filter(r => truthy_(r.tampil))
    .sort(sortUrutan_)
    .map(r => ({ id: str_(r.id), kategori: str_(r.kategori), judul: str_(r.judul), deskripsi: str_(r.deskripsi), tanggal: dateIso_(r.tanggal), namaFile: str_(r.nama_file), fileId: str_(r.file_id), url: str_(r.file_url) || driveViewUrl_(r.file_id), urutan: num_(r.urutan) }));
}

function getEdukasi_() {
  return rowsObject_('EDUKASI_KEGIATAN')
    .filter(r => truthy_(r.tampil))
    .sort((a,b) => String(b.tanggal || '').localeCompare(String(a.tanggal || '')) || sortUrutan_(a,b))
    .map(r => ({
      id: str_(r.id), tanggal: dateIso_(r.tanggal), kegiatan: str_(r.kegiatan), jenis: str_(r.jenis), tempat: str_(r.tempat),
      keterangan: str_(r.keterangan), link: str_(r.link), status: str_(r.status), urutan: num_(r.urutan),
      fileId: str_(r.file_id), fileUrl: str_(r.file_url) || driveViewUrl_(r.file_id), namaFile: str_(r.nama_file), mimeType: str_(r.mime_type)
    }));
}

function ensureSuratPBJSheet_() {
  return ensureSheet_(ss_(), 'SURAT_PBJ', TRAX.SHEETS.SURAT_PBJ);
}

function getSuratPBJ_(includeHidden) {
  ensureSuratPBJSheet_();
  return rowsObject_('SURAT_PBJ')
    .filter(r => includeHidden || truthy_(r.tampil))
    .sort((a,b) => {
      const da = dateIso_(a.tanggal), db = dateIso_(b.tanggal);
      if (da !== db) return String(db || '').localeCompare(String(da || ''));
      return String(dateTimeIso_(b.modified_at) || '').localeCompare(String(dateTimeIso_(a.modified_at) || ''));
    })
    .map(r => ({
      id: str_(r.id),
      tanggal: dateIso_(r.tanggal),
      nomorSurat: str_(r.nomor_surat),
      perihal: str_(r.perihal),
      judul: str_(r.perihal) || fileStem_(r.nama_file),
      jenis: str_(r.jenis),
      fileId: str_(r.file_id),
      url: str_(r.file_url) || driveViewUrl_(r.file_id),
      namaFile: str_(r.nama_file),
      mimeType: str_(r.mime_type),
      modifiedAt: dateTimeIso_(r.modified_at),
      tampil: truthy_(r.tampil),
      updatedAt: dateTimeIso_(r.updated_at)
    }));
}

function getDokumentasiHub_() {
  return {
    dokumentasi: getDokumentasi_(''),
    agenda: getEdukasi_(),
    surat: getSuratPBJ_(false),
    generatedAt: nowIso_()
  };
}

function getEvaluasi_(tahun) {
  const rows = rowsObject_('EVALUASI_LAYANAN');
  const summary = rowsObject_('EVALUASI_RINGKASAN');
  const years = {};

  rows.forEach(r => {
    const y = String(r.tahun || '');
    if (!y || (tahun && y !== String(tahun))) return;
    if (!years[y]) years[y] = { year: Number(y), parameters: [] };
    years[y].parameters.push({
      no: num_(r.parameter_no), name: str_(r.parameter),
      counts: [num_(r.tidak_memuaskan), num_(r.kurang_memuaskan), num_(r.memuaskan), num_(r.sangat_memuaskan)],
      total: num_(r.total), average: num_(r.nilai_rata2)
    });
  });

  summary.forEach(r => {
    const y = String(r.tahun || '');
    if (!y || (tahun && y !== String(tahun))) return;
    if (!years[y]) years[y] = { year: Number(y), parameters: [] };
    years[y].respondents = num_(r.responden);
    years[y].ikm = nullableNum_(r.ikm);
    years[y].updatedAt = dateTimeIso_(r.tanggal_update);
    years[y].sourceFileId = str_(r.source_file_id);
    years[y].sourceFile = str_(r.source_file_name);
  });

  Object.keys(years).forEach(y => years[y].parameters.sort((a,b) => a.no - b.no));
  return tahun ? (years[String(tahun)] || null) : { currentYear: 2026, years: years };
}

function getConfig_() {
  const out = {};
  rowsObject_('CONFIG').forEach(r => { if (r.key) out[String(r.key)] = r.value; });
  return out;
}

// ---------- ADMIN WRITE ----------
function savePimpinan_(body) {
  const data = body.data || {};
  const key = normalizeLeaderKey_(data.kelompok || data.key || data.id);
  if (!key) throw new Error('Kelompok pimpinan tidak dikenal.');

  const id = leaderId_(key);
  const old = findRowBy_('PIMPINAN', 'id', id) || {};
  let fileId = str_(old.file_id);
  if (body.file && body.file.base64) {
    fileId = saveUploadedFile_(TRAX.FOLDERS.PIMPINAN, body.file, 'pimpinan-' + key, fileId);
  }

  const jabatanMap = {
    kabag: 'Kepala Bagian Pengadaan Barang dan Jasa',
    lpse: 'Ketua Kelompok LPSE',
    advokasi: 'Ketua Kelompok Pembinaan dan Advokasi',
    pengelolaan: 'Ketua Kelompok Pengelolaan PBJ'
  };

  upsert_('PIMPINAN', 'id', id, {
    id: id, kelompok: key, nama: str_(data.nama), jabatan: str_(data.jabatan) || jabatanMap[key], file_id: fileId,
    file_url: publicFileUrl_(fileId), urutan: num_(data.urutan) || leaderOrder_(key), aktif: data.aktif === false ? false : true, updated_at: new Date()
  });
  return getPimpinan_();
}

function savePimpinanBatch_(body) {
  const items = Array.isArray(body.items) ? body.items : [];
  if (!items.length) throw new Error('Data pimpinan belum dikirim.');
  items.forEach(item => savePimpinan_(item || {}));
  return getPimpinan_();
}

function saveTim_(body) {
  const data = body.data || {};
  const id = str_(data.id) || id_('TIM');
  const old = findRowBy_('TIM_PBJ', 'id', id) || {};
  let fileId = str_(old.file_id);
  if (body.file && body.file.base64) fileId = saveUploadedFile_(TRAX.FOLDERS.TIM, body.file, 'tim-' + id, fileId);

  upsert_('TIM_PBJ', 'id', id, {
    id: id, nama: str_(data.nama), jabatan: str_(data.jabatan), kelompok: str_(data.kelompok), file_id: fileId,
    file_url: publicFileUrl_(fileId), urutan: num_(data.urutan) || nextOrder_('TIM_PBJ'), aktif: data.aktif === false ? false : true, updated_at: new Date()
  });
  return getTim_();
}

function saveTimBatch_(body) {
  const items = Array.isArray(body.items) ? body.items : [];
  if (!items.length) throw new Error('Data pegawai belum dikirim.');
  const saved = [];
  items.forEach(item => {
    const d = item || {};
    const result = saveTim_(d);
    saved.push(result);
  });
  return getTim_();
}

function deleteTim_(id) {
  deleteRowBy_('TIM_PBJ', 'id', id, true);
  return getTim_();
}


function saveDokumentasi_(body) {
  const data = body.data || {};
  const id = str_(data.id || data.id_kegiatan) || id_('DOK');
  const old = findRowBy_('DOKUMENTASI', 'id_kegiatan', id) || {};
  let folderId = str_(old.folder_id);
  if (!folderId) {
    const parent = childFolderByName_(TRAX.FOLDERS.DOKUMENTASI);
    folderId = parent.createFolder(safeFolderName_((data.tanggal || '') + '_' + (data.judul || id))).getId();
  }

  let coverId = str_(old.cover_file_id);
  upsert_('DOKUMENTASI', 'id_kegiatan', id, {
    id_kegiatan: id, tanggal: str_(data.tanggal), judul: str_(data.judul), lokasi: str_(data.lokasi), kategori: str_(data.kategori) || 'Pendampingan', deskripsi: str_(data.deskripsi),
    cover_file_id: coverId, cover_url: publicFileUrl_(coverId), folder_id: folderId, urutan: num_(data.urutan) || num_(old.urutan) || nextOrder_('DOKUMENTASI'), tampil: data.tampil === false ? false : true, instagram_urls: normalizeInstagramUrls_(data.instagramUrls || data.instagram_urls || data.instagram || old.instagram_urls), updated_at: new Date()
  });

  // Kompatibilitas klien lama. V22 mengunggah media satu per satu agar request tidak terlalu besar.
  if (body.cover && body.cover.base64) {
    uploadDokumentasiMedia_({ id: id, file: body.cover, caption: data.judul || '', isCover: true, uploadKey: 'legacy-cover-' + id });
  }
  const photos = Array.isArray(body.photos) ? body.photos : [];
  photos.forEach((file, index) => {
    if (!file || !file.base64) return;
    uploadDokumentasiMedia_({ id: id, file: file, caption: file.caption || file.name || '', isCover: false, uploadKey: 'legacy-photo-' + id + '-' + index });
  });

  return getDokumentasi_(id);
}

function uploadDokumentasiMedia_(body) {
  const id = str_(body.id || body.id_kegiatan);
  if (!id) throw new Error('ID kegiatan tidak ditemukan.');
  const file = body.file || {};
  if (!file.base64) throw new Error('File dokumentasi belum dikirim.');

  const doc = findRowBy_('DOKUMENTASI', 'id_kegiatan', id);
  if (!doc) throw new Error('Kegiatan dokumentasi tidak ditemukan.');

  const uploadKey = str_(body.uploadKey || body.upload_key);
  if (uploadKey) {
    const existing = rowsObject_('DOKUMENTASI_FOTO').find(r => str_(r.id_kegiatan) === id && str_(r.upload_key) === uploadKey);
    if (existing) return getDokumentasi_(id);
  }

  const folderId = str_(doc.folder_id);
  if (!folderId) throw new Error('Folder dokumentasi belum tersedia.');

  let mime = str_(file.mimeType || file.type);
  if (!mime) {
    const ext = extension_(file.name || '');
    if (ext === 'mp4') mime = 'video/mp4';
    else if (ext === 'webm') mime = 'video/webm';
    else if (ext === 'mov') mime = 'video/quicktime';
    else if (['jpg','jpeg','png','webp','gif'].indexOf(ext) >= 0) mime = 'image/' + (ext === 'jpg' ? 'jpeg' : ext);
    else mime = 'application/octet-stream';
  }
  const mediaType = mime.indexOf('video/') === 0 ? 'video' : (mime.indexOf('image/') === 0 ? 'image' : '');
  if (!mediaType) throw new Error('Dokumentasi hanya menerima foto atau video.');

  const order = nextPhotoOrder_(id);
  const fileId = saveUploadedFileToFolderId_(folderId, file, 'media-' + id + '-' + order, '');
  const row = {
    id_foto: id_('MEDIA'),
    id_kegiatan: id,
    file_id: fileId,
    file_url: mediaType === 'video' ? drivePreviewUrl_(fileId) : publicFileUrl_(fileId),
    caption: str_(body.caption || file.caption || file.name || ''),
    urutan: order,
    updated_at: new Date(),
    media_type: mediaType,
    mime_type: mime,
    nama_file: str_(file.name),
    upload_key: uploadKey
  };
  appendObject_('DOKUMENTASI_FOTO', row);

  const shouldCover = truthy_(body.isCover) || !str_(doc.cover_file_id);
  if (shouldCover) {
    upsert_('DOKUMENTASI', 'id_kegiatan', id, {
      id_kegiatan: id,
      tanggal: doc.tanggal,
      judul: doc.judul,
      lokasi: doc.lokasi,
      kategori: doc.kategori,
      deskripsi: doc.deskripsi,
      cover_file_id: fileId,
      cover_url: publicFileUrl_(fileId),
      folder_id: folderId,
      urutan: num_(doc.urutan) || 1,
      tampil: truthy_(doc.tampil),
      instagram_urls: str_(doc.instagram_urls),
      updated_at: new Date()
    });
  }
  return getDokumentasi_(id);
}

function deleteDokumentasiMedia_(body) {
  const id = str_(body.id || body.id_foto);
  if (!id) throw new Error('ID media tidak ditemukan.');
  const rows = rowsObject_('DOKUMENTASI_FOTO');
  const row = rows.find(r => str_(r.id_foto) === id);
  if (!row) return false;
  const fileId = str_(row.file_id);
  if (fileId) try { DriveApp.getFileById(fileId).setTrashed(true); } catch (_) {}
  deleteRowBy_('DOKUMENTASI_FOTO', 'id_foto', id, false);
  return getDokumentasi_(str_(row.id_kegiatan));
}

function deleteDokumentasi_(id) {
  const row = findRowBy_('DOKUMENTASI', 'id_kegiatan', id);
  if (row && row.folder_id) try { DriveApp.getFolderById(String(row.folder_id)).setTrashed(true); } catch (_) {}
  deleteRowsWhere_('DOKUMENTASI_FOTO', r => str_(r.id_kegiatan) === String(id));
  deleteRowBy_('DOKUMENTASI', 'id_kegiatan', id, false);
  return getDokumentasi_('');
}

function savePengetahuan_(body) {
  const data = body.data || {};
  const id = str_(data.id) || id_('DOC');
  const old = findRowBy_('PUSAT_PENGETAHUAN', 'id', id) || {};
  let fileId = str_(old.file_id);
  let fileName = str_(old.nama_file);
  if (body.file && body.file.base64) {
    fileId = saveUploadedFile_(TRAX.FOLDERS.PENGETAHUAN, body.file, 'dokumen-' + id, fileId);
    fileName = str_(body.file.name);
  }
  upsert_('PUSAT_PENGETAHUAN', 'id', id, {
    id: id, kategori: str_(data.kategori) || 'Panduan', judul: str_(data.judul), deskripsi: str_(data.deskripsi), tanggal: str_(data.tanggal),
    file_id: fileId, file_url: driveViewUrl_(fileId), nama_file: fileName, urutan: num_(data.urutan) || nextOrder_('PUSAT_PENGETAHUAN'), tampil: data.tampil === false ? false : true, updated_at: new Date()
  });
  return getPengetahuan_();
}

function savePengetahuanBatch_(body) {
  const items = Array.isArray(body.items) ? body.items : [];
  if (!items.length) throw new Error('Dokumen belum dipilih.');
  items.forEach(item => savePengetahuan_(item || {}));
  return getPengetahuan_();
}

function deletePengetahuan_(id) {
  deleteRowBy_('PUSAT_PENGETAHUAN', 'id', id, true);
  return getPengetahuan_();
}

function saveEdukasi_(body) {
  const d = body.data || {};
  const id = str_(d.id) || id_('EVT');
  const old = findRowBy_('EDUKASI_KEGIATAN', 'id', id) || {};
  let fileId = str_(old.file_id), fileName = str_(old.nama_file), mimeType = str_(old.mime_type);

  if (body.file && body.file.base64) {
    const title = str_(d.kegiatan || d.title) || id;
    const date = str_(d.tanggal) || 'tanpa-tanggal';
    fileId = saveUploadedFileToFolderId_(TRAX.EDUKASI_FOLDER_ID, body.file, 'kegiatan-' + date + '-' + title, fileId);
    const saved = DriveApp.getFileById(fileId);
    fileName = saved.getName();
    mimeType = saved.getMimeType();
  }

  upsert_('EDUKASI_KEGIATAN', 'id', id, {
    id: id, tanggal: str_(d.tanggal), kegiatan: str_(d.kegiatan || d.title), jenis: str_(d.jenis || d.type), tempat: str_(d.tempat || d.place),
    keterangan: str_(d.keterangan || d.summary), link: str_(d.link || d.materialUrl), status: str_(d.status), urutan: num_(d.urutan) || num_(old.urutan) || nextOrder_('EDUKASI_KEGIATAN'),
    tampil: d.tampil === false ? false : true, updated_at: new Date(), file_id: fileId, file_url: driveViewUrl_(fileId), nama_file: fileName, mime_type: mimeType
  });
  return getEdukasi_();
}

function deleteEdukasi_(id) {
  deleteRowBy_('EDUKASI_KEGIATAN', 'id', id, true);
  return getEdukasi_();
}

// ---------- SURAT PBJ / DRIVE SYNC ----------
function saveSuratPBJ_(body) {
  ensureSuratPBJSheet_();
  const d = body.data || {};
  const upload = body.file || null;
  const id = str_(d.id);
  const fileId = str_(d.fileId || d.file_id);
  let old = id ? findRowBy_('SURAT_PBJ', 'id', id) : null;
  if (!old && fileId) old = findRowBy_('SURAT_PBJ', 'file_id', fileId);

  if (!old && upload) {
    const baseName = str_(d.perihal) || fileStem_(upload.name || 'surat-pbj');
    const newFileId = saveUploadedFileToFolderId_(TRAX.SURAT_PBJ_FOLDER_ID, upload, baseName);
    const saved = DriveApp.getFileById(newFileId);
    old = {
      id: id || ('SURAT-' + sha256Hex_(newFileId).slice(0, 16)),
      file_id: newFileId,
      file_url: driveViewUrl_(newFileId),
      nama_file: saved.getName(),
      mime_type: saved.getMimeType(),
      modified_at: saved.getLastUpdated(),
      tampil: true
    };
  } else if (old && upload) {
    const baseName = str_(d.perihal) || fileStem_(upload.name || old.nama_file || 'surat-pbj');
    const newFileId = saveUploadedFileToFolderId_(TRAX.SURAT_PBJ_FOLDER_ID, upload, baseName, str_(old.file_id));
    const saved = DriveApp.getFileById(newFileId);
    old.file_id = newFileId;
    old.file_url = driveViewUrl_(newFileId);
    old.nama_file = saved.getName();
    old.mime_type = saved.getMimeType();
    old.modified_at = saved.getLastUpdated();
  }

  if (!old) throw new Error('Data surat belum ditemukan. Jalankan sinkronisasi Drive terlebih dahulu atau upload file surat manual.');

  upsert_('SURAT_PBJ', 'id', str_(old.id), {
    id: str_(old.id),
    tanggal: str_(d.tanggal),
    nomor_surat: str_(d.nomorSurat || d.nomor_surat),
    perihal: str_(d.perihal) || fileStem_(old.nama_file),
    jenis: str_(d.jenis),
    file_id: str_(old.file_id),
    file_url: str_(old.file_url) || driveViewUrl_(old.file_id),
    nama_file: str_(old.nama_file),
    mime_type: str_(old.mime_type),
    modified_at: old.modified_at,
    tampil: Object.prototype.hasOwnProperty.call(d, 'tampil') ? d.tampil !== false : (String(old.tampil) === '' ? true : truthy_(old.tampil)),
    updated_at: new Date()
  });
  return getSuratPBJ_(true);
}

function syncSuratPBJ_(body) {
  body = body || {};
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const sh = ensureSuratPBJSheet_();
    const h = headers_(sh);
    const recursive = body.recursive === false ? false : true;
    const requestedMax = Math.round(num_(body.maxFiles || body.max_files || 1500));
    const maxFiles = Math.max(1, Math.min(requestedMax || 1500, 5000));
    const files = listDriveFiles_(TRAX.SURAT_PBJ_FOLDER_ID, recursive, maxFiles);

    const existing = rowsObject_('SURAT_PBJ');
    const byFileId = {};
    existing.forEach((r, i) => {
      const fid = str_(r.file_id);
      if (fid) byFileId[fid] = { row: r, index: i };
    });

    const rows = existing.map(r => h.map(col => Object.prototype.hasOwnProperty.call(r, col) ? r[col] : ''));
    const now = new Date();
    let created = 0, updated = 0, unchanged = 0;

    files.forEach(file => {
      const fid = file.getId();
      const current = byFileId[fid];
      const old = current ? current.row : {};
      const name = file.getName();
      const mime = file.getMimeType();
      const modified = file.getLastUpdated();
      const url = driveViewUrl_(fid);
      const oldModified = old.modified_at ? new Date(old.modified_at).getTime() : 0;
      const changed = !current || str_(old.nama_file) !== name || str_(old.mime_type) !== mime || str_(old.file_url) !== url || oldModified !== modified.getTime();

      const obj = {
        id: current ? str_(old.id) : ('SURAT-' + sha256Hex_(fid).slice(0, 16)),
        tanggal: current ? old.tanggal : '',
        nomor_surat: current ? old.nomor_surat : '',
        perihal: current ? old.perihal : fileStem_(name),
        jenis: current ? old.jenis : '',
        file_id: fid,
        file_url: url,
        nama_file: name,
        mime_type: mime,
        modified_at: modified,
        tampil: current ? (String(old.tampil) === '' ? true : truthy_(old.tampil)) : true,
        updated_at: changed ? now : (old.updated_at || now)
      };
      const row = h.map(col => Object.prototype.hasOwnProperty.call(obj, col) ? obj[col] : '');

      if (current) {
        rows[current.index] = row;
        if (changed) updated++; else unchanged++;
      } else {
        rows.push(row);
        byFileId[fid] = { row: obj, index: rows.length - 1 };
        created++;
      }
    });

    if (rows.length) {
      sh.getRange(2, 1, rows.length, h.length).setValues(rows);
    }
    clearRowsRuntime_('SURAT_PBJ');

    return {
      scanned: files.length,
      created: created,
      updated: updated,
      unchanged: unchanged,
      truncated: files.length >= maxFiles,
      folderId: TRAX.SURAT_PBJ_FOLDER_ID,
      changed: created + updated > 0,
      data: getSuratPBJ_(true)
    };
  } finally {
    lock.releaseLock();
  }
}

/** Jalankan sekali bila ingin sinkronisasi folder surat otomatis setiap 5 menit. */
function setupSuratPBJSync() {
  ScriptApp.getProjectTriggers().forEach(t => {
    if (t.getHandlerFunction() === 'syncSuratPBJScheduled_') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('syncSuratPBJScheduled_').timeBased().everyMinutes(5).create();
  const result = syncSuratPBJ_({ recursive: true, maxFiles: 1500 });
  if (result.changed) touchContent_();
  Logger.log('Sinkronisasi SURAT_PBJ aktif setiap 5 menit. File terbaca: ' + result.scanned);
  return result;
}

function syncSuratPBJScheduled_() {
  const result = syncSuratPBJ_({ recursive: true, maxFiles: 1500 });
  if (result.changed) touchContent_();
  return result;
}

/**
 * Upload XLSX 2026, arsipkan file asli, konversi sementara menjadi Google Sheet,
 * baca sheet "Evaluasi Layanan", lalu simpan rekap ke database.
 * Memerlukan Advanced Drive Service v3 (sudah dicantumkan di appsscript.json).
 */
function importEvaluasiXlsx_(body) {
  if (!body.file || !body.file.base64) throw new Error('File XLSX belum dikirim.');
  const file = body.file;
  if (!/\.xlsx?$/i.test(file.name || '')) throw new Error('File harus XLSX/XLS.');

  const archiveFolder = childFolderByName_(TRAX.FOLDERS.EVALUASI);
  const archiveBlob = base64Blob_(file);
  const archiveFile = archiveFolder.createFile(archiveBlob).setName(file.name || ('Evaluasi-2026-' + Date.now() + '.xlsx'));

  let tempId = '';
  try {
    const temp = Drive.Files.create({
      name: 'TMP_TRAXPBJ_EVALUASI_' + Date.now(),
      mimeType: 'application/vnd.google-apps.spreadsheet'
    }, archiveBlob, { fields: 'id' });
    tempId = temp.id;

    const tempSS = SpreadsheetApp.openById(tempId);
    const sh = tempSS.getSheetByName('Evaluasi Layanan') || tempSS.getSheets()[0];
    const rows = sh.getDataRange().getValues();
    const parsed = parseEvaluationRows_(rows, file.name || '');
    if (Number(parsed.year) !== 2026) throw new Error('Import admin hanya untuk evaluasi tahun 2026.');

    parsed.sourceFileId = archiveFile.getId();
    parsed.sourceFile = archiveFile.getName();
    saveEvaluationParsed_(parsed);
    return getEvaluasi_('2026');
  } finally {
    if (tempId) try { DriveApp.getFileById(tempId).setTrashed(true); } catch (_) {}
  }
}

/** Fallback bila parsing XLSX dilakukan di browser, backend tetap jadi sumber penyimpanan. */
function saveEvaluasiRekap_(body) {
  const data = body.data || {};
  if (Number(data.year) !== 2026) throw new Error('Menu admin hanya mengubah evaluasi 2026.');
  saveEvaluationParsed_(data);
  return getEvaluasi_('2026');
}

function saveEvaluationParsed_(data) {
  const year = 2026;
  const params = Array.isArray(data.parameters) ? data.parameters : [];
  if (!params.length) throw new Error('Parameter evaluasi tidak ditemukan.');

  deleteRowsWhere_('EVALUASI_LAYANAN', r => Number(r.tahun) === year);
  deleteRowsWhere_('EVALUASI_RINGKASAN', r => Number(r.tahun) === year);

  const sh = sheet_('EVALUASI_LAYANAN');
  params.forEach((p, i) => {
    const counts = Array.isArray(p.counts) ? p.counts.map(num_) : [0,0,0,0];
    while (counts.length < 4) counts.push(0);
    const total = counts.slice(0,4).reduce((a,b) => a + b, 0);
    const weighted = counts.slice(0,4).reduce((s,v,j) => s + v * (j + 1), 0);
    const avg = total ? weighted / total : 0;
    sh.appendRow([year, num_(p.no) || i + 1, str_(p.name || p.parameter), counts[0], counts[1], counts[2], counts[3], total, avg, new Date()]);
    clearRowsRuntime_('EVALUASI_LAYANAN');
  });

  const respondentCandidates = params.map(p => (Array.isArray(p.counts) ? p.counts : []).reduce((a,b) => a + num_(b), 0));
  const respondents = num_(data.respondents) || Math.max.apply(null, respondentCandidates.concat([0]));
  const ikm = nullableNum_(data.ikm);
  sheet_('EVALUASI_RINGKASAN').appendRow([year, respondents, ikm === null ? '' : ikm, new Date(), str_(data.sourceFileId), str_(data.sourceFile)]);
  clearRowsRuntime_('EVALUASI_RINGKASAN');
}

function parseEvaluationRows_(rows, fileName) {
  rows = Array.isArray(rows) ? rows : [];
  const title = str_((rows[0] || [])[0]) || 'Evaluasi Pengguna Layanan';
  const headerIndex = rows.findIndex(row => str_((row || [])[1]).toLowerCase() === 'parameter penilaian');
  const params = [];
  const firstDataRow = headerIndex >= 0 ? headerIndex + 1 : 10;

  for (let r = firstDataRow; r < rows.length && params.length < 14; r++) {
    const numberCell = str_((rows[r] || [])[0]);
    const name = str_((rows[r] || [])[1]);
    if (/^total$/i.test(numberCell) || /^total$/i.test(name)) break;
    if (!name) continue;
    const counts = [2,3,4,5].map(c => Math.max(0, Math.round(num_((rows[r] || [])[c]))));
    params.push({ no: params.length + 1, name: name, counts: counts });
  }

  const hasVotes = params.some(p => p.counts.some(v => v > 0));
  if (!hasVotes) {
    const rawHeaderIndex = rows.findIndex(row => str_((row || [])[0]).toLowerCase() === 'no' && str_((row || [])[2]));
    if (rawHeaderIndex >= 0) {
      const rawNames = (rows[rawHeaderIndex] || []).slice(2,16).map(str_);
      const rawCounts = rawNames.map(() => [0,0,0,0]);
      const end = Math.min(rows.length, rawHeaderIndex + 1000);
      for (let r = rawHeaderIndex + 1; r < end; r++) {
        const first = str_((rows[r] || [])[0]);
        if (/nilai\/unsur|∑/i.test(first)) break;
        for (let c = 2; c < 16; c++) {
          const score = Math.round(num_((rows[r] || [])[c]));
          if (score >= 1 && score <= 4) rawCounts[c - 2][score - 1]++;
        }
      }
      rawCounts.forEach((counts, i) => {
        if (!rawNames[i]) return;
        const target = params.find(p => p.name.toLowerCase() === rawNames[i].toLowerCase());
        if (target) target.counts = counts;
        else if (params.length < 14) params.push({ no: params.length + 1, name: rawNames[i], counts: counts });
      });
    }
  }

  const categoryTotals = [0,0,0,0];
  params.forEach(p => p.counts.forEach((v,i) => categoryTotals[i] += num_(v)));
  const votes = categoryTotals.reduce((a,b) => a+b,0);
  const weighted = categoryTotals.reduce((s,v,i) => s + v * (i+1),0);
  const respondents = Math.max.apply(null, params.map(p => p.counts.reduce((a,b)=>a+b,0)).concat([0]));
  const yearMatch = (title.match(/20\d{2}/) || String(fileName || '').match(/20\d{2}/) || ['2026'])[0];

  return {
    year: Number(yearMatch),
    title: title,
    respondents: respondents,
    ikm: votes ? weighted / votes : null,
    categoryTotals: categoryTotals,
    parameters: params,
    sourceFile: fileName,
    updatedAt: nowIso_()
  };
}


function canonicalInstagramUrl_(raw) {
  const text = String(raw || '').trim();
  const match = text.match(/https?:\/\/(?:www\.)?instagram\.com\/[^\s<>'"]+/i);
  if (!match) return '';
  const clean = match[0].split('?')[0].replace(/\/+$/, '');
  const path = clean.replace(/^https?:\/\/(?:www\.)?instagram\.com\//i, '').split('/').filter(Boolean);
  let type = '', code = '';
  if (/^(p|reel|reels|tv)$/i.test(path[0] || '') && path[1]) { type = String(path[0]).toLowerCase(); code = path[1]; }
  else if (String(path[0]).toLowerCase() === 'share' && /^(p|reel|reels|tv)$/i.test(path[1] || '') && path[2]) { type = String(path[1]).toLowerCase(); code = path[2]; }
  if (!type || !code) return '';
  if (type === 'reels') type = 'reel';
  return 'https://www.instagram.com/' + type + '/' + code + '/';
}
function splitInstagramUrls_(value) {
  return String(value || '').split(/[\n,]+/).map(canonicalInstagramUrl_).filter(Boolean).filter((v,i,a)=>a.indexOf(v)===i);
}

function normalizeInstagramUrls_(value) {
  const list = Array.isArray(value) ? value : String(value || '').split(/[\n,]+/);
  const out = [];
  list.forEach(raw => { const clean = canonicalInstagramUrl_(raw); if (clean && out.indexOf(clean) < 0) out.push(clean); });
  return out.join('\n');
}

// ---------- SETUP HELPERS ----------
function ensureSheet_(ss, name, expectedHeaders) {
  let sh = ss.getSheetByName(name);
  if (!sh) sh = ss.insertSheet(name);

  const lastCol = Math.max(sh.getLastColumn(), 1);
  const existing = sh.getRange(1,1,1,lastCol).getDisplayValues()[0].map(v => String(v || '').trim());
  const hasAny = existing.some(Boolean);
  if (!hasAny) {
    sh.getRange(1,1,1,expectedHeaders.length).setValues([expectedHeaders]);
  } else {
    const missing = expectedHeaders.filter(h => !existing.includes(h));
    if (missing.length) sh.getRange(1, sh.getLastColumn()+1, 1, missing.length).setValues([missing]);
  }
  sh.setFrozenRows(1);
  if (sh.getLastColumn()) {
    sh.getRange(1,1,1,sh.getLastColumn()).setFontWeight('bold').setBackground('#0b2940').setFontColor('#ffffff');
  }
  return sh;
}

function ensureChildFolder_(root, name) {
  const it = root.getFoldersByName(name);
  return it.hasNext() ? it.next() : root.createFolder(name);
}


function repairDokumentasiMediaSheet_(ss) {
  const sh = ss.getSheetByName('DOKUMENTASI_FOTO');
  if (!sh) return;
  let lastCol = Math.max(sh.getLastColumn(), 7);
  let h = sh.getRange(1,1,1,lastCol).getDisplayValues()[0].map(v => String(v || '').trim());
  const legacy = ['id_foto','id_kegiatan','file_id','caption','urutan','file_url','updated_at'];
  const desired = ['id_foto','id_kegiatan','file_id','file_url','caption','urutan','updated_at'];

  // Backend V2 menulis nilai fisik dalam urutan "desired". Jika sheet masih memakai
  // header lama, URL terbaca sebagai caption dan angka urutan terbaca sebagai file_url.
  const firstSeven = h.slice(0,7);
  if (firstSeven.join('|') === legacy.join('|')) {
    let shouldRepair = sh.getLastRow() < 2;
    if (!shouldRepair) {
      const sample = sh.getRange(2,1,Math.min(5,sh.getLastRow()-1),7).getDisplayValues();
      shouldRepair = sample.some(r => /^https?:\/\//i.test(String(r[3] || '')) && /^\d+([.,]\d+)?$/.test(String(r[5] || '').trim()));
    }
    if (shouldRepair) {
      sh.getRange(1,1,1,7).setValues([desired]);
      h = desired.concat(h.slice(7));
    }
  }

  const expected = TRAX.SHEETS.DOKUMENTASI_FOTO;
  const missing = expected.filter(name => !h.includes(name));
  if (missing.length) {
    sh.getRange(1, sh.getLastColumn()+1, 1, missing.length).setValues([missing]);
  }
  sh.setFrozenRows(1);
  sh.getRange(1,1,1,sh.getLastColumn()).setFontWeight('bold').setBackground('#0b2940').setFontColor('#ffffff');
  clearRowsRuntime_('DOKUMENTASI_FOTO');
}

function seedConfig_(ss) {
  const defaults = {
    tahun_aktif: '2026',
    nama_instansi: 'Bagian Pengadaan Barang dan Jasa',
    nama_website: 'TRAXPBJ Kota Bogor',
    versi_api: '1'
  };
  Object.keys(defaults).forEach(key => {
    if (!findRowBy_('CONFIG', 'key', key)) sheet_('CONFIG').appendRow([key, defaults[key]]);
  });
}

function seedPimpinan_() {
  const defaults = [
    ['PIM001','kabag','','Kepala Bagian Pengadaan Barang dan Jasa',1],
    ['PIM002','lpse','','Ketua Kelompok LPSE',2],
    ['PIM003','advokasi','','Ketua Kelompok Pembinaan dan Advokasi',3],
    ['PIM004','pengelolaan','','Ketua Kelompok Pengelolaan PBJ',4]
  ];
  defaults.forEach(d => {
    if (!findRowBy_('PIMPINAN','id',d[0])) sheet_('PIMPINAN').appendRow([d[0],d[1],d[2],d[3],'','',d[4],true,new Date()]);
  });
}

// ---------- DATA HELPERS ----------
function ss_() { return TRAX_SS_RUNTIME || (TRAX_SS_RUNTIME = SpreadsheetApp.openById(TRAX.SPREADSHEET_ID)); }
function sheet_(name) {
  const sh = ss_().getSheetByName(name);
  if (!sh) throw new Error('Sheet ' + name + ' tidak ditemukan. Jalankan setupTRAXPBJ().');
  return sh;
}
function headers_(sh) { return sh.getRange(1,1,1,Math.max(sh.getLastColumn(),1)).getDisplayValues()[0].map(v=>String(v||'').trim()); }
function rowsObject_(name) {
  if (Object.prototype.hasOwnProperty.call(TRAX_ROWS_RUNTIME, name)) return TRAX_ROWS_RUNTIME[name];
  const sh = sheet_(name);
  if (sh.getLastRow() < 2) return (TRAX_ROWS_RUNTIME[name] = []);
  const h = headers_(sh);
  const vals = sh.getRange(2,1,sh.getLastRow()-1,h.length).getValues();
  return (TRAX_ROWS_RUNTIME[name] = vals.map(row => Object.fromEntries(h.map((k,i)=>[k,row[i]]))));
}
function clearRowsRuntime_(name) { if (name) delete TRAX_ROWS_RUNTIME[name]; else TRAX_ROWS_RUNTIME = {}; }
function findRowBy_(sheetName, key, value) { return rowsObject_(sheetName).find(r => String(r[key]) === String(value)); }

function upsert_(sheetName, key, keyValue, obj) {
  const sh = sheet_(sheetName), h = headers_(sh);
  let rowNo = -1;
  if (sh.getLastRow() >= 2) {
    const keyCol = h.indexOf(key) + 1;
    if (keyCol < 1) throw new Error('Kolom ' + key + ' tidak ditemukan pada ' + sheetName);
    const keys = sh.getRange(2,keyCol,sh.getLastRow()-1,1).getDisplayValues().flat().map(String);
    const idx = keys.indexOf(String(keyValue));
    if (idx >= 0) rowNo = idx + 2;
  }
  const row = h.map(col => Object.prototype.hasOwnProperty.call(obj,col) ? obj[col] : '');
  if (rowNo > 0) sh.getRange(rowNo,1,1,h.length).setValues([row]); else sh.appendRow(row);
  clearRowsRuntime_(sheetName);
}

function appendObject_(sheetName, obj) {
  const sh = sheet_(sheetName), h = headers_(sh);
  const row = h.map(col => Object.prototype.hasOwnProperty.call(obj,col) ? obj[col] : '');
  sh.appendRow(row);
  clearRowsRuntime_(sheetName);
}

function deleteRowBy_(sheetName, key, value, trashFile) {
  const sh = sheet_(sheetName), h = headers_(sh), rows = rowsObject_(sheetName);
  const idx = rows.findIndex(r => String(r[key]) === String(value));
  if (idx < 0) return false;
  if (trashFile) {
    const fileId = str_(rows[idx].file_id);
    if (fileId) try { DriveApp.getFileById(fileId).setTrashed(true); } catch (_) {}
  }
  sh.deleteRow(idx + 2);
  clearRowsRuntime_(sheetName);
  return true;
}

function deleteRowsWhere_(sheetName, predicate) {
  const sh = sheet_(sheetName), rows = rowsObject_(sheetName);
  const remove = [];
  rows.forEach((r,i) => { if (predicate(r)) remove.push(i+2); });
  remove.sort((a,b)=>b-a).forEach(rowNo => sh.deleteRow(rowNo));
  if (remove.length) clearRowsRuntime_(sheetName);
}

function nextOrder_(sheetName) {
  const nums = rowsObject_(sheetName).map(r => num_(r.urutan));
  return nums.length ? Math.max.apply(null, nums.concat([0])) + 1 : 1;
}
function nextPhotoOrder_(docId) {
  const nums = rowsObject_('DOKUMENTASI_FOTO').filter(r => str_(r.id_kegiatan) === String(docId)).map(r => num_(r.urutan));
  return nums.length ? Math.max.apply(null, nums.concat([0])) + 1 : 1;
}
function sortUrutan_(a,b) { return num_(a.urutan) - num_(b.urutan); }

// ---------- DRIVE HELPERS ----------
function rootFolder_() { return DriveApp.getFolderById(TRAX.ROOT_FOLDER_ID); }
function childFolderByName_(name) { return ensureChildFolder_(rootFolder_(), name); }

function listDriveFiles_(rootFolderId, recursive, maxFiles) {
  const out = [];
  const queue = [DriveApp.getFolderById(rootFolderId)];
  const limit = Math.max(1, Math.min(Math.round(num_(maxFiles)) || 1500, 5000));
  while (queue.length && out.length < limit) {
    const folder = queue.shift();
    const files = folder.getFiles();
    while (files.hasNext() && out.length < limit) out.push(files.next());
    if (recursive && out.length < limit) {
      const folders = folder.getFolders();
      while (folders.hasNext()) queue.push(folders.next());
    }
  }
  return out;
}

function saveUploadedFile_(folderName, file, baseName, oldFileId) {
  return saveUploadedFileToFolderId_(childFolderByName_(folderName).getId(), file, baseName, oldFileId);
}

function saveUploadedFileToFolderId_(folderId, file, baseName, oldFileId) {
  const blob = base64Blob_(file);
  const mime = str_(file.mimeType || file.type);
  const maxBytes = mime.indexOf('video/') === 0 ? TRAX.MAX_VIDEO_BYTES : TRAX.MAX_UPLOAD_BYTES;
  if (blob.getBytes().length > maxBytes) {
    throw new Error(mime.indexOf('video/') === 0
      ? 'Ukuran video terlalu besar. Maksimal 20 MB per video.'
      : 'Ukuran file terlalu besar. Maksimal 8 MB setelah diproses.');
  }
  const ext = extension_(file.name || '');
  const finalName = safeFileName_(baseName + (ext ? '.' + ext : ''));
  const saved = DriveApp.getFolderById(folderId).createFile(blob).setName(finalName);
  makePublic_(saved);
  if (oldFileId && oldFileId !== saved.getId()) try { DriveApp.getFileById(oldFileId).setTrashed(true); } catch (_) {}
  return saved.getId();
}

function base64Blob_(file) {
  let b64 = String(file.base64 || '');
  const comma = b64.indexOf(',');
  if (comma >= 0) b64 = b64.slice(comma + 1);
  const bytes = Utilities.base64Decode(b64);
  return Utilities.newBlob(bytes, file.mimeType || file.type || 'application/octet-stream', file.name || 'file');
}

function makePublic_(file) {
  try { file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW); } catch (_) {}
}
function publicFileUrl_(id) { return id ? 'https://drive.google.com/thumbnail?id=' + encodeURIComponent(String(id)) + '&sz=w2000' : ''; }
function driveViewUrl_(id) { return id ? 'https://drive.google.com/file/d/' + encodeURIComponent(String(id)) + '/view' : ''; }
function drivePreviewUrl_(id) { return id ? 'https://drive.google.com/file/d/' + encodeURIComponent(String(id)) + '/preview' : ''; }

// ---------- GENERAL HELPERS ----------
function json_(obj) { return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON); }
function parseBody_(e) {
  const raw = e && e.postData && e.postData.contents ? e.postData.contents : '{}';
  try { return JSON.parse(raw); } catch (_) { return {}; }
}
function id_(prefix) { return prefix + '-' + Utilities.getUuid().slice(0,12); }
function nowIso_() { return Utilities.formatDate(new Date(), TRAX.TZ, "yyyy-MM-dd'T'HH:mm:ssXXX"); }
function str_(v) { return v === null || v === undefined ? '' : String(v).trim(); }
function num_(v) {
  if (v === null || v === undefined || v === '') return 0;
  if (typeof v === 'number') return isFinite(v) ? v : 0;
  let s = String(v).trim().replace(/\s/g,'').replace(/%/g,'').replace(/[^0-9,.-]/g,'');
  if (!s) return 0;
  const lc=s.lastIndexOf(','), ld=s.lastIndexOf('.');
  if (lc>-1 && ld>-1) s = lc>ld ? s.replace(/\./g,'').replace(',','.') : s.replace(/,/g,'');
  else if (lc>-1) s=s.replace(',','.');
  else if (/^\d{1,3}(\.\d{3})+$/.test(s)) s=s.replace(/\./g,'');
  const n=Number(s); return isFinite(n) ? n : 0;
}
function nullableNum_(v) { return v === '' || v === null || v === undefined ? null : num_(v); }
function truthy_(v) { return v === true || String(v).toLowerCase() === 'true' || String(v) === '1' || String(v).toLowerCase() === 'ya'; }
function errorMessage_(err) { return String((err && err.message) || err || 'Terjadi kesalahan.'); }
function dateIso_(v) { if (!v) return ''; if (Object.prototype.toString.call(v) === '[object Date]' && !isNaN(v)) return Utilities.formatDate(v,TRAX.TZ,'yyyy-MM-dd'); return String(v); }
function dateTimeIso_(v) { if (!v) return ''; if (Object.prototype.toString.call(v) === '[object Date]' && !isNaN(v)) return Utilities.formatDate(v,TRAX.TZ,"yyyy-MM-dd'T'HH:mm:ssXXX"); return String(v); }
function extension_(name) { const m=String(name||'').match(/\.([a-z0-9]{1,8})$/i); return m ? m[1].toLowerCase() : ''; }
function fileStem_(name) { return String(name || '').replace(/\.[^.]+$/, '').trim(); }
function safeFileName_(s) { return String(s||'file').replace(/[\\/:*?"<>|#%{}]/g,'-').replace(/\s+/g,'-').slice(0,160); }
function safeFolderName_(s) { return String(s||'kegiatan').replace(/[\\/:*?"<>|#%{}]/g,'-').replace(/\s+/g,'_').slice(0,120); }
function normalizeLeaderKey_(v) {
  const s=String(v||'').toLowerCase();
  if (s.includes('kabag') || s.includes('kepala')) return 'kabag';
  if (s.includes('lpse')) return 'lpse';
  if (s.includes('advokasi') || s.includes('pembinaan')) return 'advokasi';
  if (s.includes('pengelolaan')) return 'pengelolaan';
  return ['kabag','lpse','advokasi','pengelolaan'].includes(s) ? s : '';
}
function leaderId_(key) { return {kabag:'PIM001',lpse:'PIM002',advokasi:'PIM003',pengelolaan:'PIM004'}[key] || id_('PIM'); }
function leaderOrder_(key) { return {kabag:1,lpse:2,advokasi:3,pengelolaan:4}[key] || 99; }
