const prisma = require("../utils/prismaClient");
const { deleteFotoAbsensiBatch } = require("../utils/supabaseStorage");

// Hapus akun karyawan tertentu berdasarkan ID.
// HANYA akun nonaktif yang boleh dihapus melalui endpoint ini.
// Penghapusan bersifat permanen dan ikut menghapus seluruh data turunan
// milik akun tersebut, termasuk foto yang tersimpan di bucket absensi.
async function hapusAkunKaryawan(req, res) {
  const id = Number(req.params.id);

  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ pesan: "ID karyawan tidak valid." });
  }

  try {
    const pengguna = await prisma.pengguna.findUnique({
      where: { id },
      select: {
        id: true,
        nama: true,
        email: true,
        peran: true,
        statusAkun: true,
      },
    });

    if (!pengguna) {
      return res.status(404).json({ pesan: "Akun karyawan tidak ditemukan." });
    }

    if (pengguna.peran !== "karyawan") {
      return res.status(400).json({
        pesan: "Hanya akun karyawan yang dapat dihapus melalui menu ini.",
      });
    }

    if (pengguna.statusAkun !== "nonaktif") {
      return res.status(400).json({
        pesan: "Akun harus dinonaktifkan terlebih dahulu sebelum dihapus permanen.",
      });
    }

    // Ambil path foto SEBELUM data database dihapus.
    const [absensi, izin] = await Promise.all([
      prisma.absensi.findMany({
        where: { penggunaId: id },
        select: { fotoMasuk: true, fotoPulang: true },
      }),
      prisma.pengajuanIzin.findMany({
        where: { penggunaId: id },
        select: { fotoSurat: true },
      }),
    ]);

    const fotoYangPerluDihapus = [
      ...absensi.flatMap((item) => [item.fotoMasuk, item.fotoPulang]),
      ...izin.map((item) => item.fotoSurat),
    ].filter(Boolean);

    // Hapus relasi database lebih dahulu dan pastikan transaksi berhasil.
    // Ini mencegah kondisi akun masih ada tetapi foto yang dirujuk database
    // sudah terhapus apabila transaksi database gagal.
    const hasil = await prisma.$transaction(async (tx) => {
      const jumlahLaporanGaji = await tx.laporanGaji.deleteMany({
        where: { penggunaId: id },
      });

      const jumlahGajiKaryawan = await tx.gajiKaryawan.deleteMany({
        where: { penggunaId: id },
      });

      const jumlahPengajuanSebagaiPengaju = await tx.pengajuanIzin.deleteMany({
        where: { penggunaId: id },
      });

      const jumlahPengajuanDiproses = await tx.pengajuanIzin.updateMany({
        where: { diprosesOleh: id },
        data: { diprosesOleh: null },
      });

      const jumlahAbsensiDiedit = await tx.absensi.updateMany({
        where: { dieditOleh: id },
        data: { dieditOleh: null, waktuEdit: null },
      });

      const jumlahAbsensi = await tx.absensi.deleteMany({
        where: { penggunaId: id },
      });

      const akun = await tx.pengguna.delete({
        where: { id },
      });

      return {
        akun,
        jumlahLaporanGaji: jumlahLaporanGaji.count,
        jumlahGajiKaryawan: jumlahGajiKaryawan.count,
        jumlahPengajuanSebagaiPengaju: jumlahPengajuanSebagaiPengaju.count,
        jumlahPengajuanDiproses: jumlahPengajuanDiproses.count,
        jumlahAbsensiDiedit: jumlahAbsensiDiedit.count,
        jumlahAbsensi: jumlahAbsensi.count,
      };
    });

    // Database sudah konsisten dan akun benar-benar terhapus.
    // Storage adalah layanan terpisah, jadi kegagalan cleanup tidak boleh
    // membatalkan hasil transaksi database yang sudah sukses. Jika gagal,
    // kirim peringatan agar admin bisa mengetahui ada file yatim yang perlu
    // dibersihkan, tetapi jangan mengembalikan status gagal palsu.
    let peringatanStorage = null;
    let jumlahFotoDihapus = 0;

    if (fotoYangPerluDihapus.length > 0) {
      try {
        const hasilStorage = await deleteFotoAbsensiBatch(fotoYangPerluDihapus);
        jumlahFotoDihapus = hasilStorage?.jumlahDihapus || 0;
      } catch (error) {
        peringatanStorage =
          "Akun berhasil dihapus, tetapi sebagian foto di Storage belum dapat dibersihkan. Coba cleanup Storage kembali.";
        console.error("Cleanup foto Storage setelah hapus akun gagal:", error);
      }
    }

    return res.json({
      pesan: `Akun ${hasil.akun.nama} (${hasil.akun.email}) berhasil dihapus permanen.`,
      data: {
        id: hasil.akun.id,
        nama: hasil.akun.nama,
        email: hasil.akun.email,
        jumlahFotoDihapus,
        jumlahFotoTerdata: fotoYangPerluDihapus.length,
        jumlahAbsensiDihapus: hasil.jumlahAbsensi,
        jumlahGajiDihapus: hasil.jumlahGajiKaryawan,
        jumlahLaporanGajiDihapus: hasil.jumlahLaporanGaji,
        jumlahPengajuanDihapus: hasil.jumlahPengajuanSebagaiPengaju,
      },
      ...(peringatanStorage ? { peringatan: peringatanStorage } : {}),
    });
  } catch (error) {
    console.error("Gagal menghapus akun karyawan:", error);

    return res.status(500).json({
      pesan:
        "Akun belum dihapus. Sistem gagal menghapus data terkait dengan aman. Coba lagi setelah memastikan koneksi database dan Storage normal.",
    });
  }
}

module.exports = { hapusAkunKaryawan };
