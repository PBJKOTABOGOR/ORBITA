# ORBITA – Perjalanan Dinas | v1.1.3

## Update dari v1.1.2 (tanpa reset database)
1. Backup Code.gs SPPD yang sedang digunakan. Buka Apps Script khusus spreadsheet SPPD ONLINE, bukan Apps Script Pemilihan ORBITA.
2. Ganti isi Code.gs dengan `sppd/backend/Code.gs`. Simpan. Deploy > Manage deployments > Edit > New version > Deploy. Pertahankan deployment yang sama agar URL Exec tetap. Tidak perlu menjalankan setupSPPD atau grantFirstAdmin lagi. Tidak ada perubahan header spreadsheet.
3. Upload hanya folder `sppd` dalam ZIP GITHUB_READY ke root GitHub ORBITA. URL Exec sudah terisi. Tunggu deployment GitHub Pages selesai, lalu Ctrl+F5 di SPPD.
4. Masuk sebagai Admin ORBITA yang sudah mempunyai SUPERADMIN SPPD. Buka Data OPD & pegawai. Pilih OPD dari master ORBITA, klik Buka data OPD. Tambahkan pegawai pada master, lalu pilih PA/KPA, PPTK dan bendahara. Nama/NIP/pangkat/jabatan yang tersedia diisi otomatis. Tidak semua pegawai otomatis tersedia dari ORBITA; master akun bukan master kepegawaian.
5. Menu Hak akses: pilih akun dari daftar, OPD dan kewenangan. Hubungkan akun bendahara pada master OPD setelah memberi akses Bendahara pada OPD yang sama. Tautan identitas tidak memberikan hak akses otomatis.
6. Untuk role BENDAHARA baru di ORBITA induk, gunakan paket PATCH_ROLE_BENDAHARA terpisah setelah membandingkan versi produksi dan menguji. SPPD v1.1.3 bisa diuji dengan akun lama sebelum patch induk. Tidak ada menu SPPD baru di portal.

Direktori diambil saat membuka menu master/hak akses dan disimpan di memori tab. Pencarian berlangsung lokal. Jika API direktori ringan ORBITA belum tersedia, backend mencoba adminList yang telah ada. Daftar hanya diberikan kepada Admin ORBITA yang juga SUPERADMIN SPPD. Sinkronisasi perjalanan tetap 15 detik. Data pegawai yang belum tersedia perlu diisi; tidak dibuat secara fiktif. Akun BENDAHARA baru hanya dapat memperoleh role Bendahara pada OPD asal dan tetap perlu pemberian akses eksplisit pada M_AKSES.

### Riwayat (3 versi terakhir)
- v1.1.3 — Direktori OPD dan akun, pencarian pilihan, pengisian pejabat dari master pegawai, tautan Bendahara, pembatasan role baru.
- v1.1.2 — Sesi login, pemulihan akses, pesan koneksi.
- v1.1.1 — Perapihan kode dan dokumentasi.

### Hasil uji
Sintaks, backend, cetak, sesi Node dan browser dengan halaman inline/transport simulasi lulus. Navigasi browser ke alamat asli diblokir lingkungan pengujian. Belum diuji dengan deployment produksi. Jangan membuka akses pilot ke publik. Menu disembunyikan bukan pengganti otorisasi.

## Panduan pemeliharaan

| File | Tanggung jawab |
| --- | --- |
| `index.html` | Kerangka halaman, sidebar, header, pemuatan aset |
| `assets/style.css` | Gaya dasar, cetak, tema ORBITA, responsif |
| `assets/session.js` | Pemulihan sesi, jendela login, klasifikasi kesalahan |
| `assets/app.js` | API, halaman, pipeline, formulir, event, sinkronisasi |
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
- Frontend: unggah folder `sppd` dari paket GITHUB_READY, timpa file modul versi sebelumnya saja. Jika Code.gs berubah, deploy versi baru pada deployment yang sama.
- Perbarui versi cache pada index.html ketika aset frontend berubah. Jangan menambahkan framework/CDN tanpa kebutuhan yang jelas.


## Panduan pemasangan baru dan batasan pilot

## 1. Sebelum pemasangan
- Backup spreadsheet SPPD ONLINE. Backend menunjuk ke ID yang diberikan: `1TwmlYnZmrauteciEnr6vN8CbiMma7uypg6ZfxvItWlw`. Jika pengujian menggunakan spreadsheet salinan, ganti `DB_ID` pada Code.gs. Jangan gunakan data pribadi pada pengujian.
- Pastikan hanya pengelola yang berwenang mempunyai akses langsung ke spreadsheet dan folder Drive. Operator/bendahara bekerja melalui aplikasi. Jangan membuat folder arsip dapat diakses publik.
- Modul menggunakan akun PBJ ORBITA yang sudah ada, dengan token `traxpbj_selection_token` di sessionStorage. Akses SPPD dipisahkan dalam M_AKSES. Admin konten ORBITA (provider content) bukan akun PBJ dan tidak dapat masuk ke modul ini.
- Akun khusus Bendahara memerlukan patch ORBITA induk terpisah. Jangan menggunakan role PPK/ADMIN untuk akun Bendahara murni.

## 2. Apps Script khusus SPPD
1. Buka spreadsheet SPPD ONLINE → Extensions / Ekstensi → Apps Script. Buat project baru/terpisah. Jangan menempel kode ke Apps Script ORBITA lama.
2. Salin isi `backend/Code.gs`. Tampilkan manifest `appsscript.json` melalui Project Settings, lalu salin isi manifest dari folder backend.
3. Run `setupSPPD` dan izinkan akses. Fungsi membuat 9 tab yang dibutuhkan (termasuk SPPD) jika belum ada, mengisi header tab kosong, serta membuat folder Drive arsip terbatas. Jika ada header berbeda, fungsi berhenti tanpa menimpa data. Backup dahulu.
4. Di Project Settings → Script properties, tambahkan `FIRST_ADMIN_USER_ID` dengan **user_id akun ORBITA asli**, bukan username/NIP. Ambil user ID melalui daftar akun ORBITA yang berwenang atau respons API `me` milik akun sendiri. Jangan menaruh password/token di GitHub. Jalankan `grantFirstAdmin` satu kali dari editor. Hapus property tersebut jika tidak diperlukan lagi.
5. Deploy → New deployment → Web app; Execute as: Me (akun pengelola); Who has access: sesuai kebijakan organisasi dan dukungan akses endpoint GitHub Pages (jika akses publik diizinkan, endpoint tetap memeriksa token ORBITA dan hak akses server-side untuk semua data). Jika kebijakan melarang akses endpoint publik, jangan deploy dengan pilihan tersebut; gunakan hosting/backend resmi yang disetujui.
6. Salin URL `/exec` hasil deployment ke `assets/config.js` (`apiUrl`). URL Exec ORBITA lama tetap dipakai untuk validasi `me`, tidak diganti.

## 3. GitHub
Upload **folder `sppd/`** ke root repository ORBITA, sejajar `profil-pbj/`, `assets/`, dan `admin/`. Jangan mengganti file-file tersebut. Modul dapat dibuka dari `.../ORBITA/sppd/` dalam **tab yang sama** setelah login ORBITA. Jika tab tidak memiliki sesi, ikuti alur sambung akun di atas.

Selama pilot, jangan tambahkan tautan ke Akses Cepat atau menu portal lain. Backend Code.gs disalin ke Apps Script, bukan dijalankan oleh GitHub. Tidak ada data pegawai dari Excel contoh yang dibundel di GitHub. Hanya data tarif SBU dan kode aplikasi.

## 4. Penyiapan oleh admin
- Masuk dengan akun admin yang telah diberi akses. Di Data OPD & pegawai, pilih OPD dari master ORBITA, tambahkan pegawai, pilih penandatangan dari master pegawai dan simpan identitas resmi. Tautkan akun Bendahara setelah aksesnya diberikan. NIP disimpan sebagai teks.
- Menu Hak akses: pilih akun ORBITA dan OPD, pilih OPERATOR, BENDAHARA, ADMIN_OPD, ADMIN_SHS, PEMERIKSA sesuai tugas. SUPERADMIN global menggunakan `*`. Admin SHS yang tidak diberi role perjalanan tidak mendapatkan data perjalanan. Satu user dapat memiliki beberapa OPD/role. Jangan beri role superadmin pada akun bendahara biasa.
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
