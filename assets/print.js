(() => {
    'use strict';

    // Format teks, tanggal dan nominal
    const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const rup = n => 'Rp ' + Number(n || 0).toLocaleString('id-ID');
    const date = s => s ? new Date(s + 'T00:00:00').toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }) : '................';
    const words = n => {
        n = Math.floor(Math.abs(n));
        let a = ['', 'satu', 'dua', 'tiga', 'empat', 'lima', 'enam', 'tujuh', 'delapan', 'sembilan', 'sepuluh', 'sebelas'];
        if (n < 12)
            return a[n];
        if (n < 20)
            return words(n - 10) + ' belas';
        if (n < 100)
            return words(n / 10) + ' puluh ' + words(n % 10);
        if (n < 200)
            return 'seratus ' + words(n - 100);
        if (n < 1000)
            return words(n / 100) + ' ratus ' + words(n % 100);
        if (n < 2000)
            return 'seribu ' + words(n - 1000);
        for (const [v, t] of [[1e12, 'triliun'], [1e9, 'miliar'], [1e6, 'juta'], [1000, 'ribu']])
            if (n >= v)
                return words(n / v) + ' ' + t + ' ' + words(n % v);
        return '';
    };
    const terbilang = n => {
        const s = (n ? words(n) : 'nol').trim().replace(/\s+/g, ' ') + ' rupiah';
        return s[0].toUpperCase() + s.slice(1);
    };
    const sign = (title, name, nip) => `<div>${esc(title)}<div class="space"></div><b><u>${esc(name || '................................')}</u></b><p>NIP. ${esc(nip || '................')}</p></div>`;
    const page = (x, draft) => `<section class="print-page">${draft ? '<p class="draft">DRAFT — BELUM DITERBITKAN</p>' : ''}${x}</section>`;

    // Format SPD mengikuti lembar depan dan belakang Excel Bagian PBJ.
    const dots = '.....................................................';
    const line = (label, value) => `<div class="spd-line"><span>${label}</span><span>${value}</span></div>`;
    const row = (n, label, value, cls = '') => `<tr class="${cls}"><td class="spd-no">${n}</td><td>${label}</td><td>${value}</td></tr>`;
    const kpaSign = (o, rank = false) => `<div class="spd-signature"><div>${esc(o.kpaTitle || 'Kepala Bagian Pengadaan Barang/Jasa selaku Kuasa Pengguna Anggaran')}</div><div class="spd-sign-gap"></div><b><u>${esc(o.kpaName || dots)}</u></b>${rank && o.kpaRank ? `<div><b>${esc(o.kpaRank)}</b></div>` : ''}<div><b>NIP. ${esc(o.kpaNip || dots)}</b></div></div>`;
    const address = o => esc(o.address || 'Jl. Ir.H.Juanda No.10 Telp. (0251)8321075 Fax. 8326530');
    const spdPage = (html, side, draft) => `<section class="print-page spd-sheet spd-${side}">${draft ? '<div class="spd-draft">DRAFT — BELUM DITERBITKAN</div>' : ''}<div class="spd-content">${html}</div></section>`;

    function front(d, p) {
        const o = d.office || {};
        const days = Number(d.days || 0);
        const account = d.account === '5.1.02.04.001.00001' ? `${d.account} Belanja Perjalanan Dinas Biasa` : d.account;
        return `<div class="spd-kop"><img src="assets/lambang-kota-bogor.png" alt="Lambang Kota Bogor"><div class="spd-kop-text"><b>BAGIAN PENGADAAN BARANG/JASA</b><b>SEKRETARIAT DAERAH KOTA BOGOR</b><span>${address(o)}</span><span>BOGOR - 16121</span></div></div>
        <div class="spd-title">SURAT PERJALANAN DINAS</div><div class="spd-number">Nomor: ${esc(p.number || 'Belum diterbitkan')}</div>
        <table class="spd-table"><colgroup><col style="width:5%"><col style="width:42%"><col style="width:53%"></colgroup><tbody>
        ${row('1', 'Pengguna Anggaran/Kuasa Pengguna Anggaran', ': ' + esc(o.kpaName) + '<br>&nbsp; NIP. ' + esc(o.kpaNip), 'spd-r1')}
        ${row('2', 'Nama/NIP Pegawai yang melaksanakan perjalanan dinas', ': ' + esc(p.name) + '<br>&nbsp; NIP. ' + esc(p.nip), 'spd-r2')}
        ${row('3', line('a.','Pangkat dan Golongan') + line('b.','Jabatan') + line('c.','Tingkat Biaya Perjalanan Dinas'), line('a.',esc(p.rank)) + line('b.',esc(p.position)) + line('c.',esc(p.level)), 'spd-r3')}
        ${row('4', 'Maksud dan Tujuan', ': ' + esc(d.purpose), 'spd-purpose')}
        ${row('5', 'Alat angkutan yang dipergunakan', ': ' + esc(d.transport), 'spd-r5')}
        ${row('6', line('a.','Tempat berangkat') + line('b.','Tempat tujuan'), line('a.',esc(d.origin)) + line('b.',esc(d.destination)), 'spd-r6')}
        ${row('7', line('a.','Lamanya perjalanan dinas') + line('b.','Tanggal berangkat') + line('c.','Tanggal harus kembali/tiba di tempat baru*)'), line('a.',esc(days + ' (' + (days ? words(days).trim() : 'nol') + ') hari')) + line('b.',date(d.start)) + line('c.',date(d.end)), 'spd-r7')}
        <tr class="spd-followers"><td class="spd-no">8 *)</td><td>Pengikut : <span class="spd-follower-name">Nama</span></td><td><div class="spd-follower-cols"><span>Tanggal Lahir</span><span>Keterangan</span></div></td></tr>
        <tr class="spd-followers-blank"><td></td><td></td><td><div class="spd-follower-cols"><span>&nbsp;</span><span>&nbsp;</span></div></td></tr>
        ${row('9', 'Pembebanan anggaran' + line('a.','SKPD') + line('b.','Sub Kegiatan') + line('c.','Akun'), '<div>&nbsp;</div>' + line('a.',esc(o.name === 'SEKRETARIAT DAERAH' ? 'Sekretariat Daerah Kota Bogor' : o.name || 'Sekretariat Daerah Kota Bogor')) + line('b.',esc(d.activity)) + line('c.',esc(account)), 'spd-r9')}
        ${row('10', 'Keterangan lain-lain', '', 'spd-r10')}
        </tbody></table><div class="spd-footnote">*)Coret yang tidak perlu</div>
        <div class="spd-front-sign"><div>Dikeluarkan di Bogor</div><div>Tanggal : ${date(d.issued)}</div>${kpaSign(o, true)}</div>`;
    }

    // Visum: kolom pengesahan tetap kosong untuk tanda tangan dan cap basah.
    function back(d) {
        const o = d.office || {};
        const field = (label, value = '') => `<div class="vis-field"><span>${label}</span><span>:</span><span>${value}</span></div>`;
        const unknown = () => `<div class="vis-blank-sign">(${dots})</div>`;
        const arrival = (place = '', dt = '') => field('Tiba di', place) + field('Pada tanggal', dt) + field('Kepala') + unknown();
        const departure = (place = '', to = '', dt = '') => field('Berangkat dari', place) + field('Ke', to) + field('Pada Tanggal', dt) + field('Kepala') + unknown();
        const pair = (n, left, right, cls = '') => `<div class="vis-pair ${cls}"><div class="vis-cell"><span class="vis-index">${n}</span>${left}</div><div class="vis-cell">${right}</div></div>`;
        return `<div class="spd-visum">${pair('', '', '<span class="vis-index">I.</span>' + field('Berangkat dari',esc(d.origin)) + '<div class="vis-indent">(tempat kedudukan)</div>' + field('Ke',esc(d.destination)) + field('Pada tanggal',date(d.start)) + kpaSign(o), 'vis-first')}
        ${pair('II.',arrival(esc(d.destination)),departure(esc(d.destination),esc(d.origin)), 'vis-middle')}
        ${pair('III.',arrival(),departure(), 'vis-middle')}
        ${pair('IV.',arrival(),departure(), 'vis-middle')}
        ${pair('V.',field('Tiba di',esc(d.origin)) + field('Pada tanggal') + field('Kepala') + kpaSign(o), 'Telah diperiksa dengan keterangan bahwa perjalanan tersebut atas perintahnya dan semata-mata untuk kepentingan jabatan dalam waktu yang sesingkat-singkatnya.' + kpaSign(o), 'vis-last')}
        <div class="vis-note-title">VI. &nbsp; Catatan Lain-lain</div><div class="vis-note-title">VII. &nbsp; Perhatian</div><div class="vis-notice">Pengguna Anggaran/Kuasa Pengguna Anggaran yang menerbitkan SPD, Pegawai yang melakukan perjalanan dinas, para pejabat yang mengesahkan tanggal berangkat/tiba, serta Bendahara Pengeluaran bertanggung jawab berdasarkan peraturan perundang-undangan tentang keuangan daerah, apabila Pemerintah Kota Bogor menderita kerugian akibat kesalahan, kelalaian dan kealpaannya.</div></div>`;
    }

    // Kuitansi Model U.XV
    function receipt(d, p) {
        let o = d.office;
        return `<div style="text-align:right">MODEL U.XV<br>BKU tanggal: ................<br>Nomor: ................<br>${esc(d.account)}</div><h2>KWITANSI PEMBAYARAN</h2><table class="noborder"><tr><td>Sudah terima dari</td><td>: ${esc(o.name)} / ${esc(o.bendTitle || 'Bendahara Pengeluaran Pembantu')}</td></tr><tr><td>Uang sejumlah</td><td>: ${esc(terbilang(p.total))}</td></tr><tr><td>Banyaknya uang</td><td>: <b>${rup(p.total)}</b></td></tr><tr><td>Untuk pembayaran</td><td>: Biaya perjalanan dinas a.n. ${esc(p.name)} selama ${d.days} hari, ${date(d.start)} s.d. ${date(d.end)}. ${esc(d.purpose)}.<br>SPD Nomor ${esc(p.number || '—')}</td></tr></table><div class="sign">${sign(o.bendTitle || 'Bendahara Pengeluaran Pembantu', o.bendName, o.bendNip)}${sign('Mengetahui / Setuju dibayar, PPTK', o.pptkName, o.pptkNip)}${sign('Bogor, ................ / Penerima', p.name, p.nip)}</div>`;
    }

    // Rincian biaya dan perhitungan rampung
    function detailRows(p) {
        const costs = p.costs || [];
        const kind = c => c.kind || (c.label === 'Tiket pesawat' ? 'flight' : c.label === 'Penginapan' ? 'lodging' : 'road');
        const transport = costs.filter(c => kind(c) !== 'lodging');
        const lodging = costs.filter(c => kind(c) === 'lodging');
        const row = (number, label, amount, note = '') => `<tr><td>${number}</td><td>${label}</td><td class="right">${amount === null ? '' : rup(amount)}</td><td>${esc(note)}</td></tr>`;
        return row('2.', 'Transportasi', null) + transport.map((c, i) => row('', String.fromCharCode(97 + i % 26) + (i >= 26 ? String(Math.floor(i / 26) + 1) : '') + '. ' + esc(c.label), c.amount, c.note)).join('') +
            (lodging.length ? lodging.map((c, i) => row(i ? '' : '3.', esc(c.label), c.amount, c.note)).join('') : row('3.', 'Penginapan', 0));
    }
    function detail(d, p) {
        let o = d.office;
        return `<h2>RINCIAN BIAYA PERJALANAN DINAS</h2><p>Lampiran SPD Nomor: ${esc(p.number || '—')}</p><p>Tanggal: ${date(d.issued)}</p><p>Nama: ${esc(p.name)}</p><table class="mini cost-print"><tr><th>NO.</th><th>PERINCIAN BIAYA</th><th>JUMLAH</th><th>KETERANGAN</th></tr><tr><td>1.</td><td>Uang Harian (1 orang × ${d.days} hari × ${rup(p.rate.amount)})</td><td class="right">${rup(p.daily)}</td><td></td></tr>${detailRows(p)}<tr><td></td><td><b>JUMLAH</b></td><td class="right"><b>${rup(p.total)}</b></td><td></td></tr></table><p>Terbilang: ${esc(terbilang(p.total))}</p><div class="sign">${sign(o.bendTitle || 'Bendahara Pengeluaran Pembantu', o.bendName, o.bendNip)}${sign('PPTK', o.pptkName, o.pptkNip)}${sign('Yang menerima', p.name, p.nip)}</div><h2>PERHITUNGAN RAMPUNG</h2><table class="mini"><tr><td>Ditetapkan sejumlah</td><td>${rup(p.total)}</td></tr><tr><td>Yang telah dibayar semula</td><td>${rup(p.advance)}</td></tr><tr><td>${p.total >= p.advance ? 'Sisa kurang' : 'Sisa lebih'}</td><td>${rup(Math.abs(p.total - p.advance))}</td></tr></table><div class="sign"><div></div>${sign(o.kpaTitle || 'Kuasa Pengguna Anggaran', o.kpaName, o.kpaNip)}</div>`;
    }

    function fileName(d, which, participants) {
        const kind = { spd: 'SPD', receipt: 'KWITANSI', detail: 'RINCIAN', all: 'SPPD' }[which] || 'SPD';
        const first = String(participants[0]?.name || 'PEGAWAI').trim().split(/\s+/)[0].normalize('NFKD').replace(/[^a-zA-Z0-9]/g, '').toUpperCase() || 'PEGAWAI';
        const parts = String(d.start || d.issued || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
        const stamp = parts ? parts[3] + parts[2] + parts[1] : 'TANPA-TANGGAL';
        const name = participants.length > 1 ? first + '-ROMBONGAN' : first;
        return `${kind}-${name}${stamp}-ORBITA`;
    }

    // Pemilihan dokumen cetak
    window.printSPPD = (d, which = 'all', emp) => {
        const out = [];
        const draft = d.status === 'DRAFT';
        if (draft || d.costsRecorded === false) {
            if (which === 'receipt' || which === 'detail') return;
            which = 'spd';
        }
        const participants = d.participants.filter(x => !emp || x.employeeId === emp);
        for (const p of participants) {
            if (which === 'all' || which === 'spd')
                out.push(spdPage(front(d, p), 'front', draft), spdPage(back(d), 'back', draft));
            if (which === 'all' || which === 'receipt')
                out.push(page(receipt(d, p), draft));
            if (which === 'all' || which === 'detail')
                out.push(page(detail(d, p), draft));
        }
        if (!out.length) return;
        const area = document.getElementById('printArea');
        area.innerHTML = out.join('');
        const previousTitle = document.title;
        document.title = fileName(d, which, participants);
        // Chrome menggunakan judul dokumen sebagai usulan nama Save as PDF.
        const restoreTitle = () => { document.title = previousTitle; };
        if (window.addEventListener) window.addEventListener('afterprint', restoreTitle, { once: true });
        const images = area.querySelectorAll ? Array.from(area.querySelectorAll('img')) : [];
        const print = () => window.print();
        if (images.length) {
            Promise.all(images.map(img => img.decode())).then(print).catch(() => {
                restoreTitle();
                const toast = document.getElementById('toast');
                if (toast) {
                    toast.textContent = 'Lambang Kota Bogor belum berhasil dimuat. Coba cetak kembali.';
                    toast.className = 'show error';
                    setTimeout(() => { toast.className = ''; }, 4500);
                }
            });
        } else print();
    };
    window.sppdTerbilang = terbilang;
})();
