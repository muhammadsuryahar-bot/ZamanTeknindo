function tujuanNotifikasi(data) {
  const raw = String(data?.url || "/").trim() || "/";

  try {
    const url = new URL(raw, self.location.origin);

    // Notifikasi sistem aplikasi hanya boleh membuka halaman aplikasi
    // sendiri. Kalau payload rusak / mengarah ke origin lain, kembali ke root.
    if (url.origin !== self.location.origin) {
      return new URL("/", self.location.origin);
    }

    return url;
  } catch {
    return new URL("/", self.location.origin);
  }
}

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = {
      title: "Zaman Teknindo",
      body: event.data?.text?.() || "Ada pemberitahuan baru.",
    };
  }

  const title = data.title || "Zaman Teknindo";
  const options = {
    body: data.body || "Ada pemberitahuan baru.",
    icon: data.icon || "/icon-192.png",
    badge: data.badge || "/icon-192.png",
    tag: data.tag || "zaman-teknindo-push",
    renotify: Boolean(data.renotify),
    silent: false,
    vibrate: [200, 100, 200],
    requireInteraction: true,
    data: {
      url: tujuanNotifikasi(data).pathname + tujuanNotifikasi(data).search + tujuanNotifikasi(data).hash,
    },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const tujuan = tujuanNotifikasi(event.notification.data);

  event.waitUntil(
    (async () => {
      const daftarClient = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });

      // Prioritaskan tab/window aplikasi yang sudah terbuka supaya tidak
      // membuat tab duplikat. Navigasikan dahulu, baru fokuskan.
      for (const client of daftarClient) {
        try {
          const clientUrl = new URL(client.url);
          if (clientUrl.origin !== self.location.origin) continue;
          if (!("focus" in client)) continue;

          if ("navigate" in client && client.url !== tujuan.href) {
            await client.navigate(tujuan.href);
          }

          return await client.focus();
        } catch {
          // Lanjut cari client lain atau buka window baru.
        }
      }

      return self.clients.openWindow(tujuan.href);
    })(),
  );
});
