  const jwt = require("jsonwebtoken");
  const prisma = require("../utils/prismaClient");

  // Middleware ini mengecek apakah user sudah login (punya token yang valid)
  //
  // PENTING: selain verifikasi token, di sini kita SENGAJA query ulang ke
  // database untuk cek statusAkun terkini. Kalau cuma percaya isi token,
  // karyawan yang baru saja di-nonaktifkan admin masih bisa tetap pakai
  // sistem (absen, ajukan izin, dll) sampai token-nya kedaluwarsa sendiri
  // (bisa sampai 8 jam). Dengan re-cek ini, begitu admin klik "Nonaktifkan",
  // request berikutnya dari karyawan itu langsung ditolak -- tidak perlu
  // nunggu token habis.
  async function cekLogin(req, res, next) {
    const authHeader = req.headers.authorization; // formatnya: "Bearer TOKEN_DISINI"

    if (!authHeader) {
      return res.status(401).json({ pesan: "Anda belum login. Silakan login terlebih dahulu." });
    }

    const token = authHeader.split(" ")[1];

    try {
      const dataToken = jwt.verify(token, process.env.JWT_SECRET);

      const pengguna = await prisma.pengguna.findUnique({
        where: { id: dataToken.id },
        select: { id: true, nama: true, peran: true, statusAkun: true },
      });

      if (!pengguna) {
        return res.status(401).json({ pesan: "Akun tidak ditemukan. Silakan login ulang." });
      }

      if (pengguna.statusAkun === "nonaktif") {
        return res.status(403).json({ pesan: "Akun Anda telah dinonaktifkan. Hubungi Admin." });
      }

      if (pengguna.statusAkun === "menunggu_konfirmasi") {
        return res.status(403).json({ pesan: "Akun Anda masih menunggu konfirmasi Admin." });
      }

      // Simpan data TERKINI dari database (bukan dari isi token yang bisa basi)
      // supaya bisa dipakai di controller
      req.user = { id: pengguna.id, nama: pengguna.nama, peran: pengguna.peran };
      next();
    } catch (error) {
      return res.status(401).json({ pesan: "Sesi login tidak valid atau sudah kedaluwarsa." });
    }
  }

  // Middleware ini mengecek apakah yang login adalah Admin
  function cekAdmin(req, res, next) {
    if (req.user.peran !== "admin") {
      return res.status(403).json({ pesan: "Hanya Admin yang boleh mengakses fitur ini." });
    }
    next();
  }

  module.exports = { cekLogin, cekAdmin };
