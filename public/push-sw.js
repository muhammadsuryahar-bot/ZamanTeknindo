self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: "Zaman Teknindo", body: event.data?.text?.() || "Ada pemberitahuan baru." };
  }

  const title = data.title || "Zaman Teknindo";
  const options = {
    body: data.body || "Ada pemberitahuan baru.",
    icon: data.icon || "/icon-192.png",
    badge: data.badge || "/icon-192.png",
    tag: data.tag || "zaman-teknindo-push",
    renotify: Boolean(data.renotify),
    data: { url: data.url || "/" },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const tujuan = event.notification.data?.url || "/";

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if ("focus" in client) {
          if ("navigate" in client && client.url !== new URL(tujuan, self.location.origin).href) {
            void client.navigate(tujuan);
          }
          return client.focus();
        }
      }
      return self.clients.openWindow(tujuan);
    }),
  );
});
