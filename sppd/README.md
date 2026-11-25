# ORBITA – Perjalanan Dinas | v1.2.1

Modul internal Bagian Pengadaan Barang dan Jasa Kota Bogor. Tidak mengubah portal, permohonan pemilihan, atau Permohonan SiRUP. Role Bendahara ORBITA induk belum digunakan. Menu SPPD tetap tidak ditampilkan di Akses Cepat.

## Pemasangan dari versi sebelumnya

1. Backup spreadsheet SPPD ONLINE dan kode Apps Script SPPD. Untuk uji awal, gunakan salinan spreadsheet dan deployment terpisah bila memungkinkan.
2. Buka Apps Script milik SPPD ONLINE, bukan Apps Script ORBITA induk. Ganti `Code.gs` dengan `backend/Code.gs`. Manifest tetap sama; file cadangan tersedia di `backend/appsscript.json`.
3. Jalankan `setupSPPD` sekali dari editor. Fungsi ini menambahkan tab `M_PAGU_AWAL` yang baru, mempertahankan header dan data tab yang sudah ada, serta tidak menyentuh `KODE_REK`. Bila ada header lama tidak sesuai, fungsi berhenti dan tidak menimpa data. Tidak perlu menjalankan `grantFirstAdmin` ulang jika akun admin sudah aktif.
4. Deploy > Manage deployments > Edit > New version > Deploy. Pertahankan deployment yang sama dan URL Exec yang sudah terpasang di `assets/config.js`.
5. Ekstrak ZIP GITHUB_READY. Upload folder `sppd` ke root repository ORBITA dan timpa file modul lama saja. Jangan unggah folder backend atau tests ke GitHub Pages.
6. Setelah GitHub Pages selesai, buka ORBITA, login dengan akun yang sudah diberi izin SPPD, lalu buka `https://pbjkotabogor.github.io/ORBITA/sppd/` di tab yang sama. Tekan Ctrl+F5.

## Sumber pagu

Sheet `KODE_REK` pada SPPD ONLINE (gid 1391601852) dibaca tanpa diubah. Format terbaru SIPD menggunakan `Kode Unit`, `Unit`, `Kode Sub Kegiatan`, `Sub Kegiatan`, `Kode Sumber Dana`, `Sumber Dana`, `Kode Akun`, `Akun`, dan `Jumlah (Rp)`. Kode unit Bagian PBJ adalah `4.01.7.01.2.13.23.0009`; hanya rekening dengan awalan `5.1.02.04.` yang digunakan. Header dikenali berdasarkan nama, tidak bergantung urutan kolom. Format lama yang memiliki kolom tahun juga diterima jika memuat kode unit yang sama.

Karena ekspor terbaru tidak memiliki kolom tahun, sumber tersebut dipatok ke tahun anggaran 2026 melalui konstanta `KODE_REK_YEAR`. Jangan mengganti sumber dengan data tahun berbeda tanpa menyesuaikan konfigurasi serta mengarsipkan sumber tahun lama. Pagu di tahun lain tidak dipalsukan. Kunci transaksi tetap tahun|subkegiatan|rekening|sumber dana. Paket dan kelompok dalam satu kombinasi dijumlahkan; saldo awal tidak digandakan. Sistem hanya membaca detail baris unit PBJ (pencarian satu kolom dengan TextFinder), bukan semua kolom data seluruh OPD pada setiap sinkronisasi.

Hasil baca sumber 25 November 2026: Pengelolaan PBJ Rp288.944.000; Layanan Pengadaan Secara Elektronik Rp19.974.000; Pembinaan dan Advokasi PBJ Rp8.620.000. Total Rp317.538.000. Nilai tidak ditanam di kode dan bisa berubah saat sumber diperbarui.

## Persiapan admin

- **Monitoring pagu:** konfirmasi pemakaian sebelum aplikasi untuk setiap rekening/subkegiatan, termasuk nol bila memang tidak ada. Jangan masukkan SPD yang sudah tercatat di aplikasi ke pemakaian awal lagi. Pagu adalah anggaran tahunan, bukan otomatis saldo kas atau pencairan SIPD.
- **Pegawai & pejabat:** isi identitas/kop, PA/KPA, PPTK, penandatangan kuitansi (termasuk nama Bendahara), NIP, pangkat dan jabatan secara manual. Data ini tidak dihubungkan ke akun Bendahara. Tambahkan master pegawai sekali, lalu pilih saat membuat SPD. NIP disimpan sebagai teks. Identitas yang dipakai disalin ke dokumen, supaya perubahan master tidak mengubah SPD lama.
- **Standar biaya (SBU):** impor 2.129 item yang disediakan dari Excel, isi tahun, tanggal berlaku dan dasar hukum resmi. Periksa tarif sebelum mengaktifkan. Tarif aktif tidak ditimpa; versi baru dapat ditambahkan. Uang harian luar daerah/diklat sesuai provinsi dihitung otomatis. Biaya lain diisi dengan keterangan dan perlu diperiksa secara manual.
- **Register SPD:** nomor manual dari register resmi atau otomatis sesuai pola yang ditetapkan tata usaha. Admin dapat mengatur nomor awal dan pola dengan `{urut}` serta opsional `{tahun}`. Hindari dua register resmi. Nomor yang batal tetap ada pada register.
- **Hak akses:** gunakan akun ORBITA yang sudah ada. Admin memberi izin SPPD secara terpisah melalui `M_AKSES`/menu Hak akses; lingkup PBJ (`PBJ`), superadmin `*`. Role `OPERATOR`, `ADMIN_OPD`, `ADMIN_SHS`, `SUPERADMIN`. Tidak ada akses otomatis untuk seluruh OPD dan tidak perlu patch role Bendahara. Daftar akun ORBITA hanya diakses admin yang berwenang saat membuka menu Hak akses; identitas penandatangan tidak terkait akun.

## Alur kerja

Buat SPPD → pilih rekening dan peserta → isi rincian biaya → simpan draft → terbitkan SPD → cetak → lengkapi berkas → selesai. Surat perintah PDF maksimal 4 MB boleh diunggah saat menyimpan draft atau menyusul melalui detail. Jika upload gagal, draft tetap tersimpan dan dapat dilengkapi kembali.

- Dokumen: SPD depan/belakang, kuitansi Model U.XV, rincian biaya, perhitungan rampung. Gunakan dialog cetak browser untuk cetak/simpan PDF; tanda tangan basah dan cap diselesaikan di luar aplikasi. Format hasil rekonstruksi Excel perlu diperiksa dengan contoh resmi sebelum penggunaan. Tidak ada tanda tangan otomatis.
- Draft belum mengurangi pagu. SPD terbit mencatat alokasi biaya; saldo diperiksa server di bawah LockService sebelum terbit dan saat penyesuaian biaya. Pembatalan oleh admin memulihkan alokasi tanpa menghapus nomor/riwayat. Perubahan biaya riil dicatat dengan alasan. Aplikasi menahan penerbitan jika sisa tidak cukup, pemakaian awal belum dikonfirmasi, atau SPD terbit lama belum memiliki rekening yang cocok.
- Seluruh akun yang diberi izin PBJ dapat melihat riwayat PBJ. Nama pembuat dan aktivitas tersimpan di database; bukan hanya browser. Tidak ada alur verifikasi/pembayaran Bendahara pada versi ini. Saldo internal bukan realisasi resmi SIPD; pekerjaan di luar aplikasi harus dicatat melalui pemakaian awal yang sesuai. Biaya bersama dicatat satu kali pada peserta yang bertanggung jawab.

## Pemeliharaan

| File | Tanggung jawab |
| --- | --- |
| index.html | Kerangka, header, sidebar |
| assets/style.css | Tampilan ORBITA dan cetak |
| assets/session.js | Sesi login ORBITA |
| assets/app.js | Menu, formulir, kalkulasi, riwayat, sinkronisasi |
| assets/print.js | SPD, kuitansi, rincian biaya, rampung |
| assets/config.js | URL Exec dan interval pembaruan |
| backend/Code.gs | Akses, sumber pagu, register, penyimpanan dan audit |
| data/sbu-kota-bogor.json | Master SBU yang diperiksa admin |
| tests/ | Pengujian dengan data simulasi |

Satu permintaan init; dropdown dan kalkulasi lokal; perpindahan menu tanpa reload. Perubahan transaksi tampil setelah respons simpan, antartab/antarperangkat melalui pemeriksaan versi 15 detik saat tab aktif. Perubahan pagu pada KODE_REK dibaca ulang saat sinkronisasi. Polling bukan realtime push; latensi tergantung Apps Script, jaringan dan volume penggunaan. Sidebar dapat ditutup untuk memperluas area kerja.

Jangan simpan password, token, data pegawai maupun PDF pada GitHub publik. Folder Drive arsip harus dibatasi, spreadsheet hanya dapat diedit pengelola. URL tersembunyi bukan kontrol akses. Backup sebelum deploy; jangan menimpa ORBITA induk. Apps Script tidak memberi transaksi atomik antarsheet; periksa register/audit jika operasi gagal. Jalankan `node tests/backend.test.cjs`, `node tests/print.test.cjs`, dan `node tests/session.test.cjs` dari folder `sppd` setelah perubahan. Gunakan komentar singkat dan penamaan konsisten, jangan ubah kontrak API/header tanpa migrasi.

## Hasil pengujian dan batasan

Sintaks, simulasi backend, sesi Node, generator cetak lulus. Fixture format SIPD terbaru, unit lain, rekening nonperjalanan, beberapa blok baris PBJ, tahun yang berbeda, saldo awal, terbit, pembatalan dan perubahan pagu diuji. Uji browser tidak selesai dalam batas waktu; belum dinyatakan lulus. Belum ada uji deployment produksi, beban serentak, keamanan independen, atau hasil printer. Spreadsheet dan portal produksi tidak diubah. Belum ada integrasi pencairan SIPD, validasi semua komponen SBU, atau otomatisasi Surat Tugas; lampiran surat perintah dapat menyusul.

### Riwayat (3 versi terakhir)
- v1.2.1 — Format SIPD terbaru, pencarian baris unit PBJ, tahun sumber eksplisit.
- v1.2.0 — Fokus internal PBJ, monitoring pagu, saldo awal, pejabat manual, surat opsional, pipeline ringkas, sidebar hide/show.
- v1.1.3 — Dropdown dan direktori akun; role Bendahara induk tidak dipasang.
