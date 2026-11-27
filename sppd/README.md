# ORBITA – Perjalanan Dinas | v1.3.2

Modul internal Bagian Pengadaan Barang dan Jasa Kota Bogor. Tidak mengubah portal, permohonan pemilihan, atau Permohonan SiRUP. Role Bendahara ORBITA induk belum digunakan. Menu SPPD tetap tidak ditampilkan di Akses Cepat.

## Update v1.3.2 dari v1.3.1

Timpa folder `sppd` menggunakan ZIP GITHUB_READY. Tidak perlu deploy Apps Script, setup database, atau impor ulang SBU. Tekan Ctrl+F5 setelah GitHub Pages selesai.

Rincian biaya mengikuti tiga kelompok pada Excel: (1) Uang Harian otomatis berdasarkan SBU; (2) Transportasi, dengan isian awal Bensin, Tol dan parkir, Sewa kendaraan, Tiket pesawat; (3) Penginapan. Rincian transportasi darat bisa ditambah, diubah namanya atau dihapus. Tiket dan penginapan dapat dihapus serta ditambahkan kembali; nama baku dipertahankan untuk validasi server. Semua nominal dan keterangan tetap dapat diisi. Plafon transportasi darat bersama satu kendaraan, tiket per orang/PP, dan validasi pagu tidak diubah. Penginapan belum memiliki plafon otomatis. Data biaya lama ditampilkan berdasarkan kategori tersimpan, tidak ditambah atau ditimpa saat membuka revisi.

Hasil cetak rincian biaya menggunakan kolom No., Perincian Biaya, Jumlah, Keterangan, dengan transportasi sebagai kelompok nomor 2 dan penginapan nomor 3. Kuitansi, perhitungan rampung, SPD depan-belakang, logo, margin A4 dan usulan nama PDF dari v1.3.1 tetap dipertahankan. Tata letak rincian merupakan rekonstruksi HTML; rincian sangat panjang dapat memerlukan halaman tambahan.

## Pemasangan awal (bukan update v1.3.2)

1. Backup spreadsheet SPPD ONLINE dan kode Apps Script SPPD. Untuk uji awal, gunakan salinan spreadsheet dan deployment terpisah bila memungkinkan.
2. Buka Apps Script milik SPPD ONLINE, bukan Apps Script ORBITA induk. Ganti `Code.gs` dengan `backend/Code.gs`. Manifest tetap sama; file cadangan tersedia di `backend/appsscript.json`.
3. Jika sebelumnya belum menjalankan `setupSPPD` pada v1.2.1, jalankan sekali dari editor. Untuk update v1.2.9 ke v1.3.0 tidak perlu setup ulang. Pengaturan PPTK per subkegiatan disimpan di JSON M_OPD yang sudah tersedia, tanpa perubahan header. Fungsi ini menambahkan tab `M_PAGU_AWAL` yang baru, mempertahankan header dan data tab yang sudah ada, serta tidak menyentuh `KODE_REK`. Bila ada header lama tidak sesuai, fungsi berhenti dan tidak menimpa data. Tidak perlu menjalankan `grantFirstAdmin` ulang jika akun admin sudah aktif.
4. Deploy > Manage deployments > Edit > New version > Deploy. Pertahankan deployment yang sama dan URL Exec yang sudah terpasang di `assets/config.js`.
5. Ekstrak ZIP GITHUB_READY. Upload folder `sppd` ke root repository ORBITA dan timpa file modul lama saja. Jangan unggah folder backend atau tests ke GitHub Pages.
6. Setelah GitHub Pages selesai, buka ORBITA, login dengan akun yang sudah diberi izin SPPD, lalu buka `https://pbjkotabogor.github.io/ORBITA/sppd/` di tab yang sama. Tekan Ctrl+F5.

## Sumber pagu

Sheet `KODE_REK` pada SPPD ONLINE (gid 1391601852) dibaca tanpa diubah. Format terbaru SIPD menggunakan `Kode Unit`, `Unit`, `Kode Sub Kegiatan`, `Sub Kegiatan`, `Kode Sumber Dana`, `Sumber Dana`, `Kode Akun`, `Akun`, dan `Jumlah (Rp)`. Kode unit Bagian PBJ adalah `4.01.7.01.2.13.23.0009`; hanya rekening dengan awalan `5.1.02.04.` yang digunakan. Header dikenali berdasarkan nama, tidak bergantung urutan kolom. Format lama yang memiliki kolom tahun juga diterima jika memuat kode unit yang sama.

Karena ekspor terbaru tidak memiliki kolom tahun, sumber tersebut dipatok ke tahun anggaran 2026 melalui konstanta `KODE_REK_YEAR`. Jangan mengganti sumber dengan data tahun berbeda tanpa menyesuaikan konfigurasi serta mengarsipkan sumber tahun lama. Pagu di tahun lain tidak dipalsukan. Kunci transaksi tetap tahun|subkegiatan|rekening|sumber dana. Paket dan kelompok dalam satu kombinasi dijumlahkan; saldo awal tidak digandakan. Sistem hanya membaca detail baris unit PBJ (pencarian satu kolom dengan TextFinder), bukan semua kolom data seluruh OPD pada setiap sinkronisasi.

Hasil baca sumber 25 November 2026: Pengelolaan PBJ Rp288.944.000; Layanan Pengadaan Secara Elektronik Rp19.974.000; Pembinaan dan Advokasi PBJ Rp8.620.000. Total Rp317.538.000. Nilai tidak ditanam di kode dan bisa berubah saat sumber diperbarui.

## Persiapan admin

- **Monitoring pagu:** konfirmasi pemakaian sebelum aplikasi untuk setiap rekening/subkegiatan, termasuk nol bila memang tidak ada. Jangan masukkan SPD yang sudah tercatat di aplikasi ke pemakaian awal lagi. Pagu adalah anggaran tahunan, bukan otomatis saldo kas atau pencairan SIPD.
- **Pegawai & pejabat:** alamat kop terisi dari Excel SPPD 251126.xlsx: Jl. Ir.H.Juanda No.10 Telp. (0251)8321075 Fax. 8326530. Alamat yang sudah tersimpan tetap dipertahankan. Klik **Ambil pegawai dari sheet** untuk menyalin pegawai PBJ dari tab `Pegawai` (gid 1903804205). Kolom `NIP`, `Nama Pegawai`, `Pangkat/Gol`, `Jabatan`, `Unit Kerja` dikenali berdasarkan nama header. Filter unit `Bagian Pengadaan Barang dan Jasa Setda Kota Bogor`. Sumber dibaca hanya saat admin meminta impor; data manual yang sudah ada tidak ditimpa, NIP ganda dilewati, dan NIP yang tidak utuh dilaporkan. Tingkat biaya perjalanan tidak lagi menjadi isian master. Nilai lama dipertahankan jika ada; kolom pada format cetak SPD asli tetap tersedia dan kosong bila tidak memiliki data. Data pegawai tidak disimpan di GitHub.
- **PPTK:** tetapkan nama dan NIP untuk masing-masing subkegiatan dari KODE_REK. Dapat memilih master pegawai atau mengetik manual. Nama PPTK lama dipertahankan sebagai referensi, tetapi tidak otomatis diterapkan pada subkegiatan. KPA dan Bendahara tetap identitas penandatangan manual. Saat SPD terbit, identitas dan PPTK subkegiatan disalin ke transaksi sehingga dokumen lama tidak berubah. Draft boleh disimpan sebelum pejabat lengkap; SPD baru hanya memerlukan PA/KPA beserta NIP saat terbit. PPTK dan Bendahara sesuai subkegiatan dilengkapi ketika mencatat biaya dan membuat kuitansi.
- **Standar biaya (SBU):** Isi tahun, tanggal berlaku dan dasar hukum resmi, klik **Impor lampiran SBU**, tunggu konfirmasi jumlah item. Pilih versi tersimpan dan klik **Aktifkan tarif terpilih** setelah diperiksa. Tombol aktivasi tidak tersedia jika belum ada versi. Tarif aktif tidak ditimpa; jangan mengaktifkan tarif sebelum memastikan dasar hukum, tahun, tanggal dan nominal. Versi dipilih berdasarkan tahun dan tanggal berlaku. Nama tampilan dapat diubah oleh admin melalui Ubah nama versi tanpa mengganti dasar hukum; nama disimpan pada Script Properties (SPPD_SBU_NAME_<tahun>_<tanggal>) dan perubahan dicatat di AUDIT_LOG. Hapus versi tarif menghapus seluruh item pada versi terpilih setelah konfirmasi, hanya jika belum dipakai dalam SPD maupun draft. Versi lain dan data transaksi tidak diubah. Daftar hanya memuat satu versi terpilih sekaligus. Tanggal berlaku bukan tanggal berakhir; tarif 31 Desember 2026 tidak berlaku untuk perjalanan yang dimulai sebelum tanggal tersebut. Uang harian luar daerah/diklat sesuai provinsi dihitung otomatis. Biaya lain diisi dengan keterangan dan perlu diperiksa manual.
- **Register SPD:** gunakan nomor manual sesuai Sprint. Pengaturan otomatis tidak lagi digunakan. Nomor lama dan nomor yang dibatalkan tetap tersimpan dalam register.
- **Hak akses:** gunakan akun ORBITA yang sudah ada. Admin memberi izin SPPD secara terpisah melalui `M_AKSES`/menu Hak akses; lingkup PBJ (`PBJ`), superadmin `*`. Role `OPERATOR`, `ADMIN_OPD`, `ADMIN_SHS`, `SUPERADMIN`. Tidak ada akses otomatis untuk seluruh OPD dan tidak perlu patch role Bendahara. Daftar akun ORBITA hanya diakses admin yang berwenang saat membuka menu Hak akses; identitas penandatangan tidak terkait akun.

## Alur kerja

Buat SPPD → pilih rekening dan peserta → simpan draft → terbitkan SPD → cetak SPD depan/belakang → buka detail SPD dari riwayat → Buat kuitansi & rincian biaya → pilih provinsi dan jenis perjalanan, isi biaya → simpan → cetak kuitansi dan rincian → lengkapi berkas → selesai. SBU tidak wajib pada pembuatan SPD baru. Draft lama yang sudah memiliki biaya dipertahankan; pengubahan biaya dilakukan dari detail setelah penerbitan. Surat perintah PDF maksimal 4 MB boleh diunggah saat menyimpan draft atau menyusul melalui detail. Jika upload gagal, draft tetap tersimpan dan dapat dilengkapi kembali.

- Dokumen: SPD depan/belakang, kuitansi Model U.XV, rincian biaya, perhitungan rampung. Gunakan dialog cetak browser untuk cetak/simpan PDF; tanda tangan basah dan cap diselesaikan di luar aplikasi. Format hasil rekonstruksi Excel perlu diperiksa dengan contoh resmi sebelum penggunaan. Tidak ada tanda tangan otomatis.
- Draft dan SPD baru tanpa biaya belum mengurangi pagu. Monitoring menunjukkan jumlah SPD terbit yang belum dicatat biayanya. Sisa yang ditampilkan hanya mencakup pemakaian awal dan biaya yang sudah tercatat, bukan jaminan dana tersedia bagi seluruh SPD. Saat biaya disimpan pertama kali atau disesuaikan, saldo diperiksa server di bawah LockService; pencatatan biaya ditahan jika saldo tidak cukup, pemakaian awal belum dikonfirmasi, atau ada SPD lama yang belum terhubung ke rekening. Pembatalan oleh admin memulihkan alokasi tanpa menghapus nomor/riwayat. SPD versi lama tetap menggunakan alur dan nilai biaya yang tersimpan. Perubahan biaya riil dicatat dengan alasan. Kuitansi dan rincian tidak bisa dicetak sebelum nomor terbit dan biaya dicatat.
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

Uji sintaks JS/GS, backend simulasi Node, sesi Node, generator cetak, dan browser Chromium dengan data simulasi lulus. Uji baru mencakup SPD tanpa SBU/biaya/PPTK/Bendahara, penomoran, pemisahan kuitansi, pencatatan biaya, perlindungan pagu, snapshot KPA, dan formulir tanpa kolom biaya. Uji browser sesi yang menavigasi alamat portal tidak dapat dijalankan karena kebijakan browser lingkungan pengujian (ERR_BLOCKED_BY_ADMINISTRATOR). Tidak ada pengujian deployment atau penulisan pada spreadsheet produksi. Format cetak tetap perlu dibandingkan dengan template resmi sebelum digunakan.

## Koreksi tanggal SBU dan uang harian

Pilih versi SBU di menu Standar biaya, isi tanggal mulai berlaku yang benar menurut dokumen resmi, lalu klik Koreksi tanggal berlaku. Versi yang telah dipakai tidak dapat digeser tanggalnya. Tidak perlu impor ulang; nama versi, dasar hukum, status aktif dan tarif dipertahankan. Jangan memundurkan tanggal hanya agar tarif muncul. Jika tanggal resmi memang setelah tanggal perjalanan, gunakan versi yang sah untuk tanggal perjalanan tersebut.

Pada pembuatan kuitansi, pilih provinsi, kota/kabupaten, dan jenis perjalanan. Tarif baru dihitung ketika pilihan lengkap. Jakarta berada pada kelompok tarif DKI Jakarta, bukan Jawa Barat. Daftar kota/kabupaten tersedia untuk DKI Jakarta, Jawa Barat, Banten, Jawa Tengah, Jawa Timur, DI Yogyakarta dan Bali; provinsi lain dapat mengisi nama kota/kabupaten sesuai SPD secara manual. Nama kota tidak mengubah tarif provinsi dan tidak mengubah tujuan pada SPD terbit. Server menolak provinsi yang bertentangan dengan kota tujuan yang dikenal. Nama kota tambahan disimpan pada JSON transaksi sebagai costCity, tanpa perubahan header. Uang harian dihitung oleh server (tarif × hari × peserta, per pegawai), bukan dari nominal kiriman browser. Tarif yang belum berlaku ditampilkan beserta tanggal mulai berlakunya, dan biaya belum dapat disimpan. Batas kendaraan dan tiket pesawat mengikuti ketentuan pada bagian di bawah. Penginapan tetap mengikuti mekanisme sebelumnya; rincian tambahan transportasi memakai batas kendaraan.

Riwayat proses menampilkan tanggal dan jam WIB (Asia/Jakarta) serta nama akun tanpa ID internal. Audit asli tetap utuh. Detail yang telah dibuka disimpan sementara di memori tab (maksimal 40), dibatalkan jika versi atau status berubah saat sinkronisasi, dihapus ketika sesi atau OPD berubah, dan dimuat ulang setelah penyimpanan. Pembukaan pertama tetap meminta data server. Backend membaca baris detail, audit, dan lampiran berdasarkan ID yang cocok. Tidak ada penyimpanan data pribadi di localStorage.

Uji v1.2.7: sintaks, backend, cetak, sesi Node dan browser kuitansi dengan data simulasi lulus. Tidak ada perubahan spreadsheet produksi atau ORBITA induk. Kecepatan deployment aktual belum diukur.

## Paging, nomor dan dialog

Daftar tarif dan master pegawai memiliki pilihan 10, 20, 50, 100 baris; riwayat perjalanan 10, 20, 50. Pencarian dan filter diterapkan pada semua data yang telah dimuat, lalu ditampilkan per halaman. Tidak ada request API untuk mengganti halaman atau jumlah baris.

Nomor SPD diisi manual sesuai Surat Perintah (Sprint). Pengaturan dan tombol pengambilan nomor otomatis tidak lagi ditampilkan; API penerbitan otomatis juga dinonaktifkan. Nomor lama tetap dicatat sesuai cara penerbitan aslinya. Draft otomatis lama perlu dibuka, diisi nomor manual, dan disimpan sebelum diterbitkan. Nomor Sprint yang sama boleh digunakan beberapa peserta pada satu perjalanan; nomor yang sudah tercatat pada perjalanan lain di tahun yang sama tidak boleh dipakai kembali. Register tetap mencatat satu baris per peserta. Tidak ada perubahan header spreadsheet.

Dialog konfirmasi dan input dalam aplikasi memakai komponen dialog ORBITA. Dialog sistem browser seperti pemilihan file dan cetak tetap menggunakan antarmuka browser. Register SPD dan unduhan CSV menampilkan tanggal dan jam WIB, misalnya 25 November 2026, 15:28; timestamp asli tetap tersimpan.

Uji v1.2.8: sintaks, backend simulasi, cetak, sesi Node, browser master, browser biaya, dan browser paging dengan 2.129 tarif serta 125 baris riwayat dan pegawai lulus. Deployment produksi, cetak fisik dan latensi jaringan belum diuji.

## Uang transport, rincian fleksibel dan uang harian

- Uang harian dihitung otomatis dari SBU yang aktif dan berlaku pada tanggal perjalanan, per orang per hari. Nilainya tidak dikurangi bensin atau tol. Input uang muka dihapus dari formulir kuitansi baru; uang muka riil yang sudah tercatat pada transaksi lama tetap dipertahankan saat revisi. Format rampung tidak diubah.
- Batas kendaraan diambil dari item `Biaya Transportasi dari Kota Bogor dengan kendaraan ke …` dengan satuan Kendaraan dan spesifikasi tujuan (kota/kabupaten, atau kelompok DKI Jakarta/Banten sesuai sumber). Semua rincian dengan jenis Transportasi darat menggunakan satu batas gabungan untuk seluruh peserta, diasumsikan satu kendaraan. Nama rincian bebas, dapat ditambah, diubah, atau dihapus. Saldo transport berkurang sesuai biaya tercatat dan kembali bertambah saat rincian dihapus. Penginapan dan tiket pesawat merupakan kategori terpisah. Nama kedua kategori khusus tersebut mengikuti nama jenis biaya untuk menghindari pengelompokan yang keliru. Tidak dikalikan hari atau jumlah orang. Biaya riil yang dicatat, bukan seluruh plafon yang otomatis dibayarkan. Jika tidak ada referensi yang cocok, biaya kendaraan positif tidak dapat disimpan. Penggunaan lebih dari satu kendaraan belum didukung dalam versi ini.
- Tiket pesawat menggunakan referensi terpisah `Satuan Biaya Tiket Pesawat Perjalanan Dinas Dalam Negeri PP`, dengan satuan Orang / PP. Pilih rute dan kelas sesuai perjalanan aktual. Satu referensi digunakan untuk satu rombongan; setiap tiket diuji terhadap batas per orang/PP, bukan plafon kendaraan. Verifikasi kecocokan bandara/rute dan kelayakan kelas tetap dilakukan pengelola. Penginapan belum diberi batas otomatis pada pembaruan ini. Rincian tambahan biasa masuk plafon transportasi darat.
- Total kuitansi = uang harian + biaya riil yang dicatat. Subtotal yang melebihi batas berubah merah; tombol simpan dinonaktifkan. Server memeriksa ulang tarif, jumlah gabungan, dan pagu. Nominal transportasi dan referensi disimpan pada JSON transaksi; tidak ada perubahan header atau reset sheet. Tarif yang telah disimpan menjadi snapshot. Dokumen lama tidak dihitung ulang otomatis.
- Isian rupiah (biaya, tarif SBU, pemakaian awal) menggunakan pemisah ribuan titik; nilai yang dikirim ke server tetap angka rupiah bulat. NIP, nomor SPD, tahun dan kode rekening tidak diformat sebagai uang. Dropdown dan perhitungan menggunakan data awal, tanpa request tambahan ketika mengetik atau memilih tujuan.

Contoh dari lampiran: Jakarta Rp530.000/orang/hari dan Rp370.000/kendaraan; Kabupaten Bogor Rp195.000/kendaraan. Penetapan perlakuan biaya dan tanggal berlaku mengikuti dokumen resmi SBU dan ketentuan internal.

Uji v1.3.0: sintaks JS/GS, backend simulasi, cetak, sesi Node, browser master, browser biaya dan paging lulus. Uji baru mencakup tambah/hapus/ubah rincian dengan nama bebas, plafon gabungan, saldo transport, uang harian terpisah, penolakan biaya berlebih dan salah kategori pada server, serta nomor Sprint manual. Deployment produksi, latensi jaringan dan cetak fisik belum diuji.

### Riwayat (3 versi terakhir)
- v1.3.2 — Tiga kelompok biaya sesuai Excel, isian standar dan rincian tambahan, pengelompokan tabel cetak.
- v1.3.1 — Kop SPD dari Excel, A4 dan margin sesuai template, penamaan PDF otomatis, cetak depan-belakang.
- v1.3.0 — Saldo uang transport di atas rincian, uang harian di bawah, rincian fleksibel, nomor SPD manual sesuai Sprint.
