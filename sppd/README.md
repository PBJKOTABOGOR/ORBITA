# ORBITA – Perjalanan Dinas | v1.1.1

Pembaruan pemeliharaan kode. Tidak mengubah alur kerja, kontrak API, struktur sheet, role, tema, tarif, atau interval sinkronisasi. URL Exec tetap terpasang.

## Panduan pemeliharaan

| File | Tanggung jawab |
| --- | --- |
| `index.html` | Kerangka halaman, sidebar, header, pemuatan aset |
| `assets/style.css` | Gaya dasar, cetak, tema ORBITA, responsif |
| `assets/app.js` | Sesi, API, halaman, pipeline, formulir, event, sinkronisasi |
| `assets/print.js` | SPD depan, visum, kuitansi, rincian dan perhitungan rampung |
| `assets/config.js` | URL Exec, interval sinkronisasi dan tautan portal |
| `backend/Code.gs` | Setup, autentikasi, hak akses, validasi, register, transaksi |
| `data/sbu-kota-bogor.json` | Sumber impor SBU; admin harus memeriksa sebelum aktivasi |
| `tests/` | Pengujian lokal dengan data simulasi |

### Ketentuan perubahan

- Gunakan indentasi empat spasi, nama fungsi yang jelas dan komentar singkat untuk aturan kerja yang tidak langsung terlihat. Nama API, status dan kolom lama dipertahankan agar deployment tetap kompatibel.
- Cari penanda bagian pada app.js atau Code.gs sebelum mengubah fungsi. Template HTML cetak dan tampilan yang panjang dipertahankan isinya agar format keluaran tidak berubah.
- Jangan menyimpan password, token login, NIP pegawai, atau dokumen SPJ ke GitHub. URL Web App bukan pengganti autentikasi.
- Ubah hanya modul yang diperlukan. Jangan menjalankan setup ulang untuk perubahan tampilan. Jangan mengubah CSS portal induk.
- Jalankan `node tests/backend.test.cjs` dan `node tests/print.test.cjs` dari folder `sppd` setelah mengubah kode. Uji dengan akun dan data simulasi sebelum deployment produksi.
- Frontend: unggah folder `sppd` dari paket GITHUB_READY, timpa file modul versi sebelumnya saja. Backend yang sudah terpasang tidak perlu dideploy ulang karena logikanya sama. Gunakan Code.gs yang dirapikan saat melakukan pemeliharaan backend berikutnya.
- Perbarui versi cache pada index.html ketika aset frontend berubah. Jangan menambahkan framework/CDN tanpa kebutuhan yang jelas.

### Riwayat pembaruan (3 terakhir)

- v1.1.1 — Perapihan kode, penanda bagian, panduan pemeliharaan, dan versi cache aset. Uji backend dan cetak dengan mock lulus.
- v1.1 — Penyesuaian desain dengan ORBITA dan konfigurasi URL Exec.
- v1.0 — Modul pilot perjalanan dinas, SBU, register dan SPJ.

---

# Konfigurasi deployment siap pakai

URL Exec SPPD sudah diisi pada `assets/config.js`. Gunakan paket GITHUB_READY untuk upload folder frontend `sppd/` saja. Backend tidak perlu deploy ulang bila setup sudah selesai.

# Pembaruan V1.1 — Tampilan ORBITA

- Desain mengikuti CSS asli `assets/css/profile.css` dan `assets/css/selection.css` v29.02 pada ORBITA-main (20 November 2026). Palet, logo, sidebar terang, menu aktif per kategori, kartu, tombol dan pipeline diselaraskan. Seluruh aset tetap lokal di dalam `sppd/`.
- Jika V1.0 sudah dipasang, cukup salin `index.html`, `assets/style.css`, `assets/app.js`, `assets/traxpbj-logo.png`, dan `assets/favicon.png` ke folder `sppd/` yang sama. Pertahankan `assets/config.js` milik deployment Anda. Tidak perlu deploy Apps Script ulang atau setup spreadsheet lagi.
- Backend, manifest, konfigurasi bawaan, data SBU dan generator cetak identik dengan V1.0. Tidak ada perubahan API, hak akses, penyimpanan, atau interval sinkronisasi 15 detik.
- Uji browser Chromium dengan API simulasi: ringkasan, navigasi, tambah peserta, kalkulasi, detail pipeline, tampilan mobile. Belum diuji pada deployment produksi.

---

# ORBITA – Perjalanan Dinas | v1.0 Pilot

Modul mandiri untuk mengurangi pengisian berulang SPD dan SPJ perjalanan dinas. **Uji dengan akun dan data simulasi sebelum produksi.** Folder ini tidak mengganti file ORBITA yang telah berjalan.

## 1. Sebelum pemasangan
- Backup spreadsheet SPPD ONLINE. Backend menunjuk ke ID yang diberikan: `1TwmlYnZmrauteciEnr6vN8CbiMma7uypg6ZfxvItWlw`. Jika pengujian menggunakan spreadsheet salinan, ganti `DB_ID` pada Code.gs. Jangan gunakan data pribadi pada pengujian.
- Pastikan hanya pengelola yang berwenang mempunyai akses langsung ke spreadsheet dan folder Drive. Operator/bendahara bekerja melalui aplikasi. Jangan membuat folder arsip dapat diakses publik.
- Modul menggunakan akun PBJ ORBITA yang sudah ada, dengan token `traxpbj_selection_token` di sessionStorage. Akses SPPD dipisahkan dalam M_AKSES. Admin konten ORBITA (provider content) bukan akun PBJ dan tidak dapat masuk ke modul ini.
- Untuk pilot, gunakan akun ORBITA yang sudah memiliki kewenangan PBJ yang sah. Jangan membuat akun bendahara baru dengan role PPK/ADMIN hanya agar dapat login. Akun khusus SPPD tanpa akses PBJ membutuhkan penambahan role login tersendiri dan pembatasan API pada backend ORBITA, diuji terpisah. Paket ini sengaja tidak menerapkan perubahan tersebut ke sistem produksi.

## 2. Apps Script khusus SPPD
1. Buka spreadsheet SPPD ONLINE → Extensions / Ekstensi → Apps Script. Buat project baru/terpisah. Jangan menempel kode ke Apps Script ORBITA lama.
2. Salin isi `backend/Code.gs`. Tampilkan manifest `appsscript.json` melalui Project Settings, lalu salin isi manifest dari folder backend.
3. Run `setupSPPD` dan izinkan akses. Fungsi membuat 9 tab yang dibutuhkan (termasuk SPPD) jika belum ada, mengisi header tab kosong, serta membuat folder Drive arsip terbatas. Jika ada header berbeda, fungsi berhenti tanpa menimpa data. Backup dahulu.
4. Di Project Settings → Script properties, tambahkan `FIRST_ADMIN_USER_ID` dengan **user_id akun ORBITA asli**, bukan username/NIP. Ambil user ID melalui daftar akun ORBITA yang berwenang atau respons API `me` milik akun sendiri. Jangan menaruh password/token di GitHub. Jalankan `grantFirstAdmin` satu kali dari editor. Hapus property tersebut jika tidak diperlukan lagi.
5. Deploy → New deployment → Web app; Execute as: Me (akun pengelola); Who has access: sesuai kebijakan organisasi dan dukungan akses endpoint GitHub Pages (jika akses publik diizinkan, endpoint tetap memeriksa token ORBITA dan hak akses server-side untuk semua data). Jika kebijakan melarang akses endpoint publik, jangan deploy dengan pilihan tersebut; gunakan hosting/backend resmi yang disetujui.
6. Salin URL `/exec` hasil deployment ke `assets/config.js` (`apiUrl`). URL Exec ORBITA lama tetap dipakai untuk validasi `me`, tidak diganti.

## 3. GitHub
Upload **folder `sppd/`** ke root repository ORBITA, sejajar `profil-pbj/`, `assets/`, dan `admin/`. Jangan mengganti file-file tersebut. Modul dapat dibuka dari `.../ORBITA/sppd/` dalam **tab yang sama** setelah login ORBITA. Bila diminta login, kembali ke portal, masuk dengan akun PBJ, lalu buka modul.

Opsional: ikuti `integrasi/MENU-ORBITA.md` untuk menambah tautan dari Akses Cepat. Ini satu perubahan kecil pada HTML portal yang terpisah dari modul. Tidak perlu mengunggah ulang repository. Backend Code.gs disalin ke Apps Script, bukan dijalankan oleh GitHub. Tidak ada data pegawai dari Excel contoh yang dibundel di GitHub. Hanya data tarif SBU dan kode aplikasi.

## 4. Penyiapan oleh admin
- Masuk dengan akun admin yang telah diberi akses. Di Data OPD & pegawai, buat identitas OPD dengan kode/nama yang disepakati (persis sama pada M_AKSES), nama pejabat PA/KPA, PPTK, Bendahara, NIP, alamat dan unit. Isi pegawai; NIP disimpan sebagai teks dalam JSON.
- Menu Hak akses: masukkan user_id ORBITA, OPD, pilih OPERATOR, BENDAHARA, ADMIN_OPD, ADMIN_SHS, PEMERIKSA sesuai tugas. SUPERADMIN global menggunakan `*`. Admin SHS yang tidak diberi role perjalanan tidak mendapatkan data perjalanan. Satu user dapat memiliki beberapa OPD/role. Jangan beri role superadmin pada akun bendahara biasa.
- Menu Standar biaya: isi tahun, tanggal mulai berlaku dan dasar hukum resmi; impor 2.129 item dari lampiran SBU. Semua masuk sebagai BELUM AKTIF. Periksa dan sesuaikan tarif draft, lalu aktifkan kelompok versi. Dapat menambah item sendiri. Versi sebelumnya tidak dihapus; tarif yang efektif pada tanggal mulai perjalanan yang digunakan. Tarif yang sudah terbit tersimpan di dokumen. SBU lampiran tidak mengidentifikasi dasar hukum/tahun efektif secara eksplisit pada data yang diolah; konfirmasi BKAD sebelum aktivasi. Nama tarif harian luar daerah mengikuti provinsi, bukan membuat tarif per kota tanpa dasar.
- Register SPD: gunakan nomor manual dari tata usaha/SRIKANDI. Jika tata usaha mengizinkan register internal otomatis, masukkan pola resmi yang memuat `{urut}` dan opsional `{tahun}` serta nomor awal. Tidak ada pola atau klasifikasi surat yang dianggap resmi secara otomatis. Jangan gunakan dua register resmi bersamaan.

## 5. Alur operator dan bendahara
Buat perjalanan → pilih pegawai (maksimal 30, bergantung ukuran data) → pilih tujuan, provinsi, kategori Luar Kota/Diklat → isi biaya dan uang muka → simpan draft → periksa dan terbitkan nomor SPD → cetak SPD depan dan belakang, kuitansi, rincian biaya dan perhitungan rampung → tanda tangan basah/cap → unggah PDF → sesuaikan biaya riil jika perlu → ajukan ke bendahara → bendahara periksa, kembalikan dengan catatan atau tandai siap bayar → catat pembayaran/BKU → arsip. Aplikasi tidak mengirim pembayaran ke bank/SIPD dan tidak mengesahkan tanda tangan elektronik. Gunakan tombol Cetak semua / Simpan PDF melalui dialog cetak browser. NIP, identitas, tarif dan nomor tidak diambil dari data contoh Excel yang berisi orang nyata. Format HTML cetak direkonstruksi dari susunan tiga sheet contoh, bukan salinan identik sel/margin Excel; wajib bandingkan hasil cetak A4, logo/kop resmi, visum, kuitansi Model U.XV, rincian biaya, pengesahan dan perhitungan rampung dengan format resmi sebelum produksi. Tidak ada gambar tanda tangan yang ditempel otomatis.

## 6. Kecepatan dan sinkronisasi
- UI ringan tanpa framework/CDN, satu request init untuk identitas, ringkasan, master OPD dan tarif harian tahun aktif. Data SBU lengkap dimuat hanya di menu admin tarif. Perhitungan lokal tanpa panggilan server per ketikan.
- Status dan daftar diperbarui segera setelah respons simpan. Sinkronisasi antarpengguna melalui polling versi (15 detik, configurable) hanya saat halaman aktif. Bila versi tidak berubah, daftar tidak diunduh lagi. BroadcastChannel mempercepat pembaruan tab pada browser yang sama. Pembaruan antarperangkat bersifat near-real-time, bukan WebSocket/push. Latensi aktual bergantung Apps Script/Sheets/jaringan. Polling berhenti saat tab tersembunyi. Perubahan spreadsheet secara langsung tidak mengubah versi; gunakan aplikasi atau tombol Perbarui. Setelah tarif/master diubah pengguna lain, buka ulang modul sebelum membuat draft baru; server tetap memeriksa tarif terbaru saat simpan/terbit.
- Nomor dilindungi LockService dan register ganda diperiksa. Penyimpanan draft memiliki idempotency key dan pemeriksaan versi. Backend melakukan autentikasi ORBITA setiap request; tidak ada cache token publik. Pada timeout, cek daftar dulu sebelum mengulang operasi. Tidak ada transaksi database multi-sheet yang sepenuhnya atomik di Apps Script; pantau audit/register.
- Jangan memuat semua SPPD saat membuka ORBITA utama. Modul hanya berjalan ketika dibuka.

## 7. Batas pilot dan uji produksi
Uji lokal `node tests/backend.test.cjs` dan `node tests/print.test.cjs` (mock Apps Script, bukan deployment). Syntax JS dan Code.gs diperiksa. Belum ada pengujian browser end-to-end, deployment live, verifikasi hasil printer, beban pengguna serentak, atau pengujian keamanan independen. Belum mengubah spreadsheet maupun repo ORBITA. Uji akun admin, operator, bendahara dan lintas OPD, proses logout, koneksi, nomor manual/otomatis, pembaruan tarif, SPJ, hasil cetak, upload/download dan pembatasan akses dengan akun simulasi.

V1 ini memfokuskan uang harian luar daerah dan diklat berdasarkan provinsi. Biaya lainnya dapat diisi manual dan dikaji bendahara; belum ada validasi semua batas tarif penginapan/transportasi/paket meeting, perjalanan dalam kota/luar negeri, tarif khusus, impor master pegawai Excel, format Surat Tugas, ekspor DOCX/XLSX, atau integrasi pembayaran SIPD. Belum ada checklist lampiran terperinci per jenis; berkas minimal satu PDF untuk pengajuan dan bendahara harus melakukan pemeriksaan fisik. Jika biaya direvisi, cetak/unggah dokumen final yang sesuai dan tandatangani ulang jika diperlukan. Untuk produksi, lengkapi aturan biaya, validasi dan checklist, master pegawai impor, kebijakan akses, audit, retensi arsip, backup, serta tinjauan BKAD/Bagian Hukum. Jangan menganggap tarif draft/angka contoh sebagai hak bayar otomatis.
