// File: src/utils/api.js

export const API_URL = import.meta.env.VITE_API_URL || "/api";

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

// Hanya endpoint status absensi yang diberi satu retry ringan.
// Tujuannya mengatasi cold start / gangguan jaringan singkat tanpa membuat
// seluruh aplikasi terus mengulang request dan membebani backend.
const RETRY_STATUS_DELAY_MS = 350;

function tunggu(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function urlDariArgumen(argumen) {
  return typeof argumen[0] === "string" ? argumen[0] : argumen[0]?.url || "";
}

function argumenRetryTanpaSignal(argumen) {
  const [input, init] = argumen;
  // Dashboard status menggunakan string URL + init, jadi kita dapat
  // menghindari AbortSignal timeout pertama saat percobaan kedua.
  if (typeof input === "string") {
    return [input, init ? { ...init, signal: undefined } : undefined];
  }
  return [input, init ? { ...init, signal: undefined } : undefined];
}

export function pasangPenerjemahSesiKedaluwarsa() {
  if (window.__interceptorSesiSudahDipasang) return;

  window.__interceptorSesiSudahDipasang = true;
  const fetchAsli = window.fetch;

  window.fetch = async function (...argumen) {
    const urlPermintaan = urlDariArgumen(argumen);
    const iniStatusAbsensi = urlPermintaan.includes("/api/absensi/status-hari-ini");

    let respons;
    try {
      respons = await fetchAsli(...argumen);
    } catch (errorPertama) {
      if (!iniStatusAbsensi) throw errorPertama;
      try {
        await tunggu(RETRY_STATUS_DELAY_MS);
        return await fetchAsli(...argumenRetryTanpaSignal(argumen));
      } catch {
        throw errorPertama;
      }
    }

    if (iniStatusAbsensi && respons.status >= 500) {
      try {
        await tunggu(RETRY_STATUS_DELAY_MS);
        const retry = await fetchAsli(...argumenRetryTanpaSignal(argumen));
        if (retry.status < 500) return retry;
      } catch (errorRetry) {
        console.warn("Retry status absensi gagal:", errorRetry);
      }
    }

    const permintaanKeBackendKita = urlPermintaan.includes("/api/");
    if (!permintaanKeBackendKita) return respons;

    const iniPermintaanAuth = urlPermintaan.includes("/api/auth/");
    if (iniPermintaanAuth) return respons;

    if (respons.status === 401) {
      let data = {};
      try {
        const salinan = respons.clone();
        data = await salinan.json();
      } catch {
        // Response bukan JSON.
      }

      const pesan = String(data?.pesan || "").toLowerCase();
      const memangMasalahSesi =
        pesan.includes("belum login") ||
        pesan.includes("sesi login") ||
        pesan.includes("token") ||
        pesan.includes("akun tidak ditemukan") ||
        pesan.includes("kedaluwarsa");

      if (memangMasalahSesi && getToken()) {
        hapusSesiLogin();
        sessionStorage.setItem(
          "pesanSetelahLogout",
          data?.pesan || "Sesi login sudah berakhir. Silakan login kembali.",
        );
        if (window.location.pathname !== "/login") window.location.href = "/login";
      }
      return respons;
    }

    if (respons.status === 403) {
      try {
        const salinan = respons.clone();
        const data = await salinan.json();
        const pesan = String(data?.pesan || "").toLowerCase();
        const akunTidakAktif =
          pesan.includes("dinonaktifkan") || pesan.includes("menunggu konfirmasi");

        if (akunTidakAktif && getToken()) {
          hapusSesiLogin();
          sessionStorage.setItem(
            "pesanSetelahLogout",
            data?.pesan || "Akun Anda tidak dapat digunakan. Silakan hubungi Admin.",
          );
          if (window.location.pathname !== "/login") window.location.href = "/login";
        }
      } catch (error) {
        console.warn("Tidak dapat membaca response 403:", error);
      }
    }

    return respons;
  };
}
