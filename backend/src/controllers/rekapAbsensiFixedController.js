const prisma = require("../utils/prismaClient");
const { tanggalHariIniWIB } = require("../utils/waktuIndonesia");
const { buatSignedUrlFotoBatch } = require("../utils/supabaseStorage");
const { deteksiKantorDariKoordinat } = require("../utils/deteksiKantor");

async function rekapHariIniFixed(req, res) {
  try {
    const tanggal = tanggalHariIniWIB();

    const [data, karyawanAktif] = await Promise.all([
      prisma.absensi.findMany({
        where: { tanggal },
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
        orderBy: { jamMasuk: "asc" },
      }),
      prisma.pengguna.findMany({
        where: { peran: "karyawan", statusAkun: "aktif" },
        select: { id: true, nama: true, jabatan: true, divisi: true },
        orderBy: { nama: "asc" },
      }),
    ]);

    // Satu kali ambil data kantor untuk seluruh rekap. Kantor absensi dihitung
    // dari koordinat GPS yang memang sudah tersimpan di tabel absensi, tanpa
    // menambah kolom DB dan tanpa satu query kantor per baris.
    const kantorBerkoordinat = await prisma.kantor.findMany({
      where: { latitude: { not: null }, longitude: { not: null } },
      select: { id: true, namaKantor: true, alamat: true, latitude: true, longitude: true },
    });

    const semuaPathFoto = [];
    for (const item of data) {
      if (item.fotoMasuk && !item.fotoMasuk.startsWith("/uploads/")) semuaPathFoto.push(item.fotoMasuk);
      if (item.fotoPulang && !item.fotoPulang.startsWith("/uploads/")) semuaPathFoto.push(item.fotoPulang);
    }
    const petaUrlFoto = await buatSignedUrlFotoBatch(semuaPathFoto);

    function kantorTerdekat(latitude, longitude) {
      if (latitude == null || longitude == null || kantorBerkoordinat.length === 0) return null;
      const lat = Number(latitude);
      const lng = Number(longitude);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

      const toRad = (nilai) => (nilai * Math.PI) / 180;
      let terdekat = null;
      const R = 6_371_000;

      for (const kantor of kantorBerkoordinat) {
        const dLat = toRad(Number(kantor.latitude) - lat);
        const dLng = toRad(Number(kantor.longitude) - lng);
        const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat)) * Math.cos(toRad(Number(kantor.latitude))) * Math.sin(dLng / 2) ** 2;
        const jarakMeter = 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        if (!terdekat || jarakMeter < terdekat.jarakMeter) {
          terdekat = { ...kantor, jarakMeter };
        }
      }

      return terdekat && terdekat.jarakMeter <= 10_000
        ? { id: terdekat.id, namaKantor: terdekat.namaKantor, jarakMeter: Math.round(terdekat.jarakMeter) }
        : null;
    }

    const dataDenganKantor = data.map((item) => {
      const fotoMasukUrl = item.fotoMasuk
        ? item.fotoMasuk.startsWith("/uploads/")
          ? item.fotoMasuk
          : petaUrlFoto.get(item.fotoMasuk) || null
        : null;
      const fotoPulangUrl = item.fotoPulang
        ? item.fotoPulang.startsWith("/uploads/")
          ? item.fotoPulang
          : petaUrlFoto.get(item.fotoPulang) || null
        : null;

      const kantorMasuk = kantorTerdekat(item.latitudeMasuk, item.longitudeMasuk);
      const kantorPulang = kantorTerdekat(item.latitudePulang, item.longitudePulang);
      const alamatAsli = item.alamatMasuk || null;
      const alamatTampilan = kantorMasuk
        ? `${kantorMasuk.namaKantor}${alamatAsli ? ` · ${alamatAsli}` : ""}`
        : alamatAsli || "Lokasi kantor belum teridentifikasi";

      return {
        ...item,
        fotoMasukUrl,
        fotoPulangUrl,
        alamatMasuk: alamatTampilan,
        kantorAbsensi: kantorMasuk,
        kantorPulangAbsensi: kantorPulang,
      };
    });

    const sudahAbsen = new Set(data.map((item) => item.pengguna?.id).filter((id) => id != null));
    const belumAbsen = karyawanAktif.filter((karyawan) => !sudahAbsen.has(karyawan.id));

    return res.json({
      data: dataDenganKantor,
      belumAbsen,
      jumlahKaryawanAktif: karyawanAktif.length,
    });
  } catch (error) {
    console.error("Gagal mengambil rekap absensi dengan kantor aktual:", error);
    return res.status(500).json({ pesan: "Terjadi kesalahan pada server." });
  }
}

module.exports = { rekapHariIniFixed };