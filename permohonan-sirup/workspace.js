/* Navigasi dan ringkasan. Tidak melakukan permintaan data ke server. */
(function () {
    'use strict';

    const byId = id => document.getElementById(id);
    const pages = {
        ringkasan: ['Ringkasan SiRUP', 'Lihat data RUP dan perkembangan permohonan.'],
        ajukan: ['Ajukan perubahan', 'Pilih RUP, susun usulan, lalu lampirkan surat permohonan.'],
        riwayat: ['Riwayat pengajuan', 'Pantau tahapan, catatan admin, dan hasil pemeriksaan.'],
        admin: ['Verifikasi admin', 'Periksa usulan dan catat pembukaan atau penutupan akses.']
    };
    const statuses = [
        ['DRAF', 'Draft', 'Belum dikirim'],
        ['DIAJUKAN', 'Diajukan', 'Menunggu pemeriksaan'],
        ['DIVERIFIKASI', 'Diverifikasi', 'Menunggu pembukaan akses'],
        ['AKSES_DIBUKA', 'Akses dibuka', 'OPD memperbarui RUP'],
        ['DITUTUP', 'Akses ditutup', 'Menunggu pencocokan'],
        ['SELESAI', 'Sudah dibandingkan', 'Hasil pencocokan tersedia'],
        ['DITOLAK', 'Ditolak', 'Lihat catatan admin']
    ];
    let actions;
    let lastRecords;
    let lastAdmin;

    function element(tag, className, text) {
        const node = document.createElement(tag);
        if (className) node.className = className;
        if (text !== undefined) node.textContent = text;
        return node;
    }

    function setPage(key, scroll = true) {
        if (!pages[key]) return;
        document.body.classList.add('workspace-ready');
        byId('pageTitle').textContent = pages[key][0];
        byId('pageDescription').textContent = pages[key][1];
        document.querySelectorAll('.workspace-nav [data-tab]').forEach(button => {
            if (button.dataset.tab === key) button.setAttribute('aria-current', 'page');
            else button.removeAttribute('aria-current');
        });
        if (scroll) window.scrollTo({ top: 0, behavior: 'instant' });
        updateSteps();
    }

    function setOffice(office, admin) {
        byId('activeOffice').textContent = office || (admin ? 'Semua satuan kerja' : 'Satuan kerja belum tersedia');
        byId('officeContextNote').textContent = office
            ? 'Rincian RUP untuk satuan kerja ini. Riwayat mengikuti hak akses akun.'
            : admin ? 'Pilih satuan kerja untuk melihat pagu RUP atau membuat usulan.' : 'Satuan kerja belum tersedia.';
    }

    function renderStatusCards(target, counts, adminOnly) {
        const root = byId(target);
        if (!root) return;
        const fragment = document.createDocumentFragment();
        const shown = adminOnly ? statuses.filter(([key]) => !['DRAF', 'SELESAI', 'DITOLAK'].includes(key)) : statuses;
        shown.forEach(([key, name, description]) => {
            const button = element('button', 'status-card ' + key);
            button.type = 'button';
            button.dataset.filterStatus = key;
            button.append(element('span', 'status-dot'), element('strong', '', name), element('b', 'status-number', String(counts.get(key) || 0)), element('small', '', description));
            fragment.append(button);
        });
        root.replaceChildren(fragment);
    }

    function renderSummary(records, admin) {
        if (lastRecords === records && lastAdmin === admin) return;
        lastRecords = records;
        lastAdmin = admin;
        const counts = new Map();
        for (const record of records) counts.set(record.status, (counts.get(record.status) || 0) + 1);
        renderStatusCards('statusSummary', counts, false);
        if (admin) renderStatusCards('adminSummary', counts, true);

        const recent = [...records].sort((a, b) => (Date.parse(b.createdAt) || 0) - (Date.parse(a.createdAt) || 0)).slice(0, 5);
        const fragment = document.createDocumentFragment();
        recent.forEach(record => {
            const item = element('button', 'recent-item');
            item.type = 'button';
            item.dataset.openRequest = record.id;
            const title = element('span', 'recent-title');
            const isMulti = String(record.kodeRup).toUpperCase() === 'MULTI';
            title.append(element('strong', '', record.namaPaket || record.id), element('small', '', [record.id, record.satker, !isMulti && record.kodeRup ? 'RUP ' + record.kodeRup : ''].filter(Boolean).join(' · ')));
            const status = statuses.find(([key]) => key === record.status);
            item.append(title, element('span', 'tag ' + (status ? status[0] : ''), status ? status[1] : String(record.status || '—')), element('span', 'recent-arrow', '›'));
            fragment.append(item);
        });
        if (!recent.length) fragment.append(element('p', 'muted', 'Belum ada pengajuan pada akun ini.'));
        byId('recentRequests').replaceChildren(fragment);
    }

    function updateSteps() {
        const editor = !byId('editPanel').hidden;
        const queued = Number(byId('batchCount').textContent) > 0;
        const letter = !byId('letterPanel').hidden;
        const budgetOk = !byId('budgetCheck').hidden && byId('budgetCheck').dataset.level === 'ok';
        const available = [true, editor, true, letter];
        // Tahapan ini menunjukkan bagian yang dapat dibuka, bukan status verifikasi admin.
        const current = editor ? 1 : queued && budgetOk && letter ? 3 : queued ? 2 : 0;
        document.querySelectorAll('.form-progress button').forEach((button, index) => {
            button.disabled = !available[index];
            button.classList.toggle('current', index === current);
            button.classList.toggle('done', (index === 0 && (editor || queued)) || (index === 1 && queued && !editor) || (index === 2 && queued && budgetOk));
            if (index === current) button.setAttribute('aria-current', 'step');
            else button.removeAttribute('aria-current');
        });
    }

    function bind(callbacks) {
        actions = callbacks;
        document.addEventListener('click', event => {
            const button = event.target.closest('[data-go-tab], [data-filter-status], [data-open-request], [data-jump]');
            if (!button || button.disabled) return;
            if (button.dataset.goTab) actions.go(button.dataset.goTab);
            else if (button.dataset.filterStatus) actions.filter(button.dataset.filterStatus);
            else if (button.dataset.openRequest) actions.detail(button.dataset.openRequest);
            else if (button.dataset.jump) {
                const target = byId(button.dataset.jump);
                if (target && !target.hidden) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        });
        const observer = new MutationObserver(updateSteps);
        for (const id of ['editPanel', 'letterPanel', 'budgetCheck']) {
            observer.observe(byId(id), { attributes: true, attributeFilter: ['hidden', 'data-level'] });
        }
        observer.observe(byId('batchCount'), { childList: true, characterData: true, subtree: true });
        updateSteps();
    }

    window.SirupWorkspace = { bind, setPage, setOffice, renderSummary };
})();
