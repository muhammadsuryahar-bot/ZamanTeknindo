const prisma = require("../utils/prismaClient");
const { tanggalHariIniWIB } = require("../utils/waktuIndonesia");

// ============================================================
// LIHAT DAFTAR AKUN YANG MENUNGGU KONFIRMASI
// ============================================================
async function daftarMenungguKonfirmasi(req, res) {
  try {
    const data = await prisma.pengguna.findMany({
      where: { statusAkun: "menunggu_konfirmasi" },
      select: { id: true, nama: true, email: true, dibuatPada: true },
      orderBy: { dibuatPada: "desc" },
    });
    return res.json({ data });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ pesan: "Terjadi kesalahan pada server.", detail: error.message });
  }
}

// ============================================================
// AKTIFKAN AKUN KARYAWAN (sekaligus lengkapi jabatan, divisi, kantor)
// ============================================================
async function aktifkanAkun(req, res) {
  try {
    const { id } = req.params;
    const { jabatan, divisi, kantorId } = req.body;

    // Perusahaan cuma punya 1 kantor fisik (Pekanbaru) walau karyawannya
    // tersebar remote di seluruh Indonesia -- jadi kita otomatis pasang
    // kantor itu tanpa perlu admin pilih manual tiap kali aktifkan akun.
    // Kalau suatu saat nanti ada cabang ke-2, admin tinggal kirim kantorId
    // eksplisit dan ini akan dihormati.
    let kantorIdFinal = kantorId ? parseInt(kantorId) : null;
    if (!kantorIdFinal) {
      const kantorPertama = await prisma.kantor.findFirst({ orderBy: { id: "asc" } });
      kantorIdFinal = kantorPertama?.id || null;
    }

    const pengguna = await prisma.pengguna.update({
      where: { id: parseInt(id) },
      data: {
        jabatan,
        divisi,
        kantorId: kantorIdFinal,
        statusAkun: "aktif",
      },
    });

    return res.json({ pesan: `Akun ${pengguna.nama} berhasil diaktifkan.`, data: pengguna });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ pesan: "Terjadi kesalahan pada server.", detail: error.message });
  }
}

// ============================================================
// LIHAT SEMUA KARYAWAN (yang statusnya aktif/nonaktif, bukan yang masih menunggu)
// ============================================================
async function daftarKaryawan(req, res) {
  try {
    const data = await prisma.pengguna.findMany({
      where: { peran: "karyawan", statusAkun: { not: "menunggu_konfirmasi" } },
      select: {
        id: true, nama: true, email: true, jabatan: true, divisi: true,
        statusAkun: true, kantor: { select: { namaKantor: true } },
      },
      orderBy: { nama: "asc" },
    });
    return res.json({ data });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ pesan: "Terjadi kesalahan pada server.", detail: error.message });
  }
}

// ============================================================
// NONAKTIFKAN / AKTIFKAN KEMBALI KARYAWAN
// ============================================================
async function ubahStatusKaryawan(req, res) {
  try {
    const { id } = req.params;
    const { statusAkun } = req.body; // "aktif" atau "nonaktif"

    const pengguna = await prisma.pengguna.update({
      where: { id: parseInt(id) },
      data: { statusAkun },
    });

    return res.json({ pesan: `Status ${pengguna.nama} diubah menjadi ${statusAkun}.`, data: pengguna });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ pesan: "Terjadi kesalahan pada server.", detail: error.message });
  }
}

// ============================================================
// REKAP ABSENSI HARI INI (semua karyawan) — buat dashboard admin
// ============================================================
async function rekapHariIni(req, res) {
  try {
    // Gunakan tanggal WIB supaya rekap Admin konsisten dengan proses absensi.
    const tanggal = tanggalHariIniWIB();

    const [data, karyawanAktif] = await Promise.all([
      prisma.absensi.findMany({
        where: { tanggal },
        include: {
          pengguna: { select: { id: true, nama: true, jabatan: true, divisi: true } },
        },
        orderBy: { jamMasuk: "asc" },
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
        orderBy: { nama: "asc" },
      }),
    ]);

    const sudahAbsen = new Set(
      data
        .map((item) => item.pengguna?.id)
        .filter((id) => id != null)
    );

    const belumAbsen = karyawanAktif
      .filter((karyawan) => !sudahAbsen.has(karyawan.id));

    return res.json({ data, belumAbsen });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ pesan: "Terjadi kesalahan pada server." });
  }
}

// ============================================================
// RINGKASAN DASHBOARD (tren 7 hari + karyawan perlu perhatian)
// GET /api/admin/ringkasan
// ============================================================
async function ringkasanDashboard(req, res) {
  try {
    const tanggalHariIni = tanggalHariIniWIB();
    const tujuhHariLalu = new Date(tanggalHariIni);
    tujuhHariLalu.setUTCDate(tujuhHariLalu.getUTCDate() - 6); // termasuk hari ini = 7 hari

    const absensi7Hari = await prisma.absensi.findMany({
      where: { tanggal: { gte: tujuhHariLalu, lte: tanggalHariIni } },
      select: { tanggal: true, statusOtomatis: true, statusFinal: true },
    });

    function statusEfektif(a) {
      return a.statusFinal || a.statusOtomatis || "alpha";
    }

    // Tren per tanggal, 7 hari terakhir (termasuk hari yang belum ada datanya sama sekali)
    const trenPerTanggal = {};
    for (let i = 0; i < 7; i++) {
      const t = new Date(tujuhHariLalu);
      t.setUTCDate(t.getUTCDate() + i);
      const key = t.toISOString().slice(0, 10);
      trenPerTanggal[key] = { tanggal: key, tepatWaktu: 0, telat: 0, alpha: 0, izinDll: 0 };
    }
    for (const a of absensi7Hari) {
      const key = a.tanggal.toISOString().slice(0, 10);
      if (!trenPerTanggal[key]) continue;
      const s = statusEfektif(a);
      if (s === "tepat_waktu") trenPerTanggal[key].tepatWaktu += 1;
      else if (s === "telat") trenPerTanggal[key].telat += 1;
      else if (s === "alpha") trenPerTanggal[key].alpha += 1;
      else trenPerTanggal[key].izinDll += 1;
    }

    // Karyawan paling sering telat/alpha, 30 hari terakhir -> buat "Perlu Perhatian"
    const tigaPuluhHariLalu = new Date(tanggalHariIni);
    tigaPuluhHariLalu.setUTCDate(tigaPuluhHariLalu.getUTCDate() - 29);

    const absensiBulanan = await prisma.absensi.findMany({
      where: { tanggal: { gte: tigaPuluhHariLalu, lte: tanggalHariIni } },
      select: {
        statusOtomatis: true,
        statusFinal: true,
        pengguna: { select: { id: true, nama: true } },
      },
    });

    const rekapPerKaryawan = {};
    for (const a of absensiBulanan) {
      const s = statusEfektif(a);
      if (s !== "telat" && s !== "alpha") continue;
      const id = a.pengguna.id;
      if (!rekapPerKaryawan[id]) rekapPerKaryawan[id] = { id, nama: a.pengguna.nama, telat: 0, alpha: 0 };
      rekapPerKaryawan[id][s] += 1;
    }
    const sorotanKaryawan = Object.values(rekapPerKaryawan)
      .sort((a, b) => b.telat + b.alpha - (a.telat + a.alpha))
      .slice(0, 5);

    return res.json({ data: { tren7Hari: Object.values(trenPerTanggal), sorotanKaryawan } });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ pesan: "Terjadi kesalahan pada server.", detail: error.message });
  }
}

// ============================================================
// EDIT STATUS ABSENSI SECARA MANUAL (override oleh admin)
// ============================================================
async function editStatusAbsensi(req, res) {
  try {
    const { id } = req.params;
    const { statusFinal, catatanAdmin } = req.body;
    const adminId = req.user.id;

    const absensi = await prisma.absensi.update({
      where: { id: parseInt(id) },
      data: {
        statusFinal,
        catatanAdmin,
        dieditOleh: adminId,
        waktuEdit: new Date(),
      },
    });

    return res.json({ pesan: "Status absensi berhasil diperbarui.", data: absensi });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ pesan: "Terjadi kesalahan pada server.", detail: error.message });
  }
}

// ============================================================
// PENGATURAN POTONGAN GAJI (global, berlaku semua karyawan)
// Disimpan 1 baris saja (id selalu 1), bisa diubah kapan saja
// ============================================================
async function ambilPengaturanPotongan(req, res) {
  try {
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
    return res.json({ data: pengaturan });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ pesan: "Terjadi kesalahan pada server.", detail: error.message });
  }
}

async function ubahPengaturanPotongan(req, res) {
  try {
    const { potonganTelat, potonganAlpha, jamMasukStandar } = req.body;

    if (potonganTelat == null || potonganAlpha == null) {
      return res.status(400).json({ pesan: "Potongan telat dan potongan alpha wajib diisi." });
    }
    if (Number(potonganTelat) < 0 || Number(potonganAlpha) < 0) {
      return res.status(400).json({ pesan: "Nominal potongan tidak boleh negatif." });
    }

    const pengaturan = await prisma.pengaturanPotongan.upsert({
      where: { id: 1 },
      update: {
        potonganTelat: Number(potonganTelat),
        potonganAlpha: Number(potonganAlpha),
        jamMasukStandar: jamMasukStandar || "08:00:00",
      },
      create: {
        id: 1,
        potonganTelat: Number(potonganTelat),
        potonganAlpha: Number(potonganAlpha),
        jamMasukStandar: jamMasukStandar || "08:00:00",
      },
    });

    return res.json({ pesan: "Pengaturan potongan berhasil diperbarui.", data: pengaturan });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ pesan: "Terjadi kesalahan pada server.", detail: error.message });
  }
}

// ============================================================
// GAJI POKOK PER KARYAWAN
// ============================================================
async function daftarGajiKaryawan(req, res) {
  try {
    const data = await prisma.pengguna.findMany({
      where: { peran: "karyawan", statusAkun: "aktif" },
      select: {
        id: true,
        nama: true,
        email: true,
        jabatan: true,
        divisi: true,
        gaji: { select: { gajiPokok: true, diubahPada: true } },
      },
      orderBy: { nama: "asc" },
    });
    return res.json({ data });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ pesan: "Terjadi kesalahan pada server.", detail: error.message });
  }
}

async function ubahGajiKaryawan(req, res) {
  try {
    const { id } = req.params;
    const { gajiPokok } = req.body;

    if (gajiPokok == null || Number(gajiPokok) < 0) {
      return res.status(400).json({ pesan: "Gaji pokok wajib diisi dan tidak boleh negatif." });
    }

    const pengguna = await prisma.pengguna.findUnique({ where: { id: parseInt(id) } });
    if (!pengguna) {
      return res.status(404).json({ pesan: "Karyawan tidak ditemukan." });
    }
    if (pengguna.peran !== "karyawan") {
      return res.status(400).json({ pesan: "Gaji hanya bisa diatur untuk akun karyawan." });
    }

    const gaji = await prisma.gajiKaryawan.upsert({
      where: { penggunaId: parseInt(id) },
      update: { gajiPokok: Number(gajiPokok) },
      create: { penggunaId: parseInt(id), gajiPokok: Number(gajiPokok) },
    });

    return res.json({ pesan: `Gaji pokok ${pengguna.nama} berhasil diperbarui.`, data: gaji });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ pesan: "Terjadi kesalahan pada server.", detail: error.message });
  }
}

// ============================================================
// KANTOR / CABANG — daftar, tambah, ubah
// ============================================================
async function daftarKantor(req, res) {
  try {
    const data = await prisma.kantor.findMany({
      orderBy: { id: "asc" },
      include: { _count: { select: { pengguna: true } } },
    });
    return res.json({ data });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ pesan: "Terjadi kesalahan pada server.", detail: error.message });
  }
}

async function tambahKantor(req, res) {
  try {
    const { namaKantor, alamat, latitude, longitude } = req.body;

    if (!namaKantor || !namaKantor.trim()) {
      return res.status(400).json({ pesan: "Nama kantor wajib diisi." });
    }
    // Validasi angka -- kalau dibiarkan lolos ke Prisma, latitude/longitude
    // yang bukan angka (misal NaN) bikin error generik dari database, bukan
    // pesan yang jelas buat pengguna.
    if (latitude && isNaN(parseFloat(latitude))) {
      return res.status(400).json({ pesan: "Latitude harus berupa angka." });
    }
    if (longitude && isNaN(parseFloat(longitude))) {
      return res.status(400).json({ pesan: "Longitude harus berupa angka." });
    }

    const kantor = await prisma.kantor.create({
      data: {
        namaKantor: namaKantor.trim(),
        alamat: alamat || null,
        latitude: latitude ? parseFloat(latitude) : null,
        longitude: longitude ? parseFloat(longitude) : null,
      },
    });

    return res.status(201).json({ pesan: `Kantor "${kantor.namaKantor}" berhasil ditambahkan.`, data: kantor });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ pesan: "Terjadi kesalahan pada server.", detail: error.message });
  }
}

async function ubahKantor(req, res) {
  try {
    const { id } = req.params;
    const { namaKantor, alamat, latitude, longitude } = req.body;

    if (!namaKantor || !namaKantor.trim()) {
      return res.status(400).json({ pesan: "Nama kantor wajib diisi." });
    }
    if (latitude && isNaN(parseFloat(latitude))) {
      return res.status(400).json({ pesan: "Latitude harus berupa angka." });
    }
    if (longitude && isNaN(parseFloat(longitude))) {
      return res.status(400).json({ pesan: "Longitude harus berupa angka." });
    }

    const kantor = await prisma.kantor.update({
      where: { id: parseInt(id) },
      data: {
        namaKantor: namaKantor.trim(),
        alamat: alamat || null,
        latitude: latitude ? parseFloat(latitude) : null,
        longitude: longitude ? parseFloat(longitude) : null,
      },
    });

    return res.json({ pesan: `Kantor "${kantor.namaKantor}" berhasil diperbarui.`, data: kantor });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ pesan: "Terjadi kesalahan pada server.", detail: error.message });
  }
}

// ============================================================
// HARI LIBUR (nasional/cuti bersama) -- supaya sistem tidak salah anggap
// SEMUA karyawan "Alpha" (lalu kena potongan gaji) di hari yang memang
// libur, hanya karena tidak ada yang absen hari itu.
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
    const data = await prisma.hariLibur.findMany({ where, orderBy: { tanggal: "asc" } });
    return res.json({ data });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ pesan: "Terjadi kesalahan pada server.", detail: error.message });
  }
}

async function tambahHariLibur(req, res) {
  try {
    const { tanggal, keterangan } = req.body;
    if (!tanggal) return res.status(400).json({ pesan: "Tanggal wajib diisi." });
    if (!keterangan || !keterangan.trim()) return res.status(400).json({ pesan: "Keterangan wajib diisi (contoh: Hari Kemerdekaan)." });

    const sudahAda = await prisma.hariLibur.findUnique({ where: { tanggal: new Date(`${tanggal}T00:00:00.000Z`) } });
    if (sudahAda) return res.status(400).json({ pesan: "Tanggal ini sudah terdaftar sebagai hari libur." });

    const hariLibur = await prisma.hariLibur.create({
      data: { tanggal: new Date(`${tanggal}T00:00:00.000Z`), keterangan: keterangan.trim() },
    });
    return res.status(201).json({ pesan: `Hari libur "${hariLibur.keterangan}" berhasil ditambahkan.`, data: hariLibur });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ pesan: "Terjadi kesalahan pada server.", detail: error.message });
  }
}

async function hapusHariLibur(req, res) {
  try {
    const { id } = req.params;
    await prisma.hariLibur.delete({ where: { id: Number(id) } });
    return res.json({ pesan: "Hari libur berhasil dihapus." });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ pesan: "Terjadi kesalahan pada server.", detail: error.message });
  }
}

// ============================================================
// PROXY: Ambil usulan hari libur nasional dari sumber publik
// (bersumber dari SKB 3 Menteri, via api-hari-libur.vercel.app)
//
// Ini WAJIB lewat backend, bukan dipanggil langsung dari browser --
// API publik itu tidak mengizinkan akses cross-origin dari browser
// (tidak ada header CORS di responnya), jadi kalau frontend coba akses
// langsung akan selalu gagal ("blocked by CORS policy"). Server-ke-server
// (backend kita manggil API luar) tidak kena aturan CORS itu, karena
// CORS memang cuma aturan yang berlaku di level browser.
async function usulanHariLibur(req, res) {
  try {
    const tahun = parseInt(req.query.tahun) || new Date().getFullYear();

    const kontrolWaktu = new AbortController();
    const timeoutId = setTimeout(() => kontrolWaktu.abort(), 8000); // 8 detik maksimal nunggu

    const responLuar = await fetch(`https://api-hari-libur.vercel.app/api?year=${tahun}`, {
      signal: kontrolWaktu.signal,
    });
    clearTimeout(timeoutId);

    if (!responLuar.ok) {
      return res.status(502).json({ pesan: "Sumber data hari libur sedang tidak bisa diakses. Coba lagi nanti, atau tambahkan manual." });
    }

    const data = await responLuar.json();
    return res.json(data);
  } catch (error) {
    console.error("Gagal ambil usulan hari libur:", error.message);
    return res.status(502).json({ pesan: "Sumber data hari libur sedang tidak bisa diakses. Coba lagi nanti, atau tambahkan manual." });
  }
}

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
};
