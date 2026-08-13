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

  return data ? JSON.parse(data) : null;
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
//   Token tidak valid / kedaluwarsa.
//
// 403:
//   Hanya logout otomatis jika backend menyatakan
//   akun sudah dinonaktifkan / tidak aktif.
//
// 403 karena role:
//   Tidak logout otomatis.
//
// ============================================================

export function pasangPenerjemahSesiKedaluwarsa() {
  const fetchAsli = window.fetch;

  window.fetch = async function (...argumen) {
    const respons = await fetchAsli(...argumen);

    const urlPermintaan =
      typeof argumen[0] === "string" ? argumen[0] : argumen[0]?.url || "";

    const permintaanKeBackendKita = urlPermintaan.includes("/api/");

    const iniPermintaanAuth = urlPermintaan.includes("/api/auth/");

    // Bukan request API kita
    if (!permintaanKeBackendKita) {
      return respons;
    }

    // Jangan ganggu endpoint login/register
    if (iniPermintaanAuth) {
      return respons;
    }

    // ========================================================
    // 401
    // ========================================================

    if (respons.status === 401) {
      hapusSesiLogin();

      sessionStorage.setItem(
        "pesanSetelahLogout",
        "Sesi kamu sudah berakhir. Silakan login kembali.",
      );

      if (window.location.pathname !== "/login") {
        window.location.href = "/login";
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
          pesan.includes("tidak aktif") ||
          pesan.includes("status akun");

        if (akunTidakAktif) {
          hapusSesiLogin();

          sessionStorage.setItem(
            "pesanSetelahLogout",
            data?.pesan || "Akun Anda telah dinonaktifkan oleh Admin.",
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
