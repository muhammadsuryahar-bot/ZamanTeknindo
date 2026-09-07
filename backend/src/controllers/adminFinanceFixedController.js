const prisma = require("../utils/prismaClient");
const { JAM_MASUK_STANDAR_DEFAULT } = require("../utils/waktuIndonesia");

const STATUS_FINAL_VALID = new Set([
  "tepat_waktu",
  "telat",
  "alpha",
  "izin",
  "sakit",
  "cuti",
  "urgent",
]);

function parsePositiveId(raw) {
  const id = Number(raw);
  return Number.isInteger(id) && id > 0 ? id : null;
}

function parseNonNegativeNumber(raw) {
  const value = Number(raw);
  return Number.isFinite(value) && value >= 0 ? value : null;
}

function normalisasiJam(raw) {
  const jam = String(raw || JAM_MASUK_STANDAR_DEFAULT).trim();
  return /^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/.test(jam) ? jam : null;
}

function normalisasiTanggal(raw) {
  const nilai = String(raw || "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(nilai)) return null;

  const [tahun, bulan, hari] = nilai.split("-").map(Number);
  const kandidat = new Date(Date.UTC(tahun, bulan - 1, hari));
  if (
    kandidat.getUTCFullYear() !== tahun ||
    kandidat.getUTCMonth() !== bulan - 1 ||
    kandidat.getUTCDate() !== hari
  ) {
    return null;
  }

  return nilai;
}

async function daftarMenungguKonfirmasiFixed(req, res) {
  try {
    const data = await prisma.pengguna.findMany({
      where: {
        peran: "karyawan",
        statusAkun: "menunggu_konfirmasi",
      },
      select: {
        id: true,
        nama: true,
        email: true,
        dibuatPada: true,
      },
      orderBy: {
        dibuatPada: "desc",
      },
    });

    return res.json({ data });
  } catch (error) {
    console.error("Gagal mengambil akun menunggu konfirmasi:", error);
    return res.status(500).json({
      pesan: "Terjadi kesalahan pada server.",
    });
  }
}

async function editStatusAbsensiFixed(req, res) {
  try {
    const absensiId = parsePositiveId(req.params.id);
    const statusFinal = String(req.body?.statusFinal || "").trim();
    const catatanAdmin = String(req.body?.catatanAdmin || "").trim();
    const adminId = parsePositiveId(req.user?.id);

    if (!absensiId) {
      return res.status(400).json({ pesan: "ID absensi tidak valid." });
    }

    if (!STATUS_FINAL_VALID.has(statusFinal)) {
      return res.status(400).json({ pesan: "Status absensi tidak valid." });
    }

    if (!catatanAdmin) {
      return res.status(400).json({ pesan: "Catatan wajib diisi saat mengubah status absensi." });
    }

    if (catatanAdmin.length > 500) {
      return res.status(400).json({ pesan: "Catatan Admin maksimal 500 karakter." });
    }

    if (!adminId) {
      return res.status(401).json({ pesan: "Sesi Admin tidak valid." });
    }

    const existing = await prisma.absensi.findUnique({
      where: { id: absensiId },
      select: { id: true, penggunaId: true },
    });

    if (!existing) {
      return res.status(404).json({ pesan: "Data absensi tidak ditemukan." });
    }

    const absensi = await prisma.absensi.update({
      where: { id: absensiId },
      data: {
        statusFinal,
        catatanAdmin,
        dieditOleh: adminId,
        waktuEdit: new Date(),
      },
    });

    return res.json({
      pesan: "Status absensi berhasil diperbarui.",
      data: absensi,
    });
  } catch (error) {
    console.error("Gagal mengubah status absensi:", error);
    return res.status(500).json({
      pesan: "Terjadi kesalahan pada server.",
    });
  }
}

async function ambilPengaturanPotonganFixed(req, res) {
  try {
    const existing = await prisma.pengaturanPotongan.findUnique({
      where: { id: 1 },
    });

    const data =
      existing ||
      (await prisma.pengaturanPotongan.create({
        data: {
          id: 1,
          potonganTelat: 10000,
          potonganAlpha: 15000,
          jamMasukStandar: JAM_MASUK_STANDAR_DEFAULT,
        },
      }));

    return res.json({ data });
  } catch (error) {
    console.error("Gagal mengambil pengaturan potongan:", error);
    return res.status(500).json({
      pesan: "Terjadi kesalahan pada server.",
    });
  }
}

async function ubahPengaturanPotonganFixed(req, res) {
  try {
    const potonganTelat = parseNonNegativeNumber(req.body?.potonganTelat);
    const potonganAlpha = parseNonNegativeNumber(req.body?.potonganAlpha);
    const jamMasuk = normalisasiJam(req.body?.jamMasukStandar);

    if (potonganTelat === null || potonganAlpha === null) {
      return res.status(400).json({
        pesan: "Nominal potongan harus berupa angka yang valid dan tidak boleh negatif.",
      });
    }

    if (!jamMasuk) {
      return res.status(400).json({
        pesan: "Jam masuk standar tidak valid. Gunakan format HH:MM atau HH:MM:SS.",
      });
    }

    const pengaturan = await prisma.pengaturanPotongan.upsert({
      where: { id: 1 },
      update: {
        potonganTelat,
        potonganAlpha,
        jamMasukStandar: jamMasuk,
      },
      create: {
        id: 1,
        potonganTelat,
        potonganAlpha,
        jamMasukStandar: jamMasuk,
      },
    });

    return res.json({
      pesan: "Pengaturan potongan berhasil diperbarui.",
      data: pengaturan,
    });
  } catch (error) {
    console.error("Gagal mengubah pengaturan potongan:", error);
    return res.status(500).json({
      pesan: "Terjadi kesalahan pada server.",
    });
  }
}

async function daftarGajiKaryawanFixed(req, res) {
  try {
    const data = await prisma.pengguna.findMany({
      where: {
        peran: "karyawan",
        statusAkun: "aktif",
      },
      select: {
        id: true,
        nama: true,
        email: true,
        jabatan: true,
        divisi: true,
        gaji: {
          select: {
            gajiPokok: true,
            diubahPada: true,
          },
        },
      },
      orderBy: {
        nama: "asc",
      },
    });

    return res.json({ data });
  } catch (error) {
    console.error("Gagal mengambil gaji karyawan:", error);
    return res.status(500).json({
      pesan: "Terjadi kesalahan pada server.",
    });
  }
}

async function ubahGajiKaryawanFixed(req, res) {
  try {
    const penggunaId = parsePositiveId(req.params.id);
    const gajiPokok = parseNonNegativeNumber(req.body?.gajiPokok);

    if (!penggunaId) {
      return res.status(400).json({ pesan: "ID karyawan tidak valid." });
    }

    if (gajiPokok === null) {
      return res.status(400).json({
        pesan: "Gaji pokok wajib berupa angka yang valid dan tidak boleh negatif.",
      });
    }

    const pengguna = await prisma.pengguna.findUnique({
      where: { id: penggunaId },
      select: {
        id: true,
        nama: true,
        peran: true,
        statusAkun: true,
      },
    });

    if (!pengguna) {
      return res.status(404).json({ pesan: "Karyawan tidak ditemukan." });
    }

    if (pengguna.peran !== "karyawan") {
      return res.status(400).json({ pesan: "Gaji hanya bisa diatur untuk akun karyawan." });
    }

    const gaji = await prisma.gajiKaryawan.upsert({
      where: { penggunaId },
      update: { gajiPokok },
      create: { penggunaId, gajiPokok },
    });

    return res.json({
      pesan: `Gaji pokok ${pengguna.nama} berhasil diperbarui.`,
      data: gaji,
    });
  } catch (error) {
    console.error("Gagal mengubah gaji karyawan:", error);
    return res.status(500).json({
      pesan: "Terjadi kesalahan pada server.",
    });
  }
}

async function daftarHariLiburFixed(req, res) {
  try {
    const rawTahun = String(req.query?.tahun || "").trim();
    let where = undefined;

    if (rawTahun) {
      const tahun = Number(rawTahun);
      if (!Number.isInteger(tahun) || tahun < 2000 || tahun > 2100) {
        return res.status(400).json({ pesan: "Tahun hari libur tidak valid." });
      }

      where = {
        tanggal: {
          gte: new Date(Date.UTC(tahun, 0, 1)),
          lt: new Date(Date.UTC(tahun + 1, 0, 1)),
        },
      };
    }

    const data = await prisma.hariLibur.findMany({
      where,
      orderBy: { tanggal: "asc" },
    });

    return res.json({ data });
  } catch (error) {
    console.error("Gagal mengambil hari libur:", error);
    return res.status(500).json({
      pesan: "Terjadi kesalahan pada server.",
    });
  }
}

async function tambahHariLiburFixed(req, res) {
  try {
    const tanggal = normalisasiTanggal(req.body?.tanggal);
    const keterangan = String(req.body?.keterangan || "").trim();

    if (!tanggal) {
      return res.status(400).json({ pesan: "Tanggal hari libur tidak valid." });
    }

    if (!keterangan) {
      return res.status(400).json({
        pesan: "Keterangan wajib diisi (contoh: Hari Kemerdekaan).",
      });
    }

    if (keterangan.length > 255) {
      return res.status(400).json({ pesan: "Keterangan maksimal 255 karakter." });
    }

    const tanggalDb = new Date(`${tanggal}T00:00:00.000Z`);
    const sudahAda = await prisma.hariLibur.findUnique({
      where: { tanggal: tanggalDb },
    });

    if (sudahAda) {
      return res.status(409).json({
        pesan: "Tanggal ini sudah terdaftar sebagai hari libur.",
      });
    }

    const hariLibur = await prisma.hariLibur.create({
      data: {
        tanggal: tanggalDb,
        keterangan,
      },
    });

    return res.status(201).json({
      pesan: `Hari libur "${hariLibur.keterangan}" berhasil ditambahkan.`,
      data: hariLibur,
    });
  } catch (error) {
    console.error("Gagal menambahkan hari libur:", error);
    return res.status(500).json({
      pesan: "Terjadi kesalahan pada server.",
    });
  }
}

async function hapusHariLiburFixed(req, res) {
  try {
    const id = parsePositiveId(req.params.id);
    if (!id) {
      return res.status(400).json({ pesan: "ID hari libur tidak valid." });
    }

    const existing = await prisma.hariLibur.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!existing) {
      return res.status(404).json({ pesan: "Hari libur tidak ditemukan." });
    }

    await prisma.hariLibur.delete({ where: { id } });

    return res.json({ pesan: "Hari libur berhasil dihapus." });
  } catch (error) {
    console.error("Gagal menghapus hari libur:", error);
    return res.status(500).json({
      pesan: "Terjadi kesalahan pada server.",
    });
  }
}

async function usulanHariLiburFixed(req, res) {
  const tahunRaw = String(req.query?.tahun || "").trim();
  const tahun = tahunRaw ? Number(tahunRaw) : new Date().getUTCFullYear();

  if (!Number.isInteger(tahun) || tahun < 2000 || tahun > 2100) {
    return res.status(400).json({ pesan: "Tahun tidak valid." });
  }

  const kontrolWaktu = new AbortController();
  const timeoutId = setTimeout(() => kontrolWaktu.abort(), 8000);

  try {
    const responLuar = await fetch(
      `https://api-hari-libur.vercel.app/api?year=${tahun}`,
      { signal: kontrolWaktu.signal },
    );

    if (!responLuar.ok) {
      return res.status(502).json({
        pesan:
          "Sumber data hari libur sedang tidak bisa diakses. Coba lagi nanti, atau tambahkan manual.",
      });
    }

    const data = await responLuar.json();
    return res.json(data);
  } catch (error) {
    console.error("Gagal ambil usulan hari libur:", error?.message || error);
    return res.status(502).json({
      pesan:
        "Sumber data hari libur sedang tidak bisa diakses. Coba lagi nanti, atau tambahkan manual.",
    });
  } finally {
    clearTimeout(timeoutId);
  }
}

module.exports = {
  daftarMenungguKonfirmasiFixed,
  editStatusAbsensiFixed,
  ambilPengaturanPotonganFixed,
  ubahPengaturanPotonganFixed,
  daftarGajiKaryawanFixed,
  ubahGajiKaryawanFixed,
  daftarHariLiburFixed,
  tambahHariLiburFixed,
  hapusHariLiburFixed,
  usulanHariLiburFixed,
};
