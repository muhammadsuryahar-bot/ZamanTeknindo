const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const prisma = require("../utils/prismaClient");

function sidikJariPassword(passwordHash) {
  return crypto.createHash("sha256").update(String(passwordHash)).digest("hex");
}

function setNoCache(res) {
  res.set({
    "Cache-Control": "no-store, no-cache, must-revalidate, private",
    Pragma: "no-cache",
    "Surrogate-Control": "no-store",
  });
}

async function daftarPermintaanResetPassword(req, res) {
  setNoCache(res);
  try {
    const data = await prisma.permintaanResetPassword.findMany({
      take: 100,
      orderBy: { dibuatPada: "desc" },
      select: {
        id: true,
        status: true,
        dibuatPada: true,
        tautanDibuatPada: true,
        selesaiPada: true,
        pengguna: {
          select: { id: true, nama: true, email: true, statusAkun: true },
        },
      },
    });
    return res.json({ data });
  } catch (error) {
    console.error("Gagal memuat permintaan pemulihan password:", error?.message || error);
    return res.status(500).json({ pesan: "Daftar permintaan pemulihan password gagal dimuat." });
  }
}

async function buatTautanPemulihanAdmin(req, res) {
  setNoCache(res);
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ pesan: "ID permintaan tidak valid." });
    }
    if (!process.env.JWT_SECRET) {
      return res.status(503).json({ pesan: "Layanan pemulihan belum siap. Hubungi pengelola sistem." });
    }

    const permintaan = await prisma.permintaanResetPassword.findUnique({
      where: { id },
      select: {
        id: true,
        penggunaId: true,
        status: true,
        pengguna: {
          select: { id: true, nama: true, email: true, peran: true, statusAkun: true, kataSandi: true },
        },
      },
    });
    if (!permintaan || !permintaan.pengguna || permintaan.pengguna.peran !== "karyawan") {
      return res.status(404).json({ pesan: "Permintaan atau akun karyawan tidak ditemukan." });
    }
    if (!["menunggu_verifikasi", "tautan_dibuat"].includes(permintaan.status)) {
      return res.status(409).json({ pesan: "Permintaan ini sudah selesai atau tidak dapat diproses." });
    }
    if (permintaan.pengguna.statusAkun !== "aktif") {
      return res.status(409).json({ pesan: "Akun karyawan tidak aktif. Verifikasi status akun sebelum pemulihan." });
    }

    const tokenJti = crypto.randomUUID();
    const token = jwt.sign({
      id: permintaan.pengguna.id,
      purpose: "password_reset",
      ver: sidikJariPassword(permintaan.pengguna.kataSandi),
      requestId: permintaan.id,
    }, process.env.JWT_SECRET, { expiresIn: "20m", jwtid: tokenJti });

    const baseUrl = String(
      process.env.RESET_PASSWORD_URL || "https://zaman-teknindo.vercel.app",
    ).trim();
    const urlDasar = new URL(baseUrl);
    if (!["http:", "https:"].includes(urlDasar.protocol)) {
      return res.status(500).json({ pesan: "Alamat halaman pemulihan tidak valid." });
    }
    const tautan = new URL("/reset-password", urlDasar);
    tautan.searchParams.set("token", token);

    await prisma.permintaanResetPassword.update({
      where: { id: permintaan.id },
      data: {
        status: "tautan_dibuat",
        tautanDibuatPada: new Date(),
        tokenJti,
        ditanganiOleh: req.user.id,
      },
    });

    return res.json({
      pesan: "Tautan pemulihan berhasil dibuat. Bagikan tautan ini secara pribadi kepada karyawan setelah identitasnya diverifikasi.",
      data: {
        tautan: tautan.toString(),
        namaKaryawan: permintaan.pengguna.nama,
        emailKaryawan: permintaan.pengguna.email,
        kedaluwarsaMenit: 20,
      },
    });
  } catch (error) {
    console.error("Gagal membuat tautan pemulihan:", error?.message || error);
    return res.status(500).json({ pesan: "Tautan pemulihan gagal dibuat." });
  }
}

module.exports = { daftarPermintaanResetPassword, buatTautanPemulihanAdmin };
