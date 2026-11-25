/** ORBITA Perjalanan Dinas — backend mandiri. Jalankan setupSPPD() dari editor. */
const DB_ID = '1TwmlYnZmrauteciEnr6vN8CbiMma7uypg6ZfxvItWlw';
const ORBITA_URL = 'https://script.google.com/macros/s/AKfycbxZ-eJD8Ya4BTcWmQ0sTfpkUDw_X5--OSjIq0Ue4TA2qLTEdybpyFd9edF3bZRO5NvXig/exec';
const SCHEMA = {
    SPPD: ['id', 'opd', 'owner', 'status', 'updated', 'json'],
    M_AKSES: ['user_id', 'opd', 'roles', 'active'],
    M_PEGAWAI: ['id', 'opd', 'json'],
    M_OPD: ['opd', 'json'],
    M_SHS: ['key', 'year', 'id', 'group', 'name', 'spec', 'unit', 'rate', 'code', 'account', 'sourceRow', 'source', 'validFrom', 'active'],
    M_NOMOR: ['opd', 'year', 'pattern', 'next', 'enabled'],
    REGISTER_NOMOR: ['opd', 'year', 'number', 'trip', 'participant', 'mode', 'created'],
    AUDIT_LOG: ['trip', 'opd', 'at', 'actor', 'action', 'note'],
    SPPD_DOKUMEN: ['id', 'trip', 'opd', 'name', 'file_id', 'mime', 'at', 'actor']
};
const ROLES = ['OPERATOR', 'BENDAHARA', 'ADMIN_OPD', 'ADMIN_SHS', 'SUPERADMIN', 'PEMERIKSA'];
const TRIP_ROLES = ['OPERATOR', 'BENDAHARA', 'ADMIN_OPD', 'PEMERIKSA'];
let dbCache_;

function db_() {
    return dbCache_ || (dbCache_ = SpreadsheetApp.openById(DB_ID));
}

// Penyiapan database dan akun admin pertama
function setupSPPD() {
    const db = db_();
    Object.keys(SCHEMA).forEach(n => {
        const s = db.getSheetByName(n), h = SCHEMA[n];
        if (s && s.getLastRow() && h.some((v, i) => v !== s.getRange(1, 1, 1, h.length).getValues()[0][i]))
            throw Error('Header ' + n + ' berbeda. Periksa dahulu, tidak ada data ditimpa.');
    });
    Object.keys(SCHEMA).forEach(n => {
        let s = db.getSheetByName(n) || db.insertSheet(n);
        const h = SCHEMA[n];
        if (s.getLastRow() === 0) {
            s.getRange(1, 1, 1, h.length).setValues([h]);
            s.setFrozenRows(1);
        }
        else {
            const found = s.getRange(1, 1, 1, h.length).getValues()[0];
            if (h.some((v, i) => v !== found[i]))
                throw Error('Header ' + n + ' berbeda. Jangan ditimpa; periksa dahulu.');
        }
    });
    if (!PropertiesService.getScriptProperties().getProperty('SPPD_FOLDER')) {
        const f = DriveApp.createFolder('ORBITA SPPD - ARSIP TERBATAS');
        PropertiesService.getScriptProperties().setProperty('SPPD_FOLDER', f.getId());
    }
}
// Isi user_id dari API me/daftar akun ORBITA. Jalankan dari editor, bukan dari API publik.

function grantFirstAdmin() {
    const id = PropertiesService.getScriptProperties().getProperty('FIRST_ADMIN_USER_ID');
    if (!id)
        throw Error('Isi Script Property FIRST_ADMIN_USER_ID dengan user_id ORBITA.');
    grantAccess_(id, '*', 'SUPERADMIN,ADMIN_SHS');
}

// Akses spreadsheet
function sheet_(n) {
    const s = db_().getSheetByName(n);
    if (!s)
        throw Error('Database belum disiapkan. Jalankan setupSPPD.');
    return s;
}

function rows_(n) {
    const s = sheet_(n), h = SCHEMA[n], last = s.getLastRow();
    if (last < 2)
        return [];
    return s.getRange(2, 1, last - 1, h.length).getValues().map((a, i) => Object.assign({ _row: i + 2 }, Object.fromEntries(h.map((k, j) => [k, a[j] instanceof Date ? Utilities.formatDate(a[j], 'Asia/Jakarta', k === 'validFrom' ? 'yyyy-MM-dd' : "yyyy-MM-dd'T'HH:mm:ssXXX") : a[j]]))));
}

function cell_(v) {
    if (v === undefined || v === null)
        return '';
    if (typeof v === 'string' && (/^[=+\-@]/.test(v) || /^\d{4}-\d{2}-\d{2}/.test(v) || /^\d{16,}$/.test(v)))
        return "'" + v;
    return v;
}

function revision_() {
    return PropertiesService.getScriptProperties().getProperty('SPPD_REV') || '0';
}

function bump_() {
    PropertiesService.getScriptProperties().setProperty('SPPD_REV', Utilities.getUuid());
}

function room_(s, last) {
    const max = s.getMaxRows();
    if (last > max)
        s.insertRowsAfter(max, last - max);
}

function write_(n, o, row) {
    const h = SCHEMA[n], s = sheet_(n), a = h.map(k => cell_(o[k]));
    if (row)
        s.getRange(row, 1, 1, h.length).setValues([a]);
    else
        s.appendRow(a);
    bump_();
}

function lock_(fn) {
    const l = LockService.getScriptLock();
    l.waitLock(20000);
    try {
        return fn();
    }
    finally {
        l.releaseLock();
    }
}

// Validasi dasar dan respons API
function txt_(v, max = 300) {
    return String(v == null ? '' : v).trim().slice(0, max);
}

function yes_(v) {
    return v === true || String(v).toLowerCase() === 'true' || String(v) === '1';
}

function json_(x) {
    return ContentService.createTextOutput(JSON.stringify(x)).setMimeType(ContentService.MimeType.JSON);
}

function doGet() {
    return json_({ ok: true, service: 'ORBITA SPPD', version: '1.0-pilot' });
}

function doPost(e) {
    try {
        const p = JSON.parse(e.postData.contents);
        const u = identity_(p.token);
        return json_({ ok: true, data: route_(u, p) });
    }
    catch (e) {
        return json_({ ok: false, error: String(e.message || e) });
    }
}

// Validasi sesi ORBITA dan hak akses
function identity_(token) {
    if (!token || String(token).length > 500)
        throw Error('Silakan masuk melalui ORBITA.');
    const r = UrlFetchApp.fetch(ORBITA_URL, {
        method: 'post',
        contentType: 'text/plain',
        payload: JSON.stringify({ action: 'me', token }),
        muteHttpExceptions: true
    });
    let j;
    try {
        j = JSON.parse(r.getContentText());
    }
    catch (e) {
        throw Error('Layanan login ORBITA belum bisa dihubungi.');
    }
    if (!j.ok || !j.data || !j.data.active || !j.data.user_id)
        throw Error('Sesi ORBITA tidak berlaku. Silakan masuk kembali.');
    const u = j.data;
    const grants = rows_('M_AKSES').filter(x => String(x.user_id) === String(u.user_id) && yes_(x.active)).map(x => ({ opd: String(x.opd), roles: String(x.roles).split(',').map(y => y.trim()).filter(y => ROLES.includes(y)) }));
    if (!grants.length)
        throw Error('Akun belum diberi akses Perjalanan Dinas. Hubungi admin.');
    return { id: String(u.user_id), name: u.nama, opd: u.opd, grants };
}

function can_(u, opd, roles) {
    return u.grants.some(g => (g.opd === opd || g.opd === '*' && g.roles.includes('SUPERADMIN')) && (g.roles.includes('SUPERADMIN') || roles.some(r => g.roles.includes(r))));
}

function require_(u, opd, roles) {
    if (!opd || opd === '*' || !can_(u, opd, roles))
        throw Error('Akses tidak tersedia untuk perangkat daerah ini.');
}

function global_(u, roles) {
    if (!u.grants.some(g => g.roles.includes('SUPERADMIN') || roles.some(r => g.roles.includes(r))))
        throw Error('Menu ini khusus admin yang diberi akses.');
}

function grantAccess_(id, opd, roles, active = true) {
    id = txt_(id);
    opd = txt_(opd);
    roles = String(roles).split(',').map(s => s.trim());
    if (!id || !opd || !roles.length || roles.some(r => !ROLES.includes(r)) || (opd === '*' && !roles.includes('SUPERADMIN')))
        throw Error('Data akses belum sesuai.');
    const old = rows_('M_AKSES').find(r => String(r.user_id) === id && r.opd === opd);
    write_('M_AKSES', { user_id: id, opd, roles: roles.join(','), active }, old && old._row);
}

// Riwayat dan penyimpanan transaksi
function audit_(u, r, a, n = '') {
    write_('AUDIT_LOG', {
        trip: r.id,
        opd: r.opd,
        at: new Date().toISOString(),
        actor: u.name + ' (' + u.id + ')',
        action: a,
        note: txt_(n, 1000)
    });
}

function getTrip_(u, id) {
    const r = rows_('SPPD').find(x => x.id === id);
    if (!r)
        throw Error('Perjalanan tidak ditemukan.');
    require_(u, r.opd, TRIP_ROLES);
    return r;
}

function parse_(r) {
    return JSON.parse(r.json);
}

function stamp_(r, d) {
    r.updated = new Date().toISOString();
    r.json = JSON.stringify(d);
    if (r.json.length > 45000)
        throw Error('Data terlalu panjang. Bagi rombongan menjadi beberapa pengajuan.');
    write_('SPPD', r, r._row);
    SpreadsheetApp.flush();
    return { ...d, id: r.id, opd: r.opd, status: r.status, updated: r.updated };
}

// Validasi perjalanan dan biaya
function day_(s) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(s || ''))
        throw Error('Tanggal belum lengkap.');
    const t = Date.parse(s + 'T00:00:00Z');
    if (!Number.isFinite(t) || new Date(t).toISOString().slice(0, 10) !== s)
        throw Error('Tanggal tidak valid.');
    return t;
}

function amount_(v) {
    const n = Number(v || 0);
    if (!Number.isFinite(n) || n < 0 || n > 1e12 || !Number.isInteger(n))
        throw Error('Nominal tidak valid.');
    return n;
}

function validateDraft_(u, opd, input) {
    const x = input || {}, start = txt_(x.start), end = txt_(x.end), days = (day_(end) - day_(start)) / 86400000 + 1;
    if (days < 1 || days > 365 || start.slice(0, 4) !== end.slice(0, 4))
        throw Error('Periksa tanggal; satu perjalanan harus dalam satu tahun anggaran.');
    const year = start.slice(0, 4);
    const office = rows_('M_OPD').find(o => o.opd === opd);
    if (!office)
        throw Error('Lengkapi identitas OPD dan pejabat terlebih dahulu.');
    const master = rows_('M_PEGAWAI').filter(r => r.opd === opd), rates = rows_('M_SHS').filter(r => String(r.year) === year && yes_(r.active) && String(r.validFrom || '') !== '' && String(r.validFrom).slice(0, 10) <= start);
    const list = Array.isArray(x.participants) ? x.participants : [];
    if (!list.length || list.length > 30 || new Set(list.map(a => a.employeeId)).size !== list.length)
        throw Error('Pilih 1–30 pegawai berbeda.');
    const purpose = txt_(x.purpose, 1500), destination = txt_(x.destination), origin = txt_(x.origin), account = txt_(x.account), activity = txt_(x.activity), transport = txt_(x.transport), province = txt_(x.province), category = txt_(x.category);
    if (!purpose || !destination || !origin || !account || !activity || !transport || !province || !category)
        throw Error('Lengkapi informasi perjalanan dan anggaran.');
    const participants = list.map(a => {
        const m = master.find(z => z.id === a.employeeId);
        if (!m)
            throw Error('Pegawai tidak terdaftar di OPD.');
        const emp = parse_(m), rate = rates.find(z => z.key === a.rateKey);
        if (!rate || rate.name !== 'Uang Harian Perjalanan Dinas Luar Daerah ' + province || rate.spec !== category || rates.some(z => z.id === rate.id && String(z.validFrom) > String(rate.validFrom)))
            throw Error('Tarif uang harian belum tersedia/sesuai tujuan dan kategori.');
        const actual = Array.isArray(a.costs) ? a.costs : [];
        const allowed = ['Bensin', 'Tol dan parkir', 'Sewa kendaraan', 'Tiket pesawat', 'Penginapan', 'Lainnya'];
        const costs = actual.filter(c => allowed.includes(c.label)).map(c => {
            const value = amount_(c.amount);
            const ref = c.rateKey ? rates.find(r => r.key === c.rateKey) : null;
            if (c.rateKey && !ref)
                throw Error('Referensi SBU tidak tersedia.');
            const note = txt_(c.note, 300);
            if (value && !note)
                throw Error('Isi keterangan untuk biaya ' + c.label + '.');
            return {
                label: c.label,
                amount: value,
                note,
                reference: ref ? { id: ref.id, name: ref.name, spec: ref.spec, rate: ref.rate, unit: ref.unit, source: ref.source } : null
            };
        });
        if (new Set(costs.map(c => c.label)).size !== costs.length)
            throw Error('Rincian biaya ganda.');
        const daily = amount_(rate.rate) * days, total = daily + costs.reduce((s, c) => s + c.amount, 0);
        return {
            ...emp,
            employeeId: m.id,
            number: txt_(a.number),
            rateKey: rate.key,
            rate: {
                id: rate.id,
                name: rate.name,
                spec: rate.spec,
                unit: rate.unit,
                amount: rate.rate,
                source: rate.source,
                sourceRow: rate.sourceRow
            },
            daily,
            costs,
            total,
            advance: amount_(a.advance)
        };
    });
    const issued = txt_(x.issued) || start;
    day_(issued);
    if (issued.slice(0, 4) !== year)
        throw Error('Tanggal SPD harus pada tahun anggaran yang sama.');
    return {
        purpose,
        destination,
        origin,
        account,
        activity,
        transport,
        province,
        category,
        start,
        end,
        days,
        year,
        issued,
        mode: x.mode === 'auto' ? 'auto' : 'manual',
        participants,
        office: parse_(office),
        total: participants.reduce((s, p) => s + p.total, 0)
    };
}

// Penerbitan nomor SPD
function issue_(u, r, d) {
    if (r.status !== 'DRAFT' && r.status !== 'REVISI')
        throw Error('Dokumen sudah diterbitkan.');
    const conflict = rows_('SPPD').filter(x => x.opd === r.opd && x.id !== r.id && x.status !== 'DRAFT').map(parse_).find(x => x.start <= d.end && x.end >= d.start && x.participants.some(p => d.participants.some(z => z.employeeId === p.employeeId)));
    if (conflict)
        throw Error('Ada peserta dengan SPD lain pada tanggal yang sama. Periksa jadwal terlebih dahulu.');
    const eligible = rows_('M_SHS').filter(x => String(x.year) === d.year && yes_(x.active) && String(x.validFrom) <= d.start);
    for (const p of d.participants) {
        const ref = eligible.find(x => x.key === p.rateKey);
        if (!ref || eligible.some(x => x.id === ref.id && String(x.validFrom) > String(ref.validFrom)))
            throw Error('Tarif berubah. Buka dan simpan ulang draft sebelum menerbitkan.');
    }
    const register = rows_('REGISTER_NOMOR'), cfg = rows_('M_NOMOR').find(o => o.opd === r.opd && String(o.year) === d.year);
    let seq = cfg ? Number(cfg.next) : 0;
    const own = register.filter(n => n.trip === r.id), nums = new Set(register.filter(n => n.opd === r.opd && String(n.year) === d.year).map(n => String(n.number).trim().toLowerCase()));
    const planned = [];
    for (const p of d.participants) {
        const reserved = own.find(n => n.participant === p.employeeId);
        if (reserved) {
            p.number = String(reserved.number);
            continue;
        }
        let n = p.number;
        if (d.mode === 'auto') {
            if (!cfg || !yes_(cfg.enabled) || !cfg.pattern.includes('{urut}') || !Number.isSafeInteger(seq) || seq < 1)
                throw Error('Register otomatis belum disahkan admin OPD. Gunakan nomor manual dari register resmi.');
            do {
                n = cfg.pattern.replace(/\{urut\}/g, String(seq++)).replace(/\{tahun\}/g, d.year);
            } while (nums.has(n.toLowerCase()) && seq < Number(cfg.next) + 10000);
        }
        if (!n || nums.has(n.toLowerCase()))
            throw Error('Nomor SPD kosong atau sudah digunakan: ' + n);
        nums.add(n.toLowerCase());
        p.number = n;
        planned.push({
            opd: r.opd,
            year: d.year,
            number: n,
            trip: r.id,
            participant: p.employeeId,
            mode: d.mode,
            created: new Date().toISOString()
        });
    }
    if (planned.length) {
        const sh = sheet_('REGISTER_NOMOR');
        room_(sh, sh.getLastRow() + planned.length);
        sh.getRange(sh.getLastRow() + 1, 1, planned.length, SCHEMA.REGISTER_NOMOR.length).setValues(planned.map(o => SCHEMA.REGISTER_NOMOR.map(k => cell_(o[k]))));
    }
    if (d.mode === 'auto' && cfg)
        write_('M_NOMOR', { ...cfg, next: seq }, cfg._row);
    r.status = 'SIAP_CETAK';
    audit_(u, r, 'Nomor dicatat');
    return stamp_(r, d);
}

// Penanganan permintaan frontend
function route_(u, p) {
    const a = p.action, opd = txt_(p.opd);
    if (a === 'init') {
        const offices = rows_('M_OPD').map(o => o.opd);
        const allowed = [...new Set([...u.grants.filter(g => g.roles.some(r => TRIP_ROLES.includes(r) || r === 'SUPERADMIN')).map(g => g.opd).filter(o => o !== '*'), ...offices.filter(o => can_(u, o, TRIP_ROLES))])];
        const selected = allowed.includes(opd) ? opd : allowed[0];
        return {
            user: u,
            offices: allowed,
            selected,
            boot: selected ? route_(u, { action: 'boot', opd: selected, year: p.year }) : null
        };
    }
    if (a === 'boot') {
        require_(u, opd, TRIP_ROLES);
        return {
            revision: revision_(),
            trips: route_(u, { action: 'list', opd }),
            masters: route_(u, { action: 'masters', opd }),
            rates: rows_('M_SHS').filter(r => String(r.year) === String(p.year) && yes_(r.active) && String(r.name).startsWith('Uang Harian Perjalanan Dinas Luar Daerah '))
        };
    }
    if (a === 'pulse') {
        require_(u, opd, TRIP_ROLES);
        const revision = revision_();
        if (p.revision === revision)
            return { revision };
        return { revision, trips: route_(u, { action: 'list', opd }) };
    }
    if (a === 'register') {
        require_(u, opd, TRIP_ROLES);
        return rows_('REGISTER_NOMOR').filter(r => r.opd === opd && String(r.year) === String(p.year)).map(({ _row, ...v }) => v);
    }
    if (a === 'accessList') {
        global_(u, ['SUPERADMIN']);
        return rows_('M_AKSES').map(({ _row, ...v }) => v);
    }
    if (a === 'list') {
        require_(u, opd, TRIP_ROLES);
        return rows_('SPPD').filter(r => r.opd === opd).map(r => {
            const d = parse_(r);
            return {
                id: r.id,
                status: r.status,
                updated: r.updated,
                purpose: d.purpose,
                destination: d.destination,
                start: d.start,
                end: d.end,
                total: d.total,
                people: d.participants.length
            };
        }).reverse();
    }
    if (a === 'masters') {
        require_(u, opd, TRIP_ROLES);
        const office = rows_('M_OPD').find(r => r.opd === opd);
        return {
            office: office ? parse_(office) : null,
            employees: rows_('M_PEGAWAI').filter(r => r.opd === opd).map(r => ({ ...parse_(r), id: r.id })),
            number: rows_('M_NOMOR').filter(r => r.opd === opd)
        };
    }
    if (a === 'rates') {
        if (p.admin === true)
            global_(u, ['ADMIN_SHS']);
        else
            require_(u, opd, TRIP_ROLES);
        const y = String(p.year), q = txt_(p.query).toLowerCase();
        return rows_('M_SHS').filter(r => String(r.year) === y && (yes_(r.active) || u.grants.some(g => g.roles.includes('ADMIN_SHS') || g.roles.includes('SUPERADMIN'))) && (!q || (r.name + ' ' + r.spec + ' ' + r.id).toLowerCase().includes(q))).slice(0, 2500);
    }
    if (a === 'detail') {
        const r = getTrip_(u, p.id);
        return {
            ...parse_(r),
            id: r.id,
            opd: r.opd,
            status: r.status,
            updated: r.updated,
            history: rows_('AUDIT_LOG').filter(x => x.trip === r.id),
            files: rows_('SPPD_DOKUMEN').filter(x => x.trip === r.id).map(x => ({ id: x.id, name: x.name, at: x.at }))
        };
    }
    if (a === 'download') {
        const r = getTrip_(u, p.id), f = rows_('SPPD_DOKUMEN').find(x => x.trip === r.id && x.id === p.fileId);
        if (!f)
            throw Error('Berkas tidak ditemukan.');
        return {
            name: f.name,
            base64: Utilities.base64Encode(DriveApp.getFileById(f.file_id).getBlob().getBytes()),
            mime: f.mime
        };
    }
    return lock_(() => {
        if (a === 'grant') {
            global_(u, ['SUPERADMIN']);
            grantAccess_(p.userId, opd, p.roles, p.active !== false);
            return true;
        }
        if (a === 'office') {
            require_(u, opd, ['ADMIN_OPD']);
            const x = p.data || {}, v = {};
            ['name', 'unit', 'address', 'kpaName', 'kpaNip', 'kpaRank', 'kpaTitle', 'pptkName', 'pptkNip', 'bendName', 'bendNip', 'bendTitle'].forEach(k => v[k] = txt_(x[k]));
            if (!v.name || !v.unit || !v.kpaName || !v.pptkName || !v.bendName)
                throw Error('Lengkapi OPD, KPA, PPTK dan bendahara.');
            const old = rows_('M_OPD').find(r => r.opd === opd);
            write_('M_OPD', { opd, json: JSON.stringify(v) }, old && old._row);
            return true;
        }
        if (a === 'employee') {
            require_(u, opd, ['ADMIN_OPD']);
            const x = p.data || {}, d = { name: txt_(x.name), nip: txt_(x.nip), rank: txt_(x.rank), position: txt_(x.position), level: txt_(x.level) };
            if (!d.name || !d.nip || !d.position)
                throw Error('Nama, NIP dan jabatan wajib diisi.');
            const all = rows_('M_PEGAWAI').filter(r => r.opd === opd), old = all.find(r => r.id === x.id);
            if (all.some(r => r.id !== x.id && parse_(r).nip === d.nip))
                throw Error('NIP sudah terdaftar.');
            write_('M_PEGAWAI', { id: old ? old.id : Utilities.getUuid(), opd, json: JSON.stringify(d) }, old && old._row);
            return true;
        }
        if (a === 'numberConfig') {
            require_(u, opd, ['ADMIN_OPD']);
            const y = String(p.year), pattern = txt_(p.pattern), next = Number(p.next);
            if (!/^\d{4}$/.test(y) || !pattern.includes('{urut}') || !Number.isSafeInteger(next) || next < 1)
                throw Error('Pola wajib memuat {urut} dan nomor awal yang valid.');
            const old = rows_('M_NOMOR').find(r => r.opd === opd && String(r.year) === y);
            write_('M_NOMOR', { opd, year: y, pattern, next, enabled: p.enabled === true }, old && old._row);
            return true;
        }
        if (a === 'importRates') {
            global_(u, ['ADMIN_SHS']);
            const year = String(p.year), validFrom = txt_(p.validFrom), source = txt_(p.source, 500), list = p.items;
            if (!/^\d{4}$/.test(year) || validFrom.slice(0, 4) !== year || !source || !Array.isArray(list) || list.length > 2500 || !list.length)
                throw Error('Isi tahun, tanggal berlaku, dan dasar SBU.');
            day_(validFrom);
            const existing = new Set(rows_('M_SHS').map(r => r.key));
            const fresh = [];
            for (const x of list) {
                const id = txt_(x.id), name = txt_(x.name), spec = txt_(x.spec), key = year + '|' + id + '|' + validFrom;
                if (!id || !name || existing.has(key))
                    continue;
                existing.add(key);
                fresh.push({
                    key,
                    year,
                    id,
                    group: txt_(x.group),
                    name,
                    spec,
                    unit: txt_(x.unit),
                    rate: amount_(x.rate),
                    code: txt_(x.code),
                    account: txt_(x.account, 700),
                    sourceRow: txt_(x.sourceRow),
                    source,
                    validFrom,
                    active: false
                });
            }
            if (fresh.length) {
                const s = sheet_('M_SHS');
                room_(s, s.getLastRow() + fresh.length);
                s.getRange(s.getLastRow() + 1, 1, fresh.length, SCHEMA.M_SHS.length).setValues(fresh.map(o => SCHEMA.M_SHS.map(k => cell_(o[k]))));
            }
            if (fresh.length)
                bump_();
            return { added: fresh.length };
        }
        if (a === 'rateEdit') {
            global_(u, ['ADMIN_SHS']);
            const r = rows_('M_SHS').find(x => x.key === p.key);
            if (!r || yes_(r.active))
                throw Error('Tarif aktif tidak dapat diedit. Buat versi baru.');
            const rate = amount_(p.rate);
            write_('M_SHS', { ...r, rate }, r._row);
            return true;
        }
        if (a === 'activateRates') {
            global_(u, ['ADMIN_SHS']);
            const year = String(p.year), from = txt_(p.validFrom);
            if (p.confirm !== true)
                throw Error('Konfirmasi dasar tarif terlebih dahulu.');
            const all = rows_('M_SHS'), target = all.filter(r => String(r.year) === year && String(r.validFrom).slice(0, 10) === from);
            if (!target.length)
                throw Error('Kelompok tarif tidak ditemukan.');
            const s = sheet_('M_SHS'), col = SCHEMA.M_SHS.indexOf('active') + 1;
            const keys = new Set(target.map(r => r.key));
            const changes = all.map(r => [keys.has(r.key) || yes_(r.active)]);
            s.getRange(2, col, changes.length, 1).setValues(changes);
            bump_();
            return true;
        }
        if (a === 'save') {
            require_(u, opd, ['OPERATOR', 'ADMIN_OPD']);
            const requestId = txt_(p.requestId);
            const existing = !p.id && requestId ? rows_('SPPD').find(x => x.id === requestId && x.opd === opd && x.owner === u.id) : null;
            if (existing)
                return { ...parse_(existing), id: existing.id, opd, status: existing.status, updated: existing.updated };
            let r = p.id ? getTrip_(u, p.id) : { id: /^[a-f0-9-]{36}$/i.test(requestId) ? requestId : Utilities.getUuid(), opd, owner: u.id, status: 'DRAFT' };
            if (r.opd !== opd || r.status !== 'DRAFT')
                throw Error('Hanya draft yang dapat diedit.');
            if (p.id && p.expectedUpdated !== r.updated)
                throw Error('Data sudah berubah. Buka kembali draft sebelum menyimpan.');
            const d = validateDraft_(u, opd, p.data);
            audit_(u, r, 'Draft disimpan');
            return stamp_(r, d);
        }
        const r = getTrip_(u, p.id), d = parse_(r);
        if (a === 'issue') {
            require_(u, r.opd, ['OPERATOR', 'ADMIN_OPD']);
            return issue_(u, r, d);
        }
        if (a === 'reviseCosts') {
            require_(u, r.opd, ['OPERATOR', 'ADMIN_OPD']);
            if (!['SPJ', 'PERBAIKAN'].includes(r.status) || p.expectedUpdated !== r.updated)
                throw Error('Buka ulang data SPJ sebelum mengubah biaya.');
            const note = txt_(p.note, 500), list = p.participants;
            if (!note || !Array.isArray(list) || list.length !== d.participants.length)
                throw Error('Isi alasan penyesuaian biaya.');
            const old = d.total;
            for (const x of d.participants) {
                const v = list.find(y => y.employeeId === x.employeeId);
                if (!v || !Array.isArray(v.costs) || v.costs.length !== x.costs.length)
                    throw Error('Rincian belum lengkap.');
                x.costs = x.costs.map(c => {
                    const z = v.costs.find(y => y.label === c.label);
                    if (!z)
                        throw Error('Rincian biaya tidak sesuai.');
                    const amount = amount_(z.amount), note = txt_(z.note, 300);
                    if (amount && !note)
                        throw Error('Isi keterangan ' + c.label);
                    return { ...c, amount, note };
                });
                x.advance = amount_(v.advance);
                x.total = x.daily + x.costs.reduce((n, c) => n + c.amount, 0);
            }
            d.total = d.participants.reduce((n, x) => n + x.total, 0);
            audit_(u, r, 'Penyesuaian biaya SPJ', note + ' | Total sebelumnya: ' + old + ' | Total baru: ' + d.total);
            return stamp_(r, d);
        }
        if (a === 'upload') {
            require_(u, r.opd, ['OPERATOR', 'ADMIN_OPD', 'BENDAHARA']);
            if (!['SIAP_CETAK', 'SPJ', 'PERBAIKAN'].includes(r.status))
                throw Error('Berkas tidak dapat ditambah pada tahap ini.');
            const b = Utilities.base64Decode(String(p.base64 || ''));
            if (b.length < 5 || b.length > 4 * 1024 * 1024 || String(p.mime) !== 'application/pdf' || String.fromCharCode(...b.slice(0, 5)) !== '%PDF-')
                throw Error('Unggah PDF maksimal 4 MB.');
            const folder = DriveApp.getFolderById(PropertiesService.getScriptProperties().getProperty('SPPD_FOLDER'));
            const name = txt_(p.name, 120).replace(/[^a-zA-Z0-9 ._()-]/g, '_');
            const f = folder.createFile(Utilities.newBlob(b, 'application/pdf', r.id + '_' + name));
            write_('SPPD_DOKUMEN', {
                id: Utilities.getUuid(),
                trip: r.id,
                opd: r.opd,
                name,
                file_id: f.getId(),
                mime: 'application/pdf',
                at: new Date().toISOString(),
                actor: u.id
            });
            audit_(u, r, 'Berkas ditambahkan', name);
            stamp_(r, d);
            return true;
        }
        if (a === 'transition') {
            if (p.expectedStatus !== r.status)
                throw Error('Status sudah berubah. Buka ulang perjalanan.');
            const to = String(p.to), note = txt_(p.note, 1000);
            const map = {
                SIAP_CETAK: { SPJ: ['OPERATOR', 'ADMIN_OPD'] },
                SPJ: { PERIKSA: ['OPERATOR', 'ADMIN_OPD'] },
                PERIKSA: { PERBAIKAN: ['BENDAHARA'], SIAP_BAYAR: ['BENDAHARA'] },
                PERBAIKAN: { PERIKSA: ['OPERATOR', 'ADMIN_OPD'] },
                SIAP_BAYAR: { DIBAYAR: ['BENDAHARA'], PERBAIKAN: ['BENDAHARA'] },
                DIBAYAR: { ARSIP: ['BENDAHARA'] }
            };
            const allowed = map[r.status] && map[r.status][to];
            if (!allowed)
                throw Error('Tahapan tidak sesuai.');
            require_(u, r.opd, allowed);
            if (to === 'PERBAIKAN' && !note)
                throw Error('Isi catatan perbaikan.');
            if (to === 'PERIKSA' && !rows_('SPPD_DOKUMEN').some(x => x.trip === r.id))
                throw Error('Unggah berkas bertanda tangan dan bukti dahulu.');
            if (to === 'SIAP_BAYAR' && p.confirm !== true)
                throw Error('Pastikan pemeriksaan fisik dan nominal selesai.');
            if (to === 'DIBAYAR') {
                if (!note)
                    throw Error('Isi referensi pembayaran/BKU dan tanggal.');
                d.paymentNote = note;
            }
            r.status = to;
            audit_(u, r, to, note);
            return stamp_(r, d);
        }
        throw Error('Menu tidak ditemukan.');
    });
}
