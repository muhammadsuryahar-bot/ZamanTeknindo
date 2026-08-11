// File: src/utils/api.js

// ============================================================
// ALAMAT BACKEND
// ============================================================
// Dulu di sini ada logic "kalau bukan localhost, tebak https://domain-sama"
// -- itu yang bikin gagal connect pas dites dari HP lewat IP WiFi lokal
// (https://192.168.x.x otomatis nyoba port 443, padahal backend jalan di
// port 5000 pakai http biasa).
//
// Sekarang dipakai path RELATIF ("/api") saja. Kenapa ini lebih aman:
// - Saat development (`npm run dev`), Vite sendiri yang punya "proxy"
//   (lihat vite.config.js) yang otomatis neruskan setiap request "/api"
//   ke backend di localhost:5000 -- makanya TIDAK PEDULI kamu buka
//   halamannya dari localhost, dari IP WiFi, atau dari URL ngrok, semua
//   otomatis nyambung ke backend yang benar tanpa perlu nebak-nebak host.
// - Saat production nanti (sudah di-deploy beneran), kalau frontend &
//   backend disajikan dari domain yang sama (pola paling umum, lewat
//   reverse proxy/Nginx), path relatif ini juga otomatis tetap benar.
// - Kalau nanti ternyata frontend & backend di-deploy di domain YANG
//   BEDA (misal frontend di Vercel, backend di Railway), tinggal isi
//   file .env dengan VITE_API_URL=https://alamat-backend-asli.com/api
//   -- baris di bawah ini otomatis pakai itu kalau ada, tanpa perlu ubah
//   kode sama sekali.
export const API_URL = import.meta.env.VITE_API_URL || "/api";

// ============================================================
// SESI LOGIN (localStorage)
// ============================================================
export function getToken() {
  return localStorage.getItem("token");
}

export function simpanSesiLogin(token, pengguna) {
  localStorage.setItem("token", token);
  localStorage.setItem("pengguna", JSON.stringify(pengguna));
}

export function getPenggunaLogin() {
  const data = localStorage.getItem("pengguna");
  return data ? JSON.parse(data) : null;
}

export function hapusSesiLogin() {
  localStorage.removeItem("token");
  localStorage.removeItem("pengguna");
}

// ============================================================
// PENERJEMAH SESI KEDALUWARSA (dipasang sekali di main.jsx)
// ============================================================
// Ini "menyadap" SEMUA pemanggilan fetch() di seluruh aplikasi tanpa
// perlu ubah satu-satu di tiap halaman. Setiap kali backend membalas
// dengan status 401 (artinya: token tidak valid / sudah kedaluwarsa)
// untuk request yang ditujukan ke backend kita sendiri, otomatis:
//   1. Hapus sesi login yang sudah tidak valid dari localStorage
//   2. Lempar user balik ke halaman /login dengan pesan yang jelas
// Tanpa ini, user cuma lihat pesan generik "Tidak bisa terhubung ke
// server" di semua tombol, padahal sebenarnya cuma perlu login ulang.
export function pasangPenerjemahSesiKedaluwarsa() {
  const fetchAsli = window.fetch;

  window.fetch = async function (...argumen) {
    const respons = await fetchAsli(...argumen);

    const urlPermintaan = typeof argumen[0] === "string" ? argumen[0] : argumen[0]?.url || "";
    const permintaanKeBackendKita = urlPermintaan.includes("/api/");

    // Jangan proses endpoint login/daftar itu sendiri -- 401 di situ
    // artinya "email/password salah", bukan "sesi kedaluwarsa".
    const iniPermintaanLogin = urlPermintaan.includes("/api/auth/");

    if (respons.status === 401 && permintaanKeBackendKita && !iniPermintaanLogin) {
      hapusSesiLogin();
      sessionStorage.setItem("pesanSetelahLogout", "Sesi kamu sudah berakhir. Silakan login kembali.");
      if (window.location.pathname !== "/login") {
        window.location.href = "/login";
      }
    }

    return respons;
  };
}
