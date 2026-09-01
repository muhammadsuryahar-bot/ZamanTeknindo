const prisma = require("../utils/prismaClient");

const DOMAIN_PERUSAHAAN = (process.env.ALLOWED_EMAIL_DOMAIN || "zamanteknindo.com")
  .trim()
  .toLowerCase()
  .replace(/^@/, "");

function emailValid(email) {
  const pola = new RegExp(`^[^\\s@]+@${DOMAIN_PERUSAHAAN.replace(/[.*+?^${}()|[\\]\\]/g, "\\$&")}$`);
  return pola.test(email);
}

async function ubahProfilKaryawan(req, res) {
  try {
    const id = Number.parseInt(req.params.id, 10);
    const email = String(req.body?.email || "").trim().toLowerCase();
    const jabatan = String(req.body?.jabatan || "").trim();
    const divisi = String(req.body?.divisi || "").trim();

    if (!Number.isInteger(id)) return res.status(400).json({ pesan: "ID karyawan tidak valid." });
    if (!emailValid(email)) return res.status(400).json({ pesan: `Email karyawan harus menggunakan email @${DOMAIN_PERUSAHAAN}.` });
    if (!jabatan) return res.status(400).json({ pesan: "Jabatan wajib diisi." });

    const pengguna = await prisma.pengguna.findUnique({
      where: { id },
      select: { id: true, nama: true, email: true, peran: true },
    });

    if (!pengguna || pengguna.peran !== "karyawan") {
      return res.status(404).json({ pesan: "Karyawan tidak ditemukan." });
    }

    if (email !== pengguna.email) {
      const emailDipakai = await prisma.pengguna.findUnique({
        where: { email },
        select: { id: true },
      });
      if (emailDipakai && emailDipakai.id !== id) {
        return res.status(409).json({ pesan: "Email tersebut sudah digunakan oleh akun lain." });
      }
    }

    const data = await prisma.pengguna.update({
      where: { id },
      data: {
        email,
        jabatan,
        divisi: divisi || null,
      },
      select: { id: true, nama: true, email: true, jabatan: true, divisi: true, statusAkun: true },
    });

    return res.json({ pesan: `Data ${data.nama} berhasil diperbarui.`, data });
  } catch (error) {
    console.error("Gagal mengubah profil karyawan:", error);
    if (error?.code === "P2002") return res.status(409).json({ pesan: "Email tersebut sudah digunakan oleh akun lain." });
    return res.status(500).json({ pesan: "Terjadi kesalahan pada server." });
  }
}

module.exports = { ubahProfilKaryawan };
