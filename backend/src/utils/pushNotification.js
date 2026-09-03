const webpush = require("web-push");
const prisma = require("./prismaClient");

let vapidSiap = false;

function siapkanVapid() {
  if (vapidSiap) return true;

  const publicKey = String(process.env.VAPID_PUBLIC_KEY || "").trim();
  const privateKey = String(process.env.VAPID_PRIVATE_KEY || "").trim();
  const subject = String(process.env.VAPID_SUBJECT || "mailto:admin@zamanteknindo.com").trim();

  if (!publicKey || !privateKey) {
    console.warn("Web Push belum aktif: VAPID_PUBLIC_KEY/VAPID_PRIVATE_KEY belum diatur.");
    return false;
  }

  try {
    webpush.setVapidDetails(subject, publicKey, privateKey);
    vapidSiap = true;
    return true;
  } catch (error) {
    console.error("Konfigurasi VAPID tidak valid:", error);
    return false;
  }
}

function webPushAktif() {
  return siapkanVapid();
}

function normalisasiSubscription(subscription) {
  if (!subscription || typeof subscription !== "object") return null;
  const endpoint = String(subscription.endpoint || "").trim();
  const p256dh = String(subscription.keys?.p256dh || "").trim();
  const auth = String(subscription.keys?.auth || "").trim();
  if (!endpoint || !p256dh || !auth) return null;
  return { endpoint, p256dh, auth };
}

async function kirimPushKePengguna(penggunaIds, payload) {
  if (!siapkanVapid()) return { terkirim: 0, dihapus: 0, dinonaktifkan: true };

  const ids = [...new Set((Array.isArray(penggunaIds) ? penggunaIds : [penggunaIds]).map(Number).filter(Number.isInteger))];
  if (!ids.length) return { terkirim: 0, dihapus: 0 };

  const subscriptions = await prisma.pushSubscription.findMany({
    where: { penggunaId: { in: ids } },
  });

  let terkirim = 0;
  let dihapus = 0;

  for (const item of subscriptions) {
    try {
      await webpush.sendNotification(
        {
          endpoint: item.endpoint,
          keys: { p256dh: item.p256dh, auth: item.auth },
        },
        JSON.stringify(payload),
        { TTL: 300 },
      );
      terkirim += 1;
    } catch (error) {
      const statusCode = Number(error?.statusCode || 0);
      if (statusCode === 404 || statusCode === 410) {
        await prisma.pushSubscription.delete({ where: { id: item.id } }).catch(() => {});
        dihapus += 1;
      } else {
        console.error(`Gagal mengirim push ke subscription #${item.id}:`, error?.message || error);
      }
    }
  }

  return { terkirim, dihapus };
}

async function kirimPushKeSemuaAdmin(payload) {
  const admins = await prisma.pengguna.findMany({
    where: { peran: "admin", statusAkun: "aktif" },
    select: { id: true },
  });
  return kirimPushKePengguna(admins.map((item) => item.id), payload);
}

module.exports = {
  webPushAktif,
  normalisasiSubscription,
  kirimPushKePengguna,
  kirimPushKeSemuaAdmin,
};
