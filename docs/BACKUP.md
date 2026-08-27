# Backup & Restore Database

Supabase paket **Free** tidak menyediakan automatic backup (paket **Pro** memberi retensi 7 hari otomatis). Selama masih di paket Free, backup harus dilakukan manual/terjadwal sendiri. Dokumen ini prosedurnya.

## 1. Backup manual (kapan saja)

Butuh [PostgreSQL client tools](https://www.postgresql.org/download/) ter-install (`pg_dump`), atau pakai Supabase CLI. Gunakan `DIRECT_URL` (port 5432), **bukan** `DATABASE_URL` (port 6543/pgbouncer) — `pg_dump` tidak kompatibel dengan connection pooler.

```bash
# Ganti dengan nilai DIRECT_URL kamu (dari backend/.env)
pg_dump "postgresql://postgres.xxxx:PASSWORD@aws-0-xxxx.pooler.supabase.com:5432/postgres" \
  --format=custom \
  --file="backup_$(date +%Y%m%d_%H%M%S).dump"
```

Di Windows PowerShell:
```powershell
$tanggal = Get-Date -Format "yyyyMMdd_HHmmss"
pg_dump "postgresql://postgres.xxxx:PASSWORD@aws-0-xxxx.pooler.supabase.com:5432/postgres" --format=custom --file="backup_$tanggal.dump"
```

Simpan file `.dump` itu di tempat aman **di luar** komputer kamu satu-satunya — Google Drive, atau storage terpisah. **Jangan** commit file backup ke Git (isinya data karyawan asli).

## 2. Jadwal otomatis (rekomendasi)

Pilih salah satu:

- **Task Scheduler (Windows)** — jadwalkan script di atas jalan tiap malam, simpan hasilnya ke folder yang di-sync ke cloud (Google Drive Desktop, OneDrive, dll).
- **GitHub Actions** (kalau repo private) — cron job harian yang jalanin `pg_dump` lalu upload hasil ke storage terpisah (jangan simpan di repo itu sendiri). Perlu simpan `DIRECT_URL` sebagai GitHub Secret, bukan hardcode.
- **Upgrade ke Supabase Pro** — paling simpel, backup otomatis + retensi 7 hari tanpa maintenance manual. Worth dipertimbangkan begitu aplikasi benar-benar dipakai harian oleh karyawan.

## 3. Restore (WAJIB pernah dites minimal sekali)

Backup yang belum pernah dicoba restore-nya **tidak bisa dianggap backup yang valid**. Tes ini di database Supabase **project terpisah** (bukan production!), supaya aman:

1. Buat project Supabase baru khusus untuk uji restore (paket Free juga cukup).
2. Ambil `DIRECT_URL` project baru itu.
3. Restore:
   ```bash
   pg_restore --dbname="postgresql://postgres.yyyy:PASSWORD@aws-0-yyyy.pooler.supabase.com:5432/postgres" \
     --clean --if-exists \
     backup_20260827_120000.dump
   ```
4. Cek beberapa tabel penting (`pengguna`, `absensi`) sudah terisi dan jumlah baris masuk akal.
5. Hapus project uji coba itu setelah selesai (supaya tidak numpuk project gratis di akun Supabase).

Ulangi tes ini setiap beberapa bulan atau setelah perubahan skema besar, supaya kamu yakin proses restore beneran jalan saat dibutuhkan — bukan cuma asumsi.

## 4. Checklist ringkas

- [ ] Backup manual pertama sudah dibuat & disimpan di luar komputer
- [ ] Jadwal otomatis (Task Scheduler / GitHub Actions / Supabase Pro) sudah aktif
- [ ] Restore sudah pernah dites minimal 1x di project terpisah
- [ ] Lokasi penyimpanan backup diketahui semua pihak yang butuh (bukan cuma 1 orang)
