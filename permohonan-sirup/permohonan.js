/* ORBITA PBJ — Permohonan SiRUP v29.34. Seluruh data tetap divalidasi di Apps Script. */
(() => {
    'use strict';
    const $ = id => document.getElementById(id), $$ = s => Array.from(document.querySelectorAll(s));
    const API = window.TRAXPBJ_SELECTION_CONFIG?.apiUrl || '', TOKEN = 'traxpbj_selection_token';
    const digits = n => String(n == null ? '' : n).replace(/\D/g, '');
    const grouped = n => digits(n).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    const money = n => 'Rp' + Math.round(Number(n) || 0).toLocaleString('id-ID');
    function formatMoneyInput(el) {
        const start = el.selectionStart ?? el.value.length, prev = el.value.slice(0, start), count = digits(prev).length, formatted = grouped(el.value);
        el.value = formatted;
        let caret = 0, seen = 0;
        while (caret < formatted.length && seen < count) {
            if (/\d/.test(formatted[caret]))
                seen++;
            caret++;
        }
        el.setSelectionRange(caret, caret);
        return digits(formatted);
    }
    const moneyInput = (attr, value, placeholder) => '<input type="text" inputmode="numeric" autocomplete="off" data-money="1" ' + attr + ' value="' + safe(grouped(value)) + '" placeholder="' + safe(placeholder) + '">';
    const safe = t => String(t == null ? '' : t).replace(/[&<>"']/g, k => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[k]));
    const date = s => s ? new Date(s).toLocaleString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';
    const pretty = { cara_pengadaan: 'Cara Pengadaan', metode_pengadaan: 'Metode Pemilihan', nama_paket: 'Nama Paket', jenis_pengadaan: 'Jenis Pekerjaan', pdn: 'Produk Dalam Negeri', sumber_dana: 'Sumber Dana', tahun: 'Tahun Anggaran', pagu: 'Nilai Pagu', waktu_pemilihan: 'Waktu Pemilihan', spesifikasi: 'Spesifikasi Pekerjaan', uraian: 'Uraian Pekerjaan', dikecualikan: 'Pengadaan Dikecualikan' };
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    const monthLocal = ['januari', 'februari', 'maret', 'april', 'mei', 'juni', 'juli', 'agustus', 'september', 'oktober', 'november', 'desember'];
    function monthPickerValue(value) {
        const str = String(value || '').trim();
        if (/^20\d{2}-(0[1-9]|1[0-2])$/.test(str))
            return str;
        const m = str.match(/^([a-zA-Z]+)\s+(20\d{2})$/);
        if (!m)
            return '';
        const name = m[1].toLowerCase(), i = monthNames.findIndex((x, j) => x.toLowerCase() === name || monthLocal[j] === name);
        return i >= 0 ? m[2] + '-' + String(i + 1).padStart(2, '0') : '';
    }
    function monthText(value) {
        const x = monthPickerValue(value);
        return x ? monthNames[Number(x.slice(5)) - 1] + ' ' + x.slice(0, 4) : '';
    }
    function rupMatchText(value) {
        return String(value || '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/[^A-Z0-9]/g, '');
    }
    const types = ['Barang', 'Jasa Konsultansi', 'Jasa Lainnya', 'Pekerjaan Konstruksi'], methods = ['E-Purchasing', 'Pengadaan Langsung', 'Penunjukan Langsung', 'Seleksi', 'Tender', 'Tender Cepat'], swTypes = ['Swakelola Tipe 1', 'Swakelola Tipe 2', 'Swakelola Tipe 3', 'Swakelola Tipe 4'];
    const modeTitle = { SATU_KE_SATU: 'Revisi satu ke satu', SATU_KE_BANYAK: 'Revisi satu ke banyak', PAKET_BARU: 'Penambahan paket baru', PEMBATALAN: 'Pembatalan paket', GABUNGAN: 'Beberapa usulan dalam satu surat' };
    const state = { letterUpload: null, letterUploadSeq: 0, officeRows: [], officeLookup: new Map(), searchCache: new Map(), searchPending: new Map(), admin: false, office: '', user: null, allRecords: [], source: null, chosenCode: '', fields: [], page: 0, busy: false, searchId: 0, tab: 'ringkasan', mode: 'SATU_KE_SATU', category: 'Penyedia', hierarchy: [], hierarchyOffice: '', structure: { program: '', kegiatan: '', sub_kegiatan: '' }, packages: [], singleJobs: [], rupDetails: new Map(), rupLoadId: 0, draftId: "", restoring: false, items: [], editingIndex: -1, loadSeq: 0, overviewReady: false, rupTotals: null, budget: null, budgetOffice: '', budgetPending: null, budgetPendingOffice: '', overviewPending: null };
    function msg(t, type = '') {
        const box = $('feedback');
        box.textContent = t;
        box.className = 'message ' + type;
    }
    function busy(on, title = 'Memproses data…', detail = 'Menghubungi layanan ORBITA') {
        state.busy = on;
        $('overlay').hidden = !on;
        $('loadingTitle').textContent = title;
        $('loadingDetail').textContent = detail;
        $('loadingPercent').hidden = !on;
        if (!on)
            $('loadStatus').hidden = !$('loadStatus').classList.contains('load-error');
    }
    // Meter hanya bergerak saat pekerjaan yang terukur selesai, bukan menggunakan persentase perkiraan.
    const openMeter = { shown: 0, target: 0, label: '', frame: 0, clock: 0, started: 0, waiters: [] };
    function meterStop() {
        if (openMeter.frame) {
            cancelAnimationFrame(openMeter.frame);
            openMeter.frame = 0;
        }
        if (openMeter.clock) {
            clearInterval(openMeter.clock);
            openMeter.clock = 0;
        }
        $('loadingElapsed').hidden = true;
        const waiters = openMeter.waiters.splice(0);
        waiters.forEach(w => w.resolve());
    }
    function progress(percent, text, isError = false) {
        if (isError)
            meterStop();
        const value = Math.max(0, Math.min(100, Number(percent) || 0)), el = $('loadStatus');
        el.classList.toggle('load-error', isError);
        $('loadStatusPercent').textContent = isError ? 'Gagal' : value + '%';
        $('loadStatusText').textContent = text;
        $('loadStatusBar').style.width = value + '%';
        $('loadRetry').hidden = !isError;
        el.hidden = !isError && state.busy;
        $('loadingPercent').textContent = isError ? 'Gagal' : value + '% · ' + text;
        $('loadingDetail').textContent = text;
        $('loadingBar').style.width = value + '%';
    }
    function meterStart() {
        meterStop();
        openMeter.shown = 0;
        openMeter.target = 0;
        openMeter.started = Date.now();
        openMeter.label = 'Memeriksa sesi pengguna…';
        $('loadingElapsed').hidden = false;
        $('loadingElapsed').textContent = 'Menghubungi layanan…';
        progress(0, openMeter.label);
        openMeter.clock = setInterval(() => {
            const elapsed = Math.max(0, Math.floor((Date.now() - openMeter.started) / 1000));
            $('loadingElapsed').textContent = elapsed < 2 ? 'Menghubungi layanan…' : 'Proses berjalan ' + elapsed + ' detik · menunggu tahap berikutnya';
        }, 1000);
    }
    function meterTick() {
        openMeter.frame = 0;
        const gap = openMeter.target - openMeter.shown;
        openMeter.shown = gap <= 0.75 ? openMeter.target : Math.min(openMeter.target, openMeter.shown + Math.max(0.85, gap * 0.18));
        progress(Math.floor(openMeter.shown), openMeter.label);
        if (openMeter.shown < openMeter.target) {
            openMeter.frame = requestAnimationFrame(meterTick);
            return;
        }
        for (const item of openMeter.waiters.splice(0)) {
            if (openMeter.shown >= item.value)
                item.resolve();
            else
                openMeter.waiters.push(item);
        }
    }
    function meterStage(value, label) {
        // Nilai hanya naik sesudah tahapan nyata selesai (sesi lokal, API, dan render).
        openMeter.target = Math.max(openMeter.target, Math.min(100, value));
        openMeter.label = label;
        if (!openMeter.frame)
            openMeter.frame = requestAnimationFrame(meterTick);
    }
    function meterWait(value) {
        return new Promise(resolve => {
            if (openMeter.shown >= value)
                resolve();
            else
                openMeter.waiters.push({ value, resolve });
        });
    }
    async function finishProgress() {
        meterStage(100, 'Akun, riwayat, dan RUP satuan kerja siap.');
        await meterWait(100);
        meterStop();
        $('loadStatus').hidden = true;
    }
    async function api(action, p = {}, timeout = 45000) {
        const token = sessionStorage.getItem(TOKEN);
        if (!token)
            throw Error('Sesi login belum tersedia. Masuk lewat ORBITA terlebih dahulu.');
        if (!API)
            throw Error('Alamat layanan ORBITA tidak ditemukan.');
        const ctrl = new AbortController(), clock = setTimeout(() => ctrl.abort(), timeout);
        try {
            const res = await fetch(API, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=UTF-8' }, body: JSON.stringify({ action, token, ...p }), cache: 'no-store', signal: ctrl.signal });
            const json = await res.json();
            if (!json.ok)
                throw Error(json.error || 'Permintaan gagal diproses.');
            if (sessionStorage.getItem(TOKEN) !== token)
                throw Error('Sesi akun telah berubah.');
            return json.data;
        }
        catch (e) {
            if (e.name === 'AbortError')
                throw Error('Layanan terlalu lama merespons. Coba ulang.');
            throw e;
        }
        finally {
            clearTimeout(clock);
        }
    }
    function tab(key) {
        state.tab = key;
        $$('.tabs button[data-tab]').forEach(b => b.classList.toggle('active', b.dataset.tab === key));
        $$('.tab-panel').forEach(p => p.hidden = p.id !== 'tab-' + key);
        if (key === 'riwayat')
            renderHistory();
        window.SirupWorkspace.setPage(key);
    }
    function sums(t) {
        if (!t) {
            for (const id of ['totalPenyedia', 'totalSwakelola', 'totalSemua'])
                $(id).textContent = '—';
            for (const id of ['numPenyedia', 'numSwakelola', 'numSemua'])
                $(id).textContent = 'Pilih satuan kerja';
            return;
        }
        $('totalPenyedia').textContent = money(t.penyedia);
        $('totalSwakelola').textContent = money(t.swakelola);
        $('totalSemua').textContent = money(t.penyedia + t.swakelola);
        $('numPenyedia').textContent = Number(t.jumlahPenyedia).toLocaleString('id-ID') + ' paket';
        $('numSwakelola').textContent = Number(t.jumlahSwakelola).toLocaleString('id-ID') + ' paket';
        $('numSemua').textContent = (Number(t.jumlahPenyedia) + Number(t.jumlahSwakelola)).toLocaleString('id-ID') + ' RUP yang terbaca';
    }
    function resetEditor(clearChoice = true) {
        state.source = null;
        state.chosenCode = '';
        state.packages = [];
        state.singleJobs = [];
        if (!state.restoring && !state.items.length && state.editingIndex < 0)
            state.draftId = '';
        state.rupLoadId++;
        $('editPanel').hidden = true;
        $('letterPanel').hidden = !state.items.length && !state.letterUpload;
        if (clearChoice)
            $('rupChoice').value = '';
    }
    // Data awal: metadata akun dan RUP dimuat paralel.
    // Rincian RUP selanjutnya dicari dari data ini; tidak fetch DETAILPSW saat pilihan berubah.
    async function init(keepOffice = true) {
        const seq = ++state.loadSeq, previous = keepOffice ? state.office : '';
        state.overviewReady = false;
        state.rupTotals = null;
        state.officeRows = [];
        state.officeLookup.clear();
        state.budget = null;
        state.budgetOffice = '';
        $('workspace').hidden = true;
        let loadingActive = true;
        meterStart();
        try {
            // Dua proses independen berjalan bersamaan. Riwayat hanya dibaca oleh metadata,
            // sedangkan DETAILPSW hanya dibaca di proses RUP. Pilih paket selanjutnya tetap lokal.
            const params = { ...(previous ? { satker: previous } : {}) }, finished = { meta: false, rup: false };
            meterStage(10, 'Permintaan data akun dan RUP sudah dikirim…');
            const completed = (part, label) => {
                if (seq !== state.loadSeq || !loadingActive)
                    return;
                finished[part] = true;
                meterStage(10 + (finished.meta ? 28 : 0) + (finished.rup ? 50 : 0), finished.meta && finished.rup ? 'Data akun, riwayat, dan RUP sudah diterima.' : label);
            };
            const [account, source] = await Promise.all([
                api('permohonanSirupBootstrapMeta', params, 110000).then(result => {
                    completed('meta', 'Akses dan riwayat sudah diterima. Menunggu RUP…');
                    return result;
                }),
                api('permohonanSirupBootstrapRup', params, 110000).then(result => {
                    completed('rup', 'Daftar dan rincian RUP sudah diterima. Menunggu akun…');
                    return result;
                })
            ]);
            if (seq !== state.loadSeq)
                return;
            if (account.satker !== source.satker)
                throw Error('Satuan kerja pada data akun dan RUP berbeda. Silakan muat ulang.');
            const data = { ...account, ...source };
            meterStage(93, 'Menyusun daftar RUP dan riwayat di halaman…');
            state.user = data.user;
            state.admin = data.isAdmin;
            if (!$('requestEmail').value && data.user?.email)
                $('requestEmail').value = data.user.email;
            state.office = data.satker;
            state.allRecords = data.records || [];
            state.officeRows = data.rupRows || [];
            for (const r of state.officeRows)
                state.officeLookup.set(String(r.kode_rup), r);
            state.rupTotals = data.totals || null;
            state.overviewReady = true;
            state.hierarchy = data.hierarchy || [];
            state.hierarchyOffice = state.office;
            resetEditor();
            $('currentUser').textContent = (data.user.nama || 'Pengguna') + ' · ' + data.user.role;
            $('roleLabel').hidden = false;
            $('roleLabel').textContent = state.admin ? 'ADMIN' : 'PPK / OPD';
            $('adminNav').hidden = !state.admin;
            $('tab-admin').hidden = state.tab !== 'admin' || !state.admin;
            $('officePanel').hidden = !state.admin;
            if (state.admin) {
                const selected = state.office;
                $('officeChoice').innerHTML = '<option value="">Pilih satuan kerja</option>' + (data.units || []).map(x => '<option value="' + safe(x) + '"' + (x === selected ? ' selected' : '') + '>' + safe(x) + '</option>').join('');
            }
            sums(state.rupTotals);
            $('totalRequest').textContent = state.allRecords.length.toLocaleString('id-ID');
            $('numPending').textContent = state.allRecords.filter(x => !['SELESAI', 'DITOLAK', 'DRAF'].includes(x.status)).length + ' pengajuan berjalan';
            $('workspace').hidden = false;
            window.SirupWorkspace.setOffice(state.office, state.admin);
            renderHistory();
            updateMode();
            window.SirupWorkspace.setPage(state.tab, false);
            if (state.office) {
                await searchRup();
                renderBudget();
                if (state.mode === 'PAKET_BARU') {
                    await loadHierarchy();
                    maybeShowEditor();
                }
                msg(state.officeRows.length + ' RUP tersedia untuk ' + state.office + '.');
            }
            else {
                $('rupChoice').innerHTML = '<option value="">Pilih satuan kerja</option>';
                msg('Pilih satuan kerja untuk melihat RUP. Riwayat tetap tersedia.');
            }
            await finishProgress();
            loadingActive = false;
        }
        catch (err) {
            loadingActive = false;
            if (seq === state.loadSeq)
                progress(0, 'Gagal memuat data: ' + err.message, true);
            throw err;
        }
    }
    async function loadOverview() {
        busy(true, 'Memuat ulang data OPD…', 'Membaca data satu kali.');
        try {
            await init(true);
        }
        finally {
            busy(false);
        }
    }
    function applyRupSearch(res) {
        const el = $('rupChoice'), previous = el.value;
        el.innerHTML = '<option value="">Pilih RUP (' + res.total + ' ditemukan)</option>' + res.rows.map(r => '<option value="' + safe(r.kode_rup) + '">' + safe(r.kode_rup + ' · ' + r.nama_paket) + '</option>').join('');
        if (res.rows.some(r => r.kode_rup === previous))
            el.value = previous;
        $('rupSourceHint').textContent = res.total > 100 ? 'Menampilkan 100 hasil awal. Ketik kode atau nama paket untuk mempersempit.' : res.total + ' RUP ' + state.category + ' ditemukan.';
    }
    async function searchRup() {
        if (!state.office || state.mode === 'PAKET_BARU')
            return;
        const category = rupMatchText(state.category), query = rupMatchText($('rupSearch').value.trim());
        const found = state.officeRows.filter(r => rupMatchText(r.cara_pengadaan) === category && (!query || rupMatchText(r.kode_rup + ' ' + r.nama_paket + ' ' + r.sub_kegiatan).includes(query)));
        applyRupSearch({ rows: found.slice(0, 100), total: found.length });
    }
    const unique = a => Array.from(new Set(a.filter(Boolean)));
    const selectOptions = (opts, v, placeholder = 'Pilih') => '<option value="">' + safe(placeholder) + '</option>' + unique(opts).map(x => '<option value="' + safe(x) + '"' + (String(x) === String(v) ? ' selected' : '') + '>' + safe(x) + '</option>').join('');
    function updateMode() {
        const isNew = state.mode === 'PAKET_BARU';
        $('categoryChooser').hidden = isNew;
        $('categoryHint').hidden = isNew;
        $('categoryChooser').closest('.category-bar').hidden = isNew && !state.admin;
        $$('#modeChooser [data-mode]').forEach(b => b.classList.toggle('active', b.dataset.mode === state.mode));
        $$('#categoryChooser [data-category]').forEach(b => b.classList.toggle('selected', b.dataset.category === state.category));
        $('oldRupSection').hidden = isNew;
        $('newRupSection').hidden = !isNew;
        $('categoryHint').textContent = state.category === 'Swakelola' ? 'Metode otomatis Swakelola. Pilih Tipe 1, 2, 3, atau 4 pada rincian paket.' : 'Untuk Penyedia, pilih jenis pekerjaan, PDN, dan metode pemilihan.';
    }
    async function selectMode(m) {
        if (state.mode === m)
            return;
        state.mode = m;
        resetEditor();
        updateMode();
        if (!state.office)
            return;
        if (m === 'PAKET_BARU') {
            await loadHierarchy();
            maybeShowEditor();
        }
        else
            await searchRup();
    }
    async function selectCategory(c) {
        if (state.category === c)
            return;
        if (state.mode === 'PAKET_BARU') {
            state.category = c;
            updateMode();
            return;
        }
        state.category = c;
        resetEditor();
        updateMode();
        if (!state.office)
            return;
        await searchRup();
    }
    async function loadHierarchy() {
        if (!state.office)
            return;
        if (state.hierarchyOffice !== state.office) {
            const uniq = new Map();
            for (const r of state.officeRows) {
                const key = [r.program, r.kegiatan, r.sub_kegiatan].join('|');
                if (r.program && r.kegiatan && r.sub_kegiatan && !uniq.has(key))
                    uniq.set(key, { program: r.program, kegiatan: r.kegiatan, sub_kegiatan: r.sub_kegiatan });
            }
            state.hierarchy = [...uniq.values()];
            state.hierarchyOffice = state.office;
        }
        renderStructure();
    }
    function renderStructure() {
        const h = state.hierarchy, o = state.structure;
        const programs = unique(h.map(x => x.program));
        if (!programs.includes(o.program))
            o.program = '';
        $('programChoice').innerHTML = selectOptions(programs, o.program, 'Pilih program');
        const activities = unique(h.filter(x => x.program === o.program).map(x => x.kegiatan));
        if (!activities.includes(o.kegiatan))
            o.kegiatan = '';
        $('kegiatanChoice').innerHTML = selectOptions(activities, o.kegiatan, 'Pilih kegiatan');
        const subs = unique(h.filter(x => x.program === o.program && x.kegiatan === o.kegiatan).map(x => x.sub_kegiatan));
        if (!subs.includes(o.sub_kegiatan))
            o.sub_kegiatan = '';
        $('subkegiatanChoice').innerHTML = selectOptions(subs, o.sub_kegiatan, 'Pilih subkegiatan');
    }
    function emptyPackage(from = {}, kind = state.category) {
        const category = kind, pagu = String(from.pagu || '');
        return { jenis_rup: category, _collapsed: false, nama_paket: from.nama_paket || '', pagu, metode_pengadaan: category === 'Swakelola' ? 'Swakelola' : methods.includes(from.metode_pengadaan) ? from.metode_pengadaan : 'E-Purchasing', jenis_pengadaan: category === 'Swakelola' ? 'Swakelola' : types.includes(from.jenis_pengadaan) ? from.jenis_pengadaan : 'Barang', pdn: from.pdn === 'Tidak' ? 'Tidak' : 'Ya', usaha_kecil: 'Ya', sumber_dana: from.sumber_dana || 'APBD', waktu_pemilihan: from.waktu_pemilihan || '', spesifikasi: category === 'Swakelola' ? swTypes.includes(from.spesifikasi) ? from.spesifikasi : 'Swakelola Tipe 1' : from.spesifikasi || '', uraian: from.uraian || '', dikecualikan: from.metode_pengadaan === 'Dikecualikan' ? 'Ya' : 'Tidak', spp: [], jenis_pekerjaan: [{ jenis: types.includes(from.jenis_pengadaan) ? from.jenis_pengadaan : 'Barang', pagu }], pemanfaatan_awal: '', pemanfaatan_akhir: '', pelaksanaan_awal: '', pelaksanaan_akhir: '', pemilihan_awal: '', pemilihan_akhir: '' };
    }
    function maybeShowEditor() {
        if (state.mode === 'PAKET_BARU' && !state.structure.sub_kegiatan) {
            $('editPanel').hidden = true;
            $('letterPanel').hidden = true;
            return;
        }
        if (state.mode === 'PAKET_BARU' && !state.packages.length)
            state.packages = [emptyPackage({}, 'Penyedia')];
        if (state.mode !== 'PAKET_BARU' && !state.source)
            return;
        $('editPanel').hidden = false;
        $('letterPanel').hidden = false;
        $('singleEdit').hidden = state.mode !== 'SATU_KE_SATU';
        $('cancelEdit').hidden = state.mode !== 'PEMBATALAN';
        $('packageEdit').hidden = state.mode === 'SATU_KE_SATU' || state.mode === 'PEMBATALAN';
        $('editHeading').textContent = modeTitle[state.mode];
        $('editDescription').textContent = state.mode === 'PEMBATALAN' ? 'Isi alasan pembatalan. Paket tidak akan dihapus otomatis dari SiRUP.' : state.mode === 'SATU_KE_SATU' ? 'Centang hanya bagian yang ingin diubah. Nama paket, spesifikasi, dan uraian ditampilkan berdekatan.' : state.mode === 'SATU_KE_BANYAK' ? 'Paket pertama mengikuti RUP asal dan tidak bisa dihapus. Semua paket hasil pemecahan harus tetap ' + state.category + '.' : 'Tambah paket Penyedia atau Swakelola sesuai kebutuhan. Tiap paket bisa diringkas dan disimpan sebagai draft.';
        if (state.source) {
            const d = state.source;
            $('rupIdentity').innerHTML = '<div><small>Kode RUP asal</small><b>' + safe(d.kode_rup) + '</b></div><div><small>Nama paket</small><b>' + safe(d.nama_paket) + '</b></div><div><small>Pagu awal</small><b>' + money(String(d.pagu || '').replace(/[^0-9]/g, '')) + '</b></div>';
        }
        else
            $('rupIdentity').innerHTML = '<div><small>Subkegiatan</small><b>' + safe(state.structure.sub_kegiatan) + '</b></div><div><small>Kode RUP</small><b>Belum ada — usulan paket baru</b></div>';
        if (state.mode === 'SATU_KE_SATU') {
            if (!state.singleJobs.length)
                state.singleJobs = [{ jenis: types.includes(state.source.jenis_pengadaan) ? state.source.jenis_pengadaan : types[0], pagu: digits(state.source.pagu) }];
            renderSingle();
        }
        else if (state.mode !== 'PEMBATALAN')
            renderPackages();
    }
    function singleControl(k, v) {
        if (k === 'jenis_pengadaan')
            return '<div class="single-job-wrap"><div id="singleJobs" class="jobs">' + singleJobMarkup() + '</div><button type="button" class="mini-btn" data-add-single-job="1">+ Tambah jenis pekerjaan</button><div class="job-hint" id="singleJobHint">Jumlah pagu jenis pekerjaan harus sama dengan pagu paket.</div></div>';
        if (k === 'metode_pengadaan')
            return '<select data-value="' + k + '">' + selectOptions(state.category === 'Swakelola' ? ['Swakelola'] : [...methods, 'Dikecualikan', v], v, 'Pilih metode') + '</select>';
        if (k === 'pdn')
            return '<div class="pills"><label><input type="radio" name="singlePdn" data-value="pdn" value="Ya" ' + (v === 'Ya' ? 'checked' : '') + '> Ya</label><label><input type="radio" name="singlePdn" data-value="pdn" value="Tidak" ' + (v === 'Tidak' ? 'checked' : '') + '> Tidak</label></div>';
        if (k === 'spesifikasi' && state.category === 'Swakelola')
            return '<select data-value="spesifikasi">' + selectOptions(swTypes, swTypes.includes(v) ? v : '', 'Pilih Tipe Swakelola') + '</select>';
        if (k === 'uraian' || k === 'spesifikasi')
            return '<textarea data-value="' + k + '" rows="' + (k === 'uraian' ? 7 : 3) + '" placeholder="Isi ' + safe(pretty[k]) + '">' + safe(v) + '</textarea>';
        if (k === 'waktu_pemilihan')
            return '<input data-value="waktu_pemilihan" type="month" aria-label="Pilih bulan dan tahun pemilihan" value="' + safe(monthPickerValue(v)) + '">';
        return k === 'pagu' ? moneyInput('data-value="pagu"', v, 'Isi pagu baru') : '<input data-value="' + k + '" type="text" value="' + safe(v) + '" placeholder="Isi nilai baru">';
    }
    function singleJobMarkup() {
        return state.singleJobs.map((j, i) => '<div class="job-row"><select data-single-job="' + i + '" data-job-key="jenis">' + option(types, j.jenis) + '</select>' + moneyInput('data-single-job="' + i + '" data-job-key="pagu"', j.pagu, 'Pagu jenis pekerjaan') + '<button type="button" class="mini-btn" data-remove-single-job="' + i + '" ' + (state.singleJobs.length === 1 ? 'disabled' : '') + '>Hapus</button></div>').join('');
    }
    function renderSingleJobs() {
        const root = $('singleJobs');
        if (root)
            root.innerHTML = singleJobMarkup();
        updateSingleJobTotal();
        countChange();
    }
    function updateSingleJobTotal() {
        const hint = $('singleJobHint');
        if (!hint)
            return;
        const expected = digits(document.querySelector('.field-row[data-key="pagu"] .field-check')?.checked ? document.querySelector('.field-row[data-key="pagu"] [data-value="pagu"]')?.value : state.source?.pagu), total = state.singleJobs.reduce((a, j) => a + (Number(j.pagu) || 0), 0);
        hint.textContent = 'Total jenis pekerjaan ' + money(total) + ' / pagu paket ' + money(expected) + (total === Number(expected) ? ' — sesuai' : ' — harus sama');
        hint.classList.toggle('bad', total !== Number(expected));
    }
    function renderSingle() {
        const d = state.source;
        if (!d)
            return;
        const fieldOrder = ['nama_paket', 'spesifikasi', 'uraian', ...(state.category === 'Swakelola' ? [] : ['jenis_pengadaan', 'metode_pengadaan']), 'pdn', 'sumber_dana', 'pagu', 'waktu_pemilihan'];
        $('changeFields').innerHTML = fieldOrder.map(k => {
            let v = String(d[k] || '');
            const label = pretty[k] || k;
            const showValue = k === 'pagu' && v ? money(digits(v)) : (v ? safe(v) : 'Tidak tersedia di DETAILPSW');
            return (k === 'nama_paket' ? '<div class="field-section-label">Identitas dan uraian paket</div>' : k === 'jenis_pengadaan' ? '<div class="field-section-label">Pengadaan dan anggaran</div>' : '') + '<div class="field-row" data-key="' + k + '"><label class="check"><input type="checkbox" class="field-check" data-field="' + k + '">' + safe(label) + '</label><div class="old-value' + (!v ? ' empty' : '') + '">' + showValue + '</div><div class="input-wrap" hidden>' + singleControl(k, v) + '</div></div>';
        }).join('');
        $$('.field-check').forEach(x => x.addEventListener('change', () => {
            x.closest('.field-row').querySelector('.input-wrap').hidden = !x.checked;
            updateSingleJobTotal();
            countChange();
        }));
        updateSingleJobTotal();
        countChange();
    }
    function getChanges() {
        const changes = {};
        for (const checkbox of $$('.field-check:checked')) {
            const key = checkbox.dataset.field, root = checkbox.closest('.field-row');
            if (key === 'jenis_pengadaan') {
                const v = state.singleJobs.length === 1 ? state.singleJobs[0].jenis : 'Campuran';
                if (v !== String(state.source?.jenis_pengadaan || '') || state.singleJobs.length > 1)
                    changes[key] = v;
                continue;
            }
            const input = $$('input[type=radio][data-value="' + key + '"]').find(x => x.checked) || root.querySelector('[data-value]');
            if (!input)
                continue;
            let value = key === 'pagu' ? digits(input.value) : String(input.value || '').trim();
            if (state.category === 'Swakelola' && key === 'metode_pengadaan')
                value = 'Swakelola';
            if (key === 'waktu_pemilihan') {
                if (value && value !== monthPickerValue(state.source?.[key]))
                    changes[key] = monthText(value);
            }
            else if (value && value !== String(state.source?.[key] || ''))
                changes[key] = value;
        }
        return changes;
    }
    function getSingleExtras() {
        return document.querySelector('.field-row[data-key="jenis_pengadaan"] .field-check')?.checked ? { jenis_pekerjaan: state.singleJobs.map(j => ({ jenis: j.jenis, pagu: digits(j.pagu) })) } : {};
    }
    function countChange() {
        const n = Object.keys(getChanges()).length;
        $('changeCount').textContent = state.mode === 'PEMBATALAN' ? 'Periksa alasan pembatalan sebelum mengirim.' : state.mode === 'SATU_KE_SATU' ? (n ? n + ' bagian berubah dibanding data sekarang.' : 'Centang bagian yang ingin direvisi dan isi nilai barunya.') : (state.packages.length + ' rancangan paket. Periksa nilai dan surat sebelum dikirim.');
    }
    const option = (items, value) => items.map(x => '<option value="' + safe(x) + '"' + (String(x) === String(value) ? ' selected' : '') + '>' + safe(x) + '</option>').join('');
    function radioPack(i, key, value, vals) {
        return '<div class="pills">' + vals.map(v => '<label><input type="radio" name="p' + i + '-' + key + '" data-p="' + i + '" data-k="' + key + '" value="' + safe(v) + '"' + (value === v ? ' checked' : '') + '> ' + safe(v) + '</label>').join('') + '</div>';
    }
    function cardMarkup(p, i) {
        const sw = (p.jenis_rup || state.category) === 'Swakelola', origin = state.mode === 'SATU_KE_BANYAK' && i === 0, title = 'Paket ' + (i + 1), collapsed = !!p._collapsed;
        return '<article class="package-card ' + (sw ? 'swakelola' : 'penyedia') + '" data-pack="' + i + '"><div class="package-top"><div><strong>' + title + '</strong><small>' + (origin ? 'Acuan dari RUP ' + safe(state.source?.kode_rup || state.chosenCode) + ' · ' + (sw ? 'Swakelola' : 'Penyedia') + ' · tidak bisa dihapus' : 'Usulan ' + (sw ? 'Swakelola' : 'Penyedia') + ' · kode RUP baru belum tersedia') + '</small></div>' + '<div class="package-tools"><button type="button" class="mini-btn collapse-toggle" data-toggle="' + i + '" aria-expanded="' + (!collapsed) + '">' + (collapsed ? 'Buka rincian' : 'Ringkas') + '</button>' + (!origin && state.packages.length > (state.mode === 'SATU_KE_BANYAK' ? 2 : 1) ? '<button type="button" class="mini-btn remove-package" data-remove="' + i + '">Hapus paket</button>' : '') + '</div></div>' + '<div class="package-compact"' + (!collapsed ? ' hidden' : '') + '>' + safe(p.nama_paket || 'Nama paket belum diisi') + ' · ' + money(p.pagu) + '</div><div class="package-body"' + (collapsed ? ' hidden' : '') + '>' +
            '<div class="package-group"><h3>Identitas paket, spesifikasi, dan uraian</h3><div class="package-fields two">' + ((state.mode === 'PAKET_BARU') ? '<label class="package-wide">Jenis RUP untuk paket ini<select data-p="' + i + '" data-k="jenis_rup">' + option(['Penyedia', 'Swakelola'], p.jenis_rup) + '</select></label>' : origin ? '<div class="package-wide origin-reminder">Jenis paket asal: <b>' + safe(state.category) + '</b>. Data usulan masih bisa disesuaikan, tetapi paket ini tidak bisa dihapus.</div>' : '') + '<label class="package-wide">Nama Paket<input data-p="' + i + '" data-k="nama_paket" value="' + safe(p.nama_paket) + '" placeholder="Nama paket yang akan diumumkan" maxlength="400"></label><label class="package-wide">Spesifikasi Pekerjaan' + (sw ? '<select data-p="' + i + '" data-k="spesifikasi">' + option(swTypes, p.spesifikasi) + '</select>' : '<textarea data-p="' + i + '" data-k="spesifikasi" rows="3" placeholder="Jelaskan spesifikasi yang dibutuhkan">' + safe(p.spesifikasi) + '</textarea>') + '</label><label class="package-wide">Uraian Pekerjaan<textarea class="detail-uraian" data-p="' + i + '" data-k="uraian" rows="7" placeholder="Jelaskan uraian pekerjaan secara rinci">' + safe(p.uraian) + '</textarea></label></div></div>' +
            '<div class="package-group"><h3>Cara pengadaan dan pagu</h3><div class="package-fields two"><label>Pagu Paket (Rp)>' + moneyInput('data-p="' + i + '" data-k="pagu"', p.pagu, 'Isi pagu') + '</label><label>Sumber Dana<input data-p="' + i + '" data-k="sumber_dana" value="' + safe(p.sumber_dana) + '" placeholder="Contoh: APBD"></label>' +
            (sw ? '<label>Metode Pengadaan<input value="Swakelola" readonly tabindex="-1"></label><label>Produk Dalam Negeri' + radioPack(i, 'pdn', p.pdn, ['Ya', 'Tidak']) + '</label>' :
                '<label>Produk Dalam Negeri' + radioPack(i, 'pdn', p.pdn, ['Ya', 'Tidak']) + '</label><label>Usaha Kecil / Koperasi' + radioPack(i, 'usaha_kecil', p.usaha_kecil, ['Ya', 'Tidak']) + '</label><label>Rencana Metode Pemilihan<select data-p="' + i + '" data-k="metode_pengadaan">' + option([...methods, 'Dikecualikan'], p.metode_pengadaan) + '</select></label>') + '</div></div>' +
            (!sw ? '<div class="package-group"><h3>Jenis Pekerjaan</h3><div class="jobs">' + p.jenis_pekerjaan.map((j, k) => '<div class="job-row"><select data-p="' + i + '" data-job="' + k + '" data-jkey="jenis">' + option(types, j.jenis) + '</select>' + moneyInput('data-p="' + i + '" data-job="' + k + '" data-jkey="pagu"', j.pagu, 'Pagu jenis pekerjaan') + '<button type="button" class="mini-btn" data-delete-job="' + i + ':' + k + '" ' + (p.jenis_pekerjaan.length === 1 ? 'disabled' : '') + '>Hapus</button></div>').join('') + '</div><div class="job-hint" data-job-hint="' + i + '">Total jenis pekerjaan harus sama dengan pagu paket.</div><button type="button" class="mini-btn" data-add-job="' + i + '">+ Tambah jenis pekerjaan</button></div><div class="package-group"><h3>Pengadaan Berkelanjutan (SPP)</h3><div class="pills">' + ['Ekonomi', 'Sosial', 'Lingkungan'].map(v => '<label><input type="checkbox" data-p="' + i + '" data-spp="' + v + '" ' + (p.spp.includes(v) ? 'checked' : '') + '> Aspek ' + v + '</label>').join('') + '</div></div>' : '') +
            '<div class="package-group"><h3>Rencana jadwal (jika diketahui)</h3><div class="package-fields"><label>Bulan dan tahun pemilihan<input type="month" data-p="' + i + '" data-k="waktu_pemilihan" value="' + safe(typeof monthPickerValue === 'function' ? monthPickerValue(p.waktu_pemilihan) : '') + '"></label></div><div class="package-fields two">' + [['Pemanfaatan Barang/Jasa', 'pemanfaatan'], ['Pelaksanaan Kontrak', 'pelaksanaan'], ['Pemilihan Penyedia', 'pemilihan']].filter(x => !sw || x[1] !== 'pemilihan').map(([label, key]) => '<div><span class="muted">' + label + '</span><div class="package-fields two"><label>Awal<input type="month" data-p="' + i + '" data-k="' + key + '_awal" value="' + safe(p[key + '_awal'] || '') + '"></label><label>Akhir<input type="month" data-p="' + i + '" data-k="' + key + '_akhir" value="' + safe(p[key + '_akhir'] || '') + '"></label></div></div>').join('') + '</div></div></div></article>';
    }
    function renderPackages() {
        const need = state.mode === 'SATU_KE_BANYAK' ? 2 : 1;
        if (state.packages.length < need) {
            while (state.packages.length < need)
                state.packages.push(emptyPackage());
        }
        $('packageSummary').textContent = state.mode === 'SATU_KE_BANYAK' ? 'Paket hasil pemecahan · tetap ' + state.category : 'Rancangan paket baru · bisa campur Penyedia dan Swakelola';
        $('addPackage').hidden = state.mode !== 'SATU_KE_BANYAK';
        $('addPackage').textContent = '+ Paket ' + state.category;
        $('addProvider').hidden = state.mode === 'SATU_KE_BANYAK';
        $('addSwakelola').hidden = state.mode === 'SATU_KE_BANYAK';
        $('packageCards').innerHTML = state.packages.map(cardMarkup).join('');
        updatePackageTotal();
        countChange();
        renderBudget();
    }
    function updatePackageTotal() {
        const t = state.packages.reduce((n, p) => n + (Number(p.pagu) || 0), 0), old = Number(state.source?.pagu || 0);
        let str = state.packages.length + ' paket · total usulan ' + money(t), cl = 'package-total';
        if (state.mode === 'SATU_KE_BANYAK' && old) {
            str += ' · pagu RUP asal ' + money(old);
            if (t !== old) {
                str += ' · selisih ' + money(t - old);
                cl += ' warn';
            }
            else
                cl += ' ok';
        }
        else
            cl += t > 0 ? ' ok' : ' warn';
        $('packageTotal').className = cl;
        $('packageTotal').textContent = str;
        state.packages.forEach((p, i) => {
            const h = document.querySelector('[data-job-hint="' + i + '"]');
            if (!h)
                return;
            const jobSum = p.jenis_pekerjaan.reduce((n, j) => n + (Number(j.pagu) || 0), 0);
            h.classList.toggle('bad', jobSum !== Number(p.pagu));
            h.textContent = 'Jumlah jenis pekerjaan ' + money(jobSum) + ' / pagu paket ' + money(p.pagu) + (jobSum !== Number(p.pagu) ? ' — harus sama' : ' — sesuai');
        });
    }
    function setModal(title, body, actions = [], caption = 'PERMOHONAN SIRUP') {
        $('modalTitle').textContent = title;
        $('modalCaption').textContent = caption;
        $('modalBody').innerHTML = body;
        $('modalFoot').innerHTML = '';
        for (const a of actions) {
            const b = document.createElement('button');
            b.className = 'button ' + (a.className || 'outline');
            b.textContent = a.label;
            b.addEventListener('click', a.onClick);
            $('modalFoot').appendChild(b);
        }
        document.body.style.overflow = 'hidden';
        $('modal').hidden = false;
    }
    function closeModal() {
        $('modal').hidden = true;
        document.body.style.overflow = '';
    }
    function showConfirm(title, text, callback) {
        setModal(title, '<p class="statusline">' + safe(text) + '</p>', [{ label: 'Batal', onClick: closeModal }, {
            label: 'Lanjutkan', className: 'primary', onClick: () => {
                closeModal();
                callback();
            }
        }]);
    }
    function parseFile(file) {
        return new Promise((resolve, reject) => {
            const fr = new FileReader();
            fr.onload = () => resolve(String(fr.result).split(',')[1] || '');
            fr.onerror = () => reject(Error('Surat PDF tidak terbaca.'));
            fr.readAsDataURL(file);
        });
    }
    function validateEntry() {
        if (!state.office)
            throw Error('Pilih satuan kerja dahulu.');
        if (state.mode === 'PAKET_BARU' && !state.structure.sub_kegiatan)
            throw Error('Pilih program, kegiatan, dan subkegiatan.');
        if (state.mode !== 'PAKET_BARU' && !state.source)
            throw Error('Pilih kode RUP asal dahulu.');
        const changes = state.mode === 'SATU_KE_SATU' ? getChanges() : {};
        if (state.mode === 'SATU_KE_SATU' && !Object.keys(changes).length)
            throw Error('Pilih minimal satu kolom dan isi perubahan.');
        if (state.mode === 'PEMBATALAN' && !$('cancelReason').value.trim())
            throw Error('Isi alasan pembatalan paket.');
        if (state.mode === 'SATU_KE_SATU' && changes.jenis_pengadaan) {
            const total = state.singleJobs.reduce((n, j) => n + Number(j.pagu || 0), 0), target = Number(changes.pagu || digits(state.source.pagu));
            if (state.singleJobs.length < 1 || state.singleJobs.length > 8 || state.singleJobs.some(j => !types.includes(j.jenis) || !Number.isSafeInteger(Number(j.pagu)) || Number(j.pagu) <= 0) || total !== target)
                throw Error('Jumlah pagu per jenis pekerjaan harus sama dengan pagu paket.');
        }
        if (state.mode === 'PAKET_BARU' || state.mode === 'SATU_KE_BANYAK') {
            if (state.mode === 'SATU_KE_BANYAK' && state.packages.some(p => p.jenis_rup !== state.category))
                throw Error('Semua paket hasil pemecahan harus mengikuti jenis RUP asal: ' + state.category + '.');
            const min = state.mode === 'SATU_KE_BANYAK' ? 2 : 1;
            if (state.packages.length < min || state.packages.length > 8)
                throw Error('Isi ' + min + ' sampai 8 paket.');
            for (const [i, p] of state.packages.entries()) {
                if (!p.nama_paket.trim() || !Number.isSafeInteger(Number(p.pagu)) || Number(p.pagu) <= 0)
                    throw Error('Nama atau pagu paket ' + (i + 1) + ' belum sesuai.');
                if (p.jenis_rup === 'Penyedia' && p.jenis_pekerjaan.reduce((sum, j) => sum + Number(j.pagu || 0), 0) !== Number(p.pagu))
                    throw Error('Jumlah pagu jenis pekerjaan tidak sama dengan pagu paket ' + (i + 1) + '.');
                if (p.jenis_rup === 'Swakelola' && !swTypes.includes(p.spesifikasi))
                    throw Error('Pilih tipe Swakelola paket ' + (i + 1) + '.');
            }
        }
        return { satker: state.office, jenisPengajuan: state.mode, jenisRup: state.category, kodeRup: state.source?.kode_rup || '', perubahan: changes, detailTambahan: state.mode === 'SATU_KE_SATU' ? getSingleExtras() : {}, paketBaru: ['PAKET_BARU', 'SATU_KE_BANYAK'].includes(state.mode) ? state.packages.map(({ _collapsed, ...pkg }) => ({ ...pkg })) : [], struktur: { ...state.structure }, alasanPembatalan: state.mode === 'PEMBATALAN' ? $('cancelReason').value.trim() : '', _before: state.source ? { ...state.source } : null };
    }
    function requestLabel(item) {
        const mode = modeTitle[item.jenisPengajuan] || item.jenisPengajuan;
        const title = item.jenisPengajuan === 'PAKET_BARU' ? ((item.paketBaru || []).length + ' paket baru') : item._before?.nama_paket || item.kodeRup;
        return { mode, title };
    }
    function renderBatch() {
        const n = state.items.length;
        $('batchCount').textContent = n;
        $('batchList').innerHTML = n ? state.items.map((item, i) => {
            const o = requestLabel(item);
            return '<div class="batch-item"><div class="batch-no">' + (i + 1) + '</div><div class="batch-info"><b>' + safe(o.mode) + '</b><small>' + safe(o.title) + '</small>' + (item.kodeRup ? '<small>RUP ' + safe(item.kodeRup) + '</small>' : '') + '</div><div class="batch-actions"><button type="button" class="mini-btn" data-batch-edit="' + i + '">Ubah</button><button type="button" class="mini-btn remove-package" data-batch-remove="' + i + '">Hapus</button></div></div>';
        }).join('') : '<p class="muted">Belum ada usulan. Isi rincian di atas, lalu klik “Masukkan usulan ini ke surat”.</p>';
        $('batchPanel').classList.toggle('has-items', n > 0);
        $('letterPanel').hidden = !n && $('editPanel').hidden && !state.letterUpload;
        $('letterHelp').textContent = n ? 'Satu surat PDF untuk ' + n + ' usulan dalam daftar ini. Maksimal 5 MB.' : 'Surat PDF wajib dilampirkan saat mengirim. Maksimal 5 MB.';
        $('stageRequest').textContent = state.editingIndex >= 0 ? 'Simpan perubahan usulan' : '+ Masukkan usulan ini ke surat';
        if (n) {
            $('changeCount').textContent = n + ' usulan siap dikirim bersama satu surat PDF.';
        }
        renderBudget();
    }
    function currentBudgetPreview() {
        if ($('editPanel').hidden)
            return null;
        const mode = state.mode, source = state.source || null;
        if (mode !== 'PAKET_BARU' && !source)
            return null;
        if (mode === 'SATU_KE_SATU') {
            const c = getChanges();
            if (!Object.keys(c).length)
                return null;
            return { jenisPengajuan: mode, jenisRup: state.category, kodeRup: source.kode_rup, perubahan: c, _before: source };
        }
        if (mode === 'PEMBATALAN')
            return { jenisPengajuan: mode, jenisRup: state.category, kodeRup: source.kode_rup, _before: source };
        if (['PAKET_BARU', 'SATU_KE_BANYAK'].includes(mode))
            return { jenisPengajuan: mode, jenisRup: state.category, kodeRup: source?.kode_rup || '', paketBaru: state.packages, _before: source };
        return null;
    }
    function budgetEntries() {
        const entries = state.items.slice(), preview = currentBudgetPreview();
        if (preview) {
            if (state.editingIndex >= 0 && state.editingIndex < entries.length)
                entries[state.editingIndex] = preview;
            else
                entries.push(preview);
        }
        return entries;
    }
    function budgetDelta(items) {
        const d = { Penyedia: 0, Swakelola: 0 };
        for (const x of items) {
            const kind = x.jenisRup === 'Swakelola' ? 'Swakelola' : 'Penyedia', old = Number(digits(x._before?.pagu) || 0), mode = x.jenisPengajuan;
            if (mode === 'SATU_KE_SATU') {
                if (x.perubahan && Object.prototype.hasOwnProperty.call(x.perubahan, 'pagu'))
                    d[kind] += Number(digits(x.perubahan.pagu)) - old;
            }
            else if (mode === 'PEMBATALAN')
                d[kind] -= old;
            else if (mode === 'SATU_KE_BANYAK') {
                d[kind] -= old;
                for (const p of x.paketBaru || [])
                    d[kind] += Number(digits(p.pagu) || 0);
            }
            else if (mode === 'PAKET_BARU') {
                for (const p of x.paketBaru || [])
                    d[p.jenis_rup === 'Swakelola' ? 'Swakelola' : 'Penyedia'] += Number(digits(p.pagu) || 0);
            }
        }
        return d;
    }
    function budgetView() {
        if (!state.rupTotals)
            return null;
        const base = { Penyedia: Number(state.rupTotals.penyedia || 0), Swakelola: Number(state.rupTotals.swakelola || 0) }, delta = budgetDelta(budgetEntries()), after = { Penyedia: base.Penyedia + delta.Penyedia, Swakelola: base.Swakelola + delta.Swakelola };
        const plan = state.budget || null, target = plan?.complete ? { Penyedia: Number(plan.totals.penyedia || 0) + Number(plan.totals.dikecualikan || 0), Swakelola: Number(plan.totals.swakelola || 0) } : null;
        const beforeAligned = !!target && Object.keys(base).every(k => base[k] === target[k]);
        const worse = !!target && Object.keys(base).some(k => Math.abs(after[k] - target[k]) > Math.abs(base[k] - target[k]));
        const blocked = !!target && (beforeAligned || worse) && Object.keys(base).some(k => after[k] !== target[k]);
        return { base, after, delta, plan, target, beforeAligned, blocked };
    }
    function renderBudget() {
        const panel = $('budgetCheck');
        if (!panel)
            return;
        panel.hidden = !state.office || !budgetEntries().length;
        if (panel.hidden)
            return;
        const v = budgetView(), text = $('budgetCheckMessage'), stats = $('budgetCheckStats');
        if (!v) {
            text.textContent = 'Rekap RUP belum selesai dimuat. Periksa lagi sebelum mengirim.';
            stats.innerHTML = '';
            panel.dataset.level = 'pending';
            return;
        }
        const delta = Object.values(v.delta).reduce((a, b) => a + b, 0), total = v.after.Penyedia + v.after.Swakelola;
        if (!v.plan) {
            text.textContent = 'Memeriksa alokasi Pagu Pengadaan yang sudah diverifikasi Admin…';
            stats.innerHTML = '<span>Total usulan: ' + money(total) + '</span>';
            panel.dataset.level = 'pending';
            return;
        }
        const plan = v.plan;
        stats.innerHTML = '<span>RUP setelah usulan: <b>' + money(total) + '</b></span><span>Perubahan: <b>' + (delta < 0 ? '−' : delta > 0 ? '+' : '') + money(Math.abs(delta)) + '</b></span>' + (v.target ? '<span>Pagu terverifikasi: <b>' + money(v.target.Penyedia + v.target.Swakelola) + '</b></span><span>Selisih Penyedia: <b>' + money(v.target.Penyedia - v.after.Penyedia) + '</b></span><span>Selisih Swakelola: <b>' + money(v.target.Swakelola - v.after.Swakelola) + '</b></span>' : '');
        if (!plan.available) {
            text.textContent = 'Data Pagu Pengadaan belum tersedia. Admin perlu mencocokkan usulan dengan rincian SIPD.';
            panel.dataset.level = 'pending';
        }
        else if (!plan.complete) {
            text.textContent = 'Baru ' + plan.verified + ' dari ' + plan.rows + ' rincian Pagu Pengadaan yang diverifikasi Admin. Total RUP dihitung, tetapi belum bisa dinyatakan sesuai 100%.';
            panel.dataset.level = 'pending';
        }
        else if (v.blocked) {
            const differences = Object.keys(v.target).filter(k => v.after[k] !== v.target[k]).map(k => {
                const rem = v.target[k] - v.after[k];
                return k + ' ' + (rem > 0 ? 'kurang ' : 'lebih ') + money(Math.abs(rem));
            });
            text.textContent = 'Pagu belum sesuai: ' + differences.join('; ') + '. Masukkan perubahan dan/atau paket baru dalam surat yang sama sampai kembali sesuai.';
            panel.dataset.level = 'error';
        }
        else if (v.beforeAligned && Object.keys(v.target).every(k => v.after[k] === v.target[k])) {
            text.textContent = 'Sesuai. Total Penyedia dan Swakelola setelah usulan tetap sama dengan pagu yang diverifikasi Admin.';
            panel.dataset.level = 'ok';
        }
        else {
            text.textContent = 'RUP awal belum sama dengan alokasi terverifikasi. Perubahan ini tidak menambah selisih, tetapi perlu pemeriksaan Admin.';
            panel.dataset.level = 'pending';
        }
    }
    async function loadBudget(force = false) {
        if (!state.office)
            return;
        const office = state.office;
        if (!force && state.budgetOffice === office && state.budget)
            return state.budget;
        if (!force && state.budgetPending && state.budgetPendingOffice === office)
            return state.budgetPending;
        const task = api('permohonanSirupBudget', { satker: office, year: new Date().getFullYear() }, 95000).then(r => {
            if (state.office === office) {
                state.budget = r;
                state.budgetOffice = office;
                renderBudget();
            }
            return r;
        }).catch(e => {
            if (state.office === office) {
                state.budget = { available: false, complete: false, reason: e.message };
                renderBudget();
                msg('Pagu Pengadaan belum bisa diperiksa: ' + e.message, 'error');
            }
            return null;
        }).finally(() => {
            if (state.budgetPending === task)
                state.budgetPending = null;
        });
        state.budgetPending = task;
        state.budgetPendingOffice = office;
        return task;
    }
    function assertBudgetReady() {
        const v = budgetView();
        if (!v?.plan)
            throw Error('Pemeriksaan pagu belum selesai. Coba lagi setelah data Pagu Pengadaan terbaca.');
        if (v.blocked)
            throw Error('Masih ada selisih dengan Pagu Pengadaan terverifikasi. Lengkapi usulan terlebih dahulu agar pagu kembali 100%.');
    }
    function stageCurrent() {
        const item = validateEntry(), existing = state.items.findIndex((x, i) => i !== state.editingIndex && item.kodeRup && x.kodeRup === item.kodeRup);
        if (existing >= 0)
            throw Error('Kode RUP yang sama sudah ada dalam daftar. Ubah usulan tersebut saja.');
        if (state.editingIndex >= 0)
            state.items[state.editingIndex] = item;
        else {
            if (state.items.length >= 15)
                throw Error('Maksimal 15 usulan dalam satu surat.');
            state.items.push(item);
        }
        state.editingIndex = -1;
        resetEditor();
        renderBatch();
        loadBudget();
        msg(state.items.length + ' usulan sudah masuk daftar surat. Tambahkan usulan lain atau lampirkan PDF untuk mengirim.', 'success');
        $('batchPanel').scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
    async function editBatch(index) {
        const item = state.items[index];
        if (!item)
            return;
        state.editingIndex = index;
        state.mode = item.jenisPengajuan;
        state.category = item.jenisRup;
        state.structure = { ...item.struktur };
        resetEditor();
        updateMode();
        if (item.jenisPengajuan === 'PAKET_BARU') {
            await loadHierarchy();
            state.packages = item.paketBaru.map(x => ({ ...x, _collapsed: !!x._collapsed }));
            maybeShowEditor();
        }
        else {
            state.source = item._before || null;
            state.chosenCode = item.kodeRup;
            await searchRup();
            $('rupChoice').value = item.kodeRup;
            if (!state.source) {
                const out = await api('permohonanSirupRup', { satker: state.office, kodeRup: item.kodeRup, jenisRup: item.jenisRup });
                state.source = out.data;
            }
            if (item.jenisPengajuan === 'SATU_KE_BANYAK')
                state.packages = item.paketBaru.map(x => ({ ...x, jenis_rup: state.category }));
            else if (item.jenisPengajuan === 'SATU_KE_SATU')
                state.singleJobs = (item.detailTambahan?.jenis_pekerjaan || []).map(x => ({ ...x }));
            maybeShowEditor();
            if (item.jenisPengajuan === 'PEMBATALAN')
                $('cancelReason').value = item.alasanPembatalan || '';
            if (item.jenisPengajuan === 'SATU_KE_SATU')
                restoreChangeFields(item.perubahan || {});
        }
        renderBatch();
        $('editPanel').scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    function restoreChangeFields(changes) {
        for (const [key, val] of Object.entries(changes)) {
            const row = document.querySelector('.field-row[data-key="' + key + '"]');
            if (!row)
                continue;
            const ch = row.querySelector('.field-check');
            if (!ch)
                continue;
            ch.checked = true;
            row.querySelector('.input-wrap').hidden = false;
            if (key === 'jenis_pengadaan') {
                renderSingleJobs();
                continue;
            }
            let el = row.querySelector('[data-value="' + key + '"]');
            if (el?.type === 'radio')
                el = Array.from(row.querySelectorAll('input[type="radio"]')).find(x => x.value === val);
            if (el) {
                if (el.type === 'radio')
                    el.checked = true;
                else
                    el.value = key === 'pagu' ? grouped(val) : key === 'waktu_pemilihan' ? monthPickerValue(val) : val;
            }
        }
        updateSingleJobTotal();
        countChange();
    }
    // Transfer langsung ke Google Drive dengan progres byte yang benar (sama seperti Permohonan Pemilihan).
    function uploadDisplay(mode, text, name = '', progress = null, note = '') {
        const btn = $('letterPick'), label = $('letterName'), hint = $('letterUploadNote'), meter = $('letterProgress'), meterBar = $('letterProgressBar');
        btn.classList.toggle('uploading', mode === 'uploading');
        btn.classList.toggle('ready', mode === 'ready');
        btn.classList.toggle('failed', mode === 'failed');
        btn.disabled = mode === 'uploading';
        if (progress != null) {
            const percent = Math.max(0, Math.min(100, Math.round(progress)));
            btn.style.setProperty('--upload-progress', percent + '%');
            meterBar.style.width = percent + '%';
            meter.setAttribute('aria-valuenow', String(percent));
        }
        else {
            btn.style.removeProperty('--upload-progress');
            meter.removeAttribute('aria-valuenow');
            meterBar.style.width = '0%';
        }
        meter.hidden = mode !== 'uploading' || progress == null;
        btn.textContent = text;
        label.textContent = name || 'Belum ada surat dipilih';
        hint.hidden = !note;
        hint.textContent = note;
        hint.classList.toggle('error', mode === 'failed');
        $('submitRequest').disabled = mode === 'uploading';
        $('letterCancel').hidden = !(mode === 'ready' || mode === 'uploading' || mode === 'failed');
        $('letterCancel').disabled = mode === 'uploading';
    }
    function releaseLetter(upload, beacon = false) {
        if (!upload?.ready || !upload.driveFileId || !upload.ticket)
            return;
        const token = sessionStorage.getItem(TOKEN), payload = { action: 'permohonanSirupReleaseLetter', token, suratTicket: upload.ticket, suratDriveFileId: upload.driveFileId, satker: upload.office };
        if (beacon) {
            try {
                if (navigator.sendBeacon && API) {
                    navigator.sendBeacon(API, new Blob([JSON.stringify(payload)], { type: 'text/plain;charset=UTF-8' }));
                    return;
                }
            }
            catch (_) { }
            return;
        }
        api('permohonanSirupReleaseLetter', payload, 30000).catch(() => { });
    }
    function clearLetterUpload(removeDrive = false) {
        const previous = state.letterUpload;
        state.letterUploadSeq++;
        state.letterUpload = null;
        $('letterFile').value = '';
        uploadDisplay('idle', 'Pilih surat PDF');
        if (removeDrive)
            releaseLetter(previous);
    }
    async function uploadLetter(file) {
        const previous = state.letterUpload?.ready ? state.letterUpload : null;
        const seq = ++state.letterUploadSeq, office = state.office;
        state.letterUpload = { file, office, loading: true, ready: false, ticket: '', driveFileId: '', at: 0 };
        if (!office) {
            state.letterUpload = previous;
            uploadDisplay('failed', 'Pilih ulang', file?.name, '', 'Pilih satuan kerja terlebih dahulu.');
            return;
        }
        try {
            if (!file || !(/\.pdf$/i.test(file.name)) || file.size <= 0 || file.size > 5 * 1024 * 1024)
                throw Error('Gunakan surat PDF maksimal 5 MB.');
            const sig = new Uint8Array(await file.slice(0, 5).arrayBuffer());
            if (String.fromCharCode(...sig) !== '%PDF-')
                throw Error('Berkas yang dipilih bukan PDF yang valid.');
            const client = window.TRAXPBJ_SELECTION_API;
            if (!client?.directUpload)
                throw Error('Layanan unggah ORBITA belum tersedia.');
            uploadDisplay('uploading', 'Menyiapkan…', file.name, null, 'Membuka sesi upload Google Drive.');
            const uploaded = await client.directUpload(file, {
                purpose: 'SIRUP_LETTER', requestId: office, maxBytes: 5 * 1024 * 1024,
                onProgress: pct => {
                    if (state.letterUploadSeq !== seq)
                        return;
                    uploadDisplay('uploading', 'Mengunggah ' + pct + '%', file.name, pct, 'Surat sedang diunggah ke Google Drive.');
                },
                onState: stage => {
                    if (state.letterUploadSeq !== seq)
                        return;
                    const words = { starting: 'Menyiapkan…', checking: 'Memeriksa upload…', resuming: 'Melanjutkan…', restarting: 'Menghubungkan ulang…' };
                    if (words[stage])
                        uploadDisplay('uploading', words[stage], file.name, null, 'Koneksi upload sedang diperiksa.');
                }
            });
            if (state.letterUploadSeq !== seq || state.office !== office) {
                releaseLetter({ ready: true, office, driveFileId: uploaded?.drive?.id, ticket: uploaded?.ticket });
                return;
            }
            if (!uploaded?.ticket || !uploaded?.drive?.id)
                throw Error('File belum mendapat konfirmasi dari Google Drive.');
            state.letterUpload = { file, office, loading: false, ready: true, ticket: uploaded.ticket, driveFileId: uploaded.drive.id, at: Date.now() };
            uploadDisplay('ready', 'Ganti surat PDF', file.name, 100, 'Surat berhasil diunggah dan siap dikirim bersama permohonan.');
            if (previous && previous.driveFileId !== uploaded.drive.id)
                releaseLetter(previous);
        }
        catch (err) {
            if (state.letterUploadSeq !== seq)
                return;
            state.letterUpload = previous || { file, office, loading: false, ready: false, error: err.message };
            $('letterFile').value = '';
            if (previous)
                uploadDisplay('ready', 'Ganti surat PDF', previous.file.name, 100, 'Surat lama masih tersimpan. File pengganti gagal diunggah: ' + err.message);
            else
                uploadDisplay('failed', 'Upload ulang', file?.name || '', null, err.message || 'Gagal mengunggah surat.');
            msg(err.message || 'Upload surat gagal.', 'error');
        }
    }
    function notificationEmail(required) {
        const value = $('requestEmail').value.trim();
        if (required && !value) {
            $('requestEmail').focus();
            throw Error('Isi email untuk pemberitahuan terlebih dahulu.');
        }
        if (value && (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) || value.length > 254)) {
            $('requestEmail').focus();
            throw Error('Alamat email pemberitahuan tidak valid.');
        }
        return value;
    }
    async function submitNow() {
        if (state.items.length) {
            await loadBudget();
            assertBudgetReady();
        }
        let payload;
        if (state.items.length) {
            if (state.editingIndex >= 0)
                throw Error('Simpan dulu perubahan usulan yang sedang diedit.');
            if (!$('editPanel').hidden)
                throw Error('Masukkan dulu usulan yang sedang diisi ke daftar surat.');
            payload = { satker: state.office, jenisPengajuan: 'GABUNGAN', items: state.items.map(({ _before, ...entry }) => entry) };
        }
        else
            payload = validateEntry();
        let upload = state.letterUpload;
        if (upload?.loading)
            throw Error('Upload surat masih berlangsung. Selesaikan terlebih dahulu.');
        if (!upload?.ready || upload.office !== state.office || !upload.driveFileId || !upload.ticket)
            throw Error('Unggah surat PDF terlebih dahulu sampai muncul keterangan siap dikirim.');
        // Tiket sesi Google Drive berlaku 30 menit. Jika form terlalu lama dibuka, upload ulang tanpa membaca spreadsheet.
        if (Date.now() - upload.at > 25 * 60 * 1000) {
            await uploadLetter(upload.file);
            upload = state.letterUpload;
            if (!upload?.ready)
                throw Error('Upload ulang surat belum berhasil.');
        }
        busy(true, 'Mengirim permohonan…', 'Menyimpan usulan dan menautkan surat yang sudah diunggah.');
        try {
            const r = await api('permohonanSirupCreate', { ...payload, emailPemohon: notificationEmail(true), tahun: new Date().getFullYear(), suratNama: upload.file.name, suratTicket: upload.ticket, suratDriveFileId: upload.driveFileId, keterangan: $('requestNote').value, draftId: state.draftId }, 100000);
            msg('Surat ' + r.id + ' sudah dikirim ke Admin.', 'success');
            $('requestEmail').value = '';
            state.items = [];
            state.editingIndex = -1;
            state.draftId = '';
            resetEditor();
            renderBatch();
            clearLetterUpload(false);
            upsertRequest(r);
            tab('riwayat');
        }
        finally {
            busy(false);
        }
    }
    function draftPayload() {
        if (state.items.length) {
            if (state.editingIndex >= 0 || !$('editPanel').hidden)
                throw Error('Simpan dulu usulan yang sedang diedit/diisi ke daftar surat.');
            return { satker: state.office, jenisPengajuan: 'GABUNGAN', items: state.items.map(({ _before, ...entry }) => entry), keterangan: $('requestNote').value, emailPemohon: notificationEmail(false), draftId: state.draftId };
        }
        if (!state.office)
            throw Error('Pilih satuan kerja dahulu.');
        if (state.mode === 'PAKET_BARU' && !state.structure.sub_kegiatan)
            throw Error('Pilih program, kegiatan, dan subkegiatan dahulu.');
        if (state.mode !== 'PAKET_BARU' && !state.source)
            throw Error('Pilih kode RUP dahulu.');
        return { satker: state.office, jenisPengajuan: state.mode, jenisRup: state.category, kodeRup: state.source?.kode_rup || '', perubahan: state.mode === 'SATU_KE_SATU' ? getChanges() : {}, detailTambahan: state.mode === 'SATU_KE_SATU' ? getSingleExtras() : {}, paketBaru: state.mode === 'SATU_KE_SATU' || state.mode === 'PEMBATALAN' ? [] : state.packages.map(({ _collapsed, ...pkg }) => pkg), struktur: state.structure, alasanPembatalan: state.mode === 'PEMBATALAN' ? $('cancelReason').value : '', keterangan: $('requestNote').value, emailPemohon: notificationEmail(false), draftId: state.draftId };
    }
    function upsertRequest(r) {
        const summary = { id: r.id, createdAt: r.createdAt || new Date().toISOString(), year: r.year || new Date().getFullYear(), satker: r.satker || state.office, kodeRup: r.kodeRup || 'BELUM ADA', jenisRup: r.jenisRup || state.category, namaPaket: r.namaPaket || 'Rancangan paket baru', status: r.status, userName: r.userName || state.user?.nama || '' };
        state.allRecords = [summary, ...state.allRecords.filter(x => x.id !== r.id)];
        $('totalRequest').textContent = state.allRecords.length.toLocaleString('id-ID');
        $('numPending').textContent = state.allRecords.filter(x => !['SELESAI', 'DITOLAK', 'DRAF'].includes(x.status)).length + ' pengajuan berjalan';
        renderHistory();
    }
    async function saveDraft() {
        const body = draftPayload();
        busy(true, 'Menyimpan draft…', 'Menyimpan rancangan ke database Permohonan SiRUP.');
        try {
            const r = await api('permohonanSirupDraft', body, 60000);
            state.draftId = r.id;
            upsertRequest(r);
            msg('Draft ' + r.id + ' tersimpan. Bisa dilanjutkan dari Riwayat Pengajuan.', 'success');
        }
        finally {
            busy(false);
        }
    }
    async function resumeDraft(id) {
        clearLetterUpload(true);
        busy(true, 'Membuka draft…', 'Mengambil rancangan yang tersimpan.');
        try {
            const r = await api('permohonanSirupGet', { id });
            if (r.status !== 'DRAF')
                throw Error('Permohonan ini sudah dikirim atau tidak dapat diedit.');
            if (state.admin && state.office !== r.satker) {
                state.office = r.satker;
                await init(true);
            }
            const wanted = r.requested || {};
            state.restoring = true;
            try {
                resetEditor();
                if (wanted._mode === 'GABUNGAN') {
                    state.items = (wanted._items || []).map(x => ({ ...x.entry, _before: x.before || null }));
                    state.mode = 'SATU_KE_SATU';
                    state.category = 'Penyedia';
                    state.editingIndex = -1;
                    state.draftId = r.id;
                    updateMode();
                    renderBatch();
                    $('requestNote').value = r.catatan || '';
                    $('requestEmail').value = r.emailPemohon || '';
                    tab('ajukan');
                    $('batchPanel').scrollIntoView({ behavior: 'smooth', block: 'start' });
                    msg('Draft ' + r.id + ' siap dilanjutkan. Lampirkan surat saat mengirim.', 'success');
                    return;
                }
                state.mode = wanted._mode || 'PAKET_BARU';
                state.category = wanted._category || 'Penyedia';
                state.structure = { program: '', kegiatan: '', sub_kegiatan: '', ...(wanted._struktur || {}) };
                updateMode();
                if (state.mode === 'PAKET_BARU') {
                    await loadHierarchy();
                    renderStructure();
                    state.packages = (wanted._packages || []).map(x => ({ ...x, _collapsed: !!x._collapsed, jenis_rup: x.jenis_rup || state.category }));
                    maybeShowEditor();
                }
                else {
                    state.source = r.before || null;
                    state.chosenCode = r.kodeRup;
                    await searchRup();
                    $('rupChoice').value = state.chosenCode;
                    if (state.mode === 'SATU_KE_BANYAK') {
                        state.packages = (wanted._packages || []).map(x => ({ ...x, _collapsed: !!x._collapsed, jenis_rup: state.category }));
                    }
                    else {
                        state.singleJobs = (wanted._details?.jenis_pekerjaan || []).map(x => ({ ...x, pagu: digits(x.pagu) }));
                    }
                    maybeShowEditor();
                    if (state.mode === 'PEMBATALAN')
                        $('cancelReason').value = wanted.alasan || '';
                    if (state.mode === 'SATU_KE_SATU')
                        for (const [key, val] of Object.entries(wanted.changes || {})) {
                            const row = $('.unused') || document.querySelector('.field-row[data-key="' + key + '"]');
                            if (!row)
                                continue;
                            const ch = row.querySelector('.field-check');
                            if (!ch)
                                continue;
                            ch.checked = true;
                            row.querySelector('.input-wrap').hidden = false;
                            if (key === 'jenis_pengadaan') {
                                renderSingleJobs();
                                continue;
                            }
                            let el = row.querySelector('[data-value="' + key + '"]');
                            if (el?.type === 'radio')
                                el = Array.from(row.querySelectorAll('input[type="radio"]')).find(x => x.value === val);
                            if (el) {
                                if (el.type === 'radio')
                                    el.checked = true;
                                else
                                    el.value = key === 'pagu' ? grouped(val) : key === 'waktu_pemilihan' ? monthPickerValue(val) : val;
                            }
                        }
                }
                $('requestNote').value = r.catatan || '';
                $('requestEmail').value = r.emailPemohon || '';
                state.draftId = r.id;
                countChange();
                tab('ajukan');
                $('editPanel').scrollIntoView({ behavior: 'smooth', block: 'start' });
                msg('Draft ' + r.id + ' siap dilanjutkan. Lampirkan surat saat akan mengirim.', 'success');
            }
            finally {
                state.restoring = false;
            }
        }
        finally {
            busy(false);
        }
    }
    function renderHistory() {
        window.SirupWorkspace.renderSummary(state.allRecords, state.admin);
        const query = $('historySearch').value.trim().toLowerCase(), st = $('historyStatus').value, size = $('historyPageSize').value;
        const list = state.allRecords.filter(r => (!st || st === r.status) && (!query || (r.kodeRup + ' ' + r.namaPaket + ' ' + r.satker).toLowerCase().includes(query)));
        const pageCount = size === 'all' ? 1 : Math.max(1, Math.ceil(list.length / Number(size)));
        state.page = Math.min(state.page, pageCount - 1);
        const start = size === 'all' ? 0 : state.page * Number(size), shown = size === 'all' ? list : list.slice(start, start + Number(size));
        $('requestRows').innerHTML = shown.length ? shown.map(r => {
            const paket = historyPaketSummary(r);
            return '<tr><td><b>' + safe(r.id) + '</b><small>' + safe(date(r.createdAt)) + '</small></td><td><b>' + safe(paket.title) + '</b><small>' + safe(paket.subtitle) + '</small></td><td>' + safe(r.satker) + '</td><td><span class="tag ' + safe(r.status) + '">' + safe(statusName(r.status)) + '</span></td><td><button class="button outline detail-action" data-id="' + safe(r.id) + '">Lihat tahapan</button></td></tr>';
        }).join('') : '<tr><td colspan="5" class="muted">Tidak ada pengajuan pada filter ini.</td></tr>';
        $$('.detail-action').forEach(b => b.addEventListener('click', () => showDetail(b.dataset.id)));
        $('historyPager').innerHTML = '<span>' + list.length + ' pengajuan · halaman ' + (state.page + 1) + '/' + pageCount + '</span><div><button type="button" class="button outline" id="prevHistory" ' + (state.page === 0 ? 'disabled' : '') + '>Sebelumnya</button> <button type="button" class="button outline" id="nextHistory" ' + (state.page >= pageCount - 1 ? 'disabled' : '') + '>Berikutnya</button></div>';
        $('prevHistory').onclick = () => {
            state.page--;
            renderHistory();
        };
        $('nextHistory').onclick = () => {
            state.page++;
            renderHistory();
        };
    }
    const statusName = s => ({ DRAF: 'Draft', DIAJUKAN: 'Diajukan', DIVERIFIKASI: 'Diverifikasi Admin', DITOLAK: 'Ditolak', AKSES_DIBUKA: 'Akses dibuka', DITUTUP: 'Akses ditutup', SELESAI: 'Sudah dibandingkan' }[s] || s);
    // 'MULTI' adalah penanda internal satu surat berisi beberapa usulan, bukan kode RUP.
    // Daftar riwayat memakai indeks ringkas yang sudah dimuat; jangan fetch detail untuk tiap baris.
    function historyPaketSummary(r) {
        if (String(r.kodeRup || '').toUpperCase() !== 'MULTI')
            return { title: r.kodeRup || '—', subtitle: r.namaPaket || '—' };
        const count = Number(String(r.namaPaket || '').match(/^(\d+)\s+usulan/i)?.[1]) || 0;
        return { title: count ? count + ' usulan dalam satu surat' : 'Usulan dalam satu surat', subtitle: 'Lihat tahapan untuk rincian kode RUP / paket' };
    }
    function groupRupSummary(r) {
        const items = r.requested?._items || [];
        const codes = [...new Set(items.map(x => String(x.entry?.kodeRup || '').trim()).filter(x => /^\d{6,12}$/.test(x)))];
        const newCount = items.filter(x => !String(x.entry?.kodeRup || '').trim()).length;
        const parts = [];
        if (codes.length)
            parts.push('RUP ' + codes.slice(0, 3).join(', ') + (codes.length > 3 ? ' dan ' + (codes.length - 3) + ' lainnya' : ''));
        if (newCount)
            parts.push(newCount + ' usulan paket baru');
        return parts.join(' · ') || 'Rincian paket tercantum pada daftar usulan';
    }
    function renderPipeline(r) {
        const states = [['DIAJUKAN', 'Diajukan', r.createdAt], ['DIVERIFIKASI', 'Diperiksa Admin', r.verifiedAt], ['AKSES_DIBUKA', 'Akses dibuka', r.openedAt], ['DITUTUP', 'Akses ditutup', r.closedAt], ['SELESAI', 'Pencocokan', r.checkedAt]];
        if (r.status === 'DRAF')
            return '<div class="pipeline"><span class="pipeline-node current"><b>1</b><strong>Draft</strong><small>Belum dikirim ke Admin</small></span></div>';
        const now = states.findIndex(x => x[0] === r.status), reject = r.status === 'DITOLAK', stop = reject ? 1 : now >= 0 ? now : 0;
        // Setiap tahap yang sudah tercatat tanggalnya diberi centang, termasuk status terakhir.
        // Tahap yang belum tercatat tetap bernomor agar tidak terkesan selesai.
        let html = '<div class="pipeline" aria-label="Tahapan permohonan">' + states.map((x, i) => {
            const rejected = reject && i === 1, completed = !rejected && (i < stop || (i === stop && !!x[2]));
            const classes = (completed ? 'done' : i === stop ? 'current' : '') + (completed && i === stop ? ' latest' : '') + (rejected ? ' rejected' : '');
            const label = rejected ? 'Ditolak' : x[1];
            const explanation = x[2] ? safe(date(x[2])) : i > stop ? 'Menunggu tahap sebelumnya' : i === stop && !reject ? 'Sedang diproses' : '—';
            return '<button type="button" data-pipeline-index="' + i + '" class="pipeline-node ' + classes + '" aria-label="' + safe(label + (completed ? ', selesai' : rejected ? ', ditolak' : ', belum selesai')) + '"><b>' + (rejected ? '×' : completed ? '✓' : i + 1) + '</b><strong>' + safe(label) + '</strong><small>' + explanation + '</small></button>';
        }).join('') + '</div><div id="pipelineDetail" class="pipeline-detail" hidden></div>';
        if (reject)
            html += '<div class="statusline err"><b>Permohonan ditolak Admin.</b> ' + safe(r.adminCatatan || 'Lihat catatan pada setiap usulan.') + '</div>';
        if (r.requested?._mode === 'GABUNGAN') {
            const items = r.requested._items || [], done = items.filter(x => x.status !== 'DIAJUKAN').length, denied = items.filter(x => x.status === 'DITOLAK').length;
            html += '<p class="pipeline-summary">' + done + ' dari ' + items.length + ' usulan sudah diperiksa' + (denied ? ' · ' + denied + ' ditolak' : '') + '. Klik tiap usulan untuk melihat hasilnya.</p>';
        }
        return html;
    }
    function groupDetail(r) {
        const items = r.requested?._items || [];
        return '<h3>Rincian ' + items.length + ' usulan</h3><div class="proposal-list">' + items.map((item, i) => {
            const entry = item.entry || {}, req = item.request || {}, before = item.before || {}, mode = entry.jenisPengajuan || req._mode, title = mode === 'PAKET_BARU' ? (req._packages || entry.paketBaru || []).length + ' paket baru' : before.nama_paket || entry.kodeRup || 'Usulan baru';
            const status = item.status || 'DIAJUKAN';
            let details = '';
            if (mode === 'SATU_KE_SATU')
                details = Object.entries(req.changes || entry.perubahan || {}).map(([k, v]) => '<div class="proposal-delta"><b>' + safe(pretty[k] || k) + '</b><div>Semula: ' + safe(before[k] || '—') + '</div><div>Usulan: ' + safe(v) + '</div></div>').join('');
            if (mode === 'PEMBATALAN')
                details = '<div class="statusline warn"><b>Alasan pembatalan:</b> ' + safe(req.alasan || entry.alasanPembatalan || '—') + '</div>';
            if (['PAKET_BARU', 'SATU_KE_BANYAK'].includes(mode))
                details = '<p class="muted">Struktur kegiatan: ' + safe([req._struktur?.program, req._struktur?.kegiatan, req._struktur?.sub_kegiatan].filter(Boolean).join(' / ')) + '</p>' + (req._packages || entry.paketBaru || []).map((x, j) => '<div class="proposal-delta"><b>' + (j + 1) + '. ' + safe(x.nama_paket) + '</b><div>' + safe(x.jenis_rup) + ' · ' + money(x.pagu) + ' · ' + safe(x.metode_pengadaan) + '</div><div>Spesifikasi: ' + safe(x.spesifikasi || '—') + '</div><div>Uraian: ' + safe(x.uraian || '—') + '</div></div>').join('');
            return '<details class="proposal-item" ' + (status === 'DITOLAK' ? 'open' : '') + '><summary><span class="proposal-no">' + (i + 1) + '</span><span class="proposal-title"><b>' + safe(modeTitle[mode] || mode) + '</b><small>' + safe(title) + (entry.kodeRup ? ' · ' + safe(entry.kodeRup) : '') + '</small></span><span class="tag ' + safe(status) + '">' + safe(statusName(status)) + '</span><span class="proposal-arrow">⌄</span></summary><div class="proposal-body">' + details + (item.note ? '<div class="statusline ' + (status === 'DITOLAK' ? 'err' : '') + '"><b>Catatan Admin:</b> ' + safe(item.note) + (item.rejectedParts?.length ? '<div class="rejection-parts"><b>Bagian yang ditolak:</b> ' + item.rejectedParts.map(safe).join(', ') + '</div>' : '') + '</div>' : '') + (item.verifiedAt ? '<p class="muted">Diperiksa: ' + safe(date(item.verifiedAt)) + '</p>' : '') + (state.admin && status === 'DIAJUKAN' && r.status === 'DIAJUKAN' ? '<div class="proposal-buttons"><button class="button danger" data-item-action="rejectItem" data-item-index="' + i + '">Tolak usulan ini</button><button class="button primary" data-item-action="verifyItem" data-item-index="' + i + '">Verifikasi usulan ini</button></div>' : '') + '</div></details>';
        }).join('') + '</div>';
    }
    function renderInfo(r) {
        const base = r.before || {}, wanted = r.requested || {}, mode = wanted._mode || 'SATU_KE_SATU';
        const grouped = mode === 'GABUNGAN' || String(r.kodeRup).toUpperCase() === 'MULTI';
        const rupInfo = grouped ? groupRupSummary(r) : 'Kode RUP ' + String(r.kodeRup || '—');
        let html = renderPipeline(r) + '<div class="statusline"><b>Status: <span class="tag ' + safe(r.status) + '">' + safe(statusName(r.status)) + '</span></b> · ' + safe(r.id) + '<br>' + safe(modeTitle[mode] || 'Revisi satu ke satu') + ' · ' + safe(rupInfo) + ' · ' + safe(r.satker) + '</div>';
        html += '<div class="info-grid"><div><small>Paket / asal</small><b>' + safe(r.namaPaket) + '</b></div><div><small>Surat permohonan</small><b>' + safe(r.suratNama || '—') + '</b>' + (r.suratUrl ? '<a href="' + safe(r.suratUrl) + '" target="_blank" rel="noopener noreferrer" class="muted">Buka di Google Drive (sesuai izin)</a>' : '') + '</div><div><small>Diajukan</small><b>' + safe(date(r.createdAt)) + '</b></div><div><small>Catatan OPD</small><b>' + safe(r.catatan || '—') + '</b></div></div>';
        if (wanted._mode === 'GABUNGAN') {
            html += groupDetail(r);
        }
        else if (wanted._mode === 'PEMBATALAN') {
            html += '<h3>Usulan pembatalan</h3><div class="statusline warn"><b>Alasan:</b> ' + safe(wanted.alasan || '—') + '</div>';
        }
        else if (wanted._mode === 'SATU_KE_SATU') {
            html += '<h3>Kolom yang diajukan</h3><div class="audit-list">' + Object.entries(wanted.changes || {}).map(([k, v]) => '<div class="audit-item"><h4>' + safe(pretty[k] || k) + '</h4><p><b>Sebelum:</b> ' + safe(base[k] || 'Tidak tersedia') + '</p><p><b>Diminta:</b> ' + safe(v) + '</p></div>').join('') + '</div>';
            if (wanted._details?.jenis_pekerjaan?.length)
                html += '<div class="statusline"><b>Rincian jenis pekerjaan:</b> ' + safe(wanted._details.jenis_pekerjaan.map(j => j.jenis + ' ' + money(j.pagu)).join('; ')) + '<br>Rincian ini perlu dicocokkan dengan perubahan di SiRUP.</div>';
        }
        else if (wanted._mode) {
            const st = wanted._struktur || {};
            html += '<div class="statusline"><b>Struktur kegiatan:</b> ' + safe([st.program, st.kegiatan, st.sub_kegiatan].filter(Boolean).join(' · ')) + '</div><h3>Rancangan ' + (wanted._packages || []).length + ' paket</h3><div class="audit-list">';
            (wanted._packages || []).forEach((p, i) => {
                html += '<div class="audit-item"><h4>' + (i + 1) + '. ' + safe(p.nama_paket) + '</h4><p><b>Jenis:</b> ' + safe(p.jenis_rup || wanted._category) + ' · <b>Pagu:</b> ' + money(p.pagu) + ' · <b>Metode:</b> ' + safe(p.metode_pengadaan) + '</p><p><b>Jenis pekerjaan:</b> ' + safe((p.jenis_pekerjaan || []).map(x => x.jenis + ' ' + money(x.pagu)).join('; ') || 'Swakelola') + '</p><p><b>Spesifikasi:</b> ' + safe(p.spesifikasi || '—') + '</p><p><b>Uraian:</b> ' + safe(p.uraian || '—') + '</p></div>';
            });
            html += '</div><div class="warning-note">Kode RUP hasil penambahan atau pemecahan baru bisa dicocokkan setelah diumumkan. Pencocokan otomatis berdasarkan nama, pagu, dan subkegiatan tetap perlu diperiksa Admin.</div>';
        }
        else {
            html += '<h3>Perubahan yang diajukan</h3><div class="audit-list">' + Object.entries(wanted).map(([k, v]) => '<div class="audit-item"><h4>' + safe(pretty[k] || k) + '</h4><p><b>Sebelum:</b> ' + safe(base[k] || 'Tidak tersedia') + '</p><p><b>Diminta:</b> ' + safe(v) + '</p></div>').join('') + '</div>';
        }
        if (r.adminCatatan)
            html += '<div class="statusline"><b>Catatan Admin</b><p>' + safe(r.adminCatatan) + '</p></div>';
        if (r.openedAt || r.closedAt)
            html += '<div class="info-grid"><div><small>Akses dibuka</small><b>' + safe(date(r.openedAt)) + '</b></div><div><small>Akses ditutup</small><b>' + safe(date(r.closedAt)) + '</b></div><div><small>Pemeriksaan setelah</small><b>' + safe(date(r.compareAfter)) + '</b></div><div><small>Terakhir dicocokkan</small><b>' + safe(date(r.checkedAt)) + '</b></div></div>';
        if (r.result) {
            const t = r.result;
            html += '<h3>Hasil pencocokan</h3><div class="info-grid"><div><small>Sesuai permohonan</small><b>' + Number(t.match || 0) + '</b></div><div><small>Perubahan perlu ditelaah</small><b>' + Number(t.outside || 0) + '</b></div><div><small>RUP baru</small><b>' + Number(t.newRup || 0) + '</b></div><div><small>RUP terhapus</small><b>' + Number(t.deletedRup || 0) + '</b></div></div>';
            if (t.unfulfilled?.length)
                html += '<div class="statusline warn">Yang belum terbukti sesuai: ' + safe(t.unfulfilled.map(k => pretty[k] || k).join(', ')) + '</div>';
            if (t.beforeAccess?.length)
                html += '<div class="statusline warn">' + t.beforeAccess.length + ' perubahan terjadi sebelum akses dicatat dibuka. Periksa lagi waktunya.</div>';
            html += '<div class="audit-list" id="auditDetails">' + (t.details || []).map(d => '<div class="audit-item ' + (d.sesuai ? 'good' : 'bad') + '"><h4>' + safe(d.rup) + ' · ' + safe(pretty[d.kolom] || d.kolom) + ' — ' + safe(String(d.jenis).replaceAll('_', ' ')) + '</h4><p><b>Sebelum:</b> ' + safe(d.sebelum || '—') + '</p><p><b>Sesudah:</b> ' + safe(d.sesudah || '—') + '</p></div>').join('') + '</div>';
            if (Number(t.totalDetails || 0) > (t.details || []).length)
                html += '<p class="muted" id="auditMoreNote">Menampilkan ' + (t.details || []).length + ' dari ' + Number(t.totalDetails) + ' perubahan. <button type="button" class="button outline" id="auditMore">Tampilkan berikutnya</button></p>';
        }
        if (r.history?.length)
            html += '<h3>Catatan dari HISTORYRUP</h3>' + r.history.map(x => '<div class="statusline">' + safe(x.kode_lama) + ' → ' + safe(x.kode_baru) + ' · ' + safe(x.jenis_revisi) + '<br>' + safe(x.alasan) + ' · ' + safe(date(x.tanggal)) + '</div>').join('');
        return html;
    }
    async function showDetail(id) {
        let r = state.allRecords.find(x => x.id === id);
        busy(true, 'Membuka permohonan…', 'Memeriksa rincian dan status terbaru.');
        try {
            r = await api('permohonanSirupGet', { id });
        }
        catch (e) {
            msg(e.message, 'error');
            return;
        }
        finally {
            busy(false);
        }
        const actions = [{ label: 'Tutup', onClick: closeModal }];
        if (r.status === 'DRAF' && (!r.owner || String(r.owner) === String(state.user?.user_id))) {
            actions.push({
                label: 'Lanjutkan draft', className: 'primary', onClick: () => {
                    closeModal();
                    resumeDraft(r.id).catch(e => msg(e.message, 'error'));
                }
            });
        }
        if (state.admin) {
            if (r.status === 'DIAJUKAN' && r.requested?._mode !== 'GABUNGAN') {
                actions.push({ label: 'Tolak', className: 'danger', onClick: () => adminStep(r, 'reject') }, { label: 'Verifikasi', className: 'primary', onClick: () => adminStep(r, 'verify') });
            }
            else if (r.status === 'DIVERIFIKASI')
                actions.push({ label: 'Catat akses dibuka', className: 'primary', onClick: () => adminStep(r, 'open') });
            else if (r.status === 'AKSES_DIBUKA')
                actions.push({ label: 'Catat akses ditutup', className: 'primary', onClick: () => adminStep(r, 'close') });
            else if (r.status === 'DITUTUP' || r.status === 'SELESAI')
                actions.push({ label: 'Cocokkan riwayat', className: 'primary', onClick: () => adminStep(r, 'compare') });
        }
        setModal('Permohonan ' + r.id, renderInfo(r), actions, 'RIWAYAT PERMOHONAN');
        $$('[data-pipeline-index]').forEach(b => b.addEventListener('click', () => {
            const i = Number(b.dataset.pipelineIndex), title = ['Pengajuan dikirim', 'Pemeriksaan Admin', 'Akses SiRUP dibuka', 'Akses SiRUP ditutup', 'Pencocokan perubahan'][i];
            const descriptions = [r.status === 'DRAF' ? 'Draft belum dikirim.' : 'Surat tercatat pada ' + date(r.createdAt) + '.', r.status === 'DITOLAK' ? 'Ditolak. ' + (r.adminCatatan || 'Buka rincian tiap usulan untuk melihat alasan.') : (r.verifiedAt ? 'Pemeriksaan tercatat pada ' + date(r.verifiedAt) + '. ' + (r.adminCatatan || 'Lihat hasil masing-masing usulan di bawah.') : 'Masih menunggu pemeriksaan seluruh usulan oleh Admin.'), r.openedAt ? 'Admin mencatat pembukaan akses pada ' + date(r.openedAt) + '. Batas 2×24 jam: ' + date(r.accessDeadline) + '.' : 'Belum ada pembukaan akses yang dicatat.', r.closedAt ? 'Admin mencatat penutupan akses pada ' + date(r.closedAt) + '.' : 'Belum ada penutupan akses yang dicatat.', r.checkedAt ? 'Hasil pencocokan tercatat pada ' + date(r.checkedAt) + '.' : 'Belum dilakukan pencocokan perubahan terhadap data SiRUP terbaru.'];
            const el = $('pipelineDetail');
            if (!el)
                return;
            el.hidden = false;
            el.innerHTML = '<b>' + safe(title) + '</b><p>' + safe(descriptions[i]) + '</p>';
            $$('[data-pipeline-index]').forEach(x => x.classList.toggle('selected', x === b));
        }));
        $$('[data-item-action]').forEach(b => b.addEventListener('click', () => adminItemStep(r, b.dataset.itemAction, Number(b.dataset.itemIndex))));
        if ($('auditMore'))
            attachAuditMore(r, (r.result?.details || []).length);
    }
    function auditMarkup(d) {
        return '<div class="audit-item ' + (d.sesuai ? 'good' : 'bad') + '"><h4>' + safe(d.rup) + ' · ' + safe(pretty[d.kolom] || d.kolom) + ' — ' + safe(d.jenis.replaceAll('_', ' ')) + '</h4><p><b>Sebelum:</b> ' + safe(d.sebelum || '—') + '</p><p><b>Sesudah:</b> ' + safe(d.sesudah || '—') + '</p></div>';
    }
    function attachAuditMore(r, offset) {
        const button = $('auditMore');
        if (!button)
            return;
        button.onclick = async () => {
            button.disabled = true;
            button.textContent = 'Membaca perubahan…';
            try {
                const out = await api('permohonanSirupReportPage', { id: r.id, offset }, 60000);
                $('auditDetails').insertAdjacentHTML('beforeend', out.details.map(auditMarkup).join(''));
                if (out.next === null)
                    $('auditMoreNote').remove();
                else {
                    button.disabled = false;
                    button.textContent = 'Tampilkan berikutnya';
                    attachAuditMore(r, out.next);
                }
            }
            catch (e) {
                button.disabled = false;
                button.textContent = 'Coba lagi';
                msg(e.message, 'error');
            }
        };
    }
    function adminItemStep(r, step, index) {
        const item = r.requested?._items?.[index];
        if (!item || item.status !== 'DIAJUKAN')
            return;
        const label = step === 'rejectItem' ? 'Tolak usulan ' + (index + 1) : 'Verifikasi usulan ' + (index + 1), req = item.request || {}, entry = item.entry || {};
        const choices = step === 'rejectItem' ? ['Seluruh usulan', ...Object.keys(req.changes || {}).map(x => pretty[x] || x), ...(req._packages || []).map((p, i) => 'Paket ' + (i + 1) + ': ' + p.nama_paket), ...(entry.jenisPengajuan === 'PEMBATALAN' ? ['Usulan pembatalan RUP ' + entry.kodeRup] : [])] : [];
        const selection = choices.length ? '<div class="reject-checks"><strong>Bagian yang ditolak (pilih)</strong>' + choices.map((part, i) => '<label><input type="checkbox" data-reject-part="' + safe(part) + '" ' + (i === 0 ? '' : '') + '> ' + safe(part) + '</label>').join('') + '</div>' : '';
        setModal(label, '<p class="statusline">' + safe(step === 'rejectItem' ? 'Pilih bagian yang ditolak dan jelaskan alasannya agar OPD tahu apa yang harus diperbaiki.' : 'Pastikan rincian usulan ini sudah sesuai dengan surat.') + '</p>' + selection + '<label>Catatan Admin ' + (step === 'rejectItem' ? '(wajib)' : '(opsional)') + '<textarea id="actionNote" rows="4" maxlength="2000" placeholder="Catatan untuk OPD"></textarea></label>', [{ label: 'Kembali', onClick: () => showDetail(r.id) }, {
            label: step === 'rejectItem' ? 'Tolak usulan' : 'Simpan verifikasi', className: step === 'rejectItem' ? 'danger' : 'primary', onClick: () => {
                const note = $('actionNote').value.trim(), parts = $$('[data-reject-part]:checked').map(x => x.dataset.rejectPart);
                if (step === 'rejectItem' && (!note || !parts.length)) {
                    if (!note)
                        $('actionNote').focus();
                    else
                        msg('Pilih bagian yang ditolak.', 'error');
                    return;
                }
                closeModal();
                performStep(r, step, note, index, parts);
            }
        }]);
    }
    function adminStep(r, step) {
        if (step === 'compare') {
            showConfirm('Cocokkan perubahan', 'Perbandingan akan membaca DETAILPSW terbaru dan riwayat HISTORYRUP, lalu menandai perubahan di luar kolom yang disetujui. Proses hanya tersedia setelah 2×24 jam sejak akses ditutup.', () => performStep(r, step, ''));
            return;
        }
        let description = { verify: 'Pastikan rincian permohonan dan surat sudah diperiksa.', reject: 'Permohonan akan dikembalikan sebagai ditolak. Isi alasan penolakan.', open: 'Pastikan akses perubahan sudah benar-benar dibuka di SiRUP resmi. Batas akses dihitung 2×24 jam dari waktu pembukaan ini. Aplikasi hanya mencatat, tidak menutup akses SiRUP secara otomatis.', close: 'Pastikan akses perubahan sudah benar-benar ditutup di SiRUP resmi. Pencocokan tersedia setelah 2×24 jam.' }[step];
        setModal('Konfirmasi ' + ({ verify: 'verifikasi', reject: 'penolakan', open: 'pembukaan akses', close: 'penutupan akses' }[step]), '<p class="statusline">' + safe(description) + '</p><label>Catatan Admin' + (step === 'reject' ? ' (wajib)' : ' (opsional)') + '<textarea id="actionNote" rows="3" placeholder="Catatan pemeriksaan"></textarea></label>', [{ label: 'Batal', onClick: closeModal }, {
            label: 'Simpan', className: step === 'reject' ? 'danger' : 'primary', onClick: () => {
                const note = $('actionNote').value.trim();
                if (step === 'reject' && !note) {
                    $('actionNote').focus();
                    return;
                }
                closeModal();
                performStep(r, step, note);
            }
        }]);
    }
    async function performStep(r, step, catatan, itemIndex, rejectedParts = []) {
        busy(true, 'Menyimpan hasil pemeriksaan…', 'Mengirim catatan ke database Permohonan SiRUP.');
        try {
            let result = await api(step === 'compare' ? 'permohonanSirupCompare' : 'permohonanSirupAdmin', step === 'compare' ? { id: r.id } : { id: r.id, step, catatan, itemIndex, rejectedParts }, 100000);
            msg('Permohonan ' + result.id + ' diperbarui: ' + statusName(result.status) + '.', 'success');
            await init();
            tab('riwayat');
            await showDetail(result.id);
        }
        catch (e) {
            msg(e.message, 'error');
        }
        finally {
            busy(false);
        }
    }
    function wire() {
        window.SirupWorkspace.bind({
            go: tab, detail: showDetail, filter: status => {
                $('historySearch').value = '';
                $('historyStatus').value = status;
                state.page = 0;
                tab('riwayat');
            }
        });
        $$('.tabs button[data-tab]').forEach(b => b.addEventListener('click', () => tab(b.dataset.tab)));
        $('officeChoice').addEventListener('change', async (e) => {
            clearLetterUpload(true);
            state.budget = null;
            state.budgetOffice = '';
            state.budgetPending = null;
            state.budgetPendingOffice = '';
            state.searchCache.clear();
            state.items = [];
            state.editingIndex = -1;
            state.office = e.target.value;
            state.hierarchyOffice = '';
            state.structure = { program: '', kegiatan: '', sub_kegiatan: '' };
            renderBatch();
            busy(true, 'Membuka satuan kerja…', 'Menyiapkan data OPD.');
            try {
                await init();
            }
            catch (err) {
                msg(err.message, 'error');
            }
            finally {
                busy(false);
            }
        });
        $$('#modeChooser [data-mode]').forEach(b => b.addEventListener('click', () => selectMode(b.dataset.mode).catch(e => msg(e.message, 'error'))));
        $$('#categoryChooser [data-category]').forEach(b => b.addEventListener('click', () => selectCategory(b.dataset.category).catch(e => msg(e.message, 'error'))));
        let timer;
        $('rupSearch').addEventListener('input', () => {
            clearTimeout(timer);
            timer = setTimeout(searchRup, 300);
        });
        $('rupChoice').addEventListener('change', e => {
            const rup = e.target.value;
            resetEditor(false);
            if (!rup)
                return;
            const source = state.officeLookup.get(String(rup));
            if (!source) {
                msg('Kode RUP tidak ada dalam data OPD. Muat ulang daftar bila sudah berubah.', 'error');
                return;
            }
            if (rupMatchText(source.cara_pengadaan) !== rupMatchText(state.category)) {
                msg('Jenis RUP tidak sesuai.', 'error');
                return;
            }
            state.source = { ...source };
            state.fields = Object.keys(source);
            state.chosenCode = rup;
            if (state.mode === 'SATU_KE_BANYAK')
                state.packages = [emptyPackage(source, state.category), emptyPackage({}, state.category)];
            maybeShowEditor();
            loadBudget();
            $('rupSourceHint').textContent = 'RUP ' + rup + ' siap direvisi.';
        });
        $('programChoice').addEventListener('change', e => {
            state.structure.program = e.target.value;
            state.structure.kegiatan = '';
            state.structure.sub_kegiatan = '';
            renderStructure();
            maybeShowEditor();
        });
        $('kegiatanChoice').addEventListener('change', e => {
            state.structure.kegiatan = e.target.value;
            state.structure.sub_kegiatan = '';
            renderStructure();
            maybeShowEditor();
        });
        $('subkegiatanChoice').addEventListener('change', e => {
            state.structure.sub_kegiatan = e.target.value;
            maybeShowEditor();
            if (state.structure.sub_kegiatan)
                loadBudget();
        });
        $('changeFields').addEventListener('input', e => {
            const t = e.target;
            if (t.dataset.money !== undefined)
                formatMoneyInput(t);
            if (t.dataset.singleJob !== undefined) {
                const j = state.singleJobs[Number(t.dataset.singleJob)];
                if (j)
                    j[t.dataset.jobKey] = t.dataset.money !== undefined ? digits(t.value) : t.value;
            }
            updateSingleJobTotal();
            countChange();
            renderBudget();
        });
        $('changeFields').addEventListener('change', e => {
            const t = e.target;
            if (t.dataset.singleJob !== undefined) {
                const j = state.singleJobs[Number(t.dataset.singleJob)];
                if (j)
                    j[t.dataset.jobKey] = t.dataset.money !== undefined ? digits(t.value) : t.value;
            }
            updateSingleJobTotal();
            countChange();
            renderBudget();
        });
        $('changeFields').addEventListener('click', e => {
            const t = e.target.closest('button');
            if (!t)
                return;
            if (t.dataset.addSingleJob !== undefined) {
                if (state.singleJobs.length >= 8)
                    return msg('Maksimal delapan jenis pekerjaan.', 'error');
                state.singleJobs.push({ jenis: 'Barang', pagu: '' });
                renderSingleJobs();
            }
            else if (t.dataset.removeSingleJob !== undefined && state.singleJobs.length > 1) {
                state.singleJobs.splice(Number(t.dataset.removeSingleJob), 1);
                renderSingleJobs();
            }
        });
        $('packageCards').addEventListener('input', event => {
            const t = event.target;
            if (t.dataset.p === undefined)
                return;
            if (t.dataset.money !== undefined)
                formatMoneyInput(t);
            const i = Number(t.dataset.p), p = state.packages[i];
            if (!p)
                return;
            if (t.dataset.job !== undefined) {
                const job = p.jenis_pekerjaan[Number(t.dataset.job)];
                if (job)
                    job[t.dataset.jkey] = t.dataset.money !== undefined ? digits(t.value) : t.value;
            }
            else if (t.dataset.k) {
                p[t.dataset.k] = t.dataset.k === 'waktu_pemilihan' ? monthText(t.value) : t.dataset.money !== undefined ? digits(t.value) : t.value;
            }
            updatePackageTotal();
            countChange();
            renderBudget();
        });
        $('packageCards').addEventListener('change', event => {
            const t = event.target;
            if (t.dataset.spp) {
                const p = state.packages[Number(t.dataset.p)];
                if (t.checked && !p.spp.includes(t.dataset.spp))
                    p.spp.push(t.dataset.spp);
                else if (!t.checked)
                    p.spp = p.spp.filter(x => x !== t.dataset.spp);
                return;
            }
            if (t.dataset.p !== undefined) {
                const p = state.packages[Number(t.dataset.p)];
                if (t.dataset.job !== undefined) {
                    const job = p?.jenis_pekerjaan[Number(t.dataset.job)];
                    if (job)
                        job[t.dataset.jkey] = t.dataset.money !== undefined ? digits(t.value) : t.value;
                }
                else if (t.dataset.k && p) {
                    if (t.dataset.k === 'jenis_rup' && (state.mode === 'PAKET_BARU' || state.mode === 'SATU_KE_BANYAK' && Number(t.dataset.p) > 0)) {
                        const previous = p.spesifikasi || '', spesifikasi = t.value === 'Penyedia' && swTypes.includes(previous) ? '' : previous;
                        const changed = emptyPackage({ ...p, spesifikasi, jenis_rup: t.value }, t.value);
                        changed._collapsed = p._collapsed;
                        changed.spp = [...(p.spp || [])];
                        state.packages[Number(t.dataset.p)] = changed;
                        renderPackages();
                        return;
                    }
                    p[t.dataset.k] = t.dataset.k === 'waktu_pemilihan' ? monthText(t.value) : t.dataset.money !== undefined ? digits(t.value) : t.value;
                    if (t.dataset.k === 'metode_pengadaan')
                        p.dikecualikan = t.value === 'Dikecualikan' ? 'Ya' : 'Tidak';
                }
                updatePackageTotal();
                renderBudget();
            }
        });
        $('packageCards').addEventListener('click', event => {
            const t = event.target.closest('button');
            if (!t)
                return;
            if (t.dataset.toggle !== undefined) {
                const i = Number(t.dataset.toggle);
                state.packages[i]._collapsed = !state.packages[i]._collapsed;
                const card = t.closest('.package-card');
                card.querySelector('.package-body').hidden = state.packages[i]._collapsed;
                card.querySelector('.package-compact').hidden = !state.packages[i]._collapsed;
                t.setAttribute('aria-expanded', String(!state.packages[i]._collapsed));
                t.textContent = state.packages[i]._collapsed ? 'Buka rincian' : 'Ringkas';
                card.querySelector('.package-compact').textContent = (state.packages[i].nama_paket || 'Nama paket belum diisi') + ' · ' + money(state.packages[i].pagu);
                card.classList.toggle('is-collapsed', state.packages[i]._collapsed);
            }
            else if (t.dataset.remove !== undefined) {
                const index = Number(t.dataset.remove);
                if (state.mode === 'SATU_KE_BANYAK' && (index === 0 || state.packages.length <= 2)) {
                    msg('Paket asal tidak bisa dihapus. Pemecahan minimal dua paket.', 'error');
                    return;
                }
                if (state.mode === 'PAKET_BARU' && state.packages.length <= 1)
                    return;
                state.packages.splice(index, 1);
                renderPackages();
            }
            else if (t.dataset.addJob !== undefined) {
                const p = state.packages[Number(t.dataset.addJob)];
                if (p.jenis_pekerjaan.length >= 8)
                    return msg('Maksimal delapan jenis pekerjaan per paket.', 'error');
                p.jenis_pekerjaan.push({ jenis: 'Barang', pagu: '' });
                renderPackages();
            }
            else if (t.dataset.deleteJob !== undefined) {
                const [i, j] = t.dataset.deleteJob.split(':').map(Number);
                if (state.packages[i].jenis_pekerjaan.length > 1) {
                    state.packages[i].jenis_pekerjaan.splice(j, 1);
                    renderPackages();
                }
            }
        });
        $('addPackage').addEventListener('click', () => {
            if (state.mode !== 'SATU_KE_BANYAK')
                return;
            if (state.packages.length >= 8)
                return msg('Maksimal delapan paket.', 'error');
            state.packages.push(emptyPackage({}, state.category));
            renderPackages();
        });
        for (const [id, kind] of [['addProvider', 'Penyedia'], ['addSwakelola', 'Swakelola']])
            $(id).addEventListener('click', () => {
                if (state.packages.length >= 8)
                    return msg('Maksimal delapan paket dalam satu permohonan.', 'error');
                state.packages.push(emptyPackage({}, kind));
                renderPackages();
            });
        $('stageRequest').addEventListener('click', () => {
            try {
                stageCurrent();
            }
            catch (e) {
                msg(e.message, 'error');
            }
        });
        $('batchList').addEventListener('click', e => {
            const b = e.target.closest('button');
            if (!b)
                return;
            if (b.dataset.batchRemove !== undefined) {
                const i = Number(b.dataset.batchRemove);
                showConfirm('Hapus usulan', 'Usulan ini hanya dihapus dari daftar surat, bukan dari SiRUP.', () => {
                    state.items.splice(i, 1);
                    if (state.editingIndex === i) {
                        state.editingIndex = -1;
                        resetEditor();
                    }
                    else if (state.editingIndex > i)
                        state.editingIndex--;
                    renderBatch();
                });
            }
            else if (b.dataset.batchEdit !== undefined)
                editBatch(Number(b.dataset.batchEdit)).catch(err => msg(err.message, 'error'));
        });
        $('letterPick').addEventListener('click', () => {
            if (!state.letterUpload?.loading) {
                $('letterFile').value = '';
                $('letterFile').click();
            }
        });
        $('letterCancel').addEventListener('click', () => showConfirm('Batalkan surat PDF', 'Surat yang belum dikirim akan dihapus dari Google Drive. Daftar usulan tetap ada.', () => {
            clearLetterUpload(true);
            renderBatch();
            msg('Surat dibatalkan. Usulan tetap tersimpan di layar.');
        }));
        $('letterFile').addEventListener('change', () => {
            const file = $('letterFile').files?.[0];
            if (file)
                uploadLetter(file);
        });
        $('saveDraft').addEventListener('click', () => saveDraft().catch(e => msg(e.message, 'error')));
        $('submitRequest').addEventListener('click', () => {
            if (state.letterUpload?.loading) {
                msg('Upload surat masih berlangsung.', 'error');
                return;
            }
            if (!state.letterUpload?.ready) {
                msg('Unggah surat PDF sampai berhasil terlebih dahulu.', 'error');
                return;
            }
            let title = state.items.length ? 'surat berisi ' + state.items.length + ' usulan' : modeTitle[state.mode];
            showConfirm('Kirim ' + title, 'Usulan akan disimpan bersama satu surat dan menunggu pemeriksaan Admin. Pastikan rincian dan pagu sudah benar.', async () => {
                try {
                    await submitNow();
                }
                catch (e) {
                    msg(e.message, 'error');
                }
            });
        });
        for (const id of ['historySearch', 'historyStatus', 'historyPageSize'])
            $(id).addEventListener(id === 'historySearch' ? 'input' : 'change', () => {
                state.page = 0;
                renderHistory();
            });
        $('refreshHistory').addEventListener('click', async () => {
            busy(true, 'Memperbarui data…');
            try {
                state.searchCache.clear();
                state.rupDetails.clear();
                state.hierarchyOffice = '';
                await init();
                msg('Daftar pengajuan diperbarui.', 'success');
            }
            catch (e) {
                msg(e.message, 'error');
            }
            finally {
                busy(false);
            }
        });
        $('loadRetry').addEventListener('click', () => {
            busy(true, 'Membuka Permohonan SiRUP…', 'Memuat ulang data OPD.');
            init(true).catch(e => {
                progress(0, 'Gagal membuka data: ' + e.message, true);
                msg(e.message, 'error');
            }).finally(() => busy(false));
        });
        $('budgetRefresh').addEventListener('click', () => loadBudget(true));
        $('openHistory').addEventListener('click', () => tab('riwayat'));
        $('enableAuto').addEventListener('click', () => showConfirm('Pemantauan otomatis', 'Aktifkan pemeriksaan berkala setiap 6 jam untuk permohonan yang sudah ditutup lebih dari 2×24 jam?', async () => {
            busy(true, 'Mengaktifkan pemantauan…');
            try {
                await api('permohonanSirupAuto');
                msg('Pemantauan setiap 6 jam sudah dipasang.', 'success');
            }
            catch (e) {
                msg(e.message, 'error');
            }
            finally {
                busy(false);
            }
        }));
        window.addEventListener('pagehide', () => {
            if (state.letterUpload?.ready)
                releaseLetter(state.letterUpload, true);
        });
        $('closeDialog').addEventListener('click', closeModal);
        document.addEventListener('keydown', e => {
            if (e.key === 'Escape' && !$('modal').hidden)
                closeModal();
        });
    }
    async function launch() {
        wire();
        renderBatch();
        if (!sessionStorage.getItem(TOKEN)) {
            msg('Silakan login terlebih dahulu lewat ORBITA.', 'error');
            return;
        }
        busy(true, 'Membuka Permohonan SiRUP…', 'Memeriksa sesi pengguna.');
        try {
            await init(false);
            const requested = new URLSearchParams(location.search).get('id');
            if (requested && /^PSR-[\dA-Za-z-]+$/.test(requested)) {
                tab('riwayat');
                await showDetail(requested);
            }
        }
        catch (e) {
            progress(0, 'Gagal membuka sesi: ' + e.message, true);
            msg(e.message + ' Pastikan backend Permohonan SiRUP sudah diperbarui dan di-deploy.', 'error');
        }
        finally {
            busy(false);
        }
    }
    launch();
})();
