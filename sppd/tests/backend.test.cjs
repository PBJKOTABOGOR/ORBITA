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
        return { getValues: () => Array.from({ length: n }, (_, i) => Array.from({ length: m }, (_, j) => this.a[row - 1 + i]?.[col - 1 + j] ?? '')), setValues: vs => {
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
    account: '5.1.02',
    activity: 'Kegiatan Uji',
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
throws(() => call(op, { action: 'issue', id: d.id }), /Register/);
call(op, { action: 'numberConfig', opd: 'PBJ', year: '2026', pattern: 'TEST/{urut}/PBJ/{tahun}', next: 1, enabled: true });
const issued = call(op, { action: 'issue', id: d.id });
assert.equal(issued.participants[0].number, 'TEST/1/PBJ/2026');
assert.equal(issued.status, 'SIAP_CETAK');
const tr = (u, to, expectedStatus, extra = {}) => call(u, { action: 'transition', id: d.id, to, expectedStatus, ...extra });
tr(op, 'SPJ', 'SIAP_CETAK');
throws(() => tr(op, 'PERIKSA', 'SPJ'), /Unggah/);
let actual = call(op, { action: 'detail', id: d.id });
call(op, {
    action: 'reviseCosts',
    id: d.id,
    expectedUpdated: actual.updated,
    note: 'Bukti akhir',
    participants: [{ employeeId: emp.id, advance: 500000, costs: [{ label: 'Bensin', amount: 200000, note: 'Bukti riil baru' }] }]
});
assert.equal(call(op, { action: 'detail', id: d.id }).total, 1260000);
call(op, {
    action: 'upload',
    id: d.id,
    name: 'test.pdf',
    mime: 'application/pdf',
    base64: Buffer.from('%PDF-1.4 test').toString('base64')
});
tr(op, 'PERIKSA', 'SPJ');
throws(() => tr(op, 'SIAP_BAYAR', 'PERIKSA', { confirm: true }), /Akses/);
tr(bend, 'PERBAIKAN', 'PERIKSA', { note: 'Periksa dokumen' });
tr(op, 'PERIKSA', 'PERBAIKAN');
tr(bend, 'SIAP_BAYAR', 'PERIKSA', { confirm: true });
tr(bend, 'DIBAYAR', 'SIAP_BAYAR', { note: 'BKU 1, 26 November' });
tr(bend, 'ARSIP', 'DIBAYAR');
assert.equal(call(bend, { action: 'detail', id: d.id }).status, 'ARSIP');
assert.equal(call(op, { action: 'register', opd: 'PBJ', year: '2026' }).length, 1);
console.log('PASS: setup, impor 2129 SBU, versi, tarif Jakarta, NIP, akses lintas OPD, simpan idempoten, register, SPJ, perbaikan, pembayaran, arsip');
