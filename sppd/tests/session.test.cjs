const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const code = fs.readFileSync(path.join(__dirname, '../assets/session.js'), 'utf8');
const key = 'traxpbj_selection_token';
const origin = 'https://pbjkotabogor.github.io';
function storage(initial = {}) {
    const data = new Map(Object.entries(initial));
    return { getItem: k => data.get(k) || null, setItem: (k, v) => data.set(k, v), removeItem: k => data.delete(k) };
}
function portal(value = '') {
    return { location: new URL(origin + '/ORBITA/profil-pbj/?login=1'), sessionStorage: storage({ [key]: value }), closed: false, close() { this.closed = true; } };
}
function setup(value = '', opener = null, popup = null) {
    let tick;
    const sessionStorage = storage({ [key]: value });
    const window = { SPPD_CONFIG: { portalUrl: '../profil-pbj/?login=1' }, opener, open: () => popup };
    vm.runInNewContext(code, { window, URL, location: new URL(origin + '/ORBITA/sppd/'), sessionStorage, Date,
        setInterval: f => { tick = f; return 1; }, clearInterval: () => { tick = null; } });
    return { session: window.SPPD_SESSION, sessionStorage, tick: () => tick?.() };
}
(async () => {
    let t = setup('valid');
    assert.equal(t.session.restore(), 'valid');
    t = setup('', portal('inherited'));
    assert.equal(t.session.restore(), 'inherited');
    assert.equal(t.sessionStorage.getItem(key), 'inherited');
    t.session.clear('different');
    assert.equal(t.session.token(), 'inherited');
    t.session.clear('inherited');
    assert.equal(t.session.restore(), '');
    assert.equal(t.sessionStorage.getItem(key), null);
    t = setup('', { ...portal('other'), location: new URL('https://example.com/profil-pbj/') });
    assert.equal(t.session.restore(), '');
    t = setup('', { ...portal('other'), location: new URL(origin + '/OTHER/profil-pbj/') });
    assert.equal(t.session.restore(), '');
    t = setup();
    assert.equal(t.session.restore(), '');
    await assert.rejects(t.session.openLogin(), /diblokir/);
    const p = portal();
    t = setup('', null, p);
    const login = t.session.openLogin();
    t.tick();
    assert.equal(t.session.token(), '');
    p.sessionStorage.setItem(key, 'new-token');
    t.tick();
    assert.equal(await login, 'new-token');
    assert.equal(t.session.token(), 'new-token');
    assert.equal(p.closed, true);
    const p2 = portal();
    t = setup('', null, p2);
    const closed = t.session.openLogin();
    p2.closed = true;
    t.tick();
    await assert.rejects(closed, /ditutup/);
    assert.equal(t.session.classify('Akun belum diberi akses Perjalanan Dinas. Hubungi admin.'), 'access');
    assert.equal(t.session.classify('Sesi ORBITA tidak berlaku. Silakan masuk kembali.'), 'expired');
    assert.equal(t.session.classify('Layanan login ORBITA belum bisa dihubungi.'), 'connection');
    console.log('PASS: sesi tab, opener satu origin, penolakan origin/path lain, sesi kedaluwarsa, popup login/ditutup/diblokir, klasifikasi akses dan koneksi');
})().catch(err => { console.error(err); process.exitCode = 1; });
