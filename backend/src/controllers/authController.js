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

function buatPasswordSementara() {
  const karakter = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  let hasil = "";
  for (let i = 0; i < 12; i++) hasil += karakter[crypto.randomInt(0, karakter.length)];
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
    await prisma.pengguna.update({ where: { id: penggunaId }, data: { kataSandi: passwordBaruHash } });

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

function escapeHtml(value) {
  return String(value || "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[character]);
}

async function mintaResetPassword(req, res) {
  setNoCacheAuth(res);
  try {
    const emailBersih = String(req.body?.email || "").trim().toLowerCase();
    if (!emailBersih || !/^\S+@\S+\.\S+$/.test(emailBersih)) {
      return res.status(400).json({ pesan: "Masukkan alamat email yang valid." });
    }

    // Tanpa kredensial pengirim, jangan membuat token reset yang tidak dapat dikirim.
    if (!process.env.RESEND_API_KEY || !process.env.RESET_PASSWORD_FROM_EMAIL) {
      return res.status(503).json({
        pesan: "Layanan pemulihan password belum dikonfigurasi. Hubungi Admin/HR untuk reset sementara.",
      });
    }

    const pesanUmum = "Jika email terdaftar dan akun aktif, tautan pemulihan password akan dikirim. Periksa kotak masuk atau folder spam.";
    if (!emailLoginDiizinkan(emailBersih)) return res.json({ pesan: pesanUmum });

    const pengguna = await prisma.pengguna.findUnique({
      where: { email: emailBersih },
      select: { id: true, nama: true, email: true, kataSandi: true, statusAkun: true },
    });
    if (!pengguna || pengguna.statusAkun !== "aktif") return res.json({ pesan: pesanUmum });

    const token = jwt.sign(
      {
        id: pengguna.id,
        purpose: "password_reset",
        ver: sidikJariPassword(pengguna.kataSandi),
      },
      process.env.JWT_SECRET,
      { expiresIn: "20m", jwtid: crypto.randomUUID() },
    );

    const baseUrl = String(
      process.env.RESET_PASSWORD_URL || "https://zaman-teknindo.vercel.app",
    ).trim();
    const resetUrl = new URL("/reset-password", baseUrl);
    resetUrl.searchParams.set("token", token);

    const namaAman = escapeHtml(pengguna.nama);
    const linkAman = escapeHtml(resetUrl.toString());
    const bodyEmail = {
      from: process.env.RESET_PASSWORD_FROM_EMAIL,
      to: [pengguna.email],
      subject: "Pemulihan Password — Absensi Zaman Teknindo",
      html: `
        <div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;color:#243247;line-height:1.6">
          <h2 style="color:#1f3864">Pemulihan Password</h2>
          <p>Halo ${namaAman},</p>
          <p>Kami menerima permintaan untuk mengatur ulang password akun Absensi Zaman Teknindo.</p>
          <p><a href="${linkAman}" style="display:inline-block;padding:12px 18px;background:#1f8f5f;color:#fff;text-decoration:none;border-radius:8px">Atur Password Baru</a></p>
          <p>Tautan hanya berlaku selama 20 menit dan hanya dapat digunakan sekali. Abaikan email ini jika Anda tidak meminta pemulihan password.</p>
          <p style="font-size:12px;color:#64748b">Jangan bagikan tautan ini kepada siapa pun.</p>
        </div>`,
      text: `Halo ${pengguna.nama}, gunakan tautan berikut untuk mengatur ulang password Absensi Zaman Teknindo (berlaku 20 menit dan sekali pakai): ${resetUrl.toString()} . Abaikan email ini jika Anda tidak meminta pemulihan password.`,
    };

    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(bodyEmail),
    });
    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      console.error("Pengiriman email pemulihan gagal:", response.status, detail.slice(0, 300));
      return res.status(502).json({ pesan: "Email pemulihan belum berhasil dikirim. Coba lagi atau hubungi Admin." });
    }

    return res.json({ pesan: pesanUmum });
  } catch (error) {
    console.error("Gagal meminta reset password:", error?.message || error);
    return res.status(500).json({ pesan: "Permintaan pemulihan password gagal diproses." });
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

    const passwordHashBaru = await bcrypt.hash(passwordBaru, 10);
    await prisma.pengguna.update({
      where: { id: pengguna.id },
      data: { kataSandi: passwordHashBaru },
    });

    return res.json({ pesan: "Password berhasil diperbarui. Silakan login menggunakan password baru." });
  } catch (error) {
    console.error("Gagal mengatur password baru:", error?.message || error);
    return res.status(500).json({ pesan: "Password baru gagal disimpan. Silakan coba lagi." });
  }
}

module.exports = { daftarAkun, login, gantiPassword, resetPasswordOlehAdmin, mintaResetPassword, resetPasswordDenganToken };
