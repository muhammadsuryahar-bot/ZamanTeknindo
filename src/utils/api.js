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

const RETRY_STATUS_DELAYS_MS = [400, 1000];
const RETRY_STATUS_TIMEOUT_MS = 9000;
const HEADER_BACKGROUND = "X-Zaman-Background";

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

function nilaiHeader(argumen, nama) {
  const init = argumen?.[1];
  if (!init?.headers) return "";
  const headers = init.headers;
  if (headers instanceof Headers) return headers.get(nama) || "";
  if (Array.isArray(headers)) {
    const pasangan = headers.find(([key]) => String(key).toLowerCase() === nama.toLowerCase());
    return pasangan ? String(pasangan[1] || "") : "";
  }
  const kunci = Object.keys(headers).find((key) => key.toLowerCase() === nama.toLowerCase());
  return kunci ? String(headers[kunci] || "") : "";
}

function permintaanBackground(argumen) {
  return Boolean(nilaiHeader(argumen, HEADER_BACKGROUND));
}

function tokenSudahKedaluwarsa(token) {
  if (!token) return false;

  try {
    const bagian = String(token).split(".");
    if (bagian.length !== 3) return false;

    const payload = JSON.parse(
      decodeURIComponent(
        atob(bagian[1].replace(/-/g, "+").replace(/_/g, "/"))
          .split("")
          .map((karakter) => `%${`00${karakter.charCodeAt(0).toString(16)}`.slice(-2)}`)
          .join(""),
      ),
    );

    return Number.isFinite(Number(payload?.exp)) && Number(payload.exp) <= Math.floor(Date.now() / 1000);
  } catch {
    // Token rusak tetap dibiarkan ke backend agar backend yang menentukan
    // apakah token benar-benar invalid. Fungsi ini khusus mendeteksi expiry.
    return false;
  }
}

function logoutKarenaTokenExpired() {
  hapusSesiLogin();
  try {
    sessionStorage.setItem(
      "pesanSetelahLogout",
      "Sesi login sudah berakhir. Silakan login kembali.",
    );
  } catch {
    // Abaikan bila sessionStorage tidak tersedia.
  }
}

function tanggalRekapAktif() {
  if (typeof window === "undefined") return null;

  const globalTanggal = window.__adminTanggalRekap;
  if (typeof globalTanggal === "string" && /^\d{4}-\d{2}-\d{2}$/.test(globalTanggal)) {
    return globalTanggal;
  }

  try {
    const inputTanggal = document.querySelector('input[aria-label="Pilih tanggal rekap"]');
    const tanggalDOM = inputTanggal?.value;
    if (tanggalDOM && /^\d{4}-\d{2}-\d{2}$/.test(tanggalDOM)) return tanggalDOM;
  } catch {
    // Abaikan jika DOM belum siap.
  }

  try {
    const tanggalStorage = sessionStorage.getItem("admin-tanggal-rekap");
    if (tanggalStorage && /^\d{4}-\d{2}-\d{2}$/.test(tanggalStorage)) return tanggalStorage;
  } catch {
    // Abaikan storage yang tidak tersedia.
  }

  return null;
}

function tambahkanTanggalRekap(urlPermintaan) {
  if (!urlPermintaan.includes("/api/admin/rekap-hari-ini")) return urlPermintaan;
  const tanggal = tanggalRekapAktif();
  if (!tanggal) return urlPermintaan;

  try {
    const url = new URL(urlPermintaan, window.location.origin);
    url.searchParams.set("tanggal", tanggal);
    return url.href;
  } catch (error) {
    console.warn("Tanggal rekap Admin tidak dapat diterapkan:", error);
    return urlPermintaan;
  }
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
  if (typeof window === "undefined" || window.__interceptorSesiSudahDipasang) return;

  window.__interceptorSesiSudahDipasang = true;
  const fetchAsli = window.fetch.bind(window);

  window.fetch = async function (...argumen) {
    const urlPermintaanAwal = urlDariArgumen(argumen);
    const urlPermintaan = tambahkanTanggalRekap(urlPermintaanAwal);
    const argumenDenganTanggal = [urlPermintaan, argumen[1]];
    const iniStatusAbsensi = urlPermintaan.includes("/api/absensi/status-hari-ini");
    const iniBackground = permintaanBackground(argumen);
    const permintaanKeBackendKita = urlPermintaan.includes("/api/");
    const iniPermintaanAuth = urlPermintaan.includes("/api/auth/");

    // Jangan biarkan halaman menembakkan request API dengan JWT yang sudah
    // pasti expired. Ini mencegah lonjakan 401 "jwt expired" di server dan
    // membuat sesi berakhir dengan alur yang konsisten.
    if (permintaanKeBackendKita && !iniPermintaanAuth && tokenSudahKedaluwarsa(getToken())) {
      logoutKarenaTokenExpired();

      if (!iniBackground && window.location.pathname !== "/login") {
        window.location.href = "/login";
      }

      return new Response(
        JSON.stringify({
          pesan: "Sesi login sudah berakhir. Silakan login kembali.",
          kode: "TOKEN_EXPIRED",
        }),
        {
          status: 401,
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    let respons;

    try {
      respons = await fetchAsli(...argumenDenganTanggal);
    } catch (errorPertama) {
      if (!iniStatusAbsensi || iniBackground) throw errorPertama;

      let errorTerakhir = errorPertama;
      for (const delay of RETRY_STATUS_DELAYS_MS) {
        try {
          await tunggu(delay);
          respons = await fetchRetryDenganTimeout(fetchAsli, argumenDenganTanggal);
          break;
        } catch (errorRetry) {
          errorTerakhir = errorRetry;
        }
      }
      if (!respons) throw errorTerakhir;
    }

    if (iniStatusAbsensi && !iniBackground && respons.status >= 500) {
      let responsTerakhir = respons;
      for (const delay of RETRY_STATUS_DELAYS_MS) {
        try {
          await tunggu(delay);
          const retry = await fetchRetryDenganTimeout(fetchAsli, argumenDenganTanggal);
          responsTerakhir = retry;
          if (retry.status < 500) break;
        } catch (errorRetry) {
          console.warn("Retry status absensi gagal:", errorRetry);
        }
      }
      respons = responsTerakhir;
    }

    if (!permintaanKeBackendKita) return respons;
    if (iniPermintaanAuth) return respons;

    // Request background seperti rekonsiliasi antrean atau registrasi push
    // tidak boleh menghapus sesi dan memindahkan halaman karyawan hanya karena
    // token kedaluwarsa. Request foreground tetap memakai perilaku lama.
    if (respons.status === 401) {
      if (iniBackground) return respons;

      let data = {};
      try {
        data = await respons.clone().json();
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
      if (iniBackground) return respons;

      try {
        const data = await respons.clone().json();
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

  // Import dinamis agar utilitas API tidak membuat circular dependency.
  void import("./webPush.js").then(({ pasangWebPushOtomatis }) => {
    pasangWebPushOtomatis();
  }).catch((error) => {
    console.warn("Web Push belum dapat dipasang:", error);
  });
}
