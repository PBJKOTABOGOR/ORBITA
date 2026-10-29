/* ORBITA v28.76 — penyiapan foto Pimpinan dan Tim PBJ pada layar awal. */
(() => {
  'use strict';
  const MAX_WAIT_MS = 8500;
  const MIN_SPLASH_MS = 320;
  const PARALLEL_IMAGES = 6;
  const startedAt = Date.now();
  const loader = document.getElementById('siteLoader');
  const count = loader?.querySelector('[data-loader-count]');
  const status = loader?.querySelector('[data-loader-photo-status]');
  const photoCache = new Map(); // Simpan Promise, bukan elemen Image besar dalam memori.
  let released = false;
  let generation = 0;
  let deadline;

  function progress(done, total) {
    if (released) return;
    if (count) count.textContent = total ? `${Math.round(done / total * 100)}`.padStart(2, '0') : '00';
    if (status) status.textContent = total
      ? `Menyiapkan foto Pimpinan & Tim PBJ (${done}/${total})`
      : 'Menyiapkan tampilan ORBITA';
  }

  function release() {
    if (released) return;
    released = true;
    clearTimeout(deadline);
    const elapsed = Date.now() - startedAt;
    setTimeout(() => {
      if (status) status.textContent = 'Siap';
      if (count) count.textContent = '100';
      loader?.classList.add('handoff');
      document.body.classList.remove('site-booting');
      setTimeout(() => loader?.remove(), 850);
    }, Math.max(0, MIN_SPLASH_MS - elapsed));
  }

  function uniquePhotos(detail) {
    const leaders = detail?.content?.leaders || window.TRAXPBJ_ADMIN_CONTENT?.leaders || {};
    const team = detail?.siteContent?.team || window.TRAXPBJ_SITE_CONTENT?.team || [];
    const sources = [
      ...['kabag','lpse','advokasi','pengelolaan'].map(key => leaders[key]?.photo),
      ...(Array.isArray(team) ? team.map(person => person?.photo) : [])
    ];
    const urls = new Set();
    for (const src of sources) {
      const value = String(src || '').trim();
      if (value && !urls.has(value)) urls.add(value);
    }
    return [...urls];
  }

  function warm(url) {
    if (photoCache.has(url)) return photoCache.get(url);
    const img = new Image();
    img.decoding = 'async';
    img.fetchPriority = 'low';
    const promise = new Promise(resolve => {
      let settled = false;
      const finish = ok => {
        if (settled) return;
        settled = true;
        img.onload = null;
        img.onerror = null;
        // Gagal tidak menghalangi website dibuka.
        resolve(ok);
      };
      img.onload = () => {
        if (typeof img.decode === 'function') img.decode().then(() => finish(true), () => finish(true));
        else finish(true);
      };
      img.onerror = () => finish(false);
      img.src = url;
      if (img.complete && img.naturalWidth > 0) finish(true);
    });
    photoCache.set(url, promise);
    return promise;
  }

  async function warmBatch(urls, updateProgress) {
    let next = 0;
    let done = 0;
    const worker = async () => {
      while (next < urls.length) {
        const url = urls[next++];
        await warm(url);
        done++;
        updateProgress?.(done, urls.length);
      }
    };
    await Promise.all(Array.from({ length: Math.min(PARALLEL_IMAGES, urls.length) }, worker));
  }

  function onContentReady(event) {
    const detail = event.detail || {};
    const urls = uniquePhotos(detail);
    const source = detail.source || '';
    if (!urls.length) {
      // Konten lokal awal biasanya kosong. Tunggu cache/API sebelum memutuskan tidak ada foto.
      if (source === 'network') release();
      return;
    }
    const batch = ++generation;
    progress(0, urls.length);
    warmBatch(urls, (done, total) => { if (batch === generation) progress(done, total); })
      .then(() => { if (batch === generation) release(); })
      .catch(() => { if (batch === generation) release(); });
  }

  // Didaftarkan sejak head/body paling awal, sebelum data CMS mulai dimuat.
  document.addEventListener('trax:content-ready', onContentReady);
  deadline = setTimeout(release, MAX_WAIT_MS);
  // Konten mungkin sudah tersedia dari cache bila script memuat lebih cepat.
  if (window.TRAXPBJ_SITE_CONTENT?.team?.length || Object.values(window.TRAXPBJ_ADMIN_CONTENT?.leaders || {}).some(x => x?.photo)) {
    onContentReady({detail:{source:'cache',siteContent:window.TRAXPBJ_SITE_CONTENT,content:window.TRAXPBJ_ADMIN_CONTENT}});
  }
  // Buka situs walau data CMS atau salah satu foto gagal terhubung.
  window.ORBITA_PHOTO_PRELOAD = { warm, get loadedCount(){ return photoCache.size; } };
})();
