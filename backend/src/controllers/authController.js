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
    const token = jwt.sign({ id: pengguna.id, peran: pengguna.peran, nama: pengguna.nama, versiSesi: pengguna.versiSesi ?? 0 }, process.env.JWT_SECRET, { expiresIn: durasiToken });

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
    await prisma.pengguna.update({ where: { id: penggunaId }, data: { kataSandi: passwordBaruHash, versiSesi: { increment: 1 }, passwordResetTokenHash: null, passwordResetTokenExpiresAt: null, passwordResetRequestedAt: null } });
    return res.json({ pesan: "Password berhasil diubah." });
  } catch (error) { console.error(error); return res.status(500).json({ pesan: "Terjadi kesalahan pada server." }); }
}


const MASA_BERLAKU_RESET_PASSWORD_MS = 30 * 60 * 1000;
const JEDA_EMAIL_RESET_PASSWORD_MS = 60 * 1000;
const PESAN_RESET_PASSWORD =
  "Jika email terdaftar, instruksi reset akan dikirim bila layanan email tersedia. Periksa kotak masuk/spam; jika tidak diterima dalam 10 menit, hubungi Admin.";

function resetEmailTerkonfigurasi() {
  return Boolean(
    String(process.env.RESEND_API_KEY || "").trim() &&
      String(process.env.RESET_PASSWORD_FROM || "").trim(),
  );
}

function escapeHtml(nilai) {
  return String(nilai || "").replace(/[&<>"']/g, (karakter) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[karakter]);
}

function buatUrlResetPassword(token) {
  const nilaiOrigin = String(
    process.env.FRONTEND_URL ||
      process.env.VERCEL_PROJECT_PRODUCTION_URL ||
      "https://zaman-teknindo.vercel.app",
  ).split(",")[0].trim();
  const urlAwal = /^[a-z][a-z\d+.-]*:\/\//i.test(nilaiOrigin)
    ? nilaiOrigin
    : "https://" + nilaiOrigin;
  const url = new URL(urlAwal);
  if (process.env.NODE_ENV === "production" && url.protocol !== "https:") {
    throw new Error("URL frontend reset password wajib memakai HTTPS di production.");
  }
  return url.origin + "/login#resetToken=" + encodeURIComponent(token);
}

async function kirimEmailResetPassword({ email, nama, token }) {
  const apiKey = String(process.env.RESEND_API_KEY || "").trim();
  const pengirim = String(process.env.RESET_PASSWORD_FROM || "").trim();
  if (!apiKey || !pengirim) {
    const error = new Error("Layanan email reset password belum dikonfigurasi.");
    error.code = "RESET_EMAIL_NOT_CONFIGURED";
    throw error;
  }
  if (typeof fetch !== "function") {
    const error = new Error("Runtime tidak menyediakan fetch untuk mengirim email.");
    error.code = "RESET_EMAIL_FETCH_UNAVAILABLE";
    throw error;
  }

  const linkReset = buatUrlResetPassword(token);
  const namaAman = escapeHtml(nama);
  const pengendali = new AbortController();
  const batasWaktu = setTimeout(() => pengendali.abort(), 10000);

  try {
    const respons = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: "Bearer " + apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: pengirim,
        to: [email],
        subject: "Atur ulang password — PT. Zaman Teknindo",
        text:
          "Halo " + nama + ",\n\n" +
          "Kami menerima permintaan untuk mengatur ulang password akun Zaman Teknindo. " +
          "Buka tautan berikut dalam 30 menit: " + linkReset + "\n\n" +
          "Tautan hanya dapat digunakan sekali. Jika Anda tidak meminta reset, abaikan email ini.",
        html:
          '<div style="font-family:Arial,sans-serif;line-height:1.6;color:#1f2937;max-width:560px;margin:auto">' +
          '<h2 style="color:#14784a">Atur Ulang Password</h2>' +
          "<p>Halo " + namaAman + ",</p>" +
          "<p>Kami menerima permintaan untuk mengatur ulang password akun Zaman Teknindo.</p>" +
          '<p><a href="' + escapeHtml(linkReset) + '" style="display:inline-block;padding:12px 18px;background:#14784a;color:#fff;text-decoration:none;border-radius:8px;font-weight:bold">Buat Password Baru</a></p>' +
          "<p>Tautan berlaku selama 30 menit dan hanya dapat digunakan sekali.</p>" +
          "<p>Jika Anda tidak meminta reset password, abaikan email ini. Password Anda tidak akan berubah jika tautan tidak digunakan.</p>" +
          "<p>Salam,<br>PT. Zaman Teknindo</p></div>",
      }),
      signal: pengendali.signal,
    });

    if (!respons.ok) {
      const error = new Error("Penyedia email menolak permintaan reset password.");
      error.code = "RESET_EMAIL_PROVIDER_" + respons.status;
      throw error;
    }
  } finally {
    clearTimeout(batasWaktu);
  }
}

async function mintaResetPassword(req, res) {
  try {
    const email = String(req.body?.email || "").trim().toLowerCase();
    if (
      !email ||
      email.length > 254 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
    ) {
      return res.status(400).json({ pesan: "Masukkan alamat email yang valid." });
    }

    // Jangan memberi tahu apakah akun ada jika layanan email belum siap.
    if (!resetEmailTerkonfigurasi()) {
      return res.status(503).json({
        pesan: "Fitur reset password belum aktif karena layanan email belum dikonfigurasi. Hubungi Admin sementara.",
      });
    }

    const pengguna = await prisma.pengguna.findUnique({ where: { email } });
    if (!pengguna) {
      return res.json({ pesan: PESAN_RESET_PASSWORD });
    }

    const token = crypto.randomBytes(32).toString("hex");
    const hashToken = crypto.createHash("sha256").update(token).digest("hex");
    const sekarang = new Date();
    const bolehMintaLagiSetelah = new Date(
      sekarang.getTime() - JEDA_EMAIL_RESET_PASSWORD_MS,
    );

    // Cooldown disimpan per akun. Token mentah tidak disimpan di database.
    const klaim = await prisma.pengguna.updateMany({
      where: {
        id: pengguna.id,
        OR: [
          { passwordResetRequestedAt: null },
          { passwordResetRequestedAt: { lt: bolehMintaLagiSetelah } },
        ],
      },
      data: {
        passwordResetTokenHash: hashToken,
        passwordResetTokenExpiresAt: new Date(
          sekarang.getTime() + MASA_BERLAKU_RESET_PASSWORD_MS,
        ),
        passwordResetRequestedAt: sekarang,
      },
    });

    if (klaim.count !== 1) {
      return res.json({ pesan: PESAN_RESET_PASSWORD });
    }

    try {
      await kirimEmailResetPassword({
        email: pengguna.email,
        nama: pengguna.nama,
        token,
      });
    } catch (errorEmail) {
      await prisma.pengguna.updateMany({
        where: { id: pengguna.id, passwordResetTokenHash: hashToken },
        data: {
          passwordResetTokenHash: null,
          passwordResetTokenExpiresAt: null,
          passwordResetRequestedAt: null,
        },
      }).catch(() => {});
      console.error(
        "Pengiriman email reset password gagal:",
        errorEmail?.code || errorEmail?.message || "Kesalahan penyedia email",
      );
      // Respons tetap generik untuk menghindari kebocoran apakah email terdaftar.
      return res.json({ pesan: PESAN_RESET_PASSWORD });
    }

    return res.json({ pesan: PESAN_RESET_PASSWORD });
  } catch (error) {
    console.error("Permintaan reset password gagal:", error?.message || error);
    return res.status(500).json({
      pesan: "Permintaan reset password belum dapat diproses. Coba lagi nanti.",
    });
  }
}

async function resetPasswordDenganToken(req, res) {
  try {
    const token = String(req.body?.token || "").trim();
    const passwordBaru = typeof req.body?.passwordBaru === "string"
      ? req.body.passwordBaru
      : "";

    if (!/^[a-f0-9]{64}$/i.test(token)) {
      return res.status(400).json({
        pesan: "Tautan reset tidak valid atau sudah kedaluwarsa. Minta tautan baru.",
      });
    }
    if (passwordBaru.length < 8) {
      return res.status(400).json({ pesan: "Password baru minimal 8 karakter." });
    }
    if (passwordBaru.length > 64 || Buffer.byteLength(passwordBaru, "utf8") > 72) {
      return res.status(400).json({ pesan: "Password baru maksimal 64 karakter." });
    }

    const hashToken = crypto.createHash("sha256").update(token).digest("hex");
    const sekarang = new Date();
    const pengguna = await prisma.pengguna.findFirst({
      where: {
        passwordResetTokenHash: hashToken,
        passwordResetTokenExpiresAt: { gt: sekarang },
      },
      select: { id: true },
    });

    if (!pengguna) {
      return res.status(400).json({
        pesan: "Tautan reset tidak valid atau sudah kedaluwarsa. Minta tautan baru.",
      });
    }

    const passwordHashBaru = await bcrypt.hash(passwordBaru, 10);
    // Syarat token dan expiry diperiksa kembali ketika menulis agar link sekali pakai.
    const diperbarui = await prisma.pengguna.updateMany({
      where: {
        id: pengguna.id,
        passwordResetTokenHash: hashToken,
        passwordResetTokenExpiresAt: { gt: sekarang },
      },
      data: {
        kataSandi: passwordHashBaru,
        versiSesi: { increment: 1 },
        passwordResetTokenHash: null,
        passwordResetTokenExpiresAt: null,
        passwordResetRequestedAt: null,
      },
    });

    if (diperbarui.count !== 1) {
      return res.status(400).json({
        pesan: "Tautan reset tidak valid atau sudah kedaluwarsa. Minta tautan baru.",
      });
    }

    return res.json({
      pesan: "Password berhasil diperbarui. Silakan masuk menggunakan password baru.",
    });
  } catch (error) {
    console.error("Reset password dengan token gagal:", error?.message || error);
    return res.status(500).json({
      pesan: "Password belum berhasil diperbarui. Coba lagi nanti.",
    });
  }
}

function buatPasswordSementara() {
  const karakter = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  let hasil = "";
  for (let i = 0; i < 8; i++) hasil += karakter[crypto.randomInt(0, karakter.length)];
  return hasil;
}

async function resetPasswordOlehAdmin(req, res) {
  try {
    const { id } = req.params;
    const penggunaId = Number(id);
    if (!Number.isInteger(penggunaId) || penggunaId <= 0) return res.status(400).json({ pesan: "ID karyawan tidak valid." });

    const pengguna = await prisma.pengguna.findUnique({ where: { id: penggunaId } });
    if (!pengguna) return res.status(404).json({ pesan: "Akun tidak ditemukan." });

    if (pengguna.peran !== "karyawan") {
      return res.status(403).json({ pesan: "Password hanya dapat direset dari menu karyawan." });
    }

    const passwordSementara = buatPasswordSementara();
    const passwordBaruHash = await bcrypt.hash(passwordSementara, 10);
    await prisma.pengguna.update({ where: { id: penggunaId }, data: { kataSandi: passwordBaruHash, versiSesi: { increment: 1 }, passwordResetTokenHash: null, passwordResetTokenExpiresAt: null, passwordResetRequestedAt: null } });

    // Password sementara dikirim sekali ke Admin untuk disampaikan ke karyawan.
    // Jangan izinkan browser/CDN/cache menyimpan response sensitif ini.
    res.set({
      "Cache-Control": "no-store, no-cache, must-revalidate, private",
      Pragma: "no-cache",
      "Surrogate-Control": "no-store",
    });

    return res.json({
      pesan: `Password ${pengguna.nama} berhasil direset. Password sementara hanya ditampilkan sekali; sampaikan melalui WA/telepon dan minta karyawan segera menggantinya lewat menu "Ganti Password".`,
      passwordSementara,
    });
  } catch (error) { console.error(error); return res.status(500).json({ pesan: "Terjadi kesalahan pada server." }); }
}

module.exports = { daftarAkun, login, gantiPassword, mintaResetPassword, resetPasswordDenganToken, resetPasswordOlehAdmin };
