# Menampilkan SPPD di portal ORBITA (opsional)

Modul berjalan walaupun file portal tidak diubah. Login dari portal, lalu buka `../sppd/` dalam tab yang sama. **Jangan menggunakan target="_blank"** karena sessionStorage per tab.

Setelah uji pilot berhasil, di file lama `profil-pbj/index.html`, cari bagian `<div class="main-nav-dropdown quick-dropdown" role="menu">`. Tambahkan satu baris sesudah tombol Permohonan Pemilihan:

```html
<a href="../sppd/">Perjalanan Dinas (SPPD)</a>
```

Tambahkan baris yang sama di `<div class="mobile-quick-menu" id="mobileQuickMenu" aria-hidden="true">` setelah tombol Permohonan Pemilihan. Tidak perlu menyisipkan kode JS SPPD ke portal. Tautan dapat tampil untuk semua pengguna portal, tetapi SPPD memeriksa login dan grant server-side. Jika perlu tautan hanya untuk pengguna tertentu, pengaturan tampilan dapat ditambah setelah integrasi aman; menyembunyikan tautan bukan mekanisme keamanan.

Akun khusus bendahara yang belum punya akun ORBITA memerlukan role login khusus (mis. SPPD_ONLY) di backend ORBITA, allowlist aksi login/me/logout/changeOwnPassword dan pemeriksaan seluruh rute PBJ termasuk bootstrap, dashboard, API pemilihan serta SiRUP. Jangan membuat akun dengan role PPK semata-mata agar login. Patch tersebut tidak diterapkan dalam paket pilot karena bisa memengaruhi sistem produksi; uji salinan backend sebelum menerapkannya.
