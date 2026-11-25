(() => {
    'use strict';

    const TOKEN_KEY = 'traxpbj_selection_token';
    const PORTAL_KEY = 'traxpbj_portal_session_v277';
    const portal = new URL(window.SPPD_CONFIG.portalUrl, location.href);
    const portalPath = portal.pathname.replace(/\/$/, '');
    const read = storage => storage.getItem(TOKEN_KEY) || '';
    let rejectedToken = '';

    function token() {
        return read(sessionStorage);
    }

    function isPortal(source) {
        try {
            if (!source || source.closed || source.location.origin !== location.origin)
                return false;
            const path = source.location.pathname.replace(/\/(?:index\.html)?$/, '');
            return path === portalPath;
        } catch (_) {
            return false;
        }
    }

    // Hanya tab portal satu origin yang dibuka langsung, bukan penyimpanan lintas tab.
    function takeFrom(source) {
        if (!isPortal(source)) return '';
        try {
            const value = read(source.sessionStorage);
            if (value && value !== rejectedToken) {
                sessionStorage.setItem(TOKEN_KEY, value);
                return value;
            }
        } catch (_) { /* Tab dapat berpindah halaman sewaktu diperiksa. */ }
        return '';
    }

    function restore() {
        return token() || takeFrom(window.opener);
    }

    function clear(expected) {
        if (token() !== expected) return;
        rejectedToken = expected;
        sessionStorage.removeItem(TOKEN_KEY);
        sessionStorage.removeItem(PORTAL_KEY);
    }

    // Login tetap melalui portal asli. Tidak ada formulir atau database password kedua.
    function openLogin(onStatus) {
        const popup = window.open(portal.href, '_blank', 'popup,width=980,height=760');
        if (!popup) return Promise.reject(new Error('Jendela login diblokir browser. Izinkan pop-up atau buka SPPD dari tab ORBITA yang sudah masuk.'));
        return new Promise((resolve, reject) => {
            let timer;
            const deadline = Date.now() + 5 * 60 * 1000;
            const finish = (err, value) => {
                clearInterval(timer);
                if (err) reject(err);
                else resolve(value);
            };
            onStatus?.('Selesaikan login akun PBJ di jendela ORBITA.');
            timer = setInterval(() => {
                if (Date.now() >= deadline) {
                    finish(new Error('Waktu sambung akun habis. Klik Sambungkan akun untuk mencoba lagi.'));
                    return;
                }
                if (popup.closed) {
                    finish(new Error('Jendela ORBITA ditutup. Klik Sambungkan akun untuk mencoba lagi.'));
                    return;
                }
                const value = takeFrom(popup);
                if (value) {
                    try { popup.close(); } catch (_) { /* Browser dapat menolak penutupan. */ }
                    finish(null, value);
                }
            }, 400);
        });
    }

    function classify(message) {
        const text = String(message || '');
        if (/akun belum diberi akses|akses tidak tersedia|khusus admin/i.test(text)) return 'access';
        if (/sesi.*(?:tidak berlaku|berakhir|berganti|kedaluwarsa)|silakan masuk (?:kembali|melalui ORBITA)/i.test(text)) return 'expired';
        return 'connection';
    }

    window.SPPD_SESSION = { token, restore, clear, openLogin, classify };
})();
