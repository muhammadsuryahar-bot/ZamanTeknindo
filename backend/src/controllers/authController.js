const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const prisma = require("../utils/prismaClient");
const { kirimPushKeSemuaAdmin } = require("../utils/pushNotification");

const DOMAIN_PERUSAHAAN = (
  process.env.ALLOWED_EMAIL_DOMAIN || "zamanteknindo.com"
).trim().toLowerCase().replace(/^@/, "");

const EMAIL_ADMIN = (
  process.env.ADMIN_EMAIL || "admin@gmail.com"
).trim().toLowerCase();

function emailKaryawanValid(email) {
  const emailBersih = String(email || "").trim().toLowerCase();
  const pola = new RegExp(`^[^\\s@]+@${DOMAIN_PERUSAHAAN.replace(/[.*+?^${}()|[\\]\\]/g, "\\$&")}$`);
  return pola.test(emailBersih);
}

function emailLoginDiizinkan(email) {
  const emailBersih = String(email || "").trim().toLowerCase();
  return emailBersih === EMAIL_ADMIN || emailKaryawanValid(emailBersih);
}

async function daftarAkun(req, res) {
  try {
    const { nama, email, kataSandi } = req.body;
    const emailBersih = String(email || "").trim().toLowerCase();
    if (!nama || !emailBersih || !kataSandi) return res.status(400).json({ pesan: "Nama, email, dan kata sandi wajib diisi." });
    if (!emailKaryawanValid(emailBersih)) return res.status(400).json({ pesan: `Pendaftaran karyawan hanya boleh menggunakan email @${DOMAIN_PERUSAHAAN}.` });
    if (kataSandi.length < 6) return res.status(400).json({ pesan: "Password minimal 6 karakter." });
    const sudahAda = await prisma.pengguna.findUnique({ where: { email: emailBersih } });
    if (sudahAda) return res.status(400).json({ pesan: "Email ini sudah terdaftar. Silakan login." });
    const kataSandiHash = await bcrypt.hash(kataSandi, 10);
    const penggunaBaru = await prisma.pengguna.create({ data: { nama: nama.trim(), email: emailBersih, kataSandi: kataSandiHash, peran: "karyawan", statusAkun: "menunggu_konfirmasi" } });

    try {
      const hasilPush = await kirimPushKeSemuaAdmin({
        title: "Zaman Teknindo — Akun Baru",
        body: `${penggunaBaru.nama} mendaftar dan menunggu konfirmasi Admin.`,
        tag: `admin-akun-${penggunaBaru.id}`,
        url: "/admin",
        renotify: true,
      });
      console.info("Push akun baru selesai:", hasilPush);
    } catch (error) {
      console.error("Push akun baru gagal:", error?.message || error);
    }

    return res.status(201).json({ pesan: "Pendaftaran berhasil! Akun Anda sedang menunggu konfirmasi dari Admin sebelum bisa digunakan.", data: { id: penggunaBaru.id, nama: penggunaBaru.nama, email: penggunaBaru.email } });
  } catch (error) { console.error(error); return res.status(500).json({ pesan: "Terjadi kesalahan pada server." }); }
}

async function login(req, res) {
  try {
    const { email, kataSandi, ingatSaya } = req.body;
    const emailBersih = String(email || "").trim().toLowerCase();
    if (!emailBersih || !kataSandi) return res.status(400).json({ pesan: "Email dan kata sandi wajib diisi." });
    if (!emailLoginDiizinkan(emailBersih)) return res.status(401).json({ pesan: "Gunakan email Admin atau email karyawan perusahaan yang terdaftar." });
    const pengguna = await prisma.pengguna.findUnique({ where: { email: emailBersih } });
    if (!pengguna) return res.status(400).json({ pesan: "Email atau kata sandi salah." });
    if (pengguna.peran === "admin" && emailBersih !== EMAIL_ADMIN) return res.status(403).json({ pesan: "Email Admin tidak diizinkan untuk akun ini." });
    if (pengguna.statusAkun === "menunggu_konfirmasi") return res.status(403).json({ pesan: "Akun Anda masih menunggu konfirmasi dari Admin. Silakan hubungi Admin/HR." });
    if (pengguna.statusAkun === "nonaktif") return res.status(403).json({ pesan: "Akun Anda sudah dinonaktifkan. Hubungi Admin." });
    const cocok = await bcrypt.compare(kataSandi, pengguna.kataSandi);
    if (!cocok) return res.status(400).json({ pesan: "Email atau kata sandi salah." });

    const durasiToken = ingatSaya === true ? "30d" : "8h";
    const token = jwt.sign({ id: pengguna.id, peran: pengguna.peran, nama: pengguna.nama }, process.env.JWT_SECRET, { expiresIn: durasiToken });

    return res.json({ pesan: "Login berhasil.", token, pengguna: { id: pengguna.id, nama: pengguna.nama, email: pengguna.email, peran: pengguna.peran, jabatan: pengguna.jabatan, divisi: pengguna.divisi } });
  } catch (error) { console.error(error); return res.status(500).json({ pesan: "Terjadi kesalahan pada server." }); }
}

async function gantiPassword(req, res) {
  try {
    const { passwordLama, passwordBaru } = req.body;
    const penggunaId = req.user.id;
    if (!passwordLama || !passwordBaru) return res.status(400).json({ pesan: "Password lama dan password baru wajib diisi." });
    if (passwordBaru.length < 6) return res.status(400).json({ pesan: "Password baru minimal 6 karakter." });
    const pengguna = await prisma.pengguna.findUnique({ where: { id: penggunaId } });
    if (!pengguna) return res.status(404).json({ pesan: "Akun tidak ditemukan." });
    const cocok = await bcrypt.compare(passwordLama, pengguna.kataSandi);
    if (!cocok) return res.status(400).json({ pesan: "Password lama yang Anda masukkan salah." });
    const passwordBaruHash = await bcrypt.hash(passwordBaru, 10);
    await prisma.pengguna.update({ where: { id: penggunaId }, data: { kataSandi: passwordBaruHash } });
    return res.json({ pesan: "Password berhasil diubah." });
  } catch (error) { console.error(error); return res.status(500).json({ pesan: "Terjadi kesalahan pada server." }); }
}

function sidikJariPassword(passwordHash) {
  return crypto.createHash("sha256").update(String(passwordHash)).digest("hex");
}

function setNoCacheAuth(res) {
  res.set({
    "Cache-Control": "no-store, no-cache, must-revalidate, private",
    Pragma: "no-cache",
    "Surrogate-Control": "no-store",
  });
}


async function statusPemulihanPassword(req, res) {
  setNoCacheAuth(res);
  // Permintaan pemulihan dicatat di sistem dan diteruskan ke Admin.
  // Pengiriman email eksternal tidak menjadi prasyarat.
  return res.json({ tersedia: true, metode: "verifikasi_admin" });
}

async function mintaResetPassword(req, res) {
  setNoCacheAuth(res);
  try {
    const emailBersih = String(req.body?.email || "").trim().toLowerCase();
    if (!emailBersih || !/^\S+@\S+\.\S+$/.test(emailBersih)) {
      return res.status(400).json({ pesan: "Masukkan alamat email yang valid." });
    }

    const pesanUmum =
      "Jika email terdaftar, permintaan pemulihan sudah diteruskan ke HR/Admin. Setelah identitas diverifikasi, tautan pemulihan akan diberikan agar Anda membuat password baru sendiri.";

    // Jangan membocorkan apakah suatu email terdaftar.
    if (!emailKaryawanValid(emailBersih)) {
      return res.json({ pesan: pesanUmum });
    }

    const pengguna = await prisma.pengguna.findUnique({
      where: { email: emailBersih },
      select: { id: true, nama: true, email: true, peran: true, statusAkun: true },
    });
    if (!pengguna || pengguna.peran !== "karyawan" || pengguna.statusAkun !== "aktif") {
      return res.json({ pesan: pesanUmum });
    }

    // Satu permintaan aktif per karyawan. Jika karyawan menekan tombol beberapa
    // kali, permintaan yang sama dipakai kembali agar Admin tidak menerima spam.
    let permintaan = await prisma.permintaanResetPassword.findFirst({
      where: {
        penggunaId: pengguna.id,
        status: { in: ["menunggu_verifikasi", "tautan_dibuat"] },
      },
      orderBy: { dibuatPada: "desc" },
      select: { id: true, status: true },
    });

    if (!permintaan) {
      try {
        permintaan = await prisma.permintaanResetPassword.create({
          data: { penggunaId: pengguna.id },
          select: { id: true, status: true },
        });
      } catch (error) {
        // Menangani dua request bersamaan yang bertemu pada unique partial index.
        if (error?.code !== "P2002") throw error;
        permintaan = await prisma.permintaanResetPassword.findFirst({
          where: {
            penggunaId: pengguna.id,
            status: { in: ["menunggu_verifikasi", "tautan_dibuat"] },
          },
          orderBy: { dibuatPada: "desc" },
          select: { id: true, status: true },
        });
        if (!permintaan) throw error;
      }
    }

    // Push adalah tambahan. Badge di dashboard Admin tetap mengambil data
    // dari tabel sehingga permintaan tidak hilang bila perangkat offline.
    try {
      const hasilPush = await kirimPushKeSemuaAdmin({
        title: "Zaman Teknindo — Permintaan Lupa Password",
        body: `${pengguna.nama} meminta bantuan pemulihan password.`,
        tag: `admin-reset-password-${permintaan.id}`,
        url: "/admin",
        renotify: true,
      });
      console.info("Push permintaan pemulihan password:", hasilPush);
    } catch (error) {
      console.error("Push permintaan pemulihan password gagal:", error?.message || error);
    }

    return res.json({ pesan: pesanUmum });
  } catch (error) {
    console.error("Gagal mencatat permintaan pemulihan password:", error?.message || error);
    return res.status(500).json({ pesan: "Permintaan pemulihan password gagal dicatat. Silakan coba lagi." });
  }
}

async function resetPasswordDenganToken(req, res) {
  setNoCacheAuth(res);
  try {
    const token = String(req.body?.token || "").trim();
    const passwordBaru = String(req.body?.passwordBaru || "");
    if (!token || !passwordBaru) {
      return res.status(400).json({ pesan: "Tautan pemulihan dan password baru wajib diisi." });
    }
    if (passwordBaru.length < 6) {
      return res.status(400).json({ pesan: "Password baru minimal 6 karakter." });
    }

    let dataToken;
    try {
      dataToken = jwt.verify(token, process.env.JWT_SECRET);
    } catch {
      return res.status(400).json({ pesan: "Tautan pemulihan tidak valid atau sudah kedaluwarsa. Minta tautan baru." });
    }

    if (
      dataToken?.purpose !== "password_reset" ||
      !Number.isInteger(Number(dataToken?.id)) ||
      typeof dataToken?.ver !== "string"
    ) {
      return res.status(400).json({ pesan: "Tautan pemulihan tidak valid. Minta tautan baru." });
    }

    const pengguna = await prisma.pengguna.findUnique({
      where: { id: Number(dataToken.id) },
      select: { id: true, kataSandi: true, statusAkun: true },
    });
    if (
      !pengguna ||
      pengguna.statusAkun !== "aktif" ||
      sidikJariPassword(pengguna.kataSandi) !== dataToken.ver
    ) {
      return res.status(400).json({ pesan: "Tautan pemulihan sudah digunakan atau tidak lagi berlaku. Minta tautan baru." });
    }

    let permintaanReset = null;
    if (dataToken.requestId !== undefined) {
      const requestId = Number(dataToken.requestId);
      if (!Number.isInteger(requestId) || typeof dataToken.jti !== "string") {
        return res.status(400).json({ pesan: "Tautan pemulihan tidak valid. Minta tautan baru kepada HR/Admin." });
      }
      permintaanReset = await prisma.permintaanResetPassword.findUnique({
        where: { id: requestId },
        select: { id: true, penggunaId: true, status: true, tokenJti: true },
      });
      if (
        !permintaanReset ||
        permintaanReset.penggunaId !== pengguna.id ||
        permintaanReset.status !== "tautan_dibuat" ||
        permintaanReset.tokenJti !== dataToken.jti
      ) {
        return res.status(400).json({ pesan: "Tautan pemulihan sudah tidak berlaku. Hubungi HR/Admin untuk meminta tautan baru." });
      }
    }

    const passwordHashBaru = await bcrypt.hash(passwordBaru, 10);
    // Perubahan password dan penutupan permintaan dilakukan dalam satu transaksi.
    // Token admin wajib cocok dengan JTI terakhir agar tautan lama gugur saat diterbitkan ulang.
    const berhasil = await prisma.$transaction(async (tx) => {
      const hasilUpdate = await tx.pengguna.updateMany({
        where: {
          id: pengguna.id,
          kataSandi: pengguna.kataSandi,
          statusAkun: "aktif",
        },
        data: { kataSandi: passwordHashBaru },
      });
      if (hasilUpdate.count !== 1) return false;

      if (permintaanReset) {
        const selesai = await tx.permintaanResetPassword.updateMany({
          where: {
            id: permintaanReset.id,
            penggunaId: pengguna.id,
            status: "tautan_dibuat",
            tokenJti: dataToken.jti,
          },
          data: {
            status: "selesai",
            selesaiPada: new Date(),
            tokenJti: null,
          },
        });
        if (selesai.count !== 1) {
          throw new Error("Permintaan pemulihan sudah berubah atau tautan bukan yang terbaru.");
        }
      }
      return true;
    });
    if (!berhasil) {
      return res.status(400).json({ pesan: "Tautan pemulihan sudah digunakan. Minta tautan baru kepada HR/Admin." });
    }

    return res.json({ pesan: "Password berhasil diperbarui. Silakan login menggunakan password baru." });
  } catch (error) {
    console.error("Gagal mengatur password baru:", error?.message || error);
    return res.status(500).json({ pesan: "Password baru gagal disimpan. Silakan coba lagi." });
  }
}

module.exports = { daftarAkun, login, gantiPassword, statusPemulihanPassword, mintaResetPassword, resetPasswordDenganToken };
