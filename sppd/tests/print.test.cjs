const vm = require('node:vm'), fs = require('node:fs'), assert = require('node:assert/strict');
const out = { innerHTML: '' };
let printed = false;
const ctx = { window: { print: () => {
            printed = true;
        } }, document: { getElementById: () => out } };
vm.createContext(ctx);
vm.runInContext(fs.readFileSync('assets/print.js', 'utf8'), ctx);
assert.equal(ctx.window.sppdTerbilang(530000), 'Lima ratus tiga puluh ribu rupiah');
assert.equal(ctx.window.sppdTerbilang(0), 'Nol rupiah');
ctx.window.printSPPD({
    status: 'SIAP_CETAK',
    office: { name: 'OPD', unit: 'Unit', kpaName: 'KPA', bendName: 'Bend', pptkName: 'PPTK' },
    start: '2026-11-25',
    end: '2026-11-26',
    issued: '2026-11-24',
    origin: 'Bogor',
    destination: 'Jakarta',
    purpose: '<uji>',
    days: 2,
    transport: 'Mobil',
    activity: 'Kegiatan',
    account: '5.1.02',
    participants: [{
            name: 'Uji',
            nip: '123',
            number: 'TEST/1',
            rate: { amount: 530000 },
            daily: 1060000,
            costs: [{ label: 'Bensin', amount: 100000, note: 'Bukti' }],
            total: 1160000,
            advance: 500000
        }]
});
assert(printed);
assert.equal((out.innerHTML.match(/class="print-page(?: |")/g) || []).length, 4);
assert(out.innerHTML.includes('&lt;uji&gt;'));
assert(out.innerHTML.includes('PERHITUNGAN RAMPUNG'));
assert(out.innerHTML.includes('<td>2.</td><td>Transportasi</td>'));
assert(out.innerHTML.includes('<td>3.</td><td>Penginapan</td>'));
assert(out.innerHTML.includes('<th>KETERANGAN</th>'));
assert(out.innerHTML.includes('<td>Bukti</td>'));
assert(out.innerHTML.indexOf('Uang Harian') < out.innerHTML.indexOf('<td>2.</td><td>Transportasi</td>'));
assert(out.innerHTML.includes('a. Bensin'));
console.log('PASS: terbilang, 4 halaman logis, escape teks, rincian rampung');

printed = false;
const pending = {
    status: 'SIAP_CETAK', costsRecorded: false,
    office: { name: 'OPD', unit: 'Unit', kpaName: 'KPA' },
    start: '2026-11-25', end: '2026-11-25', issued: '2026-11-24', origin: 'Bogor', destination: 'Jakarta', purpose: 'Uji SPD', days: 1, transport: 'Mobil', activity: 'Kegiatan', account: '5.1.02',
    participants: [{ name: 'Uji', nip: '123', number: 'TEST/2', rate: null, costs: [], total: 0 }]
};
ctx.window.printSPPD(pending, 'all');
assert(printed);
assert.equal((out.innerHTML.match(/class="print-page(?: |")/g) || []).length, 2);
assert(!out.innerHTML.includes('PERHITUNGAN RAMPUNG'));
assert.equal(ctx.document.title, 'SPD-UJI25112026-ORBITA');
assert(out.innerHTML.includes('lambang-kota-bogor.png'));
assert(out.innerHTML.includes('SEKRETARIAT DAERAH KOTA BOGOR'));
assert(out.innerHTML.includes('Catatan Lain-lain'));
printed = false;
ctx.window.printSPPD(pending, 'receipt');
assert(!printed);
console.log('PASS: SPD tanpa biaya hanya mencetak halaman depan dan belakang; kuitansi belum bisa dicetak.');
