import { API_URL, getToken, getPenggunaLogin } from "./api.js";

let prosesRegistrasi = null;

function base64UrlKeUint8Array(base64Url) {
  const padding = "=".repeat((4 - (base64Url.length % 4)) % 4);
  const base64 = (base64Url + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(base64);
  return Uint8Array.from([...raw].map((char) => char.charCodeAt(0)));
}

function normalisasiPermission() {
  return typeof Notification === "undefined" ? "unsupported" : Notification.permission;
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
  if (normalisasiPermission() !== "granted") return false;

  const sw = await ambilServiceWorker();
  if (!sw) return false;

  const infoResponse = await fetch(`${API_URL}/notifikasi/info`, {
    headers: { Authorization: `Bearer ${getToken()}` },
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

  if (Notification.permission !== "granted") return false;
  return registrasikanPush();
}

export function pasangWebPushOtomatis() {
  if (typeof window === "undefined" || window.__webPushOtomatisTerpasang) return;
  window.__webPushOtomatisTerpasang = true;

  const sync = async () => {
    const pengguna = getPenggunaLogin();
    const token = getToken();
    if (!pengguna || !token) return;

    if (prosesRegistrasi) return prosesRegistrasi;
    prosesRegistrasi = mintaIzinDanDaftar().catch((error) => {
      console.warn("Registrasi notifikasi otomatis gagal:", error);
      return false;
    }).finally(() => {
      prosesRegistrasi = null;
    });

    return prosesRegistrasi;
  };

  // Dicoba otomatis setelah sesi login terdeteksi. Pada browser yang
  // mensyaratkan user gesture, requestPermission dapat ditolak oleh browser;
  // ketika izin sudah pernah diberikan, registrasi tetap berlangsung otomatis.
  void sync();
  window.setInterval(() => void sync(), 5000);

  navigator.serviceWorker?.addEventListener("message", (event) => {
    if (event?.data?.type === "ZAMAN_TEKNINDO_PUSH_READY") void sync();
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
