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

// Status absensi adalah request yang paling sensitif terhadap cold start
// backend dan jaringan seluler. Retry dilakukan otomatis dan hanya untuk
// endpoint ini, sehingga request lain tidak dibanjiri pengulangan.
const RETRY_STATUS_DELAYS_MS = [400, 1000];
const RETRY_STATUS_TIMEOUT_MS = 9000;

function tunggu(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function urlDariArgumen(argumen) {
  return typeof argumen[0] === "string" ? argumen[0] : argumen[0]?.url || "";
}

function initTanpaSignal(argumen) {
  const [input, init] = argumen;
  if (!init) return [input, undefined];
  return [input, { ...init, signal: undefined }];
}

async function fetchRetryDenganTimeout(fetchAsli, argumen) {
  const [input, init] = initTanpaSignal(argumen);
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), RETRY_STATUS_TIMEOUT_MS);

  try {
    return await fetchAsli(input, { ...(init || {}), signal: controller.signal });
  } finally {
    clearTimeout(timeoutId);
  }
}

export function pasangPenerjemahSesiKedaluwarsa() {
  if (window.__interceptorSesiSudahDipasang) return;

  window.__interceptorSesiSudahDipasang = true;
  const fetchAsli = window.fetch.bind(window);

  window.fetch = async function (...argumen) {
    const urlPermintaan = urlDariArgumen(argumen);
    const iniStatusAbsensi = urlPermintaan.includes("/api/absensi/status-hari-ini");

    let respons;
    try {
      respons = await fetchAsli(...argumen);
    } catch (errorPertama) {
      if (!iniStatusAbsensi) throw errorPertama;

      let errorTerakhir = errorPertama;
      for (const delay of RETRY_STATUS_DELAYS_MS) {
        try {
          await tunggu(delay);
          respons = await fetchRetryDenganTimeout(fetchAsli, argumen);
          break;
        } catch (errorRetry) {
          errorTerakhir = errorRetry;
        }
      }

      if (!respons) throw errorTerakhir;
    }

    // Cold start / gateway error tetap dicoba ulang otomatis.
    if (iniStatusAbsensi && respons.status >= 500) {
      let responsTerakhir = respons;

      for (const delay of RETRY_STATUS_DELAYS_MS) {
        try {
          await tunggu(delay);
          const retry = await fetchRetryDenganTimeout(fetchAsli, argumen);
          responsTerakhir = retry;
          if (retry.status < 500) break;
        } catch (errorRetry) {
          console.warn("Retry status absensi gagal:", errorRetry);
        }
      }

      respons = responsTerakhir;
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
