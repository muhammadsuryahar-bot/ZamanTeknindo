import { API_URL, getToken, getPenggunaLogin } from "./api.js";

let prosesRegistrasi = null;
let terakhirSinkronPush = 0;
const INTERVAL_SINKRON_PUSH_MS = 10 * 60 * 1000;

function base64UrlKeUint8Array(base64Url) {
  const padding = "=".repeat((4 - (base64Url.length % 4)) % 4);
  const base64 = (base64Url + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(base64);
  return Uint8Array.from([...raw].map((char) => char.charCodeAt(0)));
}

async function ambilServiceWorker() {
  if (!("serviceWorker" in navigator)) return null;
  try {
    return await Promise.race([
      navigator.serviceWorker.ready,
      new Promise((_, reject) => setTimeout(() => reject(new Error("Service worker belum siap")), 8000)),
    ]);
  } catch (error) {
    console.warn("Service worker belum siap untuk push:", error);
    return null;
  }
}

async function daftarPerangkatKeServer(subscription) {
  const res = await fetch(`${API_URL}/notifikasi/subscription`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${getToken()}`,
      "X-Zaman-Background": "web-push-registration",
    },
    body: JSON.stringify(subscription.toJSON()),
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data?.pesan || "Perangkat gagal didaftarkan.");
  }
}

async function registrasikanPush() {
  if (typeof window === "undefined" || typeof navigator === "undefined") return false;
  if (!("Notification" in window) || !("serviceWorker" in navigator) || !("PushManager" in window)) return false;
  if (!getToken() || !getPenggunaLogin()) return false;
  if (Notification.permission !== "granted") return false;

  const sekarang = Date.now();
  if (sekarang - terakhirSinkronPush < INTERVAL_SINKRON_PUSH_MS) return false;
  terakhirSinkronPush = sekarang;

  const sw = await ambilServiceWorker();
  if (!sw) return false;

  const infoResponse = await fetch(`${API_URL}/notifikasi/info`, {
    headers: {
      Authorization: `Bearer ${getToken()}`,
      "X-Zaman-Background": "web-push-registration",
    },
  });
  if (!infoResponse.ok) return false;
  const info = await infoResponse.json().catch(() => ({}));
  if (!info?.aktif || !info?.publicKey) return false;

  let subscription = await sw.pushManager.getSubscription();
  if (!subscription) {
    subscription = await sw.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: base64UrlKeUint8Array(info.publicKey),
    });
  }

  await daftarPerangkatKeServer(subscription);
  localStorage.setItem("zaman-teknindo:web-push-terdaftar:v2", "1");
  return true;
}

async function tesPushAdminDariUrl() {
  if (typeof window === "undefined") return;
  const params = new URLSearchParams(window.location.search);
  if (params.get("tes-notifikasi") !== "1") return;

  const pengguna = getPenggunaLogin();
  const token = getToken();
  if (!pengguna || !token || pengguna.peran !== "admin") return;

  try {
    const terdaftar = await registrasikanPush();
    if (!terdaftar && Notification.permission !== "granted") return;

    const res = await fetch(`${API_URL}/notifikasi/test-admin`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        "X-Zaman-Background": "web-push-test",
      },
      body: JSON.stringify({}),
    });
    const data = await res.json().catch(() => ({}));
    console.info("Hasil tes Web Push:", data);

    const url = new URL(window.location.href);
    url.searchParams.delete("tes-notifikasi");
    window.history.replaceState({}, "", url.pathname + url.search + url.hash);
  } catch (error) {
    console.error("Tes Web Push dari URL gagal:", error);
  }
}

async function mintaIzinDanDaftar() {
  if (typeof Notification === "undefined") return false;

  if (Notification.permission === "default") {
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") return false;
    } catch (error) {
      console.warn("Permintaan izin notifikasi gagal:", error);
      return false;
    }
  }

  return registrasikanPush();
}

export function pasangWebPushOtomatis() {
  if (typeof window === "undefined" || window.__webPushOtomatisTerpasang) return;
  window.__webPushOtomatisTerpasang = true;

  let penggunaTerdeteksi = false;
  let sudahMemintaIzinSesi = false;

  const sync = async (bolehMintaIzin = false) => {
    const pengguna = getPenggunaLogin();
    const token = getToken();
    if (!pengguna || !token) {
      penggunaTerdeteksi = false;
      return false;
    }

    penggunaTerdeteksi = true;
    if (prosesRegistrasi) return prosesRegistrasi;

    if (Notification.permission !== "granted" && !bolehMintaIzin) return false;
    if (Notification.permission === "default" && sudahMemintaIzinSesi) return false;
    if (bolehMintaIzin && Notification.permission === "default") sudahMemintaIzinSesi = true;

    prosesRegistrasi = (bolehMintaIzin ? mintaIzinDanDaftar() : registrasikanPush())
      .catch((error) => {
        console.warn("Registrasi notifikasi otomatis gagal:", error);
        return false;
      })
      .finally(() => {
        prosesRegistrasi = null;
      });

    return prosesRegistrasi;
  };

  void sync(false).finally(() => {
    void tesPushAdminDariUrl();
  });

  const handlerInteraksiPertama = () => {
    if (!penggunaTerdeteksi && !getPenggunaLogin()) return;
    if (Notification.permission === "granted") {
      void sync(false);
    } else if (Notification.permission === "default") {
      void sync(true);
    }
    window.removeEventListener("click", handlerInteraksiPertama, true);
    window.removeEventListener("touchstart", handlerInteraksiPertama, true);
  };

  window.addEventListener("click", handlerInteraksiPertama, true);
  window.addEventListener("touchstart", handlerInteraksiPertama, true);

  const ketikaTerlihat = () => {
    if (document.visibilityState === "visible") void sync(false);
  };
  document.addEventListener("visibilitychange", ketikaTerlihat);

  navigator.serviceWorker?.addEventListener("message", (event) => {
    if (event?.data?.type === "ZAMAN_TEKNINDO_PUSH_READY") void sync(false);
  });
}

export async function lepasWebPushPerangkat() {
  try {
    const sw = await ambilServiceWorker();
    const subscription = await sw?.pushManager?.getSubscription();
    if (subscription) {
      await fetch(`${API_URL}/notifikasi/subscription`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${getToken()}`,
        },
        body: JSON.stringify({ endpoint: subscription.endpoint }),
      });
      await subscription.unsubscribe();
    }
    localStorage.removeItem("zaman-teknindo:web-push-terdaftar:v2");
    return true;
  } catch (error) {
    console.warn("Gagal melepas notifikasi perangkat:", error);
    return false;
  }
}
