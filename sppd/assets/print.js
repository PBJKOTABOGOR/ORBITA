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
    const td = (i, l, v) => `<tr><td style="width:5%">${i}</td><td style="width:43%">${l}</td><td>${v}</td></tr>`;
    const page = (x, draft) => `<section class="print-page">${draft ? '<p class="draft">DRAFT — BELUM DITERBITKAN</p>' : ''}${x}</section>`;

    // SPD halaman depan
    function front(d, p) {
        const o = d.office;
        return `<div class="kop"><b>PEMERINTAH KOTA BOGOR</b><br><b>${esc(o.name)}</b><br>${esc(o.unit)}<br>${esc(o.address)}</div><h2>SURAT PERJALANAN DINAS</h2><p class="center">Nomor: ${esc(p.number || 'Belum diterbitkan')}</p><table>${td(1, 'Pengguna Anggaran/Kuasa Pengguna Anggaran', esc(o.kpaName) + '<br>NIP. ' + esc(o.kpaNip))}${td(2, 'Nama/NIP Pegawai yang melaksanakan perjalanan dinas', esc(p.name) + '<br>NIP. ' + esc(p.nip))}${td(3, 'a. Pangkat dan Golongan<br>b. Jabatan<br>c. Tingkat biaya perjalanan dinas', esc(p.rank) + '<br>' + esc(p.position) + '<br>' + esc(p.level))}${td(4, 'Maksud dan Tujuan', esc(d.purpose))}${td(5, 'Alat angkutan yang dipergunakan', esc(d.transport))}${td(6, 'a. Tempat berangkat<br>b. Tempat tujuan', esc(d.origin) + '<br>' + esc(d.destination))}${td(7, 'a. Lamanya perjalanan dinas<br>b. Tanggal berangkat<br>c. Tanggal harus kembali/tiba di tempat baru*)', d.days + ' hari<br>' + date(d.start) + '<br>' + date(d.end))}${td(8, 'Pengikut: Nama / Tanggal lahir / Keterangan', '')}${td(9, 'Pembebanan anggaran<br>a. Perangkat Daerah<br>b. Kegiatan / rekening', esc(o.name) + '<br>' + esc(d.activity) + '<br>' + esc(d.account))}${td(10, 'Keterangan lain-lain', '')}</table><div class="sign"><div></div><div>Dikeluarkan di Bogor<br>Tanggal: ${date(d.issued)}${sign(o.kpaTitle || 'Kuasa Pengguna Anggaran', o.kpaName, o.kpaNip)}</div></div>`;
    }

    // SPD halaman belakang (visum)
    function back(d) {
        const o = d.office;
        const vis = (label, place, dt) => `${label}: ${esc(place || '......................')}<p>Pada tanggal: ${dt || '......................'}</p><p>Pejabat yang berwenang,</p><div class="space"></div><p>Nama: ........................................</p><p>NIP: ...........................................</p>`;
        return `<table class="visum"><tr><td style="width:50%"></td><td>Berangkat dari: ${esc(d.origin)}<p>Ke: ${esc(d.destination)}</p><p>Pada tanggal: ${date(d.start)}</p>${sign(o.kpaTitle || 'Kuasa Pengguna Anggaran', o.kpaName, o.kpaNip)}</td></tr>${[0, 1, 2].map((n) => `<tr><td>${vis('Tiba di', n === 0 ? d.destination : '', null)}</td><td>${vis('Berangkat dari', n === 0 ? d.destination : '', null)}</td></tr>`).join('')}<tr><td>Tiba di: ${esc(d.origin)}<p>Pada tanggal: ......................</p>${sign(o.kpaTitle || 'Kuasa Pengguna Anggaran', o.kpaName, o.kpaNip)}</td><td>Telah diperiksa dengan keterangan bahwa perjalanan tersebut atas perintahnya dan semata-mata untuk kepentingan jabatan dalam waktu yang sesingkat-singkatnya.${sign(o.kpaTitle || 'Kuasa Pengguna Anggaran', o.kpaName, o.kpaNip)}</td></tr></table><p class="note"><b>Perhatian:</b> PA/KPA yang menerbitkan SPD, pegawai yang melakukan perjalanan dinas, dan pejabat yang mengesahkan tanggal berangkat/tiba bertanggung jawab sesuai ketentuan yang berlaku.</p>`;
    }

    // Kuitansi Model U.XV
    function receipt(d, p) {
        let o = d.office;
        return `<div style="text-align:right">MODEL U.XV<br>BKU tanggal: ................<br>Nomor: ................<br>${esc(d.account)}</div><h2>KWITANSI PEMBAYARAN</h2><table class="noborder"><tr><td>Sudah terima dari</td><td>: ${esc(o.name)} / ${esc(o.bendTitle || 'Bendahara Pengeluaran Pembantu')}</td></tr><tr><td>Uang sejumlah</td><td>: ${esc(terbilang(p.total))}</td></tr><tr><td>Banyaknya uang</td><td>: <b>${rup(p.total)}</b></td></tr><tr><td>Untuk pembayaran</td><td>: Biaya perjalanan dinas a.n. ${esc(p.name)} selama ${d.days} hari, ${date(d.start)} s.d. ${date(d.end)}. ${esc(d.purpose)}.<br>SPD Nomor ${esc(p.number || '—')}</td></tr></table><div class="sign">${sign(o.bendTitle || 'Bendahara Pengeluaran Pembantu', o.bendName, o.bendNip)}${sign('Mengetahui / Setuju dibayar, PPTK', o.pptkName, o.pptkNip)}${sign('Bogor, ................ / Penerima', p.name, p.nip)}</div>`;
    }

    // Rincian biaya dan perhitungan rampung
    function detail(d, p) {
        let o = d.office;
        return `<h2>RINCIAN BIAYA PERJALANAN DINAS</h2><p>Lampiran SPD Nomor: ${esc(p.number || '—')}</p><p>Tanggal: ${date(d.issued)}</p><p>Nama: ${esc(p.name)}</p><table class="mini"><tr><th>NO</th><th>PERINCIAN BIAYA</th><th>JUMLAH</th></tr><tr><td>1</td><td>Uang Harian (1 orang × ${d.days} hari × ${rup(p.rate.amount)})</td><td class="right">${rup(p.daily)}</td></tr>${p.costs.map((c, i) => `<tr><td>${i + 2}</td><td>${esc(c.label)}${c.note ? ' — ' + esc(c.note) : ''}</td><td class="right">${rup(c.amount)}</td></tr>`).join('')}<tr><td></td><td><b>JUMLAH</b></td><td class="right"><b>${rup(p.total)}</b></td></tr></table><p>Terbilang: ${esc(terbilang(p.total))}</p><div class="sign">${sign(o.bendTitle || 'Bendahara Pengeluaran Pembantu', o.bendName, o.bendNip)}${sign('PPTK', o.pptkName, o.pptkNip)}${sign('Yang menerima', p.name, p.nip)}</div><h2>PERHITUNGAN RAMPUNG</h2><table class="mini"><tr><td>Ditetapkan sejumlah</td><td>${rup(p.total)}</td></tr><tr><td>Yang telah dibayar semula</td><td>${rup(p.advance)}</td></tr><tr><td>${p.total >= p.advance ? 'Sisa kurang' : 'Sisa lebih'}</td><td>${rup(Math.abs(p.total - p.advance))}</td></tr></table><div class="sign"><div></div>${sign(o.kpaTitle || 'Kuasa Pengguna Anggaran', o.kpaName, o.kpaNip)}</div>`;
    }

    // Pemilihan dokumen cetak
    window.printSPPD = (d, which = 'all', emp) => {
        const out = [];
        const draft = d.status === 'DRAFT';
        for (const p of d.participants.filter(x => !emp || x.employeeId === emp)) {
            if (which === 'all' || which === 'spd')
                out.push(page(front(d, p), draft), page(back(d), draft));
            if (which === 'all' || which === 'receipt')
                out.push(page(receipt(d, p), draft));
            if (which === 'all' || which === 'detail')
                out.push(page(detail(d, p), draft));
        }
        document.getElementById('printArea').innerHTML = out.join('');
        window.print();
    };
    window.sppdTerbilang = terbilang;
})();
