const fs = require('node:fs'), vm = require('node:vm'), assert = require('node:assert/strict'), crypto = require('node:crypto');
const sheets = new Map();
class Sheet {
    constructor() {
        this.a = [];
        this.max = 1000;
    }
    getLastRow() {
        return this.a.length;
    }
    getMaxRows() {
        return this.max;
    }
    insertRowsAfter(_, n) {
        this.max += n;
    }
    setFrozenRows() { }
    deleteRows(start, count) { this.a.splice(start - 1, count); this.max -= count; }
    appendRow(a) {
        this.a.push(a.map(clean));
    }
    getRange(row, col, n, m) {
        if (row + n - 1 > this.max)
            throw Error('range exceeds grid');
        return { createTextFinder: query => ({ matchEntireCell: () => ({ findAll: () => Array.from({length:n}, (_,i)=>i).filter(i=>String(this.a[row-1+i]?.[col-1]??'')===query).map(i=>({getRow:()=>row+i})) }) }), getDisplayValues: () => Array.from({ length: n }, (_, i) => Array.from({ length: m }, (_, j) => String(this.a[row - 1 + i]?.[col - 1 + j] ?? ''))), getValues: () => Array.from({ length: n }, (_, i) => Array.from({ length: m }, (_, j) => this.a[row - 1 + i]?.[col - 1 + j] ?? '')), setValues: vs => {
                for (let i = 0; i < n; i++) {
                    this.a[row - 1 + i] ??= [];
                    for (let j = 0; j < m; j++)
                        this.a[row - 1 + i][col - 1 + j] = clean(vs[i][j]);
                }
            } };
    }
}
const clean = v => typeof v === 'string' && v.startsWith("'") ? v.slice(1) : v;
const props = new Map([['FIRST_ADMIN_USER_ID', 'admin']]);
const db = { getSheetByName: n => sheets.get(n), insertSheet: n => {
        const s = new Sheet();
        sheets.set(n, s);
        return s;
    } };
const files = new Map();
const folder = { getId: () => 'folder', createFile: blob => {
        const id = crypto.randomUUID();
        files.set(id, blob);
        return { getId: () => id };
    } };
const ctx = vm.createContext({
    console,
    SpreadsheetApp: { openById: () => db, flush: () => { } },
    PropertiesService: { getScriptProperties: () => ({ getProperty: k => props.get(k), setProperty: (k, v) => props.set(k, v), deleteProperty: k => props.delete(k) }) },
    DriveApp: {
        createFolder: () => folder,
        getFolderById: () => folder,
        getFileById: id => ({ getBlob: () => ({ getBytes: () => files.get(id) }) })
    },
    Utilities: {
        getUuid: crypto.randomUUID,
        base64Decode: s => [...Buffer.from(s, 'base64')],
        base64Encode: b => Buffer.from(b).toString('base64'),
        newBlob: b => b
    },
    LockService: { getScriptLock: () => ({ waitLock: () => { }, releaseLock: () => { } }) }
});
vm.runInContext(fs.readFileSync('backend/Code.gs', 'utf8'), ctx);
const run = s => vm.runInContext(s, ctx), call = (u, p) => {
    ctx.u = u;
    ctx.p = p;
    return run('route_(u,p)');
}, throws = (fn, pattern) => assert.throws(fn, pattern);
run('setupSPPD();grantFirstAdmin();setupSPPD()');
const admin = { id: 'admin', name: 'Admin', grants: [{ opd: '*', roles: ['SUPERADMIN', 'ADMIN_SHS'] }] };
const op = { id: 'operator', name: 'Operator', grants: [{ opd: 'PBJ', roles: ['OPERATOR', 'ADMIN_OPD'] }] };
const bend = { id: 'bend', name: 'Bendahara', grants: [{ opd: 'PBJ', roles: ['BENDAHARA'] }] };
const outsider = { id: 'out', name: 'OPD lain', grants: [{ opd: 'OTHER', roles: ['OPERATOR'] }] };
const sbu = JSON.parse(fs.readFileSync('data/sbu-kota-bogor.json', 'utf8'));
assert.equal(sbu.length, 2129);
call(admin, {
    action: 'office',
    opd: 'PBJ',
    data: { name: 'Setda', unit: 'PBJ', kpaName: 'KPA', pptkName: 'PPTK', bendName: 'Bendahara' }
});
call(op, {
    action: 'employee',
    opd: 'PBJ',
    data: { name: 'Pegawai uji', nip: '123456789012345678', position: 'Staf', rank: 'III/a' }
});
const emp = call(op, { action: 'masters', opd: 'PBJ' }).employees[0];
assert.equal(emp.nip, '123456789012345678');
// Struktur kolom mengikuti KODE_REK; nominal ini adalah fixture pengujian.
const kode = db.insertSheet('KODE_REK');
const header = ['No','Kode Perangkat Daerah','Perangkat Daerah','Kode Unit','Unit','Kode Urusan','Urusan','Kode Bidang Urusan','Bidang Urusan','Kode Program','Program','Kode Kegiatan','Kegiatan','Kode Sub Kegiatan','Sub Kegiatan','Kode Sumber Dana','Sumber Dana','Kode Akun','Akun','Paket/Kelompok','Nama Paket/Kelompok','Jumlah (Rp)'];
kode.appendRow(header);
function budgetRow(sub, label, pagu, unit = 'BAGIAN PENGADAAN BARANG DAN JASA', account = '5.1.02.04.001.00001') {
    const row = Array(22).fill('');
    Object.assign(row,{3:unit==='BAGIAN PENGADAAN BARANG DAN JASA'?'4.01.7.01.2.13.23.0009':'4.01.7.01.2.13.23.9999',4:unit,13:sub,14:label,15:1.1,16:'PAD',17:account,18:'Belanja Perjalanan Dinas Biasa',21:pagu});
    kode.appendRow(row);
}
budgetRow('4.01.03.2.03.0001','Pengelolaan PBJ',87519000);
budgetRow('4.01.03.2.03.0001','Pengelolaan PBJ',201425000);
budgetRow('LAIN','Bukan PBJ',1000000,'DINAS LAIN');
budgetRow('4.01.03.2.03.0002','Layanan Elektronik',19974000);
budgetRow('4.01.03.2.03.0003','Pembinaan Advokasi',8620000);
budgetRow('4.01.03.2.03.0001','ATK',1000000,'BAGIAN PENGADAAN BARANG DAN JASA','5.1.02.01.001.00024');
assert.equal(run("budgetMaster_('2027').length"),0);
assert.equal(run("budgetMaster_('2026')[0].key"),'2026|4.01.03.2.03.0001|5.1.02.04.001.00001|1.1');
const imp = { action: 'importRates', year: '2026', validFrom: '2026-01-01', source: 'SBU UJI', items: sbu };
assert.equal(call(admin, imp).added, 2129);
assert.equal(call(admin, imp).added, 0);
call(admin, { action: 'activateRates', year: '2026', validFrom: '2026-01-01', confirm: true });
const boot = call(op, { action: 'init', opd: 'PBJ', year: '2026' }).boot;
assert(boot.rates.length > 50);
const rate = boot.rates.find(r => r.name === 'Uang Harian Perjalanan Dinas Luar Daerah DKI Jakarta' && r.spec === 'Luar Kota');
assert.equal(rate.rate, 530000);
const data = {
    purpose: 'Uji kegiatan',
    destination: 'Jakarta',
    origin: 'Bogor',
    province: 'DKI Jakarta',
    category: 'Luar Kota',
    budgetKey: boot.budget.accounts[0].key,
    account: 'TIDAK BOLEH DIPAKAI',
    activity: 'TIDAK BOLEH DIPAKAI',
    transport: 'Mobil',
    start: '2026-11-25',
    end: '2026-11-26',
    issued: '2026-11-24',
    mode: 'manual',
    participants: [{
            number: 'TEST/1/PBJ/2026',
            employeeId: emp.id,
            rateKey: rate.key,
            costs: [{ label: 'Bensin', amount: 100000, note: 'Bukti riil' }],
            advance: 500000
        }]
};
// Draft can be saved without an office master; issuance must not reserve a number yet.
const officeSheet = sheets.get('M_OPD');
const savedOfficeRow = officeSheet.a.pop();
const req = crypto.randomUUID();
const d = call(op, { action: 'save', opd: 'PBJ', requestId: req, data });
assert.equal(d.total, 1160000);
assert.equal(d.office.unit, 'Bagian Pengadaan Barang dan Jasa');
assert.equal(d.office.kpaName, undefined);
throws(()=>call(op,{action:'issue',id:d.id}), /Lengkapi identitas/);
assert.equal(call(op,{action:'register',opd:'PBJ',year:'2026'}).length,0);
officeSheet.a.push(savedOfficeRow);
throws(()=>call(op,{action:'issue',id:d.id}),/PPTK untuk subkegiatan/);
const officeData = JSON.parse(savedOfficeRow[1]);
call(admin,{action:'office',opd:'PBJ',data:{...officeData,pptkBySub:{'4.01.03.2.03.0001':{name:'PPTK PBJ',nip:'111111111111111111'},'4.01.03.2.03.0002':{name:'PPTK LPSE',nip:'222222222222222222'}}}});
assert.equal(run("officeFor_(JSON.parse(rows_('M_OPD')[0].json),'4.01.03.2.03.0002').pptkName"),'PPTK LPSE');
assert.equal(run("officeFor_({},'').address"),'Jl. Ir.H.Juanda No.10 Telp. (0251)8321075 Fax. 8326530');
assert.equal(call(op, { action: 'save', opd: 'PBJ', requestId: req, data }).id, d.id);
throws(() => call(outsider, { action: 'detail', id: d.id }), /Akses/);
throws(() => call(bend, { action: 'save', opd: 'PBJ', data }), /Akses/);
assert.equal(boot.budget.accounts.length,3);
assert.equal(boot.budget.accounts.reduce((n,x)=>n+x.pagu,0),317538000);
assert.equal(d.account,'5.1.02.04.001.00001');
assert.equal(d.activity,'Pengelolaan PBJ');
assert.equal(d.createdBy,'Operator');
const budget = () => call(op,{action:'boot',opd:'PBJ',year:'2026'}).budget.accounts[0];
assert.equal(budget().used,0);
assert.equal(budget().draft,1160000);
throws(()=>call(op,{action:'issue',id:d.id}),/pemakaian awal/);
const opening = (amount) => call(admin,{action:'openingBudget',opd:'PBJ',year:'2026',key:data.budgetKey,amount,note:'Posisi awal uji',confirm:true});
opening(288000000);
throws(()=>call(op,{action:'issue',id:d.id}),/Pagu tidak cukup/);
opening(10000000);
const preview = {action:'previewNumbers',opd:'PBJ',year:'2026',count:2};
throws(()=>call(op,preview),/dinonaktifkan/);
throws(()=>call(outsider,preview),/Akses/);
throws(()=>call(op,{action:'numberConfig',opd:'PBJ',year:'2026',pattern:'TEST/{urut}',next:1,enabled:true}),/dinonaktifkan/);
// Surat perintah boleh diunggah sebelum penerbitan, tetapi tidak wajib.
call(op,{action:'upload',id:d.id,name:'surat.pdf',mime:'application/pdf',base64:Buffer.from('%PDF-1.4 test').toString('base64')});
const issued = call(op,{action:'issue',id:d.id});
assert.equal(issued.status,'SIAP_CETAK');
assert.equal(issued.office.kpaName,'KPA');
assert.equal(issued.office.pptkName,'PPTK PBJ');
assert.equal(issued.participants[0].number,'TEST/1/PBJ/2026');
assert.equal(budget().remaining,277784000);
assert.equal(budget().draft,0);
const before = call(op,{action:'boot',opd:'PBJ',year:'2026'});
assert.equal(call(op,{action:'pulse',opd:'PBJ',year:'2026',revision:before.revision,budgetVersion:before.budgetVersion}).trips,undefined);
kode.a[1][21] += 100000;
const pulse = call(op,{action:'pulse',opd:'PBJ',year:'2026',revision:before.revision,budgetVersion:before.budgetVersion});
assert.equal(pulse.budget.accounts[0].pagu,289044000);
kode.a[1][21] -= 100000;
const tr = (u,to,expectedStatus,extra={}) => call(u,{action:'transition',id:d.id,to,expectedStatus,...extra});
tr(op,'SPJ','SIAP_CETAK');
let actual = call(op,{action:'detail',id:d.id});
call(op,{action:'reviseCosts',id:d.id,expectedUpdated:actual.updated,note:'Biaya akhir',participants:[{employeeId:emp.id,advance:500000,costs:[{label:'Bensin',amount:200000,note:'Bukti akhir'}]}]});
assert.equal(budget().used,1260000);
throws(()=>tr(op,'PERIKSA','SPJ'),/Tahapan/);
throws(()=>tr(bend,'ARSIP','SPJ',{confirm:true}),/Akses/);
tr(admin,'BATAL','SPJ',{note:'Batal penugasan'});
assert.equal(budget().used,0);
assert.equal(budget().remaining,278944000);
assert.equal(call(op,{action:'register',opd:'PBJ',year:'2026'}).length,1);
// Nomor tidak digunakan ulang; satu perjalanan bisa selesai tanpa pemeriksaan bendahara.
const duplicate = call(op,{action:'save',opd:'PBJ',requestId:crypto.randomUUID(),data});
throws(()=>call(op,{action:'issue',id:duplicate.id}),/sudah digunakan/);
const d2 = call(op,{action:'save',opd:'PBJ',requestId:crypto.randomUUID(),data:{...data,participants:data.participants.map(p=>({...p,number:'TEST/2/PBJ/2026'}))}});
const i2 = call(op,{action:'issue',id:d2.id});
assert.equal(i2.participants[0].number,'TEST/2/PBJ/2026');
call(op,{action:'transition',id:d2.id,to:'SPJ',expectedStatus:'SIAP_CETAK'});
call(op,{action:'transition',id:d2.id,to:'ARSIP',expectedStatus:'SPJ',confirm:true});
assert.equal(budget().used,1160000);
assert.equal(call(op,{action:'detail',id:d2.id}).status,'ARSIP');
throws(()=>call(admin,{action:'boot',opd:'OTHER',year:'2026'}),/Akses/);
throws(()=>call(admin,{action:'grant',opd:'OTHER',userId:'other',roles:'OPERATOR'}),/akses/);
throws(()=>call(op,{action:'save',opd:'PBJ',data:{...data,budgetKey:'invalid'}}),/anggaran/);
const pegawai=db.insertSheet('Pegawai');
pegawai.appendRow(['No','NIP','Nama Pegawai','Pangkat/Gol','Jabatan','Unit Kerja']);
pegawai.appendRow([1,'123456789012345678','Duplikat','III/a','Staf','Bagian Pengadaan Barang dan Jasa Setda Kota Bogor']);
pegawai.appendRow([2,'999999999999999999','Baru','III/b','Staf','Bagian Pengadaan Barang dan Jasa Setda Kota Bogor']);
pegawai.appendRow([3,'888888888888888888','Luar PBJ','III/b','Staf','Unit Lain']);
pegawai.appendRow([4,'9.99E+17','NIP tidak utuh','III/b','Staf','Bagian Pengadaan Barang dan Jasa Setda Kota Bogor']);
assert.equal(call(admin,{action:'syncEmployees',opd:'PBJ'}).added,1);
assert.equal(call(admin,{action:'syncEmployees',opd:'PBJ'}).added,0);
assert.equal(call(op,{action:'masters',opd:'PBJ'}).employees.length,2);
throws(()=>call(outsider,{action:'syncEmployees',opd:'PBJ'}),/Akses/);
throws(()=>call(admin,{action:'numberConfig',opd:'PBJ',year:'2026',prefix:'',suffix:'',next:3,enabled:true}),/dinonaktifkan/);
call(admin,{action:'numberConfig',opd:'PBJ',year:'2026',prefix:'',suffix:'',next:3,enabled:false});
assert.equal(call(admin,{action:'masters',opd:'PBJ'}).number[0].enabled,false);
console.log('PASS: setup tanpa reset, 2129 SBU, pengelompokan pagu, saldo awal, draft, pagu tidak cukup, nomor, unggah opsional, revisi, batal, arsip, akses, pembaruan KODE_REK.');

// Pengelolaan versi SBU tidak mengubah dasar hukum atau dokumen yang sudah terbit.
const oldVersion = { year: '2026', validFrom: '2026-01-01' };
const nextVersion = { year: '2026', validFrom: '2026-12-31' };
const catalog = (version = '') => call(admin, { action: 'rateCatalog', year: '2026', validFrom: version });
assert.equal(call(admin, { ...imp, ...nextVersion, source: 'SBU UJI BARU' }).added, 2129);
assert.equal(catalog().versions.length, 2);
assert.equal(catalog().rows.length, 2129);
assert.equal(catalog().validFrom, nextVersion.validFrom);
assert.equal(catalog(oldVersion.validFrom).rows.length, 2129);
assert.equal(catalog(oldVersion.validFrom).versions[0].active, 2129);
throws(() => call(op, { action: 'rateCatalog', ...oldVersion }), /akses/i);
throws(() => call(op, { action: 'renameRateVersion', ...oldVersion, name: 'X' }), /akses/i);
throws(() => call(op, { action: 'deleteRateVersion', ...nextVersion, confirm: true }), /akses/i);
throws(() => call(admin, { action: 'renameRateVersion', ...oldVersion, name: '' }), /kosong/);
call(admin, { action: 'renameRateVersion', ...oldVersion, name: 'SBU PBJ 2026' });
assert.equal(catalog(oldVersion.validFrom).versions[0].name, 'SBU PBJ 2026');
assert.equal(catalog(oldVersion.validFrom).rows[0].source, 'SBU UJI');
assert.equal(call(op, {action:'detail',id:d2.id}).participants[0].rate.source, 'SBU UJI');
throws(() => call(admin, { action: 'deleteRateVersion', ...oldVersion, confirm: true }), /sudah digunakan/);
throws(() => call(admin, { action: 'deleteRateVersion', ...nextVersion }), /Konfirmasi/);
call(admin, { action: 'renameRateVersion', ...nextVersion, name: 'Tarif baru' });
assert.equal(call(admin, { action: 'deleteRateVersion', ...nextVersion, confirm: true }).deleted, 2129);
assert.equal(catalog().versions.length, 1);
assert.equal(catalog().rows.length, 2129);
assert.equal(catalog().versions[0].name, 'SBU PBJ 2026');
assert.equal(catalog().versions[0].active, 2129);
assert.equal(call(op, {action:'detail',id:d2.id}).total, 1160000);
assert.equal(call(admin, {...imp, ...nextVersion}).added, 2129);
assert.equal(catalog().versions[1].name, 'SBU UJI');
assert.equal(call(admin,{action:'deleteRateVersion',...nextVersion,confirm:true}).deleted,2129);
assert.equal(call(op,{action:'masters',opd:'PBJ'}).employees[0].level,undefined);
console.log('PASS: daftar beberapa versi, ubah nama tanpa mengubah dasar hukum, hapus versi belum dipakai, tolak penghapusan versi terpakai, otorisasi admin, data SPD tetap.');

// SPD dibuat tanpa SBU maupun Bendahara; biaya baru dicatat setelah nomor terbit.
const oldOffice = call(op, {action:'masters',opd:'PBJ'}).office;
call(admin,{action:'office',opd:'PBJ',data:{...oldOffice,kpaNip:'111111111111111111',bendName:'',bendNip:'',pptkBySub:{'4.01.03.2.03.0001':{name:'',nip:''}}}});
const shs = sheets.get('M_SHS');
const savedRates = shs.a.splice(1);
const newData = {...data,spdOnly:true,province:'',category:'',start:'2026-11-28',end:'2026-11-28',issued:'2026-11-27',mode:'manual',participants:[{employeeId:emp.id,number:'TEST/3'}]};
const spd = call(op,{action:'save',opd:'PBJ',requestId:crypto.randomUUID(),data:newData});
assert.equal(spd.costsRecorded,false);
assert.equal(spd.participants[0].rate,null);
assert.equal(spd.total,0);
const spdIssued = call(op,{action:'issue',id:spd.id});
assert.equal(spdIssued.status,'SIAP_CETAK');
assert.equal(spdIssued.participants[0].number,'TEST/3');
assert.equal(budget().pendingCosts,1);
assert.equal(budget().used,1160000);
throws(()=>call(op,{action:'transition',id:spd.id,to:'SPJ',expectedStatus:'SIAP_CETAK'}),/Catat biaya/);
const cost = {action:'recordCosts',id:spd.id,expectedUpdated:spdIssued.updated,province:'DKI Jakarta',category:'Luar Kota',participants:[{employeeId:emp.id,advance:0,costs:spdIssued.participants[0].costs.map(c=>({...c,amount:0,note:''}))}]};
throws(()=>call(op,cost),/Tarif uang harian/);
shs.a.push(...savedRates);
throws(()=>call(op,cost),/PPTK subkegiatan/);
call(admin,{action:'office',opd:'PBJ',data:{...oldOffice,kpaName:'KPA baru',kpaNip:'222222222222222222',bendName:'Bendahara',bendNip:'333333333333333333'}});
opening(287700000);
throws(()=>call(op,cost),/Pagu tidak cukup/);
assert.equal(budget().pendingCosts,1);
opening(10000000);
const costSaved = call(op,cost);
assert.equal(costSaved.status,'SPJ');
assert.equal(costSaved.costsRecorded,true);
assert.equal(costSaved.total,530000);
assert.equal(costSaved.office.kpaName,oldOffice.kpaName);
assert.equal(costSaved.office.bendName,'Bendahara');
assert.equal(budget().pendingCosts,0);
assert.equal(budget().used,1690000);
throws(()=>call(op,cost),/Buka ulang/);
call(op,{action:'transition',id:spd.id,to:'ARSIP',expectedStatus:'SPJ',confirm:true});
assert.equal(call(op,{action:'detail',id:spd.id}).status,'ARSIP');
console.log('PASS: SPD tanpa SBU, PPTK dan Bendahara; nomor terbit dulu; biaya terpisah, validasi tarif dan pagu, snapshot penandatangan, pencegahan pencatatan ganda, arsip.');

// Koreksi tanggal SBU: tarif aktif belum berlaku pada tanggal perjalanan.
assert.equal(call(admin,{...imp,...nextVersion}).added,2129);
call(admin,{action:'activateRates',...nextVersion,confirm:true});
call(admin,{action:'renameRateVersion',...nextVersion,name:'SBU PBJ - koreksi'});
const dateChange = {action:'changeRateDate',...nextVersion,newValidFrom:'2026-10-01',confirm:true};
throws(()=>call(op,dateChange),/akses/i);
throws(()=>call(admin,{...dateChange,confirm:false}),/Konfirmasi/);
throws(()=>call(admin,{...dateChange,newValidFrom:'2026-01-01'}),/Sudah ada versi/);
throws(()=>call(admin,{...dateChange,newValidFrom:'2026-02-30'}),/Tanggal tidak valid/);
throws(()=>call(admin,{...dateChange,...oldVersion,newValidFrom:'2026-02-01'}),/sudah digunakan/);
const spd2=call(op,{action:'save',opd:'PBJ',requestId:crypto.randomUUID(),data:{...newData,participants:[{employeeId:emp.id,number:'TEST/4'}],start:'2026-11-29',end:'2026-11-30'}});
const spd2Issued=call(op,{action:'issue',id:spd2.id});
const cost2={...cost,id:spd2.id,expectedUpdated:spd2Issued.updated,participants:cost.participants.map(p=>({...p,daily:999999999,rate:999999999}))};
// Simulasi hanya versi Desember yang tersedia seperti pada produksi.
const previousRates=shs.a.splice(1,2129);
throws(()=>call(op,cost2),/baru berlaku 2026-12-31/);
shs.a.splice(1,0,...previousRates);
assert.equal(call(admin,dateChange).validFrom,'2026-10-01');
const corrected=catalog('2026-10-01');
assert.equal(corrected.rows.length,2129);
assert.equal(corrected.versions.find(v=>v.validFrom==='2026-10-01').name,'SBU PBJ - koreksi');
assert(corrected.rows.every(r=>r.active===true&&r.key.endsWith('|2026-10-01')));
assert.equal(catalog('2026-01-01').rows.length,2129);
throws(()=>call(op,{...cost2,costCity:''}),/Pilih kota/);
throws(()=>call(op,{...cost2,province:'Jawa Barat',costCity:'Kota Bandung'}),/Provinsi tarif/);
throws(()=>call(op,{...cost2,costCity:'Kota Bandung'}),/Provinsi tarif/);
const computed=call(op,{...cost2,costCity:'Jakarta Pusat'});
assert.equal(computed.costCity,'Jakarta Pusat');
assert.equal(computed.participants[0].daily,1060000);
assert.equal(computed.total,1060000);
assert(computed.participants[0].rateKey.endsWith('|2026-10-01'));
throws(()=>call(admin,{...dateChange,validFrom:'2026-10-01',newValidFrom:'2026-09-01'}),/sudah digunakan/);
console.log('PASS: tarif masa depan ditolak dengan tanggal jelas, koreksi 2129 item, perlindungan versi terpakai, tarif Jakarta dihitung server (input uang harian palsu diabaikan).');

// Tarif transport terpisah dari uang harian dan tidak dikalikan peserta/hari.
const emp2 = call(op,{action:'masters',opd:'PBJ'}).employees.find(p=>p.id!==emp.id);
const spd3 = call(op,{action:'save',opd:'PBJ',requestId:crypto.randomUUID(),data:{...newData,start:'2026-12-03',end:'2026-12-03',issued:'2026-12-03',participants:[{employeeId:emp.id,number:'TEST/5'},{employeeId:emp2.id,number:'TEST/5'}]}});
const issued3=call(op,{action:'issue',id:spd3.id});
const mkCosts=(p,bensin,tol,ticket=0)=>({employeeId:p.employeeId,advance:9999999,costs:p.costs.map(c=>({...c,amount:c.label==='Bensin'?bensin:c.label==='Tol dan parkir'?tol:c.label==='Tiket pesawat'?ticket:0,note:'Bukti'}))});
const base3={action:'recordCosts',id:spd3.id,expectedUpdated:issued3.updated,province:'DKI Jakarta',costCity:'Jakarta',category:'Luar Kota'};
const [a3,b3]=issued3.participants;
throws(()=>call(op,{...base3,participants:[mkCosts(a3,300000,0),mkCosts(b3,0,80000)]}),/melebihi batas SBU/);
throws(()=>call(op,{...base3,participants:[mkCosts(a3,100000,0,200000),mkCosts(b3,0,0)]}),/rute dan kelas/);
const ok3=call(op,{...base3,participants:[mkCosts(a3,200000,120000),mkCosts(b3,0,0)]});
assert.equal(ok3.transportRates.road.amount,370000);
assert.equal(ok3.participants[0].daily,530000);
assert.equal(ok3.participants[0].advance,0);
assert.equal(ok3.participants[0].total,850000);
assert.equal(ok3.participants[1].total,530000);
assert.equal(ok3.total,1380000);
throws(()=>call(op,{action:'reviseCosts',id:spd3.id,expectedUpdated:ok3.updated,note:'Uji batas',participants:[mkCosts(a3,370001,0),mkCosts(b3,0,0)]}),/melebihi batas SBU/);
const flightRate=call(op,{action:'boot',opd:'PBJ',year:'2026'}).rates.find(r=>r.name.includes('Jakarta ke Surabaya')&&r.spec==='Ekonomi'&&r.validFrom==='2026-10-01');
assert(flightRate);
throws(()=>call(op,{action:'reviseCosts',id:spd3.id,expectedUpdated:ok3.updated,note:'Tiket uji',flightRateKey:flightRate.key,participants:[mkCosts(a3,0,0,flightRate.rate+1),mkCosts(b3,0,0)]}),/Tiket pesawat.*melebihi/);
// Uji satuan tiket pada perjalanan berbeda (Surabaya).
const air=call(op,{action:'save',opd:'PBJ',requestId:crypto.randomUUID(),data:{...newData,destination:'Surabaya',transport:'Pesawat',start:'2026-12-04',end:'2026-12-04',issued:'2026-12-04',participants:[{employeeId:emp.id,number:'TEST/7'}]}});
const airIssued=call(op,{action:'issue',id:air.id});
const airDone=call(op,{action:'recordCosts',id:air.id,expectedUpdated:airIssued.updated,province:'Jawa Timur',costCity:'Kota Surabaya',category:'Luar Kota',flightRateKey:flightRate.key,participants:[mkCosts(airIssued.participants[0],0,0,flightRate.rate)]});
assert.equal(airDone.transportRates.flight.unit,'Orang / PP');
assert.equal(airDone.total,410000+flightRate.rate);
assert.equal(airDone.participants[0].advance,0);
console.log('PASS: Rp370.000 per kendaraan (gabungan peserta), uang harian terpisah, penolakan biaya berlebih pada server, tiket per orang/PP, uang muka tidak diisi dari browser.');

// Rincian fleksibel: nama bebas ikut batas jalan, bukan hanya daftar label lama.
const rev = {action:'reviseCosts',id:spd3.id,expectedUpdated:ok3.updated,note:'Rincian fleksibel'};
const custom = (p, costs) => ({employeeId:p.employeeId,costs});
const row = (label,amount,kind='road') => ({label,amount,kind,note:'Bukti uji'});
throws(()=>call(op,{...rev,participants:[custom(a3,[row('BBM kendaraan',300000)]),custom(b3,[row('Biaya parkir tambahan',70001)])]}),/melebihi batas SBU/);
throws(()=>call(op,{...rev,participants:[custom(a3,[row('Bensin',500000,'lodging')]),custom(b3,[])]}),/jenis dan nama biaya/);
const edited=call(op,{...rev,participants:[custom(a3,[row('BBM kendaraan',200000),row('Parkir',50000)]),custom(b3,[])]});
assert.equal(edited.total,1310000);
assert.equal(edited.participants[0].costs.length,2);
assert.equal(edited.participants[1].costs.length,0);
assert.equal(edited.participants[0].daily,530000);
assert.equal(issued3.participants[0].number,issued3.participants[1].number);
console.log('PASS: rincian bebas tambah/hapus/ubah, plafon gabungan, nomor Sprint manual sama dalam satu perjalanan, duplikasi lintas perjalanan ditolak.');
