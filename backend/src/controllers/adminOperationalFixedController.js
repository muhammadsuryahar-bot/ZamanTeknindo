const prisma = require("../utils/prismaClient");
const {
  tanggalHariIniWIB,
  JAM_MASUK_STANDAR_DEFAULT,
  statusEfektif,
} = require("../utils/waktuIndonesia");

function tanggalKeHariIniDanRentang() {
  const hariIni = tanggalHariIniWIB();
  const tujuhHariLalu = new Date(hariIni);
  tujuhHariLalu.setUTCDate(tujuhHariLalu.getUTCDate() - 6);
  const tigaPuluhHariLalu = new Date(hariIni);
  tigaPuluhHariLalu.setUTCDate(tigaPuluhHariLalu.getUTCDate() - 29);
  return { hariIni, tujuhHariLalu, tigaPuluhHariLalu };
}

async function ambilPengaturanAman() {
  const pengaturan = await prisma.pengaturanPotongan.findUnique({
    where: { id: 1 },
  });

  return (
    pengaturan || {
      id: 1,
      potonganTelat: 10000,
      potonganAlpha: 15000,
      jamMasukStandar: JAM_MASUK_STANDAR_DEFAULT,
    }
  );
}

async function ringkasanDashboardFixed(req, res) {
  try {
    const { hariIni, tujuhHariLalu, tigaPuluhHariLalu } =
      tanggalKeHariIniDanRentang();

    // Baca secara berurutan karena production menggunakan transaction pooler
    // dengan connection_limit kecil. Tidak ada Promise.all di jalur ini.
    const absensi7Hari = await prisma.absensi.findMany({
      where: {
        tanggal: {
          gte: tujuhHariLalu,
          lte: hariIni,
        },
      },
      select: {
        tanggal: true,
        jamMasuk: true,
        statusOtomatis: true,
        statusFinal: true,
        dieditOleh: true,
      },
    });

    const pengaturan = await ambilPengaturanAman();
    const jamMasukStandar =
      pengaturan.jamMasukStandar || JAM_MASUK_STANDAR_DEFAULT;

    const trenPerTanggal = {};
    for (let i = 0; i < 7; i += 1) {
      const tanggal = new Date(tujuhHariLalu);
      tanggal.setUTCDate(tanggal.getUTCDate() + i);
      const key = tanggal.toISOString().slice(0, 10);
      trenPerTanggal[key] = {
        tanggal: key,
        tepatWaktu: 0,
        telat: 0,
        alpha: 0,
        izinDll: 0,
      };
    }

    for (const absensi of absensi7Hari) {
      const key = absensi.tanggal.toISOString().slice(0, 10);
      if (!trenPerTanggal[key]) continue;

      const status = statusEfektif(absensi, jamMasukStandar);
      if (status === "tepat_waktu") trenPerTanggal[key].tepatWaktu += 1;
      else if (status === "telat") trenPerTanggal[key].telat += 1;
      else if (status === "alpha") trenPerTanggal[key].alpha += 1;
      else trenPerTanggal[key].izinDll += 1;
    }

    const absensiBulanan = await prisma.absensi.findMany({
      where: {
        tanggal: {
          gte: tigaPuluhHariLalu,
          lte: hariIni,
        },
      },
      select: {
        jamMasuk: true,
        statusOtomatis: true,
        statusFinal: true,
        dieditOleh: true,
        pengguna: {
          select: { id: true, nama: true },
        },
      },
    });

    const rekapPerKaryawan = {};
    for (const absensi of absensiBulanan) {
      const status = statusEfektif(absensi, jamMasukStandar);
      if (status !== "telat" && status !== "alpha") continue;

      const id = absensi.pengguna.id;
      if (!rekapPerKaryawan[id]) {
        rekapPerKaryawan[id] = {
          id,
          nama: absensi.pengguna.nama,
          telat: 0,
          alpha: 0,
        };
      }
      rekapPerKaryawan[id][status] += 1;
    }

    const sorotanKaryawan = Object.values(rekapPerKaryawan)
      .sort((a, b) => b.telat + b.alpha - (a.telat + a.alpha))
      .slice(0, 5);

    return res.json({
      data: {
        tren7Hari: Object.values(trenPerTanggal),
        sorotanKaryawan,
      },
    });
  } catch (error) {
    console.error("Gagal memuat ringkasan dashboard:", error);
    return res.status(500).json({
      pesan: "Gagal memuat tren & analisis.",
    });
  }
}

async function notifikasiAdminFixed(req, res) {
  try {
    const jumlahAkunBaru = await prisma.pengguna.count({
      where: {
        peran: "karyawan",
        statusAkun: "menunggu_konfirmasi",
      },
    });

    const jumlahIzinMenunggu = await prisma.pengajuanIzin.count({
      where: { status: "menunggu" },
    });

    return res.json({
      data: {
        akunBaru: jumlahAkunBaru,
        izinBaru: jumlahIzinMenunggu,
        total: jumlahAkunBaru + jumlahIzinMenunggu,
      },
    });
  } catch (error) {
    console.error("Gagal mengambil notifikasi Admin:", error);
    return res.status(500).json({
      pesan: "Gagal memuat notifikasi Admin. Silakan coba lagi.",
    });
  }
}

async function ambilPengaturanPotonganFixed(req, res) {
  try {
    const data = await ambilPengaturanAman();
    return res.json({ data });
  } catch (error) {
    console.error("Gagal mengambil pengaturan potongan:", error);
    return res.status(500).json({
      pesan: "Gagal memuat pengaturan potongan.",
    });
  }
}

async function ubahStatusKaryawanFixed(req, res) {
  try {
    const id = Number.parseInt(String(req.params.id), 10);
    const statusAkun = String(req.body?.statusAkun || "").trim();

    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ pesan: "ID karyawan tidak valid." });
    }
    if (!["aktif", "nonaktif"].includes(statusAkun)) {
      return res.status(400).json({ pesan: "Status akun tidak valid." });
    }

    const pengguna = await prisma.pengguna.findUnique({
      where: { id },
      select: { id: true, nama: true, peran: true },
    });

    if (!pengguna || pengguna.peran !== "karyawan") {
      return res.status(404).json({ pesan: "Karyawan tidak ditemukan." });
    }

    const data = await prisma.pengguna.update({
      where: { id },
      data: { statusAkun },
      select: {
        id: true,
        nama: true,
        email: true,
        jabatan: true,
        divisi: true,
        statusAkun: true,
      },
    });

    return res.json({
      pesan: `Status ${data.nama} diubah menjadi ${statusAkun}.`,
      data,
    });
  } catch (error) {
    console.error("Gagal mengubah status karyawan:", error);
    return res.status(500).json({
      pesan: "Gagal mengubah status karyawan.",
    });
  }
}

module.exports = {
  ringkasanDashboardFixed,
  notifikasiAdminFixed,
  ambilPengaturanPotonganFixed,
  ubahStatusKaryawanFixed,
};
