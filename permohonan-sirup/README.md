# Permohonan SiRUP — v29.35

## Pemasangan
1. Cadangkan folder `permohonan-sirup` di repository ORBITA.
2. Ekstrak ZIP. Unggah folder `permohonan-sirup` ke root repository, menimpa berkas modul yang sudah ada. Jangan membuat folder bertingkat ganda.
3. Tunggu GitHub Pages selesai, lalu buka alamat Permohonan SiRUP yang lama melalui akun ORBITA pada tab yang sama. Tekan Ctrl+F5 jika tampilan lama masih muncul.
4. Uji dengan akun Admin dan OPD. Pastikan status, pencarian RUP, draft, unggah surat, validasi pagu, serta pemeriksaan berjalan sesuai data uji.

Tidak perlu menjalankan setup spreadsheet, mengganti URL Web App, deploy ulang Apps Script, mengubah menu portal, atau menambahkan SPPD. Modul tetap memakai `../assets/js/selection-config.js` dan `../assets/js/selection-api.js` bawaan ORBITA. Tautan notifikasi `permohonan-sirup/?id=...` tidak berubah.

## Berkas
- `index.html`: kerangka halaman dan kontrol formulir.
- `workspace.css`: layout sidebar, ringkasan, kartu status, tahapan pengisian dan tampilan responsif.
- `workspace.js`: navigasi, ringkasan dan tahap pengisian; tidak memanggil API.
- `permohonan.css`: komponen formulir, tabel, modal, unggah dan pipeline lama.
- `permohonan.js`: sesi, API, data RUP, formulir, validasi pagu, draft, pengajuan, riwayat dan verifikasi.

Perubahan antarmuka dihubungkan melalui `window.SirupWorkspace`. Pertahankan ID kontrol, nama API dan kontrak payload. Perubahan status resmi dan hak akses tetap ditentukan backend. Ringkasan mengikuti lingkup data riwayat yang dikembalikan server; angka RUP mengikuti satuan kerja yang dipilih.

## Pengujian
- v29.35: Chromium dengan API dan penyimpanan preferensi simulasi, Admin desktop (1440 px) dan PPK mobile (390 px). Buka/tutup menu, pemulihan preferensi, pilihan RUP/formulir tetap utuh dan tidak ada panggilan API tambahan; uji navigasi, mode pengajuan dan pipeline lulus. Pengujian penyimpanan pada origin produksi belum dilakukan.
- Sintaks JS lulus. Seluruh 91 ID HTML lama tetap ada.
- 81 deklarasi fungsi lama dipertahankan. Perbandingan pohon sintaks menunjukkan hanya empat fungsi berubah untuk navigasi/ringkasan (`tab`, `init`, `renderHistory`, `wire`); nilai tab awal menjadi `ringkasan`. Urutan dan nilai aturan CSS lama dipertahankan saat dirapikan.
- Chromium dengan API simulasi: Admin desktop dan PPK mobile, dua panggilan bootstrap paralel, filter riwayat, pemilihan empat jenis usulan, pemeriksaan pagu simulasi, antrean admin, dan detail pipeline lulus. Navigasi/filter tidak menambah panggilan API.
- Tes sumber v29.33 menggunakan pola teks/versi yang tepat. Sebelum perubahan: 43 dari 45 subtes lulus. Setelah pemformatan, sebagian tes lama tidak bisa menemukan pola karena perubahan spasi/atribut/versi; hasil runner lama 23 dari 33 subtes yang terdaftar lulus, 10 gagal, termasuk dua kegagalan lama. Tes tersebut belum diperbarui. Bukan bukti bahwa seluruh regresi telah lulus.
- Belum diuji menggunakan akun dan server produksi; belum melakukan pengiriman surat, verifikasi atau perubahan data produksi. Tidak ada klaim sinkronisasi push realtime baru. Data awal dan pola refresh backend sama seperti sebelumnya.

## Pengaturan sidebar
Tombol di header menyembunyikan atau menampilkan menu tanpa memuat ulang halaman. Area kerja memakai seluruh lebar layar ketika menu disembunyikan. Pilihan tampilan disimpan pada browser melalui `orbita.sirup.sidebar.collapsed`; jika penyimpanan diblokir, tombol tetap berfungsi. Tidak ada perubahan pada API atau data pengajuan.

## Tiga pembaruan terakhir
- v29.35: menu sidebar dapat disembunyikan, ruang kerja melebar, pilihan tampilan diingat.
- v29.34: tampilan Permohonan SiRUP terpisah per menu, ringkasan, antrean admin, tahapan pengisian, perapihan kode frontend.
- v29.33: Handover PPK dihitung selesai untuk pekerjaan Pokja; status INAPROC tetap.
