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

function tanggalRekapAktif() {
  if (typeof window !== "undefined") {
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

const NOTIFIKASI_INTERVAL_MS = 30000;
const NOTIFIKASI_USER_SYNC_MS = 1000;
const NOTIFIKASI_ADMIN_KEY = "zaman-teknindo:notifikasi-admin:v1:";
const NOTIFIKASI_KARYAWAN_KEY = "zaman-teknindo:notifikasi-karyawan:v1:";

function bacaJSONLokal(kunci) {
  try {
    const raw = localStorage.getItem(kunci);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function simpanJSONLokal(kunci, nilai) {
  try {
    localStorage.setItem(kunci, JSON.stringify(nilai));
  } catch {
    // Notifikasi tetap bisa berjalan walau storage penuh/dibatasi browser.
  }
}

function formatTanggalNotifikasi(tanggal) {
  try {
    return new Date(tanggal).toLocaleDateString("id-ID", {
      timeZone: "UTC",
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  } catch {
    return String(tanggal || "");
  }
}

async function tampilkanNotifikasiPerangkat(judul, isi, tag) {
  if (typeof window === "undefined" || !("Notification" in window)) return false;
  if (Notification.permission !== "granted") return false;

  try {
    if ("serviceWorker" in navigator) {
      const siap = await Promise.race([
        navigator.serviceWorker.ready,
        new Promise((_, reject) => setTimeout(() => reject(new Error("Service worker timeout")), 2500)),
      ]);

      if (siap?.showNotification) {
        await siap.showNotification(judul, {
          body: isi,
          icon: "/icon-192.png",
          badge: "/icon-192.png",
          tag,
          renotify: true,
        });
        return true;
      }
    }
  } catch (error) {
    console.warn("Notifikasi service worker tidak tersedia:", error);
  }

  try {
    new Notification(judul, { body: isi, icon: "/icon-192.png", tag });
    return true;
  } catch (error) {
    console.warn("Notifikasi perangkat tidak dapat ditampilkan:", error);
    return false;
  }
}

async function ambilSnapshotNotifikasiAdmin(pengguna) {
  const res = await fetch(`${API_URL}/admin/notifikasi`, {
    headers: { Authorization: `Bearer ${getToken()}` },
  });
  if (!res.ok) return;
  const data = await res.json().catch(() => ({}));
  const snapshot = {
    akunBaru: Number(data?.data?.akunBaru || 0),
    izinBaru: Number(data?.data?.izinBaru || 0),
  };
  const kunci = `${NOTIFIKASI_ADMIN_KEY}${pengguna.id || pengguna.email}`;
  const sebelumnya = bacaJSONLokal(kunci);

  if (sebelumnya) {
    if (snapshot.akunBaru > sebelumnya.akunBaru) {
      await tampilkanNotifikasiPerangkat(
        "Zaman Teknindo — Akun Baru",
        `${snapshot.akunBaru - sebelumnya.akunBaru} akun karyawan baru menunggu konfirmasi Admin.`,
        "admin-akun-baru",
      );
    }
    if (snapshot.izinBaru > sebelumnya.izinBaru) {
      await tampilkanNotifikasiPerangkat(
        "Zaman Teknindo — Pengajuan Izin",
        `${snapshot.izinBaru - sebelumnya.izinBaru} pengajuan izin baru menunggu diproses.`,
        "admin-izin-baru",
      );
    }
  }

  simpanJSONLokal(kunci, snapshot);
}

async function ambilSnapshotNotifikasiKaryawan(pengguna) {
  const res = await fetch(`${API_URL}/izin/riwayat-saya`, {
    headers: { Authorization: `Bearer ${getToken()}` },
  });
  if (!res.ok) return;
  const data = await res.json().catch(() => ({}));
  const daftar = Array.isArray(data?.data) ? data.data : [];
  const snapshot = {};

  for (const item of daftar) {
    snapshot[item.id] = {
      status: item.status,
      jenis: item.jenis,
      tanggal: item.tanggal,
    };
  }

  const kunci = `${NOTIFIKASI_KARYAWAN_KEY}${pengguna.id || pengguna.email}`;
  const sebelumnya = bacaJSONLokal(kunci);

  if (sebelumnya) {
    for (const item of daftar) {
      const lama = sebelumnya[item.id];
      if (!lama || lama.status === item.status) continue;

      if (item.status === "disetujui") {
        await tampilkanNotifikasiPerangkat(
          "Zaman Teknindo — Pengajuan Disetujui",
          `Pengajuan ${item.jenis} tanggal ${formatTanggalNotifikasi(item.tanggal)} telah disetujui Admin.`,
          `karyawan-izin-disetujui-${item.id}`,
        );
      } else if (item.status === "ditolak") {
        await tampilkanNotifikasiPerangkat(
          "Zaman Teknindo — Pengajuan Ditolak",
          `Pengajuan ${item.jenis} tanggal ${formatTanggalNotifikasi(item.tanggal)} ditolak Admin.`,
          `karyawan-izin-ditolak-${item.id}`,
        );
      }
    }
  }

  simpanJSONLokal(kunci, snapshot);
}

function buatTombolNotifikasiPerangkat() {
  if (typeof document === "undefined" || document.getElementById("zaman-teknindo-notif-button")) return null;
  if (!("Notification" in window)) return null;

  const tombol = document.createElement("button");
  tombol.id = "zaman-teknindo-notif-button";
  tombol.type = "button";
  tombol.setAttribute("aria-label", "Pengaturan notifikasi perangkat");
  tombol.style.cssText = [
    "position:fixed",
    "right:16px",
    "bottom:16px",
    "z-index:9999",
    "min-height:42px",
    "padding:10px 15px",
    "border:0",
    "border-radius:999px",
    "background:#0B6E45",
    "color:#fff",
    "font:700 12px/1.2 Arial,sans-serif",
    "box-shadow:0 6px 20px rgba(0,0,0,.16)",
    "cursor:pointer",
    "display:none",
    "align-items:center",
    "gap:7px",
  ].join(";");

  document.body.appendChild(tombol);
  return tombol;
}

export function pasangNotifikasiPerangkat() {
  if (typeof window === "undefined" || window.__notifikasiPerangkatTerpasang) return;
  window.__notifikasiPerangkatTerpasang = true;
  if (!("Notification" in window)) return;

  const mulai = () => {
    const tombol = buatTombolNotifikasiPerangkat();
    if (!tombol) return;

    let kunciPenggunaAktif = "";
    let sedangCek = false;
    let terakhirCek = 0;

    function penggunaSekarang() {
      const pengguna = getPenggunaLogin();
      if (!pengguna || !getToken()) return null;
      if (pengguna.peran !== "admin" && pengguna.peran !== "karyawan") return null;
      return pengguna;
    }

    function perbaruiTampilan(pengguna) {
      if (!pengguna) {
        tombol.style.display = "none";
        kunciPenggunaAktif = "";
        return;
      }

      tombol.style.display = "inline-flex";
      if (Notification.permission === "granted") {
        tombol.textContent = "✓ Notifikasi aktif";
        tombol.style.background = "#0B6E45";
      } else if (Notification.permission === "denied") {
        tombol.textContent = "🔕 Notifikasi diblokir";
        tombol.style.background = "#7A2530";
      } else {
        tombol.textContent = "🔔 Aktifkan notifikasi";
        tombol.style.background = "#0B6E45";
      }
    }

    async function cekNotifikasi(force = false) {
      const pengguna = penggunaSekarang();
      perbaruiTampilan(pengguna);
      if (!pengguna || Notification.permission !== "granted") return;

      const kunci = `${pengguna.peran}:${pengguna.id || pengguna.email}`;
      if (kunci !== kunciPenggunaAktif) {
        kunciPenggunaAktif = kunci;
        terakhirCek = 0;
      }

      if (sedangCek) return;
      if (!force && Date.now() - terakhirCek < NOTIFIKASI_INTERVAL_MS) return;
      sedangCek = true;
      terakhirCek = Date.now();

      try {
        if (pengguna.peran === "admin") {
          await ambilSnapshotNotifikasiAdmin(pengguna);
        } else {
          await ambilSnapshotNotifikasiKaryawan(pengguna);
        }
      } catch (error) {
        console.warn("Sinkronisasi notifikasi perangkat gagal:", error);
      } finally {
        sedangCek = false;
      }
    }

    tombol.addEventListener("click", async () => {
      if (Notification.permission === "denied") {
        tombol.textContent = "🔕 Izinkan di pengaturan browser";
        return;
      }

      try {
        const izin = await Notification.requestPermission();
        perbaruiTampilan(penggunaSekarang());
        if (izin === "granted") {
          await cekNotifikasi(true);
          await tampilkanNotifikasiPerangkat(
            "Zaman Teknindo",
            "Notifikasi perangkat berhasil diaktifkan.",
            "zaman-teknindo-notifikasi-test",
          );
        }
      } catch (error) {
        console.warn("Permintaan izin notifikasi gagal:", error);
      }
    });

    perbaruiTampilan(penggunaSekarang());
    void cekNotifikasi(true);

    window.setInterval(() => {
      void cekNotifikasi(false);
    }, NOTIFIKASI_INTERVAL_MS);

    window.setInterval(() => {
      perbaruiTampilan(penggunaSekarang());
    }, NOTIFIKASI_USER_SYNC_MS);
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", mulai, { once: true });
  } else {
    mulai();
  }
}

export function pasangPenerjemahSesiKedaluwarsa() {
  if (window.__interceptorSesiSudahDipasang) return;

  window.__interceptorSesiSudahDipasang = true;
  const fetchAsli = window.fetch.bind(window);

  window.fetch = async function (...argumen) {
    const urlPermintaanAwal = urlDariArgumen(argumen);
    const urlPermintaan = tambahkanTanggalRekap(urlPermintaanAwal);
    const argumenDenganTanggal = [urlPermintaan, argumen[1]];
    const iniStatusAbsensi = urlPermintaan.includes("/api/absensi/status-hari-ini");

    let respons;
    try {
      respons = await fetchAsli(...argumenDenganTanggal);
    } catch (errorPertama) {
      if (!iniStatusAbsensi) throw errorPertama;
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

    if (iniStatusAbsensi && respons.status >= 500) {
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
      const memangMasalahSesi = pesan.includes("belum login") || pesan.includes("sesi login") || pesan.includes("token") || pesan.includes("akun tidak ditemukan") || pesan.includes("kedaluwarsa");
      if (memangMasalahSesi && getToken()) {
        hapusSesiLogin();
        sessionStorage.setItem("pesanSetelahLogout", data?.pesan || "Sesi login sudah berakhir. Silakan login kembali.");
        if (window.location.pathname !== "/login") window.location.href = "/login";
      }
      return respons;
    }

    if (respons.status === 403) {
      try {
        const salinan = respons.clone();
        const data = await salinan.json();
        const pesan = String(data?.pesan || "").toLowerCase();
        const akunTidakAktif = pesan.includes("dinonaktifkan") || pesan.includes("menunggu konfirmasi");
        if (akunTidakAktif && getToken()) {
          hapusSesiLogin();
          sessionStorage.setItem("pesanSetelahLogout", data?.pesan || "Akun Anda tidak dapat digunakan. Silakan hubungi Admin.");
          if (window.location.pathname !== "/login") window.location.href = "/login";
        }
      } catch (error) {
        console.warn("Tidak dapat membaca response 403:", error);
      }
    }

    return respons;
  };

  pasangNotifikasiPerangkat();
}
