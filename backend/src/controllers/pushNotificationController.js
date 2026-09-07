const prisma = require("../utils/prismaClient");
const {
  normalisasiSubscription,
  webPushAktif,
  pastikanTabelPushSubscription,
  kirimPushKePengguna,
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

async function tesPushAdmin(req, res) {
  try {
    if (req.user?.peran !== "admin") {
      return res.status(403).json({ pesan: "Tes notifikasi hanya tersedia untuk Admin." });
    }

    const hasil = await kirimPushKePengguna(req.user.id, {
      title: "Zaman Teknindo — Tes Notifikasi",
      body: "Web Push perangkat Admin berhasil menerima pesan tes.",
      tag: `admin-tes-${Date.now()}`,
      url: "/admin",
      renotify: true,
    });

    console.info("Tes Web Push Admin:", hasil);

    if (hasil.dinonaktifkan) {
      return res.status(503).json({ pesan: "Web Push belum aktif di server." });
    }

    if (hasil.terkirim < 1) {
      return res.status(404).json({ pesan: "Belum ada perangkat Admin yang terdaftar untuk menerima Web Push.", hasil });
    }

    return res.json({ pesan: "Notifikasi tes berhasil dikirim ke perangkat Admin.", hasil });
  } catch (error) {
    console.error("Tes Web Push Admin gagal:", error);
    return res.status(500).json({ pesan: "Tes notifikasi gagal dikirim." });
  }
}

module.exports = {
  infoPush,
  simpanSubscription,
  hapusSubscription,
  tesPushAdmin,
};
