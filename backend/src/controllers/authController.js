const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const prisma = require("../utils/prismaClient");

const DOMAIN_PERUSAHAAN = (
  process.env.ALLOWED_EMAIL_DOMAIN || "zamanteknindo.com"
)
  .trim()
  .toLowerCase()
  .replace(/^@/, "");

const EMAIL_ADMIN = "admin@gmail.com";

function emailKaryawanValid(email) {
  const emailBersih = String(email || "").trim().toLowerCase();
  const pola = new RegExp(
    `^[^\\s@]+@${DOMAIN_PERUSAHAAN.replace(/[.*+?^${}()|[\\]\\]/g, "\\$&")}$`
  );
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
    const token = jwt.sign(
      { id: pengguna.id, peran: pengguna.peran, nama: pengguna.nama },
      process.env.JWT_SECRET,
      { expiresIn: durasiToken },
    );

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
  for (let i = 0; i < 8; i++) hasil += karakter[crypto.randomInt(0, karakter.length)];
  return hasil;
}

async function resetPasswordOlehAdmin(req, res) {
  try {
    const { id } = req.params;
    const pengguna = await prisma.pengguna.findUnique({ where: { id: parseInt(id) } });
    if (!pengguna) return res.status(404).json({ pesan: "Akun tidak ditemukan." });
    const passwordBaru = buatPasswordSementara();
    const passwordBaruHash = await bcrypt.hash(passwordBaru, 10);
    await prisma.pengguna.update({ where: { id: parseInt(id) }, data: { kataSandi: passwordBaruHash } });
    return res.json({ pesan: `Password ${pengguna.nama} berhasil direset. Sampaikan password sementara ini secara manual (WA/telepon), lalu minta karyawan segera menggantinya lewat menu "Ganti Password".`, passwordSementara: passwordBaru });
  } catch (error) { console.error(error); return res.status(500).json({ pesan: "Terjadi kesalahan pada server." }); }
}

module.exports = { daftarAkun, login, gantiPassword, resetPasswordOlehAdmin };
