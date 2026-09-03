const prisma = require("../utils/prismaClient");
const {
  normalisasiSubscription,
  webPushAktif,
  pastikanTabelPushSubscription,
} = require("../utils/pushNotification");

async function infoPush(req, res) {
  return res.json({
    aktif: webPushAktif(),
    publicKey: String(process.env.VAPID_PUBLIC_KEY || "").trim() || null,
  });
}

async function simpanSubscription(req, res) {
  try {
    if (!webPushAktif()) {
      return res.status(503).json({ pesan: "Layanan notifikasi push belum dikonfigurasi di server." });
    }

    if (!(await pastikanTabelPushSubscription())) {
      return res.status(503).json({ pesan: "Database notifikasi belum siap. Silakan coba lagi." });
    }

    const subscription = normalisasiSubscription(req.body);
    if (!subscription) {
      return res.status(400).json({ pesan: "Data subscription notifikasi tidak valid." });
    }

    await prisma.pushSubscription.upsert({
      where: { endpoint: subscription.endpoint },
      update: {
        penggunaId: req.user.id,
        p256dh: subscription.p256dh,
        auth: subscription.auth,
        userAgent: String(req.headers["user-agent"] || "").slice(0, 500) || null,
      },
      create: {
        penggunaId: req.user.id,
        endpoint: subscription.endpoint,
        p256dh: subscription.p256dh,
        auth: subscription.auth,
        userAgent: String(req.headers["user-agent"] || "").slice(0, 500) || null,
      },
    });

    return res.json({ pesan: "Perangkat berhasil didaftarkan untuk notifikasi." });
  } catch (error) {
    console.error("Gagal menyimpan push subscription:", error);
    return res.status(500).json({ pesan: "Perangkat gagal didaftarkan untuk notifikasi." });
  }
}

async function hapusSubscription(req, res) {
  try {
    const endpoint = String(req.body?.endpoint || "").trim();
    if (!endpoint) return res.status(400).json({ pesan: "Endpoint subscription wajib diisi." });

    await prisma.pushSubscription.deleteMany({
      where: { endpoint, penggunaId: req.user.id },
    });

    return res.json({ pesan: "Perangkat berhasil dilepas dari notifikasi." });
  } catch (error) {
    console.error("Gagal menghapus push subscription:", error);
    return res.status(500).json({ pesan: "Perangkat gagal dilepas dari notifikasi." });
  }
}

module.exports = {
  infoPush,
  simpanSubscription,
  hapusSubscription,
};
