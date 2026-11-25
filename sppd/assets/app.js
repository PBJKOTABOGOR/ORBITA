(() => {
    'use strict';
    const $ = s => document.querySelector(s);
    const main = $('#main');
    const cfg = window.SPPD_CONFIG;
    const session = window.SPPD_SESSION;
    const token = session.token;
    const escape = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const e = escape;
    const rup = n => 'Rp ' + Number(n || 0).toLocaleString('id-ID');
    const today = () => new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Jakarta' }).format(new Date());
    const date = s => s ? new Date(s.slice(0, 10) + 'T00:00:00').toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';
    const status = {
        DRAFT: 'Draft',
        SIAP_CETAK: 'Siap dicetak',
        SPJ: 'Lengkapi SPJ',
        PERIKSA: 'Diperiksa bendahara',
        PERBAIKAN: 'Perlu perbaikan',
        SIAP_BAYAR: 'Siap dibayarkan',
        DIBAYAR: 'Sudah dibayar',
        ARSIP: 'Selesai',
        BATAL: 'Dibatalkan'
    };
    const stages = ['DRAFT', 'SIAP_CETAK', 'SPJ', 'ARSIP'];
    const stageLabels = ['Draft', 'SPD terbit', 'Lengkapi berkas', 'Selesai'];
    const roles = ['OPERATOR', 'ADMIN_OPD', 'ADMIN_SHS'];
    const roleLabels = {
        OPERATOR: 'Operator',
        BENDAHARA: 'Bendahara',
        ADMIN_OPD: 'Admin PBJ',
        ADMIN_SHS: 'Admin SBU',
        SUPERADMIN: 'Superadmin',
        PEMERIKSA: 'Pemeriksa'
    };
    const unitName = 'Bagian Pengadaan Barang dan Jasa';
    const kopAddress = 'Jl. Ir.H.Juanda No.10 Telp. (0251)8321075 Fax. 8326530';
    let user;
    let opd = '';
    let offices = [];
    let directory = null;
    let directoryError = '';
    let directoryLoad = null;
    let registerRows = [];
    let boot = { trips: [], masters: { employees: [], office: null, number: [] }, rates: [] };
    let view = 'home';
    let current = null;
    let draft = null;
    let year = '2026';
    let pending = 0;
    let refreshing = false;
    let epoch = 0;
    let toastTimer;
    let rateRows = [];
    let rateYear = '2026';
    let rateImportForm = null;
    let accessRows = [];
    let rateQuery = '';
    let listQuery = '';
    let listStatus = '';
    let initialToken = session.restore();
    let openingSession = false;
    let initializing = false;
    let formDirty = false;
    const channel = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('orbita-sppd-v1') : null;
    const navIcons = {
        "home": "<rect x=\"3\" y=\"3\" width=\"7\" height=\"7\" rx=\"1\"/><rect x=\"14\" y=\"3\" width=\"7\" height=\"7\" rx=\"1\"/><rect x=\"3\" y=\"14\" width=\"7\" height=\"7\" rx=\"1\"/><rect x=\"14\" y=\"14\" width=\"7\" height=\"7\" rx=\"1\"/>",
        "new": "<path d=\"M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6M12 11v7m-3.5-3.5h7\"/>",
        "list": "<path d=\"M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01\"/>",
        "register": "<path d=\"M4 19V5a2 2 0 0 1 2-2h14v18H6a2 2 0 0 1 0-4h14M8 7h8M8 11h6\"/>",
        "check": "<rect x=\"3\" y=\"5\" width=\"18\" height=\"16\" rx=\"2\"/><path d=\"M3 10h18m-7 5h4M7 3h10\"/>",
        "master": "<circle cx=\"9\" cy=\"8\" r=\"3\"/><path d=\"M3 20v-2a6 6 0 0 1 12 0v2m2-15a3 3 0 0 1 0 6m1 3a5 5 0 0 1 3 4v2\"/>",
        "rates": "<rect x=\"5\" y=\"2\" width=\"14\" height=\"20\" rx=\"2\"/><path d=\"M8 6h8M8 11h.01M12 11h.01M16 11h.01M8 15h.01M12 15h.01M16 15h.01M8 19h8\"/>",
        "access": "<path d=\"M12 22s8-4 8-11V5l-8-3-8 3v6c0 7 8 11 8 11zM9 12l2 2 4-4\"/>",
        "clock": "<circle cx=\"12\" cy=\"12\" r=\"9\"/><path d=\"M12 7v5l3 2\"/>",
        "done": "<circle cx=\"12\" cy=\"12\" r=\"9\"/><path d=\"m8 12 3 3 5-6\"/>"
    };

    // Ikon menu
    function uiIcon(k) {
        return `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${navIcons[k] || navIcons.home}</svg>`;
    }

    // Hak akses
    function has(...rs) {
        return !!user?.grants.some(g => (g.opd === opd || g.opd === '*' && g.roles.includes('SUPERADMIN')) && (g.roles.includes('SUPERADMIN') || rs.some(r => g.roles.includes(r))));
    }

    function globalRole(...rs) {
        return !!user?.grants.some(g => g.roles.includes('SUPERADMIN') || rs.some(r => g.roles.includes(r)));
    }

    // Notifikasi dan status koneksi
    function toast(msg, error = false) {
        const t = $('#toast');
        t.textContent = msg;
        t.className = 'show' + (error ? ' error' : '');
        clearTimeout(toastTimer);
        toastTimer = setTimeout(() => t.className = '', 4500);
    }

    function sync(text, off = false) {
        $('#sync').textContent = text;
        $('#sync').classList.toggle('off', off);
    }

    function synced() {
        sync('Tersinkron ' + new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    }

    // Komunikasi dengan Apps Script
    async function api(action, p = {}) {
        if (!token() || token() !== initialToken)
            throw Error('Sesi berganti. Buka kembali dari ORBITA.');
        if (!cfg.apiUrl)
            throw Error('Layanan SPPD belum dihubungkan. Isi URL Web App pada assets/config.js.');
        const ctrl = new AbortController();
        const t = setTimeout(() => ctrl.abort(), ['importRates', 'syncEmployees'].includes(action) ? 120000 : 45000);
        try {
            const res = await fetch(cfg.apiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                body: JSON.stringify({ action, token: token(), opd, year, ...p }),
                signal: ctrl.signal,
                cache: 'no-store'
            });
            let j;
            try { j = await res.json(); }
            catch (_) { throw Error('Web App SPPD belum memberikan respons yang sesuai. Periksa deployment dan izin akses Apps Script.'); }
            if (!j.ok)
                throw Error(j.error || 'Permintaan belum berhasil.');
            if (token() !== initialToken)
                throw Error('Sesi berganti.');
            return j.data;
        }
        catch (err) {
            if (err.name === 'AbortError')
                throw Error('Koneksi terlalu lama. Periksa jaringan dan riwayat sebelum mencoba lagi.');
            throw err;
        }
        finally {
            clearTimeout(t);
        }
    }

    async function work(btn, label, fn) {
        if (pending)
            return;
        pending++;
        const old = btn?.textContent;
        if (btn) {
            btn.disabled = true;
            btn.textContent = label;
        }
        sync(label, true);
        try {
            await fn();
            synced();
        }
        catch (err) {
            if (session.classify(err.message) !== 'connection') sessionError(err);
            else {
                toast(err.message, true);
                sync('Belum tersinkron', true);
            }
        }
        finally {
            pending--;
            if (btn?.isConnected) {
                btn.disabled = false;
                btn.textContent = old;
            }
        }
    }

    // Komponen tampilan
    function fail(msg, type = 'connection') {
        const login = type === 'login' || type === 'expired';
        const title = login ? 'Sambungkan akun ORBITA' : type === 'access' ? 'Akses Perjalanan Dinas belum diberikan' : 'Perjalanan Dinas belum terhubung';
        const hint = login ? '<p>Sudah login di ORBITA pada tab lain? Salin alamat halaman ini, lalu tempel di tab ORBITA tersebut. Sesi browser tidak otomatis berpindah antar-tab.</p>' : '';
        const connect = login ? '<button data-act="connectSession">Sambungkan akun</button><button class="ghost" data-act="copyAddress">Salin alamat SPPD</button>' : '';
        main.innerHTML = `<div class="panel"><h2>${title}</h2><p>${e(msg)}</p>${hint}<div class="actions">${connect}<button class="ghost" data-act="retry">Coba lagi</button></div><p id="sessionHint" role="status"></p></div>`;
        $('#headOffice').textContent = login ? 'Akun belum tersambung' : type === 'access' ? 'Menunggu hak akses' : 'Periksa koneksi layanan';
        sync(login ? 'Belum masuk' : type === 'access' ? 'Akses terbatas' : 'Tidak terhubung', true);
    }

    function clearWorkspace() {
        user = null;
        opd = '';
        offices = [];
        directory = null;
        directoryError = '';
        directoryLoad = null;
        accessRows = [];
        boot = { trips: [], masters: { employees: [], office: null, number: [] }, rates: [] };
        current = null;
        draft = null;
        formDirty = false;
        epoch++;
        $('#nav').innerHTML = '';
        $('#account').textContent = '';
        $('#avatar').textContent = 'O';
        $('#office').hidden = true;
    }

    function sessionError(err) {
        const type = session.classify(err.message);
        if (type === 'expired' || type === 'access') {
            if (type === 'expired') session.clear(initialToken);
            clearWorkspace();
        }
        fail(err.message, type);
    }

    async function connectSession(button) {
        if (openingSession || initializing) return;
        openingSession = true;
        button.disabled = true;
        try {
            await session.openLogin(text => {
                $('#sessionHint').textContent = text;
                sync('Menunggu login ORBITA', true);
            });
            await init();
        } catch (err) {
            fail(err.message, 'login');
        } finally {
            openingSession = false;
            if (button.isConnected) button.disabled = false;
        }
    }

    function field(label, key, val = '', type = 'text', extra = '') {
        return `<div class="field"><label for="f-${key}">${e(label)}</label><input id="f-${key}" name="${key}" type="${type}" value="${e(val)}" ${extra}></div>`;
    }

    function select(label, key, vals, val) {
        return `<div class="field"><label for="f-${key}">${e(label)}</label><select id="f-${key}" name="${key}"><option value="">Pilih ${e(label.toLowerCase())}</option>${vals.map(x => {
            let o = typeof x === 'object' ? x : { v: x, l: x };
            return `<option value="${e(o.v)}" ${String(o.v) === String(val) ? 'selected' : ''}>${e(o.l)}</option>`;
        }).join('')}</select></div>`;
    }

    function searchSelect(label, key, values, value, placeholder = 'Cari nama…') {
        const options = values.map(x => typeof x === 'object' ? x : { v: x, l: x });
        return `<div class="field picker"><label for="f-${key}">${e(label)}</label>
            <input type="search" data-search-select="f-${key}" placeholder="${e(placeholder)}" aria-label="Cari ${e(label)}" autocomplete="off">
            <select id="f-${key}" name="${key}"><option value="">Pilih ${e(label.toLowerCase())}</option>${options.map(o => `<option value="${e(o.v)}" ${String(o.v) === String(value) ? 'selected' : ''}>${e(o.l)}</option>`).join('')}</select></div>`;
    }

    function officeChoices() {
        return [...new Set([...offices, ...(directory?.opds || [])])].sort((a, b) => a.localeCompare(b, 'id'));
    }

    async function loadDirectory(force = false) {
        if (!globalRole('SUPERADMIN')) return;
        if (directory && !force) return;
        if (directoryLoad) return directoryLoad;
        const account = user?.id, sessionToken = token();
        directoryError = '';
        directoryLoad = api('directory').then(data => {
            if (user?.id !== account || token() !== sessionToken) return;
            directory = data;
            accessRows = data.access || [];
        }).catch(err => { directoryError = err.message; }).finally(() => { directoryLoad = null; });
        return directoryLoad;
    }

    function btn(text, act, extra = '', cls = '') {
        return `<button class="${cls}" data-act="${act}" ${extra}>${text}</button>`;
    }

    function pill(s) {
        return `<span class="pill ${['DIBAYAR', 'ARSIP', 'SIAP_BAYAR'].includes(s) ? 'ok' : ['PERBAIKAN', 'BATAL'].includes(s) ? 'err' : ['PERIKSA', 'SPJ'].includes(s) ? 'warn' : ''}">${e(status[s] || s)}</span>`;
    }

    function pipe(s) {
        if (s === 'BATAL') return '<div class="notice">Perjalanan dibatalkan. Alokasi pagu dilepas, nomor SPD tetap tercatat.</div>';
        const n = s === 'PERBAIKAN' ? 3 : stages.indexOf(s), finished = s === 'ARSIP';
        return `<div class="pipeline" data-status="${e(s)}" aria-label="Progres perjalanan dinas">${stageLabels.map((l, i) => {
            const done = finished || i < n, active = !finished && i === n;
            return `<div class="step ${done ? 'done' : active ? 'active' : ''}" ${active ? 'aria-current="step"' : ''}><b>${done ? '✓' : i + 1}</b><span>${e(l)}</span><small>${done ? 'Selesai' : active ? (s === 'PERBAIKAN' ? 'Perlu perbaikan' : 'Tahap saat ini') : (s ? 'Belum dimulai' : '')}</small></div>`;
        }).join('')}</div>`;
    }

    function top(title, sub, actions = '') {
        return `<div class="top"><div><h1>${e(title)}</h1><p>${e(sub)}</p></div><div class="actions">${actions}</div></div>`;
    }

    // Navigasi
    function nav() {
        const navView = ({ detail: 'list', adjust: 'list', addRate: 'rates' })[view] || view;
        const menu = [
            ['home', '⌂', 'Ringkasan'], ['new', '＋', 'Buat SPPD'],
            ['list', '▤', 'Riwayat SPPD'], ['budget', '▦', 'Monitoring pagu'],
            ['register', '≡', 'Register SPD'],
            ...(has('ADMIN_OPD') ? [['master', '♙', 'Pegawai & pejabat']] : []),
            ...(globalRole('ADMIN_SHS') ? [['rates', '▦', 'Standar biaya (SBU)']] : []),
            ...(globalRole('SUPERADMIN') ? [['access', '⚿', 'Hak akses']] : [])
        ];
        $('#nav').innerHTML = menu.map(([k, i, t]) => `<button class="nav-item ${navView === k ? 'on' : ''}" data-nav="${k}" ${navView === k ? 'aria-current="page"' : ''}><b class="nav-icon">${uiIcon(k)}</b><span>${e(t)}</span></button>`).join('');
        $('#headTitle').textContent = ({
            home: 'Ringkasan',
            new: 'Buat SPPD',
            budget: 'Monitoring pagu',
            list: 'Riwayat perjalanan',
            detail: 'Detail perjalanan',
            adjust: 'Penyesuaian biaya',
            register: 'Register SPD',
            check: 'Ruang bendahara',
            master: 'Pegawai & pejabat',
            rates: 'Standar biaya (SBU)',
            addRate: 'Tambah standar biaya',
            access: 'Hak akses'
        })[view] || 'Perjalanan Dinas';
        $('#headOffice').textContent = unitName;
        $('#account').textContent = user?.name || '';
        $('#avatar').textContent = (user?.name || 'O').slice(0, 1).toUpperCase();
        const sel = $('#office');
        sel.hidden = true;
        sel.innerHTML = offices.map(x => `<option ${x === opd ? 'selected' : ''}>${e(x)}</option>`).join('');
    }

    // Sesi dan ruang kerja OPD
    async function init() {
        if (initializing) return;
        initialToken = session.restore();
        if (!initialToken) {
            clearWorkspace();
            return fail('Belum ada sesi akun PBJ di tab ini.', 'login');
        }
        initializing = true;
        $('#headOffice').textContent = 'Memeriksa akun dan hak akses…';
        sync('Menyiapkan data…', true);
        try {
            const d = await api('init', { opd: sessionStorage.getItem('orbita_sppd_opd') || '' });
            user = d.user;
            offices = d.offices;
            opd = d.selected || '';
            boot = d.boot || { trips: [], masters: { employees: [], office: null, number: [] }, rates: [] };
            view = 'home';
            nav();
            render();
            synced();
        } catch (err) {
            sessionError(err);
        } finally {
            initializing = false;
        }
    }

    async function switchOffice(x, targetView = 'home') {
        opd = x;
        epoch++;
        sessionStorage.setItem('orbita_sppd_opd', x);
        view = targetView;
        current = null;
        draft = null;
        boot = { trips: [], masters: { employees: [], office: null, number: [] }, rates: [] };
        nav();
        main.innerHTML = '<div class="panel"><p>Membuka ruang kerja OPD…</p><div class="loading-line"><i></i></div></div>';
        try {
            boot = await api('boot');
            render();
            synced();
        }
        catch (err) {
            sessionError(err);
        }
    }

    // Ringkasan dan daftar perjalanan
    function tableRows(rows) {
        return rows.length ? `<div class="table-wrap"><table><thead><tr><th>Perjalanan dinas</th><th>Peserta</th><th>Jumlah</th><th>Status</th><th></th></tr></thead><tbody>${rows.map(r => `<tr><td><b>${e(r.purpose)}</b><small>${e(r.destination)} · ${date(r.start)} — ${date(r.end)}</small><small>Input: ${e(r.createdBy || '—')}</small></td><td>${r.people} orang</td><td><b>${rup(r.total)}</b></td><td>${pill(r.status)}</td><td>${btn('Buka', 'detail', `data-id="${e(r.id)}"`, 'ghost small')}</td></tr>`).join('')}</tbody></table></div>` : '<div class="empty">Belum ada perjalanan dinas pada daftar ini.</div>';
    }

    // Ringkasan pagu berasal dari KODE_REK dan transaksi yang sudah diterbitkan.
    function budgetRows() {
        return boot.budget?.accounts || [];
    }

    function budgetTable() {
        const rows = budgetRows();
        if (!rows.length) return '<div class="empty">Belum ada rekening perjalanan dinas untuk tahun ini. Sumber SIPD saat ini adalah tahun 2026.</div>';
        return `<div class="table-wrap"><table><thead><tr><th>Subkegiatan / rekening</th><th>Pagu</th><th>Terpakai sebelum aplikasi</th><th>SPD tercatat</th><th>Draft</th><th>Sisa pagu internal</th>${has('ADMIN_OPD') ? '<th></th>' : ''}</tr></thead><tbody>${rows.map(r => `<tr><td><b>${e(r.activity)}</b><small>${e(r.sub)} · ${e(r.account)} · ${e(r.fundName)}</small></td><td>${rup(r.pagu)}</td><td>${r.confirmed ? rup(r.opening) : '<span class="pill warn">Belum diatur</span>'}</td><td>${rup(r.used)}</td><td>${rup(r.draft)}</td><td><b>${r.confirmed && !boot.budget.unmatched ? rup(r.remaining) : 'Belum pasti'}</b>${r.confirmed ? `<div class="budget-meter"><i style="width:${Math.min(100, Math.max(0, (r.opening + r.used) / Math.max(1, r.pagu) * 100))}%"></i></div>` : ''}</td>${has('ADMIN_OPD') ? `<td>${btn('Atur pemakaian awal', 'openingBudget', `data-id="${e(r.key)}"`, 'ghost small')}</td>` : ''}</tr>`).join('')}</tbody></table></div>`;
    }

    function budgetWarning() {
        return boot.budget?.unmatched ? `<div class="notice">Ada SPD lama senilai ${rup(boot.budget.unmatched)} yang belum terhubung ke rekening. Sisa belum dapat dipastikan; penerbitan baru ditahan.</div>` : '';
    }

    function budgetPage() {
        return top('Monitoring pagu perjalanan dinas', 'Tahun ' + year + ' · ' + unitName, btn('Perbarui', 'refreshBudget', '', 'ghost')) + `<div class="panel"><div class="section-title"><h2>Anggaran per subkegiatan</h2><label>Tahun <select id="budgetYear" aria-label="Tahun anggaran">${[...new Set([year,today().slice(0,4),...boot.trips.map(t=>String(t.year||'')).filter(y=>/^\d{4}$/.test(y)),'2026'])].sort().reverse().map(y=>`<option value="${e(y)}" ${y===year?'selected':''}>${e(y)}</option>`).join('')}</select></label></div><p>Saldo internal dihitung dari pagu KODE_REK, pemakaian awal dan seluruh SPD terbit yang belum dibatalkan. Ini bukan data pencairan SIPD. Draft belum membebani pagu.</p>${budgetWarning()}${budgetTable()}</div>`;
    }

    function home() {
        const t = boot.trips.filter(x => String(x.year) === year), accounts = budgetRows();
        const ready = accounts.length > 0 && accounts.every(x => x.confirmed) && !boot.budget?.unmatched;
        const sum = k => accounts.reduce((n, x) => n + x[k], 0);
        const cards = [['Pagu perjalanan dinas', accounts.length ? rup(sum('pagu')) : 'Belum tersedia', 'blue'], ['Terpakai / teralokasi', ready ? rup(sum('opening') + sum('used')) : 'Belum pasti', 'amber'], ['Sisa pagu internal', ready ? rup(sum('remaining')) : 'Belum pasti', 'green'], ['SPD tercatat', t.filter(x => x.status !== 'BATAL').length, 'blue']];
        return `<div class="welcome"><div class="eyebrow">${e(unitName)} · ${year}</div><div class="top"><div><h1>Perjalanan Dinas</h1><p>Siapkan SPD, kuitansi dan rincian biaya. Pantau sisa pagu di sini.</p></div>${btn('+ Buat SPPD', 'new')}</div></div><div class="cards">${cards.map(([l,n,c],i) => `<div class="card kpi kpi-${i}"><div class="kpi-head"><small>${l}</small><span class="kpi-icon">${uiIcon(['list','clock','check','done'][i])}</span></div><strong class="${c} budget-kpi">${n}</strong><span class="kpi-caption">${['KODE_REK · SIPD','Pemakaian awal + SPD terbit','Tidak termasuk draft','Termasuk draft'][i]}</span></div>`).join('')}</div><div class="panel"><div class="section-title"><h2>Anggaran per subkegiatan</h2>${btn('Lihat pagu', 'budget', '', 'ghost small')}</div>${budgetWarning()}${budgetTable()}</div><div class="panel"><div class="section-title"><h2>Perjalanan terbaru</h2>${btn('Lihat semua', 'list', '', 'ghost small')}</div>${tableRows(t.slice(0,8))}</div>`;
    }

    function list() {
        const t = boot.trips.filter(r => (view !== 'check' || ['PERIKSA', 'SIAP_BAYAR', 'PERBAIKAN', 'DIBAYAR', 'ARSIP'].includes(r.status)) && (!listStatus || r.status === listStatus) && (!listQuery || (r.purpose + ' ' + r.destination).toLowerCase().includes(listQuery.toLowerCase())));
        return top(view === 'check' ? 'Ruang bendahara' : 'Riwayat perjalanan', view === 'check' ? 'Periksa kelengkapan, beri catatan, dan pantau pembayaran.' : 'Lihat perkembangan setiap pengajuan.', has('OPERATOR', 'ADMIN_OPD') ? btn('+ Buat baru', 'new') : '') + `<div class="panel"><div class="toolbar"><input id="listQuery" placeholder="Cari kegiatan atau tujuan…" value="${e(listQuery)}"><select id="listStatus" style="max-width:220px"><option value="">Semua status</option>${Object.entries(status).filter(([k]) => stages.includes(k) || k === 'BATAL' || boot.trips.some(t => t.status === k)).map(([k, v]) => `<option value="${k}" ${listStatus === k ? 'selected' : ''}>${v}</option>`).join('')}</select>${btn('Perbarui', 'refresh', '', 'ghost small')}</div><div id="listRows">${tableRows(t)}</div></div>`;
    }

    // Formulir perjalanan dan perhitungan biaya
    function ratesFor(d) {
        return boot.rates.filter(r => String(r.year) === d.start.slice(0, 4) && String(r.validFrom) <= d.start && r.name === 'Uang Harian Perjalanan Dinas Luar Daerah ' + d.province && r.spec === d.category).sort((a, b) => String(b.validFrom).localeCompare(String(a.validFrom)));
    }
    const costLabels = ['Bensin', 'Tol dan parkir', 'Sewa kendaraan', 'Tiket pesawat', 'Penginapan', 'Lainnya'];

    function newDraft() {
        return {
            requestId: crypto.randomUUID(),
            origin: 'Kota Bogor',
            destination: '',
            province: '',
            category: 'Luar Kota',
            purpose: '',
            activity: '',
            account: '',
            budgetKey: '',
            transport: '',
            start: today(),
            end: today(),
            issued: today(),
            mode: 'manual',
            participants: []
        };
    }

    function makeDraft(d) {
        return { ...d, participants: d.participants.map(p => ({
                employeeId: p.employeeId,
                number: p.number || '',
                rateKey: p.rateKey,
                costs: costLabels.map(label => ({
                    label,
                    amount: p.costs?.find(c => c.label === label)?.amount || 0,
                    note: p.costs?.find(c => c.label === label)?.note || ''
                })),
                advance: p.advance || 0
            })) };
    }

    function officeReady() {
        const office = boot.masters.office;
        const sub = ((view === 'new' ? draft?.budgetKey : current?.budgetKey) || '').split('|')[1];
        const pptk = office?.pptkBySub?.[sub];
        return !!office && ['name', 'kpaName', 'bendName'].every(key => String(office[key] || '').trim()) && (!sub || !!(pptk?.name && pptk?.nip));
    }

    function preparationNotice() {
        const items = [];
        const masterLink = has('ADMIN_OPD') ? btn('Buka Pegawai & pejabat', 'master', '', 'ghost small') : '';
        if (!officeReady()) items.push(`<div>Nama pejabat belum lengkap. Draft boleh disimpan, tetapi lengkapi pejabat sebelum menerbitkan SPD.</div>${masterLink}`);
        if (!boot.masters.employees.length) items.push(`<div>Belum ada pegawai. Tambahkan pegawai terlebih dahulu untuk memilih peserta.</div>${masterLink}`);
        if (!boot.rates.length) items.push(`<div>Tarif SBU tahun ${e(year)} belum aktif. Aktifkan tarif agar biaya dapat dihitung.</div>${globalRole('ADMIN_SHS') ? btn('Buka Standar biaya (SBU)', 'rates', '', 'ghost small') : ''}`);
        return items.length ? `<div class="notice setup-notice">${items.map(item => `<div class="setup-item">${item}</div>`).join('')}</div>` : '';
    }

    function form() {
        const d = draft, provs = [...new Set(boot.rates.map(r => r.name.replace('Uang Harian Perjalanan Dinas Luar Daerah ', '')))].sort();
        return top(d.id ? 'Ubah draft' : 'Buat perjalanan dinas', 'Isi data sekali. SPD, kuitansi dan rincian biaya disiapkan otomatis.', btn('Kembali', 'list', '', 'ghost')) + preparationNotice() + `<div class="panel"><h2>1. Informasi perjalanan</h2><div class="grid">${field('Tempat berangkat', 'origin', d.origin)}${field('Kota / kabupaten tujuan', 'destination', d.destination)}${select('Provinsi tujuan', 'province', provs, d.province)}${select('Jenis perjalanan', 'category', ['Luar Kota', 'Diklat'], d.category)}${field('Tanggal berangkat', 'start', d.start, 'date')}${field('Tanggal kembali', 'end', d.end, 'date')}${field('Tanggal SPD', 'issued', d.issued, 'date')}${field('Alat angkutan', 'transport', d.transport)}<div class="wide"><label>Maksud dan tujuan perjalanan</label><textarea name="purpose">${e(d.purpose)}</textarea></div><div class="wide">${searchSelect('Rekening perjalanan dinas / subkegiatan', 'budgetKey', budgetRows().map(b => ({v:b.key,l:b.activity + ' · ' + b.account + ' · ' + b.fundName})), d.budgetKey || '', 'Cari subkegiatan atau kode rekening…')}<div class="notice info" id="budgetHint"></div></div></div><div class="notice info" id="rateHint"></div></div><div class="panel"><div class="section-title"><h2>2. Peserta & rincian biaya</h2>${btn('+ Tambah pegawai', 'addPerson', '', 'ghost')}</div><p>Masukkan biaya per peserta. Biaya kendaraan bersama dicatat pada satu peserta yang bertanggung jawab, jangan digandakan.</p><div id="people"></div><div class="total"><div><small>Total perjalanan</small><div id="daysText"></div></div><strong id="grandTotal">Rp 0</strong></div></div><div class="panel"><h2>3. Penomoran SPD</h2>${select('Cara penomoran', 'mode', [{ v: 'manual', l: 'Manual — dari register resmi' }, { v: 'auto', l: 'Otomatis — register OPD' }], d.mode)}<p>Nomor otomatis mengikuti nomor urut yang diatur admin. Draft belum memperoleh nomor resmi.</p></div><div class="panel"><h2>4. Surat perintah (opsional)</h2><p>Unggah PDF jika sudah ada. Jika belum, bisa menyusul dari riwayat SPPD.</p><input type="file" id="draftLetter" accept="application/pdf"></div><div class="actions">${btn('Simpan draft', 'saveDraft')}${btn('Batal', 'list', '', 'ghost')}</div>`;
    }

    function people() {
        const d = draft, rt = ratesFor(d)[0];
        $('#people').innerHTML = d.participants.length ? d.participants.map((p, i) => `<div class="person"><div class="section-title"><h3>Peserta ${i + 1}</h3>${btn('Hapus', 'removePerson', `data-i="${i}"`, 'danger small')}</div><div class="grid">${searchSelect('Pegawai', `employee-${i}`, boot.masters.employees.map(x => ({ v: x.id, l: x.name + ' · ' + x.nip })), p.employeeId, 'Cari nama atau NIP…')}${d.mode === 'manual' ? field('Nomor SPD (dapat diisi nanti)', `number-${i}`, p.number) : '<div class="field"><label>Nomor SPD</label><input readonly value="Diisi saat penerbitan"></div>'}<div class="field"><label>Uang harian per hari</label><input readonly value="${rt ? rup(rt.rate) : 'Tarif belum tersedia'}"></div>${field('Uang muka (Rp)', `advance-${i}`, p.advance, 'number', 'min="0" step="1"')}</div><details ${p.costs.some(c => +c.amount > 0) ? 'open' : ''}><summary style="cursor:pointer;margin-top:12px;font-weight:650">Biaya transportasi, penginapan, dan lainnya</summary><div class="grid" style="margin-top:12px">${p.costs.map((c, j) => field(c.label + ' (Rp)', `cost-${i}-${j}`, c.amount, 'number', 'min="0" step="1"') + field('Keterangan / dasar biaya', `note-${i}-${j}`, c.note)).join('')}</div></details><div class="between" style="margin-top:12px"><span class="muted">Subtotal peserta</span><b id="sub-${i}">Rp 0</b></div></div>`).join('') : '<div class="empty">Belum ada peserta. Klik Tambah pegawai.</div>';
        totals();
    }

    function totals() {
        const d = draft, rt = ratesFor(d)[0], days = Math.round((Date.parse(d.end) - Date.parse(d.start)) / 86400000) + 1, n = Number.isFinite(days) && days > 0 ? days : 0;
        let total = 0;
        d.participants.forEach((p, i) => {
            p.rateKey = rt?.key || '';
            let value = n * (rt?.rate || 0) + p.costs.reduce((s, c) => s + Math.max(0, +c.amount || 0), 0);
            total += value;
            if ($('#sub-' + i))
                $('#sub-' + i).textContent = rup(value);
        });
        $('#grandTotal').textContent = rup(total);
        const b = budgetRows().find(x => x.key === d.budgetKey);
        const hint = $('#budgetHint');
        if (hint) {
            if (!b) hint.textContent = 'Pilih rekening perjalanan dinas sesuai kegiatan.';
            else if (!b.confirmed || boot.budget?.unmatched) hint.textContent = 'Saldo belum dipastikan admin. Draft bisa disimpan, penerbitan belum bisa dilakukan.';
            else hint.textContent = 'Pagu: ' + rup(b.pagu) + ' · Sisa sebelum SPD: ' + rup(b.remaining) + ' · Setelah SPD ini: ' + rup(b.remaining - total) + (total > b.remaining ? ' — Pagu tidak cukup.' : '');
            if (b) {
                const pptk = boot.masters.office?.pptkBySub?.[b.sub];
                hint.textContent += ' · PPTK: ' + (pptk?.name || 'belum diatur');
            }
            hint.classList.toggle('budget-alert', !!b && b.confirmed && total > b.remaining);
        }
        $('#daysText').textContent = n + ' hari · ' + d.participants.length + ' pegawai';
        $('#rateHint').textContent = rt ? `Tarif SBU: ${rup(rt.rate)} / orang / hari · ${rt.spec} · ${rt.source}` : 'Tarif SBU belum tersedia untuk tujuan, jenis perjalanan, dan tanggal ini. Hubungi admin.';
    }

    // Detail perjalanan dan penyesuaian biaya
    function adjustment() {
        const d = current;
        return top('Sesuaikan biaya riil', 'Nomor SPD dan tarif uang harian tetap. Catat alasan perubahan.', btn('Kembali', 'backDetail', '', 'ghost')) + `<div class="panel" id="adjustForm">${d.participants.map((p, i) => `<div class="person"><h3>${e(p.name)} · Uang harian ${rup(p.daily)}</h3><div class="grid">${p.costs.map((c, j) => field(c.label + ' (Rp)', `adj-${i}-${j}`, c.amount, 'number', 'min="0"') + field('Keterangan', `adjNote-${i}-${j}`, c.note)).join('')}${field('Uang muka (Rp)', `adv-${i}`, p.advance, 'number', 'min="0"')}</div></div>`).join('')}${field('Alasan perubahan', 'reason')}${btn('Simpan biaya riil', 'saveAdjustment')}</div>`;
    }

    function detail() {
        const d = current, op = has('OPERATOR', 'ADMIN_OPD');
        let action = '';
        const tr = (l, to, cls = '') => btn(l, 'transition', `data-to="${to}"`, cls);
        if (d.status === 'DRAFT' && op) action = btn('Ubah draft', 'edit', '', 'ghost') + btn('Terbitkan SPD', 'issue');
        if (d.status === 'SIAP_CETAK' && op) action = tr('Lanjut lengkapi berkas', 'SPJ');
        if (d.status === 'SPJ' && op) action = tr('Tandai selesai', 'ARSIP');
        if (['DRAFT', 'SIAP_CETAK', 'SPJ'].includes(d.status) && has('ADMIN_OPD')) action += tr('Batalkan SPD', 'BATAL', 'danger');
        return top(d.purpose, `${d.destination} · ${date(d.start)} — ${date(d.end)}`, btn('Kembali', 'list', '', 'ghost')) + `<div class="panel"><div class="section-title"><h2>Progres perjalanan</h2>${pill(d.status)}</div>${pipe(d.status)}${d.status === 'DRAFT' && !officeReady() ? preparationNotice() : ''}<p class="hint">${e(d.activity)} · ${e(d.account)} · Dibuat oleh ${e(d.createdBy || '—')}</p><div class="actions">${action}${['SIAP_CETAK', 'SPJ'].includes(d.status) && op ? btn('Sesuaikan biaya riil', 'adjustCosts', '', 'ghost') : ''}</div></div><div class="panel"><div class="section-title"><h2>Dokumen perjalanan</h2>${d.status !== 'BATAL' ? btn('Cetak semua / Simpan PDF', 'print', 'data-kind="all"') : ''}</div><p>${d.status === 'DRAFT' ? 'Pratinjau draft. Terbitkan nomor SPD sebelum menandatangani.' : 'Cetak dokumen, lalu lengkapi tanda tangan dan cap sesuai ketentuan.'}</p><div class="table-wrap"><table><thead><tr><th>Pegawai</th><th>Nomor SPD</th><th>Biaya</th><th>Dokumen</th></tr></thead><tbody>${d.participants.map(p => `<tr><td><b>${e(p.name)}</b><small>${e(p.nip)}</small></td><td>${e(p.number || 'Belum terbit')}</td><td>${rup(p.total)}</td><td><div class="actions">${(d.status === 'BATAL' ? [] : [['SPD', 'spd'], ['Kuitansi', 'receipt'], ['Rincian', 'detail']]).map(([l, k]) => btn(l, 'print', `data-kind="${k}" data-emp="${e(p.employeeId)}"`, 'ghost small')).join('')}</div></td></tr>`).join('')}</tbody></table></div><div class="total"><span>Total biaya perjalanan</span><strong>${rup(d.total)}</strong></div>${d.paymentNote ? `<p>Catatan pembayaran: ${e(d.paymentNote)}</p>` : ''}</div><div class="panel"><h2>Surat perintah & lampiran</h2><p class="hint">Boleh diunggah menyusul. Tidak menghalangi pembuatan SPD.</p><div class="files">${(d.files || []).map(f => `<div class="file"><span>${e(f.name)}</span>${btn('Unduh', 'download', `data-id="${e(f.id)}"`, 'ghost small')}</div>`).join('') || '<p>Belum ada berkas.</p>'}</div>${['DRAFT', 'SIAP_CETAK', 'SPJ', 'ARSIP'].includes(d.status) && op ? `<div class="actions" style="margin-top:15px"><input type="file" id="upload" accept="application/pdf" style="max-width:400px">${btn('Unggah PDF', 'upload')}</div><p class="hint">Surat perintah, SPD bertanda tangan, atau bukti pendukung. PDF maksimal 4 MB per file.</p>` : ''}</div><div class="panel"><h2>Riwayat proses</h2><div class="history">${(d.history || []).slice().reverse().map(h => `<div><b>${e(status[h.action] || h.action)}</b><small>${e(h.actor)} · ${e(h.at)}</small>${h.note ? `<p>${e(h.note)}</p>` : ''}</div>`).join('') || '<p>Belum ada riwayat.</p>'}</div></div>`;
    }

    // Master OPD, pegawai dan SBU
    const officeFields = [['Nama resmi OPD', 'name'], ['Unit / bagian', 'unit'], ['Alamat / kontak kop surat', 'address'], ['Nama PA / KPA', 'kpaName'], ['NIP PA / KPA', 'kpaNip'], ['Pangkat PA / KPA', 'kpaRank'], ['Jabatan penandatangan', 'kpaTitle'], ['Nama PPTK', 'pptkName'], ['NIP PPTK', 'pptkNip'], ['Nama bendahara', 'bendName'], ['NIP bendahara', 'bendNip'], ['Jabatan bendahara', 'bendTitle']];

    function pptkFields(o, subs) {
        const choices = boot.masters.employees.map(p => ({ v: p.id, l: p.name + ' · ' + p.nip }));
        return `<div class="wide master-group"><h3>PPTK per subkegiatan</h3><p class="hint">Pilih pegawai atau isi manual. PPTK otomatis mengikuti rekening yang dipilih saat membuat SPD.</p>${o.pptkName ? `<p class="hint">PPTK lama: ${e(o.pptkName)}. Tetapkan pada subkegiatan yang sesuai.</p>` : ''}</div>` + subs.map(([sub, label], i) => {
            const person = o.pptkBySub?.[sub] || {};
            return `<div class="wide master-group" data-pptk-sub="${e(sub)}"><h4>${e(label)}</h4><p class="hint">${e(sub)}</p><div class="grid">${searchSelect('Pilih pegawai (opsional)', 'pptkPick-' + i, choices, '', 'Cari nama atau NIP…')}${field('Nama PPTK', 'pptkName-' + i, person.name || '')}${field('NIP PPTK', 'pptkNip-' + i, person.nip || '')}</div></div>`;
        }).join('');
    }

    function master() {
        const o = boot.masters.office || {}, cfgNum = boot.masters.number.find(n => String(n.year) === year) || {};
        const [prefix, suffix = ''] = String(cfgNum.pattern || '{urut}').split('{urut}');
        const subs = [...new Map(budgetRows().map(b => [b.sub, b.activity])).entries()];
        const heading = top('Pegawai & pejabat', 'Isi identitas satu kali. Data dipakai kembali saat membuat dokumen. Tidak terkait akun pengguna.');
        const group = (prefix, title) => `<div class="wide master-group"><h3>${title}</h3></div>${officeFields.filter(([l,k]) => k.startsWith(prefix)).map(([l,k]) => field(l,k,o[k] || '')).join('')}`;
        return heading + `<div class="panel"><h2>Identitas Bagian PBJ dan penandatangan</h2><div class="grid" id="officeForm">${field('Nama resmi OPD', 'name', o.name || 'SEKRETARIAT DAERAH')}${field('Unit / bagian', 'unit', unitName, 'text', 'readonly')}${field('Alamat / kontak kop surat', 'address', o.address || kopAddress)}${group('kpa','PA / KPA')}${pptkFields(o, subs)}${group('bend','Bendahara (identitas penandatangan saja)')}</div><div class="actions" style="margin-top:15px">${btn('Simpan identitas & pejabat', 'saveOffice')}</div></div>${opd ? `<div class="panel"><div class="section-title"><h2>Master pegawai (${boot.masters.employees.length})</h2>${btn('Ambil pegawai dari sheet', 'syncEmployees')}</div><p class="hint">Ambil pegawai Bagian PBJ dari sheet Pegawai. Data manual dan pegawai yang sudah tersimpan tidak ditimpa.</p><div class="grid" id="empForm">${field('Nama lengkap', 'name').replaceAll('f-name', 'f-emp-name')}${field('NIP', 'nip')}${field('Pangkat / golongan', 'rank')}${field('Jabatan', 'position')}${field('Tingkat biaya perjalanan', 'level')}<input name="id" type="hidden"></div><div class="actions" style="margin-top:15px">${btn('Simpan pegawai', 'saveEmp')}${btn('Kosongkan', 'clearEmp', '', 'ghost')}</div><input type="search" id="employeeSearch" placeholder="Cari nama, NIP atau jabatan pegawai…" style="margin-top:15px"><div class="table-wrap" style="margin-top:15px"><table id="employeeTable"><thead><tr><th>Nama</th><th>NIP</th><th>Jabatan</th><th></th></tr></thead><tbody>${boot.masters.employees.map(p => `<tr><td>${e(p.name)}</td><td>${e(p.nip)}</td><td>${e(p.position)}</td><td>${btn('Ubah', 'editEmp', `data-id="${e(p.id)}"`, 'ghost small')}</td></tr>`).join('')}</tbody></table></div></div><div class="panel"><h2>Register SPD otomatis</h2><div class="notice">Gunakan pola penomoran yang telah disetujui tata usaha. Jangan membuat register ganda dengan SRIKANDI. Nomor manual tetap dicatat.</div><div class="grid" id="numForm">${field('Tahun', 'year', year, 'number')}${field('Awalan nomor (opsional)', 'prefix', prefix)}${field('Akhiran nomor (opsional)', 'suffix', suffix)}${field('Nomor urut berikutnya', 'next', cfgNum.next || 1, 'number', 'min="1"')}<div class="wide notice info">Contoh nomor berikutnya: <b id="numberPreview">${e((prefix + (cfgNum.next || 1) + suffix).replaceAll('{tahun}', year))}</b><br>Kosongkan awalan dan akhiran jika nomor hanya 1, 2, 3, dst. Untuk nomor manual, tidak perlu mengisi pengaturan ini.</div>${select('Aktifkan penomoran otomatis', 'enabled', [{ v: 'false', l: 'Tidak, gunakan nomor manual' }, { v: 'true', l: 'Ya, gunakan nomor otomatis' }], String(cfgNum.enabled === true))}</div><div class="actions" style="margin-top:15px">${btn('Simpan register', 'saveNum')}</div></div>` : ''}`;
    }

    function rates() {
        const versions = [...new Map(rateRows.map(r => [String(r.validFrom).slice(0, 10), { v: String(r.validFrom).slice(0, 10), l: String(r.validFrom).slice(0, 10) + ' — ' + r.source }])).values()];
        const importForm = rateImportForm || { year: rateYear, validFrom: rateYear + '-01-01', source: '' };
        const shown = rateRows.filter(r => !rateQuery || (r.name + ' ' + r.spec + ' ' + r.id).toLowerCase().includes(rateQuery.toLowerCase()));
        return top('Standar biaya perjalanan dinas', 'Sumber tarif untuk perhitungan. Tarif aktif tidak ditimpa.') + `<div class="panel"><h2>Impor SBU Kota Bogor</h2><p>2.129 item dari lampiran SBU disiapkan sebagai data awal. Tentukan tahun dan tanggal berlaku serta dasar hukum yang benar sebelum diaktifkan.</p><div class="grid" id="rateForm">${field('Tahun anggaran', 'year', importForm.year, 'number')}${field('Mulai berlaku', 'validFrom', importForm.validFrom, 'date')}${field('Nomor / judul dasar hukum', 'source', importForm.source, 'text', 'placeholder="Isi sesuai dokumen resmi"')}</div><div class="actions" style="margin-top:15px">${btn('Impor lampiran SBU', 'importRates')}${btn('Muat daftar tarif', 'loadRates', '', 'ghost')}${btn('+ Tambah item SBU', 'addRate', '', 'ghost')}</div><div class="notice info" style="margin-top:12px">${versions.length ? 'Impor selesai. Pilih versi yang sudah diperiksa di bawah untuk mengaktifkannya.' : 'Belum ada tarif tersimpan. Isi dasar hukum sesuai SBU resmi, lalu klik Impor lampiran SBU.'}</div>${versions.length ? `<div id="rateVersionForm" class="grid">${select('Versi tarif tersimpan', 'version', versions, versions[versions.length-1].v)}</div>${btn('Aktifkan tarif terpilih', 'activateRates')}` : ''}</div><div class="panel"><div class="section-title"><h2>Daftar tarif</h2><span class="hint">${shown.length} dari ${rateRows.length} item</span></div><input id="rateQuery" placeholder="Cari provinsi, nama atau spesifikasi…" value="${e(rateQuery)}"><div id="rateList">${ratesTable(shown)}</div></div>`;
    }

    function addRateForm() {
        return top('Tambah item SBU', 'Masukkan tarif sesuai dasar hukum resmi.', btn('Kembali', 'backRates', '', 'ghost')) + `<div class="panel"><div class="grid" id="newRateForm">${field('Tahun anggaran', 'year', year, 'number')}${field('Mulai berlaku', 'validFrom', year + '-01-01', 'date')}${field('Dasar hukum', 'source')}${field('ID item SBU (gunakan ID yang sama untuk versi baru)', 'id')}${field('Nama item', 'name')}${field('Spesifikasi', 'spec')}${field('Satuan', 'unit')}${field('Tarif (Rp)', 'rate', '', 'number', 'min="0"')}${field('Kelompok', 'group')}${field('Kode barang / jasa', 'code')}${field('Kode rekening', 'account')}</div><p>Uang harian luar daerah: nama item harus mengikuti pola pada lampiran SBU, misalnya Uang Harian Perjalanan Dinas Luar Daerah DKI Jakarta, spesifikasi Luar Kota atau Diklat.</p>${btn('Simpan sebagai tarif belum aktif', 'saveRate')}</div>`;
    }

    function ratesTable(rows) {
        return `<div class="table-wrap"><table><thead><tr><th>Item / spesifikasi</th><th>Satuan</th><th>Tarif</th><th>Versi</th><th></th></tr></thead><tbody>${rows.slice(0, 120).map(r => `<tr><td><b>${e(r.name)}</b><small>${e(r.spec)} · ${e(r.id)}</small></td><td>${e(r.unit)}</td><td>${rup(r.rate)}</td><td>${e(r.validFrom)}<small>${r.active ? 'Aktif' : 'Belum aktif'}</small></td><td>${r.active ? '' : btn('Ubah tarif', 'editRate', `data-id="${e(r.key)}"`, 'ghost small')}</td></tr>`).join('')}</tbody></table></div><p class="hint">Maksimal 120 baris ditampilkan. Gunakan pencarian untuk item lainnya.</p>`;
    }

    // Hak akses dan register
    function access() {
        const names = new Map((directory?.users || []).map(x => [x.id, x]));
        const accounts = (directory?.users || []).filter(x => x.role !== 'BENDAHARA').map(x => ({ v: x.id, l: `${x.name} · ${x.username} · ${x.opd || 'Tanpa OPD'} · ${roleLabels[x.role] || x.role}` }));
        const choices = [{ v: 'PBJ', l: unitName }];
        return top('Hak akses SPPD', 'Berikan akses khusus kepada akun internal PBJ. Ini tidak mengubah role ORBITA.', btn('Perbarui daftar ORBITA', 'reloadDirectory', '', 'ghost')) +
            `<div class="panel"><h2>Tambah atau ubah akses</h2>${directoryError ? `<p class="notice">${e(directoryError)}</p>` : ''}<div class="grid" id="grantForm">
            ${searchSelect('Akun ORBITA', 'userId', accounts, '', 'Cari nama atau username…')}${searchSelect('OPD', 'opd', choices, opd, 'Cari OPD…')}
            <div class="wide"><label>Pilih kewenangan</label><div class="actions">${roles.map(r => `<label style="display:flex;gap:6px;align-items:center"><input type="checkbox" style="width:auto" name="roles" value="${r}">${roleLabels[r]}</label>`).join('')}</div></div>
            ${select('Status akses', 'active', [{v:'true',l:'Aktif'},{v:'false',l:'Nonaktif'}], 'true')}</div>${btn('Simpan hak akses', 'grant')}</div>
            <div class="panel"><h2>Daftar akses</h2><input type="search" id="accessSearch" placeholder="Cari nama, OPD atau role…"><div class="table-wrap"><table id="accessTable"><thead><tr><th>Akun</th><th>OPD</th><th>Hak akses</th><th>Status</th><th></th></tr></thead><tbody>${accessRows.filter(r => ['PBJ','BAGIAN PENGADAAN BARANG DAN JASA','*'].includes(String(r.opd).toUpperCase())).map(r => `<tr><td><b>${e(names.get(String(r.user_id))?.name || r.user_id)}</b><small>${e(names.get(String(r.user_id))?.username || '')}</small></td><td>${e(r.opd)}</td><td>${e(String(r.roles).split(',').map(x => roleLabels[x] || x).join(', '))}</td><td>${r.active === true || String(r.active).toLowerCase() === 'true' ? 'Aktif' : 'Nonaktif'}</td><td>${btn('Ubah', 'editGrant', `data-user="${e(r.user_id)}" data-opd="${e(r.opd)}"`, 'ghost small')}</td></tr>`).join('')}</tbody></table></div></div>`;
    }

    function register() {
        return top('Register SPD', 'Nomor manual dan otomatis tercatat di sini.', btn('Unduh CSV', 'exportRegister')) + `<div class="panel"><div class="table-wrap"><table><thead><tr><th>Nomor SPD</th><th>Tahun</th><th>Cara penomoran</th><th>Dicatat</th></tr></thead><tbody>${registerRows.map(r => `<tr><td>${e(r.number)}</td><td>${e(r.year)}</td><td>${r.mode === 'auto' ? 'Otomatis' : 'Manual'}</td><td>${e(r.created)}</td></tr>`).join('')}</tbody></table></div></div>`;
    }

    // Pembaruan tampilan
    function render() {
        nav();
        main.innerHTML = view === 'home' ? home() : ['list', 'check'].includes(view) ? list() : view === 'new' ? form() : view === 'detail' ? detail() : view === 'adjust' ? adjustment() : view === 'master' ? master() : view === 'rates' ? rates() : view === 'addRate' ? addRateForm() : view === 'access' ? access() : view === 'budget' ? budgetPage() : view === 'register' ? register() : home();
        if (view === 'new' && $('#people'))
            people();
        document.body.classList.remove('menu');
    }

    function formData(id) {
        const o = {};
        $(id).querySelectorAll('input,select,textarea').forEach(el => {
            if (el.type !== 'checkbox')
                o[el.name] = el.value;
        });
        return o;
    }

    // Pembacaan dan sinkronisasi data
    async function loadDetail(id) {
        const d = await api('detail', { id });
        current = d;
        const summary = {
            id: d.id,
            status: d.status,
            updated: d.updated,
            purpose: d.purpose,
            destination: d.destination,
            start: d.start,
            end: d.end,
            total: d.total,
            people: d.participants.length,
            year: d.year, budgetKey: d.budgetKey, createdBy: d.createdBy
        };
        boot.trips = [summary, ...boot.trips.filter(r => r.id !== id)];
        view = 'detail';
        render();
    }

    async function refreshList() {
        if (!opd)
            return;
        const at = epoch, office = opd;
        const response = await api('pulse', { revision: '', budgetVersion: '' });
        const t = response.trips || boot.trips;
        if (at === epoch && office === opd && response.budget) { boot.budget = response.budget; boot.budgetVersion = response.budgetVersion; boot.revision = response.revision; }
        if (at !== epoch || office !== opd)
            return;
        const changed = JSON.stringify(t) !== JSON.stringify(boot.trips);
        boot.trips = t;
        if ((changed || response.budget) && ['home', 'list', 'budget'].includes(view))
            render();
        synced();
    }

    async function refreshBoot() {
        boot = await api('boot');
        render();
        synced();
    }

    function notify() {
        try {
            channel?.postMessage({ opd });
        }
        catch (_) { }
        refreshList().catch(() => { });
    }

    // Perpindahan halaman
    async function go(v) {
        if (view === 'new' && formDirty && !confirm('Ada perubahan draft yang belum disimpan. Tinggalkan halaman?'))
            return;
        formDirty = false;
        if (v === 'new') {
            draft = newDraft();
            view = 'new';
            render();
            return;
        }
        view = v;
        listStatus = '';
        listQuery = '';
        if (v === 'access' && globalRole('SUPERADMIN') && !directory) {
            nav();
            main.innerHTML = '<div class="panel"><p>Memuat daftar OPD dan akun ORBITA…</p><div class="loading-line"><i></i></div></div>';
        } else render();
        if (v === 'register') {
            try {
                registerRows = await api('register');
                if (view === v)
                    render();
            }
            catch (err) {
                toast(err.message, true);
            }
        }
        if (v === 'access' && globalRole('SUPERADMIN')) {
            if (!directory) {
                sync('Memuat daftar ORBITA…', true);
                await loadDirectory();
                if (view === v) render();
                if (directory) synced(); else sync('Daftar ORBITA belum dimuat', true);
            }
        }
        if (v === 'rates') {
            try {
                rateRows = await api('rates', { year: rateYear, admin: true });
                if (view === v)
                    render();
            }
            catch (err) {
                toast(err.message, true);
            }
        }
    }

    // Event formulir
    main.addEventListener('input', ev => {
        const el = ev.target;
        if (el.dataset.searchSelect) {
            const target = document.getElementById(el.dataset.searchSelect);
            const q = el.value.trim().toLocaleLowerCase('id');
            if (target) for (const option of target.options) option.hidden = !!option.value && !option.selected && !option.textContent.toLocaleLowerCase('id').includes(q);
            return;
        }
        if (['employeeSearch', 'accessSearch'].includes(el.id)) {
            const table = $(el.id === 'employeeSearch' ? '#employeeTable' : '#accessTable');
            if (table) for (const row of table.querySelectorAll('tbody tr')) row.hidden = !row.textContent.toLowerCase().includes(el.value.toLowerCase());
            return;
        }
        if (el.id === 'listQuery') {
            listQuery = el.value;
            const focus = el.selectionStart;
            $('#listRows').innerHTML = tableRows(boot.trips.filter(r => (view !== 'check' || ['PERIKSA', 'SIAP_BAYAR', 'PERBAIKAN', 'DIBAYAR', 'ARSIP'].includes(r.status)) && (!listStatus || r.status === listStatus) && (r.purpose + ' ' + r.destination).toLowerCase().includes(listQuery.toLowerCase())));
            return;
        }
        if (el.id === 'rateQuery') {
            rateQuery = el.value;
            $('#rateList').innerHTML = ratesTable(rateRows.filter(r => (r.name + ' ' + r.spec + ' ' + r.id).toLowerCase().includes(rateQuery.toLowerCase())));
            return;
        }
        if (view === 'master' && ['prefix', 'suffix', 'next'].includes(el.name)) {
            const fields = formData('#numForm');
            $('#numberPreview').textContent = ((fields.prefix || '') + (fields.next || '1') + (fields.suffix || '')).replaceAll('{tahun}', fields.year || year);
        }
        if (view !== 'new' || !el.name)
            return;
        const k = el.name, v = el.value;
        formDirty = true;
        const m = k.match(/^(employee|number|advance|cost|note)-(\d+)(?:-(\d+))?$/);
        if (m) {
            const p = draft.participants[+m[2]];
            if (m[1] === 'employee')
                p.employeeId = v;
            else if (m[1] === 'cost')
                p.costs[+m[3]].amount = v;
            else if (m[1] === 'note')
                p.costs[+m[3]].note = v;
            else
                p[m[1]] = v;
            totals();
        }
        else {
            draft[k] = v;
            if (['province', 'category', 'start', 'mode'].includes(k)) {
                if (k === 'start' && v.slice(0, 4) !== year) {
                    year = v.slice(0, 4);
                    draft.budgetKey = '';
                    api('boot').then(b => {
                        if (view === 'new' && draft.start.slice(0, 4) === year) {
                            boot = b;
                            render();
                        }
                    }).catch(err => toast(err.message, true));
                }
                people();
            }
            else
                totals();
        }
    });
    main.addEventListener('change', ev => {
        const el = ev.target;
        if (view === 'master' && /^pptkPick-/.test(el.name)) {
            const person = boot.masters.employees.find(x => x.id === el.value);
            const group = el.closest('[data-pptk-sub]');
            if (person && group) {
                group.querySelector('[name^=pptkName-]').value = person.name;
                group.querySelector('[name^=pptkNip-]').value = person.nip;
            }
        }
        if (view === 'master' && /^(kpa|pptk|bend)Employee$/.test(el.name)) {
            const prefix = el.name.replace('Employee','');
            const person = boot.masters.employees.find(x => x.id === el.value);
            if (person) for (const [key, value] of Object.entries({Name:person.name,Nip:person.nip,Rank:person.rank,Title:person.position})) {
                const field = $('#f-' + prefix + key);
                if (field) field.value = value || '';
            }
        }
        if (view === 'master' && el.name === 'bendUserId' && el.value) {
            const account = directory?.users.find(x => x.id === el.value);
            if (account) $('#f-bendName').value = account.name;
        }
        if (view === 'access' && el.name === 'userId') {
            const account = directory?.users.find(x => x.id === el.value);
            if (account) {
                $('#f-opd').value = 'PBJ';
                $('#grantForm').querySelectorAll('input[name="roles"]').forEach(x => x.checked = x.value === 'OPERATOR');
            }
        }
        if (ev.target.id === 'budgetYear') {
            year = ev.target.value;
            work(null, 'Memuat tahun anggaran…', refreshBoot);
            return;
        }
        if (ev.target.id === 'listStatus') {
            listStatus = ev.target.value;
            render();
        }
    });
    $('#nav').addEventListener('click', ev => {
        const b = ev.target.closest('[data-nav]');
        if (b && !pending)
            go(b.dataset.nav);
    });
    $('#hamb').onclick = () => {
        if (matchMedia('(max-width: 900px)').matches) document.body.classList.toggle('menu');
        else {
            const hidden = document.body.classList.toggle('sidebar-hidden');
            try { localStorage.setItem('orbita_sppd_sidebar', hidden ? '1' : '0'); } catch (_) {}
            $('#hamb').setAttribute('aria-expanded', String(!hidden));
        }
    };
    try { if (localStorage.getItem('orbita_sppd_sidebar') === '1') document.body.classList.add('sidebar-hidden'); } catch (_) {}
    $('#office').onchange = ev => {
        if (formDirty && !confirm('Tinggalkan draft yang belum disimpan?')) {
            ev.target.value = opd;
            return;
        }
        formDirty = false;
        switchOffice(ev.target.value);
    };

    // Tindakan pengguna
    main.addEventListener('click', ev => {
        const b = ev.target.closest('[data-act]');
        if (!b || pending)
            return;
        const a = b.dataset.act, id = b.dataset.id;
        if (a === 'connectSession') {
            connectSession(b);
            return;
        }
        if (a === 'copyAddress') {
            const address = new URL(location.pathname, location.origin).href;
            navigator.clipboard.writeText(address).then(() => toast('Alamat disalin. Tempel di tab ORBITA yang sudah login.')).catch(() => prompt('Salin alamat SPPD:', address));
            return;
        }
        if (a === 'retry') {
            if (!openingSession) init();
            return;
        }
        if (['new', 'list', 'budget', 'master', 'rates'].includes(a)) {
            go(a);
            return;
        }
        if (a === 'refreshBudget') { work(b, 'Memperbarui…', refreshBoot); return; }
        if (a === 'refresh') {
            work(b, 'Memperbarui…', refreshList);
            return;
        }
        if (a === 'addPerson') {
            if (!boot.masters.employees.length) return toast('Tambahkan pegawai di menu Pegawai & pejabat terlebih dahulu.', true);
            if (draft.participants.length >= 30)
                return toast('Maksimal 30 peserta per pengajuan.', true);
            draft.participants.push({ employeeId: '', number: '', costs: costLabels.map(label => ({ label, amount: 0, note: '' })), advance: 0 });
            formDirty = true;
            people();
            return;
        }
        if (a === 'removePerson') {
            draft.participants.splice(+b.dataset.i, 1);
            formDirty = true;
            people();
            return;
        }
        if (a === 'adjustCosts') {
            view = 'adjust';
            render();
            return;
        }
        if (a === 'backDetail') {
            view = 'detail';
            render();
            return;
        }
        if (a === 'edit') {
            draft = makeDraft(current);
            formDirty = false;
            view = 'new';
            render();
            return;
        }
        if (a === 'exportRegister') {
            const quote = v => {
                let t = String(v ?? '');
                if (/^[=+@-]/.test(t))
                    t = "'" + t;
                return '"' + t.replace(/"/g, '""') + '"';
            };
            const csv = ['Nomor SPD,Tahun,Cara,Dicatat', ...registerRows.map(r => [r.number, r.year, r.mode, r.created].map(quote).join(','))].join('\n');
            const url = URL.createObjectURL(new Blob(['\ufeff', csv], { type: 'text/csv;charset=utf-8' }));
            const link = document.createElement('a');
            link.href = url;
            link.download = 'Register-SPD-' + year + '.csv';
            link.click();
            setTimeout(() => URL.revokeObjectURL(url), 1000);
            return;
        }
        if (a === 'print') {
            window.printSPPD(current, b.dataset.kind, b.dataset.emp);
            return;
        }
        if (a === 'addRate') {
            view = 'addRate';
            render();
            return;
        }
        if (a === 'backRates') {
            go('rates');
            return;
        }
        if (a === 'editEmp') {
            const p = boot.masters.employees.find(x => x.id === id);
            $('#empForm').querySelectorAll('input').forEach(el => el.value = p[el.name] || '');
            return;
        }
        if (a === 'clearEmp') {
            $('#empForm').querySelectorAll('input').forEach(el => el.value = '');
            return;
        }
        work(b, 'Memproses…', async () => {
            if (a === 'openingBudget') {
                const item = budgetRows().find(x => x.key === id);
                if (!item) return;
                const amount = prompt('Pemakaian sebelum aplikasi (rupiah, isi 0 bila belum ada):', String(item.opening));
                if (amount === null) return;
                if (!/^\d+$/.test(amount.trim())) throw Error('Isi angka rupiah tanpa titik atau koma.');
                const note = prompt('Keterangan / tanggal posisi pemakaian:', item.openingNote || '');
                if (!note?.trim() || !confirm('Simpan pemakaian awal? Jangan hitung ulang SPD yang sudah tercatat di aplikasi.')) return;
                await api('openingBudget', { key: id, amount: Number(amount), note, confirm: true });
                await refreshBoot();
                notify();
                toast('Pemakaian awal disimpan.');
                return;
            }
            if (a === 'detail') {
                await loadDetail(id);
                return;
            }
            if (a === 'saveAdjustment') {
                const x = formData('#adjustForm');
                await api('reviseCosts', {
                    id: current.id,
                    expectedUpdated: current.updated,
                    note: x.reason,
                    participants: current.participants.map((p, i) => ({
                        employeeId: p.employeeId,
                        advance: x['adv-' + i],
                        costs: p.costs.map((c, j) => ({ label: c.label, amount: x['adj-' + i + '-' + j], note: x['adjNote-' + i + '-' + j] }))
                    }))
                });
                await loadDetail(current.id);
                notify();
                toast('Biaya riil disimpan. Cetak ulang rincian dan kuitansi yang sesuai.');
                return;
            }
            if (a === 'saveDraft') {
                if (!draft.participants.length || draft.participants.some(p => !p.employeeId)) throw Error('Pilih peserta perjalanan terlebih dahulu.');
                if (!ratesFor(draft).length) throw Error('Tarif SBU untuk tujuan dan jenis perjalanan belum tersedia.');
                const file = $('#draftLetter')?.files[0];
                if (file && (file.size > 4 * 1024 * 1024 || file.type !== 'application/pdf')) throw Error('Surat perintah harus PDF maksimal 4 MB.');
                const d = await api('save', { id: draft.id, requestId: draft.requestId, expectedUpdated: draft.updated, data: draft });
                formDirty = false;
                let uploadError = '';
                if (file) {
                    try {
                        const base64 = await new Promise((resolve, reject) => {
                            const reader = new FileReader();
                            reader.onload = () => resolve(reader.result.split(',')[1]);
                            reader.onerror = reject;
                            reader.readAsDataURL(file);
                        });
                        await api('upload', { id: d.id, name: file.name, mime: 'application/pdf', base64 });
                    } catch (err) { uploadError = 'Draft tersimpan. Surat perintah belum terunggah; coba dari detail.'; }
                }
                await loadDetail(d.id);
                notify();
                toast(uploadError || 'Draft tersimpan.', !!uploadError);
                return;
            }
            if (a === 'issue') {
                if (!confirm('Terbitkan nomor SPD? Nomor resmi akan tercatat dan draft dikunci.'))
                    return;
                await api('issue', { id: current.id });
                await loadDetail(current.id);
                notify();
                toast('Nomor SPD tercatat. Dokumen siap dicetak.');
                return;
            }
            if (a === 'transition') {
                const to = b.dataset.to;
                let note = '', confirmValue = false;
                if (to === 'BATAL') {
                    note = prompt('Alasan pembatalan SPD:') || '';
                    if (!note.trim())
                        return;
                }
                if (to === 'ARSIP') {
                    confirmValue = confirm('Tandai dokumen selesai? Ini bukan pencatatan pembayaran.');
                    if (!confirmValue)
                        return;
                }
                else if (to !== 'BATAL' && !confirm('Lanjut ke tahap ' + status[to] + '?'))
                    return;
                await api('transition', { id: current.id, to, note, confirm: confirmValue, expectedStatus: current.status });
                await loadDetail(current.id);
                notify();
                toast('Status diperbarui.');
                return;
            }
            if (a === 'upload') {
                const f = $('#upload').files[0];
                if (!f || f.size > 4 * 1024 * 1024)
                    throw Error('Pilih PDF maksimal 4 MB.');
                const base64 = await new Promise((ok, no) => {
                    const r = new FileReader();
                    r.onload = () => ok(r.result.split(',')[1]);
                    r.onerror = no;
                    r.readAsDataURL(f);
                });
                await api('upload', { id: current.id, name: f.name, mime: 'application/pdf', base64 });
                await loadDetail(current.id);
                notify();
                toast('Berkas tersimpan.');
                return;
            }
            if (a === 'download') {
                const f = await api('download', { id: current.id, fileId: id }), arr = Uint8Array.from(atob(f.base64), c => c.charCodeAt(0)), u = URL.createObjectURL(new Blob([arr], { type: f.mime })), link = document.createElement('a');
                link.href = u;
                link.download = f.name;
                link.click();
                setTimeout(() => URL.revokeObjectURL(u), 1000);
                return;
            }
            if (a === 'reloadDirectory') {
                await loadDirectory(true);
                render();
                if (directoryError) throw Error(directoryError);
                toast('Daftar ORBITA diperbarui.');
                return;
            }
            if (a === 'openMasterOpd') {
                const target = $('#f-masterOpd').value;
                if (!target || !officeChoices().includes(target)) throw Error('Pilih OPD dari daftar.');
                if (!offices.includes(target)) offices.push(target);
                await switchOffice(target, 'master');
                return;
            }
            if (a === 'editGrant') {
                const row = accessRows.find(r => String(r.user_id) === b.dataset.user && r.opd === b.dataset.opd);
                if (!row) return;
                if (![...$('#f-userId').options].some(x => x.value === String(row.user_id))) $('#f-userId').add(new Option(String(row.user_id) + ' (akun tersimpan)', String(row.user_id)));
                if (![...$('#f-opd').options].some(x => x.value === row.opd)) $('#f-opd').add(new Option(row.opd, row.opd));
                $('#f-userId').value = String(row.user_id);
                $('#f-opd').value = row.opd;
                $('#f-active').value = row.active === true || String(row.active).toLowerCase() === 'true' ? 'true' : 'false';
                $('#grantForm').querySelectorAll('input[name="roles"]').forEach(x => x.checked = String(row.roles).split(',').includes(x.value));
                $('#grantForm').scrollIntoView({block:'center',behavior:'smooth'});
                return;
            }
            if (a === 'saveOffice') {
                const d = formData('#officeForm'), target = opd;
                d.pptkBySub = {};
                $('#officeForm').querySelectorAll('[data-pptk-sub]').forEach(el => {
                    d.pptkBySub[el.dataset.pptkSub] = { name: el.querySelector('[name^=pptkName-]').value, nip: el.querySelector('[name^=pptkNip-]').value };
                });
                if (!target)
                    throw Error('Isi identitas OPD.');
                await api('office', { opd: target, data: d });
                if (!offices.includes(target))
                    offices.push(target);
                opd = target;
                await refreshBoot();
                toast('Identitas Bagian PBJ dan pejabat tersimpan.');
                return;
            }
            if (a === 'syncEmployees') {
                if (!confirm('Ambil pegawai Bagian PBJ dari sheet? Simpan dulu perubahan identitas atau pejabat yang belum tersimpan.')) return;
                const result = await api('syncEmployees');
                await refreshBoot();
                toast(`${result.added} pegawai ditambahkan; ${result.existing} sudah terdaftar; ${result.skipped} data perlu diperiksa.`);
                return;
            }
            if (a === 'saveEmp') {
                await api('employee', { data: formData('#empForm') });
                await refreshBoot();
                toast('Pegawai tersimpan.');
                return;
            }
            if (a === 'saveNum') {
                const d = formData('#numForm');
                await api('numberConfig', { ...d, enabled: d.enabled === 'true' });
                await refreshBoot();
                toast('Register tersimpan.');
                return;
            }
            if (a === 'saveRate') {
                const d = formData('#newRateForm');
                if (!d.id || !d.name || !d.unit || d.rate === '')
                    throw Error('Lengkapi item tarif.');
                const r = await api('importRates', { ...d, items: [d] });
                if (!r.added)
                    throw Error('ID dan tanggal versi sudah terdaftar. Gunakan versi baru.');
                await go('rates');
                toast('Tarif baru disimpan, belum aktif.');
                return;
            }
            if (a === 'loadRates') {
                const d = formData('#rateForm');
                rateImportForm = d;
                rateYear = d.year;
                rateRows = await api('rates', { year: d.year, admin: true });
                rateQuery = '';
                render();
                toast('Daftar tarif diperbarui.');
                return;
            }
            if (a === 'importRates') {
                const d = formData('#rateForm');
                rateImportForm = d;
                rateYear = d.year;
                if (!d.source.trim())
                    throw Error('Isi dasar hukum SBU terlebih dahulu.');
                if (!confirm('Impor 2.129 item sebagai tarif belum aktif?'))
                    return;
                const r = await fetch('data/sbu-kota-bogor.json');
                if (!r.ok)
                    throw Error('Lampiran SBU belum tersedia.');
                const items = await r.json();
                const result = await api('importRates', { ...d, items });
                rateRows = await api('rates', { year: d.year, admin: true });
                render();
                toast(result.added + ' item ditambahkan. Pilih versi di bawah untuk mengaktifkan.');
                return;
            }
            if (a === 'activateRates') {
                const d = formData('#rateForm');
                d.validFrom = $('#f-version')?.value || '';
                const selected = rateRows.find(r => String(r.validFrom).slice(0, 10) === d.validFrom);
                if (!selected) throw Error('Impor tarif dahulu, lalu pilih versi yang tersedia.');
                d.year = String(selected.year);
                if (!confirm('Pastikan tahun, tanggal berlaku, tarif, dan dasar hukumnya sudah sesuai. Aktifkan versi ini?'))
                    return;
                await api('activateRates', { ...d, confirm: true });
                rateRows = await api('rates', { year: d.year, admin: true });
                if (opd && d.year === year)
                    boot.rates = (await api('boot')).rates;
                render();
                toast('Versi tarif diaktifkan.');
                return;
            }
            if (a === 'editRate') {
                const row = rateRows.find(r => r.key === id);
                const v = prompt('Tarif baru (angka rupiah):', String(row.rate));
                if (v === null)
                    return;
                await api('rateEdit', { key: id, rate: v });
                row.rate = Number(v);
                $('#rateList').innerHTML = ratesTable(rateRows.filter(r => (r.name + ' ' + r.spec + ' ' + r.id).toLowerCase().includes(rateQuery.toLowerCase())));
                toast('Tarif draft diperbarui.');
                return;
            }
            if (a === 'grant') {
                const d = formData('#grantForm'), rs = [...$('#grantForm').querySelectorAll('input[name="roles"]:checked')].map(x => x.value);
                const account = directory?.users.find(x => x.id === d.userId);
                if (!d.userId || !d.opd || !rs.length) throw Error('Pilih akun, OPD dan kewenangan.');
                if (account?.role === 'BENDAHARA') throw Error('Role Bendahara belum digunakan pada tahap ini.');
                await api('grant', { ...d, roles: rs.join(','), active: d.active === 'true' });
                accessRows = await api('accessList');
                if (directory) directory.access = accessRows;
                render();
                toast('Hak akses tersimpan.');
                return;
            }
        });
    });

    // Sinkronisasi antar pengguna
    async function poll() {
        if (!user || !opd || pending || refreshing || initializing || document.hidden)
            return;
        refreshing = true;
        try {
            const at = epoch, result = await api('pulse', { revision: boot.revision || '', budgetVersion: boot.budgetVersion || '' });
            if (at !== epoch)
                return;
            boot.revision = result.revision;
            if (result.budget) { boot.budget = result.budget; boot.budgetVersion = result.budgetVersion; }
            if (result.masters) boot.masters = result.masters;
            if (result.rates) boot.rates = result.rates;
            if (result.trips) {
                const changed = JSON.stringify(result.trips) !== JSON.stringify(boot.trips);
                boot.trips = result.trips;
                if ((changed || result.budget) && ['home', 'list', 'budget'].includes(view))
                    render();
            }
            if (view === 'new' && $('#grandTotal') && result.budget) totals();
            synced();
            if (view === 'detail' && current) {
                const item = boot.trips.find(x => x.id === current.id);
                if (item && item.updated !== current.updated) {
                    const id = current.id, at = epoch, d = await api('detail', { id });
                    if (view === 'detail' && current.id === id && epoch === at) {
                        current = d;
                        render();
                    }
                }
            }
        }
        catch (err) {
            if (session.classify(err.message) !== 'connection') {
                sessionError(err);
            } else {
                sync('Koneksi terputus · mencoba lagi', true);
            }
        }
        finally {
            refreshing = false;
        }
    }
    if (channel)
        channel.onmessage = () => poll();
    document.addEventListener('visibilitychange', () => {
        if (!document.hidden)
            poll();
    });
    window.addEventListener('online', poll);
    window.addEventListener('offline', () => sync('Offline · data belum diperbarui', true));
    $('#closeMenu').addEventListener('click', () => document.body.classList.remove('menu'));
    setInterval(poll, Math.max(10000, cfg.pollMs || 15000));
    init();
})();
