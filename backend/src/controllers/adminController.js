const prisma = require("../utils/prismaClient");
const {
  tanggalHariIniWIB,
  JAM_MASUK_STANDAR_DEFAULT,
  statusEfektif,
} = require("../utils/waktuIndonesia");
const { buatSignedUrlFotoBatch } = require("../utils/supabaseStorage");

// ============================================================
// LIHAT DAFTAR AKUN YANG MENUNGGU KONFIRMASI
// ============================================================
async function daftarMenungguKonfirmasi(req, res) {
  try {
    const data = await prisma.pengguna.findMany({
      where: { statusAkun: "menunggu_konfirmasi" },
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
    console.error(error);

    return res.status(500).json({
      pesan: "Terjadi kesalahan pada server.",
    });
  }
}

// ============================================================
// AKTIFKAN AKUN KARYAWAN
// ============================================================
async function aktifkanAkun(req, res) {
  try {
    const { id } = req.params;
    const { jabatan, divisi, kantorId } = req.body;

    let kantorIdFinal = kantorId ? parseInt(kantorId) : null;

    if (!kantorIdFinal) {
      const kantorPertama = await prisma.kantor.findFirst({
        orderBy: {
          id: "asc",
        },
      });

      kantorIdFinal = kantorPertama?.id || null;
    }

    const pengguna = await prisma.pengguna.update({
      where: {
        id: parseInt(id),
      },

      data: {
        jabatan,
        divisi,
        kantorId: kantorIdFinal,
        statusAkun: "aktif",
      },
    });

    return res.json({
      pesan: `Akun ${pengguna.nama} berhasil diaktifkan.`,
      data: pengguna,
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      pesan: "Terjadi kesalahan pada server.",
    });
  }
}

// ============================================================
// LIHAT SEMUA KARYAWAN
// ============================================================
async function daftarKaryawan(req, res) {
  try {
    const data = await prisma.pengguna.findMany({
      where: {
        peran: "karyawan",
        statusAkun: {
          not: "menunggu_konfirmasi",
        },
      },

      select: {
        id: true,
        nama: true,
        email: true,
        jabatan: true,
        divisi: true,
        statusAkun: true,

        kantor: {
          select: {
            namaKantor: true,
          },
        },
      },

      orderBy: {
        nama: "asc",
      },
    });

    return res.json({ data });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      pesan: "Terjadi kesalahan pada server.",
    });
  }
}

// ============================================================
// NONAKTIFKAN / AKTIFKAN KEMBALI KARYAWAN
// ============================================================
async function ubahStatusKaryawan(req, res) {
  try {
    const { id } = req.params;
    const { statusAkun } = req.body;

    const pengguna = await prisma.pengguna.update({
      where: {
        id: parseInt(id),
      },

      data: {
        statusAkun,
      },
    });

    return res.json({
      pesan: `Status ${pengguna.nama} diubah menjadi ${statusAkun}.`,
      data: pengguna,
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      pesan: "Terjadi kesalahan pada server.",
    });
  }
}

// ============================================================
// REKAP ABSENSI HARI INI
// ============================================================
async function rekapHariIni(req, res) {
  try {
    const tanggal = tanggalHariIniWIB();

    const [data, karyawanAktif, pengaturan] = await Promise.all([
      prisma.absensi.findMany({
        where: {
          tanggal,
        },

        include: {
          pengguna: {
            select: {
              id: true,
              nama: true,
              jabatan: true,
              divisi: true,
            },
          },
        },

        orderBy: {
          jamMasuk: "asc",
        },
      }),

      prisma.pengguna.findMany({
        where: {
          peran: "karyawan",
          statusAkun: "aktif",
        },

        select: {
          id: true,
          nama: true,
          jabatan: true,
          divisi: true,
        },

        orderBy: {
          nama: "asc",
        },
      }),

      prisma.pengaturanPotongan.upsert({
        where: { id: 1 },
        update: {},
        create: {
          id: 1,
          potonganTelat: 10000,
          potonganAlpha: 15000,
          jamMasukStandar: JAM_MASUK_STANDAR_DEFAULT,
        },
      }),
    ]);

    const jamMasukStandar =
      pengaturan?.jamMasukStandar || JAM_MASUK_STANDAR_DEFAULT;

    const semuaPathFoto = [];

    for (const item of data) {
      if (item.fotoMasuk && !item.fotoMasuk.startsWith("/uploads/")) {
        semuaPathFoto.push(item.fotoMasuk);
      }
      if (item.fotoPulang && !item.fotoPulang.startsWith("/uploads/")) {
        semuaPathFoto.push(item.fotoPulang);
      }
    }

    const petaUrlFoto = await buatSignedUrlFotoBatch(semuaPathFoto);

    const dataDenganFoto = data.map((item) => {
      let fotoMasukUrl = null;
      let fotoPulangUrl = null;

      if (item.fotoMasuk) {
        fotoMasukUrl = item.fotoMasuk.startsWith("/uploads/")
          ? item.fotoMasuk
          : petaUrlFoto.get(item.fotoMasuk) || null;
      }

      if (item.fotoPulang) {
        fotoPulangUrl = item.fotoPulang.startsWith("/uploads/")
          ? item.fotoPulang
          : petaUrlFoto.get(item.fotoPulang) || null;
      }

      const alamatMentah = String(item.alamatMasuk || "").trim();
      const alamatAdalahPlaceholder =
        alamatMentah === "Lokasi GPS belum tersedia" ||
        alamatMentah.toLowerCase().includes("lokasi gps belum tersedia") ||
        alamatMentah.toLowerCase().includes("gps belum tersedia");

      const punyaKoordinatGPS =
        Number.isFinite(Number(item.latitudeMasuk)) &&
        Number.isFinite(Number(item.longitudeMasuk));

      let alamatMasukTampilan = item.alamatMasuk;

      if (punyaKoordinatGPS && (!alamatMentah || alamatAdalahPlaceholder)) {
        alamatMasukTampilan = `GPS tersedia: ${Number(item.latitudeMasuk).toFixed(6)}, ${Number(item.longitudeMasuk).toFixed(6)}`;
      }

      const statusTampilan = statusEfektif(item, jamMasukStandar);

      return {
        ...item,
        alamatMasuk: alamatMasukTampilan,
        fotoMasukUrl,
        fotoPulangUrl,
        // API rekap mengekspos status yang benar-benar harus ditampilkan.
        // statusFinal tetap dipakai frontend, jadi sinkronkan ke status efektif
        // tanpa mengubah nilai statusFinal yang tersimpan di database.
        statusFinal: statusTampilan,
        statusEfektif: statusTampilan,
      };
    });

    const sudahAbsen = new Set(
      data.map((item) => item.pengguna?.id).filter((id) => id != null),
    );

    const belumAbsen = karyawanAktif.filter(
      (karyawan) => !sudahAbsen.has(karyawan.id),
    );

    return res.json({
      data: dataDenganFoto,
      belumAbsen,
      jumlahKaryawanAktif: karyawanAktif.length,
    });
  } catch (error) {
    console.error("Gagal mengambil rekap hari ini:", error);

    return res.status(500).json({
      pesan: "Terjadi kesalahan pada server.",
    });
  }
}

// ============================================================
// RINGKASAN DASHBOARD
// ============================================================
async function ringkasanDashboard(req, res) {
  try {
    const tanggalHariIni = tanggalHariIniWIB();

    const tujuhHariLalu = new Date(tanggalHariIni);
    tujuhHariLalu.setUTCDate(tujuhHariLalu.getUTCDate() - 6);

    const [absensi7Hari, pengaturan] = await Promise.all([
      prisma.absensi.findMany({
        where: {
          tanggal: {
            gte: tujuhHariLalu,
            lte: tanggalHariIni,
          },
        },

        select: {
          tanggal: true,
          jamMasuk: true,
          statusOtomatis: true,
          statusFinal: true,
          dieditOleh: true,
        },
      }),
      prisma.pengaturanPotongan.upsert({
        where: { id: 1 },
        update: {},
        create: {
          id: 1,
          potonganTelat: 10000,
          potonganAlpha: 15000,
          jamMasukStandar: JAM_MASUK_STANDAR_DEFAULT,
        },
      }),
    ]);

    const jamMasukStandar =
      pengaturan?.jamMasukStandar || JAM_MASUK_STANDAR_DEFAULT;

    const trenPerTanggal = {};

    for (let i = 0; i < 7; i++) {
      const t = new Date(tujuhHariLalu);
      t.setUTCDate(t.getUTCDate() + i);

      const key = t.toISOString().slice(0, 10);

      trenPerTanggal[key] = {
        tanggal: key,
        tepatWaktu: 0,
        telat: 0,
        alpha: 0,
        izinDll: 0,
      };
    }

    for (const a of absensi7Hari) {
      const key = a.tanggal.toISOString().slice(0, 10);

      if (!trenPerTanggal[key]) continue;

      const s = statusEfektif(a, jamMasukStandar);

      if (s === "tepat_waktu") {
        trenPerTanggal[key].tepatWaktu += 1;
      } else if (s === "telat") {
        trenPerTanggal[key].telat += 1;
      } else if (s === "alpha") {
        trenPerTanggal[key].alpha += 1;
      } else {
        trenPerTanggal[key].izinDll += 1;
      }
    }

    const tigaPuluhHariLalu = new Date(tanggalHariIni);
    tigaPuluhHariLalu.setUTCDate(tigaPuluhHariLalu.getUTCDate() - 29);

    const absensiBulanan = await prisma.absensi.findMany({
      where: {
        tanggal: {
          gte: tigaPuluhHariLalu,
          lte: tanggalHariIni,
        },
      },

      select: {
        jamMasuk: true,
        statusOtomatis: true,
        statusFinal: true,
        dieditOleh: true,
        pengguna: {
          select: {
            id: true,
            nama: true,
          },
        },
      },
    });

    const rekapPerKaryawan = {};

    for (const a of absensiBulanan) {
      const s = statusEfektif(a, jamMasukStandar);

      if (s !== "telat" && s !== "alpha") {
        continue;
      }

      const id = a.pengguna.id;

      if (!rekapPerKaryawan[id]) {
        rekapPerKaryawan[id] = {
          id,
          nama: a.pengguna.nama,
          telat: 0,
          alpha: 0,
        };
      }

      rekapPerKaryawan[id][s] += 1;
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
    console.error(error);

    return res.status(500).json({
      pesan: "Terjadi kesalahan pada server.",
    });
  }
}

// ============================================================
// EDIT STATUS ABSENSI SECARA MANUAL
// ============================================================
async function editStatusAbsensi(req, res) {
  try {
    const { id } = req.params;
    const { statusFinal, catatanAdmin } = req.body;
    const adminId = req.user.id;

    const absensi = await prisma.absensi.update({
      where: {
        id: parseInt(id),
      },

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
    console.error(error);

    return res.status(500).json({
      pesan: "Terjadi kesalahan pada server.",
    });
  }
}

// ============================================================
// PENGATURAN POTONGAN GAJI
// ============================================================
async function ambilPengaturanPotongan(req, res) {
  try {
    const pengaturan = await prisma.pengaturanPotongan.upsert({
      where: {
        id: 1,
      },

      update: {},

      create: {
        id: 1,
        potonganTelat: 10000,
        potonganAlpha: 15000,
        jamMasukStandar: JAM_MASUK_STANDAR_DEFAULT,
      },
    });

    return res.json({
      data: pengaturan,
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      pesan: "Terjadi kesalahan pada server.",
    });
  }
}

async function ubahPengaturanPotongan(req, res) {
  try {
    const { potonganTelat, potonganAlpha, jamMasukStandar } = req.body;

    if (potonganTelat == null || potonganAlpha == null) {
      return res.status(400).json({
        pesan: "Potongan telat dan potongan alpha wajib diisi.",
      });
    }

    if (Number(potonganTelat) < 0 || Number(potonganAlpha) < 0) {
      return res.status(400).json({
        pesan: "Nominal potongan tidak boleh negatif.",
      });
    }

    const jamMasuk = jamMasukStandar || JAM_MASUK_STANDAR_DEFAULT;

    if (!/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/.test(String(jamMasuk))) {
      return res.status(400).json({
        pesan: "Jam masuk standar tidak valid. Gunakan format HH:MM atau HH:MM:SS.",
      });
    }

    const pengaturan = await prisma.pengaturanPotongan.upsert({
      where: {
        id: 1,
      },

      update: {
        potonganTelat: Number(potonganTelat),
        potonganAlpha: Number(potonganAlpha),
        jamMasukStandar: jamMasuk,
      },

      create: {
        id: 1,
        potonganTelat: Number(potonganTelat),
        potonganAlpha: Number(potonganAlpha),
        jamMasukStandar: jamMasuk,
      },
    });

    return res.json({
      pesan: "Pengaturan potongan berhasil diperbarui.",
      data: pengaturan,
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      pesan: "Terjadi kesalahan pada server.",
    });
  }
}

// ============================================================
// GAJI POKOK PER KARYAWAN
// ============================================================
async function daftarGajiKaryawan(req, res) {
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
    console.error(error);

    return res.status(500).json({
      pesan: "Terjadi kesalahan pada server.",
    });
  }
}

async function ubahGajiKaryawan(req, res) {
  try {
    const { id } = req.params;
    const { gajiPokok } = req.body;

    if (gajiPokok == null || Number(gajiPokok) < 0) {
      return res.status(400).json({
        pesan: "Gaji pokok wajib diisi dan tidak boleh negatif.",
      });
    }

    const pengguna = await prisma.pengguna.findUnique({
      where: {
        id: parseInt(id),
      },
    });

    if (!pengguna) {
      return res.status(404).json({
        pesan: "Karyawan tidak ditemukan.",
      });
    }

    if (pengguna.peran !== "karyawan") {
      return res.status(400).json({
        pesan: "Gaji hanya bisa diatur untuk akun karyawan.",
      });
    }

    const gaji = await prisma.gajiKaryawan.upsert({
      where: {
        penggunaId: parseInt(id),
      },

      update: {
        gajiPokok: Number(gajiPokok),
      },

      create: {
        penggunaId: parseInt(id),
        gajiPokok: Number(gajiPokok),
      },
    });

    return res.json({
      pesan: `Gaji pokok ${pengguna.nama} berhasil diperbarui.`,
      data: gaji,
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      pesan: "Terjadi kesalahan pada server.",
    });
  }
}

// ============================================================
// KANTOR / CABANG
// ============================================================
async function daftarKantor(req, res) {
  try {
    const data = await prisma.kantor.findMany({
      orderBy: {
        id: "asc",
      },

      include: {
        _count: {
          select: {
            pengguna: true,
          },
        },
      },
    });

    return res.json({ data });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      pesan: "Terjadi kesalahan pada server.",
    });
  }
}

async function tambahKantor(req, res) {
  try {
    const { namaKantor, alamat, latitude, longitude } = req.body;

    if (!namaKantor || !namaKantor.trim()) {
      return res.status(400).json({
        pesan: "Nama kantor wajib diisi.",
      });
    }

    if (latitude && isNaN(parseFloat(latitude))) {
      return res.status(400).json({
        pesan: "Latitude harus berupa angka.",
      });
    }

    if (longitude && isNaN(parseFloat(longitude))) {
      return res.status(400).json({
        pesan: "Longitude harus berupa angka.",
      });
    }

    const kantor = await prisma.kantor.create({
      data: {
        namaKantor: namaKantor.trim(),
        alamat: alamat || null,
        latitude: latitude ? parseFloat(latitude) : null,
        longitude: longitude ? parseFloat(longitude) : null,
      },
    });

    return res.status(201).json({
      pesan: `Kantor "${kantor.namaKantor}" berhasil ditambahkan.`,
      data: kantor,
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      pesan: "Terjadi kesalahan pada server.",
    });
  }
}

async function ubahKantor(req, res) {
  try {
    const { id } = req.params;
    const { namaKantor, alamat, latitude, longitude } = req.body;

    if (!namaKantor || !namaKantor.trim()) {
      return res.status(400).json({
        pesan: "Nama kantor wajib diisi.",
      });
    }

    if (latitude && isNaN(parseFloat(latitude))) {
      return res.status(400).json({
        pesan: "Latitude harus berupa angka.",
      });
    }

    if (longitude && isNaN(parseFloat(longitude))) {
      return res.status(400).json({
        pesan: "Longitude harus berupa angka.",
      });
    }

    const kantor = await prisma.kantor.update({
      where: {
        id: parseInt(id),
      },

      data: {
        namaKantor: namaKantor.trim(),
        alamat: alamat || null,
        latitude: latitude ? parseFloat(latitude) : null,
        longitude: longitude ? parseFloat(longitude) : null,
      },
    });

    return res.json({
      pesan: `Kantor "${kantor.namaKantor}" berhasil diperbarui.`,
      data: kantor,
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      pesan: "Terjadi kesalahan pada server.",
    });
  }
}

// ============================================================
// HARI LIBUR
// ============================================================
async function daftarHariLibur(req, res) {
  try {
    const { tahun } = req.query;

    const where = tahun
      ? {
          tanggal: {
            gte: new Date(`${tahun}-01-01T00:00:00.000Z`),
            lte: new Date(`${tahun}-12-31T23:59:59.999Z`),
          },
        }
      : {};

    const data = await prisma.hariLibur.findMany({
      where,
      orderBy: {
        tanggal: "asc",
      },
    });

    return res.json({ data });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      pesan: "Terjadi kesalahan pada server.",
    });
  }
}

async function tambahHariLibur(req, res) {
  try {
    const { tanggal, keterangan } = req.body;

    if (!tanggal) {
      return res.status(400).json({
        pesan: "Tanggal wajib diisi.",
      });
    }

    if (!keterangan || !keterangan.trim()) {
      return res.status(400).json({
        pesan: "Keterangan wajib diisi (contoh: Hari Kemerdekaan).",
      });
    }

    const sudahAda = await prisma.hariLibur.findUnique({
      where: {
        tanggal: new Date(`${tanggal}T00:00:00.000Z`),
      },
    });

    if (sudahAda) {
      return res.status(400).json({
        pesan: "Tanggal ini sudah terdaftar sebagai hari libur.",
      });
    }

    const hariLibur = await prisma.hariLibur.create({
      data: {
        tanggal: new Date(`${tanggal}T00:00:00.000Z`),
        keterangan: keterangan.trim(),
      },
    });

    return res.status(201).json({
      pesan: `Hari libur "${hariLibur.keterangan}" berhasil ditambahkan.`,
      data: hariLibur,
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      pesan: "Terjadi kesalahan pada server.",
    });
  }
}

async function hapusHariLibur(req, res) {
  try {
    const { id } = req.params;

    await prisma.hariLibur.delete({
      where: {
        id: Number(id),
      },
    });

    return res.json({
      pesan: "Hari libur berhasil dihapus.",
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      pesan: "Terjadi kesalahan pada server.",
    });
  }
}

// ============================================================
// PROXY USULAN HARI LIBUR NASIONAL
// ============================================================
async function usulanHariLibur(req, res) {
  try {
    const tahun = parseInt(req.query.tahun) || new Date().getFullYear();
    const kontrolWaktu = new AbortController();
    const timeoutId = setTimeout(() => kontrolWaktu.abort(), 8000);

    const responLuar = await fetch(
      `https://api-hari-libur.vercel.app/api?year=${tahun}`,
      {
        signal: kontrolWaktu.signal,
      },
    );

    clearTimeout(timeoutId);

    if (!responLuar.ok) {
      return res.status(502).json({
        pesan:
          "Sumber data hari libur sedang tidak bisa diakses. Coba lagi nanti, atau tambahkan manual.",
      });
    }

    const data = await responLuar.json();
    return res.json(data);
  } catch (error) {
    console.error("Gagal ambil usulan hari libur:", error.message);

    return res.status(502).json({
      pesan:
        "Sumber data hari libur sedang tidak bisa diakses. Coba lagi nanti, atau tambahkan manual.",
    });
  }
}

// ============================================================
// NOTIFIKASI ADMIN
// Mengambil jumlah hal penting yang masih perlu diproses Admin.
// ============================================================
async function notifikasiAdmin(req, res) {
  try {
    const [jumlahAkunBaru, jumlahIzinMenunggu] = await Promise.all([
      prisma.pengguna.count({
        where: {
          peran: "karyawan",
          statusAkun: "menunggu_konfirmasi",
        },
      }),

      prisma.pengajuanIzin.count({
        where: {
          status: "menunggu",
        },
      }),
    ]);

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

// ============================================================
// EXPORT
// ============================================================
module.exports = {
  daftarMenungguKonfirmasi,
  aktifkanAkun,
  daftarKaryawan,
  ubahStatusKaryawan,
  rekapHariIni,
  ringkasanDashboard,
  editStatusAbsensi,
  ambilPengaturanPotongan,
  ubahPengaturanPotongan,
  daftarGajiKaryawan,
  ubahGajiKaryawan,
  daftarKantor,
  tambahKantor,
  ubahKantor,
  daftarHariLibur,
  tambahHariLibur,
  hapusHariLibur,
  usulanHariLibur,
  notifikasiAdmin,
};
