// File: src/utils/api.js

// ============================================================
// ALAMAT BACKEND
// ============================================================

export const API_URL = import.meta.env.VITE_API_URL || "/api";

// ============================================================
// SESI LOGIN
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

  if (!data) return null;

  try {
    return JSON.parse(data);
  } catch (error) {
    console.error("Data pengguna di localStorage rusak:", error);
    return null;
  }
}

export function hapusSesiLogin() {
  localStorage.removeItem("token");
  localStorage.removeItem("pengguna");
}

// ============================================================
// INTERCEPTOR SESI
// ============================================================
//
// 401:
//   Token tidak valid / kedaluwarsa / akun tidak ditemukan.
//
// 403:
//   Hanya logout otomatis jika akun memang dinonaktifkan.
//
// 403 karena role:
//   Tidak logout otomatis.
//
// ============================================================

export function pasangPenerjemahSesiKedaluwarsa() {
  // Jangan pasang interceptor lebih dari satu kali
  if (window.__interceptorSesiSudahDipasang) {
    return;
  }

  window.__interceptorSesiSudahDipasang = true;

  const fetchAsli = window.fetch;

  window.fetch = async function (...argumen) {
    const respons = await fetchAsli(...argumen);

    const urlPermintaan =
      typeof argumen[0] === "string" ? argumen[0] : argumen[0]?.url || "";

    // Hanya proses request ke backend kita
    const permintaanKeBackendKita = urlPermintaan.includes("/api/");

    if (!permintaanKeBackendKita) {
      return respons;
    }

    // Jangan campuri login, daftar, ganti password, dll.
    const iniPermintaanAuth = urlPermintaan.includes("/api/auth/");

    if (iniPermintaanAuth) {
      return respons;
    }

    // ========================================================
    // 401
    // ========================================================

    if (respons.status === 401) {
      let data = {};

      try {
        const salinan = respons.clone();
        data = await salinan.json();
      } catch {
        // Response bukan JSON
      }

      const pesan = String(data?.pesan || "").toLowerCase();

      const memangMasalahSesi =
        pesan.includes("belum login") ||
        pesan.includes("sesi login") ||
        pesan.includes("token") ||
        pesan.includes("akun tidak ditemukan") ||
        pesan.includes("kedaluwarsa");

      // Jangan logout secara buta hanya karena HTTP 401.
      // Logout hanya jika response memang mengindikasikan masalah sesi.
      if (memangMasalahSesi && getToken()) {
        hapusSesiLogin();

        sessionStorage.setItem(
          "pesanSetelahLogout",
          data?.pesan || "Sesi login sudah berakhir. Silakan login kembali.",
        );

        if (window.location.pathname !== "/login") {
          window.location.href = "/login";
        }
      }

      return respons;
    }

    // ========================================================
    // 403
    // ========================================================

    if (respons.status === 403) {
      try {
        const salinan = respons.clone();
        const data = await salinan.json();

        const pesan = String(data?.pesan || "").toLowerCase();

        const akunTidakAktif =
          pesan.includes("dinonaktifkan") ||
          pesan.includes("menunggu konfirmasi");

        // Hanya logout jika memang akun tidak bisa digunakan.
        if (akunTidakAktif && getToken()) {
          hapusSesiLogin();

          sessionStorage.setItem(
            "pesanSetelahLogout",
            data?.pesan ||
              "Akun Anda tidak dapat digunakan. Silakan hubungi Admin.",
          );

          if (window.location.pathname !== "/login") {
            window.location.href = "/login";
          }
        }
      } catch (error) {
        console.warn("Tidak dapat membaca response 403:", error);
      }
    }

    return respons;
  };
}
