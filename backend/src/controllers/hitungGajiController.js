const prisma = require("../utils/prismaClient");

const { tahunBulanSekarangWIB } = require("../utils/waktuIndonesia");
const { ambilSetHariLibur } = require("../utils/hariLibur");

function tanggalUTC(tahun, bulan, tanggal) {
  const b = String(bulan).padStart(2, "0");
  const t = String(tanggal).padStart(2, "0");

  return new Date(`${tahun}-${b}-${t}T00:00:00.000Z`);
}

function daftarHariKerja(tahun, bulan) {
  const hariDalamBulan = new Date(Date.UTC(tahun, bulan, 0)).getUTCDate();
  const daftar = [];

  for (let tanggal = 1; tanggal <= hariDalamBulan; tanggal++) {
    const d = tanggalUTC(tahun, bulan, tanggal);
    const hari = d.getUTCDay();

    if (hari !== 0 && hari !== 6) {
      daftar.push(d);
    }
  }

  return daftar;
}

async function hitungGajiKaryawan(penggunaId, tahun, bulan) {
  const gajiData = await prisma.gajiKaryawan.findUnique({
    where: { penggunaId },
  });

  if (!gajiData) {
    throw new Error("Gaji pokok karyawan ini belum diatur oleh Admin.");
  }

  const pengaturan = await prisma.pengaturanPotongan.upsert({
    where: { id: 1 },
    update: {},
    create: {
      id: 1,
      potonganTelat: 10000,
      potonganAlpha: 15000,
      jamMasukStandar: "08:00:00",
    },
  });

  const hariKerja = daftarHariKerja(tahun, bulan);
  const setHariLibur = await ambilSetHariLibur(tahun);
  // Buang hari libur nasional/cuti bersama dari daftar hari kerja -- tanpa
  // ini, hari libur yang jatuh di Senin-Jumat bakal dianggap "Alpha" buat
  // SEMUA karyawan dan kena potongan, padahal memang tidak ada yang masuk
  // karena libur.
  const hariKerjaSetelahLibur = hariKerja.filter(
    (d) => !setHariLibur.has(d.toISOString().slice(0, 10)),
  );
  const sekarangWIB = tahunBulanSekarangWIB();

  const bulanIniBerjalan =
    tahun === sekarangWIB.tahun && bulan === sekarangWIB.bulan;

  const sekarang = new Date();

  const hariKerjaDihitung = bulanIniBerjalan
    ? hariKerjaSetelahLibur.filter((d) => d <= sekarang)
    : hariKerjaSetelahLibur;

  const awalBulan = tanggalUTC(tahun, bulan, 1);

  const akhirBulan = new Date(Date.UTC(tahun, bulan, 0, 23, 59, 59));

  const semuaAbsensi = await prisma.absensi.findMany({
    where: {
      penggunaId,
      tanggal: {
        gte: awalBulan,
        lte: akhirBulan,
      },
    },
  });

  const petaAbsensi = {};

  for (const a of semuaAbsensi) {
    const kunci = a.tanggal.toISOString().slice(0, 10);
    petaAbsensi[kunci] = a;
  }

  const hitungan = {
    tepat_waktu: 0,
    telat: 0,
    alpha: 0,
    izin: 0,
    sakit: 0,
    cuti: 0,
    urgent: 0,
  };

  for (const tanggal of hariKerjaDihitung) {
    const kunci = tanggal.toISOString().slice(0, 10);
    const absen = petaAbsensi[kunci];

    if (!absen) {
      hitungan.alpha += 1;
      continue;
    }

    const status = absen.statusFinal || absen.statusOtomatis;

    if (status && Object.prototype.hasOwnProperty.call(hitungan, status)) {
      hitungan[status] += 1;
    } else {
      hitungan.alpha += 1;
    }
  }

  const gajiPokok = Number(gajiData.gajiPokok);
  const potonganTelat = Number(pengaturan.potonganTelat);
  const potonganAlpha = Number(pengaturan.potonganAlpha);

  const totalPotongan =
    hitungan.telat * potonganTelat + hitungan.alpha * potonganAlpha;

  const gajiDiterima = Math.max(gajiPokok - totalPotongan, 0);

  return {
    penggunaId,
    tahun,
    bulan,
    jumlahTepatWaktu: hitungan.tepat_waktu,
    jumlahTelat: hitungan.telat,
    jumlahAlpha: hitungan.alpha,
    jumlahIzin: hitungan.izin,
    jumlahSakit: hitungan.sakit,
    jumlahCuti: hitungan.cuti,
    gajiPokok,
    totalPotongan,
    gajiDiterima,
  };
}

async function hitungDanSimpanSatu(req, res) {
  try {
    const penggunaId = Number(req.params.penggunaId);
    const sekarangWIB = tahunBulanSekarangWIB();

    const tahun = Number(req.query.tahun) || sekarangWIB.tahun;
    const bulan = Number(req.query.bulan) || sekarangWIB.bulan;

    const hasil = await hitungGajiKaryawan(penggunaId, tahun, bulan);

    const laporan = await prisma.laporanGaji.upsert({
      where: {
        penggunaId_tahun_bulan: {
          penggunaId,
          tahun,
          bulan,
        },
      },
      update: hasil,
      create: hasil,
    });

    return res.json({
      pesan: "Perhitungan gaji berhasil disimpan.",
      data: laporan,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      pesan: "Gagal menghitung gaji. Silakan coba lagi.",
    });
  }
}

async function hitungDanSimpanSemua(req, res) {
  try {
    const sekarangWIB = tahunBulanSekarangWIB();

    const tahun = Number(req.query.tahun) || sekarangWIB.tahun;
    const bulan = Number(req.query.bulan) || sekarangWIB.bulan;

    const karyawanAktif = await prisma.pengguna.findMany({
      where: {
        peran: "karyawan",
        statusAkun: "aktif",
      },
      select: {
        id: true,
        nama: true,
      },
    });

    const hasilSemua = [];
    const gagal = [];

    for (const k of karyawanAktif) {
      try {
        const hasil = await hitungGajiKaryawan(k.id, tahun, bulan);

        const laporan = await prisma.laporanGaji.upsert({
          where: {
            penggunaId_tahun_bulan: {
              penggunaId: k.id,
              tahun,
              bulan,
            },
          },
          update: hasil,
          create: hasil,
        });

        hasilSemua.push(laporan);
      } catch (err) {
        gagal.push({
          nama: k.nama,
          alasan: err.message,
        });
      }
    }

    return res.json({
      pesan: `Perhitungan gaji selesai untuk ${hasilSemua.length} dari ${karyawanAktif.length} karyawan.`,
      data: hasilSemua,
      gagal,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      pesan: "Gagal menghitung gaji semua karyawan. Silakan coba lagi.",
    });
  }
}

async function lihatLaporanBulanan(req, res) {
  try {
    const sekarangWIB = tahunBulanSekarangWIB();

    const tahun = Number(req.query.tahun) || sekarangWIB.tahun;
    const bulan = Number(req.query.bulan) || sekarangWIB.bulan;

    const data = await prisma.laporanGaji.findMany({
      where: {
        tahun,
        bulan,
      },
      include: {
        pengguna: {
          select: {
            nama: true,
            jabatan: true,
            divisi: true,
          },
        },
      },
      orderBy: {
        pengguna: {
          nama: "asc",
        },
      },
    });

    return res.json({ data });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      pesan: "Gagal mengambil laporan gaji. Silakan coba lagi.",
    });
  }
}

module.exports = {
  hitungGajiKaryawan,
  hitungDanSimpanSatu,
  hitungDanSimpanSemua,
  lihatLaporanBulanan,
};
