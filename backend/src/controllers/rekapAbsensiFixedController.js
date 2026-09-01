const prisma = require("../utils/prismaClient");
const { tanggalHariIniWIB } = require("../utils/waktuIndonesia");
const { buatSignedUrlFotoBatch } = require("../utils/supabaseStorage");

const RADIUS_GPS_STRIKT_METER = 1500;
const RADIUS_KONFIRMASI_ALAMAT_METER = 20_000;
const KATA_UMUM_ALAMAT = new Set([
  "jalan",
  "jl",
  "jln",
  "no",
  "nomor",
  "rt",
  "rw",
  "kelurahan",
  "kel",
  "kecamatan",
  "kec",
  "kota",
  "kabupaten",
  "kab",
  "provinsi",
  "indonesia",
  "kantor",
  "pusat",
  "office",
  "indonesia",
  "barat",
  "timur",
  "utara",
  "selatan",
]);

function normalisasiTeks(nilai) {
  return String(nilai || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenWilayah(nilai) {
  return new Set(
    normalisasiTeks(nilai)
      .split(" ")
      .filter((token) => token.length >= 4 && !KATA_UMUM_ALAMAT.has(token)),
  );
}

function jumlahKecocokanWilayah(alamat, kantor) {
  if (!alamat) return 0;

  const tokenAlamat = tokenWilayah(alamat);
  const tokenKantor = tokenWilayah(
    `${kantor?.namaKantor || ""} ${kantor?.alamat || ""}`,
  );

  let jumlah = 0;
  for (const token of tokenKantor) {
    if (tokenAlamat.has(token)) jumlah += 1;
  }
  return jumlah;
}

function hitungJarakMeter(latitude, longitude, kantorLatitude, kantorLongitude) {
  const lat = Number(latitude);
  const lng = Number(longitude);
  const kLat = Number(kantorLatitude);
  const kLng = Number(kantorLongitude);

  if (![lat, lng, kLat, kLng].every(Number.isFinite)) return null;

  const toRad = (nilai) => (nilai * Math.PI) / 180;
  const R = 6_371_000;
  const dLat = toRad(kLat - lat);
  const dLng = toRad(kLng - lng);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat)) *
      Math.cos(toRad(kLat)) *
      Math.sin(dLng / 2) ** 2;

  return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function tentukanKantor(latitude, longitude, alamat, semuaKantor) {
  if (!Array.isArray(semuaKantor) || semuaKantor.length === 0) return null;

  const kandidat = semuaKantor.map((kantor) => ({
    ...kantor,
    jarakMeter: hitungJarakMeter(
      latitude,
      longitude,
      kantor.latitude,
      kantor.longitude,
    ),
    kecocokanWilayah: jumlahKecocokanWilayah(alamat, kantor),
  }));

  const denganKoordinat = kandidat.filter((kantor) => kantor.jarakMeter != null);

  // 1. Identitas wilayah pada alamat GPS lebih kuat daripada sekadar
  //    memilih kantor terdekat. Ini mencegah Bandung jatuh ke Pekanbaru
  //    ketika koordinat kantor Bandung belum tepat/terisi.
  const kandidatWilayah = kandidat
    .filter((kantor) => kantor.kecocokanWilayah > 0)
    .filter(
      (kantor) =>
        kantor.jarakMeter == null ||
        kantor.jarakMeter <= RADIUS_KONFIRMASI_ALAMAT_METER,
    )
    .sort(
      (a, b) =>
        b.kecocokanWilayah - a.kecocokanWilayah ||
        (a.jarakMeter ?? Number.POSITIVE_INFINITY) -
          (b.jarakMeter ?? Number.POSITIVE_INFINITY),
    );

  if (kandidatWilayah.length > 0) {
    const pilihan = kandidatWilayah[0];
    return {
      id: pilihan.id,
      namaKantor: pilihan.namaKantor,
      jarakMeter:
        pilihan.jarakMeter == null ? null : Math.round(pilihan.jarakMeter),
      sumber: "alamat_gps",
    };
  }

  // 2. Kalau tidak ada petunjuk wilayah, gunakan GPS hanya bila benar-benar
  //    dekat. Jangan pernah memilih kantor yang jauh hanya karena itu satu-
  //    satunya kandidat yang mempunyai koordinat.
  const terdekat = denganKoordinat.sort(
    (a, b) => a.jarakMeter - b.jarakMeter,
  )[0];

  if (terdekat && terdekat.jarakMeter <= RADIUS_GPS_STRIKT_METER) {
    return {
      id: terdekat.id,
      namaKantor: terdekat.namaKantor,
      jarakMeter: Math.round(terdekat.jarakMeter),
      sumber: "gps",
    };
  }

  // 3. Tidak yakin = jangan mengarang kantor.
  return null;
}

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

    const semuaPathFoto = [];
    for (const item of data) {
      if (
        item.fotoMasuk &&
        !item.fotoMasuk.startsWith("/uploads/")
      ) {
        semuaPathFoto.push(item.fotoMasuk);
      }
      if (
        item.fotoPulang &&
        !item.fotoPulang.startsWith("/uploads/")
      ) {
        semuaPathFoto.push(item.fotoPulang);
      }
    }

    // Dua operasi setelah data absensi tersedia tidak saling bergantung,
    // jadi jalankan bersamaan untuk mengurangi waktu tunggu halaman rekap.
    const [semuaKantor, petaUrlFoto] = await Promise.all([
      prisma.kantor.findMany({
        select: {
          id: true,
          namaKantor: true,
          alamat: true,
          latitude: true,
          longitude: true,
        },
      }),
      buatSignedUrlFotoBatch(semuaPathFoto),
    ]);

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

      const kantorMasuk = tentukanKantor(
        item.latitudeMasuk,
        item.longitudeMasuk,
        item.alamatMasuk,
        semuaKantor,
      );
      const kantorPulang = tentukanKantor(
        item.latitudePulang,
        item.longitudePulang,
        item.alamatPulang,
        semuaKantor,
      );

      const alamatAsli = item.alamatMasuk || null;
      let alamatTampilan = alamatAsli || "Lokasi GPS belum tersedia";

      if (kantorMasuk) {
        alamatTampilan = `${kantorMasuk.namaKantor}${
          alamatAsli ? ` · ${alamatAsli}` : ""
        }`;
      } else if (alamatAsli) {
        alamatTampilan = `${alamatAsli} · Kantor belum dapat dicocokkan`;
      }

      return {
        ...item,
        fotoMasukUrl,
        fotoPulangUrl,
        alamatMasuk: alamatTampilan,
        kantorAbsensi: kantorMasuk,
        kantorPulangAbsensi: kantorPulang,
      };
    });

    const sudahAbsen = new Set(
      data
        .map((item) => item.pengguna?.id)
        .filter((id) => id != null),
    );
    const belumAbsen = karyawanAktif.filter(
      (karyawan) => !sudahAbsen.has(karyawan.id),
    );

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
