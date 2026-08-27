# Absensi PT. Zaman Teknindo

Sistem absensi & penggajian karyawan berbasis web — absen pakai kamera + verifikasi lokasi GPS, dengan dashboard terpisah untuk Karyawan dan Admin.

## Fitur

**Karyawan**
- Absen masuk/pulang dengan foto kamera + verifikasi lokasi GPS
- Antrian absen offline otomatis (kalau internet mati saat absen, foto & data tetap tersimpan di HP dan otomatis terkirim begitu internet kembali)
- Riwayat absensi & pengajuan izin/sakit/cuti (dengan lampiran surat)
- Bisa di-*install* sebagai app (PWA) di HP

**Admin**
- Rekap kehadiran harian real-time, dengan notifikasi (akun baru & pengajuan izin) yang otomatis update
- Approval akun karyawan baru & pengajuan izin
- Manajemen data karyawan, kantor/cabang, dan hari libur
- Perhitungan & export gaji ke Excel
- Tren & analisis kehadiran

## Arsitektur

```
Browser (Karyawan / Admin)
        │
        ▼
  Vercel
   ├── Frontend  → React + Vite
   └── /api/*    → Express (serverless function, lihat api/index.js)
                        │
                        ▼
                    Prisma ORM
                        │
                        ▼
              Supabase (PostgreSQL + Storage foto)
```

Frontend dan backend di-deploy jadi **satu project Vercel** — `vercel.json` yang mengatur supaya request ke `/api/*` diarahkan ke Express (`api/index.js`), sisanya diarahkan ke frontend React.

## Struktur folder

```
src/                    Frontend (React + Vite)
  pages/                Satu file per halaman (Login, DashboardAdmin, dst)
  components/           Komponen yang dipakai bersama (AuthLayout, TopbarHijau)
  utils/                Helper (pemanggilan API, format waktu, dll)
  styles/                Design token (warna, font)

backend/
  src/
    controllers/        Logika tiap fitur (auth, absensi, admin, izin, gaji)
    routes/              Definisi endpoint API
    middleware/          Auth check, rate limiter, kompresi foto
    utils/                Koneksi Prisma, integrasi Supabase Storage
  prisma/
    schema.prisma        Skema database
    migrations/           Riwayat perubahan skema database

api/index.js             Pintu masuk serverless function Vercel (re-export Express app)
```

## Menjalankan di lokal

**Kebutuhan:** Node.js 18+, akun Supabase (gratis cukup untuk development).

1. Install dependency:
   ```bash
   npm install
   ```

2. Salin `.env.example` jadi `.env` (untuk frontend, kalau perlu) dan `backend/.env` (untuk backend), lalu isi sesuai instruksi komentar di masing-masing baris — nilai yang dibutuhkan: `DATABASE_URL`, `DIRECT_URL`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `JWT_SECRET`, `ALLOWED_EMAIL_DOMAIN`.

3. Generate Prisma client & sinkronkan skema ke database:
   ```bash
   npm run prisma:generate
   npm run prisma:deploy
   ```

4. Jalankan backend & frontend (2 terminal terpisah):
   ```bash
   npm run dev:backend   # Express di localhost:5000
   npm run dev            # Vite di localhost:5173, proxy /api ke backend
   ```

5. Buka `http://localhost:5173`.

## Database (Prisma)

- **Jangan pernah** menjalankan `npm run prisma:migrate` (`prisma migrate dev`) langsung ke database production — perintah itu untuk membuat migration baru saat development lokal.
- Untuk menerapkan migration ke production, gunakan `npm run prisma:deploy` (`prisma migrate deploy`) — ini hanya menjalankan migration yang sudah ada, tidak pernah membuat perubahan skema baru secara otomatis.
- `npm run prisma:studio` untuk membuka GUI database.

## Deployment (Vercel)

1. Import repo ini di Vercel.
2. Isi seluruh environment variable dari `.env.example` di **Project Settings → Environment Variables** (untuk environment Production).
3. `FRONTEND_URL` **wajib** diisi persis dengan domain production (contoh: `https://zaman-teknindo.vercel.app`) — backend menolak request dari domain yang tidak ada di daftar ini (CORS whitelist ketat, bukan wildcard).
4. Build command sudah otomatis benar lewat script `vercel-build` di `package.json` (generate Prisma client, lalu build frontend).

## Keamanan yang sudah diterapkan

- Password di-hash dengan bcrypt, token sesi (JWT) expire otomatis 8 jam
- Rate limiting untuk login (8x/15 menit) & pendaftaran akun (5x/jam) per IP
- CORS whitelist ketat (bukan wildcard) untuk production
- Validasi & kompresi otomatis untuk setiap foto yang di-upload
- Foto absensi & surat izin disimpan privat di Supabase Storage, diakses lewat signed URL yang kedaluwarsa otomatis
- Detail error internal tidak pernah dikirim ke client, hanya dicatat di server log

## Yang masih perlu diperhatikan sebelum dipakai skala besar

- **Storage foto** ada di paket gratis Supabase (1 GB) — perlu kebijakan retensi/arsip foto kalau jumlah karyawan & lama pemakaian bertambah
- **Backup database** belum otomatis di paket gratis Supabase — perlu backup manual berkala
- Belum pernah diuji dengan *load test* untuk skenario banyak karyawan absen bersamaan

## Troubleshooting singkat

| Masalah | Kemungkinan penyebab |
|---|---|
| Login gagal, error CORS di console browser | `FRONTEND_URL` di environment variable belum sesuai domain yang diakses |
| Migration gagal saat deploy | Pastikan `DIRECT_URL` sudah diisi (beda dari `DATABASE_URL`, pakai port 5432 bukan 6543) |
| Foto tidak muncul di dashboard Admin | Cek `SUPABASE_SERVICE_ROLE_KEY` & `SUPABASE_URL` sudah benar di environment backend |
