const prisma = require("../utils/prismaClient");
const {
  tanggalHariIniWIB,
  JAM_MASUK_STANDAR_DEFAULT,
  statusEfektif,
} = require("../utils/waktuIndonesia");

const CACHE_NOTIFIKASI_MS = 5000;
let cacheNotifikasi = null;

function normalisasiTanggalRingkasan(raw) {
  const nilai = String(raw || "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(nilai)) return null;

  const [tahun, bulan, hari] = nilai.split("-").map(Number);
  const kandidat = new Date(Date.UTC(tahun, bulan - 1, hari));
  if (
    kandidat.getUTCFullYear() !== tahun ||
    kandidat.getUTCMonth() !== bulan - 1 ||
    kandidat.getUTCDate() !== hari
  ) return null;

  return nilai;
}

function tanggalKeHariIniDanRentang(tanggalTarget = null) {
  const hariIniSistem = tanggalHariIniWIB();
  const targetRaw = String(tanggalTarget || "").trim();
  const target = targetRaw ? normalisasiTanggalRingkasan(targetRaw) : hariIniSistem;

  if (targetRaw && !target) {
    const error = new Error("Tanggal ringkasan tidak valid.");
    error.kode = "TANGGAL_RINGKASAN_TIDAK_VALID";
    throw error;
  }

  if (target > hariIniSistem) {
    const error = new Error("Tanggal ringkasan tidak boleh melebihi hari ini.");
    error.kode = "TANGGAL_RINGKASAN_TIDAK_VALID";
    throw error;
  }

  const hariIni = target;
  const tujuhHariLalu = new Date(`${hariIni}T00:00:00.000Z`);
  tujuhHariLalu.setUTCDate(tujuhHariLalu.getUTCDate() - 6);
  const tigaPuluhHariLalu = new Date(`${hariIni}T00:00:00.000Z`);
  tigaPuluhHariLalu.setUTCDate(tigaPuluhHariLalu.getUTCDate() - 29);
  const besokHariIni = new Date(`${hariIni}T00:00:00.000Z`);
  besokHariIni.setUTCDate(besokHariIni.getUTCDate() + 1);
  return { hariIni, tujuhHariLalu, tigaPuluhHariLalu, besokHariIni };
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
      kioskPin: "246810",
    }
  );
}

async function ringkasanDashboardFixed(req, res) {
  try {
    const { hariIni, tujuhHariLalu, tigaPuluhHariLalu, besokHariIni } =
      tanggalKeHariIniDanRentang(req.query?.tanggal);

    // Baca secara berurutan karena production menggunakan transaction pooler
    // dengan connection_limit kecil. Tidak ada Promise.all di jalur ini.
    const absensi7Hari = await prisma.absensi.findMany({
      where: {
        tanggal: {
          gte: tujuhHariLalu,
          lt: besokHariIni,
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
          lte: new Date(`${hariIni}T23:59:59.999Z`),
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
    if (error?.kode === "TANGGAL_RINGKASAN_TIDAK_VALID") {
      return res.status(400).json({
        pesan: error.message,
      });
    }
    return res.status(500).json({
      pesan: "Gagal memuat tren & analisis.",
    });
  }
}

async function notifikasiAdminFixed(req, res) {
  const sekarang = Date.now();

  if (cacheNotifikasi && sekarang - cacheNotifikasi.dibuatPada < CACHE_NOTIFIKASI_MS) {
    return res.json({ data: cacheNotifikasi.data });
  }

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

    // NEW - Manual Pending (Backup Kiosk tanpa PIN + jam asli klik)
    const jumlahManualPending = await prisma.manualAbsenRequest.count({
      where: { status: "PENDING" },
    });

    const data = {
      akunBaru: jumlahAkunBaru,
      izinBaru: jumlahIzinMenunggu,
      manualPending: jumlahManualPending,
      manualBaru: jumlahManualPending,
      total: jumlahAkunBaru + jumlahIzinMenunggu + jumlahManualPending,
    };

    cacheNotifikasi = { dibuatPada: Date.now(), data };

    return res.json({ data });
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

    // Status akun berubah, jadi hasil notifikasi harus langsung dianggap stale.
    cacheNotifikasi = null;

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