const prisma = require("../utils/prismaClient");
const { deleteFotoAbsensiBatch } = require("../utils/supabaseStorage");

const MASA_TUNGGU_HARI = 7;
const BATCH_ABSENSI = 500;
const MAX_BATCHES_PER_RUN = 2;

function validasiPeriode(tahun, bulan) {
  const tahunAngka = Number(tahun);
  const bulanAngka = Number(bulan);

  if (!Number.isInteger(tahunAngka) || tahunAngka < 2000 || tahunAngka > 2100) {
    return { valid: false, pesan: "Tahun tidak valid." };
  }

  if (!Number.isInteger(bulanAngka) || bulanAngka < 1 || bulanAngka > 12) {
    return { valid: false, pesan: "Bulan tidak valid." };
  }

  return { valid: true, tahun: tahunAngka, bulan: bulanAngka };
}

function awalBulanUTC(tahun, bulan) {
  return new Date(Date.UTC(tahun, bulan - 1, 1));
}

function awalBulanBerikutnyaUTC(tahun, bulan) {
  return new Date(Date.UTC(tahun, bulan, 1));
}

function bulanSudahSelesai(tahun, bulan) {
  return awalBulanBerikutnyaUTC(tahun, bulan).getTime() <= Date.now();
}

function hitungSiapDihapusPada(tahun, bulan, sekarang = new Date()) {
  const dariKonfirmasi = new Date(
    sekarang.getTime() + MASA_TUNGGU_HARI * 24 * 60 * 60 * 1000,
  );

  const minimumSetelahBulan = new Date(
    awalBulanBerikutnyaUTC(tahun, bulan).getTime() +
      MASA_TUNGGU_HARI * 24 * 60 * 60 * 1000,
  );

  return dariKonfirmasi > minimumSetelahBulan
    ? dariKonfirmasi
    : minimumSetelahBulan;
}

async function hitungStatistikPeriode(tahun, bulan) {
  const awal = awalBulanUTC(tahun, bulan);
  const berikutnya = awalBulanBerikutnyaUTC(tahun, bulan);

  const [jumlahAbsensi, barisFoto] = await Promise.all([
    prisma.absensi.count({
      where: {
        tanggal: {
          gte: awal,
          lt: berikutnya,
        },
      },
    }),
    prisma.absensi.findMany({
      where: {
        tanggal: {
          gte: awal,
          lt: berikutnya,
        },
      },
      select: {
        fotoMasuk: true,
        fotoPulang: true,
      },
    }),
  ]);

  const jumlahFoto = barisFoto.reduce((jumlah, item) => {
    return jumlah + (item.fotoMasuk ? 1 : 0) + (item.fotoPulang ? 1 : 0);
  }, 0);

  return {
    jumlahAbsensi,
    jumlahFoto,
  };
}

// GET /api/admin/arsip-bulanan
async function daftarArsipBulanan(req, res) {
  try {
    const data = await prisma.arsipBulanan.findMany({
      orderBy: [{ tahun: "desc" }, { bulan: "desc" }],
      take: 36,
    });

    return res.json({ data });
  } catch (error) {
    console.error("Gagal mengambil arsip bulanan:", error);
    return res.status(500).json({
      pesan: "Terjadi kesalahan pada server.",
    });
  }
}

// GET /api/admin/arsip-bulanan/:tahun/:bulan/preview
async function previewArsipBulanan(req, res) {
  try {
    const hasil = validasiPeriode(req.params.tahun, req.params.bulan);

    if (!hasil.valid) {
      return res.status(400).json({ pesan: hasil.pesan });
    }

    const { tahun, bulan } = hasil;

    if (!bulanSudahSelesai(tahun, bulan)) {
      return res.status(400).json({
        pesan: "Periode belum selesai. Bulan berjalan tidak boleh diproses untuk cleanup.",
      });
    }

    const statistik = await hitungStatistikPeriode(tahun, bulan);
    const laporanGaji = await prisma.laporanGaji.count({
      where: { tahun, bulan },
    });

    return res.json({
      data: {
        tahun,
        bulan,
        ...statistik,
        jumlahLaporanGaji: laporanGaji,
        masaTungguHari: MASA_TUNGGU_HARI,
        catatan:
          "Preview tidak menghapus data apa pun. Gunakan hasil ini untuk memastikan periode siap ditutup.",
      },
    });
  } catch (error) {
    console.error("Gagal preview arsip bulanan:", error);
    return res.status(500).json({
      pesan: "Terjadi kesalahan pada server.",
    });
  }
}

// POST /api/admin/arsip-bulanan/:tahun/:bulan/konfirmasi
// Body: { "namaFile": "Laporan_Gaji_Agustus_2026.xlsx", "lokasiArsip": "Laptop perusahaan" }
async function konfirmasiArsipBulanan(req, res) {
  try {
    const hasil = validasiPeriode(req.params.tahun, req.params.bulan);

    if (!hasil.valid) {
      return res.status(400).json({ pesan: hasil.pesan });
    }

    const { tahun, bulan } = hasil;

    if (!bulanSudahSelesai(tahun, bulan)) {
      return res.status(400).json({
        pesan: "Periode belum selesai. Tidak bisa dikonfirmasi sebelum akhir bulan.",
      });
    }

    const namaFile = String(req.body?.namaFile || "").trim();
    const lokasiArsip = String(req.body?.lokasiArsip || "Laptop perusahaan").trim();

    if (!namaFile) {
      return res.status(400).json({
        pesan:
          "Nama file Excel wajib diisi. Pastikan file rekap sudah berhasil dibuat dan disimpan.",
      });
    }

    if (namaFile.length > 255) {
      return res.status(400).json({
        pesan: "Nama file maksimal 255 karakter.",
      });
    }

    const statistik = await hitungStatistikPeriode(tahun, bulan);
    const jumlahLaporanGaji = await prisma.laporanGaji.count({
      where: { tahun, bulan },
    });

    if (jumlahLaporanGaji === 0) {
      return res.status(400).json({
        pesan:
          "Laporan gaji untuk periode tersebut belum tersedia. Hitung laporan terlebih dahulu sebelum menutup periode.",
      });
    }

    const sekarang = new Date();
    const siapDihapusPada = hitungSiapDihapusPada(tahun, bulan, sekarang);

    const existing = await prisma.arsipBulanan.findUnique({
      where: {
        tahun_bulan: {
          tahun,
          bulan,
        },
      },
    });

    if (existing?.status === "selesai") {
      return res.status(409).json({
        pesan: "Periode tersebut sudah selesai dibersihkan dan tidak dapat diproses ulang.",
        data: existing,
      });
    }

    if (existing?.status === "diproses") {
      return res.status(409).json({
        pesan: "Periode sedang diproses cleanup oleh sistem.",
        data: existing,
      });
    }

    const arsip = await prisma.arsipBulanan.upsert({
      where: {
        tahun_bulan: {
          tahun,
          bulan,
        },
      },
      update: {
        namaFile,
        lokasiArsip: lokasiArsip || "Laptop perusahaan",
        status: "siap_dihapus",
        dikonfirmasiPada: sekarang,
        siapDihapusPada: siapDihapusPada,
        mulaiDihapusPada: null,
        selesaiDihapusPada: null,
        jumlahAbsensiAwal: statistik.jumlahAbsensi,
        jumlahFotoAwal: statistik.jumlahFoto,
        jumlahAbsensiDihapus: 0,
        jumlahFotoDihapus: 0,
        pesanError: null,
      },
      create: {
        tahun,
        bulan,
        namaFile,
        lokasiArsip: lokasiArsip || "Laptop perusahaan",
        status: "siap_dihapus",
        dikonfirmasiPada: sekarang,
        siapDihapusPada: siapDihapusPada,
        jumlahAbsensiAwal: statistik.jumlahAbsensi,
        jumlahFotoAwal: statistik.jumlahFoto,
      },
    });

    return res.status(201).json({
      pesan: `Periode ${bulan}/${tahun} berhasil dikonfirmasi. Cleanup otomatis dijadwalkan setelah masa tunggu ${MASA_TUNGGU_HARI} hari.`,
      data: arsip,
    });
  } catch (error) {
    console.error("Gagal mengonfirmasi arsip bulanan:", error);
    return res.status(500).json({
      pesan: "Terjadi kesalahan pada server.",
    });
  }
}

// POST /api/admin/arsip-bulanan/:tahun/:bulan/batalkan
async function batalkanArsipBulanan(req, res) {
  try {
    const hasil = validasiPeriode(req.params.tahun, req.params.bulan);

    if (!hasil.valid) {
      return res.status(400).json({ pesan: hasil.pesan });
    }

    const existing = await prisma.arsipBulanan.findUnique({
      where: {
        tahun_bulan: {
          tahun: hasil.tahun,
          bulan: hasil.bulan,
        },
      },
    });

    if (!existing) {
      return res.status(404).json({
        pesan: "Arsip periode tersebut belum ditemukan.",
      });
    }

    if (existing.status === "diproses" || existing.status === "selesai") {
      return res.status(400).json({
        pesan: "Periode sudah diproses atau selesai dan tidak dapat dibatalkan.",
      });
    }

    const data = await prisma.arsipBulanan.update({
      where: { id: existing.id },
      data: {
        status: "dibatalkan",
        siapDihapusPada: null,
        pesanError: null,
      },
    });

    return res.json({
      pesan: "Jadwal cleanup periode berhasil dibatalkan.",
      data,
    });
  } catch (error) {
    console.error("Gagal membatalkan arsip bulanan:", error);
    return res.status(500).json({
      pesan: "Terjadi kesalahan pada server.",
    });
  }
}

async function prosesSatuArsip(arsip) {
  const awal = awalBulanUTC(arsip.tahun, arsip.bulan);
  const berikutnya = awalBulanBerikutnyaUTC(arsip.tahun, arsip.bulan);

  let jumlahAbsensiDihapus = Number(arsip.jumlahAbsensiDihapus || 0);
  let jumlahFotoDihapus = Number(arsip.jumlahFotoDihapus || 0);
  let batchDiproses = 0;

  while (batchDiproses < MAX_BATCHES_PER_RUN) {
    const batch = await prisma.absensi.findMany({
      where: {
        tanggal: {
          gte: awal,
          lt: berikutnya,
        },
      },
      orderBy: {
        id: "asc",
      },
      take: BATCH_ABSENSI,
      select: {
        id: true,
        fotoMasuk: true,
        fotoPulang: true,
      },
    });

    if (batch.length === 0) {
      break;
    }

    const semuaFoto = batch.flatMap((item) => [item.fotoMasuk, item.fotoPulang]);

    // WAJIB berhasil dulu. Kalau Storage gagal, record Absensi
    // batch ini tidak dihapus sehingga bisa dicoba ulang.
    const hasilFoto = await deleteFotoAbsensiBatch(semuaFoto);
    jumlahFotoDihapus += hasilFoto.jumlahDihapus;

    const ids = batch.map((item) => item.id);

    const hasilDelete = await prisma.absensi.deleteMany({
      where: {
        id: {
          in: ids,
        },
      },
    });

    jumlahAbsensiDihapus += hasilDelete.count;
    batchDiproses += 1;

    await prisma.arsipBulanan.update({
      where: { id: arsip.id },
      data: {
        jumlahAbsensiDihapus,
        jumlahFotoDihapus,
      },
    });

    if (batch.length < BATCH_ABSENSI) {
      break;
    }
  }

  const sisaAbsensi = await prisma.absensi.count({
    where: {
      tanggal: {
        gte: awal,
        lt: berikutnya,
      },
    },
  });

  if (sisaAbsensi === 0) {
    return {
      selesai: true,
      jumlahAbsensiDihapus,
      jumlahFotoDihapus,
      jumlahAbsensiTersisa: 0,
    };
  }

  return {
    selesai: false,
    jumlahAbsensiDihapus,
    jumlahFotoDihapus,
    jumlahAbsensiTersisa: sisaAbsensi,
  };
}

// GET /api/cron/cleanup-absensi
// Header wajib: Authorization: Bearer <CRON_SECRET>
async function jalankanCleanupAbsensi(req, res) {
  let arsipYangDiproses = null;

  try {
    const sekarang = new Date();
    const tigaPuluhMenitLalu = new Date(
      sekarang.getTime() - 30 * 60 * 1000,
    );

    const kandidat = await prisma.arsipBulanan.findFirst({
      where: {
        OR: [
          {
            status: "siap_dihapus",
            siapDihapusPada: {
              lte: sekarang,
            },
          },
          {
            status: "gagal",
            siapDihapusPada: {
              lte: sekarang,
            },
          },
          {
            // Recovery kalau deployment/serverless timeout setelah status
            // sempat menjadi "diproses". Setelah 30 menit dianggap stale.
            status: "diproses",
            mulaiDihapusPada: {
              lte: tigaPuluhMenitLalu,
            },
          },
        ],
      },
      orderBy: [
        {
          siapDihapusPada: "asc",
        },
        {
          id: "asc",
        },
      ],
    });

    if (String(req.query?.dryRun || "") === "1") {
      if (!kandidat) {
        return res.json({
          dryRun: true,
          diproses: false,
          pesan: "Tidak ada periode yang siap dibersihkan.",
        });
      }

      const statistik = await hitungStatistikPeriode(
        kandidat.tahun,
        kandidat.bulan,
      );

      return res.json({
        dryRun: true,
        diproses: false,
        pesan: "Dry-run selesai. Tidak ada data yang dihapus.",
        data: {
          id: kandidat.id,
          tahun: kandidat.tahun,
          bulan: kandidat.bulan,
          status: kandidat.status,
          siapDihapusPada: kandidat.siapDihapusPada,
          ...statistik,
        },
      });
    }

    if (!kandidat) {
      return res.json({
        diproses: false,
        pesan: "Tidak ada periode yang siap dibersihkan.",
      });
    }

    const klaim = await prisma.arsipBulanan.updateMany({
      where: {
        id: kandidat.id,
        OR: [
          {
            status: "siap_dihapus",
            siapDihapusPada: {
              lte: sekarang,
            },
          },
          {
            status: "gagal",
            siapDihapusPada: {
              lte: sekarang,
            },
          },
          {
            status: "diproses",
            mulaiDihapusPada: {
              lte: tigaPuluhMenitLalu,
            },
          },
        ],
      },
      data: {
        status: "diproses",
        mulaiDihapusPada: sekarang,
        pesanError: null,
      },
    });

    if (klaim.count === 0) {
      return res.json({
        diproses: false,
        pesan: "Periode sedang diproses proses lain. Coba lagi pada jadwal berikutnya.",
      });
    }

    arsipYangDiproses = await prisma.arsipBulanan.findUnique({
      where: { id: kandidat.id },
    });

    const hasil = await prosesSatuArsip(arsipYangDiproses);

    if (hasil.selesai) {
      const selesai = await prisma.arsipBulanan.update({
        where: { id: arsipYangDiproses.id },
        data: {
          status: "selesai",
          selesaiDihapusPada: new Date(),
          jumlahAbsensiDihapus: hasil.jumlahAbsensiDihapus,
          jumlahFotoDihapus: hasil.jumlahFotoDihapus,
          pesanError: null,
        },
      });

      return res.json({
        diproses: true,
        selesai: true,
        pesan: "Cleanup periode berhasil diselesaikan.",
        data: selesai,
      });
    }

    const besok = new Date();
    besok.setUTCDate(besok.getUTCDate() + 1);

    const lanjut = await prisma.arsipBulanan.update({
      where: { id: arsipYangDiproses.id },
      data: {
        status: "siap_dihapus",
        siapDihapusPada: besok,
        jumlahAbsensiDihapus: hasil.jumlahAbsensiDihapus,
        jumlahFotoDihapus: hasil.jumlahFotoDihapus,
      },
    });

    return res.json({
      diproses: true,
      selesai: false,
      pesan: "Sebagian data dibersihkan. Sisa akan dilanjutkan pada jadwal cron berikutnya.",
      data: lanjut,
    });
  } catch (error) {
    console.error("Cleanup absensi gagal:", error);

    if (arsipYangDiproses?.id) {
      try {
        const besok = new Date();
        besok.setUTCDate(besok.getUTCDate() + 1);

        await prisma.arsipBulanan.update({
          where: { id: arsipYangDiproses.id },
          data: {
            status: "gagal",
            siapDihapusPada: besok,
            pesanError: String(error?.message || "Cleanup gagal").slice(0, 1000),
          },
        });
      } catch (updateError) {
        console.error("Gagal menyimpan status cleanup:", updateError);
      }
    }

    return res.status(500).json({
      diproses: false,
      pesan: "Cleanup periode gagal. Sistem akan mencoba kembali pada jadwal berikutnya.",
    });
  }
}

module.exports = {
  daftarArsipBulanan,
  previewArsipBulanan,
  konfirmasiArsipBulanan,
  batalkanArsipBulanan,
  jalankanCleanupAbsensi,
};
