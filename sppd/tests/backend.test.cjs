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
    appendRow(a) {
        this.a.push(a.map(clean));
    }
    getRange(row, col, n, m) {
        if (row + n - 1 > this.max)
            throw Error('range exceeds grid');
        return { createTextFinder: query => ({ matchEntireCell: () => ({ findAll: () => Array.from({length:n}, (_,i)=>i).filter(i=>String(this.a[row-1+i]?.[col-1]??'')===query).map(i=>({getRow:()=>row+i})) }) }), getValues: () => Array.from({ length: n }, (_, i) => Array.from({ length: m }, (_, j) => this.a[row - 1 + i]?.[col - 1 + j] ?? '')), setValues: vs => {
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
    PropertiesService: { getScriptProperties: () => ({ getProperty: k => props.get(k), setProperty: (k, v) => props.set(k, v) }) },
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
    mode: 'auto',
    participants: [{
            employeeId: emp.id,
            rateKey: rate.key,
            costs: [{ label: 'Bensin', amount: 100000, note: 'Bukti riil' }],
            advance: 500000
        }]
};
const req = crypto.randomUUID();
const d = call(op, { action: 'save', opd: 'PBJ', requestId: req, data });
assert.equal(d.total, 1160000);
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
throws(()=>call(op,{action:'issue',id:d.id}),/Register/);
call(op,{action:'numberConfig',opd:'PBJ',year:'2026',pattern:'TEST/{urut}/PBJ/{tahun}',next:1,enabled:true});
// Surat perintah boleh diunggah sebelum penerbitan, tetapi tidak wajib.
call(op,{action:'upload',id:d.id,name:'surat.pdf',mime:'application/pdf',base64:Buffer.from('%PDF-1.4 test').toString('base64')});
const issued = call(op,{action:'issue',id:d.id});
assert.equal(issued.status,'SIAP_CETAK');
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
const d2 = call(op,{action:'save',opd:'PBJ',requestId:crypto.randomUUID(),data});
const i2 = call(op,{action:'issue',id:d2.id});
assert.equal(i2.participants[0].number,'TEST/2/PBJ/2026');
call(op,{action:'transition',id:d2.id,to:'SPJ',expectedStatus:'SIAP_CETAK'});
call(op,{action:'transition',id:d2.id,to:'ARSIP',expectedStatus:'SPJ',confirm:true});
assert.equal(budget().used,1160000);
assert.equal(call(op,{action:'detail',id:d2.id}).status,'ARSIP');
throws(()=>call(admin,{action:'boot',opd:'OTHER',year:'2026'}),/Akses/);
throws(()=>call(admin,{action:'grant',opd:'OTHER',userId:'other',roles:'OPERATOR'}),/akses/);
throws(()=>call(op,{action:'save',opd:'PBJ',data:{...data,budgetKey:'invalid'}}),/anggaran/);
console.log('PASS: setup tanpa reset, 2129 SBU, pengelompokan pagu, saldo awal, draft, pagu tidak cukup, nomor, unggah opsional, revisi, batal, arsip, akses, pembaruan KODE_REK.');
