# PRD — Sistem Absensi PT Zaman Teknindo

**Tanggal dokumen:** 28 September 2026  
**Produk:** Sistem Absensi PT Zaman Teknindo  
**Repository:** `muhammadsuryahar-bot/ZamanTeknindo`  
**Dokumen ini berfungsi sebagai backup spesifikasi produk, aturan bisnis, perubahan besar, dan kontrak data agar pengembangan berikutnya tetap konsisten.**

---

## 1. Tujuan Produk

Sistem ini digunakan untuk mengelola proses absensi karyawan PT Zaman Teknindo secara terpusat, mulai dari login, presensi masuk/pulang, bukti foto dan lokasi, pengajuan izin, verifikasi Admin, pengelolaan karyawan, pengaturan jam masuk, penggajian, notifikasi, hingga rekap dan export Excel.

Prioritas utama produk:

1. Data absensi harus akurat dan dapat ditelusuri.
2. Satu karyawan tidak boleh mempunyai dua record absensi pada tanggal yang sama.
3. Rekap bulanan harus dapat direproduksi dari data sistem.
4. Export Excel harus mengikuti kebutuhan format perusahaan.
5. Perubahan pada satu modul tidak boleh merusak modul lain.
6. Sistem harus tetap nyaman digunakan pada komputer kantor dan perangkat mobile.

---

## 2. Arsitektur Sistem

### Frontend
- React + Vite.
- Deployment production menggunakan Vercel.
- Routing menggunakan React Router.
- Admin menggunakan dashboard terpusat.
- Karyawan memiliki dashboard dan riwayat sendiri.

### Backend
- Node.js + Express.
- Prisma ORM.
- Database PostgreSQL pada Supabase.
- Endpoint backend dipisahkan berdasarkan fungsi auth, absensi, Admin, izin, payroll, export, kiosk, dan notifikasi.

### Database
- PostgreSQL/Supabase.
- Prisma schema menjadi sumber struktur data aplikasi.
- Model penting: Pengguna, Absensi, PengajuanIzin, GajiKaryawan, LaporanGaji, HariLibur, Kantor, UserFace, ManualAbsenRequest, ArsipBulanan, PushSubscription.

---

## 3. Role Pengguna

### Admin
Admin dapat:
- melihat rekap absensi;
- memilih tanggal rekap;
- melihat karyawan yang belum absen;
- mengubah status absensi secara manual dengan catatan;
- mengelola akun/karyawan;
- mengelola izin;
- mengelola wajah untuk kiosk;
- melakukan verifikasi manual;
- mengatur jam masuk dan potongan;
- menghitung/menyimpan gaji;
- melihat arsip;
- export rekap Excel.

### Karyawan
Karyawan dapat:
- login;
- melakukan absensi masuk;
- melakukan absensi pulang;
- mengirim foto dan lokasi;
- melihat riwayat;
- mengajukan izin/sakit/cuti/urgent;
- mendaftarkan wajah sesuai alur sistem;
- mengganti password.

---

## 4. Aturan Data Absensi

### 4.1 Satu absensi per karyawan per tanggal

Database menggunakan constraint:

`UNIQUE(penggunaId, tanggal)`

Artinya satu karyawan tidak boleh memiliki dua record `Absensi` pada tanggal yang sama.

Ini adalah aturan penting yang tidak boleh dihapus.

### 4.2 Status absensi

Status yang digunakan:

- `tepat_waktu`
- `telat`
- `alpha`
- `izin`
- `sakit`
- `cuti`
- `urgent`

### 4.3 Status efektif

Jika status final sudah ditentukan Admin, status final menjadi referensi utama. Jika belum ada, sistem menggunakan status otomatis atau menghitung berdasarkan jam masuk dan jam standar.

---

## 5. Pengaturan Jam Masuk

Jam masuk standar disimpan di `PengaturanPotongan.jamMasukStandar`.

Perubahan jam standar dari halaman Admin harus digunakan oleh logika keterlambatan yang membaca setting tersebut.

Contoh:
- jam standar 08:10;
- masuk 08:10 = tidak telat;
- masuk setelah 08:10 = telat.

Logika ini harus dipusatkan pada utility waktu yang digunakan backend.

---

## 6. Pengajuan Izin

Jenis pengajuan:

- izin;
- sakit;
- cuti;
- urgent.

Pengajuan memiliki status:

- menunggu;
- disetujui;
- ditolak.

Pengajuan yang sudah disetujui digunakan oleh proses rekap sebagai data pendukung.

### Prioritas klasifikasi pada export

1. Kehadiran dengan cap masuk/pulang.
2. Cuti.
3. Sakit.
4. Tidak masuk dengan keterangan.
5. Tidak masuk tanpa keterangan.

Tujuannya agar satu tanggal untuk satu karyawan tidak dihitung pada lebih dari satu kategori.

---

## 7. Rekap Hari Ini

Halaman **Rekap Hari Ini** adalah pusat rekap berdasarkan satu tanggal operasional.

Fungsi:
- memilih tanggal;
- menampilkan tanggal pilihan;
- melihat data absensi;
- melihat karyawan yang belum absen;
- mengatur status manual;
- membuka export rekap periode.

### Tampilan tanggal

Hasil tanggal yang dipilih harus ditampilkan dalam format panjang Indonesia:

**26 September 2026**

Perubahan format ini hanya berlaku pada area **Rekap Hari Ini**, bukan global untuk halaman lain.

Native date picker tetap menggunakan kontrol tanggal browser.

---

## 8. Periode Rekap Bulanan

Periode rekap perusahaan menggunakan pola **26 sampai 25**.

Contoh:
- periode: 26 Agustus 2026 — 25 September 2026;
- periode berikutnya: 26 September 2026 — 25 Oktober 2026.

Satu file export dibatasi maksimal 31 hari.

### Prinsip penting

Export bulan berjalan hanya mengambil data dalam:

`tanggalMulai <= tanggal <= tanggalSelesai`

Data dari periode sebelum atau setelah periode tersebut tidak boleh tercampur.

---

## 9. Export Excel — Format Perusahaan

Export mengikuti struktur template Excel yang digunakan perusahaan.

Urutan kolom final:

| Kolom | Isi |
|---|---|
| NO | Nomor urut karyawan |
| NAMA | Nama karyawan |
| TMK | Disiapkan mengikuti template |
| kolom spacer | Disiapkan mengikuti template |
| JUMLAH HAK CUTI | Disiapkan mengikuti template |
| HC 2024/2025 | Disiapkan mengikuti template |
| HC 2025/2026 | Disiapkan mengikuti template |
| JLH HC SDH DIJALANI/DIPINJAM | **Kosong** |
| JLH KEHADIRAN | Jumlah hari dengan cap masuk/pulang |
| TERLAMBAT | Jumlah hari terlambat |
| JLH UANG MAKAN YANG DIBAYARKAN | Kehadiran dikurangi terlambat |
| TIDAK MASUK — ADA KET | Tidak masuk dengan keterangan |
| TIDAK MASUK — TANPA KET | Tidak masuk tanpa keterangan |
| LEMBUR | **Kosong** |
| CUTI | Jumlah hari cuti |
| SAKIT — ADA SRT | Jumlah sakit dengan surat |
| SAKIT — TANPA SRT | Jumlah sakit tanpa surat |
| JLH HC | Hasil perhitungan kategori kehadiran |

### 9.1 JLH UANG MAKAN

Rumus:

`JLH UANG MAKAN = max(JLH KEHADIRAN - TERLAMBAT, 0)`

TERLAMBAT tidak dijumlahkan kembali ke kehadiran karena TERLAMBAT merupakan subset dari kehadiran.

### 9.2 JLH HC

Rumus yang menjadi kontrak export:

`JLH HC = JLH KEHADIRAN + TIDAK MASUK ADA KET + TIDAK MASUK TANPA KET + CUTI + SAKIT ADA SRT + SAKIT TANPA SRT`

TERLAMBAT tidak dijumlahkan lagi karena sudah termasuk JLH KEHADIRAN.

JLH UANG MAKAN tidak dijumlahkan karena merupakan nilai turunan.

LEMBUR tidak dijumlahkan karena kolom tersebut sengaja dikosongkan.

### 9.3 Kolom histori hak cuti

Kolom histori hak cuti belum memiliki sumber data valid dari database absensi saat ini.

Karena itu sistem tidak boleh mengarang nilai.

Kolom:
- TMK;
- HC 2024/2025;
- HC 2025/2026;
- JLH HC SDH DIJALANI/DIPINJAM

diperlakukan sebagai area template/reserved field sampai sumber data resmi tersedia.

Kolom **JLH HC SDH DIJALANI/DIPINJAM** wajib kosong sesuai permintaan perusahaan.

---

## 10. Seluruh Karyawan dalam Rekap

Export bulanan harus menampilkan seluruh akun dengan role:

`karyawan`

Karyawan tetap ditampilkan walaupun:
- tidak mempunyai absensi pada periode;
- tidak mempunyai pengajuan;
- status akun berubah menjadi nonaktif.

Untuk karyawan tanpa data pada periode tersebut, angka rekap menjadi 0 sesuai kategori yang relevan.

Tujuan aturan ini adalah agar daftar karyawan tidak berubah-ubah hanya karena ada/tidaknya transaksi pada periode tertentu.

---

## 11. Pencegahan Duplikasi

Ada beberapa lapisan perlindungan:

### Database
`Absensi` memiliki unique key:

`penggunaId + tanggal`

### Backend export
Daftar karyawan dideduplikasi berdasarkan ID.

### Peta absensi
Data absensi direferensikan menggunakan:

`penggunaId + tanggal`

### Peta izin
Data pengajuan direferensikan menggunakan:

`penggunaId + tanggal`

### Klasifikasi harian
Cuti dan sakit menggunakan Set tanggal agar satu tanggal tidak dihitung dua kali.

Aturan ini wajib dipertahankan.

---

## 12. Hari Kerja dan Hari Libur

Untuk rekap:
- Sabtu tidak dianggap hari kerja.
- Minggu tidak dianggap hari kerja.
- Hari libur yang terdaftar pada sistem tidak dianggap hari kerja.

Hari non-kerja tidak boleh otomatis menjadi Alpha hanya karena tidak ada absensi.

---

## 13. Foto dan Lokasi

Absensi dapat menyimpan:
- foto masuk;
- foto pulang;
- latitude;
- longitude;
- alamat masuk;
- alamat pulang.

Foto dapat disimpan melalui Supabase Storage.

Lokasi digunakan sebagai informasi pendukung absensi dan dapat dibuka melalui Google Maps pada area Admin jika tersedia.

---

## 14. Face/Kiosk

Sistem memiliki fitur:
- registrasi wajah;
- penyimpanan descriptor wajah;
- pengelolaan wajah oleh Admin;
- kiosk;
- fallback manual verification.

Data wajah tersimpan dalam model `UserFace`.

Jangan mengubah format descriptor tanpa migrasi dan pengujian kompatibilitas.

---

## 15. Manual Verification

Sistem memiliki `ManualAbsenRequest` untuk kasus ketika proses kiosk/absensi memerlukan verifikasi manual.

Status:
- PENDING;
- APPROVED;
- REJECTED.

Request mencatat waktu permintaan, tipe masuk/pulang, bukti, alasan, dan informasi verifikasi.

---

## 16. Notifikasi

Admin mempunyai notifikasi untuk:
- akun baru;
- pengajuan izin;
- manual verification yang masih pending.

Notifikasi merupakan informasi operasional dan tidak boleh menjadi penyebab dashboard utama gagal tampil.

---

## 17. Payroll

Modul gaji tetap menggunakan konteks:
- bulan;
- tahun;
- pengaturan jam;
- potongan;
- data kehadiran.

Rekap periode tanggal tidak dipindahkan ke modul Gaji.

### Prinsip

**Rekap Hari Ini / Export Rekap = statistik kehadiran berdasarkan periode tanggal.**

**Gaji = perhitungan payroll berdasarkan bulan/tahun.**

Kedua konsep tidak boleh dicampur.

---

## 18. Arsip

Model `ArsipBulanan` disediakan untuk proses arsip periode.

Arsip tidak boleh mengubah histori rekap yang sudah diverifikasi tanpa proses yang disengaja dan tercatat.

---

## 19. Perubahan Besar yang Sudah Diterapkan

### Rekap periode
- dukungan periode tanggal;
- preset periode perusahaan 26–25;
- validasi tanggal masa depan;
- batas satu bulan per export.

### Export Excel
- struktur disesuaikan dengan template perusahaan;
- pencegahan duplicate employee;
- perbaikan pointer baris Excel;
- pencegahan circular reference;
- JLH UANG MAKAN berbasis kehadiran - terlambat;
- klasifikasi ADA KET/TANPA KET;
- pemisahan CUTI;
- pemisahan SAKIT ADA SRT/TANPA SRT;
- JLH HC berbasis jumlah kategori rekap;
- LEMBUR dikosongkan;
- kolom JLH HC SDH DIJALANI/DIPINJAM dikosongkan.

### Rekap Hari Ini
- date picker tetap sebagai input tanggal;
- hasil tanggal pilihan menggunakan format panjang Indonesia.

### Backend
- validasi DateTime diperbaiki;
- filter tanggal ringkasan menggunakan DateTime ISO;
- data karyawan historis tetap dapat direkap.

---

## 20. Kontrak yang Tidak Boleh Rusak

Pengembangan berikutnya wajib menjaga:

1. Unique absensi per karyawan per tanggal.
2. Periode export tidak boleh bercampur.
3. Satu karyawan satu baris pada export.
4. Satu hari satu klasifikasi utama.
5. TERLAMBAT tidak dihitung dua kali.
6. JLH UANG MAKAN tidak dihitung dua kali.
7. LEMBUR tetap kosong sampai ada sumber data resmi.
8. JLH HC mengikuti rumus yang ditetapkan dokumen ini.
9. Semua karyawan role karyawan masuk daftar export.
10. Jangan mengambil data periode lain untuk mengisi periode berjalan.

---

## 21. Checklist Pengujian Export

Sebelum setiap release export, lakukan:

- [ ] Periode 26–25 menghasilkan tanggal mulai/selesai yang benar.
- [ ] Periode lebih dari 31 hari ditolak.
- [ ] Tanggal masa depan ditolak.
- [ ] Semua karyawan role karyawan muncul satu kali.
- [ ] Tidak ada nama yang muncul dua kali karena duplicate ID.
- [ ] Absensi satu tanggal tidak dihitung dua kali.
- [ ] JLH UANG MAKAN = KEHADIRAN - TERLAMBAT.
- [ ] ADA KET dan TANPA KET tidak overlap.
- [ ] CUTI tidak masuk ADA KET/TANPA KET.
- [ ] SAKIT tidak masuk ADA KET/TANPA KET.
- [ ] LEMBUR kosong.
- [ ] JLH HC sesuai rumus.
- [ ] JLH HC SDH DIJALANI/DIPINJAM kosong.
- [ ] TOTAL sama dengan penjumlahan seluruh baris karyawan.
- [ ] Tidak ada circular reference.
- [ ] File dapat dibuka Excel tanpa repair warning.

---

## 22. Proses Backup Pengembangan

Setiap perubahan besar sebaiknya:

1. Dikerjakan dalam perubahan kecil yang jelas.
2. Diverifikasi di source.
3. Dilakukan syntax/build check.
4. Dilakukan pengecekan runtime setelah deployment.
5. Dicatat di commit Git.
6. Diperbarui pada PRD bila aturan bisnis berubah.

Jangan menghapus commit lama yang sudah menjadi referensi troubleshooting tanpa alasan yang jelas.

---

## 23. Release Reference — 28 September 2026

Perubahan export/periode terbaru harus mempertahankan:
- periode maksimal 31 hari;
- seluruh karyawan role karyawan;
- deduplikasi berdasarkan ID;
- formula JLH HC;
- format Excel mengikuti template perusahaan;
- date picker Rekap Hari Ini dengan tampilan tanggal panjang Indonesia.

Dokumen ini menjadi baseline produk untuk pengembangan berikutnya.
